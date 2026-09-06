// A backup restore bug (fixed in restoreRepo.ts) used to write signed amounts straight into
// the `amount` column for expense rows, instead of normalizing to the always-positive
// convention every other write path relies on (see Transaction/ExtractedTxn's "amount is
// always positive, sign implied by type" contract). Devices that already restored a backup
// before the fix are left with negative `amount` on expense rows, which corrupts every
// downstream sum (recap totals, category breakdowns). This repairs that data in place, once,
// on every app start — matching the ALTER-TABLE migration pattern already used in db.ts.
let mockOpenCount = 0;

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getAllAsync: jest.fn().mockResolvedValue([]),
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  withTransactionAsync: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockImplementation(() => {
    mockOpenCount += 1;
    return Promise.resolve(mockDb);
  }),
}));

import { getDb } from '../src/db/db';

describe('negative expense amount repair', () => {
  beforeEach(() => {
    mockOpenCount = 0;
    jest.clearAllMocks();
  });

  it('flips already-corrupted negative expense amounts back to positive on init', async () => {
    await getDb();
    const calls = mockDb.execAsync.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').trim());
    expect(calls.some((sql) => /UPDATE transactions SET amount = ABS\(amount\) WHERE type = 'expense' AND amount < 0/.test(sql))).toBe(true);
  });
});
