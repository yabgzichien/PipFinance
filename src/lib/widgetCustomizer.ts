import type { SlotId, WidgetMascotConfig } from '../widget/mascot/config';

/** Changing one composable part means the saved look is no longer a named preset. */
export function setSlot(
  config: WidgetMascotConfig,
  slot: SlotId,
  id: string
): WidgetMascotConfig {
  if (config[slot] === id) return config;
  return { ...config, [slot]: id, preset: 'custom' };
}
