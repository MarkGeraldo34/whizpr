import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import {
  debitForUsage,
  creditDeposit,
  hasProcessedX402Payment,
  markX402PaymentProcessed,
} from '@/lib/ledger';
import { storeEmergencyMedia } from '@/lib/media-storage';
import { reverseGeocodeCountry } from '@/lib/geocode';
import { recordReport, type StoredReport } from '@/lib/reports-store';
import { ALERT_COST_WHIZCREDITS } from '@/lib/pricing';
import { getBan } from '@/lib/moderation-store';
import { MAX_VIDEO_SECONDS } from '@/lib/content-policy';
import { getRespondersForCountry } from '@/lib/responders-store';
import { notifyResponders } from '@/lib/email';
import { triageReport } from '@/lib/triage';
import {
  buildReportPaymentChallenge,
  decodePaymentSignature,
  validatePayment,
  settleX402Payment,
  encodePaymentResponse,
  type DecodedPaymentSignature,
  type X402Accept,
  type SettleResult,
} from '@/lib/x402';

// Whizpr is for genuine hazard/emergency evidence only — reject arbitrary
// file types outright. This is a basic technical guardrail; the actual
// "is this really a hazard, not nudity/a selfie/an unrelated vlog" judgment
// happens in the human moderation review (see /api/moderation/reports).
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

// Deployed on Vercel, not behind an nginx/Cloudflare reverse proxy — `force-
// dynamic` plus an explicit `Cache-Control: no-store` on every response
// (below) is the platform-native equivalent of "bypass cache for requests
// carrying PAYMENT-SIGNATURE": it stops Vercel's CDN from ever storing a
// response for this route, paid or unpaid, rather than trying to key the
// bypass off one specific header.
export const dynamic = 'force-dynamic';

// Every response from this endpoint — challenge, error, or success — must
// never be cached: caching a paid response would let a later, unpaid
// requester replay it for free, and caching a 402 challenge risks serving a
// stale/expired one. Wraps NextResponse.json to apply this uniformly instead
// of repeating the header at every call site.
function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...init?.headers, 'Cache-Control': 'no-store' },
  });
}

function payment402(req: NextRequest) {
  const { headerValue } = buildReportPaymentChallenge(req.url);
  return new NextResponse(JSON.stringify({ error: 'Payment required' }), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'PAYMENT-REQUIRED': headerValue,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);

  // Two ways to be authorized to submit an alert: a logged-in session
  // spending from the prepaid Whizcredits ledger (below), or — with no
  // session at all — a one-shot payment via the OKX Agent Payments Protocol
  // (x402), letting an AI agent pay per-alert directly with no sign-up.
  let payerAddress: `0x${string}`;
  let decodedPayment: DecodedPaymentSignature | null = null;
  let expectedAccept: X402Accept | null = null;

  if (session) {
    payerAddress = session.address;
  } else {
    const paymentHeader = req.headers.get('PAYMENT-SIGNATURE');
    if (!paymentHeader) return payment402(req);

    decodedPayment = decodePaymentSignature(paymentHeader);
    expectedAccept = buildReportPaymentChallenge(req.url).accept;
    if (!decodedPayment) return payment402(req);

    const validation = validatePayment(decodedPayment, expectedAccept);
    if (!validation.ok) return payment402(req);

    payerAddress = decodedPayment.payload.authorization.from as `0x${string}`;
  }

  const ban = await getBan(payerAddress);
  if (ban) {
    return jsonNoStore(
      {
        error:
          'Your account has been banned for violating Whizpr’s content policy (submitting unrelated or ' +
          `inappropriate media instead of genuine hazard footage).${ban ? ` Reason: ${ban.reason}` : ''}`,
      },
      { status: 403 },
    );
  }

  let x402Settlement: SettleResult | null = null;
  if (decodedPayment && expectedAccept) {
    // Not banned — safe to actually settle the on-chain payment now.
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

    // Converts the settled on-chain payment into the same prepaid-ledger
    // credit a deposit would produce, then immediately spends it below — so
    // the ban check above and every debit/refund/response path below is
    // shared between session users and one-shot x402 payers unchanged.
    await creditDeposit(payerAddress, ALERT_COST_WHIZCREDITS, 'x402 payment settled via OKX facilitator');
  }

  const formData = await req.formData();
  const media = formData.get('media');
  const lat = formData.get('lat');
  const lng = formData.get('lng');
  const description = formData.get('description');
  const casualtiesRaw = formData.get('casualties');
  const clientVideoDurationRaw = formData.get('videoDurationSeconds');

  if (!media || !(media instanceof File)) {
    return jsonNoStore({ error: 'Emergency media file is required' }, { status: 400 });
  }
  if (!ALLOWED_MEDIA_TYPES.has(media.type)) {
    return jsonNoStore(
      { error: 'Only photo or video files of a genuine hazard/emergency are accepted.' },
      { status: 400 },
    );
  }
  if (media.type.startsWith('video/') && clientVideoDurationRaw) {
    const clientVideoDuration = Number(clientVideoDurationRaw);
    if (Number.isFinite(clientVideoDuration) && clientVideoDuration > MAX_VIDEO_SECONDS) {
      return jsonNoStore({ error: `Videos must be ${MAX_VIDEO_SECONDS} seconds or shorter.` }, { status: 400 });
    }
  }
  if (!lat || !lng) {
    return jsonNoStore({ error: 'Location (lat/lng) is required' }, { status: 400 });
  }
  const casualties = casualtiesRaw === null ? 0 : Number(casualtiesRaw);
  if (!Number.isInteger(casualties) || casualties < 0) {
    return jsonNoStore({ error: 'Number of people affected must be a non-negative integer' }, { status: 400 });
  }

  // Debit before storing: an alert the user can't pay for shouldn't consume
  // Blob storage or reach responders in the first place.
  const debit = await debitForUsage(payerAddress, ALERT_COST_WHIZCREDITS, 'emergency alert submission');
  if (!debit.ok) {
    return jsonNoStore(
      { error: 'Insufficient Whizcredits. Deposit USDT to top up before submitting an alert.' },
      { status: 402 },
    );
  }

  // Everything below spends the debit that already succeeded above — a
  // failure anywhere in here (media storage, or the DB write that actually
  // records the report) must refund, or the user is charged for a
  // submission that never went anywhere.
  let stored;
  let report: StoredReport;
  try {
    stored = await storeEmergencyMedia(media);

    const latNum = Number(lat);
    const lngNum = Number(lng);
    const descriptionStr = description ? String(description) : null;
    const { countryCode, countryName } = await reverseGeocodeCountry(latNum, lngNum);
    const aiTriage = await triageReport(media, descriptionStr);

    report = {
      id: crypto.randomUUID(),
      reporterAddress: payerAddress,
      lat: latNum,
      lng: lngNum,
      countryCode,
      countryName,
      casualties,
      description: descriptionStr,
      media: { url: stored.url, pathname: stored.pathname, contentType: stored.contentType },
      moderationStatus: 'unreviewed',
      createdAt: Date.now(),
      aiTriage,
    };
    await recordReport(report);
  } catch (err) {
    // The user has already been debited for a submission that can't be
    // completed — refund immediately rather than silently eating the cost.
    await creditDeposit(payerAddress, ALERT_COST_WHIZCREDITS, 'refund: report submission failed').catch(() => {
      // Best-effort refund; if this also fails it needs manual reconciliation.
    });
    return jsonNoStore(
      { error: err instanceof Error ? err.message : 'Failed to record emergency report' },
      { status: 502 },
    );
  }

  const { countryCode, countryName, aiTriage } = report;

  // Best-effort: notify first responders registered for this country by
  // email. The report is already paid for and stored — an email failure
  // (missing API key, provider outage, no responders on file for this
  // country yet) should never undo or block the submission. Skipped only
  // when AI triage is confident this isn't a real hazard (aiTriage === null
  // means triage didn't run — video, no API key, provider error — so we
  // still notify, same as before triage existed).
  if (aiTriage === null || aiTriage.legitimate) {
    const responderEmails = (await getRespondersForCountry(countryCode)).map((r) => r.email);
    notifyResponders(report, responderEmails).catch((err) => {
      console.error('notifyResponders failed', err);
    });
  }

  return jsonNoStore(
    {
      ok: true,
      remainingWhizcredits: debit.balance.toString(),
      alert: {
        lat: String(lat),
        lng: String(lng),
        country: countryName,
        casualties,
        description: description ? String(description) : null,
        media: {
          pathname: stored.pathname,
          contentType: stored.contentType,
          size: stored.size,
        },
      },
    },
    x402Settlement ? { headers: { 'PAYMENT-RESPONSE': encodePaymentResponse(x402Settlement) } } : undefined,
  );
}
