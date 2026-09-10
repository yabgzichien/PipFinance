// Tab structure for the widget customizer.
//
// The screen used to be one long scroll of eight sections, which put every option on screen at
// once and pushed the preview out of view exactly when someone was choosing. Splitting it into
// tabs keeps the preview pinned and shows one decision at a time. This module holds the parts
// that are pure logic — which tabs exist, what each owns, whether it differs from stock, and how
// each tab's thumbnails are framed — so they can be tested without a renderer.
import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  type SlotId,
  type WidgetMascotConfig,
} from '../widget/mascot/config';

export type CustomizerTab = 'preset' | SlotId | 'badge';

/** Display order, left to right. Mascot appearance first, then the badge. Layout controls are
 *  now persistently available at the bottom of every tab selection rather than a separate tab. */
export const CUSTOMIZER_TABS: CustomizerTab[] = [
  'preset',
  'head',
  'eyes',
  'mouth',
  'holding',
  'badge',
];

/** The five tabs whose options are chosen from the part catalog. */
export const SLOT_TABS: SlotId[] = ['head', 'eyes', 'mouth', 'holding'];

export function isSlotTab(tab: CustomizerTab): tab is SlotId {
  return (SLOT_TABS as CustomizerTab[]).includes(tab);
}

/**
 * A viewBox into the mascot's 76x64 space, used to frame that tab's option thumbnails on the
 * part being chosen.
 *
 * This is what lets the tiles carry no text: two mouth shapes are nearly identical on a whole
 * mascot at thumbnail size, but obvious when the tile is cropped to the mouth. Coordinates come
 * from where each feature lands after the mascot's own `translate(5,5) scale(0.54)`.
 */
export interface ThumbFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL: ThumbFrame = { x: 0, y: 0, w: 76, h: 64 };

export const THUMB_FRAMES: Record<CustomizerTab, ThumbFrame> = {
  // Whole mascot: presets change everything, and held props reach the outer edges.
  preset: FULL,
  holding: FULL,
  // Crown of the coin plus the space a hat occupies above it.
  head: { x: 10, y: 3, w: 44, h: 33 },
  // The eye band, tight enough that brow and lash differences read.
  eyes: { x: 18, y: 24, w: 28, h: 19 },
  // Lower face. Overlaps the eye band slightly so the crop still reads as a face.
  mouth: { x: 18, y: 31, w: 28, h: 19 },
  badge: FULL,
};

/**
 * Which config fields each tab owns. Used to decide whether a tab differs from stock, which the
 * strip shows as a dot — hiding options behind tabs is only safe if people can still see where
 * they have been.
 */
const TAB_FIELDS: Record<CustomizerTab, (keyof WidgetMascotConfig)[]> = {
  preset: ['preset'],
  head: ['head'],
  eyes: ['eyes'],
  mouth: ['mouth'],
  holding: ['holding'],
  badge: ['badgeIcon', 'badgeColor'],
};

export function tabIsModified(tab: CustomizerTab, config: WidgetMascotConfig): boolean {
  return TAB_FIELDS[tab].some((field) => config[field] !== DEFAULT_WIDGET_MASCOT_CONFIG[field]);
}

/** Every tab that differs from stock, in display order. */
export function modifiedTabs(config: WidgetMascotConfig): CustomizerTab[] {
  return CUSTOMIZER_TABS.filter((tab) => tabIsModified(tab, config));
}
