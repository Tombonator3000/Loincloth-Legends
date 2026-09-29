// All lyd er syntetisert med WebAudio. Ingen lydfiler.
import { rand } from './math';

type Voice = 'hero' | 'heroine' | 'skeleton' | 'pig' | 'cultist' | 'gnome' | 'brute' | 'imp' | 'zombie' | 'frog' | 'troll' | 'wizard' | 'boar' | 'rooster' | 'newt';

type Track = {
  bpm: number;
  steps: number;
  bass: (number | null)[];
  lead: [number, number, number][]; // [steg, midi, lengde i steg]
  kick: number[];
  snare: number[];
  hat: number[];
  tom?: number[];
  leadWave?: OscillatorType;
  bassWave?: OscillatorType;
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function rep<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(...arr);
  return out;
}

const TRACKS: Record<string, Track> = {
  title: {
    bpm: 96,
    steps: 64,
    bass: [...rep<number | null>([38, null, null, null, 38, null, 50, null], 2), ...rep<number | null>([34, null, null, null, 34, null, 46, null], 2), ...rep<number | null>([36, null, null, null, 36, null, 48, null], 2), ...rep<number | null>([33, null, null, null, 33, null, 45, null], 2)],
    lead: [
      [0, 62, 6], [6, 65, 2], [8, 69, 8],
      [16, 70, 6], [22, 69, 2], [24, 65, 8],
      [32, 67, 6], [38, 69, 2], [40, 72, 6], [46, 70, 2],
      [48, 69, 12], [60, 64, 4],
    ],
    kick: [0, 16, 32, 48, 40, 56],
    snare: [8, 24, 40, 56].map((x) => x + 0).filter((x) => x % 16 === 8),
    hat: [],
    tom: [60, 62, 63],
    leadWave: 'sawtooth',
    bassWave: 'sawtooth',
  },
  stage: {
    bpm: 140,
    steps: 64,
    bass: [
      ...[45, 45, 57, 45, 45, 57, 45, 55].flatMap((n) => [n, null]),
      ...[41, 41, 53, 41, 41, 53, 41, 52].flatMap((n) => [n, null]),
      ...[43, 43, 55, 43, 43, 55, 43, 53].flatMap((n) => [n, null]),
      ...[40, 40, 52, 40, 43, 44, 45, 47].flatMap((n) => [n, null]),
    ],
    lead: [
      [0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 74, 2], [8, 76, 4], [12, 69, 4],
      [16, 77, 4], [20, 76, 2], [22, 74, 2], [24, 72, 4], [28, 69, 4],
      [32, 79, 2], [34, 77, 2], [36, 76, 2], [38, 74, 2], [40, 76, 4], [44, 79, 4],
      [48, 81, 6], [54, 79, 2], [56, 76, 4], [60, 74, 2], [62, 72, 2],
    ],
    kick: [0, 8, 10, 16, 24, 26, 32, 40, 42, 48, 56, 58],
    snare: [4, 12, 20, 28, 36, 44, 52, 60],
    hat: Array.from({ length: 32 }, (_, i) => i * 2 + 1),
    leadWave: 'square',
    bassWave: 'sawtooth',
  },
  duel: {
    bpm: 152,
    steps: 64,
    bass: rep<number | null>([40, 40, 40, 52, 40, 40, 41, 40, 40, 40, 40, 52, 43, 41, 40, 38], 4),
    lead: [
      [0, 64, 3], [3, 65, 3], [6, 64, 2], [12, 71, 4],
      [16, 64, 3], [19, 65, 3], [22, 67, 2], [28, 70, 4],
      [32, 76, 3], [35, 77, 3], [38, 76, 2], [44, 71, 4],
      [48, 72, 4], [52, 71, 4], [56, 70, 4], [60, 65, 4],
    ],
    kick: [0, 3, 6, 8, 16, 19, 22, 24, 32, 35, 38, 40, 48, 51, 54, 56],
    snare: [4, 12, 20, 28, 36, 44, 52, 60],
    hat: Array.from({ length: 64 }, (_, i) => i).filter((i) => i % 2 === 0),
    tom: [14, 15, 30, 31, 46, 47, 61, 62, 63],
    leadWave: 'square',
    bassWave: 'sawtooth',
  },
  victory: {
    bpm: 120,
    steps: 32,
    bass: [45, null, 45, null, 45, null, 45, null, 41, null, 41, null, 43, null, 43, null, 45, null, 45, null, 45, null, 45, null, 48, null, 47, null, 45, null, null, null],
    lead: [[0, 69, 2], [2, 72, 2], [4, 76, 4], [8, 77, 2], [10, 76, 2], [12, 74, 4], [16, 76, 2], [18, 79, 2], [20, 81, 8], [28, 81, 4]],
    kick: [0, 8, 16, 24],
    snare: [4, 12, 20, 28],
    hat: [2, 6, 10, 14, 18, 22, 26, 30],
    leadWave: 'square',
    bassWave: 'triangle',
  },
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  private noise!: AudioBuffer;
  muted = false;
  private last: Record<string, number> = {};
  private track: Track | null = null;
  private trackName = '';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private volMusic = 0.7;
  private volSfx = 0.9;

  /** Lydnivå fra innstillingene (0 til 1). */
  setVolumes(music: number, sfx: number) {
    this.volMusic = music;
    this.volSfx = sfx;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(0.314 * music, this.ctx.currentTime, 0.05);
    this.sfx.gain.setTargetAtTime(0.78 * sfx, this.ctx.currentTime, 0.05);
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = 0.78 * this.volSfx;
    this.sfx.connect(this.master);
    this.music = c.createGain();
    this.music.gain.value = 0.314 * this.volMusic;
    this.music.connect(this.master);
    const len = c.sampleRate * 1.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.trackName) this.play(this.trackName, true);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  private ok(name: string, gap = 0.03) {
    if (!this.ctx || this.ctx.state !== 'running') {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.ctx) return false;
    }
    const t = this.ctx.currentTime;
    if (t - (this.last[name] ?? -1) < gap) return false;
    this.last[name] = t;
    return true;
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private noiseSrc(t: number, dur: number) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.start(t, rand(0, 0.5), dur + 0.05);
    return s;
  }

  swish(pitch = 1, heavy = false) {
    if (!this.ok('swish', 0.04)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const dur = heavy ? 0.26 : 0.16;
    const src = this.noiseSrc(t, dur);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(900 * pitch, t);
    f.frequency.exponentialRampToValueAtTime(4200 * pitch, t + dur * 0.4);
    f.frequency.exponentialRampToValueAtTime(700 * pitch, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.02, heavy ? 0.5 : 0.35, dur);
    src.connect(f).connect(g).connect(this.sfx);
  }

  hit(heavy = false) {
    if (!this.ok('hit', 0.035)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(heavy ? 150 : 200, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = c.createGain();
    this.env(g, t, 0.005, heavy ? 0.9 : 0.6, heavy ? 0.22 : 0.14);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.3);
    const n = this.noiseSrc(t, 0.08);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = heavy ? 1800 : 2600;
    const g2 = c.createGain();
    this.env(g2, t, 0.002, 0.6, 0.08);
    n.connect(f).connect(g2).connect(this.sfx);
  }

  splat(size = 1) {
    if (!this.ok('splat', 0.05)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const dur = 0.18 + size * 0.15;
    const n = this.noiseSrc(t, dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(250, t + dur);
    f.Q.value = 6;
    const g = c.createGain();
    this.env(g, t, 0.004, 0.7 * Math.min(1.4, size), dur);
    n.connect(f).connect(g).connect(this.sfx);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    const g2 = c.createGain();
    this.env(g2, t, 0.004, 0.45, 0.2);
    o.connect(g2).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.3);
  }

  squish() {
    if (!this.ok('squish', 0.06)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      o.type = 'triangle';
      const tt = t + i * 0.05;
      o.frequency.setValueAtTime(rand(180, 300), tt);
      o.frequency.exponentialRampToValueAtTime(rand(40, 80), tt + 0.08);
      const g = c.createGain();
      this.env(g, tt, 0.003, 0.3, 0.08);
      o.connect(g).connect(this.sfx);
      o.start(tt);
      o.stop(tt + 0.12);
    }
  }

  clang() {
    if (!this.ok('clang', 0.05)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    for (const [fr, a] of [[1180, 0.25], [1770, 0.18], [2630, 0.12], [3900, 0.08]] as const) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = fr * rand(0.97, 1.03);
      const g = c.createGain();
      this.env(g, t, 0.002, a, 0.35);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + 0.4);
    }
    const n = this.noiseSrc(t, 0.05);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3000;
    const g = c.createGain();
    this.env(g, t, 0.001, 0.4, 0.05);
    n.connect(f).connect(g).connect(this.sfx);
  }

  scream(voice: Voice = 'hero') {
    if (!this.ok('scream', 0.12)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const base = { hero: 180, heroine: 380, skeleton: 520, pig: 260, cultist: 300, gnome: 700, brute: 110, imp: 600, zombie: 140, frog: 420, troll: 90, wizard: 240, boar: 200, rooster: 900, newt: 330 }[voice] * rand(0.9, 1.15);
    const dur = voice === 'brute' ? 0.9 : rand(0.45, 0.75);
    const o = c.createOscillator();
    o.type = voice === 'skeleton' ? 'square' : 'sawtooth';
    o.frequency.setValueAtTime(base * 1.4, t);
    o.frequency.linearRampToValueAtTime(base * 1.6, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(base * 0.55, t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = voice === 'pig' || voice === 'frog' ? 28 : voice === 'zombie' ? 4 : 9;
    const lg = c.createGain();
    lg.gain.value = base * (voice === 'pig' ? 0.25 : 0.08);
    lfo.connect(lg).connect(o.frequency);
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = voice === 'pig' ? 900 : 1100;
    f1.Q.value = 3;
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 2400;
    f2.Q.value = 4;
    const g = c.createGain();
    this.env(g, t, 0.02, 0.28, dur);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(this.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
  }

  grunt(voice: Voice = 'hero') {
    if (!this.ok('grunt', 0.1)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const base = { hero: 120, heroine: 260, skeleton: 400, pig: 170, cultist: 200, gnome: 500, brute: 80, imp: 420, zombie: 100, frog: 300, troll: 70, wizard: 180, boar: 130, rooster: 700, newt: 240 }[voice];
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 1.2, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.15);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = c.createGain();
    this.env(g, t, 0.01, 0.25, 0.16);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.25);
  }

  bones() {
    if (!this.ok('bones', 0.05)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    for (let i = 0; i < 7; i++) {
      const tt = t + i * rand(0.02, 0.05);
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = rand(700, 1600);
      const g = c.createGain();
      this.env(g, tt, 0.001, 0.12, 0.03);
      o.connect(g).connect(this.sfx);
      o.start(tt);
      o.stop(tt + 0.06);
    }
  }

  coin() {
    if (!this.ok('coin', 0.05)) return;
    this.notes([[83, 0, 0.06], [88, 0.06, 0.18]], 'square', 0.12);
  }
  pickup() {
    if (!this.ok('pickup', 0.08)) return;
    this.notes([[60, 0, 0.07], [64, 0.07, 0.07], [67, 0.14, 0.07], [72, 0.21, 0.2]], 'square', 0.15);
  }
  potion() {
    if (!this.ok('potion', 0.08)) return;
    this.notes([[79, 0, 0.05], [84, 0.05, 0.05], [91, 0.1, 0.2]], 'triangle', 0.2);
  }
  menu() {
    if (!this.ok('menu', 0.03)) return;
    this.notes([[76, 0, 0.05]], 'square', 0.1);
  }
  confirm() {
    if (!this.ok('confirm', 0.05)) return;
    this.notes([[64, 0, 0.06], [71, 0.06, 0.06], [76, 0.12, 0.15]], 'square', 0.14);
  }

  private notes(ns: [number, number, number][], type: OscillatorType, vol: number) {
    const c = this.ctx!;
    const t = c.currentTime;
    for (const [m, st, d] of ns) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m);
      const g = c.createGain();
      this.env(g, t + st, 0.005, vol, d);
      o.connect(g).connect(this.sfx);
      o.start(t + st);
      o.stop(t + st + d + 0.05);
    }
  }

  boom(size = 1) {
    if (!this.ok('boom', 0.06)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const n = this.noiseSrc(t, 1.2);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 1.0);
    const g = c.createGain();
    this.env(g, t, 0.01, 0.9 * size, 1.0);
    n.connect(f).connect(g).connect(this.sfx);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    const g2 = c.createGain();
    this.env(g2, t, 0.01, 0.9, 0.6);
    o.connect(g2).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.8);
  }

  magic() {
    if (!this.ok('magic', 0.3)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110 * (i + 1), t);
      o.frequency.exponentialRampToValueAtTime(880 * (i + 1), t + 1.2);
      const g = c.createGain();
      this.env(g, t, 0.2, 0.08, 1.2);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + 1.5);
    }
  }

  jump() {
    if (!this.ok('jump', 0.08)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const n = this.noiseSrc(t, 0.1);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 600;
    const g = c.createGain();
    this.env(g, t, 0.005, 0.15, 0.1);
    n.connect(f).connect(g).connect(this.sfx);
  }

  thud() {
    if (!this.ok('thud', 0.06)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = c.createGain();
    this.env(g, t, 0.003, 0.6, 0.2);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.25);
  }

  crowd(intensity = 1) {
    if (!this.ok('crowd', 0.5)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const dur = 1.6;
    const n = this.noiseSrc(t, dur);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * intensity, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.sfx);
  }

  gong() {
    if (!this.ok('gong', 0.5)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    for (const [fr, a] of [[98, 0.5], [147, 0.3], [233, 0.2], [311, 0.15], [415, 0.1]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      const g = c.createGain();
      this.env(g, t, 0.01, a, 2.5);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + 2.6);
    }
  }


  // ---------- Teit vold ----------
  /** Våt klask mot skjermglasset. FAMILY: en snill "boink". */
  glassSplat(family = false) {
    if (!this.ok('glass', 0.1)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    if (family) {
      o.frequency.setValueAtTime(260, t);
      o.frequency.exponentialRampToValueAtTime(720, t + 0.08);
      o.frequency.exponentialRampToValueAtTime(240, t + 0.3);
    } else {
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    }
    const g = c.createGain();
    this.env(g, t, 0.003, 0.95, 0.3);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.4);
    if (!family) {
      const n = this.noiseSrc(t, 0.35);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1800, t);
      f.frequency.exponentialRampToValueAtTime(260, t + 0.35);
      f.Q.value = 5;
      const g2 = c.createGain();
      this.env(g2, t, 0.002, 0.8, 0.35);
      n.connect(f).connect(g2).connect(this.sfx);
    }
    for (const fr of [2630, 3950]) {
      const o2 = c.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = fr * rand(0.98, 1.02);
      const g3 = c.createGain();
      this.env(g3, t + 0.01, 0.001, 0.12, 0.14);
      o2.connect(g3).connect(this.sfx);
      o2.start(t);
      o2.stop(t + 0.25);
    }
  }

  /**
   * Hud mot glass: ujevne, hvinende skli-lyder (stick-slip). Returnerer en stopp-funksjon.
   */
  squeak(dur = 4): () => void {
    if (!this.ctx || !this.ok('squeak', 0.3)) return () => {};
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1350, t);
    const steps = Math.ceil(dur * 7);
    for (let i = 1; i <= steps; i++) o.frequency.linearRampToValueAtTime(rand(950, 1750) * (1 - (i / steps) * 0.35), t + i / 7);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 2.5;
    // Stick-slip: rask amplitudemodulasjon
    const am = c.createGain();
    am.gain.value = 0.55;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(21, t);
    for (let i = 1; i <= steps; i++) lfo.frequency.linearRampToValueAtTime(rand(14, 32), t + i / 7);
    const lg = c.createGain();
    lg.gain.value = 0.45;
    lfo.connect(lg).connect(am.gain);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // Små og store hvin med pauser imellom
    let tt = t;
    while (tt < t + dur) {
      const on = rand(0.18, 0.6);
      const off = rand(0.04, 0.22);
      const peak = rand(0.08, 0.2);
      g.gain.setTargetAtTime(peak, tt, 0.02);
      g.gain.setTargetAtTime(0.0001, tt + on, 0.03);
      tt += on + off;
    }
    o.connect(bp).connect(am).connect(g).connect(this.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.3);
    lfo.stop(t + dur + 0.3);
    let stopped = false;
    return () => {
      if (stopped || !this.ctx) return;
      stopped = true;
      const now = this.ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.04);
      try {
        o.stop(now + 0.3);
        lfo.stop(now + 0.3);
      } catch {
        /* allerede stoppet */
      }
    };
  }

  /** Tegneserie-fjær (armen som spretter avgårde). */
  boing() {
    if (!this.ok('boing', 0.12)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(230, t + 0.38);
    const lfo = c.createOscillator();
    lfo.frequency.value = 28;
    const lg = c.createGain();
    lg.gain.value = 45;
    lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    this.env(g, t, 0.005, 0.45, 0.4);
    o.connect(g).connect(this.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.45);
    lfo.stop(t + 0.45);
  }

  sizzle(dur = 1) {
    if (!this.ok('sizzle', 0.2)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const n = this.noiseSrc(t, dur);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2600;
    const g = c.createGain();
    this.env(g, t, 0.02, 0.35, dur);
    const am = c.createGain();
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 37;
    const lg = c.createGain();
    lg.gain.value = 0.5;
    am.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    n.connect(f).connect(am).connect(g).connect(this.sfx);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }

  splash() {
    if (!this.ok('splash', 0.15)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const n = this.noiseSrc(t, 0.7);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.6);
    f.Q.value = 1.2;
    const g = c.createGain();
    this.env(g, t, 0.005, 0.7, 0.65);
    n.connect(f).connect(g).connect(this.sfx);
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.25 + i * rand(0.08, 0.16);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(rand(300, 600), tt);
      o.frequency.exponentialRampToValueAtTime(rand(800, 1400), tt + 0.06);
      const g2 = c.createGain();
      this.env(g2, tt, 0.002, 0.12, 0.06);
      o.connect(g2).connect(this.sfx);
      o.start(tt);
      o.stop(tt + 0.1);
    }
  }

  impale() {
    if (!this.ok('impale', 0.1)) return;
    this.thud();
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    const g = c.createGain();
    this.env(g, t, 0.002, 0.4, 0.14);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.2);
    setTimeout(() => this.squish(), 60);
  }

  fireBreath(dur = 0.7) {
    if (!this.ok('breath', 0.15)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const n = this.noiseSrc(t, dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(1600, t + dur * 0.3);
    f.frequency.linearRampToValueAtTime(500, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.05, 0.7, dur);
    n.connect(f).connect(g).connect(this.sfx);
  }

  bite() {
    if (!this.ok('bite', 0.08)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const n = this.noiseSrc(t + i * 0.07, 0.04);
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1800;
      const g = c.createGain();
      this.env(g, t + i * 0.07, 0.001, 0.4, 0.04);
      n.connect(f).connect(g).connect(this.sfx);
    }
  }

  cluck() {
    if (!this.ok('cluck', 0.2)) return;
    this.notes([[79, 0, 0.05], [76, 0.08, 0.05], [83, 0.18, 0.12]], 'square', 0.1);
  }

  levelUp() {
    if (!this.ok('levelup', 0.5)) return;
    this.notes([[60, 0, 0.08], [64, 0.08, 0.08], [67, 0.16, 0.08], [72, 0.24, 0.08], [76, 0.32, 0.08], [79, 0.4, 0.08], [84, 0.48, 0.4]], 'square', 0.14);
  }

  buy() {
    if (!this.ok('buy', 0.1)) return;
    this.notes([[84, 0, 0.05], [88, 0.05, 0.05], [91, 0.1, 0.05], [96, 0.15, 0.2]], 'square', 0.12);
  }

  denied() {
    if (!this.ok('denied', 0.2)) return;
    this.notes([[52, 0, 0.12], [47, 0.13, 0.25]], 'square', 0.14);
  }


  // ---------- Studio-logo ----------
  /** Trommevirvel, cymbal og en liten sirkusfanfare (Tom's Happy Happy Funtimes Emporium). */
  fanfare() {
    if (!this.ctx) return;
    const c = this.ctx;
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + 0.05;
    // Trommevirvel
    for (let i = 0; i < 20; i++) {
      const tt = t0 + i * 0.034;
      const n = this.noiseSrc(tt, 0.05);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1900;
      f.Q.value = 1.2;
      const g = c.createGain();
      this.env(g, tt, 0.002, 0.08 + i * 0.012, 0.05);
      n.connect(f).connect(g).connect(this.sfx);
    }
    const hit = t0 + 0.7;
    // Stortromme og cymbal
    const kick = c.createOscillator();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(120, hit);
    kick.frequency.exponentialRampToValueAtTime(40, hit + 0.3);
    const kg = c.createGain();
    this.env(kg, hit, 0.003, 1.0, 0.4);
    kick.connect(kg).connect(this.sfx);
    kick.start(hit);
    kick.stop(hit + 0.5);
    const cy = this.noiseSrc(hit, 1.6);
    const cf = c.createBiquadFilter();
    cf.type = 'highpass';
    cf.frequency.value = 5200;
    const cg = c.createGain();
    this.env(cg, hit, 0.004, 0.42, 1.6);
    cy.connect(cf).connect(cg).connect(this.sfx);
    // Messing-akkord (C-dur) med filter som åpner seg
    const brass = (midi: number, st: number, dur: number, vol: number) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(midi);
      o.detune.value = rand(-8, 8);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(700, st);
      f.frequency.exponentialRampToValueAtTime(2800, st + 0.12);
      f.frequency.exponentialRampToValueAtTime(1300, st + dur);
      f.Q.value = 2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(vol, st + 0.03);
      g.gain.setValueAtTime(vol * 0.85, st + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      o.connect(f).connect(g).connect(this.sfx);
      o.start(st);
      o.stop(st + dur + 0.05);
    };
    for (const m of [48, 60, 64, 67]) brass(m, hit, 0.55, 0.09);
    // Ta-da-da-DAAA (kalliope)
    const notes: [number, number, number][] = [[72, 0.62, 0.14], [76, 0.8, 0.14], [79, 0.98, 0.14], [84, 1.16, 0.9]];
    for (const [m, st, d] of notes) {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = mtof(m);
      const vib = c.createOscillator();
      vib.frequency.value = 6;
      const vg = c.createGain();
      vg.gain.value = mtof(m) * 0.012;
      vib.connect(vg).connect(o.frequency);
      const g = c.createGain();
      this.env(g, hit + st - 0.62, 0.01, 0.11, d);
      o.connect(g).connect(this.sfx);
      o.start(hit + st - 0.62);
      vib.start(hit + st - 0.62);
      o.stop(hit + st - 0.62 + d + 0.05);
      vib.stop(hit + st - 0.62 + d + 0.05);
    }
    for (const m of [60, 64, 67, 72]) brass(m, hit + 0.54, 1.1, 0.07);
  }

  /** Små glitrende pling. */
  sparkle() {
    if (!this.ok('sparkle', 0.06)) return;
    this.notes([[96 + Math.floor(rand(0, 5)), 0, 0.08]], 'sine', 0.06);
  }

  // ---------- Musikk ----------
  play(name: string, force = false) {
    if (this.trackName === name && !force && this.timer !== null) return;
    this.trackName = name;
    this.track = TRACKS[name] ?? null;
    if (!this.ctx) return;
    this.stopTimer();
    if (!this.track) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    this.trackName = '';
    this.track = null;
    this.stopTimer();
  }

  private stopTimer() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const c = this.ctx;
    const tr = this.track;
    if (!c || !tr) return;
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(tr, this.step % tr.steps, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playStep(tr: Track, s: number, t: number, sd: number) {
    const c = this.ctx!;
    const b = tr.bass[s % tr.bass.length];
    if (b != null) {
      const o = c.createOscillator();
      o.type = tr.bassWave ?? 'sawtooth';
      o.frequency.value = mtof(b);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1400, t);
      f.frequency.exponentialRampToValueAtTime(260, t + sd * 1.8);
      f.Q.value = 5;
      const g = c.createGain();
      this.env(g, t, 0.005, 0.45, sd * 1.8);
      o.connect(f).connect(g).connect(this.music);
      o.start(t);
      o.stop(t + sd * 2.2);
    }
    for (const [st, m, len] of tr.lead) {
      if (st !== s) continue;
      const dur = len * sd;
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = tr.leadWave ?? 'square';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        const vib = c.createOscillator();
        vib.frequency.value = 5.5;
        const vg = c.createGain();
        vg.gain.value = 4;
        vib.connect(vg).connect(o.detune);
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2600;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
        g.gain.setValueAtTime(0.1, t + Math.max(0.03, dur - 0.05));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
        o.connect(f).connect(g).connect(this.music);
        o.start(t);
        vib.start(t);
        o.stop(t + dur + 0.1);
        vib.stop(t + dur + 0.1);
      }
    }
    if (tr.kick.includes(s)) {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = c.createGain();
      this.env(g, t, 0.002, 1.0, 0.18);
      o.connect(g).connect(this.music);
      o.start(t);
      o.stop(t + 0.2);
    }
    if (tr.snare.includes(s)) {
      const n = this.noiseSrc(t, 0.16);
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1200;
      const g = c.createGain();
      this.env(g, t, 0.002, 0.6, 0.14);
      n.connect(f).connect(g).connect(this.music);
    }
    if (tr.hat.includes(s)) {
      const n = this.noiseSrc(t, 0.04);
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = c.createGain();
      this.env(g, t, 0.001, 0.25, 0.035);
      n.connect(f).connect(g).connect(this.music);
    }
    if (tr.tom?.includes(s)) {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(s % 2 ? 140 : 110, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
      const g = c.createGain();
      this.env(g, t, 0.002, 0.7, 0.22);
      o.connect(g).connect(this.music);
      o.start(t);
      o.stop(t + 0.3);
    }
  }
}

export const audio = new AudioEngine();
export type { Voice };
