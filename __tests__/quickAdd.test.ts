import { resolveQuickAdd, resolveQuickAddWithoutAmount, type QuickAddDeps } from '../src/lib/quickAdd';
import { merchantKey } from '../src/lib/normalize';
import type { Category, MemoryMap } from '../src/lib/types';

const categories: Category[] = [
  { id: 'food', label: 'Food', icon: 'gift', hue: 20, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  { id: 'transport', label: 'Transport', icon: 'gift', hue: 40, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  { id: 'other', label: 'Other Expenses', icon: 'dots', hue: 220, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  { id: 'salary', label: 'Salary', icon: 'wallet', hue: 140, kind: 'income', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
];

function deps(over: Partial<QuickAddDeps> = {}): QuickAddDeps {
  return {
    memory: {} as MemoryMap,
    categories,
    activeCurrencies: ['MYR'],
    today: '2026-08-28',
    ...over,
  };
}

describe('resolveQuickAdd — local only', () => {
  it('returns a local draft with no category when nothing — memory, keyword or classifier — has an answer', async () => {
    const out = await resolveQuickAdd('mystery 9.2', deps());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: 'mystery', amount: 9.2, categoryId: null });
  });

  it('falls back to a keyword guess when memory is empty', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps());
    expect(out[0]).toMatchObject({ label: 'lunch', amount: 9.2, categoryId: 'food' });
  });

  it('fills the category from learned memory without any LLM', async () => {
    const out = await resolveQuickAdd('mystery 9.2', deps({ memory: { mystery: 'food' } as MemoryMap }));
    expect(out[0].categoryId).toBe('food');
    expect(out[0].categorySource).toBe('learned');
  });

  it('prefers learned memory over a keyword guess when both would apply', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'transport' } as MemoryMap }));
    expect(out[0].categoryId).toBe('transport');
    expect(out[0].categorySource).toBe('learned');
  });

  it('falls back to the keyword guess when a memory hit contradicts the draft type', async () => {
    // 'salary' is income, so the (kind-mismatched) memory hit is ignored — but "lunch" still
    // resolves offline via the keyword list, same as if memory had nothing at all.
    const out = await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'salary' } as MemoryMap }));
    expect(out[0].categoryId).toBe('food');
  });

  it('recognises sdg currency and resolves category offline even without sdg in settings', async () => {
    const out = await resolveQuickAdd('lunch 3sdg', deps({ activeCurrencies: ['MYR'] }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      label: 'lunch',
      amount: 3,
      currency: 'SGD',
      categoryId: 'food',
    });
  });

  it('classifies various currencies and typos correctly (sdg, cny, rmb, 元, 新币, symbols)', async () => {
    // CNY with code and aliases
    const outCny = await resolveQuickAdd('dinner 50cny', deps());
    expect(outCny[0]).toMatchObject({ label: 'dinner', amount: 50, currency: 'CNY', categoryId: 'food' });

    const outRmb = await resolveQuickAdd('lunch 50rmb', deps());
    expect(outRmb[0]).toMatchObject({ label: 'lunch', amount: 50, currency: 'CNY', categoryId: 'food' });

    const outYuan = await resolveQuickAdd('lunch 50元', deps());
    expect(outYuan[0]).toMatchObject({ label: 'lunch', amount: 50, currency: 'CNY', categoryId: 'food' });

    // SGD with Chinese word
    const outSing = await resolveQuickAdd('lunch 30新币', deps());
    expect(outSing[0]).toMatchObject({ label: 'lunch', amount: 30, currency: 'SGD', categoryId: 'food' });

    // EUR symbol prefix
    const outEur = await resolveQuickAdd('€20 museum', deps());
    expect(outEur[0]).toMatchObject({ label: 'museum', amount: 20, currency: 'EUR' });

    // GBP symbol prefix
    const outGbp = await resolveQuickAdd('£15 tea', deps());
    expect(outGbp[0]).toMatchObject({ label: 'tea', amount: 15, currency: 'GBP', categoryId: 'food' });

    // JPY suffix
    const outJpy = await resolveQuickAdd('ramen 1500jpy', deps());
    expect(outJpy[0]).toMatchObject({ label: 'ramen', amount: 1500, currency: 'JPY' });
  });

  it('handles typos in labels with amounts (e.g. luch 15, diner 25, brekfast 12)', async () => {
    const outLuch = await resolveQuickAdd('luch 15', deps());
    expect(outLuch[0]).toMatchObject({ label: 'luch', amount: 15, categoryId: 'food' });

    const outDiner = await resolveQuickAdd('diner 25', deps());
    expect(outDiner[0]).toMatchObject({ label: 'diner', amount: 25, categoryId: 'food' });

    const outBrek = await resolveQuickAdd('brekfast 12', deps());
    expect(outBrek[0]).toMatchObject({ label: 'brekfast', amount: 12, categoryId: 'food' });
  });

  it('returns nothing for text with no amount', async () => {
    expect(await resolveQuickAdd('lunch', deps())).toEqual([]);
  });
});

describe('resolveQuickAdd — on-device Naive Bayes model', () => {
  it('uses the on-device statistical classifier when keyword dictionary and memory miss', async () => {
    // "strbucks" (typo) is not in keyword dictionary or memory, but Naive Bayes classifier identifies it as food
    const out = await resolveQuickAdd('strbucks 25', deps());
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('strbucks');
    expect(out[0].amount).toBe(25);
    expect(out[0].categoryId).toBe('food');
    expect(out[0].categorySource).toBe('guess');
  });

  it('prioritizes learned memory over on-device classifier predictions', async () => {
    const memory = { [merchantKey('strbucks')]: 'transport' } as MemoryMap;
    const out = await resolveQuickAdd('strbucks 25', deps({ memory }));
    expect(out[0].categoryId).toBe('transport');
    expect(out[0].categorySource).toBe('learned');
  });

  it('does not require or consult any LLM provider', async () => {
    const dummyLLM = {
      can: jest.fn(() => true),
      quickAdd: jest.fn(),
    };
    const out = await resolveQuickAdd('strbucks 25', deps({ llm: dummyLLM }));
    expect(dummyLLM.quickAdd).not.toHaveBeenCalled();
    expect(out[0].categoryId).toBe('food');
  });

  it('categorizes multi-segment entries offline with deterministic and ML rules', async () => {
    const out = await resolveQuickAdd('lunch 12, strbucks 25', deps());
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe('lunch');
    expect(out[0].categoryId).toBe('food');
    expect(out[1].label).toBe('strbucks');
    expect(out[1].categoryId).toBe('food');
  });

  it('resolves number-only input offline with amount and no category', async () => {
    const out = await resolveQuickAdd('50', deps());
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(50);
    expect(out[0].label).toBe('');
    expect(out[0].categoryId).toBeNull();
  });
});

describe('resolveQuickAddWithoutAmount — entry with no amount auto-selects category', () => {
  it('extracts clean label, zero amount, and auto-selects category via keyword', async () => {
    const draft = await resolveQuickAddWithoutAmount('lunch', deps());
    expect(draft.label).toBe('Lunch');
    expect(draft.amount).toBe(0);
    expect(draft.type).toBe('expense');
    expect(draft.categoryId).toBe('food');
    expect(draft.categorySource).toBe('guess');
  });

  it('matches travel category from starter keywords or category id', async () => {
    const customCats: Category[] = [
      ...categories,
      { id: 'travelling', label: 'Transport', icon: 'gift', hue: 40, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
    ];
    const draft = await resolveQuickAddWithoutAmount('travel', deps({ categories: customCats }));
    expect(draft.label).toBe('Travel');
    expect(draft.amount).toBe(0);
    expect(draft.categoryId).toBe('travelling');
  });

  it('handles repeated characters like "foood" -> "food"', async () => {
    const draft = await resolveQuickAddWithoutAmount('foood', deps());
    expect(draft.label).toBe('Foood');
    expect(draft.amount).toBe(0);
    expect(draft.categoryId).toBe('food');
  });

  it('detects income type and category for income words', async () => {
    const draft = await resolveQuickAddWithoutAmount('salary', deps());
    expect(draft.label).toBe('Salary');
    expect(draft.type).toBe('income');
    expect(draft.categoryId).toBe('salary');
  });

  it('prioritizes learned memory over keyword guess', async () => {
    const memory = { [merchantKey('lunch')]: 'transport' } as MemoryMap;
    const draft = await resolveQuickAddWithoutAmount('lunch', deps({ memory }));
    expect(draft.label).toBe('Lunch');
    expect(draft.categoryId).toBe('transport');
    expect(draft.categorySource).toBe('learned');
  });

  it('falls back to a default category when no memory or keyword matches so a category is always auto-selected', async () => {
    const draft = await resolveQuickAddWithoutAmount('randomgibberish', deps());
    expect(draft.label).toBe('Randomgibberish');
    expect(draft.amount).toBe(0);
    expect(draft.categoryId).not.toBeNull();
  });

  it('uses Tier 3 on-device statistical classifier when memory and keywords miss', async () => {
    // "strbucks" (typo) is not in memory or keyword dictionary, but classifier identifies it as food
    const draft = await resolveQuickAddWithoutAmount('strbucks', deps());
    expect(draft.categoryId).toBe('food');
    expect(draft.categorySource).toBe('guess');
  });

  it('falls back to default category without requiring any LLM when all predictors miss', async () => {
    // Use an unrecognized nonsense word that will miss memory, keywords, and classifier
    const draft = await resolveQuickAddWithoutAmount('qwertyuiopasdf', deps());
    expect(draft.categoryId).toBe('other');
    expect(draft.categorySource).toBe('guess');
  });
});

