// src/state/useBackHandler.ts
// The app has no navigation library, so hardware back — and, on Android, the edge-swipe gesture,
// which reports through the same 'hardwareBackPress' event — needs its own wiring: with no
// listener registered, Android's default is to exit the app on every press, regardless of which
// screen is showing.
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

/** Subscribes `handler` to the Android hardware/gesture back button for the component's mounted
 * lifetime. Return true to mark the press handled; return false to let it fall through to
 * whatever was registered before this component mounted, or exit the app if nothing else claims
 * it. No-op on iOS/web, where this event never fires. Always calls the latest `handler` closure,
 * so callers don't need to worry about stale state across re-renders. */
export function useBackHandler(handler: () => boolean) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => handlerRef.current());
    return () => sub.remove();
  }, []);
}

const EXIT_CONFIRM_WINDOW_MS = 2000;

/** Standard "press back again to exit" gate for a screen with nowhere left to go back to. Returns
 * a function to call from inside a `useBackHandler` handler at that point: the first press shows
 * a toast and swallows the press (true); a second press inside the window lets it through to
 * actually exit (false). */
export function useExitConfirm(): () => boolean {
  const lastPressRef = useRef(0);
  return () => {
    const now = Date.now();
    if (now - lastPressRef.current < EXIT_CONFIRM_WINDOW_MS) return false;
    lastPressRef.current = now;
    if (Platform.OS === 'android') ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
    return true;
  };
}
