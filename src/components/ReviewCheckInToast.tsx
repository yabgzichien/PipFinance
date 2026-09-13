// src/components/ReviewCheckInToast.tsx
// Displays a subtle, delightful toast when the user reviews a key financial
// screen (Budget, Recap, Breakdown) to acknowledge extending their mindful streak.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppData } from '../state/store';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useLanguage } from '../i18n';
import { tap } from '../lib/haptics';
import { platformShadow, uiFont } from '../theme';

export function ReviewCheckInToast() {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t } = useLanguage();
  const { streakWeek, streakTodayIndex, checkInToday } = useAppData();
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only trigger if today has not been marked as active yet
    if (streakWeek && typeof streakTodayIndex === 'number' && !streakWeek[streakTodayIndex]) {
      void checkInToday('review');
      tap();
      setVisible(true);

      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -30, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, 2600);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colorTheme.surface,
            borderColor: theme.accentSoft,
            ...platformShadow('#000', 0.12, 12, { width: 0, height: 4 }, 4),
          },
        ]}
      >
        <Text style={[styles.text, { color: colorTheme.ink }]}>
          {t('streakReviewToast')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontFamily: uiFont(600),
  },
});
