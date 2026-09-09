# Widget mascot customization: composable parts, sizing, and button layout

Status: approved in chat 2026-09-08, spec pending user review before implementation.

## 1. Context

Users have asked to customize the home-screen widget's Pip. The request covers
the mascot's hat/hair, eyes, mouth and held props, its size, whether the
income/expense arrows appear at all, and the look of the streak badge.

Two facts about the current code shape everything below.

**There are two unrelated Pips.** The in-app mascot (`src/components/Pip.tsx`,
1571 lines of `react-native-svg` components) and the widget mascot
(`src/widget/QuickRecordWidget.tsx:8-65`, a hand-written SVG *string* passed to
`SvgWidget`) share no code. They are separate drawings in separate renderers.

**Pip's existing poses are whole-face bundles, not parts.** `nerdy`, `sassy`,
`swordsman`, `scientist` and `eating` each explicitly own the entire face —
`expr` is ignored while they are on — and `swordsman`/`scientist` own the head
slot too. Free mix-and-match across hat × eyes × mouth × prop is the opposite of
how that file is organised.

The one lucky break: both draw in a **100-unit coordinate space**. `Pip.tsx`
uses `viewBox="0 0 100 100"` (`Pip.tsx:1420`), and the widget mascot draws
inside `translate(5, 5) scale(0.54)` over the same 100 units
(`QuickRecordWidget.tsx:31`). Existing Pip art can therefore be transcribed into
SVG-string fragments with its coordinates unchanged. The v1 catalog is
transcription work, not illustration work.

## 2. Decisions taken

Six questions were settled before design:

1. **Scope — widget only.** `Pip.tsx` is not touched. In-app poses keep working
   exactly as they do today. This is the single biggest cost saver: no
   re-architecture of the curated poses, no dual-renderer part model.
2. **Entry point — an in-app settings screen.** Not Android's per-widget
   configuration activity. One saved look applies to every placed widget.
3. **Composition — presets plus per-slot overrides.** A preset fills all four
   slots at once; touching any slot flips the config to `custom`.
4. **Arrows off — the streak display expands** into the freed space.
5. **Streak styling — cosmetic only.** The user picks the badge's icon and
   colour, never its form.
6. **Sizing — two 5-stop notched sliders**, one for the mascot and one for the
   buttons. Discrete stops, drag gesture.

Decisions 4 and 5 interlock: because the user never chooses a *form*, the form
is derived from layout — a compact badge when arrows are shown, an expanded
number-plus-dots block when they are not. `badgeIcon` and `badgeColor` apply to
whichever form the layout selected. This removes a settings dimension and the
form × icon compatibility matrix that would come with it.

Decision 6 was reached against a genuine alternative (a continuous slider). It
was rejected on two grounds: the mascot's range spans ~20dp, where a continuous
control advertises precision that is not perceptible; and continuous × continuous
sizes cannot be enumerated, so guaranteeing the pair fits the widget would
require either lowering both maxima or dynamically clamping one slider from the
other. Five stops keep the value set enumerable (25 pairs) and unit-testable.

### Rejected approaches

- **Structured shape descriptors** (parts as `{kind:'circle', cx, cy, r}` data
  with an emitter). Buys programmatic recolouring and automatic bounds checks;
  costs an emitter plus rewriting every ported part as data rather than pasting
  it. The only user-tunable colour is the streak badge, which string templating
  handles. YAGNI.
- **Pre-rendered preset SVGs with no composition.** Roughly half the work, but
  structurally cannot do per-slot mixing, which is the actual request.

## 3. The part model

A part contributes one or more **z-layered** fragments:

```ts
interface MascotPart {
  id: string;                              // stable, persisted, English
  slot: 'head' | 'eyes' | 'mouth' | 'holding';
  layers: { z: number; svg: string }[];    // 100-unit coords
}
```

Multi-layer is load-bearing, not generality for its own sake. Occlusion is what
makes these poses read at 48dp: the straw hat's crown must sit *under* its own
brim (`Pip.tsx:412-437` is emphatic that reversing this turns the hat into "a
cake on a plate"), and the swordsman's sheathed katana sit *behind* the coin
while the bitten one sits in front (`Pip.tsx:555-556`). A part emitting
`[{z:-10,…},{z:60,…}]` expresses this without inventing extra slots.

Fixed z bands:

| z | band |
|---|---|
| -20 | behind body (sheathed katana) |
| 0 | coin body and sprout |
| 20 | face (eyes, mouth) |
| 40 | head (hat, bandana, goggles) |
| 60 | held in front (lollipop, bowl, flask) |
| 80 | streak badge |

**The coin body is not customizable.** It is the brand — the same reasoning
`Pip.tsx:8` gives for Pip being one fixed character rather than a shape that
recolours per accent preset. Every part layers onto it.

**Slots eliminate conflicts by construction.** One part per slot means a straw
hat and lab goggles cannot co-occur; they are both `head`. There is no
validation table and no invalid-combination handling anywhere in the design.

### v1 catalog

All transcribed from existing `Pip.tsx` art at unchanged coordinates.

| Slot | Options |
|---|---|
| `head` | none · straw hat · propeller cap · bandana · pushed-up goggles |
| `eyes` | default · big/nerdy · sassy lashes · shades · scarred-shut · blissful-shut |
| `mouth` | smile · toothy grin · open · tongue-tip · katana bite |
| `holding` | none · lollipop · noodle bowl · flask and test tube · thumbs-up · crossed katana |

Six presets are named configs over that table: **Classic** (today's look, the
default), **Nerdy**, **Cool**, **Swordsman**, **Scientist**, **Chef**.

Part and preset *display names* are translated. Part *ids* stay stable English
strings, because they are persisted.

## 4. Configuration

```ts
interface WidgetMascotConfig {
  version: 1;
  preset: PresetId | 'custom';
  head: string; eyes: string; mouth: string; holding: string;
  mascotNotch: 1|2|3|4|5;   // default 5
  buttonNotch: 1|2|3|4|5;   // default 3
  showIncome: boolean;      // default true
  showExpense: boolean;     // default true
  badgeIcon: 'flame'|'star'|'leaf'|'sprout'|'none';   // default 'flame'
  badgeColor: 'amber'|'red'|'green'|'blue'|'violet';   // default 'amber'
}
```

Stored as one JSON blob under the `app_meta` key `widget_mascot_config`, via the
existing `getMeta`/`setMeta` in `src/db/metaRepo.ts`. One key rather than twelve,
because the config is only ever read and written whole.

**`parseWidgetMascotConfig(raw)` must never throw.** Bad JSON, unknown part ids,
out-of-range notches and missing fields each fall back to the default for that
field, and the function always returns a valid config. This is not defensive
habit: the config is parsed inside `src/widget/widgetTask.tsx`, which runs in a
headless background context where a throw fails a home-screen render with no UI
to report it.

**Defaults reproduce today's widget exactly** — Classic preset, mascot notch 5,
buttons notch 3, both arrows on, amber flame badge. A user who updates and never
opens the screen sees no visual change.

## 5. Sizing, and the width budget

These settings scale the widget's *contents*. The home-screen footprint is
resized by Android's long-press handles; the widget already declares
`targetCellWidth`/`targetCellHeight` (`app.json:59-60`) and the handler already
receives `WIDGET_RESIZED` (`widgetTask.tsx:14`).

| Notch | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| mascot (w×h) | 38×32 | 43×36 | 48×40 | 53×44 | **58×48** |
| button | 18 | 22 | **26** | 30 | 34 |

Today's widget is mascot 58×48 and buttons 26 (`QuickRecordWidget.tsx:110,140`),
so the defaults are mascot notch 5 and button notch 3 — chosen to preserve the
current look rather than to sit mid-ladder.

### A pre-existing problem this surfaces

`app.json:57` declares `minWidth: "110dp"`. Today's own content already exceeds
it: mascot 58 + buttons 26 + 26 + two 1dp dividers + 16dp horizontal padding =
**128dp**. The declared minimum is already optimistic, and the largest new
combination (58 + 34 + 34 + 2 + 16) reaches **144dp**.

Resolution: raise `minWidth` to **150dp** in the plugin config so the declared
minimum is honest and the widest combination genuinely fits. At typical launcher
cell sizes this is still a 2-cell widget, so `targetCellWidth: 2` is unchanged.
`contentWidth(config)` becomes a pure function tested against that 150dp budget
across all 25 notch pairs — an over-wide ladder then fails CI rather than
shipping clipped.

The expanded (arrows-off) layout has the same issue vertically. Mascot 58 beside
a right-hand column holding the streak number above a 7-dot row (dots at 8dp
with 2dp gaps = 68dp) totals ~150dp wide and ~42dp tall against a declared
`minHeight: "40dp"`. `minHeight` is raised to **50dp** for the same reason.

## 6. Layout

Driven by which buttons are enabled — three cases, not four:

- **Both arrows on.** Today's layout unchanged: mascot ‖ up ‖ down, two
  dividers, compact flame badge on the mascot.
- **One arrow on.** Two columns, one divider. The freed space widens the mascot
  column; the mascot keeps its chosen size and centres. The streak stays
  compact — a half-expanded streak reads worse than either end.
- **Both off.** Mascot left; streak expanded right as a column with the count
  above a 7-day dots row. No dividers. The whole widget becomes one `pip://add`
  target.

The mascot is always present and always opens `pip://add`.

The expanded dots block is recovered from the version of `StreakWidget.tsx` at
commit `f1bcbbd`, which rendered exactly this before the file became a
forwarding alias; `compute7DayDots` (`src/lib/streak.ts:249`) still feeds it.

`src/widget/StreakWidget.tsx` remains a forwarding alias so widgets placed
before the Quick Record update keep working, and it forwards the same config.

### Rendering constraint

The mascot stays **one `SvgWidget`, one parse**. `src/widget/syncWidgets.ts:10-18`
documents a real androidsvg thread-safety bug (BigBadaboom/androidsvg#46) that
intermittently drops elements when two parses race. Composition makes the mascot
string larger, which is harmless; splitting parts across multiple `SvgWidget`
elements would multiply exposure to that bug. Saving continues to go through
`syncAllWidgets()`, which already sequences the two widget updates with a 300ms
gap for this reason.

## 7. The customizer screen

A full screen, not an inline picker — the other four Appearance entries are
inline, this one is not.

Top: a live preview of **the whole widget** — shell, mascot, dividers, arrows
and the expanded streak column — rendered through `SvgXml` from
`react-native-svg` (15.12.1, already a dependency).

**Amended 2026-09-09.** This section originally specified the preview as the
mascot SVG alone, on the reasoning that preview and widget consuming one
string from one function could not drift. Shipping it proved that wrong in
the other direction: the arrow toggles, the dividers, the shell and the whole
expanded layout are drawn by `QuickRecordWidget`, not by `composeMascot`, so
half the screen's controls changed nothing visible. The preview was accurate
about the mascot and silent about everything else.

`FlexWidget`/`SvgWidget`/`TextWidget` are Android RemoteViews components with
no React Native renderer, so the screen cannot mount the real widget. The
preview is therefore a second renderer (`mascot/previewCompose.ts`) drawing
the same widget with SVG primitives. Drift is contained rather than
eliminated:

- every colour, glyph, padding and typography value comes from a shared
  `mascot/chrome.ts` that the real widget imports too — one definition, not a
  copy
- the mascot comes from `composeMascotBody`, the same function
  `composeMascot` wraps for the widget
- horizontal arithmetic uses the constants `contentWidth` uses, and a test
  asserts the preview's width equals `contentWidth(config)` for all 25 notch
  pairs across all four arrow states, so divergence fails CI

The preview draws the minimum-width packing at a fixed 1.6× scale. Fixed
rather than stretch-to-fit, so the two size sliders visibly change something;
minimum-width because the launcher's real cell size is unknowable here.

Below: preset row, four slot pickers, two notched sliders, two arrow toggles,
badge icon and colour pickers. Saving writes the blob and calls
`syncAllWidgets()`.

The notched slider is a new local component. There is no slider in the app today
— no `@react-native-community/slider` dependency and no `PanResponder` usage
anywhere in `src/` — so it is built once over `ProgressTrack`'s existing visual
language (`src/components/ui.tsx:390`) and used by both size settings. The
default notch is marked so "put it back" is discoverable.

Integration:

- `'widgetCustomizer'` joins the `Screen` union in `src/lib/screenNav.ts:7`,
  plus the `App.tsx` switcher and a back-origin entry
- a `SETTING_DEFINITIONS` row in `src/lib/settingsSearch.ts`, section
  `appearance`, with English and Chinese keywords (widget, mascot, hat, 小组件,
  挂件) so settings search finds it
- a navigating `Card` in the appearance block of
  `src/screens/SettingsScreen.tsx:186`
- **Android only** — the card is hidden on other platforms, matching how the
  widget itself no-ops off Android (`syncWidgets.ts:20`)

## 8. Backup

`src/db/restoreRepo.ts:425-445` enumerates preference keys explicitly rather
than copying `app_meta` wholesale. `widget_mascot_config` must be added on both
the restore side and wherever the export payload is built, or a restore silently
resets the user's mascot.

## 9. Files

New:

- `src/widget/mascot/config.ts` — types, defaults, non-throwing parse/serialize
- `src/widget/mascot/parts/{head,eyes,mouth,holding}.ts` — fragment catalog
- `src/widget/mascot/presets.ts` — named slot configs
- `src/widget/mascot/compose.ts` — `composeMascot(config, streak)`, `contentWidth(config)`
- `src/screens/WidgetCustomizerScreen.tsx`
- `src/components/NotchedSlider.tsx`

Modified:

- `src/widget/QuickRecordWidget.tsx` — config-driven layout, three cases
- `src/widget/{widgetTask,syncQuickRecordWidget,syncStreakWidget}.tsx` — read and pass config
- `app.json` — `minWidth` 110→150dp, `minHeight` 40→50dp
- `src/state/store.tsx` — `widgetMascotConfig` state and setter, following the
  existing preference pattern (`store.tsx:558`, `:570`, `:616`, `:1263`, `:2259`)
- `src/lib/screenNav.ts`, `App.tsx`, `src/lib/settingsSearch.ts`,
  `src/screens/SettingsScreen.tsx`
- `src/i18n/types.ts`, `src/i18n/translations/{en,zh}.ts`
- `src/db/restoreRepo.ts` and the export payload builder

## 10. Testing

All pure-function; no rendering harness needed.

1. `composeMascot` — each slot's part appears and disappears in the output;
   layers sort by z; each preset produces its expected part set.
2. `parseWidgetMascotConfig` — garbage, partial objects, unknown part ids and
   out-of-range notches all yield valid configs, and it never throws.
3. `contentWidth` — all 25 notch pairs fit the 150dp budget.
4. Layout — the three button states produce the right children. This rewrites
   `__tests__/quickRecordWidget.test.ts`, which currently asserts
   `children` has length 5 and reads buttons at fixed indices 0/2/4
   (`quickRecordWidget.test.ts:13,20,28,33`); children are located by
   `clickActionData.uri` instead, which is robust to layout changes anyway.
5. Defaults — a config parsed from an absent key renders a mascot SVG identical
   to today's output.

## 11. Out of scope

- Any change to `src/components/Pip.tsx` or the in-app mascot
- Android's per-widget configuration activity (`widgetFeatures`,
  `registerWidgetConfigurationScreen`), and therefore per-instance looks
- iOS — there is no iOS widget; the plugin is Android-only
- Customizing the coin body, its colour, or the sprout
- User-chosen streak *form*; the form is derived from layout
- New mascot art beyond transcription of existing `Pip.tsx` poses
