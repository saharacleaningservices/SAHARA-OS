#!/usr/bin/env python3
"""
Client logo converter (owner 2026-11-03): JPG / PNG / WebP logo files -> transparent PNG-24 (RGBA) for the
homepage "Trusted by" strip.

  python3 scripts/convert-client-logos.py <input-folder-or-files...> [--out public/clients] [--height 160]

What it does to each file:
  1. Removes the solid background (white, off-white or flat grey) by flood-filling from the image border only, so white
     parts *inside* the logo (letters, counters, icons) are kept.
  2. Feathers the edge: pixels close to the background colour get partial transparency, so anti-aliased edges stay smooth
     on any background instead of showing a white halo.
  3. Trims the empty margin, then scales to a fixed height (default 160 px = sharp at 2x for a 80 px tile), never upscaling.
  4. Saves RGBA PNG-24 as public/clients/<slug>.png and prints a JSON line per logo to paste into src/lib/client-logos.ts.

Logos are used only as supplied / approved by each client.
"""
import argparse
import json
import re
import sys
from collections import deque
from pathlib import Path

from PIL import Image

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def border_color(img: Image.Image) -> tuple[int, int, int]:
    """Median colour of the outer 2 px frame — the background we remove."""
    w, h = img.size
    px = img.load()
    samples = []
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            samples.append(px[x, y][:3])
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            samples.append(px[x, y][:3])
    samples.sort(key=lambda c: sum(c))
    return samples[len(samples) // 2]


def remove_background(img: Image.Image, tol: int = 38, feather: int = 34) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    bg = border_color(img)
    # Only treat it as removable when the frame is light / neutral (white, off-white, grey) — never a coloured logo plate.
    if max(bg) - min(bg) > 30 or sum(bg) / 3 < 120:
        return img

    def dist(c):
        return max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2]))

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        d = dist((r, g, b))
        if a == 0 or d <= tol:
            px[x, y] = (r, g, b, 0)
        elif d <= tol + feather:
            # Edge pixel: partial alpha + un-blend the background so no halo remains.
            alpha = (d - tol) / feather
            def unblend(c, k):
                return max(0, min(255, round((c - bg[k] * (1 - alpha)) / max(alpha, 1e-3))))
            px[x, y] = (unblend(r, 0), unblend(g, 1), unblend(b, 2), round(a * alpha))
            continue  # don't flood past an edge pixel
        else:
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    return img


def convert(src: Path, out_dir: Path, height: int) -> dict:
    img = Image.open(src)
    img.load()
    if img.mode in ("P", "LA", "L"):
        img = img.convert("RGBA")
    has_alpha = img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 250
    img = img.convert("RGBA") if has_alpha else remove_background(img)
    bbox = img.getchannel("A").getbbox()
    if bbox:
        img = img.crop(bbox)
    if img.height > height:
        img = img.resize((round(img.width * height / img.height), height), Image.LANCZOS)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = src.stem.replace("_", " ").replace("-", " ").strip()
    out = out_dir / f"{slugify(name)}.png"
    img.save(out, "PNG", optimize=True)  # RGBA -> PNG-24 with alpha
    return {"name": name, "src": "/" + str(out).split("public/", 1)[-1], "width": img.width, "height": img.height}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--out", default="public/clients")
    ap.add_argument("--height", type=int, default=160)
    a = ap.parse_args()
    files: list[Path] = []
    for p in map(Path, a.inputs):
        files += sorted(f for f in p.iterdir() if f.suffix.lower() in EXTS) if p.is_dir() else [p]
    if not files:
        print("No logo files found.", file=sys.stderr)
        return 1
    for f in files:
        print(json.dumps(convert(f, Path(a.out), a.height)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
