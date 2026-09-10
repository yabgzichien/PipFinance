import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { notchAfterAccessibilityAction, notchFromX } from '../lib/notchedSlider';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { Caption } from './ui';

const THUMB = 22;

export function NotchedSlider({
  value,
  count,
  onChange,
  label,
  defaultValue,
  defaultLabel,
  compact = false,
}: {
  value: number;
  count: number;
  onChange: (n: number) => void;
  label?: string;
  defaultValue?: number;
  defaultLabel?: string;
  compact?: boolean;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const countRef = useRef(count);
  const onChangeRef = useRef(onChange);
  countRef.current = count;
  onChangeRef.current = onChange;

  const thumbSize = compact ? 17 : THUMB;
  const rowHeight = compact ? 33 : 44;
  const trackHeight = compact ? 5 : 7;
  const markerSize = compact ? 7 : 9;
  const markerMargin = compact ? -3.5 : -4.5;

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    widthRef.current = nextWidth;
    setWidth(nextWidth);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) =>
        onChangeRef.current(
          notchFromX(event.nativeEvent.locationX, widthRef.current, countRef.current)
        ),
      onPanResponderMove: (event) =>
        onChangeRef.current(
          notchFromX(event.nativeEvent.locationX, widthRef.current, countRef.current)
        ),
    })
  ).current;

  const pct = count > 1 ? (value - 1) / (count - 1) : 0;

  return (
    <View>
      {label ? (
        <Caption style={compact ? { fontSize: 11.5, lineHeight: 15 } : undefined}>
          {label}
        </Caption>
      ) : null}
      <View
        style={[styles.row, { height: rowHeight }]}
        onLayout={onLayout}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: count, now: value, text: `${value} of ${count}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action !== 'increment' && action !== 'decrement') return;
          onChangeRef.current(notchAfterAccessibilityAction(value, count, action));
        }}
      >
        <View style={[styles.track, { height: trackHeight, backgroundColor: colorTheme.line }]} />
        <View
          style={[
            styles.track,
            styles.fill,
            { height: trackHeight, width: `${pct * 100}%`, backgroundColor: theme.accent },
          ]}
        />
        {Array.from({ length: count }, (_, index) => (
          <View
            key={index}
            style={[
              styles.notch,
              {
                left: count > 1 ? `${(index / (count - 1)) * 100}%` : '0%',
                backgroundColor: index + 1 <= value ? theme.accent : colorTheme.line,
              },
              index + 1 === defaultValue && {
                width: markerSize,
                height: markerSize,
                marginLeft: markerMargin,
                borderWidth: compact ? 1.5 : 2,
                borderColor: theme.accent,
                backgroundColor: colorTheme.surface,
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderWidth: compact ? 2.5 : 3,
              left: Math.max(0, Math.min(width - thumbSize, pct * width - thumbSize / 2)),
              backgroundColor: theme.accent,
            },
          ]}
        />
      </View>
      {defaultLabel ? (
        <Caption
          color={colorTheme.ink2}
          style={[styles.defaultLabel, compact && { fontSize: 11, lineHeight: 14, marginTop: -3 }]}
        >
          {defaultLabel}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 44, justifyContent: 'center' },
  track: { height: 7, borderRadius: 999 },
  fill: { position: 'absolute', left: 0 },
  notch: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 999,
    marginLeft: -1.5,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#fff',
  },
  defaultLabel: { marginTop: -4 },
});
