import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { Card, Eyebrow, TopBar } from '../components/ui';
import { getActiveCurrencies } from '../db/currencyRepo';
import { clearMemory } from '../db/memoryRepo';
import { getProvider, llmErrorMessage } from '../llm';
import { isMultiCurrency } from '../lib/currency';
import { confirmAction, notify } from '../lib/platformAlert';
import { configFor, loadSettings, type LLMSettings, type ProviderRole } from '../settings/settingsStore';
import { cadenceLabel, REMINDER_CADENCES } from '../lib/reminders';
import * as sound from '../lib/sound';
import { ensurePermission } from '../notifications';
import { useAccent, useAccentPreset } from '../state/accent';
import { useColorSchemeMode, useThemeColors, type ColorSchemeMode } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { radius, uiFont } from '../theme';
import { motionSettingLabel, MOTION_SETTINGS } from '../theme/motion';

type TestState = { status: 'idle' | 'busy' | 'ok' | 'fail'; message?: string };



export function SettingsScreen({ onBack, onAdvancedImport, onOpenExport, onOpenCategories, onOpenCommitments, onOpenTax, onOpenCurrencySettings, onResetToOnboarding, taxRequestableCount = 0 }: { onBack: () => void; onAdvancedImport?: () => void; onOpenExport?: () => void; onOpenCategories?: () => void; onOpenCommitments?: () => void; onOpenTax?: () => void; onOpenCurrencySettings?: () => void; onResetToOnboarding?: () => void; taxRequestableCount?: number }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { memory, refreshAll, expectedIncome, allocations, hasBudget, resetBudget, resetAllData, resetToOnboarding } = useAppData();
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [activeCurrencies, setActiveCurrencies] = useState<string[]>(['MYR']);

  useEffect(() => {
    loadSettings().then(setSettings);
    getActiveCurrencies().then(setActiveCurrencies);
  }, []);

  const learnedCount = Object.keys(memory).length;

  const resetLearned = () => {
    if (learnedCount === 0) return;
    confirmAction('Reset learning?', `Forget all ${learnedCount} learned merchants? This can’t be undone.`, 'Reset', async () => {
      await clearMemory();
      await refreshAll();
    });
  };

  const allocationCount = Object.keys(allocations).length;
  const resetBudgetConfirm = () => {
    if (!hasBudget) return;
    confirmAction('Reset budget?', 'Clear your expected income and all category allocations? This can’t be undone.', 'Reset', () => resetBudget());
  };

  const resetAllConfirm = () => {
    confirmAction(
      'Reset everything?',
      'This deletes all transactions, learned merchants, and your budget, and restores the default categories. This can’t be undone.',
      'Reset',
      () => resetAllData()
    );
  };

  const resetToOnboardingConfirm = () => {
    confirmAction(
      'Reset & go to setup?',
      'This deletes all transactions, learned merchants, your budget, and restores the default categories. You will be returned to the setup wizard. This can’t be undone.',
      'Reset & restart',
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

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title="Settings" onBack={onBack} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        <Eyebrow style={{ marginBottom: 10 }}>Appearance</Eyebrow>
        <Card style={{ padding: 16 }}>
          <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Theme</Text>
          <ThemeModePicker />
        </Card>
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Accent color</Text>
          <AccentColorPicker />
        </Card>
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Motion and haptics</Text>
          <MotionSettingPicker />
        </Card>
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Sounds</Text>
          <SoundPicker />
        </Card>
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Streak</Text>
          <StreakPausePicker />
        </Card>

        {/* Hidden on web rather than disabled: expo-notifications has no web support, and a
            control that silently does nothing is worse than one that is not offered. */}
        {Platform.OS !== 'web' && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>Reminders</Eyebrow>
            <Card style={{ padding: 16 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Log your spending</Text>
              <LogReminderPicker />
              <ReminderHourOverridePicker />
            </Card>
            <Card style={{ padding: 16, marginTop: 12 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Chase what you’re owed</Text>
              <OwedReminderPicker />
            </Card>
            <Card style={{ padding: 16, marginTop: 12 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink, marginBottom: 12 }]}>Recurring bills</Text>
              <CommitmentReminderPicker />
            </Card>
          </>
        )}

        {/* Provider/API-key rows are a dev-ops concern, not a judge-facing one (UI/UX
            P3.18): visible locally (__DEV__), stripped from the shipped judge build. */}
        {__DEV__ && (
          <>
            <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>AI providers</Eyebrow>

            <ProviderCard
              settings={settings}
              role="general"
              icon="sparkles"
              name="Groq · primary"
              model={settings.groqModel}
              apiKey={settings.groqKey}
            />

            <View style={{ height: 14 }} />

            <ProviderCard
              settings={settings}
              role="docs"
              icon="receipt"
              name="Gemini · fallback"
              model={settings.geminiModel}
              apiKey={settings.geminiKey}
            />
          </>
        )}

        <View style={[styles.eyebrowRow, { marginTop: 26, marginBottom: 10 }]}>
          <Eyebrow>Learning</Eyebrow>
          <InfoButton entry="learned_merchants" />
        </View>
        <Card style={{ padding: 16 }}>
          <View style={styles.providerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>{learnedCount} learned merchant{learnedCount === 1 ? '' : 's'}</Text>
            </View>
            <Pressable onPress={resetLearned} disabled={learnedCount === 0} style={styles.resetBtn}>
              <Icon name="trash" size={16} color={learnedCount === 0 ? colorTheme.ink3 : '#b3261e'} />
              <Text style={[styles.resetText, { color: learnedCount === 0 ? colorTheme.ink3 : '#b3261e' }]}>Reset</Text>
            </Pressable>
          </View>
        </Card>

        <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>Budget</Eyebrow>
        <Card style={{ padding: 16 }}>
          <View style={styles.providerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>
                {hasBudget ? `RM ${expectedIncome.toFixed(2)} income · ${allocationCount} categor${allocationCount === 1 ? 'y' : 'ies'}` : 'No budget set'}
              </Text>
            </View>
            <Pressable onPress={resetBudgetConfirm} disabled={!hasBudget} style={styles.resetBtn}>
              <Icon name="trash" size={16} color={!hasBudget ? colorTheme.ink3 : '#b3261e'} />
              <Text style={[styles.resetText, { color: !hasBudget ? colorTheme.ink3 : '#b3261e' }]}>Reset</Text>
            </Pressable>
          </View>
        </Card>

        <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>Data</Eyebrow>
        {onOpenCommitments && (
          <Pressable
            onPress={onOpenCommitments}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="clock" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Recurring bills & investments</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}

        {onOpenTax && (
          <Pressable
            onPress={onOpenTax}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="receipt" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Tax relief</Text>
            </View>
            {taxRequestableCount > 0 && (
              <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
                <Text style={styles.countBadgeText}>{taxRequestableCount}</Text>
              </View>
            )}
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}

        {onOpenCategories && (
          <Pressable
            onPress={onOpenCategories}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="sliders" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Categories</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}

        {onOpenCurrencySettings && (
          <Pressable
            onPress={onOpenCurrencySettings}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="wallet" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Currencies</Text>
              <Text style={[styles.providerSub, { color: colorTheme.ink2 }]}>
                {isMultiCurrency(activeCurrencies) ? activeCurrencies.join(', ') : 'MYR only'}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}

        {onAdvancedImport && (
          <Pressable
            onPress={onAdvancedImport}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="sparkles" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Advanced import</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}

        {onOpenExport && (
          <Pressable
            onPress={onOpenExport}
            style={({ pressed }) => [styles.providerRow, styles.migrateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }, { marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: theme.accentTint }]}>
              <Icon name="download" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.providerName, { color: colorTheme.ink }]}>Financial reports & export</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}

        {/* Distinct "danger zone" treatment  this is the one irreversible action on this
            screen, so it shouldn't look like every other settings row. */}
        <Eyebrow style={{ marginTop: 26, marginBottom: 10, color: '#b3261e' }}>Danger zone</Eyebrow>
        <Card style={[{ padding: 16 }, styles.dangerCard]}>
          <View style={styles.providerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="alert" size={13} color="#b3261e" />
                <Text style={[styles.providerName, { color: '#b3261e' }]}>Reset all data</Text>
              </View>
            </View>
            <Pressable onPress={resetAllConfirm} style={styles.resetBtn}>
              <Icon name="trash" size={16} color="#b3261e" />
              <Text style={[styles.resetText, { color: '#b3261e' }]}>Reset</Text>
            </Pressable>
          </View>
        </Card>

        <Card style={[{ padding: 16, marginTop: 10 }, styles.dangerCard]}>
          <View style={styles.providerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="alert" size={13} color="#b3261e" />
                <Text style={[styles.providerName, { color: '#b3261e' }]}>Reset & go to setup</Text>
              </View>
            </View>
            <Pressable onPress={resetToOnboardingConfirm} style={styles.resetBtn}>
              <Icon name="trash" size={16} color="#b3261e" />
              <Text style={[styles.resetText, { color: '#b3261e' }]}>Reset</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
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
async function withPermission(turningOn: boolean, apply: () => Promise<void>): Promise<void> {
  if (turningOn && !(await ensurePermission())) {
    notify(
      'Notifications are off',
      'Your phone is blocking notifications for Pip. Turn them on in your device settings and then try again.'
    );
    return;
  }
  await apply();
}

/** Off / Daily / Weekly, same pill shape as ThemeModePicker. */
function LogReminderPicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { reminderCadence, setReminderCadence } = useAppData();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {REMINDER_CADENCES.map((cadence) => {
        const on = reminderCadence === cadence;
        return (
          <Pressable
            key={cadence}
            onPress={() => withPermission(cadence !== 'off', () => setReminderCadence(cadence))}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {cadenceLabel(cadence)}
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
  if (reminderCadence === 'off') return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[styles.providerSub, { color: colorTheme.ink2, marginBottom: 8 }]}>When</Text>
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
                {opt.label}
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
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {[false, true].map((value) => {
        const on = owedReminderEnabled === value;
        return (
          <Pressable
            key={String(value)}
            onPress={() => withPermission(value, () => setOwedReminderEnabled(value))}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {value ? 'On' : 'Off'}
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
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {[false, true].map((value) => {
        const on = commitmentReminderEnabled === value;
        return (
          <Pressable
            key={String(value)}
            onPress={() => withPermission(value, () => setCommitmentReminderEnabled(value))}
            style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>
              {value ? 'On' : 'Off'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const THEME_MODE_OPTIONS: { mode: ColorSchemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

/** 3-way Light/Dark/System segmented control, same pill shape as ui.tsx's ValueToggle. */
function ThemeModePicker() {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { mode, setMode } = useColorSchemeMode();
  return (
    <View style={[styles.modeToggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
      {THEME_MODE_OPTIONS.map((opt) => {
        const on = mode === opt.mode;
        return (
          <Pressable key={opt.mode} onPress={() => setMode(opt.mode)} style={[styles.modeBtn, on && { backgroundColor: theme.accentInk }]}>
            <Text style={[styles.modeText, { color: colorTheme.ink2 }, on && styles.modeTextOn]}>{opt.label}</Text>
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
              {paused ? 'Paused' : 'On'}
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
              {motionSettingLabel(setting)}
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
              {value ? 'On' : 'Off'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Row of preset swatches for picking the app's accent color, same visual pattern as the
 *  category-color picker in AddCategoryModal (tap a circle, checkmark on the active one). */
function AccentColorPicker() {
  const colorTheme = useThemeColors();
  const { presetId, setPresetId, presets } = useAccentPreset();
  return (
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
    if (!cfg.apiKey.trim()) {
      setTest({ status: 'fail', message: 'No API key is configured.' });
      return;
    }
    setTest({ status: 'busy' });
    try {
      await getProvider(cfg.provider).test({ apiKey: cfg.apiKey.trim(), model: cfg.model.trim() });
      setTest({ status: 'ok', message: `Connected to ${getProvider(cfg.provider).label}.` });
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
});
