import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountLinkField } from '../components/AccountLinkField';
import { Icon } from '../components/Icon';
import { Amount, B, BtnLabel, BubbleText, Card, Eyebrow, PipSays, PrimaryButton, TopBar } from '../components/ui';
import { fmtMoney } from '../lib/format';
import { BASE_CURRENCY } from '../lib/currency';
import { suggestForMerchant } from '../lib/recommend';
import type { ExtractedTxn } from '../lib/types';
import { getLLM, llmErrorMessage } from '../llm';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useReducedMotion } from '../state/useReducedMotion';
import { useAppData } from '../state/store';
import { uiFont } from '../theme';
import { duration as motionDuration } from '../theme/motion';
import type { PickedImage } from './AttachScreen';

// 'found' is a deliberate beat, not a loading state: the extraction has already resolved by
// the time it shows, so it narrates a real completed step (docs/ui-engagement-plan.md Step 2
// Act 1) rather than padding the wait. It holds for FOUND_HOLD_MS then falls into 'result'.
type Phase = 'scanning' | 'found' | 'result' | 'error';

const PREVIEW_H = 300;
const FOUND_HOLD_MS = motionDuration.enter;

export function ExtractScreen({
  image,
  cachedItems,
  linkId: initialLinkId = null,
  onBack,
  onDone,
}: {
  image: PickedImage;
  cachedItems?: ExtractedTxn[];
  linkId?: string | null;
  onBack: () => void;
  /** `elapsedMs` is the real extraction round-trip (image in, transactions out), null when
   *  reviewing cached results (there's nothing to have timed). The Saved screen's "Read in
   *  Ns" line only renders when this is a real measurement. */
  onDone: (items: ExtractedTxn[], linkId: string | null, elapsedMs: number | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { memory, catById, accounts, ensureDefaultAccount } = useAppData();
  const [phase, setPhase] = useState<Phase>(cachedItems ? 'result' : 'scanning');
  const [items, setItems] = useState<ExtractedTxn[]>(cachedItems ?? []);
  // The batch is always tied to an account. Default to a cash account (prefer an
  // existing one), keeping any selection carried back from the categorize step.
  const defaultAcctId = useMemo(() => {
    const act = accounts.filter((a) => !a.archived);
    return (act.find((a) => a.cls === 'cash') ?? act[0])?.id ?? null;
  }, [accounts]);
  const [linkId, setLinkId] = useState<string | null>(initialLinkId ?? defaultAcctId);
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  // Live seconds counter while reading  narrates real elapsed time rather than a fabricated
  // progress bar (docs/ui-engagement-plan.md Step 2 Act 1). Purely a text tick, not a transform
  // loop, so it isn't gated on reduced motion the way the scanline below is.
  const [readingSecs, setReadingSecs] = useState(0);
  const reducedMotion = useReducedMotion();
  const [viewingPhoto, setViewingPhoto] = useState(false);

  // Seed the required account once accounts are known, creating a "Cash" one if none exist.
  useEffect(() => {
    if (linkId) return;
    if (defaultAcctId) setLinkId(defaultAcctId);
    else ensureDefaultAccount().then(setLinkId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAcctId]);

  const scan = useRef(new Animated.Value(0)).current;

  // scanline loop while reading
  useEffect(() => {
    if (phase !== 'scanning' || reducedMotion) return;
    const loop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, reducedMotion, scan]);

  useEffect(() => {
    if (phase !== 'scanning') return;
    setReadingSecs(0);
    const id = setInterval(() => setReadingSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // run extraction once on mount (skip when reviewing cached results)
  useEffect(() => {
    if (cachedItems) return;
    let alive = true;
    const start = Date.now();
    (async () => {
      try {
        const llm = await getLLM();
        const rows = await llm.extract({
          imageBase64: image.base64,
          mimeType: image.mime,
        });
        if (!alive) return;
        setElapsedMs(Date.now() - start);
        setItems(rows);
        // 'found' narrates the real result for a fixed beat before the full list renders,
        // rather than jump-cutting straight from spinner to review screen.
        setPhase('found');
      } catch (e) {
        if (!alive) return;
        setError(llmErrorMessage(e));
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [image]);

  useEffect(() => {
    if (phase !== 'found') return;
    const id = setTimeout(() => setPhase('result'), reducedMotion ? 0 : FOUND_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, reducedMotion]);

  const withSuggestions = useMemo(
    () =>
      items.map((it) => ({
        ...it,
        suggestion: it.type === 'expense' ? suggestForMerchant(memory, it.merchant) : null,
      })),
    [items, memory]
  );
  const recognized = withSuggestions.filter((e) => e.suggestion).length;
  const total = items.reduce((s, it) => s + it.amount, 0);
  // Only one currency in the batch means the sum is a real number the user can act on.
  // A mixed batch has no honest single total, so the sentence simply omits it.
  const currencies = new Set(items.map((it) => it.currency ?? BASE_CURRENCY));
  const totalLabel = currencies.size === 1 ? `, ${fmtMoney(total, [...currencies][0])} total` : '';

  const translateY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, PREVIEW_H - 28] });

  const removeAt = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <TopBar title={phase === 'scanning' ? 'Reading…' : phase === 'error' ? 'Hmm' : 'Found it'} onBack={onBack} />

        <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
          {phase === 'scanning' && (
            <PipSays expr="think">
              <BubbleText>Reading your screenshot{readingSecs > 0 ? ` (${readingSecs}s)` : '…'}</BubbleText>
            </PipSays>
          )}
          {phase === 'found' && (
            <PipSays expr="happy">
              <BubbleText>
                Found <B>{items.length} line{items.length === 1 ? '' : 's'}</B>…
              </BubbleText>
            </PipSays>
          )}
          {phase === 'error' && (
            <PipSays expr="curious">
              <BubbleText>{error}</BubbleText>
            </PipSays>
          )}
          {phase === 'result' && items.length > 0 && (
            <PipSays expr="happy">
              <BubbleText>
                Got it. <B>{items.length} transaction{items.length > 1 ? 's' : ''}</B>{totalLabel}.
                {recognized > 0 ? (
                  <BubbleText>
                    {' '}I already recognise <B>{recognized}</B> of them.
                  </BubbleText>
                ) : null}
              </BubbleText>
            </PipSays>
          )}
          {phase === 'result' && items.length === 0 && (
            <PipSays expr="curious">
              <BubbleText>I couldn’t find any transactions in that image. Try a clearer screenshot.</BubbleText>
            </PipSays>
          )}
        </View>

        {/* picked image preview with scanline, tappable to view full-screen */}
        <Pressable onPress={() => setViewingPhoto(true)} style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <Card style={[styles.preview, { backgroundColor: colorTheme.surface2 }]}>
            <Image source={{ uri: image.uri }} style={[styles.previewImg, { backgroundColor: colorTheme.surface2 }]} resizeMode="contain" />
            {phase === 'scanning' && (
              <Animated.View style={[styles.scanline, { borderTopColor: theme.accent }, { transform: [{ translateY }] }]} />
            )}
          </Card>
        </Pressable>

        {phase === 'result' && items.length > 0 && (
          <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
            <AccountLinkField accounts={accounts} selectedId={linkId} onSelect={setLinkId} required />
          </View>
        )}

        {phase === 'result' && items.length > 0 && (
          <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
            <Eyebrow style={{ marginBottom: 10 }}>Extracted items</Eyebrow>
            <Card style={{ overflow: 'hidden' }}>
              {withSuggestions.map((e, i) => (
                <View key={i} style={[styles.itemRow, i > 0 && [styles.divider, { borderTopColor: colorTheme.line2 }]]}>
                  <View style={[styles.initialBox, { backgroundColor: colorTheme.surface2 }]}>
                    <Text style={[styles.initial, { color: colorTheme.ink2 }]}>{e.merchant.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.merchant, { color: colorTheme.ink }]} numberOfLines={1}>
                      {e.merchant}
                    </Text>
                    {e.suggestion && catById[e.suggestion] ? (
                      <View style={styles.likely}>
                        <Icon name="sparkles" size={11} color={theme.accentInk} />
                        <Text style={[styles.likelyText, { color: theme.accentInk }]}>likely {catById[e.suggestion].label}</Text>
                      </View>
                    ) : e.type === 'income' ? (
                      <Text style={[styles.incomeTag, { color: theme.accent }]}>received</Text>
                    ) : null}
                  </View>
                  <Amount value={e.amount} size={14} weight={600} color={e.type === 'income' ? theme.accent : colorTheme.ink} />
                  <Pressable onPress={() => removeAt(i)} hitSlop={8} style={[styles.removeBtn, { backgroundColor: colorTheme.surface2 }]}>
                    <Icon name="x" size={15} color={colorTheme.ink3} />
                  </Pressable>
                </View>
              ))}
            </Card>
            <Text style={[styles.removeHint, { color: colorTheme.ink2 }]}>Tap ✕ to skip a row you don’t want to record.</Text>
          </View>
        )}
      </ScrollView>

      {/* sticky footer */}
      <View style={[styles.footer, { backgroundColor: colorTheme.bg, borderTopColor: colorTheme.line2 }, { paddingBottom: insets.bottom + 16 }]}>
        {phase === 'result' && items.length > 0 && (
          <PrimaryButton onPress={() => onDone(items, linkId, elapsedMs)}>
            <BtnLabel>Sort {items.length} item{items.length > 1 ? 's' : ''}</BtnLabel>
            <Icon name="arrowRight" size={19} color="#fff" />
          </PrimaryButton>
        )}
        {(phase === 'error' || (phase === 'result' && items.length === 0)) && (
          <PrimaryButton onPress={onBack}>
            <Icon name="image" size={19} color="#fff" />
            <BtnLabel>Try another image</BtnLabel>
          </PrimaryButton>
        )}
      </View>

      <Modal visible={viewingPhoto} transparent animationType="fade" onRequestClose={() => setViewingPhoto(false)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewingPhoto(false)}>
          <Image source={{ uri: image.uri }} style={styles.viewerImage} resizeMode="contain" />
          <Pressable onPress={() => setViewingPhoto(false)} style={[styles.viewerClose, { top: insets.top + 12 }]} hitSlop={10}>
            <Icon name="x" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  preview: { overflow: 'hidden', padding: 0 },
  previewImg: { width: '100%', height: PREVIEW_H },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(10,14,12,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', right: 18, padding: 8 },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 28,
    backgroundColor: 'rgba(31,138,91,0.28)',
    borderTopWidth: 2,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 11 },
  divider: { borderTopWidth: 1 },
  removeBtn: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  removeHint: { fontFamily: uiFont(500), fontSize: 12, marginTop: 10, marginLeft: 2 },
  initialBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: uiFont(700), fontSize: 13 },
  merchant: { fontFamily: uiFont(600), fontSize: 14 },
  likely: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  likelyText: { fontFamily: uiFont(600), fontSize: 11.5 },
  incomeTag: { fontFamily: uiFont(600), fontSize: 11.5, marginTop: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
