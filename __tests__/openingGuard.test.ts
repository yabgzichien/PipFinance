import { createOpeningGuard } from '../src/lib/openingGuard';

describe('createOpeningGuard', () => {
  test('invalidates work from a closed opening after the sheet reopens', () => {
    const guard = createOpeningGuard();
    const firstOpening = guard.begin();

    expect(guard.isCurrent(firstOpening)).toBe(true);

    guard.invalidate();
    const reopened = guard.begin();

    expect(guard.isCurrent(firstOpening)).toBe(false);
    expect(guard.isCurrent(reopened)).toBe(true);
  });
});
