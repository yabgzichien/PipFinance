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
      merchant: 'Big Store', subtotal: 380, serviceCharge: null, tax: null, total: 380, discount: null,
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
      merchant: 'Popular Bookstore', subtotal: 120, serviceCharge: null, tax: null, total: 120, discount: null,
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

  it('is complete for a commitment-origin tag once it has a receipt, with no e-Invoice required', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({ code: 'sspn', origin: 'commitment' }), t, sspnLine)).toBe('complete');
  });

  it('is weak-unnamed for a non-commitment-origin tag even on a commitment-eligible line', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({ code: 'sspn', origin: 'auto' }), t, sspnLine)).toBe('weak-unnamed');
  });

  it('is complete for discretionary spending once an e-Invoice photo is attached', () => {
    const t = txn({ receiptUri: 'file:///r1.jpg' });
    expect(evidenceState(tag({ einvoiceImageUri: 'file:///inv.jpg' }), t, lifestyleLine)).toBe('complete');
  });
});

describe('isRequestable', () => {
  // `today` is built from local-time components on purpose: `txn.date` is a local-time key, so
  // the comparison inside `isRequestable` is local-vs-local. Constructing these from UTC strings
  // would make the outcome depend on the machine's timezone offset.
  const localDate = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

  it('is true only for weak-unnamed evidence dated in the current month', () => {
    expect(isRequestable('weak-unnamed', txn({ date: '2025-06-05' }), localDate(2025, 6, 20))).toBe(true);
  });

  it('is false once the transaction month has passed', () => {
    expect(isRequestable('weak-unnamed', txn({ date: '2025-06-05' }), localDate(2025, 7, 1))).toBe(false);
  });

  it('uses the local month, not the UTC one, at a month boundary', () => {
    // Midnight local on the 1st: in any timezone ahead of UTC this instant is still the
    // previous month in UTC, so a UTC-based comparison would wrongly call June requestable.
    expect(isRequestable('weak-unnamed', txn({ date: '2025-06-30' }), localDate(2025, 7, 1, 0))).toBe(false);
    expect(isRequestable('weak-unnamed', txn({ date: '2025-07-01' }), localDate(2025, 7, 1, 0))).toBe(true);
  });

  it('is false for any evidence state other than weak-unnamed', () => {
    const today = localDate(2025, 6, 20);
    expect(isRequestable('complete', txn({ date: '2025-06-05' }), today)).toBe(false);
    expect(isRequestable('no-image', txn({ date: '2025-06-05' }), today)).toBe(false);
  });

  it('is false when the transaction has no date', () => {
    expect(isRequestable('weak-unnamed', txn({ date: null }), localDate(2025, 6, 20))).toBe(false);
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
