/**
 * Server-side ban list for accounts that violate Whizpr's content policy —
 * submitting unrelated or inappropriate media (nudity, selfies, unrelated
 * vlogs) instead of genuine hazard/emergency footage. Populated by admins
 * via /api/moderation/reports/[id]/action after reviewing a report.
 *
 * Same in-memory tradeoff as the other lib/*-store.ts modules: fine for
 * local dev / a single serverless instance's lifetime, needs a real
 * database behind this same interface before production.
 */

export interface BanRecord {
  address: string;
  reason: string;
  bannedAt: number;
}

const bans = new Map<string, BanRecord>();

export function isBanned(address: string): boolean {
  return bans.has(address.toLowerCase());
}

export function getBan(address: string): BanRecord | null {
  return bans.get(address.toLowerCase()) ?? null;
}

export function banAddress(address: string, reason: string): BanRecord {
  const record: BanRecord = { address: address.toLowerCase(), reason, bannedAt: Date.now() };
  bans.set(record.address, record);
  return record;
}

export function unbanAddress(address: string): void {
  bans.delete(address.toLowerCase());
}
