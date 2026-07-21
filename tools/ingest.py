#!/usr/bin/env python3
"""Ingest generated art → grayscale square masters for the museum.
Usage: venv/bin/python ingest.py <input image> <card-id> [--photo]
Default mode expects 1-bit HyperCard-style LINE ART from the model: it melts
the model's own fake dither patterns into smooth tone (blur), flattens
surfaces (median) and lets the ENGINE re-pattern them cleanly — this is what
prevents moiré between the model's checkerboards and ours.
--photo keeps the old photographic ingest (blurless)."""
import sys, os
from PIL import Image, ImageOps, ImageFilter

def ingest(src, card, photo=False):
    out_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "art")
    os.makedirs(out_dir, exist_ok=True)
    im = Image.open(src).convert("L")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s)//2, (h - s)//2, (w + s)//2, (h + s)//2))
    if not photo:
        # melt the model's own pixel patterns into tone BEFORE resampling
        im = im.filter(ImageFilter.GaussianBlur(radius=max(1.2, s / 700)))
    im = im.resize((1536, 1536), Image.LANCZOS)
    if not photo:
        im = im.filter(ImageFilter.MedianFilter(size=5))   # flat surfaces, kept edges
    im = ImageOps.autocontrast(im, cutoff=1)
    out = os.path.join(out_dir, card + ".jpg")
    im.save(out, quality=84)
    print("wrote", out, os.path.getsize(out)//1024, "KB")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    ingest(sys.argv[1], sys.argv[2], photo="--photo" in sys.argv)
