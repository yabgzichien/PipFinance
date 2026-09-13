// src/components/SettleSheet.tsx
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { BtnLabel, PrimaryButton } from './ui';
import { currencyPrefix, fmtMoney } from '../lib/format';
import { RECEIVABLE_CLS } from '../lib/networth';
import type { OpenShare } from '../lib/split';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useLanguage } from '../i18n';
import { numFont, radius, uiFont } from '../theme';

/** Record a cash repayment: how much came back, and which account it landed in. */
export function SettleSheet({
  share,
  accounts,
  today,
  onClose,
  onSettle,
}: {
  share: OpenShare | null;
  accounts: { id: string; name: string; kind: string; cls: string; archived: boolean }[];
  today?: string;
  onClose: () => void;
  onSettle: (amount: number, accountId: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const assets = useMemo(
    () => accounts.filter((a) => !a.archived && a.kind === 'asset' && a.cls !== RECEIVABLE_CLS),
    [accounts]
  );
  const [amountText, setAmountText] = useState('');
  const [acct, setAcct] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openId = share?.shareId;
  React.useEffect(() => {
    if (share) {
      setAmountText(share.outstanding.toFixed(2));
      setAcct(assets[0]?.id ?? null);
      setSubmitting(false);
    }
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!share) return <Modal visible={false} transparent />;

  const parsed = parseFloat(amountText.replace(/[^0-9.]/g, '')) || 0;
  const amount = Math.min(share.outstanding, Math.round(parsed * 100) / 100);
  const partial = amount > 0 && amount < share.outstanding;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        style={styles.sheetAvoider}
        pointerEvents="box-none"
      >
        <View style={[styles.sheetCard, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
              <Text style={[styles.sheetTitle, { color: colorTheme.ink }]} numberOfLines={1}>
                {isZh ? `${share.personName} 已还款` : `${share.personName} paid you back`}
              </Text>
              <Text style={[styles.sheetSub, { color: colorTheme.ink2 }]} numberOfLines={1}>
                {share.merchant}
                {share.remark && share.remark.trim().toLowerCase() !== share.merchant.trim().toLowerCase()
                  ? ` (${share.remark.trim()})`
                  : ''}
                {` · ${isZh ? '待还' : ''} ${fmtMoney(share.outstanding, share.currency ?? 'MYR')}${isZh ? '' : ' outstanding'}`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <Icon name="x" size={20} color={colorTheme.ink2} />
            </Pressable>
          </View>

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '收到还款金额' : 'How much came back'}</Text>
          <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(share.currency ?? 'MYR')}</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[styles.amountInput, { color: colorTheme.ink }]}
            />
          </View>
          {partial && (
            <Text style={[styles.partialNote, { color: colorTheme.amber }]}>
              {isZh
                ? `部分还款。剩余 ${fmtMoney(share.outstanding - amount, share.currency ?? 'MYR')} 保持待收。`
                : `Partial payment. ${fmtMoney(share.outstanding - amount, share.currency ?? 'MYR')} stays open.`}
            </Text>
          )}

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2, marginTop: 18 }]}>{isZh ? '存入账户' : 'Where it landed'}</Text>
          <View style={styles.acctWrap}>
            {assets.map((a) => {
              const on = acct === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setAcct(a.id)}
                  style={[
                    styles.acctChip,
                    { backgroundColor: colorTheme.surface, borderColor: colorTheme.line },
                    on && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft },
                  ]}
                >
                  <Text style={[styles.acctText, { color: colorTheme.ink2 }, on && { color: theme.onTint }]} numberOfLines={1}>
                    {a.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setAcct(null)}
              style={[
                styles.acctChip,
                { backgroundColor: colorTheme.surface, borderColor: colorTheme.line },
                acct === null && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft },
              ]}
            >
              <Text style={[styles.acctText, { color: colorTheme.ink2 }, acct === null && { color: theme.onTint }]}>
                {isZh ? '不追踪账户' : 'Not tracked'}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.acctNote, { color: colorTheme.ink3 }]}>
            {isZh
              ? '不计入新增收入。系统将清账应收款并增加现金账户余额，精准还原回款本质。'
              : 'No income is recorded. The debt clears and the cash moves, which is what being paid back actually is.'}
          </Text>

          <View style={{ marginTop: 18 }}>
            <PrimaryButton
              onPress={() => {
                if (submitting) return;
                setSubmitting(true);
                onSettle(amount, acct);
              }}
              height={52}
              disabled={amount <= 0 || submitting}
            >
              <Icon name="check" size={18} color="#fff" stroke={2.4} />
              <BtnLabel>
                {partial
                  ? (isZh ? `记录还款 ${fmtMoney(amount, share.currency ?? 'MYR')}` : `Record ${fmtMoney(amount, share.currency ?? 'MYR')}`)
                  : (isZh ? '标记结清' : 'Mark settled')}
              </BtnLabel>
            </PrimaryButton>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontFamily: uiFont(700), fontSize: 18 },
  sheetSub: { fontFamily: uiFont(500), fontSize: 12.5, marginTop: 2 },
  fieldLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 8 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
  },
  rm: { fontFamily: numFont(600), fontSize: 18 },
  amountInput: { flex: 1, fontFamily: numFont(700), fontSize: 24, paddingVertical: 12 },
  partialNote: { fontFamily: uiFont(600), fontSize: 12, marginTop: 8 },
  acctWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  acctChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  acctText: { fontFamily: uiFont(600), fontSize: 13, maxWidth: 160 },
  acctNote: { fontFamily: uiFont(500), fontSize: 11.5, lineHeight: 16, marginTop: 10 },
});
