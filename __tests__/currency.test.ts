// __tests__/currency.test.ts
import { BASE_CURRENCY, SUPPORTED_CURRENCIES, currencyMeta, decimalsFor } from '../src/lib/currencies';
import { round2, deriveMyr, parseActiveCurrencies, isMultiCurrency } from '../src/lib/currency';

describe('currency table', () => {
  it('has MYR as the base and lists it first', () => {
    expect(BASE_CURRENCY).toBe('MYR');
    expect(SUPPORTED_CURRENCIES[0].code).toBe('MYR');
  });

  it('has no duplicate codes', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('marks the zero-subunit currencies as 0 decimals', () => {
    for (const code of ['JPY', 'KRW', 'VND', 'IDR', 'KHR', 'LAK', 'MMK']) {
      expect(decimalsFor(code)).toBe(0);
    }
  });

  it('defaults an unknown code to 2 decimals rather than throwing', () => {
    expect(decimalsFor('ZZZ')).toBe(2);
    expect(currencyMeta('ZZZ')).toBeNull();
  });
});

describe('round2', () => {
  it('rounds to two decimal places', () => {
    expect(round2(80.6412)).toBe(80.64);
    expect(round2(80.6456)).toBe(80.65);
  });

  it('kills float artifacts', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });

  it('returns 0 for non-finite input', () => {
    expect(round2(NaN)).toBe(0);
    expect(round2(Infinity)).toBe(0);
  });
});

describe('deriveMyr', () => {
  it('leaves a MYR amount completely alone', () => {
    expect(deriveMyr(128, 'MYR', null)).toEqual({ amount: 128, nativeAmount: null, fxRate: null });
  });

  it('ignores a supplied rate when the currency is MYR', () => {
    expect(deriveMyr(128, 'MYR', 0.63)).toEqual({ amount: 128, nativeAmount: null, fxRate: null });
  });

  it('converts a foreign amount and keeps the native figure', () => {
    expect(deriveMyr(128, 'CNY', 0.63)).toEqual({ amount: 80.64, nativeAmount: 128, fxRate: 0.63 });
  });

  it('rounds the MYR amount to 2dp exactly once', () => {
    expect(deriveMyr(21.5, 'CNY', 0.6321)).toEqual({ amount: 13.59, nativeAmount: 21.5, fxRate: 0.6321 });
  });

  it('throws on a foreign currency with no rate rather than assuming parity', () => {
    expect(() => deriveMyr(128, 'CNY', null)).toThrow(/rate/i);
  });

  it('throws on a non-positive rate', () => {
    expect(() => deriveMyr(128, 'CNY', 0)).toThrow(/rate/i);
  });
});

describe('parseActiveCurrencies', () => {
  it('defaults to MYR only when nothing is stored', () => {
    expect(parseActiveCurrencies(null)).toEqual(['MYR']);
  });

  it('defaults to MYR only on malformed JSON', () => {
    expect(parseActiveCurrencies('{not json')).toEqual(['MYR']);
  });

  it('always includes MYR even if it was somehow saved without it', () => {
    expect(parseActiveCurrencies('["CNY"]')).toEqual(['MYR', 'CNY']);
  });

  it('drops unsupported codes', () => {
    expect(parseActiveCurrencies('["MYR","CNY","ZZZ"]')).toEqual(['MYR', 'CNY']);
  });

  it('deduplicates', () => {
    expect(parseActiveCurrencies('["MYR","CNY","CNY"]')).toEqual(['MYR', 'CNY']);
  });
});

describe('isMultiCurrency', () => {
  it('is false for a MYR-only user, which is what hides the entire feature', () => {
    expect(isMultiCurrency(['MYR'])).toBe(false);
  });

  it('is true once a second currency is active', () => {
    expect(isMultiCurrency(['MYR', 'CNY'])).toBe(true);
  });
});
