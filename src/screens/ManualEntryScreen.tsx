import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountLinkField } from '../components/AccountLinkField';
import { AddAccountModal } from '../components/AddAccountModal';
import { AddCategoryModal } from '../components/AddCategoryModal';
import { AmountSheet } from '../components/AmountSheet';
import { BrandLogo, matchBrand } from '../components/BrandLogo';
import { MoreDetails } from '../components/MoreDetails';
import { Icon, type IconName } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { TourAnchor } from '../components/TourAnchor';
import { BtnLabel, BubbleText, CategoryChip, Eyebrow, PipSays, PrimaryButton, TopBar } from '../components/ui';
import { getActiveCurrencies, getEntryCurrency, setEntryCurrency } from '../db/currencyRepo';
import { listFxRates } from '../db/fxRepo';
import { todayISO } from '../lib/duplicates';
import { fullDate, isValidIsoDate } from '../lib/dates';
import { CLASS_BY_ID, defaultLinkEffect, type LinkEffect } from '../lib/networth';
import { BASE_CURRENCY, deriveNative, round2 } from '../lib/currency';
import { evaluateExpression } from '../lib/calc';
import { decimalsFor } from '../lib/currencies';
import { currencyPrefix, fmtMoney } from '../lib/format';
import { rateFor, ratesFromCache } from '../lib/fx';
import { tap } from '../lib/haptics';
import { SplitSheet } from '../components/SplitSheet';
import { matchInstitution } from '../lib/institutions';
import type { Account, Category, ExtractedTxn, SplitDraft, TxnType } from '../lib/types';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { numFont, radius, shadowToggle, spacing, uiFont } from '../theme';

/**
 * Score accounts to prioritize payment methods in order:
 * 1. Cash accounts
 * 2. Bank accounts
 * 3. E-wallet accounts
 * 4. Other Cash & Bank class accounts
 * 5. Other asset accounts
 */
function getAccountPriority(a: Account): number {
  const nameLower = a.name.toLowerCase().trim();
  const inst = matchInstitution(a.name);

  // 1. Cash accounts
  if (nameLower === 'cash' || a.name === '现金' || nameLower.includes('cash') || nameLower.includes('现金')) {
    return 1;
  }
  // 2. Bank accounts
  if (inst?.kind === 'bank' || nameLower.includes('bank') || nameLower.includes('银行')) {
    return 2;
  }
  // 3. E-wallet accounts
  if (
    inst?.kind === 'ewallet' ||
    nameLower.includes('wallet') ||
    nameLower.includes('tng') ||
    nameLower.includes('touch') ||
    nameLower.includes('grab') ||
    nameLower.includes('boost') ||
    nameLower.includes('pay')
  ) {
    return 3;
  }
  // 4. Other Cash & Bank class accounts
  if (a.cls === 'cash') {
    return 4;
  }
  return 5;
}

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
  const [addingAccount, setAddingAccount] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [split, setSplit] = useState<SplitDraft | null>(initialSplit);
  const [splitting, setSplitting] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  // The date is a chip row by default; the raw ISO field is revealed only when the user picks
  // a day that isn't today or yesterday, which is where the typing cost was actually going.
  const [dateEditing, setDateEditing] = useState(false);

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

  // Liquid asset accounts (cash, bank accounts, e-wallets), prioritizing cash, bank, or ewallet accounts
  const paymentAccounts = useMemo(() => {
    const active = accounts.filter((a) => !a.archived);
    const assets = active.filter((a) => a.kind === 'asset' && a.cls !== 'receivable' && a.cls !== 'illiquid');
    const list = assets.length > 0 ? assets : active.filter((a) => a.cls !== 'receivable');
    return [...list].sort((a, b) => {
      const pA = getAccountPriority(a);
      const pB = getAccountPriority(b);
      if (pA !== pB) return pA - pB;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [accounts]);

  // Default to a cash account (prefer an existing one); seeds and creates a "Cash" account if none exist.
  const defaultAcctId = useMemo(() => {
    const act = assetAccounts.length > 0 ? assetAccounts : accounts.filter((a) => !a.archived);
    return (act.find((a) => a.cls === 'cash') ?? act[0])?.id ?? null;
  }, [assetAccounts, accounts]);

  const [fromAccountId, setFromAccountId] = useState<string | null>(defaultAcctId);
  const [toAccountId, setToAccountId] = useState<string | null>(null);

  // Display maximum 5 accounts. If the currently selected account is not among the top 5,
  // swap it into the 5th slot so the user always sees their active selection.
  const visibleAccounts = useMemo(() => {
    if (paymentAccounts.length <= 5) return paymentAccounts;
    const top = paymentAccounts.slice(0, 5);
    if (fromAccountId && !top.some((a) => a.id === fromAccountId)) {
      const selected = paymentAccounts.find((a) => a.id === fromAccountId);
      if (selected) {
        return [...paymentAccounts.slice(0, 4), selected];
      }
    }
    return top;
  }, [paymentAccounts, fromAccountId]);

  const grid = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);
  const calc = useMemo(() => evaluateExpression(amountText, decimals), [amountText, decimals]);
  const amount = Math.max(0, calc.result ?? 0);

  const mergeScaleX = useRef(new Animated.Value(1)).current;
  const mergeScaleY = useRef(new Animated.Value(1)).current;
  const mergeOpacity = useRef(new Animated.Value(1)).current;
  const [isMerging, setIsMerging] = useState(false);

  /**
   * Commit an amount chosen in the keypad sheet, with the old merge animation retargeted: the
   * squeeze-then-bloom used to celebrate collapsing "12+8" into 20 inline. The sheet does that
   * collapse now, so the pop plays here as the new figure lands on the row — the payoff moment
   * survives the move, it just fires on a different event.
   */
  const applyAmount = (text: string) => {
    const useNative = Platform.OS !== 'web';

    setIsMerging(true);
    tap();

    Animated.parallel([
      Animated.timing(mergeScaleX, { toValue: 0.82, duration: 80, easing: Easing.in(Easing.ease), useNativeDriver: useNative }),
      Animated.timing(mergeScaleY, { toValue: 0.88, duration: 80, easing: Easing.in(Easing.ease), useNativeDriver: useNative }),
      Animated.timing(mergeOpacity, { toValue: 0.35, duration: 80, useNativeDriver: useNative }),
    ]).start(() => {
      setAmountText(text);

      Animated.parallel([
        Animated.spring(mergeScaleX, { toValue: 1, tension: 180, friction: 6, useNativeDriver: useNative }),
        Animated.spring(mergeScaleY, { toValue: 1, tension: 180, friction: 6, useNativeDriver: useNative }),
        Animated.timing(mergeOpacity, { toValue: 1, duration: 140, useNativeDriver: useNative }),
      ]).start(() => {
        setIsMerging(false);
      });
    });
  };

  const dateTrimmed = dateText.trim();
  const validDate = isValidIsoDate(dateTrimmed) ? dateTrimmed : null;

  const today = todayISO();
  // Built from local date parts (todayISO reads getFullYear/getMonth/getDate), not toISOString,
  // so a user in UTC+8 doesn't get "yesterday" landing two days back late in the evening.
  const yesterday = todayISO(new Date(Date.now() - 86_400_000));
  /** True when the date is neither chip, so the third chip shows the date instead of "Other". */
  const otherDate = dateEditing || (dateTrimmed !== today && dateTrimmed !== yesterday);

  const pickDate = (iso: string) => {
    setDateText(iso);
    setDateEditing(false);
    setDateFocused(false);
  };

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

  /** What the collapsed More details row reports. */
  const detailsSummary = useMemo(() => {
    const parts: string[] = [];
    if (merchant.trim()) parts.push(merchant.trim());
    if (toAccount) parts.push(toAccount.name);
    if (remark.trim()) parts.push(isZh ? '有备注' : 'remark added');
    return parts.length > 0 ? parts.join(' · ') : (isZh ? '更多选填项' : 'More options');
  }, [merchant, toAccount, remark, isZh]);

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
          <Pressable
            onPress={() => setAmountOpen(true)}
            style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}
            accessibilityRole="button"
            accessibilityLabel={isZh ? '输入金额' : 'Enter amount'}
          >
            <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(currency)}</Text>
            <Animated.View
              style={{
                flex: 1,
                minWidth: 0,
                opacity: mergeOpacity,
                transform: [{ scaleX: mergeScaleX }, { scaleY: mergeScaleY }],
              }}
            >
              <Text
                style={[
                  styles.amountInput,
                  { color: isMerging ? theme.accent : amount > 0 ? colorTheme.ink : colorTheme.ink3 },
                ]}
                numberOfLines={1}
              >
                {amount > 0 ? amountText : decimals === 0 ? '0' : '0.00'}
              </Text>
            </Animated.View>
            <Icon name="pencil" size={17} color={colorTheme.ink3} />
          </Pressable>
        </TourAnchor>
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
          <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>
            {type === 'expense' ? (isZh ? '扣款账户' : 'Pay from') : (isZh ? '存入账户' : 'Deposit into')}
          </Eyebrow>
          <View style={styles.accountChips}>
            {visibleAccounts.map((a) => {
              const on = fromAccountId === a.id;
              const brand = matchBrand(a.name);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    tap();
                    setFromAccountId(a.id);
                  }}
                  style={[
                    styles.accountChip,
                    {
                      backgroundColor: on ? theme.accentTint : colorTheme.surface,
                      borderColor: on ? theme.accentSoft : colorTheme.line,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={a.name}
                >
                  {brand ? (
                    <BrandLogo brand={brand} size={16} />
                  ) : a.icon ? (
                    <Image source={{ uri: a.icon }} style={{ width: 16, height: 16, borderRadius: 4 }} />
                  ) : (
                    <Icon
                      name={(CLASS_BY_ID[a.cls]?.icon ?? 'wallet') as IconName}
                      size={15}
                      color={on ? theme.accent : colorTheme.ink2}
                    />
                  )}
                  <Text
                    style={[
                      styles.accountChipText,
                      { color: on ? theme.accent : colorTheme.ink2 },
                      on && { fontFamily: uiFont(700) },
                    ]}
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                  {on && <Icon name="check" size={13} color={theme.accent} stroke={2.4} />}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setAccountPickerOpen(true)}
              style={[
                styles.accountChip,
                {
                  borderColor: colorTheme.line,
                  backgroundColor: colorTheme.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isZh ? '选择其他账户' : 'More accounts'}
            >
              <Text style={[styles.accountChipText, { color: colorTheme.ink2 }]}>
                {isZh ? '更多' : 'More'}
              </Text>
              <Icon name="chevronDown" size={13} color={colorTheme.ink3} />
            </Pressable>
          </View>
        </TourAnchor>

        {/* Category sits directly under the amount because those are the only two fields the
            user must actually supply — canSave's other two (date, account) are pre-filled. It
            used to be below merchant and both account pickers, which put the second required
            field under the fold and left the save button looking broken until you scrolled. */}
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

        <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>{t('date')}</Eyebrow>
        <View style={styles.dateChips}>
          {[
            { iso: today, label: isZh ? '今天' : 'Today' },
            { iso: yesterday, label: isZh ? '昨天' : 'Yesterday' },
          ].map((d) => {
            const on = !dateEditing && dateTrimmed === d.iso;
            return (
              <Pressable
                key={d.iso}
                onPress={() => pickDate(d.iso)}
                style={[
                  styles.dateChip,
                  { backgroundColor: on ? theme.accentTint : colorTheme.surface, borderColor: on ? theme.accentSoft : colorTheme.line },
                ]}
              >
                <Text style={[styles.dateChipText, { color: on ? theme.accent : colorTheme.ink2 }]}>{d.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setDateEditing(true)}
            style={[
              styles.dateChip,
              styles.dateChipWide,
              { backgroundColor: otherDate ? theme.accentTint : colorTheme.surface, borderColor: otherDate ? theme.accentSoft : colorTheme.line },
            ]}
          >
            <Text style={[styles.dateChipText, { color: otherDate ? theme.accent : colorTheme.ink2 }]} numberOfLines={1}>
              {validDate && otherDate ? formatFullDate(validDate) : isZh ? '其他日期' : 'Other'}
            </Text>
            <Icon name="pencil" size={13} color={otherDate ? theme.accent : colorTheme.ink3} />
          </Pressable>
        </View>
        {/* The raw ISO field is still the editor — keeping it preserves isValidIsoDate and its
            error state — but it now only appears for a date the two chips can't express. */}
        {dateEditing && (
          <>
            <TextInput
              value={dateFocused ? dateText : validDate ? formatFullDate(validDate) : dateText}
              onChangeText={setDateText}
              onFocus={() => setDateFocused(true)}
              onBlur={() => setDateFocused(false)}
              onSubmitEditing={() => setDateFocused(false)}
              selectTextOnFocus
              autoFocus
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colorTheme.ink3}
              keyboardType="numbers-and-punctuation"
              style={[styles.textInput, { marginTop: 10, backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
            />
            {!validDate && (
              <Text style={[styles.dateHint, styles.dateHintBad, { color: colorTheme.ink2 }]}>
                {isZh ? '请输入有效日期 (YYYY-MM-DD)' : 'Enter a valid date (YYYY-MM-DD)'}
              </Text>
            )}
          </>
        )}

        <MoreDetails summary={detailsSummary} defaultOpen={!!initialMerchant}>
          {/* Only offered to users who actually have a loan to pay down. */}
          {type === 'expense' && liabilityAccounts.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <AccountLinkField
                accounts={liabilityAccounts}
                selectedId={toAccountId}
                onSelect={setToAccountId}
                label={isZh ? '抵扣负债账户（分期还款可选，如车贷/房贷）' : 'Reduce liability account (optional, e.g. car/mortgage loan)'}
                infoEntry="reduce_liability"
              />
            </View>
          )}

          <Eyebrow style={{ marginTop: type === 'expense' && liabilityAccounts.length > 0 ? 6 : 0, marginBottom: 8 }}>
            {type === 'income' ? (isZh ? '收入来源（选填）' : 'Source (optional)') : (isZh ? '商家名称（选填）' : 'Merchant (optional)')}
          </Eyebrow>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder={type === 'income' ? (isZh ? '例如：工资' : 'e.g. Salary') : (isZh ? '例如：Jaya Grocer' : 'e.g. Jaya Grocer')}
            placeholderTextColor={colorTheme.ink3}
            style={[styles.textInputSm, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
          />

          <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>{isZh ? '备注（选填）' : 'Remark (optional)'}</Eyebrow>
          <TextInput
            value={remark}
            onChangeText={setRemark}
            placeholder={isZh ? '例如：和同事吃午餐' : 'e.g. Lunch with a supplier'}
            placeholderTextColor={colorTheme.ink3}
            style={[styles.textInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
            multiline
          />
        </MoreDetails>
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

      <AmountSheet
        visible={amountOpen}
        value={amountText}
        currency={currency}
        activeCurrencies={activeCurrencies}
        decimals={decimals}
        onChangeCurrency={changeCurrency}
        onApply={applyAmount}
        onClose={() => setAmountOpen(false)}
      />

      <AddCategoryModal
        visible={adding}
        kind={type}
        onClose={() => setAdding(false)}
        onCreated={(id) => {
          setCat(id);
          setAdding(false);
        }}
      />

      <AddAccountModal
        visible={addingAccount}
        onClose={() => setAddingAccount(false)}
        onCreated={(id) => {
          setFromAccountId(id);
          setAddingAccount(false);
        }}
      />

      {/* Full account picker modal when user taps "More" */}
      <Modal visible={accountPickerOpen} transparent animationType="fade" onRequestClose={() => setAccountPickerOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setAccountPickerOpen(false)} />
        <View style={styles.menuWrap} pointerEvents="box-none">
          <View style={[styles.menu, { backgroundColor: colorTheme.bg, borderColor: colorTheme.line2 }]}>
            <Text style={[styles.menuTitle, { color: colorTheme.ink2 }]}>
              {type === 'expense' ? (isZh ? '选择扣款账户' : 'Select payment account') : (isZh ? '选择存入账户' : 'Select deposit account')}
            </Text>
            <ScrollView style={styles.menuScroll} keyboardShouldPersistTaps="handled">
              {paymentAccounts.map((a) => {
                const on = fromAccountId === a.id;
                const brand = matchBrand(a.name);
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      tap();
                      setFromAccountId(a.id);
                      setAccountPickerOpen(false);
                    }}
                    style={[styles.accountMenuItem, on && { backgroundColor: theme.accentTint }]}
                  >
                    {brand ? (
                      <BrandLogo brand={brand} size={18} />
                    ) : a.icon ? (
                      <Image source={{ uri: a.icon }} style={{ width: 18, height: 18, borderRadius: 4 }} />
                    ) : (
                      <Icon
                        name={(CLASS_BY_ID[a.cls]?.icon ?? 'wallet') as IconName}
                        size={16}
                        color={on ? theme.accent : colorTheme.ink2}
                      />
                    )}
                    <Text
                      style={[
                        styles.accountMenuText,
                        { color: colorTheme.ink },
                        on && { color: theme.onTint, fontFamily: uiFont(700) },
                      ]}
                      numberOfLines={1}
                    >
                      {a.name}
                    </Text>
                    {on && <Icon name="check" size={16} color={theme.accent} stroke={2.4} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.menuDivider, { backgroundColor: colorTheme.line2 }]} />
            <Pressable
              onPress={() => {
                setAccountPickerOpen(false);
                setAddingAccount(true);
              }}
              style={styles.accountMenuItem}
            >
              <Icon name="plus" size={16} color={theme.accent} stroke={2.2} />
              <Text style={[styles.accountMenuText, { color: theme.accent, fontFamily: uiFont(600) }]}>
                {isZh ? '创建新账户' : 'Create new account'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  dateChips: { flexDirection: 'row', gap: 8 },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  // The third chip carries a full date ("3 Sep 2026"), so it takes the slack rather than
  // letting a long formatted date squeeze the two fixed chips.
  dateChipWide: { flex: 1 },
  dateChipText: { fontFamily: uiFont(600), fontSize: 13 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14 },
  fxHint: { fontFamily: uiFont(500), fontSize: 12.5, marginTop: 6, marginLeft: 2 },
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
  accountChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  accountChipText: { fontFamily: uiFont(600), fontSize: 13, maxWidth: 180 },
  accountAddChip: { borderStyle: 'dashed' },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  menuWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 8,
    maxHeight: '70%',
  },
  menuTitle: { fontFamily: uiFont(700), fontSize: 13, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  menuScroll: { flexGrow: 0 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  accountMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  accountMenuText: { flex: 1, fontFamily: uiFont(600), fontSize: 15 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1 },
});
