# Pip: Promo Video Storyboard & Production Guide

Generated for the Google Play Store promo video and marketing reels.

---

## 1. Video Overview

- **Video Path:** `tools/promoVideo/out/pip_promo_video.mp4`
- **Interactive Preview:** `tools/promoVideo/preview.html`
- **Renderer Script:** `tools/promoVideo/render_promo.py`
- **Resolution:** 1080 × 1920 (9:16 Vertical Video)
- **Duration:** 18.0 seconds @ 30 FPS
- **Audio Mix:** Synced sound effects (UI tap, camera shutter, OCR scan hum, `saved.wav` celebration chime, accent ding).

---

## 2. Scene-by-Scene Breakdown

| Scene | Time | Headline / Copy | Visual Action & App State | Audio SFX |
|---|---|---|---|---|
| **Scene 1: Introduction** | 0.0s – 3.2s | **Know your money.**<br>*Zero typing. Private on-device tracking with AI.* | Starts with the **actual Home Screen** of Pip (`01_home_dashboard.jpg`), showing greeting, net worth balance, budget progress ring, and recent transactions. A natural pointer cursor glides toward the bottom navigation bar. | Ambient UI swoosh |
| **Scene 2: Tap Add Button** | 3.2s – 5.0s | **Zero manual typing.**<br>*Just tap Add to scan any receipt or e-wallet.* | The pointer reaches the center raised `+` Add button on the bottom nav bar. Cursor taps down with a tactile button compression and emerald ripple wave. | Crisp UI tap click |
| **Scene 3: Snap Transaction History** | 5.0s – 8.2s | **Snap transaction history.**<br>*Works with Touch 'n Go, Grab, MAE, banks & receipts.* | Camera viewfinder overlay locks onto a real Touch 'n Go eWallet statement (`kit1-tng.png`). Pulsing optical brackets detect the document. Cursor taps the shutter button; screen flashes white with photographic snap effect. | Shutter click & mechanical snap |
| **Scene 4: Instant AI OCR Extraction** | 8.2s – 11.6s | **Snap it. Pip reads it.**<br>*Extracts all transactions in seconds with on-device AI.* | The capture screen loads. An illuminated emerald laser scanline sweeps down the statement. Holographic bounding boxes lock onto each transaction row; counter displays `✓ 6 transactions identified (1.1s)`. | High-tech laser scanning hum |
| **Scene 5: Auto-Categorization & Save** | 11.6s – 14.8s | **Categorized & recorded.**<br>*Pip learns your merchants and updates your budget.* | Line items appear categorized with badges (Groceries, Food, Transfer). User taps Save. Golden star particles explode across the screen with a `✓ Saved to Live Ledger!` banner. | `saved.wav` celebration chime |
| **Scene 6: Returned to Live Ledger** | 14.8s – 18.0s | **Everything in one place.**<br>*100% on-device & private. Available on Google Play.* | Smooth transition back to the **actual Home Screen**. Top of Recent Activity now features the newly recorded transactions with a glowing `✦ JUST ADDED` badge. Total balance and budget ring update live. | Melodic accent ding |

---

## 3. How to Run / Re-render

To re-render or customize copy, timing, or colors:

```bash
# Run the video renderer
python3 tools/promoVideo/render_promo.py
```

To preview the video in a web browser:
```bash
# Open preview.html in Chrome / Chromium
xdg-open tools/promoVideo/preview.html
```
