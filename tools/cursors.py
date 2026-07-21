#!/usr/bin/env python3
"""1-bit Mac-style cursors for the museum.
Authored at 16x16 (the real Mac cursor size), auto white-outlined for
visibility on ink and paper, upscaled x2 nearest to 32x32 PNGs.
Run:  venv/bin/python cursors.py   (outputs to ../assets/cursors/)
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "cursors")
os.makedirs(OUT, exist_ok=True)

INK = (16, 16, 16, 255)
PAPER = (242, 239, 231, 255)
CLEAR = (0, 0, 0, 0)

def from_ascii(rows):
    im = Image.new("RGBA", (16, 16), CLEAR)
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                px[x, y] = INK
            elif ch == ".":
                px[x, y] = PAPER
    return im

def outline(im):
    """every transparent pixel touching ink becomes paper (the white rim)"""
    px = im.load()
    add = []
    for y in range(16):
        for x in range(16):
            if px[x, y][3] == 0:
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < 16 and 0 <= ny < 16 and px[nx, ny] == INK:
                        add.append((x, y)); break
    for x, y in add:
        px[x, y] = PAPER
    return im

def save(im, name):
    outline(im).resize((32, 32), Image.NEAREST).save(os.path.join(OUT, name + ".png"))
    print("wrote", name + ".png")

# ---------------------------------------------------------------- arrow ----
save(from_ascii([
    "X               ",
    "XX              ",
    "XXX             ",
    "XXXX            ",
    "XXXXX           ",
    "XXXXXX          ",
    "XXXXXXX         ",
    "XXXXXXXX        ",
    "XXXXXXXXX       ",
    "XXXXXX          ",
    "X   XXX         ",
    "     XX         ",
    "      XX        ",
    "      XX        ",
    "                ",
    "                ",
]), "arrow")

# ------------------------------------------------- browse hand (pointing) --
save(from_ascii([
    "     XX         ",
    "    X..X        ",
    "    X..X        ",
    "    X..X        ",
    "    X..XXX      ",
    "    X..X..XXX   ",
    " XX X..X..X..XX ",
    "X..XX..X..X..X.X",
    "X...X..........X",
    "X..............X",
    " X.............X",
    " X.............X",
    "  X...........X ",
    "  X...........X ",
    "   XXXXXXXXXXX  ",
    "                ",
]), "hand")

# ------------------------------------------------------ directional arrows -
FWD = [
    "       XX       ",
    "      XXXX      ",
    "     XXXXXX     ",
    "    XXXXXXXX    ",
    "   XXXXXXXXXX   ",
    "  XXXXXXXXXXXX  ",
    " XXXXXXXXXXXXXX ",
    "      XXXX      ",
    "      XXXX      ",
    "      XXXX      ",
    "      XXXX      ",
    "      XXXX      ",
    "      XXXX      ",
    "      XXXX      ",
    "                ",
    "                ",
]
fwd = from_ascii(FWD)
save(fwd, "fwd")
save(fwd.rotate(180), "back")
save(fwd.rotate(90, expand=False), "left")
save(fwd.rotate(-90, expand=False), "right")

# --------------------------------------------------------------- magnifier -
im = Image.new("RGBA", (16, 16), CLEAR); d = ImageDraw.Draw(im)
d.ellipse((1, 1, 11, 11), outline=INK, width=2)
d.line((5, 6, 8, 6), fill=INK, width=1)   # +
d.line((6, 5, 6, 8), fill=INK, width=1)
d.line((10, 10, 14, 14), fill=INK, width=3)
save(im, "zoom")

# ------------------------------------------------------- listen (a note) --
im = Image.new("RGBA", (16, 16), CLEAR); d = ImageDraw.Draw(im)
d.ellipse((2, 10, 8, 15), fill=INK)
d.line((8, 1, 8, 13), fill=INK, width=2)
d.line((8, 1, 14, 4), fill=INK, width=2)
d.line((8, 5, 13, 7), fill=INK, width=2)
save(im, "listen")

# ------------------------------------------------------------------ quill --
im = Image.new("RGBA", (16, 16), CLEAR); d = ImageDraw.Draw(im)
d.polygon([(13, 0), (15, 2), (5, 12), (3, 14), (2, 13), (4, 11)], fill=INK)
d.line((2, 13, 0, 15), fill=INK, width=2)
d.line((10, 3, 12, 5), fill=PAPER, width=1)   # nib slit
save(im, "quill")

# -------------------------------------------------------------------- key --
im = Image.new("RGBA", (16, 16), CLEAR); d = ImageDraw.Draw(im)
d.ellipse((1, 4, 7, 10), outline=INK, width=2)
d.line((7, 7, 14, 7), fill=INK, width=2)
d.line((11, 7, 11, 10), fill=INK, width=2)
d.line((14, 7, 14, 11), fill=INK, width=2)
save(im, "key")

# ------------------------------------------------------------- watch x2 ----
for name, hands in (("watch1", ((8, 8, 8, 4), (8, 8, 11, 8))),
                    ("watch2", ((8, 8, 11, 5), (8, 8, 8, 11)))):
    im = Image.new("RGBA", (16, 16), CLEAR); d = ImageDraw.Draw(im)
    d.rectangle((5, 0, 10, 2), fill=INK)       # band
    d.rectangle((5, 13, 10, 15), fill=INK)
    d.ellipse((2, 2, 13, 13), outline=INK, width=2)
    d.ellipse((4, 4, 11, 11), fill=PAPER)
    for h in hands:
        d.line(h, fill=INK, width=1)
    save(im, name)

print("done.")
