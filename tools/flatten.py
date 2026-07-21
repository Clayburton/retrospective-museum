#!/usr/bin/env python3
"""Flatten the photographic masters into clean tonal ZONES so the engine's
patterns render flat and regular (the Osmo look) instead of patchy.
- strong median (edge-preserving flatten)
- quantize to a few levels, then majority-filter the level map (kills islands)
- blend a whisper of the original back so big surfaces keep gentle direction
Backs up originals to ../assets/art/orig/ on first run.
Run: venv/bin/python flatten.py [card ...]   (default: all masters)"""
import sys, os, glob, shutil
from PIL import Image, ImageOps, ImageFilter, ImageChops

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "art")
ORIG = os.path.join(ART, "orig")
LEVELS = 6

def flatten(path):
    os.makedirs(ORIG, exist_ok=True)
    name = os.path.basename(path)
    keep = os.path.join(ORIG, name)
    if not os.path.exists(keep):
        shutil.copy2(path, keep)
    im = Image.open(keep).convert("L")
    im = ImageOps.autocontrast(im, cutoff=1)
    # flatten surfaces, keep edges
    flat = im.filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.MedianFilter(9))
    flat = flat.filter(ImageFilter.GaussianBlur(1.2))
    # quantize → majority vote cleans stray islands → back to level tones
    q = flat.point(lambda v: int(round(v / 255 * (LEVELS - 1)) * (255 / (LEVELS - 1))))
    q = q.filter(ImageFilter.MedianFilter(9))
    q = q.point(lambda v: int(round(v / 255 * (LEVELS - 1)) * (255 / (LEVELS - 1))))
    # 15% of the smooth original keeps large surfaces from feeling dead
    out = ImageChops.blend(q, flat, 0.15)
    out.save(path, quality=88)
    print("flattened", name, os.path.getsize(path) // 1024, "KB")

if __name__ == "__main__":
    targets = sys.argv[1:]
    files = ([os.path.join(ART, t + ".jpg") for t in targets] if targets
             else sorted(glob.glob(os.path.join(ART, "*.jpg"))))
    files = [f for f in files if "cover-" not in f]
    for f in files:
        flatten(f)
