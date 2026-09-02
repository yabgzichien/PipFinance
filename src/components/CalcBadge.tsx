// src/components/CalcBadge.tsx
// Animated calculation preview badge with spring entrance and micro-pulse on recalculation.
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { tap } from '../lib/haptics';
import { useAccent } from '../state/accent';
import { numFont, radius } from '../theme';

interface CalcBadgeProps {
  result: number;
  decimals: number;
  onApply?: () => void;
}

export function CalcBadge({ result, decimals, onApply }: CalcBadgeProps) {
  const theme = useAccent();
  const useNative = Platform.OS !== 'web';
  const scale = useRef(new Animated.Value(0.8)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const prevResultRef = useRef<number>(result);

  // Entrance spring on initial mount
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 180,
      friction: 7,
      useNativeDriver: useNative,
    }).start();
  }, [scale, useNative]);

  // Spring pulse whenever the calculated result value changes
  useEffect(() => {
    if (prevResultRef.current !== result) {
      prevResultRef.current = result;
      pulse.setValue(1.15);
      Animated.spring(pulse, {
        toValue: 1,
        tension: 180,
        friction: 6,
        useNativeDriver: useNative,
      }).start();
    }
  }, [result, pulse, useNative]);

  const handlePress = () => {
    tap();
    onApply?.();
  };

  const displayText = decimals === 0 ? String(Math.round(result)) : result.toFixed(decimals);

  return (
    <Animated.View
      style={{
        flexShrink: 0,
        transform: [{ scale: Animated.multiply(scale, pulse) }],
      }}
    >
      <Pressable
        onPress={handlePress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.badge,
          {
            backgroundColor: theme.accentTint,
            borderColor: theme.accentSoft,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Calculated amount equals ${displayText}. Tap to apply.`}
      >
        <Text style={[styles.equalSign, { color: theme.accent }]}>=</Text>
        <Text style={[styles.amountText, { color: theme.accent }]}>{displayText}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    marginLeft: 6,
  },
  equalSign: {
    fontFamily: numFont(700),
    fontSize: 15,
  },
  amountText: {
    fontFamily: numFont(700),
    fontSize: 15,
  },
});
