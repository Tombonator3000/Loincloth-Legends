"""Tar imot bilder fra ChatGPT i art/inbox/ og gjør dem til ferdige filer i public/assets/, med manifestet oppdatert.

Gjenbrukt fra Toms Morbidium (tools/skjaer_ark.py, tools/behandle_bilder.py og tools/ta_imot_grafikk.py): magenta
hjelpelinjer og ensfarget bakgrunn fjernes, ark klippes i ruter, delene beskjæres, sømmene i teksturer rettes med
en kopi forskjøvet et halvt bilde, og rutene i bildeserier finnes og klippes likt (ark_ruter og behandle_ark).
Tilpasset Loincloth Legends: filnavnene under, manifestet i public/assets/manifest.json, og ingen fast oppløsning per
spillenhet, fordi spillet regner ut størrelsen fra figurens skjelett (se src/gfx/rig.ts).

Filnavnet bestemmer hva bildet er (små bokstaver, .png, .webp eller .jpg):
  <figur>_<del>.png      figurdel: head, hairback, torso, pelvis, arm, leg, weapon, eller body, tail for ridedyr
                         (valkyra_head.png, skeleton_arm.png, warhog_body.png)
  appearance_<gruppe>_<navn>.png  eget hårlag, skjegg, hodeplagg eller iris; plassering ligger i hero-appearance-layout.ts
  pet_<id>.png           kjæledyr (pet_rat.png)
  figur_<figur>.png      helt ark laget på docs/maler/mal_figur.png, 3 x 2 ruter:
                         head, torso, pelvis på øverste rad og arm, leg, weapon på nederste
  ark__<navn>__<navn>...png
                         ni ting laget på docs/maler/mal_ni_ting.png, 3 x 3, lest fra venstre og ovenfra. Hver rute får
                         navnet i sin plass (et av navnene over, uten .png). _ hopper over en rute
  prop_<navn>.png        kulisse til brettverkstedet (prop_signpost.png). Samme navn som en plassholder i
                         src/gfx/props/catalog.ts tar over for den og beholder mål, lys og bevegelse derfra
  anim_<navn>_<K>x<R>.png
                         bildeserie til brettverkstedet, K kolonner og R rader lest fra venstre og ovenfra
                         (anim_crow_4x1.png, anim_banner_red_4x2.png). Alle rutene klippes med den samme boksen, så
                         fotpunktet står stille fra bilde til bilde. Tomme ruter til slutt telles ikke med
  tex_<navn>.png         tekstur, navnet fra teksturlista i docs/ART_PROMPTS.md (tex_ground_grass.png)
  sky_<biom>.png         himmel (sky_scorch.png, sky_arena-pit.png)
  map.png                verdenskartet

Originalene flyttes til art/inbox/behandlet/ (ligger ikke i git, repoet er offentlig og skal holdes lite).
Stopper uten å flytte noe hvis et bilde ikke kunne behandles.

Bilder med andre navn (en zip eller mappe fra ChatGPT): --fra <zip eller mappe> legger dem i innboksen først. Navnene
gjøres om til små bokstaver med _ (æ blir ae, ø blir o, å blir a), og et navn verktøyet ikke kjenner, blir en kulisse:
prop_<navn>, eller anim_<navn>_<K>x<R> når det ender på _<K>x<R>. Kulisser med front eller foreground i navnet legges
i FRONT, far, distant eller background i FAR, og back i BACK. Nye kulisser får også en høyde i meter og en animasjon
ut fra ordene i navnet (HØYDER og gjett_anim: tøy bølger, vinger snurrer, flammer flakker, fugler flykter, trær
svaier). Alt kan endres i editoren.

Krever Pillow:  pip install pillow
Bruk:           python3 tools/process_art.py          tar imot alt i innboksen
                python3 tools/process_art.py --sjekk  viser bare hva som ville skjedd
                python3 tools/process_art.py --fra gpt_kulisser.zip [--sjekk]
"""
import json, re, shutil, sys, zipfile
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
# Kulisser: store trær rett foran kameraet fyller mer enn skjermhøyden, så de får flere piksler. Bildeserier holdes
# under 4096 piksler til sammen (grensen for teksturer på de fleste skjermkort).
MAKS_KULISSE, MAKS_RUTE, MAKS_ARK = 2048, 768, 4096
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


def fjern_bakgrunn(im, grense=34, *, bevar_alfa=True):
    """Gjør bakgrunnsfargen gjennomsiktig hvis bildet ikke har gjennomsiktighet fra før. Flomfyll fra kantene, så bare
    sammenhengende bakgrunn forsvinner og ikke lignende farger inni figuren. Ekte alfa er fasiten uansett hvor liten
    del av bildet som er gjennomsiktig. bevar_alfa=False brukes bare når alfa kom fra fjernede hjelpelinjer."""
    a = im.getchannel('A')
    if bevar_alfa and a.getextrema()[0] < 255:
        return im  # har allerede gjennomsiktig bakgrunn
    px = im.load(); w, h = im.size
    dx, dy = min(2, (w - 1) // 2), min(2, (h - 1) // 2)
    hj = [px[dx, dy], px[w - 1 - dx, dy], px[dx, h - 1 - dy], px[w - 1 - dx, h - 1 - dy]]
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
    """Hva et filnavn er: ('del', figur, del), ('pet', id), ('prop', navn), ('anim', navn, kolonner, rader), ('tex', navn),
    ('sky', biom) eller ('map',)."""
    if nøkkel == 'map': return ('map',)
    m = re.fullmatch(r'anim_(.+)_(\d+)x(\d+)', nøkkel)
    if m: return ('anim', m.group(1), int(m.group(2)), int(m.group(3)))
    if nøkkel.startswith('anim_'): return ('anim?',)
    if nøkkel.startswith('prop_'): return ('prop', nøkkel[5:])
    if re.fullmatch(r'appearance_(hair|beard|headgear|eye)_[a-z0-9_]+', nøkkel): return ('appearance', nøkkel)
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


# ---------------------------------------------------------------- kulisser og bildeserier (brettverkstedet)
def katalogen():
    """Plassholderne og 3D-rekvisittene i src/gfx/props/catalog.ts: {navn: 'painted' eller 'model'}."""
    f = ROT / 'src' / 'gfx' / 'props' / 'catalog.ts'
    tekst = f.read_text(encoding='utf-8') if f.exists() else ''
    return {m.group(1): m.group(2) for m in re.finditer(r"id: '([a-z0-9_]+)', label: '[^']*', source: '(painted|model)'", tekst)}


def kulissenavn(navn):
    if not re.fullmatch(r'[a-z0-9_]{1,40}', navn):
        raise ValueError(f'«{navn}»: navnet kan bare ha a-z, 0-9 og _ (ikke æ, ø, å, bindestrek eller mellomrom)')
    return navn


def alfa_boks(im):
    return im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()


def kant(im, px=2):
    """Gjennomsiktig kant rundt bildet: alfa blir med i WebP-fila (et bilde uten et eneste gjennomsiktig punkt lagres
    ellers uten alfa), og teksturen blør ikke inn fra kanten når den filtreres."""
    ut = Image.new('RGBA', (im.width + 2 * px, im.height + 2 * px), (0, 0, 0, 0))
    ut.paste(im, (px, px))
    return ut


def ark_ruter(im, kol, rad):
    """Rutene i et ark (fra Morbidium). ChatGPT leverer bare 1024x1024, 1536x1024 eller 1024x1536, så et ark med fire
    ruter på rad blir sjelden fire nøyaktige kvadrater. Først deles arket i like store ruter. Krysser tegningen
    skillelinjene (arket har marg på sidene, eller rutene er ujevne), letes det i stedet etter de tomme stripene mellom
    bildene. Gir det feil antall, brukes like ruter likevel."""
    w, h = im.size; cw, ch = w / kol, h / rad
    like = [(round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)) for r in range(rad) for c in range(kol)]
    if rad != 1 or kol == 1: return like, True
    kolonner = list(piksler(im.getchannel('A').point(lambda v: 255 if v > 12 else 0).resize((w, 1), Image.BOX)))
    grense = 1
    kryss = sum(1 for c in range(1, kol) for x in range(round(c * cw) - 2, round(c * cw) + 3) if kolonner[x] > grense)
    if not kryss: return like, True
    biter, start = [], None
    for x, v in enumerate(kolonner + [0]):
        if v > grense and start is None: start = x
        elif v <= grense and start is not None:
            if x - start > w * .01: biter.append([start, x])
            start = None
    # små hull inni en tegning (dråper med luft mellom) slås sammen til det blir riktig antall
    while len(biter) > kol:
        i = min(range(len(biter) - 1), key=lambda j: biter[j + 1][0] - biter[j][1])
        biter[i][1] = biter[i + 1][1]; del biter[i + 1]
    if len(biter) != kol:
        print(f'  obs: fant ikke {kol} ruter i arket, deler det likt')
        return like, True
    return [(b[0], 0, b[1], h) for b in biter], False


def behandle_ark(im, kol, rad, navn):
    """Bildeserie (etter behandle_ark i Morbidium): hver rute klippes ut, og alle klippes med den samme boksen (det de
    har av innhold til sammen), så fotpunktet står stille fra bilde til bilde. Settes sammen igjen i samme rutenett.
    Gir (ark, antall bilder, rutestørrelse)."""
    if not (1 <= kol <= 16 and 1 <= rad <= 16): raise ValueError('rutenettet må være mellom 1x1 og 16x16')
    if im.size[0] % kol or im.size[1] % rad:
        print(f'  obs: {navn} er {im.size[0]}x{im.size[1]}, som ikke går opp i {kol}x{rad} ruter (rutene rundes av)')
    im = fjern_bakgrunn(im.convert('RGBA'))
    bokser, like = ark_ruter(im, kol, rad)
    celler = [im.crop(b) for b in bokser]
    if not like:  # funnet ved de tomme stripene: midtstill hver tegning i en felles bredde
        bred = max(c.width for c in celler)
        def midtstill(c):
            u = Image.new('RGBA', (bred, c.height), (0, 0, 0, 0)); u.alpha_composite(c, ((bred - c.width) // 2, 0)); return u
        celler = [midtstill(c) for c in celler]
    cw, ch = min(c.width for c in celler), min(c.height for c in celler)
    celler = [c.crop((0, 0, cw, ch)) for c in celler]
    fulle = [i for i, c in enumerate(celler) if alfa_boks(c)]
    if not fulle: raise ValueError('arket er helt gjennomsiktig')
    n = fulle[-1] + 1
    boks = None
    for c in celler[:n]:
        b = alfa_boks(c)
        if b: boks = b if not boks else (min(boks[0], b[0]), min(boks[1], b[1]), max(boks[2], b[2]), max(boks[3], b[3]))
    # To piksler luft rundt, så nabobildet ikke blør inn når teksturen filtreres
    x0, y0, x1, y1 = max(0, boks[0] - 2), max(0, boks[1] - 2), min(cw, boks[2] + 2), min(ch, boks[3] + 2)
    bw, bh = x1 - x0, y1 - y0
    s = min(1, MAKS_RUTE / max(bw, bh), (MAKS_ARK - 4 * kol) / (bw * kol), (MAKS_ARK - 4 * rad) / (bh * rad))
    fw, fh = max(1, round(bw * s)), max(1, round(bh * s))
    # Hver rute får en gjennomsiktig kant på to piksler, så nabobildet ikke blør inn
    ut = Image.new('RGBA', ((fw + 4) * kol, (fh + 4) * rad), (0, 0, 0, 0))
    ruter_ = [c.crop((x0, y0, x1, y1)) for c in celler[:n]]
    for i, r in enumerate(ruter_):
        ut.alpha_composite(r.resize((fw, fh), Image.LANCZOS) if s < 1 else r, ((i % kol) * (fw + 4) + 2, (i // kol) * (fh + 4) + 2))
    # Løkka går av seg selv fra det siste bildet til det første. Er de like, står bevegelsen stille et øyeblikk.
    if n > 2 and sum(ImageStat.Stat(ImageChops.difference(ruter_[0], ruter_[-1])).mean) / 4 < 1.5:
        print(f'  obs: det siste bildet i {navn} er likt det første. Ta det bort for en jevn løkke')
    return ut, n, (fw + 4, fh + 4)


# Høyde i meter for kulisser med disse ordene i navnet. Det siste ordet som finnes, vinner (windmill_blades er vinger,
# wall_torch er en fakkel), og bredden blir høyden ganger formen på bildet. small og large skalerer. Justeres i editoren.
HØYDER = {
    'tree': 6.5, 'oak': 7, 'pine': 8, 'birch': 7, 'willow': 6, 'trunk': 6, 'crown': 5, 'canopy': 5,
    'bush': 1.4, 'shrub': 1.3, 'bramble': 1.4, 'brambles': 1.4, 'fern': 1.0, 'ferns': 1.0, 'grass': 0.7, 'reeds': 1.3,
    'flowers': 0.5, 'mushroom': 0.6, 'mushrooms': 0.6, 'rock': 1.1, 'rocks': 1.0, 'boulder': 1.8, 'stone': 1.0,
    'stones': 0.7, 'crystal': 1.2, 'crystals': 1.2, 'fence': 1.4, 'palisade': 3.2, 'wall': 3.5, 'gate': 4.0, 'door': 2.4,
    'bridge': 2.5, 'tent': 3.0, 'banner': 2.6, 'flag': 1.0, 'cloth': 1.0, 'pennant': 0.8, 'pole': 3.4, 'flagpole': 3.4,
    'sign': 0.9, 'signpost': 2.6, 'post': 2.4, 'lamppost': 2.8, 'lantern': 0.55, 'lamp': 0.55, 'torch': 1.6,
    'candle': 0.3, 'candles': 0.4, 'brazier': 1.2, 'campfire': 0.8, 'fire': 1.0, 'flame': 0.8, 'smoke': 2.0,
    'barrel': 1.0, 'barrels': 1.1, 'crate': 0.8, 'crates': 1.2, 'box': 0.8, 'sack': 0.7, 'sacks': 0.8, 'chest': 0.7,
    'pot': 0.6, 'jar': 0.5, 'cart': 1.9, 'wagon': 2.3, 'wheel': 1.2, 'skull': 0.3, 'skulls': 0.5, 'bones': 0.4,
    'skeleton': 1.8, 'pike': 2.6, 'stake': 2.6, 'spike': 1.2, 'spikes': 1.2, 'gallows': 4.5, 'cage': 1.6, 'chain': 1.4,
    'chains': 1.4, 'rope': 1.2, 'hut': 4.5, 'house': 6.0, 'cabin': 4.5, 'shack': 4.0, 'tower': 12, 'watchtower': 9,
    'castle': 20, 'ruin': 4, 'ruins': 4, 'pillar': 4, 'column': 4, 'arch': 5, 'statue': 3, 'totem': 3.5, 'altar': 1.3,
    'tomb': 2, 'grave': 1.1, 'gravestone': 1.1, 'tombstone': 1.1, 'cross': 1.8, 'well': 2.4, 'windmill': 9, 'mill': 8,
    'blades': 7, 'sails': 7, 'mountain': 40, 'mountains': 40, 'hill': 15, 'hills': 15, 'cliff': 20, 'cloud': 5,
    'clouds': 6, 'fog': 3, 'mist': 3, 'crow': 0.35, 'raven': 0.4, 'bird': 0.35, 'bat': 0.3, 'rat': 0.25, 'chicken': 0.5,
    'vulture': 0.7, 'log': 0.6, 'logs': 0.8, 'stump': 0.7, 'roots': 1.0, 'vines': 3.0, 'ivy': 3.0, 'web': 1.2,
    'cobweb': 1.2, 'sword': 1.2, 'axe': 1.1, 'spear': 2.2, 'shield': 0.8, 'rack': 1.8, 'anvil': 0.8,
}
SKALA = {'tiny': 0.4, 'small': 0.6, 'little': 0.6, 'large': 1.5, 'big': 1.5, 'huge': 2.2, 'giant': 2.2, 'tall': 1.4}


def gjett_høyde(navn):
    """Høyden i meter ut fra navnet (se HØYDER), eller None."""
    ord_ = navn.split('_')
    treff = [HØYDER[o] for o in ord_ if o in HØYDER]
    if not treff: return None
    h = treff[-1]
    for o in ord_:
        h *= SKALA.get(o, 1)
    return h


def gjett_anim(navn):
    """Animasjoner ut fra navnet: tøy bølger, vinger snurrer, lykter svinger, flammer flakker og lyser, fugler flykter,
    trær og busker svaier, sopp og krystaller gløder, skyer og tåke driver. None når ingenting passer."""
    o = set(navn.split('_'))
    a = []
    if o & {'flag', 'pennant'}: a.append({'type': 'wave', 'amount': 0.12, 'speed': 0.9, 'length': 0.8, 'from': 'left'})
    elif o & {'banner', 'cloth', 'curtain', 'tapestry', 'laundry', 'rag', 'rags', 'cape', 'hide'}: a.append({'type': 'wave', 'amount': 0.1, 'speed': 0.7, 'length': 0.9, 'from': 'top'})
    if o & {'blades', 'sails', 'wheel', 'waterwheel', 'fan'}: a.append({'type': 'spin', 'speed': 0.12, 'pivot': [0.5, 0.5]})
    if o & {'lantern', 'lamp', 'sign', 'cage', 'chain', 'chains', 'hanging'} and not o & {'lamppost', 'signpost', 'post'}: a.append({'type': 'swing', 'amount': 6, 'speed': 0.5, 'pivot': [0.5, 0.02]})
    if o & {'torch', 'brazier', 'campfire', 'fire', 'flame', 'flames', 'candle', 'candles', 'lantern', 'lamp', 'lamppost'} and 'smoke' not in o:
        a.append({'type': 'flicker', 'amount': 0.3, 'speed': 9, 'light': '#ffa040', 'intensity': 7, 'range': 7, 'at': [0.5, 0.2]})
    if o & {'crow', 'raven', 'bird', 'birds', 'bat', 'vulture'}:
        a += [{'type': 'bob', 'amount': 0.04, 'speed': 0.7}, {'type': 'react', 'on': 'any', 'radius': 3.5, 'effect': 'flee', 'back': 10}]
    elif o & {'rat', 'rats', 'chicken', 'frog', 'cat'}: a.append({'type': 'react', 'on': 'any', 'radius': 2.5, 'effect': 'flee', 'back': 8})
    if o & {'tree', 'oak', 'pine', 'birch', 'willow', 'crown', 'canopy'}: a.append({'type': 'sway', 'amount': 0.3, 'speed': 1})
    elif o & {'bush', 'shrub', 'bramble', 'brambles', 'fern', 'ferns', 'grass', 'reeds', 'flowers', 'vines', 'ivy', 'weeds'}: a.append({'type': 'sway', 'amount': 0.8, 'speed': 1})
    if o & {'mushroom', 'mushrooms', 'crystal', 'crystals', 'rune', 'runes', 'glowing', 'glow', 'orb', 'embers'}: a.append({'type': 'pulse', 'amount': 0.02, 'speed': 0.5, 'glow': 0.4})
    if o & {'cloud', 'clouds', 'fog', 'mist'}: a.append({'type': 'drift', 'speed': 0.3, 'range': 40})
    return a or None


def gjett_lag(navn):
    """Laget ut fra ordene i navnet (front_bush, distant_mountain ...), eller None for MID."""
    ord_ = set(navn.split('_'))
    if ord_ & {'front', 'foreground', 'fg'}: return 'front'
    if ord_ & {'far', 'distant', 'background', 'bg', 'skyline'}: return 'far'
    if ord_ & {'back', 'behind'}: return 'back'
    return None


def kulisse_i_manifestet(man, navn, fil, størrelse, ark, kjente):
    """Oppføringen i manifestet (props). Et nytt bilde av en kulisse som finnes, beholder mål, fotpunkt, lag og
    animasjon som er justert i editoren. Et navn fra katalogen arver resten fra plassholderen. Helt nye navn får en
    bredde ut fra formen, som justeres i editoren (IMAGE SETTINGS)."""
    props = man.setdefault('props', {})
    meta = props.get(navn)
    if meta is None:
        meta = props[navn] = {'file': fil}
        if navn not in kjente:
            fw, fh = størrelse; form = fw / fh
            h = gjett_høyde(navn)
            meta['w'] = round(max(0.1, h * form) * 20) / 20 if h else (3 if form > 1.6 else 1 if form < .5 else 1.6)
            meta['anchor'] = [0.5, 0.99]
            meta['label'] = navn.upper().replace('_', ' ')
            lag = gjett_lag(navn)
            if lag: meta['layer'] = lag
            anim = gjett_anim(navn)
            if anim: meta['anim'] = anim
            if set(navn.split('_')) & {'cloud', 'clouds', 'fog', 'mist', 'smoke'}: meta['shadow'] = False
    meta['file'] = fil
    if ark:
        meta['grid'], meta['n'] = [ark[0], ark[1]], ark[2]
    else:
        meta.pop('grid', None); meta.pop('n', None)
    return meta


def behandle(nøkkel, im, man, tekstur_ok):
    t = tolk(nøkkel)
    if not t:
        raise ValueError('ukjent filnavn (se filnavnene øverst i tools/process_art.py)')
    if t[0] == 'anim?':
        raise ValueError('bildeserier trenger rutenettet i navnet: anim_<navn>_<kolonner>x<rader>.png, for eksempel anim_crow_4x1.png')
    if t[0] in ('prop', 'anim'):
        navn = kulissenavn(t[1])
        kjente = katalogen()
        if t[0] == 'anim':
            im, n, rute = behandle_ark(im, t[2], t[3], nøkkel)
            ark = (t[2], t[3], n)
        else:
            im = beskjær(fjern_bakgrunn(im.convert('RGBA')))
            if im is None: raise ValueError('bildet er helt gjennomsiktig')
            im = kant(skaler(im, MAKS_KULISSE - 4)); rute = im.size; ark = None
        fil = lagre(im, f'prop_{navn}', False, 90)
        kulisse_i_manifestet(man, navn, fil, rute, ark, kjente)
        hva = {'painted': f', tar over for plassholderen {navn}', 'model': f', tar over for 3D-rekvisitten {navn}'}.get(kjente.get(navn), '')
        serie = f', {ark[2]} bilder i {ark[0]}x{ark[1]}' if ark else ''
        return f'{fil} ({im.size[0]}x{im.size[1]}, kulisse {navn}{serie}{hva})'
    if t[0] == 'appearance':
        im = beskjær(fjern_bakgrunn(im.convert('RGBA')))
        if im is None: raise ValueError('bildet er helt gjennomsiktig')
        im = skaler(im, 512 if nøkkel.startswith('appearance_eye_') else MAKS_HELT)
        fil = lagre(im, nøkkel, True)
        gammel = next((p for p in man.setdefault('appearance', []) if p['id'] == nøkkel), None)
        if gammel: gammel['file'] = fil
        else: man['appearance'].append({'id': nøkkel, 'file': fil})
        return f'{fil} ({im.size[0]}x{im.size[1]}, selvstendig utseendelag)'
    if t[0] in ('del', 'pet'):
        im = beskjær(fjern_bakgrunn(im.convert('RGBA')))
        if im is None: raise ValueError('bildet er helt gjennomsiktig')
        helt = t[0] == 'del' and (t[1] in HELTER or t[1].startswith('forge_'))
        im = skaler(im, MAKS_HELT if helt else MAKS_ANDRE)
        fil = lagre(im, nøkkel, True)
        char, part = (t[1], t[2]) if t[0] == 'del' else (nøkkel, 'body')
        # Et nytt bilde av en del som finnes, beholder høyde og festepunkt som er justert i manifestet. Punktene som
        # er målt i selve bildet (skulderplatene, halsroten, neven, albuen og kneet) hører til det gamle bildet og strykes.
        gammel = next((p for p in man.setdefault('parts', []) if p['char'] == char and p['part'] == part), None)
        if gammel:
            gammel['file'] = fil
            målt = [k for k in ('shoulders', 'neck', 'hand', 'elbow', 'knee') if gammel.pop(k, None) is not None]
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
    # Hjelpelinjene får alfa av fjern_magenta. Bare alfa som var i originalen, skal hindre bakgrunnsfjerning.
    hadde_alfa = im.getchannel('A').getextrema()[0] < 255
    if navn.startswith('figur_'):
        figur = navn[6:]
        im = fjern_bakgrunn(fjern_magenta(im), 33, bevar_alfa=hadde_alfa)
        return [(f'{figur}_{FIGURARK[j][i]}', c) for i, j, c in ruter(im, 3, 2, 40)]
    if navn.startswith('ark__'):
        im = fjern_bakgrunn(fjern_magenta(im), 33, bevar_alfa=hadde_alfa)
        return [(k, c) for (i, j, c), k in zip(ruter(im, 3, 3, 0), navn[5:].split('__')) if k != '_']
    return [(navn, im)]


# ---------------------------------------------------------------- bilder med andre navn (--fra)
ERSTATT = {'æ': 'ae', 'ø': 'o', 'å': 'a', 'ä': 'a', 'ö': 'o', 'ü': 'u', 'é': 'e', 'è': 'e'}


def normaliser(navn):
    """Et filnavn (uten endelse) til et navn verktøyet kjenner: små bokstaver, _ i stedet for mellomrom og tegn, og
    prop_ eller anim_ foran det som ellers ville vært ukjent. Opplastede filer kan ha en hash foran (1a2b3c4d-)."""
    n = re.sub(r'^[0-9a-f]{8}-', '', navn.strip().lower())
    n = ''.join(ERSTATT.get(c, c) for c in n)
    if not n.startswith('ark__'):
        n = re.sub(r'[^a-z0-9_]+', '_', n)
        n = re.sub(r'_+', '_', n).strip('_')
    if not n: n = 'prop'
    try:
        kjent = tolk(n)
    except Exception:
        kjent = None
    if n.startswith(('figur_', 'ark__')) or (kjent and kjent[0] != 'anim?'):
        return n
    m = re.fullmatch(r'(?:anim_)?(.+?)_?(\d+)x(\d+)', n)
    if m: return f'anim_{m.group(1)[:40]}_{m.group(2)}x{m.group(3)}'
    return 'prop_' + re.sub(r'^prop_', '', n)[:40].strip('_')


def hent_fra(kilde):
    """Legg bildene fra en zip eller mappe i innboksen med navn verktøyet kjenner. Gir listen [(fra, til)]."""
    kilde = Path(kilde)
    bilder = []  # (visningsnavn, filnavn, bytes eller sti)
    if kilde.is_dir():
        for f in sorted(kilde.rglob('*')):
            if f.is_file() and f.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg') and not f.name.startswith('.'):
                bilder.append((str(f.relative_to(kilde)), f.name, f))
    elif zipfile.is_zipfile(kilde):
        with zipfile.ZipFile(kilde) as z:
            for info in sorted(z.infolist(), key=lambda i: i.filename):
                nm = Path(info.filename)
                if info.is_dir() or '__MACOSX' in nm.parts or nm.name.startswith('.'): continue
                if nm.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg'):
                    bilder.append((info.filename, nm.name, z.read(info)))
    else:
        raise SystemExit(f'{kilde} er verken en mappe eller en zip-fil')
    INN.mkdir(parents=True, exist_ok=True)
    brukt, par = set(p.stem.lower() for p in INN.iterdir() if p.is_file()), []
    for vis, fil, data in bilder:
        stamme = normaliser(Path(fil).stem)
        ny, i = stamme, 2
        while ny in brukt:
            ny = f'{stamme}_{i}'; i += 1
        brukt.add(ny)
        mål = INN / (ny + Path(fil).suffix.lower())
        par.append((vis, mål.name))
        if not SJEKK:
            if isinstance(data, Path): shutil.copyfile(data, mål)
            else: mål.write_bytes(data)
    return par


def main():
    if '--fra' in sys.argv:
        i = sys.argv.index('--fra')
        if i + 1 >= len(sys.argv): raise SystemExit('bruk: --fra <zip eller mappe>')
        par = hent_fra(sys.argv[i + 1])
        for fra, til in par: print(f'INN     {fra} -> art/inbox/{til}')
        print(f'{len(par)} bilde(r) lagt i innboksen.\n' if not SJEKK else f'{len(par)} bilde(r) ville blitt lagt i innboksen (--sjekk).\n')
        if SJEKK: return
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
