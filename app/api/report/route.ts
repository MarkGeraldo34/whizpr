import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { debitForUsage } from '@/lib/ledger';

// Cost per emergency alert, denominated in the smallest WOKB unit tracked
// by the ledger. Adjust to your actual pricing model.
const ALERT_COST = 1_000_000_000_000_000n; // 0.001 WOKB (18 decimals)

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

  const debit = await debitForUsage(session.address, ALERT_COST, 'emergency alert submission');
  if (!debit.ok) {
    return NextResponse.json(
      { error: 'Insufficient prepaid balance. Deposit WOKB before submitting an alert.' },
      { status: 402 },
    );
  }

  // TODO: persist `media` to durable storage (e.g. Vercel Blob) and fan the
  // alert out to nearby responders. This scaffold stops at ledger debit +
  // acknowledgement so the payment/auth path can be tested end-to-end first.

  return NextResponse.json({
    ok: true,
    remainingBalance: debit.balance.toString(),
    alert: {
      lat: String(lat),
      lng: String(lng),
      description: description ? String(description) : null,
      mediaName: media.name,
      mediaSize: media.size,
    },
  });
}
