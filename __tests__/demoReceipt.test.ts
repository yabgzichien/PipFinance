// __tests__/demoReceipt.test.ts
// The onboarding demo's bill is the one piece of arithmetic every new install sees before
// it has any data of its own, so it gets the same reconciliation guarantee a real split
// does. The gross is pinned to a literal on purpose: `demoReceipt.ts` derives it by calling
// `computeBillTotal`, so asserting it equals that same call would prove nothing. Pinning the
// ringgit figure means a change to DEFAULT_SURCHARGES fails here loudly and forces someone to
// re-check what the demo shows, instead of silently altering it.
import { SELF } from '../src/lib/split';
import {
  DEMO_CATEGORY_ID,
  DEMO_FRIENDS,
  DEMO_RECEIPT_GROSS,
  DEMO_RECEIPT_LINES,
  DEMO_RECEIPT_MERCHANT,
  DEMO_RECEIPT_WORKINGS,
  buildDemoGeneratedReceipt,
  buildDemoShareMessage,
  buildDemoSplit,
} from '../src/data/demoReceipt';

test('the demo bill totals RM 80.34 with 10% service charge and 6% SST', () => {
  expect(DEMO_RECEIPT_GROSS).toBeCloseTo(80.34, 2);
});

test('the workings carry a RM 68.90 subtotal at 10% service and 6% SST', () => {
  expect(DEMO_RECEIPT_WORKINGS.subtotal).toBeCloseTo(68.9, 2);
  expect(DEMO_RECEIPT_WORKINGS.serviceChargePct).toBe(10);
  expect(DEMO_RECEIPT_WORKINGS.taxPct).toBe(6);
});

test('every line is assigned to somebody, so nothing falls back to an even share', () => {
  for (const line of DEMO_RECEIPT_LINES) {
    expect(line.assignedTo.length).toBeGreaterThan(0);
  }
  const split = buildDemoSplit();
  expect(split.unassigned).toHaveLength(0);
});

test('the itemized split reconciles exactly to the bill total', () => {
  const split = buildDemoSplit();
  const summed = split.ownShare + split.shares.reduce((s, p) => s + p.owed, 0);
  expect(summed).toBeCloseTo(DEMO_RECEIPT_GROSS, 2);
});

test('each person pays for what they ordered, so no two shares match', () => {
  const split = buildDemoSplit();
  const owed = new Map(split.shares.map((s) => [s.personId, s.owed]));
  // Wen Jie's ayam masak merah is the priciest solo dish; Zhi Chen only had the sirap. The
  // odd cents come from `apportionCents` distributing the residue, not from rounding each
  // share independently — which is why these sum to the gross exactly, above.
  expect(owed.get('demo-wenjie')).toBeCloseTo(33.63, 2);
  expect(split.ownShare).toBeCloseTo(29.42, 2);
  expect(owed.get('demo-zhichen')).toBeCloseTo(17.29, 2);
});

test('the payer is never listed as one of the friends who owe', () => {
  const split = buildDemoSplit();
  expect(split.shares.map((s) => s.personId)).not.toContain(SELF);
  expect(split.shares).toHaveLength(DEMO_FRIENDS.length);
});

test('the meal is categorised as Food', () => {
  expect(DEMO_CATEGORY_ID).toBe('food');
});

test('the share message names the merchant and both friends', () => {
  const msg = buildDemoShareMessage(false);
  expect(msg).toContain(DEMO_RECEIPT_MERCHANT);
  expect(msg).toContain('Wen Jie');
  expect(msg).toContain('Zhi Chen');
});

test("the generated receipt carries every line and the bill's real total", () => {
  const receipt = buildDemoGeneratedReceipt(false);
  expect(receipt.merchant).toBe(DEMO_RECEIPT_MERCHANT);
  expect(receipt.items).toHaveLength(DEMO_RECEIPT_LINES.length);
  expect(receipt.total).toBeCloseTo(DEMO_RECEIPT_GROSS, 2);
  expect(receipt.subtotal).toBeCloseTo(68.9, 2);
});
