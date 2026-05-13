#!/usr/bin/env python3
"""Generate favicon and OG image for ChronoClassics luxury watch website."""

import os
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = "/Users/urielkalant/Desktop/website photos/chronoclassics-site/assets"

# Font paths to try
SERIF_FONT_PATH = "/System/Library/Fonts/Supplemental/Georgia.ttf"
HELVETICA_FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"

def load_font(path, size):
    """Load a font if it exists, otherwise fall back to PIL default."""
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

# ── 1. FAVICON ──────────────────────────────────────────────────────────────
def create_favicon():
    size = 64
    img = Image.new("RGBA", (size, size), (26, 26, 46, 255))  # #1a1a2e
    draw = ImageDraw.Draw(img)

    font = load_font(SERIF_FONT_PATH, 44)

    text = "C"
    # Get bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1]

    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    out_path = os.path.join(ASSETS_DIR, "favicon.png")
    img.save(out_path, "PNG")
    print(f"Favicon saved: {out_path}")
    return out_path


# ── 2. OG IMAGE ──────────────────────────────────────────────────────────────
def create_og_image():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), (15, 15, 26))  # base color

    # Draw dark gradient manually (top #0f0f1a → bottom #1e1a14)
    draw = ImageDraw.Draw(img)
    top_r, top_g, top_b = 0x0f, 0x0f, 0x1a
    bot_r, bot_g, bot_b = 0x1e, 0x1a, 0x14
    for y in range(H):
        t = y / H
        r = int(top_r + (bot_r - top_r) * t)
        g = int(top_g + (bot_g - top_g) * t)
        b = int(top_b + (bot_b - top_b) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # ── Paste logo ──────────────────────────────────────────────────────────
    logo_path = os.path.join(ASSETS_DIR, "logo-clean.PNG")
    logo_target_h = 120  # px tall
    logo_y_center = 170  # vertical center of logo

    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA")
        orig_w, orig_h = logo.size
        scale = logo_target_h / orig_h
        new_w = int(orig_w * scale)
        logo = logo.resize((new_w, logo_target_h), Image.LANCZOS)

        paste_x = (W - new_w) // 2
        paste_y = logo_y_center - logo_target_h // 2

        # Use alpha channel as mask if available, else paste directly
        if logo.mode == "RGBA":
            img.paste(logo, (paste_x, paste_y), mask=logo.split()[3])
        else:
            img.paste(logo, (paste_x, paste_y))
        print(f"Logo pasted at ({paste_x}, {paste_y}), size {new_w}×{logo_target_h}")
    else:
        print(f"Logo not found at {logo_path}, skipping.")

    draw = ImageDraw.Draw(img)

    # ── "ChronoClassics" heading ─────────────────────────────────────────────
    font_heading = load_font(SERIF_FONT_PATH, 72)
    text_heading = "ChronoClassics"
    bbox = draw.textbbox((0, 0), text_heading, font=font_heading)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (W - tw) // 2 - bbox[0]
    y = 330 - th // 2 - bbox[1]
    draw.text((x, y), text_heading, fill=(255, 255, 255), font=font_heading)

    # ── "Luxury Timepieces" subtitle ─────────────────────────────────────────
    font_sub = load_font(SERIF_FONT_PATH, 28)
    text_sub = "Luxury Timepieces"
    gold = (166, 139, 58)  # #a68b3a
    bbox = draw.textbbox((0, 0), text_sub, font=font_sub)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (W - tw) // 2 - bbox[0]
    y = 410 - th // 2 - bbox[1]
    draw.text((x, y), text_sub, fill=gold, font=font_sub)

    # ── Gold horizontal rule ─────────────────────────────────────────────────
    line_w = 400
    lx0 = (W - line_w) // 2
    lx1 = lx0 + line_w
    draw.line([(lx0, 450), (lx1, 450)], fill=gold, width=1)

    # ── Footer text ──────────────────────────────────────────────────────────
    font_footer = load_font(HELVETICA_FONT_PATH, 20)
    text_footer = "100% Positive eBay Feedback  ·  Authenticity Guaranteed  ·  New York"
    light_gray = (180, 180, 190)
    bbox = draw.textbbox((0, 0), text_footer, font=font_footer)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (W - tw) // 2 - bbox[0]
    y = 490 - th // 2 - bbox[1]
    draw.text((x, y), text_footer, fill=light_gray, font=font_footer)

    out_path = os.path.join(ASSETS_DIR, "og-image.jpg")
    img.save(out_path, "JPEG", quality=95)
    print(f"OG image saved: {out_path}")
    return out_path


if __name__ == "__main__":
    favicon_path = create_favicon()
    og_path = create_og_image()

    # Verify
    fav = Image.open(favicon_path)
    og  = Image.open(og_path)
    print(f"\nFavicon size: {fav.size}  (expected 64×64)")
    print(f"OG image size: {og.size}  (expected 1200×630)")
    print("\nDone!")
