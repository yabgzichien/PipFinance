// __tests__/groupSplitReceipt.test.ts
// One receipt for the whole table, so a payer can post a single image to the group chat
// instead of sending each friend their own. The property that makes it trustworthy in front
// of a group is that every column adds up: each person's printed rows sum to their total, and
// the totals sum to the bill. A receipt that does not tie out argues against the app in front
// of everyone at once.
import {
  formatGroupSplitReceiptMessage,
  generateGroupSplitReceipt,
  type GroupSplitPersonInput,
} from '../src/lib/receiptGenerator';
import { DEFAULT_SURCHARGES, SELF, computeBillTotal, explodeItemized } from '../src/lib/split';

const LINES = [
  { id: 'l1', label: 'Nasi Goreng', amount: 14.9, assignedTo: [SELF] },
  { id: 'l2', label: 'Ayam Masak Merah', amount: 18.5, assignedTo: ['aisyah'] },
  { id: 'l3', label: 'Sotong', amount: 22, assignedTo: [SELF, 'aisyah'] },
];
const TABLE = ['aisyah', SELF];
const BILL_TOTAL = computeBillTotal(LINES, DEFAULT_SURCHARGES);

function people(): GroupSplitPersonInput[] {
  const names: Record<string, string> = { aisyah: 'Aisyah', [SELF]: 'You' };
  return explodeItemized(LINES, DEFAULT_SURCHARGES, BILL_TOTAL, TABLE).map((p) => ({
    ...p,
    name: names[p.personId],
  }));
}

function build(isZh = false) {
  return generateGroupSplitReceipt({
    merchant: 'Restoran Sebelas',
    billTotal: BILL_TOTAL,
    people: people(),
    categoryName: 'Food',
    isZh,
  });
}

test('prints one section per person, in the order given', () => {
  const r = build();
  expect(r.people.map((p) => p.name)).toEqual(['Aisyah', 'You']);
});

test("each person's printed rows sum exactly to their own total", () => {
  for (const person of build().people) {
    const summed = person.items.reduce((s, i) => s + i.amount, 0);
    expect(summed).toBeCloseTo(person.total, 2);
  }
});

test('the personal totals sum to the bill total', () => {
  const r = build();
  const summed = r.people.reduce((s, p) => s + p.total, 0);
  expect(summed).toBeCloseTo(r.billTotal, 2);
  expect(r.billTotal).toBeCloseTo(BILL_TOTAL, 2);
});

test('a shared dish is marked with how many people split it', () => {
  const aisyah = build().people.find((p) => p.name === 'Aisyah')!;
  const sotong = aisyah.items.find((i) => i.name === 'Sotong')!;
  expect(sotong.workings).toContain('2');
  // Her half of a RM 22 plate.
  expect(sotong.amount).toBeCloseTo(11, 2);
});

test('a solo dish carries no shared marking', () => {
  const aisyah = build().people.find((p) => p.name === 'Aisyah')!;
  const ayam = aisyah.items.find((i) => i.name === 'Ayam Masak Merah')!;
  expect(ayam.workings).toBeUndefined();
});

test('the same bill always produces the same receipt number', () => {
  expect(build().receiptNo).toBe(build().receiptNo);
});

test('the shareable message names every person and the bill total', () => {
  const msg = formatGroupSplitReceiptMessage(build());
  expect(msg).toContain('Aisyah');
  expect(msg).toContain('You');
  expect(msg).toContain('Restoran Sebelas');
  expect(msg).toContain(BILL_TOTAL.toFixed(2));
});
