import { sql } from './db';

/**
 * Server-side registry of first-responder email contacts, keyed by the
 * country they cover. Used to fan out a notification email whenever a new
 * emergency report comes in for that country.
 *
 * Backed by Postgres (see lib/db.ts); the table is created on first use, so
 * there's no separate migration step to run. Managed via
 * /api/admin/responders (admin-only, same ADMIN_ADDRESSES gate as
 * moderation).
 */

export interface ResponderContact {
  id: string;
  email: string;
  countryCode: string;
  countryName: string;
  createdAt: number;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS responders (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        country_code TEXT NOT NULL,
        country_name TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToResponder(row: any): ResponderContact {
  return {
    id: row.id,
    email: row.email,
    countryCode: row.country_code,
    countryName: row.country_name,
    createdAt: Number(row.created_at),
  };
}

export async function addResponder(email: string, countryCode: string, countryName: string): Promise<ResponderContact> {
  await ensureSchema();
  const record: ResponderContact = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    countryCode: countryCode.trim().toUpperCase(),
    countryName: countryName.trim(),
    createdAt: Date.now(),
  };
  await sql`
    INSERT INTO responders (id, email, country_code, country_name, created_at)
    VALUES (${record.id}, ${record.email}, ${record.countryCode}, ${record.countryName}, ${record.createdAt})
  `;
  return record;
}

export async function removeResponder(id: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`DELETE FROM responders WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function listResponders(): Promise<ResponderContact[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM responders ORDER BY created_at DESC`;
  return rows.map(rowToResponder);
}

export async function getRespondersForCountry(countryCode: string | null): Promise<ResponderContact[]> {
  if (!countryCode) return [];
  await ensureSchema();
  const normalized = countryCode.trim().toUpperCase();
  const rows = await sql`SELECT * FROM responders WHERE country_code = ${normalized}`;
  return rows.map(rowToResponder);
}
