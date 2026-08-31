let mockOpenCount = 0;
let mockShouldFailOpen = false;

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
    if (mockShouldFailOpen) {
      return Promise.reject(new Error('SQLITE_BUSY: database is locked'));
    }
    return Promise.resolve(mockDb);
  }),
}));

import { getDb } from '../src/db/db';

describe('getDb resilience and retry', () => {
  beforeEach(() => {
    mockOpenCount = 0;
    mockShouldFailOpen = false;
    jest.clearAllMocks();
  });

  it('resets dbPromise on error so subsequent call can succeed', async () => {
    mockShouldFailOpen = true;

    // First attempt fails due to database lock
    await expect(getDb()).rejects.toThrow('SQLITE_BUSY');
    expect(mockOpenCount).toBe(1);

    // Second attempt after lock clears should retry and succeed
    mockShouldFailOpen = false;
    const db = await getDb();
    expect(db).toBe(mockDb);
    expect(mockOpenCount).toBe(2);

    // Third call should use cached promise and not call openDatabaseAsync again
    const cachedDb = await getDb();
    expect(cachedDb).toBe(mockDb);
    expect(mockOpenCount).toBe(2);
  });
});
