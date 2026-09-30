// Lydbanken: innspilte lyder oppå synthlydene. Tilpasset fra Morbidium (src/42_lyd.js, Lydbank), skrevet om til en
// TypeScript-modul som eies av AudioEngine (core/audio.ts), slik MetalBand gjør.
// Alt er fri bruk (CC0): lydeffekter og stemning fra Freesound og slagverk fra Versilian Community Sample Library (VCSL).
// Filene ligger i public/assets/sound/ med metadata i sound.json og en kildeliste per fil i KILDER.md.
// - Filene pakkes ut i bakgrunnen når lyden slås på (første trykk), fire om gangen: effektene først, så slagverket
//   og til slutt stemningssløyfene. Til en lyd er klar, eller hvis den feiler, spiller synthlyden alene.
// - play(gruppe) velger en tilfeldig variant, aldri den samme to ganger på rad, og spiller høyst fem lyder per gruppe
//   på 80 ms (tjue blodsprut i samme bilde blir ellers bare høyere og grøtete).
// - MP3 har litt stillhet foran (koderens forsinkelse), og nettleserne tar den bort i ulik grad. Den måles i hver lyd,
//   og sløyfene har litt ekstra på hver side, så de tåler at målingen bommer litt.
// - Enkeltfil-bygget og file:// kan ikke hente filer (fetch virker ikke der), så da startes banken aldri og synthen spiller alene.

/** Metadata per fil, som i Morbidiums lyd.json (feltnavnene er beholdt, så radene kan kopieres rett over). */
export interface SoundMeta {
  gruppe: string;
  /** voice = innleste replikker (v_<replikk>, se docs/STEMMER.md), pakkes ut sist. */
  type: 'sfx' | 'ins' | 'amb' | 'voice';
  sek?: number;
  /** Sløyfepunkter i sekunder (etter stillheten foran), eller false/null for engangslyder. */
  sloyfe?: [number, number] | false | null;
  /** Grunntonen som MIDI-nummer for stemte instrumenter (paukene). */
  rot?: number | null;
}

export interface PlayOpts {
  vol?: number;
  pitch?: number;
  /** Når, i lydkortets tid (0 = nå). */
  t?: number;
  /** Bussen lyden går til (ellers bankens utgang). */
  out?: AudioNode;
  pan?: number;
  /** Lavpass i Hz. */
  lp?: number;
  loop?: boolean;
  /** Sløyfer starter et tilfeldig sted (stemningen). */
  randomStart?: boolean;
  /** Inntoning i sekunder. */
  a?: number;
  /** Lengde i sekunder, med rel som uttoning. */
  d?: number;
  rel?: number;
  /** Sekunder inn i lyden. */
  from?: number;
  /** En bestemt variant i gruppen. */
  name?: string;
}

/** En lyd som spiller. stop() toner den ut. */
export interface Voice {
  src: AudioBufferSourceNode;
  g: GainNode;
  lp: BiquadFilterNode | null;
  pan: StereoPannerNode | null;
  name: string;
  stop(fade?: number): void;
}

/** Kan filer hentes? Ikke i enkeltfil-bygget og ikke fra file://. */
export function canFetchSounds() {
  try {
    if (import.meta.env.MODE === 'single') return false;
    return typeof location !== 'undefined' && location.protocol !== 'file:' && typeof fetch === 'function';
  } catch {
    return false;
  }
}

export class SoundBank {
  /** Innstillingen RECORDED SOUNDS. */
  on = true;
  /** Antall filer som er pakket ut, som skal pakkes ut, og som feilet (til testene). */
  ready = 0;
  total = 0;
  failed = 0;
  started = false;
  /** Hvor mange ganger hver gruppe er spilt (til testene). */
  played: Record<string, number> = {};
  /** Kalles når en fil er klar (stemningen bytter da fra synth til opptak). */
  onLoaded: ((name: string, group: string) => void) | null = null;
  readonly out: GainNode | null = null;
  private ctx: AudioContext | null = null;
  private meta: Record<string, SoundMeta> = {};
  private groups: Record<string, string[]> = {};
  private buf = new Map<string, AudioBuffer>();
  private lead = new Map<string, number>();
  private last: Record<string, string> = {};
  private recent: Record<string, number[]> = {};
  private decoders: Record<number, OfflineAudioContext | null> = {};

  constructor(private base = './assets/sound/') {}

  /** Kobler banken til lydkortet. Opptakene går gjennom en egen buss med litt lavere nivå (de er normalisert høyt). */
  attach(ctx: AudioContext, dest: AudioNode, level = 0.8) {
    this.ctx = ctx;
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(dest);
    (this as { out: GainNode | null }).out = g;
  }

  /** Start utpakkingen i bakgrunnen (én gang). Gjør ingenting uten fetch eller når opptakene er slått av. */
  start() {
    if (this.started || !this.on || !this.ctx || !canFetchSounds()) return;
    this.started = true;
    fetch(this.base + 'sound.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, SoundMeta>>) : Promise.reject(new Error('sound.json ' + r.status))))
      .then((meta) => {
        this.meta = meta;
        this.groups = {};
        for (const k in meta) (this.groups[meta[k].gruppe] ??= []).push(k);
        const pri = (k: string) => ({ sfx: 0, ins: 1, amb: 2, voice: 3 })[meta[k].type] ?? 3;
        const names = Object.keys(meta).sort((a, b) => pri(a) - pri(b));
        this.total = names.length;
        let i = 0;
        let busy = 0;
        const next = () => {
          while (busy < 4 && i < names.length) {
            const k = names[i++];
            busy++;
            this.load(k).then(() => {
              busy--;
              next();
            });
          }
        };
        next();
      })
      .catch(() => {
        // Ingen lydfiler (for eksempel et bygg uten public/): synthen spiller som før
        this.failed++;
      });
  }

  /** Alle filene er pakket ut (eller feilet). */
  get done() {
    return this.total > 0 && this.ready + this.failed >= this.total;
  }

  private load(k: string): Promise<void> {
    return fetch(this.base + k + '.mp3')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(k + ' ' + r.status))))
      .then((ab) => this.decode(k, ab))
      .catch(() => {
        this.failed++;
      });
  }

  /**
   * Lydene pakkes ut i sin egen samplingsfrekvens (effektene 32 kHz, stemningen 24 kHz). Det sparer omtrent en tredel
   * av minnet mot lydkortets 48 kHz. Nettleseren omsampler når de spilles. Går det ikke, brukes lydkortet selv.
   */
  private decoder(m: SoundMeta | undefined) {
    const sr = m?.type === 'amb' ? 24000 : 32000;
    if (this.decoders[sr] !== undefined) return this.decoders[sr];
    try {
      const O = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      this.decoders[sr] = O ? new O(1, 1, sr) : null;
    } catch {
      this.decoders[sr] = null;
    }
    return this.decoders[sr];
  }

  private decode(k: string, ab: ArrayBuffer): Promise<void> {
    const copy = ab.slice(0);
    const ok = (b: AudioBuffer | null) => {
      if (b && b.length) {
        this.buf.set(k, b);
        this.lead.set(k, measureLead(b));
        this.ready++;
        this.onLoaded?.(k, this.meta[k]?.gruppe ?? k);
      } else this.failed++;
    };
    const tryDecode = (ctx: BaseAudioContext, data: ArrayBuffer) =>
      new Promise<AudioBuffer>((res, rej) => {
        try {
          const p = ctx.decodeAudioData(data, res, rej);
          if (p && typeof p.catch === 'function') p.catch(rej);
        } catch (e) {
          rej(e);
        }
      });
    const d = this.decoder(this.meta[k]);
    const main = () => (this.ctx ? tryDecode(this.ctx, copy) : Promise.reject(new Error('no ctx')));
    return (d ? tryDecode(d, ab).catch(main) : main()).then(ok, () => ok(null));
  }

  /** Finnes minst én klar fil i gruppen (og er opptakene slått på)? */
  has(group: string) {
    if (!this.on || !this.ctx) return false;
    const L = this.groups[group];
    return !!L && L.some((k) => this.buf.has(k));
  }

  /** Er alle filene i gruppen klare? Instrumentene i bandet bytter fra synth først når hele gruppen er lastet. */
  full(group: string) {
    if (!this.on || !this.ctx) return false;
    const L = this.groups[group];
    return !!L && L.length > 0 && L.every((k) => this.buf.has(k));
  }

  /**
   * Opptaket nærmest en tone i gruppen, med avspillingsfarten som gir tonen (opptak uten tone spilles som de er).
   * Varianter med samme tone (round robin) velges tilfeldig, aldri den samme to ganger på rad.
   */
  pick(group: string, midi: number): { buf: AudioBuffer; rate: number; lead: number } | null {
    if (!this.on) return null;
    const L = (this.groups[group] ?? []).filter((k) => this.buf.has(k));
    if (!L.length) return null;
    let bd = Infinity;
    let best: string[] = [];
    for (const k of L) {
      const r = this.meta[k].rot;
      const d = r == null ? 0 : Math.abs(r - midi);
      if (d < bd - 0.25) {
        bd = d;
        best = [k];
      } else if (d <= bd + 0.25) best.push(k);
    }
    let k = best[Math.floor(Math.random() * best.length)];
    if (best.length > 1 && k === this.last[group]) k = best[(best.indexOf(k) + 1) % best.length];
    this.last[group] = k;
    const root = this.meta[k].rot ?? midi;
    return { buf: this.buf.get(k)!, rate: Math.pow(2, (midi - root) / 12), lead: this.lead.get(k) ?? 0 };
  }

  /** Er akkurat denne filen klar? */
  hasFile(name: string) {
    return this.on && !!this.ctx && this.buf.has(name);
  }

  buffer(name: string) {
    return this.buf.get(name) ?? null;
  }

  /** Stillheten foran i en fil (sekunder). */
  leadIn(name: string) {
    return this.lead.get(name) ?? 0;
  }

  metaOf(name: string) {
    return this.meta[name];
  }

  /** Én lyd fra en gruppe: en tilfeldig variant, aldri den samme to ganger på rad, og høyst fem per gruppe på 80 ms. */
  play(group: string, o: PlayOpts = {}): Voice | null {
    if (!this.on || !this.ctx || !this.out) return null;
    const L = this.groups[group];
    if (!L) return null;
    const ready = L.filter((k) => this.buf.has(k));
    if (!ready.length) return null;
    let k = o.name && this.buf.has(o.name) ? o.name : ready[Math.floor(Math.random() * ready.length)];
    if (!o.name && ready.length > 1 && k === this.last[group]) k = ready[(ready.indexOf(k) + 1) % ready.length];
    this.last[group] = k;
    const c = this.ctx;
    const t = Math.max(c.currentTime, o.t ?? 0);
    const A = (this.recent[group] ??= []);
    while (A.length && A[0] < t - 0.08) A.shift();
    if (!o.loop && A.length >= 5) return null;
    A.push(t);
    this.played[group] = (this.played[group] ?? 0) + 1;
    return this.playFile(k, o, t);
  }

  /** Et stemt instrument på en MIDI-tone: varianten med nærmeste grunntone, spilt raskere eller saktere. */
  note(group: string, midi: number, o: PlayOpts = {}): Voice | null {
    const L = (this.groups[group] ?? []).filter((k) => this.buf.has(k));
    if (!L.length) return null;
    let best = L[0];
    for (const k of L) if (Math.abs((this.meta[k].rot ?? midi) - midi) < Math.abs((this.meta[best].rot ?? midi) - midi)) best = k;
    const root = this.meta[best].rot ?? midi;
    return this.play(group, { ...o, name: best, pitch: (o.pitch ?? 1) * Math.pow(2, (midi - root) / 12) });
  }

  /** Spill en bestemt fil. */
  playFile(k: string, o: PlayOpts, t = this.ctx?.currentTime ?? 0): Voice | null {
    const c = this.ctx;
    const b = this.buf.get(k);
    if (!c || !b || !this.out) return null;
    const m = this.meta[k];
    const lead = this.lead.get(k) ?? 0;
    const loopPts = Array.isArray(m?.sloyfe) ? m.sloyfe : null;
    const src = c.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = o.pitch ?? 1;
    let node: AudioNode = src;
    let lp: BiquadFilterNode | null = null;
    let pan: StereoPannerNode | null = null;
    if (o.lp) {
      lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      lp.Q.value = 0.5;
      node.connect(lp);
      node = lp;
    }
    const g = c.createGain();
    node.connect(g);
    node = g;
    if (o.pan !== undefined && c.createStereoPanner) {
      pan = c.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(pan);
      node = pan;
    }
    node.connect(o.out ?? this.out);
    const v = Math.max(0.0001, o.vol ?? 1);
    const a = o.a ?? 0;
    if (a > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + a);
    } else g.gain.setValueAtTime(v, t);
    let from = lead + (o.from ?? 0);
    if (o.loop && loopPts) {
      src.loop = true;
      src.loopStart = lead + loopPts[0];
      src.loopEnd = lead + loopPts[1];
      // Stemningen starter et tilfeldig sted i sløyfa, så to brett ikke høres helt like ut
      if (o.randomStart) from = lead + loopPts[0] + Math.random() * (loopPts[1] - loopPts[0]);
    } else if (o.loop) src.loop = true;
    src.start(t, Math.max(0, Math.min(from, b.duration - 0.01)));
    if (o.d) {
      const rel = Math.min(o.rel ?? 0.15, o.d * 0.5);
      g.gain.setValueAtTime(v, t + Math.max(a, o.d - rel));
      g.gain.linearRampToValueAtTime(0.0001, t + o.d);
      src.stop(t + o.d + 0.03);
    }
    src.onended = () => {
      try {
        g.disconnect();
        pan?.disconnect();
      } catch {
        /* allerede frakoblet */
      }
    };
    let stopped = false;
    return {
      src, g, lp, pan, name: k,
      stop(fade = 0.3) {
        if (stopped) return;
        stopped = true;
        const n = c.currentTime;
        try {
          g.gain.cancelScheduledValues(n);
          g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), n);
          g.gain.linearRampToValueAtTime(0.0001, n + fade);
          src.stop(n + fade + 0.05);
        } catch {
          /* allerede stoppet */
        }
      },
    };
  }
}

/** Stillheten foran: første prøve over en prosent av toppen i starten, minus litt til anslaget. */
function measureLead(b: AudioBuffer) {
  const d = b.getChannelData(0);
  const n = Math.min(d.length, Math.floor(b.sampleRate * 0.5));
  let top = 0;
  for (let i = 0; i < n; i++) top = Math.max(top, Math.abs(d[i]));
  const th = Math.max(0.0008, top * 0.01);
  const max = Math.min(n, Math.floor(b.sampleRate * 0.12));
  for (let i = 0; i < max; i++) if (Math.abs(d[i]) > th) return Math.max(0, i - Math.floor(b.sampleRate * 0.0015)) / b.sampleRate;
  return 0;
}
