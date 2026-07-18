import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { debitForUsage, creditDeposit } from '@/lib/ledger';
import { storeEmergencyMedia } from '@/lib/media-storage';
import { reverseGeocodeCountry } from '@/lib/geocode';
import { recordReport, type StoredReport } from '@/lib/reports-store';
import { ALERT_COST_WHIZCREDITS } from '@/lib/pricing';
import { getBan } from '@/lib/moderation-store';
import { MAX_VIDEO_SECONDS } from '@/lib/content-policy';
import { getRespondersForCountry } from '@/lib/responders-store';
import { notifyResponders } from '@/lib/email';
import { triageReport } from '@/lib/triage';

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

export async function POST(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const ban = await getBan(session.address);
  if (ban) {
    return NextResponse.json(
      {
        error:
          'Your account has been banned for violating Whizpr’s content policy (submitting unrelated or ' +
          `inappropriate media instead of genuine hazard footage).${ban ? ` Reason: ${ban.reason}` : ''}`,
      },
      { status: 403 },
    );
  }

  const formData = await req.formData();
  const media = formData.get('media');
  const lat = formData.get('lat');
  const lng = formData.get('lng');
  const description = formData.get('description');
  const casualtiesRaw = formData.get('casualties');
  const clientVideoDurationRaw = formData.get('videoDurationSeconds');

  if (!media || !(media instanceof File)) {
    return NextResponse.json({ error: 'Emergency media file is required' }, { status: 400 });
  }
  if (!ALLOWED_MEDIA_TYPES.has(media.type)) {
    return NextResponse.json(
      { error: 'Only photo or video files of a genuine hazard/emergency are accepted.' },
      { status: 400 },
    );
  }
  if (media.type.startsWith('video/') && clientVideoDurationRaw) {
    const clientVideoDuration = Number(clientVideoDurationRaw);
    if (Number.isFinite(clientVideoDuration) && clientVideoDuration > MAX_VIDEO_SECONDS) {
      return NextResponse.json(
        { error: `Videos must be ${MAX_VIDEO_SECONDS} seconds or shorter.` },
        { status: 400 },
      );
    }
  }
  if (!lat || !lng) {
    return NextResponse.json({ error: 'Location (lat/lng) is required' }, { status: 400 });
  }
  const casualties = casualtiesRaw === null ? 0 : Number(casualtiesRaw);
  if (!Number.isInteger(casualties) || casualties < 0) {
    return NextResponse.json({ error: 'Number of people affected must be a non-negative integer' }, { status: 400 });
  }

  // Debit before storing: an alert the user can't pay for shouldn't consume
  // Blob storage or reach responders in the first place.
  const debit = await debitForUsage(session.address, ALERT_COST_WHIZCREDITS, 'emergency alert submission');
  if (!debit.ok) {
    return NextResponse.json(
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
      reporterAddress: session.address,
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
    await creditDeposit(session.address, ALERT_COST_WHIZCREDITS, 'refund: report submission failed').catch(() => {
      // Best-effort refund; if this also fails it needs manual reconciliation.
    });
    return NextResponse.json(
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

  return NextResponse.json({
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
  });
}
