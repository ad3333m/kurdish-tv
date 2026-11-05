"""Draws the launcher icons (the Kurdistan flag: red, white, green, golden sun) and the Google TV banner.

    python tools/make_icons.py      (needs Pillow and Segoe UI or DejaVu Sans)
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RES = Path(__file__).resolve().parent.parent / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
RED, WHITE, GREEN, GOLD, DARK = (237, 32, 36), (255, 255, 255), (39, 142, 67), (254, 189, 17), (9, 10, 14)
FONTS = ["C:/Windows/Fonts/segoeuib.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
FONTS_LIGHT = ["C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]


def font(paths, size):
    for f in paths:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def sun(d, cx, cy, r):
    """The 21-rayed sun: disc radius 0.46r, rays from 0.52r to r."""
    d.ellipse([cx - 0.46 * r, cy - 0.46 * r, cx + 0.46 * r, cy + 0.46 * r], fill=GOLD)
    for i in range(21):
        a, w = i * 2 * math.pi / 21 - math.pi / 2, math.pi / 21 * 0.62
        pt = lambda rr, aa: (cx + math.cos(aa) * rr, cy + math.sin(aa) * rr)
        d.polygon([pt(0.52 * r, a - w), pt(r, a), pt(0.52 * r, a + w)], fill=GOLD)


def icon(n):
    s = n * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=255)
    flag = Image.new("RGBA", (s, s), WHITE)
    d = ImageDraw.Draw(flag)
    d.rectangle([0, 0, s, s / 3], fill=RED)
    d.rectangle([0, 2 * s / 3, s, s], fill=GREEN)
    sun(d, s / 2, s / 2, s * 0.3)
    im.paste(flag, (0, 0), mask)
    return im.resize((n, n), Image.LANCZOS)


def banner(w, h):
    k = 4
    im = Image.new("RGB", (w * k, h * k), DARK)
    d = ImageDraw.Draw(im)
    W, H = w * k, h * k
    for x in range(W):                                   # a faint red-to-green wash, like the app's guide
        t = x / W
        d.line([(x, 0), (x, H)], fill=(int(9 + 26 * (1 - t)), int(10 + 14 * t), int(14 + 4 * t)))
    d.rectangle([0, 0, W, H * 0.035], fill=RED)
    d.rectangle([0, H * 0.965, W, H], fill=GREEN)
    sun(d, H * 0.5, H * 0.5, H * 0.3)
    d.text((H * 0.92, H * 0.47), "Kurdish TV", font=font(FONTS, int(H * 0.22)), fill=WHITE, anchor="ls")
    d.text((H * 0.93, H * 0.66), "Kurdish · Arabic · English", font=font(FONTS_LIGHT, int(H * 0.1)), fill=(190, 195, 205), anchor="ls")
    return im.resize((w, h), Image.LANCZOS)


for name, k in DENSITIES.items():
    m = RES / f"mipmap-{name}"
    m.mkdir(parents=True, exist_ok=True)
    icon(round(48 * k)).save(m / "ic_launcher.png")
    b = RES / f"drawable-{name}"
    b.mkdir(parents=True, exist_ok=True)
    banner(round(160 * k), round(90 * k)).save(b / "tv_banner.png")
print("icons and banners written to", RES)
