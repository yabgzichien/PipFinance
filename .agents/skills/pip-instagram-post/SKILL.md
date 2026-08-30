---
name: pip-instagram-post
description: |
  Create minimal, high-quality 4:5 Instagram carousel graphics (1080x1350) and humanized
  post copy for Pip Finance. Uses real in-app screenshots, vector Pip mascot assets,
  CairoSVG rendering, and authentic founder copywriting.
---

# Pip Instagram Post Creator Skill

This skill defines the complete end-to-end standard for designing, rendering, and copywriting Instagram carousel posts for Pip Finance.

---

## 1. Visual & Graphic Standards

### Aspect Ratio & Resolution
- **Standard**: **4:5 Portrait** (`1080 × 1350 px`) — always use this ratio for Instagram carousels.
- **Max Slide Count**: Keep carousels between **2 to 5 slides** (never exceed 7).

### Color Palette
- **Background Gradient**: `#F4FAF6` → `#EAF5EE` → `#DEF0E5` (soft mint luxury feel)
- **Top Glow**: `#FFD666` (38% opacity) + `#2AAB68` (10% opacity)
- **Primary Text / Dark Cards**: `#142B20` (Forest deep black)
- **Brand Green**: `#2AAB68` (Primary vibrant mint green), `#185E3E` (Deep forest accent)
- **Brand Gold / Yellow**: `#FAC438` (Pip mascot body), `#F5B42A` (Pip outer rim)
- **Light Cards**: `#FFFDF9` with `#E2EBE5` stroke

### Typography
- **Headlines**: `Space Grotesk` (700 Bold, 50-76px, letter-spacing `-1.5px` to `-2px`)
- **Body & Subtitles**: `Hanken Grotesk` (400 Regular, 500 Medium, 600 SemiBold, 700 Bold)
- Always embed fonts as Base64 in SVG `<defs>` from `node_modules/@expo-google-fonts/`.

---

## 2. Screenshot & Asset Rules

1. **100% Real Screenshots**:
   - Never generate synthetic data tables or fake vector mockups for app features.
   - Always embed real in-app screenshots provided or captured from Pip.
2. **Crop Out Phone Status & Navigation Bars**:
   - Always crop out the top status bar (time, 5G, Wi-Fi, battery, notification icons) and bottom Android navigation bar (`im.crop((0, 52, w, min(h, 995)))`).
   - Place screenshots inside rounded phone frame containers (`rx="30"` to `rx="36"`) with `preserveAspectRatio="xMidYMid meet"`.
3. **No Cluttered Green Pill Tags**:
   - Do NOT include green eyebrow pill tags above headings (e.g., avoid `<rect rx="21" fill="#E2F0E7" stroke="#2AAB68">`).
   - Keep headlines clean, open, and spacious.
4. **No Promotional Badges**:
   - Do NOT add "100% Free on Google Play" promotional tag strips inside the slide images. Keep slides focused on product value.

---

## 3. Pip Mascot Vector Spec

The Pip mascot can be embedded directly in SVG:
```xml
<!-- Pip Mascot (Scale & translate as needed) -->
<g transform="translate(X, Y) scale(S)">
  <g transform="translate(-50, -56)">
    <!-- Shadow -->
    <ellipse cx="50" cy="92" rx="22" ry="4.5" fill="rgba(20,43,32,0.18)"/>
    <!-- Leaves / Sprout -->
    <path d="M50 26 C50 18 50 13 50 11" stroke="#185e3e" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="41" cy="14" rx="8.5" ry="4.8" fill="#1c7a4e" transform="rotate(-32 41 14)"/>
    <ellipse cx="59" cy="12" rx="9.5" ry="5.2" fill="#2aab68" transform="rotate(28 59 12)"/>
    <!-- Gold Coin Body -->
    <circle cx="50" cy="56" r="34" fill="#F5B42A"/>
    <circle cx="50" cy="56" r="27.5" fill="#FAC438"/>
    <!-- Rosy Blush Cheeks -->
    <ellipse cx="31" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.45"/>
    <ellipse cx="69" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.45"/>
    <!-- Eyes -->
    <circle cx="40" cy="53.5" r="4.0" fill="#7A4800"/>
    <circle cx="41.5" cy="52" r="1.3" fill="#FFFFFF"/>
    <circle cx="60" cy="53.5" r="4.0" fill="#7A4800"/>
    <circle cx="61.5" cy="52" r="1.3" fill="#FFFFFF"/>
    <!-- Smile -->
    <path d="M39 63 Q50 75 61 63 Q50 69 39 63 Z" fill="#7A4800"/>
  </g>
</g>
```

*(For financial/accountant themes, replace eyes with stylish sunglasses).*

---

## 4. Post Copywriting Guidelines (Humanizer Voice)

When writing captions for Instagram:
1. **Target Audience**: Young Malaysian adults managing daily finances, investments, and commitments.
2. **Founder Tone**: Direct, honest, casual, and relatable.
3. **No AI Buzzwords**: Never use *delve*, *game-changer*, *seamless*, *empower*, *unlock*, *testament*, *elevate*, *groundbreaking*.
4. **No Em Dashes (`—`)**: Use colons, commas, parentheses, or separate sentences instead.
5. **Key Talking Points**:
   - Zero manual friction (OCR receipt & eWallet screenshot scanning).
   - 100% on-device local SQLite (no bank logins, no cloud tracking).
   - Itemized bill splitting with friends & IOU tracking.
   - Comprehensive asset, investment, and liability tracking.
   - Pro-grade financial export (Income Statement P&L, Balance Sheet SOFP, Excel .xlsx, Interactive HTML).

---

## 5. Rendering Pipeline (CairoSVG)

To render and preview posts:
1. Write or update a Python script under `tools/` using CairoSVG (`output_width=1080`, `output_height=1350`).
2. Run the script to output PNGs to `InstagramPost/`.
3. Copy generated PNGs to the active artifact directory.
4. Create/update a markdown artifact with the `carousel` syntax to present the live preview to the user.
