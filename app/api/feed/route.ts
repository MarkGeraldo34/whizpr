import { NextResponse } from 'next/server';
import { getPublicFeed } from '@/lib/reports-store';

// Public read — reports are auto-published (no admin approval needed), and
// this view carries no reporter identity or media, so it doesn't need the
// SIWE session gate the rest of the API uses.
export async function GET() {
  return NextResponse.json({ reports: getPublicFeed() });
}
