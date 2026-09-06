import { createOpeningGuard } from '../src/lib/openingGuard';

describe('createOpeningGuard', () => {
  test('invalidates a deferred operation after a committed close and reopen', () => {
    const guard = createOpeningGuard();
    guard.open();
    const firstOperation = guard.beginOperation();

    expect(guard.isCurrent(firstOperation)).toBe(true);

    guard.close();
    guard.open();
    const reopenedOperation = guard.beginOperation();

    expect(guard.isCurrent(firstOperation)).toBe(false);
    expect(guard.isCurrent(reopenedOperation)).toBe(true);
  });

  test('does not treat work as current until its opening has committed', () => {
    const guard = createOpeningGuard();

    expect(guard.beginOperation()).toBeNull();

    guard.open();
    expect(guard.isCurrent(guard.beginOperation())).toBe(true);
  });

  test('invalidates pending work when a visible opening unmounts', () => {
    const guard = createOpeningGuard();
    guard.open();
    const pendingOperation = guard.beginOperation();

    // The component's effect cleanup is the unmount lifecycle event.
    guard.close();

    expect(guard.isCurrent(pendingOperation)).toBe(false);
  });

  test('supports StrictMode setup-cleanup-setup replay without reviving stale work', () => {
    const guard = createOpeningGuard();
    guard.open();
    const firstMountOperation = guard.beginOperation();

    // StrictMode replays an effect by cleaning up the first setup before running it again.
    guard.close();
    guard.open();
    const replayedMountOperation = guard.beginOperation();

    expect(guard.isCurrent(firstMountOperation)).toBe(false);
    expect(guard.isCurrent(replayedMountOperation)).toBe(true);
  });

  test('close invalidates an operation synchronously for explicit dismissal', () => {
    const guard = createOpeningGuard();
    guard.open();
    const pendingOperation = guard.beginOperation();

    guard.close();

    expect(guard.isCurrent(pendingOperation)).toBe(false);
    expect(guard.beginOperation()).toBeNull();
  });
});
