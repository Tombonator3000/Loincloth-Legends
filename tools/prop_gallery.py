"""Galleri over kulissene i manifestet (props): hvert bilde på rutemønster med navn, bredde, lag, rutenett og sett.
Til å se over mange bilder fra ChatGPT på én gang før de legges ut i brettverkstedet.

Krever Pillow:  pip install pillow
Bruk:           python3 tools/prop_gallery.py [--ut art/inbox/behandlet/galleri.png]
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROT = Path(__file__).resolve().parent.parent
UT = ROT / 'public' / 'assets'
RUTE, BILDE, KOL = 230, 200, 6


def rutemønster(w, h, s=12):
    im = Image.new('RGB', (w, h), (58, 50, 42))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2: d.rectangle((x, y, x + s - 1, y + s - 1), fill=(44, 38, 32))
    return im


def main():
    ut = Path(sys.argv[sys.argv.index('--ut') + 1]) if '--ut' in sys.argv else ROT / 'art' / 'inbox' / 'behandlet' / 'galleri.png'
    man = json.loads((UT / 'manifest.json').read_text(encoding='utf-8'))
    props = man.get('props', {})
    if not props:
        print('Manifestet har ingen kulisser (props) ennå.'); return
    navn = sorted(props)
    rader = (len(navn) + KOL - 1) // KOL
    ark = Image.new('RGB', (KOL * RUTE, rader * (RUTE + 40)), (24, 20, 16))
    tegn = ImageDraw.Draw(ark)
    for i, n in enumerate(navn):
        m = props[n]
        x, y = (i % KOL) * RUTE, (i // KOL) * (RUTE + 40)
        bak = rutemønster(BILDE, BILDE)
        fil = UT / m['file']
        tekst2 = ''
        if fil.exists():
            with Image.open(fil) as im:
                im = im.convert('RGBA')
                if 'grid' in m:
                    k, r = m['grid']
                    im = im.crop((0, 0, im.width // k, im.height // r))
                s = min(BILDE / im.width, BILDE / im.height)
                im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))))
                bak.paste(im, ((BILDE - im.width) // 2, BILDE - im.height), im)
        else:
            tekst2 = 'MANGLER FIL'
        ark.paste(bak, (x + (RUTE - BILDE) // 2, y + 8))
        info = [f"{m['w']} m" if 'w' in m else 'MÅL FRA PLASSHOLDEREN', str(m.get('layer', 'mid')).upper()]
        if 'grid' in m: info.append(f"{m['grid'][0]}x{m['grid'][1]} ({m.get('n', '?')})")
        if m.get('preset'): info.append(f"SETT {len(m['preset']) + 1}")
        tegn.text((x + 10, y + BILDE + 14), n[:34], fill=(240, 216, 168))
        tegn.text((x + 10, y + BILDE + 30), tekst2 or ' · '.join(info), fill=(154, 140, 116))
    ut.parent.mkdir(parents=True, exist_ok=True)
    ark.save(ut)
    print(f'{len(navn)} kulisser i {ut}')


if __name__ == '__main__':
    main()
