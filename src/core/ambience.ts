// Stemning per biom: sløyfer som glir inn og ut under musikken. Tilpasset fra Morbidium (src/42_lyd.js, Stemning,
// og den syntetiske dronen og vinden i src/01_core.js), med brun støy etter The Deep Ones (v2/audio.js).
// - Hvert biom har noen lag: et opptak fra lydbanken (core/soundbank.ts) når det er lastet, ellers en syntetisk
//   reserve laget av støy og oscillatorer. Når opptaket blir klart, glir reserven ut og opptaket inn.
// - Et nytt biom glir over i det neste (lag som finnes i begge, blir liggende).
// - Bålknitring blir sterkere og flytter seg til siden når kameraet går forbi et bål (Env.fires, satt fra Stage).
//   Fossesus gjør det samme ved fossene (Env.waters).
// - Av og til en kråke over gresset, en ugle ved nattleiren, en frosk i myra, eller ulv, vindkast og is som knaker i
//   frostpasset (spilltid, så pause virker).
import type { SoundBank, Voice } from './soundbank';
import type { Layer, LayerPlayer } from './layers';

/** Syntetiske reserver. */
export type AmbSynth = 'wind' | 'crickets' | 'fire' | 'drips' | 'drone' | 'rumble' | 'murmur' | 'water';

/** Lyder som kommer fra et sted på brettet og blir sterkere nær det: bål og fosser. */
const NEAR = {
  fire: { file: 'amb_baal', syn: 'fire' as AmbSynth, v: 0.75 },
  water: { file: 'amb_foss', syn: 'water' as AmbSynth, v: 0.7 },
};
type NearKind = keyof typeof NEAR;

export interface AmbLayer {
  /** Gruppe i lydbanken (sløyfe). */
  file?: string;
  /** Nivå for opptaket. */
  v: number;
  /** Reserven når opptaket mangler, og nivået for den (ellers v). */
  syn?: AmbSynth;
  sv?: number;
  lp?: number;
}

/** Lagene per biom (LevelDef.biome) og for arenaene. */
export const AMBIENCE: Record<string, AmbLayer[]> = {
  grass: [{ file: 'amb_vind', v: 0.5, syn: 'wind', sv: 0.25, lp: 3000 }],
  swamp: [{ file: 'amb_drypp', v: 0.5, syn: 'drips', sv: 0.18 }, { file: 'amb_drone', v: 0.3, syn: 'drone', sv: 0.1, lp: 1800 }, { file: 'amb_natt', v: 0.1, lp: 5000 }],
  frost: [{ file: 'amb_vind', v: 0.9, syn: 'wind', sv: 0.45 }],
  scorch: [{ file: 'amb_baal', v: 0.45, syn: 'fire', sv: 0.45 }, { syn: 'rumble', v: 0.35 }],
  night: [{ file: 'amb_natt', v: 0.5, syn: 'crickets', sv: 0.45 }, { file: 'amb_vind', v: 0.08, lp: 1200 }],
  tower: [{ file: 'amb_drone', v: 0.6, syn: 'drone', sv: 0.13 }],
  arena: [{ syn: 'murmur', v: 0.22 }],
};

/** Enkeltlyder av og til: opptak fra banken, ellers syntlagene. every er sekunder spilltid mellom dem. */
interface AmbEvent {
  g: string;
  v: number;
  lp?: number;
  every: [number, number];
  syn?: Layer[];
}
const CROW: Layer[] = [
  { w: 'sawtooth', f: 620, d: 0.22, pd: 0.35, v: 0.05 },
  { n: 1, d: 0.2, f0: 1400, f1: 900, ft: 'bandpass', v: 0.06 },
  { w: 'sawtooth', f: 600, d: 0.2, pd: 0.35, v: 0.04, at: 0.3 },
];
const OWL: Layer[] = [
  { w: 'sine', f: 392, d: 0.35, pd: -0.08, v: 0.07 },
  { w: 'sine', f: 370, d: 0.55, pd: -0.1, v: 0.06, at: 0.5 },
];
const FROG: Layer[] = [
  { w: 'sawtooth', f: 150, d: 0.16, pd: 0.25, v: 0.05, lp: [900, 300], vib: [28, 300] },
  { w: 'sawtooth', f: 140, d: 0.2, pd: 0.3, v: 0.05, lp: [900, 280], vib: [26, 300], at: 0.22 },
];
export const AMB_EVENTS: Record<string, AmbEvent[]> = {
  grass: [{ g: 'kraake', v: 0.22, lp: 3500, every: [9, 20], syn: CROW }],
  night: [{ g: 'ugle', v: 0.3, lp: 3500, every: [12, 26], syn: OWL }],
  swamp: [{ g: 'frosk', v: 0, every: [7, 16], syn: FROG }],
  frost: [
    { g: 'ulv', v: 0.16, lp: 2400, every: [20, 42] },
    { g: 'vindkast', v: 0.32, every: [8, 18] },
    { g: 'isknak', v: 0.12, lp: 4500, every: [14, 30] },
  ],
};

interface AmbVoice {
  g: GainNode;
  pan: StereoPannerNode | null;
  stop(fade: number): void;
}

const SR = 22050;

export class Ambience {
  /** Bussen for all stemning (under musikken). */
  readonly bus: GainNode;
  private voices = new Map<string, AmbVoice>();
  private biome: string | null = null;
  private buffers: Partial<Record<'white' | 'brown' | 'crickets' | 'fire' | 'drips', AudioBuffer>> = {};
  /** Nærhet (0 til 1), panorering og sist satte verdier for bål og fosser. */
  private near: Record<NearKind, { k: number; pan: number; set: [number, number] }> = {
    fire: { k: 0, pan: 0, set: [-1, 0] },
    water: { k: 0, pan: 0, set: [-1, 0] },
  };
  private nearT = 0;
  private eventT: number[] = [];

  constructor(private ctx: AudioContext, dest: AudioNode, private bank: SoundBank, private player: LayerPlayer) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.5;
    this.bus.connect(dest);
  }

  get current() {
    return this.biome;
  }

  /** Lagene som spiller nå (til testene): 'f:amb_vind' er opptak, 's:wind' er reserven. */
  get active() {
    return [...this.voices.keys()];
  }

  /** Bytt stemning (null = ingen). Glir over i løpet av et par sekunder. */
  set(biome: string | null) {
    if (biome === this.biome) return;
    this.biome = biome;
    this.near.fire.k = this.near.water.k = 0;
    this.eventT = (AMB_EVENTS[biome ?? ''] ?? []).map((e) => rnd(e.every[0] * 0.5, e.every[1]));
    this.apply();
  }

  /** Legg lagene på nytt (en fil ble klar, eller RECORDED SOUNDS ble slått av eller på). */
  refresh() {
    this.apply();
  }

  /**
   * Hvert bilde fra Stage: hvor nær nærmeste bål og foss er (0 til 1) og hvor de er (panorering), og enkeltlydene.
   * Nærheten oppdateres fire ganger i sekundet, som i Morbidium.
   */
  tick(dt: number, fire = 0, pan = 0, water = 0, wpan = 0) {
    if (!this.biome) return;
    this.near.fire.k = fire;
    this.near.fire.pan = pan;
    this.near.water.k = water;
    this.near.water.pan = wpan;
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 0.25;
      this.applyNear('fire');
      this.applyNear('water');
    }
    const ev = AMB_EVENTS[this.biome] ?? [];
    ev.forEach((e, i) => {
      this.eventT[i] = (this.eventT[i] ?? e.every[0]) - dt;
      if (this.eventT[i] > 0) return;
      this.eventT[i] = rnd(e.every[0], e.every[1]);
      const p = rnd(-0.7, 0.7);
      if (this.bank.has(e.g)) this.bank.play(e.g, { vol: e.v * rnd(0.7, 1), pitch: rnd(0.92, 1.06), lp: e.lp, pan: p, out: this.bus });
      else if (e.syn) this.player.play(e.syn, this.panned(p), rnd(0.7, 1), rnd(0.94, 1.06));
    });
  }

  private panned(p: number): AudioNode {
    if (!this.ctx.createStereoPanner) return this.bus;
    const s = this.ctx.createStereoPanner();
    s.pan.value = p;
    s.connect(this.bus);
    return s;
  }

  // ---------------------------------------------------------------- lagene
  private want() {
    const W = new Map<string, { v: number; lp?: number; make: () => AmbVoice | null }>();
    for (const L of AMBIENCE[this.biome ?? ''] ?? []) {
      if (L.file && this.bank.has(L.file)) {
        const file = L.file;
        W.set('f:' + file, { v: L.v, lp: L.lp, make: () => this.fileVoice(file, L.lp) });
      } else if (L.syn) {
        const syn = L.syn;
        W.set('s:' + syn, { v: L.sv ?? L.v, make: () => this.synthVoice(syn) });
      }
    }
    return W;
  }

  private apply() {
    const now = this.ctx.currentTime;
    const W = this.want();
    for (const [k, w] of W) {
      let v = this.voices.get(k);
      if (!v) {
        const made = w.make();
        if (!made) continue;
        v = made;
        this.voices.set(k, v);
      } else {
        // Et lag som allerede spiller (også et som var på vei ut) glir fra der det er
        v.g.gain.cancelScheduledValues(now);
        v.g.gain.setValueAtTime(Math.max(0.0001, v.g.gain.value), now);
      }
      v.g.gain.setTargetAtTime(w.v, now, 1.1);
    }
    for (const [k, v] of this.voices) {
      if (W.has(k) || k.startsWith('near:')) continue;
      v.stop(3);
      this.voices.delete(k);
    }
    this.applyNear('fire');
    this.applyNear('water');
  }

  /** Bål eller foss etter avstand: opptaket når det er klart, ellers den syntetiske reserven. */
  private applyNear(kind: NearKind) {
    const now = this.ctx.currentTime;
    const N = NEAR[kind], st = this.near[kind];
    const on = this.biome !== null && st.k > 0.01;
    // Samme navn som lagene: near:f:<fil> er opptaket, near:s:<reserve> er synthen
    const fileKey = 'near:f:' + N.file, synKey = 'near:s:' + N.syn;
    const key = this.bank.has(N.file) ? fileKey : synKey;
    for (const [k, v] of this.voices) {
      if ((k !== fileKey && k !== synKey) || (on && k === key)) continue;
      v.stop(1.5);
      this.voices.delete(k);
    }
    if (!on) return;
    let v = this.voices.get(key);
    if (!v) {
      const made = key === fileKey ? this.fileVoice(N.file, undefined, true) : this.synthVoice(N.syn, true);
      if (!made) return;
      v = made;
      this.voices.set(key, v);
      st.set = [-1, 0];
    }
    // Bare når noe har endret seg, så automasjonen ikke hoper seg opp
    if (Math.abs(st.k - st.set[0]) < 0.02 && Math.abs(st.pan - st.set[1]) < 0.03) return;
    st.set = [st.k, st.pan];
    v.g.gain.setTargetAtTime(N.v * st.k, now, 0.6);
    v.pan?.pan.setTargetAtTime(st.pan, now, 0.5);
  }

  private fileVoice(group: string, lp?: number, panned = false): AmbVoice | null {
    const h: Voice | null = this.bank.play(group, { loop: true, randomStart: true, vol: 0.0001, out: this.bus, lp, pan: panned ? 0 : undefined });
    if (!h) return null;
    return { g: h.g, pan: h.pan, stop: (fade) => h.stop(fade) };
  }

  // ---------------------------------------------------------------- syntetiske reserver
  private synthVoice(kind: AmbSynth, panned = false): AmbVoice {
    const c = this.ctx;
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.value = 0.0001;
    let pan: StereoPannerNode | null = null;
    if (panned && c.createStereoPanner) {
      pan = c.createStereoPanner();
      g.connect(pan).connect(this.bus);
    } else g.connect(this.bus);
    const stops: (AudioScheduledSourceNode)[] = [];
    const loop = (buf: AudioBuffer, rate = 1) => {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start(t, Math.random() * buf.duration);
      stops.push(s);
      return s;
    };
    const lfo = (hz: number, depth: number, target: AudioParam) => {
      const o = c.createOscillator();
      o.frequency.value = hz;
      const d = c.createGain();
      d.gain.value = depth;
      o.connect(d).connect(target);
      o.start(t);
      stops.push(o);
    };
    const filter = (type: BiquadFilterType, f: number, q: number) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };
    if (kind === 'wind') {
      // Morbidiums vær: lavpass rundt 420 Hz som svinger sakte, og et svakt hvin over
      const lp = filter('lowpass', 420, 1.6);
      lfo(0.09, 180, lp.frequency);
      const amp = c.createGain();
      amp.gain.value = 0.8;
      lfo(0.13, 0.25, amp.gain);
      loop(this.buffer('white')).connect(lp).connect(amp).connect(g);
      const bp = filter('bandpass', 900, 6);
      lfo(0.05, 260, bp.frequency);
      const hi = c.createGain();
      hi.gain.value = 0.12;
      loop(this.buffer('white')).connect(bp).connect(hi).connect(g);
    } else if (kind === 'rumble' || kind === 'murmur') {
      const f = kind === 'rumble' ? filter('lowpass', 140, 0.9) : filter('bandpass', 620, 0.9);
      const amp = c.createGain();
      amp.gain.value = kind === 'rumble' ? 1.6 : 0.9;
      lfo(kind === 'rumble' ? 0.11 : 0.33, kind === 'rumble' ? 0.4 : 0.35, amp.gain);
      loop(this.buffer(kind === 'rumble' ? 'brown' : 'white')).connect(f).connect(amp).connect(g);
      if (kind === 'murmur') {
        const f2 = filter('bandpass', 1350, 1.4);
        const a2 = c.createGain();
        a2.gain.value = 0.4;
        lfo(0.21, 0.2, a2.gain);
        loop(this.buffer('white'), 0.97).connect(f2).connect(a2).connect(g);
      }
    } else if (kind === 'water') {
      // Fossesus: hvit støy mellom 250 og 1600 Hz som svulmer litt
      const hp = filter('highpass', 250, 0.7);
      const lp = filter('lowpass', 1600, 0.7);
      const amp = c.createGain();
      amp.gain.value = 0.9;
      lfo(0.17, 0.15, amp.gain);
      loop(this.buffer('white')).connect(hp).connect(lp).connect(amp).connect(g);
    } else if (kind === 'drone') {
      // Tre ustemte sagtenner på E1 og H1 gjennom et lavpass som puster (Morbidiums drone, stemt til E)
      const lp = filter('lowpass', 220, 1.2);
      lfo(0.07, 90, lp.frequency);
      const amp = c.createGain();
      amp.gain.value = 0.22;
      lp.connect(amp).connect(g);
      for (const [f, det] of [[41.2, -7], [41.2, 6], [61.74, 3]] as const) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        stops.push(o);
      }
    } else {
      // Ferdige sløyfer laget her: sirisser, bålknitring og drypp i en hule
      const lvl = c.createGain();
      lvl.gain.value = kind === 'fire' ? 0.9 : 0.8;
      loop(this.buffer(kind)).connect(lvl).connect(g);
    }
    let stopped = false;
    return {
      g, pan,
      stop: (fade) => {
        if (stopped) return;
        stopped = true;
        const n = c.currentTime;
        g.gain.cancelScheduledValues(n);
        g.gain.setTargetAtTime(0.0001, n, fade / 3);
        for (const s of stops) {
          try {
            s.stop(n + fade + 0.1);
          } catch {
            /* allerede stoppet */
          }
        }
      },
    };
  }

  /** Sløyfebuffere lages første gang de trengs (22 kHz, mono). */
  private buffer(kind: 'white' | 'brown' | 'crickets' | 'fire' | 'drips'): AudioBuffer {
    const have = this.buffers[kind];
    if (have) return have;
    const secs = { white: 4, brown: 6, crickets: 4, fire: 5, drips: 6 }[kind];
    const n = Math.floor(SR * secs);
    const b = this.ctx.createBuffer(1, n, SR);
    const d = b.getChannelData(0);
    if (kind === 'white') for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    else if (kind === 'brown' || kind === 'fire') {
      // Brun støy (en tilfeldig gange som lekker), som i The Deep Ones
      let v = 0;
      for (let i = 0; i < n; i++) {
        v = (v + Math.random() * 0.035 - 0.0175) * 0.98;
        d[i] = v * (kind === 'fire' ? 1.2 : 3);
      }
      if (kind === 'fire') {
        // Knitring: korte smell av støy med rask uttoning, noen store og mange små
        for (let k = 0; k < secs * 28; k++) {
          const at = Math.floor(Math.random() * n);
          const len = Math.floor(SR * rnd(0.002, 0.012));
          const a = Math.random() < 0.15 ? rnd(0.5, 0.9) : rnd(0.08, 0.3);
          for (let j = 0; j < len; j++) d[(at + j) % n] += (Math.random() * 2 - 1) * a * Math.exp((-6 * j) / len);
        }
      }
    } else if (kind === 'crickets') {
      // Tre sirisser: tog av tre eller fire pulser rundt 4,5 kHz, hver med sin takt
      for (let cr = 0; cr < 3; cr++) {
        const fc = rnd(4200, 5200);
        const per = rnd(0.42, 0.7);
        const amp = rnd(0.12, 0.25);
        const pulses = Math.random() < 0.5 ? 3 : 4;
        for (let t0 = rnd(0, per); t0 < secs; t0 += per * rnd(0.95, 1.05)) {
          for (let p = 0; p < pulses; p++) {
            const at = Math.floor((t0 + p * 0.04) * SR);
            const len = Math.floor(0.014 * SR);
            for (let j = 0; j < len; j++) {
              const env = Math.sin((Math.PI * j) / len);
              d[(at + j) % n] += Math.sin((2 * Math.PI * fc * j) / SR) * env * amp;
            }
          }
        }
      }
    } else {
      // Drypp i en hule: en tone som går raskt opp og dør ut, og to svake ekko etter
      for (let t0 = 0; t0 < secs; t0 += rnd(0.25, 0.8)) {
        const f = rnd(700, 1500);
        const a = rnd(0.15, 0.4);
        for (const [dt, k] of [[0, 1], [0.09, 0.3], [0.19, 0.14]] as const) {
          const at = Math.floor((t0 + dt) * SR);
          const len = Math.floor(0.09 * SR);
          let ph = 0;
          for (let j = 0; j < len; j++) {
            const fr = f * (1 + 0.6 * Math.min(1, j / (0.03 * SR)));
            ph += (2 * Math.PI * fr) / SR;
            d[(at + j) % n] += Math.sin(ph) * a * k * Math.exp((-5 * j) / len);
          }
        }
      }
    }
    this.buffers[kind] = b;
    return b;
  }
}

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}
