// src/screens/NetWorthScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { CalcBadge } from '../components/CalcBadge';
import { CurrencyChip } from '../components/CurrencyChip';
import { InstitutionBadge } from '../components/InstitutionBadge';
import { BrandBadge } from '../components/BrandBadge';
import { matchBrand, matchCrypto } from '../components/BrandLogo';
import { InstitutionField } from '../components/InstitutionField';
import { BalanceScanScreen } from './BalanceScanScreen';
import { ScanBalanceButton } from '../components/ScanBalanceButton';
import { TickerSearchModal } from '../components/TickerSearchModal';
import { InfoButton } from '../components/InfoButton';
import { BtnLabel, Card, Eyebrow, PrimaryButton, type ValueMode } from '../components/ui';
import { getActiveCurrencies, getEntryCurrency, refreshFxRates } from '../db/currencyRepo';
import { listFxRates } from '../db/fxRepo';
import { shortDate } from '../lib/dates';
import { BASE_CURRENCY, isMultiCurrency, round2 } from '../lib/currency';
import { cleanCalcInput, evaluateExpression } from '../lib/calc';
import { decimalsFor } from '../lib/currencies';
import { currencyPrefix, fmt, fmtMoney, formatCurrencyBreakdown } from '../lib/format';
import { rateFor, ratesFromCache, isStale, staleLabel } from '../lib/fx';
import { matchInstitution } from '../lib/institutions';
import { tap } from '../lib/haptics';
import { confirmAction } from '../lib/platformAlert';
import {
  CLASS_BY_ID,
  classesFor,
  groupByClass,
  netWorth,
  netWorthSeries,
  nativeAccountTotalsByCurrency,
  toMyrValues,
  type ClassGroup,
} from '../lib/networth';
import { useDisplayCurrency, type DisplayCurrency } from '../state/useDisplayCurrency';
import { groupHoldings, holdingProfit, isHolding, subFromType, toQuantityUnitPrice, typeFromSub, type HoldingGroup, type TickerResult } from '../lib/prices';
import { todayISO } from '../lib/duplicates';
import { searchInvestments } from '../prices';
import type { Account, AccountKind, PriceQuote } from '../lib/types';
import { useAppData } from '../state/store';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useLanguage } from '../i18n';
import { numFont, platformShadow, radius, shadowCard, shadowToggle, uiFont } from '../theme';

const RED2 = '#c5402f';
function timeOf(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const RED = '#c5402f';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const fmtPx = (n: number): string => (n >= 1000 ? fmt(n) : String(Math.round(n * 100) / 100));

function formatClassLabel(cls: string, isZh: boolean, fallbackLabel: string): string {
  if (!isZh) return fallbackLabel;
  switch (cls) {
    case 'cash': return '现金与银行';
    case 'bank': return '银行账户';
    case 'investments': return '投资资产';
    case 'illiquid': return '非流动资产';
    case 'credit': return '信用卡';
    case 'loans': return '借贷债务';
    default: return fallbackLabel;
  }
}

/**
 * The quiet "≈ SGD x, rate 12 Aug" hint under an account whose own currency differs from the
 * one totals are shown in. It reads the display currency rather than always MYR: the whole
 * point of the hint is to tell the user what this balance is worth in the money the rest of
 * the screen is denominated in, which is `dc.code`, not necessarily ringgit.
 */
function fxSubtitle(currency: string, myrValue: number, fxAsOf: Record<string, string>, dc: DisplayCurrency): string {
  const asOf = fxAsOf[currency];
  const stale = asOf && isStale(asOf) ? `, ${staleLabel(asOf)}` : '';
  return `≈ ${fmtMoney(dc.convert(myrValue), dc.code)}${stale}`;
}

/** Ticker badge style + label by holding sub-type (and Bursa vs US for stocks). */
function badgeFor(sub: string, symbol: string): { bg: string; clr: string; lbl: string } {
  if (sub === 'crypto') return { bg: '#f0f0ff', clr: '#4a4ad8', lbl: 'Crypto' };
  if (sub === 'commodity') return { bg: '#fdf6e8', clr: '#7a6200', lbl: 'Gold' };
  return symbol.endsWith('.KL') ? { bg: '#eff7f4', clr: '#1c6b48', lbl: 'BM' } : { bg: '#fff8ee', clr: '#b86a00', lbl: 'US' };
}

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function NetWorthScreen({ onBack, onOpenHistory }: { onBack: () => void; onOpenHistory: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t, isZh } = useLanguage();
  const { accounts, balanceEntries, accountValues, prices, pricesAsOf, refreshPrices } = useAppData();
  const [adding, setAdding] = useState(false);
  const [presetCoin, setPresetCoin] = useState<TickerResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupSymbol, setGroupSymbol] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [profitMode, setProfitMode] = useState<ValueMode>('amount');
  // Cached FX rates (code → MYR rate) and each rate's own cache timestamp (code → asOf), for
  // converting native account balances into MYR and showing a staleness hint. Loaded once on
  // mount; empty until then, so a MYR-only user's screen renders exactly as before this load
  // resolves (`toMyrValues`/`netWorthSeries` both default a missing rate to "MYR only").
  const [rates, setRates] = useState<Record<string, number>>({});
  const [fxAsOf, setFxAsOf] = useState<Record<string, string>>({});

  const hasHoldings = useMemo(() => accounts.some(isHolding), [accounts]);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      if (hasHoldings) await refreshPrices();
      else await refreshFxRates().catch(() => {});
      const fx = await listFxRates();
      setRates(ratesFromCache(fx));
      setFxAsOf(Object.fromEntries(fx.map((r) => [r.code, r.asOf])));
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh prices when the screen opens (if there are holdings to price).
  useEffect(() => {
    if (hasHoldings) refreshPrices().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHoldings]);

  useEffect(() => {
    refreshFxRates().catch(() => {}).then(listFxRates).then((fx) => {
      setRates(ratesFromCache(fx));
      setFxAsOf(Object.fromEntries(fx.map((r) => [r.code, r.asOf])));
    });
  }, []);

  const dc = useDisplayCurrency();
  const nativeTotals = useMemo(
    () => nativeAccountTotalsByCurrency(accounts, accountValues),
    [accounts, accountValues]
  );

  // Native balances (accountValues) converted to MYR for every total/grouping; an account
  // with no cached rate is excluded rather than counted at parity (see toMyrValues).
  const { valueById: myrValues, unconvertible } = useMemo(
    () => toMyrValues(accounts, accountValues, rates),
    [accounts, accountValues, rates]
  );
  const nw = useMemo(() => netWorth(accounts, myrValues), [accounts, myrValues]);
  const groups = useMemo(() => groupByClass(accounts, myrValues), [accounts, myrValues]);
  const series = useMemo(
    () => netWorthSeries(accounts, balanceEntries, lastMonths(6), rates).map((p) => p.net),
    [accounts, balanceEntries, rates]
  );
  const editing = editingId ? accounts.find((a) => a.id === editingId) ?? null : null;
  const groupLots = useMemo(
    () => (groupSymbol ? accounts.filter((a) => isHolding(a) && a.symbol === groupSymbol) : []),
    [groupSymbol, accounts]
  );

  const empty = accounts.length === 0;
  const monthShorts = useMemo(
    () => lastMonths(6).map((k) => (isZh ? MONTHS_ZH : MONTHS_SHORT)[parseInt(k.slice(5, 7), 10) - 1]),
    [isZh]
  );
  const delta = series.length >= 2 ? nw.net - series[series.length - 2] : null;
  const prevMonth = monthShorts[monthShorts.length - 2] ?? '';

  // Safe to branch here  all hooks above have run unconditionally.
  if (scanning) {
    return <BalanceScanScreen onClose={() => setScanning(false)} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      {/* Nav */}
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={onBack} style={[styles.navBtn, { backgroundColor: colorTheme.surface }]} hitSlop={6}>
          <Icon name="chevronLeft" size={18} color={colorTheme.ink2} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colorTheme.ink }]}>{t('netWorthTitle')}</Text>
        {/* invisible spacer keeps the title centered opposite the back button */}
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          hasHoldings ? <RefreshControl refreshing={refreshing} onRefresh={doRefresh} tintColor={theme.accent} /> : undefined
        }
      >
        <HeroCard
          nw={nw}
          series={series}
          months={monthShorts}
          delta={delta}
          prevMonth={prevMonth}
          mode={profitMode}
          setMode={setProfitMode}
          onOpenHistory={onOpenHistory}
          dc={dc}
          breakdown={formatCurrencyBreakdown(nativeTotals)}
        />
        <ScanRow onScan={() => setScanning(true)} onAdd={() => { setPresetCoin(null); setAdding(true); }} />

        {empty && (
          <Card style={{ padding: 22, alignItems: 'center', margin: 16 }}>
            <Icon name="scale" size={40} color={theme.accent} />
            <Text style={[styles.emptyTitle, { color: colorTheme.ink }]}>
              {isZh ? '追踪您的资产与负债' : 'Track what you own and owe'}
            </Text>
            <Text style={[styles.emptySub, { color: colorTheme.ink2 }]}>
              {isZh ? '添加现金、投资和负债，随时查看您的净资产变化。' : 'Add cash, investments, and loans to see your net worth grow over time.'}
            </Text>
          </Card>
        )}

        {/* Assets */}
        {groups.assets.length > 0 && <GroupHeader label={t('assets')} total={nw.assets} color={theme.accent} dc={dc} />}
        {groups.assets.map((g) => (
          <AssetClassCard
            key={g.cls}
            g={g}
            accountValues={accountValues}
            prices={prices}
            pricesAsOf={pricesAsOf}
            profitMode={profitMode}
            refreshing={refreshing}
            onRefresh={doRefresh}
            onTapManual={setEditingId}
            onTapGroup={setGroupSymbol}
            unconvertible={unconvertible}
            fxAsOf={fxAsOf}
            dc={dc}
          />
        ))}

        {/* Liabilities */}
        {groups.liabilities.length > 0 && <GroupHeader label={t('liabilities')} total={nw.liabilities} color={colorTheme.red} dc={dc} />}
        {groups.liabilities.length > 0 && (
          <View style={[styles.classCard, { backgroundColor: colorTheme.surface }]}>
            {flattenLiabs(groups.liabilities).map((row, i, arr) => (
              <LiabilityRowD
                key={row.account.id}
                name={row.account.name}
                cls={formatClassLabel(row.account.cls, isZh, row.clsLabel)}
                nativeValue={accountValues[row.account.id] ?? 0}
                myrValue={row.value}
                currency={row.account.currency}
                unconvertible={unconvertible.includes(row.account.id)}
                fxAsOf={fxAsOf}
                dc={dc}
                customIcon={row.account.icon}
                isLast={i === arr.length - 1}
                onPress={() => setEditingId(row.account.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AddAccountModal visible={adding} preset={presetCoin} onClose={() => { setAdding(false); setPresetCoin(null); }} />
      <AccountSheet account={editing} dc={dc} onClose={() => setEditingId(null)} />
      <HoldingGroupSheet
        lots={groupLots}
        accountValues={accountValues}
        prices={prices}
        profitMode={profitMode}
        dc={dc}
        onClose={() => setGroupSymbol(null)}
        onEditLot={(id) => { setGroupSymbol(null); setEditingId(id); }}
        onAddMore={(coin) => { setGroupSymbol(null); setPresetCoin(coin); setAdding(true); }}
      />
    </View>
  );
}

function HeroCard({
  nw,
  series,
  months,
  delta,
  prevMonth,
  mode,
  setMode,
  onOpenHistory,
  dc,
  breakdown,
}: {
  nw: { net: number; assets: number; liabilities: number };
  series: number[];
  months: string[];
  delta: number | null;
  prevMonth: string;
  mode: ValueMode;
  setMode: (m: ValueMode) => void;
  onOpenHistory: () => void;
  dc: DisplayCurrency;
  breakdown: string;
}) {
  const theme = useAccent();
  const { isZh } = useLanguage();
  const deltaUp = (delta ?? 0) >= 0;
  const prevNet = series.length >= 2 ? series[series.length - 2] : 0;
  const pct = prevNet !== 0 ? (delta ?? 0) / Math.abs(prevNet) * 100 : 0;
  const pctAbs = Math.abs(pct);
  const deltaColor = deltaUp ? '#42e893' : '#ff8a7a';
  const deltaValText = mode === 'percent'
    ? `${pctAbs.toFixed(1)}%`
    : fmtMoney(dc.convert(Math.abs(delta ?? 0)), dc.code);

  return (
    <Pressable onPress={onOpenHistory} style={styles.hero} accessibilityRole="button" accessibilityLabel="View net worth history">
      {/* gradient fill */}
      <Svg width="100%" height="100%" style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <Defs>
          <LinearGradient id="nwHero" x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor="#25845e" />
            <Stop offset="0.52" stopColor="#1b6b48" />
            <Stop offset="1" stopColor="#0e3d27" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#nwHero)" />
      </Svg>
      <View style={[styles.heroCircle, { pointerEvents: 'none' }]} />

      <View style={styles.heroHead}>
        <Text style={styles.heroLabel}>{isZh ? '净资产 · 6个月' : 'Net Worth · 6-month'}</Text>
        <View style={styles.heroToggle}>
          {(['amount', 'percent'] as ValueMode[]).map((m) => {
            const on = mode === m;
            return (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.heroToggleBtn, on && styles.heroToggleBtnOn]}>
                <Text style={[styles.heroToggleText, on && [styles.heroToggleTextOn, { color: theme.accentInk }]]}>{m === 'amount' ? currencyPrefix(dc.code) : '%'}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 9 }}>
        <Text style={styles.heroSign}>{nw.net < 0 ? '−' : ''}</Text>
        <Text style={styles.heroNum}>{fmtMoney(dc.convert(Math.abs(nw.net)), dc.code)}</Text>
      </View>

      {delta !== null && (
        <View style={styles.deltaChip}>
          <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
            <Path
              d={deltaUp ? 'M6 10V2M6 2L3 5M6 2L9 5' : 'M6 2v8M6 10L3 7M6 10L9 7'}
              stroke={deltaColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={[styles.deltaText, { color: deltaColor }]}>
            {deltaUp ? '+' : '−'}{deltaValText} {isZh ? `比 ${prevMonth}` : `vs ${prevMonth}`}
          </Text>
        </View>
      )}

      <View style={styles.heroTiles}>
        <View style={styles.heroTile}>
          <Text style={styles.heroTileLabel}>{isZh ? '总资产' : 'Total assets'}</Text>
          <Text style={[styles.heroTileVal, { color: '#42e893' }]}>{fmtMoney(dc.convert(nw.assets), dc.code)}</Text>
        </View>
        <View style={styles.heroTile}>
          <Text style={styles.heroTileLabel}>{isZh ? '总负债' : 'Total liabilities'}</Text>
          <Text style={[styles.heroTileVal, { color: '#ff8a80' }]}>{fmtMoney(dc.convert(nw.liabilities), dc.code)}</Text>
        </View>
      </View>

      {breakdown.length > 0 && (
        <Text style={styles.heroBreakdown}>{breakdown}</Text>
      )}

      {series.length >= 2 && (
        <>
          <HeroSparkline values={series} />
          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            {months.map((m, i) => (
              <Text key={i} style={styles.heroMonth}>{m}</Text>
            ))}
          </View>
        </>
      )}
    </Pressable>
  );
}

function HeroSparkline({ values }: { values: number[] }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const H = 50;
  const pdY = 6;
  if (values.length < 2) return null;

  const W = layoutWidth || 320;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rng = mx - mn;
  const n = values.length;

  const pts: [number, number][] = values.map((v, i) => {
    const x = ((i + 0.5) / n) * W;
    const y = rng === 0 ? H / 2 : pdY + (1 - (v - mn) / rng) * (H - pdY * 2);
    return [x, y];
  });

  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const first = pts[0];
  const area = `${line} L ${last[0].toFixed(1)} ${H} L ${first[0].toFixed(1)} ${H} Z`;

  return (
    <View
      style={{ width: '100%', height: H }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== layoutWidth) setLayoutWidth(w);
      }}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }}>
        <Defs>
          <LinearGradient id="nwSpk" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0.0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#nwSpk)" />
        <Path d={line} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last[0]} cy={last[1]} r={4} fill="white" />
      </Svg>
    </View>
  );
}

// ── Scan / add row ──────────────────────────────────────────────────────────
function ScanRow({ onScan, onAdd }: { onScan: () => void; onAdd: () => void }) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t } = useLanguage();
  return (
    <View style={styles.scanRow}>
      <Pressable
        onPress={onScan}
        style={[styles.scanBanner, { backgroundColor: theme.accentInk, ...platformShadow(theme.accent, 0.3, 14, { width: 0, height: 4 }, 3) }]}
      >
        <View style={styles.scanIcon}>
          <Icon name="scan" size={16} color="#fff" />
        </View>
        <View>
          <Text style={styles.scanTitle}>{t('scanBalance')}</Text>
          <Text style={styles.scanSub}>{t('scanBalanceSub')}</Text>
        </View>
      </Pressable>
      <Pressable onPress={onAdd} style={[styles.addBtn, { borderColor: colorTheme.line, backgroundColor: colorTheme.surface }]}>
        <Icon name="plus" size={18} color={theme.accent} stroke={2.4} />
      </Pressable>
    </View>
  );
}

// ── Group / class labels ────────────────────────────────────────────────────
function GroupHeader({ label, total, color, dc }: { label: string; total: number; color: string; dc: DisplayCurrency }) {
  const colorTheme = useThemeColors();
  return (
    <View style={styles.groupHead}>
      <Text style={[styles.groupLabel, { color: colorTheme.ink2 }]}>{label}</Text>
      <Text style={[styles.groupTotal, { color }]}>{fmtMoney(dc.convert(total), dc.code)}</Text>
    </View>
  );
}

function ClassChip({ label, sub }: { label: string; sub: string }) {
  const colorTheme = useThemeColors();
  return (
    <View style={styles.classChipRow}>
      <Text style={[styles.classChipLabel, { color: colorTheme.ink2 }]}>{label}</Text>
      <Text style={[styles.classChipSub, { color: colorTheme.ink2 }]}>{sub}</Text>
    </View>
  );
}

function PriceStamp({ asOf, refreshing, onRefresh }: { asOf: string | null; refreshing: boolean; onRefresh: () => void }) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  return (
    <View style={[styles.priceStamp, { borderBottomColor: colorTheme.line, backgroundColor: colorTheme.surface2 }]}>
      <View style={styles.liveDot} />
      <Text style={[styles.priceStampText, { color: colorTheme.ink2 }]}>
        {isZh ? `今日行情截至 ${timeOf(asOf) || ''}` : `Prices as of ${timeOf(asOf) || ''} today`}
      </Text>
      <Pressable onPress={onRefresh} style={[styles.refreshBtn, { backgroundColor: theme.accentTint }]} hitSlop={6}>
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Text style={[styles.refreshText, { color: theme.accent }]}>{isZh ? '↻ 刷新' : '↻ Refresh'}</Text>
        )}
      </Pressable>
    </View>
  );
}

// ── Asset class card (cash / investments / etc.) ────────────────────────────
function AssetClassCard({
  g,
  accountValues,
  prices,
  pricesAsOf,
  profitMode,
  refreshing,
  onRefresh,
  onTapManual,
  onTapGroup,
  unconvertible,
  fxAsOf,
  dc,
}: {
  g: ClassGroup;
  accountValues: Record<string, number>;
  prices: Record<string, PriceQuote>;
  pricesAsOf: string | null;
  profitMode: ValueMode;
  refreshing: boolean;
  onRefresh: () => void;
  onTapManual: (id: string) => void;
  onTapGroup: (symbol: string) => void;
  unconvertible: string[];
  fxAsOf: Record<string, string>;
  dc: DisplayCurrency;
}) {
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const holdings = g.accounts.filter((x) => isHolding(x.account)).map((x) => x.account);
  const manual = g.accounts.filter((x) => !isHolding(x.account));
  const hGroups = groupHoldings(holdings, accountValues);
  const hasH = hGroups.length > 0;
  const icon = (CLASS_BY_ID[g.cls]?.icon ?? 'wallet') as IconName;
  const localizedLabel = formatClassLabel(g.cls, isZh, g.label);
  return (
    <>
      <ClassChip label={hasH ? `${localizedLabel} · ${isZh ? '实时行情' : 'Live prices'}` : localizedLabel} sub={fmtMoney(dc.convert(g.total), dc.code)} />
      <View style={[styles.classCard, { backgroundColor: colorTheme.surface }]}>
        {hasH && <PriceStamp asOf={pricesAsOf} refreshing={refreshing} onRefresh={onRefresh} />}
        {hGroups.map((grp, i) => {
          const profit = grp.cost != null && grp.cost > 0 ? holdingProfit(grp.value, grp.cost) : null;
          const isLast = i === hGroups.length - 1 && manual.length === 0;
          return (
            <HoldingRowD key={grp.symbol} grp={grp} price={prices[grp.symbol]} profit={profit} profitMode={profitMode} isLast={isLast} dc={dc} onPress={() => onTapGroup(grp.symbol)} />
          );
        })}
        {manual.map(({ account, value }, i) => (
          <ManualRowD
            key={account.id}
            icon={icon}
            customIcon={account.icon}
            name={account.name}
            sub={localizedLabel}
            nativeValue={accountValues[account.id] ?? 0}
            myrValue={value}
            currency={account.currency}
            interestRate={account.interestRate}
            cost={account.cost}
            cls={account.cls}
            unconvertible={unconvertible.includes(account.id)}
            fxAsOf={fxAsOf}
            dc={dc}
            isLast={i === manual.length - 1}
            onPress={() => onTapManual(account.id)}
          />
        ))}
      </View>
    </>
  );
}

function ManualRowD({
  icon,
  name,
  sub,
  nativeValue,
  myrValue,
  currency,
  interestRate,
  cost,
  cls,
  unconvertible,
  fxAsOf,
  dc,
  isLast,
  onPress,
  customIcon,
}: {
  icon: IconName;
  name: string;
  sub: string;
  nativeValue: number;
  myrValue: number;
  currency: string;
  interestRate?: number | null;
  cost?: number | null;
  cls?: string;
  unconvertible: boolean;
  fxAsOf: Record<string, string>;
  dc: DisplayCurrency;
  isLast: boolean;
  onPress: () => void;
  customIcon?: string | null;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const inst = matchInstitution(name);
  const brand = inst ? (matchBrand(inst.id) || matchBrand(inst.name)) : matchBrand(name);
  const isCustomImage = customIcon && (
    customIcon.startsWith('data:') ||
    customIcon.startsWith('file:') ||
    customIcon.startsWith('content:') ||
    customIcon.startsWith('http') ||
    customIcon.startsWith('/')
  );
  // The "≈" hint is worth showing whenever the row's own currency differs from the one the
  // totals above it are denominated in — not just when it differs from ringgit. A user
  // reading in SGD needs the SGD equivalent of a ringgit account just as much as the
  // reverse, and an SGD account under an SGD display currency needs no hint at all.
  const foreign = currency !== dc.code;
  const subText = useMemo(() => {
    if (cls === 'illiquid') {
      const parts: string[] = [];
      if (cost != null && cost > 0) {
        const diff = nativeValue - cost;
        const pct = Math.round((diff / cost) * 1000) / 10;
        const sign = diff >= 0 ? '+' : '−';
        parts.push(isZh ? `${sign}${Math.abs(pct)}% 较成本` : `${sign}${Math.abs(pct)}% vs cost`);
      }
      if (interestRate != null) {
        if (interestRate > 0) {
          parts.push(isZh ? `+${interestRate}%/年 预估增值` : `+${interestRate}%/yr ETA`);
        } else if (interestRate < 0) {
          parts.push(isZh ? `−${Math.abs(interestRate)}%/年 预估折旧` : `−${Math.abs(interestRate)}%/yr dep.`);
        } else {
          parts.push(isZh ? '0%/年' : '0%/yr');
        }
      }
      if (parts.length > 0) return parts.join(' · ');
      return sub;
    }
    return interestRate != null ? `${sub} · ${interestRate}% APR` : sub;
  }, [cls, cost, nativeValue, interestRate, isZh, sub]);
  return (
    <Pressable onPress={onPress} style={[styles.row, !isLast && [styles.rowDivider, { borderBottomColor: colorTheme.line }]]}>
      {brand ? (
        <BrandBadge brand={brand} size={36} rad={11} />
      ) : inst ? (
        <InstitutionBadge inst={inst} size={36} />
      ) : isCustomImage ? (
        <View style={[styles.rowTile, { backgroundColor: theme.accentTint, overflow: 'hidden' }]}>
          <Image source={{ uri: customIcon }} style={{ width: 36, height: 36 }} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.rowTile, { backgroundColor: theme.accentTint }]}>
          <Icon name={icon} size={16} color={theme.accent} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowName, { color: colorTheme.ink }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.rowSub, { color: colorTheme.ink2 }]} numberOfLines={1}>{subText}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.rowVal, { color: colorTheme.ink }]}>{fmtMoney(nativeValue, currency)}</Text>
        {foreign && (
          <Text style={[styles.rowFx, { color: colorTheme.ink3 }]} numberOfLines={1}>
            {unconvertible ? 'rate unavailable' : fxSubtitle(currency, myrValue, fxAsOf, dc)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function HoldingRowD({
  grp,
  price,
  profit,
  profitMode,
  isLast,
  dc,
  onPress,
}: {
  grp: HoldingGroup;
  price?: PriceQuote;
  profit: { profit: number; pct: number | null } | null;
  profitMode: ValueMode;
  isLast: boolean;
  dc: DisplayCurrency;
  onPress: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const badge = badgeFor(grp.sub, grp.symbol);
  const cryptoBrand = grp.sub === 'crypto' ? matchCrypto(grp.symbol) || matchCrypto(grp.ticker) || matchCrypto(grp.name) : null;
  const unitPx = price ? toQuantityUnitPrice(grp.symbol, price.priceMYR) : null;
  const ch = price?.change24 ?? null;
  const chUp = (ch ?? 0) >= 0;
  const up = (profit?.profit ?? 0) >= 0;
  const tick = grp.sub === 'commodity' ? (grp.symbol.startsWith('SI') ? 'XAG' : 'XAU') : grp.ticker;
  return (
    <Pressable onPress={onPress} style={[styles.row, !isLast && [styles.rowDivider, { borderBottomColor: colorTheme.line }]]}>
      {cryptoBrand ? (
        <BrandBadge brand={cryptoBrand} size={38} rad={11} />
      ) : (
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeTick, { color: badge.clr }]} numberOfLines={1}>{tick}</Text>
          <Text style={[styles.badgeLbl, { color: badge.clr }]}>{badge.lbl}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowName, { color: colorTheme.ink }]} numberOfLines={1}>{grp.name}</Text>
        <View style={styles.holdMetaRow}>
          <Text style={[styles.holdMeta, { color: colorTheme.ink2 }]} numberOfLines={1}>
            {grp.quantity} {unitPx != null ? `× ${currencyPrefix(dc.code)} ${fmtPx(dc.convert(unitPx))}` : grp.ticker}
          </Text>
          {ch != null && (
            <Text style={[styles.chChip, { color: chUp ? '#1a9962' : colorTheme.red, backgroundColor: chUp ? theme.accentTint : '#fff0ef' }]}>
              {chUp ? '+' : ''}{ch.toFixed(2)}%
            </Text>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.rowVal, { color: colorTheme.ink }]}>{fmtMoney(dc.convert(grp.value), dc.code)}</Text>
        {profit && (
          <Text style={[styles.rowProfit, { color: up ? theme.accent : colorTheme.red }]}>
            {up ? '+' : '−'}
            {profitMode === 'percent' && profit.pct != null
              ? `${Math.abs(profit.pct).toFixed(1)}%`
              : fmtMoney(dc.convert(Math.abs(profit.profit)), dc.code)}
          </Text>
        )}
      </View>
      <Icon name="chevronRight" size={15} color={colorTheme.ink3} />
    </Pressable>
  );
}

function LiabilityRowD({
  name,
  cls,
  nativeValue,
  myrValue,
  currency,
  unconvertible,
  fxAsOf,
  dc,
  isLast,
  onPress,
  customIcon,
}: {
  name: string;
  cls: string;
  nativeValue: number;
  myrValue: number;
  currency: string;
  unconvertible: boolean;
  fxAsOf: Record<string, string>;
  dc: DisplayCurrency;
  isLast: boolean;
  onPress: () => void;
  customIcon?: string | null;
}) {
  const colorTheme = useThemeColors();
  const inst = matchInstitution(name);
  const brand = inst ? (matchBrand(inst.id) || matchBrand(inst.name)) : matchBrand(name);
  const isCustomImage = customIcon && (
    customIcon.startsWith('data:') ||
    customIcon.startsWith('file:') ||
    customIcon.startsWith('content:') ||
    customIcon.startsWith('http') ||
    customIcon.startsWith('/')
  );
  // The "≈" hint is worth showing whenever the row's own currency differs from the one the
  // totals above it are denominated in — not just when it differs from ringgit. A user
  // reading in SGD needs the SGD equivalent of a ringgit account just as much as the
  // reverse, and an SGD account under an SGD display currency needs no hint at all.
  const foreign = currency !== dc.code;
  return (
    <Pressable onPress={onPress} style={[styles.row, !isLast && [styles.rowDivider, { borderBottomColor: colorTheme.line }]]}>
      {brand ? (
        <BrandBadge brand={brand} size={36} rad={11} />
      ) : inst ? (
        <InstitutionBadge inst={inst} size={36} />
      ) : isCustomImage ? (
        <View style={[styles.rowTile, { overflow: 'hidden' }]}>
          <Image source={{ uri: customIcon }} style={{ width: 36, height: 36 }} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.rowTile, { backgroundColor: '#fff0ef' }]}>
          <Icon name="scale" size={16} color={colorTheme.red} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.liabNameRow}>
          <Text style={[styles.rowName, { color: colorTheme.ink }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.liabChip, { color: colorTheme.red }]}>{cls}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.rowVal, { color: colorTheme.red }]}>-{fmtMoney(nativeValue, currency)}</Text>
        {foreign && (
          <Text style={[styles.rowFx, { color: colorTheme.ink3 }]} numberOfLines={1}>
            {unconvertible ? 'rate unavailable' : fxSubtitle(currency, myrValue, fxAsOf, dc)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** Flatten liability class groups into rows tagged with their class label. */
function flattenLiabs(groups: ClassGroup[]): { account: Account; value: number; clsLabel: string }[] {
  const out: { account: Account; value: number; clsLabel: string }[] = [];
  for (const g of groups) for (const { account, value } of g.accounts) out.push({ account, value, clsLabel: g.label });
  return out;
}

/** A row showing a name + optional meta on the left and value + optional profit on the right. */
function AccountRow({
  name,
  meta,
  value,
  profit,
  profitMode,
  dc,
  onPress,
}: {
  name: string;
  meta?: string;
  value: number;
  profit: { profit: number; pct: number | null } | null;
  profitMode: ValueMode;
  dc: DisplayCurrency;
  onPress: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  return (
    <Pressable onPress={onPress} style={[styles.acctRow, styles.divider, { borderTopColor: colorTheme.line2 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.acctName, { color: colorTheme.ink }]} numberOfLines={1}>{name}</Text>
        {meta ? <Text style={[styles.acctMeta, { color: colorTheme.ink2 }]} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.acctVal, { color: colorTheme.ink2 }]}>{fmtMoney(dc.convert(value), dc.code)}</Text>
        {profit && (
          <Text style={[styles.profit, { color: profit.profit >= 0 ? theme.accent : RED2 }]}>
            {profit.profit >= 0 ? '+' : '−'}
            {profitMode === 'percent' && profit.pct != null
              ? `${Math.abs(profit.pct).toFixed(1)}%`
              : fmtMoney(dc.convert(Math.abs(profit.profit)), dc.code)}
          </Text>
        )}
      </View>
      <Icon name="chevronRight" size={16} color={colorTheme.ink3} />
    </Pressable>
  );
}

/** Add a new account: kind → class → name → opening value, or a live holding (optionally preset to a ticker). */
function AddAccountModal({ visible, preset, onClose }: { visible: boolean; preset?: TickerResult | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const { addAccount, addHolding, markTaskDone } = useAppData();
  const [kind, setKind] = useState<AccountKind>('asset');
  const [cls, setCls] = useState('cash');
  const [name, setName] = useState('');
  const [valueText, setValueText] = useState('');
  const [holdingMode, setHoldingMode] = useState(false);
  const [coin, setCoin] = useState<TickerResult | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [costText, setCostText] = useState('');
  const [rateText, setRateText] = useState('');
  const [rateMode, setRateMode] = useState<'appreciation' | 'depreciation'>('depreciation');
  const [searchOpen, setSearchOpen] = useState(false);
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  // A manually-created account's own currency (holdings stay MYR-only, priced via quotesMYR).
  const [currency, setCurrency] = useState<string>(BASE_CURRENCY);
  const [activeCurrencies, setActiveCurrencies] = useState<string[]>([BASE_CURRENCY]);

  const reset = () => {
    setKind('asset'); setCls('cash'); setName(''); setValueText('');
    setHoldingMode(false); setCoin(null); setQtyText(''); setCostText(''); setRateText('');
    setRateMode('depreciation');
    setCustomIcon(null); setCurrency(BASE_CURRENCY);
  };
  const close = () => { reset(); onClose(); };

  // On open, either preset to a specific ticker ("add another lot") or start fresh. Also
  // (re)loads the active-currency list each time the sheet opens, mirroring ManualEntryScreen.
  useEffect(() => {
    if (!visible) return;
    if (preset) {
      setKind('asset'); setCls('investments'); setHoldingMode(true);
      setCoin(preset); setName(''); setValueText(''); setQtyText(''); setCostText(''); setRateText(''); setRateMode('depreciation'); setCustomIcon(null);
    } else {
      reset();
    }
    getActiveCurrencies().then(setActiveCurrencies);
    // Seed the picker with the currency the user actually banks in, not ringgit. Defaulting
    // to MYR here is how someone whose default currency is SGD ends up with SGD spending
    // draining an account the whole app then labels "RM".
    getEntryCurrency().then(setCurrency);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchKind = (k: AccountKind) => {
    setKind(k);
    const firstCls = classesFor(k)[0]?.id ?? 'cash';
    setCls(firstCls);
    setHoldingMode(firstCls === 'investments');
  };

  const isInvest = kind === 'asset' && cls === 'investments';
  const isHoldingType = isInvest && holdingMode;
  const isIlliquid = kind === 'asset' && cls === 'illiquid';
  const pickedSub = coin ? subFromType(coin.type) : null;
  const qtyUnit = pickedSub === 'commodity' ? 'g' : coin?.ticker ?? '';
  const qtyLabel = pickedSub === 'commodity' ? 'Grams' : pickedSub === 'stock' ? 'Shares' : 'Quantity';
  const quantity = Math.max(0, parseFloat(qtyText.replace(/[^0-9.]/g, '')) || 0);

  const valueDecimals = decimalsFor(currency);
  const valueCalc = useMemo(() => evaluateExpression(valueText, valueDecimals), [valueText, valueDecimals]);
  const value = Math.max(0, valueCalc.result ?? 0);

  const mergeScaleX = useRef(new Animated.Value(1)).current;
  const mergeScaleY = useRef(new Animated.Value(1)).current;
  const mergeOpacity = useRef(new Animated.Value(1)).current;
  const [isMergingValue, setIsMergingValue] = useState(false);

  const handleMergeValue = () => {
    if (!valueCalc.isExpression || valueCalc.result == null || valueCalc.result <= 0) return;
    const finalValue = valueDecimals === 0 ? String(Math.round(valueCalc.result)) : valueCalc.result.toFixed(valueDecimals);
    const useNative = Platform.OS !== 'web';

    setIsMergingValue(true);
    tap();

    // Phase 1: Numbers converge/squeeze inward
    Animated.parallel([
      Animated.timing(mergeScaleX, {
        toValue: 0.82,
        duration: 80,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(mergeScaleY, {
        toValue: 0.88,
        duration: 80,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(mergeOpacity, {
        toValue: 0.35,
        duration: 80,
        useNativeDriver: useNative,
      }),
    ]).start(() => {
      setValueText(finalValue);

      // Phase 2: Bloom outward with spring bounce into final number
      Animated.parallel([
        Animated.spring(mergeScaleX, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: useNative,
        }),
        Animated.spring(mergeScaleY, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: useNative,
        }),
        Animated.timing(mergeOpacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: useNative,
        }),
      ]).start(() => {
        setIsMergingValue(false);
      });
    });
  };

  const canSave = isHoldingType ? !!coin && quantity > 0 : name.trim().length > 0;

  const pickCoin = (c: TickerResult) => {
    setCoin(c);
    if (!name.trim()) setName(c.name);
    setSearchOpen(false);
  };

  const pickCustomIcon = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });
    if (!res.canceled && res.assets?.length) {
      const a = res.assets[0];
      const dataUri = a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
      setCustomIcon(dataUri);
    }
  };

  const save = async () => {
    if (!canSave) return;
    const rateVal = rateText.trim() ? parseFloat(rateText.replace(/[^0-9.]/g, '')) || null : null;
    if (isHoldingType && coin) {
      const sub = subFromType(coin.type);
      const ticker = sub === 'commodity' ? 'g' : coin.ticker; // gold/silver measured in grams
      const cost = costText.trim() ? Math.round((parseFloat(costText.replace(/[^0-9.]/g, '')) || 0) * 100) / 100 : null;
      await addHolding(name.trim() || coin.name, sub, coin.id, ticker, Math.round(quantity * 1e8) / 1e8, cost, customIcon, rateVal);
    } else if (isIlliquid) {
      const parsedCost = costText.trim() ? Math.round((parseFloat(costText.replace(/[^0-9.]/g, '')) || 0) * 100) / 100 : null;
      const numRate = rateText.trim() ? parseFloat(rateText.replace(/[^0-9.]/g, '')) : null;
      const finalRate = numRate != null && Number.isFinite(numRate) ? (rateMode === 'depreciation' ? -Math.abs(numRate) : Math.abs(numRate)) : null;
      await addAccount(name.trim(), 'asset', 'illiquid', Math.round(value * 100) / 100, todayISO(), customIcon, currency, finalRate, parsedCost);
    } else {
      await addAccount(name.trim(), kind, cls, Math.round(value * 100) / 100, todayISO(), customIcon, currency, isInvest ? rateVal : null);
    }
    void markTaskDone('account');
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetAvoider}
        pointerEvents="box-none"
      >
      <View style={[styles.sheetCard, { paddingBottom: insets.bottom + 18, backgroundColor: colorTheme.bg }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: colorTheme.ink }]}>New account</Text>
          <Pressable onPress={close} hitSlop={8}><Icon name="x" size={20} color={colorTheme.ink2} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
            {(['asset', 'liability'] as AccountKind[]).map((k) => {
              const on = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => switchKind(k)}
                  style={[styles.toggleBtn, on && styles.toggleBtnOn, on && { backgroundColor: theme.accentTint }]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: colorTheme.ink2 },
                      on && styles.toggleTextOn,
                      on && { color: theme.accent },
                    ]}
                  >
                    {k === 'asset' ? (isZh ? '资产' : 'Assets') : (isZh ? '负债' : 'Liabilities')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>Type</Text>
          <View style={styles.classGrid}>
            {classesFor(kind).map((c) => {
              const on = cls === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setCls(c.id);
                    if (c.id === 'investments') setHoldingMode(true);
                  }}
                  style={[styles.classChip, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, on && [styles.classChipOn, { borderColor: theme.accent, backgroundColor: theme.accentTint }]]}
                >
                  <Icon name={c.icon as IconName} size={15} color={on ? theme.accent : colorTheme.ink3} />
                  <Text style={[styles.classChipText, { color: colorTheme.ink2 }, on && { color: theme.onTint }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {isInvest && (
            <View style={[styles.toggle, { marginTop: 18, marginBottom: 0, backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
              {([[true, 'Live holding'], [false, 'Manual value']] as const).map(([m, label]) => {
                const on = holdingMode === m;
                return (
                  <Pressable
                    key={label}
                    onPress={() => { setHoldingMode(m); setCoin(null); }}
                    style={[styles.toggleBtn, on && styles.toggleBtnOn, on && { backgroundColor: colorTheme.surface }]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        { color: colorTheme.ink2 },
                        on && styles.toggleTextOn,
                        on && { color: colorTheme.ink },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isHoldingType ? (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>Investment</Text>
              <Pressable onPress={() => setSearchOpen(true)} style={[styles.pickerBtn, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <Icon name="search" size={16} color={theme.accent} />
                <Text style={[styles.pickerText, { color: colorTheme.ink }, !coin && { color: colorTheme.ink2 }]} numberOfLines={1}>
                  {coin ? `${coin.name} · ${qtyUnit}` : 'Search crypto, stocks, gold or silver…'}
                </Text>
              </Pressable>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{qtyLabel}</Text>
              <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <TextInput value={qtyText} onChangeText={setQtyText} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colorTheme.ink3} style={[styles.amountInput, { color: colorTheme.ink }]} />
                {coin ? <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{qtyUnit}</Text> : null}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '持仓成本 / 买入总额 (选填)' : 'Invested amount (optional)'}</Text>
              <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(currency)}</Text>
                <TextInput value={costText} onChangeText={setCostText} keyboardType="decimal-pad" placeholder={isZh ? '买入成本' : 'cost of investment'} placeholderTextColor={colorTheme.ink3} style={[styles.amountInput, { color: colorTheme.ink }]} />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '年化收益率 / APR (选填)' : 'Interest rate (optional)'}</Text>
              <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <TextInput value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" placeholder="APR" placeholderTextColor={colorTheme.ink3} style={[styles.compactInput, { color: colorTheme.ink }]} />
                <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>%</Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '账户名称 (选填)' : 'Name (optional)'}</Text>
              <TextInput value={name} onChangeText={setName} placeholder={isZh ? '例如：我的持仓' : 'e.g. My holding'} placeholderTextColor={colorTheme.ink3} style={[styles.textInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]} />
            </>
          ) : (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>
                {cls === 'illiquid' ? (isZh ? '资产名称' : 'Asset name') : (isZh ? '账户名称' : 'Account')}
              </Text>
              <InstitutionField
                value={name}
                onChangeText={setName}
                placeholder={
                  kind === 'asset'
                    ? cls === 'illiquid'
                      ? isZh
                        ? '例如：2022 本田思域、满家乐公寓'
                        : 'e.g. 2022 Honda Civic, Mont Kiara Condo'
                      : isZh
                        ? '例如：TnG 电子钱包、Maybank'
                        : 'e.g. TnG eWallet, Maybank FD'
                    : isZh
                      ? '例如：Porsche 车贷 / 信用卡'
                      : 'e.g. Porsche, Car Loan'
                }
                onPick={(inst) => {
                  if (inst.kind === 'auto') {
                    if (kind === 'liability') setCls('car');
                    else setCls('illiquid');
                  } else if (kind === 'asset') {
                    setCls('cash');
                  }
                }}
              />

              <View style={[styles.labelRow, { marginTop: 18 }]}>
                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>
                  {cls === 'illiquid'
                    ? isZh
                      ? '当前市值'
                      : 'Market value'
                    : kind === 'asset'
                      ? isZh
                        ? '当前金额'
                        : 'Current value'
                      : isZh
                        ? '待还金额'
                        : 'Outstanding amount'}
                </Text>
                <ScanBalanceButton onResult={(n) => setValueText(String(n))} />
              </View>
              <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                {isMultiCurrency(activeCurrencies) ? (
                  <CurrencyChip value={currency} active={activeCurrencies} onChange={setCurrency} />
                ) : (
                  <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(currency)}</Text>
                )}
                <Animated.View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    opacity: mergeOpacity,
                    transform: [{ scaleX: mergeScaleX }, { scaleY: mergeScaleY }],
                  }}
                >
                  <TextInput
                    value={valueText}
                    onChangeText={(t) => setValueText(cleanCalcInput(t, valueDecimals > 0))}
                    onSubmitEditing={handleMergeValue}
                    keyboardType="numbers-and-punctuation"
                    placeholder={valueDecimals === 0 ? '0' : '0.00'}
                    placeholderTextColor={colorTheme.ink3}
                    style={[styles.amountInput, { color: isMergingValue ? theme.accent : colorTheme.ink }]}
                  />
                </Animated.View>
                {valueCalc.isExpression && valueCalc.result != null && valueCalc.result > 0 && (
                  <CalcBadge
                    result={valueCalc.result}
                    decimals={valueDecimals}
                    onApply={handleMergeValue}
                  />
                )}
              </View>
              {valueCalc.isExpression && valueCalc.result != null && valueCalc.result > 0 && (
                <Text style={[styles.calcHint, { color: theme.accent }]}>
                  = {currency} {valueDecimals === 0 ? String(Math.round(valueCalc.result)) : valueCalc.result.toFixed(valueDecimals)}
                </Text>
              )}

              {isIlliquid && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>
                    {isZh ? '购置成本 (选填)' : 'Cost of asset (optional)'}
                  </Text>
                  <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                    <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(currency)}</Text>
                    <TextInput
                      value={costText}
                      onChangeText={setCostText}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colorTheme.ink3}
                      style={[styles.amountInput, { color: colorTheme.ink }]}
                    />
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>
                    {isZh ? '预估年化增值/折旧率 (选填)' : 'ETA appreciation / depreciation % (optional)'}
                  </Text>
                  <View style={[styles.toggle, { marginTop: 6, marginBottom: 8, backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
                    {([
                      ['appreciation', isZh ? '+ 增值' : '+ Appreciation'],
                      ['depreciation', isZh ? '− 折旧' : '− Depreciation'],
                    ] as const).map(([m, label]) => {
                      const on = rateMode === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => setRateMode(m)}
                          style={[styles.toggleBtn, on && styles.toggleBtnOn, on && { backgroundColor: colorTheme.surface }]}
                        >
                          <Text
                            style={[
                              styles.toggleText,
                              { color: colorTheme.ink2 },
                              on && styles.toggleTextOn,
                              on && { color: m === 'appreciation' ? theme.accent : colorTheme.ink },
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, width: 160 }]}>
                    <TextInput
                      value={rateText}
                      onChangeText={setRateText}
                      keyboardType="decimal-pad"
                      placeholder={rateMode === 'depreciation' ? '10.0' : '5.0'}
                      placeholderTextColor={colorTheme.ink3}
                      style={[styles.compactInput, { color: colorTheme.ink }]}
                    />
                    <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>% / yr</Text>
                  </View>
                </>
              )}

              {isInvest && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>Interest rate (optional)</Text>
                  <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                    <TextInput value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" placeholder="APR" placeholderTextColor={colorTheme.ink3} style={[styles.compactInput, { color: colorTheme.ink }]} />
                    <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>%</Text>
                  </View>
                </>
              )}
            </>
          )}

          {/* Custom icon picker */}
          <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>Custom Icon (Optional)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <Pressable
              onPress={pickCustomIcon}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colorTheme.surface2,
                borderWidth: 1.5,
                borderColor: customIcon ? theme.accent : colorTheme.line,
                borderRadius: radius.sm,
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              {customIcon ? (
                <Image source={{ uri: customIcon }} style={{ width: 20, height: 20, borderRadius: 4 }} />
              ) : (
                <Icon name="image" size={18} color={theme.accent} />
              )}
              <Text style={{ fontSize: 13, fontFamily: uiFont(700), color: theme.accent }}>
                {customIcon ? 'Change icon' : 'Choose from gallery'}
              </Text>
            </Pressable>
            {customIcon && (
              <Pressable
                onPress={() => setCustomIcon(null)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: '#fff0ef',
                }}
              >
                <Icon name="trash" size={16} color={colorTheme.red} />
              </Pressable>
            )}
          </View>

          <View style={{ marginTop: 22 }}>
            <PrimaryButton onPress={save} disabled={!canSave} height={52}>
              <Icon name="check" size={18} color="#fff" stroke={2.4} />
              <BtnLabel>{isHoldingType ? 'Add holding' : 'Add account'}</BtnLabel>
            </PrimaryButton>
          </View>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>

      <TickerSearchModal
        visible={searchOpen}
        title="Search investments"
        placeholder="BTC, AAPL, 1155.KL, Gold…"
        search={searchInvestments}
        onPick={pickCoin}
        onClose={() => setSearchOpen(false)}
      />
    </Modal>
  );
}

/** The combined view of one symbol's lots: totals + each lot (tap to modify) + add another. */
function HoldingGroupSheet({
  lots,
  accountValues,
  prices,
  profitMode,
  dc,
  onClose,
  onEditLot,
  onAddMore,
}: {
  lots: Account[];
  accountValues: Record<string, number>;
  prices: Record<string, PriceQuote>;
  profitMode: ValueMode;
  dc: DisplayCurrency;
  onClose: () => void;
  onEditLot: (id: string) => void;
  onAddMore: (coin: TickerResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  if (lots.length === 0) return <Modal visible={false} transparent />;

  const grp = groupHoldings(lots, accountValues)[0];
  const price = prices[grp.symbol];
  const totalP = grp.cost != null && grp.cost > 0 ? holdingProfit(grp.value, grp.cost) : null;
  const coin: TickerResult = { id: grp.symbol, ticker: grp.ticker, name: grp.name, type: typeFromSub(grp.sub) };
  const ordered = [...lots].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 18, backgroundColor: colorTheme.bg }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: colorTheme.ink }]} numberOfLines={1}>{grp.name}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Icon name="x" size={20} color={colorTheme.ink2} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.holdingSummary}>
            <Text style={[styles.holdingTicker, { color: theme.accent, backgroundColor: theme.accentTint }]}>{grp.ticker}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.holdingPrice, { color: colorTheme.ink2 }]}>
                {grp.quantity} {grp.ticker}{price ? ` · ${fmtMoney(dc.convert(price.priceMYR), dc.code)} each` : ''}
              </Text>
              <Text style={[styles.holdingValue, { color: colorTheme.ink }]}>= {fmtMoney(dc.convert(grp.value), dc.code)}</Text>
            </View>
          </View>
          {totalP && (
            <Text style={[styles.profitLine, { color: totalP.profit >= 0 ? theme.accent : RED2 }]}>
              {totalP.profit >= 0 ? '▲ +' : '▼ −'}{fmtMoney(dc.convert(Math.abs(totalP.profit)), dc.code)}
              {totalP.pct != null ? ` (${totalP.profit >= 0 ? '+' : '−'}${Math.abs(totalP.pct).toFixed(1)}%)` : ''} on {fmtMoney(dc.convert(grp.cost as number), dc.code)} invested
            </Text>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10 }}>
            <Eyebrow>{ordered.length} lot{ordered.length === 1 ? '' : 's'}</Eyebrow>
            <InfoButton entry="holdings" />
          </View>
          <Card style={{ overflow: 'hidden' }}>
            {ordered.map((lot) => {
              const { id, quantity, createdAt, cost, interestRate } = lot;
              const value = accountValues[id] ?? 0;
              const p = cost != null && cost > 0 ? holdingProfit(value, cost) : null;
              const metaText = `added ${shortDate(createdAt)}${interestRate != null ? ` · ${interestRate}% APR` : ''}`;
              return (
                <AccountRow
                  key={id}
                  name={`${quantity} ${grp.ticker}`}
                  meta={metaText}
                  value={value}
                  profit={p}
                  profitMode={profitMode}
                  dc={dc}
                  onPress={() => onEditLot(id)}
                />
              );
            })}
          </Card>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton onPress={() => onAddMore(coin)} height={50}>
              <Icon name="plus" size={18} color="#fff" stroke={2.2} />
              <BtnLabel>Add another {grp.ticker}</BtnLabel>
            </PrimaryButton>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Manage one account: update balance, rename, reclassify, convert to live holding, view history, delete. */
function AccountSheet({ account, dc, onClose }: { account: Account | null; dc: DisplayCurrency; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const { balanceEntries, accountValues, prices, setBalance, updateAccount, deleteAccount, updateHoldingQuantity, setHoldingCost, refreshPrices } = useAppData();
  const [name, setName] = useState('');
  const [cls, setCls] = useState('cash');
  const [valueText, setValueText] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [costText, setCostText] = useState('');
  const [rateText, setRateText] = useState('');
  const [editRateMode, setEditRateMode] = useState<'appreciation' | 'depreciation'>('depreciation');
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [holdingCoin, setHoldingCoin] = useState<TickerResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const holding = account ? isHolding(account) : false;
  const valueDecimals = decimalsFor(account?.currency ?? BASE_CURRENCY);
  const valueCalc = useMemo(() => evaluateExpression(valueText, valueDecimals), [valueText, valueDecimals]);

  const mergeScaleX = useRef(new Animated.Value(1)).current;
  const mergeScaleY = useRef(new Animated.Value(1)).current;
  const mergeOpacity = useRef(new Animated.Value(1)).current;
  const [isMergingValue, setIsMergingValue] = useState(false);

  const handleMergeValue = () => {
    if (!valueCalc.isExpression || valueCalc.result == null || valueCalc.result <= 0) return;
    const finalValue = valueDecimals === 0 ? String(Math.round(valueCalc.result)) : valueCalc.result.toFixed(valueDecimals);
    const useNative = Platform.OS !== 'web';

    setIsMergingValue(true);
    tap();

    // Phase 1: Numbers converge/squeeze inward
    Animated.parallel([
      Animated.timing(mergeScaleX, {
        toValue: 0.82,
        duration: 80,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(mergeScaleY, {
        toValue: 0.88,
        duration: 80,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(mergeOpacity, {
        toValue: 0.35,
        duration: 80,
        useNativeDriver: useNative,
      }),
    ]).start(() => {
      setValueText(finalValue);

      // Phase 2: Bloom outward with spring bounce into final number
      Animated.parallel([
        Animated.spring(mergeScaleX, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: useNative,
        }),
        Animated.spring(mergeScaleY, {
          toValue: 1,
          tension: 180,
          friction: 6,
          useNativeDriver: useNative,
        }),
        Animated.timing(mergeOpacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: useNative,
        }),
      ]).start(() => {
        setIsMergingValue(false);
      });
    });
  };

  const openId = account?.id;
  React.useEffect(() => {
    if (account) {
      setName(account.name);
      setCls(account.cls);
      setValueText(String(accountValues[account.id] ?? 0));
      setQtyText(account.quantity != null ? String(account.quantity) : '');
      setCostText(account.cost != null ? String(account.cost) : (account.cls === 'investments' && !isHolding(account) && (accountValues[account.id] ?? 0) > 0 ? String(accountValues[account.id]) : ''));
      if (account.interestRate != null) {
        if (account.interestRate < 0) {
          setEditRateMode('depreciation');
          setRateText(String(Math.abs(account.interestRate)));
        } else {
          setEditRateMode('appreciation');
          setRateText(String(account.interestRate));
        }
      } else {
        setEditRateMode(account.cls === 'illiquid' ? 'depreciation' : 'appreciation');
        setRateText('');
      }
      setCustomIcon(account.icon ?? null);
      setHoldingCoin(null);
      setSearchOpen(false);
      setShowHistory(false);
    }
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = useMemo(
    () => (account ? balanceEntries.filter((e) => e.accountId === account.id).slice().reverse() : []),
    [account, balanceEntries]
  );

  const pickedSub = holdingCoin ? subFromType(holdingCoin.type) : (account?.sub ? account.sub : null);
  const holdingQtyUnit = pickedSub === 'commodity' ? 'g' : (holdingCoin?.ticker ?? account?.ticker ?? '');
  const holdingQtyLabel = pickedSub === 'commodity' ? (isZh ? '克重' : 'Grams') : pickedSub === 'stock' ? (isZh ? '股数' : 'Shares') : (isZh ? '持仓数量' : 'Quantity');

  const pickCustomIcon = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });
    if (!res.canceled && res.assets?.length) {
      const a = res.assets[0];
      const dataUri = a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
      setCustomIcon(dataUri);
    }
  };

  if (!account) return <Modal visible={false} transparent />;

  const save = async () => {
    const newName = name.trim() || account.name;
    const isCurrentIlliquid = account.cls === 'illiquid' || cls === 'illiquid';
    let parsedRate: number | null = null;
    if (rateText.trim()) {
      const num = parseFloat(rateText.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(num)) {
        parsedRate = isCurrentIlliquid && editRateMode === 'depreciation' ? -Math.abs(num) : num;
      }
    }
    const parsedCost = costText.trim() ? Math.round((parseFloat(costText.replace(/[^0-9.]/g, '')) || 0) * 100) / 100 : null;

    // 1. Converting a manual account to a live holding
    if (!holding && holdingCoin) {
      const q = parseFloat(qtyText.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(q) && q > 0) {
        const sub = subFromType(holdingCoin.type);
        const ticker = sub === 'commodity' ? 'g' : holdingCoin.ticker;
        const cost = costText.trim() ? Math.round((parseFloat(costText.replace(/[^0-9.]/g, '')) || 0) * 100) / 100 : null;
        await updateAccount(account.id, {
          name: newName,
          cls: 'investments',
          icon: customIcon,
          interestRate: parsedRate,
          sub,
          symbol: holdingCoin.id,
          ticker,
          quantity: Math.round(q * 1e8) / 1e8,
          cost,
        });
        await refreshPrices().catch(() => {});
        onClose();
        return;
      }
    }

    // 2. Existing holding (or updated ticker)
    if (holding) {
      const targetCoin = holdingCoin;
      const sub = targetCoin ? subFromType(targetCoin.type) : account.sub;
      const symbol = targetCoin ? targetCoin.id : account.symbol;
      const ticker = targetCoin ? (sub === 'commodity' ? 'g' : targetCoin.ticker) : account.ticker;
      const q = parseFloat(qtyText.replace(/[^0-9.]/g, ''));
      const quantity = Number.isFinite(q) && q >= 0 ? Math.round(q * 1e8) / 1e8 : account.quantity;
      const cost = costText.trim() ? Math.round((parseFloat(costText.replace(/[^0-9.]/g, '')) || 0) * 100) / 100 : null;
      await updateAccount(account.id, {
        name: newName,
        cls: account.cls,
        icon: customIcon,
        interestRate: parsedRate,
        sub,
        symbol,
        ticker,
        quantity,
        cost,
      });
      if (targetCoin) await refreshPrices().catch(() => {});
      onClose();
      return;
    }

    // 3. Regular manual account update
    if (newName !== account.name || cls !== account.cls || customIcon !== account.icon || parsedRate !== account.interestRate || parsedCost !== account.cost) {
      await updateAccount(account.id, { name: newName, cls, icon: customIcon, interestRate: parsedRate, cost: parsedCost });
    }
    const v = valueCalc.result != null ? valueCalc.result : parseFloat(valueText.replace(/[^0-9.]/g, ''));
    const value = Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
    if (value !== null && value !== (accountValues[account.id] ?? 0)) {
      await setBalance(account.id, value, todayISO());
    }
    onClose();
  };

  const confirmDelete = () => {
    confirmAction('Delete account?', `Remove “${account.name}” and its history? This can’t be undone.`, 'Delete', async () => {
      await deleteAccount(account.id);
      onClose();
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetAvoider}
        pointerEvents="box-none"
      >
      <View style={[styles.sheetCard, { paddingBottom: insets.bottom + 18, backgroundColor: colorTheme.bg }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: colorTheme.ink }]} numberOfLines={1}>{account.name}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Icon name="x" size={20} color={colorTheme.ink2} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {holding ? (
            <>
              <View style={styles.holdingSummary}>
                <Text style={[styles.holdingTicker, { color: theme.accent, backgroundColor: theme.accentTint }]}>{account.ticker}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.holdingPrice, { color: colorTheme.ink2 }]}>
                    {prices[account.symbol as string] ? `${fmtMoney(dc.convert(prices[account.symbol as string].priceMYR), dc.code)} each` : 'Price unavailable'}
                  </Text>
                  <Text style={[styles.holdingValue, { color: colorTheme.ink }]}>= {fmtMoney(dc.convert(accountValues[account.id] ?? 0), dc.code)}</Text>
                </View>
                <Pressable onPress={() => setSearchOpen(true)} style={[styles.changeBtn, { backgroundColor: theme.accentTint }]}>
                  <Text style={[styles.changeText, { color: theme.accent }]}>{isZh ? '更换标的' : 'Change'}</Text>
                </Pressable>
              </View>

              {account.cost != null && account.cost > 0 && (() => {
                const p = holdingProfit(accountValues[account.id] ?? 0, account.cost);
                const up = p.profit >= 0;
                return (
                  <Text style={[styles.profitLine, { color: up ? theme.accent : RED2 }]}>
                    {up ? '▲' : '▼'} {up ? '+' : '−'}{fmtMoney(dc.convert(Math.abs(p.profit)), dc.code)}
                    {p.pct != null ? ` (${up ? '+' : '−'}${Math.abs(p.pct).toFixed(1)}%)` : ''} on {fmtMoney(dc.convert(account.cost), dc.code)} invested
                  </Text>
                );
              })()}

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{holdingQtyLabel}</Text>
              <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <TextInput value={qtyText} onChangeText={setQtyText} keyboardType="decimal-pad" selectTextOnFocus style={[styles.amountInput, { color: colorTheme.ink }]} />
                <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{holdingQtyUnit}</Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '买入成本 / 总投入 (成本价)' : 'Invested amount (cost)'}</Text>
              <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(account.currency)}</Text>
                <TextInput value={costText} onChangeText={setCostText} keyboardType="decimal-pad" placeholder={isZh ? '买入成本' : 'cost of investment'} placeholderTextColor={colorTheme.ink3} style={[styles.amountInput, { color: colorTheme.ink }]} />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '年化收益率 / APR (选填)' : 'Interest rate (optional)'}</Text>
              <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <TextInput value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" placeholder="APR" placeholderTextColor={colorTheme.ink3} style={[styles.compactInput, { color: colorTheme.ink }]} />
                <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>%</Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '账户名称' : 'Name'}</Text>
              <TextInput value={name} onChangeText={setName} style={[styles.textInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]} />
            </>
          ) : (
            <>
              <View style={styles.labelRow}>
                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>
                  {account.cls === 'illiquid' || cls === 'illiquid'
                    ? isZh
                      ? '当前市值'
                      : 'Market value'
                    : account.kind === 'asset'
                      ? isZh
                        ? '当前金额'
                        : 'Current value'
                      : isZh
                        ? '待还金额'
                        : 'Outstanding amount'}
                </Text>
                <ScanBalanceButton onResult={(n) => setValueText(String(n))} />
              </View>
              <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(account.currency)}</Text>
                <Animated.View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    opacity: mergeOpacity,
                    transform: [{ scaleX: mergeScaleX }, { scaleY: mergeScaleY }],
                  }}
                >
                  <TextInput
                    value={valueText}
                    onChangeText={(t) => setValueText(cleanCalcInput(t, valueDecimals > 0))}
                    onSubmitEditing={handleMergeValue}
                    keyboardType="numbers-and-punctuation"
                    selectTextOnFocus
                    style={[styles.amountInput, { color: isMergingValue ? theme.accent : colorTheme.ink }]}
                  />
                </Animated.View>
                {valueCalc.isExpression && valueCalc.result != null && valueCalc.result > 0 && (
                  <CalcBadge
                    result={valueCalc.result}
                    decimals={valueDecimals}
                    onApply={handleMergeValue}
                  />
                )}
              </View>
              {valueCalc.isExpression && valueCalc.result != null && valueCalc.result > 0 && (
                <Text style={[styles.calcHint, { color: theme.accent }]}>
                  = {account.currency} {valueDecimals === 0 ? String(Math.round(valueCalc.result)) : valueCalc.result.toFixed(valueDecimals)}
                </Text>
              )}
              <Text style={[styles.hint, { color: colorTheme.ink2 }]}>{isZh ? '保存新金额将记录为今天的最新余额。' : 'Saving a new value records it as of today.'}</Text>

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>
                {account.cls === 'illiquid' || cls === 'illiquid' ? (isZh ? '资产名称' : 'Asset name') : (isZh ? '账户名称' : 'Account')}
              </Text>
              <InstitutionField
                value={name}
                onChangeText={setName}
                onPick={(inst) => {
                  if (inst.kind === 'auto') {
                    if (account.kind === 'liability') setCls('car');
                    else setCls('illiquid');
                  } else if (account.kind === 'asset') {
                    setCls('cash');
                  }
                }}
              />

              <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '分类' : 'Type'}</Text>
              <View style={styles.classGrid}>
                {classesFor(account.kind).map((c) => {
                  const on = cls === c.id;
                  return (
                    <Pressable key={c.id} onPress={() => setCls(c.id)} style={[styles.classChip, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, on && [styles.classChipOn, { borderColor: theme.accent, backgroundColor: theme.accentTint }]]}>
                      <Icon name={c.icon as IconName} size={15} color={on ? theme.accent : colorTheme.ink3} />
                      <Text style={[styles.classChipText, { color: colorTheme.ink2 }, on && { color: theme.onTint }]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {(account.cls === 'illiquid' || cls === 'illiquid') && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>
                    {isZh ? '购置成本 (选填)' : 'Cost of asset (optional)'}
                  </Text>
                  <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                    <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(account.currency)}</Text>
                    <TextInput
                      value={costText}
                      onChangeText={setCostText}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colorTheme.ink3}
                      style={[styles.amountInput, { color: colorTheme.ink }]}
                    />
                  </View>

                  {(() => {
                    const costVal = parseFloat(costText.replace(/[^0-9.]/g, ''));
                    const curVal = parseFloat(valueText.replace(/[^0-9.]/g, ''));
                    if (Number.isFinite(costVal) && costVal > 0 && Number.isFinite(curVal)) {
                      const diff = curVal - costVal;
                      const pct = Math.round((diff / costVal) * 1000) / 10;
                      const up = diff >= 0;
                      return (
                        <Text style={[styles.profitLine, { color: up ? theme.accent : RED2, marginTop: 6 }]}>
                          {up ? '▲' : '▼'} {up ? '+' : '−'}{fmtMoney(dc.convert(Math.abs(diff)), dc.code)}
                          {` (${up ? '+' : '−'}${Math.abs(pct)}%) ${isZh ? '较购置成本' : 'vs cost'}`}
                        </Text>
                      );
                    }
                    return null;
                  })()}

                  <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>
                    {isZh ? '预估年化增值/折旧率 (选填)' : 'ETA appreciation / depreciation % (optional)'}
                  </Text>
                  <View style={[styles.toggle, { marginTop: 6, marginBottom: 8, backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
                    {([
                      ['appreciation', isZh ? '+ 增值' : '+ Appreciation'],
                      ['depreciation', isZh ? '− 折旧' : '− Depreciation'],
                    ] as const).map(([m, label]) => {
                      const on = editRateMode === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => setEditRateMode(m)}
                          style={[styles.toggleBtn, on && styles.toggleBtnOn, on && { backgroundColor: colorTheme.surface }]}
                        >
                          <Text
                            style={[
                              styles.toggleText,
                              { color: colorTheme.ink2 },
                              on && styles.toggleTextOn,
                              on && { color: m === 'appreciation' ? theme.accent : colorTheme.ink },
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, width: 160 }]}>
                    <TextInput
                      value={rateText}
                      onChangeText={setRateText}
                      keyboardType="decimal-pad"
                      placeholder={editRateMode === 'depreciation' ? '10.0' : '5.0'}
                      placeholderTextColor={colorTheme.ink3}
                      style={[styles.compactInput, { color: colorTheme.ink }]}
                    />
                    <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>% / yr</Text>
                  </View>
                </>
              )}

              {(account.cls === 'investments' || cls === 'investments') && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '年化收益率 / APR (选填)' : 'Interest rate (optional)'}</Text>
                  <View style={[styles.compactInputRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                    <TextInput value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" placeholder="APR" placeholderTextColor={colorTheme.ink3} style={[styles.compactInput, { color: colorTheme.ink }]} />
                    <Text style={[styles.compactUnit, { color: colorTheme.ink2 }]}>%</Text>
                  </View>

                  {/* Convert manual investment account to live market holding */}
                  <View style={[styles.convertCard, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Icon name="sparkles" size={16} color={theme.accent} />
                      <Text style={[styles.convertTitle, { color: theme.accent }]}>
                        {isZh ? '转换为实时行情账户' : 'Convert to Live Holding'}
                      </Text>
                    </View>
                    <Text style={[styles.convertDesc, { color: colorTheme.ink2 }]}>
                      {isZh
                        ? '关联实时标的（美股、马股、加密货币、黄金/白银），自动同步每日最新行情。'
                        : 'Link a market ticker (stocks, ETFs, crypto, gold) to track live prices automatically.'}
                    </Text>
                    {holdingCoin ? (
                      <View style={{ marginTop: 12 }}>
                        <View style={[styles.holdingSelectedRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                          <View style={[styles.tickerBox, { backgroundColor: theme.accentTint }]}>
                            <Text style={[styles.tickerText, { color: theme.accent }]}>{holdingCoin.ticker.slice(0, 4)}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.coinName, { color: colorTheme.ink }]} numberOfLines={1}>{holdingCoin.name}</Text>
                            <Text style={[styles.coinSub, { color: colorTheme.ink2 }]}>{holdingCoin.ticker}</Text>
                          </View>
                          <Pressable onPress={() => setSearchOpen(true)} style={[styles.changeBtn, { backgroundColor: theme.accentTint }]}>
                            <Text style={[styles.changeText, { color: theme.accent }]}>{isZh ? '更换' : 'Change'}</Text>
                          </Pressable>
                          <Pressable onPress={() => setHoldingCoin(null)} hitSlop={6} style={{ padding: 4 }}>
                            <Icon name="x" size={16} color={colorTheme.ink3} />
                          </Pressable>
                        </View>

                        <Text style={[styles.fieldLabel, { marginTop: 12, color: colorTheme.ink2 }]}>
                          {holdingQtyLabel}
                        </Text>
                        <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                          <TextInput
                            value={qtyText}
                            onChangeText={setQtyText}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={colorTheme.ink3}
                            style={[styles.amountInput, { color: colorTheme.ink }]}
                          />
                          <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{holdingQtyUnit}</Text>
                        </View>

                        <Text style={[styles.fieldLabel, { marginTop: 12, color: colorTheme.ink2 }]}>
                          {isZh ? '买入成本 / 总投资额 (选填)' : 'Invested amount (cost)'}
                        </Text>
                        <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                          <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(account.currency)}</Text>
                          <TextInput
                            value={costText}
                            onChangeText={setCostText}
                            keyboardType="decimal-pad"
                            placeholder={valueText || '0.00'}
                            placeholderTextColor={colorTheme.ink3}
                            style={[styles.amountInput, { color: colorTheme.ink }]}
                          />
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setSearchOpen(true)}
                        style={[styles.linkTickerBtn, { backgroundColor: theme.accent }]}
                      >
                        <Icon name="search" size={15} color="#fff" stroke={2.2} />
                        <Text style={styles.linkTickerBtnText}>
                          {isZh ? '搜索并关联标的 (股票/币/黄金)' : 'Search & Link Live Ticker'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </>
          )}

          {history.length > 1 && (
            <View style={{ marginTop: 18 }}>
              <Pressable
                onPress={() => setShowHistory((prev) => !prev)}
                style={[
                  styles.historyBtn,
                  {
                    backgroundColor: colorTheme.surface,
                    borderColor: showHistory ? theme.accent : colorTheme.line,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  showHistory
                    ? (isZh ? '收起历史记录' : 'Hide histories')
                    : (isZh ? '查看历史记录' : 'View histories')
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon
                    name="clock"
                    size={16}
                    color={showHistory ? theme.accent : colorTheme.ink2}
                  />
                  <Text
                    style={[
                      styles.historyBtnText,
                      { color: showHistory ? theme.accent : colorTheme.ink },
                    ]}
                  >
                    {showHistory
                      ? (isZh ? '收起历史记录' : 'Hide histories')
                      : (isZh ? '查看历史记录' : 'View histories')}
                  </Text>
                </View>
                <Icon
                  name={showHistory ? 'chevronUp' : 'chevronDown'}
                  size={16}
                  color={showHistory ? theme.accent : colorTheme.ink3}
                />
              </Pressable>

              {showHistory && (
                <Card style={{ overflow: 'hidden', marginTop: 8 }}>
                  {history.map((e, i) => (
                    <View key={e.id} style={[styles.histRow, i > 0 && [styles.divider, { borderTopColor: colorTheme.line2 }]]}>
                      <Text style={[styles.histDate, { color: colorTheme.ink2 }]}>{shortDate(e.asOf)}</Text>
                      <Text style={[styles.histVal, { color: colorTheme.ink }]}>{fmtMoney(e.value, account.currency)}</Text>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          )}

          {/* Custom icon picker */}
          <Text style={[styles.fieldLabel, { marginTop: 18, color: colorTheme.ink2 }]}>{isZh ? '自定义图标 (选填)' : 'Custom Icon (Optional)'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <Pressable
              onPress={pickCustomIcon}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colorTheme.surface2,
                borderWidth: 1.5,
                borderColor: customIcon ? theme.accent : colorTheme.line,
                borderRadius: radius.sm,
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              {customIcon ? (
                <Image source={{ uri: customIcon }} style={{ width: 20, height: 20, borderRadius: 4 }} />
              ) : (
                <Icon name="image" size={18} color={theme.accent} />
              )}
              <Text style={{ fontSize: 13, fontFamily: uiFont(700), color: theme.accent }}>
                {customIcon ? (isZh ? '更换图标' : 'Change icon') : (isZh ? '从相册选择' : 'Choose from gallery')}
              </Text>
            </Pressable>
            {customIcon && (
              <Pressable
                onPress={() => setCustomIcon(null)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: '#fff0ef',
                }}
              >
                <Icon name="trash" size={16} color={colorTheme.red} />
              </Pressable>
            )}
          </View>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton onPress={save} height={52}>
              <Icon name="check" size={18} color="#fff" stroke={2.4} />
              <BtnLabel>{isZh ? '保存' : 'Save'}</BtnLabel>
            </PrimaryButton>
          </View>
          <Pressable onPress={confirmDelete} style={styles.deleteBtn} hitSlop={6}>
            <Icon name="trash" size={17} color="#b3261e" />
            <Text style={styles.deleteText}>{isZh ? '删除账户' : 'Delete account'}</Text>
          </Pressable>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>

      <TickerSearchModal
        visible={searchOpen}
        title={isZh ? '搜索资产标的' : 'Search investment'}
        placeholder={isZh ? '输入代码、名称、加密货币、美股、马股或黄金…' : 'e.g. BTC, Maybank, AAPL, Gold…'}
        search={searchInvestments}
        onPick={(coin) => {
          setHoldingCoin(coin);
          if (!name.trim() || name === account.name) setName(coin.name);
          setSearchOpen(false);
        }}
        onClose={() => setSearchOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  scanText: { fontFamily: uiFont(700), fontSize: 13 },
  profit: { fontFamily: numFont(700), fontSize: 12, marginTop: 2 },
  profitLine: { fontFamily: uiFont(600), fontSize: 13, marginTop: 12 },

  /* nav */
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  navBtn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', ...shadowCard },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: uiFont(700), fontSize: 16 },

  /* hero */
  hero: { margin: 16, marginTop: 0, borderRadius: 26, padding: 20, overflow: 'hidden', backgroundColor: '#1b6b48', position: 'relative' },
  heroCircle: { position: 'absolute', top: -48, right: -48, width: 160, height: 160, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heroLabel: { fontFamily: uiFont(600), fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.52)' },
  heroToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.16)', borderRadius: 20, padding: 2, gap: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroToggleBtn: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 16 },
  heroToggleBtnOn: { backgroundColor: '#fff' },
  heroToggleText: { fontFamily: uiFont(700), fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  heroToggleTextOn: {},
  heroSign: { fontFamily: numFont(700), fontSize: 34, color: '#fff', marginRight: 2 },
  heroNum: { fontFamily: numFont(700), fontSize: 46, color: '#fff' },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 15 },
  deltaText: { fontFamily: numFont(700), fontSize: 11.5, color: '#42e893' },
  heroTiles: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  heroTile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.16)', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroTileLabel: { fontFamily: uiFont(500), fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 3 },
  heroTileVal: { fontFamily: numFont(700), fontSize: 16 },
  heroBreakdown: { color: '#ffffff', fontSize: 13, fontFamily: uiFont(700), fontWeight: '700', marginBottom: 9 },
  heroMonth: { flex: 1, textAlign: 'center', fontFamily: uiFont(500), fontSize: 11, color: 'rgba(255,255,255,0.3)' },

  /* scan row */
  scanRow: { flexDirection: 'row', gap: 9, marginHorizontal: 16, marginBottom: 4 },
  scanBanner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 10, paddingRight: 14 },
  scanIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontFamily: uiFont(700), fontSize: 13, color: '#fff' },
  scanSub: { fontFamily: uiFont(500), fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  addBtn: { width: 50, height: 50, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  /* group + class labels */
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  groupLabel: { fontFamily: uiFont(700), fontSize: 12, letterSpacing: 0.4 },
  groupTotal: { fontFamily: numFont(700), fontSize: 13 },
  classChipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  classChipLabel: { fontFamily: uiFont(700), fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  classChipSub: { fontFamily: numFont(600), fontSize: 11 },
  classCard: { borderRadius: 18, marginHorizontal: 16, marginTop: 4, overflow: 'hidden', ...shadowCard },

  /* price stamp */
  priceStamp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 8, borderBottomWidth: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#42e893' },
  priceStampText: { flex: 1, fontFamily: uiFont(500), fontSize: 11 },
  refreshBtn: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, minWidth: 64, alignItems: 'center' },
  refreshText: { fontFamily: uiFont(700), fontSize: 11 },

  /* rows */
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 18, paddingVertical: 11 },
  rowDivider: { borderBottomWidth: 1 },
  rowTile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: uiFont(600), fontSize: 13 },
  rowSub: { fontFamily: uiFont(500), fontSize: 11, marginTop: 1 },
  rowVal: { fontFamily: numFont(700), fontSize: 14 },
  rowProfit: { fontFamily: numFont(700), fontSize: 11.5, marginTop: 1 },
  rowFx: { fontFamily: uiFont(500), fontSize: 10.5, marginTop: 1, maxWidth: 120 },
  badge: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeTick: { fontFamily: numFont(700), fontSize: 11, lineHeight: 13 },
  badgeLbl: { fontFamily: uiFont(500), fontSize: 11, opacity: 0.75, lineHeight: 9 },
  holdMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  holdMeta: { fontFamily: numFont(500), fontSize: 11, flexShrink: 1 },
  chChip: { fontFamily: numFont(700), fontSize: 11, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  liabNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liabChip: { fontFamily: uiFont(600), fontSize: 11, backgroundColor: '#fff0ef', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  emptyTitle: { fontFamily: uiFont(700), fontSize: 17, marginTop: 12 },
  emptySub: { fontFamily: uiFont(500), fontSize: 13.5, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionTotal: { fontFamily: numFont(700), fontSize: 14 },
  classHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 4 },
  classIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  className: { flex: 1, fontFamily: uiFont(700), fontSize: 14.5 },
  classTotal: { fontFamily: numFont(700), fontSize: 13.5 },
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12, marginTop: 2 },
  divider: { borderTopWidth: 1 },
  acctName: { fontFamily: uiFont(600), fontSize: 14 },
  acctMeta: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 2 },
  acctVal: { fontFamily: numFont(600), fontSize: 13.5 },
  asOf: { fontFamily: uiFont(500), fontSize: 11.5, textAlign: 'center', marginTop: 16 },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  subChipOn: {},
  subChipText: { fontFamily: uiFont(700), fontSize: 13 },
  subChipTextOn: { color: '#fff' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 14 },
  pickerText: { flex: 1, fontFamily: uiFont(600), fontSize: 15 },
  holdingSummary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  holdingTicker: { fontFamily: uiFont(700), fontSize: 15, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, overflow: 'hidden' },
  holdingPrice: { fontFamily: uiFont(500), fontSize: 12.5 },
  holdingValue: { fontFamily: numFont(700), fontSize: 18, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 18, paddingTop: 10, maxHeight: '88%' },
  // Same visual sheet as `sheet`, but positioned by flexbox rather than `position: absolute`. Needed
  // wherever the sheet holds a focusable TextInput: on Android, KeyboardAvoidingView's `height` behavior
  // measures this view's own onLayout frame to compute the post-keyboard height, and an absolutely
  // positioned view with only `bottom: 0` (no `top`/explicit height) reports an unstable frame, so the
  // resize never applies and the keyboard just covers the field. Giving the KeyboardAvoidingView `flex: 1`
  // (full modal height, stable from first layout) and letting flexbox push the card to the bottom instead
  // fixes it. This is the same structure already used by AddCategoryModal/AddPersonModal, which don't hit the bug.
  sheetAvoider: { flex: 1, justifyContent: 'flex-end' },
  sheetCard: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 18, paddingTop: 10, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { flex: 1, fontFamily: uiFont(700), fontSize: 19, marginRight: 12 },
  toggle: { flexDirection: 'row', borderRadius: 999, padding: 4, marginBottom: 18, borderWidth: 1 },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleBtnOn: { ...shadowToggle },
  toggleText: { fontFamily: uiFont(600), fontSize: 14 },
  toggleTextOn: { },
  fieldLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
  classChipOn: {},
  classChipText: { fontFamily: uiFont(600), fontSize: 13 },
  textInput: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontFamily: uiFont(600), fontSize: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14 },
  calcHint: { fontFamily: numFont(600), fontSize: 13, marginTop: 6, marginLeft: 2 },
  rm: { fontFamily: numFont(600), fontSize: 18 },
  amountInput: { flex: 1, minWidth: 0, fontFamily: numFont(700), fontSize: 24, paddingVertical: 12 },
  compactInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: 130,
    gap: 6,
  },
  compactInput: {
    flex: 1,
    fontFamily: uiFont(600),
    fontSize: 14,
    paddingVertical: 0,
  },
  compactUnit: {
    fontFamily: uiFont(600),
    fontSize: 13,
    flexShrink: 0,
  },
  hint: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 6 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  historyBtnText: {
    fontFamily: uiFont(600),
    fontSize: 13.5,
  },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 11 },
  histDate: { fontFamily: uiFont(500), fontSize: 13 },
  histVal: { fontFamily: numFont(600), fontSize: 13.5 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 16, marginTop: 4 },
  deleteText: { fontFamily: uiFont(700), fontSize: 14.5, color: '#b3261e' },
  convertCard: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 18,
    marginBottom: 4,
  },
  convertTitle: { fontFamily: uiFont(700), fontSize: 14 },
  convertDesc: { fontFamily: uiFont(500), fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  linkTickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.sm,
    paddingVertical: 12,
    marginTop: 12,
  },
  linkTickerBtnText: { fontFamily: uiFont(700), fontSize: 13.5, color: '#fff' },
  holdingSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeText: { fontFamily: uiFont(700), fontSize: 12 },
  tickerBox: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tickerText: {
    fontFamily: uiFont(700),
    fontSize: 12,
  },
  coinName: {
    fontFamily: uiFont(600),
    fontSize: 13.5,
  },
  coinSub: {
    fontFamily: uiFont(500),
    fontSize: 11.5,
    marginTop: 1,
  },
});
