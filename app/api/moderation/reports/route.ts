import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { isAdminAddress } from '@/lib/admin';
import { getReportsForModeration, type ModerationStatus } from '@/lib/reports-store';

const VALID_STATUSES = new Set<ModerationStatus>(['unreviewed', 'approved', 'removed']);

export async function GET(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session || !isAdminAddress(session.address)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const statusParam = req.nextUrl.searchParams.get('status');
  const status = statusParam && VALID_STATUSES.has(statusParam as ModerationStatus)
    ? (statusParam as ModerationStatus)
    : undefined;

  return NextResponse.json({ reports: await getReportsForModeration(status) });
}
