// src/screens/TaxScreen.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../components/ui';
import { useThemeColors } from '../state/colorScheme';

export function TaxScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const colorTheme = useThemeColors();
  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg, paddingTop: insets.top }]}>
      <TopBar title="Tax relief" onBack={onBack} />
      <View style={styles.body}>
        <Text style={{ color: colorTheme.ink2 }}>Coming soon.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
