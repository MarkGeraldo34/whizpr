import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { isAdminAddress } from '@/lib/admin';
import { removeResponder } from '@/lib/responders-store';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session || !isAdminAddress(session.address)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const removed = await removeResponder(params.id);
  if (!removed) {
    return NextResponse.json({ error: 'Responder not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
