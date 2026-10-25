"""Basit uygulama ikonu uretir (assets/app.ico)."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "app.ico"


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(size // 16, 2)
    draw.rounded_rectangle(
        (pad, pad, size - pad, size - pad),
        radius=size // 5,
        fill=(15, 23, 32, 255),
    )
    # Mavi daire + pin
    cx, cy = size // 2, int(size * 0.42)
    r = int(size * 0.18)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(47, 129, 247, 255))
    draw.polygon(
        [(cx, int(size * 0.78)), (cx - int(size * 0.16), int(size * 0.52)),
         (cx + int(size * 0.16), int(size * 0.52))],
        fill=(47, 129, 247, 255),
    )
    inner = max(r // 3, 2)
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=(230, 237, 243, 255))
    return img


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = [draw_icon(s) for s in sizes]
    images[0].save(OUT, format="ICO", sizes=[(s, s) for s in sizes], append_images=images[1:])
    print(f"Ikon yazildi: {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
