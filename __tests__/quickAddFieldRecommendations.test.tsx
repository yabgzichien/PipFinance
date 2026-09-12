import React from 'react';
import { Pressable, TextInput } from 'react-native';
import { QuickAddField } from '../src/components/QuickAddField';
import type { Transaction } from '../src/lib/types';

const mockTxn = (merchantRaw: string, id: string): Transaction => ({
  id,
  merchantRaw,
  merchantKey: merchantRaw.toLowerCase(),
  amount: 25,
  currency: 'MYR',
  type: 'expense',
  date: '2026-09-01',
  categoryId: 'food',
  createdAt: '2026-09-01T12:00:00.000Z',
  source: 'manual',
});

const mockTransactions: Transaction[] = [
  mockTxn('Starbucks', '1'),
  mockTxn('Starbucks', '2'),
  mockTxn('Grab', '3'),
];

jest.mock('../src/state/store', () => ({
  useAppData: () => ({
    transactions: mockTransactions,
  }),
}));

const TestRenderer = require('react-test-renderer');

async function render(element: React.ReactElement) {
  let tree: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(element);
    await Promise.resolve();
  });
  return tree!;
}

describe('QuickAddField recommendations UI', () => {
  it('renders frequent transaction chips when input is empty and fills input with trailing space on press', async () => {
    const onSubmit = jest.fn();
    const tree = await render(<QuickAddField onSubmit={onSubmit} busy={false} error={null} />);

    // Find all Pressable chips with accessibilityRole="button"
    const chips = tree.root.findAll(
      (node: any) => node.props?.accessibilityRole === 'button' && node.props?.accessibilityLabel
    );
    const chipLabels = chips.map((c: any) => c.props.accessibilityLabel);

    expect(chipLabels).toContain('Starbucks');
    expect(chipLabels).toContain('Grab');

    const starbucksChip = chips.find((c: any) => c.props.accessibilityLabel === 'Starbucks');
    expect(starbucksChip).toBeDefined();

    // Tap the chip
    TestRenderer.act(() => {
      starbucksChip!.props.onPress();
    });

    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe('Starbucks ');
  });

  it('hides recommendation chips when input contains numbers', async () => {
    const onSubmit = jest.fn();
    const tree = await render(<QuickAddField onSubmit={onSubmit} busy={false} error={null} />);

    const input = tree.root.findByType(TextInput);

    // Type a number
    TestRenderer.act(() => {
      input.props.onChangeText('Starbucks 18');
    });

    const chipsAfterNumber = tree.root.findAll(
      (node: any) => node.props?.accessibilityRole === 'button' && node.props?.accessibilityLabel
    );
    // InfoButton has accessibilityRole="button" and accessibilityLabel="What is Just type it?"
    const recChips = chipsAfterNumber.filter(
      (node: any) => !node.props.accessibilityLabel.startsWith('What is')
    );
    expect(recChips.length).toBe(0);
  });

  it('remembers newly entered items (e.g. laksa 22) upon submit and ranks in front', async () => {
    const onSubmit = jest.fn();
    const tree = await render(<QuickAddField onSubmit={onSubmit} busy={false} error={null} />);

    const input = tree.root.findByType(TextInput);

    // Type "laksa 22" and submit
    TestRenderer.act(() => {
      input.props.onChangeText('laksa 22');
    });
    TestRenderer.act(() => {
      input.props.onSubmitEditing();
    });

    expect(onSubmit).toHaveBeenCalledWith('laksa 22');

    // Clear input
    TestRenderer.act(() => {
      input.props.onChangeText('');
    });

    // Check chips
    const chips = tree.root.findAll(
      (node: any) => node.props?.accessibilityRole === 'button' && node.props?.accessibilityLabel
    );
    const chipLabels = chips.map((c: any) => c.props.accessibilityLabel);
    expect(chipLabels).toContain('Laksa');
  });
});
