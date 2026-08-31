// src/screens/AdvancedImportScreen.tsx
//
// Advanced import: user copies a prompt, attaches files to any LLM (Claude,
// ChatGPT, Gemini …), then pastes the JSON reply here.
//
// The JSON schema covers THREE data types:
//   transactions  → ExtractedTxn[]  → ImportReviewScreen → commitCategorized
//   accounts      → balance snapshots (savings, investments, loans, credit cards)
//                   → addAccount + addBalanceEntry on the Net Worth side
//
// JSON conventions:
//   transactions.amount: NEGATIVE = expense/debit, POSITIVE = income/credit
//   accounts.balance: always POSITIVE (outstanding amount for liabilities too)

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import {
  B,
  BtnLabel,
  BubbleText,
  Card,
  Eyebrow,
  PipSays,
  PrimaryButton,
  TopBar,
} from '../components/ui';
import { addAccount, listAccounts, updateAccount, updateHoldingCost, updateHoldingQuantity, upsertDailyBalanceEntry } from '../db/accountsRepo';
import { addCategory, listCategories } from '../db/categoriesRepo';
import { setExpectedIncome, setAllocations, upsertSnapshot, setAdvice } from '../db/budgetRepo';
import { addReliefTag, upsertReliefMemory } from '../db/reliefRepo';
import { findOrCreatePerson, importParsedSplit, listPeople } from '../db/splitRepo';
import { upsertMemory } from '../db/memoryRepo';
import { addTransactions } from '../db/txnRepo';
import { listFxRates } from '../db/fxRepo';
import { activateCurrency, getEntryCurrency } from '../db/currencyRepo';
import { DROP, type Account, type ExtractedTxn } from '../lib/types';
import { BASE_CURRENCY, deriveNative, round2 } from '../lib/currency';
import { fmtMoney } from '../lib/format';
import { todayISO } from '../lib/duplicates';
import { rateFor, ratesFromCache } from '../lib/fx';
import { merchantKey } from '../lib/normalize';
import { defaultLinkEffect } from '../lib/networth';
import {
  buildPrompt,
  parseJSON,
  type ParsedAccount,
  type ParsedAppPreferences,
  type ParsedBudget,
  type ParsedCategory,
  type ParsedCommitment,
  type ParsedPerson,
  type ParsedSplit,
  type ParsedTaxRelief,
  type ParsedTransfer,
  type ParseResult,
} from '../lib/advancedImport';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { radius, uiFont } from '../theme';
import { ImportReviewScreen } from './ImportReviewScreen';

export type { ParsedAccount, ParseResult };

// ─────────────────────────────────────────────────────────────────────────────
// LLM link chips
// ─────────────────────────────────────────────────────────────────────────────

const LLM_LINKS = [
  { label: 'Claude', url: 'https://claude.ai', emoji: '✦' },
  { label: 'ChatGPT', url: 'https://chatgpt.com', emoji: '✿' },
  { label: 'Gemini', url: 'https://gemini.google.com', emoji: '✧' },
];

function LLMChip({ label, url, emoji }: { label: string; url: string; emoji: string }) {
  const colorTheme = useThemeColors();
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [
        styles.llmChip,
        { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line },
        { opacity: pressed ? 0.82 : 1 },
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
    >
      <Text style={styles.llmEmoji}>{emoji}</Text>
      <Text style={[styles.llmLabel, { color: colorTheme.ink }]}>{label}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Account review list (shown between parse and commit)
// ─────────────────────────────────────────────────────────────────────────────

function AccountReviewList({
  accounts,
  onChange,
}: {
  accounts: ParsedAccount[];
  onChange: (updated: ParsedAccount[]) => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const toggle = (i: number) => {
    const next = accounts.map((a, j) => (j === i ? { ...a, include: !a.include } : a));
    onChange(next);
  };

  if (accounts.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {accounts.map((acc, i) => {
        const isAsset = acc.kind === 'asset';
        const dot = isAsset ? theme.accent : colorTheme.amber;
        return (
          <Pressable
            key={i}
            onPress={() => toggle(i)}
            style={[
              styles.accRow,
              { borderBottomColor: colorTheme.line },
              !acc.include && { opacity: 0.45 },
            ]}
          >
            {/* Tick box */}
            <View
              style={[
                styles.tick,
                { borderColor: colorTheme.line },
                acc.include && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
            >
              {acc.include && (
                <Text style={{ color: '#fff', fontSize: 11, fontFamily: uiFont(800), lineHeight: 14 }}>✓</Text>
              )}
            </View>

            {/* Dot + name */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.kindDot, { backgroundColor: dot }]} />
                <Text style={[styles.accName, { color: colorTheme.ink }]} numberOfLines={1}>{acc.name}</Text>
              </View>
              <Text style={[styles.accMeta, { color: colorTheme.ink3 }]}>
                {acc.clsLabel}
                {acc.notes ? ` · ${acc.notes}` : ''}
                {' · '}{acc.asOf}
              </Text>
            </View>

            {/* Balance */}
            <Text style={[styles.accBalance, { color: isAsset ? theme.accent : colorTheme.amber }]}>
              {isAsset ? '+' : '−'}{fmtMoney(acc.balance, acc.currency)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

type Phase =
  | 'guide'
  | 'pasting'
  | 'accountReview'   // reviewing parsed accounts before the txn review
  | 'txnReview'       // ImportReviewScreen takeover
  | 'saving'
  | 'done'
  | 'error';


export function AdvancedImportScreen({
  onClose,
  onSuccess,
  isWizard = false,
}: {
  onClose: () => void;
  onSuccess?: () => void;
  isWizard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { commitCategorized, recordBalanceLink, refreshAll, setHoldingCost, updateHoldingQuantity, importParsedCommitments } = useAppData();

  const [phase, setPhase] = useState<Phase>('guide');
  const [jsonText, setJsonText] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<string>(BASE_CURRENCY);
  const [parsedTxns, setParsedTxns] = useState<ExtractedTxn[]>([]);
  const [parsedAccounts, setParsedAccounts] = useState<ParsedAccount[]>([]);
  const [parsedTransfers, setParsedTransfers] = useState<ParsedTransfer[]>([]);
  const [parsedCommitments, setParsedCommitments] = useState<ParsedCommitment[]>([]);
  const [parsedCategories, setParsedCategories] = useState<ParsedCategory[]>([]);
  const [parsedDeletedCats, setParsedDeletedCats] = useState<string[]>([]);
  const [parsedPeople, setParsedPeople] = useState<ParsedPerson[]>([]);
  const [parsedSplits, setParsedSplits] = useState<ParsedSplit[]>([]);
  const [parsedBudget, setParsedBudget] = useState<ParsedBudget | null>(null);
  const [parsedTaxRelief, setParsedTaxRelief] = useState<ParsedTaxRelief | null>(null);
  const [parsedMerchantMemory, setParsedMerchantMemory] = useState<Record<string, string>>({});
  const [parsedPreferences, setParsedPreferences] = useState<ParsedAppPreferences | null>(null);
  const [updateAccountBalances, setUpdateAccountBalances] = useState(true);
  const [error, setError] = useState('');
  const [txnCount, setTxnCount] = useState(0);
  const [txnSkipped, setTxnSkipped] = useState(0);
  const [accCount, setAccCount] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
  const [commitmentCount, setCommitmentCount] = useState(0);
  const [splitCount, setSplitCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    getEntryCurrency().then(setDefaultCurrency);
  }, []);

  const prompt = buildPrompt(defaultCurrency);

  // ── Copy prompt ──────────────────────────────────────────────────────────
  const copyPrompt = async () => {
    try {
      if (Platform.OS === 'web') {
        await (navigator as Navigator & { clipboard: Clipboard }).clipboard.writeText(prompt);
      } else {
        await Share.share({ message: prompt });
      }
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // Non-fatal: user can long-press-select the preview text.
    }
  };

  // ── Upload a JSON file from the device instead of pasting ────────────────
  const [pickingFile, setPickingFile] = useState(false);
  const pickJsonFile = async () => {
    setPickingFile(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'text/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const text = await new File(asset.uri).text();
      setJsonText(text);
      setPhase('pasting');
      handlePasteImport(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
      setPhase('error');
    } finally {
      setPickingFile(false);
    }
  };

  // ── Parse pasted (or uploaded) JSON ───────────────────────────────────────
  const handlePasteImport = (text?: string) => {
    const trimmed = (text ?? jsonText).trim();
    if (!trimmed) {
      setError('Paste the JSON from the AI response first.');
      setPhase('error');
      return;
    }
    try {
      const {
        transactions,
        accounts,
        transfers,
        commitments,
        categories: pCats,
        deletedDefaultCategories: pDelCats,
        people: pPeople,
        splits: pSplits,
        budget: pBudget,
        taxRelief: pRelief,
        merchantMemory: pMemory,
        preferences: pPrefs,
      } = parseJSON(trimmed, defaultCurrency);

      if (
        transactions.length === 0 &&
        accounts.length === 0 &&
        transfers.length === 0 &&
        commitments.length === 0 &&
        (!pCats || pCats.length === 0) &&
        (!pSplits || pSplits.length === 0) &&
        !pBudget &&
        !pRelief
      ) {
        setError('The JSON had no transactions or accounts. Check that you pasted the full reply.');
        setPhase('error');
        return;
      }
      setParsedTxns(transactions);
      setParsedAccounts(accounts);
      setParsedTransfers(transfers);
      setParsedCommitments(commitments);
      setParsedCategories(pCats ?? []);
      setParsedDeletedCats(pDelCats ?? []);
      setParsedPeople(pPeople ?? []);
      setParsedSplits(pSplits ?? []);
      setParsedBudget(pBudget ?? null);
      setParsedTaxRelief(pRelief ?? null);
      setParsedMerchantMemory(pMemory ?? {});
      setParsedPreferences(pPrefs ?? null);

      // Auto-activate all foreign currencies in the background so their FX rates are fetched/cached
      const foreignCodes = new Set<string>();
      for (const a of accounts) if (a.currency !== BASE_CURRENCY) foreignCodes.add(a.currency);
      for (const t of transactions) if (t.currency && t.currency !== BASE_CURRENCY) foreignCodes.add(t.currency);
      for (const tr of transfers) if (tr.currency && tr.currency !== BASE_CURRENCY) foreignCodes.add(tr.currency);
      for (const c of commitments) if (c.currency && c.currency !== BASE_CURRENCY) foreignCodes.add(c.currency);
      if (pPrefs?.activeCurrencies) {
        for (const code of pPrefs.activeCurrencies) if (code !== BASE_CURRENCY) foreignCodes.add(code);
      }
      for (const code of foreignCodes) {
        void activateCurrency(code);
      }

      // If there are accounts to review, show that step first.
      if (accounts.length > 0) {
        setPhase('accountReview');
      } else {
        setPhase('txnReview');
      }
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "That doesn't look like valid JSON. Make sure you pasted the entire block from the AI."
          : String(e),
      );
      setPhase('error');
    }
  };

  // ── Commit accounts + transactions ────────────────────────────────────────
  const commitAll = async (txns: ExtractedTxn[], assignments: (string | null)[]) => {
    setPhase('saving');
    let savedAcc = 0;
    try {
      // Ensure all foreign currencies are activated and rates cached before committing
      const toSave = parsedAccounts.filter((a) => a.include);
      const foreignCodes = new Set<string>();
      for (const a of toSave) if (a.currency !== BASE_CURRENCY) foreignCodes.add(a.currency);
      for (const t of txns) if (t.currency && t.currency !== BASE_CURRENCY) foreignCodes.add(t.currency);
      for (const tr of parsedTransfers) if (tr.currency && tr.currency !== BASE_CURRENCY) foreignCodes.add(tr.currency);
      for (const c of parsedCommitments) if (c.currency && c.currency !== BASE_CURRENCY) foreignCodes.add(c.currency);
      if (parsedPreferences?.activeCurrencies) {
        for (const code of parsedPreferences.activeCurrencies) if (code !== BASE_CURRENCY) foreignCodes.add(code);
      }
      if (foreignCodes.size > 0) {
        await Promise.all(Array.from(foreignCodes).map((code) => activateCurrency(code)));
      }

      // 0. Commit custom categories if any
      if (parsedCategories.length > 0) {
        const existingCats = await listCategories();
        const existingCatIds = new Set(existingCats.map((c) => c.id));
        for (const cat of parsedCategories) {
          if (!existingCatIds.has(cat.id)) {
            try {
              await addCategory(cat.label, cat.icon, cat.hue, cat.kind);
            } catch {}
          }
        }
      }

      // 1. Commit the chosen accounts to the Net Worth DB with their denominated currency and balance history.
      const existingAccountsOnBoot = await listAccounts();
      const existingAccByName = new Map(existingAccountsOnBoot.map((a) => [a.name.trim().toLowerCase(), a]));
      const newlyCreatedAccounts: Account[] = [];

      for (const acc of toSave) {
        const searchName = acc.name.trim().toLowerCase();
        let targetAcc = existingAccByName.get(searchName);

        if (!targetAcc) {
          targetAcc = await addAccount(acc.name, acc.kind, acc.cls, acc.balance, acc.asOf, acc.icon, acc.currency, acc.interestRate);
          newlyCreatedAccounts.push(targetAcc);
          savedAcc++;
        } else {
          await updateAccount(targetAcc.id, {
            name: acc.name,
            cls: acc.cls,
            icon: acc.icon,
            interestRate: acc.interestRate,
            sub: acc.sub,
            symbol: acc.symbol,
            ticker: acc.ticker,
            quantity: acc.quantity,
            cost: acc.cost,
          });
        }

        if (acc.cost != null) await setHoldingCost(targetAcc.id, acc.cost);
        if (acc.quantity != null) await updateHoldingQuantity(targetAcc.id, acc.quantity);

        // If history is present, import all balance entries for this account
        if (acc.history && acc.history.length > 0) {
          for (const h of acc.history) {
            await upsertDailyBalanceEntry(targetAcc.id, h.value, h.asOf);
          }
        }
      }

      // 2. Commit transactions via the store.
      const { created } = await commitCategorized(txns, assignments, 'imported');
      setTxnCount(created.length);
      setTxnSkipped(assignments.filter((a) => a === DROP).length);
      setAccCount(savedAcc);

      // 3. Update account balances with imported transactions if option enabled.
      if (updateAccountBalances) {
        const rates = ratesFromCache(await listFxRates());
        const existingAccounts = await listAccounts();
        const allAccounts = [
          ...newlyCreatedAccounts,
          ...existingAccounts.filter((e) => !newlyCreatedAccounts.some((n) => n.id === e.id)),
        ];

        const today = todayISO();
        for (let i = 0; i < txns.length; i++) {
          if (assignments[i] === DROP) continue;
          const txn = txns[i];

          let targetAccount: Account | null = null;
          if (txn.account) {
            const searchName = txn.account.trim().toLowerCase();
            targetAccount = allAccounts.find((a) => a.name.trim().toLowerCase() === searchName) || null;
          }
          if (!targetAccount && allAccounts.length === 1) {
            targetAccount = allAccounts[0];
          }

          if (targetAccount) {
            const effect = defaultLinkEffect(targetAccount.kind, txn.type);
            let linkAmount: number;
            if (targetAccount.currency === txn.currency) {
              linkAmount = txn.amount;
            } else {
              const txnRate = rateFor(rates, txn.currency);
              const myrAmount = txn.currency === BASE_CURRENCY ? txn.amount : round2(txn.amount * (txnRate ?? 1));
              linkAmount = deriveNative(myrAmount, targetAccount.currency, rateFor(rates, targetAccount.currency));
            }
            await recordBalanceLink(targetAccount.id, linkAmount, effect, txn.date ?? today);
          }
        }

        // 3b. A transfer moves money too.
        if (parsedTransfers.length > 0) {
          const existingAccounts2 = await listAccounts();
          const allAccounts2 = [
            ...newlyCreatedAccounts,
            ...existingAccounts2.filter((e) => !newlyCreatedAccounts.some((n) => n.id === e.id)),
          ];
          for (const t of parsedTransfers) {
            if (!t.account) continue;
            const searchName = t.account.trim().toLowerCase();
            const targetAccount = allAccounts2.find((a) => a.name.trim().toLowerCase() === searchName);
            if (targetAccount) {
              let linkAmount: number;
              if (targetAccount.currency === t.currency) {
                linkAmount = t.amount;
              } else {
                const tRate = rateFor(rates, t.currency);
                const myrAmount = t.currency === BASE_CURRENCY ? t.amount : round2(t.amount * (tRate ?? 1));
                linkAmount = deriveNative(myrAmount, targetAccount.currency, rateFor(rates, targetAccount.currency));
              }
              await recordBalanceLink(targetAccount.id, linkAmount, 'subtract', t.date ?? today);
            }
          }
        }
      }

      // 4. Log transfers to the ledger.
      if (parsedTransfers.length > 0) {
        const rates = ratesFromCache(await listFxRates());
        await addTransactions(
          parsedTransfers.map((t) => ({
            merchantRaw: t.description || 'Transfer',
            merchantKey: merchantKey(t.description || 'transfer'),
            amount: t.amount,
            type: 'transfer' as const,
            date: t.date,
            categoryId: null,
            source: 'imported' as const,
            currency: t.currency ?? BASE_CURRENCY,
            fxRate: t.currency && t.currency !== BASE_CURRENCY ? rateFor(rates, t.currency) : null,
          }))
        );
      }
      setTransferCount(parsedTransfers.length);

      // 5. Recurring commitments.
      if (parsedCommitments.length > 0) {
        await importParsedCommitments(parsedCommitments);
      }
      setCommitmentCount(parsedCommitments.length);

      // 6. People & Splits
      if (parsedPeople.length > 0) {
        for (const p of parsedPeople) {
          await findOrCreatePerson(p.name);
        }
      }
      if (parsedSplits.length > 0) {
        const currentPeople = await listPeople();
        const personByName = new Map(currentPeople.map((p) => [p.name.trim().toLowerCase(), p.id]));
        const personById = new Map(currentPeople.map((p) => [p.id, p.id]));

        let sCount = 0;
        for (const s of parsedSplits) {
          let targetTxnId: string | null = null;
          if (s.txnId) {
            const match = created.find((t) => t.id === s.txnId);
            if (match) targetTxnId = match.id;
          }
          if (!targetTxnId && created.length > 0) {
            const match = created.find((t) => Math.abs(t.amount - s.ownShare) < 0.01 && t.currency === s.currency);
            if (match) targetTxnId = match.id;
          }
          if (targetTxnId) {
            const mappedShares = s.shares.map((sh) => {
              let pId = sh.personId ? personById.get(sh.personId) : null;
              if (!pId && sh.personName) {
                pId = personByName.get(sh.personName.trim().toLowerCase()) ?? null;
              }
              return {
                personId: pId ?? (currentPeople[0]?.id ?? 'unknown'),
                owed: sh.owed,
                paid: sh.paid,
                status: sh.status,
                writtenOffTxnId: sh.writtenOffTxnId ?? null,
                payments: sh.payments,
              };
            });
            await importParsedSplit(targetTxnId, s.gross, s.ownShare, s.method, s.currency, s.fxRate ?? null, mappedShares);
            sCount++;
          }
        }
        setSplitCount(sCount);
      }

      // 7. Budget, Allocations, Snapshots, Advice
      if (parsedBudget) {
        if (parsedBudget.expectedIncome > 0) {
          await setExpectedIncome(parsedBudget.expectedIncome);
        }
        if (Object.keys(parsedBudget.allocations).length > 0) {
          await setAllocations(parsedBudget.allocations);
        }
        if (parsedBudget.snapshots) {
          for (const [m, snap] of Object.entries(parsedBudget.snapshots)) {
            await upsertSnapshot(m, snap.income, snap.allocations);
          }
        }
        if (parsedBudget.advice) {
          await setAdvice(parsedBudget.advice.hash, parsedBudget.advice.text);
        }
      }

      // 8. Tax Relief Tags & Memory
      if (parsedTaxRelief) {
        if (parsedTaxRelief.memory) {
          for (const [k, v] of Object.entries(parsedTaxRelief.memory)) {
            await upsertReliefMemory(k, v);
          }
        }
        if (parsedTaxRelief.tags && parsedTaxRelief.tags.length > 0) {
          for (const tag of parsedTaxRelief.tags) {
            let targetTxnId: string | null = null;
            if (tag.txnId) {
              const match = created.find((t) => t.id === tag.txnId);
              if (match) targetTxnId = match.id;
            }
            if (!targetTxnId && created.length > 0) {
              const match = created.find((t) => Math.abs(t.amount - tag.amount) < 0.01);
              if (match) targetTxnId = match.id;
            }
            if (targetTxnId) {
              try {
                await addReliefTag({
                  txnId: targetTxnId,
                  code: tag.code,
                  ya: tag.ya,
                  amount: tag.amount,
                  origin: tag.origin,
                });
              } catch {}
            }
          }
        }
      }

      // 9. Merchant Memory
      if (parsedMerchantMemory && Object.keys(parsedMerchantMemory).length > 0) {
        for (const [k, v] of Object.entries(parsedMerchantMemory)) {
          await upsertMemory(k, v);
        }
      }

      // Refresh so Net Worth screen picks up new accounts and balance entries.
      await refreshAll();

      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  // ── txnReview is a full-screen takeover ──────────────────────────────────
  if (phase === 'txnReview') {
    if (parsedTxns.length === 0) {
      // No transactions: skip review and commit accounts only (empty assignments).
      void commitAll([], []);
      return (
        <View style={[styles.root, { backgroundColor: colorTheme.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={theme.accent} />
        </View>
      );
    }
    return (
      <ImportReviewScreen
        items={parsedTxns}
        onCancel={() => setPhase(parsedAccounts.length > 0 ? 'accountReview' : 'pasting')}
        onConfirm={commitAll}
        updateAccountBalances={updateAccountBalances}
        onToggleUpdateAccountBalances={setUpdateAccountBalances}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title="Advanced Import" onBack={onClose} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Pip intro / done message ── */}
        <PipSays expr={phase === 'done' ? 'happy' : 'idle'}>
          <BubbleText>
            {phase === 'done' ? (
              <>
                Done!
                {txnCount > 0 && <> Imported <B>{txnCount} transaction{txnCount === 1 ? '' : 's'}</B>{txnSkipped > 0 ? <> (skipped <B>{txnSkipped}</B> dup{txnSkipped === 1 ? '' : 's'})</> : ''}.</>}
                {accCount > 0 && <> Added <B>{accCount} account{accCount === 1 ? '' : 's'}</B> to Net Worth.</>}
                {transferCount > 0 && <> Logged <B>{transferCount} transfer{transferCount === 1 ? '' : 's'}</B>.</>}
                {commitmentCount > 0 && <> Set up <B>{commitmentCount} recurring commitment{commitmentCount === 1 ? '' : 's'}</B>.</>}
                {splitCount > 0 && <> Restored <B>{splitCount} bill split{splitCount === 1 ? '' : 's'}</B>.</>}
              </>
            ) : phase === 'accountReview' ? (
              <>
                Found <B>{parsedAccounts.length}</B> account{parsedAccounts.length === 1 ? '' : 's'} and <B>{parsedTxns.length}</B> transaction{parsedTxns.length === 1 ? '' : 's'}. Untick any accounts you don't want, then continue to review the transactions.
              </>
            ) : (
              <>
                Got a long PDF or spreadsheet? Copy the prompt, open your favourite AI, attach your files, and paste the JSON back.
              </>
            )}
          </BubbleText>
        </PipSays>

        {/* ── DONE ── */}
        {phase === 'done' && (
          <>
            <Card style={{ padding: 16, marginTop: 18, gap: 10 }}>
              {txnCount > 0 && (
                <Text style={[styles.doneText, { color: colorTheme.ink2 }]}>
                  Transaction categories were filled in from what Pip has learned. Tweak them in your transactions list.
                </Text>
              )}
              {accCount > 0 && (
                <Text style={[styles.doneText, { color: colorTheme.ink2 }]}>
                  Accounts are now visible in <B>Net Worth</B>. Tap any account there to update balances over time.
                </Text>
              )}
            </Card>
            <View style={{ marginTop: 22 }}>
              <PrimaryButton onPress={() => { (onSuccess ?? onClose)(); }}>
                <Icon name={isWizard ? 'arrowRight' : 'check'} size={18} color="#fff" stroke={2.4} />
                <BtnLabel>{isWizard ? 'Continue setup' : 'Done'}</BtnLabel>
              </PrimaryButton>
            </View>
          </>
        )}

        {/* ── SAVING ── */}
        {phase === 'saving' && (
          <Card style={[styles.busyCard, { marginTop: 18 }]}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.busyText, { color: colorTheme.ink2 }]}>Saving your data…</Text>
          </Card>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <>
            <Card style={[styles.errorCard, { borderColor: `${colorTheme.red}44`, backgroundColor: `${colorTheme.red}08` }, { marginTop: 18 }]}>
              <View style={styles.errorRow}>
                <Icon name="alert" size={16} color={colorTheme.red} />
                <Text style={[styles.errorText, { color: colorTheme.red }]}>{error}</Text>
              </View>
            </Card>
            <View style={{ marginTop: 14 }}>
              <PrimaryButton onPress={() => setPhase('pasting')}>
                <Icon name="chevronLeft" size={18} color="#fff" />
                <BtnLabel>Try again</BtnLabel>
              </PrimaryButton>
            </View>
          </>
        )}

        {/* ── ACCOUNT REVIEW ── */}
        {phase === 'accountReview' && (
          <>
            <View style={{ marginTop: 20 }}>
              {parsedTxns.length > 0 && (
                <Card style={{ padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable
                    onPress={() => setUpdateAccountBalances((prev) => !prev)}
                    hitSlop={6}
                    style={{ padding: 2 }}
                  >
                    <View
                      style={[
                        styles.tick,
                        { borderColor: colorTheme.line },
                        updateAccountBalances && { backgroundColor: theme.accent, borderColor: theme.accent },
                      ]}
                    >
                      {updateAccountBalances && (
                        <Text style={{ color: '#fff', fontSize: 11, fontFamily: uiFont(800), lineHeight: 14 }}>✓</Text>
                      )}
                    </View>
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => setUpdateAccountBalances((prev) => !prev)}>
                    <Text style={[styles.accName, { color: colorTheme.ink }]}>
                      Update asset & liability balances
                    </Text>
                    <Text style={[styles.accMeta, { color: colorTheme.ink3, marginTop: 2 }]}>
                      Apply imported income and expenses to adjust asset and liability account balances
                    </Text>
                  </Pressable>
                </Card>
              )}

              <Eyebrow style={{ marginBottom: 12 }}>
                {parsedAccounts.filter((a) => a.include).length} of {parsedAccounts.length} accounts selected
              </Eyebrow>

              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={[styles.kindDot, { backgroundColor: theme.accent }]} />
                <Text style={[styles.legendText, { color: colorTheme.ink2 }]}>Asset</Text>
                <View style={[styles.kindDot, { backgroundColor: colorTheme.amber, marginLeft: 12 }]} />
                <Text style={[styles.legendText, { color: colorTheme.ink2 }]}>Liability (outstanding balance)</Text>
              </View>

              <Card style={{ padding: 14, marginTop: 10 }}>
                <AccountReviewList
                  accounts={parsedAccounts}
                  onChange={setParsedAccounts}
                />
              </Card>
            </View>

            <View style={{ marginTop: 18, gap: 10 }}>
              {parsedTxns.length > 0 ? (
                <PrimaryButton onPress={() => setPhase('txnReview')}>
                  <Icon name="chevronRight" size={18} color="#fff" />
                  <BtnLabel>Continue — Review {parsedTxns.length} transaction{parsedTxns.length === 1 ? '' : 's'}</BtnLabel>
                </PrimaryButton>
              ) : (
                <PrimaryButton onPress={() => void commitAll([], [])}>
                  <Icon name="check" size={18} color="#fff" stroke={2.4} />
                  <BtnLabel>Import {parsedAccounts.filter((a) => a.include).length} account{parsedAccounts.filter((a) => a.include).length === 1 ? '' : 's'}</BtnLabel>
                </PrimaryButton>
              )}
              <Pressable onPress={() => setPhase('pasting')} style={styles.backLink}>
                <Text style={[styles.backLinkText, { color: colorTheme.ink3 }]}>← Back to paste</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── GUIDE + PASTING ── */}
        {(phase === 'guide' || phase === 'pasting') && (
          <>
            {/* Step 1 */}
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: theme.accent }]}><Text style={styles.stepNum}>1</Text></View>
              <Text style={[styles.stepTitle, { color: colorTheme.ink }]}>Copy Prompt</Text>
            </View>

            <Card style={{ padding: 18, gap: 14 }}>
              <Pressable
                onPress={copyPrompt}
                style={({ pressed }) => [
                  styles.copyBtn,
                  { backgroundColor: theme.accentTint, borderColor: theme.accentSoft },
                  pressed && { opacity: 0.88 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Copy prompt to clipboard"
              >
                <Icon name="receipt" size={18} color={theme.accent} />
                <Text style={[styles.copyBtnText, { color: theme.accent }]}>
                  {copied ? '✓ Prompt copied!' : 'Copy Prompt'}
                </Text>
              </Pressable>

              <Text style={[styles.copyHint, { color: colorTheme.ink2 }]}>
                Paste the prompt and attach your file(s): statements, spreadsheets, or any financial export. Multiple files are fine.
              </Text>

              <View>
                <Text style={[styles.openInLabel, { color: colorTheme.ink3 }]}>Open in</Text>
                <View style={styles.llmRow}>
                  {LLM_LINKS.map((l) => <LLMChip key={l.label} {...l} />)}
                </View>
              </View>

              <View style={[styles.tipRow, { backgroundColor: `${colorTheme.amber}12` }]}>
                <Icon name="sparkles" size={13} color={colorTheme.amber} />
                <Text style={[styles.tipText, { color: colorTheme.ink2 }]}>
                  For large or multi-page files, enable <B>thinking / reasoning mode</B> for best results.
                </Text>
              </View>

              {/* What gets imported summary */}
              <View style={[styles.coversBox, { backgroundColor: colorTheme.surface2 }]}>
                <Text style={[styles.coversTitle, { color: colorTheme.ink2 }]}>The prompt covers:</Text>
                {[
                  'Transactions (expenses, income)',
                  'Cash & savings account balances',
                  'Investments (stocks, crypto, unit trusts)',
                  'Liabilities (loans, credit cards, BNPL)',
                ].map((line) => (
                  <View key={line} style={styles.coversRow}>
                    <Text style={[styles.coversDot, { color: theme.accent }]}>✓</Text>
                    <Text style={[styles.coversText, { color: colorTheme.ink2 }]}>{line}</Text>
                  </View>
                ))}
              </View>

              {/* Prompt preview */}
              <View>
                <Eyebrow style={{ marginBottom: 8 }}>Prompt preview</Eyebrow>
                <View style={[styles.promptBox, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                  <TextInput
                    multiline
                    editable={false}
                    selectTextOnFocus
                    value={prompt}
                    style={[styles.promptText, { color: colorTheme.ink2 }]}
                    scrollEnabled={false}
                    accessibilityLabel="Prompt text, selectable"
                  />
                </View>
                <Text style={[styles.promptNote, { color: colorTheme.ink3 }]}>
                  Long-press to select all and copy if the button above doesn't work.
                </Text>
              </View>
            </Card>

            {/* Arrow */}
            <View style={styles.arrowRow}>
              <View style={[styles.arrowLine, { backgroundColor: colorTheme.line }]} />
              <Text style={[styles.arrowIcon, { color: colorTheme.ink3 }]}>↓</Text>
              <View style={[styles.arrowLine, { backgroundColor: colorTheme.line }]} />
            </View>

            {/* Step 2 */}
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: theme.accent }]}><Text style={styles.stepNum}>2</Text></View>
              <Text style={[styles.stepTitle, { color: colorTheme.ink }]}>Import Result</Text>
            </View>

            <Card style={{ padding: 18, gap: 14 }}>
              <Text style={[styles.copyHint, { color: colorTheme.ink2 }]}>
                Copy the entire JSON block from the AI and paste it below, or upload a saved .json file.
              </Text>

              <Pressable
                onPress={pickJsonFile}
                disabled={pickingFile}
                style={({ pressed }) => [
                  styles.copyBtn,
                  { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line },
                  (pressed || pickingFile) && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Upload a JSON file from your device"
              >
                {pickingFile ? (
                  <ActivityIndicator color={theme.accent} size="small" />
                ) : (
                  <Icon name="upload" size={17} color={colorTheme.ink} />
                )}
                <Text style={[styles.copyBtnText, { color: colorTheme.ink }]}>
                  {pickingFile ? 'Reading file…' : 'Upload JSON File'}
                </Text>
              </Pressable>

              <View style={styles.arrowRow}>
                <View style={[styles.arrowLine, { backgroundColor: colorTheme.line }]} />
                <Text style={[styles.orText, { color: colorTheme.ink3 }]}>or paste below</Text>
                <View style={[styles.arrowLine, { backgroundColor: colorTheme.line }]} />
              </View>

              <TextInput
                multiline
                value={jsonText}
                onChangeText={(t) => {
                  setJsonText(t);
                  setPhase((prev) => (prev === 'guide' ? 'pasting' : prev));
                }}
                placeholder={'{\n  "transactions": [ … ],\n  "accounts": [ … ]\n}'}
                placeholderTextColor={colorTheme.ink3}
                style={[
                  styles.jsonInput,
                  { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, color: colorTheme.ink },
                ]}
                textAlignVertical="top"
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                accessibilityLabel="Paste JSON here"
              />

              <PrimaryButton onPress={() => handlePasteImport()}>
                <Icon name="check" size={18} color="#fff" stroke={2.4} />
                <BtnLabel>Parse & Review</BtnLabel>
              </PrimaryButton>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 10 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontFamily: uiFont(800), fontSize: 13, color: '#fff' },
  stepTitle: { fontFamily: uiFont(700), fontSize: 16 },

  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  copyBtnText: { fontFamily: uiFont(700), fontSize: 15 },

  copyHint: { fontFamily: uiFont(500), fontSize: 13, lineHeight: 19, textAlign: 'center' },

  openInLabel: { fontFamily: uiFont(600), fontSize: 12, textAlign: 'center', marginBottom: 8 },
  llmRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  llmChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1 },
  llmEmoji: { fontSize: 15 },
  llmLabel: { fontFamily: uiFont(600), fontSize: 13 },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: radius.sm, padding: 11 },
  tipText: { fontFamily: uiFont(500), fontSize: 12.5, flex: 1, lineHeight: 18 },

  coversBox: { borderRadius: radius.sm, padding: 12, gap: 6 },
  coversTitle: { fontFamily: uiFont(700), fontSize: 12, marginBottom: 4 },
  coversRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  coversDot: { fontFamily: uiFont(700), fontSize: 12, width: 14 },
  coversText: { fontFamily: uiFont(500), fontSize: 12.5, flex: 1 },

  promptBox: { borderWidth: 1, borderRadius: radius.sm, padding: 12, maxHeight: 180, overflow: 'hidden' },
  promptText: { fontFamily: uiFont(400), fontSize: 11, lineHeight: 16 },
  promptNote: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 6, textAlign: 'center' },

  arrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6, paddingHorizontal: 24 },
  arrowLine: { flex: 1, height: 1 },
  arrowIcon: { fontFamily: uiFont(400), fontSize: 18 },
  orText: { fontFamily: uiFont(600), fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4 },

  jsonInput: {
    borderWidth: 1.5,
    borderRadius: radius.sm, padding: 12, height: 160,
    fontFamily: uiFont(400), fontSize: 12, lineHeight: 18,
  },

  // Account review
  accRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tick: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  kindDot: { width: 7, height: 7, borderRadius: 4 },
  accName: { fontFamily: uiFont(700), fontSize: 13.5, flex: 1 },
  accMeta: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 1 },
  accBalance: { fontFamily: uiFont(700), fontSize: 13, flexShrink: 0 },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: uiFont(500), fontSize: 12 },

  backLink: { alignItems: 'center', paddingVertical: 8 },
  backLinkText: { fontFamily: uiFont(600), fontSize: 13 },

  // Done / saving / error
  busyCard: { padding: 22, alignItems: 'center', gap: 12 },
  busyText: { fontFamily: uiFont(500), fontSize: 13, textAlign: 'center' },
  doneText: { fontFamily: uiFont(500), fontSize: 13.5, lineHeight: 20 },
  errorCard: { borderWidth: 1.5, borderRadius: radius.md, padding: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorText: { fontFamily: uiFont(500), fontSize: 13.5, flex: 1, lineHeight: 19 },
});
