// src/screens/OnboardingScreen.tsx
// The app's front door setup wizard:
// 1. Pip intro: "Know your money."
// 2. Old money manager import ask:
//    - If user imports via Advanced Import: branches directly to Notifications -> Widget.
//    - If user has nothing to import: branches to Budget -> Recurring payment -> Notifications -> Widget.
// Every step after the intro can be skipped individually.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn } from '../components/Motion';
import { ProgressTrack, TopBar } from '../components/ui';
import * as haptics from '../lib/haptics';
import {
  getPreviousWizardStep,
  getWizardNavInfo,
  type WizardStep,
} from '../lib/onboardingNav';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useBackHandler, useExitConfirm } from '../state/useBackHandler';
import { useLanguage } from '../i18n';
import { spacing } from '../theme';
import { AdvancedImportScreen } from './AdvancedImportScreen';
import { BudgetStep } from './onboarding/BudgetStep';
import { ImportStep } from './onboarding/ImportStep';
import { NotificationsStep } from './onboarding/NotificationsStep';
import { PipIntroStep } from './onboarding/PipIntroStep';
import { RecurringPaymentStep } from './onboarding/RecurringPaymentStep';
import { WidgetStep } from './onboarding/WidgetStep';

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const colorTheme = useThemeColors();
  const { completeOnboarding } = useAppData();
  const { t } = useLanguage();

  const [step, setStep] = useState<WizardStep>('intro');
  const [hasImported, setHasImported] = useState(false);
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

  const advance = (nextStep: WizardStep) => {
    setBack(false);
    setStep(nextStep);
  };

  const goBack = () => {
    const prev = getPreviousWizardStep(step, hasImported);
    if (!prev) return;
    haptics.tap();
    setBack(true);
    setStep(prev);
  };

  // The wizard's intro step is the app's true front door — there's no screen further back to
  // fall through to, so hardware/gesture back gets the same "press again to exit" gate Home
  // uses once onboarding is done.
  const confirmExit = useExitConfirm();
  useBackHandler(() => {
    if (step !== 'intro') {
      goBack();
      return true;
    }
    return confirmExit();
  });

  const navInfo = getWizardNavInfo(step, hasImported);

  const getLocalizedWizardTitle = (title: string) => {
    switch (title) {
      case 'Import data':
        return t('wizardImportTitle');
      case 'Budget':
        return t('wizardBudgetTitle');
      case 'Recurring payment':
        return t('wizardRecurringTitle');
      case 'Notifications':
        return t('wizardNotificationsTitle');
      case 'Widget':
        return t('wizardWidgetTitle');
      default:
        return title;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      {navInfo && (
        <View style={{ paddingTop: insets.top + 4 }}>
          <TopBar title={getLocalizedWizardTitle(navInfo.title)} onBack={goBack} />
          <View style={{ paddingHorizontal: 18, paddingTop: 2 }}>
            <ProgressTrack pct={navInfo.progressPct} height={5} />
          </View>
        </View>
      )}

      {/* Keyed on `step` so each step remounts and replays its entrance; the steps hold no
          state worth preserving across a move, and the back button re-enters an earlier one
          fresh rather than showing a half-filled form the user already skipped past. */}
      <FadeIn key={step} style={styles.fill} offset={back ? -14 : 16}>
        {step === 'intro' && <PipIntroStep onNext={() => advance('import')} />}
        {step === 'import' && (
          <ImportStep
            hasImported={hasImported}
            onStartImport={() => advance('advanced_import')}
            onSkip={() => {
              setHasImported(false);
              advance('budget');
            }}
            onContinue={() => advance('notifications')}
          />
        )}
        {step === 'advanced_import' && (
          <AdvancedImportScreen
            onClose={goBack}
            onSuccess={() => {
              setHasImported(true);
              advance('notifications');
            }}
            isWizard
          />
        )}
        {step === 'budget' && (
          <BudgetStep
            onNext={() => advance('recurring')}
            onSkip={() => advance('recurring')}
          />
        )}
        {step === 'recurring' && (
          <RecurringPaymentStep
            onNext={() => advance('notifications')}
            onSkip={() => advance('notifications')}
          />
        )}
        {step === 'notifications' && (
          <NotificationsStep
            onNext={() => advance('widget')}
            onSkip={() => advance('widget')}
          />
        )}
        {step === 'widget' && <WidgetStep onFinish={finish} />}
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1, paddingTop: spacing.sm },
});
