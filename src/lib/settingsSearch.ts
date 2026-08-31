// src/lib/settingsSearch.ts

export type SettingSectionKey =
  | 'appearance'
  | 'reminders'
  | 'ai'
  | 'learning'
  | 'budget'
  | 'data'
  | 'danger';

export type SettingItemKey =
  | 'theme'
  | 'language'
  | 'accent'
  | 'motion'
  | 'sounds'
  | 'streak'
  | 'reminder_spending'
  | 'reminder_owed'
  | 'reminder_commitments'
  | 'ai_groq'
  | 'ai_gemini'
  | 'learning'
  | 'budget'
  | 'data_commitments'
  | 'data_tax'
  | 'data_categories'
  | 'data_currencies'
  | 'data_import'
  | 'data_export'
  | 'data_tutorial'
  | 'danger_reset_all'
  | 'danger_reset_setup';

export interface SettingDefinition {
  key: SettingItemKey;
  section: SettingSectionKey;
  sectionTitleEn: string;
  sectionTitleZh: string;
  titleEn: string;
  titleZh: string;
  keywords: string[];
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'theme',
    section: 'appearance',
    sectionTitleEn: 'Appearance',
    sectionTitleZh: '外观与偏好',
    titleEn: 'Theme',
    titleZh: '主题模式',
    keywords: [
      'theme',
      'dark',
      'light',
      'system',
      'mode',
      'color mode',
      'dark mode',
      'light mode',
      'night',
      'appearance',
      '主题',
      '浅色',
      '深色',
      '系统',
      '夜间模式',
      '黑夜模式',
      '日间模式',
    ],
  },
  {
    key: 'language',
    section: 'appearance',
    sectionTitleEn: 'Appearance',
    sectionTitleZh: '外观与偏好',
    titleEn: 'Language',
    titleZh: '语言设置',
    keywords: [
      'language',
      'english',
      'chinese',
      'simplified chinese',
      'mandarin',
      'locale',
      'translation',
      'i18n',
      'en',
      'zh',
      '语言',
      '英文',
      '中文',
      '简体中文',
      '翻译',
    ],
  },
  {
    key: 'accent',
    section: 'appearance',
    sectionTitleEn: 'Appearance',
    sectionTitleZh: '外观与偏好',
    titleEn: 'Accent color & App icon',
    titleZh: '主题强调色与应用图标',
    keywords: [
      'accent',
      'color',
      'accent color',
      'preset',
      'app icon',
      'icon',
      'squircle',
      'amber',
      'emerald',
      'forest',
      'green',
      'berry',
      'purple',
      'ocean',
      'blue',
      'coral',
      'peach',
      '强调色',
      '颜色',
      '图标',
      '应用图标',
      '色彩',
      '个性化',
    ],
  },
  {
    key: 'motion',
    section: 'appearance',
    sectionTitleEn: 'Appearance',
    sectionTitleZh: '外观与偏好',
    titleEn: 'Motion and haptics',
    titleZh: '动画与触感反馈',
    keywords: [
      'motion',
      'haptics',
      'animation',
      'reduced motion',
      'vibration',
      'transition',
      'full',
      'reduced',
      'off',
      'speed',
      'smoothness',
      'feedback',
      '动画',
      '触感',
      '震动',
      '减弱',
      '动效',
      '反馈',
    ],
  },
  {
    key: 'sounds',
    section: 'appearance',
    sectionTitleEn: 'Appearance',
    sectionTitleZh: '外观与偏好',
    titleEn: 'Sounds',
    titleZh: '提示音效',
    keywords: [
      'sounds',
      'sound',
      'audio',
      'chime',
      'payoff',
      'effect',
      'tone',
      'ding',
      'save chime',
      'mute',
      'volume',
      '音效',
      '提示音',
      '声音',
      '静音',
      '音量',
    ],
  },
  {
    key: 'streak',
    section: 'appearance',
    sectionTitleEn: 'Appearance',
    sectionTitleZh: '外观与偏好',
    titleEn: 'Streak',
    titleZh: '连续记账追踪',
    keywords: [
      'streak',
      'pause',
      'freeze',
      'daily streak',
      'tracking',
      'habit',
      'resume',
      '连续记账',
      '打卡',
      '暂停',
      '恢复',
      '天数',
      '习惯',
    ],
  },
  {
    key: 'reminder_spending',
    section: 'reminders',
    sectionTitleEn: 'Reminders',
    sectionTitleZh: '通知与提醒',
    titleEn: 'Log your spending',
    titleZh: '记账提醒',
    keywords: [
      'reminder',
      'log spending',
      'spending',
      'notification',
      'cadence',
      'daily',
      'weekly',
      'time',
      'hour',
      'auto',
      'schedule',
      'when',
      '9 pm',
      '10 pm',
      '11 pm',
      '提醒',
      '通知',
      '记账',
      '每日',
      '每周',
      '定时',
      '时间',
    ],
  },
  {
    key: 'reminder_owed',
    section: 'reminders',
    sectionTitleEn: 'Reminders',
    sectionTitleZh: '通知与提醒',
    titleEn: 'Chase what you’re owed',
    titleZh: '催款提醒 / 还款提醒',
    keywords: [
      'reminder',
      'chase owed',
      'owed',
      'debt',
      'split',
      'borrow',
      'lent',
      'friends',
      'notification',
      '提醒',
      '催款',
      '借出',
      '分账',
      '未还款',
      '还钱',
      '应收款',
    ],
  },
  {
    key: 'reminder_commitments',
    section: 'reminders',
    sectionTitleEn: 'Reminders',
    sectionTitleZh: '通知与提醒',
    titleEn: 'Recurring bills',
    titleZh: '定期账单提醒',
    keywords: [
      'reminder',
      'recurring bills',
      'recurring',
      'bill',
      'subscription',
      'due',
      'commitment',
      'notification',
      '提醒',
      '订阅',
      '固定账单',
      '定期扣款',
      '到期',
    ],
  },
  {
    key: 'ai_groq',
    section: 'ai',
    sectionTitleEn: 'AI providers',
    sectionTitleZh: 'AI 模型供应商',
    titleEn: 'Groq · primary',
    titleZh: 'Groq 主力模型',
    keywords: [
      'ai',
      'provider',
      'groq',
      'model',
      'api key',
      'llm',
      'test connection',
      'primary',
      'artificial intelligence',
      '人工智能',
      '大模型',
      '密钥',
      '连接测试',
    ],
  },
  {
    key: 'ai_gemini',
    section: 'ai',
    sectionTitleEn: 'AI providers',
    sectionTitleZh: 'AI 模型供应商',
    titleEn: 'Gemini · fallback',
    titleZh: 'Gemini 备用模型',
    keywords: [
      'ai',
      'provider',
      'gemini',
      'google',
      'model',
      'api key',
      'llm',
      'test connection',
      'fallback',
      'artificial intelligence',
      '人工智能',
      '大模型',
      '密钥',
      '连接测试',
    ],
  },
  {
    key: 'learning',
    section: 'learning',
    sectionTitleEn: 'Learning',
    sectionTitleZh: '智能记忆',
    titleEn: 'Learned merchants',
    titleZh: '商家智能记忆',
    keywords: [
      'learning',
      'learned',
      'merchants',
      'merchant',
      'memory',
      'auto-categorization',
      'clear memory',
      'reset learning',
      'smart',
      'ai learning',
      '记忆',
      '商家记忆',
      '智能学习',
      '自动分类',
      '重置记忆',
      '已学习',
    ],
  },
  {
    key: 'budget',
    section: 'budget',
    sectionTitleEn: 'Budget',
    sectionTitleZh: '预算管理',
    titleEn: 'Budget',
    titleZh: '预算设置',
    keywords: [
      'budget',
      'income',
      'expected income',
      'allocations',
      'allocation',
      'category budget',
      'reset budget',
      'plan',
      'monthly budget',
      'safe to spend',
      '预算',
      '收入',
      '分类预算',
      '清空预算',
      '重置预算',
      '额度',
    ],
  },
  {
    key: 'data_commitments',
    section: 'data',
    sectionTitleEn: 'Data',
    sectionTitleZh: '数据与管理',
    titleEn: 'Recurring bills & investments',
    titleZh: '固定账单与投资',
    keywords: [
      'recurring',
      'bills',
      'investments',
      'commitment',
      'subscriptions',
      'stocks',
      'crypto',
      'monthly bills',
      'fixed expenses',
      '固定支出',
      '定期账单',
      '投资',
      '定投',
      '周期',
      '订阅',
    ],
  },
  {
    key: 'data_tax',
    section: 'data',
    sectionTitleEn: 'Data',
    sectionTitleZh: '数据与管理',
    titleEn: 'Tax relief',
    titleZh: '税务减免',
    keywords: [
      'tax',
      'tax relief',
      'deduction',
      'receipts',
      'e-filing',
      'lhdn',
      'claim',
      'rebate',
      'lifestyle',
      'epf',
      'medical',
      '税务',
      '税收减免',
      '退税',
      '报税',
      '收据',
      '扣税',
      '个税',
    ],
  },
  {
    key: 'data_categories',
    section: 'data',
    sectionTitleEn: 'Data',
    sectionTitleZh: '数据与管理',
    titleEn: 'Categories',
    titleZh: '收支分类',
    keywords: [
      'category',
      'categories',
      'icon',
      'color',
      'hue',
      'custom category',
      'expense',
      'income',
      'manage categories',
      '分类',
      '收支分类',
      '类别',
      '图标',
      '自定义分类',
      '编辑分类',
    ],
  },
  {
    key: 'data_currencies',
    section: 'data',
    sectionTitleEn: 'Data',
    sectionTitleZh: '数据与管理',
    titleEn: 'Currencies',
    titleZh: '多币种支持',
    keywords: [
      'currency',
      'currencies',
      'multi-currency',
      'fx',
      'exchange rate',
      'myr',
      'usd',
      'sgd',
      'cny',
      'eur',
      'gbp',
      'jpy',
      'foreign',
      'forex',
      'base currency',
      '货币',
      '汇率',
      '多币种',
      '外币',
      '币种',
      '本位币',
    ],
  },
  {
    key: 'data_import',
    section: 'data',
    sectionTitleEn: 'Data',
    sectionTitleZh: '数据与管理',
    titleEn: 'Advanced import',
    titleZh: '高级导入',
    keywords: [
      'import',
      'advanced import',
      'statement',
      'pdf',
      'csv',
      'excel',
      'xlsx',
      'bank statement',
      'bulk',
      'batch',
      'upload',
      'file',
      '导入',
      '账单导入',
      '对账单',
      '批量导入',
      '银行流水',
      '流水',
    ],
  },
  {
    key: 'data_export',
    section: 'data',
    sectionTitleEn: 'Data',
    sectionTitleZh: '数据与管理',
    titleEn: 'Financial reports & export',
    titleZh: '财务报表与导出',
    keywords: [
      'export',
      'report',
      'financial reports',
      'statement',
      'csv',
      'xlsx',
      'excel',
      'pdf',
      'html',
      'backup',
      'download',
      'data export',
      'summary',
      '导出',
      '报表',
      '财务报表',
      '下载',
      '备份',
      '数据导出',
    ],
  },
  {
    key: 'data_tutorial',
    section: 'data',
    sectionTitleEn: 'Data',
    sectionTitleZh: '数据与管理',
    titleEn: 'Replay Onboarding Tutorial',
    titleZh: '重播新手入门教程',
    keywords: [
      'tutorial',
      'onboarding',
      'guide',
      'replay',
      'tour',
      'spotlight',
      'walkthrough',
      'intro',
      'welcome',
      'replay tutorial',
      'help',
      '教程',
      '新手引导',
      '重播',
      '引导',
      '帮助',
      '新手入门',
      '向导',
    ],
  },
  {
    key: 'danger_reset_all',
    section: 'danger',
    sectionTitleEn: 'Danger zone',
    sectionTitleZh: '危险区域',
    titleEn: 'Reset all data',
    titleZh: '清除所有数据',
    keywords: [
      'reset all data',
      'reset',
      'wipe',
      'delete',
      'clear',
      'all data',
      'danger zone',
      'factory reset',
      'erase',
      'remove',
      '重置',
      '清空所有数据',
      '清除所有数据',
      '删除',
      '危险区域',
      '抹掉',
      '清空',
    ],
  },
  {
    key: 'danger_reset_setup',
    section: 'danger',
    sectionTitleEn: 'Danger zone',
    sectionTitleZh: '危险区域',
    titleEn: 'Reset & go to setup',
    titleZh: '重置并进入设置向导',
    keywords: [
      'reset to setup',
      'setup',
      'onboarding',
      'wizard',
      'restart',
      're-setup',
      'reset',
      'danger zone',
      '重新设置',
      '重置并进入设置向导',
      '初始化',
      '向导',
      '重新引导',
    ],
  },
];

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesSetting(
  def: SettingDefinition,
  query: string,
  extraKeywords?: string[]
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;

  const terms = q.split(/\s+/).filter(Boolean);

  const searchableText = [
    def.key,
    def.section,
    def.sectionTitleEn,
    def.sectionTitleZh,
    def.titleEn,
    def.titleZh,
    ...def.keywords,
    ...(extraKeywords ?? []),
  ]
    .join(' ')
    .toLowerCase();

  return terms.every((term) => searchableText.includes(term));
}

export function filterSettings(
  query: string,
  dynamicContext?: Partial<Record<SettingItemKey, string[]>>
): {
  matchingKeys: Set<SettingItemKey>;
  isSearching: boolean;
  hasMatches: boolean;
  matchingSections: Set<SettingSectionKey>;
} {
  const q = normalizeQuery(query);
  const isSearching = q.length > 0;

  if (!isSearching) {
    const allKeys = new Set<SettingItemKey>(SETTING_DEFINITIONS.map((d) => d.key));
    const allSections = new Set<SettingSectionKey>(SETTING_DEFINITIONS.map((d) => d.section));
    return {
      matchingKeys: allKeys,
      isSearching: false,
      hasMatches: true,
      matchingSections: allSections,
    };
  }

  const matchingKeys = new Set<SettingItemKey>();
  const matchingSections = new Set<SettingSectionKey>();

  for (const def of SETTING_DEFINITIONS) {
    const extras = dynamicContext?.[def.key];
    if (matchesSetting(def, q, extras)) {
      matchingKeys.add(def.key);
      matchingSections.add(def.section);
    }
  }

  return {
    matchingKeys,
    isSearching: true,
    hasMatches: matchingKeys.size > 0,
    matchingSections,
  };
}
