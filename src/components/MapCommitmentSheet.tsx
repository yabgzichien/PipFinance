// src/components/MapCommitmentSheet.tsx
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Caption } from './ui';
import type { Commitment } from '../lib/commitments';
import type { ReliefSchedule } from '../lib/reliefSchedule';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';

export function MapCommitmentSheet({
  visible,
  commitments,
  schedule,
  onPick,
  onClose,
}: {
  visible: boolean;
  commitments: Commitment[];
  schedule: ReliefSchedule;
  onPick: (commitmentId: string, code: string | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const eligibleLines = schedule.lines.filter((l) => l.commitmentEligible);

  if (!visible) return <Modal visible={false} transparent />;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <Text style={[styles.title, { color: colorTheme.ink }]}>Map a commitment</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {commitments.length === 0 && (
            <Caption color={colorTheme.ink2}>No recurring bills yet. Add one from Settings first.</Caption>
          )}
          {commitments.map((c) => (
            <View key={c.id} style={[styles.commitmentBlock, { borderColor: colorTheme.line2 }]}>
              <Text style={{ color: colorTheme.ink, fontFamily: uiFont(700), fontSize: 14 }}>{c.label}</Text>
              <View style={styles.lineList}>
                <Pressable
                  onPress={() => onPick(c.id, null)}
                  style={[styles.lineOption, { borderColor: colorTheme.line2 }, !c.reliefCode && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}
                >
                  <Text style={{ color: colorTheme.ink2, fontFamily: uiFont(600), fontSize: 12.5 }}>Not relief-eligible</Text>
                </Pressable>
                {eligibleLines.map((l) => (
                  <Pressable
                    key={l.code}
                    onPress={() => onPick(c.id, l.code)}
                    style={[styles.lineOption, { borderColor: colorTheme.line2 }, c.reliefCode === l.code && { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}
                  >
                    <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 12.5 }}>{l.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={styles.closeRow} hitSlop={8}>
          <Icon name="check" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontFamily: uiFont(700), fontSize: 14 }}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: uiFont(700), fontSize: 17, marginBottom: 14 },
  commitmentBlock: { borderTopWidth: 1, paddingVertical: 12 },
  lineList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  lineOption: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1 },
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 14 },
});
