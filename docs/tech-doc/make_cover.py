# -*- coding: utf-8 -*-
"""把真实田野照片合成为技术文档封面底图（绿色渐变 + 底部压暗）。"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "assets")
SRC = os.path.join(ASSETS, "cover-field.jpg")
OUT = os.path.join(ASSETS, "cover-composed.jpg")

TARGET_W, TARGET_H = 2000, 1162           # 与 A4 上部封面区域比例一致（约 1.72:1）
GREEN = (47, 107, 79)
BOTTOM = (18, 44, 31)


def crop_to_ratio(im, ratio):
    w, h = im.size
    if w / h > ratio:
        nw = int(h * ratio)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = int(w / ratio)
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def main():
    photo = Image.open(SRC).convert("RGB")
    photo = crop_to_ratio(photo, TARGET_W / TARGET_H).resize(
        (TARGET_W, TARGET_H), Image.LANCZOS)

    # 左深右浅的绿色渐变：保证白色标题有足够对比，同时保留右侧田野照片
    grad = Image.new("RGBA", (TARGET_W, 1))
    px = grad.load()
    for x in range(TARGET_W):
        t = x / (TARGET_W - 1)
        alpha = int(round(255 * (0.94 - 0.76 * t)))
        px[x, 0] = (*GREEN, alpha)
    grad = grad.resize((TARGET_W, TARGET_H), Image.BILINEAR)
    photo = Image.alpha_composite(photo.convert("RGBA"), grad)

    # 底部压暗：右下角版本号与照片版权字样可读
    band_h = int(TARGET_H * 0.34)
    bottom = Image.new("RGBA", (1, band_h))
    bp = bottom.load()
    for y in range(band_h):
        t = y / (band_h - 1)                 # 0 顶部 → 1 底部
        alpha = int(round(255 * 0.45 * t))
        bp[0, y] = (*BOTTOM, alpha)
    bottom = bottom.resize((TARGET_W, band_h), Image.BILINEAR)
    overlay = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    overlay.paste(bottom, (0, TARGET_H - band_h))
    photo = Image.alpha_composite(photo, overlay)

    photo.convert("RGB").save(OUT, quality=92, optimize=True)
    print("cover:", OUT, photo.size)


if __name__ == "__main__":
    main()
