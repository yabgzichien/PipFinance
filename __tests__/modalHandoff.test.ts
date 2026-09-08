import { createModalHandoff, HANDOFF_FALLBACK_MS } from '../src/lib/modalHandoff';

/**
 * The bug this guards: on iOS both the account picker and the "New account" sheet are
 * presented by the same view controller, so opening the second one in the same commit that
 * closes the first is refused by UIKit — and React Native has already flagged the sheet as
 * presented, so it never opens again. The handoff has to wait for the real dismissal.
 */
describe('createModalHandoff', () => {
  const fakeScheduler = () => {
    const runs: Array<{ run: () => void; ms: number; cancelled: boolean }> = [];
    const schedule = (run: () => void, ms: number) => {
      const entry = { run, ms, cancelled: false };
      runs.push(entry);
      return () => {
        entry.cancelled = true;
      };
    };
    return { runs, schedule };
  };

  it('opens the next modal straight away where no sequencing is needed', () => {
    const open = jest.fn();
    const handoff = createModalHandoff({ sequenced: false });

    handoff.request(open);

    expect(open).toHaveBeenCalledTimes(1);
    expect(handoff.hasPending()).toBe(false);
  });

  it('holds the next modal until the first one reports it has finished dismissing', () => {
    const open = jest.fn();
    const { schedule } = fakeScheduler();
    const handoff = createModalHandoff({ sequenced: true, schedule });

    handoff.request(open);
    expect(open).not.toHaveBeenCalled();
    expect(handoff.hasPending()).toBe(true);

    handoff.notifyDismissed();
    expect(open).toHaveBeenCalledTimes(1);
    expect(handoff.hasPending()).toBe(false);
  });

  it('opens the next modal only once, however many dismissals are reported', () => {
    const open = jest.fn();
    const { schedule } = fakeScheduler();
    const handoff = createModalHandoff({ sequenced: true, schedule });

    handoff.request(open);
    handoff.notifyDismissed();
    handoff.notifyDismissed();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('ignores a dismissal that was not handing off to anything', () => {
    const { schedule } = fakeScheduler();
    const handoff = createModalHandoff({ sequenced: true, schedule });

    expect(() => handoff.notifyDismissed()).not.toThrow();
    expect(handoff.hasPending()).toBe(false);
  });

  it('drops a queued modal when the handoff is cancelled', () => {
    const open = jest.fn();
    const { runs, schedule } = fakeScheduler();
    const handoff = createModalHandoff({ sequenced: true, schedule });

    handoff.request(open);
    handoff.cancel();
    handoff.notifyDismissed();

    expect(open).not.toHaveBeenCalled();
    expect(runs[0].cancelled).toBe(true);
  });

  // Losing the dismissal callback must not strand the user with no sheet at all — that is the
  // very failure being fixed, so the fallback keeps the flow moving rather than reinstating it.
  it('still opens the next modal if the dismissal is never reported', () => {
    const open = jest.fn();
    const { runs, schedule } = fakeScheduler();
    const handoff = createModalHandoff({ sequenced: true, schedule });

    handoff.request(open);
    expect(runs).toHaveLength(1);
    expect(runs[0].ms).toBe(HANDOFF_FALLBACK_MS);

    runs[0].run();

    expect(open).toHaveBeenCalledTimes(1);
    expect(handoff.hasPending()).toBe(false);
  });

  it('cancels the fallback once a real dismissal lands, so the modal cannot open twice', () => {
    const open = jest.fn();
    const { runs, schedule } = fakeScheduler();
    const handoff = createModalHandoff({ sequenced: true, schedule });

    handoff.request(open);
    handoff.notifyDismissed();
    expect(runs[0].cancelled).toBe(true);

    runs[0].run();

    expect(open).toHaveBeenCalledTimes(1);
  });
});
