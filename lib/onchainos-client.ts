import { createHmac } from 'crypto';

interface OnchainOsRequestOptions {
  method: 'GET' | 'POST';
  path: string; // e.g. '/api/v1/wallet/balance'
  body?: Record<string, unknown>;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

/**
 * Signs and sends a request to OKX's OnchainOS Wallet API.
 *
 * OnchainOS uses the same signing scheme as OKX's exchange APIs:
 * base64(HMAC_SHA256(timestamp + method + requestPath + body, secret))
 * sent alongside the API key and passphrase in headers.
 */
export async function callOnchainOs<T = unknown>({
  method,
  path,
  body,
}: OnchainOsRequestOptions): Promise<T> {
  const baseUrl = getEnv('OKX_ONCHAINOS_API_BASE_URL');
  const apiKey = getEnv('OKX_ONCHAINOS_API_KEY');
  const apiSecret = getEnv('OKX_ONCHAINOS_API_SECRET');
  const passphrase = process.env.OKX_ONCHAINOS_API_PASSPHRASE ?? '';

  const timestamp = new Date().toISOString();
  const bodyString = body ? JSON.stringify(body) : '';
  const prehash = `${timestamp}${method}${path}${bodyString}`;
  const signature = createHmac('sha256', apiSecret).update(prehash).digest('base64');

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
    },
    body: bodyString || undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OnchainOS API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * OnchainOS has shipped both of these path shapes at different times, so we
 * try /balance first, then fall back to /balances for a given address.
 * This is the "test both token balance endpoint paths" step flagged for
 * this project.
 */
export async function getWalletBalance(address: string) {
  try {
    return await callOnchainOs({
      method: 'GET',
      path: `/api/v1/wallet/balance?address=${address}`,
    });
  } catch (err) {
    return await callOnchainOs({
      method: 'GET',
      path: `/api/v1/wallet/balances?address=${address}`,
    });
  }
}
