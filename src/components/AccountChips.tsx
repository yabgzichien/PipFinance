// src/components/AccountChips.tsx
import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, matchBrand } from './BrandLogo';
import { Icon, type IconName } from './Icon';
import { CLASS_BY_ID } from '../lib/networth';
import { matchInstitution } from '../lib/institutions';
import { tap } from '../lib/haptics';
import type { Account } from '../lib/types';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, uiFont } from '../theme';

/** How many "Pay from" accounts get a chip before the rest move behind "More". */
export const MAX_ACCOUNT_CHIPS = 5;
/** The same cap for the optional rows in More details, which also spend a slot on "None". */
export const MAX_OPTIONAL_CHIPS = 4;

/**
 * Score accounts to prioritize payment methods in order:
 * 1. Cash accounts
 * 2. Bank accounts
 * 3. E-wallet accounts
 * 4. Other Cash & Bank class accounts
 * 5. Other asset accounts
 */
export function getAccountPriority(a: Account): number {
  const nameLower = a.name.toLowerCase().trim();
  const inst = matchInstitution(a.name);

  // 1. Cash accounts
  if (nameLower === 'cash' || a.name === '现金' || nameLower.includes('cash') || nameLower.includes('现金')) {
    return 1;
  }
  // 2. Bank accounts
  if (inst?.kind === 'bank' || nameLower.includes('bank') || nameLower.includes('银行')) {
    return 2;
  }
  // 3. E-wallet accounts
  if (
    inst?.kind === 'ewallet' ||
    nameLower.includes('wallet') ||
    nameLower.includes('tng') ||
    nameLower.includes('touch') ||
    nameLower.includes('grab') ||
    nameLower.includes('boost') ||
    nameLower.includes('pay')
  ) {
    return 3;
  }
  // 4. Other Cash & Bank class accounts
  if (a.cls === 'cash') {
    return 4;
  }
  return 5;
}

/**
 * One option in a capped chip row. Shared by "Pay from", "Reduce liability" and "Trip" so the
 * three rows cannot drift apart: the selected state is the same tint, weight and check mark
 * wherever the user meets it.
 */
export function ChoiceChip({
  label,
  on,
  onPress,
  accessibilityLabel,
  children,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Leading glyph — an account's brand logo or class icon, a trip's pin. */
  children?: React.ReactNode;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.accountChip,
        {
          backgroundColor: on ? theme.accentTint : colorTheme.surface,
          borderColor: on ? theme.accentSoft : colorTheme.line,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {children}
      <Text
        style={[styles.accountChipText, { color: on ? theme.accent : colorTheme.ink2 }, on && { fontFamily: uiFont(700) }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {on && <Icon name="check" size={13} color={theme.accent} stroke={2.4} />}
    </Pressable>
  );
}

/** The chip that hands the row's overflow to a full picker. Never carries a selected state —
 *  whatever is selected has already displaced a chip in the row (see visibleChoices). */
export function MoreChip({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.accountChip, { borderColor: colorTheme.line, backgroundColor: colorTheme.surface }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.accountChipText, { color: colorTheme.ink2 }]}>{isZh ? '更多' : 'More'}</Text>
      <Icon name="chevronDown" size={13} color={colorTheme.ink3} />
    </Pressable>
  );
}

/** An account's own mark: its bank's logo, its custom icon, or its class glyph. */
export function AccountChipIcon({ account, on }: { account: Account; on: boolean }) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const brand = matchBrand(account.name);
  if (brand) return <BrandLogo brand={brand} size={16} />;
  if (account.icon) return <Image source={{ uri: account.icon }} style={{ width: 16, height: 16, borderRadius: 4 }} />;
  return (
    <Icon
      name={(CLASS_BY_ID[account.cls]?.icon ?? 'wallet') as IconName}
      size={15}
      color={on ? theme.accent : colorTheme.ink2}
    />
  );
}

/**
 * Full account picker modal when user taps "More".
 * Displays active accounts with brand logos and checkmark, an optional "None" entry,
 * and a bottom button to create a new account.
 */
export function AccountPickerModal({
  visible,
  title,
  accounts,
  selectedId,
  onSelect,
  onClose,
  onCreateNew,
  createNewText,
  allowNone = false,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  accounts: Account[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onCreateNew?: () => void;
  createNewText?: string;
  allowNone?: boolean;
  onDismiss?: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuBackdrop} onPress={onClose} />
      <View style={styles.menuWrap} pointerEvents="box-none">
        <View style={[styles.menu, { backgroundColor: colorTheme.bg, borderColor: colorTheme.line2 }]}>
          <Text style={[styles.menuTitle, { color: colorTheme.ink2 }]}>{title}</Text>
          <ScrollView style={styles.menuScroll} keyboardShouldPersistTaps="handled">
            {allowNone && (
              <Pressable
                onPress={() => {
                  tap();
                  onSelect(null);
                  onClose();
                }}
                style={[styles.accountMenuItem, !selectedId && { backgroundColor: theme.accentTint }]}
              >
                <View style={styles.noneIconPlaceholder}>
                  <Icon name="x" size={14} color={!selectedId ? theme.accent : colorTheme.ink3} />
                </View>
                <Text
                  style={[
                    styles.accountMenuText,
                    { color: colorTheme.ink },
                    !selectedId && { color: theme.onTint, fontFamily: uiFont(700) },
                  ]}
                  numberOfLines={1}
                >
                  {isZh ? '无' : 'None'}
                </Text>
                {!selectedId && <Icon name="check" size={16} color={theme.accent} stroke={2.4} />}
              </Pressable>
            )}
            {accounts.map((a) => {
              const on = selectedId === a.id;
              const brand = matchBrand(a.name);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    tap();
                    onSelect(a.id);
                    onClose();
                  }}
                  style={[styles.accountMenuItem, on && { backgroundColor: theme.accentTint }]}
                >
                  {brand ? (
                    <BrandLogo brand={brand} size={18} />
                  ) : a.icon ? (
                    <Image source={{ uri: a.icon }} style={{ width: 18, height: 18, borderRadius: 4 }} />
                  ) : (
                    <Icon
                      name={(CLASS_BY_ID[a.cls]?.icon ?? 'wallet') as IconName}
                      size={16}
                      color={on ? theme.accent : colorTheme.ink2}
                    />
                  )}
                  <Text
                    style={[
                      styles.accountMenuText,
                      { color: colorTheme.ink },
                      on && { color: theme.onTint, fontFamily: uiFont(700) },
                    ]}
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                  {on && <Icon name="check" size={16} color={theme.accent} stroke={2.4} />}
                </Pressable>
              );
            })}
          </ScrollView>
          {onCreateNew && (
            <>
              <View style={[styles.menuDivider, { backgroundColor: colorTheme.line2 }]} />
              <Pressable
                onPress={() => {
                  onClose();
                  onCreateNew();
                }}
                style={styles.accountMenuItem}
              >
                <Icon name="plus" size={16} color={theme.accent} stroke={2.2} />
                <Text style={[styles.accountMenuText, { color: theme.accent, fontFamily: uiFont(600) }]}>
                  {createNewText ?? (isZh ? '创建新账户' : 'Create new account')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  accountChipText: { fontFamily: uiFont(600), fontSize: 13, maxWidth: 180 },
  noneIconPlaceholder: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  menuWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 8,
    maxHeight: '70%',
  },
  menuTitle: { fontFamily: uiFont(700), fontSize: 13, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  menuScroll: { flexGrow: 0 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  accountMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  accountMenuText: { flex: 1, fontFamily: uiFont(600), fontSize: 15 },
});
