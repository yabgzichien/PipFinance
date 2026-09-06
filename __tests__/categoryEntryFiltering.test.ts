// The model is handed a list of category ids and asked to pick one. A hidden category must not
// be in that list, and — separately — must be rejected if it comes back anyway, because a stale
// prompt or a hallucinated id would otherwise route a new expense into a category the user has
// explicitly taken out of circulation.
import { buildCategoryGuessPrompt, parseCategoryGuess } from '../src/llm/categoryGuessPrompt';
import { parseQuickAddReply } from '../src/llm/quickAddPrompt';
import { resolveSuggestion, shouldPreserveMerchantMemory } from '../src/lib/categorySuggestion';

const VISIBLE = [
  { id: 'food', label: 'Food', kind: 'expense' as const },
  { id: 'travelling', label: 'Transport', kind: 'expense' as const },
];

const SHELL = { index: 0, merchant: 'Shell', amount: 80, method: null, kind: 'expense' as const };

describe('category guess options', () => {
  it('never mentions a category the caller left out', () => {
    const prompt = buildCategoryGuessPrompt([SHELL], VISIBLE);
    expect(prompt).toContain('food');
    expect(prompt).not.toContain('opt-petrol');
  });

  it('rejects a response naming a category outside the supplied options', () => {
    const out = parseCategoryGuess('{"0":"opt-petrol"}', [SHELL], VISIBLE);
    expect(out[0]).toBeNull();
  });

  it('accepts a response naming a supplied option', () => {
    const out = parseCategoryGuess('{"0":"travelling"}', [SHELL], VISIBLE);
    expect(out[0]).toBe('travelling');
  });
});

describe('quick add options', () => {
  it('drops a category id outside the supplied options', () => {
    const parsed = parseQuickAddReply(
      '{"items":[{"label":"Shell","amount":80,"type":"expense","categoryId":"opt-petrol"}]}',
      VISIBLE,
      ['MYR'],
      '2026-09-06'
    );
    expect(parsed[0]?.categoryId ?? null).toBeNull();
  });
});

describe('learned memory vs hidden categories', () => {
  const visible = [
    { id: 'food', kind: 'expense' as const },
    { id: 'travelling', kind: 'expense' as const },
  ];

  it('uses a learned mapping that still points at a visible category', () => {
    expect(resolveSuggestion('shell', { shell: 'travelling' }, visible, null)).toEqual({
      categoryId: 'travelling',
      source: 'learned',
    });
  });

  it('falls through to the guess when the learned target is hidden', () => {
    expect(resolveSuggestion('shell', { shell: 'opt-petrol' }, visible, 'travelling')).toEqual({
      categoryId: 'travelling',
      source: 'guess',
    });
  });

  it('returns null rather than a hidden category when there is no guess either', () => {
    expect(resolveSuggestion('shell', { shell: 'opt-petrol' }, visible, null)).toBeNull();
  });

  it('rejects a guess that names a hidden category', () => {
    expect(resolveSuggestion('shell', {}, visible, 'opt-petrol')).toBeNull();
  });

  it('preserves hidden learning when its fallback guess is saved unchanged', () => {
    const memory = { shell: 'opt-petrol' };
    const fallback = resolveSuggestion('shell', memory, visible, 'travelling');
    expect(fallback).toEqual({ categoryId: 'travelling', source: 'guess' });
    expect(shouldPreserveMerchantMemory('shell', memory, visible, fallback, 'travelling')).toBe(true);

    const savedMemory = shouldPreserveMerchantMemory('shell', memory, visible, fallback, 'travelling')
      ? memory
      : { ...memory, shell: 'travelling' };
    expect(resolveSuggestion('shell', savedMemory, [...visible, { id: 'opt-petrol', kind: 'expense' as const }], null)).toEqual({
      categoryId: 'opt-petrol',
      source: 'learned',
    });
  });

  it('treats changing a hidden mapping fallback as an explicit correction', () => {
    const fallback = resolveSuggestion('shell', { shell: 'opt-petrol' }, visible, 'travelling');
    expect(shouldPreserveMerchantMemory('shell', { shell: 'opt-petrol' }, visible, fallback, 'food')).toBe(false);
  });
});
