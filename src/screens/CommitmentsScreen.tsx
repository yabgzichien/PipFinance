// src/screens/CommitmentsScreen.tsx
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountLinkField } from '../components/AccountLinkField';
import { CurrencyChip } from '../components/CurrencyChip';
import { Icon } from '../components/Icon';
import { Amount, BtnLabel, BubbleText, Card, CategoryChip, Eyebrow, PipSays, PrimaryButton, TopBar } from '../components/ui';
import { getActiveCurrencies } from '../db/currencyRepo';
import { listFxRates } from '../db/fxRepo';
import { DEFAULT_EXPENSE_ID } from '../data/categories';
import { currentMonthKey } from '../lib/budget';
import { computeCommitmentRecord } from '../lib/commitmentRecord';
import { occurrenceMyr, type Commitment, type CommitmentKind, type CommitmentOccurrence } from '../lib/commitments';
import { BASE_CURRENCY, decimalsFor, isMultiCurrency } from '../lib/currency';
import { rateFor, ratesFromCache } from '../lib/fx';
import { monthLabel, shortDate } from '../lib/dates';
import { todayISO } from '../lib/duplicates';
import { fmt, fmtMoney } from '../lib/format';
import { RECEIVABLE_CLS } from '../lib/networth';
import { confirmAction } from '../lib/platformAlert';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { colors, numFont, radius, uiFont } from '../theme';

const GREEN = '#1f8a5b';
const RED = '#c5402f';
const AMBER = '#a3791f';

function statusColor(o: CommitmentOccurrence, overdue: boolean, colorTheme: ReturnType<typeof useThemeColors>): string {
  if (o.status === 'paid') return GREEN;
  if (o.status === 'late') return AMBER;
  if (o.status === 'skipped') return colorTheme.ink3;
  return overdue ? RED : colorTheme.ink3;
}

function statusLabel(o: CommitmentOccurrence, overdue: boolean, isZh: boolean): string {
  if (o.status === 'paid') return isZh ? '已按时支付' : 'Paid on time';
  if (o.status === 'late') return isZh ? '已逾期支付' : 'Paid late';
  if (o.status === 'skipped') return isZh ? '已跳过' : 'Skipped';
  return overdue ? (isZh ? '已逾期' : 'Overdue') : (isZh ? `到期日 ${shortDate(o.dueDate)}` : `Due ${shortDate(o.dueDate)}`);
}

/**
 * The monthly todo list for recurring commitments (bills + DCA investments): everything
 * overdue, then everything due in the month being viewed, each a tap-to-pay checkbox row.
 */
export function CommitmentsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { t, formatMonthLabel, isZh } = useLanguage();
  const {
    commitments,
    commitmentOccurrences,
    accounts,
    payCommitment,
    unpayCommitment,
    skipCommitment,
    previewCommitmentMatch,
  } = useAppData();

  const [activeCurrencies, setActiveCurrencies] = useState<string[]>([BASE_CURRENCY]);
  const [rates, setRates] = useState<Record<string, number>>({});

  React.useEffect(() => {
    (async () => {
      const [active, fx] = await Promise.all([getActiveCurrencies(), listFxRates()]);
      setActiveCurrencies(active);
      setRates(ratesFromCache(fx));
    })();
  }, []);

  const today = useMemo(() => todayISO(), []);
  const [viewMonth, setViewMonth] = useState(() => currentMonthKey());
  const [editing, setEditing] = useState<Commitment | 'new' | null>(null);
  const [actionsFor, setActionsFor] = useState<CommitmentOccurrence | null>(null);

  const commitmentById = useMemo(() => new Map(commitments.map((c) => [c.id, c])), [commitments]);

  const overdue = useMemo(
    () =>
      commitmentOccurrences
        .filter((o) => o.status === 'scheduled' && o.dueDate < today)
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
    [commitmentOccurrences, today]
  );
  const overdueIds = useMemo(() => new Set(overdue.map((o) => o.id)), [overdue]);

  const thisMonth = useMemo(
    () =>
      commitmentOccurrences
        .filter((o) => o.month === viewMonth && !overdueIds.has(o.id))
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
    [commitmentOccurrences, viewMonth, overdueIds]
  );

  const monthTotal =
    thisMonth.reduce((s, o) => {
      const c = commitmentById.get(o.commitmentId);
      const fx = o.fxRate ?? (c && c.currency !== BASE_CURRENCY ? rateFor(rates, c.currency) : 1) ?? 1;
      return s + occurrenceMyr(o.amount, fx);
    }, 0) +
    overdue.reduce((s, o) => {
      const c = commitmentById.get(o.commitmentId);
      const fx = o.fxRate ?? (c && c.currency !== BASE_CURRENCY ? rateFor(rates, c.currency) : 1) ?? 1;
      return s + occurrenceMyr(o.amount, fx);
    }, 0);
  const unpaidCount = thisMonth.filter((o) => o.status === 'scheduled').length + overdue.length;

  const record = useMemo(() => computeCommitmentRecord(commitmentOccurrences), [commitmentOccurrences]);

  const months = useMemo(() => {
    const set = new Set(commitmentOccurrences.map((o) => o.month));
    set.add(currentMonthKey());
    return [...set].sort();
  }, [commitmentOccurrences]);
  const monthIdx = months.indexOf(viewMonth);

  const handleToggle = async (o: CommitmentOccurrence) => {
    if (o.status === 'paid' || o.status === 'late') {
      if (o.txnCreated) {
        confirmAction(
          isZh ? '撤销此笔支付？' : 'Undo this payment?',
          isZh ? '这将删除由此自动创建的交易记录，并恢复账户扣款余额。' : 'This removes the transaction it created and restores the account balance it moved.',
          isZh ? '撤销' : 'Undo',
          () => unpayCommitment(o.id)
        );
      } else {
        await unpayCommitment(o.id);
      }
      return;
    }
    if (o.status !== 'scheduled') return;

    const match = previewCommitmentMatch(o.id);
    const c = commitmentById.get(o.commitmentId);
    if (match && c) {
      confirmAction(
        isZh ? '检测到匹配交易' : 'Found a matching transaction',
        isZh
          ? `在 ${shortDate(match.date ?? match.createdAt)} 发现 ${match.merchantRaw || c.label} · RM ${fmt(match.amount)}。是否关联至此账单，而不是创建新流水？`
          : `${match.merchantRaw || c.label} · RM ${fmt(match.amount)} on ${shortDate(match.date ?? match.createdAt)}. Link it to this bill instead of logging a new one?`,
        isZh ? '关联交易' : 'Link it',
        async () => { await payCommitment(o.id); }
      );
    } else {
      await payCommitment(o.id);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colorTheme.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar
          title={isZh ? '定期支出与定投' : 'Recurring'}
          onBack={onBack}
          right={
            <Pressable onPress={() => setEditing('new')} hitSlop={8} accessibilityLabel="Add a recurring commitment">
              <Icon name="plus" size={20} color={theme.accent} stroke={2.4} />
            </Pressable>
          }
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {commitments.length === 0 ? (
          <>
            <PipSays expr="idle">
              <BubbleText>
                {isZh
                  ? '设置定期账单或每月定投，我会在此处提醒您并生成待办清单。'
                  : 'Set up a bill or a monthly investment and I will remind you and keep the todo list here.'}
              </BubbleText>
            </PipSays>
            <Card style={{ padding: 26, alignItems: 'center', marginTop: 14 }}>
              <Text style={[styles.emptyTitle, { color: colorTheme.ink }]}>{isZh ? '暂无定期项目' : 'Nothing set up yet'}</Text>
              <Text style={[styles.emptySub, { color: colorTheme.ink2 }]}>
                {isZh
                  ? '车贷、房租、话费套餐或每月固定定投 — 添加一次即可按期打勾完成。'
                  : "Car installments, telco bills, or a fixed monthly amount into savings — add it once and tick it off each time it's paid."}
              </Text>
              <View style={{ marginTop: 16, alignSelf: 'stretch' }}>
                <PrimaryButton onPress={() => setEditing('new')} height={48}>
                  <Icon name="plus" size={17} color="#fff" stroke={2.4} />
                  <BtnLabel>{isZh ? '添加定期项目' : 'Add a commitment'}</BtnLabel>
                </PrimaryButton>
              </View>
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.totalCard}>
              <Eyebrow>
                {unpaidCount === 0
                  ? (isZh ? '本月已全部付清' : 'All caught up')
                  : (isZh ? `本月剩余 ${unpaidCount} 项待付` : `${unpaidCount} left this month`)}
              </Eyebrow>
              <Amount value={monthTotal} size={28} weight={700} color={theme.accent} />
              {record.total > 0 && (
                <Text style={[styles.recordLine, { color: colorTheme.ink2 }]}>
                  {isZh
                    ? `按时支付率 ${Math.round(record.onTimeRatio * 100)}%（${record.onTime} / ${record.total}）`
                    : `Paid on time ${Math.round(record.onTimeRatio * 100)}% of the time (${record.onTime} of ${record.total})`}
                </Text>
              )}
            </Card>

            {overdue.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: RED }]}>{isZh ? '已逾期' : 'Overdue'}</Text>
                <Card style={{ overflow: 'hidden' }}>
                  {overdue.map((o, i) => (
                    <OccurrenceRow
                      key={o.id}
                      occurrence={o}
                      commitment={commitmentById.get(o.commitmentId)}
                      overdue
                      divider={i > 0}
                      onToggle={() => handleToggle(o)}
                      onOpenActions={() => setActionsFor(o)}
                    />
                  ))}
                </Card>
              </>
            )}

            <View style={styles.monthNav}>
              <Pressable
                onPress={() => monthIdx > 0 && setViewMonth(months[monthIdx - 1])}
                disabled={monthIdx <= 0}
                hitSlop={8}
                style={{ opacity: monthIdx <= 0 ? 0.3 : 1 }}
              >
                <Icon name="chevronLeft" size={18} color={colorTheme.ink2} />
              </Pressable>
              <Text style={[styles.monthLabel, { color: colorTheme.ink }]}>
                {formatMonthLabel(viewMonth, true)}
              </Text>
              <Pressable
                onPress={() => monthIdx < months.length - 1 && setViewMonth(months[monthIdx + 1])}
                disabled={monthIdx >= months.length - 1}
                hitSlop={8}
                style={{ opacity: monthIdx >= months.length - 1 ? 0.3 : 1 }}
              >
                <Icon name="chevronRight" size={18} color={colorTheme.ink2} />
              </Pressable>
            </View>

            {thisMonth.length === 0 ? (
              <Card style={{ padding: 20, alignItems: 'center' }}>
                <Text style={[styles.emptySub, { color: colorTheme.ink2 }]}>
                  {isZh ? '本月暂无到期项目。' : 'Nothing due this month.'}
                </Text>
              </Card>
            ) : (
              <Card style={{ overflow: 'hidden' }}>
                {thisMonth.map((o, i) => (
                  <OccurrenceRow
                    key={o.id}
                    occurrence={o}
                    commitment={commitmentById.get(o.commitmentId)}
                    overdue={false}
                    divider={i > 0}
                    onToggle={() => handleToggle(o)}
                    onOpenActions={() => setActionsFor(o)}
                  />
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <CommitmentActionsSheet
        occurrence={actionsFor}
        commitment={actionsFor ? commitmentById.get(actionsFor.commitmentId) ?? null : null}
        onClose={() => setActionsFor(null)}
        onSkip={async () => {
          if (actionsFor) await skipCommitment(actionsFor.id);
          setActionsFor(null);
        }}
        onEdit={(c) => {
          setActionsFor(null);
          setEditing(c);
        }}
      />

      <CommitmentEditorModal
        target={editing}
        accounts={accounts}
        activeCurrencies={activeCurrencies}
        rates={rates}
        visible={editing !== null}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

function OccurrenceRow({
  occurrence,
  commitment,
  overdue,
  divider,
  onToggle,
  onOpenActions,
}: {
  occurrence: CommitmentOccurrence;
  commitment: Commitment | undefined;
  overdue: boolean;
  divider: boolean;
  onToggle: () => void;
  onOpenActions: () => void;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const checked = occurrence.status === 'paid' || occurrence.status === 'late';
  const skipped = occurrence.status === 'skipped';

  return (
    <View style={[styles.row, divider && [styles.divider, { borderTopColor: colorTheme.line2 }]]}>
      <Pressable
        onPress={onToggle}
        disabled={skipped}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          style={[
            styles.check,
            { borderColor: checked ? statusColor(occurrence, overdue, colorTheme) : colorTheme.line, backgroundColor: colorTheme.surface },
            checked && { backgroundColor: statusColor(occurrence, overdue, colorTheme), borderColor: statusColor(occurrence, overdue, colorTheme) },
          ]}
        >
          {checked && <Icon name="check" size={13} color={colors.onAccent} stroke={2.6} />}
        </View>
      </Pressable>

      <Pressable onPress={onOpenActions} style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: colorTheme.ink }]} numberOfLines={1}>
          {commitment?.label ?? (isZh ? '定期项目' : 'Commitment')}
          {commitment?.kind === 'investment' ? ' · DCA' : ''}
        </Text>
        <Text style={[styles.rowSub, { color: statusColor(occurrence, overdue, colorTheme) }]}>
          {statusLabel(occurrence, overdue, isZh)}
        </Text>
      </Pressable>

      <Text style={[styles.occurrenceAmount, { color: colorTheme.ink }]}>
        {fmtMoney(occurrence.paidAmount ?? occurrence.amount, commitment?.currency ?? BASE_CURRENCY)}
      </Text>
      <Pressable onPress={onOpenActions} hitSlop={8} accessibilityLabel="More">
        <Icon name="chevronRight" size={16} color={colorTheme.ink3} />
      </Pressable>
    </View>
  );
}

function CommitmentActionsSheet({
  occurrence,
  commitment,
  onClose,
  onSkip,
  onEdit,
}: {
  occurrence: CommitmentOccurrence | null;
  commitment: Commitment | null;
  onClose: () => void;
  onSkip: () => void;
  onEdit: (c: Commitment) => void;
}) {
  const insets = useSafeAreaInsets();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const { archiveCommitmentEntry, deleteCommitmentEntry } = useAppData();
  if (!occurrence || !commitment) return <Modal visible={false} transparent />;

  const confirmDelete = () => {
    confirmAction(
      isZh ? '删除此定期项目？' : 'Delete this commitment?',
      isZh
        ? `确认删除“${commitment.label}”以及所有关联待办？已自动生成的历史流水将继续保留，仅删除此定期提醒与后续待办。`
        : `Remove "${commitment.label}" and every occurrence it generated? Transactions it created stay in your Activity — this only removes the recurring schedule and todo entries.`,
      isZh ? '删除' : 'Delete',
      async () => {
        await deleteCommitmentEntry(commitment.id);
        onClose();
      }
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <Text style={[styles.sheetTitle, { color: colorTheme.ink }]}>{commitment.label}</Text>

        <ActionRow icon="pencil" label={isZh ? '编辑' : 'Edit'} onPress={() => onEdit(commitment)} />
        {occurrence.status === 'scheduled' && (
          <ActionRow icon="x" label={isZh ? '跳过本月' : 'Skip this month'} onPress={onSkip} />
        )}
        <ActionRow
          icon="clock"
          label={isZh ? '归档（停止后续生成）' : 'Archive (stop future occurrences)'}
          onPress={async () => {
            await archiveCommitmentEntry(commitment.id);
            onClose();
          }}
        />
        <ActionRow icon="trash" label={isZh ? '删除' : 'Delete'} danger onPress={confirmDelete} />
      </View>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const colorTheme = useThemeColors();
  const color = danger ? '#b3261e' : colorTheme.ink;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: colorTheme.surface2 }]}>
      <Icon name={icon} size={18} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Create or edit a recurring commitment. `target` is `'new'`, a `Commitment`, or `null` (closed). */
function CommitmentEditorModal({
  target,
  accounts,
  activeCurrencies,
  rates,
  visible,
  onClose,
}: {
  target: Commitment | 'new' | null;
  accounts: { id: string; name: string; kind: string; cls: string; archived: boolean; symbol?: string | null; ticker?: string | null; quantity?: number | null; cost?: number | null; sub?: string | null; icon?: string | null }[];
  activeCurrencies: string[];
  rates: Record<string, number>;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();
  const { categories, addCommitmentEntry, updateCommitmentEntry } = useAppData();

  const editingExisting = target && target !== 'new' ? target : null;

  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<CommitmentKind>('expense');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<string>(BASE_CURRENCY);
  const [dueDayText, setDueDayText] = useState('1');
  const [categoryId, setCategoryId] = useState<string>(DEFAULT_EXPENSE_ID);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);

  const key = editingExisting?.id ?? (target === 'new' ? 'new' : null);
  React.useEffect(() => {
    if (target === 'new') {
      setLabel('');
      setKind('expense');
      setAmountText('');
      setCurrency(BASE_CURRENCY);
      setDueDayText('1');
      setCategoryId(DEFAULT_EXPENSE_ID);
      setFromAccountId(accounts.find((a) => !a.archived && a.kind === 'asset' && a.cls !== RECEIVABLE_CLS)?.id ?? null);
      setToAccountId(null);
    } else if (editingExisting) {
      setLabel(editingExisting.label);
      setKind(editingExisting.kind);
      setCurrency(editingExisting.currency ?? BASE_CURRENCY);
      const dec = decimalsFor(editingExisting.currency ?? BASE_CURRENCY);
      setAmountText(dec === 0 ? String(Math.round(editingExisting.amount)) : editingExisting.amount.toFixed(dec));
      setDueDayText(String(editingExisting.dueDay));
      setCategoryId(editingExisting.categoryId ?? DEFAULT_EXPENSE_ID);
      setFromAccountId(editingExisting.fromAccountId);
      setToAccountId(editingExisting.toAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!visible) return <Modal visible={false} transparent />;

  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  const investmentAccounts = accounts.filter((a) => !a.archived && a.cls === 'investments');
  const fromAccounts = accounts.filter((a) => !a.archived && a.kind === 'asset' && a.cls !== RECEIVABLE_CLS);

  const amount = Math.max(0, Number(amountText.replace(/[^0-9.]/g, '')) || 0);
  const dueDay = Math.min(31, Math.max(1, parseInt(dueDayText, 10) || 1));
  const canSave = label.trim().length > 0 && amount > 0 && (kind === 'expense' || toAccountId !== null);

  const save = async () => {
    if (!canSave) return;
    if (editingExisting) {
      await updateCommitmentEntry(editingExisting.id, {
        label: label.trim(),
        amount,
        dueDay,
        categoryId: kind === 'investment' ? null : categoryId,
        fromAccountId,
        toAccountId: kind === 'investment' ? toAccountId : null,
      });
    } else {
      await addCommitmentEntry({
        label: label.trim(),
        kind,
        amount,
        dueDay,
        categoryId,
        fromAccountId,
        toAccountId,
        currency,
      });
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.sheet, { backgroundColor: colorTheme.bg, paddingBottom: insets.bottom + 18 }]}
      >
        <View style={[styles.handle, { backgroundColor: colorTheme.line }]} />
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: colorTheme.ink }]}>
            {editingExisting
              ? (isZh ? '编辑定期项目' : 'Edit commitment')
              : (isZh ? '新建定期支出 / 定投' : 'New recurring commitment')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Icon name="x" size={20} color={colorTheme.ink2} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!editingExisting && (
            <>
              <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '类型' : 'Type'}</Text>
              <View style={[styles.toggle, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line2 }]}>
                {(['expense', 'investment'] as CommitmentKind[]).map((k) => {
                  const on = kind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setKind(k)}
                      style={[styles.toggleBtn, on && { backgroundColor: colorTheme.surface }]}
                    >
                      <Text style={[styles.toggleText, { color: colorTheme.ink2 }, on && { color: colorTheme.ink }]}>
                        {k === 'expense' ? (isZh ? '定期账单' : 'Bill') : (isZh ? '定期定投 (DCA)' : 'Investment (DCA)')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.fieldLabel, { color: colorTheme.ink2, marginTop: 16 }]}>
            {kind === 'investment'
              ? (isZh ? '定投名称（例如“标普500 定投”）' : 'Name (e.g. "S&P 500 DCA")')
              : (isZh ? '账单名称（例如“话费套餐”）' : 'Name (e.g. "Maxis Postpaid")')}
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={kind === 'investment' ? (isZh ? '每月定投项目' : 'Monthly investment') : (isZh ? '账单名称' : 'Bill name')}
            placeholderTextColor={colorTheme.ink3}
            style={[styles.textInput, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line, color: colorTheme.ink }]}
          />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '金额' : 'Amount'}</Text>
              <View style={[styles.amountRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
                {isMultiCurrency(activeCurrencies) && !editingExisting ? (
                  <CurrencyChip value={currency} active={activeCurrencies} onChange={setCurrency} />
                ) : (
                  <Text style={[styles.rmPrefix, { color: colorTheme.ink2 }]}>{currency === BASE_CURRENCY ? 'RM' : currency}</Text>
                )}
                <TextInput
                  value={amountText}
                  onChangeText={(t) => setAmountText(decimalsFor(currency) === 0 ? t.replace(/[^0-9]/g, '') : t)}
                  keyboardType={decimalsFor(currency) === 0 ? 'number-pad' : 'decimal-pad'}
                  selectTextOnFocus
                  style={[styles.amountInput, { color: colorTheme.ink }]}
                />
              </View>
              {currency !== BASE_CURRENCY && rateFor(rates, currency) != null && (
                <Text style={[styles.fxHint, { color: colorTheme.ink3 }]}>≈ {fmtMoney(amount * (rateFor(rates, currency) ?? 1), BASE_CURRENCY)}</Text>
              )}
            </View>
            <View style={{ width: 100 }}>
              <Text style={[styles.fieldLabel, { color: colorTheme.ink2 }]}>{isZh ? '每月到期日' : 'Due day'}</Text>
              <TextInput
                value={dueDayText}
                onChangeText={setDueDayText}
                keyboardType="number-pad"
                selectTextOnFocus
                style={[styles.textInput, { color: colorTheme.ink, backgroundColor: colorTheme.surface, borderColor: colorTheme.line, textAlign: 'center' }]}
              />
            </View>
          </View>

          {kind === 'expense' && (
            <>
              <Text style={[styles.fieldLabel, { color: colorTheme.ink2, marginTop: 18 }]}>{isZh ? '支出分类' : 'Category'}</Text>
              <View style={styles.grid}>
                {expenseCategories.map((c) => (
                  <View key={c.id} style={styles.gridCell}>
                    <CategoryChip category={c} selected={categoryId === c.id} suggested={false} onPress={() => setCategoryId(c.id)} />
                  </View>
                ))}
              </View>
            </>
          )}

          {kind === 'investment' && (
            <View style={{ marginTop: 18 }}>
              {investmentAccounts.length === 0 ? (
                <Text style={[styles.emptySub, { color: colorTheme.ink2 }]}>
                  {isZh ? '请先在净资产中添加投资账户或持仓，然后再来设置定投计划。' : 'Add an investment holding or account in Net Worth first, then come back to set up the DCA.'}
                </Text>
              ) : (
                <AccountLinkField
                  accounts={investmentAccounts as any}
                  selectedId={toAccountId}
                  onSelect={setToAccountId}
                  label={isZh ? '转入投资账户' : 'Invest into'}
                  required
                />
              )}
            </View>
          )}

          <View style={{ marginTop: 18 }}>
            <AccountLinkField
              accounts={fromAccounts as any}
              selectedId={fromAccountId}
              onSelect={setFromAccountId}
              label={isZh ? '扣款账户' : 'Pay from'}
            />
          </View>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton onPress={save} height={52} disabled={!canSave}>
              <Icon name="check" size={18} color="#fff" stroke={2.4} />
              <BtnLabel>{editingExisting ? (isZh ? '保存修改' : 'Save changes') : (isZh ? '添加定期项目' : 'Add commitment')}</BtnLabel>
            </PrimaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  totalCard: { padding: 18, gap: 6, marginTop: 14 },
  recordLine: { fontFamily: uiFont(500), fontSize: 12, marginTop: 4 },
  sectionLabel: { fontFamily: uiFont(700), fontSize: 12.5, marginTop: 20, marginBottom: 8, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 22, marginBottom: 10 },
  monthLabel: { fontFamily: uiFont(700), fontSize: 15, minWidth: 130, textAlign: 'center' },
  emptyTitle: { fontFamily: uiFont(700), fontSize: 17 },
  emptySub: { fontFamily: uiFont(500), fontSize: 13.5, marginTop: 6, textAlign: 'center', lineHeight: 19 },

  divider: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 13 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: uiFont(700), fontSize: 14.5 },
  rowSub: { fontFamily: uiFont(600), fontSize: 12, marginTop: 2 },
  occurrenceAmount: { fontFamily: numFont(700), fontSize: 15 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,32,24,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { flex: 1, fontFamily: uiFont(700), fontSize: 18 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  actionText: { fontFamily: uiFont(600), fontSize: 15 },

  fieldLabel: { fontFamily: uiFont(600), fontSize: 12.5, marginBottom: 8 },
  textInput: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontFamily: uiFont(600), fontSize: 15 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 4 },
  rmPrefix: { fontFamily: numFont(600), fontSize: 16 },
  amountInput: { flex: 1, paddingVertical: 9, fontFamily: numFont(700), fontSize: 18 },
  fxHint: { fontFamily: uiFont(500), fontSize: 11.5, marginTop: 4, marginLeft: 2 },

  toggle: { flexDirection: 'row', borderRadius: 999, padding: 4, borderWidth: 1 },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 999 },
  toggleText: { fontFamily: uiFont(600), fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  gridCell: {},
});
