# Pip Monthly Wrapped Story — Design Specification

**Date:** 2026-09-10
**Status:** Approved design; implementation plan not yet written

## Purpose

Pip's monthly recap contains useful financial analysis but its PDF and spreadsheet exports are not socially shareable. This feature adds a short, full-screen, animated monthly story and privacy-safe 9:16 image exports.

The priorities are, in order:

1. Give the user a funny, recognizable identity they want to share.
2. Reward the habit of recording consistently.
3. Offer a small amount of financial reflection without exposing sensitive numbers.

The experience borrows Spotify Wrapped's reusable interaction model—short navigable data stories, a distinct visual world, and per-story sharing—without copying Spotify's brand or layouts. Pip's version is monthly, local-first, shorter, and deliberately amount-free.

## Product decisions

- The feature is free for every user. Playback, saving, and sharing are not paywalled.
- Stories exist only for completed calendar months.
- A Home invitation appears during days 1–7 of the new month when the previous month is eligible. It disappears after the user opens or dismisses it. A permanent entry remains in the selected completed month's Recap screen.
- Stories never open automatically.
- The visual language combines the user's customized Pip character with bold kinetic shapes.
- The first story is a recurring original dancing-cow cold open with the text “Wake up—it's the first of the month.” The cow artwork, choreography, and two-second cowbell/percussion sting must be original and must not trace or bundle meme footage or copyrighted music.
- The app plays an animated story. It does not export video in the first release.
- Users share one static card through the existing native share sheet or save several selected static cards to Photos for multi-frame posting.
- No Meta App ID, Meta API, direct Instagram Stories SDK, or `react-native-share` dependency is part of the first release.
- Shared cards contain a small `Pip` wordmark but no `pipfinance.app` URL.
- Pip retains its existing promise that no behavioural analytics leave the device.

## Eligibility and story length

A completed month is **eligible** when it contains at least one non-transfer transaction.

A month receives the **full five-story sequence** when it contains at least five expense transactions recorded across at least three distinct calendar days. All other eligible months receive the **sparse three-story sequence**. Income-only months are therefore sparse.

An empty or transfer-only month has no story and produces no Home invitation. Pip must not manufacture generic statistics to fill missing cards.

## Narrative

### Full sequence

1. **Monthly ritual**
   An original dancing cow enters, dances for approximately two seconds, and exits through a kinetic shape transition. The headline is “Wake up—it's the first of the month.” This establishes the recurring social ritual before financial content appears.

2. **Identity reveal**
   A deterministic persona title appears with the user's current customized Pip configuration. Examples include “The Cool Consistent,” “The Flavour Finder,” and “The Weekend Wanderer.” Titles describe patterns; they never praise or condemn spending.

3. **Signature pattern**
   The top expense category appears with its share of recorded spending and an illustrated category scene. The qualifier “of recorded spending” is always visible. A merchant cameo may be added only through an explicit control on this story and is never enabled by default.

4. **Habit payoff**
   Pip shows retrospective measures the ledger can prove, such as “Your records covered 18 days” and “Activity across four weeks.” These refer to transaction dates, not the dates on which entries were created. Pip does not claim a historical logging streak because current freeze/pause state cannot reconstruct a past streak reliably.

5. **Final collection**
   Two or three earned badges summarize the month. This story leads into card selection. Identity and final-collection cards are preselected; the user may select any one to five eligible cards.

### Sparse sequence

1. The same cow ritual.
2. A modest identity/activity story based only on available facts.
3. A small badge finale and sharing entry.

Sparse copy acknowledges that Pip saw a small chapter without shaming the user, implying complete coverage, or inventing a trend.

## Persona and copy engine

`buildRecapStoryModel` is pure and deterministic. It derives a persona from these amount-free dimensions:

- dominant category and its integer percentage of recorded expenses;
- number of distinct transaction dates represented in the month;
- number of calendar weeks containing activity;
- number of represented expense categories;
- whether activity clusters on weekends or weekdays;
- whether valid previous-month category-share data exists.

Persona selection uses this priority:

1. A dominant-category persona when one category represents at least 35% of recorded expenses.
2. A consistency persona when activity appears in at least three calendar weeks.
3. An explorer persona when at least four categories appear and none reaches the dominance threshold.
4. A neutral “small chapter” fallback.

Implementation must provide at least twelve reviewed English/Chinese persona-copy pairs plus explicit sparse and income-only fallbacks. Copy is stored in typed localization resources rather than generated at runtime. Jokes may be warm and witty but not insulting, moralizing, diagnostic, or based on protected/sensitive inferences.

## Privacy contract

The story builder may inspect local transactions to calculate ratios, but its returned model must not contain:

- currency amounts or formatted money strings;
- income, balance, net worth, debt, budget, or overspend values;
- account names or identifiers;
- raw transaction descriptions;
- merchant names unless the user explicitly enables one merchant cameo for one story instance.

All percentages are whole numbers and are labelled as shares of **recorded** spending. Month-over-month observations appear only when both completed months contain recorded expenses. Directional changes are neutral facts, never verdicts.

Merchant cameo state is ephemeral to the open story session. Enabling it shows the exact name that will appear and affects that card's playback and export. Closing the story resets the choice to off; Pip does not silently persist public disclosure consent.

No story content, viewing event, share selection, or share attempt is transmitted. Existing crash diagnostics remain unchanged and must not include story-model payloads or captured image URIs.

## Architecture

`RecapScreen.tsx` remains a consumer of prepared story data rather than absorbing more monthly math or animation state.

```text
RecapScreen / Home invitation
        ↓
buildRecapStoryModel()
        ↓ amount-free, deterministic story data
RecapStoryModal
   ├─ StoryPlayback — timing, navigation, sound, animation
   ├─ RecapStoryFrame — shared visual layout
   └─ StorySharePicker — selection, capture, save/share
```

### `src/lib/recapStory.ts`

Owns eligibility, sparse/full selection, percentage calculations, persona selection, badges, story ordering, and privacy-safe output types. It accepts raw local data and returns a discriminated union of story scenes. No UI, database, file, or sharing imports are allowed.

### `src/components/recap/RecapStoryModal.tsx`

Owns the full-screen viewer, current index, autoplay timer, pause state, mute state, replay, close behavior, and transition orchestration. It delegates scene content to `RecapStoryFrame`.

### `src/components/recap/RecapStoryFrame.tsx`

Renders every story in two modes:

- `animated`: playback motion is active and viewer controls sit outside the captured frame.
- `export`: all elements are placed in their final settled pose, transient effects are removed, and the layout is safe for capture.

The same content component and design tokens serve both modes so the exported image matches the final playback frame.

### `src/components/recap/DancingCow.tsx`

Contains original vector artwork made from `react-native-svg` primitives and animation values supplied by the viewer. It has a meaningful static pose for Reduced Motion and export mode.

### `src/components/recap/RecapStoryShareSheet.tsx`

Shows thumbnails for all eligible cards, preselects identity and finale, permits one to five selections, captures in narrative order, and presents the appropriate share/save action.

### Entry points

- `RecapScreen.tsx` adds “View monthly story” for any eligible completed month.
- `RecapEntry.tsx` becomes the days-1–7 Home invitation for the newly completed month and records a local per-month opened/dismissed marker.

## Playback and motion

- Each story receives a five-second autoplay slot.
- Tap left/right or swipe to navigate.
- Press and hold pauses both animation and progress.
- Releasing resumes from the paused position.
- Segmented progress bars show position and remaining time.
- Replay, mute, and close controls remain reachable throughout playback.
- Navigating backward replays that story from its beginning.
- Navigating forward settles and advances without waiting for the timer.
- The opening sting plays only on the cow story and only once per uninterrupted playback cycle.
- Sound follows Pip's existing sound preference, respects device silent mode, and can be muted for the current story session.

Motion setting behaviour:

- **Full:** all choreography, transitions, autoplay, and sound are available.
- **Reduced:** static cow, short crossfades, no kinetic morphs, and manual navigation.
- **Off:** static frames, no transitions, no autoplay, no sound, and manual navigation.

The cow should be recognizable as a playful cow at small phone sizes, but it must not reproduce the supplied meme image's composition, character design, or exact choreography.

## Rendering and export

On Android and iOS, `react-native-view-shot` captures a non-collapsible export-mode view at 1080×1920 PNG. Capture begins only after fonts and local vector assets are ready. Selected cards are captured sequentially to bound memory use, and temporary files are removed after sharing or saving.

`expo-media-library` saves a selected set to Photos in story order. Photo permission is requested only when the user chooses “Save selected cards.” After a successful save, Pip offers to open Instagram if installed; otherwise it leaves the cards in Photos and explains where they were saved.

For one card, Pip uses the existing `expo-sharing` flow. The system share sheet chooses the destination; Pip does not promise direct placement into the Instagram Story composer without Meta integration.

On web, playback is supported. A platform-specific DOM capture adapter downloads one selected PNG. Batch Photos saving, native share sheets, and open-Instagram affordances are hidden. The web adapter must preserve the same 9:16 export layout and privacy tests, even though it does not use `react-native-view-shot`.

## Interaction details

- The Home invitation is visible only during local calendar days 1–7 and only for the immediately previous eligible month.
- Opening or dismissing it stores a local month-scoped marker and removes it from Home. The Recap entry remains available.
- The story never asks for Photo permission during playback or single-card sharing.
- The finale opens the selection sheet; each story also offers a quiet “Share card” control.
- A selected merchant cameo is visually marked in the picker so disclosure cannot be overlooked.
- Closing during capture requires confirmation; ordinary story closing does not.

## Accessibility and localization

- Screen readers announce “Story N of M,” the scene heading, its concise summary, and whether playback is paused.
- Visible previous, next, pause/play, mute, replay, share, select, save, retry, and close controls have roles, labels, and minimum touch targets. Large tap zones are supplemental rather than the only navigation mechanism.
- Progress is not communicated by colour alone.
- Reduced Motion and Off settings follow the behaviour defined above.
- English and Chinese copy is written and reviewed separately. Layout tests cover long month names, large text, and the longest approved persona title in both languages.
- Exported text must remain legible against every generated palette; exported cards do not inherit light/dark app surfaces and instead use fixed, contrast-checked story palettes.

## Failure handling

- If sharing is unavailable, offer Save instead.
- If Photo permission is denied, explain that batch saving needs permission and keep single-card sharing available.
- If capture fails, keep the story and selection state open, remove any partial temporary files, and offer Retry or Share one card.
- If only some selected cards save, report the exact saved count, retain the failed selection, and offer Retry for the remainder.
- If Instagram is not installed or cannot be opened, do not report failure after cards were successfully saved.
- If the original sound asset cannot load, continue silently without delaying the first frame.
- No blank, partially animated, or control-covered capture may be passed to sharing.

## Testing and verification

### Pure model tests

- completed/current/future month boundaries;
- empty, transfer-only, income-only, sparse, and full eligibility;
- threshold edges at five expenses and three distinct days;
- category shares and rounding;
- persona priority and deterministic fallbacks;
- activity-day and activity-week calculations across timezone/month boundaries;
- month-over-month suppression when either month lacks expenses;
- merchant cameo off by default and scoped to one session/story;
- recursive privacy assertion that default models contain no prohibited fields or money-like formatted strings.

### Component tests

- autoplay and progress with fake timers;
- tap, swipe, hold-to-pause, backward replay, and close;
- Full, Reduced, and Off motion settings;
- existing sound preference, session mute, silent failure, and once-per-cycle playback;
- three- and five-story navigation;
- selection defaults and one-to-five bounds;
- permission denial, capture failure, partial save, retry, and temporary-file cleanup;
- Home invitation date window and opened/dismissed marker;
- current-month story exclusion.

### Render and manual verification

- Captured PNGs are exactly 1080×1920 and contain no viewer controls.
- Every story palette passes WCAG AA for meaningful text.
- English and Chinese layouts survive narrow phones and large text without clipping.
- Android and iOS devices verify capture, one-card sharing, batch Photos saving, and opening Instagram when installed.
- Web verifies playback and one-card PNG download.
- Existing recap, Home navigation, exports, sound settings, motion settings, and theme audits continue to pass.

## Dependencies and configuration

Add Expo-compatible versions of:

- `react-native-view-shot` for Android/iOS capture;
- `expo-media-library` for saving selected images.

Use existing `expo-sharing`, `expo-audio`, and `react-native-svg`. Add `html-to-image` as the web-only DOM capture adapter.

No Meta credentials, backend service, remote asset host, analytics SDK, generative-AI call, or network connection is required.

## Out of scope

- Video/GIF export;
- copied meme footage, choreography, or music;
- direct Meta/Instagram Stories SDK integration;
- behavioural analytics;
- public profile links or referral URLs;
- user-authored story text;
- Pro-only themes;
- annual Wrapped aggregation;
- server-side rendering or storage of story cards.

## Acceptance criteria

The feature is complete when an eligible user can open the previous month's story from Home or any eligible completed month from Recap, watch or manually navigate a privacy-safe three- or five-card sequence, hear or mute the original cow sting according to settings, export any settled card as a 1080×1920 PNG, save one to five selected cards in order, and recover cleanly from permission, capture, save, or sharing failures without sending financial or behavioural data off-device.

## Sources

- [Spotify: 2025 Wrapped user experience](https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/)
- [Spotify: 2024 Wrapped for Artists design and sharing](https://newsroom.spotify.com/2024-12-04/from-data-to-strategy-how-artists-can-make-the-most-of-their-2024-wrapped/)
- [Expo: `react-native-view-shot`](https://docs.expo.dev/versions/latest/sdk/captureRef/)
- [Expo: Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)
- [Expo: screenshot and Media Library tutorial](https://docs.expo.dev/tutorial/screenshot/)
