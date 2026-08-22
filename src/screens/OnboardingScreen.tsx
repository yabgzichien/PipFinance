// src/screens/OnboardingScreen.tsx
// The app's front door: a 5-step setup wizard (Pip intro, budget, recurring payment,
// notifications, widget) rather than a single "Get started" screen. Every step after the
// intro can be skipped  there is deliberately no skip-all shortcut, so a user in a hurry
// skips step by step, which stays honest about what didn't get set up rather than silently
// marking everything done. See docs/superpowers/specs/2026-08-21-onboarding-setup-wizard-design.md.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn } from '../components/Motion';
import { ProgressTrack, TopBar } from '../components/ui';
import * as haptics from '../lib/haptics';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useBackHandler, useExitConfirm } from '../state/useBackHandler';
import { spacing } from '../theme';
import { BudgetStep } from './onboarding/BudgetStep';
import { NotificationsStep } from './onboarding/NotificationsStep';
import { PipIntroStep } from './onboarding/PipIntroStep';
import { RecurringPaymentStep } from './onboarding/RecurringPaymentStep';
import { WidgetStep } from './onboarding/WidgetStep';

const STEP_TITLES = ['', 'Budget', 'Recurring payment', 'Notifications', 'Widget'];
const TOTAL_STEPS = STEP_TITLES.length;
const LAST_STEP = TOTAL_STEPS - 1;

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const colorTheme = useThemeColors();
  const { completeOnboarding } = useAppData();
  const [step, setStep] = useState(0);
  // Which way the wizard last moved. Forward, the incoming step rises into place; back, it
  // settles down from above, so the direction of travel is legible without a slide transition.
  const [back, setBack] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const finish = () => {
    if (finishing) return;
    setFinishing(true);
    haptics.payoff();
    void completeOnboarding();
  };

  const advance = () => {
    if (step >= LAST_STEP) {
      finish();
      return;
    }
    setBack(false);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    haptics.tap();
    setBack(true);
    setStep((s) => s - 1);
  };

  // The wizard's intro step is the app's true front door — there's no screen further back to
  // fall through to, so hardware/gesture back gets the same "press again to exit" gate Home
  // uses once onboarding is done.
  const confirmExit = useExitConfirm();
  useBackHandler(() => {
    if (step > 0) {
      goBack();
      return true;
    }
    return confirmExit();
  });

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      {step > 0 && (
        <View style={{ paddingTop: insets.top + 4 }}>
          <TopBar title={STEP_TITLES[step]} onBack={goBack} />
          <View style={{ paddingHorizontal: 18, paddingTop: 2 }}>
            <ProgressTrack pct={((step + 1) / TOTAL_STEPS) * 100} height={5} />
          </View>
        </View>
      )}

      {/* Keyed on `step` so each step remounts and replays its entrance; the steps hold no
          state worth preserving across a move, and the back button re-enters an earlier one
          fresh rather than showing a half-filled form the user already skipped past. */}
      <FadeIn key={step} style={styles.fill} offset={back ? -14 : 16}>
        {step === 0 && <PipIntroStep onNext={advance} />}
        {step === 1 && <BudgetStep onNext={advance} onSkip={advance} />}
        {step === 2 && <RecurringPaymentStep onNext={advance} onSkip={advance} />}
        {step === 3 && <NotificationsStep onNext={advance} onSkip={advance} />}
        {step === 4 && <WidgetStep onFinish={finish} />}
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1, paddingTop: spacing.sm },
});
