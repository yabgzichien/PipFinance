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
