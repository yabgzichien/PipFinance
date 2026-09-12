// src/components/AmountSheet.tsx
// The on-screen amount keypad. Opened from the amount row on ManualEntryScreen, which keeps
// showing the committed value while this is closed.
//
// Why a sheet and not a step: two of ManualEntryScreen's three callers (the scanned-receipt
// split and a quick-add prefill) already know the amount, so a dedicated amount *route* would
// be skipped by most entries. As a sheet it simply never opens for them.
//
// The expression text is the same string the plain TextInput used to hold, so lib/calc.ts
// consumes it unchanged; key handling lives in lib/calcKeypad.ts so it can be tested without
// rendering this modal.

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { evaluateExpression } from '../lib/calc';
import { applyCalcKey, formatBankingInput, type CalcKey } from '../lib/calcKeypad';
import { currencyPrefix } from '../lib/format';
import { tap } from '../lib/haptics';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { numFont, radius, uiFont } from '../theme';
import { CurrencyChip } from './CurrencyChip';
import { Icon } from './Icon';
import { BtnLabel, PrimaryButton } from './ui';

/** Row-major, matching a phone dialler's digit order with the operators down the right edge. */
const KEYS: CalcKey[] = [
  '7', '8', '9', '/',
  '4', '5', '6', '*',
  '1', '2', '3', '-',
  '00', '0', 'backspace', '+',
];

const GLYPH: Partial<Record<CalcKey, string>> = { '*': '×', '/': '÷', '-': '−' };

export function AmountSheet({
  visible,
  value,
  currency,
  activeCurrencies,
  decimals,
  onChangeCurrency,
  onCurrencyActivated,
  onApply,
  onClose,
}: {
  visible: boolean;
  /** The committed expression text, e.g. "12+8" or "42.50". */
  value: string;
  currency: string;
  activeCurrencies: string[];
  decimals: number;
  onChangeCurrency: (code: string) => void;
  /** Fires after CurrencyChip activates a currency that wasn't already active, so the parent
   * can refresh its own active-currency/rate state. */
  onCurrencyActivated?: (code: string) => void;
  /** The expression as typed — the parent evaluates it, exactly as it did for the old input. */
  onApply: (text: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();

  const [draft, setDraft] = useState(value);
  const isFreshOpen = useRef(true);

  // Re-seed on open rather than on every `value` change, mirroring SplitSheet: while the sheet
  // is up the draft is the user's, and a parent re-render must not stamp over their typing.
  useEffect(() => {
    if (visible) {
      setDraft(value);
      isFreshOpen.current = true;
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const calc = evaluateExpression(draft, decimals);
  const preview = calc.isExpression && calc.result != null && calc.result > 0 ? calc.formatted : null;

  const press = (key: CalcKey) => {
    tap();
    if (isFreshOpen.current) {
      isFreshOpen.current = false;
      // If the sheet was just opened with a pre-existing value and user types a digit,
      // start fresh with that digit (mirroring selectTextOnFocus behavior in standard inputs).
      if (/^[0-9]$/.test(key)) {
        setDraft(applyCalcKey('', key, decimals));
        return;
      }
    }
    setDraft((d) => applyCalcKey(d, key, decimals));
  };

  const done = () => {
    // Commit the evaluated total, not the raw expression: "12+8" is a way of arriving at 20,
    // and the parent's amount row should read 20 once the sheet is gone. Matches what the old
    // inline CalcBadge merge did.
    onApply(calc.result != null && calc.result > 0 ? calc.result.toFixed(decimals) : draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.avoider}>
        <View style={[styles.card, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />

          <View style={[styles.display, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <CurrencyChip
              value={currency}
              active={activeCurrencies}
              onChange={onChangeCurrency}
              onActivated={onCurrencyActivated}
            />
            {/* A real TextInput, with the OS keyboard suppressed on native. That keeps hardware
                typing working on web (and for anyone on a tablet keyboard) without forking this
                component per platform, while the pad below stays the only input on a phone. */}
            <TextInput
              value={draft}
              onChangeText={(t) => setDraft(formatBankingInput(t, decimals))}
              showSoftInputOnFocus={false}
              autoFocus={Platform.OS === 'web'}
              selectTextOnFocus
              onSubmitEditing={done}
              caretHidden={Platform.OS !== 'web'}
              placeholder={decimals === 0 ? '0' : '0.00'}
              placeholderTextColor={colorTheme.ink3}
              style={[styles.input, { color: colorTheme.ink }]}
            />
          </View>
          <Text style={[styles.preview, { color: preview ? theme.accent : 'transparent' }]}>
            {preview ? `= ${currencyPrefix(currency)} ${preview}` : '—'}
          </Text>

          <View style={styles.pad}>
            {KEYS.map((k) => {
              const isOp = k === '+' || k === '-' || k === '*' || k === '/';
              const isBack = k === 'backspace';
              return (
                <View key={k} style={styles.keyCell}>
                  <Pressable
                    onPress={() => press(k)}
                    // Long-press to clear: the only destructive action here, and cheap to undo
                    // by retyping, so it does not warrant a dedicated key stealing pad space.
                    onLongPress={isBack ? () => { tap(); setDraft(''); } : undefined}
                    style={({ pressed }) => [
                      styles.key,
                      {
                        backgroundColor: isOp ? theme.accentTint : colorTheme.surface,
                        borderColor: isOp ? theme.accentSoft : colorTheme.line,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={isBack ? (isZh ? '退格' : 'Backspace') : GLYPH[k] ?? k}
                  >
                    {isBack ? (
                      <Icon name="chevronLeft" size={20} color={colorTheme.ink2} stroke={2.2} />
                    ) : (
                      <Text style={[styles.keyText, { color: isOp ? theme.accent : colorTheme.ink }]}>
                        {GLYPH[k] ?? k}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>

          <PrimaryButton onPress={done} disabled={calc.result == null || calc.result <= 0}>
            <Icon name="check" size={19} color="#fff" stroke={2.4} />
            <BtnLabel>{isZh ? '完成' : 'Done'}</BtnLabel>
          </PrimaryButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  card: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  display: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
  },
  input: { flex: 1, minWidth: 0, fontFamily: numFont(700), fontSize: 30, paddingVertical: 12, textAlign: 'right' },
  preview: { fontFamily: numFont(600), fontSize: 14, textAlign: 'right', marginTop: 6, marginBottom: 10, minHeight: 18 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 14 },
  // The cell owns the 25% tile and the gutter; the key fills it. Spacing via padding rather
  // than `gap` keeps the four columns tiling exactly, and rather than a scale transform so
  // the borders stay 1px and the tap target stays the full tile.
  keyCell: { width: '25%', paddingHorizontal: 4, paddingBottom: 8 },
  key: {
    // A fixed height keeps the grid stable across screen sizes without an onLayout measure;
    // 54 is comfortably above the 44pt minimum tap target.
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  keyText: { fontFamily: numFont(700), fontSize: 22 },
});
