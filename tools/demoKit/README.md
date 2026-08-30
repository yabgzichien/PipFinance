# Demo & Test Statement Generator

This tool generates deterministic statement mockups (Touch 'n Go eWallet, Maybank MAE, Grab driver payouts, mixed expense statements) used to test Pip's AI extraction pipeline, merchant memory learning, and transaction deduplication.

---

## 1. Rebuilding Statement Mockups

To regenerate the HTML mockups with current timestamps:

```bash
npx tsx tools/demoKit/build.ts
```

This generates HTML template mockups in `tools/demoKit/templates/`. Rebuilding uses a committed deterministic seed and "today" as the base date so that extracted transactions fall within the active month.

---

## 2. Included Templates

| # | Template | Scenario Simulated | Notes |
|---|---|---|---|
| 1 | `kit-1-tng-ewallet.html` | Touch 'n Go eWallet history | Includes mixed daily purchases (Kedai Kopi Ah Seng, Tealive, groceries) |
| 2 | `kit-2-mae-bank.html` | Maybank2u / MAE transaction log | Shares "Kedai Kopi Ah Seng" with Kit 1 to verify merchant memory learning |
| 3 | `kit-3-grabfood-payout.html` | Grab delivery driver weekly payout | Income transaction extraction |
| 4 | `kit-4-mixed-month.html` | Generic multi-category banking log | Wide category distribution (utilities, fuel, food, shopping) |
| 5 | `kit-5-fabricated.html` | Round-number transfer history | Test edge-case round transactions |

---

## 3. Capturing Test Screenshots

To generate PNG images for automated or manual OCR tests:

1. Rebuild the templates: `npx tsx tools/demoKit/build.ts`.
2. Open any `tools/demoKit/templates/kit-*.html` file in a browser.
3. Set the browser devtools viewport to **390 × 844** (standard mobile phone resolution).
4. Take a screenshot of the phone card container and save to `tools/demoKit/out/` (e.g. `kit-1-tng-ewallet.png`).

---

## 4. In-App Smoke Testing

With `EXPO_PUBLIC_GROQ_API_KEY` or `EXPO_PUBLIC_GEMINI_API_KEY` configured:

1. Open Pip → tap **Add (+)** → **Scan / Attach**.
2. Select `kit-1-tng-ewallet.png` and confirm extraction of all line items. Categorize "Kedai Kopi Ah Seng" as **Food**.
3. Scan `kit-2-mae-bank.png` and observe Pip automatically pre-filling "Kedai Kopi Ah Seng" as **Food** via merchant memory.
