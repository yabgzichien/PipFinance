const mockDispatchAlert = jest.fn();

jest.mock('../src/state/alertHost', () => ({
  dispatchAlert: (request: unknown) => mockDispatchAlert(request),
}));

import { confirmAction } from '../src/lib/platformAlert';

describe('confirmAction', () => {
  beforeEach(() => {
    mockDispatchAlert.mockClear();
  });

  it('keeps the existing Cancel and confirm request shape when no neutral action is supplied', () => {
    const onConfirm = jest.fn();

    confirmAction('Delete?', 'This cannot be undone.', 'Delete', onConfirm);

    expect(mockDispatchAlert).toHaveBeenCalledWith({
      kind: 'confirm',
      title: 'Delete?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm,
    });
  });

  it('dispatches an optional neutral action that can be used to review linked records', () => {
    const onReview = jest.fn();

    confirmAction('Used by a recurring payment', 'One payment is linked.', 'Hide', jest.fn(), {
      label: 'Review recurring payments',
      onPress: onReview,
    });

    const request = mockDispatchAlert.mock.calls[0][0];
    expect(request.neutralAction.label).toBe('Review recurring payments');

    request.neutralAction.onPress();
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});
