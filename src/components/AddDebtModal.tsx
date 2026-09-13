// src/components/AddDebtModal.tsx
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { BtnLabel, PrimaryButton } from './ui';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { tap } from '../lib/haptics';
import { numFont, radius, uiFont } from '../theme';

export function AddDebtModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const { people, addDirectDebt } = useAppData();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const suggestedPeople = useMemo(() => {
    return people.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const handleSave = async () => {
    const trimmed = name.trim();
    const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    if (!trimmed || !Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    try {
      tap();
      await addDirectDebt(trimmed, Math.round(amount * 100) / 100, note.trim() || null);
      setName('');
      setAmountText('');
      setNote('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.avoider}
        pointerEvents="box-none"
      >
        <View style={[styles.card, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
          <View style={styles.head}>
            <Text style={[styles.title, { color: colorTheme.ink }]}>
              {isZh ? '添加借款 / 谁欠你钱' : 'Add someone who owes you'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={colorTheme.ink2} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: colorTheme.ink2 }]}>
              {isZh ? '姓名' : 'Name'}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={isZh ? '朋友姓名 (例如: Fong Yan Yan)' : 'Friend’s name (e.g. Fong Yan Yan)'}
              placeholderTextColor={colorTheme.ink3}
              style={[styles.input, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
            />

            {suggestedPeople.length > 0 && !name && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {suggestedPeople.slice(0, 6).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setName(p.name)}
                      style={[styles.chip, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}
                    >
                      <Text style={[styles.chipText, { color: colorTheme.ink2 }]}>{p.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            <Text style={[styles.label, { color: colorTheme.ink2, marginTop: 14 }]}>
              {isZh ? '欠款金额' : 'Amount owed'}
            </Text>
            <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Text style={[styles.rm, { color: colorTheme.ink2 }]}>RM</Text>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colorTheme.ink3}
                style={[styles.amountInput, { color: colorTheme.ink }]}
              />
            </View>

            <Text style={[styles.label, { color: colorTheme.ink2, marginTop: 14 }]}>
              {isZh ? '原因 / 备注 (选填)' : 'Reason / note (optional)'}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={isZh ? '例如: 午餐分摊、借款' : 'e.g. Lunch, personal loan'}
              placeholderTextColor={colorTheme.ink3}
              style={[styles.input, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
            />

            <View style={{ marginTop: 22 }}>
              <PrimaryButton
                onPress={handleSave}
                disabled={busy || !name.trim() || !parseFloat(amountText)}
                height={50}
              >
                <Icon name="check" size={18} color="#fff" stroke={2.4} />
                <BtnLabel>{isZh ? '添加' : 'Add to Owed'}</BtnLabel>
              </PrimaryButton>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 18, paddingTop: 10, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { flex: 1, fontFamily: uiFont(700), fontSize: 18, marginRight: 12 },
  label: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 11, fontFamily: uiFont(500), fontSize: 15 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14 },
  rm: { fontFamily: numFont(600), fontSize: 18 },
  amountInput: { flex: 1, minWidth: 0, fontFamily: numFont(700), fontSize: 22, paddingVertical: 10 },
  chip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: uiFont(600), fontSize: 12 },
});
