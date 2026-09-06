# Optional Categories, Trips, and Trips Discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a supplied catalogue of optional expense categories with reversible hiding and durable presentation overrides (Stage A), write the Trips discovery protocol (Stage B), and implement the Trips grouping MVP (Stage C).

**Architecture:** Categories gain four pieces of metadata (`is_hidden`, `template_key`, and `label_override`/`icon_override`/`hue_override`) on the existing flat schema — no hierarchy, no new identity. A single `resolveCategoryPresentation` helper replaces today's split between `getCategoryLabel` and raw row fields, so an explicit user override always beats a supplied translation. Startup seeding stops overwriting default presentation and becomes purely additive. Trips are a second, orthogonal grouping dimension: a nullable `transactions.trip_id` on the existing row, never a duplicate ledger.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, expo-sqlite 16, Jest (`jest-expo` preset), hand-rolled screen switcher in `App.tsx` (no navigation library), custom i18n (`en`/`zh`).

**Spec:** `docs/superpowers/specs/2026-09-06-optional-categories-trips-and-ask-pip-prd.md`

**Out of scope (explicitly excluded by the scope decision):** Stage D, Ask Pip. No LLM question→query layer, no answer card, no conversational navigation. Also excluded by the spec itself: category hierarchy, automatic historical recategorization, an onboarding category-preference step, automatic activation of optional categories, and the Section 3.4 candidate areas (Bills, Health, Shopping sub-splits, Family & pets, Giving, non-car Transport).

## Global Constraints

- **Category IDs are stable and never reused.** New optional categories get `opt-` prefixed IDs. Never recreate a `groceries`, `coffee`, `transport`, `fuel`, or any other key of `CATEGORY_ID_REMAP` as a live category ID — `migrateCategoryIds` would delete it on the next launch.
- **Display names are never database identities.** Match suggestions on `template_key`, never on label.
- **Starter set is unchanged:** 8 expense (`food`, `shopping`, `entertainment`, `other`, `travelling`, `insurance`, `rental`, `phone-bill`) + 3 income (`salary`, `allowance`, `other-income`). Adding the catalogue must not change these counts.
- **`travelling` keeps its ID.** Only its English display label changes to `Transport`. No new `transport` ID, no transaction remap.
- **Optional catalogue is exactly 6 entries in 2 groups**, all inactive until selected: Car & transport (Petrol, Car Maintenance, Parking & Tolls); Food & drinks (Groceries, Eating Out, Coffee & Snacks).
- **Hiding is not deletion.** Hidden categories stay in history, reports, budget allocations, and budget snapshots. Only new-entry choices and LLM options filter them out.
- **At least one visible expense category and one visible income category must always remain.**
- **Adding a category never creates a budget allocation.**
- **Batch activation is atomic** — one transaction, no partial duplicates, idempotent under repeated taps.
- **Startup must be idempotent.** Reopening or upgrading must not add optional categories, resurrect deleted defaults, or erase overrides.
- **Trips: one expense belongs to at most one trip.** Reuse the original transaction row; never duplicate.
- **Trip totals are labelled "Recorded expenses"**, sum expense rows only, exclude transfers and income, and use `useDisplayCurrency().convertTxn` as the single conversion rule for headline, breakdown, and drill-down alike.
- **Split transactions already store the personal share** in `transactions.amount` (`splits.gross` holds the full bill). Trip totals must NOT subtract repayments a second time.
- Every schema change is an `ALTER TABLE` inside a `try {} catch {}` block, matching the existing migration idiom in `src/db/db.ts:208-300`.
- Run `npx jest <file>` for focused tests and `npm run typecheck` before each commit.

## Known gaps in this plan

Stated up front so an executor does not mistake them for oversights.

1. **Tasks 9, 10, 18, and 19 specify UI screens as requirements plus the load-bearing handlers, not as complete JSX.** The logic that can be silently wrong — the hide guard with its two failure branches, the edit-modal grid that must still show a hidden category the row already points at, the totals engine — is given as real code. The surrounding layout is specified by behaviour, existing component to reuse, and accessibility requirement. These four tasks need design judgement at the keyboard; writing 2,000 lines of speculative React Native here would be guesswork dressed as a plan.
2. **Task 7 Step 4 says "read lines 200-280 and substitute".** The suggestion-resolution code in `AddFlow.tsx` is interleaved with relief detection and split drafting; the exact insertion point depends on the state of that file when the task runs. The extracted `resolveSuggestion` is fully specified and fully tested — only the call site is left to locate.
3. **Stage A acceptance criterion 14 is not implemented.** `deleteCategory` still picks an arbitrary fallback rather than requiring an explicitly chosen replacement (`src/db/categoriesRepo.ts:120-124`). Task 13 records this rather than claiming a pass.
4. **The override migration cannot recover edits the old seed already destroyed.** Startup seeding has been overwriting default `label`/`icon`/`hue` on every launch, so any customisation made before a user's last restart is gone. Task 3 preserves what is still there and deliberately does not guess at the rest.
5. **Stage C is being built ahead of its evidence gate.** The spec conditions Trips on Stage B findings; the scope decision for this plan overrides that. Task 14's protocol is still worth running before wider release.

---

## File Structure

**Stage A — new files**

| File | Responsibility |
| --- | --- |
| `src/data/optionalCategories.ts` | The 6-entry catalogue: template keys, safe IDs, group membership, icon/hue defaults, search aliases. Pure data + lookup helpers. No DB, no RN imports. |
| `src/data/categoryTemplates.ts` | Starter template-key table and the historical-default-label table the override migration reads. Pure data. |
| `src/lib/categoryPresentation.ts` | `resolveCategoryPresentation(cat, lang)` — the single shared override → template → stored resolution helper. |
| `src/components/AddCategorySheet.tsx` | The shared add surface: Suggested tab (search, multi-select, batch confirm) + Create your own tab. |
| `__tests__/optionalCategories.test.ts` | Catalogue shape, ID-collision guard, search aliases. |
| `__tests__/categoryPresentation.test.ts` | Override precedence, language switching, verbatim custom labels. |
| `__tests__/categoryVisibility.test.ts` | Hide/show repo behaviour against the recording fake DB. |
| `__tests__/categoryActivation.test.ts` | Idempotent batch activation. |

**Stage A — modified files**

| File | Change |
| --- | --- |
| `src/lib/types.ts:43-50` | `Category` gains `isHidden`, `templateKey`, `labelOverride`, `iconOverride`, `hueOverride`. |
| `src/db/db.ts:21-206` | Five new `categories` columns + partial unique index on `template_key`. |
| `src/db/db.ts:361-404` | `seedCategories` stops overwriting `label`/`icon`/`hue`; stamps starter template keys. |
| `src/db/db.ts` (new fn) | `migrateCategoryOverrides` — one-time, meta-flag-guarded capture of stored edits into override columns. |
| `src/db/categoriesRepo.ts` | `toCategory` reads new columns; add `setCategoryHidden`, `activateSuggestedCategories`, `updateCategoryHue`; `updateCategoryLabel`/`updateCategoryIcon` write overrides. |
| `src/i18n/categories.ts` | `getCategoryLabel` delegates to `resolveCategoryPresentation`. |
| `src/i18n/types.ts`, `translations/en.ts`, `translations/zh.ts` | Catalogue names/descriptions/group titles + add-sheet and hide/show UI strings. |
| `src/state/store.tsx` | `entryCategories` selector; `setCategoryHidden`, `activateSuggested`, `updateCategoryHue` actions. |
| `src/screens/CategoriesScreen.tsx` | Hidden section, hide/show actions, rename field, launches `AddCategorySheet`. |
| `src/screens/CategorizeScreen.tsx:72-73`, `src/screens/ManualEntryScreen.tsx:216`, `src/components/EditTransactionModal.tsx:111` | Entry grids use visible-only lists. |
| `src/screens/AddFlow.tsx:214,297` | LLM category options filtered to visible; hidden responses rejected. |
| `src/lib/financialExport.ts:546-556,694-695` | Serialize new category fields. |
| `src/db/restoreRepo.ts:61,104-120` | Restore new fields; tolerate older backups. |
| `src/i18n/categories.ts` (`travelling`) | English label → `Transport`. |
| `src/data/categories.ts:18` | `travelling` seed label → `Transport`. |
| `__tests__/categoryIntegrity.test.ts` | Extend for template keys and the `opt-`/remap collision guard. |

**Stage B — new file**

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-09-06-trips-usability-study-protocol.md` | Recruitment screener, fixture ledger, task script, facilitation rules, observation sheet, go/revise/defer gate. |

**Stage C — new files**

| File | Responsibility |
| --- | --- |
| `src/lib/trips.ts` | `Trip` type + pure totals engine (`computeTripTotals`, `tripCategoryBreakdown`). No DB, no RN. |
| `src/db/tripsRepo.ts` | CRUD + membership writes. |
| `src/screens/TripsScreen.tsx` | Trip list, create, archived section. |
| `src/screens/TripDetailScreen.tsx` | Total, category breakdown, transaction list, Add expense, Add existing expenses. |
| `src/components/TripPickerModal.tsx` | The optional Trip selector used from More details. |
| `__tests__/trips.test.ts` | Totals contract: double-counting, currency, splits, transfers, advance bookings. |
| `__tests__/tripsRepo.test.ts` | Membership changes, archiving, delete-clears-membership. |

**Stage C — modified files**

| File | Change |
| --- | --- |
| `src/db/db.ts` | `trips` table, `transactions.trip_id`, index, `resetAllData` clears trips. |
| `src/db/txnRepo.ts:41-124,173+` | `NewTxn.tripId`, `toTxn` reads `trip_id`, `updateTransactionTrip`. |
| `src/lib/types.ts` | `Transaction.tripId`. |
| `src/lib/screenNav.ts:7-27,40+` | `'trips'` and `'tripDetail'` screens + back targets. |
| `App.tsx` | Route the two new screens. |
| `src/screens/AllTransactionsScreen.tsx` | Trips entry chip + "Add to trip" bulk action in select mode. |
| `src/state/store.tsx` | Trip state, actions, and `writeOffShare` trip inheritance. |
| `src/components/EditTransactionModal.tsx` | Trip selector in More details. |
| `src/lib/financialExport.ts`, `src/db/restoreRepo.ts`, `src/lib/backupBundle.ts` | Trips + membership round-trip. |

---

# STAGE A — Optional categories, visibility, and durable customization

### Task 1: Category template data and the optional catalogue

**Files:**
- Create: `src/data/categoryTemplates.ts`
- Create: `src/data/optionalCategories.ts`
- Test: `__tests__/optionalCategories.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_ID_REMAP`, `ALL_SEED_CATEGORIES` from `src/data/categories.ts`.
- Produces:
  - `STARTER_TEMPLATE_KEYS: Record<string, string>` — seed category ID → template key.
  - `HISTORICAL_DEFAULT_LABELS: Record<string, string[]>` — seed ID → every label that ID has ever shipped with (en + zh), used by the override migration to tell a user edit from a stale default.
  - `OptionalCategory` interface and `OPTIONAL_CATEGORIES: OptionalCategory[]`.
  - `OPTIONAL_GROUPS: readonly ['car', 'food']`.
  - `optionalByTemplateKey(key: string): OptionalCategory | undefined`.
  - `searchOptionalCategories(query: string, lang: 'en' | 'zh'): OptionalCategory[]`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/optionalCategories.test.ts`:

```ts
// __tests__/optionalCategories.test.ts
// The optional catalogue is supplied data that becomes real database rows on activation, so
// the two failure modes worth guarding are structural: an id that collides with a retired
// default (which migrateCategoryIds would delete on the next launch), and a template key that
// drifts out of sync with the translations keyed on it.
import { CATEGORY_ID_REMAP, ALL_SEED_CATEGORIES } from '../src/data/categories';
import {
  OPTIONAL_CATEGORIES,
  OPTIONAL_GROUPS,
  optionalByTemplateKey,
  searchOptionalCategories,
} from '../src/data/optionalCategories';
import { STARTER_TEMPLATE_KEYS, HISTORICAL_DEFAULT_LABELS } from '../src/data/categoryTemplates';

describe('optional catalogue shape', () => {
  it('has exactly six entries across the two shipped groups', () => {
    expect(OPTIONAL_CATEGORIES).toHaveLength(6);
    expect(OPTIONAL_GROUPS).toEqual(['car', 'food']);
    expect(OPTIONAL_CATEGORIES.filter((c) => c.group === 'car')).toHaveLength(3);
    expect(OPTIONAL_CATEGORIES.filter((c) => c.group === 'food')).toHaveLength(3);
  });

  it('every entry is an expense category with unique id and template key', () => {
    expect(new Set(OPTIONAL_CATEGORIES.map((c) => c.id)).size).toBe(6);
    expect(new Set(OPTIONAL_CATEGORIES.map((c) => c.templateKey)).size).toBe(6);
    for (const c of OPTIONAL_CATEGORIES) {
      expect(c.kind).toBe('expense');
      expect(c.id).toMatch(/^opt-[a-z0-9-]+$/);
      expect(c.templateKey).toMatch(/^optional\.(car|food)\.[a-z-]+\.v1$/);
      expect(Number.isFinite(c.hue)).toBe(true);
      expect(c.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('no optional id collides with a retired default or a live seed id', () => {
    const retired = new Set(Object.keys(CATEGORY_ID_REMAP));
    const live = new Set(ALL_SEED_CATEGORIES.map((c) => c.id));
    for (const c of OPTIONAL_CATEGORIES) {
      expect(retired.has(c.id)).toBe(false);
      expect(live.has(c.id)).toBe(false);
    }
  });

  it('resolves an entry by its template key', () => {
    expect(optionalByTemplateKey('optional.car.petrol.v1')?.id).toBe('opt-petrol');
    expect(optionalByTemplateKey('optional.car.nope.v1')).toBeUndefined();
  });
});

describe('search', () => {
  it('matches local wording as well as the shipped name', () => {
    expect(searchOptionalCategories('fuel', 'en').map((c) => c.id)).toEqual(['opt-petrol']);
    expect(searchOptionalCategories('servicing', 'en').map((c) => c.id)).toEqual(['opt-car-maintenance']);
    expect(searchOptionalCategories('toll', 'en').map((c) => c.id)).toEqual(['opt-parking-tolls']);
  });

  it('matches Chinese names', () => {
    expect(searchOptionalCategories('汽油', 'zh').map((c) => c.id)).toEqual(['opt-petrol']);
  });

  it('an empty query returns the whole catalogue in catalogue order', () => {
    expect(searchOptionalCategories('  ', 'en')).toHaveLength(6);
  });
});

describe('starter templates', () => {
  it('gives every seeded category a template key', () => {
    for (const c of ALL_SEED_CATEGORIES) {
      expect(STARTER_TEMPLATE_KEYS[c.id]).toMatch(/^starter\.[a-z-]+\.v1$/);
    }
    expect(new Set(Object.values(STARTER_TEMPLATE_KEYS)).size).toBe(ALL_SEED_CATEGORIES.length);
  });

  it('lists the current label among each id historical labels', () => {
    for (const c of ALL_SEED_CATEGORIES) {
      expect(HISTORICAL_DEFAULT_LABELS[c.id]).toContain(c.label);
    }
  });

  it('remembers Travelling so the Transport relabel is not read as a user edit', () => {
    expect(HISTORICAL_DEFAULT_LABELS['travelling']).toContain('Travelling');
    expect(HISTORICAL_DEFAULT_LABELS['travelling']).toContain('Transport');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/optionalCategories.test.ts`
Expected: FAIL — `Cannot find module '../src/data/optionalCategories'`

- [ ] **Step 3: Write `src/data/categoryTemplates.ts`**

```ts
// src/data/categoryTemplates.ts
// Template identity for the supplied categories, kept separate from ALL_SEED_CATEGORIES so the
// catalogue and the starter set can evolve without either one deciding the other's shape.
//
// A template key is the STABLE identity of a supplied category: it survives renames, icon
// changes and translation edits, because none of those touch it. `is_default` used to carry
// this job and could not — it is a boolean, so it cannot tell "Food" from "Petrol", and it
// flips meaning the moment a user edits the row.
import { ALL_SEED_CATEGORIES } from './categories';

/** Seed category id -> its stable template key. */
export const STARTER_TEMPLATE_KEYS: Record<string, string> = {
  food: 'starter.food.v1',
  shopping: 'starter.shopping.v1',
  entertainment: 'starter.entertainment.v1',
  other: 'starter.other.v1',
  travelling: 'starter.travelling.v1',
  insurance: 'starter.insurance.v1',
  rental: 'starter.rental.v1',
  'phone-bill': 'starter.phone-bill.v1',
  salary: 'starter.salary.v1',
  allowance: 'starter.allowance.v1',
  'other-income': 'starter.other-income.v1',
};

/**
 * Every display label a default category has ever shipped with, in either language.
 *
 * The override migration uses this to answer one question: is the label stored on this row
 * something Pip put there, or something the user typed? A stored label that appears here is a
 * supplied default (possibly a stale one from an older release) and is left alone; anything
 * else is a deliberate rename and is preserved as an explicit `label_override`.
 *
 * `travelling` carries both 'Travelling' and 'Transport' because the 2026-09-06 relabel changes
 * the supplied wording — without the old entry, every upgraded install would read its untouched
 * 'Travelling' row as a user rename and pin it there forever.
 */
export const HISTORICAL_DEFAULT_LABELS: Record<string, string[]> = {
  food: ['Food', 'Dining', '餐饮美食', '餐饮'],
  shopping: ['Shopping', '购物消费', '购物'],
  entertainment: ['Entertainment', 'Recreation', '休闲娱乐', '娱乐'],
  other: ['Other Expenses', 'Other', '其他支出', '其他'],
  travelling: ['Travelling', 'Transport', 'Transportation', '交通出行', '交通'],
  insurance: ['Insurance', '保险保障', '保险'],
  rental: ['Rental', 'Housing', 'Bills', '房租居住', '房租'],
  'phone-bill': ['Phone Bill', 'Communications', '通讯话费', '通讯'],
  salary: ['Salary', 'Employment Income', '工资薪金', '工资'],
  allowance: ['Allowance', 'Transfers Received', '津贴补贴', '津贴'],
  'other-income': ['Other Income', 'Business Revenue', '其他收入'],
};

/** True when `label` is a supplied default for `id` rather than something the user typed. */
export function isSuppliedDefaultLabel(id: string, label: string): boolean {
  const known = HISTORICAL_DEFAULT_LABELS[id];
  if (!known) return false;
  const trimmed = label.trim();
  return known.some((k) => k === trimmed);
}

/** The seed row for an id, used to tell an edited icon/hue from an untouched one. */
export const SEED_BY_ID = new Map(ALL_SEED_CATEGORIES.map((c) => [c.id, c]));
```

- [ ] **Step 4: Write `src/data/optionalCategories.ts`**

```ts
// src/data/optionalCategories.ts
// The supplied catalogue of categories a user can switch ON. Nothing here is seeded: a row only
// reaches the database when the user selects it (see `activateSuggestedCategories`).
//
// Ids are `opt-` prefixed on purpose. Two of these concepts — groceries and coffee — were once
// real default ids and are now keys of CATEGORY_ID_REMAP, which db.ts runs as a hard DELETE of
// any default row carrying them. Reusing the bare name would mean the category the user just
// added disappears the next time the app opens. The template key keeps the concept's identity;
// the id merely has to be safe and stable.
import type { TxnType } from '../lib/types';

export const OPTIONAL_GROUPS = ['car', 'food'] as const;
export type OptionalGroup = (typeof OPTIONAL_GROUPS)[number];

export interface OptionalCategory {
  /** The database id minted on activation. Never a CATEGORY_ID_REMAP key. */
  id: string;
  /** Stable identity, independent of display label. Unique across the catalogue. */
  templateKey: string;
  group: OptionalGroup;
  kind: TxnType;
  icon: string;
  hue: number;
  /** Fallback English name, used when no translation is loaded. */
  label: string;
  /** Lowercased search terms, including local wording the shipped name does not contain. */
  aliases: { en: string[]; zh: string[] };
}

export const OPTIONAL_CATEGORIES: OptionalCategory[] = [
  {
    id: 'opt-petrol',
    templateKey: 'optional.car.petrol.v1',
    group: 'car',
    kind: 'expense',
    icon: 'car',
    hue: 12,
    label: 'Petrol',
    aliases: { en: ['petrol', 'fuel', 'gas', 'diesel', 'ron95', 'ron97', 'pump'], zh: ['汽油', '油费', '加油', '柴油'] },
  },
  {
    id: 'opt-car-maintenance',
    templateKey: 'optional.car.maintenance.v1',
    group: 'car',
    kind: 'expense',
    icon: 'cash',
    hue: 42,
    label: 'Car Maintenance',
    aliases: { en: ['car maintenance', 'servicing', 'service', 'repair', 'repairs', 'tyre', 'tyres', 'workshop', 'parts'], zh: ['汽车保养', '维修', '保养', '轮胎', '修车'] },
  },
  {
    id: 'opt-parking-tolls',
    templateKey: 'optional.car.parking-tolls.v1',
    group: 'car',
    kind: 'expense',
    icon: 'receipt',
    hue: 200,
    label: 'Parking & Tolls',
    aliases: { en: ['parking', 'toll', 'tolls', 'touch n go', 'smarttag', 'plus'], zh: ['停车', '过路费', '收费站', '泊车'] },
  },
  {
    id: 'opt-groceries',
    templateKey: 'optional.food.groceries.v1',
    group: 'food',
    kind: 'expense',
    icon: 'cart',
    hue: 120,
    label: 'Groceries',
    aliases: { en: ['groceries', 'grocery', 'supermarket', 'market', 'wet market', 'mydin', 'tesco', 'lotus'], zh: ['杂货', '超市', '菜市场', '买菜'] },
  },
  {
    id: 'opt-eating-out',
    templateKey: 'optional.food.eating-out.v1',
    group: 'food',
    kind: 'expense',
    icon: 'utensils',
    hue: 162,
    label: 'Eating Out',
    aliases: { en: ['eating out', 'restaurant', 'dining', 'takeaway', 'delivery', 'mamak', 'kopitiam'], zh: ['外食', '餐厅', '外卖', '打包'] },
  },
  {
    id: 'opt-coffee-snacks',
    templateKey: 'optional.food.coffee-snacks.v1',
    group: 'food',
    kind: 'expense',
    icon: 'burger',
    hue: 330,
    label: 'Coffee & Snacks',
    aliases: { en: ['coffee', 'snack', 'snacks', 'drinks', 'tea', 'bubble tea', 'cafe', 'kopi'], zh: ['咖啡', '零食', '饮料', '奶茶', '下午茶'] },
  },
];

const BY_TEMPLATE_KEY = new Map(OPTIONAL_CATEGORIES.map((c) => [c.templateKey, c]));
const BY_ID = new Map(OPTIONAL_CATEGORIES.map((c) => [c.id, c]));

export function optionalByTemplateKey(key: string): OptionalCategory | undefined {
  return BY_TEMPLATE_KEY.get(key);
}

export function optionalById(id: string): OptionalCategory | undefined {
  return BY_ID.get(id);
}

/**
 * Catalogue search across shipped names and local wording, in catalogue order.
 * A blank query returns everything, which is what the sheet shows on open.
 */
export function searchOptionalCategories(query: string, lang: 'en' | 'zh'): OptionalCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...OPTIONAL_CATEGORIES];
  return OPTIONAL_CATEGORIES.filter((c) => {
    if (c.label.toLowerCase().includes(q)) return true;
    // Both alias lists are searched regardless of interface language: a user typing pinyin-free
    // English into a Chinese interface (or a brand like "SmartTag") should still find the row.
    return [...c.aliases.en, ...c.aliases.zh].some((a) => a.includes(q));
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/optionalCategories.test.ts`
Expected: PASS (14 assertions across 8 tests)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add src/data/categoryTemplates.ts src/data/optionalCategories.ts __tests__/optionalCategories.test.ts && git commit -m "feat(categories): add optional catalogue and template identity data"
```

---

### Task 2: Category type and presentation resolution

**Files:**
- Modify: `src/lib/types.ts:43-50`
- Create: `src/lib/categoryPresentation.ts`
- Modify: `src/i18n/categories.ts:82-92`
- Test: `__tests__/categoryPresentation.test.ts`

**Interfaces:**
- Consumes: `STARTER_TEMPLATE_KEYS` (Task 1), `OPTIONAL_CATEGORIES` (Task 1), `DEFAULT_CATEGORY_TRANSLATIONS` (`src/i18n/categories.ts`).
- Produces:
  - `Category` with `isHidden: boolean`, `templateKey: string | null`, `labelOverride: string | null`, `iconOverride: string | null`, `hueOverride: number | null`.
  - `resolveCategoryPresentation(cat, lang): { label: string; icon: string; hue: number }`.
  - `OPTIONAL_CATEGORY_TRANSLATIONS: Record<string, { en: {name, desc}; zh: {name, desc} }>` keyed by template key.

- [ ] **Step 1: Write the failing test**

Create `__tests__/categoryPresentation.test.ts`:

```ts
// __tests__/categoryPresentation.test.ts
// One helper decides what a category looks like everywhere in the app. The precedence it
// encodes is the whole point of the change: an explicit user override must beat a supplied
// translation, which is exactly what the old getCategoryLabel got backwards — it returned the
// translation for any row flagged is_default, so renaming "Food" to "Makan" displayed "Food".
import { resolveCategoryPresentation } from '../src/lib/categoryPresentation';
import type { Category } from '../src/lib/types';

function cat(over: Partial<Category>): Category {
  return {
    id: 'food',
    label: 'Food',
    icon: 'burger',
    hue: 162,
    kind: 'expense',
    isDefault: true,
    isHidden: false,
    templateKey: 'starter.food.v1',
    labelOverride: null,
    iconOverride: null,
    hueOverride: null,
    ...over,
  };
}

describe('label resolution', () => {
  it('translates a supplied starter when there is no override', () => {
    expect(resolveCategoryPresentation(cat({}), 'en').label).toBe('Food');
    expect(resolveCategoryPresentation(cat({}), 'zh').label).toBe('餐饮美食');
  });

  it('an explicit override beats the supplied translation in every language', () => {
    const renamed = cat({ labelOverride: 'Makan' });
    expect(resolveCategoryPresentation(renamed, 'en').label).toBe('Makan');
    expect(resolveCategoryPresentation(renamed, 'zh').label).toBe('Makan');
  });

  it('translates an optional category by its template key', () => {
    const petrol = cat({ id: 'opt-petrol', label: 'Petrol', templateKey: 'optional.car.petrol.v1' });
    expect(resolveCategoryPresentation(petrol, 'en').label).toBe('Petrol');
    expect(resolveCategoryPresentation(petrol, 'zh').label).toBe('汽油');
  });

  it('keeps a custom category label verbatim when the language changes', () => {
    const custom = cat({ id: 'side-hustle', label: 'Side Hustle', isDefault: false, templateKey: null });
    expect(resolveCategoryPresentation(custom, 'en').label).toBe('Side Hustle');
    expect(resolveCategoryPresentation(custom, 'zh').label).toBe('Side Hustle');
  });

  it('shows the relabelled Transport wording for the travelling id', () => {
    const t = cat({ id: 'travelling', label: 'Transport', templateKey: 'starter.travelling.v1' });
    expect(resolveCategoryPresentation(t, 'en').label).toBe('Transport');
    expect(resolveCategoryPresentation(t, 'zh').label).toBe('交通出行');
  });
});

describe('icon and hue resolution', () => {
  it('falls back to the stored row when nothing is overridden', () => {
    const p = resolveCategoryPresentation(cat({}), 'en');
    expect(p.icon).toBe('burger');
    expect(p.hue).toBe(162);
  });

  it('prefers explicit overrides', () => {
    const p = resolveCategoryPresentation(cat({ iconOverride: 'utensils', hueOverride: 42 }), 'en');
    expect(p.icon).toBe('utensils');
    expect(p.hue).toBe(42);
  });

  it('treats hueOverride 0 as a real override, not as absent', () => {
    expect(resolveCategoryPresentation(cat({ hueOverride: 0 }), 'en').hue).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/categoryPresentation.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/categoryPresentation'`

- [ ] **Step 3: Extend the `Category` type**

In `src/lib/types.ts`, replace the `Category` interface (currently lines 41-50):

```ts
/** A category. `id` is a stable slug (also used as the memory value). `kind`
 * separates expense categories from income (money-received) categories. */
export interface Category {
  id: string;
  /** The base stored label. For a supplied category this is Pip's wording; for a custom one it
   *  is what the user typed. Never the place a rename lands — that is `labelOverride`. */
  label: string;
  icon: string;
  hue: number;
  kind: TxnType;
  isDefault: boolean;
  /** Hidden from new-entry choices and LLM options. History, reports, existing budget
   *  allocations and snapshots keep the category regardless. Never means deleted. */
  isHidden: boolean;
  /** Stable identity of a supplied starter or catalogue entry, independent of display label.
   *  Null for user-created categories. Unique across the table when present. */
  templateKey: string | null;
  /** Explicit user presentation overrides. Null means "no opinion, use the supplied value".
   *  These outrank translations, which is what makes a rename survive a language switch. */
  labelOverride: string | null;
  iconOverride: string | null;
  hueOverride: number | null;
}
```

- [ ] **Step 4: Write `src/lib/categoryPresentation.ts`**

```ts
// src/lib/categoryPresentation.ts
// The single shared answer to "what does this category look like right now".
//
// Precedence, in order:
//   1. an explicit user override            (labelOverride / iconOverride / hueOverride)
//   2. the supplied template's translation  (starter translations, catalogue translations)
//   3. the stored row                       (a custom category's own fields)
//
// `isDefault` deliberately plays no part. It is a legacy flag that says nothing about whether a
// label may be customised, and letting it gate translation is the bug this replaces.
import type { SupportedLanguage } from '../i18n/types';
import type { Category } from './types';
import { DEFAULT_CATEGORY_TRANSLATIONS, OPTIONAL_CATEGORY_TRANSLATIONS } from '../i18n/categories';

export interface CategoryPresentation {
  label: string;
  icon: string;
  hue: number;
}

type ResolvableCategory = Pick<Category, 'id' | 'label' | 'icon' | 'hue'> &
  Partial<Pick<Category, 'templateKey' | 'labelOverride' | 'iconOverride' | 'hueOverride' | 'isDefault'>>;

/** The supplied name for a category, or null when Pip supplies none (a custom category). */
function suppliedLabel(cat: ResolvableCategory, lang: SupportedLanguage): string | null {
  const templateKey = cat.templateKey ?? null;
  if (templateKey) {
    const optional = OPTIONAL_CATEGORY_TRANSLATIONS[templateKey];
    if (optional) return optional[lang].name;
  }
  // Starters are still keyed by id: their ids ARE stable identities and a decade of stored rows,
  // backups and remap tables already point at them.
  const byId = DEFAULT_CATEGORY_TRANSLATIONS[cat.id];
  if (byId) return byId[lang] ?? byId.en;
  return null;
}

export function resolveCategoryPresentation(
  cat: ResolvableCategory | null | undefined,
  lang: SupportedLanguage = 'en'
): CategoryPresentation {
  if (!cat) return { label: '', icon: 'dots', hue: 220 };

  const override = cat.labelOverride?.trim();
  const supplied = suppliedLabel(cat, lang);

  return {
    label: override || supplied || cat.label,
    icon: cat.iconOverride ?? cat.icon,
    // A hue of 0 is a real colour (red), so only null/undefined counts as "no override".
    hue: cat.hueOverride ?? cat.hue,
  };
}
```

- [ ] **Step 5: Add catalogue translations and delegate `getCategoryLabel`**

In `src/i18n/categories.ts`, append after `DEFAULT_CATEGORY_TRANSLATIONS` (after line 75):

```ts
/**
 * Supplied names and one-line explanations for the optional catalogue, keyed by TEMPLATE KEY
 * rather than by category id — the id is minted per install and the label is user-editable, so
 * neither can key a translation table.
 *
 * The descriptions carry the overlap convention from the spec: Coffee & Snacks is for purchases
 * that are mostly drinks or snacks, while a full cafe meal stays Eating Out. Nothing here
 * promises item-level classification of a mixed supermarket receipt.
 */
export const OPTIONAL_CATEGORY_TRANSLATIONS: Record<
  string,
  { en: { name: string; desc: string }; zh: { name: string; desc: string } }
> = {
  'optional.car.petrol.v1': {
    en: { name: 'Petrol', desc: 'Fuel for your vehicle' },
    zh: { name: '汽油', desc: '车辆加油费用' },
  },
  'optional.car.maintenance.v1': {
    en: { name: 'Car Maintenance', desc: 'Servicing, repairs, tyres, and parts' },
    zh: { name: '汽车保养', desc: '保养、维修、轮胎与零件' },
  },
  'optional.car.parking-tolls.v1': {
    en: { name: 'Parking & Tolls', desc: 'Parking charges and road tolls' },
    zh: { name: '停车与过路费', desc: '停车费与公路收费' },
  },
  'optional.food.groceries.v1': {
    en: { name: 'Groceries', desc: 'Food and ingredients bought for home' },
    zh: { name: '杂货采购', desc: '在家烹饪的食材与日用食品' },
  },
  'optional.food.eating-out.v1': {
    en: { name: 'Eating Out', desc: 'Restaurant, takeaway, and delivered meals' },
    zh: { name: '外出用餐', desc: '餐厅、打包与外卖餐点' },
  },
  'optional.food.coffee-snacks.v1': {
    en: { name: 'Coffee & Snacks', desc: 'Drinks and small treats tracked separately' },
    zh: { name: '咖啡与零食', desc: '单独记录的饮料与小食' },
  },
};

/** Group headings shown in the Suggested tab. Groups organise the catalogue only — they are
 *  never selectable categories, parent totals, or budget envelopes. */
export const OPTIONAL_GROUP_TITLES: Record<'car' | 'food', Record<SupportedLanguage, string>> = {
  car: { en: 'Car & transport', zh: '汽车与交通' },
  food: { en: 'Food & drinks', zh: '餐饮与饮品' },
};
```

Then replace `getCategoryLabel` (lines 82-92) with a delegation:

```ts
/**
 * Returns the localized label for a category.
 *
 * Kept as a thin wrapper so the ~40 existing `tCat(...)` call sites keep working; the ordering
 * decision now lives in one place, `resolveCategoryPresentation`.
 */
export function getCategoryLabel(
  cat:
    | Category
    | {
        id: string;
        label: string;
        isDefault?: boolean;
        templateKey?: string | null;
        labelOverride?: string | null;
      }
    | null
    | undefined,
  lang: SupportedLanguage = 'en'
): string {
  if (!cat) return '';
  return resolveCategoryPresentation(
    { icon: 'dots', hue: 220, ...cat },
    lang
  ).label;
}
```

Add the import at the top of `src/i18n/categories.ts`:

```ts
import { resolveCategoryPresentation } from '../lib/categoryPresentation';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest __tests__/categoryPresentation.test.ts`
Expected: PASS

- [ ] **Step 7: Run the existing i18n and category suites for regressions**

Run: `npx jest __tests__/i18n.test.ts __tests__/categoryIntegrity.test.ts`
Expected: PASS. If `categoryIntegrity` fails on the seed label for `travelling`, that is Task 12's change — leave it failing only if you have already done Task 12; otherwise it should pass untouched.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/categoryPresentation.ts src/i18n/categories.ts __tests__/categoryPresentation.test.ts && git commit -m "feat(categories): resolve presentation through explicit overrides first"
```

---

### Task 3: Schema columns, template stamping, and the override migration

**Files:**
- Modify: `src/db/db.ts:21-206` (schema), `:309-311` (init order), `:361-404` (seed)
- Modify: `src/db/categoriesRepo.ts:4-29` (row mapping)
- Test: `__tests__/categorySeeding.test.ts` (create)

**Interfaces:**
- Consumes: `STARTER_TEMPLATE_KEYS`, `isSuppliedDefaultLabel`, `SEED_BY_ID` (Task 1); `Category` (Task 2).
- Produces:
  - `categories` table columns `is_hidden`, `template_key`, `label_override`, `icon_override`, `hue_override`.
  - `toCategory` returning the full Task 2 `Category`.
  - `seedCategories` that never overwrites user presentation.

- [ ] **Step 1: Write the failing test**

Create `__tests__/categorySeeding.test.ts`:

```ts
// __tests__/categorySeeding.test.ts
// Startup seeding is the single most dangerous thing in the category system: it runs on every
// launch, against every install, unattended. Before this change it upserted label/icon/hue over
// any default row, so a rename survived exactly until the app was next opened. These tests pin
// the two properties that fix depends on — additive-only seeding, and idempotence.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { __seedCategoriesForTest, __migrateCategoryOverridesForTest } from '../src/db/db';

interface Statement {
  sql: string;
  args: unknown[];
}

function fakeDb(rows: { first?: Record<string, unknown>; all?: Record<string, unknown[]> } = {}) {
  const statements: Statement[] = [];
  const pick = <T,>(table: Record<string, T> | undefined, sql: string): T | undefined => {
    if (!table) return undefined;
    const key = Object.keys(table).find((k) => sql.includes(k));
    return key === undefined ? undefined : table[key];
  };
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string) => Promise.resolve(pick(rows.first, sql) ?? null),
    getAllAsync: (sql: string) => Promise.resolve(pick(rows.all, sql) ?? []),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

describe('seedCategories', () => {
  it('never updates label, icon or hue on an existing row', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const upserts = db.sql().filter((s) => s.startsWith('INSERT INTO categories'));
    expect(upserts.length).toBeGreaterThan(0);
    for (const sql of upserts) {
      expect(sql).not.toMatch(/DO UPDATE SET[^;]*\blabel\s*=/);
      expect(sql).not.toMatch(/DO UPDATE SET[^;]*\bicon\s*=/);
      expect(sql).not.toMatch(/DO UPDATE SET[^;]*\bhue\s*=/);
    }
  });

  it('stamps a template key on every seeded row', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const inserts = db.statements.filter((s) => s.sql.includes('INSERT INTO categories'));
    expect(inserts).toHaveLength(11);
    for (const s of inserts) {
      expect(s.args.some((a) => typeof a === 'string' && a.startsWith('starter.'))).toBe(true);
    }
  });

  it('never inserts an optional catalogue category', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const all = db.statements.flatMap((s) => s.args);
    expect(all.some((a) => typeof a === 'string' && a.startsWith('opt-'))).toBe(false);
    expect(all.some((a) => typeof a === 'string' && a.startsWith('optional.'))).toBe(false);
  });

  it('skips ids the user deliberately deleted', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [{ id: 'insurance' }] } });
    await __seedCategoriesForTest(db as any);
    const ids = db.statements
      .filter((s) => s.sql.includes('INSERT INTO categories'))
      .map((s) => s.args[0]);
    expect(ids).not.toContain('insurance');
    expect(ids).toContain('food');
  });
});

describe('migrateCategoryOverrides', () => {
  it('is a no-op once the meta flag is set', async () => {
    const db = fakeDb({ first: { app_meta: { value: 'done' } } });
    await __migrateCategoryOverridesForTest(db as any);
    expect(db.sql().some((s) => s.startsWith('UPDATE categories SET label_override'))).toBe(false);
  });

  it('captures a renamed default as an explicit label override', async () => {
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'food', label: 'Makan', icon: 'burger', hue: 162 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    const write = db.statements.find((s) => s.sql.includes('label_override'));
    expect(write?.args).toContain('Makan');
    expect(write?.args).toContain('food');
  });

  it('leaves an untouched supplied label alone', async () => {
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'travelling', label: 'Travelling', icon: 'car', hue: 248 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    expect(db.statements.some((s) => s.sql.includes('label_override'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/categorySeeding.test.ts`
Expected: FAIL — `__seedCategoriesForTest is not a function`

- [ ] **Step 3: Add the schema columns**

In `src/db/db.ts`, after the `remark` migration block (after line 237), insert:

```ts
  // Migration (2026-09-06, optional categories): the four pieces of metadata that let a supplied
  // category be recognised, hidden, and personalised without any of those three interfering.
  //
  // `template_key` is the stable identity `is_default` could never be. `is_hidden` is a
  // new-entry preference, NOT a delete — every historical read still sees the row. The three
  // *_override columns hold explicit user choices, so the startup seed below can go back to
  // being purely additive without losing anybody's rename.
  for (const col of [
    'is_hidden INTEGER NOT NULL DEFAULT 0',
    'template_key TEXT',
    'label_override TEXT',
    'icon_override TEXT',
    'hue_override INTEGER',
  ]) {
    try {
      await db.execAsync(`ALTER TABLE categories ADD COLUMN ${col}`);
    } catch {
      // column already present
    }
  }
  // Partial, so the many rows with no template key (every custom category) do not collide on NULL.
  await db.execAsync(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_cat_template ON categories (template_key) WHERE template_key IS NOT NULL'
  );
```

Also add the same five columns to the `CREATE TABLE IF NOT EXISTS categories` block (line 23-31) so fresh installs get them without relying on the ALTERs:

```ts
    CREATE TABLE IF NOT EXISTS categories (
      id             TEXT PRIMARY KEY NOT NULL,
      label          TEXT NOT NULL,
      icon           TEXT NOT NULL,
      hue            INTEGER NOT NULL,
      kind           TEXT NOT NULL DEFAULT 'expense',
      is_default     INTEGER NOT NULL DEFAULT 0,
      sort           INTEGER NOT NULL DEFAULT 0,
      is_hidden      INTEGER NOT NULL DEFAULT 0,
      template_key   TEXT,
      label_override TEXT,
      icon_override  TEXT,
      hue_override   INTEGER
    );
```

- [ ] **Step 4: Rewrite `seedCategories` and add the override migration**

Replace `seedCategories` (lines 377-404) in `src/db/db.ts`:

```ts
/**
 * Insert every default category, stamp its template key, and fix up income kinds.
 *
 * ADDITIVE ONLY. This used to upsert label/icon/hue over any row flagged is_default, which meant
 * a renamed or re-iconed default silently reverted the next time the app was opened — the single
 * biggest reason category customisation did not persist. Presentation now lives in the
 * *_override columns (see migrateCategoryOverrides), so seeding has no business touching it.
 *
 * `sort` is still refreshed: it is ordering Pip owns, never something the user edits.
 *
 * Skips any id a user deliberately deleted (`deleted_default_categories`), so a removed default
 * stays removed across restarts. A full `resetAllData` clears that tombstone table first.
 */
async function seedCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const deletedRows = await db.getAllAsync<{ id: string }>('SELECT id FROM deleted_default_categories');
  const deletedIds = new Set(deletedRows.map((r) => r.id));

  let sort = 0;
  for (const c of ALL_SEED_CATEGORIES) {
    if (deletedIds.has(c.id)) continue;
    await db.runAsync(
      `INSERT INTO categories (id, label, icon, hue, kind, is_default, sort, template_key)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         kind = excluded.kind,
         sort = excluded.sort,
         template_key = COALESCE(categories.template_key, excluded.template_key)
       WHERE categories.is_default = 1`,
      c.id,
      c.label,
      c.icon,
      c.hue,
      c.kind,
      sort,
      STARTER_TEMPLATE_KEYS[c.id] ?? null
    );
    sort += 1;
  }
  const placeholders = INCOME_SEED_IDS.map(() => '?').join(',');
  await db.runAsync(`UPDATE categories SET kind = 'income' WHERE id IN (${placeholders})`, ...INCOME_SEED_IDS);
}

const OVERRIDE_MIGRATION_KEY = 'cat_override_migration_v1';

/**
 * One-time (2026-09-06): promote recognisable stored presentation edits to explicit overrides.
 *
 * Runs BEFORE the first additive seed, while the stored row still reflects whatever the user
 * last set. A stored label that matches any wording Pip has ever shipped for that id is a
 * supplied default and is left alone; anything else is a deliberate rename and becomes a
 * `label_override` so it survives the language switch that used to mask it.
 *
 * In practice most installs will have nothing to capture: the old seed overwrote presentation on
 * every launch, so an edit made before the last restart is already gone. That loss is not
 * recoverable and this deliberately does not guess at it — an uncertain stored label is left as
 * the supplied default rather than pinned as a rename the user never made.
 *
 * Guarded by a meta flag rather than by inspecting the data, so it cannot re-run and re-interpret
 * a label the user has since edited through the new path.
 */
async function migrateCategoryOverrides(db: SQLite.SQLiteDatabase): Promise<void> {
  const done = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    OVERRIDE_MIGRATION_KEY
  );
  if (done) return;

  const rows = await db.getAllAsync<{ id: string; label: string; icon: string; hue: number }>(
    'SELECT id, label, icon, hue FROM categories WHERE is_default = 1'
  );

  for (const row of rows) {
    const seed = SEED_BY_ID.get(row.id);
    if (!seed) continue;
    const labelEdited = !isSuppliedDefaultLabel(row.id, row.label);
    const iconEdited = row.icon !== seed.icon;
    const hueEdited = row.hue !== seed.hue;
    if (!labelEdited && !iconEdited && !hueEdited) continue;
    await db.runAsync(
      `UPDATE categories
          SET label_override = COALESCE(label_override, ?),
              icon_override  = COALESCE(icon_override, ?),
              hue_override   = COALESCE(hue_override, ?)
        WHERE id = ?`,
      labelEdited ? row.label : null,
      iconEdited ? row.icon : null,
      hueEdited ? row.hue : null,
      row.id
    );
  }

  await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', OVERRIDE_MIGRATION_KEY, 'done');
}

/** Test seams: these two run only inside `init()` in production. */
export const __seedCategoriesForTest = seedCategories;
export const __migrateCategoryOverridesForTest = migrateCategoryOverrides;
```

Update the imports at `src/db/db.ts:2`:

```ts
import { ALL_SEED_CATEGORIES, CATEGORY_ID_REMAP, INCOME_SEED_IDS } from '../data/categories';
import { STARTER_TEMPLATE_KEYS, SEED_BY_ID, isSuppliedDefaultLabel } from '../data/categoryTemplates';
```

Update `init()` (lines 309-311) so the override capture happens between the id remap and the seed:

```ts
  await migrateCategoryIds(db);
  await migrateCategoryOverrides(db);
  await ensureSeedCategories(db);
  return db;
```

- [ ] **Step 5: Update the row mapping**

In `src/db/categoriesRepo.ts`, replace `CatRow` and `toCategory` (lines 4-23):

```ts
interface CatRow {
  id: string;
  label: string;
  icon: string;
  hue: number;
  kind: string;
  is_default: number;
  sort: number;
  is_hidden: number | null;
  template_key: string | null;
  label_override: string | null;
  icon_override: string | null;
  hue_override: number | null;
}

function toCategory(r: CatRow): Category {
  return {
    id: r.id,
    label: r.label,
    icon: r.icon,
    hue: r.hue,
    kind: r.kind === 'income' ? 'income' : 'expense',
    isDefault: !!r.is_default,
    // A row written before the 2026-09-06 migration answers NULL on every new column; every one
    // of those reads as "no opinion", which is exactly the pre-migration behaviour.
    isHidden: !!r.is_hidden,
    templateKey: r.template_key ?? null,
    labelOverride: r.label_override ?? null,
    iconOverride: r.icon_override ?? null,
    hueOverride: r.hue_override ?? null,
  };
}
```

Also update `addCategory`'s return (line 70) to include the new fields:

```ts
  return {
    id,
    label: label.trim(),
    icon,
    hue,
    kind,
    isDefault: false,
    isHidden: false,
    templateKey: null,
    labelOverride: null,
    iconOverride: null,
    hueOverride: null,
  };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest __tests__/categorySeeding.test.ts`
Expected: PASS

- [ ] **Step 7: Typecheck and fix `Category` construction sites**

Run: `npm run typecheck`
Expected: errors at every literal `Category` object. Fix each by adding the five new fields. Known sites: `src/screens/CategoriesScreen.tsx:215`, `src/components/AddCategoryModal.tsx:97`, `__tests__/categoryIntegrity.test.ts:27`, `__tests__/backupRestore.test.ts` category fixtures, and any `catById` fallback objects. Re-run until exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/db/db.ts src/db/categoriesRepo.ts src/lib/types.ts src/screens/CategoriesScreen.tsx src/components/AddCategoryModal.tsx __tests__ && git commit -m "feat(db): add category visibility, template identity and override columns"
```

---

Plan continues in Tasks 4-22 below. Each remaining task follows the same five-step TDD shape.

### Task 4: Repo actions — hide, show, activate, override writes

**Files:**
- Modify: `src/db/categoriesRepo.ts`
- Test: `__tests__/categoryVisibility.test.ts`, `__tests__/categoryActivation.test.ts`

**Interfaces:**
- Consumes: `OPTIONAL_CATEGORIES`, `optionalByTemplateKey` (Task 1); `toCategory` (Task 3).
- Produces:
  - `class LastVisibleCategoryError extends Error { kind: 'expense' | 'income' }`
  - `setCategoryHidden(id: string, hidden: boolean): Promise<void>`
  - `activateSuggestedCategories(templateKeys: string[]): Promise<string[]>` — returns the resulting category ids, one per key, in input order.
  - `updateCategoryLabel(id, label)` / `updateCategoryIcon(id, icon)` / `updateCategoryHue(id, hue)` writing `*_override`.
  - `countVisible(kind): Promise<number>`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/categoryVisibility.test.ts`:

```ts
// __tests__/categoryVisibility.test.ts
// Hiding is a new-entry preference, not a delete. The guard these tests pin is the one the spec
// makes absolute: a user must never be able to hide their way into a kind with no visible
// category at all, because every entry screen would then have an empty grid.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { setCategoryHidden, LastVisibleCategoryError, updateCategoryLabel } from '../src/db/categoriesRepo';

function fakeDb(rows: { first?: Record<string, unknown> } = {}) {
  const statements: { sql: string; args: unknown[] }[] = [];
  const pick = (sql: string) => {
    const table = rows.first;
    if (!table) return undefined;
    const key = Object.keys(table).find((k) => sql.includes(k));
    return key === undefined ? undefined : (table as any)[key];
  };
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string) => Promise.resolve(pick(sql) ?? null),
    getAllAsync: () => Promise.resolve([]),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

const install = (db: ReturnType<typeof fakeDb>) => ((global as any).__fakeDb = db);

describe('setCategoryHidden', () => {
  it('hides a category when others of its kind stay visible', async () => {
    const db = install(
      fakeDb({ first: { 'SELECT kind FROM categories': { kind: 'expense' }, 'COUNT(*)': { n: 4 } } })
    );
    await setCategoryHidden('opt-petrol', true);
    expect(db.sql()).toContain('UPDATE categories SET is_hidden = ? WHERE id = ?');
    const write = db.statements.find((s) => s.sql.includes('is_hidden'));
    expect(write?.args).toEqual([1, 'opt-petrol']);
  });

  it('refuses to hide the last visible category of a kind', async () => {
    install(fakeDb({ first: { 'SELECT kind FROM categories': { kind: 'income' }, 'COUNT(*)': { n: 1 } } }));
    await expect(setCategoryHidden('salary', true)).rejects.toBeInstanceOf(LastVisibleCategoryError);
  });

  it('showing again never runs the last-visible guard', async () => {
    const db = install(
      fakeDb({ first: { 'SELECT kind FROM categories': { kind: 'income' }, 'COUNT(*)': { n: 0 } } })
    );
    await expect(setCategoryHidden('salary', false)).resolves.toBeUndefined();
    const write = db.statements.find((s) => s.sql.includes('is_hidden'));
    expect(write?.args).toEqual([0, 'salary']);
  });
});

describe('updateCategoryLabel', () => {
  it('writes an override rather than the base label', async () => {
    const db = install(fakeDb());
    await updateCategoryLabel('food', '  Makan  ');
    const write = db.statements.find((s) => s.sql.includes('label_override'));
    expect(write?.args).toEqual(['Makan', 'food']);
    expect(db.sql().some((s) => /SET label\s*=/.test(s))).toBe(false);
  });

  it('clears the override when the rename is emptied', async () => {
    const db = install(fakeDb());
    await updateCategoryLabel('food', '   ');
    const write = db.statements.find((s) => s.sql.includes('label_override'));
    expect(write?.args).toEqual([null, 'food']);
  });
});
```

Create `__tests__/categoryActivation.test.ts`:

```ts
// __tests__/categoryActivation.test.ts
// Batch activation is the one write in the category system a user can trigger twice by accident
// (a double tap, a retry after a failed save). Idempotence here is not an optimisation — a
// second row carrying the same template key would be a duplicate "Petrol" the user cannot tell
// apart, and a partial batch would be worse.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb), genId: () => 'genid1' };
});

import { activateSuggestedCategories } from '../src/db/categoriesRepo';

function fakeDb(existingByKey: Record<string, { id: string; is_hidden: number }> = {}) {
  const statements: { sql: string; args: unknown[] }[] = [];
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string, ...args: unknown[]) => {
      if (sql.includes('template_key = ?')) return Promise.resolve(existingByKey[args[0] as string] ?? null);
      if (sql.includes('MAX(sort)')) return Promise.resolve({ m: 12 });
      if (sql.includes('WHERE id = ?')) return Promise.resolve(null); // uniqueId: id is free
      return Promise.resolve(null);
    },
    getAllAsync: () => Promise.resolve([]),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

const install = (db: ReturnType<typeof fakeDb>) => ((global as any).__fakeDb = db);

it('inserts a new row for a template key that is not present', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  const insert = db.statements.find((s) => s.sql.includes('INSERT INTO categories'));
  expect(insert?.args).toContain('opt-petrol');
  expect(insert?.args).toContain('optional.car.petrol.v1');
});

it('never creates a second row for a template key already present', async () => {
  const db = install(fakeDb({ 'optional.car.petrol.v1': { id: 'opt-petrol', is_hidden: 0 } }));
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  expect(db.statements.some((s) => s.sql.includes('INSERT INTO categories'))).toBe(false);
});

it('unhides rather than re-adds a previously hidden suggestion', async () => {
  const db = install(fakeDb({ 'optional.car.petrol.v1': { id: 'opt-petrol', is_hidden: 1 } }));
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  expect(db.statements.some((s) => s.sql.includes('INSERT INTO categories'))).toBe(false);
  const unhide = db.statements.find((s) => s.sql.includes('is_hidden'));
  expect(unhide?.args).toEqual([0, 'opt-petrol']);
});

it('activates a whole batch inside a single transaction', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories([
    'optional.car.petrol.v1',
    'optional.car.maintenance.v1',
    'optional.car.parking-tolls.v1',
  ]);
  expect(ids).toEqual(['opt-petrol', 'opt-car-maintenance', 'opt-parking-tolls']);
  expect(db.statements.filter((s) => s.sql.includes('INSERT INTO categories'))).toHaveLength(3);
});

it('ignores a template key that is not in the catalogue', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories(['optional.car.spaceship.v1']);
  expect(ids).toEqual([]);
  expect(db.statements.some((s) => s.sql.includes('INSERT INTO categories'))).toBe(false);
});

it('never writes a budget allocation', async () => {
  const db = install(fakeDb());
  await activateSuggestedCategories(['optional.food.groceries.v1']);
  expect(db.sql().some((s) => s.includes('budget_allocation'))).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/categoryVisibility.test.ts __tests__/categoryActivation.test.ts`
Expected: FAIL — `setCategoryHidden is not a function`, `activateSuggestedCategories is not a function`

- [ ] **Step 3: Implement the repo actions**

In `src/db/categoriesRepo.ts`, replace `updateCategoryIcon` and `updateCategoryLabel` (lines 73-85) and append the rest:

```ts
/** Change a category's icon/picture — a named icon (see Icon.tsx) or a data:/file:/content:/http(s):
 *  URI for a custom photo. Written as an explicit override so the startup seed cannot revert it. */
export async function updateCategoryIcon(id: string, icon: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET icon_override = ? WHERE id = ?', icon, id);
}

/** Rename a category. Blank clears the rename and restores Pip's supplied wording, which is the
 *  only way back once a supplied category has been renamed. */
export async function updateCategoryLabel(id: string, label: string): Promise<void> {
  const db = await getDb();
  const trimmed = label.trim();
  await db.runAsync('UPDATE categories SET label_override = ? WHERE id = ?', trimmed || null, id);
}

/** Change a category's colour. Same override contract as icon and label. */
export async function updateCategoryHue(id: string, hue: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET hue_override = ? WHERE id = ?', hue, id);
}

/**
 * Thrown by `setCategoryHidden` when hiding would leave a kind (expense/income) with no visible
 * category at all — every entry grid for that kind would render empty, with no way back except
 * category management. Callers should explain the restriction rather than fail silently.
 */
export class LastVisibleCategoryError extends Error {
  constructor(public kind: 'expense' | 'income') {
    super(`Cannot hide the last visible ${kind} category`);
  }
}

/** How many categories of a kind are currently offered for new entries. */
export async function countVisible(kind: 'expense' | 'income'): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM categories WHERE kind = ? AND is_hidden = 0',
    kind
  );
  return row?.n ?? 0;
}

/**
 * Hide a category from new-entry choices, or show it again.
 *
 * Nothing else moves: transactions keep pointing at it, breakdowns keep totalling it, budget
 * allocations and snapshots keep their amounts, and recurring payments keep creating expenses
 * against it. That is the whole distinction from `deleteCategory`, which reassigns and tombstones.
 *
 * Showing again restores the SAME row, so a category that comes back carries its original id,
 * its history and its learned merchants — it is not a new category that happens to share a name.
 */
export async function setCategoryHidden(id: string, hidden: boolean): Promise<void> {
  const db = await getDb();
  if (hidden) {
    const row = await db.getFirstAsync<{ kind: string }>('SELECT kind FROM categories WHERE id = ?', id);
    if (!row) return;
    const kind = row.kind === 'income' ? 'income' : 'expense';
    const visible = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM categories WHERE kind = ? AND is_hidden = 0 AND id != ?',
      row.kind,
      id
    );
    if ((visible?.n ?? 0) < 1) throw new LastVisibleCategoryError(kind);
  }
  await db.runAsync('UPDATE categories SET is_hidden = ? WHERE id = ?', hidden ? 1 : 0, id);
}

/**
 * Turn on one or more catalogue suggestions, atomically.
 *
 * Matching is on TEMPLATE KEY, never on label: a user who already has a hand-made category called
 * "Petrol" gets a separate, distinct catalogue Petrol rather than a silent merge, which is the
 * behaviour the spec requires (offer to reuse or create distinctly — never adopt silently).
 *
 * Idempotent by construction. A key already present resolves to the existing row; if that row was
 * hidden, it is shown again rather than duplicated. So a double tap, or a retry after a failed
 * save, converges on exactly one row per key.
 *
 * Deliberately writes NO budget allocation. Monitoring a category and budgeting for it are
 * separate decisions.
 *
 * @returns the resulting category id for each recognised key, in input order. Unrecognised keys
 *          are dropped rather than throwing, so a backup written by a newer build cannot wedge
 *          an older one.
 */
export async function activateSuggestedCategories(templateKeys: string[]): Promise<string[]> {
  const db = await getDb();
  const wanted = templateKeys
    .map((k) => optionalByTemplateKey(k))
    .filter((c): c is OptionalCategory => !!c);
  if (wanted.length === 0) return [];

  const ids: string[] = [];
  await db.withTransactionAsync(async () => {
    const sortRow = await db.getFirstAsync<{ m: number }>(
      'SELECT COALESCE(MAX(sort), 0) + 1 AS m FROM categories'
    );
    let sort = sortRow?.m ?? 0;

    for (const c of wanted) {
      const existing = await db.getFirstAsync<{ id: string; is_hidden: number }>(
        'SELECT id, is_hidden FROM categories WHERE template_key = ?',
        c.templateKey
      );
      if (existing) {
        if (existing.is_hidden) {
          await db.runAsync('UPDATE categories SET is_hidden = ? WHERE id = ?', 0, existing.id);
        }
        ids.push(existing.id);
        continue;
      }
      // The catalogue id is already collision-safe by prefix, but a user could in principle have
      // created a custom category that slugified to it, so the existing uniqueId walk still runs.
      const id = await uniqueId(c.id);
      await db.runAsync(
        `INSERT INTO categories (id, label, icon, hue, kind, is_default, sort, is_hidden, template_key)
           VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)`,
        id,
        c.label,
        c.icon,
        c.hue,
        c.kind,
        sort,
        c.templateKey
      );
      sort += 1;
      ids.push(id);
    }
  });
  return ids;
}
```

Add the import at the top of `src/db/categoriesRepo.ts`:

```ts
import { optionalByTemplateKey, type OptionalCategory } from '../data/optionalCategories';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/categoryVisibility.test.ts __tests__/categoryActivation.test.ts`
Expected: PASS

- [ ] **Step 5: Guard against the remap collision in the integrity suite**

Append to `__tests__/categoryIntegrity.test.ts`:

```ts
describe('optional catalogue vs retired ids', () => {
  it('no catalogue id would be deleted by migrateCategoryIds on the next launch', () => {
    const retired = new Set(Object.keys(CATEGORY_ID_REMAP));
    for (const c of OPTIONAL_CATEGORIES) expect(retired.has(c.id)).toBe(false);
  });

  it('every seeded category carries a unique starter template key', () => {
    const keys = ALL_SEED_CATEGORIES.map((c) => STARTER_TEMPLATE_KEYS[c.id]);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('starter and optional template keys never overlap', () => {
    const starters = new Set(Object.values(STARTER_TEMPLATE_KEYS));
    for (const c of OPTIONAL_CATEGORIES) expect(starters.has(c.templateKey)).toBe(false);
  });
});
```

Add its imports at the top of that file:

```ts
import { OPTIONAL_CATEGORIES } from '../src/data/optionalCategories';
import { STARTER_TEMPLATE_KEYS } from '../src/data/categoryTemplates';
```

- [ ] **Step 6: Run the full category suite and typecheck**

Run: `npx jest __tests__/categoryIntegrity.test.ts __tests__/categoryVisibility.test.ts __tests__/categoryActivation.test.ts __tests__/categorySeeding.test.ts && npm run typecheck`
Expected: PASS, exit 0

- [ ] **Step 7: Commit**

```bash
git add src/db/categoriesRepo.ts __tests__ && git commit -m "feat(categories): add hide/show, atomic suggestion activation, override writes"
```

---

### Task 5: Store wiring — visible-entry selector and new actions

**Files:**
- Modify: `src/state/store.tsx:253-298` (type), `:840-871` (actions), `:2043-2063` (value)

**Interfaces:**
- Consumes: `setCategoryHidden`, `activateSuggestedCategories`, `updateCategoryHue`, `countVisible`, `LastVisibleCategoryError` (Task 4).
- Produces on `AppData`:
  - `entryCategories: Category[]` — visible only, for new-entry choices and LLM options.
  - `setCategoryHidden(id: string, hidden: boolean): Promise<void>`
  - `activateSuggested(templateKeys: string[]): Promise<string[]>`
  - `updateCategoryHue(id: string, hue: number): Promise<void>`

- [ ] **Step 1: Add the selector and actions**

In `src/state/store.tsx`, after the `catById` memo (line 788), add:

```ts
  /**
   * The categories offered for NEW entries — manual entry, categorize, edit, LLM options.
   *
   * Deliberately a separate selector rather than a filter applied to `categories`: history,
   * breakdowns, budget rows and the category-detail screen must still resolve a hidden category
   * to its badge and label, so app state keeps every row and only the entry paths narrow.
   */
  const entryCategories = useMemo(() => categories.filter((c) => !c.isHidden), [categories]);
```

After `updateCategoryLabel` (line 871), add:

```ts
  const updateCategoryHue = useCallback(async (id: string, hue: number) => {
    await dbUpdateCategoryHue(id, hue);
    setCategories(await listCategories());
  }, []);

  /** Hide a category from new entries, or show it again. Throws LastVisibleCategoryError when
   *  hiding would empty a kind; callers surface that rather than swallowing it. */
  const setCategoryHidden = useCallback(async (id: string, hidden: boolean) => {
    await dbSetCategoryHidden(id, hidden);
    setCategories(await listCategories());
  }, []);

  /** Turn on catalogue suggestions. Atomic and idempotent at the repo layer, so a retry after a
   *  failed save cannot leave a half-applied batch or a duplicate. */
  const activateSuggested = useCallback(async (templateKeys: string[]) => {
    const ids = await dbActivateSuggested(templateKeys);
    setCategories(await listCategories());
    return ids;
  }, []);
```

Update the import at line 2:

```ts
import {
  addCategory as dbAddCategory,
  deleteCategory as dbDeleteCategory,
  updateCategoryIcon as dbUpdateCategoryIcon,
  updateCategoryLabel as dbUpdateCategoryLabel,
  updateCategoryHue as dbUpdateCategoryHue,
  setCategoryHidden as dbSetCategoryHidden,
  activateSuggestedCategories as dbActivateSuggested,
  listCategories,
} from '../db/categoriesRepo';
```

Add to the `AppData` interface after line 254 (`catById`):

```ts
  /** Visible-only categories, for new-entry choices and LLM options. See `categories` for the
   *  full list every historical and budget view still needs. */
  entryCategories: Category[];
```

and after line 298 (`updateCategoryLabel`):

```ts
  updateCategoryHue: (id: string, hue: number) => Promise<void>;
  setCategoryHidden: (id: string, hidden: boolean) => Promise<void>;
  activateSuggested: (templateKeys: string[]) => Promise<string[]>;
```

Add to the returned `value` object after `catById` (line 2044) and after `updateCategoryLabel` (line 2062):

```ts
    entryCategories,
```
```ts
    updateCategoryHue,
    setCategoryHidden,
    activateSuggested,
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/state/store.tsx && git commit -m "feat(state): expose visible-entry categories and visibility actions"
```

---

### Task 6: Entry paths and LLM options use visible categories only

**Files:**
- Modify: `src/screens/CategorizeScreen.tsx:39-46,72-73,104`
- Modify: `src/screens/ManualEntryScreen.tsx:74-91,216`
- Modify: `src/components/EditTransactionModal.tsx:39,111,192-193`
- Modify: `src/screens/AddFlow.tsx:95,214,297,468,506`
- Test: `__tests__/categoryEntryFiltering.test.ts` (create)

**Interfaces:**
- Consumes: `entryCategories` (Task 5).
- Produces: no new exports. Behaviour: new-entry grids and LLM prompt options exclude hidden categories; a model response naming a hidden category is rejected the same way an unknown id is.

- [ ] **Step 1: Write the failing test**

Create `__tests__/categoryEntryFiltering.test.ts`:

```ts
// __tests__/categoryEntryFiltering.test.ts
// The model is handed a list of category ids and asked to pick one. A hidden category must not
// be in that list, and — separately — must be rejected if it comes back anyway, because a stale
// prompt or a hallucinated id would otherwise route a new expense into a category the user has
// explicitly taken out of circulation.
import { buildCategoryGuessPrompt, parseCategoryGuess } from '../src/llm/categoryGuessPrompt';
import { parseQuickAdd } from '../src/llm/quickAddPrompt';

const VISIBLE = [
  { id: 'food', label: 'Food', kind: 'expense' as const },
  { id: 'travelling', label: 'Transport', kind: 'expense' as const },
];

describe('category guess options', () => {
  it('never mentions a category the caller left out', () => {
    const prompt = buildCategoryGuessPrompt([{ merchant: 'Shell', amount: 80, type: 'expense' }], VISIBLE);
    expect(prompt).toContain('food');
    expect(prompt).not.toContain('opt-petrol');
  });

  it('rejects a response naming a category outside the supplied options', () => {
    const out = parseCategoryGuess('{"0":"opt-petrol"}', [{ merchant: 'Shell', amount: 80, type: 'expense' }], VISIBLE);
    expect(out[0]).toBeNull();
  });

  it('accepts a response naming a supplied option', () => {
    const out = parseCategoryGuess('{"0":"travelling"}', [{ merchant: 'Shell', amount: 80, type: 'expense' }], VISIBLE);
    expect(out[0]).toBe('travelling');
  });
});

describe('quick add options', () => {
  it('drops a category id outside the supplied options', () => {
    const parsed = parseQuickAdd(
      '{"items":[{"merchant":"Shell","amount":80,"type":"expense","categoryId":"opt-petrol"}]}',
      VISIBLE
    );
    expect(parsed[0]?.categoryId ?? null).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx jest __tests__/categoryEntryFiltering.test.ts`
Expected: These may PASS already — `parseCategoryGuess:85` and `parseQuickAdd:119` both look the id up in the supplied `categories` array and fall back to null. That is the correct existing behaviour; the test locks it in so a later refactor cannot regress it. If either fails, fix the parser to reject ids not present in the supplied options before proceeding.

- [ ] **Step 3: Switch the four entry surfaces to `entryCategories`**

`src/screens/CategorizeScreen.tsx` — the screen receives `categories` as a prop from `AddFlow`. Keep the prop name and pass the filtered list from the caller (Step 4), but tighten the suggestion validity check at line 104 so a learned or guessed id pointing at a hidden category is not treated as valid:

```ts
  const suggestionValid =
    !!rawSuggestion &&
    categories.find((c) => c.id === rawSuggestion.categoryId)?.kind === item?.type;
```

This already narrows correctly once `categories` is the visible-only list — no edit needed beyond the caller change. Verify by reading the file; if `categories` is used anywhere that needs the full list (for example rendering an existing assignment's badge), split that use onto a separate `allCategories` prop.

`src/screens/ManualEntryScreen.tsx:216` — the grid comes from the `categories` prop; same story, fixed at the call site.

`src/components/EditTransactionModal.tsx:111` — replace:

```ts
  // Editing an existing transaction must still show ITS category even when hidden (the spec is
  // explicit: an old expense in a hidden category keeps that category unless the user changes
  // it), so the grid is the visible set plus whatever this row already points at.
  const grid = useMemo(() => {
    const visible = categories.filter((c) => c.kind === type && !c.isHidden);
    const current = categories.find((c) => c.id === txn.categoryId);
    if (current && current.kind === type && current.isHidden) return [current, ...visible];
    return visible;
  }, [categories, type, txn.categoryId]);
```

`src/components/EditTransactionModal.tsx:192-193` — the kind-switch fallback must land on a visible category:

```ts
      const c = categories.find((x) => x.id === prev);
      if (c && c.kind === t) return prev;
      const fallbackId = t === 'income' ? DEFAULT_INCOME_ID : DEFAULT_EXPENSE_ID;
      const fallback = categories.find((x) => x.id === fallbackId);
      // The generic fallback can itself have been hidden; fall through to any visible category
      // of the right kind rather than selecting something the user removed from entry.
      if (fallback && !fallback.isHidden) return fallbackId;
      return categories.find((x) => x.kind === t && !x.isHidden)?.id ?? fallbackId;
```

- [ ] **Step 4: Feed the filtered list from `AddFlow`**

In `src/screens/AddFlow.tsx`, change line 95 to pull both lists:

```ts
  const { commitCategorized, recordBalanceLink, settleShare, accounts, memory, categories, entryCategories, catById, applyReliefDetection, markTaskDone } = useAppData();
```

Line 214 (`categories` passed into the guess call) and line 297 (`categories.map(...)` building LLM options) both become `entryCategories`:

```ts
      entryCategories,
```
```ts
          categories: entryCategories.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
```

Lines 468 and 506 (the `categories={categories}` props into `CategorizeScreen` and `ManualEntryScreen`) become:

```ts
        categories={entryCategories}
```

Leave `catById={catById}` at line 517 untouched — that map is how already-assigned rows render their badge, and it must still resolve a hidden category.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx jest __tests__/categoryEntryFiltering.test.ts __tests__/quickAdd.test.ts __tests__/categoryGuessPrompt.test.ts __tests__/quickAddPrompt.test.ts && npm run typecheck`
Expected: PASS, exit 0

- [ ] **Step 6: Commit**

```bash
git add src/screens/AddFlow.tsx src/screens/CategorizeScreen.tsx src/screens/ManualEntryScreen.tsx src/components/EditTransactionModal.tsx __tests__/categoryEntryFiltering.test.ts && git commit -m "feat(categories): exclude hidden categories from new-entry and LLM options"
```

---

### Task 7: Merchant memory falls through when its learned target is hidden

**Files:**
- Modify: `src/screens/AddFlow.tsx` (suggestion resolution around line 214-272)
- Test: `__tests__/categoryEntryFiltering.test.ts` (extend)

**Interfaces:**
- Consumes: `entryCategories`, `memory` (`MemoryMap`).
- Produces: `resolveSuggestion(merchantKey, memory, entryCategories, guess): CategorySuggestion | null` exported from `src/lib/categorySuggestion.ts` (new small module, so it is testable without RN).

- [ ] **Step 1: Write the failing test**

Append to `__tests__/categoryEntryFiltering.test.ts`:

```ts
import { resolveSuggestion } from '../src/lib/categorySuggestion';

describe('learned memory vs hidden categories', () => {
  const visible = [
    { id: 'food', kind: 'expense' as const },
    { id: 'travelling', kind: 'expense' as const },
  ];

  it('uses a learned mapping that still points at a visible category', () => {
    expect(resolveSuggestion('shell', { shell: 'travelling' }, visible, null)).toEqual({
      categoryId: 'travelling',
      source: 'learned',
    });
  });

  it('falls through to the guess when the learned target is hidden', () => {
    expect(resolveSuggestion('shell', { shell: 'opt-petrol' }, visible, 'travelling')).toEqual({
      categoryId: 'travelling',
      source: 'guess',
    });
  });

  it('returns null rather than a hidden category when there is no guess either', () => {
    expect(resolveSuggestion('shell', { shell: 'opt-petrol' }, visible, null)).toBeNull();
  });

  it('rejects a guess that names a hidden category', () => {
    expect(resolveSuggestion('shell', {}, visible, 'opt-petrol')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/categoryEntryFiltering.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/categorySuggestion'`

- [ ] **Step 3: Write `src/lib/categorySuggestion.ts`**

```ts
// src/lib/categorySuggestion.ts
// Which category a new transaction arrives pre-filled with, and why.
//
// The visibility rule here is deliberately one-directional. A learned merchant mapping whose
// target the user has since hidden falls THROUGH to the ordinary suggestion path — it does not
// silently resurrect the hidden category, and it does not rewrite the stored memory either.
// The mapping stays on disk untouched, so showing the category again restores the learning
// exactly as it was, which is what makes hiding reversible rather than destructive.
import type { CategorySuggestion, MemoryMap } from './types';

type VisibleCategory = { id: string; kind: string };

/**
 * @param merchantKey  normalised merchant, the memory table's key
 * @param memory       merchantKey -> categoryId, the learned mappings
 * @param visible      the categories currently offered for new entries
 * @param guess        a first-time model guess, already validated against `visible`, or null
 */
export function resolveSuggestion(
  merchantKey: string,
  memory: MemoryMap,
  visible: VisibleCategory[],
  guess: string | null
): CategorySuggestion | null {
  const visibleIds = new Set(visible.map((c) => c.id));

  const learned = merchantKey ? memory[merchantKey] : undefined;
  if (learned && visibleIds.has(learned)) return { categoryId: learned, source: 'learned' };

  // A visible learned mapping stays authoritative even after a more specific category is added:
  // switching Petrol on does not retrain the merchants the user already taught as Transport.
  // Corrections are how that changes, one merchant at a time.
  if (guess && visibleIds.has(guess)) return { categoryId: guess, source: 'guess' };

  return null;
}
```

- [ ] **Step 4: Wire it into `AddFlow`**

In `src/screens/AddFlow.tsx`, replace the inline memory-lookup that produces `rawSuggestion` with a `resolveSuggestion` call, passing `entryCategories` as `visible`. Read lines 200-280 to find the exact current shape; the substitution is mechanical — wherever the code reads `memory[key]` to build a `CategorySuggestion`, call `resolveSuggestion(key, memory, entryCategories, guessedId)` instead and use its result.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx jest __tests__/categoryEntryFiltering.test.ts && npm run typecheck`
Expected: PASS, exit 0

- [ ] **Step 6: Commit**

```bash
git add src/lib/categorySuggestion.ts src/screens/AddFlow.tsx __tests__/categoryEntryFiltering.test.ts && git commit -m "feat(categories): fall through learned mappings that point at hidden categories"
```

---

### Task 8: UI strings for the add sheet, hiding, and the catalogue

**Files:**
- Modify: `src/i18n/types.ts`, `src/i18n/translations/en.ts`, `src/i18n/translations/zh.ts`
- Test: `__tests__/i18n.test.ts` (existing parity check covers this)

**Interfaces:**
- Produces: 24 new `Translations` keys, listed below with their exact English and Chinese values.

- [ ] **Step 1: Add the keys to `src/i18n/types.ts`**

Insert after `addCategory: string;` (line 225):

```ts
  // Category catalogue and visibility
  addCategorySheetTitle: string;
  tabSuggested: string;
  tabCreateYourOwn: string;
  searchSuggestedPlaceholder: string;
  noSuggestionsMatch: string;
  suggestionAdded: string;
  suggestionShowAgain: string;
  addNCategories: string;
  addOneCategory: string;
  hiddenSectionTitle: string;
  hideFromNewExpenses: string;
  showAgain: string;
  hiddenBadge: string;
  hideLastVisibleTitle: string;
  hideLastVisibleBody: string;
  hideUsedByCommitmentTitle: string;
  hideUsedByCommitmentBody: string;
  reviewRecurringPayments: string;
  hiddenKeepsHistoryNote: string;
  renameCategory: string;
  renameCategoryHint: string;
  categoryColor: string;
  activationFailedTitle: string;
  activationFailedBody: string;
  retry: string;
```

- [ ] **Step 2: Add the English values**

Insert before the closing `};` of `src/i18n/translations/en.ts`:

```ts
  // Category catalogue and visibility
  addCategorySheetTitle: 'Add a category',
  tabSuggested: 'Suggested',
  tabCreateYourOwn: 'Create your own',
  searchSuggestedPlaceholder: 'Search petrol, groceries, parking…',
  noSuggestionsMatch: 'No suggestions match that. Try Create your own.',
  suggestionAdded: 'Added',
  suggestionShowAgain: 'Show again',
  addNCategories: 'Add {n} categories',
  addOneCategory: 'Add 1 category',
  hiddenSectionTitle: 'Hidden from new expenses',
  hideFromNewExpenses: 'Hide from new expenses',
  showAgain: 'Show again',
  hiddenBadge: 'Hidden',
  hideLastVisibleTitle: 'Keep at least one category',
  hideLastVisibleBody: '“{label}” is your only visible {kind} category. Hiding it would leave nothing to choose when you record a new one. Add or show another {kind} category first.',
  hideUsedByCommitmentTitle: 'Used by a recurring payment',
  hideUsedByCommitmentBody: '{count} recurring payment(s) still record into “{label}”. They will keep doing so — hiding only removes it from the choices you see when recording a new expense.',
  reviewRecurringPayments: 'Review recurring payments',
  hiddenKeepsHistoryNote: 'Past expenses, reports, and budget amounts keep this category. Hiding only removes it from new expense choices.',
  renameCategory: 'Name',
  renameCategoryHint: 'Leave blank to use Pip’s name.',
  categoryColor: 'Colour',
  activationFailedTitle: 'Could not add those categories',
  activationFailedBody: 'Nothing was changed. Your selection is still here — try again.',
  retry: 'Try again',
```

- [ ] **Step 3: Add the Chinese values**

Insert before the closing `};` of `src/i18n/translations/zh.ts`:

```ts
  // 分类目录与显示
  addCategorySheetTitle: '添加分类',
  tabSuggested: '推荐分类',
  tabCreateYourOwn: '自定义',
  searchSuggestedPlaceholder: '搜索汽油、杂货、停车…',
  noSuggestionsMatch: '没有匹配的推荐分类，可以试试自定义。',
  suggestionAdded: '已添加',
  suggestionShowAgain: '重新显示',
  addNCategories: '添加 {n} 个分类',
  addOneCategory: '添加 1 个分类',
  hiddenSectionTitle: '已从新支出中隐藏',
  hideFromNewExpenses: '在新支出中隐藏',
  showAgain: '重新显示',
  hiddenBadge: '已隐藏',
  hideLastVisibleTitle: '至少保留一个分类',
  hideLastVisibleBody: '“{label}”是您唯一显示的{kind}分类。隐藏后记录新交易时将无从选择。请先添加或显示另一个{kind}分类。',
  hideUsedByCommitmentTitle: '定期付款正在使用',
  hideUsedByCommitmentBody: '仍有 {count} 项定期付款记入“{label}”，它们会继续记入该分类。隐藏只会让它不再出现在记录新支出的选项里。',
  reviewRecurringPayments: '查看定期付款',
  hiddenKeepsHistoryNote: '历史支出、报表与预算金额仍会保留此分类。隐藏只会将它从新支出的选项中移除。',
  renameCategory: '名称',
  renameCategoryHint: '留空则使用 Pip 提供的名称。',
  categoryColor: '颜色',
  activationFailedTitle: '无法添加这些分类',
  activationFailedBody: '未做任何更改，您的选择仍然保留，请重试。',
  retry: '重试',
```

- [ ] **Step 4: Run the parity test**

Run: `npx jest __tests__/i18n.test.ts && npm run typecheck`
Expected: PASS, exit 0. If the parity test reports a key present in one file and absent from the other, add the missing one.

- [ ] **Step 5: Commit**

```bash
git add src/i18n && git commit -m "i18n: add category catalogue, hide/show and rename strings"
```

---

### Task 9: The shared Add category sheet

**Files:**
- Create: `src/components/AddCategorySheet.tsx`
- Modify: `src/components/AddCategoryModal.tsx` (becomes the Create-your-own body, re-exported)

**Interfaces:**
- Consumes: `OPTIONAL_CATEGORIES`, `searchOptionalCategories`, `OPTIONAL_GROUPS` (Task 1); `OPTIONAL_CATEGORY_TRANSLATIONS`, `OPTIONAL_GROUP_TITLES` (Task 2); `activateSuggested`, `categories`, `addCategory` (Task 5); i18n keys (Task 8).
- Produces:
  ```ts
  export function AddCategorySheet(props: {
    visible: boolean;
    kind: TxnType;                 // which kind "Create your own" defaults to
    onClose: () => void;
    onCreated?: (categoryId: string) => void;  // fires for a single create-and-select
    onActivated?: (categoryIds: string[]) => void;  // fires after a batch activation
  }): JSX.Element;
  ```

- [ ] **Step 1: Build the sheet**

Create `src/components/AddCategorySheet.tsx`. Requirements, all from the spec:

- Two tabs: `t('tabSuggested')` and `t('tabCreateYourOwn')`. Suggested is the default tab.
- Suggested tab renders `OPTIONAL_GROUPS` in order, each under `OPTIONAL_GROUP_TITLES[group][lang]`, containing its entries with `CatBadge`, translated name, and translated description.
- Group headings are non-interactive text. They must not be pressable, must not carry a total, and must not appear as a category anywhere.
- Per-entry state, derived from `categories` matched on `templateKey`:
  - not present → selectable checkbox
  - present and visible → static `t('suggestionAdded')`, not selectable
  - present and hidden → button labelled `t('suggestionShowAgain')`, which calls `activateSuggested([templateKey])` directly (single action, no batch)
- Search input filters via `searchOptionalCategories(query, isZh ? 'zh' : 'en')`; empty result shows `t('noSuggestionsMatch')`.
- Confirm button label: `t('addOneCategory')` for one selection, `t('addNCategories').replace('{n}', String(n))` for more. Hidden when nothing is selected.
- Confirm calls `activateSuggested(selectedKeys)`. On success, call `onActivated?.(ids)` and close. On rejection, keep the sheet open **with the selection intact** and show `notify(t('activationFailedTitle'), t('activationFailedBody'))`.
- Create-your-own tab renders the existing `AddCategoryModal` body (name, icon grid, hue grid, submit). Extract that body from `AddCategoryModal.tsx` into an exported `CreateCategoryForm` component and have both the sheet and the old modal render it, so there is one implementation.
- Accessibility: every selectable row gets `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`, and `accessibilityLabel` combining name and description. Selected state shows a check glyph in addition to the accent border, so it does not depend on colour alone. Every touch target is at least 44×44 (`minHeight: 44` on the row `Pressable`).
- Follow the existing sheet idiom: `Modal` + backdrop `Pressable` + `KeyboardAvoidingView` + `useSafeAreaInsets`, exactly as `AddCategoryModal.tsx:79-90` does.

- [ ] **Step 2: Verify the sheet renders in the running app**

Run the app and open Settings → Categories → Add category. Confirm: six entries in two groups, search matches "fuel", selecting two shows "Add 2 categories", confirming adds exactly two rows.

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck && git add src/components/AddCategorySheet.tsx src/components/AddCategoryModal.tsx && git commit -m "feat(categories): add the shared Suggested / Create your own sheet"
```

---

### Task 10: Categories screen — hidden section, hide/show, rename

**Files:**
- Modify: `src/screens/CategoriesScreen.tsx`

**Interfaces:**
- Consumes: `setCategoryHidden`, `updateCategoryLabel`, `updateCategoryHue`, `LastVisibleCategoryError` (Tasks 4-5); `AddCategorySheet` (Task 9); i18n keys (Task 8); `commitments` from `useAppData` (for the recurring-payment warning).

- [ ] **Step 1: Restructure the screen**

Replace the inline "add new" card (lines 209-274) with a single button that opens `AddCategorySheet`. Split the existing list into two `Card`s:

- **Visible** — `list.filter((c) => !c.isHidden)`, each row keeping today's badge/pencil/trash affordances plus a new hide action.
- **Hidden** — `list.filter((c) => c.isHidden)` under `t('hiddenSectionTitle')`, each row showing `t('hiddenBadge')` and a `t('showAgain')` action. Render the whole section only when it is non-empty.

Extend the per-row edit panel (currently icon-only, lines 167-204) with:
- a `TextInput` bound to `labelOverride ?? ''`, labelled `t('renameCategory')` with helper text `t('renameCategoryHint')`, saving through `updateCategoryLabel`
- the `HUE_CHOICES` row, saving through `updateCategoryHue`
- the existing icon grid, unchanged

- [ ] **Step 2: Implement the hide action with both consequences surfaced**

```tsx
  const hideCategory = async (c: Category) => {
    const label = tCat(c);
    const usedBy = commitments.filter((m) => !m.archived && m.categoryId === c.id).length;
    const proceed = async () => {
      try {
        await setCategoryHidden(c.id, true);
      } catch (e) {
        if (e instanceof LastVisibleCategoryError) {
          notify(
            t('hideLastVisibleTitle'),
            t('hideLastVisibleBody')
              .replace('{label}', label)
              .replace(/\{kind\}/g, e.kind === 'income' ? (isZh ? '收入' : 'income') : (isZh ? '支出' : 'expense'))
          );
          return;
        }
        throw e;
      }
    };
    // Hiding a category a recurring payment still writes into has a consequence the user cannot
    // see from this screen, so it is stated before the fact rather than discovered later.
    if (usedBy > 0) {
      confirmAction(
        t('hideUsedByCommitmentTitle'),
        t('hideUsedByCommitmentBody').replace('{count}', String(usedBy)).replace('{label}', label),
        t('hideFromNewExpenses'),
        proceed
      );
      return;
    }
    await proceed();
  };
```

Show `t('hiddenKeepsHistoryNote')` as static helper text under the Hidden section heading, so the "money did not disappear" reassurance is present at the moment of doubt.

- [ ] **Step 3: Verify on device**

Confirm: hiding removes the category from manual entry but its past expenses still show its badge and its total still appears in Breakdown; showing it again restores the same row; hiding the last visible expense category is refused with the explanation.

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck && git add src/screens/CategoriesScreen.tsx && git commit -m "feat(categories): add hidden section, hide/show, rename and colour editing"
```

---

### Task 11: Backup and restore round-trip

**Files:**
- Modify: `src/lib/financialExport.ts:546-556,694-695`
- Modify: `src/db/restoreRepo.ts:17-18,61,104-120`
- Test: `__tests__/backupRestore.test.ts` (extend)

**Interfaces:**
- Consumes: the Task 2 `Category` shape.
- Produces: backup `categories[]` entries carrying `isHidden`, `templateKey`, `labelOverride`, `iconOverride`, `hueOverride`.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/backupRestore.test.ts`:

```ts
describe('category visibility and overrides round-trip', () => {
  it('carries the new fields through the backup payload', () => {
    const cats: Category[] = [
      {
        id: 'opt-petrol', label: 'Petrol', icon: 'car', hue: 12, kind: 'expense', isDefault: false,
        isHidden: true, templateKey: 'optional.car.petrol.v1',
        labelOverride: 'Minyak', iconOverride: null, hueOverride: 42,
      },
    ];
    const payload = buildBackupPayloadForTest(cats);
    expect(payload.categories[0]).toMatchObject({
      id: 'opt-petrol',
      isHidden: true,
      templateKey: 'optional.car.petrol.v1',
      labelOverride: 'Minyak',
      hueOverride: 42,
    });
  });

  it('accepts an older backup whose categories have none of the new fields', () => {
    const legacy = { categories: [{ id: 'food', label: 'Food', icon: 'burger', hue: 162, kind: 'expense', isDefault: true }] };
    expect(validateBackupPayload(legacy)).toBe(true);
  });
});
```

Add a `buildBackupPayloadForTest` helper in that file that calls `generateFullBackupZip` with a minimal fixture and unzips `backup.json`, mirroring the existing test's zip-reading idiom (`unzipSync` + `strFromU8`, already imported at line 1).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/backupRestore.test.ts`
Expected: FAIL — the payload lacks the new fields.

- [ ] **Step 3: Serialize the new fields**

In `src/lib/financialExport.ts`, replace the category mapping at line 546:

```ts
  const categories = data.categories.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    hue: c.hue,
    kind: c.kind,
    isDefault: c.isDefault,
    // Visibility, template identity and presentation overrides are user decisions, not derived
    // state — a restore that dropped them would silently un-hide categories and revert renames.
    isHidden: c.isHidden,
    templateKey: c.templateKey,
    labelOverride: c.labelOverride,
    iconOverride: c.iconOverride,
    hueOverride: c.hueOverride,
  }));
```

- [ ] **Step 4: Restore the new fields**

In `src/db/restoreRepo.ts`, replace the category insert (lines 106-118):

```ts
    for (const c of payload.categories ?? []) {
      await db.runAsync(
        `INSERT INTO categories
           (id, label, icon, hue, kind, is_default, sort, is_hidden, template_key, label_override, icon_override, hue_override)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id,
        c.label,
        c.icon,
        c.hue,
        c.kind,
        c.isDefault ? 1 : 0,
        c.sort ?? 0,
        // A backup written before 2026-09-06 carries none of these. Absent reads as "visible,
        // no explicit overrides", which is exactly what those installs meant. A stored custom
        // label still lives in `label` and is preserved untouched.
        c.isHidden ? 1 : 0,
        c.templateKey ?? null,
        c.labelOverride ?? null,
        c.iconOverride ?? null,
        c.hueOverride ?? null
      );
    }
```

Extend the `RestorePayload` category typing at line 17 accordingly.

- [ ] **Step 5: Confirm restore cannot resurrect duplicates**

The restore path wipes `categories` then re-inserts from the payload, and `seedCategories` is additive and matches on `id`. A restored `opt-petrol` therefore survives the next launch as itself. Add an assertion to the test file:

```ts
  it('a restored optional category is not re-added by the next seed', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const inserted = db.statements
      .filter((s) => s.sql.includes('INSERT INTO categories'))
      .map((s) => s.args[0]);
    expect(inserted).not.toContain('opt-petrol');
  });
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx jest __tests__/backupRestore.test.ts __tests__/financialExport.test.ts __tests__/onboardingRestore.test.ts __tests__/restoreRe*.test.ts && npm run typecheck`
Expected: PASS, exit 0

- [ ] **Step 7: Commit**

```bash
git add src/lib/financialExport.ts src/db/restoreRepo.ts __tests__/backupRestore.test.ts && git commit -m "feat(backup): round-trip category visibility, template identity and overrides"
```

---

### Task 12: Transport relabel

**Files:**
- Modify: `src/data/categories.ts:18`
- Modify: `src/i18n/categories.ts` (`travelling` English translation)
- Modify: `__tests__/categoryIntegrity.test.ts`

- [ ] **Step 1: Change the seed label**

`src/data/categories.ts:18`:

```ts
  { id: 'travelling', label: 'Transport', icon: 'car', hue: 248, kind: 'expense' },
```

- [ ] **Step 2: Change the English translation**

`src/i18n/categories.ts`:

```ts
  travelling: {
    // Display wording only. The id stays `travelling`: renaming it would retire a live id, and
    // migrateCategoryIds would then have to remap every historical transaction, budget
    // allocation and learned merchant pointing at it — a lot of risk to change one word.
    en: 'Transport',
    zh: '交通出行',
  },
```

- [ ] **Step 3: Assert the identity did not move**

Append to `__tests__/categoryIntegrity.test.ts`:

```ts
describe('Transport relabel', () => {
  it('changes the wording without creating a new id', () => {
    expect(byId.get('travelling')?.label).toBe('Transport');
    expect(byId.has('transport')).toBe(false);
  });

  it('keeps the retired transport id pointed at travelling', () => {
    expect(CATEGORY_ID_REMAP['transport']).toBe('travelling');
  });
});
```

- [ ] **Step 4: Run tests and commit**

Run: `npx jest __tests__/categoryIntegrity.test.ts __tests__/i18n.test.ts __tests__/categoryPresentation.test.ts`
Expected: PASS

```bash
git add src/data/categories.ts src/i18n/categories.ts __tests__/categoryIntegrity.test.ts && git commit -m "feat(categories): show Travelling as Transport without changing its id"
```

---

### Task 13: Stage A acceptance sweep

**Files:** none modified — this task verifies the spec's Section 5.6 list.

- [ ] **Step 1: Run the whole suite**

Run: `npx jest`
Expected: PASS. Record any pre-existing failures unrelated to this work before starting, so a regression is distinguishable.

- [ ] **Step 2: Walk the 14 acceptance criteria on device**

Check each against the spec's Section 5.6, in order. Criteria 1-5 and 10-13 are exercised by the tests above; 6-9 and 14 need a device pass:

6. Hide Petrol → gone from manual entry, still totalled in Breakdown, its budget allocation intact, its recurring payment still records into it.
7. Open an old expense in a hidden category → its category is preselected and unchanged on save.
8. Hiding the last visible expense category is refused with the explanation; showing Petrol again restores the same row (check its historical expenses are still attached).
9. Teach a merchant → hide that category → record the same merchant again → the suggestion falls through instead of selecting the hidden category.
14. Delete a category with linked records → the replacement is the one explicitly chosen.

Note: criterion 14's "explicit replacement" is **not yet implemented** — `deleteCategory` still picks an arbitrary fallback (`categoriesRepo.ts:120-124`). That is a known gap; see "Deferred within Stage A" below.

- [ ] **Step 3: Typecheck and commit any fixes**

Run: `npm run typecheck`

**Deferred within Stage A:** the spec's Section 4.2 asks that permanent deletion require an explicitly chosen replacement category. The current `deleteCategory` picks `ORDER BY is_default DESC, sort ASC LIMIT 1`. Hiding now covers the "simplify my list" job that made the arbitrary fallback dangerous, so this is a smaller risk than before — but it is still unimplemented. Track it as follow-up work rather than claiming criterion 14 passes.

---

# STAGE B — Trips discovery protocol

### Task 14: Write the Trips usability study protocol

**Files:**
- Create: `docs/superpowers/specs/2026-09-06-trips-usability-study-protocol.md`

This is a documentation deliverable — no code, no tests. It is what makes the Stage C go/revise/defer decision reviewable rather than assumed.

- [ ] **Step 1: Write the protocol**

The document must contain, at minimum:

1. **Purpose and the decision it feeds.** State plainly that Trips arose in a founder discussion, not from a user request, and that this study exists to find out whether the need is real before more code is written.
2. **Recruitment screener.** ~5 participants matching Pip's audience (young Malaysian professionals), all of whom have taken a trip in the last 6 months, including at least 2 who already use an expense tracker. Screening questions, exclusion criteria, and consent language for using their own or fictionalized records.
3. **Pre-task interview.** Ask how they currently work out what a trip cost and what decision that number feeds — **before** showing them anything. Record verbatim.
4. **Fixture ledger.** A prepared record set containing, per the spec: a meal, accommodation booked before departure, mixed currencies, a split bill, and an unrelated payment made during the trip window. Specify exact amounts, dates and currencies so runs are comparable.
5. **Task script.** (a) create a trip; (b) attach existing expenses; (c) inspect Food spending within the trip; (d) add an expense while the trip is running; (e) find a completed trip later. Plus a control task: record an ordinary expense with no trip involvement, to detect friction added to the normal path.
6. **Facilitation rules.** What counts as a hint; when to intervene; how to record a failure without rescuing it.
7. **Observation sheet.** Per task: completed unaided (y/n), wrong selections, time to complete, verbatim confusion, whether the participant conflated trip membership with a category or a date filter.
8. **The gate.** Proceed to a limited pilot only if multiple participants independently describe a real unmet need **and** ≥4 of 5 complete the central grouping-and-inspection task without facilitation. State explicitly that this is a practical pilot criterion, not statistical evidence of demand.
9. **What would falsify the idea.** Name the observations that should stop the work: participants who cannot articulate a decision the number feeds, or who reach for date filters and are satisfied.
10. **Ethics and data handling.** Voluntary participation, informed consent, no remote analytics, no collection of transaction contents beyond what the participant volunteers for the session.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-06-trips-usability-study-protocol.md && git commit -m "docs(trips): add the usability study protocol gating the Trips implementation"
```

---

# STAGE C — Trips

> **Sequencing note.** The spec gates Stage C on Stage B evidence. The scope decision for this plan is to build it regardless, on the founder hypothesis. That is a deliberate, recorded choice — the Task 14 protocol is still worth running, and its findings should shape the flow before wider release. Nothing in Stage C changes any existing total: `trip_id` is additive and nullable.

### Task 15: Trip types, schema, and repo

**Files:**
- Create: `src/lib/trips.ts` (types only in this task; totals arrive in Task 17)
- Create: `src/db/tripsRepo.ts`
- Modify: `src/db/db.ts` (table, column, index, `resetAllData`)
- Modify: `src/lib/types.ts` (`Transaction.tripId`)
- Modify: `src/db/txnRepo.ts` (read/write `trip_id`)
- Test: `__tests__/tripsRepo.test.ts`

**Interfaces:**
- Produces:
  - `interface Trip { id: string; name: string; createdAt: string; archived: boolean; startDate: string | null; endDate: string | null; }`
  - `listTrips(): Promise<Trip[]>`
  - `addTrip(name: string, startDate?: string | null, endDate?: string | null): Promise<Trip>`
  - `renameTrip(id: string, name: string): Promise<void>`
  - `setTripArchived(id: string, archived: boolean): Promise<void>`
  - `deleteTrip(id: string): Promise<void>` — clears membership, never deletes transactions
  - `setTransactionTrip(txnId: string, tripId: string | null): Promise<void>` — lives in `tripsRepo`, delegates to `txnRepo.updateTransactionTrip`
  - `setTransactionsTrip(txnIds: string[], tripId: string | null): Promise<void>` — one SQL statement, for bulk attach
  - `Transaction.tripId: string | null`
  - `NewTxn.tripId?: string | null`

- [ ] **Step 1: Write the failing test**

Create `__tests__/tripsRepo.test.ts`, using the same recording-fake idiom as `__tests__/dbCascades.test.ts:1-50`. Cover:

```ts
it('deleting a trip clears membership and never touches the transactions themselves', async () => {
  const db = install(fakeDb());
  await deleteTrip('t1');
  const sql = db.sql();
  expect(sql).toContain('UPDATE transactions SET trip_id = NULL WHERE trip_id = ?');
  expect(sql).toContain('DELETE FROM trips WHERE id = ?');
  expect(sql.some((s) => s.startsWith('DELETE FROM transactions'))).toBe(false);
});

it('archiving keeps the trip and its membership', async () => {
  const db = install(fakeDb());
  await setTripArchived('t1', true);
  expect(db.sql()).toContain('UPDATE trips SET archived = ? WHERE id = ?');
  expect(db.sql().some((s) => s.includes('trip_id = NULL'))).toBe(false);
});

it('attaches many transactions in one transaction', async () => {
  const db = install(fakeDb());
  await setTransactionsTrip(['a', 'b', 'c'], 't1');
  const writes = db.statements.filter((s) => s.sql.includes('SET trip_id'));
  expect(writes).toHaveLength(1);
  expect(writes[0].sql).toMatch(/WHERE id IN \(\?,\?,\?\)/);
});

it('moving a transaction between trips is a plain overwrite, not an insert', async () => {
  const db = install(fakeDb());
  await setTransactionTrip('a', 't2');
  const write = db.statements.find((s) => s.sql.includes('SET trip_id'));
  expect(write?.args).toEqual(['t2', 'a']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/tripsRepo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the schema**

In `src/db/db.ts`, add to the main `execAsync` block:

```ts
    CREATE TABLE IF NOT EXISTS trips (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      archived    INTEGER NOT NULL DEFAULT 0,
      start_date  TEXT,
      end_date    TEXT
    );
```

and after the existing index list:

```ts
    CREATE INDEX IF NOT EXISTS idx_txn_trip ON transactions (trip_id);
```

plus the column migration alongside the others:

```ts
  // Migration (2026-09-06, trips): optional membership of a named trip. Nullable and unindexed
  // against nothing else — a trip is a second, orthogonal grouping, so the transaction keeps its
  // spending category and its month, and every existing total is unchanged by definition.
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN trip_id TEXT');
  } catch {
    // column already present
  }
```

Add `DELETE FROM trips;` to `resetAllData`'s statement block (after `DELETE FROM transactions;`).

- [ ] **Step 4: Write `src/db/tripsRepo.ts` and the `src/lib/trips.ts` type**

Implement the eight functions listed under Interfaces. `deleteTrip` runs both statements inside one `withTransactionAsync`. `setTransactionsTrip` builds a single `WHERE id IN (...)` with one placeholder per id, and returns early on an empty array. The two membership setters are:

```ts
/** Move one transaction into a trip, or out of every trip. Thin delegation so there is exactly
 *  one place that writes `transactions.trip_id` for a single row. */
export async function setTransactionTrip(txnId: string, tripId: string | null): Promise<void> {
  await updateTransactionTrip(txnId, tripId);
}

/**
 * Attach or detach many transactions at once — what the Activity multi-select hands over.
 *
 * One statement rather than a loop: a bulk attach that failed halfway would leave the trip
 * total showing a number that matches neither what the user selected nor what they had before.
 */
export async function setTransactionsTrip(txnIds: string[], tripId: string | null): Promise<void> {
  if (txnIds.length === 0) return;
  const db = await getDb();
  const placeholders = txnIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE transactions SET trip_id = ? WHERE id IN (${placeholders})`, tripId, ...txnIds);
}
```

Import `updateTransactionTrip` from `./txnRepo` (added in Step 5).

- [ ] **Step 5: Extend `txnRepo`**

`src/db/txnRepo.ts`: add `tripId?: string | null` to `NewTxn` (after line 54), add `trip_id` to the `INSERT INTO transactions` column list and values (line 86-105), add `tripId: it.tripId ?? null` to the returned object (line 118), map `trip_id` in `toTxn`, and add:

```ts
/** Move a transaction into a trip, or out of every trip. Explicit by design: dates can suggest
 *  candidates but never decide membership, so nothing here infers a trip from a date range. */
export async function updateTransactionTrip(id: string, tripId: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE transactions SET trip_id = ? WHERE id = ?', tripId, id);
}
```

Add `tripId?: string | null;` to `Transaction` in `src/lib/types.ts`, documented as optional for the same reason `remark` is.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx jest __tests__/tripsRepo.test.ts __tests__/dbCascades.test.ts && npm run typecheck`
Expected: PASS, exit 0

- [ ] **Step 7: Commit**

```bash
git add src/lib/trips.ts src/lib/types.ts src/db/tripsRepo.ts src/db/db.ts src/db/txnRepo.ts __tests__/tripsRepo.test.ts && git commit -m "feat(trips): add trips table, membership column and repository"
```

---

### Task 16: The trip totals contract

**Files:**
- Modify: `src/lib/trips.ts`
- Test: `__tests__/trips.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TripTotals {
    recordedExpenses: number;
    txnCount: number;
    byCategory: { categoryId: string; amount: number }[];
  }
  export function computeTripTotals(
    txns: Transaction[],
    tripId: string,
    convert: (t: { amount: number; currency: string; nativeAmount?: number | null }) => number
  ): TripTotals;
  ```

- [ ] **Step 1: Write the failing test**

Create `__tests__/trips.test.ts`:

```ts
// __tests__/trips.test.ts
// The totals contract is the whole of Trips that can be wrong quietly. Every case here is one
// the spec names explicitly, and each has a way of producing a plausible-looking number that is
// not the number the user means.
import { computeTripTotals } from '../src/lib/trips';
import type { Transaction } from '../src/lib/types';

// Stand-in for useDisplayCurrency().convertTxn: MYR passes through, SGD is 3.5.
const convert = (t: { amount: number; currency: string }) => t.amount;

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    merchantRaw: 'Somewhere',
    merchantKey: 'somewhere',
    amount: 100,
    currency: 'MYR',
    type: 'expense',
    date: '2026-09-10',
    categoryId: 'food',
    createdAt: '2026-09-10T00:00:00.000Z',
    source: 'manual',
    tripId: 'trip-sg',
    ...over,
  };
}

describe('computeTripTotals', () => {
  it('sums only the expenses linked to this trip', () => {
    const out = computeTripTotals(
      [txn({ amount: 100 }), txn({ amount: 50 }), txn({ amount: 999, tripId: 'trip-other' }), txn({ amount: 777, tripId: null })],
      'trip-sg',
      convert
    );
    expect(out.recordedExpenses).toBe(150);
    expect(out.txnCount).toBe(2);
  });

  it('excludes transfers — they move money, they do not spend it', () => {
    const out = computeTripTotals([txn({ amount: 100 }), txn({ amount: 500, type: 'transfer', categoryId: null })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(100);
  });

  it('excludes income, so a refund recorded as income cannot silently net the total', () => {
    const out = computeTripTotals([txn({ amount: 100 }), txn({ amount: 40, type: 'income', categoryId: 'other-income' })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(100);
  });

  it('counts a split bill once, at the personal share the row already stores', () => {
    // splits.gross holds the full RM120 bill; the transaction carries the RM40 own share.
    const out = computeTripTotals([txn({ amount: 40 })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(40);
  });

  it('includes an advance booking dated before the trip started', () => {
    const out = computeTripTotals([txn({ amount: 600, date: '2026-07-01', categoryId: 'rental' }), txn({ amount: 100 })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(700);
  });

  it('converts every row through the supplied rule rather than adding native amounts', () => {
    const sgdAware = (t: { amount: number; currency: string }) => (t.currency === 'SGD' ? t.amount * 3.5 : t.amount);
    const out = computeTripTotals(
      [txn({ amount: 100, currency: 'MYR' }), txn({ amount: 20, currency: 'SGD', nativeAmount: 20 })],
      'trip-sg',
      sgdAware
    );
    expect(out.recordedExpenses).toBe(170);
  });

  it('breaks down by category, largest first, with uncategorised folded into `other`', () => {
    const out = computeTripTotals(
      [txn({ amount: 30, categoryId: 'food' }), txn({ amount: 90, categoryId: 'rental' }), txn({ amount: 10, categoryId: null })],
      'trip-sg',
      convert
    );
    expect(out.byCategory).toEqual([
      { categoryId: 'rental', amount: 90 },
      { categoryId: 'food', amount: 30 },
      { categoryId: 'other', amount: 10 },
    ]);
  });

  it('an empty trip totals zero rather than throwing', () => {
    expect(computeTripTotals([], 'trip-sg', convert)).toEqual({ recordedExpenses: 0, txnCount: 0, byCategory: [] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/trips.test.ts`
Expected: FAIL — `computeTripTotals is not a function`

- [ ] **Step 3: Implement**

Append to `src/lib/trips.ts`:

```ts
/**
 * What a trip cost, as RECORDED EXPENSES — the sum of the expense rows linked to it.
 *
 * Deliberately not "net trip cost". A refund is currently representable as an income row with no
 * link back to what it refunds, so netting it in would produce a number Pip cannot defend when
 * the user drills into it. Until refunds have explicit linkage, this counts spending only and the
 * UI says so.
 *
 * Three exclusions, each load-bearing:
 *  - Transfers move money between the user's own accounts; nothing is spent.
 *  - Income is not negative spending.
 *  - A split bill contributes the personal share ONLY, which needs no arithmetic here: the
 *    transaction row already carries `ownShare` (the full bill lives on `splits.gross`). Naively
 *    "correcting" for repayments here would subtract the friends' portions a second time.
 *
 * Every row goes through `convert`, the caller's single display-currency rule, so the headline,
 * the breakdown and the drill-down cannot disagree. Native amounts in different currencies are
 * never added directly.
 *
 * Membership is explicit and date-independent: an accommodation booked two months early counts,
 * and an unrelated payment made mid-trip does not.
 */
export function computeTripTotals(
  txns: Transaction[],
  tripId: string,
  convert: (t: { amount: number; currency: string; nativeAmount?: number | null }) => number
): TripTotals {
  const mine = txns.filter((t) => t.tripId === tripId && t.type === 'expense');

  const byCat = new Map<string, number>();
  let recordedExpenses = 0;
  for (const t of mine) {
    const value = convert(t);
    recordedExpenses += value;
    const key = t.categoryId ?? 'other';
    byCat.set(key, (byCat.get(key) ?? 0) + value);
  }

  return {
    recordedExpenses,
    txnCount: mine.length,
    byCategory: [...byCat.entries()]
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npx jest __tests__/trips.test.ts && npm run typecheck`
Expected: PASS, exit 0

```bash
git add src/lib/trips.ts __tests__/trips.test.ts && git commit -m "feat(trips): add the recorded-expenses totals contract"
```

---

### Task 17: Store wiring and split write-off inheritance

**Files:**
- Modify: `src/state/store.tsx` (state, refresh, actions, `writeOffShare`)
- Test: `__tests__/trips.test.ts` (extend with the inheritance rule)

**Interfaces:**
- Produces on `AppData`: `trips: Trip[]`, `addTrip`, `renameTrip`, `setTripArchived`, `deleteTrip`, `setTransactionTrip`, `setTransactionsTrip`.

- [ ] **Step 1: Add the state and actions**

Add `const [trips, setTrips] = useState<Trip[]>([]);` alongside the other state, add `listTrips()` to the `refreshAll` `Promise.all`, and `setTrips(tripRows)` to the setter block. Add the six actions following the exact shape of the existing category actions (call the repo, then re-read and set state).

- [ ] **Step 2: Inherit the trip on a split write-off**

In `writeOffShare` (line ~1059-1072), add `tripId: origin?.tripId ?? null` to the `addTransactions` payload:

```ts
      const [created] = await addTransactions([
        {
          merchantRaw: origin?.merchantRaw ?? 'Written-off split',
          merchantKey: origin?.merchantKey ?? 'written-off split',
          amount,
          currency,
          fxRate,
          type: 'expense',
          date: todayKey(),
          categoryId: origin?.categoryId ?? DEFAULT_EXPENSE_ID,
          // The write-off is the same consumption as the original bill, so it belongs to the same
          // trip. Without this a Singapore dinner someone never paid back would drop out of the
          // Singapore total at exactly the moment it became genuinely the user's cost.
          tripId: origin?.tripId ?? null,
          source: 'manual',
          remark: person ? `Written off: ${person.name} never paid this back` : 'Written-off split',
        },
      ]);
```

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/state/store.tsx && git commit -m "feat(trips): wire trip state and inherit trips on split write-offs"
```

---

### Task 18: Trips list and detail screens

**Files:**
- Create: `src/screens/TripsScreen.tsx`, `src/screens/TripDetailScreen.tsx`
- Modify: `src/lib/screenNav.ts:7-27,40+`, `App.tsx`
- Modify: `src/screens/AllTransactionsScreen.tsx` (entry chip)

- [ ] **Step 1: Register the screens**

`src/lib/screenNav.ts` — add `| 'trips'` and `| 'tripDetail'` to `Screen`, and back targets: `trips` → `'transactions'`; `tripDetail` → `'trips'`.

- [ ] **Step 2: Build `TripsScreen`**

Active trips list (name, recorded-expenses total, transaction count), a create action (name required, dates optional), and an Archived section rendered only when non-empty. Suggest names of the form `Singapore · September 2026` in the create field's placeholder so repeat visits stay distinguishable. Reuse `Card`, `Eyebrow`, `TopBar`, `PrimaryButton`, `Amount`.

- [ ] **Step 3: Build `TripDetailScreen`**

Header: the trip name and `t('tripRecordedExpenses')` — **"Recorded expenses"**, never "total cost". Then the category breakdown (reuse the Breakdown row component), the transaction list (reuse `AllTransactionsScreen`'s row), and two actions: Add expense (opens the normal add flow with the trip prefilled and visible) and Add existing expenses (opens the transaction picker from Task 19). Editing a transaction from here uses the existing `EditTransactionModal`. Back returns to wherever the user came from.

- [ ] **Step 4: Add the Activity entry point**

In `src/screens/AllTransactionsScreen.tsx`, add a compact Trips chip in the header row alongside the existing filter chips (around line 341). Bottom navigation is unchanged.

- [ ] **Step 5: Route in `App.tsx`**

Add the two cases to the screen switcher, following the existing pattern for `categoryDetail` (which also carries a selected id).

- [ ] **Step 6: Verify and commit**

Run the app: create a trip, attach an expense, confirm the total matches the sum shown in the list. Then:

```bash
npm run typecheck && git add src/screens/TripsScreen.tsx src/screens/TripDetailScreen.tsx src/lib/screenNav.ts App.tsx src/screens/AllTransactionsScreen.tsx && git commit -m "feat(trips): add trips list, detail screen and Activity entry point"
```

---

### Task 19: Attaching expenses — picker, bulk action, and More details selector

**Files:**
- Create: `src/components/TripPickerModal.tsx`
- Modify: `src/components/EditTransactionModal.tsx` (More details)
- Modify: `src/screens/AllTransactionsScreen.tsx` (bulk action in select mode)

- [ ] **Step 1: Build `TripPickerModal`**

A list of active trips plus "No trip", with a create-inline affordance. `onSelect(tripId: string | null)`. Archived trips are excluded from the routine picker but reachable via a "Show archived" toggle, so a late charge can still be attached.

- [ ] **Step 2: Add the selector to More details**

In `EditTransactionModal`'s More details section, add a Trip row showing the current trip name or "No trip", opening `TripPickerModal`. Saving writes through `setTransactionTrip`. General entry gains no mandatory step — this is optional and lives behind More details, exactly as the spec requires.

- [ ] **Step 3: Add the bulk attach action**

`AllTransactionsScreen` already has multi-select (`selectMode`, `selected` at lines 194-195, bulk delete at line 286). Add an "Add to trip" action to the same bar, calling `setTransactionsTrip([...selected], tripId)` with the trip chosen through `TripPickerModal`.

- [ ] **Step 4: Verify and commit**

Confirm: attaching 5 expenses in bulk updates the trip total by exactly their sum; moving one expense to a second trip removes it from the first.

```bash
npm run typecheck && git add src/components/TripPickerModal.tsx src/components/EditTransactionModal.tsx src/screens/AllTransactionsScreen.tsx && git commit -m "feat(trips): add trip picker, More details selector and bulk attach"
```

---

### Task 20: Trips in backup, restore, and reset

**Files:**
- Modify: `src/lib/financialExport.ts`, `src/db/restoreRepo.ts`, `src/lib/backupBundle.ts`
- Test: `__tests__/backupRestore.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
describe('trips round-trip', () => {
  it('carries trips and membership through a backup', () => {
    const payload = buildBackupPayloadForTest(cats, {
      trips: [{ id: 'trip-sg', name: 'Singapore · September 2026', createdAt: '2026-09-01T00:00:00.000Z', archived: false, startDate: null, endDate: null }],
      transactions: [makeTxn({ id: 'x1', tripId: 'trip-sg' })],
    });
    expect(payload.trips).toHaveLength(1);
    expect(payload.allTransactions[0].tripId).toBe('trip-sg');
  });

  it('accepts an older backup with no trips key at all', () => {
    expect(validateBackupPayload({ categories: [], transactions: [] })).toBe(true);
  });
});
```

- [ ] **Step 2: Serialize, validate and restore**

Add `trips` to `CommitmentExportExtra` and the backup payload; add `tripId` to the per-transaction backup rows (alongside the existing `categoryId` at `financialExport.ts:477`); add `trips?: any[]` to `RestorePayload` with an `Array.isArray` check in `validateBackupPayload`; insert trips and restore `trip_id` in `restoreRepo`; add `DELETE FROM trips;` to the restore wipe block; pass `trips: data.trips` from `backupBundle.ts`. Old records with no `tripId` restore as `null`.

- [ ] **Step 3: Run and commit**

Run: `npx jest __tests__/backupRestore.test.ts __tests__/financialExport.test.ts && npm run typecheck`

```bash
git add src/lib/financialExport.ts src/db/restoreRepo.ts src/lib/backupBundle.ts __tests__/backupRestore.test.ts && git commit -m "feat(trips): round-trip trips and membership through backup and restore"
```

---

### Task 21: Trips i18n

**Files:** `src/i18n/types.ts`, `src/i18n/translations/en.ts`, `src/i18n/translations/zh.ts`

- [ ] **Step 1: Add the keys**

`tripsTitle` ("Trips" / "行程"), `tripRecordedExpenses` ("Recorded expenses" / "已记录支出"), `newTrip`, `tripNamePlaceholder` ("e.g. Singapore · September 2026"), `tripDatesOptional`, `addExistingExpenses`, `addToTrip`, `noTrip`, `archivedTrips`, `archiveTrip`, `unarchiveTrip`, `deleteTripTitle`, `deleteTripBody` ("Remove this trip? Your expenses stay exactly as they are — only the grouping is removed." / matching Chinese), `showArchived`, `emptyTripBody`, `tripCountExpenses`.

- [ ] **Step 2: Run parity and commit**

Run: `npx jest __tests__/i18n.test.ts && npm run typecheck`

```bash
git add src/i18n && git commit -m "i18n: add Trips strings"
```

---

### Task 22: Full verification sweep

- [ ] **Step 1: Run everything**

Run: `npx jest && npm run typecheck`
Expected: PASS, exit 0

- [ ] **Step 2: Verify the Stage C contract on device**

Per the spec's Section 6.3, confirm each: a Food expense linked to a trip appears in both the trip and the Food breakdown but **once** in overall spending; the monthly accounting still uses the transaction's own date; a mixed-currency trip's headline equals the sum of its drill-down rows; removing a trip preserves every transaction; a full reset clears trips.

- [ ] **Step 3: Report honestly**

Record which acceptance criteria pass, which were verified by test versus by hand, and that Stage A criterion 14 (explicit replacement on delete) remains unimplemented.
