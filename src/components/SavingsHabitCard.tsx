import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SavingsHabit } from '../lib/savingsHabit';
import { fmt } from '../lib/format';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { colors, numFont, radius, uiFont } from '../theme';
import { Card, Eyebrow, ProgressTrack } from './ui';
import { InfoButton } from './InfoButton';

/**
 * The pay-yourself-first habit: a small fixed amount kept back the moment income lands.
 *
 * Motivation only, exactly like the recording streak — a target the user sets for themselves,
 * with no consequence for missing it.
 */
export function SavingsHabitCard({
  habit,
  onSetTarget,
}: {
  habit: SavingsHabit;
  onSetTarget: (amount: number) => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(habit.target));

  const save = () => {
    const parsed = Math.max(0, parseFloat(draft.replace(/[^0-9.]/g, '')) || 0);
    onSetTarget(parsed);
    setEditing(false);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Eyebrow>Pay yourself first</Eyebrow>
            <InfoButton entry="pay_yourself_first" />
          </View>
          <Text style={[styles.target, { color: colorTheme.ink }]}>RM {fmt(habit.target)} a month</Text>
        </View>
        {habit.monthsKept > 0 && (
          <View style={styles.streak}>
            <Text style={styles.flame}>{'\u{1F525}'}</Text>
            <Text style={[styles.streakText, { color: theme.accentInk }]}>
              {habit.monthsKept} month{habit.monthsKept === 1 ? '' : 's'}
            </Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 12 }}>
        <ProgressTrack pct={habit.thisMonthProgress * 100} />
        <Text style={[styles.progress, { color: colorTheme.ink2 }]}>
          {habit.thisMonthSaved >= 0
            ? `RM ${fmt(habit.thisMonthSaved)} kept back this month`
            : `RM ${fmt(-habit.thisMonthSaved)} more spent than earned this month`}
          {habit.thisMonthMet ? '. Target met.' : ''}
        </Text>
      </View>

      {habit.monthsKept === 0 && habit.bestRun > 0 && (
        <Text style={[styles.best, { color: colorTheme.ink2 }]}>
          Your best run so far is {habit.bestRun} month{habit.bestRun === 1 ? '' : 's'}.
        </Text>
      )}

      {editing ? (
        <View style={styles.editRow}>
          <Text style={[styles.rm, { color: colorTheme.ink2 }]}>RM</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            style={[styles.input, { color: colorTheme.ink, backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}
            autoFocus
            accessibilityLabel="Monthly savings target"
          />
          <Pressable onPress={save} style={[styles.saveBtn, { backgroundColor: theme.accent }]} accessibilityRole="button">
            <Text style={[styles.saveText, { color: theme.accentInk }]}>Save</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setDraft(String(habit.target));
            setEditing(true);
          }}
          style={({ pressed }) => [styles.changeBtn, { borderColor: colorTheme.line, backgroundColor: colorTheme.surface2, opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.changeText, { color: colorTheme.ink2 }]}>Change target</Text>
        </Pressable>
      )}

      <Text style={[styles.note, { color: colorTheme.ink3 }]}>
        A personal habit tracker only. Missing a month costs you nothing.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  target: { fontFamily: uiFont(700), fontSize: 16, marginTop: 3 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flame: { fontSize: 15 },
  streakText: { fontFamily: uiFont(700), fontSize: 13 },
  progress: { fontFamily: uiFont(500), fontSize: 12.5, marginTop: 7 },
  best: { fontFamily: uiFont(500), fontSize: 12, marginTop: 6 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  rm: { fontFamily: numFont(600), fontSize: 14 },
  input: {
    flex: 1,
    fontFamily: numFont(700),
    fontSize: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  saveText: { fontFamily: uiFont(700), fontSize: 13 },
  changeBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  changeText: { fontFamily: uiFont(700), fontSize: 12.5 },
  note: { fontFamily: uiFont(500), fontSize: 11, lineHeight: 15, marginTop: 12 },
});
