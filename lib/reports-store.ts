import { sql } from './db';

/**
 * Server-side emergency report log, used to power the public live feed,
 * the country leaderboard, and the content-moderation review queue.
 *
 * Backed by Postgres (see lib/db.ts) — the table is created on first use, so
 * there's no separate migration step to run.
 */

// Reports are auto-published (no admin approval needed before appearing on
// the feed) — 'unreviewed' and 'approved' both show publicly. 'removed'
// means an admin deleted an irrelevant/inappropriate submission; it's
// excluded from the feed and leaderboard but the record is kept for audit.
export type ModerationStatus = 'unreviewed' | 'approved' | 'removed';

export interface StoredReportMedia {
  url: string;
  pathname: string;
  contentType: string;
}

export interface StoredReportAiTriage {
  legitimate: boolean;
  severity: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface StoredReport {
  id: string;
  reporterAddress: string;
  lat: number;
  lng: number;
  countryCode: string | null;
  countryName: string | null;
  casualties: number;
  description: string | null;
  media: StoredReportMedia;
  moderationStatus: ModerationStatus;
  createdAt: number;
  // Null means triage didn't run (video submission, missing API key, or a
  // provider error) — treat as "unknown", not "illegitimate". Surfaced to
  // admins via /api/moderation/reports so they can prioritize their review
  // queue; never used to auto-remove or auto-ban.
  aiTriage: StoredReportAiTriage | null;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        reporter_address TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        country_code TEXT,
        country_name TEXT,
        casualties INTEGER NOT NULL,
        description TEXT,
        media_url TEXT NOT NULL,
        media_pathname TEXT NOT NULL,
        media_content_type TEXT NOT NULL,
        moderation_status TEXT NOT NULL DEFAULT 'unreviewed',
        created_at BIGINT NOT NULL,
        ai_triage JSONB
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToReport(row: any): StoredReport {
  return {
    id: row.id,
    reporterAddress: row.reporter_address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    countryCode: row.country_code,
    countryName: row.country_name,
    casualties: Number(row.casualties),
    description: row.description,
    media: { url: row.media_url, pathname: row.media_pathname, contentType: row.media_content_type },
    moderationStatus: row.moderation_status,
    createdAt: Number(row.created_at),
    aiTriage: row.ai_triage ?? null,
  };
}

export async function recordReport(report: StoredReport): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO reports (
      id, reporter_address, lat, lng, country_code, country_name, casualties,
      description, media_url, media_pathname, media_content_type,
      moderation_status, created_at, ai_triage
    ) VALUES (
      ${report.id}, ${report.reporterAddress}, ${report.lat}, ${report.lng},
      ${report.countryCode}, ${report.countryName}, ${report.casualties},
      ${report.description}, ${report.media.url}, ${report.media.pathname},
      ${report.media.contentType}, ${report.moderationStatus}, ${report.createdAt},
      ${report.aiTriage ? JSON.stringify(report.aiTriage) : null}
    )
  `;
}

export async function getReportById(id: string): Promise<StoredReport | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM reports WHERE id = ${id}`;
  return rows[0] ? rowToReport(rows[0]) : null;
}

export async function setModerationStatus(id: string, status: ModerationStatus): Promise<StoredReport | null> {
  await ensureSchema();
  const rows = await sql`
    UPDATE reports SET moderation_status = ${status} WHERE id = ${id} RETURNING *
  `;
  return rows[0] ? rowToReport(rows[0]) : null;
}

export async function getReportsForModeration(status?: ModerationStatus): Promise<StoredReport[]> {
  await ensureSchema();
  const rows = status
    ? await sql`SELECT * FROM reports WHERE moderation_status = ${status} ORDER BY created_at DESC`
    : await sql`SELECT * FROM reports ORDER BY created_at DESC`;
  return rows.map(rowToReport);
}

export interface PublicFeedEntry {
  id: string;
  description: string | null;
  countryName: string | null;
  casualties: number;
  createdAt: number;
}

// Public-safe view of the feed: no reporter address, no media (media stays
// private — it can capture victims, bystanders, or crime scenes who never
// consented to being filmed publicly). Auto-published, so this includes
// everything except reports an admin has removed.
export async function getPublicFeed(limit = 50): Promise<PublicFeedEntry[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, description, country_name, casualties, created_at
    FROM reports
    WHERE moderation_status != 'removed'
    ORDER BY created_at DESC
    LIMIT ${limit}::int
  `;
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    countryName: row.country_name,
    casualties: Number(row.casualties),
    createdAt: Number(row.created_at),
  }));
}

export interface CountryTally {
  countryCode: string;
  countryName: string;
  count: number;
}

export async function getCountryLeaderboard(): Promise<CountryTally[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT
      COALESCE(country_code, 'UNKNOWN') AS country_code,
      COALESCE(MAX(country_name), 'Unknown location') AS country_name,
      COUNT(*)::int AS count
    FROM reports
    WHERE moderation_status != 'removed'
    GROUP BY COALESCE(country_code, 'UNKNOWN')
    ORDER BY count DESC
  `;
  return rows.map((row) => ({
    countryCode: row.country_code,
    countryName: row.country_name,
    count: Number(row.count),
  }));
}

export async function getTotalReportCount(): Promise<number> {
  await ensureSchema();
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM reports WHERE moderation_status != 'removed'
  `;
  return Number(rows[0].count);
}
