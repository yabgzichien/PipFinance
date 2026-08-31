import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addCategory as dbAddCategory, deleteCategory as dbDeleteCategory, updateCategoryIcon as dbUpdateCategoryIcon, updateCategoryLabel as dbUpdateCategoryLabel, listCategories } from '../db/categoriesRepo';
import { DEFAULT_EXPENSE_ID, DEFAULT_INCOME_ID } from '../data/categories';
import { getMemoryMap, upsertMemory } from '../db/memoryRepo';
import {
  addTransactions,
  deleteTransactions,
  listTransactions,
  updateTransactionAmount,
  updateTransactionFields,
  type NewTxn,
} from '../db/txnRepo';
import {
  getExpectedIncome,
  getAllocations,
  setExpectedIncome,
  setAllocations as dbSetAllocations,
  getAdvice as dbGetAdvice,
  setAdvice as dbSetAdvice,
  clearBudget,
  getSnapshots,
  upsertSnapshot,
} from '../db/budgetRepo';
import { resetAllData as dbResetAllData } from '../db/db';
import {
  addAccount as dbAddAccount,
  addBalanceEntry as dbAddBalanceEntry,
  addHolding as dbAddHolding,
  adjustHoldingCost as dbAdjustHoldingCost,
  adjustHoldingQuantity as dbAdjustHoldingQuantity,
  deleteAccount as dbDeleteAccount,
  getPriceCache,
  listAccounts,
  listBalanceEntries,
  updateAccount as dbUpdateAccount,
  updateHoldingQuantity as dbUpdateHoldingQuantity,
  updateHoldingCost as dbUpdateHoldingCost,
  upsertDailyBalanceEntry,
  upsertPrice,
} from '../db/accountsRepo';
import {
  createSplit as dbCreateSplit,
  deleteSplitsForTxns as dbDeleteSplitsForTxns,
  findOrCreatePerson as dbFindOrCreatePerson,
  listPayments as dbListPayments,
  listPeople as dbListPeople,
  listShares as dbListShares,
  listSplits as dbListSplits,
  recordPayment as dbRecordPayment,
  renamePerson as dbRenamePerson,
  writeOffShare as dbWriteOffShare,
} from '../db/splitRepo';
import { fromCents, openReceivableTotal, outstanding, receivableMyr, toCents, type OpenShare } from '../lib/split';
import { refreshPrices as fetchPrices } from '../prices';
import { budgetHash, currentMonthKey, monthKey, positiveAllocations } from '../lib/budget';
import { computeCoverage, type Coverage } from '../lib/coverage';
import { getMeta, setMeta } from '../db/metaRepo';
import { isReminderCadence, type ReminderCadence } from '../lib/reminders';
import { setHapticsEnabled } from '../lib/haptics';
import { setSoundEnabled as applySoundEnabled } from '../lib/sound';
import { isMotionSetting, type MotionSetting } from '../theme/motion';
import {
  compute7DayDots,
  computeStreak,
  computeStreakPaused,
  computeStreakWithFreeze,
  computeWeekRing,
  ensureMonthlyFreeze,
  isStreakGraduated,
  lastActiveDay,
  localDayNumber,
  streakStartDay,
  NO_STREAK_FREEZE,
  type StreakFreezeState,
} from '../lib/streak';
import { monthLabel } from '../lib/dates';
import { syncStreakWidget } from '../widget/syncStreakWidget';
import { syncQuickRecordWidget } from '../widget/syncQuickRecordWidget';
import {
  addCommitment as dbAddCommitment,
  archiveCommitment as dbArchiveCommitment,
  deleteCommitment as dbDeleteCommitment,
  ensureOccurrences as dbEnsureOccurrences,
  listCommitments as dbListCommitments,
  listOccurrences as dbListOccurrences,
  listOccurrencesByTxnIds,
  insertOccurrence as dbInsertOccurrence,
  markOccurrencePaid as dbMarkOccurrencePaid,
  resetOccurrence as dbResetOccurrence,
  setOccurrenceUnits as dbSetOccurrenceUnits,
  skipOccurrence as dbSkipOccurrence,
  updateCommitment as dbUpdateCommitment,
  type NewCommitment,
} from '../db/commitmentsRepo';
import { findCommitmentMatch, occurrenceMyr, type Commitment, type CommitmentOccurrence, type CommitmentKind } from '../lib/commitments';
import { matchSourceCategory } from '../lib/import';
import type { ExploreTaskId } from '../lib/tasks';
import type { ParsedCommitment } from '../lib/advancedImport';
import {
  addReliefTag,
  deleteReliefTagsForTxns as dbDeleteReliefTagsForTxns,
  getReliefMemoryMap,
  getReliefTagsForTxn,
  listReliefTags,
} from '../db/reliefRepo';
import { evidenceState, isRequestable, matchRelief, yaForDate } from '../lib/relief';
import { scheduleForYA } from '../lib/reliefSchedule';
import type { ScannedReceipt } from '../lib/parseReceipt';

const ONBOARDING_KEY = 'onboarding_complete';
// The monthly amount the borrower committed to keeping back. A preference, not ledger data, so
// it lives in app_meta rather than earning a table of its own.
// Local reminder preferences. Both default to off so the OS permission prompt only ever
// appears because the user reached for it in Settings. Deliberately survive `resetAllData`,
// `resetToOnboarding` and demo-profile loads: this is how the owner of the phone wants to be
// interrupted, not persona data, and having a demo reset silently unsubscribe them would be a
// surprise they would not think to look for.
const REMINDER_CADENCE_KEY = 'reminder_cadence';
const OWED_REMINDER_KEY = 'owed_reminder_on';
const COMMITMENT_REMINDER_KEY = 'commitment_reminder_on';
// docs/ui-engagement-plan.md Step 7: overrides the behaviour-inferred log-reminder fire hour.
// Empty string means "no override, follow the inferred/fallback hour" (autonomy stays the
// default; a user who never opens this row keeps the app deciding for them).
const REMINDER_HOUR_OVERRIDE_KEY = 'reminder_hour_override';
// docs/ui-engagement-plan.md Step 1: Full/Reduced/Off for loops and haptics app-wide. Defaults
// to 'full' — the OS-level AccessibilityInfo reduce-motion signal (src/state/useReducedMotion.ts)
// already covers the user who never opens this Settings row.
const MOTION_SETTING_KEY = 'motion_setting';
// The save-confirmation chime (src/lib/sound.ts). Its own key rather than a tier of
// MOTION_SETTING_KEY: sound carries into a room the way animation and haptics don't, so
// muting it is a separate decision from turning motion down. Defaults to on, so an absent
// row reads as on and only an explicit 'false' mutes.
const SOUND_ENABLED_KEY = 'sound_enabled';
// docs/ui-engagement-plan.md Step 4: the streak's earned-not-purchased freeze and the
// user-controlled pause. Both survive resetAllData/resetToOnboarding the same way the reminder
// preferences do (see the comment above REMINDER_CADENCE_KEY) — they're how this phone's owner
// wants the habit lever to behave, not persona data a demo reset should touch.
const STREAK_FREEZE_MONTH_KEY = 'streak_freeze_month';
const STREAK_FREEZE_AVAILABLE_KEY = 'streak_freeze_available';
const STREAK_FREEZE_SPENT_FOR_KEY = 'streak_freeze_spent_for';
const STREAK_PAUSED_SINCE_KEY = 'streak_paused_since';
const TUTORIAL_SCAN_DONE_KEY = 'tutorial_scan_done';
const TUTORIAL_MANUAL_DONE_KEY = 'tutorial_manual_done';
const TUTORIAL_DISMISSED_KEY = 'tutorial_dismissed';
const EXPLORE_TASKS_DONE_KEY = 'explore_tasks_done';
import { applyEffect, currentValue, RECEIVABLE_CLS, type LinkEffect } from '../lib/networth';
import { holdingValue, isHolding, mergeAccountValues } from '../lib/prices';
import { merchantKey } from '../lib/normalize';
import { listFxRates } from '../db/fxRepo';
import { getEntryCurrency, refreshFxRates } from '../db/currencyRepo';
import { rateFor, ratesFromCache } from '../lib/fx';
import { BASE_CURRENCY, deriveNative } from '../lib/currency';
import { notify } from '../lib/platformAlert';
import {
  DROP,
  type Account,
  type AccountKind,
  type BalanceEntry,
  type Category,
  type ExtractedTxn,
  type MemoryMap,
  type PaymentEvidence,
  type Person,
  type PriceQuote,
  type ReliefTag,
  type Split,
  type SplitDraft,
  type SplitPayment,
  type SplitShare,
  type Transaction,
  type TxnSource,
  type TxnType,
} from '../lib/types';

/**
 * Everything `applyOccurrenceReversal` needs to undo a commitment tick, with every currency
 * conversion already done. Splitting the planning from the applying is what lets a batch
 * resolve all of its conversions before writing any of them, so a missing rate on the third
 * row cannot leave the first two half-reversed.
 */
interface OccurrenceReversal {
  fromAccountId: string | null;
  fromNative: number;
  holdingId: string | null;
  unitsAdded: number | null;
  costMyr: number;
  cashTargetId: string | null;
  cashTargetNative: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface NewLearned {
  merchant: string;
  categoryId: string;
}

/**
 * Make the "Owed to me" account equal what the open shares actually add up to.
 *
 * The receivable is derived state that has to live in a table so the rest of Net Worth (class
 * grouping, the history series, the balance sheet) can treat it like any other asset. Deriving
 * it fresh on every load is what keeps that shortcut honest: the split records are the truth,
 * and the account is only ever their shadow. The account is not created until there is
 * something to owe, so a user who never splits a bill never sees the line.
 *
 * Returns whether anything moved, so the caller knows to refetch accounts and entries.
 */
async function reconcileReceivable(
  shareRows: SplitShare[],
  accts: Account[],
  splitRows: Split[] = []
): Promise<boolean> {
  const splitById = Object.fromEntries(splitRows.map((s) => [s.id, s]));
  const total = fromCents(
    shareRows.reduce((s, share) => {
      if (share.status !== 'open') return s;
      const split = splitById[share.splitId];
      const nativeOutstanding = outstanding(share);
      const myr =
        split && split.currency !== BASE_CURRENCY && split.fxRate != null
          ? receivableMyr(nativeOutstanding, split.fxRate)
          : nativeOutstanding;
      return s + toCents(myr);
    }, 0)
  );
  const existing = accts.find((a) => a.cls === RECEIVABLE_CLS && !a.archived);

  if (!existing) {
    if (total <= 0) return false;
    await dbAddAccount('Owed to me', 'asset', RECEIVABLE_CLS, total, todayKey(), null);
    return true;
  }

  const mine = (await listBalanceEntries()).filter((e) => e.accountId === existing.id);
  if (Math.round(currentValue(mine) * 100) === Math.round(total * 100)) return false;
  await upsertDailyBalanceEntry(existing.id, total, todayKey());
  return true;
}

export type HeroPanel = 'cashflow' | 'spent' | 'left' | 'networth';

interface AppData {
  ready: boolean;
  categories: Category[];
  catById: Record<string, Category>;
  transactions: Transaction[];
  memory: MemoryMap;
  expectedIncome: number;
  allocations: Record<string, number>;
  snapshots: Record<string, { income: number; allocations: Record<string, number> }>;
  hasBudget: boolean;
  accounts: Account[];
  balanceEntries: BalanceEntry[];
  prices: Record<string, PriceQuote>;
  accountValues: Record<string, number>;
  pricesAsOf: string | null;
  /** 90-day data-coverage signal, recomputed from `transactions`. See `lib/coverage.ts`. */
  coverage: Coverage;
  /** Count of the current YA's relief tags whose e-Invoice request window is still open, for
   *  the Settings "Tax relief" row badge. Backed by a boot-time-only `reliefTags` load: see
   *  the effect near `refreshAll` above. */
  taxRequestableCount: number;
  /** Whether the one-time setup has been completed. */
  onboardingComplete: boolean;
  /** Mark the one-time setup complete. */
  completeOnboarding: () => Promise<void>;
  /** Post-setup onboarding tutorial missions state */
  tutorialScanDone: boolean;
  tutorialManualDone: boolean;
  tutorialDismissed: boolean;
  tutorialComplete: boolean;
  completeTutorialScan: () => Promise<void>;
  completeTutorialManual: () => Promise<void>;
  dismissTutorial: () => Promise<void>;
  resetTutorial: () => Promise<void>;
  /** Explore-tasks checklist surfaced from the Home mascot. See src/lib/tasks.ts. */
  tasksDone: ExploreTaskId[];
  markTaskDone: (id: ExploreTaskId, celebrate?: boolean) => Promise<void>;
  /** Count of task completions the Home mascot hasn't celebrated yet. See TaskCelebration. */
  pendingTaskCelebrations: number;
  clearTaskCelebrations: () => void;
  refreshAll: () => Promise<void>;
  addCategory: (label: string, icon: string, hue: number, kind: Category['kind']) => Promise<string>;
  deleteCategory: (id: string) => Promise<void>;
  /** Change a category's icon/picture  a named icon or a custom photo URI. Allowed on every
   *  category, including the protected generics. */
  updateCategoryIcon: (id: string, icon: string) => Promise<void>;
  /** Rename a category. Allowed on every category, including the protected generics. */
  updateCategoryLabel: (id: string, label: string) => Promise<void>;
  commitCategorized: (
    items: ExtractedTxn[],
    assignments: (string | null)[],
    source?: TxnSource,
    /** Parallel to `items`: a split to attach to that row, or null. A split row saves at its
     *  `ownShare`, not the extracted amount, and the gross is kept on the split record. */
    splitDrafts?: (SplitDraft | null)[],
    /** Parallel to `items`: the saved receipt photo's URI for that row, or null. */
    receiptUris?: (string | null)[]
  ) => Promise<{ created: Transaction[]; newLearned: NewLearned[] }>;
  /** Silently tags each created transaction against the current YA's relief schedule, using
   *  line-item keywords first (when `receipt` is given) and remembered merchant mappings
   *  second. Writes nothing when nothing matches. Called once per save from AddFlow.tsx, with
   *  no UI of its own, per the tax-relief-tagging spec's zero-footprint requirement. */
  applyReliefDetection: (created: Transaction[], receipt: ScannedReceipt | null) => Promise<void>;
  /** People you split bills with, remembered locally so totals can roll up per person. */
  people: Person[];
  splits: Split[];
  shares: SplitShare[];
  splitPayments: SplitPayment[];
  /** Unsettled shares joined with the person and the bill behind them, ready to match a
   *  repayment against or to list on the Owed screen. */
  openShares: OpenShare[];
  /** Remember a name (or return the one already saved under it, case-insensitively). */
  addPerson: (name: string) => Promise<Person>;
  renamePerson: (id: string, name: string) => Promise<void>;
  /** Split a transaction already in the ledger: its amount drops to the payer's own share. */
  splitTransaction: (txn: Transaction, draft: SplitDraft) => Promise<void>;
  /** Undo a split, restoring the transaction to the full amount that left the account. */
  unsplitTransaction: (txn: Transaction) => Promise<void>;
  /** Record money received against a share. Never writes an income row: it moves cash against
   *  the receivable, which is what being paid back actually is. */
  settleShare: (
    shareId: string,
    amount: number,
    paidOn: string,
    evidence: PaymentEvidence,
    matchedMerchant: string | null,
    accountId: string | null
  ) => Promise<void>;
  /** Give up on a share: the uncollected money becomes the payer's own expense after all. */
  writeOffShare: (shareId: string) => Promise<void>;
  saveTransactionEdits: (
    txn: Transaction,
    edits: { amount: number; type: TxnType; categoryId: string | null; remark?: string | null }
  ) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  removeMany: (ids: string[]) => Promise<void>;
  saveBudget: (income: number, allocations: Record<string, number>) => Promise<void>;
  resetBudget: () => Promise<void>;
  resetAllData: () => Promise<void>;
  /** Wipe all data AND reset onboarding so the setup wizard re-appears. */
  resetToOnboarding: () => Promise<void>;
  /** Monthly pay-yourself-first commitment. Motivation only. */
  /** How often to nudge about logging spending. `'off'` disables the reminder entirely. */
  reminderCadence: ReminderCadence;
  setReminderCadence: (cadence: ReminderCadence) => Promise<void>;
  /** User override for the log reminder's fire hour, `null` meaning "let Pip infer it from
   *  when I actually log" (docs/ui-engagement-plan.md Step 7, item 1). */
  reminderHourOverride: number | null;
  setReminderHourOverride: (hour: number | null) => Promise<void>;
  /** Whether to chase debts that have aged past `AGING_DAYS`, weekly. */
  owedReminderEnabled: boolean;
  setOwedReminderEnabled: (on: boolean) => Promise<void>;
  /** Whether to nudge about recurring commitments (bills + DCA): a monthly digest plus a
   *  once-off nudge for anything overdue. */
  commitmentReminderEnabled: boolean;
  setCommitmentReminderEnabled: (on: boolean) => Promise<void>;
  /** Full/Reduced/Off for loops and haptics app-wide (docs/ui-engagement-plan.md Step 1).
   *  Read by `useReducedMotion` alongside the OS accessibility signal, and mirrored into
   *  `src/lib/haptics.ts` so haptics respect it without every call site threading it through. */
  motionSetting: MotionSetting;
  setMotionSetting: (setting: MotionSetting) => Promise<void>;
  /** Whether the save-confirmation chime plays. Mirrored into `src/lib/sound.ts` so call
   *  sites never thread it through. Independent of `motionSetting` on purpose — see the
   *  comment above SOUND_ENABLED_KEY. */
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => Promise<void>;

  // --- Streak (docs/ui-engagement-plan.md Step 4) ---------------------------------------
  /** The displayed streak: pause-frozen when paused, freeze-bridged otherwise. What every
   *  screen should render — nothing downstream needs the raw `computeStreak`. */
  streak: number;
  /** Monday-first, this-week-only activity ring for the Home card (replaces the old rolling
   *  7-day dots there; the Android widget keeps its own rolling window, see StreakWidget.tsx). */
  streakWeek: boolean[];
  /** Index of today within `streakWeek` (0=Mon..6=Sun). */
  streakTodayIndex: number;
  /** Whether an unspent monthly freeze is currently banked  shown as a small shield. */
  streakFreezeAvailable: boolean;
  /** True once the run has held for `STREAK_GRADUATION_DAYS`: the UI should back off the daily
   *  count in favour of `streakStartLabel`. */
  streakGraduated: boolean;
  /** "Logging since <Month Year>", or null if there's no active run to date from. Only
   *  meaningful once `streakGraduated` is true. */
  streakStartLabel: string | null;
  /** Whether the user has paused the streak (Settings). While paused, `streak` is frozen and
   *  the reminder ladder should not chase logging (wired in a later step). */
  streakPaused: boolean;
  pauseStreak: () => Promise<void>;
  resumeStreak: () => Promise<void>;
  /** Increments once each time a save extends the streak to a new day (freeze-bridged saves
   *  count too). Consumers watch for a change against their own last-seen value  see
   *  DashboardScreen's StreakCelebration  rather than reading this as a boolean, since two
   *  celebrations in a row need to be distinguishable even if the component never unmounted
   *  in between. */
  streakCelebrationToken: number;

  addAccount: (name: string, kind: AccountKind, cls: string, openingValue: number, asOf: string, icon?: string | null, currency?: string, interestRate?: number | null) => Promise<string>;
  /** Returns a default account id for the add flows, creating a "Cash" account if none exist. */
  ensureDefaultAccount: () => Promise<string>;
  updateAccount: (
    id: string,
    fields: {
      name: string;
      cls: string;
      icon?: string | null;
      interestRate?: number | null;
      sub?: string | null;
      symbol?: string | null;
      ticker?: string | null;
      quantity?: number | null;
      cost?: number | null;
    }
  ) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setBalance: (accountId: string, value: number, asOf: string) => Promise<void>;
  /** Adjust a linked account's balance. `amount` must already be in THAT account's own
   *  currency (see `deriveNative`): `balance_entries.value` is native to the account, never
   *  assumed MYR. */
  recordBalanceLink: (accountId: string, amount: number, effect: LinkEffect, asOf: string) => Promise<void>;
  addHolding: (name: string, sub: string, symbol: string, ticker: string, quantity: number, cost: number | null, icon?: string | null, interestRate?: number | null) => Promise<string>;
  updateHoldingQuantity: (id: string, quantity: number) => Promise<void>;
  setHoldingCost: (id: string, cost: number | null) => Promise<void>;
  refreshPrices: () => Promise<void>;
  getCachedAdvice: () => Promise<{ hash: string; text: string } | null>;
  saveAdvice: (income: number, allocations: Record<string, number>, text: string) => Promise<void>;

  // --- Recurring commitments (bills + DCA investments) ---------------------------------
  commitments: Commitment[];
  /** Materialised due dates for every commitment — the monthly todo list's rows. */
  commitmentOccurrences: CommitmentOccurrence[];
  addCommitmentEntry: (input: {
    label: string;
    kind: CommitmentKind;
    amount: number;
    dueDay: number;
    categoryId?: string | null;
    fromAccountId?: string | null;
    toAccountId?: string | null;
    startMonth?: string;
    currency?: string;
  }) => Promise<void>;
  updateCommitmentEntry: (
    id: string,
    patch: Partial<Pick<Commitment, 'label' | 'amount' | 'categoryId' | 'fromAccountId' | 'toAccountId' | 'dueDay' | 'endMonth' | 'reliefCode'>>
  ) => Promise<void>;
  archiveCommitmentEntry: (id: string) => Promise<void>;
  deleteCommitmentEntry: (id: string) => Promise<void>;
  /** Import commitments from a version-2 Advanced Import JSON (see advancedImport.ts). Skips
   *  any commitment whose merchantKey + dueDay already exists locally. */
  importParsedCommitments: (parsed: ParsedCommitment[]) => Promise<void>;
  /** Read-only preview of the ledger row a tick would link, for a confirm-before-linking UI.
   *  Null means the tick would create a new transaction instead. */
  previewCommitmentMatch: (occurrenceId: string) => Transaction | null;
  /** Tick an occurrence paid: matches an existing transaction first, creates one as fallback.
   *  Returns whether an existing row was matched (vs. a new one created). */
  payCommitment: (occurrenceId: string, opts?: { amount?: number; paidOn?: string }) => Promise<{ matched: boolean }>;
  /** Untick: full reversal of whatever `payCommitment` did (see the function's own doc). */
  unpayCommitment: (occurrenceId: string) => Promise<void>;
  /** Mark a scheduled occurrence as not applicable this month. No ledger effect. */
  skipCommitment: (occurrenceId: string) => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [memory, setMemory] = useState<MemoryMap>({});
  const [expectedIncome, setIncome] = useState(0);
  const [allocations, setAlloc] = useState<Record<string, number>>({});
  const [snapshots, setSnapshots] = useState<Record<string, { income: number; allocations: Record<string, number> }>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balanceEntries, setBalanceEntries] = useState<BalanceEntry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [shares, setShares] = useState<SplitShare[]>([]);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceQuote>>({});
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [tutorialScanDone, setTutorialScanDoneState] = useState(false);
  const [tutorialManualDone, setTutorialManualDoneState] = useState(false);
  const [tutorialDismissed, setTutorialDismissedState] = useState(false);
  const [reminderCadence, setReminderCadenceState] = useState<ReminderCadence>('off');
  const [reminderHourOverride, setReminderHourOverrideState] = useState<number | null>(null);
  const [owedReminderEnabled, setOwedReminderEnabledState] = useState(false);
  const [commitmentReminderEnabled, setCommitmentReminderEnabledState] = useState(false);
  const [motionSetting, setMotionSettingState] = useState<MotionSetting>('full');
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [streakFreeze, setStreakFreezeState] = useState<StreakFreezeState>(NO_STREAK_FREEZE);
  const [streakPausedSinceDay, setStreakPausedSinceDayState] = useState<number | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [commitmentOccurrences, setCommitmentOccurrences] = useState<CommitmentOccurrence[]>([]);
  const [reliefTags, setReliefTags] = useState<ReliefTag[]>([]);
  const [tasksDone, setTasksDoneState] = useState<ExploreTaskId[]>([]);

  const refreshAll = useCallback(async () => {
    const [cats, txns, mem, income, alloc, snaps, accts, entries, cache, onboardingFlag, tutorialScanRaw, tutorialManualRaw, tutorialDismissedRaw, exploreTasksDoneRaw, reminderCadenceRaw, reminderHourOverrideRaw, owedReminderRaw, commitmentReminderRaw, motionSettingRaw, soundEnabledRaw, streakFreezeMonthRaw, streakFreezeAvailableRaw, streakFreezeSpentForRaw, streakPausedSinceRaw, peopleRows, splitRows, shareRows, paymentRows] =
      await Promise.all([
        listCategories(),
        listTransactions(),
        getMemoryMap(),
        getExpectedIncome(),
        getAllocations(),
        getSnapshots(),
        listAccounts(),
        listBalanceEntries(),
        getPriceCache(),
        getMeta(ONBOARDING_KEY),
        getMeta(TUTORIAL_SCAN_DONE_KEY),
        getMeta(TUTORIAL_MANUAL_DONE_KEY),
        getMeta(TUTORIAL_DISMISSED_KEY),
        getMeta(EXPLORE_TASKS_DONE_KEY),
        getMeta(REMINDER_CADENCE_KEY),
        getMeta(REMINDER_HOUR_OVERRIDE_KEY),
        getMeta(OWED_REMINDER_KEY),
        getMeta(COMMITMENT_REMINDER_KEY),
        getMeta(MOTION_SETTING_KEY),
        getMeta(SOUND_ENABLED_KEY),
        getMeta(STREAK_FREEZE_MONTH_KEY),
        getMeta(STREAK_FREEZE_AVAILABLE_KEY),
        getMeta(STREAK_FREEZE_SPENT_FOR_KEY),
        getMeta(STREAK_PAUSED_SINCE_KEY),
        dbListPeople(),
        dbListSplits(),
        dbListShares(),
        dbListPayments(),
      ]);
    // An unreadable cadence falls back to off rather than to a guess: silence is the safe
    // failure mode for something that interrupts the user.
    setReminderCadenceState(isReminderCadence(reminderCadenceRaw) ? reminderCadenceRaw : 'off');
    const parsedHourOverride = reminderHourOverrideRaw ? Number(reminderHourOverrideRaw) : NaN;
    setReminderHourOverrideState(
      Number.isInteger(parsedHourOverride) && parsedHourOverride >= 0 && parsedHourOverride <= 23
        ? parsedHourOverride
        : null
    );
    setOwedReminderEnabledState(owedReminderRaw === 'true');
    setCommitmentReminderEnabledState(commitmentReminderRaw === 'true');
    const resolvedMotionSetting = isMotionSetting(motionSettingRaw) ? motionSettingRaw : 'full';
    setMotionSettingState(resolvedMotionSetting);
    setHapticsEnabled(resolvedMotionSetting !== 'off');
    // Anything but an explicit 'false' means on, so a fresh install (no row yet) hears it.
    const resolvedSoundEnabled = soundEnabledRaw !== 'false';
    setSoundEnabledState(resolvedSoundEnabled);
    applySoundEnabled(resolvedSoundEnabled);

    // Streak freeze: grant a fresh one if this calendar month hasn't seen one yet. Persist the
    // grant immediately so it isn't re-decided (and re-written) on every refresh within the
    // same month.
    const spentForParsed = streakFreezeSpentForRaw === null ? null : Number(streakFreezeSpentForRaw);
    const rawFreeze: StreakFreezeState = {
      grantedMonth: streakFreezeMonthRaw,
      available: streakFreezeAvailableRaw === 'true',
      spentForLastDay: Number.isFinite(spentForParsed) ? spentForParsed : null,
    };
    const resolvedFreeze = ensureMonthlyFreeze(rawFreeze, new Date());
    setStreakFreezeState(resolvedFreeze);
    if (resolvedFreeze !== rawFreeze) {
      await Promise.all([
        setMeta(STREAK_FREEZE_MONTH_KEY, resolvedFreeze.grantedMonth ?? ''),
        setMeta(STREAK_FREEZE_AVAILABLE_KEY, resolvedFreeze.available ? 'true' : 'false'),
        setMeta(STREAK_FREEZE_SPENT_FOR_KEY, ''),
      ]);
    }
    const parsedPausedSince = streakPausedSinceRaw === null || streakPausedSinceRaw === '' ? NaN : Number(streakPausedSinceRaw);
    setStreakPausedSinceDayState(Number.isFinite(parsedPausedSince) ? parsedPausedSince : null);

    setOnboardingComplete(onboardingFlag === 'true');
    setTutorialScanDoneState(tutorialScanRaw === 'true');
    setTutorialManualDoneState(tutorialManualRaw === 'true');
    setTutorialDismissedState(tutorialDismissedRaw === 'true');
    try {
      const parsedTasksDone = exploreTasksDoneRaw ? JSON.parse(exploreTasksDoneRaw) : [];
      setTasksDoneState(Array.isArray(parsedTasksDone) ? parsedTasksDone : []);
    } catch {
      setTasksDoneState([]);
    }
    setCategories(cats);
    setTransactions(txns);
    setMemory(mem);
    setIncome(income);
    setAlloc(alloc);
    setPeople(peopleRows);
    setSplits(splitRows);
    setShares(shareRows);
    setSplitPayments(paymentRows);
    // The receivable account is derived state that happens to live in a table, so it is
    // re-asserted on every load rather than trusted: a hand-edited balance, or a wipe that
    // took the shares but left the account, self-corrects here instead of drifting.
    const receivableMoved = await reconcileReceivable(shareRows, accts);
    const [finalAccts, finalEntries] = receivableMoved
      ? await Promise.all([listAccounts(), listBalanceEntries()])
      : [accts, entries];
    setAccounts(finalAccts);
    setBalanceEntries(finalEntries);
    setPrices(Object.fromEntries(cache.map((q) => [q.symbol, q])));

    // Backfill the current month's snapshot if a budget exists but none was
    // recorded yet (e.g. budget set before this feature shipped), so the recap
    // always has a target for the running month.
    const cur = monthKey(new Date().toISOString())!;
    const hasPlan = income > 0 || Object.keys(alloc).length > 0;
    if (hasPlan && !snaps[cur]) {
      await upsertSnapshot(cur, income, alloc);
      snaps[cur] = { income, allocations: alloc };
    }
    setSnapshots(snaps);

    // Recurring commitments: top up the rolling occurrence window before reading it, so a
    // month that just rolled over (or a commitment created since the last load) always has
    // its todo-list rows ready. Kept out of the big Promise.all above — it's a write, and it
    // has to happen before the read that follows it.
    await dbEnsureOccurrences(new Date());
    const [commitmentRows, occurrenceRows] = await Promise.all([dbListCommitments(), dbListOccurrences()]);
    setCommitments(commitmentRows);
    setCommitmentOccurrences(occurrenceRows);
  }, []);

  /** Targeted refresh after a commitment/occurrence mutation. */
  const refreshCommitmentState = useCallback(async () => {
    const [commitmentRows, occurrenceRows] = await Promise.all([dbListCommitments(), dbListOccurrences()]);
    setCommitments(commitmentRows);
    setCommitmentOccurrences(occurrenceRows);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    const init = async () => {
      try {
        await refreshAll();
        if (alive) setReady(true);
      } catch (e) {
        console.warn('Failed to load app data', e);
        attempts += 1;
        if (alive && attempts < MAX_ATTEMPTS) {
          const delay = Math.min(1000, 200 * Math.pow(1.5, attempts - 1));
          timer = setTimeout(init, delay);
        } else if (alive) {
          // If retries are exhausted, set ready so the app does not hang forever on splash,
          // having given transient cold-start database locks multiple chances to clear.
          setReady(true);
        }
      }
    };

    void init();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [refreshAll]);

  // Lightweight, App.tsx-level badge count for the Settings "Tax relief" row: refreshed on
  // boot only, not kept in sync with every tag mutation made inside TaxScreen.tsx (which
  // manages its own `tags` state, reloaded after every change there). See taxRequestableCount.
  useEffect(() => {
    if (!ready) return;
    listReliefTags(yaForDate(todayKey())).then(setReliefTags).catch(() => {});
  }, [ready]);

  // The home-screen widget shows a streak count and seven dots and nothing else. Fixing a typo
  // in a remark changes neither, so the payload is compared before anything crosses the native
  // bridge — otherwise every ledger edit re-rendered and re-pushed the widget for no visible
  // difference.
  const lastWidgetPayload = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const now = new Date();
    const payload = `${computeStreak(transactions, now)}|${compute7DayDots(transactions, now)
      .map((d) => (d ? '1' : '0'))
      .join('')}`;
    if (lastWidgetPayload.current === payload) return;
    lastWidgetPayload.current = payload;
    syncStreakWidget(transactions).catch(() => {});
    syncQuickRecordWidget(transactions).catch(() => {});
  }, [ready, transactions]);

  // Spend a banked freeze the moment it's actually needed (docs/ui-engagement-plan.md Step 4).
  // Paused streaks never lapse in the first place, so there is nothing for a freeze to bridge
  // while `streakPausedSinceDay` is set. Persisting `spentForLastDay` alongside `available:
  // false` is what keeps `computeStreakWithFreeze` bridging the *same* gap on every later render
  // without this effect re-firing (see that function's own comment).
  useEffect(() => {
    if (!ready || streakPausedSinceDay !== null) return;
    const { freezeSpent } = computeStreakWithFreeze(transactions, streakFreeze, new Date());
    if (!freezeSpent) return;
    const last = lastActiveDay(transactions, new Date());
    const next: StreakFreezeState = { ...streakFreeze, available: false, spentForLastDay: last };
    setStreakFreezeState(next);
    void setMeta(STREAK_FREEZE_AVAILABLE_KEY, 'false');
    void setMeta(STREAK_FREEZE_SPENT_FOR_KEY, last === null ? '' : String(last));
  }, [ready, transactions, streakFreeze, streakPausedSinceDay]);

  const streak = useMemo(
    () => computeStreakPaused(transactions, streakPausedSinceDay, new Date()),
    [transactions, streakPausedSinceDay]
  );
  const { streak: liveStreakForFreeze } = useMemo(
    () => computeStreakWithFreeze(transactions, streakFreeze, new Date()),
    [transactions, streakFreeze]
  );
  // While paused the pause-frozen value governs (a pause always wins); otherwise the
  // freeze-aware figure does, since it's a superset of the plain streak that also bridges a
  // banked freeze.
  const effectiveStreak = streakPausedSinceDay !== null ? streak : liveStreakForFreeze;
  const { days: streakWeek, todayIndex: streakTodayIndex } = useMemo(
    () => computeWeekRing(transactions, new Date()),
    [transactions]
  );
  const streakGraduated = useMemo(() => isStreakGraduated(effectiveStreak), [effectiveStreak]);
  const streakStartLabel = useMemo(() => {
    const startDay = streakStartDay(transactions, new Date());
    if (startDay === null) return null;
    const d = new Date(startDay * 86_400_000);
    return `Logging since ${monthLabel(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)}`;
  }, [transactions]);

  // Fires the Home fire-burst (see DashboardScreen's StreakCelebration): a save that extends the
  // streak to a new day, freeze-bridged or not, bumps this token once. `null` on the ref means
  // "haven't seen a real value yet" so the very first load (0 → N, or N on a returning user)
  // never celebrates  only a genuine increase from an already-known value does.
  const [streakCelebrationToken, setStreakCelebrationToken] = useState(0);
  const prevEffectiveStreakRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (prevEffectiveStreakRef.current !== null && effectiveStreak > prevEffectiveStreakRef.current) {
      setStreakCelebrationToken((t) => t + 1);
    }
    prevEffectiveStreakRef.current = effectiveStreak;
  }, [ready, effectiveStreak]);

  /**
   * Targeted refresh for split actions, mirroring `refreshLoanState`. Accounts and balance
   * entries come along because every split action moves the receivable, and a settlement moves
   * the account the money landed in too.
   */
  const refreshSplitState = useCallback(async () => {
    const [peopleRows, splitRows, shareRows, paymentRows, accts] = await Promise.all([
      dbListPeople(),
      dbListSplits(),
      dbListShares(),
      dbListPayments(),
      listAccounts(),
    ]);
    setPeople(peopleRows);
    setSplits(splitRows);
    setShares(shareRows);
    setSplitPayments(paymentRows);
    await reconcileReceivable(shareRows, accts, splitRows);
    const [finalAccts, finalEntries] = await Promise.all([listAccounts(), listBalanceEntries()]);
    setAccounts(finalAccts);
    setBalanceEntries(finalEntries);
  }, []);

  const catById = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  /** Open shares, joined once here so the matching and the Owed screen read the same rows. */
  const openShares = useMemo<OpenShare[]>(() => {
    const txnById: Record<string, Transaction> = {};
    for (const t of transactions) txnById[t.id] = t;
    const splitById: Record<string, Split> = {};
    for (const s of splits) splitById[s.id] = s;
    const personById: Record<string, Person> = {};
    for (const p of people) personById[p.id] = p;

    return shares
      .filter((s) => s.status === 'open')
      .map((s) => {
        const split = splitById[s.splitId];
        const txn = txnById[split?.txnId ?? ''];
        return {
          shareId: s.id,
          personId: s.personId,
          personName: personById[s.personId]?.name ?? 'Someone',
          outstanding: outstanding(s),
          billDate: txn?.date ?? txn?.createdAt ?? null,
          merchant: txn?.merchantRaw ?? 'A shared bill',
          currency: split?.currency ?? txn?.currency ?? BASE_CURRENCY,
          fxRate: split?.fxRate ?? txn?.fxRate ?? null,
          remark: txn?.remark ?? null,
          categoryId: txn?.categoryId ?? null,
          gross: split?.gross ?? txn?.amount ?? outstanding(s),
          owed: s.owed,
          paid: s.paid,
        };
      })
      .filter((s) => s.outstanding > 0);
  }, [shares, splits, transactions, people]);

  // Value per account: qty × live price for holdings, else its latest balance entry.
  const accountValues = useMemo(
    () => mergeAccountValues(accounts, balanceEntries, prices),
    [accounts, balanceEntries, prices]
  );

  const pricesAsOf = useMemo(() => {
    const times = Object.values(prices).map((q) => q.asOf);
    return times.length ? times.sort()[times.length - 1] : null;
  }, [prices]);

  const addCategory = useCallback(
    async (label: string, icon: string, hue: number, kind: Category['kind']) => {
      const created = await dbAddCategory(label, icon, hue, kind);
      setCategories(await listCategories());
      return created.id;
    },
    []
  );

  const deleteCategory = useCallback(async (id: string) => {
    await dbDeleteCategory(id);
    const [cats, txns, mem, alloc] = await Promise.all([
      listCategories(),
      listTransactions(),
      getMemoryMap(),
      getAllocations(),
    ]);
    setCategories(cats);
    setTransactions(txns);
    setMemory(mem);
    setAlloc(alloc);
  }, []);

  const updateCategoryIcon = useCallback(async (id: string, icon: string) => {
    await dbUpdateCategoryIcon(id, icon);
    setCategories(await listCategories());
  }, []);

  const updateCategoryLabel = useCallback(async (id: string, label: string) => {
    await dbUpdateCategoryLabel(id, label);
    setCategories(await listCategories());
  }, []);

  const commitCategorized = useCallback(
    async (
      items: ExtractedTxn[],
      assignments: (string | null)[],
      source: TxnSource = 'extracted',
      splitDrafts?: (SplitDraft | null)[],
      receiptUris?: (string | null)[]
    ) => {
      const newLearned: NewLearned[] = [];
      const toInsert: NewTxn[] = [];
      // Parallel to `toInsert` rather than to `items`: dropped rows never reach the insert, so
      // the two arrays would fall out of step if this were indexed off the original items.
      const draftFor: (SplitDraft | null)[] = [];

      const cachedFx = ratesFromCache(await listFxRates());
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const a = assignments[i];
        if (a === DROP) continue; // user chose not to record this item

        const categoryId = a ?? (it.type === 'income' ? DEFAULT_INCOME_ID : DEFAULT_EXPENSE_ID);
        const key = merchantKey(it.merchant);
        const draft = splitDrafts?.[i] ?? null;

        // Learn the merchant -> category for both expenses and income, only if merchant is non-empty.
        if (key) {
          if (!(key in memory)) newLearned.push({ merchant: it.merchant, categoryId });
          await upsertMemory(key, categoryId);
        }

        const currency = it.currency ?? BASE_CURRENCY;
        const fxRate = it.fxRate !== undefined ? it.fxRate : (currency !== BASE_CURRENCY ? rateFor(cachedFx, currency) : null);

        toInsert.push({
          merchantRaw: it.merchant,
          merchantKey: key,
          // A split row records only what the payer consumed. The full amount that left the
          // account is kept on the split, so the screenshot line stays reconstructable and the
          // row can honestly keep its `extracted` provenance.
          amount: draft ? draft.ownShare : it.amount,
          type: it.type,
          date: it.date,
          categoryId,
          source,
          remark: it.remark,
          receiptUri: receiptUris?.[i] ?? null,
          currency,
          fxRate,
        });
        draftFor.push(draft);
      }

      const created = await addTransactions(toInsert);

      let splitCount = 0;
      for (let i = 0; i < created.length; i++) {
        const draft = draftFor[i];
        if (!draft || draft.shares.length === 0) continue;
        await dbCreateSplit(created[i].id, draft);
        splitCount++;
      }

      const [txns, mem] = await Promise.all([listTransactions(), getMemoryMap()]);
      setTransactions(txns);
      setMemory(mem);
      if (splitCount > 0) await refreshSplitState();

      if (created.length > 0) {
        if (source === 'manual') {
          void setMeta(TUTORIAL_MANUAL_DONE_KEY, 'true');
          setTutorialManualDoneState(true);
        } else {
          void setMeta(TUTORIAL_SCAN_DONE_KEY, 'true');
          setTutorialScanDoneState(true);
        }
      }

      return { created, newLearned };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memory]
  );

  const applyReliefDetection = useCallback(async (created: Transaction[], receipt: ScannedReceipt | null) => {
    // Everything below is best-effort and rides on the save path. The whole point of this
    // feature is that it costs the user nothing, so a failure in here must never be allowed to
    // propagate into the caller and abort the save it is hitching a ride on.
    try {
      if (created.length === 0) return;
      const reliefMemory = await getReliefMemoryMap();
      // Line items only ever apply to the single-transaction receipt-scan path; a batch
      // (screenshot import) save always passes receipt: null from AddFlow.tsx.
      const singleItemReceipt = created.length === 1 ? receipt : null;
      for (const txn of created) {
        if (!txn.date) continue;
        const ya = yaForDate(txn.date);
        const schedule = scheduleForYA(ya);
        if (!schedule) continue;
        const match = matchRelief(txn, singleItemReceipt, reliefMemory, schedule);
        if (!match) continue;
        await addReliefTag({ txnId: txn.id, code: match.code, ya, amount: match.amount, origin: 'auto' });
      }
    } catch {
      // Silent by design: no tag is a fine outcome, a broken save is not.
    }
  }, []);

  const saveTransactionEdits = useCallback(
    async (
      txn: Transaction,
      edits: { amount: number; type: TxnType; categoryId: string | null; remark?: string | null }
    ) => {
      const patch = await updateTransactionFields(txn.id, edits.amount, edits.type, edits.categoryId, edits.remark);
      // Correcting a category re-teaches Pip for that merchant (expense or income), only if
      // merchant is non-empty. A transfer has no category, so there is nothing to teach.
      const learnedKey = txn.merchantKey && edits.categoryId ? txn.merchantKey : null;
      if (learnedKey) await upsertMemory(learnedKey, edits.categoryId!);
      // Patch the one row, rather than re-reading (and re-mapping) the whole ledger to learn
      // what this edit just did. `patch` carries the re-derived amount/nativeAmount straight
      // from the write, so the in-memory row matches the SQLite row column for column.
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...patch } : t)));
      if (learnedKey) setMemory((prev) => ({ ...prev, [learnedKey]: edits.categoryId! }));
    },
    []
  );

  const addPerson = useCallback(
    async (name: string) => {
      const person = await dbFindOrCreatePerson(name);
      setPeople(await dbListPeople());
      return person;
    },
    []
  );

  const renamePerson = useCallback(async (id: string, name: string) => {
    await dbRenamePerson(id, name);
    setPeople(await dbListPeople());
  }, []);

  /**
   * Split a transaction that is already in the ledger. The row drops to the payer's own share
   * and the rest becomes a receivable, so the same bill now reads as what was consumed rather
   * than what was fronted.
   */
  const splitTransaction = useCallback(
    async (txn: Transaction, draft: SplitDraft) => {
      const patch = await updateTransactionAmount(txn.id, draft.ownShare);
      await dbCreateSplit(txn.id, draft);
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...patch } : t)));
      await refreshSplitState();
    },
    [refreshSplitState]
  );

  /** Undo a split, putting the whole amount that left the account back on the row. */
  const unsplitTransaction = useCallback(
    async (txn: Transaction) => {
      const split = splits.find((s) => s.txnId === txn.id);
      if (!split) return;
      const patch = await updateTransactionAmount(txn.id, split.gross);
      await dbDeleteSplitsForTxns([txn.id]);
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...patch } : t)));
      await refreshSplitState();
    },
    [splits, refreshSplitState]
  );

  /**
   * Give up on a share. The money that never came back was consumption after all, so it becomes
   * a real expense dated today, carrying the original bill's category, and the share is stamped
   * with that transaction so the write-off stays traceable.
   */
  const writeOffShare = useCallback(
    async (shareId: string) => {
      const share = shares.find((s) => s.id === shareId);
      if (!share || share.status !== 'open') return;
      const amount = outstanding(share);
      if (amount <= 0) return;

      const split = splits.find((s) => s.id === share.splitId);
      const origin = split ? transactions.find((t) => t.id === split.txnId) : undefined;
      const person = people.find((p) => p.id === share.personId);
      const currency = split?.currency ?? origin?.currency ?? BASE_CURRENCY;
      const fxRate = split?.fxRate ?? origin?.fxRate ?? null;

      const [created] = await addTransactions([
        {
          merchantRaw: origin?.merchantRaw ?? 'Written-off split',
          merchantKey: origin?.merchantKey ?? 'written-off split',
          amount,
          currency,
          fxRate,
          type: 'expense',
          date: todayKey(),
          categoryId: origin?.categoryId ?? DEFAULT_EXPENSE_ID,
          source: 'manual',
          remark: person ? `Written off: ${person.name} never paid this back` : 'Written-off split',
        },
      ]);
      await dbWriteOffShare(shareId, created.id);
      setTransactions(await listTransactions());
      await refreshSplitState();
    },
    [shares, splits, transactions, people, refreshSplitState]
  );

  const saveBudget = useCallback(async (income: number, alloc: Record<string, number>) => {
    // A category left at (or set to) RM 0 isn't a budget for it, so it's dropped before it's ever
    // persisted or shown as one.
    const clean = positiveAllocations(alloc);
    await setExpectedIncome(income);
    await dbSetAllocations(clean);
    // Keep the current month's snapshot in step with the live plan.
    const cur = monthKey(new Date().toISOString())!;
    await upsertSnapshot(cur, income, clean);
    setIncome(income);
    setAlloc(clean);
    setSnapshots((prev) => ({ ...prev, [cur]: { income, allocations: clean } }));
  }, []);

  const setReminderCadence = useCallback(async (cadence: ReminderCadence) => {
    await setMeta(REMINDER_CADENCE_KEY, cadence);
    setReminderCadenceState(cadence);
  }, []);

  const setReminderHourOverride = useCallback(async (hour: number | null) => {
    await setMeta(REMINDER_HOUR_OVERRIDE_KEY, hour === null ? '' : String(hour));
    setReminderHourOverrideState(hour);
  }, []);

  const setOwedReminderEnabled = useCallback(async (on: boolean) => {
    await setMeta(OWED_REMINDER_KEY, on ? 'true' : 'false');
    setOwedReminderEnabledState(on);
  }, []);

  const setCommitmentReminderEnabled = useCallback(async (on: boolean) => {
    await setMeta(COMMITMENT_REMINDER_KEY, on ? 'true' : 'false');
    setCommitmentReminderEnabledState(on);
  }, []);

  const setMotionSetting = useCallback(async (setting: MotionSetting) => {
    await setMeta(MOTION_SETTING_KEY, setting);
    setMotionSettingState(setting);
    setHapticsEnabled(setting !== 'off');
  }, []);

  const setSoundEnabled = useCallback(async (on: boolean) => {
    await setMeta(SOUND_ENABLED_KEY, on ? 'true' : 'false');
    setSoundEnabledState(on);
    applySoundEnabled(on);
  }, []);

  const pauseStreak = useCallback(async () => {
    // Local, matching every other day number the streak reasons in (see `localDayNumber`):
    // a UTC one would freeze the streak on yesterday for anyone pausing in the small hours.
    const today = localDayNumber(new Date());
    await setMeta(STREAK_PAUSED_SINCE_KEY, String(today));
    setStreakPausedSinceDayState(today);
  }, []);

  const resumeStreak = useCallback(async () => {
    await setMeta(STREAK_PAUSED_SINCE_KEY, '');
    setStreakPausedSinceDayState(null);
  }, []);

  const resetBudget = useCallback(async () => {
    await clearBudget();
    setIncome(0);
    setAlloc({});
  }, []);

  const resetAllData = useCallback(async () => {
    await dbResetAllData();
    await Promise.all([
      setMeta(TUTORIAL_SCAN_DONE_KEY, 'false'),
      setMeta(TUTORIAL_MANUAL_DONE_KEY, 'false'),
      setMeta(TUTORIAL_DISMISSED_KEY, 'false'),
      setMeta(EXPLORE_TASKS_DONE_KEY, '[]'),
    ]);
    await refreshAll();
  }, [refreshAll]);

  // `refreshAll` matters as much here as in `resetAllData` above, and is easy to miss because
  // the wizard that follows makes it *look* like a fresh start. Without it SQLite is genuinely
  // wiped while every array in this provider still holds the pre-reset data, so the user
  // finishes onboarding and lands on a Dashboard rendering transactions, balances, splits and
  // commitments that no longer exist — and deleting one of those ghosts runs a DELETE against
  // an id that isn't there. Nothing else reloads it: App.tsx's "active" listener only syncs the
  // streak widget. Only force-quitting the app used to clear it.
  const resetToOnboarding = useCallback(async () => {
    await dbResetAllData();
    await Promise.all([
      setMeta(ONBOARDING_KEY, 'false'),
      setMeta(TUTORIAL_SCAN_DONE_KEY, 'false'),
      setMeta(TUTORIAL_MANUAL_DONE_KEY, 'false'),
      setMeta(TUTORIAL_DISMISSED_KEY, 'false'),
      setMeta(EXPLORE_TASKS_DONE_KEY, '[]'),
    ]);
    await refreshAll();
    setOnboardingComplete(false);
  }, [refreshAll]);

  const addAccount = useCallback(
    async (name: string, kind: AccountKind, cls: string, openingValue: number, asOf: string, icon?: string | null, currency?: string, interestRate?: number | null) => {
      const created = await dbAddAccount(name, kind, cls, openingValue, asOf, icon, currency, interestRate);
      const [accts, entries] = await Promise.all([listAccounts(), listBalanceEntries()]);
      setAccounts(accts);
      setBalanceEntries(entries);
      return created.id;
    },
    []
  );

  // Every transaction is tied to an account now, so the add flows need a guaranteed
  // default. Prefer an existing cash account; otherwise create a "Cash" one (opening
  // balance 0, dated today). Returns the account id to preselect.
  //
  // The new account takes the user's entry currency, not ringgit. This account is created
  // silently behind someone's very first expense, so hardcoding MYR here quietly denominated
  // the whole ledger in a currency the user never chose: an SGD expense would be converted
  // into an MYR account and every balance shown back to them read "RM".
  const ensureDefaultAccount = useCallback(async (): Promise<string> => {
    const activeAccts = accounts.filter((a) => !a.archived);
    const existing = activeAccts.find((a) => a.cls === 'cash') ?? activeAccts[0];
    if (existing) return existing.id;
    const currency = await getEntryCurrency();
    const created = await dbAddAccount('Cash', 'asset', 'cash', 0, new Date().toISOString().slice(0, 10), null, currency);
    const [accts, entries] = await Promise.all([listAccounts(), listBalanceEntries()]);
    setAccounts(accts);
    setBalanceEntries(entries);
    return created.id;
  }, [accounts]);

  const updateAccount = useCallback(async (id: string, fields: Parameters<typeof dbUpdateAccount>[1]) => {
    await dbUpdateAccount(id, fields);
    setAccounts(await listAccounts());
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    await dbDeleteAccount(id);
    const [accts, entries] = await Promise.all([listAccounts(), listBalanceEntries()]);
    setAccounts(accts);
    setBalanceEntries(entries);
  }, []);

  const setBalance = useCallback(async (accountId: string, value: number, asOf: string) => {
    await dbAddBalanceEntry(accountId, value, asOf);
    setBalanceEntries(await listBalanceEntries());
  }, []);

  // A linked transaction nudges an account's balance: new = current ± amount. `amount` must
  // already be in the target account's own currency: `balance_entries.value` is native to
  // the account (Task 9), never assumed MYR, so every caller is responsible for converting
  // a MYR-denominated figure (via `deriveNative`) before it reaches here.
  const recordBalanceLink = useCallback(
    async (accountId: string, amount: number, effect: LinkEffect, asOf: string) => {
      const entries = await listBalanceEntries();
      const mine = entries.filter((e) => e.accountId === accountId);
      const current = currentValue(mine);
      // The adjustment must become the account's CURRENT reading, otherwise net worth
      // (which reads the latest-dated entry) won't move. A linked txn is often dated
      // in the past — a scanned statement, or a back-dated manual entry — and stamping
      // the new entry at that past date would let an existing, more-recent reading
      // shadow it. So never date it before the latest reading we already have.
      const latestAsOf = mine.reduce((m, e) => (e.asOf > m ? e.asOf : m), '');
      const effectiveAsOf = asOf > latestAsOf ? asOf : latestAsOf;
      await dbAddBalanceEntry(accountId, applyEffect(current, amount, effect), effectiveAsOf);
      setBalanceEntries(await listBalanceEntries());
    },
    []
  );

  const addHolding = useCallback(
    async (name: string, sub: string, symbol: string, ticker: string, quantity: number, cost: number | null, icon?: string | null, interestRate?: number | null) => {
      const created = await dbAddHolding(name, sub, symbol, ticker, quantity, cost, icon, interestRate);
      setAccounts(await listAccounts());
      return created.id;
    },
    []
  );

  const updateHoldingQuantity = useCallback(async (id: string, quantity: number) => {
    await dbUpdateHoldingQuantity(id, quantity);
    setAccounts(await listAccounts());
  }, []);

  const setHoldingCost = useCallback(async (id: string, cost: number | null) => {
    await dbUpdateHoldingCost(id, cost);
    setAccounts(await listAccounts());
  }, []);

  // Fetch live prices for all holdings, cache them, and snapshot today's value
  // for each holding so the net-worth history keeps building.
  const refreshPrices = useCallback(async () => {
    await refreshFxRates().catch(() => {});
    const accts = await listAccounts();
    const quotes = await fetchPrices(accts);
    if (quotes.length === 0) return;
    const day = todayKey();
    for (const q of quotes) await upsertPrice(q);
    const bySymbol: Record<string, PriceQuote> = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
    for (const a of accts) {
      if (isHolding(a) && bySymbol[a.symbol as string]) {
        await upsertDailyBalanceEntry(a.id, holdingValue(a.quantity as number, bySymbol[a.symbol as string].priceMYR), day);
      }
    }
    const [cache, entries] = await Promise.all([getPriceCache(), listBalanceEntries()]);
    setPrices((prev) => ({ ...prev, ...Object.fromEntries(cache.map((q) => [q.symbol, q])) }));
    setBalanceEntries(entries);

    // A DCA tick into a holding with no cached price yet only moved `cost` at pay time (see
    // `payCommitment`); now that a fresh quote exists, resolve the deferred unit count for any
    // occurrence still waiting on one, so quantity does not permanently lag cost.
    const pending = commitmentOccurrences.filter(
      (o) => o.unitsAdded === null && (o.status === 'paid' || o.status === 'late') && o.paidAmount != null
    );
    if (pending.length > 0) {
      const acctById: Record<string, Account> = Object.fromEntries(accts.map((a) => [a.id, a]));
      const commitmentById: Record<string, Commitment> = Object.fromEntries(commitments.map((c) => [c.id, c]));
      // Running quantity per account, not `target.quantity` read fresh each time: two pending
      // occurrences resolving into the same holding in one pass would otherwise each base their
      // write on the same pre-loop snapshot and the first unit count would be clobbered.
      const runningQty: Record<string, number> = {};
      let resolvedAny = false;
      for (const occ of pending) {
        const c = commitmentById[occ.commitmentId];
        const target = c?.toAccountId ? acctById[c.toAccountId] : undefined;
        if (!c || c.kind !== 'investment' || !target || !isHolding(target)) continue;
        const quote = bySymbol[target.symbol as string];
        if (!quote) continue;
        const units = Math.round((occ.paidAmount! / quote.priceMYR) * 1e8) / 1e8;
        const base = runningQty[target.id] ?? target.quantity ?? 0;
        const next = base + units;
        runningQty[target.id] = next;
        await dbUpdateHoldingQuantity(target.id, next);
        await dbSetOccurrenceUnits(occ.id, units, quote.priceMYR);
        resolvedAny = true;
      }
      if (resolvedAny) {
        const [finalAccts, occurrenceRows] = await Promise.all([listAccounts(), dbListOccurrences()]);
        setAccounts(finalAccts);
        setCommitmentOccurrences(occurrenceRows);
      }
    }
  }, [commitmentOccurrences, commitments]);

  // --- Recurring commitments (bills + DCA investments) -----------------------------------

  const addCommitmentEntry = useCallback(
    async (input: {
      label: string;
      kind: CommitmentKind;
      amount: number;
      dueDay: number;
      categoryId?: string | null;
      fromAccountId?: string | null;
      toAccountId?: string | null;
      startMonth?: string;
      currency?: string;
    }): Promise<void> => {
      await dbAddCommitment({
        label: input.label,
        merchantKey: merchantKey(input.label),
        kind: input.kind,
        amount: input.amount,
        categoryId: input.kind === 'investment' ? null : input.categoryId ?? null,
        fromAccountId: input.fromAccountId ?? null,
        toAccountId: input.kind === 'investment' ? input.toAccountId ?? null : null,
        dueDay: input.dueDay,
        startMonth: input.startMonth ?? currentMonthKey(),
        currency: input.currency,
      });
      await dbEnsureOccurrences(new Date());
      await refreshCommitmentState();
    },
    [refreshCommitmentState]
  );

  const updateCommitmentEntry = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Commitment, 'label' | 'amount' | 'categoryId' | 'fromAccountId' | 'toAccountId' | 'dueDay' | 'endMonth' | 'reliefCode'>>
    ) => {
      await dbUpdateCommitment(id, patch);
      await refreshCommitmentState();
    },
    [refreshCommitmentState]
  );

  /** Stops future occurrences; every occurrence already generated (and its paid history) is
   *  untouched, so a discontinued bill keeps counting toward the on-time record. */
  const archiveCommitmentEntry = useCallback(async (id: string) => {
    await dbArchiveCommitment(id);
    await refreshCommitmentState();
  }, [refreshCommitmentState]);

  const deleteCommitmentEntry = useCallback(async (id: string) => {
    await dbDeleteCommitment(id);
    await refreshCommitmentState();
  }, [refreshCommitmentState]);

  /**
   * Import commitments parsed from a version-2 Advanced Import JSON (see advancedImport.ts).
   * Idempotent: a commitment whose merchantKey + dueDay already exists is skipped rather than
   * duplicated, so re-importing the same file (or the same file on a second device) is safe.
   * Category/account names are resolved against what already exists locally on a best-effort
   * basis — an unresolved account name leaves that side unset rather than guessing wrong, the
   * same posture AdvancedImportScreen already takes for a transaction's account match.
   */
  const importParsedCommitments = useCallback(
    async (parsed: ParsedCommitment[]) => {
      const existingKeys = new Set(commitments.map((c) => `${c.merchantKey}::${c.dueDay}`));
      const accountByName = new Map(accounts.map((a) => [a.name.trim().toLowerCase(), a.id]));
      const resolveAccount = (name: string | null) =>
        name ? accountByName.get(name.trim().toLowerCase()) ?? null : null;

      for (const p of parsed) {
        const key = `${merchantKey(p.label)}::${p.dueDay}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        const categoryId = p.kind === 'investment' ? null : matchSourceCategory(p.category, categories, 'expense') ?? DEFAULT_EXPENSE_ID;
        const created = await dbAddCommitment({
          label: p.label,
          merchantKey: merchantKey(p.label),
          kind: p.kind,
          amount: p.amount,
          categoryId,
          fromAccountId: resolveAccount(p.fromAccount),
          toAccountId: p.kind === 'investment' ? resolveAccount(p.toAccount) : null,
          dueDay: p.dueDay,
          startMonth: p.startMonth,
          endMonth: p.endMonth,
          currency: p.currency ?? BASE_CURRENCY,
        });
        for (const occ of p.occurrences) {
          await dbInsertOccurrence(created.id, {
            dueDate: occ.dueDate,
            amount: occ.paidAmount ?? p.amount,
            status: occ.status,
            paidOn: occ.paidOn,
            paidAmount: occ.paidAmount,
          });
        }
      }
      await dbEnsureOccurrences(new Date());
      await refreshCommitmentState();
    },
    [commitments, accounts, categories, refreshCommitmentState]
  );

  /** Transactions already linked to some occurrence, so a tick's match search never re-links
   *  a row a different occurrence already claims. */
  const linkedTxnIds = useMemo(
    () => new Set(commitmentOccurrences.filter((o) => o.txnId).map((o) => o.txnId as string)),
    [commitmentOccurrences]
  );

  const resolveCommitmentMatch = useCallback(
    (occurrenceId: string): Transaction | null => {
      const occurrence = commitmentOccurrences.find((o) => o.id === occurrenceId);
      const commitment = occurrence ? commitments.find((c) => c.id === occurrence.commitmentId) : undefined;
      if (!occurrence || !commitment) return null;
      const wantType: TxnType = commitment.kind === 'investment' ? 'transfer' : 'expense';
      const candidates = transactions.filter((t) => t.type === wantType);
      const exclude = new Set(linkedTxnIds);
      exclude.delete(occurrence.txnId ?? '');
      return findCommitmentMatch(candidates, commitment, occurrence.dueDate, exclude);
    },
    [commitmentOccurrences, commitments, transactions, linkedTxnIds]
  );

  /** Read-only preview of what `payCommitment` would link, for a confirm-before-linking tick UI. */
  const previewCommitmentMatch = resolveCommitmentMatch;

  /**
   * Tag the transaction behind a paid commitment occurrence against the commitment's mapped
   * relief line. Idempotent on `(txnId, code)`: pay -> unpay -> pay again on the matched-row
   * branch leaves the transaction in place, and a row auto-tagged from merchant memory can
   * later have its commitment ticked, so an unconditional insert would stack duplicates that
   * double-count against the cap. Wrapped in try/catch for the same reason as
   * `applyReliefDetection`: this rides on the pay path and must never be able to break it.
   */
  const tagCommitmentRelief = useCallback(async (code: string, txnId: string, paidOn: string, amount: number) => {
    try {
      const ya = yaForDate(paidOn);
      if (!scheduleForYA(ya)) return;
      const existing = await getReliefTagsForTxn(txnId);
      if (existing.some((t) => t.code === code)) return;
      await addReliefTag({ txnId, code, ya, amount, origin: 'commitment' });
    } catch {
      // Silent by design: no tag is a fine outcome, a broken payment tick is not.
    }
  }, []);

  /**
   * A commitment's `amount` (and its occurrences' `paidAmount`) has no currency concept of its
   * own: it's always MYR. `recordBalanceLink`, though, now needs the target account's OWN
   * currency (Task 9: `balance_entries.value` is native, not always MYR), so every commitment
   * payment path below converts through this first. A deleted/missing account falls back to
   * MYR (nothing to convert against); `deriveNative`/`rateFor` already no-op for a MYR account.
   */
  const nativeForAccount = useCallback(
    (myrAmount: number, accountId: string, rates: Record<string, number>): number => {
      const account = accounts.find((a) => a.id === accountId);
      const currency = account?.currency ?? BASE_CURRENCY;
      return deriveNative(myrAmount, currency, rateFor(rates, currency));
    },
    [accounts]
  );

  /**
   * Work out how to undo the money a commitment tick moved: the deduction from the funding
   * account, and the cost basis (and units) it added to an investment target. Throws if a rate
   * it needs is missing; writes nothing.
   *
   * Shared, because unticking on the Commitments screen and deleting the tick's ledger row from
   * the Activity list are the same event reached two ways, and only the first used to reverse
   * anything.
   */
  const planOccurrenceReversal = useCallback(
    async (occurrence: CommitmentOccurrence): Promise<OccurrenceReversal | null> => {
      const commitment = commitments.find((c) => c.id === occurrence.commitmentId);
      if (!commitment) return null;

      const paidAmount = occurrence.paidAmount ?? occurrence.amount;
      // Same MYR-to-native conversion as payCommitment, for the same reason.
      const rates = ratesFromCache(await listFxRates());
      const fxRate =
        occurrence.fxRate ?? (commitment.currency === BASE_CURRENCY ? null : rateFor(rates, commitment.currency));
      const myrPaidAmount = fxRate != null ? occurrenceMyr(paidAmount, fxRate) : paidAmount;
      const investTarget =
        commitment.kind === 'investment' && commitment.toAccountId
          ? accounts.find((a) => a.id === commitment.toAccountId)
          : undefined;
      const holding = investTarget && isHolding(investTarget) ? investTarget : null;
      const cashTarget = investTarget && !isHolding(investTarget) ? investTarget : null;

      return {
        fromAccountId: commitment.fromAccountId ?? null,
        fromNative: commitment.fromAccountId
          ? nativeForAccount(myrPaidAmount, commitment.fromAccountId, rates)
          : 0,
        holdingId: holding?.id ?? null,
        unitsAdded: occurrence.unitsAdded,
        costMyr: myrPaidAmount,
        cashTargetId: cashTarget?.id ?? null,
        cashTargetNative: cashTarget ? nativeForAccount(myrPaidAmount, cashTarget.id, rates) : 0,
      };
    },
    [commitments, accounts, nativeForAccount]
  );

  const applyOccurrenceReversal = useCallback(
    async (plan: OccurrenceReversal) => {
      const today = todayKey();
      if (plan.fromAccountId) {
        await recordBalanceLink(plan.fromAccountId, plan.fromNative, 'add', today);
      }
      if (plan.holdingId) {
        // Subtracted in SQL and clamped at zero (see `adjustHoldingQuantity`). Reading the
        // holding out of `accounts` and writing back an absolute figure used to send a
        // brand-new holding NEGATIVE on the first untick, and net worth with it.
        if (plan.unitsAdded != null) await dbAdjustHoldingQuantity(plan.holdingId, -plan.unitsAdded);
        await dbAdjustHoldingCost(plan.holdingId, -plan.costMyr);
        setAccounts(await listAccounts());
      } else if (plan.cashTargetId) {
        await recordBalanceLink(plan.cashTargetId, plan.cashTargetNative, 'subtract', today);
      }
    },
    [recordBalanceLink]
  );

  // Deleting a transaction takes its split with it: a receivable with no bill behind it is a
  // claim on nothing, and leaving the shares would keep inflating net worth forever. Its relief
  // tags go the same way, for the same reason: a tag on a deleted transaction would keep
  // counting toward a year's claimed total with nothing left to point at.
  //
  // A commitment occurrence goes the same way, and this is the whole reason these two live
  // down here rather than up with the other transaction actions: a row created by ticking a
  // bill paid is the ledger half of that tick, so deleting it has to undo the tick. It used to
  // leave the Commitments screen showing the month ticked and paid, linked to a transaction
  // that no longer existed, with the account deduction still applied — and unticking from
  // there posted a compensating entry for a row it could no longer find. The occurrences are
  // read from SQLite rather than from `commitmentOccurrences`, so a state array that has not
  // caught up cannot cause one to be missed.
  const removeTransactions = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const occurrences = await listOccurrencesByTxnIds(ids);

      // Planned for the WHOLE batch before any of it is applied, so a missing rate on the
      // third row cannot leave the first two half-reversed. Only a tick that CREATED its row
      // moved money; one that merely matched a transaction the user had already logged never
      // did, so there is nothing of ours to reverse — but its link is still cleared below.
      let plans: OccurrenceReversal[];
      try {
        const planned = await Promise.all(
          occurrences.map((occ) => (occ.txnCreated ? planOccurrenceReversal(occ) : Promise.resolve(null)))
        );
        plans = planned.filter((p): p is OccurrenceReversal => p !== null);
      } catch (e) {
        notify("Couldn't delete this", e instanceof Error ? e.message : 'A currency conversion failed.');
        return;
      }
      for (const plan of plans) await applyOccurrenceReversal(plan);

      await deleteTransactions(ids);
      await dbDeleteSplitsForTxns(ids);
      await dbDeleteReliefTagsForTxns(ids);
      for (const occ of occurrences) await dbResetOccurrence(occ.id);

      // Exactly these ids left the table and nothing above writes a transaction, so dropping
      // them from the array in hand is the same answer as re-reading every remaining row.
      const removed = new Set(ids);
      setTransactions((prev) => prev.filter((t) => !removed.has(t.id)));
      await refreshSplitState();
      if (occurrences.length > 0) await refreshCommitmentState();
    },
    [planOccurrenceReversal, applyOccurrenceReversal, refreshSplitState, refreshCommitmentState]
  );

  const removeTransaction = useCallback((id: string) => removeTransactions([id]), [removeTransactions]);
  const removeMany = useCallback((ids: string[]) => removeTransactions(ids), [removeTransactions]);

  /**
   * Record money received against a share.
   *
   * No income transaction is written, on purpose. Being paid back is not earnings, it is a
   * receivable converting into cash, and booking it as income would inflate the income figures
   * elsewhere in the app. The cash side is a balance movement on whichever account the money
   * landed in; passing no account leaves the cash to arrive with the next balance scan instead.
   *
   * Routed through `recordBalanceLink` (rather than writing `balance_entries` directly, as this
   * used to) so the destination account's own currency is honoured: `amount` here is always MYR
   * (the receivables/split system is MYR-only), and the account picker at both call sites
   * (OwedScreen's SettleSheet, AddFlow's repayment flow) has no currency filter, so the
   * destination can be any active currency. `recordBalanceLink`'s `'add'` effect is exactly
   * what this needs, matching the unconditional `'add'` this code already applied before.
   */
  const settleShare = useCallback(
    async (
      shareId: string,
      amount: number,
      paidOn: string,
      evidence: PaymentEvidence,
      matchedMerchant: string | null,
      accountId: string | null
    ) => {
      const share = shares.find((s) => s.id === shareId);
      const split = share ? splits.find((sp) => sp.id === share.splitId) : undefined;
      const myrAmount =
        split && split.currency !== BASE_CURRENCY && split.fxRate != null
          ? receivableMyr(amount, split.fxRate)
          : amount;

      // The rate is resolved BEFORE dbRecordPayment below: a missing one must fail here, with
      // nothing recorded, rather than marking the share settled with no matching balance
      // movement. The conversion is repeated afterwards against `result.applied` — this first
      // pass exists only to make the failure land before anything is written.
      let rates: Record<string, number> | null = null;
      if (accountId) {
        try {
          rates = ratesFromCache(await listFxRates());
          nativeForAccount(myrAmount, accountId, rates);
        } catch (e) {
          notify("Couldn't record this payment", e instanceof Error ? e.message : 'A currency conversion failed.');
          return;
        }
      }
      const result = await dbRecordPayment(shareId, amount, paidOn, evidence, matchedMerchant, accountId);
      if (!result) return;
      // Credit what the payment ACTUALLY moved, not what was asked for. `recordPayment` caps
      // at the outstanding balance, so a second "Mark settled" on an already-square share (the
      // button has no in-flight guard, and a tap that doesn't feel like it registered invites
      // another) applies nothing and writes no payment row. Crediting `amount` regardless put
      // the money into the account twice, leaving cash and net worth overstated with nothing
      // in the payment history to account for it.
      if (accountId && rates && result.applied > 0) {
        const appliedMyr =
          split && split.currency !== BASE_CURRENCY && split.fxRate != null
            ? receivableMyr(result.applied, split.fxRate)
            : result.applied;
        await recordBalanceLink(accountId, nativeForAccount(appliedMyr, accountId, rates), 'add', paidOn);
      }
      await refreshSplitState();
    },
    [shares, splits, refreshSplitState, recordBalanceLink, nativeForAccount]
  );

  /**
   * Tick a commitment occurrence as paid. Always tries to match an existing ledger row first
   * (same merchant, amount within 5%, dated within a week of the due date) so a bill the user
   * already logged manually — or one that lands via a later bank-statement import — never gets
   * a duplicate row; only when nothing matches does this create one. A DCA (`kind: 'investment'`)
   * commitment logs a `'transfer'`, not an expense, and moves the target account instead of
   * spending it — see Phase 1's guard test for why that distinction has to hold.
   */
  const payCommitment = useCallback(
    async (occurrenceId: string, opts?: { amount?: number; paidOn?: string }): Promise<{ matched: boolean }> => {
      const occurrence = commitmentOccurrences.find((o) => o.id === occurrenceId);
      const commitment = occurrence ? commitments.find((c) => c.id === occurrence.commitmentId) : undefined;
      if (!occurrence || !commitment) return { matched: false };

      const match = resolveCommitmentMatch(occurrenceId);
      if (match) {
        const paidOn = opts?.paidOn ?? match.date ?? match.createdAt.slice(0, 10);
        const status = paidOn <= occurrence.dueDate ? 'paid' : 'late';
        await dbMarkOccurrencePaid(occurrenceId, {
          paidAmount: match.amount,
          paidOn,
          status,
          txnId: match.id,
          txnCreated: false,
        });
        if (commitment.reliefCode) {
          await tagCommitmentRelief(commitment.reliefCode, match.id, paidOn, match.amount);
        }
        await refreshCommitmentState();
        return { matched: true };
      }

      const wantType: TxnType = commitment.kind === 'investment' ? 'transfer' : 'expense';
      const paidAmount = opts?.amount ?? commitment.amount;
      const paidOn = opts?.paidOn ?? todayKey();
      const status = paidOn <= occurrence.dueDate ? 'paid' : 'late';
      const rates = ratesFromCache(await listFxRates());
      const fxRate =
        occurrence.fxRate ??
        (commitment.currency === BASE_CURRENCY ? null : rateFor(rates, commitment.currency));
      const myrPaidAmount = fxRate != null ? occurrenceMyr(paidAmount, fxRate) : paidAmount;

      // The investment target, resolved once up front: both the currency check below and the
      // holding-vs-cost-only branch further down need to know which kind of account it is.
      const investTarget =
        commitment.kind === 'investment' && commitment.toAccountId
          ? accounts.find((a) => a.id === commitment.toAccountId)
          : undefined;

      // Every currency conversion this tick will need, resolved BEFORE any write below. A
      // missing rate must fail here, with nothing created yet, rather than partway through:
      // throwing after `addTransactions` would leave a ledger row with no matching balance
      // movement and the occurrence stuck "scheduled", inviting a duplicate tap.
      let fromNative: number | null = null;
      let targetNative: number | null = null;
      try {
        if (commitment.fromAccountId) {
          fromNative = nativeForAccount(myrPaidAmount, commitment.fromAccountId, rates);
        }
        if (investTarget && !isHolding(investTarget)) {
          targetNative = nativeForAccount(myrPaidAmount, investTarget.id, rates);
        }
      } catch (e) {
        notify("Couldn't record this payment", e instanceof Error ? e.message : 'A currency conversion failed.');
        return { matched: false };
      }

      const created = await addTransactions([
        {
          merchantRaw: commitment.label,
          merchantKey: commitment.merchantKey,
          amount: paidAmount,
          currency: commitment.currency,
          fxRate,
          type: wantType,
          date: paidOn,
          categoryId: commitment.kind === 'investment' ? null : commitment.categoryId,
          source: 'manual',
        },
      ]);
      const txn = created[0];

      if (commitment.fromAccountId && fromNative != null) {
        await recordBalanceLink(commitment.fromAccountId, fromNative, 'subtract', paidOn);
      }

      let unitsAdded: number | null = null;
      let priceMYR: number | null = null;
      if (investTarget) {
        if (isHolding(investTarget)) {
          const quote = prices[investTarget.symbol as string];
          // A holding always moves cost basis; quantity only moves when a price is cached —
          // offline or a brand-new symbol resolves its units later, in `refreshPrices` above.
          //
          // Both movements go through the `adjust*` helpers, which do the addition in SQL.
          // Computing `investTarget.quantity + units` here and writing the result back read
          // from the `accounts` array this closure captured, and nothing below reloaded it:
          // ticking two due months in a row without leaving the Commitments screen had the
          // second tick start from the same pre-tick figure and quietly erase the first
          // month's contribution, with both occurrences still showing a green tick.
          if (quote) {
            unitsAdded = Math.round((myrPaidAmount / quote.priceMYR) * 1e8) / 1e8;
            priceMYR = quote.priceMYR;
            await dbAdjustHoldingQuantity(investTarget.id, unitsAdded);
          }
          await dbAdjustHoldingCost(investTarget.id, myrPaidAmount);
          setAccounts(await listAccounts());
        } else if (targetNative != null) {
          // Cost-only target (ASB, EPF, unit trusts, gold savings): no ticker to size units
          // against, so the account's balance IS the invested-amount tracker.
          await recordBalanceLink(investTarget.id, targetNative, 'add', paidOn);
        }
      }

      await dbMarkOccurrencePaid(occurrenceId, {
        paidAmount,
        paidOn,
        status,
        txnId: txn.id,
        txnCreated: true,
        unitsAdded,
        priceMYR,
      });
      if (commitment.reliefCode) {
        await tagCommitmentRelief(commitment.reliefCode, txn.id, paidOn, myrPaidAmount);
      }
      setTransactions(await listTransactions());
      await refreshCommitmentState();
      return { matched: false };
    },
    [commitmentOccurrences, commitments, accounts, prices, resolveCommitmentMatch, recordBalanceLink, refreshCommitmentState, tagCommitmentRelief, nativeForAccount]
  );

  /**
   * Untick: full reversal, not just a status flip. If the tick created the ledger row, delete
   * it and post a compensating balance entry on every account the tick moved; if the tick only
   * linked a transaction the user already had, leave that row and its history untouched — there
   * is nothing of this feature's making to undo.
   *
   * The reversal itself lives in `removeTransactions` now, not here, because deleting the tick's
   * ledger row from the Activity list has to do exactly the same thing and used to do none of
   * it. So the created-row case simply deletes the row and lets that path run: it reverses the
   * money and resets this occurrence in the same pass.
   */
  const unpayCommitment = useCallback(
    async (occurrenceId: string) => {
      const occurrence = commitmentOccurrences.find((o) => o.id === occurrenceId);
      const commitment = occurrence ? commitments.find((c) => c.id === occurrence.commitmentId) : undefined;
      if (!occurrence || !commitment) return;
      if (occurrence.status !== 'paid' && occurrence.status !== 'late') return;

      if (occurrence.txnCreated && occurrence.txnId) {
        await removeTransactions([occurrence.txnId]);
        return;
      }

      // A tick that created a row but has no id to delete shouldn't happen (`payCommitment`
      // always records both), but the money still moved, so reverse it before resetting.
      if (occurrence.txnCreated) {
        try {
          const plan = await planOccurrenceReversal(occurrence);
          if (plan) await applyOccurrenceReversal(plan);
        } catch (e) {
          notify("Couldn't undo this payment", e instanceof Error ? e.message : 'A currency conversion failed.');
          return;
        }
      }

      await dbResetOccurrence(occurrenceId);
      setTransactions(await listTransactions());
      await refreshCommitmentState();
    },
    [
      commitmentOccurrences,
      commitments,
      removeTransactions,
      planOccurrenceReversal,
      applyOccurrenceReversal,
      refreshCommitmentState,
    ]
  );

  /** For a bill that genuinely did not apply this month — no ledger effect either way. */
  const skipCommitment = useCallback(
    async (occurrenceId: string) => {
      const occurrence = commitmentOccurrences.find((o) => o.id === occurrenceId);
      if (!occurrence || occurrence.status !== 'scheduled') return;
      await dbSkipOccurrence(occurrenceId);
      await refreshCommitmentState();
    },
    [commitmentOccurrences, refreshCommitmentState]
  );

  const getCachedAdvice = useCallback(() => dbGetAdvice(), []);

  const saveAdvice = useCallback(
    async (income: number, alloc: Record<string, number>, text: string) => {
      await dbSetAdvice(budgetHash(income, alloc), text);
    },
    []
  );

  // Decide and persist a loan application for a specific product the user picked.
  // We resolve the requested product and evaluate `decideLoan` against just that one tier
  // (rather than the full ladder): the user is applying for a specific offer, so the
  // decision should reflect whether *that* product is appropriate for them  not silently
  // upgrade/downgrade them to a different tier than the one they asked for. `decideLoan`
  // picks the highest tier the score qualifies for among the `products` it's given, so
  // passing only the requested product makes it evaluate "does this applicant qualify for
  // *this* product" (decline if their score is below this tier's minScore) rather than
  // "what's the best tier for this applicant overall".
  const completeOnboarding = useCallback(async () => {
    await setMeta(ONBOARDING_KEY, 'true');
    setOnboardingComplete(true);
  }, []);

  const completeTutorialScan = useCallback(async () => {
    await setMeta(TUTORIAL_SCAN_DONE_KEY, 'true');
    setTutorialScanDoneState(true);
  }, []);

  const completeTutorialManual = useCallback(async () => {
    await setMeta(TUTORIAL_MANUAL_DONE_KEY, 'true');
    setTutorialManualDoneState(true);
  }, []);

  const dismissTutorial = useCallback(async () => {
    await setMeta(TUTORIAL_DISMISSED_KEY, 'true');
    setTutorialDismissedState(true);
  }, []);

  const resetTutorial = useCallback(async () => {
    await Promise.all([
      setMeta(TUTORIAL_SCAN_DONE_KEY, 'false'),
      setMeta(TUTORIAL_MANUAL_DONE_KEY, 'false'),
      setMeta(TUTORIAL_DISMISSED_KEY, 'false'),
    ]);
    setTutorialScanDoneState(false);
    setTutorialManualDoneState(false);
    setTutorialDismissedState(false);
  }, []);

  const tutorialComplete = (tutorialScanDone && tutorialManualDone) || tutorialDismissed;

  // Sticky once true: a task marked done never un-marks, even if the underlying signal (e.g.
  // the streak) later regresses  see docs discussion in src/lib/tasks.ts. `celebrate` is false
  // only for the initial load's pass over already-satisfied derived tasks (see the effect
  // below) so a returning user with e.g. hasBudget already true doesn't get a completion toast
  // for something they finished during onboarding, sessions ago.
  const [pendingTaskCelebrations, setPendingTaskCelebrations] = useState(0);
  const markTaskDone = useCallback(async (id: ExploreTaskId, celebrate: boolean = true) => {
    setTasksDoneState((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      void setMeta(EXPLORE_TASKS_DONE_KEY, JSON.stringify(next));
      if (celebrate) setPendingTaskCelebrations((n) => n + 1);
      return next;
    });
  }, []);
  const clearTaskCelebrations = useCallback(() => setPendingTaskCelebrations(0), []);

  const hasBudget = expectedIncome > 0 || Object.keys(allocations).length > 0;

  // Tasks whose completion is a plain derivation of state already tracked elsewhere in the
  // store: watch the signal and mark the task done the first time it goes true. Tasks with no
  // natural "already true" signal (export, breakdown, currency, recap, add-account) are instead
  // marked directly at their point of use in the relevant screen.
  const initialTaskCheckDone = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const celebrate = initialTaskCheckDone.current;
    if (effectiveStreak >= 7 && !tasksDone.includes('streak')) void markTaskDone('streak', celebrate);
    if (hasBudget && !tasksDone.includes('budget')) void markTaskDone('budget', celebrate);
    if (commitments.length > 0 && !tasksDone.includes('recurringBill')) void markTaskDone('recurringBill', celebrate);
    initialTaskCheckDone.current = true;
  }, [ready, effectiveStreak, hasBudget, commitments, tasksDone, markTaskDone]);

  const coverage = useMemo(() => computeCoverage(transactions), [transactions]);

  const taxRequestableCount = useMemo(() => {
    if (reliefTags.length === 0) return 0;
    const today = new Date();
    const ya = yaForDate(today.toISOString().slice(0, 10));
    const schedule = scheduleForYA(ya);
    if (!schedule) return 0;
    // Indexed once. A linear `transactions.find` per tag made this a tags × ledger scan that
    // re-ran on every ledger change, which is the wrong shape for a Settings row badge.
    const txnById = new Map(transactions.map((t) => [t.id, t]));
    const lineByCode = new Map(schedule.lines.map((l) => [l.code, l]));
    let count = 0;
    for (const t of reliefTags) {
      const line = lineByCode.get(t.code);
      const txn = txnById.get(t.txnId);
      if (!line || !txn) continue;
      if (isRequestable(evidenceState(t, txn, line), txn, today)) count++;
    }
    return count;
  }, [reliefTags, transactions]);

  const value: AppData = {
    onboardingComplete,
    completeOnboarding,
    tutorialScanDone,
    tutorialManualDone,
    tutorialDismissed,
    tutorialComplete,
    completeTutorialScan,
    completeTutorialManual,
    dismissTutorial,
    resetTutorial,
    tasksDone,
    markTaskDone,
    pendingTaskCelebrations,
    clearTaskCelebrations,
    ready,
    categories,
    catById,
    transactions,
    memory,
    expectedIncome,
    allocations,
    snapshots,
    hasBudget,
    accounts,
    balanceEntries,
    prices,
    accountValues,
    pricesAsOf,
    coverage,
    taxRequestableCount,
    refreshAll,
    addCategory,
    deleteCategory,
    updateCategoryIcon,
    updateCategoryLabel,
    commitCategorized,
    applyReliefDetection,
    saveTransactionEdits,
    removeTransaction,
    removeMany,
    people,
    splits,
    shares,
    splitPayments,
    openShares,
    addPerson,
    renamePerson,
    splitTransaction,
    unsplitTransaction,
    settleShare,
    writeOffShare,
    saveBudget,
    resetBudget,
    resetAllData,
    resetToOnboarding,
    reminderCadence,
    setReminderCadence,
    reminderHourOverride,
    setReminderHourOverride,
    owedReminderEnabled,
    setOwedReminderEnabled,
    commitmentReminderEnabled,
    setCommitmentReminderEnabled,
    motionSetting,
    setMotionSetting,
    soundEnabled,
    setSoundEnabled,
    streak: effectiveStreak,
    streakWeek,
    streakTodayIndex,
    streakFreezeAvailable: streakFreeze.available,
    streakGraduated,
    streakStartLabel,
    streakPaused: streakPausedSinceDay !== null,
    pauseStreak,
    resumeStreak,
    streakCelebrationToken,
    addAccount,
    ensureDefaultAccount,
    updateAccount,
    deleteAccount,
    setBalance,
    recordBalanceLink,
    addHolding,
    updateHoldingQuantity,
    setHoldingCost,
    refreshPrices,
    getCachedAdvice,
    saveAdvice,
    commitments,
    commitmentOccurrences,
    addCommitmentEntry,
    updateCommitmentEntry,
    archiveCommitmentEntry,
    deleteCommitmentEntry,
    importParsedCommitments,
    previewCommitmentMatch,
    payCommitment,
    unpayCommitment,
    skipCommitment,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
