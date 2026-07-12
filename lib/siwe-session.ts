import { SiweMessage, generateNonce } from 'siwe';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_COOKIE = 'whizpr_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return secret;
}

export function createNonce(): string {
  return generateNonce();
}

/**
 * "SIWE-lite" — we use the standard siwe library to build/parse the
 * EIP-4361 message and verify the signature, but skip the full session
 * management library in favor of a minimal signed cookie we control.
 */
export async function verifySiweMessage(message: string, signature: string, expectedNonce: string) {
  const siweMessage = new SiweMessage(message);
  const result = await siweMessage.verify({ signature, nonce: expectedNonce });

  if (!result.success) {
    throw new Error('SIWE signature verification failed');
  }

  return siweMessage.address as `0x${string}`;
}

interface SessionPayload {
  address: `0x${string}`;
  issuedAt: number;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createSessionCookieValue(address: `0x${string}`): string {
  const payload: SessionPayload = { address, issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionCookieValue(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload;
  const ageSeconds = (Date.now() - payload.issuedAt) / 1000;
  if (ageSeconds > SESSION_TTL_SECONDS) return null;

  return payload;
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionMaxAge = SESSION_TTL_SECONDS;
