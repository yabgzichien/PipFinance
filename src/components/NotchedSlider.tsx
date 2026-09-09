import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { notchFromX } from '../lib/notchedSlider';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { Caption } from './ui';

const THUMB = 22;

export function NotchedSlider({
  value,
  count,
  onChange,
  label,
}: {
  value: number;
  count: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const countRef = useRef(count);
  const onChangeRef = useRef(onChange);
  countRef.current = count;
  onChangeRef.current = onChange;

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
      {label ? <Caption>{label}</Caption> : null}
      <View style={styles.row} onLayout={onLayout} {...pan.panHandlers}>
        <View style={[styles.track, { backgroundColor: colorTheme.line }]} />
        <View
          style={[
            styles.track,
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: theme.accent },
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
            ]}
          />
        ))}
        <View
          style={[
            styles.thumb,
            {
              left: Math.max(0, Math.min(width - THUMB, pct * width - THUMB / 2)),
              backgroundColor: theme.accent,
            },
          ]}
        />
      </View>
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
});
