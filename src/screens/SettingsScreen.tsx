import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { Pip } from '../components/Pip';
import { Card, Eyebrow, TopBar } from '../components/ui';
import { getActiveCurrencies } from '../db/currencyRepo';
import { clearMemory } from '../db/memoryRepo';
import { getProvider, llmErrorMessage } from '../llm';
import { isMultiCurrency } from '../lib/currency';
import { fmtMoney } from '../lib/format';
import { confirmAction, notify } from '../lib/platformAlert';
import { filterSettings } from '../lib/settingsSearch';
import { configFor, loadSettings, type LLMSettings, type ProviderRole } from '../settings/settingsStore';
import { cadenceLabel, REMINDER_CADENCES } from '../lib/reminders';
import * as sound from '../lib/sound';
import { ensurePermission } from '../notifications';
import { useAccent, useAccentPreset } from '../state/accent';
import { useColorSchemeMode, useThemeColors, type ColorSchemeMode } from '../state/colorScheme';
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { radius, uiFont } from '../theme';
import { motionSettingLabel, MOTION_SETTINGS } from '../theme/motion';

type TestState = { status: 'idle' | 'busy' | 'ok' | 'fail'; message?: string };

export function SettingsScreen({ onBack, onAdvancedImport, onOpenExport, onOpenCategories, onOpenCommitments, onOpenTax, onOpenCurrencySettings, onResetToOnboarding, taxRequestableCount = 0 }: { onBack: () => void; onAdvancedImport?: () => void; onOpenExport?: () => void; onOpenCategories?: () => void; onOpenCommitments?: () => void; onOpenTax?: () => void; onOpenCurrencySettings?: () => void; onResetToOnboarding?: () => void; taxRequestableCount?: number }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const dc = useDisplayCurrency();
  const { t, formatCadence, formatMotion, isZh } = useLanguage();
  const { memory, refreshAll, expectedIncome, allocations, hasBudget, resetBudget, resetAllData, resetToOnboarding, resetTutorial } = useAppData();
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [activeCurrencies, setActiveCurrencies] = useState<string[]>(['MYR']);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSettings().then(setSettings);
    getActiveCurrencies().then(setActiveCurrencies);
  }, []);

  const learnedCount = Object.keys(memory).length;

  const resetLearned = () => {
    if (learnedCount === 0) return;
    confirmAction(t('resetLearningTitle'), t('resetLearningBody', { count: learnedCount }), t('reset'), async () => {
      await clearMemory();
      await refreshAll();
    });
  };

  const allocationCount = Object.keys(allocations).length;
  const resetBudgetConfirm = () => {
    if (!hasBudget) return;
    confirmAction(t('resetBudgetTitle'), t('resetBudgetBody'), t('reset'), () => resetBudget());
  };

  const resetAllConfirm = () => {
    confirmAction(
      t('resetAllDataTitle'),
      t('resetAllDataBody'),
      t('reset'),
      () => resetAllData()
    );
  };

  const resetToOnboardingConfirm = () => {
    confirmAction(
      t('resetToSetupTitle'),
      t('resetToSetupBody'),
      t('reset'),
      async () => {
        await resetToOnboarding();
        onResetToOnboarding?.();
      }
    );
  };

  if (!settings) {
    return (
      <View style={[styles.root, { backgroundColor: colorTheme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const { matchingKeys, isSearching, matchingSections } = filterSettings(search, {
    data_currencies: activeCurrencies,
  });

  const hasVisibleAppearanceCard =
    matchingKeys.has('theme') ||
    matchingKeys.has('language') ||
    matchingKeys.has('accent') ||
    matchingKeys.has('motion') ||
    matchingKeys.has('sounds') ||
    matchingKeys.has('streak');

  const hasVisibleRemindersCard =
    Platform.OS !== 'web' &&
    (matchingKeys.has('reminder_spending') ||
      matchingKeys.has('reminder_owed') ||
      matchingKeys.has('reminder_commitments'));

  const hasVisibleAiCard =
    __DEV__ &&
    (matchingKeys.has('ai_groq') || matchingKeys.has('ai_gemini'));

  const hasVisibleDataCard =
    (Boolean(onOpenCommitments) && matchingKeys.has('data_commitments')) ||
    (Boolean(onOpenTax) && matchingKeys.has('data_tax')) ||
    (Boolean(onOpenCategories) && matchingKeys.has('data_categories')) ||
    (Boolean(onOpenCurrencySettings) && matchingKeys.has('data_currencies')) ||
    (Boolean(onAdvancedImport) && matchingKeys.has('data_import')) ||
    (Boolean(onOpenExport) && matchingKeys.has('data_export')) ||
    matchingKeys.has('data_tutorial');

  const hasVisibleDangerCard =
    matchingKeys.has('danger_reset_all') || matchingKeys.has('danger_reset_setup');

  const hasAnyVisibleSetting =
    hasVisibleAppearanceCard ||
    hasVisibleRemindersCard ||
    hasVisibleAiCard ||
    (matchingSections.has('learning') && matchingKeys.has('learning')) ||
    (matchingSections.has('budget') && matchingKeys.has('budget')) ||
    hasVisibleDataCard ||
    hasVisibleDangerCard;

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title={t('settingsTitle')} onBack={onBack} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* Search bar */}
        <View style={[styles.searchRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }]}>
          <Icon name="search" size={16} color={colorTheme.ink3} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchSettingsPlaceholder')}
            placeholderTextColor={colorTheme.ink3}
            style={[styles.searchInput, { color: colorTheme.ink }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel={t('clear')}>
              <Icon name="x" size={15} color={colorTheme.ink3} />
            </Pressable>
          )}
        </View>

        {isSearching && !hasAnyVisibleSetting && (
          <View style={styles.emptyWrap}>
            <Pip size={60} expr="curious" />
            <Text style={[styles.emptyTitle, { color: colorTheme.ink }]}>
              {t('noSettingsFound', { query: search.trim() })}
            </Text>
            <Text style={[styles.emptySub, { color: colorTheme.ink2 }]}>
              {t('noSettingsFoundSub')}
            </Text>
            <Pressable
              onPress={() => setSearch('')}
              style={({ pressed }) => [
                styles.clearSearchBtn,
                { backgroundColor: theme.accentTint, borderColor: theme.accentSoft },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Icon name="x" size={15} color={theme.accent} />
              <Text style={[styles.clearSearchBtnText, { color: theme.accent }]}>{t('clear')}</Text>
            </Pressable>
          </View>
        )}

        {matchingSections.has('appearance') && hasVisibleAppearanceCard && (
          <>
            <Eyebrow style={{ marginBottom: 10 }}>{t('appearance')}</Eyebrow>
            <View style={{ gap: 12 }}>
              {matchingKeys.has('theme') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('theme')}</Text>
                  <ThemeModePicker />
                </Card>
              )}
              {matchingKeys.has('language') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('language')}</Text>
                  <LanguagePicker />
                </Card>
              )}
              {matchingKeys.has('accent') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('accentColor')}</Text>
                  <AccentColorPicker />
                </Card>
              )}
              {matchingKeys.has('motion') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('motionAndHaptics')}</Text>
                  <MotionSettingPicker />
                </Card>
              )}
              {matchingKeys.has('sounds') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('sounds')}</Text>
                  <SoundPicker />
                </Card>
              )}
              {matchingKeys.has('streak') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('streak')}</Text>
                  <StreakPausePicker />
                </Card>
              )}
            </View>
          </>
        )}

        {/* Hidden on web rather than disabled: expo-notifications has no web support, and a
            control that silently does nothing is worse than one that is not offered. */}
        {Platform.OS !== 'web' && matchingSections.has('reminders') && hasVisibleRemindersCard && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>{t('reminders')}</Eyebrow>
            <View style={{ gap: 12 }}>
              {matchingKeys.has('reminder_spending') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('logSpendingReminder')}</Text>
                  <LogReminderPicker />
                  <ReminderHourOverridePicker />
                </Card>
              )}
              {matchingKeys.has('reminder_owed') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('chaseOwedReminder')}</Text>
                  <OwedReminderPicker />
                </Card>
              )}
              {matchingKeys.has('reminder_commitments') && (
                <Card style={{ padding: 16 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>{t('recurringBillsReminder')}</Text>
                  <CommitmentReminderPicker />
                </Card>
              )}
            </View>
          </>
        )}

        {/* Provider/API-key rows are a dev-ops concern, not a judge-facing one (UI/UX
            P3.18): visible locally (__DEV__), stripped from the shipped judge build. */}
        {__DEV__ && matchingSections.has('ai') && hasVisibleAiCard && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>AI providers</Eyebrow>
            <View style={{ gap: 14 }}>
              {matchingKeys.has('ai_groq') && (
                <ProviderCard
                  settings={settings}
                  role="general"
                  icon="sparkles"
                  name="Groq · primary"
                  model={settings.groqModel}
                  apiKey={settings.groqKey}
                />
              )}
              {matchingKeys.has('ai_gemini') && (
                <ProviderCard
                  settings={settings}
                  role="docs"
                  icon="receipt"
                  name="Gemini · fallback"
                  model={settings.geminiModel}
                  apiKey={settings.geminiKey}
                />
              )}
            </View>
          </>
        )}

        {matchingSections.has('learning') && matchingKeys.has('learning') && (
          <>
            <View style={[styles.eyebrowRow, { marginTop: 26, marginBottom: 10 }]}>
              <Eyebrow>{t('learning')}</Eyebrow>
              <InfoButton entry="learned_merchants" />
            </View>
            <Card style={{ padding: 16 }}>
              <View style={styles.providerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink }]}>
                    {t('learnedMerchantsCount', { count: learnedCount })}
                  </Text>
                </View>
                <Pressable onPress={resetLearned} disabled={learnedCount === 0} style={styles.resetBtn}>
                  <Icon name="trash" size={16} color={learnedCount === 0 ? colorTheme.ink3 : '#b3261e'} />
                  <Text style={[styles.resetText, { color: learnedCount === 0 ? colorTheme.ink3 : '#b3261e' }]}>{t('reset')}</Text>
                </Pressable>
              </View>
            </Card>
          </>
        )}

        {matchingSections.has('budget') && matchingKeys.has('budget') && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>{t('budget')}</Eyebrow>
            <Card style={{ padding: 16 }}>
              <View style={styles.providerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerName, { color: colorTheme.ink }]}>
                    {hasBudget
                      ? t('budgetSummary', { income: fmtMoney(dc.convert(expectedIncome), dc.code), count: allocationCount })
                      : t('noBudgetSet')}
                  </Text>
                </View>
                <Pressable onPress={resetBudgetConfirm} disabled={!hasBudget} style={styles.resetBtn}>
                  <Icon name="trash" size={16} color={!hasBudget ? colorTheme.ink3 : '#b3261e'} />
                  <Text style={[styles.resetText, { color: !hasBudget ? colorTheme.ink3 : '#b3261e' }]}>{t('reset')}</Text>
                </Pressable>
              </View>
            </Card>
          </>
        )}

        {matchingSections.has('data') && hasVisibleDataCard && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>{t('data')}</Eyebrow>
            <View style={{ gap: 12 }}>
              {onOpenCommitments && matchingKeys.has('data_commitments') && (
                <Pressable
                  onPress={onOpenCommitments}
                  style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
                    <Icon name="clock" size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('recurringBillsInvestments')}</Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                </Pressable>
              )}

              {onOpenTax && matchingKeys.has('data_tax') && (
                <Pressable
                  onPress={onOpenTax}
                  style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
                    <Icon name="receipt" size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('taxRelief')}</Text>
                  </View>
                  {taxRequestableCount > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
                      <Text style={styles.countBadgeText}>{taxRequestableCount}</Text>
                    </View>
                  )}
                  <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                </Pressable>
              )}

              {onOpenCategories && matchingKeys.has('data_categories') && (
                <Pressable
                  onPress={onOpenCategories}
                  style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
                    <Icon name="sliders" size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('categories')}</Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                </Pressable>
              )}

              {onOpenCurrencySettings && matchingKeys.has('data_currencies') && (
                <Pressable
                  onPress={onOpenCurrencySettings}
                  style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
                    <Icon name="wallet" size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('currencies')}</Text>
                    <Text style={[styles.providerSub, { color: colorTheme.ink2 }]}>
                      {isMultiCurrency(activeCurrencies) ? activeCurrencies.join(', ') : (isZh ? '仅限 MYR' : 'MYR only')}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                </Pressable>
              )}

              {onAdvancedImport && matchingKeys.has('data_import') && (
                <Pressable
                  onPress={onAdvancedImport}
                  style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
                    <Icon name="sparkles" size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('advancedImport')}</Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                </Pressable>
              )}

              {onOpenExport && matchingKeys.has('data_export') && (
                <Pressable
                  onPress={onOpenExport}
                  style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
                    <Icon name="download" size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('financialReportsExport')}</Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                </Pressable>
              )}

              {matchingKeys.has('data_tutorial') && (
                <Pressable
                  onPress={async () => {
                    await resetTutorial();
                    notify(t('tutorialTitle'), t('tutorialReplayedToast'));
                  }}
                  style={({ pressed }) => [
                    styles.providerRow,
                    styles.migrateRow,
                    { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 },
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
                    <Icon name="sparkles" size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('replayTutorial')}</Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Distinct "danger zone" treatment  this is the one irreversible action on this
            screen, so it shouldn't look like every other settings row. */}
        {matchingSections.has('danger') && hasVisibleDangerCard && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10, color: '#b3261e' }}>{t('dangerZone')}</Eyebrow>
            <View style={{ gap: 10 }}>
              {matchingKeys.has('danger_reset_all') && (
                <Card style={[{ padding: 16 }, styles.dangerCard]}>
                  <View style={styles.providerRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="alert" size={13} color="#b3261e" />
                        <Text style={[styles.providerName, { color: '#b3261e' }]}>{t('resetAllData')}</Text>
                      </View>
                    </View>
                    <Pressable onPress={resetAllConfirm} style={styles.resetBtn}>
                      <Icon name="trash" size={16} color="#b3261e" />
                      <Text style={[styles.resetText, { color: '#b3261e' }]}>{t('reset')}</Text>
                    </Pressable>
                  </View>
                </Card>
              )}

              {matchingKeys.has('danger_reset_setup') && (
                <Card style={[{ padding: 16, marginTop: 10 }, styles.dangerCard]}>
                  <View style={styles.providerRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="alert" size={13} color="#b3261e" />
                        <Text style={[styles.providerName, { color: '#b3261e' }]}>{t('resetToSetup')}</Text>
                      </View>
                    </View>
                    <Pressable onPress={resetToOnboardingConfirm} style={styles.resetBtn}>
                      <Icon name="trash" size={16} color="#b3261e" />
                      <Text style={[styles.resetText, { color: '#b3261e' }]}>{t('reset')}</Text>
                    </Pressable>
                  </View>
                </Card>
              )}
            </View>
          </>
        )}

        {/* Legal & Trademarks Disclaimer */}
        <View style={styles.legalSection}>
          <Text style={[styles.legalTitle, { color: colorTheme.ink3 }]}>
            {t('legalTrademarksTitle')}
          </Text>
          <Text style={[styles.legalText, { color: colorTheme.ink3 }]}>
            {t('legalTrademarksNotice')}
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Ask for notification permission before persisting an "on" choice.
 *
 * Turning a reminder on while the OS has notifications blocked would leave the pill claiming
 * something the phone will never do, so a refusal leaves the setting where it was and says why.
 * Turning one off never asks: you can always opt out.
 */
async function withPermission(turningOn: boolean, apply: () => Promise<void>, isZh?: boolean): Promise<void> {
  if (turningOn && !(await ensurePermission())) {
    notify(
      isZh ? '通知已被关闭' : 'Notifications are off',
      isZh ? '您的设备已禁止 Pip 发送通知。请在系统设置中开启后重试。' : 'Your phone is blocking notifications for Pip. Turn them on in your device settings and then try again.'
    );
    return;
  }
  await apply();
}

/** Language selector: English / 简体中文 */
function LanguagePicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { language, setLanguage } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {(['en', 'zh'] as const).map((lang) => {
        const on = language === lang;
        return (
          <Pressable
            key={lang}
            onPress={() => setLanguage(lang)}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {lang === 'en' ? 'English' : '简体中文'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Off / Daily / Weekly, same pill shape as ThemeModePicker. */
function LogReminderPicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { reminderCadence, setReminderCadence } = useAppData();
  const { formatCadence, isZh } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {REMINDER_CADENCES.map((cadence) => {
        const on = reminderCadence === cadence;
        return (
          <Pressable
            key={cadence}
            onPress={() => withPermission(cadence !== 'off', () => setReminderCadence(cadence), isZh)}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {formatCadence(cadence)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const REMINDER_HOUR_OVERRIDE_OPTIONS: { hour: number | null; label: string }[] = [
  { hour: null, label: 'Auto' },
  { hour: 21, label: '9 PM' },
  { hour: 22, label: '10 PM' },
  { hour: 23, label: '11 PM' },
];

/** Auto / 9 PM / 10 PM / 11 PM, same pill shape as ThemeModePicker. Hidden once the log
 *  reminder itself is off, since a fire-hour override is meaningless with nothing scheduled to fire
 *  (docs/ui-engagement-plan.md Step 7, item 1: autonomy over the behaviour-inferred hour). */
function ReminderHourOverridePicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { reminderCadence, reminderHourOverride, setReminderHourOverride } = useAppData();
  const { t } = useLanguage();
  if (reminderCadence === 'off') return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[styles.providerSub, { color: colorTheme.ink2, marginBottom: 8 }]}>{t('reminderWhen')}</Text>
      <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
        {REMINDER_HOUR_OVERRIDE_OPTIONS.map((opt) => {
          const on = reminderHourOverride === opt.hour;
          return (
            <Pressable
              key={opt.label}
              onPress={() => void setReminderHourOverride(opt.hour)}
              style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
                {opt.hour === null ? t('reminderAuto') : opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Two-pill Off/On. The app has no Switch anywhere, so a boolean reads as a segmented pair. */
function OwedReminderPicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { owedReminderEnabled, setOwedReminderEnabled } = useAppData();
  const { t, isZh } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {[false, true].map((value) => {
        const on = owedReminderEnabled === value;
        return (
          <Pressable
            key={String(value)}
            onPress={() => withPermission(value, () => setOwedReminderEnabled(value), isZh)}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {value ? t('on') : t('off')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two-pill Off/On, same shape as OwedReminderPicker. */
function CommitmentReminderPicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { commitmentReminderEnabled, setCommitmentReminderEnabled } = useAppData();
  const { t, isZh } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {[false, true].map((value) => {
        const on = commitmentReminderEnabled === value;
        return (
          <Pressable
            key={String(value)}
            onPress={() => withPermission(value, () => setCommitmentReminderEnabled(value), isZh)}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {value ? t('on') : t('off')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const THEME_MODE_OPTIONS: { mode: ColorSchemeMode; key: 'themeLight' | 'themeDark' | 'themeSystem' }[] = [
  { mode: 'light', key: 'themeLight' },
  { mode: 'dark', key: 'themeDark' },
  { mode: 'system', key: 'themeSystem' },
];

/** 3-way Light/Dark/System segmented control, same pill shape as ui.tsx's ValueToggle. */
function ThemeModePicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { mode, setMode } = useColorSchemeMode();
  const { t } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {THEME_MODE_OPTIONS.map((opt) => {
        const on = mode === opt.mode;
        return (
          <Pressable key={opt.mode} onPress={() => setMode(opt.mode)} style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}>
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>{t(opt.key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two-pill On/Paused, same shape as OwedReminderPicker (docs/ui-engagement-plan.md Step 4).
 *  "On" is first and reads as the affirmative state, matching every other reminder pair on this
 *  screen; "Paused" is the one the user reaches for, not the default. */
function StreakPausePicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { streakPaused, pauseStreak, resumeStreak } = useAppData();
  const { t } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {[false, true].map((paused) => {
        const on = streakPaused === paused;
        return (
          <Pressable
            key={String(paused)}
            onPress={() => void (paused ? pauseStreak() : resumeStreak())}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {paused ? t('paused') : t('on')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Full/Reduced/Off, same pill shape as ThemeModePicker (docs/ui-engagement-plan.md Step 1). */
function MotionSettingPicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { motionSetting, setMotionSetting } = useAppData();
  const { formatMotion } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {MOTION_SETTINGS.map((setting) => {
        const on = motionSetting === setting;
        return (
          <Pressable
            key={setting}
            onPress={() => void setMotionSetting(setting)}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {formatMotion(setting)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two-pill Off/On for the save chime, same shape as OwedReminderPicker. Turning it on plays
 *  the chime immediately so the user hears what they just chose without staging a save. */
function SoundPicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { soundEnabled, setSoundEnabled } = useAppData();
  const { t } = useLanguage();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {[false, true].map((value) => {
        const on = soundEnabled === value;
        return (
          <Pressable
            key={String(value)}
            onPress={async () => {
              await setSoundEnabled(value);
              if (value) sound.payoff();
            }}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {value ? t('on') : t('off')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Row of preset swatches for picking the app's accent color, plus live app icon preview */
function AccentColorPicker() {
  const colorTheme = useThemeColors();
  const { presetId, setPresetId, presets } = useAccentPreset();
  const { t } = useLanguage();
  const activePreset = presets.find((p) => p.id === presetId) ?? presets[0];

  return (
    <View style={{ gap: 14 }}>
      <View style={[styles.iconPreviewCard, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
        <View style={[styles.iconSquircle, { backgroundColor: activePreset.theme.light.accent }]}>
          <View style={{ transform: [{ translateY: 3 }] }}>
            <Pip size={38} />
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[styles.iconPreviewTitle, { color: colorTheme.ink }]}>
            {t('appIcon')}: {activePreset.name}
          </Text>
          <Text style={[styles.iconPreviewSub, { color: colorTheme.ink2 }]}>
            {t('appIconDesc')}
          </Text>
        </View>
      </View>

      <View style={styles.swatchWrap}>
        {presets.map((preset) => {
          const on = preset.id === presetId;
          return (
            <Pressable
              key={preset.id}
              onPress={() => setPresetId(preset.id)}
              style={[styles.swatch, { backgroundColor: preset.theme.light.accent }, on && { borderColor: colorTheme.ink, borderWidth: 2.5 }]}
              accessibilityRole="radio"
              accessibilityLabel={preset.name}
              accessibilityState={{ selected: on }}
            >
              {on && <Icon name="check" size={15} color="#fff" stroke={2.6} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One fixed provider: shows its pinned model and a connection test (key is never displayed). */
function ProviderCard({
  settings,
  role,
  icon,
  name,
  model,
  apiKey,
}: {
  settings: LLMSettings;
  role: ProviderRole;
  icon: IconName;
  name: string;
  model: string;
  apiKey: string;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const runTest = async () => {
    const cfg = configFor(settings, role);
    const keys = cfg.apiKey.split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      setTest({ status: 'fail', message: 'No API key is configured.' });
      return;
    }
    setTest({ status: 'busy' });
    try {
      let ok = false;
      let lastErr: unknown;
      for (const k of keys) {
        try {
          await getProvider(cfg.provider).test({ apiKey: k, model: cfg.model.trim() });
          ok = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (ok) {
        setTest({ status: 'ok', message: `Connected to ${getProvider(cfg.provider).label}.` });
      } else {
        throw lastErr;
      }
    } catch (e) {
      setTest({ status: 'fail', message: `${getProvider(cfg.provider).label}: ${llmErrorMessage(e)}` });
    }
  };

  return (
    <Card style={{ padding: 16, gap: 14 }}>
      <View style={styles.providerRow}>
        <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
          <Icon name={icon} size={16} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.providerName, { color: colorTheme.ink }]}>{name}</Text>
        </View>
      </View>

      <ReadonlyField label="Model">
        <Text style={[styles.fieldValue, { color: colorTheme.ink }]}>{model}</Text>
      </ReadonlyField>

      <Pressable
        onPress={runTest}
        style={({ pressed }) => [styles.testBtn, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }, pressed && { opacity: 0.9 }]}
      >
        {test.status === 'busy' ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <>
            <Icon name="check" size={16} color={theme.accent} stroke={2.4} />
            <Text style={[styles.testBtnText, { color: theme.accent }]}>Test connection</Text>
          </>
        )}
      </Pressable>

      {test.status === 'ok' && <Text style={[styles.result, { color: theme.accentInk }]}>✓ {test.message}</Text>}
      {test.status === 'fail' && <Text style={[styles.result, { color: '#b3261e' }]}>{test.message}</Text>}
    </Card>
  );
}

function ReadonlyField({ label, children }: { label: string; children: React.ReactNode }) {
  const colorTheme = useThemeColors();
  return (
    <View style={{ gap: 7 }}>
      <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{label}</Text>
      <View style={[styles.fieldBox, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dangerCard: { borderColor: 'rgba(179,38,30,0.28)', backgroundColor: 'rgba(179,38,30,0.03)' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  providerBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: { fontFamily: uiFont(700), fontSize: 15 },
  providerSub: { fontFamily: uiFont(500), fontSize: 12.5, marginTop: 1 },
  fieldLabel: { fontFamily: uiFont(600), fontSize: 12.5 },
  fieldBox: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  fieldValue: { fontFamily: uiFont(500), fontSize: 14 },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
  },
  testBtnText: { fontFamily: uiFont(600), fontSize: 14.5 },
  result: { fontFamily: uiFont(600), fontSize: 13, lineHeight: 18 },
  migrateRow: { padding: 16, borderRadius: radius.md, borderWidth: 1 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
  resetText: { fontFamily: uiFont(600), fontSize: 13.5 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 8 },
  countBadgeText: { color: '#fff', fontFamily: uiFont(700), fontSize: 11 },

  /* theme mode picker */
  modeToggle: { flexDirection: 'row', borderRadius: 999, padding: 3, borderWidth: 1 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  modeText: { fontFamily: uiFont(700), fontSize: 13 },
  modeTextOn: { color: '#fff' },

  /* accent color picker */
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  iconPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  iconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconPreviewTitle: { fontFamily: uiFont(700), fontSize: 14 },
  iconPreviewSub: { fontFamily: uiFont(500), fontSize: 12, marginTop: 1 },

  /* search */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: uiFont(600),
    fontSize: 14,
    padding: 0,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: uiFont(700),
    fontSize: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: uiFont(500),
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  clearSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 6,
  },
  clearSearchBtnText: {
    fontFamily: uiFont(600),
    fontSize: 13.5,
  },
  legalSection: {
    marginTop: 36,
    marginBottom: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  legalTitle: {
    fontFamily: uiFont(700),
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  legalText: {
    fontFamily: uiFont(400),
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
