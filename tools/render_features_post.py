#!/usr/bin/env python3
"""Render 100% REAL picture Instagram carousel post slides in 4:5 aspect ratio (1080x1350) for Pip's Features Post.

- All green eyebrow pill tags removed
- "100% Free on Google Play" tag removed
- Clean phone mockups with status bars and navigation bars cropped out
"""

import base64
import io
import shutil
from pathlib import Path
from PIL import Image
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "InstagramPost"
OUT_DIR.mkdir(parents=True, exist_ok=True)
FONTS_DIR = ROOT / "node_modules" / "@expo-google-fonts"
BRAIN_DIR = Path("/home/yang/.gemini/antigravity/brain/97d8fe2d-cca2-48c1-9339-e21fc7e96f46")
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

def crop_phone_screenshot(path: Path) -> Image.Image:
    im = Image.open(path)
    w, h = im.size
    return im.crop((0, 52, w, min(h, 995)))

im_real_ocr = crop_phone_screenshot(USER_DIR / "media_1787831326212.jpg")
b64_real_ocr = image_to_base64(im_real_ocr, format="JPEG")

im_real_split = crop_phone_screenshot(USER_DIR / "media_1787831346594.jpg")
b64_real_split = image_to_base64(im_real_split, format="JPEG")

im_real_breakdown = crop_phone_screenshot(USER_DIR / "media_1787831429488.jpg")
b64_real_breakdown = image_to_base64(im_real_breakdown, format="JPEG")

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

def generate_slide_1_cover() -> str:
    """Slide 1 (1080x1350, 4:5): Everyday Money Tracking Cover (No green tag)."""
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

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(540, 145)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="58" fill="#142B20" letter-spacing="-1.5"> Know Everything.</text>
    <text x="0" y="52" class="body-semi" font-size="23" fill="#475C50">
      Receipt scanning, friend bill splits, and instant monthly breakdowns.
    </text>
  </g>

  <!-- ================= REAL SCREENSHOTS FANNED SHOWCASE (Clean No Status Bar) ================= -->
  <g transform="translate(540, 715)">
    <!-- Left card: Real OCR / Screenshot -->
    <g transform="translate(-320, -320) rotate(-8)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="340" height="640" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCoverOcrClean">
        <rect x="3" y="3" width="334" height="634" rx="25"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_real_ocr}" x="3" y="3" width="334" height="634" clip-path="url(#clipCoverOcrClean)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Right card: Real Bill Split -->
    <g transform="translate(0, -310) rotate(8)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="340" height="640" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipCoverSplitClean">
        <rect x="3" y="3" width="334" height="634" rx="25"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_real_split}" x="3" y="3" width="334" height="634" clip-path="url(#clipCoverSplitClean)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Center card: Real Monthly Breakdown -->
    <g transform="translate(-180, -340)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="360" height="680" rx="30" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipCoverBreakdownClean">
        <rect x="3" y="3" width="354" height="674" rx="27"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_real_breakdown}" x="3" y="3" width="354" height="674" clip-path="url(#clipCoverBreakdownClean)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Mini Pip Mascot with Sprout -->
    <g transform="translate(190, 150) scale(1.65)" filter="url(#cardShadow)">
      <g transform="translate(-50, -56)">
        <ellipse cx="50" cy="92" rx="22" ry="4.5" fill="rgba(20,43,32,0.2)"/>
        <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3" fill="none" stroke-linecap="round"/>
        <ellipse cx="42" cy="15" rx="7.5" ry="4.2" fill="#1c7a4e" transform="rotate(-32 42 15)"/>
        <ellipse cx="58" cy="13" rx="8.5" ry="4.6" fill="#2aab68" transform="rotate(28 58 13)"/>
        <circle cx="50" cy="56" r="33" fill="#F5B42A"/>
        <circle cx="50" cy="56" r="26.6" fill="#FAC438"/>
        <ellipse cx="31" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.4"/>
        <ellipse cx="69" cy="60.5" rx="5.0" ry="3.0" fill="#F07828" opacity="0.4"/>
        <circle cx="40" cy="53.5" r="3.8" fill="#7A4800"/>
        <circle cx="41.5" cy="52" r="1.3" fill="#FFFFFF"/>
        <circle cx="60" cy="53.5" r="3.8" fill="#7A4800"/>
        <circle cx="61.5" cy="52" r="1.3" fill="#FFFFFF"/>
        <path d="M39 63 Q50 75 61 63 Q50 69 39 63 Z" fill="#7A4800"/>
      </g>
    </g>
  </g>

  <!-- ================= BOTTOM FEATURE PILLS ================= -->
  <g transform="translate(540, 1220)" text-anchor="middle">
    <rect x="-460" y="-30" width="920" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-310" y="8" class="body-bold" font-size="17" fill="#FAC438">Receipt &amp; eWallet Scan</text>
    <text x="-165" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="-50" y="8" class="body-bold" font-size="17" fill="#FFFDF9">Bill Split</text>
    <text x="70" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="240" y="8" class="body-bold" font-size="17" fill="#FFFDF9">Monthly Breakdown</text>
  </g>
</svg>
"""

def generate_slide_2_ocr() -> str:
    """Slide 2 (1080x1350, 4:5): Real Receipt / Screenshot OCR recording (No green tag)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Snap a Receipt or Screenshot.</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Pip reads transactions and amounts automatically in one tap.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP (No status bar) ================= -->
  <g transform="translate(540, 775)" text-anchor="middle">
    <g transform="translate(-240, -495)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="480" height="990" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipOcrPhoneClean">
        <rect x="4" y="4" width="472" height="982" rx="32"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_real_ocr}" x="4" y="4" width="472" height="982" clip-path="url(#clipOcrPhoneClean)" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>
"""

def generate_slide_3_split() -> str:
    """Slide 3 (1080x1350, 4:5): Real Bill Splitting with friends & IOUs (No green tag)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Split Bills </text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Itemized orders, service tax, and discounts with zero awkward math.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP (No status bar) ================= -->
  <g transform="translate(540, 775)" text-anchor="middle">
    <g transform="translate(-240, -495)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="480" height="990" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipSplitPhoneClean">
        <rect x="4" y="4" width="472" height="982" rx="32"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_real_split}" x="4" y="4" width="472" height="982" clip-path="url(#clipSplitPhoneClean)" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>
"""

def generate_slide_4_breakdown() -> str:
    """Slide 4 (1080x1350, 4:5): Real Monthly Breakdown (No green tag)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(540, 125)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Where Does Your Money Go?</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Visual spending donut and month-over-month category tracking.
    </text>
  </g>

  <!-- ================= REAL PHONE MOCKUP (No status bar) ================= -->
  <g transform="translate(540, 775)" text-anchor="middle">
    <g transform="translate(-240, -495)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="480" height="990" rx="36" fill="#FFFDF9" stroke="#2AAB68" stroke-width="3"/>
      <clipPath id="clipBreakdownPhoneClean">
        <rect x="4" y="4" width="472" height="982" rx="32"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_real_breakdown}" x="4" y="4" width="472" height="982" clip-path="url(#clipBreakdownPhoneClean)" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </g>
</svg>
"""

def generate_slide_5_recap() -> str:
    """Slide 5 (1080x1350, 4:5): Summary without green tag and without Google Play tag."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- Orbit Rings -->
  <g opacity="0.3">
    <circle cx="540" cy="675" r="420" stroke="#2AAB68" stroke-width="2" stroke-dasharray="12 16"/>
  </g>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(540, 160)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="64" fill="#142B20" letter-spacing="-1.5">Built for Real Life.</text>
    <text x="0" y="54" class="body-semi" font-size="24" fill="#475C50">
      Everything you need to master your everyday money.
    </text>
  </g>

  <!-- ================= 3 FEATURE CARDS ================= -->
  <g transform="translate(100, 310)">
    <!-- Card 1: OCR -->
    <g transform="translate(0, 0)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="230" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="115" r="40" fill="#EAF7EE"/>
      <!-- Camera/Scan Icon -->
      <path d="M64 104 L71 94 H89 L96 104 H105 C108 104 111 107 111 110 V130 C111 133 108 136 105 136 H55 C52 136 49 133 49 130 V110 C49 107 52 104 55 104 H64 Z" fill="none" stroke="#2AAB68" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="80" cy="120" r="9.5" fill="none" stroke="#2AAB68" stroke-width="3.2"/>
      
      <text x="145" y="80" class="display-hero" font-size="28" fill="#142B20">1. Instant Receipt &amp; Screenshot Scan</text>
      <text x="145" y="125" class="body-med" font-size="20" fill="#475C50">Take a photo of paper receipts or screenshot your TnG history.</text>
      <text x="145" y="158" class="body-med" font-size="20" fill="#475C50">Pip extracts every item, merchant, and amount automatically.</text>
    </g>

    <!-- Card 2: Bill Split -->
    <g transform="translate(0, 270)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="230" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="115" r="40" fill="#FFF4D6"/>
      <!-- People/Split Icon -->
      <circle cx="72" cy="108" r="11" fill="none" stroke="#FAC438" stroke-width="3.2"/>
      <path d="M56 130 C56 122 63 118 72 118 C81 118 88 122 88 130" fill="none" stroke="#FAC438" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="92" cy="104" r="9" fill="none" stroke="#7A4800" stroke-width="2.8"/>
      <path d="M83 124 C85 120 89 117 94 117 C101 117 105 120 105 126" fill="none" stroke="#7A4800" stroke-width="2.8" stroke-linecap="round"/>

      <text x="145" y="80" class="display-hero" font-size="28" fill="#142B20">2. Bill Splitting &amp; Owed Tracking</text>
      <text x="145" y="125" class="body-med" font-size="20" fill="#475C50">Split dining bills down to individual dishes and shared drinks.</text>
      <text x="145" y="158" class="body-med" font-size="20" fill="#475C50">Automatically factors in service taxes, vouchers, and discounts.</text>
    </g>

    <!-- Card 3: Monthly Breakdown -->
    <g transform="translate(0, 540)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="880" height="230" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
      <circle cx="80" cy="115" r="40" fill="#EAF7EE"/>
      <!-- Donut/Chart Icon -->
      <circle cx="80" cy="115" r="20" fill="none" stroke="#2AAB68" stroke-width="7"/>
      <circle cx="80" cy="115" r="20" fill="none" stroke="#FAC438" stroke-width="7" stroke-dasharray="40 100"/>

      <text x="145" y="80" class="display-hero" font-size="28" fill="#142B20">3. Monthly "Where It Goes" Breakdown</text>
      <text x="145" y="125" class="body-med" font-size="20" fill="#475C50">Interactive spending donut with percentages and monthly averages.</text>
      <text x="145" y="158" class="body-med" font-size="20" fill="#475C50">Compare food, car, rent, and subscriptions against last month.</text>
    </g>
  </g>
</svg>
"""

def main():
    print("Rendering 100% REAL picture Instagram Features carousel in 4:5 (No green tags, No Google Play tag)...")
    
    slides = [
        ("features_01_cover", generate_slide_1_cover()),
        ("features_02_receipt_scan", generate_slide_2_ocr()),
        ("features_03_bill_split", generate_slide_3_split()),
        ("features_04_monthly_breakdown", generate_slide_4_breakdown()),
        ("features_05_recap", generate_slide_5_recap()),
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
        print(f"✓ Generated 4:5 REAL feature slide (Clean): {png_path.name}")
        
        if BRAIN_DIR.exists():
            shutil.copy(png_path, BRAIN_DIR / f"{name}.png")

    print(f"All {len(slides)} real-feature slides rendered in {OUT_DIR}/ and copied to {BRAIN_DIR}/")

if __name__ == "__main__":
    main()
