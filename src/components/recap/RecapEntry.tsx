import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../Icon';
import { Body, Label } from '../ui';
import { currentMonthKey, txnMonthKey } from '../../lib/budget';
import { prevMonthKey } from '../../lib/recap';
import type { Transaction } from '../../lib/types';
import * as haptics from '../../lib/haptics';
import { useLanguage } from '../../i18n';
import { useAccent } from '../../state/accent';
import { useThemeColors } from '../../state/colorScheme';
import { radius, spacing } from '../../theme';

/** One quiet entry for the previous calendar month; never advertises an empty recap. */
export function RecapEntry({ transactions, now, onOpen }: {
  transactions: Transaction[];
  now: Date;
  onOpen: (month: string) => void;
}) {
  const month = prevMonthKey(currentMonthKey(now));
  const count = useMemo(() => transactions.filter((txn) => txn.type !== 'transfer' && txnMonthKey(txn) === month).length, [transactions, month]);
  const { isZh, formatMonthLabel } = useLanguage();
  const accent = useAccent();
  const colors = useThemeColors();
  if (count === 0) return null;
  const label = formatMonthLabel(month, true);
  return <Pressable onPress={() => { haptics.tap(); onOpen(month); }} accessibilityRole="button" accessibilityLabel={isZh ? `查看${label}回顾` : `View ${label} recap`} style={({ pressed }) => [styles.entry, { backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}>
    <View style={[styles.icon, { backgroundColor: accent.accentTint }]}><Icon name="book" size={22} color={accent.onTint} /></View>
    <View style={styles.copy}>
      <Body weight={700}>{isZh ? `${label}回顾` : `Your ${label} recap`}</Body>
      <Label weight={500} color={colors.ink2}>{isZh ? '看看这个月的收支与变化。' : 'See where your money went, and what changed.'}</Label>
    </View>
    <Icon name="arrowRight" size={20} color={accent.onTint} />
  </Pressable>;
}

const styles = StyleSheet.create({
  entry: { marginHorizontal: spacing.base, marginTop: spacing.md, padding: spacing.base, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
});
