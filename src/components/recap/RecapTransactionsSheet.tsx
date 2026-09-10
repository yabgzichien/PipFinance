import React, { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../Icon';
import { Body, CatBadge, Label, Title } from '../ui';
import { txnMonthKey } from '../../lib/budget';
import { fmtMoney } from '../../lib/format';
import type { Category, Transaction } from '../../lib/types';
import { useLanguage } from '../../i18n';
import { useThemeColors } from '../../state/colorScheme';
import { useDisplayCurrency } from '../../state/useDisplayCurrency';
import { useReducedMotion } from '../../state/useReducedMotion';
import { spacing } from '../../theme';

/** A read-only, month-scoped drill-down. Closing it keeps the recap's scroll position. */
export function RecapTransactionsSheet({ month, categoryId, transactions, categoryFor, onClose }: {
  month: string;
  categoryId: string | null;
  transactions: Transaction[];
  categoryFor: (id: string) => Category;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const dc = useDisplayCurrency();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { isZh, tCat, formatMonthLabel, formatShortDate } = useLanguage();
  const rows = useMemo(() => transactions.filter((txn) =>
    txn.type === 'expense' && txnMonthKey(txn) === month &&
    (categoryId === null || (txn.categoryId ?? 'other') === categoryId)
  ).sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt)), [transactions, month, categoryId]);
  const title = categoryId === null ? (isZh ? '本月支出' : 'Monthly spending') : tCat(categoryFor(categoryId));

  return (
    <Modal visible transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={isZh ? '关闭交易明细' : 'Close transactions'} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.base }]} accessibilityViewIsModal>
          <View style={styles.heading}>
            <View style={styles.grow}>
              <Title>{title}</Title>
              <Label weight={500} color={colors.ink2}>{formatMonthLabel(month, true)}</Label>
            </View>
            <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={isZh ? '关闭' : 'Close'}>
              <Icon name="x" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View style={[styles.total, { borderColor: colors.line }]}>
            <Body color={colors.ink2}>{isZh ? `${rows.length} 笔支出` : `${rows.length} expense${rows.length === 1 ? '' : 's'}`}</Body>
            <Body numeric weight={700}>{fmtMoney(rows.reduce((sum, txn) => sum + dc.convertTxn(txn), 0), dc.code)}</Body>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(txn) => txn.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Body color={colors.ink2}>{isZh ? '此月份没有相关支出记录。' : 'No recorded expenses for this selection.'}</Body>}
            renderItem={({ item }) => (
              <View style={[styles.row, { borderBottomColor: colors.line }]}>
                <CatBadge category={categoryFor(item.categoryId ?? 'other')} size={36} rad={12} />
                <View style={styles.grow}>
                  <Body weight={700}>{item.merchantRaw || tCat(categoryFor(item.categoryId ?? 'other'))}</Body>
                  <Label weight={500} color={colors.ink2}>{formatShortDate(item.date ?? item.createdAt)}</Label>
                  {!!item.remark && <Label weight={500} color={colors.ink2}>{item.remark}</Label>}
                </View>
                <View style={styles.amount}>
                  <Body numeric weight={700}>{fmtMoney(dc.convertTxn(item), dc.code)}</Body>
                  {item.currency !== dc.code && item.nativeAmount != null && <Label weight={500} color={colors.ink2}>{fmtMoney(item.nativeAmount, item.currency)}</Label>}
                </View>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: spacing.base },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.base },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0, gap: spacing.xs },
  total: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, marginHorizontal: spacing.lg, paddingVertical: spacing.base, borderTopWidth: 1, borderBottomWidth: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.base, borderBottomWidth: 1 },
  amount: { maxWidth: '45%', alignItems: 'flex-end', gap: spacing.xs },
});
