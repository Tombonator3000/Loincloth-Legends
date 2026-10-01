// Lagspiller for syntlyd: en lyd beskrives som data, en liste med lag av oscillatorer, filtrert støy og arpeggio.
// Tilpasset fra Morbidium (src/01_core.js, Sound.play/_synth/_noise/_arp), som igjen bygger på SoundSystem i
// Geometry 3044. Byggeklossene (orgel, kor, klokker, gong, pauker, torden, applaus og trist trombone) er fra
// Morbidiums src/39_kombo.js, stemt om til E og tonet mot 80-talls metall. Brukes til fanfarer, torden og zap,
// og som syntetisk reserve under opptakene fra lydbanken (core/soundbank.ts).

/** Oscillatorlag. f i Hz, d i sekunder, pd = hvor mye tonen faller (0,5 = en oktav ned), at = forsinkelse. */
export interface OscLayer {
  w: OscillatorType;
  f: number;
  d: number;
  v: number;
  pd?: number;
  /** Anslag i sekunder. */
  atk?: number;
  /** Vibrato: [fart i Hz, dybde i cent]. */
  vib?: [number, number];
  /** Forvrengning (waveshaper). */
  dist?: number;
  /** Lavpass som sveiper [fra, til]. */
  lp?: [number, number];
  /** Hvor mye som sendes til klangen. */
  rv?: number;
  at?: number;
}
/** Støylag: filter som sveiper fra f0 til f1. Lag lengre enn 0,45 s går i sløyfe (støybufferen er kort). */
export interface NoiseLayer {
  n: 1;
  d: number;
  v: number;
  f0: number;
  f1: number;
  ft?: BiquadFilterType;
  atk?: number;
  rv?: number;
  at?: number;
}
/** Arpeggio: tonene i arp etter hverandre med nl sekunder mellom. */
export interface ArpLayer {
  arp: number[];
  nl: number;
  nd?: number;
  w: OscillatorType;
  v: number;
  vib?: [number, number];
  atk?: number;
  rv?: number;
  at?: number;
}
export type Layer = OscLayer | NoiseLayer | ArpLayer;

const curves = new Map<number, Float32Array<ArrayBuffer>>();
function driveCurve(k: number) {
  let c = curves.get(k);
  if (!c) {
    c = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i / 511) * 2 - 1;
      c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    curves.set(k, c);
  }
  return c;
}

/** Spiller lag med ±3 prosent tilfeldig stemming, rett i `out` og en del i klangen `hall` når laget ber om det. */
export class LayerPlayer {
  constructor(private ctx: BaseAudioContext, private noise: AudioBuffer, private hall: AudioNode | null = null) {}

  play(layers: Layer[], out: AudioNode, vol = 1, pitch = 1, t0 = this.ctx.currentTime, onEnded?: () => void) {
    // Tell kildene, ikke lagene: et arpeggio har flere kilder. Den siste frigjør eventuell romklang/panorering.
    let left = layers.reduce((n, l) => n + ('arp' in l ? l.arp.length : 1), 0);
    const ended = () => { if (--left === 0) onEnded?.(); };
    if (!left) { onEnded?.(); return; }
    for (const L of layers) {
      const t = t0 + (L.at ?? 0);
      if ('arp' in L) this.arp(L, out, vol, pitch, t, ended);
      else if ('n' in L) this.noiseLayer(L, out, vol, pitch, t, ended);
      else this.osc(L, out, vol, pitch, t, ended);
    }
  }

  private send(g: GainNode, out: AudioNode, rv?: number) {
    g.connect(out);
    if (rv && this.hall) {
      const r = this.ctx.createGain();
      r.gain.value = rv;
      g.connect(r).connect(this.hall);
      return r;
    }
    return null;
  }

  private osc(s: OscLayer, out: AudioNode, vol: number, pitch: number, now: number, ended: () => void) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    const nodes: AudioNode[] = [o, g];
    o.type = s.w;
    const f = s.f * pitch * (0.97 + Math.random() * 0.06);
    o.frequency.setValueAtTime(f, now);
    if (s.pd) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * (1 - s.pd)), now + s.d);
    if (s.vib) {
      const l = c.createOscillator();
      const lg = c.createGain();
      nodes.push(l, lg);
      l.frequency.value = s.vib[0];
      lg.gain.value = s.vib[1];
      l.connect(lg).connect(o.detune);
      l.start(now);
      l.stop(now + s.d + 0.02);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, s.v * vol), now + (s.atk ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, now + s.d);
    let node: AudioNode = o;
    if (s.dist) {
      const w = c.createWaveShaper();
      nodes.push(w);
      w.curve = driveCurve(s.dist);
      node.connect(w);
      node = w;
    }
    if (s.lp) {
      const lp = c.createBiquadFilter();
      nodes.push(lp);
      lp.type = 'lowpass';
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(s.lp[0], now);
      lp.frequency.exponentialRampToValueAtTime(Math.max(30, s.lp[1]), now + s.d);
      node.connect(lp);
      node = lp;
    }
    node.connect(g);
    const send = this.send(g, out, s.rv);
    if (send) nodes.push(send);
    o.onended = () => { for (const n of nodes) n.disconnect(); ended(); };
    o.start(now);
    o.stop(now + s.d + 0.02);
  }

  private noiseLayer(s: NoiseLayer, out: AudioNode, vol: number, pitch: number, now: number, ended: () => void) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = pitch;
    const f = c.createBiquadFilter();
    f.type = s.ft ?? 'lowpass';
    f.Q.value = s.ft === 'bandpass' ? 1.4 : 0.7;
    f.frequency.setValueAtTime(s.f0, now);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, s.f1), now + s.d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, s.v * vol), now + (s.atk ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, now + s.d);
    src.connect(f).connect(g);
    const send = this.send(g, out, s.rv);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); send?.disconnect(); ended(); };
    // Lange drønn og applaus går i sløyfe, ellers kuttes de når støybufferen tar slutt
    if (s.d > 0.45) src.loop = true;
    src.start(now, Math.random() * Math.min(0.5, this.noise.duration * 0.3));
    // stop() er på lydklokka. duration-argumentet til start() ville blitt kortere ved høyere pitch.
    src.stop(now + s.d + 0.05);
  }

  private arp(s: ArpLayer, out: AudioNode, vol: number, pitch: number, now: number, ended: () => void) {
    s.arp.forEach((f, i) => this.osc({ w: s.w, f, d: s.nd ?? s.nl * 1.8, v: s.v, rv: s.rv, vib: s.vib, atk: s.atk }, out, vol, pitch, now + i * s.nl, ended));
  }
}

// ---------------------------------------------------------------- byggeklosser (39_kombo.js, stemt til E)
/** Toner i E (Hz). */
export const HZ = {
  E1: 41.2, B1: 61.74, E2: 82.41, G2: 98, A2: 110, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196,
  A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88, E5: 659.26,
};

/** Kirkeorgel: grunntone, oktav og kvint over, og litt firkant for sivpipene. */
export const organ = (notes: number[], d: number, v: number, at = 0): Layer[] =>
  notes.flatMap((f) => [
    { w: 'sine', f, d, v, atk: 0.02, rv: 0.55, at },
    { w: 'sine', f: f * 2, d: d * 0.9, v: v * 0.5, atk: 0.02, rv: 0.55, at },
    { w: 'sine', f: f * 3, d: d * 0.8, v: v * 0.22, atk: 0.02, rv: 0.5, at },
    { w: 'square', f, d: d * 0.8, v: v * 0.1, lp: [2200, 700], atk: 0.02, rv: 0.5, at },
  ] as Layer[]);

/** Kor: to litt ustemte sagtenner per tone med vibrato og mykt anslag. */
export const choir = (notes: number[], d: number, v: number, at = 0): Layer[] =>
  notes.flatMap((f) => [
    { w: 'sawtooth', f, d, v, atk: 0.18, vib: [5.2, 14], lp: [1500, 650], rv: 0.75, at },
    { w: 'sawtooth', f: f * 1.005, d, v: v * 0.8, atk: 0.22, vib: [4.6, 18], lp: [1300, 600], rv: 0.75, at },
  ] as Layer[]);

/** Klokke med de skjeve overtonene til en kirkeklokke. */
export const bell = (b: number, v: number, at = 0): Layer[] =>
  ([[0.5, 3.2, 1], [1, 2.6, 1.4], [1.19, 2, 0.8], [1.5, 1.7, 0.6], [2, 1.4, 0.6], [2.74, 1, 0.35]] as const).map(([k, d, a]) => ({ w: 'sine', f: b * k, d, v: v * a * 0.12, rv: 0.6, at }) as Layer);

/** Syntetisk gong (reserven når VCSL-gongen ikke er lastet). */
export const gongSyn = (v: number, at = 0): Layer[] => [
  { w: 'sine', f: 98, d: 3.2, v: v * 0.35, rv: 0.65, vib: [0.8, 22], at },
  { w: 'sine', f: 147.3, d: 2.6, v: v * 0.2, rv: 0.6, at },
  { w: 'sine', f: 211, d: 2.2, v: v * 0.15, rv: 0.6, at },
  { w: 'sine', f: 289, d: 1.6, v: v * 0.1, rv: 0.6, at },
  { n: 1, d: 0.5, f0: 1400, f1: 200, ft: 'lowpass', v: v * 0.3, at },
];

/** Torden: et skarpt knall, så buldring. far (0 til 1) skyver buldringen senere og gjør knallet svakere. */
export const thunderSyn = (v: number, at = 0, far = 0): Layer[] => [
  { n: 1, d: 0.12, f0: 8000, f1: 2000, ft: 'highpass', v: v * 0.6 * (1 - far * 0.7), at },
  { n: 1, d: 2.6, f0: 520 - far * 200, f1: 50, ft: 'lowpass', v: v * 0.9, atk: 0.05 + far * 0.2, at: at + 0.03 + far * 0.5 },
  { w: 'sine', f: 42, d: 2.2, pd: 0.3, v: v * 0.5, atk: 0.1, at: at + far * 0.5 },
  { n: 1, d: 1.2, f0: 1100 - far * 400, f1: 90, ft: 'lowpass', v: v * 0.4, at: at + 0.55 + far * 0.6 },
];

/** Elektrisk zap (fra Geometry 3044, playChainLightningZap): sagtann 2500 til 400 Hz, firkant og høypasset støy. */
export const zapSyn = (v: number, at = 0): Layer[] => [
  { w: 'sawtooth', f: 2500, d: 0.12, pd: 0.84, v: v * 0.35, at },
  { w: 'square', f: 1800, d: 0.1, pd: 0.67, v: v * 0.2, at },
  { n: 1, d: 0.12, f0: 2000, f1: 2000, ft: 'highpass', v: v * 0.25, at },
];

/** Pauker som ruller (reserven når VCSL-paukene ikke er lastet). */
export const timpaniSyn = (n: number, v: number, at = 0, f = 70): Layer[] =>
  Array.from({ length: n }, (_, i) => ({ w: 'sine', f: f + (i % 2) * 3, d: 0.24, pd: 0.15, v: v * (0.5 + (i / n) * 0.5), at: at + i * 0.055 }) as Layer);

/** Applaus: mange korte klapp i båndpasset støy og to plystringer. */
export const applause = (n: number, v: number, len: number, at = 0): Layer[] => {
  const L: Layer[] = [];
  for (let i = 0; i < n; i++) L.push({ n: 1, d: 0.025 + Math.random() * 0.025, f0: 2200 + Math.random() * 1800, f1: 1100, ft: 'bandpass', v: v * (0.6 + Math.random() * 0.6), at: at + Math.random() * len });
  L.push({ w: 'sine', f: 1700, d: 0.45, pd: -0.35, v: v * 0.35, vib: [7, 70], at: at + len * 0.3 }, { w: 'sine', f: 1900, d: 0.5, pd: -0.3, v: v * 0.3, vib: [6.5, 60], at: at + len * 0.6 });
  return L;
};

/** Publikum som brøler (et bredt sus som vokser og dør ut). */
export const roar = (v: number, at = 0, d = 1.8): Layer[] => [
  { n: 1, d, f0: 900, f1: 1300, ft: 'bandpass', v, atk: 0.3, at },
  { n: 1, d: d * 0.8, f0: 500, f1: 700, ft: 'bandpass', v: v * 0.6, atk: 0.35, at: at + 0.05 },
];

/** Syntetisk crash (reserven for VCSL-bekkenet). */
export const crashSyn = (v: number, at = 0): Layer[] => [
  { n: 1, d: 1.6, f0: 9000, f1: 5000, ft: 'highpass', v, at },
  { n: 1, d: 0.5, f0: 6200, f1: 4000, ft: 'bandpass', v: v * 0.6, at },
];

/** Stortromme. */
export const kickSyn = (v: number, at = 0): Layer[] => [{ w: 'sine', f: 120, d: 0.35, pd: 0.66, v, at }];

/** Trist trombone: G, F#, F og en lang E med vibrato. */
export const TROMBONE: Layer[] = [
  { w: 'sawtooth', f: 392, d: 0.3, v: 0.12, lp: [1600, 500] },
  { w: 'sawtooth', f: 370, d: 0.3, v: 0.12, lp: [1600, 500], at: 0.32 },
  { w: 'sawtooth', f: 349.2, d: 0.3, v: 0.12, lp: [1600, 500], at: 0.64 },
  { w: 'sawtooth', f: 329.6, d: 1.2, v: 0.13, lp: [1500, 380], vib: [6, 35], at: 0.96 },
];

// ---------------------------------------------------------------- fanfarene
/** Et slag i en fanfare: VCSL-opptaket når det er lastet, ellers syntlagene i `syn`. */
export interface Hit {
  /** Gruppe i lydbanken (eller en bestemt fil med `file`). */
  g: string;
  file?: string;
  /** MIDI-tone for stemte instrumenter (paukene). */
  midi?: number;
  v: number;
  at?: number;
  pitch?: number;
  syn: Layer[];
}
/** Kraftakkord på fanfaregitaren (MetalBand.powerChord): [tid, grunntone (MIDI), lengde, styrke]. */
export type Stab = [number, number, number, number];

export interface Fanfare {
  /** Syntlag (orgel, kor, klokker, applaus). */
  layers: Layer[];
  hits: Hit[];
  stabs: Stab[];
  /** Publikum: [styrke, forsinkelse]. */
  crowd?: [number, number];
  /** Dukking av musikken: [hvor mye, hvor lenge]. */
  duck: [number, number];
  /** Vektarmdykk på fanfaregitaren (sekunder etter start). */
  dive?: number;
  /** Syntlagene er stemt og flyttes med tonearten (tapslyden). Ellers flyttes bare akkordene og paukene. */
  tonal?: boolean;
}

const gongHit = (v: number, at = 0): Hit => ({ g: 'ins_gong', v, at, syn: gongSyn(v * 0.9, at) });
const crash = (v: number, at = 0): Hit => ({ g: 'ins_bekken', file: 'ins_bekken_2', v, at, syn: crashSyn(v * 0.35, at) });
const timp = (midi: number, v: number, at = 0): Hit => ({ g: 'ins_pauke', midi, v, at, syn: timpaniSyn(1, v * 0.7, at, 440 * Math.pow(2, (midi - 69) / 12)) });
const roll = (v: number, at = 0): Hit => ({ g: 'ins_paukevirvel', v, at, syn: timpaniSyn(10, v * 0.45, at) });

/**
 * Fanfarer for drapsrekkene (3 CARNAGE, 6 MASSACRE, 10 EXCESSIVE, 15 PLEASE SEEK HELP, 22 THE BARD WILL SING OF THIS,
 * 30 WAR CRIMES), trappet opp som Morbidiums flerdrap (dobbel, trippel, firling, massakre): kraftakkorder på gitaren,
 * pauker, orgelstøt, kor, gong, torden og publikum. Alt i E.
 */
export const STREAK_FANFARES: Fanfare[] = [
  // 1: ett kraftakkordstøt med stortromme og bekken
  { layers: [...kickSyn(0.6)], hits: [crash(0.3), timp(40, 0.4)], stabs: [[0, 40, 0.55, 0.7]], crowd: [0.6, 0.1], duck: [0.25, 0.3] },
  // 2: da-DAA (G5 til A5) og to pauker
  { layers: [...kickSyn(0.7), ...kickSyn(0.7, 0.2)], hits: [crash(0.4, 0.2), timp(43, 0.5), timp(45, 0.55, 0.2)], stabs: [[0, 43, 0.18, 0.85], [0.2, 45, 0.7, 1]], crowd: [0.7, 0.15], duck: [0.3, 0.45] },
  // 3: orgelstøt i E-moll over akkorden og en paukevirvel
  { layers: [...organ([HZ.E3, HZ.G3, HZ.B3], 0.9, 0.07), ...kickSyn(0.8)], hits: [crash(0.45), roll(0.45)], stabs: [[0, 40, 0.9, 1]], crowd: [0.8, 0.2], duck: [0.35, 0.6] },
  // 4: C, D, E opp mot kor og gong
  { layers: [...choir([HZ.E4, HZ.G4, HZ.B4], 1.2, 0.045, 0.3), ...kickSyn(0.8, 0.3)], hits: [gongHit(0.45, 0.3), timp(36, 0.4), timp(38, 0.45, 0.15), timp(40, 0.55, 0.3)], stabs: [[0, 36, 0.14, 0.8], [0.15, 38, 0.14, 0.85], [0.3, 40, 1.1, 1]], crowd: [1, 0.3], duck: [0.45, 0.8] },
  // 5: orgel, kor, gong og torden
  { layers: [...organ([HZ.E2, HZ.B2, HZ.E3, HZ.G3], 1.8, 0.065), ...choir([HZ.E4, HZ.G4, HZ.B4, HZ.E5], 1.8, 0.04, 0.05), ...thunderSyn(0.4, 0.3), ...applause(24, 0.12, 1.4, 0.6)], hits: [gongHit(0.55), roll(0.5), crash(0.45)], stabs: [[0, 40, 1.4, 1]], crowd: [1.1, 0.35], duck: [0.5, 1.0] },
  // 6: alt på en gang
  { layers: [...organ([HZ.E2, HZ.B2, HZ.E3, HZ.G3], 2.2, 0.07, 0.3), ...choir([HZ.E4, HZ.G4, HZ.B4, HZ.E5], 2.4, 0.045, 0.35), ...thunderSyn(0.6, 0.5), ...bell(HZ.E4, 1, 0.9), ...applause(34, 0.14, 1.8, 0.8)], hits: [gongHit(0.6, 0.3), roll(0.5), crash(0.5, 0.3), timp(40, 0.6, 0.3)], stabs: [[0, 36, 0.14, 0.85], [0.15, 38, 0.14, 0.9], [0.3, 40, 1.8, 1]], crowd: [1.2, 0.4], duck: [0.55, 1.2] },
];

/** BOSS SLAIN: Morbidiums sjefdrap i metall, med gong, orgel, kor, torden og to klokker. */
export const BOSS_FANFARE: Fanfare = {
  layers: [...organ([HZ.E2, HZ.B2, HZ.E3, HZ.G3], 3, 0.07, 0.2), ...choir([HZ.E4, HZ.G4, HZ.B4, HZ.E5], 3.2, 0.05, 0.25), ...thunderSyn(0.8, 0.5), ...bell(HZ.E4, 1, 0.9), ...bell(HZ.B3, 0.9, 1.6), ...applause(34, 0.16, 1.8, 1.5)],
  hits: [gongHit(0.7), roll(0.55, 0.1), crash(0.5, 0.2)],
  stabs: [[0.2, 38, 0.18, 0.9], [0.4, 40, 2.2, 1]],
  crowd: [1.2, 0.3],
  duck: [0.6, 1.2],
};

/** Knockout i duellen (halshugging og slakt): gitar, gong og publikum. */
export const KO_FANFARE: Fanfare = {
  layers: [...kickSyn(0.8), ...applause(20, 0.12, 1.2, 0.4)],
  hits: [gongHit(0.45), crash(0.4)],
  stabs: [[0, 40, 1.2, 1]],
  crowd: [1.2, 0.1],
  duck: [0.45, 0.8],
};

/**
 * Tapslyden (game over): fallende kraftakkorder (E, D, C og en lang H som stuper), orgel på H, pauke og gong. Etter
 * Morbidiums «dod»-stikk (06_musikk.js 386: en fallende orgellinje over pedal, klokke og gong), i metall. Flyttes til
 * tonearten til låta som spilte (AudioEngine.defeat).
 */
export const DEFEAT_FANFARE: Fanfare = {
  layers: [...organ([HZ.B1, HZ.B2], 2.6, 0.05, 0.96)],
  hits: [crash(0.35), timp(35, 0.5, 0.96), gongHit(0.45, 1.4)],
  stabs: [[0, 40, 0.28, 0.9], [0.32, 38, 0.28, 0.85], [0.64, 36, 0.28, 0.8], [0.96, 35, 2.4, 0.9]],
  dive: 1.0,
  tonal: true,
  duck: [0, 0],
};
