// src/screens/BudgetWizard.tsx
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddCategoryModal } from '../components/AddCategoryModal';
import { Icon } from '../components/Icon';
import { Amount, BtnLabel, Card, CatBadge, Eyebrow, Label, PrimaryButton, ProgressTrack, TopBar } from '../components/ui';
import { allocatedTotal, averageMonthlySpend, leftover } from '../lib/budget';
import { fmt } from '../lib/format';
import { baselineExplanation, computeIncomeBaseline } from '../lib/incomeBaseline';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useBackHandler } from '../state/useBackHandler';
import { numFont, radius, spacing, uiFont } from '../theme';

export function BudgetWizard({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const {
    transactions,
    categories,
    expectedIncome,
    allocations: currentAllocations,
    hasBudget,
    saveBudget,
  } = useAppData();

  const expenseCats = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories]);
  const avg = useMemo(() => averageMonthlySpend(transactions, new Date(), 3), [transactions]);
  const income6 = useMemo(() => computeIncomeBaseline(transactions), [transactions]);
  const suggestedIncome = income6.irregular ? income6.baseline : income6.average;

  // Initialize with old data (or baseline recommendation if zero)
  const initialIncome = expectedIncome > 0 ? String(expectedIncome) : (suggestedIncome ? String(suggestedIncome) : '');
  const [incomeText, setIncomeText] = useState(initialIncome);

  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [catId, amt] of Object.entries(currentAllocations)) {
      if (amt > 0) initial[catId] = String(amt);
    }
    return initial;
  });

  const [adding, setAdding] = useState(false);

  const income = Math.max(0, parseFloat(incomeText.replace(/[^0-9.]/g, '')) || 0);
  const allocations = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of expenseCats) {
      const v = Math.max(0, parseFloat((amounts[c.id] ?? '').replace(/[^0-9.]/g, '')) || 0);
      if (v > 0) out[c.id] = v;
    }
    return out;
  }, [expenseCats, amounts]);

  const total = allocatedTotal(allocations);
  const left = leftover(income, allocations);

  const autoFill = () => {
    setAmounts((prev) => {
      const next = { ...prev };
      for (const c of expenseCats) {
        if (avg[c.id] !== undefined && avg[c.id] > 0) {
          next[c.id] = String(avg[c.id]);
        }
      }
      return next;
    });
  };

  const finish = async () => {
    await saveBudget(income, allocations);
    onDone();
  };

  const goBack = () => (onBack ? onBack() : onDone());
  useBackHandler(() => {
    goBack();
    return true;
  });

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + spacing.xs }}>
        <TopBar
          title={hasBudget ? 'Edit budget' : 'Set up budget'}
          onBack={goBack}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Income section */}
        <Eyebrow style={{ marginBottom: spacing.sm }}>Expected monthly income</Eyebrow>
        <Card style={styles.incomeCard}>
          <Text style={[styles.rm, { color: colorTheme.ink2 }]}>RM</Text>
          <TextInput
            value={incomeText}
            onChangeText={setIncomeText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colorTheme.ink3}
            style={[styles.incomeInput, { color: colorTheme.ink }]}
          />
        </Card>
        {income6.months > 0 && (
          <Label weight={500} color={colorTheme.ink2} style={{ marginTop: spacing.xs, marginLeft: spacing.xs }}>
            {income6.irregular
              ? `Your income swings between RM ${fmt(income6.low)} and RM ${fmt(income6.high)}, so Pip suggests planning against RM ${fmt(income6.baseline)}. ${baselineExplanation(income6)}`
              : `Your recent average is RM ${fmt(income6.average)}.`}
          </Label>
        )}

        {/* Expenses category allocations */}
        <View style={[styles.sectionHeader, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          <Eyebrow>Category expenses budget</Eyebrow>
          <Pressable
            onPress={autoFill}
            style={({ pressed }) => [
              styles.autoFillBtn,
              { backgroundColor: colorTheme.surface2, borderColor: theme.accentSoft, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Icon name="sparkles" size={13} color={theme.accent} />
            <Text style={[styles.autoFillText, { color: theme.accent }]}>Auto-fill from history</Text>
          </Pressable>
        </View>

        {expenseCats.map((c) => (
          <Card key={c.id} style={styles.allocRow}>
            <CatBadge category={c} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.allocLabel, { color: colorTheme.ink }]} numberOfLines={1}>
                {c.label}
              </Text>
            </View>
            <View style={[styles.allocInputWrap, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
              <Text style={[styles.rmSmall, { color: colorTheme.ink2 }]}>RM</Text>
              <TextInput
                value={amounts[c.id] ?? ''}
                onChangeText={(v) => setAmounts((p) => ({ ...p, [c.id]: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colorTheme.ink3}
                style={[styles.allocInput, { color: colorTheme.ink }]}
              />
            </View>
          </Card>
        ))}

        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => [
            styles.addRow,
            { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Icon name="plus" size={16} color={theme.accent} stroke={2.2} />
          <Text style={[styles.addRowText, { color: theme.accent }]}>New category</Text>
        </Pressable>
      </ScrollView>

      {/* Footer summary & save */}
      <View style={[styles.footer, { backgroundColor: colorTheme.bg, borderTopColor: colorTheme.line2, paddingBottom: insets.bottom + spacing.base }]}>
        <View style={{ marginBottom: spacing.sm }}>
          <View style={styles.summary}>
            <Text style={[styles.summaryText, { color: colorTheme.ink2 }]}>
              Allocated <Amount value={total} size={13} weight={700} /> of <Amount value={income} size={13} weight={700} />
            </Text>
            <Text style={[styles.summaryText, { color: left < 0 ? '#c5402f' : theme.accentInk }]}>
              {left < 0 ? `Over by RM ${fmt(-left)}` : `RM ${fmt(left)} left`}
            </Text>
          </View>
          <View style={{ marginTop: spacing.xs }}>
            <ProgressTrack pct={income > 0 ? (total / income) * 100 : 0} height={5} />
          </View>
        </View>
        <PrimaryButton onPress={finish} height={50}>
          <Icon name="check" size={19} color="#fff" stroke={2.4} />
          <BtnLabel>Save budget</BtnLabel>
        </PrimaryButton>
      </View>

      <AddCategoryModal
        visible={adding}
        kind="expense"
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  incomeCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: spacing.sm },
  rm: { fontFamily: numFont(600), fontSize: 22 },
  incomeInput: { flex: 1, fontFamily: numFont(700), fontSize: 26, padding: 0 },
  rmSmall: { fontFamily: numFont(600), fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoFillBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999, borderWidth: 1 },
  autoFillText: { fontFamily: uiFont(700), fontSize: 12 },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm },
  allocLabel: { fontFamily: uiFont(600), fontSize: 14.5 },
  allocInputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm },
  allocInput: { fontFamily: numFont(700), fontSize: 16, minWidth: 80, textAlign: 'right', paddingVertical: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', marginTop: spacing.xs },
  addRowText: { fontFamily: uiFont(700), fontSize: 13.5 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.base, paddingTop: spacing.md, borderTopWidth: 1 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryText: { fontFamily: uiFont(600), fontSize: 13 },
});
