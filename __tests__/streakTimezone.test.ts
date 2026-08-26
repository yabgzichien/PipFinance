// Regression: the streak is counted in *local* calendar days, because that is what
// `todayKey()` writes into `transactions.txn_date`. Anywhere ahead of UTC (Malaysia is
// UTC+8) there is a window every night — local midnight until the UTC day rolls over —
// where the local date is already tomorrow. A log made in that window must still count.
process.env.TZ = 'Asia/Kuala_Lumpur';

import { computeStreak, lastActiveDay, localDayNumber, streakStartDay } from '../src/lib/streak';
import type { StreakInput } from '../src/lib/streak';

/** 00:30 local on 24 Aug 2026 in KL, which is still 23 Aug in UTC. */
const AFTER_MIDNIGHT = new Date('2026-08-23T16:30:00.000Z');
/** Mid-afternoon the same local day, when local and UTC agree. */
const AFTERNOON = new Date('2026-08-24T07:00:00.000Z');

function log(date: string): StreakInput {
  return { date, createdAt: `${date}T00:30:00.000Z`, source: 'manual' };
}

describe('local-day framing', () => {
  it('reads the local calendar day, not the UTC one, after local midnight', () => {
    expect(localDayNumber(AFTER_MIDNIGHT)).toBe(localDayNumber(AFTERNOON));
  });
});

describe('logging after local midnight', () => {
  it('counts a log dated today when the UTC day has not rolled over yet', () => {
    const txns = [log('2026-08-24')];
    expect(lastActiveDay(txns, AFTER_MIDNIGHT)).not.toBeNull();
    expect(computeStreak(txns, AFTER_MIDNIGHT)).toBe(1);
  });

  it('the fresh log actually contributes: with it the streak is longer than without', () => {
    const withFresh = [log('2026-08-22'), log('2026-08-23'), log('2026-08-24')];
    const withoutFresh = [log('2026-08-22'), log('2026-08-23')];
    expect(computeStreak(withFresh, AFTER_MIDNIGHT)).toBe(3);
    expect(computeStreak(withoutFresh, AFTER_MIDNIGHT)).toBe(2);
  });

  it('a night owl logging at 00:30 three nights running has a streak of 3', () => {
    const txns = [log('2026-08-22'), log('2026-08-23'), log('2026-08-24')];
    expect(computeStreak(txns, AFTER_MIDNIGHT)).toBe(computeStreak(txns, AFTERNOON));
  });

  it('the run start is the same whether read after midnight or in the afternoon', () => {
    const txns = [log('2026-08-22'), log('2026-08-23'), log('2026-08-24')];
    expect(streakStartDay(txns, AFTER_MIDNIGHT)).toBe(streakStartDay(txns, AFTERNOON));
  });

  it('still refuses a genuinely future-dated log', () => {
    const txns = [log('2026-08-24'), log('2027-01-01')];
    expect(lastActiveDay(txns, AFTER_MIDNIGHT)).toBe(localDayNumber(AFTER_MIDNIGHT));
  });
});
