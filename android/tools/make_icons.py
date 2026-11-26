#!/usr/bin/env python3
"""CloudGST launcher icon + splash generator.

PDF letterhead wala hi logo: navy (#12265C) band par gold (#C19A38) double ring
circle ke andar white "J&A". Yahi monogram launcher icon aur splash par use hota hai.
Run: python3 android/tools/make_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

NAVY = (18, 38, 92, 255)
GOLD = (193, 154, 56, 255)
WHITE = (255, 255, 255, 255)
RES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "app", "src", "main", "res")
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}


def monogram(size, background=None, content=0.62, ring_scale=1.0):
    """Navy/gold J&A badge. background=None -> transparent (adaptive foreground)."""
    S = size * 4  # supersample, phir downscale -> smooth edges
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if background is not None:
        d.rectangle([0, 0, S, S], fill=background)

    box = S * content
    cx = cy = S / 2.0
    r = box / 2.0 * ring_scale
    # gold double ring (PDF header jaisa: bahar mota, andar patla)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=GOLD, width=max(2, int(S * 0.016)))
    ri = r * 0.90
    d.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], outline=GOLD, width=max(1, int(S * 0.007)))

    # "J&A" text
    txt = "J&A"
    fs = int(r * 0.86)
    font = ImageFont.truetype(FONT_BOLD, fs)
    bb = d.textbbox((0, 0), txt, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text((cx - tw / 2.0 - bb[0], cy - th / 2.0 - bb[1]), txt, font=font, fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


def rounded(img, radius_ratio=0.22):
    S = img.size[0]
    mask = Image.new("L", (S * 4, S * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S * 4 - 1, S * 4 - 1],
                                           radius=int(S * 4 * radius_ratio), fill=255)
    mask = mask.resize((S, S), Image.LANCZOS)
    out = img.copy()
    out.putalpha(mask)
    return out


def circle_mask(img):
    S = img.size[0]
    mask = Image.new("L", (S * 4, S * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, S * 4 - 1, S * 4 - 1], fill=255)
    mask = mask.resize((S, S), Image.LANCZOS)
    out = img.copy()
    out.putalpha(mask)
    return out


def write(img, folder, name):
    path = os.path.join(RES, folder)
    os.makedirs(path, exist_ok=True)
    img.save(os.path.join(path, name), "PNG", optimize=True)


def main():
    for dens, scale in DENSITIES.items():
        # legacy launcher (48dp) — navy rounded square + gold ring + J&A
        legacy = int(48 * scale)
        write(rounded(monogram(legacy, background=NAVY)), "mipmap-" + dens, "ic_launcher.png")
        write(circle_mask(monogram(legacy, background=NAVY)), "mipmap-" + dens, "ic_launcher_round.png")
        # adaptive foreground (108dp canvas, content 62% => 66dp safe zone ke andar)
        fg = int(108 * scale)
        write(monogram(fg, background=None), "mipmap-" + dens, "ic_launcher_fg.png")

    # splash logo (transparent monogram + wordmark) — drawable-nodpi (density independent)
    S = 640
    splash = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    badge = monogram(int(S * 0.60), background=None, content=1.0, ring_scale=0.90)
    splash.alpha_composite(badge, (int(S * 0.20), int(S * 0.08)))
    d = ImageDraw.Draw(splash)
    font = ImageFont.truetype(FONT_BOLD, 78)
    txt = "CloudGST"
    bb = d.textbbox((0, 0), txt, font=font)
    d.text(((S - (bb[2] - bb[0])) / 2 - bb[0], int(S * 0.72)), txt, font=font, fill=WHITE)
    font2 = ImageFont.truetype(FONT_BOLD, 30)
    t2 = "GST  •  ETSY  •  CLIENTS"
    bb2 = d.textbbox((0, 0), t2, font=font2)
    d.text(((S - (bb2[2] - bb2[0])) / 2 - bb2[0], int(S * 0.90)), t2, font=font2, fill=GOLD)
    write(splash, os.path.join("drawable-nodpi"), "splash_logo.png")
    print("icons + splash generated in", RES)


if __name__ == "__main__":
    main()
