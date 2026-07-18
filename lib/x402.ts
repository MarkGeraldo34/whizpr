import { createHmac } from 'crypto';
import { ALERT_COST_WHIZCREDITS, whizcreditsToUsdtAtomic } from './pricing';

/**
 * OKX Agent Payments Protocol (x402 v2, "exact" scheme) support for a paid
 * Whizpr endpoint. This lets an AI agent submit one alert with a single
 * signed payment — no SIWE login, no prepaid deposit — as an alternative to
 * the session + Whizcredits ledger flow in app/api/report/route.ts.
 *
 * The challenge/signature/settlement-response shapes below are the x402 v2
 * wire format (confirmed live against another OKX-ecosystem x402 seller
 * during testing, not just the spec). The settle endpoint path is per OKX's
 * published docs (web3.okx.com/onchainos/dev-docs/payments/api-http-batch)
 * — this environment couldn't reach that host to confirm exact
 * request/response field names beyond what's used here, so verify against
 * the live docs before relying on this in production.
 */

const X402_VERSION = 2;
const SCHEME = 'exact' as const;
const MAX_TIMEOUT_SECONDS = 300;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export interface X402Accept {
  scheme: 'exact';
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

function getExpectedAccept(): X402Accept {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? '196';
  return {
    scheme: SCHEME,
    network: `eip155:${chainId}`,
    amount: whizcreditsToUsdtAtomic(ALERT_COST_WHIZCREDITS).toString(),
    asset: getEnv('NEXT_PUBLIC_USDT_TOKEN_ADDRESS'),
    payTo: getEnv('NEXT_PUBLIC_DEPOSIT_ADDRESS'),
    maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
    extra: { name: 'USD₮0', version: '1' },
  };
}

/** Builds the base64 PAYMENT-REQUIRED challenge for the alert-submission endpoint. */
export function buildReportPaymentChallenge(resourceUrl: string) {
  const accept = getExpectedAccept();
  const challenge = {
    x402Version: X402_VERSION,
    error: 'Payment required',
    resource: {
      url: resourceUrl,
      description: 'Whizpr emergency alert submission',
      mimeType: 'application/json',
    },
    accepts: [accept],
  };
  const headerValue = Buffer.from(JSON.stringify(challenge)).toString('base64');
  return { headerValue, accept };
}

export interface DecodedPaymentSignature {
  accepted: X402Accept;
  payload: {
    authorization: {
      from: string;
      nonce: string;
      to: string;
      validAfter: string;
      validBefore: string;
      value: string;
    };
    signature: string;
  };
  resource?: { url: string; description: string; mimeType: string };
  x402Version: number;
}

/** Decodes and structurally validates a client's PAYMENT-SIGNATURE header. Returns null if malformed. */
export function decodePaymentSignature(header: string): DecodedPaymentSignature | null {
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return null;
  }

  const decoded = json as Partial<DecodedPaymentSignature>;
  const auth = decoded.payload?.authorization;
  if (
    decoded.x402Version !== X402_VERSION ||
    decoded.accepted?.scheme !== SCHEME ||
    !auth ||
    typeof decoded.payload?.signature !== 'string' ||
    !auth.from ||
    !auth.to ||
    !auth.nonce ||
    !auth.validAfter ||
    !auth.validBefore ||
    !auth.value
  ) {
    return null;
  }
  return decoded as DecodedPaymentSignature;
}

/** Confirms a decoded payment authorization actually matches what this endpoint requires. */
export function validatePayment(
  decoded: DecodedPaymentSignature,
  expected: X402Accept,
): { ok: true } | { ok: false; reason: string } {
  const auth = decoded.payload.authorization;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (decoded.accepted.network !== expected.network) return { ok: false, reason: 'network mismatch' };
  if (decoded.accepted.asset.toLowerCase() !== expected.asset.toLowerCase()) {
    return { ok: false, reason: 'asset mismatch' };
  }
  if (decoded.accepted.amount !== expected.amount) return { ok: false, reason: 'amount mismatch' };
  if (auth.to.toLowerCase() !== expected.payTo.toLowerCase()) return { ok: false, reason: 'payTo mismatch' };
  if (auth.value !== expected.amount) return { ok: false, reason: 'authorized value does not match required amount' };
  if (Number(auth.validBefore) <= nowSeconds) return { ok: false, reason: 'authorization expired' };
  if (Number(auth.validAfter) > nowSeconds) return { ok: false, reason: 'authorization not yet valid' };

  return { ok: true };
}

export interface SettleResult {
  success: boolean;
  status?: string;
  transaction?: string;
  network?: string;
  payer?: string;
  amount?: string;
  errorReason?: string | null;
  errorMessage?: string | null;
}

const OKX_X402_DEFAULT_BASE_URL = 'https://web3.okx.com';
const OKX_X402_SETTLE_PATH = '/api/v6/pay/x402/settle';

function signOkxRequest(method: string, path: string, body: string) {
  const apiKey = getEnv('OKX_ONCHAINOS_API_KEY');
  const apiSecret = getEnv('OKX_ONCHAINOS_API_SECRET');
  const passphrase = process.env.OKX_ONCHAINOS_API_PASSPHRASE ?? '';

  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method}${path}${body}`;
  const signature = createHmac('sha256', apiSecret).update(prehash).digest('base64');

  return {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
  };
}

/**
 * Submits a verified payment authorization to OKX's x402 facilitator for
 * settlement. A `success: true` response means the facilitator accepted the
 * authorization for its batch settlement queue — not that it has landed
 * on-chain yet (poll /settle/status for the final on-chain outcome; not
 * implemented here — see README "Known gaps").
 */
export async function settleX402Payment(
  decoded: DecodedPaymentSignature,
  expected: X402Accept,
): Promise<SettleResult> {
  const baseUrl = process.env.OKX_X402_API_BASE_URL || OKX_X402_DEFAULT_BASE_URL;
  const body = JSON.stringify({
    x402Version: X402_VERSION,
    paymentPayload: decoded,
    paymentRequirements: expected,
  });
  const headers = signOkxRequest('POST', OKX_X402_SETTLE_PATH, body);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${OKX_X402_SETTLE_PATH}`, { method: 'POST', headers, body, cache: 'no-store' });
  } catch (err) {
    return {
      success: false,
      errorReason: 'facilitator_unreachable',
      errorMessage: err instanceof Error ? err.message : 'Could not reach the OKX facilitator',
    };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    return {
      success: false,
      errorReason: 'facilitator_error',
      errorMessage: `Settle request failed (HTTP ${res.status})`,
    };
  }
  return json as SettleResult;
}

export function encodePaymentResponse(result: SettleResult): string {
  return Buffer.from(JSON.stringify(result)).toString('base64');
}
