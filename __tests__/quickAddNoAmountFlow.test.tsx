import React from 'react';
import { View } from 'react-native';
import { AddFlow } from '../src/screens/AddFlow';
import type { Category } from '../src/lib/types';

const mockCategories: Category[] = [
  { id: 'food', label: 'Food', icon: 'gift', hue: 20, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  { id: 'travelling', label: 'Transport', icon: 'gift', hue: 40, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  { id: 'other', label: 'Other Expenses', icon: 'dots', hue: 220, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  { id: 'salary', label: 'Salary', icon: 'wallet', hue: 140, kind: 'income', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
];

jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));
jest.mock('../src/lib/sound', () => ({
  playSavedChime: jest.fn(),
}));

let mockCapturedAttachProps: any = null;
let mockCapturedManualProps: any = null;

jest.mock('../src/screens/AttachScreen', () => {
  const { View } = require('react-native');
  return {
    AttachScreen: (props: any) => {
      mockCapturedAttachProps = props;
      return <View testID="attach-screen" />;
    },
  };
});

jest.mock('../src/screens/ManualEntryScreen', () => {
  const { View } = require('react-native');
  return {
    ManualEntryScreen: (props: any) => {
      mockCapturedManualProps = props;
      return <View testID="manual-entry-screen" />;
    },
  };
});

jest.mock('../src/llm', () => ({
  getLLM: async () => ({
    can: () => false,
    quickAdd: async () => [],
    guessCategories: async () => [],
  }),
}));

jest.mock('../src/db/currencyRepo', () => ({
  getActiveCurrencies: async () => ['MYR'],
}));

jest.mock('../src/db/memoryRepo', () => ({
  getAutoFillForMonth: async () => ({ filled: 0, total: 0 }),
  recordAutoFill: async () => {},
}));

jest.mock('../src/db/fxRepo', () => ({
  listFxRates: async () => ({}),
}));

jest.mock('../src/state/store', () => ({
  useAppData: () => ({
    categories: mockCategories,
    entryCategories: mockCategories,
    memory: {},
    transactions: [],
    accounts: [],
    ensureDefaultAccount: async () => 'acc_default',
    recordBalanceLink: async () => {},
    trips: [],
    markTaskDone: jest.fn(),
  }),
}));

jest.mock('../src/state/colorScheme', () => ({
  useThemeColors: () => ({
    background: '#fff',
    surface: '#fff',
    text: '#000',
    ink: '#000',
    ink2: '#666',
    ink3: '#999',
    line: '#eee',
    lineSoft: '#f0f0f0',
  }),
}));

jest.mock('../src/i18n', () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    isZh: false,
    formatFullDate: (d: string) => d,
  }),
}));

const TestRenderer = require('react-test-renderer');

describe('AddFlow — Quick Add with no amount navigates to ManualEntryScreen', () => {
  beforeEach(() => {
    mockCapturedAttachProps = null;
    mockCapturedManualProps = null;
  });

  it('routes to ManualEntryScreen with auto-selected category when amount is missing', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<AddFlow onClose={jest.fn()} />);
      await Promise.resolve();
    });

    expect(mockCapturedAttachProps).not.toBeNull();
    expect(tree.root.findByProps({ testID: 'attach-screen' })).toBeDefined();

    // Trigger quick add with "Lunch" (no amount)
    await TestRenderer.act(async () => {
      await mockCapturedAttachProps.onQuickAdd('Lunch');
      await Promise.resolve();
    });

    // Should now render ManualEntryScreen
    expect(mockCapturedManualProps).not.toBeNull();
    expect(tree.root.findByProps({ testID: 'manual-entry-screen' })).toBeDefined();

    // Verify props passed to ManualEntryScreen:
    // - initialMerchant is "Lunch"
    // - initialCategoryId is auto-selected to "food"
    // - initialAmount is null
    expect(mockCapturedManualProps.initialMerchant).toBe('Lunch');
    expect(mockCapturedManualProps.initialCategoryId).toBe('food');
    expect(mockCapturedManualProps.initialCategorySource).toBe('guess');
    expect(mockCapturedManualProps.initialAmount).toBeNull();
  });

  it('routes to ManualEntryScreen with auto-selected travelling category for "Travel"', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<AddFlow onClose={jest.fn()} />);
      await Promise.resolve();
    });

    // Trigger quick add with "Travel" (no amount)
    await TestRenderer.act(async () => {
      await mockCapturedAttachProps.onQuickAdd('Travel');
      await Promise.resolve();
    });

    expect(mockCapturedManualProps).not.toBeNull();
    expect(mockCapturedManualProps.initialMerchant).toBe('Travel');
    expect(mockCapturedManualProps.initialCategoryId).toBe('travelling');
    expect(mockCapturedManualProps.initialAmount).toBeNull();
  });

  it('routes to ManualEntryScreen immediately with prefilled amount for pure number input (e.g. "25", "RM 50") without LLM', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<AddFlow onClose={jest.fn()} />);
      await Promise.resolve();
    });

    // Trigger quick add with pure number "25"
    await TestRenderer.act(async () => {
      await mockCapturedAttachProps.onQuickAdd('25');
      await Promise.resolve();
    });

    expect(mockCapturedManualProps).not.toBeNull();
    expect(tree.root.findByProps({ testID: 'manual-entry-screen' })).toBeDefined();
    // Verify amount is prefilled with 25 and no merchant/category is forced
    expect(mockCapturedManualProps.initialAmount).toBe(25);
    expect(mockCapturedManualProps.initialMerchant).toBe('');
  });
});


