import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountLinkField } from '../components/AccountLinkField';
import { AddCategoryModal } from '../components/AddCategoryModal';
import { CalcBadge } from '../components/CalcBadge';
import { CurrencyChip } from '../components/CurrencyChip';
import { Icon } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { TourAnchor } from '../components/TourAnchor';
import { BtnLabel, BubbleText, CategoryChip, Eyebrow, PipSays, PrimaryButton, TopBar } from '../components/ui';
import { getActiveCurrencies, getEntryCurrency, setEntryCurrency } from '../db/currencyRepo';
import { listFxRates } from '../db/fxRepo';
import { todayISO } from '../lib/duplicates';
import { fullDate, isValidIsoDate } from '../lib/dates';
import { defaultLinkEffect, type LinkEffect } from '../lib/networth';
import { BASE_CURRENCY, deriveNative, isMultiCurrency, round2 } from '../lib/currency';
import { cleanCalcInput, evaluateExpression } from '../lib/calc';
import { decimalsFor } from '../lib/currencies';
import { currencyPrefix, fmtMoney } from '../lib/format';
import { rateFor, ratesFromCache } from '../lib/fx';
import { tap } from '../lib/haptics';
import { SplitSheet } from '../components/SplitSheet';
import type { Category, ExtractedTxn, SplitDraft, TxnType } from '../lib/types';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { numFont, radius, shadowToggle, spacing, uiFont } from '../theme';

export function ManualEntryScreen({
  categories,
  onBack,
  onComplete,
  title,
  startSplitting = false,
  initialMerchant = null,
  initialAmount = null,
  initialCurrency = null,
  initialType = null,
  initialDate = null,
  initialCategoryId = null,
  initialSplit = null,
  isTutorial = false,
  activeTourAnchor = null,
  onAmountValidChange,
  onCategoryChosen,
}: {
  categories: Category[];
  onBack: () => void;
  onComplete: (item: ExtractedTxn, categoryId: string, split: SplitDraft | null) => void;
  /** Overrides the top-bar title when the caller knows how the user got here. */
  title?: string;
  /** Framed as the standalone Split action rather than a plain manual entry. */
  startSplitting?: boolean;
  /** Prefill from a scanned receipt: the merchant, what the card was charged, and the
   *  per-person split the itemiser produced. */
  initialMerchant?: string | null;
  initialAmount?: number | null;
  initialCurrency?: string | null;
  /** Prefill from a quick-add parse: the expense/income toggle, the date, and the category.
   *  All null for every other caller, which keeps today's defaults. */
  initialType?: TxnType | null;
  initialDate?: string | null;
  initialCategoryId?: string | null;
  initialSplit?: SplitDraft | null;
  /** When true, formats Pip's speech bubble to guide the new user through manual entry. */
  isTutorial?: boolean;
  activeTourAnchor?: string | null;
  /** Reports whether the typed amount is currently valid (> 0), so the guided tour's amount
   *  step can gate its Next button on the user having actually entered something. */
  onAmountValidChange?: (valid: boolean) => void;
  /** Fires once a category is picked, so the guided tour's category step can auto-advance to
   *  the actual "Add expense" button rather than exposing its own separate Next. */
  onCategoryChosen?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t, formatFullDate, isZh } = useLanguage();
  const { accounts, recordBalanceLink, ensureDefaultAccount } = useAppData();
  const [merchant, setMerchant] = useState(initialMerchant ?? '');
  const [amountText, setAmountText] = useState(
    initialAmount ? initialAmount.toFixed(decimalsFor(initialCurrency ?? BASE_CURRENCY)) : ''
  );
  const [dateText, setDateText] = useState(initialDate ?? todayISO());
  const [dateFocused, setDateFocused] = useState(false);
  const [type, setType] = useState<TxnType>(initialType ?? 'expense');
  const [cat, setCat] = useState<string | null>(initialCategoryId);
  const [remark, setRemark] = useState('');
  const [adding, setAdding] = useState(false);
  const [split, setSplit] = useState<SplitDraft | null>(initialSplit);
  const [splitting, setSplitting] = useState(false);

  // Currencies active for this user, the sticky entry-currency default, and cached rates to
  // convert against. Loaded once on mount; MYR-only until then, so nothing here changes the
  // single-currency screen while the load is in flight.
  const [activeCurrencies, setActiveCurrencies] = useState<string[]>([BASE_CURRENCY]);
  const [currency, setCurrency] = useState<string>(initialCurrency ?? BASE_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [active, entry, fx] = await Promise.all([getActiveCurrencies(), getEntryCurrency(), listFxRates()]);
      setActiveCurrencies(active);
      if (initialCurrency) {
        setCurrency(initialCurrency);
      } else {
        setCurrency(entry);
      }
      setRates(ratesFromCache(fx));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sticks for next time, per the brief: picking a currency here is remembered as the new
  // entry default, mirroring CurrencySettingsScreen's own entry-currency picker.
  const changeCurrency = async (code: string) => {
    setCurrency(code);
    await setEntryCurrency(code);
  };

  const decimals = decimalsFor(currency);
  // Null only means "no cached rate for an active currency", a case activation is supposed to
  // prevent. Gates save rather than ever letting a foreign row through at parity.
  const rate = currency === BASE_CURRENCY ? 1 : rateFor(rates, currency);

  // Accounts grouped by kind
  const assetAccounts = useMemo(() => accounts.filter((a) => !a.archived && a.kind === 'asset'), [accounts]);
  const liabilityAccounts = useMemo(() => accounts.filter((a) => !a.archived && a.kind === 'liability'), [accounts]);

  // Default to a cash account (prefer an existing one); seeds and creates a "Cash" account if none exist.
  const defaultAcctId = useMemo(() => {
    const act = assetAccounts.length > 0 ? assetAccounts : accounts.filter((a) => !a.archived);
    return (act.find((a) => a.cls === 'cash') ?? act[0])?.id ?? null;
  }, [assetAccounts, accounts]);

  const [fromAccountId, setFromAccountId] = useState<string | null>(defaultAcctId);
  const [toAccountId, setToAccountId] = useState<string | null>(null);

  const grid = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);
  const calc = useMemo(() => evaluateExpression(amountText, decimals), [amountText, decimals]);
  const amount = Math.max(0, calc.result ?? 0);

  const mergeScaleX = useRef(new Animated.Value(1)).current;
  const mergeScaleY = useRef(new Animated.Value(1)).current;
  const mergeOpacity = useRef(new Animated.Value(1)).current;
  const [isMerging, setIsMerging] = useState(false);

  const handleMerge = () => {
    if (!calc.isExpression || calc.result == null || calc.result <= 0) return;
    const finalValue = decimals === 0 ? String(Math.round(calc.result)) : calc.result.toFixed(decimals);
    const useNative = Platform.OS !== 'web';

    setIsMerging(true);
    tap();

    // Phase 1: Numbers converge/squeeze inward
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

      // Phase 2: Pop & Bloom outward with spring bounce into final number
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

  const dateTrimmed = dateText.trim();
  const validDate = isValidIsoDate(dateTrimmed) ? dateTrimmed : null;

  const fromAccount = fromAccountId ? accounts.find((a) => a.id === fromAccountId) ?? null : null;
  const fromConvertible =
    !fromAccount || fromAccount.currency === currency || fromAccount.currency === BASE_CURRENCY || rateFor(rates, fromAccount.currency) != null;
  const toAccount = toAccountId ? accounts.find((a) => a.id === toAccountId) ?? null : null;
  const toConvertible =
    !toAccount || toAccount.currency === currency || toAccount.currency === BASE_CURRENCY || rateFor(rates, toAccount.currency) != null;
  const canSave = amount > 0 && !!cat && !!validDate && !!fromAccountId && rate != null && fromConvertible && toConvertible;

  useEffect(() => {
    onAmountValidChange?.(amount > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  useEffect(() => {
    if (cat) onCategoryChosen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const switchType = (t: TxnType) => {
    if (t === type) return;
    setType(t);
    setCat(null);
  };

  // Seed the required account selection once accounts are known, creating a
  // default "Cash" account if the user has none yet.
  useEffect(() => {
    if (!fromAccountId) {
      if (defaultAcctId) setFromAccountId(defaultAcctId);
      else ensureDefaultAccount().then((id) => setFromAccountId(id));
    }
  }, [defaultAcctId, fromAccountId, ensureDefaultAccount]);

  // A split whose gross no longer matches the amount field is stale (the user changed the bill
  // after splitting it), so it is dropped rather than silently applied to a different number.
  const activeSplit =
    split && Math.abs(split.gross - round2(amount)) < 0.005 ? split : null;

  const save = async () => {
    if (!canSave || !cat || !validDate || rate == null) return;
    // The figure the user typed, in `currency`: native for a foreign row, MYR for a plain one.
    const amt = round2(amount);
    // The row's own MYR-equivalent (used both for the saved row's bookkeeping and, below, as
    // the starting point for converting into the linked account's currency).
    const myrAmt = currency === BASE_CURRENCY ? amt : round2(amt * rate);
    const item: ExtractedTxn = {
      merchant: merchant.trim(),
      // Only the payer's own share is the expense; the rest becomes a receivable.
      amount: activeSplit ? activeSplit.ownShare : amt,
      type,
      date: validDate,
      method: null,
      remark: remark.trim() || null,
      currency,
      fxRate: currency === BASE_CURRENCY ? null : rate,
    };

    // 1. Deduct from / Add to "Pay from" / "Deposit into" account
    if (fromAccountId && fromAccount) {
      const effect: LinkEffect = type === 'income' ? 'add' : 'subtract';
      const fromAmt =
        fromAccount.currency === currency ? amt : deriveNative(myrAmt, fromAccount.currency, rateFor(rates, fromAccount.currency));
      await recordBalanceLink(fromAccountId, fromAmt, effect, validDate);
    }

    // 2. Reduce liability account (e.g. car/mortgage loan) for expenses
    if (type === 'expense' && toAccountId && toAccount) {
      const toAmt =
        toAccount.currency === currency ? amt : deriveNative(myrAmt, toAccount.currency, rateFor(rates, toAccount.currency));
      await recordBalanceLink(toAccountId, toAmt, 'subtract', validDate);
    }

    onComplete(item, cat, activeSplit);
  };

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title={title ?? (startSplitting ? (isZh ? '分摊账单' : 'Split a bill') : (isZh ? '手动记账' : 'Add manually'))} onBack={onBack} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        {isTutorial && (
          <View style={{ marginBottom: spacing.md }}>
            <PipSays expr="curious" size={48}>
              <BubbleText>{t('tutorialManualCoaching')}</BubbleText>
            </PipSays>
          </View>
        )}

        {/* type toggle */}
        <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
          {(['expense', 'income'] as TxnType[]).map((k) => {
            const on = type === k;
            const activeColor = k === 'expense' ? colorTheme.red : theme.accent;
            const activeBg = k === 'expense' ? colorTheme.redTint : theme.accentTint;
            const activeBorder = k === 'expense' ? colorTheme.redSoft : theme.accentSoft;
            return (
              <Pressable
                key={k}
                onPress={() => switchType(k)}
                style={[styles.toggleBtn, on && styles.toggleBtnOn, on && { backgroundColor: activeBg, borderColor: activeBorder }]}
              >
                <Text style={[styles.toggleText, { color: colorTheme.ink2 }, on && styles.toggleTextOn, on && { color: activeColor }]}>
                  {k === 'expense' ? t('expense') : t('income')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Eyebrow style={{ marginBottom: 8 }}>{t('amount')}</Eyebrow>
        <TourAnchor id="tour_amount_field" activeId={activeTourAnchor}>
          <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            {isMultiCurrency(activeCurrencies) ? (
              <CurrencyChip value={currency} active={activeCurrencies} onChange={changeCurrency} />
            ) : (
              <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(currency)}</Text>
            )}
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
                placeholder={decimals === 0 ? '0' : '0.00'}
                placeholderTextColor={colorTheme.ink3}
                style={[
                  styles.amountInput,
                  { color: isMerging ? theme.accent : colorTheme.ink },
                ]}
              />
            </Animated.View>
            {calc.isExpression && calc.result != null && calc.result > 0 && (
              <CalcBadge
                result={calc.result}
                decimals={decimals}
                onApply={handleMerge}
              />
            )}
          </View>
        </TourAnchor>
        {calc.isExpression && calc.result != null && calc.result > 0 && (
          <Text style={[styles.calcHint, { color: theme.accent }]}>
            = {currency} {decimals === 0 ? String(Math.round(calc.result)) : calc.result.toFixed(decimals)}
          </Text>
        )}
        {currency !== BASE_CURRENCY && rate != null && (
          <Text style={[styles.fxHint, { color: colorTheme.ink3 }]}>≈ {fmtMoney(amount * rate, BASE_CURRENCY)}</Text>
        )}

        {type === 'expense' && (
          <Pressable
            onPress={() => setSplitting(true)}
            style={[styles.splitRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, amount <= 0 && styles.splitRowOff]}
            disabled={amount <= 0}
            hitSlop={4}
          >
            <Icon name="gift" size={17} color={amount > 0 ? theme.accent : colorTheme.ink3} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.splitTitle, { color: colorTheme.ink }]}>
                  {activeSplit ? (isZh ? `自付部分：${fmtMoney(activeSplit.ownShare, currency)}` : `Your share: ${fmtMoney(activeSplit.ownShare, currency)}`) : (isZh ? '分摊账单' : 'Split with friends')}
                </Text>
                <TourAnchor id="tour_split_info" activeId={activeTourAnchor}>
                  <InfoButton entry="split_bill" />
                </TourAnchor>
              </View>
              <Text style={[styles.splitSub, { color: colorTheme.ink2 }]} numberOfLines={1}>
                {activeSplit
                  ? (isZh ? `待收回 ${fmtMoney(activeSplit.gross - activeSplit.ownShare, currency)}` : `${fmtMoney(activeSplit.gross - activeSplit.ownShare, currency)} owed back to you`)
                  : amount > 0
                    ? (isZh ? '全桌买单？只记录您的自付部分' : 'Paid for the table? Record only your share')
                    : (isZh ? '请先输入账单总额' : 'Enter the bill amount first')}
              </Text>
            </View>
            <Icon name="chevronRight" size={17} color={colorTheme.ink3} />
          </Pressable>
        )}

        <TourAnchor id="tour_account_field" activeId={activeTourAnchor}>
          <View style={{ marginTop: 18 }}>
            <AccountLinkField
              accounts={assetAccounts.length > 0 ? assetAccounts : accounts}
              selectedId={fromAccountId}
              onSelect={setFromAccountId}
              label={type === 'expense' ? (isZh ? '扣款账户' : 'Pay from') : (isZh ? '存入账户' : 'Deposit into')}
              required
            />
          </View>
        </TourAnchor>

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

        <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>{t('date')}</Eyebrow>
        <TextInput
          value={dateFocused ? dateText : validDate ? formatFullDate(validDate) : dateText}
          onChangeText={setDateText}
          onFocus={() => setDateFocused(true)}
          onBlur={() => setDateFocused(false)}
          onSubmitEditing={() => setDateFocused(false)}
          selectTextOnFocus
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colorTheme.ink3}
          keyboardType="numbers-and-punctuation"
          style={[styles.textInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
        />
        {!validDate && (
          <Text style={[styles.dateHint, styles.dateHintBad, { color: colorTheme.ink2 }]}>
            {isZh ? '请输入有效日期 (YYYY-MM-DD)' : 'Enter a valid date (YYYY-MM-DD)'}
          </Text>
        )}

        <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>
          {type === 'income' ? (isZh ? '收入来源（选填）' : 'Source (optional)') : (isZh ? '商家名称（选填）' : 'Merchant (optional)')}
        </Eyebrow>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder={type === 'income' ? (isZh ? '例如：工资' : 'e.g. Salary') : (isZh ? '例如：Jaya Grocer' : 'e.g. Jaya Grocer')}
          placeholderTextColor={colorTheme.ink3}
          style={[styles.textInputSm, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
        />

        <Eyebrow style={{ marginTop: 18, marginBottom: 10 }}>{t('category')}</Eyebrow>
        <TourAnchor id="tour_category_grid" activeId={activeTourAnchor}>
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
        </TourAnchor>

        <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>{isZh ? '备注（选填）' : 'Remark (optional)'}</Eyebrow>
        <TextInput
          value={remark}
          onChangeText={setRemark}
          placeholder={isZh ? '例如：和同事吃午餐' : 'e.g. Lunch with a supplier'}
          placeholderTextColor={colorTheme.ink3}
          style={[styles.textInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
          multiline
        />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colorTheme.bg, borderTopColor: colorTheme.line2, paddingBottom: insets.bottom + 16 }]}>
        <TourAnchor id="tour_add_expense_btn" activeId={activeTourAnchor}>
          <PrimaryButton onPress={save} disabled={!canSave}>
            <Icon name="check" size={19} color="#fff" stroke={2.4} />
            <BtnLabel>
              {type === 'income' ? (isZh ? '添加收入' : 'Add income') : (isZh ? '添加支出' : 'Add expense')}
            </BtnLabel>
          </PrimaryButton>
        </TourAnchor>
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

      <SplitSheet
        visible={splitting}
        gross={round2(amount)}
        currency={currency}
        merchant={merchant.trim() || undefined}
        initial={activeSplit}
        onClose={() => setSplitting(false)}
        onApply={(draft) => {
          setAmountText(draft.gross.toFixed(decimals));
          setSplit(draft);
          setSplitting(false);
        }}
        onRemove={activeSplit ? () => { setSplit(null); setSplitting(false); } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggle: { flexDirection: 'row', borderRadius: 999, padding: 4, marginBottom: 18, borderWidth: 1 },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
  toggleBtnOn: { ...shadowToggle },
  toggleText: { fontFamily: uiFont(600), fontSize: 14 },
  toggleTextOn: {},
  textInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: uiFont(600),
    fontSize: 16,
  },
  dateHint: { fontFamily: uiFont(500), fontSize: 12.5, marginTop: 6, marginLeft: 2 },
  textInputSm: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: uiFont(600),
    fontSize: 14,
  },
  dateHintBad: { color: '#c5402f' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14 },
  fxHint: { fontFamily: uiFont(500), fontSize: 12.5, marginTop: 6, marginLeft: 2 },
  calcHint: { fontFamily: numFont(600), fontSize: 13, marginTop: 6, marginLeft: 2 },
  rm: { fontFamily: numFont(600), fontSize: 18 },
  amountInput: { flex: 1, minWidth: 0, fontFamily: numFont(700), fontSize: 24, paddingVertical: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  addChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14, borderRadius: radius.sm, borderWidth: 1.5, borderStyle: 'dashed' },
  addChipText: { fontFamily: uiFont(700), fontSize: 13.5 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  splitRowOff: { opacity: 0.6 },
  splitTitle: { fontFamily: uiFont(700), fontSize: 13.5 },
  splitSub: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1 },
});
