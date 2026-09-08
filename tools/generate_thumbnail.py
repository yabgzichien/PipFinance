#!/usr/bin/env python3
"""Generate 3:2 aspect ratio (1800x1200) JPG project thumbnail for Pip.
Uses the official Pip default logo specifications.
"""

from pathlib import Path
import cairosvg
from PIL import Image

PROJECT_ROOT = Path("/home/yang/Project/PipFinance")
ASSETS_DIR = PROJECT_ROOT / "assets"
ARTIFACTS_DIR = Path("/home/yang/.gemini/antigravity/brain/ffb30cb5-0738-44f0-adc0-d4808f7b135e")

def make_mascot_svg_content():
    return """
  <!-- Soft Grounding Shadow -->
  <ellipse cx="50" cy="92" rx="24" ry="5.5" fill="rgba(12, 34, 22, 0.28)" filter="url(#shadowBlur)" />
  
  <!-- Sprout Stem & Leaves -->
  <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3.2" fill="none" stroke-linecap="round" />
  <ellipse cx="42" cy="15" rx="7.5" ry="4.2" fill="#1c7a4e" transform="rotate(-32 42 15)" />
  <ellipse cx="58" cy="13" rx="8.5" ry="4.6" fill="#2aab68" transform="rotate(28 58 13)" />
  
  <!-- Coin Outer Rim & Face -->
  <circle cx="50" cy="56" r="33" fill="#F5B42A" />
  <circle cx="50" cy="56" r="26.6" fill="#FAC438" />
  <circle cx="50" cy="56" r="26.6" fill="none" stroke="#D99E18" stroke-width="2.6" />
  
  <!-- Coin Specular Highlight -->
  <ellipse cx="35" cy="42" rx="8.5" ry="4.9" fill="rgba(255,255,255,0.25)" transform="rotate(-26 35 42)" />
  
  <!-- Rosy Blush Cheeks -->
  <ellipse cx="32" cy="60.3" rx="5.3" ry="3.4" fill="#F07828" opacity="0.32" />
  <ellipse cx="68" cy="60.3" rx="5.3" ry="3.4" fill="#F07828" opacity="0.32" />
  
  <!-- Eyes -->
  <circle cx="40" cy="55" r="4.2" fill="#7A4800" />
  <circle cx="41.5" cy="53.5" r="1.3" fill="#ffffff" />
  <circle cx="60" cy="55" r="4.2" fill="#7A4800" />
  <circle cx="61.5" cy="53.5" r="1.3" fill="#ffffff" />
  
  <!-- Joyful Smile -->
  <path d="M43 64 Q50 71 57 64" fill="none" stroke="#7A4800" stroke-width="3.2" stroke-linecap="round" />
"""

def generate_solid_thumbnail(w=1800, h=1200, scale=9.2):
    """Primary: Solid signature brand green (#1f8a5b) with centered Pip mascot."""
    svg = f"""<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadowBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.2" />
    </filter>
  </defs>
  <!-- Exact Default App Icon Background Green -->
  <rect width="{w}" height="{h}" fill="#1f8a5b" />
  <g transform="translate({w/2}, {h/2}) scale({scale}) translate(-50, -53)">
    {make_mascot_svg_content()}
  </g>
</svg>"""
    return svg

def generate_ambient_thumbnail(w=1800, h=1200, scale=9.2):
    """Variant: Brand green with soft ambient depth & gold glow."""
    svg = f"""<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadowBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.2" />
    </filter>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#28a970" />
      <stop offset="55%" stop-color="#1f8a5b" />
      <stop offset="100%" stop-color="#186b46" />
    </radialGradient>
    <radialGradient id="goldGlow" cx="50%" cy="50%" r="42%">
      <stop offset="0%" stop-color="#FFD666" stop-opacity="0.22" />
      <stop offset="60%" stop-color="#FFD666" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#FFD666" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#bgGrad)" />
  <circle cx="{w/2}" cy="{h/2}" r="450" fill="url(#goldGlow)" />
  <g transform="translate({w/2}, {h/2}) scale({scale}) translate(-50, -53)">
    {make_mascot_svg_content()}
  </g>
</svg>"""
    return svg

def main():
    targets = [
        ("thumbnail.jpg", generate_solid_thumbnail),
        ("thumbnail_ambient.jpg", generate_ambient_thumbnail),
    ]

    for filename, gen_fn in targets:
        svg_str = gen_fn(1800, 1200)
        temp_png = f"/tmp/{filename}.png"
        cairosvg.svg2png(bytestring=svg_str.encode("utf-8"), write_to=temp_png, output_width=1800, output_height=1200)
        img = Image.open(temp_png).convert("RGB")

        # 1. Save to project root
        root_path = PROJECT_ROOT / filename
        img.save(root_path, "JPEG", quality=95, optimize=True)

        # 2. Save to assets/
        assets_path = ASSETS_DIR / filename
        img.save(assets_path, "JPEG", quality=95, optimize=True)

        # 3. Save to artifacts dir
        art_path = ARTIFACTS_DIR / filename
        img.save(art_path, "JPEG", quality=95, optimize=True)

        print(f"Exported {filename}:")
        print(f"  - {root_path} ({root_path.stat().st_size / 1024:.1f} KB)")
        print(f"  - {assets_path}")
        print(f"  - {art_path}")

if __name__ == "__main__":
    main()
