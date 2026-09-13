import React from 'react';
const TestRenderer = require('react-test-renderer');
import { ExtractScreen } from '../src/screens/ExtractScreen';
import type { ExtractedTxn, Category } from '../src/lib/types';
import { merchantKey } from '../src/lib/normalize';
import { resolveSuggestion } from '../src/lib/categorySuggestion';
import { guessCategoryByKeyword } from '../src/lib/categoryKeywords';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../src/state/accent', () => ({
  useAccent: () => ({ accent: '#1f8a5b', accentSoft: '#34d399', accentInk: '#1f8a5b', accentTint: '#e6f4ea' }),
}));

jest.mock('../src/state/colorScheme', () => ({
  useThemeColors: () => ({
    bg: '#ffffff',
    surface: '#f9fafb',
    surface2: '#f3f4f6',
    ink: '#111827',
    ink2: '#4b5563',
    ink3: '#9ca3af',
    line: '#e5e7eb',
    line2: '#d1d5db',
  }),
}));

jest.mock('../src/state/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../src/i18n', () => ({
  useLanguage: () => ({
    isZh: false,
    t: (k: string) => k,
    tCat: (c: any) => c.label,
  }),
}));

const mockEnsureDefaultAccount = jest.fn().mockResolvedValue('cash-acct');
jest.mock('../src/state/store', () => ({
  useAppData: () => ({
    memory: {},
    catById: {
      food: { id: 'food', label: 'Food', kind: 'expense' },
      groceries: { id: 'groceries', label: 'Groceries', kind: 'expense' },
      transport: { id: 'transport', label: 'Transport', kind: 'expense' },
    },
    accounts: [{ id: 'cash-acct', name: 'Cash', cls: 'cash', is_hidden: 0, archived: 0 }],
    ensureDefaultAccount: mockEnsureDefaultAccount,
  }),
}));

describe('ExtractScreen onItemsExtracted callback', () => {
  it('calls onItemsExtracted when cachedItems are passed', async () => {
    const onItemsExtracted = jest.fn();
    const mockItems: ExtractedTxn[] = [
      { merchant: 'Grab', amount: 15, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
    ];

    await TestRenderer.act(async () => {
      TestRenderer.create(
        <ExtractScreen
          image={{ uri: 'file:///test.png', base64: '', mime: 'image/png' }}
          cachedItems={mockItems}
          onBack={jest.fn()}
          onDone={jest.fn()}
          onItemsExtracted={onItemsExtracted}
        />
      );
      await Promise.resolve();
    });

    expect(onItemsExtracted).toHaveBeenCalledWith(mockItems);
  });
});

describe('Category guess prefetch & deduplication logic', () => {
  const categories: Category[] = [
    { id: 'food', label: 'Food', kind: 'expense', icon: 'utensils', hue: 20, isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
    { id: 'groceries', label: 'Groceries', kind: 'expense', icon: 'shopping-cart', hue: 30, isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
    { id: 'transport', label: 'Transport', kind: 'expense', icon: 'car', hue: 40, isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  ];
  const catById: Record<string, any> = {
    food: categories[0],
    groceries: categories[1],
    transport: categories[2],
  };
  const memory = {
    grab: 'transport', // known in memory
  };

  it('deduplicates missing merchants before invoking category guessing', async () => {
    // 5 transactions:
    // - 2 Grab (known in memory)
    // - 2 Mystery Shop A (unknown, needs LLM guess)
    // - 1 Mystery Shop B (unknown, needs LLM guess)
    const items: ExtractedTxn[] = [
      { merchant: 'Grab', amount: 12, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
      { merchant: 'Mystery Shop A', amount: 15, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
      { merchant: 'Grab', amount: 20, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
      { merchant: 'Mystery Shop A', amount: 8, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
      { merchant: 'Mystery Shop B', amount: 80, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
    ];

    // Simulate prefetch logic
    const learnedMap = new Map<string, any>();
    const suggestionsMap = new Map<string, any>();
    const missingItems: { item: ExtractedTxn; cacheKey: string }[] = [];
    const seenMissingKeys = new Set<string>();

    items.forEach((it) => {
      const key = merchantKey(it.merchant);
      const cacheKey = `${it.type}:${key}`;
      if (!learnedMap.has(cacheKey)) {
        const keywordGuess = guessCategoryByKeyword(it.merchant, it.type, categories);
        const suggestion = resolveSuggestion(key, memory, categories, keywordGuess);
        const cat = suggestion ? catById[suggestion.categoryId] : undefined;
        const valid = cat && cat.kind === it.type ? suggestion : null;
        learnedMap.set(cacheKey, valid);
        if (valid) {
          suggestionsMap.set(cacheKey, valid);
        }
      }

      const currentLearned = learnedMap.get(cacheKey);
      if (!currentLearned && !seenMissingKeys.has(cacheKey)) {
        seenMissingKeys.add(cacheKey);
        missingItems.push({ item: it, cacheKey });
      }
    });

    // Only 2 unique missing merchants (Mystery Shop A and Mystery Shop B) should be queried, not 3
    expect(missingItems).toHaveLength(2);
    expect(missingItems.map((m) => m.item.merchant)).toEqual(['Mystery Shop A', 'Mystery Shop B']);

    // Mock LLM guess response
    const mockGuessed: Record<number, string | null> = {
      0: 'food',      // Mystery Shop A -> food
      1: 'groceries', // Mystery Shop B -> groceries
    };

    missingItems.forEach((m, idx) => {
      const guessedCatId = mockGuessed[idx] ?? null;
      const resolved = resolveSuggestion(merchantKey(m.item.merchant), {}, categories, guessedCatId);
      suggestionsMap.set(m.cacheKey, resolved);
    });

    // Verify that mapping back to the original 5 items produces correct suggestions for all 5
    const finalSuggestions = items.map((it) => {
      const cacheKey = `${it.type}:${merchantKey(it.merchant)}`;
      return suggestionsMap.get(cacheKey) ?? null;
    });

    expect(finalSuggestions[0]).toEqual({ categoryId: 'transport', source: 'learned' });
    expect(finalSuggestions[1]).toEqual({ categoryId: 'food', source: 'guess' });
    expect(finalSuggestions[2]).toEqual({ categoryId: 'transport', source: 'learned' });
    expect(finalSuggestions[3]).toEqual({ categoryId: 'food', source: 'guess' });
    expect(finalSuggestions[4]).toEqual({ categoryId: 'groceries', source: 'guess' });
  });

  it('correctly maps prefetched suggestions even when rows are deleted', () => {
    const suggestionsMap = new Map<string, any>([
      [`expense:${merchantKey('Grab')}`, { categoryId: 'transport', source: 'learned' }],
      [`expense:${merchantKey('Mystery Shop A')}`, { categoryId: 'food', source: 'guess' }],
      [`expense:${merchantKey('Mystery Shop B')}`, { categoryId: 'groceries', source: 'guess' }],
    ]);

    // Suppose user deleted the Mystery Shop A items on ExtractScreen:
    const remainingItems: ExtractedTxn[] = [
      { merchant: 'Grab', amount: 12, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
      { merchant: 'Mystery Shop B', amount: 80, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR' },
    ];

    const finalSuggestions = remainingItems.map((it) => {
      const cacheKey = `${it.type}:${merchantKey(it.merchant)}`;
      return suggestionsMap.get(cacheKey) ?? null;
    });

    expect(finalSuggestions).toHaveLength(2);
    expect(finalSuggestions[0]).toEqual({ categoryId: 'transport', source: 'learned' });
    expect(finalSuggestions[1]).toEqual({ categoryId: 'groceries', source: 'guess' });
  });

  it('eliminates 2nd LLM call when single-pass extraction provides valid categoryHint', () => {
    const { matchSourceCategory } = require('../src/lib/import');
    const items: ExtractedTxn[] = [
      { merchant: 'KFC', amount: 25, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR', categoryHint: 'food' },
      { merchant: 'MRT', amount: 5, type: 'expense', date: '2026-09-12', method: null, currency: 'MYR', categoryHint: 'transport' },
    ];

    const learnedMap = new Map<string, any>();
    const suggestionsMap = new Map<string, any>();
    const missingItems: { item: ExtractedTxn; cacheKey: string }[] = [];
    const seenMissingKeys = new Set<string>();

    items.forEach((it) => {
      const key = merchantKey(it.merchant);
      const cacheKey = `${it.type}:${key}`;
      if (!suggestionsMap.has(cacheKey)) {
        const keywordGuess = guessCategoryByKeyword(it.merchant, it.type, categories);
        const suggestion = resolveSuggestion(key, {}, categories, keywordGuess);
        const cat = suggestion ? catById[suggestion.categoryId] : undefined;
        let valid = cat && cat.kind === it.type ? suggestion : null;
        if (!valid && it.categoryHint) {
          const hintedId = matchSourceCategory(it.categoryHint, categories, it.type);
          if (hintedId) {
            valid = { categoryId: hintedId, source: 'guess' };
          }
        }
        learnedMap.set(cacheKey, valid?.source === 'learned' ? valid : null);
        if (valid) {
          suggestionsMap.set(cacheKey, valid);
        }
      }

      const currentSuggestion = suggestionsMap.get(cacheKey);
      if (!currentSuggestion && !seenMissingKeys.has(cacheKey)) {
        seenMissingKeys.add(cacheKey);
        missingItems.push({ item: it, cacheKey });
      }
    });

    // Both items were resolved via categoryHint! Missing items is 0, so NO 2nd LLM call!
    expect(missingItems).toHaveLength(0);
    expect(suggestionsMap.get('expense:kfc')).toEqual({ categoryId: 'food', source: 'guess' });
    expect(suggestionsMap.get('expense:mrt')).toEqual({ categoryId: 'transport', source: 'guess' });
  });

  it('preserves learned memory priority over categoryHint from extraction', () => {
    const { matchSourceCategory } = require('../src/lib/import');
    // Extraction suggested 'food', but user previously taught memory that 7-Eleven is 'groceries'
    const item: ExtractedTxn = {
      merchant: '7-Eleven',
      amount: 10,
      type: 'expense',
      date: '2026-09-12',
      method: null,
      currency: 'MYR',
      categoryHint: 'food',
    };
    const localMemory = { '7-eleven': 'groceries' };

    const key = merchantKey(item.merchant);
    const keywordGuess = guessCategoryByKeyword(item.merchant, item.type, categories);
    const suggestion = resolveSuggestion(key, localMemory, categories, keywordGuess);
    const cat = suggestion ? catById[suggestion.categoryId] : undefined;
    let valid = cat && cat.kind === item.type ? suggestion : null;
    if (!valid && item.categoryHint) {
      const hintedId = matchSourceCategory(item.categoryHint, categories, item.type);
      if (hintedId) {
        valid = { categoryId: hintedId, source: 'guess' };
      }
    }

    // Learned memory wins!
    expect(valid).toEqual({ categoryId: 'groceries', source: 'learned' });
  });
});
