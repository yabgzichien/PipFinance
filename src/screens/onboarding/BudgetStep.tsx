// src/screens/onboarding/BudgetStep.tsx
// Step 2 of the setup wizard: a lighter single-screen budget (income + category pick +
// allocate, merged onto one screen) rather than the full 3-part BudgetWizard reachable
// later from the Budget screen. Income is optional  Save & continue is never gated.
//
// Category management (rename/re-icon/delete/add) lives here too, inline on the same
// chip list, rather than sending a first-time user to a separate Categories screen.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AddCategoryModal } from '../../components/AddCategoryModal';
import { EXPENSE_ICONS } from '../CategoriesScreen';
import { Icon, type IconName } from '../../components/Icon';
import { FadeIn } from '../../components/Motion';
import { BtnLabel, CatBadge, Eyebrow, PrimaryButton } from '../../components/ui';
import { NoFallbackCategoryError } from '../../db/categoriesRepo';
import { useLanguage } from '../../i18n';
import { currencyPrefix } from '../../lib/format';
import * as haptics from '../../lib/haptics';
import { confirmAction, notify } from '../../lib/platformAlert';
import { useAccent } from '../../state/accent';
import { useThemeColors } from '../../state/colorScheme';
import { useDisplayCurrency } from '../../state/useDisplayCurrency';
import { useAppData } from '../../state/store';
import { numFont, radius, spacing, uiFont } from '../../theme';
import { stagger } from '../../theme/motion';

export function BudgetStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const dc = useDisplayCurrency();
  const { t, tCat } = useLanguage();
  const { categories, saveBudget, deleteCategory, updateCategoryLabel, updateCategoryIcon } = useAppData();
  const expenseCats = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories]);

  const [incomeText, setIncomeText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState<string>('cart');
  const [editBusy, setEditBusy] = useState(false);

  const income = Math.max(0, parseFloat(incomeText.replace(/[^0-9.]/g, '')) || 0);

  const toggle = (id: string) => {
    if (editingId === id) return; // editing takes the tap, not selection
    haptics.tap();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (id: string, label: string, icon: string) => {
    setEditingId((cur) => (cur === id ? null : id));
    setEditLabel(label);
    setEditIcon(icon);
  };

  const saveEdit = async () => {
    if (!editingId || editBusy) return;
    setEditBusy(true);
    try {
      const trimmed = editLabel.trim();
      if (trimmed) await updateCategoryLabel(editingId, trimmed);
      await updateCategoryIcon(editingId, editIcon);
      setEditingId(null);
    } finally {
      setEditBusy(false);
    }
  };

  const removeCategory = (id: string, label: string) => {
    confirmAction(t('wizardDeleteCategoryTitle'), t('wizardDeleteCategoryBody', { label }), t('delete'), async () => {
      try {
        await deleteCategory(id);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (e) {
        if (e instanceof NoFallbackCategoryError) {
          notify('Add another category first', `"${label}" is your only ${e.kind} category, so there's nowhere to move its transactions. Add another category, then delete this one.`);
          return;
        }
        throw e;
      }
    });
  };

  const finish = async () => {
    haptics.commit();
    const allocations: Record<string, number> = {};
    for (const id of selected) {
      allocations[id] = Math.max(0, parseFloat((amounts[id] ?? '').replace(/[^0-9.]/g, '')) || 0);
    }
    await saveBudget(income, allocations);
    onNext();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
      <Eyebrow style={{ marginBottom: spacing.sm }}>{t('wizardExpectedIncomeOptional')}</Eyebrow>
      <View style={[styles.incomeCard, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 }]}>
        <Text style={[styles.rm, { color: colorTheme.ink2 }]}>{currencyPrefix(dc.code)}</Text>
        <TextInput
          value={incomeText}
          onChangeText={setIncomeText}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colorTheme.ink3}
          style={[styles.incomeInput, { color: colorTheme.ink }]}
        />
      </View>

      <Eyebrow style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('wizardCategories')}</Eyebrow>
      <Body2 color={colorTheme.ink2}>{t('wizardBudgetInstruction')}</Body2>

      <View style={{ marginTop: spacing.sm }}>
        {/* Rows land one after another rather than all at once, capped at index 4 so a long
            category list still finishes settling inside half a second. */}
        {expenseCats.map((c, i) => {
          const isSelected = selected.has(c.id);
          const catLabel = tCat(c);
          return (
            <FadeIn key={c.id} delay={Math.min(i, 4) * stagger} offset={8}>
              <View
                style={[
                  styles.row,
                  { backgroundColor: colorTheme.surface, borderColor: colorTheme.line2 },
                  isSelected && { borderColor: theme.accent, backgroundColor: theme.accentTint },
                ]}
              >
                {/* Amount input, pencil and trash are siblings of this Pressable, not children of
                    it  nesting a TextInput inside a selection Pressable let a tap on the input
                    bubble up and toggle selection before the tap ever reached the input. */}
                <Pressable
                  onPress={() => toggle(c.id)}
                  style={styles.rowTapZone}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={catLabel}
                >
                  <CatBadge category={c} size={38} />
                  <Text style={[styles.rowLabel, { color: colorTheme.ink }]} numberOfLines={1}>
                    {catLabel}
                  </Text>
                </Pressable>
                {isSelected && (
                  <View style={[styles.amountWrap, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                    <Text style={[styles.rmSmall, { color: colorTheme.ink2 }]}>{currencyPrefix(dc.code)}</Text>
                    <TextInput
                      value={amounts[c.id] ?? ''}
                      onChangeText={(v) => setAmounts((p) => ({ ...p, [c.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colorTheme.ink3}
                      style={[styles.amountInput, { color: colorTheme.ink }]}
                    />
                  </View>
                )}
                <Pressable onPress={() => startEdit(c.id, catLabel, c.icon)} hitSlop={8} style={styles.iconBtn}>
                  <Icon name="pencil" size={15} color={colorTheme.ink2} />
                </Pressable>
                <Pressable onPress={() => removeCategory(c.id, catLabel)} hitSlop={8} style={styles.iconBtn}>
                  <Icon name="trash" size={16} color="#b3261e" />
                </Pressable>
              </View>

              {editingId === c.id && (
                <FadeIn style={[styles.editPanel, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]} offset={-6}>
                  <TextInput
                    value={editLabel}
                    onChangeText={setEditLabel}
                    placeholder={t('wizardCategoryNamePlaceholder')}
                    placeholderTextColor={colorTheme.ink3}
                    style={[styles.editInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
                    maxLength={22}
                  />
                  <View style={styles.choiceWrap}>
                    {EXPENSE_ICONS.map((ic: IconName) => {
                      const on = ic === editIcon;
                      return (
                        <Pressable
                          key={ic}
                          onPress={() => setEditIcon(ic)}
                          style={[styles.iconChoice, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, on && { borderColor: theme.accent, backgroundColor: theme.accentTint }]}
                        >
                          <Icon name={ic} size={19} color={on ? theme.accent : colorTheme.ink2} stroke={1.9} />
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.editActions}>
                    <Pressable onPress={() => setEditingId(null)} hitSlop={6} disabled={editBusy}>
                      <Text style={[styles.editActionText, { color: colorTheme.ink2 }]}>{t('cancel')}</Text>
                    </Pressable>
                    <Pressable onPress={saveEdit} hitSlop={6} disabled={editBusy}>
                      <Text style={[styles.editActionText, { color: theme.accent }]}>{editBusy ? t('saving') : t('save')}</Text>
                    </Pressable>
                  </View>
                </FadeIn>
              )}
            </FadeIn>
          );
        })}

        <Pressable
          onPress={() => setAdding(true)}
          style={[styles.addRow, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}
        >
          <Icon name="plus" size={16} color={theme.accent} stroke={2.2} />
          <Text style={[styles.addRowText, { color: theme.accent }]}>{t('wizardNewCategory')}</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <PrimaryButton onPress={() => void finish()}>
          <BtnLabel>{t('wizardSaveContinue')}</BtnLabel>
          <Icon name="arrowRight" size={19} color="#fff" />
        </PrimaryButton>
        <Pressable
          onPress={() => { haptics.tap(); onSkip(); }}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
        >
          <Text style={[styles.skipText, { color: colorTheme.ink2 }]}>{t('wizardSkipForNow')}</Text>
        </Pressable>
      </View>

      <AddCategoryModal
        visible={adding}
        kind="expense"
        onClose={() => setAdding(false)}
        onCreated={(id) => {
          setSelected((prev) => new Set(prev).add(id));
          setAdding(false);
        }}
      />
    </ScrollView>
  );
}

function Body2({ children, color }: { children: React.ReactNode; color: string }) {
  return <Text style={{ fontFamily: uiFont(500), fontSize: 13, color, lineHeight: 18 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  incomeCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: 8, borderRadius: radius.md, borderWidth: 1 },
  rm: { fontFamily: numFont(600), fontSize: 20 },
  incomeInput: { flex: 1, fontFamily: numFont(700), fontSize: 26, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: radius.sm, borderWidth: 1.5, marginBottom: 8 },
  rowTapZone: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { flex: 1, fontFamily: uiFont(600), fontSize: 14.5 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 8 },
  rmSmall: { fontFamily: numFont(600), fontSize: 13 },
  amountInput: { width: 64, fontFamily: numFont(700), fontSize: 15, textAlign: 'right', paddingVertical: 6 },
  iconBtn: { padding: 4 },
  editPanel: { padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, gap: spacing.sm, marginTop: -4, marginBottom: 8 },
  editInput: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: uiFont(600), fontSize: 14 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: { width: 38, height: 38, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  editActionText: { fontFamily: uiFont(700), fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed' },
  addRowText: { fontFamily: uiFont(700), fontSize: 13.5 },
  footer: { marginTop: spacing.xl, gap: spacing.sm },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipPressed: { opacity: 0.55 },
  skipText: { fontFamily: uiFont(600), fontSize: 13.5 },
});
