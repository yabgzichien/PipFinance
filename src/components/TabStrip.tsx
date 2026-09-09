import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { Label } from './ui';

export interface TabStripItem<T extends string> {
  id: T;
  label: string;
  /** Draws a small dot on the tab. Used to show a section differs from its default, so options
   *  hidden behind a tab are still discoverable after the fact. */
  marked?: boolean;
}

/**
 * A horizontally scrolling tab strip with an underline indicator.
 *
 * Scrolling rather than fitting: seven labelled tabs will not fit a phone width legibly, and
 * shrinking the text to make them fit costs more than the scroll does. The active tab is scrolled
 * into view on change so a tab selected off-screen does not leave the strip looking unchanged.
 */
export function TabStrip<T extends string>({
  items,
  value,
  onChange,
}: {
  items: TabStripItem<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    const hit = offsets.current[value];
    if (!hit) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, hit.x - 24), animated: true });
  }, [value]);

  return (
    <View style={[styles.root, { borderBottomColor: colorTheme.line }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(item.id)}
              onLayout={(e) => {
                offsets.current[item.id] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                };
              }}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.marked ? `${item.label}, changed` : item.label}
            >
              <View style={styles.labelRow}>
                <Label color={active ? theme.accent : colorTheme.ink2}>{item.label}</Label>
                {item.marked ? (
                  <View style={[styles.dot, { backgroundColor: active ? theme.accent : colorTheme.ink2 }]} />
                ) : null}
              </View>
              <View
                style={[
                  styles.underline,
                  { backgroundColor: active ? theme.accent : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: 12, gap: 4 },
  tab: { paddingHorizontal: 10, paddingTop: 10, alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 999 },
  underline: { height: 2, alignSelf: 'stretch', borderRadius: 999, marginTop: 8 },
});
