import { sql } from './db';

/**
 * Server-side ban list for accounts that violate Whizpr's content policy —
 * submitting unrelated or inappropriate media (nudity, selfies, unrelated
 * vlogs) instead of genuine hazard/emergency footage. Populated by admins
 * via /api/moderation/reports/[id]/action after reviewing a report.
 *
 * Backed by Postgres (see lib/db.ts); the table is created on first use, so
 * there's no separate migration step to run.
 */

export interface BanRecord {
  address: string;
  reason: string;
  bannedAt: number;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS bans (
        address TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        banned_at BIGINT NOT NULL
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

export async function isBanned(address: string): Promise<boolean> {
  return (await getBan(address)) !== null;
}

export async function getBan(address: string): Promise<BanRecord | null> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM bans WHERE address = ${address.toLowerCase()}`;
  const row = rows[0];
  if (!row) return null;
  return { address: row.address, reason: row.reason, bannedAt: Number(row.banned_at) };
}

export async function banAddress(address: string, reason: string): Promise<BanRecord> {
  await ensureSchema();
  const record: BanRecord = { address: address.toLowerCase(), reason, bannedAt: Date.now() };
  await sql`
    INSERT INTO bans (address, reason, banned_at) VALUES (${record.address}, ${record.reason}, ${record.bannedAt})
    ON CONFLICT (address) DO UPDATE SET reason = EXCLUDED.reason, banned_at = EXCLUDED.banned_at
  `;
  return record;
}

export async function unbanAddress(address: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM bans WHERE address = ${address.toLowerCase()}`;
}
