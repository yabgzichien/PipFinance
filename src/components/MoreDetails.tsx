// src/components/MoreDetails.tsx
// A collapsible block for fields that already have a correct answer.
//
// The summary line is the point: collapsing a field only reduces friction if the user can see
// it has been answered. "Cash · no merchant" tells them the money came from the right place
// without costing a row, so the collapsed state reads as settled rather than hidden.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../i18n';
import { useThemeColors } from '../state/colorScheme';
import { uiFont } from '../theme';
import { Icon } from './Icon';

export function MoreDetails({
  summary,
  defaultOpen = false,
  children,
}: {
  /** One-line recap of what is inside, e.g. "Cash · Jaya Grocer". */
  summary: string;
  /** Start expanded when something in here is already non-default — a scanned receipt arrives
   *  with a merchant, and burying it would look like the app had lost it. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[styles.wrap, { borderColor: colorTheme.line }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.head}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: colorTheme.ink }]}>{isZh ? '更多详情' : 'More details'}</Text>
          {!open && (
            <Text style={[styles.summary, { color: colorTheme.ink2 }]} numberOfLines={1}>
              {summary}
            </Text>
          )}
        </View>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={colorTheme.ink2} />
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  title: { fontFamily: uiFont(700), fontSize: 14 },
  summary: { fontFamily: uiFont(500), fontSize: 12, marginTop: 3 },
  body: { paddingBottom: 18 },
});
