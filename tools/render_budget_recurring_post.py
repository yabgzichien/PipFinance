#!/usr/bin/env python3
"""Render 100% REAL picture Instagram carousel post slides in 4:5 aspect ratio (1080x1350)
for Pip's Budgeting and Recurring Bills feature.

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
OUT_DIR = ROOT / "InstagramPost" / "BudgetRecurring"
OUT_DIR.mkdir(parents=True, exist_ok=True)
FONTS_DIR = ROOT / "node_modules" / "@expo-google-fonts"
BRAIN_DIR = Path("/home/yang/.gemini/antigravity/brain/9b798208-a8c6-4853-a570-7f3002ce28db")
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

def crop_phone_screenshot(path: Path, top_crop: int = 52) -> Image.Image:
    im = Image.open(path)
    w, h = im.size
    return im.crop((0, top_crop, w, h))

# Process real screenshots
im_budget = crop_phone_screenshot(USER_DIR / "media_1787989928633.png", top_crop=54)
b64_budget = image_to_base64(im_budget, format="PNG")

im_recurring = crop_phone_screenshot(USER_DIR / "media_1787989906030.png", top_crop=50)
b64_recurring = image_to_base64(im_recurring, format="PNG")

im_home = crop_phone_screenshot(USER_DIR / "media_1787989911385.png", top_crop=50)
b64_home = image_to_base64(im_home, format="PNG")

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
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#142B20" flood-opacity="0.14"/>
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
    """Slide 1 (1080x1350, 4:5): Budgeting & Recurring Bills Cover Showcase."""
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
    <text x="0" y="0" class="display-hero" font-size="58" fill="#142B20" letter-spacing="-1.5">Set Budgets. Never Miss Bills.</text>
    <text x="0" y="52" class="body-semi" font-size="23" fill="#475C50">
      Allocate your income, track recurring commitments, and master cash flow.
    </text>
  </g>

  <!-- ================= REAL SCREENSHOTS FANNED SHOWCASE ================= -->
  <g transform="translate(540, 695)">
    <!-- Left card: Real Budget Setup (Tilted -8deg) -->
    <g transform="translate(-340, -320) rotate(-8)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="340" height="660" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCoverBudget">
        <rect x="3" y="3" width="334" height="654" rx="25"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_budget}" x="3" y="3" width="334" height="654" clip-path="url(#clipCoverBudget)" preserveAspectRatio="xMidYMid slice"/>
    </g>

    <!-- Right card: Real Recurring Screen (Tilted +8deg) -->
    <g transform="translate(0, -310) rotate(8)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="340" height="660" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCoverRecurring">
        <rect x="3" y="3" width="334" height="654" rx="25"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_recurring}" x="3" y="3" width="334" height="654" clip-path="url(#clipCoverRecurring)" preserveAspectRatio="xMidYMid slice"/>
    </g>

    <!-- Center card: Real Home Screen (Left to spend & Budget bars) -->
    <g transform="translate(-195, -340)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="390" height="690" rx="30" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipCoverHome">
        <rect x="3" y="3" width="384" height="684" rx="27"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_home}" x="3" y="3" width="384" height="684" clip-path="url(#clipCoverHome)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Floating Mini Pip Mascot -->
    {generate_mascot_svg(200, 160, scale=1.65)}
  </g>

  <!-- ================= BOTTOM FEATURE PILLS ================= -->
  <g transform="translate(540, 1220)" text-anchor="middle">
    <rect x="-460" y="-30" width="920" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-295" y="8" class="body-bold" font-size="17" fill="#FAC438">Income Allocation</text>
    <text x="-160" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="-15" y="8" class="body-bold" font-size="17" fill="#FFFDF9">Overdue Alerts</text>
    <text x="135" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="285" y="8" class="body-bold" font-size="17" fill="#FFFDF9">Left-to-Spend</text>
  </g>
</svg>
"""

def generate_slide_2_budget() -> str:
    """Slide 2 (1080x1350, 4:5): Real Budget Setup with Income and History Auto-Fill."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Budget Against Real Income.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Set limits by category or auto-fill instantly from your past spending.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP ================= -->
  <g transform="translate(540, 740)">
    <!-- Main Center Phone Frame -->
    <g transform="translate(-245, -480)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="490" height="940" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipBudgetPhone">
        <rect x="4" y="4" width="482" height="932" rx="32"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_budget}" x="4" y="4" width="482" height="932" clip-path="url(#clipBudgetPhone)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Floating Callout Card 1: Auto-Fill History (Right Side - Top) -->
    <g transform="translate(150, -390)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="320" height="92" rx="22" fill="#142B20" stroke="#2AAB68" stroke-width="2"/>
      <g transform="translate(18, 22)">
        <rect x="0" y="3" width="42" height="42" rx="12" fill="#2AAB68"/>
        <!-- Magic Sparkle icon -->
        <path d="M21 11 L23 18 L30 20 L23 22 L21 29 L19 22 L12 20 L19 18 Z" fill="#FAC438"/>
        <circle cx="28" cy="13" r="2" fill="#FFF"/>
        <text x="54" y="19" class="body-bold" font-size="16.5" fill="#FAC438">Auto-Fill History</text>
        <text x="54" y="41" class="body-med" font-size="13.5" fill="#DEF0E5">One-tap budget setup</text>
      </g>
    </g>

    <!-- Floating Callout Card 2: Live Remainder (Left Side - Bottom) -->
    <g transform="translate(-470, 300)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="320" height="92" rx="22" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <g transform="translate(18, 22)">
        <rect x="0" y="3" width="42" height="42" rx="12" fill="#EAF7EE"/>
        <!-- Wallet / Coin icon -->
        <rect x="10" y="14" width="22" height="18" rx="4" fill="none" stroke="#2AAB68" stroke-width="2.5"/>
        <path d="M24 23 A2.5 2.5 0 1 1 24 23.01" stroke="#2AAB68" stroke-width="2.5" stroke-linecap="round"/>
        <text x="54" y="19" class="body-bold" font-size="16.5" fill="#142B20">RM 870.00 Left</text>
        <text x="54" y="41" class="body-med" font-size="13.5" fill="#475C50">Live unallocated cash flow</text>
      </g>
    </g>
  </g>
</svg>
"""

def generate_slide_3_recurring() -> str:
    """Slide 3 (1080x1350, 4:5): Real Recurring Bills, Commitments & Overdue Alerts."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Stay Ahead of Due Dates.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Track rent, insurance, and monthly investments in one clear schedule.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP ================= -->
  <g transform="translate(540, 740)">
    <!-- Main Center Phone Frame -->
    <g transform="translate(-245, -480)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="490" height="940" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipRecurringPhone">
        <rect x="4" y="4" width="482" height="932" rx="32"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_recurring}" x="4" y="4" width="482" height="932" clip-path="url(#clipRecurringPhone)" preserveAspectRatio="xMidYMid meet"/>
      
      <!-- Subtle internal bottom card badge for monthly peace of mind -->
      <g transform="translate(26, 670)">
        <rect x="0" y="0" width="438" height="190" rx="26" fill="#F0F8F3" stroke="#D3E7DC" stroke-width="1.5"/>
        <g transform="translate(24, 30)">
          <rect x="0" y="0" width="48" height="48" rx="14" fill="#2AAB68"/>
          <!-- Calendar check icon -->
          <path d="M16 24 L22 30 L32 18" fill="none" stroke="#FFFDF9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="62" y="22" class="body-bold" font-size="18" fill="#142B20">Zero Missed Deadlines</text>
          <text x="62" y="45" class="body-med" font-size="14.5" fill="#475C50">Auto-rolled into every new month</text>
          <text x="4" y="88" class="body-med" font-size="13.5" fill="#5A7565">Check off bills as you pay. Unpaid items flag overdue on Home.</text>
        </g>
      </g>
    </g>

    <!-- Floating Callout Card 1: Overdue Alerts (Right Side) -->
    <g transform="translate(150, -390)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="320" height="92" rx="22" fill="#142B20" stroke="#FF6B6B" stroke-width="2"/>
      <g transform="translate(18, 22)">
        <rect x="0" y="3" width="42" height="42" rx="12" fill="rgba(255, 107, 107, 0.25)"/>
        <!-- Warning Bell icon -->
        <path d="M21 11 C17 11 14 14 14 18 V24 L11 27 H31 L28 24 V18 C28 14 25 11 21 11 Z" fill="none" stroke="#FF8E8E" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M19 28 C19 29.5 20 31 21 31 C22 31 23 29.5 23 28" fill="none" stroke="#FF8E8E" stroke-width="2.4"/>
        <text x="54" y="19" class="body-bold" font-size="16.5" fill="#FF8E8E">Overdue Warnings</text>
        <text x="54" y="41" class="body-med" font-size="13.5" fill="#DEF0E5">Catch unpaid bills fast</text>
      </g>
    </g>

    <!-- Floating Callout Card 2: DCA & Commitments (Left Side) -->
    <g transform="translate(-470, 80)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="320" height="92" rx="22" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <g transform="translate(18, 22)">
        <rect x="0" y="3" width="42" height="42" rx="12" fill="#EAF7EE"/>
        <path d="M12 28 L19 20 L24 24 L30 14" fill="none" stroke="#2AAB68" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="30" cy="14" r="2.5" fill="#2AAB68"/>
        <text x="54" y="19" class="body-bold" font-size="16.5" fill="#142B20">DCA &amp; Commitments</text>
        <text x="54" y="41" class="body-med" font-size="13.5" fill="#475C50">Track S&amp;P 500 &amp; rent</text>
      </g>
    </g>
  </g>
</svg>
"""

def generate_slide_4_home() -> str:
    """Slide 4 (1080x1350, 4:5): Real-Time Left-to-Spend & Budget Progress Bars."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Always Know Your Leftover Cash.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Your dashboard factors in active budgets and overdue bills automatically.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP ================= -->
  <g transform="translate(540, 740)">
    <!-- Main Center Phone Frame -->
    <g transform="translate(-245, -480)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="490" height="940" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipHomePhone">
        <rect x="4" y="4" width="482" height="932" rx="32"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_home}" x="4" y="4" width="482" height="932" clip-path="url(#clipHomePhone)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Floating Callout Card 1: Left to Spend (Right Side) -->
    <g transform="translate(150, -390)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="320" height="92" rx="22" fill="#142B20" stroke="#FAC438" stroke-width="2"/>
      <g transform="translate(18, 22)">
        <rect x="0" y="3" width="42" height="42" rx="12" fill="#FAC438"/>
        <!-- Ringgit / Coin icon -->
        <text x="21" y="28" text-anchor="middle" class="body-extra" font-size="16" fill="#142B20">RM</text>
        <text x="54" y="19" class="body-bold" font-size="16.5" fill="#FAC438">Left to Spend</text>
        <text x="54" y="41" class="body-med" font-size="13.5" fill="#FFFDF9">RM 1,488.60 (3 days left)</text>
      </g>
    </g>

    <!-- Floating Callout Card 2: Visual Meters (Left Side) -->
    <g transform="translate(-470, 180)" filter="url(#floatingTagShadow)" text-anchor="start">
      <rect x="0" y="0" width="320" height="92" rx="22" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <g transform="translate(18, 22)">
        <rect x="0" y="3" width="42" height="42" rx="12" fill="#EAF7EE"/>
        <!-- Progress bar icon -->
        <line x1="10" y1="18" x2="32" y2="18" stroke="#E2EBE5" stroke-width="4" stroke-linecap="round"/>
        <line x1="10" y1="18" x2="25" y2="18" stroke="#2AAB68" stroke-width="4" stroke-linecap="round"/>
        <line x1="10" y1="28" x2="32" y2="28" stroke="#E2EBE5" stroke-width="4" stroke-linecap="round"/>
        <line x1="10" y1="28" x2="28" y2="28" stroke="#F07828" stroke-width="4" stroke-linecap="round"/>
        <text x="54" y="19" class="body-bold" font-size="16.5" fill="#142B20">Category Progress</text>
        <text x="54" y="41" class="body-med" font-size="13.5" fill="#475C50">Visual pacing per budget</text>
      </g>
    </g>
  </g>
</svg>
"""

def generate_slide_5_recap() -> str:
    """Slide 5 (1080x1350, 4:5): Summary Recap."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- Orbit Rings -->
  <g opacity="0.3">
    <circle cx="540" cy="675" r="420" stroke="#2AAB68" stroke-width="2" stroke-dasharray="12 16"/>
  </g>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 160)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="64" fill="#142B20" letter-spacing="-1.5">Simple. Private. In Control.</text>
    <text x="0" y="54" class="body-semi" font-size="24" fill="#475C50">
      Master your monthly cash flow without spreadsheet stress.
    </text>
  </g>

  <!-- ================= 3 FEATURE CARDS ================= -->
  <g transform="translate(100, 310)">
    <!-- Card 1: Budget Setup -->
    <g transform="translate(0, 0)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="230" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="115" r="40" fill="#EAF7EE"/>
      <path d="M62 105 H98 M62 115 H98 M62 125 H98" stroke="#2AAB68" stroke-width="3" stroke-linecap="round"/>
      <circle cx="74" cy="105" r="5" fill="#2AAB68"/>
      <circle cx="86" cy="115" r="5" fill="#2AAB68"/>
      <circle cx="68" cy="125" r="5" fill="#2AAB68"/>
      
      <text x="145" y="80" class="display-hero" font-size="28" fill="#142B20">1. Income Allocation &amp; History Auto-Fill</text>
      <text x="145" y="125" class="body-med" font-size="20" fill="#475C50">Set flexible monthly limits per category with one tap.</text>
      <text x="145" y="158" class="body-med" font-size="20" fill="#475C50">Pip auto-fills targets based on what you actually spent in previous months.</text>
    </g>

    <!-- Card 2: Recurring Bills -->
    <g transform="translate(0, 270)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="230" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="115" r="40" fill="#FFF4D6"/>
      <rect x="62" y="98" width="36" height="34" rx="6" fill="none" stroke="#FAC438" stroke-width="3.2"/>
      <line x1="62" y1="108" x2="98" y2="108" stroke="#FAC438" stroke-width="2.5"/>
      <circle cx="71" cy="118" r="2.5" fill="#7A4800"/>
      <circle cx="80" cy="118" r="2.5" fill="#7A4800"/>
      <circle cx="89" cy="118" r="2.5" fill="#7A4800"/>

      <text x="145" y="80" class="display-hero" font-size="28" fill="#142B20">2. Fixed Commitments &amp; Overdue Alerts</text>
      <text x="145" y="125" class="body-med" font-size="20" fill="#475C50">Lock in rent, insurance premiums, utilities, and monthly DCA.</text>
      <text x="145" y="158" class="body-med" font-size="20" fill="#475C50">Get visual reminders on your dashboard so you never miss a due date.</text>
    </g>

    <!-- Card 3: Left to Spend -->
    <g transform="translate(0, 540)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="230" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="115" r="40" fill="#EAF7EE"/>
      <circle cx="80" cy="115" r="20" fill="none" stroke="#2AAB68" stroke-width="6"/>
      <line x1="80" y1="115" x2="92" y2="105" stroke="#FAC438" stroke-width="3.5" stroke-linecap="round"/>

      <text x="145" y="80" class="display-hero" font-size="28" fill="#142B20">3. Live "Left to Spend" Pacing</text>
      <text x="145" y="125" class="body-med" font-size="20" fill="#475C50">Always know how much cash is safe to spend for the remaining days.</text>
      <text x="145" y="158" class="body-med" font-size="20" fill="#475C50">Visual progress meters turn orange to flag overspending early.</text>
    </g>
  </g>

  <!-- Bottom Mascot -->
  {generate_mascot_svg(540, 1190, scale=1.75)}
</svg>
"""

def main():
    print("Rendering 100% REAL picture Instagram Carousel for Budgeting & Recurring Bills in 4:5...")
    
    slides = [
        ("01_cover_budget_recurring", generate_slide_1_cover()),
        ("02_setup_category_budgets", generate_slide_2_budget()),
        ("03_recurring_commitments", generate_slide_3_recurring()),
        ("04_safe_left_to_spend", generate_slide_4_home()),
        ("05_budget_recurring_recap", generate_slide_5_recap()),
    ]
    
    for name, svg_content in slides:
        svg_path = OUT_DIR / f"{name}.svg"
        png_path = OUT_DIR / f"{name}.png"
        
        svg_path.write_text(svg_content, encoding="utf-8")
        cairosvg.svg2png(
            bytestring=svg_content.encode("utf-8"),
            write_to=str(png_path),
            output_width=1080,
            output_height=1350
        )
        print(f"✓ Generated 4:5 slide: {png_path.name}")
        
        if BRAIN_DIR.exists():
            shutil.copy(png_path, BRAIN_DIR / f"{name}.png")

    print(f"\nAll {len(slides)} slides rendered in {OUT_DIR}/ and copied to {BRAIN_DIR}/")

if __name__ == "__main__":
    main()
