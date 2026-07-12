import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { getWalletBalance } from '@/lib/onchainos-client';

export async function GET(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const balance = await getWalletBalance(session.address);
    return NextResponse.json({ balance });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OnchainOS request failed' },
      { status: 502 },
    );
  }
}
