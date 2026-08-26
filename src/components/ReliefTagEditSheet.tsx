// src/components/ReliefTagEditSheet.tsx
import React, { useEffect, useState } from 'react';
import { Image as RNImage, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { BtnLabel, Caption, PrimaryButton } from './ui';
import { deleteReliefTag, updateReliefTag, upsertReliefMemory } from '../db/reliefRepo';
import { evidenceState } from '../lib/relief';
import type { ReliefSchedule } from '../lib/reliefSchedule';
import type { ReliefTag, Transaction } from '../lib/types';
import { confirmAction, notify } from '../lib/platformAlert';
import { saveReceiptImage } from '../lib/receiptStorage';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';

const EVIDENCE_LABEL: Record<string, string> = {
  complete: 'Complete',
  'missing-cert': 'Needs certification',
  'no-image': 'No photo',
  'weak-unnamed': 'Weak: no name',
};

export function ReliefTagEditSheet({
  tag,
  txn,
  schedule,
  onClose,
  onChanged,
}: {
  tag: ReliefTag | null;
  txn: Transaction | null;
  schedule: ReliefSchedule;
  onClose: () => void;
  onChanged: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [code, setCode] = useState('');
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tag) {
      setCode(tag.code);
      setAmountText(tag.amount.toFixed(2));
    }
  }, [tag?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tag || !txn) return <Modal visible={false} transparent />;

  const line = schedule.lines.find((l) => l.code === code) ?? schedule.lines.find((l) => l.code === tag.code)!;
  const evidence = evidenceState(tag, txn, line);

  const save = async () => {
    const n = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    const amount = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : tag.amount;
    await updateReliefTag(tag.id, { code, amount });
    if (tag.origin === 'auto' && txn.merchantKey) {
      await upsertReliefMemory(txn.merchantKey, code);
    }
    onChanged();
    onClose();
  };

  const attachPhoto = async (field: 'certImageUri' | 'einvoiceImageUri') => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', 'Allow photo access to attach this.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      try {
        const uri = saveReceiptImage(asset.uri, asset.mimeType ?? 'image/jpeg');
        await updateReliefTag(tag.id, { [field]: uri });
        onChanged();
      } catch {
        // A failed copy just means no attached photo, not a lost tag: say so and leave the
        // tag exactly as it was.
        notify('Could not attach', 'That photo could not be saved. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    confirmAction('Remove this tag?', 'This only removes the relief tag, not the transaction itself.', 'Remove', async () => {
      await deleteReliefTag(tag.id);
      onChanged();
      onClose();
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}
      >
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: colorTheme.ink }]} numberOfLines={1}>
            {txn.merchantRaw || line.label}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="x" size={20} color={colorTheme.ink2} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Caption color={colorTheme.ink2}>Relief line</Caption>
          <View style={styles.lineList}>
            {schedule.lines.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => setCode(l.code)}
                style={[
                  styles.lineOption,
                  { borderColor: colorTheme.line2 },
                  l.code === code && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft },
                ]}
              >
                <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13.5 }}>{l.label}</Text>
              </Pressable>
            ))}
          </View>

          <Caption color={colorTheme.ink2} style={{ marginTop: 16 }}>Claimed amount (RM)</Caption>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            style={[styles.input, { color: colorTheme.ink, borderColor: colorTheme.line2 }]}
          />

          <View style={[styles.evidenceRow, { borderColor: colorTheme.line2 }]}>
            <Icon name={evidence === 'complete' ? 'check' : 'alert'} size={16} color={evidence === 'complete' ? theme.accent : colorTheme.ink2} />
            <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13 }}>{EVIDENCE_LABEL[evidence]}</Text>
          </View>

          {line.requiresCert && (
            <Pressable disabled={busy} onPress={() => attachPhoto('certImageUri')} style={[styles.attachRow, { borderColor: colorTheme.line2 }]}>
              <Icon name="upload" size={16} color={colorTheme.ink2} />
              <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13 }}>
                {tag.certImageUri ? 'Replace certification photo' : 'Attach certification photo'}
              </Text>
            </Pressable>
          )}
          {tag.certImageUri && <RNImage source={{ uri: tag.certImageUri }} style={styles.thumb} />}

          <Pressable disabled={busy} onPress={() => attachPhoto('einvoiceImageUri')} style={[styles.attachRow, { borderColor: colorTheme.line2 }]}>
            <Icon name="upload" size={16} color={colorTheme.ink2} />
            <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13 }}>
              {tag.einvoiceImageUri ? 'Replace e-Invoice photo' : 'Attach e-Invoice photo'}
            </Text>
          </Pressable>
          {tag.einvoiceImageUri && <RNImage source={{ uri: tag.einvoiceImageUri }} style={styles.thumb} />}

          <Pressable onPress={remove} style={{ marginTop: 18, alignSelf: 'center' }} hitSlop={8}>
            <Text style={{ color: '#b3261e', fontFamily: uiFont(600), fontSize: 13 }}>Remove tag</Text>
          </Pressable>
        </ScrollView>

        <View style={{ marginTop: 14 }}>
          <PrimaryButton onPress={save}>
            <BtnLabel>Save</BtnLabel>
          </PrimaryButton>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: uiFont(700), fontSize: 17, flex: 1, marginRight: 10 },
  lineList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  lineOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 11, fontFamily: uiFont(600), fontSize: 15, marginTop: 6 },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, borderWidth: 1, borderRadius: radius.sm, padding: 12 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderWidth: 1, borderRadius: radius.sm, padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, marginTop: 8 },
});
