import { NextRequest, NextResponse } from 'next/server';
import { getPublicFeed } from '@/lib/reports-store';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { isAdminAddress } from '@/lib/admin';

// Public read — reports are auto-published (no admin approval needed), and
// this view carries no reporter identity or media, so it doesn't require
// being signed in. The session cookie is read only if present (to compute
// each report's canEdit/canDelete for the current viewer) — an anonymous
// visitor still sees the full feed, just with both always false.
//
// Force dynamic: Next.js would otherwise treat this as eligible for static
// generation and try to execute (and cache) it once at build time — which
// fails without a database available at build time, and would be wrong
// anyway since this is live data that must be re-fetched on every request.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  const isAdmin = session ? isAdminAddress(session.address) : false;

  const reports = await getPublicFeed(50, session?.address);
  return NextResponse.json({
    reports: reports.map((report) => ({ ...report, canDelete: report.canEdit || isAdmin })),
  });
}
