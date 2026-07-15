import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { getProfile, isUsernameTaken, setUsername } from '@/lib/profile-store';
import { getBalance } from '@/lib/ledger';
import { getBan } from '@/lib/moderation-store';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function GET(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const profile = getProfile(session.address);
  const balance = await getBalance(session.address);
  const ban = getBan(session.address);

  return NextResponse.json({
    address: session.address,
    username: profile?.username ?? null,
    whizcredits: balance.toString(),
    banned: !!ban,
    banReason: ban?.reason ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { username } = await req.json();
  const trimmed = String(username ?? '').trim();

  if (!USERNAME_PATTERN.test(trimmed)) {
    return NextResponse.json(
      { error: 'Username must be 3-20 characters: letters, numbers, and underscores only.' },
      { status: 400 },
    );
  }
  if (isUsernameTaken(trimmed, session.address)) {
    return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
  }

  const profile = setUsername(session.address, trimmed);
  const balance = await getBalance(session.address);
  const ban = getBan(session.address);

  return NextResponse.json({
    address: profile.address,
    username: profile.username,
    whizcredits: balance.toString(),
    banned: !!ban,
    banReason: ban?.reason ?? null,
  });
}
