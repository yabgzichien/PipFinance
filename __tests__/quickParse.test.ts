import { MAX_SEGMENTS, parseQuickText, type QuickParseOptions } from '../src/lib/quickParse';

const opts: QuickParseOptions = { activeCurrencies: ['MYR', 'USD'], today: '2026-08-28' };

describe('parseQuickText — amounts', () => {
  it('reads a plain decimal and keeps the label', () => {
    const r = parseQuickText('lunch 9.2', opts);
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0].amount).toBe(9.2);
    expect(r.drafts[0].label).toBe('lunch');
    expect(r.confident).toBe(true);
  });

  it('reads a leading amount', () => {
    expect(parseQuickText('9.20 lunch', opts).drafts[0]).toMatchObject({ amount: 9.2, label: 'lunch' });
  });

  it('strips an rm prefix from the amount and the label', () => {
    expect(parseQuickText('rm9.20 lunch', opts).drafts[0]).toMatchObject({ amount: 9.2, label: 'lunch' });
  });

  it('strips a currency symbol without inferring a currency from it', () => {
    const d = parseQuickText('$20 dinner', opts).drafts[0];
    expect(d.amount).toBe(20);
    expect(d.label).toBe('dinner');
    expect(d.currency).toBeNull();
  });

  it('treats a comma before two digits as a decimal point', () => {
    expect(parseQuickText('lunch 12,50', opts).drafts[0].amount).toBe(12.5);
  });

  it('treats a comma before three digits as a thousands separator', () => {
    expect(parseQuickText('rent 1,200', opts).drafts[0].amount).toBe(1200);
    expect(parseQuickText('rent 1,200.50', opts).drafts[0].amount).toBe(1200.5);
  });

  it('returns no drafts when there is no amount at all', () => {
    expect(parseQuickText('lunch', opts).drafts).toEqual([]);
  });

  it('is not confident when a segment holds two amounts', () => {
    expect(parseQuickText('lunch 9.2 and 4', opts).confident).toBe(false);
  });

  it('is not confident when the label is empty', () => {
    const r = parseQuickText('9.2', opts);
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0].label).toBe('');
    expect(r.confident).toBe(false);
  });
});

describe('parseQuickText — type', () => {
  it('defaults to expense', () => {
    expect(parseQuickText('lunch 9.2', opts).drafts[0].type).toBe('expense');
  });

  it('flips to income on an English keyword', () => {
    expect(parseQuickText('salary 4200', opts).drafts[0].type).toBe('income');
    expect(parseQuickText('refund 30', opts).drafts[0].type).toBe('income');
  });

  it('flips to income on a Chinese keyword', () => {
    expect(parseQuickText('工资 4200', opts).drafts[0].type).toBe('income');
  });
});

describe('parseQuickText — currency', () => {
  it('reads an active 3-letter code and drops it from the label', () => {
    const d = parseQuickText('usd 20 dinner', opts).drafts[0];
    expect(d.currency).toBe('USD');
    expect(d.label).toBe('dinner');
  });

  it('ignores a code the user has not activated', () => {
    const d = parseQuickText('jpy 900 ramen', opts).drafts[0];
    expect(d.currency).toBeNull();
  });

  it('reads rm as the base currency', () => {
    expect(parseQuickText('rm 9.20 lunch', opts).drafts[0].currency).toBe('MYR');
  });
});

describe('parseQuickText — dates', () => {
  it('leaves date null when nothing is said', () => {
    expect(parseQuickText('lunch 9.2', opts).drafts[0].date).toBeNull();
  });

  it('reads yesterday and drops it from the label', () => {
    const d = parseQuickText('lunch 9.2 yesterday', opts).drafts[0];
    expect(d.date).toBe('2026-08-27');
    expect(d.label).toBe('lunch');
  });

  it('reads today', () => {
    expect(parseQuickText('lunch 9.2 today', opts).drafts[0].date).toBe('2026-08-28');
  });

  it('reads Chinese date words', () => {
    expect(parseQuickText('午餐 9.2 昨天', opts).drafts[0].date).toBe('2026-08-27');
    expect(parseQuickText('午餐 9.2 今天', opts).drafts[0].date).toBe('2026-08-28');
  });

  it('reads a weekday name as the most recent past occurrence', () => {
    // 2026-08-28 is a Friday; the most recent Wednesday before it is 2026-08-26.
    expect(parseQuickText('lunch 9.2 wednesday', opts).drafts[0].date).toBe('2026-08-26');
  });

  it('treats a weekday naming today as today', () => {
    expect(parseQuickText('lunch 9.2 friday', opts).drafts[0].date).toBe('2026-08-28');
  });
});

describe('parseQuickText — segments', () => {
  it('splits on commas', () => {
    const r = parseQuickText('lunch 9.2, grab 12, coffee 5', opts);
    expect(r.drafts.map((d) => d.label)).toEqual(['lunch', 'grab', 'coffee']);
    expect(r.drafts.map((d) => d.amount)).toEqual([9.2, 12, 5]);
  });

  it('splits on semicolons, newlines, and Chinese punctuation', () => {
    expect(parseQuickText('lunch 9.2; grab 12', opts).drafts).toHaveLength(2);
    expect(parseQuickText('lunch 9.2\ngrab 12', opts).drafts).toHaveLength(2);
    expect(parseQuickText('午餐 9.2、打车 12', opts).drafts).toHaveLength(2);
  });

  it('does not split a decimal comma into two segments', () => {
    expect(parseQuickText('lunch 12,50', opts).drafts).toHaveLength(1);
  });

  it('caps the number of segments', () => {
    const many = Array.from({ length: MAX_SEGMENTS + 5 }, (_, i) => `item${i} ${i + 1}`).join(', ');
    expect(parseQuickText(many, opts).drafts).toHaveLength(MAX_SEGMENTS);
  });

  it('returns an empty, confident-free result for blank input', () => {
    expect(parseQuickText('   ', opts)).toEqual({ drafts: [], confident: false });
  });

  it('always leaves categoryId null — this parser never categorises', () => {
    expect(parseQuickText('lunch 9.2', opts).drafts[0].categoryId).toBeNull();
  });
});
