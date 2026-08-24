// src/screens/CurrencySettingsScreen.tsx
// Activation UI for multi-currency. Matches SettingsScreen's header/back handling and
// ReceiptScanScreen's title+Switch row pattern (the app's only precedent for a per-item
// boolean toggle in a list  everything else on Settings is a global segmented pill).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eyebrow, TopBar } from '../components/ui';
import { activateCurrency, deactivateCurrency, getActiveCurrencies, getEntryCurrency, setEntryCurrency } from '../db/currencyRepo';
import { BASE_CURRENCY, isMultiCurrency } from '../lib/currency';
import { SUPPORTED_CURRENCIES } from '../lib/currencies';
import { notify } from '../lib/platformAlert';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { colors, radius, uiFont } from '../theme';

export function CurrencySettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [active, setActive] = useState<string[] | null>(null);
  const [entry, setEntry] = useState<string>(BASE_CURRENCY);
  // The one row whose fetch/write is in flight  disabled while pending so a second tap
  // can't race the first, mirroring ProviderCard's single busy-state pattern.
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextActive, nextEntry] = await Promise.all([getActiveCurrencies(), getEntryCurrency()]);
    setActive(nextActive);
    setEntry(nextEntry);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggle = async (code: string, on: boolean) => {
    if (code === BASE_CURRENCY || pendingCode) return;
    setPendingCode(code);
    try {
      if (on) {
        const ok = await activateCurrency(code);
        if (!ok) {
          notify(`Couldn't fetch the ${code} rate.`, "Try again when you're online.");
          return;
        }
      } else {
        await deactivateCurrency(code);
      }
      await reload();
    } finally {
      setPendingCode(null);
    }
  };

  const pickEntry = async (code: string) => {
    if (code === entry) return;
    await setEntryCurrency(code);
    await reload();
  };

  if (!active) {
    return (
      <View style={[styles.root, { backgroundColor: colorTheme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title="Currencies" onBack={onBack} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        <Eyebrow style={{ marginBottom: 10 }}>Active currencies</Eyebrow>
        {SUPPORTED_CURRENCIES.map((c, i) => {
          const isBase = c.code === BASE_CURRENCY;
          const on = isBase || active.includes(c.code);
          const busy = pendingCode === c.code;
          return (
            <View
              key={c.code}
              style={[styles.row, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, i > 0 && { marginTop: 10 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colorTheme.ink }]}>
                  {c.code} <Text style={{ color: colorTheme.ink2, fontFamily: uiFont(500) }}>{c.label}</Text>
                </Text>
              </View>
              {isBase ? (
                <Text style={[styles.baseLabel, { color: colorTheme.ink3 }]}>Base</Text>
              ) : busy ? (
                <ActivityIndicator color={theme.accent} size="small" />
              ) : (
                <Switch
                  value={on}
                  onValueChange={(v) => toggle(c.code, v)}
                  trackColor={{ false: colorTheme.line2, true: theme.accent }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colorTheme.line2}
                  accessibilityRole="switch"
                  accessibilityLabel={c.label}
                  accessibilityState={{ checked: on }}
                />
              )}
            </View>
          );
        })}

        {isMultiCurrency(active) && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>Enter new expenses in</Eyebrow>
            <View style={styles.entryWrap}>
              {active.map((code) => {
                const on = entry === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => pickEntry(code)}
                    style={[styles.entryChip, { borderColor: colorTheme.line2 }, on && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.entryChipText, { color: on ? colors.onAccent : colorTheme.ink }]}>{code}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  rowTitle: { fontFamily: uiFont(700), fontSize: 14.5 },
  baseLabel: { fontFamily: uiFont(600), fontSize: 12.5 },
  entryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entryChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  entryChipText: { fontFamily: uiFont(700), fontSize: 13 },
});
