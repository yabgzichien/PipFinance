// src/screens/TaxScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ReliefTagEditSheet } from '../components/ReliefTagEditSheet';
import { Body, Caption, Card, Eyebrow, ProgressTrack, TopBar } from '../components/ui';
import { computeUsage, type ReliefUsage } from '../lib/relief';
import { RELIEF_SCHEDULES, scheduleForYA, type ReliefLine } from '../lib/reliefSchedule';
import { listReliefTags } from '../db/reliefRepo';
import type { ReliefTag } from '../lib/types';
import { fmt } from '../lib/format';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { colors, uiFont } from '../theme';

const AVAILABLE_YAS = Object.keys(RELIEF_SCHEDULES).map(Number).sort((a, b) => b - a);

export function TaxScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { transactions } = useAppData();
  const [ya, setYa] = useState(AVAILABLE_YAS[0]);
  const [tags, setTags] = useState<ReliefTag[] | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTags(null);
    listReliefTags(ya).then((t) => {
      if (!cancelled) setTags(t);
    });
    return () => {
      cancelled = true;
    };
  }, [ya]);

  const schedule = scheduleForYA(ya);
  const usage: ReliefUsage[] = useMemo(
    () => (schedule && tags ? computeUsage(tags, schedule) : []),
    [schedule, tags]
  );
  const usageByCode = useMemo(() => Object.fromEntries(usage.map((u) => [u.code, u])), [usage]);
  const totalClaimed = usage.filter((u) => !schedule?.lines.find((l) => l.code === u.code)?.parent)
    .reduce((s, u) => s + u.claimed, 0);

  const editingTag = editingTagId ? (tags ?? []).find((t) => t.id === editingTagId) ?? null : null;

  const topLevelLines = schedule?.lines.filter((l) => !l.parent) ?? [];
  const childrenByParent = useMemo(() => {
    const map: Record<string, ReliefLine[]> = {};
    for (const line of schedule?.lines ?? []) {
      if (line.parent) (map[line.parent] ??= []).push(line);
    }
    return map;
  }, [schedule]);

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg, paddingTop: insets.top }]}>
      <TopBar title="Tax relief" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.yaRow}>
          {AVAILABLE_YAS.map((y) => (
            <Pressable
              key={y}
              onPress={() => setYa(y)}
              style={[
                styles.yaChip,
                { borderColor: colorTheme.line2 },
                y === ya && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
            >
              <Text style={[styles.yaChipText, { color: y === ya ? colors.onAccent : colorTheme.ink }]}>YA {y}</Text>
            </Pressable>
          ))}
        </View>

        <Caption color={colorTheme.ink2} style={{ marginTop: 10 }}>
          RM {fmt(totalClaimed)} claimed so far for YA {ya}
        </Caption>

        {tags === null && (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}

        {tags !== null && tags.length === 0 && (
          <View style={{ paddingTop: 50, alignItems: 'center', paddingHorizontal: 20 }}>
            <Body weight={700} color={colorTheme.ink} style={{ textAlign: 'center' }}>
              Nothing tagged yet
            </Body>
            <Caption color={colorTheme.ink2} style={{ textAlign: 'center', marginTop: 6 }}>
              Scan a receipt or map a bill to get started. Pip tags relief-eligible spending
              automatically as you go.
            </Caption>
          </View>
        )}

        {tags !== null && topLevelLines.map((line) => {
          const u = usageByCode[line.code];
          if (!u) return null;
          const children = childrenByParent[line.code] ?? [];
          const pct = u.cap > 0 ? Math.min(100, (u.capUsed / u.cap) * 100) : 0;
          return (
            <Card key={line.code} style={{ padding: 16, marginTop: 12 }}>
              <View style={styles.lineHead}>
                <Body weight={700} color={colorTheme.ink}>{line.label}</Body>
                <Caption color={colorTheme.ink2}>{line.formField}</Caption>
              </View>
              <Caption color={colorTheme.ink2} style={{ marginTop: 2 }}>
                RM {fmt(u.capUsed)} / RM {fmt(u.cap)}
              </Caption>
              <ProgressTrack pct={pct} />
              {children.length === 0 &&
                (tags ?? []).filter((t) => t.code === line.code).map((t) => {
                  const txn = transactions.find((x) => x.id === t.txnId);
                  if (!txn) return null;
                  return (
                    <Pressable key={t.id} onPress={() => setEditingTagId(t.id)} style={styles.tagRow}>
                      <Caption color={colorTheme.ink}>{txn.merchantRaw || 'Transaction'}</Caption>
                      <Caption color={colorTheme.ink2}>RM {fmt(t.amount)}</Caption>
                    </Pressable>
                  );
                })}
              {children.map((child) => {
                const cu = usageByCode[child.code];
                if (!cu) return null;
                const childTags = (tags ?? []).filter((t) => t.code === child.code);
                return (
                  <View key={child.code} style={styles.childBlock}>
                    <View style={styles.childRow}>
                      <Caption color={colorTheme.ink2}>{child.label}</Caption>
                      <Caption color={colorTheme.ink2}>RM {fmt(cu.capUsed)} / RM {fmt(cu.cap)}</Caption>
                    </View>
                    {childTags.map((t) => {
                      const txn = transactions.find((x) => x.id === t.txnId);
                      if (!txn) return null;
                      return (
                        <Pressable key={t.id} onPress={() => setEditingTagId(t.id)} style={styles.tagRow}>
                          <Caption color={colorTheme.ink}>{txn.merchantRaw || 'Transaction'}</Caption>
                          <Caption color={colorTheme.ink2}>RM {fmt(t.amount)}</Caption>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </Card>
          );
        })}
      </ScrollView>

      {schedule && (
        <ReliefTagEditSheet
          tag={editingTag}
          txn={editingTag ? transactions.find((t) => t.id === editingTag.txnId) ?? null : null}
          schedule={schedule}
          onClose={() => setEditingTagId(null)}
          onChanged={() => listReliefTags(ya).then(setTags)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  yaRow: { flexDirection: 'row', gap: 8 },
  yaChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  yaChipText: { fontFamily: uiFont(700), fontSize: 13 },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginTop: 8 },
  childBlock: { marginTop: 8 },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, paddingVertical: 4 },
});
