#!/usr/bin/env python3
"""Generate simplified, clean Pip volunteer recruitment Instagram Story without side cards, sub-paragraphs, or top badge."""

import math
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path("/home/yang/Project/PipFinance")
sys.path.insert(0, str(ROOT / "AppStoreScreenshot/design"))
from mascot import render_pip_svg
import cairosvg

SHOTS = ROOT / "AppStoreScreenshot"
OUT_DIR = ROOT / "InstagramStory"
OUT_DIR.mkdir(exist_ok=True)
BRAIN_DIR = Path("/home/yang/.gemini/antigravity/brain/8a07300a-88da-4662-9fa6-5714614b8629")
FONTS = ROOT / "node_modules/@expo-google-fonts"

# --- Typography Loaders ---
FONT_HEAD = ImageFont.truetype(str(FONTS / "hanken-grotesk/800ExtraBold/HankenGrotesk_800ExtraBold.ttf"), 74)
FONT_CTA_TITLE = ImageFont.truetype(str(FONTS / "hanken-grotesk/800ExtraBold/HankenGrotesk_800ExtraBold.ttf"), 38)
FONT_CTA_SUB = ImageFont.truetype(str(FONTS / "hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf"), 25)
FONT_CTA_BTN = ImageFont.truetype(str(FONTS / "space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf"), 25)

# --- Brand Colors ---
C_BG = (223, 230, 225)        # #dfe6e1
C_TEXT = (22, 32, 27)          # #16201b
C_SUB = (82, 97, 89)           # #526159
C_GREEN = (31, 138, 91)        # #1f8a5b
C_SOFT_GREEN = (219, 236, 229) # #dbece5
C_GOLD = (250, 196, 56)        # #FAC438
C_WHITE = (255, 255, 255)

def create_rounded_rect_mask(size: tuple[int, int], radius: int, supersample: int = 4) -> Image.Image:
    w, h = size
    sw, sh = w * supersample, h * supersample
    sr = radius * supersample
    mask = Image.new("L", (sw, sh), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (sw - 1, sh - 1)], radius=sr, fill=255)
    return mask.resize((w, h), Image.Resampling.LANCZOS)

def create_drop_shadow(
    width: int,
    height: int,
    radius: int,
    offset_y: int,
    blur_radius: int,
    opacity: float,
    color: tuple[int, int, int] = (16, 32, 24)
) -> Image.Image:
    pad = blur_radius * 3 + abs(offset_y)
    canvas_w = width + pad * 2
    canvas_h = height + pad * 2
    
    shadow_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow_layer)
    alpha = int(255 * opacity)
    x0 = pad
    y0 = pad + offset_y
    x1 = x0 + width
    y1 = y0 + height
    draw.rounded_rectangle([(x0, y0), (x1, y1)], radius=radius, fill=(*color, alpha))
    return shadow_layer.filter(ImageFilter.GaussianBlur(blur_radius))

def render_svg_to_image(svg_str: str, w: int, h: int) -> Image.Image:
    png_bytes = cairosvg.svg2png(bytestring=svg_str.encode("utf-8"), output_width=w, output_height=h)
    return Image.open(BytesIO(png_bytes)).convert("RGBA")

def render_vector_icon(name: str, size: int = 24, color: str = "#1f8a5b") -> Image.Image:
    icons = {
        "chat": f"""<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2H4a2 2 0 0 0-2 2v14l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" fill="{color}"/>
            <circle cx="8" cy="9" r="1.3" fill="#1f8a5b"/>
            <circle cx="12" cy="9" r="1.3" fill="#1f8a5b"/>
            <circle cx="16" cy="9" r="1.3" fill="#1f8a5b"/>
        </svg>""",
    }
    return render_svg_to_image(icons.get(name, icons["chat"]), size, size)

def render_decorations_svg(w: int, h: int) -> Image.Image:
    c_green = "#1f8a5b"
    c_gold = "#FAC438"
    
    svg = f"""
    <svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Concentric orbit rings behind top right -->
        <circle cx="890" cy="270" r="175" stroke="{c_green}" stroke-width="1.8" stroke-dasharray="8 10" opacity="0.22" />
        <circle cx="890" cy="270" r="270" stroke="{c_green}" stroke-width="1.4" stroke-dasharray="14 14" opacity="0.14" />
        <circle cx="890" cy="270" r="370" stroke="{c_green}" stroke-width="1.0" opacity="0.08" />

        <!-- Mascot Gold Orbit -->
        <circle cx="880" cy="235" r="115" stroke="{c_gold}" stroke-width="1.6" stroke-dasharray="6 8" opacity="0.35" />

        <!-- Mid & Bottom Orbit Accents -->
        <circle cx="120" cy="950" r="240" stroke="{c_green}" stroke-width="1.4" stroke-dasharray="10 12" opacity="0.12" />
        <circle cx="960" cy="1480" r="260" stroke="{c_green}" stroke-width="1.2" stroke-dasharray="12 14" opacity="0.11" />

        <!-- Starbursts and Sparkles -->
        <path d="M85 80 Q85 106 59 106 Q85 106 85 132 Q85 106 111 106 Q85 106 85 80 Z" fill="{c_green}" opacity="0.36" />
        <circle cx="85" cy="106" r="3.5" fill="#ffffff" opacity="0.85" />

        <path d="M990 90 Q990 106 974 106 Q990 106 990 122 Q990 106 1006 106 Q990 106 990 90 Z" fill="{c_green}" opacity="0.3" />
        <path d="M65 520 Q65 536 49 536 Q65 536 65 552 Q65 536 81 536 Q65 536 65 520 Z" fill="{c_green}" opacity="0.25" />
        <path d="M1010 680 Q1010 698 992 698 Q1010 698 1010 716 Q1010 698 1028 698 Q1010 698 1010 680 Z" fill="{c_green}" opacity="0.28" />
        <path d="M90 1480 Q90 1496 74 1496 Q90 1496 90 1512 Q90 1496 106 1496 Q90 1496 90 1480 Z" fill="{c_green}" opacity="0.3" />
        <path d="M980 1800 Q980 1814 966 1814 Q980 1814 980 1828 Q980 1814 994 1814 Q980 1814 980 1800 Z" fill="{c_green}" opacity="0.32" />

        <!-- Gold Starburst near mascot -->
        <path d="M720 175 Q720 187 708 187 Q720 187 720 199 Q720 187 732 187 Q720 187 720 175 Z" fill="{c_gold}" opacity="0.5" />
        <circle cx="720" cy="187" r="2" fill="#ffffff" opacity="0.9" />

        <!-- Sparkling Cross Accents -->
        <g stroke="{c_green}" stroke-width="2.4" stroke-linecap="round" opacity="0.32">
            <line x1="88" y1="440" x2="102" y2="440" />
            <line x1="95" y1="433" x2="95" y2="447" />
        </g>
        <g stroke="{c_gold}" stroke-width="2.2" stroke-linecap="round" opacity="0.45">
            <line x1="980" y1="460" x2="994" y2="460" />
            <line x1="987" y1="453" x2="987" y2="467" />
        </g>
        <g stroke="{c_green}" stroke-width="2.4" stroke-linecap="round" opacity="0.28">
            <line x1="120" y1="1780" x2="134" y2="1780" />
            <line x1="127" y1="1773" x2="127" y2="1787" />
        </g>

        <!-- Ambient Bokeh Discs -->
        <circle cx="95" cy="380" r="22" fill="{c_green}" opacity="0.07" />
        <circle cx="980" cy="650" r="30" fill="{c_green}" opacity="0.08" />
        <circle cx="110" cy="1320" r="42" fill="{c_green}" opacity="0.06" />
        <circle cx="970" cy="1250" r="34" fill="{c_green}" opacity="0.07" />
        <circle cx="740" cy="370" r="16" fill="{c_gold}" opacity="0.12" />
    </svg>
    """
    return render_svg_to_image(svg, w, h)

def create_radial_glow(w: int, h: int, cx: int, cy: int, radius: int, color: tuple[int, int, int], max_alpha: float) -> Image.Image:
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow_arr = Image.new("L", (radius * 2, radius * 2), 0)
    draw_g = ImageDraw.Draw(glow_arr)
    
    for r in range(radius, 0, -2):
        ratio = 1.0 - (r / radius)
        alpha = int(255 * max_alpha * (ratio ** 1.6))
        draw_g.ellipse([(radius - r, radius - r), (radius + r, radius + r)], fill=alpha)
        
    colored = Image.new("RGBA", (radius * 2, radius * 2), (*color, 255))
    glow_stamp = Image.new("RGBA", (radius * 2, radius * 2), (0, 0, 0, 0))
    glow_stamp.paste(colored, (0, 0), glow_arr)
    
    glow.paste(glow_stamp, (cx - radius, cy - radius), glow_stamp)
    return glow

def build_phone_mockup(screenshot_path: Path, screen_w: int = 570) -> Image.Image:
    """Build a prominent flagship phone mockup."""
    bezel = 12
    corner_radius = 42
    
    src_im = Image.open(screenshot_path).convert("RGB")
    src_im = src_im.crop((0, 132, src_im.width, src_im.height)) # crop android status
    
    scale = screen_w / src_im.width
    shot_h = round(src_im.height * scale)
    safe_top = 38
    safe_bottom = 18
    screen_h = safe_top + shot_h + safe_bottom
    
    resized_shot = src_im.resize((screen_w, shot_h), Image.Resampling.LANCZOS)
    top_color = resized_shot.getpixel((screen_w // 2, 2))
    bottom_color = resized_shot.getpixel((screen_w // 2, shot_h - 2))
    
    screen_canvas = Image.new("RGBA", (screen_w, screen_h), (*top_color, 255))
    draw_s = ImageDraw.Draw(screen_canvas)
    draw_s.rectangle([(0, safe_top + shot_h), (screen_w, screen_h)], fill=(*bottom_color, 255))
    screen_canvas.paste(resized_shot, (0, safe_top))
    
    # Island
    iw, ih = 104, 28
    ix = (screen_w - iw) // 2
    draw_s.rounded_rectangle([(ix, 8), (ix + iw, 8 + ih)], radius=ih // 2, fill=(10, 14, 12, 255))
    draw_s.ellipse([(ix + iw - 20, 8 + ih // 2 - 3), (ix + iw - 14, 8 + ih // 2 + 3)], fill=(20, 26, 23, 255))
    draw_s.ellipse([(ix + iw - 18, 8 + ih // 2 - 1.5), (ix + iw - 15, 8 + ih // 2 + 1.5)], fill=(32, 48, 58, 255))
    
    # Home bar
    draw_s.rounded_rectangle([((screen_w - 120) // 2, screen_h - 9), ((screen_w + 120) // 2, screen_h - 4)], radius=2.5, fill=(22, 28, 24, 180))
    
    # Gloss
    gloss = Image.new("RGBA", (screen_w, screen_h), (0, 0, 0, 0))
    poly = [(0, 0), (screen_w, 0), (screen_w, int(screen_h * 0.35)), (0, int(screen_h * 0.65))]
    grad_mask = Image.new("L", (screen_w, screen_h), 0)
    for y in range(screen_h):
        val = int(255 * (max(0.0, 1.0 - y / (screen_h * 0.65)) ** 1.8) * 0.12)
        ImageDraw.Draw(grad_mask).line([(0, y), (screen_w, y)], fill=val)
    poly_mask = Image.new("L", (screen_w, screen_h), 0)
    ImageDraw.Draw(poly_mask).polygon(poly, fill=255)
    final_mask = Image.new("L", (screen_w, screen_h), 0)
    final_mask.paste(grad_mask, (0, 0), poly_mask)
    gloss.paste(Image.new("RGBA", (screen_w, screen_h), (255, 255, 255, 255)), (0, 0), final_mask)
    screen_canvas = Image.alpha_composite(screen_canvas, gloss)
    
    screen_mask = create_rounded_rect_mask((screen_w, screen_h), corner_radius)
    screen_layer = Image.new("RGBA", (screen_w, screen_h), (0, 0, 0, 0))
    screen_layer.paste(screen_canvas, (0, 0), screen_mask)
    
    # Chassis
    phone_w = screen_w + 2 * bezel
    phone_h = screen_h + 2 * bezel
    phone_radius = corner_radius + bezel
    
    chassis = Image.new("RGBA", (phone_w, phone_h), (20, 26, 22, 255))
    chassis_mask = create_rounded_rect_mask((phone_w, phone_h), phone_radius)
    chassis_clipped = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    chassis_clipped.paste(chassis, (0, 0), chassis_mask)
    
    draw_rim = ImageDraw.Draw(chassis_clipped)
    draw_rim.rounded_rectangle([(1, 1), (phone_w - 2, phone_h - 2)], radius=phone_radius - 1, outline=(255, 255, 255, 36), width=1)
    chassis_clipped.paste(screen_layer, (bezel, bezel), screen_layer)
    
    # Side buttons
    btn_t = 4
    full_w = phone_w + 2 * btn_t
    device_layer = Image.new("RGBA", (full_w, phone_h), (0, 0, 0, 0))
    draw_dev = ImageDraw.Draw(device_layer)
    draw_dev.rounded_rectangle([(0, int(phone_h * 0.16)), (btn_t + 1, int(phone_h * 0.20))], radius=2, fill=(30, 36, 32, 255))
    draw_dev.rounded_rectangle([(0, int(phone_h * 0.23)), (btn_t + 1, int(phone_h * 0.29))], radius=2, fill=(30, 36, 32, 255))
    draw_dev.rounded_rectangle([(0, int(phone_h * 0.31)), (btn_t + 1, int(phone_h * 0.37))], radius=2, fill=(30, 36, 32, 255))
    draw_dev.rounded_rectangle([(full_w - btn_t - 1, int(phone_h * 0.24)), (full_w, int(phone_h * 0.34))], radius=2, fill=(30, 36, 32, 255))
    device_layer.paste(chassis_clipped, (btn_t, 0), chassis_clipped)
    
    return device_layer

def render_volunteer_story() -> Path:
    W, H = 1080, 1920
    
    # 1. Base Canvas
    canvas = Image.new("RGBA", (W, H), (*C_BG, 255))
    
    # 2. Ambient Glows
    glow_tr = create_radial_glow(W, H, cx=920, cy=180, radius=550, color=C_GREEN, max_alpha=0.22)
    glow_gold = create_radial_glow(W, H, cx=870, cy=220, radius=320, color=C_GOLD, max_alpha=0.32)
    glow_tl = create_radial_glow(W, H, cx=150, cy=150, radius=420, color=C_WHITE, max_alpha=0.65)
    glow_mid = create_radial_glow(W, H, cx=540, cy=950, radius=750, color=C_GREEN, max_alpha=0.20)
    
    canvas = Image.alpha_composite(canvas, glow_tr)
    canvas = Image.alpha_composite(canvas, glow_gold)
    canvas = Image.alpha_composite(canvas, glow_tl)
    canvas = Image.alpha_composite(canvas, glow_mid)
    
    # 3. Vector Decorations Overlay
    decor_im = render_decorations_svg(W, H)
    canvas = Image.alpha_composite(canvas, decor_im)
    
    draw = ImageDraw.Draw(canvas)
    
    # 4. Main Headline
    head_y = 190
    line1 = "Volunteers needed"
    line2 = "for early app testing."
    draw.text((72, head_y), line1, font=FONT_HEAD, fill=C_TEXT)
    draw.text((72, head_y + 80), line2, font=FONT_HEAD, fill=C_TEXT)
    
    # 5. Mascot Pip (Top-Right)
    pip_svg = render_pip_svg(
        pose="curious",
        size=240,
        show_sparkles=True,
    )
    pip_im = render_svg_to_image(pip_svg, 240, 220)
    
    pip_x, pip_y = 760, 130
    pip_shadow = create_drop_shadow(pip_im.width - 20, pip_im.height - 20, radius=50, offset_y=14, blur_radius=22, opacity=0.22)
    pad_ps = 22 * 3 + 14
    canvas.alpha_composite(pip_shadow, (pip_x + 10 - pad_ps, pip_y + 10 - pad_ps))
    canvas.alpha_composite(pip_im, (pip_x, pip_y))
    
    # 6. Centered Large Device Showcase
    mockup_img = build_phone_mockup(SHOTS / "01_home_dashboard.jpg", screen_w=580)
    mock_w, mock_h = mockup_img.size
    
    mock_x = (W - mock_w) // 2
    mock_y = 390
    
    # Multi-tier smooth drop shadow for the centered phone
    s1 = create_drop_shadow(mock_w - 8, mock_h, radius=52, offset_y=36, blur_radius=48, opacity=0.22, color=(16, 32, 24))
    pad_ms1 = 48 * 3 + 36
    canvas.alpha_composite(s1, (mock_x + 4 - pad_ms1, mock_y - pad_ms1))
    
    s2 = create_drop_shadow(mock_w - 8, mock_h, radius=52, offset_y=16, blur_radius=20, opacity=0.12, color=(0, 0, 0))
    pad_ms2 = 20 * 3 + 16
    canvas.alpha_composite(s2, (mock_x + 4 - pad_ms2, mock_y - pad_ms2))
    
    canvas.alpha_composite(mockup_img, (mock_x, mock_y))
    
    # 7. Prominent Call-To-Action (CTA) Bottom Banner
    cta_x = 72
    cta_y = 1510
    cta_w = W - 2 * cta_x
    cta_h = 220
    
    # CTA Shadow
    cta_shadow = create_drop_shadow(cta_w, cta_h, radius=32, offset_y=16, blur_radius=30, opacity=0.18, color=(16, 32, 24))
    pad_cta = 30 * 3 + 16
    canvas.alpha_composite(cta_shadow, (cta_x - pad_cta, cta_y - pad_cta))
    
    # Dark Titanium CTA Card
    cta_card = Image.new("RGBA", (cta_w, cta_h), (22, 32, 27, 255))
    cta_mask = create_rounded_rect_mask((cta_w, cta_h), radius=32)
    cta_clipped = Image.new("RGBA", (cta_w, cta_h), (0, 0, 0, 0))
    cta_clipped.paste(cta_card, (0, 0), cta_mask)
    
    draw_cta = ImageDraw.Draw(cta_clipped)
    draw_cta.rounded_rectangle([(1, 1), (cta_w - 2, cta_h - 2)], radius=31, outline=(*C_GREEN, 140), width=2)
    
    canvas.alpha_composite(cta_clipped, (cta_x, cta_y))
    
    draw_final = ImageDraw.Draw(canvas)
    
    # CTA Header & Subtext
    draw_final.text((cta_x + 40, cta_y + 30), "Want to test Pip early?", font=FONT_CTA_TITLE, fill=C_WHITE)
    draw_final.text((cta_x + 40, cta_y + 78), "Please DM for more info & early invite link.", font=FONT_CTA_SUB, fill=(185, 200, 192))
    
    # CTA Button Pill inside card
    btn_w = cta_w - 80
    btn_h = 66
    btn_x = cta_x + 40
    btn_y = cta_y + 124
    
    draw_final.rounded_rectangle(
        [(btn_x, btn_y), (btn_x + btn_w, btn_y + btn_h)],
        radius=btn_h // 2,
        fill=C_GREEN
    )
    
    # Button Chat Icon & Label
    btn_icon = render_vector_icon("chat", size=26, color="#ffffff")
    btn_label = "Send a DM to Join  →"
    btn_bbox = FONT_CTA_BTN.getbbox(btn_label)
    bw = btn_bbox[2] - btn_bbox[0]
    bh = btn_bbox[3] - btn_bbox[1]
    
    total_btn_content_w = 26 + 12 + bw
    start_btn_x = btn_x + (btn_w - total_btn_content_w) // 2
    
    canvas.alpha_composite(btn_icon, (start_btn_x, btn_y + (btn_h - 26) // 2))
    draw_final.text(
        (start_btn_x + 38, btn_y + (btn_h - bh) // 2 - 2),
        btn_label,
        font=FONT_CTA_BTN,
        fill=C_WHITE
    )
    
    # 8. Save Final Outputs
    final_rgb = canvas.convert("RGB")
    
    out_story = OUT_DIR / "instagram_story_volunteer.png"
    final_rgb.save(out_story, "PNG", quality=100)
    
    root_story = ROOT / "instagram_story_volunteer.png"
    final_rgb.save(root_story, "PNG", quality=100)
    
    brain_story = BRAIN_DIR / "instagram_story_volunteer.png"
    final_rgb.save(brain_story, "PNG", quality=100)
    
    print(f"Clean volunteer story generated successfully:\n  {out_story}\n  {root_story}\n  {brain_story}")
    return out_story

if __name__ == "__main__":
    render_volunteer_story()
