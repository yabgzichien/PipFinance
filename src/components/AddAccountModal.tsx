import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEntryCurrency } from '../db/currencyRepo';
import { todayISO } from '../lib/duplicates';
import { classesFor } from '../lib/networth';
import { subFromType, type TickerResult } from '../lib/prices';
import type { AccountKind } from '../lib/types';
import { searchInvestments } from '../prices';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { numFont, radius, uiFont } from '../theme';
import { Icon, type IconName } from './Icon';
import { TickerSearchModal } from './TickerSearchModal';
import { BtnLabel, PrimaryButton } from './ui';

/** Modal to create a new account or live holding inline (e.g. from the add-transaction or commitments flow), then select it. */
export function AddAccountModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (accountId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const { addAccount, addHolding } = useAppData();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('asset');
  const [cls, setCls] = useState('cash');
  const [holdingMode, setHoldingMode] = useState(false);
  const [coin, setCoin] = useState<TickerResult | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [costText, setCostText] = useState('');
  const [rateText, setRateText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const clsChoices = classesFor(kind);

  useEffect(() => {
    if (visible) {
      setName('');
      setKind('asset');
      setCls('cash');
      setHoldingMode(false);
      setCoin(null);
      setQtyText('');
      setCostText('');
      setRateText('');
      setSearchOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!clsChoices.find((c) => c.id === cls)) setCls(clsChoices[0]?.id ?? 'cash');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (!visible) return <Modal visible={false} transparent />;

  const isInvest = kind === 'asset' && cls === 'investments';
  const isHoldingType = isInvest && holdingMode;
  const pickedSub = coin ? subFromType(coin.type) : null;
  const qtyUnit = pickedSub === 'commodity' ? 'g' : coin?.ticker ?? '';
  const qtyLabel = pickedSub === 'commodity' ? (isZh ? '克重' : 'Grams') : pickedSub === 'stock' ? (isZh ? '股数' : 'Shares') : (isZh ? '数量' : 'Quantity');
  const quantity = Math.max(0, parseFloat(qtyText.replace(/[^0-9.]/g, '')) || 0);

  const canSave = isHoldingType ? !busy && !!coin && quantity > 0 : !busy && name.trim().length > 0;

  const pickCoin = (c: TickerResult) => {
    setCoin(c);
    if (!name.trim()) setName(c.name);
    setSearchOpen(false);
  };

  const switchKind = (k: AccountKind) => {
    setKind(k);
    const firstCls = classesFor(k)[0]?.id ?? 'cash';
    setCls(firstCls);
    setHoldingMode(firstCls === 'investments');
  };

  const submit = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const rateVal = rateText.trim() ? parseFloat(rateText.replace(/[^0-9.]/g, '')) || null : null;
      if (isHoldingType && coin) {
        const sub = subFromType(coin.type);
        const ticker = sub === 'commodity' ? 'g' : coin.ticker;
        const cost = costText.trim() ? Math.round((parseFloat(costText.replace(/[^0-9.]/g, '')) || 0) * 100) / 100 : null;
        const id = await addHolding(
          name.trim() || coin.name,
          sub,
          coin.id,
          ticker,
          Math.round(quantity * 1e8) / 1e8,
          cost,
          null,
          rateVal
        );
        onCreated(id);
      } else {
        const currency = await getEntryCurrency();
        const id = await addAccount(name.trim(), kind, cls, 0, todayISO(), null, currency, isInvest ? rateVal : null);
        onCreated(id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.center, { pointerEvents: 'box-none' }]}
      >
        <View style={[styles.card, { backgroundColor: colorTheme.surface, marginBottom: insets.bottom }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colorTheme.ink }]}>{isZh ? '添加新账户' : 'New account'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={colorTheme.ink2} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
              {(['asset', 'liability'] as AccountKind[]).map((k) => {
                const on = kind === k;
                return (
                  <Pressable key={k} onPress={() => switchKind(k)} style={[styles.toggleBtn, on && { backgroundColor: colorTheme.surface }]}>
                    <Text style={[styles.toggleText, { color: colorTheme.ink2 }, on && { color: colorTheme.ink }]}>
                      {k === 'asset' ? (isZh ? '资产' : 'Assets') : (isZh ? '负债' : 'Liabilities')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.pickLabel, { color: colorTheme.ink2 }]}>{isZh ? '分类' : 'Type'}</Text>
            <View style={styles.choiceWrap}>
              {clsChoices.map((c) => {
                const on = c.id === cls;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setCls(c.id);
                      if (c.id === 'investments') setHoldingMode(true);
                    }}
                    style={[styles.classChip, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }, on && { borderColor: theme.accent, backgroundColor: theme.accentTint }]}
                  >
                    <Icon name={c.icon as IconName} size={15} color={on ? theme.accent : colorTheme.ink2} />
                    <Text style={[styles.classChipText, { color: colorTheme.ink }, on && { color: theme.onTint }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {isInvest && (
              <View style={[styles.toggle, { marginTop: 14, marginBottom: 14, backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                {([[true, isZh ? '实时标的' : 'Live holding'], [false, isZh ? '手动账户' : 'Manual account']] as const).map(([m, label]) => {
                  const on = holdingMode === m;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => {
                        setHoldingMode(m);
                        setCoin(null);
                      }}
                      style={[styles.toggleBtn, on && { backgroundColor: colorTheme.surface }]}
                    >
                      <Text style={[styles.toggleText, { color: colorTheme.ink2 }, on && { color: colorTheme.ink }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {isHoldingType ? (
              <>
                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '选择投资标的' : 'Investment'}</Text>
                <Pressable
                  onPress={() => setSearchOpen(true)}
                  style={[styles.pickerBtn, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}
                >
                  <Icon name="search" size={16} color={theme.accent} />
                  <Text style={[styles.pickerText, { color: colorTheme.ink }, !coin && { color: colorTheme.ink3 }]} numberOfLines={1}>
                    {coin ? `${coin.name} · ${qtyUnit}` : (isZh ? '搜索加密货币、美股、马股、黄金…' : 'Search crypto, stocks, gold or silver…')}
                  </Text>
                </Pressable>

                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{qtyLabel}</Text>
                <View style={[styles.amountRow, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                  <TextInput
                    value={qtyText}
                    onChangeText={setQtyText}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colorTheme.ink3}
                    style={[styles.amountInput, { color: colorTheme.ink }]}
                  />
                  {coin ? <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{qtyUnit}</Text> : null}
                </View>

                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '持仓成本 / 买入总额 (选填)' : 'Invested amount (optional)'}</Text>
                <View style={[styles.amountRow, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                  <Text style={[styles.rm, { color: colorTheme.ink2 }]}>RM</Text>
                  <TextInput
                    value={costText}
                    onChangeText={setCostText}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colorTheme.ink3}
                    style={[styles.amountInput, { color: colorTheme.ink }]}
                  />
                </View>

                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '年化收益率 / APR (选填)' : 'Interest rate (optional)'}</Text>
                <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                  <TextInput
                    value={rateText}
                    onChangeText={setRateText}
                    keyboardType="decimal-pad"
                    placeholder="APR"
                    placeholderTextColor={colorTheme.ink3}
                    style={[styles.compactInput, { color: colorTheme.ink }]}
                  />
                  <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>%</Text>
                </View>

                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '账户名称 (选填)' : 'Name (optional)'}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={coin ? coin.name : (isZh ? '例如：定投美股标普500' : 'e.g. S&P 500 DCA')}
                  placeholderTextColor={colorTheme.ink3}
                  style={[styles.input, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, color: colorTheme.ink }]}
                  maxLength={30}
                />
              </>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '账户名称' : 'Account name'}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={kind === 'asset' ? (isZh ? '例如：Maybank 储蓄账户' : 'e.g. Maybank Savings') : (isZh ? '例如：车贷 / 信用卡' : 'e.g. Car Loan')}
                  placeholderTextColor={colorTheme.ink3}
                  style={[styles.input, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, color: colorTheme.ink }]}
                  maxLength={30}
                  autoFocus
                />

                {isInvest && (
                  <>
                    <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '年化收益率 / APR (选填)' : 'Interest rate (optional)'}</Text>
                    <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                      <TextInput
                        value={rateText}
                        onChangeText={setRateText}
                        keyboardType="decimal-pad"
                        placeholder="APR"
                        placeholderTextColor={colorTheme.ink3}
                        style={[styles.compactInput, { color: colorTheme.ink }]}
                      />
                      <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>%</Text>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          <View style={{ marginTop: 16 }}>
            <PrimaryButton onPress={submit} disabled={!canSave} height={50}>
              <Icon name="plus" size={18} color="#fff" stroke={2.2} />
              <BtnLabel>{isZh ? '创建并选择' : 'Create & select'}</BtnLabel>
            </PrimaryButton>
          </View>
        </View>
      </KeyboardAvoidingView>

      <TickerSearchModal
        visible={searchOpen}
        title={isZh ? '搜索资产标的' : 'Search investment'}
        placeholder={isZh ? '输入代码、名称、加密货币、美股、马股或黄金…' : 'e.g. BTC, Maybank, AAPL, Gold…'}
        search={searchInvestments}
        onPick={pickCoin}
        onClose={() => setSearchOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  center: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  card: { borderRadius: radius.lg, padding: 18, maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: uiFont(700), fontSize: 17 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: uiFont(600),
    fontSize: 15,
    marginBottom: 12,
  },
  toggle: { flexDirection: 'row', borderRadius: 999, padding: 3, borderWidth: 1, marginBottom: 14 },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 999 },
  toggleText: { fontFamily: uiFont(600), fontSize: 13 },
  pickLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 8 },
  fieldLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 7, marginTop: 4 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  classChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  classChipText: { fontFamily: uiFont(600), fontSize: 12.5 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 12,
  },
  pickerText: { flex: 1, fontFamily: uiFont(600), fontSize: 14.5 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    marginBottom: 12,
  },
  rm: { fontFamily: numFont(600), fontSize: 16 },
  amountInput: {
    flex: 1,
    fontFamily: numFont(700),
    fontSize: 18,
    paddingVertical: 10,
  },
  compactInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 120,
    gap: 6,
    marginBottom: 12,
  },
  compactInput: {
    flex: 1,
    fontFamily: uiFont(600),
    fontSize: 14,
    paddingVertical: 0,
  },
  compactUnit: {
    fontFamily: uiFont(600),
    fontSize: 13,
  },
});
