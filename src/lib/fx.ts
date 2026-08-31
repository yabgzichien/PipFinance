// src/lib/fx.ts
// Pure FX rate logic. No network, no DB. The network half lives in src/prices/fx.ts,
// mirroring the existing lib/prices.ts + prices/yahoo.ts split.
import { BASE_CURRENCY } from './currency';

export const FX_STALE_MS = 24 * 60 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A cached conversion rate: how many MYR one unit of `code` is worth. */
export interface FxRate {
  code: string;
  rateMyr: number;
  asOf: string; // ISO datetime
}

/** Build a code to rate lookup, dropping anything that would corrupt a total. */
export function ratesFromCache(rows: FxRate[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (Number.isFinite(r.rateMyr) && r.rateMyr > 0) out[r.code] = r.rateMyr;
  }
  return out;
}

/**
 * The rate for a currency, or null when it is unknown.
 *
 * Returning null rather than 1 is the whole point: a caller must decide to exclude the
 * value, because counting a foreign amount at parity is the bug this feature fixes.
 * The base currency short-circuits to 1 and is never looked up, so a corrupt cache row
 * for MYR cannot rescale the user's entire net worth.
 */
export function rateFor(rates: Record<string, number>, code: string): number | null {
  if (code === BASE_CURRENCY) return 1;
  const r = rates[code];
  return Number.isFinite(r) && r > 0 ? r : null;
}

/**
 * Project an MYR amount into a display currency — the inverse of `rateFor`.
 *
 * Returns null rather than the raw MYR figure when the rate is unavailable, mirroring
 * `rateFor`'s own null-over-parity contract: a caller decides the fallback, so a caller
 * that forgets to handle null fails loudly in dev instead of quietly mislabeling MYR as
 * the display currency.
 */
export function toDisplay(amountMyr: number, code: string, rates: Record<string, number>): number | null {
  const rate = rateFor(rates, code);
  if (rate == null) return null;
  return Math.round((amountMyr / rate) * 100) / 100;
}

/**
 * Project a transaction's amount into a display currency.
 * When the transaction's currency already matches the target display currency,
 * returns the native entered amount directly to avoid intermediate conversion & rounding drift.
 */
export function txnToDisplay(
  txn: { amount: number; currency: string; nativeAmount?: number | null },
  targetCode: string,
  rates: Record<string, number>
): number {
  if (txn.currency === targetCode) {
    return txn.nativeAmount ?? txn.amount;
  }
  return toDisplay(txn.amount, targetCode, rates) ?? txn.amount;
}

export function isStale(asOf: string, now: Date = new Date()): boolean {
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > FX_STALE_MS;
}

/** "rate 12 Aug", the quiet hint shown under a converted account balance. */
export function staleLabel(asOf: string): string {
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `rate ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
