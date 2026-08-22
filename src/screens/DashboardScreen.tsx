import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { BudgetProgressList, STATUS_COLOR } from '../components/BudgetProgressList';
import { FadeIn } from '../components/Motion';
import { Icon, type IconName } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { PieChart } from '../components/PieChart';
import { Pip } from '../components/Pip';
import { Body, BtnLabel, Caption, Card, Display, Eyebrow, Label, PrimaryButton, Title } from '../components/ui';
import { catColorsForHue } from '../lib/catColors';
import { allocatedTotal, currentMonthKey, txnMonthKey } from '../lib/budget';
import { daysLeftInMonth, greeting, longDate, monthName } from '../lib/dates';
import { fmt, fmtCompact } from '../lib/format';
import { netWorth, netWorthSeries } from '../lib/networth';
import { lastActiveDay } from '../lib/streak';
import { AGING_DAYS, daysBetween } from '../lib/split';
import * as haptics from '../lib/haptics';
import type { Category } from '../lib/types';
import { useAppData, type HeroPanel } from '../state/store';
import { useNow } from '../state/useNow';
import { useReducedMotion } from '../state/useReducedMotion';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { shadowCard, spacing } from '../theme';
import { duration as motionDuration } from '../theme/motion';

const fallback: Category = { id: 'other', label: 'Other', icon: 'dots', hue: 220, kind: 'expense', isDefault: true };

/** Days of inactivity before the header mascot goes `sleepy` (docs/ui-engagement-plan.md
 *  Step 3). Matches the streak's own grace window (1 day) plus a few more so this fires only
 *  once a lapse is real, not on the day a streak would still forgive. */
const SLEEPY_LAPSED_DAYS = 4;

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function DashboardScreen({
  onScan,
  onOpenAll,
  onOpenBreakdown,
  onOpenBudget = () => {},
  onOpenCategory = () => {},
  onOpenRecap = () => {},
  onOpenNetWorth = () => {},
  onOpenOwed = () => {},
  onOpenCommitments = () => {},
  onOpenCalendar = () => {},
}: {
  onScan: () => void;
  onOpenAll: () => void;
  onOpenBreakdown: () => void;
  onOpenBudget?: () => void;
  /** Tapping a category row on the budget card (not "Manage"). */
  onOpenCategory?: (id: string) => void;
  onOpenRecap?: () => void;
  onOpenNetWorth?: () => void;
  onOpenOwed?: () => void;
  onOpenCommitments?: () => void;
  /** Opens the activity calendar (CalendarScreen), defaulted to the current month, so the
   *  streak card's tap target has somewhere real to go. */
  onOpenCalendar?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const now = useNow();
  const {
    transactions,
    catById,
    allocations,
    hasBudget,
    accounts,
    accountValues,
    balanceEntries,
    openShares,
    commitmentOccurrences,
    streak,
    streakWeek,
    streakTodayIndex,
    streakFreezeAvailable,
    streakGraduated,
    streakStartLabel,
    streakPaused,
    streakCelebrationToken,
  } = useAppData();
  const nw = useMemo(() => netWorth(accounts, accountValues), [accounts, accountValues]);
  const netWorthTrend = useMemo(
    () => netWorthSeries(accounts, balanceEntries, lastMonths(6)).map((p) => p.net),
    [accounts, balanceEntries]
  );

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

  // A returning user who has gone quiet, not a first-run empty state  the header mascot goes
  // sleepy rather than judging the gap (docs/ui-engagement-plan.md §1: reward looking, never
  // the state of the finances; a lapse in *logging* is fair game, a lapse in *spending* is not).
  const sleepy = useMemo(() => {
    if (empty) return false;
    const last = lastActiveDay(transactions, now);
    if (last === null) return false;
    const today = Math.floor(now.getTime() / 86_400_000);
    return today - last >= SLEEPY_LAPSED_DAYS;
  }, [empty, transactions, now]);

  // A save just extended the streak (docs/ui-engagement-plan.md Step 4/§2.1): a one-shot fire
  // burst over the streak card, plus the haptic payoff. Compares against the token's *last seen*
  // value rather than treating it as a boolean, so a second continuation while the burst from the
  // first is still playing is still noticed (the effect just restarts the timer).
  const [celebrating, setCelebrating] = useState(false);
  const seenCelebrationToken = useRef(streakCelebrationToken);
  useEffect(() => {
    if (streakCelebrationToken === seenCelebrationToken.current) return;
    seenCelebrationToken.current = streakCelebrationToken;
    setCelebrating(true);
    haptics.payoff();
  }, [streakCelebrationToken]);

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
              {sleepy ? <Pip size={36} expr="sleepy" /> : <Pip size={40} expr="idle" float />}
            </View>
          </View>
        </View>

        {empty ? (
          <EmptyState />
        ) : (
          <>
            {/* 1 — Streak, kept at the top: the habit loop is the first thing a returning user
                checks, before the money. Tapping it opens the full activity calendar. */}
            <View style={styles.streakWrap}>
              <StreakCard
                streak={streak}
                week={streakWeek}
                todayIndex={streakTodayIndex}
                freezeAvailable={streakFreezeAvailable}
                graduated={streakGraduated}
                startLabel={streakStartLabel}
                paused={streakPaused}
                onPress={onOpenCalendar}
              />
              {celebrating && <StreakCelebration onDone={() => setCelebrating(false)} />}
            </View>

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
              netWorthTrend={netWorthTrend}
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
                  <BudgetProgressList
                    allocations={allocations}
                    spentByCat={spentByCat}
                    catById={catById}
                    onPressCategory={onOpenCategory}
                  />
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

/* ── Streak card (docs/ui-engagement-plan.md Step 4) ──
   Monday-first 7-dot strip: which days this week already have a logged transaction. The flame +
   streak number are the accomplishment signal; the dots are the weekly, always-winnable loop
   underneath it (§2.6 of that document) closing and resetting each Monday, same as the freeze
   and graduation logic that governs the number itself. Tapping the card opens the full activity
   calendar (CalendarScreen) so "which days did I actually log" has a real answer, not just a
   week's worth of dots. */
function StreakCard({
  streak,
  week,
  todayIndex,
  freezeAvailable,
  graduated,
  startLabel,
  paused,
  onPress,
}: {
  streak: number;
  week: boolean[];
  todayIndex: number;
  freezeAvailable: boolean;
  graduated: boolean;
  startLabel: string | null;
  paused: boolean;
  onPress?: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  // Flame flicker — three layers (outer body, mid tongue, hot core) animate on independent
  // loops so the flame reads as an organic flicker rather than one rigid shape bobbing up and
  // down. All native-driver transforms (rotate/scale/translate), no per-frame JS.
  const flickerOuter = useRef(new Animated.Value(0)).current;
  const flickerMid = useRef(new Animated.Value(0)).current;
  const flickerCore = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      flickerOuter.setValue(0);
      flickerMid.setValue(0);
      flickerCore.setValue(0);
      return;
    }
    const loopOuter = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerOuter, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flickerOuter, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const loopMid = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerMid, { toValue: 1, duration: 820, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flickerMid, { toValue: 0, duration: 940, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const loopCore = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerCore, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flickerCore, { toValue: 0, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loopOuter.start();
    loopMid.start();
    loopCore.start();
    return () => {
      loopOuter.stop();
      loopMid.stop();
      loopCore.stop();
    };
  }, [flickerOuter, flickerMid, flickerCore, reducedMotion]);
  const outerFlameStyle = {
    opacity: flickerOuter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
    transform: [
      { translateY: flickerOuter.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
      { translateX: flickerOuter.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) },
      { rotate: flickerOuter.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) },
      { scaleY: flickerOuter.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
    ],
  };
  const midFlameStyle = {
    transform: [
      { translateY: flickerMid.interpolate({ inputRange: [0, 1], outputRange: [0, -1.6] }) },
      { translateX: flickerMid.interpolate({ inputRange: [0, 1], outputRange: [0, -0.6] }) },
      { rotate: flickerMid.interpolate({ inputRange: [0, 1], outputRange: ['2deg', '-2deg'] }) },
      { scaleX: flickerMid.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
      { scaleY: flickerMid.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  };
  const coreFlameStyle = {
    transform: [
      { translateY: flickerCore.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
      { translateX: flickerCore.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }) },
      { scale: flickerCore.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
    ],
  };

  const card = (
    <Card style={styles.streakCard}>
      {freezeAvailable && (
        <View style={[styles.streakShield, { backgroundColor: colorTheme.surface }]} accessibilityLabel="A streak freeze is banked for this month">
          <Icon name="shield" size={11} color={theme.accent} />
        </View>
      )}
      <View style={styles.streakLeft}>
        <View style={styles.flameTile}>
          <View style={{ width: 26, height: 32 }}>
            <Animated.View style={[StyleSheet.absoluteFill, outerFlameStyle]}>
              <Svg width={26} height={32} viewBox="0 0 18 22" fill="none">
                <Path d="M9 1C9 1 14.5 6.5 14.5 11.5C14.5 15 12 17.5 9 17.5C6 17.5 3.5 15 3.5 11.5C3.5 8.5 5.5 6.5 5.5 6.5C5.5 6.5 6 9.5 9 9.5C9 9.5 7.5 7.5 9 4C9.5 5.5 11.5 7.5 11.5 9.5C13 8 12.5 5.5 11 3.5C14 5.5 15.5 8.5 15.5 11.5C15.5 16.5 12.5 20.5 9 21.5C5.5 20.5 2.5 16.5 2.5 11.5C2.5 5.5 9 1 9 1Z" fill={colorTheme.amber} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, midFlameStyle]}>
              <Svg width={26} height={32} viewBox="0 0 18 22" fill="none">
                <Ellipse cx={9} cy={13.5} rx={3.2} ry={5.2} fill="#f2901e" />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, coreFlameStyle]}>
              <Svg width={26} height={32} viewBox="0 0 18 22" fill="none">
                <Ellipse cx={9} cy={15} rx={1.8} ry={3.2} fill="#fac438" />
                <Ellipse cx={9} cy={16.5} rx={0.9} ry={1.6} fill="#fff2c4" />
              </Svg>
            </Animated.View>
          </View>
        </View>
        <View>
          {graduated && startLabel ? (
            <>
              <Label weight={700}>{startLabel}</Label>
              <Caption color={colorTheme.ink2}>{paused ? 'Paused' : `${streak}-day run`}</Caption>
            </>
          ) : (
            <>
              <Title numeric>{streak}</Title>
              <Caption color={colorTheme.ink2}>{paused ? 'Paused' : 'day streak'}</Caption>
            </>
          )}
        </View>
      </View>
      <View style={[styles.streakDivider, { backgroundColor: colorTheme.line }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.dotsRow}>
          {week.map((done, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                done
                  ? [styles.dotDone, { backgroundColor: theme.accent }]
                  : i === todayIndex
                    ? [styles.dotToday, { backgroundColor: theme.accentSoft }]
                    : [styles.dotTodo, { borderColor: colorTheme.ink3 }],
              ]}
            >
              {done && (
                <Svg width={10} height={8} viewBox="0 0 10 8" fill="none">
                  <Path d="M1 4l2.8 3L9 1" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open your activity calendar">
      {card}
    </Pressable>
  );
}

const EMBER_COUNT = 5;

/**
 * One-shot fire burst over the streak card the moment a save extends the streak
 * (docs/ui-engagement-plan.md §2.1: the animation is the app visibly *noticing* the moment,
 * which is the largest documented lever in the research this app's engagement plan is built on).
 * Pip pops to `happy` and a handful of embers rise past the flame and fade. No sound (not
 * available yet  see haptics.payoff() at the call site for the felt half of the reward
 * instead); this is the hook a real streak-continue chime would attach to once one exists.
 *
 * Mount-driven and self-contained: renders `null` immediately under reduced motion (a one-shot
 * burst still respects that setting even though it isn't a loop), and calls `onDone` either way
 * so the parent can unmount it after `motionDuration.celebrate` plus enough tail for the last
 * ember to finish.
 */
function StreakCelebration({ onDone }: { onDone: () => void }) {
  const colorTheme = useThemeColors();
  const reducedMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const embers = useRef(Array.from({ length: EMBER_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (reducedMotion) {
      onDone();
      return;
    }
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
    const emberAnims = embers.map((e, i) =>
      Animated.timing(e, {
        toValue: 1,
        duration: motionDuration.celebrate + i * 70,
        delay: 90 + i * 45,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    Animated.parallel(emberAnims).start();
    const tailMs = motionDuration.celebrate + EMBER_COUNT * 70 + 250;
    const timer = setTimeout(onDone, tailMs);
    return () => clearTimeout(timer);
    // Intentionally mount-only: this component is remounted (via the `celebrating` boolean at
    // the call site) for every new burst rather than re-triggered by a prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reducedMotion) return null;

  return (
    <View pointerEvents="none" style={styles.celebrationWrap}>
      {embers.map((e, i) => {
        const spread = (i - (EMBER_COUNT - 1) / 2) * 9;
        return (
          <Animated.View
            key={i}
            style={[
              styles.ember,
              { backgroundColor: i % 2 === 0 ? colorTheme.amber : '#FAC438' },
              {
                opacity: e.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateY: e.interpolate({ inputRange: [0, 1], outputRange: [0, -46 - i * 5] }) },
                  { translateX: e.interpolate({ inputRange: [0, 1], outputRange: [0, spread] }) },
                  { scale: e.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.15] }) },
                ],
              },
            ]}
          />
        );
      })}
      <Animated.View
        style={{
          opacity: pop,
          transform: [
            { scale: pop },
            { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [8, -10] }) },
          ],
        }}
      >
        <Pip size={44} expr="happy" />
      </Animated.View>
    </View>
  );
}

/**
 * React Native Web's `pagingEnabled` sets `scroll-snap-type: x mandatory` on the scroller and
 * `scroll-snap-align: start` on a wrapper it auto-generates around each direct child, but never
 * `scroll-snap-stop`  so the browser is free to skip snap points under a fast swipe, and a
 * normal trackpad flick sails from the first panel straight to the last, skipping the ones in
 * between. `always` forces a stop at every panel regardless of swipe speed.
 *
 * That auto-generated wrapper isn't reachable through props (RNW creates it internally, one
 * level above whatever we render), so this reaches it imperatively through the DOM once our own
 * node mounts. Native has no such property and no such wrapper, so this is a no-op there.
 */
function pinWebScrollSnapStop(node: unknown) {
  if (Platform.OS !== 'web' || !node) return;
  const el = node as HTMLElement;
  const wrapper = el.parentElement;
  if (wrapper) wrapper.style.setProperty('scroll-snap-stop', 'always');
}

/** Which panels the hero carousel offers. `left` (budget remaining) only appears once a
 *  budget exists — swiping to it before that would show a number with no meaning yet. */
function heroPanels(hasBudget: boolean): HeroPanel[] {
  return hasBudget ? ['cashflow', 'spent', 'left', 'networth'] : ['cashflow', 'spent', 'networth'];
}

/** Adaptive default panel when the user hasn't pinned one. No income on record yet:
 *  spending is a fact, never a verdict, so lead with that. Income known but no budget:
 *  net cash flow. A budget exists: what's left, which is what a user with a plan actually
 *  wants to know first. */
function adaptivePanel(hasAnyIncome: boolean, hasBudget: boolean): HeroPanel {
  if (hasBudget) return 'left';
  if (hasAnyIncome) return 'cashflow';
  return 'spent';
}

/* ── Summary card: a swipeable hero carousel (Net cash flow / Total spent / Left to spend /
   Net worth). ── */
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
  netWorthTrend,
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
  netWorthTrend: number[];
  onOpenNetWorth: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const panels = useMemo(() => heroPanels(hasBudget), [hasBudget]);
  const defaultPanel = useMemo(
    () => adaptivePanel(hasAnyIncome, hasBudget),
    [hasAnyIncome, hasBudget]
  );

  const [cardWidth, setCardWidth] = useState(0);
  const [index, setIndex] = useState(Math.max(0, panels.indexOf(defaultPanel)));
  const scrollRef = useRef<ScrollView>(null);
  const measureRef = useRef<View>(null);
  const didInitialScroll = useRef(false);

  // `onLayout` alone (React Native Web's ResizeObserver-based implementation) can miss the
  // first paint if the surface isn't yet compositing, so also measure directly on mount.
  useEffect(() => {
    measureRef.current?.measure((_x, _y, width) => {
      if (width > 0) setCardWidth(width);
    });
  }, []);

  // Jump to the default panel once the card has measured and on every default change
  // (e.g. a budget just got created and `left` became available).
  useEffect(() => {
    if (!cardWidth) return;
    const target = Math.max(0, panels.indexOf(defaultPanel));
    scrollRef.current?.scrollTo({ x: target * cardWidth, animated: didInitialScroll.current });
    setIndex(target);
    didInitialScroll.current = true;
  }, [cardWidth, defaultPanel, panels]);

  const currentPanel = panels[index] ?? panels[0];

  return (
    <Card style={styles.cashCard}>
      <View ref={measureRef} onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
      {cardWidth > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
            setIndex(Math.min(panels.length - 1, Math.max(0, i)));
          }}
        >
          {panels.map((panel) => (
            <View key={panel} ref={pinWebScrollSnapStop} style={{ width: cardWidth }}>
              {panel === 'networth' ? (
                <NetWorthView net={netWorthValue} assets={assets} liabilities={liabilities} trend={netWorthTrend} onSeeAll={onOpenNetWorth} />
              ) : (
                <CashFlowView
                  panel={panel}
                  net={net}
                  received={received}
                  spent={spent}
                  budgetLeft={budgetLeft}
                  breakdown={breakdown}
                  catById={catById}
                  onSeeAll={onSeeAll}
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {panels.length > 1 && (
        <View style={styles.heroDotsRow}>
          {panels.map((panel, i) => (
            <View
              key={panel}
              style={[styles.heroDot, { backgroundColor: i === index ? theme.accent : colorTheme.line2 }]}
            />
          ))}
        </View>
      )}
      </View>
    </Card>
  );
}

function CashFlowView({
  panel,
  net,
  received,
  spent,
  budgetLeft,
  breakdown,
  catById,
  onSeeAll,
}: {
  panel: Exclude<HeroPanel, 'networth'>;
  net: number;
  received: number;
  spent: number;
  budgetLeft: number;
  breakdown: { catId: string; amt: number }[];
  catById: Record<string, Category>;
  onSeeAll: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();

  const pieData = useMemo(
    () => breakdown.map((b) => ({ value: b.amt, color: catColorsForHue((catById[b.catId] ?? fallback).hue).solid })),
    [breakdown, catById]
  );
  const topCat = breakdown.length > 0 ? (catById[breakdown[0].catId] ?? fallback) : null;
  const topPct = topCat && spent > 0 ? Math.round((breakdown[0].amt / spent) * 100) : 0;

  const eyebrow = panel === 'spent' ? 'Spent this month' : panel === 'cashflow' ? `Net cash flow · ${monthName()}` : 'Left to spend';
  const caption =
    panel === 'spent'
      ? 'Total expenses this month'
      : panel === 'cashflow'
        ? 'Income − Expenses · this month'
        : `${daysLeftInMonth()} days left in ${monthName()}`;
  const heroValue = panel === 'spent' ? spent : panel === 'cashflow' ? net : budgetLeft;
  const heroNegative = heroValue < 0;
  const heroAmount = `RM ${fmtCompact(Math.abs(heroValue))}`;

  // Cash flow and spent both get a signed, colored treatment so either reads at a glance
  // without reading the caption underneath: cash flow uses accounting parentheses, spent a
  // leading sign, since it's the more literal "money in vs money out" figure. Left to spend
  // keeps its plainer look (red only once over budget) — otherwise it'd read identically to
  // one of the other two rather than standing apart from both.
  let heroColor = colorTheme.ink;
  let heroText = heroAmount;
  if (panel === 'cashflow') {
    heroColor = heroNegative ? colorTheme.red : STATUS_COLOR.ok;
    heroText = heroNegative ? `(${heroAmount})` : heroAmount;
  } else if (panel === 'spent') {
    heroColor = heroNegative ? colorTheme.red : STATUS_COLOR.ok;
    heroText = `${heroNegative ? '−' : '+'}${heroAmount}`;
  } else if (heroNegative) {
    heroColor = colorTheme.red;
    heroText = `−${heroAmount}`;
  }

  return (
    <>
      <View style={styles.cashTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <InfoButton entry={panel === 'cashflow' ? 'net_cash_flow' : panel === 'left' ? 'unallocated' : 'net_cash_flow'} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs }}>
            <Display numeric color={heroColor} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.55}>{heroText}</Display>
          </View>
          <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>{caption}</Caption>
        </View>
        {panel === 'cashflow' && (
          <View style={[styles.incomeBadge, { backgroundColor: theme.accentSoft }]}>
            <Label numeric color={theme.onTint}>{`RM ${fmt(received)}`}</Label>
            <Caption color={colorTheme.ink2}>income</Caption>
          </View>
        )}
      </View>

      {breakdown.length > 0 && topCat && (
        <>
          <View style={[styles.cashDivider, { backgroundColor: colorTheme.line }]} />
          <Pressable onPress={onSeeAll} hitSlop={8} style={styles.breakdownRow}>
            <PieChart data={pieData} size={56} thickness={11} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label weight={500} numberOfLines={1}>{`${topCat.label} · ${topPct}%`}</Label>
              <Caption color={colorTheme.ink2} style={{ marginTop: 2 }}>Biggest this month</Caption>
            </View>
            <Icon name="chevronRight" size={16} color={colorTheme.ink3} />
          </Pressable>
        </>
      )}
    </>
  );
}

function NetWorthView({
  net,
  assets,
  liabilities,
  trend,
  onSeeAll,
}: {
  net: number;
  assets: number;
  liabilities: number;
  trend: number[];
  onSeeAll: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const pos = net >= 0;
  const delta = trend.length >= 2 ? net - trend[trend.length - 2] : null;
  const deltaUp = (delta ?? 0) >= 0;
  const trendColor = delta === null ? colorTheme.ink3 : deltaUp ? theme.accent : colorTheme.red;

  return (
    <>
      <View style={styles.cashTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Eyebrow>Net worth</Eyebrow>
            <InfoButton entry="net_worth" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs }}>
            <Display
              numeric
              color={pos ? colorTheme.ink : colorTheme.red}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.55}
              style={styles.netWorthAmount}
            >
              {`${pos ? '' : '−'}RM ${fmtCompact(Math.abs(net))}`}
            </Display>
          </View>
          <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>Assets − Liabilities · today</Caption>
        </View>
        <View style={[styles.incomeBadge, { backgroundColor: theme.accentSoft }]}>
          <Label numeric color={theme.onTint}>{`RM ${fmt(assets)}`}</Label>
          <Caption color={colorTheme.ink2}>assets</Caption>
        </View>
      </View>

      {trend.length >= 2 && (
        <>
          <View style={[styles.cashDivider, { backgroundColor: colorTheme.line }]} />
          {/* A sparkline in the same slot the other panels use for their pie chart, so all
              three panels read as one visual family: chart thumbnail + one-line takeaway. */}
          <Pressable onPress={onSeeAll} hitSlop={8} style={styles.breakdownRow}>
            <NetWorthSparkline values={trend} color={trendColor} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label weight={500} numberOfLines={1}>
                {delta === null ? '6-month trend' : `${deltaUp ? '+' : '−'}RM ${fmt(Math.abs(delta))} vs last month`}
              </Label>
              <Caption color={colorTheme.ink2} style={{ marginTop: 2 }}>6-month trend</Caption>
            </View>
            <Icon name="chevronRight" size={16} color={colorTheme.ink3} />
          </Pressable>
        </>
      )}
    </>
  );
}

function NetWorthSparkline({ values, color }: { values: number[]; color: string }) {
  const W = 56;
  const H = 56;
  const pd = 6;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rng = mx - mn || 1;
  const pts = values.map((v, i) => [pd + (i / (values.length - 1)) * (W - pd * 2), pd + (1 - (v - mn) / rng) * (H - pd * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </Svg>
  );
}

function EmptyState() {
  const colorTheme = useThemeColors();
  return (
    <Card style={{ marginHorizontal: spacing.base, marginTop: spacing.sm, padding: 24, alignItems: 'center' }}>
      <Pip size={88} nerdy float propellerHat />
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
  streakShield: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    ...shadowCard,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 23, height: 23, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dotDone: {},
  dotToday: {},
  dotTodo: { borderWidth: 2, borderStyle: 'dashed' },

  /* streak celebration burst */
  streakWrap: { position: 'relative' },
  celebrationWrap: {
    position: 'absolute',
    top: -18,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  ember: { position: 'absolute', bottom: 20, width: 7, height: 7, borderRadius: 4 },

  /* summary hero carousel */
  heroDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  heroDot: { width: 6, height: 6, borderRadius: 3 },

  /* cash flow */
  cashCard: { marginHorizontal: spacing.base, marginTop: spacing.md, padding: spacing.base },
  cashTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  incomeBadge: { borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  cashDivider: { height: 1, marginVertical: spacing.md },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  netWorthAmount: { textDecorationLine: 'underline' },

  /* generic cta */
  budgetCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.base },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
