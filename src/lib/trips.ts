/* Trip types. A trip is a second, orthogonal grouping over existing transactions — see
 * src/db/tripsRepo.ts for the repository and docs/superpowers/sdd for the design. */

import type { Transaction } from './types';

/** A named trip a user can (optionally) attach transactions to. Membership is always explicit;
 *  `startDate`/`endDate` are metadata for display and candidate-finding only, never a filter
 *  that decides membership on their own. */
export interface Trip {
  id: string;
  name: string;
  createdAt: string;
  archived: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface TripTotals {
  recordedExpenses: number;
  txnCount: number;
  byCategory: { categoryId: string; amount: number }[];
}

/**
 * What a trip cost, as RECORDED EXPENSES — the sum of the expense rows linked to it.
 *
 * Deliberately not "net trip cost". A refund is currently representable as an income row with no
 * link back to what it refunds, so netting it in would produce a number Pip cannot defend when
 * the user drills into it. Until refunds have explicit linkage, this counts spending only and the
 * UI says so.
 *
 * Three exclusions, each load-bearing:
 *  - Transfers move money between the user's own accounts; nothing is spent.
 *  - Income is not negative spending.
 *  - A split bill contributes the personal share ONLY, which needs no arithmetic here: the
 *    transaction row already carries `ownShare` (the full bill lives on `splits.gross`). Naively
 *    "correcting" for repayments here would subtract the friends' portions a second time.
 *
 * Every row goes through `convert`, the caller's single display-currency rule, so the headline,
 * the breakdown and the drill-down cannot disagree. Native amounts in different currencies are
 * never added directly.
 *
 * Membership is explicit and date-independent: an accommodation booked two months early counts,
 * and an unrelated payment made mid-trip does not.
 */
/**
 * The trip a written-off split share's new expense should inherit.
 *
 * The write-off is the same consumption as the original bill, so it belongs to the same trip.
 * Without this, a Singapore dinner someone never paid back would drop out of the Singapore total
 * at exactly the moment it genuinely became the user's own cost.
 */
export function inheritedTripId(origin: { tripId?: string | null } | undefined | null): string | null {
  return origin?.tripId ?? null;
}

export function computeTripTotals(
  txns: Transaction[],
  tripId: string,
  convert: (t: { amount: number; currency: string; nativeAmount?: number | null }) => number
): TripTotals {
  const mine = txns.filter((t) => t.tripId === tripId && t.type === 'expense');

  const byCat = new Map<string, number>();
  let recordedExpenses = 0;
  for (const t of mine) {
    const value = convert(t);
    recordedExpenses += value;
    const key = t.categoryId ?? 'other';
    byCat.set(key, (byCat.get(key) ?? 0) + value);
  }

  return {
    recordedExpenses,
    txnCount: mine.length,
    byCategory: [...byCat.entries()]
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
