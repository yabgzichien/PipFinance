// src/screens/ReceiptScanScreen.tsx
// Photograph the paper receipt, let the vision model read the lines, then tap each item onto
// whoever ate it. Service charge and tax are prefilled from what the receipt actually printed
// and ride on each person's own items; the amount the card was charged is the figure everything
// reconciles to, because that is what left the account.
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddPersonModal } from '../components/AddPersonModal';
import { Icon } from '../components/Icon';
import { InfoButton } from '../components/InfoButton';
import { ReceiptItemModal } from '../components/ReceiptItemModal';
import { B, BtnLabel, BubbleText, Card, PipSays, PrimaryButton, TopBar } from '../components/ui';
import { activateCurrency, getActiveCurrencies } from '../db/currencyRepo';
import { BASE_CURRENCY } from '../lib/currency';
import { scanDocument } from '../lib/documentScanner';
import { currencyPrefix, fmtMoney } from '../lib/format';
import { llmErrorMessage } from '../llm';
import { derivedSurcharges, type ScannedReceipt } from '../lib/parseReceipt';
import { notify } from '../lib/platformAlert';
import { saveReceiptImage } from '../lib/receiptStorage';
import { scanReceiptImage } from '../lib/scanReceipt';
import { computeBillTotal, computeItemized, SELF, type Discount, type ReceiptLine, type Surcharges } from '../lib/split';
import type { SplitDraft } from '../lib/types';
import { useAppData } from '../state/store';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { colors, numFont, radius, uiFont } from '../theme';
import type { PickedImage } from './AttachScreen';

export interface ReceiptSplitResult {
  merchant: string | null;
  /** Currency code for the receipt, e.g. 'MYR' or 'CNY'. */
  currency: string;
  /** What the card was actually charged, which the split reconciles to exactly. */
  charged: number;
  /** null when nobody was added — the receipt was the user's alone, so the whole charge is
   *  their own expense and there is no share for anyone to owe back. */
  draft: SplitDraft | null;
  /** The saved receipt photo's permanent URI, or null if the user left "keep this photo" off. */
  photoUri: string | null;
  /** This screen's own editable state at the moment "Use this receipt/split" was tapped. Handed
   *  back in as `initialDraft` if the user backs out of the next screen, so a remount (the kind
   *  question and "Check your receipt" are separate phases that unmount this one) restores what
   *  was typed and assigned instead of re-deriving from the original scan. */
  resumeState: ReceiptDraftState;
}

/** Everything on the assign screen the user can edit, snapshotted so a remount can resume from it
 *  instead of the raw LLM read. */
export interface ReceiptDraftState {
  keepPhoto: boolean;
  lines: ReceiptLine[];
  surcharges: Surcharges;
  chargedText: string;
  picked: string[];
}

/** A receipt read that came back with nothing usable: a network/auth/parse failure, not just an
 *  unreadable photo. Falling through to the assign screen with this (rather than bouncing back to
 *  capture) means the user can still type the total by hand and save, photo included. */
const EMPTY_SCAN: ScannedReceipt = {
  merchant: null,
  currency: BASE_CURRENCY,
  items: [],
  subtotal: null,
  serviceCharge: null,
  tax: null,
  total: null,
  discount: null,
};

type Phase = 'capture' | 'reading' | 'assign';

export function ReceiptScanScreen({
  initialImage,
  cachedReceipt,
  initialDraft,
  onScanned,
  onBack,
  onDone,
  onManualInstead,
}: {
  /** The image the add hub already captured, handed over once the user confirmed on
   *  ScanKindScreen that it was a receipt. When set, this screen skips straight to reading it;
   *  its own capture screen stays reachable as the retry surface if that read fails. */
  initialImage?: PickedImage;
  /** A previous read of this same image, handed back in when the user backed out to the kind
   *  question and returned. Lets the screen skip straight to 'assign' instead of paying for
   *  another LLM round-trip (and the "reading" loading beat) to re-read a receipt already read. */
  cachedReceipt?: ScannedReceipt | null;
  /** The edits made last time this screen was on 'assign', handed back in when the user backed
   *  out of "Check your receipt" (a separate phase that unmounts this screen). Without this, a
   *  remount would re-derive everything from `cachedReceipt` and silently drop what was typed. */
  initialDraft?: ReceiptDraftState | null;
  /** Fired once a fresh read succeeds, so the caller can remember it for next time. */
  onScanned?: (receipt: ScannedReceipt) => void;
  onBack: () => void;
  onDone: (result: ReceiptSplitResult) => void;
  /** Escape hatch: split a typed total instead of a photographed receipt. */
  onManualInstead: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { people, addPerson } = useAppData();

  const [phase, setPhase] = useState<Phase>(cachedReceipt ? 'assign' : initialImage ? 'reading' : 'capture');
  const [error, setError] = useState('');
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(initialImage ?? null);
  // Defaults on: most people want the photo kept for later reference, and this is the far more
  // common choice, so opting out should be the deliberate action, not opting in.
  const [keepPhoto, setKeepPhoto] = useState(initialDraft?.keepPhoto ?? true);
  const [receipt, setReceipt] = useState<ScannedReceipt | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>(initialDraft?.lines ?? []);
  const [surcharges, setSurcharges] = useState<Surcharges>(
    initialDraft?.surcharges ?? { serviceChargePct: 0, taxPct: 0, discount: null }
  );
  const [chargedText, setChargedText] = useState(initialDraft?.chargedText ?? '');
  const [picked, setPicked] = useState<string[]>(initialDraft?.picked ?? []);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [itemModal, setItemModal] = useState<{ visible: boolean; item: ReceiptLine | null }>({
    visible: false,
    item: null,
  });
  const [busy, setBusy] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [activeCurrencies, setActiveCurrencies] = useState<string[]>([BASE_CURRENCY]);
  const [activatingCode, setActivatingCode] = useState<string | null>(null);

  useEffect(() => {
    getActiveCurrencies().then(setActiveCurrencies);
  }, []);

  // The payer is always at the table, and always last, so every rounding residue lands on them.
  const participants = useMemo(() => [...picked, SELF], [picked]);
  const nameById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);
  const unpicked = useMemo(() => people.filter((p) => !picked.includes(p.id)), [people, picked]);

  const charged = Math.max(0, Math.round((parseFloat(chargedText.replace(/[^0-9.]/g, '')) || 0) * 100) / 100);
  // The base the voucher's RM/% toggle converts against.
  const itemsSubtotal = useMemo(() => lines.reduce((s, l) => s + Math.max(0, l.amount), 0), [lines]);
  const result = useMemo(
    () => computeItemized(lines, surcharges, charged, participants),
    [lines, surcharges, charged, participants]
  );
  const owedByPerson = useMemo(() => {
    const map: Record<string, number> = { [SELF]: result.ownShare };
    for (const s of result.shares) map[s.personId] = s.owed;
    return map;
  }, [result]);

  // A charged total below what people ordered can push a light eater's share negative, which is
  // not a bill anyone can settle. Better to say so than to save an incoherent split.
  const negative = result.shares.some((s) => s.owed < 0) || result.ownShare < 0;
  // Splitting is optional: a receipt you paid alone is still a receipt worth scanning, and the
  // total is all it needs. Only a split has shares that can go negative.
  const splitting = picked.length > 0;
  const canSave = charged > 0 && (!splitting || !negative);

  // Populates every field the assign screen reads, whether the receipt was just read live or
  // handed back in as a cache hit.
  const applyScan = (scanned: ScannedReceipt) => {
    setReceipt(scanned);
    setLines(
      scanned.items.map((it, i) => ({
        id: `l${i}`,
        label: it.quantity && it.quantity > 1 ? `${it.quantity}× ${it.label}` : it.label,
        amount: it.amount,
        assignedTo: [],
      }))
    );
    setSurcharges(derivedSurcharges(scanned));
    const fallbackTotal = scanned.items.reduce((s, it) => s + it.amount, 0);
    setChargedText((scanned.total ?? fallbackTotal).toFixed(2));
  };

  const read = async (image: PickedImage) => {
    setPickedImage(image);
    setPhase('reading');
    setError('');
    try {
      const scanned = await scanReceiptImage(image.base64, image.mime);
      applyScan(scanned);
      onScanned?.(scanned);
      setPhase('assign');
    } catch (e) {
      // A read failure (network, auth, or a reply nothing usable could be parsed from) still
      // leaves a real photo the user took. Falling through to 'assign' with a blank receipt lets
      // them type the total by hand and save it, instead of dead-ending at 'capture' with only
      // "try again" or the photo-less manual-split escape hatch. Reporting it as a scan (even an
      // empty one) marks it as read, the same as a success, so backing out and back in resumes
      // what was typed instead of re-running the same failing read and losing it.
      setError(llmErrorMessage(e));
      applyScan(EMPTY_SCAN);
      onScanned?.(EMPTY_SCAN);
      setPhase('assign');
    }
  };

  // Mount-once: the add hub already has the image, so reading starts without a second capture.
  // A cache hit (the user backed out and came right back) skips the read entirely: no spinner,
  // no "reading it line by line" beat for a receipt already read. When an `initialDraft` also
  // came back, the edits it carries take priority over re-deriving fields from the raw scan; the
  // scan is only consulted here for the merchant name in the title.
  useEffect(() => {
    if (cachedReceipt) {
      if (initialDraft) setReceipt(cachedReceipt);
      else applyScan(cachedReceipt);
      return;
    }
    if (initialImage) read(initialImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResult = (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (!a.base64) {
      notify('Hmm', "That photo couldn't be read. Try another one.");
      return;
    }
    read({ uri: a.uri, base64: a.base64, mime: a.mimeType ?? 'image/jpeg' });
  };

  const takePhoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Same native-vs-web branch as AttachScreen's takePhoto: a live bounding box on native
      // builds, the plain camera picker on web or when the native scanner isn't registered.
      if (Platform.OS !== 'web') {
        const outcome = await scanDocument();
        if (outcome.status === 'picked') {
          read(outcome.image);
          return;
        }
        if (outcome.status === 'cancelled') return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow camera access to photograph the receipt.');
        return;
      }
      handleResult(await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 }));
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow photo access to pick the receipt.');
        return;
      }
      handleResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 }));
    } finally {
      setBusy(false);
    }
  };

  const toggleAssign = (lineId: string, personId: string) =>
    setLines((prev) =>
      prev.map((l) =>
        l.id !== lineId
          ? l
          : {
              ...l,
              assignedTo: l.assignedTo.includes(personId)
                ? l.assignedTo.filter((x) => x !== personId)
                : [...l.assignedTo, personId],
            }
      )
    );

  const shareWholeTable = (lineId: string) =>
    setLines((prev) =>
      prev.map((l) =>
        l.id !== lineId ? l : { ...l, assignedTo: l.assignedTo.length === participants.length ? [] : [...participants] }
      )
    );

  const addNew = async (name: string) => {
    const person = await addPerson(name);
    setPicked((prev) => (prev.includes(person.id) ? prev : [...prev, person.id]));
  };

  const removePerson = (id: string) => {
    setPicked((prev) => prev.filter((x) => x !== id));
    setLines((prev) => prev.map((l) => ({ ...l, assignedTo: l.assignedTo.filter((x) => x !== id) })));
  };

  const handleSaveItem = (itemData: { id?: string; label: string; amount: number }) => {
    let nextLines: ReceiptLine[];
    if (itemData.id) {
      nextLines = lines.map((l) =>
        l.id === itemData.id ? { ...l, label: itemData.label, amount: itemData.amount } : l
      );
    } else {
      const newLine: ReceiptLine = {
        id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: itemData.label,
        amount: itemData.amount,
        assignedTo: [],
      };
      nextLines = [...lines, newLine];
    }
    setLines(nextLines);
    const newTotal = computeBillTotal(nextLines, surcharges);
    setChargedText(newTotal.toFixed(2));
  };

  const handleDeleteItem = (id: string) => {
    const nextLines = lines.filter((l) => l.id !== id);
    setLines(nextLines);
    const newTotal = computeBillTotal(nextLines, surcharges);
    setChargedText(newTotal.toFixed(2));
  };

  const updateSurcharges = (updater: (s: Surcharges) => Surcharges) => {
    setSurcharges((prev) => {
      const next = updater(prev);
      const newTotal = computeBillTotal(lines, next);
      setChargedText(newTotal.toFixed(2));
      return next;
    });
  };

  const save = () => {
    if (!canSave) return;
    let photoUri: string | null = null;
    if (keepPhoto && pickedImage) {
      try {
        photoUri = saveReceiptImage(pickedImage.uri, pickedImage.mime);
      } catch {
        // Best-effort: a failed copy just means no saved photo, not a failed receipt.
      }
    }
    onDone({
      merchant: receipt?.merchant ?? null,
      currency: receipt?.currency ?? BASE_CURRENCY,
      charged,
      photoUri,
      draft: splitting
        ? {
            gross: charged,
            ownShare: result.ownShare,
            method: 'itemized',
            shares: result.shares.filter((s) => s.owed > 0),
          }
        : null,
      resumeState: { keepPhoto, lines, surcharges, chargedText, picked },
    });
  };

  if (phase === 'reading') {
    return (
      <View style={[styles.root, { backgroundColor: colorTheme.bg }, styles.center]}>
        <PipSays expr="think">
          <BubbleText>Reading the receipt line by line… this takes a few seconds.</BubbleText>
        </PipSays>
        <ActivityIndicator color={theme.accent} style={{ marginTop: 22 }} />
      </View>
    );
  }

  if (phase === 'capture') {
    return (
      <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
        <View style={{ paddingTop: insets.top + 4 }}>
          <TopBar title="Scan a receipt" onBack={onBack} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
          <PipSays expr="curious">
            <BubbleText>
              Photograph the <B>paper receipt</B> and I’ll read each item. Paid for other people too?
              Tap who ate what instead of doing mental arithmetic at the table.
            </BubbleText>
          </PipSays>

          {error !== '' && (
            <Card style={[styles.errorCard, { backgroundColor: colorTheme.redTint, borderColor: colorTheme.redSoft }]}>
              <Icon name="alert" size={17} color="#b3261e" />
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          )}

          <View style={{ gap: 14, marginTop: 18 }}>
            <SourceRow icon="camera" title="Take a photo" sub="Point at the itemised receipt" onPress={takePhoto} disabled={busy} />
            <SourceRow icon="gallery" title="Choose from gallery" sub="Pick a photo you already took" onPress={pickFromLibrary} disabled={busy} />
            <SourceRow icon="pencil" title="No receipt? Split a total" sub="Type the amount and divide it by hand" onPress={onManualInstead} disabled={busy} />
          </View>

          <Text style={[styles.hint, { color: colorTheme.ink3 }]}>
            The photo is read once and never stored. If you split it, only your own share is recorded as
            spending.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        {/* Back means "this wasn't a receipt after all" when the hub supplied the image, so it
            returns to the kind question rather than to a capture screen the user never used. */}
        <TopBar
          title={receipt?.merchant ?? 'Assign the items'}
          onBack={() => (initialImage ? onBack() : setPhase('capture'))}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error !== '' && (
          <Card style={[styles.errorCard, { backgroundColor: colorTheme.redTint, borderColor: colorTheme.redSoft }]}>
            <Icon name="alert" size={17} color="#b3261e" />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}

        <PipSays expr={lines.length === 0 ? 'curious' : 'happy'}>
          <BubbleText>
            {lines.length === 0 ? (
              <>I couldn’t make out any items. Check the total below, and add anyone you split it with.</>
            ) : (
              <>
                I read <B>{lines.length} items</B>. Save it as yours, or add who was at the table and tap each
                item onto whoever ordered it.
              </>
            )}
          </BubbleText>
        </PipSays>

        {/* The photo the camera/gallery just handed over, still in memory regardless of whether
            "keep this photo" ends up on: reviewing what was scanned shouldn't depend on whether
            it will be kept afterward. */}
        {pickedImage && (
          <Pressable
            onPress={() => setViewingPhoto(true)}
            style={[styles.keepRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}
          >
            <Image source={{ uri: pickedImage.uri }} style={[styles.receiptThumb, { borderColor: colorTheme.line }]} />
            <View style={styles.keepInfo}>
              <Text style={[styles.keepTitle, { color: colorTheme.ink }]}>Receipt photo</Text>
              <Text style={[styles.keepSub, { color: colorTheme.ink2 }]}>Tap to view the full photo</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
          </Pressable>
        )}

        {/* Hidden on web rather than disabled: expo-file-system's persistent storage has no web
            support, so a toggle that silently keeps nothing is worse than one not offered. */}
        {Platform.OS !== 'web' && (
          <View style={[styles.keepRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <View style={styles.keepInfo}>
              <Text style={[styles.keepTitle, { color: colorTheme.ink }]}>Keep this receipt photo</Text>
              <Text style={[styles.keepSub, { color: colorTheme.ink2 }]}>View it later from the transaction</Text>
            </View>
            <Switch
              value={keepPhoto}
              onValueChange={setKeepPhoto}
              trackColor={{ false: colorTheme.line2, true: theme.accent }}
              thumbColor="#ffffff"
              ios_backgroundColor={colorTheme.line2}
              accessibilityRole="switch"
              accessibilityLabel="Keep this receipt photo"
              accessibilityState={{ checked: keepPhoto }}
            />
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Text style={[styles.label, { marginBottom: 0, color: colorTheme.ink2 }]}>Who was at the table (optional)</Text>
          <InfoButton entry="split_bill" />
        </View>
        <View style={styles.chipWrap}>
          {unpicked.map((p) => (
            <Pressable key={p.id} onPress={() => setPicked((prev) => [...prev, p.id])} style={[styles.chip, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Icon name="plus" size={13} color={theme.accent} stroke={2.4} />
              <Text style={[styles.chipText, { color: theme.onTint }]}>{p.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setAddPersonOpen(true)} style={[styles.chip, styles.addChip, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
            <Icon name="plus" size={13} color={colorTheme.ink2} stroke={2.4} />
            <Text style={[styles.chipText, { color: colorTheme.ink2 }]}>Add a name</Text>
          </Pressable>
        </View>

        {picked.length > 0 && (
          <View style={styles.tableRow}>
            {picked.map((id) => (
              <Pressable key={id} onPress={() => removePerson(id)} style={[styles.tableChip, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                <Text style={[styles.tableChipText, { color: colorTheme.ink }]}>{nameById[id] ?? 'Someone'}</Text>
                <Icon name="x" size={12} color={colorTheme.ink3} />
              </Pressable>
            ))}
            <View style={[styles.tableChip, styles.tableChipSelf, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Text style={[styles.tableChipText, { color: colorTheme.ink }]}>You</Text>
            </View>
          </View>
        )}

        {picked.length === 0 && (
          <Text style={[styles.empty, { color: colorTheme.ink3 }]}>Paid for it alone? Leave this empty and just check the total.</Text>
        )}

        {receipt && receipt.currency !== BASE_CURRENCY && !activeCurrencies.includes(receipt.currency) && (
          <Card
            style={{
              padding: 14,
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemLabel, { color: colorTheme.ink }]}>
                Detected {receipt.currency} receipt
              </Text>
              <Text style={[styles.meta, { color: colorTheme.ink2, marginTop: 2 }]}>
                Add {receipt.currency} to convert and track this receipt.
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                if (activatingCode) return;
                setActivatingCode(receipt.currency);
                try {
                  const ok = await activateCurrency(receipt.currency);
                  if (!ok) {
                    notify(`Couldn't fetch the ${receipt.currency} rate.`, "Try again when you're online.");
                    return;
                  }
                  const nextActive = await getActiveCurrencies();
                  setActiveCurrencies(nextActive);
                } finally {
                  setActivatingCode(null);
                }
              }}
              disabled={activatingCode === receipt.currency}
              style={[
                styles.addCurrencyBtn,
                { backgroundColor: theme.accent },
                activatingCode === receipt.currency && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Add ${receipt.currency}`}
            >
              {activatingCode === receipt.currency ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addCurrencyBtnText}>Add {receipt.currency}</Text>
              )}
            </Pressable>
          </Card>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.label, { marginTop: 0, marginBottom: 0, color: colorTheme.ink2 }]}>
            What they ordered
          </Text>
          <Pressable
            onPress={() => setItemModal({ visible: true, item: null })}
            style={[styles.addInlineBtn, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Add item"
          >
            <Icon name="plus" size={13} color={theme.accent} stroke={2.4} />
            <Text style={[styles.addInlineText, { color: theme.onTint }]}>Add item</Text>
          </Pressable>
        </View>

        {lines.length === 0 ? (
          <Card style={[styles.emptyLinesCard, { borderColor: colorTheme.line, backgroundColor: colorTheme.surface }]}>
            <Text style={[styles.emptyLinesText, { color: colorTheme.ink2 }]}>No items listed yet.</Text>
            <Pressable
              onPress={() => setItemModal({ visible: true, item: null })}
              style={[styles.addItemRowBtn, { borderColor: theme.accentSoft, backgroundColor: theme.accentTint }]}
              accessibilityRole="button"
              accessibilityLabel="Add an item"
            >
              <Icon name="plus" size={15} color={theme.accent} stroke={2.4} />
              <Text style={[styles.addItemRowText, { color: theme.onTint }]}>Add an item</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            <Card style={{ overflow: 'hidden' }}>
              {lines.map((line, i) => {
                const everyone = line.assignedTo.length === participants.length;
                const receiptCurrency = receipt?.currency ?? BASE_CURRENCY;
                return (
                  <View key={line.id} style={[styles.itemRow, i > 0 && styles.divider, i > 0 && { borderTopColor: colorTheme.line2 }]}>
                    <View style={styles.itemHead}>
                      <Pressable
                        onPress={() => setItemModal({ visible: true, item: line })}
                        style={styles.itemLabelPressable}
                        accessibilityLabel={`Edit ${line.label}`}
                      >
                        <Text style={[styles.itemLabel, { color: colorTheme.ink }]} numberOfLines={1}>
                          {line.label}
                        </Text>
                        <Icon name="pencil" size={13} color={colorTheme.ink3} />
                      </Pressable>
                      <Pressable onPress={() => setItemModal({ visible: true, item: line })}>
                        <Text style={[styles.itemAmount, { color: colorTheme.ink }]}>{fmtMoney(line.amount, receiptCurrency)}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteItem(line.id)}
                        hitSlop={8}
                        style={styles.deleteLineBtn}
                        accessibilityLabel={`Delete ${line.label}`}
                      >
                        <Icon name="trash" size={15} color={colorTheme.ink3} />
                      </Pressable>
                    </View>
                    {splitting && (
                    <View style={styles.avatarRow}>
                      {participants.map((id) => {
                        const on = line.assignedTo.includes(id);
                        const name = id === SELF ? 'You' : nameById[id] ?? '?';
                        return (
                          <Pressable
                            key={id}
                            onPress={() => toggleAssign(line.id, id)}
                            style={[
                              styles.avatar,
                              { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line },
                              on && styles.avatarOn,
                              on && { backgroundColor: theme.accent, borderColor: theme.accent },
                            ]}
                            accessibilityLabel={`${on ? 'Remove' : 'Add'} ${name} on ${line.label}`}
                            accessibilityState={{ selected: on }}
                          >
                            <Text style={[styles.avatarText, { color: colorTheme.ink2 }, on && styles.avatarTextOn]}>
                              {name.slice(0, id === SELF ? 3 : 1).toUpperCase()}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <Pressable onPress={() => shareWholeTable(line.id)} style={styles.allBtn} hitSlop={4}>
                        <Text style={[styles.allText, { color: theme.accent }, everyone && { color: colorTheme.ink3 }]}>
                          {everyone ? 'Clear' : 'Shared'}
                        </Text>
                      </Pressable>
                    </View>
                    )}
                  </View>
                );
              })}
              <Pressable
                onPress={() => setItemModal({ visible: true, item: null })}
                style={[styles.addItemBottomRow, styles.divider, { borderTopColor: colorTheme.line2, backgroundColor: colorTheme.surface2 }]}
                accessibilityRole="button"
                accessibilityLabel="Add another item"
              >
                <Icon name="plus" size={14} color={theme.accent} stroke={2.4} />
                <Text style={[styles.addItemBottomText, { color: theme.accent }]}>Add an item</Text>
              </Pressable>
            </Card>
            {splitting && result.unassigned.length > 0 && (
              <Text style={[styles.unassigned, { color: colorTheme.amber }]}>
                {result.unassigned.length} item{result.unassigned.length === 1 ? '' : 's'} nobody has claimed
                yet, shared across the table for now.
              </Text>
            )}
          </>
        )}

        {splitting && (
          <>
            <Text style={[styles.label, { marginTop: 22, color: colorTheme.ink2 }]}>On top of the items</Text>
            <Card style={{ padding: 4 }}>
              <PctRow
                label="Service charge"
                value={surcharges.serviceChargePct}
                onChange={(v) => updateSurcharges((s) => ({ ...s, serviceChargePct: v }))}
                note="Applied to the items subtotal"
              />
              <View style={[styles.divider, { borderTopColor: colorTheme.line2 }]} />
              <PctRow
                label="Service tax"
                value={surcharges.taxPct}
                onChange={(v) => updateSurcharges((s) => ({ ...s, taxPct: v }))}
                note="Applied after the service charge, the way the receipt does it"
              />
              <View style={[styles.divider, { borderTopColor: colorTheme.line2 }]} />
              <DiscountRow
                discount={surcharges.discount ?? null}
                onChange={(d) => updateSurcharges((s) => ({ ...s, discount: d }))}
                subtotal={itemsSubtotal}
                currency={receipt?.currency ?? BASE_CURRENCY}
              />
            </Card>
          </>
        )}

        {/* Always shown: the total is the whole point of the scan, split or not. */}
        <Text style={[styles.label, { marginTop: 22, color: colorTheme.ink2 }]}>Total</Text>
        <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
          <Text style={[styles.rm, { color: colorTheme.ink2 }]}>
            {currencyPrefix(receipt?.currency ?? BASE_CURRENCY)}
          </Text>
          <TextInput
            value={chargedText}
            onChangeText={setChargedText}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={[styles.amountInput, { color: colorTheme.ink }]}
          />
        </View>

        {splitting && (
          <>
            {Math.abs(result.difference) >= 0.01 && (
              <Text style={[styles.diffNote, { color: colorTheme.ink2 }]}>
                The receipt adds up to {fmtMoney(result.computedTotal, receipt?.currency ?? BASE_CURRENCY)}, so {fmtMoney(Math.abs(result.difference), receipt?.currency ?? BASE_CURRENCY)}{' '}
                {result.difference > 0 ? 'more was charged' : 'less was charged'}. That is shared across the
                table so the split matches your bank exactly.
              </Text>
            )}

            <Card style={styles.summary}>
              {participants.map((id) => (
                <View key={id} style={styles.summaryRow}>
                  <Text style={[styles.summaryName, { color: colorTheme.ink2 }, id === SELF && [styles.summaryNameSelf, { color: colorTheme.ink }]]}>
                    {id === SELF ? 'You (your expense)' : nameById[id] ?? 'Someone'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.accent }, id === SELF && [styles.summaryValueSelf, { color: colorTheme.ink }]]}>
                    {fmtMoney(owedByPerson[id] ?? 0, receipt?.currency ?? BASE_CURRENCY)}
                  </Text>
                </View>
              ))}
            </Card>

            {negative && (
              <Text style={styles.error}>
                That charge is lower than what people ordered, so someone ends up owing a negative amount.
                Check the total.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colorTheme.bg, borderTopColor: colorTheme.line2 }]}>
        <PrimaryButton onPress={save} disabled={!canSave}>
          <Icon name="check" size={19} color="#fff" stroke={2.4} />
          <BtnLabel>{splitting ? 'Use this split' : 'Use this receipt'}</BtnLabel>
        </PrimaryButton>
      </View>

      <AddPersonModal visible={addPersonOpen} onClose={() => setAddPersonOpen(false)} onSubmit={addNew} />

      <ReceiptItemModal
        visible={itemModal.visible}
        item={itemModal.item}
        currency={receipt?.currency ?? BASE_CURRENCY}
        onClose={() => setItemModal({ visible: false, item: null })}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />

      <Modal visible={viewingPhoto} transparent animationType="fade" onRequestClose={() => setViewingPhoto(false)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewingPhoto(false)}>
          {pickedImage && <Image source={{ uri: pickedImage.uri }} style={styles.viewerImage} resizeMode="contain" />}
          <Pressable onPress={() => setViewingPhoto(false)} style={[styles.viewerClose, { top: insets.top + 12 }]} hitSlop={10}>
            <Icon name="x" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** An editable percentage with a quick on/off, since not every receipt charges these. */
function PctRow({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  note: string;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [text, setText] = useState(String(value));
  // Keep the field in step when the scan prefills a rate the user has not touched.
  React.useEffect(() => setText(String(value)), [value]);
  const on = value > 0;

  return (
    <View style={styles.pctRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pctLabel, { color: colorTheme.ink }]}>{label}</Text>
        <Text style={[styles.pctNote, { color: colorTheme.ink2 }]}>{note}</Text>
      </View>
      {on ? (
        <View style={[styles.pctField, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              const n = parseFloat(v.replace(/[^0-9.]/g, ''));
              onChange(Number.isFinite(n) && n >= 0 ? n : 0);
            }}
            keyboardType="decimal-pad"
            style={[styles.pctInput, { color: colorTheme.ink }]}
            selectTextOnFocus
          />
          <Text style={[styles.pctSign, { color: colorTheme.ink2 }]}>%</Text>
        </View>
      ) : (
        <Pressable onPress={() => onChange(label === 'Service tax' ? 6 : 10)} style={[styles.pctAdd, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]} hitSlop={4}>
          <Text style={[styles.pctAddText, { color: theme.onTint }]}>Add</Text>
        </Pressable>
      )}
      {on && (
        <Pressable onPress={() => onChange(0)} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
          <Icon name="x" size={15} color={colorTheme.ink3} />
        </Pressable>
      )}
    </View>
  );
}

/** A voucher or discount: RM or %, and whether it comes off before or after the surcharges
 *  above  both editable in case the auto-detected receipt got either one wrong. */
function DiscountRow({
  discount,
  onChange,
  subtotal,
  currency,
}: {
  discount: Discount | null;
  onChange: (d: Discount | null) => void;
  subtotal: number;
  /** The receipt's own currency — a flat discount is denominated in it, not always ringgit. */
  currency: string;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [text, setText] = useState(discount ? String(discount.value) : '');
  // Keep the field in step when the scan prefills a value the user has not touched.
  React.useEffect(() => setText(discount ? String(discount.value) : ''), [discount?.value, discount?.unit]);

  if (!discount) {
    return (
      <View style={styles.pctRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pctLabel, { color: colorTheme.ink }]}>Voucher / discount</Text>
          <Text style={[styles.pctNote, { color: colorTheme.ink2 }]}>Subtracted from the bill</Text>
        </View>
        <Pressable
          onPress={() => onChange({ unit: 'amount', value: 0, timing: 'before' })}
          style={[styles.pctAdd, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}
          hitSlop={4}
        >
          <Text style={[styles.pctAddText, { color: theme.onTint }]}>Add</Text>
        </Pressable>
      </View>
    );
  }

  const toggleUnit = () => {
    if (discount.unit === 'amount') {
      const pct = subtotal > 0 ? Math.round((discount.value / subtotal) * 1000) / 10 : 0;
      onChange({ ...discount, unit: 'pct', value: pct });
    } else {
      const amount = Math.round(((subtotal * discount.value) / 100) * 100) / 100;
      onChange({ ...discount, unit: 'amount', value: amount });
    }
  };

  const toggleTiming = () => onChange({ ...discount, timing: discount.timing === 'before' ? 'after' : 'before' });

  return (
    <View style={styles.pctRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pctLabel, { color: colorTheme.ink }]}>Voucher / discount</Text>
        <Pressable onPress={toggleTiming} hitSlop={4}>
          <Text style={[styles.pctNote, { color: theme.accent }]}>
            {discount.timing === 'before' ? 'Applied before service charge & tax' : 'Applied to the final total'}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.pctField, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            const n = parseFloat(v.replace(/[^0-9.]/g, ''));
            onChange({ ...discount, value: Number.isFinite(n) && n >= 0 ? n : 0 });
          }}
          keyboardType="decimal-pad"
          style={[styles.pctInput, { color: colorTheme.ink }]}
          selectTextOnFocus
        />
        <Pressable onPress={toggleUnit} hitSlop={6} accessibilityLabel="Switch between a flat amount and a percentage">
          <Text style={[styles.pctSign, { color: theme.accent }]}>{discount.unit === 'pct' ? '%' : currencyPrefix(currency)}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel="Remove voucher or discount">
        <Icon name="x" size={15} color={colorTheme.ink3} />
      </Pressable>
    </View>
  );
}

function SourceRow({
  icon,
  title,
  sub,
  onPress,
  disabled,
}: {
  icon: 'camera' | 'gallery' | 'pencil';
  title: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.source, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, pressed && { opacity: 0.9 }]}>
      <View style={[styles.sourceIcon, { backgroundColor: theme.accentTint }]}>
        <Icon name={icon} size={19} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sourceTitle, { color: colorTheme.ink }]}>{title}</Text>
        <Text style={[styles.sourceSub, { color: colorTheme.ink2 }]}>{sub}</Text>
      </View>
      <Icon name="chevronRight" size={18} color={colorTheme.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginTop: 16 },
  errorText: { flex: 1, fontFamily: uiFont(600), fontSize: 13, color: '#b3261e' },
  hint: { fontFamily: uiFont(500), fontSize: 12, textAlign: 'center', marginTop: 22, lineHeight: 17 },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  sourceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sourceTitle: { fontFamily: uiFont(700), fontSize: 15 },
  sourceSub: { fontFamily: uiFont(500), fontSize: 12.5, marginTop: 2 },

  keepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  keepInfo: { flex: 1 },
  keepTitle: { fontFamily: uiFont(700), fontSize: 14 },
  keepSub: { fontFamily: uiFont(500), fontSize: 12, marginTop: 2 },
  receiptThumb: { width: 44, height: 44, borderRadius: 10, borderWidth: 1 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(10,14,12,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', right: 18, padding: 8 },

  label: { fontFamily: uiFont(600), fontSize: 12.5, marginTop: 18, marginBottom: 9 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: uiFont(600), fontSize: 13 },
  addChip: { borderStyle: 'dashed' },
  tableRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  tableChipSelf: {},
  tableChipText: { fontFamily: uiFont(600), fontSize: 13 },
  empty: { fontFamily: uiFont(500), fontSize: 13, marginTop: 18, textAlign: 'center' },

  itemRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 9 },
  divider: { borderTopWidth: 1 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 9,
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  addInlineText: { fontFamily: uiFont(700), fontSize: 12 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabelPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemLabel: { flexShrink: 1, fontFamily: uiFont(600), fontSize: 14 },
  itemAmount: { fontFamily: numFont(700), fontSize: 14 },
  deleteLineBtn: { paddingLeft: 4, paddingVertical: 2 },
  emptyLinesCard: { padding: 18, alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1 },
  emptyLinesText: { fontFamily: uiFont(500), fontSize: 13 },
  addItemRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  addItemRowText: { fontFamily: uiFont(700), fontSize: 13 },
  addItemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  addItemBottomText: { fontFamily: uiFont(700), fontSize: 13 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  avatar: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOn: {},
  avatarText: { fontFamily: uiFont(700), fontSize: 12 },
  avatarTextOn: { color: colors.onAccent },
  allBtn: { paddingHorizontal: 9, paddingVertical: 7 },
  allText: { fontFamily: uiFont(600), fontSize: 12 },
  unassigned: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 9, lineHeight: 16 },

  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  pctLabel: { fontFamily: uiFont(700), fontSize: 13.5 },
  pctNote: { fontFamily: uiFont(500), fontSize: 11, marginTop: 2 },
  pctField: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 8 },
  pctInput: { width: 42, textAlign: 'right', fontFamily: numFont(700), fontSize: 14, paddingVertical: 7 },
  pctSign: { fontFamily: numFont(600), fontSize: 13 },
  pctAdd: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  pctAddText: { fontFamily: uiFont(700), fontSize: 12 },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14 },
  rm: { fontFamily: numFont(600), fontSize: 18 },
  amountInput: { flex: 1, fontFamily: numFont(700), fontSize: 24, paddingVertical: 12 },
  diffNote: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 8, lineHeight: 16 },

  summary: { padding: 14, gap: 9, marginTop: 18 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryName: { fontFamily: uiFont(600), fontSize: 13.5 },
  summaryNameSelf: { fontFamily: uiFont(700) },
  summaryValue: { fontFamily: numFont(600), fontSize: 14.5 },
  summaryValueSelf: { fontFamily: numFont(700), fontSize: 16 },
  error: { fontFamily: uiFont(600), fontSize: 12.5, color: '#b3261e', marginTop: 14, textAlign: 'center', lineHeight: 17 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  meta: { fontFamily: uiFont(500), fontSize: 12 },
  addCurrencyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCurrencyBtnText: {
    color: '#ffffff',
    fontFamily: uiFont(700),
    fontSize: 13,
  },
});
