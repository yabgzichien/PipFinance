// src/lib/merchantClassifier.ts
// On-device statistical text classifier for Pip Finance.
// Evaluates TF-weighted log-odds weights exported by tools/classifier/train.py.
// Runs synchronously in < 0.2ms with zero native dependencies.

import { ALL_SEED_CATEGORIES } from '../data/categories';
import modelData from '../data/merchantClassifierModel.json';
import type { Category, TxnType } from './types';

export interface ClassifierPrediction {
  categoryId: string;
  confidence: number;
}

/**
 * Extracts word tokens, edge prefix/suffix tokens, sub-word character 3-grams/4-grams, and CJK 1/2-grams.
 * Matches the tokenizer in tools/classifier/train.py.
 */
export function tokenizeClassifierText(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .trim()
    .replace(/[$€£¥₩฿₹₽₸0-9,._\-/:;!?#@%&*+=/\\|<>(){}[\]~`"']/g, ' ');
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  const tokens: string[] = [];

  for (const word of words) {
    tokens.push(`w:${word}`);

    // Prefix and suffix edge tokens (anchors word boundaries)
    if (word.length >= 3) {
      tokens.push(`^${word.slice(0, 3)}`);
      tokens.push(`${word.slice(-3)}$`);
      if (word.length >= 4) {
        tokens.push(`^${word.slice(0, 4)}`);
        tokens.push(`${word.slice(-4)}$`);
      }
    }

    // Sub-word character n-grams for typo resilience
    if (word.length >= 3) {
      for (const n of [3, 4]) {
        if (word.length >= n) {
          for (let i = 0; i <= word.length - n; i++) {
            tokens.push(`#${word.slice(i, i + n)}`);
          }
        }
      }
    }

    // CJK characters (single and bigrams) for Chinese / Japanese text
    const cjkChars: string[] = [];
    for (const ch of word) {
      if (/[\u4e00-\u9fff]/.test(ch)) {
        cjkChars.push(ch);
      }
    }
    for (const ch of cjkChars) {
      tokens.push(`cjk:${ch}`);
    }
    for (let i = 0; i < cjkChars.length - 1; i++) {
      tokens.push(`cjk2:${cjkChars[i]}${cjkChars[i + 1]}`);
    }
  }

  return tokens;
}

type InvertedIndex = Record<string, Record<string, number>>;
let cachedInvertedIndex: InvertedIndex | null = null;

function getInvertedIndex(): InvertedIndex {
  if (!cachedInvertedIndex) {
    const rawWeights = (modelData as { weights: Record<string, Record<string, number>> }).weights;
    const idx: InvertedIndex = {};
    for (const [catId, tokenMap] of Object.entries(rawWeights)) {
      for (const [token, weight] of Object.entries(tokenMap)) {
        if (!idx[token]) idx[token] = {};
        idx[token][catId] = weight;
      }
    }
    cachedInvertedIndex = idx;
  }
  return cachedInvertedIndex;
}

/**
 * Predicts the transaction category for a given merchant / expense description.
 * Filters candidates to active (non-hidden) categories matching the transaction kind.
 * Runs in < 0.03ms using a pre-computed inverted index.
 * Returns null if no distinctive signal or confidence < minConfidence.
 */
export function predictMerchantCategory(
  text: string,
  type: TxnType,
  categories?: Category[],
  minConfidence: number = 0.4
): ClassifierPrediction | null {
  if (!text || text.trim().length === 0) return null;

  const cats = categories && Array.isArray(categories) && categories.length > 0
    ? categories
    : (ALL_SEED_CATEGORIES as unknown as Category[]);

  const validCategories = cats.filter((c) => c.kind === type && !c.isHidden);
  if (validCategories.length === 0) return null;
  const validCatIds = new Set(validCategories.map((c) => c.id));

  const tokens = tokenizeClassifierText(text);
  if (tokens.length === 0) return null;

  const idx = getInvertedIndex();
  const scores: Record<string, number> = {};

  for (const t of tokens) {
    const tokenWeights = idx[t];
    if (!tokenWeights) continue;
    for (const catId in tokenWeights) {
      if (validCatIds.has(catId)) {
        scores[catId] = (scores[catId] || 0) + tokenWeights[catId];
      }
    }
  }

  let maxScore = 0;
  let bestCatId = '';
  for (const [catId, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCatId = catId;
    }
  }

  if (maxScore <= 0 || !bestCatId) return null;

  // Softmax calibration over candidate categories
  let sumExp = 0;
  const expScores: Record<string, number> = {};
  for (const [catId, score] of Object.entries(scores)) {
    const exp = Math.exp(Math.min(50, score - maxScore));
    expScores[catId] = exp;
    sumExp += exp;
  }

  const confidence = sumExp > 0 ? (expScores[bestCatId] || 0) / sumExp : 0;
  if (confidence < minConfidence) return null;

  return {
    categoryId: bestCatId,
    confidence: Math.round(confidence * 100) / 100,
  };
}
