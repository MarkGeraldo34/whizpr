import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { verifyUsdtDeposit } from '@/lib/viem-server';
import { creditDeposit, hasProcessedDeposit, markDepositProcessed } from '@/lib/ledger';
import { usdtToWhizcredits } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { txHash } = await req.json();
  if (!txHash) {
    return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
  }

  if (await hasProcessedDeposit(txHash)) {
    return NextResponse.json({ error: 'Deposit already processed' }, { status: 409 });
  }

  const result = await verifyUsdtDeposit(txHash);

  if (!result.verified || !result.amount || !result.from) {
    return NextResponse.json(result, { status: 202 }); // not yet finalized / invalid
  }

  if (result.from.toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json(
      { error: 'Deposit sender does not match authenticated wallet' },
      { status: 403 },
    );
  }

  const creditedWhizcredits = usdtToWhizcredits(result.amount);

  await markDepositProcessed(txHash);
  const newBalance = await creditDeposit(session.address, creditedWhizcredits);

  return NextResponse.json({
    verified: true,
    usdtAmount: result.amount.toString(),
    creditedWhizcredits: creditedWhizcredits.toString(),
    balance: newBalance.toString(),
  });
}
