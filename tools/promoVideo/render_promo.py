#!/usr/bin/env python3
"""
tools/promoVideo/render_promo.py
--------------------------------
Generates a broadcast-quality promo video for Pip Expenses Tracker.
Narrative:
1. Starts with the ACTUAL Home screen (Home dashboard with clean fitted layout and bottom nav bar).
2. Pointer cursor glides and presses the '+' Add button in the bottom navigation bar.
3. Phone immediately reacts upon button press and switches directly to Camera Scanner.
4. Camera Scanner snaps transaction history (Touch 'n Go statement).
5. Instant AI OCR laser scan sweeps the document and extracts all transactions.
6. Auto-categorizes transactions with category badges and confirms save.
7. Returns to the Home screen showing the newly recorded transactions in the live dashboard.

Outputs:
  - tools/promoVideo/out/pip_promo_video.mp4 (1080x1920 9:16 vertical promo)
"""

import math
import os
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

# ── Paths ───────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
OUT_DIR = SCRIPT_DIR / "out"
SNAPSHOTS_DIR = OUT_DIR / "snapshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

SHOTS_DIR = REPO_ROOT / "AppStoreScreenshot"
ASSETS_DIR = REPO_ROOT / "assets"
FONTS_DIR = REPO_ROOT / "node_modules" / "@expo-google-fonts"

HOME_IMG_PATH = SHOTS_DIR / "01_home_dashboard.jpg"
TNG_IMG_PATH = ASSETS_DIR / "demo" / "kit1-tng.png"
CAPTURE_IMG_PATH = SHOTS_DIR / "Screenshot_20260825_154940_com_yabg_pip_MainActivity.jpg"
SAVED_WAV_PATH = ASSETS_DIR / "sounds" / "saved.wav"

OUT_VIDEO_PATH = OUT_DIR / "pip_promo_video.mp4"
OUT_AUDIO_PATH = OUT_DIR / "promo_audio.wav"

# ── Video Specs ─────────────────────────────────────────────────────────────────
WIDTH = 1080
HEIGHT = 1920
FPS = 60
DURATION_SEC = 16.8
TOTAL_FRAMES = int(FPS * DURATION_SEC)  # 1008 frames

# ── Colors ──────────────────────────────────────────────────────────────────────
BG_COLOR = (255, 255, 255)           # Pure White background
INK_PRIMARY = (17, 24, 20)           # Black primary text
INK_SECONDARY = (75, 85, 99)         # Slate secondary text
ACCENT_GREEN = (31, 138, 91)         # Emerald Green accent
ACCENT_GREEN_BRIGHT = (34, 197, 94)  # Vibrant green highlight
ACCENT_SOFT = (235, 247, 240)        # Soft green pill badge
WHITE = (255, 255, 255)
GOLD = (250, 196, 56)                # Pip coin gold
RED = (231, 76, 60)

# ── Geometry ────────────────────────────────────────────────────────────────────
PHONE_W = 680
PHONE_H = 1380
PHONE_X = (WIDTH - PHONE_W) // 2     # 200
PHONE_Y = 460
RAIL = 14
SCREEN_W = PHONE_W - 2 * RAIL         # 652
SCREEN_H = PHONE_H - 2 * RAIL         # 1352
SCREEN_X = PHONE_X + RAIL             # 214
SCREEN_Y = PHONE_Y + RAIL             # 474
RADIUS = 52
SCREEN_RADIUS = 42
SAFE_TOP = 48                         # Top safe area under Dynamic Island

# ── Load Fonts ──────────────────────────────────────────────────────────────────
def get_font(family: str, size: int):
    try:
        if family == "HankenBold":
            p = FONTS_DIR / "hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf"
        elif family == "HankenExtraBold":
            p = FONTS_DIR / "hanken-grotesk/800ExtraBold/HankenGrotesk_800ExtraBold.ttf"
        elif family == "HankenMedium":
            p = FONTS_DIR / "hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf"
        elif family == "SpaceBold":
            p = FONTS_DIR / "space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf"
        elif family == "SpaceMedium":
            p = FONTS_DIR / "space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf"
        else:
            p = FONTS_DIR / "hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf"
        return ImageFont.truetype(str(p), size)
    except Exception:
        return ImageFont.load_default()

FONT_BADGE = get_font("SpaceBold", 24)
FONT_HEADLINE = get_font("HankenExtraBold", 64)
FONT_SUBTITLE = get_font("HankenMedium", 32)
FONT_CTA = get_font("HankenBold", 36)
FONT_SMALL = get_font("SpaceMedium", 22)
FONT_HUD = get_font("SpaceBold", 26)

# ── Easing Helpers ──────────────────────────────────────────────────────────────
def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 0.5 * (1 - math.cos(math.pi * t))

def ease_out_cubic(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3

def ease_out_back(t: float, s: float = 1.70158) -> float:
    t = max(0.0, min(1.0, t))
    return 1 + (s + 1) * ((t - 1) ** 3) + s * ((t - 1) ** 2)

# ── Audio Generation ────────────────────────────────────────────────────────────
def generate_audio_track() -> Path:
    sample_rate = 44100
    total_samples = int(sample_rate * DURATION_SEC)
    audio = np.zeros(total_samples, dtype=np.float32)

    # 1. UI Swoosh into Home (t = 0.15s)
    t_swoosh = int(0.15 * sample_rate)
    dur = int(0.35 * sample_rate)
    t_arr = np.linspace(0, 0.35, dur)
    swoosh = np.sin(2 * np.pi * np.linspace(200, 600, dur) * t_arr) * np.sin(np.pi * t_arr / 0.35) * 0.12
    audio[t_swoosh:t_swoosh+dur] += swoosh

    # 2. Add Button Tap (t = 2.15s)
    t_tap = int(2.15 * sample_rate)
    dur_tap = int(0.1 * sample_rate)
    t_t = np.linspace(0, 0.1, dur_tap)
    tap_click = np.sin(2 * np.pi * 520 * t_t) * np.exp(-t_t * 70) * 0.45
    audio[t_tap:t_tap+dur_tap] += tap_click

    # 3. Camera Shutter Click (t = 4.5s)
    t_shut = int(4.5 * sample_rate)
    dur_shut = int(0.22 * sample_rate)
    t_s = np.linspace(0, 0.22, dur_shut)
    c1 = np.random.normal(0, 1, dur_shut) * np.exp(-t_s * 75) * 0.55
    c2 = np.zeros_like(c1)
    off = int(0.04 * sample_rate)
    c2[off:] = np.random.normal(0, 1, dur_shut - off) * np.exp(-(t_s[off:] - 0.04) * 65) * 0.65
    shutter = c1 + c2
    audio[t_shut:t_shut+dur_shut] += shutter

    # 4. OCR Laser Scan Hum (t = 5.0s to 7.8s)
    t_scan = int(5.0 * sample_rate)
    dur_scan = int(2.8 * sample_rate)
    t_sc = np.linspace(0, 2.8, dur_scan)
    freq = np.linspace(350, 1100, dur_scan)
    scan_hum = np.sin(2 * np.pi * freq * t_sc) * 0.08 * (np.sin(np.pi * t_sc / 2.8) ** 1.5)
    audio[t_scan:t_scan+dur_scan] += scan_hum

    # 5. Success Chime (Mix in saved.wav at t = 9.9s)
    if SAVED_WAV_PATH.exists():
        with wave.open(str(SAVED_WAV_PATH), "rb") as w:
            n_frames = w.getnframes()
            raw = w.readframes(n_frames)
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
            if w.getnchannels() == 2:
                samples = samples[::2]
            t_chime = int(9.9 * sample_rate)
            end = min(t_chime + len(samples), total_samples)
            audio[t_chime:end] += samples[:end - t_chime] * 0.85

    # 6. Final Accent Ding (t = 12.5s)
    t_ding = int(12.5 * sample_rate)
    dur_ding = int(0.8 * sample_rate)
    t_d = np.linspace(0, 0.8, dur_ding)
    ding = (np.sin(2 * np.pi * 880 * t_d) + 0.5 * np.sin(2 * np.pi * 1760 * t_d)) * np.exp(-t_d * 5) * 0.25
    audio[t_ding:t_ding+dur_ding] += ding

    # Normalize & save
    audio = np.clip(audio, -0.95, 0.95)
    int_audio = (audio * 32767).astype(np.int16)
    with wave.open(str(OUT_AUDIO_PATH), "wb") as out_w:
        out_w.setnchannels(1)
        out_w.setsampwidth(2)
        out_w.setframerate(sample_rate)
        out_w.writeframes(int_audio.tobytes())

    return OUT_AUDIO_PATH

# ── Image Loading & Pre-processing ──────────────────────────────────────────────
print("Loading app screenshots and cropping status bars...")
raw_home = Image.open(HOME_IMG_PATH).convert("RGBA")
raw_tng = Image.open(TNG_IMG_PATH).convert("RGBA")
raw_capture = Image.open(CAPTURE_IMG_PATH).convert("RGBA")

def prepare_screen_surface(raw_img: Image.Image, crop_top_raw: int = 120, crop_bot_raw: int = 2680) -> Image.Image:
    """
    Crops out the device status bar (y=0..120) and bottom overscroll (y > 2680),
    fills the top safe area background color, and scales content cleanly so the
    entire interface (including bottom navigation bar and center Add button) fits.
    """
    w, h = raw_img.size
    cb = min(h, crop_bot_raw)
    cropped = raw_img.crop((0, crop_top_raw, w, cb))
    bg_col = raw_img.getpixel((30, crop_top_raw + 20))
    bg_rgba = bg_col + (255,) if len(bg_col) == 3 else bg_col
    
    surf = Image.new("RGBA", (SCREEN_W, SCREEN_H), bg_rgba)
    content_h = SCREEN_H - SAFE_TOP
    scaled = cropped.resize((SCREEN_W, content_h), Image.Resampling.LANCZOS)
    surf.paste(scaled, (0, SAFE_TOP))
    return surf

HOME_SCREEN_IMG = prepare_screen_surface(raw_home)
CAPTURE_SCREEN_IMG = prepare_screen_surface(raw_capture)

# Prepare TNG Statement surface for camera scanner viewfinder
scale_tng = (SCREEN_W - 40) / raw_tng.width
tng_scaled = raw_tng.resize((SCREEN_W - 40, int(raw_tng.height * scale_tng)), Image.Resampling.LANCZOS)
TNG_SCREEN_IMG = Image.new("RGBA", (SCREEN_W, SCREEN_H), (20, 24, 22, 255))
TNG_SCREEN_IMG.paste(tng_scaled, (20, 110))

# ── Render Utilities ────────────────────────────────────────────────────────────
def draw_rounded_rect(draw: ImageDraw.ImageDraw, xy, radius: int, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def draw_dynamic_island(draw: ImageDraw.ImageDraw, x_center: int, y: int):
    # Dynamic Island pill
    w = 126
    h = 30
    x0 = x_center - w // 2
    draw.rounded_rectangle([x0, y, x0 + w, y + h], radius=15, fill=(0, 0, 0))
    # Camera lens reflection
    draw.ellipse([x0 + w - 24, y + 7, x0 + w - 8, y + 23], fill=(18, 24, 38))
    draw.ellipse([x0 + w - 18, y + 11, x0 + w - 12, y + 17], fill=(30, 45, 75))

def draw_cursor(img: Image.Image, x: int, y: int, pressed: bool = False, ripple_radius: int = 0):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Touch ripple on press
    if ripple_radius > 0:
        alpha = max(0, int(220 * (1 - ripple_radius / 90)))
        draw.ellipse(
            [x - ripple_radius, y - ripple_radius, x + ripple_radius, y + ripple_radius],
            fill=(31, 138, 91, alpha // 3),
            outline=(42, 171, 104, alpha),
            width=3
        )

    # Touch Pointer Finger / Cursor Dot
    scale = 0.88 if pressed else 1.0
    r_outer = int(22 * scale)
    r_inner = int(14 * scale)

    # Drop shadow
    draw.ellipse([x - r_outer + 3, y - r_outer + 6, x + r_outer + 3, y + r_outer + 6], fill=(0, 0, 0, 90))
    # Outer white halo
    draw.ellipse([x - r_outer, y - r_outer, x + r_outer, y + r_outer], fill=(255, 255, 255, 240), outline=(22, 32, 27, 180), width=2)
    # Inner emerald core
    draw.ellipse([x - r_inner, y - r_inner, x + r_inner, y + r_inner], fill=(31, 138, 91, 255))
    # Center sparkle highlight
    draw.ellipse([x - 5, y - 5, x + 1, y + 1], fill=(255, 255, 255, 200))

    img.alpha_composite(overlay)

def draw_camera_viewfinder(draw: ImageDraw.ImageDraw, x0: int, y0: int, x1: int, y1: int, pulse: float = 1.0):
    bracket_len = 50
    bracket_w = 4
    bracket_col = (42, 171, 104, int(255 * pulse))
    
    # Top-Left
    draw.line([x0, y0, x0 + bracket_len, y0], fill=bracket_col, width=bracket_w)
    draw.line([x0, y0, x0, y0 + bracket_len], fill=bracket_col, width=bracket_w)
    # Top-Right
    draw.line([x1, y0, x1 - bracket_len, y0], fill=bracket_col, width=bracket_w)
    draw.line([x1, y0, x1, y0 + bracket_len], fill=bracket_col, width=bracket_w)
    # Bottom-Left
    draw.line([x0, y1, x0 + bracket_len, y1], fill=bracket_col, width=bracket_w)
    draw.line([x0, y1, x0, y1 - bracket_len], fill=bracket_col, width=bracket_w)
    # Bottom-Right
    draw.line([x1, y1, x1 - bracket_len, y1], fill=bracket_col, width=bracket_w)
    draw.line([x1, y1, x1, y1 - bracket_len], fill=bracket_col, width=bracket_w)

def draw_laser_scanline(overlay: Image.Image, x0: int, x1: int, y_laser: int):
    draw = ImageDraw.Draw(overlay)
    trail_h = 90
    
    # Gradient trail above laser
    for i in range(trail_h):
        alpha = int(90 * (i / trail_h) ** 2)
        y_cur = y_laser - trail_h + i
        draw.line([x0, y_cur, x1, y_cur], fill=(31, 138, 91, alpha), width=1)

    # Core laser glow
    draw.line([x0, y_laser - 2, x1, y_laser - 2], fill=(42, 171, 104, 160), width=5)
    draw.line([x0, y_laser, x1, y_laser], fill=(255, 255, 255, 255), width=2)

def draw_sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, color=(250, 196, 56, 255)):
    pts = [
        (cx, cy - size),
        (cx + size // 4, cy - size // 4),
        (cx + size, cy),
        (cx + size // 4, cy + size // 4),
        (cx, cy + size),
        (cx - size // 4, cy + size // 4),
        (cx - size, cy),
        (cx - size // 4, cy - size // 4),
    ]
    draw.polygon(pts, fill=color)

# ── Precomputed Static Layers for Fast 60 FPS Render ─────────────────────────
BASE_BG = Image.new("RGBA", (WIDTH, HEIGHT), BG_COLOR + (255,))
_glow_overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
_glow_draw = ImageDraw.Draw(_glow_overlay)
_glow_draw.ellipse(
    [WIDTH // 2 - 540, HEIGHT // 2 - 540 + 100, WIDTH // 2 + 540, HEIGHT // 2 + 540 + 100],
    fill=(31, 138, 91, 35)
)
_glow_overlay = _glow_overlay.filter(ImageFilter.GaussianBlur(80))
BASE_BG.alpha_composite(_glow_overlay)

_shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
_shadow_draw = ImageDraw.Draw(_shadow)
_shadow_draw.rounded_rectangle([PHONE_X + 8, PHONE_Y + 18, PHONE_X + PHONE_W + 8, PHONE_Y + PHONE_H + 18], radius=RADIUS + 4, fill=(0, 0, 0, 75))
_shadow = _shadow.filter(ImageFilter.GaussianBlur(30))
BASE_BG.alpha_composite(_shadow)

SCREEN_MASK = Image.new("L", (SCREEN_W, SCREEN_H), 0)
_mask_draw = ImageDraw.Draw(SCREEN_MASK)
_mask_draw.rounded_rectangle([0, 0, SCREEN_W, SCREEN_H], radius=SCREEN_RADIUS, fill=255)

PHONE_GLOSS = Image.new("RGBA", (PHONE_W, PHONE_H), (0, 0, 0, 0))
_gloss_draw = ImageDraw.Draw(PHONE_GLOSS)
_gloss_draw.polygon([(RAIL, RAIL), (PHONE_W - RAIL, RAIL), (PHONE_W - RAIL, 350), (RAIL, 180)], fill=(255, 255, 255, 18))

# ── Frame Renderer ──────────────────────────────────────────────────────────────
def render_frame(frame_idx: int) -> Image.Image:
    t = frame_idx / FPS  # Current time in seconds
    
    # 1. Base Canvas & Background
    frame = BASE_BG.copy()
    draw = ImageDraw.Draw(frame)

    # 2. Top Header Text & Badges (Dynamic by Scene)
    badge_text = "✦ ON-DEVICE AI TRACKER"
    headline = "Know your money."
    subtitle = "Zero typing. Private on-device tracking with AI."

    if t < 3.15:
        badge_text = "✦ ON-DEVICE AI TRACKER"
        headline = "Know your money."
        subtitle = "Zero typing. Private on-device tracking with AI."
    elif t < 5.65:
        badge_text = "✦ CAMERA & STATEMENT SCAN"
        headline = "Snap transaction history."
        subtitle = "Works with Touch 'n Go, Grab, MAE, banks & receipts."
    elif t < 9.20:
        badge_text = "✦ INSTANT LOCAL OCR"
        headline = "Snap it. Pip reads it."
        subtitle = "Extracts all transactions in seconds with on-device AI."
    elif t < 12.40:
        badge_text = "✦ AUTO-CATEGORIZED"
        headline = "Categorized & recorded."
        subtitle = "Pip learns your merchants and updates your budget."
    else:
        badge_text = "✦ LIVE BALANCE UPDATED"
        headline = "Everything in one place."
        subtitle = "100% on-device & private. Available on Google Play."

    # Draw Badge
    badge_w = 420
    badge_h = 42
    badge_x = (WIDTH - badge_w) // 2
    badge_y = 110
    draw_rounded_rect(draw, [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h], radius=21, fill=ACCENT_SOFT)
    draw.text((WIDTH // 2, badge_y + 21), badge_text, fill=ACCENT_GREEN, font=FONT_BADGE, anchor="mm")

    # Draw Headline & Subtitle
    draw.text((WIDTH // 2, 205), headline, fill=INK_PRIMARY, font=FONT_HEADLINE, anchor="mm")
    draw.text((WIDTH // 2, 275), subtitle, fill=INK_SECONDARY, font=FONT_SUBTITLE, anchor="mm")

    # Accent underline
    draw_rounded_rect(draw, [WIDTH // 2 - 45, 325, WIDTH // 2 + 45, 331], radius=3, fill=ACCENT_GREEN)

    # 3. Create Phone Screen Surface
    screen_surf = Image.new("RGBA", (SCREEN_W, SCREEN_H), (239, 241, 238, 255))

    # Center Add Button location on screen surface:
    add_btn_screen_x = 326
    add_btn_screen_y = 1251

    # SCENE DISPATCH FOR SCREEN CONTENT:
    if t < 3.15:
        # Scene 1 & 2: Actual Home Screen with Bottom Navigation Bar
        screen_surf.paste(HOME_SCREEN_IMG, (0, 0))

        # Tactile Add Button Press effect on screen when clicking (2.1s <= t <= 2.35s)
        if 2.10 <= t <= 2.35:
            p_press = (t - 2.10) / 0.25
            press_overlay = Image.new("RGBA", (SCREEN_W, SCREEN_H), (0, 0, 0, 0))
            p_draw = ImageDraw.Draw(press_overlay)
            r_btn = 38
            p_draw.ellipse(
                [add_btn_screen_x - r_btn, add_btn_screen_y - r_btn, add_btn_screen_x + r_btn, add_btn_screen_y + r_btn],
                fill=(22, 95, 60, 90)
            )
            rip_r = int(42 + p_press * 36)
            rip_a = int(180 * (1 - p_press))
            p_draw.ellipse(
                [add_btn_screen_x - rip_r, add_btn_screen_y - rip_r, add_btn_screen_x + rip_r, add_btn_screen_y + rip_r],
                outline=(42, 171, 104, rip_a), width=3
            )
            screen_surf.alpha_composite(press_overlay)

    elif t < 5.65:
        # Scene 3: Camera Viewfinder with Touch 'n Go Transaction History (Immediate switch on tap after +0.8s hold!)
        screen_surf.paste(TNG_SCREEN_IMG, (0, 0))

        cam_overlay = Image.new("RGBA", (SCREEN_W, SCREEN_H), (0, 0, 0, 0))
        cam_draw = ImageDraw.Draw(cam_overlay)
        
        # Dark vignette on camera top/bottom edge
        cam_draw.rectangle([0, 0, SCREEN_W, 90], fill=(0, 0, 0, 160))
        cam_draw.rectangle([0, SCREEN_H - 180, SCREEN_W, SCREEN_H], fill=(0, 0, 0, 180))

        # Top Camera Header
        cam_draw.text((SCREEN_W // 2, 54), "STATEMENT DETECTED", fill=WHITE, font=FONT_HUD, anchor="mm")
        cam_draw.text((SCREEN_W // 2, 78), "Touch 'n Go eWallet", fill=ACCENT_GREEN_BRIGHT, font=FONT_SMALL, anchor="mm")

        # Viewfinder Brackets
        pulse_val = 0.8 + 0.2 * math.sin(t * 8)
        draw_camera_viewfinder(cam_draw, 40, 110, SCREEN_W - 40, SCREEN_H - 200, pulse=pulse_val)

        # Camera Shutter Button at Bottom
        shutter_y = SCREEN_H - 95
        shutter_pressed = (5.25 <= t <= 5.45)
        sh_scale = 0.90 if shutter_pressed else 1.0
        sh_r = int(40 * sh_scale)
        cam_draw.ellipse([SCREEN_W // 2 - sh_r, shutter_y - sh_r, SCREEN_W // 2 + sh_r, shutter_y + sh_r], fill=WHITE, outline=(200, 200, 200), width=4)
        cam_draw.ellipse([SCREEN_W // 2 - int(32 * sh_scale), shutter_y - int(32 * sh_scale), SCREEN_W // 2 + int(32 * sh_scale), shutter_y + int(32 * sh_scale)], fill=ACCENT_GREEN)

        screen_surf.alpha_composite(cam_overlay)

        # Camera Flash Effect at t = 5.3s
        if 5.30 <= t <= 5.65:
            flash_p = 1.0 - (t - 5.30) / 0.35
            flash_alpha = int(255 * (flash_p ** 2))
            flash_layer = Image.new("RGBA", (SCREEN_W, SCREEN_H), (255, 255, 255, flash_alpha))
            screen_surf.alpha_composite(flash_layer)

    elif t < 9.20:
        # Scene 4: AI OCR Scanning
        screen_surf.paste(CAPTURE_SCREEN_IMG, (0, 0))

        scan_progress = (t - 5.65) / 3.2
        y_laser = int(180 + scan_progress * (SCREEN_H - 320))

        laser_overlay = Image.new("RGBA", (SCREEN_W, SCREEN_H), (0, 0, 0, 0))
        draw_laser_scanline(laser_overlay, 30, SCREEN_W - 30, y_laser)

        # Extraction HUD Box
        hud_draw = ImageDraw.Draw(laser_overlay)
        hud_w = 440
        hud_h = 54
        hud_x = (SCREEN_W - hud_w) // 2
        draw_rounded_rect(hud_draw, [hud_x, 80, hud_x + hud_w, 80 + hud_h], radius=27, fill=(22, 32, 27, 230), outline=ACCENT_GREEN_BRIGHT, width=2)
        
        extracted_count = min(6, int(scan_progress * 8))
        hud_msg = f"Reading items... ({extracted_count}/6 found)" if extracted_count < 6 else "✓ 6 transactions identified (0.8s)"
        hud_draw.text((SCREEN_W // 2, 107), hud_msg, fill=WHITE, font=FONT_HUD, anchor="mm")

        # Bounding box pulse over extracted items
        if scan_progress > 0.30:
            draw_rounded_rect(hud_draw, [45, 380, SCREEN_W - 45, 480], radius=14, outline=(42, 171, 104, 180), width=2)
        if scan_progress > 0.55:
            draw_rounded_rect(hud_draw, [45, 500, SCREEN_W - 45, 600], radius=14, outline=(42, 171, 104, 180), width=2)
        if scan_progress > 0.80:
            draw_rounded_rect(hud_draw, [45, 620, SCREEN_W - 45, 720], radius=14, outline=(42, 171, 104, 180), width=2)

        screen_surf.alpha_composite(laser_overlay)

    elif t < 12.40:
        # Scene 5: Auto-Categorized & Saving Confirmation
        screen_surf.paste(CAPTURE_SCREEN_IMG, (0, 0))

        cat_overlay = Image.new("RGBA", (SCREEN_W, SCREEN_H), (0, 0, 0, 0))
        cat_draw = ImageDraw.Draw(cat_overlay)

        # Save success banner when t >= 10.7s
        if t >= 10.7:
            banner_w = 480
            banner_h = 70
            bx = (SCREEN_W - banner_w) // 2
            by = SCREEN_H - 160
            draw_rounded_rect(cat_draw, [bx, by, bx + banner_w, by + banner_h], radius=35, fill=ACCENT_GREEN)
            cat_draw.text((SCREEN_W // 2, by + 35), "✓ Saved to Live Ledger!", fill=WHITE, font=FONT_CTA, anchor="mm")

            sp_progress = (t - 10.7) / 1.7
            for idx, (ang, dist, sz) in enumerate([
                (0.2, 180, 22), (0.8, 220, 18), (1.5, 160, 26), (2.2, 240, 20),
                (3.0, 190, 24), (3.8, 210, 19), (4.5, 170, 25), (5.3, 230, 21)
            ]):
                curr_dist = dist * ease_out_back(sp_progress)
                cx = int(SCREEN_W // 2 + curr_dist * math.cos(ang))
                cy = int((by + 35) + curr_dist * math.sin(ang))
                draw_sparkle(cat_draw, cx, cy, sz, color=(250, 196, 56, int(255 * (1 - sp_progress))))

        screen_surf.alpha_composite(cat_overlay)

    else:
        # Scene 6: Returned to Live Home Screen with Updated Transactions
        screen_surf.paste(HOME_SCREEN_IMG, (0, 0))

        ret_overlay = Image.new("RGBA", (SCREEN_W, SCREEN_H), (0, 0, 0, 0))
        ret_draw = ImageDraw.Draw(ret_overlay)
        
        pulse_alpha = int(120 + 80 * math.sin((t - 12.4) * 8))
        draw_rounded_rect(ret_draw, [35, 780, SCREEN_W - 35, 960], radius=18, outline=(31, 138, 91, pulse_alpha), width=3)
        
        draw_rounded_rect(ret_draw, [SCREEN_W - 220, 765, SCREEN_W - 50, 800], radius=12, fill=ACCENT_GREEN)
        ret_draw.text((SCREEN_W - 135, 782), "✦ JUST ADDED", fill=WHITE, font=FONT_SMALL, anchor="mm")

        screen_surf.alpha_composite(ret_overlay)

    # 4. Draw Safe Area Strip & Dynamic Island inside Screen
    screen_draw = ImageDraw.Draw(screen_surf)
    draw_dynamic_island(screen_draw, SCREEN_W // 2, 10)

    # Paste Screen onto Phone Frame
    phone_surf = Image.new("RGBA", (PHONE_W, PHONE_H), (22, 32, 27, 255))
    phone_draw = ImageDraw.Draw(phone_surf)
    phone_draw.rounded_rectangle([0, 0, PHONE_W, PHONE_H], radius=RADIUS, fill=(22, 32, 27))
    phone_surf.paste(screen_surf, (RAIL, RAIL), SCREEN_MASK)
    phone_surf.alpha_composite(PHONE_GLOSS)

    # 5. Composite Phone onto Frame Canvas
    frame.paste(phone_surf, (PHONE_X, PHONE_Y), phone_surf)

    # 6. Touch Pointer / Cursor Animation
    add_btn_canvas_x = SCREEN_X + add_btn_screen_x # 540 (exact center)
    add_btn_canvas_y = SCREEN_Y + add_btn_screen_y # 1725

    if 0.5 <= t < 3.15:
        if t < 2.1:
            p = ease_out_cubic((t - 0.5) / 1.6)
            cur_x = int(720 + (add_btn_canvas_x - 720) * p)
            cur_y = int(1850 + (add_btn_canvas_y - 1850) * p)
            draw_cursor(frame, cur_x, cur_y, pressed=False)
        elif t <= 2.35:
            # Button is pressed down!
            rip_rad = int((t - 2.1) * 180)
            draw_cursor(frame, add_btn_canvas_x, add_btn_canvas_y, pressed=True, ripple_radius=rip_rad)
        else:
            # Holding on tapped state for +0.8s before scene switch
            draw_cursor(frame, add_btn_canvas_x, add_btn_canvas_y, pressed=False)

    elif 4.3 <= t < 5.6:
        shutter_cam_y = PHONE_Y + SCREEN_H - 95
        if t < 5.25:
            p = ease_in_out((t - 4.3) / 0.95)
            cur_x = int(320 + (add_btn_canvas_x - 320) * p)
            cur_y = int(1350 + (shutter_cam_y - 1350) * p)
            draw_cursor(frame, cur_x, cur_y, pressed=False)
        elif t <= 5.45:
            draw_cursor(frame, add_btn_canvas_x, shutter_cam_y, pressed=True, ripple_radius=int((t - 5.25) * 160))

    elif 9.6 <= t < 11.1:
        save_btn_y = PHONE_Y + SCREEN_H - 125
        if t < 10.6:
            p = ease_in_out((t - 9.6) / 1.0)
            cur_x = int(720 + (add_btn_canvas_x - 720) * p)
            cur_y = int(1420 + (save_btn_y - 1420) * p)
            draw_cursor(frame, cur_x, cur_y, pressed=False)
        elif t <= 10.9:
            draw_cursor(frame, add_btn_canvas_x, save_btn_y, pressed=True, ripple_radius=int((t - 10.6) * 160))

    return frame.convert("RGB")

# ── Main Video Compilation Pipeline ─────────────────────────────────────────────
def main():
    print(f"Generating audio track at {OUT_AUDIO_PATH}...")
    audio_path = generate_audio_track()

    print(f"Starting video encoding: {TOTAL_FRAMES} frames ({DURATION_SEC}s @ {FPS}fps)...")
    
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-i", str(audio_path),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(OUT_VIDEO_PATH)
    ]

    # Key snapshot checkpoints for storyboard review
    snapshot_times = {
        "scene1_home.jpg": 1.2,
        "scene2_add_tap.jpg": 2.25,
        "scene3_camera_scan.jpg": 4.4,
        "scene4_ocr_extraction.jpg": 7.6,
        "scene5_categorized_saved.jpg": 11.4,
        "scene6_dashboard_updated.jpg": 14.3,
    }
    snapshot_frames = {name: int(sec * FPS) for name, sec in snapshot_times.items()}

    p = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f_idx in range(TOTAL_FRAMES):
        if f_idx % 120 == 0:
            pct = (f_idx / TOTAL_FRAMES) * 100
            print(f"  Rendering frame {f_idx}/{TOTAL_FRAMES} ({pct:.1f}%)...")
        frame_img = render_frame(f_idx)
        for s_name, s_fidx in snapshot_frames.items():
            if f_idx == s_fidx:
                frame_img.save(SNAPSHOTS_DIR / s_name, quality=92)
        p.stdin.write(frame_img.tobytes())

    p.stdin.close()
    p.wait()

    if p.returncode == 0:
        file_size = OUT_VIDEO_PATH.stat().st_size / (1024 * 1024)
        print(f"\n✨ Promo Video rendered successfully!")
        print(f"📁 Output file: {OUT_VIDEO_PATH} ({file_size:.2f} MB)")
        print(f"🖼️  Snapshots saved to: {SNAPSHOTS_DIR}")
    else:
        print(f"FFmpeg error: process exited with return code {p.returncode}", file=sys.stderr)

if __name__ == "__main__":
    main()
