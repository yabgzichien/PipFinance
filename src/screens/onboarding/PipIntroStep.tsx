// src/screens/onboarding/PipIntroStep.tsx
// Step 1 of the setup wizard: the same front-door content the old single-screen
// OnboardingScreen showed, now leading into more setup instead of finishing it.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { FadeIn } from '../../components/Motion';
import { Pip } from '../../components/Pip';
import { Body, BtnLabel, Title } from '../../components/ui';
import * as haptics from '../../lib/haptics';
import { useAccent } from '../../state/accent';
import { useThemeColors } from '../../state/colorScheme';
import { colors, spacing } from '../../theme';
import { stagger } from '../../theme/motion';

export function PipIntroStep({ onNext }: { onNext: () => void }) {
  const theme = useAccent();
  const colorTheme = useThemeColors();

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        {/* The app's first frame, so it earns a staged reveal: Pip lands, then the promise,
            then the explanation, then the way forward. */}
        <View style={styles.hero}>
          <FadeIn offset={16}>
            <Pip size={88} expr="happy" float />
          </FadeIn>
          <FadeIn delay={stagger * 2}>
            <Title style={{ marginTop: spacing.base }}>Know your money.</Title>
          </FadeIn>
          <FadeIn delay={stagger * 3}>
            <Body color={colorTheme.ink2} style={styles.subtitle}>
              Screenshot the app you already have open, Grab, Touch 'n Go, Maybank, whatever it
              is, and Pip reads the numbers.
            </Body>
          </FadeIn>
        </View>

        <FadeIn delay={stagger * 4}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.accentInk },
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={() => {
              haptics.tap();
              onNext();
            }}
            accessibilityRole="button"
          >
            <Icon name="sparkles" size={16} color={colors.onAccent} />
            <BtnLabel>Next</BtnLabel>
          </Pressable>
        </FadeIn>
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
  // Matches <PrimaryButton>'s press feedback, since this button looks the same but isn't one.
  primaryBtnPressed: { opacity: 0.94, transform: [{ scale: 0.98 }] },
});
