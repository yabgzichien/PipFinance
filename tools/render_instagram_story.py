#!/usr/bin/env python3
"""Generate a high-fidelity Instagram Story mockup with seamless device frame and clean white background."""

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path("/home/yang/Project/PipFinance")
SHOTS = ROOT / "AppStoreScreenshot"
OUT_DIR = ROOT / "InstagramStory"
OUT_DIR.mkdir(exist_ok=True)
BRAIN_DIR = Path("/home/yang/.gemini/antigravity/brain/8a07300a-88da-4662-9fa6-5714614b8629")

def create_rounded_rect_mask(size: tuple[int, int], radius: int, supersample: int = 4) -> Image.Image:
    """Create a super-sampled anti-aliased rounded rectangle mask."""
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
    color: tuple[int, int, int] = (15, 25, 20)
) -> Image.Image:
    """Generate a smooth Gaussian blurred drop shadow on an RGBA canvas."""
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
    blurred = shadow_layer.filter(ImageFilter.GaussianBlur(blur_radius))
    return blurred

def add_glass_gloss(screen_img: Image.Image, corner_radius: int) -> Image.Image:
    """Add realistic angled glass reflection highlight across the screen."""
    w, h = screen_img.size
    gloss = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    
    # Create diagonal polygon for reflection
    poly = [(0, 0), (w, 0), (w, int(h * 0.38)), (0, int(h * 0.68))]
    
    # Create linear gradient mask for gloss
    grad_mask = Image.new("L", (w, h), 0)
    for y in range(h):
        factor = max(0.0, 1.0 - (y / (h * 0.68)))
        val = int(255 * (factor ** 1.8) * 0.14)
        ImageDraw.Draw(grad_mask).line([(0, y), (w, y)], fill=val)
        
    poly_mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(poly_mask).polygon(poly, fill=255)
    
    final_mask = Image.new("L", (w, h), 0)
    final_mask.paste(grad_mask, (0, 0), poly_mask)
    
    white_layer = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    gloss.paste(white_layer, (0, 0), final_mask)
    
    return Image.alpha_composite(screen_img, gloss)

def render_instagram_story(
    screenshot_path: Path,
    crop_top: int = 132,
    screen_w: int = 680,
    bezel: int = 13,
    corner_radius: int = 50,
    bg_color: tuple[int, int, int] = (255, 255, 255),
    out_path: Path = None
) -> Image.Image:
    """Assemble complete 1080x1920 Instagram Story with phone mockup."""
    CANVAS_W, CANVAS_H = 1080, 1920
    
    # 1. Load and process screenshot
    src_im = Image.open(screenshot_path).convert("RGB")
    
    # Crop top Android status bar
    if crop_top > 0:
        src_im = src_im.crop((0, crop_top, src_im.width, src_im.height))
        
    scale = screen_w / src_im.width
    shot_h = round(src_im.height * scale)
    
    # Safe area at top for Dynamic Island
    safe_top = 44
    safe_bottom = 20
    screen_h = safe_top + shot_h + safe_bottom
    
    # Resize screenshot
    resized_shot = src_im.resize((screen_w, shot_h), Image.Resampling.LANCZOS)
    
    # Sample background color from the top and bottom of the screenshot for seamless blending
    top_color = resized_shot.getpixel((screen_w // 2, 2))
    bottom_color = resized_shot.getpixel((screen_w // 2, shot_h - 2))
    
    # Create screen canvas filled with header tone
    screen_canvas = Image.new("RGBA", (screen_w, screen_h), (*top_color, 255))
    
    # Fill bottom area if needed with bottom_color
    draw_screen_bg = ImageDraw.Draw(screen_canvas)
    draw_screen_bg.rectangle([(0, safe_top + shot_h), (screen_w, screen_h)], fill=(*bottom_color, 255))
    
    # Paste screenshot in middle
    screen_canvas.paste(resized_shot, (0, safe_top))
    
    # Add Dynamic Island (sleek iPhone 16/17 Pro pill)
    island_w, island_h = 120, 32
    island_x = (screen_w - island_w) // 2
    island_y = 10
    island_radius = island_h // 2
    
    draw_screen = ImageDraw.Draw(screen_canvas)
    draw_screen.rounded_rectangle(
        [(island_x, island_y), (island_x + island_w, island_y + island_h)],
        radius=island_radius,
        fill=(10, 14, 12, 255)
    )
    # Subtle camera lens dot inside island
    lens_x = island_x + island_w - 22
    lens_y = island_y + island_h // 2
    draw_screen.ellipse([(lens_x - 4, lens_y - 4), (lens_x + 4, lens_y + 4)], fill=(20, 26, 23, 255))
    draw_screen.ellipse([(lens_x - 2, lens_y - 2), (lens_x + 2, lens_y + 2)], fill=(32, 48, 58, 255))
    
    # Add iOS Home Indicator Bar at the bottom
    home_bar_w, home_bar_h = 138, 5
    home_bar_x = (screen_w - home_bar_w) // 2
    home_bar_y = screen_h - 10
    draw_screen.rounded_rectangle(
        [(home_bar_x, home_bar_y), (home_bar_x + home_bar_w, home_bar_y + home_bar_h)],
        radius=3,
        fill=(22, 28, 24, 200)
    )
    
    # Add screen glass gloss
    screen_canvas = add_glass_gloss(screen_canvas, corner_radius)
    
    # Screen rounded corner mask
    screen_mask = create_rounded_rect_mask((screen_w, screen_h), corner_radius)
    screen_layer = Image.new("RGBA", (screen_w, screen_h), (0, 0, 0, 0))
    screen_layer.paste(screen_canvas, (0, 0), screen_mask)
    
    # 2. Build Phone Chassis
    phone_w = screen_w + 2 * bezel
    phone_h = screen_h + 2 * bezel
    phone_radius = corner_radius + bezel
    
    # Base chassis layer
    chassis = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    chassis_draw = ImageDraw.Draw(chassis)
    
    # Vertical chassis gradient (Space Black / Titanium)
    chassis_mask = create_rounded_rect_mask((phone_w, phone_h), phone_radius)
    for y in range(phone_h):
        ratio = y / phone_h
        r = int(20 + ratio * 6)
        g = int(24 + ratio * 5)
        b = int(22 + ratio * 5)
        chassis_draw.line([(0, y), (phone_w, y)], fill=(r, g, b, 255))
    
    chassis_clipped = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    chassis_clipped.paste(chassis, (0, 0), chassis_mask)
    
    # Outer rim highlight stroke (1px metallic edge)
    draw_rim = ImageDraw.Draw(chassis_clipped)
    draw_rim.rounded_rectangle(
        [(1, 1), (phone_w - 2, phone_h - 2)],
        radius=phone_radius - 1,
        outline=(255, 255, 255, 36),
        width=1
    )
    
    # Inner display rim (black bezel border)
    draw_rim.rounded_rectangle(
        [(bezel - 1, bezel - 1), (bezel + screen_w, bezel + screen_h)],
        radius=corner_radius + 1,
        outline=(0, 0, 0, 160),
        width=1
    )
    
    # Paste screen inside chassis
    chassis_clipped.paste(screen_layer, (bezel, bezel), screen_layer)
    
    # 3. Add Hardware Side Buttons
    btn_thickness = 4
    full_device_w = phone_w + 2 * btn_thickness
    device_layer = Image.new("RGBA", (full_device_w, phone_h), (0, 0, 0, 0))
    device_draw = ImageDraw.Draw(device_layer)
    
    btn_color = (28, 34, 30, 255)
    btn_rim = (255, 255, 255, 45)
    
    def draw_side_btn(x0, y0, w, h, is_left=True):
        device_draw.rounded_rectangle([(x0, y0), (x0 + w, y0 + h)], radius=2, fill=btn_color)
        if is_left:
            device_draw.line([(x0, y0 + 1), (x0, y0 + h - 1)], fill=btn_rim)
        else:
            device_draw.line([(x0 + w, y0 + 1), (x0 + w, y0 + h - 1)], fill=btn_rim)
            
    # Button placements (relative to phone_h)
    draw_side_btn(0, int(phone_h * 0.155), btn_thickness + 1, int(phone_h * 0.036), True)  # Action
    draw_side_btn(0, int(phone_h * 0.218), btn_thickness + 1, int(phone_h * 0.062), True)  # Vol Up
    draw_side_btn(0, int(phone_h * 0.295), btn_thickness + 1, int(phone_h * 0.062), True)  # Vol Down
    
    # Right button (Power)
    draw_side_btn(full_device_w - btn_thickness - 1, int(phone_h * 0.232), btn_thickness + 1, int(phone_h * 0.096), False)
    
    # Paste chassis onto device layer
    device_layer.paste(chassis_clipped, (btn_thickness, 0), chassis_clipped)
    
    # 4. Canvas Assembly with Multi-Tier Drop Shadows
    story_canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (*bg_color, 255))
    
    # Centered placement
    device_x = (CANVAS_W - full_device_w) // 2
    device_y = (CANVAS_H - phone_h) // 2
    
    # Ambient Deep Shadow
    s1 = create_drop_shadow(
        width=phone_w,
        height=phone_h,
        radius=phone_radius,
        offset_y=38,
        blur_radius=50,
        opacity=0.13,
        color=(15, 25, 20)
    )
    pad1 = 50 * 3 + 38
    story_canvas.alpha_composite(s1, (device_x + btn_thickness - pad1, device_y - pad1))
    
    # Medium Contact Shadow
    s2 = create_drop_shadow(
        width=phone_w,
        height=phone_h,
        radius=phone_radius,
        offset_y=16,
        blur_radius=22,
        opacity=0.09,
        color=(0, 0, 0)
    )
    pad2 = 22 * 3 + 16
    story_canvas.alpha_composite(s2, (device_x + btn_thickness - pad2, device_y - pad2))
    
    # Tight Ground Rim Shadow
    s3 = create_drop_shadow(
        width=phone_w,
        height=phone_h,
        radius=phone_radius,
        offset_y=5,
        blur_radius=7,
        opacity=0.05,
        color=(0, 0, 0)
    )
    pad3 = 7 * 3 + 5
    story_canvas.alpha_composite(s3, (device_x + btn_thickness - pad3, device_y - pad3))
    
    # Paste Phone Device
    story_canvas.alpha_composite(device_layer, (device_x, device_y))
    
    # Convert to RGB (pure clean white background)
    final_rgb = Image.new("RGB", (CANVAS_W, CANVAS_H), bg_color)
    final_rgb.paste(story_canvas, (0, 0), story_canvas)
    
    if out_path:
        final_rgb.save(out_path, format="PNG", quality=100)
        print(f"Saved: {out_path}")
        
    return final_rgb

def main():
    src = SHOTS / "01_home_dashboard.jpg"
    if not src.exists():
        src = ROOT / "assets/screenshots/dashboard.png"
        
    out1 = OUT_DIR / "instagram_story_home_white.png"
    render_instagram_story(
        screenshot_path=src,
        crop_top=132,
        screen_w=680,
        bezel=13,
        corner_radius=48,
        bg_color=(255, 255, 255),
        out_path=out1
    )
    
    # Also save to root as requested
    root_out = ROOT / "instagram_story.png"
    out1_img = Image.open(out1)
    out1_img.save(root_out, "PNG", quality=100)
    
    # Also copy to artifacts directory
    brain_out = BRAIN_DIR / "instagram_story.png"
    out1_img.save(brain_out, "PNG", quality=100)
    
    print(f"All outputs generated successfully!")
    print(f"Root: {root_out}")
    print(f"InstagramStory: {out1}")
    print(f"Brain: {brain_out}")

if __name__ == "__main__":
    main()
