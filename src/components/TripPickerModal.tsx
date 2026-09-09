import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n';
import { formatRangeLabel, type DateRange } from '../lib/dateRange';
import { createOpeningGuard } from '../lib/openingGuard';
import { createTripForOpening, tripsForPicker } from '../lib/tripPicker';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { radius, spacing, uiFont } from '../theme';
import { DateRangeSheet } from './DateRangeSheet';
import { Icon } from './Icon';
import { TripGlyph } from './TripBadge';
import { TripIconPickerSheet } from './TripIconPickerSheet';

/**
 * A compact optional-trip selector for a transaction or a multi-select Activity action.
 * Current trips stay front-and-centre; archived trips are available for a late charge only
 * when the user explicitly expands them.
 */
export function TripPickerModal({
  visible,
  selectedId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (tripId: string | null) => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t, isZh } = useLanguage();
  const { trips, addTrip } = useAppData();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [dates, setDates] = useState<DateRange>({ start: null, end: null });
  const [pickingDates, setPickingDates] = useState(false);
  const [pickingIcon, setPickingIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  const openingGuard = useRef(createOpeningGuard());

  useLayoutEffect(() => {
    if (visible) {
      openingGuard.current.open();
      setSaving(false);
    } else {
      openingGuard.current.close();
    }
    return () => {
      openingGuard.current.close();
    };
  }, [visible]);

  const offeredTrips = useMemo(() => tripsForPicker(trips, showArchived), [trips, showArchived]);
  const archivedCount = useMemo(() => trips.filter((trip) => trip.archived).length, [trips]);

  const close = () => {
    openingGuard.current.close();
    setCreating(false);
    setName('');
    setIcon(null);
    setDates({ start: null, end: null });
    setShowArchived(false);
    onClose();
  };

  const choose = (tripId: string | null) => {
    onSelect(tripId);
    close();
  };

  const createAndChoose = async () => {
    const trimmed = name.trim();
    const startDate = dates.start;
    const endDate = dates.end;
    if (!trimmed || !startDate || !endDate || saving) return;
    setSaving(true);
    await createTripForOpening(
      openingGuard.current,
      () => addTrip(trimmed, startDate, endDate, icon),
      choose,
      () => setSaving(false)
    );
  };

  if (!visible) return <Modal visible={false} transparent />;

  const dateLabel = formatRangeLabel(dates, isZh);

  return (
    <>
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoider} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
          <View style={styles.head}>
            <Text style={[styles.title, { color: colorTheme.ink }]}>{t('addToTrip')}</Text>
            <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Icon name="x" size={20} color={colorTheme.ink2} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={() => choose(null)}
              style={[styles.row, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, selectedId == null && { borderColor: theme.accent, backgroundColor: theme.accentTint }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedId == null }}
              accessibilityLabel={t('noTrip')}
            >
              <Icon name="x" size={18} color={selectedId == null ? theme.accent : colorTheme.ink2} />
              <Text style={[styles.rowLabel, { color: colorTheme.ink }]}>{t('noTrip')}</Text>
              {selectedId == null && <Icon name="check" size={18} color={theme.accent} stroke={2.5} />}
            </Pressable>

            {offeredTrips.map((trip) => {
              const selected = trip.id === selectedId;
              return (
                <Pressable
                  key={trip.id}
                  onPress={() => choose(trip.id)}
                  style={[styles.row, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }, selected && { borderColor: theme.accent, backgroundColor: theme.accentTint }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={trip.name}
                >
                  <TripGlyph trip={trip} size={20} color={selected ? theme.accent : colorTheme.ink2} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowLabel, { color: colorTheme.ink }]} numberOfLines={1}>{trip.name}</Text>
                    {trip.archived && <Text style={[styles.archived, { color: colorTheme.ink2 }]}>{t('archivedTrips')}</Text>}
                  </View>
                  {selected && <Icon name="check" size={18} color={theme.accent} stroke={2.5} />}
                </Pressable>
              );
            })}

            {!creating ? (
              <Pressable onPress={() => setCreating(true)} style={[styles.createRow, { borderColor: theme.accent, backgroundColor: theme.accentTint }]} accessibilityRole="button" accessibilityLabel={t('newTrip')}>
                <Icon name="plus" size={18} color={theme.accent} />
                <Text style={[styles.createLabel, { color: theme.accent }]}>{t('newTrip')}</Text>
              </Pressable>
            ) : (
              <View style={[styles.createForm, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
                <View style={[styles.nameField, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t('tripNamePlaceholder')}
                    placeholderTextColor={colorTheme.ink3}
                    style={[styles.input, styles.nameInput, { color: colorTheme.ink }]}
                    maxLength={60}
                    autoFocus
                    accessibilityLabel={t('newTrip')}
                  />
                  <Pressable
                    onPress={() => setPickingIcon(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('tripIconChange')}
                    style={({ pressed }) => [styles.nameIconButton, { opacity: pressed ? 0.55 : 1 }]}
                  >
                    <TripGlyph trip={{ name, icon }} size={22} color={theme.accent} />
                  </Pressable>
                </View>
                <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{t('tripDatesRequired')}</Text>
                <Pressable
                  onPress={() => setPickingDates(true)}
                  style={[styles.dateRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}
                  accessibilityRole="button"
                  accessibilityLabel={dateLabel ?? t('addDates')}
                >
                  <Icon name="calendar" size={16} color={colorTheme.ink2} />
                  <Text style={[styles.dateText, { color: dateLabel ? colorTheme.ink : colorTheme.ink3 }]} numberOfLines={1}>
                    {dateLabel ?? t('addDates')}
                  </Text>
                </Pressable>
                <View style={styles.createActions}>
                  <Pressable onPress={() => { setCreating(false); setName(''); setIcon(null); setDates({ start: null, end: null }); }} style={styles.actionButton} disabled={saving} accessibilityRole="button" accessibilityLabel={t('cancel')}>
                    <Text style={[styles.actionLabel, { color: colorTheme.ink2 }]}>{t('cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={() => { void createAndChoose(); }} style={styles.actionButton} disabled={saving || !name.trim() || !dates.start || !dates.end} accessibilityRole="button" accessibilityLabel={t('newTrip')}>
                    <Text style={[styles.actionLabel, { color: !name.trim() || !dates.start || !dates.end ? colorTheme.ink3 : theme.accent }]}>{saving ? (isZh ? '保存中…' : 'Saving…') : t('save')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {archivedCount > 0 && (
              <Pressable
                onPress={() => setShowArchived((current) => !current)}
                style={styles.archivedToggle}
                accessibilityRole="button"
                accessibilityState={{ expanded: showArchived }}
                accessibilityLabel={t('showArchived')}
              >
                <Icon name={showArchived ? 'chevronUp' : 'chevronDown'} size={15} color={colorTheme.ink2} />
                <Text style={[styles.archivedToggleLabel, { color: colorTheme.ink2 }]}>{t('showArchived')} · {archivedCount}</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <DateRangeSheet
      visible={pickingDates}
      value={dates}
      onApply={setDates}
      onClose={() => setPickingDates(false)}
    />
    <TripIconPickerSheet
      visible={pickingIcon}
      trip={{
        id: 'new-trip', name, icon,
        createdAt: '', archived: false,
        startDate: dates.start, endDate: dates.end,
      }}
      onClose={() => setPickingIcon(false)}
      onPick={(nextIcon) => {
        setIcon(nextIcon);
        setPickingIcon(false);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 18, paddingTop: 10, maxHeight: '82%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: uiFont(700), fontSize: 18 },
  closeButton: { width: 44, height: 44, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 13, marginBottom: 8 },
  rowLabel: { flex: 1, fontFamily: uiFont(700), fontSize: 14.5 },
  archived: { fontFamily: uiFont(600), fontSize: 11.5, marginTop: 2 },
  createRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, marginTop: 4 },
  createLabel: { fontFamily: uiFont(700), fontSize: 14 },
  createForm: { borderWidth: 1, borderRadius: radius.sm, padding: 12, marginTop: 4, gap: 10 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, fontFamily: uiFont(600), fontSize: 14.5 },
  nameField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, overflow: 'hidden' },
  nameInput: { flex: 1, minWidth: 0, borderWidth: 0 },
  nameIconButton: { width: 44, height: 44, marginRight: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: uiFont(700), fontSize: 12.5 },
  dateRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md },
  dateText: { flex: 1, minWidth: 0, fontFamily: uiFont(600), fontSize: 14.5 },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  actionButton: { minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: uiFont(700), fontSize: 13.5 },
  archivedToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 },
  archivedToggleLabel: { fontFamily: uiFont(700), fontSize: 12.5 },
});
