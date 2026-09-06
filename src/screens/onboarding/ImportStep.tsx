// src/screens/onboarding/ImportStep.tsx
// Step 1 of the setup wizard (after PipIntro): allows users to either restore a full
// Pip backup (local .zip or Google Drive) or import from another money manager / spreadsheets.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { FadeIn } from '../../components/Motion';
import { Pip } from '../../components/Pip';
import { RestoreBackupModal } from '../../components/RestoreBackupModal';
import { Body, BtnLabel, PrimaryButton, Title } from '../../components/ui';
import { useLanguage } from '../../i18n';
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
  onLoadBackup,
}: {
  hasImported: boolean;
  onStartImport: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onLoadBackup?: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t } = useLanguage();

  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const handleStartImport = () => {
    haptics.tap();
    onStartImport();
  };

  const handleOpenRestore = () => {
    haptics.tap();
    if (onLoadBackup) {
      onLoadBackup();
    } else {
      setShowRestoreModal(true);
    }
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
    <>
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
              {hasImported ? t('importDoneTitle') : t('importOptionsTitle')}
            </Title>
          </FadeIn>
          <FadeIn delay={stagger * 2}>
            <Body color={colorTheme.ink2} style={styles.subtitle}>
              {hasImported
                ? t('importDoneSubtitle')
                : t('importOptionsSubtitle')}
            </Body>
          </FadeIn>
        </View>

        {!hasImported ? (
          <FadeIn delay={stagger * 3} style={styles.cardsContainer}>
            {/* Option 1: Load Pip Backup */}
            <Pressable
              onPress={handleOpenRestore}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  backgroundColor: colorTheme.surface,
                  borderColor: colorTheme.line2,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('importLoadBackupTitle')}
            >
              <View style={[styles.badge, { backgroundColor: theme.accentTint }]}>
                <Icon name="folder" size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: colorTheme.ink }]}>
                  {t('importLoadBackupTitle')}
                </Text>
                <Text style={[styles.optionDesc, { color: colorTheme.ink2 }]}>
                  {t('importLoadBackupDesc')}
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
            </Pressable>

            {/* Option 2: Advanced Import */}
            <Pressable
              onPress={handleStartImport}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  backgroundColor: colorTheme.surface,
                  borderColor: colorTheme.line2,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('importAdvancedTitle')}
            >
              <View style={[styles.badge, { backgroundColor: theme.accentTint }]}>
                <Icon name="sparkles" size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: colorTheme.ink }]}>
                  {t('importAdvancedTitle')}
                </Text>
                <Text style={[styles.optionDesc, { color: colorTheme.ink2 }]}>
                  {t('importAdvancedDesc')}
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
            </Pressable>
          </FadeIn>
        ) : null}

        <FadeIn delay={stagger * 4} style={styles.footer}>
          {hasImported ? (
            <>
              <PrimaryButton onPress={handleContinue}>
                <BtnLabel>{t('importContinue')}</BtnLabel>
                <Icon name="arrowRight" size={18} color="#fff" />
              </PrimaryButton>
              <Pressable
                onPress={handleStartImport}
                style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('importSomethingElse')}
              >
                <Text style={[styles.skipText, { color: colorTheme.ink2 }]}>
                  {t('importSomethingElse')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleOpenRestore}
                style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('importOrRestoreBackup')}
              >
                <Text style={[styles.restoreAltText, { color: theme.accent }]}>
                  {t('importOrRestoreBackup')}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('importNoDataStartFresh')}
            >
              <Text style={[styles.skipText, { color: colorTheme.ink2 }]}>
                {t('importNoDataStartFresh')}
              </Text>
            </Pressable>
          )}
        </FadeIn>
      </ScrollView>

      <RestoreBackupModal
        visible={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  subtitle: { marginTop: spacing.xs, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing.sm },
  cardsContainer: { gap: 12, marginBottom: spacing.xl },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontFamily: uiFont(700),
    fontSize: 15,
  },
  optionDesc: {
    fontFamily: uiFont(500),
    fontSize: 12.5,
    marginTop: 2,
  },
  footer: { gap: spacing.xs },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipPressed: { opacity: 0.55 },
  skipText: { fontFamily: uiFont(600), fontSize: 13.5 },
  restoreAltText: { fontFamily: uiFont(600), fontSize: 13 },
});
