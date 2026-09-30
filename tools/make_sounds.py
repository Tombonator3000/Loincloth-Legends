"""Henter frie lyder (CC0) og lager public/assets/sound/: klippet, normalisert og kodet som mono-MP3, med kildeliste.

Portet fra Toms Morbidium (tools/lag_lyd.py). Lista under er lydene Loincloth Legends bruker: de 45 som ble kopiert
fra Morbidium, og de nye til frostpasset og fottrinnene.

Kilder:
  freesound  forhåndsvisningen (hq, 128 kbps) av lyder merket Creative Commons 0 på freesound.org.
             Lisensen sjekkes på lydens egen side hver gang fila hentes; mangler CC0-lenken, stopper verktøyet.
  vcsl       Versilian Community Sample Library (CC0, github.com/sgossner/VCSL), rå WAV-filer.
  karoryfer  Karoryfer Lecolds sine bibliotek på github.com/sfzinstruments (CC0): Emilyguitar (el-gitaren), Growlybass
             (bassen) og Big Rusty Drums (trommene). Instrumentene i metal-musikken (src/core/metal.ts).

Hver lyd får et navn, det samme som lydbanken bruker (src/core/soundbank.ts). Flere lyder med samme navn blir
varianter (navn, navn_2, navn_3), og spillet velger tilfeldig. Instrumentprøvene heter ins_<instrument>_<n> og får
tonehøyden målt. Stemningslydene (amb_*) får halen blandet inn i starten, så de kan gå i sløyfe uten klikk.
Sløyfepunktene står i sekunder i sound.json (sloyfe: [start, slutt]).

Ferdige filer: public/assets/sound/<navn>.mp3, sound.json (lengde, tonehøyde, sløyfe og kilde) og KILDER.md med
alle som har spilt inn. Mellomlager: .soundcache/ (ikke i git). Krever ffmpeg (pip install imageio-ffmpeg) og numpy.

Innleste replikker (stemmer laget i VoiceStudio etter docs/STEMMER.md) legges i voice/inbox/ med navnet fra
manuset (v_<replikk>.wav). --stemmer klipper stillheten, normaliserer og koder dem til public/assets/sound/ som
type voice, og flytter originalene til voice/inbox/behandlet/ (utenfor git). Spillet spiller dem når teksten vises.

Bruk:  python3 tools/make_sounds.py                     (henter det som mangler i mellomlageret og lager alt på nytt)
       python3 tools/make_sounds.py --bare fot_sno,brol  (bare disse; resten beholdes som de er)
       python3 tools/make_sounds.py --stemmer            (tar inn replikkene i voice/inbox/)
"""
import json, re, subprocess, sys, time, urllib.parse
from pathlib import Path
import numpy as np

ROT = Path(__file__).resolve().parent.parent
UT = ROT / 'public' / 'assets' / 'sound'
META = UT / 'sound.json'
CACHE = ROT / '.soundcache'
INN = ROT / 'voice' / 'inbox'
VCSL = 'https://raw.githubusercontent.com/sgossner/VCSL/master/'
KARORYFER_URL = 'https://raw.githubusercontent.com/sfzinstruments/'

def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'

# ---------- lydeffekter og stemningslyder fra Freesound (alle Creative Commons 0) ----------
# (navn, id, bruker, tittel)
FREESOUND = [
  # Fra Morbidium
  ('amb_baal', 650574, 'soundofsong', 'fire crackling loop.wav'),
  ('amb_drone', 249985, 'Werra', 'Eerie Dark Drone Soundscape'),
  ('amb_drypp', 696438, 'Patrick_Corra', 'Water drops with reverb'),
  ('amb_natt', 129678, 'FreethinkerAnon', 'crickets'),
  ('amb_vind', 146932, 'crashoverride6', 'Wind Gust'),
  ('die', 417994, 'DylanTheFish', 'Body fall.wav'),
  ('gore', 641046, 'magnuswaker', 'Gore Impact - "LOT OF HEART"'),
  ('gore', 649982, 'SoundDesignForYou', 'Squelching SFX [6]'),
  ('gore', 784768, 'AKkingStudio', 'DeathCrunch Gore SFX Blood and Bone'),
  ('hit', 276600, 'insanity54', 'body_hit.wav'),
  ('hit', 380616, 'Lesmash', 'hard-punch.wav'),
  ('hit', 411693, 'deoking', 'punch2.wav'),
  ('hitHeavy', 399183, 'janbezouska', 'Major punch'),
  ('hitHeavy', 517744, 'danlucaz', 'Punch'),
  ('knas', 392883, 'clif_creates', 'Hard Candy / Bone Crunch'),
  ('knas', 578874, 'samueleunimancer', 'BoneSnaping.mp3'),
  ('kraake', 361470, 'Jofae', 'Crow Caw'),
  ('kraake', 813115, 'qubodup', 'Crow Caw'),
  ('rive', 528263, 'magnuswaker', 'Pound of Flesh 2'),
  ('rive', 762900, 'gowoto', 'Gore_Physical tear'),
  ('slam', 513694, 'kasparsj', 'impact-stone-heavy.wav'),
  ('slam', 640204, '7of9Designs', 'Heavy Metal Thud on Ground'),
  ('splash', 186748, 'rombart', 'Splash-eau-goudron1.wav'),
  ('splash', 398032, 'swordofkings128', 'Splash'),
  ('splat', 55234, 'SlykMrByches', 'Splattt.mp3'),
  ('splat', 323525, 'Kreastricon62', 'Bloody Blade.wav'),
  ('splat', 445109, 'Breviceps', 'Mud Splat'),
  ('stikk', 344404, 'jawbutch', 'Knife Stab Melon.wav'),
  ('swing', 60013, 'qubodup', 'Whoosh'),
  ('swing', 389590, 'Jofae', 'Swing Woosh'),
  ('swingHeavy', 475135, 'bolkmar', 'FX - Swoosh - Low Pitch'),
  ('tooth', 343462, 'Rocotilos', 'Real Coin Drop'),
  ('tooth', 350875, 'cabled_mess', 'Coin_C_07'),
  ('torden', 188767, 'vonz', 'Thunder (Kraków, Poland, 20.05.2013)'),
  ('torden', 475094, 'Josh74000MC', 'thunder3.ogg'),
  ('ugle', 447211, 'Gamba_Studio', 'Buhos.wav'),
  ('zap', 136542, 'JoelAudio', 'ELECTRIC_ZAP_001.wav'),
  ('zap', 530356, 'danielpodlovics', 'Electricity.wav'),
  # Fottrinn per underlag (de tre første fra Morbidium)
  ('fot_gress', 151235, 'OwlStorm', 'Grassy Footstep 4'),
  ('fot_gress', 396016, 'morganpurkis', 'Rustling Grass 4.wav'),
  ('fot_stein', 166508, 'Yoyodaman234', 'concrete footstep 2'),
  ('fot_stein', 690006, 'matth3wc04', 'Concrete Footstep 2.mp3'),
  ('fot_vann', 450621, 'Breviceps', 'Step into water puddle / wade'),
  ('fot_vann', 841834, 'Robo9418', 'Small Puddle Splash'),
  ('fot_sno', 384424, 'cabled_mess', 'Footstep in the snow_04 [RAW]'),
  ('fot_sno', 613849, 'Nox_Sound', 'Footsteps_Mountain_Boots_Snow_Walk_Mono.wav'),
  # Frostpasset (konseptbilde 4) og arenaen
  ('amb_foss', 215711, 'VKProduktion', 'Waterfall 02 (loop).MP3'),
  ('isknak', 262635, 'j_p_higgins', 'Ice Crack 1'),
  ('isknak', 342546, 'timbreknight', 'Ice cracking'),
  ('brol', 188949, 'FK_Prod', 'Monster Growl Ashtur.wav'),
  ('brol', 449820, 'DylanTheFish', 'Monster Growl.wav'),
  ('klang', 471095, 'spycrah', 'Sword clash 1.wav'),
  ('klang', 326868, 'JohnBuhr', 'Sword_Clash (7).wav'),
  ('krigshorn', 539956, 'adharca', 'war horn.wav'),
  ('ulv', 472402, 'JoseAgudelo', '22_Lobo_aullando.wav'),
  ('ulv', 267179, 'BrainClaim', 'Scary Ghost Wolf Howling.wav'),
  ('publikum', 651646, 'Krizin', 'Crowd Cheer 5'),
  ('publikum', 267249, 'BerlinGameScene', 'BerlinGameScene.com Crowd Cheer 1'),
  ('vindkast', 381853, 'sqeeeek', 'wind_gust_short_sqeeeek.wav'),
]
# klipp og nivå per navn: fra (s etter stillheten foran), lengde (s), ut (uttoning, s), maal (toppnivå, dBFS)
OPT = {
  'swing': dict(lengde=.45), 'swingHeavy': dict(lengde=.7), 'hit': dict(lengde=.45), 'hitHeavy': dict(lengde=.7),
  'die': dict(lengde=1.2), 'splat': dict(lengde=.8), 'knas': dict(lengde=.7), 'gore': dict(lengde=1.0), 'rive': dict(lengde=.9),
  'stikk': dict(lengde=.6), 'slam': dict(lengde=1.1), 'splash': dict(lengde=.9), 'tooth': dict(lengde=.35, maal=-3), 'zap': dict(lengde=.6),
  'ugle': dict(lengde=1.1, maal=-5), 'kraake': dict(lengde=.8, maal=-3), 'torden': dict(lengde=3.4, ut=1.2),
  'fot_stein': dict(lengde=.3, ut=.05, maal=-4), 'fot_gress': dict(lengde=.35, ut=.06, maal=-5), 'fot_vann': dict(lengde=.4, ut=.08, maal=-4),
  'fot_sno': dict(lengde=.38, ut=.07, maal=-4),
  'isknak': dict(lengde=1.3, ut=.4, maal=-2), 'brol': dict(lengde=2.2, ut=.6, maal=-1), 'klang': dict(lengde=.8, ut=.3, maal=-2),
  'krigshorn': dict(lengde=3.6, ut=1.0, maal=-2), 'ulv': dict(lengde=4.0, ut=1.2, maal=-5), 'publikum': dict(lengde=3.4, ut=1.0, maal=-3),
  'vindkast': dict(lengde=2.1, ut=.6, maal=-5),
  'amb_drone': dict(fra=2, lengde=10, sloyfe=True), 'amb_baal': dict(lengde=4.5, sloyfe=True), 'amb_drypp': dict(fra=.5, lengde=7, sloyfe=True),
  'amb_natt': dict(fra=1, lengde=8, sloyfe=True), 'amb_vind': dict(lengde=7, sloyfe=True), 'amb_foss': dict(fra=.5, lengde=9, sloyfe=True)}

# ---------- instrumentprøver fra VCSL (CC0) ----------
# instrument: (mappe, [filer], valg). Paukene har ikke tone i navnet og måles i spekteret (tone='fft').
INSTRUMENTER = {
  'pauke': ('Membranophones/Struck Membranophones/Timpani 1/Hit/', ['Timpani1_Hit_v3_rr3_Sum.wav', 'Timpani3_Hit_v3_rr1_Sum.wav', 'Timpani5_Hit_v3_rr1_Sum.wav'], dict(lengde=1.6, ut=.6, tone='fft')),
  'paukevirvel': ('Membranophones/Struck Membranophones/Timpani 1/Roll/', ['Timpani3_Roll_v3_rr1_Sum.wav'], dict(lengde=2.2, ut=.5, tone=None)),
  'bekken': ('Idiophones/Struck Idiophones/Suspended Cymbal 1/', ['susCymb1_cresc_2s.wav', 'susCymb1_hit_f1.wav'], dict(lengde=2.6, ut=.8, tone=None, maal=-3)),
  'gong': ('Idiophones/Struck Idiophones/Gong 1/', ['gong_f.wav'], dict(lengde=4.0, ut=1.6, tone=None, maal=-2)),
}

# ---------- instrumentprøver fra Karoryfer (CC0) ----------
# El-gitaren (en Epiphone med humbuckere, Emilyguitar) og bassen (en Squier Jazz Bass, Growlybass) er tatt opp rent
# og direkte, og går gjennom forsterkerne i bandet (src/core/metal.ts og guitaramp.ts). Growlybass kaller den dype E-en
# e2, en oktav over vanlig notasjon, så MIDI-tonen er 12 x oktav + tone (kn). Emilyguitar bruker vanlig notasjon
# (e2 er MIDI 40), så der er det kn + 12. Trommene (Big Rusty Drums) er
# nærmikrofonen og overheadene blandet til ett opptak per slag, i et hardt lag med flere varianter (round robin), så
# dobbel stortromme ikke høres ut som en maskin.
def kn(navn):
    t = {'c': 0, 'db': 1, 'd': 2, 'eb': 3, 'e': 4, 'f': 5, 'gb': 6, 'g': 7, 'ab': 8, 'a': 9, 'bb': 10, 'b': 11}
    m = re.match(r'([a-g]b?)(\d)$', navn)
    return 12 * int(m.group(2)) + t[m.group(1)]

BRD = 'Samples/'
def trommer(sti, mik, fil, vekter):
    return [(f'{BRD}{sti}/{m}/{fil}', v) for m, v in zip(mik, vekter)]

# instrument: (repo, [(blanding, rot), ...], valg). Blanding er [(sti, vekt), ...]. rot None = uten tone,
# 'fft' = målt i spekteret (tammene).
KARORYFER = {
  # El-gitaren: en Epiphone med to humbuckere, tatt opp direkte (Emilyguitar), inn i forsterkermodellen i
  # src/core/guitaramp.ts. Emilyguitar navngir tonene vanlig (e2 er den dype E-en, MIDI 40). Tre varianter per tone
  # i rytmeregisteret (så gitaren til venstre og til høyre får hvert sitt opptak), to i leadregisteret.
  'elgitar': ('karoryfer.emilyguitar',
              [([(f'notes/{n}_f_rr{r}.wav', 1)], kn(n) + 12) for n, rr in
               [('e2', 3), ('gb2', 3), ('a2', 3), ('c3', 3), ('eb3', 3), ('gb3', 3), ('a3', 3), ('c4', 3), ('eb4', 3),
                ('gb4', 2), ('a4', 2), ('c5', 2), ('eb5', 2), ('gb5', 2), ('a5', 2), ('c6', 2), ('d6', 2)] for r in range(1, rr + 1)],
              # Hele tonen (4,2 s), så lange akkorder ringer ut som på en ekte gitar (nattlåta har akkorder på nesten 3 s).
              # 24 kHz holder: forsterkeren og kabinettet slipper nesten ikke gjennom noe over 10 kHz.
              dict(lengde=4.2, ut=.8, sr=24000, br='40k')),
  # Dempede strenger (plekteret mot strenger dempet med venstre hånd), lagt under palm mute
  'gitardemp': ('karoryfer.emilyguitar',
                [([(f'noises/muted{n}_rr1.wav', 1)], None) for n in (1, 2, 3, 4, 5)],
                dict(lengde=.35, ut=.1, sr=24000, br='40k')),
  'bass': ('karoryfer.growlybass',
           [([(f'sustain/{n}_f_rr1.wav', 1)], kn(n)) for n in ['e2', 'gb2', 'a2', 'c3', 'eb3', 'gb3', 'a3']],
           # 3,2 s: bassen holder ut lange akkorder (før 1,8 s, og da stoppet den midt i akkordene i nattlåta)
           dict(lengde=3.2, ut=.5, sr=24000, br='48k')),
  'stortromme': ('karoryfer.big-rusty-drums',
                 [(trommer('kick_24/kick', ['kick', 'oh'], f'k_vl13_rr{r}.flac', [1, .45]), None) for r in (1, 2, 3, 4)],
                 dict(lengde=.55, ut=.12, sr=32000, br='64k')),
  'skarp': ('karoryfer.big-rusty-drums',
            # Rimshot (stikka treffer skinnet og kanten samtidig) i det hardeste laget: smellet på en metalplate fra 80-tallet
            [(trommer('snare_14/rimshot', ['top', 'btm', 'oh'], f'sn_rims_vl6_rr{r}.flac', [1, .3, .55]), None) for r in (1, 2, 3, 4)],
            dict(lengde=.7, ut=.25, sr=32000, br='64k')),
  'tam': ('karoryfer.big-rusty-drums',
          [(trommer(f'tom_{d}/center', ['cl', 'oh'], f't{d}_vl{v}_rr1.flac', [1, .5]), 'fft') for d, v in [('14', 5), ('15', 6)]],
          dict(lengde=.9, ut=.3, sr=32000, br='64k')),
  'hihat': ('karoryfer.big-rusty-drums',
            [(trommer('hihat_14/tc', ['cl', 'oh'], f'ht_tc_vl7_rr{r}.flac', [1, .5]), None) for r in (1, 2, 3, 4)],
            dict(lengde=.3, ut=.12, sr=32000, br='64k')),
  'crash': ('karoryfer.big-rusty-drums',
            [(trommer('crash_17/cr', ['cl', 'oh'], f'cr_vl5_rr{r}.flac', [.7, 1]), None) for r in (1, 2)],
            dict(lengde=2.6, ut=1.0, sr=32000, br='64k', maal=-3)),
}

# ---------- nett ----------
def hent(url, sti, forsok=4):
    if sti.exists() and sti.stat().st_size > 256: return sti
    sti.parent.mkdir(parents=True, exist_ok=True)
    for i in range(forsok):
        r = subprocess.run(['curl', '-s', '-L', '-m', '120', '-A', 'Mozilla/5.0', '-o', str(sti), url])
        if r.returncode == 0 and sti.exists() and sti.stat().st_size > 256: return sti
        time.sleep(2 ** (i + 1))
    raise SystemExit(f'make_sounds: fikk ikke hentet {url}')

def freesound(i, bruker):
    """Forhåndsvisningen av én Freesound-lyd, etter at lisensen er sjekket på lydens egen side."""
    side = CACHE / f'fs_{i}.html'
    hent(f'https://freesound.org/people/{urllib.parse.quote(bruker)}/sounds/{i}/', side)
    h = side.read_text(encoding='utf-8', errors='replace')
    if 'creativecommons.org/publicdomain/zero/1.0' not in h:
        side.unlink(); raise SystemExit(f'make_sounds: {i} ({bruker}) er ikke merket CC0 på siden sin, og brukes ikke')
    m = re.search(r'data-mp3="([^"]+)"', h)
    if not m: raise SystemExit(f'make_sounds: fant ingen forhåndsvisning for {i}')
    return hent(m.group(1).replace('-lq.mp3', '-hq.mp3'), CACHE / f'fs_{i}.mp3')

# ---------- lydbehandling ----------
def les(sti, sr):
    r = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(sti), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True)
    if r.returncode: raise SystemExit(f'make_sounds: ffmpeg klarte ikke å lese {sti}: {r.stderr.decode()[:300]}')
    return np.frombuffer(r.stdout, dtype=np.float32).copy()

def skriv(x, sr, br, sti):
    r = subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', br, str(sti)], input=x.astype(np.float32).tobytes(), capture_output=True)
    if r.returncode: raise SystemExit(f'make_sounds: ffmpeg klarte ikke å skrive {sti}: {r.stderr.decode()[:300]}')

def klipp(x, sr, fra=0.0, lengde=None, ut=None, sloyfe=False, holdt=False):
    topp = float(np.max(np.abs(x))) or 1.0
    lyd = np.nonzero(np.abs(x) > topp * .02)[0]
    if len(lyd): x = x[max(0, lyd[0] - int(sr * .002)):]            # stillheten foran
    x = x[int(fra * sr):]
    if lengde: x = x[:int((lengde + (1.0 if sloyfe else 0)) * sr)]
    lyd = np.nonzero(np.abs(x) > topp * .004)[0]
    if len(lyd) and not sloyfe and not holdt: x = x[:lyd[-1] + int(sr * .01)]  # stillheten bak
    x = x.astype(np.float64)
    inn = min(len(x), int(sr * .002)); x[:inn] *= np.linspace(0, 1, inn)
    if sloyfe:  # halen blandes inn i starten: slutten går rett over i begynnelsen
        X = min(int(sr * 1.0), len(x) // 3); L = len(x) - X
        k = np.linspace(0, 1, X); y = x[:L].copy(); y[:X] = x[:X] * np.sqrt(k) + x[L:L + X] * np.sqrt(1 - k)
        # litt av slutten legges foran og litt av starten bak, og sløyfa går mellom dem. Da tåler den at
        # nettleserne legger ulikt mye stillhet foran en MP3 (koderens forsinkelse), uten klikk og hull.
        P = int(sr * .15); return np.concatenate([y[L - P:], y, y[:P]]), [P, P + L]
    if not holdt:
        u = min(len(x), int(sr * (ut if ut is not None else min(.08, len(x) / sr * .2)))); x[len(x) - u:] *= np.linspace(1, 0, u) ** 1.5
    return x

def normaliser(x, maal=-1.0):
    topp = float(np.max(np.abs(x))) or 1.0
    return x * (10 ** (maal / 20) / topp)

def spekter(x, sr, fmin=40, fmax=300):
    """Sterkeste topp i spekteret (for pauker), i MIDI med desimaler."""
    a = int(sr * .05); w = x[a:a + int(sr * .6)]; w = (w - w.mean()) * np.hanning(len(w)); n = 1 << 16
    S = np.abs(np.fft.rfft(w, n=n)); f = np.fft.rfftfreq(n, 1 / sr); m = (f >= fmin) & (f <= fmax)
    return float(69 + 12 * np.log2(f[m][int(np.argmax(S[m]))] / 440))

def stem(x, sr, nom):
    """Den faktiske tonehøyden rundt den oppgitte tonen (MIDI med desimaler): toppen i spekteret innenfor en
    halv tone, med parabel mellom bøttene. Opptakene er ikke alltid rent stemt (bassen ligger rundt 30 cent høyt)."""
    a = int(sr * .08); w = x[a:a + int(sr * 1.0)]; w = (w - w.mean()) * np.hanning(len(w)); n = 1 << 17
    S = np.abs(np.fft.rfft(w, n=n)); f = np.fft.rfftfreq(n, 1 / sr)
    f0 = 440 * 2 ** ((nom - 69) / 12); lo, hi = f0 * 2 ** (-.6 / 12), f0 * 2 ** (.6 / 12)
    i0, i1 = int(np.searchsorted(f, lo)), int(np.searchsorted(f, hi)); k = i0 + int(np.argmax(S[i0:i1]))
    y0, y1, y2 = np.log(S[k - 1] + 1e-12), np.log(S[k] + 1e-12), np.log(S[k + 1] + 1e-12)
    d = .5 * (y0 - y2) / (y0 - 2 * y1 + y2) if (y0 - 2 * y1 + y2) != 0 else 0
    return float(69 + 12 * np.log2((f[k] + d * (f[1] - f[0])) / 440))

# ---------- hovedløkka ----------
def lag(bare=None):
    UT.mkdir(parents=True, exist_ok=True); CACHE.mkdir(exist_ok=True)
    gammelt = json.loads(META.read_text(encoding='utf-8')) if META.exists() else {}
    # Replikkene kommer ikke fra lista under; de beholdes som de er
    meta = {k: v for k, v in gammelt.items() if v.get('type') == 'voice'}
    nye, teller = [], {}
    # Med --bare beholdes alle andre lyder slik de er (fila og radene i sound.json)
    behold = lambda fil: (UT / f'{fil}.mp3').exists() and fil in gammelt
    for navn, i, bruker, tittel in FREESOUND:
        teller[navn] = teller.get(navn, 0) + 1; fil = navn if teller[navn] == 1 else f'{navn}_{teller[navn]}'
        if bare and navn not in bare and fil not in bare and behold(fil):
            meta[fil] = gammelt[fil]; continue
        o = dict(OPT.get(navn, {})); amb = navn.startswith('amb_') or o.get('sloyfe')
        sr, br = (24000, '32k') if navn.startswith('amb_') else (32000, '48k')
        kilde = freesound(i, bruker); x = les(kilde, sr)
        x = klipp(x, sr, o.get('fra', 0), o.get('lengde'), o.get('ut'), sloyfe=bool(amb)); sl = False
        if amb: x, (a, b) = x; sl = [round(a / sr, 6), round(b / sr, 6)]
        x = normaliser(x, o.get('maal', -12.0 if navn.startswith('amb_') else -1.0))
        skriv(x, sr, br, UT / f'{fil}.mp3')
        meta[fil] = {'gruppe': navn, 'type': 'amb' if navn.startswith('amb_') else 'sfx', 'sek': round(len(x) / sr, 3), 'sloyfe': sl,
                     'kilde': 'Freesound', 'id': i, 'bruker': bruker, 'tittel': tittel, 'side': f'https://freesound.org/people/{bruker}/sounds/{i}/', 'lisens': 'CC0 1.0'}
        nye.append(fil)
        print(f'  {fil:14} {len(x) / sr:5.2f} s  {tittel[:50]}')
    for ins, (mappe, filer, o) in INSTRUMENTER.items():
        for n, f in enumerate(filer):
            fil = f'ins_{ins}_{n + 1}'
            if bare and ins not in bare and f'ins_{ins}' not in bare and fil not in bare and behold(fil):
                meta[fil] = gammelt[fil]; continue
            sr = 32000; kilde = hent(VCSL + urllib.parse.quote(mappe + f), CACHE / 'vcsl' / (mappe + f).replace('/', '__'))
            x = les(kilde, sr); x = klipp(x, sr, o.get('fra', 0), o.get('lengde'), o.get('ut'))
            rot = spekter(x, sr) if o.get('tone') == 'fft' else None
            x = normaliser(x, o.get('maal', -1.0)); skriv(x, sr, '56k', UT / f'{fil}.mp3')
            meta[fil] = {'gruppe': 'ins_' + ins, 'type': 'ins', 'sek': round(len(x) / sr, 3), 'rot': round(rot, 2) if rot is not None else None, 'sloyfe': None,
                         'kilde': 'VCSL', 'fil': mappe + f, 'side': 'https://github.com/sgossner/VCSL', 'lisens': 'CC0 1.0'}
            nye.append(fil)
    for ins, (repo, prover, o) in KARORYFER.items():
        for n, (blanding, rot) in enumerate(prover):
            fil = f'ins_{ins}_{n + 1}'
            if bare and ins not in bare and f'ins_{ins}' not in bare and fil not in bare and behold(fil):
                meta[fil] = gammelt[fil]; continue
            sr = o.get('sr', 32000)
            deler = [les(hent(KARORYFER_URL + repo + '/master/' + urllib.parse.quote(sti), CACHE / 'karoryfer' / repo / sti.replace('/', '__')), sr) * v for sti, v in blanding]
            x = np.zeros(max(len(d) for d in deler))
            for d in deler: x[:len(d)] += d
            x = klipp(x, sr, o.get('fra', 0), o.get('lengde'), o.get('ut'))
            r = spekter(x, sr, 60, 400) if rot == 'fft' else (stem(x, sr, rot) if o.get('stem', True) else rot) if rot is not None else None
            x = normaliser(x, o.get('maal', -1.0)); skriv(x, sr, o.get('br', '56k'), UT / f'{fil}.mp3')
            meta[fil] = {'gruppe': 'ins_' + ins, 'type': 'ins', 'sek': round(len(x) / sr, 3), 'rot': round(r, 2) if r is not None else None, 'sloyfe': None,
                         'kilde': 'Karoryfer', 'fil': ' + '.join(sti for sti, _ in blanding), 'side': f'https://github.com/sfzinstruments/{repo}', 'lisens': 'CC0 1.0'}
            nye.append(fil)
            print(f'  {fil:18} {len(x) / sr:5.2f} s  rot {meta[fil]["rot"]}  {blanding[0][0].split("/")[-1]}')
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=1, sort_keys=True), encoding='utf-8')
    for f in UT.glob('*.mp3'):
        if f.stem not in meta: f.unlink()  # lyder som er tatt ut av lista
    kilder(meta)
    tot = sum(f.stat().st_size for f in UT.glob('*.mp3'))
    print(f'skrev public/assets/sound/: {len(meta)} lyder ({len(nye)} laget nå), {tot / 1024:.0f} kB')

def stemmer():
    """Tar inn replikkene i voice/inbox/ (v_<replikk>.wav fra VoiceStudio) og legger dem i lydbanken."""
    meta = json.loads(META.read_text(encoding='utf-8')) if META.exists() else {}
    filer = sorted(p for p in INN.glob('*') if p.is_file() and p.suffix.lower() in ('.wav', '.mp3', '.ogg', '.flac', '.m4a'))
    if not filer:
        print('make_sounds: ingen replikker i voice/inbox/'); return
    ferdig = INN / 'behandlet'; ferdig.mkdir(exist_ok=True)
    for p in filer:
        navn = p.stem.lower()
        if not re.fullmatch(r'v_[a-z0-9_]+', navn):
            print(f'  hopper over {p.name}: navnet skal være v_<replikk> som i docs/STEMMER.md'); continue
        sr = 32000; x = klipp(les(p, sr), sr, ut=.05); x = normaliser(x, -2.0)
        skriv(x, sr, '48k', UT / f'{navn}.mp3')
        meta[navn] = {'gruppe': navn, 'type': 'voice', 'sek': round(len(x) / sr, 3), 'sloyfe': False,
                      'kilde': 'VoiceStudio', 'fil': p.name, 'lisens': 'Laget for spillet (stemmedesign, ingen kloning)'}
        p.rename(ferdig / p.name)
        print(f'  {navn:50} {len(x) / sr:5.2f} s')
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=1, sort_keys=True), encoding='utf-8')
    kilder(meta)

def kilder(meta):
    ut = ['# Lydene i Loincloth Legends', '',
          'Laget av `tools/make_sounds.py` (portet fra `tools/lag_lyd.py` i Toms Morbidium). De første 45 opptakene ble hentet til Morbidium og kopiert hit uendret; resten er hentet for dette spillet på samme måte.',
          'Alle er fri for bruk (CC0 1.0, «No Rights Reserved»). Vi krediterer likevel alle som har spilt dem inn. Metadata (gruppe, type, lengde og sløyfepunkter) står i `sound.json`.', '',
          'Den syntetiserte lyden i `src/core/audio.ts` er reserven. Den spiller alene til en fil er lastet, når en fil ikke kan lastes, i enkeltfil-bygget og når RECORDED SOUNDS er slått av.', '',
          '## Lydeffekter og stemningslyder (Freesound)', '', '| Fil | Tittel | Av | Kilde |', '|---|---|---|---|']
    for k, m in sorted(meta.items()):
        if m['kilde'] == 'Freesound': ut.append(f"| `{k}.mp3` | {m['tittel'].replace('|', '/')} | {m['bruker']} | {m['side']} |")
    ut += ['', '## Instrumentprøver (Versilian Community Sample Library, VCSL)', '', 'Versilian Studios, CC0 1.0, https://github.com/sgossner/VCSL', '', '| Fil | Prøve |', '|---|---|']
    for k, m in sorted(meta.items()):
        if m['kilde'] == 'VCSL': ut.append(f"| `{k}.mp3` | {m['fil']} |")
    ut += ['', '## Instrumenter i musikken (Karoryfer Lecolds, github.com/sfzinstruments)', '',
           'Emilyguitar (el-gitaren, en Epiphone med humbuckere, spilt og mappet av D. Smolken), Growlybass (bassen, en Squier Jazz Bass) og Big Rusty Drums (trommene). CC0 1.0. Trommene er nærmikrofonen og overheadene blandet.', '',
           '| Fil | Prøve | Bibliotek |', '|---|---|---|']
    for k, m in sorted(meta.items()):
        if m['kilde'] == 'Karoryfer': ut.append(f"| `{k}.mp3` | {m['fil']} | {m['side']} |")
    stemmer = sorted(k for k, m in meta.items() if m.get('type') == 'voice')
    if stemmer:
        ut += ['', '## Replikker (laget for spillet i VoiceStudio med stemmedesign, ingen kloning av ekte stemmer)', '',
               'Manuset og stemmebeskrivelsene står i docs/STEMMER.md.', '', '| Fil | Lengde |', '|---|---|']
        ut += [f"| `{k}.mp3` | {meta[k]['sek']} s |" for k in stemmer]
    (UT / 'KILDER.md').write_text('\n'.join(ut) + '\n', encoding='utf-8')

if __name__ == '__main__':
    if '--stemmer' in sys.argv:
        stemmer()
    else:
        bare = set(sys.argv[sys.argv.index('--bare') + 1].split(',')) if '--bare' in sys.argv else None
        lag(bare)
