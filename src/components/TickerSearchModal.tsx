// src/components/TickerSearchModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TickerResult } from '../lib/prices';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';
import { Icon } from './Icon';
import { BrandBadge } from './BrandBadge';
import { matchCrypto } from './BrandLogo';

/** Search-and-pick a ticker. `search` is injected so the same UI serves crypto, stocks, or commodities (all Yahoo). */
export function TickerSearchModal({
  visible,
  title,
  placeholder,
  search,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  search: (query: string) => Promise<TickerResult[]>;
  onPick: (coin: TickerResult) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TickerResult[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setBusy(false);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const r = await search(q);
      if (mine === seq.current) {
        setResults(r.slice(0, 25));
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, visible, search]);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.avoider}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
          <View style={styles.head}>
            <Text style={[styles.title, { color: colorTheme.ink }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}><Icon name="x" size={20} color={colorTheme.ink2} /></Pressable>
          </View>
          <View style={[styles.searchRow, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
            <Icon name="search" size={17} color={colorTheme.ink3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={colorTheme.ink3}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              style={[styles.searchInput, { color: colorTheme.ink }]}
            />
            {busy && <ActivityIndicator size="small" color={theme.accent} />}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            {results.map((c) => {
              const cryptoBrand = c.type === 'crypto' ? matchCrypto(c.ticker) || matchCrypto(c.name) : null;
              return (
                <Pressable key={c.id} onPress={() => onPick(c)} style={[styles.row, { borderTopColor: colorTheme.line2 }]}>
                  {cryptoBrand ? (
                    <BrandBadge brand={cryptoBrand} size={38} rad={10} />
                  ) : (
                    <View style={[styles.tickerBox, { backgroundColor: theme.accentTint }]}>
                      <Text style={[styles.tickerText, { color: theme.accent }]}>{c.ticker.slice(0, 4)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, { color: colorTheme.ink }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.sub, { color: colorTheme.ink2 }]}>{c.ticker}</Text>
                  </View>
                  <Icon name="chevronRight" size={16} color={colorTheme.ink3} />
                </Pressable>
              );
            })}
            {!busy && query.trim().length >= 2 && results.length === 0 && (
              <Text style={[styles.empty, { color: colorTheme.ink2 }]}>
                {isZh ? `未找到与“${query.trim()}”匹配的结果。` : `No matches for “${query.trim()}”.`}
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  // `flex: 1` gives KeyboardAvoidingView a stable full-screen frame to measure on Android, so its
  // `height` behavior can correctly shrink around the keyboard; flexbox then pins the card to the
  // bottom. See the matching comment on NetWorthScreen's `sheetAvoider` for the full root cause.
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 18, paddingTop: 10, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { flex: 1, fontFamily: uiFont(700), fontSize: 18 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 13, marginBottom: 10 },
  searchInput: { flex: 1, fontFamily: uiFont(600), fontSize: 15, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1 },
  tickerBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tickerText: { fontFamily: uiFont(700), fontSize: 12 },
  name: { fontFamily: uiFont(600), fontSize: 14.5 },
  sub: { fontFamily: uiFont(500), fontSize: 12, marginTop: 1 },
  empty: { fontFamily: uiFont(500), fontSize: 13.5, textAlign: 'center', paddingVertical: 24 },
});
