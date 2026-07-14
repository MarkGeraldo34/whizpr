import { NextResponse } from 'next/server';
import { getCountryLeaderboard, getTotalReportCount } from '@/lib/reports-store';

// Public read — country-level report counts carry no reporter identity, so
// this doesn't need the SIWE session gate the rest of the API uses.
export async function GET() {
  return NextResponse.json({
    total: getTotalReportCount(),
    countries: getCountryLeaderboard(),
  });
}
