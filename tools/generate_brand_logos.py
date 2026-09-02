#!/usr/bin/env python3
"""Generate authentic 128x128 RGBA brand logos for recurring bills and subscriptions."""

import os
from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
MERCHANTS_DIR = ROOT / "assets" / "logos" / "merchants"
MERCHANTS_DIR.mkdir(parents=True, exist_ok=True)

LOGOS = {
    # 1. redONE (Telecom)
    "redone": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#E60000"/>
      <text x="14" y="78" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="34" fill="#FFFFFF" letter-spacing="-1">red</text>
      <rect x="70" y="44" width="46" height="42" rx="8" fill="#FFFFFF"/>
      <text x="73" y="77" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="28" fill="#E60000" letter-spacing="-0.5">ONE</text>
    </svg>
    """,

    # 2. Anytime Fitness
    "anytime_fitness": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#4B2882"/>
      <g transform="translate(18, 22) scale(0.72)">
        <path d="M78 22 C78 30 71 36 63 36 C55 36 48 30 48 22 C48 14 55 8 63 8 C71 8 78 14 78 22 Z" fill="#FFFFFF"/>
        <path d="M22 64 L48 48 L62 62 L44 112 L24 102 L38 68 Z" fill="#FFFFFF"/>
        <path d="M62 62 L82 46 L108 58 L98 76 L80 68 L68 98 L88 116 L76 128 L50 102 Z" fill="#FFFFFF"/>
        <circle cx="104" cy="98" r="6" fill="#A875E2"/>
      </g>
    </svg>
    """,

    # 3. Disney+ Hotstar
    "disney_hotstar": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <defs>
        <linearGradient id="disneyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0E1B38"/>
          <stop offset="100%" stop-color="#040914"/>
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#disneyGrad)"/>
      <path d="M38 34 C48 34 56 38 60 46 C64 54 62 66 54 72 C48 76 40 78 32 78 L32 34 Z M42 44 L42 68 C46 68 50 64 52 58 C54 52 52 46 48 44 C46 44 44 44 42 44 Z" fill="#FFFFFF"/>
      <path d="M24 30 Q44 22 72 32 Q96 42 104 62" fill="none" stroke="#1D8FFF" stroke-width="4" stroke-linecap="round"/>
      <polygon points="98,38 101,44 107,45 102,49 104,55 98,52 92,55 94,49 89,45 95,44" fill="#FFCC00"/>
      <text x="64" y="104" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="19" fill="#FFFFFF" letter-spacing="1">hotstar</text>
    </svg>
    """,

    # 4. Duolingo
    "duolingo": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#58CC02"/>
      <circle cx="44" cy="54" r="22" fill="#FFFFFF"/>
      <circle cx="84" cy="54" r="22" fill="#FFFFFF"/>
      <circle cx="48" cy="54" r="13" fill="#4B4B4B"/>
      <circle cx="80" cy="54" r="13" fill="#4B4B4B"/>
      <circle cx="51" cy="51" r="5" fill="#FFFFFF"/>
      <circle cx="83" cy="51" r="5" fill="#FFFFFF"/>
      <path d="M52 66 Q64 88 76 66 Z" fill="#FF9600"/>
      <path d="M30 32 Q44 30 52 38" fill="none" stroke="#46A302" stroke-width="5" stroke-linecap="round"/>
      <path d="M98 32 Q84 30 76 38" fill="none" stroke="#46A302" stroke-width="5" stroke-linecap="round"/>
    </svg>
    """,

    # 5. Maxis
    "maxis": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#00A859"/>
      <g transform="translate(24, 30)">
        <path d="M12 48 C12 28 28 14 48 14 C62 14 74 22 80 34" fill="none" stroke="#9BD634" stroke-width="9" stroke-linecap="round"/>
        <path d="M0 64 C0 36 22 14 50 14" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/>
        <circle cx="68" cy="54" r="8" fill="#FFFFFF"/>
      </g>
    </svg>
    """,

    # 6. CelcomDigi
    "celcomdigi": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#0072CE"/>
      <path d="M26 88 C26 50 56 30 88 28 C72 52 64 74 44 88 Z" fill="#FFCC00"/>
      <path d="M54 94 C76 86 94 66 102 38 C104 64 88 90 66 98 Z" fill="#00A9E0"/>
      <circle cx="42" cy="46" r="10" fill="#FFFFFF"/>
    </svg>
    """,

    # 7. Unifi
    "unifi": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#FF5E00"/>
      <g transform="translate(20, 24)">
        <path d="M44 10 C24 10 8 26 8 46 C8 66 24 74 44 74 C64 74 80 66 80 46" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
        <circle cx="44" cy="38" r="10" fill="#FFFFFF"/>
      </g>
    </svg>
    """,

    # 8. U Mobile
    "umobile": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#FF6A00"/>
      <text x="64" y="86" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="70" fill="#FFFFFF">U</text>
    </svg>
    """,

    # 9. Yes 5G
    "yes": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#E6007E"/>
      <text x="64" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="44" fill="#FFFFFF" letter-spacing="-1">yes</text>
      <text x="64" y="104" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF">5G</text>
    </svg>
    """,

    # 10. TNB (Tenaga Nasional)
    "tnb": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#003399"/>
      <path d="M64 24 C50 24 38 36 38 50 C38 60 44 68 50 74 L50 84 L78 84 L78 74 C84 68 90 60 90 50 C90 36 78 24 64 24 Z" fill="#ED1C24"/>
      <polygon points="66,32 54,54 64,54 62,72 76,48 66,48" fill="#FFD700"/>
      <text x="64" y="110" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="20" fill="#FFFFFF">TNB</text>
    </svg>
    """,

    # 11. Air Selangor
    "air_selangor": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#0096D6"/>
      <path d="M64 22 C64 22 40 54 40 72 C40 86 51 96 64 96 C77 96 88 86 88 72 C88 54 64 22 64 22 Z" fill="#FFFFFF"/>
      <path d="M48 76 Q64 64 80 76 Q64 88 48 76 Z" fill="#0096D6"/>
    </svg>
    """,

    # 12. Astro
    "astro": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#E6007E"/>
      <text x="64" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="36" fill="#FFFFFF" letter-spacing="-1">astro</text>
    </svg>
    """,

    # 13. Indah Water
    "indah_water": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#005B94"/>
      <text x="64" y="66" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="34" fill="#FFFFFF">IWK</text>
      <path d="M30 84 Q64 74 98 84 Q64 94 30 84 Z" fill="#29B6F6"/>
    </svg>
    """,

    # 14. Amazon Prime Video
    "prime_video": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#00A8E1"/>
      <text x="64" y="64" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="32" fill="#FFFFFF">prime</text>
      <path d="M36 78 Q64 96 92 80" fill="none" stroke="#FF9900" stroke-width="6" stroke-linecap="round"/>
      <path d="M88 74 L94 80 L86 86 Z" fill="#FF9900"/>
    </svg>
    """,

    # 15. HBO
    "hbo": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#000000"/>
      <text x="64" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="40" fill="#FFFFFF" letter-spacing="1">HBO</text>
      <circle cx="85" cy="65" r="7" fill="#000000"/>
      <circle cx="85" cy="65" r="3" fill="#FFFFFF"/>
    </svg>
    """,

    # 16. Canva
    "canva": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <defs>
        <linearGradient id="canvaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00C4CC"/>
          <stop offset="100%" stop-color="#7D2AE8"/>
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#canvaGrad)"/>
      <text x="64" y="86" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-weight="bold" font-style="italic" font-size="68" fill="#FFFFFF">C</text>
    </svg>
    """,

    # 17. Adobe
    "adobe": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#FA0F00"/>
      <polygon points="26,26 52,98 26,98" fill="#FFFFFF"/>
      <polygon points="102,26 76,98 102,98" fill="#FFFFFF"/>
      <polygon points="64,56 80,98 62,98 52,74" fill="#FFFFFF"/>
    </svg>
    """,

    # 18. GitHub
    "github": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#181717"/>
      <path d="M64 24 C41.9 24 24 41.9 24 64 C24 81.7 35.5 96.7 51.4 102 C53.4 102.4 54.1 101.1 54.1 100.1 C54.1 99.2 54.1 96.8 54.1 93.6 C43 96 40.6 88.6 40.6 88.6 C38.8 84 36.2 82.8 36.2 82.8 C32.6 80.3 36.5 80.4 36.5 80.4 C40.5 80.7 42.6 84.5 42.6 84.5 C46.1 90.6 51.9 88.8 54.2 87.8 C54.5 85.3 55.5 83.5 56.7 82.5 C47.8 81.5 38.5 78.1 38.5 62.8 C38.5 58.4 40.1 54.8 42.6 52 C42.2 51 40.8 46.9 43 41.4 C43 41.4 46.4 40.3 54.1 45.5 C57.3 44.6 60.7 44.2 64.1 44.2 C67.5 44.2 70.9 44.6 74.1 45.5 C81.8 40.3 85.2 41.4 85.2 41.4 C87.4 46.9 86 51 85.6 52 C88.2 54.8 89.7 58.4 89.7 62.8 C89.7 78.2 80.3 81.5 71.4 82.5 C72.8 83.7 74.1 86.2 74.1 90 C74.1 95.5 74 99.9 74 100.1 C74 101.1 74.7 102.4 76.8 102 C92.7 96.7 104.1 81.7 104.1 64 C104.1 41.9 86.1 24 64 24 Z" fill="#FFFFFF"/>
    </svg>
    """,

    # 19. Microsoft
    "microsoft": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#F2F4F7"/>
      <g transform="translate(30, 30)">
        <rect x="0" y="0" width="31" height="31" fill="#F25022"/>
        <rect x="37" y="0" width="31" height="31" fill="#7FBA00"/>
        <rect x="0" y="37" width="31" height="31" fill="#00A4EF"/>
        <rect x="37" y="37" width="31" height="31" fill="#FFB900"/>
      </g>
    </svg>
    """,

    # 20. Notion
    "notion": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#000000"/>
      <g transform="translate(32, 28) scale(0.9)">
        <path d="M10 12 L54 6 L64 16 L64 68 L50 72 L16 70 L6 62 Z" fill="#FFFFFF"/>
        <path d="M22 22 L48 18 L52 24 L52 62 L42 64 L24 38 L24 60 L14 62 L14 24 Z" fill="#000000"/>
      </g>
    </svg>
    """,

    # 21. PlayStation
    "playstation": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#003791"/>
      <g transform="translate(24, 30) scale(0.62)">
        <path d="M48 18 L48 106 L66 98 L66 40 C74 42 80 48 80 56 C80 66 72 70 66 70 L66 84 C82 84 96 74 96 56 C96 38 82 22 48 18 Z" fill="#FFFFFF"/>
        <path d="M40 96 C24 92 12 84 12 76 C12 68 22 62 38 60 L44 58 L44 72 L36 74 C28 76 26 80 26 82 C26 86 32 88 40 90 Z" fill="#00A9E0"/>
        <path d="M48 106 C64 110 88 110 108 104 C116 102 120 98 120 94 C120 88 110 86 96 86 L88 86 L88 72 L98 72 C116 72 134 78 134 94 C134 108 112 118 84 118 C64 118 48 114 48 106 Z" fill="#DF0024"/>
      </g>
    </svg>
    """,

    # 22. Fitness First
    "fitness_first": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#E60000"/>
      <g transform="translate(30, 24)">
        <text x="0" y="54" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="62" fill="#FFFFFF">F</text>
        <text x="36" y="74" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="44" fill="#FFFFFF">1</text>
      </g>
    </svg>
    """,

    # 23. AIA
    "aia": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#D31145"/>
      <g transform="translate(24, 30)">
        <path d="M40 8 L10 68 L70 68 Z" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
        <path d="M40 28 L24 62 L56 62 Z" fill="#FFFFFF"/>
        <text x="40" y="86" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="20" fill="#FFFFFF">AIA</text>
      </g>
    </svg>
    """,

    # 24. Great Eastern
    "great_eastern": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#E60000"/>
      <g transform="translate(24, 22)">
        <path d="M40 10 L68 20 L68 50 C68 68 40 82 40 82 C40 82 12 68 12 50 L12 20 Z" fill="#FFFFFF"/>
        <text x="40" y="56" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="26" fill="#E60000">GE</text>
      </g>
    </svg>
    """,

    # 25. Prudential
    "prudential": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#ED1B2D"/>
      <g transform="translate(24, 24)">
        <circle cx="40" cy="40" r="30" fill="none" stroke="#FFFFFF" stroke-width="6"/>
        <text x="40" y="48" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="30" fill="#FFFFFF">PRU</text>
      </g>
    </svg>
    """,

    # 26. Allianz
    "allianz": """
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#003780"/>
      <g transform="translate(28, 30)">
        <circle cx="36" cy="34" r="30" fill="none" stroke="#FFFFFF" stroke-width="7"/>
        <line x1="26" y1="20" x2="26" y2="48" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
        <line x1="36" y1="16" x2="36" y2="52" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
        <line x1="46" y1="20" x2="46" y2="48" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
      </g>
    </svg>
    """,
}

def main():
    print(f"Generating {len(LOGOS)} brand logos into {MERCHANTS_DIR}...")
    for key, svg_code in LOGOS.items():
        png_path = MERCHANTS_DIR / f"{key}.png"
        cairosvg.svg2png(
            bytestring=svg_code.strip().encode("utf-8"),
            write_to=str(png_path),
            output_width=128,
            output_height=128,
        )
        print(f"✓ {png_path.name}")

if __name__ == "__main__":
    main()
