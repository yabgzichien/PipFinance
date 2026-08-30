#!/usr/bin/env python3
"""Render 100% REAL picture Instagram carousel post slides in 4:5 aspect ratio (1080x1350)
for Pip's Multi-Currency Support Feature.

Standards:
- 4:5 Portrait (1080x1350 px)
- 100% Real Screenshots (cropped clean of status/nav bars)
- No green eyebrow pill tags
- No promotional badges ("100% Free on Google Play")
- Soft mint gradient background (#F4FAF6 -> #EAF5EE -> #DEF0E5) + subtle top glow
- Fonts: Space Grotesk (Headlines) & Hanken Grotesk (Body) embedded as Base64
- Official vector Pip mascot
"""

import base64
import io
import shutil
from pathlib import Path
from PIL import Image
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "InstagramPost" / "MultiCurrency"
OUT_DIR.mkdir(parents=True, exist_ok=True)
FONTS_DIR = ROOT / "node_modules" / "@expo-google-fonts"
BRAIN_DIR = Path("/home/yang/.gemini/antigravity/brain/c7fb4a02-4cb5-48dd-ac60-2c779808e4eb")
USER_DIR = BRAIN_DIR / ".user_uploaded"

def get_font_base64(ttf_path: Path) -> str:
    if not ttf_path.exists():
        raise FileNotFoundError(f"Font file not found: {ttf_path}")
    return base64.b64encode(ttf_path.read_bytes()).decode("ascii")

def image_to_base64(im: Image.Image, format: str = "PNG") -> str:
    buf = io.BytesIO()
    im.save(buf, format=format)
    return base64.b64encode(buf.getvalue()).decode("ascii")

# Load fonts
font_space_700 = get_font_base64(FONTS_DIR / "space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf")
font_space_500 = get_font_base64(FONTS_DIR / "space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf")
font_hanken_800 = get_font_base64(FONTS_DIR / "hanken-grotesk/800ExtraBold/HankenGrotesk_800ExtraBold.ttf")
font_hanken_700 = get_font_base64(FONTS_DIR / "hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf")
font_hanken_600 = get_font_base64(FONTS_DIR / "hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf")
font_hanken_500 = get_font_base64(FONTS_DIR / "hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf")
font_hanken_400 = get_font_base64(FONTS_DIR / "hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf")

FONTS_CSS = f"""
@font-face {{
  font-family: 'SpaceGrotesk';
  src: url('data:font/truetype;base64,{font_space_700}') format('truetype');
  font-weight: 700;
  font-style: normal;
}}
@font-face {{
  font-family: 'SpaceGrotesk';
  src: url('data:font/truetype;base64,{font_space_500}') format('truetype');
  font-weight: 500;
  font-style: normal;
}}
@font-face {{
  font-family: 'Hanken';
  src: url('data:font/truetype;base64,{font_hanken_800}') format('truetype');
  font-weight: 800;
  font-style: normal;
}}
@font-face {{
  font-family: 'Hanken';
  src: url('data:font/truetype;base64,{font_hanken_700}') format('truetype');
  font-weight: 700;
  font-style: normal;
}}
@font-face {{
  font-family: 'Hanken';
  src: url('data:font/truetype;base64,{font_hanken_600}') format('truetype');
  font-weight: 600;
  font-style: normal;
}}
@font-face {{
  font-family: 'Hanken';
  src: url('data:font/truetype;base64,{font_hanken_500}') format('truetype');
  font-weight: 500;
  font-style: normal;
}}
@font-face {{
  font-family: 'Hanken';
  src: url('data:font/truetype;base64,{font_hanken_400}') format('truetype');
  font-weight: 400;
  font-style: normal;
}}
"""

def crop_phone_screenshot(path: Path, top_crop: int = 54) -> Image.Image:
    im = Image.open(path)
    w, h = im.size
    return im.crop((0, top_crop, w, h))

# Process real screenshots
im_currencies = crop_phone_screenshot(USER_DIR / "media_1787985315067.png", top_crop=54)
b64_currencies = image_to_base64(im_currencies, format="PNG")

im_add_foreign = crop_phone_screenshot(USER_DIR / "media_1787985365998.png", top_crop=54)
b64_add_foreign = image_to_base64(im_add_foreign, format="PNG")

im_breakdown = Image.open(USER_DIR / "media_1787985336518.png")
b64_breakdown = image_to_base64(im_breakdown, format="PNG")

im_cny_raw = Image.open(USER_DIR / "media_1787985282239.png")
im_cny_tight = im_cny_raw.crop((12, 26, 420, 248))
b64_cny_tight = image_to_base64(im_cny_tight, format="PNG")

def svg_defs() -> str:
    return f"""
  <defs>
    <style>
      {FONTS_CSS}
      .display-hero {{ font-family: 'SpaceGrotesk', sans-serif; font-weight: 700; }}
      .display-sub {{ font-family: 'SpaceGrotesk', sans-serif; font-weight: 500; }}
      .body-extra {{ font-family: 'Hanken', sans-serif; font-weight: 800; }}
      .body-bold {{ font-family: 'Hanken', sans-serif; font-weight: 700; }}
      .body-semi {{ font-family: 'Hanken', sans-serif; font-weight: 600; }}
      .body-med {{ font-family: 'Hanken', sans-serif; font-weight: 500; }}
      .body-reg {{ font-family: 'Hanken', sans-serif; font-weight: 400; }}
    </style>
    
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F4FAF6"/>
      <stop offset="50%" stop-color="#EAF5EE"/>
      <stop offset="100%" stop-color="#DEF0E5"/>
    </linearGradient>

    <radialGradient id="topGlow" cx="50%" cy="30%" r="55%">
      <stop offset="0%" stop-color="#FFD666" stop-opacity="0.38"/>
      <stop offset="60%" stop-color="#2AAB68" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#DEF0E5" stop-opacity="0"/>
    </radialGradient>

    <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#142B20" flood-opacity="0.10"/>
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#142B20" flood-opacity="0.05"/>
    </filter>

    <filter id="previewShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#142B20" flood-opacity="0.16"/>
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#142B20" flood-opacity="0.08"/>
    </filter>

    <filter id="floatingTagShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#142B20" flood-opacity="0.14"/>
    </filter>
  </defs>
"""

def generate_mascot_svg(x: float, y: float, scale: float = 1.0) -> str:
    return f"""
    <g transform="translate({x}, {y}) scale({scale})">
      <g transform="translate(-50, -56)">
        <ellipse cx="50" cy="92" rx="22" ry="4.5" fill="rgba(20,43,32,0.18)"/>
        <path d="M50 26 C50 18 50 13 50 11" stroke="#185e3e" stroke-width="3.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="41" cy="14" rx="8.5" ry="4.8" fill="#1c7a4e" transform="rotate(-32 41 14)"/>
        <ellipse cx="59" cy="12" rx="9.5" ry="5.2" fill="#2aab68" transform="rotate(28 59 12)"/>
        <circle cx="50" cy="56" r="34" fill="#F5B42A"/>
        <circle cx="50" cy="56" r="27.5" fill="#FAC438"/>
        <circle cx="50" cy="56" r="27.5" fill="none" stroke="#D99E18" stroke-width="2.6"/>
        <circle cx="50" cy="56" r="22.5" fill="none" stroke="#D99E18" stroke-width="1.2" stroke-dasharray="2 3.5"/>
        <ellipse cx="34" cy="41" rx="9" ry="5" fill="rgba(255,255,255,0.32)" transform="rotate(-28 34 41)"/>
        <ellipse cx="31" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.45"/>
        <ellipse cx="69" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.45"/>
        <g fill="#7A4800">
          <circle cx="40" cy="53.5" r="4.0"/>
          <circle cx="41.5" cy="52" r="1.3" fill="#FFFFFF"/>
          <circle cx="60" cy="53.5" r="4.0"/>
          <circle cx="61.5" cy="52" r="1.3" fill="#FFFFFF"/>
        </g>
        <path d="M39 63 Q50 75 61 63 Q50 69 39 63 Z" fill="#7A4800"/>
      </g>
    </g>
    """

def generate_slide_1_cover() -> str:
    """Slide 1 (1080x1350, 4:5): Multi-Currency Cover Showcase."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- Orbit Rings -->
  <g opacity="0.3">
    <circle cx="540" cy="675" r="420" stroke="#2AAB68" stroke-width="2" stroke-dasharray="12 16"/>
    <circle cx="540" cy="675" r="540" stroke="#FAC438" stroke-width="1.4" stroke-dasharray="8 20"/>
  </g>

  <!-- Sparkles -->
  <g fill="#FAC438">
    <path d="M140 140 Q140 156 124 156 Q140 156 140 172 Q140 156 156 156 Q140 156 140 140 Z" opacity="0.85"/>
    <path d="M940 150 Q940 166 924 166 Q940 166 940 182 Q940 166 956 166 Q940 166 940 150 Z" opacity="0.85"/>
  </g>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 140)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="60" fill="#142B20" letter-spacing="-1.5">Spend in Any Currency.</text>
    <text x="0" y="52" class="body-semi" font-size="23" fill="#475C50">
      Track overseas trips, dining, and global spending with live conversions.
    </text>
  </g>

  <!-- ================= REAL SCREENSHOTS FANNED SHOWCASE ================= -->
  <g transform="translate(540, 695)">
    <!-- Left card: Real Currencies Settings -->
    <g transform="translate(-340, -320) rotate(-7)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="340" height="660" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCoverCurr">
        <rect x="3" y="3" width="334" height="654" rx="25"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_currencies}" x="3" y="3" width="334" height="654" clip-path="url(#clipCoverCurr)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Right card: Real Add Foreign Expense -->
    <g transform="translate(0, -310) rotate(7)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="340" height="660" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCoverAdd">
        <rect x="3" y="3" width="334" height="654" rx="25"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_add_foreign}" x="3" y="3" width="334" height="654" clip-path="url(#clipCoverAdd)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Center card: Real Multi-Currency Monthly Breakdown -->
    <g transform="translate(-210, -290)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="420" height="630" rx="30" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipCoverBreakdown">
        <rect x="3" y="3" width="414" height="624" rx="27"/>
      </clipPath>
      <!-- Center card breakdown screenshot -->
      <image href="data:image/png;base64,{b64_breakdown}" x="3" y="3" width="414" height="412" clip-path="url(#clipCoverBreakdown)" preserveAspectRatio="xMidYMid slice"/>
      
      <!-- Mini CNY widget underneath in card -->
      <g transform="translate(3, 415)">
        <image href="data:image/png;base64,{b64_cny_tight}" x="0" y="0" width="414" height="205" clip-path="url(#clipCoverBreakdown)" preserveAspectRatio="xMidYMid slice"/>
      </g>
    </g>

    <!-- Floating Mini Pip Mascot -->
    {generate_mascot_svg(205, 175, scale=1.65)}
  </g>

  <!-- ================= BOTTOM FEATURE PILLS ================= -->
  <g transform="translate(540, 1220)" text-anchor="middle">
    <rect x="-460" y="-30" width="920" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-295" y="8" class="body-bold" font-size="17" fill="#FAC438">Live FX Rates</text>
    <text x="-160" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="-20" y="8" class="body-bold" font-size="17" fill="#FFFDF9">Multi-Currency Ledger</text>
    <text x="135" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="285" y="8" class="body-bold" font-size="17" fill="#FFFDF9">100% Local SQLite</text>
  </g>
</svg>
"""

def generate_slide_2_record_foreign() -> str:
    """Slide 2 (1080x1350, 4:5): Real Foreign Expense Recording with Live FX Rate."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Record in Any Currency.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Pick any foreign currency when paying. Pip converts to Ringgit live on screen.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP ================= -->
  <g transform="translate(540, 740)">
    <!-- Main Center Phone Frame -->
    <g transform="translate(-245, -480)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="490" height="940" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipAddPhone">
        <rect x="4" y="4" width="482" height="932" rx="32"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_add_foreign}" x="4" y="4" width="482" height="932" clip-path="url(#clipAddPhone)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Floating Callout Card for Live Conversion (Right Side) -->
    <g transform="translate(230, -320)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="280" height="80" rx="20" fill="#142B20" stroke="#2AAB68" stroke-width="2"/>
      <g transform="translate(16, 16)">
        <rect x="0" y="4" width="38" height="38" rx="12" fill="#2AAB68"/>
        <text x="19" y="28" text-anchor="middle" class="body-bold" font-size="14" fill="#FFF">FX</text>
        <text x="50" y="16" class="body-bold" font-size="15" fill="#FAC438">Live Conversion</text>
        <text x="50" y="38" class="body-med" font-size="14" fill="#FFFDF9">TND 78 = RM 109.06</text>
      </g>
    </g>

    <!-- Floating Callout Card for Split & Categories (Left Side) -->
    <g transform="translate(-510, 160)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="280" height="80" rx="20" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <g transform="translate(16, 16)">
        <rect x="0" y="4" width="38" height="38" rx="12" fill="#EAF7EE" stroke="#C5E3CE" stroke-width="1.5"/>
        <path d="M12 24 L17 29 L27 17" stroke="#2AAB68" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="50" y="16" class="body-bold" font-size="15" fill="#142B20">Split with Friends</text>
        <text x="50" y="38" class="body-med" font-size="13" fill="#586E61">Divide overseas tabs</text>
      </g>
    </g>
  </g>

  <!-- ================= BOTTOM FEATURE PILLS ================= -->
  <g transform="translate(540, 1230)" text-anchor="middle">
    <rect x="-460" y="-30" width="920" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-280" y="8" class="body-bold" font-size="16" fill="#FAC438">Real-Time FX Rates</text>
    <text x="-120" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="0" y="8" class="body-bold" font-size="16" fill="#FFFDF9">Itemized Bill Split</text>
    <text x="140" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="280" y="8" class="body-bold" font-size="16" fill="#FFFDF9">Multi-Category Tracking</text>
  </g>
</svg>
"""

def generate_slide_3_breakdown() -> str:
    """Slide 3 (1080x1350, 4:5): Dual Currency Breakdown & History."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Dual-Currency Breakdown.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      See your total monthly spend in Ringgit plus exact foreign amounts side-by-side.
    </text>
  </g>

  <!-- ================= HERO CARDS DISPLAY ================= -->
  <g transform="translate(540, 675)">
    <!-- Top Card: CNY Default Widget -->
    <g transform="translate(-250, -420)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="500" height="235" rx="26" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCnyCard">
        <rect x="4" y="4" width="492" height="227" rx="22"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_cny_tight}" x="4" y="4" width="492" height="227" clip-path="url(#clipCnyCard)" preserveAspectRatio="xMidYMid slice"/>
    </g>

    <!-- Main Card: Real Breakdown & Transactions List -->
    <g transform="translate(-260, -165)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="520" height="580" rx="30" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipBreakdownCard">
        <rect x="4" y="4" width="512" height="572" rx="26"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_breakdown}" x="4" y="4" width="512" height="572" clip-path="url(#clipBreakdownCard)" preserveAspectRatio="xMidYMid slice"/>
    </g>

    <!-- Floating Highlight Tag: RM + SGD Breakdown (Left Gap) -->
    <g transform="translate(-510, -200)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="280" height="80" rx="20" fill="#142B20" stroke="#FAC438" stroke-width="2"/>
      <g transform="translate(18, 18)">
        <text x="0" y="16" class="body-bold" font-size="15" fill="#FAC438">Breakdown Subtotal</text>
        <text x="0" y="38" class="body-med" font-size="14" fill="#FFFDF9">RM 33.00 • SGD 126.00</text>
      </g>
    </g>

    <!-- Floating Highlight Tag: Original Item Values (Right Bottom Gap) -->
    <g transform="translate(230, 250)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="280" height="80" rx="20" fill="#EAF7EE" stroke="#2AAB68" stroke-width="2"/>
      <g transform="translate(18, 18)">
        <text x="0" y="16" class="body-bold" font-size="15" fill="#185E3E">Original Amount Kept</text>
        <text x="0" y="38" class="body-med" font-size="13" fill="#2AAB68">Recorded in SGD with zero loss</text>
      </g>
    </g>
  </g>

  <!-- ================= BOTTOM FEATURE SUMMARY ================= -->
  <g transform="translate(540, 1230)" text-anchor="middle">
    <rect x="-460" y="-30" width="920" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-280" y="8" class="body-bold" font-size="16" fill="#FAC438">Combined Monthly Total</text>
    <text x="-120" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="0" y="8" class="body-bold" font-size="16" fill="#FFFDF9">Individual Currency Ledger</text>
    <text x="140" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="280" y="8" class="body-bold" font-size="16" fill="#FFFDF9">Zero Guesswork</text>
  </g>
</svg>
"""

def generate_slide_4_currencies_management() -> str:
    """Slide 4 (1080x1350, 4:5): Real Currencies Setting & Quick Switch."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Your Currencies, Your Choice.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Switch your default base currency in one tap and toggle active currencies as you travel.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP ================= -->
  <g transform="translate(540, 740)">
    <!-- Main Center Phone Frame -->
    <g transform="translate(-245, -480)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="490" height="940" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipCurrPhone">
        <rect x="4" y="4" width="482" height="932" rx="32"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_currencies}" x="4" y="4" width="482" height="932" clip-path="url(#clipCurrPhone)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Floating Annotation: Quick 1-Tap Base Switch (Right Side) -->
    <g transform="translate(230, -370)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="280" height="80" rx="20" fill="#142B20" stroke="#2AAB68" stroke-width="2"/>
      <g transform="translate(16, 16)">
        <rect x="0" y="4" width="38" height="38" rx="12" fill="#2AAB68"/>
        <text x="19" y="28" text-anchor="middle" class="body-bold" font-size="12" fill="#FFF">TAP</text>
        <text x="48" y="16" class="body-bold" font-size="15" fill="#FAC438">1-Tap Base Switch</text>
        <text x="48" y="38" class="body-med" font-size="13" fill="#FFFDF9">MYR • SGD • CNY • TND</text>
      </g>
    </g>

    <!-- Floating Annotation: Active Toggle Management (Left Side) -->
    <g transform="translate(-510, 100)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="280" height="80" rx="20" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <g transform="translate(16, 16)">
        <rect x="0" y="4" width="38" height="38" rx="12" fill="#EAF7EE" stroke="#C5E3CE" stroke-width="1.5"/>
        <path d="M12 24 L17 29 L27 17" stroke="#2AAB68" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="48" y="16" class="body-bold" font-size="15" fill="#142B20">Active Currency Toggles</text>
        <text x="48" y="38" class="body-med" font-size="13" fill="#586E61">Keep only what you need</text>
      </g>
    </g>
  </g>

  <!-- ================= BOTTOM FEATURE PILLS ================= -->
  <g transform="translate(540, 1230)" text-anchor="middle">
    <rect x="-460" y="-30" width="920" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="0" y="8" class="body-bold" font-size="17" fill="#FFFDF9">
      Dozens of global currencies supported with offline exchange rate caching
    </text>
  </g>
</svg>
"""

def generate_slide_5_recap() -> str:
    """Slide 5 (1080x1350, 4:5): Core Value Pillars & Mascot Recap."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- Accents -->
  <g opacity="0.3">
    <circle cx="540" cy="675" r="480" stroke="#2AAB68" stroke-width="1.8" stroke-dasharray="12 16"/>
  </g>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 140)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="58" fill="#142B20" letter-spacing="-1.5">Track Across Borders.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Everything you need to manage global spending without the clutter.
    </text>
  </g>

  <!-- ================= MAIN RECAP CARD ================= -->
  <g transform="translate(80, 240)" filter="url(#cardShadow)">
    <rect x="0" y="0" width="920" height="990" rx="36" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
    
    <g transform="translate(56, 56)">

      <!-- PILLAR 1: Real-time FX Rates -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="60" height="60" rx="18" fill="#EAF7EE" stroke="#C5E3CE" stroke-width="1.5"/>
        <text x="30" y="38" text-anchor="middle" class="body-bold" font-size="20" fill="#2AAB68">FX</text>
        <g transform="translate(80, 5)">
          <text x="0" y="20" class="display-hero" font-size="28" fill="#142B20">Live Exchange Rates</text>
          <text x="0" y="56" class="body-med" font-size="20" fill="#586E61">
            Automatic currency conversion calculated instantly so you always know
          </text>
          <text x="0" y="86" class="body-med" font-size="20" fill="#586E61">
            your true Ringgit expenditure.
          </text>
        </g>
      </g>

      <!-- Divider -->
      <line x1="0" y1="175" x2="808" y2="175" stroke="#EAEFEA" stroke-width="1.8"/>

      <!-- PILLAR 2: Dual-Currency Ledger -->
      <g transform="translate(0, 205)">
        <rect x="0" y="0" width="60" height="60" rx="18" fill="#FFF4D6" stroke="#F0DC9B" stroke-width="1.5"/>
        <text x="30" y="38" text-anchor="middle" class="body-bold" font-size="18" fill="#7A4800">SGD</text>
        <g transform="translate(80, 5)">
          <text x="0" y="20" class="display-hero" font-size="28" fill="#142B20">Dual-Currency Ledger</text>
          <text x="0" y="56" class="body-med" font-size="20" fill="#586E61">
            Keep the original amount in SGD, CNY, or USD while automatically
          </text>
          <text x="0" y="86" class="body-med" font-size="20" fill="#586E61">
            rolling up into your overall monthly total.
          </text>
        </g>
      </g>

      <!-- Divider -->
      <line x1="0" y1="380" x2="808" y2="380" stroke="#EAEFEA" stroke-width="1.8"/>

      <!-- PILLAR 3: 100% Local & Private -->
      <g transform="translate(0, 410)">
        <rect x="0" y="0" width="60" height="60" rx="18" fill="#E8F4FD" stroke="#BFE0F7" stroke-width="1.5"/>
        <g transform="translate(18, 16)">
          <rect x="2" y="10" width="20" height="15" rx="3" fill="#1B6CA8"/>
          <path d="M6 10 V6 A6 6 0 0 1 18 6 V10" stroke="#1B6CA8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <circle cx="12" cy="17.5" r="1.8" fill="#FFF"/>
        </g>
        <g transform="translate(80, 5)">
          <text x="0" y="20" class="display-hero" font-size="28" fill="#142B20">100% On-Device &amp; Private</text>
          <text x="0" y="56" class="body-med" font-size="20" fill="#586E61">
            All transaction history stays safely in your phone's SQLite database.
          </text>
          <text x="0" y="86" class="body-med" font-size="20" fill="#586E61">
            Zero bank logins, no cloud tracking.
          </text>
        </g>
      </g>

      <!-- Divider -->
      <line x1="0" y1="585" x2="808" y2="585" stroke="#EAEFEA" stroke-width="1.8"/>

      <!-- SECTION 4: Pip Mascot & Tagline -->
      <g transform="translate(404, 750)">
        {generate_mascot_svg(0, -70, scale=2.6)}
        
        <g transform="translate(0, 75)" text-anchor="middle">
          <text x="0" y="0" class="display-hero" font-size="34" fill="#142B20" letter-spacing="-0.5">Pip Finance</text>
          <text x="0" y="36" class="body-semi" font-size="20" fill="#7A8B80">Know your money across every border.</text>
        </g>
      </g>

    </g>
  </g>
</svg>
"""

def main():
    print("Rendering 4:5 (1080x1350) Instagram Post graphics for Multi-Currency Feature...")
    
    slides = [
        ("01_cover_multicurrency", generate_slide_1_cover()),
        ("02_record_foreign_currency", generate_slide_2_record_foreign()),
        ("03_dual_currency_breakdown", generate_slide_3_breakdown()),
        ("04_currency_management", generate_slide_4_currencies_management()),
        ("05_borderless_recap", generate_slide_5_recap()),
    ]
    
    # Also generate backwards-compatible 02_log_foreign_currency if needed
    for name, svg_code in slides:
        svg_path = OUT_DIR / f"{name}.svg"
        png_path = OUT_DIR / f"{name}.png"
        svg_path.write_text(svg_code, encoding="utf-8")
        
        cairosvg.svg2png(
            bytestring=svg_code.encode("utf-8"),
            write_to=str(png_path),
            output_width=1080,
            output_height=1350
        )
        print(f"✓ Generated 4:5 slide: {png_path.name}")
        
        # Copy to artifact dir for direct preview
        if BRAIN_DIR.exists():
            shutil.copy(png_path, BRAIN_DIR / f"{name}.png")

    # Also keep 02_log_foreign_currency.png in sync
    shutil.copy(OUT_DIR / "02_record_foreign_currency.png", OUT_DIR / "02_log_foreign_currency.png")
    shutil.copy(OUT_DIR / "02_record_foreign_currency.svg", OUT_DIR / "02_log_foreign_currency.svg")
    if BRAIN_DIR.exists():
        shutil.copy(OUT_DIR / "02_record_foreign_currency.png", BRAIN_DIR / "02_log_foreign_currency.png")

    print(f"\nAll slides successfully saved to {OUT_DIR} and copied to {BRAIN_DIR}")

if __name__ == "__main__":
    main()
