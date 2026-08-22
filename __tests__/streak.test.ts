import {
  computeStreak,
  computeStreakPaused,
  computeStreakWithFreeze,
  computeWeekRing,
  ensureMonthlyFreeze,
  isStreakGraduated,
  lastActiveDay,
  NO_STREAK_FREEZE,
  STREAK_GRADUATION_DAYS,
  streakStartDay,
  type StreakFreezeState,
  type StreakInput,
} from '../src/lib/streak';

const NOW = new Date('2026-06-10T12:00:00.000Z');

function day(offset: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function t(offset: number, source: StreakInput['source'] = 'extracted'): StreakInput {
  return { date: day(offset), createdAt: day(offset) + 'T09:00:00Z', source };
}

describe('lastActiveDay', () => {
  const todayUtc = Math.floor(NOW.getTime() / 86_400_000);

  it('returns null for an empty transaction list', () => {
    expect(lastActiveDay([], NOW)).toBeNull();
  });

  it('returns the UTC day number for a transaction today', () => {
    expect(lastActiveDay([t(0)], NOW)).toBe(todayUtc);
  });

  it('returns the day number of the most recent activity among several', () => {
    expect(lastActiveDay([t(5), t(2), t(7)], NOW)).toBe(todayUtc - 2);
  });

  it('ignores future-dated rows', () => {
    // Offset -1 is tomorrow
    expect(lastActiveDay([t(-1), t(1)], NOW)).toBe(todayUtc - 1);
  });

  it('prefers date over createdAt when both are present', () => {
    const txn: StreakInput = {
      date: day(3),
      createdAt: day(1) + 'T09:00:00Z',
    };
    expect(lastActiveDay([txn], NOW)).toBe(todayUtc - 3);
  });

  it('falls back to createdAt when date is absent or null', () => {
    const txn: StreakInput = {
      date: null,
      createdAt: day(2) + 'T10:00:00Z',
    };
    expect(lastActiveDay([txn], NOW)).toBe(todayUtc - 2);
  });
});

describe('computeStreak', () => {
  it('is 0 for no transactions', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it('is 1 for a single transaction today', () => {
    expect(computeStreak([t(0)], NOW)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak([t(0), t(1), t(2)], NOW)).toBe(3);
  });

  it('counts multiple transactions on the same day once', () => {
    expect(computeStreak([t(0), t(0), t(1)], NOW)).toBe(2);
  });

  it('allows a one-day gap (grace)  recording every two days keeps the streak alive', () => {
    expect(computeStreak([t(0), t(2), t(4)], NOW)).toBe(3);
  });

  it('breaks the streak when a gap exceeds the grace window', () => {
    // today + 4 days ago: gap of 4 breaks → only today counts
    expect(computeStreak([t(0), t(4)], NOW)).toBe(1);
  });

  it('is 0 when the most recent activity is older than the grace window (lapsed)', () => {
    expect(computeStreak([t(3), t(4)], NOW)).toBe(0);
  });

  it('stays alive when last activity was yesterday or two days ago', () => {
    expect(computeStreak([t(1), t(2)], NOW)).toBe(2);
  });

  it('counts manual entries too (streak is motivation, not a credit signal)', () => {
    expect(computeStreak([t(0, 'manual'), t(1, 'manual')], NOW)).toBe(2);
  });
});

describe('ensureMonthlyFreeze', () => {
  const june = new Date(2026, 5, 15, 9, 0, 0);
  const july = new Date(2026, 6, 1, 9, 0, 0);

  it('grants a freeze for a month with no prior grant', () => {
    const state = ensureMonthlyFreeze(NO_STREAK_FREEZE, june);
    expect(state).toEqual({ grantedMonth: '2026-06', available: true, spentForLastDay: null });
  });

  it('is a no-op if already granted this month, spent or not', () => {
    const granted = ensureMonthlyFreeze(NO_STREAK_FREEZE, june);
    expect(ensureMonthlyFreeze(granted, june)).toBe(granted);
    const spent: StreakFreezeState = { ...granted, available: false, spentForLastDay: 12345 };
    expect(ensureMonthlyFreeze(spent, june)).toBe(spent);
  });

  it('grants again once the month rolls over', () => {
    const spentInJune: StreakFreezeState = { grantedMonth: '2026-06', available: false, spentForLastDay: 12345 };
    const state = ensureMonthlyFreeze(spentInJune, july);
    expect(state).toEqual({ grantedMonth: '2026-07', available: true, spentForLastDay: null });
  });
});

describe('computeStreakWithFreeze', () => {
  it('behaves exactly like computeStreak when no freeze is needed', () => {
    const result = computeStreakWithFreeze([t(0), t(1)], NO_STREAK_FREEZE, NOW);
    expect(result).toEqual({ streak: 2, freezeSpent: false });
  });

  it('is 0, unspent, when nothing is banked and the gap is too wide', () => {
    const result = computeStreakWithFreeze([t(3), t(4)], NO_STREAK_FREEZE, NOW);
    expect(result).toEqual({ streak: 0, freezeSpent: false });
  });

  it('bridges exactly one missed day when a freeze is available', () => {
    // last active 3 days ago: grace already covers a 2-day gap (maxGap=2), so this is the
    // one-day-further case only a freeze can save.
    const available: StreakFreezeState = { grantedMonth: '2026-06', available: true, spentForLastDay: null };
    const result = computeStreakWithFreeze([t(3), t(4)], available, NOW);
    expect(result.streak).toBe(2);
    expect(result.freezeSpent).toBe(true);
  });

  it('does not report freezeSpent again once spentForLastDay already covers this gap', () => {
    const lastDay = lastActiveDay([t(3)], NOW)!;
    const alreadySpent: StreakFreezeState = { grantedMonth: '2026-06', available: false, spentForLastDay: lastDay };
    const result = computeStreakWithFreeze([t(3), t(4)], alreadySpent, NOW);
    expect(result.streak).toBe(2);
    expect(result.freezeSpent).toBe(false);
  });

  it('does not bridge a gap wider than one extra day, even with a freeze available', () => {
    const available: StreakFreezeState = { grantedMonth: '2026-06', available: true, spentForLastDay: null };
    const result = computeStreakWithFreeze([t(5)], available, NOW);
    expect(result).toEqual({ streak: 0, freezeSpent: false });
  });

  it('returns unspent for an empty transaction list', () => {
    const available: StreakFreezeState = { grantedMonth: '2026-06', available: true, spentForLastDay: null };
    expect(computeStreakWithFreeze([], available, NOW)).toEqual({ streak: 0, freezeSpent: false });
  });
});

describe('isStreakGraduated', () => {
  it('is false below the threshold', () => {
    expect(isStreakGraduated(STREAK_GRADUATION_DAYS - 1)).toBe(false);
  });
  it('is true at and above the threshold', () => {
    expect(isStreakGraduated(STREAK_GRADUATION_DAYS)).toBe(true);
    expect(isStreakGraduated(STREAK_GRADUATION_DAYS + 10)).toBe(true);
  });
});

describe('streakStartDay', () => {
  it('is null when there is no active run', () => {
    expect(streakStartDay([], NOW)).toBeNull();
    expect(streakStartDay([t(5)], NOW)).toBeNull();
  });

  it('is the earliest day of the current unbroken run', () => {
    const start = streakStartDay([t(0), t(1), t(2)], NOW);
    const expected = lastActiveDay([t(2)], NOW);
    expect(start).toBe(expected);
  });

  it('stops at the first gap wider than the grace window', () => {
    // t(0..2) form one run; t(6) is a separate, older run beyond the grace window.
    const start = streakStartDay([t(0), t(1), t(2), t(6)], NOW);
    const expected = lastActiveDay([t(2)], NOW);
    expect(start).toBe(expected);
  });
});

describe('computeStreakPaused', () => {
  it('matches computeStreak when not paused', () => {
    expect(computeStreakPaused([t(0), t(1)], null, NOW)).toBe(computeStreak([t(0), t(1)], NOW));
  });

  it('freezes the streak at the value it held when the pause began', () => {
    const pauseDay = Math.floor(NOW.getTime() / 86_400_000);
    // No activity at all during or after the pause  a naive `computeStreak(now)` would lapse,
    // but the pause should still report the streak as it stood at the pause moment.
    const paused = computeStreakPaused([t(0), t(1)], pauseDay, NOW);
    expect(paused).toBe(2);
  });

  it('does not retroactively forgive a gap that predates the pause', () => {
    const pauseDay = Math.floor(NOW.getTime() / 86_400_000);
    // Last activity 5 days before the pause moment: already lapsed by the time pause began.
    const paused = computeStreakPaused([t(5)], pauseDay, NOW);
    expect(paused).toBe(0);
  });
});

describe('computeWeekRing', () => {
  const monday = new Date(2026, 5, 8, 9, 0, 0); // Monday
  const wednesday = new Date(2026, 5, 10, 9, 0, 0);

  function localDay(base: Date, offset: number): StreakInput {
    const d = new Date(base);
    d.setDate(d.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${day}`, createdAt: `${y}-${m}-${day}T09:00:00Z` };
  }

  it('places today at index 0 on a Monday', () => {
    const { days, todayIndex } = computeWeekRing([localDay(monday, 0)], monday);
    expect(todayIndex).toBe(0);
    expect(days).toEqual([true, false, false, false, false, false, false]);
  });

  it('marks logged days true and leaves the rest of the week (including future days) false', () => {
    // Wednesday: Mon logged, Tue not, Wed (today) logged. Thu-Sun haven't happened yet.
    const { days, todayIndex } = computeWeekRing([localDay(wednesday, 2), localDay(wednesday, 0)], wednesday);
    expect(todayIndex).toBe(2);
    expect(days).toEqual([true, false, true, false, false, false, false]);
  });

  it('returns all-false for an empty transaction list', () => {
    const { days } = computeWeekRing([], monday);
    expect(days).toEqual([false, false, false, false, false, false, false]);
  });
});

