// src/lib/quickAdd.ts
// The quick-add decision tree: offline parse, deterministic suggestions (learned memory,
// direct matching, keywords), and on-device Naive Bayes statistical classifier.
// 100% offline, privacy-first, zero LLM dependencies.

import { DEFAULT_EXPENSE_ID, DEFAULT_INCOME_ID } from '../data/categories';
import { guessCategoryByKeyword } from './categoryKeywords';
import { predictMerchantCategory } from './merchantClassifier';
import { isNumberOnlyInput, parseQuickSegmentWithoutAmount, parseQuickText, type QuickDraft } from './quickParse';
import { suggestForMerchant } from './recommend';
import type { Category, MemoryMap, TxnType } from './types';

export interface QuickAddDeps {
  memory: MemoryMap;
  categories: Category[];
  activeCurrencies: string[];
  /** ISO date, injected so this stays pure. */
  today: string;
  /** Legacy field preserved for backward compatibility; unused. */
  llm?: unknown;
}

/**
 * Infers a category for a merchant label using:
 * 1. Learned memory (deterministic, user's previous transaction history)
 * 2. Direct category name / ID matching (deterministic exact/prefix)
 * 3. Keyword guessing (deterministic, including collapsed repeated characters)
 * 4. On-device statistical classifier (Naive Bayes / TF-IDF log-odds model)
 */
export function inferCategoryForLabel(
  label: string,
  type: TxnType,
  memory: MemoryMap,
  categories: Category[]
): { categoryId: string; categorySource: 'learned' | 'guess' } | null {
  if (!label || !label.trim()) return null;

  // 1. Learned memory match
  const learnedId = suggestForMerchant(memory, label);
  const learnedCat = learnedId
    ? categories.find((c) => c.id === learnedId && c.kind === type && !c.isHidden)
    : undefined;
  if (learnedCat) {
    return { categoryId: learnedCat.id, categorySource: 'learned' };
  }

  // 2. Direct category name / id matching
  const labelLower = label.toLowerCase();
  let directCat = categories.find(
    (c) =>
      c.kind === type &&
      !c.isHidden &&
      (c.id.toLowerCase() === labelLower || c.label.toLowerCase() === labelLower)
  );
  if (!directCat) {
    directCat = categories.find(
      (c) =>
        c.kind === type &&
        !c.isHidden &&
        (c.id.toLowerCase().startsWith(labelLower) ||
          labelLower.startsWith(c.id.toLowerCase()) ||
          c.label.toLowerCase().startsWith(labelLower))
    );
  }
  if (directCat) {
    return { categoryId: directCat.id, categorySource: 'guess' };
  }

  // 3. Keyword guessing (with repeated character collapsing e.g. "foood" -> "food", "lunchhh" -> "lunch")
  let keywordCatId = guessCategoryByKeyword(label, type, categories);
  if (!keywordCatId) {
    const collapsedDouble = label.replace(/(.)\1{2,}/g, '$1$1');
    if (collapsedDouble !== label) {
      keywordCatId = guessCategoryByKeyword(collapsedDouble, type, categories);
    }
  }
  if (!keywordCatId) {
    const collapsedSingle = label.replace(/(.)\1+/g, '$1');
    if (collapsedSingle !== label) {
      keywordCatId = guessCategoryByKeyword(collapsedSingle, type, categories);
    }
  }
  if (keywordCatId) {
    return { categoryId: keywordCatId, categorySource: 'guess' };
  }

  // 4. On-device statistical classifier (Tier 3 Naive Bayes / TF-IDF log-odds)
  const classified = predictMerchantCategory(label, type, categories);
  if (classified) {
    return { categoryId: classified.categoryId, categorySource: 'guess' };
  }

  return null;
}

/**
 * Assigns categories to drafts using deterministic engine and on-device machine learning.
 */
function applyMemory(drafts: QuickDraft[], memory: MemoryMap, categories: Category[]): QuickDraft[] {
  return drafts.map((d) => {
    // If draft already has a valid category from prior parsing, check if learned memory overrides it
    if (d.categoryId) {
      const learnedId = d.label ? suggestForMerchant(memory, d.label) : null;
      const learnedCat = learnedId ? categories.find((c) => c.id === learnedId && c.kind === d.type && !c.isHidden) : undefined;
      if (learnedCat) {
        return { ...d, categoryId: learnedCat.id, categorySource: 'learned' };
      }
      return d;
    }

    if (!d.label) return d;

    const matched = inferCategoryForLabel(d.label, d.type, memory, categories);
    if (matched) {
      return { ...d, categoryId: matched.categoryId, categorySource: matched.categorySource };
    }

    return d;
  });
}

/**
 * Turn typed text into drafts. Always resolves 100% on-device using deterministic parsing,
 * learned memory, and the on-device statistical classifier.
 */
export async function resolveQuickAdd(
  text: string,
  deps: QuickAddDeps,
  _timeoutMs?: number
): Promise<QuickDraft[]> {
  const { memory, categories, activeCurrencies, today } = deps;

  // When the input has no digits / numbers, it can never produce drafts with amounts.
  if (!/\d/.test(text)) {
    return [];
  }

  const local = parseQuickText(text, { activeCurrencies, today });
  const localWithMemory = applyMemory(local.drafts, memory, categories);

  return localWithMemory;
}

/**
 * Resolves a single draft when no amount could be found in the typed input.
 * Prioritizes:
 * 1. Learned memory for the extracted label
 * 2. Exact or prefix match against category id / label
 * 3. Keyword guessing (including collapsed repeated characters, e.g. "foood" -> "food")
 * 4. On-device statistical classifier (Naive Bayes)
 * 5. Fallback category for the transaction kind (e.g. 'other' or 'other-income')
 *
 * Guaranteed to return a draft with a category auto-selected for the user, with amount: 0.
 */
export async function resolveQuickAddWithoutAmount(
  text: string,
  deps: QuickAddDeps,
  _timeoutMs?: number
): Promise<QuickDraft> {
  const { memory, today } = deps;
  const categories = deps.categories ?? [];
  const activeCurrencies = deps.activeCurrencies ?? [];

  const draft = parseQuickSegmentWithoutAmount(text, { activeCurrencies, today });
  const label = draft.label;
  const type = draft.type;

  if (label) {
    const matched = inferCategoryForLabel(label, type, memory, categories);
    if (matched) {
      return { ...draft, categoryId: matched.categoryId, categorySource: matched.categorySource };
    }
  }

  // Fallback category: always have a category auto selected for the user when there is no amount
  const defaultId = type === 'expense' ? DEFAULT_EXPENSE_ID : DEFAULT_INCOME_ID;
  const fallbackCat =
    categories.find((c) => c.kind === type && !c.isHidden && c.id === defaultId) ??
    categories.find((c) => c.kind === type && !c.isHidden);

  if (fallbackCat) {
    return { ...draft, categoryId: fallbackCat.id, categorySource: 'guess' };
  }

  return draft;
}

