// src/lib/import.ts
// Pure, deterministic helpers for importing transactions from a document.
// No UI / database / file-system imports  everything here is unit-tested.
import { DEFAULT_EXPENSE_ID, DEFAULT_INCOME_ID } from '../data/categories';
import { findDuplicate } from './duplicates';
import { suggestForMerchant } from './recommend';
import { DROP, type Category, type ExtractedTxn, type MemoryMap, type Transaction, type TxnType } from './types';

export type DocKind = 'binary' | 'csv' | 'xlsx' | 'docx' | 'unsupported';

function ext(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

/**
 * How a picked file should be read: `binary` (PDF/image → sent straight to the
 * vision model), `csv`/`xlsx`/`docx` (read to text on-device), or `unsupported`.
 * Falls back to the filename extension when the mime type is generic.
 */
export function docKindFromMime(mime: string, name: string): DocKind {
  const m = (mime || '').toLowerCase();
  const e = ext(name);
  if (m === 'application/pdf' || e === 'pdf') return 'binary';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(e)) return 'binary';
  if (m === 'text/csv' || e === 'csv') return 'csv';
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel' || e === 'xlsx' || e === 'xls') return 'xlsx';
  if (m.includes('wordprocessingml') || e === 'docx') return 'docx';
  return 'unsupported';
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

/** Flatten a DOCX `word/document.xml` body into plain text (one line per paragraph). */
export function docxXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, (m) => ENTITIES[m] ?? m)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Keyword synonyms for each category id. Used to fuzzy-match free-form
 * LLM descriptions back to app categories. Checked as whole-word substrings
 * (case-insensitive) against the hint string.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // expense  keyed on the 7-category defaults in src/data/categories.ts (2026-08-21 retune).
  // Buckets that absorbed more than one old category (food, other) carry the union of the
  // old keyword lists; buckets that narrowed (travelling from transport, rental from housing,
  // car-instalment from debt-service) kept the old list as-is rather than trying to guess
  // which merchant belongs to the narrower new meaning.
  food:           ['groceries', 'grocery', 'supermarket', 'hypermarket', 'market', 'pasar', 'aeon', 'tesco', 'mydin', 'jaya', 'lotus', 'cold storage', 'speedmart', 'provisions', 'dining', 'restaurant', 'food', 'meal', 'lunch', 'dinner', 'breakfast', 'mamak', 'hawker', 'bistro', 'eatery', 'pizza', 'burger', 'mcd', 'kfc', 'domino', 'subway', 'foodpanda', 'coffee', 'café', 'cafe', 'teh', 'kopitiam', 'starbucks', 'zus', 'oldtown', 'boba', 'bubble tea', 'milk tea'],
  entertainment:  ['recreation', 'entertainment', 'movie', 'cinema', 'game', 'gaming', 'sport', 'gym', 'fitness', 'concert', 'event', 'hobby', 'netflix', 'spotify', 'subscription'],
  travelling:     ['transport', 'fuel', 'petrol', 'diesel', 'petronas', 'shell', 'caltex', 'bhp', 'grab', 'uber', 'lyft', 'taxi', 'bus', 'train', 'lrt', 'mrt', 'ktm', 'toll', 'parking', 'transit', 'ride', 'commute', 'touch n go', 'travel', 'holiday', 'flight', 'airasia', 'airline', 'hotel', 'agoda'],
  insurance:      ['insurance', 'takaful', 'premium', 'policy', 'bank charge', 'service charge', 'admin fee', 'late fee', 'stamp duty', 'zakat', 'donation', 'derma'],
  rental:         ['housing', 'rent', 'rental', 'sewa', 'utility', 'utilities', 'electricity', 'water', 'gas', 'lpg', 'maintenance', 'quit rent', 'assessment', 'tnb', 'syabas', 'air selangor', 'indah water'],
  'car-instalment': ['loan repayment', 'debt repayment', 'repayment', 'installment', 'instalment', 'ansuran', 'financing', 'hire purchase', 'mortgage', 'credit card payment', 'ptptn'],
  other:          ['other', 'miscellaneous', 'misc', 'unknown', 'communication', 'internet', 'broadband', 'phone', 'mobile', 'telco', 'prepaid', 'postpaid', 'unifi', 'maxis', 'celcom', 'digi', 'umobile', 'yes', 'astro', 'postage', 'health', 'medical', 'hospital', 'clinic', 'klinik', 'pharmacy', 'doctor', 'dentist', 'medicine', 'guardian', 'watson', 'lab', 'optical', 'education', 'school', 'sekolah', 'tuition', 'tadika', 'nursery', 'childcare', 'college', 'university', 'course', 'exam', 'textbook', 'stationery', 'yuran', 'household', 'shopping', 'shop', 'retail', 'store', 'fashion', 'clothing', 'apparel', 'furniture', 'appliance', 'toiletries', 'personal care', 'salon', 'barber', 'laundry', 'lazada', 'shopee', 'amazon', 'zalora', 'ikea', 'h&m', 'uniqlo'],
  // income  split by source, the way a P&L is
  'employment-income': ['salary', 'wage', 'payroll', 'gaji', 'employment', 'remuneration', 'bonus', 'overtime', 'ot claim'],
  'business-income':   ['business', 'trade', 'sales', 'takings', 'revenue', 'turnover', 'jualan', 'niaga', 'shopee payout', 'lazada payout', 'customer payment'],
  'gig-income':        ['gig', 'commission', 'incentive', 'platform', 'payout', 'grab payout', 'foodpanda payout', 'delivery earning', 'freelance', 'fee earned'],
  'transfers-in':      ['allowance', 'elaun', 'stipend', 'subsidy', 'subsistence', 'transfer', 'family support', 'bantuan', 'str', 'bsh', 'aid', 'pocket money'],
  'investment-income': ['dividend', 'dividen', 'interest', 'faedah', 'yield', 'coupon', 'profit distribution', 'hibah', 'rental income', 'asb', 'tabung haji'],
  'other-income':      ['other', 'refund', 'rebate', 'return', 'reimbursement', 'collect debt', 'sale of asset', 'windfall'],
};

/** Map a free-form LLM category description to an app category id of matching kind.
 *  Tries exact label match first, then keyword scan, then returns null. */
export function matchSourceCategory(
  hint: string | null | undefined,
  categories: Category[],
  type: TxnType
): string | null {
  if (!hint) return null;
  const needle = hint.trim().toLowerCase();
  if (!needle) return null;

  // 1. Exact label match (fast path, original behaviour).
  const exact = categories.find((c) => c.kind === type && c.label.trim().toLowerCase() === needle);
  if (exact) return exact.id;

  // 2. Fuzzy keyword scan: check if any keyword appears in the hint as a substring.
  const sameKind = categories.filter((c) => c.kind === type);
  for (const cat of sameKind) {
    const kws = CATEGORY_KEYWORDS[cat.id] ?? [];
    if (kws.some((kw) => needle.includes(kw))) return cat.id;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source category vocabulary
//
// Exports from a tracker (a spreadsheet the user already keeps by hand) carry
// their own category labels: a small set repeated over many rows. Those labels
// are the user's own taxonomy and must survive the import intact. A label like
// "Toll" or "Fuel" would otherwise be swallowed by the broad `travelling`
// keyword list, and "fyy" would land in the default bucket. Statements, by
// contrast, carry varied free-text hints that SHOULD be keyword-mapped.
// ─────────────────────────────────────────────────────────────────────────────

/** Prefix marking a category the import wants but that does not exist yet. */
export const PENDING_CAT = 'pending:';

export interface SourceLabel {
  /** Display casing (the most common spelling seen in the document). */
  label: string;
  kind: TxnType;
  /** How many rows carried this label. */
  count: number;
  /** Existing category with this exact label, or null if it must be created. */
  existingId: string | null;
}

export interface SourceVocabulary {
  /** True when the hints look like a tracker's own taxonomy rather than free text. */
  isTracker: boolean;
  labels: SourceLabel[];
}

// A tracker needs enough rows for the ratio to mean anything, a small label
// set, and each label repeated rather than used once.
const TRACKER_MIN_ROWS = 10;
const TRACKER_MAX_LABELS = 15;
const TRACKER_MIN_ROWS_PER_LABEL = 5;

const vocabKey = (kind: TxnType, label: string) => `${kind} ${label.trim().toLowerCase()}`;

/**
 * Inventory the category labels an import carries, and judge whether they look
 * like a tracker's own taxonomy. `isTracker` is advisory: the caller decides
 * whether to actually honour the vocabulary (see `assignImported`).
 */
export function detectSourceVocabulary(
  items: ExtractedTxn[],
  categories: Category[]
): SourceVocabulary {
  const groups = new Map<string, { kind: TxnType; count: number; casings: Map<string, number> }>();
  let hinted = 0;

  for (const it of items) {
    const raw = typeof it.categoryHint === 'string' ? it.categoryHint.trim() : '';
    if (!raw) continue;
    hinted++;
    const key = vocabKey(it.type, raw);
    let g = groups.get(key);
    if (!g) {
      g = { kind: it.type, count: 0, casings: new Map() };
      groups.set(key, g);
    }
    g.count++;
    g.casings.set(raw, (g.casings.get(raw) ?? 0) + 1);
  }

  const labels: SourceLabel[] = [...groups.values()].map((g) => {
    // Most common spelling wins; insertion order breaks ties, so the first
    // spelling seen is kept when two are equally common.
    let label = '';
    let best = -1;
    for (const [casing, n] of g.casings) {
      if (n > best) {
        best = n;
        label = casing;
      }
    }
    const existing = categories.find(
      (c) => c.kind === g.kind && c.label.trim().toLowerCase() === label.toLowerCase()
    );
    return { label, kind: g.kind, count: g.count, existingId: existing ? existing.id : null };
  });

  const isTracker =
    hinted >= TRACKER_MIN_ROWS &&
    labels.length > 0 &&
    labels.length <= TRACKER_MAX_LABELS &&
    hinted / labels.length >= TRACKER_MIN_ROWS_PER_LABEL;

  return { isTracker, labels };
}

/** The source label behind a `pending:` id, or null for a real id. */
export function pendingLabel(id: string | null | undefined): string | null {
  return typeof id === 'string' && id.startsWith(PENDING_CAT)
    ? id.slice(PENDING_CAT.length)
    : null;
}

/**
 * Swap `pending:` ids for the real category ids created at commit time. A label
 * missing from `created` was declined by the user, so its rows are dropped
 * rather than silently filed somewhere they were never meant to go.
 */
export function resolvePending(
  assignments: (string | null)[],
  created: Record<string, string>
): (string | null)[] {
  return assignments.map((a) => {
    const label = pendingLabel(a);
    if (label === null) return a;
    return created[label] ?? DROP;
  });
}

/** label+kind → the category id to use, real or `pending:`-prefixed. */
function vocabularyIndex(vocabulary: SourceVocabulary): Map<string, string> {
  const index = new Map<string, string>();
  for (const l of vocabulary.labels) {
    index.set(vocabKey(l.kind, l.label), l.existingId ?? `${PENDING_CAT}${l.label}`);
  }
  return index;
}

/**
 * Choose a category for each imported row.
 *
 * When `vocabulary` is passed the document's own labels win outright  the user
 * asked to keep them, so they beat both learned memory and keyword mapping.
 * Rows the document did not label, and every row when no vocabulary is passed,
 * fall through to the original order: learned memory (only when its kind
 * matches the row), then the category hint, then the generic fallback.
 */
export function assignImported(
  items: ExtractedTxn[],
  memory: MemoryMap,
  categories: Category[],
  catById: Record<string, Category>,
  vocabulary?: SourceVocabulary | null
): string[] {
  const sourceIds = vocabulary ? vocabularyIndex(vocabulary) : null;

  return items.map((it) => {
    if (sourceIds) {
      const raw = typeof it.categoryHint === 'string' ? it.categoryHint.trim() : '';
      const fromSource = raw ? sourceIds.get(vocabKey(it.type, raw)) : undefined;
      if (fromSource) return fromSource;
    }

    const learned = suggestForMerchant(memory, it.merchant);
    if (learned && catById[learned] && catById[learned].kind === it.type) return learned;

    const hinted = matchSourceCategory(it.categoryHint, categories, it.type);
    if (hinted) return hinted;

    return it.type === 'income' ? DEFAULT_INCOME_ID : DEFAULT_EXPENSE_ID;
  });
}

/**
 * Mark rows that exactly match an already-saved transaction as DROP so the
 * commit step skips them. Returns the adjusted assignments and how many were
 * skipped.
 */
export function applyDedup(
  items: ExtractedTxn[],
  assignments: (string | null)[],
  existing: Transaction[],
  today: string
): { assignments: (string | null)[]; skipped: number } {
  let skipped = 0;
  const out = assignments.map((a, i) => {
    const it = items[i];
    const dup = findDuplicate(existing, { merchant: it.merchant, amount: it.amount, date: it.date }, today);
    if (dup) {
      skipped++;
      return DROP;
    }
    return a;
  });
  return { assignments: out, skipped };
}
