// Heavy metal fra 1980-tallet, syntetisert med WebAudio. Bare paukene og bekkensvulmen kan komme fra lydbanken
// (VCSL, CC0) når den er lastet; ellers er alt synth.
// Dobbeltinnspilte rytmegitarer panorert ut til hver side, kraftakkorder gjennom forvrengning og et
// høyttalerkabinett, palm mute og galopp, bassgitar, trommer med dobbel stortromme og gated reverb på
// skarptromma (den store trommelyden fra 80-tallet), og leadgitar med vibrato, bend og ekko. Tvillinggitarer
// i terser. I METAL MODE spiller leadgitaren en solo som lages fortløpende ut fra akkordene under.
// Dirigenten (core/conductor.ts) bruker lagbussene, broen, avslutningen og stingerne nederst i MetalBand.
// Alle riff og melodier her er skrevet for spillet.

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Rytmegitar: [steg, grunntone (midi), lengde i steg, åpen akkord (ellers palm mute)]. */
export type RiffNote = [number, number, number, boolean];
/** Leadgitar: [steg, midi, lengde i steg, bend i halvtoner, andrestemme (midi, 0 = ingen, -1 = regn ut)]. */
export type LeadNote = [number, number, number, number, number];

export interface MetalTrack {
  bpm: number;
  steps: number;
  /** Tonehøydeklassene i skalaen (0 = C). Brukes til tvillingstemmen og soloen. */
  scale: number[];
  riff: RiffNote[];
  lead: LeadNote[];
  /** Skalatrinn for tvillingstemmen (2 = ters over, -2 = ters under). 0 = ingen. */
  twin: number;
  kick: number[];
  snare: number[];
  hat: number[];
  crash: number[];
  tom: number[];
  /** Grunntonen for hvert steg (regnes ut fra riffet). */
  roots?: number[];
}

// ---------------------------------------------------------------- notasjon
const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = (name: string) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error('note ' + name);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
};

/**
 * Riff som tekst, ett tegn per sekstendedel. Liten bokstav = palm mute, stor = åpen akkord som ringer,
 * '-' = hold forrige, '.' = pause. roots gir grunntonen for hver bokstav (e = E2 osv.).
 */
function riff(start: number, text: string, roots: Record<string, number>): RiffNote[] {
  const out: RiffNote[] = [];
  const s = text.replace(/\s+/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '-') {
      if (out.length) out[out.length - 1][2]++;
      continue;
    }
    if (ch === '.') continue;
    const r = roots[ch.toLowerCase()];
    if (r === undefined) throw new Error('riff ' + ch);
    out.push([start + i, r, 1, ch !== ch.toLowerCase()]);
  }
  return out;
}

/**
 * Melodi som tekst: "E5:4 G5:2^2 r:2 B5:8/D6". Lengde i sekstendedeler, ^n = bend n halvtoner opp,
 * /X = egen andrestemme, /- = ingen andrestemme, r = pause.
 */
function melody(start: number, text: string): LeadNote[] {
  const out: LeadNote[] = [];
  let s = start;
  for (const tok of text.trim().split(/\s+/)) {
    const m = /^([A-Gr]#?-?\d?):(\d+)(?:\^(-?\d+))?(?:\/([A-G]#?\d|-))?$/.exec(tok);
    if (!m) throw new Error('melody ' + tok);
    const len = Number(m[2]);
    if (m[1] !== 'r') out.push([s, midi(m[1]), len, m[3] ? Number(m[3]) : 0, m[4] === '-' ? 0 : m[4] ? midi(m[4]) : -1]);
    s += len;
  }
  return out;
}

const steps = (n: number, f: (i: number) => boolean) => Array.from({ length: n }, (_, i) => i).filter(f);

/** Flytt en tone et antall skalatrinn (tvillingstemme). Toner utenfor skalaen får en liten ters. */
export function diatonic(m: number, deg: number, scale: number[]) {
  const pc = ((m % 12) + 12) % 12;
  const i = scale.indexOf(pc);
  if (i < 0) return m + (deg > 0 ? 3 : -4);
  const n = scale.length;
  const j = i + deg;
  const oct = Math.floor(j / n);
  const pc2 = scale[((j % n) + n) % n];
  let d = pc2 - pc + oct * 12;
  // Skalaen er lagret fra laveste tonehøydeklasse, så hopp over oktavgrensen må rettes
  if (deg > 0 && d <= 0) d += 12;
  if (deg < 0 && d >= 0) d -= 12;
  return m + d;
}

const E_MINOR = [4, 6, 7, 9, 11, 0, 2].sort((a, b) => a - b);
const E_PHRYG_DOM = [4, 5, 8, 9, 11, 0, 2].sort((a, b) => a - b);
const E_PHRYG = [4, 5, 7, 9, 11, 0, 2].sort((a, b) => a - b);
const B_HARM = [11, 1, 2, 4, 6, 7, 10].sort((a, b) => a - b);

// Grunntoner for riffbokstavene (E-standard stemming: lav E = midi 40)
const R = { e: 40, f: 41, h: 42, g: 43, j: 46, a: 45, b: 47, c: 48, d: 50, k: 44 };

function track(t: Omit<MetalTrack, 'roots'>): MetalTrack {
  // Grunntonen per steg, så soloen vet hvilken akkord den spiller over
  const roots: number[] = new Array(t.steps).fill(t.riff[0]?.[1] ?? 40);
  let cur = t.riff[0]?.[1] ?? 40;
  const byStep = new Map(t.riff.map((n) => [n[0], n[1]]));
  for (let s = 0; s < t.steps; s++) {
    cur = byStep.get(s) ?? cur;
    roots[s] = cur;
  }
  return { ...t, roots };
}

// ---------------------------------------------------------------- låtene
export const METAL_TRACKS: Record<string, MetalTrack> = {
  // OATH OF STEEL: episk og tung, åpne akkorder og så galopp med tvillinggitarer
  title: track({
    bpm: 104,
    steps: 128,
    scale: E_MINOR,
    riff: [
      ...riff(0, 'E--------------- C--------------- D--------------- E-------e-eee-ee', R),
      ...riff(64, 'e-eee-eee-eee-ee c-ccc-ccc-ccc-cc d-ddd-ddd-ddd-dd d-ddd-ddB---B---', R),
    ],
    lead: [
      ...melody(0, 'B4:4/- E5:4/- G5:6/- F#5:2/- E5:4/- C5:4/- G5:8/- F#5:4/- A5:4/- D6:6/- C6:2/- A5:8^2/- G5:4/- E5:4/-'),
      ...melody(64, 'E5:2 F#5:2 G5:4 F#5:2 E5:2 D5:2 E5:2 G5:2 A5:2 B5:4 A5:2 G5:2 F#5:2 G5:2 A5:2 B5:2 C6:4 B5:2 A5:2 G5:2 A5:2 B5:4/D#6 A5:2/C6 G5:2/B5 F#5:8/D#6'),
    ],
    twin: 2,
    kick: [...steps(64, (i) => i % 16 === 0 || i % 16 === 10), ...steps(64, (i) => i % 4 === 0 || i % 8 === 6).map((i) => i + 64)],
    snare: [...steps(64, (i) => i % 16 === 8), ...steps(64, (i) => i % 8 === 4).map((i) => i + 64)],
    hat: steps(64, (i) => i % 2 === 0).map((i) => i + 64),
    crash: [0, 16, 32, 48, 64, 96, 112],
    tom: [60, 61, 62, 63, 124, 125, 126, 127],
  }),
  // THE ROAD OF MILD PERIL: galopp i E-moll, melodi med tvillinggitarer i andre halvdel
  stage: track({
    bpm: 150,
    steps: 128,
    scale: E_MINOR,
    riff: [
      ...riff(0, 'e-eee-eee-eee-ee e-eee-eeG---H--- c-ccc-ccc-ccc-cc d-ddd-ddd-ddD---', R),
      ...riff(64, 'e-eee-eee-eee-ee a-aaa-aaa-aaa-aa c-ccc-ccd-ddd-dd B-------B---b-bb', R),
    ],
    lead: melody(64, 'B4:2 E5:2 G5:2 B5:2 A5:4 G5:4 C6:2 B5:2 A5:2 E5:2 A5:4 C6:4 B5:4 G5:4 A5:4 F#5:4 B5:4/D#6 A5:2/C6 G5:2/B5 F#5:8/D#6'),
    twin: 2,
    kick: steps(128, (i) => i % 4 === 0 || i % 16 === 6 || i % 16 === 14),
    snare: steps(128, (i) => i % 8 === 4),
    hat: steps(128, (i) => i % 2 === 0),
    crash: [0, 32, 64, 112],
    tom: [124, 125, 126, 127],
  }),
  // THE SWAMP OF MOIST REGRET: seig doom med blåtone og bluesbend
  swamp: track({
    bpm: 92,
    steps: 128,
    scale: E_MINOR,
    riff: [
      ...riff(0, 'E-------G---E--- J---A-------G--- E-------G---E--- D---C---J---A-B-', R),
      ...riff(64, 'E-e-e-e-G-g-E--- J-j-A-a-G---E--- E-------G---E--- D---C---J---B---', R),
    ],
    lead: melody(64, 'B4:4^2/- A4:4/- G4:4/- E4:4/- G4:4^2/- E4:4/- D4:4/- E4:4/- E5:8^2/- D5:4/- B4:4/- D5:4^1/- B4:4/- A4:4/- A#4:4/-'),
    twin: 0,
    kick: steps(128, (i) => i % 16 === 0 || i % 16 === 10 || i % 16 === 11),
    snare: steps(128, (i) => i % 16 === 8),
    hat: steps(128, (i) => i % 4 === 0 || i % 4 === 2),
    crash: [0, 64],
    tom: [60, 62, 124, 126],
  }),
  // FROSTBITE PASS: speed metal i H-moll med tremolo og thrash-takt
  frost: track({
    bpm: 184,
    steps: 128,
    scale: B_HARM,
    riff: [
      ...riff(0, 'bbbbbbbbbbbbbbbb gggggggggggggggg aaaaaaaaaaaaaaaa hhhhhhhhhhhhH---', R),
      ...riff(64, 'bbbbbbbbbbbbbbbb gggggggggggggggg aaaaaaaaaaaaaaaa hhhhhhhhH-------', R),
    ],
    lead: melody(64, 'F#5:2 B5:2 D6:2 C#6:2 B5:4 F#5:4 G5:2 B5:2 D6:2 E6:2 D6:4 B5:4 A5:2 C#6:2 E6:2 D6:2 C#6:4 A5:4 A#5:4/C#6 C#6:4/E6 F#6:8/A#6'),
    twin: 2,
    kick: steps(128, (i) => i % 4 === 0),
    snare: steps(128, (i) => i % 4 === 2),
    hat: steps(128, (i) => i % 4 === 0),
    crash: [0, 64, 112],
    tom: [60, 61, 62, 63],
  }),
  // THE SCORCHLANDS: frygisk thrash med kromatiske aksenter
  scorch: track({
    bpm: 138,
    steps: 128,
    scale: E_PHRYG,
    riff: [
      ...riff(0, 'e.e.eeF-e.e.eeG- e.e.eeF-e.e.eeJ- e.e.eeF-e.e.eeG- F---E---J---A---', R),
      ...riff(64, 'e.e.eeF-e.e.eeG- e.e.eeF-e.e.eeJ- e.e.eeF-e.e.eeG- F---E---J---A---', R),
    ],
    lead: melody(64, 'E5:2 F5:2 E5:4 G5:2 F5:2 E5:4 E5:2 F5:2 A#5:4 A5:2 G5:2 F5:4 E5:2 F5:2 G5:4 A5:2 A#5:2 B5:4 C6:4 B5:4 A#5:4 A5:4^1'),
    twin: -2,
    kick: steps(128, (i) => [0, 2, 4, 5, 8, 10, 12, 13].includes(i % 16)),
    snare: steps(128, (i) => i % 8 === 4),
    hat: steps(128, (i) => i % 2 === 0),
    crash: [0, 48, 64, 112],
    tom: [60, 61, 62, 63],
  }),
  // STEEL AGAINST STEEL: dueller, sjefer og tårnet. Sekstendelschug, dobbel stortromme, spansk frygisk
  duel: track({
    bpm: 168,
    steps: 128,
    scale: E_PHRYG_DOM,
    riff: [
      ...riff(0, 'eeeeeeeeeeeeF-E- eeeeeeeeeeeeG-F- eeeeeeeeeeeeJ-A- eeeeF-eeeeG-A-J-', R),
      ...riff(64, 'E-------F---G--- E-------J---A--- e.e.e.eeF.F.F.ff G---F---E-------', R),
    ],
    lead: melody(64, 'E5:2 F5:2 G#5:4 F5:2 E5:2 D5:4 E5:2 F5:2 A5:4 G#5:2 F5:2 E5:4 B5:2 C6:2 B5:2 A5:2 G#5:2 A5:2 B5:4 C6:4 B5:4 G#5:4 E5:4^1'),
    twin: 2,
    kick: [...steps(64, () => true), ...steps(64, (i) => [0, 3, 6, 8, 11, 14].includes(i % 16)).map((i) => i + 64)],
    snare: [...steps(64, (i) => i % 8 === 4), ...steps(64, (i) => i % 16 === 8).map((i) => i + 64)],
    hat: steps(64, (i) => i % 4 === 2).map((i) => i + 64),
    crash: [0, 32, 64, 80, 96, 112],
    tom: [60, 61, 62, 63],
  }),
  // NIGHT WATCH: seig metal-ballade for nattleiren, åpne akkorder som ringer og tvillinggitarer i andre halvdel
  night: track({
    bpm: 84,
    steps: 128,
    scale: E_MINOR,
    riff: riff(0, 'E--------------- C--------------- A--------------- B--------------- E-------G------- C-------D------- A-------C------- B-------b-b-b-b-', R),
    lead: [
      ...melody(0, 'B4:6/- E5:2/- G5:8/- E5:6/- D5:2/- C5:8/- A4:4/- C5:4/- E5:4/- D5:4/- D#5:8/F#5 B4:8/D#5'),
      ...melody(64, 'G5:4 F#5:4 B5:8 A5:4 G5:4 F#5:8 E5:4 G5:4 A5:4 C6:4 B5:8/D#6 A5:4/C6 F#5:4/A5'),
    ],
    twin: 2,
    kick: steps(128, (i) => i % 16 === 0 || i % 16 === 10),
    snare: steps(128, (i) => i % 16 === 8),
    hat: steps(128, (i) => i % 4 === 0 || i % 4 === 2),
    crash: [0, 64],
    tom: [60, 61, 62, 63, 124, 125, 126, 127],
  }),
  // Seiersfanfare: åpne akkorder og en lead helt opp
  victory: track({
    bpm: 132,
    steps: 64,
    scale: E_MINOR,
    riff: riff(0, 'E-------E-e-E--- C---D---E------- A-------B------- E---------------', R),
    lead: melody(0, 'B4:2 E5:2 G5:2 B5:2 E6:8 E6:2 D6:2 C6:4 D6:4 E6:4 A5:4 C6:4 B5:4 D#6:4/F#6 E6:16'),
    twin: -2,
    kick: [0, 8, 10, 12, 16, 20, 24, 32, 40, 48],
    snare: [4, 12, 20, 28, 36, 44],
    hat: steps(64, (i) => i % 2 === 0 && i < 48),
    crash: [0, 16, 32, 48],
    tom: [44, 45, 46, 47],
  }),
};

// ---------------------------------------------------------------- lydbygging
function driveCurve(k: number, n = 2048) {
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

/** Impulsrespons for romklang: hall (lang hale) eller gated (flat og brått kuttet, 80-talls skarptromme). */
export function impulse(ctx: BaseAudioContext, dur: number, gated: boolean) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = gated ? (t < 0.8 ? 1 - t * 0.35 : ((1 - t) / 0.2) * 0.72) : Math.pow(1 - t, 3.2);
      d[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return buf;
}

interface Amp { input: GainNode }

/**
 * En forsterker: gain, høypass inn (Hz), kabinettet (lavpass, Hz), nivå ut, og klangen etter forvrengningen: dunken i
 * kabinettet (dB ved 110 Hz), midten (dB ved 450 Hz) og nærværet (dB ved 1,9 kHz).
 */
interface AmpSpec { drive: number; hp: number; lp: number; level: number; thump: number; mid: number; pres: number }
/**
 * Synthen trenger mye gain for å likne en gitar. Opptakene (Karoryfer) kjøres som et stack fra 80-tallet, med mye
 * mindre gain, så anslaget, klangen i strengene og uttoningen høres gjennom forvrengningen, og med mer dunk i
 * kabinettet, siden en ekte streng gir mindre bunn enn en sagtann etter forvrengningen.
 */
const AMPS: Record<'rhythm' | 'lead' | 'rhythmReal' | 'leadReal', AmpSpec> = {
  rhythm: { drive: 18, hp: 110, lp: 5200, level: 0.42, thump: 0, mid: -4, pres: 4 },
  lead: { drive: 34, hp: 320, lp: 4600, level: 0.26, thump: 0, mid: -4, pres: 4 },
  rhythmReal: { drive: 10, hp: 90, lp: 5400, level: 0.5, thump: 6, mid: -7, pres: 6 },
  leadReal: { drive: 20, hp: 250, lp: 4800, level: 0.3, thump: 0, mid: -3, pres: 4 },
};

/** Intensitet (core/conductor.ts): 0 rolig, 1 kamp (låta som skrevet), 2 hete, 3 sjef. */
export type Level = 0 | 1 | 2 | 3;

/**
 * Nivået på lagbussene per intensitet: [rytmegitarer, leadgitar, bass, trommer, ekstralaget]. Nivå 1 er låta som
 * skrevet. Ekstralaget er dobbel stortromme og crash på hver takt (hete), og kor, pauker og stortromme i
 * sekstendeler (sjef).
 */
const MIX: Record<Level, readonly [number, number, number, number, number]> = {
  0: [0.74, 0.3, 0.9, 0.8, 0],
  1: [1, 1, 1, 1, 0],
  2: [1, 1.12, 1, 1, 1],
  3: [1.04, 1.12, 1.06, 1.04, 1],
};

/** Inngangene til gitarene og bassen for én låt. Ved et bytte kveles det som fortsatt klinger fra den gamle. */
interface Section { nodes: GainNode[]; r: GainNode[]; rr: GainNode[]; lead: GainNode; leadR: GainNode; bass: GainNode; bassR: GainNode; end: number }

/** Et opptak bandet kan bruke (VCSL-bekkenet): bufferet og stillheten foran i sekunder. */
export interface Sample { buf: AudioBuffer; lead: number }
/** Stemt slagverk fra lydbanken (paukene): gruppe, MIDI-tone, tid, nivå og buss. Gir false når opptaket mangler. */
export type Sampler = (group: string, midi: number, t: number, vol: number, out: AudioNode) => boolean;

/** Et opptak i riktig tonehøyde: bufferet, avspillingsfarten og stillheten foran i sekunder. */
export interface Pitched { buf: AudioBuffer; rate: number; lead: number }
/**
 * Instrumentopptakene fra lydbanken (Karoryfer, CC0): trommene, gitaren (rent, direkte, så den går gjennom
 * forsterkerne under) og bassen. `full` sier om hele gruppen er lastet, så et instrument ikke bytter fra synth
 * midt i en frase. Bandet lager kildene selv i sin egen kontekst, så det virker også ved offline-rendring.
 */
export interface SampleSource {
  pick(group: string, midi: number): Pitched | null;
  full(group: string): boolean;
}

/** Hvor hardt gitar- og bassopptakene går inn i forsterkerne sine (AMPS og BASS_R). */
const REAL = { chord: 1.2, mute: 4, lead: 1, bass: 1.2 };
/** Den ekte bassen: nivået på den rene bunnen, gain og nivå på knurren over 160 Hz. */
const BASS_R = { low: 6, drive: 4, growl: 0.8 };
/** Et filter i EQ-en på et trommeopptak: type, frekvens (Hz), Q og forsterkning (dB). */
type Eq = readonly [BiquadFilterType, number, number, number];
/**
 * De ekte trommene mikset som på en metalplate fra 80-tallet: nivå og EQ. Stortromma får klikket fra køllen og
 * mindre boks, så den høres gjennom gitarveggen, skarptromma smell, tammene anslag, og bekkenene mister rumlingen fra
 * resten av settet (og crashen den skarpe ringen på 546 Hz). Plassen i stereobildet er sett fra publikum: hi-hat og de
 * små tammene til høyre.
 */
const KIT: Record<'kick' | 'snare' | 'hat' | 'crash' | 'tom', { vol: number; eq: readonly Eq[] }> = {
  kick: { vol: 1.6, eq: [['highpass', 55, 0.7, 0], ['peaking', 115, 1, 5], ['peaking', 450, 1.2, -5], ['peaking', 3800, 1.2, 11]] },
  snare: { vol: 2.6, eq: [['highpass', 100, 0.7, 0], ['peaking', 200, 1.3, 2], ['peaking', 5000, 0.9, 5], ['highshelf', 8000, 0.7, 3]] },
  hat: { vol: 0.45, eq: [['highpass', 500, 0.7, 0]] },
  crash: { vol: 1.3, eq: [['highpass', 650, 0.7, 0], ['peaking', 546, 4, -9], ['highshelf', 7000, 0.7, 3]] },
  tom: { vol: 1.3, eq: [['peaking', 480, 1.2, -6], ['peaking', 4000, 1.2, 7]] },
};
const DRUMS = ['ins_stortromme', 'ins_skarp', 'ins_hihat', 'ins_crash', 'ins_tam'];
const GUITARS = ['ins_gitar', 'ins_gitarkort'];
/** Palm mute bruker de korte gitartonene opp til denne tonen, lysere toner de lange (med kort konvolutt). */
const MUTE_TOP = 55;
const hzToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

/** Flytt en tone med hele oktaver til den ligger fra lo og opp til (men ikke med) lo + 12. */
export function fold(m: number, lo: number) {
  return lo + ((((m - lo) % 12) + 12) % 12);
}
/** Grunntonen som gitarakkord (E2 til D#3). */
const guitar = (root: number) => fold(root, 40);
const inScale = (m: number, scale: number[]) => scale.includes(((m % 12) + 12) % 12);
/** Nærmeste skalatone på eller under m (blåtonene i riffene, som A# i myra, ligger utenfor skalaen). */
function snap(m: number, scale: number[]) {
  for (let k = 0; k < 12; k++) if (inScale(m - k, scale)) return m - k;
  return m;
}
/** En tone et antall skalatrinn over m (0 = m selv). */
const deg = (m: number, d: number, scale: number[]) => (d === 0 ? m : diatonic(m, d, scale));

/**
 * Toppen i et opptak (sekunder inn i bufferet), målt én gang. Morbidiums svulm tok midten av de 20 ms med mest energi.
 * VCSL-bekkenet vokser i over ett sekund og ligger så nesten flatt i et halvt, så her er toppen der crescendoet når
 * fram: første vindu på 20 ms som er innenfor 1,5 dB av det sterkeste.
 */
const peaks = new WeakMap<AudioBuffer, number>();
export function peakOf(b: AudioBuffer) {
  const known = peaks.get(b);
  if (known !== undefined) return known;
  const d = b.getChannelData(0);
  const w = Math.max(1, Math.floor(b.sampleRate * 0.02));
  const hop = Math.max(1, Math.floor(w / 4));
  const en: number[] = [];
  for (let i = 0; i + w <= d.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += d[j] * d[j];
    en.push(s);
  }
  let top = 0;
  for (const e of en) top = Math.max(top, e);
  const k = Math.max(0, en.findIndex((e) => e >= top * 0.708));
  const p = (k * hop + w / 2) / b.sampleRate;
  peaks.set(b, p);
  return p;
}

/**
 * Hele bandet. dest er musikkbussen. Lager forsterkere, kabinett, romklang og ekko én gang, og lager nye
 * oscillatorer per tone (WebAudio-oscillatorer kan bare startes én gang).
 *
 * Lagene (dirigenten, core/conductor.ts): rytmegitarene, leadgitaren, bassen og trommene har hver sin buss som
 * intensiteten skrur opp og ned, og et ekstralag (dobbel stortromme, crash, kor og pauker) kommer inn ved hete og
 * sjef. Stingere (stuping, skrik, bekkensvulm, innslagene) går utenom lagene, så de alltid høres.
 */
export class MetalBand {
  /** METAL MODE: trommeslageren gir alt (stortromme i sekstendeler og crash på hver takt). */
  shred = false;
  /**
   * Soloen erstatter melodien. null betyr at den følger shred (som før dirigenten kom). Dirigenten setter den selv,
   * så soloen starter på taktstreken selv når METAL MODE kommer inn på et slag midt i takten.
   */
  solo: boolean | null = null;
  /** Intensiteten (setLevel). */
  level: Level = 1;
  /** Pauker fra lydbanken (settes av AudioEngine). Uten den spiller bandet syntpauker. */
  sampler: Sampler | null = null;
  /** Trommer, gitar og bass fra lydbanken (settes av AudioEngine). Uten dem spiller bandet synth, som før. */
  samples: SampleSource | null = null;
  /** Bekkensvulmen fra lydbanken (VCSL ins_bekken_1). Uten den blir svulmen en baklengs crash i synth. */
  swellSample: (() => Sample | null) | null = null;
  private noise: AudioBuffer;
  private rhythm: Amp[] = [];
  private lead: Amp;
  private bassIn: GainNode;
  /** Forsterkerne og bassinngangen for opptakene (AMPS.rhythmReal og leadReal). */
  private rhythmR: Amp[] = [];
  private leadR: Amp;
  private bassInR: GainNode;
  /** Crashen veksler mellom to bekkener, ett på hver side. */
  private crashSide = 1;
  private drums: GainNode;
  private hall: GainNode;
  private gate: GainNode;
  private echo: DelayNode;
  private echoSd = 0;
  private rhythmBus: GainNode;
  private leadBus: GainNode;
  private bassOut: GainNode;
  private extra: GainNode;
  private extraKit: GainNode;
  private fx: GainNode;
  private fxKit: GainNode;
  /** Stingergitaren, for synthen og for opptakene. */
  private stingIn: (GainNode | null)[] = [null, null];
  private sec: Section;
  private oldSecs: Section[] = [];
  private soloPhrase = 0;
  private soloSeed = 1;
  private soloFresh = false;

  constructor(private ctx: BaseAudioContext, dest: AudioNode) {
    const c = ctx;
    // Alt går gjennom et høypass så subbass og rumling ikke spiser opp plassen til lydeffektene
    const out = c.createBiquadFilter();
    out.type = 'highpass';
    out.frequency.value = 38;
    out.connect(dest);
    const bus = (v: number) => {
      const g = c.createGain();
      g.gain.value = v;
      g.connect(out);
      return g;
    };
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Romklang og ekko som alle kan sende til
    const hall = c.createConvolver();
    hall.buffer = impulse(c, 2.2, false);
    const hallOut = c.createGain();
    hallOut.gain.value = 0.32;
    hall.connect(hallOut).connect(out);
    this.hall = c.createGain();
    this.hall.connect(hall);
    const gate = c.createConvolver();
    gate.buffer = impulse(c, 0.3, true);
    const gateOut = c.createGain();
    gateOut.gain.value = 0.5;
    gate.connect(gateOut).connect(out);
    this.gate = c.createGain();
    this.gate.connect(gate);

    // To rytmegitarer, én på hver side (dobbeltinnspilling), på hver sin buss for lagene. Opptakene har egne
    // forsterkere på de samme plassene.
    this.rhythmBus = bus(1);
    for (const pan of [-0.8, 0.8]) {
      for (const [spec, list] of [[AMPS.rhythm, this.rhythm], [AMPS.rhythmReal, this.rhythmR]] as const) {
        const amp = this.makeAmp(spec);
        const p = c.createStereoPanner();
        p.pan.value = pan;
        amp.out.connect(p).connect(this.rhythmBus);
        list.push({ input: amp.input });
      }
    }
    // Leadgitar i midten, mer gain, ekko og hall. Ekkoet og hallen hentes etter lagbussen, så halen følger med ned.
    const lead = this.makeAmp(AMPS.lead);
    const leadR = this.makeAmp(AMPS.leadReal);
    this.leadBus = bus(1);
    lead.out.connect(this.leadBus);
    leadR.out.connect(this.leadBus);
    this.echo = c.createDelay(1.5);
    this.echo.delayTime.value = 0.3;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const echoTone = c.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2400;
    const echoOut = c.createGain();
    echoOut.gain.value = 0.35;
    this.leadBus.connect(this.echo);
    this.echo.connect(echoTone).connect(fb).connect(this.echo);
    echoTone.connect(echoOut).connect(out);
    this.leadBus.connect(this.hall);
    this.lead = { input: lead.input };
    this.leadR = { input: leadR.input };

    // Bassgitar: litt knurr, ikke mye
    this.bassIn = c.createGain();
    const bassDrive = c.createWaveShaper();
    bassDrive.curve = driveCurve(2.5);
    const bassLp = c.createBiquadFilter();
    bassLp.type = 'lowpass';
    bassLp.frequency.value = 1100;
    this.bassOut = bus(0.3);
    this.bassIn.connect(bassDrive).connect(bassLp).connect(this.bassOut);
    // Den ekte bassen som på en metalplate: ren bunn under 200 Hz, og knurr med plekteret over, blandet
    this.bassInR = c.createGain();
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 200;
    const lowG = c.createGain();
    lowG.gain.value = BASS_R.low;
    this.bassInR.connect(low).connect(lowG).connect(this.bassOut);
    const growlHp = c.createBiquadFilter();
    growlHp.type = 'highpass';
    growlHp.frequency.value = 160;
    const growl = c.createWaveShaper();
    growl.curve = driveCurve(BASS_R.drive);
    growl.oversample = '2x';
    const growlLp = c.createBiquadFilter();
    growlLp.type = 'lowpass';
    growlLp.frequency.value = 2600;
    const growlG = c.createGain();
    growlG.gain.value = BASS_R.growl;
    this.bassInR.connect(growlHp).connect(growl).connect(growlLp).connect(growlG).connect(this.bassOut);

    this.drums = bus(0.72);
    // Ekstralaget (hete og sjef) og stingerne, som går utenom lagene
    this.extra = bus(0);
    this.extraKit = c.createGain();
    this.extraKit.gain.value = 0.72;
    this.extraKit.connect(this.extra);
    this.fx = bus(1);
    this.fxKit = c.createGain();
    this.fxKit.gain.value = 0.72;
    this.fxKit.connect(this.fx);
    this.sec = this.section();
  }

  /** Forvrenger og kabinett: inn, høypass, forvrengning, to lavpass (4x12-kabinett), dunk, midt og nærvær, ut. */
  private makeAmp(a: AmpSpec) {
    const c = this.ctx;
    const input = c.createGain();
    const pre = c.createBiquadFilter();
    pre.type = 'highpass';
    pre.frequency.value = a.hp;
    const shaper = c.createWaveShaper();
    shaper.curve = driveCurve(a.drive);
    shaper.oversample = '4x';
    const cab1 = c.createBiquadFilter();
    cab1.type = 'lowpass';
    cab1.frequency.value = a.lp;
    cab1.Q.value = 0.9;
    const cab2 = c.createBiquadFilter();
    cab2.type = 'lowpass';
    cab2.frequency.value = a.lp * 1.3;
    let tail: AudioNode = input.connect(pre).connect(shaper).connect(cab1).connect(cab2);
    if (a.thump) {
      const thump = c.createBiquadFilter();
      thump.type = 'peaking';
      thump.frequency.value = 110;
      thump.Q.value = 0.9;
      thump.gain.value = a.thump;
      tail = tail.connect(thump);
    }
    const mid = c.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 450;
    mid.Q.value = 1.1;
    mid.gain.value = a.mid;
    const pres = c.createBiquadFilter();
    pres.type = 'peaking';
    pres.frequency.value = 1900;
    pres.Q.value = 1.2;
    pres.gain.value = a.pres;
    const out = c.createGain();
    out.gain.value = a.level;
    tail.connect(mid).connect(pres).connect(out);
    return { input, out };
  }

  /**
   * Leadgitaren for stingerne: en egen forsterker utenom lagene og bytteinngangene, laget første gang den trengs.
   * real = forsterkeren for opptakene.
   */
  private sting(real = false): GainNode {
    const i = real ? 1 : 0;
    let input = this.stingIn[i];
    if (!input) {
      const a = this.makeAmp(real ? AMPS.leadReal : AMPS.lead);
      a.out.connect(this.fx);
      a.out.connect(this.hall);
      input = this.stingIn[i] = a.input;
    }
    return input;
  }

  private section(): Section {
    const c = this.ctx;
    const mk = (to: AudioNode) => {
      const g = c.createGain();
      g.connect(to);
      return g;
    };
    const r = this.rhythm.map((a) => mk(a.input));
    const rr = this.rhythmR.map((a) => mk(a.input));
    const lead = mk(this.lead.input);
    const leadR = mk(this.leadR.input);
    const bass = mk(this.bassIn);
    const bassR = mk(this.bassInR);
    return { nodes: [...r, ...rr, lead, leadR, bass, bassR], r, rr, lead, leadR, bass, bassR, end: Infinity };
  }

  /**
   * Kvel alt som klinger fra gitarene og bassen ved t (broen, et bytte, en avslutning eller et stopp). Nye toner går
   * til nye innganger, så akkorder som fortsatt ringer fra den gamle låta ikke legger seg over den nye.
   */
  choke(t: number, fade = 0.04) {
    const old = this.sec;
    for (const g of old.nodes) {
      g.gain.setValueAtTime(1, t);
      g.gain.linearRampToValueAtTime(0, t + fade);
    }
    old.end = t + fade;
    const now = this.ctx.currentTime;
    this.oldSecs = this.oldSecs.filter((s) => {
      if (s.end > now - 5) return true;
      for (const g of s.nodes) g.disconnect();
      return false;
    });
    this.oldSecs.push(old);
    this.sec = this.section();
  }

  private noiseAt(t: number, dur: number, dest: AudioNode, type: BiquadFilterType, freq: number, peak: number, decay: number, q = 0.7) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5, dur);
    return g;
  }

  // ---------------------------------------------------------------- opptak
  /** Er alle gruppene lastet (og opptakene slått på)? */
  private real(groups: string[]) {
    const s = this.samples;
    return !!s && groups.every((g) => s.full(g));
  }

  /** Start et opptak ved t med nivå og buss. Med d stopper det etter d sekunder med en kort uttoning. */
  private voice(p: Pitched, t: number, vol: number, out: AudioNode, d = 0, rel = 0.06) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = p.buf;
    src.playbackRate.value = p.rate;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g).connect(out);
    src.start(t, Math.min(p.lead, Math.max(0, p.buf.duration - 0.01)));
    if (d > 0) {
      g.gain.setValueAtTime(vol, t + d);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + rel);
      src.stop(t + d + rel + 0.02);
    }
    return { src, g };
  }

  /**
   * Et trommeopptak gjennom EQ-en i KIT og eventuelt panorering til bussen. Gir det siste leddet, så romklangen kan
   * hentes etter EQ-en.
   */
  private drum(p: Pitched, t: number, kind: keyof typeof KIT, vel: number, dest: AudioNode, pan = 0) {
    const c = this.ctx;
    const chain: AudioNode[] = KIT[kind].eq.map(([type, hz, q, db]) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = hz;
      b.Q.value = q;
      b.gain.value = db;
      return b;
    });
    if (pan) {
      const s = c.createStereoPanner();
      s.pan.value = pan;
      chain.push(s);
    }
    if (!chain.length) chain.push(c.createGain());
    for (let i = 1; i < chain.length; i++) chain[i - 1].connect(chain[i]);
    const tail = chain[chain.length - 1];
    tail.connect(dest);
    this.voice(p, t, KIT[kind].vol * vel, chain[0]);
    return tail;
  }

  // ---------------------------------------------------------------- gitarer
  /** Kraftakkord (grunntone, kvint og oktav) på begge gitarene. Palm mute er mørk og kort. Bassen følger med. */
  powerChord(t: number, root: number, dur: number, open: boolean, vel = 1, withBass = true) {
    const c = this.ctx;
    const real = this.real(GUITARS);
    this.rhythm.forEach((_amp, side) => {
      const input = (real ? this.sec.rr : this.sec.r)[side];
      const t0 = t + side * 0.007;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = open ? 3800 : real ? 450 : 620;
      f.Q.value = open ? 0.7 : 1.4;
      const g = c.createGain();
      const len = open ? dur : Math.min(dur, 0.2);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vel, t0 + 0.004);
      if (open) {
        g.gain.exponentialRampToValueAtTime(vel * 0.55, t0 + Math.max(0.01, len - 0.03));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + 0.07);
      } else {
        g.gain.exponentialRampToValueAtTime(vel * 0.3, t0 + len * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + 0.03);
      }
      f.connect(g).connect(input);
      const notes = open ? [0, 7, 12] : [0, 7];
      const cents = side ? [-4, 5, 3] : [2, -2, -3];
      // Ekte gitar: én ren tone per streng inn i sin egen forsterker, som på en ekte forsterker (plekteret er i opptaket)
      if (real) {
        notes.forEach((iv, k) => {
          const m = root + iv;
          const p = this.samples!.pick(open || m > MUTE_TOP ? 'ins_gitar' : 'ins_gitarkort', m);
          if (!p) return;
          const v = this.voice(p, t0, open ? REAL.chord : REAL.mute, f, len + 0.08, 0.04);
          v.src.detune.value = cents[k];
        });
        return;
      }
      notes.forEach((iv, k) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(root + iv);
        o.detune.value = cents[k];
        o.connect(f);
        o.start(t0);
        o.stop(t0 + len + 0.1);
      });
      // Plekteret
      this.noiseAt(t0, 0.02, input, 'highpass', 1800, 0.35 * vel, 0.012);
    });
    // Bassen følger grunntonen en oktav ned
    if (withBass) this.bass(t, root - 12, open ? dur : Math.min(dur, 0.24), vel);
  }

  private bass(t: number, m: number, dur: number, vel: number) {
    const c = this.ctx;
    // Ekte bass (en Jazz Bass tatt opp direkte) i sin egen kjede, med lavpasset åpnere så plekteret høres
    const p = this.real(['ins_bass']) ? this.samples!.pick('ins_bass', m) : null;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t + Math.max(0.02, dur - 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(p ? 3200 : 1400, t);
    f.frequency.exponentialRampToValueAtTime(p ? 900 : 380, t + dur + 0.05);
    f.connect(g).connect(p ? this.sec.bassR : this.sec.bass);
    if (p) {
      this.voice(p, t, REAL.bass, f, dur + 0.06, 0.04);
      return;
    }
    for (const type of ['sawtooth', 'sine'] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.08);
    }
  }

  /** Én leadtone med forsinket vibrato og eventuelt bend. sting = på stingergitaren (innslagene). */
  leadNote(t: number, m: number, dur: number, bend = 0, vel = 1, pan = 0, sting = false) {
    const c = this.ctx;
    // Ekte gitar (opptaket) i sin egen forsterker. Lange toner (over 2,4 s) spilles av synthen.
    const p = dur < 2.4 && this.real(['ins_gitar']) ? this.samples!.pick('ins_gitar', m) : null;
    let dest: AudioNode = sting ? this.sting(!!p) : p ? this.sec.leadR : this.sec.lead;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    g.gain.setValueAtTime(vel, t + Math.max(0.012, dur - 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.07);
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      p.connect(dest);
      dest = p;
    }
    g.connect(dest);
    const f0 = mtof(m);
    // Vibratoen kommer etter at tonen har satt seg, som hos en ekte gitarist
    const vib = c.createOscillator();
    vib.frequency.value = 6.2;
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    if (dur > 0.22) {
      vg.gain.setValueAtTime(0, t + 0.12);
      vg.gain.linearRampToValueAtTime(bend ? 22 : 30, t + 0.3);
    }
    vib.connect(vg);
    // Ekte gitar: vibrato og bend på detune (cent)
    if (p) {
      const v = this.voice(p, t, REAL.lead, g, dur + 0.08, 0.05);
      if (bend) {
        v.src.detune.setValueAtTime(0, t);
        v.src.detune.linearRampToValueAtTime(bend * 100, t + Math.min(0.18, dur * 0.4));
      }
      vg.connect(v.src.detune);
      vib.start(t);
      vib.stop(t + dur + 0.1);
      return;
    }
    for (const [type, det] of [['sawtooth', 0], ['square', 7]] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (bend) o.frequency.exponentialRampToValueAtTime(mtof(m + bend), t + Math.min(0.18, dur * 0.4));
      o.detune.value = det;
      vg.connect(o.detune);
      const og = c.createGain();
      og.gain.value = type === 'square' ? 0.5 : 1;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    vib.start(t);
    vib.stop(t + dur + 0.1);
  }

  // ---------------------------------------------------------------- trommer
  kick(t: number, vel = 1, dest: AudioNode = this.drums) {
    if (this.real(DRUMS)) {
      const p = this.samples!.pick('ins_stortromme', 36);
      if (p) {
        this.drum(p, t, 'kick', vel, dest);
        return;
      }
    }
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(56, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.85, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.17);
    // Klikket fra køllen, viktig for at dobbel stortromme skal høres i gitarveggen
    this.noiseAt(t, 0.02, dest, 'bandpass', 3800, 0.55 * vel, 0.014, 1.2);
  }

  snare(t: number, vel = 1) {
    if (this.real(DRUMS)) {
      const p = this.samples!.pick('ins_skarp', 60);
      if (p) {
        // Litt av den korte romklangen også på den ekte skarptromma: det er lyden fra 1986
        const send = this.ctx.createGain();
        send.gain.value = 0.55;
        this.drum(p, t, 'snare', vel, this.drums).connect(send).connect(this.gate);
        return;
      }
    }
    const c = this.ctx;
    const n = this.noiseAt(t, 0.25, this.drums, 'highpass', 1100, 0.55 * vel, 0.2);
    n.connect(this.gate);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(165, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g).connect(this.drums);
    g.connect(this.gate);
    o.start(t);
    o.stop(t + 0.15);
  }

  hat(t: number, vel = 1) {
    if (this.real(DRUMS)) {
      const p = this.samples!.pick('ins_hihat', 60);
      if (p) {
        this.drum(p, t, 'hat', vel, this.drums, 0.3);
        return;
      }
    }
    this.noiseAt(t, 0.05, this.drums, 'highpass', 7500, 0.22 * vel, 0.04);
  }

  crash(t: number, vel = 1, dest: AudioNode = this.drums) {
    if (this.real(DRUMS)) {
      const p = this.samples!.pick('ins_crash', 60);
      if (p) {
        this.crashSide = -this.crashSide;
        this.drum(p, t, 'crash', vel, dest, 0.35 * this.crashSide).connect(this.hall);
        return;
      }
    }
    const g = this.noiseAt(t, 1.7, dest, 'highpass', 3800, 0.4 * vel, 1.6);
    g.connect(this.hall);
    this.noiseAt(t, 0.6, dest, 'bandpass', 6200, 0.25 * vel, 0.5, 3);
  }

  tom(t: number, pitch: number, vel = 1) {
    if (this.real(DRUMS)) {
      // To tammer i opptak (14 og 15 tommer): den nærmeste stemmes til tonen. Virvlene går fra høyre mot venstre.
      const p = this.samples!.pick('ins_tam', hzToMidi(pitch));
      if (p) {
        this.drum(p, t, 'tom', vel, this.drums, Math.max(-0.5, Math.min(0.5, (pitch - 140) / 130))).connect(this.gate);
        return;
      }
    }
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.55, t + 0.25);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7 * vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.drums);
    g.connect(this.gate);
    o.start(t);
    o.stop(t + 0.34);
  }

  /** Pauke på en tone: VCSL-opptaket fra lydbanken når det finnes, ellers en syntpauke (sinus med et lite fall). */
  private timpani(t: number, midi: number, vol: number, out: AudioNode = this.extra) {
    if (this.sampler?.('ins_pauke', midi, t, vol, out)) return;
    const c = this.ctx;
    const f0 = mtof(midi);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f0 * 1.05, t);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 1);
    this.noiseAt(t, 0.05, out, 'lowpass', 900, 0.35 * vol, 0.05);
  }

  // ---------------------------------------------------------------- avspilling og lag
  /** Soloen spiller nå (se solo). */
  get soloing() {
    return this.solo ?? this.shred;
  }

  /** Intensiteten som styrer hva som spilles: METAL MODE teller som minst hete (trommeslageren gir alt). */
  private get eff(): Level {
    return this.shred ? (Math.max(this.level, 2) as Level) : this.level;
  }

  /** Ekkoet er tre sekstendeler. Det settes bare når tempoet endres, og glir over, så ekkohalen ikke knitrer. */
  private setEcho(sd: number, t: number) {
    if (Math.abs(sd - this.echoSd) < 1e-5) return;
    const d = this.echo.delayTime;
    if (this.echoSd === 0) d.setValueAtTime(sd * 3, t);
    else d.setTargetAtTime(sd * 3, t, 0.15);
    this.echoSd = sd;
  }

  /** Nivået på lagbussene for intensiteten (og METAL MODE, der leadgitaren aldri dempes). */
  private mix(t: number, tc: number) {
    const m = MIX[this.eff];
    this.rhythmBus.gain.setTargetAtTime(m[0], t, tc);
    this.leadBus.gain.setTargetAtTime(this.shred ? Math.max(1.12, m[1]) : m[1], t, tc);
    this.bassOut.gain.setTargetAtTime(0.3 * m[2], t, tc);
    this.drums.gain.setTargetAtTime(0.72 * m[3], t, tc);
    this.extra.gain.setTargetAtTime(m[4], t, tc);
  }

  /**
   * Bytt intensitet ved t (dirigenten legger opp på et slag og ned på en taktstrek). Opp går fort og får crash og
   * stortromme på slaget (Morbidium: bekken og pauke). Ned glir over en tredel av en takt. fast = ved låtstart.
   */
  setLevel(n: Level, t: number, sd: number, fast = false) {
    const up = n > this.level;
    this.level = n;
    this.mix(t, fast || up ? 0.03 : (sd * 16) / 3);
    if (up && !fast) {
      this.crash(t, 0.5 + 0.1 * n, this.fxKit);
      this.kick(t, 1, this.fxKit);
      if (n === 3) this.timpani(t, 40, 0.6, this.fxKit);
    }
  }

  /** METAL MODE inn (på et slag) eller ut (på en taktstrek): trommene og lagbussene følger med. */
  setShred(on: boolean, t: number, sd: number) {
    this.shred = on;
    if (!on) this.solo = false;
    this.mix(t, on ? 0.03 : (sd * 16) / 3);
  }

  /** Soloen starter (på en taktstrek), med skalaløpet som første frase. */
  startSolo() {
    this.solo = true;
    this.soloFresh = true;
  }

  /** Spill ett sekstendelssteg av en låt. s er steget i runden, sd er lengden på et steg i sekunder. */
  playStep(tr: MetalTrack, s: number, t: number, sd: number) {
    this.setEcho(sd, t);
    const L = this.eff;
    for (const n of tr.riff) if (n[0] === s) this.powerChord(t, n[1], n[2] * sd, n[3], n[3] ? 0.9 : 0.8);
    if (this.soloing) this.soloStep(tr, s, t, sd);
    else
      for (const n of tr.lead) {
        if (n[0] !== s) continue;
        const dur = n[2] * sd;
        this.leadNote(t, n[1], dur, n[3], 0.9);
        // Tvillingstemmen tier når det er rolig
        const h = L === 0 ? 0 : n[4] === -1 ? (tr.twin ? diatonic(n[1], tr.twin, tr.scale) : 0) : n[4];
        if (h) this.leadNote(t + 0.004, h, dur, n[3], 0.7, 0.35);
      }
    // Trommer. I METAL MODE går stortromma i sekstendeler og det er crash på hver takt. Hete og sjef legger dobbel
    // stortromme (åttendeler og sekstendeler) og crash på hver takt i ekstralaget. Rolig: hi-hat bare på slagene.
    if (this.shred) {
      this.kick(t, s % 4 === 0 ? 1 : 0.75);
      if (s % 16 === 0) this.crash(t, 0.8);
    } else if (tr.kick.includes(s)) this.kick(t, s % 4 === 0 ? 1 : 0.8);
    else if (L === 3 || (L === 2 && s % 2 === 0)) this.kick(t, s % 2 === 0 ? 0.62 : 0.48, this.extraKit);
    if (tr.snare.includes(s)) this.snare(t);
    if (tr.hat.includes(s) && (L > 0 || s % 4 === 0)) this.hat(t, s % 4 === 0 ? 1 : 0.7);
    if (tr.crash.includes(s) && (L > 0 || s === 0)) this.crash(t);
    else if (L >= 2 && !this.shred && s % 16 === 0) this.crash(t, 0.6, this.extraKit);
    if (tr.tom.includes(s)) this.tom(t, 180 - (s % 4) * 30);
    if (this.level === 3) this.bossLayer(tr, s, t, sd);
  }

  /**
   * Sjefslaget (Morbidiums sjefslag i metall): pauker på grunntonen på hver taktstrek, kor på hver takt og der riffet
   * slår en åpen akkord, og paukene ruller mot slutten av hver fjerde takt med kvinten til slutt.
   */
  private bossLayer(tr: MetalTrack, s: number, t: number, sd: number) {
    const bar = s % 16;
    const root = guitar(tr.roots?.[s] ?? 40);
    if (bar === 0) this.timpani(t, root, 0.55);
    const open = tr.riff.find((n) => n[0] === s && n[3]);
    if (bar === 0 || open) {
      // Koret holder til neste åpne akkord eller taktstreken
      let len = 16 - bar;
      for (const n of tr.riff) if (n[3] && n[0] > s && n[0] - s < len) len = n[0] - s;
      this.pad(t, root, tr.scale, len * sd);
    }
    if (Math.floor(s / 16) % 4 === 3 && bar >= 10 && bar % 2 === 0) this.timpani(t, root + (bar === 14 ? 7 : 0), 0.3 + (bar - 10) * 0.05);
  }

  /** Kor og messing i ett: tre toner i akkorden, to ustemte sagtenner per tone gjennom et formantfilter (Morbidiums «kor»). */
  private pad(t: number, root: number, scale: number[], dur: number, vel = 1) {
    const c = this.ctx;
    const base = fold(root, 52);
    // Tersen fra skalaen gir akkorden dur eller moll. En blåtone (utenfor skalaen) får bare kvint og oktav.
    const notes = inScale(base, scale) ? [base, deg(base, 2, scale), base + 7] : [base, base + 7, base + 12];
    const g = c.createGain();
    const a = Math.min(0.12, dur * 0.3);
    const v = 0.05 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, dur - 0.06));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 950;
    bp.Q.value = 1.1;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    bp.connect(lp).connect(g);
    g.connect(this.extra);
    g.connect(this.hall);
    const vib = c.createOscillator();
    vib.frequency.value = 5.2;
    const vg = c.createGain();
    vg.gain.value = 12;
    vib.connect(vg);
    for (const m of notes)
      for (const det of [-7, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        vg.connect(o.detune);
        o.connect(bp);
        o.start(t);
        o.stop(t + dur + 0.3);
      }
    vib.start(t);
    vib.stop(t + dur + 0.3);
  }

  private rnd() {
    // Enkel deterministisk tilfeldighet så soloen kan testes
    this.soloSeed = (this.soloSeed * 16807) % 2147483647;
    return (this.soloSeed - 1) / 2147483646;
  }

  /**
   * Gitarsolo som lages fortløpende. Hver takt får en frase (skalaløp, sveip over akkorden, pedaltone,
   * trille eller lange bend), og hver fjerde takt slutter med et stort bend. Tonene hentes fra skalaen
   * rundt akkorden som spilles under, lagt i leadgitarens register (rundt H4 til A#5 og oppover).
   */
  private soloStep(tr: MetalTrack, s: number, t: number, sd: number) {
    const bar = s % 16;
    if (bar === 0) {
      const n = Math.floor(s / 16);
      this.soloPhrase = this.soloFresh ? 0 : n % 4 === 3 ? 5 : Math.floor(this.rnd() * 5);
      this.soloFresh = false;
    }
    const sc = tr.scale;
    let base = (tr.roots ? tr.roots[s % tr.steps] : 40) + 24;
    while (base < 71) base += 12;
    while (base > 82) base -= 12;
    const tone = (d: number) => (d === 0 ? base : diatonic(base, d, sc));
    // Bend opp til nærmeste skalatone (en eller to halvtoner), ellers ingen bend
    const bendFor = (m: number) => {
      const pc = (x: number) => ((x % 12) + 12) % 12;
      return sc.includes(pc(m + 2)) ? 2 : sc.includes(pc(m + 1)) ? 1 : 0;
    };
    const note = (dt: number, d: number, len: number, bend = false, vel = 0.8) => {
      const m = tone(d);
      this.leadNote(t + dt, m, len, bend ? bendFor(m) : 0, vel);
    };
    switch (this.soloPhrase) {
      case 0: {
        // Skalaløp i sekstendeler: opp en oktav og ned igjen
        const RUN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1];
        note(0, RUN[bar], sd * 1.05, false, 0.8);
        break;
      }
      case 1: {
        // Sveip over akkorden i trettitodeler, to oktaver opp og ned
        const ARP = [0, 2, 4, 7, 9, 11, 14, 11, 9, 7, 4, 2];
        for (let k = 0; k < 2; k++) note(k * sd * 0.5, ARP[(bar * 2 + k) % ARP.length], sd * 0.55, false, 0.72);
        break;
      }
      case 2: {
        // Pedaltone: oktaven som anker og en melodi som går nedover under den
        const PED = [7, 6, 7, 4, 7, 6, 7, 3, 7, 5, 7, 2, 7, 4, 7, 1];
        note(0, PED[bar], sd * 1.02, false, 0.78);
        break;
      }
      case 3: {
        // Trille (hammer-on og pull-off) og et bend med vibrato på slutten
        if (bar < 12) {
          note(0, 4, sd * 0.5, false, 0.78);
          note(sd * 0.5, 5, sd * 0.5, false, 0.68);
        } else if (bar === 12) note(0, 7, sd * 4, true, 0.9);
        break;
      }
      default: {
        // Lange bend med vibrato på akkordtonene
        if (bar === 0) note(0, 7, sd * 6, true, 0.95);
        else if (bar === 6) note(0, 9, sd * 2, false, 0.9);
        else if (bar === 8) note(0, 4, sd * 8, true, 0.9);
      }
    }
  }

  // ---------------------------------------------------------------- overganger (dirigenten)
  /**
   * Ett steg av broen til en ny låt (det siste slaget før byttet), k av n steg. Den gamle låta kveles, tammene tar en
   * virvel nedover med skarptromme til slutt, gitarene holder en kvintakkord på dominanten i den nye tonearten, og
   * bassen går opp mot den nye grunntonen (kvinten, så kromatisk). Tilpasset fra Morbidiums bro, der en harpe løper
   * opp dominanten.
   */
  bridgeStep(k: number, n: number, toRoot: number, t: number, sd: number) {
    const r = guitar(toRoot);
    if (k === 0) {
      this.choke(t, 0.05);
      this.powerChord(t, fold(r + 7, 40), n * sd + 0.01, true, 0.92, false);
    }
    const i = 4 - n + k;
    this.bass(t, r - 12 + [7, 9, 10, 11][i], sd * 0.92, 0.9);
    this.tom(t, 215 - i * 34, 0.9 + i * 0.05);
    if (k === n - 1) {
      this.snare(t, 0.7);
      this.snare(t + sd * 0.5, 1);
    }
  }

  /** Første slag i en ny låt: stortromme, crash og en stor akkord på den nye grunntonen, og en pauke. */
  downbeat(t: number, root: number, sd: number, boss = false) {
    const r = guitar(root);
    this.choke(t, 0.02);
    this.powerChord(t, r, (boss ? 8 : 4) * sd, true, 1);
    this.kick(t, 1.1, this.fxKit);
    this.crash(t, 1, this.fxKit);
    if (boss) this.crash(t + 0.012, 0.8, this.fxKit);
    this.timpani(t, r, boss ? 0.8 : 0.45, this.fxKit);
  }

  /**
   * Bekkensvulm som topper nøyaktig ved T (Morbidiums svulm). VCSL-opptaket (en crescendo på to sekunder) når det er
   * lastet: toppen måles én gang, og lyden startes midt i når det er kort tid igjen. Ellers en baklengs crash i synth
   * med samme timing. Under 0,25 sekunder blir det ingen svulm. Gir tilbake en stopper (hvis byttet avlyses).
   */
  swell(T: number, now: number, vel = 1): (() => void) | null {
    const c = this.ctx;
    const smp = this.swellSample?.() ?? null;
    let src: AudioBufferSourceNode;
    const g = c.createGain();
    if (smp) {
      const peak = peakOf(smp.buf);
      const t0 = Math.max(now + 0.02, T - Math.max(0, peak - smp.lead));
      if (T - t0 < 0.25) return null;
      src = c.createBufferSource();
      src.buffer = smp.buf;
      // Opptaket holder seg nesten flatt etter toppen, så det tones ut fra første slag, der crashen tar over
      const v = 0.55 * vel;
      g.gain.setValueAtTime(v, t0);
      g.gain.setValueAtTime(v, T + 0.02);
      g.gain.linearRampToValueAtTime(0.0001, T + 0.3);
      src.connect(g);
      src.start(t0, Math.max(0, peak - (T - t0)));
      src.stop(T + 0.35);
    } else {
      const len = Math.min(1.8, T - now - 0.02);
      if (len < 0.25) return null;
      const t0 = T - len;
      src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2400;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(2600, t0);
      bp.frequency.exponentialRampToValueAtTime(9000, T);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5 * vel, T);
      g.gain.linearRampToValueAtTime(0.0001, T + 0.03);
      src.connect(hp).connect(bp).connect(g);
      src.start(t0, Math.random() * 0.5);
      src.stop(T + 0.06);
    }
    g.connect(this.fx);
    g.connect(this.hall);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const n = c.currentTime;
      g.gain.cancelScheduledValues(n);
      g.gain.setTargetAtTime(0, n, 0.02);
      try {
        src.stop(n + 0.1);
      } catch {
        /* allerede stoppet */
      }
    };
  }

  /**
   * Avslutningen (sjefen er død), k er steget fra første slag: en stor akkord som holder, en virvel i fjerde slag av
   * neste takt, og en siste akkord med dobbel crash, pauke og et langt bend på toppen som ringer ut.
   */
  endingStep(root: number, k: number, t: number, sd: number) {
    const r = guitar(root);
    if (k === 0) {
      this.choke(t, 0.03);
      this.powerChord(t, r, 12 * sd, true, 1);
      this.crash(t, 1, this.fxKit);
      this.kick(t, 1.1, this.fxKit);
    } else if (k >= 12 && k < 16) {
      this.tom(t, 215 - (k - 12) * 34, 1);
      if (k === 15) this.snare(t, 1);
    } else if (k === 16) {
      this.choke(t, 0.02);
      this.powerChord(t, r, 2.6, true, 1);
      this.crash(t, 1, this.fxKit);
      this.crash(t + 0.012, 0.8, this.fxKit);
      this.kick(t, 1.2, this.fxKit);
      this.timpani(t, r, 0.8, this.fxKit);
      const top = fold(r + 24, 62);
      this.leadNote(t, top - 2, 2.3, 2, 0.85, 0, true);
    }
  }

  /** Tremolo på grunntonen det siste slaget før taktstreken (METAL MODE kommer inn, soloen starter på streken). */
  tremolo(t: number, until: number, root: number, sd: number) {
    const m = fold(root, 64) + 12;
    const d = sd / 2;
    const from = Math.max(t, until - 4 * sd);
    for (let x = from; x < until - d * 0.5; x += d) this.leadNote(x, m, d * 0.9, 0, 0.4 + (0.45 * (x - from)) / Math.max(d, until - from), 0, true);
  }

  /** Bølge ryddet: tvillinglick opp akkorden i åttendeler (grunntone, ters, kvint og oktav) med crash. */
  lick(t: number, root: number, scale: number[], sd: number) {
    const base = snap(fold(root, 62), scale);
    [0, 2, 4, 7].forEach((d, i) => {
      const m = deg(base, d, scale);
      const len = (i === 3 ? 6 : 2) * sd;
      this.leadNote(t + i * 2 * sd, m, len * 0.95, 0, 0.8, 0, true);
      this.leadNote(t + i * 2 * sd + 0.004, deg(m, 2, scale), len * 0.95, 0, 0.55, 0.35, true);
    });
    this.crash(t, 0.6, this.fxKit);
    this.kick(t, 0.9, this.fxKit);
  }

  /** Nytt nivå: skalaløp opp en oktav i sekstendeler, og toppen holdes med tvillingstemme og crash. */
  run(t: number, root: number, scale: number[], sd: number) {
    const base = snap(fold(root, 62), scale);
    for (let i = 0; i < 8; i++) this.leadNote(t + i * sd, deg(base, i, scale), sd * 1.02, 0, 0.7 + i * 0.02, 0, true);
    const top = base + 12;
    this.leadNote(t + 8 * sd, top, 6 * sd, 0, 0.9, 0, true);
    this.leadNote(t + 8 * sd + 0.004, deg(top, 2, scale), 6 * sd, 0, 0.6, 0.35, true);
    this.crash(t + 8 * sd, 0.7, this.fxKit);
    this.kick(t + 8 * sd, 0.9, this.fxKit);
  }

  /** Et slag i tonearten (FIGHT! og KO): stortromme, crash og en åpen akkord på grunntonen i ett slag. */
  hit(t: number, root: number, sd: number) {
    this.powerChord(t, guitar(root), 4 * sd, true, 1);
    this.crash(t, 0.9, this.fxKit);
    this.kick(t, 1.1, this.fxKit);
  }

  // ---------------------------------------------------------------- stingere
  /** Enorm åpen akkord med crash og stortromme (brettstart). root er grunntonen (E som standard). */
  bigChord(t: number, root = 40, len = 1.6) {
    this.powerChord(t, guitar(root), len, true, 1);
    this.crash(t, 1, this.fxKit);
    this.kick(t, 1, this.fxKit);
  }

  /**
   * Vektarm-dykk: en tone som faller to oktaver og lander etter `land` sekunder (sjefen: på første slag i sjefslåta).
   * Tonen holder helt til den lander og toner så ut.
   */
  diveBomb(t: number, land = 1.35) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.01);
    g.gain.setValueAtTime(1, t + land);
    g.gain.exponentialRampToValueAtTime(0.0001, t + land + 0.14);
    g.connect(this.sting());
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const hold = Math.min(0.25, land * 0.2);
    o.frequency.setValueAtTime(mtof(88), t);
    o.frequency.setValueAtTime(mtof(88), t + hold);
    o.frequency.exponentialRampToValueAtTime(mtof(40), t + land);
    const vib = c.createOscillator();
    vib.frequency.value = 9;
    const vg = c.createGain();
    vg.gain.value = 45;
    vib.connect(vg).connect(o.detune);
    o.connect(g);
    o.start(t);
    vib.start(t);
    o.stop(t + land + 0.2);
    vib.stop(t + land + 0.2);
  }

  /** Falsettskrik («AAAAAH!») med formantfiltre for vokalen a, som en sanger fra 1984. pitch er tonen (MIDI). */
  wail(t: number, dur = 1.5, pitch = 76) {
    const c = this.ctx;
    const src = c.createOscillator();
    src.type = 'sawtooth';
    const f0 = mtof(pitch);
    src.frequency.setValueAtTime(f0 * 0.94, t);
    src.frequency.exponentialRampToValueAtTime(f0, t + 0.12);
    src.frequency.setValueAtTime(f0, t + dur * 0.7);
    src.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + dur);
    const vib = c.createOscillator();
    vib.frequency.value = 6;
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(55, t + 0.5);
    vib.connect(vg).connect(src.detune);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.65, t + 0.06);
    g.gain.setValueAtTime(0.65, t + dur - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    for (const [fq, q, amp] of [[850, 8, 1], [1250, 9, 0.6], [2850, 10, 0.35]] as const) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      bp.Q.value = q;
      const a = c.createGain();
      a.gain.value = amp * 2.2;
      src.connect(bp).connect(a).connect(g);
    }
    // Utenom trommebussen (før gikk skriket dit), så intensiteten ikke demper det
    g.connect(this.fx);
    g.connect(this.hall);
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.15);
    vib.stop(t + dur + 0.15);
  }
}
