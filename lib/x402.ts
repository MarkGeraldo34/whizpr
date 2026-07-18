import { createHmac } from 'crypto';
import { ALERT_COST_WHIZCREDITS, PRECISE_LOCATION_COST_WHIZCREDITS, whizcreditsToUsdtAtomic } from './pricing';

/**
 * OKX Agent Payments Protocol (x402 v2, "exact" scheme) support for a paid
 * Whizpr endpoint. This lets an AI agent submit one alert with a single
 * signed payment — no SIWE login, no prepaid deposit — as an alternative to
 * the session + Whizcredits ledger flow in app/api/report/route.ts.
 *
 * The challenge/signature shapes are the x402 v2 wire format (confirmed live
 * against another OKX-ecosystem x402 seller during testing). The facilitator
 * request/response shape, envelope, endpoint path, and HMAC signing scheme
 * are confirmed against OKX's own Go SDK source
 * (github.com/okx/payments — go/x402/http/okx_facilitator_client.go and
 * okx_auth.go): base URL `https://web3.okx.com`, path `/api/v6/pay/x402/settle`,
 * body `{x402Version, paymentPayload, paymentRequirements, syncSettle}`,
 * response unwrapped from an OKX `{code, msg, data}` envelope. Still worth a
 * live smoke test against real credentials before trusting this with real
 * money — this was verified by reading the SDK, not by exercising the API.
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

function getExpectedAccept(whizcreditsCost: bigint): X402Accept {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? '196';
  return {
    scheme: SCHEME,
    network: `eip155:${chainId}`,
    amount: whizcreditsToUsdtAtomic(whizcreditsCost).toString(),
    asset: getEnv('NEXT_PUBLIC_USDT_TOKEN_ADDRESS'),
    payTo: getEnv('NEXT_PUBLIC_DEPOSIT_ADDRESS'),
    maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
    extra: { name: 'USD₮0', version: '1' },
  };
}

/** Builds a base64 PAYMENT-REQUIRED challenge for a given resource, description, and Whizcredits price. */
export function buildPaymentChallenge(resourceUrl: string, description: string, whizcreditsCost: bigint) {
  const accept = getExpectedAccept(whizcreditsCost);
  const challenge = {
    x402Version: X402_VERSION,
    error: 'Payment required',
    resource: { url: resourceUrl, description, mimeType: 'application/json' },
    accepts: [accept],
  };
  const headerValue = Buffer.from(JSON.stringify(challenge)).toString('base64');
  return { headerValue, accept };
}

/** Builds the base64 PAYMENT-REQUIRED challenge for the alert-submission endpoint. */
export function buildReportPaymentChallenge(resourceUrl: string) {
  return buildPaymentChallenge(resourceUrl, 'Whizpr emergency alert submission', ALERT_COST_WHIZCREDITS);
}

/** Builds the base64 PAYMENT-REQUIRED challenge for the precise-location lookup endpoint. */
export function buildPreciseLocationPaymentChallenge(resourceUrl: string) {
  return buildPaymentChallenge(
    resourceUrl,
    'Whizpr precise incident location + AI triage lookup',
    PRECISE_LOCATION_COST_WHIZCREDITS,
  );
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

// OKX wraps every API response in an envelope — {code: 0, data: {...}} on
// success, {code: <nonzero>, msg | error_message: "..."} on a business-level
// error (separate from HTTP status, which is 200 either way). Some
// deployments (e.g. a mock facilitator) skip the envelope and return the
// payload directly, so fall back to the raw body when `code`/`data` aren't
// present. Confirmed against OKX's own Go SDK (unwrapEnvelope in
// go/x402/http/okx_facilitator_client.go, github.com/okx/payments).
function unwrapOkxEnvelope(json: unknown): SettleResult {
  const envelope = json as { code?: number; msg?: string; error_message?: string; data?: unknown };
  if (typeof envelope?.code === 'number') {
    if (envelope.code !== 0) {
      return {
        success: false,
        errorReason: 'facilitator_error',
        errorMessage: envelope.msg || envelope.error_message || `OKX API error (code=${envelope.code})`,
      };
    }
    if (envelope.data && typeof envelope.data === 'object') {
      return envelope.data as SettleResult;
    }
  }
  return json as SettleResult;
}

/**
 * Submits a verified payment authorization to OKX's x402 facilitator for
 * settlement. A `success: true` response means the facilitator accepted the
 * authorization — `status` may still be "pending" rather than fully
 * on-chain-confirmed (poll /settle/status for the final outcome; not
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
    // Wait for the facilitator's on-chain submission before responding
    // (its default) rather than fire-and-forget in the background.
    syncSettle: true,
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
  return unwrapOkxEnvelope(json);
}

export function encodePaymentResponse(result: SettleResult): string {
  return Buffer.from(JSON.stringify(result)).toString('base64');
}
