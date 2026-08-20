import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BudgetProgressList } from '../components/BudgetProgressList';
import { CoinMascot } from '../components/CoinMascot';
import { FadeIn } from '../components/Motion';
import { Icon, type IconName } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { Pip } from '../components/Pip';
import { Body, BtnLabel, Caption, Card, Display, Eyebrow, Label, PrimaryButton, Title } from '../components/ui';
import { catColorsForHue } from '../lib/catColors';
import { allocatedTotal, currentMonthKey, txnMonthKey } from '../lib/budget';
import { daysLeftInMonth, greeting, longDate, monthName } from '../lib/dates';
import { fmt } from '../lib/format';
import { netWorth } from '../lib/networth';
import { computeStreak, compute7DayDots } from '../lib/streak';
import { AGING_DAYS, daysBetween } from '../lib/split';
import type { Category } from '../lib/types';
import { useAppData } from '../state/store';
import { useNow } from '../state/useNow';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { shadowCard, shadowToggle, spacing } from '../theme';

const fallback: Category = { id: 'other', label: 'Other', icon: 'dots', hue: 220, kind: 'expense', isDefault: true };

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function DashboardScreen({
  onScan,
  onOpenAll,
  onOpenBreakdown,
  onOpenBudget = () => {},
  onOpenRecap = () => {},
  onOpenNetWorth = () => {},
  onOpenOwed = () => {},
  onOpenCommitments = () => {},
}: {
  onScan: () => void;
  onOpenAll: () => void;
  onOpenBreakdown: () => void;
  onOpenBudget?: () => void;
  onOpenRecap?: () => void;
  onOpenNetWorth?: () => void;
  onOpenOwed?: () => void;
  onOpenCommitments?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const now = useNow();
  const { transactions, catById, allocations, hasBudget, coverage, accounts, accountValues, openShares, commitmentOccurrences } = useAppData();
  const nw = useMemo(() => netWorth(accounts, accountValues), [accounts, accountValues]);

  const monthTxns = useMemo(() => {
    const cur = currentMonthKey();
    return transactions.filter((t) => txnMonthKey(t) === cur);
  }, [transactions]);
  const monthExpenses = useMemo(() => monthTxns.filter((t) => t.type === 'expense'), [monthTxns]);
  const spent = useMemo(() => monthExpenses.reduce((s, t) => s + t.amount, 0), [monthExpenses]);
  const received = useMemo(
    () => monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthTxns]
  );
  const net = received - spent;
  const hasAnyIncome = useMemo(() => transactions.some((t) => t.type === 'income'), [transactions]);
  const budgetLeft = useMemo(() => allocatedTotal(allocations) - spent, [allocations, spent]);

  const spentByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of monthExpenses) m[t.categoryId ?? 'other'] = (m[t.categoryId ?? 'other'] ?? 0) + t.amount;
    return m;
  }, [monthExpenses]);

  const breakdown = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const t of monthExpenses) {
      const id = t.categoryId ?? 'other';
      byCat[id] = (byCat[id] ?? 0) + t.amount;
    }
    return Object.entries(byCat)
      .map(([catId, amt]) => ({ catId, amt }))
      .sort((a, b) => b.amt - a.amt);
  }, [monthExpenses]);

  // A debt this old has stopped being a favour and started being a thing you have to chase, so
  // the "needs you" row switches from a neutral total to naming who is sitting on it.
  const owed = useMemo(() => {
    const today = dayKey(new Date());
    let oldestDays = 0;
    let oldestName = '';
    for (const share of openShares) {
      const age = daysBetween(share.billDate, today) ?? 0;
      if (age > oldestDays) {
        oldestDays = age;
        oldestName = share.personName;
      }
    }
    return {
      total: openShares.reduce((s, x) => s + x.outstanding, 0),
      count: openShares.length,
      oldestDays,
      oldestName,
      overdue: oldestDays >= AGING_DAYS,
    };
  }, [openShares]);

  // Anything still unpaid: overdue rows regardless of month, plus this month's scheduled ones.
  const commitmentsDue = useMemo(() => {
    const cur = currentMonthKey();
    const today = dayKey(new Date());
    const unpaid = commitmentOccurrences.filter(
      (o) => o.status === 'scheduled' && (o.dueDate < today || o.month === cur)
    );
    return {
      count: unpaid.length,
      total: unpaid.reduce((s, o) => s + o.amount, 0),
      overdue: unpaid.some((o) => o.dueDate < today),
    };
  }, [commitmentOccurrences]);

  // One slot, priority-ordered, so at most one thing is ever asking for attention at a time:
  // an overdue commitment outranks an aged debt outranks a due-but-not-overdue commitment
  // outranks an open (not yet aged) debt.
  const needsYou = useMemo(() => {
    if (commitmentsDue.overdue) {
      return {
        icon: 'clock' as IconName,
        title: `${commitmentsDue.count} ${commitmentsDue.count === 1 ? 'bill' : 'bills'} · RM ${fmt(commitmentsDue.total)}`,
        sub: 'Something is overdue. Tap to catch up.',
        onPress: onOpenCommitments,
      };
    }
    if (owed.overdue) {
      return {
        icon: 'gift' as IconName,
        title: `RM ${fmt(owed.total)} owed to you`,
        sub: `${owed.oldestName} has owed you for ${owed.oldestDays} days. Worth a nudge.`,
        onPress: onOpenOwed,
      };
    }
    if (commitmentsDue.count > 0) {
      return {
        icon: 'clock' as IconName,
        title: `${commitmentsDue.count} ${commitmentsDue.count === 1 ? 'bill' : 'bills'} · RM ${fmt(commitmentsDue.total)}`,
        sub: 'Due this month. Tap to tick off.',
        onPress: onOpenCommitments,
      };
    }
    if (owed.total > 0) {
      return {
        icon: 'gift' as IconName,
        title: `RM ${fmt(owed.total)} owed to you`,
        sub: `From ${owed.count} shared ${owed.count === 1 ? 'bill' : 'bills'}. Tap to settle up.`,
        onPress: onOpenOwed,
      };
    }
    return null;
  }, [commitmentsDue, owed, onOpenCommitments, onOpenOwed]);

  const empty = transactions.length === 0;
  const streak = useMemo(() => computeStreak(transactions), [transactions]);

  // Last-7-day activity tracker for the streak card.
  const dots = useMemo(() => compute7DayDots(transactions), [transactions]);

  return (
    <FadeIn style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      {/* Bottom padding clears the bottom nav's raised Add button, which overhangs the bar. */}
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 40 /* spacing-audit-ignore: tab-bar clearance, not rhythm */ }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Caption color={colorTheme.ink2} style={{ marginBottom: spacing.xs }}>{longDate(now)}</Caption>
            <Title>{greeting(now)}</Title>
          </View>
          <View style={styles.headerActions}>
            <HeaderIcon name="trending" onPress={onOpenRecap} />
            <View style={[styles.pipBubble, { backgroundColor: theme.accentTint }]}>
              <CoinMascot size={40} float />
            </View>
          </View>
        </View>

        {empty ? (
          <EmptyState />
        ) : (
          <>
            {/* 1 — Streak, kept at the top: the habit loop is the first thing a returning user
                checks, before the money. */}
            <StreakCard streak={streak} dots={dots} coverage={coverage.daysCovered} />

            {/* 2 — Money: a segmented Cash flow / Net worth card, same as before. The Cash flow
                side's headline number is adaptive rather than fixed (see CashFlowView) so a
                first-run or pre-payday user is never greeted by a red negative. */}
            <SummaryCard
              net={net}
              received={received}
              spent={spent}
              budgetLeft={budgetLeft}
              hasAnyIncome={hasAnyIncome}
              hasBudget={hasBudget}
              breakdown={breakdown}
              catById={catById}
              onSeeAll={onOpenBreakdown}
              netWorthValue={nw.net}
              assets={nw.assets}
              liabilities={nw.liabilities}
              onOpenNetWorth={onOpenNetWorth}
            />

            {/* 3 — Needs you: at most one row. Today up to three independent cards could all
                render at once (owed / commitments / safe income); this picks the single most
                urgent thing instead of stacking all of them. */}
            {needsYou && (
              <Pressable
                onPress={needsYou.onPress}
                style={({ pressed }) => [styles.needsRow, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft, opacity: pressed ? 0.9 : 1 }]}
                accessibilityRole="button"
              >
                <Icon name={needsYou.icon} size={17} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Label>{needsYou.title}</Label>
                  <Caption color={colorTheme.ink2} style={{ marginTop: 4 }}>{needsYou.sub}</Caption>
                </View>
                <Icon name="chevronRight" size={16} color={colorTheme.ink3} />
              </Pressable>
            )}

            {/* This month budget */}
            <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.md }}>
              {hasBudget ? (
                <>
                  <View style={styles.sectionHead}>
                    <Eyebrow>This month · {monthName()}</Eyebrow>
                    <Pressable onPress={onOpenBudget} hitSlop={8}>
                      <Label weight={700} color={theme.accent}>Manage</Label>
                    </Pressable>
                  </View>
                  <Pressable onPress={onOpenBudget} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
                    <BudgetProgressList allocations={allocations} spentByCat={spentByCat} catById={catById} />
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={onOpenBudget} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
                  <Card style={styles.budgetCta}>
                    <View style={[styles.ctaIcon, { backgroundColor: theme.accentTint }]}>
                      <Icon name="wallet" size={22} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body weight={700}>Set a monthly budget</Body>
                      <Label weight={500} color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>Plan income and allocate spend per category.</Label>
                    </View>
                    <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                  </Card>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Empty state: nothing to explore yet, so the one thing to do gets a full-width CTA on
            top of the bottom-nav button. */}
        {empty && (
          <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.md }}>
            <PrimaryButton onPress={onScan} height={54}>
              <Icon name="plus" size={21} color="#fff" stroke={2.4} />
              <BtnLabel>Add your first transaction</BtnLabel>
              <Icon name="sparkles" size={16} color="#fff" />
            </PrimaryButton>
          </View>
        )}
      </ScrollView>
    </FadeIn>
  );
}

/* ── header utility icon ── */
function HeaderIcon({ name, onPress }: { name: IconName; onPress: () => void }) {
  const colorTheme = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.headerIcon, { backgroundColor: colorTheme.surface }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Icon name={name} size={17} color={colorTheme.ink2} />
    </Pressable>
  );
}

/* ── Streak card ── */
function StreakCard({ streak, dots, coverage, onPress }: { streak: number; dots: boolean[]; coverage: number; onPress?: () => void }) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  // Subtle flame flicker — driven entirely on the native thread (no per-frame JS).
  const flicker = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flicker]);
  const flameStyle = {
    opacity: flicker.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
    transform: [
      { translateY: flicker.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2] }) },
      { scaleX: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
      { scaleY: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) },
    ],
  };
  const card = (
    <Card style={styles.streakCard}>
      <View style={styles.streakLeft}>
        <View style={styles.flameTile}>
          <Animated.View style={flameStyle}>
            <Svg width={18} height={21} viewBox="0 0 18 22" fill="none">
              <Path d="M9 1C9 1 14.5 6.5 14.5 11.5C14.5 15 12 17.5 9 17.5C6 17.5 3.5 15 3.5 11.5C3.5 8.5 5.5 6.5 5.5 6.5C5.5 6.5 6 9.5 9 9.5C9 9.5 7.5 7.5 9 4C9.5 5.5 11.5 7.5 11.5 9.5C13 8 12.5 5.5 11 3.5C14 5.5 15.5 8.5 15.5 11.5C15.5 16.5 12.5 20.5 9 21.5C5.5 20.5 2.5 16.5 2.5 11.5C2.5 5.5 9 1 9 1Z" fill={colorTheme.amber} />
              <Path d="M9 13.5C9 13.5 11 12 11 10.5C10.5 11.5 9 11.5 9 11.5C9 11.5 9.5 10 9 9C8.5 10 7 11.5 7 12.5C7 13.6 7.9 14.5 9 14.5C8.7 14 9 13.5 9 13.5Z" fill="#FAC438" />
            </Svg>
          </Animated.View>
        </View>
        <View>
          <Title numeric>{streak}</Title>
          <Caption color={colorTheme.ink2}>day streak</Caption>
        </View>
      </View>
      <View style={[styles.streakDivider, { backgroundColor: colorTheme.line }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.dotsRow}>
          {dots.map((done, i) => (
            <View key={i} style={[styles.dot, done ? [styles.dotDone, { backgroundColor: theme.accent }] : [styles.dotTodo, { borderColor: colorTheme.ink3 }]]}>
              {done && (
                <Svg width={10} height={8} viewBox="0 0 10 8" fill="none">
                  <Path d="M1 4l2.8 3L9 1" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </View>
          ))}
        </View>
        <Caption color={colorTheme.ink2} style={styles.streakBest}>
          Covered <Caption numeric color={colorTheme.ink2}>{coverage}/90 days</Caption>
        </Caption>
      </View>
    </Card>
  );
  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open the coach's coverage lever">
      {card}
    </Pressable>
  );
}

/* ── Summary card: toggles between Net worth (default) and Cash flow ── */
type SummaryView = 'networth' | 'cashflow';

function SummaryCard({
  net,
  received,
  spent,
  budgetLeft,
  hasAnyIncome,
  hasBudget,
  breakdown,
  catById,
  onSeeAll,
  netWorthValue,
  assets,
  liabilities,
  onOpenNetWorth,
}: {
  net: number;
  received: number;
  spent: number;
  budgetLeft: number;
  hasAnyIncome: boolean;
  hasBudget: boolean;
  breakdown: { catId: string; amt: number }[];
  catById: Record<string, Category>;
  onSeeAll: () => void;
  netWorthValue: number;
  assets: number;
  liabilities: number;
  onOpenNetWorth: () => void;
}) {
  const [view, setView] = useState<SummaryView>('cashflow');
  const colorTheme = useThemeColors();
  return (
    <Card style={styles.cashCard}>
      {/* segmented toggle */}
      <View style={[styles.segTrack, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
        {(['cashflow', 'networth'] as SummaryView[]).map((v) => {
          const on = view === v;
          return (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[styles.segBtn, on && [styles.segBtnOn, { backgroundColor: colorTheme.surface }]]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Label color={on ? colorTheme.ink : colorTheme.ink2}>{v === 'networth' ? 'Net worth' : 'Cash flow'}</Label>
            </Pressable>
          );
        })}
      </View>

      {view === 'networth' ? (
        <NetWorthView net={netWorthValue} assets={assets} liabilities={liabilities} onSeeAll={onOpenNetWorth} />
      ) : (
        <CashFlowView
          net={net}
          received={received}
          spent={spent}
          budgetLeft={budgetLeft}
          hasAnyIncome={hasAnyIncome}
          hasBudget={hasBudget}
          breakdown={breakdown}
          catById={catById}
          onSeeAll={onSeeAll}
        />
      )}
    </Card>
  );
}

/** Which rung of the adaptive hero to show. No income on record yet: spending is a fact,
 *  never a verdict, so it is the only rung that is never styled red. Income known but no
 *  budget: net cash flow. A budget exists: what's left, which is what a user with a plan
 *  actually wants to know. */
type HeroRung = 'spent' | 'cashflow' | 'left';

function heroRung(hasAnyIncome: boolean, hasBudget: boolean): HeroRung {
  if (hasBudget) return 'left';
  if (hasAnyIncome) return 'cashflow';
  return 'spent';
}

function CashFlowView({
  net,
  received,
  spent,
  budgetLeft,
  hasAnyIncome,
  hasBudget,
  breakdown,
  catById,
  onSeeAll,
}: {
  net: number;
  received: number;
  spent: number;
  budgetLeft: number;
  hasAnyIncome: boolean;
  hasBudget: boolean;
  breakdown: { catId: string; amt: number }[];
  catById: Record<string, Category>;
  onSeeAll: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const rung = heroRung(hasAnyIncome, hasBudget);

  const eyebrow = rung === 'spent' ? 'Spent this month' : rung === 'cashflow' ? `Net cash flow · ${monthName()}` : 'Left to spend';
  const caption =
    rung === 'spent'
      ? 'No income logged yet'
      : rung === 'cashflow'
        ? 'Income − Expenses · this month'
        : `${daysLeftInMonth()} days left in ${monthName()}`;
  const heroValue = rung === 'spent' ? spent : rung === 'cashflow' ? net : budgetLeft;
  // Spending is never styled as a failure — it's the only rung shown before Pip knows enough
  // for a negative number to mean something actionable.
  const heroNegative = rung !== 'spent' && heroValue < 0;
  const heroColor = heroNegative ? colorTheme.red : colorTheme.ink;

  return (
    <>
      <View style={styles.cashTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <InfoButton entry={rung === 'cashflow' ? 'net_cash_flow' : rung === 'left' ? 'unallocated' : 'net_cash_flow'} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs }}>
            {heroNegative && <Display numeric color={colorTheme.red} >−</Display>}
            <Display numeric color={heroColor}>{`RM ${fmt(Math.abs(heroValue))}`}</Display>
          </View>
          <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>{caption}</Caption>
        </View>
        {rung === 'cashflow' && (
          <View style={[styles.incomeBadge, { backgroundColor: theme.accentSoft }]}>
            <Label numeric color={theme.onTint}>{`RM ${fmt(received)}`}</Label>
            <Caption color={colorTheme.ink2}>income</Caption>
          </View>
        )}
      </View>

      {breakdown.length > 0 && (
        <>
          <View style={[styles.cashDivider, { backgroundColor: colorTheme.line }]} />
          <View style={styles.sectionHead}>
            <View style={styles.eyebrowRow}>
              <Eyebrow>Where it goes</Eyebrow>
              <InfoButton entry="where_it_goes" />
            </View>
            <Pressable onPress={onSeeAll} hitSlop={8}>
              <Label weight={700} color={theme.accent}>See all →</Label>
            </Pressable>
          </View>
          {breakdown.slice(0, 3).map((b) => {
            const cat = catById[b.catId] ?? fallback;
            const col = catColorsForHue(cat.hue);
            const pct = spent > 0 ? Math.round((b.amt / spent) * 100) : 0;
            return (
              <View key={b.catId} style={styles.spendRow}>
                <View style={[styles.spendIcon, { backgroundColor: col.bg }]}>
                  <Icon name={cat.icon as IconName} size={16} color={col.fg} stroke={1.9} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.spendLabelRow}>
                    <Label weight={500} numberOfLines={1}>{cat.label}</Label>
                    <Label numeric>{`RM ${fmt(b.amt)}`}</Label>
                  </View>
                  <View style={[styles.spendTrack, { backgroundColor: colorTheme.line }]}>
                    <View style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: col.solid }} />
                  </View>
                </View>
                <Caption numeric color={colorTheme.ink2} style={{ width: 28, textAlign: 'right' }}>{pct}%</Caption>
              </View>
            );
          })}
        </>
      )}
    </>
  );
}

function NetWorthView({
  net,
  assets,
  liabilities,
  onSeeAll,
}: {
  net: number;
  assets: number;
  liabilities: number;
  onSeeAll: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const pos = net >= 0;
  const maxV = Math.max(assets, liabilities, 1);
  const rows: { label: string; amt: number; icon: IconName; color: string }[] = [
    { label: 'Assets', amt: assets, icon: 'trending', color: theme.accent },
    { label: 'Liabilities', amt: liabilities, icon: 'scale', color: colorTheme.red },
  ];
  return (
    <>
      <View style={styles.cashTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Eyebrow>Net worth</Eyebrow>
            <InfoButton entry="net_worth" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs }}>
            {!pos && <Display numeric color={colorTheme.red} >−</Display>}
            <Display numeric color={pos ? colorTheme.ink : colorTheme.red}>{`RM ${fmt(Math.abs(net))}`}</Display>
          </View>
          <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>Assets − Liabilities · today</Caption>
        </View>
        <View style={[styles.incomeBadge, { backgroundColor: theme.accentSoft }]}>
          <Label numeric color={theme.onTint}>{`RM ${fmt(assets)}`}</Label>
          <Caption color={colorTheme.ink2}>assets</Caption>
        </View>
      </View>

      <View style={[styles.cashDivider, { backgroundColor: colorTheme.line }]} />
      <View style={styles.sectionHead}>
        <View style={styles.eyebrowRow}>
          <Eyebrow>Balance sheet</Eyebrow>
        </View>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Label weight={700} color={theme.accent}>See all →</Label>
        </Pressable>
      </View>
      {rows.map((r) => {
        const pct = Math.round((r.amt / maxV) * 100);
        return (
          <View key={r.label} style={styles.spendRow}>
            <View style={[styles.spendIcon, { backgroundColor: r.color + '1f' }]}>
              <Icon name={r.icon} size={16} color={r.color} stroke={1.9} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.spendLabelRow}>
                <Label weight={500} numberOfLines={1}>{r.label}</Label>
                <Label numeric>{`RM ${fmt(r.amt)}`}</Label>
              </View>
              <View style={[styles.spendTrack, { backgroundColor: colorTheme.line }]}>
                <View style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: r.color }} />
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

function EmptyState() {
  const colorTheme = useThemeColors();
  return (
    <Card style={{ marginHorizontal: spacing.base, marginTop: spacing.sm, padding: 24, alignItems: 'center' }}>
      <Pip size={88} expr="curious" float />
      <Title style={{ marginTop: spacing.md }}>No spending yet</Title>
      <Body color={colorTheme.ink2} style={{ textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 }}>
        Tap <Body weight={700}>Add</Body> to scan one receipt, or a whole statement at once. I’ll read the lines and you file them.
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingTop: spacing.xs, paddingBottom: spacing.md },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', ...shadowCard },
  pipBubble: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  /* needs-you: the single consolidated attention row */
  needsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.base, marginTop: spacing.md, padding: spacing.md, borderRadius: 16, borderWidth: 1 },

  /* streak */
  streakCard: { marginHorizontal: spacing.base, marginTop: spacing.xs, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flameTile: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(217,138,0,0.10)', alignItems: 'center', justifyContent: 'center' },
  streakDivider: { width: 1, height: 38 },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  dot: { width: 23, height: 23, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dotDone: {},
  dotTodo: { borderWidth: 2, borderStyle: 'dashed' },
  streakBest: { textAlign: 'right' },

  /* summary toggle */
  segTrack: { flexDirection: 'row', borderRadius: 999, padding: spacing.xs, marginBottom: spacing.base, borderWidth: 1 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: 999 },
  segBtnOn: { ...shadowToggle },

  /* cash flow */
  cashCard: { marginHorizontal: spacing.base, marginTop: spacing.md, padding: spacing.base },
  cashTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  incomeBadge: { borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  cashDivider: { height: 1, marginVertical: spacing.md },
  spendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  spendIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  spendLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs },
  spendTrack: { height: 4, borderRadius: 4, overflow: 'hidden' },

  /* generic cta */
  budgetCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.base },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
