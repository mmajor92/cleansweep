#!/usr/bin/env python3
"""
Draws the Clean Sweep logo (a straw broom sweeping up a little dust, on the game's yellow) and writes every image the site needs into src/icons/:
  icon.svg              the full drawing, as a vector (the master copy of the logo)
  icon-small.svg        a solid, simpler version for browser tabs
  icon-32.png           browser-tab fallback for browsers without SVG icons (the simple version)
  icon-192.png, icon-512.png   home-screen icons for Android and installed web apps
  apple-touch-icon.png  home-screen icon for iPhone and iPad (a full square: iOS rounds the corners itself)
  social-preview.png    the picture shown when the link is shared (1200 x 630)
It also pastes the drawing into the page header in index.html (between <h1> and the title).

Run it from the repo root:  python3 scripts/make-icons.py      (needs Pillow and fontTools)
Everything is described once, as a list of shapes, so the SVG files and the PNGs always match.
"""
import io
import math
import os
import random
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "src", "icons")
YELLOW = (255, 194, 26)  # --tape
NAVY = (17, 37, 58)  # --ink (light theme)
DARK = (13, 22, 33)  # --bg (dark theme)
LIGHT = (232, 238, 243)  # --ink (dark theme)
MUTED = (154, 171, 186)  # --muted (dark theme)
CREAM = (255, 243, 196)
STRAW, SHADE, STRAW_LINE, BAND = (241, 207, 134), (217, 170, 80), (190, 140, 55), (176, 128, 48)
WOOD, COLLAR = (150, 98, 48), (58, 160, 232)
HEADER_VARIANT = "full"  # which drawing goes beside the page title: "full" or "small"
SS = 3  # supersampling for the PNGs


# ---------------------------------------------------------------- geometry helpers
def bez(p0, p1, p2, p3, n=28):
    pts = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        pts.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return pts


def qbez(p0, p1, p2, n=20):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]


def rot(p, deg):
    a = math.radians(deg)
    return (p[0] * math.cos(a) - p[1] * math.sin(a), p[0] * math.sin(a) + p[1] * math.cos(a))


def x_at(curve, y):
    for (x0, y0), (x1, y1) in zip(curve, curve[1:]):
        if y0 <= y <= y1 and y1 != y0:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return curve[-1][0]


# ---------------------------------------------------------------- the broom, upright, around the top of its collar (y down)
HANDLE_TOP = -175


def tips_row(half=140, base=268, n=17, seed=7):
    rnd = random.Random(seed)
    pts = [(-half, base)]
    for i in range(1, n):
        x = -half + 2 * half * i / n
        pts.append((x - 4, base + 4))
        pts.append((x + rnd.uniform(-3, 3), base + rnd.uniform(18, 36)))
    pts.append((half, base))
    return pts


def broom_parts():
    left = bez((-36, 50), (-70, 78), (-128, 150), (-140, 268))
    right = [(-x, y) for x, y in left]
    bottom = tips_row()
    return dict(
        left=left, right=right, bottom=bottom,
        head=left + bottom[1:] + list(reversed(right)),
        shade=[(24, 50)] + right + [p for p in reversed(bottom) if p[0] >= 44] + [(40, 268)],
        handle=[(-13, HANDLE_TOP), (13, HANDLE_TOP), (17, 8), (-17, 8)],
        ferrule=[(-26, 0), (26, 0), (38, 52), (-38, 52)],
        bands=[qbez((x_at(left, yb), yb), (0, yb + 26), (-x_at(left, yb), yb)) for yb in (122, 196)],
        straws=[[(i * 8, 66), (i * 26, 282)] for i in range(-4, 5)],
    )


def fit_transform(points, angle, frac, cx, cy):
    pts = [rot(p, angle) for p in points]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    s = frac * 512 / max(w, h)
    mx, my = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    return (lambda p: (cx + (rot(p, angle)[0] - mx) * s, cy + (rot(p, angle)[1] - my) * s)), s


# ---------------------------------------------------------------- the scene: a list of shapes in a 512 x 512 box
def puff(circles, fill, outline, w):
    return [("circle", (x, y), r + w, outline, None, 0) for x, y, r in circles] + [("circle", (x, y), r, fill, None, 0) for x, y, r in circles]


def broom_scene(detail=True):
    """The broom caught mid-sweep, its bristles dragging, with a puff of dust. `detail=False` is a solid silhouette for tiny sizes."""
    b = broom_parts()
    f, s = fit_transform(b["head"] + b["handle"] + b["ferrule"], 50, 0.80, 286, 236)
    dy = 392 - max(f(p)[1] for p in b["head"])
    g = lambda p: (f(p)[0], f(p)[1] + dy)

    def drag(p):  # the lower bristles trail behind, as they do when you sweep
        x, y = g(p)
        t = max(0.0, (y - 270) / (392 - 270))
        return (x + 34 * t * t, y)

    T = lambda pts: [g(p) for p in pts]
    D = lambda pts: [drag(p) for p in pts]
    sh = []
    if detail:
        sh.append(("poly", T(b["handle"]), WOOD, NAVY, 9))
        sh.append(("circle", g((0, HANDLE_TOP)), 13 * s, WOOD, NAVY, 5))
        sh.append(("poly", D(b["head"]), STRAW, None, 0))
        sh.append(("poly", D(b["shade"]), SHADE, None, 0))
        for st in b["straws"]:
            sh.append(("line", D(st), STRAW_LINE, 3.2 * s, False))
        for band in b["bands"]:
            sh.append(("line", D(band), BAND, 8, True))
        sh.append(("line", D(b["left"]), NAVY, 9, True))
        sh.append(("line", D(list(reversed(b["right"]))), NAVY, 9, True))
        sh.append(("line", D(b["bottom"]), NAVY, 4, False))
        sh.append(("poly", T(b["ferrule"]), COLLAR, NAVY, 9))
        sh += puff([(70, 380, 22), (102, 366, 17), (46, 366, 15), (78, 346, 14)], CREAM, NAVY, 6)
        sh += [("circle", (x, y), r, NAVY, None, 0) for x, y, r in [(30, 330, 6), (118, 330, 6), (56, 312, 5), (96, 304, 4)]]
    else:
        sh.append(("poly", T(b["handle"]), NAVY, None, 0))
        sh.append(("circle", g((0, HANDLE_TOP)), 13 * s, NAVY, None, 0))
        sh.append(("poly", D(b["head"]), NAVY, None, 0))
        sh.append(("poly", T(b["ferrule"]), NAVY, None, 0))
        sh.append(("line", D(b["bands"][0]), YELLOW, 15, True))
        sh += puff([(70, 380, 24), (104, 364, 18), (50, 362, 16)], YELLOW, NAVY, 0)
        sh += [("circle", (x, y), r, NAVY, None, 0) for x, y, r in [(70, 380, 24), (104, 364, 18), (50, 362, 16)]]
    return sh


def extent(shapes):
    xs, ys = [], []
    for sh in shapes:
        if sh[0] == "circle":
            (x, y), r = sh[1], sh[2]
            xs += [x - r, x + r]; ys += [y - r, y + r]
        else:
            xs += [p[0] for p in sh[1]]; ys += [p[1] for p in sh[1]]
    return min(xs), min(ys), max(xs), max(ys)


def centre(shapes, frac):
    """Scale and move the whole scene so it fills `frac` of the tile and sits in the middle (the dust is part of the picture)."""
    x0, y0, x1, y1 = extent(shapes)
    k = frac * 512 / max(x1 - x0, y1 - y0)
    ox, oy = 256 - (x0 + x1) / 2 * k, 256 - (y0 + y1) / 2 * k
    P = lambda pts: [(x * k + ox, y * k + oy) for x, y in pts]
    out = []
    for sh in shapes:
        if sh[0] == "poly":
            out.append(("poly", P(sh[1]), sh[2], sh[3], sh[4] * 1))
        elif sh[0] == "line":
            out.append(("line", P(sh[1]), sh[2], sh[3] * k if sh[3] > 20 else sh[3], sh[4]))
        else:
            out.append(("circle", P([sh[1]])[0], sh[2] * k, sh[3], sh[4], sh[5]))
    return out


# ---------------------------------------------------------------- renderers
def hexc(c):
    return "#%02X%02X%02X" % tuple(c)


def render_png(shapes, size, bg=YELLOW, rounded=True):
    big = size * SS
    k = big / 512
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.22), fill=bg)
    else:
        d.rectangle([0, 0, big, big], fill=bg)
    for sh in shapes:
        if sh[0] == "poly":
            _, pts, fill, stroke, w = sh
            q = [(x * k, y * k) for x, y in pts]
            d.polygon(q, fill=fill)
            if stroke and w:
                d.line(q + [q[0]], fill=stroke, width=max(1, int(w * k)), joint="curve")
        elif sh[0] == "line":
            _, pts, color, w, caps = sh
            q = [(x * k, y * k) for x, y in pts]
            ww = max(1, int(w * k))
            d.line(q, fill=color, width=ww, joint="curve")
            if caps:
                for (x, y) in (q[0], q[-1]):
                    d.ellipse([x - ww / 2, y - ww / 2, x + ww / 2, y + ww / 2], fill=color)
        else:
            _, (x, y), r, fill, stroke, w = sh
            x, y, rr = x * k, y * k, r * k
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=fill, outline=stroke if w else None, width=max(1, int(w * k)) if w else 0)
    return img.resize((size, size), Image.LANCZOS)


def render_svg(shapes, bg=YELLOW, attrs='role="img" aria-label="Clean Sweep: a broom"'):
    f = lambda v: ("%.1f" % v).rstrip("0").rstrip(".")
    pts = lambda p: " ".join(f"{f(x)},{f(y)}" for x, y in p)
    parts = [f'<rect width="512" height="512" rx="113" fill="{hexc(bg)}"/>']
    for sh in shapes:
        if sh[0] == "poly":
            _, p, fill, stroke, w = sh
            st = f' stroke="{hexc(stroke)}" stroke-width="{f(w)}" stroke-linejoin="round"' if stroke and w else ""
            parts.append(f'<polygon points="{pts(p)}" fill="{hexc(fill)}"{st}/>')
        elif sh[0] == "line":
            _, p, color, w, caps = sh
            parts.append(f'<polyline points="{pts(p)}" fill="none" stroke="{hexc(color)}" stroke-width="{f(w)}" stroke-linejoin="round"' + (' stroke-linecap="round"' if caps else "") + "/>")
        else:
            _, (x, y), r, fill, stroke, w = sh
            st = f' stroke="{hexc(stroke)}" stroke-width="{f(w)}"' if stroke and w else ""
            parts.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{hexc(fill)}"{st}/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" {attrs}>' + "".join(parts) + "</svg>"


def draw_icon(size, rounded=True):
    """Big sizes get the full drawing; small ones a solid silhouette that stays clear in a browser tab."""
    detail = size >= 96
    return render_png(centre(broom_scene(detail), 0.80 if detail else 0.86), size, rounded=rounded)


# ---------------------------------------------------------------- the share picture
def game_font(name, size, wght, opsz):
    from fontTools.ttLib import TTFont
    t = TTFont(os.path.join(ROOT, "src", "fonts", name + ".woff"))
    t.flavor = None
    buf = io.BytesIO()
    t.save(buf)
    buf.seek(0)
    font = ImageFont.truetype(buf, size)
    font.set_variation_by_axes([opsz, wght] if name == "bricolage-grotesque" else [wght, opsz])
    return font


def fit_font(draw, text, family, wght, opsz, max_width, start, floor=20):
    size = start
    while size > floor:
        font = game_font(family, size, wght, opsz)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 2
    return game_font(family, floor, wght, opsz)


def social_preview():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), DARK)
    d = ImageDraw.Draw(img)
    icon = draw_icon(340)
    img.paste(icon, (80, (H - 340) // 2), icon)
    x, room = 470, 1200 - 470 - 70
    lines = [
        ("Clean Sweep", "bricolage-grotesque", 800, 96, 124, LIGHT, 34),
        ("A daily chain of higher or lower questions.", "newsreader", 400, 36, 44, MUTED, 34),
        ("Can you get a clean sweep?", "bricolage-grotesque", 700, 48, 52, YELLOW, 0),
    ]
    fonts = [fit_font(d, t, fam, w, o, room, start) for t, fam, w, o, start, _, _ in lines]
    heights = [f.getbbox("Hg")[3] - f.getbbox("Hg")[1] for f in fonts]
    total = sum(heights) + sum(g for *_, g in lines[:-1])
    y = (H - total) // 2 - 10
    for (text, _, _, _, _, colour, gap), font, h in zip(lines, fonts, heights):
        d.text((x, y - font.getbbox("Hg")[1]), text, font=font, fill=colour)
        y += h + gap
    return img


def update_header(svg):
    """Put the drawing beside the title in index.html."""
    path = os.path.join(ROOT, "index.html")
    html = open(path, encoding="utf-8").read()
    inline = svg.replace(' role="img" aria-label="Clean Sweep: a broom"', ' class="logo" aria-hidden="true" focusable="false"')
    new, n = re.subn(r"<h1>(?:<svg[\s\S]*?</svg>)?Clean Sweep</h1>", lambda m: f"<h1>{inline}Clean Sweep</h1>", html, count=1)
    assert n == 1, "could not find the title in index.html"
    open(path, "w", encoding="utf-8").write(new)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    full = render_svg(centre(broom_scene(True), 0.80))
    small = render_svg(centre(broom_scene(False), 0.86))
    open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8").write(full + "\n")
    open(os.path.join(OUT, "icon-small.svg"), "w", encoding="utf-8").write(small + "\n")
    draw_icon(32).save(os.path.join(OUT, "icon-32.png"), optimize=True)
    draw_icon(192).save(os.path.join(OUT, "icon-192.png"), optimize=True)
    draw_icon(512).save(os.path.join(OUT, "icon-512.png"), optimize=True)
    draw_icon(180, rounded=False).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
    social_preview().save(os.path.join(OUT, "social-preview.png"), optimize=True)
    update_header(full if HEADER_VARIANT == "full" else small)
    for fn in sorted(os.listdir(OUT)):
        print(fn, os.path.getsize(os.path.join(OUT, fn)), "bytes")
