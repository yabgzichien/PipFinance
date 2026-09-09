// src/lib/backupBundle.ts
// Shared "gather everything into one backup zip" step used by both BackupScreen's manual
// backup/local-save button and useCloudBackupSync's silent auto-backup — one place for the
// all-time report + extras assembly (mirrors ExportScreen's period-scoped getFullExportExtra,
// but always all-time and always destined for a full backup, not a report).
import { getAdvice } from '../db/budgetRepo';
import { listDeletedDefaultCategories } from '../db/categoriesRepo';
import { getActiveCurrencies } from '../db/currencyRepo';
import { getReliefMemoryMap, listAllReliefTags } from '../db/reliefRepo';
import { buildFinancialReportBundle, buildReportPeriod } from './bookkeeping';
import { generateFullBackupZip, type CommitmentExportExtra } from './financialExport';
import type { AppData } from '../state/store';
import { serializeWidgetMascotConfig } from '../widget/mascot/config';

/** The subset of useAppData()'s fields a full backup needs. */
export type BackupSourceData = Pick<
  AppData,
  | 'transactions'
  | 'categories'
  | 'accounts'
  | 'balanceEntries'
  | 'trips'
  | 'commitments'
  | 'commitmentOccurrences'
  | 'people'
  | 'splits'
  | 'shares'
  | 'splitPayments'
  | 'expectedIncome'
  | 'allocations'
  | 'snapshots'
  | 'memory'
  | 'tasksDone'
  | 'onboardingComplete'
  | 'tutorialScanDone'
  | 'tutorialManualDone'
  | 'tutorialDismissed'
  | 'reminderCadence'
  | 'reminderHourOverride'
  | 'owedReminderEnabled'
  | 'commitmentReminderEnabled'
  | 'motionSetting'
  | 'widgetMascotConfig'
  | 'soundEnabled'
>;

/** Builds the full-backup zip (backup.json + every receipt image). Display currency doesn't
 *  factor in: `generateFullBackupZip` reads accounts' native value/currency and raw MYR
 *  transaction amounts, never the MYR-converted display figure, so a neutral 'MYR'/{} pair
 *  here is correct regardless of what currency the user has the app displaying in. */
export async function buildBackupZip(data: BackupSourceData): Promise<Uint8Array> {
  const now = new Date();
  const period = buildReportPeriod('all-time', undefined, undefined, undefined, undefined, now);
  const reportData = buildFinancialReportBundle(
    data.transactions,
    data.categories,
    data.accounts,
    data.balanceEntries,
    period,
    'Pip User',
    {},
    'MYR'
  );

  const [reliefTags, reliefMemory, deletedDefaultCategories, activeCurrencies, advice] = await Promise.all([
    listAllReliefTags().catch(() => []),
    getReliefMemoryMap().catch(() => ({})),
    listDeletedDefaultCategories().catch(() => []),
    getActiveCurrencies().catch(() => ['MYR']),
    getAdvice().catch(() => null),
  ]);

  const extra: CommitmentExportExtra = {
    trips: data.trips,
    commitments: data.commitments,
    occurrences: data.commitmentOccurrences,
    balanceEntries: data.balanceEntries,
    people: data.people,
    splits: data.splits,
    shares: data.shares,
    splitPayments: data.splitPayments,
    budget: { expectedIncome: data.expectedIncome, allocations: data.allocations },
    budgetSnapshots: data.snapshots,
    budgetAdvice: advice,
    reliefTags,
    reliefMemory,
    merchantMemory: data.memory,
    deletedDefaultCategories,
    activeCurrencies,
    preferences: {
      settings: {
        reminderCadence: data.reminderCadence,
        reminderHourOverride: data.reminderHourOverride,
        owedReminderEnabled: data.owedReminderEnabled,
        commitmentReminderEnabled: data.commitmentReminderEnabled,
        motionSetting: data.motionSetting,
        widgetMascotConfig: serializeWidgetMascotConfig(data.widgetMascotConfig),
        soundEnabled: data.soundEnabled,
      },
      tasks: {
        tasksDone: data.tasksDone,
        onboardingComplete: data.onboardingComplete,
        tutorialScanDone: data.tutorialScanDone,
        tutorialManualDone: data.tutorialManualDone,
        tutorialDismissed: data.tutorialDismissed,
      },
    },
    allTransactions: data.transactions,
  };

  return generateFullBackupZip(reportData, data.transactions, extra);
}
