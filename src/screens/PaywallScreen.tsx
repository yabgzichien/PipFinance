// src/screens/PaywallScreen.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { gateHeadline, type GateTrigger } from '../billing/gates';
import { buy, fetchOfferings, restore } from '../billing/purchases';
import { useEntitlement } from '../billing/entitlement';
import { notify } from '../lib/platformAlert';
import { useThemeColors } from '../state/colorScheme';
import { useAccent } from '../state/accent';
import { radius, spacing } from '../theme';
import type { Translations } from '../i18n/types';

export const TRIAL_DAYS = 14;

export function firstChargeDate(start: Date, trialDays: number): Date {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + trialDays);
  return d;
}

/** Play policy requires price, billing frequency, first charge date, trial terms and the
 *  cancellation path to appear on the purchase surface itself, not behind a link. */
export function disclosureText(
  firstCharge: Date,
  t: Translations,
  locale: string,
  priceStr: string = 'RM67',
  trialDays: number = TRIAL_DAYS
): string {
  const formatted = firstCharge.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return t.proDisclosure
    .replace('{days}', String(trialDays))
    .replace('{price}', priceStr)
    .replace('{date}', formatted);
}

export function PaywallScreen({
  trigger,
  onClose,
  t,
  locale = 'en-MY',
}: {
  trigger: GateTrigger;
  onClose: () => void;
  t: Translations;
  locale?: string;
}) {
  const theme = useThemeColors();
  const accentTheme = useAccent();
  const { refresh, isPro } = useEntitlement();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchOfferings().then(setOffering);
  }, []);

  useEffect(() => {
    if (isPro) onClose();
  }, [isPro, onClose]);

  const onBuy = async (pkg: PurchasesPackage) => {
    setBusy(true);
    const result = await buy(pkg);
    setBusy(false);
    if (result.ok) {
      await refresh();
      onClose();
      return;
    }
    // A user backing out of the system sheet is not an error and must stay silent.
    if (!result.cancelled) notify(t.proStoreUnreachable);
  };

  const onRestore = async () => {
    setBusy(true);
    try {
      const tier = await restore();
      await refresh();
      if (tier === 'free') notify(t.proRestoreNothing);
      else onClose();
    } catch {
      notify(t.proStoreUnreachable);
    } finally {
      setBusy(false);
    }
  };

  const charge = firstChargeDate(new Date(), TRIAL_DAYS);
  const annualPkg = offering?.annual ?? null;
  const monthlyPkg = offering?.monthly ?? null;

  const annualPriceText = annualPkg ? t.proAnnual.replace('{price}', annualPkg.product.priceString) : t.proAnnual.replace('{price}', 'RM67');
  const monthlyPriceText = monthlyPkg ? t.proMonthly.replace('{price}', monthlyPkg.product.priceString) : t.proMonthly.replace('{price}', 'RM9.90');
  const annualPerMonthText = t.proAnnualPerMonth.replace('{price}', 'RM5.58');

  return (
    <ScrollView contentContainerStyle={[styles.wrap, { backgroundColor: theme.bg }]}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t.close}
        style={styles.close}
      >
        <Text style={[styles.closeText, { color: theme.ink2 }]}>✕</Text>
      </Pressable>

      <Text style={[styles.headline, { color: theme.ink }]}>{gateHeadline(trigger, t)}</Text>
      <Text style={[styles.subtitle, { color: theme.ink2 }]}>{t.proSubtitle}</Text>

      <View style={[styles.compare, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.compareHeader}>
          <Text style={[styles.compareColHeader, { color: theme.ink3 }]}>{t.proTitle}</Text>
          <Text style={[styles.compareColHeader, { color: theme.ink3, textAlign: 'right' }]}>{t.compareFree}</Text>
          <Text style={[styles.compareColHeader, { color: accentTheme.accentInk, textAlign: 'right' }]}>{t.comparePro}</Text>
        </View>
        <CompareRow label={t.compareScans} free={t.compareScansFree} pro={t.compareScansPro} theme={theme} accent={accentTheme.accentInk} />
        <CompareRow label={t.compareTax} free={t.compareTaxFree} pro={t.compareTaxPro} theme={theme} accent={accentTheme.accentInk} />
        <CompareRow label={t.compareReports} free={t.compareReportsFree} pro={t.compareReportsPro} theme={theme} accent={accentTheme.accentInk} />
      </View>

      <View style={styles.planGroup}>
        {/* Annual Plan (Pre-selected) */}
        <Pressable
          disabled={busy}
          onPress={() => setSelectedPlan('annual')}
          style={[
            styles.plan,
            { backgroundColor: theme.surface, borderColor: selectedPlan === 'annual' ? accentTheme.accent : theme.line },
            selectedPlan === 'annual' && styles.planSelected,
          ]}
        >
          <View style={styles.planRow}>
            <Text style={[styles.planPrice, { color: theme.ink }]}>{annualPriceText}</Text>
            <View style={[styles.saveBadge, { backgroundColor: accentTheme.accentTint }]}>
              <Text style={[styles.planSave, { color: accentTheme.accentInk }]}>{t.proAnnualSave}</Text>
            </View>
          </View>
          <Text style={[styles.planNote, { color: theme.ink2 }]}>{annualPerMonthText}</Text>
        </Pressable>

        {/* Monthly Plan */}
        <Pressable
          disabled={busy}
          onPress={() => setSelectedPlan('monthly')}
          style={[
            styles.plan,
            { backgroundColor: theme.surface, borderColor: selectedPlan === 'monthly' ? accentTheme.accent : theme.line },
            selectedPlan === 'monthly' && styles.planSelected,
          ]}
        >
          <View style={styles.planRow}>
            <Text style={[styles.planPrice, { color: theme.ink }]}>{monthlyPriceText}</Text>
          </View>
        </Pressable>
      </View>

      {/* Primary CTA */}
      <Pressable
        disabled={busy}
        onPress={() => {
          const pkg = selectedPlan === 'annual' ? annualPkg : monthlyPkg;
          if (pkg) {
            void onBuy(pkg);
          } else {
            notify(t.proStoreUnreachable);
          }
        }}
        style={[styles.ctaButton, { backgroundColor: accentTheme.accent }]}
      >
        <Text style={[styles.ctaText, { color: '#ffffff' }]}>
          {selectedPlan === 'annual' ? t.proStartTrial : t.save}
        </Text>
      </Pressable>

      <Text style={[styles.disclosure, { color: theme.ink3 }]}>
        {disclosureText(charge, t, locale)}
      </Text>

      <Pressable onPress={() => void onRestore()} disabled={busy} style={styles.restoreBtn}>
        <Text style={[styles.restore, { color: theme.ink2 }]}>{t.proRestore}</Text>
      </Pressable>
    </ScrollView>
  );
}

function CompareRow({
  label,
  free,
  pro,
  theme,
  accent,
}: {
  label: string;
  free: string;
  pro: string;
  theme: any;
  accent: string;
}) {
  return (
    <View style={styles.compareRow}>
      <Text style={[styles.compareLabel, { color: theme.ink }]}>{label}</Text>
      <Text style={[styles.compareFree, { color: theme.ink2 }]}>{free}</Text>
      <Text style={[styles.comparePro, { color: accent }]}>{pro}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  close: {
    alignSelf: 'flex-end',
    minWidth: 44,
    minHeight: 44,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  compare: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.base,
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  compareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  compareColHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  compareLabel: {
    flex: 1.2,
    fontSize: 13,
    fontWeight: '600',
  },
  compareFree: {
    flex: 1.4,
    fontSize: 12,
    textAlign: 'right',
  },
  comparePro: {
    flex: 1.2,
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '700',
  },
  planGroup: {
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  plan: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  planSelected: {
    borderWidth: 2,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planPrice: {
    fontSize: 17,
    fontWeight: '700',
  },
  planNote: {
    fontSize: 13,
    marginTop: 4,
  },
  saveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planSave: {
    fontSize: 12,
    fontWeight: '700',
  },
  ctaButton: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
  },
  disclosure: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  restoreBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restore: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
