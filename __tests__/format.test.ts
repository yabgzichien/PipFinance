import { fmt, fmtCompact, fmtMoney, readTimeLabel } from '../src/lib/format';

describe('fmtCompact', () => {
  it('matches fmt exactly under the 100K threshold', () => {
    expect(fmtCompact(85)).toBe(fmt(85));
    expect(fmtCompact(3000)).toBe(fmt(3000));
    expect(fmtCompact(99_999.99)).toBe(fmt(99_999.99));
  });

  it('abbreviates to K from 100,000', () => {
    expect(fmtCompact(100_000)).toBe('100K');
    expect(fmtCompact(123_456)).toBe('123.5K');
  });

  it('abbreviates to M from 1,000,000', () => {
    expect(fmtCompact(1_000_000)).toBe('1M');
    expect(fmtCompact(2_345_678)).toBe('2.3M');
  });

  it('bumps a K value that rounds up to 1000 into M instead', () => {
    expect(fmtCompact(999_950)).toBe('1M');
  });

  it('preserves the negative sign', () => {
    expect(fmtCompact(-123_456)).toBe('-123.5K');
    expect(fmtCompact(-2_000_000)).toBe('-2M');
  });

  it('falls back to 0 for non-finite input, same as fmt', () => {
    expect(fmtCompact(NaN)).toBe(fmt(NaN));
    expect(fmtCompact(Infinity)).toBe(fmt(Infinity));
  });
});

describe('readTimeLabel', () => {
  it('rounds to the nearest second', () => {
    expect(readTimeLabel(5_800)).toBe('Read in 6 seconds');
    expect(readTimeLabel(5_400)).toBe('Read in 5 seconds');
  });

  it('pluralizes correctly at exactly one second', () => {
    expect(readTimeLabel(1_000)).toBe('Read in 1 second');
    expect(readTimeLabel(1_400)).toBe('Read in 1 second');
  });

  it('floors sub-second reads at 1 second rather than claiming 0', () => {
    expect(readTimeLabel(300)).toBe('Read in 1 second');
    expect(readTimeLabel(0)).toBe('Read in 1 second');
  });

  it('shows the true elapsed time for a long extraction, uncapped', () => {
    expect(readTimeLabel(22_000)).toBe('Read in 22 seconds');
  });
});

describe('fmtMoney', () => {
  it('uses the RM convention for ringgit rather than the code', () => {
    expect(fmtMoney(128, 'MYR')).toBe('RM 128.00');
    expect(fmtMoney(1234.5, 'MYR')).toBe('RM 1,234.50');
  });

  it('uses the 3-letter code for everything else, never a symbol', () => {
    expect(fmtMoney(128, 'CNY')).toBe('CNY 128.00');
    expect(fmtMoney(1234.5, 'USD')).toBe('USD 1,234.50');
  });

  it('drops decimals for zero-subunit currencies', () => {
    expect(fmtMoney(1200, 'JPY')).toBe('JPY 1,200');
    expect(fmtMoney(45000, 'KRW')).toBe('KRW 45,000');
  });

  it('rounds rather than truncates a zero-decimal currency', () => {
    expect(fmtMoney(1200.6, 'JPY')).toBe('JPY 1,201');
  });

  it('keeps the negative sign in front of the number, after the code', () => {
    expect(fmtMoney(-128, 'CNY')).toBe('CNY -128.00');
    expect(fmtMoney(-128, 'MYR')).toBe('RM -128.00');
  });

  it('agrees with fmt for MYR amounts, so existing RM labels stay consistent', () => {
    expect(fmtMoney(1234.5, 'MYR')).toBe(`RM ${fmt(1234.5)}`);
  });

  it('falls back to 0 for non-finite input, same as fmt', () => {
    expect(fmtMoney(NaN, 'MYR')).toBe('RM 0.00');
  });
});
