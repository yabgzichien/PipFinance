import { en } from '../src/i18n/translations/en';
import { zh } from '../src/i18n/translations/zh';
import { RECAP_BADGE_KEYS, RECAP_PERSONA_KEYS } from '../src/lib/recapStory';

const VIEWER_COPY_KEYS = [
  'recapStoryOpen',
  'recapStoryInviteTitle',
  'recapStoryInviteBody',
  'recapStoryDismiss',
  'recapStoryOf',
  'recapStoryPrevious',
  'recapStoryNext',
  'recapStoryPause',
  'recapStoryPlay',
  'recapStoryMute',
  'recapStoryUnmute',
  'recapStoryReplay',
  'recapStoryShareCard',
  'recapStoryChooseCards',
  'recapStorySaveSelected',
  'recapStoryDownload',
  'recapStoryRetry',
  'recapStorySavedCount',
  'recapStoryPermissionDenied',
  'recapStoryCaptureFailed',
  'recapStoryShareUnavailable',
  'recapStoryOpenInstagram',
  'recapStorySavedToPhotos',
  'recapStoryCloseCaptureTitle',
  'recapStoryCloseCaptureBody',
  'recapStoryRecordedShare',
  'recapStoryComparisonHigher',
  'recapStoryComparisonLower',
  'recapStoryComparisonSame',
  'recapStoryMerchantOff',
  'recapStoryMerchantDisclosure',
  'recapStoryDays',
  'recapStoryWeeks',
] as const;

const REVIEWED_PERSONA_TITLES = {
  food: ['The Flavour Finder', '寻味达人'],
  shopping: ['The Thoughtful Curator', '精挑策展人'],
  entertainment: ['The Joy Collector', '快乐收藏家'],
  travelling: ['The Weekend Wanderer', '周末漫游家'],
  learning: ['The Curious Builder', '好奇进修家'],
  family: ['The Family Anchor', '家庭守护者'],
  medical: ['The Wellness Keeper', '健康守门人'],
  utilities: ['The Home Conductor', '生活调度家'],
  subscriptions: ['The Digital Regular', '数码常客'],
  rental: ['The Home Base Hero', '安居主理人'],
  phoneBill: ['The Connected Regular', '在线常驻客'],
  insurance: ['The Future Minder', '未来照看者'],
  other: ['The Pattern Spotter', '规律发现家'],
  consistent: ['The Cool Consistent', '稳稳记录派'],
  explorer: ['The Curious Explorer', '好奇探索家'],
  smallChapter: ['A Small Chapter', '小小一章'],
  incomeOnly: ['The First Notes', '开篇几笔'],
} as const;

const ALLOWED_FACT_TOKENS = new Set(['days', 'weeks', 'percent', 'category', 'month']);

function tokens(value: string): string[] {
  return [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

describe('monthly recap story copy', () => {
  const enCopy = en as unknown as Record<string, string>;
  const zhCopy = zh as unknown as Record<string, string>;

  test('keeps the monthly ritual sentence exact in English', () => {
    expect(en.recapStoryRitualTitle).toBe("Wake up—it’s the first of the month");
  });

  test.each(VIEWER_COPY_KEYS)('%s is present in both locales', (key) => {
    expect(enCopy[key]?.trim()).toBeTruthy();
    expect(zhCopy[key]?.trim()).toBeTruthy();
  });

  test.each(RECAP_PERSONA_KEYS)('%s has its reviewed title and a body in both locales', (key) => {
    const [englishTitle, chineseTitle] = REVIEWED_PERSONA_TITLES[key];
    expect(enCopy[`recapStoryPersona_${key}_title`]).toBe(englishTitle);
    expect(zhCopy[`recapStoryPersona_${key}_title`]).toBe(chineseTitle);
    expect(enCopy[`recapStoryPersona_${key}_body`]?.trim()).toBeTruthy();
    expect(zhCopy[`recapStoryPersona_${key}_body`]?.trim()).toBeTruthy();
  });

  test.each(RECAP_BADGE_KEYS)('%s badge has a label and body in both locales', (key) => {
    expect(enCopy[`recapStoryBadge_${key}_label`]?.trim()).toBeTruthy();
    expect(enCopy[`recapStoryBadge_${key}_body`]?.trim()).toBeTruthy();
    expect(zhCopy[`recapStoryBadge_${key}_label`]?.trim()).toBeTruthy();
    expect(zhCopy[`recapStoryBadge_${key}_body`]?.trim()).toBeTruthy();
  });

  test('persona bodies interpolate only approved factual values', () => {
    for (const copy of [enCopy, zhCopy]) {
      for (const key of RECAP_PERSONA_KEYS) {
        const value = copy[`recapStoryPersona_${key}_body`];
        expect(tokens(value).filter((token) => !ALLOWED_FACT_TOKENS.has(token))).toEqual([]);
      }
    }
  });
});
