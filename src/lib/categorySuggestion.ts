// Which category a new transaction arrives pre-filled with, and why.
//
// A learned merchant mapping whose target has since been hidden falls through to the ordinary
// suggestion path. The mapping stays untouched so restoring the category restores the learning.
import type { CategorySuggestion, MemoryMap } from './types';

type VisibleCategory = { id: string; kind: string };

/** Whether saving a row should leave its existing merchant learning untouched. */
export type MerchantMemoryWritePolicy = 'learn' | 'preserve';

export function resolveSuggestion(
  merchantKey: string,
  memory: MemoryMap,
  visible: VisibleCategory[],
  guess: string | null
): CategorySuggestion | null {
  const visibleIds = new Set(visible.map((category) => category.id));
  const learned = merchantKey ? memory[merchantKey] : undefined;

  if (learned && visibleIds.has(learned)) {
    return { categoryId: learned, source: 'learned' };
  }
  if (guess && visibleIds.has(guess)) {
    return { categoryId: guess, source: 'guess' };
  }
  return null;
}

/**
 * A hidden learned target must survive only when the user accepts its visible fallback guess
 * unchanged. Any other saved category is an intentional correction and should retrain memory.
 */
export function shouldPreserveMerchantMemory(
  merchantKey: string,
  memory: MemoryMap,
  visible: VisibleCategory[],
  suggestion: CategorySuggestion | null,
  assignment: string | null
): boolean {
  const learned = merchantKey ? memory[merchantKey] : undefined;
  const learnedIsHidden = !!learned && !visible.some((category) => category.id === learned);
  return learnedIsHidden && suggestion?.source === 'guess' && assignment === suggestion.categoryId;
}
