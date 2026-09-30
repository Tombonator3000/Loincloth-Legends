"""Tar imot bilder fra ChatGPT i art/inbox/ og gjør dem til ferdige filer i public/assets/, med manifestet oppdatert.

Gjenbrukt fra Toms Morbidium (tools/skjaer_ark.py, tools/behandle_bilder.py og tools/ta_imot_grafikk.py): magenta
hjelpelinjer og ensfarget bakgrunn fjernes, ark klippes i ruter, delene beskjæres, og sømmene i teksturer rettes med
en kopi forskjøvet et halvt bilde. Tilpasset Loincloth Legends: filnavnene under, manifestet i public/assets/manifest.json,
og ingen fast oppløsning per spillenhet, fordi spillet regner ut størrelsen fra figurens skjelett (se src/gfx/rig.ts).

Filnavnet bestemmer hva bildet er (små bokstaver, .png, .webp eller .jpg):
  <figur>_<del>.png      figurdel: head, hairback, torso, pelvis, arm, leg, weapon, eller body, tail for ridedyr
                         (valkyra_head.png, skeleton_arm.png, warhog_body.png)
  pet_<id>.png           kjæledyr (pet_rat.png)
  figur_<figur>.png      helt ark laget på docs/maler/mal_figur.png, 3 x 2 ruter:
                         head, torso, pelvis på øverste rad og arm, leg, weapon på nederste
  ark__<navn>__<navn>...png
                         ni ting laget på docs/maler/mal_ni_ting.png, 3 x 3, lest fra venstre og ovenfra. Hver rute får
                         navnet i sin plass (et av navnene over, uten .png). _ hopper over en rute
  tex_<navn>.png         tekstur, navnet fra teksturlista i docs/ART_PROMPTS.md (tex_ground_grass.png)
  sky_<biom>.png         himmel (sky_scorch.png, sky_arena-pit.png)
  map.png                verdenskartet

Originalene flyttes til art/inbox/behandlet/ (ligger ikke i git, repoet er offentlig og skal holdes lite).
Stopper uten å flytte noe hvis et bilde ikke kunne behandles.

Krever Pillow:  pip install pillow
Bruk:           python3 tools/process_art.py          tar imot alt i innboksen
                python3 tools/process_art.py --sjekk  viser bare hva som ville skjedd
"""
import json, re, shutil, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

piksler = lambda im: im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()

ROT = Path(__file__).resolve().parent.parent
INN = ROT / 'art' / 'inbox'
UT = ROT / 'public' / 'assets'
MANIFEST = UT / 'manifest.json'
SJEKK = '--sjekk' in sys.argv

FIGURDELER = {'head', 'hairback', 'torso', 'pelvis', 'arm', 'leg', 'weapon'}
DYREDELER = {'body', 'head', 'tail', 'leg'}
RIDEDYR = {'warhog', 'cluckatrice', 'magmanewt'}
HELTER = {'thrugg', 'valkyra'}
# Største side etter nedskalering. Heltene og forge_-delene vises på nært hold.
MAKS_HELT, MAKS_ANDRE, MAKS_TEKSTUR, MAKS_HIMMEL = 1024, 768, 1024, 1536
FIGURARK = [['head', 'torso', 'pelvis'], ['arm', 'leg', 'weapon']]
BAND = .12  # hvor langt inn fra kanten en søm blandes ut (andel av bredden eller høyden)


# ---------------------------------------------------------------- rensing (fra Morbidium)
def magenta(c):
    """Magenta hjelpegrafikk og glatte magentakanter, ikke rosa eller lilla (samme test som i Morbidium)."""
    return c[0] > 170 and c[2] > 170 and c[1] < min(c[0], c[2]) - 70


def fjern_magenta(im):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            if magenta(px[x, y]): px[x, y] = (255, 255, 255, 0)
    return im


def fjern_bakgrunn(im, grense=34):
    """Gjør bakgrunnsfargen gjennomsiktig hvis bildet ikke har gjennomsiktighet fra før. Flomfyll fra kantene, så bare
    sammenhengende bakgrunn forsvinner og ikke lignende farger inni figuren."""
    a = im.getchannel('A')
    if a.getextrema()[0] < 250 and sum(1 for v in piksler(a) if v < 20) > im.size[0] * im.size[1] * .2:
        return im  # har allerede gjennomsiktig bakgrunn
    px = im.load(); w, h = im.size
    hj = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    bg = tuple(sorted(c[i] for c in hj)[1] for i in range(3))
    nær = lambda c: c[3] == 0 or abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2]) < grense * 3
    seen = bytearray(w * h)
    st = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    while st:
        x, y = st.pop(); i = y * w + x
        if seen[i]: continue
        seen[i] = 1; c = px[x, y]
        if not nær(c): continue
        px[x, y] = (c[0], c[1], c[2], 0)
        if x: st.append((x - 1, y))
        if x < w - 1: st.append((x + 1, y))
        if y: st.append((x, y - 1))
        if y < h - 1: st.append((x, y + 1))
    return im


def beskjær(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    return im.crop(bb) if bb else None


def skaler(im, maks):
    s = maks / max(im.size)
    return im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS) if s < 1 else im


def ruter(im, kol, rad, topp):
    """Rutene i et ark. topp er høyden på overskriftsfeltet øverst i malen (40 piksler på en 1024 høy mal)."""
    w, h = im.size; t = round(topp * h / 1024); cw, ch = w / kol, (h - t) / rad
    for j in range(rad):
        for i in range(kol):
            yield i, j, im.crop((round(i * cw) + 3, round(t + j * ch) + 3, round((i + 1) * cw) - 3, round(t + (j + 1) * ch) - 3))


# ---------------------------------------------------------------- sømmer (fra Morbidium)
def saum(im, akse):
    """(kant, nabo): snittforskjellen over sømmen når bildet legges ved siden av seg selv, og mellom to nabokolonner
    eller naborader inne i bildet. En flis som går i ett, har omtrent like tall."""
    im = im.convert('RGB'); w, h = im.size
    if akse == 'x':
        kant = ImageChops.difference(im.crop((w - 1, 0, w, h)), im.crop((0, 0, 1, h)))
        nabo = ImageChops.difference(im.crop((1, 0, w, h)), im.crop((0, 0, w - 1, h)))
    else:
        kant = ImageChops.difference(im.crop((0, h - 1, w, h)), im.crop((0, 0, w, 1)))
        nabo = ImageChops.difference(im.crop((0, 1, w, h)), im.crop((0, 0, w, h - 1)))
    return sum(ImageStat.Stat(kant).mean) / 3, sum(ImageStat.Stat(nabo).mean) / 3


def rett_som(im, akse):
    """Blander en kopi forskjøvet et halvt bilde inn i det ytterste båndet langs kantene, der bildet henger sammen med
    seg selv. Myk overgang (smoothstep), så det ikke blir en ny kant der båndet slutter."""
    w, h = im.size; n = w if akse == 'x' else h; b = max(2, round(n * BAND))
    kopi = ImageChops.offset(im, w // 2, 0) if akse == 'x' else ImageChops.offset(im, 0, h // 2)
    vekt = []
    for i in range(n):
        d = min(i, n - 1 - i) / b
        vekt.append(0 if d >= 1 else round(255 * (1 - d * d * (3 - 2 * d))))
    maske = Image.new('L', (n, 1) if akse == 'x' else (1, n)); maske.putdata(vekt)
    return Image.composite(kopi, im, maske.resize((w, h), Image.NEAREST))


def rett_sommer(im, akser, navn):
    for akse in akser:
        kant, nabo = saum(im, akse)
        if kant > 2 * nabo + 2:
            im = rett_som(im, akse)
            print(f"  søm {'til sidene' if akse == 'x' else 'oppe og nede'} rettet i {navn}: {kant:.0f} før, {saum(im, akse)[0]:.0f} etter (inne i bildet {nabo:.0f})")
    return im


def advar_tekstur(im, navn):
    """Advarer om magenta (hjelpelinjer) og om kantene er mye mørkere eller lysere enn midten (vignett)."""
    rgb = im.convert('RGB'); W, H = rgb.size
    mag = sum(1 for c in piksler(rgb.resize((128, 128))) if magenta(c)) / (128 * 128)
    if mag > .005: print(f'  obs: {mag * 100:.1f} % av {navn} er magenta (hjelpelinjer?)')
    lys = lambda boks: ImageStat.Stat(rgb.convert('L').crop(boks)).mean[0]
    bx, by = max(1, round(W * .08)), max(1, round(H * .08))
    midt = lys((W // 4, H // 4, 3 * W // 4, 3 * H // 4))
    kant = (lys((0, 0, W, by)) + lys((0, H - by, W, H)) + lys((0, 0, bx, H)) + lys((W - bx, 0, W, H))) / 4
    if midt > 0 and abs(kant - midt) / midt >= .15:
        print(f"  obs: kantene i {navn} er {abs(kant - midt) / midt * 100:.0f} % {'mørkere' if kant < midt else 'lysere'} enn midten (vignett eller lyskjegle?)")


# ---------------------------------------------------------------- typer
def teksturnavn():
    """Navnene spillet kan bytte, lest fra texFile-kallene i koden (arenaen har ett sett per tema)."""
    navn = set()
    for f in (ROT / 'src' / 'gfx' / 'env').glob('*.ts'):
        for m in re.finditer(r"texFile\('([\w-]+)'( \+ theme)?", f.read_text(encoding='utf-8')):
            if m.group(2):
                navn |= {m.group(1) + t for t in ('pit', 'ice', 'bone')}
            else:
                navn.add(m.group(1))
    return navn


def tolk(nøkkel):
    """Hva et filnavn er: ('del', figur, del), ('pet', id), ('tex', navn), ('sky', biom) eller ('map',)."""
    if nøkkel == 'map': return ('map',)
    if nøkkel.startswith('tex_'): return ('tex', nøkkel[4:])
    if nøkkel.startswith('sky_'): return ('sky', nøkkel[4:])
    if nøkkel.startswith('pet_'): return ('pet', nøkkel)
    figur, _, del_ = nøkkel.rpartition('_')
    if figur and (del_ in FIGURDELER or (figur in RIDEDYR and del_ in DYREDELER)):
        return ('del', figur, del_)
    return None


def lagre(im, navn, tapsfri, kvalitet=88):
    """WebP: tapsfritt for figurdeler (alfa og kanter må være nøyaktige, spillet beskjærer på alfa), ellers kvalitet."""
    fil = f'{navn}.webp'
    if not SJEKK:
        # libwebp kan under høy belastning gi en tom fil uten å kaste feil. Ikke
        # oppdater manifestet før en ferdig dekodbar fil kan legges atomisk på plass.
        maal = UT / fil
        midlertidig = UT / f'.{fil}.tmp'
        for metode in (6, 4, 0):
            try:
                if tapsfri: im.save(midlertidig, 'WEBP', lossless=True, method=metode)
                else: im.save(midlertidig, 'WEBP', quality=kvalitet, method=metode)
                with Image.open(midlertidig) as kontroll:
                    kontroll.verify()
                midlertidig.replace(maal)
                midlertidig.unlink(missing_ok=True)
                break
            except Exception:
                midlertidig.unlink(missing_ok=True)
        else:
            raise OSError(f'kunne ikke skrive en gyldig WebP-fil: {fil}')
    return fil


def behandle(nøkkel, im, man, tekstur_ok):
    t = tolk(nøkkel)
    if not t:
        raise ValueError('ukjent filnavn (se filnavnene øverst i tools/process_art.py)')
    if t[0] in ('del', 'pet'):
        im = beskjær(fjern_bakgrunn(im.convert('RGBA')))
        if im is None: raise ValueError('bildet er helt gjennomsiktig')
        helt = t[0] == 'del' and (t[1] in HELTER or t[1].startswith('forge_'))
        im = skaler(im, MAKS_HELT if helt else MAKS_ANDRE)
        fil = lagre(im, nøkkel, True)
        char, part = (t[1], t[2]) if t[0] == 'del' else (nøkkel, 'body')
        # Et nytt bilde av en del som finnes, beholder høyde og festepunkt som er justert i manifestet. Punktene som
        # er målt i selve bildet (skulderplatene, halsroten og neven) hører til det gamle bildet og strykes.
        gammel = next((p for p in man.setdefault('parts', []) if p['char'] == char and p['part'] == part), None)
        if gammel:
            gammel['file'] = fil
            målt = [k for k in ('shoulders', 'neck', 'hand') if gammel.pop(k, None) is not None]
            if målt: print(f'  obs: {char} {part} har nytt bilde, mål {", ".join(målt)} på nytt (MEASURE)')
        else: man['parts'].append({'char': char, 'part': part, 'file': fil})
        return f'{fil} ({im.size[0]}x{im.size[1]}, {char} {part})'
    if t[0] == 'tex':
        if t[1] not in tekstur_ok: print(f'  obs: {t[1]} er ikke et teksturnavn spillet bruker (se teksturlista i docs/ART_PROMPTS.md)')
        im = skaler(im.convert('RGB'), MAKS_TEKSTUR)
        im = rett_sommer(im, ('x', 'y'), nøkkel)
        advar_tekstur(im, nøkkel)
        fil = lagre(im, nøkkel, False, 85)
        man.setdefault('textures', {})[t[1]] = fil
        return f'{fil} ({im.size[0]}x{im.size[1]}, tekstur {t[1]})'
    if t[0] == 'sky':
        im = rett_sommer(skaler(im.convert('RGB'), MAKS_HIMMEL), ('x',), nøkkel)
        fil = lagre(im, nøkkel, False, 88)
        man.setdefault('sky', {})[t[1]] = fil
        return f'{fil} ({im.size[0]}x{im.size[1]}, himmel {t[1]})'
    im = skaler(im.convert('RGB'), MAKS_HIMMEL)
    fil = lagre(im, 'map', False, 90)
    man['map'] = fil
    return f'{fil} ({im.size[0]}x{im.size[1]}, kart)'


def klipp(sti):
    """Ark til (nøkkel, bilde)-par. Vanlige bilder gir seg selv."""
    navn = sti.stem.lower()
    im = Image.open(sti).convert('RGBA')
    if navn.startswith('figur_'):
        figur = navn[6:]
        im = fjern_bakgrunn(fjern_magenta(im), 33)
        return [(f'{figur}_{FIGURARK[j][i]}', c) for i, j, c in ruter(im, 3, 2, 40)]
    if navn.startswith('ark__'):
        im = fjern_bakgrunn(fjern_magenta(im), 33)
        return [(k, c) for (i, j, c), k in zip(ruter(im, 3, 3, 0), navn[5:].split('__')) if k != '_']
    return [(navn, im)]


def main():
    INN.mkdir(parents=True, exist_ok=True); UT.mkdir(parents=True, exist_ok=True)
    filer = sorted(p for p in INN.iterdir() if p.is_file() and p.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg'))
    if not filer:
        print('art/inbox/ har ingen bilder.'); return
    man = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    tekstur_ok = teksturnavn()
    ok, feil = 0, []
    for f in filer:
        try:
            deler = klipp(f)
            n = 0
            for nøkkel, im in deler:
                if im.mode == 'RGBA' and not im.getchannel('A').getbbox():
                    continue  # tom rute i et ark
                print(f'OK      {f.name}: {behandle(nøkkel, im, man, tekstur_ok)}'); n += 1
            if not n: raise ValueError('fant ingenting å lagre')
            ok += 1
        except Exception as e:
            print(f'FEIL    {f.name}: {e}'); feil.append(f.name)
    if feil:
        print(f'\n{len(feil)} bilde(r) feilet, så ingenting er skrevet eller flyttet. Rett navnene og kjør på nytt.')
        sys.exit(1)
    if SJEKK:
        print(f'\n{ok} bilde(r) ville blitt behandlet (--sjekk skriver ingenting).'); return
    MANIFEST.write_text(json.dumps(man, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    ferdig = INN / 'behandlet'; ferdig.mkdir(exist_ok=True)
    for f in filer: shutil.move(str(f), ferdig / f.name)
    print(f'\n{ok} bilde(r) behandlet. Manifestet er oppdatert, og originalene ligger i art/inbox/behandlet/ (ikke i git).')


if __name__ == '__main__':
    main()
