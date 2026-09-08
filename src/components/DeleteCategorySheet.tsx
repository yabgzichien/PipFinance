// src/components/DeleteCategorySheet.tsx
// Deleting a category is not only a removal — everything filed under it has to go somewhere, and
// wherever it goes changes the user's own history. Picking that destination silently (as this
// flow used to) rewrites past category breakdowns without ever saying so. This sheet asks.

import React, { useLayoutEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n';
import type { Category } from '../lib/types';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';
import { Icon } from './Icon';
import { CatBadge } from './ui';

export function DeleteCategorySheet({
  category,
  candidates,
  movingCount,
  onCancel,
  onConfirm,
}: {
  /** The category being deleted, or null when the sheet is closed. */
  category: Category | null;
  /** Every other category of the same kind — the possible destinations. */
  candidates: Category[];
  /** How many transactions and recurring bills are about to be re-filed. */
  movingCount: number;
  onCancel: () => void;
  onConfirm: (replacementId: string) => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { tCat, t, isZh } = useLanguage();
  const [chosenId, setChosenId] = useState<string | null>(null);

  // Each opening starts with nothing chosen, so a destination is always a deliberate answer
  // rather than whatever the previous deletion happened to leave selected.
  useLayoutEffect(() => {
    if (category) setChosenId(null);
  }, [category]);

  if (!category) return <Modal visible={false} transparent />;

  const label = tCat(category);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.avoider} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
          <Text style={[styles.title, { color: colorTheme.ink }]}>
            {isZh ? `删除“${label}”？` : `Delete “${label}”?`}
          </Text>
          <Text style={[styles.body, { color: colorTheme.ink2 }]}>
            {isZh
              ? `该分类下的 ${movingCount} 项记录需要转移。请选择接收的分类——这会改变过往的分类统计。`
              : `${movingCount} ${movingCount === 1 ? 'entry needs' : 'entries need'} a new home. Choose where they go — this changes how your past spending is grouped.`}
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {candidates.map((candidate) => {
              const chosen = candidate.id === chosenId;
              return (
                <Pressable
                  key={candidate.id}
                  onPress={() => setChosenId(candidate.id)}
                  style={[
                    styles.row,
                    { backgroundColor: colorTheme.surface, borderColor: colorTheme.line },
                    chosen && { borderColor: theme.accent, backgroundColor: theme.accentTint },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={tCat(candidate)}
                >
                  <CatBadge category={candidate} size={34} />
                  <Text style={[styles.rowLabel, { color: colorTheme.ink }]} numberOfLines={1}>{tCat(candidate)}</Text>
                  {chosen && <Icon name="check" size={18} color={theme.accent} stroke={2.5} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.action} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Text style={[styles.actionLabel, { color: colorTheme.ink2 }]}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (chosenId) onConfirm(chosenId); }}
              disabled={!chosenId}
              style={styles.action}
              accessibilityRole="button"
              accessibilityState={{ disabled: !chosenId }}
              accessibilityLabel={isZh ? '删除分类' : 'Delete category'}
            >
              <Text style={[styles.actionLabel, { color: chosenId ? '#b3261e' : colorTheme.ink3 }]}>
                {isZh ? '删除' : 'Delete'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 18, paddingTop: 10, maxHeight: '82%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  title: { fontFamily: uiFont(700), fontSize: 18 },
  body: { fontFamily: uiFont(500), fontSize: 13.5, lineHeight: 19, marginTop: 6, marginBottom: 12 },
  list: { flexGrow: 0, flexShrink: 1 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, marginBottom: 8 },
  rowLabel: { flex: 1, fontFamily: uiFont(700), fontSize: 14.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 6 },
  action: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: uiFont(700), fontSize: 14 },
});
