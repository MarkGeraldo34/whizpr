import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { debitForUsage, creditDeposit } from '@/lib/ledger';
import { storeEmergencyMedia } from '@/lib/media-storage';

// Cost per emergency alert, denominated in the smallest USDT unit tracked
// by the ledger. Adjust to your actual pricing model.
const ALERT_COST = 1_000_000_000_000_000n; // 0.001 USDT (18 decimals)

export async function POST(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await req.formData();
  const media = formData.get('media');
  const lat = formData.get('lat');
  const lng = formData.get('lng');
  const description = formData.get('description');

  if (!media || !(media instanceof File)) {
    return NextResponse.json({ error: 'Emergency media file is required' }, { status: 400 });
  }
  if (!lat || !lng) {
    return NextResponse.json({ error: 'Location (lat/lng) is required' }, { status: 400 });
  }

  // Debit before storing: an alert the user can't pay for shouldn't consume
  // Blob storage or reach responders in the first place.
  const debit = await debitForUsage(session.address, ALERT_COST, 'emergency alert submission');
  if (!debit.ok) {
    return NextResponse.json(
      { error: 'Insufficient prepaid balance. Deposit USDT before submitting an alert.' },
      { status: 402 },
    );
  }

  let stored;
  try {
    stored = await storeEmergencyMedia(media, session.address);
  } catch (err) {
    // The user has already been debited for a submission that can't be
    // completed — refund immediately rather than silently eating the cost.
    await creditDeposit(session.address, ALERT_COST, 'refund: media storage failed').catch(() => {
      // Best-effort refund; if this also fails it needs manual reconciliation.
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to store emergency media' },
      { status: 502 },
    );
  }

  // TODO: fan the alert out to nearby responders (geo-matching + delivery).
  // This scaffold now persists the media and debits the ledger, so the
  // payment/auth/storage path can be tested end-to-end; responder matching
  // is the next piece to build.

  return NextResponse.json({
    ok: true,
    remainingBalance: debit.balance.toString(),
    alert: {
      lat: String(lat),
      lng: String(lng),
      description: description ? String(description) : null,
      media: {
        pathname: stored.pathname,
        contentType: stored.contentType,
        size: stored.size,
      },
    },
  });
}
