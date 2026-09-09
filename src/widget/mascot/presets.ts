// Presets are named slot configs, nothing more. Picking one writes all four slots; touching any
// individual slot afterwards flips `preset` to 'custom' (handled by the customizer screen).
import type { WidgetMascotConfig, PresetId } from './config';

export type PresetSlots = Pick<WidgetMascotConfig, 'head' | 'eyes' | 'mouth' | 'holding'>;

export const PRESETS: Record<PresetId, PresetSlots> = {
  classic: { head: 'none', eyes: 'default', mouth: 'smile', holding: 'none' },
  nerdy: { head: 'none', eyes: 'big', mouth: 'smile', holding: 'lollipop' },
  cool: { head: 'none', eyes: 'shades', mouth: 'grin', holding: 'thumbsUp' },
  swordsman: { head: 'bandana', eyes: 'scarred', mouth: 'katanaBite', holding: 'crossedKatana' },
  scientist: { head: 'goggles', eyes: 'default', mouth: 'smile', holding: 'flask' },
  chef: { head: 'strawHat', eyes: 'blissful', mouth: 'tongue', holding: 'noodleBowl' },
};

export function applyPreset(config: WidgetMascotConfig, id: PresetId): WidgetMascotConfig {
  return { ...config, ...PRESETS[id], preset: id };
}
