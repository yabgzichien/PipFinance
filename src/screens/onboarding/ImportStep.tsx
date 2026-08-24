// src/screens/onboarding/ImportStep.tsx
// Step 1 of the setup wizard (after PipIntro): asks if the user wants to import from
// their previous money manager / spreadsheets / bank statements before doing manual setup.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { FadeIn } from '../../components/Motion';
import { Pip } from '../../components/Pip';
import { Body, BtnLabel, Card, Eyebrow, PrimaryButton, Title } from '../../components/ui';
import * as haptics from '../../lib/haptics';
import { useAccent } from '../../state/accent';
import { useThemeColors } from '../../state/colorScheme';
import { radius, spacing, uiFont } from '../../theme';
import { stagger } from '../../theme/motion';

const PIP_SIZE = 88;

export function ImportStep({
  hasImported,
  onStartImport,
  onSkip,
  onContinue,
}: {
  hasImported: boolean;
  onStartImport: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();

  const handleStartImport = () => {
    haptics.tap();
    onStartImport();
  };

  const handleSkip = () => {
    haptics.tap();
    onSkip();
  };

  const handleContinue = () => {
    haptics.tap();
    onContinue();
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: 140,
        flexGrow: 1,
        justifyContent: 'center',
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <FadeIn offset={14}>
          <Pip size={PIP_SIZE} expr={hasImported ? 'happy' : 'curious'} float />
        </FadeIn>
        <FadeIn delay={stagger}>
          <Title style={{ marginTop: spacing.base, textAlign: 'center' }}>
            {hasImported ? 'Your data is imported' : 'Switching from another tracker?'}
          </Title>
        </FadeIn>
        <FadeIn delay={stagger * 2}>
          <Body color={colorTheme.ink2} style={styles.subtitle}>
            {hasImported
              ? "You're all set. Continue to finish setting up Pip, or bring in another file first."
              : 'If you have data from an old money manager, bank statements, or spreadsheets, Pip can bring it all over with AI.'}
          </Body>
        </FadeIn>
      </View>

      <FadeIn delay={stagger * 3}>
        <Card style={[styles.infoCard, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <Eyebrow style={{ marginBottom: 8, color: colorTheme.ink }}>What Pip can import</Eyebrow>
          <View style={styles.benefitRow}>
            <View style={[styles.badge, { backgroundColor: theme.accentTint }]}>
              <Icon name="receipt" size={15} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.benefitTitle, { color: colorTheme.ink }]}>Transactions & spending</Text>
              <Text style={[styles.benefitDesc, { color: colorTheme.ink3 }]}>Past expenses and income automatically categorized</Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={[styles.badge, { backgroundColor: theme.accentTint }]}>
              <Icon name="wallet" size={15} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.benefitTitle, { color: colorTheme.ink }]}>Accounts & balances</Text>
              <Text style={[styles.benefitDesc, { color: colorTheme.ink3 }]}>Bank, e-wallet, savings & liability balances</Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={[styles.badge, { backgroundColor: theme.accentTint }]}>
              <Icon name="clock" size={15} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.benefitTitle, { color: colorTheme.ink }]}>Recurring bills</Text>
              <Text style={[styles.benefitDesc, { color: colorTheme.ink3 }]}>Monthly subscriptions and repeating commitments</Text>
            </View>
          </View>

          <View style={[styles.compatibleBox, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <Icon name="sparkles" size={13} color={theme.accent} />
            <Text style={[styles.compatibleText, { color: colorTheme.ink2 }]}>
              Works with Money Manager, Spendee, Wallet, Monefy, Excel, bank PDFs & statements.
            </Text>
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={stagger * 4} style={styles.footer}>
        {hasImported ? (
          <>
            <PrimaryButton onPress={handleContinue}>
              <BtnLabel>Continue</BtnLabel>
              <Icon name="arrowRight" size={18} color="#fff" />
            </PrimaryButton>
            <Pressable
              onPress={handleStartImport}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
              accessibilityRole="button"
              accessibilityLabel="Import something else instead"
            >
              <Text style={[styles.skipText, { color: colorTheme.ink2 }]}>
                Import something else instead
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <PrimaryButton onPress={handleStartImport}>
              <Icon name="sparkles" size={18} color="#fff" />
              <BtnLabel>Import from old money manager</BtnLabel>
            </PrimaryButton>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
              accessibilityRole="button"
              accessibilityLabel="I don't have anything to import, start fresh"
            >
              <Text style={[styles.skipText, { color: colorTheme.ink2 }]}>
                I don't have anything to import
              </Text>
            </Pressable>
          </>
        )}
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  subtitle: { marginTop: spacing.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.sm },
  infoCard: { padding: spacing.base, borderRadius: radius.md, borderWidth: 1, gap: 12, marginBottom: spacing.lg },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { fontFamily: uiFont(700), fontSize: 13.5 },
  benefitDesc: { fontFamily: uiFont(500), fontSize: 12, marginTop: 1 },
  compatibleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  compatibleText: { fontFamily: uiFont(500), fontSize: 11.5, flex: 1, lineHeight: 16 },
  footer: { gap: spacing.sm },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipPressed: { opacity: 0.55 },
  skipText: { fontFamily: uiFont(600), fontSize: 13.5 },
});
