# Widget Mascot Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users customize the Android home-screen widget's mascot (hat, eyes, mouth, held prop), its size, the income/expense buttons, and the streak badge's look, from an in-app settings screen.

**Architecture:** A pure SVG-string composer. Mascot parts are z-layered `<g>` fragment strings in the existing 100-unit coordinate space, one part per slot, concatenated in z-order by `composeMascot(config, streak)`. Config is a single versioned JSON blob in `app_meta`, parsed by a function that can never throw (it runs in a headless widget context). The customizer screen renders the same composed string through `SvgXml`, so preview and widget cannot drift.

**Tech Stack:** TypeScript, React Native (Expo), `react-native-android-widget` 0.22.1, `react-native-svg` 15.12.1, expo-sqlite, Jest.

**Spec:** `docs/superpowers/specs/2026-09-08-widget-mascot-customization-design.md`

## Global Constraints

- **Android only.** All widget code no-ops off Android (`Platform.OS !== 'android'`), matching `src/widget/syncWidgets.ts:20`. The settings entry is hidden on other platforms.
- **`src/components/Pip.tsx` is never modified.** It is the source to transcribe *from*, read-only.
- **The mascot is one `SvgWidget`, one parse.** Never split parts across multiple `SvgWidget` elements — `src/widget/syncWidgets.ts:10-18` documents androidsvg bug BigBadaboom/androidsvg#46, an element-dropping race between concurrent parses.
- **`parseWidgetMascotConfig` must never throw.** It runs inside `src/widget/widgetTask.tsx`, a headless background context with no UI to report errors.
- **Defaults reproduce today's widget exactly:** Classic preset, `mascotNotch: 5`, `buttonNotch: 3`, both arrows on, amber flame badge.
- **All coordinates are 100-unit**, copied from `Pip.tsx` unchanged. The widget wraps them in `translate(5, 5) scale(0.54)` (`src/widget/QuickRecordWidget.tsx:31`).
- **Part ids are stable English strings** — they are persisted. Only display names are translated.
- **Width budget: 150dp. Height budget: 50dp.**
- Run tests with `npx jest <pattern>`. Typecheck with `npx tsc --noEmit`.

---

### Task 1: Config module — types, defaults, non-throwing parse

**Files:**
- Create: `src/widget/mascot/config.ts`
- Test: `__tests__/widgetMascotConfig.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `WidgetMascotConfig`, `DEFAULT_WIDGET_MASCOT_CONFIG`, `WIDGET_MASCOT_CONFIG_KEY`, `parseWidgetMascotConfig(raw: string | null): WidgetMascotConfig`, `serializeWidgetMascotConfig(c: WidgetMascotConfig): string`, types `SlotId`, `Notch`, `BadgeIcon`, `BadgeColor`, `PresetId`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetMascotConfig.test.ts
import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  parseWidgetMascotConfig,
  serializeWidgetMascotConfig,
} from '../src/widget/mascot/config';

describe('parseWidgetMascotConfig', () => {
  it('returns defaults for null (no key stored yet)', () => {
    expect(parseWidgetMascotConfig(null)).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('returns defaults for unparseable JSON instead of throwing', () => {
    expect(() => parseWidgetMascotConfig('{not json')).not.toThrow();
    expect(parseWidgetMascotConfig('{not json')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('returns defaults for JSON that is not an object', () => {
    expect(parseWidgetMascotConfig('42')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
    expect(parseWidgetMascotConfig('null')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
    expect(parseWidgetMascotConfig('[]')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('keeps valid fields and defaults the invalid ones, field by field', () => {
    const raw = JSON.stringify({
      version: 1,
      preset: 'custom',
      head: 'strawHat',
      eyes: 'notAPart',
      mouth: 'grin',
      holding: 'lollipop',
      mascotNotch: 99,
      buttonNotch: 2,
      showIncome: false,
      showExpense: 'yes',
      badgeIcon: 'star',
      badgeColor: 'chartreuse',
    });
    const c = parseWidgetMascotConfig(raw);
    expect(c.head).toBe('strawHat');
    // Part ids are shape-checked here (non-empty string) but validated against the catalog at
    // compose time, so an unknown id survives parsing and is resolved to the slot default by
    // resolvePart. This keeps config.ts free of catalog imports.
    expect(c.eyes).toBe('notAPart');
    expect(c.mouth).toBe('grin');
    expect(c.mascotNotch).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.mascotNotch);
    expect(c.buttonNotch).toBe(2);
    expect(c.showIncome).toBe(false);
    expect(c.showExpense).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.showExpense);
    expect(c.badgeIcon).toBe('star');
    expect(c.badgeColor).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.badgeColor);
  });

  it('never throws on hostile input', () => {
    const inputs = ['', ' ', '{}', '{"head":null}', '{"mascotNotch":"5"}', '{"version":"x"}'];
    for (const i of inputs) {
      expect(() => parseWidgetMascotConfig(i)).not.toThrow();
    }
  });

  it('round-trips through serialize', () => {
    const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, head: 'bandana', mascotNotch: 2 as const };
    expect(parseWidgetMascotConfig(serializeWidgetMascotConfig(c))).toEqual(c);
  });

  it("defaults reproduce today's widget", () => {
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.mascotNotch).toBe(5);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.buttonNotch).toBe(3);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.showIncome).toBe(true);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.showExpense).toBe(true);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.badgeIcon).toBe('flame');
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.preset).toBe('classic');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetMascotConfig`
Expected: FAIL — `Cannot find module '../src/widget/mascot/config'`

- [ ] **Step 3: Write the implementation**

```ts
// src/widget/mascot/config.ts
// The widget mascot's saved look. Stored as one JSON blob under a single app_meta key because
// it is only ever read and written whole.
//
// parseWidgetMascotConfig MUST NOT THROW. It is called from widgetTask.tsx, which runs in a
// headless background context: a throw there fails a home-screen render with no UI to report it.
// Every field falls back independently, so one bad value never discards the rest of the config.

export const WIDGET_MASCOT_CONFIG_KEY = 'widget_mascot_config';

export type SlotId = 'head' | 'eyes' | 'mouth' | 'holding';
export type Notch = 1 | 2 | 3 | 4 | 5;
export type BadgeIcon = 'flame' | 'star' | 'leaf' | 'sprout' | 'none';
export type BadgeColor = 'amber' | 'red' | 'green' | 'blue' | 'violet';
export type PresetId = 'classic' | 'nerdy' | 'cool' | 'swordsman' | 'scientist' | 'chef';

export interface WidgetMascotConfig {
  version: 1;
  preset: PresetId | 'custom';
  head: string;
  eyes: string;
  mouth: string;
  holding: string;
  mascotNotch: Notch;
  buttonNotch: Notch;
  showIncome: boolean;
  showExpense: boolean;
  badgeIcon: BadgeIcon;
  badgeColor: BadgeColor;
}

/** Reproduces the widget exactly as it shipped before customization existed, so a user who
 *  updates and never opens the customizer sees no change at all. */
export const DEFAULT_WIDGET_MASCOT_CONFIG: WidgetMascotConfig = {
  version: 1,
  preset: 'classic',
  head: 'none',
  eyes: 'default',
  mouth: 'smile',
  holding: 'none',
  mascotNotch: 5,
  buttonNotch: 3,
  showIncome: true,
  showExpense: true,
  badgeIcon: 'flame',
  badgeColor: 'amber',
};

const PRESET_IDS: readonly string[] = ['classic', 'nerdy', 'cool', 'swordsman', 'scientist', 'chef', 'custom'];
const BADGE_ICONS: readonly string[] = ['flame', 'star', 'leaf', 'sprout', 'none'];
const BADGE_COLORS: readonly string[] = ['amber', 'red', 'green', 'blue', 'violet'];

/** Part-id validity is checked against the catalog at compose time, not here — config.ts stays
 *  free of catalog imports so it can be read without pulling the whole art registry in. The one
 *  exception is the shape check: ids must be non-empty strings. */
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function oneOf(v: unknown, allowed: readonly string[], fallback: string): string {
  return typeof v === 'string' && allowed.includes(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function notch(v: unknown, fallback: Notch): Notch {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? v : fallback;
}

export function parseWidgetMascotConfig(raw: string | null): WidgetMascotConfig {
  const d = DEFAULT_WIDGET_MASCOT_CONFIG;
  if (!raw) return d;

  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return d;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return d;
  const o = obj as Record<string, unknown>;

  return {
    version: 1,
    preset: oneOf(o.preset, PRESET_IDS, d.preset) as PresetId | 'custom',
    head: str(o.head, d.head),
    eyes: str(o.eyes, d.eyes),
    mouth: str(o.mouth, d.mouth),
    holding: str(o.holding, d.holding),
    mascotNotch: notch(o.mascotNotch, d.mascotNotch),
    buttonNotch: notch(o.buttonNotch, d.buttonNotch),
    showIncome: bool(o.showIncome, d.showIncome),
    showExpense: bool(o.showExpense, d.showExpense),
    badgeIcon: oneOf(o.badgeIcon, BADGE_ICONS, d.badgeIcon) as BadgeIcon,
    badgeColor: oneOf(o.badgeColor, BADGE_COLORS, d.badgeColor) as BadgeColor,
  };
}

export function serializeWidgetMascotConfig(c: WidgetMascotConfig): string {
  return JSON.stringify(c);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest widgetMascotConfig`
Expected: PASS

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/widget/mascot/config.ts __tests__/widgetMascotConfig.test.ts
git commit -m "feat(widget): add mascot config type with non-throwing parser"
```

---

### Task 2: Composer core — z-ordered fragment assembly

**Files:**
- Create: `src/widget/mascot/parts/types.ts`, `src/widget/mascot/compose.ts`
- Test: `__tests__/widgetMascotCompose.test.ts`

**Interfaces:**
- Consumes: `WidgetMascotConfig`, `DEFAULT_WIDGET_MASCOT_CONFIG` from Task 1
- Produces: `MascotPart`, `PartLayer`, `Z` (z-band constants), `composeMascot(config: WidgetMascotConfig, streak: number): string`, `resolvePart(slot: SlotId, id: string): MascotPart | null`, `badgeLayer(icon: BadgeIcon, color: BadgeColor, streak: number): PartLayer | null`, `BADGE_THEMES: Record<BadgeColor, {icon:string;border:string;text:string}>`

This task builds the composer against a **stub catalog with one real part per slot**. Task 3 fills the catalog in; the composer does not change again.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetMascotCompose.test.ts
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { composeMascot } from '../src/widget/mascot/compose';

const cfg = (over: Partial<typeof DEFAULT_WIDGET_MASCOT_CONFIG> = {}) => ({
  ...DEFAULT_WIDGET_MASCOT_CONFIG,
  ...over,
});

describe('composeMascot', () => {
  it('produces a single well-formed svg element', () => {
    const svg = composeMascot(cfg(), 0);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  it('always draws the coin body', () => {
    expect(composeMascot(cfg(), 0)).toContain('data-part="body"');
  });

  it('includes a selected head part and omits it when set to none', () => {
    expect(composeMascot(cfg({ head: 'strawHat' }), 0)).toContain('data-part="strawHat"');
    expect(composeMascot(cfg({ head: 'none' }), 0)).not.toContain('data-part="strawHat"');
  });

  it('falls back to the slot default when the part id is unknown', () => {
    const svg = composeMascot(cfg({ head: 'nonexistentPart' }), 0);
    expect(svg).not.toContain('nonexistentPart');
    expect(svg).toContain('data-part="body"');
  });

  it('orders fragments by z ascending, so behind-body precedes body', () => {
    const svg = composeMascot(cfg({ holding: 'crossedKatana' }), 0);
    expect(svg.indexOf('data-part="crossedKatana"')).toBeLessThan(svg.indexOf('data-part="body"'));
  });

  it('renders the streak number', () => {
    expect(composeMascot(cfg(), 7)).toContain('>7<');
    expect(composeMascot(cfg(), 128)).toContain('>128<');
  });

  it('omits the badge entirely when badgeIcon is none', () => {
    expect(composeMascot(cfg({ badgeIcon: 'none' }), 7)).not.toContain('data-part="badge"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetMascotCompose`
Expected: FAIL — `Cannot find module '../src/widget/mascot/compose'`

- [ ] **Step 3: Write the part type module**

```ts
// src/widget/mascot/parts/types.ts
import type { SlotId } from '../config';

export interface PartLayer {
  /** Draw order. Lower draws first (further back). Use the Z constants. */
  z: number;
  /** An SVG fragment in the 100-unit coordinate space Pip.tsx draws in. Must carry
   *  data-part="<id>" on its outermost element so tests can assert presence. */
  svg: string;
}

export interface MascotPart {
  id: string;
  slot: SlotId;
  layers: PartLayer[];
}

/** Fixed z bands. A part may contribute layers in several of them — the straw hat's crown must
 *  sit under its own brim (Pip.tsx:412-437), and the swordsman's sheathed katana sit behind the
 *  coin while the bitten one sits in front (Pip.tsx:555-556). That is why parts carry layers
 *  rather than a single fragment. */
export const Z = {
  BEHIND: -20,
  BODY: 0,
  FACE: 20,
  HEAD: 40,
  FRONT: 60,
  BADGE: 80,
} as const;
```

- [ ] **Step 4: Write the composer with a stub catalog**

```ts
// src/widget/mascot/compose.ts
import type { WidgetMascotConfig, SlotId } from './config';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from './config';
import type { MascotPart, PartLayer } from './parts/types';
import { Z } from './parts/types';
import { PART_CATALOG } from './parts';
import { badgeLayer } from './badge';

/** The coin, sprout and shadow — not customizable. Pip is one fixed character rather than a
 *  shape that recolours (Pip.tsx:8); everything else layers onto this.
 *  Transcribed from QuickRecordWidget's original mascot block. */
const BODY_LAYER: PartLayer = {
  z: Z.BODY,
  svg: `<g data-part="body">
    <ellipse cx="50" cy="94" rx="22" ry="4.5" fill="rgba(16,40,28,0.14)" />
    <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3.6" fill="none" stroke-linecap="round" />
    <ellipse cx="42" cy="15" rx="8" ry="4.5" fill="#1c7a4e" transform="rotate(-32 42 15)" />
    <ellipse cx="58" cy="13" rx="9" ry="4.8" fill="#2aab68" transform="rotate(28 58 13)" />
    <circle cx="50" cy="56" r="33" fill="#F5B42A" />
    <circle cx="50" cy="56" r="26.6" fill="#FAC438" />
    <circle cx="50" cy="56" r="26.6" fill="none" stroke="#D99E18" stroke-width="2.6" />
    <ellipse cx="35" cy="42" rx="8.5" ry="4.9" fill="rgba(255,255,255,0.3)" transform="rotate(-26 35 42)" />
    <ellipse cx="31" cy="60" rx="5.5" ry="3.5" fill="#F07828" opacity="0.35" />
    <ellipse cx="69" cy="60" rx="5.5" ry="3.5" fill="#F07828" opacity="0.35" />
  </g>`,
};

/** Unknown ids resolve to the slot's default rather than throwing or rendering nothing. Config
 *  is validated for shape at parse time; validity against the catalog is checked here, because
 *  this is where the catalog lives. */
export function resolvePart(slot: SlotId, id: string): MascotPart | null {
  const forSlot = PART_CATALOG[slot];
  const hit = forSlot[id];
  if (hit) return hit;
  const fallbackId = DEFAULT_WIDGET_MASCOT_CONFIG[slot];
  return forSlot[fallbackId] ?? null;
}

export function composeMascot(config: WidgetMascotConfig, streak: number): string {
  const layers: PartLayer[] = [BODY_LAYER];

  for (const slot of ['head', 'eyes', 'mouth', 'holding'] as SlotId[]) {
    const part = resolvePart(slot, config[slot]);
    if (part) layers.push(...part.layers);
  }

  const badge = badgeLayer(config.badgeIcon, config.badgeColor, streak);
  if (badge) layers.push(badge);

  // Stable sort by z: parts within a band keep catalog order, which is what makes a hat's
  // crown/brim pair reliable.
  const ordered = layers
    .map((l, i) => ({ l, i }))
    .sort((a, b) => a.l.z - b.l.z || a.i - b.i)
    .map(({ l }) => l.svg);

  return `<svg width="76" height="64" viewBox="0 0 76 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="28" fill="#FFFFFF" stroke="#EAE5DA" stroke-width="1.2" />
  <g transform="translate(5, 5) scale(0.54)">
${ordered.join('\n')}
  </g>
</svg>`;
}
```

- [ ] **Step 5: Write the badge module**

```ts
// src/widget/mascot/badge.ts
// The streak badge. The user picks its icon and colour; its *form* is chosen by layout
// (compact pill here, expanded count+dots in QuickRecordWidget), never by a setting.
import type { BadgeIcon, BadgeColor } from './config';
import type { PartLayer } from './parts/types';
import { Z } from './parts/types';

interface BadgeTheme {
  icon: string;
  border: string;
  text: string;
}

export const BADGE_THEMES: Record<BadgeColor, BadgeTheme> = {
  amber: { icon: '#FAA81A', border: '#FED7AA', text: '#C2410C' },
  red: { icon: '#E2402A', border: '#FECACA', text: '#B91C1C' },
  green: { icon: '#1f8a5b', border: '#BBF7D0', text: '#166534' },
  blue: { icon: '#2563EB', border: '#BFDBFE', text: '#1D4ED8' },
  violet: { icon: '#7C3AED', border: '#DDD6FE', text: '#6D28D9' },
};

/** Icon glyphs, each drawn inside a 100x100 box and scaled to 0.16 by the caller — the same
 *  treatment the original flame got in QuickRecordWidget.tsx:54. */
const ICONS: Record<Exclude<BadgeIcon, 'none'>, (fill: string) => string> = {
  flame: (f) => `<path d="M49 12.5C53.5 22 57 32 58.6 39.6C61.1 33.2 65.4 28.9 70 26.8C73.2 33.8 79.6 47.2 80 64C80.4 82.2 62.9 99 41 99C19.1 99 1.6 82.2 2 64C2.2 56.2 4.1 51.4 7.6 46.8C9.1 39.9 17 26.7 25.2 20C26.7 27.2 30.7 36.2 36.6 42.6C40.1 46.2 43.1 42.2 44.6 35C45.7 29.6 47.2 20 49 12.5Z" fill="${f}" />`,
  star: (f) => `<path d="M50 4L62 38H98L69 59L80 95L50 73L20 95L31 59L2 38H38Z" fill="${f}" />`,
  leaf: (f) => `<path d="M84 10C84 10 22 6 12 52C6 80 30 96 46 90C74 80 84 40 84 10Z" fill="${f}" />`,
  sprout: (f) => `<path d="M50 96V44" stroke="${f}" stroke-width="10" stroke-linecap="round" /><ellipse cx="26" cy="34" rx="24" ry="13" fill="${f}" transform="rotate(-32 26 34)" /><ellipse cx="74" cy="28" rx="26" ry="14" fill="${f}" transform="rotate(28 74 28)" />`,
};

/**
 * Geometry note carried over from QuickRecordWidget.tsx:17-23: the icon and number are centred
 * as one cluster inside the pill. Pinning the icon to a fixed offset left the pair visibly
 * left-of-centre, worst in the common one-digit case.
 *
 * Coordinates here are in the OUTER 76x64 space, not the 100-unit mascot space, so this layer
 * is emitted outside the scaled group — see composeMascot's use of Z.BADGE.
 */
export function badgeLayer(icon: BadgeIcon, color: BadgeColor, streak: number): PartLayer | null {
  if (icon === 'none') return null;

  const theme = BADGE_THEMES[color];
  const s = String(streak);
  const pillW = s.length >= 3 ? 40 : s.length === 2 ? 34 : 28;
  const pillX = s.length >= 3 ? 34 : s.length === 2 ? 38 : 42;
  const ICON_W = 12.5;
  const GAP = 2;
  const CHAR_W = 6.5;
  const textW = CHAR_W * s.length;
  const contentX = pillX + (pillW - (ICON_W + GAP + textW)) / 2;
  const textX = contentX + ICON_W + GAP + textW / 2;

  return {
    z: Z.BADGE,
    svg: `<g data-part="badge">
      <rect x="${pillX}" y="40" width="${pillW}" height="18" rx="9" fill="#FFFFFF" stroke="${theme.border}" stroke-width="1.2" />
      <g transform="translate(${contentX}, 41) scale(0.16)">${ICONS[icon](theme.icon)}</g>
      <text x="${textX}" y="52.5" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="10.5" fill="${theme.text}">${s}</text>
    </g>`,
  };
}
```

Because the badge is in outer-space coordinates while parts are in the scaled group, `composeMascot` must emit `Z.BADGE` layers *outside* the `<g transform=...>`. Adjust `composeMascot` accordingly: partition `ordered` into `inner` (z < Z.BADGE) and `outer` (z >= Z.BADGE), and place `outer` after the closing `</g>`.

- [ ] **Step 6: Write the stub catalog index**

```ts
// src/widget/mascot/parts/index.ts
import type { MascotPart } from './types';
import type { SlotId } from '../config';
import { HEAD_PARTS } from './head';
import { EYES_PARTS } from './eyes';
import { MOUTH_PARTS } from './mouth';
import { HOLDING_PARTS } from './holding';

export const PART_CATALOG: Record<SlotId, Record<string, MascotPart>> = {
  head: HEAD_PARTS,
  eyes: EYES_PARTS,
  mouth: MOUTH_PARTS,
  holding: HOLDING_PARTS,
};
```

Create the four slot files with only the entries this task's tests need — `none` for every slot, `strawHat` in head, `crossedKatana` in holding, `default` in eyes, `smile` in mouth. Task 3 fills in the rest. Every `none` part is `{ id: 'none', slot, layers: [] }`.

For `smile` and `default`, transcribe from `Pip.tsx:1125-1148` (`Mouth`, the `idle` branch) and `Pip.tsx:221-266` (`Eyes`, the `idle` branch). For `strawHat`, transcribe `Pip.tsx:409-447`. For `crossedKatana`, transcribe `Pip.tsx:561-602` (`BackSwords`) at `z: Z.BEHIND`.

Transcription rules (JSX → SVG string), applied to every part in this and the next task:

1. `<Circle cx={50} cy={56} r={33} fill="#F5B42A" />` → `<circle cx="50" cy="56" r="33" fill="#F5B42A" />`. Element names lowercase; `Ellipse`→`ellipse`, `Path`→`path`, `G`→`g`, `Rect`→`rect`, `Line`→`line`.
2. Numeric braces become quoted strings: `strokeWidth={3.6}` → `stroke-width="3.6"`.
3. camelCase props become kebab-case attributes: `strokeWidth`→`stroke-width`, `strokeLinecap`→`stroke-linecap`, `strokeLinejoin`→`stroke-linejoin`, `fillOpacity`→`fill-opacity`, `textAnchor`→`text-anchor`, `fontSize`→`font-size`, `fontWeight`→`font-weight`, `clipPath`→`clip-path`.
4. `rotation={-16} originX={50} originY={70}` → `transform="rotate(-16 50 70)"`.
5. `testID="..."` is dropped. `data-part="<id>"` goes on the part's outermost `<g>`.
6. `INK` becomes the literal `#7A4800` (the value `COIN_INK` resolves to for the default body).
7. Drop `Animated*` wrappers and animation props — the widget renders one static frame. For `ConicalFlask`, omit the `Bubbles` call entirely.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest widgetMascotCompose`
Expected: PASS, 7 tests

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/widget/mascot/ __tests__/widgetMascotCompose.test.ts
git commit -m "feat(widget): add z-ordered mascot composer and badge module"
```

---

### Task 3: Fill the part catalog and add presets

**Files:**
- Modify: `src/widget/mascot/parts/{head,eyes,mouth,holding}.ts`
- Create: `src/widget/mascot/presets.ts`
- Test: `__tests__/widgetMascotCatalog.test.ts`

**Interfaces:**
- Consumes: `MascotPart`, `Z` from Task 2
- Produces: `HEAD_PARTS`, `EYES_PARTS`, `MOUTH_PARTS`, `HOLDING_PARTS` (each `Record<string, MascotPart>`), `PRESETS: Record<PresetId, Pick<WidgetMascotConfig,'head'|'eyes'|'mouth'|'holding'>>`, `applyPreset(config, id): WidgetMascotConfig`

Every part is transcribed from `Pip.tsx` using the seven rules in Task 2 Step 6. Sources, ids and z-bands:

| Slot | id | Source in `Pip.tsx` | z |
|---|---|---|---|
| head | `none` | — | — |
| head | `strawHat` | `StrawHat` 409-447 | crown+band `Z.HEAD`, brim `Z.HEAD` (brim after crown in array order) |
| head | `propellerCap` | `PropellerCap` 448-464 | `Z.HEAD` |
| head | `bandana` | `Bandana` 603-638 | `Z.HEAD` |
| head | `goggles` | `LabGoggles` 757-797 | `Z.HEAD` |
| eyes | `default` | `Eyes` 221-266, `idle` branch | `Z.FACE` |
| eyes | `big` | `NerdEyes` 335-351 | `Z.FACE` |
| eyes | `sassy` | `SassyFace` 498-560, eyes + brows only | `Z.FACE` |
| eyes | `shades` | `Sunglasses` 283-298 + `Brows` 299-310 | `Z.FACE` |
| eyes | `scarred` | `SwordsmanFace` 639-674, eye + scar only | `Z.FACE` |
| eyes | `blissful` | `EatingFace` 983-1009, eyes only | `Z.FACE` |
| mouth | `smile` | `Mouth` 1125-1148, `idle` branch | `Z.FACE` |
| mouth | `grin` | `Grin` 311-334 | `Z.FACE` |
| mouth | `open` | `Mouth` 1125-1148, `happy` branch | `Z.FACE` |
| mouth | `tongue` | `EatingFace` 983-1009, mouth only (incl. the `TONGUE` ellipse) | `Z.FACE` |
| mouth | `katanaBite` | `MouthKatana` 704-756 | `Z.FRONT` |
| holding | `none` | — | — |
| holding | `lollipop` | `Lollipop` 352-375 + `Hand` 376-408 | `Z.FRONT` |
| holding | `noodleBowl` | `NoodleBowl` 1010-1075 + `Chopsticks` 1076-1115 | `Z.FRONT` |
| holding | `flask` | `ConicalFlask` 898-942 + `TestTube` 943-982 | `Z.FRONT` |
| holding | `thumbsUp` | `Hands` 465-482 | `Z.FRONT` |
| holding | `crossedKatana` | `BackSwords` 561-602 | `Z.BEHIND` |

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetMascotCatalog.test.ts
import { PART_CATALOG } from '../src/widget/mascot/parts';
import { PRESETS, applyPreset } from '../src/widget/mascot/presets';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { composeMascot } from '../src/widget/mascot/compose';

const EXPECTED = {
  head: ['none', 'strawHat', 'propellerCap', 'bandana', 'goggles'],
  eyes: ['default', 'big', 'sassy', 'shades', 'scarred', 'blissful'],
  mouth: ['smile', 'grin', 'open', 'tongue', 'katanaBite'],
  holding: ['none', 'lollipop', 'noodleBowl', 'flask', 'thumbsUp', 'crossedKatana'],
} as const;

describe('part catalog', () => {
  for (const [slot, ids] of Object.entries(EXPECTED)) {
    it(`has every ${slot} option`, () => {
      expect(Object.keys(PART_CATALOG[slot as keyof typeof EXPECTED]).sort()).toEqual([...ids].sort());
    });
  }

  it('tags every non-empty part with its own data-part id and its declared slot', () => {
    for (const [slot, parts] of Object.entries(PART_CATALOG)) {
      for (const [id, part] of Object.entries(parts)) {
        expect(part.id).toBe(id);
        expect(part.slot).toBe(slot);
        if (part.layers.length > 0) {
          expect(part.layers.some((l) => l.svg.includes(`data-part="${id}"`))).toBe(true);
        }
      }
    }
  });

  it('emits no JSX-isms — every part is valid SVG-string syntax', () => {
    for (const parts of Object.values(PART_CATALOG)) {
      for (const part of Object.values(parts)) {
        for (const layer of part.layers) {
          expect(layer.svg).not.toMatch(/=\{/);            // strokeWidth={2}
          expect(layer.svg).not.toMatch(/\s(strokeWidth|strokeLinecap|fillOpacity|testID)=/);
          expect(layer.svg).not.toMatch(/<[A-Z]/);          // <Circle>
        }
      }
    }
  });
});

describe('presets', () => {
  it('classic reproduces the default slots', () => {
    expect(PRESETS.classic).toEqual({
      head: DEFAULT_WIDGET_MASCOT_CONFIG.head,
      eyes: DEFAULT_WIDGET_MASCOT_CONFIG.eyes,
      mouth: DEFAULT_WIDGET_MASCOT_CONFIG.mouth,
      holding: DEFAULT_WIDGET_MASCOT_CONFIG.holding,
    });
  });

  it('names only ids that exist in the catalog', () => {
    for (const slots of Object.values(PRESETS)) {
      for (const [slot, id] of Object.entries(slots)) {
        expect(PART_CATALOG[slot as keyof typeof PRESETS.classic][id]).toBeDefined();
      }
    }
  });

  it('applyPreset writes all four slots and records the preset id', () => {
    const c = applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, 'swordsman');
    expect(c.preset).toBe('swordsman');
    expect(c.head).toBe(PRESETS.swordsman.head);
    expect(c.holding).toBe(PRESETS.swordsman.holding);
  });

  it('every preset composes without throwing', () => {
    for (const id of Object.keys(PRESETS)) {
      const c = applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, id as keyof typeof PRESETS);
      expect(() => composeMascot(c, 3)).not.toThrow();
      expect(composeMascot(c, 3)).toContain('<svg');
    }
  });
});

/** Spec §10.5: an absent config must render the mascot the widget shipped with. Asserted as
 *  "every shape from the original hand-written SVG is still emitted" rather than byte equality,
 *  because composition legitimately adds data-part attributes and reorders by z.
 *
 *  Body, sprout and eye literals come from QuickRecordWidget.tsx:26-64 as it stood before this
 *  feature, and were verified to match Pip.tsx exactly. The MOUTH is the one shape where the two
 *  sources disagree: the old widget's hand-copy used `Q50 72` at stroke-width 3.4, while
 *  Pip.tsx:1136 draws `Q50 71` at 3.2. The catalog transcribes from Pip.tsx — it is the single
 *  art source this whole feature is built on — so the Pip.tsx value is the expected one. The
 *  divergence is one control-unit at scale(0.54), roughly half a pixel at render size, which does
 *  not breach the spec's "no visual change for users who never open the customizer". */
describe('default composition preserves the original artwork', () => {
  const ORIGINAL_SHAPES = [
    'M50 26 C50 18 50 14 50 12',                              // sprout stem
    '<circle cx="50" cy="56" r="33" fill="#F5B42A" />',       // coin edge
    '<circle cx="50" cy="56" r="26.6" fill="#FAC438" />',     // coin face
    'cx="40" cy="55" r="4.2"',                                // left eye
    'cx="60" cy="55" r="4.2"',                                // right eye
    'M43 64 Q50 71 57 64',                                    // smile (Pip.tsx:1136)
  ];

  it('emits every shape the pre-customization mascot drew', () => {
    const svg = composeMascot(DEFAULT_WIDGET_MASCOT_CONFIG, 5);
    for (const shape of ORIGINAL_SHAPES) {
      expect(svg).toContain(shape);
    }
  });

  it('still draws the amber flame badge with the streak count', () => {
    const svg = composeMascot(DEFAULT_WIDGET_MASCOT_CONFIG, 5);
    expect(svg).toContain('#FAA81A');
    expect(svg).toContain('>5<');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetMascotCatalog`
Expected: FAIL — missing part ids, and `Cannot find module '../src/widget/mascot/presets'`

- [ ] **Step 3: Transcribe the remaining parts**

Work slot file by slot file, using the table above and the seven transcription rules from Task 2 Step 6. Each entry has this exact shape:

```ts
// src/widget/mascot/parts/head.ts
import type { MascotPart } from './types';
import { Z } from './types';

export const HEAD_PARTS: Record<string, MascotPart> = {
  none: { id: 'none', slot: 'head', layers: [] },

  // Transcribed from Pip.tsx:409-447 (StrawHat). Crown and band are listed before the brim so
  // the brim's near edge occludes their base — reversing this turns the hat into a cake on a
  // plate (Pip.tsx:412-418).
  strawHat: {
    id: 'strawHat',
    slot: 'head',
    layers: [
      {
        z: Z.HEAD,
        svg: `<g data-part="strawHat">
          <!-- crown, band, brim, weave ring: transcribe Pip.tsx:409-447 in source order -->
        </g>`,
      },
    ],
  },
  // ... propellerCap, bandana, goggles
};
```

Verify each part visually before moving on: render it in isolation with `node -e` piping `composeMascot` output to a file and opening it, or lean on the Task 9 preview screen once it exists. A part that transcribes cleanly but reads wrong at 48dp is still a defect.

- [ ] **Step 4: Write the presets module**

```ts
// src/widget/mascot/presets.ts
// Presets are named slot configs, nothing more. Picking one writes all four slots; touching any
// individual slot afterwards flips `preset` to 'custom' (handled by the customizer screen).
import type { WidgetMascotConfig, PresetId } from './config';

export type PresetSlots = Pick<WidgetMascotConfig, 'head' | 'eyes' | 'mouth' | 'holding'>;

export const PRESETS: Record<PresetId, PresetSlots> = {
  classic: { head: 'none', eyes: 'default', mouth: 'smile', holding: 'none' },
  nerdy: { head: 'none', eyes: 'big', mouth: 'smile', holding: 'lollipop' },
  cool: { head: 'none', eyes: 'shades', mouth: 'grin', holding: 'thumbsUp' },
  swordsman: { head: 'bandana', eyes: 'scarred', mouth: 'katanaBite', holding: 'crossedKatana' },
  // ScientistFace's own mouth is a closed asymmetric line ~0.5px from `smile` at render scale,
  // so scientist takes `smile` rather than the catalog carrying a near-duplicate part.
  scientist: { head: 'goggles', eyes: 'default', mouth: 'smile', holding: 'flask' },
  // `tongue` IS EatingFace's mouth, so chef is the authentic eating pose.
  chef: { head: 'strawHat', eyes: 'blissful', mouth: 'tongue', holding: 'noodleBowl' },
};

export function applyPreset(config: WidgetMascotConfig, id: PresetId): WidgetMascotConfig {
  return { ...config, ...PRESETS[id], preset: id };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest widgetMascotCatalog widgetMascotCompose`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/widget/mascot/ __tests__/widgetMascotCatalog.test.ts
git commit -m "feat(widget): transcribe Pip art into mascot part catalog and presets"
```

---

### Task 4: Size ladders, width budget, and the manifest fix

**Files:**
- Create: `src/widget/mascot/sizing.ts`
- Modify: `app.json:57-58` and `app.json:67-68`
- Test: `__tests__/widgetMascotSizing.test.ts`

**Interfaces:**
- Consumes: `WidgetMascotConfig`, `Notch` from Task 1
- Produces: `MASCOT_SIZES: Record<Notch,{w:number;h:number}>`, `BUTTON_SIZES: Record<Notch,number>`, `WIDTH_BUDGET_DP`, `HEIGHT_BUDGET_DP`, `contentWidth(c: WidgetMascotConfig): number`

Context: `app.json` currently declares `minWidth: "110dp"`, but today's own contents already total 128dp (mascot 58 + buttons 26 + 26 + two 1dp dividers + 16dp padding). The declared minimum is already wrong; this task makes it honest rather than introducing the problem.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetMascotSizing.test.ts
import { DEFAULT_WIDGET_MASCOT_CONFIG, type Notch } from '../src/widget/mascot/config';
import { MASCOT_SIZES, BUTTON_SIZES, WIDTH_BUDGET_DP, contentWidth } from '../src/widget/mascot/sizing';

const NOTCHES: Notch[] = [1, 2, 3, 4, 5];

describe('sizing', () => {
  it('defaults reproduce the pre-customization dimensions', () => {
    expect(MASCOT_SIZES[5]).toEqual({ w: 58, h: 48 });
    expect(BUTTON_SIZES[3]).toBe(26);
  });

  it('both ladders increase monotonically', () => {
    for (let n = 2; n <= 5; n++) {
      expect(MASCOT_SIZES[n as Notch].w).toBeGreaterThan(MASCOT_SIZES[(n - 1) as Notch].w);
      expect(BUTTON_SIZES[n as Notch]).toBeGreaterThan(BUTTON_SIZES[(n - 1) as Notch]);
    }
  });

  it('every one of the 25 notch pairs fits the width budget with both arrows shown', () => {
    for (const m of NOTCHES) {
      for (const b of NOTCHES) {
        const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, mascotNotch: m, buttonNotch: b };
        expect(contentWidth(c)).toBeLessThanOrEqual(WIDTH_BUDGET_DP);
      }
    }
  });

  it('drops one divider and one button width when a single arrow is hidden', () => {
    const both = { ...DEFAULT_WIDGET_MASCOT_CONFIG };
    const one = { ...both, showExpense: false };
    expect(contentWidth(one)).toBe(contentWidth(both) - (1 + BUTTON_SIZES[both.buttonNotch]));
  });

  /** Arrows-off is NOT a narrower widget — it is a different layout. The freed space carries an
   *  expanded streak column (count above a 7-day dot row) that is wider than the two arrows it
   *  replaced: 16+58+8+68 = 150 against 16+58+2×(1+26) = 128 at the default notches. Asserting
   *  monotonic shrinkage here would contradict the design; what matters is that it still fits. */
  it('swaps in the wider streak column when both arrows are hidden', () => {
    const both = { ...DEFAULT_WIDGET_MASCOT_CONFIG };
    const none = { ...both, showIncome: false, showExpense: false };
    expect(contentWidth(none)).toBeGreaterThan(contentWidth(both));
    expect(contentWidth(none)).toBeLessThanOrEqual(WIDTH_BUDGET_DP);
  });

  it('the expanded arrows-off layout also fits the budget', () => {
    for (const m of NOTCHES) {
      const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, mascotNotch: m, showIncome: false, showExpense: false };
      expect(contentWidth(c)).toBeLessThanOrEqual(WIDTH_BUDGET_DP);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetMascotSizing`
Expected: FAIL — `Cannot find module '../src/widget/mascot/sizing'`

- [ ] **Step 3: Write the implementation**

```ts
// src/widget/mascot/sizing.ts
// Content sizing for the widget's interior. The widget's home-screen FOOTPRINT is resized by
// Android's long-press handles (app.json targetCellWidth/Height + the WIDGET_RESIZED action in
// widgetTask.tsx); these ladders scale what is drawn inside that footprint.
import type { WidgetMascotConfig, Notch } from './config';

export const MASCOT_SIZES: Record<Notch, { w: number; h: number }> = {
  1: { w: 38, h: 32 },
  2: { w: 43, h: 36 },
  3: { w: 48, h: 40 },
  4: { w: 53, h: 44 },
  5: { w: 58, h: 48 },
};

export const BUTTON_SIZES: Record<Notch, number> = { 1: 18, 2: 22, 3: 26, 4: 30, 5: 34 };

/** Raised from the 110dp app.json used to declare, which today's own default contents already
 *  exceeded (58 + 26 + 26 + 2 + 16 = 128dp). 150dp covers the widest combination
 *  (58 + 34 + 34 + 2 + 16 = 144dp) and is still a 2-cell widget on typical launchers. */
export const WIDTH_BUDGET_DP = 150;
export const HEIGHT_BUDGET_DP = 50;

const H_PADDING = 16;
const DIVIDER = 1;
/** Expanded streak column: a 7-dot row at 8dp with 2dp gaps, which also comfortably fits the
 *  count rendered above it. */
const STREAK_COLUMN = 68;
const COLUMN_GAP = 8;

export function contentWidth(c: WidgetMascotConfig): number {
  const mascot = MASCOT_SIZES[c.mascotNotch].w;
  const button = BUTTON_SIZES[c.buttonNotch];
  const arrows = (c.showIncome ? 1 : 0) + (c.showExpense ? 1 : 0);

  if (arrows === 0) {
    return H_PADDING + mascot + COLUMN_GAP + STREAK_COLUMN;
  }
  return H_PADDING + mascot + arrows * (DIVIDER + button);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest widgetMascotSizing`
Expected: PASS

- [ ] **Step 5: Fix the widget manifest**

In `app.json`, for **both** the `StreakWidget` and `QuickRecordWidget` entries, change `"minWidth": "110dp"` to `"minWidth": "150dp"` and `"minHeight": "40dp"` to `"minHeight": "50dp"`. Leave `targetCellWidth`/`targetCellHeight` at 2/1.

This changes generated Android manifest XML, so it needs a native rebuild (`npm run android`) to take effect — a Metro reload will not pick it up.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
git add src/widget/mascot/sizing.ts __tests__/widgetMascotSizing.test.ts app.json
git commit -m "feat(widget): add size ladders and correct the declared widget minimums"
```

---

### Task 5: Config-driven widget layout

**Files:**
- Modify: `src/widget/QuickRecordWidget.tsx` (full rewrite of the component body)
- Modify: `src/widget/StreakWidget.tsx`
- Test: `__tests__/quickRecordWidget.test.ts` (rewrite)

**Interfaces:**
- Consumes: `composeMascot` (Task 2), `MASCOT_SIZES`/`BUTTON_SIZES` (Task 4), `WidgetMascotConfig`/`DEFAULT_WIDGET_MASCOT_CONFIG` (Task 1)
- Produces: `QuickRecordWidget({ streak, dots, config }: QuickRecordWidgetProps)` where `QuickRecordWidgetProps = { streak?: number; dots?: boolean[]; config?: WidgetMascotConfig }`

The existing test asserts `children` has length 5 and reads buttons at fixed indices 0/2/4 (`__tests__/quickRecordWidget.test.ts:13,20,28,33`). A variable-length row invalidates that; children are located by `clickActionData.uri` instead, which is robust to layout changes regardless.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/quickRecordWidget.test.ts  (replaces the existing file)
import React from 'react';
import { QuickRecordWidget } from '../src/widget/QuickRecordWidget';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { MASCOT_SIZES, BUTTON_SIZES } from '../src/widget/mascot/sizing';

const cfg = (over = {}) => ({ ...DEFAULT_WIDGET_MASCOT_CONFIG, ...over });

/** Recursively collects every element carrying a clickActionData uri. */
function byUri(el: any): Record<string, any> {
  const out: Record<string, any> = {};
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    const uri = node.props?.clickActionData?.uri;
    if (uri) out[uri] = node;
    React.Children.toArray(node.props?.children ?? []).forEach(walk);
  };
  walk(el);
  return out;
}

describe('QuickRecordWidget layout', () => {
  it('renders mascot, income and expense targets by default', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg() }));
    expect(Object.keys(found).sort()).toEqual(
      ['pip://add', 'pip://add?type=expense', 'pip://add?type=income'].sort()
    );
  });

  it('drops only the hidden arrow when one is turned off', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg({ showExpense: false }) }));
    expect(found['pip://add?type=income']).toBeDefined();
    expect(found['pip://add?type=expense']).toBeUndefined();
    expect(found['pip://add']).toBeDefined();
  });

  it('collapses to a single add target when both arrows are off', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg({ showIncome: false, showExpense: false }) }));
    expect(Object.keys(found)).toEqual(['pip://add']);
  });

  it('shows the expanded streak count and 7 dots only when both arrows are off', () => {
    const dots = [true, true, false, true, false, false, true];
    const expanded = QuickRecordWidget({ streak: 9, dots, config: cfg({ showIncome: false, showExpense: false }) });
    const json = JSON.stringify(expanded);
    expect(json).toContain('data-streak-dots');
    const compact = JSON.stringify(QuickRecordWidget({ streak: 9, dots, config: cfg() }));
    expect(compact).not.toContain('data-streak-dots');
  });

  it('applies the mascot and button size notches', () => {
    const el = QuickRecordWidget({ streak: 1, config: cfg({ mascotNotch: 2, buttonNotch: 5 }) });
    const json = JSON.stringify(el);
    expect(json).toContain(`"width":${MASCOT_SIZES[2].w}`);
    expect(json).toContain(`"width":${BUTTON_SIZES[5]}`);
  });

  it('renders the chosen badge colour in the mascot svg', () => {
    const el = QuickRecordWidget({ streak: 4, config: cfg({ badgeColor: 'blue' }) });
    expect(JSON.stringify(el)).toContain('#2563EB');
  });

  it('renders multi-digit streaks', () => {
    for (const n of [5, 12, 128]) {
      expect(JSON.stringify(QuickRecordWidget({ streak: n, config: cfg() }))).toContain(`>${n}<`);
    }
  });

  it('falls back to defaults when no config is passed', () => {
    const found = byUri(QuickRecordWidget({ streak: 0 }));
    expect(Object.keys(found)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest quickRecordWidget`
Expected: FAIL — `QuickRecordWidget` does not accept `config`, and no `data-streak-dots` exists

- [ ] **Step 3: Rewrite the widget**

```tsx
// src/widget/QuickRecordWidget.tsx
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetMascotConfig } from './mascot/config';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from './mascot/config';
import { composeMascot } from './mascot/compose';
import { BADGE_THEMES } from './mascot/badge';
import { MASCOT_SIZES, BUTTON_SIZES } from './mascot/sizing';

export interface QuickRecordWidgetProps {
  streak?: number;
  dots?: boolean[];
  config?: WidgetMascotConfig;
}

const UP_ARROW_SVG = `
<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 5L6 13M14 5L22 13M14 5V23" stroke="#1f8a5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`.trim();

const DOWN_ARROW_SVG = `
<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 23L6 15M14 23L22 15M14 23V5" stroke="#d6453f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`.trim();

/** The 7-day activity row, recovered from the StreakWidget that shipped at commit f1bcbbd and
 *  fed by compute7DayDots. Only rendered in the expanded layout, where hiding both arrows has
 *  freed the room for it. */
function dotsRowSvg(dots: boolean[], color: string): string {
  const safe = dots.length === 7 ? dots : Array.from({ length: 7 }, (_, i) => dots[i] ?? false);
  const cells = safe
    .map((on, i) => {
      const cx = 4 + i * 10;
      return on
        ? `<circle cx="${cx}" cy="4" r="4" fill="${color}" />`
        : `<circle cx="${cx}" cy="4" r="3.2" fill="none" stroke="#C9C2B4" stroke-width="1.4" />`;
    })
    .join('');
  return `<svg data-streak-dots width="68" height="8" viewBox="0 0 68 8" fill="none" xmlns="http://www.w3.org/2000/svg">${cells}</svg>`;
}

function Divider() {
  return <FlexWidget style={{ width: 1, height: 32, backgroundColor: '#e6e0d2' }} />;
}

export function QuickRecordWidget({
  streak = 0,
  dots = [],
  config = DEFAULT_WIDGET_MASCOT_CONFIG,
}: QuickRecordWidgetProps = {}) {
  const mascot = MASCOT_SIZES[config.mascotNotch];
  const button = BUTTON_SIZES[config.buttonNotch];
  const expanded = !config.showIncome && !config.showExpense;
  const badge = BADGE_THEMES[config.badgeColor];

  // The badge is drawn into the mascot svg only in the compact layouts. When expanded, the count
  // is a TextWidget beside the dots row, so the pill would duplicate it.
  const mascotSvg = composeMascot(
    expanded ? { ...config, badgeIcon: 'none' } : config,
    streak
  );

  const mascotButton = (
    <FlexWidget
      style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'pip://add' }}
      accessibilityLabel="Add Transaction"
    >
      <SvgWidget svg={mascotSvg} style={{ width: mascot.w, height: mascot.h }} />
    </FlexWidget>
  );

  const shell = {
    width: 'match_parent' as const,
    height: 'match_parent' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: '#faf8f2',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
  };

  if (expanded) {
    // Whole widget is one add target; the freed space carries the streak instead of arrows.
    return (
      <FlexWidget
        style={{ ...shell, justifyContent: 'flex-start' }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pip://add' }}
        accessibilityLabel="Add Transaction"
      >
        <SvgWidget svg={mascotSvg} style={{ width: mascot.w, height: mascot.h }} />
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGap: 4 }}>
          <TextWidget
            text={String(streak)}
            style={{ fontSize: 18, fontWeight: '700', color: badge.text }}
          />
          <SvgWidget svg={dotsRowSvg(dots, badge.icon)} style={{ width: 68, height: 8 }} />
        </FlexWidget>
      </FlexWidget>
    );
  }

  return (
    <FlexWidget style={shell}>
      {mascotButton}
      {config.showIncome && <Divider />}
      {config.showIncome && (
        <FlexWidget
          style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'pip://add?type=income' }}
          accessibilityLabel="Record Income"
        >
          <SvgWidget svg={UP_ARROW_SVG} style={{ width: button, height: button }} />
        </FlexWidget>
      )}
      {config.showExpense && <Divider />}
      {config.showExpense && (
        <FlexWidget
          style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'pip://add?type=expense' }}
          accessibilityLabel="Record Expense"
        >
          <SvgWidget svg={DOWN_ARROW_SVG} style={{ width: button, height: button }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
```

- [ ] **Step 4: Forward config through the legacy alias**

```tsx
// src/widget/StreakWidget.tsx — update the signature only
import type { WidgetMascotConfig } from './mascot/config';

export interface StreakWidgetProps {
  streak?: number;
  dots?: boolean[];
  config?: WidgetMascotConfig;
}

export function StreakWidget({ streak = 0, dots = [], config }: StreakWidgetProps = {}) {
  return <QuickRecordWidget streak={streak} dots={dots} config={config} />;
}
```

Keep the existing comment explaining why the alias exists — widgets placed before the Quick Record update still point at this provider name.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest quickRecordWidget streakWidget`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/widget/QuickRecordWidget.tsx src/widget/StreakWidget.tsx __tests__/quickRecordWidget.test.ts
git commit -m "feat(widget): drive widget layout from mascot config"
```

---

### Task 6: Read the config in the widget render paths

**Files:**
- Modify: `src/widget/syncStreakWidget.tsx`, `src/widget/syncQuickRecordWidget.tsx`, `src/widget/widgetTask.tsx`
- Test: `__tests__/widgetConfigLoad.test.ts`

**Interfaces:**
- Consumes: `parseWidgetMascotConfig`, `WIDGET_MASCOT_CONFIG_KEY` (Task 1), `getMeta` (`src/db/metaRepo.ts`)
- Produces: `getStreakWidgetData(providedTxns?)` gains a `config: WidgetMascotConfig` field on its return value

`getStreakWidgetData` is the single place both sync paths and the task handler already fetch data, so the config joins it there rather than being read three times.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetConfigLoad.test.ts
jest.mock('../src/db/metaRepo', () => ({ getMeta: jest.fn(), setMeta: jest.fn() }));
jest.mock('../src/db/txnRepo', () => ({ listTransactions: jest.fn().mockResolvedValue([]) }));

import { getMeta } from '../src/db/metaRepo';
import { getStreakWidgetData } from '../src/widget/syncStreakWidget';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';

describe('getStreakWidgetData config loading', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the stored config', async () => {
    (getMeta as jest.Mock).mockResolvedValue(JSON.stringify({ ...DEFAULT_WIDGET_MASCOT_CONFIG, head: 'bandana' }));
    const data = await getStreakWidgetData([]);
    expect(data.config.head).toBe('bandana');
  });

  it('falls back to defaults when the key is absent', async () => {
    (getMeta as jest.Mock).mockResolvedValue(null);
    const data = await getStreakWidgetData([]);
    expect(data.config).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('falls back to defaults when the read throws, without propagating', async () => {
    (getMeta as jest.Mock).mockRejectedValue(new Error('db closed'));
    await expect(getStreakWidgetData([])).resolves.toMatchObject({ config: DEFAULT_WIDGET_MASCOT_CONFIG });
  });

  it('falls back to defaults on corrupt stored JSON', async () => {
    (getMeta as jest.Mock).mockResolvedValue('{{{');
    const data = await getStreakWidgetData([]);
    expect(data.config).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetConfigLoad`
Expected: FAIL — `data.config` is undefined

- [ ] **Step 3: Load the config in `getStreakWidgetData`**

In `src/widget/syncStreakWidget.tsx`, add the import and extend the return value:

```ts
import { getMeta } from '../db/metaRepo';
import { parseWidgetMascotConfig, WIDGET_MASCOT_CONFIG_KEY, DEFAULT_WIDGET_MASCOT_CONFIG } from './mascot/config';

export async function getStreakWidgetData(providedTxns?: Transaction[]) {
  let txns: Transaction[];
  if (providedTxns) {
    txns = providedTxns;
  } else {
    try {
      txns = await listTransactions();
    } catch {
      txns = [];
    }
  }

  // A failed read must not break the render: this runs headless from widgetTask.tsx, where a
  // throw fails a home-screen widget with no UI to report it.
  let config = DEFAULT_WIDGET_MASCOT_CONFIG;
  try {
    config = parseWidgetMascotConfig(await getMeta(WIDGET_MASCOT_CONFIG_KEY));
  } catch {
    // keep defaults
  }

  const now = new Date();
  return { streak: computeStreak(txns, now), dots: compute7DayDots(txns, now), config };
}
```

Then pass `config` in the same file's `syncStreakWidget` render call: `<StreakWidget streak={data.streak} dots={data.dots} config={data.config} />`.

- [ ] **Step 4: Thread config through the other two call sites**

In `src/widget/syncQuickRecordWidget.tsx`, change the render to
`<QuickRecordWidget streak={data.streak} dots={data.dots} config={data.config} />`.

In `src/widget/widgetTask.tsx`, both branches already call `getStreakWidgetData()`; add `dots={data.dots} config={data.config}` to the `StreakWidget` renders and `dots={data.dots} config={data.config}` to the `QuickRecordWidget` render.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest widgetConfigLoad quickRecordWidget streakWidget`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/widget/ __tests__/widgetConfigLoad.test.ts
git commit -m "feat(widget): load mascot config in widget render paths"
```

---

### Task 7: Store wiring — expose and persist the config

**Files:**
- Modify: `src/state/store.tsx`
- Test: `__tests__/widgetMascotStore.test.ts`

**Interfaces:**
- Consumes: Task 1 config module, Task 6's widget sync
- Produces: `useAppData()` gains `widgetMascotConfig: WidgetMascotConfig` and `setWidgetMascotConfig: (c: WidgetMascotConfig) => Promise<void>`

Follow the existing preference pattern exactly: a `useState` beside `motionSetting` (`store.tsx:558`), a load in the boot `Promise.all` (`store.tsx:570`), a resolve line (`store.tsx:616`), a `useCallback` setter shaped like `setMotionSetting` (`store.tsx:1263`), and an entry in the context value (`store.tsx:2259`).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetMascotStore.test.ts
// The setter's contract, tested without mounting the provider: persist, then sync widgets.
jest.mock('../src/db/metaRepo', () => ({ getMeta: jest.fn(), setMeta: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/widget/syncWidgets', () => ({ syncAllWidgets: jest.fn().mockResolvedValue(undefined) }));

import { setMeta } from '../src/db/metaRepo';
import { syncAllWidgets } from '../src/widget/syncWidgets';
import { persistWidgetMascotConfig } from '../src/state/store';
import { DEFAULT_WIDGET_MASCOT_CONFIG, WIDGET_MASCOT_CONFIG_KEY } from '../src/widget/mascot/config';

describe('persistWidgetMascotConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the serialized config under the right key', async () => {
    const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, head: 'goggles' as const };
    await persistWidgetMascotConfig(c);
    expect(setMeta).toHaveBeenCalledWith(WIDGET_MASCOT_CONFIG_KEY, JSON.stringify(c));
  });

  it('pushes the change to placed widgets after persisting', async () => {
    await persistWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG);
    expect(syncAllWidgets).toHaveBeenCalled();
  });

  it('still resolves when the widget sync fails', async () => {
    (syncAllWidgets as jest.Mock).mockRejectedValueOnce(new Error('no widget placed'));
    await expect(persistWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetMascotStore`
Expected: FAIL — `persistWidgetMascotConfig` is not exported from store

- [ ] **Step 3: Add the exported helper and wire the provider**

Add near the other preference helpers in `src/state/store.tsx`:

```ts
import {
  WIDGET_MASCOT_CONFIG_KEY,
  DEFAULT_WIDGET_MASCOT_CONFIG,
  parseWidgetMascotConfig,
  serializeWidgetMascotConfig,
  type WidgetMascotConfig,
} from '../widget/mascot/config';
import { syncAllWidgets } from '../widget/syncWidgets';

/** Exported so the persistence contract is testable without mounting the provider. A widget
 *  sync failure is non-fatal: the user may simply have no widget placed. */
export async function persistWidgetMascotConfig(config: WidgetMascotConfig): Promise<void> {
  await setMeta(WIDGET_MASCOT_CONFIG_KEY, serializeWidgetMascotConfig(config));
  await syncAllWidgets().catch(() => {});
}
```

Then, inside `AppDataProvider`:

1. Beside `store.tsx:558`: `const [widgetMascotConfig, setWidgetMascotConfigState] = useState<WidgetMascotConfig>(DEFAULT_WIDGET_MASCOT_CONFIG);`
2. Add `getMeta(WIDGET_MASCOT_CONFIG_KEY)` to the boot `Promise.all` at `store.tsx:570`, destructured as `widgetMascotRaw`.
3. Beside `store.tsx:616`: `setWidgetMascotConfigState(parseWidgetMascotConfig(widgetMascotRaw));`
4. Beside `store.tsx:1263`:

```ts
const setWidgetMascotConfig = useCallback(async (config: WidgetMascotConfig) => {
  await persistWidgetMascotConfig(config);
  setWidgetMascotConfigState(config);
}, []);
```

5. Add `widgetMascotConfig` and `setWidgetMascotConfig` to the context type (beside `store.tsx:424-425`) and to the value object (beside `store.tsx:2259`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest widgetMascotStore settingsStore`
Expected: PASS

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/state/store.tsx __tests__/widgetMascotStore.test.ts
git commit -m "feat(widget): expose mascot config through app data store"
```

---

### Task 8: NotchedSlider component

**Files:**
- Create: `src/components/NotchedSlider.tsx`, `src/lib/notchedSlider.ts`
- Test: `__tests__/notchedSlider.test.ts`

**Interfaces:**
- Consumes: `ProgressTrack` styling conventions from `src/components/ui.tsx:390`
- Produces: `notchFromX(x: number, trackWidth: number, count: number): number` (1-indexed), `NotchedSlider({ value, count, onChange, label }: { value: number; count: number; onChange: (n: number) => void; label?: string })`

There is no slider in the app today — no `@react-native-community/slider` dependency and no `PanResponder` usage anywhere in `src/` — so this is built from scratch. The geometry is extracted into a pure module so it can be tested without a renderer; the component is a thin `PanResponder` shell over it.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/notchedSlider.test.ts
import { notchFromX } from '../src/lib/notchedSlider';

describe('notchFromX', () => {
  const W = 200;

  it('snaps the extremes to the first and last notch', () => {
    expect(notchFromX(0, W, 5)).toBe(1);
    expect(notchFromX(W, W, 5)).toBe(5);
  });

  it('clamps beyond either end rather than going out of range', () => {
    expect(notchFromX(-40, W, 5)).toBe(1);
    expect(notchFromX(W + 40, W, 5)).toBe(5);
  });

  it('snaps to the nearest notch', () => {
    expect(notchFromX(W / 2, W, 5)).toBe(3);
    expect(notchFromX(W * 0.24, W, 5)).toBe(2);
    expect(notchFromX(W * 0.26, W, 5)).toBe(2);
  });

  it('always returns an integer inside 1..count', () => {
    for (let x = -10; x <= W + 10; x += 3) {
      const n = notchFromX(x, W, 5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('degrades safely on a zero-width track (pre-layout)', () => {
    expect(notchFromX(0, 0, 5)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest notchedSlider`
Expected: FAIL — `Cannot find module '../src/lib/notchedSlider'`

- [ ] **Step 3: Write the geometry module**

```ts
// src/lib/notchedSlider.ts
/** Maps a touch x within a track to a 1-indexed notch. Pure so the snapping can be tested
 *  without a renderer; NotchedSlider is a PanResponder shell over this. */
export function notchFromX(x: number, trackWidth: number, count: number): number {
  if (trackWidth <= 0 || count <= 1) return 1;
  const ratio = Math.max(0, Math.min(1, x / trackWidth));
  return Math.round(ratio * (count - 1)) + 1;
}
```

- [ ] **Step 4: Write the component**

```tsx
// src/components/NotchedSlider.tsx
import React, { useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { notchFromX } from '../lib/notchedSlider';
import { useAccent, useThemeColors } from '../theme';
import { Caption } from './ui';

const THUMB = 22;

export function NotchedSlider({
  value,
  count,
  onChange,
  label,
}: {
  value: number;
  count: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  // Reads widthRef, not width: the responder closes over its creation-time render.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(notchFromX(e.nativeEvent.locationX, widthRef.current, count)),
      onPanResponderMove: (e) => onChange(notchFromX(e.nativeEvent.locationX, widthRef.current, count)),
    })
  ).current;

  const pct = count > 1 ? (value - 1) / (count - 1) : 0;

  return (
    <View>
      {label ? <Caption>{label}</Caption> : null}
      <View style={styles.row} onLayout={onLayout} {...pan.panHandlers}>
        <View style={[styles.track, { backgroundColor: colorTheme.line }]} />
        <View style={[styles.track, styles.fill, { width: `${pct * 100}%`, backgroundColor: theme.accent }]} />
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            style={[
              styles.notch,
              {
                left: count > 1 ? `${(i / (count - 1)) * 100}%` : '0%',
                backgroundColor: i + 1 <= value ? theme.accent : colorTheme.line,
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.thumb,
            { left: Math.max(0, pct * width - THUMB / 2), backgroundColor: theme.accent },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 44, justifyContent: 'center' },
  track: { height: 7, borderRadius: 999 },
  fill: { position: 'absolute' },
  notch: { position: 'absolute', width: 3, height: 3, borderRadius: 999, marginLeft: -1.5 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#fff',
  },
});
```

Check the actual export names in `src/theme` before wiring `useAccent`/`useThemeColors`; match whatever `ui.tsx:390-393` imports.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest notchedSlider`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/NotchedSlider.tsx src/lib/notchedSlider.ts __tests__/notchedSlider.test.ts
git commit -m "feat(ui): add notched slider component"
```

---

### Task 9: Customizer screen

**Files:**
- Create: `src/screens/WidgetCustomizerScreen.tsx`
- Test: `__tests__/widgetCustomizerState.test.ts`
- Create: `src/lib/widgetCustomizer.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-4 and 8, `useAppData()` from Task 7
- Produces: `setSlot(config, slot, id): WidgetMascotConfig`, `WidgetCustomizerScreen({ onBack }: { onBack: () => void })`

The screen's only non-obvious logic — that changing any slot demotes the config to `'custom'` — is extracted so it can be tested without rendering.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetCustomizerState.test.ts
import { setSlot } from '../src/lib/widgetCustomizer';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { applyPreset } from '../src/widget/mascot/presets';

describe('setSlot', () => {
  it('changes the slot and demotes the preset to custom', () => {
    const c = setSlot(applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, 'nerdy'), 'head', 'bandana');
    expect(c.head).toBe('bandana');
    expect(c.preset).toBe('custom');
  });

  it('leaves the other slots untouched', () => {
    const base = applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, 'chef');
    const c = setSlot(base, 'mouth', 'grin');
    expect(c.head).toBe(base.head);
    expect(c.eyes).toBe(base.eyes);
    expect(c.holding).toBe(base.holding);
  });

  it('does not demote when the value is unchanged', () => {
    const base = applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, 'cool');
    expect(setSlot(base, 'head', base.head).preset).toBe('cool');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetCustomizerState`
Expected: FAIL — `Cannot find module '../src/lib/widgetCustomizer'`

- [ ] **Step 3: Write the state helper**

```ts
// src/lib/widgetCustomizer.ts
import type { WidgetMascotConfig, SlotId } from '../widget/mascot/config';

/** Touching any individual slot means the look is no longer one of the named presets. Setting a
 *  slot to the value it already holds is not a change, so it does not demote. */
export function setSlot(config: WidgetMascotConfig, slot: SlotId, id: string): WidgetMascotConfig {
  if (config[slot] === id) return config;
  return { ...config, [slot]: id, preset: 'custom' };
}
```

- [ ] **Step 4: Write the screen**

```tsx
// src/screens/WidgetCustomizerScreen.tsx
import React, { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useAppData } from '../state/store';
import { useI18n } from '../i18n';
import { TopBar, Card, Eyebrow, Body, Caption, PrimaryButton } from '../components/ui';
import { NotchedSlider } from '../components/NotchedSlider';
import { composeMascot } from '../widget/mascot/compose';
import { PART_CATALOG } from '../widget/mascot/parts';
import { PRESETS, applyPreset } from '../widget/mascot/presets';
import { setSlot } from '../lib/widgetCustomizer';
import type { SlotId, PresetId, Notch, BadgeIcon, BadgeColor } from '../widget/mascot/config';

const SLOTS: SlotId[] = ['head', 'eyes', 'mouth', 'holding'];
const BADGE_ICONS: BadgeIcon[] = ['flame', 'star', 'leaf', 'sprout', 'none'];
const BADGE_COLORS: BadgeColor[] = ['amber', 'red', 'green', 'blue', 'violet'];

export function WidgetCustomizerScreen({ onBack }: { onBack: () => void }) {
  const { widgetMascotConfig, setWidgetMascotConfig } = useAppData();
  const { t } = useI18n();
  const [draft, setDraft] = useState(widgetMascotConfig);
  const [saving, setSaving] = useState(false);

  // The preview renders the exact string the widget renders, so the two cannot drift.
  const previewSvg = composeMascot(draft, 7);

  const save = async () => {
    setSaving(true);
    try {
      await setWidgetMascotConfig(draft);
      onBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <TopBar title={t('widgetCustomizer')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.preview}>
          <SvgXml xml={previewSvg} width={152} height={128} />
        </Card>

        <Eyebrow>{t('widgetPreset')}</Eyebrow>
        <View style={styles.chips}>
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <Pressable
              key={id}
              onPress={() => setDraft(applyPreset(draft, id))}
              style={[styles.chip, draft.preset === id && styles.chipOn]}
            >
              <Body>{t(`widgetPreset_${id}` as never)}</Body>
            </Pressable>
          ))}
        </View>

        {SLOTS.map((slot) => (
          <View key={slot}>
            <Eyebrow>{t(`widgetSlot_${slot}` as never)}</Eyebrow>
            <View style={styles.chips}>
              {Object.keys(PART_CATALOG[slot]).map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setDraft(setSlot(draft, slot, id))}
                  style={[styles.chip, draft[slot] === id && styles.chipOn]}
                >
                  <Body>{t(`widgetPart_${id}` as never)}</Body>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Eyebrow>{t('widgetSize')}</Eyebrow>
        <NotchedSlider
          label={t('widgetMascotSize')}
          value={draft.mascotNotch}
          count={5}
          onChange={(n) => setDraft({ ...draft, mascotNotch: n as Notch })}
        />
        <NotchedSlider
          label={t('widgetButtonSize')}
          value={draft.buttonNotch}
          count={5}
          onChange={(n) => setDraft({ ...draft, buttonNotch: n as Notch })}
        />

        <Eyebrow>{t('widgetButtons')}</Eyebrow>
        <Pressable onPress={() => setDraft({ ...draft, showIncome: !draft.showIncome })} style={styles.rowToggle}>
          <Body>{t('widgetShowIncome')}</Body>
          <Caption>{draft.showIncome ? t('on') : t('off')}</Caption>
        </Pressable>
        <Pressable onPress={() => setDraft({ ...draft, showExpense: !draft.showExpense })} style={styles.rowToggle}>
          <Body>{t('widgetShowExpense')}</Body>
          <Caption>{draft.showExpense ? t('on') : t('off')}</Caption>
        </Pressable>
        {!draft.showIncome && !draft.showExpense && <Caption>{t('widgetArrowsOffHint')}</Caption>}

        <Eyebrow>{t('widgetStreakBadge')}</Eyebrow>
        <View style={styles.chips}>
          {BADGE_ICONS.map((icon) => (
            <Pressable key={icon} onPress={() => setDraft({ ...draft, badgeIcon: icon })} style={[styles.chip, draft.badgeIcon === icon && styles.chipOn]}>
              <Body>{t(`widgetBadge_${icon}` as never)}</Body>
            </Pressable>
          ))}
        </View>
        <View style={styles.chips}>
          {BADGE_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setDraft({ ...draft, badgeColor: c })} style={[styles.chip, draft.badgeColor === c && styles.chipOn]}>
              <Body>{t(`widgetColor_${c}` as never)}</Body>
            </Pressable>
          ))}
        </View>

        <PrimaryButton onPress={save} disabled={saving} label={t('save')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  preview: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipOn: { borderWidth: 2 },
  rowToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
});
```

Match `TopBar` and `PrimaryButton`'s real prop names against `src/components/ui.tsx:322` and `:360` before finishing — the shapes above assume `label`/`onPress`/`onBack`, and the codebase is the authority.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest widgetCustomizerState`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/screens/WidgetCustomizerScreen.tsx src/lib/widgetCustomizer.ts __tests__/widgetCustomizerState.test.ts
git commit -m "feat(widget): add mascot customizer screen"
```

---

### Task 10: Navigation, settings entry, and translations

**Files:**
- Modify: `src/lib/screenNav.ts:7-28`, `src/lib/screenNav.ts:45-79`
- Modify: `App.tsx:735-745`
- Modify: `src/screens/SettingsScreen.tsx:30` and `:186-215`
- Modify: `src/lib/settingsSearch.ts`
- Modify: `src/i18n/types.ts`, `src/i18n/translations/en.ts`, `src/i18n/translations/zh.ts`
- Test: `__tests__/screenNav.test.ts` (extend), `__tests__/widgetSettingsSearch.test.ts`

**Interfaces:**
- Consumes: `WidgetCustomizerScreen` from Task 9
- Produces: `'widgetCustomizer'` as a `Screen` value routing back to `'settings'`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/widgetSettingsSearch.test.ts
import { SETTING_DEFINITIONS } from '../src/lib/settingsSearch';

describe('widget customizer settings entry', () => {
  const entry = SETTING_DEFINITIONS.find((d) => d.key === 'widgetMascot');

  it('is registered in the appearance section', () => {
    expect(entry).toBeDefined();
    expect(entry!.section).toBe('appearance');
  });

  it('is findable by English and Chinese search terms', () => {
    for (const term of ['widget', 'mascot', 'hat', '小组件', '挂件']) {
      expect(entry!.keywords).toContain(term);
    }
  });
});
```

Add to `__tests__/screenNav.test.ts`:

```ts
it('routes the widget customizer back to settings', () => {
  expect(backTargetFor('widgetCustomizer', {} as any)).toBe('settings');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest widgetSettingsSearch screenNav`
Expected: FAIL — no `widgetMascot` definition; `'widgetCustomizer'` not assignable to `Screen`

- [ ] **Step 3: Extend navigation**

In `src/lib/screenNav.ts`, add `| 'widgetCustomizer'` to the `Screen` union, and add `case 'widgetCustomizer':` to the group that already returns `'settings'` (alongside `'advancedImport'`, `'tax'`, `'categories'`, `'backup'` at `screenNav.ts:49-53`).

In `App.tsx`, add the render beside the backup line at `:745`:

```tsx
{screen === 'widgetCustomizer' && <WidgetCustomizerScreen onBack={goBack} />}
```

and pass a new prop into `SettingsScreen` beside `onOpenBackup` at `:739`:

```tsx
onOpenWidgetCustomizer={() => setScreen('widgetCustomizer')}
```

- [ ] **Step 4: Add the settings entry**

In `src/screens/SettingsScreen.tsx:30`, add `onOpenWidgetCustomizer?: () => void` to the props type and destructuring.

In the appearance block (`:186-215`), after the motion card, add a navigating card. It is Android-only, matching the widget's own platform gate:

```tsx
{matchingKeys.has('widgetMascot') && Platform.OS === 'android' && (
  <Pressable onPress={onOpenWidgetCustomizer}>
    <Card style={{ padding: 16 }}>
      <Text style={[styles.providerName, { color: colorTheme.ink }]}>{t('widgetCustomizer')}</Text>
      <Text style={[styles.providerHint, { color: colorTheme.muted }]}>{t('widgetCustomizerHint')}</Text>
    </Card>
  </Pressable>
)}
```

Confirm `Platform` is imported in that file; add it if not. Reuse whatever hint-text style the neighbouring cards use rather than inventing `providerHint` if it does not exist.

- [ ] **Step 5: Register it in settings search**

Add to `SETTING_DEFINITIONS` in `src/lib/settingsSearch.ts`, following the shape of the `theme` entry at `:49-78`:

```ts
{
  key: 'widgetMascot',
  section: 'appearance',
  sectionTitleEn: 'Appearance',
  sectionTitleZh: '外观与偏好',
  titleEn: 'Widget mascot',
  titleZh: '小组件挂件',
  keywords: [
    'widget', 'mascot', 'pip', 'hat', 'eyes', 'mouth', 'streak badge',
    'home screen', 'customize', 'customise',
    '小组件', '挂件', '桌面', '帽子', '眼睛', '嘴巴', '自定义',
  ],
},
```

- [ ] **Step 6: Add translations**

Add these keys to `src/i18n/types.ts` and to both `en.ts` and `zh.ts`, keeping each file's existing alphabetical//grouping convention:

`widgetCustomizer`, `widgetCustomizerHint`, `widgetPreset`, `widgetSize`, `widgetMascotSize`, `widgetButtonSize`, `widgetButtons`, `widgetShowIncome`, `widgetShowExpense`, `widgetArrowsOffHint`, `widgetStreakBadge`, plus one key per preset (`widgetPreset_classic|nerdy|cool|swordsman|scientist|chef`), per slot (`widgetSlot_head|eyes|mouth|holding`), per part id (`widgetPart_<id>` for all 22 catalog ids), per badge icon (`widgetBadge_flame|star|leaf|sprout|none`) and per badge colour (`widgetColor_amber|red|green|blue|violet`).

English values are the display names from the spec's catalog table ("Straw hat", "Propeller cap", "Bandana", "Goggles", "Big eyes", "Sassy", "Shades", "Scarred", "Blissful", "Smile", "Grin", "Open", "Tongue", "Katana bite", "Lollipop", "Noodle bowl", "Flask", "Thumbs up", "Crossed katana", "None"). `widgetArrowsOffHint`: "With both arrows off, the widget shows your streak instead."

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest widgetSettingsSearch screenNav`
Expected: PASS

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/screenNav.ts App.tsx src/screens/SettingsScreen.tsx src/lib/settingsSearch.ts src/i18n/ __tests__/
git commit -m "feat(widget): add customizer entry to settings, nav and translations"
```

---

### Task 11: Backup round-trip

**Files:**
- Modify: `src/lib/backupBundle.ts:88-95`
- Modify: `src/db/restoreRepo.ts:430-436`
- Test: `__tests__/widgetMascotBackup.test.ts`

**Interfaces:**
- Consumes: Task 1 config module, Task 7's store field
- Produces: `preferences.settings.widgetMascotConfig` in the backup payload

`restoreRepo.ts:425-445` enumerates preference keys explicitly rather than copying `app_meta` wholesale, so a key that is not added on both sides is silently lost on restore.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/widgetMascotBackup.test.ts
import { parseWidgetMascotConfig, serializeWidgetMascotConfig, DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';

describe('widget mascot config backup round-trip', () => {
  it('survives serialize -> payload -> parse unchanged', () => {
    const original = {
      ...DEFAULT_WIDGET_MASCOT_CONFIG,
      preset: 'custom' as const,
      head: 'goggles',
      eyes: 'big',
      mascotNotch: 2 as const,
      showExpense: false,
      badgeColor: 'violet' as const,
    };
    // What backupBundle writes into preferences.settings:
    const payloadValue = serializeWidgetMascotConfig(original);
    // What restoreRepo writes back into app_meta, then what the widget reads:
    expect(parseWidgetMascotConfig(payloadValue)).toEqual(original);
  });

  it('a payload missing the field restores to defaults rather than failing', () => {
    const settings: Record<string, unknown> = { motionSetting: 'full' };
    const raw = typeof settings.widgetMascotConfig === 'string' ? settings.widgetMascotConfig : null;
    expect(parseWidgetMascotConfig(raw)).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest widgetMascotBackup`
Expected: PASS on the pure functions alone — this test guards the contract. The wiring below is what makes it meaningful; verify by inspection that both sides are edited.

- [ ] **Step 3: Add the field to the export payload**

In `src/lib/backupBundle.ts`, inside `preferences.settings` (`:88-95`), add:

```ts
widgetMascotConfig: data.widgetMascotConfig ? serializeWidgetMascotConfig(data.widgetMascotConfig) : undefined,
```

`data` comes from `useAppData()`, which gained `widgetMascotConfig` in Task 7. Import `serializeWidgetMascotConfig` from `../widget/mascot/config`.

- [ ] **Step 4: Add the field to restore**

In `src/db/restoreRepo.ts`, in the `if (s)` block (`:430-436`), add:

```ts
if (typeof s.widgetMascotConfig === 'string') meta.widget_mascot_config = s.widgetMascotConfig;
```

The key name must be the literal `widget_mascot_config`, matching `WIDGET_MASCOT_CONFIG_KEY`. Import the constant instead of hardcoding if the surrounding code imports its other keys; match local convention.

- [ ] **Step 5: Run the full suite**

Run: `npx jest`
Expected: PASS, all suites. The pre-existing count was 114 suites / 1616 tests; this plan adds 9 suites.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/backupBundle.ts src/db/restoreRepo.ts __tests__/widgetMascotBackup.test.ts
git commit -m "feat(widget): round-trip mascot config through backup and restore"
```

---

### Task 12: Device verification

**Files:** none — this is a manual gate before the work is called done.

Automated tests cover composition, parsing, sizing and layout structure. None of them prove the widget *renders* on Android, and the two highest-risk failure modes are invisible to Jest: androidsvg dropping elements, and parts that transcribe correctly but read wrong at 48dp.

- [ ] **Step 1: Rebuild natively**

```bash
npm run android
```

A rebuild is required — `app.json`'s `minWidth`/`minHeight` changes in Task 4 alter generated manifest XML, which a Metro reload does not pick up. Do not run `expo prebuild --clean`: `android/` is gitignored and hand-maintained (see `.env.example`).

- [ ] **Step 2: Verify the default is unchanged**

Place a fresh widget without opening the customizer. It must look identical to the pre-change widget: large mascot, both arrows, amber flame badge.

- [ ] **Step 3: Walk every preset**

For each of the six presets, save and confirm the placed widget updates and that no part is missing. A part that renders in the in-app preview but not on the home screen is the androidsvg race — that is what the one-parse constraint exists to prevent, so investigate rather than retry.

- [ ] **Step 4: Verify both layout transitions**

Turn off one arrow, then both. Confirm the expanded layout shows the count and seven dots, that the whole widget opens the add flow, and that nothing clips at the widget's smallest resize.

- [ ] **Step 5: Verify persistence**

Force-stop the app, then confirm the widget still renders the saved look — this exercises the headless `widgetTask.tsx` path rather than the in-app sync path.

- [ ] **Step 6: Verify backup**

Export a backup, reset, restore, and confirm the mascot returns.

---

## Notes for the executor

- **Task order matters.** Tasks 1-4 are pure modules with no dependencies on the app; 5-7 wire them into the widget; 8-10 build the UI; 11 covers backup; 12 is the manual gate. Tasks 8 and 9 could run in parallel with 5-7 if you are dispatching subagents, but 9 consumes 8.
- **Task 3 is the bulk of the work** — 22 parts transcribed from `Pip.tsx`. It is mechanical, but it is the one task where a "passing" result can still look wrong. Budget real time for looking at the output.
- **If a transcribed part reads badly at widget scale**, the fix is adjusting the part, not the composer. The composer is done after Task 2.
