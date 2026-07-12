import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { getBalance } from '@/lib/ledger';

export async function GET(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const balance = await getBalance(session.address);
  return NextResponse.json({ address: session.address, balance: balance.toString() });
}
