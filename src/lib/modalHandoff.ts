import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Sequencing for one modal handing off to another.
 *
 * On iOS every React Native `Modal` is a real presented UIViewController, and sibling modals on
 * the same screen all present from that screen's view controller. Closing one and opening
 * another in the same commit therefore asks UIKit to present while `presentedViewController` is
 * still set (dismissal is animated, so it finishes a frame or two later). UIKit refuses — but
 * RCTModalHostViewComponentView has already flipped its internal `_isPresented` to YES, so it
 * never retries: the second modal stays invisible for the rest of the screen's life, and every
 * later tap is silently a no-op.
 *
 * The fix is to hold the second modal's open until the first one reports that it has actually
 * finished dismissing (`Modal`'s `onDismiss`, which is iOS-only — hence `sequenced`, false
 * everywhere else, where simultaneous modals are fine and `onDismiss` never fires).
 */

/**
 * How long to wait for a dismissal before opening anyway. Purely a safety net: `onDismiss` not
 * arriving would otherwise strand the user with no sheet at all, which is the bug being fixed.
 */
export const HANDOFF_FALLBACK_MS = 700;

/** Starts a delayed run and returns a function that cancels it. */
export type HandoffScheduler = (run: () => void, ms: number) => () => void;

export type ModalHandoff = {
  /** Queue the next modal's open. Runs immediately when no sequencing is needed. */
  request: (open: () => void) => void;
  /** Report that the modal being handed off from has finished dismissing. */
  notifyDismissed: () => void;
  /** Drop a queued open (screen went away, user backed out). */
  cancel: () => void;
  hasPending: () => boolean;
};

const defaultScheduler: HandoffScheduler = (run, ms) => {
  const id = setTimeout(run, ms);
  return () => clearTimeout(id);
};

export function createModalHandoff({
  sequenced,
  schedule = defaultScheduler,
}: {
  sequenced: boolean;
  schedule?: HandoffScheduler;
}): ModalHandoff {
  let pending: (() => void) | null = null;
  let cancelFallback: (() => void) | null = null;

  const clearFallback = () => {
    cancelFallback?.();
    cancelFallback = null;
  };

  const flush = () => {
    const next = pending;
    pending = null;
    clearFallback();
    next?.();
  };

  return {
    request(open) {
      if (!sequenced) {
        open();
        return;
      }
      clearFallback();
      pending = open;
      cancelFallback = schedule(flush, HANDOFF_FALLBACK_MS);
    },
    notifyDismissed: flush,
    cancel() {
      pending = null;
      clearFallback();
    },
    hasPending: () => pending !== null,
  };
}

/**
 * Hook form for a screen that closes one modal to open another. Wire `onDismiss` to the modal
 * being closed and pass the second modal's open through `request`:
 *
 *   const { request, onDismiss } = useModalHandoff();
 *   <Modal visible={pickerOpen} onDismiss={onDismiss} ... />
 *   onPress={() => { setPickerOpen(false); request(() => setSheetOpen(true)); }}
 */
export function useModalHandoff(): { request: (open: () => void) => void; onDismiss: () => void } {
  const ref = useRef<ModalHandoff | null>(null);
  if (!ref.current) {
    ref.current = createModalHandoff({ sequenced: Platform.OS === 'ios' });
  }

  useEffect(() => () => ref.current?.cancel(), []);

  const request = useCallback((open: () => void) => ref.current?.request(open), []);
  const onDismiss = useCallback(() => ref.current?.notifyDismissed(), []);

  return { request, onDismiss };
}
