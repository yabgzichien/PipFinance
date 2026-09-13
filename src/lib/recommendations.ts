// src/lib/recommendations.ts
// Deterministic recommendations for Trips and "Just type it" (QuickAdd).
// Remembers new entries, extracts clean labels, ranks by frequency/probability.
// Zero LLMs: runs locally, instantaneously, and offline.

import { damerauLevenshtein } from './categoryKeywords';
import { DESTINATIONS, matchDestination, type DestinationKey } from './destinations';
import type { Transaction } from './types';
import type { Trip } from './trips';

export interface TripRecommendation {
  name: string;
  destinationKey: DestinationKey | null;
  count: number;
}

export const POPULAR_DESTINATIONS: { name: string; nameZh: string; key: DestinationKey; aliases: string[] }[] = [
  { name: 'Tokyo', nameZh: '东京', key: 'jp', aliases: ['tokyo', 'japan', '东京', '日本'] },
  { name: 'Bangkok', nameZh: '曼谷', key: 'th', aliases: ['bangkok', 'thailand', '曼谷', '泰国'] },
  { name: 'Singapore', nameZh: '新加坡', key: 'sg', aliases: ['singapore', 'sentosa', '新加坡', '狮城'] },
  { name: 'Bali', nameZh: '巴厘岛', key: 'id', aliases: ['bali', 'indonesia', '巴厘岛', '印尼'] },
  { name: 'Penang', nameZh: '槟城', key: 'my', aliases: ['penang', 'malaysia', '槟城', '马来西亚'] },
  { name: 'Seoul', nameZh: '首尔', key: 'kr', aliases: ['seoul', 'korea', '首尔', '韩国'] },
  { name: 'Taipei', nameZh: '台北', key: 'tw', aliases: ['taipei', 'taiwan', '台北', '台湾'] },
  { name: 'Osaka', nameZh: '大阪', key: 'jp', aliases: ['osaka', 'japan', '大阪', '日本'] },
  { name: 'Hong Kong', nameZh: '香港', key: 'hk', aliases: ['hong kong', 'hongkong', '香港'] },
  { name: 'London', nameZh: '伦敦', key: 'gb', aliases: ['london', 'uk', 'united kingdom', '伦敦', '英国'] },
  { name: 'Paris', nameZh: '巴黎', key: 'fr', aliases: ['paris', 'france', '巴黎', '法国'] },
  { name: 'Melbourne', nameZh: '墨尔本', key: 'au', aliases: ['melbourne', 'australia', '墨尔本', '澳洲'] },
  { name: 'Chiang Mai', nameZh: '清迈', key: 'th', aliases: ['chiang mai', 'thailand', '清迈', '泰国'] },
  { name: 'Da Nang', nameZh: '岘港', key: 'vn', aliases: ['da nang', 'vietnam', '岘港', '越南'] },
  { name: 'Kyoto', nameZh: '京都', key: 'jp', aliases: ['kyoto', 'japan', '京都', '日本'] },
  { name: 'Hokkaido', nameZh: '北海道', key: 'jp', aliases: ['hokkaido', 'japan', '北海道', '日本'] },
  { name: 'Sabah', nameZh: '沙巴', key: 'my', aliases: ['sabah', 'malaysia', '沙巴', '马来西亚'] },
  { name: 'Phuket', nameZh: '普吉岛', key: 'th', aliases: ['phuket', 'thailand', '普吉', '普吉岛', '泰国'] },
  { name: 'Sydney', nameZh: '悉尼', key: 'au', aliases: ['sydney', 'australia', '悉尼', '澳洲'] },
  { name: 'Switzerland', nameZh: '瑞士', key: 'ch', aliases: ['switzerland', 'swiss', '瑞士'] },
  { name: 'Iceland', nameZh: '冰岛', key: 'is', aliases: ['iceland', '冰岛'] },
];

export const DEFAULT_QUICK_ADD_STARTERS_EN = [
  'Lunch',
  'Coffee',
  'Grab',
  'Dinner',
  'Groceries',
  'Petrol',
  'Movie',
  'Breakfast',
  'Pharmacy',
];

export const DEFAULT_QUICK_ADD_STARTERS_ZH = [
  '午餐',
  '咖啡',
  '打车',
  '晚餐',
  '超市',
  '加油',
  '电影',
  '早餐',
  '药房',
];

export const META_KEY_QUICK_ADD_FREQUENCIES = 'pip_quick_add_frequencies_v1';
export const META_KEY_TRIP_FREQUENCIES = 'pip_trip_frequencies_v1';

export const memoryQuickAddFrequencies: Record<string, number> = {};
export const memoryTripFrequencies: Record<string, number> = {};

async function safeGetMeta(key: string): Promise<string | null> {
  try {
    const { getMeta } = await import('../db/metaRepo');
    return await getMeta(key);
  } catch {
    return null;
  }
}

async function safeSetMeta(key: string, value: string): Promise<void> {
  try {
    const { setMeta } = await import('../db/metaRepo');
    await setMeta(key, value);
  } catch {
    // Ignore in environments where DB is unavailable
  }
}

/**
 * Extracts a clean merchant/item label from a natural quick-add input string.
 * Strips amounts, currency symbols, and excess punctuation.
 * E.g. "laksa 22" -> "Laksa", "RM25 coffee" -> "Coffee", "50 电影" -> "电影"
 */
export function extractLabelFromQuickAdd(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/(?:^|\b|\d)(RM|MYR|USD|SGD|SDG|EUR|GBP|CNY|RMB|JPY|AUD|CAD|TWD|HKD|KRW|THB|IDR|PHP|VND|BND|INR)(?:\b|\d|$)/gi, ' ')
    .replace(/[$€£¥￥₩฿₹₫₱₸]/g, ' ')
    .replace(/[0-9]+([.,][0-9]+)?/g, ' ');

  // Strip Chinese currency suffixes/prefixes attached to numbers or standalone
  cleaned = cleaned.replace(/(新币|坡币|马币|令吉|人民币|块钱|美金|美元|日元|日币|韩元|韩币|泰铢|台币|新台币|港币|港元|欧元|英镑|澳币|澳元|加币|加元|纽币|新西兰元|法郎|瑞士法郎|元|块)/g, ' ');

  cleaned = cleaned
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned || cleaned.length < 2) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Extracts base destination name from a trip string by removing trailing 4-digit year.
 * E.g. "Serbia 2026" -> "Serbia", "Tokyo 2026" -> "Tokyo", "Honeymoon" -> "Honeymoon"
 */
export function extractBaseTripName(name: string): string {
  if (!name) return '';
  let base = name.replace(/\s+\b(19\d\d|20\d\d)\b$/g, '').trim();
  if (!base) base = name.trim();
  if (!base) return '';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Persists a submitted QuickAdd entry to frequency memory and storage.
 */
export async function recordQuickAddSubmission(text: string): Promise<string | null> {
  const label = extractLabelFromQuickAdd(text);
  if (!label) return null;
  const key = label.toLowerCase();
  memoryQuickAddFrequencies[key] = (memoryQuickAddFrequencies[key] || 0) + 1;
  await safeSetMeta(META_KEY_QUICK_ADD_FREQUENCIES, JSON.stringify(memoryQuickAddFrequencies));
  return label;
}

/**
 * Persists a submitted Trip entry to frequency memory and storage.
 */
export async function recordTripSubmission(name: string): Promise<string | null> {
  const base = extractBaseTripName(name);
  if (!base) return null;
  const key = base.toLowerCase();
  memoryTripFrequencies[key] = (memoryTripFrequencies[key] || 0) + 1;
  await safeSetMeta(META_KEY_TRIP_FREQUENCIES, JSON.stringify(memoryTripFrequencies));
  return base;
}

/**
 * Loads stored frequency records from app metadata.
 */
export async function loadStoredFrequencies(): Promise<{
  quickAdd: Record<string, number>;
  trips: Record<string, number>;
}> {
  const [qaRaw, tripsRaw] = await Promise.all([
    safeGetMeta(META_KEY_QUICK_ADD_FREQUENCIES),
    safeGetMeta(META_KEY_TRIP_FREQUENCIES),
  ]);
  if (qaRaw) {
    try {
      Object.assign(memoryQuickAddFrequencies, JSON.parse(qaRaw));
    } catch {}
  }
  if (tripsRaw) {
    try {
      Object.assign(memoryTripFrequencies, JSON.parse(tripsRaw));
    } catch {}
  }
  return {
    quickAdd: { ...memoryQuickAddFrequencies },
    trips: { ...memoryTripFrequencies },
  };
}

/**
 * Returns deterministic destination recommendations with current year,
 * ranked by frequency (highest probability first).
 * Remembers user's past trips (e.g. "Serbia") even if not in default destinations.
 */
export function getTripNameRecommendations(
  trips: Trip[] = [],
  query: string = '',
  isZh: boolean = false,
  currentYear: number = new Date().getFullYear(),
  extraFrequencies: Record<string, number> = {}
): TripRecommendation[] {
  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  // Map of lowercase key -> aggregated data
  const frequencyMap = new Map<string, { baseName: string; count: number; destinationKey: DestinationKey | null }>();

  // 1. Gather counts from existing trips
  for (const tr of trips) {
    if (!tr.name) continue;
    const base = extractBaseTripName(tr.name);
    if (!base) continue;
    const key = base.toLowerCase();
    const existing = frequencyMap.get(key);
    const destKey = matchDestination(base);
    if (existing) {
      existing.count += 1;
    } else {
      frequencyMap.set(key, { baseName: base, count: 1, destinationKey: destKey });
    }
  }

  // 2. Incorporate extra recorded frequencies
  for (const [rawName, count] of Object.entries(extraFrequencies)) {
    const base = extractBaseTripName(rawName);
    if (!base) continue;
    const key = base.toLowerCase();
    const existing = frequencyMap.get(key);
    const destKey = matchDestination(base);
    if (existing) {
      existing.count += count;
    } else {
      frequencyMap.set(key, { baseName: base, count, destinationKey: destKey });
    }
  }

  // 3. Supplement with popular destinations if not already present (base count = 0)
  for (const dest of POPULAR_DESTINATIONS) {
    const name = isZh ? dest.nameZh : dest.name;
    const key = name.toLowerCase();
    if (!frequencyMap.has(key)) {
      frequencyMap.set(key, { baseName: name, count: 0, destinationKey: dest.key });
    }
  }

  // 4. Also check full DESTINATIONS catalogue for typed queries
  if (trimmed) {
    for (const dest of DESTINATIONS) {
      const name = isZh ? dest.labelZh : dest.label;
      const key = name.toLowerCase();
      if (!frequencyMap.has(key)) {
        frequencyMap.set(key, { baseName: name, count: 0, destinationKey: dest.key });
      }
    }
  }

  // Build candidate list and filter by query
  const candidates: TripRecommendation[] = [];

  for (const item of frequencyMap.values()) {
    const displayName = `${item.baseName} ${currentYear}`;
    // Omit exact match when user has already completed typing the exact recommendation
    if (displayName.toLowerCase() === q) continue;

    if (trimmed) {
      const destInfo = item.destinationKey ? DESTINATIONS.find((d) => d.key === item.destinationKey) : null;
      const matches =
        item.baseName.toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q) ||
        (destInfo && (
          destInfo.label.toLowerCase().includes(q) ||
          destInfo.labelZh.includes(trimmed) ||
          destInfo.aliases.some((a) => a.toLowerCase().includes(q) || a.includes(trimmed))
        ));

      if (!matches) continue;
    }

    candidates.push({
      name: displayName,
      destinationKey: item.destinationKey,
      count: item.count,
    });
  }

  // 5. Rank by frequency / probability descending
  candidates.sort((a, b) => b.count - a.count);

  return candidates.slice(0, 10);
}

/**
 * Returns deterministic transaction recommendations (without amounts) for QuickAdd,
 * ranked by frequency (highest probability first).
 * - Hides immediately (returns []) if query contains digits/numbers.
 * - Remembers user's custom inputs (e.g. "Laksa").
 */
export function getQuickAddRecommendations(
  transactions: Transaction[] = [],
  query: string = '',
  isZh: boolean = false,
  extraFrequencies: Record<string, number> = {}
): string[] {
  // If input contains digits or numbers, hide recommendations immediately
  if (/\d/.test(query)) {
    return [];
  }

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  const frequencyMap = new Map<string, { display: string; count: number }>();

  // 1. Gather counts from transaction history
  for (const tx of transactions) {
    const label = extractLabelFromQuickAdd(tx.merchantRaw || '');
    if (!label) continue;
    const key = label.toLowerCase();
    const existing = frequencyMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      frequencyMap.set(key, { display: label, count: 1 });
    }
  }

  // 2. Incorporate extra recorded frequencies
  for (const [rawLabel, count] of Object.entries(extraFrequencies)) {
    const label = extractLabelFromQuickAdd(rawLabel);
    if (!label) continue;
    const key = label.toLowerCase();
    const existing = frequencyMap.get(key);
    if (existing) {
      existing.count += count;
    } else {
      frequencyMap.set(key, { display: label, count });
    }
  }

  // 3. Supplement with default starters (base count = 0)
  const starters = isZh ? DEFAULT_QUICK_ADD_STARTERS_ZH : DEFAULT_QUICK_ADD_STARTERS_EN;
  for (const starter of starters) {
    const key = starter.toLowerCase();
    if (!frequencyMap.has(key)) {
      frequencyMap.set(key, { display: starter, count: 0 });
    }
  }

  // 4. Filter by query
  const candidates: { display: string; count: number }[] = [];
  for (const item of frequencyMap.values()) {
    const lower = item.display.toLowerCase();
    if (trimmed) {
      if (lower === q) continue; // Omit exact match when user has already completed typing
      const matchesSubstring = lower.includes(q);
      let matchesFuzzy = false;
      if (!matchesSubstring && q.length >= 3) {
        const words = lower.split(/\s+/);
        for (const w of words) {
          const maxDist = Math.min(q.length, w.length) >= 7 ? 2 : 1;
          if (Math.abs(w.length - q.length) <= maxDist) {
            if (damerauLevenshtein(q, w, maxDist) <= maxDist) {
              matchesFuzzy = true;
              break;
            }
          }
        }
      }
      if (!matchesSubstring && !matchesFuzzy) continue;
    }
    candidates.push(item);
  }

  // 5. Rank by frequency / probability descending
  candidates.sort((a, b) => b.count - a.count);

  return candidates.map((c) => c.display).slice(0, 10);
}
