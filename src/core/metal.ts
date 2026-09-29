// Heavy metal fra 1980-tallet, syntetisert med WebAudio (ingen lydfiler, se AGENTS.md).
// Dobbeltinnspilte rytmegitarer panorert ut til hver side, kraftakkorder gjennom forvrengning og et
// høyttalerkabinett, palm mute og galopp, bassgitar, trommer med dobbel stortromme og gated reverb på
// skarptromma (den store trommelyden fra 80-tallet), og leadgitar med vibrato, bend og ekko. Tvillinggitarer
// i terser. I METAL MODE spiller leadgitaren en solo som lages fortløpende ut fra akkordene under.
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
function impulse(ctx: BaseAudioContext, dur: number, gated: boolean) {
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
 * Hele bandet. out er musikkbussen. Lager forsterkere, kabinett, romklang og ekko én gang, og lager nye
 * oscillatorer per tone (WebAudio-oscillatorer kan bare startes én gang).
 */
export class MetalBand {
  /** METAL MODE: soloen erstatter melodien, og trommeslageren gir alt. */
  shred = false;
  private noise: AudioBuffer;
  private rhythm: Amp[] = [];
  private lead: Amp;
  private bassIn: GainNode;
  private drums: GainNode;
  private hall: GainNode;
  private gate: GainNode;
  private echo: DelayNode;
  private soloPhrase = 0;
  private soloSeed = 1;

  constructor(private ctx: BaseAudioContext, dest: AudioNode) {
    const c = ctx;
    // Alt går gjennom et høypass så subbass og rumling ikke spiser opp plassen til lydeffektene
    const out = c.createBiquadFilter();
    out.type = 'highpass';
    out.frequency.value = 38;
    out.connect(dest);
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

    // To rytmegitarer, én på hver side (dobbeltinnspilling)
    for (const pan of [-0.8, 0.8]) {
      const amp = this.makeAmp(18, 110, 5200, 0.42);
      const p = c.createStereoPanner();
      p.pan.value = pan;
      amp.out.connect(p).connect(out);
      this.rhythm.push({ input: amp.input });
    }
    // Leadgitar i midten, mer gain, ekko og hall
    const lead = this.makeAmp(34, 320, 4600, 0.26);
    lead.out.connect(out);
    this.echo = c.createDelay(1.5);
    this.echo.delayTime.value = 0.3;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const echoTone = c.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2400;
    const echoOut = c.createGain();
    echoOut.gain.value = 0.35;
    lead.out.connect(this.echo);
    this.echo.connect(echoTone).connect(fb).connect(this.echo);
    echoTone.connect(echoOut).connect(out);
    lead.out.connect(this.hall);
    this.lead = { input: lead.input };

    // Bassgitar: litt knurr, ikke mye
    this.bassIn = c.createGain();
    const bassDrive = c.createWaveShaper();
    bassDrive.curve = driveCurve(2.5);
    const bassLp = c.createBiquadFilter();
    bassLp.type = 'lowpass';
    bassLp.frequency.value = 1100;
    const bassOut = c.createGain();
    bassOut.gain.value = 0.3;
    this.bassIn.connect(bassDrive).connect(bassLp).connect(bassOut).connect(out);

    this.drums = c.createGain();
    this.drums.gain.value = 0.72;
    this.drums.connect(out);
  }

  /** Forvrenger og kabinett: inn, høypass, forvrengning, to lavpass (4x12-kabinett), litt nærvær, ut. */
  private makeAmp(drive: number, hp: number, lp: number, level: number) {
    const c = this.ctx;
    const input = c.createGain();
    const pre = c.createBiquadFilter();
    pre.type = 'highpass';
    pre.frequency.value = hp;
    const shaper = c.createWaveShaper();
    shaper.curve = driveCurve(drive);
    shaper.oversample = '4x';
    const cab1 = c.createBiquadFilter();
    cab1.type = 'lowpass';
    cab1.frequency.value = lp;
    cab1.Q.value = 0.9;
    const cab2 = c.createBiquadFilter();
    cab2.type = 'lowpass';
    cab2.frequency.value = lp * 1.3;
    const mid = c.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 450;
    mid.Q.value = 1.1;
    mid.gain.value = -4;
    const pres = c.createBiquadFilter();
    pres.type = 'peaking';
    pres.frequency.value = 1900;
    pres.Q.value = 1.2;
    pres.gain.value = 4;
    const out = c.createGain();
    out.gain.value = level;
    input.connect(pre).connect(shaper).connect(cab1).connect(cab2).connect(mid).connect(pres).connect(out);
    return { input, out };
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

  // ---------------------------------------------------------------- gitarer
  /** Kraftakkord (grunntone, kvint og oktav) på begge gitarene. Palm mute er mørk og kort. */
  powerChord(t: number, root: number, dur: number, open: boolean, vel = 1) {
    const c = this.ctx;
    this.rhythm.forEach((amp, side) => {
      const t0 = t + side * 0.007;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = open ? 3800 : 620;
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
      f.connect(g).connect(amp.input);
      const notes = open ? [0, 7, 12] : [0, 7];
      const cents = side ? [-4, 5, 3] : [2, -2, -3];
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
      this.noiseAt(t0, 0.02, amp.input, 'highpass', 1800, 0.35 * vel, 0.012);
    });
    // Bassen følger grunntonen en oktav ned
    this.bass(t, root - 12, open ? dur : Math.min(dur, 0.24), vel);
  }

  private bass(t: number, m: number, dur: number, vel: number) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t + Math.max(0.02, dur - 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(380, t + dur + 0.05);
    f.connect(g).connect(this.bassIn);
    for (const type of ['sawtooth', 'sine'] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.08);
    }
  }

  /** Én leadtone med forsinket vibrato og eventuelt bend. */
  leadNote(t: number, m: number, dur: number, bend = 0, vel = 1, pan = 0) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    g.gain.setValueAtTime(vel, t + Math.max(0.012, dur - 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.07);
    let dest: AudioNode = this.lead.input;
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
  kick(t: number, vel = 1) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(56, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.85, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.17);
    // Klikket fra køllen, viktig for at dobbel stortromme skal høres i gitarveggen
    this.noiseAt(t, 0.02, this.drums, 'bandpass', 3800, 0.55 * vel, 0.014, 1.2);
  }

  snare(t: number, vel = 1) {
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
    this.noiseAt(t, 0.05, this.drums, 'highpass', 7500, 0.22 * vel, 0.04);
  }

  crash(t: number, vel = 1) {
    const g = this.noiseAt(t, 1.7, this.drums, 'highpass', 3800, 0.4 * vel, 1.6);
    g.connect(this.hall);
    this.noiseAt(t, 0.6, this.drums, 'bandpass', 6200, 0.25 * vel, 0.5, 3);
  }

  tom(t: number, pitch: number) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.55, t + 0.25);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.drums);
    g.connect(this.gate);
    o.start(t);
    o.stop(t + 0.34);
  }

  // ---------------------------------------------------------------- avspilling
  /** Spill ett sekstendelssteg av en låt. s er steget i runden, sd er lengden på et steg i sekunder. */
  playStep(tr: MetalTrack, s: number, t: number, sd: number) {
    this.echo.delayTime.setValueAtTime(sd * 3, t);
    for (const n of tr.riff) if (n[0] === s) this.powerChord(t, n[1], n[2] * sd, n[3], n[3] ? 0.9 : 0.8);
    if (this.shred) this.solo(tr, s, t, sd);
    else
      for (const n of tr.lead) {
        if (n[0] !== s) continue;
        const dur = n[2] * sd;
        this.leadNote(t, n[1], dur, n[3], 0.9);
        const h = n[4] === -1 ? (tr.twin ? diatonic(n[1], tr.twin, tr.scale) : 0) : n[4];
        if (h) this.leadNote(t + 0.004, h, dur, n[3], 0.7, 0.35);
      }
    // I METAL MODE går stortromma i sekstendeler og det er crash på hver takt
    if (this.shred) {
      this.kick(t, s % 4 === 0 ? 1 : 0.75);
      if (s % 16 === 0) this.crash(t, 0.8);
    } else if (tr.kick.includes(s)) this.kick(t, s % 4 === 0 ? 1 : 0.8);
    if (tr.snare.includes(s)) this.snare(t);
    if (tr.hat.includes(s)) this.hat(t, s % 4 === 0 ? 1 : 0.7);
    if (tr.crash.includes(s)) this.crash(t);
    if (tr.tom.includes(s)) this.tom(t, 180 - (s % 4) * 30);
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
  private solo(tr: MetalTrack, s: number, t: number, sd: number) {
    const bar = s % 16;
    if (bar === 0) {
      const n = Math.floor(s / 16);
      this.soloPhrase = n % 4 === 3 ? 5 : Math.floor(this.rnd() * 5);
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

  // ---------------------------------------------------------------- stingere
  /** Enorm åpen E-akkord med crash og stortromme (brettstart). */
  bigChord(t: number) {
    this.powerChord(t, 40, 1.6, true, 1);
    this.crash(t);
    this.kick(t);
  }

  /** Vektarm-dykk: en tone som faller to oktaver. */
  diveBomb(t: number) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.01);
    g.gain.setValueAtTime(1, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    g.connect(this.lead.input);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(88), t);
    o.frequency.setValueAtTime(mtof(88), t + 0.25);
    o.frequency.exponentialRampToValueAtTime(mtof(40), t + 1.35);
    const vib = c.createOscillator();
    vib.frequency.value = 9;
    const vg = c.createGain();
    vg.gain.value = 45;
    vib.connect(vg).connect(o.detune);
    o.connect(g);
    o.start(t);
    vib.start(t);
    o.stop(t + 1.45);
    vib.stop(t + 1.45);
  }

  /** Falsettskrik («AAAAAH!») med formantfiltre for vokalen a, som en sanger fra 1984. */
  wail(t: number, dur = 1.5) {
    const c = this.ctx;
    const src = c.createOscillator();
    src.type = 'sawtooth';
    const f0 = mtof(76);
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
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.06);
    g.gain.setValueAtTime(0.9, t + dur - 0.1);
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
    g.connect(this.drums);
    g.connect(this.hall);
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.15);
    vib.stop(t + dur + 0.15);
  }
}
