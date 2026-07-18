import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookieValue, sessionCookieName } from '@/lib/siwe-session';
import { getReportById } from '@/lib/reports-store';
import { addComment, getCommentsForReport } from '@/lib/comments-store';

const MAX_COMMENT_LENGTH = 1000;

// Public read — same spirit as the feed itself: anyone can read the
// discussion on a report without signing in.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await getCommentsForReport(params.id);
  return NextResponse.json({ comments });
}

// Posting requires a connected, signed-in wallet — consistent with every
// other write action in the app (report submission, deposits, profile).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = verifySessionCookieValue(req.cookies.get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const report = await getReportById(params.id);
  if (!report || report.moderationStatus === 'removed') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const body = await req.json();
  const trimmed = typeof body.body === 'string' ? body.body.trim() : '';
  if (!trimmed) {
    return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const comment = await addComment(report.id, session.address, trimmed);
  return NextResponse.json({ ok: true, comment });
}
