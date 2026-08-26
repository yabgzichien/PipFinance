# Tax Relief Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-tag transactions against a curated set of LHDN relief lines (silently, using data the app already captures), track evidence completeness per tag, and let the user review/correct tags and export a per-year audit pack, all from a single new Tax screen.

**Architecture:** A new `relief_tags` table + pure `src/lib/relief.ts` module (cap math, detection, evidence state), following the existing `commitmentsRepo`/`src/lib/commitments.ts` split of DB-repo vs. pure-logic. Detection hooks into the two places the app already creates transactions with the right signal (`commitCategorized` completion in `AddFlow.tsx`, `payCommitment` in `store.tsx`) with zero new UI on those paths. Everything else lives in a new `TaxScreen.tsx` reached from Settings.

**Tech Stack:** React Native + Expo, TypeScript, `expo-sqlite`, Jest (`jest-expo` preset). New dependency: `pdf-lib` (pure JS PDF generation, no native module) for the audit-pack export.

**Spec:** [docs/superpowers/specs/2026-08-23-tax-relief-tagging-design.md](../specs/2026-08-23-tax-relief-tagging-design.md)

## Global Constraints

- No push notifications and no in-flow UI anywhere in the scan/save path for this feature: detection is completely silent (spec Non-goals).
- No evidence-state UI outside the Tax screen; the only footprint elsewhere is a small count badge on the Settings "Tax relief" row (spec §5, §7.1).
- No opt-in toggle: runs automatically for every install (spec Non-goals).
- v1 relief schedule is the curated subset only (Lifestyle, Sports, Medical + 3 sub-lines, insurance premium, SSPN, childcare): not the full ~20-line LHDN schedule (spec §2).
- No MyInvois/e-Invoice API calls anywhere: capture is photo/QR-visual only, stored as `einvoiceImageUri` (spec §6, Non-goals).
- Only future commitment payments get auto-tagged; no retroactive backfill of past occurrences in v1 (spec §7.2).
- No em dashes in any user-facing string (labels, alerts, chip text): use a colon, comma, or period instead. This is a user preference for text an end user reads; it does not apply to internal code comments, where the existing codebase already uses em dashes freely.
- Pure-logic modules get Jest unit tests, following the existing `__tests__/commitments.test.ts` style (builder-function fixtures, `describe`/`it`). DB repos and screens are verified manually in the live app: this project has no DB-mock or component-test infrastructure, and this plan does not introduce any.

---

### Task 1: Relief types and the v1 relief schedule

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/reliefSchedule.ts`
- Test: `__tests__/reliefSchedule.test.ts`

**Interfaces:**
- Produces: `ReliefOrigin`, `EvidenceState`, `ReliefTag` (in `types.ts`); `ReliefLine`, `ReliefSchedule`, `RELIEF_SCHEDULE_2025`, `RELIEF_SCHEDULES`, `scheduleForYA(ya: number): ReliefSchedule | null` (in `reliefSchedule.ts`)

- [ ] **Step 1: Add the relief types to `src/lib/types.ts`**

Insert after the `Transaction` interface (which currently ends with `receiptUri?: string | null;\n}` around line 53):

```ts
export type ReliefOrigin = 'auto' | 'commitment' | 'manual';
export type EvidenceState = 'complete' | 'missing-cert' | 'no-image' | 'weak-unnamed';

/** A tag linking a transaction (in full or in part) to an LHDN relief line for a given year
 *  of assessment. See docs/superpowers/specs/2026-08-23-tax-relief-tagging-design.md. */
export interface ReliefTag {
  id: string;
  txnId: string;
  code: string;
  ya: number;
  amount: number;
  origin: ReliefOrigin;
  certImageUri: string | null;
  einvoiceImageUri: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing schedule-invariant test**

Create `__tests__/reliefSchedule.test.ts`:

```ts
import { RELIEF_SCHEDULES, scheduleForYA } from '../src/lib/reliefSchedule';

describe('relief schedules', () => {
  for (const [yaKey, schedule] of Object.entries(RELIEF_SCHEDULES)) {
    describe(`YA ${yaKey}`, () => {
      it('has unique codes', () => {
        const codes = schedule.lines.map((l) => l.code);
        expect(new Set(codes).size).toBe(codes.length);
      });

      it('has every parent reference pointing at a real code in the same schedule', () => {
        const codes = new Set(schedule.lines.map((l) => l.code));
        for (const line of schedule.lines) {
          if (line.parent) expect(codes.has(line.parent)).toBe(true);
        }
      });

      it('has a positive cap on every line', () => {
        for (const line of schedule.lines) expect(line.cap).toBeGreaterThan(0);
      });

      it('has a `ya` field matching its own registry key', () => {
        expect(schedule.ya).toBe(Number(yaKey));
      });
    });
  }

  it('returns null for a year with no defined schedule', () => {
    expect(scheduleForYA(1999)).toBeNull();
  });

  it('returns the 2025 schedule by year number', () => {
    expect(scheduleForYA(2025)).toBe(RELIEF_SCHEDULES[2025]);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails on the missing module**

Run: `npx jest reliefSchedule -v`
Expected: FAIL with "Cannot find module '../src/lib/reliefSchedule'"

- [ ] **Step 4: Create `src/lib/reliefSchedule.ts`**

```ts
// src/lib/reliefSchedule.ts
// The curated v1 subset of LHDN relief lines (docs/superpowers/specs/
// 2026-08-23-tax-relief-tagging-design.md §2): what a working adult's receipts and
// commitments actually touch, not the full ~20-line schedule. Ships as code, versioned by
// year of assessment: a new YA is a new exported const, never a mutation of an old one.

export interface ReliefLine {
  code: string;
  /** When set, this line's claims also draw down the parent's own `cap` as a shared pool
   *  (see `computeUsage` in `relief.ts`). */
  parent?: string;
  label: string;
  /** What the user types into e-Filing, e.g. 'G9'. */
  formField: string;
  /** This line's own cap in RM. */
  cap: number;
  requiresCert?: 'MMC' | 'MDC' | null;
  /** Lowercased line-item / merchant heuristics tried by `matchRelief`. */
  matchKeywords: string[];
  /** Whether this line can be assigned to a `Commitment` in the Tax screen. */
  commitmentEligible: boolean;
}

export interface ReliefSchedule {
  ya: number;
  lines: ReliefLine[];
}

export const RELIEF_SCHEDULE_2025: ReliefSchedule = {
  ya: 2025,
  lines: [
    {
      code: 'lifestyle', label: 'Lifestyle', formField: 'G9', cap: 2500,
      matchKeywords: ['book', 'magazine', 'newspaper', 'laptop', 'smartphone', 'tablet', 'computer', 'internet', 'broadband', 'unifi', 'course', 'skill'],
      commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'sports', label: 'Sports & fitness', formField: 'G10', cap: 1000,
      matchKeywords: ['gym', 'fitness', 'sports equipment', 'racket', 'yoga', 'membership'],
      commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'medical', label: 'Medical (aggregate)', formField: 'G6-G8', cap: 10000,
      matchKeywords: [], commitmentEligible: false, requiresCert: null,
    },
    {
      code: 'medical.serious', parent: 'medical', label: 'Serious diseases / fertility', formField: 'G6(i)-(ii)', cap: 10000,
      matchKeywords: ['hospital', 'clinic', 'treatment'], commitmentEligible: false, requiresCert: 'MMC',
    },
    {
      code: 'medical.vaccination', parent: 'medical', label: 'Vaccination', formField: 'G6(iii)', cap: 1000,
      matchKeywords: ['vaccine', 'vaccination', 'jab'], commitmentEligible: false, requiresCert: null,
    },
    {
      code: 'medical.dental', parent: 'medical', label: 'Dental exam & treatment', formField: 'G6(iv)', cap: 1000,
      matchKeywords: ['dental', 'dentist'], commitmentEligible: false, requiresCert: 'MDC',
    },
    {
      code: 'medical.checkup', parent: 'medical', label: 'Health screening / mental health', formField: 'G7', cap: 1000,
      matchKeywords: ['medical checkup', 'health screening', 'mental health', 'covid test'], commitmentEligible: false, requiresCert: null,
    },
    {
      code: 'insurance.education-medical', label: 'Education / medical insurance premium', formField: 'G4', cap: 4000,
      matchKeywords: ['insurance', 'takaful'], commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'sspn', label: 'SSPN net deposit', formField: 'G13', cap: 8000,
      matchKeywords: ['sspn'], commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'childcare', label: 'Child care centre / kindergarten', formField: 'G12', cap: 3000,
      matchKeywords: ['childcare', 'kindergarten', 'daycare', 'nursery'], commitmentEligible: true, requiresCert: null,
    },
  ],
};

export const RELIEF_SCHEDULES: Record<number, ReliefSchedule> = {
  2025: RELIEF_SCHEDULE_2025,
};

export function scheduleForYA(ya: number): ReliefSchedule | null {
  return RELIEF_SCHEDULES[ya] ?? null;
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest reliefSchedule -v`
Expected: PASS, all cases green

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/reliefSchedule.ts __tests__/reliefSchedule.test.ts
git commit -m "feat(tax): add relief types and the v1 curated relief schedule"
```

---

### Task 2: Core relief engine (pure logic)

**Files:**
- Create: `src/lib/relief.ts`
- Test: `__tests__/relief.test.ts`

**Interfaces:**
- Consumes: `ReliefTag`, `EvidenceState` (`types.ts`, Task 1); `Transaction` (`types.ts`, existing); `ReliefLine`, `ReliefSchedule` (`reliefSchedule.ts`, Task 1); `ScannedReceipt`, `ScannedItem` (`parseReceipt.ts`, existing)
- Produces: `yaForDate(isoDate: string): number`; `matchRelief(txn, receipt, reliefMemory, schedule): { code: string; amount: number } | null`; `evidenceState(tag, txn, line): EvidenceState`; `isRequestable(evidence, txn, today): boolean`; `computeUsage(tags, schedule): ReliefUsage[]`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/relief.test.ts`:

```ts
import { computeUsage, evidenceState, isRequestable, matchRelief, yaForDate } from '../src/lib/relief';
import { RELIEF_SCHEDULE_2025 } from '../src/lib/reliefSchedule';
import type { ReliefLine, ReliefSchedule } from '../src/lib/reliefSchedule';
import type { ReliefTag, Transaction } from '../src/lib/types';
import type { ScannedReceipt } from '../src/lib/parseReceipt';

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: 't1', merchantRaw: 'Popular Bookstore', merchantKey: 'popularbookstore', amount: 120,
    currency: 'MYR', type: 'expense', date: '2025-06-05', categoryId: 'shopping',
    createdAt: '2025-06-05T10:00:00.000Z', source: 'extracted', receiptUri: 'file:///r1.jpg',
    ...over,
  };
}

function tag(over: Partial<ReliefTag>): ReliefTag {
  return {
    id: 'rt1', txnId: 't1', code: 'lifestyle', ya: 2025, amount: 120, origin: 'auto',
    certImageUri: null, einvoiceImageUri: null, createdAt: '2025-06-05T10:00:00.000Z',
    ...over,
  };
}

describe('yaForDate', () => {
  it('takes the year straight from the ISO date', () => {
    expect(yaForDate('2025-06-05')).toBe(2025);
    expect(yaForDate('2026-01-01')).toBe(2026);
  });
});

describe('matchRelief', () => {
  const memory = { 'popularbookstore': 'lifestyle', 'unknownshop': 'sports' };

  it('matches a line item by keyword and tags only that item amount', () => {
    const receipt: ScannedReceipt = {
      merchant: 'Big Store', subtotal: 380, serviceCharge: null, tax: null, total: 380,
      items: [
        { label: 'Groceries', amount: 260, quantity: 1 },
        { label: 'Laptop stand', amount: 120, quantity: 1 },
      ],
    };
    const result = matchRelief(txn({ amount: 380, merchantKey: 'bigstore' }), receipt, {}, RELIEF_SCHEDULE_2025);
    expect(result).toEqual({ code: 'lifestyle', amount: 120 });
  });

  it('falls back to merchant memory when no line item matches', () => {
    const receipt: ScannedReceipt = {
      merchant: 'Popular Bookstore', subtotal: 120, serviceCharge: null, tax: null, total: 120,
      items: [{ label: 'Stationery set', amount: 120, quantity: 1 }],
    };
    const result = matchRelief(txn({}), receipt, memory, RELIEF_SCHEDULE_2025);
    expect(result).toEqual({ code: 'lifestyle', amount: 120 });
  });

  it('uses merchant memory directly when there is no receipt at all', () => {
    const result = matchRelief(txn({ merchantKey: 'unknownshop', amount: 89 }), null, memory, RELIEF_SCHEDULE_2025);
    expect(result).toEqual({ code: 'sports', amount: 89 });
  });

  it('returns null when nothing matches', () => {
    const result = matchRelief(txn({ merchantKey: 'randomcafe', amount: 15 }), null, {}, RELIEF_SCHEDULE_2025);
    expect(result).toBeNull();
  });

  it('ignores a remembered code that no longer exists in the schedule', () => {
    const staleMemory = { popularbookstore: 'retired-code' };
    const result = matchRelief(txn({}), null, staleMemory, RELIEF_SCHEDULE_2025);
    expect(result).toBeNull();
  });
});

describe('evidenceState', () => {
  const dentalLine = RELIEF_SCHEDULE_2025.lines.find((l) => l.code === 'medical.dental') as ReliefLine;
  const lifestyleLine = RELIEF_SCHEDULE_2025.lines.find((l) => l.code === 'lifestyle') as ReliefLine;
  const sspnLine = RELIEF_SCHEDULE_2025.lines.find((l) => l.code === 'sspn') as ReliefLine;

  it('is no-image when neither the transaction nor the tag has a photo', () => {
    const t = txn({ receiptUri: null });
    expect(evidenceState(tag({}), t, lifestyleLine)).toBe('no-image');
  });

  it('is missing-cert when the line requires one and none is attached, even with a receipt', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({ code: 'medical.dental' }), t, dentalLine)).toBe('missing-cert');
  });

  it('is complete once the required cert is attached', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({ code: 'medical.dental', certImageUri: 'file:///cert.jpg' }), t, dentalLine)).toBe('complete');
  });

  it('is weak-unnamed for discretionary spending with a receipt but no e-Invoice', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({}), t, lifestyleLine)).toBe('weak-unnamed');
  });

  it('is complete for a commitment-eligible line once it has a receipt, with no e-Invoice required', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({ code: 'sspn' }), t, sspnLine)).toBe('complete');
  });

  it('is complete for discretionary spending once an e-Invoice photo is attached', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({ einvoiceImageUri: 'file:///inv.jpg' }), t, lifestyleLine)).toBe('complete');
  });
});

describe('isRequestable', () => {
  it('is true only for weak-unnamed evidence dated in the current month', () => {
    const today = new Date('2025-06-20T00:00:00.000Z');
    expect(isRequestable('weak-unnamed', txn({ date: '2025-06-05' }), today)).toBe(true);
  });

  it('is false once the transaction month has passed', () => {
    const today = new Date('2025-07-01T00:00:00.000Z');
    expect(isRequestable('weak-unnamed', txn({ date: '2025-06-05' }), today)).toBe(false);
  });

  it('is false for any evidence state other than weak-unnamed', () => {
    const today = new Date('2025-06-20T00:00:00.000Z');
    expect(isRequestable('complete', txn({ date: '2025-06-05' }), today)).toBe(false);
    expect(isRequestable('no-image', txn({ date: '2025-06-05' }), today)).toBe(false);
  });

  it('is false when the transaction has no date', () => {
    const today = new Date('2025-06-20T00:00:00.000Z');
    expect(isRequestable('weak-unnamed', txn({ date: null }), today)).toBe(false);
  });
});

describe('computeUsage', () => {
  const schedule: ReliefSchedule = {
    ya: 2025,
    lines: [
      { code: 'medical', label: 'Medical', formField: 'G6-G8', cap: 10000, matchKeywords: [], commitmentEligible: false },
      { code: 'medical.serious', parent: 'medical', label: 'Serious', formField: 'G6(i)', cap: 10000, matchKeywords: [], commitmentEligible: false },
      { code: 'medical.vaccination', parent: 'medical', label: 'Vaccination', formField: 'G6(iii)', cap: 1000, matchKeywords: [], commitmentEligible: false },
      { code: 'medical.dental', parent: 'medical', label: 'Dental', formField: 'G6(iv)', cap: 1000, matchKeywords: [], commitmentEligible: false },
      { code: 'medical.checkup', parent: 'medical', label: 'Checkup', formField: 'G7', cap: 1000, matchKeywords: [], commitmentEligible: false },
      { code: 'lifestyle', label: 'Lifestyle', formField: 'G9', cap: 2500, matchKeywords: [], commitmentEligible: true },
    ],
  };

  it('caps a standalone line at its own cap', () => {
    const tags = [tag({ code: 'lifestyle', amount: 1800 }), tag({ id: 'rt2', code: 'lifestyle', amount: 900 })];
    const usage = computeUsage(tags, schedule);
    const lifestyle = usage.find((u) => u.code === 'lifestyle')!;
    expect(lifestyle.claimed).toBe(2700);
    expect(lifestyle.capUsed).toBe(2500);
    expect(lifestyle.remaining).toBe(0);
  });

  it('shrinks a later sibling once earlier siblings (in schedule order) exhaust the shared aggregate', () => {
    const tags = [
      tag({ id: 'a', code: 'medical.serious', amount: 8000 }),
      tag({ id: 'b', code: 'medical.vaccination', amount: 1000 }),
      tag({ id: 'c', code: 'medical.dental', amount: 1000 }),
      tag({ id: 'd', code: 'medical.checkup', amount: 1000 }),
    ];
    const usage = computeUsage(tags, schedule);
    const byCode = Object.fromEntries(usage.map((u) => [u.code, u]));
    // 8000 (serious) + 1000 (vaccination) + 1000 (dental) = 10000, the full parent cap;
    // checkup is last in schedule order so it gets none of the shared room even though its
    // own RM1,000 cap was never itself exceeded.
    expect(byCode['medical.serious'].capUsed).toBe(8000);
    expect(byCode['medical.vaccination'].capUsed).toBe(1000);
    expect(byCode['medical.dental'].capUsed).toBe(1000);
    expect(byCode['medical.checkup'].capUsed).toBe(0);
    expect(byCode['medical'].capUsed).toBe(10000);
    expect(byCode['medical'].remaining).toBe(0);
  });

  it('reports zero claimed for a line with no tags', () => {
    const usage = computeUsage([], schedule);
    for (const u of usage) {
      expect(u.claimed).toBe(0);
      expect(u.capUsed).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest relief.test.ts -v`
Expected: FAIL with "Cannot find module '../src/lib/relief'"

- [ ] **Step 3: Create `src/lib/relief.ts`**

```ts
// src/lib/relief.ts
// Pure logic for tax relief tagging: which line a transaction matches, whether a tag's
// evidence is good enough, whether its e-Invoice request window is still open, and how
// claimed amounts consume nested aggregate caps. No DB/UI imports  see reliefRepo.ts for
// persistence and TaxScreen.tsx for the UI that renders these.
import type { ScannedReceipt } from './parseReceipt';
import type { ReliefLine, ReliefSchedule } from './reliefSchedule';
import type { EvidenceState, ReliefTag, Transaction } from './types';

/** A transaction dated in a given calendar year always counts toward that same year of
 *  assessment (research doc §1.6). Dates in this app are stored as 'YYYY-MM-DD' strings, so
 *  this reads the year directly rather than going through `Date` and risking a timezone
 *  shift at a year boundary. */
export function yaForDate(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

/**
 * Line-item keyword match takes priority over merchant memory (spec §4): it lets a mixed
 * basket tag only the matching item's amount instead of the whole receipt total. Falls back
 * to a remembered merchant -> code mapping, and to no match at all if neither hits or the
 * remembered code no longer exists in this year's schedule.
 */
export function matchRelief(
  txn: Transaction,
  receipt: ScannedReceipt | null,
  reliefMemory: Record<string, string>,
  schedule: ReliefSchedule
): { code: string; amount: number } | null {
  if (receipt) {
    for (const item of receipt.items) {
      const label = item.label.toLowerCase();
      const line = schedule.lines.find((l) => l.matchKeywords.some((kw) => label.includes(kw)));
      if (line) return { code: line.code, amount: item.amount };
    }
  }
  const memCode = reliefMemory[txn.merchantKey];
  if (memCode && schedule.lines.some((l) => l.code === memCode)) {
    return { code: memCode, amount: txn.amount };
  }
  return null;
}

/**
 * Decision order matters: no-image is checked before missing-cert (a cert photo with
 * nothing else attached still counts as having *an* image), and weak-unnamed only applies to
 * discretionary spending (`commitmentEligible: false`)  a recurring bill's own receipt is
 * already as good as evidence gets, there is no buyer-name expectation to fall short of.
 */
export function evidenceState(tag: ReliefTag, txn: Transaction, line: ReliefLine): EvidenceState {
  if (!txn.receiptUri && !tag.certImageUri) return 'no-image';
  if (line.requiresCert && !tag.certImageUri) return 'missing-cert';
  if (!line.commitmentEligible && !tag.einvoiceImageUri) return 'weak-unnamed';
  return 'complete';
}

/** The right to request an individual e-Invoice for a plain receipt expires at the end of
 *  the transaction's calendar month (research doc §3.4). Only ever true for weak-unnamed
 *  evidence  everything else either already has stronger proof or isn't the kind of line
 *  an e-Invoice request applies to. */
export function isRequestable(evidence: EvidenceState, txn: Transaction, today: Date): boolean {
  if (evidence !== 'weak-unnamed') return false;
  if (!txn.date) return false;
  return txn.date.slice(0, 7) === today.toISOString().slice(0, 7);
}

export interface ReliefUsage {
  code: string;
  claimed: number;
  capUsed: number;
  cap: number;
  remaining: number;
}

/**
 * Sums tags per line, then applies parent-aggregate capping: a line with `parent` set draws
 * on a shared pool bounded by the parent's own `cap`. Siblings consume that shared pool in
 * schedule-list order  a line earlier in `reliefSchedule.ts`'s array effectively has
 * priority over a later one when the aggregate runs out, which is why sibling order in the
 * schedule data is a real product decision, not cosmetic.
 */
export function computeUsage(tags: ReliefTag[], schedule: ReliefSchedule): ReliefUsage[] {
  const claimedByCode: Record<string, number> = {};
  for (const t of tags) claimedByCode[t.code] = (claimedByCode[t.code] ?? 0) + t.amount;

  const childrenByParent: Record<string, ReliefLine[]> = {};
  for (const line of schedule.lines) {
    if (!line.parent) continue;
    (childrenByParent[line.parent] ??= []).push(line);
  }

  const usageByCode: Record<string, ReliefUsage> = {};
  for (const line of schedule.lines) {
    const claimed = claimedByCode[line.code] ?? 0;
    usageByCode[line.code] = { code: line.code, claimed, capUsed: 0, cap: line.cap, remaining: line.cap };
  }

  for (const line of schedule.lines) {
    if (line.parent) continue; // resolved through the parent branch below
    const usage = usageByCode[line.code];
    const children = childrenByParent[line.code] ?? [];
    if (children.length === 0) {
      usage.capUsed = Math.min(usage.claimed, usage.cap);
      usage.remaining = usage.cap - usage.capUsed;
      continue;
    }
    let poolRemaining = line.cap;
    const parentUsed = Math.min(usage.claimed, poolRemaining);
    poolRemaining -= parentUsed;
    for (const child of children) {
      const childUsage = usageByCode[child.code];
      const childCapUsed = Math.min(childUsage.claimed, child.cap, poolRemaining);
      childUsage.capUsed = childCapUsed;
      childUsage.remaining = child.cap - childCapUsed;
      poolRemaining -= childCapUsed;
    }
    usage.capUsed = parentUsed + children.reduce((s, c) => s + usageByCode[c.code].capUsed, 0);
    usage.remaining = poolRemaining;
  }

  return schedule.lines.map((l) => usageByCode[l.code]);
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest relief.test.ts -v`
Expected: PASS, all cases green

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/relief.ts __tests__/relief.test.ts
git commit -m "feat(tax): add relief detection, evidence-state and cap-aggregate engine"
```

---

### Task 3: Database schema, `reliefRepo.ts`, and `Commitment.reliefCode`

**Files:**
- Modify: `src/db/db.ts`
- Modify: `src/lib/commitments.ts`
- Modify: `src/db/commitmentsRepo.ts`
- Modify: `__tests__/commitments.test.ts`
- Modify: `__tests__/financialExport.test.ts`
- Create: `src/db/reliefRepo.ts`

**Interfaces:**
- Consumes: `ReliefTag`, `ReliefOrigin` (`types.ts`, Task 1); `genId`, `getDb` (`db.ts`, existing)
- Produces: `listReliefTags(ya)`, `getReliefTagsForTxn(txnId)`, `addReliefTag(input)`, `updateReliefTag(id, patch)`, `deleteReliefTag(id)`, `getReliefMemoryMap()`, `upsertReliefMemory(key, code)` (`reliefRepo.ts`); `Commitment.reliefCode: string | null` (`commitments.ts`)

- [ ] **Step 1: Add the `relief_tags` and `relief_memory` tables to `src/db/db.ts`**

Insert into the main `CREATE TABLE IF NOT EXISTS` block, right after the existing `commitment_occurrences` table (ends at line 160) and before `deleted_default_categories`:

```sql
    CREATE TABLE IF NOT EXISTS relief_tags (
      id                 TEXT PRIMARY KEY NOT NULL,
      txn_id             TEXT NOT NULL,
      code               TEXT NOT NULL,
      ya                 INTEGER NOT NULL,
      amount             REAL NOT NULL,
      origin             TEXT NOT NULL DEFAULT 'auto',
      cert_image_uri     TEXT,
      einvoice_image_uri TEXT,
      created_at         TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS relief_memory (
      merchant_key TEXT PRIMARY KEY NOT NULL,
      relief_code  TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
```

Add two indexes alongside the existing `CREATE INDEX` lines (after `idx_occ_month`):

```sql
    CREATE INDEX IF NOT EXISTS idx_relief_txn ON relief_tags (txn_id);
    CREATE INDEX IF NOT EXISTS idx_relief_ya_code ON relief_tags (ya, code);
```

- [ ] **Step 2: Add the `commitments.relief_code` migration**

In `init()`, add beside the other `ALTER TABLE ... ADD COLUMN` try/catch blocks (after the `receipt_uri` migration, before `await migrateCategoryIds(db);`):

```ts
  // Migration: which relief line a recurring bill counts toward, so its future paid
  // occurrences can auto-tag without the user re-mapping it every time.
  try {
    await db.execAsync('ALTER TABLE commitments ADD COLUMN relief_code TEXT');
  } catch {
    // column already present
  }
```

- [ ] **Step 3: Add `reliefCode` to the `Commitment` type in `src/lib/commitments.ts`**

```ts
export interface Commitment {
  id: string;
  label: string;
  merchantKey: string;
  kind: CommitmentKind;
  amount: number;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  dueDay: number;
  startMonth: string;
  endMonth: string | null;
  archived: boolean;
  createdAt: string;
  /** LHDN relief line code this bill counts toward, set once in the Tax screen. Every future
   *  paid occurrence auto-tags its transaction against this code. Null = not a relief bill. */
  reliefCode: string | null;
}
```

- [ ] **Step 4: Fix the two existing `Commitment` literal builders that the new required field breaks**

In `__tests__/commitments.test.ts`, the `commitment()` helper (near the top of the file):

```ts
function commitment(over: Partial<Commitment>): Commitment {
  return {
    id: 'c1', label: 'Maxis', merchantKey: 'maxis', kind: 'expense', amount: 89,
    categoryId: 'communications', fromAccountId: 'a1', toAccountId: null,
    dueDay: 5, startMonth: '2026-06', endMonth: null, archived: false,
    createdAt: '2026-06-01T00:00:00.000Z', reliefCode: null, ...over,
  };
}
```

In `__tests__/financialExport.test.ts`, the `Commitment` literal around line 244-247:

```ts
  const commitment: Commitment = {
    id: 'c1', label: 'S&P 500 DCA', merchantKey: 'stockbroker-dca', kind: 'investment', amount: 200,
    categoryId: null, fromAccountId: 'a1', toAccountId: 'a2', dueDay: 15, startMonth: '2026-05',
    endMonth: null, archived: false, createdAt: '2026-05-01T00:00:00.000Z', reliefCode: null,
  };
```

- [ ] **Step 5: Wire `reliefCode` through `commitmentsRepo.ts`**

`toCommitment()`: add `reliefCode: r.relief_code,` to the returned object.

`CommitmentRow` interface: add `relief_code: string | null;`.

`NewCommitment` interface: add `reliefCode?: string | null;` (optional  most commitments are never relief-mapped).

`addCommitment()`: add `relief_code` to the INSERT column list and bind `input.reliefCode ?? null`; add `reliefCode: input.reliefCode ?? null,` to the returned object.

`updateCommitment()`: widen the patch type and add the field branch:

```ts
export async function updateCommitment(
  id: string,
  patch: Partial<Pick<Commitment, 'label' | 'amount' | 'categoryId' | 'fromAccountId' | 'toAccountId' | 'dueDay' | 'endMonth' | 'reliefCode'>>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.label !== undefined) { fields.push('label = ?'); values.push(patch.label); }
  if (patch.amount !== undefined) { fields.push('amount = ?'); values.push(patch.amount); }
  if (patch.categoryId !== undefined) { fields.push('category_id = ?'); values.push(patch.categoryId); }
  if (patch.fromAccountId !== undefined) { fields.push('from_account_id = ?'); values.push(patch.fromAccountId); }
  if (patch.toAccountId !== undefined) { fields.push('to_account_id = ?'); values.push(patch.toAccountId); }
  if (patch.dueDay !== undefined) { fields.push('due_day = ?'); values.push(patch.dueDay); }
  if (patch.endMonth !== undefined) { fields.push('end_month = ?'); values.push(patch.endMonth); }
  if (patch.reliefCode !== undefined) { fields.push('relief_code = ?'); values.push(patch.reliefCode); }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE commitments SET ${fields.join(', ')} WHERE id = ?`, ...(values as any[]));
}
```

- [ ] **Step 6: Create `src/db/reliefRepo.ts`**

```ts
// src/db/reliefRepo.ts
import { genId, getDb } from './db';
import type { ReliefOrigin, ReliefTag } from '../lib/types';

interface ReliefTagRow {
  id: string;
  txn_id: string;
  code: string;
  ya: number;
  amount: number;
  origin: string;
  cert_image_uri: string | null;
  einvoice_image_uri: string | null;
  created_at: string;
}

function toReliefTag(r: ReliefTagRow): ReliefTag {
  return {
    id: r.id,
    txnId: r.txn_id,
    code: r.code,
    ya: r.ya,
    amount: r.amount,
    origin: (r.origin as ReliefOrigin) ?? 'auto',
    certImageUri: r.cert_image_uri,
    einvoiceImageUri: r.einvoice_image_uri,
    createdAt: r.created_at,
  };
}

export interface NewReliefTag {
  txnId: string;
  code: string;
  ya: number;
  amount: number;
  origin: ReliefOrigin;
}

export async function listReliefTags(ya: number): Promise<ReliefTag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReliefTagRow>('SELECT * FROM relief_tags WHERE ya = ? ORDER BY created_at DESC', ya);
  return rows.map(toReliefTag);
}

export async function getReliefTagsForTxn(txnId: string): Promise<ReliefTag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReliefTagRow>('SELECT * FROM relief_tags WHERE txn_id = ? ORDER BY created_at DESC', txnId);
  return rows.map(toReliefTag);
}

export async function addReliefTag(input: NewReliefTag): Promise<ReliefTag> {
  const db = await getDb();
  const id = genId();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO relief_tags (id, txn_id, code, ya, amount, origin, cert_image_uri, einvoice_image_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    id,
    input.txnId,
    input.code,
    input.ya,
    input.amount,
    input.origin,
    createdAt
  );
  return {
    id,
    txnId: input.txnId,
    code: input.code,
    ya: input.ya,
    amount: input.amount,
    origin: input.origin,
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt,
  };
}

export async function updateReliefTag(
  id: string,
  patch: Partial<Pick<ReliefTag, 'code' | 'amount' | 'certImageUri' | 'einvoiceImageUri'>>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.code !== undefined) { fields.push('code = ?'); values.push(patch.code); }
  if (patch.amount !== undefined) { fields.push('amount = ?'); values.push(patch.amount); }
  if (patch.certImageUri !== undefined) { fields.push('cert_image_uri = ?'); values.push(patch.certImageUri); }
  if (patch.einvoiceImageUri !== undefined) { fields.push('einvoice_image_uri = ?'); values.push(patch.einvoiceImageUri); }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE relief_tags SET ${fields.join(', ')} WHERE id = ?`, ...(values as any[]));
}

export async function deleteReliefTag(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM relief_tags WHERE id = ?', id);
}

// --- Relief memory: merchantKey -> reliefCode, same shape as merchant_memory but its own
// table so relief learning can be cleared independently of category learning in Settings.

export async function getReliefMemoryMap(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ merchant_key: string; relief_code: string }>(
    'SELECT merchant_key, relief_code FROM relief_memory'
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.merchant_key] = r.relief_code;
  return map;
}

export async function upsertReliefMemory(merchantKey: string, code: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO relief_memory (merchant_key, relief_code, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(merchant_key) DO UPDATE SET relief_code = excluded.relief_code, updated_at = excluded.updated_at`,
    merchantKey,
    code,
    new Date().toISOString()
  );
}
```

- [ ] **Step 7: Run the full test suite to confirm nothing broke**

Run: `npx jest -v`
Expected: PASS. `commitments.test.ts` and `financialExport.test.ts` still pass with the `reliefCode: null` fixtures added; no other file references a bare `Commitment` literal (confirmed by `grep -rn "endMonth:" src/ __tests__/` during planning: only these two files construct one).

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 9: Manual smoke check**

Run the app (`npx expo start`), open it fresh so `init()` runs against the existing dev database, and confirm no crash on boot (proves the two new `CREATE TABLE IF NOT EXISTS` statements and the new `ALTER TABLE` migration ran cleanly against an already-migrated database).

- [ ] **Step 10: Commit**

```bash
git add src/db/db.ts src/db/reliefRepo.ts src/lib/commitments.ts src/db/commitmentsRepo.ts __tests__/commitments.test.ts __tests__/financialExport.test.ts
git commit -m "feat(tax): add relief_tags/relief_memory schema, reliefRepo, and Commitment.reliefCode"
```

---

### Task 4: Wire silent auto-detection into the save flow

**Files:**
- Modify: `src/state/store.tsx`
- Modify: `src/screens/AddFlow.tsx`

**Interfaces:**
- Consumes: `matchRelief`, `yaForDate` (`relief.ts`, Task 2); `scheduleForYA` (`reliefSchedule.ts`, Task 1); `addReliefTag`, `getReliefMemoryMap` (`reliefRepo.ts`, Task 3); `ScannedReceipt` (`parseReceipt.ts`, existing); `commitCategorized`, `payCommitment` (`store.tsx`, existing)
- Produces: `applyReliefDetection(created: Transaction[], receipt: ScannedReceipt | null): Promise<void>` on the `useAppData()` context

This task has no new automated test: it is glue between already-tested pure functions (Task 2) and the existing, already-exercised save/pay flows. It is verified by the manual smoke steps below, which is this project's existing convention for store/UI wiring (see `__tests__/` list: no file tests `store.tsx`, `AddFlow.tsx`, or `commitmentsRepo.ts` directly).

- [ ] **Step 1: Import the new modules in `src/state/store.tsx`**

Add near the other `db/` and `lib/` imports (after the `commitmentsRepo` import block, which ends at line 88):

```ts
import { addReliefTag, getReliefMemoryMap } from '../db/reliefRepo';
import { matchRelief, yaForDate } from '../lib/relief';
import { scheduleForYA } from '../lib/reliefSchedule';
import type { ScannedReceipt } from '../lib/parseReceipt';
```

- [ ] **Step 2: Add `applyReliefDetection` to the context type**

In the `AppData` interface (or equivalent context type block), right after `commitCategorized`'s type declaration (ends at line 225 with `) => Promise<{ created: Transaction[]; newLearned: NewLearned[] }>;`):

```ts
  /** Silently tags each created transaction against the current YA's relief schedule, using
   *  line-item keywords first (when `receipt` is given) and remembered merchant mappings
   *  second. Writes nothing when nothing matches. Called once per save from AddFlow.tsx  no
   *  UI of its own, per the tax-relief-tagging spec's zero-footprint requirement. */
  applyReliefDetection: (created: Transaction[], receipt: ScannedReceipt | null) => Promise<void>;
```

- [ ] **Step 3: Implement `applyReliefDetection` in the provider body**

Add right after the `commitCategorized` `useCallback` definition (ends at line 742 with the closing `);` and its dependency array):

```ts
  const applyReliefDetection = useCallback(async (created: Transaction[], receipt: ScannedReceipt | null) => {
    if (created.length === 0) return;
    const reliefMemory = await getReliefMemoryMap();
    for (const txn of created) {
      if (!txn.date) continue;
      const ya = yaForDate(txn.date);
      const schedule = scheduleForYA(ya);
      if (!schedule) continue;
      // Line items only ever apply to the single-transaction receipt-scan path; a batch
      // (screenshot import) save always passes receipt: null from AddFlow.tsx.
      const singleItemReceipt = created.length === 1 ? receipt : null;
      const match = matchRelief(txn, singleItemReceipt, reliefMemory, schedule);
      if (!match) continue;
      await addReliefTag({ txnId: txn.id, code: match.code, ya, amount: match.amount, origin: 'auto' });
    }
  }, []);
```

- [ ] **Step 4: Add a `tagCommitmentRelief` helper and wire it into `payCommitment`**

Add right before the `payCommitment` `useCallback` (which starts around line 1230):

```ts
  const tagCommitmentRelief = useCallback(async (code: string, txnId: string, paidOn: string, amount: number) => {
    const ya = yaForDate(paidOn);
    if (!scheduleForYA(ya)) return;
    await addReliefTag({ txnId, code, ya, amount, origin: 'commitment' });
  }, []);
```

Inside `payCommitment`, after the first `dbMarkOccurrencePaid(...)` call (the "matched an existing transaction" branch, ends around line 1246 with `});`), before `await refreshCommitmentState();`:

```ts
      if (commitment.reliefCode) {
        await tagCommitmentRelief(commitment.reliefCode, match.id, paidOn, match.amount);
      }
```

After the second `dbMarkOccurrencePaid(...)` call (the "created a new transaction" branch, ends around line 1302 with `});`), before `setTransactions(await listTransactions());`:

```ts
      if (commitment.reliefCode) {
        await tagCommitmentRelief(commitment.reliefCode, txn.id, paidOn, paidAmount);
      }
```

Add `tagCommitmentRelief` to `payCommitment`'s dependency array (currently `[commitmentOccurrences, commitments, accounts, prices, resolveCommitmentMatch, recordBalanceLink, refreshCommitmentState]`).

- [ ] **Step 5: Add `applyReliefDetection` to the returned context object**

In the object the provider returns (the large literal ending around line 1470+), add right after `commitCategorized,` (around line 1411):

```ts
    applyReliefDetection,
```

- [ ] **Step 6: Call `applyReliefDetection` from `AddFlow.tsx`**

Add `applyReliefDetection` to the destructured `useAppData()` call at the top of `AddFlowPhases` (line 68):

```ts
  const { commitCategorized, recordBalanceLink, settleShare, accounts, memory, categories, catById, applyReliefDetection } = useAppData();
```

In `onCategorized` (line 192-230), right after the `commitCategorized` call:

```ts
    const { created, newLearned: learned } = await commitCategorized(items, assignments, 'extracted', splitDrafts);
    await applyReliefDetection(created, null);
```

In `onManualComplete` (line 232-245), right after its `commitCategorized` call:

```ts
    const { created, newLearned: learned } = await commitCategorized(
      [item],
      [categoryId],
      'manual',
      [split],
      [receiptResult?.photoUri ?? null]
    );
    await applyReliefDetection(created, cachedReceipt);
```

(`cachedReceipt` is the existing `ScannedReceipt | null` state already set by `onScanned={setCachedReceipt}` on `ReceiptScanScreen` in this same component, null for a pure manual entry.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 8: Run the full test suite**

Run: `npx jest -v`
Expected: PASS, no regressions (this task adds no new test file; it verifies nothing existing broke)

- [ ] **Step 9: Manual smoke check**

Run the app. Scan a receipt whose merchant you have not tagged before with a line item like "laptop" or "book" (or edit `matchKeywords` temporarily to match a test receipt) and save it. Confirm the save flow, `SavedScreen`, and payoff animation look and behave exactly as before, no new UI appears anywhere. Then separately, pay a commitment occurrence and confirm the same: no visible change. (Tag creation itself is verified visually once Task 6's Tax screen exists; for now this step only confirms the existing flows are untouched.)

- [ ] **Step 10: Commit**

```bash
git add src/state/store.tsx src/screens/AddFlow.tsx
git commit -m "feat(tax): wire silent relief auto-detection into save and commitment-payment flows"
```

---

### Task 5: Navigation plumbing (screenNav, App.tsx, Settings row)

**Files:**
- Modify: `src/lib/screenNav.ts`
- Modify: `App.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `__tests__/screenNav.test.ts`
- Create: `src/screens/TaxScreen.tsx` (minimal placeholder body, filled in by Task 6)

**Interfaces:**
- Produces: `'tax'` added to the `Screen` union and `backTargetFor`; `<TaxScreen onBack={...} />` mountable from `App.tsx`

- [ ] **Step 1: Write the failing screenNav test case**

In `__tests__/screenNav.test.ts`, extend the "flat screen" list (line 11) to include `'tax'`:

```ts
  it('sends every flat screen back to home', () => {
    const flat: Screen[] = ['add', 'settings', 'categories', 'transactions', 'commitments', 'budget', 'categoryDetail', 'recap', 'networth', 'breakdown'];
    for (const screen of flat) expect(backTargetFor(screen, origins)).toBe('home');
  });
```

Wait: `'tax'` should go back to `'settings'`, not `'home'`, so add a dedicated case instead of putting it in the flat list:

```ts
  it('returns tax to settings', () => {
    expect(backTargetFor('tax', origins)).toBe('settings');
  });
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest screenNav -v`
Expected: FAIL with a TypeScript error (`'tax'` not assignable to `Screen`) surfaced as a Jest failure, or a runtime `undefined` mismatch once `Screen` is widened but `backTargetFor` has no case yet

- [ ] **Step 3: Add `'tax'` to `src/lib/screenNav.ts`**

Add to the `Screen` union:

```ts
export type Screen =
  | 'home'
  | 'add'
  | 'settings'
  | 'categories'
  | 'transactions'
  | 'breakdown'
  | 'budget'
  | 'recap'
  | 'networth'
  | 'calendar'
  | 'advancedImport'
  | 'owed'
  | 'export'
  | 'commitments'
  | 'categoryDetail'
  | 'netWorthHistory'
  | 'tax';
```

Add a case in `backTargetFor`, alongside `advancedImport` and `netWorthHistory`:

```ts
    case 'tax':
      return 'settings';
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest screenNav -v`
Expected: PASS

- [ ] **Step 5: Create a minimal `src/screens/TaxScreen.tsx`**

A working placeholder that mounts and navigates, so this task is independently verifiable before Task 6 fills in the real content:

```tsx
// src/screens/TaxScreen.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../components/ui';
import { useThemeColors } from '../state/colorScheme';

export function TaxScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const colorTheme = useThemeColors();
  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg, paddingTop: insets.top }]}>
      <TopBar title="Tax relief" onBack={onBack} />
      <View style={styles.body}>
        <Text style={{ color: colorTheme.ink2 }}>Coming soon.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 6: Mount it from `App.tsx`**

Add the import alongside the other screen imports (near `ExportScreen`, `CommitmentsScreen`):

```ts
import { TaxScreen } from './src/screens/TaxScreen';
```

Add the render branch alongside the other simple `goBack`-only screens (near `{screen === 'commitments' && <CommitmentsScreen onBack={goBack} />}`):

```tsx
      {screen === 'tax' && <TaxScreen onBack={goBack} />}
```

- [ ] **Step 7: Add the Settings row**

In `src/screens/SettingsScreen.tsx`, add `onOpenTax` to the props type and destructuring (alongside `onOpenCommitments`):

```ts
export function SettingsScreen({ onBack, onAdvancedImport, onOpenExport, onOpenCategories, onOpenCommitments, onOpenTax, onResetToOnboarding }: { onBack: () => void; onAdvancedImport?: () => void; onOpenExport?: () => void; onOpenCategories?: () => void; onOpenCommitments?: () => void; onOpenTax?: () => void; onResetToOnboarding?: () => void }) {
```

Add the row in the "Data" section, right after the `onOpenCommitments` row (which ends around line 201 with the closing `)}`):

```tsx
        {onOpenTax && (
          <Pressable
            onPress={onOpenTax}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="receipt" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Tax relief</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}
```

(The count badge for requestable e-Invoices is added in Task 9, once the underlying data exists to compute it from.)

- [ ] **Step 8: Wire the prop through from `App.tsx`**

Find the existing `<SettingsScreen ... onOpenCommitments={() => setScreen('commitments')} />` call (around line 327-334) and add:

```tsx
          onOpenTax={() => setScreen('tax')}
```

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 10: Run the full test suite**

Run: `npx jest -v`
Expected: PASS

- [ ] **Step 11: Manual smoke check**

Run the app, open Settings, confirm the new "Tax relief" row appears with the receipt icon in the Data section, tap it, confirm it opens a "Tax relief" screen with a back button that returns to Settings (both the on-screen back arrow and the hardware/gesture back on Android).

- [ ] **Step 12: Commit**

```bash
git add src/lib/screenNav.ts App.tsx src/screens/SettingsScreen.tsx src/screens/TaxScreen.tsx __tests__/screenNav.test.ts
git commit -m "feat(tax): add Tax relief screen navigation and Settings entry point"
```

---

### Task 6: Tax screen shell (YA selector, relief line cards, empty states)

**Files:**
- Modify: `src/screens/TaxScreen.tsx`

**Interfaces:**
- Consumes: `computeUsage` (`relief.ts`, Task 2); `scheduleForYA`, `RELIEF_SCHEDULES` (`reliefSchedule.ts`, Task 1); `listReliefTags` (`reliefRepo.ts`, Task 3); `transactions` (`useAppData()`, existing)

This task has no automated test (screen-level UI, per this project's convention  see Global Constraints). Verified by the manual smoke steps.

- [ ] **Step 1: Replace the placeholder body with the real screen**

```tsx
// src/screens/TaxScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Body, Caption, Card, Eyebrow, ProgressTrack, TopBar } from '../components/ui';
import { computeUsage, type ReliefUsage } from '../lib/relief';
import { RELIEF_SCHEDULES, scheduleForYA, type ReliefLine } from '../lib/reliefSchedule';
import { listReliefTags } from '../db/reliefRepo';
import type { ReliefTag } from '../lib/types';
import { fmt } from '../lib/format';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { uiFont } from '../theme';

const AVAILABLE_YAS = Object.keys(RELIEF_SCHEDULES).map(Number).sort((a, b) => b - a);

export function TaxScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [ya, setYa] = useState(AVAILABLE_YAS[0]);
  const [tags, setTags] = useState<ReliefTag[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTags(null);
    listReliefTags(ya).then((t) => {
      if (!cancelled) setTags(t);
    });
    return () => {
      cancelled = true;
    };
  }, [ya]);

  const schedule = scheduleForYA(ya);
  const usage: ReliefUsage[] = useMemo(
    () => (schedule && tags ? computeUsage(tags, schedule) : []),
    [schedule, tags]
  );
  const usageByCode = useMemo(() => Object.fromEntries(usage.map((u) => [u.code, u])), [usage]);
  const totalClaimed = usage.filter((u) => !schedule?.lines.find((l) => l.code === u.code)?.parent)
    .reduce((s, u) => s + u.claimed, 0);

  const topLevelLines = schedule?.lines.filter((l) => !l.parent) ?? [];
  const childrenByParent = useMemo(() => {
    const map: Record<string, ReliefLine[]> = {};
    for (const line of schedule?.lines ?? []) {
      if (line.parent) (map[line.parent] ??= []).push(line);
    }
    return map;
  }, [schedule]);

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg, paddingTop: insets.top }]}>
      <TopBar title="Tax relief" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.yaRow}>
          {AVAILABLE_YAS.map((y) => (
            <Pressable
              key={y}
              onPress={() => setYa(y)}
              style={[
                styles.yaChip,
                { borderColor: colorTheme.line2 },
                y === ya && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
            >
              <Text style={[styles.yaChipText, { color: y === ya ? theme.onAccent : colorTheme.ink }]}>YA {y}</Text>
            </Pressable>
          ))}
        </View>

        <Caption color={colorTheme.ink2} style={{ marginTop: 10 }}>
          RM {fmt(totalClaimed)} claimed so far for YA {ya}
        </Caption>

        {tags === null && (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}

        {tags !== null && tags.length === 0 && (
          <View style={{ paddingTop: 50, alignItems: 'center', paddingHorizontal: 20 }}>
            <Body weight={700} color={colorTheme.ink} style={{ textAlign: 'center' }}>
              Nothing tagged yet
            </Body>
            <Caption color={colorTheme.ink2} style={{ textAlign: 'center', marginTop: 6 }}>
              Scan a receipt or map a bill to get started. Pip tags relief-eligible spending
              automatically as you go.
            </Caption>
          </View>
        )}

        {tags !== null && topLevelLines.map((line) => {
          const u = usageByCode[line.code];
          if (!u) return null;
          const children = childrenByParent[line.code] ?? [];
          const pct = u.cap > 0 ? Math.min(100, (u.capUsed / u.cap) * 100) : 0;
          return (
            <Card key={line.code} style={{ padding: 16, marginTop: 12 }}>
              <View style={styles.lineHead}>
                <Body weight={700} color={colorTheme.ink}>{line.label}</Body>
                <Caption color={colorTheme.ink2}>{line.formField}</Caption>
              </View>
              <Caption color={colorTheme.ink2} style={{ marginTop: 2 }}>
                RM {fmt(u.capUsed)} / RM {fmt(u.cap)}
              </Caption>
              <ProgressTrack pct={pct} />
              {children.map((child) => {
                const cu = usageByCode[child.code];
                if (!cu) return null;
                return (
                  <View key={child.code} style={styles.childRow}>
                    <Caption color={colorTheme.ink2}>{child.label}</Caption>
                    <Caption color={colorTheme.ink2}>RM {fmt(cu.capUsed)} / RM {fmt(cu.cap)}</Caption>
                  </View>
                );
              })}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  yaRow: { flexDirection: 'row', gap: 8 },
  yaChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  yaChipText: { fontFamily: uiFont(700), fontSize: 13 },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginTop: 8 },
});
```

- [ ] **Step 2: Confirm `theme.onAccent` exists, or use the closest existing equivalent**

Check `src/state/accent.tsx` (or wherever `useAccent()` is defined) for the exact token name used for "text color on top of the accent fill" (`SavedScreen.tsx` used `theme.onTint` for the accent-tinted card; the Settings provider badge used `theme.accent` for an icon on a light tint, not a filled chip). Search:

Run: `grep -n "onAccent\|onTint\|accentInk" src/state/accent.tsx`

Use whichever token the search turns up for "readable text on a solid accent fill" in the selected YA chip; if none exists, fall back to a hardcoded `'#fff'` for that one spot, matching how other solid-accent-fill buttons in this codebase handle it (check `PrimaryButton` in `src/components/ui.tsx` for precedent).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors (fix the token from Step 2 if it doesn't typecheck)

- [ ] **Step 4: Manual smoke check**

Run the app, open Settings → Tax relief. Confirm: the YA chip row renders and switching YA re-fetches; with no tags yet, the empty state shows; each top-level relief card (Lifestyle, Sports, Medical, Insurance premium, SSPN, Child care) renders with RM 0 / cap and a full progress track at 0%; Medical's four sub-lines render nested underneath it. Then go back and scan a receipt with a line item that matches a keyword (e.g. type "book" as a manual entry merchant/remark, or scan a real receipt containing one of `lifestyle`'s keywords), save it, return to the Tax screen, and confirm the Lifestyle card now shows a nonzero claimed amount.

- [ ] **Step 5: Commit**

```bash
git add src/screens/TaxScreen.tsx
git commit -m "feat(tax): build Tax screen shell with YA selector and relief line cards"
```

---

### Task 7: Tag detail edit sheet

**Files:**
- Create: `src/components/ReliefTagEditSheet.tsx`
- Modify: `src/screens/TaxScreen.tsx`

**Interfaces:**
- Consumes: `ReliefTag`, `Transaction` (`types.ts`); `evidenceState` (`relief.ts`, Task 2); `ReliefLine`, `ReliefSchedule` (`reliefSchedule.ts`, Task 1); `updateReliefTag`, `deleteReliefTag` (`reliefRepo.ts`, Task 3); `saveReceiptImage` (`receiptStorage.ts`, existing); `confirmAction` (`platformAlert.ts`, existing)
- Produces: `<ReliefTagEditSheet tag={...} txn={...} schedule={...} onClose={...} onChanged={...} />`

- [ ] **Step 1: Create `src/components/ReliefTagEditSheet.tsx`**

Modeled on the existing bottom-sheet pattern in `EditTransactionModal.tsx` (Modal + backdrop Pressable + `KeyboardAvoidingView` with the Android-safe `behavior` prop fixed in a recent commit  do not reintroduce that bug by using a different pattern):

```tsx
// src/components/ReliefTagEditSheet.tsx
import React, { useEffect, useState } from 'react';
import { Image as RNImage, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { BtnLabel, Caption, PrimaryButton } from './ui';
import { deleteReliefTag, updateReliefTag } from '../db/reliefRepo';
import { evidenceState } from '../lib/relief';
import type { ReliefSchedule } from '../lib/reliefSchedule';
import type { ReliefTag, Transaction } from '../lib/types';
import { confirmAction, notify } from '../lib/platformAlert';
import { saveReceiptImage } from '../lib/receiptStorage';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';

const EVIDENCE_LABEL: Record<string, string> = {
  complete: 'Complete',
  'missing-cert': 'Needs certification',
  'no-image': 'No photo',
  'weak-unnamed': 'Weak: no name',
};

export function ReliefTagEditSheet({
  tag,
  txn,
  schedule,
  onClose,
  onChanged,
}: {
  tag: ReliefTag | null;
  txn: Transaction | null;
  schedule: ReliefSchedule;
  onClose: () => void;
  onChanged: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [code, setCode] = useState('');
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tag) {
      setCode(tag.code);
      setAmountText(tag.amount.toFixed(2));
    }
  }, [tag?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tag || !txn) return <Modal visible={false} transparent />;

  const line = schedule.lines.find((l) => l.code === code) ?? schedule.lines.find((l) => l.code === tag.code)!;
  const evidence = evidenceState(tag, txn, line);

  const save = async () => {
    const n = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    const amount = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : tag.amount;
    await updateReliefTag(tag.id, { code, amount });
    onChanged();
    onClose();
  };

  const attachPhoto = async (field: 'certImageUri' | 'einvoiceImageUri') => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow photo access to attach this.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const uri = saveReceiptImage(asset.uri, asset.mimeType ?? 'image/jpeg');
      await updateReliefTag(tag.id, { [field]: uri });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    confirmAction('Remove this tag?', 'This only removes the relief tag, not the transaction itself.', 'Remove', async () => {
      await deleteReliefTag(tag.id);
      onChanged();
      onClose();
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}
      >
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: colorTheme.ink }]} numberOfLines={1}>
            {txn.merchantRaw || line.label}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="x" size={20} color={colorTheme.ink2} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Caption color={colorTheme.ink2}>Relief line</Caption>
          <View style={styles.lineList}>
            {schedule.lines.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => setCode(l.code)}
                style={[
                  styles.lineOption,
                  { borderColor: colorTheme.line2 },
                  l.code === code && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft },
                ]}
              >
                <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13.5 }}>{l.label}</Text>
              </Pressable>
            ))}
          </View>

          <Caption color={colorTheme.ink2} style={{ marginTop: 16 }}>Claimed amount (RM)</Caption>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            style={[styles.input, { color: colorTheme.ink, borderColor: colorTheme.line2 }]}
          />

          <View style={[styles.evidenceRow, { borderColor: colorTheme.line2 }]}>
            <Icon name={evidence === 'complete' ? 'check' : 'alert'} size={16} color={evidence === 'complete' ? theme.accent : colorTheme.ink2} />
            <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13 }}>{EVIDENCE_LABEL[evidence]}</Text>
          </View>

          {line.requiresCert && (
            <Pressable disabled={busy} onPress={() => attachPhoto('certImageUri')} style={[styles.attachRow, { borderColor: colorTheme.line2 }]}>
              <Icon name="upload" size={16} color={colorTheme.ink2} />
              <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13 }}>
                {tag.certImageUri ? 'Replace certification photo' : 'Attach certification photo'}
              </Text>
            </Pressable>
          )}
          {tag.certImageUri && <RNImage source={{ uri: tag.certImageUri }} style={styles.thumb} />}

          <Pressable disabled={busy} onPress={() => attachPhoto('einvoiceImageUri')} style={[styles.attachRow, { borderColor: colorTheme.line2 }]}>
            <Icon name="upload" size={16} color={colorTheme.ink2} />
            <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13 }}>
              {tag.einvoiceImageUri ? 'Replace e-Invoice photo' : 'Attach e-Invoice photo'}
            </Text>
          </Pressable>
          {tag.einvoiceImageUri && <RNImage source={{ uri: tag.einvoiceImageUri }} style={styles.thumb} />}

          <Pressable onPress={remove} style={{ marginTop: 18, alignSelf: 'center' }} hitSlop={8}>
            <Text style={{ color: '#b3261e', fontFamily: uiFont(600), fontSize: 13 }}>Remove tag</Text>
          </Pressable>
        </ScrollView>

        <PrimaryButton onPress={save} style={{ marginTop: 14 }}>
          <BtnLabel>Save</BtnLabel>
        </PrimaryButton>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: uiFont(700), fontSize: 17, flex: 1, marginRight: 10 },
  lineList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  lineOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 11, fontFamily: uiFont(600), fontSize: 15, marginTop: 6 },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, borderWidth: 1, borderRadius: radius.sm, padding: 12 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderWidth: 1, borderRadius: radius.sm, padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, marginTop: 8 },
});
```

- [ ] **Step 2: Wire it into `TaxScreen.tsx`**

Add state and make each tagged transaction row (rendered inside each relief card from Task 6) tappable. Add to the top of `TaxScreen`, alongside the existing `ya`/`tags` state:

```ts
  const { transactions } = useAppData();
  const [editingTag, setEditingTag] = useState<ReliefTag | null>(null);
```

Add the `useAppData` import: `import { useAppData } from '../state/store';`

Extend each relief card (both top-level and nested child rows built in Task 6) to list its tagged transactions and open the sheet on tap. Replace the child-row `<View key={child.code} ...>` block with a `Pressable`-wrapped list of that line's tags:

```tsx
              {children.map((child) => {
                const cu = usageByCode[child.code];
                if (!cu) return null;
                const childTags = (tags ?? []).filter((t) => t.code === child.code);
                return (
                  <View key={child.code} style={styles.childBlock}>
                    <View style={styles.childRow}>
                      <Caption color={colorTheme.ink2}>{child.label}</Caption>
                      <Caption color={colorTheme.ink2}>RM {fmt(cu.capUsed)} / RM {fmt(cu.cap)}</Caption>
                    </View>
                    {childTags.map((t) => {
                      const txn = transactions.find((x) => x.id === t.txnId);
                      if (!txn) return null;
                      return (
                        <Pressable key={t.id} onPress={() => setEditingTag(t)} style={styles.tagRow}>
                          <Caption color={colorTheme.ink}>{txn.merchantRaw || 'Transaction'}</Caption>
                          <Caption color={colorTheme.ink2}>RM {fmt(t.amount)}</Caption>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
```

Do the same for top-level lines with no children (the `children.length === 0` case implied by rendering their own tags directly under the card): add a matching `tags.filter(t => t.code === line.code).map(...)` block right after the `<ProgressTrack pct={pct} />` line, using the same `tagRow` pattern.

Add `tagRow` and `childBlock` to the `StyleSheet`:

```ts
  childBlock: { marginTop: 8 },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, paddingVertical: 4 },
```

Render the sheet at the bottom of `TaxScreen`'s return, after the `</ScrollView>`:

```tsx
      {schedule && (
        <ReliefTagEditSheet
          tag={editingTag}
          txn={editingTag ? transactions.find((t) => t.id === editingTag.txnId) ?? null : null}
          schedule={schedule}
          onClose={() => setEditingTag(null)}
          onChanged={() => listReliefTags(ya).then(setTags)}
        />
      )}
```

Add the import: `import { ReliefTagEditSheet } from '../components/ReliefTagEditSheet';`

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 4: Manual smoke check**

Run the app, open Tax relief with at least one tagged transaction present (from Task 6's smoke test). Tap a tagged transaction row, confirm the sheet opens with the correct merchant name, relief line, and amount pre-filled. Change the amount, save, confirm the card's totals update. Reopen, attach a photo (library picker), confirm a thumbnail appears and the evidence chip updates from "No photo"/"Weak: no name" toward "Complete" as expected per `evidenceState`'s rules. Remove a tag, confirm it disappears from the card and the totals adjust.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReliefTagEditSheet.tsx src/screens/TaxScreen.tsx
git commit -m "feat(tax): add relief tag detail edit sheet with evidence photo attachment"
```

---

### Task 8: "Map a commitment" and "Add manually" flows

**Files:**
- Create: `src/components/MapCommitmentSheet.tsx`
- Modify: `src/screens/TaxScreen.tsx`

**Interfaces:**
- Consumes: `commitments`, `updateCommitmentEntry`, `transactions` (`useAppData()`, existing + Task 3's widened patch type); `ReliefSchedule` (`reliefSchedule.ts`)

- [ ] **Step 1: Create `src/components/MapCommitmentSheet.tsx`**

A simpler sheet than Task 7's, following the same Modal/backdrop/KeyboardAvoidingView shape:

```tsx
// src/components/MapCommitmentSheet.tsx
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Caption } from './ui';
import type { Commitment } from '../lib/commitments';
import type { ReliefSchedule } from '../lib/reliefSchedule';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';

export function MapCommitmentSheet({
  visible,
  commitments,
  schedule,
  onPick,
  onClose,
}: {
  visible: boolean;
  commitments: Commitment[];
  schedule: ReliefSchedule;
  onPick: (commitmentId: string, code: string | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const eligibleLines = schedule.lines.filter((l) => l.commitmentEligible);

  if (!visible) return <Modal visible={false} transparent />;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <Text style={[styles.title, { color: colorTheme.ink }]}>Map a commitment</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {commitments.length === 0 && (
            <Caption color={colorTheme.ink2}>No recurring bills yet. Add one from Settings first.</Caption>
          )}
          {commitments.map((c) => (
            <View key={c.id} style={[styles.commitmentBlock, { borderColor: colorTheme.line2 }]}>
              <Text style={{ color: colorTheme.ink, fontFamily: uiFont(700), fontSize: 14 }}>{c.label}</Text>
              <View style={styles.lineList}>
                <Pressable
                  onPress={() => onPick(c.id, null)}
                  style={[styles.lineOption, { borderColor: colorTheme.line2 }, !c.reliefCode && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}
                >
                  <Text style={{ color: colorTheme.ink2, fontFamily: uiFont(600), fontSize: 12.5 }}>Not relief-eligible</Text>
                </Pressable>
                {eligibleLines.map((l) => (
                  <Pressable
                    key={l.code}
                    onPress={() => onPick(c.id, l.code)}
                    style={[styles.lineOption, { borderColor: colorTheme.line2 }, c.reliefCode === l.code && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}
                  >
                    <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 12.5 }}>{l.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={styles.closeRow} hitSlop={8}>
          <Icon name="check" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontFamily: uiFont(700), fontSize: 14 }}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: uiFont(700), fontSize: 17, marginBottom: 14 },
  commitmentBlock: { borderTopWidth: 1, paddingVertical: 12 },
  lineList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  lineOption: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1 },
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 14 },
});
```

- [ ] **Step 2: Wire "Map a commitment" into `TaxScreen.tsx`**

Add state and destructure `commitments`/`updateCommitmentEntry` from `useAppData()` (extend the existing `const { transactions } = useAppData();` from Task 7 to `const { transactions, commitments, updateCommitmentEntry } = useAppData();`):

```ts
  const [mappingCommitments, setMappingCommitments] = useState(false);
```

Add a footer button before the closing `</ScrollView>` in `TaxScreen`'s render (or as a fixed action row above the scroll content, next to the YA chips):

```tsx
        <Pressable onPress={() => setMappingCommitments(true)} style={[styles.actionRow, { borderColor: colorTheme.line2 }]}>
          <Icon name="clock" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontFamily: uiFont(700), fontSize: 13.5 }}>Map a commitment</Text>
        </Pressable>
```

Add the `actionRow` style:

```ts
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14, alignSelf: 'flex-start' },
```

Render the sheet after `ReliefTagEditSheet` (only mount it when there's a schedule, matching the same guard):

```tsx
      {schedule && (
        <MapCommitmentSheet
          visible={mappingCommitments}
          commitments={commitments}
          schedule={schedule}
          onPick={(id, code) => updateCommitmentEntry(id, { reliefCode: code })}
          onClose={() => setMappingCommitments(false)}
        />
      )}
```

Add the import: `import { MapCommitmentSheet } from '../components/MapCommitmentSheet';` and `import { Icon } from '../components/Icon';` if not already present from Task 6.

- [ ] **Step 3: Add "Add manually" search**

Add state:

```ts
  const [addingManually, setAddingManually] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
```

Add a second action button next to "Map a commitment" (same `actionRow` style, in a row together):

```tsx
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => setMappingCommitments(true)} style={[styles.actionRow, { borderColor: colorTheme.line2, marginTop: 0 }]}>
            <Icon name="clock" size={16} color={theme.accent} />
            <Text style={{ color: theme.accent, fontFamily: uiFont(700), fontSize: 13.5 }}>Map a commitment</Text>
          </Pressable>
          <Pressable onPress={() => setAddingManually(true)} style={[styles.actionRow, { borderColor: colorTheme.line2, marginTop: 0 }]}>
            <Icon name="search" size={16} color={theme.accent} />
            <Text style={{ color: theme.accent, fontFamily: uiFont(700), fontSize: 13.5 }}>Add manually</Text>
          </Pressable>
        </View>
```

(Replace the single "Map a commitment" `Pressable` added in Step 2 with this two-button row.)

Add a lightweight inline search list, rendered as its own block when `addingManually` is true (simpler than a separate sheet component since it only needs a text input and a filtered list  reuses `AllTransactionsScreen.tsx`'s `styles.searchRow`/`styles.searchInput` naming convention, defined locally here since it isn't exported from that screen):

```tsx
        {addingManually && (
          <Card style={{ padding: 14, marginTop: 14 }}>
            <View style={[styles.searchRow, { borderColor: colorTheme.line2 }]}>
              <Icon name="search" size={15} color={colorTheme.ink3} />
              <TextInput
                value={manualSearch}
                onChangeText={setManualSearch}
                placeholder="Search transactions"
                placeholderTextColor={colorTheme.ink3}
                style={[styles.searchInput, { color: colorTheme.ink }]}
              />
              <Pressable onPress={() => setAddingManually(false)} hitSlop={8}>
                <Icon name="x" size={16} color={colorTheme.ink3} />
              </Pressable>
            </View>
            {manualSearch.trim().length > 0 &&
              transactions
                .filter((t) => t.merchantRaw.toLowerCase().includes(manualSearch.trim().toLowerCase()))
                .slice(0, 15)
                .map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={async () => {
                      if (!schedule) return;
                      const created = await addReliefTag({ txnId: t.id, code: schedule.lines[0].code, ya, amount: t.amount, origin: 'manual' });
                      setTags((prev) => [...(prev ?? []), created]);
                      setEditingTag(created);
                      setAddingManually(false);
                      setManualSearch('');
                    }}
                    style={styles.manualRow}
                  >
                    <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13.5 }} numberOfLines={1}>
                      {t.merchantRaw}
                    </Text>
                    <Caption color={colorTheme.ink2}>RM {fmt(t.amount)}</Caption>
                  </Pressable>
                ))}
          </Card>
        )}
```

Add the required imports at the top of `TaxScreen.tsx`: `TextInput` from `react-native`; `addReliefTag` from `../db/reliefRepo` (alongside the existing `listReliefTags` import).

Add the two new styles:

```ts
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontFamily: uiFont(600), fontSize: 13.5, paddingVertical: 2 },
  manualRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'transparent' },
```

Add `import { radius, uiFont } from '../theme';` if `radius` isn't already imported (only `uiFont` was imported in Task 6's version).

This opens the new tag straight into `ReliefTagEditSheet` (via `setEditingTag(created)`) so the user immediately picks the right line rather than living with `schedule.lines[0]`'s placeholder default.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 5: Manual smoke check**

Run the app. In Tax relief, tap "Map a commitment", confirm existing commitments list with their relief-line options, pick one, confirm it highlights. Pay that commitment's next occurrence (from the Commitments screen) and confirm a new tag appears under the mapped relief line back in Tax relief, with `origin: 'commitment'` (visible indirectly by it appearing at full amount, immediately). Then tap "Add manually", search for an existing transaction, tap it, confirm the edit sheet opens for the newly created tag and saving it shows up under the chosen line.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapCommitmentSheet.tsx src/screens/TaxScreen.tsx
git commit -m "feat(tax): add map-a-commitment and add-manually flows to Tax screen"
```

---

### Task 9: "Requestable this month" section and the Settings badge

**Files:**
- Modify: `src/screens/TaxScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `isRequestable`, `evidenceState` (`relief.ts`, Task 2)

- [ ] **Step 1: Compute the requestable list in `TaxScreen.tsx`**

Add, alongside the existing `usage`/`usageByCode` memos:

```ts
  const requestable = useMemo(() => {
    if (!schedule || !tags) return [];
    const today = new Date();
    const result: { tag: ReliefTag; txn: Transaction; line: ReliefLine }[] = [];
    for (const t of tags) {
      const line = schedule.lines.find((l) => l.code === t.code);
      const txn = transactions.find((x) => x.id === t.txnId);
      if (!line || !txn) continue;
      const evidence = evidenceState(t, txn, line);
      if (isRequestable(evidence, txn, today)) result.push({ tag: t, txn, line });
    }
    return result;
  }, [schedule, tags, transactions]);
```

Add the imports: `isRequestable` alongside the existing `evidenceState`... wait, `evidenceState` was not yet imported in `TaxScreen.tsx` (only `computeUsage` was, in Task 6). Add both: `import { computeUsage, evidenceState, isRequestable, type ReliefUsage } from '../lib/relief';` (replacing Task 6's narrower import), and `import type { Transaction } from '../lib/types';` if not already present.

- [ ] **Step 2: Render the section**

Add right after the empty-state block and before the relief line cards in the render:

```tsx
        {requestable.length > 0 && (
          <View style={{ marginTop: tags && tags.length > 0 ? 16 : 0 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Requestable this month</Eyebrow>
            {requestable.map(({ tag, txn, line }) => {
              const daysLeft = daysUntilMonthEnd(txn.date!);
              return (
                <Pressable key={tag.id} onPress={() => setEditingTag(tag)} style={[styles.requestableRow, { borderColor: colorTheme.line2 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13.5 }} numberOfLines={1}>
                      {txn.merchantRaw || line.label}
                    </Text>
                    <Caption color={colorTheme.ink2}>{line.label}</Caption>
                  </View>
                  <Caption color={theme.accent}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</Caption>
                </Pressable>
              );
            })}
          </View>
        )}
```

Add the `daysUntilMonthEnd` pure helper near the top of the file, above the component:

```ts
function daysUntilMonthEnd(txnDate: string): number {
  const [y, m] = txnDate.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const today = new Date();
  return Math.max(0, lastDay - today.getDate());
}
```

Add the `requestableRow` style:

```ts
  requestableRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, padding: 12, marginTop: 8, gap: 10 },
```

- [ ] **Step 3: Add the count badge to the Settings row**

In `SettingsScreen.tsx`, the "Tax relief" row (added in Task 5) needs a `requestableCount` prop. Add it to the props type:

```ts
export function SettingsScreen({ onBack, onAdvancedImport, onOpenExport, onOpenCategories, onOpenCommitments, onOpenTax, onResetToOnboarding, taxRequestableCount = 0 }: { onBack: () => void; onAdvancedImport?: () => void; onOpenExport?: () => void; onOpenCategories?: () => void; onOpenCommitments?: () => void; onOpenTax?: () => void; onResetToOnboarding?: () => void; taxRequestableCount?: number }) {
```

Update the row to include the badge, right before the trailing chevron icon:

```tsx
        {onOpenTax && (
          <Pressable
            onPress={onOpenTax}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="receipt" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Tax relief</Text>
            </View>
            {taxRequestableCount > 0 && (
              <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
                <Text style={styles.countBadgeText}>{taxRequestableCount}</Text>
              </View>
            )}
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}
```

Add the badge styles to `SettingsScreen.tsx`'s `StyleSheet`:

```ts
  countBadge: { minWidth: 20, height: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 8 },
  countBadgeText: { color: '#fff', fontFamily: uiFont(700), fontSize: 11 },
```

- [ ] **Step 4: Compute and pass the count from `App.tsx`**

This requires the current-YA requestable count at the `App.tsx` level, outside `TaxScreen`. Rather than duplicating the `computeUsage`/`isRequestable` loop in two places, add one small store-level helper instead: back in `src/state/store.tsx` (Task 4's territory), add a memoized `taxRequestableCount: number` to the context, computed from `transactions` plus a lazily-loaded current-YA tag list.

Add state near the other `useState` declarations in the provider:

```ts
  const [reliefTags, setReliefTags] = useState<ReliefTag[]>([]);
```

Add a load-on-mount effect near the other boot-time effects (alongside wherever `refreshAll`/initial data loading happens):

```ts
  useEffect(() => {
    listReliefTags(yaForDate(new Date().toISOString().slice(0, 10))).then(setReliefTags);
  }, []);
```

Add the import `import { listReliefTags } from '../db/reliefRepo';` (extending Task 4's existing `reliefRepo` import line) and `import type { ReliefTag } from '../lib/types';` if not already present via another import.

Add the memo, near `coverage` or another derived-value memo:

```ts
  const taxRequestableCount = useMemo(() => {
    const today = new Date();
    const ya = yaForDate(today.toISOString().slice(0, 10));
    const schedule = scheduleForYA(ya);
    if (!schedule) return 0;
    let count = 0;
    for (const t of reliefTags) {
      const line = schedule.lines.find((l) => l.code === t.code);
      const txn = transactions.find((x) => x.id === t.txnId);
      if (!line || !txn) continue;
      if (isRequestable(evidenceState(t, txn, line), txn, today)) count++;
    }
    return count;
  }, [reliefTags, transactions]);
```

Add `evidenceState`, `isRequestable` to the existing `import { matchRelief, yaForDate } from '../lib/relief';` line from Task 4, making it `import { evidenceState, isRequestable, matchRelief, yaForDate } from '../lib/relief';`.

Expose it: add `taxRequestableCount: number;` to the context type (near `coverage: Coverage;`) and `taxRequestableCount,` to the returned object (near `coverage,`).

**Note:** this `reliefTags` state is a lightweight, App.tsx-level badge count only, refreshed on boot; it is intentionally not kept in sync with every tag mutation made inside `TaxScreen.tsx` (which manages its own `tags` state per Task 6, reloaded via `listReliefTags(ya)` after every change there). A stale badge count between visits to the Tax screen is an acceptable trade-off for not threading a global refresh callback through Tasks 6-8's local sheets purely for a settings-row number; it fully corrects itself the next time the app is opened, and immediately upon leaving and re-entering Settings if the state update below is wired.

To get an immediate refresh instead of only on next app boot, re-run the same load whenever `screen` changes back to `'settings'` from `'tax'` in `App.tsx`: skip this refinement for v1 (documented above as an accepted trade-off, consistent with the spec's "computed fresh, no background job" approach elsewhere in this feature).

In `App.tsx`, destructure `taxRequestableCount` from `useAppData()` wherever the other context values are pulled for the `SettingsScreen` render, and pass it through:

```tsx
          onOpenTax={() => setScreen('tax')}
          taxRequestableCount={taxRequestableCount}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 6: Run the full test suite**

Run: `npx jest -v`
Expected: PASS

- [ ] **Step 7: Manual smoke check**

Run the app. Scan/save a receipt dated today matching a discretionary relief line (e.g. lifestyle), with no e-Invoice photo attached, so it lands as `weak-unnamed` and within the current month. Confirm: the Settings "Tax relief" row shows a count badge; opening Tax relief shows a "Requestable this month" section listing it with a "days left" caption; tapping the row opens the same edit sheet as Task 7. Attach an e-Invoice photo to it and confirm it drops out of the requestable list and the badge count decrements after reopening Settings.

- [ ] **Step 8: Commit**

```bash
git add src/screens/TaxScreen.tsx src/screens/SettingsScreen.tsx App.tsx src/state/store.tsx
git commit -m "feat(tax): add requestable-this-month section and Settings badge count"
```

---

### Task 10: Audit pack PDF export

**Files:**
- Modify: `package.json` (add `pdf-lib`)
- Create: `src/lib/taxExport.ts`
- Modify: `src/screens/TaxScreen.tsx`

**Interfaces:**
- Consumes: `ReliefTag`, `Transaction` (`types.ts`); `ReliefSchedule` (`reliefSchedule.ts`); `computeUsage` (`relief.ts`); `saveOrDownloadExport` (`financialExport.ts`, existing)
- Produces: `buildAuditPackPdf(ya, schedule, tags, transactions): Promise<Uint8Array>`

- [ ] **Step 1: Add the dependency**

Run: `npm install pdf-lib`
Expected: adds `pdf-lib` to `package.json` dependencies and updates `package-lock.json`

- [ ] **Step 2: Create `src/lib/taxExport.ts`**

```ts
// src/lib/taxExport.ts
// Builds the per-YA audit pack: a real PDF (not an HTML-print stand-in, unlike the general
// financial export) bundling every tagged transaction's evidence images plus a summary table
// keyed by Form BE line. pdf-lib is pure JS  no native module, works the same on web and
// native via the app's existing saveOrDownloadExport (financialExport.ts:1372).
import { File } from 'expo-file-system';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { computeUsage } from './relief';
import type { ReliefSchedule } from './reliefSchedule';
import type { ReliefTag, Transaction } from './types';

function readImageBytes(uri: string): Uint8Array | null {
  try {
    const file = new File(uri);
    if (!file.exists) return null;
    return file.bytesSync();
  } catch {
    return null;
  }
}

async function embedImage(doc: PDFDocument, uri: string) {
  const bytes = readImageBytes(uri);
  if (!bytes) return null;
  try {
    return uri.toLowerCase().endsWith('.png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function buildAuditPackPdf(
  ya: number,
  schedule: ReliefSchedule,
  tags: ReliefTag[],
  transactions: Transaction[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const usage = computeUsage(tags, schedule);
  const usageByCode = Object.fromEntries(usage.map((u) => [u.code, u]));

  // --- Summary page ---------------------------------------------------------------------
  const summary = doc.addPage([595, 842]); // A4
  let y = 800;
  summary.drawText(`Tax relief audit pack: YA ${ya}`, { x: 40, y, size: 16, font: bold });
  y -= 30;
  for (const line of schedule.lines) {
    const u = usageByCode[line.code];
    if (!u) continue;
    const prefix = line.parent ? '  ' : '';
    summary.drawText(
      `${prefix}${line.formField}  ${line.label}: RM ${u.capUsed.toFixed(2)} / RM ${u.cap.toFixed(2)}`,
      { x: 40, y, size: 10, font }
    );
    y -= 16;
    if (y < 60) break; // summary is a short table by design; overflow is not expected for v1's line count
  }

  // --- One block per tagged transaction --------------------------------------------------
  for (const tag of tags) {
    const txn = transactions.find((t) => t.id === tag.txnId);
    const line = schedule.lines.find((l) => l.code === tag.code);
    if (!txn || !line) continue;

    const page = doc.addPage([595, 842]);
    let py = 800;
    page.drawText(`${txn.merchantRaw || line.label}`, { x: 40, y: py, size: 14, font: bold });
    py -= 20;
    page.drawText(`${line.formField}  ${line.label}`, { x: 40, y: py, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    py -= 16;
    page.drawText(`Date: ${txn.date ?? 'unknown'}    Amount claimed: RM ${tag.amount.toFixed(2)}`, { x: 40, y: py, size: 11, font });
    py -= 24;

    const images: { label: string; uri: string }[] = [];
    if (txn.receiptUri) images.push({ label: 'Receipt', uri: txn.receiptUri });
    if (tag.certImageUri) images.push({ label: 'Certification', uri: tag.certImageUri });
    if (tag.einvoiceImageUri) images.push({ label: 'e-Invoice', uri: tag.einvoiceImageUri });

    for (const img of images) {
      const embedded = await embedImage(doc, img.uri);
      page.drawText(img.label, { x: 40, y: py, size: 10, font: bold });
      py -= 14;
      if (!embedded) {
        page.drawText('(image unavailable)', { x: 40, y: py, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
        py -= 20;
        continue;
      }
      const maxWidth = 300;
      const scale = Math.min(1, maxWidth / embedded.width);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      if (py - h < 40) break; // this v1 pack shows the first images that fit one page per txn
      page.drawImage(embedded, { x: 40, y: py - h, width: w, height: h });
      py -= h + 20;
    }
  }

  return doc.save();
}
```

- [ ] **Step 3: Wire the export button into `TaxScreen.tsx`**

Add state:

```ts
  const [exporting, setExporting] = useState(false);
```

Add the footer button, at the end of the `ScrollView`'s content (after everything from Tasks 6-9):

```tsx
        <Pressable
          disabled={exporting || !schedule || !tags || tags.length === 0}
          onPress={async () => {
            if (!schedule || !tags) return;
            setExporting(true);
            try {
              const bytes = await buildAuditPackPdf(ya, schedule, tags, transactions);
              const result = await saveOrDownloadExport(`tax-relief-audit-pack-${ya}.pdf`, bytes, 'application/pdf');
              if (!result.success) notify('Export failed', result.error ?? 'Could not build the audit pack.');
            } finally {
              setExporting(false);
            }
          }}
          style={[styles.exportButton, { backgroundColor: theme.accent, opacity: exporting || !tags?.length ? 0.5 : 1 }]}
        >
          <Icon name="download" size={16} color={theme.onAccent ?? '#fff'} />
          <Text style={{ color: theme.onAccent ?? '#fff', fontFamily: uiFont(700), fontSize: 14 }}>
            {exporting ? 'Building...' : 'Export audit pack'}
          </Text>
        </Pressable>
```

Add the imports: `import { buildAuditPackPdf } from '../lib/taxExport';`, `import { saveOrDownloadExport } from '../lib/financialExport';`, `import { notify } from '../lib/platformAlert';`.

Add the style:

```ts
  exportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 14, marginTop: 22 },
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 5: Run the full test suite**

Run: `npx jest -v`
Expected: PASS (no new tests added in this task; `pdf-lib`'s own image/font embedding is exercised manually, matching this project's existing convention that binary export libraries like `xlsx` in `financialExport.ts` aren't unit-tested either  see `financialExport.test.ts`, which tests the CSV/JSON string builders, not the `xlsx` binary path)

- [ ] **Step 6: Manual smoke check**

Run the app on both web and a native simulator/device if available. In Tax relief with at least one tagged, evidenced transaction, tap "Export audit pack". Confirm: on web, a `tax-relief-audit-pack-2025.pdf` downloads; on native, the file saves and (if a share sheet is wired by the OS picker used elsewhere in the app) can be opened. Open the resulting PDF and confirm: page 1 is the summary table with correct RM figures matching the Tax screen; each following page shows one transaction's merchant/date/amount and its receipt image (and cert/e-Invoice images where attached) actually rendered, not blank.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/taxExport.ts src/screens/TaxScreen.tsx
git commit -m "feat(tax): add audit pack PDF export via pdf-lib"
```

---

### Task 11: Final integration pass

**Files:** none new  verification only.

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 2: Full test suite**

Run: `npx jest -v`
Expected: all suites pass, including the new `reliefSchedule.test.ts` and `relief.test.ts` and the modified `commitments.test.ts`, `financialExport.test.ts`, `screenNav.test.ts`

- [ ] **Step 3: Spec coverage check**

Walk `docs/superpowers/specs/2026-08-23-tax-relief-tagging-design.md` section by section and confirm each is implemented:
- §1 Data model: Tasks 1, 3
- §2 Relief schedule: Task 1
- §3 Cap/aggregate engine: Task 2
- §4 Detection + wiring: Tasks 2, 4
- §5 Evidence state: Task 2
- §6 e-Invoice gap tracking: Tasks 2, 9
- §7 Tax screen (nav, layout, empty states, memory-strengthening): Tasks 5, 6, 7, 8, 9
- §8 Audit pack export: Task 10
- §9 Testing: Tasks 1, 2, 5

- [ ] **Step 4: End-to-end manual walkthrough**

Fresh install (or a test account with no existing relief tags): 
1. Scan a receipt containing a lifestyle-matching line item; save it; confirm zero new UI on the save path.
2. Open Settings -> Tax relief; confirm the Lifestyle card shows the new claim.
3. Map an internet/insurance commitment to a relief line; pay its next occurrence; confirm it appears tagged.
4. Add a transaction manually via search; edit its relief line and amount; attach a photo; confirm the evidence chip updates.
5. Create (or backdate a test fixture to) a `weak-unnamed` tag dated this month; confirm it appears in "Requestable this month" and the Settings badge count.
6. Export the audit pack; open the PDF; confirm the summary and image pages are correct.
7. Switch the YA selector; confirm totals and lists change independently per year.

- [ ] **Step 5: Update `docs/tax-relief-receipts-research.md`'s open-questions note (optional but recommended)**

If any of the research doc's open items (childcare's YA-2024 sunset, lifestyle-to-sports overflow) were resolved during implementation by checking hasil.gov.my directly, update that doc's §6 accordingly. Otherwise leave as-is  the in-app copy already flags these per the spec's §2 design decision.

- [ ] **Step 6: Final commit (only if Step 5 produced a change)**

```bash
git add docs/tax-relief-receipts-research.md
git commit -m "docs(tax): resolve open relief-schedule questions found during implementation"
```
