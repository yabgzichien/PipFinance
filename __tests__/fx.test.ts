// __tests__/fx.test.ts
import { ratesFromCache, rateFor, isStale, staleLabel, FX_STALE_MS, type FxRate } from '../src/lib/fx';

function rate(over: Partial<FxRate>): FxRate {
  return { code: 'CNY', rateMyr: 0.63, asOf: '2026-08-23T00:00:00.000Z', ...over };
}

describe('ratesFromCache', () => {
  it('builds a code to rate lookup', () => {
    const rows = [rate({ code: 'CNY', rateMyr: 0.63 }), rate({ code: 'USD', rateMyr: 4.4 })];
    expect(ratesFromCache(rows)).toEqual({ CNY: 0.63, USD: 4.4 });
  });

  it('drops non-positive rates, which would silently zero out a balance', () => {
    expect(ratesFromCache([rate({ code: 'CNY', rateMyr: 0 })])).toEqual({});
    expect(ratesFromCache([rate({ code: 'CNY', rateMyr: -1 })])).toEqual({});
  });

  it('returns an empty table for no rows', () => {
    expect(ratesFromCache([])).toEqual({});
  });
});

describe('rateFor', () => {
  it('always returns exactly 1 for the base currency, never a table lookup', () => {
    expect(rateFor({}, 'MYR')).toBe(1);
    expect(rateFor({ MYR: 0.5 }, 'MYR')).toBe(1);
  });

  it('returns the cached rate for a foreign currency', () => {
    expect(rateFor({ CNY: 0.63 }, 'CNY')).toBe(0.63);
  });

  it('returns null rather than 1 when the rate is missing', () => {
    expect(rateFor({}, 'CNY')).toBeNull();
  });
});

describe('isStale', () => {
  const now = new Date('2026-08-23T12:00:00.000Z');

  it('is fresh within 24 hours', () => {
    expect(isStale('2026-08-23T06:00:00.000Z', now)).toBe(false);
  });

  it('is stale past 24 hours', () => {
    expect(isStale('2026-08-21T06:00:00.000Z', now)).toBe(true);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isStale('not a date', now)).toBe(true);
  });

  it('uses a 24 hour window', () => {
    expect(FX_STALE_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('staleLabel', () => {
  it('renders a short human date for the net worth hint', () => {
    expect(staleLabel('2026-08-12T06:00:00.000Z')).toBe('rate 12 Aug');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(staleLabel('nope')).toBe('');
  });
});
