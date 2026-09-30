// Lydmotoren. Effektene er syntetisert med WebAudio, og innspilte CC0-lyder fra lydbanken (core/soundbank.ts) legges
// oppå når de er lastet: synthen blir da liggende under på 20 til 40 prosent, og den spiller alene til en fil er klar,
// når en fil feiler, når RECORDED SOUNDS er av og i enkeltfil-bygget. Kilder per fil: public/assets/sound/KILDER.md.
// Musikken er heavy metal (core/metal.ts) eller de gamle 8-bit-låtene (TRACKS under), valgt i innstillingene, og
// dirigenten (core/conductor.ts) spiller den: låtbytter på taktstreken med en bro, intensitetslag, METAL MODE i takt,
// innslag på slaget og i tonearten, en avslutning når sjefen dør og en tapslyd ved game over.
// Musikken dukker unna under store smell og mens spillet står på pause, og hvert brett har sin egen stemning
// (core/ambience.ts). Fanfarene for drapsrekker, sjefer og knockout spilles av lagspilleren (core/layers.ts).
import { rand, clamp } from './math';
import { MetalBand, METAL_TRACKS, impulse, fold, diatonic, type MetalTrack } from './metal';
import { Conductor, BandPerformer, rootAt, type Performer, type Song, type CueKind, type Quant, type Level } from './conductor';
import { SoundBank } from './soundbank';
import { Ambience } from './ambience';
import { settings } from './settings';
import { LayerPlayer, TROMBONE, STREAK_FANFARES, BOSS_FANFARE, KO_FANFARE, DEFEAT_FANFARE, thunderSyn, zapSyn, roar, type Fanfare, type Layer } from './layers';

export type MusicStyle = 'metal' | 'chip';
/** Låter som bare finnes som metal. 8-bit bruker da en av de gamle. */
const CHIP_FALLBACK: Record<string, string> = { swamp: 'stage', frost: 'stage', scorch: 'stage', night: 'title' };

type Voice = 'hero' | 'heroine' | 'skeleton' | 'pig' | 'cultist' | 'gnome' | 'brute' | 'imp' | 'zombie' | 'frog' | 'troll' | 'wizard' | 'boar' | 'rooster' | 'newt';

type Track = {
  bpm: number;
  steps: number;
  /** Tonehøydeklassene i skalaen (dirigenten: broen og innslagene i tonearten). */
  scale: number[];
  /** Grunntonen i hvert steg (regnes ut fra bassen under). */
  roots?: number[];
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

/** Et opptak oppå en syntlyd: [gruppe i lydbanken, nivå, tonehøyde, gørr (hoppes over på FAMILY)]. */
type Rec = [group: string, vol: number, pitch?: number, gory?: boolean];

/**
 * Navnet en innlest replikk har i lydbanken: v_ og teksten med små bokstaver, der alt som ikke er bokstav eller tall
 * blir én understrek (høyst 60 tegn). "THEY ARE BLUE. THAT IS THE ONLY DIFFERENCE." blir
 * v_they_are_blue_that_is_the_only_difference. Stemmemanuset (docs/STEMMER.md) bruker samme regel.
 */
export function voiceId(text: string) {
  return 'v_' + text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60).replace(/_+$/, '');
}
export type Surface = 'gress' | 'stein' | 'vann' | 'sno';
/** Musikknivået mens spillet står på pause. */
const DIM = 0.4;

function rep<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(...arr);
  return out;
}

const TRACKS: Record<string, Track> = {
  title: {
    bpm: 96,
    steps: 64,
    scale: [0, 2, 4, 5, 7, 9, 10],
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
    scale: [0, 2, 4, 5, 7, 9, 11],
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
    scale: [0, 2, 4, 5, 7, 9, 11],
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
    scale: [0, 2, 4, 5, 7, 9, 11],
    bass: [45, null, 45, null, 45, null, 45, null, 41, null, 41, null, 43, null, 43, null, 45, null, 45, null, 45, null, 45, null, 48, null, 47, null, 45, null, null, null],
    lead: [[0, 69, 2], [2, 72, 2], [4, 76, 4], [8, 77, 2], [10, 76, 2], [12, 74, 4], [16, 76, 2], [18, 79, 2], [20, 81, 8], [28, 81, 4]],
    kick: [0, 8, 16, 24],
    snare: [4, 12, 20, 28],
    hat: [2, 6, 10, 14, 18, 22, 26, 30],
    leadWave: 'square',
    bassWave: 'triangle',
  },
};
// Grunntonen per steg er siste bassnote (dirigenten legger innslagene og broen i tonearten, og title står i D-moll,
// stage og victory i A-moll og duel i E, ikke i E-moll som metal-låtene)
for (const tr of Object.values(TRACKS)) {
  let cur = tr.bass.find((b) => b != null) ?? 40;
  tr.roots = Array.from({ length: tr.steps }, (_, i) => (cur = tr.bass[i % tr.bass.length] ?? cur));
}

/** En låt i en av stilene. Metal-låtene har riff, 8-bit-låtene bass og lead. */
type AnyTrack = MetalTrack | Track;
const isMetal = (tr: AnyTrack): tr is MetalTrack => 'riff' in tr;
/** Hvor langt fra E tonearten ligger (halvtoner, fra -5 til 6), så fanfarene i E kan flyttes dit. */
const keyShift = (key: number) => {
  const d = (((key - 40) % 12) + 12) % 12;
  return d > 6 ? d - 12 : d;
};
/** Tapslyden i 8-bit: trist trombone i firkant, i tonearten. */
const chipDefeat = (shift: number): Layer[] =>
  [67, 66, 65, 64].map((m, i) => ({ w: 'square', f: mtof(m + shift), d: i < 3 ? 0.3 : 1.2, v: 0.07, vib: i < 3 ? undefined : [6, 35], at: i * 0.32 }) as Layer);

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  private noise!: AudioBuffer;
  muted = false;
  private last: Record<string, number> = {};
  private band: MetalBand | null = null;
  private bandPerf: BandPerformer | null = null;
  private style: MusicStyle = 'metal';
  /** Låta spillet vil ha (også før lyden er startet, og den som venter på taktstreken). */
  private trackName = '';
  private timer: number | null = null;
  /** Intensiteten for 8-bit-låtene (rolig: ingen melodi). */
  private chipLevel: Level = 1;
  private volMusic = 0.7;
  private volSfx = 0.9;
  /** Innspilte lyder (CC0) oppå synthen. Startes i init(), og aldri i enkeltfil-bygget. */
  readonly bank = new SoundBank();
  /** Stemningen per brett (laget i init()). */
  amb: Ambience | null = null;
  private wantAmb: string | null = null;
  /** Lagspilleren for fanfarer, torden og zap (core/layers.ts). */
  private layers: LayerPlayer | null = null;
  /** Dukking under store smell, og dempingen mens spillet står på pause. */
  private duckG!: GainNode;
  private dimG!: GainNode;
  private duckEnd = 0;
  private duckAmt = 0;
  private dimmed = false;
  /** Dempede busser for synthen under opptakene (nivå -> buss). */
  private synBuses = new Map<number, GainNode>();
  /** Klang og en egen gitar for fanfarene (på effektbussen, så de ikke dukker med musikken). */
  private fanOut: GainNode | null = null;
  private fanBandInst: MetalBand | null = null;
  private lastThunder = -1;
  /** Kort uttoning av musikken ved game over (tilbake til 1 når en ny låt starter). */
  private fadeG!: GainNode;
  /** Underlaget fottrinnene går på (fot_<underlag> i lydbanken): gress, stein, vann eller sno. Settes per brett og arena. */
  surface: Surface = 'gress';

  /**
   * Dirigenten spiller gjennom denne: metalbandet (BandPerformer) i metal-stilen og 8-bit-synthen ellers. Gongen og
   * KO-fanfaren går på effektbussen, på samme slag.
   */
  private perf: Performer<AnyTrack> = {
    step: (tr, s, t, sd) => (isMetal(tr) ? this.bandPerf!.step(tr, s, t, sd) : this.playStep(tr, s % tr.steps, t, sd)),
    bridge: (from, to, k, n, t, sd) => (isMetal(to) ? this.bandPerf!.bridge(from as MetalTrack, to, k, n, t, sd) : this.chipBridge(to, k, n, t, sd)),
    downbeat: (to, t, sd, boss) => {
      if (isMetal(to)) this.bandPerf!.downbeat(to, t, sd, boss);
      else this.chipDownbeat(to, t);
      if (boss) this.gongAt(t, 0.9);
    },
    swell: (T, now) => this.band!.swell(T, now),
    dive: (t, land) => (this.style === 'metal' ? this.band!.diveBomb(t, land) : this.chipDive(t, land)),
    level: (n, t, sd, fast) => {
      this.chipLevel = n;
      if (this.style === 'metal') this.bandPerf!.level(n, t, sd, fast);
    },
    shred: (phase, tr, s, t, sd) => {
      if (isMetal(tr)) this.bandPerf!.shred(phase, tr, s, t, sd);
    },
    cue: (kind, tr, s, t, sd) => {
      if (kind === 'fight') this.gongAt(t, 0.9);
      // KO-fanfaren har selv akkorden, crashen og stortromma, så bandet slår ikke i tillegg
      else if (kind === 'ko') return this.playFanfare(KO_FANFARE, t, keyShift(rootAt(tr)));
      if (isMetal(tr)) this.bandPerf!.cue(kind, tr, s, t, sd);
      else this.chipCue(kind, tr, s, t, sd);
    },
    ending: (tr, k, t, sd) => (isMetal(tr) ? this.bandPerf!.ending(tr, k, t, sd) : this.chipEnding(tr, k, t, sd)),
    cut: (t) => this.bandPerf!.cut(t),
  };
  /** Dirigenten (core/conductor.ts): låta som spiller, byttet som venter, lagene, METAL MODE og innslagene. */
  readonly conductor = new Conductor<AnyTrack>(this.perf, () => this.ctx?.currentTime ?? 0);

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
    // Musikken går gjennom dempingen (pause) og dukkingen (store smell), som i Morbidium (06_musikk.js)
    this.dimG = c.createGain();
    this.duckG = c.createGain();
    this.dimG.gain.value = this.dimmed ? DIM : 1;
    this.fadeG = c.createGain();
    this.music.connect(this.fadeG).connect(this.dimG).connect(this.duckG).connect(this.master);
    this.band = new MetalBand(c, this.music);
    this.bandPerf = new BandPerformer(this.band);
    const len = c.sampleRate * 1.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Klang for fanfarene og lagene som ber om det (samme hale som bandets hall, metal.ts)
    const hall = c.createConvolver();
    hall.buffer = impulse(c, 2.4, false);
    const hallIn = c.createGain();
    const hallOut = c.createGain();
    hallOut.gain.value = 0.45;
    hallIn.connect(hall).connect(hallOut).connect(this.sfx);
    this.layers = new LayerPlayer(c, this.noise, hallIn);
    this.fanOut = c.createGain();
    this.fanOut.connect(this.sfx);
    // Lydbanken: opptakene pakkes ut i bakgrunnen, og stemningen bytter fra synth til opptak når en sløyfe er klar
    this.bank.on = settings.recorded;
    this.bank.attach(c, this.sfx, 0.8);
    this.bank.onLoaded = (_name, group) => {
      if (group.startsWith('amb_')) this.amb?.refresh();
    };
    this.bank.start();
    // Bandet bruker VCSL-paukene og bekkensvulmen fra lydbanken når de er lastet (ellers synth)
    this.band.sampler = (g, m, t, v, out) => !!this.bank.note(g, m, { vol: v, t, out });
    // Trommene, gitaren og bassen fra Karoryfer (CC0) når de er lastet og opptakene er på
    this.band.samples = { pick: (g, m, v) => this.bank.pick(g, m, v), full: (g) => this.bank.full(g) };
    this.band.swellSample = () => (this.bank.hasFile('ins_bekken_1') ? { buf: this.bank.buffer('ins_bekken_1')!, lead: this.bank.leadIn('ins_bekken_1') } : null);
    this.amb = new Ambience(c, this.sfx, this.bank, this.layers);
    if (this.wantAmb) this.amb.set(this.wantAmb);
    if (this.trackName) this.play(this.trackName, true);
  }

  /** Innstillingen RECORDED SOUNDS: opptakene av eller på (synthen spiller alltid). */
  setRecorded(on: boolean) {
    this.bank.on = on;
    if (on) this.bank.start();
    this.amb?.refresh();
  }

  // ---------------------------------------------------------------- opptak, dukking og stemning
  /**
   * Opptakene fra lydbanken oppå synthen. Spiller lagene i `list` når den første gruppen er lastet, og gir tilbake
   * bussen synthlyden skal gå til: en dempet buss (nivå `syn`) når opptakene spilte, ellers rett i effektbussen.
   * På FAMILY hoppes gørr, knas, riving og stikk over (merket med true), og da spiller familielyden i synthen som før.
   */
  private rec(list: Rec[], syn: number, pitch = 1, at = 0): AudioNode {
    if (!this.ctx) return this.sfx;
    const family = settings.gore === 0;
    const use = list.filter((r) => !(family && r[3]));
    if (!use.length || !this.bank.has(use[0][0])) return this.sfx;
    const t = this.ctx.currentTime + at;
    for (const [g, v, p = 1] of use) this.bank.play(g, { vol: v, pitch: pitch * p * (1 + rand(-0.05, 0.05)), t });
    return this.synBus(syn);
  }

  private synBus(level: number): AudioNode {
    if (level >= 1 || !this.ctx) return this.sfx;
    let b = this.synBuses.get(level);
    if (!b) {
      b = this.ctx.createGain();
      b.gain.value = level;
      b.connect(this.sfx);
      this.synBuses.set(level, b);
    }
    return b;
  }

  /**
   * Store smell: musikken dukker unna et øyeblikk (amount 0 til 1, hold i sekunder) og kommer tilbake. at er når på
   * lydklokka (et innslag på neste slag), ellers nå.
   */
  duck(amount: number, hold: number, at = 0) {
    if (!this.ctx || amount <= 0) return;
    // METAL MODE: lynene slår ned hvert sekund, og soloen er hele poenget, så den dukker bare litt
    if (this.conductor.shredTarget || this.band?.shred) amount *= 0.35;
    const now = this.ctx.currentTime;
    const t = Math.max(now, at);
    // En mindre dukk midt i en større gjør den ikke grunnere, men kan holde den lenger
    if (now < this.duckEnd) amount = Math.max(amount, this.duckAmt);
    this.duckAmt = amount;
    this.duckEnd = Math.max(this.duckEnd, t + hold);
    const g = this.duckG.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
    else {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
    }
    g.setTargetAtTime(1 - Math.min(0.8, amount), t, 0.015);
    g.setTargetAtTime(1, this.duckEnd, 0.35);
  }

  /** Musikken dempes mens spillet står på pause (kalles hvert bilde, gjør bare noe når det endres). */
  setPaused(on: boolean) {
    if (on === this.dimmed) return;
    this.dimmed = on;
    if (this.ctx) this.dimG.gain.setTargetAtTime(on ? DIM : 1, this.ctx.currentTime, 0.12);
  }

  /** Stemning for et biom (LevelDef.biome), 'arena' for duellene, eller null. Glir over fra den forrige. */
  ambience(biome: string | null) {
    this.wantAmb = biome;
    this.amb?.set(biome);
  }

  /**
   * Hvert bilde fra brettet: hvor nær nærmeste bål og nærmeste foss er (0 til 1) og til hvilken side, og
   * enkeltlydene i stemningen.
   */
  ambienceTick(dt: number, fire = 0, pan = 0, water = 0, wpan = 0) {
    this.amb?.tick(dt, fire, pan, water, wpan);
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
    // Støybufferen er 1,5 sekunder: lange lag går i sløyfe så de ikke kuttes (som i Morbidiums lagspiller)
    if (dur > 0.9) s.loop = true;
    s.start(t, rand(0, 0.5), dur + 0.05);
    return s;
  }

  swish(pitch = 1, heavy = false) {
    if (!this.ok('swish', 0.04)) return;
    const out = this.rec(heavy ? [['swingHeavy', 0.45]] : [['swing', 0.3]], 0.3, clamp(pitch, 0.7, 1.4));
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
    src.connect(f).connect(g).connect(out);
  }

  /** Slag. Tunge slag får knas under (ikke på FAMILY) og dukker musikken litt. */
  hit(heavy = false) {
    if (!this.ok('hit', 0.035)) return;
    const out = this.rec(heavy ? [['hitHeavy', 1], ['knas', 0.25, 1.1, true]] : [['hit', 0.55]], heavy ? 0.35 : 0.3);
    if (heavy) this.duck(0.2, 0.15);
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(heavy ? 150 : 200, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = c.createGain();
    this.env(g, t, 0.005, heavy ? 0.9 : 0.6, heavy ? 0.22 : 0.14);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.3);
    const n = this.noiseSrc(t, 0.08);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = heavy ? 1800 : 2600;
    const g2 = c.createGain();
    this.env(g2, t, 0.002, 0.6, 0.08);
    n.connect(f).connect(g2).connect(out);
  }

  /** Blodsprut. Store (død, tapt arm) får gørr-opptaket under (ikke på FAMILY). */
  splat(size = 1) {
    if (!this.ok('splat', 0.05)) return;
    const recs: Rec[] = [['splat', 0.55 * Math.min(1.4, size)]];
    if (size >= 1.2) recs.push(['gore', 0.45, 1, true]);
    this.splatSyn(size, this.rec(recs, 0.25));
  }

  /** En arm som rives av: riveopptaket og sprut (på FAMILY bare den gamle spruten). */
  rip() {
    if (!this.ok('rip', 0.08)) return;
    this.splatSyn(1.2, this.rec([['rive', 0.7, 1, true], ['splat', 0.3]], 0.3));
  }

  private splatSyn(size: number, out: AudioNode) {
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
    n.connect(f).connect(g).connect(out);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    const g2 = c.createGain();
    this.env(g2, t, 0.004, 0.45, 0.2);
    o.connect(g2).connect(out);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** Kropp som sprekker (eksplosjon, hode som sprenges). delay i sekunder på lydklokka. */
  squish(delay = 0) {
    if (!this.ok('squish', 0.06)) return;
    const out = this.rec([['gore', 0.55, 1, true]], 0.3, 1, delay);
    const c = this.ctx!;
    const t = c.currentTime + delay;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      o.type = 'triangle';
      const tt = t + i * 0.05;
      o.frequency.setValueAtTime(rand(180, 300), tt);
      o.frequency.exponentialRampToValueAtTime(rand(40, 80), tt + 0.08);
      const g = c.createGain();
      this.env(g, tt, 0.003, 0.3, 0.08);
      o.connect(g).connect(out);
      o.start(tt);
      o.stop(tt + 0.12);
    }
  }

  /** Stål mot stål (blokkerte slag): sverdklang fra lydbanken oppå de syntetiske overtonene. */
  clang() {
    if (!this.ok('clang', 0.05)) return;
    const out = this.rec([['klang', 0.5]], 0.4, rand(0.94, 1.08));
    const c = this.ctx!;
    const t = c.currentTime;
    for (const [fr, a] of [[1180, 0.25], [1770, 0.18], [2630, 0.12], [3900, 0.08]] as const) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = fr * rand(0.97, 1.03);
      const g = c.createGain();
      this.env(g, t, 0.002, a, 0.35);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.4);
    }
    const n = this.noiseSrc(t, 0.05);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3000;
    const g = c.createGain();
    this.env(g, t, 0.001, 0.4, 0.05);
    n.connect(f).connect(g).connect(out);
  }

  /**
   * Fottrinn på underlaget brettet har (surface). size over 1.8 er en kjempe: dypere, tyngre og med et dunk under.
   * pan er -1 til 1 etter hvor figuren står i bildet.
   */
  step(size = 1, pan = 0, running = false) {
    const giant = size > 1.8;
    if (!this.ok(giant ? 'stepBig' : 'step', giant ? 0.12 : 0.07)) return;
    const vol = (giant ? 0.75 : running ? 0.26 : 0.18) * rand(0.8, 1.1);
    const pitch = (giant ? 0.62 : 1) * rand(0.9, 1.12);
    const c = this.ctx!;
    const t = c.currentTime;
    if (this.bank.has('fot_' + this.surface)) this.bank.play('fot_' + this.surface, { vol, pitch, pan: clamp(pan, -0.8, 0.8) });
    else {
      // Reserven: et kort, filtrert knas
      const n = this.noiseSrc(t, 0.09);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = (this.surface === 'sno' ? 2600 : this.surface === 'stein' ? 1800 : this.surface === 'vann' ? 900 : 1300) * pitch;
      f.Q.value = 1.2;
      const g = c.createGain();
      this.env(g, t, 0.004, vol * 0.5, 0.08);
      n.connect(f).connect(g).connect(this.sfx);
    }
    if (giant) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.25);
      const g = c.createGain();
      this.env(g, t, 0.006, 0.55, 0.3);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + 0.4);
    }
  }

  /** Kjempebrøl: monsterbrøl fra lydbanken, ellers en dyp, knurrende sagtann gjennom lavpass. at er sekunder fra nå. */
  roar(size = 2.5, at = 0) {
    if (!this.ok('roar', 0.8)) return;
    const pitch = clamp(1.25 - size * 0.15, 0.7, 1.05);
    const out = this.rec([['brol', 0.95]], 0.3, pitch, at);
    this.duck(0.35, 1.2, at);
    const c = this.ctx!;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70 * pitch, t);
    o.frequency.linearRampToValueAtTime(95 * pitch, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 1.8);
    const lfo = c.createOscillator();
    lfo.frequency.value = 23;
    const lg = c.createGain();
    lg.gain.value = 14;
    lfo.connect(lg).connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    f.Q.value = 3;
    const g = c.createGain();
    this.env(g, t, 0.15, 0.45, 1.7);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    lfo.start(t);
    o.stop(t + 2);
    lfo.stop(t + 2);
  }

  /** Krigshorn (en kjempe er på vei): opptaket, ellers to sagtenner i kvint med sakte ansats gjennom lavpass. */
  warHorn(at = 0) {
    if (!this.ok('horn', 2)) return;
    const out = this.rec([['krigshorn', 0.7]], 0.3, 1, at);
    const c = this.ctx!;
    const t = c.currentTime + at;
    for (const [fr, v] of [[98, 0.22], [147, 0.14]] as const) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr * 0.94, t);
      o.frequency.linearRampToValueAtTime(fr, t + 0.35);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(300, t);
      f.frequency.linearRampToValueAtTime(1300, t + 0.6);
      f.frequency.linearRampToValueAtTime(600, t + 2.8);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.4);
      g.gain.setValueAtTime(v, t + 2.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(f).connect(g).connect(out);
      o.start(t);
      o.stop(t + 3.3);
    }
  }

  /**
   * Innleste replikker (VoiceStudio, docs/STEMMER.md): spiller de av linjene som finnes i lydbanken, den ene etter
   * den andre, og dukker musikken mens de snakker. Linjer uten fil hoppes over (teksten vises uansett). alt velger en
   * egen stemme for samme replikk når den finnes (v_<replikk>_<alt>). Gir hvor mange som spilte.
   */
  voice(lines: string | string[], pan = 0, alt?: string): number {
    if (!this.ctx) return 0;
    let at = 0, n = 0;
    for (const text of Array.isArray(lines) ? lines : [lines]) {
      // alt er en egen stemme for samme replikk (f = heltinnene), ellers den vanlige
      let g = voiceId(text);
      if (alt && this.bank.has(g + '_' + alt)) g += '_' + alt;
      if (!this.bank.has(g)) continue;
      const len = this.bank.buffer(g)?.duration ?? 2;
      this.bank.play(g, { vol: 1, pan: clamp(pan, -0.6, 0.6), t: this.ctx.currentTime + at });
      this.duck(0.3, len, at);
      at += len + 0.35;
      n++;
    }
    return n;
  }

  /** Is som knaker og sprekker (råk i isen, tunge landinger i frosten). */
  iceCrack(vol = 1) {
    if (!this.ok('ice', 0.25)) return;
    const out = this.rec([['isknak', 0.7 * vol]], 0.3, rand(0.9, 1.1));
    const c = this.ctx!;
    const t = c.currentTime;
    for (let i = 0; i < 4; i++) {
      const tt = t + i * rand(0.04, 0.12);
      const n = this.noiseSrc(tt, 0.03);
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = rand(1800, 4200);
      const g = c.createGain();
      this.env(g, tt, 0.001, 0.35 * vol, 0.03);
      n.connect(f).connect(g).connect(out);
    }
  }

  scream(voice: Voice = 'hero') {
    if (!this.ok('scream', 0.12)) return;
    // Troll har ekte brøl under den syntetiske stemmen
    const out = voice === 'troll' ? this.rec([['brol', 0.6]], 0.6, rand(1.05, 1.25)) : this.sfx;
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
    g.connect(out);
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

  /** Bein som knuses (skjeletter, pigger). Knaseopptaket hoppes over på FAMILY. */
  bones() {
    if (!this.ok('bones', 0.05)) return;
    const out = this.rec([['knas', 0.4, 1.1, true]], 0.35);
    const c = this.ctx!;
    const t = c.currentTime;
    for (let i = 0; i < 7; i++) {
      const tt = t + i * rand(0.02, 0.05);
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = rand(700, 1600);
      const g = c.createGain();
      this.env(g, tt, 0.001, 0.12, 0.03);
      o.connect(g).connect(out);
      o.start(tt);
      o.stop(tt + 0.06);
    }
  }

  /** Mynt: en ekte mynt som faller, med chip-plinget under. */
  coin() {
    if (!this.ok('coin', 0.05)) return;
    this.notes([[83, 0, 0.06], [88, 0.06, 0.18]], 'square', 0.12, this.rec([['tooth', 0.6, rand(0.95, 1.1)]], 0.4));
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

  private notes(ns: [number, number, number][], type: OscillatorType, vol: number, out: AudioNode = this.sfx) {
    const c = this.ctx!;
    const t = c.currentTime;
    for (const [m, st, d] of ns) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m);
      const g = c.createGain();
      this.env(g, t + st, 0.005, vol, d);
      o.connect(g).connect(out);
      o.start(t + st);
      o.stop(t + st + d + 0.05);
    }
  }

  /** Eksplosjon (ild, meteor, sjefen som dør). Musikken dukker under de store. */
  boom(size = 1) {
    if (!this.ok('boom', 0.06)) return;
    this.duck(Math.min(0.5, 0.35 * size), 0.5);
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

  /**
   * Noe tungt som lander. size er figurens størrelse: tunge fiender (over 1,3, de som ikke kan gripes) lander med et
   * steinhardt smell, og en død kropp (body) faller med et opptak av en kropp mot bakken.
   */
  thud(size = 1, body = false) {
    if (!this.ok('thud', 0.06)) return;
    let out: AudioNode = this.sfx;
    if (body) out = this.rec([['die', 0.5 * clamp(size, 0.8, 1.4)]], 0.35, clamp(1.15 - size * 0.15, 0.85, 1.1));
    else if (size > 1.3) {
      out = this.rec([['slam', 0.75]], 0.3, clamp(1.2 - size * 0.15, 0.8, 1));
      this.duck(0.3, 0.3);
    }
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = c.createGain();
    this.env(g, t, 0.003, 0.6, 0.2);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.25);
  }

  crowd(intensity = 1) {
    if (!this.ok('crowd', 0.5)) return;
    const out = this.rec([['publikum', clamp(0.3 * intensity, 0.1, 0.45)]], 0.35, rand(0.95, 1.05));
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
    n.connect(f).connect(g).connect(out);
  }

  /** Gong (når ingen musikk går; ellers kommer den på slaget med fight() og sjefen): VCSL-gongen, og musikken dukker. */
  gong() {
    if (!this.ok('gong', 0.5)) return;
    this.duck(0.5, 0.6);
    this.gongAt(this.ctx!.currentTime);
  }

  /** Gongen ved t på lydklokka: VCSL-gongen med syntgongen under. */
  private gongAt(t: number, vol = 0.9) {
    const c = this.ctx!;
    const out = this.rec([['ins_gong', vol]], 0.35, 1, Math.max(0, t - c.currentTime));
    t = Math.max(t, c.currentTime);
    for (const [fr, a] of [[98, 0.5], [147, 0.3], [233, 0.2], [311, 0.15], [415, 0.1]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      const g = c.createGain();
      this.env(g, t, 0.01, a, 2.5);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 2.6);
    }
  }

  /**
   * Lyn: et skarpt knall og zap, så torden som ruller. far (0 til 1) er hvor langt unna det slår ned: da kommer
   * buldringen senere og mørkere, og zappen faller bort (tittelskjermen). Torden-opptaket med syntlagene under,
   * og musikken dukker unna.
   */
  thunder(power = 1, far = 0) {
    if (!this.ok('thunder', 0.08)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    // Mange lyn på rad (tordenmagi på fem fiender): buldringen fra de neste legger seg svakere oppå den første
    const stack = t - this.lastThunder < 0.6 ? 0.45 : 1;
    this.lastThunder = t;
    const p = Math.min(1.2, power);
    const L = this.layers!;
    let syn = 1;
    if (this.bank.has('torden')) {
      this.bank.play('torden', { vol: 1.2 * p * stack * (1 - far * 0.35), pitch: rand(0.92, 1.08) * (1 - far * 0.1), t: t + far * 0.35, lp: far > 0 ? 5000 - far * 3000 : undefined });
      syn = 0.3;
    }
    L.play(thunderSyn(0.9 * p * stack, 0, far), this.synBus(syn), 1, 1, t);
    if (far < 0.5) {
      const z = this.bank.has('zap') ? 0.35 : 1;
      if (z < 1) this.bank.play('zap', { vol: 0.4 * Math.min(1, p), pitch: rand(0.9, 1.15), t });
      L.play(zapSyn(0.8 * Math.min(1, p)), this.synBus(z), 1, rand(0.9, 1.1), t);
    }
    this.duck(Math.min(0.55, 0.5 * p * (1 - far * 0.5)), 0.8);
  }

  // ---------------------------------------------------------------- fanfarer
  /** Drapsrekke: fanfaren trappes opp med rekken (3, 6, 10, 15, 22 og 30 drap, se Stage.foeDied). */
  streak(count: number) {
    const tier = [3, 6, 10, 15, 22, 30].filter((x) => count >= x).length;
    if (!tier || !this.ok('streak', 0.3)) return;
    this.playFanfare(STREAK_FANFARES[tier - 1]);
  }

  /** BOSS SLAIN! */
  bossSlain() {
    if (!this.ok('bossSlain', 1)) return;
    this.playFanfare(BOSS_FANFARE);
  }

  /** Knockout i duellen (DECAPITATION!, BUTCHERED!): fanfaren på neste slag og i tonearten når musikken går. */
  knockout() {
    if (!this.ok('knockout', 0.5)) return;
    if (!this.cue('ko')) this.playFanfare(KO_FANFARE);
  }

  /** En lang drapsrekke ryker: trist trombone. */
  chainBroken() {
    if (!this.ok('trombone', 1)) return;
    this.layers!.play(TROMBONE, this.sfx, 0.9);
  }

  /** Gitaren til fanfarene: et eget band på effektbussen, laget første gang det trengs. */
  private fanBand() {
    if (!this.fanBandInst) {
      const g = this.ctx!.createGain();
      g.gain.value = 0.3;
      g.connect(this.fanOut!);
      this.fanBandInst = new MetalBand(this.ctx!, g);
    }
    return this.fanBandInst;
  }

  /**
   * Spill en fanfare: syntlag, slagverk (VCSL eller synth), kraftakkorder og publikum. Alt på lydklokka, fra `at`
   * (et slag i musikken) eller nå. shift flytter fanfaren (skrevet i E) til tonearten, i halvtoner.
   */
  private playFanfare(F: Fanfare, at = 0, shift = 0) {
    const c = this.ctx!;
    const t = Math.max(c.currentTime + 0.02, at);
    const out = this.fanOut!;
    const L = this.layers!;
    const k = Math.pow(2, shift / 12);
    L.play(F.layers, out, 1, F.tonal ? k : 1, t);
    for (const h of F.hits) {
      const ht = t + (h.at ?? 0);
      let played = false;
      if (h.midi !== undefined) played = !!this.bank.note(h.g, h.midi + shift, { vol: h.v, t: ht, out });
      else if (h.file ? this.bank.hasFile(h.file) : this.bank.has(h.g)) played = !!this.bank.play(h.g, { vol: h.v, t: ht, name: h.file, pitch: h.pitch, out });
      if (!played) L.play(h.syn, out, 1, h.midi !== undefined ? k : 1, t);
    }
    if (F.stabs.length || F.dive !== undefined) {
      const band = this.fanBand();
      for (const [st, root, dur, vel] of F.stabs) band.powerChord(t + st, root + shift, dur, true, vel);
      if (F.dive !== undefined) band.diveBomb(t + F.dive);
    }
    if (F.crowd) L.play(roar(0.22 * F.crowd[0], F.crowd[1], 1.8), out, 1, 1, t);
    this.duck(F.duck[0], F.duck[1], t);
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

  /** Plask (myr og råk). */
  splash() {
    if (!this.ok('splash', 0.15)) return;
    const out = this.rec([['splash', 0.55]], 0.35);
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
    n.connect(f).connect(g).connect(out);
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.25 + i * rand(0.08, 0.16);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(rand(300, 600), tt);
      o.frequency.exponentialRampToValueAtTime(rand(800, 1400), tt + 0.06);
      const g2 = c.createGain();
      this.env(g2, tt, 0.002, 0.12, 0.06);
      o.connect(g2).connect(out);
      o.start(tt);
      o.stop(tt + 0.1);
    }
  }

  /** Spidd (piggfeller og pigger): stikkopptaket (ikke på FAMILY) og en klask litt etter, lagt på lydklokka. */
  impale() {
    if (!this.ok('impale', 0.1)) return;
    const out = this.rec([['stikk', 0.6, 1, true]], 0.4);
    this.thud();
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    const g = c.createGain();
    this.env(g, t, 0.002, 0.4, 0.14);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
    this.squish(0.06);
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

  /** Bitt (kjæledyrene): stikkopptaket litt lysere (ikke på FAMILY). */
  bite() {
    if (!this.ok('bite', 0.08)) return;
    const out = this.rec([['stikk', 0.4, 1.25, true]], 0.4);
    const c = this.ctx!;
    const t = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const n = this.noiseSrc(t + i * 0.07, 0.04);
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1800;
      const g = c.createGain();
      this.env(g, t + i * 0.07, 0.001, 0.4, 0.04);
      n.connect(f).connect(g).connect(out);
    }
  }

  cluck() {
    if (!this.ok('cluck', 0.2)) return;
    this.notes([[79, 0, 0.05], [76, 0.08, 0.05], [83, 0.18, 0.12]], 'square', 0.1);
  }

  /** Nytt nivå: et skalaløp på neste slag i tonearten når musikken går, ellers det gamle arpeggioet. */
  levelUp() {
    if (!this.ok('levelup', 0.5)) return;
    if (!this.cue('levelup')) this.notes([[60, 0, 0.08], [64, 0.08, 0.08], [67, 0.16, 0.08], [72, 0.24, 0.08], [76, 0.32, 0.08], [79, 0.4, 0.08], [84, 0.48, 0.4]], 'square', 0.14);
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
  /** Bytt mellom heavy metal og 8-bit. Låten som spiller starter på nytt i den nye stilen. */
  setStyle(style: MusicStyle) {
    if (style === this.style) return;
    this.style = style;
    if (this.trackName) this.play(this.trackName, true);
  }

  get musicStyle() {
    return this.style;
  }

  private songOf(name: string): Song<AnyTrack> | null {
    const tr: AnyTrack | undefined = (this.style === 'metal' ? METAL_TRACKS[name] : undefined) ?? TRACKS[name] ?? TRACKS[CHIP_FALLBACK[name]];
    return tr ? { name, track: tr } : null;
  }

  /** Går musikken (dirigenten har en låt og planlegger)? */
  private get live() {
    return !!this.ctx && !!this.conductor.song && this.timer !== null;
  }

  /**
   * Start en låt med en gang (menyene, brettstart og nye scener). Det som klinger fra den forrige, kveles. I spillet
   * brukes queue(), som venter på taktstreken.
   */
  play(name: string, force = false) {
    if (this.trackName === name && !force && this.timer !== null) return;
    this.trackName = name;
    if (!this.ctx) return;
    const song = this.songOf(name);
    this.unfade();
    if (!song) {
      this.conductor.stop();
      this.stopTimer();
      return;
    }
    this.conductor.start(song);
    this.startTimer();
  }

  /** Bytt låt på neste taktstrek (eller neste slag når det haster), med bro. Starter med en gang når ingenting spiller. */
  queue(name: string, when: Quant = 'bar') {
    const song = this.songOf(name);
    if (!song || !this.live) {
      this.play(name);
      return;
    }
    this.trackName = name;
    this.conductor.queue(song, when);
  }

  /** Intensiteten i musikken (0 rolig, 1 kamp, 2 hete, 3 sjef). Kan settes hvert bilde; lagene følger i takt. */
  intensity(n: Level) {
    this.conductor.setLevel(n);
  }

  /**
   * Sjefen kommer: sjefslåta på en taktstrek minst 1,4 sekunder fram, med bro og en stuping som lander på første slag,
   * der gongen og en stor akkord kommer, og intensitet 3. Samme låt (tårnet) starter på nytt der. Uten musikk som går:
   * alt med en gang, som før.
   */
  bossArrives(name: string) {
    const song = this.songOf(name);
    this.intensity(3);
    if (!song || !this.live) {
      this.play(name);
      this.gong();
      this.stinger('dive');
      return;
    }
    this.trackName = name;
    this.conductor.queue(song, 'bar', true);
  }

  /** Sjefen er død: en kort avslutning fra neste slag, og så seiersmusikken (eller en annen låt). */
  bossDefeated(then = 'victory') {
    if (!this.live) return;
    this.trackName = then;
    this.conductor.end(this.songOf(then));
  }

  /** Game over: musikken tones ut på et øyeblikk, og så kommer tapslyden i tonearten til låta som spilte. */
  defeat() {
    const key = this.conductor.key();
    const live = this.live;
    this.conductor.stop();
    this.trackName = '';
    this.stopTimer();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const g = this.fadeG.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(0, now, 0.1);
    if (this.band) this.band.shred = false;
    if (!this.ok('defeat', 1)) return;
    const shift = keyShift(live ? key : 40);
    if (this.style === 'metal') this.playFanfare(DEFEAT_FANFARE, now + 0.3, shift);
    else this.layers!.play(chipDefeat(shift), this.sfx, 1, 1, now + 0.3);
  }

  /** Uttoningen etter game over oppheves når ny musikk starter. */
  private unfade() {
    const g = this.fadeG.gain;
    if (g.value > 0.999) return;
    const now = this.ctx!.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1, now + 0.08);
  }

  /** METAL MODE (spillet går på spilltid): musikken går inn på neste slag, soloen starter på taktstreken, ut på neste taktstrek. */
  metalMode(on: boolean) {
    this.conductor.metal(on);
  }

  /** Et innslag på neste slag, i tonearten. Gir false når ingen musikk går (da spiller kalleren det gamle med en gang). */
  private cue(kind: CueKind) {
    return this.live && this.conductor.cue(kind);
  }

  /** Bølgen er ryddet: en tvillinglick på neste slag (uten musikk: det gamle plinget). */
  waveCleared() {
    if (!this.cue('clear')) this.confirm();
  }

  /** FIGHT!: gong, crash og en akkord i tonearten på neste slag (uten musikk: gongen med en gang). */
  fight() {
    if (!this.ok('fight', 0.5)) return;
    if (!this.cue('fight')) this.gong();
  }

  /** Korte metal-innslag på neste slag i tonearten: stor akkord (brettstart), vektarmdykk og skrik. */
  stinger(kind: 'chord' | 'dive' | 'wail') {
    if (!this.ok('stinger-' + kind, 0.5)) return;
    if (this.cue(kind) || this.style !== 'metal' || !this.band) return;
    const t = this.ctx!.currentTime + 0.02;
    if (kind === 'chord') this.band.bigChord(t);
    else if (kind === 'dive') this.band.diveBomb(t);
    else this.band.wail(t);
  }

  /** Stopp musikken med en gang (oppstartslogoen, introen). */
  stop() {
    this.trackName = '';
    this.conductor.stop();
    this.stopTimer();
    if (this.band && this.ctx) {
      this.band.shred = false;
      this.band.choke(this.ctx.currentTime, 0.08);
    }
  }

  private startTimer() {
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private stopTimer() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** Dirigenten planlegger 0,12 sekunder fram på lydklokka (og hopper fram etter en pause i fanen). */
  private schedule() {
    const c = this.ctx;
    if (!c) return;
    this.conductor.advance(c.currentTime + 0.12);
    if (!this.conductor.song) this.stopTimer();
  }

  // ---------- 8-bit for dirigenten ----------
  private chipTone(m: number, t: number, dur: number, vol: number, type: OscillatorType = 'square') {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = mtof(m);
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private chipDrum(t: number, kind: 'kick' | 'tom' | 'crash', pitch = 110) {
    const c = this.ctx!;
    if (kind === 'crash') {
      const n = this.noiseSrc(t, 1.2);
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 5000;
      const g = c.createGain();
      this.env(g, t, 0.003, 0.3, 1.1);
      n.connect(f).connect(g).connect(this.music);
      return;
    }
    const o = c.createOscillator();
    o.frequency.setValueAtTime(kind === 'kick' ? 150 : pitch, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 40 : 60, t + (kind === 'kick' ? 0.12 : 0.2));
    const g = c.createGain();
    this.env(g, t, 0.002, kind === 'kick' ? 1 : 0.7, kind === 'kick' ? 0.18 : 0.22);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** Treklangen på tonika (brettstart, FIGHT!, KO og avslutningen). */
  private chipChord(tr: Track, t: number, dur: number) {
    const base = fold(rootAt(tr), 60);
    for (const d of [0, 2, 4, 7]) this.chipTone(d ? diatonic(base, d, tr.scale) : base, t, dur, 0.06);
    this.chipTone(base - 24, t, dur, 0.3, tr.bassWave ?? 'sawtooth');
    this.chipDrum(t, 'kick');
    this.chipDrum(t, 'crash');
  }

  /** Broen i 8-bit: Morbidiums harpeløp opp dominanten i den nye tonearten (trinn 4, 6, 8, 11 og 13) over bassen på den, og tammer. */
  private chipBridge(to: Track, k: number, n: number, t: number, sd: number) {
    const base = fold(rootAt(to), 60);
    const tone = (d: number) => diatonic(base, d, to.scale);
    if (k === 0) {
      [4, 6, 8, 11, 13].forEach((d, i) => this.chipTone(tone(d), t + (i * n * sd) / 5, 0.16, 0.08));
      this.chipTone(tone(4) - 24, t, n * sd, 0.3, to.bassWave ?? 'sawtooth');
    }
    this.chipDrum(t, 'tom', 150 - (4 - n + k) * 20);
  }

  private chipDownbeat(to: Track, t: number) {
    this.chipDrum(t, 'kick');
    this.chipDrum(t, 'crash');
  }

  private chipDive(t: number, land: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(mtof(88), t);
    o.frequency.exponentialRampToValueAtTime(mtof(40), t + land);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g.gain.setValueAtTime(0.06, t + land);
    g.gain.exponentialRampToValueAtTime(0.0001, t + land + 0.1);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + land + 0.15);
  }

  /** Innslagene i 8-bit: arpeggio opp akkorden (bølge ryddet), løp opp skalaen (nytt nivå) og treklang med crash. */
  private chipCue(kind: CueKind, tr: Track, s: number, t: number, sd: number) {
    const base = fold(rootAt(tr, s), 60);
    const tone = (d: number) => (d ? diatonic(base, d, tr.scale) : base);
    if (kind === 'clear') [0, 2, 4, 7].forEach((d, i) => this.chipTone(tone(d), t + i * 2 * sd, (i === 3 ? 4 : 2) * sd, 0.1));
    else if (kind === 'levelup') {
      for (let i = 0; i < 8; i++) this.chipTone(tone(i), t + i * sd, sd * 0.9, 0.09);
      this.chipTone(base + 12, t + 8 * sd, 6 * sd, 0.1);
    } else if (kind === 'fight' || kind === 'ko' || kind === 'chord') this.chipChord(tr, t, 4 * sd);
  }

  private chipEnding(tr: Track, k: number, t: number, sd: number) {
    if (k === 0) this.chipChord(tr, t, 12 * sd);
    else if (k >= 12 && k < 16) this.chipDrum(t, 'tom', 150 - (k - 12) * 20);
    else if (k === 16) this.chipChord(tr, t, 2);
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
    // Rolig (mellom bølgene): bare bass og trommer
    for (const [st, m, len] of this.chipLevel > 0 ? tr.lead : []) {
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
