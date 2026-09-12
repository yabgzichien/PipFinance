import { compactAmt } from '../src/lib/format';

describe('compactAmt', () => {
  it('returns empty string for 0', () => {
    expect(compactAmt(0)).toBe('');
  });

  it('keeps clean whole numbers as integers without redundant .00', () => {
    expect(compactAmt(10, 'MYR')).toBe('10');
    expect(compactAmt(20, 'MYR')).toBe('20');
    expect(compactAmt(30, 'MYR')).toBe('30');
    expect(compactAmt(25, 'MYR')).toBe('25');
  });

  it('formats fractional amounts with 2 decimals for currencies with 2 decimals', () => {
    expect(compactAmt(23.5, 'MYR')).toBe('23.50');
    expect(compactAmt(13.5, 'MYR')).toBe('13.50');
    expect(compactAmt(23.55, 'MYR')).toBe('23.55');
    expect(compactAmt(0.5, 'MYR')).toBe('0.50');
  });

  it('abbreviates amounts >= 1000 with K suffix without trailing zeros', () => {
    expect(compactAmt(1000, 'MYR')).toBe('1K');
    expect(compactAmt(1500, 'MYR')).toBe('1.5K');
    expect(compactAmt(7100, 'MYR')).toBe('7.1K');
  });

  it('respects zero-subunit currencies like JPY', () => {
    expect(compactAmt(20.5, 'JPY')).toBe('21');
    expect(compactAmt(100, 'JPY')).toBe('100');
  });
});
