// __tests__/splitMessage.test.ts
import { computeBillTotal, type Surcharges } from '../src/lib/split';
import {
  buildBillReminder,
  buildGroupMessage,
  buildOwedReminder,
  buildPersonMessage,
  workingsFromReceipt,
  type OwedReminderInput,
  type SplitMessageInput,
} from '../src/lib/splitMessage';

function input(over: Partial<SplitMessageInput> = {}): SplitMessageInput {
  return {
    merchant: 'Line Clear',
    gross: 120,
    currency: 'MYR',
    method: 'equal',
    ownShare: 30,
    shares: [
      { personId: 'a', name: 'Ali', owed: 30 },
      { personId: 's', name: 'Siti', owed: 30 },
      { personId: 'j', name: 'Jun', owed: 30 },
    ],
    workings: null,
    isZh: false,
    ...over,
  };
}

/** Every amount the message quotes, as a number, so tests can assert the sum ties out. */
function amountsIn(message: string): number[] {
  return [...message.matchAll(/RM\s([\d,]+\.\d{2})/g)].map((m) => Number(m[1].replace(/,/g, '')));
}

describe('buildGroupMessage', () => {
  it('names the merchant and the total that was paid', () => {
    expect(buildGroupMessage(input())).toContain('Line Clear');
    expect(buildGroupMessage(input())).toContain('RM 120.00');
  });

  it('lists every person with the exact amount recorded against them', () => {
    const msg = buildGroupMessage(input());
    expect(msg).toMatch(/Ali: RM 30\.00/);
    expect(msg).toMatch(/Siti: RM 30\.00/);
    expect(msg).toMatch(/Jun: RM 30\.00/);
  });

  it('marks the payer\'s own line so the group can see who fronted the bill', () => {
    expect(buildGroupMessage(input())).toContain('Me (paid)');
  });

  it('omits the payer entirely when they were not on the bill', () => {
    const msg = buildGroupMessage(
      input({ ownShare: 0, shares: [{ personId: 'a', name: 'Ali', owed: 120 }] })
    );
    expect(msg).not.toContain('Me (paid)');
  });

  it('signs off with Pip and the viral referral link so friends discover the app', () => {
    const msg = buildGroupMessage(input());
    expect(msg).toContain('Split with Pip (Zero ads, 100% private):');
    expect(msg).toContain('https://pipfinance.app');
  });

  it('includes DuitNow payment instructions when hasDuitNowQr is true', () => {
    const withQr = buildGroupMessage(input({ hasDuitNowQr: true }));
    expect(withQr).toContain('Pay me via DuitNow:');
    expect(withQr).toContain('Scan the attached DuitNow QR code to pay');

    const withoutQr = buildGroupMessage(input({ hasDuitNowQr: false }));
    expect(withoutQr).not.toContain('Pay me via DuitNow');
  });

  it('translates DuitNow payment instructions and referral link in Chinese', () => {
    const msg = buildGroupMessage(input({ hasDuitNowQr: true, isZh: true }));
    expect(msg).toContain('使用 DuitNow 付款：');
    expect(msg).toContain('请扫描附带的 DuitNow 二维码付款');
    expect(msg).toContain('由 Pip 分摊（零广告，100% 本地隐私）：');
    expect(msg).toContain('https://pipfinance.app');
  });

  describe('the workings line', () => {
    it('shows the division for an equal split', () => {
      expect(buildGroupMessage(input())).toContain('RM 120.00 ÷ 4 people = RM 30.00 each');
    });

    it('shows the portion rate for a shares split', () => {
      const msg = buildGroupMessage(
        input({
          method: 'shares',
          ownShare: 24,
          shares: [
            { personId: 'a', name: 'Ali', owed: 48, portions: 2 },
            { personId: 's', name: 'Siti', owed: 24, portions: 1 },
            { personId: 'j', name: 'Jun', owed: 24, portions: 1 },
          ],
          selfPortions: 1,
        })
      );
      expect(msg).toContain('RM 120.00 across 5 portions = RM 24.00 per portion');
      expect(msg).toContain('2 portions');
    });

    it('shows no portion rate when the portions could not be recovered', () => {
      // A saved 'shares' split persists only the amounts, so portions have to be recovered by
      // replay and that can fail. Defaulting every share to one portion would print a portion
      // count the table never agreed to.
      const msg = buildGroupMessage(
        input({
          method: 'shares',
          ownShare: 24,
          shares: [
            { personId: 'a', name: 'Ali', owed: 48 },
            { personId: 's', name: 'Siti', owed: 24 },
            { personId: 'j', name: 'Jun', owed: 24 },
          ],
        })
      );
      expect(msg).not.toContain('portions =');
      expect(msg).toMatch(/Ali: RM 48\.00/);
    });

    it('says the amounts were entered by hand for an exact split', () => {
      const msg = buildGroupMessage(
        input({
          method: 'exact',
          ownShare: 60,
          shares: [{ personId: 'a', name: 'Ali', owed: 60 }],
        })
      );
      expect(msg).toContain('Amounts entered by hand');
      expect(msg).not.toContain('÷');
    });

    it('breaks out items, service charge and tax for an itemized split', () => {
      const msg = buildGroupMessage(
        input({
          method: 'itemized',
          workings: { subtotal: 102.56, serviceChargePct: 10, serviceCharge: 10.26, taxPct: 6, tax: 7.18, discount: null },
        })
      );
      expect(msg).toContain('Items');
      expect(msg).toContain('RM 102.56');
      expect(msg).toContain('Service charge 10%');
      expect(msg).toContain('RM 10.26');
      expect(msg).toContain('SST 6%');
      expect(msg).toContain('RM 7.18');
    });

    it('shows a discount as a subtraction when the bill had one', () => {
      const msg = buildGroupMessage(
        input({
          method: 'itemized',
          workings: { subtotal: 102.56, serviceChargePct: 10, serviceCharge: 10.26, taxPct: 6, tax: 7.18, discount: 1.82 },
        })
      );
      expect(msg).toContain('Discount');
      expect(msg).toContain('−RM 1.82');
    });

    it('leaves out a surcharge the bill never had rather than printing a zero', () => {
      const msg = buildGroupMessage(
        input({
          method: 'itemized',
          workings: { subtotal: 120, serviceChargePct: 0, serviceCharge: 0, taxPct: 0, tax: 0, discount: null },
        })
      );
      expect(msg).not.toContain('Service charge');
      expect(msg).not.toContain('SST');
    });
  });

  describe('the numbers always tie out', () => {
    it('quotes per-person amounts that sum to exactly what was paid', () => {
      // A total that does not divide evenly: computeSplit floors each friend and gives the
      // payer the remainder, so a naive "÷ 3 = RM 40.01 each" would overstate what two of
      // them owe. The listed amounts must be the recorded ones.
      const msg = buildGroupMessage(
        input({
          gross: 120.01,
          ownShare: 40.03,
          shares: [
            { personId: 'a', name: 'Ali', owed: 39.99 },
            { personId: 's', name: 'Siti', owed: 39.99 },
          ],
        })
      );
      const listed = amountsIn(msg).filter((n) => n !== 120.01);
      expect(listed.reduce((s, n) => s + n, 0)).toBeCloseTo(120.01, 2);
    });

    it('never claims a clean division when the split did not divide cleanly', () => {
      const msg = buildGroupMessage(
        input({
          gross: 120.01,
          ownShare: 40.03,
          shares: [
            { personId: 'a', name: 'Ali', owed: 39.99 },
            { personId: 's', name: 'Siti', owed: 39.99 },
          ],
        })
      );
      expect(msg).not.toContain('each');
    });
  });

  it('writes the whole message in Chinese when the app is in Chinese', () => {
    const msg = buildGroupMessage(input({ isZh: true }));
    expect(msg).toContain('已付');
    expect(msg).not.toContain('Me (paid)');
  });
});

describe('buildPersonMessage', () => {
  it('greets the person by name and states only their share', () => {
    const msg = buildPersonMessage(input(), 'a');
    expect(msg).toContain('Ali');
    expect(msg).toContain('RM 30.00');
  });

  it('does not name the other people at the table', () => {
    const msg = buildPersonMessage(input(), 'a');
    expect(msg).not.toContain('Siti');
    expect(msg).not.toContain('Jun');
  });

  it('still shows the bill total so the share can be checked against it', () => {
    expect(buildPersonMessage(input(), 'a')).toContain('RM 120.00');
  });

  it('shows the surcharges that were added on top of their items', () => {
    const msg = buildPersonMessage(
      input({
        method: 'itemized',
        workings: { subtotal: 102.56, serviceChargePct: 10, serviceCharge: 10.26, taxPct: 6, tax: 7.18, discount: null },
      }),
      'a'
    );
    expect(msg).toContain('Service charge 10%');
    expect(msg).toContain('SST 6%');
  });

  it('returns null for someone who was not part of the split', () => {
    expect(buildPersonMessage(input(), 'nobody')).toBeNull();
  });

  it('writes the message in Chinese when the app is in Chinese', () => {
    const msg = buildPersonMessage(input({ isZh: true }), 'a');
    expect(msg).toContain('Ali');
    expect(msg).toContain('您应付');
  });
});

describe('workingsFromReceipt', () => {
  const lines = [{ amount: 60 }, { amount: 42.56 }]; // subtotal 102.56

  it('sums the line items into the subtotal', () => {
    const w = workingsFromReceipt(lines, { serviceChargePct: 10, taxPct: 6 });
    expect(w.subtotal).toBeCloseTo(102.56, 2);
  });

  it('charges service on the subtotal and tax on the subtotal plus service', () => {
    const w = workingsFromReceipt(lines, { serviceChargePct: 10, taxPct: 6 });
    expect(w.serviceCharge).toBeCloseTo(10.26, 2);
    expect(w.tax).toBeCloseTo(6.77, 2); // 6% of 112.82, not of 102.56
  });

  it('reports no discount when the bill had none', () => {
    expect(workingsFromReceipt(lines, { serviceChargePct: 10, taxPct: 6 }).discount).toBeNull();
  });

  it('reports a percentage discount as the ringgit it actually took off', () => {
    const w = workingsFromReceipt(lines, {
      serviceChargePct: 10,
      taxPct: 6,
      discount: { unit: 'pct', value: 5, timing: 'after' },
    });
    expect(w.discount).toBeCloseTo(5.98, 2); // 5% of the 119.59 gross
  });

  it('charges service and tax on the reduced base when the voucher came off first', () => {
    const before: Surcharges = {
      serviceChargePct: 10,
      taxPct: 6,
      discount: { unit: 'amount', value: 10, timing: 'before' },
    };
    const w = workingsFromReceipt(lines, before);
    expect(w.serviceCharge).toBeCloseTo(9.26, 2); // 10% of 92.56, not of 102.56
    expect(w.discount).toBeCloseTo(10, 2);
  });

  describe('the breakdown always reconciles to the bill total', () => {
    const cases: { name: string; surcharges: Surcharges }[] = [
      { name: 'service and tax', surcharges: { serviceChargePct: 10, taxPct: 6 } },
      { name: 'no surcharges at all', surcharges: { serviceChargePct: 0, taxPct: 0 } },
      { name: 'tax only', surcharges: { serviceChargePct: 0, taxPct: 8 } },
      {
        name: 'a voucher off the top',
        surcharges: { serviceChargePct: 10, taxPct: 6, discount: { unit: 'amount', value: 10, timing: 'before' } },
      },
      {
        name: 'a percentage off the total',
        surcharges: { serviceChargePct: 10, taxPct: 6, discount: { unit: 'pct', value: 5, timing: 'after' } },
      },
    ];

    it.each(cases)('subtotal + service + tax − discount equals the bill total ($name)', ({ surcharges }) => {
      const w = workingsFromReceipt(lines, surcharges);
      const rebuilt = w.subtotal + w.serviceCharge + w.tax - (w.discount ?? 0);
      expect(rebuilt).toBeCloseTo(computeBillTotal(lines, surcharges), 2);
    });
  });
});

function owed(over: Partial<OwedReminderInput> = {}): OwedReminderInput {
  return {
    personName: 'fyy',
    currency: 'MYR',
    total: 37.29,
    bills: [
      { shareId: '1', merchant: 'THE ML KITCHEN (SEPANG) SDN BHD', billDate: '2026-09-02', outstanding: 17.29 },
      { shareId: '2', merchant: 'Food', billDate: '2026-09-03', outstanding: 10 },
      { shareId: '3', merchant: 'Food', billDate: '2026-09-03', outstanding: 10 },
    ],
    isZh: false,
    ...over,
  };
}

describe('buildOwedReminder', () => {
  it('greets the person who owes the money', () => {
    expect(buildOwedReminder(owed())).toContain('fyy');
  });

  it('states how many bills are open and what they come to', () => {
    const msg = buildOwedReminder(owed());
    expect(msg).toContain('3 open bills');
    expect(msg).toContain('RM 37.29');
  });

  it('says "bill" rather than "bills" for a single outstanding bill', () => {
    const msg = buildOwedReminder(
      owed({ total: 17.29, bills: [owed().bills[0]] })
    );
    expect(msg).toContain('1 open bill');
    expect(msg).not.toContain('open bills');
  });

  it('lists every bill with its date and what is still outstanding', () => {
    const msg = buildOwedReminder(owed());
    expect(msg).toContain('THE ML KITCHEN (SEPANG) SDN BHD, 2 Sep: RM 17.29');
    expect(msg.match(/Food, 3 Sep: RM 10\.00/g)).toHaveLength(2);
  });

  it('quotes bill amounts that sum to the total shown on screen', () => {
    const msg = buildOwedReminder(owed());
    const listed = amountsIn(msg).filter((n) => n !== 37.29);
    expect(listed.reduce((s, n) => s + n, 0)).toBeCloseTo(37.29, 2);
  });

  it('asks only for what is left on a part-paid bill, and says it is part-paid', () => {
    const msg = buildOwedReminder(
      owed({
        total: 10,
        bills: [{ shareId: '1', merchant: 'Food', billDate: '2026-09-03', outstanding: 10, paid: 10 }],
      })
    );
    expect(msg).toContain('RM 10.00');
    expect(msg).toContain('part-paid');
    expect(msg).not.toContain('RM 20.00');
  });

  it('leaves out the date for a bill that never had one', () => {
    const msg = buildOwedReminder(
      owed({ total: 10, bills: [{ shareId: '1', merchant: 'Food', billDate: null, outstanding: 10 }] })
    );
    expect(msg).toContain('Food: RM 10.00');
    expect(msg).not.toContain(', :');
  });

  it('names nobody except the person being chased', () => {
    expect(buildOwedReminder(owed())).not.toContain('Ali');
  });

  it('signs off as Pip', () => {
    expect(buildOwedReminder(owed())).toContain('Pip');
  });

  it('writes the reminder in Chinese when the app is in Chinese', () => {
    const msg = buildOwedReminder(owed({ isZh: true }));
    expect(msg).toContain('fyy');
    expect(msg).toContain('尚未结清');
  });
});

describe('buildBillReminder', () => {
  it('names the bill, its date, and what is still owed', () => {
    const msg = buildBillReminder(owed(), '1');
    expect(msg).toContain('THE ML KITCHEN (SEPANG) SDN BHD');
    expect(msg).toContain('2 Sep');
    expect(msg).toContain('RM 17.29');
  });

  it('does not mention the person\'s other bills', () => {
    const msg = buildBillReminder(owed(), '1')!;
    expect(msg).not.toContain('RM 37.29');
    expect(msg).not.toContain('RM 10.00');
  });

  it('returns null for a bill that is not one of theirs', () => {
    expect(buildBillReminder(owed(), 'nope')).toBeNull();
  });

  it('writes the reminder in Chinese when the app is in Chinese', () => {
    expect(buildBillReminder(owed({ isZh: true }), '1')).toContain('尚欠');
  });
});
