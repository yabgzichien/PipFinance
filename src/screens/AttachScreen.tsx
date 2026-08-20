import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { B, Body, BubbleText, Caption, Label, PipSays, TopBar } from '../components/ui';
import { notify } from '../lib/platformAlert';
import { SAMPLE_STATEMENTS } from '../data/sampleStatements';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, spacing } from '../theme';

export interface PickedImage {
  uri: string;
  base64: string;
  mime: string;
}

/**
 * The add hub. Screenshot-of-an-app-you-already-have-open is the mechanism the business plan
 * leads with (docs/ui-design-plan.md §5) — a competitor already owns "AI reads a receipt", not
 * "reads whatever's already on your screen" — so that row is first and open by default, not
 * third and collapsed behind an accordion. Receipt and manual entry follow; file import (the
 * least common path — a PDF/CSV export, not a screenshot) is folded under "More ways to add".
 */
export function AttachScreen({
  hasKey,
  onClose,
  onPicked,
  onManual,
  onImport,
  onReceipt,
  showSamples = false,
}: {
  hasKey: boolean;
  onClose: () => void;
  onPicked: (img: PickedImage) => void;
  onManual: () => void;
  onImport: () => void;
  /** Open the itemised-receipt scanner (one purchase, many lines). */
  onReceipt: () => void;
  /** Offer the bundled demo statements as one-tap samples (used during the judge tour)
   *  alongside the real upload options, so the app never injects an image on its own. */
  showSamples?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [busy, setBusy] = useState(false);
  // Camera-vs-gallery is a detail of HOW you hand over a statement, not a separate thing to add.
  // Expanded by default: the statement/e-wallet row is the differentiator (see file header), so
  // it should never need an extra tap to reveal its own options.
  const [statementOpen, setStatementOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (showSamples) setStatementOpen(true);
  }, [showSamples]);

  const handleResult = (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (!a.base64) {
      notify('Hmm', "That image couldn't be read. Try another one.");
      return;
    }
    onPicked({ uri: a.uri, base64: a.base64, mime: a.mimeType ?? 'image/jpeg' });
  };

  const pickFromLibrary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow photo access to attach a screenshot.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.7,
      });
      handleResult(res);
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow camera access to snap a receipt.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
      handleResult(res);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <TopBar title="Add transactions" onBack={onClose} />

        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
          <PipSays expr="curious">
            <BubbleText>
              Screenshot the app you already have open and I’ll read it, or add <B>one purchase</B> a
              different way.
            </BubbleText>
          </PipSays>
        </View>

        {!hasKey && (
          <Pressable onPress={onManual} style={[styles.keyNotice, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
            <Icon name="sparkles" size={18} color={theme.accentInk} />
            <Body weight={500} color={theme.onTint} style={{ flex: 1 }}>
              Scanning isn't available right now. Enter a transaction manually instead.
            </Body>
            <Icon name="chevronRight" size={16} color={theme.accentInk} />
          </Pressable>
        )}

        <View style={styles.group}>
          <SourceButton
            icon="scan"
            title="Scan a statement or e-wallet"
            sub="A screenshot listing several transactions, the fastest way in"
            onPress={() => setStatementOpen((v) => !v)}
            disabled={busy}
            expanded={statementOpen}
          />

          {statementOpen && (
            <View style={[styles.nested, { borderLeftColor: theme.accentSoft }]}>
              {showSamples && (
                <>
                  <Label weight={700} color={colorTheme.ink3} style={{ marginBottom: spacing.sm }}>NO SCREENSHOT HANDY? TAP A SAMPLE</Label>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.xs }}
                  >
                    {SAMPLE_STATEMENTS.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => onPicked(s.image)}
                        style={[styles.sampleCard, { backgroundColor: colorTheme.surface, borderColor: theme.accentSoft }]}
                        disabled={busy}
                      >
                        <RNImage source={{ uri: s.image.uri }} style={[styles.sampleThumb, { backgroundColor: theme.accentTint }]} resizeMode="cover" />
                        <View style={{ padding: spacing.md }}>
                          <Label numberOfLines={1}>{s.label}</Label>
                          <Caption color={colorTheme.ink2} numberOfLines={1} style={{ marginTop: spacing.xs }}>{s.provider}</Caption>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Body weight={500} color={colorTheme.ink3} style={{ marginTop: spacing.md }}>or use your own</Body>
                </>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: showSamples ? spacing.md : 0 }}>
                <MiniButton icon="camera" label="Take a photo" onPress={takePhoto} disabled={busy} />
                <MiniButton icon="gallery" label="From gallery" onPress={pickFromLibrary} disabled={busy} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.group}>
          <SourceButton
            icon="receipt"
            title="Scan a receipt"
            sub="Reads every line item. Split it with friends if you shared."
            onPress={onReceipt}
            disabled={busy}
          />
        </View>

        <View style={styles.group}>
          <SourceButton
            icon="pencil"
            title="Enter it manually"
            sub="Type one expense or income yourself"
            onPress={onManual}
            disabled={busy}
          />
        </View>

        <View style={styles.group}>
          <SourceButton
            icon="wallet"
            title="More ways to add"
            sub="Import a PDF, image, CSV, Excel, or Word statement"
            onPress={() => setMoreOpen((v) => !v)}
            disabled={busy}
            expanded={moreOpen}
          />
          {moreOpen && (
            <View style={[styles.nested, { borderLeftColor: theme.accentSoft }]}>
              <Pressable onPress={onImport} disabled={busy} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
                <Label weight={700} color={theme.accent}>Import a file →</Label>
              </Pressable>
            </View>
          )}
        </View>

        <Caption color={colorTheme.ink2} style={styles.hint}>
          Screenshots are sent to your chosen AI provider only to read the transactions. Manual entries stay on your device.
        </Caption>
      </ScrollView>
    </View>
  );
}

function SourceButton({
  icon,
  title,
  sub,
  onPress,
  disabled,
  expanded,
}: {
  icon: IconName;
  title: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
  /** Set on a row that opens options in place — the chevron then points down/up rather than
   *  right, so it never promises a screen change it does not make. */
  expanded?: boolean;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={({ pressed }) => [
        styles.source,
        { backgroundColor: colorTheme.surface, borderColor: colorTheme.line },
        expanded && styles.sourceOn,
        expanded && { borderColor: theme.accentSoft, backgroundColor: theme.accentTint },
        { opacity: disabled ? 0.6 : pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.sourceIcon, { backgroundColor: theme.accentTint }]}>
        <Icon name={icon} size={24} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Body weight={700}>{title}</Body>
        <Label weight={500} color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>{sub}</Label>
      </View>
      <Icon
        name={expanded === undefined ? 'chevronRight' : expanded ? 'chevronDown' : 'chevronRight'}
        size={18}
        color={colorTheme.ink3}
      />
    </Pressable>
  );
}

/** A compact secondary choice inside an expanded row — how to hand a file over, not what to add. */
function MiniButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useAccent();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.mini,
        { backgroundColor: theme.accentTint, borderColor: theme.accentSoft },
        { opacity: disabled ? 0.6 : pressed ? 0.9 : 1 },
      ]}
    >
      <Icon name={icon} size={19} color={theme.accent} />
      <Label weight={700} color={theme.accentInk}>{label}</Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  keyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  group: { paddingHorizontal: spacing.base, paddingTop: spacing.md },
  nested: { marginLeft: spacing.md, paddingLeft: spacing.md, marginTop: spacing.md, borderLeftWidth: 2 },
  mini: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  sourceOn: { borderStyle: 'solid' },
  sourceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleCard: {
    width: 150,
    borderRadius: radius.md,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  sampleThumb: { width: '100%', height: 96 },
  hint: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 18,
  },
});
