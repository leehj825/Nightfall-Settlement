"""Builds store/feature-graphic.png (1024x500) from a game screenshot plus the title. Run: python3 store/make_feature_graphic.py"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
src = Image.open('store/screenshots/1_title.png').convert('RGB')
W, H = 1024, 500
# crop the town area of the title screenshot, scale to cover
crop = src.crop((0, 330, 1920, 1080))
crop = crop.resize((W, int(crop.height * W / crop.width)), Image.LANCZOS)
bg = crop.crop((0, max(0, (crop.height - H) // 2), W, max(0, (crop.height - H) // 2) + H)).resize((W, H))
# dark gradient from the top and left so the text reads
g = np.zeros((H, W, 3), dtype=np.float32); a = np.linspace(0.85, 0.0, H)[:, None] ** 1.2
arr = np.asarray(bg, dtype=np.float32) * (1 - a[..., None]) + np.array([14, 8, 30], dtype=np.float32) * a[..., None]
im = Image.fromarray(arr.clip(0, 255).astype('uint8')); d = ImageDraw.Draw(im)
fb = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; fr = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def spaced(text, font, cx, y, sp, fill, shadow=None):
    ws = [d.textlength(c, font=font) for c in text]; x = cx - (sum(ws) + sp * (len(text) - 1)) / 2
    for c, w in zip(text, ws):
        if shadow: d.text((x + 2, y + 3), c, font=font, fill=shadow, anchor='lm')
        d.text((x, y), c, font=font, fill=fill, anchor='lm'); x += w + sp
spaced('A VILLAGE DEFENSE SAGA', ImageFont.truetype(fr, 19), W / 2, 54, 6, (240, 214, 150))
spaced('NIGHTFALL', ImageFont.truetype(fb, 92), W / 2, 130, 6, (255, 214, 120), (90, 40, 10))
spaced('SETTLEMENT', ImageFont.truetype(fb, 62), W / 2, 220, 8, (255, 214, 120), (90, 40, 10))
spaced('HOLD THE NIGHT. BUILD THE REALM.', ImageFont.truetype(fb, 22), W / 2, 300, 4, (255, 255, 255), (0, 0, 0))
im.save('store/feature-graphic.png'); print('saved', im.size)
