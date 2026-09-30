// Brettfiler fra brettverkstedet (STAGE FORGE): rekvisitter i lag, rader, generatorbrytere og (valgfritt) spilldata.
// Filene ligger i src/data/layouts/<brett>.json og leses av Stage og editoren. levels.ts beholder navn, musikk, biom,
// intro og finale. Står bølger, tønner, farer eller ryttere i brettfila, gjelder de. Se docs/PLAN_BRETT_GORR_AI.md.
import type { LevelDef, SpawnDef, WaveDef } from './levels';
import type { HazardDef, HazardKind } from './hazards';
import type { PickKind } from '../game/items';

/** Lagene er områder i dybden (z) i den ekte 3D-scenen. Kamplinja er z = 0, kameraet står på z 11,4. */
export type LayerId = 'far' | 'back' | 'mid' | 'front';
export const LAYER_IDS: LayerId[] = ['far', 'back', 'mid', 'front'];
export const LAYERS: Record<LayerId, { label: string; z: [number, number]; def: number; hint: string }> = {
  far: { label: 'FAR', z: [-120, -40], def: -60, hint: 'SKYLINE AND DISTANT SHAPES. SLOW PARALLAX.' },
  back: { label: 'BACK', z: [-40, -4], def: -7.5, hint: 'BEHIND THE ROAD: PALISADES, TENTS, TREES.' },
  mid: { label: 'MID', z: [-4, 4], def: -3.4, hint: 'THE FIGHT LANE AND ITS EDGES. KEEP THE LANE CLEAR.' },
  front: { label: 'FRONT', z: [3, 9.5], def: 7, hint: 'BETWEEN THE FIGHT AND THE CAMERA. FADES WHEN SOMEONE IS BEHIND.' },
};
/** Figurene går mellom disse (Z_MIN/Z_MAX i game/stage.ts). */
export const LANE_Z: [number, number] = [-2.6, 2.6];

/**
 * Animasjoner på en rekvisitt. Flere kan kombineres (for eksempel bildeserie og sving).
 * - sway: vinden bøyer toppen (samme vind som trærne)
 * - swing: pendel rundt et punkt i bildet (pivot, 0..1 fra venstre og fra toppen), amount i grader
 * - bob: duver opp og ned, amount i meter
 * - spin: roterer rundt pivot, speed i omdreininger per sekund (vannhjul, vindmølle)
 * - flicker: lysstyrken blafrer (fakkel, lykt). light gir et ekte punktlys med den fargen.
 * - sheet: bildeserie i ett bilde (n ruter i et rutenett grid [kolonner, rader], fps)
 * - track: nøkkelspor [[t, verdi], ...] med t fra 0 til 1 over dur sekunder og myk overgang (etter POSER i
 *   Morbidium). Kanaler: x og y (meter), rot (grader), sx og sy (skala), alpha (0..1).
 * - wave: duken bølger ut fra en fast kant (from: left, right eller top), amount i meter, length er bølgelengden i
 *   andeler av bildet. Til flagg, bannere, kapper og tøy på snor. Bildet deles opp så bølgen blir myk.
 * - pulse: puster (skala) og gløder i takt: amount er andel av størrelsen, glow andel lysstyrke
 * - drift: glir sakte sidelengs (speed i meter per sekund) over range meter og kommer inn igjen fra andre siden,
 *   med toning i endene (skyer, tåkebanker, fugleflokker langt borte)
 * - react: svarer på det som skjer: on near (en figur innenfor radius), hit (treff, kast og bakkeslag i nærheten)
 *   eller any. effect shake (rister, amount i grader), hop (hopper, amount i meter), spin (snurrer amount runder)
 *   eller flee (flyr eller løper vekk og kommer tilbake etter back sekunder, som kråker)
 */
export type PropAnim =
  | { type: 'sway'; amount?: number; speed?: number }
  | { type: 'swing'; amount?: number; speed?: number; pivot?: [number, number] }
  | { type: 'bob'; amount?: number; speed?: number }
  | { type: 'spin'; speed?: number; pivot?: [number, number] }
  | { type: 'flicker'; amount?: number; speed?: number; light?: string; intensity?: number; range?: number; at?: [number, number] }
  | { type: 'sheet'; n: number; grid: [number, number]; fps?: number; mode?: 'loop' | 'pingpong' | 'once' }
  | { type: 'track'; dur: number; loop?: boolean; keys: Partial<Record<TrackChannel, [number, number][]>> }
  | { type: 'wave'; amount?: number; speed?: number; length?: number; from?: WaveFrom }
  | { type: 'pulse'; amount?: number; speed?: number; glow?: number }
  | { type: 'drift'; speed?: number; range?: number }
  | { type: 'react'; on?: ReactOn; radius?: number; effect?: ReactEffect; amount?: number; dur?: number; back?: number };
export type PropAnimType = PropAnim['type'];
export const ANIM_TYPES: PropAnimType[] = ['sway', 'swing', 'bob', 'spin', 'flicker', 'sheet', 'track', 'wave', 'pulse', 'drift', 'react'];
export type WaveFrom = 'left' | 'right' | 'top';
export const WAVE_FROM: WaveFrom[] = ['left', 'right', 'top'];
export type ReactOn = 'near' | 'hit' | 'any';
export const REACT_ON: ReactOn[] = ['near', 'hit', 'any'];
export type ReactEffect = 'shake' | 'hop' | 'spin' | 'flee';
export const REACT_EFFECTS: ReactEffect[] = ['shake', 'hop', 'spin', 'flee'];
export type TrackChannel = 'x' | 'y' | 'rot' | 'sx' | 'sy' | 'alpha';
export const TRACK_CHANNELS: TrackChannel[] = ['x', 'y', 'rot', 'sx', 'sy', 'alpha'];

/**
 * En del i et sett: legges ut sammen med rekvisitten og henges på den (parent). dx, dy og dz er meter fra
 * rekvisittens fotpunkt i dens egen retning (før skala og speilvending), scale og flip i forhold til den.
 */
export interface PresetPart {
  prop: string;
  dx: number;
  dy: number;
  dz?: number;
  scale?: number;
  flip?: boolean;
  rot?: number;
  anim?: PropAnim[];
  /** Henger på en annen del i settet (nummeret i lista, en del før denne) i stedet for på rekvisitten: flammen i lykta. */
  on?: number;
}

/** Én rekvisitt på brettet. */
export interface PropPlacement {
  /** Unik i fila (p1, p2, ...). */
  id: string;
  /** Navnet i rekvisittkatalogen (manifestet, de malte plassholderne eller 3D-rekvisittene). */
  prop: string;
  /**
   * Del av en annen rekvisitt (id i samme fil): delen henger på leddet dens og følger animasjonene (et skilt på en
   * stolpe, bladene på en vindmølle, kronen på et tre). x, y og z er likevel plassen i verden.
   */
  parent?: string;
  layer: LayerId;
  x: number;
  /** Høyde over bakken (0 = står på bakken). */
  y?: number;
  z: number;
  scale?: number;
  flip?: boolean;
  /** Vridning i grader: rot rundt synslinja (skråstilt), yaw rundt loddlinja (vendt litt inn). */
  rot?: number;
  yaw?: number;
  /** Fargetone, '#rrggbb'. */
  tint?: string;
  /** Overstyrer katalogens animasjoner. En tom liste betyr ingen animasjon. */
  anim?: PropAnim[];
  /** FRONT: tones ut når figurer står bak (standard på i FRONT). */
  fade?: boolean;
  /** Mørkning 0..1 (standard 0,35 i FRONT, ellers 0). */
  dark?: number;
  /** Kaster skygge (standard fra katalogen). */
  shadow?: boolean;
  /** Editoren: kan ikke velges med musa. */
  locked?: boolean;
}

/** En rad av samme rekvisitt langs brettet (palisade, gjerde, gresstuer). */
export interface PropRun {
  id: string;
  prop: string;
  /** Flere varianter å blande inn (trekkes med radens frø, så raden blir lik hver gang). */
  variants?: string[];
  layer: LayerId;
  x0: number;
  x1: number;
  z: number;
  y?: number;
  /** Avstand mellom hver. */
  step: number;
  /** Tilfeldig forskyvning langs x (meter), i dybden (meter) og skala (andel). */
  jitter?: number;
  zJitter?: number;
  scaleJitter?: number;
  scale?: number;
  /** Speilvend annenhver tilfeldig. */
  flipRandom?: boolean;
  /** Åpninger [fra, til] uten rekvisitter. */
  gaps?: [number, number][];
  tint?: string;
  anim?: PropAnim[];
  dark?: number;
  fade?: boolean;
  shadow?: boolean;
  seed?: number;
}

/** Bølge i brettfila: spawns i samme korte form som levels.ts ("skeleton:R:0.2 hogman:L:1.0"). */
export interface LayoutWave {
  at: number;
  maxAlive: number;
  title?: string;
  say?: [string, string];
  spawns: string;
}

export interface LevelLayout {
  version: 1;
  level: string;
  /** Frø for pynten fra generatorene (ellers brettets id). */
  seed?: number;
  /** Generatorer som er slått av (false): trær, gress, palisade, silhuetter osv. Navnene står i editoren. */
  generators?: Record<string, boolean>;
  props: PropPlacement[];
  runs?: PropRun[];
  // Spilldata. Mangler et felt, gjelder levels.ts.
  length?: number;
  waves?: LayoutWave[];
  barrels?: [number, string][];
  hazards?: HazardDef[];
  riders?: [number, string, string][];
}

export function emptyLayout(level: string): LevelLayout {
  return { version: 1, level, props: [], runs: [] };
}

/** Rekvisittene brettfila bruker (kulisser, rader og variantene i radene). Bildene til disse hentes ved oppstart. */
export function layoutPropIds(l: LevelLayout): string[] {
  const ids = new Set<string>();
  for (const p of l.props ?? []) ids.add(p.prop);
  for (const r of l.runs ?? []) {
    ids.add(r.prop);
    for (const v of r.variants ?? []) ids.add(v);
  }
  return [...ids];
}

/** Standardverdier for et lag: mørkning og toning. */
export function layerDefaults(layer: LayerId) {
  return { fade: layer === 'front', dark: layer === 'front' ? 0.35 : 0 };
}

// ---------------------------------------------------------------- bølger som tekst
/** "skeleton:R:0.2 hogman:L:1.0" til liste. */
export function parseSpawns(list: string): SpawnDef[] {
  return list.split(/\s+/).filter(Boolean).map((s) => {
    const [foe, side, delay] = s.split(':');
    return { foe, side: side === 'L' ? 'L' : 'R', delay: Number(delay) || 0 };
  });
}
export function spawnsToString(spawns: SpawnDef[]): string {
  return spawns.map((s) => `${s.foe}:${s.side}:${+s.delay.toFixed(2)}`).join(' ');
}
export function waveToLayout(w: WaveDef): LayoutWave {
  const o: LayoutWave = { at: w.at, maxAlive: w.maxAlive, spawns: spawnsToString(w.spawns) };
  if (w.title) o.title = w.title;
  if (w.say) o.say = w.say;
  return o;
}
export function waveFromLayout(w: LayoutWave): WaveDef {
  const o: WaveDef = { at: w.at, maxAlive: w.maxAlive, spawns: parseSpawns(w.spawns) };
  if (w.title) o.title = w.title;
  if (w.say) o.say = w.say;
  return o;
}

/** Brettet slik spillet skal bruke det: levels.ts med spilldataene fra brettfila oppå. */
export function levelWithLayout(def: LevelDef, layout: LevelLayout | null | undefined): LevelDef {
  if (!layout) return def;
  const out: LevelDef = { ...def };
  if (layout.length !== undefined) out.length = layout.length;
  if (layout.waves) out.waves = layout.waves.map(waveFromLayout);
  if (layout.barrels) out.barrels = layout.barrels.map(([x, k]) => [x, k as PickKind | 'gold']);
  if (layout.hazards) out.hazards = layout.hazards.map((h) => ({ ...h }));
  if (layout.riders) out.riders = layout.riders.map((r) => [...r] as [number, string, string]);
  return out;
}

// ---------------------------------------------------------------- kontroll
const HAZARD_KINDS: HazardKind[] = ['spikes', 'bog', 'icehole', 'lava', 'spiketrap', 'chasm'];
const PICK_KINDS = ['coin', 'chicken', 'potion', 'ham', 'egg', 'gold'];
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/**
 * Sjekk en brettfil. Gir en liste med feil (tom når fila er i orden). known = rekvisittnavnene i katalogen
 * (utelat for å hoppe over den sjekken), foes = fiende-id-ene.
 */
export function validateLayout(l: unknown, known?: Set<string>, foes?: Set<string>): string[] {
  const err: string[] = [];
  if (!l || typeof l !== 'object') return ['not an object'];
  const o = l as Partial<LevelLayout>;
  if (o.version !== 1) err.push('version must be 1');
  if (typeof o.level !== 'string' || !o.level) err.push('level missing');
  if (!Array.isArray(o.props)) err.push('props must be a list');
  const ids = new Set<string>();
  const checkAnim = (where: string, a: unknown) => {
    if (a === undefined) return;
    if (!Array.isArray(a)) return err.push(`${where}: anim must be a list`);
    for (const x of a as PropAnim[]) {
      if (!x || !ANIM_TYPES.includes(x.type)) err.push(`${where}: unknown animation ${JSON.stringify(x)}`);
      else if (x.type === 'sheet' && (!(x.n > 0) || !Array.isArray(x.grid) || x.grid[0] * x.grid[1] < x.n)) err.push(`${where}: sheet needs n and a grid with room for n frames`);
      else if (x.type === 'track' && (!(x.dur > 0) || typeof x.keys !== 'object')) err.push(`${where}: track needs dur and keys`);
      else if (x.type === 'wave' && x.from !== undefined && !WAVE_FROM.includes(x.from)) err.push(`${where}: wave from must be ${WAVE_FROM.join(', ')}`);
      else if (x.type === 'react' && ((x.on !== undefined && !REACT_ON.includes(x.on)) || (x.effect !== undefined && !REACT_EFFECTS.includes(x.effect)))) err.push(`${where}: react needs on (${REACT_ON.join(', ')}) and effect (${REACT_EFFECTS.join(', ')})`);
    }
  };
  for (const p of (o.props ?? []) as PropPlacement[]) {
    const where = `prop ${p?.id ?? '?'}`;
    if (!p || typeof p.id !== 'string' || !p.id) { err.push('a prop has no id'); continue; }
    if (ids.has(p.id)) err.push(`${where}: duplicate id`);
    ids.add(p.id);
    if (typeof p.prop !== 'string') err.push(`${where}: prop name missing`);
    else if (known && !known.has(p.prop)) err.push(`${where}: unknown prop "${p.prop}"`);
    if (!LAYER_IDS.includes(p.layer)) err.push(`${where}: unknown layer ${p.layer}`);
    if (!num(p.x) || !num(p.z)) err.push(`${where}: x and z must be numbers`);
    if (p.y !== undefined && !num(p.y)) err.push(`${where}: y must be a number`);
    if (p.scale !== undefined && !(num(p.scale) && p.scale > 0)) err.push(`${where}: scale must be above 0`);
    if (p.tint !== undefined && !/^#[0-9a-fA-F]{6}$/.test(p.tint)) err.push(`${where}: tint must be #rrggbb`);
    checkAnim(where, p.anim);
  }
  // Deler: forelderen må finnes, og ingen ring (a er del av b som er del av a)
  const byId = new Map(((o.props ?? []) as PropPlacement[]).filter((p) => p && typeof p.id === 'string').map((p) => [p.id, p]));
  for (const p of byId.values()) {
    if (p.parent === undefined) continue;
    if (!byId.has(p.parent)) err.push(`prop ${p.id}: parent "${p.parent}" is not a prop in this file`);
    const seen = new Set<string>([p.id]);
    for (let q = byId.get(p.parent); q; q = q.parent !== undefined ? byId.get(q.parent) : undefined) {
      if (seen.has(q.id)) {
        err.push(`prop ${p.id}: parents go in a circle`);
        break;
      }
      seen.add(q.id);
    }
  }
  for (const r of (o.runs ?? []) as PropRun[]) {
    const where = `run ${r?.id ?? '?'}`;
    if (!r || typeof r.id !== 'string' || !r.id) { err.push('a run has no id'); continue; }
    if (ids.has(r.id)) err.push(`${where}: duplicate id`);
    ids.add(r.id);
    if (known && !known.has(r.prop)) err.push(`${where}: unknown prop "${r.prop}"`);
    if (r.variants !== undefined && (!Array.isArray(r.variants) || r.variants.some((v) => typeof v !== 'string'))) err.push(`${where}: variants must be a list of prop names`);
    else for (const v of r.variants ?? []) if (known && !known.has(v)) err.push(`${where}: unknown variant "${v}"`);
    if (!LAYER_IDS.includes(r.layer)) err.push(`${where}: unknown layer ${r.layer}`);
    if (!num(r.x0) || !num(r.x1) || !num(r.z) || !(num(r.step) && r.step > 0.05)) err.push(`${where}: x0, x1, z and step (above 0.05) must be numbers`);
    checkAnim(where, r.anim);
  }
  if (o.generators !== undefined && (typeof o.generators !== 'object' || Object.values(o.generators).some((v) => typeof v !== 'boolean'))) err.push('generators must be names with true or false');
  if (o.length !== undefined && !(num(o.length) && o.length >= 30)) err.push('length must be at least 30');
  for (const w of o.waves ?? []) {
    if (!num(w.at) || !num(w.maxAlive)) err.push('a wave needs at and maxAlive');
    for (const s of parseSpawns(w.spawns ?? '')) if (foes && !foes.has(s.foe)) err.push(`wave at ${w.at}: unknown foe "${s.foe}"`);
  }
  for (const b of o.barrels ?? []) if (!Array.isArray(b) || !num(b[0]) || !PICK_KINDS.includes(b[1])) err.push(`barrel ${JSON.stringify(b)}: needs [x, ${PICK_KINDS.join('|')}]`);
  for (const h of o.hazards ?? []) if (!HAZARD_KINDS.includes(h.kind) || !num(h.x) || !num(h.z) || !num(h.w) || !num(h.d)) err.push(`hazard ${JSON.stringify(h)}: needs kind, x, z, w and d`);
  for (const r of o.riders ?? []) if (!Array.isArray(r) || !num(r[0]) || (foes && !foes.has(r[1]))) err.push(`rider ${JSON.stringify(r)}: needs [wave, foe, mount]`);
  return err;
}

/** Rekkefølgen på feltene når fila lagres, så endringer er lette å lese i git. */
const PROP_KEYS: (keyof PropPlacement)[] = ['id', 'prop', 'parent', 'layer', 'x', 'y', 'z', 'scale', 'flip', 'rot', 'yaw', 'tint', 'dark', 'fade', 'shadow', 'locked', 'anim'];
const RUN_KEYS: (keyof PropRun)[] = ['id', 'prop', 'variants', 'layer', 'x0', 'x1', 'z', 'y', 'step', 'jitter', 'zJitter', 'scale', 'scaleJitter', 'flipRandom', 'gaps', 'tint', 'dark', 'fade', 'shadow', 'seed', 'anim'];
const round = (v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
function ordered<T extends object>(o: T, keys: (keyof T)[]): T {
  const out = {} as T;
  for (const k of keys) if (o[k] !== undefined) (out as Record<string, unknown>)[k as string] = round(o[k]);
  return out;
}

/** Brettfila som tekst: fast rekkefølge, avrundede tall, én rekvisitt per linje. */
export function layoutToJson(l: LevelLayout): string {
  const head: Record<string, unknown> = { version: 1, level: l.level };
  if (l.seed !== undefined) head.seed = l.seed;
  if (l.generators && Object.keys(l.generators).length) head.generators = l.generators;
  if (l.length !== undefined) head.length = l.length;
  const lines: string[] = ['{'];
  const entries = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const list = (name: string, items: unknown[]) => `  ${JSON.stringify(name)}: [` + (items.length ? '\n' + items.map((i) => '    ' + JSON.stringify(i)).join(',\n') + '\n  ]' : ']');
  entries.push(list('props', l.props.map((p) => ordered(p, PROP_KEYS))));
  entries.push(list('runs', (l.runs ?? []).map((r) => ordered(r, RUN_KEYS))));
  if (l.waves) entries.push(list('waves', l.waves));
  if (l.barrels) entries.push(list('barrels', l.barrels));
  if (l.hazards) entries.push(list('hazards', l.hazards));
  if (l.riders) entries.push(list('riders', l.riders));
  lines.push(entries.join(',\n'));
  lines.push('}');
  return lines.join('\n') + '\n';
}
