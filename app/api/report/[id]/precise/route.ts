import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import {
  debitForUsage,
  creditDeposit,
  hasProcessedX402Payment,
  markX402PaymentProcessed,
} from '@/lib/ledger';
import { getReportById } from '@/lib/reports-store';
import { PRECISE_LOCATION_COST_WHIZCREDITS } from '@/lib/pricing';
import { getBan } from '@/lib/moderation-store';
import {
  buildPreciseLocationPaymentChallenge,
  decodePaymentSignature,
  validatePayment,
  settleX402Payment,
  encodePaymentResponse,
  type DecodedPaymentSignature,
  type X402Accept,
  type SettleResult,
} from '@/lib/x402';

/**
 * Paid, read-only, GET-based lookup: exact coordinates + full AI-triage
 * detail for one existing report, which the free public feed (GET
 * /api/feed) deliberately omits (country-level location only, no triage
 * detail). Priced far below an alert submission — this is a data lookup,
 * not a write. Same dual auth as POST /api/report: a logged-in session
 * spends from the prepaid Whizcredits ledger, or — with no session — a
 * one-shot OKX Agent Payments Protocol (x402) payment, no sign-up needed.
 *
 * Deliberately does NOT expose reporterAddress — Whizpr's reporter-anonymity
 * guarantee (see README "Live feed") applies here too; this endpoint adds
 * precision and triage detail, not reporter identity.
 */

export const dynamic = 'force-dynamic';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...init?.headers, 'Cache-Control': 'no-store' },
  });
}

function payment402(resourceUrl: string) {
  const { headerValue } = buildPreciseLocationPaymentChallenge(resourceUrl);
  return new NextResponse(JSON.stringify({ error: 'Payment required' }), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'PAYMENT-REQUIRED': headerValue,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);

  let payerAddress: `0x${string}`;
  let decodedPayment: DecodedPaymentSignature | null = null;
  let expectedAccept: X402Accept | null = null;

  if (session) {
    payerAddress = session.address;
  } else {
    const paymentHeader = req.headers.get('PAYMENT-SIGNATURE');
    if (!paymentHeader) return payment402(req.url);

    decodedPayment = decodePaymentSignature(paymentHeader);
    expectedAccept = buildPreciseLocationPaymentChallenge(req.url).accept;
    if (!decodedPayment) return payment402(req.url);

    const validation = validatePayment(decodedPayment, expectedAccept);
    if (!validation.ok) return payment402(req.url);

    payerAddress = decodedPayment.payload.authorization.from as `0x${string}`;
  }

  const ban = await getBan(payerAddress);
  if (ban) {
    return jsonNoStore({ error: 'Your account has been banned for violating Whizpr’s content policy.' }, { status: 403 });
  }

  // Check the resource actually exists before ever settling a payment for
  // it — unlike POST /api/report, a bad id here is out of the caller's
  // control (a typo, a removed report), so it shouldn't cost them anything.
  const report = await getReportById(params.id);
  if (!report || report.moderationStatus === 'removed') {
    return jsonNoStore({ error: 'Report not found' }, { status: 404 });
  }

  let x402Settlement: SettleResult | null = null;
  if (decodedPayment && expectedAccept) {
    const nonce = decodedPayment.payload.authorization.nonce;
    if (await hasProcessedX402Payment(nonce)) {
      return jsonNoStore({ error: 'Payment already used' }, { status: 409 });
    }

    x402Settlement = await settleX402Payment(decodedPayment, expectedAccept);
    if (!x402Settlement.success) {
      return jsonNoStore(
        { error: x402Settlement.errorMessage ?? 'Payment could not be settled' },
        { status: 402, headers: { 'PAYMENT-RESPONSE': encodePaymentResponse(x402Settlement) } },
      );
    }
    await markX402PaymentProcessed(nonce);

    // Same pattern as POST /api/report: convert the settled on-chain payment
    // into a Whizcredits credit, then spend it via the same debit path a
    // session user goes through below.
    await creditDeposit(payerAddress, PRECISE_LOCATION_COST_WHIZCREDITS, 'x402 payment settled via OKX facilitator');
  }

  const debit = await debitForUsage(payerAddress, PRECISE_LOCATION_COST_WHIZCREDITS, 'precise-location lookup');
  if (!debit.ok) {
    return jsonNoStore(
      { error: 'Insufficient Whizcredits. Deposit USDT to top up before requesting precise location.' },
      { status: 402 },
    );
  }

  return jsonNoStore(
    {
      id: report.id,
      lat: report.lat,
      lng: report.lng,
      countryCode: report.countryCode,
      countryName: report.countryName,
      casualties: report.casualties,
      description: report.description,
      aiTriage: report.aiTriage,
      createdAt: report.createdAt,
      remainingWhizcredits: debit.balance.toString(),
    },
    x402Settlement ? { headers: { 'PAYMENT-RESPONSE': encodePaymentResponse(x402Settlement) } } : undefined,
  );
}
