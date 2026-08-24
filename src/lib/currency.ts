// src/lib/currency.ts
// The single place a native amount becomes a MYR amount. Every write path goes
// through deriveMyr so the stored invariant can only hold or throw, never drift.
import { BASE_CURRENCY, currencyMeta } from './currencies';

export { BASE_CURRENCY };

/** Round to 2dp, killing float artifacts. Non-finite input reads as 0, matching `fmt`. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface MyrDerivation {
  /** Canonical MYR value. This is what goes in transactions.amount. */
  amount: number;
  /** The figure the user actually entered, or null for a plain MYR row. */
  nativeAmount: number | null;
  /** MYR per 1 native unit, frozen. Null for a plain MYR row. */
  fxRate: number | null;
}

/**
 * Derive the canonical MYR amount from an entered amount.
 *
 * A MYR row stores null for both extra columns, so an upgraded database's existing
 * rows are already valid without any backfill.
 *
 * Throws rather than falling back to parity when a foreign rate is missing: silently
 * counting CNY at 1:1 is the exact bug this feature exists to fix, and a throw at the
 * write boundary is far cheaper to find than a wrong number in a total. Callers are
 * expected to have a cached rate already, because activating a currency fetches one.
 */
export function deriveMyr(entered: number, currency: string, rate: number | null): MyrDerivation {
  if (currency === BASE_CURRENCY) {
    return { amount: round2(entered), nativeAmount: null, fxRate: null };
  }
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No usable FX rate for ${currency}`);
  }
  return { amount: round2(entered * rate), nativeAmount: entered, fxRate: rate };
}

/**
 * Read the `active_currencies` meta value. MYR is forced in and placed first: the base
 * currency can never be deactivated, and a stored value missing it would otherwise hide
 * ringgit from the user's own picker.
 */
export function parseActiveCurrencies(raw: string | null): string[] {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const codes = Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  const valid = codes.filter((c) => c !== BASE_CURRENCY && currencyMeta(c) !== null);
  return [BASE_CURRENCY, ...[...new Set(valid)]];
}

/** The gate for every piece of multi-currency UI. False means the feature is invisible. */
export function isMultiCurrency(active: string[]): boolean {
  return active.length > 1;
}
