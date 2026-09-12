import os

with open('/tmp/sig_emerald.txt') as f:
    b64_emerald = f.read().strip()
with open('/tmp/sig_gold.txt') as f:
    b64_gold = f.read().strip()
with open('/tmp/sig_white.txt') as f:
    b64_white = f.read().strip()

html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PipSavings — Certificate of Appreciation (Classic Prestige)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Archivo:wght@700;800;900&family=Bodoni+Moda:ital,opsz,wght@0,6..96,600;0,6..96,700;0,6..96,800;1,6..96,600;1,6..96,700&family=Cinzel:wght@600;700;800;900&family=Cinzel+Decorative:wght@700;900&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,600;1,700&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=EB+Garamond:ital,wght@0,600;0,700;0,800;1,500;1,700&family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,600;1,9..144,700&family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800;900&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600;1,700&family=Plus+Jakarta+Sans:wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Space+Grotesk:wght@500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@700;800&display=swap" rel="stylesheet">

  <style>
    :root {{
      --brand-green: #1f8a5b;
      --brand-mint: #2aab68;
      --brand-forest: #142b20;
      --brand-deep: #06110a;
      --brand-gold: #fac438;
      --brand-gold-rim: #f5b42a;
      
      --ui-bg: #0b110e;
      --ui-surface: #141f18;
      --ui-border: rgba(255, 255, 255, 0.08);
      --ui-text: #eaf3ee;
      --ui-text-muted: #889990;

      --cert-width: 1120px;
      --cert-height: 792px;
    }}

    *, *::before, *::after {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      background-color: var(--ui-bg);
      color: var(--ui-text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }}

    /* Standalone / capture mode */
    body.standalone {{
      background: transparent !important;
      min-height: auto !important;
      overflow: hidden !important;
    }}
    body.standalone .studio-header,
    body.standalone .customizer-bar,
    body.standalone .meta-bar {{
      display: none !important;
    }}
    body.standalone .stage-container {{
      padding: 0 !important;
      margin: 0 !important;
      background: transparent !important;
    }}
    body.standalone .cert-viewport {{
      width: 1120px !important;
      height: 792px !important;
    }}
    body.standalone .certificate-card {{
      border-radius: 0 !important;
      box-shadow: none !important;
    }}

    /* Studio Header */
    .studio-header {{
      background: rgba(11, 17, 14, 0.96);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--ui-border);
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 12px 24px;
    }}

    .header-inner {{
      max-width: 1540px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }}

    .brand-group {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .brand-icon-wrap {{
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: linear-gradient(135deg, #1f8a5b, #0d3b24);
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(31, 138, 91, 0.35);
    }}

    .brand-title h1 {{
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }}

    .brand-title p {{
      font-size: 11.5px;
      color: var(--ui-text-muted);
    }}

    /* Typography Navigation Tabs */
    .typo-nav {{
      display: flex;
      align-items: center;
      background: rgba(0, 0, 0, 0.45);
      padding: 3px;
      border-radius: 12px;
      border: 1px solid var(--ui-border);
      gap: 2px;
      overflow-x: auto;
      max-width: 820px;
    }}

    .tab-btn {{
      padding: 7px 11px;
      border-radius: 7px;
      background: transparent;
      border: none;
      color: var(--ui-text-muted);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
      white-space: nowrap;
    }}

    .tab-btn:hover {{
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }}

    .tab-btn.active {{
      background: var(--brand-green);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(31, 138, 91, 0.45);
    }}

    .tab-num {{
      font-size: 10px;
      opacity: 0.75;
      font-family: monospace;
    }}

    .header-actions {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 12.5px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 999px;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: all 0.2s ease;
    }}

    .btn-primary {{
      background: linear-gradient(135deg, #2aab68 0%, #1f8a5b 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(42, 171, 104, 0.35);
    }}
    .btn-primary:hover {{
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(42, 171, 104, 0.5);
    }}

    .btn-secondary {{
      background: rgba(255, 255, 255, 0.08);
      color: #eaf3ee;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }}
    .btn-secondary:hover {{
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }}

    /* Live Customizer Bar */
    .customizer-bar {{
      background: #111a14;
      border-bottom: 1px solid var(--ui-border);
      padding: 9px 24px;
    }}

    .customizer-inner {{
      max-width: 1540px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
      font-size: 12.5px;
    }}

    .field-group {{
      display: flex;
      align-items: center;
      gap: 7px;
    }}

    .field-group label {{
      color: var(--ui-text-muted);
      font-size: 12px;
      font-weight: 500;
    }}

    .field-group input {{
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--ui-border);
      padding: 5px 10px;
      border-radius: 6px;
      color: #fff;
      font-family: inherit;
      font-size: 12.5px;
      outline: none;
      transition: border-color 0.2s;
    }}
    .field-group input:focus {{
      border-color: var(--brand-mint);
    }}

    .sig-color-picker {{
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 10px;
      padding-left: 14px;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
    }}

    .sig-btn {{
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0,0,0,0.3);
      color: var(--ui-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
    }}
    .sig-btn.active {{
      border-color: #fff;
      color: #fff;
      background: rgba(255, 255, 255, 0.12);
    }}
    .sig-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }}

    .preset-pills {{
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
    }}
    .preset-pills span {{
      font-size: 11px;
      color: var(--ui-text-muted);
    }}
    .pill {{
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 11px;
      color: #ccd7d0;
      cursor: pointer;
      transition: all 0.15s;
    }}
    .pill:hover {{
      background: rgba(42, 171, 104, 0.2);
      border-color: var(--brand-mint);
      color: #fff;
    }}

    /* Stage */
    .stage-container {{
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 36px 20px 50px;
      background: radial-gradient(circle at 50% 15%, rgba(31, 138, 91, 0.1) 0%, transparent 65%), #090f0c;
    }}

    .meta-bar {{
      width: var(--cert-width);
      max-width: 100%;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
    }}

    .meta-left {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .meta-title {{
      font-weight: 700;
      color: #ffffff;
      font-size: 15px;
    }}
    .meta-tag {{
      font-size: 11px;
      background: rgba(42, 171, 104, 0.18);
      color: #4ade80;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      border: 1px solid rgba(74, 222, 128, 0.25);
    }}
    .meta-fonts {{
      font-size: 12px;
      color: var(--ui-text-muted);
    }}

    /* Viewport & Card */
    .cert-viewport {{
      width: var(--cert-width);
      height: var(--cert-height);
      position: relative;
    }}

    .certificate-card {{
      width: 100%;
      height: 100%;
      position: relative;
      box-shadow: 0 25px 65px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      overflow: hidden;
      user-select: none;
      background-color: #06110a;
      background-image: 
        radial-gradient(circle at 50% 25%, rgba(31, 138, 91, 0.28) 0%, transparent 65%),
        radial-gradient(circle at 15% 85%, rgba(42, 171, 104, 0.15) 0%, transparent 45%),
        radial-gradient(circle at 85% 85%, rgba(245, 180, 42, 0.08) 0%, transparent 45%),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 100% 100%, 32px 32px, 32px 32px;
      color: #eaf3ee;
      padding: 44px;
      display: flex;
      flex-direction: column;
    }}

    .card-outer-frame {{
      width: 100%;
      height: 100%;
      border: 1px solid rgba(250, 196, 56, 0.28);
      padding: 10px;
      position: relative;
      display: flex;
      flex-direction: column;
    }}

    .card-inner-frame {{
      width: 100%;
      height: 100%;
      border: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 44px 64px;
      background: rgba(9, 23, 15, 0.45);
      backdrop-filter: blur(8px);
    }}

    /* Corner Accents */
    .corner {{
      position: absolute;
      width: 22px;
      height: 22px;
      border-color: #f5b42a;
      border-style: solid;
      pointer-events: none;
    }}
    .c-tl {{ top: -2px; left: -2px; border-width: 2px 0 0 2px; }}
    .c-tr {{ top: -2px; right: -2px; border-width: 2px 2px 0 0; }}
    .c-bl {{ bottom: -2px; left: -2px; border-width: 0 0 2px 2px; }}
    .c-br {{ bottom: -2px; right: -2px; border-width: 0 2px 2px 0; }}

    /* Certificate Header: Ultra Clean Brand Only */
    .cert-header {{
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 20px;
    }}

    .cert-brand {{
      display: flex;
      align-items: center;
      gap: 13px;
    }}

    .cert-brand-name {{
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: #ffffff;
    }}

    /* Certificate Body */
    .cert-body {{
      text-align: center;
      margin: auto 0;
      padding: 6px 0;
    }}

    /* Header Title Group */
    .cert-title-group {{
      margin-bottom: 22px;
    }}

    .main-title {{
      font-size: 70px;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.5px;
      color: #ffffff;
      background: none;
      -webkit-background-clip: unset;
      -webkit-text-fill-color: #ffffff;
    }}

    .sub-title {{
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #fac438;
      margin-top: 6px;
    }}

    .intro-line {{
      font-size: 14.5px;
      color: #8fa096;
      margin-bottom: 10px;
    }}

    .recipient-hero {{
      font-size: 50px;
      font-weight: 700;
      line-height: 1.1;
      margin-bottom: 18px;
      color: #fac438;
      background: none;
      -webkit-background-clip: unset;
      background-clip: unset;
      -webkit-text-fill-color: #fac438;
      text-shadow: 0 0 24px rgba(250, 196, 56, 0.4), 0 2px 6px rgba(0, 0, 0, 0.5);
      display: inline-block;
    }}

    .citation-body {{
      max-width: 660px;
      margin: 0 auto;
      font-size: 15px;
      line-height: 1.65;
      color: #cbdad1;
    }}

    /* Footer */
    .cert-footer {{
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 22px;
    }}

    .foot-date-col {{
      text-align: left;
      min-width: 170px;
    }}

    .foot-date-lbl {{
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #728379;
      font-weight: 600;
      margin-bottom: 4px;
    }}

    .foot-date-val {{
      font-size: 15px;
      font-weight: 600;
      color: #eaf3ee;
    }}

    /* Signature Column */
    .foot-sign-col {{
      text-align: right;
      min-width: 180px;
    }}

    .sig-img-container {{
      height: 52px;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      margin-bottom: 4px;
    }}

    .sig-img {{
      height: 48px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 2px 6px rgba(42, 171, 104, 0.35));
      transition: filter 0.2s ease;
    }}

    .foot-sign-name {{
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
    }}

    .foot-sign-title {{
      font-size: 11.5px;
      color: #2aab68;
      font-weight: 500;
    }}

    /* ==========================================================================
       10 TYPOGRAPHY PRESETS
       ========================================================================== */
    
    /* Preset 1: Modern FinTech */
    .typo-1 .cert-brand-name {{ font-family: 'Space Grotesk', sans-serif; }}
    .typo-1 .main-title {{ font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -1.5px; font-size: 60px; }}
    .typo-1 .sub-title {{ font-family: 'Space Grotesk', sans-serif; font-weight: 600; letter-spacing: 5px; font-size: 16px; }}
    .typo-1 .intro-line {{ font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 400; }}
    .typo-1 .recipient-hero {{ font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -1px; font-size: 54px; }}
    .typo-1 .citation-body {{ font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 400; }}
    .typo-1 .foot-date-val, .typo-1 .foot-sign-name {{ font-family: 'Space Grotesk', sans-serif; }}

    /* Preset 2: Classic Prestige (Default Approved) */
    .typo-2 .cert-brand-name {{ font-family: 'Cinzel', serif; letter-spacing: 1.5px; text-transform: uppercase; font-size: 20px; }}
    .typo-2 .main-title {{ font-family: 'Cinzel', serif; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; font-size: 70px; line-height: 1.05; color: #ffffff; background: none; -webkit-background-clip: unset; -webkit-text-fill-color: #ffffff; }}
    .typo-2 .sub-title {{ font-family: 'Cinzel', serif; font-weight: 600; letter-spacing: 6px; font-size: 15px; margin-top: 6px; }}
    .typo-2 .intro-line {{ font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 17px; margin-bottom: 10px; }}
    .typo-2 .recipient-hero {{ font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 700; font-size: 50px; margin-bottom: 18px; }}
    .typo-2 .citation-body {{ font-family: 'Cormorant Garamond', serif; font-size: 17px; line-height: 1.6; }}
    .typo-2 .foot-date-lbl, .typo-2 .foot-sign-title {{ font-family: 'Cinzel', serif; letter-spacing: 1.5px; }}
    .typo-2 .foot-date-val, .typo-2 .foot-sign-name {{ font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: 1px; }}

    /* Preset 3: Editorial Elegance */
    .typo-3 .cert-brand-name {{ font-family: 'Space Grotesk', sans-serif; }}
    .typo-3 .main-title {{ font-family: 'Playfair Display', Georgia, serif; font-weight: 900; letter-spacing: -0.5px; font-size: 62px; }}
    .typo-3 .sub-title {{ font-family: 'Hanken Grotesk', sans-serif; font-weight: 600; letter-spacing: 6px; font-size: 14.5px; }}
    .typo-3 .intro-line {{ font-family: 'Hanken Grotesk', sans-serif; font-weight: 400; }}
    .typo-3 .recipient-hero {{ font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-weight: 700; font-size: 56px; }}
    .typo-3 .citation-body {{ font-family: 'Hanken Grotesk', sans-serif; font-size: 15px; }}
    .typo-3 .foot-date-val, .typo-3 .foot-sign-name {{ font-family: 'Hanken Grotesk', sans-serif; }}

    /* Preset 4: Swiss International */
    .typo-4 .cert-brand-name {{ font-family: 'Inter', sans-serif; font-weight: 700; }}
    .typo-4 .main-title {{ font-family: 'Inter', sans-serif; font-weight: 900; letter-spacing: -2px; font-size: 58px; }}
    .typo-4 .sub-title {{ font-family: 'Inter', sans-serif; font-weight: 700; letter-spacing: 4px; font-size: 14px; }}
    .typo-4 .intro-line {{ font-family: 'Inter', sans-serif; font-weight: 400; }}
    .typo-4 .recipient-hero {{ font-family: 'Inter', sans-serif; font-weight: 800; letter-spacing: -1.5px; font-size: 52px; }}
    .typo-4 .citation-body {{ font-family: 'Inter', sans-serif; font-weight: 400; font-size: 14.5px; }}
    .typo-4 .foot-date-val, .typo-4 .foot-sign-name {{ font-family: 'Inter', sans-serif; }}

    /* Preset 5: Academic Heritage */
    .typo-5 .cert-brand-name {{ font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.5px; }}
    .typo-5 .main-title {{ font-family: 'EB Garamond', serif; font-weight: 800; letter-spacing: 0.5px; font-size: 56px; }}
    .typo-5 .sub-title {{ font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 5px; font-size: 13.5px; }}
    .typo-5 .intro-line {{ font-family: 'EB Garamond', serif; font-style: italic; font-size: 16px; }}
    .typo-5 .recipient-hero {{ font-family: 'EB Garamond', serif; font-weight: 700; font-style: italic; font-size: 58px; }}
    .typo-5 .citation-body {{ font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 400; line-height: 1.7; }}
    .typo-5 .foot-date-val, .typo-5 .foot-sign-name {{ font-family: 'EB Garamond', serif; font-size: 17px; }}

    /* Preset 6: Cyber Mono Tech */
    .typo-6 .cert-brand-name {{ font-family: 'Syne', sans-serif; font-weight: 800; }}
    .typo-6 .main-title {{ font-family: 'Syne', sans-serif; font-weight: 800; letter-spacing: -1px; font-size: 56px; }}
    .typo-6 .sub-title {{ font-family: 'Space Mono', monospace; font-weight: 700; letter-spacing: 3px; font-size: 14px; }}
    .typo-6 .intro-line {{ font-family: 'Space Mono', monospace; font-size: 12.5px; }}
    .typo-6 .recipient-hero {{ font-family: 'Syne', sans-serif; font-weight: 700; letter-spacing: -0.5px; font-size: 52px; }}
    .typo-6 .citation-body {{ font-family: 'Space Mono', monospace; font-size: 13px; line-height: 1.7; }}
    .typo-6 .foot-date-val, .typo-6 .foot-sign-name {{ font-family: 'Space Mono', monospace; font-size: 13.5px; }}

    /* Preset 7: Haute Horlogerie */
    .typo-7 .cert-brand-name {{ font-family: 'Bodoni Moda', serif; font-weight: 700; }}
    .typo-7 .main-title {{ font-family: 'Bodoni Moda', serif; font-weight: 800; letter-spacing: 0.5px; font-size: 58px; }}
    .typo-7 .sub-title {{ font-family: 'Montserrat', sans-serif; font-weight: 500; letter-spacing: 6px; font-size: 14px; }}
    .typo-7 .intro-line {{ font-family: 'Bodoni Moda', serif; font-style: italic; font-size: 16px; }}
    .typo-7 .recipient-hero {{ font-family: 'Bodoni Moda', serif; font-style: italic; font-weight: 700; font-size: 56px; }}
    .typo-7 .citation-body {{ font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 400; }}
    .typo-7 .foot-date-val, .typo-7 .foot-sign-name {{ font-family: 'Bodoni Moda', serif; }}

    /* Preset 8: Modern Architectural */
    .typo-8 .cert-brand-name {{ font-family: 'Outfit', sans-serif; font-weight: 800; }}
    .typo-8 .main-title {{ font-family: 'Outfit', sans-serif; font-weight: 900; letter-spacing: -1.5px; font-size: 60px; }}
    .typo-8 .sub-title {{ font-family: 'Outfit', sans-serif; font-weight: 600; letter-spacing: 5px; font-size: 14px; }}
    .typo-8 .intro-line {{ font-family: 'Fraunces', serif; font-style: italic; font-size: 15px; }}
    .typo-8 .recipient-hero {{ font-family: 'Fraunces', serif; font-style: italic; font-weight: 700; font-size: 56px; }}
    .typo-8 .citation-body {{ font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 400; }}
    .typo-8 .foot-date-val, .typo-8 .foot-sign-name {{ font-family: 'Outfit', sans-serif; }}

    /* Preset 9: Royal Calligraphic */
    .typo-9 .cert-brand-name {{ font-family: 'Cinzel Decorative', serif; font-weight: 700; }}
    .typo-9 .main-title {{ font-family: 'Cinzel Decorative', serif; font-weight: 700; letter-spacing: 1px; font-size: 50px; }}
    .typo-9 .sub-title {{ font-family: 'Cinzel', serif; font-weight: 600; letter-spacing: 6px; font-size: 14px; }}
    .typo-9 .intro-line {{ font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 16px; }}
    .typo-9 .recipient-hero {{ font-family: 'Alex Brush', cursive; font-size: 70px; font-weight: 400; line-height: 1; }}
    .typo-9 .citation-body {{ font-family: 'Cormorant Garamond', serif; font-size: 17px; font-weight: 500; }}
    .typo-9 .foot-date-val, .typo-9 .foot-sign-name {{ font-family: 'Cinzel', serif; }}

    /* Preset 10: Neo-Brutalist Clean */
    .typo-10 .cert-brand-name {{ font-family: 'Archivo', sans-serif; font-weight: 900; }}
    .typo-10 .main-title {{ font-family: 'Archivo', sans-serif; font-weight: 900; letter-spacing: -2px; font-size: 58px; text-transform: uppercase; }}
    .typo-10 .sub-title {{ font-family: 'DM Sans', sans-serif; font-weight: 700; letter-spacing: 5px; font-size: 14px; }}
    .typo-10 .intro-line {{ font-family: 'DM Sans', sans-serif; font-weight: 400; }}
    .typo-10 .recipient-hero {{ font-family: 'Archivo', sans-serif; font-weight: 800; letter-spacing: -1px; font-size: 52px; }}
    .typo-10 .citation-body {{ font-family: 'DM Sans', sans-serif; font-size: 14.5px; font-weight: 400; }}
    .typo-10 .foot-date-val, .typo-10 .foot-sign-name {{ font-family: 'Archivo', sans-serif; }}

    /* Print Optimization (A4 Landscape) */
    @media print {{
      @page {{
        size: A4 landscape;
        margin: 0;
      }}
      html, body {{
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 297mm !important;
        height: 210mm !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }}
      .studio-header, .customizer-bar, .meta-bar {{
        display: none !important;
      }}
      .stage-container {{
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
        display: block !important;
      }}
      .cert-viewport {{
        width: 297mm !important;
        height: 210mm !important;
      }}
      .certificate-card {{
        width: 297mm !important;
        height: 210mm !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }}
    }}
  </style>
</head>
<body>

  <!-- Studio Header -->
  <header class="studio-header">
    <div class="header-inner">
      <div class="brand-group">
        <div class="brand-icon-wrap">
          <!-- Pip Coin Sprout Icon -->
          <svg width="22" height="22" viewBox="0 0 100 100" fill="none">
            <ellipse cx="50" cy="90" rx="22" ry="4.5" fill="rgba(0,0,0,0.2)"/>
            <path d="M50 30 C50 20 50 14 50 12" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
            <ellipse cx="39" cy="16" rx="9" ry="5" fill="#a7f3d0" transform="rotate(-32 39 16)"/>
            <ellipse cx="61" cy="14" rx="10" ry="5.5" fill="#ffffff" transform="rotate(28 61 14)"/>
            <circle cx="50" cy="58" r="32" fill="#F5B42A"/>
            <circle cx="50" cy="58" r="26" fill="#FAC438"/>
            <circle cx="41" cy="55" r="3.5" fill="#7A4800"/>
            <circle cx="42.5" cy="53.5" r="1.2" fill="#FFFFFF"/>
            <circle cx="59" cy="55" r="3.5" fill="#7A4800"/>
            <circle cx="60.5" cy="53.5" r="1.2" fill="#FFFFFF"/>
            <path d="M40 64 Q50 74 60 64 Q50 69 40 64 Z" fill="#7A4800"/>
          </svg>
        </div>
        <div class="brand-title">
          <h1>PipSavings Studio</h1>
          <p>Obsidian & Emerald · Classic Prestige</p>
        </div>
      </div>

      <!-- Typography Tabs -->
      <nav class="typo-nav">
        <button class="tab-btn active" onclick="selectTypo(2)"><span class="tab-num">★</span> Classic Prestige</button>
        <button class="tab-btn" onclick="selectTypo(1)"><span class="tab-num">01</span> Modern FinTech</button>
        <button class="tab-btn" onclick="selectTypo(3)"><span class="tab-num">03</span> Editorial</button>
        <button class="tab-btn" onclick="selectTypo(4)"><span class="tab-num">04</span> Swiss</button>
        <button class="tab-btn" onclick="selectTypo(5)"><span class="tab-num">05</span> Academic</button>
        <button class="tab-btn" onclick="selectTypo(6)"><span class="tab-num">06</span> Cyber Mono</button>
        <button class="tab-btn" onclick="selectTypo(7)"><span class="tab-num">07</span> Horlogerie</button>
        <button class="tab-btn" onclick="selectTypo(8)"><span class="tab-num">08</span> Architectural</button>
        <button class="tab-btn" onclick="selectTypo(9)"><span class="tab-num">09</span> Royal Script</button>
        <button class="tab-btn" onclick="selectTypo(10)"><span class="tab-num">10</span> Neo-Brutalist</button>
      </nav>

      <div class="header-actions">
        <button class="btn btn-secondary" onclick="toggleFitScreen()">Fit View</button>
        <button class="btn btn-primary" onclick="window.print()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          Print / PDF
        </button>
      </div>
    </div>
  </header>

  <!-- Live Customizer Sub-Bar -->
  <aside class="customizer-bar">
    <div class="customizer-inner">
      <div class="field-group">
        <label for="input-recipient">Recipient:</label>
        <input type="text" id="input-recipient" value="Alex Rivera" placeholder="Tester Name" oninput="updateCertificateText()">
      </div>

      <div class="field-group">
        <label for="input-date">Date:</label>
        <input type="text" id="input-date" value="September 2026" placeholder="Issue Date" oninput="updateCertificateText()" style="width: 130px;">
      </div>

      <div class="field-group">
        <label for="input-founder">Signatory:</label>
        <input type="text" id="input-founder" value="Yang Zi Chien" placeholder="Founder Name" oninput="updateCertificateText()" style="width: 125px;">
      </div>

      <!-- Signature Ink Color Picker -->
      <div class="sig-color-picker">
        <span style="color: var(--ui-text-muted); font-size: 11.5px;">Signature Ink:</span>
        <button class="sig-btn active" id="sig-btn-emerald" onclick="setSigColor('emerald')">
          <span class="sig-dot" style="background: #2aab68;"></span> Emerald
        </button>
        <button class="sig-btn" id="sig-btn-gold" onclick="setSigColor('gold')">
          <span class="sig-dot" style="background: #fac438;"></span> Gold
        </button>
        <button class="sig-btn" id="sig-btn-white" onclick="setSigColor('white')">
          <span class="sig-dot" style="background: #ffffff;"></span> Platinum
        </button>
      </div>

      <div class="preset-pills">
        <span>Sample Testers:</span>
        <button class="pill" onclick="setRecipientName('Alex Rivera')">Alex Rivera</button>
        <button class="pill" onclick="setRecipientName('Nurul Aisyah')">Nurul Aisyah</button>
        <button class="pill" onclick="setRecipientName('Chen Wei Ming')">Chen Wei Ming</button>
        <button class="pill" onclick="setRecipientName('Sarah Jenkins')">Sarah Jenkins</button>
      </div>
    </div>
  </aside>

  <!-- Main Viewport -->
  <main class="stage-container">
    <div class="meta-bar">
      <div class="meta-left">
        <span class="meta-title" id="meta-title">Classic Prestige (Selected)</span>
        <span class="meta-tag" id="meta-tag">Cinzel + Cormorant Garamond</span>
      </div>
      <div class="meta-fonts" id="meta-desc">Stately Roman serif capitals, royal architectural authority, and traditional academic grandeur.</div>
    </div>

    <div class="cert-viewport" id="cert-viewport">
      <article class="certificate-card typo-2" id="main-card">
        <div class="card-outer-frame">
          <!-- Corner Brackets -->
          <div class="corner c-tl"></div>
          <div class="corner c-tr"></div>
          <div class="corner c-bl"></div>
          <div class="corner c-br"></div>

          <div class="card-inner-frame">
            <!-- Header: Clean Brand Only (No extra text on right) -->
            <header class="cert-header">
              <div class="cert-brand">
                <!-- Pip Coin Mascot Vector -->
                <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="46" fill="#142b20" stroke="#f5b42a" stroke-width="3"/>
                  <path d="M50 24 C50 16 50 11 50 9" stroke="#2aab68" stroke-width="4" stroke-linecap="round"/>
                  <ellipse cx="40" cy="12" rx="8" ry="4.5" fill="#2aab68" transform="rotate(-30 40 12)"/>
                  <ellipse cx="60" cy="11" rx="9" ry="5" fill="#6ee7b7" transform="rotate(26 60 11)"/>
                  <circle cx="50" cy="54" r="30" fill="#F5B42A"/>
                  <circle cx="50" cy="54" r="24" fill="#FAC438"/>
                  <circle cx="41" cy="52" r="3.5" fill="#7A4800"/>
                  <circle cx="42.5" cy="50.5" r="1.2" fill="#FFFFFF"/>
                  <circle cx="59" cy="52" r="3.5" fill="#7A4800"/>
                  <circle cx="60.5" cy="50.5" r="1.2" fill="#FFFFFF"/>
                  <path d="M40 60 Q50 70 60 60 Q50 65 40 60 Z" fill="#7A4800"/>
                </svg>
                <div class="cert-brand-name">PipSavings</div>
              </div>
            </header>

            <!-- Body -->
            <div class="cert-body">
              <div class="cert-title-group">
                <h1 class="main-title">Certification</h1>
                <h2 class="sub-title">of Appreciation</h2>
              </div>
              
              <div class="intro-line">This certification is presented to</div>
              
              <div class="recipient-hero cert-val-recipient">Alex Rivera</div>
              
              <p class="citation-body">
                In recognition of your dedicated participation and valuable feedback throughout the 14-day closed beta testing of PipSavings.
              </p>
            </div>

            <!-- Footer -->
            <footer class="cert-footer">
              <div class="foot-date-col">
                <div class="foot-date-lbl">Date of Issue</div>
                <div class="foot-date-val cert-val-date">September 2026</div>
              </div>

              <!-- Signature -->
              <div class="foot-sign-col">
                <div class="sig-img-container">
                  <img id="founder-sig-img" class="sig-img" src="data:image/png;base64,{b64_emerald}" alt="Founder Signature" />
                </div>
                <div class="foot-sign-name cert-val-founder">Yang Zi Chien</div>
                <div class="foot-sign-title">Founder & Creator · PipSavings</div>
              </div>
            </footer>
          </div>
        </div>
      </article>
    </div>
  </main>

  <script>
    const sigData = {{
      emerald: "data:image/png;base64,{b64_emerald}",
      gold: "data:image/png;base64,{b64_gold}",
      white: "data:image/png;base64,{b64_white}"
    }};

    const typoInfo = {{
      1: {{ name: "01: Modern FinTech", tag: "Space Grotesk + Plus Jakarta Sans", desc: "Technical clarity, crisp geometric numerals, and razor-sharp modern fintech styling." }},
      2: {{ name: "Classic Prestige (Selected)", tag: "Cinzel + Cormorant Garamond", desc: "Stately Roman serif capitals, royal architectural authority, and traditional academic grandeur." }},
      3: {{ name: "03: Editorial Elegance", tag: "Playfair Display + Hanken Grotesk", desc: "High-contrast luxury editorial headline paired with modern geometric grotesk prose." }},
      4: {{ name: "04: Swiss International", tag: "Inter Display + Inter Core", desc: "Bauhaus / Dieter Rams minimalist discipline with tight negative tracking and absolute clarity." }},
      5: {{ name: "05: Academic Heritage", tag: "EB Garamond + Montserrat", desc: "Ivy League diploma heritage with delicate calligraphic serifs balanced by crisp modern sans." }},
      6: {{ name: "06: Cyber Mono Tech", tag: "Syne + Space Mono", desc: "Web3, cryptographic developer aesthetic with bold organic display curves and code mono body." }},
      7: {{ name: "07: Haute Horlogerie", tag: "Bodoni Moda + Montserrat", desc: "Extreme vertical contrast and razor-thin serifs reminiscent of Swiss luxury watch certificates." }},
      8: {{ name: "08: Modern Architectural", tag: "Outfit + Fraunces", desc: "Clean circular geometric display paired with expressive, warm typographic italics." }},
      9: {{ name: "09: Royal Calligraphic", tag: "Cinzel Decorative + Alex Brush", desc: "Bespoke hand-lettered cursive hero script with regal decorative Roman capitals." }},
      10: {{ name: "10: Neo-Brutalist Clean", tag: "Archivo + DM Sans", desc: "Confident Silicon Valley startup aesthetic with high-impact bold grotesque display." }}
    }};

    let currentTypo = 2;
    let isFitted = false;

    function selectTypo(num) {{
      currentTypo = num;
      const card = document.getElementById('main-card');
      card.className = card.className.replace(/\\btypo-\\d+\\b/g, '');
      card.classList.add('typo-' + num);

      document.querySelectorAll('.tab-btn').forEach((btn) => {{
        btn.classList.remove('active');
      }});
      // Find matching button
      const buttons = document.querySelectorAll('.tab-btn');
      buttons.forEach(btn => {{
        if (btn.getAttribute('onclick') === `selectTypo(${{num}})` ) {{
          btn.classList.add('active');
        }}
      }});

      const info = typoInfo[num];
      document.getElementById('meta-title').textContent = info.name;
      document.getElementById('meta-tag').textContent = info.tag;
      document.getElementById('meta-desc').textContent = info.desc;
    }}

    function setSigColor(color) {{
      const img = document.getElementById('founder-sig-img');
      img.src = sigData[color];
      
      const glowMap = {{
        emerald: 'drop-shadow(0 2px 6px rgba(42, 171, 104, 0.35))',
        gold: 'drop-shadow(0 2px 6px rgba(250, 196, 56, 0.35))',
        white: 'drop-shadow(0 2px 6px rgba(255, 255, 255, 0.25))'
      }};
      img.style.filter = glowMap[color];

      document.querySelectorAll('.sig-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('sig-btn-' + color);
      if (activeBtn) activeBtn.classList.add('active');
    }}

    function updateCertificateText() {{
      const recipient = document.getElementById('input-recipient').value.trim() || "Recipient Name";
      const date = document.getElementById('input-date').value.trim() || "September 2026";
      const founder = document.getElementById('input-founder').value.trim() || "Yang Zi Chien";

      document.querySelectorAll('.cert-val-recipient').forEach(el => el.textContent = recipient);
      document.querySelectorAll('.cert-val-date').forEach(el => el.textContent = date);
      document.querySelectorAll('.cert-val-founder').forEach(el => el.textContent = founder);
    }}

    function setRecipientName(name) {{
      document.getElementById('input-recipient').value = name;
      updateCertificateText();
    }}

    function toggleFitScreen() {{
      isFitted = !isFitted;
      const viewport = document.getElementById('cert-viewport');
      if (isFitted) {{
        const availableWidth = window.innerWidth - 60;
        const availableHeight = window.innerHeight - 240;
        const scaleX = availableWidth / 1120;
        const scaleY = availableHeight / 792;
        const scale = Math.min(scaleX, scaleY, 1);
        viewport.style.transform = 'scale(' + scale + ')';
        viewport.style.transformOrigin = 'top center';
        viewport.style.marginBottom = -(792 * (1 - scale)) + 'px';
      }} else {{
        viewport.style.transform = 'none';
        viewport.style.marginBottom = '0';
      }}
    }}

    window.addEventListener('DOMContentLoaded', () => {{
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('standalone') === 'true' || urlParams.get('capture') === 'true') {{
        document.body.classList.add('standalone');
      }}
      const typoParam = parseInt(urlParams.get('typo') || urlParams.get('tpl'));
      if (typoParam >= 1 && typoParam <= 10) {{
        selectTypo(typoParam);
      }} else {{
        selectTypo(2); // Default to Classic Prestige
      }}
      if (urlParams.get('sig') && sigData[urlParams.get('sig')]) {{
        setSigColor(urlParams.get('sig'));
      }}
      if (urlParams.get('recipient')) {{
        document.getElementById('input-recipient').value = urlParams.get('recipient');
      }}
      if (urlParams.get('date')) {{
        document.getElementById('input-date').value = urlParams.get('date');
      }}
      if (urlParams.get('founder')) {{
        document.getElementById('input-founder').value = urlParams.get('founder');
      }}
      updateCertificateText();
    }});
  </script>
</body>
</html>
'''

with open('/home/yang/Project/PipFinance/certificates/index.html', 'w') as f:
    f.write(html_content)

print('Regenerated /home/yang/Project/PipFinance/certificates/index.html successfully!')
