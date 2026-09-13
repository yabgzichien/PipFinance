import React from 'react';
import Renderer from 'react-test-renderer';
import { RecapEntry } from '../src/components/recap/RecapEntry';
import { DancingCow } from '../src/components/recap/DancingCow';
import * as store from '../src/state/store';
import type { Transaction } from '../src/lib/types';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

jest.mock('../src/state/store', () => {
  const actual = jest.requireActual('../src/state/store');
  return {
    ...actual,
    persistRecapStoryHomeHandledMonth: jest.fn(async () => {}),
  };
});

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    merchantRaw: 'Shop',
    merchantKey: 'shop',
    amount: 25,
    currency: 'MYR',
    type: 'expense',
    date: '2026-08-15',
    categoryId: 'food',
    createdAt: '2026-08-15T12:00:00.000Z',
    source: 'manual',
    ...overrides,
  };
}

function press(tree: Renderer.ReactTestRenderer, label: string) {
  const buttons = tree.root.findAll(
    (n) => n.props.accessibilityRole === 'button' && (n.props.accessibilityLabel === label || n.props.children === label)
  );
  if (buttons.length === 0) {
    throw new Error(`Button with label "${label}" not found`);
  }
  Renderer.act(() => {
    buttons[0].props.onPress();
  });
}

describe('RecapEntry', () => {
  const txns = [makeTxn({ date: '2026-08-10' })];
  const day3 = new Date(2026, 8, 3, 10, 0); // Sept 3, 2026 (day 3)
  const day8 = new Date(2026, 8, 8, 10, 0); // Sept 8, 2026 (day 8)

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders invitation with cow, copy, and separate Open and Dismiss buttons during days 1-7', () => {
    const onDismiss = jest.fn();
    const onOpenStory = jest.fn();

    let tree: Renderer.ReactTestRenderer;
    Renderer.act(() => {
      tree = Renderer.create(
        <RecapEntry
          transactions={txns}
          now={day3}
          handledMonth={null}
          onDismiss={onDismiss}
          onOpenStory={onOpenStory}
        />
      );
    });

    // Check cow thumbnail
    expect(tree!.root.findAllByType(DancingCow).length).toBe(1);

    // Check copy
    const textNodes = tree!.root.findAll((n) => typeof n.props.children === 'string');
    const texts = textNodes.map((n) => n.props.children);
    expect(texts.some((t) => t.includes('Your monthly story is ready'))).toBe(true);

    // Does not auto open
    expect(onOpenStory).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('hides when day is outside window or when month is already handled', () => {
    let treeDay8: Renderer.ReactTestRenderer;
    Renderer.act(() => {
      treeDay8 = Renderer.create(
        <RecapEntry
          transactions={txns}
          now={day8}
          handledMonth={null}
        />
      );
    });
    expect(treeDay8!.toJSON()).toBeNull();

    let treeHandled: Renderer.ReactTestRenderer;
    Renderer.act(() => {
      treeHandled = Renderer.create(
        <RecapEntry
          transactions={txns}
          now={day3}
          handledMonth="2026-08"
        />
      );
    });
    expect(treeHandled!.toJSON()).toBeNull();
  });

  it('hides when previous month has no eligible data', () => {
    let treeEmpty: Renderer.ReactTestRenderer;
    Renderer.act(() => {
      treeEmpty = Renderer.create(
        <RecapEntry
          transactions={[]}
          now={day3}
          handledMonth={null}
        />
      );
    });
    expect(treeEmpty!.toJSON()).toBeNull();

    let treeTransfersOnly: Renderer.ReactTestRenderer;
    Renderer.act(() => {
      treeTransfersOnly = Renderer.create(
        <RecapEntry
          transactions={[makeTxn({ type: 'transfer', date: '2026-08-10' })]}
          now={day3}
          handledMonth={null}
        />
      );
    });
    expect(treeTransfersOnly!.toJSON()).toBeNull();
  });

  it('calls onDismiss and persists handled month when dismissed', async () => {
    const onDismiss = jest.fn();
    const onOpenStory = jest.fn();

    let tree: Renderer.ReactTestRenderer;
    Renderer.act(() => {
      tree = Renderer.create(
        <RecapEntry
          transactions={txns}
          now={day3}
          handledMonth={null}
          onDismiss={onDismiss}
          onOpenStory={onOpenStory}
        />
      );
    });

    const dismissButton = tree!.root.findAll(
      (n) => n.props.accessibilityRole === 'button' && (n.props.accessibilityLabel === 'Not now' || n.props.testID === 'recap-entry-dismiss')
    )[0];
    await Renderer.act(async () => {
      await dismissButton.props.onPress();
    });

    expect(store.persistRecapStoryHomeHandledMonth).toHaveBeenCalledWith('2026-08');
    expect(onDismiss).toHaveBeenCalledWith('2026-08');
    expect(onOpenStory).not.toHaveBeenCalled();
  });

  it('calls onOpenStory and persists handled month when opened', async () => {
    const onDismiss = jest.fn();
    const onOpenStory = jest.fn();

    let tree: Renderer.ReactTestRenderer;
    Renderer.act(() => {
      tree = Renderer.create(
        <RecapEntry
          transactions={txns}
          now={day3}
          handledMonth={null}
          onDismiss={onDismiss}
          onOpenStory={onOpenStory}
        />
      );
    });

    const openButton = tree!.root.findAll(
      (n) => n.props.accessibilityRole === 'button' && (n.props.accessibilityLabel === 'View your month' || n.props.testID === 'recap-entry-open')
    )[0];
    await Renderer.act(async () => {
      await openButton.props.onPress();
    });

    expect(store.persistRecapStoryHomeHandledMonth).toHaveBeenCalledWith('2026-08');
    expect(onOpenStory).toHaveBeenCalledWith('2026-08');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
