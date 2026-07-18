import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { isAdminAddress } from '@/lib/admin';
import { getReportById, updateReport, setModerationStatus } from '@/lib/reports-store';

/**
 * Reporter self-service on their own report — distinct from the admin
 * moderation endpoint (/api/moderation/reports/[id]/action), which stays
 * the place for admin delete + optional penalty (ban/credit deduction).
 *
 * PATCH: reporter only, edits description/casualties.
 * DELETE: reporter or admin, soft-deletes via the same 'removed' status the
 *   moderation endpoint uses — no penalty option here, since you can't
 *   penalize yourself and an admin wanting to penalize should use the
 *   dedicated moderation endpoint instead.
 */

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const report = await getReportById(params.id);
  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }
  if (report.reporterAddress.toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json({ error: 'You can only edit your own reports' }, { status: 403 });
  }

  const body = await req.json();
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  const casualties = Number(body.casualties);
  if (!Number.isInteger(casualties) || casualties < 0) {
    return NextResponse.json(
      { error: 'Number of people affected must be a non-negative integer' },
      { status: 400 },
    );
  }

  const updated = await updateReport(report.id, { description, casualties });
  return NextResponse.json({ ok: true, report: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const report = await getReportById(params.id);
  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const isOwner = report.reporterAddress.toLowerCase() === session.address.toLowerCase();
  if (!isOwner && !isAdminAddress(session.address)) {
    return NextResponse.json({ error: 'You can only delete your own reports' }, { status: 403 });
  }

  const updated = await setModerationStatus(report.id, 'removed');
  return NextResponse.json({ ok: true, report: updated });
}
