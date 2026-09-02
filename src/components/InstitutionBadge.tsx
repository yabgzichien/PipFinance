// src/components/InstitutionBadge.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Institution } from '../lib/institutions';
import { uiFont } from '../theme';
import { useThemeColors } from '../state/colorScheme';
import { BrandLogo, matchBrand } from './BrandLogo';

/**
 * An authentic brand vector badge for recognized banks/e-wallets,
 * falling back to a brand-toned monogram or neutral "?" tile when unrecognized.
 */
export function InstitutionBadge({
  inst,
  fallbackText,
  size = 36,
}: {
  inst: Institution | null;
  fallbackText?: string | null;
  size?: number;
}) {
  const colorTheme = useThemeColors();
  const brand = inst
    ? matchBrand(inst.id) || matchBrand(inst.name)
    : (fallbackText ? matchBrand(fallbackText) : null);

  if (brand) {
    return (
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size * 0.32,
            backgroundColor: colorTheme.surface,
            borderColor: colorTheme.line2,
            borderWidth: 1,
            overflow: 'hidden',
          },
        ]}
      >
        <BrandLogo brand={brand} size={Math.round(size * 0.78)} />
      </View>
    );
  }

  const text = inst?.monogram ?? (fallbackText ? fallbackText.trim().slice(0, 3).toUpperCase() : '?');
  const bg = inst?.color ?? colorTheme.ink3;
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize: Math.max(8, size * 0.26) }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, flexShrink: 0 },
  text: { fontFamily: uiFont(800), color: '#fff' },
});
