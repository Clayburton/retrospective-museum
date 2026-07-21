#!/usr/bin/env python3
"""Ingest Clay's 'Better art' — already-perfect 1-bit dithered line art.
   NO re-dithering: just threshold to pure black/white at native resolution
   and save lossless PNG (so the engine displays it 1:1, crisp forever).
   Elements (key/ufo/sky) keep alpha; a white sky variant is made for the
   black night street."""
import os
from PIL import Image

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "art")
SRC = os.path.join(BASE, "Better art")
OUT = BASE
os.makedirs(OUT, exist_ok=True)

def thresh(im, t=128):
    return im.convert("L").point(lambda v: 255 if v >= t else 0, "L")

def full(src_name, out_name, t=128):
    im = Image.open(os.path.join(SRC, "Full pictures", src_name))
    thresh(im, t).save(os.path.join(OUT, out_name + ".png"))
    print("full →", out_name)

def elem(src_name, out_name, t=140, white=False):
    im = Image.open(os.path.join(SRC, "Individual elements", src_name)).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r * 299 + g * 587 + b * 114) // 1000
            on = lum < t and a > 40           # black-ish, opaque
            if on:
                px[x, y] = (255, 255, 255, 255) if white else (0, 0, 0, 255)
            else:
                px[x, y] = (0, 0, 0, 0)
    im.save(os.path.join(OUT, out_name + ".png"))
    print("elem →", out_name)

# full scenes
full("facade.png", "facade")
full("hall-1.png", "hall-1")
full("hall-2.png", "hall-2")
full("door.png", "door")
full("rotunda.png", "rotunda")
full("Mirror room.png", "mirror")
full("Street.png", "street")
full("mouse hole.png", "mousehole")
full("room-2 picture- with mouse hole USE ONLY ONCE.png", "gallery-mh")
full("room-2- mouse hole zoom 1.png", "mh-zoom1")
full("Generated imaroom-2- mouse hole zoom 2.png", "mh-zoom2")
full("room-2 picture - simple.png", "gallery-a")
full("room-2 picture- Square circle.png", "gallery-b")
full("room-3 pictures - simple.png", "gallery-c")
full("room-3 - simple 2.png", "gallery-d")
full("hallway picture frame 1.png", "hframe")

# elements
elem("Key.png", "el-key")
elem("UFO.png", "el-ufo")
elem("Stray sky.png", "el-straysky", white=True)     # white stars for the black sky
elem("Hallway picture 1.png", "el-hpic1")
elem("Hallway picture 2.png", "el-hpic2")

print("done.")
