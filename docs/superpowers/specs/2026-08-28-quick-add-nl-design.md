# Quick add: natural-language entry: design spec

Status: approved for implementation. Date: 2026-08-28.

## Problem

Logging one expense by hand costs six interactions: open the add hub, tap "Enter it
manually", type an amount, type a merchant, scroll the category grid, tap Add. Scanning is
cheaper per row but only pays off when there is something to scan; there is no fast path for
the case that actually dominates daily use, which is one small cash spend the user already
holds in their head.

`RM 9.20 on lunch` is one thought. The app makes the user decompose it into four fields.

The gap matters most for the habit loop the rest of the app is built around. A user who
misses two days of logging because each entry is a chore stops being a user. The streak,
the budget envelope, and the income baseline all degrade from the same root cause: entry
friction.

## Goals

- One line of typed text — `lunch 9.2` — produces a correctly categorised transaction that
  the user confirms with a single tap.
- The common case costs nothing: no network call, no API spend, no waiting. Repeat merchants
  resolve locally and instantly.
- The feature degrades to something still useful with no API key, no signal, and an
  unparseable input. It never becomes a dead button.
- Works in English and Simplified Chinese, matching the rest of the app.
- Nothing wrong reaches the ledger without the user seeing it first.

## Non-goals (v1)

- **Voice input.** The brief is typing. Speech-to-text is a separate capability with its own
  permissions story.
- **A new `TxnSource`.** Quick-add rows save as `'manual'`, which is honest — the user typed
  them and confirmed them. Avoids a schema migration and touching every switch on that union.
  Cost, accepted: no analytics on feature usage.
- **Foreign currency on the batch path.** See §4. Single-item entries handle it fully.
- **Splits, account selection, or remarks from text.** All reachable on the confirm screen,
  which the user is already looking at. Parsing them buys one saved tap and costs a much
  looser contract.
- **Editing an existing transaction by typing at it.** Different feature.

## 1. Core principle

**The LLM is an enhancement, never a dependency.**

A local, pure, offline parser runs first and always. It handles the shape that dominates real
use — a label and a number — and hands the label to the learned merchant memory the app has
been accumulating since day one. The LLM is called only when that combination comes up short.

This inverts the obvious design, in which every entry is a prompt. The reasons are concrete:

- The second `lunch 9.2` should be free and instant. Sending it to a model is a round-trip
  and an API call to re-derive an answer the app already knows.
- A finance app that cannot log an expense on a plane or in a basement is broken.
- Entry is the highest-frequency action in the product. Per-entry cost compounds.

The failure mode inverts too. When the LLM is unavailable, the user does not lose the
feature — they lose the *categorisation*, and still get the amount pre-filled, which is the
tedious part. Degradation is graceful by construction rather than by error handling.

## 2. Confirmation model

**Parse, prefill, confirm.** Never save silently.

A parsed single entry lands in `ManualEntryScreen` with amount, merchant, type, date,
currency, and category already filled. The user eyeballs it and taps Add. A batch lands in
`CategorizeScreen`, which already exists and already handles per-row review, duplicate
warnings, splits, and settlement detection.

Instant-save-with-undo was considered and cut. An LLM misread that lands in the ledger is
only caught if the user is watching, and a corrupted ledger is the one failure this app
cannot afford. One tap is a fair price.

The confirm step is also nearly free to build: `ManualEntryScreen` already accepts
`initialMerchant`, `initialAmount`, `initialCurrency`, and `initialSplit`.

## 3. Data flow

```
raw text
 → parseQuickText()                     local, instant, free, offline
 → suggestForMerchant(memory, label)    local, existing learned memory
 → if (any draft lacks a category || parse was low-confidence) && llm.can('quickAdd'):
       llm.quickAdd({ text, categories, today, activeCurrencies })
       → drafts, then re-apply learned memory ON TOP
 → 1 draft  → ManualEntryScreen, prefilled
   2+ drafts → CategorizeScreen, drafts + suggestions
```

Three properties of this flow are load-bearing.

**The LLM replaces, it does not patch.** When invoked it re-parses the whole input string and
returns complete drafts. A patch protocol — "fill field X of item 2" — would be a second
contract to specify, validate, and test, for no gain.

**Learned memory outranks the model.** After an LLM call, local memory hits are re-applied
over the model's answers; the model only fills gaps. This mirrors `AddFlow.onExtracted`,
where `source: 'learned'` already beats `source: 'guess'`. It is what makes the feature get
faster and more accurate with use: the category you picked last time wins over whatever the
model thinks today, and the second `lunch 9.2` never touches the network at all.

**Every LLM failure falls back to the local result.** Bounded by a 12s timeout, reusing
`AddFlow`'s existing `withTimeout`.

`QuickDraft` is the single shape both parsers produce:

```ts
interface QuickDraft {
  label: string;
  amount: number;
  type: TxnType;
  date: string | null;        // ISO; null means today
  currency: string | null;    // null means base
  categoryId: string | null;  // null means the user picks
}
```

## 4. Scope of the parse

Both parsers fill the same six fields. What the *local* parser handles without a network:

- **Amount** — `9.2`, `9`, `rm9.20`, `$20`, `12,50`; leading or trailing.
- **Currency** — a symbol or 3-letter code, accepted only if present in the user's active
  currency list. A single-currency user can never accidentally produce a foreign row.
- **Relative dates** — `today` / `yesterday` / weekday names; `今天` / `昨天` / `星期三`.
- **Income** — a keyword list (`salary`, `refund`, `bonus`, `工资`, `退款`, `奖金`) flips the
  type from the expense default.
- **Segments** — splits on `,` `;` newline and `，` `、`, capped at 10.
- **Label** — the remaining words, which become the merchant and the memory key.

Everything past that — `split the grab ride yesterday, my half was 12` — is what the LLM is
for.

**Confidence.** `parseQuickText` marks a segment confident when it found exactly one amount
and a non-empty label after stripping the amount and currency tokens. Two amounts in one
segment, or a segment that is nothing but a number, is not confident. This is the gate in §3:
an unconfident segment sends the whole input to the LLM even if every category resolved from
memory, because a wrong amount is worse than a wrong category.

**Foreign currency is honored on the single-item path only.** `ManualEntryScreen` handles it
fully: `CurrencyChip`, rate lookup, the `≈ RM` hint, and save gated on a cached rate.
`CategorizeScreen` hardcodes an `RM` prefix in six places — the amount editor, the duplicate
warning, the settlement prompt, and the split lines — so it is genuinely MYR-only in its UI
even though `commitCategorized` forwards `currency` and `fxRate` correctly. Rather than
silently mislabel a foreign row as ringgit, batch drafts are forced to base currency, and a
foreign currency detected on a multi-segment input is reported to the user in the field
rather than dropped in silence. Making those six sites currency-aware is a clean follow-up,
not part of this work.

## 5. Modules

New files, mirroring the `categoryGuessPrompt.ts` pattern already established for
`guessCategories` — a pure, dependency-free, unit-tested prompt builder and reply parser,
with the network call living in each provider.

| File | Purpose |
|---|---|
| `src/lib/quickParse.ts` | Pure offline parser. `parseQuickText(text, opts) → QuickDraft[]` |
| `src/llm/quickAddPrompt.ts` | `QUICK_ADD_SYSTEM_PROMPT`, `buildQuickAddPrompt(...)`, `parseQuickAddReply(...)`, `QuickAddParseError` |
| `src/components/QuickAddField.tsx` | Single-line input, submit affordance, busy and error states |

The two parse functions are deliberately named differently — `parseQuickText` versus
`parseQuickAddReply` — so a call site can never confuse the local parser with the reply
validator.

Modified files:

- `src/llm/types.ts` — `QuickAddInput`, and `quickAdd?` on `LLMProvider`
- `src/llm/fallback.ts` — `'quickAdd'` added to `Capability`, plus a passthrough method
- `src/llm/groq.ts`, `src/llm/openrouter.ts` — implement `quickAdd`
- `src/screens/AttachScreen.tsx` — render the field, new `onQuickAdd` prop, privacy caption
- `src/screens/AddFlow.tsx` — `'quickparse'` phase, handler, batch provenance
- `src/screens/ManualEntryScreen.tsx` — three new optional prefill props
- `src/i18n/types.ts`, `src/i18n/translations/en.ts`, `src/i18n/translations/zh.ts`

Gemini does not implement `quickAdd`, matching its existing omission of `guessCategories`.
`FallbackProvider.legsFor` already routes around a provider that lacks a capability, so this
needs no special handling — Groq is primary, OpenRouter is the fallback.

## 6. UI surface

`QuickAddField` sits on `AttachScreen` under Pip's speech bubble and above the Scan group,
making it the obvious default path in, with Scan and the full manual form as the deliberate
alternatives. It is its own component because `AttachScreen` is already 377 lines and this is
self-contained.

It is **always visible**, including when `hasKey` is false. The local parser works without a
key, so hiding it there would remove a working feature.

`AddFlow` gains a `'quickparse'` phase, reusing the `'guessing'` screen's shape with its own
copy, and a handler implementing §3:

- **1 draft** → store the prefill, `setPhase('manual')`
- **2+ drafts** → `setExtracted` / `setSuggestions` / `setLinkId(null)`, `setPhase('categorize')`
- **0 drafts** → report failure back to `AttachScreen`; stay on the hub with an inline hint

`ManualEntryScreen` gains `initialType`, `initialDate`, and `initialCategoryId`. All are
optional and default to current behavior, so the three existing callers are unaffected. The
mount effect that reads `getEntryCurrency()` is already guarded on `initialAmount == null`,
and a quick-add prefill always carries an amount, so `initialCurrency` wins without any
change to that logic.

**Batch provenance.** `AddFlow.onCategorized` hardcodes `commitCategorized(..., 'extracted', ...)`.
A quick-add batch was typed, not read off a screenshot, so it must save as `'manual'`. This
requires carrying the batch's provenance into the handler as state. Getting this wrong
mislabels typed rows as scanned, which corrupts the data-confidence weighting that `source`
exists to drive.

## 7. Error handling

Every failure is soft, and the user always lands somewhere useful — the local parser has
usually already captured the amount, which is the tedious part.

| Failure | Behavior |
|---|---|
| No API key, or offline | Local parse only. Known merchants still resolve from memory. |
| LLM timeout (12s) | Fall back to the local result. |
| Network, auth, or rate limit | Fall back to the local result. |
| Unparseable reply | `QuickAddParseError` → `LLMError('bad_response')` → local result. |
| No amount found, LLM unavailable | Stay on the hub, inline hint. Never open an empty form. |
| Empty or whitespace input | No-op. |

Failures degrade silently rather than raising alerts, matching the enhancement-only posture
of `guessCategories` in `AddFlow.onExtracted`.

`parseQuickAddReply` validates rather than trusts, following `parseCategoryGuess`. **It never
invents a category.** Specifically:

- A `categoryId` absent from the user's list, or whose `kind` contradicts the item's type,
  drops to `null`.
- A non-finite or non-positive amount drops the entire item.
- A currency outside the active list drops to base.
- An invalid or out-of-range date drops to today.
- More than 10 segments are truncated.
- A reply that is not a JSON array throws `QuickAddParseError`.

### Privacy

`AttachScreen`'s caption currently reads *"Manual entries stay on your device."* That becomes
false the moment typed text is sent to a provider on a local miss. It is rewritten in both
`en` and `zh` to state that quick-add text is sent to the chosen provider only when the app
cannot read it locally. This ships with the feature, not after it.

## 8. Testing

Test-first, matching how `categoryGuessPrompt` and the provider tests are already written.

**`__tests__/quickParse.test.ts`** — amount formats (`9.2`, `9`, `rm9.20`, `$20`, `12,50`,
leading and trailing); English and Chinese input; income keywords flipping type; relative
dates including `昨天` and weekday names; currency accepted only when active; multi-segment
splitting on `,` `;` newline `，` `、`; no-amount input yielding an empty array; the segment cap.

**`__tests__/quickAddPrompt.test.ts`** — a valid reply; unknown category id → `null`; kind
mismatch → `null`; negative and `NaN` amounts → item dropped; inactive currency → base;
malformed date → today; a fenced ` ```json ` reply parsed; non-JSON → `QuickAddParseError`.

**`__tests__/groq.test.ts`, `__tests__/openrouter.test.ts`** — mirror the existing
`guessCategories` cases, including a bad response surfacing as `LLMError('bad_response')`.

**`__tests__/fallback.test.ts`** — `can('quickAdd')` is false with no keys; Groq → OpenRouter
fall-through; Gemini skipped.

`__tests__/i18n.test.ts` already asserts key parity between `en` and `zh`, so every new
string must land in both or the suite fails.

## Open risks

- **Label quality drives the memory loop.** If the local parser produces inconsistent labels
  for the same input (`lunch` vs `Lunch 9.2`), `merchantKey` normalisation must absorb it or
  memory hits will be flaky. The parser must strip the amount and currency tokens from the
  label, not just the digits.
- **Prompt cost on the miss path.** The category list is sent on every LLM call. For a user
  with many custom categories this grows. Acceptable at v1 scale; worth watching.
- **The 10-segment cap is a guess.** It exists to stop a pasted paragraph from spawning a
  hundred drafts, not because 10 is meaningful.
