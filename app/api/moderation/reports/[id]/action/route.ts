import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { isAdminAddress } from '@/lib/admin';
import { getReportById, setModerationStatus } from '@/lib/reports-store';
import { banAddress } from '@/lib/moderation-store';
import { penalizeCredits } from '@/lib/ledger';

/**
 * Admin-only moderation action on a single report. Reports are auto-
 * published (no approval needed), so this endpoint only ever removes a
 * report after the fact and/or penalizes its submitter — it never blocks a
 * submission from going out.
 *
 * body: { action: 'approve' }
 *   — marks the report as reviewed and compliant; stays on the public feed.
 *
 * body: { action: 'delete' }
 *   — removes an irrelevant/inappropriate report from the public feed and
 *     leaderboard. No penalty by itself (e.g. an honest mistake).
 *
 * body: { action: 'delete', penalty: 'ban' }
 *   — deletes the report AND bans the reporter's wallet address from
 *     submitting further reports.
 *
 * body: { action: 'delete', penalty: 'credits', creditsToDeduct: number }
 *   — deletes the report AND force-deducts Whizcredits from the reporter.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session || !isAdminAddress(session.address)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const report = getReportById(params.id);
  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const body = await req.json();
  const action = body.action;

  if (action === 'approve') {
    const updated = setModerationStatus(report.id, 'approved');
    return NextResponse.json({ ok: true, report: updated });
  }

  if (action === 'delete') {
    const penalty = body.penalty;

    if (penalty === 'ban') {
      banAddress(report.reporterAddress, `Content policy violation on report ${report.id}`);
    } else if (penalty === 'credits') {
      const requested = Number(body.creditsToDeduct);
      if (!Number.isFinite(requested) || requested <= 0) {
        return NextResponse.json(
          { error: 'creditsToDeduct must be a positive number when penalty is "credits"' },
          { status: 400 },
        );
      }
      const amount = BigInt(Math.floor(requested));
      await penalizeCredits(
        report.reporterAddress as `0x${string}`,
        amount,
        `Moderation penalty: content policy violation on report ${report.id}`,
      );
    } else if (penalty !== undefined) {
      return NextResponse.json(
        { error: 'penalty, if provided, must be "ban" or "credits"' },
        { status: 400 },
      );
    }

    const updated = setModerationStatus(report.id, 'removed');
    return NextResponse.json({ ok: true, report: updated });
  }

  return NextResponse.json({ error: 'action must be "approve" or "delete"' }, { status: 400 });
}
