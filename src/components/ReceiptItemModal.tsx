import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { round2 } from '../lib/currency';
import { currencyPrefix } from '../lib/format';
import type { ReceiptLine } from '../lib/split';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { numFont, radius, uiFont } from '../theme';
import { Icon } from './Icon';
import { BtnLabel, PrimaryButton } from './ui';

export function ReceiptItemModal({
  visible,
  item,
  currency,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  item: ReceiptLine | null;
  currency: string;
  onClose: () => void;
  onSave: (data: { id?: string; label: string; amount: number }) => void;
  onDelete?: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();

  const [label, setLabel] = useState('');
  const [amountText, setAmountText] = useState('');

  useEffect(() => {
    if (visible) {
      if (item) {
        setLabel(item.label);
        setAmountText(item.amount > 0 ? item.amount.toFixed(2) : '');
      } else {
        setLabel('');
        setAmountText('');
      }
    }
  }, [visible, item]);

  if (!visible) return <Modal visible={false} transparent />;

  const parsedAmount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
  const isValid = label.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      id: item?.id,
      label: label.trim(),
      amount: round2(parsedAmount),
    });
    onClose();
  };

  const handleDelete = () => {
    if (item && onDelete) {
      onDelete(item.id);
      onClose();
    }
  };

  const prefix = currencyPrefix(currency);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.center, { pointerEvents: 'box-none' }]}
      >
        <View style={[styles.card, { backgroundColor: colorTheme.surface, marginBottom: insets.bottom + 8 }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colorTheme.ink }]}>
              {item ? (isZh ? '编辑明细' : 'Edit item') : (isZh ? '添加明细' : 'Add an item')}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={isZh ? '关闭' : 'Close'}>
              <Icon name="x" size={20} color={colorTheme.ink2} />
            </Pressable>
          </View>

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '项目名称' : 'Item name'}</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={isZh ? '例如：海南鸡饭' : 'e.g. Chicken Rice'}
            placeholderTextColor={colorTheme.ink3}
            style={[
              styles.input,
              { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, color: colorTheme.ink },
            ]}
            autoCapitalize="words"
            autoFocus={!item}
            returnKeyType="next"
          />

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2, marginTop: 14 }]}>{isZh ? '单价 / 金额' : 'Price'}</Text>
          <View
            style={[
              styles.amountRow,
              { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line },
            ]}
          >
            <Text style={[styles.currencyText, { color: colorTheme.ink2 }]}>{prefix}</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={colorTheme.ink3}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[styles.amountInput, { color: colorTheme.ink }]}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          <View style={{ marginTop: 18 }}>
            <PrimaryButton onPress={handleSave} disabled={!isValid} height={48}>
              <Icon name={item ? 'check' : 'plus'} size={18} color="#fff" stroke={2.2} />
              <BtnLabel>{item ? (isZh ? '保存修改' : 'Save changes') : (isZh ? '添加明细' : 'Add item')}</BtnLabel>
            </PrimaryButton>
          </View>

          {item && onDelete && (
            <Pressable onPress={handleDelete} style={styles.deleteBtn} hitSlop={6}>
              <Icon name="trash" size={16} color="#b3261e" />
              <Text style={styles.deleteText}>{isZh ? '删除项目' : 'Delete item'}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  center: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  card: { borderRadius: radius.lg, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: uiFont(700), fontSize: 17 },
  fieldLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: uiFont(600),
    fontSize: 15,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 4,
    gap: 8,
  },
  currencyText: {
    fontFamily: numFont(600),
    fontSize: 16,
  },
  amountInput: {
    flex: 1,
    fontFamily: numFont(700),
    fontSize: 18,
    paddingVertical: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },
  deleteText: {
    fontFamily: uiFont(700),
    fontSize: 14,
    color: '#b3261e',
  },
});
