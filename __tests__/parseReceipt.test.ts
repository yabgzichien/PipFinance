import { derivedSurcharges, parseReceipt, receiptSubtotal } from '../src/lib/parseReceipt';
import { computeItemized, SELF } from '../src/lib/split';

const FULL = JSON.stringify({
  merchant: 'Nasi Kandar Pelita',
  items: [
    { label: 'Nasi Campur', amount: 12.5, quantity: 1 },
    { label: 'Teh Tarik', amount: 6.0, quantity: 2 },
  ],
  subtotal: 18.5,
  serviceCharge: 1.85,
  tax: 1.22,
  total: 21.57,
});

describe('parseReceipt', () => {
  it('reads a well-formed receipt', () => {
    const r = parseReceipt(FULL);
    expect(r.merchant).toBe('Nasi Kandar Pelita');
    expect(r.items).toHaveLength(2);
    expect(r.items[1]).toEqual({ label: 'Teh Tarik', amount: 6, quantity: 2 });
    expect(r.total).toBe(21.57);
  });

  it('strips markdown fences the model sometimes adds', () => {
    expect(parseReceipt('```json\n' + FULL + '\n```').items).toHaveLength(2);
  });

  it('returns an empty receipt rather than throwing on junk', () => {
    for (const junk of ['', 'not json', '[]', 'null', '{"items": "nope"}']) {
      const r = parseReceipt(junk);
      expect(r.items).toEqual([]);
      expect(r.total).toBeNull();
    }
  });

  it('cleans currency symbols and separators out of amounts', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'Feast', amount: 'RM 1,234.50' }], total: 'RM 1,234.50' }));
    expect(r.items[0].amount).toBe(1234.5);
    expect(r.total).toBe(1234.5);
  });

  it('keeps a discount row negative', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'Voucher', amount: -5 }] }));
    expect(r.items[0].amount).toBe(-5);
  });

  it('reads a discount printed before the surcharges', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 10 }], discount: { amount: 2, timing: 'before' } }));
    expect(r.discount).toEqual({ amount: 2, timing: 'before' });
  });

  it('reads a discount printed after the surcharges', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 10 }], discount: { amount: 2, timing: 'after' } }));
    expect(r.discount).toEqual({ amount: 2, timing: 'after' });
  });

  it('defaults an unreadable discount timing to before', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 10 }], discount: { amount: 2, timing: 'sideways' } }));
    expect(r.discount).toEqual({ amount: 2, timing: 'before' });
  });

  it('has no discount when the receipt printed none', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 10 }] }));
    expect(r.discount).toBeNull();
  });

  it('drops a discount with no readable amount', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 10 }], discount: { timing: 'before' } }));
    expect(r.discount).toBeNull();
  });

  it('drops a row with no readable price but keeps the rest', () => {
    const r = parseReceipt(
      JSON.stringify({ items: [{ label: 'Readable', amount: 9 }, { label: 'Smudged', amount: null }] })
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].label).toBe('Readable');
  });

  it('names an unlabelled row by position', () => {
    expect(parseReceipt(JSON.stringify({ items: [{ amount: 9 }] })).items[0].label).toBe('Item 1');
  });

  it('ignores a nonsense quantity', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 9, quantity: 'two' }] }));
    expect(r.items[0].quantity).toBeNull();
  });
});

describe('receiptSubtotal', () => {
  it('prefers the printed subtotal', () => {
    expect(receiptSubtotal(parseReceipt(FULL))).toBe(18.5);
  });

  it('adds the lines up when none was printed', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 10.1 }, { label: 'B', amount: 5.2 }] }));
    expect(receiptSubtotal(r)).toBe(15.3);
  });
});

describe('derivedSurcharges', () => {
  it('backs the usual 10% and 6% out of the printed amounts', () => {
    // Tax is read against subtotal + service (18.50 + 1.85 = 20.35), which is how the
    // receipt computed it. Reading it against the subtotal alone would give 6.6%.
    expect(derivedSurcharges(parseReceipt(FULL))).toEqual({ serviceChargePct: 10, taxPct: 6, discount: null });
  });

  it('stays at zero when the receipt printed no surcharges', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 20 }], total: 20 }));
    expect(derivedSurcharges(r)).toEqual({ serviceChargePct: 0, taxPct: 0, discount: null });
  });

  it('reports an unusual rate rather than snapping it to a convention', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 100 }], serviceCharge: 5 }));
    expect(derivedSurcharges(r).serviceChargePct).toBe(5);
  });

  it('survives a receipt with no items at all', () => {
    expect(derivedSurcharges(parseReceipt('{}'))).toEqual({ serviceChargePct: 0, taxPct: 0, discount: null });
  });

  it('carries a printed discount through as a flat amount', () => {
    const r = parseReceipt(
      JSON.stringify({ items: [{ label: 'A', amount: 100 }], discount: { amount: 8, timing: 'before' } })
    );
    expect(derivedSurcharges(r).discount).toEqual({ unit: 'amount', value: 8, timing: 'before' });
  });

  it('has no discount when the receipt printed none', () => {
    const r = parseReceipt(JSON.stringify({ items: [{ label: 'A', amount: 100 }] }));
    expect(derivedSurcharges(r).discount).toBeNull();
  });

  // A 'before' voucher was already off the base when the till computed service and tax, so
  // the percentages have to be backed out of the DISCOUNTED base. Dividing by the printed
  // subtotal understates them, and `computeItemizedTotalCents` then discounts a second time.
  describe("with a 'before' discount", () => {
    // RM100 of food, RM20 voucher at the till, 10% service on RM80, 6% tax on RM88.
    const BEFORE = JSON.stringify({
      items: [{ label: 'Steak', amount: 100 }],
      subtotal: 100,
      serviceCharge: 8,
      tax: 5.28,
      total: 93.28,
      discount: { amount: 20, timing: 'before' },
    });

    it('backs the percentages out of the discounted base, not the printed subtotal', () => {
      expect(derivedSurcharges(parseReceipt(BEFORE))).toEqual({
        serviceChargePct: 10,
        taxPct: 6,
        discount: { unit: 'amount', value: 20, timing: 'before' },
      });
    });

    it('an all-mine itemised split reconciles against what was actually charged', () => {
      const receipt = parseReceipt(BEFORE);
      const result = computeItemized(
        [{ id: 'l1', label: 'Steak', amount: 100, assignedTo: [SELF] }],
        derivedSurcharges(receipt),
        93.28,
        [SELF]
      );
      expect(result.computedTotal).toBeCloseTo(93.28, 2);
      expect(result.difference).toBeCloseTo(0, 2);
    });
  });

  // The 'after' case is unchanged: a discount line printed below the tax means service and
  // tax really were computed on the full subtotal.
  it("leaves an 'after' discount reading against the full subtotal", () => {
    const r = parseReceipt(
      JSON.stringify({
        items: [{ label: 'A', amount: 100 }],
        subtotal: 100,
        serviceCharge: 10,
        tax: 6.6,
        discount: { amount: 20, timing: 'after' },
      })
    );
    expect(derivedSurcharges(r)).toEqual({
      serviceChargePct: 10,
      taxPct: 6,
      discount: { unit: 'amount', value: 20, timing: 'after' },
    });
  });
});
