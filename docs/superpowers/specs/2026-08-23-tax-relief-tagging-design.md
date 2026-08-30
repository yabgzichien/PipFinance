# Tax relief tagging: design spec

Status: approved for implementation. Date: 2026-08-23.
Background research: [docs/tax-relief-receipts-research.md](../../tax-relief-receipts-research.md).

## Problem

Malaysian taxpayers self-declare relief amounts into MyTax/Form BE with no receipts
submitted at filing time. The real burden is (a) knowing which of their spending qualifies
for a relief line at all, and (b) holding evidence good enough to survive an LHDN audit for
up to 7 years. Pip already captures receipt images and line items on scan
(`ScannedReceipt`, `Transaction.receiptUri`) and already tracks recurring bills
(`Commitment`). This feature reuses that data to tag transactions against LHDN relief
categories automatically, flag when the evidence behind a tag is weak, and produce a
filing-time summary and an audit-pack export: without adding any visible step to the
existing scan/save flow.

## Goals

- Auto-tag transactions against a curated set of LHDN relief lines, silently, at the two
  points the app already has the right signal (receipt categorize/save, commitment payment).
- Track evidence completeness per tag (image / certification / e-Invoice) and surface it
  only inside a new Tax screen.
- Surface the e-Invoice request window (expires end of the transaction's calendar month)
  as a passive list inside the Tax screen: no push notifications, no in-flow nudges.
- Let the user review, correct, retag, or manually add tags from the Tax screen.
- Export a per-year-of-assessment audit pack: a real PDF bundling every tag's evidence
  images plus a summary table keyed by Form BE line.

## Non-goals (v1)

- The full ~20-line LHDN schedule. Only the curated subset in §2 ships now; rarer lines
  (disability tiers, parents/grandparents, first-home loan interest) are future data, not
  architecture: the schema supports adding them without a design change.
- Any MyInvois/e-Invoice API integration. Research confirmed intermediaries are barred from
  retrieving a taxpayer's own received e-Invoices; capture is QR-scan-of-the-visual or photo
  only (§6).
- Filing anything to LHDN. The app never submits; the Tax screen is read-while-you-type
  reference for the user's own MyTax session.
- Push notifications or any in-flow UI for the e-Invoice nudge (explicit product decision).
- Any evidence-state UI outside the Tax screen (explicit product decision).
- Multiple relief tags per transaction beyond simple basket-splitting (one tag can cover
  part of a transaction's amount; a transaction can carry more than one tag, but there's no
  UI for auto-splitting a basket across many lines in v1: line-item detection creates at
  most one tag automatically, additional tags are manual).
- An opt-in toggle. Runs automatically for every install (explicit product decision); a user
  who never opens Settings → Tax relief never sees any trace of it.

## 1. Data model

### 1.1 Types (`src/lib/types.ts` additions)

```ts
export type ReliefOrigin = 'auto' | 'commitment' | 'manual';
export type EvidenceState = 'complete' | 'missing-cert' | 'no-image' | 'weak-unnamed';

export interface ReliefTag {
  id: string;
  txnId: string;
  code: string;                    // key into the YA's ReliefLine list, e.g. 'lifestyle'
  ya: number;                      // year of assessment this counts toward
  amount: number;                  // <= the parent txn's amount; supports basket-splitting
  origin: ReliefOrigin;
  certImageUri: string | null;     // second attachment for requiresCert lines
  einvoiceImageUri: string | null; // QR-scanned e-Invoice visual, if captured
  createdAt: string;
}
```

`Commitment` (`src/lib/commitments.ts`) gets one new optional field:

```ts
export interface Commitment {
  // ...existing fields
  reliefCode: string | null; // set once in the Tax screen; every paid occurrence auto-tags
}
```

### 1.2 Schema (`src/db/db.ts`)

New table, added to the main `CREATE TABLE IF NOT EXISTS` block alongside `commitments`:

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
CREATE INDEX IF NOT EXISTS idx_relief_txn ON relief_tags (txn_id);
CREATE INDEX IF NOT EXISTS idx_relief_ya_code ON relief_tags (ya, code);
```

Migration for the existing `commitments` table, added beside the other `ALTER TABLE ...
ADD COLUMN` try/catch blocks that already run in `init()`:

```ts
try {
  await db.execAsync('ALTER TABLE commitments ADD COLUMN relief_code TEXT');
} catch {
  // column already present
}
```

No migration needed for `relief_tags` itself: it's `CREATE TABLE IF NOT EXISTS`, same as
every other table added after the app's initial release.

### 1.3 Repo (`src/db/reliefRepo.ts`, new file, mirrors `commitmentsRepo.ts`)

```ts
export async function listReliefTags(ya: number): Promise<ReliefTag[]>;
export async function getReliefTagsForTxn(txnId: string): Promise<ReliefTag[]>;
export async function addReliefTag(input: NewReliefTag): Promise<ReliefTag>;
export async function updateReliefTag(id: string, patch: Partial<Pick<ReliefTag,
  'code' | 'amount' | 'certImageUri' | 'einvoiceImageUri'>>): Promise<void>;
export async function deleteReliefTag(id: string): Promise<void>;

// merchantKey -> reliefCode, same shape as merchant_memory, own table so relief memory
// can be cleared independently of category memory in Settings.
export async function getReliefMemoryMap(): Promise<Record<string, string>>;
export async function upsertReliefMemory(merchantKey: string, code: string): Promise<void>;
```

`relief_memory` table, same shape as `merchant_memory`:

```sql
CREATE TABLE IF NOT EXISTS relief_memory (
  merchant_key TEXT PRIMARY KEY NOT NULL,
  relief_code  TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
```

## 2. Relief schedule (`src/lib/reliefSchedule.ts`, new file)

Bundled TS data, versioned by year of assessment, curated to what a working adult's
receipts and commitments actually touch. Ships as code (new YA = new exported const + a
version bump), not remote config, for v1.

```ts
export interface ReliefLine {
  code: string;
  parent?: string;          // nests under another line's aggregate cap, e.g. medical sub-lines
  label: string;
  formField: string;        // what the user types into e-Filing, e.g. 'G9'
  cap: number;               // this line's own cap in RM
  requiresCert?: 'MMC' | 'MDC' | null;
  matchKeywords: string[];  // lowercased line-item / merchant heuristics
  commitmentEligible: boolean; // can be assigned to a Commitment in the Tax screen
}

export interface ReliefSchedule {
  ya: number;
  lines: ReliefLine[];
}

export const RELIEF_SCHEDULE_2025: ReliefSchedule = {
  ya: 2025,
  lines: [
    { code: 'lifestyle', label: 'Lifestyle', formField: 'G9', cap: 2500,
      matchKeywords: ['book', 'magazine', 'newspaper', 'laptop', 'smartphone', 'tablet',
        'computer', 'internet', 'broadband', 'unifi', 'course', 'skill'],
      commitmentEligible: true, requiresCert: null },
    { code: 'sports', label: 'Sports & fitness', formField: 'G10', cap: 1000,
      matchKeywords: ['gym', 'fitness', 'sports equipment', 'racket', 'yoga', 'membership'],
      commitmentEligible: true, requiresCert: null },
    { code: 'medical', label: 'Medical (aggregate)', formField: 'G6-G8', cap: 10000,
      matchKeywords: [], commitmentEligible: false, requiresCert: null },
    { code: 'medical.serious', parent: 'medical', label: 'Serious diseases / fertility',
      formField: 'G6(i)-(ii)', cap: 10000, matchKeywords: ['hospital', 'clinic', 'treatment'],
      commitmentEligible: false, requiresCert: 'MMC' },
    { code: 'medical.vaccination', parent: 'medical', label: 'Vaccination',
      formField: 'G6(iii)', cap: 1000, matchKeywords: ['vaccine', 'vaccination', 'jab'],
      commitmentEligible: false, requiresCert: null },
    { code: 'medical.dental', parent: 'medical', label: 'Dental exam & treatment',
      formField: 'G6(iv)', cap: 1000, matchKeywords: ['dental', 'dentist'],
      commitmentEligible: false, requiresCert: 'MDC' },
    { code: 'medical.checkup', parent: 'medical', label: 'Health screening / mental health',
      formField: 'G7', cap: 1000,
      matchKeywords: ['medical checkup', 'health screening', 'mental health', 'covid test'],
      commitmentEligible: false, requiresCert: null },
    { code: 'insurance.education-medical', label: 'Education / medical insurance premium',
      formField: 'G4', cap: 4000, matchKeywords: ['insurance', 'takaful'],
      commitmentEligible: true, requiresCert: null },
    { code: 'sspn', label: 'SSPN net deposit', formField: 'G13', cap: 8000,
      matchKeywords: ['sspn'], commitmentEligible: true, requiresCert: null },
    { code: 'childcare', label: 'Child care centre / kindergarten', formField: 'G12',
      cap: 3000, matchKeywords: ['childcare', 'kindergarten', 'daycare', 'nursery'],
      commitmentEligible: true, requiresCert: null },
  ],
};

export const RELIEF_SCHEDULES: Record<number, ReliefSchedule> = { 2025: RELIEF_SCHEDULE_2025 };
export function scheduleForYA(ya: number): ReliefSchedule | null { ... }
```

Cap figures are taken from the research doc's High-confidence table; the doc's open
questions (childcare's YA-2024 sunset, lifestyle→sports overflow) are deliberately **not**
encoded as special-case logic: they're flagged in-app copy on those two lines
("confirm this is still active for the current year on hasil.gov.my") rather than guessed.

## 3. Cap / aggregate engine (`src/lib/relief.ts`, new file, pure)

```ts
export interface ReliefUsage {
  code: string;
  claimed: number;   // sum of this line's own tags
  capUsed: number;   // min(claimed, effective cap after aggregate parent constraint)
  cap: number;
  remaining: number;
}

/** For a YA, sums tags per line and applies parent-aggregate capping: a child line's
 *  usable cap is min(its own cap, parent's remaining aggregate room). */
export function computeUsage(tags: ReliefTag[], schedule: ReliefSchedule): ReliefUsage[];
```

Aggregate math: for a line with `parent` set, its contribution counts against both its own
`cap` and its parent's `cap`. `computeUsage` walks children grouped by parent, sums their
claimed amounts, and reports `capUsed` as the smaller of (a) the sum capped at the child's
own limit and (b) whatever room is left under the parent's total after all siblings. This
is unit-tested directly against the worked example in the research doc (§1.2): RM10,000
medical aggregate with RM1,000 vaccination + RM1,000 dental + RM1,000 checkup + open-ended
`medical.serious`.

## 4. Detection (`src/lib/relief.ts`, continued)

```ts
export function matchRelief(
  txn: ExtractedTxn | Transaction,
  receipt: ScannedReceipt | null,
  reliefMemory: Record<string, string>,
  schedule: ReliefSchedule
): { code: string; amount: number } | null;
```

Priority order:
1. **Line-item keyword match**: if `receipt.items` is present, test each item's label
   (lowercased) against every leaf line's `matchKeywords`. First match wins; `amount` is
   that line item's amount (not the whole receipt total), which is what enables a mixed
   basket (`RM380` receipt, `RM120` of it a laptop) to tag only the matching portion.
2. **Merchant memory**: if no line-item match, look up `merchantKey` in `reliefMemory`
   (mirrors the existing category-memory lookup). Whole-transaction amount.
3. No match → no tag. Nothing is guessed from the merchant name alone on a first sighting;
   memory only exists after a user confirms a tag once in the Tax screen (§7.4), same
   bootstrapping as category memory today.

### 4.1 Wiring into existing flow

`AddFlow.tsx`'s `onCategorized` (fires after `CategorizeScreen` completes, before
`SavedScreen` mounts) calls `matchRelief` once per saved transaction, and on a hit calls
`addReliefTag({ txnId, code, ya: yaForDate(txn.date), amount, origin: 'auto' })`. This is
the only change to the existing save path: no new state, no new render, `SavedScreen` is
untouched. `yaForDate` is a trivial pure helper (`new Date(iso).getFullYear()`; a
transaction dated in the relief-claim calendar year always maps to that same YA per the
research doc §1.6).

### 4.2 Wiring into commitment payment

`commitmentsRepo.markOccurrencePaid` gains one call after the existing `UPDATE`: if the
parent `Commitment.reliefCode` is set and a `txnId` was created/matched, call
`addReliefTag({ txnId, code: commitment.reliefCode, ya: yaForDate(occurrence.dueDate),
amount: payment.paidAmount, origin: 'commitment' })`. Full occurrence amount, no keyword
matching needed: the mapping was already made explicit by the user assigning the
commitment a relief code in the Tax screen.

## 5. Evidence state (`src/lib/relief.ts`, continued)

```ts
export function evidenceState(tag: ReliefTag, txn: Transaction, line: ReliefLine): EvidenceState;
```

Pure decision table, evaluated in this order:
1. No `txn.receiptUri` and no `certImageUri` → `'no-image'`.
2. `line.requiresCert` is set and `tag.certImageUri` is null → `'missing-cert'`.
3. `line.commitmentEligible` is false (i.e. this is discretionary retail spending, not a
   recurring bill) and `tag.einvoiceImageUri` is null → `'weak-unnamed'`. This is the
   honest default from the research: an ordinary till receipt essentially never carries the
   buyer's name, so anything short of a captured e-Invoice visual is treated as weak by
   default rather than the app pretending OCR can verify a name that generally isn't there.
4. Otherwise → `'complete'`.

This function is called only from the Tax screen (§7): never from the scan/save flow,
never from the transaction list, per the explicit product decision to keep this feature's
footprint at zero everywhere else.

## 6. e-Invoice gap tracking

No new state beyond what's already computed: a tag whose `evidenceState` is
`'weak-unnamed'` **and** whose `txn.date` falls in the current calendar month is
"requestable": the research (§3.4) established the right to ask a supplier for an
individual e-Invoice after taking a plain receipt expires at the end of that calendar
month. `src/lib/relief.ts` exports:

```ts
export function isRequestable(tag: ReliefTag, txn: Transaction, today: Date): boolean;
```

The Tax screen's "Requestable this month" section (§7.2) is just `tags.filter(t =>
isRequestable(...))`, sorted by days remaining. No background job, no notification
scheduling: it's computed fresh whenever the screen renders, same as everything else in
this feature.

Capture path for an actual e-Invoice: the transaction edit sheet gets one new action,
"Attach e-Invoice", which opens the existing image-picker flow (already used for
`receiptUri`) and writes to `einvoiceImageUri`, storing the photo or
screenshot of the validated e-Invoice visual (its embedded IRBM QR code is what makes it
verifiable later; the app does not parse or validate the QR itself in v1, it's just stored
as the strongest evidence artifact). No MyInvois API calls anywhere in this feature (see
Non-goals above).

## 7. Tax screen (`src/screens/TaxScreen.tsx`, new)

### 7.1 Navigation

`screenNav.ts`: add `'tax'` to the `Screen` union, `backTargetFor('tax') -> 'settings'`.
`App.tsx`: import and mount `<TaxScreen onBack={goBack} />` when `screen === 'tax'`.
`SettingsScreen.tsx`: add one more row in the existing "Data" section, same
`styles.providerRow`/`styles.migrateRow` pattern as the Commitments/Categories/Export rows
(`src/screens/SettingsScreen.tsx:189-247`), using the existing `'receipt'` icon:

```tsx
{onOpenTax && (
  <Pressable onPress={onOpenTax} style={...}>
    <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
      <Icon name="receipt" size={16} color={theme.accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.providerName, { color: colorTheme.ink }]}>Tax relief</Text>
    </View>
    {requestableCount > 0 && (
      <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
        <Text style={styles.countBadgeText}>{requestableCount}</Text>
      </View>
    )}
    <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
  </Pressable>
)}
```

`requestableCount` (all requestable tags across the current YA) is the *only* surface this
feature has outside the Tax screen itself: a small number badge on a settings row the user
already has to navigate into deliberately.

### 7.2 Layout

- Header: YA selector (current YA + prior YA, since a user filing in the first months of a
  year is often still finishing last year's evidence), overall total claimed.
- One card per top-level relief line (children rendered nested/indented under their
  parent's card, e.g. all `medical.*` lines inside the `medical` card): label, progress bar,
  `RM claimed / RM cap`, form field code (e.g. "G9") shown small for direct e-Filing lookup.
- Tapping a card expands its tagged transactions: merchant, date, amount, an evidence chip
  (colored dot + label: "Complete" / "Needs certification" / "No photo" / "Weak: no name").
- Tapping a transaction row opens an edit sheet: change relief code (dropdown of schedule
  lines), adjust claimed amount, attach cert photo, attach e-Invoice photo, remove tag.
- "Requestable this month" section, above the relief cards when non-empty: flat list of
  `weak-unnamed` tags dated this month, each with "N days left" and a direct "Attach
  e-Invoice" action.
- "Map a commitment" button: opens a picker of existing commitments (from
  `commitmentsRepo.listCommitments`, filtered to those whose current category loosely
  matches a `commitmentEligible` line, but showing all of them), assigns `reliefCode`. Past
  paid occurrences for that commitment do **not** get retroactively tagged in v1 (only
  future payments): retroactive backfill is a manual "Add manually" action instead, kept
  simple rather than reconstructing history automatically.
- "Add manually" button: searches existing transactions (reuses whatever search component
  `AllTransactionsScreen` already has), tags the selected one.
- Footer: "Export audit pack" primary button (§8).

### 7.3 Empty states

- No tags yet for the selected YA: Pip illustration + "Nothing tagged yet: scan a receipt
  or map a bill to get started", matching the app's existing empty-state voice elsewhere.
- A relief line with zero tags: card still shows (so the user knows the line exists) with
  "RM 0 / RM cap" and no expand affordance.

### 7.4 Confirming an auto-tag strengthens memory

When the user edits or confirms (by simply viewing without changing) a tag whose `origin`
is `'auto'` and whose match came from merchant memory, `upsertReliefMemory` is called the
same way `upsertMemory` already runs for category learning: so the next receipt from that
merchant tags itself with higher confidence over time, exactly mirroring the existing
category-learning UX the user already understands.

## 8. Audit pack export (extends `src/screens/ExportScreen.tsx` or a dedicated flow off the
Tax screen: implementation detail for the plan, not the design)

- New dependency: `pdf-lib` (pure JS, no native module, works on both web and native via
  Expo's file system, unlike the app's existing HTML-print pipeline which only gives native
  users an HTML file rather than a real PDF).
- Per selected YA: one PDF containing (a) a summary table, one row per relief line -
  form field, label, claimed, cap: matching the Tax screen's own numbers exactly, and (b)
  one page (or one image block) per tagged transaction showing its receipt image, and its
  cert/e-Invoice image if attached, captioned with merchant/date/amount/relief line.
- `saveOrDownloadExport` (`src/lib/financialExport.ts:1372`) already handles the
  web-vs-native split for arbitrary binary content (`Uint8Array`): the PDF bytes from
  `pdf-lib` slot into the existing function unchanged; no new platform-branching code needed.
- Images are read from their stored local URIs and embedded directly (`pdf-lib`'s
  `embedJpg`/`embedPng`); no upload, no network call anywhere in this feature.

## 9. Testing

Pure-function unit tests, `__tests__/relief.test.ts`, following the existing style (see
`__tests__/networth.test.ts`, `__tests__/screenNav.test.ts`):

- `computeUsage`: the nested-aggregate worked example from the research doc (medical
  RM10,000 with three RM1,000 sub-lines plus an open serious-disease line); verifies a
  child line's usable cap shrinks once siblings have consumed the parent aggregate.
- `matchRelief`: line-item keyword match takes priority over merchant memory; a receipt
  with a mixed basket only tags the matching line item's amount, not the receipt total; no
  match when nothing hits.
- `evidenceState`: all four states reachable, decision-order verified (e.g. a `medical.dental`
  tag with a receipt but no cert photo is `'missing-cert'`, not `'complete'`).
- `isRequestable`: true only within the transaction's calendar month, false the day after
  month-end.
- `screenNav`: `'tax'` back-target added to the existing table-driven test.

No new UI test infra: `TaxScreen.tsx` itself is exercised manually (per the project's
existing pattern of verifying screens in the live app rather than component tests) once
implemented.

## Open items carried from research (not blocking, tracked for future YA updates)

- Confirm childcare relief's status for the *current* filing year directly against
  hasil.gov.my before each YA's schedule update (§2's in-app copy flags this rather than
  guessing).
- Confirm whether lifestyle overflow spills into sports: currently modeled as **no
  spillover** (each line strictly capped independently), the conservative reading.
- Revisit the "only future commitment payments get tagged" simplification (§7.2) if users
  ask for backfill.
