// Dirigenten: musikken bytter og bygger seg opp i takt, som iMUSE hos LucasArts (bare inspirasjon, ingen kode eller
// musikk er hentet derfra). Tilpasset fra Morbidium (src/06_musikk.js: spill, planlegg, svulm, bytt, settNiva,
// byttNiva, innslag og tick) og skrevet om som TypeScript-modul for metalbandet (core/metal.ts) og 8-bit-låtene
// (core/audio.ts). LL har 16 steg (sekstendeler) i takta og Morbidium 8 (åttendeler), så tallene er doblet.
// - queue(låt, 'bar' | 'beat'): en ny låt venter til neste taktstrek, eller til neste slag når det haster. Det siste
//   slaget før byttet er en bro: tammene tar en virvel, gitarene holder en kvintakkord på dominanten i den nye
//   tonearten, bassen går opp mot den, og et bekken svulmer slik at toppen treffer første slag i den nye låta. Der
//   lander stortromme, crash og en stor akkord på den nye grunntonen.
// - Intensitet 0 til 3 (rolig, kamp, hete, sjef): lagene går opp på neste slag og ned på neste taktstrek, og tempoet
//   trappes litt opp (Morbidium: 6 og 12 prosent, her 2 og 4, så riffene tåler det).
// - METAL MODE går inn på neste slag, soloen starter på taktstreken, og modusen går ut på neste taktstrek.
// - Innslag (bølge ryddet, nytt nivå, FIGHT!, KO) kommer på neste slag og i tonearten til låta som spiller.
// - Sjefen: byttet legges på en taktstrek minst 1,4 sekunder fram, så stupingen (1,35 s) lander på første slag.
// - Avslutning: en kort slutt fra neste slag, og så eventuelt en ny låt (seiersmusikken etter sjefen).
// Alt planlegges på lydklokka med et lite forsprang (Chris Wilsons «A Tale of Two Clocks»). Spillet går på spilltid
// som før, det er bare lyden som venter. Den samme koden drives av setInterval i spillet og av en simulert klokke i
// testen (tools/tests/imuse.mjs), som rendrer med OfflineAudioContext.
// Forbedret fra Morbidium: tempoet står stille mens et bytte venter (ellers blir tiden for første slag feil), den gamle
// låta kveles i broen i stedet for å klinge over den nye, og sjefens bytte venter på stupingen.

import { fold, type MetalBand, type MetalTrack, type Level } from './metal';
export type { Level } from './metal';

/** Sekstendeler per slag og per takt. */
export const BEAT = 4;
export const BAR = 16;
/** Sjefen: byttet må ligge minst så langt fram (sekunder), og så lenge varer stupingen før den lander. */
export const BOSS_LEAD = 1.4;
export const DIVE = 1.35;
/** Avslutningen: sekstendeler fra første slag til neste låt (den siste akkorden kommer på 16). */
export const ENDING = 32;
/** Tempoet per intensitet (ganger bpm). */
const TEMPO: Record<Level, number> = { 0: 1, 1: 1, 2: 1.02, 3: 1.04 };

export type Quant = 'bar' | 'beat';
export type CueKind = 'clear' | 'levelup' | 'fight' | 'ko' | 'chord' | 'wail' | 'dive';

/** Det dirigenten trenger å vite om en låt. MetalTrack og 8-bit-låtene har dette. */
export interface SongInfo {
  bpm: number;
  steps: number;
  /** Tonehøydeklassene i skalaen (0 = C). */
  scale: number[];
  /** Grunntonen (MIDI) i hvert steg. */
  roots?: number[];
}
export interface Song<T extends SongInfo = SongInfo> {
  name: string;
  track: T;
}

/** Grunntonen i steg s (akkorden som spilles). Uten s: låtas første grunntone, tonika. */
export function rootAt(tr: SongInfo, s = 0) {
  const r = tr.roots;
  return r && r.length ? r[((s % r.length) + r.length) % r.length] : 40;
}

/** Hvordan musikken spilles: MetalBand (BandPerformer under) eller 8-bit-synthen i AudioEngine. Alle tider er på lydklokka. */
export interface Performer<T extends SongInfo> {
  /** Ett steg av låta slik den er skrevet (s teller fra låtstart, også forbi runden). */
  step(tr: T, s: number, t: number, sd: number): void;
  /** Steg k av n i broen fra `from` til `to`. */
  bridge(from: T, to: T, k: number, n: number, t: number, sd: number): void;
  /** Første slag i den nye låta. boss: gong, dobbel crash og en lengre akkord. */
  downbeat(to: T, t: number, sd: number, boss: boolean): void;
  /** Bekkensvulm som topper ved T. Gir tilbake en stopper, eller null når det ikke er tid nok. */
  swell(T: number, now: number): (() => void) | null;
  /** Stuping som starter ved t og lander `land` sekunder senere (sjefen). */
  dive(t: number, land: number): void;
  /** Ny intensitet fra t. fast: ved låtstart og bytte (ingen crash, ingen langsom nedtoning). */
  level(n: Level, t: number, sd: number, fast: boolean): void;
  /** METAL MODE: inn (på et slag), solo (på en taktstrek) og ut (på en taktstrek). */
  shred(phase: 'in' | 'solo' | 'out', tr: T, s: number, t: number, sd: number): void;
  /** Et innslag i tonearten på slaget. */
  cue(kind: CueKind, tr: T, s: number, t: number, sd: number): void;
  /** Steg k av avslutningen. */
  ending(tr: T, k: number, t: number, sd: number): void;
  /** Alt som klinger fra låta, kveles ved t (umiddelbar start). */
  cut(t: number): void;
}

/** En hendelse i musikken (til testene): hva, hvilken låt, steget i låta, tid på lydklokka og litt ekstra. */
export interface MusicEvent {
  kind: string;
  song: string;
  step: number;
  t: number;
  info?: string | number;
}

interface Pending<T extends SongInfo> {
  to: Song<T>;
  /** Steget i den gamle låta der den nye begynner (første slag), og der broen starter. */
  at: number;
  from: number;
  /** Tiden for første slag. */
  T: number;
  quant: Quant;
  boss: boolean;
  stopSwell: (() => void) | null;
}

export class Conductor<T extends SongInfo> {
  song: Song<T> | null = null;
  /** Neste steg som skal planlegges (teller fra låtstart) og tiden for det. */
  step = 0;
  nextTime = 0;
  level: Level = 1;
  levelTarget: Level = 1;
  /** METAL MODE i musikken (fra slaget) og soloen (fra taktstreken), og det spillet vil. */
  shred = false;
  solo = false;
  shredTarget = false;
  pending: Pending<T> | null = null;
  ending: { at: number; then: Song<T> | null } | null = null;
  tempoK = 1;
  readonly stats = { starts: 0, switches: 0, bridges: 0, levels: 0, shreds: 0, cues: 0, endings: 0 };
  /** De siste hendelsene (til testene). */
  readonly events: MusicEvent[] = [];
  private cues: CueKind[] = [];

  constructor(private perf: Performer<T>, private clock: () => number) {}

  /** Lengden på en sekstendel nå. */
  sd() {
    return this.song ? 60 / (this.song.track.bpm * this.tempoK) / 4 : 0.1;
  }

  /** Tiden for neste slag (q = BEAT) eller taktstrek (q = BAR) som ikke er planlagt ennå. */
  nextBeat(q = BEAT) {
    return this.nextTime + ((q - (this.step % q)) % q) * this.sd();
  }

  /** Tonika i låta som spiller. */
  key() {
    return this.song ? rootAt(this.song.track) : 40;
  }

  /** Start en låt med en gang (menyene, brettstart, og når ingenting spiller). */
  start(song: Song<T>, t = this.clock() + 0.08, level: Level = 1) {
    this.cancelPending();
    this.ending = null;
    this.perf.cut(t);
    this.song = song;
    this.step = 0;
    this.nextTime = t;
    this.shred = this.solo = false;
    this.level = this.levelTarget = level;
    this.tempoK = TEMPO[level];
    this.perf.level(level, t, this.sd(), true);
    this.stats.starts++;
    this.log('start', 0, t, song.name);
  }

  /**
   * Bytt låt på neste taktstrek ('bar', med minst ett helt slag til broen) eller på neste slag ('beat', minst to
   * sekstendeler). boss: byttet legges på en taktstrek minst BOSS_LEAD fram, og stupingen starter nå, så den lander på
   * første slag. Samme låt igjen avlyser et bytte som venter (unntatt for sjefen, som starter låta på nytt).
   */
  queue(song: Song<T>, quant: Quant = 'bar', boss = false) {
    if (!this.song) {
      this.start(song);
      return;
    }
    if (this.ending) {
      this.ending.then = song;
      return;
    }
    this.resync(this.clock());
    const p = this.pending;
    if (!boss && song.name === this.song.name) {
      if (p) this.cancelPending();
      return;
    }
    if (p && p.to.name === song.name && (p.boss || !boss) && (p.quant === 'beat' || quant === 'bar')) return;
    this.cancelPending();
    this.plan(song, quant, boss);
  }

  private plan(song: Song<T>, quant: Quant, boss: boolean) {
    const s = this.step;
    const sd = this.sd();
    const now = this.clock();
    let at: number;
    if (quant === 'beat') {
      at = Math.ceil(s / BEAT) * BEAT;
      if (at - s < 2) at += BEAT;
    } else {
      at = Math.ceil(s / BAR) * BAR;
      if (at - s < BEAT) at += BAR;
    }
    if (boss) while (this.nextTime + (at - s) * sd - now < BOSS_LEAD) at += BAR;
    const T = this.nextTime + (at - s) * sd;
    const p: Pending<T> = { to: song, at, from: Math.max(s, at - BEAT), T, quant, boss, stopSwell: null };
    this.pending = p;
    p.stopSwell = this.perf.swell(T, now);
    if (boss) this.perf.dive(Math.max(now + 0.02, T - DIVE), Math.min(DIVE, T - now - 0.02));
    this.log('plan', s, now, song.name + '@' + at);
  }

  private cancelPending() {
    const p = this.pending;
    if (!p) return;
    p.stopSwell?.();
    this.pending = null;
    this.log('cancel', this.step, this.nextTime, p.to.name);
  }

  /** Intensiteten spillet vil ha (kan settes hvert bilde). */
  setLevel(n: Level) {
    this.levelTarget = n;
  }

  /** METAL MODE av eller på (spillet). Musikken følger på slaget og taktstreken. */
  metal(on: boolean) {
    this.shredTarget = on;
  }

  /** Et innslag på neste slag. Gir false når ingen låt spiller (da spiller AudioEngine det med en gang). */
  cue(kind: CueKind) {
    if (!this.song) return false;
    if (!this.cues.includes(kind) && this.cues.length < 3) this.cues.push(kind);
    return true;
  }

  /** Avslutt låta fra neste slag, og start `then` etter avslutningen (eller stopp). */
  end(then: Song<T> | null) {
    if (!this.song) {
      if (then) this.start(then);
      return;
    }
    if (this.ending) {
      this.ending.then = then;
      return;
    }
    this.cancelPending();
    this.resync(this.clock());
    this.ending = { at: Math.ceil(this.step / BEAT) * BEAT, then };
    this.stats.endings++;
    this.log('end', this.step, this.nextTime, then?.name ?? '');
  }

  /** Stopp alt (game over, oppstartslogoen). Selve lyden tones ut eller kveles av AudioEngine. */
  stop() {
    this.cancelPending();
    this.ending = null;
    this.cues = [];
    this.shred = this.solo = false;
    if (this.song) this.log('stop', this.step, this.nextTime);
    this.song = null;
  }

  /** Planlegg alt fram til `until` på lydklokka. */
  advance(until: number) {
    if (!this.song) return;
    this.resync(this.clock());
    while (this.song && this.nextTime < until) this.tick();
  }

  /**
   * Etter en pause i fanen, eller et tungt bilde (sjefen bygges), hopper vi fram i stedet for å spille alt som ble
   * liggende igjen (Morbidium: tick). Forbedring: vi hopper i hele steg, så takten står, og et bytte som venter,
   * lander fortsatt på sin taktstrek. Er tiden for byttet passert, skjer det med en gang (uten bro), og en avslutning
   * som ble hoppet over, starter fra begynnelsen.
   */
  private resync(now: number) {
    if (!this.song || this.nextTime >= now - 0.25) return;
    const n = Math.ceil((now + 0.02 - this.nextTime) / this.sd());
    this.nextTime += n * this.sd();
    this.step += n;
    const p = this.pending;
    if (p && this.step >= p.at) {
      p.stopSwell?.();
      p.stopSwell = null;
      p.at = p.from = this.step;
    } else if (p && this.step > p.from) p.from = this.step;
    const e = this.ending;
    if (e && this.step > e.at && this.step < e.at + ENDING) e.at = this.step;
    this.log('skip', this.step, this.nextTime, n);
  }

  private tick() {
    const t = this.nextTime;
    if (this.pending && this.step >= this.pending.at) this.swap(t);
    if (this.ending && this.step >= this.ending.at + ENDING) {
      this.finishEnding(t);
      if (!this.song) return;
    }
    const tr = this.song!.track;
    const s = this.step;
    const sd = this.sd();
    const beat = s % BEAT === 0;
    const bar = s % BAR === 0;
    const p = this.pending;
    const busy = !!this.ending || (!!p && s >= p.from);
    // Lagene: opp på slaget, ned på taktstreken. Mens et bytte venter, kommer de på første slag i den nye låta. På
    // første steg etter en start (brettet vil ha rolig fra første takt) byttes de med en gang, uten crash.
    if (!p && !this.ending && this.levelTarget !== this.level && ((this.levelTarget > this.level && beat) || bar)) this.applyLevel(t, s, sd, s === 0);
    // METAL MODE: inn på slaget, soloen på taktstreken, ut på taktstreken
    if (!busy) {
      if (this.shredTarget && !this.shred && beat) {
        this.shred = true;
        this.stats.shreds++;
        this.perf.shred('in', tr, s, t, sd);
        this.log('shred-in', s, t);
      }
      if (this.shredTarget && this.shred && !this.solo && bar) {
        this.solo = true;
        this.perf.shred('solo', tr, s, t, sd);
        this.log('solo', s, t);
      }
      if (!this.shredTarget && this.shred && bar) {
        this.shred = this.solo = false;
        this.perf.shred('out', tr, s, t, sd);
        this.log('shred-out', s, t);
      }
    }
    // Innslagene på slaget (ikke midt i broen eller avslutningen)
    if (beat && !busy && this.cues.length)
      for (const k of this.cues.splice(0)) {
        this.stats.cues++;
        this.perf.cue(k, tr, s, t, sd);
        this.log('cue', s, t, k);
      }
    // Steget: avslutningen, broen eller låta
    if (this.ending && s >= this.ending.at) this.perf.ending(tr, s - this.ending.at, t, sd);
    else if (p && s >= p.from) {
      if (s === p.from) {
        this.stats.bridges++;
        this.log('bridge', s, t, p.to.name);
      }
      this.perf.bridge(tr, p.to.track, s - p.from, p.at - p.from, t, sd);
    } else this.perf.step(tr, s, t, sd);
    // Tempoet glir mot intensiteten over en takt (ikke mens noe venter, så tiden for første slag står)
    if (!p && !this.ending) this.tempoK += Math.max(-0.0025, Math.min(0.0025, TEMPO[this.level] - this.tempoK));
    this.nextTime += sd;
    this.step++;
  }

  private applyLevel(t: number, s: number, sd: number, fast: boolean) {
    this.level = this.levelTarget;
    this.stats.levels++;
    this.perf.level(this.level, t, sd, fast);
    this.log('level', s, t, this.level);
  }

  /** Første slag i den nye låta: lagene som ventet, kommer inn med slaget. */
  private swap(t: number) {
    const p = this.pending!;
    this.pending = null;
    this.log('switch', this.step, t, this.song!.name + '>' + p.to.name);
    this.song = p.to;
    this.step = 0;
    this.stats.switches++;
    if (this.levelTarget !== this.level) this.applyLevel(t, 0, this.sd(), true);
    this.perf.downbeat(p.to.track, t, this.sd(), p.boss);
  }

  private finishEnding(t: number) {
    const then = this.ending!.then;
    this.ending = null;
    this.log('ending-done', this.step, t, then?.name ?? '');
    if (!then) {
      this.stop();
      return;
    }
    this.perf.cut(t);
    this.song = then;
    this.step = 0;
    this.shred = this.solo = false;
    this.stats.starts++;
    this.levelTarget = 1;
    this.applyLevel(t, 0, this.sd(), true);
    this.log('start', 0, t, then.name);
  }

  private log(kind: string, step: number, t: number, info?: string | number) {
    this.events.push({ kind, song: this.song?.name ?? '', step, t, info });
    if (this.events.length > 300) this.events.shift();
  }
}

/**
 * Dirigenten spiller metalbandet: låta, broen, første slag, lagene, METAL MODE, innslagene og avslutningen.
 * Brukes av AudioEngine i metal-stilen og direkte av testen (med et MetalBand i en OfflineAudioContext).
 */
export class BandPerformer implements Performer<MetalTrack> {
  constructor(readonly band: MetalBand) {}

  step(tr: MetalTrack, s: number, t: number, sd: number) {
    this.band.playStep(tr, s % tr.steps, t, sd);
  }

  bridge(_from: MetalTrack, to: MetalTrack, k: number, n: number, t: number, sd: number) {
    this.band.bridgeStep(k, n, rootAt(to), t, sd);
  }

  downbeat(to: MetalTrack, t: number, sd: number, boss: boolean) {
    this.band.downbeat(t, rootAt(to), sd, boss);
  }

  swell(T: number, now: number) {
    return this.band.swell(T, now);
  }

  dive(t: number, land: number) {
    this.band.diveBomb(t, land);
  }

  level(n: Level, t: number, sd: number, fast: boolean) {
    this.band.setLevel(n, t, sd, fast);
  }

  shred(phase: 'in' | 'solo' | 'out', tr: MetalTrack, s: number, t: number, sd: number) {
    const b = this.band;
    if (phase === 'in') {
      // Crash, stortromme og skrik på slaget, og tremolo på grunntonen fram til taktstreken der soloen starter
      b.solo = false;
      b.setShred(true, t, sd);
      b.crash(t);
      b.kick(t);
      b.wail(t + 0.05, 1.3, fold(rootAt(tr), 70));
      const toBar = (BAR - (s % BAR)) % BAR;
      if (toBar) b.tremolo(t, t + toBar * sd, rootAt(tr, s), sd);
    } else if (phase === 'solo') b.startSolo();
    else {
      b.setShred(false, t, sd);
      b.crash(t, 0.9);
      b.kick(t);
    }
  }

  cue(kind: CueKind, tr: MetalTrack, s: number, t: number, sd: number) {
    const b = this.band;
    // Lickene følger akkorden som spilles, de store slagene tonika
    const chord = rootAt(tr, s);
    const key = rootAt(tr);
    if (kind === 'clear') b.lick(t, chord, tr.scale, sd);
    else if (kind === 'levelup') b.run(t, chord, tr.scale, sd);
    else if (kind === 'fight' || kind === 'ko') b.hit(t, key, sd);
    else if (kind === 'chord') b.bigChord(t, key);
    else if (kind === 'wail') b.wail(t, 1.5, fold(key, 70));
    else b.diveBomb(t);
  }

  ending(tr: MetalTrack, k: number, t: number, sd: number) {
    this.band.endingStep(rootAt(tr), k, t, sd);
  }

  cut(t: number) {
    this.band.shred = false;
    this.band.solo = false;
    this.band.choke(t, 0.06);
  }
}
