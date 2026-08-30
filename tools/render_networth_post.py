#!/usr/bin/env python3
"""Render Instagram carousel post slides in 4:5 (1080x1350) for Pip's Net Worth feature.

- 4 slides: cover, net worth overview, investment tracking, recap
- Real screenshots with status/nav bars cropped
- No green eyebrow pill tags, no promotional badges
"""

import base64
import io
import shutil
from pathlib import Path
from PIL import Image
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "InstagramPost" / "NetWorth"
OUT_DIR.mkdir(parents=True, exist_ok=True)
FONTS_DIR = ROOT / "node_modules" / "@expo-google-fonts"
BRAIN_DIR = Path("/home/yang/.gemini/antigravity/brain/a4131946-58c1-43cb-ae6d-56a3fa99054b")
USER_DIR = BRAIN_DIR / ".user_uploaded"


def get_font_base64(ttf_path: Path) -> str:
    if not ttf_path.exists():
        raise FileNotFoundError(f"Font file not found: {ttf_path}")
    return base64.b64encode(ttf_path.read_bytes()).decode("ascii")


def image_to_base64(im: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    im.save(buf, format=fmt)
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


def crop_phone_screenshot(path: Path) -> Image.Image:
    """Crop out phone status bar and navigation bar."""
    im = Image.open(path)
    w, h = im.size
    # Crop top status bar (~52px) and bottom nav bar
    return im.crop((0, 52, w, min(h, h - 55)))


# Load and crop the two net worth screenshots
im_networth_overview = crop_phone_screenshot(USER_DIR / "media_1787991318752.png")
b64_networth_overview = image_to_base64(im_networth_overview, fmt="PNG")

im_networth_invest = crop_phone_screenshot(USER_DIR / "media_1787991357593.jpg")
b64_networth_invest = image_to_base64(im_networth_invest, fmt="JPEG")


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
  </defs>
"""


def pip_mascot_sunglasses(x: int, y: int, scale: float = 1.65) -> str:
    """Pip mascot with sunglasses (financial/accountant theme)."""
    return f"""
    <g transform="translate({x}, {y}) scale({scale})" filter="url(#cardShadow)">
      <g transform="translate(-50, -56)">
        <ellipse cx="50" cy="92" rx="22" ry="4.5" fill="rgba(20,43,32,0.2)"/>
        <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3" fill="none" stroke-linecap="round"/>
        <ellipse cx="42" cy="15" rx="7.5" ry="4.2" fill="#1c7a4e" transform="rotate(-32 42 15)"/>
        <ellipse cx="58" cy="13" rx="8.5" ry="4.6" fill="#2aab68" transform="rotate(28 58 13)"/>
        <circle cx="50" cy="56" r="33" fill="#F5B42A"/>
        <circle cx="50" cy="56" r="26.6" fill="#FAC438"/>
        <ellipse cx="31" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.4"/>
        <ellipse cx="69" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.4"/>
        <!-- Sunglasses -->
        <rect x="28" y="48" width="17" height="12" rx="3" fill="#142B20"/>
        <rect x="55" y="48" width="17" height="12" rx="3" fill="#142B20"/>
        <line x1="45" y1="53" x2="55" y2="53" stroke="#142B20" stroke-width="2.5"/>
        <line x1="28" y1="53" x2="22" y2="50" stroke="#142B20" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="72" y1="53" x2="78" y2="50" stroke="#142B20" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Glare on lenses -->
        <rect x="30" y="49.5" width="4" height="2" rx="1" fill="rgba(255,255,255,0.35)"/>
        <rect x="57" y="49.5" width="4" height="2" rx="1" fill="rgba(255,255,255,0.35)"/>
        <!-- Smile -->
        <path d="M39 63 Q50 75 61 63 Q50 69 39 63 Z" fill="#7A4800"/>
      </g>
    </g>
"""


def generate_slide_1_cover() -> str:
    """Slide 1: Cover with both screenshots fanned and headline."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- Orbit Rings -->
  <g opacity="0.3">
    <circle cx="540" cy="700" r="420" stroke="#2AAB68" stroke-width="2" stroke-dasharray="12 16"/>
    <circle cx="540" cy="700" r="540" stroke="#FAC438" stroke-width="1.4" stroke-dasharray="8 20"/>
  </g>

  <!-- Sparkles -->
  <g fill="#FAC438">
    <path d="M140 140 Q140 156 124 156 Q140 156 140 172 Q140 156 156 156 Q140 156 140 140 Z" opacity="0.85"/>
    <path d="M940 150 Q940 166 924 166 Q940 166 940 182 Q940 166 956 166 Q940 166 940 150 Z" opacity="0.85"/>
    <path d="M870 1100 Q870 1116 854 1116 Q870 1116 870 1132 Q870 1116 886 1116 Q870 1116 870 1100 Z" opacity="0.6"/>
  </g>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 145)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="58" fill="#142B20" letter-spacing="-1.5">See Your Full Picture.</text>
    <text x="0" y="52" class="body-semi" font-size="23" fill="#475C50">
      Cash, banks, investments, and liabilities in one place.
    </text>
  </g>

  <!-- ================= FANNED SCREENSHOTS ================= -->
  <g transform="translate(540, 740)">
    <!-- Left card: Net Worth Overview -->
    <g transform="translate(-310, -330) rotate(-7)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="350" height="660" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCoverLeft">
        <rect x="3" y="3" width="344" height="654" rx="27"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_networth_overview}" x="3" y="3" width="344" height="654" clip-path="url(#clipCoverLeft)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Center-right card: Investment Tracking (on top) -->
    <g transform="translate(-185, -350)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="370" height="700" rx="32" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipCoverRight">
        <rect x="3" y="3" width="364" height="694" rx="29"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_networth_invest}" x="3" y="3" width="364" height="694" clip-path="url(#clipCoverRight)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Pip Mascot with sunglasses -->
    {pip_mascot_sunglasses(230, 200, 1.5)}
  </g>

  <!-- ================= BOTTOM FEATURE PILLS ================= -->
  <g transform="translate(540, 1220)" text-anchor="middle">
    <rect x="-460" y="-30" width="920" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-280" y="8" class="body-bold" font-size="17" fill="#FAC438">Net Worth Tracking</text>
    <text x="-120" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="-10" y="8" class="body-bold" font-size="17" fill="#FFFDF9">Live Prices</text>
    <text x="90" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="260" y="8" class="body-bold" font-size="17" fill="#FFFDF9">Assets &amp; Liabilities</text>
  </g>
</svg>
"""


def generate_slide_2_overview() -> str:
    """Slide 2: Net Worth overview screenshot with chart and totals."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Your Net Worth, at a Glance.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Track total assets vs liabilities with a 6-month trend chart.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP ================= -->
  <g transform="translate(540, 775)" text-anchor="middle">
    <g transform="translate(-240, -495)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="480" height="990" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipOverviewPhone">
        <rect x="4" y="4" width="472" height="982" rx="32"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_networth_overview}" x="4" y="4" width="472" height="982" clip-path="url(#clipOverviewPhone)" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>
"""


def generate_slide_3_investments() -> str:
    """Slide 3: Investment tracking with live prices screenshot."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Track Every Investment.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Bitcoin, stocks, ETH, gold: live prices and profit/loss in real time.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP ================= -->
  <g transform="translate(540, 775)" text-anchor="middle">
    <g transform="translate(-240, -495)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="480" height="990" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipInvestPhone">
        <rect x="4" y="4" width="472" height="982" rx="32"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_networth_invest}" x="4" y="4" width="472" height="982" clip-path="url(#clipInvestPhone)" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>
"""


def generate_slide_4_recap() -> str:
    """Slide 4: Summary/recap slide with feature cards and Pip mascot."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- Orbit Ring -->
  <g opacity="0.3">
    <circle cx="540" cy="675" r="420" stroke="#2AAB68" stroke-width="2" stroke-dasharray="12 16"/>
  </g>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 160)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="64" fill="#142B20" letter-spacing="-1.5">Know Your Worth.</text>
    <text x="0" y="54" class="body-semi" font-size="24" fill="#475C50">
      Everything tracked locally on your phone. No bank logins needed.
    </text>
  </g>

  <!-- ================= 3 FEATURE CARDS ================= -->
  <g transform="translate(100, 310)">
    <!-- Card 1: Net Worth Overview -->
    <g transform="translate(0, 0)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="210" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="105" r="40" fill="#EAF7EE"/>
      <!-- Chart Icon -->
      <path d="M60 125 L60 95 L72 105 L84 85 L96 95 L96 125 Z" fill="none" stroke="#2AAB68" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="60" cy="92" r="3" fill="#2AAB68"/>
      <circle cx="96" cy="92" r="3" fill="#2AAB68"/>

      <text x="145" y="72" class="display-hero" font-size="28" fill="#142B20">Total Net Worth at a Glance</text>
      <text x="145" y="112" class="body-med" font-size="20" fill="#475C50">See your total assets minus liabilities with a clean</text>
      <text x="145" y="142" class="body-med" font-size="20" fill="#475C50">6-month trend chart that updates as you add entries.</text>
    </g>

    <!-- Card 2: Investment Tracking -->
    <g transform="translate(0, 250)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="210" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="105" r="40" fill="#FFF4D6"/>
      <!-- Bitcoin/Coin Icon -->
      <circle cx="80" cy="105" r="18" fill="none" stroke="#FAC438" stroke-width="3.2"/>
      <text x="80" y="113" font-family="SpaceGrotesk, sans-serif" font-weight="700" font-size="22" fill="#FAC438" text-anchor="middle">&#x0e3f;</text>

      <text x="145" y="72" class="display-hero" font-size="28" fill="#142B20">Live Investment Prices</text>
      <text x="145" y="112" class="body-med" font-size="20" fill="#475C50">Bitcoin, ETH, stocks, and gold with real-time prices.</text>
      <text x="145" y="142" class="body-med" font-size="20" fill="#475C50">See profit/loss and percentage changes at a glance.</text>
    </g>

    <!-- Card 3: Privacy First -->
    <g transform="translate(0, 500)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="210" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="105" r="40" fill="#EAF7EE"/>
      <!-- Lock Icon -->
      <rect x="68" y="102" width="24" height="18" rx="4" fill="none" stroke="#185E3E" stroke-width="3.2"/>
      <path d="M74 102 V94 C74 88 86 88 86 94 V102" fill="none" stroke="#185E3E" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="80" cy="112" r="2.5" fill="#185E3E"/>

      <text x="145" y="72" class="display-hero" font-size="28" fill="#142B20">100% On-Device, 100% Private</text>
      <text x="145" y="112" class="body-med" font-size="20" fill="#475C50">All your financial data stays in local SQLite storage.</text>
      <text x="145" y="142" class="body-med" font-size="20" fill="#475C50">No bank logins, no cloud sync, no third-party tracking.</text>
    </g>
  </g>

  <!-- Pip Mascot with sunglasses at bottom -->
  {pip_mascot_sunglasses(540, 1140, 1.4)}
</svg>
"""


def main():
    print("Rendering Net Worth Instagram carousel (4 slides, 1080x1350)...")

    slides = [
        ("networth_01_cover", generate_slide_1_cover()),
        ("networth_02_overview", generate_slide_2_overview()),
        ("networth_03_investments", generate_slide_3_investments()),
        ("networth_04_recap", generate_slide_4_recap()),
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
        print(f"✓ Generated: {png_path.name}")

        if BRAIN_DIR.exists():
            shutil.copy(png_path, BRAIN_DIR / f"{name}.png")

    print(f"\nAll {len(slides)} slides rendered to {OUT_DIR}/ and copied to artifact dir.")


if __name__ == "__main__":
    main()
