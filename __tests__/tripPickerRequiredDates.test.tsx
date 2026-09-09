import React from 'react';
import { Text, TextInput } from 'react-native';
import { DateRangeSheet } from '../src/components/DateRangeSheet';
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

function render(element: React.ReactElement) {
  let tree: ReturnType<typeof TestRenderer.create>;
  TestRenderer.act(() => {
    tree = TestRenderer.create(element);
  });
  return tree!;
}

function buttonWithText(root: any, label: string) {
  return root.findAll((node: any) => typeof node.props?.onPress === 'function').find((node: any) =>
    node.findAllByType(Text).some((text: any) => text.props.children === label)
  );
}

it('requires a complete date range when creating a trip from the transaction picker', async () => {
  const onSelect = jest.fn();
  const tree = render(<TripPickerModal visible onClose={jest.fn()} onSelect={onSelect} />);

  TestRenderer.act(() => buttonWithText(tree.root, 'New trip')!.props.onPress());
  TestRenderer.act(() => tree.root.findByType(TextInput).props.onChangeText('Singapore'));

  const save = buttonWithText(tree.root, 'Save')!;
  expect(save.props.disabled).toBe(true);

  TestRenderer.act(() => tree.root.findByType(DateRangeSheet).props.onApply({
    start: '2026-09-09',
    end: '2026-09-12',
  }));
  expect(save.props.disabled).toBe(false);

  await TestRenderer.act(async () => save.props.onPress());
  expect(mockAddTrip).toHaveBeenCalledWith('Singapore', '2026-09-09', '2026-09-12', null);
  expect(onSelect).toHaveBeenCalledWith('new-trip');
});
