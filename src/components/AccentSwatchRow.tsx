import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type AccentPreset } from '../state/accentPresets';
import {
  ACCENT_SWATCH_GAP,
  accentSwatchJustifyContent,
  accentSwatchSize,
  MAX_ACCENT_SWATCH_SIZE,
} from '../lib/accentSwatches';
import { Icon } from './Icon';

/** A measured, one-row accent selector shared by Settings and onboarding. */
export function AccentSwatchRow({
  presets,
  presetId,
  onSelect,
  selectedBorderColor,
}: {
  presets: AccentPreset[];
  presetId: string;
  onSelect: (id: string) => void;
  selectedBorderColor: string;
}) {
  const [rowWidth, setRowWidth] = useState(0);
  const size = rowWidth > 0 ? accentSwatchSize(rowWidth, presets.length) : MAX_ACCENT_SWATCH_SIZE;

  return (
    <View
      style={[styles.row, { justifyContent: accentSwatchJustifyContent(rowWidth, presets.length) }]}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setRowWidth((current) => (current === width ? current : width));
      }}
    >
      {presets.map((preset) => {
        const selected = preset.id === presetId;
        return (
          <Pressable
            key={preset.id}
            onPress={() => onSelect(preset.id)}
            hitSlop={7}
            style={[
              styles.swatch,
              {
                width: size,
                height: size,
                backgroundColor: preset.theme.light.accent,
                borderColor: selected ? selectedBorderColor : 'transparent',
              },
            ]}
            accessibilityRole="radio"
            accessibilityLabel={preset.name}
            accessibilityState={{ selected }}
          >
            {selected && <Icon name="check" size={15} color="#fff" stroke={2.6} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: ACCENT_SWATCH_GAP },
  swatch: { borderRadius: 999, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});
