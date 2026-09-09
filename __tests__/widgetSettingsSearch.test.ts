import { SETTING_DEFINITIONS } from '../src/lib/settingsSearch';

describe('widget customizer settings entry', () => {
  const entry = SETTING_DEFINITIONS.find((definition) => definition.key === 'widgetMascot');

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
