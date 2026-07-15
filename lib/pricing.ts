/**
 * Whizpr's pricing model.
 *
 * Users deposit USDT on-chain (verified in lib/viem-server.ts); the verified
 * amount is converted here into Whizcredits, Whizpr's internal usage unit,
 * before being added to the prepaid ledger (lib/ledger.ts). There is no
 * subscription or expiry — a user's Whizcredits balance simply depletes as
 * they submit alerts, and they top up again whenever it runs low.
 */

// USDT token decimals on the deployed chain (X Layer). Adjust if
// NEXT_PUBLIC_USDT_TOKEN_ADDRESS points at a token with different decimals.
const USDT_DECIMALS = 18n;
const USDT_UNIT = 10n ** USDT_DECIMALS;

// 2 USDT buys 100 Whizcredits, i.e. 1 USDT = 50 Whizcredits.
export const WHIZCREDITS_PER_USDT = 50n;

// Cost of a single emergency alert submission, in Whizcredits.
export const ALERT_COST_WHIZCREDITS = 5n;

export function usdtToWhizcredits(rawUsdtAmount: bigint): bigint {
  return (rawUsdtAmount * WHIZCREDITS_PER_USDT) / USDT_UNIT;
}
