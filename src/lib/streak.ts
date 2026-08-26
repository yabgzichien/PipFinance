// src/lib/streak.ts
// Pure recording-streak helper  pure motivation, NOT a credit signal. It counts
// consecutive days the user logged at least one transaction (any source, including
// manual), with a one-day grace so recording every other day keeps the streak alive.
//
// Distinct from `coverage` (lib/coverage.ts): coverage is the honest completeness signal
// that feeds the score and excludes manual entries; the streak only nudges the daily habit
// that improves coverage, so gaming it gains nothing.

export interface StreakInput {
  date?: string | null;
  createdAt: string;
  source?: string;
}

/** UTC day number (days since epoch) of an ISO date/datetime, or null. A bare 'YYYY-MM-DD'
 *  parses as UTC midnight, so a row's `date` resolves to the same day number everywhere. */
function utcDayNumber(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 86_400_000);
}

/**
 * The day number of the LOCAL calendar day `at` falls on.
 *
 * Every cutoff in this file has to be framed this way, not as `Date.now() / 86_400_000`.
 * A row's `date` is written by `todayKey()` from local accessors, and `utcDayNumber` reads
 * that key back as a plain calendar day — so in any timezone ahead of UTC there is a window
 * each night, from local midnight until the UTC day rolls over, where a freshly saved row
 * carries tomorrow's UTC day number. Against a UTC cutoff it looks future-dated and gets
 * dropped by `activeDays`, so logging at 00:30 in Malaysia contributed nothing to the
 * streak while the week ring (which reasons in local dates) lit the same day up.
 */
export function localDayNumber(at: Date): number {
  return Math.floor(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) / 86_400_000);
}

/**
 * Every distinct day the user logged on, most recent first, ignoring anything dated after
 * `today` (a mistyped year should not invent activity that has not happened yet).
 */
function activeDays(txns: StreakInput[], today: number): number[] {
  const days = new Set<number>();
  for (const tx of txns) {
    const d = utcDayNumber(tx.date) ?? utcDayNumber(tx.createdAt);
    if (d !== null && d <= today) days.add(d);
  }
  return [...days].sort((a, b) => b - a);
}

/**
 * The most recent day the user logged anything, as a UTC day number, or null if they never
 * have. Any source counts, manual included: this answers "when did they last touch the app's
 * ledger", which is what the reminder scheduler needs to decide whether to nudge.
 */
export function lastActiveDay(txns: StreakInput[], now: Date = new Date()): number | null {
  const today = localDayNumber(now);
  const sorted = activeDays(txns, today);
  return sorted.length === 0 ? null : sorted[0];
}

/** Length of the run in `sortedDaysDesc` (most recent first) starting at index 0, where
 *  consecutive days may be up to `maxGap` apart. Shared by `computeStreak` and
 *  `computeStreakWithFreeze` so both count a run the same way once the "did it lapse at all"
 *  question has been answered. */
function runLength(sortedDaysDesc: number[], maxGap: number): number {
  let streak = 1;
  let prev = sortedDaysDesc[0];
  for (let i = 1; i < sortedDaysDesc.length; i++) {
    if (prev - sortedDaysDesc[i] <= maxGap) {
      streak++;
      prev = sortedDaysDesc[i];
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Current recording streak: the length of the most recent run of active days where each
 * active day is within `graceDays + 1` of the previous one. Returns 0 if the most recent
 * activity is already older than that window (the streak has lapsed).
 */
export function computeStreak(txns: StreakInput[], now: Date = new Date(), graceDays = 1): number {
  const maxGap = graceDays + 1;
  const today = localDayNumber(now);

  const last = lastActiveDay(txns, now);
  if (last === null) return 0;
  if (today - last > maxGap) return 0; // lapsed

  const sorted = activeDays(txns, today); // most recent first
  return runLength(sorted, maxGap);
}

/**
 * A user's banked streak protection (docs/ui-engagement-plan.md Step 4). Earned, never sold:
 * one freeze grants automatically per calendar month (`ensureMonthlyFreeze`) and is consumed
 * only when it is actually needed, by `computeStreakWithFreeze` below.
 *
 * `spentForLastDay` records the `lastActiveDay` a freeze has already bridged, so re-evaluating
 * the same gap on a later render (or after `available` has flipped to false) keeps bridging it
 * idempotently instead of needing `available` to stay true forever.
 */
export interface StreakFreezeState {
  /** 'YYYY-MM' of the last month a freeze was granted for. */
  grantedMonth: string | null;
  /** Whether an unspent freeze is currently banked. */
  available: boolean;
  /** The `lastActiveDay` value a freeze has already been spent to bridge, or null. */
  spentForLastDay: number | null;
}

export const NO_STREAK_FREEZE: StreakFreezeState = { grantedMonth: null, available: false, spentForLastDay: null };

/** Local 'YYYY-MM' key for `now`, the same shape as `currentMonthKey` in lib/budget.ts (kept
 *  local here so this file has no dependency beyond its own inputs). */
function localMonthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Grant a fresh freeze once per calendar month. Idempotent within the month: calling this
 *  again after a grant (or a spend) this month returns `state` unchanged, so the caller can run
 *  it on every app foreground without double-granting. */
export function ensureMonthlyFreeze(state: StreakFreezeState, now: Date = new Date()): StreakFreezeState {
  const month = localMonthKey(now);
  if (state.grantedMonth === month) return state;
  return { grantedMonth: month, available: true, spentForLastDay: null };
}

/**
 * `computeStreak`, but a banked freeze bridges a single missed day at the boundary between the
 * last logged day and today  the one moment a freeze actually needs to act, since an older
 * gap already broke (and restarted) the streak in the past regardless of anything granted this
 * month. `freezeSpent` is true only the render a freeze is newly consumed, never on later
 * renders that keep bridging the same gap via `spentForLastDay`.
 */
export function computeStreakWithFreeze(
  txns: StreakInput[],
  freeze: StreakFreezeState,
  now: Date = new Date(),
  graceDays = 1
): { streak: number; freezeSpent: boolean } {
  const maxGap = graceDays + 1;
  const today = localDayNumber(now);

  const last = lastActiveDay(txns, now);
  if (last === null) return { streak: 0, freezeSpent: false };

  const gap = today - last;
  const alreadyBridged = freeze.spentForLastDay === last;
  const canBridge = gap === maxGap + 1 && (freeze.available || alreadyBridged);
  if (gap > maxGap && !canBridge) return { streak: 0, freezeSpent: false };

  const sorted = activeDays(txns, today);
  const streak = runLength(sorted, maxGap);
  return { streak, freezeSpent: canBridge && !alreadyBridged };
}

/** How many consecutive days the current run must reach before the streak "graduates"
 *  (docs/ui-engagement-plan.md Step 4): the daily count stops being the headline and a
 *  permanent "Logging since <month>" marker takes over, so escalating pressure winds down once
 *  a habit is actually automatic instead of compounding forever. */
export const STREAK_GRADUATION_DAYS = 30;

export function isStreakGraduated(streak: number): boolean {
  return streak >= STREAK_GRADUATION_DAYS;
}

/** UTC day number the current run began on, or null if there is no active run right now. Used
 *  to build the "Logging since <month>" marker once a streak has graduated  the day itself
 *  isn't shown, only the month, so a mid-month graduation doesn't read as falsely precise. */
export function streakStartDay(txns: StreakInput[], now: Date = new Date(), graceDays = 1): number | null {
  const maxGap = graceDays + 1;
  const today = localDayNumber(now);

  const last = lastActiveDay(txns, now);
  if (last === null || today - last > maxGap) return null;

  const sorted = activeDays(txns, today);
  let prev = sorted[0];
  let start = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (prev - sorted[i] <= maxGap) {
      prev = sorted[i];
      start = sorted[i];
    } else {
      break;
    }
  }
  return start;
}

/**
 * The streak, honouring a user-controlled pause (docs/ui-engagement-plan.md Step 4: agency,
 * not obligation  a trip or a hospital stay shouldn't cost a habit the user was keeping).
 * While paused, the streak is evaluated as of the moment pause began and stays frozen there for
 * as long as the pause lasts. Resuming re-anchors to the real clock: the user gets exactly the
 * grace window any other day would, no more  a pause protects the days *inside* it, it does
 * not retroactively forgive however long it takes to log again after resuming.
 */
export function computeStreakPaused(
  txns: StreakInput[],
  pausedSinceDay: number | null,
  now: Date = new Date(),
  graceDays = 1
): number {
  if (pausedSinceDay === null) return computeStreak(txns, now, graceDays);
  // LOCAL noon on the pause day, so this round-trips back through `localDayNumber` to exactly
  // `pausedSinceDay` in every timezone (UTC noon would land on the next calendar day anywhere
  // past UTC+12), and so the DST edge (a 23 or 25-hour local day) can't shift it either.
  const anchor = new Date(pausedSinceDay * 86_400_000);
  const frozenNow = new Date(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 12);
  return computeStreak(txns, frozenNow, graceDays);
}

/** Monday-first 7-day window containing `now`, local calendar (matches `compute7DayDots`'
 *  local Y-M-D reasoning, not the UTC day numbers the rest of this file uses  a week ring is a
 *  calendar concept a user recognises, not an activity-gap one). Days after today in the window
 *  are `false` (nothing to show yet, not a miss). */
export function computeWeekRing(txns: StreakInput[], now: Date = new Date()): { days: boolean[]; todayIndex: number } {
  const active = new Set<string>();
  for (const t of txns) {
    const k = t.date ?? (t.createdAt ? t.createdAt.slice(0, 10) : null);
    if (k) active.add(k);
  }
  // getDay(): Sun=0..Sat=6. Convert to Mon=0..Sun=6 so the ring reads as a normal week.
  const todayIndex = (now.getDay() + 6) % 7;
  const days = [...Array(7)].map((_, i) => {
    if (i > todayIndex) return false;
    const d = new Date(now);
    d.setDate(d.getDate() - (todayIndex - i));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return active.has(`${y}-${m}-${day}`);
  });
  return { days, todayIndex };
}

/**
 * 7-day activity tracker (e.g. for the Dashboard streak card and home screen widget).
 * Returns an array of 7 booleans [day-6, day-5, ..., today] indicating whether any transaction
 * was logged on each of the last 7 days.
 */
export function compute7DayDots(txns: StreakInput[], now: Date = new Date()): boolean[] {
  const active = new Set<string>();
  for (const t of txns) {
    const k = t.date ?? (t.createdAt ? t.createdAt.slice(0, 10) : null);
    if (k) active.add(k);
  }
  return [...Array(7)].map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return active.has(`${y}-${m}-${day}`);
  });
}

