import {
  applyRangeTap,
  buildMonthGrid,
  formatDay,
  formatMonthTitle,
  formatRangeLabel,
  initialCursor,
  rangePosition,
  shiftMonth,
  todayIso,
} from '../src/lib/dateRange';

describe('buildMonthGrid', () => {
  it('always returns six Mon-first weeks', () => {
    const grid = buildMonthGrid(2026, 9);
    expect(grid).toHaveLength(42);
  });

  it('places the 1st of the month in the correct Mon-first column', () => {
    // 1 Sep 2026 is a Tuesday -> column index 1 with Monday first.
    const grid = buildMonthGrid(2026, 9);
    expect(grid[1]).toEqual({ iso: '2026-09-01', day: 1, inMonth: true });
  });

  it('leads with the previous month for a month starting on a Sunday', () => {
    // 1 Mar 2026 is a Sunday -> six leading cells from February.
    const grid = buildMonthGrid(2026, 3);
    expect(grid[0]).toEqual({ iso: '2026-02-23', day: 23, inMonth: false });
    expect(grid[5]).toEqual({ iso: '2026-02-28', day: 28, inMonth: false });
    expect(grid[6]).toEqual({ iso: '2026-03-01', day: 1, inMonth: true });
  });

  it('includes 29 February in a leap year', () => {
    const grid = buildMonthGrid(2028, 2);
    const inMonth = grid.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(29);
    expect(inMonth[28].iso).toBe('2028-02-29');
  });

  it('stops February at the 28th in a common year', () => {
    const inMonth = buildMonthGrid(2026, 2).filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(28);
    expect(inMonth[27].iso).toBe('2026-02-28');
  });

  it('spills into the next month across the year boundary', () => {
    // 31 Dec 2026 is a Thursday, so the grid runs on into January 2027.
    const grid = buildMonthGrid(2026, 12);
    expect(grid[grid.length - 1].iso).toBe('2027-01-10');
    expect(grid[grid.length - 1].inMonth).toBe(false);
  });

  it('keeps every cell one calendar day apart', () => {
    const grid = buildMonthGrid(2026, 1);
    for (let i = 1; i < grid.length; i++) {
      const prev = Date.parse(`${grid[i - 1].iso}T00:00:00Z`);
      const cur = Date.parse(`${grid[i].iso}T00:00:00Z`);
      expect(cur - prev).toBe(86400000);
    }
  });
});

describe('shiftMonth', () => {
  it('steps forward within a year', () => {
    expect(shiftMonth({ year: 2026, month: 9 }, 1)).toEqual({ year: 2026, month: 10 });
  });

  it('rolls over into the next year', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls back into the previous year', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('applyRangeTap', () => {
  it('sets the start when nothing is selected', () => {
    expect(applyRangeTap({ start: null, end: null }, '2026-09-12')).toEqual({
      start: '2026-09-12',
      end: null,
    });
  });

  it('sets the end when the second tap is after the start', () => {
    expect(applyRangeTap({ start: '2026-09-12', end: null }, '2026-09-19')).toEqual({
      start: '2026-09-12',
      end: '2026-09-19',
    });
  });

  it('makes a one-day trip when the second tap is the start itself', () => {
    expect(applyRangeTap({ start: '2026-09-12', end: null }, '2026-09-12')).toEqual({
      start: '2026-09-12',
      end: '2026-09-12',
    });
  });

  it('restarts from the earlier date when the second tap is before the start', () => {
    // Never produces end-before-start: the earlier tap simply becomes the new start.
    expect(applyRangeTap({ start: '2026-09-12', end: null }, '2026-09-05')).toEqual({
      start: '2026-09-05',
      end: null,
    });
  });

  it('restarts when a complete range is tapped again', () => {
    expect(applyRangeTap({ start: '2026-09-12', end: '2026-09-19' }, '2026-10-02')).toEqual({
      start: '2026-10-02',
      end: null,
    });
  });

  it('never yields an end earlier than its start', () => {
    const taps = ['2026-09-19', '2026-09-05', '2026-09-30', '2026-08-11', '2026-09-05'];
    let range = { start: null as string | null, end: null as string | null };
    for (const tap of taps) {
      range = applyRangeTap(range, tap);
      if (range.start && range.end) expect(range.end >= range.start).toBe(true);
    }
  });
});

describe('rangePosition', () => {
  it('reports no position when nothing is selected', () => {
    expect(rangePosition('2026-09-12', { start: null, end: null })).toBe('none');
  });

  it('reports a lone start as a single selection', () => {
    expect(rangePosition('2026-09-12', { start: '2026-09-12', end: null })).toBe('single');
  });

  it('reports a one-day range as a single selection', () => {
    expect(rangePosition('2026-09-12', { start: '2026-09-12', end: '2026-09-12' })).toBe('single');
  });

  it('distinguishes the two endpoints of a range', () => {
    const range = { start: '2026-09-12', end: '2026-09-19' };
    expect(rangePosition('2026-09-12', range)).toBe('start');
    expect(rangePosition('2026-09-19', range)).toBe('end');
  });

  it('reports days between the endpoints as middle', () => {
    const range = { start: '2026-09-12', end: '2026-09-19' };
    expect(rangePosition('2026-09-15', range)).toBe('middle');
  });

  it('reports days outside the range as none', () => {
    const range = { start: '2026-09-12', end: '2026-09-19' };
    expect(rangePosition('2026-09-11', range)).toBe('none');
    expect(rangePosition('2026-09-20', range)).toBe('none');
  });

  it('does not treat any day as middle while the end is still unset', () => {
    expect(rangePosition('2026-09-15', { start: '2026-09-12', end: null })).toBe('none');
  });
});

describe('formatRangeLabel', () => {
  it('returns null when no start is selected', () => {
    expect(formatRangeLabel({ start: null, end: null }, false)).toBeNull();
  });

  it('formats a lone start on its own', () => {
    expect(formatRangeLabel({ start: '2026-09-12', end: null }, false)).toBe('12 Sep 2026');
  });

  it('formats a one-day range as a single date', () => {
    expect(formatRangeLabel({ start: '2026-09-12', end: '2026-09-12' }, false)).toBe('12 Sep 2026');
  });

  it('joins the two endpoints of a range', () => {
    expect(formatRangeLabel({ start: '2026-09-12', end: '2026-09-19' }, false)).toBe(
      '12 Sep 2026 → 19 Sep 2026'
    );
  });

  it('formats in Chinese when asked', () => {
    expect(formatRangeLabel({ start: '2026-09-12', end: '2026-09-19' }, true)).toBe(
      '2026年9月12日 → 2026年9月19日'
    );
  });

  it('reads the day off the string rather than a local Date', () => {
    // `new Date('2026-01-01')` is midnight UTC, which is 31 Dec in any western timezone.
    // The label must name the day the user tapped, in every timezone.
    expect(formatRangeLabel({ start: '2026-01-01', end: null }, false)).toBe('1 Jan 2026');
  });
});

describe('formatDay', () => {
  it('formats one day in English without zero-padding', () => {
    expect(formatDay('2026-09-05', false)).toBe('5 Sep 2026');
  });

  it('formats one day in Chinese', () => {
    expect(formatDay('2026-09-05', true)).toBe('2026年9月5日');
  });
});

describe('formatMonthTitle', () => {
  it('names the month and year in English', () => {
    expect(formatMonthTitle({ year: 2026, month: 9 }, false)).toBe('September 2026');
  });

  it('names the month and year in Chinese', () => {
    expect(formatMonthTitle({ year: 2026, month: 9 }, true)).toBe('2026年9月');
  });

  it('handles the first and last months', () => {
    expect(formatMonthTitle({ year: 2026, month: 1 }, false)).toBe('January 2026');
    expect(formatMonthTitle({ year: 2026, month: 12 }, false)).toBe('December 2026');
  });
});

describe('initialCursor', () => {
  it("opens on the start's month when a range is set", () => {
    expect(initialCursor({ start: '2026-09-12', end: null }, new Date(2026, 5, 3))).toEqual({
      year: 2026,
      month: 9,
    });
  });

  it("opens on today's month when nothing is selected", () => {
    expect(initialCursor({ start: null, end: null }, new Date(2026, 5, 3))).toEqual({
      year: 2026,
      month: 6,
    });
  });
});

describe('todayIso', () => {
  it('formats the local calendar day, not the UTC one', () => {
    // 23:30 local on 31 Dec is already 1 Jan in UTC east of Greenwich; the picker
    // must still highlight 31 Dec as "today".
    expect(todayIso(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
  });

  it('zero-pads single-digit months and days', () => {
    expect(todayIso(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05');
  });
});
