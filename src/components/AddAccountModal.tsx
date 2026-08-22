import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { todayISO } from '../lib/duplicates';
import { classesFor } from '../lib/networth';
import type { AccountKind } from '../lib/types';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { radius, uiFont } from '../theme';
import { Icon, type IconName } from './Icon';
import { BtnLabel, PrimaryButton } from './ui';

/** Compact modal to create a new account inline (e.g. from the add-transaction flow), then select it. */
export function AddAccountModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (accountId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { addAccount } = useAppData();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('asset');
  const [cls, setCls] = useState('cash');
  const [busy, setBusy] = useState(false);

  const clsChoices = classesFor(kind);

  useEffect(() => {
    if (visible) {
      setName('');
      setKind('asset');
      setCls('cash');
    }
  }, [visible]);

  useEffect(() => {
    if (!clsChoices.find((c) => c.id === cls)) setCls(clsChoices[0]?.id ?? 'cash');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (!visible) return <Modal visible={false} transparent />;

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const id = await addAccount(name.trim(), kind, cls, 0, todayISO());
      onCreated(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.center, { pointerEvents: 'box-none' }]}>
        <View style={[styles.card, { backgroundColor: colorTheme.surface, marginBottom: insets.bottom }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colorTheme.ink }]}>New account</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={colorTheme.ink2} />
            </Pressable>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Maybank Savings"
            placeholderTextColor={colorTheme.ink3}
            style={[styles.input, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, color: colorTheme.ink }]}
            maxLength={30}
            autoFocus
          />

          <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
            {(['asset', 'liability'] as AccountKind[]).map((k) => {
              const on = kind === k;
              return (
                <Pressable key={k} onPress={() => setKind(k)} style={[styles.toggleBtn, on && { backgroundColor: colorTheme.surface }]}>
                  <Text style={[styles.toggleText, { color: colorTheme.ink2 }, on && { color: colorTheme.ink }]}>
                    {k === 'asset' ? 'I own it' : 'I owe it'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.pickLabel, { color: colorTheme.ink2 }]}>Type</Text>
          <View style={styles.choiceWrap}>
            {clsChoices.map((c) => {
              const on = c.id === cls;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCls(c.id)}
                  style={[styles.classChip, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }, on && { borderColor: theme.accent, backgroundColor: theme.accentTint }]}
                >
                  <Icon name={c.icon as IconName} size={15} color={on ? theme.accent : colorTheme.ink2} />
                  <Text style={[styles.classChipText, { color: colorTheme.ink }, on && { color: theme.onTint }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 18 }}>
            <PrimaryButton onPress={submit} disabled={!name.trim() || busy} height={50}>
              <Icon name="plus" size={18} color="#fff" stroke={2.2} />
              <BtnLabel>Create & select</BtnLabel>
            </PrimaryButton>
          </View>
        </View>
      </View>
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
    marginBottom: 14,
  },
  toggle: { flexDirection: 'row', borderRadius: 999, padding: 3, borderWidth: 1, marginBottom: 16 },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleText: { fontFamily: uiFont(600), fontSize: 13 },
  pickLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 9 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
  classChipText: { fontFamily: uiFont(600), fontSize: 12.5 },
});
