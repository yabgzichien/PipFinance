#!/usr/bin/env python3
"""Reusable helper module for creating Pip Finance Instagram 4:5 carousel slides.
"""

import base64
import io
import shutil
from pathlib import Path
from PIL import Image
import cairosvg

ROOT = Path(__file__).resolve().parents[4]  # PipFinance repo root
FONTS_DIR = ROOT / "node_modules" / "@expo-google-fonts"

def get_font_base64(ttf_path: Path) -> str:
    if not ttf_path.exists():
        raise FileNotFoundError(f"Font file not found: {ttf_path}")
    return base64.b64encode(ttf_path.read_bytes()).decode("ascii")

def image_to_base64(im: Image.Image, format: str = "PNG") -> str:
    buf = io.BytesIO()
    im.save(buf, format=format)
    return base64.b64encode(buf.getvalue()).decode("ascii")

def crop_phone_screenshot(path: Path) -> Image.Image:
    """Crop out the status bar (y=52) and Android navigation bar (y=995)."""
    im = Image.open(path)
    w, h = im.size
    return im.crop((0, 52, w, min(h, 995)))

def get_fonts_css() -> str:
    font_space_700 = get_font_base64(FONTS_DIR / "space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf")
    font_space_500 = get_font_base64(FONTS_DIR / "space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf")
    font_hanken_800 = get_font_base64(FONTS_DIR / "hanken-grotesk/800ExtraBold/HankenGrotesk_800ExtraBold.ttf")
    font_hanken_700 = get_font_base64(FONTS_DIR / "hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf")
    font_hanken_600 = get_font_base64(FONTS_DIR / "hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf")
    font_hanken_500 = get_font_base64(FONTS_DIR / "hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf")
    font_hanken_400 = get_font_base64(FONTS_DIR / "hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf")

    return f"""
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

def render_slide_svg_to_png(svg_content: str, out_png: Path, artifact_dir: Path = None):
    out_png.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(
        bytestring=svg_content.encode("utf-8"),
        write_to=str(out_png),
        output_width=1080,
        output_height=1350
    )
    if artifact_dir and artifact_dir.exists():
        shutil.copy(out_png, artifact_dir / out_png.name)
