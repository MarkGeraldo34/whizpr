/**
 * Server-side username registry.
 *
 * Whizpr's only account creation step is signing in with a wallet (SIWE) —
 * there's no separate signup form. A user "registers" their account by
 * choosing a username here the first time they open the Profile tab.
 *
 * Same tradeoff as lib/ledger.ts and lib/reports-store.ts: the in-memory
 * Maps below are only suitable for local dev / a single serverless
 * instance's lifetime — swap for a real database before production.
 */

export interface Profile {
  address: `0x${string}`;
  username: string;
}

const byAddress = new Map<string, Profile>();
const addressByUsername = new Map<string, string>();

export function getProfile(address: `0x${string}`): Profile | null {
  return byAddress.get(address.toLowerCase()) ?? null;
}

export function isUsernameTaken(username: string, excludingAddress?: `0x${string}`): boolean {
  const owner = addressByUsername.get(username.toLowerCase());
  if (!owner) return false;
  if (excludingAddress && owner === excludingAddress.toLowerCase()) return false;
  return true;
}

export function setUsername(address: `0x${string}`, username: string): Profile {
  const addressKey = address.toLowerCase();
  const existing = byAddress.get(addressKey);
  if (existing) {
    addressByUsername.delete(existing.username.toLowerCase());
  }

  const profile: Profile = { address, username };
  byAddress.set(addressKey, profile);
  addressByUsername.set(username.toLowerCase(), addressKey);
  return profile;
}
