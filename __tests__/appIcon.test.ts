import { setDynamicAppIcon, getDynamicAppIcon } from '../src/lib/appIcon';
import { ACCENT_PRESETS, DEFAULT_ACCENT_PRESET_ID } from '../src/state/accentPresets';

describe('appIcon', () => {
  it('handles all accent presets without throwing', async () => {
    for (const preset of ACCENT_PRESETS) {
      const ok = await setDynamicAppIcon(preset.id);
      expect(ok).toBe(true);
    }
  });

  it('falls back safely on unknown preset ids', async () => {
    const ok = await setDynamicAppIcon('non_existent_preset');
    expect(ok).toBe(true);
  });

  it('returns default preset on non-native platform', async () => {
    const icon = await getDynamicAppIcon();
    expect(icon).toBe(DEFAULT_ACCENT_PRESET_ID);
  });
});
