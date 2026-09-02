import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ExportSuccessModal } from '../components/ExportSuccessModal';
import { Icon, type IconName } from '../components/Icon';
import { Amount, Card, Eyebrow, IconButton, TopBar } from '../components/ui';
import {
  buildFinancialReportBundle,
  buildReportPeriod,
  type ReportPeriodType,
} from '../lib/bookkeeping';
import { getAdvice } from '../db/budgetRepo';
import { listDeletedDefaultCategories } from '../db/categoriesRepo';
import { getActiveCurrencies } from '../db/currencyRepo';
import { getReliefMemoryMap, listAllReliefTags } from '../db/reliefRepo';
import {
  buildReceiptExportList,
  csvToHtmlTable,
  generateAdvancedImportJSON,
  generateCSV,
  generateEwalletCSV,
  generateEwalletPreviewHtml,
  generateExcelWorkbook,
  generateHTMLReport,
  generatePrintablePDFHtml,
  generateReceiptsPreviewHtml,
  generateReceiptsZip,
  isEwalletTransaction,
  saveOrDownloadExport,
  type ExportFormat,
  type FullExportExtra,
} from '../lib/financialExport';
import { notify } from '../lib/platformAlert';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { fmtMoney } from '../lib/format';
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { useAppData } from '../state/store';
import { useLanguage } from '../i18n';
import { colors, numFont, platformShadow, radius, uiFont } from '../theme';

interface FormatOption {
  id: ExportFormat;
  title: string;
  sub: string;
  badge: string;
  icon: IconName;
  fileExt: string;
  mimeType: string;
}

const PERIOD_TABS: { type: ReportPeriodType; labelEn: string; labelZh: string }[] = [
  { type: 'monthly', labelEn: 'Monthly', labelZh: '按月份' },
  { type: 'yearly', labelEn: 'Yearly', labelZh: '按年份' },
  { type: 'all-time', labelEn: 'All Time', labelZh: '全部时间' },
  { type: 'custom', labelEn: 'Custom Range', labelZh: '自定义区间' },
];

export function ExportScreen({
  onBack,
  initialMonth,
}: {
  onBack: () => void;
  initialMonth?: string;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAccent();
  const themeColors = useThemeColors();
  const { t, formatMonthLabel, isZh } = useLanguage();
  const {
    transactions,
    categories,
    accounts,
    balanceEntries,
    commitments,
    commitmentOccurrences,
    people,
    splits,
    shares,
    splitPayments,
    expectedIncome,
    allocations,
    snapshots,
    memory,
    tasksDone,
    onboardingComplete,
    tutorialScanDone,
    tutorialManualDone,
    tutorialDismissed,
    reminderCadence,
    reminderHourOverride,
    owedReminderEnabled,
    commitmentReminderEnabled,
    motionSetting,
    soundEnabled,
    markTaskDone,
  } = useAppData();

  const getFullExportExtra = async (): Promise<FullExportExtra> => {
    const [reliefTags, reliefMemory, deletedCats, activeCurrencies, advice] = await Promise.all([
      listAllReliefTags().catch(() => []),
      getReliefMemoryMap().catch(() => ({})),
      listDeletedDefaultCategories().catch(() => []),
      getActiveCurrencies().catch(() => ['MYR']),
      getAdvice().catch(() => null),
    ]);

    return {
      commitments,
      occurrences: commitmentOccurrences,
      balanceEntries,
      people,
      splits,
      shares,
      splitPayments,
      budget: {
        expectedIncome,
        allocations,
      },
      budgetSnapshots: snapshots,
      budgetAdvice: advice,
      reliefTags,
      reliefMemory,
      merchantMemory: memory,
      deletedDefaultCategories: deletedCats,
      activeCurrencies,
      preferences: {
        settings: {
          reminderCadence,
          reminderHourOverride,
          owedReminderEnabled,
          commitmentReminderEnabled,
          motionSetting,
          soundEnabled,
        },
        tasks: {
          tasksDone,
          onboardingComplete,
          tutorialScanDone,
          tutorialManualDone,
          tutorialDismissed,
        },
      },
      allTransactions: periodType === 'all-time' ? transactions : reportData.transactions,
    };
  };

  const now = useMemo(() => new Date(), []);
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, '0');
  const defaultMonth = initialMonth || `${curY}-${curM}`;

  const [periodType, setPeriodType] = useState<ReportPeriodType>(initialMonth ? 'monthly' : 'all-time');
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<number>(curY);
  const [customStart, setCustomStart] = useState<string>(`${curY}-01-01`);
  const [customEnd, setCustomEnd] = useState<string>(now.toISOString().slice(0, 10));
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [exporting, setExporting] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [lastExport, setLastExport] = useState<{
    fileName: string;
    format: ExportFormat;
    fileUri?: string;
    fileSize?: number;
    mimeType?: string;
    rawContent?: string;
  } | null>(null);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(`${curY}-${curM}`);
    for (const t of transactions) {
      if (t.date && t.date.length >= 7) {
        months.add(t.date.slice(0, 7));
      }
    }
    return [...months].sort().reverse();
  }, [transactions, curY, curM]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(curY);
    for (const t of transactions) {
      if (t.date && t.date.length >= 4) {
        const y = parseInt(t.date.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      }
    }
    return [...years].sort().reverse();
  }, [transactions, curY]);

  const activePeriod = useMemo(() => {
    return buildReportPeriod(periodType, selectedMonth, selectedYear, customStart, customEnd, now);
  }, [periodType, selectedMonth, selectedYear, customStart, customEnd, now]);

  const verifiedName = 'Pip User';

  const dc = useDisplayCurrency();
  const reportData = useMemo(() => {
    return buildFinancialReportBundle(
      transactions,
      categories,
      accounts,
      balanceEntries,
      activePeriod,
      verifiedName,
      dc.rates,
      dc.code
    );
  }, [transactions, categories, accounts, balanceEntries, activePeriod, verifiedName, dc.rates, dc.code]);

  const periodReceipts = useMemo(() => {
    return buildReceiptExportList(reportData.transactions, categories);
  }, [reportData.transactions, categories]);

  const periodEwalletTxns = useMemo(() => {
    return reportData.transactions.filter((t) => isEwalletTransaction(t, accounts));
  }, [reportData.transactions, accounts]);

  const receiptsCount = periodReceipts.length;
  const ewalletCount = periodEwalletTxns.length;

  const formatOptions: FormatOption[] = [
    {
      id: 'pdf',
      title: isZh ? 'PDF 财务对账单' : 'PDF Financial Statement',
      sub: isZh ? '标准双栏资产负债表、收支损益表与明细账目。' : 'Traditional 2-column Balance Sheet, Income Statement & itemized ledger.',
      badge: isZh ? '正式损益表' : 'Formal P&L',
      icon: 'receipt',
      fileExt: 'pdf.html',
      mimeType: 'text/html',
    },
    {
      id: 'xlsx',
      title: isZh ? 'Excel 工作簿 (.xlsx)' : 'Excel Workbook (.xlsx)',
      sub: isZh ? '包含利润表、资产负债表、流水明细、趋势及电子钱包流水。' : 'Multi-sheet workbook with P&L, Balance Sheet, Ledger, Trends & E-Wallets.',
      badge: isZh ? '完整工作簿' : 'Full Workbook',
      icon: 'table',
      fileExt: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    {
      id: 'html',
      title: isZh ? '交互式 HTML 图表分析' : 'Interactive HTML Analytics',
      sub: isZh ? '包含 SVG 现金流趋势图、分类支出甜甜圈图与净资产曲线。' : 'Visual report with SVG cash flow, category donut, and net worth charts.',
      badge: isZh ? '可视化图表' : 'With Charts',
      icon: 'trending',
      fileExt: 'html',
      mimeType: 'text/html',
    },
    {
      id: 'csv',
      title: isZh ? 'CSV 表格数据' : 'CSV Data Sheet',
      sub: isZh ? '通用标准结构化会计表格，适配各类电子表格软件。' : 'Universal structured tabular accounting export for any spreadsheet.',
      badge: isZh ? '通用格式' : 'Universal',
      icon: 'file',
      fileExt: 'csv',
      mimeType: 'text/csv',
    },
    {
      id: 'json',
      title: isZh ? '高级导入 JSON' : 'Advanced Import JSON',
      sub: isZh ? '与高级导入完全兼容的完整数据结构，可随时导出与重新导入。' : 'Same schema Advanced Import reads — copy or download, then re-import anytime.',
      badge: isZh ? '可重新导入' : 'Re-importable',
      icon: 'code',
      fileExt: 'json',
      mimeType: 'application/json',
    },
    {
      id: 'receipts',
      title: isZh ? '消费小票与凭据归档 (.zip)' : 'Receipts & Evidence Archive (.zip)',
      sub: isZh ? '打包导出所选周期内保存的所有小票照片、发票及审计清单。' : 'Bundles all saved receipt photos, e-invoices, and manifest for the period into a ZIP archive.',
      badge: isZh ? `${receiptsCount} 张小票` : `${receiptsCount} receipts`,
      icon: 'camera',
      fileExt: 'zip',
      mimeType: 'application/zip',
    },
    {
      id: 'ewallet',
      title: isZh ? '电子钱包交易流水 (.csv)' : 'E-Wallet Transaction History (.csv)',
      sub: isZh ? '包含 Touch \'n Go、GrabPay、Boost、ShopeePay 等电子钱包的专属交易明细与渠道统计。' : 'Dedicated statement for Touch \'n Go, GrabPay, Boost, ShopeePay & DuitNow QR with provider breakdowns.',
      badge: isZh ? `${ewalletCount} 笔钱包流水` : `${ewalletCount} e-wallet txns`,
      icon: 'scan',
      fileExt: 'csv',
      mimeType: 'text/csv',
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const sanitizedName = verifiedName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const periodSlug = activePeriod.label.replace(/[^a-zA-Z0-9_-]/g, '_');
      const baseFileName = `${sanitizedName}_${periodSlug}`;

      let content: string | Uint8Array;
      let ext: string = selectedFormat;
      let mime = 'text/plain';

      if (selectedFormat === 'xlsx') {
        content = generateExcelWorkbook(reportData);
        ext = 'xlsx';
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (selectedFormat === 'csv') {
        content = generateCSV(reportData);
        ext = 'csv';
        mime = 'text/csv';
      } else if (selectedFormat === 'html') {
        content = generateHTMLReport(reportData);
        ext = 'html';
        mime = 'text/html';
      } else if (selectedFormat === 'json') {
        const fullExtra = await getFullExportExtra();
        content = generateAdvancedImportJSON(reportData, fullExtra);
        ext = 'json';
        mime = 'application/json';
      } else if (selectedFormat === 'receipts') {
        const reliefTags = await listAllReliefTags().catch(() => []);
        content = generateReceiptsZip(reportData, reportData.transactions, reliefTags);
        ext = 'zip';
        mime = 'application/zip';
      } else if (selectedFormat === 'ewallet') {
        content = generateEwalletCSV(reportData, periodEwalletTxns);
        ext = 'csv';
        mime = 'text/csv';
      } else {
        content = generatePrintablePDFHtml(reportData);
        ext = 'pdf.html';
        mime = 'text/html';
      }

      const fileName = `${baseFileName}.${ext}`;
      const res = await saveOrDownloadExport(fileName, content, mime, { autoShare: true });

      if (res.success) {
        void markTaskDone('export');
        setLastExport({
          fileName,
          format: selectedFormat,
          fileUri: res.uri,
          fileSize: res.fileSize,
          mimeType: mime,
          rawContent: typeof content === 'string' ? content : undefined,
        });
        setSuccessModalVisible(true);

        if (selectedFormat === 'pdf' && Platform.OS === 'web') {
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(content as string);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 350);
          }
        }
      } else {
        notify(isZh ? '导出错误' : 'Export Error', res.error || (isZh ? '无法保存导出文件。' : 'Unable to save export file.'));
      }
    } catch (err: any) {
      notify(isZh ? '导出失败' : 'Export Failed', err?.message || (isZh ? '导出过程中发生意外错误。' : 'An unexpected error occurred during export.'));
    } finally {
      setExporting(false);
    }
  };

  const handlePreview = () => {
    if (selectedFormat === 'xlsx' || selectedFormat === 'csv') {
      const csvText = generateCSV(reportData);
      setPreviewContent(csvText);
      setPreviewTitle(`${selectedFormat.toUpperCase()} Preview (${activePeriod.label})`);
      setPreviewVisible(true);
    } else if (selectedFormat === 'html') {
      const htmlText = generateHTMLReport(reportData);
      setPreviewContent(htmlText);
      setPreviewTitle(`HTML Report Preview (${activePeriod.label})`);
      setPreviewVisible(true);
    } else if (selectedFormat === 'json') {
      getFullExportExtra().then((fullExtra) => {
        const jsonText = generateAdvancedImportJSON(reportData, fullExtra);
        setPreviewContent(jsonText);
        setPreviewTitle(`JSON Export Preview (${activePeriod.label})`);
        setPreviewVisible(true);
      });
    } else if (selectedFormat === 'receipts') {
      listAllReliefTags().catch(() => []).then((reliefTags) => {
        const receiptsHtml = generateReceiptsPreviewHtml(reportData, reportData.transactions, reliefTags);
        setPreviewContent(receiptsHtml);
        setPreviewTitle(isZh ? `消费小票与凭据预览 (${activePeriod.label})` : `Receipts Archive Preview (${activePeriod.label})`);
        setPreviewVisible(true);
      });
    } else if (selectedFormat === 'ewallet') {
      const ewalletHtml = generateEwalletPreviewHtml(reportData, periodEwalletTxns);
      setPreviewContent(ewalletHtml);
      setPreviewTitle(isZh ? `电子钱包流水预览 (${activePeriod.label})` : `E-Wallet History Preview (${activePeriod.label})`);
      setPreviewVisible(true);
    } else {
      const pdfHtml = generatePrintablePDFHtml(reportData);
      setPreviewContent(pdfHtml);
      setPreviewTitle(`PDF Statement Preview (${activePeriod.label})`);
      setPreviewVisible(true);
    }
  };

  const [copyingJson, setCopyingJson] = useState(false);
  const handleCopyJSON = async () => {
    setCopyingJson(true);
    try {
      const fullExtra = await getFullExportExtra();
      const json = generateAdvancedImportJSON(reportData, fullExtra);
      await Clipboard.setStringAsync(json);
      notify(isZh ? '已复制' : 'Copied', isZh ? '高级导入 JSON 已复制至剪贴板。' : 'Advanced Import JSON copied to clipboard. Paste it into Advanced Import to re-import.');
    } catch (err: any) {
      notify(isZh ? '复制失败' : 'Copy Failed', err?.message || (isZh ? '无法复制 JSON 至剪贴板。' : 'Unable to copy JSON to clipboard.'));
    } finally {
      setCopyingJson(false);
    }
  };

  const isIncome = reportData.incomeStatement.totalIncome;
  const isExpense = reportData.incomeStatement.totalExpense;
  const isNet = reportData.incomeStatement.netIncome;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar title={isZh ? '财务报表与导出' : 'Financial Reports & Export'} onBack={onBack} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 48 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 10 }}>{isZh ? '1. 报表周期' : '1. Reporting Period'}</Eyebrow>
        <View style={[styles.periodTabs, { backgroundColor: themeColors.surface2, borderColor: themeColors.line2 }]}>
          {PERIOD_TABS.map((tab) => {
            const active = periodType === tab.type;
            return (
              <Pressable
                key={tab.type}
                onPress={() => setPeriodType(tab.type)}
                style={[styles.periodTabBtn, active && { backgroundColor: theme.accentInk }]}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    { color: themeColors.ink2 },
                    active && styles.periodTabTextActive,
                  ]}
                >
                  {isZh ? tab.labelZh : tab.labelEn}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {periodType === 'monthly' && (
          <Card style={{ padding: 14, marginTop: 10 }}>
            <Text style={[styles.subHeader, { color: themeColors.ink }]}>{isZh ? '选择月份' : 'Select Month'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {availableMonths.map((m) => {
                  const label = formatMonthLabel(m, true);
                  const active = selectedMonth === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setSelectedMonth(m)}
                      style={[
                        styles.chipBtn,
                        active
                          ? { backgroundColor: theme.accent, borderColor: theme.accent }
                          : { backgroundColor: themeColors.surface2, borderColor: themeColors.line2 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: themeColors.ink },
                          active && { color: '#fff', fontWeight: '700' },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Card>
        )}

        {periodType === 'yearly' && (
          <Card style={{ padding: 14, marginTop: 10 }}>
            <Text style={[styles.subHeader, { color: themeColors.ink }]}>{isZh ? '选择年份' : 'Select Year'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {availableYears.map((y) => {
                const active = selectedYear === y;
                return (
                  <Pressable
                    key={y}
                    onPress={() => setSelectedYear(y)}
                    style={[
                      styles.chipBtn,
                      active
                        ? { backgroundColor: theme.accent, borderColor: theme.accent }
                        : { backgroundColor: themeColors.surface2, borderColor: themeColors.line2 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: themeColors.ink },
                        active && { color: '#fff', fontWeight: '700' },
                      ]}
                    >
                      {isZh ? `${y}年` : `Year ${y}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        {periodType === 'custom' && (
          <Card style={{ padding: 14, marginTop: 10 }}>
            <Text style={[styles.subHeader, { color: themeColors.ink }]}>{isZh ? '日期范围 (YYYY-MM-DD)' : 'Date Range (YYYY-MM-DD)'}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: themeColors.ink2 }]}>{isZh ? '起始日期' : 'From Date'}</Text>
                <TextInput
                  value={customStart}
                  onChangeText={setCustomStart}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={themeColors.ink3}
                  style={[
                    styles.dateInput,
                    { color: themeColors.ink, borderColor: themeColors.line2, backgroundColor: themeColors.surface },
                  ]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: themeColors.ink2 }]}>To Date</Text>
                <TextInput
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={themeColors.ink3}
                  style={[
                    styles.dateInput,
                    { color: themeColors.ink, borderColor: themeColors.line2, backgroundColor: themeColors.surface },
                  ]}
                />
              </View>
            </View>
          </Card>
        )}

        {/* LIVE PERIOD OVERVIEW CARD */}
        <Eyebrow style={{ marginTop: 22, marginBottom: 10 }}>{isZh ? '2. 报表概览' : '2. Statement Summary'}</Eyebrow>
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.summaryTitle, { color: themeColors.ink }]}>{activePeriod.label}</Text>
            <View style={[styles.badgePill, { backgroundColor: theme.accentTint }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>
                {isZh ? `${reportData.incomeStatement.transactionCount} 笔交易` : `${reportData.incomeStatement.transactionCount} txns`}
              </Text>
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: themeColors.ink2 }]}>{isZh ? '总收入' : 'Revenue'}</Text>
              <Amount value={isIncome} size={15} color="#15803d" />
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: themeColors.ink2 }]}>{isZh ? '总支出' : 'Expenses'}</Text>
              <Amount value={isExpense} size={15} color="#b3261e" />
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: themeColors.ink2 }]}>{isZh ? '净结余' : 'Net Surplus'}</Text>
              <Amount value={isNet} size={15} color={isNet >= 0 ? theme.accent : '#b3261e'} />
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: themeColors.ink2 }]}>{isZh ? '期末净资产' : 'Net Worth'}</Text>
              <Amount value={reportData.balanceSheet.netWorth} size={15} />
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: themeColors.line2 }]} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.statSubText, { color: themeColors.ink2 }]}>
              {isZh ? '月均收入：' : 'Mean Monthly: '}<Text style={{ fontFamily: uiFont(700), color: themeColors.ink }}>{fmtMoney(dc.convert(reportData.statistics.meanMonthlyIncome), dc.code)}</Text>
            </Text>
            <Text style={[styles.statSubText, { color: themeColors.ink2 }]}>
              {isZh ? '储蓄率：' : 'Savings Rate: '}<Text style={{ fontFamily: uiFont(700), color: theme.accent }}>{reportData.incomeStatement.savingsRate}%</Text>
            </Text>
          </View>
        </Card>

        {/* FORMAT SELECTION */}
        <Eyebrow style={{ marginTop: 22, marginBottom: 10 }}>{isZh ? '3. 选择导出格式' : '3. Select Export Format'}</Eyebrow>
        <View style={{ gap: 10 }}>
          {formatOptions.map((opt) => {
            const selected = selectedFormat === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSelectedFormat(opt.id)}
                style={({ pressed }) => [
                  styles.formatCard,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.line2 },
                  selected && { borderColor: theme.accent, backgroundColor: theme.accentTint },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View
                  style={[
                    styles.formatIconWrap,
                    { backgroundColor: selected ? theme.accent : themeColors.surface2 },
                  ]}
                >
                  <Icon
                    name={opt.icon}
                    size={20}
                    color={selected ? '#fff' : themeColors.ink2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.formatTitle, { color: themeColors.ink }, selected && { color: theme.accent }]}>
                      {opt.title}
                    </Text>
                    <View style={[styles.formatBadge, { backgroundColor: themeColors.surface2, borderColor: themeColors.line2 }]}>
                      <Text style={[styles.formatBadgeText, { color: themeColors.ink2 }]}>{opt.badge}</Text>
                    </View>
                  </View>
                  <Text style={[styles.formatSub, { color: themeColors.ink2 }]}>{opt.sub}</Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: themeColors.line },
                    selected && { borderColor: theme.accent, backgroundColor: theme.accent },
                  ]}
                >
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ACTION BUTTONS */}
        <View style={{ marginTop: 26, gap: 10 }}>
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.accentInk, opacity: exporting ? 0.6 : pressed ? 0.92 : 1 },
              platformShadow(theme.accent, 0.35, 10, { width: 0, height: 5 }, 3),
            ]}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="download" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  {selectedFormat === 'pdf' && Platform.OS === 'web'
                    ? (isZh ? '打印 / 导出 PDF' : 'Print / Export PDF')
                    : (isZh ? '导出并保存文件' : 'Export & Download')}
                </Text>
              </>
            )}
          </Pressable>

          {selectedFormat === 'json' && (
            <Pressable
              onPress={handleCopyJSON}
              disabled={copyingJson}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: themeColors.surface, borderColor: themeColors.line2 },
                { opacity: copyingJson ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              <Icon name="copy" size={16} color={theme.accent} />
              <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>
                {isZh ? '复制 JSON 至剪贴板' : 'Copy JSON to Clipboard'}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handlePreview}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: themeColors.surface, borderColor: themeColors.line2 },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Icon name="sparkles" size={16} color={theme.accent} />
            <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>
              {isZh ? '预览报表内容' : 'Preview Report Content'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* DOCUMENT PREVIEW MODAL */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={[styles.previewRoot, { backgroundColor: themeColors.bg }]}>
          <View style={{ paddingTop: insets.top + 6 }}>
            <TopBar
              title={previewTitle || 'Document Preview'}
              onClose={() => setPreviewVisible(false)}
              right={
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {selectedFormat === 'json' && (
                    <Pressable
                      onPress={handleCopyJSON}
                      disabled={copyingJson}
                      style={[styles.modalActionBtn, { backgroundColor: themeColors.surface2 }]}
                    >
                      <Icon name="copy" size={16} color={theme.accent} />
                      <Text style={[styles.modalActionText, { color: theme.accent }]}>Copy</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      setPreviewVisible(false);
                      handleExport();
                    }}
                    style={[styles.modalActionBtn, { backgroundColor: themeColors.surface2 }]}
                  >
                    <Icon name="download" size={16} color={theme.accent} />
                    <Text style={[styles.modalActionText, { color: theme.accent }]}>Export</Text>
                  </Pressable>
                </View>
              }
            />
          </View>

          {selectedFormat === 'json' ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
              <Card style={{ padding: 14 }}>
                <Text style={[styles.previewRawText, { color: themeColors.ink }]}>{previewContent}</Text>
              </Card>
            </ScrollView>
          ) : Platform.OS === 'web' ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
              {/* On Web, render in an interactive iframe */}
              <View style={styles.webPreviewWrap}>
                <iframe
                  srcDoc={
                    selectedFormat === 'csv' || selectedFormat === 'xlsx'
                      ? csvToHtmlTable(previewContent)
                      : previewContent
                  }
                  title="Report Preview"
                  style={{ width: '100%', height: 600, border: 'none', borderRadius: 8 }}
                />
              </View>
            </ScrollView>
          ) : (
            // On native, render the actual document/table instead of dumping raw markup/CSV text
            <View style={[styles.webPreviewWrap, { flex: 1, margin: 16, marginTop: 0 }]}>
              <WebView
                source={{
                  html:
                    selectedFormat === 'csv' || selectedFormat === 'xlsx'
                      ? csvToHtmlTable(previewContent)
                      : previewContent,
                }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                originWhitelist={['*']}
              />
            </View>
          )}
        </View>
      </Modal>

      {lastExport && (
        <ExportSuccessModal
          visible={successModalVisible}
          onClose={() => setSuccessModalVisible(false)}
          fileName={lastExport.fileName}
          format={lastExport.format}
          fileUri={lastExport.fileUri}
          fileSize={lastExport.fileSize}
          mimeType={lastExport.mimeType}
          rawContent={lastExport.rawContent}
          onPreview={handlePreview}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  periodTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  periodTabText: {
    fontFamily: uiFont(600),
    fontSize: 13,
    color: colors.ink2,
  },
  periodTabTextActive: {
    color: '#fff',
    fontFamily: uiFont(700),
  },
  subHeader: {
    fontFamily: uiFont(700),
    fontSize: 13,
    color: colors.ink,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: uiFont(500),
    fontSize: 12.5,
    color: colors.ink,
  },
  inputLabel: {
    fontFamily: uiFont(600),
    fontSize: 11,
    color: colors.ink2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dateInput: {
    fontFamily: uiFont(500),
    fontSize: 13,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  summaryTitle: {
    fontFamily: uiFont(700),
    fontSize: 15,
    color: colors.ink,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: uiFont(700),
    fontSize: 11.5,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontFamily: uiFont(600),
    fontSize: 11,
    color: colors.ink2,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    height: 1,
    backgroundColor: colors.line2,
    marginVertical: 12,
  },
  statSubText: {
    fontFamily: uiFont(500),
    fontSize: 12,
    color: colors.ink2,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line2,
  },
  formatIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatTitle: {
    fontFamily: uiFont(700),
    fontSize: 14,
    color: colors.ink,
  },
  formatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  formatBadgeText: {
    fontFamily: uiFont(600),
    fontSize: 10,
    color: colors.ink2,
  },
  formatSub: {
    fontFamily: uiFont(400),
    fontSize: 12,
    color: colors.ink2,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 999,
  },
  primaryBtnText: {
    fontFamily: uiFont(700),
    fontSize: 15,
    color: '#fff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    fontFamily: uiFont(600),
    fontSize: 13.5,
  },
  previewRoot: {
    flex: 1,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  modalActionText: {
    fontFamily: uiFont(700),
    fontSize: 13,
  },
  webPreviewWrap: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  previewRawText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.ink,
    lineHeight: 16,
  },
});
