// src/screens/NetWorthHistoryScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Amount, Body, Caption, Card, Label, Title, TopBar } from '../components/ui';
import { listFxRates } from '../db/fxRepo';
import { monthLabel } from '../lib/dates';
import { ratesFromCache } from '../lib/fx';
import { fmtMoney } from '../lib/format';
import { monthsWithData, netWorthSeries, type NetWorthPoint } from '../lib/networth';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { useLanguage } from '../i18n';
import { useAppData } from '../state/store';
import { radius, spacing, type as typeScale, uiFont } from '../theme';

interface Row extends NetWorthPoint {
  delta: number | null;
}

export function NetWorthHistoryScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t, formatMonthLabel, isZh } = useLanguage();
  const { accounts, balanceEntries } = useAppData();
  const dc = useDisplayCurrency();
  const [search, setSearch] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    listFxRates().then((fx) => setRates(ratesFromCache(fx)));
  }, []);

  const monthKeys = useMemo(() => monthsWithData(balanceEntries), [balanceEntries]);
  const series = useMemo(
    () => netWorthSeries(accounts, balanceEntries, monthKeys, rates),
    [accounts, balanceEntries, monthKeys, rates]
  );

  // Newest first, each carrying its delta vs the previous (older) month.
  const rows: Row[] = useMemo(
    () => series.map((p, i) => ({ ...p, delta: i > 0 ? p.net - series[i - 1].net : null })).reverse(),
    [series]
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => formatMonthLabel(r.monthKey, true).toLowerCase().includes(q));
  }, [rows, search, formatMonthLabel]);

  // `shown` is already newest-first and chronological, so grouping preserves year order.
  const sections = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const r of shown) {
      const year = r.monthKey.slice(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(r);
    }
    return [...groups.entries()].map(([year, items]) => ({ year, items }));
  }, [shown]);

  const searching = search.trim().length > 0;

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + spacing.xs }}>
        <TopBar title={t('historyTitle')} onBack={onBack} />
      </View>

      {rows.length > 0 && (
        <View style={[styles.searchRow, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, marginHorizontal: spacing.lg }]}>
          <Icon name="search" size={16} color={colorTheme.ink3} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isZh ? '按月份或年份搜索' : 'Search by month or year'}
            placeholderTextColor={colorTheme.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: colorTheme.ink, fontSize: typeScale.body }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" size={15} color={colorTheme.ink3} />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        {rows.length === 0 ? (
          <Card style={{ padding: spacing.lg, alignItems: 'center' }}>
            <Icon name="clock" size={36} color={theme.accent} />
            <Title style={{ marginTop: spacing.sm }}>{isZh ? '暂无历史记录' : 'No history yet'}</Title>
            <Body color={colorTheme.ink2} style={{ textAlign: 'center', marginTop: spacing.xs }}>
              {isZh ? '记录账户余额后，每月的净资产将显示在此处。' : "Once your accounts have a balance recorded, each month's net worth will show up here."}
            </Body>
          </Card>
        ) : shown.length === 0 ? (
          <Card style={{ padding: spacing.lg, alignItems: 'center' }}>
            <Title>{isZh ? '未找到匹配的月份' : 'No matching months'}</Title>
            <Body color={colorTheme.ink2} style={{ textAlign: 'center', marginTop: spacing.xs }}>
              {isZh ? '请尝试不同的月份或年份。' : 'Try a different month or year.'}
            </Body>
          </Card>
        ) : (
          <>
            {!searching && (
              <Caption color={colorTheme.ink2} style={{ marginBottom: spacing.sm }}>
                {isZh ? `已记录 ${rows.length} 个月份` : `${rows.length} month${rows.length === 1 ? '' : 's'} recorded`}
              </Caption>
            )}
            {sections.map((section) => (
              <View key={section.year} style={{ marginBottom: spacing.base }}>
                <Label weight={700} color={colorTheme.ink2} style={{ marginBottom: spacing.sm }}>
                  {isZh ? `${section.year}年` : section.year}
                </Label>
                <Card style={{ overflow: 'hidden' }}>
                  {section.items.map((r, i) => {
                    const up = (r.delta ?? 0) >= 0;
                    return (
                      <View
                        key={r.monthKey}
                        style={[styles.row, i > 0 && styles.divider, i > 0 && { borderTopColor: colorTheme.line2 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Body weight={700}>{formatMonthLabel(r.monthKey, true)}</Body>
                          {r.delta !== null && (
                            <Label weight={700} color={up ? theme.accent : colorTheme.red} style={{ marginTop: spacing.xs }}>
                              {up ? '▲' : '▼'} {fmtMoney(dc.convert(Math.abs(r.delta)), dc.code)} {isZh ? '比上月' : 'vs prev month'}
                            </Label>
                          )}
                        </View>
                        <Amount value={dc.convert(r.net)} currency={dc.code} size={typeScale.body} weight={700} color={r.net < 0 ? colorTheme.red : colorTheme.ink} />
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: uiFont(600), paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1 },
});
