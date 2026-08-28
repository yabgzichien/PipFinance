// src/lib/quickAdd.ts
// The quick-add decision tree: offline parse, then learned memory, then — only if that came up
// short — one LLM call, whose answer memory still overrides. Lives in lib/ rather than in the
// screen so the whole tree is unit-testable with a fake provider and no React.

import { parseQuickText, type QuickDraft, type QuickParseResult } from './quickParse';
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
 * Carry the user's own typed label back over the model's, so the label that gets LEARNED is
 * the one they will type again.
 *
 * This is the single exception to "the model replaces, it does not patch". Without it the
 * learning loop silently never closes: type "dimsum 45", the model tidies the label to
 * "Dim Sum", that is what reaches the confirm screen and therefore what commitCategorized
 * stores — under merchantKey "dim sum". The next "dimsum" hashes to "dimsum", misses, and
 * pays for another model call. Forever, no matter how many times it was "learned".
 *
 * Gated on `confident` because that is exactly the line between the two cases:
 *   - confident  → one clean amount and a real label, and the model was consulted only
 *                  because the CATEGORY was unknown. The typed label is the user's own word.
 *                  Pin it.
 *   - !confident → the input was a mess ("split the grab ride, my half was 12") and the local
 *                  label is junk ("my half was"). The model's "Grab" is the better label and
 *                  the whole reason it was called. Leave it alone.
 *
 * The count check keeps positions honest: if the model split or merged segments, index i on
 * each side is no longer the same transaction, so nothing is pinned. The empty-label check is
 * belt-and-braces — `confident` already implies a non-empty label — so this stays correct on
 * its own terms if that ever changes.
 */
function pinTypedLabels(remote: QuickDraft[], local: QuickParseResult): QuickDraft[] {
  if (!local.confident || remote.length !== local.drafts.length) return remote;
  return remote.map((d, i) => {
    const typed = local.drafts[i].label;
    return typed ? { ...d, label: typed } : d;
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
    // Pin BEFORE applyMemory, so the memory lookup keys off the user's own word rather than
    // the model's rewrite of it — otherwise a batch's already-known merchant would miss too.
    return applyMemory(pinTypedLabels(remote, local), memory, categories);
  } catch {
    // Enhancement-only, exactly like guessCategories: any failure degrades to what the
    // offline parser already produced, which usually includes the amount.
    return localWithMemory;
  }
}
