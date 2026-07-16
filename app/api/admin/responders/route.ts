import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { isAdminAddress } from '@/lib/admin';
import { addResponder, listResponders } from '@/lib/responders-store';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session || !isAdminAddress(session.address)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  return NextResponse.json({ responders: listResponders() });
}

/**
 * body: { email: string, countryCode: string, countryName: string }
 *   — registers a first-responder contact for a country. Every future
 *     report whose reverse-geocoded country matches will trigger a
 *     notification email to this address.
 */
export async function POST(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session || !isAdminAddress(session.address)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { email, countryCode, countryName } = body;

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (typeof countryCode !== 'string' || countryCode.trim().length !== 2) {
    return NextResponse.json({ error: 'countryCode must be a 2-letter ISO country code' }, { status: 400 });
  }
  if (typeof countryName !== 'string' || !countryName.trim()) {
    return NextResponse.json({ error: 'countryName is required' }, { status: 400 });
  }

  const responder = addResponder(email, countryCode, countryName);
  return NextResponse.json({ ok: true, responder });
}
