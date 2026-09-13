import {
  computeStreak,
  computeWeekRing,
  compute7DayDots,
  localDayNumber,
  type StreakInput,
} from '../src/lib/streak';
import { getCheckInDays, recordCheckIn, removeCheckIn, DAILY_CHECKINS_KEY } from '../src/db/checkinRepo';
import { getMeta, setMeta } from '../src/db/metaRepo';

jest.mock('../src/db/metaRepo', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn(),
}));

function d(daysAgo: number, now: Date = new Date()): string {
  const dt = new Date(now);
  dt.setDate(dt.getDate() - daysAgo);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('Streak Check-in & Mindful No-Spend', () => {
  const baseNow = new Date('2026-09-13T12:00:00Z');

  describe('Pure Streak Calculation with Check-ins', () => {
    it('is 1 for a single no-spend check-in today with no transactions', () => {
      const checkIns = { [d(0, baseNow)]: 'no_spend' as const };
      expect(computeStreak([], baseNow, 1, checkIns)).toBe(1);
    });

    it('counts consecutive days formed solely by check-ins', () => {
      const checkIns = {
        [d(0, baseNow)]: 'no_spend' as const,
        [d(1, baseNow)]: 'review' as const,
        [d(2, baseNow)]: 'no_spend' as const,
      };
      expect(computeStreak([], baseNow, 1, checkIns)).toBe(3);
    });

    it('counts mixed transactions and check-ins seamlessly', () => {
      const txns: StreakInput[] = [
        { date: d(0, baseNow), createdAt: `${d(0, baseNow)}T10:00:00Z` },
        { date: d(2, baseNow), createdAt: `${d(2, baseNow)}T10:00:00Z` },
      ];
      const checkIns = {
        [d(1, baseNow)]: 'no_spend' as const,
      };
      // Day 0 (txn), Day 1 (checkin), Day 2 (txn) => 3-day unbroken streak
      expect(computeStreak(txns, baseNow, 1, checkIns)).toBe(3);
    });

    it('maintains streak across grace day even if one day had neither', () => {
      const checkIns = {
        [d(0, baseNow)]: 'no_spend' as const,
        // Day 1 missing (bridged by 1-day grace)
        [d(2, baseNow)]: 'review' as const,
      };
      expect(computeStreak([], baseNow, 1, checkIns)).toBe(2);
    });
  });

  describe('computeWeekRing with Kinds', () => {
    it('distinguishes between spend and checkin days', () => {
      const todayStr = d(0, baseNow);
      const yesterdayStr = d(1, baseNow);

      const txns: StreakInput[] = [
        { date: yesterdayStr, createdAt: `${yesterdayStr}T10:00:00Z` },
      ];
      const checkIns = {
        [todayStr]: 'no_spend' as const,
      };

      const result = computeWeekRing(txns, baseNow, checkIns);
      expect(result.days[result.todayIndex]).toBe(true);
      expect(result.kinds[result.todayIndex]).toBe('checkin');

      // Yesterday should be 'spend'
      const yIndex = result.todayIndex - 1;
      if (yIndex >= 0) {
        expect(result.days[yIndex]).toBe(true);
        expect(result.kinds[yIndex]).toBe('spend');
      }
    });

    it('seamlessly upgrades check-in day to spend day if transaction exists on same day', () => {
      const todayStr = d(0, baseNow);
      const txns: StreakInput[] = [
        { date: todayStr, createdAt: `${todayStr}T18:00:00Z` },
      ];
      // User previously checked in as no_spend, but later added an expense
      const checkIns = {
        [todayStr]: 'no_spend' as const,
      };

      const result = computeWeekRing(txns, baseNow, checkIns);
      expect(result.days[result.todayIndex]).toBe(true);
      expect(result.kinds[result.todayIndex]).toBe('spend');
    });
  });

  describe('compute7DayDots with Check-ins', () => {
    it('marks check-in days as active in 7-day dots', () => {
      const checkIns = { [d(0, baseNow)]: 'no_spend' as const };
      const dots = compute7DayDots([], baseNow, checkIns);
      // Index 6 is today
      expect(dots[6]).toBe(true);
      expect(dots[5]).toBe(false);
    });
  });

  describe('checkinRepo storage', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns empty object when no metadata stored', async () => {
      (getMeta as jest.Mock).mockResolvedValue(null);
      const res = await getCheckInDays();
      expect(res).toEqual({});
      expect(getMeta).toHaveBeenCalledWith(DAILY_CHECKINS_KEY);
    });

    it('records a new check-in and persists to meta', async () => {
      (getMeta as jest.Mock).mockResolvedValue(JSON.stringify({ '2026-09-12': 'no_spend' }));
      const updated = await recordCheckIn('2026-09-13', 'review');
      expect(updated).toEqual({
        '2026-09-12': 'no_spend',
        '2026-09-13': 'review',
      });
      expect(setMeta).toHaveBeenCalledWith(
        DAILY_CHECKINS_KEY,
        JSON.stringify({ '2026-09-12': 'no_spend', '2026-09-13': 'review' })
      );
    });

    it('removes a check-in properly', async () => {
      (getMeta as jest.Mock).mockResolvedValue(JSON.stringify({ '2026-09-12': 'no_spend', '2026-09-13': 'review' }));
      const updated = await removeCheckIn('2026-09-12');
      expect(updated).toEqual({ '2026-09-13': 'review' });
      expect(setMeta).toHaveBeenCalledWith(DAILY_CHECKINS_KEY, JSON.stringify({ '2026-09-13': 'review' }));
    });
  });
});
