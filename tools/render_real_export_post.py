#!/usr/bin/env python3
"""Render polished 100% REAL picture Instagram carousel post slides in 4:5 aspect ratio (1080x1350) for Pip's Export Feature.

Green pill tags removed.
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

# Load Real Screenshots
im_real_pdf_pnl = Image.open(USER_DIR / "media_1787827067336.png")
b64_real_pdf_pnl = image_to_base64(im_real_pdf_pnl)

im_real_pdf_sofp = Image.open(USER_DIR / "media_1787827046188.png")
b64_real_pdf_sofp = image_to_base64(im_real_pdf_sofp)

im_real_html_charts = Image.open(USER_DIR / "media_1787827131231.png")
b64_real_html_charts = image_to_base64(im_real_html_charts)

im_real_html_tables = Image.open(USER_DIR / "media_1787827158135.png")
im_html_pnl_clean = im_real_html_tables.crop((40, 25, 515, 590))
b64_html_pnl_clean = image_to_base64(im_html_pnl_clean)

im_html_sofp_clean = im_real_html_tables.crop((505, 25, 995, 590))
b64_html_sofp_clean = image_to_base64(im_html_sofp_clean)

im_real_formats = crop_phone_screenshot(USER_DIR / "media_1787826281196.jpg")
b64_real_formats = image_to_base64(im_real_formats, format="JPEG")

im_real_xlsx = crop_phone_screenshot(USER_DIR / "media_1787826281203.jpg")
b64_real_xlsx = image_to_base64(im_real_xlsx, format="JPEG")

im_real_pdf_phone = crop_phone_screenshot(USER_DIR / "media_1787826281185.jpg")
b64_real_pdf_phone = image_to_base64(im_real_pdf_phone, format="JPEG")

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
    """Slide 1 (1080x1350, 4:5): Export like an accountant would (No green eyebrow tag)."""
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
    <text x="0" y="0" class="display-hero" font-size="58" fill="#142B20" letter-spacing="-1.5">Export like an accountant would.</text>
    <text x="0" y="52" class="body-semi" font-size="23" fill="#475C50">
      Income Statements, Balance Sheets, and Excel workbooks in one tap.
    </text>
  </g>

  <!-- ================= REAL SCREENSHOTS SHOWCASE ================= -->
  <g transform="translate(540, 715)">
    <!-- Back card: Real HTML Report Charts -->
    <g transform="translate(-230, -320) rotate(-6)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="460" height="600" rx="24" fill="#16201B" stroke="#2AAB68" stroke-width="2.5"/>
      <clipPath id="clipRealHtmlCover">
        <rect x="2" y="2" width="456" height="596" rx="22"/>
      </clipPath>
      <image href="data:image/png;base64,{b64_real_html_charts}" x="2" y="2" width="456" height="600" clip-path="url(#clipRealHtmlCover)" preserveAspectRatio="xMidYMid slice"/>
    </g>

    <!-- Front card: Real PDF Preview phone screen -->
    <g transform="translate(-110, -300) rotate(4)" filter="url(#previewShadow)">
      <rect x="0" y="0" width="440" height="610" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
      <clipPath id="clipRealPdfPhone">
        <rect x="3" y="3" width="434" height="604" rx="21"/>
      </clipPath>
      <image href="data:image/jpeg;base64,{b64_real_pdf_phone}" x="3" y="3" width="434" height="604" clip-path="url(#clipRealPdfPhone)" preserveAspectRatio="xMidYMid meet"/>
    </g>

    <!-- Mini Pip Mascot with Glasses -->
    <g transform="translate(260, 160) scale(1.8)" filter="url(#cardShadow)">
      <g transform="translate(-50, -56)">
        <ellipse cx="50" cy="92" rx="22" ry="4.5" fill="rgba(20,43,32,0.2)"/>
        <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3" fill="none" stroke-linecap="round"/>
        <ellipse cx="42" cy="15" rx="7.5" ry="4.2" fill="#1c7a4e" transform="rotate(-32 42 15)"/>
        <ellipse cx="58" cy="13" rx="8.5" ry="4.6" fill="#2aab68" transform="rotate(28 58 13)"/>
        <circle cx="50" cy="56" r="33" fill="#F5B42A"/>
        <circle cx="50" cy="56" r="26.6" fill="#FAC438"/>
        <path d="M47 51.5 Q50 48.6 53 51.5" stroke="#232323" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <rect x="29" y="47" width="18" height="12.5" rx="5.6" fill="#2E2E33" stroke="#232323" stroke-width="1.7"/>
        <rect x="53" y="47" width="18" height="12.5" rx="5.6" fill="#2E2E33" stroke="#232323" stroke-width="1.7"/>
        <path d="M36 64 H64 Q62.5 79 50 79 Q37.5 79 36 64 Z" fill="#FFFDF5" stroke="#7A4800" stroke-width="2"/>
      </g>
    </g>
  </g>

  <!-- ================= BOTTOM FORMAT PILLS ================= -->
  <g transform="translate(540, 1220)" text-anchor="middle">
    <rect x="-450" y="-30" width="900" height="60" rx="30" fill="#142B20" filter="url(#cardShadow)"/>
    <text x="-320" y="8" class="body-bold" font-size="18" fill="#FAC438">PDF Statement</text>
    <text x="-205" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="-120" y="8" class="body-bold" font-size="18" fill="#FFFDF9">Excel (.xlsx)</text>
    <text x="-20" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="75" y="8" class="body-bold" font-size="18" fill="#FFFDF9">Interactive HTML</text>
    <text x="175" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="230" y="8" class="body-bold" font-size="18" fill="#FFFDF9">CSV</text>
    <text x="280" y="8" class="body-med" font-size="18" fill="#71887B">•</text>
    <text x="335" y="8" class="body-bold" font-size="18" fill="#FFFDF9">JSON</text>
  </g>
</svg>
"""

def generate_slide_2_pnl() -> str:
    """Slide 2 (1080x1350, 4:5): Real Income Statement (P&L) (No green tags)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(80, 110)">
    <text x="0" y="0" class="display-hero" font-size="56" fill="#142B20" letter-spacing="-1.5">Income Statement (P&amp;L)</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Real statement export: Revenues, operating expenses, and net surplus.
    </text>
  </g>

  <!-- ================= REAL SCREENSHOT CONTAINER 1 (PDF Statement) ================= -->
  <g transform="translate(80, 205)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="920" height="280" rx="22" fill="#FFFDF9" stroke="#D1DDD5" stroke-width="2"/>
    <clipPath id="clipRealPdfPnl45">
      <rect x="15" y="15" width="890" height="250" rx="12"/>
    </clipPath>
    <image href="data:image/png;base64,{b64_real_pdf_pnl}" x="15" y="15" width="890" height="250" clip-path="url(#clipRealPdfPnl45)" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- ================= REAL SCREENSHOT CONTAINER 2 (HTML Analytics Table) ================= -->
  <g transform="translate(80, 520)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="920" height="745" rx="26" fill="#141E18" stroke="#2AAB68" stroke-width="2"/>
    <clipPath id="clipRealHtmlPnl45">
      <rect x="90" y="25" width="740" height="695" rx="16"/>
    </clipPath>
    <image href="data:image/png;base64,{b64_html_pnl_clean}" x="90" y="25" width="740" height="695" clip-path="url(#clipRealHtmlPnl45)" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>
"""

def generate_slide_3_sofp() -> str:
    """Slide 3 (1080x1350, 4:5): Real Balance Sheet (SOFP) (No green tags)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(80, 110)">
    <text x="0" y="0" class="display-hero" font-size="56" fill="#142B20" letter-spacing="-1.5">Balance Sheet (SOFP)</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Real statement export: Assets vs. Liabilities and Owner's Equity.
    </text>
  </g>

  <!-- ================= REAL SCREENSHOT CONTAINER 1 (PDF Statement) ================= -->
  <g transform="translate(80, 205)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="920" height="280" rx="22" fill="#FFFDF9" stroke="#D1DDD5" stroke-width="2"/>
    <clipPath id="clipRealPdfSofp45">
      <rect x="15" y="15" width="890" height="250" rx="12"/>
    </clipPath>
    <image href="data:image/png;base64,{b64_real_pdf_sofp}" x="15" y="15" width="890" height="250" clip-path="url(#clipRealPdfSofp45)" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- ================= REAL SCREENSHOT CONTAINER 2 (HTML Analytics Table) ================= -->
  <g transform="translate(80, 520)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="920" height="745" rx="26" fill="#141E18" stroke="#2AAB68" stroke-width="2"/>
    <clipPath id="clipRealHtmlSofp45">
      <rect x="90" y="25" width="740" height="695" rx="16"/>
    </clipPath>
    <image href="data:image/png;base64,{b64_html_sofp_clean}" x="90" y="25" width="740" height="695" clip-path="url(#clipRealHtmlSofp45)" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>
"""

def generate_slide_4_html() -> str:
    """Slide 4 (1080x1350, 4:5): Real Interactive HTML Analytics report (No green tag)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(540, 130)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="56" fill="#142B20" letter-spacing="-1.5">Interactive HTML Analytics</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Cash flow bars, expense donut, and cumulative net worth trajectory.
    </text>
  </g>

  <!-- ================= REAL HTML CHARTS DASHBOARD SCREENSHOT ================= -->
  <g transform="translate(80, 240)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="920" height="620" rx="30" fill="#121B16" stroke="#2AAB68" stroke-width="2.5"/>
    
    <g transform="translate(30, 24)">
      <circle cx="12" cy="12" r="6" fill="#FF5F56"/>
      <circle cx="32" cy="12" r="6" fill="#FFBD2E"/>
      <circle cx="52" cy="12" r="6" fill="#27C93F"/>
      <text x="430" y="17" text-anchor="middle" class="body-bold" font-size="14" fill="#8EA396">Standalone Interactive Report (.html)</text>
    </g>

    <clipPath id="clipRealHtmlCharts45">
      <rect x="18" y="56" width="884" height="540" rx="18"/>
    </clipPath>
    <image href="data:image/png;base64,{b64_real_html_charts}" x="18" y="56" width="884" height="540" clip-path="url(#clipRealHtmlCharts45)" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- ================= 3 FEATURE PILLS AT BOTTOM ================= -->
  <g transform="translate(80, 900)">
    <g transform="translate(0, 0)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="920" height="90" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <circle cx="48" cy="45" r="22" fill="#EAF7EE"/>
      <path d="M40 52 V44 M48 52 V38 M56 52 V42" stroke="#2AAB68" stroke-width="3" stroke-linecap="round"/>
      <text x="86" y="40" class="display-hero" font-size="20" fill="#142B20">Monthly Cash Flow Comparison</text>
      <text x="86" y="65" class="body-med" font-size="15" fill="#5F7568">Interactive revenue vs. expense bars over time.</text>
    </g>

    <g transform="translate(0, 110)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="920" height="90" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <circle cx="48" cy="45" r="22" fill="#FFF4D6"/>
      <circle cx="48" cy="45" r="12" fill="none" stroke="#FAC438" stroke-width="4"/>
      <text x="86" y="40" class="display-hero" font-size="20" fill="#142B20">Expense Category Distribution</text>
      <text x="86" y="65" class="body-med" font-size="15" fill="#5F7568">Visual breakdown of food, rent, transport, and bills.</text>
    </g>

    <g transform="translate(0, 220)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="920" height="90" rx="24" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="1.8"/>
      <circle cx="48" cy="45" r="22" fill="#EAF7EE"/>
      <path d="M38 50 L45 42 L51 46 L58 38" fill="none" stroke="#2AAB68" stroke-width="2.5" stroke-linecap="round"/>
      <text x="86" y="40" class="display-hero" font-size="20" fill="#142B20">Net Worth Trajectory Curve</text>
      <text x="86" y="65" class="body-med" font-size="15" fill="#5F7568">Real-time cumulative wealth growth over time.</text>
    </g>
  </g>
</svg>
"""

def generate_slide_5_formats() -> str:
    """Slide 5 (1080x1350, 4:5): Real App Export Selection & Excel XLSX screens (No green tag)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
  {svg_defs()}

  <rect width="1080" height="1350" fill="url(#bgGrad)"/>
  <rect width="1080" height="1350" fill="url(#topGlow)"/>

  <!-- ================= HEADER (No green tag) ================= -->
  <g transform="translate(540, 130)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="56" fill="#142B20" letter-spacing="-1.5">5 Ways to Take Your Data</text>
    <text x="0" y="48" class="body-semi" font-size="23" fill="#475C50">
      Real export screens: PDF, Excel (.xlsx), HTML, CSV, and JSON backup.
    </text>
  </g>

  <!-- ================= REAL APP SCREENSHOT 1: FORMAT SELECTION (Clean No status bar) ================= -->
  <g transform="translate(80, 240)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="430" height="990" rx="30" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2.5"/>
    <clipPath id="clipRealFormats45Clean">
      <rect x="3" y="3" width="424" height="984" rx="27"/>
    </clipPath>
    <image href="data:image/jpeg;base64,{b64_real_formats}" x="3" y="3" width="424" height="984" clip-path="url(#clipRealFormats45Clean)" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- ================= REAL APP SCREENSHOT 2: XLSX PREVIEW (Clean No status bar) ================= -->
  <g transform="translate(570, 240)" filter="url(#previewShadow)">
    <rect x="0" y="0" width="430" height="990" rx="30" fill="#141E18" stroke="#2AAB68" stroke-width="2.5"/>
    <clipPath id="clipRealXlsx45Clean">
      <rect x="3" y="3" width="424" height="984" rx="27"/>
    </clipPath>
    <image href="data:image/jpeg;base64,{b64_real_xlsx}" x="3" y="3" width="424" height="984" clip-path="url(#clipRealXlsx45Clean)" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>
"""

def main():
    print("Rendering 100% REAL picture Instagram Export Feature carousel in 4:5 (No green tags)...")
    
    slides = [
        ("real_export_01_cover", generate_slide_1_cover()),
        ("real_export_02_income_statement", generate_slide_2_pnl()),
        ("real_export_03_balance_sheet", generate_slide_3_sofp()),
        ("real_export_04_html_charts", generate_slide_4_html()),
        ("real_export_05_formats", generate_slide_5_formats()),
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
        print(f"✓ Generated 4:5 REAL image slide (No green tags): {png_path.name}")
        
        if BRAIN_DIR.exists():
            shutil.copy(png_path, BRAIN_DIR / f"{name}.png")

    print(f"All {len(slides)} real-picture slides rendered in {OUT_DIR}/ and copied to {BRAIN_DIR}/")

if __name__ == "__main__":
    main()
