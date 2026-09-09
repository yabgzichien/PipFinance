import { AppState, NativeModules, Platform, type NativeEventSubscription } from 'react-native';
import { ACCENT_PRESETS, DEFAULT_ACCENT_PRESET_ID } from '../state/accentPresets';

interface AppIconNativeModule {
  setAppIcon(presetName: string): Promise<boolean>;
  getAppIcon(): Promise<string>;
}

const { AppIconModule } = NativeModules as { AppIconModule?: AppIconNativeModule };

/** How long the app must stay backgrounded before the alias swap is allowed to run. Long enough
 *  that flicking to another app and straight back never triggers a write, short enough that it
 *  still lands before the platform reclaims the process. */
const ANDROID_ICON_SETTLE_MS = 2500;

/** The preset the user has chosen but that the launcher has not been told about yet. */
let desiredAndroidPreset: string | null = null;
/** The preset the launcher alias currently holds, once known. `null` means "not read yet". */
let appliedAndroidPreset: string | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let androidIconUpdateChain: Promise<void> = Promise.resolve();

/**
 * Switching the launcher alias is a PackageManager write against the app's own components, and
 * the alias it disables is the one the live task is running under — `dumpsys activity activities`
 * reports the foreground record as `com.yabg.pip/.MainActivityRose`, with only `mActivityComponent`
 * pointing at `.MainActivity`. Doing that from the foreground lets the platform tear the task
 * down: the app drops to the home screen and nothing lands in dropbox, because nothing threw.
 * Ordering the writes (see AppIconModule.kt) closed the "zero enabled LAUNCHER components" window
 * but not this one, and debouncing never could — real taps are hundreds of milliseconds apart, so
 * every tap still wrote.
 *
 * So the icon is deliberately allowed to lag the accent: the choice is held here and flushed only
 * once the app has been in the background long enough that there is no foreground task left to
 * lose. If the process dies before the flush, nothing is lost — the preset is already persisted in
 * app_meta, so the next launch re-requests it and the next backgrounding applies it.
 */
function requestAndroidIconUpdate(presetId: string): Promise<boolean> {
  desiredAndroidPreset = presetId;
  subscribeToAppState();
  return reconcileAndroidIconUpdate();
}

async function reconcileAndroidIconUpdate(): Promise<boolean> {
  if (appliedAndroidPreset === null) {
    try {
      appliedAndroidPreset = await AppIconModule!.getAppIcon();
    } catch {
      // Leave it unknown and let the flush write unconditionally; the native module skips
      // component writes that are already in the desired state, so a redundant call is cheap.
    }
  }

  if (desiredAndroidPreset === appliedAndroidPreset) {
    desiredAndroidPreset = null;
    cancelSettle();
    return true;
  }

  // A request that arrives while already backgrounded (a restored backup writing the preset
  // straight to app_meta, say) still needs its own settle window.
  if (AppState.currentState === 'background') scheduleSettle();
  return true;
}

function subscribeToAppState() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'background') scheduleSettle();
    else cancelSettle();
  });
}

function scheduleSettle() {
  if (!desiredAndroidPreset) return;
  cancelSettle();
  settleTimer = setTimeout(flushAndroidIconUpdate, ANDROID_ICON_SETTLE_MS);
}

function cancelSettle() {
  if (!settleTimer) return;
  clearTimeout(settleTimer);
  settleTimer = null;
}

function flushAndroidIconUpdate() {
  settleTimer = null;
  const presetToApply = desiredAndroidPreset;
  if (!presetToApply) return;

  // Serialized so a background/foreground/background bounce can never overlap two swaps.
  androidIconUpdateChain = androidIconUpdateChain.then(async () => {
    // Re-checked here, not just at schedule time: the timer fires while backgrounded but this
    // callback runs at least a microtask later, and behind any swap already in flight. If the app
    // came back in between, writing now would be the very foreground write this defers.
    if (AppState.currentState !== 'background') return;
    try {
      await AppIconModule!.setAppIcon(presetToApply);
      appliedAndroidPreset = presetToApply;
      // Anything chosen after this flush started stays pending for the next backgrounding.
      if (desiredAndroidPreset === presetToApply) desiredAndroidPreset = null;
    } catch {
      // Keep it pending and retry on the next backgrounding.
    }
  });
}

/**
 * Updates the app icon dynamically according to the user's selected accent preset.
 * - On Android: records the choice and switches the launcher activity-alias once the app is
 *   backgrounded (see `requestAndroidIconUpdate`). Resolving `true` means the request was
 *   accepted, not that the launcher has already changed.
 * - On Web: dynamically renders a favicon with the chosen accent background.
 */
export async function setDynamicAppIcon(presetId: string): Promise<boolean> {
  const safePreset = ACCENT_PRESETS.some((p) => p.id === presetId) ? presetId : DEFAULT_ACCENT_PRESET_ID;

  if (Platform.OS === 'android' && AppIconModule?.setAppIcon) {
    return requestAndroidIconUpdate(safePreset);
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      updateWebFavicon(safePreset);
      return true;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Gets the current active icon preset from native platform or fallback.
 */
export async function getDynamicAppIcon(): Promise<string> {
  if (Platform.OS === 'android' && AppIconModule?.getAppIcon) {
    try {
      return await AppIconModule.getAppIcon();
    } catch {
      return DEFAULT_ACCENT_PRESET_ID;
    }
  }
  return DEFAULT_ACCENT_PRESET_ID;
}

/**
 * Updates the Web browser favicon to reflect the chosen accent color.
 */
function updateWebFavicon(presetId: string) {
  const preset = ACCENT_PRESETS.find((p) => p.id === presetId) ?? ACCENT_PRESETS[0];
  const accentHex = preset.theme.light.accent;

  const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" rx="14" fill="${accentHex}"/>
    <g transform="translate(32, 42.5) scale(0.64) translate(-50, -56)">
      <ellipse cx="50" cy="92" rx="22" ry="4.5" fill="rgba(16,40,28,0.18)" />
      <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3.2" fill="none" stroke-linecap="round" />
      <ellipse cx="42" cy="15" rx="7.5" ry="4.2" fill="#1c7a4e" transform="rotate(-32 42 15)" />
      <ellipse cx="58" cy="13" rx="8.5" ry="4.6" fill="#2aab68" transform="rotate(28 58 13)" />
      <circle cx="50" cy="56" r="33" fill="#F5B42A" />
      <circle cx="50" cy="56" r="26.6" fill="#FAC438" />
      <circle cx="50" cy="56" r="26.6" fill="none" stroke="#D99E18" stroke-width="2.6" />
      <ellipse cx="35" cy="42" rx="8.5" ry="4.9" fill="rgba(255,255,255,0.23)" transform="rotate(-26 35 42)" />
      <ellipse cx="32" cy="60.3" rx="5.3" ry="3.4" fill="#F07828" opacity="0.3" />
      <ellipse cx="68" cy="60.3" rx="5.3" ry="3.4" fill="#F07828" opacity="0.3" />
      <circle cx="40" cy="55" r="4.2" fill="#7A4800" />
      <circle cx="41.5" cy="53.5" r="1.3" fill="#fff" />
      <circle cx="60" cy="55" r="4.2" fill="#7A4800" />
      <circle cx="61.5" cy="53.5" r="1.3" fill="#fff" />
      <path d="M43 64 Q50 71 57 64" fill="none" stroke="#7A4800" stroke-width="3.2" stroke-linecap="round" />
    </g>
  </svg>`;

  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'shortcut icon';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = svgDataUri;
}
