// src/lib/reminders.ts
// Pure scheduling logic for the two local reminders: log your spending, and chase what you
// are owed. No Expo imports, no DB, no clock reads  every function takes `now` explicitly so
// the whole file is unit-testable the way the rest of src/lib is.
//
// Why a ladder of one-shot notifications rather than one repeating trigger:
//
//   1. The log reminder is suppressed when you already logged inside the current window, and
//      a repeating trigger fires blindly. Only a re-planned one-shot can skip a day.
//
// So the planner emits the next PLAN_HORIZON occurrences and the caller re-arms them every
// time the app comes to the foreground. That gives a week of coverage from the last time the
// app was opened, which is ample for a habit whose whole point is opening the app.

import { AGING_DAYS, type PersonDebt } from './split';
import { fmtMoney } from './format';
import { toDisplay } from './fx';
import { notificationTitle, type NotificationClass } from './voice';

export type { NotificationClass } from './voice';

/**
 * The currency reminder copy states amounts in, plus the rates to get there. Amounts reaching
 * this module are MYR-canonical like everywhere else, so a notification would otherwise read
 * "RM 400" to a user whose every on-screen total says SGD. Defaults to plain MYR, which is
 * what every existing caller and test gets.
 */
export interface ReminderDisplay {
  code: string;
  rates: Record<string, number>;
}

const MYR_DISPLAY: ReminderDisplay = { code: 'MYR', rates: {} };

/** Format an MYR figure in the reminder's display currency, falling back to the MYR number
 *  itself if the rate is missing — a nudge is worth sending with a slightly off denomination,
 *  and never worth dropping. */
function money(amountMyr: number, display: ReminderDisplay = MYR_DISPLAY): string {
  return fmtMoney(toDisplay(amountMyr, display.code, display.rates) ?? amountMyr, display.code);
}
export type ReminderCadence = 'off' | 'daily' | 'weekly';

/** The three kinds of reminder this app schedules. Lives here rather than in
 *  src/notifications/index.ts so the pure planners below can tag their own output. */
export type ReminderKind = 'log' | 'owed' | 'commitment';

/** Routine (log) is low-urgency and skippable; save (owed, commitment) has real stakes. Never
 *  mixed on one notification (ui-engagement-plan.md Step 7, item 2). */
export function reminderClass(kind: ReminderKind): NotificationClass {
  return kind === 'log' ? 'routine' : 'save';
}

/** Every accepted cadence, in the order the Settings pills render them. */
export const REMINDER_CADENCES: ReminderCadence[] = ['off', 'daily', 'weekly'];

/** Fixed fire time, 22:00 local. Late enough that the day's spending has happened. */
export const REMINDER_HOUR = 22;

/** The owed nudge sits five minutes later so the two never arrive on the same minute. */
export const OWED_REMINDER_MINUTE = 5;

/** How many future one-shots to keep armed. One week of daily cover. */
export const PLAN_HORIZON = 7;

/** How often to chase an unpaid friend once their debt has aged past `AGING_DAYS`. */
const OWED_CADENCE_DAYS = 7;

/** Minimum distinct logged transactions before the behaviour-inferred fire hour is trusted over
 *  the REMINDER_HOUR fallback, since a couple of entries on one evening is not a routine yet. */
export const MIN_HISTORY_FOR_INFERRED_HOUR = 5;

/** One scheduled reminder: when it fires and the copy baked in at scheduling time. */
export interface ReminderPlanEntry {
  at: Date;
  title: string;
  body: string;
  kind: ReminderKind;
}

/**
 * The user's habitual logging hour, taken as the mode of the hours their transactions were created at
 * minus 30 minutes, so the nudge lands before the window rather than inside it. Falls back to
 * `fallback` (REMINDER_HOUR by default) until `MIN_HISTORY_FOR_INFERRED_HOUR` samples exist.
 *
 * Ties break toward the earlier hour so the result is deterministic rather than dependent on
 * `Map` iteration order.
 */
export function inferredFireHour(
  loggedHours: number[],
  fallback: number = REMINDER_HOUR
): { hour: number; minute: number } {
  if (loggedHours.length < MIN_HISTORY_FOR_INFERRED_HOUR) return { hour: fallback, minute: 0 };

  const counts = new Map<number, number>();
  for (const h of loggedHours) counts.set(h, (counts.get(h) ?? 0) + 1);

  let modeHour = loggedHours[0];
  let modeCount = -1;
  for (const [hour, count] of counts) {
    if (count > modeCount || (count === modeCount && hour < modeHour)) {
      modeHour = hour;
      modeCount = count;
    }
  }

  const minutesFromMidnight = (((modeHour * 60 - 30) % 1440) + 1440) % 1440;
  return { hour: Math.floor(minutesFromMidnight / 60), minute: minutesFromMidnight % 60 };
}

/** Days between nudges, or null when the reminder is switched off. */
export function cadenceDays(cadence: ReminderCadence): number | null {
  switch (cadence) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    default:
      return null;
  }
}

/** Human label for the Settings pills. */
export function cadenceLabel(cadence: ReminderCadence): string {
  switch (cadence) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    default:
      return 'Off';
  }
}

/** True when `value` is a cadence this build understands. Guards what comes back out of app_meta. */
export function isReminderCadence(value: unknown): value is ReminderCadence {
  return typeof value === 'string' && (REMINDER_CADENCES as string[]).includes(value);
}

/**
 * Days since the local epoch for the calendar day `d` falls on in the device's own timezone.
 *
 * Local rather than UTC because the fire time is a wall-clock hour: at 22:00 in UTC+8 the UTC
 * date has not yet rolled over, so a UTC day number would put the evening nudge on the wrong
 * calendar day.
 */
export function localDayNumber(d: Date): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** A local `Date` at `hour:minute` on the calendar day `dayNumber` identifies. */
function atLocalTime(dayNumber: number, hour: number, minute: number): Date {
  // Read the calendar date off the UTC instant, then rebuild through the local-time
  // constructor so the result lands at the wall-clock hour rather than the UTC hour.
  const utc = new Date(dayNumber * 86_400_000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), hour, minute, 0, 0);
}

/**
 * The first day on or after `startDay` whose fire time is strictly in the future, stepping in
 * whole cadences so the schedule stays on the same footing it was anchored to.
 */
function firstFutureDay(startDay: number, step: number, hour: number, minute: number, now: Date): number {
  let day = startDay;
  while (atLocalTime(day, hour, minute).getTime() <= now.getTime()) day += step;
  return day;
}

export interface LogReminderInput {
  cadence: ReminderCadence;
  /**
   * Day number of the last transaction the user logged, or null if they never have.
   *
   * Comes from `lastActiveDay` in lib/streak.ts, which counts in LOCAL days on the same
   * footing as `localDayNumber` below, so for a row carrying a `date` the two agree exactly.
   * They can differ by one only for an undated row falling back to `createdAt` that was
   * written in the small hours, which at worst nudges a day early.
   */
  lastLoggedDay: number | null;
  /** Fire hour/minute, already resolved by the caller: the behaviour-inferred window (see
   *  `inferredFireHour`), a Settings override, or left unset for the REMINDER_HOUR fallback. */
  fireHour?: number;
  fireMinute?: number;
}

/**
 * When to nudge the user to log their spending.
 *
 * The anchor is the last day they logged, so logging pushes the next nudge a full cadence out.
 * That is the whole "skip if already logged" behaviour: on a daily cadence, logging today
 * moves tonight's nudge to tomorrow, and the caller re-plans on every foreground.
 *
 * A user who has never logged anything is anchored on today rather than nudged immediately.
 */
export function planLogReminders(input: LogReminderInput, now: Date): ReminderPlanEntry[] {
  const step = cadenceDays(input.cadence);
  if (step === null) return [];

  const hour = input.fireHour ?? REMINDER_HOUR;
  const minute = input.fireMinute ?? 0;

  const today = localDayNumber(now);
  const anchor = input.lastLoggedDay ?? today;
  const first = firstFutureDay(anchor + step, step, hour, minute, now);

  const out: ReminderPlanEntry[] = [];
  for (let i = 0; i < PLAN_HORIZON; i++) {
    const day = first + i * step;
    // Each rung states the gap as it will actually stand on the evening it fires, not as it
    // stands now, so the last one in the ladder is not a week out of date when it arrives.
    const daysSince = input.lastLoggedDay === null ? null : day - input.lastLoggedDay;
    out.push({
      at: atLocalTime(day, hour, minute),
      title: notificationTitle('routine', day),
      body: logReminderBody(daysSince),
      kind: 'log',
    });
  }
  return out;
}

export interface OwedReminderInput {
  enabled: boolean;
  /** Currency to state amounts in. Omitted means plain MYR. */
  display?: ReminderDisplay;
  /** Age of the oldest unpaid bill across everyone, from `oldestOverdueDays` in lib/split.ts. */
  oldestOverdueDays: number;
  /** Who owes what, biggest first, from `groupOpenSharesByPerson`. */
  debts: PersonDebt[];
}

/**
 * When to nudge the user to chase a friend, weekly, and only once a debt has aged past
 * `AGING_DAYS`. Below that threshold it is still a favour rather than something to chase, and
 * the Owed screen does not call it overdue either.
 */
export function planOwedReminders(input: OwedReminderInput, now: Date): ReminderPlanEntry[] {
  if (!input.enabled) return [];
  if (input.oldestOverdueDays < AGING_DAYS) return [];
  if (input.debts.length === 0) return [];

  const first = firstFutureDay(
    localDayNumber(now),
    OWED_CADENCE_DAYS,
    REMINDER_HOUR,
    OWED_REMINDER_MINUTE,
    now
  );

  const out: ReminderPlanEntry[] = [];
  for (let i = 0; i < PLAN_HORIZON; i++) {
    const day = first + i * OWED_CADENCE_DAYS;
    out.push({
      at: atLocalTime(day, REMINDER_HOUR, OWED_REMINDER_MINUTE),
      title: notificationTitle('save', day),
      // Ages advance with each rung for the same reason the log ladder's do.
      body: owedReminderBody(input.debts, day - localDayNumber(now), input.display ?? MYR_DISPLAY),
      kind: 'owed',
    });
  }
  return out;
}

/** Pip rehearsing the same joke twice in a row wears out faster than dropping it, so tiers 3
 *  and 4 rotate the escalated line against this self-aware one, keyed off parity of the gap so
 *  the choice is deterministic rather than random. */
function logReminderSelfAware(daysSince: number): string {
  return `${daysSince} days since your last log. Pip's been rehearsing this notification and even it thinks it's a bit much at this point.`;
}

/** The log nudge's copy. `daysSince` is null when nothing has ever been logged. Escalates in
 *  four tiers as the gap widens, mild to done, rotating the top two tiers against a self-aware
 *  fallback rather than always performing the bit. */
export function logReminderBody(daysSince: number | null): string {
  if (daysSince === null) {
    return 'You have not logged anything yet. Add your first transaction and I will start keeping track.';
  }
  if (daysSince <= 1) {
    return 'Nothing logged since yesterday. A minute now keeps your record honest.';
  }
  if (daysSince <= 4) {
    return `It's been ${daysSince} days. Your coverage is slipping.`;
  }
  if (daysSince <= 9) {
    return `${daysSince} days since you touched this app. Bestie your own money is ghosting you and you're the one doing it.`;
  }
  if (daysSince <= 20) {
    return daysSince % 2 === 0
      ? `${daysSince} days. This isn't tracking anymore, this is a missing persons case.`
      : logReminderSelfAware(daysSince);
  }
  return daysSince % 2 === 0
    ? `${daysSince} days. Pip has stopped expecting anything from you. This is acceptance now, not anger.`
    : logReminderSelfAware(daysSince);
}

// --- Recurring commitments (bills + DCA investments) ------------------------------------
//
// Unlike the log/owed ladders above, this is not one cadence stepped forward — it is a small,
// capped set of one-shot nudges re-derived from whatever is currently unresolved, so the same
// re-plan-on-foreground mechanism keeps it honest: paying a bill (or the month rolling over)
// drops it from the next sync without anything having to be explicitly cancelled.

export const COMMITMENT_DIGEST_TITLE = 'Bills this month';
export const COMMITMENT_OVERDUE_TITLE = 'Overdue';

/** How many months ahead to keep a digest armed for. */
const COMMITMENT_DIGEST_MONTHS = 3;
/** An overdue commitment is nudged this many days after its due date. */
const COMMITMENT_OVERDUE_DELAY_DAYS = 2;
/** Hard ceiling on individual overdue nudges — the OS caps total pending local notifications,
 *  and the log + owed ladders already use up to 14 of that budget between them. */
const COMMITMENT_OVERDUE_CAP = 5;

export interface CommitmentReminderRow {
  dueDate: string; // 'YYYY-MM-DD'
  amount: number;
  label: string;
  status: 'scheduled' | 'paid' | 'late' | 'skipped';
}

export interface CommitmentReminderInput {
  enabled: boolean;
  occurrences: CommitmentReminderRow[];
  /** Currency to state amounts in. Omitted means plain MYR. */
  display?: ReminderDisplay;
}

/** `dayNumber` for a plain 'YYYY-MM-DD' string, read as a local calendar date. */
function dayNumberOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return localDayNumber(new Date(y, m - 1, d, 12));
}

/** The next local `hour:minute` that is strictly after `now`, never earlier than `minDay` —
 *  a fire time that would otherwise land in the past is pushed to the next day's slot instead
 *  of being silently dropped, so a badly-overdue bill still gets a nudge on the next sync. */
function nextSlotOnOrAfter(minDay: number, hour: number, minute: number, now: Date): Date {
  let day = Math.max(minDay, localDayNumber(now));
  let at = atLocalTime(day, hour, minute);
  if (at.getTime() <= now.getTime()) {
    day += 1;
    at = atLocalTime(day, hour, minute);
  }
  return at;
}

/**
 * When to nudge about recurring commitments (bills and DCA contributions): one monthly digest
 * per month with anything still unpaid, plus one nudge per commitment that is currently overdue.
 * A 'paid'/'late'/'skipped' occurrence never generates a nudge — only 'scheduled' rows do, so
 * ticking a bill (or the app matching it to an existing transaction) retracts its reminder on
 * the next re-plan the same way logging a transaction retracts the log nudge.
 */
export function planCommitmentReminders(input: CommitmentReminderInput, now: Date): ReminderPlanEntry[] {
  if (!input.enabled) return [];
  const unresolved = input.occurrences.filter((o) => o.status === 'scheduled');
  if (unresolved.length === 0) return [];

  const today = localDayNumber(now);
  const out: ReminderPlanEntry[] = [];

  const byMonth = new Map<string, CommitmentReminderRow[]>();
  for (const o of unresolved) {
    const mk = o.dueDate.slice(0, 7);
    const rows = byMonth.get(mk);
    if (rows) rows.push(o);
    else byMonth.set(mk, [o]);
  }
  const months = [...byMonth.keys()].sort().slice(0, COMMITMENT_DIGEST_MONTHS);
  for (const mk of months) {
    const rows = byMonth.get(mk)!;
    const earliestDueDay = Math.min(...rows.map((r) => dayNumberOf(r.dueDate)));
    const at = nextSlotOnOrAfter(earliestDueDay - 1, REMINDER_HOUR, 0, now);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    out.push({
      at,
      title: COMMITMENT_DIGEST_TITLE,
      body: commitmentDigestBody(rows, earliestDueDay, today, total, input.display ?? MYR_DISPLAY),
      kind: 'commitment',
    });
  }

  const overdue = unresolved
    .filter((o) => dayNumberOf(o.dueDate) < today)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    .slice(0, COMMITMENT_OVERDUE_CAP);
  for (const o of overdue) {
    const at = nextSlotOnOrAfter(dayNumberOf(o.dueDate) + COMMITMENT_OVERDUE_DELAY_DAYS, REMINDER_HOUR, OWED_REMINDER_MINUTE, now);
    out.push({
      at,
      title: COMMITMENT_OVERDUE_TITLE,
      body: overdueBillBody(o.label, o.amount, dayNumberOf(o.dueDate), today, input.display ?? MYR_DISPLAY),
      kind: 'commitment',
    });
  }

  return out;
}

/** Hard ceiling on how many reminders, of any kind combined, may land on one calendar day. */
export const DAILY_REMINDER_CAP = 2;

/**
 * Enforces the hard daily cap across every planner's output combined (ui-engagement-plan.md
 * Step 7, item 3): mixing an unlimited routine ladder with save-class nudges is what burns a
 * notification channel, so this runs once over the merged queue rather than trusting each
 * planner to behave.
 *
 * On a day where more than `max` entries would land, `save`-class entries are kept over
 * `routine` ones (a habit nudge is skippable; a bill or an ageing debt is not), and ties within
 * the same class keep the earliest-firing entries.
 */
export function capDailyReminders(entries: ReminderPlanEntry[], max = DAILY_REMINDER_CAP): ReminderPlanEntry[] {
  const byDay = new Map<number, ReminderPlanEntry[]>();
  for (const e of entries) {
    const day = localDayNumber(e.at);
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
  }

  const out: ReminderPlanEntry[] = [];
  for (const list of byDay.values()) {
    const ranked = [...list].sort((a, b) => {
      const classRank = (e: ReminderPlanEntry) => (reminderClass(e.kind) === 'save' ? 0 : 1);
      const byClass = classRank(a) - classRank(b);
      return byClass !== 0 ? byClass : a.at.getTime() - b.at.getTime();
    });
    out.push(...ranked.slice(0, max));
  }
  return out;
}

/** How many days ahead of `today` the earliest bill in the month is due, floored at zero. */
function daysUntil(earliestDueDay: number, today: number): number {
  return Math.max(0, earliestDueDay - today);
}

/**
 * The monthly digest's copy, tiered by how soon the nearest bill is due rather than just the
 * count, so a month with three bills all three weeks out still reads as calm.
 *
 * Tier 3 also fires when several bills are clustered close together, even if the nearest one
 * is a few days out, since the crunch is the total landing at once rather than any single date.
 */
function commitmentDigestBody(rows: CommitmentReminderRow[], earliestDueDay: number, today: number, total: number, display: ReminderDisplay): string {
  const count = rows.length;
  const label = `${count} bill${count === 1 ? '' : 's'}`;
  const amount = money(total, display);
  const until = daysUntil(earliestDueDay, today);

  const dueDays = rows.map((r) => dayNumberOf(r.dueDate));
  const clustered = count >= 3 && Math.max(...dueDays) - Math.min(...dueDays) <= 3;

  if (until <= 1 || clustered) {
    return `${label}, ${amount} total, and it's giving 'broke by Friday' energy. Might want to look at this one.`;
  }
  if (until <= 3) {
    return `${label} this month, ${amount} total, and one's due in ${until} days. Adulting arc loading.`;
  }
  return `${label} due this month, ${amount} total. Just so you're not blindsided later.`;
}

/**
 * The overdue nudge's copy, tiered by how many days late the bill is. Tier 3 drops the joke:
 * an overdue bill can mean the money genuinely was not there, not just procrastination, and
 * that is not something to be cute about.
 */
function overdueBillBody(label: string, amount: number, dueDay: number, today: number, display: ReminderDisplay): string {
  const days = Math.max(0, today - dueDay);
  const amt = money(amount, display);

  if (days <= 2) {
    const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    return `${label} was due ${ago}, ${amt}. Pip already knew you'd let this slide.`;
  }
  if (days <= 7) {
    return `${label}, ${amt}, ${days} days late. Giving 'I'll deal with it tomorrow' energy. It is tomorrow.`;
  }
  return `${label} is ${days} days overdue, ${amt}. No jokes on this one, just letting you know.`;
}

/** The "someone else is waiting too" tail, common to every tier below — only the lead line's
 *  tone escalates with age, the count-of-others phrasing stays flat. */
function owedOthersSuffix(rest: number): string {
  if (rest === 0) return '';
  if (rest === 1) return ' One other is waiting too.';
  return ` ${rest} others are waiting too.`;
}

/**
 * The owed nudge's copy, naming the biggest debt and counting the rest. Escalates in four
 * tiers as the debt ages, mild to done, the last of which drops the joke entirely.
 *
 * `daysAhead` shifts every age forward to what it will be on the evening this fires, so a
 * reminder scheduled three weeks out does not arrive quoting today's number.
 */
export function owedReminderBody(debts: PersonDebt[], daysAhead = 0, display: ReminderDisplay = MYR_DISPLAY): string {
  if (debts.length === 0) return 'Nobody owes you anything right now.';

  const [top] = debts;
  const days = top.oldestDays + daysAhead;
  const amount = money(top.total, display);
  const rest = debts.length - 1;

  if (days <= 7) {
    const lead = `${top.name} has owed you ${amount} for ${days} days.`;
    return rest === 0 ? `${lead} Worth a nudge.` : `${lead}${owedOthersSuffix(rest)}`;
  }
  if (days <= 20) {
    const lead = `${top.name} still owes you ${amount}. ${days} days of you being way too chill about this.`;
    return `${lead}${owedOthersSuffix(rest)}`;
  }
  if (days <= 45) {
    const lead = `${top.name} owes you ${amount}. ${days} days. At this point it's not a debt, it's a situationship.`;
    return `${lead}${owedOthersSuffix(rest)}`;
  }
  const lead = `${top.name} has owed you ${amount} for ${days} days. Pip isn't even going to make a joke about this one. That's how bad it's gotten.`;
  return `${lead}${owedOthersSuffix(rest)}`;
}
