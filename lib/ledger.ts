/**
 * Server-side prepaid WOKB ledger.
 *
 * This module exposes a small interface (getBalance / credit / debit) so the
 * rest of the app never touches storage directly. The in-memory Map below is
 * only suitable for local dev / a single serverless instance's lifetime —
 * for production, wire LEDGER_DATABASE_URL up to a real database (Vercel
 * Postgres, Neon, etc.) behind this same interface.
 */

interface LedgerEntry {
  balance: bigint;
  history: Array<{ type: 'credit' | 'debit'; amount: bigint; reason: string; at: number }>;
}

const inMemoryLedger = new Map<string, LedgerEntry>();

function keyFor(address: string) {
  return address.toLowerCase();
}

export async function getBalance(address: `0x${string}`): Promise<bigint> {
  const entry = inMemoryLedger.get(keyFor(address));
  return entry?.balance ?? 0n;
}

export async function creditDeposit(
  address: `0x${string}`,
  amount: bigint,
  reason = 'on-chain WOKB deposit',
): Promise<bigint> {
  const key = keyFor(address);
  const entry = inMemoryLedger.get(key) ?? { balance: 0n, history: [] };
  entry.balance += amount;
  entry.history.push({ type: 'credit', amount, reason, at: Date.now() });
  inMemoryLedger.set(key, entry);
  return entry.balance;
}

export async function debitForUsage(
  address: `0x${string}`,
  amount: bigint,
  reason: string,
): Promise<{ ok: boolean; balance: bigint }> {
  const key = keyFor(address);
  const entry = inMemoryLedger.get(key) ?? { balance: 0n, history: [] };

  if (entry.balance < amount) {
    return { ok: false, balance: entry.balance };
  }

  entry.balance -= amount;
  entry.history.push({ type: 'debit', amount, reason, at: Date.now() });
  inMemoryLedger.set(key, entry);
  return { ok: true, balance: entry.balance };
}

// Prevent double-crediting the same on-chain deposit transaction twice.
const processedDeposits = new Set<string>();

export function hasProcessedDeposit(txHash: string): boolean {
  return processedDeposits.has(txHash.toLowerCase());
}

export function markDepositProcessed(txHash: string): void {
  processedDeposits.add(txHash.toLowerCase());
}
