import { ALL_SEED_CATEGORIES } from '../src/data/categories';
import { predictMerchantCategory, tokenizeClassifierText } from '../src/lib/merchantClassifier';
import type { Category } from '../src/lib/types';

describe('Merchant Statistical Classifier', () => {
  const categories = ALL_SEED_CATEGORIES as unknown as Category[];

  it('tokenizes words, edge prefix/suffix tokens, character n-grams, and CJK bigrams correctly', () => {
    const tokens = tokenizeClassifierText('Starbucks 咖啡');
    expect(tokens).toContain('w:starbucks');
    expect(tokens).toContain('^sta');
    expect(tokens).toContain('^star');
    expect(tokens).toContain('cks$');
    expect(tokens).toContain('ucks$');
    expect(tokens).toContain('#sta');
    expect(tokens).toContain('#star');
    expect(tokens).toContain('cjk:咖');
    expect(tokens).toContain('cjk:啡');
    expect(tokens).toContain('cjk2:咖啡');
  });

  it('correctly classifies classic merchant names offline', () => {
    const p1 = predictMerchantCategory('SS2 Dobi Queen', 'expense', categories);
    expect(p1?.categoryId).toBe('other');
    expect(p1?.confidence).toBeGreaterThanOrEqual(0.7);

    const p2 = predictMerchantCategory('Starbucks cold brew', 'expense', categories);
    expect(p2?.categoryId).toBe('food');

    const p3 = predictMerchantCategory('TNB electricity bill', 'expense', categories);
    expect(p3?.categoryId).toBe('utilities');

    const p4 = predictMerchantCategory('GSC IMAX ticket', 'expense', categories);
    expect(p4?.categoryId).toBe('entertainment');

    const p5 = predictMerchantCategory('AirAsia flight', 'expense', categories);
    expect(p5?.categoryId).toBe('travelling');

    const p6 = predictMerchantCategory('Shopee checkout parcel', 'expense', categories);
    expect(p6?.categoryId).toBe('shopping');

    const p7 = predictMerchantCategory('Prudential medical card', 'expense', categories);
    expect(p7?.categoryId).toBe('insurance');

    const p8 = predictMerchantCategory('Maxis home fibre', 'expense', categories);
    expect(p8?.categoryId).toBe('phone-bill');

    const p9 = predictMerchantCategory('Netflix monthly subscription', 'expense', categories);
    expect(p9?.categoryId).toBe('subscriptions');
  });

  it('is resilient to typos via edge tokens and sub-word character n-grams', () => {
    // "luch" (typo for lunch)
    const pLuch = predictMerchantCategory('luch', 'expense', categories);
    expect(pLuch?.categoryId).toBe('food');

    // "diner" (typo for dinner)
    const pDiner = predictMerchantCategory('diner', 'expense', categories);
    expect(pDiner?.categoryId).toBe('food');

    // "brekfast" (typo for breakfast)
    const pBrek = predictMerchantCategory('brekfast', 'expense', categories);
    expect(pBrek?.categoryId).toBe('food');

    // "petro" (typo for petrol)
    const pPetro = predictMerchantCategory('petro', 'expense', categories);
    expect(pPetro?.categoryId).toBe('travelling');

    // "salry" (typo for salary)
    const pSalry = predictMerchantCategory('salry', 'income', categories);
    expect(pSalry?.categoryId).toBe('salary');

    // "strbucks" (missing 'a') matches ^str, cks$, #tar, #arbu, #rbuc, #buck
    const p1 = predictMerchantCategory('strbucks', 'expense', categories);
    expect(p1?.categoryId).toBe('food');

    // "lauundry" (extra 'u') matches #lau, #aun, #und
    const p2 = predictMerchantCategory('lauundry bar', 'expense', categories);
    expect(p2?.categoryId).toBe('other');
  });

  it('correctly classifies Chinese merchant phrases', () => {
    const p1 = predictMerchantCategory('海底捞火锅', 'expense', categories);
    expect(p1?.categoryId).toBe('food');

    const p2 = predictMerchantCategory('投币洗衣店', 'expense', categories);
    expect(p2?.categoryId).toBe('other');

    const p3 = predictMerchantCategory('轻快铁车票', 'expense', categories);
    expect(p3?.categoryId).toBe('travelling');

    const p4 = predictMerchantCategory('诊所看医生', 'expense', categories);
    expect(p4?.categoryId).toBe('medical');
  });

  it('respects transaction kind (income vs expense)', () => {
    const incomePred = predictMerchantCategory('Monthly salary Maybank', 'income', categories);
    expect(incomePred?.categoryId).toBe('salary');

    const dividendPred = predictMerchantCategory('Maybank share dividend', 'income', categories);
    expect(dividendPred?.categoryId).toBe('other-income');

    const allowancePred = predictMerchantCategory('Sumbangan Tunai Rahmah STR', 'income', categories);
    expect(allowancePred?.categoryId).toBe('allowance');
  });

  it('runs inference in less than 1 millisecond', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      predictMerchantCategory('Dobi Queen 24h wash', 'expense', categories);
    }
    const elapsed = (performance.now() - start) / 50;
    expect(elapsed).toBeLessThan(1.0); // < 1ms per inference
  });
});
