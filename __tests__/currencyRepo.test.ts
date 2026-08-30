jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => Promise.resolve((global as any).__fakeDb),
}));

jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { getDisplayCurrency, setDisplayCurrency, getEntryCurrency, setEntryCurrency, setActiveCurrencies } from '../src/db/currencyRepo';
import { resetAllData } from '../src/db/db';

function fakeDb(metaRows: Record<string, string> = {}) {
  const store = { ...metaRows };
  return {
    getFirstAsync: (sql: string, key: string) =>
      Promise.resolve(sql.includes('app_meta') ? (store[key] !== undefined ? { value: store[key] } : null) : null),
    runAsync: (sql: string, key: string, value: string) => {
      store[key] = value;
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    _store: store,
  };
}

describe('getDisplayCurrency', () => {
  it('defaults to MYR when nothing is stored', async () => {
    (global as any).__fakeDb = fakeDb();
    expect(await getDisplayCurrency()).toBe('MYR');
  });

  it('returns the stored value when it is still active', async () => {
    (global as any).__fakeDb = fakeDb({ active_currencies: '["MYR","USD"]', display_currency: 'USD' });
    expect(await getDisplayCurrency()).toBe('USD');
  });

  it('falls back to MYR when the stored value was since deactivated', async () => {
    (global as any).__fakeDb = fakeDb({ active_currencies: '["MYR"]', display_currency: 'USD' });
    expect(await getDisplayCurrency()).toBe('MYR');
  });
});

describe('getEntryCurrency', () => {
  it('defaults to display_currency when entry_currency is not set', async () => {
    (global as any).__fakeDb = fakeDb({ active_currencies: '["MYR","SGD"]', display_currency: 'SGD' });
    expect(await getEntryCurrency()).toBe('SGD');
  });

  it('defaults to MYR when neither is set', async () => {
    (global as any).__fakeDb = fakeDb();
    expect(await getEntryCurrency()).toBe('MYR');
  });
});

describe('setDisplayCurrency', () => {
  it('persists the code under both display_currency and entry_currency keys', async () => {
    const db = fakeDb();
    (global as any).__fakeDb = db;
    await setDisplayCurrency('CNY');
    expect(db._store.display_currency).toBe('CNY');
    expect(db._store.entry_currency).toBe('CNY');
  });
});

describe('resetAllData currency reset', () => {
  it('clears display_currency alongside active_currencies and entry_currency', async () => {
    const statements: string[] = [];
    (global as any).__fakeDb = {
      withTransactionAsync: (fn: () => Promise<void>) => fn(),
      execAsync: (sql: string) => {
        statements.push(sql);
        return Promise.resolve();
      },
      runAsync: (sql: string, ..._args: unknown[]) => {
        statements.push(sql);
        return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
      },
      getAllAsync: () => Promise.resolve([]),
      getFirstAsync: () => Promise.resolve(null),
    };
    await resetAllData();
    const metaDelete = statements.find((s) => s.includes('DELETE FROM app_meta'));
    expect(metaDelete).toBeDefined();
    expect(metaDelete).toContain('display_currency');
  });
});
