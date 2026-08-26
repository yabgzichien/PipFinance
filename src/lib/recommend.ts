import { merchantKey } from './normalize';
import type { CategorySuggestion, MemoryMap } from './types';

/**
 * Deterministic category suggestion from the learned memory.
 *
 * Pure functions so they can be unit-tested without a database. The screen
 * layer loads the MemoryMap from memoryRepo and passes it in.
 */

/** Look up a suggestion by an already-normalized key. */
export function suggestByKey(memory: MemoryMap, key: string): string | null {
  if (!key) return null;
  return memory[key] ?? null;
}

/** Look up a suggestion for a raw merchant label (normalizes first). */
export function suggestForMerchant(memory: MemoryMap, rawMerchant: string): string | null {
  return suggestByKey(memory, merchantKey(rawMerchant));
}

export interface AutoFillStats {
  /** Lines that arrived pre-categorised from learned memory. */
  filled: number;
  /** Total lines in the scan. */
  total: number;
}

/**
 * The competence signal for a scan (docs/ui-engagement-plan.md Step 5): of the lines just
 * extracted, how many matched a merchant Pip already knew, versus an AI guess or nothing.
 */
export function autoFillStats(suggestions: (CategorySuggestion | null)[]): AutoFillStats {
  const filled = suggestions.filter((s) => s?.source === 'learned').length;
  return { filled, total: suggestions.length };
}
