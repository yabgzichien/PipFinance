import React, { useEffect, useMemo, useState } from 'react';
import { Image as RNImage, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_EXPENSE_ID, DEFAULT_INCOME_ID } from '../data/categories';
import type { Transaction, TxnType } from '../lib/types';
import { BASE_CURRENCY, deriveNative, round2 } from '../lib/currency';
import { decimalsFor } from '../lib/currencies';
import { todayISO } from '../lib/duplicates';
import { listFxRates } from '../db/fxRepo';
import { rateFor, ratesFromCache } from '../lib/fx';
import { defaultLinkEffect, type LinkEffect } from '../lib/networth';
import { confirmAction } from '../lib/platformAlert';
import { deleteReceiptImage } from '../lib/receiptStorage';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { numFont, radius, shadowToggle, uiFont } from '../theme';
import { AccountLinkField } from './AccountLinkField';
import { AddCategoryModal } from './AddCategoryModal';
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
  const [expanded, setExpanded] = useState(false);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkEffect, setLinkEffect] = useState<LinkEffect>('subtract');
  const [splitting, setSplitting] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  // Cached rates, refreshed each time a transaction is opened for editing: needed to convert
  // this row's MYR-equivalent into a linked account's own currency (Task 9), since
  // `balance_entries.value` is native to the account rather than always MYR.
  const [rates, setRates] = useState<Record<string, number>>({});

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
      setExpanded(false);
      setLinkId(null);
      setLinkEffect(defaultLinkEffect('asset', txn.type));
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

  const selectLink = (id: string | null) => {
    setLinkId(id);
    const a = id ? accounts.find((x) => x.id === id) : null;
    if (a) setLinkEffect(defaultLinkEffect(a.kind, type));
  };

  const grid = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);
  // Collapsed: show 4 (keep the selected one visible). Expanded: show all.
  const visible = useMemo(() => {
    if (expanded) return grid;
    const top4 = grid.slice(0, 4);
    if (!cat || top4.some((c) => c.id === cat)) return top4;
    const selected = grid.find((c) => c.id === cat);
    return selected ? [selected, ...top4].slice(0, 4) : top4;
  }, [grid, expanded, cat]);

  if (!txn) return <Modal visible={false} transparent />;

  // Currency is fixed once a row is written (spec §Non-goals: changing it after the fact is
  // out of scope for v1), so this is read-only context, not a control.
  const decimals = decimalsFor(txn.currency);
  const currencyLabel = currencyPrefix(txn.currency);

  // The linked account's balance is native to ITS OWN currency (Task 9). No conversion (and
  // so no rate) is needed when the row's currency already matches the account's, or the
  // account is MYR; otherwise the account's own rate must be cached, or `deriveNative` would
  // throw on save.
  const linkAccount = linkId ? accounts.find((a) => a.id === linkId) ?? null : null;
  const linkConvertible =
    !linkAccount || linkAccount.currency === txn.currency || linkAccount.currency === BASE_CURRENCY || rateFor(rates, linkAccount.currency) != null;

  const switchType = (t: TxnType) => {
    if (t === type) return;
    setType(t);
    setCat((prev) => {
      const c = categories.find((x) => x.id === prev);
      return c && c.kind === t ? prev : t === 'income' ? DEFAULT_INCOME_ID : DEFAULT_EXPENSE_ID;
    });
    if (linkId) {
      const a = accounts.find((x) => x.id === linkId);
      if (a) setLinkEffect(defaultLinkEffect(a.kind, t));
    }
  };

  const save = async () => {
    const n = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    // `txn.amount` is the MYR column; the field (and everything below) works in the row's own
    // currency, which is `nativeAmount` for a foreign row.
    const nativeCurrent = txn.nativeAmount ?? txn.amount;
    // A split row's amount is derived from the split, so it is not the user's to retype here:
    // letting it drift would leave `gross` and the shares reconciling against nothing.
    const amount = split
      ? nativeCurrent
      : Number.isFinite(n) && n >= 0
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
    // Accounts are natively denominated (Task 9): when the row's own currency already matches
    // the linked account's, its native amount is used unconverted rather than round-tripped
    // through MYR (which could drift a cent from double rounding); otherwise the MYR-equivalent
    // is converted into the account's own currency at the account's own rate (the inverse of
    // `deriveMyr`), same principle as ManualEntryScreen's save.
    if (linkId && linkAccount) {
      const effect: LinkEffect = linkAccount.kind === 'liability' ? linkEffect : defaultLinkEffect(linkAccount.kind, type);
      const linkAmount =
        linkAccount.currency === txn.currency ? amount : deriveNative(myrAmount, linkAccount.currency, rateFor(rates, linkAccount.currency));
      await recordBalanceLink(linkId, linkAmount, effect, txn.date ?? todayISO());
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
        style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}
      >
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
            <TextInput
              value={amountText}
              onChangeText={(t) => setAmountText(decimals === 0 ? t.replace(/[^0-9]/g, '') : t)}
              keyboardType={decimals === 0 ? 'number-pad' : 'decimal-pad'}
              selectTextOnFocus
              editable={!split}
              style={[
                styles.amountInput,
                { color: colorTheme.ink, backgroundColor: colorTheme.surface, borderColor: colorTheme.line },
                !!split && styles.amountInputLocked,
                !!split && { backgroundColor: colorTheme.surface2, color: colorTheme.ink2 },
              ]}
            />
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
                {visible.map((c) => (
                  <View key={c.id} style={styles.gridCell}>
                    <CategoryChip category={c} selected={cat === c.id} suggested={false} onPress={() => setCat(c.id)} />
                  </View>
                ))}
                {expanded && (
                  <View style={styles.gridCell}>
                    <Pressable onPress={() => setAdding(true)} style={[styles.addChip, { borderColor: theme.accentSoft, backgroundColor: theme.accentTint }]}>
                      <Icon name="plus" size={16} color={theme.accent} stroke={2.2} />
                      <Text style={[styles.addChipText, { color: theme.accent }]}>{isZh ? '新建分类' : 'New category'}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              {grid.length > 4 && (
                <Pressable onPress={() => setExpanded((e) => !e)} style={styles.moreBtn} hitSlop={6}>
                  <Text style={[styles.moreText, { color: theme.accent }]}>{expanded ? (isZh ? '收起' : 'Show less') : (isZh ? `显示全部 ${grid.length} 个` : `Show all ${grid.length}`)}</Text>
                  <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                    <Icon name="chevronDown" size={16} color={theme.accent} />
                  </View>
                </Pressable>
              )}
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

          <View style={{ marginTop: 18 }}>
            <AccountLinkField accounts={accounts} selectedId={linkId} effect={linkEffect} onSelect={selectLink} onEffect={setLinkEffect} label={isZh ? '关联账户（选填）' : 'Link to account (optional)'} />
          </View>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton onPress={save} height={52} disabled={!linkConvertible}>
              <Icon name="check" size={18} color="#fff" stroke={2.4} />
              <BtnLabel>{isZh ? '保存修改' : 'Save changes'}</BtnLabel>
            </PrimaryButton>
          </View>

          <Pressable onPress={confirmDelete} style={styles.deleteBtn} hitSlop={6}>
            <Icon name="trash" size={17} color="#b3261e" />
            <Text style={styles.deleteText}>{isZh ? '删除账单' : 'Delete transaction'}</Text>
          </Pressable>
        </ScrollView>
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
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  moreText: { fontFamily: uiFont(600), fontSize: 13.5 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 16, marginTop: 4 },
  deleteText: { fontFamily: uiFont(700), fontSize: 14.5, color: '#b3261e' },
});
