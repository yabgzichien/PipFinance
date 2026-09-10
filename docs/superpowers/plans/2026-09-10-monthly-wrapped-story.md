# Pip Monthly Wrapped Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, amount-free monthly story with a five-second story viewer, an original dancing-cow opening, and 9:16 static card sharing/saving on native plus one-card download on web.

**Architecture:** A pure `buildRecapStoryModel` converts transactions into a privacy-safe three- or five-scene union. `RecapStoryModal` owns playback and delegates visuals to one dual-mode frame renderer. Platform capture adapters turn the settled export-mode frame into PNGs; a pure export coordinator handles cleanup and partial failures. Home only stores one month-scoped handled marker.

**Tech Stack:** Expo 54, React Native 0.81, React 19, TypeScript, Jest/react-test-renderer, `react-native-svg`, `expo-audio`, `expo-sharing`, `react-native-view-shot`, `expo-media-library`, `html-to-image`.

**Spec:** [`docs/superpowers/specs/2026-09-10-monthly-wrapped-story-design.md`](../specs/2026-09-10-monthly-wrapped-story-design.md)

## Global Constraints

- Never put amounts, formatted money, income, balances, debt, budgets, account data, or raw descriptions in a story model or captured card.
- Keep merchant names off by default. A cameo is explicit, exact-name, session-only state and is cleared when the modal closes.
- Use original SVG cow artwork and synthesized audio only. Do not bundle, trace, or link to the supplied meme image or music.
- Keep viewer controls outside `RecapStoryFrame`; only an export-mode frame may be captured.
- Use `Display`, `Title`, `Body`, `Label`, and `Caption` from `src/components/ui.tsx`; do not introduce raw `fontSize` declarations or new type-audit allowlist entries.
- Use the existing spacing/radius tokens. Do not add arbitrary spacing literals.
- Do not add analytics, network calls, Meta credentials, `react-native-share`, video/GIF export, or a `pipfinance.app` URL.
- Preserve unrelated changes in the dirty worktree. Stage and commit only files named by the current task.
- Before every commit, inspect `git diff -- <paths>`. If a named existing file already contains user work, stage only the feature hunks with `git add -p <path>` and verify `git diff --cached`; never absorb unrelated hunks merely because they share a file.

---

## Task 1: Install capture dependencies and configure Photos permission

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [ ] **Step 1: Record the dependency baseline.**

Run:

```bash
npm ls react-native-view-shot expo-media-library html-to-image --depth=0
```

Expected: all three are absent and npm exits non-zero.

- [ ] **Step 2: Install Expo-compatible native packages and the web package.**

Run:

```bash
npx expo install react-native-view-shot expo-media-library
npm install html-to-image
```

Expected: `react-native-view-shot` and `expo-media-library` resolve to Expo 54-compatible versions; `html-to-image` appears under dependencies.

- [ ] **Step 3: Add the Media Library config plugin.**

Add this entry to `expo.plugins` in `app.json`:

```json
[
  "expo-media-library",
  {
    "photosPermission": "Allow Pip to access photos you choose.",
    "savePhotosPermission": "Allow Pip to save your selected monthly story cards."
  }
]
```

Do not add broad Android storage permissions manually; let the Expo plugin generate the platform-appropriate permission.

- [ ] **Step 4: Verify dependency and config resolution.**

Run:

```bash
npm ls react-native-view-shot expo-media-library html-to-image --depth=0
npx expo config --type public
```

Expected: dependency tree succeeds and the public Expo config contains the `expo-media-library` plugin without a schema error.

- [ ] **Step 5: Commit the dependency boundary.**

```bash
git add package.json package-lock.json app.json
git commit -m "build: add monthly story capture dependencies"
```

---

## Task 2: Build the deterministic, amount-free story model

**Files:**

- Create: `src/lib/recapStory.ts`
- Create: `__tests__/recapStory.test.ts`

- [ ] **Step 1: Write failing eligibility and length tests.**

Use a transaction factory with explicit `date`, `type`, `categoryId`, `amount`, and merchant fields. Cover current/future months, empty, transfer-only, income-only, four versus five expenses, and two versus three distinct expense days:

```ts
expect(buildRecapStoryModel({ transactions: [], month: '2026-08', now })).toBeNull();
expect(buildRecapStoryModel({ transactions: [income], month: '2026-08', now })?.kind).toBe('sparse');
expect(buildRecapStoryModel({ transactions: fiveExpensesOnThreeDays, month: '2026-08', now })?.scenes).toHaveLength(5);
expect(buildRecapStoryModel({ transactions: fiveExpensesOnTwoDays, month: '2026-08', now })?.scenes).toHaveLength(3);
expect(buildRecapStoryModel({ transactions: previousMonthRows, month: '2026-09', now })).toBeNull();
```

Run:

```bash
npx jest __tests__/recapStory.test.ts --runInBand
```

Expected: FAIL because `src/lib/recapStory.ts` does not exist.

- [ ] **Step 2: Define privacy-safe input and output types.**

Create these public contracts. Scene payloads intentionally contain identifiers, counts, and whole percentages—not display copy or transaction objects:

```ts
export type RecapStoryKind = 'sparse' | 'full';
export type RecapPersonaKey =
  | 'food' | 'shopping' | 'entertainment' | 'travelling'
  | 'learning' | 'family' | 'medical' | 'utilities'
  | 'subscriptions' | 'rental' | 'phoneBill' | 'insurance'
  | 'other' | 'consistent' | 'explorer' | 'smallChapter' | 'incomeOnly';

export type RecapBadgeKey =
  | 'threeDays' | 'threeWeeks' | 'fourWeeks' | 'fourCategories'
  | 'weekendRhythm' | 'weekdayRhythm' | 'firstChapter';

export type RecapStoryScene =
  | { id: 'ritual'; type: 'ritual' }
  | { id: 'identity'; type: 'identity'; persona: RecapPersonaKey; activityDays: number }
  | { id: 'pattern'; type: 'pattern'; categoryId: string; recordedSharePercent: number;
      previousRecordedSharePercent?: number; changeDirection?: 'higher' | 'lower' | 'same';
      merchantCameo?: string }
  | { id: 'habit'; type: 'habit'; activityDays: number; activityWeeks: number }
  | { id: 'finale'; type: 'finale'; badges: RecapBadgeKey[] };

export interface RecapStoryModel {
  month: string;
  kind: RecapStoryKind;
  scenes: RecapStoryScene[];
  defaultSelectedSceneIds: RecapStoryScene['id'][];
}

export interface BuildRecapStoryInput {
  transactions: Transaction[];
  month: string;
  now?: Date;
  merchantCameo?: string | null;
}
```

- [ ] **Step 3: Implement completed-month eligibility and calendar facts.**

Use `txnMonthKey` and `currentMonthKey`; treat a transaction date as `txn.date ?? txn.createdAt`, reduced to `YYYY-MM-DD`. Compute weeks as distinct Monday-start calendar-week keys so a month boundary cannot merge two different weeks. Export small helpers for direct tests:

```ts
export function isCompletedStoryMonth(month: string, now = new Date()): boolean {
  return /^\d{4}-\d{2}$/.test(month) && month < currentMonthKey(now);
}

export function transactionDay(txn: Transaction): string {
  return (txn.date ?? txn.createdAt).slice(0, 10);
}
```

Build only from non-transfer rows in the requested month. Return `null` when the month is not completed or has no non-transfer rows. Use a full story only for `expenseCount >= 5 && distinctExpenseDays >= 3`; otherwise use sparse.

- [ ] **Step 4: Implement category share, persona priority, and badge rules.**

Sum absolute expense amounts internally. Round the winning category share once with `Math.round((top / total) * 100)`. Break category ties by stable `categoryId` order. Apply persona priority exactly:

```ts
if (topShare >= 35) return personaForCategory(topCategoryId);
if (activityWeeks >= 3) return 'consistent';
if (expenseCategoryCount >= 4) return 'explorer';
return expenseCount === 0 ? 'incomeOnly' : 'smallChapter';
```

Map unknown/custom dominant categories to `other`. Earn badges only from proved facts; sort them in the fixed order `fourWeeks`, `threeWeeks`, `fourCategories`, `weekendRhythm`, `weekdayRhythm`, `threeDays`, `firstChapter`, then take at most three.

For a full story's winning category, include `previousRecordedSharePercent` and neutral `changeDirection` only when the immediately preceding completed month has at least one recorded expense. Compare category shares, never raw totals. Omit both fields when either side lacks recorded expenses.

Export `recapStoryMerchantCandidates(transactions, month, categoryId)`. It returns unique, non-empty `merchantRaw` values for that category, ordered by occurrence count then lexical tie-break, and is called only after the user opens the optional disclosure control. It must never be invoked during default model construction.

- [ ] **Step 5: Assemble the fixed scene order.**

Full order is `ritual`, `identity`, `pattern`, `habit`, `finale`; sparse order is `ritual`, `identity`, `finale`. Default selections are `identity` and `finale` in narrative order. Only attach `merchantCameo` to `pattern` when a non-empty explicit option is provided.

- [ ] **Step 6: Add persona, rounding, timezone, and privacy regression tests.**

Test the 35% boundary, consistency before explorer, stable ties, month-spanning weeks, weekend/weekday facts, and suppression of any comparison when either month has no expense data. Add a recursive guard:

```ts
const prohibitedKeys = /amount|income|balance|worth|debt|budget|account|merchant|description|currency/i;
function assertPrivate(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(key).not.toMatch(prohibitedKeys);
    if (typeof child === 'string') expect(child).not.toMatch(/(?:RM|MYR|SGD|USD|\$)\s*\d/i);
    assertPrivate(child);
  }
}
```

Run it on the default full, sparse, and income-only models. For the explicit cameo test, assert that only `scenes[2].merchantCameo` contains the opted-in exact string; do not run the default-key assertion against that explicit-disclosure model.

Also test that comparison fields appear only with valid expense data on both sides, and that merchant candidates are stable, deduplicated, limited to the winning category, and absent from the default model.

- [ ] **Step 7: Run model tests and typecheck.**

```bash
npx jest __tests__/recapStory.test.ts --runInBand
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the model.**

```bash
git add src/lib/recapStory.ts __tests__/recapStory.test.ts
git commit -m "feat: add private monthly story model"
```

---

## Task 3: Add reviewed bilingual copy and fixed contrast-safe palettes

**Files:**

- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations/en.ts`
- Modify: `src/i18n/translations/zh.ts`
- Create: `src/lib/recapStoryTheme.ts`
- Create: `__tests__/recapStoryCopy.test.ts`
- Create: `__tests__/recapStoryContrast.test.ts`

- [ ] **Step 1: Write failing copy-completeness tests.**

Export `RECAP_PERSONA_KEYS` and `RECAP_BADGE_KEYS` from the model. For every key, assert both translation objects contain a non-empty title and body. Also assert the ritual sentence is exact in English:

```ts
expect(en.recapStoryRitualTitle).toBe("Wake up—it’s the first of the month");
const enCopy = en as unknown as Record<string, string>;
const zhCopy = zh as unknown as Record<string, string>;
for (const key of RECAP_PERSONA_KEYS) {
  expect(enCopy[`recapStoryPersona_${key}_title`]).toBeTruthy();
  expect(zhCopy[`recapStoryPersona_${key}_title`]).toBeTruthy();
}
```

Run:

```bash
npx jest __tests__/recapStoryCopy.test.ts --runInBand
```

Expected: FAIL on missing keys.

- [ ] **Step 2: Add the complete typed copy surface.**

Add common viewer/action/error keys (`recapStoryOpen`, `recapStoryInviteTitle`, `recapStoryInviteBody`, `recapStoryDismiss`, `recapStoryOf`, `recapStoryPrevious`, `recapStoryNext`, `recapStoryPause`, `recapStoryPlay`, `recapStoryMute`, `recapStoryUnmute`, `recapStoryReplay`, `recapStoryShareCard`, `recapStoryChooseCards`, `recapStorySaveSelected`, `recapStoryDownload`, `recapStoryRetry`, `recapStorySavedCount`, `recapStoryPermissionDenied`, `recapStoryCaptureFailed`, `recapStoryShareUnavailable`, `recapStoryOpenInstagram`, `recapStorySavedToPhotos`, `recapStoryCloseCaptureTitle`, `recapStoryCloseCaptureBody`, `recapStoryRecordedShare`, `recapStoryComparisonHigher`, `recapStoryComparisonLower`, `recapStoryComparisonSame`, `recapStoryMerchantOff`, `recapStoryMerchantDisclosure`, `recapStoryDays`, `recapStoryWeeks`) to `Translations` and both locales.

Add title/body pairs for these reviewed identities:

| Key | English title | Chinese title |
|---|---|---|
| `food` | The Flavour Finder | 寻味达人 |
| `shopping` | The Thoughtful Curator | 精挑策展人 |
| `entertainment` | The Joy Collector | 快乐收藏家 |
| `travelling` | The Weekend Wanderer | 周末漫游家 |
| `learning` | The Curious Builder | 好奇进修家 |
| `family` | The Family Anchor | 家庭守护者 |
| `medical` | The Wellness Keeper | 健康守门人 |
| `utilities` | The Home Conductor | 生活调度家 |
| `subscriptions` | The Digital Regular | 数码常客 |
| `rental` | The Home Base Hero | 安居主理人 |
| `phoneBill` | The Connected Regular | 在线常驻客 |
| `insurance` | The Future Minder | 未来照看者 |
| `other` | The Pattern Spotter | 规律发现家 |
| `consistent` | The Cool Consistent | 稳稳记录派 |
| `explorer` | The Curious Explorer | 好奇探索家 |
| `smallChapter` | A Small Chapter | 小小一章 |
| `incomeOnly` | The First Notes | 开篇几笔 |

Bodies must be separate natural English and Chinese sentences, warm but non-judgmental, and may interpolate only `{days}`, `{weeks}`, `{percent}`, `{category}`, or `{month}`. Add localized badge label/body pairs for every `RecapBadgeKey`.

- [ ] **Step 3: Define export-owned palettes and geometry.**

Create:

```ts
export const STORY_LOGICAL_WIDTH = 360;
export const STORY_LOGICAL_HEIGHT = 640;
export const STORY_EXPORT_WIDTH = 1080;
export const STORY_EXPORT_HEIGHT = 1920;

export const STORY_PALETTES = {
  ritual: { background: '#F6D750', foreground: '#17352D', accent: '#C94F39' },
  identity: { background: '#173F35', foreground: '#FAF4E5', accent: '#F6D750' },
  pattern: { background: '#EF704B', foreground: '#221F1D', accent: '#F9E07F' },
  habit: { background: '#D8EADF', foreground: '#17352D', accent: '#1F6F4A' },
  finale: { background: '#27242C', foreground: '#FFFFFF', accent: '#F6D750' },
} as const;
```

- [ ] **Step 4: Add a WCAG contrast test.**

Implement hex-to-relative-luminance in the test and assert foreground/background is at least 4.5:1 for every palette. Test accent/background at 3:1 only where accent is used for large decorative labels; meaningful small text must always use `foreground`.

Run:

```bash
npx jest __tests__/recapStoryCopy.test.ts __tests__/recapStoryContrast.test.ts --runInBand
npm run audit:type
```

Expected: PASS without changing audit allowlists.

- [ ] **Step 5: Commit copy and palettes.**

```bash
git add src/i18n/types.ts src/i18n/translations/en.ts src/i18n/translations/zh.ts src/lib/recapStoryTheme.ts __tests__/recapStoryCopy.test.ts __tests__/recapStoryContrast.test.ts
git commit -m "feat: add monthly story copy and palettes"
```

---

## Task 4: Create the original cow and two-second opening sting

**Files:**

- Create: `src/components/recap/DancingCow.tsx`
- Create: `__tests__/dancingCow.test.tsx`
- Modify: `tools/sfx/gen.js`
- Create: `assets/sounds/monthly-story.wav`
- Create: `__tests__/monthlyStorySound.test.ts`
- Modify: `src/lib/sound.ts`
- Modify: `__tests__/sound.test.ts`

- [ ] **Step 1: Write the static cow accessibility/render test.**

Render `DancingCow` with `motion="off"` and assert it exposes `accessibilityLabel="Dancing cow"`, contains SVG primitives, and does not schedule an animation. Render `motion="full"` with an `Animated.Value` and assert the root transform style consumes that progress value.

Run:

```bash
npx jest __tests__/dancingCow.test.tsx --runInBand
```

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Draw an original vector cow.**

Build the character from `Svg`, `G`, `Path`, `Ellipse`, `Circle`, and `Rect`: rounded cream body, dark green patches, small horns, bent forelegs, and one raised back leg. Do not use the reference image as an asset. Accept this interface:

```ts
export interface DancingCowProps {
  progress?: Animated.Value;
  motion: 'full' | 'reduced' | 'off';
  size?: number;
  exportMode?: boolean;
}
```

In Full mode, interpolate the viewer's normalized `progress` into a two-beat `rotate`, `translateY`, and `scaleX` sequence. Reduced/Off/export use the settled celebratory pose. Keep choreography original: a compact heel-toe bounce and foreleg wave, not the supplied group-circle dance.

- [ ] **Step 3: Write the failing WAV contract test.**

Mirror `savedChime.test.ts` but require RIFF/WAVE, mono 16-bit 44.1 kHz, duration between 1.9 and 2.1 seconds, non-zero audio, and peak at or below 70%.

Run:

```bash
npx jest __tests__/monthlyStorySound.test.ts --runInBand
```

Expected: FAIL because `assets/sounds/monthly-story.wav` does not exist.

- [ ] **Step 4: Add a synthesized `cowbell` voice and a named output.**

Add an original two-second inharmonic bell/percussion voice to `VOICES` with four brief hits at `0`, `0.34`, `0.72`, and `1.12` seconds, low-passed noise contact, `peak: 0.64`, and a 2.0-second release-safe duration. Add:

```js
const STORY_SHIPPED = path.join(__dirname, '..', '..', 'assets', 'sounds', 'monthly-story.wav');
```

Change the single-output branch so `--story` selects `cowbell` and `STORY_SHIPPED`, while a bare invocation still regenerates `saved.wav` exactly as before:

```js
if (argv.includes('--story')) write('cowbell', STORY_SHIPPED);
else write(flag('--voice') ?? DEFAULT_VOICE, flag('--out') ?? SHIPPED);
```

Generate:

```bash
node tools/sfx/gen.js --story
```

Expected: reports a 2-second non-silent WAV at `assets/sounds/monthly-story.wav`.

- [ ] **Step 5: Write failing semantic sound tests.**

Extend the audio mock with `pause`. Test `storyIntro()` rewinds and plays the new asset, `stopStoryIntro()` pauses it, Sounds Off prevents playback, web prevents playback, and player creation/seek/pause failure stays silent.

- [ ] **Step 6: Extend the sound wrapper.**

Keep the existing save player untouched. Add a separately lazy `storyPlayer`, `storyUnavailable`, and these exports:

```ts
export function storyIntro(): void;
export function stopStoryIntro(): void;
```

Use the existing `enabled` preference and audio mode. Set story volume to `0.5`; never play on web. Catch creation, seek, play, and pause failures without reporting story payloads or URIs.

- [ ] **Step 7: Run focused tests.**

```bash
npx jest __tests__/dancingCow.test.tsx __tests__/monthlyStorySound.test.ts __tests__/sound.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit original media.**

```bash
git add src/components/recap/DancingCow.tsx __tests__/dancingCow.test.tsx tools/sfx/gen.js assets/sounds/monthly-story.wav __tests__/monthlyStorySound.test.ts src/lib/sound.ts __tests__/sound.test.ts
git commit -m "feat: add original monthly story ritual"
```

---

## Task 5: Render all scenes from one animated/export-safe frame

**Files:**

- Create: `src/components/recap/RecapStoryFrame.tsx`
- Create: `__tests__/recapStoryFrame.test.tsx`

- [ ] **Step 1: Write failing scene and privacy render tests.**

Render every scene type in `animated` and `export` mode. Assert ritual text and cow, customized mascot SVG on identity, `of recorded spending` plus an optional neutral previous-share observation on pattern, activity days/weeks on habit, badges and `Pip` wordmark on finale. Assert no mode renders currency tokens, amount-shaped strings from test inputs, `pipfinance.app`, or viewer controls.

Run:

```bash
npx jest __tests__/recapStoryFrame.test.tsx --runInBand
```

Expected: FAIL because the frame does not exist.

- [ ] **Step 2: Implement one frame contract.**

```ts
export interface RecapStoryFrameProps {
  scene: RecapStoryScene;
  mode: 'animated' | 'export';
  motion: 'full' | 'reduced' | 'off';
  progress?: Animated.Value;
  mascotConfig: WidgetMascotConfig;
  monthLabel: string;
  categoryLabel: (categoryId: string) => string;
}
```

The outer view is exactly `STORY_LOGICAL_WIDTH × STORY_LOGICAL_HEIGHT`, uses the scene palette, is `collapsable={false}`, and has `testID="recap-story-capture-frame"`. Export mode renders every element at its final pose and ignores `progress`.

- [ ] **Step 3: Render the customized Pip accurately.**

Use `composeMascot({ ...mascotConfig, badgeIcon: 'none' }, 0)` and `SvgXml`; do not substitute the preset-only `Pip` component. Keep it inside the frame's safe area so long titles and device crops do not collide.

- [ ] **Step 4: Add scene-specific composition without finance-dashboard styling.**

Use oversized display text, two or three large kinetic SVG shapes, and strong asymmetry. Ritual uses the original cow; identity uses the user's Pip; pattern uses category icon/illustration plus integer percentage; habit uses a calendar-grid motif; finale uses physical sticker-like badges. No cards-within-cards, charts, smiley faces, account UI, or app chrome.

- [ ] **Step 5: Add the screen-reader summary.**

Give the root a single concise label composed as `Story N of M` by the modal plus a scene summary. Mark purely decorative SVG shapes inaccessible. Keep all meaningful text as real React Native text through the UI primitives.

- [ ] **Step 6: Run frame, type, and contrast checks.**

```bash
npx jest __tests__/recapStoryFrame.test.tsx --runInBand
npm run audit:type
npm run typecheck
```

Expected: PASS with no audit allowlist changes.

- [ ] **Step 7: Commit the frame renderer.**

```bash
git add src/components/recap/RecapStoryFrame.tsx __tests__/recapStoryFrame.test.tsx
git commit -m "feat: render monthly story cards"
```

---

## Task 6: Implement deterministic playback and the full-screen viewer

**Files:**

- Create: `src/lib/recapStoryPlayback.ts`
- Create: `__tests__/recapStoryPlayback.test.ts`
- Create: `src/components/recap/RecapStoryModal.tsx`
- Create: `__tests__/recapStoryModal.test.tsx`

- [ ] **Step 1: Write failing reducer tests.**

Define state `{ index, paused, completed, cycle, muted }` and events `NEXT`, `PREVIOUS`, `GOTO`, `PAUSE`, `RESUME`, `REPLAY`, `TOGGLE_MUTE`, `TICK_COMPLETE`. Verify clamped navigation, previous restarts the card, last tick marks complete, replay returns to index 0 and increments `cycle`, and mute remains session-local.

- [ ] **Step 2: Implement the pure reducer and timing policy.**

Export:

```ts
export const STORY_DURATION_MS = 5000;
export function storyAutoplays(motion: MotionSetting, osReduced: boolean): boolean {
  return motion === 'full' && !osReduced;
}
export function recapStoryPlaybackReducer(state: PlaybackState, event: PlaybackEvent): PlaybackState;
```

Reduced and Off both use manual navigation. Full with OS Reduce Motion also behaves as Reduced.

- [ ] **Step 3: Write failing modal interaction tests with fake timers.**

Mock `RecapStoryFrame`, sound, `useReducedMotion`, and the share sheet. Cover:

- five seconds advances one scene and the last scene stops;
- visible Previous/Next buttons and large tap zones navigate;
- a horizontal swipe above the threshold navigates once;
- press-in pauses at the current progress and press-out resumes for only the remaining duration;
- backward navigation restarts progress;
- Full plays cow sound once per cycle, mute stops it, replay permits one new play;
- Reduced and Off never autoplay; Off never plays sound;
- close resets merchant/mute/playback state through unmount.

Run:

```bash
npx jest __tests__/recapStoryPlayback.test.ts __tests__/recapStoryModal.test.tsx --runInBand
```

Expected: FAIL on missing modules.

- [ ] **Step 4: Build the modal shell.**

Accept:

```ts
export interface RecapStoryModalProps {
  visible: boolean;
  model: RecapStoryModel;
  mascotConfig: WidgetMascotConfig;
  onClose: () => void;
}
```

Use a React Native `Modal` with safe-area insets, black surround, segmented progress bars, Close/Mute/Replay controls, a quiet `Share card` control for the current scene, and visible Previous/Next buttons. Keep controls in siblings above/below the `RecapStoryFrame`, never inside it.

- [ ] **Step 5: Wire pause-safe progress.**

Use one `Animated.Value(0)` per active scene. Full mode starts `Animated.timing(progress, { toValue: 1, duration: remainingMs, useNativeDriver: false })`. On hold, call `stopAnimation(value => pausedProgress.current = value)`. On release, animate the remaining `(1 - value) * STORY_DURATION_MS`. Every index change stops the prior animation and resets to zero.

- [ ] **Step 6: Add gestures and accessible controls.**

Use `PanResponder` for horizontal swipe and press/hold. A release with `abs(dx) >= 48` navigates; otherwise use release X to choose left/right. Visible controls remain the authoritative accessible path with role, label, hint, and at least 44×44 touch area. Announce `Story {current} of {total}`, heading, summary, and paused state.

- [ ] **Step 7: Wire once-per-cycle sound.**

When ritual becomes active in Full mode, call `storyIntro()` only if the current `cycle` has not played and session mute is false. Call `stopStoryIntro()` on pause, navigation, mute, close, Reduced/Off, and unmount. Do not delay rendering for audio.

- [ ] **Step 8: Run playback tests.**

```bash
npx jest __tests__/recapStoryPlayback.test.ts __tests__/recapStoryModal.test.tsx --runInBand
npm run typecheck
```

Expected: PASS without open Jest handles.

- [ ] **Step 9: Commit playback.**

```bash
git add src/lib/recapStoryPlayback.ts __tests__/recapStoryPlayback.test.ts src/components/recap/RecapStoryModal.tsx __tests__/recapStoryModal.test.tsx
git commit -m "feat: add monthly story playback"
```

---

## Task 7: Add native and web capture adapters with cleanup

**Files:**

- Create: `src/lib/recapStoryExport.ts`
- Create: `src/lib/recapStoryCapture.types.ts`
- Create: `src/lib/recapStoryCapture.ts`
- Create: `src/lib/recapStoryCapture.web.ts`
- Create: `__tests__/recapStoryExport.test.ts`

- [ ] **Step 1: Write failing export-coordinator tests.**

Use injected adapters to test one-card share, sharing unavailable, permission denied, ordered multi-save, partial save with exact `savedCount` and failed IDs, capture failure, retry of failures only, and cleanup of every successfully created temporary URI even when a later operation fails.

- [ ] **Step 2: Define adapter and result contracts.**

```ts
export interface RecapStoryCaptureAdapter<Ref> {
  capture(ref: Ref): Promise<string>;
  canShare(): Promise<boolean>;
  share(uri: string): Promise<void>;
  requestSavePermission(): Promise<'granted' | 'denied'>;
  save(uri: string): Promise<void>;
  cleanup(uri: string): Promise<void>;
  openInstagram(): Promise<boolean>;
}

export type SaveStoryResult = {
  savedIds: RecapStoryScene['id'][];
  failedIds: RecapStoryScene['id'][];
};
```

`shareOneStory` and `saveSelectedStories` accept a `renderAndCapture(sceneId)` callback so the coordinator never imports React, transactions, or scene payloads.

- [ ] **Step 3: Implement sequential orchestration.**

Capture and act on one selected ID at a time in narrative order. Keep created URIs in a local list and clean them in `finally`. Request Photo permission once, before the first batch capture. On denied permission, return a typed denial without capturing. On partial save, continue remaining cards, return exact IDs, and let the UI retain only failed selection.

- [ ] **Step 4: Implement the native adapter.**

Keep the native implementation at `recapStoryCapture.ts` and the sibling override at `recapStoryCapture.web.ts`, matching the repository's existing `src/notifications/index.ts` / `index.web.ts` convention so TypeScript resolves the base module and Metro swaps the web adapter.

Use:

```ts
captureRef(ref, {
  format: 'png',
  quality: 1,
  width: STORY_EXPORT_WIDTH,
  height: STORY_EXPORT_HEIGHT,
  result: 'tmpfile',
});
```

Call `MediaLibrary.requestPermissionsAsync(true)` only from `requestSavePermission`; save via `saveToLibraryAsync`. Share via `Sharing.isAvailableAsync()` and `Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' })`. Clean up with `const file = new File(uri); if (file.exists) file.delete()`. Open Instagram only after successful saving using `Linking.canOpenURL('instagram://app')`; inability to open returns `false`, not a failed save.

- [ ] **Step 5: Implement the web adapter.**

Capture an `HTMLElement` using:

```ts
toPng(node, {
  width: STORY_LOGICAL_WIDTH,
  height: STORY_LOGICAL_HEIGHT,
  pixelRatio: 3,
  cacheBust: false,
});
```

Its `share` action creates a temporary `<a download="pip-monthly-story.png">` and clicks it. Return false for native share, Photo permission, and Instagram. The UI will expose only one-card Download on web.

- [ ] **Step 6: Run export tests and typecheck both platform files.**

```bash
npx jest __tests__/recapStoryExport.test.ts --runInBand
npm run typecheck
```

Expected: PASS, including cleanup assertions.

- [ ] **Step 7: Commit capture infrastructure.**

```bash
git add src/lib/recapStoryExport.ts src/lib/recapStoryCapture.types.ts src/lib/recapStoryCapture.ts src/lib/recapStoryCapture.web.ts __tests__/recapStoryExport.test.ts
git commit -m "feat: add monthly story image export"
```

---

## Task 8: Build card selection, ephemeral merchant disclosure, and export UI

**Files:**

- Create: `src/components/recap/RecapStoryShareSheet.tsx`
- Create: `src/components/recap/RecapStoryExportSurface.tsx`
- Create: `__tests__/recapStoryShareSheet.test.tsx`
- Modify: `src/components/recap/RecapStoryModal.tsx`
- Modify: `__tests__/recapStoryModal.test.tsx`

- [ ] **Step 1: Write failing picker tests.**

Assert identity/finale default selection, narrative-order thumbnails, at least one and at most five selected cards, one-card Share, multi-card Save, web-only single selection/Download, disclosure marking, and merchant reset on close. Add error states for unavailable share, denied permission, capture failure, partial save count, retry failed-only, and close confirmation during active capture.

- [ ] **Step 2: Add the off-screen settled export surface.**

`RecapStoryExportSurface` accepts the current export scene and renders a single `RecapStoryFrame mode="export"` at 360×640 in an absolutely positioned off-screen container. Do not use `display: none` or `opacity: 0`; both can produce blank captures. Expose the native/web node via `forwardRef`, mark it `collapsable={false}`, and keep viewer controls outside it.

- [ ] **Step 3: Implement stable capture handoff.**

Before each capture, set `exportSceneId`, wait for two animation frames (one to commit React state, one to settle layout/fonts), then invoke the platform adapter on the surface ref. Serialize captures; never mount five 1080×1920 surfaces simultaneously.

- [ ] **Step 4: Implement selection UI.**

Use a bottom sheet/modal with ordered thumbnails, explicit selected state beyond colour, and a count label. Opening it from a scene's quiet `Share card` control selects only that scene; opening it from the finale's `Choose cards` entry uses the identity/finale defaults. Tapping the selected final card when it is the last selection does nothing and announces that one card must remain. Native shows `Share card` only for one selection and `Save selected cards` for one to five. Web allows one selection and shows `Download card`.

- [ ] **Step 5: Add merchant cameo disclosure.**

On the pattern card only, offer `Add merchant cameo` when a non-empty exact merchant exists for the top category. The confirmation must display the exact merchant string before enabling. Rebuild only the open session model with `merchantCameo`; show a disclosure chip on the thumbnail and card. Store this in modal state only and clear it on close/unmount. Never write it to meta, backup, or analytics.

- [ ] **Step 6: Handle native outcomes.**

- Sharing unavailable: keep sheet open and emphasize Save.
- Permission denied: explain Photos is needed only for batch save; preserve one-card share.
- Capture failure: preserve selection, clean partial files, offer Retry and Share one card.
- Partial save: say exactly `{saved} of {selected} cards saved`, select only failures, offer Retry.
- Successful save: show `Saved to Photos` and optional `Open Instagram`; Instagram absence is informational only.

- [ ] **Step 7: Confirm only destructive-in-progress close.**

Ordinary modal/sheet close is immediate. While `captureStatus === 'capturing'`, close presents the localized confirm dialog. Confirm stops after the current awaited operation, performs cleanup, then closes; cancel returns to capture.

- [ ] **Step 8: Run picker and modal tests.**

```bash
npx jest __tests__/recapStoryShareSheet.test.tsx __tests__/recapStoryModal.test.tsx __tests__/recapStoryExport.test.ts --runInBand
npm run audit:type
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit sharing UI.**

```bash
git add src/components/recap/RecapStoryShareSheet.tsx src/components/recap/RecapStoryExportSurface.tsx __tests__/recapStoryShareSheet.test.tsx src/components/recap/RecapStoryModal.tsx __tests__/recapStoryModal.test.tsx
git commit -m "feat: add monthly story card picker"
```

---

## Task 9: Persist the Home invitation marker and route directly into the story

**Files:**

- Modify: `src/state/store.tsx`
- Create: `__tests__/recapStoryStore.test.ts`
- Modify: `src/components/recap/RecapEntry.tsx`
- Create: `__tests__/recapEntry.test.tsx`
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Write failing invitation-window tests.**

Export `shouldShowRecapStoryInvitation` from `recapStory.ts`. Assert visible on local days 1 and 7 for the immediately previous eligible month; hidden on day 8, with a matching handled marker, for empty/transfer-only previous month, and when only the current month has data.

- [ ] **Step 2: Implement the pure invitation predicate.**

```ts
export function shouldShowRecapStoryInvitation(
  transactions: Transaction[],
  now: Date,
  handledMonth: string | null,
): { visible: boolean; month: string } {
  const month = prevMonthKey(currentMonthKey(now));
  const inWindow = now.getDate() >= 1 && now.getDate() <= 7;
  return {
    month,
    visible: inWindow && handledMonth !== month &&
      buildRecapStoryModel({ transactions, month, now }) !== null,
  };
}
```

- [ ] **Step 3: Write the failing meta persistence test.**

Mock `setMeta`, call an exported `persistRecapStoryHomeHandledMonth('2026-08')`, and assert:

```ts
expect(setMeta).toHaveBeenCalledWith('recap_story_home_handled_month', '2026-08');
```

- [ ] **Step 4: Add the store state/action.**

Add to `AppData`:

```ts
recapStoryHomeHandledMonth: string | null;
markRecapStoryHomeHandled: (month: string) => Promise<void>;
```

Load the key in `refreshAll`'s existing `Promise.all`, initialize state to `null`, and update state only after `setMeta` succeeds. Keep the marker through reset/backup operations; it is a harmless month-scoped UI preference, not financial content.

- [ ] **Step 5: Convert `RecapEntry` into the days 1–7 invitation.**

Accept `handledMonth`, `onDismiss(month)`, and `onOpenStory(month)`. Use the pure predicate. Present an original cow thumbnail, `Your monthly story is ready`, and separate Open/Dismiss buttons. Both actions persist the handled month; Open then calls `onOpenStory`. Do not auto-open.

- [ ] **Step 6: Route an explicit initial-story request.**

Change Dashboard's callback to `(month?: string, openStory?: boolean) => void`; its Home invitation passes `true`. In `App.tsx`, add `const [recapStoryRequested, setRecapStoryRequested] = useState(false)`. Normal recap navigation sets false; the invitation sets true. Pass to RecapScreen:

```tsx
initialStoryOpen={recapStoryRequested}
onInitialStoryHandled={() => setRecapStoryRequested(false)}
```

Consume the flag once so returning to Recap does not reopen the story.

- [ ] **Step 7: Run store/invitation/navigation tests.**

```bash
npx jest __tests__/recapStory.test.ts __tests__/recapStoryStore.test.ts __tests__/recapEntry.test.tsx --runInBand
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit invitation state and routing.**

```bash
git add src/state/store.tsx __tests__/recapStoryStore.test.ts src/components/recap/RecapEntry.tsx __tests__/recapEntry.test.tsx src/screens/DashboardScreen.tsx App.tsx
git commit -m "feat: invite users into completed monthly stories"
```

---

## Task 10: Integrate the permanent Recap entry

**Files:**

- Modify: `src/screens/RecapScreen.tsx`
- Modify: `__tests__/recapScreen.test.tsx`

- [ ] **Step 1: Write failing Recap entry tests.**

Extend the existing `useAppData` mock with `widgetMascotConfig`, `motionSetting`, and `soundEnabled`. Assert:

- an eligible completed month shows `View monthly story`;
- empty/transfer-only/current/future months do not;
- sparse and full models open the correct scene count;
- `initialStoryOpen` opens exactly once and calls `onInitialStoryHandled`;
- changing the selected recap month closes the old model and rebuilds the new eligible model.

Run:

```bash
npx jest __tests__/recapScreen.test.tsx --runInBand
```

Expected: FAIL on the missing control/props.

- [ ] **Step 2: Build the model outside JSX.**

Add props:

```ts
initialStoryOpen?: boolean;
onInitialStoryHandled?: () => void;
```

Use `useMemo` with only `transactions`, selected `month`, and `now` to call `buildRecapStoryModel`. Keep all monthly story math out of `RecapScreen`; the screen sees only `RecapStoryModel | null`.

- [ ] **Step 3: Add the permanent action.**

For eligible completed months, add a visually distinct `View monthly story` button ahead of PDF/Excel export. Current/future and ineligible months render no story action. Keep the existing financial Export button unchanged.

- [ ] **Step 4: Mount the modal and consume the direct-open flag.**

Open local modal state from the action. In an effect, when `initialStoryOpen && storyModel`, open once and call `onInitialStoryHandled`. If the flag targets a now-ineligible month, call the handler without opening so the route cannot get stuck.

- [ ] **Step 5: Run Recap and regression tests.**

```bash
npx jest __tests__/recapScreen.test.tsx __tests__/recapStoryModal.test.tsx __tests__/recapEntry.test.tsx --runInBand
npm run audit:type
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit integration.**

```bash
git add src/screens/RecapScreen.tsx __tests__/recapScreen.test.tsx
git commit -m "feat: open monthly stories from recap"
```

---

## Task 11: End-to-end verification and visual QA

**Files:**

- Modify only if verification exposes a defect in files already named above.

- [ ] **Step 1: Run every focused story test together.**

```bash
npx jest __tests__/recapStory.test.ts __tests__/recapStoryCopy.test.ts __tests__/recapStoryContrast.test.ts __tests__/dancingCow.test.tsx __tests__/monthlyStorySound.test.ts __tests__/sound.test.ts __tests__/recapStoryFrame.test.tsx __tests__/recapStoryPlayback.test.ts __tests__/recapStoryModal.test.tsx __tests__/recapStoryExport.test.ts __tests__/recapStoryShareSheet.test.tsx __tests__/recapStoryStore.test.ts __tests__/recapEntry.test.tsx __tests__/recapScreen.test.tsx --runInBand
```

Expected: PASS, no snapshots updated blindly, no open handles.

- [ ] **Step 2: Run the complete automated gate.**

```bash
npm test -- --runInBand
npm run typecheck
npm run audit:type
npm run audit:contrast
npm run build:web
```

Expected: all commands PASS. If the repository's existing global contrast audit fails in an unrelated sibling-project path, record the exact pre-existing output, run `__tests__/recapStoryContrast.test.ts` as the feature gate, and do not weaken either audit.

- [ ] **Step 3: Inspect generated bundles for forbidden copy.**

```bash
rg -n "pipfinance\.app|RM[[:space:]]*[0-9]|MYR[[:space:]]*[0-9]|SGD[[:space:]]*[0-9]|USD[[:space:]]*[0-9]" src/components/recap src/lib/recapStory.ts src/i18n/translations
```

Expected: no URL or amount-bearing story copy. Generic currency strings elsewhere in localization are outside this command's story-key review and must not be moved into story components.

- [ ] **Step 4: Verify web playback and one-card download manually.**

Run:

```bash
npm run web
```

On a narrow viewport, verify three- and five-scene playback, Full/Reduced/Off settings, keyboard/screen-reader labels, English/Chinese copy, large text, merchant opt-in/reset, one selected PNG download, no batch/native actions, and a 1080×1920 downloaded image with no controls.

- [ ] **Step 5: Verify Android and iOS development builds.**

On each available platform, verify:

1. Home invitation appears only on days 1–7 for the previous eligible month and does not reappear after Open or Dismiss.
2. Story never auto-opens from ordinary Recap navigation.
3. Cow sound plays once per cycle, respects Sounds Off and silent mode, and stops on pause/close.
4. Tap, swipe, hold, visible controls, replay, mute, Reduced, and Off behave as specified.
5. Single-card share opens the system share sheet without requesting Photos permission.
6. Saving one to five selected cards asks permission at the action, preserves story order, and reports partial failures exactly.
7. Saved images are 1080×1920, fully settled, legible, and free of viewer controls.
8. Open Instagram is offered only after save and its absence does not turn the save into an error.

- [ ] **Step 6: Perform the final privacy/type placeholder audit.**

```bash
rg -n "[T]ODO|[T]BD|[F]IXME|[P]LACEHOLDER|coming[[:space:]]soon" src/lib/recapStory* src/components/recap/RecapStory* src/components/recap/DancingCow.tsx __tests__/recapStory* docs/superpowers/plans/2026-09-10-monthly-wrapped-story.md
git diff --check
git status --short
```

Expected: no implementation placeholders, no whitespace errors, and only intentional files remain changed.

- [ ] **Step 7: Request code review before declaring completion.**

Invoke `superpowers:requesting-code-review` against the complete branch. Resolve correctness, privacy, accessibility, and cleanup findings; rerun Steps 1–3 after any code change.

- [ ] **Step 8: Commit verification fixes, if any.**

```bash
git diff -- src __tests__ tools/sfx/gen.js app.json package.json package-lock.json
git add -p src __tests__ tools/sfx/gen.js app.json package.json package-lock.json
git add assets/sounds/monthly-story.wav
git diff --cached --check
git commit -m "fix: harden monthly story release"
```

Skip this commit when verification required no changes.
