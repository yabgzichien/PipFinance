// __tests__/import.test.ts
import {
  docKindFromMime,
  docxXmlToText,
  matchSourceCategory,
  assignImported,
  applyDedup,
  detectSourceVocabulary,
  pendingLabel,
  resolvePending,
  PENDING_CAT,
} from '../src/lib/import';
import { DEFAULT_EXPENSE_ID, DEFAULT_INCOME_ID, EXPENSE_CATEGORIES } from '../src/data/categories';
import { DROP, type Category, type ExtractedTxn, type MemoryMap, type Transaction } from '../src/lib/types';

function cat(over: Partial<Category>): Category {
  return { id: 'dining', label: 'Dining', icon: 'utensils', hue: 20, kind: 'expense', isDefault: false, ...over };
}

function item(over: Partial<ExtractedTxn>): ExtractedTxn {
  return { merchant: 'Starbucks', amount: 12, type: 'expense', date: '2026-05-01', method: null, currency: 'MYR', ...over };
}

describe('docKindFromMime', () => {
  it('routes PDFs and images to the binary (vision) path', () => {
    expect(docKindFromMime('application/pdf', 'statement.pdf')).toBe('binary');
    expect(docKindFromMime('image/png', 'shot.png')).toBe('binary');
    expect(docKindFromMime('image/jpeg', 'a.jpg')).toBe('binary');
  });
  it('routes CSV by mime or extension', () => {
    expect(docKindFromMime('text/csv', 'x.csv')).toBe('csv');
    expect(docKindFromMime('application/octet-stream', 'export.csv')).toBe('csv');
  });
  it('routes Excel and Word by mime or extension', () => {
    expect(docKindFromMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'b.xlsx')).toBe('xlsx');
    expect(docKindFromMime('application/octet-stream', 'old.xls')).toBe('xlsx');
    expect(docKindFromMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'c.docx')).toBe('docx');
  });
  it('returns unsupported for unknown types', () => {
    expect(docKindFromMime('application/zip', 'a.zip')).toBe('unsupported');
  });
});

describe('docxXmlToText', () => {
  it('turns paragraphs into lines and strips tags + entities', () => {
    const xml =
      '<w:document><w:body>' +
      '<w:p><w:r><w:t>Tesco &amp; Co</w:t></w:r><w:r><w:t> 25.40</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Salary</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    expect(docxXmlToText(xml)).toBe('Tesco & Co 25.40\nSalary');
  });
});

describe('matchSourceCategory', () => {
  const cats = [cat({ id: 'dining', label: 'Dining', kind: 'expense' }), cat({ id: 'salary', label: 'Salary', kind: 'income' })];
  it('matches a hint to a category of the right kind, case-insensitively', () => {
    expect(matchSourceCategory('dining', cats, 'expense')).toBe('dining');
    expect(matchSourceCategory('  SALARY ', cats, 'income')).toBe('salary');
  });
  it('does not match across kinds, or unknown hints, or null', () => {
    expect(matchSourceCategory('dining', cats, 'income')).toBeNull();
    expect(matchSourceCategory('groceries', cats, 'expense')).toBeNull();
    expect(matchSourceCategory(null, cats, 'expense')).toBeNull();
  });
});

describe('assignImported', () => {
  const cats = [
    cat({ id: 'dining', label: 'Dining', kind: 'expense' }),
    cat({ id: 'groceries', label: 'Groceries', kind: 'expense' }),
    cat({ id: 'salary', label: 'Salary', kind: 'income' }),
  ];
  const catById: Record<string, Category> = Object.fromEntries(cats.map((c) => [c.id, c]));

  it('prefers learned memory when the kind matches', () => {
    const memory: MemoryMap = { starbucks: 'dining' };
    const out = assignImported([item({ merchant: 'Starbucks' })], memory, cats, catById);
    expect(out).toEqual(['dining']);
  });
  it('falls back to a matching source category hint', () => {
    const out = assignImported([item({ merchant: 'Unknown Shop', categoryHint: 'Groceries' })], {}, cats, catById);
    expect(out).toEqual(['groceries']);
  });
  it('correctly maps category hints when merchant is empty (e.g. from existing financial tracker)', () => {
    const out = assignImported([item({ merchant: '', categoryHint: 'Groceries' })], {}, cats, catById);
    expect(out).toEqual(['groceries']);
  });
  it('ignores a learned category whose kind mismatches the item, using the fallback', () => {
    const memory: MemoryMap = { acme: 'dining' }; // expense category on an income row
    const out = assignImported([item({ merchant: 'Acme', type: 'income' })], memory, cats, catById);
    expect(out).toEqual([DEFAULT_INCOME_ID]);
  });
  it('falls back to Other for an uncategorizable expense', () => {
    const out = assignImported([item({ merchant: 'Mystery', categoryHint: null })], {}, cats, catById);
    expect(out).toEqual([DEFAULT_EXPENSE_ID]);
  });
});

describe('detectSourceVocabulary', () => {
  const cats = [
    cat({ id: 'food', label: 'Food', kind: 'expense' }),
    cat({ id: 'other', label: 'Other Expenses', kind: 'expense' }),
    cat({ id: 'salary', label: 'Salary', kind: 'income' }),
  ];

  /** A tracker export: a handful of labels repeated over many rows. */
  function trackerRows(): ExtractedTxn[] {
    const spec: [string, number][] = [
      ['Food', 40], ['Other Expenses', 12], ['Toll', 10], ['fyy', 8], ['Fuel', 6],
    ];
    return spec.flatMap(([label, n]) =>
      Array.from({ length: n }, () => item({ merchant: '', categoryHint: label }))
    );
  }

  it('flags a tracker export whose few labels repeat over many rows', () => {
    expect(detectSourceVocabulary(trackerRows(), cats).isTracker).toBe(true);
  });

  it('does not flag a statement whose hints are varied free text', () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      item({ merchant: `Shop ${i}`, categoryHint: `some description ${i}` })
    );
    expect(detectSourceVocabulary(rows, cats).isTracker).toBe(false);
  });

  it('does not flag a handful of rows, where the ratio is meaningless', () => {
    const rows = [item({ categoryHint: 'Food' }), item({ categoryHint: 'Toll' })];
    expect(detectSourceVocabulary(rows, cats).isTracker).toBe(false);
  });

  it('resolves labels that already exist and marks the rest as new', () => {
    const { labels } = detectSourceVocabulary(trackerRows(), cats);
    const byLabel = Object.fromEntries(labels.map((l) => [l.label, l]));
    expect(byLabel['Food'].existingId).toBe('food');
    expect(byLabel['Other Expenses'].existingId).toBe('other');
    expect(byLabel['Toll'].existingId).toBeNull();
    expect(byLabel['Fuel'].existingId).toBeNull();
    expect(byLabel['fyy'].existingId).toBeNull();
  });

  it('does not let a keyword list claim a label the source defined', () => {
    // 'Toll' and 'Fuel' both hit the built-in travelling keyword list; in a
    // tracker export they must stay distinct categories of their own.
    const travelling = cat({ id: 'travelling', label: 'Travelling', kind: 'expense' });
    const { labels } = detectSourceVocabulary(trackerRows(), [...cats, travelling]);
    const byLabel = Object.fromEntries(labels.map((l) => [l.label, l]));
    expect(byLabel['Toll'].existingId).toBeNull();
    expect(byLabel['Fuel'].existingId).toBeNull();
  });

  it('reports one entry per label, using its most common casing', () => {
    const rows = [
      ...Array.from({ length: 20 }, () => item({ categoryHint: 'Entertainment' })),
      ...Array.from({ length: 2 }, () => item({ categoryHint: 'entertainment' })),
      ...Array.from({ length: 20 }, () => item({ categoryHint: 'Food' })),
    ];
    const { labels } = detectSourceVocabulary(rows, cats);
    expect(labels.map((l) => l.label).sort()).toEqual(['Entertainment', 'Food']);
    expect(labels.find((l) => l.label === 'Entertainment')!.count).toBe(22);
  });

  it('separates the same label used on expense and income rows', () => {
    const rows = [
      ...Array.from({ length: 10 }, () => item({ categoryHint: 'Refund', type: 'expense' })),
      ...Array.from({ length: 10 }, () => item({ categoryHint: 'Refund', type: 'income' })),
    ];
    const { labels } = detectSourceVocabulary(rows, cats);
    expect(labels.filter((l) => l.label === 'Refund').map((l) => l.kind).sort()).toEqual([
      'expense',
      'income',
    ]);
  });
});

describe('assignImported with a source vocabulary', () => {
  const cats = [
    cat({ id: 'food', label: 'Food', kind: 'expense' }),
    cat({ id: 'travelling', label: 'Travelling', kind: 'expense' }),
    cat({ id: 'other', label: 'Other Expenses', kind: 'expense' }),
  ];
  const catById: Record<string, Category> = Object.fromEntries(cats.map((c) => [c.id, c]));
  const rows = [
    item({ merchant: '', categoryHint: 'Food' }),
    item({ merchant: '', categoryHint: 'Toll' }),
    item({ merchant: '', categoryHint: 'Fuel' }),
    item({ merchant: '', categoryHint: 'fyy' }),
  ];

  it('keeps source labels instead of folding Toll and Fuel into Travelling', () => {
    const vocab = detectSourceVocabulary(rows, cats);
    const out = assignImported(rows, {}, cats, catById, vocab);
    expect(out).toEqual(['food', `${PENDING_CAT}Toll`, `${PENDING_CAT}Fuel`, `${PENDING_CAT}fyy`]);
  });

  it('falls back to keyword mapping when no vocabulary is passed', () => {
    const out = assignImported(rows, {}, cats, catById);
    expect(out).toEqual(['food', 'travelling', 'travelling', 'other']);
  });

  it('lets the source label beat a learned merchant memory', () => {
    // The user asked to keep the file's own categories, so the file wins.
    const withMerchant = [item({ merchant: 'Starbucks', categoryHint: 'Toll' })];
    const vocab = detectSourceVocabulary(rows, cats);
    const out = assignImported(withMerchant, { starbucks: 'food' }, cats, catById, vocab);
    expect(out).toEqual([`${PENDING_CAT}Toll`]);
  });

  it('still uses learned memory for a row the source did not label', () => {
    const unlabelled = [item({ merchant: 'Starbucks', categoryHint: null })];
    const vocab = detectSourceVocabulary(rows, cats);
    const out = assignImported(unlabelled, { starbucks: 'food' }, cats, catById, vocab);
    expect(out).toEqual(['food']);
  });
});

describe('pendingLabel / resolvePending', () => {
  it('reads the label back off a pending id, and ignores real ids', () => {
    expect(pendingLabel(`${PENDING_CAT}fyy`)).toBe('fyy');
    expect(pendingLabel('food')).toBeNull();
    expect(pendingLabel(DROP)).toBeNull();
    expect(pendingLabel(null)).toBeNull();
  });

  it('swaps pending ids for the real ones once the categories exist', () => {
    const assignments = [`${PENDING_CAT}Toll`, 'food', `${PENDING_CAT}fyy`, DROP];
    const out = resolvePending(assignments, { Toll: 'cat_9', fyy: 'cat_10' });
    expect(out).toEqual(['cat_9', 'food', 'cat_10', DROP]);
  });

  it('drops a row whose pending category was never created', () => {
    // The user unticked "fyy" in the confirm step, so nothing should be filed
    // under a category that does not exist.
    const out = resolvePending([`${PENDING_CAT}fyy`, 'food'], {});
    expect(out).toEqual([DROP, 'food']);
  });
});

describe('the JinQuan tracker case, against the real seed categories', () => {
  const cats: Category[] = EXPENSE_CATEGORIES.map((c) => ({ ...c, isDefault: true }));
  const catById: Record<string, Category> = Object.fromEntries(cats.map((c) => [c.id, c]));

  // The real label mix from the 2026 workbook: 397 rows over 7 spellings.
  const spec: [string, number][] = [
    ['Food', 209], ['Other Expenses', 55], ['Toll', 51], ['fyy', 41],
    ['Entertainment', 29], ['Fuel', 10], ['entertainment', 2],
  ];
  const rows: ExtractedTxn[] = spec.flatMap(([label, n]) =>
    Array.from({ length: n }, () => item({ merchant: '', categoryHint: label }))
  );

  it('recognises the workbook as a tracker', () => {
    expect(detectSourceVocabulary(rows, cats).isTracker).toBe(true);
  });

  it('keeps Toll, Fuel and fyy as their own categories instead of merging them', () => {
    const vocab = detectSourceVocabulary(rows, cats);
    const assignments = assignImported(rows, {}, cats, catById, vocab);
    const tally: Record<string, number> = {};
    for (const a of assignments) tally[a] = (tally[a] ?? 0) + 1;

    expect(tally).toEqual({
      food: 209,
      other: 55,
      [`${PENDING_CAT}Toll`]: 51,
      [`${PENDING_CAT}fyy`]: 41,
      entertainment: 31, // both spellings land in the one existing category
      [`${PENDING_CAT}Fuel`]: 10,
    });
  });

  it('is the behaviour that regressed: without the vocabulary they all collapse', () => {
    const assignments = assignImported(rows, {}, cats, catById);
    const tally: Record<string, number> = {};
    for (const a of assignments) tally[a] = (tally[a] ?? 0) + 1;

    expect(tally.travelling).toBe(61); // Toll 51 + Fuel 10
    expect(tally.other).toBe(96); // Other Expenses 55 + fyy 41
  });
});

describe('applyDedup', () => {
  const saved: Transaction[] = [
    {
      id: 't1', merchantRaw: 'Starbucks', merchantKey: 'starbucks', amount: 12, currency: 'MYR',
      type: 'expense', date: '2026-05-01', categoryId: 'dining', createdAt: '2026-05-01T09:00:00.000Z', source: 'manual',
    },
  ];

  it('marks exact duplicates as DROP and counts them', () => {
    const items = [item({ merchant: 'Starbucks', amount: 12, date: '2026-05-01' }), item({ merchant: 'New Cafe', amount: 8, date: '2026-05-02' })];
    const { assignments, skipped } = applyDedup(items, ['dining', 'dining'], saved, '2026-06-02');
    expect(assignments).toEqual([DROP, 'dining']);
    expect(skipped).toBe(1);
  });

  it('keeps everything when nothing matches', () => {
    const items = [item({ merchant: 'New Cafe', amount: 8, date: '2026-05-02' })];
    const { assignments, skipped } = applyDedup(items, ['dining'], saved, '2026-06-02');
    expect(assignments).toEqual(['dining']);
    expect(skipped).toBe(0);
  });
});
