#!/usr/bin/env python3
"""Render 4:5 aspect ratio (1080x1350) Instagram post slides for Pip Launch.

Slide 1:
- Title: "Introducing Pip"
- Large hero Pip mascot in the center
- Tagline: "Know your money."
- Subtext: "Without typing it in. Without anyone else seeing it." in grey (#7A8B80)

Slide 2 (Founder Mission):
- Title: "Why We Built Pip"
- Purpose: "To raise financial awareness among young Malaysian adults."
- Total Visibility: Manage all your finances in one place (Assets, Investments, Liabilities)
- Ultimate Goal: "To achieve true financial literacy and lifelong financial freedom."
"""

import base64
import shutil
from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "InstagramPost"
OUT_DIR.mkdir(parents=True, exist_ok=True)
FONTS_DIR = ROOT / "node_modules" / "@expo-google-fonts"
BRAIN_DIR = Path("/home/yang/.gemini/antigravity/brain/97d8fe2d-cca2-48c1-9339-e21fc7e96f46")

def get_font_base64(ttf_path: Path) -> str:
    if not ttf_path.exists():
        raise FileNotFoundError(f"Font file not found: {ttf_path}")
    return base64.b64encode(ttf_path.read_bytes()).decode("ascii")

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

def generate_slide_1_svg() -> str:
    """Slide 1 (1080x1350, 4:5): Ultra-minimal Introducing Pip."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    
    <linearGradient id="bgGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F4FAF6"/>
      <stop offset="50%" stop-color="#EAF5EE"/>
      <stop offset="100%" stop-color="#DEF0E5"/>
    </linearGradient>

    <radialGradient id="sunburstGlow1" cx="50%" cy="46%" r="50%">
      <stop offset="0%" stop-color="#FFD666" stop-opacity="0.48"/>
      <stop offset="55%" stop-color="#2AAB68" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#DEF0E5" stop-opacity="0"/>
    </radialGradient>

    <filter id="mascotShadow1" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="32" stdDeviation="36" flood-color="#FAC438" flood-opacity="0.45"/>
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#142B20" flood-opacity="0.14"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="1080" height="1350" fill="url(#bgGrad1)"/>
  <rect width="1080" height="1350" fill="url(#sunburstGlow1)"/>

  <!-- Orbit Rings -->
  <g opacity="0.35">
    <circle cx="540" cy="620" r="380" stroke="#2AAB68" stroke-width="2" stroke-dasharray="12 16" opacity="0.35"/>
    <circle cx="540" cy="620" r="500" stroke="#FAC438" stroke-width="1.5" stroke-dasharray="8 20" opacity="0.30"/>
  </g>

  <!-- Sparkles -->
  <g fill="#FAC438">
    <path d="M160 220 Q160 240 140 240 Q160 240 160 260 Q160 240 180 240 Q160 240 160 220 Z" opacity="0.85"/>
    <path d="M920 240 Q920 258 902 258 Q920 258 920 276 Q920 258 938 258 Q920 258 920 240 Z" opacity="0.85"/>
    <path d="M180 960 Q180 974 166 974 Q180 974 180 988 Q180 974 194 974 Q180 974 180 960 Z" opacity="0.65"/>
    <path d="M900 940 Q900 956 884 956 Q900 956 900 972 Q900 956 916 956 Q900 956 900 940 Z" opacity="0.7"/>
  </g>

  <!-- ================= MAIN TITLE ================= -->
  <g transform="translate(540, 210)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="76" fill="#142B20" letter-spacing="-2">Introducing Pip</text>
  </g>

  <!-- ================= CENTER HERO MASCOT ================= -->
  <g transform="translate(540, 620) scale(6.2)" filter="url(#mascotShadow1)">
    <g transform="translate(-50, -56)">
      <!-- Shadow -->
      <ellipse cx="50" cy="92" rx="25" ry="5.5" fill="rgba(20,43,32,0.18)"/>

      <!-- Sprout -->
      <path d="M50 26 C50 18 50 13 50 11" stroke="#185e3e" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <ellipse cx="41" cy="14" rx="8.5" ry="4.8" fill="#1c7a4e" transform="rotate(-32 41 14)"/>
      <ellipse cx="59" cy="12" rx="9.5" ry="5.2" fill="#2aab68" transform="rotate(28 59 12)"/>

      <!-- Golden Coin Body -->
      <circle cx="50" cy="56" r="34" fill="#F5B42A"/>
      <circle cx="50" cy="56" r="27.5" fill="#FAC438"/>
      <circle cx="50" cy="56" r="27.5" fill="none" stroke="#D99E18" stroke-width="2.8"/>
      <circle cx="50" cy="56" r="22.5" fill="none" stroke="#D99E18" stroke-width="1.2" stroke-dasharray="2 3.5"/>

      <!-- Light gloss reflection -->
      <ellipse cx="34" cy="41" rx="9.5" ry="5.5" fill="rgba(255,255,255,0.32)" transform="rotate(-28 34 41)"/>

      <!-- Rosy Blush Cheeks -->
      <ellipse cx="31" cy="60.5" rx="6.0" ry="3.8" fill="#F07828" opacity="0.45"/>
      <ellipse cx="69" cy="60.5" rx="6.0" ry="3.8" fill="#F07828" opacity="0.45"/>

      <!-- Expressive Eyes -->
      <g fill="#7A4800">
        <circle cx="40" cy="53.5" r="4.4"/>
        <circle cx="41.8" cy="51.8" r="1.5" fill="#FFFFFF"/>
        <circle cx="60" cy="53.5" r="4.4"/>
        <circle cx="61.8" cy="51.8" r="1.5" fill="#FFFFFF"/>
      </g>

      <!-- Joyful Smirk Mouth -->
      <path d="M39 63 Q50 76 61 63 Q50 69 39 63 Z" fill="#7A4800"/>
    </g>
  </g>

  <!-- ================= MINIMAL TAGLINE ================= -->
  <g transform="translate(540, 1140)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="64" fill="#142B20" letter-spacing="-1.2">“Know your money.”</text>
    <text x="0" y="58" class="body-semi" font-size="26" fill="#7A8B80">Without typing it in. Without anyone else seeing it.</text>
  </g>
</svg>
"""

def generate_slide_2_svg() -> str:
    """Slide 2 (1080x1350, 4:5): Founder Mission Statement (No green tag)."""
    return f"""<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F4FAF6"/>
      <stop offset="50%" stop-color="#EAF5EE"/>
      <stop offset="100%" stop-color="#DEF0E5"/>
    </linearGradient>

    <radialGradient id="topAura2" cx="50%" cy="30%" r="55%">
      <stop offset="0%" stop-color="#FFD666" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#2AAB68" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#DEF0E5" stop-opacity="0"/>
    </radialGradient>

    <filter id="softShadow2" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#142B20" flood-opacity="0.08"/>
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#142B20" flood-opacity="0.04"/>
    </filter>
  </defs>

  <rect width="1080" height="1350" fill="url(#bgGrad2)"/>
  <rect width="1080" height="1350" fill="url(#topAura2)"/>

  <!-- Accents -->
  <g opacity="0.3">
    <circle cx="540" cy="675" r="480" stroke="#2AAB68" stroke-width="1.8" stroke-dasharray="12 16"/>
  </g>

  <!-- ================= TITLE (No green eyebrow tag) ================= -->
  <g transform="translate(540, 175)" text-anchor="middle">
    <text x="0" y="0" class="display-hero" font-size="70" fill="#142B20" letter-spacing="-2">Why We Built Pip</text>
  </g>

  <!-- ================= HERO MISSION CARD (4:5 Tall Portrait) ================= -->
  <g transform="translate(80, 270)" filter="url(#softShadow2)">
    <rect x="0" y="0" width="920" height="960" rx="36" fill="#FFFDF9" stroke="#E2EBE5" stroke-width="2"/>
    
    <g transform="translate(56, 75)">

      <!-- SECTION 1: Purpose -->
      <g transform="translate(0, 0)">
        <text x="0" y="0" class="body-extra" font-size="18" fill="#2AAB68" letter-spacing="1.5">PURPOSE</text>
        <text x="0" y="48" class="display-hero" font-size="38" fill="#142B20" letter-spacing="-0.8">
          <tspan x="0" dy="0">To raise financial awareness</tspan>
          <tspan x="0" dy="52" fill="#185E3E">among young Malaysian adults.</tspan>
        </text>
      </g>

      <!-- Divider -->
      <line x1="0" y1="210" x2="808" y2="210" stroke="#EAEFEA" stroke-width="1.8"/>

      <!-- SECTION 2: Total Visibility -->
      <g transform="translate(0, 265)">
        <text x="0" y="0" class="body-extra" font-size="18" fill="#2AAB68" letter-spacing="1.5">TOTAL VISIBILITY</text>
        <text x="0" y="44" class="body-bold" font-size="28" fill="#142B20">
          Manage all your finances in one place:
        </text>

        <!-- 3 Feature Badges Stacked/Horizontal -->
        <g transform="translate(0, 80)">
          <!-- Assets -->
          <g transform="translate(0, 0)">
            <rect x="0" y="0" width="250" height="66" rx="20" fill="#EAF7EE" stroke="#C5E3CE" stroke-width="1.5"/>
            <circle cx="36" cy="33" r="15" fill="#2AAB68"/>
            <text x="36" y="39" text-anchor="middle" class="body-bold" font-size="16" fill="#FFF">RM</text>
            <text x="64" y="42" class="display-hero" font-size="22" fill="#142B20">Assets</text>
          </g>

          <!-- Investments -->
          <g transform="translate(275, 0)">
            <rect x="0" y="0" width="265" height="66" rx="20" fill="#FFF4D6" stroke="#F0DC9B" stroke-width="1.5"/>
            <circle cx="36" cy="33" r="15" fill="#FAC438"/>
            <path d="M28 37 L34 31 L38 34 L44 27" fill="none" stroke="#7A4800" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="64" y="42" class="display-hero" font-size="22" fill="#142B20">Investments</text>
          </g>

          <!-- Liabilities -->
          <g transform="translate(565, 0)">
            <rect x="0" y="0" width="243" height="66" rx="20" fill="#FFE8E3" stroke="#F5C4BA" stroke-width="1.5"/>
            <circle cx="36" cy="33" r="15" fill="#FF8B6A"/>
            <path d="M30 33 H42" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>
            <text x="64" y="42" class="display-hero" font-size="22" fill="#142B20">Liabilities</text>
          </g>
        </g>
      </g>

      <!-- Divider -->
      <line x1="0" y1="480" x2="808" y2="480" stroke="#EAEFEA" stroke-width="1.8"/>

      <!-- SECTION 3: The Ultimate Goal -->
      <g transform="translate(0, 535)">
        <text x="0" y="0" class="body-extra" font-size="18" fill="#2AAB68" letter-spacing="1.5">THE ULTIMATE GOAL</text>
        <text x="0" y="48" class="display-hero" font-size="38" fill="#142B20" letter-spacing="-0.5">
          <tspan x="0" dy="0">To achieve true financial literacy</tspan>
          <tspan x="0" dy="52" fill="#185E3E">and lifelong financial freedom.</tspan>
        </text>
      </g>

    </g>
  </g>
</svg>
"""

def main():
    print("Rendering 4:5 (1080x1350) Instagram Post graphics for Pip Launch (No green tags)...")
    
    # 1. Slide 1
    svg1 = generate_slide_1_svg()
    svg1_path = OUT_DIR / "01_introducing_pip.svg"
    png1_path = OUT_DIR / "01_introducing_pip.png"
    svg1_path.write_text(svg1, encoding="utf-8")
    
    cairosvg.svg2png(
        bytestring=svg1.encode("utf-8"),
        write_to=str(png1_path),
        output_width=1080,
        output_height=1350
    )
    print(f"✓ Generated 4:5 slide: {png1_path}")

    # 2. Slide 2
    svg2 = generate_slide_2_svg()
    svg2_path = OUT_DIR / "02_mission_of_pip.svg"
    png2_path = OUT_DIR / "02_mission_of_pip.png"
    svg2_path.write_text(svg2, encoding="utf-8")
    
    cairosvg.svg2png(
        bytestring=svg2.encode("utf-8"),
        write_to=str(png2_path),
        output_width=1080,
        output_height=1350
    )
    print(f"✓ Generated 4:5 slide: {png2_path}")

    # Copy to Brain Artifact dir
    if BRAIN_DIR.exists():
        shutil.copy(png1_path, BRAIN_DIR / "01_introducing_pip.png")
        shutil.copy(png2_path, BRAIN_DIR / "02_mission_of_pip.png")
        print(f"✓ Copied 4:5 images to artifact directory: {BRAIN_DIR}")

if __name__ == "__main__":
    main()
