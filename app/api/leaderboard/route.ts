import { NextResponse } from 'next/server';
import { getCountryLeaderboard, getTotalReportCount } from '@/lib/reports-store';

// Public read — country-level report counts carry no reporter identity, so
// this doesn't need the SIWE session gate the rest of the API uses.
//
// Force dynamic: this route has no cookies()/headers() call, so Next.js
// would otherwise treat it as eligible for static generation and try to
// execute (and cache) it once at build time — which fails without a
// database available at build time, and would be wrong anyway since this is
// live data that must be re-fetched on every request.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    total: await getTotalReportCount(),
    countries: await getCountryLeaderboard(),
  });
}
