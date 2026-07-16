/**
 * Server-side registry of first-responder email contacts, keyed by the
 * country they cover. Used to fan out a notification email whenever a new
 * emergency report comes in for that country.
 *
 * Same in-memory tradeoff as the other lib/*-store.ts modules: fine for
 * local dev / a single serverless instance's lifetime, needs a real
 * database behind this same interface before production. Managed via
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

const responders: ResponderContact[] = [];

export function addResponder(email: string, countryCode: string, countryName: string): ResponderContact {
  const record: ResponderContact = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    countryCode: countryCode.trim().toUpperCase(),
    countryName: countryName.trim(),
    createdAt: Date.now(),
  };
  responders.push(record);
  return record;
}

export function removeResponder(id: string): boolean {
  const index = responders.findIndex((r) => r.id === id);
  if (index === -1) return false;
  responders.splice(index, 1);
  return true;
}

export function listResponders(): ResponderContact[] {
  return [...responders].sort((a, b) => b.createdAt - a.createdAt);
}

export function getRespondersForCountry(countryCode: string | null): ResponderContact[] {
  if (!countryCode) return [];
  const normalized = countryCode.trim().toUpperCase();
  return responders.filter((r) => r.countryCode === normalized);
}
