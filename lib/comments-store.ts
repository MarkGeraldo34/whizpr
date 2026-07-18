import { sql } from './db';

/**
 * Comments on emergency reports — lets users discuss/corroborate/ask
 * follow-up questions on a report. Backed by Postgres (see lib/db.ts); the
 * table is created on first use, so there's no separate migration step.
 *
 * Unlike reports, comment authorship is intentionally visible (as a wallet
 * address) — the point of a comment thread is knowing who said what.
 */

export interface Comment {
  id: string;
  reportId: string;
  commenterAddress: string;
  body: string;
  createdAt: number;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        commenter_address TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

export async function addComment(reportId: string, commenterAddress: string, body: string): Promise<Comment> {
  await ensureSchema();
  const comment: Comment = {
    id: crypto.randomUUID(),
    reportId,
    commenterAddress: commenterAddress.toLowerCase(),
    body,
    createdAt: Date.now(),
  };
  await sql`
    INSERT INTO comments (id, report_id, commenter_address, body, created_at)
    VALUES (${comment.id}, ${comment.reportId}, ${comment.commenterAddress}, ${comment.body}, ${comment.createdAt})
  `;
  return comment;
}

export async function getCommentsForReport(reportId: string): Promise<Comment[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, report_id, commenter_address, body, created_at
    FROM comments
    WHERE report_id = ${reportId}
    ORDER BY created_at ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    commenterAddress: row.commenter_address,
    body: row.body,
    createdAt: Number(row.created_at),
  }));
}
