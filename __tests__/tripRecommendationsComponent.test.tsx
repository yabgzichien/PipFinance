import React from 'react';
import { Text, TextInput } from 'react-native';
import { TripPickerModal } from '../src/components/TripPickerModal';
import type { Trip } from '../src/lib/trips';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockAddTrip = jest.fn(async (
  name: string,
  startDate: string | null,
  endDate: string | null,
  icon: string | null,
): Promise<Trip> => ({
  id: 'new-trip', name, startDate, endDate, icon,
  archived: false, createdAt: '2026-09-09T00:00:00.000Z',
}));

jest.mock('../src/state/store', () => ({
  useAppData: () => ({ trips: [], addTrip: mockAddTrip }),
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

function buttonWithText(root: any, label: string) {
  return root.findAll((node: any) => typeof node.props?.onPress === 'function').find((node: any) =>
    node.findAllByType(Text).some((text: any) => text.props.children === label)
  );
}

describe('Trip recommendations component UI', () => {
  it('displays destination recommendation chips in New Trip form and fills input on press', async () => {
    const onSelect = jest.fn();
    const tree = await render(<TripPickerModal visible onClose={jest.fn()} onSelect={onSelect} />);

    // Tap "New trip" to open creation form
    await TestRenderer.act(async () => {
      buttonWithText(tree.root, 'New trip')!.props.onPress();
    });

    const currentYear = new Date().getFullYear();
    const tokyoLabel = `Tokyo ${currentYear}`;

    // Find destination chips
    const chips = tree.root.findAll(
      (node: any) => node.props?.accessibilityRole === 'button' && node.props?.accessibilityLabel
    );
    const tokyoChip = chips.find((c: any) => c.props.accessibilityLabel === tokyoLabel);

    expect(tokyoChip).toBeDefined();

    // Tap the Tokyo recommendation chip
    TestRenderer.act(() => {
      tokyoChip!.props.onPress();
    });

    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe(tokyoLabel);
  });

  it('ranks past custom trips (e.g. Serbia) at the front of recommendations', async () => {
    // Re-mock store with Serbia in trips
    const existingTrip: Trip = {
      id: 'serbia-trip',
      name: 'Serbia',
      archived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      icon: null,
    };
    const store = jest.requireMock('../src/state/store');
    const origUseAppData = store.useAppData;
    store.useAppData = () => ({ trips: [existingTrip], addTrip: mockAddTrip });

    try {
      const onSelect = jest.fn();
      const tree = await render(<TripPickerModal visible onClose={jest.fn()} onSelect={onSelect} />);

      await TestRenderer.act(async () => {
        buttonWithText(tree.root, 'New trip')!.props.onPress();
      });

      const currentYear = new Date().getFullYear();
      const serbiaLabel = `Serbia ${currentYear}`;

      const recChips = tree.root.findAll(
        (node: any) =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel?.endsWith(String(currentYear))
      );
      expect(recChips[0].props.accessibilityLabel).toBe(serbiaLabel);

      await TestRenderer.act(async () => {
        recChips[0].props.onPress();
      });

      const input = tree.root.findByType(TextInput);
      expect(input.props.value).toBe(serbiaLabel);
    } finally {
      store.useAppData = origUseAppData;
    }
  });
});
