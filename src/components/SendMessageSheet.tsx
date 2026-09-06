// src/components/SendMessageSheet.tsx
// Bottom sheet for picking who a money message goes to, shared by the Saved screen ("Send the
// split", straight after a bill is divided) and the Owed screen ("Send a reminder", when
// chasing it later). Styled in Pip's design language with Pip mascot, DuitNow QR attachment,
// and viral distribution referral link.
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { Pip } from './Pip';
import { Caption, Label, Title } from './ui';
import { tap } from '../lib/haptics';
import { notify } from '../lib/platformAlert';
import { shareSplitMessage } from '../lib/shareText';
import { useThemeColors } from '../state/colorScheme';
import { useAccent } from '../state/accent';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { radius, spacing, uiFont } from '../theme';

export interface SendMessageOption {
  key: string;
  label: string;
  sub: string;
  icon?: IconName;
  /** Built lazily so a message is only composed for the row actually tapped. Null means the
   *  row has nothing to send, and tapping it does nothing rather than sending a blank. */
  build: (opts?: { hasDuitNowQr?: boolean }) => string | null;
  /** A receipt photo to send alongside, when this particular row has one. */
  receiptUri?: string | null;
}

export function SendMessageSheet({
  visible,
  title,
  subtitle,
  options,
  onClose,
  duitNowQrUri: propDuitNowQrUri,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  options: SendMessageOption[];
  onClose: () => void;
  duitNowQrUri?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { duitNowQrUri: storeDuitNowQrUri } = useAppData();
  const effectiveQrUri = propDuitNowQrUri ?? storeDuitNowQrUri;
  const { t, isZh } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [attachDuitNow, setAttachDuitNow] = useState(true);

  if (!visible || options.length === 0) return <Modal visible={false} transparent />;

  const send = async (option: SendMessageOption) => {
    const shouldAttachQr = attachDuitNow && Boolean(effectiveQrUri);
    const message = option.build({ hasDuitNowQr: shouldAttachQr });
    if (!message || busy) return;
    setBusy(true);
    tap();
    const imageUri = shouldAttachQr ? effectiveQrUri : option.receiptUri;
    const outcome = await shareSplitMessage(message, imageUri);
    setBusy(false);
    // Only the clipboard paths need explaining. A plain share speaks for itself, and telling
    // someone "shared!" after they have just watched the share sheet open is noise.
    if (outcome === 'shared-with-clipboard') {
      if (imageUri === effectiveQrUri) {
        notify(t('splitShareCopiedTitle'), t('splitSharePasteHintQr'));
      } else {
        notify(t('splitShareCopiedTitle'), t('splitSharePasteHint'));
      }
    } else if (outcome === 'copied') {
      notify(t('splitShareCopiedTitle'), t('splitShareCopiedBody'));
    } else if (outcome === 'failed') {
      notify(t('splitShareFailedTitle'), t('splitShareFailedBody'));
    }
    if (outcome !== 'failed') onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + spacing.base }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />

        {/* Pip Mascot + Header */}
        <View style={styles.sheetHead}>
          <Pip size={48} expr="happy" />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Title>{title}</Title>
            <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>
              {subtitle}
            </Caption>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t('close')}>
            <Icon name="x" size={20} color={colorTheme.ink2} />
          </Pressable>
        </View>

        {/* Pip Brand & DuitNow QR Banner Card */}
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: theme.accentTint,
              borderColor: theme.accentSoft,
            },
          ]}
        >
          <View style={styles.previewTopRow}>
            <View style={styles.previewTag}>
              <Icon name="sparkles" size={13} color={theme.accent} />
              <Label weight={700} color={theme.onTint}>
                {isZh ? 'Pip 极速分摊' : 'Pip Split'}
              </Label>
            </View>

            {effectiveQrUri ? (
              <Pressable
                onPress={() => {
                  tap();
                  setAttachDuitNow((prev) => !prev);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: attachDuitNow }}
                style={({ pressed }) => [
                  styles.qrTogglePill,
                  {
                    backgroundColor: attachDuitNow ? theme.accent : colorTheme.surface,
                    borderColor: attachDuitNow ? theme.accent : colorTheme.line2,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Image source={{ uri: effectiveQrUri }} style={styles.qrTinyThumb} />
                <Caption
                  weight={700}
                  color={attachDuitNow ? '#fff' : colorTheme.ink}
                >
                  {attachDuitNow ? t('duitNowQrAttached') : t('duitNowAttachQrToggle')}
                </Caption>
                <Icon
                  name={attachDuitNow ? 'check' : 'plus'}
                  size={12}
                  color={attachDuitNow ? '#fff' : colorTheme.ink2}
                  stroke={2.4}
                />
              </Pressable>
            ) : (
              <Caption color={colorTheme.ink2} style={styles.noQrHint} numberOfLines={1}>
                {t('duitNowTipNoQr')}
              </Caption>
            )}
          </View>
        </View>

        {/* Recipients List */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
          <View style={[styles.list, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }]}>
            {options.map((option, i) => (
              <Pressable
                key={option.key}
                onPress={() => send(option)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && [styles.divider, { borderTopColor: colorTheme.line2 }],
                  pressed && { backgroundColor: colorTheme.surface2 },
                  busy && { opacity: 0.5 },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: theme.accentTint }]}>
                  <Icon name={option.icon ?? 'share'} size={17} color={theme.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md, minWidth: 0 }}>
                  <Label weight={700} color={colorTheme.ink} numberOfLines={1}>
                    {option.label}
                  </Label>
                  <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }} numberOfLines={1}>
                    {option.sub}
                  </Caption>
                </View>
                <Icon name="chevronRight" size={16} color={colorTheme.ink3} />
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Caption color={colorTheme.ink3} style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {isZh ? '仅包含所选的账单内容 · 零广告，100% 本地隐私' : 'Only what you picked · Zero ads, 100% private'}
        </Caption>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, marginBottom: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  previewCard: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  previewTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  qrTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  qrTinyThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  noQrHint: {
    flex: 1,
    textAlign: 'right',
  },
  list: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

