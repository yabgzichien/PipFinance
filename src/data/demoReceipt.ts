// src/data/demoReceipt.ts
// The bill behind the onboarding demo step (docs/superpowers/specs/2026-09-08-onboarding-demo-step-design.md).
//
// Ephemeral by construction: this module is plain data and pure arithmetic with no database,
// no storage and no sharing import. The demo renders from it in memory and nothing here can
// reach a user's records.
//
// "Restoran Sebelas" is invented. The other demo assets in assets/demo/ use real brands, which
// is fine for internal tax fixtures but not for the one receipt every new install is shown.
import {
  generateDeterministicReceipt,
  generateGroupSplitReceipt,
  type GeneratedReceipt,
  type GroupSplitReceipt,
} from '../lib/receiptGenerator';
import {
  DEFAULT_SURCHARGES,
  SELF,
  computeBillTotal,
  computeItemized,
  explodeItemized,
  type ItemizedResult,
  type ReceiptLine,
} from '../lib/split';
import { buildGroupMessage, workingsFromReceipt } from '../lib/splitMessage';

export const DEMO_RECEIPT_MERCHANT = 'Restoran Sebelas';

/** Ringgit throughout: the rendered receipt asset is printed in RM, so the demo bill stays in
 *  RM regardless of what the user later picks as a display currency. */
const DEMO_CURRENCY = 'MYR';

/** The seeded Food category (`src/data/categories.ts`). A shared restaurant meal is the least
 *  ambiguous thing Pip categorises, which is the point of showing it during onboarding. */
export const DEMO_CATEGORY_ID = 'food';

/** The two friends at the table. The payer is the user and is never in this list. */
export const DEMO_FRIENDS = [
  { personId: 'demo-wenjie', name: 'Wen Jie' },
  { personId: 'demo-zhichen', name: 'Zhi Chen' },
];

/**
 * Who ate what. Two solo dishes, one drink each, and a shared plate of sotong — the shared
 * line is deliberate: splitting it is the harder thing `computeItemized` does, and an even
 * three-way split would show none of it.
 */
export const DEMO_RECEIPT_LINES: ReceiptLine[] = [
  { id: 'l1', label: 'Nasi Goreng Kampung', amount: 14.9, assignedTo: [SELF] },
  { id: 'l2', label: 'Ayam Masak Merah', amount: 18.5, assignedTo: ['demo-wenjie'] },
  {
    id: 'l3',
    label: 'Sotong Goreng Tepung',
    amount: 22.0,
    assignedTo: [SELF, 'demo-wenjie', 'demo-zhichen'],
  },
  {
    id: 'l4',
    label: 'Teh Tarik × 3',
    amount: 9.0,
    assignedTo: [SELF, 'demo-wenjie', 'demo-zhichen'],
  },
  { id: 'l5', label: 'Air Sirap Limau', amount: 4.5, assignedTo: ['demo-zhichen'] },
];

/** The service-charge and SST breakdown a friend can check against the paper. */
export const DEMO_RECEIPT_WORKINGS = workingsFromReceipt(DEMO_RECEIPT_LINES, DEFAULT_SURCHARGES);

/** Derived, never hardcoded, so the demo can never disagree with the app's own arithmetic.
 *  `__tests__/demoReceipt.test.ts` pins the resulting figure so a change to the surcharge
 *  defaults surfaces as a failing test rather than a quietly different demo. */
export const DEMO_RECEIPT_GROSS = computeBillTotal(DEMO_RECEIPT_LINES, DEFAULT_SURCHARGES);

/** `computeItemized` wants the full table with the payer LAST, so every rounding residue
 *  lands on whoever fronted the money. */
export const DEMO_PARTICIPANTS = [...DEMO_FRIENDS.map((f) => f.personId), SELF];

/** Display names for the table, including the payer. */
export function demoPersonName(personId: string, isZh: boolean): string {
  if (personId === SELF) return isZh ? '你' : 'You';
  return DEMO_FRIENDS.find((f) => f.personId === personId)?.name ?? personId;
}

/**
 * Each line split among whoever ate it, with service charge and SST riding proportionally on
 * what each person's own items came to. The result is deliberately uneven — that is the whole
 * argument for itemised splitting over dividing by three.
 *
 * Takes the lines so the demo can recompute live as the user reassigns dishes. The charged
 * total stays fixed: moving a dish between people changes who owes what, never what the
 * restaurant billed.
 */
export function buildDemoSplit(lines: ReceiptLine[] = DEMO_RECEIPT_LINES): ItemizedResult {
  return computeItemized(lines, DEFAULT_SURCHARGES, DEMO_RECEIPT_GROSS, DEMO_PARTICIPANTS);
}

/** The one receipt the payer would post to the group chat, built from the live assignment. */
export function buildDemoGroupReceipt(
  isZh: boolean,
  lines: ReceiptLine[] = DEMO_RECEIPT_LINES
): GroupSplitReceipt {
  const people = explodeItemized(
    lines,
    DEFAULT_SURCHARGES,
    DEMO_RECEIPT_GROSS,
    DEMO_PARTICIPANTS
  ).map((p) => ({ ...p, name: demoPersonName(p.personId, isZh) }));

  return generateGroupSplitReceipt({
    merchant: DEMO_RECEIPT_MERCHANT,
    billTotal: DEMO_RECEIPT_GROSS,
    currency: DEMO_CURRENCY,
    people,
    categoryName: isZh ? '餐饮' : 'Food',
    seedId: 'pip-demo-group',
    isZh,
  });
}

/**
 * The receipt Pip generates for the group — the artifact a payer actually shares.
 *
 * `generateDeterministicReceipt` back-computes the pre-tax base from the total
 * (`total ÷ (1+svc)(1+tax)`), which lands a cent below the real subtotal: 68.89 against
 * 68.90. Harmless in isolation, but the demo shows this beside a receipt image printed with
 * the true figures, so the surcharge lines are restored from `DEMO_RECEIPT_WORKINGS` — the
 * same arithmetic the ledger uses. A test pins the corrected subtotal.
 */
export function buildDemoGeneratedReceipt(isZh: boolean): GeneratedReceipt {
  const base = generateDeterministicReceipt({
    merchant: DEMO_RECEIPT_MERCHANT,
    total: DEMO_RECEIPT_GROSS,
    currency: DEMO_CURRENCY,
    personName: isZh ? '你' : 'You',
    seedId: 'pip-demo',
    categoryId: DEMO_CATEGORY_ID,
    items: DEMO_RECEIPT_LINES.map((l) => ({ name: l.label, qty: 1, amount: l.amount })),
    serviceChargePct: DEFAULT_SURCHARGES.serviceChargePct,
    taxPct: DEFAULT_SURCHARGES.taxPct,
    splitMethod: 'itemized',
    participantCount: DEMO_PARTICIPANTS.length,
    isZh,
  });

  return {
    ...base,
    subtotal: DEMO_RECEIPT_WORKINGS.subtotal,
    serviceCharge: DEMO_RECEIPT_WORKINGS.serviceCharge,
    tax: DEMO_RECEIPT_WORKINGS.tax,
  };
}

/** The message the payer would send the group, built by the same function the real Saved
 *  screen uses, so the demo can never drift from the shipped wording or arithmetic.
 *
 *  Rendered as static text by the demo step. Deliberately not wired to `lib/shareText.ts`:
 *  nothing in the demo may put a fabricated bill in front of a real contact. */
export function buildDemoShareMessage(isZh: boolean): string {
  const split = buildDemoSplit();
  const owedById = new Map(split.shares.map((s) => [s.personId, s.owed]));
  return buildGroupMessage({
    merchant: DEMO_RECEIPT_MERCHANT,
    gross: DEMO_RECEIPT_GROSS,
    currency: DEMO_CURRENCY,
    method: 'itemized',
    ownShare: split.ownShare,
    shares: DEMO_FRIENDS.map((f) => ({
      personId: f.personId,
      name: f.name,
      owed: owedById.get(f.personId) ?? 0,
    })),
    workings: DEMO_RECEIPT_WORKINGS,
    isZh,
  });
}
