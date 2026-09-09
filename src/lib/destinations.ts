// src/lib/destinations.ts
// Trip name → destination, decided locally and deterministically. No LLM, no network: this runs
// on every trip row on render, and a picture that changes because a remote model felt different
// today is worse than no picture at all.
//
// The table is the single source for BOTH matching and the icon picker's grid, so a destination
// cannot exist in one and be missing from the other.

export type DestinationKey =
  | 'sg' | 'my' | 'jp' | 'th' | 'ph' | 'us' | 'ca' | 'cn' | 'hk' | 'tw' | 'kr'
  | 'ru' | 'tr' | 'de' | 'gb' | 'it' | 'fr' | 'ro' | 'eg' | 'is' | 'se' | 'ch'
  | 'pl' | 'in' | 'au' | 'nz' | 'vn' | 'id' | 'nl' | 'es' | 'gr' | 'pt' | 'br'
  | 'mx' | 'ae' | 'no';

export interface Destination {
  key: DestinationKey;
  /** English name, shown in the picker and used as the canonical alias. */
  label: string;
  labelZh: string;
  /** Country and city names people actually put in a trip title, in both languages. */
  aliases: string[];
  /**
   * Phrases that must NOT count as a sighting of this destination. Each one contains an alias
   * and means something else entirely — "turkey dinner" is not a trip to Türkiye. Occurrences
   * are deleted before matching, so a name can mention both a blocked phrase and the real place.
   */
  blocked?: string[];
}

export const DESTINATIONS: Destination[] = [
  { key: 'sg', label: 'Singapore', labelZh: '新加坡', aliases: ['singapore', 'sentosa', '新加坡', '狮城', '星洲'] },
  { key: 'my', label: 'Malaysia', labelZh: '马来西亚', aliases: ['malaysia', 'kuala lumpur', 'penang', 'langkawi', 'malacca', 'melaka', 'johor', 'johor bahru', 'sabah', 'sarawak', 'kota kinabalu', 'ipoh', 'cameron highlands', 'genting', '马来西亚', '大马', '吉隆坡', '槟城', '马六甲', '沙巴', '云顶'] },
  { key: 'jp', label: 'Japan', labelZh: '日本', aliases: ['japan', 'tokyo', 'osaka', 'kyoto', 'hokkaido', 'okinawa', 'nagoya', 'fukuoka', 'sapporo', 'hiroshima', 'nara', 'kobe', 'yokohama', 'hakone', '日本', '东京', '大阪', '京都', '北海道', '冲绳', '福冈', '名古屋', '札幌'] },
  { key: 'th', label: 'Thailand', labelZh: '泰国', aliases: ['thailand', 'bangkok', 'phuket', 'chiang mai', 'krabi', 'pattaya', 'koh samui', 'ayutthaya', '泰国', '曼谷', '普吉', '清迈', '芭堤雅'] },
  { key: 'ph', label: 'Philippines', labelZh: '菲律宾', aliases: ['philippines', 'manila', 'cebu', 'boracay', 'palawan', 'davao', 'bohol', 'el nido', '菲律宾', '马尼拉', '宿务', '长滩岛'] },
  { key: 'us', label: 'United States', labelZh: '美国', aliases: ['united states', 'usa', 'america', 'new york', 'nyc', 'los angeles', 'san francisco', 'las vegas', 'chicago', 'seattle', 'boston', 'hawaii', 'honolulu', 'miami', 'orlando', 'washington dc', 'san diego', 'yellowstone', '美国', '纽约', '洛杉矶', '旧金山', '拉斯维加斯', '夏威夷', '西雅图'] },
  { key: 'ca', label: 'Canada', labelZh: '加拿大', aliases: ['canada', 'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'quebec', 'banff', 'niagara', '加拿大', '多伦多', '温哥华', '蒙特利尔'] },
  {
    key: 'cn', label: 'China', labelZh: '中国',
    aliases: ['china', 'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu', 'xian', 'hangzhou', 'guilin', 'suzhou', 'chongqing', 'zhangjiajie', '中国', '北京', '上海', '广州', '深圳', '成都', '西安', '杭州', '桂林', '苏州', '重庆'],
    blocked: ['china town', 'chinatown', 'china airlines', 'bone china', '唐人街'],
  },
  { key: 'hk', label: 'Hong Kong', labelZh: '香港', aliases: ['hong kong', 'hongkong', 'kowloon', 'macau', 'macao', '香港', '九龙', '澳门'] },
  { key: 'tw', label: 'Taiwan', labelZh: '台湾', aliases: ['taiwan', 'taipei', 'taichung', 'kaohsiung', 'tainan', 'hualien', '台湾', '台北', '台中', '高雄', '台南', '花莲'] },
  { key: 'kr', label: 'South Korea', labelZh: '韩国', aliases: ['south korea', 'korea', 'seoul', 'busan', 'jeju', 'incheon', 'gyeongju', '韩国', '首尔', '釜山', '济州', '仁川'] },
  { key: 'ru', label: 'Russia', labelZh: '俄罗斯', aliases: ['russia', 'moscow', 'saint petersburg', 'st petersburg', 'vladivostok', '俄罗斯', '莫斯科', '圣彼得堡'] },
  {
    key: 'tr', label: 'Turkey', labelZh: '土耳其',
    aliases: ['turkey', 'turkiye', 'istanbul', 'cappadocia', 'antalya', 'izmir', 'pamukkale', '土耳其', '伊斯坦布尔'],
    blocked: ['turkey dinner', 'roast turkey', 'turkey sandwich', 'turkey burger', 'turkey breast', 'turkey rice', 'smoked turkey', 'turkey slice'],
  },
  { key: 'de', label: 'Germany', labelZh: '德国', aliases: ['germany', 'berlin', 'munich', 'frankfurt', 'hamburg', 'cologne', 'dusseldorf', 'stuttgart', '德国', '柏林', '慕尼黑', '法兰克福', '汉堡'] },
  { key: 'gb', label: 'United Kingdom', labelZh: '英国', aliases: ['united kingdom', 'britain', 'great britain', 'england', 'scotland', 'wales', 'london', 'edinburgh', 'manchester', 'liverpool', 'oxford', 'cambridge', 'glasgow', '英国', '伦敦', '爱丁堡', '曼彻斯特'] },
  { key: 'it', label: 'Italy', labelZh: '意大利', aliases: ['italy', 'rome', 'venice', 'florence', 'milan', 'naples', 'sicily', 'tuscany', 'amalfi', 'pisa', '意大利', '罗马', '威尼斯', '佛罗伦萨', '米兰'] },
  { key: 'fr', label: 'France', labelZh: '法国', aliases: ['france', 'paris', 'nice', 'lyon', 'marseille', 'bordeaux', 'provence', 'normandy', '法国', '巴黎', '尼斯', '里昂'] },
  { key: 'ro', label: 'Romania', labelZh: '罗马尼亚', aliases: ['romania', 'bucharest', 'transylvania', 'brasov', 'cluj', 'sibiu', '罗马尼亚', '布加勒斯特'] },
  { key: 'eg', label: 'Egypt', labelZh: '埃及', aliases: ['egypt', 'cairo', 'giza', 'luxor', 'alexandria', 'aswan', 'sharm el sheikh', '埃及', '开罗', '卢克索'] },
  { key: 'is', label: 'Iceland', labelZh: '冰岛', aliases: ['iceland', 'reykjavik', 'vik', '冰岛', '雷克雅未克'] },
  { key: 'se', label: 'Sweden', labelZh: '瑞典', aliases: ['sweden', 'stockholm', 'gothenburg', 'malmo', 'kiruna', '瑞典', '斯德哥尔摩'] },
  { key: 'ch', label: 'Switzerland', labelZh: '瑞士', aliases: ['switzerland', 'zurich', 'geneva', 'lucerne', 'interlaken', 'zermatt', 'bern', 'jungfrau', '瑞士', '苏黎世', '日内瓦', '因特拉肯'] },
  { key: 'pl', label: 'Poland', labelZh: '波兰', aliases: ['poland', 'warsaw', 'krakow', 'gdansk', 'wroclaw', 'zakopane', '波兰', '华沙', '克拉科夫'] },
  {
    key: 'in', label: 'India', labelZh: '印度',
    aliases: ['india', 'delhi', 'new delhi', 'mumbai', 'agra', 'jaipur', 'goa', 'kerala', 'bangalore', 'udaipur', '印度', '新德里', '孟买'],
    blocked: ['little india', 'india street', '小印度'],
  },
  { key: 'au', label: 'Australia', labelZh: '澳大利亚', aliases: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'gold coast', 'cairns', 'adelaide', 'tasmania', '澳大利亚', '澳洲', '悉尼', '墨尔本', '布里斯班'] },
  { key: 'nz', label: 'New Zealand', labelZh: '新西兰', aliases: ['new zealand', 'auckland', 'queenstown', 'wellington', 'christchurch', 'rotorua', '新西兰', '奥克兰', '皇后镇'] },
  { key: 'vn', label: 'Vietnam', labelZh: '越南', aliases: ['vietnam', 'viet nam', 'hanoi', 'ho chi minh', 'saigon', 'da nang', 'hoi an', 'ha long', 'halong', 'sapa', '越南', '河内', '胡志明', '岘港', '下龙湾'] },
  { key: 'id', label: 'Indonesia', labelZh: '印尼', aliases: ['indonesia', 'bali', 'jakarta', 'yogyakarta', 'lombok', 'bandung', 'surabaya', 'ubud', 'borobudur', '印尼', '印度尼西亚', '巴厘岛', '雅加达'] },
  { key: 'nl', label: 'Netherlands', labelZh: '荷兰', aliases: ['netherlands', 'holland', 'amsterdam', 'rotterdam', 'utrecht', 'the hague', '荷兰', '阿姆斯特丹'] },
  { key: 'es', label: 'Spain', labelZh: '西班牙', aliases: ['spain', 'madrid', 'barcelona', 'seville', 'valencia', 'granada', 'ibiza', 'mallorca', 'malaga', '西班牙', '马德里', '巴塞罗那'] },
  { key: 'gr', label: 'Greece', labelZh: '希腊', aliases: ['greece', 'athens', 'santorini', 'mykonos', 'crete', 'rhodes', '希腊', '雅典', '圣托里尼'] },
  { key: 'pt', label: 'Portugal', labelZh: '葡萄牙', aliases: ['portugal', 'lisbon', 'porto', 'madeira', 'algarve', 'sintra', '葡萄牙', '里斯本', '波尔图'] },
  { key: 'br', label: 'Brazil', labelZh: '巴西', aliases: ['brazil', 'rio de janeiro', 'sao paulo', 'brasilia', 'salvador', 'iguazu', '巴西', '里约'] },
  { key: 'mx', label: 'Mexico', labelZh: '墨西哥', aliases: ['mexico', 'cancun', 'tulum', 'oaxaca', 'guadalajara', 'playa del carmen', '墨西哥', '坎昆'] },
  { key: 'ae', label: 'United Arab Emirates', labelZh: '阿联酋', aliases: ['united arab emirates', 'uae', 'dubai', 'abu dhabi', 'sharjah', '阿联酋', '迪拜', '阿布扎比'] },
  { key: 'no', label: 'Norway', labelZh: '挪威', aliases: ['norway', 'oslo', 'bergen', 'tromso', 'lofoten', 'svalbard', '挪威', '奥斯陆', '卑尔根'] },
];

/**
 * Lowercase, strip accents, and reduce every run of non-alphanumeric characters to one space.
 *
 * CJK characters are kept as-is and are NOT treated as word characters below, because Chinese
 * has no spaces: "东京之旅" must still find "东京", which a word-boundary rule would refuse.
 */
export function normalizeForMatch(s: string): string {
  return ` ${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9㐀-鿿豈-﫿]+/g, ' ')
    .trim()} `;
}

/** True when the alias is Latin text, and therefore needs word boundaries to avoid firing
 *  inside a longer word ("in" inside "insurance", "us" inside "business"). */
function needsWordBoundary(alias: string): boolean {
  return /^[a-z0-9 ]+$/.test(alias);
}

function containsAlias(haystack: string, alias: string): boolean {
  return needsWordBoundary(alias) ? haystack.includes(` ${alias} `) : haystack.includes(alias);
}

/** Aliases longest-first, so `south korea` is tested before `korea` and a more specific place
 *  wins. Built once: the table is a module constant. */
const ALIAS_INDEX: { alias: string; key: DestinationKey }[] = DESTINATIONS.flatMap((d) =>
  d.aliases.map((a) => ({ alias: normalizeForMatch(a).trim(), key: d.key }))
).sort((a, b) => b.alias.length - a.alias.length);

const BLOCKED_BY_KEY = new Map<DestinationKey, string[]>(
  DESTINATIONS.filter((d) => d.blocked?.length).map((d) => [
    d.key,
    d.blocked!.map((p) => normalizeForMatch(p).trim()),
  ])
);

/**
 * The destination a trip name refers to, or `null` when it does not clearly refer to one.
 *
 * Biased towards `null`. A trip called "Mum's birthday" showing a generic pin is unremarkable;
 * the same trip showing a pyramid is a bug the user has to go and correct, so an uncertain match
 * is not made. That bias is what the blocked phrases implement: "turkey dinner" and "China Town"
 * both contain a country and mean nothing of the sort.
 *
 * Blocked phrases are removed from the text before that destination is tested, rather than
 * disqualifying the whole name — "China Town then Beijing" is still a trip to China.
 */
export function matchDestination(name: string): DestinationKey | null {
  if (!name.trim()) return null;
  const normalized = normalizeForMatch(name);

  for (const { alias, key } of ALIAS_INDEX) {
    const blocked = BLOCKED_BY_KEY.get(key);
    const haystack = blocked
      ? normalizeForMatch(blocked.reduce((acc, phrase) => acc.split(phrase).join(' '), normalized))
      : normalized;
    if (containsAlias(haystack, alias)) return key;
  }

  return null;
}

const BY_KEY = new Map<DestinationKey, Destination>(DESTINATIONS.map((d) => [d.key, d]));

export function destinationByKey(key: string | null | undefined): Destination | null {
  return key ? BY_KEY.get(key as DestinationKey) ?? null : null;
}
