// Which category a new transaction arrives pre-filled with, and why.
//
// A learned merchant mapping whose target has since been hidden falls through to the ordinary
// suggestion path. The mapping stays untouched so restoring the category restores the learning.
import type { CategorySuggestion, MemoryMap } from './types';

type VisibleCategory = { id: string; kind: string };

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
