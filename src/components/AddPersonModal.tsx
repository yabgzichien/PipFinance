import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';
import { Icon } from './Icon';
import { BtnLabel, PrimaryButton } from './ui';

/** Compact prompt for a friend's name, used wherever a bill needs someone added on the spot. */
export function AddPersonModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  /** Creates the person and folds them into the bill; the modal closes once this resolves. */
  onSubmit: (name: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const colorTheme = useThemeColors();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  if (!visible) return <Modal visible={false} transparent />;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.center, { pointerEvents: 'box-none' }]}
      >
        <View style={[styles.card, { backgroundColor: colorTheme.surface, marginBottom: insets.bottom }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colorTheme.ink }]}>Add a name</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={colorTheme.ink2} />
            </Pressable>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Friend's name"
            placeholderTextColor={colorTheme.ink3}
            style={[styles.input, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, color: colorTheme.ink }]}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <View style={{ marginTop: 16 }}>
            <PrimaryButton onPress={submit} disabled={!name.trim() || busy} height={50}>
              <Icon name="plus" size={18} color="#fff" stroke={2.2} />
              <BtnLabel>Add</BtnLabel>
            </PrimaryButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  center: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  card: { borderRadius: radius.lg, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: uiFont(700), fontSize: 17 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: uiFont(600),
    fontSize: 15,
  },
});
