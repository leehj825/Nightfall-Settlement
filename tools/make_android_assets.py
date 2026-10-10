#!/usr/bin/env python3
"""Regenerate the Android launcher icons and splash screens from icons/icon-512.png (needs Pillow)."""
import glob, pathlib
from PIL import Image, ImageDraw
root = pathlib.Path(__file__).resolve().parent.parent
res = root / 'android' / 'app' / 'src' / 'main' / 'res'
icon = Image.open(root / 'icons' / 'icon-512.png').convert('RGBA')
def sized(n): return icon.resize((n, n), Image.LANCZOS)
for d, n in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    sized(n).save(res / f'mipmap-{d}' / 'ic_launcher.png')
    rnd = sized(n); mask = Image.new('L', (n * 4, n * 4), 0); ImageDraw.Draw(mask).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255); rnd.putalpha(mask.resize((n, n), Image.LANCZOS)); rnd.save(res / f'mipmap-{d}' / 'ic_launcher_round.png')
for d, n in {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}.items():
    sized(n).save(res / f'mipmap-{d}' / 'ic_launcher_foreground.png')
(res / 'values' / 'ic_launcher_background.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1A1030</color>\n</resources>\n')
for f in glob.glob(str(res / 'drawable*' / 'splash.png')):
    w, h = Image.open(f).size
    bg = Image.new('RGB', (w, h)); px = bg.load()
    for y in range(h):
        t = y / max(1, h - 1); c = (int(10 + 20 * (1 - t)), int(13 + 6 * (1 - t)), int(28 + 30 * (1 - t)))
        for x in range(w): px[x, y] = c
    s = int(min(w, h) * 0.32); bg.paste(icon.resize((s, s), Image.LANCZOS), ((w - s) // 2, (h - s) // 2), icon.resize((s, s), Image.LANCZOS))
    bg.save(f)
print('android icons + splash regenerated')
