/* Calendar arithmetic for the tap-only date-range picker (src/components/DateRangeSheet.tsx).
 *
 * Kept apart from the component so the grid maths and the selection rules can be tested without
 * rendering anything, and apart from lib/dates.ts because everything here is deliberately
 * timezone-free: a 'YYYY-MM-DD' is a calendar day the user pointed at, never an instant. The
 * formatters in lib/dates.ts route through `new Date(iso)`, which reads a bare date as midnight
 * UTC — west of Greenwich that renders the *previous* day, which would show the wrong date back
 * to the user immediately after they tapped it. So dates here are built and read via UTC
 * arithmetic or plain string slicing, never local-time Date components.
 */

import { isValidIsoDate } from './dates';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_MS = 86400000;

/** A trip's dates. `end` is never earlier than `start` — see `applyRangeTap`. */
export interface DateRange {
  start: string | null;
  end: string | null;
}

/** The month the sheet is currently showing. `month` is 1-12, not a Date's 0-11. */
export interface MonthCursor {
  year: number;
  month: number;
}

/** One day cell. `inMonth` is false for the spillover days that pad the grid to full weeks. */
export interface GridCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** How a day should be drawn: an endpoint, a day spanned by the range, or neither. */
export type RangePosition = 'none' | 'start' | 'end' | 'single' | 'middle';

function isoFromUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * A fixed 6x7 Mon-first grid for one month, including the spillover days that fill the first and
 * last weeks. Always 42 cells so the sheet's height never changes as the user pages between
 * months — a grid that grew a row would shift the buttons under the user's thumb mid-tap.
 */
export function buildMonthGrid(year: number, month: number): GridCell[] {
  const firstMs = Date.UTC(year, month - 1, 1);
  const firstDow = new Date(firstMs).getUTCDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // Mon-first: Mon=0 … Sun=6
  const originMs = firstMs - startOffset * DAY_MS;

  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(originMs + i * DAY_MS);
    cells.push({
      iso: isoFromUtc(originMs + i * DAY_MS),
      day: d.getUTCDate(),
      inMonth: d.getUTCFullYear() === year && d.getUTCMonth() === month - 1,
    });
  }
  return cells;
}

/** Page the cursor by `delta` months, rolling the year over as needed. */
export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const d = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/**
 * The range after tapping `iso`. Two taps make a range: the first sets the start, the second the
 * end, and a third starts over.
 *
 * A second tap *before* the start does not swap the endpoints — it restarts from the earlier day.
 * Swapping would silently reinterpret the first tap the user made; restarting matches what they
 * are plainly doing, which is picking a different departure date. Either way an end earlier than
 * its start is unrepresentable, so no caller ever has to validate the order.
 *
 * Tapping the start a second time is allowed and yields a one-day trip (`start === end`), which a
 * day trip genuinely needs. Clearing is the sheet's explicit Clear action, not a re-tap.
 */
export function applyRangeTap(range: DateRange, iso: string): DateRange {
  if (!range.start || range.end) return { start: iso, end: null };
  if (iso < range.start) return { start: iso, end: null };
  return { start: range.start, end: iso };
}

/** How `iso` relates to the current selection, for styling one grid cell. */
export function rangePosition(iso: string, range: DateRange): RangePosition {
  const { start, end } = range;
  if (!start) return 'none';
  if (!end || start === end) return iso === start ? 'single' : 'none';
  if (iso === start) return 'start';
  if (iso === end) return 'end';
  return iso > start && iso < end ? 'middle' : 'none';
}

/** e.g. "12 Sep 2026", or "2026年9月12日". Reads the components off the string so the day named
 *  is the day tapped, in every timezone. */
export function formatDay(iso: string, isZh: boolean): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (isZh) return `${year}年${month}月${day}日`;
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/**
 * The summary shown on the collapsed date row, or null when there is nothing to show — trip dates
 * are optional, so the row falls back to its placeholder rather than inventing a default.
 * A one-day range reads as a single date; "12 Sep → 12 Sep" says nothing extra.
 */
export function formatRangeLabel(range: DateRange, isZh: boolean): string | null {
  const { start, end } = range;
  if (!start) return null;
  if (!end || end === start) return formatDay(start, isZh);
  return `${formatDay(start, isZh)} → ${formatDay(end, isZh)}`;
}

/** The sheet's header, e.g. "September 2026" or "2026年9月". */
export function formatMonthTitle(cursor: MonthCursor, isZh: boolean): string {
  if (isZh) return `${cursor.year}年${cursor.month}月`;
  return `${MONTHS_FULL[cursor.month - 1]} ${cursor.year}`;
}

/** The local calendar day, for highlighting "today" in the grid. Local, not UTC: late evening
 *  east of Greenwich is already tomorrow in UTC, and the user's today is the one on their wall. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Which month the sheet opens on: the one holding the current start, else the current month. */
export function initialCursor(range: DateRange, now: Date = new Date()): MonthCursor {
  if (range.start && isValidIsoDate(range.start)) {
    return { year: Number(range.start.slice(0, 4)), month: Number(range.start.slice(5, 7)) };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
