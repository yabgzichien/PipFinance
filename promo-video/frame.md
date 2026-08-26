---
version: alpha
name: Pip — Frame (video / frame layer)
description: >
  The blue-professional preset remixed onto Pip's real design tokens from
  PipComp/src/theme.ts, then hand-corrected where the automatic role mapping was wrong for
  this brand. The unit is the frame (1920×1080). Atoms are sacred — the tinted green-grey
  canvas (#eef1ee) with white cards on top, a single green accent (#1f8a5b) rationed to
  three uses in the entire video, the three-step ink ladder, Hanken Grotesk for every word
  and Space Grotesk for every numeral, NO shadows, and Pip's real 14/22/28 radius scale.
  Governing style reference is the Apple product film: few subjects, long holds, scarce
  colour, one thing moving at a time. Motion out of scope here; it lives in STORYBOARD.md.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  # Hand-corrected after the automatic remix: four role mappings were wrong for this
  # brand. See "## Pip corrections" below for what changed and why.
  bg: "#eef1ee"          # Pip `bg` — the tinted canvas, NOT white
  surface: "#ffffff"     # Pip `surface` — cards sit white ON the tinted canvas
  surface-2: "#f6f8f6"   # Pip `surface2` — recessed rows
  primary: "#1f8a5b"     # Pip `accent` — RATIONED, see the three-uses rule
  primary-ink: "#1c6b48" # Pip `accentInk` — accent text on light, when contrast needs it
  text: "#16201b"        # Pip `ink`
  text-muted: "#5d6b63"  # Pip `ink2`
  text-light: "#6a776f"  # Pip `ink3` — contrast-audited to AA on white
  accent-light: "#eff7f4"  # Pip `accentTint`
  accent-medium: "#dbece5" # Pip `accentSoft`
  border: "rgba(20,40,30,0.08)"   # Pip `line`
  border-faint: "rgba(20,40,30,0.05)" # Pip `line2`
  card-bg: "#ffffff"
  positive: "#1f8a5b"    # Pip has no separate positive; the accent serves
  negative: "#c0392b"    # Pip `red`
  amber: "#9c6300"       # Pip `amber` — status only, never decoration

radii:
  pill: "100px"
  card-lg: "28px"  # Pip radius.lg
  card-md: "22px"  # Pip radius.md
  card-sm: "14px"  # Pip radius.sm
  bar: "6px"
  circle: "50%"

typography:
  # Two faces in FIXED roles, exactly as the app assigns them:
  #   Hanken Grotesk — every word. Captions, labels, headlines.
  #   Space Grotesk  — every numeral. It is the app's numeric face; never set prose in it.
  # — reading ramp (Hanken Grotesk) —
  body:    { fontFamily: "Hanken Grotesk", cqw: 0.85, weight: 500, lineHeight: 1.6, color: "text-muted" }
  h4-eyebrow:{ fontFamily: "Hanken Grotesk", cqw: 0.8, weight: 700, tracking: "0.08em", upper: true, color: "text-light" }
  tag:     { fontFamily: "Hanken Grotesk", px: 12, weight: 500, color: "text-muted" }
  counter: { fontFamily: "Space Grotesk", px: 13, weight: 500, tracking: "0.05em", color: "text-muted" }
  # — display ramp (Hanken Grotesk, ink, never accent) —
  h3:      { fontFamily: "Hanken Grotesk", cqw: 1.25, weight: 500, lineHeight: 1.3, tracking: "-0.02em", color: "text" }
  blockquote:{ fontFamily: "Hanken Grotesk", cqw: 2.4, weight: 500, lineHeight: 1.35, color: "text" }
  h2:      { fontFamily: "Hanken Grotesk", cqw: 2.6, weight: 700, lineHeight: 1.1, tracking: "-0.02em", color: "text" }
  h1:      { fontFamily: "Hanken Grotesk", cqw: 4.2, weight: 700, lineHeight: 1.08, tracking: "-0.025em", color: "text" }
  # the video's caption face: one line, centred, held. Bigger than a deck headline.
  caption: { fontFamily: "Hanken Grotesk", cqw: 3.4, weight: 700, lineHeight: 1.12, tracking: "-0.025em", color: "text" }
  # — numeric ramp (Space Grotesk) —
  stat-num:{ fontFamily: "Space Grotesk", cqw: 1.9, weight: 700, lineHeight: 1.0, color: "text" }
  metric-value:{ fontFamily: "Space Grotesk", cqw: 3.0, weight: 700, lineHeight: 1.0, color: "text" }
  # the hero number in Scene C. The one figure the whole video resolves onto.
  hero-num:{ fontFamily: "Space Grotesk", cqw: 7.2, weight: 700, lineHeight: 1.0, tracking: "-0.02em", color: "text" }
  quote-mark:{ fontFamily: "Hanken Grotesk", cqw: 8.0, weight: 700, lineHeight: 0.5, color: "primary", opacity: 0.15 }

spacing:
  pad-x: "5cqw"
  pad-y-top: "5cqw"
  gap-cards: "1.4cqw"
  accent-line: "60px × 4px"

components:
  card-tinted:
    backgroundColor: "{colors.card-bg}"
    border: "1.5px solid {colors.border}"
    rounded: "{radii.card-lg}"
    shadow: "none"
    description: "Universal content card. Never solid-colored, never opaque-bordered, NO shadow."
  metric-card:
    backgroundColor: "{colors.card-bg}"
    border: "1.5px solid {colors.border}"
    rounded: "{radii.card-lg}"
    typography: "{typography.metric-value} ({colors.primary}) + {typography.metric-label} + {typography.metric-desc}"
    description: "+ optional inline ↑/↓ change chip ({colors.positive}/{colors.negative} text, no fill)."
  tag-pill:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.primary}"
    rounded: "{radii.pill}"
    typography: "{typography.tag}"
    description: "Top-right of the slide-header."
  cta-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "{radii.pill}"
    typography: "Space Grotesk 600"
    shadow: "soft cobalt on hover only — the system's only shadow"
    description: "The one solid element."
  accent-line:
    backgroundColor: "{colors.primary}"
    size: "60×4, 2px radius"
    description: "Above cover titles / eyebrow separators."
  bar-track:
    backgroundColor: "{colors.accent-light}"
    fill: "{colors.primary} (display:block so width resolves)"
    rounded: "{radii.bar}"
    description: "28px track; fill carries the value."
  step-circle:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "50%"
    size: "56px"
    description: "Sequential steps fade opacity 1.0→0.85→0.7→0.55."
  split-highlight:
    backgroundColor: "{colors.accent-light}"
    borderLeft: "4px solid {colors.primary}"
    rounded: "{radii.card-md}"
    description: "Inline pull-quote callout."
  slide-header:
    typography: "{typography.h4-eyebrow} (cobalt) left, tag-pill right; {typography.h2} below"
    description: "Top band of every content frame."
  atmosphere:
    elements: "clipped diagonal cobalt-tint panel, 3×3 cobalt dot grid, concentric closing rings"
    description: "Cover/closing only. Never on content frames."
  progress-bar:
    backgroundColor: "{colors.primary}"
    size: "3px tall, bottom edge, width grows with index"
    description: "Persistent progress strip."
---

# Blue Professional — Frame (video / frame layer)

## Brand adaptation (READ FIRST — the frontmatter is the source of truth)

This is the **blue-professional** preset remixed onto Pip's brand, then **hand-corrected**. The YAML frontmatter above (colors · typography · components) is **normative — use it verbatim.** The prose below is the ORIGINAL preset's intent; read it THROUGH the frontmatter:

- **Fonts** — **Hanken Grotesk** carries every word, **Space Grotesk** every numeral. Ignore any preset font name lingering in prose.
- **Colors** — use the frontmatter hex. Preset color NAMES in prose ("cobalt", "cream") mean the remapped Pip values: "cobalt" → `primary` `#1f8a5b`, "cream" → `bg` `#eef1ee`.
- **The accent rule is inverted from the preset.** blue-professional says cobalt carries *every* accent. Pip's video says the opposite: green appears **three times total**. Read "## Pip corrections" below before anything in the preset prose about accents.

## Pip corrections

The automatic remix got four role mappings wrong for this brand. All four are corrected in the frontmatter above; this section records what and why so nobody re-runs the script and silently reverts them.

| Key | Remix produced | Corrected to | Why |
|---|---|---|---|
| `bg` | `#ffffff` | `#eef1ee` | Pip's ground is a tinted green-grey, and white is what *cards* are. Painting the ground white collapses the card/canvas relationship the whole UI depends on. |
| `text-muted` | `#1c6b48` | `#5d6b63` | The remix chose `accentInk`, a green. Setting all body copy in green would spend the accent on every frame and destroy the three-uses rule. |
| `text-light` | `#9A9A9A` | `#6a776f` | A preset grey leaked through. Pip's `ink3` is deliberately darkened to pass AA on white and is guarded by `tools/contrastAudit/audit.js` in the app repo. |
| `card-bg` / `border` | 4% green fill, 20% green border | `#ffffff`, `rgba(20,40,30,0.08)` | Same reason as `text-muted`: tinting every card green spends the accent everywhere. Pip's cards are plain white with a near-invisible hairline. |

Radii were also raised from the preset's 10/12/14 to Pip's real `14/22/28` scale.

## The accent rule (hard, and the point of the whole design)

`primary` `#1f8a5b` appears **exactly three times in the finished 25-second video**:

1. The **category chip** resolving onto a transaction row (Scene B).
2. The **number** in the Left to Spend card (Scene C).
3. The **wordmark** (Scene D).

Nowhere else. Not on eyebrows, not on body copy, not on card borders, not on the progress bar, not as a decorative rule. Every preset instruction below that says "cobalt carries every accent" is **overridden by this rule**. The scarcity is what makes the three moments land; this is the mechanism the Apple reference actually runs on, and spending green a fourth time costs all three.

If a frame feels like it needs green, it needs contrast or space instead.

## Apple product-film restraint (governing style)

The user's named reference. Four working rules:

- **One subject per shot.** If two things move, one of them is wrong. The eye is told exactly where to go, once.
- **Long holds.** A beat that has landed stays on screen after it lands. The silence *is* the confidence. Budget hold time before transition time.
- **Scarce colour on a calm ground.** The frame is mostly `bg`, and the product is the only saturated thing in it.
- **Physical, unhurried motion.** Long eases, 0.9–1.4s. Nothing bounces except one mascot beat at the very end. No spin, no flourish, no easing that draws attention to itself.

Failure mode looks like a feature montage: many small things moving, several colours, cuts every 1.5s.

## Device treatment

- A neutral dark bezel, floating on the `bg` ground with a soft contact shadow beneath it. This shadow is the **one** exception to the system's no-shadow rule, because the phone has to feel like an object in space rather than a sticker.
- **Never an identifiable phone model**, and no carrier/notch branding.
- Screen corner radius reads ~44px at the size the phone occupies in frame; the bezel is uniform on all four sides.

## Category colours (real, from the app)

Computed from `PipComp/src/lib/catColors.ts` at the hues in `PipComp/src/data/categories.ts`:
`bg = oklch(0.95 0.045 h)`, `fg = oklch(0.52 0.13 h)`, `solid = oklch(0.60 0.13 h)`.

| Category | Hue | bg | fg | solid |
|---|---|---|---|---|
| Food | 162 | `#d5f9e5` | `#007f51` | `#089868` |
| Travelling | 248 | `#d8f2ff` | `#166daf` | `#3585c9` |
| Rental / Housing | 200 | `#ccf8fa` | `#007d86` | `#00969f` |
| Entertainment | 305 | `#f5e8ff` | `#7b52a4` | `#926abe` |
| Phone Bill | 355 | `#ffe3f0` | `#a0446d` | `#bb5c84` |
| Other | 220 | `#cef6ff` | `#00789c` | `#0091b5` |

These are **UI colour, not brand accent**, and they do not count against the three-uses rule. They appear only inside rebuilt app chrome, at chip scale, never as frame decoration.

## Copy rule

**No em dashes anywhere in on-screen copy.** House style, and it holds for captions, labels, and any rebuilt UI text.


## Overview

Blue Professional at frame scale is a **consulting-grade system: restraint with one strong
commitment.** A warm cream canvas and a single saturated cobalt that carries every accent —
eyebrow, metric, CTA, chart fill, progress bar. No secondary brand color, no pastels, just cream,
cobalt, and a tight ladder of grays. The register is investment-research / McKinsey briefing:
measured, data-dense without crowding, executive-readable at distance.

The voice is two faces in fixed roles: **Space Grotesk** (display, every numeral, all chrome —
eyebrows uppercase 0.08em) and **Space Grotesk** (body, muted gray, line 1.6). Headlines are near-black;
cobalt is reserved for accent moments. Depth is **soft and tinted** — 4% cobalt card fills with 20%
cobalt borders and 10–14px radii — never shadowed. The lack of harsh shadows is the premium signal.

**Key characteristics at frame scale:**

- **Warm cream ground** on every frame; **single cobalt** as the only accent.
- **Space Grotesk** (display/numerals/chrome) + **Space Grotesk** (body) — near-black headlines, cobalt numerals.
- **Tinted cards** — cobalt 4% fill, cobalt 20% 1.5px border, 10–14px radius, **no shadow**.
- **Pill chrome** (100px) — tag pills + the one solid cobalt CTA; cobalt **progress bar**.
- **Soft rounded corners everywhere** (no square corners save the progress bar).
- **Atmosphere** (diagonal panel, dot grid, concentric rings) on cover/closing only.

## The Frame

### Frame Craft Bar

Three eyeball tests gate every frame before any structural check:

- **Squint** — one **near-black headline or cobalt numeral** dominates at 3–6× its neighbor.
- **Silence** — content frames read **balanced, not crowded**; the **dashboard is the one dense exception**.
- **Restraint** — a **single cobalt accent** carries everything; headlines stay near-black (never cobalt); no shadows (tinted cards do the lift); positive/negative inline-text only.
- **Reference** — aim at an **investment-research / McKinsey quarterly briefing**; failure looks like a **heavy-outlined, multi-color dashboard**.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `pad-x` 5cqw; bottom reserves room for the counter + progress bar.

**The container law (load-bearing).** Every frame ground sets `container-type: size`; ALL
frame-relative units are `cqw`/`cqh` against it — never `vw`. Card radii stay px (10–14px); the
pill radius stays 100px; borders stay 1–1.5px.

## Colors

Tokens identical to the source. `{colors.bg}` cream is the universal ground; `{colors.primary}`
cobalt is the **only** accent — every eyebrow, numeral, CTA, chart fill, progress bar, and the 4px
highlight left-rule. Headlines are `{colors.text}` near-black (never cobalt); body is
`{colors.text-muted}`; tertiary is `{colors.text-light}`. Cards fill `{colors.card-bg}` (4%) with
`{colors.border}` (20%) borders. `{colors.positive}`/`{colors.negative}` appear **only inline** on
directional change chips — never as fills. **No second accent color.**

## Typography

Two ramps. The **reading ramp** (Space Grotesk body 0.85cqw muted; Space Grotesk eyebrow uppercase 0.08em
cobalt) carries copy + chrome; the **display/numerical ramp** (Space Grotesk `h3` 1.25cqw → `h1`
4.2cqw near-black; numerals `stat-num`/`metric-value` in cobalt) carries headings and figures.

- **Legibility floor:** any load-bearing line ≥ **1.4cqw**; px chrome (tag/counter) is colophon only.
- **Fit-to-measure:** size the headline to its length. Cap the block at **≤ 78cqw**; ≤3 words → `h1`; 4–6 → `h2`; 7+ → `h3`. Cobalt numerals scale `metric-value`→`stat-num` by card size.
- **Headlines near-black, −0.02em**; **eyebrows cobalt, uppercase, 0.08em**; **numerals cobalt 600–700**; **body Space Grotesk 400 muted, line 1.6**. No italic, no uppercase body, no cobalt headline.

## Depth & Surface

Soft and tinted — never offset. Depth from:

- **Tinted cards** — 4% cobalt fill + 20% cobalt 1.5px border + 10–14px radius reads as lifted without offset.
- **Border-left accent** — the 4px cobalt rule on split-highlight blocks pulls a callout forward.
- **Rounded corners** — the 10–14px radius is part of the softness; square corners break it.

**Ceiling:** zero box-shadow on content (the only shadow is a soft cobalt CTA _hover_); no opaque cobalt borders; no harsh outlines.

## Shapes

- **100px** — tag pills, CTA, nav buttons (pill chrome).
- **14/12/10px** — cards by size (large metric / standard stat / detail + mini).
- **6px** — bar tracks + fills. **50%** — step circles, nav circles, dots, closing rings.
- **0** — only the progress bar. No square-cornered content.

## Components

- **card-tinted / metric-card** — the universal soft-tint content cards (no shadow).
- **tag-pill / cta-button / accent-line** — the cobalt pill chrome + the one solid CTA + the 60×4 rule.
- **bar-track / step-circle / split-highlight** — cobalt data + sequence + callout patterns.
- **slide-header** (eyebrow + tag pill) — the structural rhythm; **atmosphere** (diagonal/dots/rings) on cover/closing only; **progress-bar** on every frame.

## Frame Treatments

> Recipe: ground · container · composes · focal · chrome · accent · silence · Fixed/Free · density.
> Atmosphere only on cover/closing; content frames carry the slide-header rhythm.

### 1 · Cover (identity · move: diagonal accent · left)

**Ground** cream + the clipped diagonal cobalt-tint panel (right ~36%) + a 3×3 cobalt dot grid.
**Composes** accent-line, meta, h1, body sub. **Focal** a 2-line Space Grotesk `h1` near-black, left,
under a cobalt accent-line + meta. **Chrome** counter + progress bar. **Accent** the cobalt line +
diagonal panel. **Silence** the diagonal panel holds the right third. **Fixed** near-black h1, cobalt
accents, atmosphere here only. **Free** title, meta. **Density** low.

### 2 · Dashboard (data · move: 3-up metric grid · the dense frame)

**Ground** cream, `pad-x`. **Composes** slide-header (eyebrow + tag-pill), h2, 3× metric/tinted card.
**Focal** a row of tinted cards — cobalt `metric-value` + Space Grotesk label + muted desc + optional
green/red change chip. **Chrome** eyebrow left, tag-pill right; progress bar. **Accent** the cobalt
numerals. **Silence** tight — the density exception. **Fixed** 4% tint cards, 20% borders, no shadow,
cobalt numerals. **Free** figures (from script), labels. **Density** dense-exception.

### 3 · Bar Ranking (data · move: cobalt bars · left)

**Ground** cream, `pad-x`. **Composes** eyebrow, h2, bar-track rows. **Focal** 3–5 labeled
cobalt-fill bars on cobalt-8% tracks with cobalt percentages. **Chrome** eyebrow; progress bar.
**Accent** the cobalt fills + figures. **Silence** moderate. **Fixed** 6px tracks, cobalt fills.
**Free** rows, values (from script). **Density** standard.

### 4 · Pull Quote (quote · move: concentric rings · centered)

**Ground** cream, centered, with faint concentric closing-rings behind. **Composes** quote-mark,
blockquote, cite. **Focal** a Space Grotesk `blockquote` near-black under a 15%-opacity cobalt
quote-mark; an uppercase cobalt-muted cite beneath. **Accent** the faint rings + quote-mark. **Silence**
~55%. **Fixed** near-black quote, soft rings. **Free** quote, cite. **Density** low.

### 5 · Split + Highlight (content · move: asymmetric split · left)

**Ground** cream, two columns. **Composes** eyebrow, h2, body, split-highlight block. **Focal** an
Space Grotesk body column beside a cobalt-8% highlight block (4px cobalt left rule) carrying an inline pull
quote. **Accent** the highlight's left rule. **Silence** generous gutter. **Fixed** tinted highlight,
4px cobalt rule. **Free** body, callout. **Density** standard.

### 6 · Closing / CTA (closer · move: centered rings + CTA)

**Ground** cream + concentric closing-rings. **Composes** accent-line, h1, body, cta-button. **Focal**
a Space Grotesk `h1` near-black, centered, with the one solid cobalt `cta-button` pill below. **Accent**
the CTA + rings. **Silence** ~60%. **Fixed** one CTA, near-black h1, soft rings. **Free** sign-off, CTA
label. **Density** low.

## Composition Rules

### Do

- Start every frame on **warm cream**; let **cobalt carry every accent** (eyebrow, numeral, CTA, bar, progress).
- Set headlines **near-black, −0.02em**; eyebrows **cobalt uppercase 0.08em**; numerals **cobalt 600–700**.
- Use **tinted cards** (4% fill, 20% border, 10–14px radius, no shadow); body Space Grotesk 400 muted, line 1.6.
- Keep all chrome **pill-shaped (100px)**; one solid cobalt CTA per closing frame.
- Reserve **atmosphere** (diagonal panel, dots, rings) for cover/closing; content frames keep the slide-header rhythm.
- Lean left on cover/dashboard/split, centered on quote/closer.

### Don't

- No second accent color; no cobalt headlines.
- No drop shadows on content (only the soft cobalt CTA hover); no opaque cobalt borders.
- No square corners (save the progress bar); no font substitutes; no uppercase body.
- Don't use the green/red change chips as general accents — directional comparisons only.
- Don't fill space with heavier borders — add substance; don't blow a headline edge-to-edge.

## Aspect-Ratio Behavior

| Treatment         | 16:9                       | 9:16                           | 1:1                      |
| ----------------- | -------------------------- | ------------------------------ | ------------------------ |
| Cover             | title left, diagonal right | title top, diagonal band below | title upper, dots corner |
| Dashboard         | 3 cards across             | 3 stacked                      | 2×2                      |
| Bar Ranking       | 3–5 bars                   | 3–5 bars (tighter)             | 3 bars                   |
| Pull Quote        | centered, rings behind     | centered, taller               | centered                 |
| Split + Highlight | side-by-side               | stacked                        | stacked                  |
| Closing / CTA     | centered + CTA             | centered + CTA                 | centered + CTA           |

`pad-x` holds on the short edge; re-step display above the 1.4cqw floor. The diagonal cover panel
becomes a top/bottom band on 9:16. Numerals stay Latin Arabic digits in CJK builds.

## Approved Entities

No real customers, logos, or vendors are defined in the source — render any such mark as a
placeholder. Figures, metrics, and quotes are content; the system supplies cream + cobalt + grays.

## Numerals & Claims (hard rule)

Never invent figures, financials, percentages, or dates at frame scale. Render slots as `— figure —`,
`{metric}`, `+NN%`, `↑ —`. Metric cards, bar values, and stat cells especially carry placeholders
until the script supplies them. Directional chips require a real comparison from the script.

## Pre-Render Self-Audit

- **Squint** — one near-black headline or cobalt numeral dominates per frame.
- **Silence** — content frames balanced, not crowded; only the dashboard runs dense.
- **Single accent** — cobalt only; headlines near-black; positive/negative inline only.
- **Type** — Space Grotesk headings −0.02em near-black, cobalt eyebrows 0.08em + numerals; Space Grotesk body muted line 1.6; ≥1.4cqw floor.
- **Depth** — tinted cards (no shadow), soft rounded corners, 20% cobalt borders; no square content corners.
- **Anchor** — left on cover/dashboard/split, centered on quote/closer; atmosphere on cover/closing only.
- **Fabrication** — every numeral traces to the script, else placeholder.

## Known Gaps

- **Motion intentionally out of scope.** frame.md specifies composition only; the source's 500ms translateX transitions + bar-fill animations are deck mechanics.
- **Space Grotesk + Space Grotesk via Google Fonts.** CJK pairing (Noto Sans SC 700 display / Noto Serif SC 400 body) carries over; the eyebrow's uppercase+tracking signal weakens in CJK — pair it with the accent-line.
- **9:16 / 1:1 are guidance**; verify the floor and that the diagonal panel reflows to a band.
- Diagonal panel (clip-path), dot grid, concentric rings, and bars are CSS-only; no external imagery is required.
