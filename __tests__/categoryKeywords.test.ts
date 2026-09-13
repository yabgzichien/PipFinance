import { guessCategoryByKeyword } from '../src/lib/categoryKeywords';
import type { Category } from '../src/lib/types';

function cat(over: Partial<Category> & { id: string }): Category {
  return {
    label: over.id,
    icon: 'dots',
    hue: 0,
    kind: 'expense',
    isDefault: true,
    isHidden: false,
    templateKey: null,
    labelOverride: null,
    iconOverride: null,
    hueOverride: null,
    ...over,
  };
}

const DEFAULT_CATEGORIES: Category[] = [
  cat({ id: 'food' }),
  cat({ id: 'travelling' }),
  cat({ id: 'entertainment' }),
  cat({ id: 'shopping' }),
  cat({ id: 'rental' }),
  cat({ id: 'phone-bill' }),
  cat({ id: 'insurance' }),
  cat({ id: 'other' }),
  cat({ id: 'salary', kind: 'income' }),
];

describe('guessCategoryByKeyword', () => {
  it('matches everyday food words to the default Food category', () => {
    for (const label of ['lunch', 'dinner', 'breakfast', 'coffee', 'groceries']) {
      expect(guessCategoryByKeyword(label, 'expense', DEFAULT_CATEGORIES)).toBe('food');
    }
  });

  it('matches everyday transport words to Transport', () => {
    expect(guessCategoryByKeyword('grab', 'expense', DEFAULT_CATEGORIES)).toBe('travelling');
    expect(guessCategoryByKeyword('petrol', 'expense', DEFAULT_CATEGORIES)).toBe('travelling');
  });

  it('matches everyday laundry and service words to Other Expenses', () => {
    for (const label of ['laundry', 'dobi', 'dry clean', 'laundromat', 'barber', 'haircut', '洗衣', '干洗', '快递']) {
      expect(guessCategoryByKeyword(label, 'expense', DEFAULT_CATEGORIES)).toBe('other');
    }
  });

  it('is case-insensitive', () => {
    expect(guessCategoryByKeyword('LUNCH', 'expense', DEFAULT_CATEGORIES)).toBe('food');
  });

  it('is resilient to typos in everyday words (e.g. luch, diner, brekfast, coffe, petro)', () => {
    expect(guessCategoryByKeyword('luch', 'expense', DEFAULT_CATEGORIES)).toBe('food');
    expect(guessCategoryByKeyword('diner', 'expense', DEFAULT_CATEGORIES)).toBe('food');
    expect(guessCategoryByKeyword('brekfast', 'expense', DEFAULT_CATEGORIES)).toBe('food');
    expect(guessCategoryByKeyword('coffe', 'expense', DEFAULT_CATEGORIES)).toBe('food');
    expect(guessCategoryByKeyword('petro', 'expense', DEFAULT_CATEGORIES)).toBe('travelling');
  });

  it('does not false-positive on a word merely containing a keyword', () => {
    // "grab" must not match inside "grabride" — no word boundary between them.
    expect(guessCategoryByKeyword('grabride', 'expense', DEFAULT_CATEGORIES)).toBeNull();
  });

  it('returns null for a label with no known keyword', () => {
    expect(guessCategoryByKeyword('mystery item', 'expense', DEFAULT_CATEGORIES)).toBeNull();
  });

  it('returns null for an empty label', () => {
    expect(guessCategoryByKeyword('', 'expense', DEFAULT_CATEGORIES)).toBeNull();
  });

  it('only matches categories of the requested kind', () => {
    // "salary" the category exists, but "lunch" is not one of its keywords, and even a food
    // word must not resolve to an income category.
    expect(guessCategoryByKeyword('lunch', 'income', DEFAULT_CATEGORIES)).toBeNull();
  });

  it('never suggests a hidden category', () => {
    const hidden = DEFAULT_CATEGORIES.map((c) => (c.id === 'food' ? { ...c, isHidden: true } : c));
    expect(guessCategoryByKeyword('lunch', 'expense', hidden)).toBeNull();
  });

  it('prefers an activated optional category over the generic default when both could match', () => {
    const withEatingOut = [
      ...DEFAULT_CATEGORIES,
      cat({ id: 'opt-eating-out' }),
    ];
    // "restaurant" is an alias of the optional Eating Out category but not a Food keyword.
    expect(guessCategoryByKeyword('restaurant', 'expense', withEatingOut)).toBe('opt-eating-out');
  });
});
