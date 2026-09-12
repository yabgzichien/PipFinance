// src/components/ScanProgressBar.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon } from './Icon';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useReducedMotion } from '../state/useReducedMotion';
import { monoNumProps, numFont, radius, shadowCard, uiFont } from '../theme';

export function ScanProgressBar({
  progress,
  label,
  showPercentage = true,
  accentColor,
  isComplete,
  completionLabel,
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
  /** Whether the process has completed (triggers peak-end surge to 100% and checkmark state) */
  isComplete?: boolean;
  /** Optional custom label when complete (e.g. "Complete" / "已完成") */
  completionLabel?: string;
  /** Additional container styling */
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const reducedMotion = useReducedMotion();

  const target = Math.max(0, Math.min(100, progress));
  const isFinished = Boolean(isComplete || target >= 100);
  const effectiveTarget = isFinished ? 100 : target;

  const fillAnim = useRef(new Animated.Value(effectiveTarget)).current;
  const [displayPct, setDisplayPct] = useState(Math.round(effectiveTarget));
  const [trackWidth, setTrackWidth] = useState(260);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Smooth numerical count-up matching the fill animation curve
  useEffect(() => {
    const id = fillAnim.addListener(({ value }) => {
      setDisplayPct(Math.round(value));
    });
    return () => {
      fillAnim.removeListener(id);
    };
  }, [fillAnim]);

  // Main progress bar fill animation (snappy finish surge if completed)
  useEffect(() => {
    if (reducedMotion) {
      fillAnim.setValue(effectiveTarget);
      setDisplayPct(Math.round(effectiveTarget));
      return;
    }
    const duration = isFinished ? 280 : 400;
    const easing = isFinished ? Easing.out(Easing.cubic) : Easing.out(Easing.ease);
    const anim = Animated.timing(fillAnim, {
      toValue: effectiveTarget,
      duration,
      easing,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [effectiveTarget, isFinished, reducedMotion, fillAnim]);

  // Shimmer loop (Harrison CHI 2010 visual augmentation for perceived duration reduction)
  useEffect(() => {
    if (reducedMotion || isFinished) {
      shimmerAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, isFinished, shimmerAnim]);

  // Subtle breathing pulse on the status icon to reinforce the Labor Illusion
  useEffect(() => {
    if (reducedMotion || isFinished) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, isFinished, pulseAnim]);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-trackWidth * 0.4, trackWidth * 1.2],
  });

  const headerLabel = isFinished
    ? (completionLabel ?? (label ? `${label} (${isZh ? '完成' : 'Done'})` : (isZh ? '识别完成' : 'Scanning complete')))
    : (label ?? (isZh ? '识别进度' : 'Scanning progress'));

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, style]}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Animated.View style={{ opacity: pulseAnim }}>
            <Icon
              name={isFinished ? 'check' : 'sparkles'}
              size={13}
              color={accentColor ?? theme.accent}
            />
          </Animated.View>
          <Text style={[styles.labelText, { color: colorTheme.ink2 }]}>
            {headerLabel}
          </Text>
        </View>
        {showPercentage && (
          <Text
            style={[
              styles.percentText,
              monoNumProps,
              { color: accentColor ?? theme.accent },
            ]}
          >
            {displayPct}%
          </Text>
        )}
      </View>
      <View
        style={[styles.track, { backgroundColor: colorTheme.surface2 }]}
        onLayout={(e) => {
          const w = e.nativeEvent?.layout?.width;
          if (w && w > 0) setTrackWidth(w);
        }}
      >
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
        >
          {!reducedMotion && !isFinished && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmer,
                {
                  width: Math.max(40, trackWidth * 0.28),
                  transform: [{ translateX: shimmerTranslateX }, { skewX: '-20deg' }],
                },
              ]}
            />
          )}
        </Animated.View>
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
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 999,
  },
});
