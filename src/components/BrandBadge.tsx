// src/components/BrandBadge.tsx
import React from 'react';
import { StyleSheet, View, Text, StyleProp, ViewStyle } from 'react-native';
import { BrandKey, BrandLogo } from './BrandLogo';
import { Icon } from './Icon';
import { useThemeColors } from '../state/colorScheme';
import { uiFont } from '../theme';

export function BrandBadge({
  brand,
  size = 38,
  rad = 11,
  fallbackIcon = 'receipt',
  fallbackLabel,
  style,
}: {
  brand?: BrandKey | null;
  size?: number;
  rad?: number;
  fallbackIcon?: React.ComponentProps<typeof Icon>['name'];
  fallbackLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colorTheme = useThemeColors();
  const innerSize = Math.round(size * 0.72);

  const initial = (fallbackLabel || '').trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: rad,
          backgroundColor: colorTheme.surface,
          borderColor: colorTheme.line2,
        },
        style,
      ]}
    >
      {brand ? (
        <BrandLogo brand={brand} size={innerSize} />
      ) : initial ? (
        <Text style={[styles.monogram, { fontSize: Math.round(size * 0.42), color: colorTheme.ink }]}>
          {initial}
        </Text>
      ) : (
        <Icon name={fallbackIcon} size={Math.round(size * 0.48)} color={colorTheme.ink2} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    flexShrink: 0,
  },
  monogram: {
    fontFamily: uiFont(700),
  },
});

