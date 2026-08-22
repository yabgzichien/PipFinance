import { autoFillStats, suggestByKey, suggestForMerchant } from '../src/lib/recommend';
import type { CategorySuggestion, MemoryMap } from '../src/lib/types';

const MEMORY: MemoryMap = {
  tealive: 'coffee',
  grab: 'transport',
  'automobile innovative': 'fuel',
};

describe('suggestByKey', () => {
  it('returns the learned category on a hit', () => {
    expect(suggestByKey(MEMORY, 'grab')).toBe('transport');
  });

  it('returns null on a miss', () => {
    expect(suggestByKey(MEMORY, 'senheng')).toBeNull();
  });
});

describe('suggestForMerchant', () => {
  it('normalizes the raw label before lookup', () => {
    expect(suggestForMerchant(MEMORY, '  TEALIVE ')).toBe('coffee');
    expect(suggestForMerchant(MEMORY, 'Automobile Innovative')).toBe('fuel');
  });

  it('matches the learning loop from the brief (Automobile Innovative -> Fuel)', () => {
    expect(suggestForMerchant(MEMORY, 'AUTOMOBILE INNOVATIVE')).toBe('fuel');
  });

  it('returns null for an unseen merchant', () => {
    expect(suggestForMerchant(MEMORY, 'Nandos')).toBeNull();
  });
});

describe('autoFillStats', () => {
  it('counts learned-source suggestions as filled, out of the total lines', () => {
    const suggestions: (CategorySuggestion | null)[] = [
      { categoryId: 'coffee', source: 'learned' },
      { categoryId: 'transport', source: 'learned' },
      { categoryId: 'fuel', source: 'guess' },
      null,
    ];
    expect(autoFillStats(suggestions)).toEqual({ filled: 2, total: 4 });
  });

  it('returns zero filled when nothing was learned', () => {
    const suggestions: (CategorySuggestion | null)[] = [{ categoryId: 'fuel', source: 'guess' }, null];
    expect(autoFillStats(suggestions)).toEqual({ filled: 0, total: 2 });
  });

  it('returns all-filled when every line matched memory', () => {
    const suggestions: (CategorySuggestion | null)[] = [
      { categoryId: 'coffee', source: 'learned' },
      { categoryId: 'fuel', source: 'learned' },
    ];
    expect(autoFillStats(suggestions)).toEqual({ filled: 2, total: 2 });
  });

  it('handles an empty scan', () => {
    expect(autoFillStats([])).toEqual({ filled: 0, total: 0 });
  });
});
