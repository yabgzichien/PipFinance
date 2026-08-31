// src/components/GlossaryVisualGuide.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { useLanguage } from '../i18n';
import { radius, uiFont } from '../theme';
import { Icon } from './Icon';

interface VisualProps {
  visualKey?: string;
}

export function GlossaryVisualGuide({ visualKey }: VisualProps) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const { isZh } = useLanguage();

  if (!visualKey) return null;

  switch (visualKey) {
    case 'split_step_1':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.badgeRow}>
            <Text style={[styles.subtleBadge, { color: theme.accentInk, backgroundColor: theme.accentTint }]}>
              {isZh ? '示例：总账单 RM120.00' : 'Example: Bill RM120.00'}
            </Text>
          </View>

          {/* Mini Method Switcher */}
          <View style={[styles.methodBar, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <View style={[styles.methodPill, styles.methodPillActive, { backgroundColor: theme.accent }]}>
              <Text style={styles.methodTextActive}>{isZh ? '均摊' : 'Equal'}</Text>
            </View>
            <View style={styles.methodPill}>
              <Text style={[styles.methodText, { color: colorTheme.ink3 }]}>{isZh ? '份数' : 'Shares'}</Text>
            </View>
            <View style={styles.methodPill}>
              <Text style={[styles.methodText, { color: colorTheme.ink3 }]}>{isZh ? '指定金额' : 'Exact'}</Text>
            </View>
          </View>

          {/* Mini Friend Chips */}
          <View style={styles.chipRow}>
            <View style={[styles.miniChip, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Icon name="check" size={11} color={theme.accent} stroke={2.6} />
              <Text style={[styles.miniChipText, { color: theme.accentInk }]}>{isZh ? 'Alex (同行)' : 'Alex'}</Text>
            </View>
            <View style={[styles.miniChip, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Icon name="check" size={11} color={theme.accent} stroke={2.6} />
              <Text style={[styles.miniChipText, { color: theme.accentInk }]}>{isZh ? 'Sarah (同行)' : 'Sarah'}</Text>
            </View>
            <View style={[styles.miniChip, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Icon name="plus" size={11} color={colorTheme.ink3} stroke={2.2} />
              <Text style={[styles.miniChipText, { color: colorTheme.ink3 }]}>{isZh ? '添加更多' : 'Add name'}</Text>
            </View>
          </View>
        </View>
      );

    case 'split_step_2':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          {/* Include Self Toggle */}
          <View style={[styles.checkRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <View style={[styles.miniCheckbox, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
              <Icon name="check" size={11} color="#ffffff" stroke={3} />
            </View>
            <Text style={[styles.checkLabel, { color: colorTheme.ink }]}>
              {isZh ? '我也参与了此账单 (计入个人份)' : 'I was on this bill too (My share included)'}
            </Text>
          </View>

          {/* Mini Stepper Rows */}
          <View style={styles.stepperWrap}>
            <View style={[styles.stepperRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Text style={[styles.stepperName, { color: colorTheme.ink }]}>{isZh ? '您 (1 份)' : 'You (1 share)'}</Text>
              <Text style={[styles.stepperAmount, { color: theme.accentInk }]}>RM30.00</Text>
            </View>
            <View style={[styles.stepperRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Text style={[styles.stepperName, { color: colorTheme.ink }]}>{isZh ? 'Alex (2 份)' : 'Alex (2 shares)'}</Text>
              <View style={styles.stepperControls}>
                <View style={[styles.stepBtnSmall, { backgroundColor: colorTheme.surface2 }]}>
                  <Text style={[styles.stepBtnText, { color: colorTheme.ink2 }]}>−</Text>
                </View>
                <Text style={[styles.stepValueSmall, { color: colorTheme.ink }]}>2</Text>
                <View style={[styles.stepBtnSmall, { backgroundColor: colorTheme.surface2 }]}>
                  <Text style={[styles.stepBtnText, { color: colorTheme.ink2 }]}>+</Text>
                </View>
                <Text style={[styles.stepperAmount, { color: colorTheme.ink }]}>RM60.00</Text>
              </View>
            </View>
            <View style={[styles.stepperRow, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Text style={[styles.stepperName, { color: colorTheme.ink }]}>{isZh ? 'Sarah (1 份)' : 'Sarah (1 share)'}</Text>
              <Text style={[styles.stepperAmount, { color: colorTheme.ink }]}>RM30.00</Text>
            </View>
          </View>
        </View>
      );

    case 'split_step_3':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.splitResultHeader}>
            <Text style={[styles.splitResultTotal, { color: colorTheme.ink }]}>
              {isZh ? '总付款金额: RM120.00' : 'Total Paid: RM120.00'}
            </Text>
          </View>

          <View style={styles.splitCardsRow}>
            {/* Your Spend Card */}
            <View style={[styles.resultBox, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <View style={styles.resultBoxHead}>
                <Icon name="utensils" size={13} color={theme.accent} stroke={2.4} />
                <Text style={[styles.resultBoxTitle, { color: theme.accentInk }]}>
                  {isZh ? '个人支出' : 'Your Expense'}
                </Text>
              </View>
              <Text style={[styles.resultBoxNumber, { color: theme.accentInk }]}>RM30.00</Text>
              <Text style={[styles.resultBoxCaption, { color: theme.accentInk }]}>
                {isZh ? '计入月度预算' : 'Counts in budget'}
              </Text>
            </View>

            {/* Owed to You Card */}
            <View style={[styles.resultBox, { backgroundColor: colorTheme.amberTint, borderColor: colorTheme.amberSoft }]}>
              <View style={styles.resultBoxHead}>
                <Icon name="wallet" size={13} color={colorTheme.amber} stroke={2.4} />
                <Text style={[styles.resultBoxTitle, { color: colorTheme.amber }]}>
                  {isZh ? '待收应收' : 'Owed to You'}
                </Text>
              </View>
              <Text style={[styles.resultBoxNumber, { color: colorTheme.amber }]}>RM90.00</Text>
              <Text style={[styles.resultBoxCaption, { color: colorTheme.amber }]}>
                {isZh ? '计入净资产待结' : 'Asset in Net Worth'}
              </Text>
            </View>
          </View>
        </View>
      );

    case 'owed_step_1':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.flowRow}>
            <View style={[styles.flowStep, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Icon name="receipt" size={16} color={theme.accent} stroke={2.2} />
              <Text style={[styles.flowLabel, { color: colorTheme.ink }]}>{isZh ? '代付账单' : 'Paid for Group'}</Text>
              <Text style={[styles.flowSub, { color: colorTheme.ink3 }]}>RM120.00</Text>
            </View>
            <Icon name="arrowRight" size={14} color={colorTheme.ink3} stroke={2} />
            <View style={[styles.flowStep, { backgroundColor: colorTheme.amberTint, borderColor: colorTheme.amberSoft }]}>
              <Icon name="wallet" size={16} color={colorTheme.amber} stroke={2.2} />
              <Text style={[styles.flowLabel, { color: colorTheme.amber }]}>{isZh ? '待收应收款' : 'Owed Asset'}</Text>
              <Text style={[styles.flowSub, { color: colorTheme.amber }]}>+RM90.00</Text>
            </View>
          </View>
          <Text style={[styles.noteText, { color: colorTheme.ink2 }]}>
            {isZh
              ? '💡 朋友欠你的钱保留在净资产中，不会虚增单月支出。'
              : '💡 Friend shares stay as assets in your Net Worth, preventing expense spikes.'}
          </Text>
        </View>
      );

    case 'owed_step_2':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.actionChoiceRow}>
            <View style={[styles.choiceCard, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <View style={styles.choiceHeader}>
                <Icon name="check" size={13} color={theme.accent} stroke={2.6} />
                <Text style={[styles.choiceTitle, { color: theme.accentInk }]}>{isZh ? '还款 ➔ 结清' : 'Repaid ➔ Settle'}</Text>
              </View>
              <Text style={[styles.choiceDesc, { color: theme.accentInk }]}>
                {isZh ? '冲销应收款，现金入账，无重复收入' : 'Clears debt, adds cash, no double income'}
              </Text>
            </View>

            <View style={[styles.choiceCard, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <View style={styles.choiceHeader}>
                <Icon name="x" size={13} color={colorTheme.ink2} stroke={2.6} />
                <Text style={[styles.choiceTitle, { color: colorTheme.ink }]}>{isZh ? '无法收回 ➔ 核销' : 'Unpaid ➔ Write off'}</Text>
              </View>
              <Text style={[styles.choiceDesc, { color: colorTheme.ink2 }]}>
                {isZh ? '将无法追回的款项转为个人支出' : 'Converts uncollectible amount to expense'}
              </Text>
            </View>
          </View>
        </View>
      );

    case 'quick_add_step_1':
    case 'quick_add_step_2':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={[styles.typingBox, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <Text style={[styles.typingPrefix, { color: theme.accent }]}>✍️</Text>
            <Text style={[styles.typingText, { color: colorTheme.ink }]}>lunch 12, grab 18</Text>
          </View>

          <View style={styles.parsedItemsRow}>
            <View style={[styles.parsedBadge, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Icon name="utensils" size={12} color={theme.accent} stroke={2.4} />
              <Text style={[styles.parsedBadgeText, { color: theme.accentInk }]}>
                {isZh ? '午餐 RM12.00 (餐饮)' : 'Lunch RM12.00 (Food)'}
              </Text>
            </View>
            <View style={[styles.parsedBadge, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Icon name="car" size={12} color={colorTheme.ink2} stroke={2.4} />
              <Text style={[styles.parsedBadgeText, { color: colorTheme.ink2 }]}>
                {isZh ? '打车 RM18.00 (交通)' : 'Grab RM18.00 (Transport)'}
              </Text>
            </View>
          </View>
        </View>
      );

    case 'safe_income_visual':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.chartBarsWrap}>
            <View style={styles.barCol}>
              <View style={[styles.bar, { height: 42, backgroundColor: theme.accentSoft }]} />
              <Text style={[styles.barLabel, { color: colorTheme.ink3 }]}>M1</Text>
            </View>
            <View style={styles.barCol}>
              <View style={[styles.bar, { height: 60, backgroundColor: theme.accentSoft }]} />
              <Text style={[styles.barLabel, { color: colorTheme.ink3 }]}>M2</Text>
            </View>
            <View style={styles.barCol}>
              <View style={[styles.bar, { height: 28, backgroundColor: theme.accent }]} />
              <Text style={[styles.barLabel, { color: theme.accentInk, fontWeight: '700' }]}>M3</Text>
            </View>
            <View style={styles.barCol}>
              <View style={[styles.bar, { height: 52, backgroundColor: theme.accentSoft }]} />
              <Text style={[styles.barLabel, { color: colorTheme.ink3 }]}>M4</Text>
            </View>
          </View>

          <View style={[styles.floorLineCard, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
            <Icon name="shield" size={13} color={theme.accent} stroke={2.4} />
            <Text style={[styles.floorLineText, { color: theme.accentInk }]}>
              {isZh
                ? '安全底线（取保守低月）➔ 预算不落空，好月份自动变储蓄'
                : 'Safe Floor (Conservative low) ➔ Budget never fails, good months become savings'}
            </Text>
          </View>
        </View>
      );

    case 'committed_spend_visual':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={[styles.tierCard, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <View style={[styles.tierDot, { backgroundColor: colorTheme.red }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierTitle, { color: colorTheme.ink }]}>
                {isZh ? '固定支出 (Committed)' : 'Committed (Fixed)'}
              </Text>
              <Text style={[styles.tierDesc, { color: colorTheme.ink3 }]}>
                {isZh ? '房租、贷款分期（当月固定无法削减）' : 'Rent, loan instalments (Cannot cut this month)'}
              </Text>
            </View>
          </View>

          <View style={[styles.tierCard, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <View style={[styles.tierDot, { backgroundColor: colorTheme.amber }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierTitle, { color: colorTheme.ink }]}>
                {isZh ? '刚性支出 (Essential)' : 'Essential (Elastic)'}
              </Text>
              <Text style={[styles.tierDesc, { color: colorTheme.ink3 }]}>
                {isZh ? '基本伙食、日常交通（不可缺少但可压缩）' : 'Food, fuel (Necessary, but can compress)'}
              </Text>
            </View>
          </View>

          <View style={[styles.tierCard, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
            <View style={[styles.tierDot, { backgroundColor: theme.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierTitle, { color: colorTheme.ink }]}>
                {isZh ? '灵活支出 (Flexible)' : 'Flexible (Discretionary)'}
              </Text>
              <Text style={[styles.tierDesc, { color: colorTheme.ink3 }]}>
                {isZh ? '餐饮聚会、休闲娱乐（紧缩月份可直接砍掉）' : 'Dining out, leisure (Redirectable anytime)'}
              </Text>
            </View>
          </View>
        </View>
      );

    case 'card_direction_visual':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.actionChoiceRow}>
            <View style={[styles.choiceCard, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Text style={[styles.choiceTitle, { color: colorTheme.ink }]}>
                {isZh ? '💳 消费 (Adds to)' : '💳 Adds to debt'}
              </Text>
              <Text style={[styles.choiceDesc, { color: colorTheme.ink2 }]}>
                {isZh ? '刷卡买东西 ➔ 欠款增加' : 'Card purchase ➔ Increases what you owe'}
              </Text>
            </View>
            <View style={[styles.choiceCard, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Text style={[styles.choiceTitle, { color: theme.accentInk }]}>
                {isZh ? '💵 还款 (Pays down)' : '💵 Pays down debt'}
              </Text>
              <Text style={[styles.choiceDesc, { color: theme.accentInk }]}>
                {isZh ? '转账还账单 ➔ 欠款降低' : 'Bill payment ➔ Lowers card balance'}
              </Text>
            </View>
          </View>
        </View>
      );

    case 'net_worth_visual':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.equationWrap}>
            <View style={[styles.equationPill, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Text style={[styles.equationText, { color: theme.accentInk }]}>
                {isZh ? '资产 (现金/投资/待收款)' : 'Assets (Cash, Stocks, Owed)'}
              </Text>
            </View>
            <Text style={[styles.equationOp, { color: colorTheme.ink3 }]}>−</Text>
            <View style={[styles.equationPill, { backgroundColor: colorTheme.redTint, borderColor: colorTheme.redSoft }]}>
              <Text style={[styles.equationText, { color: colorTheme.red }]}>
                {isZh ? '负债 (贷款/信用卡欠款)' : 'Liabilities (Loans, Cards)'}
              </Text>
            </View>
            <Text style={[styles.equationOp, { color: colorTheme.ink3 }]}>=</Text>
            <View style={[styles.equationPill, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Text style={[styles.equationText, { color: colorTheme.ink, fontWeight: '700' }]}>
                {isZh ? '净资产 📈' : 'Net Worth 📈'}
              </Text>
            </View>
          </View>
        </View>
      );

    case 'net_cash_flow_visual':
      return (
        <View style={[styles.card, { backgroundColor: colorTheme.surface2, borderColor: colorTheme.line }]}>
          <View style={styles.equationWrap}>
            <View style={[styles.equationPill, { backgroundColor: theme.accentTint, borderColor: theme.accentSoft }]}>
              <Text style={[styles.equationText, { color: theme.accentInk }]}>
                {isZh ? '总收入 (+)' : 'Income (+)'}
              </Text>
            </View>
            <Text style={[styles.equationOp, { color: colorTheme.ink3 }]}>−</Text>
            <View style={[styles.equationPill, { backgroundColor: colorTheme.amberTint, borderColor: colorTheme.amberSoft }]}>
              <Text style={[styles.equationText, { color: colorTheme.amber }]}>
                {isZh ? '总支出 (−)' : 'Expenses (−)'}
              </Text>
            </View>
            <Text style={[styles.equationOp, { color: colorTheme.ink3 }]}>=</Text>
            <View style={[styles.equationPill, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
              <Text style={[styles.equationText, { color: colorTheme.ink, fontWeight: '700' }]}>
                {isZh ? '净现金流 💰' : 'Net Cash Flow 💰'}
              </Text>
            </View>
          </View>
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 12,
    marginVertical: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  subtleBadge: {
    fontFamily: uiFont(700),
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  methodBar: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    marginBottom: 8,
  },
  methodPill: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  methodPillActive: {},
  methodText: {
    fontFamily: uiFont(600),
    fontSize: 11.5,
  },
  methodTextActive: {
    fontFamily: uiFont(700),
    fontSize: 11.5,
    color: '#ffffff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  miniChipText: {
    fontFamily: uiFont(600),
    fontSize: 11,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  miniCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    fontFamily: uiFont(600),
    fontSize: 11.5,
    flex: 1,
  },
  stepperWrap: {
    gap: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  stepperName: {
    fontFamily: uiFont(600),
    fontSize: 11.5,
  },
  stepperAmount: {
    fontFamily: uiFont(700),
    fontSize: 11.5,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtnSmall: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  stepValueSmall: {
    fontFamily: uiFont(700),
    fontSize: 11.5,
  },
  splitResultHeader: {
    marginBottom: 8,
  },
  splitResultTotal: {
    fontFamily: uiFont(700),
    fontSize: 12,
  },
  splitCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultBoxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  resultBoxTitle: {
    fontFamily: uiFont(700),
    fontSize: 11,
  },
  resultBoxNumber: {
    fontFamily: uiFont(800),
    fontSize: 14,
    marginBottom: 2,
  },
  resultBoxCaption: {
    fontFamily: uiFont(500),
    fontSize: 10,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  flowStep: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  flowLabel: {
    fontFamily: uiFont(700),
    fontSize: 11,
    marginTop: 4,
  },
  flowSub: {
    fontFamily: uiFont(600),
    fontSize: 11,
    marginTop: 2,
  },
  noteText: {
    fontFamily: uiFont(500),
    fontSize: 11,
    lineHeight: 16,
  },
  actionChoiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceCard: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  choiceTitle: {
    fontFamily: uiFont(700),
    fontSize: 11.5,
    marginBottom: 2,
  },
  choiceDesc: {
    fontFamily: uiFont(500),
    fontSize: 10.5,
    lineHeight: 14,
  },
  typingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  typingPrefix: {
    fontSize: 13,
  },
  typingText: {
    fontFamily: uiFont(700),
    fontSize: 12,
  },
  parsedItemsRow: {
    gap: 6,
  },
  parsedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  parsedBadgeText: {
    fontFamily: uiFont(600),
    fontSize: 11,
  },
  chartBarsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 70,
    paddingBottom: 4,
    marginBottom: 8,
  },
  barCol: {
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: 22,
    borderRadius: 4,
  },
  barLabel: {
    fontFamily: uiFont(500),
    fontSize: 10,
  },
  floorLineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  floorLineText: {
    fontFamily: uiFont(600),
    fontSize: 10.5,
    flex: 1,
    lineHeight: 15,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  tierTitle: {
    fontFamily: uiFont(700),
    fontSize: 11.5,
    marginBottom: 2,
  },
  tierDesc: {
    fontFamily: uiFont(500),
    fontSize: 10.5,
    lineHeight: 14,
  },
  equationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  equationPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  equationText: {
    fontFamily: uiFont(600),
    fontSize: 11,
  },
  equationOp: {
    fontFamily: uiFont(700),
    fontSize: 14,
    paddingHorizontal: 2,
  },
});
