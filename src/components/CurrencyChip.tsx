// src/components/CurrencyChip.tsx
// Small currency-picker pill for transaction entry/edit rows. Mirrors AccountLinkField's
// trigger+modal picker pattern and CurrencySettingsScreen's entryChip pill tokens (radius 999,
// borderWidth 1)  this codebase's established convention for currency-selection UI.
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';
import { Icon } from './Icon';

/**
 * Renders `null` when only one currency is active, so callers can drop this in unconditionally
 * next to an amount field without their own `isMultiCurrency` guard. Opens a picker limited to
 * `active` — never the full supported-currency list, matching the entry-currency picker on the
 * Currency settings screen.
 */
export function CurrencyChip({
  value,
  active,
  onChange,
}: {
  value: string;
  active: string[];
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const theme = useAccent();
  const colorTheme = useThemeColors();

  if (active.length <= 1) return null;

  const choose = (code: string) => {
    setOpen(false);
    if (code !== value) onChange(code);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.chip, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}
        accessibilityRole="button"
        accessibilityLabel={`Currency: ${value}`}
      >
        <Text style={[styles.chipText, { color: colorTheme.ink }]}>{value}</Text>
        <Icon name="chevronDown" size={15} color={colorTheme.ink3} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.menuWrap} pointerEvents="box-none">
          <View style={[styles.menu, { backgroundColor: colorTheme.bg, borderColor: colorTheme.line2 }]}>
            <Text style={[styles.menuTitle, { color: colorTheme.ink2 }]}>Currency</Text>
            <ScrollView style={styles.menuScroll} keyboardShouldPersistTaps="handled">
              {active.map((code) => {
                const selected = code === value;
                return (
                  <Pressable
                    key={code}
                    onPress={() => choose(code)}
                    style={[styles.option, selected && { backgroundColor: theme.accentTint }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionText, { color: colorTheme.ink }, selected && { color: theme.onTint }]}>
                      {code}
                    </Text>
                    {selected && <Icon name="check" size={16} color={theme.accent} stroke={2.4} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: uiFont(700), fontSize: 14 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  menuWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 8,
    maxHeight: '70%',
  },
  menuTitle: { fontFamily: uiFont(700), fontSize: 13, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  menuScroll: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  optionText: { fontFamily: uiFont(600), fontSize: 15 },
});
