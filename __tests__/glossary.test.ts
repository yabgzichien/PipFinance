import { GLOSSARY, type GlossaryEntry } from '../src/lib/glossary';

describe('GLOSSARY', () => {
  it('contains valid entries with non-empty term, short, and body', () => {
    const keys = Object.keys(GLOSSARY);
    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      const entry: GlossaryEntry = GLOSSARY[key];
      expect(entry).toBeDefined();
      expect(typeof entry.term).toBe('string');
      expect(entry.term.trim().length).toBeGreaterThan(0);
      expect(typeof entry.short).toBe('string');
      expect(entry.short.trim().length).toBeGreaterThan(0);
      expect(typeof entry.body).toBe('string');
      expect(entry.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains split_bill with a concise tutorial on how to use split bill', () => {
    const splitBill = GLOSSARY['split_bill'];
    expect(splitBill).toBeDefined();
    expect(splitBill.term).toBe('Split bill');
    expect(splitBill.short).toContain('Divide a shared bill');
    expect(splitBill.body).toContain('Equal, Shares, or Exact');
    expect(splitBill.body).toContain('I was on this bill too');
    expect(splitBill.body).toContain('Owed to you');
  });
});
