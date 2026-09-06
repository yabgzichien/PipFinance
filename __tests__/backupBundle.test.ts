jest.mock('../src/lib/financialExport', () => ({ generateFullBackupZip: jest.fn(() => new Uint8Array([1])) }));
jest.mock('../src/lib/bookkeeping', () => ({
  buildReportPeriod: jest.fn(() => ({ startDate: '', endDate: '', label: 'All time' })),
  buildFinancialReportBundle: jest.fn(() => ({})),
}));
jest.mock('../src/db/budgetRepo', () => ({ getAdvice: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../src/db/categoriesRepo', () => ({ listDeletedDefaultCategories: jest.fn(() => Promise.resolve([])) }));
jest.mock('../src/db/currencyRepo', () => ({ getActiveCurrencies: jest.fn(() => Promise.resolve(['MYR'])) }));
jest.mock('../src/db/reliefRepo', () => ({
  getReliefMemoryMap: jest.fn(() => Promise.resolve({})),
  listAllReliefTags: jest.fn(() => Promise.resolve([])),
}));

import { buildBackupZip, type BackupSourceData } from '../src/lib/backupBundle';
import type { Trip } from '../src/lib/trips';

const mockGenerateFullBackupZip = jest.requireMock('../src/lib/financialExport').generateFullBackupZip as jest.Mock;

describe('buildBackupZip', () => {
  it('passes the AppData trip collection to the full-backup serializer', async () => {
    const trips: Trip[] = [{
      id: 'trip-sg', name: 'Singapore', createdAt: '2026-09-01T00:00:00.000Z', archived: false, startDate: null, endDate: null,
    }];
    const data = {
      transactions: [], categories: [], accounts: [], balanceEntries: [], trips,
      commitments: [], commitmentOccurrences: [], people: [], splits: [], shares: [], splitPayments: [],
      expectedIncome: 0, allocations: {}, snapshots: {}, memory: {}, tasksDone: [],
      onboardingComplete: false, tutorialScanDone: false, tutorialManualDone: false, tutorialDismissed: false,
      reminderCadence: 'off', reminderHourOverride: null, owedReminderEnabled: false,
      commitmentReminderEnabled: false, motionSetting: 'full', soundEnabled: false,
    } as BackupSourceData;

    await buildBackupZip(data);

    expect(mockGenerateFullBackupZip).toHaveBeenCalledWith(expect.anything(), data.transactions, expect.objectContaining({ trips }));
  });
});
