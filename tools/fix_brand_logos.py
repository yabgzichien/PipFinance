#!/usr/bin/env python3
"""Re-render improved logos for the 5 brands that didn't look right."""

from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "assets" / "logos" / "merchants"
OUT.mkdir(parents=True, exist_ok=True)

LOGOS = {

    # OpenAI / ChatGPT – 5-circle pentagon blossom (the real OpenAI mark silhouette)
    "openai": """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="#000000"/>
  <g transform="translate(64,64)" fill="none" stroke="#FFFFFF" stroke-width="5.5">
    <circle cx="0"     cy="-25"  r="21"/>
    <circle cx="23.8"  cy="-7.7" r="21"/>
    <circle cx="14.7"  cy="20.2" r="21"/>
    <circle cx="-14.7" cy="20.2" r="21"/>
    <circle cx="-23.8" cy="-7.7" r="21"/>
    <circle cx="0" cy="0" r="9"/>
  </g>
</svg>
""",

    # Adobe – correct "A" mark: two diagonal strokes, crossbar, inner triangle cutout
    "adobe": """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="#FA0F00"/>
  <polygon points="64,16 46,16 14,108 40,108" fill="#FFFFFF"/>
  <polygon points="64,16 82,16 114,108 88,108" fill="#FFFFFF"/>
  <rect x="36" y="69" width="56" height="13" fill="#FFFFFF"/>
  <polygon points="64,32 80,69 48,69" fill="#FA0F00"/>
</svg>
""",

    # CelcomDigi – bold yellow "D" letterform on brand blue
    "celcomdigi": """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="#0033A0"/>
  <path d="M30 22 L30 106 L62 106 C90 106 104 88 104 64 C104 40 90 22 62 22 Z" fill="#FFD100"/>
  <path d="M48 40 L48 88 L60 88 C76 88 84 78 84 64 C84 50 76 40 60 40 Z" fill="#0033A0"/>
</svg>
""",

    # Great Eastern – white pointed shield with red inner field and white "GE" monogram
    "great_eastern": """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="#C8102E"/>
  <path d="M64 18 L98 32 L98 68 C98 90 80 106 64 114 C48 106 30 90 30 68 L30 32 Z" fill="#FFFFFF"/>
  <path d="M64 30 L90 42 L90 68 C90 86 76 100 64 108 C52 100 38 86 38 68 L38 42 Z" fill="#C8102E"/>
  <text x="64" y="84" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-weight="bold" font-size="34" fill="#FFFFFF">GE</text>
</svg>
""",

    # Disney+ Hotstar – dark navy gradient, white hollow-D, blue "+", gold "hotstar"
    "disney_hotstar": """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="dhg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#1B2A6B"/>
      <stop offset="100%" stop-color="#09091F"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#dhg)"/>
  <path d="M20 20 L20 84 L52 84 C78 84 92 68 92 52 C92 36 78 20 52 20 Z" fill="#FFFFFF"/>
  <path d="M32 32 L32 72 L50 72 C68 72 78 64 78 52 C78 40 68 32 50 32 Z" fill="#09091F"/>
  <rect x="97"  y="22" width="8"  height="32" rx="4" fill="#1E8FFF"/>
  <rect x="88"  y="31" width="26" height="8"  rx="4" fill="#1E8FFF"/>
  <text x="64" y="110" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="15" fill="#FFD700" letter-spacing="0.8">hotstar</text>
</svg>
""",
}

if __name__ == "__main__":
    print(f"Regenerating {len(LOGOS)} improved logos -> {OUT}")
    for key, svg in LOGOS.items():
        path = OUT / f"{key}.png"
        cairosvg.svg2png(
            bytestring=svg.strip().encode("utf-8"),
            write_to=str(path),
            output_width=128,
            output_height=128,
        )
        print(f"  OK  {key}.png")
    print("Done.")
