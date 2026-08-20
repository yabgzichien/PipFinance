// src/screens/BudgetScreen.tsx
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BenchmarkCard } from '../components/BenchmarkCard';
import { BenchmarkPicker } from '../components/BenchmarkPicker';
import { BudgetProgressList } from '../components/BudgetProgressList';
import { Icon } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { Pip } from '../components/Pip';
import { SavingsHabitCard } from '../components/SavingsHabitCard';
import { Amount, Body, BtnLabel, Card, Caption, Eyebrow, Label, PrimaryButton, ProgressTrack, TopBar } from '../components/ui';
import { getBenchmark } from '../lib/belanjawanku';
import { benchmarkGaps } from '../lib/belanjawankuBudget';
import { computeIncomeBaseline } from '../lib/incomeBaseline';
import { computeSavingsHabit } from '../lib/savingsHabit';
import { allocatedTotal, averageMonthlySpend, budgetHash, categoryStatus, currentMonthKey, leftover, txnMonthKey } from '../lib/budget';
import { monthName } from '../lib/dates';
import { fmt } from '../lib/format';
import type { Category } from '../lib/types';
import { getLLM, llmErrorMessage } from '../llm';
import { buildBudgetPrompt, COACH_SYSTEM_PROMPT } from '../llm/budgetPrompt';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { spacing } from '../theme';
import { BudgetWizard } from './BudgetWizard';

const fallback: Category = { id: 'other', label: 'Other', icon: 'dots', hue: 220, kind: 'expense', isDefault: true };
const STATUS_COLOR = { ok: '#1f8a5b', warn: '#d98a00', over: '#c5402f' } as const;

export function BudgetScreen({ onBack, onOpenRecap = () => {} }: { onBack: () => void; onOpenRecap?: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const {
    transactions,
    catById,
    expectedIncome,
    allocations,
    hasBudget,
    getCachedAdvice,
    saveAdvice,
    householdProfile,
    guideCity,
    setBenchmarkProfile,
    savingsTarget,
    setSavingsTarget,
  } = useAppData();
  const [editing, setEditing] = useState(false);
  const [pickingHousehold, setPickingHousehold] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [adviceErr, setAdviceErr] = useState('');

  const monthExpenses = useMemo(() => {
    const cur = currentMonthKey();
    return transactions.filter((t) => t.type === 'expense' && txnMonthKey(t) === cur);
  }, [transactions]);
  const spentByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of monthExpenses) m[t.categoryId ?? 'other'] = (m[t.categoryId ?? 'other'] ?? 0) + t.amount;
    return m;
  }, [monthExpenses]);

  const benchmark = useMemo(() => getBenchmark(householdProfile, guideCity), [householdProfile, guideCity]);
  // Three-month average, the same window `useCreditProfile` feeds the coach, so the gaps quoted
  // here and the ones Pip narrates are always the same numbers.
  const gaps = useMemo(
    () => benchmarkGaps(benchmark, averageMonthlySpend(transactions, new Date(), 3)),
    [benchmark, transactions]
  );
  const habit = useMemo(
    () => computeSavingsHabit(transactions, savingsTarget),
    [transactions, savingsTarget]
  );
  // Moved here from Home (docs/ui-design-plan.md §3): a conservative income floor only means
  // anything to someone setting up or reviewing a budget, and it almost never fired on Home for
  // the launch persona (a salaried professional, not the irregular earner this is built for).
  const incomeBaseline = useMemo(() => computeIncomeBaseline(transactions), [transactions]);

  const allocated = allocatedTotal(allocations);
  const left = leftover(expectedIncome, allocations);
  const budgetedIds = Object.keys(allocations);
  const unbudgetedSpent = useMemo(
    () => Object.entries(spentByCat).filter(([id]) => !budgetedIds.includes(id)).reduce((s, [, v]) => s + v, 0),
    [spentByCat, budgetedIds]
  );

  if (editing || !hasBudget) {
    return <BudgetWizard onDone={() => { setEditing(false); }} />;
  }

  const askPip = async () => {
    setAdviceErr('');
    const hash = budgetHash(expectedIncome, allocations);
    const cached = await getCachedAdvice();
    if (cached && cached.hash === hash) {
      setAdvice(cached.text);
      return;
    }
    setAdviceBusy(true);
    try {
      const llm = await getLLM();
      const avg = averageMonthlySpend(transactions, new Date(), 3);
      const lines = budgetedIds.map((id) => ({
        label: (catById[id] ?? fallback).label,
        allocated: allocations[id],
        recentAverage: avg[id] ?? 0,
      }));
      const text = await llm.coach({
        system: COACH_SYSTEM_PROMPT,
        prompt: buildBudgetPrompt(expectedIncome, left, lines),
      });
      setAdvice(text);
      await saveAdvice(expectedIncome, allocations, text);
    } catch (e) {
      setAdviceErr(llmErrorMessage(e));
    } finally {
      setAdviceBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + spacing.xs }}>
        <TopBar title="Budget" onBack={onBack} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* summary */}
        <Card style={{ padding: spacing.base }}>
          <View style={styles.rowBetween}>
            <View>
              <View style={styles.eyebrowRow}>
                <Eyebrow>Income</Eyebrow>
                <InfoButton entry="net_cash_flow" />
              </View>
              <Amount value={expectedIncome} size={22} weight={700} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.eyebrowRow}>
                <Eyebrow>{left < 0 ? 'Over' : 'Unallocated'}</Eyebrow>
                {left >= 0 && <InfoButton entry="unallocated" />}
              </View>
              <Amount value={Math.abs(left)} size={22} weight={700} color={left < 0 ? STATUS_COLOR.over : theme.accent} />
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ProgressTrack pct={expectedIncome > 0 ? (allocated / expectedIncome) * 100 : 0} />
            <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>Allocated RM {fmt(allocated)} of RM {fmt(expectedIncome)}</Caption>
          </View>
        </Card>

        {/* Safe monthly income — for borrowers whose earnings actually swing, since a steady
            salary needs no separate planning figure. Moved from Home (docs/ui-design-plan.md
            §3): this is where someone setting up or reviewing a budget meets it. */}
        {incomeBaseline.irregular && (
          <Card style={styles.safeIncome}>
            <Icon name="shield" size={17} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <View style={styles.eyebrowRow}>
                <Body weight={700}>Safe monthly income RM {fmt(incomeBaseline.baseline)}</Body>
                <InfoButton entry="safe_income" />
              </View>
              <Label weight={500} color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>
                Your months range RM {fmt(incomeBaseline.low)} to RM {fmt(incomeBaseline.high)}. Plan
                against the floor, not the average.
              </Label>
            </View>
          </Card>
        )}

        {/* Ask Pip */}
        <Card style={[styles.adviceCard, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
          <View style={styles.adviceHead}>
            <Pip size={34} expr="idle" />
            <Body weight={700} color={theme.onTint}>Pip's budget tip</Body>
          </View>
          {advice ? <Body weight={500}>{advice}</Body> : <Caption color={colorTheme.ink2}>Tap for a quick take on your plan.</Caption>}
          {adviceErr ? <Caption color={STATUS_COLOR.over}>{adviceErr}</Caption> : null}
          <Pressable onPress={askPip} style={[styles.askBtn, { backgroundColor: colorTheme.surface, borderColor: theme.accentSoft }]} disabled={adviceBusy}>
            {adviceBusy ? <ActivityIndicator size="small" color={theme.accent} /> : (
              <>
                <Icon name="sparkles" size={15} color={theme.accent} />
                <Label weight={700} color={theme.accent}>{advice ? 'Refresh' : 'Ask Pip'}</Label>
              </>
            )}
          </Pressable>
        </Card>

        {/* per-category. Kept directly under the summary: "how is this month going" is the
            screen's core job, and the benchmark and habit cards below are the deeper read. */}
        <Eyebrow style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>This month · {monthName()}</Eyebrow>
        <BudgetProgressList allocations={allocations} spentByCat={spentByCat} catById={catById} />

        <BenchmarkCard
          benchmark={benchmark}
          gaps={gaps}
          onChangeHousehold={() => setPickingHousehold(true)}
        />

        <SavingsHabitCard
          habit={habit}
          guideSuggestion={benchmark.savings}
          onSetTarget={(amount) => void setSavingsTarget(amount)}
        />

        <Pressable
          onPress={onOpenRecap}
          style={({ pressed }) => [
            styles.recapLink,
            { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Icon name="trending" size={18} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Body weight={700}>Monthly recap</Body>
            <Label weight={500} color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>See how each month stacked up against target.</Label>
          </View>
          <Icon name="chevronRight" size={17} color={colorTheme.ink3} />
        </Pressable>

        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton onPress={() => setEditing(true)} height={50}>
            <Icon name="pencil" size={17} color="#fff" />
            <BtnLabel>Edit budget</BtnLabel>
          </PrimaryButton>
        </View>
      </ScrollView>

      <BenchmarkPicker
        visible={pickingHousehold}
        profile={householdProfile}
        city={guideCity}
        onClose={() => setPickingHousehold(false)}
        onSave={(p, c) => {
          void setBenchmarkProfile(p, c);
          setPickingHousehold(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  safeIncome: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, marginTop: spacing.md },
  adviceCard: { padding: spacing.base, marginTop: spacing.md },
  adviceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  askBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1 },
  recapLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, padding: spacing.base, borderRadius: 16, borderWidth: 1 },
});
