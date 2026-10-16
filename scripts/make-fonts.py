"""Build the small web fonts in src/fonts/ from the full variable fonts you download from fonts.google.com.

You only need this if you ever change the fonts. Usage:
    pip install fonttools
    python3 scripts/make-fonts.py PATH_TO_BRICOLAGE.ttf PATH_TO_NEWSREADER.ttf PATH_TO_NEWSREADER_ITALIC.ttf

It trims each font to the weights the game uses and to the Latin characters, and saves compact WOFF files.
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "fonts")

# Basic Latin, Latin-1 (accents), a few Latin Extended letters, curly quotes, dashes, bullet, ellipsis, euro, minus.
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
    + [0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC]
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2212]
)

JOBS = [
    # name, weights the game uses, extra axes pinned
    ("bricolage-grotesque.woff", {"wdth": 100, "wght": (500, 800)}),
    ("newsreader.woff", {"wght": (400, 500)}),
    ("newsreader-italic.woff", {"wght": 400}),
]


def build(src, name, limits):
    font = TTFont(src)
    font = instancer.instantiateVariableFont(font, limits, inplace=False)
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # keep the copyright and licence notes
    opts.name_languages = [0x409]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    opts.flavor = "woff"
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font.flavor = "woff"
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    font.save(path)
    return path


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    for (name, limits), src in zip(JOBS, sys.argv[1:]):
        p = build(src, name, limits)
        print(f"{name}: {os.path.getsize(p) / 1024:.0f} KB")
