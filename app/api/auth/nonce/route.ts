import { NextResponse } from 'next/server';
import { createNonce } from '@/lib/siwe-session';

export async function GET() {
  const nonce = createNonce();
  const res = NextResponse.json({ nonce });
  // Short-lived cookie so /verify can check the nonce matches what we issued.
  res.cookies.set('whizpr_nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/',
  });
  return res;
}
