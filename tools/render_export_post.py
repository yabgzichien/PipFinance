#!/usr/bin/env python3
"""Render crisp 1:1 square (1080x1080) Instagram carousel post slides for Pip's Export Feature.

Slides:
1. Cover: "Export like an accountant would." (Income Statement & Balance Sheet previews + Pip mascot)
2. Income Statement (P&L): High-fidelity vector table + key takeaway cards
3. Balance Sheet (SOFP): High-fidelity vector double-entry table + key takeaway cards
4. 5 Export Formats: PDF, XLSX, HTML, CSV, JSON
5. Ownership & Privacy: 100% On-Device, Instant Sharing, Audit & Tax Ready + Pip Mascot
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
SHOTS = ROOT / "AppStoreScreenshot"

def get_font_base64(ttf_path: Path) -> str:
    if not ttf_path.exists():
        raise FileNotFoundError(f"Font file not found: {ttf_path}")
    return base64.b64encode(ttf_path.read_bytes()).decode("ascii")

def image_to_base64(im: Image.Image, format: str = "JPEG", quality: int = 92) -> str:
    buf = io.BytesIO()
    im.save(buf, format=format, quality=quality)
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

im_pdf = Image.open(SHOTS / "09_pdf_statement_preview.jpg")
crop_pdf_cover = im_pdf.crop((0, 300, 1224, 1750))
b64_pdf_cover = image_to_base64(crop_pdf_cover)

im_html = Image.open(SHOTS / "08_html_report_preview.jpg")
crop_html = im_html.crop((0, 300, 1224, 1850))
b64_html = image_to_base64(crop_html)

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

def generate_export_01_cover() -> str:
    """Slide 1 (1080x1080): Export like an accountant would."""
    return f"""<svg width="1080" height="1080" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1080" fill="url(#bgGrad)"/>
  <rect width="1080" height="1080" fill="url(#topGlow)"/>

  <!-- Orbit Rings -->
  <g opacity="0.3">
    <circle cx="540" cy="540" r="380" stroke="#2AAB68" stroke-width="1.8" stroke-dasharray="12 16"/>
    <circle cx="540" cy="540" r="500" stroke="#FAC438" stroke-width="1.2" stroke-dasharray="8 18"/>
  </g>

  <!-- Sparkles -->
  <g fill="#FAC438">
    <path d="M120 110 Q120 126 104 126 Q120 126 120 142 Q120 126 136 126 Q120 126 120 110 Z" opacity="0.85"/>
    <path d="M960 120 Q960 136 944 136 Q960 136 960 152 Q960 136 976 136 Q960 136 960 120 Z" opacity="0.85"/>
  </g>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 90)" text-anchor="middle">
    <!-- Eyebrow Tag -->
    <rect x="-130" y="-28" width="260" height="42" rx="21" fill="#E2F0E7" stroke="#2AAB68" stroke-width="1.5"/>
    <text x="0" y="-1" class="body-bold" font-size="15" fill="#185E3E" letter-spacing="2">FINANCIAL EXPORT</text>
    
    <!-- Headline -->
    <text x="0" y="65" class="display-hero" font-size="56" fill="#142B20" letter-spacing="-1.5">Export like an accountant would.</text>
    
    <!-- Subtitle -->
    <text x="0" y="112" class="body-semi" font-size="23" fill="#475C50">
      Income Statements, Balance Sheets, and Excel workbooks in one tap.
    </text>
  </g>

  <!-- ================= CENTER SHOWCASE ================= -->
  <g transform="translate(540, 560)">
    <!-- Back card (HTML preview angled) -->
    <g transform="translate(-190, -280) rotate(-6)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="390" height="520" rx="20" fill="#16201B" stroke="#2AAB68" stroke-width="2"/>
      <clipPath id="clipHtmlCover">
        <rect x="2" y="2" width="386" height="516" rx="18"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_html}" x="2" y="2" width="386" height="580" clip-path="url(#clipHtmlCover)" preserveAspectRatio="xMidYMin slice"/>
    </g>

    <!-- Front card (PDF Financial Statement preview angled) -->
    <g transform="translate(-110, -270) rotate(4)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="400" height="530" rx="20" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipPdfCover">
        <rect x="3" y="3" width="394" height="524" rx="17"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_pdf_cover}" x="3" y="3" width="394" height="560" clip-path="url(#clipPdfCover)" preserveAspectRatio="xMidYMin slice"/>
    </g>

    <!-- Floating Mini Pip Mascot with Glasses -->
    <g transform="translate(230, 110) scale(1.65)" filter="url(#cardShadow)">
      <g transform="translate(-50, -56)">
        <ellipse cx="50" cy="92" rx="22" ry="4.5" fill="rgba(20,43,32,0.2)"/>
        <!-- Sprout -->
        <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3" fill="none" stroke-linecap="round"/>
        <ellipse cx="42" cy="15" rx="7.5" ry="4.2" fill="#1c7a4e" transform="rotate(-32 42 15)"/>
        <ellipse cx="58" cy="13" rx="8.5" ry="4.6" fill="#2aab68" transform="rotate(28 58 13)"/>
        <!-- Body -->
        <circle cx="50" cy="56" r="33" fill="#F5B42A"/>
        <circle cx="50" cy="56" r="26.6" fill="#FAC438"/>
        <!-- Glasses / Cool pose -->
        <path d="M47 51.5 Q50 48.6 53 51.5" stroke="#232323" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <rect x="29" y="47" width="18" height="12.5" rx="5.6" fill="#2E2E33" stroke="#232323" stroke-width="1.7"/>
        <rect x="53" y="47" width="18" height="12.5" rx="5.6" fill="#2E2E33" stroke="#232323" stroke-width="1.7"/>
        <path d="M36 64 H64 Q62.5 79 50 79 Q37.5 79 36 64 Z" fill="#FFFDF5" stroke="#7A4800" stroke-width="2"/>
      </g>
    </g>
  </g>

  <!-- ================= BOTTOM FORMAT PILLS ================= -->
  <g transform="translate(540, 975)" text-anchor="middle">
    <!-- Format Badges Pill with plenty of width -->
    <rect x="-440" y="-30" width="880" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-310" y="8" class="body-bold" font-size="18" fill="#FAC438">PDF Statement</text>
    <text x="-195" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="-115" y="8" class="body-bold" font-size="18" fill="#FFFDF9">Excel (.xlsx)</text>
    <text x="-15" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="80" y="8" class="body-bold" font-size="18" fill="#FFFDF9">Interactive HTML</text>
    <text x="185" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="240" y="8" class="body-bold" font-size="18" fill="#FFFDF9">CSV</text>
    <text x="290" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="345" y="8" class="body-bold" font-size="18" fill="#FFFDF9">JSON</text>
  </g>
</svg>
"""

def generate_export_02_income_statement() -> str:
    """Slide 2 (1080x1080): Income Statement (P&L) with crisp vector UI table."""
    return f"""<svg width="1080" height="1080" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1080" fill="url(#bgGrad)"/>
  <rect width="1080" height="1080" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(80, 90)">
    <!-- Eyebrow -->
    <rect x="0" y="-28" width="260" height="42" rx="21" fill="#E2F0E7" stroke="#2AAB68" stroke-width="1.5"/>
    <text x="130" y="-1" text-anchor="middle" class="body-bold" font-size="15" fill="#185E3E" letter-spacing="2">PROFIT &amp; LOSS REPORT</text>
    
    <!-- Headline -->
    <text x="0" y="65" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Income Statement (P&amp;L)</text>
    
    <!-- Subtitle -->
    <text x="0" y="112" class="body-semi" font-size="23" fill="#475C50">
      Track exact revenues, operating expenses, and net monthly surplus.
    </text>
  </g>

  <!-- ================= CONTENT AREA ================= -->
  <!-- Left Side: High-Fidelity Vector Income Statement Card -->
  <g transform="translate(80, 260)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="460" height="710" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
    
    <!-- Card Header -->
    <g transform="translate(30, 40)">
      <text x="0" y="0" class="body-bold" font-size="13" fill="#88988E" letter-spacing="1.5">STATEMENT OF PROFIT &amp; LOSS</text>
      <text x="0" y="28" class="display-hero" font-size="22" fill="#142B20">Monthly Summary</text>
      <rect x="290" y="8" width="110" height="26" rx="13" fill="#EAF7EE"/>
      <text x="345" y="25" text-anchor="middle" class="body-bold" font-size="12" fill="#185E3E">JULY 2026</text>
    </g>

    <line x1="30" y1="90" x2="430" y2="90" stroke="#EAEFEA" stroke-width="1.5"/>

    <!-- Section 1: Revenues -->
    <g transform="translate(30, 125)">
      <text x="0" y="0" class="body-extra" font-size="13" fill="#185E3E" letter-spacing="1">REVENUES &amp; INFLOWS</text>
      <text x="400" y="0" text-anchor="end" class="body-bold" font-size="13" fill="#185E3E">SHARE</text>
      
      <!-- Row 1 -->
      <text x="0" y="32" class="body-med" font-size="16" fill="#3D4F44">Allowance</text>
      <text x="400" y="32" text-anchor="end" class="body-bold" font-size="16" fill="#185E3E">RM 2,200.00</text>
      
      <!-- Row 2 -->
      <text x="0" y="62" class="body-med" font-size="16" fill="#3D4F44">Other Income</text>
      <text x="400" y="62" text-anchor="end" class="body-bold" font-size="16" fill="#185E3E">RM 1,200.00</text>
      
      <!-- Row 3 -->
      <text x="0" y="92" class="body-med" font-size="16" fill="#3D4F44">Salary</text>
      <text x="400" y="92" text-anchor="end" class="body-bold" font-size="16" fill="#185E3E">RM 360.00</text>
      
      <!-- Subtotal Box -->
      <rect x="0" y="112" width="400" height="38" rx="8" fill="#EAF7EE"/>
      <text x="14" y="136" class="body-bold" font-size="15" fill="#142B20">Total Revenue</text>
      <text x="386" y="136" text-anchor="end" class="display-hero" font-size="16" fill="#185E3E">RM 3,760.00</text>
    </g>

    <!-- Section 2: Operating Expenses -->
    <g transform="translate(30, 310)">
      <text x="0" y="0" class="body-extra" font-size="13" fill="#8A5A16" letter-spacing="1">OPERATING EXPENSES</text>
      
      <!-- Row 1 -->
      <text x="0" y="32" class="body-med" font-size="16" fill="#3D4F44">Food &amp; Dining</text>
      <text x="400" y="32" text-anchor="end" class="body-bold" font-size="16" fill="#D95C3C">RM 1,272.30</text>
      
      <!-- Row 2 -->
      <text x="0" y="62" class="body-med" font-size="16" fill="#3D4F44">Car Installment</text>
      <text x="400" y="62" text-anchor="end" class="body-bold" font-size="16" fill="#D95C3C">RM 565.80</text>
      
      <!-- Row 3 -->
      <text x="0" y="92" class="body-med" font-size="16" fill="#3D4F44">Rental</text>
      <text x="400" y="92" text-anchor="end" class="body-bold" font-size="16" fill="#D95C3C">RM 340.00</text>
      
      <!-- Subtotal Box -->
      <rect x="0" y="112" width="400" height="38" rx="8" fill="#FFF2EE"/>
      <text x="14" y="136" class="body-bold" font-size="15" fill="#142B20">Total Expenses</text>
      <text x="386" y="136" text-anchor="end" class="display-hero" font-size="16" fill="#D95C3C">RM 2,805.20</text>
    </g>

    <!-- Bottom Result Banner -->
    <g transform="translate(30, 500)">
      <rect x="0" y="0" width="400" height="150" rx="16" fill="#142B20"/>
      <text x="24" y="42" class="body-bold" font-size="15" fill="#8EA396">NET SURPLUS / SAVINGS</text>
      <text x="24" y="92" class="display-hero" font-size="36" fill="#FAC438">+RM 954.80</text>
      <rect x="240" y="62" width="136" height="34" rx="17" fill="#2AAB68"/>
      <text x="308" y="84" text-anchor="middle" class="body-bold" font-size="15" fill="#FFF">25.4% Margin</text>
      <text x="24" y="126" class="body-med" font-size="13" fill="#C5D6CC">Balanced &amp; verified via local ledger</text>
    </g>
  </g>

  <!-- Right Side: 3 Feature Cards -->
  <g transform="translate(570, 260)">
    <!-- Card 1: Revenues & Inflows -->
    <g transform="translate(0, 0)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="430" height="215" rx="26" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(24, 26)">
        <circle cx="26" cy="26" r="26" fill="#EAF7EE"/>
        <text x="26" y="33" text-anchor="middle" class="body-bold" font-size="16" fill="#185E3E">RM</text>
        <text x="68" y="32" class="display-hero" font-size="23" fill="#142B20">Revenues &amp; Inflows</text>
        <text x="0" y="80" class="body-med" font-size="18" fill="#475C50">
          <tspan x="0" dy="0">Salary, allowance, freelance, and</tspan>
          <tspan x="0" dy="26">investment returns itemized by share.</tspan>
        </text>
      </g>
    </g>

    <!-- Card 2: Operating Expenses -->
    <g transform="translate(0, 245)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="430" height="215" rx="26" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(24, 26)">
        <circle cx="26" cy="26" r="26" fill="#FFE8E3"/>
        <path d="M18 34 L23 26 L29 30 L35 18" fill="none" stroke="#FF8B6A" stroke-width="2.6" stroke-linecap="round"/>
        <text x="68" y="32" class="display-hero" font-size="23" fill="#142B20">Operating Expenses</text>
        <text x="0" y="80" class="body-med" font-size="18" fill="#475C50">
          <tspan x="0" dy="0">Food, rent, transport, commitments,</tspan>
          <tspan x="0" dy="26">and discretionary burn rate.</tspan>
        </text>
      </g>
    </g>

    <!-- Card 3: Net Surplus & Margin -->
    <g transform="translate(0, 490)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="430" height="215" rx="26" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(24, 26)">
        <circle cx="26" cy="26" r="26" fill="#FFF4D6"/>
        <path d="M16 28 C16 22 22 18 28 18 C34 18 38 22 38 28 C38 34 32 37 28 37 C22 37 16 34 16 28 Z" fill="none" stroke="#B08A3E" stroke-width="2"/>
        <text x="68" y="32" class="display-hero" font-size="23" fill="#142B20">Net Savings Margin</text>
        <text x="0" y="80" class="body-med" font-size="18" fill="#475C50">
          <tspan x="0" dy="0">Total net surplus and exact savings</tspan>
          <tspan x="0" dy="26">percentage calculated automatically.</tspan>
        </text>
      </g>
    </g>
  </g>
</svg>
"""

def generate_export_03_balance_sheet() -> str:
    """Slide 3 (1080x1080): Balance Sheet (SOFP) with crisp vector double-entry UI table."""
    return f"""<svg width="1080" height="1080" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1080" fill="url(#bgGrad)"/>
  <rect width="1080" height="1080" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(80, 90)">
    <!-- Eyebrow -->
    <rect x="0" y="-28" width="310" height="42" rx="21" fill="#E2F0E7" stroke="#2AAB68" stroke-width="1.5"/>
    <text x="155" y="-1" text-anchor="middle" class="body-bold" font-size="15" fill="#185E3E" letter-spacing="2">STATEMENT OF POSITION</text>
    
    <!-- Headline -->
    <text x="0" y="65" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">Balance Sheet (SOFP)</text>
    
    <!-- Subtitle -->
    <text x="0" y="112" class="body-semi" font-size="23" fill="#475C50">
      Traditional 2-column structure: Assets, Liabilities, and Owner's Equity.
    </text>
  </g>

  <!-- ================= CONTENT AREA ================= -->
  <!-- Left Side: High-Fidelity Vector Balance Sheet Table -->
  <g transform="translate(80, 260)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="460" height="710" rx="28" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
    
    <!-- Card Header -->
    <g transform="translate(30, 40)">
      <text x="0" y="0" class="body-bold" font-size="13" fill="#88988E" letter-spacing="1.5">STATEMENT OF FINANCIAL POSITION</text>
      <text x="0" y="28" class="display-hero" font-size="22" fill="#142B20">Double-Entry Ledger</text>
      <rect x="290" y="8" width="110" height="26" rx="13" fill="#EAF7EE"/>
      <text x="345" y="25" text-anchor="middle" class="body-bold" font-size="12" fill="#185E3E">AS OF TODAY</text>
    </g>

    <line x1="30" y1="90" x2="430" y2="90" stroke="#EAEFEA" stroke-width="1.5"/>

    <!-- Section 1: Assets & Holdings -->
    <g transform="translate(30, 125)">
      <text x="0" y="0" class="body-extra" font-size="13" fill="#185E3E" letter-spacing="1">ASSETS &amp; HOLDINGS</text>
      
      <!-- Row 1 -->
      <text x="0" y="32" class="body-med" font-size="16" fill="#3D4F44">Cash &amp; TnG eWallet</text>
      <text x="400" y="32" text-anchor="end" class="body-bold" font-size="16" fill="#185E3E">RM 2,450.00</text>
      
      <!-- Row 2 -->
      <text x="0" y="62" class="body-med" font-size="16" fill="#3D4F44">Bitcoin &amp; Crypto</text>
      <text x="400" y="62" text-anchor="end" class="body-bold" font-size="16" fill="#185E3E">RM 4,800.00</text>
      
      <!-- Row 3 -->
      <text x="0" y="92" class="body-med" font-size="16" fill="#3D4F44">Gold (XAU)</text>
      <text x="400" y="92" text-anchor="end" class="body-bold" font-size="16" fill="#185E3E">RM 1,500.00</text>
      
      <!-- Subtotal Box -->
      <rect x="0" y="112" width="400" height="38" rx="8" fill="#EAF7EE"/>
      <text x="14" y="136" class="body-bold" font-size="15" fill="#142B20">Total Assets</text>
      <text x="386" y="136" text-anchor="end" class="display-hero" font-size="16" fill="#185E3E">RM 8,750.00</text>
    </g>

    <!-- Section 2: Liabilities & Obligations -->
    <g transform="translate(30, 310)">
      <text x="0" y="0" class="body-extra" font-size="13" fill="#8A5A16" letter-spacing="1">LIABILITIES &amp; DEBTS</text>
      
      <!-- Row 1 -->
      <text x="0" y="32" class="body-med" font-size="16" fill="#3D4F44">Car Loan Balance</text>
      <text x="400" y="32" text-anchor="end" class="body-bold" font-size="16" fill="#D95C3C">RM 3,200.00</text>
      
      <!-- Row 2 -->
      <text x="0" y="62" class="body-med" font-size="16" fill="#3D4F44">Credit Card Balance</text>
      <text x="400" y="62" text-anchor="end" class="body-bold" font-size="16" fill="#D95C3C">RM 650.00</text>
      
      <!-- Subtotal Box -->
      <rect x="0" y="84" width="400" height="38" rx="8" fill="#FFF2EE"/>
      <text x="14" y="108" class="body-bold" font-size="15" fill="#142B20">Total Liabilities</text>
      <text x="386" y="108" text-anchor="end" class="display-hero" font-size="16" fill="#D95C3C">RM 3,850.00</text>
    </g>

    <!-- Bottom Result Banner: Net Worth Position -->
    <g transform="translate(30, 480)">
      <rect x="0" y="0" width="400" height="170" rx="16" fill="#142B20"/>
      <text x="24" y="38" class="body-bold" font-size="14" fill="#8EA396">OWNER'S EQUITY / NET WORTH</text>
      <text x="24" y="88" class="display-hero" font-size="36" fill="#FAC438">RM 4,900.00</text>
      <rect x="230" y="58" width="146" height="34" rx="17" fill="#2AAB68"/>
      <text x="303" y="80" text-anchor="middle" class="body-bold" font-size="14" fill="#FFF">Balanced Ledger</text>
      <text x="24" y="128" class="body-med" font-size="13" fill="#C5D6CC">Total Assets = Total Liabilities + Equity</text>
      <text x="24" y="148" class="body-bold" font-size="13" fill="#FAC438">RM 8,750.00 = RM 3,850.00 + RM 4,900.00</text>
    </g>
  </g>

  <!-- Right Side: 3 Feature Cards -->
  <g transform="translate(570, 260)">
    <!-- Card 1: Assets & Holdings -->
    <g transform="translate(0, 0)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="430" height="215" rx="26" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(24, 26)">
        <circle cx="26" cy="26" r="26" fill="#EAF7EE"/>
        <path d="M26 16 L36 26 L26 36 L16 26 Z" fill="none" stroke="#1C7A4E" stroke-width="2.4"/>
        <text x="68" y="32" class="display-hero" font-size="23" fill="#142B20">Assets &amp; Holdings</text>
        <text x="0" y="80" class="body-med" font-size="18" fill="#475C50">
          <tspan x="0" dy="0">Cash, bank accounts, TnG eWallet,</tspan>
          <tspan x="0" dy="26">crypto, and gold at live market prices.</tspan>
        </text>
      </g>
    </g>

    <!-- Card 2: Liabilities & Obligations -->
    <g transform="translate(0, 245)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="430" height="215" rx="26" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(24, 26)">
        <circle cx="26" cy="26" r="26" fill="#FFE8E3"/>
        <line x1="18" y1="26" x2="34" y2="26" stroke="#FF8B6A" stroke-width="3.2" stroke-linecap="round"/>
        <text x="68" y="32" class="display-hero" font-size="23" fill="#142B20">Liabilities &amp; Debts</text>
        <text x="0" y="80" class="body-med" font-size="18" fill="#475C50">
          <tspan x="0" dy="0">Car loans, mortgages, installments,</tspan>
          <tspan x="0" dy="26">and outstanding credit balances.</tspan>
        </text>
      </g>
    </g>

    <!-- Card 3: Owner Equity & Net Worth -->
    <g transform="translate(0, 490)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="430" height="215" rx="26" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(24, 26)">
        <circle cx="26" cy="26" r="26" fill="#FFF4D6"/>
        <path d="M26 16 V36 M18 22 H34 M16 30 L20 22 L24 30 Z M28 30 L32 22 L36 30 Z" fill="none" stroke="#B08A3E" stroke-width="2"/>
        <text x="68" y="32" class="display-hero" font-size="23" fill="#142B20">Owner's Equity</text>
        <text x="0" y="80" class="body-med" font-size="18" fill="#475C50">
          <tspan x="0" dy="0">Your true net worth position, balanced</tspan>
          <tspan x="0" dy="26">automatically via double-entry logic.</tspan>
        </text>
      </g>
    </g>
  </g>
</svg>
"""

def generate_export_04_formats() -> str:
    """Slide 4 (1080x1080): 5 Export Formats."""
    return f"""<svg width="1080" height="1080" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1080" fill="url(#bgGrad)"/>
  <rect width="1080" height="1080" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 90)" text-anchor="middle">
    <!-- Eyebrow -->
    <rect x="-115" y="-28" width="230" height="42" rx="21" fill="#E2F0E7" stroke="#2AAB68" stroke-width="1.5"/>
    <text x="0" y="-1" class="body-bold" font-size="15" fill="#185E3E" letter-spacing="2">OUTPUT FORMATS</text>
    
    <!-- Headline -->
    <text x="0" y="65" class="display-hero" font-size="54" fill="#142B20" letter-spacing="-1.5">5 Ways to Take Your Data</text>
    
    <!-- Subtitle -->
    <text x="0" y="112" class="body-semi" font-size="23" fill="#475C50">
      Built for spreadsheets, tax filing, and permanent personal archiving.
    </text>
  </g>

  <!-- ================= 4 FORMAT CARDS GRID ================= -->
  <g transform="translate(80, 260)">

    <!-- Row 1: PDF Financial Statement -->
    <g transform="translate(0, 0)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="920" height="155" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(32, 28)">
        <rect x="0" y="0" width="98" height="98" rx="20" fill="#EAF7EE"/>
        <path d="M36 28 H54 L62 36 V70 H36 Z" fill="none" stroke="#1C7A4E" stroke-width="3" stroke-linejoin="round"/>
        <text x="49" y="58" text-anchor="middle" class="body-bold" font-size="13" fill="#1C7A4E">PDF</text>
        
        <text x="124" y="38" class="display-hero" font-size="26" fill="#142B20">PDF Financial Statement</text>
        <rect x="445" y="14" width="130" height="28" rx="14" fill="#EAF7EE"/>
        <text x="510" y="33" text-anchor="middle" class="body-bold" font-size="13" fill="#185E3E">FORMAL P&amp;L</text>

        <text x="124" y="74" class="body-med" font-size="19" fill="#475C50">
          Traditional 2-column Balance Sheet, Income Statement &amp; itemized ledger.
        </text>
      </g>
    </g>

    <!-- Row 2: Excel Workbook (.xlsx) -->
    <g transform="translate(0, 180)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="920" height="155" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(32, 28)">
        <rect x="0" y="0" width="98" height="98" rx="20" fill="#FFF4D6"/>
        <rect x="34" y="28" width="30" height="42" rx="4" fill="none" stroke="#B08A3E" stroke-width="2.6"/>
        <line x1="34" y1="42" x2="64" y2="42" stroke="#B08A3E" stroke-width="2"/>
        <line x1="34" y1="56" x2="64" y2="56" stroke="#B08A3E" stroke-width="2"/>
        <line x1="49" y1="28" x2="49" y2="70" stroke="#B08A3E" stroke-width="2"/>

        <text x="124" y="38" class="display-hero" font-size="26" fill="#142B20">Excel Workbook (.xlsx)</text>
        <rect x="425" y="14" width="115" height="28" rx="14" fill="#FFF4D6"/>
        <text x="482" y="33" text-anchor="middle" class="body-bold" font-size="13" fill="#8A5A16">4 SHEETS</text>

        <text x="124" y="74" class="body-med" font-size="19" fill="#475C50">
          4 Sheets: Income Statement, Balance Sheet, Ledger, and Monthly Trends.
        </text>
      </g>
    </g>

    <!-- Row 3: Interactive HTML Analytics -->
    <g transform="translate(0, 360)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="920" height="155" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(32, 28)">
        <rect x="0" y="0" width="98" height="98" rx="20" fill="#FFE8E3"/>
        <circle cx="49" cy="49" r="18" fill="none" stroke="#FF8B6A" stroke-width="3"/>
        <path d="M49 31 A18 18 0 0 1 67 49 H49 Z" fill="#FF8B6A"/>

        <text x="124" y="38" class="display-hero" font-size="26" fill="#142B20">Interactive HTML Analytics</text>
        <rect x="480" y="14" width="135" height="28" rx="14" fill="#FFE8E3"/>
        <text x="547" y="33" text-anchor="middle" class="body-bold" font-size="13" fill="#C24E31">WITH CHARTS</text>

        <text x="124" y="74" class="body-med" font-size="19" fill="#475C50">
          Standalone visual report with SVG cash flow, category donut, and trends.
        </text>
      </g>
    </g>

    <!-- Row 4: CSV & JSON Backup -->
    <g transform="translate(0, 540)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="920" height="155" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <g transform="translate(32, 28)">
        <rect x="0" y="0" width="98" height="98" rx="20" fill="#EAF7EE"/>
        <path d="M38 42 L30 49 L38 56 M60 42 L68 49 L60 56" fill="none" stroke="#1C7A4E" stroke-width="3" stroke-linecap="round"/>

        <text x="124" y="38" class="display-hero" font-size="26" fill="#142B20">CSV Ledger &amp; JSON Backup</text>
        <rect x="480" y="14" width="145" height="28" rx="14" fill="#EAF7EE"/>
        <text x="552" y="33" text-anchor="middle" class="body-bold" font-size="13" fill="#185E3E">RE-IMPORTABLE</text>

        <text x="124" y="74" class="body-med" font-size="19" fill="#475C50">
          Raw tabular data for any tool, plus lossless JSON for instant restore.
        </text>
      </g>
    </g>
  </g>
</svg>
"""

def generate_export_05_ownership() -> str:
    """Slide 5 (1080x1080): Complete Ownership & Privacy."""
    return f"""<svg width="1080" height="1080" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1080" fill="url(#bgGrad)"/>
  <rect width="1080" height="1080" fill="url(#topGlow)"/>

  <!-- ================= HEADER ================= -->
  <g transform="translate(540, 90)" text-anchor="middle">
    <!-- Eyebrow -->
    <rect x="-105" y="-28" width="210" height="42" rx="21" fill="#E2F0E7" stroke="#2AAB68" stroke-width="1.5"/>
    <text x="0" y="-1" class="body-bold" font-size="15" fill="#185E3E" letter-spacing="2">ZERO LOCK-IN</text>
    
    <!-- Headline -->
    <text x="0" y="65" class="display-hero" font-size="56" fill="#142B20" letter-spacing="-1.5">Your Data, In Your Hands.</text>
    
    <!-- Subtitle -->
    <text x="0" y="112" class="body-semi" font-size="23" fill="#475C50">
      Professional financial clarity without corporate lock-in or subscriptions.
    </text>
  </g>

  <!-- ================= MAIN CARD ================= -->
  <g transform="translate(80, 260)" filter="url(#cardShadow)">
    <rect x="0" y="0" width="920" height="710" rx="36" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
    
    <g transform="translate(56, 50)">
      
      <!-- Point 1 -->
      <g transform="translate(0, 0)">
        <circle cx="28" cy="28" r="28" fill="#EAF7EE"/>
        <path d="M24 26 v-3 a4 4 0 0 1 8 0 v3 m-6 0 h12 v8 h-12 z" fill="none" stroke="#1c7a4e" stroke-width="2.6" stroke-linecap="round"/>
        <text x="74" y="36" class="display-hero" font-size="28" fill="#142B20">100% On-Device Processing</text>
        <text x="74" y="78" class="body-med" font-size="20" fill="#475C50">
          <tspan x="74" dy="0">All reports are generated entirely inside your phone.</tspan>
          <tspan x="74" dy="28" class="body-bold" fill="#185E3E">No accounts, no external tracking, and zero servers involved.</tspan>
        </text>
      </g>

      <line x1="0" y1="165" x2="808" y2="165" stroke="#EAEFEA" stroke-width="1.8"/>

      <!-- Point 2 -->
      <g transform="translate(0, 205)">
        <circle cx="28" cy="28" r="28" fill="#FFF4D6"/>
        <circle cx="36" cy="20" r="4" fill="#B08A3E"/>
        <circle cx="20" cy="28" r="4" fill="#B08A3E"/>
        <circle cx="36" cy="36" r="4" fill="#B08A3E"/>
        <line x1="23" y1="26" x2="33" y2="22" stroke="#B08A3E" stroke-width="2"/>
        <line x1="23" y1="30" x2="33" y2="34" stroke="#B08A3E" stroke-width="2"/>
        
        <text x="74" y="36" class="display-hero" font-size="28" fill="#142B20">One-Tap Native Sharing</text>
        <text x="74" y="78" class="body-med" font-size="20" fill="#475C50">
          <tspan x="74" dy="0">Send statements directly via WhatsApp, email, AirDrop,</tspan>
          <tspan x="74" dy="28" class="body-bold" fill="#185E3E">or save them straight to your phone's file storage.</tspan>
        </text>
      </g>

      <line x1="0" y1="370" x2="808" y2="370" stroke="#EAEFEA" stroke-width="1.8"/>

      <!-- Point 3 -->
      <g transform="translate(0, 410)">
        <circle cx="28" cy="28" r="28" fill="#FFE8E3"/>
        <path d="M20 16 H32 L38 22 V40 H20 Z" fill="none" stroke="#FF8B6A" stroke-width="2.6"/>
        
        <text x="74" y="36" class="display-hero" font-size="28" fill="#142B20">Audit &amp; Tax Season Ready</text>
        <text x="74" y="78" class="body-med" font-size="20" fill="#475C50">
          <tspan x="74" dy="0">Structured documentation formatted for tax relief filing,</tspan>
          <tspan x="74" dy="28" class="body-bold" fill="#185E3E">loan applications, or deep personal balance sheet reviews.</tspan>
        </text>
      </g>

      <!-- Bottom Mini Mascot Seal -->
      <g transform="translate(710, 500) scale(1.1)" filter="url(#cardShadow)">
        <circle cx="50" cy="56" r="30" fill="#F5B42A"/>
        <circle cx="50" cy="56" r="24" fill="#FAC438"/>
        <!-- Sprout -->
        <path d="M50 30 C50 24 50 20 50 18" stroke="#185e3e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="43" cy="20" rx="6.5" ry="3.6" fill="#1c7a4e" transform="rotate(-32 43 20)"/>
        <ellipse cx="57" cy="18" rx="7.5" ry="4" fill="#2aab68" transform="rotate(28 57 18)"/>
        <!-- Joy Face -->
        <circle cx="42" cy="54" r="3.6" fill="#7A4800"/>
        <circle cx="58" cy="54" r="3.6" fill="#7A4800"/>
        <path d="M41 62 Q50 72 59 62 Z" fill="#7A4800"/>
      </g>

    </g>
  </g>
</svg>
"""

def main():
    print("Rendering updated 1:1 Instagram Export Feature carousel...")
    
    slides = [
        ("export_01_cover", generate_export_01_cover()),
        ("export_02_income_statement", generate_export_02_income_statement()),
        ("export_03_balance_sheet", generate_export_03_balance_sheet()),
        ("export_04_formats", generate_export_04_formats()),
        ("export_05_ownership", generate_export_05_ownership()),
    ]
    
    for name, svg_content in slides:
        svg_path = OUT_DIR / f"{name}.svg"
        png_path = OUT_DIR / f"{name}.png"
        
        svg_path.write_text(svg_content, encoding="utf-8")
        cairosvg.svg2png(
            bytestring=svg_content.encode("utf-8"),
            write_to=str(png_path),
            output_width=1080,
            output_height=1080
        )
        print(f"✓ Generated 1:1 slide: {png_path.name}")
        
        if BRAIN_DIR.exists():
            shutil.copy(png_path, BRAIN_DIR / f"{name}.png")

    print(f"All 5 slides rendered in {OUT_DIR}/ and copied to {BRAIN_DIR}/")

if __name__ == "__main__":
    main()
