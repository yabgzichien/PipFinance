// src/components/ScanProgressBar.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useReducedMotion } from '../state/useReducedMotion';
import { numFont, radius, shadowCard, uiFont } from '../theme';

export function ScanProgressBar({
  progress,
  label,
  showPercentage = true,
  accentColor,
  style,
}: {
  /** Completion percentage (0 - 100) */
  progress: number;
  /** Optional custom header label (defaults to "Scanning progress" / "识别进度") */
  label?: string;
  /** Whether to render the numerical percentage badge */
  showPercentage?: boolean;
  /** Optional custom accent color for the progress bar fill */
  accentColor?: string;
  /** Additional container styling */
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const reducedMotion = useReducedMotion();

  const target = Math.max(0, Math.min(100, progress));
  const fillAnim = useRef(new Animated.Value(target)).current;

  useEffect(() => {
    if (reducedMotion) {
      fillAnim.setValue(target);
      return;
    }
    const anim = Animated.timing(fillAnim, {
      toValue: target,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [target, reducedMotion, fillAnim]);

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, style]}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Icon name="sparkles" size={13} color={accentColor ?? theme.accent} />
          <Text style={[styles.labelText, { color: colorTheme.ink2 }]}>
            {label ?? (isZh ? '识别进度' : 'Scanning progress')}
          </Text>
        </View>
        {showPercentage && (
          <Text style={[styles.percentText, { color: accentColor ?? theme.accent }]}>
            {Math.round(target)}%
          </Text>
        )}
      </View>
      <View style={[styles.track, { backgroundColor: colorTheme.surface2 }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: accentColor ?? theme.accent,
              width: fillAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    ...shadowCard,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontFamily: uiFont(600),
    fontSize: 12.5,
  },
  percentText: {
    fontFamily: numFont(700),
    fontSize: 13.5,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
