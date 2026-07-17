import { sql } from './db';

/**
 * Server-side prepaid Whizcredits ledger.
 *
 * Balances are tracked in Whizcredits (Whizpr's internal usage unit), not
 * raw USDT — callers convert verified USDT deposits via lib/pricing.ts
 * before crediting. Backed by Postgres (see lib/db.ts); tables are created
 * on first use, so there's no separate migration step to run.
 */

function keyFor(address: string) {
  return address.toLowerCase();
}

let schemaReady: Promise<void> | null = null;

async function createSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ledger_balances (
      address TEXT PRIMARY KEY,
      balance NUMERIC NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ledger_history (
      id BIGSERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      type TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      reason TEXT NOT NULL,
      at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS processed_deposits (
      tx_hash TEXT PRIMARY KEY
    )
  `;
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createSchema();
  }
  return schemaReady;
}

export async function getBalance(address: `0x${string}`): Promise<bigint> {
  await ensureSchema();
  const rows = await sql`SELECT balance FROM ledger_balances WHERE address = ${keyFor(address)}`;
  return rows[0] ? BigInt(rows[0].balance) : 0n;
}

export async function creditDeposit(
  address: `0x${string}`,
  amount: bigint,
  reason = 'on-chain USDT deposit converted to Whizcredits',
): Promise<bigint> {
  await ensureSchema();
  const key = keyFor(address);
  const rows = await sql`
    INSERT INTO ledger_balances (address, balance) VALUES (${key}, ${amount.toString()})
    ON CONFLICT (address) DO UPDATE SET balance = ledger_balances.balance + EXCLUDED.balance
    RETURNING balance
  `;
  await sql`
    INSERT INTO ledger_history (address, type, amount, reason, at)
    VALUES (${key}, 'credit', ${amount.toString()}, ${reason}, ${Date.now()})
  `;
  return BigInt(rows[0].balance);
}

export async function debitForUsage(
  address: `0x${string}`,
  amount: bigint,
  reason: string,
): Promise<{ ok: boolean; balance: bigint }> {
  await ensureSchema();
  const key = keyFor(address);

  // Single atomic UPDATE ... WHERE balance >= amount — the DB's row lock
  // makes the check-and-decrement safe against concurrent requests, unlike
  // the old in-memory Map's separate read-then-write.
  const rows = await sql`
    UPDATE ledger_balances
    SET balance = balance - ${amount.toString()}
    WHERE address = ${key} AND balance >= ${amount.toString()}
    RETURNING balance
  `;

  if (rows.length === 0) {
    const existing = await sql`SELECT balance FROM ledger_balances WHERE address = ${key}`;
    return { ok: false, balance: existing[0] ? BigInt(existing[0].balance) : 0n };
  }

  await sql`
    INSERT INTO ledger_history (address, type, amount, reason, at)
    VALUES (${key}, 'debit', ${amount.toString()}, ${reason}, ${Date.now()})
  `;
  return { ok: true, balance: BigInt(rows[0].balance) };
}

/**
 * Force-deducts Whizcredits as a moderation penalty for a policy violation
 * (e.g. submitting unrelated/inappropriate media). Unlike debitForUsage,
 * this doesn't fail on insufficient balance — a penalty shouldn't be
 * skippable just because the violator doesn't have enough to "afford" it;
 * it simply clamps at zero.
 */
export async function penalizeCredits(
  address: `0x${string}`,
  amount: bigint,
  reason: string,
): Promise<bigint> {
  await ensureSchema();
  const key = keyFor(address);

  await sql`INSERT INTO ledger_balances (address, balance) VALUES (${key}, 0) ON CONFLICT (address) DO NOTHING`;
  const before = await sql`SELECT balance FROM ledger_balances WHERE address = ${key}`;
  const priorBalance = BigInt(before[0]?.balance ?? 0);
  const deducted = priorBalance < amount ? priorBalance : amount;

  const rows = await sql`
    UPDATE ledger_balances SET balance = balance - ${deducted.toString()}
    WHERE address = ${key}
    RETURNING balance
  `;
  await sql`
    INSERT INTO ledger_history (address, type, amount, reason, at)
    VALUES (${key}, 'debit', ${deducted.toString()}, ${reason}, ${Date.now()})
  `;
  return BigInt(rows[0].balance);
}

// Prevent double-crediting the same on-chain deposit transaction twice.
export async function hasProcessedDeposit(txHash: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`SELECT 1 FROM processed_deposits WHERE tx_hash = ${txHash.toLowerCase()}`;
  return rows.length > 0;
}

export async function markDepositProcessed(txHash: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO processed_deposits (tx_hash) VALUES (${txHash.toLowerCase()}) ON CONFLICT (tx_hash) DO NOTHING
  `;
}
