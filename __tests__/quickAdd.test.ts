import { resolveQuickAdd, type QuickAddDeps, type QuickAddLLM } from '../src/lib/quickAdd';
import { merchantKey } from '../src/lib/normalize';
import type { Category, MemoryMap } from '../src/lib/types';

const categories: Category[] = [
  { id: 'food', label: 'Food', icon: 'gift', hue: 20, kind: 'expense', isDefault: true },
  { id: 'transport', label: 'Transport', icon: 'gift', hue: 40, kind: 'expense', isDefault: true },
  { id: 'salary', label: 'Salary', icon: 'wallet', hue: 140, kind: 'income', isDefault: true },
];

function deps(over: Partial<QuickAddDeps> = {}): QuickAddDeps {
  return {
    memory: {} as MemoryMap,
    categories,
    activeCurrencies: ['MYR'],
    today: '2026-08-28',
    llm: null,
    ...over,
  };
}

const fakeLLM = (impl: QuickAddLLM['quickAdd']): QuickAddLLM => ({ can: () => true, quickAdd: impl });

describe('resolveQuickAdd — local only', () => {
  it('returns a local draft with no category when memory is empty and there is no LLM', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: 'lunch', amount: 9.2, categoryId: null });
  });

  it('fills the category from learned memory without any LLM', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'food' } as MemoryMap }));
    expect(out[0].categoryId).toBe('food');
  });

  it('ignores a memory hit whose category kind contradicts the draft type', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'salary' } as MemoryMap }));
    expect(out[0].categoryId).toBeNull();
  });

  it('returns nothing for text with no amount', async () => {
    expect(await resolveQuickAdd('lunch', deps())).toEqual([]);
  });
});

describe('resolveQuickAdd — when the LLM is consulted', () => {
  it('is NOT called when the parse was confident and memory covered every draft', async () => {
    const quickAdd = jest.fn();
    await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'food' } as MemoryMap, llm: fakeLLM(quickAdd) }));
    expect(quickAdd).not.toHaveBeenCalled();
  });

  it('IS called when a draft has no category', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(quickAdd) }));
    expect(quickAdd).toHaveBeenCalled();
    expect(out[0].categoryId).toBe('food');
  });

  it('IS called when the parse was not confident, even if memory covered everything', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    await resolveQuickAdd('lunch 9.2 and 4', deps({ memory: { lunch: 'food' } as MemoryMap, llm: fakeLLM(quickAdd) }));
    expect(quickAdd).toHaveBeenCalled();
  });

  it('is not called when the provider reports the capability unavailable', async () => {
    const quickAdd = jest.fn();
    await resolveQuickAdd('lunch 9.2', deps({ llm: { can: () => false, quickAdd } }));
    expect(quickAdd).not.toHaveBeenCalled();
  });
});

describe('resolveQuickAdd — memory outranks the model', () => {
  it('overrides the model category with a learned one', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'transport' },
      { label: 'mystery', amount: 4, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const out = await resolveQuickAdd('lunch 9.2, mystery 4', deps({ memory: { lunch: 'food' } as MemoryMap, llm: fakeLLM(quickAdd) }));
    expect(out[0].categoryId).toBe('food');      // memory won
    expect(out[1].categoryId).toBe('food');      // model filled the gap
  });
});

describe('resolveQuickAdd — the label the user typed is the label that gets learned', () => {
  it('keeps the typed label when the local parse was confident, even if the model renames it', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'Dim Sum', amount: 45, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const out = await resolveQuickAdd('dimsum 45', deps({ llm: fakeLLM(quickAdd) }));
    expect(out[0].label).toBe('dimsum');       // pinned, not 'Dim Sum'
    expect(out[0].categoryId).toBe('food');    // the model's real contribution survives
  });

  it('keeps every other field the model returned', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'Grab', amount: 12, type: 'income', date: '2026-08-27', currency: 'MYR', categoryId: 'salary' },
    ]);
    const out = await resolveQuickAdd('grabride 12', deps({ llm: fakeLLM(quickAdd) }));
    expect(out[0]).toEqual({
      label: 'grabride',
      amount: 12,
      type: 'income',
      date: '2026-08-27',
      currency: 'MYR',
      categoryId: 'salary',
    });
  });

  it('does NOT pin when the local parse was not confident — the model cleaned up a mess', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'Grab', amount: 12, type: 'expense', date: null, currency: null, categoryId: 'transport' },
    ]);
    const out = await resolveQuickAdd('split the grab ride, my half was 12', deps({ llm: fakeLLM(quickAdd) }));
    expect(out[0].label).toBe('Grab');
  });

  it('does NOT pin when the model returned a different number of items', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'Lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' },
      { label: 'Tip', amount: 1, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(quickAdd) }));
    expect(out.map((d) => d.label)).toEqual(['Lunch', 'Tip']);
  });

  it('does not pin an empty local label over a real one from the model', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'Cash withdrawal', amount: 50, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const out = await resolveQuickAdd('50', deps({ llm: fakeLLM(quickAdd) }));
    expect(out[0].label).toBe('Cash withdrawal');
  });

  // The whole point of the pin: the round trip has to close, or every repeat of the same
  // phrase pays for another LLM call forever.
  it('closes the loop — the second identical entry never reaches the LLM', async () => {
    const firstCall = jest.fn().mockResolvedValue([
      { label: 'Dim Sum', amount: 45, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const first = await resolveQuickAdd('dimsum 45', deps({ llm: fakeLLM(firstCall) }));
    expect(firstCall).toHaveBeenCalledTimes(1);

    // What commitCategorized would write: merchantKey(label) -> categoryId.
    const learned = { [merchantKey(first[0].label)]: first[0].categoryId! } as MemoryMap;

    const secondCall = jest.fn();
    const second = await resolveQuickAdd('dimsum 45', deps({ memory: learned, llm: fakeLLM(secondCall) }));
    expect(secondCall).not.toHaveBeenCalled();
    expect(second[0].categoryId).toBe('food');
  });
});

describe('resolveQuickAdd — failure is always soft', () => {
  it('falls back to the local result when the LLM rejects', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(() => Promise.reject(new Error('offline'))) }));
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(9.2);
    expect(out[0].categoryId).toBeNull();
  });

  it('falls back to the local result when the LLM hangs past the timeout', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(() => new Promise(() => {})) }), 10);
    expect(out[0].amount).toBe(9.2);
  });

  it('falls back to the local result when the LLM returns nothing usable', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(async () => []) }));
    expect(out[0].amount).toBe(9.2);
  });
});
