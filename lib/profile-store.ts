import { sql } from './db';

/**
 * Server-side username registry.
 *
 * Whizpr's only account creation step is signing in with a wallet (SIWE) —
 * there's no separate signup form. A user "registers" their account by
 * choosing a username here the first time they open the Profile tab.
 *
 * Backed by Postgres (see lib/db.ts); the table is created on first use, so
 * there's no separate migration step to run.
 */

export interface Profile {
  address: `0x${string}`;
  username: string;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS profiles (
        address TEXT PRIMARY KEY,
        display_address TEXT NOT NULL,
        username TEXT NOT NULL
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

export async function getProfile(address: `0x${string}`): Promise<Profile | null> {
  await ensureSchema();
  const rows = await sql`
    SELECT display_address, username FROM profiles WHERE address = ${address.toLowerCase()}
  `;
  const row = rows[0];
  return row ? { address: row.display_address as `0x${string}`, username: row.username } : null;
}

export async function isUsernameTaken(username: string, excludingAddress?: `0x${string}`): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`SELECT address FROM profiles WHERE LOWER(username) = LOWER(${username})`;
  const owner = rows[0]?.address as string | undefined;
  if (!owner) return false;
  if (excludingAddress && owner === excludingAddress.toLowerCase()) return false;
  return true;
}

export async function setUsername(address: `0x${string}`, username: string): Promise<Profile> {
  await ensureSchema();
  const addressKey = address.toLowerCase();
  await sql`
    INSERT INTO profiles (address, display_address, username)
    VALUES (${addressKey}, ${address}, ${username})
    ON CONFLICT (address) DO UPDATE SET display_address = EXCLUDED.display_address, username = EXCLUDED.username
  `;
  return { address, username };
}
