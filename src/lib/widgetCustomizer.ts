import type { SlotContent, SlotId, WidgetMascotConfig } from '../widget/mascot/config';

/** Changing one composable part means the saved look is no longer a named preset. */
export function setSlot(
  config: WidgetMascotConfig,
  slot: SlotId,
  id: string
): WidgetMascotConfig {
  if (config[slot] === id) return config;
  return { ...config, [slot]: id, preset: 'custom' };
}

/**
 * Set what one of the two widget slots holds.
 *
 * Enforces the same single-streak rule `parseWidgetMascotConfig` applies on load: moving the
 * streak badge into one slot takes it out of the other, rather than letting the UI build a state
 * the parser would silently rewrite on next launch. Slot contents are widget layout, not mascot
 * appearance, so this does not clear the preset.
 */
export function setSlotContent(
  config: WidgetMascotConfig,
  which: 'slot1' | 'slot2',
  content: SlotContent
): WidgetMascotConfig {
  if (config[which] === content) return config;
  const other = which === 'slot1' ? 'slot2' : 'slot1';
  const next = { ...config, [which]: content };
  if (content === 'streak' && config[other] === 'streak') {
    next[other] = 'none';
  }
  return next;
}

/**
 * Checks whether two widget mascot configurations are identical across all configurable options.
 */
export function isWidgetMascotConfigEqual(
  a: WidgetMascotConfig,
  b: WidgetMascotConfig
): boolean {
  return (
    a.preset === b.preset &&
    a.head === b.head &&
    a.eyes === b.eyes &&
    a.mouth === b.mouth &&
    a.holding === b.holding &&
    a.mascotNotch === b.mascotNotch &&
    a.buttonNotch === b.buttonNotch &&
    a.animationNotch === b.animationNotch &&
    a.slot1 === b.slot1 &&
    a.slot2 === b.slot2 &&
    a.badgeIcon === b.badgeIcon &&
    a.badgeColor === b.badgeColor
  );
}

