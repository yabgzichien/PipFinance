// src/screens/TaxScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { MapCommitmentSheet } from '../components/MapCommitmentSheet';
import { ReliefTagEditSheet } from '../components/ReliefTagEditSheet';
import { Body, Caption, Card, Eyebrow, ProgressTrack, TopBar } from '../components/ui';
import { computeUsage, evidenceState, isRequestable, type ReliefUsage } from '../lib/relief';
import { RELIEF_SCHEDULES, scheduleForYA, type ReliefLine } from '../lib/reliefSchedule';
import { addReliefTag, listReliefTags } from '../db/reliefRepo';
import { saveOrDownloadExport } from '../lib/financialExport';
import { notify } from '../lib/platformAlert';
import { buildAuditPackPdf } from '../lib/taxExport';
import type { ReliefTag, Transaction } from '../lib/types';
import { fmt } from '../lib/format';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { colors, radius, uiFont } from '../theme';

const AVAILABLE_YAS = Object.keys(RELIEF_SCHEDULES).map(Number).sort((a, b) => b - a);

function daysUntilMonthEnd(txnDate: string): number {
  const [y, m] = txnDate.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const today = new Date();
  return Math.max(0, lastDay - today.getDate());
}

export function TaxScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { transactions, commitments, updateCommitmentEntry } = useAppData();
  const [ya, setYa] = useState(AVAILABLE_YAS[0]);
  const [tags, setTags] = useState<ReliefTag[] | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [mappingCommitments, setMappingCommitments] = useState(false);
  const [addingManually, setAddingManually] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [exporting, setExporting] = useState(false);

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

  const requestable = useMemo(() => {
    if (!schedule || !tags) return [];
    const today = new Date();
    const result: { tag: ReliefTag; txn: Transaction; line: ReliefLine }[] = [];
    for (const t of tags) {
      const line = schedule.lines.find((l) => l.code === t.code);
      const txn = transactions.find((x) => x.id === t.txnId);
      if (!line || !txn) continue;
      const evidence = evidenceState(t, txn, line);
      if (isRequestable(evidence, txn, today)) result.push({ tag: t, txn, line });
    }
    return result;
  }, [schedule, tags, transactions]);

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

        {requestable.length > 0 && (
          <View style={{ marginTop: tags && tags.length > 0 ? 16 : 0 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Requestable this month</Eyebrow>
            {requestable.map(({ tag, txn, line }) => {
              const daysLeft = daysUntilMonthEnd(txn.date!);
              return (
                <Pressable key={tag.id} onPress={() => setEditingTagId(tag.id)} style={[styles.requestableRow, { borderColor: colorTheme.line2 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13.5 }} numberOfLines={1}>
                      {txn.merchantRaw || line.label}
                    </Text>
                    <Caption color={colorTheme.ink2}>{line.label}</Caption>
                  </View>
                  <Caption color={theme.accent}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</Caption>
                </Pressable>
              );
            })}
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

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => setMappingCommitments(true)} style={[styles.actionRow, { borderColor: colorTheme.line2, marginTop: 0 }]}>
            <Icon name="clock" size={16} color={theme.accent} />
            <Text style={{ color: theme.accent, fontFamily: uiFont(700), fontSize: 13.5 }}>Map a commitment</Text>
          </Pressable>
          <Pressable onPress={() => setAddingManually(true)} style={[styles.actionRow, { borderColor: colorTheme.line2, marginTop: 0 }]}>
            <Icon name="search" size={16} color={theme.accent} />
            <Text style={{ color: theme.accent, fontFamily: uiFont(700), fontSize: 13.5 }}>Add manually</Text>
          </Pressable>
        </View>

        {addingManually && (
          <Card style={{ padding: 14, marginTop: 14 }}>
            <View style={[styles.searchRow, { borderColor: colorTheme.line2 }]}>
              <Icon name="search" size={15} color={colorTheme.ink3} />
              <TextInput
                value={manualSearch}
                onChangeText={setManualSearch}
                placeholder="Search transactions"
                placeholderTextColor={colorTheme.ink3}
                style={[styles.searchInput, { color: colorTheme.ink }]}
              />
              <Pressable onPress={() => setAddingManually(false)} hitSlop={8}>
                <Icon name="x" size={16} color={colorTheme.ink3} />
              </Pressable>
            </View>
            {manualSearch.trim().length > 0 &&
              transactions
                .filter((t) => t.merchantRaw.toLowerCase().includes(manualSearch.trim().toLowerCase()))
                .slice(0, 15)
                .map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={async () => {
                      if (!schedule) return;
                      const created = await addReliefTag({ txnId: t.id, code: schedule.lines[0].code, ya, amount: t.amount, origin: 'manual' });
                      setTags((prev) => [...(prev ?? []), created]);
                      setEditingTagId(created.id);
                      setAddingManually(false);
                      setManualSearch('');
                    }}
                    style={styles.manualRow}
                  >
                    <Text style={{ color: colorTheme.ink, fontFamily: uiFont(600), fontSize: 13.5 }} numberOfLines={1}>
                      {t.merchantRaw}
                    </Text>
                    <Caption color={colorTheme.ink2}>RM {fmt(t.amount)}</Caption>
                  </Pressable>
                ))}
          </Card>
        )}

        <Pressable
          disabled={exporting || !schedule || !tags || tags.length === 0}
          onPress={async () => {
            if (!schedule || !tags) return;
            setExporting(true);
            try {
              const bytes = await buildAuditPackPdf(ya, schedule, tags, transactions);
              const result = await saveOrDownloadExport(`tax-relief-audit-pack-${ya}.pdf`, bytes, 'application/pdf');
              if (!result.success) notify('Export failed', result.error ?? 'Could not build the audit pack.');
            } finally {
              setExporting(false);
            }
          }}
          style={[styles.exportButton, { backgroundColor: theme.accent, opacity: exporting || !tags?.length ? 0.5 : 1 }]}
        >
          <Icon name="download" size={16} color={colors.onAccent} />
          <Text style={{ color: colors.onAccent, fontFamily: uiFont(700), fontSize: 14 }}>
            {exporting ? 'Building...' : 'Export audit pack'}
          </Text>
        </Pressable>
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

      {schedule && (
        <MapCommitmentSheet
          visible={mappingCommitments}
          commitments={commitments}
          schedule={schedule}
          onPick={(id, code) => updateCommitmentEntry(id, { reliefCode: code })}
          onClose={() => setMappingCommitments(false)}
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
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14, alignSelf: 'flex-start' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontFamily: uiFont(600), fontSize: 13.5, paddingVertical: 2 },
  manualRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'transparent' },
  requestableRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, padding: 12, marginTop: 8, gap: 10 },
  exportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 14, marginTop: 22 },
});
