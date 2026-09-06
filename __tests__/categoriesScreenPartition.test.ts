jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

import { partitionCategories } from '../src/screens/CategoriesScreen';
import type { Category } from '../src/lib/types';

const category = (id: string, isHidden: boolean): Category => ({
  id,
  label: id,
  icon: 'cart',
  hue: 162,
  kind: 'expense',
  isDefault: false,
  isHidden,
  templateKey: null,
  labelOverride: null,
  iconOverride: null,
  hueOverride: null,
});

describe('partitionCategories', () => {
  it('keeps hidden categories out of the visible management list without losing their identity', () => {
    const hidden = category('petrol', true);
    const result = partitionCategories([category('food', false), hidden]);

    expect(result.visible.map((entry) => entry.id)).toEqual(['food']);
    expect(result.hidden).toEqual([hidden]);
  });
});
