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
  if (content === 'streak' && config[other] === 'streak') next[other] = 'none';
  return next;
}
