import { duration, isMotionSetting, motionSettingLabel, MOTION_SETTINGS } from '../src/theme/motion';

describe('motionSettingLabel', () => {
  it('maps every setting to its Settings-pill label', () => {
    expect(motionSettingLabel('full')).toBe('Full');
    expect(motionSettingLabel('reduced')).toBe('Reduced');
    expect(motionSettingLabel('off')).toBe('Off');
  });
});

describe('isMotionSetting', () => {
  it('accepts every value in MOTION_SETTINGS', () => {
    for (const setting of MOTION_SETTINGS) {
      expect(isMotionSetting(setting)).toBe(true);
    }
  });

  it('rejects anything else, including stale or hand-edited app_meta values', () => {
    expect(isMotionSetting('reduce')).toBe(false);
    expect(isMotionSetting('')).toBe(false);
    expect(isMotionSetting(null)).toBe(false);
    expect(isMotionSetting(undefined)).toBe(false);
    expect(isMotionSetting(1)).toBe(false);
  });
});

describe('duration', () => {
  it('keeps routine motion inside the 300ms NN/g ceiling and complex transitions inside the 500ms one (docs/ui-engagement-plan.md §2.8)', () => {
    expect(duration.micro).toBeLessThanOrEqual(300);
    expect(duration.base).toBeLessThanOrEqual(300);
    expect(duration.enter).toBeLessThanOrEqual(500);
    expect(duration.celebrate).toBeLessThanOrEqual(500);
  });

  it('orders strictly ascending, so no tier is a no-op duplicate of another', () => {
    expect(duration.micro).toBeLessThan(duration.base);
    expect(duration.base).toBeLessThan(duration.enter);
    expect(duration.enter).toBeLessThan(duration.celebrate);
  });
});
