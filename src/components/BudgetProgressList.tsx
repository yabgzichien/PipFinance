import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { categoryStatus } from '../lib/budget';
import { fmtMoney } from '../lib/format';
import type { Category } from '../lib/types';
import { useThemeColors } from '../state/colorScheme';
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { useLanguage } from '../i18n';
import { uiFont } from '../theme';
import { Card, CatBadge } from './ui';
import { Icon } from './Icon';

const fallback: Category = { id: 'other', label: 'Other', icon: 'dots', hue: 220, kind: 'expense', isDefault: true };
export const STATUS_COLOR = { ok: '#1f8a5b', caution: '#ca8a04', warn: '#ea580c', over: '#c5402f' } as const;

/**
 * The per-category budget-progress card: one row per budgeted category (spent /
 * allocated, a status-colored bar, remaining/over), plus an "Unbudgeted" row for
 * spending in categories with no allocation. Shared by the Budget screen and the
 * dashboard's "This month" section.
 */
export function BudgetProgressList({
  allocations,
  spentByCat,
  catById,
  onPressCategory,
}: {
  allocations: Record<string, number>;
  spentByCat: Record<string, number>;
  catById: Record<string, Category>;
  /** Tapping a category row drills into its transactions instead of opening the Budget screen. */
  onPressCategory?: (id: string) => void;
}) {
  const colorTheme = useThemeColors();
  const dc = useDisplayCurrency();
  const { tCat, isZh } = useLanguage();
  // Highest spender first, so the category actually pulling the budget off track is the one
  // you see without scrolling, rather than whatever order allocations happened to be set in.
  const budgetedIds = useMemo(
    () => Object.keys(allocations).sort((a, b) => (spentByCat[b] ?? 0) - (spentByCat[a] ?? 0)),
    [allocations, spentByCat]
  );
  const unbudgetedSpent = useMemo(
    () => Object.entries(spentByCat).filter(([id]) => !budgetedIds.includes(id)).reduce((s, [, v]) => s + v, 0),
    [spentByCat, budgetedIds]
  );

  return (
    <Card style={{ overflow: 'hidden' }}>
      {budgetedIds.map((id, i) => {
        const cat = catById[id] ?? fallback;
        const alloc = allocations[id];
        const spent = spentByCat[id] ?? 0;
        const st = categoryStatus(spent, alloc);
        const remaining = alloc - spent;
        return (
          <Pressable
            key={id}
            onPress={onPressCategory ? () => onPressCategory(id) : undefined}
            style={({ pressed }) => [
              styles.catRow,
              i > 0 && [styles.divider, { borderTopColor: colorTheme.line2 }],
              onPressCategory && pressed && { backgroundColor: colorTheme.surface2 },
            ]}
          >
            <CatBadge category={cat} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.rowBetween}>
                <Text style={[styles.catLabel, { color: colorTheme.ink }]} numberOfLines={1}>{tCat(cat)}</Text>
                <Text style={[styles.catNums, { color: colorTheme.ink2 }]}>{fmtMoney(dc.convert(spent), dc.code)} / {fmtMoney(dc.convert(alloc), dc.code)}</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colorTheme.line }]}>
                <View style={{ width: `${Math.min(100, alloc > 0 ? (spent / alloc) * 100 : 100)}%`, height: '100%', borderRadius: 999, backgroundColor: STATUS_COLOR[st] }} />
              </View>
              <Text style={[styles.remaining, { color: remaining < 0 ? STATUS_COLOR.over : colorTheme.ink3 }]}>
                {remaining < 0 ? (isZh ? `超出 ${fmtMoney(dc.convert(-remaining), dc.code)}` : `${fmtMoney(dc.convert(-remaining), dc.code)} over`) : (isZh ? `剩余 ${fmtMoney(dc.convert(remaining), dc.code)}` : `${fmtMoney(dc.convert(remaining), dc.code)} left`)}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {unbudgetedSpent > 0 && (
        <View style={[styles.catRow, budgetedIds.length > 0 && [styles.divider, { borderTopColor: colorTheme.line2 }]]}>
          <View style={[styles.unbudgetedIcon, { backgroundColor: colorTheme.surface2 }]}><Icon name="dots" size={18} color={colorTheme.ink3} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.catLabel, { color: colorTheme.ink }]}>{isZh ? '未列入预算' : 'Unbudgeted'}</Text>
            <Text style={[styles.remaining, { color: colorTheme.ink2 }]}>{isZh ? `预算外支出 ${fmtMoney(dc.convert(unbudgetedSpent), dc.code)}` : `${fmtMoney(dc.convert(unbudgetedSpent), dc.code)} spent outside your budget`}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 12 },
  divider: { borderTopWidth: 1 },
  catLabel: { fontFamily: uiFont(600), fontSize: 14.5, flex: 1 },
  catNums: { fontFamily: uiFont(600), fontSize: 12.5 },
  barTrack: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 7 },
  remaining: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 4 },
  unbudgetedIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
