import { NextRequest, NextResponse } from 'next/server';
import {
  verifySiweMessage,
  createSessionCookieValue,
  sessionCookieName,
  sessionMaxAge,
} from '@/lib/siwe-session';

export async function POST(req: NextRequest) {
  const { message, signature } = await req.json();
  const expectedNonce = req.cookies.get('whizpr_nonce')?.value;

  if (!expectedNonce) {
    return NextResponse.json({ error: 'Missing or expired nonce' }, { status: 400 });
  }

  try {
    const address = await verifySiweMessage(message, signature, expectedNonce);
    const res = NextResponse.json({ address });

    res.cookies.set(sessionCookieName, createSessionCookieValue(address), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: sessionMaxAge,
      path: '/',
    });
    res.cookies.delete('whizpr_nonce');

    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 401 },
    );
  }
}
