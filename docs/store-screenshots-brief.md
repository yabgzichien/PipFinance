# Pip: Google Play screenshot design brief

Produced via a `/grill-me` interview on 2026-08-25. This is the spec the renderer in
`AppStoreScreenshot/design/` implements. Decisions below were pressure-tested against
`docs/business-plan.md` and against the actual pixels in `AppStoreScreenshot/`, not
brainstormed in the abstract.

---

## 1. What this set has to do

Google Play shows the first two or three screenshots in the listing strip before a user
taps anything. Those slots are the highest-attention real estate the product owns, and
they are the only place the differentiator can be *shown* rather than *claimed*.

The original 11 captures did not do that. Every one of them was an output screen: a
dashboard, a donut chart, a calendar, four export previews. A stranger scrolling past
would have read "another budget app," which is precisely the position
`docs/business-plan.md` §3 says not to take.

The fix was structural, not decorative: for the first pass, slot 1 led with the capture
mechanism (Pip reading a Touch 'n Go eWallet history screenshot and extracting six
transactions), which carries both pillars at once — *fast in* (screenshot, not typing)
and *safe in* (on-device) — rather than a commodity dashboard view.

**Revised 2026-08-25:** the owner moved the dashboard back to slot 1 with new copy that
introduces the app by name, and pushed the capture mechanism to slot 2. This is a
deliberate reversal of the paragraph above, not an oversight — see the overrule log
below for the trade-off it accepts.

**Narrative arc across the 8 slots:** introduction → mechanism → truth → foresight →
full picture → friction removed → local advantage → proof of depth.

---

## 2. Decisions taken (and what was rejected)

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Slot 1 (superseded 2026-08-25) | Dashboard, with intro copy naming the app | Capture-first (the original call, §1). Reversed directly by the owner; see overrule log below. |
| Visual treatment | Caption above, whole capture inside an iPhone 17 silhouette below | Full-bleed (no room for a claim), 3D tilt (shrinks readable UI, dated), editorial callout (over-built for 8 slots) |
| Background system | One brand off-white (`#dfe6e1`) with a per-slot accent glow behind the device | Alternating dark/light (busy), flat identical (monotonous when swiped), saturated green throughout (harsh under a light app UI) |
| Export shots | All four merged into one slot | Two slots. Double-entry export is a power-user feature in a consumer tracker; it earns one slot, not a quarter of the set. |
| The cut | Multi-currency (`06`) | It is a list of toggles, all off, no data. Weakest image in the set and least relevant to the beachhead persona in business-plan §2. The capability lives in the listing text instead. |
| Caption voice | Plain clarity-led, with Pip's wry register on slots 3 and 7 | Full persona (eight jokes in a row, from an app asking for your financial data), or zero personality (hides a stated growth lever) |
| Locales | English only | BM and Chinese sets deferred. Caption text is a data file, so a locale set is a text edit plus a re-render. |
| Canvas | 1080 × 1920 | Play Store standard. The taller source aspect sets the device size, since the full capture has to fit. |

**Two things were flagged and overruled by the owner, recorded here so they are not
mistaken for oversights:**

1. The capture screenshot contains real counterparty names and amounts from a real
   wallet (CHEN JAN PIN, AH KUM ENTERPRISE, PATOWARI HASAN, FONG YAN YAN, CHEWAE
   KHOLIYOH, Amer ZZ Empire). Publishing it puts other people's transaction records on a
   public, indexable listing. Owner's call: ship as captured.
2. The Tax relief capture reads `RM 0.00` on every row. Owner's call: keep the capture,
   design around it. The caption was therefore rewritten to make the *caps* the subject
   ("Every LHDN relief, with its cap") rather than the progress, so an empty state reads
   as headroom instead of as a broken screen.
3. Slot 1 was moved from the capture mechanism back to the dashboard. §1 of this brief
   argued the opposite: that leading with a commodity dashboard view was exactly the
   "another budget app" trap to avoid, since the differentiator (screenshot capture,
   on-device) is otherwise invisible in the first two or three slots most viewers ever
   see. Owner's call: dashboard first, with the sub-caption now doing the work of naming
   Pip and its no-login differentiator in text rather than the capture flow doing it in
   pixels. The capture mechanism still runs second, one slot later than before, so the
   differentiator is still shown early, just not first.

---

## 3. Design system

Every value below is pulled from `src/theme.ts`, not invented. The store assets and the
app share one type system and one palette.

**Canvas.** 1080 × 1920. Outer padding 84px left and right.

**Type.** Real brand fonts, loaded from `node_modules/@expo-google-fonts/`:
- Headline: Hanken Grotesk 800 ExtraBold, 89px (20% up from an original 74px, per owner
  request on 2026-08-25), line-height 1.04, letter-spacing -0.022em, `#16201b`
- Sub-caption: Hanken Grotesk 500 Medium, 32px, line-height 1.42, `#5d6b63`, max-width 880px
- Slot number chip: Space Grotesk 700, 22px, on `accentSoft`

**Colour.**
- Page background `#dfe6e1`, deliberately one step deeper than the app's own
  `#eef1ee` (`LIGHT_COLORS.bg`). At an identical value the device screen and the page
  are the same colour and the phone stops reading as an object on a surface.
- Ink `#16201b`, secondary ink `#5d6b63`
- Accent green `#1f8a5b`, amber `#9c6300`, red `#c0392b`, blue `oklch(0.52 0.13 235)`
  (generated the same way `src/lib/catColors.ts` generates category hues)

**Accent glow.** A large soft radial in the slot's accent colour sits behind the device
at ~14% opacity, plus a 6px accent rule under the sub-caption. This is the only element
that changes hue between slots, which keeps the strip cohesive but not monotonous.

**Device: iPhone 17 silhouette.** 638px display width inside a 13px uniform rail, 53px
display radius, solid `#16201b` (the brand ink, not faux metal, so the frame sits with
the flat app UI instead of competing with it). A 56px safe-area strip in the app's own
`#eef1ee` runs above the capture with the Dynamic Island pill in it. Buttons follow the
iPhone 17 layout: action button plus volume pair on the left rail, side button and
Camera Control on the right, positioned as fractions of the body height so they stay
correct if the device is resized. Width was 650px before the headline size increase
below; it dropped 12px to buy back the vertical room a 20%-larger headline needed,
computed from the source image's actual aspect (1224×2700) rather than guessed — see the
measurement note under §4.

**The whole capture is shown.** Only the Android status bar comes off (132 source px),
which is what removes the owner's personal notification icons and the 42% battery
indicator. Nothing is cropped at the bottom. Device height is therefore *derived* from
the source aspect rather than chosen, and the caption block is sized to fit above what
is left: stage top y=470 (was 444), giving a 1420px body that clears the bottom edge by
30px, the same margin as before the headline change. Fanned cards on slot 8 are 380px
wide and deliberately not phone-framed, since they stand in for the exported documents
and three more handsets behind the anchor would read as clutter.

One trade-off worth naming: an iPhone frame on a *Google Play* listing is a hardware
mismatch, and showing the whole screen rather than letting it bleed off the bottom makes
the UI smaller in the listing strip. Both were requested directly and are recorded here
as choices, not accidents.

---

## 4. Slot-by-slot

| # | Source file | Headline | Sub-caption | Accent |
|---|---|---|---|---|
| 1 | `01_home_dashboard.jpg` | Know your money. | Pip is the money tracker for your cash flow, budgets, and bills, no bank login or account needed. | green |
| 2 | `Screenshot_…MainActivity.jpg` | Snap it. Pip reads it. | Screenshot Transaction Histories or Receipts, and logs transactions easily | green |
| 3 | `05_spending_breakdown.jpg` | So that's where it went. | Every category, every ringgit, right next to what you spent last month. | red |
| 4 | `03_cash_flow_calendar.jpg` | See the heavy weeks coming. | Money in and money out, day by day, before the month gets away from you. | amber |
| 5 | `02_net_worth_assets.jpg` | Everything you own. Everything you owe. | Cash, crypto, stocks, and gold at live prices, minus what you still owe. | green |
| 6 | `07_bill_splitter.jpg` | Split it down to the item. | Service charge, service tax, and vouchers, applied the way the receipt actually does it. | blue |
| 7 | `04_tax_relief.jpg` | Every LHDN relief, with its cap. | G6 to G13 tracked as you spend, so March is somebody else's problem. | amber |
| 8 | `10` + `09` + `08` + `11` | Export like an accountant would. | PDF statement, Excel workbook, HTML analytics, CSV, or JSON you can import straight back. | green |

**Copy revision (2026-08-25, `/copywriting`).** The capture slot's sub originally read
"Screenshot any wallet or bank app. Pip pulls out every transaction and keeps it on your
phone." That implies the screenshot image itself never leaves the device. It does:
`src/llm/gemini.ts` sends the capture as base64 `inline_data` to Google's API for
extraction (same for the Groq path), which `docs/business-plan.md` §8 already flags as a
live tension, not something new. The claim was narrowed to what's actually true — no
account, nothing persisted except locally — with app names made specific (Maybank, TnG,
GrabPay, the exact three named in business-plan §3). That version was later edited again
outside this brief to the shorter, more generic line in the table above; recorded here as
current, not silently overwritten. The net worth slot's headline ("The full picture, not
just this month.") was replaced for being the kind of vague phrase the copy checklist
itself flags; "Everything you own. Everything you owe." names the two numbers the
screenshot actually shows.

**Reorder and intro copy (2026-08-25).** Moving the dashboard to slot 1 meant it needed
copy that does what slot 1 is now responsible for: naming the app and stating what it is,
not just describing one feature. The new sub follows the same pattern as the corrected
capture-slot copy above — name, category, core scope, differentiator — and repeats the
"no bank login or account" claim because it is the one privacy-adjacent line verified
against the code, not assumed.

**Headline size (2026-08-25).** Raised 20% (74px → 89px) per owner request. Every
headline was measured against the actual `HankenGrotesk_800ExtraBold.ttf` metrics at the
912px caption width before shipping, not eyeballed: the worst case stayed at 2 lines
("So that's where it went." and "Split it down to the item." newly wrap to 2, none wrap
to 3), so `STAGE_TOP` moved from 444 to 470 to give the taller headline block room, and
`SCREEN_W` dropped from 650 to 638 to keep the whole capture inside the canvas at the same
30px bottom margin as before.

Slot 8 is a composite: the format picker (`10`) is the anchor device, with the PDF (`09`),
HTML (`08`) and XLSX (`11`) previews fanned behind it as rotated cards.

House style: no em dashes anywhere in caption copy.

---

## 5. Swapping a screenshot later

This was an explicit requirement. The build is data-driven:

1. Drop the replacement capture into `AppStoreScreenshot/` (any filename).
2. Point the slot's `src` at it in `AppStoreScreenshot/design/slots.json`. Adjust
   `cropTop` if the new capture's status bar differs, or to choose a different vertical
   region of the screen.
3. Re-run `python3 AppStoreScreenshot/design/render.py`.

Caption text, accent hue, crop offset and slot order all live in that same JSON. Nothing
about a swap requires touching HTML or CSS.

---

## 6. Still open

- **Feature graphic (1024 × 500)** is a separate required Play Store asset and is not
  covered here.
- **Privacy policy** remains a hard submission blocker per business-plan §8, and it is
  the thing that actually backs the on-device claim slot 1 makes.
- **Locale sets** for BM and Simplified Chinese, if the listing is localised.
