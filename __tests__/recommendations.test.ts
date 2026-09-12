import {
  getTripNameRecommendations,
  getQuickAddRecommendations,
  extractLabelFromQuickAdd,
  extractBaseTripName,
  DEFAULT_QUICK_ADD_STARTERS_EN,
  DEFAULT_QUICK_ADD_STARTERS_ZH,
} from '../src/lib/recommendations';
import type { Transaction } from '../src/lib/types';
import type { Trip } from '../src/lib/trips';

const mockTxn = (merchantRaw: string, id: string): Transaction => ({
  id,
  merchantRaw,
  merchantKey: merchantRaw.toLowerCase(),
  amount: 25,
  currency: 'MYR',
  type: 'expense',
  date: '2026-09-01',
  categoryId: 'food',
  createdAt: '2026-09-01T12:00:00.000Z',
  source: 'manual',
});

const mockTrip = (name: string, id: string): Trip => ({
  id,
  name,
  archived: false,
  createdAt: '2026-09-01T12:00:00.000Z',
  startDate: '2026-09-01',
  endDate: '2026-09-05',
  icon: null,
});

describe('extractLabelFromQuickAdd', () => {
  it('extracts merchant label removing amounts and currency symbols', () => {
    expect(extractLabelFromQuickAdd('laksa 22')).toBe('Laksa');
    expect(extractLabelFromQuickAdd('Laksa 22.50')).toBe('Laksa');
    expect(extractLabelFromQuickAdd('22 laksa')).toBe('Laksa');
    expect(extractLabelFromQuickAdd('RM25 coffee')).toBe('Coffee');
    expect(extractLabelFromQuickAdd('grab rm 30')).toBe('Grab');
    expect(extractLabelFromQuickAdd('50 电影')).toBe('电影');
    expect(extractLabelFromQuickAdd('22')).toBe('');
    expect(extractLabelFromQuickAdd('')).toBe('');
  });
});

describe('extractBaseTripName', () => {
  it('extracts base trip name removing trailing years', () => {
    expect(extractBaseTripName('Serbia')).toBe('Serbia');
    expect(extractBaseTripName('Serbia 2026')).toBe('Serbia');
    expect(extractBaseTripName('Tokyo 2025')).toBe('Tokyo');
    expect(extractBaseTripName('Honeymoon')).toBe('Honeymoon');
    expect(extractBaseTripName('东京 2026')).toBe('东京');
  });
});

describe('getTripNameRecommendations', () => {
  it('returns popular destinations with current year when query is empty and no user trips', () => {
    const recs = getTripNameRecommendations([], '', false, 2026);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]).toEqual({ name: 'Tokyo 2026', destinationKey: 'jp', count: 0 });
    expect(recs.some((r) => r.name === 'Bangkok 2026')).toBe(true);
    expect(recs.some((r) => r.name === 'Singapore 2026')).toBe(true);
  });

  it('supports Chinese locale when query is empty', () => {
    const recs = getTripNameRecommendations([], '', true, 2026);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]).toEqual({ name: '东京 2026', destinationKey: 'jp', count: 0 });
    expect(recs.some((r) => r.name === '曼谷 2026')).toBe(true);
  });

  it('remembers unseen trips (e.g. Serbia) and places them in front ranked by frequency', () => {
    const trips: Trip[] = [
      mockTrip('Serbia', 't1'),
      mockTrip('Serbia', 't2'),
      mockTrip('Tokyo 2026', 't3'),
    ];
    // Serbia count=2, Tokyo count=1, others count=0
    const recs = getTripNameRecommendations(trips, '', false, 2026);
    expect(recs[0].name).toBe('Serbia 2026');
    expect(recs[0].count).toBe(2);
    expect(recs[0].destinationKey).toBeNull(); // Serbia has no destination landmark, falls back to generic pin

    expect(recs[1].name).toBe('Tokyo 2026');
    expect(recs[1].count).toBe(1);
    expect(recs[1].destinationKey).toBe('jp');
  });

  it('incorporates extra recorded frequencies for newly entered trips', () => {
    const extra = { serbia: 3 };
    const recs = getTripNameRecommendations([], '', false, 2026, extra);
    expect(recs[0].name).toBe('Serbia 2026');
    expect(recs[0].count).toBe(3);
  });

  it('filters destinations based on partial query', () => {
    const recs = getTripNameRecommendations([], 'tok', false, 2026);
    expect(recs.some((r) => r.name === 'Tokyo 2026')).toBe(true);
    expect(recs.some((r) => r.name === 'Bangkok 2026')).toBe(false);
  });

  it('filters destinations by Chinese query', () => {
    const recs = getTripNameRecommendations([], '曼谷', true, 2026);
    expect(recs.some((r) => r.name === '曼谷 2026')).toBe(true);
    expect(recs.some((r) => r.name === '东京 2026')).toBe(false);
  });

  it('omits exact match when full recommendation name is already typed', () => {
    const recs = getTripNameRecommendations([], 'Tokyo 2026', false, 2026);
    expect(recs.some((r) => r.name === 'Tokyo 2026')).toBe(false);
  });
});

describe('getQuickAddRecommendations', () => {
  it('returns default starters when user has no transactions and query is empty', () => {
    const recsEn = getQuickAddRecommendations([], '', false);
    expect(recsEn).toEqual(DEFAULT_QUICK_ADD_STARTERS_EN);

    const recsZh = getQuickAddRecommendations([], '', true);
    expect(recsZh).toEqual(DEFAULT_QUICK_ADD_STARTERS_ZH);
  });

  it('remembers newly entered items (e.g. Laksa) and ranks by frequency in the front', () => {
    // User entered laksa 22, so laksa has count 5, coffee has count 2
    const txns: Transaction[] = [
      mockTxn('Laksa', '1'),
      mockTxn('Laksa', '2'),
      mockTxn('Laksa', '3'),
      mockTxn('Laksa', '4'),
      mockTxn('Laksa', '5'),
      mockTxn('Coffee', '6'),
      mockTxn('Coffee', '7'),
    ];
    const recs = getQuickAddRecommendations(txns, '', false);
    expect(recs[0]).toBe('Laksa');
    expect(recs[1]).toBe('Coffee');
    expect(recs).toContain('Lunch');
  });

  it('incorporates extra frequencies recorded from quick add submissions', () => {
    const extra = { laksa: 1 };
    const recs = getQuickAddRecommendations([], '', false, extra);
    // Laksa has count 1, starters have count 0 -> Laksa is at index 0!
    expect(recs[0]).toBe('Laksa');
  });

  it('immediately returns empty array when input contains digits/numbers', () => {
    const txns = [mockTxn('Grab', '1'), mockTxn('Lunch', '2')];
    expect(getQuickAddRecommendations(txns, '1', false)).toEqual([]);
    expect(getQuickAddRecommendations(txns, 'Grab 1', false)).toEqual([]);
    expect(getQuickAddRecommendations(txns, 'Lunch 15', false)).toEqual([]);
    expect(getQuickAddRecommendations(txns, 'laksa 22', false)).toEqual([]);
  });

  it('filters matching labels when typing letters', () => {
    const txns = [mockTxn('Grab Food', '1'), mockTxn('Starbucks', '2')];
    const recs = getQuickAddRecommendations(txns, 'gra', false);
    expect(recs).toContain('Grab Food');
    expect(recs).toContain('Grab');
    expect(recs).not.toContain('Starbucks');
  });

  it('omits exact match when user has already typed the exact label', () => {
    const recs = getQuickAddRecommendations([], 'lunch', false);
    expect(recs).not.toContain('Lunch');
  });
});
