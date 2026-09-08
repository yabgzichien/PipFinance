// src/components/OverflowMenu.tsx
// One quiet "…" per row instead of a row of competing management icons.
//
// Rows that carry edit, hide and delete side by side spend their whole visual budget on actions
// the user takes once in a while, and leave the thing the row is actually about — its name, its
// colour, its total — fighting for what's left. Folding them behind one trigger also lets each
// action carry a written label, so a chevron no longer has to mean "hide".

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';
import { Icon, type IconName } from './Icon';

export interface OverflowAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Rendered in the destructive red, and always placed last by the caller. */
  destructive?: boolean;
}

export function OverflowMenu({
  actions,
  accessibilityLabel,
  title,
  size = 18,
}: {
  actions: OverflowAction[];
  /** What the trigger announces, e.g. "More actions: Petrol". */
  accessibilityLabel: string;
  /** Optional heading inside the menu, naming what the actions apply to. */
  title?: string;
  size?: number;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const colorTheme = useThemeColors();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Icon name="dots" size={size} color={colorTheme.ink2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.wrap} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 12 }]}>
            <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
            {title && <Text style={[styles.title, { color: colorTheme.ink2 }]} numberOfLines={1}>{title}</Text>}
            {actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  // Closed first so the menu is never left hanging over whatever the action
                  // opens next — a confirmation, an inline editor, another screen.
                  close();
                  action.onPress();
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: colorTheme.surface2 }]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Icon name={action.icon} size={18} color={action.destructive ? DESTRUCTIVE : colorTheme.ink2} />
                <Text style={[styles.itemLabel, { color: action.destructive ? DESTRUCTIVE : colorTheme.ink }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const DESTRUCTIVE = '#b3261e';

const styles = StyleSheet.create({
  trigger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 10, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 10 },
  title: { fontFamily: uiFont(700), fontSize: 12.5, paddingHorizontal: 12, paddingBottom: 8 },
  item: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: radius.sm },
  itemLabel: { fontFamily: uiFont(600), fontSize: 15 },
});
