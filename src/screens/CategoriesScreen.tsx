import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { BtnLabel, Card, CatBadge, Eyebrow, PrimaryButton, TopBar } from '../components/ui';
import { NoFallbackCategoryError } from '../db/categoriesRepo';
import { catColorsForHue } from '../lib/catColors';
import { confirmAction, notify } from '../lib/platformAlert';
import type { TxnType } from '../lib/types';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { radius, shadowToggle, uiFont } from '../theme';

export const EXPENSE_ICONS: IconName[] = ['home', 'cart', 'utensils', 'car', 'signal', 'heart', 'book', 'bag', 'play', 'shield', 'receipt', 'dots'];
export const INCOME_ICONS: IconName[] = ['wallet', 'store', 'car', 'gift', 'trending', 'percent', 'sparkles', 'return', 'dots'];
const HUE_CHOICES = [12, 42, 70, 120, 162, 200, 248, 286, 330];

/** Whether an icon value is a custom photo URI rather than a named icon. */
export function isCustomIcon(icon: string): boolean {
  return icon.startsWith('data:') || icon.startsWith('file:') || icon.startsWith('content:') || icon.startsWith('http') || icon.startsWith('/');
}

export function CategoriesScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t, tCat, isZh } = useLanguage();
  const { categories, addCategory, deleteCategory, updateCategoryIcon } = useAppData();

  const [kind, setKind] = useState<TxnType>('expense');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('cart');
  const [hue, setHue] = useState(162);
  const [busy, setBusy] = useState(false);

  // Which existing category's picture is being edited, and the icon/photo chosen so far.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIcon, setEditIcon] = useState<string>('cart');
  const [editBusy, setEditBusy] = useState(false);

  const iconChoices = kind === 'income' ? INCOME_ICONS : EXPENSE_ICONS;
  const list = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind]);

  const pickCustomIcon = async (setter: (uri: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });
    if (!res.canceled && res.assets?.length) {
      const a = res.assets[0];
      const dataUri = a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
      setter(dataUri);
    }
  };

  // When switching kind, default the icon to one valid for that kind.
  useEffect(() => {
    setIcon(kind === 'income' ? 'wallet' : 'cart');
    setEditingId(null);
  }, [kind]);

  const canAdd = name.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      await addCategory(name.trim(), icon, hue, kind);
      setName('');
      setHue(162);
    } finally {
      setBusy(false);
    }
  };

  const toggleEdit = (id: string, currentIcon: string) => {
    if (editingId === id) {
      setEditingId(null);
      return;
    }
    setEditingId(id);
    setEditIcon(currentIcon);
  };

  const saveEditedIcon = async () => {
    if (!editingId || editBusy) return;
    setEditBusy(true);
    try {
      await updateCategoryIcon(editingId, editIcon);
      setEditingId(null);
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = (id: string, label: string) => {
    confirmAction(
      isZh ? '删除分类？' : 'Delete category?',
      isZh ? `确定要删除“${label}”吗？其所属交易将转移至其他分类。` : `Remove “${label}”? Transactions move to another category and its learning is cleared.`,
      isZh ? '删除' : 'Delete',
      async () => {
        try {
          await deleteCategory(id);
        } catch (e) {
          if (e instanceof NoFallbackCategoryError) {
            notify(
              isZh ? '请先添加其他分类' : 'Add another category first',
              isZh ? `“${label}”是您唯一的${e.kind === 'income' ? '收入' : '支出'}分类。请先添加新分类后再删除。` : `“${label}” is your only ${e.kind} category, so there's nowhere to move its transactions. Add another ${e.kind} category, then delete this one.`
            );
            return;
          }
          throw e;
        }
      }
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title={t('categoriesTitle')} onBack={onBack} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* kind toggle */}
        <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
          {(['expense', 'income'] as TxnType[]).map((k) => {
            const on = kind === k;
            return (
              <Pressable key={k} onPress={() => setKind(k)} style={[styles.toggleBtn, on && [styles.toggleBtnOn, { backgroundColor: colorTheme.surface }]]}>
                <Text style={[styles.toggleText, { color: colorTheme.ink2 }, on && { color: colorTheme.ink }]}>
                  {k === 'expense' ? (isZh ? '支出' : 'Expense') : (isZh ? '收入' : 'Income')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* existing */}
        <Eyebrow style={{ marginBottom: 10 }}>
          {isZh ? `您的${kind === 'expense' ? '支出' : '收入'}分类` : `Your ${kind} categories`}
        </Eyebrow>
        <Card style={{ overflow: 'hidden' }}>
          {list.map((c, i) => (
            <View key={c.id}>
              <View style={[styles.row, i > 0 && [styles.divider, { borderTopColor: colorTheme.line2 }]]}>
                <Pressable onPress={() => toggleEdit(c.id, c.icon)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Change ${tCat(c)}'s picture`}>
                  <CatBadge category={c} size={38} />
                </Pressable>
                <Text style={[styles.rowLabel, { color: colorTheme.ink }]} numberOfLines={1}>
                  {tCat(c)}
                </Text>
                <Pressable onPress={() => toggleEdit(c.id, c.icon)} hitSlop={8} style={styles.editBtn}>
                  <Icon name="pencil" size={16} color={colorTheme.ink2} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(c.id, tCat(c))} hitSlop={8} style={styles.delBtn}>
                  <Icon name="trash" size={17} color="#b3261e" />
                </Pressable>
              </View>

              {editingId === c.id && (
                <View style={[styles.editPanel, { backgroundColor: colorTheme.surface2, borderTopColor: colorTheme.line2 }]}>
                  <View style={styles.choiceWrap}>
                    {iconChoices.map((ic) => {
                      const on = ic === editIcon;
                      return (
                        <Pressable key={ic} onPress={() => setEditIcon(ic)} style={[styles.iconChoice, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, on && { borderColor: theme.accent, backgroundColor: theme.accentTint }]}>
                          <Icon name={ic} size={20} color={on ? theme.accent : colorTheme.ink2} stroke={1.9} />
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => pickCustomIcon(setEditIcon)}
                      style={[
                        styles.iconChoice,
                        { backgroundColor: colorTheme.surface, borderColor: colorTheme.line },
                        isCustomIcon(editIcon) && { borderColor: theme.accent, backgroundColor: theme.accentTint },
                        { minWidth: 68, flexDirection: 'row', gap: 4, paddingHorizontal: 6 },
                      ]}
                    >
                      {isCustomIcon(editIcon) ? (
                        <Image source={{ uri: editIcon }} style={{ width: 22, height: 22, borderRadius: 4 }} resizeMode="cover" />
                      ) : (
                        <Icon name="image" size={17} color={theme.accent} stroke={2.0} />
                      )}
                      <Text style={{ fontSize: 10, fontFamily: uiFont(700), color: theme.accent }}>{isZh ? '相册' : 'Gallery'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.editActions}>
                    <Pressable onPress={() => setEditingId(null)} style={styles.editActionBtn} disabled={editBusy}>
                      <Text style={[styles.editActionText, { color: colorTheme.ink2 }]}>{t('cancel')}</Text>
                    </Pressable>
                    <Pressable onPress={saveEditedIcon} style={styles.editActionBtn} disabled={editBusy}>
                      <Text style={[styles.editActionText, { color: theme.accent }]}>{editBusy ? (isZh ? '保存中…' : 'Saving…') : t('save')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>

        {/* add new */}
        <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>
          {isZh ? `添加${kind === 'expense' ? '支出' : '收入'}分类` : `Add a ${kind} category`}
        </Eyebrow>
        <Card style={{ padding: 16, gap: 16 }}>
          <View style={styles.previewRow}>
            <CatBadge category={{ id: 'new', label: name, icon, hue, kind, isDefault: false }} size={44} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={isZh ? (kind === 'income' ? '例如：兼职副业' : '分类名称') : (kind === 'income' ? 'e.g. Freelance' : 'Category name')}
              placeholderTextColor={colorTheme.ink3}
              style={[styles.input, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line, color: colorTheme.ink }]}
              maxLength={22}
            />
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.pickLabel, { color: colorTheme.ink2 }]}>{isZh ? '图标' : 'Icon'}</Text>
            <View style={styles.choiceWrap}>
              {iconChoices.map((ic) => {
                const on = ic === icon;
                return (
                  <Pressable key={ic} onPress={() => setIcon(ic)} style={[styles.iconChoice, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }, on && { borderColor: theme.accent, backgroundColor: theme.accentTint }]}>
                    <Icon name={ic} size={20} color={on ? theme.accent : colorTheme.ink2} stroke={1.9} />
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => pickCustomIcon(setIcon)}
                style={[
                  styles.iconChoice,
                  { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line },
                  isCustomIcon(icon) && { borderColor: theme.accent, backgroundColor: theme.accentTint },
                  { minWidth: 68, flexDirection: 'row', gap: 4, paddingHorizontal: 6 }
                ]}
              >
                {isCustomIcon(icon) ? (
                  <Image source={{ uri: icon }} style={{ width: 22, height: 22, borderRadius: 4 }} resizeMode="cover" />
                ) : (
                  <Icon name="image" size={17} color={theme.accent} stroke={2.0} />
                )}
                <Text style={{ fontSize: 10, fontFamily: uiFont(700), color: theme.accent }}>{isZh ? '相册' : 'Gallery'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 9 }}>
            <Text style={[styles.pickLabel, { color: colorTheme.ink2 }]}>{isZh ? '颜色' : 'Color'}</Text>
            <View style={styles.choiceWrap}>
              {HUE_CHOICES.map((h) => {
                const on = h === hue;
                return (
                  <Pressable key={h} onPress={() => setHue(h)} style={[styles.hueChoice, { backgroundColor: catColorsForHue(h).solid }, on && [styles.hueChoiceOn, { borderColor: colorTheme.ink }]]}>
                    {on && <Icon name="check" size={14} color="#fff" stroke={2.6} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton onPress={submit} disabled={!canAdd} height={50}>
            <Icon name="plus" size={18} color="#fff" stroke={2.2} />
            <BtnLabel>{isZh ? `添加${kind === 'expense' ? '支出' : '收入'}分类` : `Add ${kind} category`}</BtnLabel>
          </PrimaryButton>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
  },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleBtnOn: { ...shadowToggle },
  toggleText: { fontFamily: uiFont(600), fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 12 },
  divider: { borderTopWidth: 1 },
  rowLabel: { flex: 1, fontFamily: uiFont(600), fontSize: 15 },
  delBtn: { padding: 6 },
  editBtn: { padding: 6 },
  editPanel: { padding: 15, paddingTop: 12, borderTopWidth: 1, gap: 12 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  editActionBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  editActionText: { fontFamily: uiFont(700), fontSize: 13.5 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: uiFont(600),
    fontSize: 15,
  },
  pickLabel: { fontFamily: uiFont(600), fontSize: 12.5 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  iconChoice: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hueChoice: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  hueChoiceOn: { borderWidth: 2.5 },
});
