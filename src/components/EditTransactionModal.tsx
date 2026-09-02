import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image as RNImage, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_EXPENSE_ID, DEFAULT_INCOME_ID } from '../data/categories';
import type { Transaction, TxnType } from '../lib/types';
import { BASE_CURRENCY, deriveNative, round2 } from '../lib/currency';
import { cleanCalcInput, evaluateExpression } from '../lib/calc';
import { decimalsFor } from '../lib/currencies';
import { todayISO } from '../lib/duplicates';
import { listFxRates } from '../db/fxRepo';
import { rateFor, ratesFromCache } from '../lib/fx';
import { defaultLinkEffect, type LinkEffect } from '../lib/networth';
import { confirmAction } from '../lib/platformAlert';
import { deleteReceiptImage } from '../lib/receiptStorage';
import { tap } from '../lib/haptics';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { numFont, radius, shadowToggle, uiFont } from '../theme';
import { AccountLinkField } from './AccountLinkField';
import { AddCategoryModal } from './AddCategoryModal';
import { CalcBadge } from './CalcBadge';
import { InfoButton } from './InfoButton';
import { SplitSheet } from './SplitSheet';
import { BtnLabel, CategoryChip, PrimaryButton } from './ui';
import { Icon } from './Icon';
import { currencyPrefix, fmtMoney } from '../lib/format';
import { outstanding } from '../lib/split';
import type { SplitDraft } from '../lib/types';

/** Bottom-sheet editor for a single transaction. Shared by Dashboard + View All. */
export function EditTransactionModal({ txn, onClose }: { txn: Transaction | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh, tCat } = useLanguage();
  const {
    categories,
    accounts,
    saveTransactionEdits,
    removeTransaction,
    recordBalanceLink,
    splits,
    shares,
    people,
    splitTransaction,
    unsplitTransaction,
  } = useAppData();

  const [amountText, setAmountText] = useState('');
  const [type, setType] = useState<TxnType>('expense');
  const [cat, setCat] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [adding, setAdding] = useState(false);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  // Cached rates, refreshed each time a transaction is opened for editing: needed to convert
  // this row's MYR-equivalent into a linked account's own currency (Task 9), since
  // `balance_entries.value` is native to the account rather than always MYR.
  const [rates, setRates] = useState<Record<string, number>>({});

  const assetAccounts = useMemo(() => accounts.filter((a) => !a.archived && a.kind === 'asset'), [accounts]);
  const liabilityAccounts = useMemo(() => accounts.filter((a) => !a.archived && a.kind === 'liability'), [accounts]);

  const openId = txn?.id;
  useEffect(() => {
    if (txn) {
      // `nativeAmount` is what the user actually typed for a foreign row; `amount` is always
      // the MYR column. Seeding from `amount` here would show a ringgit figure in a field
      // that saves back as the row's own currency (e.g. yuan).
      setAmountText((txn.nativeAmount ?? txn.amount).toFixed(decimalsFor(txn.currency)));
      setType(txn.type);
      setCat(txn.categoryId);
      setRemark(txn.remark ?? '');
      setFromAccountId(null);
      setToAccountId(null);
      setSplitting(false);
      setViewingReceipt(false);
      listFxRates().then((fx) => setRates(ratesFromCache(fx)));
    }
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const split = useMemo(() => splits.find((s) => s.txnId === openId) ?? null, [splits, openId]);
  const splitShares = useMemo(
    () => (split ? shares.filter((s) => s.splitId === split.id) : []),
    [shares, split]
  );
  const splitDraft: SplitDraft | null = useMemo(
    () =>
      split
        ? {
            gross: split.gross,
            ownShare: split.ownShare,
            method: split.method,
            shares: splitShares.map((s) => ({ personId: s.personId, owed: s.owed })),
          }
        : null,
    [split, splitShares]
  );
  const stillOwed = splitShares
    .filter((s) => s.status === 'open')
    .reduce((sum, s) => sum + outstanding(s), 0);
  const splitNames = splitShares
    .map((s) => people.find((p) => p.id === s.personId)?.name ?? 'someone')
    .join(', ');


  const grid = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);

  const decimals = decimalsFor(txn?.currency ?? BASE_CURRENCY);
  const currencyLabel = currencyPrefix(txn?.currency ?? BASE_CURRENCY);
  const calc = useMemo(() => evaluateExpression(amountText, decimals), [amountText, decimals]);

  const mergeScaleX = useRef(new Animated.Value(1)).current;
  const mergeScaleY = useRef(new Animated.Value(1)).current;
  const mergeOpacity = useRef(new Animated.Value(1)).current;
  const [isMerging, setIsMerging] = useState(false);

  if (!txn) return <Modal visible={false} transparent />;

  const handleMerge = () => {
    if (!calc.isExpression || calc.result == null || calc.result <= 0) return;
    const finalValue = decimals === 0 ? String(Math.round(calc.result)) : calc.result.toFixed(decimals);
    const useNative = Platform.OS !== 'web';

    setIsMerging(true);
    tap();

    // Phase 1: Numbers squeeze/merge inward
    Animated.parallel([
      Animated.timing(mergeScaleX, {
        toValue: 0.82,
        duration: 80,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(mergeScaleY, {
        toValue: 0.88,
        duration: 80,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(mergeOpacity, {
        toValue: 0.35,
        duration: 80,
        useNativeDriver: useNative,
      }),
    ]).start(() => {
      // Switch text to merged result
      setAmountText(finalValue);

      // Phase 2: Bloom outward with spring bounce into final number
      Animated.parallel([
        Animated.spring(mergeScaleX, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: useNative,
        }),
        Animated.spring(mergeScaleY, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: useNative,
        }),
        Animated.timing(mergeOpacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: useNative,
        }),
      ]).start(() => {
        setIsMerging(false);
      });
    });
  };

  const fromAccount = fromAccountId ? accounts.find((a) => a.id === fromAccountId) ?? null : null;
  const fromConvertible =
    !fromAccount || fromAccount.currency === txn.currency || fromAccount.currency === BASE_CURRENCY || rateFor(rates, fromAccount.currency) != null;
  const toAccount = toAccountId ? accounts.find((a) => a.id === toAccountId) ?? null : null;
  const toConvertible =
    !toAccount || toAccount.currency === txn.currency || toAccount.currency === BASE_CURRENCY || rateFor(rates, toAccount.currency) != null;
  const canSave = fromConvertible && toConvertible;

  const switchType = (t: TxnType) => {
    if (t === type) return;
    setType(t);
    setCat((prev) => {
      const c = categories.find((x) => x.id === prev);
      return c && c.kind === t ? prev : t === 'income' ? DEFAULT_INCOME_ID : DEFAULT_EXPENSE_ID;
    });
  };

  const save = async () => {
    const n = calc.result;
    // `txn.amount` is the MYR column; the field (and everything below) works in the row's own
    // currency, which is `nativeAmount` for a foreign row.
    const nativeCurrent = txn.nativeAmount ?? txn.amount;
    // A split row's amount is derived from the split, so it is not the user's to retype here:
    // letting it drift would leave `gross` and the shares reconciling against nothing.
    const amount = split
      ? nativeCurrent
      : n != null && Number.isFinite(n) && n >= 0
        ? round2(n)
        : nativeCurrent;
    const categoryId = type === 'transfer' ? null : cat ?? (type === 'income' ? DEFAULT_INCOME_ID : DEFAULT_EXPENSE_ID);
    // `updateTransactionFields` (via saveTransactionEdits) treats its amount as native and
    // re-derives the MYR column itself from the row's own frozen rate.
    await saveTransactionEdits(txn, { amount, type, categoryId, remark: remark.trim() || null });
    // The row's MYR-equivalent, converted at the row's own frozen rate (never today's), used
    // both for its own bookkeeping and, below, as the starting point for converting into the
    // linked account's own currency.
    const myrAmount = txn.fxRate != null ? round2(amount * txn.fxRate) : amount;

    // 1. Pay from / Deposit into account
    if (fromAccountId && fromAccount) {
      const effect: LinkEffect = type === 'income' ? 'add' : 'subtract';
      const linkAmount =
        fromAccount.currency === txn.currency ? amount : deriveNative(myrAmount, fromAccount.currency, rateFor(rates, fromAccount.currency));
      await recordBalanceLink(fromAccountId, linkAmount, effect, txn.date ?? todayISO());
    }

    // 2. Reduce liability account for expense
    if (type === 'expense' && toAccountId && toAccount) {
      const toAmount =
        toAccount.currency === txn.currency ? amount : deriveNative(myrAmount, toAccount.currency, rateFor(rates, toAccount.currency));
      await recordBalanceLink(toAccountId, toAmount, 'subtract', txn.date ?? todayISO());
    }
    onClose();
  };

  const currentCat = categories.find((c) => c.id === (cat ?? txn.categoryId));
  const currentCatLabel =
    (currentCat ? tCat(currentCat) : null) ??
    (txn.type === 'income' ? (isZh ? '收入' : 'Income') : txn.type === 'transfer' ? (isZh ? '转账' : 'Transfer') : (isZh ? '支出' : 'Expense'));

  const confirmDelete = () => {
    const label = txn.merchantRaw || currentCatLabel;
    confirmAction(
      isZh ? '删除账单？' : 'Delete transaction?',
      isZh ? `确定删除“${label}”吗？此操作无法撤销。` : `Remove “${label}”? This can’t be undone.`,
      isZh ? '删除' : 'Delete',
      async () => {
        await removeTransaction(txn.id);
        if (txn.receiptUri) deleteReceiptImage(txn.receiptUri);
        onClose();
      }
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetAvoider}
        pointerEvents="box-none"
      >
        <View style={[styles.sheetCard, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
          <View style={styles.head}>
          <Text style={[styles.title, { color: colorTheme.ink }]} numberOfLines={1}>
            {txn.merchantRaw || currentCatLabel}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="x" size={20} color={colorTheme.ink2} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!!txn.receiptUri && (
            <Pressable
              onPress={() => setViewingReceipt(true)}
              style={[styles.splitRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, marginTop: 0, marginBottom: 18 }]}
              hitSlop={4}
            >
              <RNImage source={{ uri: txn.receiptUri }} style={[styles.receiptThumb, { borderColor: colorTheme.line }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.splitTitle, { color: colorTheme.ink }]}>{isZh ? '小票照片' : 'Receipt photo'}</Text>
                <Text style={[styles.splitSub, { color: colorTheme.ink2 }]}>{isZh ? '点击查看' : 'Tap to view'}</Text>
              </View>
              <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
            </Pressable>
          )}

          {/* type toggle — a transfer (e.g. a DCA contribution) can never be flipped into an
              expense or income here; it moves money between two accounts, not into a category. */}
          {type === 'transfer' ? (
            <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
              <View style={[styles.toggleBtn, styles.toggleBtnOn, { backgroundColor: colorTheme.surface }]}>
                <Text style={[styles.toggleText, styles.toggleTextOn, { color: colorTheme.ink }]}>{isZh ? '转账' : 'Transfer'}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
              {(['expense', 'income'] as TxnType[]).map((k) => {
                const on = type === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => switchType(k)}
                    style={[styles.toggleBtn, on && styles.toggleBtnOn, on && { backgroundColor: colorTheme.surface }]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        { color: colorTheme.ink2 },
                        on && styles.toggleTextOn,
                        on && { color: colorTheme.ink },
                      ]}
                    >
                      {k === 'expense' ? (isZh ? '支出' : 'Expense') : (isZh ? '收入' : 'Income')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{split ? (isZh ? '个人承担' : 'Your share') : (isZh ? '金额' : 'Amount')}</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.rmPrefix, { color: colorTheme.ink2 }]}>{currencyLabel}</Text>
            <Animated.View
              style={{
                flex: 1,
                minWidth: 0,
                opacity: mergeOpacity,
                transform: [{ scaleX: mergeScaleX }, { scaleY: mergeScaleY }],
              }}
            >
              <TextInput
                value={amountText}
                onChangeText={(t) => setAmountText(cleanCalcInput(t, decimals > 0))}
                onSubmitEditing={handleMerge}
                keyboardType="numbers-and-punctuation"
                selectTextOnFocus
                editable={!split}
                style={[
                  styles.amountInput,
                  { color: isMerging ? theme.accent : colorTheme.ink, backgroundColor: colorTheme.surface, borderColor: colorTheme.line },
                  !!split && styles.amountInputLocked,
                  !!split && { backgroundColor: colorTheme.surface2, color: colorTheme.ink2 },
                ]}
              />
            </Animated.View>
            {!split && calc.isExpression && calc.result != null && calc.result > 0 && (
              <CalcBadge
                result={calc.result}
                decimals={decimals}
                onApply={handleMerge}
              />
            )}
          </View>
          {!!split && (
            <Text style={[styles.lockNote, { color: colorTheme.ink3 }]}>
              {isZh
                ? `已从账户扣除 ${fmtMoney(split.gross, txn.currency)}。在下方修改分账以调整此金额。`
                : `${fmtMoney(split.gross, txn.currency)} left your account. Change the split below to adjust this.`}
            </Text>
          )}

          {type !== 'transfer' && (
            <>
              <Text style={[styles.fieldLabel, { color: colorTheme.ink2, marginTop: 18 }]}>{isZh ? '分类' : 'Category'}</Text>
              <View style={styles.grid}>
                {grid.map((c) => (
                  <View key={c.id} style={styles.gridCell}>
                    <CategoryChip category={c} selected={cat === c.id} suggested={false} onPress={() => setCat(c.id)} />
                  </View>
                ))}
                <View style={styles.gridCell}>
                  <Pressable onPress={() => setAdding(true)} style={[styles.addChip, { borderColor: theme.accentSoft, backgroundColor: theme.accentTint }]}>
                    <Icon name="plus" size={16} color={theme.accent} stroke={2.2} />
                    <Text style={[styles.addChipText, { color: theme.accent }]}>{isZh ? '新建分类' : 'New category'}</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2, marginTop: 18 }]}>{isZh ? '备注（选填）' : 'Remark (optional)'}</Text>
          <TextInput
            value={remark}
            onChangeText={setRemark}
            placeholder={isZh ? '例如：与供应商共进午餐' : 'e.g. Lunch with a supplier'}
            placeholderTextColor={colorTheme.ink3}
            style={[styles.remarkInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
            multiline
          />

          {type === 'expense' && (
            <Pressable
              onPress={() => setSplitting(true)}
              style={[styles.splitRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}
              hitSlop={4}
            >
              <Icon name="gift" size={18} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.splitTitle, { color: colorTheme.ink }]}>{isZh ? '与朋友分摊' : 'Split with friends'}</Text>
                  <InfoButton entry="split_bill" />
                </View>
                <Text style={[styles.splitSub, { color: colorTheme.ink2 }]} numberOfLines={1}>
                  {split
                    ? stillOwed > 0
                      ? (isZh ? `${splitNames} 欠你 ${fmtMoney(stillOwed, txn.currency)}` : `${splitNames} owe you ${fmtMoney(stillOwed, txn.currency)}`)
                      : (isZh ? `${splitNames} 已结清` : `${splitNames} settled up`)
                    : (isZh ? '仅记录您的个人份额，并追踪待收借款' : 'Record only your share and track what you are owed')}
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
            </Pressable>
          )}

          {type !== 'transfer' && (
            <>
              <View style={{ marginTop: 18 }}>
                <AccountLinkField
                  accounts={assetAccounts.length > 0 ? assetAccounts : accounts}
                  selectedId={fromAccountId}
                  onSelect={setFromAccountId}
                  label={type === 'expense' ? (isZh ? '扣款账户（选填）' : 'Pay from (optional)') : (isZh ? '存入账户（选填）' : 'Deposit into (optional)')}
                />
              </View>

              {type === 'expense' && (
                <View style={{ marginTop: 18 }}>
                  <AccountLinkField
                    accounts={liabilityAccounts}
                    selectedId={toAccountId}
                    onSelect={setToAccountId}
                    label={isZh ? '抵扣负债账户（分期还款可选，如车贷/房贷）' : 'Reduce liability account (optional, e.g. car/mortgage loan)'}
                    infoEntry="reduce_liability"
                  />
                </View>
              )}
            </>
          )}

          <View style={{ marginTop: 20 }}>
            <PrimaryButton onPress={save} height={52} disabled={!canSave}>
              <Icon name="check" size={18} color="#fff" stroke={2.4} />
              <BtnLabel>{isZh ? '保存修改' : 'Save changes'}</BtnLabel>
            </PrimaryButton>
          </View>

          <Pressable onPress={confirmDelete} style={styles.deleteBtn} hitSlop={6}>
            <Icon name="trash" size={17} color="#b3261e" />
            <Text style={styles.deleteText}>{isZh ? '删除账单' : 'Delete transaction'}</Text>
          </Pressable>
        </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <AddCategoryModal
        visible={adding}
        kind={type}
        onClose={() => setAdding(false)}
        onCreated={(id) => {
          setCat(id);
          setAdding(false);
        }}
      />

      {/* Splitting saves and closes on its own: it rewrites the row's amount, so leaving the
          editor open on a stale figure would invite the user to save the old one back. */}
      <SplitSheet
        visible={splitting}
        // Splitting for the first time must divide the row's own currency, not the MYR column
        // (the same `nativeAmount ?? amount` rule as the amount field above); an already-split
        // row keeps its stored gross, which was raised in that same currency at creation time.
        gross={split ? split.gross : (txn.nativeAmount ?? txn.amount)}
        currency={txn.currency}
        merchant={txn.merchantRaw}
        initial={splitDraft}
        onClose={() => setSplitting(false)}
        onApply={async (draft) => {
          setSplitting(false);
          await splitTransaction(txn, draft);
          onClose();
        }}
        onRemove={
          split
            ? async () => {
                setSplitting(false);
                await unsplitTransaction(txn);
                onClose();
              }
            : undefined
        }
      />

      <Modal
        visible={viewingReceipt}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingReceipt(false)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewingReceipt(false)}>
          {!!txn.receiptUri && (
            <RNImage source={{ uri: txn.receiptUri }} style={styles.viewerImage} resizeMode="contain" />
          )}
          <Pressable onPress={() => setViewingReceipt(false)} style={[styles.viewerClose, { top: insets.top + 12 }]} hitSlop={10}>
            <Icon name="x" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  sheetAvoider: { flex: 1, justifyContent: 'flex-end' },
  sheetCard: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { flex: 1, fontFamily: uiFont(700), fontSize: 19, marginRight: 12 },
  toggle: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
  },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleBtnOn: { ...shadowToggle },
  toggleText: { fontFamily: uiFont(600), fontSize: 14 },
  toggleTextOn: {},
  fieldLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rmPrefix: { fontFamily: numFont(600), fontSize: 18 },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: numFont(700),
    fontSize: 24,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  amountInputLocked: {},
  lockNote: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 6 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 18,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  splitTitle: { fontFamily: uiFont(700), fontSize: 14 },
  splitSub: { fontFamily: uiFont(500), fontSize: 12, marginTop: 2 },
  receiptThumb: { width: 44, height: 44, borderRadius: 10, borderWidth: 1 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(10,14,12,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', right: 18, padding: 8 },
  remarkInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: uiFont(600),
    fontSize: 14.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addChipText: { fontFamily: uiFont(700), fontSize: 13.5 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 16, marginTop: 4 },
  deleteText: { fontFamily: uiFont(700), fontSize: 14.5, color: '#b3261e' },
});
