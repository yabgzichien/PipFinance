import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { TripBadge } from './TripBadge';
import { Card } from './ui';
import { fmtMoney } from '../lib/format';
import { tripMonthTotals, tripRowSecondary, type TripMonthTotal } from '../lib/trips';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { useLanguage } from '../i18n';
import { uiFont } from '../theme';

/**
 * "Trips this month" — the same card on Breakdown and Recap, so the two screens can never
 * describe one month's trip spending differently.
 *
 * Renders NOTHING when the month has no trip expenses. Users who never open Trips must not pay
 * for the feature with an empty card, a zero row, or an extra scroll on every month.
 *
 * `heading` is supplied by the caller rather than owned here: Breakdown labels its sections with
 * <Eyebrow>, Recap with its own sectionHead row, and forcing one idiom onto both would make the
 * card look bolted on wherever it lost. The rows below it stay identical either way.
 */
export function TripMonthSection({
  monthKey,
  monthExpenseTotal,
  heading,
  cardStyle,
  onOpenTrip,
}: {
  monthKey: string;
  /** The month's total expenses, in display currency — the denominator for each row's share. */
  monthExpenseTotal: number;
  heading: React.ReactNode;
  /** Same reason as `heading`: Breakdown's cards are inset by the scroll padding, Recap's carry
   *  their own margins. The caller matches its neighbours; the rows inside stay identical. */
  cardStyle?: ViewStyle;
  onOpenTrip: (tripId: string) => void;
}) {
  const { transactions, trips } = useAppData();
  const dc = useDisplayCurrency();

  const rows = useMemo(
    () => tripMonthTotals(transactions, trips, monthKey, dc.convertTxn),
    [transactions, trips, monthKey, dc]
  );

  if (rows.length === 0) return null;

  return (
    <>
      {heading}
      <Card style={cardStyle ? [styles.card, cardStyle] : styles.card}>
        {rows.map((row, i) => (
          <TripRow
            key={row.trip.id}
            row={row}
            monthExpenseTotal={monthExpenseTotal}
            isFirst={i === 0}
            onPress={() => onOpenTrip(row.trip.id)}
          />
        ))}
      </Card>
    </>
  );
}

function TripRow({
  row,
  monthExpenseTotal,
  isFirst,
  onPress,
}: {
  row: TripMonthTotal;
  monthExpenseTotal: number;
  isFirst: boolean;
  onPress: () => void;
}) {
  const colorTheme = useThemeColors();
  const { t } = useLanguage();
  const dc = useDisplayCurrency();

  const monthText = fmtMoney(row.monthAmount, dc.code);

  // Which fact the one secondary line carries is decided in src/lib/trips.ts, where it is tested;
  // this only turns that choice into a translated string.
  const choice = tripRowSecondary(row, monthExpenseTotal);
  const secondary =
    choice.kind === 'tripTotal'
      ? t('tripTotalSubtext', { amount: fmtMoney(choice.amount, dc.code) })
      : choice.kind === 'share'
      ? t('tripsShareOfMonth', { pct: choice.pct })
      : null;

  const nameColor = row.trip.archived ? colorTheme.ink2 : colorTheme.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.trip.name}, ${monthText}`}
      style={({ pressed }) => [
        styles.row,
        !isFirst && [styles.divider, { borderTopColor: colorTheme.line2 }],
        pressed && { backgroundColor: colorTheme.surface2 },
      ]}
    >
      <TripBadge trip={row.trip} size={38} rad={12} muted={row.trip.archived} />

      <View style={styles.names}>
        <Text style={[styles.name, { color: nameColor }]} numberOfLines={1}>
          {row.trip.name}
        </Text>
        <Text style={[styles.sub, { color: colorTheme.ink2 }]} numberOfLines={1}>
          {t('tripCountExpenses', { n: row.monthCount })}
        </Text>
      </View>

      <View style={styles.amounts}>
        <Text style={[styles.amount, { color: nameColor }]}>{monthText}</Text>
        {secondary !== null && (
          <Text style={[styles.sub, { color: colorTheme.ink2 }]} numberOfLines={1}>
            {secondary}
          </Text>
        )}
      </View>

      <Icon name="chevronRight" size={15} color={colorTheme.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 11 },
  divider: { borderTopWidth: 1 },
  names: { flex: 1, minWidth: 0 },
  name: { fontFamily: uiFont(600), fontSize: 14.5 },
  amounts: { alignItems: 'flex-end', marginRight: 4, minWidth: 0, flexShrink: 1 },
  amount: { fontFamily: uiFont(700), fontSize: 14.5 },
  sub: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 1 },
});
