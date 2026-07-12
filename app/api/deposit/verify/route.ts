import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { verifyWokbDeposit } from '@/lib/viem-server';
import { creditDeposit, hasProcessedDeposit, markDepositProcessed } from '@/lib/ledger';

export async function POST(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { txHash } = await req.json();
  if (!txHash) {
    return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
  }

  if (hasProcessedDeposit(txHash)) {
    return NextResponse.json({ error: 'Deposit already processed' }, { status: 409 });
  }

  const result = await verifyWokbDeposit(txHash);

  if (!result.verified || !result.amount || !result.from) {
    return NextResponse.json(result, { status: 202 }); // not yet finalized / invalid
  }

  if (result.from.toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json(
      { error: 'Deposit sender does not match authenticated wallet' },
      { status: 403 },
    );
  }

  markDepositProcessed(txHash);
  const newBalance = await creditDeposit(session.address, result.amount);

  return NextResponse.json({
    verified: true,
    credited: result.amount.toString(),
    balance: newBalance.toString(),
  });
}
