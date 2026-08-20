import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addCategory as dbAddCategory, deleteCategory as dbDeleteCategory, updateCategoryIcon as dbUpdateCategoryIcon, listCategories } from '../db/categoriesRepo';
import { DEFAULT_EXPENSE_ID, DEFAULT_INCOME_ID } from '../data/categories';
import { getMemoryMap, upsertMemory } from '../db/memoryRepo';
import {
  addTransactions,
  deleteTransaction,
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
import { openReceivableTotal, outstanding, type OpenShare } from '../lib/split';
import { refreshPrices as fetchPrices } from '../prices';
import { budgetHash, currentMonthKey, monthKey } from '../lib/budget';
import { computeCoverage, type Coverage } from '../lib/coverage';
import { getMeta, setMeta } from '../db/metaRepo';
import { DEFAULT_GUIDE_CITY, DEFAULT_HOUSEHOLD_PROFILE } from '../lib/belanjawanku';
import { DEFAULT_SAVINGS_TARGET } from '../lib/savingsHabit';
import { isReminderCadence, type ReminderCadence } from '../lib/reminders';
import { GUIDE_CITIES, HOUSEHOLD_PROFILES, type GuideCityId, type HouseholdProfileId } from '../data/belanjawanku';
import { syncStreakWidget } from '../widget/syncStreakWidget';
import {
  addCommitment as dbAddCommitment,
  archiveCommitment as dbArchiveCommitment,
  deleteCommitment as dbDeleteCommitment,
  ensureOccurrences as dbEnsureOccurrences,
  listCommitments as dbListCommitments,
  listOccurrences as dbListOccurrences,
  insertOccurrence as dbInsertOccurrence,
  markOccurrencePaid as dbMarkOccurrencePaid,
  resetOccurrence as dbResetOccurrence,
  setOccurrenceUnits as dbSetOccurrenceUnits,
  skipOccurrence as dbSkipOccurrence,
  updateCommitment as dbUpdateCommitment,
  type NewCommitment,
} from '../db/commitmentsRepo';
import { findCommitmentMatch, type Commitment, type CommitmentOccurrence, type CommitmentKind } from '../lib/commitments';
import { matchSourceCategory } from '../lib/import';
import type { ParsedCommitment } from '../lib/advancedImport';

const ONBOARDING_KEY = 'onboarding_complete';
// Which Belanjawanku household category and city the borrower's budget is benchmarked against,
// and the monthly amount they committed to keeping back. Preferences, not ledger data, so they
// live in app_meta rather than earning a table of their own.
const HOUSEHOLD_PROFILE_KEY = 'belanjawanku_household';
const GUIDE_CITY_KEY = 'belanjawanku_city';
const SAVINGS_TARGET_KEY = 'savings_target';
// Local reminder preferences. Both default to off so the OS permission prompt only ever
// appears because the user reached for it in Settings. Deliberately survive `resetAllData`,
// `resetToOnboarding` and demo-profile loads: this is how the owner of the phone wants to be
// interrupted, not persona data, and having a demo reset silently unsubscribe them would be a
// surprise they would not think to look for.
const REMINDER_CADENCE_KEY = 'reminder_cadence';
const OWED_REMINDER_KEY = 'owed_reminder_on';
const COMMITMENT_REMINDER_KEY = 'commitment_reminder_on';
import { applyEffect, currentValue, RECEIVABLE_CLS, type LinkEffect } from '../lib/networth';
import { holdingValue, isHolding, mergeAccountValues } from '../lib/prices';
import { merchantKey } from '../lib/normalize';
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
  type Split,
  type SplitDraft,
  type SplitPayment,
  type SplitShare,
  type Transaction,
  type TxnSource,
  type TxnType,
} from '../lib/types';

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
async function reconcileReceivable(shareRows: SplitShare[], accts: Account[]): Promise<boolean> {
  const total = openReceivableTotal(shareRows);
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
  /** Whether the one-time setup has been completed. */
  onboardingComplete: boolean;
  /** Mark the one-time setup complete. */
  completeOnboarding: () => Promise<void>;
  refreshAll: () => Promise<void>;
  addCategory: (label: string, icon: string, hue: number, kind: Category['kind']) => Promise<string>;
  deleteCategory: (id: string) => Promise<void>;
  /** Change a category's icon/picture  a named icon or a custom photo URI. Allowed on every
   *  category, including the protected generics. */
  updateCategoryIcon: (id: string, icon: string) => Promise<void>;
  commitCategorized: (
    items: ExtractedTxn[],
    assignments: (string | null)[],
    source?: TxnSource,
    /** Parallel to `items`: a split to attach to that row, or null. A split row saves at its
     *  `ownShare`, not the extracted amount, and the gross is kept on the split record. */
    splitDrafts?: (SplitDraft | null)[]
  ) => Promise<{ created: Transaction[]; newLearned: NewLearned[] }>;
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
  /** Which Belanjawanku household category and city the budget is benchmarked against. */
  householdProfile: HouseholdProfileId;
  guideCity: GuideCityId;
  setBenchmarkProfile: (profile: HouseholdProfileId, city: GuideCityId) => Promise<void>;
  /** Monthly pay-yourself-first commitment. Motivation only. */
  savingsTarget: number;
  setSavingsTarget: (amount: number) => Promise<void>;
  /** How often to nudge about logging spending. `'off'` disables the reminder entirely. */
  reminderCadence: ReminderCadence;
  setReminderCadence: (cadence: ReminderCadence) => Promise<void>;
  /** Whether to chase debts that have aged past `AGING_DAYS`, weekly. */
  owedReminderEnabled: boolean;
  setOwedReminderEnabled: (on: boolean) => Promise<void>;
  /** Whether to nudge about recurring commitments (bills + DCA): a monthly digest plus a
   *  once-off nudge for anything overdue. */
  commitmentReminderEnabled: boolean;
  setCommitmentReminderEnabled: (on: boolean) => Promise<void>;
  addAccount: (name: string, kind: AccountKind, cls: string, openingValue: number, asOf: string, icon?: string | null) => Promise<void>;
  /** Returns a default account id for the add flows, creating a "Cash" account if none exist. */
  ensureDefaultAccount: () => Promise<string>;
  updateAccount: (id: string, fields: { name: string; cls: string; icon?: string | null }) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setBalance: (accountId: string, value: number, asOf: string) => Promise<void>;
  recordBalanceLink: (accountId: string, amount: number, effect: LinkEffect, asOf: string) => Promise<void>;
  addHolding: (name: string, sub: string, symbol: string, ticker: string, quantity: number, cost: number | null, icon?: string | null) => Promise<void>;
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
  }) => Promise<void>;
  updateCommitmentEntry: (
    id: string,
    patch: Partial<Pick<Commitment, 'label' | 'amount' | 'categoryId' | 'fromAccountId' | 'toAccountId' | 'dueDay' | 'endMonth'>>
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
  const [householdProfile, setHouseholdProfileState] = useState<HouseholdProfileId>(DEFAULT_HOUSEHOLD_PROFILE);
  const [guideCity, setGuideCityState] = useState<GuideCityId>(DEFAULT_GUIDE_CITY);
  const [savingsTarget, setSavingsTargetState] = useState<number>(DEFAULT_SAVINGS_TARGET);
  const [reminderCadence, setReminderCadenceState] = useState<ReminderCadence>('off');
  const [owedReminderEnabled, setOwedReminderEnabledState] = useState(false);
  const [commitmentReminderEnabled, setCommitmentReminderEnabledState] = useState(false);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [commitmentOccurrences, setCommitmentOccurrences] = useState<CommitmentOccurrence[]>([]);

  const refreshAll = useCallback(async () => {
    const [cats, txns, mem, income, alloc, snaps, accts, entries, cache, onboardingFlag, householdRaw, cityRaw, savingsTargetRaw, reminderCadenceRaw, owedReminderRaw, commitmentReminderRaw, peopleRows, splitRows, shareRows, paymentRows] =
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
        getMeta(HOUSEHOLD_PROFILE_KEY),
        getMeta(GUIDE_CITY_KEY),
        getMeta(SAVINGS_TARGET_KEY),
        getMeta(REMINDER_CADENCE_KEY),
        getMeta(OWED_REMINDER_KEY),
        getMeta(COMMITMENT_REMINDER_KEY),
        dbListPeople(),
        dbListSplits(),
        dbListShares(),
        dbListPayments(),
      ]);
    // A stale or hand-edited preference falls back to the default rather than breaking Budget.
    setHouseholdProfileState(
      HOUSEHOLD_PROFILES.some((p) => p.id === householdRaw)
        ? (householdRaw as HouseholdProfileId)
        : DEFAULT_HOUSEHOLD_PROFILE
    );
    setGuideCityState(
      GUIDE_CITIES.some((c) => c.id === cityRaw) ? (cityRaw as GuideCityId) : DEFAULT_GUIDE_CITY
    );
    const parsedTarget = savingsTargetRaw === null ? NaN : Number(savingsTargetRaw);
    setSavingsTargetState(
      Number.isFinite(parsedTarget) && parsedTarget >= 0 ? parsedTarget : DEFAULT_SAVINGS_TARGET
    );
    // An unreadable cadence falls back to off rather than to a guess: silence is the safe
    // failure mode for something that interrupts the user.
    setReminderCadenceState(isReminderCadence(reminderCadenceRaw) ? reminderCadenceRaw : 'off');
    setOwedReminderEnabledState(owedReminderRaw === 'true');
    setCommitmentReminderEnabledState(commitmentReminderRaw === 'true');
    setOnboardingComplete(onboardingFlag === 'true');
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
    refreshAll()
      .catch((e) => console.warn('Failed to load app data', e))
      .finally(() => setReady(true));
  }, [refreshAll]);

  useEffect(() => {
    if (!ready) return;
    syncStreakWidget(transactions).catch(() => {});
  }, [ready, transactions]);

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
    await reconcileReceivable(shareRows, accts);
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
        const txn = txnById[splitById[s.splitId]?.txnId ?? ''];
        return {
          shareId: s.id,
          personId: s.personId,
          personName: personById[s.personId]?.name ?? 'Someone',
          outstanding: outstanding(s),
          billDate: txn?.date ?? txn?.createdAt ?? null,
          merchant: txn?.merchantRaw ?? 'A shared bill',
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

  const commitCategorized = useCallback(
    async (
      items: ExtractedTxn[],
      assignments: (string | null)[],
      source: TxnSource = 'extracted',
      splitDrafts?: (SplitDraft | null)[]
    ) => {
      const newLearned: NewLearned[] = [];
      const toInsert: NewTxn[] = [];
      // Parallel to `toInsert` rather than to `items`: dropped rows never reach the insert, so
      // the two arrays would fall out of step if this were indexed off the original items.
      const draftFor: (SplitDraft | null)[] = [];

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

      return { created, newLearned };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memory]
  );

  const saveTransactionEdits = useCallback(
    async (
      txn: Transaction,
      edits: { amount: number; type: TxnType; categoryId: string | null; remark?: string | null }
    ) => {
      await updateTransactionFields(txn.id, edits.amount, edits.type, edits.categoryId, edits.remark);
      // Correcting a category re-teaches Pip for that merchant (expense or income), only if
      // merchant is non-empty. A transfer has no category, so there is nothing to teach.
      if (txn.merchantKey && edits.categoryId) {
        await upsertMemory(txn.merchantKey, edits.categoryId);
      }
      const [txns, mem] = await Promise.all([listTransactions(), getMemoryMap()]);
      setTransactions(txns);
      setMemory(mem);
    },
    []
  );

  // Deleting a transaction takes its split with it: a receivable with no bill behind it is a
  // claim on nothing, and leaving the shares would keep inflating net worth forever.
  const removeTransaction = useCallback(async (id: string) => {
    await deleteTransaction(id);
    await dbDeleteSplitsForTxns([id]);
    setTransactions(await listTransactions());
    await refreshSplitState();
  }, [refreshSplitState]);

  const removeMany = useCallback(async (ids: string[]) => {
    await deleteTransactions(ids);
    await dbDeleteSplitsForTxns(ids);
    setTransactions(await listTransactions());
    await refreshSplitState();
  }, [refreshSplitState]);

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
      await updateTransactionAmount(txn.id, draft.ownShare);
      await dbCreateSplit(txn.id, draft);
      setTransactions(await listTransactions());
      await refreshSplitState();
    },
    [refreshSplitState]
  );

  /** Undo a split, putting the whole amount that left the account back on the row. */
  const unsplitTransaction = useCallback(
    async (txn: Transaction) => {
      const split = splits.find((s) => s.txnId === txn.id);
      if (!split) return;
      await updateTransactionAmount(txn.id, split.gross);
      await dbDeleteSplitsForTxns([txn.id]);
      setTransactions(await listTransactions());
      await refreshSplitState();
    },
    [splits, refreshSplitState]
  );

  /**
   * Record money received against a share.
   *
   * No income transaction is written, on purpose. Being paid back is not earnings, it is a
   * receivable converting into cash, and booking it as income would inflate the income figures
   * elsewhere in the app. The cash side is a balance movement on whichever account the money
   * landed in; passing no account leaves the cash to arrive with the next balance scan instead.
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
      const result = await dbRecordPayment(shareId, amount, paidOn, evidence, matchedMerchant, accountId);
      if (!result) return;
      if (accountId) {
        const entries = await listBalanceEntries();
        const mine = entries.filter((e) => e.accountId === accountId);
        const latestAsOf = mine.reduce((m, e) => (e.asOf > m ? e.asOf : m), '');
        await dbAddBalanceEntry(
          accountId,
          applyEffect(currentValue(mine), amount, 'add'),
          paidOn > latestAsOf ? paidOn : latestAsOf
        );
      }
      await refreshSplitState();
    },
    [refreshSplitState]
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

      const [created] = await addTransactions([
        {
          merchantRaw: origin?.merchantRaw ?? 'Written-off split',
          merchantKey: origin?.merchantKey ?? 'written-off split',
          amount,
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
    await setExpectedIncome(income);
    await dbSetAllocations(alloc);
    // Keep the current month's snapshot in step with the live plan.
    const cur = monthKey(new Date().toISOString())!;
    await upsertSnapshot(cur, income, alloc);
    setIncome(income);
    setAlloc(alloc);
    setSnapshots((prev) => ({ ...prev, [cur]: { income, allocations: alloc } }));
  }, []);

  const setBenchmarkProfile = useCallback(async (profile: HouseholdProfileId, city: GuideCityId) => {
    await setMeta(HOUSEHOLD_PROFILE_KEY, profile);
    await setMeta(GUIDE_CITY_KEY, city);
    setHouseholdProfileState(profile);
    setGuideCityState(city);
  }, []);

  const setSavingsTarget = useCallback(async (amount: number) => {
    const clean = Math.max(0, Math.round(amount));
    await setMeta(SAVINGS_TARGET_KEY, String(clean));
    setSavingsTargetState(clean);
  }, []);

  const setReminderCadence = useCallback(async (cadence: ReminderCadence) => {
    await setMeta(REMINDER_CADENCE_KEY, cadence);
    setReminderCadenceState(cadence);
  }, []);

  const setOwedReminderEnabled = useCallback(async (on: boolean) => {
    await setMeta(OWED_REMINDER_KEY, on ? 'true' : 'false');
    setOwedReminderEnabledState(on);
  }, []);

  const setCommitmentReminderEnabled = useCallback(async (on: boolean) => {
    await setMeta(COMMITMENT_REMINDER_KEY, on ? 'true' : 'false');
    setCommitmentReminderEnabledState(on);
  }, []);

  const resetBudget = useCallback(async () => {
    await clearBudget();
    setIncome(0);
    setAlloc({});
  }, []);

  const resetAllData = useCallback(async () => {
    await dbResetAllData();
    await refreshAll();
  }, [refreshAll]);

  const resetToOnboarding = useCallback(async () => {
    await dbResetAllData();
    await setMeta(ONBOARDING_KEY, 'false');
    setOnboardingComplete(false);
  }, []);

  const addAccount = useCallback(
    async (name: string, kind: AccountKind, cls: string, openingValue: number, asOf: string, icon?: string | null) => {
      await dbAddAccount(name, kind, cls, openingValue, asOf, icon);
      const [accts, entries] = await Promise.all([listAccounts(), listBalanceEntries()]);
      setAccounts(accts);
      setBalanceEntries(entries);
    },
    []
  );

  // Every transaction is tied to an account now, so the add flows need a guaranteed
  // default. Prefer an existing cash account; otherwise create a "Cash" one (opening
  // balance 0, dated today). Returns the account id to preselect.
  const ensureDefaultAccount = useCallback(async (): Promise<string> => {
    const activeAccts = accounts.filter((a) => !a.archived);
    const existing = activeAccts.find((a) => a.cls === 'cash') ?? activeAccts[0];
    if (existing) return existing.id;
    const created = await dbAddAccount('Cash', 'asset', 'cash', 0, new Date().toISOString().slice(0, 10), null);
    const [accts, entries] = await Promise.all([listAccounts(), listBalanceEntries()]);
    setAccounts(accts);
    setBalanceEntries(entries);
    return created.id;
  }, [accounts]);

  const updateAccount = useCallback(async (id: string, fields: { name: string; cls: string; icon?: string | null }) => {
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

  // A linked transaction nudges an account's balance: new = current ± amount.
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
    async (name: string, sub: string, symbol: string, ticker: string, quantity: number, cost: number | null, icon?: string | null) => {
      await dbAddHolding(name, sub, symbol, ticker, quantity, cost, icon);
      setAccounts(await listAccounts());
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
      });
      await dbEnsureOccurrences(new Date());
      await refreshCommitmentState();
    },
    [refreshCommitmentState]
  );

  const updateCommitmentEntry = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Commitment, 'label' | 'amount' | 'categoryId' | 'fromAccountId' | 'toAccountId' | 'dueDay' | 'endMonth'>>
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
        await refreshCommitmentState();
        return { matched: true };
      }

      const wantType: TxnType = commitment.kind === 'investment' ? 'transfer' : 'expense';
      const paidAmount = opts?.amount ?? commitment.amount;
      const paidOn = opts?.paidOn ?? todayKey();
      const status = paidOn <= occurrence.dueDate ? 'paid' : 'late';

      const created = await addTransactions([
        {
          merchantRaw: commitment.label,
          merchantKey: commitment.merchantKey,
          amount: paidAmount,
          type: wantType,
          date: paidOn,
          categoryId: commitment.kind === 'investment' ? null : commitment.categoryId,
          source: 'manual',
        },
      ]);
      const txn = created[0];

      if (commitment.fromAccountId) {
        await recordBalanceLink(commitment.fromAccountId, paidAmount, 'subtract', paidOn);
      }

      let unitsAdded: number | null = null;
      let priceMYR: number | null = null;
      if (commitment.kind === 'investment' && commitment.toAccountId) {
        const target = accounts.find((a) => a.id === commitment.toAccountId);
        if (target && isHolding(target)) {
          const quote = prices[target.symbol as string];
          // A holding always moves cost basis; quantity only moves when a price is cached —
          // offline or a brand-new symbol resolves its units later, in `refreshPrices` above.
          if (quote) {
            unitsAdded = Math.round((paidAmount / quote.priceMYR) * 1e8) / 1e8;
            priceMYR = quote.priceMYR;
            await dbUpdateHoldingQuantity(target.id, (target.quantity ?? 0) + unitsAdded);
          }
          await dbUpdateHoldingCost(target.id, (target.cost ?? 0) + paidAmount);
        } else if (target) {
          // Cost-only target (ASB, EPF, unit trusts, gold savings): no ticker to size units
          // against, so the account's balance IS the invested-amount tracker.
          await recordBalanceLink(target.id, paidAmount, 'add', paidOn);
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
      setTransactions(await listTransactions());
      await refreshCommitmentState();
      return { matched: false };
    },
    [commitmentOccurrences, commitments, accounts, prices, resolveCommitmentMatch, recordBalanceLink, refreshCommitmentState]
  );

  /**
   * Untick: full reversal, not just a status flip. If the tick created the ledger row, delete
   * it and post a compensating balance entry on every account the tick moved; if the tick only
   * linked a transaction the user already had, leave that row and its history untouched — there
   * is nothing of this feature's making to undo.
   */
  const unpayCommitment = useCallback(
    async (occurrenceId: string) => {
      const occurrence = commitmentOccurrences.find((o) => o.id === occurrenceId);
      const commitment = occurrence ? commitments.find((c) => c.id === occurrence.commitmentId) : undefined;
      if (!occurrence || !commitment) return;
      if (occurrence.status !== 'paid' && occurrence.status !== 'late') return;

      if (occurrence.txnCreated) {
        if (occurrence.txnId) await removeTransaction(occurrence.txnId);
        const paidAmount = occurrence.paidAmount ?? occurrence.amount;
        const today = todayKey();

        if (commitment.fromAccountId) {
          await recordBalanceLink(commitment.fromAccountId, paidAmount, 'add', today);
        }

        if (commitment.kind === 'investment' && commitment.toAccountId) {
          const target = accounts.find((a) => a.id === commitment.toAccountId);
          if (target && isHolding(target)) {
            if (occurrence.unitsAdded != null) {
              await dbUpdateHoldingQuantity(target.id, (target.quantity ?? 0) - occurrence.unitsAdded);
            }
            await dbUpdateHoldingCost(target.id, Math.max(0, (target.cost ?? 0) - paidAmount));
          } else if (target) {
            await recordBalanceLink(target.id, paidAmount, 'subtract', today);
          }
        }
      }

      await dbResetOccurrence(occurrenceId);
      setTransactions(await listTransactions());
      await refreshCommitmentState();
    },
    [commitmentOccurrences, commitments, accounts, removeTransaction, recordBalanceLink, refreshCommitmentState]
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

  const coverage = useMemo(() => computeCoverage(transactions), [transactions]);

  const value: AppData = {
    onboardingComplete,
    completeOnboarding,
    ready,
    categories,
    catById,
    transactions,
    memory,
    expectedIncome,
    allocations,
    snapshots,
    hasBudget: expectedIncome > 0 || Object.keys(allocations).length > 0,
    accounts,
    balanceEntries,
    prices,
    accountValues,
    pricesAsOf,
    coverage,
    refreshAll,
    addCategory,
    deleteCategory,
    updateCategoryIcon,
    commitCategorized,
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
    householdProfile,
    guideCity,
    setBenchmarkProfile,
    savingsTarget,
    setSavingsTarget,
    reminderCadence,
    setReminderCadence,
    owedReminderEnabled,
    setOwedReminderEnabled,
    commitmentReminderEnabled,
    setCommitmentReminderEnabled,
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
