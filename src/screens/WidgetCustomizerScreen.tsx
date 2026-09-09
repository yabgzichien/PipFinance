import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { NotchedSlider } from '../components/NotchedSlider';
import { Body, BtnLabel, Caption, Card, Eyebrow, PrimaryButton, TopBar } from '../components/ui';
import { useLanguage } from '../i18n';
import { setSlot } from '../lib/widgetCustomizer';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { BADGE_THEMES } from '../widget/mascot/badge';
import { composeWidgetPreview } from '../widget/mascot/previewCompose';
import type {
  BadgeColor,
  BadgeIcon,
  Notch,
  PresetId,
  SlotId,
} from '../widget/mascot/config';
import { PART_CATALOG } from '../widget/mascot/parts';
import { applyPreset, PRESETS } from '../widget/mascot/presets';

const SLOTS: SlotId[] = ['head', 'eyes', 'mouth', 'holding'];
const BADGE_ICONS: BadgeIcon[] = ['flame', 'star', 'leaf', 'sprout', 'none'];
const BADGE_COLORS: BadgeColor[] = ['amber', 'red', 'green', 'blue', 'violet'];

/** A sample streak for the preview, with a matching week: a 7-day streak means all seven days
 *  are active, so showing gaps here would preview a state that cannot exist. */
const PREVIEW_STREAK = 7;
const PREVIEW_DOTS = [true, true, true, true, true, true, true];

/** Drawn larger than life so the widget is legible on a phone, but at a FIXED multiplier rather
 *  than stretched to fill the card — otherwise every mascot and button size would render the
 *  same width and the two size sliders would appear to do nothing. At the widest configuration
 *  (150dp) this is 240pt, which fits the card on small screens. */
const PREVIEW_SCALE = 1.6;

export function WidgetCustomizerScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t } = useLanguage();
  const { widgetMascotConfig, setWidgetMascotConfig } = useAppData();
  const [draft, setDraft] = useState(widgetMascotConfig);
  const [saving, setSaving] = useState(false);

  // The whole widget, not just the mascot — otherwise the arrow toggles, dividers and the
  // expanded streak column change nothing on screen. Drawn from the same chrome constants and
  // mascot body the real widget uses; see mascot/previewCompose.ts on why it is a second
  // renderer and what keeps it honest.
  const preview = composeWidgetPreview(draft, PREVIEW_STREAK, PREVIEW_DOTS);

  const save = async () => {
    setSaving(true);
    try {
      await setWidgetMascotConfig(draft);
      onBack();
    } finally {
      setSaving(false);
    }
  };

  const chipStyle = (selected: boolean) => [
    styles.chip,
    { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 },
    selected && { backgroundColor: theme.accentTint, borderColor: theme.accent },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title={t('widgetCustomizer')} onBack={onBack} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.preview, { backgroundColor: theme.accentTint }]}>
          <SvgXml
            xml={preview.svg}
            width={preview.width * PREVIEW_SCALE}
            height={preview.height * PREVIEW_SCALE}
          />
          <Caption color={colorTheme.ink2}>{t('widgetPreviewHint')}</Caption>
        </Card>

        <Section title={t('widgetPreset')}>
          <View style={styles.chips}>
            {(Object.keys(PRESETS) as PresetId[]).map((id) => (
              <Pressable
                key={id}
                onPress={() => setDraft((current) => applyPreset(current, id))}
                style={chipStyle(draft.preset === id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.preset === id }}
              >
                <Body>{t(`widgetPreset_${id}`)}</Body>
              </Pressable>
            ))}
          </View>
        </Section>

        {SLOTS.map((slot) => (
          <Section key={slot} title={t(`widgetSlot_${slot}`)}>
            <View style={styles.chips}>
              {Object.keys(PART_CATALOG[slot]).map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setDraft((current) => setSlot(current, slot, id))}
                  style={chipStyle(draft[slot] === id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: draft[slot] === id }}
                >
                  <Body>{t(`widgetPart_${id}`)}</Body>
                </Pressable>
              ))}
            </View>
          </Section>
        ))}

        <Section title={t('widgetSize')}>
          <Card style={styles.controlCard}>
            <NotchedSlider
              label={t('widgetMascotSize')}
              value={draft.mascotNotch}
              count={5}
              defaultValue={5}
              defaultLabel={t('widgetDefaultNotch', { value: 5 })}
              onChange={(value) =>
                setDraft((current) => ({ ...current, mascotNotch: value as Notch }))
              }
            />
            <NotchedSlider
              label={t('widgetButtonSize')}
              value={draft.buttonNotch}
              count={5}
              defaultValue={3}
              defaultLabel={t('widgetDefaultNotch', { value: 3 })}
              onChange={(value) =>
                setDraft((current) => ({ ...current, buttonNotch: value as Notch }))
              }
            />
          </Card>
        </Section>

        <Section title={t('widgetButtons')}>
          <Card style={styles.controlCard}>
            <ToggleRow
              label={t('widgetShowIncome')}
              enabled={draft.showIncome}
              onPress={() =>
                setDraft((current) => ({ ...current, showIncome: !current.showIncome }))
              }
            />
            <View style={[styles.divider, { backgroundColor: colorTheme.line }]} />
            <ToggleRow
              label={t('widgetShowExpense')}
              enabled={draft.showExpense}
              onPress={() =>
                setDraft((current) => ({ ...current, showExpense: !current.showExpense }))
              }
            />
            {!draft.showIncome && !draft.showExpense ? (
              <Caption color={colorTheme.ink2}>{t('widgetArrowsOffHint')}</Caption>
            ) : null}
          </Card>
        </Section>

        <Section title={t('widgetStreakBadge')}>
          <View style={styles.chips}>
            {BADGE_ICONS.map((icon) => (
              <Pressable
                key={icon}
                onPress={() => setDraft((current) => ({ ...current, badgeIcon: icon }))}
                style={chipStyle(draft.badgeIcon === icon)}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.badgeIcon === icon }}
              >
                <Body>{t(`widgetBadge_${icon}`)}</Body>
              </Pressable>
            ))}
          </View>
          <View style={styles.chips}>
            {BADGE_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setDraft((current) => ({ ...current, badgeColor: color }))}
                style={chipStyle(draft.badgeColor === color)}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.badgeColor === color }}
              >
                <View style={[styles.swatch, { backgroundColor: BADGE_THEMES[color].icon }]} />
                <Body>{t(`widgetColor_${color}`)}</Body>
              </Pressable>
            ))}
          </View>
        </Section>

        <PrimaryButton onPress={save} disabled={saving}>
          <BtnLabel>{saving ? t('saving') : t('save')}</BtnLabel>
        </PrimaryButton>
      </ScrollView>
    </View>
  );

  function ToggleRow({
    label,
    enabled,
    onPress,
  }: {
    label: string;
    enabled: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={styles.toggleRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
      >
        <Body>{label}</Body>
        <View
          style={[
            styles.switchTrack,
            { backgroundColor: enabled ? theme.accent : colorTheme.line2 },
          ]}
        >
          <View
            style={[
              styles.switchThumb,
              { transform: [{ translateX: enabled ? 20 : 0 }] },
            ]}
          />
        </View>
      </Pressable>
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, gap: 24 },
  preview: { alignItems: 'center', justifyContent: 'center', padding: 20, gap: 4 },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  controlCard: { padding: 16, gap: 12 },
  toggleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: { height: StyleSheet.hairlineWidth },
  switchTrack: { width: 48, height: 28, borderRadius: 14, padding: 3 },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  swatch: { width: 14, height: 14, borderRadius: 7 },
});
