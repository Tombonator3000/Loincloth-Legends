"""Lager malene i docs/maler/ som lastes opp til ChatGPT sammen med prompten (etter Toms Morbidium, tools/lag_maler.py).

All hjelpegrafikk er ren magenta (#ff00ff) på gjennomsiktig bakgrunn, så tools/process_art.py kan fjerne den igjen.
  mal_figur.png    1536 x 1024, 3 x 2 ruter: HEAD, TORSO, PELVIS øverst og ARM, LEG, WEAPON nederst, med merker for
                   leddene (nakken nederst på hodet, midjen, beltet, skulderen, neven, hofta, sålen og grepet).
                   Lagres av ChatGPT som figur_<id>.png, og hver rute blir <id>_<del>.
  mal_ni_ting.png  1024 x 1024, 3 x 3 ruter med et kryss nederst i midten. Lagres som ark__<navn>__<navn>...png.
Bruk: python3 tools/make_templates.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROT = Path(__file__).resolve().parent.parent
UT = ROT / 'docs' / 'maler'
M = (255, 0, 255, 255)


def font(s):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'DejaVuSans-Bold.ttf'):
        try: return ImageFont.truetype(f, s)
        except OSError: pass
    return ImageFont.load_default()


def kryss(d, x, y, s=12, w=4):
    d.line([(x - s, y), (x + s, y)], fill=M, width=w); d.line([(x, y - s), (x, y + s)], fill=M, width=w)


def prikk(d, x, y, r=8):
    d.ellipse((x - r, y - r, x + r, y + r), fill=M)


def stiplet(d, a, b, w=3, seg=14):
    L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(L / seg))
    for i in range(0, n, 2):
        t0, t1 = i / n, min(1, (i + 1) / n)
        d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill=M, width=w)


def merke(d, x, y, tekst, f):
    d.text((x, y), tekst, fill=M, font=f, anchor='mm')


def figurmal():
    W, H, TOPP = 1536, 1024, 40
    im = Image.new('RGBA', (W, H), (255, 255, 255, 0)); d = ImageDraw.Draw(im)
    cw, ch = W / 3, (H - TOPP) / 2
    for i in range(1, 3): d.line([(i * cw, TOPP), (i * cw, H)], fill=M, width=2)
    d.line([(0, TOPP + ch), (W, TOPP + ch)], fill=M, width=2)
    f, liten = font(24), font(16)
    navn = [['HEAD', 'TORSO', 'PELVIS'], ['ARM', 'LEG', 'WEAPON']]
    for j in range(2):
        for i in range(3):
            x0, y0 = i * cw, TOPP + j * ch
            cx = x0 + cw / 2
            merke(d, cx, y0 + 18 if j else 20, navn[j][i], f)
            top, bunn = y0 + 50, y0 + ch - 20
            n = navn[j][i]
            if n == 'HEAD':
                kryss(d, cx, bunn); merke(d, cx, bunn - 22, 'bottom of neck', liten)
            elif n == 'TORSO':
                stiplet(d, (cx - 110, bunn), (cx + 110, bunn)); merke(d, cx, bunn - 16, 'waist', liten)
                prikk(d, cx, top + 30); merke(d, cx, top + 10, 'base of neck', liten)
            elif n == 'PELVIS':
                stiplet(d, (cx - 110, top), (cx + 110, top)); merke(d, cx, top + 18, 'belt (widest at the top)', liten)
            elif n == 'ARM':
                prikk(d, cx, top); merke(d, cx + 70, top, 'shoulder', liten)
                kryss(d, cx, bunn - 40); merke(d, cx + 60, bunn - 40, 'fist', liten)
            elif n == 'LEG':
                prikk(d, cx, top); merke(d, cx + 55, top, 'hip', liten)
                stiplet(d, (cx - 80, bunn), (cx + 120, bunn)); merke(d, cx + 20, bunn - 16, 'sole, toes right', liten)
            elif n == 'WEAPON':
                kryss(d, cx, top + (bunn - top) * .82); merke(d, cx + 55, top + (bunn - top) * .82, 'grip', liten)
                stiplet(d, (cx - 40, bunn), (cx + 40, bunn)); merke(d, cx, bunn - 16, 'end of handle', liten)
    im.save(UT / 'mal_figur.png')


def tingmal():
    W = H = 1024
    im = Image.new('RGBA', (W, H), (255, 255, 255, 0)); d = ImageDraw.Draw(im)
    cw, ch = W / 3, H / 3
    for i in range(1, 3):
        d.line([(i * cw, 0), (i * cw, H)], fill=M, width=2); d.line([(0, i * ch), (W, i * ch)], fill=M, width=2)
    for j in range(3):
        for i in range(3):
            kryss(d, cw * i + cw / 2, (j + 1) * ch - 20, 8, 3)
            d.line([(cw * i + 20, (j + 1) * ch - 20), (cw * (i + 1) - 20, (j + 1) * ch - 20)], fill=M, width=1)
    im.save(UT / 'mal_ni_ting.png')


if __name__ == '__main__':
    UT.mkdir(parents=True, exist_ok=True)
    figurmal(); tingmal()
    print('laget:', ', '.join(sorted(p.name for p in UT.glob('*.png'))))
