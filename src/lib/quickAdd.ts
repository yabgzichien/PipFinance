// src/lib/quickAdd.ts
// The quick-add decision tree: offline parse, then learned memory, then — only if that came up
// short — one LLM call, whose answer memory still overrides. Lives in lib/ rather than in the
// screen so the whole tree is unit-testable with a fake provider and no React.

import { parseQuickText, type QuickDraft } from './quickParse';
import { suggestForMerchant } from './recommend';
import type { Category, MemoryMap } from './types';
import type { QuickAddCategoryOption } from '../llm/quickAddPrompt';

/** The slice of FallbackProvider this module needs, declared narrowly so tests can fake it. */
export interface QuickAddLLM {
  can(cap: 'quickAdd'): boolean;
  quickAdd(input: {
    text: string;
    categories: QuickAddCategoryOption[];
    today: string;
    activeCurrencies: string[];
  }): Promise<QuickDraft[]>;
}

export interface QuickAddDeps {
  memory: MemoryMap;
  categories: Category[];
  activeCurrencies: string[];
  /** ISO date, injected so this stays pure. */
  today: string;
  /** Null when no provider is configured. */
  llm: QuickAddLLM | null;
}

export const QUICK_ADD_TIMEOUT_MS = 12000;

/** Bounds an in-flight promise so a hung request can't strand the user. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Quick add timed out.')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Fill each draft's category from learned memory, where memory has a hit whose kind matches.
 * A draft that already carries a category keeps it unless memory disagrees — memory wins,
 * mirroring AddFlow.onExtracted, where source 'learned' beats source 'guess'.
 */
function applyMemory(drafts: QuickDraft[], memory: MemoryMap, categories: Category[]): QuickDraft[] {
  return drafts.map((d) => {
    const id = d.label ? suggestForMerchant(memory, d.label) : null;
    const cat = id ? categories.find((c) => c.id === id) : undefined;
    if (cat && cat.kind === d.type) return { ...d, categoryId: cat.id };
    return d;
  });
}

/**
 * Turn typed text into drafts. Always returns something usable: on any LLM failure — no key,
 * offline, timeout, unreadable reply, empty result — the offline result stands.
 */
export async function resolveQuickAdd(
  text: string,
  deps: QuickAddDeps,
  timeoutMs: number = QUICK_ADD_TIMEOUT_MS
): Promise<QuickDraft[]> {
  const { memory, categories, activeCurrencies, today, llm } = deps;

  const local = parseQuickText(text, { activeCurrencies, today });
  const localWithMemory = applyMemory(local.drafts, memory, categories);

  const needsHelp = !local.confident || localWithMemory.some((d) => !d.categoryId);
  if (!needsHelp || !llm || !llm.can('quickAdd')) return localWithMemory;

  try {
    const remote = await withTimeout(
      llm.quickAdd({
        text,
        categories: categories.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
        today,
        activeCurrencies,
      }),
      timeoutMs
    );
    if (remote.length === 0) return localWithMemory;
    return applyMemory(remote, memory, categories);
  } catch {
    // Enhancement-only, exactly like guessCategories: any failure degrades to what the
    // offline parser already produced, which usually includes the amount.
    return localWithMemory;
  }
}
