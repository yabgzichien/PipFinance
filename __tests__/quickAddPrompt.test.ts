import {
  buildQuickAddPrompt,
  parseQuickAddReply,
  QUICK_ADD_SYSTEM_PROMPT,
  QuickAddParseError,
  type QuickAddCategoryOption,
} from '../src/llm/quickAddPrompt';

const categories: QuickAddCategoryOption[] = [
  { id: 'food', label: 'Food', kind: 'expense' },
  { id: 'transport', label: 'Transport', kind: 'expense' },
  { id: 'salary', label: 'Salary', kind: 'income' },
];
const active = ['MYR', 'USD'];
const today = '2026-08-28';

const reply = (items: unknown) => JSON.stringify({ items });

describe('buildQuickAddPrompt', () => {
  it('includes the raw text, every category id and label, today, and the active currencies', () => {
    const p = buildQuickAddPrompt('lunch 9.2', categories, today, active);
    expect(p).toContain('lunch 9.2');
    expect(p).toContain('food');
    expect(p).toContain('Food');
    expect(p).toContain('salary');
    expect(p).toContain('2026-08-28');
    expect(p).toContain('USD');
  });
});

describe('QUICK_ADD_SYSTEM_PROMPT', () => {
  it('forbids inventing category ids and forbids prose', () => {
    expect(QUICK_ADD_SYSTEM_PROMPT).toMatch(/not in the provided list/i);
    expect(QUICK_ADD_SYSTEM_PROMPT).toMatch(/only json/i);
  });
});

describe('parseQuickAddReply', () => {
  it('reads a well-formed reply', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' }]),
      categories, active, today
    );
    expect(out).toEqual([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
  });

  it('tolerates a ```json fenced block', () => {
    const out = parseQuickAddReply(
      '```json\n' + reply([{ label: 'lunch', amount: 9.2, type: 'expense', categoryId: 'food' }]) + '\n```',
      categories, active, today
    );
    expect(out[0].categoryId).toBe('food');
  });

  it('nulls a category id that is not in the list — never invents one', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', categoryId: 'made-up' }]),
      categories, active, today
    );
    expect(out[0].categoryId).toBeNull();
  });

  it('nulls a category whose kind contradicts the item type', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', categoryId: 'salary' }]),
      categories, active, today
    );
    expect(out[0].categoryId).toBeNull();
  });

  it('drops an item with a non-positive, non-finite, or missing amount', () => {
    const out = parseQuickAddReply(
      reply([
        { label: 'a', amount: -5, type: 'expense' },
        { label: 'b', amount: 0, type: 'expense' },
        { label: 'c', type: 'expense' },
        { label: 'd', amount: 'lots', type: 'expense' },
        { label: 'e', amount: 5, type: 'expense' },
      ]),
      categories, active, today
    );
    expect(out.map((d) => d.label)).toEqual(['e']);
  });

  it('falls back to expense for an unknown type', () => {
    const out = parseQuickAddReply(reply([{ label: 'x', amount: 5, type: 'transfer' }]), categories, active, today);
    expect(out[0].type).toBe('expense');
  });

  it('nulls a currency the user has not activated', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', currency: 'JPY' }]),
      categories, active, today
    );
    expect(out[0].currency).toBeNull();
  });

  it('keeps an active currency, uppercased', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', currency: 'usd' }]),
      categories, active, today
    );
    expect(out[0].currency).toBe('USD');
  });

  it('nulls a malformed or absurd date', () => {
    const out = parseQuickAddReply(
      reply([
        { label: 'a', amount: 5, type: 'expense', date: 'last tuesday' },
        { label: 'b', amount: 5, type: 'expense', date: '1998-01-01' },
        { label: 'c', amount: 5, type: 'expense', date: '2026-08-27' },
      ]),
      categories, active, today
    );
    expect(out.map((d) => d.date)).toEqual([null, null, '2026-08-27']);
  });

  it('coerces a non-string label to an empty string', () => {
    const out = parseQuickAddReply(reply([{ label: 42, amount: 5, type: 'expense' }]), categories, active, today);
    expect(out[0].label).toBe('');
  });

  it('caps the number of items', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ label: `i${i}`, amount: 1, type: 'expense' }));
    expect(parseQuickAddReply(reply(many), categories, active, today)).toHaveLength(10);
  });

  it('throws on a reply that is not JSON', () => {
    expect(() => parseQuickAddReply('sure! here you go', categories, active, today)).toThrow(QuickAddParseError);
  });

  it('throws on a JSON reply with no items array', () => {
    expect(() => parseQuickAddReply('{"ok":true}', categories, active, today)).toThrow(QuickAddParseError);
  });

  it('returns an empty array for an empty items array', () => {
    expect(parseQuickAddReply(reply([]), categories, active, today)).toEqual([]);
  });
});
