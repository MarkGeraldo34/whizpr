/**
 * Admin identification for moderation endpoints. Whizpr has no separate
 * admin login — an "admin" is simply a wallet address listed in
 * ADMIN_ADDRESSES that has signed in normally via SIWE.
 */
export function isAdminAddress(address: string): boolean {
  const admins = (process.env.ADMIN_ADDRESSES ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(address.toLowerCase());
}
