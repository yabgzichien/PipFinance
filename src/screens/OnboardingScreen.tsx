// src/screens/OnboardingScreen.tsx
// The app's front door: a one-tap welcome screen before the tracker's empty state.
//
// This is a minimal placeholder (Stage 1 of the Play Store cleanup) — enough to reach the
// tracker with no lending copy anywhere. A proper guided tour of the real features (receipt
// scan, net worth, split bills, commitments) is separate follow-up work, not done here
// (docs/ui-design-plan.md §7). What did change here: the tagline and mechanism replace a
// sentence that led with "Scan receipts" — the one claim a Malaysian competitor already owns
// and the business plan says not to compete on (docs/ui-design-plan.md §7, business-plan.md §3).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Pip } from '../components/Pip';
import { Body, BtnLabel, Title } from '../components/ui';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { colors, spacing } from '../theme';

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
          padding: spacing.lg,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        <View style={styles.hero}>
          <Pip size={88} expr="happy" float />
          <Title style={{ marginTop: spacing.base }}>Know your money.</Title>
          <Body color={colorTheme.ink2} style={styles.subtitle}>
            Screenshot the app you already have open, Grab, Touch 'n Go, Maybank, whatever it
            is, and Pip reads the numbers so you don't have to type them in.
          </Body>
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
              <BtnLabel>Get started</BtnLabel>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: 999,
  },
  btnBusy: { opacity: 0.6 },
});
