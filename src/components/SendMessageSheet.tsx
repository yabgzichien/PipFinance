// src/components/SendMessageSheet.tsx
// Bottom sheet for picking who a money message goes to, shared by the Saved screen ("Send the
// split", straight after a bill is divided) and the Owed screen ("Send a reminder", when
// chasing it later). Styled in Pip's design language with Pip mascot and viral distribution
// referral link.
import React, { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Icon, type IconName } from './Icon';
import { Pip } from './Pip';
import { Caption, Label, Title } from './ui';
import { tap } from '../lib/haptics';
import { notify } from '../lib/platformAlert';
import { shareSplitMessage } from '../lib/shareText';
import {
  generateReceiptCanvasHtml,
  type GeneratedReceipt,
  type ReceiptCanvasInput,
} from '../lib/receiptGenerator';
import {
  base64ToUint8Array,
  saveReceiptPng,
} from '../lib/receiptImage';
import { useThemeColors } from '../state/colorScheme';
import { useAccent } from '../state/accent';
import { useLanguage } from '../i18n';
import { radius, spacing, uiFont } from '../theme';

export interface SendMessageOption {
  key: string;
  label: string;
  sub: string;
  icon?: IconName;
  /** Built lazily so a message is only composed for the row actually tapped. Null means the
   *  row has nothing to send, and tapping it does nothing rather than sending a blank. */
  build?: () => string | null;
  /** A receipt photo to send alongside, when this particular row has one. */
  receiptUri?: string | null;
  /** Deterministic receipt data to render as a Pip receipt image. */
  receiptData?: GeneratedReceipt | GeneratedReceipt[];
  /** Multi-section or custom canvas input (e.g. group split receipts). */
  canvasInput?: ReceiptCanvasInput;
}

export function SendMessageSheet({
  visible,
  title,
  subtitle,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  options: SendMessageOption[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t, isZh } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [generatedUris, setGeneratedUris] = useState<Record<string, string>>({});
  const resolversRef = useRef<Record<string, (uri?: string) => void>>({});

  // Construct batch HTML for rendering Pip receipt images in WebView
  const canvasHtml = useMemo(() => {
    if (!visible) return null;
    const inputs: ReceiptCanvasInput[] = [];

    for (const opt of options) {
      if (opt.canvasInput) {
        inputs.push(opt.canvasInput);
        continue;
      }
      if (!opt.receiptData) continue;
      const receipts = Array.isArray(opt.receiptData) ? opt.receiptData : [opt.receiptData];
      if (receipts.length === 0) continue;

      const currency = receipts[0].currency;
      const personName = receipts[0].personName;
      const total = receipts.reduce((sum, r) => sum + r.total, 0);

      inputs.push({
        key: opt.key,
        receipts,
        currency,
        personName,
        total,
        isZh,
      });
    }

    if (inputs.length === 0) return null;
    return generateReceiptCanvasHtml(inputs);
  }, [visible, options, isZh]);

  const onWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const { key, dataUrl } = JSON.parse(event.nativeEvent.data);
      if (!key || !dataUrl) return;
      const bytes = base64ToUint8Array(dataUrl);
      const fileUri = saveReceiptPng(bytes, key);
      if (fileUri) {
        setGeneratedUris((prev) => ({ ...prev, [key]: fileUri }));
        if (resolversRef.current[key]) {
          resolversRef.current[key](fileUri);
          delete resolversRef.current[key];
        }
      }
    } catch {
      // Best-effort image capture
    }
  };

  if (!visible || options.length === 0) return <Modal visible={false} transparent />;

  const send = async (option: SendMessageOption) => {
    if (busy) return;
    const message = option.build ? option.build() : '';
    setBusy(true);
    tap();

    let imageUri = generatedUris[option.key] || option.receiptUri;

    // If receipt image is being prepared in WebView, wait briefly for it
    if (!imageUri && (option.receiptData || option.canvasInput)) {
      imageUri = await new Promise<string | undefined>((resolve) => {
        resolversRef.current[option.key] = resolve;
        setTimeout(() => resolve(undefined), 1200);
      });
    }

    const outcome = await shareSplitMessage(message ?? '', imageUri);
    setBusy(false);
    if (outcome === 'failed') {
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

        {/* Pip Brand Banner Card */}
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
          </View>

          <View style={[styles.receiptNotice, { borderTopColor: theme.accentSoft }]}>
            <Caption color={theme.onTint} weight={700} numberOfLines={2}>
              {isZh
                ? '🧾 自动生成确定性消费小票图片，按分类与金额清晰对账。'
                : '🧾 Auto-generates Pip receipt image with category & amount breakdown.'}
            </Caption>
          </View>
        </View>

        {/* Offscreen WebView for headless Canvas receipt image generation on native */}
        {Platform.OS !== 'web' && canvasHtml ? (
          <View
            style={{
              position: 'absolute',
              top: -200,
              left: -200,
              width: 1,
              height: 1,
              opacity: 0.01,
            }}
            pointerEvents="none"
          >
            <WebView
              originWhitelist={['*']}
              source={{ html: canvasHtml }}
              onMessage={onWebViewMessage}
              javaScriptEnabled
            />
          </View>
        ) : null}

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
          {isZh ? '仅包含所选的账单内容' : 'Only what you picked'}
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
  receiptNotice: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  list: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

