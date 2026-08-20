// src/screens/OnboardingScreen.tsx
// The app's front door: a one-tap welcome screen before the tracker's empty state.
//
// This is a minimal placeholder (Stage 1 of the Play Store cleanup) — enough to reach the
// tracker with no lending copy anywhere. A proper guided tour of the real features (receipt
// scan, net worth, split bills, commitments) is separate follow-up work, not done here.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Pip } from '../components/Pip';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { colors, uiFont } from '../theme';

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { completeOnboarding } = useAppData();
  const [busy, setBusy] = useState(false);

  async function getStarted() {
    if (busy) return;
    setBusy(true);
    try {
      await completeOnboarding();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 28,
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        <View style={styles.hero}>
          <Pip size={88} expr="happy" float />
          <Text style={[styles.title, { color: colorTheme.ink }]}>Welcome to Pip</Text>
          <Text style={[styles.subtitle, { color: colorTheme.ink2 }]}>
            Scan receipts, track income and expenses, and see your net worth in one place.
          </Text>
        </View>

        <Pressable
          style={[styles.primaryBtn, { backgroundColor: theme.accentInk }, busy && styles.btnBusy]}
          onPress={() => void getStarted()}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <>
              <Icon name="sparkles" size={16} color={colors.onAccent} />
              <Text style={styles.primaryBtnText}>Get started</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', marginBottom: 32 },
  title: { fontFamily: uiFont(800), fontSize: 27, marginTop: 18 },
  subtitle: {
    fontFamily: uiFont(500),
    fontSize: 14.5,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 999,
  },
  primaryBtnText: { fontFamily: uiFont(700), fontSize: 15.5, color: colors.onAccent },
  btnBusy: { opacity: 0.6 },
});
