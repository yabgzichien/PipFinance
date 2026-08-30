// src/components/TaskListSheet.tsx
// Bottom sheet opened by tapping the Home mascot: the "things to explore" checklist. Follows
// OwedScreen's settle-up sheet conventions (backdrop, handle, sheetHead) for a consistent feel.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Pip } from './Pip';
import { Caption, Label, Title } from './ui';
import { EXPLORE_TASKS, computeExploreTaskStatus, type ExploreTask } from '../lib/tasks';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useLanguage } from '../i18n';
import { radius, spacing } from '../theme';

export function TaskListSheet({
  visible,
  tasksDone,
  onClose,
  onGuide,
}: {
  visible: boolean;
  tasksDone: readonly string[];
  onClose: () => void;
  onGuide: (task: ExploreTask) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t } = useLanguage();

  if (!visible) return <Modal visible={false} transparent />;

  const status = computeExploreTaskStatus(tasksDone);
  const done = new Set(tasksDone);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + spacing.base }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <View style={styles.sheetHead}>
          <Pip size={40} expr={status.allDone ? 'proud' : 'curious'} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Title>{status.allDone ? t('exploreTasksAllDoneTitle') : t('exploreTasksSheetTitle')}</Title>
            <Caption color={colorTheme.ink2} style={{ marginTop: spacing.xs }}>
              {status.allDone
                ? t('exploreTasksAllDoneSub')
                : t('exploreTasksSheetSub', { count: status.completedCount, total: status.totalCount, completed: status.completedCount })}
            </Caption>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t('close')}>
            <Icon name="x" size={20} color={colorTheme.ink2} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <View style={[styles.list, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }]}>
            {EXPLORE_TASKS.map((task, i) => {
              const isDone = done.has(task.id);
              const row = (
                <View
                  style={[styles.row, i > 0 && [styles.divider, { borderTopColor: colorTheme.line2 }]]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: isDone ? theme.accentTint : colorTheme.surface2 },
                    ]}
                  >
                    <Icon name={isDone ? 'check' : task.icon} size={18} color={isDone ? theme.accent : colorTheme.ink2} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Label
                      weight={700}
                      color={isDone ? colorTheme.ink2 : colorTheme.ink}
                      style={isDone ? styles.rowTitleDone : undefined}
                    >
                      {t(task.titleKey)}
                    </Label>
                    <Caption color={colorTheme.ink2} numberOfLines={2} style={{ marginTop: spacing.xs }}>
                      {t(task.descriptionKey)}
                    </Caption>
                  </View>
                  {!isDone && <Icon name="chevronRight" size={18} color={colorTheme.ink3} />}
                </View>
              );
              if (isDone) {
                return (
                  <Pressable key={task.id} onPress={onClose} accessibilityRole="button">
                    {row}
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={task.id}
                  onPress={() => {
                    onClose();
                    onGuide(task);
                  }}
                  accessibilityRole="button"
                >
                  {row}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, marginBottom: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.base },
  list: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitleDone: { textDecorationLine: 'line-through' },
});
