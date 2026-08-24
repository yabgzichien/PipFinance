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
 * Convert a MYR figure into an account's own currency: the inverse of `deriveMyr`. Needed
 * wherever a balance-link write (`recordBalanceLink`) must land in `balance_entries.value`,
 * which is native to the account rather than always MYR: a transaction's canonical MYR
 * amount, or a commitment's MYR-denominated payment, has to be re-expressed in whatever
 * currency the target account itself keeps its balance in.
 *
 * Throws rather than falling back to parity when a foreign rate is missing, the same
 * write-boundary throw `deriveMyr` uses on the way in: silently landing the MYR figure into a
 * foreign account at 1:1 is the exact bug this feature exists to fix.
 */
export function deriveNative(myrAmount: number, currency: string, rate: number | null): number {
  if (currency === BASE_CURRENCY) {
    return round2(myrAmount);
  }
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No usable FX rate for ${currency}`);
  }
  return round2(myrAmount / rate);
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

/**
 * Normalise a currency code coming out of an LLM extraction. Anything unrecognised falls
 * back to the base currency: a bad code should never fail an otherwise good extraction,
 * and MYR is the correct guess for this app's users by a wide margin.
 */
export function normalizeCurrency(raw: unknown): string {
  if (typeof raw !== 'string') return BASE_CURRENCY;
  const code = raw.trim().toUpperCase();
  return currencyMeta(code) ? code : BASE_CURRENCY;
}

/**
 * Re-derive a row after the user edits its amount.
 *
 * The number coming out of an edit field is the NATIVE amount, because that is what the
 * row displays. Writing it straight into `amount` would set the MYR column to a yuan
 * figure and leave `native_amount` stale, which is the single most likely way to corrupt
 * this feature. This helper exists so no caller has to remember that.
 *
 * The frozen rate is reused deliberately: correcting a typo in March's dinner must not
 * silently reprice it at today's rate.
 */
export function rederiveOnEdit(entered: number, currency: string, frozenRate: number | null): MyrDerivation {
  return deriveMyr(entered, currency, frozenRate);
}
