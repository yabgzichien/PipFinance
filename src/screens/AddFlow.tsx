import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PipWearsHat } from '../components/Pip';
import { BubbleText, PipSays } from '../components/ui';
import { getLLM } from '../llm';
import { getAutoFillForMonth, recordAutoFill } from '../db/memoryRepo';
import { currentMonthKey } from '../lib/budget';
import { todayISO } from '../lib/duplicates';
import { defaultLinkEffect } from '../lib/networth';
import { type ScannedReceipt } from '../lib/parseReceipt';
import { prevMonthKey } from '../lib/recap';
import { autoFillStats, suggestForMerchant, type AutoFillStats } from '../lib/recommend';
import { DROP, type CategorySuggestion, type ExtractedTxn, type SplitDraft, type Transaction } from '../lib/types';
import { useAppData, type NewLearned } from '../state/store';
import { useBackHandler } from '../state/useBackHandler';
import { useThemeColors } from '../state/colorScheme';
import { AttachScreen, type PickedImage } from './AttachScreen';
import { CategorizeScreen, type PendingSettlement } from './CategorizeScreen';
import { ExtractScreen } from './ExtractScreen';
import { ManualEntryScreen } from './ManualEntryScreen';
import { ReceiptScanScreen, type ReceiptSplitResult } from './ReceiptScanScreen';
import { SavedScreen } from './SavedScreen';
import { ScanKindScreen } from './ScanKindScreen';

type Phase =
  | 'attach'
  | 'kind'
  | 'extract'
  | 'guessing'
  | 'categorize'
  | 'manual'
  | 'receipt'
  | 'split'
  | 'saved';

const GUESS_TIMEOUT_MS = 12000;

/** Bounds an in-flight promise so a hung request can't strand the user indefinitely. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Category guess timed out.')), ms)),
  ]);
}

type AddFlowProps = {
  onClose: () => void;
  initialPhase?: Phase;
};

/**
 * The add-a-receipt flow: Attach → Extract → Categorize → Saved.
 * Mirrors the design's state machine but wired to the real LLM + SQLite.
 *
 * Pip wears his straw hat for the whole flow. The wrapper exists because every phase below is its
 * own early return, and because <PipSays> is shared with screens outside this flow, so the hat has
 * to be scoped by where a Pip is rendered rather than by which component renders it.
 */
export function AddFlow(props: AddFlowProps) {
  return (
    <PipWearsHat>
      <AddFlowPhases {...props} />
    </PipWearsHat>
  );
}

function AddFlowPhases({ onClose, initialPhase = 'attach' }: AddFlowProps) {
  const { commitCategorized, recordBalanceLink, settleShare, accounts, memory, categories, catById } = useAppData();
  const colorTheme = useThemeColors();

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [extracted, setExtracted] = useState<ExtractedTxn[]>([]);
  const [suggestions, setSuggestions] = useState<(CategorySuggestion | null)[]>([]);
  const [cached, setCached] = useState<ExtractedTxn[] | undefined>(undefined);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptSplitResult | null>(null);
  // Set once ReceiptScanScreen actually reads the picked image, so backing out to the kind
  // question and choosing "receipt" again reuses the read instead of paying for another one.
  const [cachedReceipt, setCachedReceipt] = useState<ScannedReceipt | null>(null);
  const [result, setResult] = useState<Transaction[]>([]);
  const [newLearned, setNewLearned] = useState<NewLearned[]>([]);
  const [hasKey, setHasKey] = useState(true);
  // The memory-matched suggestions from this scan (source: 'learned' only, not AI guesses),
  // carried from onExtracted to onCategorized so the auto-fill competence signal
  // (docs/ui-engagement-plan.md Step 5) reflects what Pip actually knew at extraction time,
  // not what the user ends up picking after reviewing.
  const [learnedThisScan, setLearnedThisScan] = useState<(CategorySuggestion | null)[]>([]);
  const [autoFill, setAutoFill] = useState<{ current: AutoFillStats; lastMonth: AutoFillStats } | null>(null);
  // The real extraction round-trip, carried from ExtractScreen to the Saved screen's "Read in
  // Ns" payoff line (docs/ui-engagement-plan.md Step 2). Null for any path that never ran a
  // live extraction (manual entry, receipt scan, a cached re-review).
  const [extractElapsedMs, setExtractElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    getLLM().then((llm) => setHasKey(llm.can('extract')));
  }, []);

  // Named so hardware/gesture back can call the exact same transition as each phase's own back
  // button below — the two must never disagree about where back goes.
  const backToAttach = () => setPhase('attach');
  // Both readers were reached by answering the kind question, so back re-asks it. Getting the
  // answer wrong costs one tap, not another trip to the camera.
  const backToKind = () => setPhase(image ? 'kind' : 'attach');
  const backFromManualOrSplit = () => setPhase(phase === 'split' && receiptResult ? 'receipt' : 'attach');
  const backFromCategorize = () => {
    setCached(extracted);
    setPhase('extract');
  };

  useBackHandler(() => {
    if (phase === 'receipt' || phase === 'extract') {
      backToKind();
      return true;
    }
    if (phase === 'kind') {
      backToAttach();
      return true;
    }
    if (phase === 'manual' || phase === 'split') {
      backFromManualOrSplit();
      return true;
    }
    if (phase === 'categorize') {
      backFromCategorize();
      return true;
    }
    // attach / guessing / saved: nothing further back within the flow, so close it —
    // the same as tapping this phase's own close button.
    onClose();
    return true;
  });

  // The hub has one scan button and therefore no idea what it just captured. Rather than guess,
  // hand off to the kind question, which routes to the itemised reader or the batch reader.
  const onPicked = (img: PickedImage) => {
    setImage(img);
    setCached(undefined);
    setExtractElapsedMs(null);
    setAutoFill(null);
    setReceiptResult(null);
    setCachedReceipt(null);
    setPhase('kind');
  };

  const onExtracted = async (items: ExtractedTxn[], accountId: string | null, elapsedMs: number | null) => {
    setExtracted(items);
    setLinkId(accountId);
    setExtractElapsedMs(elapsedMs);

    const learned: (CategorySuggestion | null)[] = items.map((it) => {
      const s = suggestForMerchant(memory, it.merchant);
      if (!s) return null;
      const cat = catById[s];
      // only pre-fill if the learned category matches this item's kind
      return cat && cat.kind === it.type ? { categoryId: s, source: 'learned' } : null;
    });
    setLearnedThisScan(learned);

    const missing = learned.map((s, i) => (s ? -1 : i)).filter((i) => i !== -1);
    if (missing.length === 0) {
      setSuggestions(learned);
      setPhase('categorize');
      return;
    }

    setPhase('guessing');
    const llm = await getLLM();
    if (!llm.can('guessCategories')) {
      setSuggestions(learned);
      setPhase('categorize');
      return;
    }

    try {
      const guessed = await withTimeout(
        llm.guessCategories({
          items: missing.map((i) => ({ index: i, merchant: items[i].merchant, amount: items[i].amount, method: items[i].method, kind: items[i].type })),
          categories: categories.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
        }),
        GUESS_TIMEOUT_MS
      );
      setSuggestions(learned.map((s, i) => s ?? (guessed[i] ? { categoryId: guessed[i]!, source: 'guess' } : null)));
    } catch {
      // Enhancement-only: any failure (network, timeout, bad reply) just falls
      // back to today's behavior  no suggestion for that merchant.
      setSuggestions(learned);
    }
    setPhase('categorize');
  };

  const onCategorized = async (
    assignments: (string | null)[],
    items: ExtractedTxn[],
    splitDrafts: (SplitDraft | null)[] = [],
    settlements: (PendingSettlement | null)[] = []
  ) => {
    const { created, newLearned: learned } = await commitCategorized(items, assignments, 'extracted', splitDrafts);
    // If the whole batch was tagged to an account, move that account's balance
    // per saved row — direction derived from account kind + txn type (an expense
    // reduces an asset / pays down a liability; income does the reverse).
    const account = linkId ? accounts.find((a) => a.id === linkId) : null;
    if (account) {
      // `created` is the kept rows in order, so drop the same items commitCategorized dropped
      // to line the drafts back up with them.
      const keptDrafts = items.map((_, i) => splitDrafts[i] ?? null).filter((_, i) => assignments[i] !== DROP);
      for (let k = 0; k < created.length; k++) {
        const t = created[k];
        // A split row saved at the payer's own share, but the whole bill left the account, so
        // the balance moves by the gross or the cash side is short by what friends owe.
        const moved = keptDrafts[k]?.gross ?? t.amount;
        await recordBalanceLink(account.id, moved, defaultLinkEffect(account.kind, t.type), t.date ?? todayISO());
      }
    }
    // Repayments the user confirmed: settled against the receivable, never written as income.
    for (const s of settlements) {
      if (s) await settleShare(s.shareId, s.amount, s.paidOn, 'matched', s.merchant, linkId);
    }

    // The auto-fill competence signal (docs/ui-engagement-plan.md Step 5): how much of this
    // scan Pip already knew, next to the same measure for last calendar month.
    const stats = autoFillStats(learnedThisScan);
    const month = currentMonthKey();
    const [, lastMonth] = await Promise.all([recordAutoFill(month, stats), getAutoFillForMonth(prevMonthKey(month))]);
    setAutoFill({ current: stats, lastMonth });

    setResult(created);
    setNewLearned(learned);
    setPhase('saved');
  };

  const onManualComplete = async (item: ExtractedTxn, categoryId: string, split: SplitDraft | null) => {
    const { created, newLearned: learned } = await commitCategorized(
      [item],
      [categoryId],
      'manual',
      [split],
      [receiptResult?.photoUri ?? null]
    );
    setResult(created);
    setNewLearned(learned);
    setExtractElapsedMs(null);
    setAutoFill(null);
    setPhase('saved');
  };

  if (phase === 'attach') {
    return (
      <AttachScreen
        hasKey={hasKey}
        onClose={onClose}
        onPicked={onPicked}
        onManual={() => setPhase('manual')}
      />
    );
  }
  if (phase === 'kind' && image) {
    return (
      <ScanKindScreen
        image={image}
        onBack={backToAttach}
        onReceipt={() => setPhase('receipt')}
        onHistory={() => setPhase('extract')}
      />
    );
  }
  if (phase === 'guessing') {
    return (
      <View style={{ flex: 1, backgroundColor: colorTheme.bg, justifyContent: 'center', paddingHorizontal: 18 }}>
        <PipSays expr="think">
          <BubbleText>Thinking about your new merchants… this can take a few seconds.</BubbleText>
        </PipSays>
      </View>
    );
  }
  if (phase === 'receipt') {
    return (
      <ReceiptScanScreen
        initialImage={image ?? undefined}
        cachedReceipt={cachedReceipt}
        onScanned={setCachedReceipt}
        onBack={backToKind}
        onManualInstead={() => {
          setReceiptResult(null);
          setPhase('split');
        }}
        onDone={(r) => {
          setReceiptResult(r);
          setPhase('split');
        }}
      />
    );
  }
  if (phase === 'manual' || phase === 'split') {
    return (
      <ManualEntryScreen
        categories={categories}
        onBack={backFromManualOrSplit}
        onComplete={onManualComplete}
        // Three ways in, three honest titles: a scanned receipt lands here already filled in, the
        // no-receipt path is a bare split, and 'manual' is a plain typed entry.
        title={phase !== 'split' ? undefined : receiptResult ? 'Check your receipt' : 'Split a bill'}
        startSplitting={phase === 'split'}
        initialMerchant={phase === 'split' ? receiptResult?.merchant ?? null : null}
        initialAmount={phase === 'split' ? receiptResult?.charged ?? null : null}
        initialSplit={phase === 'split' ? receiptResult?.draft ?? null : null}
      />
    );
  }
  if (phase === 'extract' && image) {
    return (
      <ExtractScreen
        key={`${image.uri}:${cached ? 'c' : 'f'}`}
        image={image}
        cachedItems={cached}
        linkId={linkId}
        onBack={backToKind}
        onDone={onExtracted}
      />
    );
  }
  if (phase === 'categorize') {
    return (
      <CategorizeScreen
        extracted={extracted}
        suggestions={suggestions}
        categories={categories}
        linkId={linkId}
        onBack={backFromCategorize}
        onComplete={onCategorized}
      />
    );
  }
  return (
    <SavedScreen result={result} newLearned={newLearned} catById={catById} elapsedMs={extractElapsedMs} autoFill={autoFill} onDone={onClose} />
  );
}
