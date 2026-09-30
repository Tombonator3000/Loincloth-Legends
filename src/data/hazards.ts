// Farer i brettene. Fiender som slås eller kastes inn i en fare dør på en passende (teit) måte.
// Heltene tar skade og spretter ut igjen. Nye farer: legg til en type her, tegning i gfx/env/hazards.ts
// og effekt i game/hazards.ts.

export type HazardKind = 'spikes' | 'bog' | 'icehole' | 'lava' | 'spiketrap' | 'chasm';

export interface HazardDef {
  kind: HazardKind;
  /** Midtpunkt langs brettet. */
  x: number;
  /** Midtpunkt i dybden (-2.6 bak til 2.6 foran). */
  z: number;
  /** Bredde (x) og dybde (z). */
  w: number;
  d: number;
}

export interface HazardInfo {
  name: string;
  /** Skade på helter som går eller havner i faren. */
  heroDmg: number;
  /** Tekst når en fiende dør i faren. */
  words: string[];
  /** Hva helten roper når han går i den selv. */
  ouch: string[];
  /** Går fiender rundt den (true) eller rett i den? */
  foesAvoid: boolean;
  /** Ingen kan gå inn i den (juvet): alle som går, stoppes ved kanten uten skade. Bare fiender som kastes eller slås inn, faller. */
  blocks?: boolean;
}

export const HAZARDS: Record<HazardKind, HazardInfo> = {
  spikes: { name: 'SPIKE PIT', heroDmg: 16, words: ['IMPALED!', 'SHISH KEBAB!', 'POINTY!'], ouch: ['OUCH! POINTY!', 'MY BUNS!'], foesAvoid: true },
  bog: { name: 'SUCKING BOG', heroDmg: 10, words: ['GLUG GLUG!', 'SWAMPED!', 'BOG-STANDARD DEATH!'], ouch: ['EW! EW! EW!', 'IT\'S IN MY LOINCLOTH!'], foesAvoid: true },
  icehole: { name: 'ICE HOLE', heroDmg: 12, words: ['SPLASH!', 'FROZEN SOLID!', 'CHILLED!'], ouch: ['COLD! COLD! COLD!', 'MY EVERYTHING IS FROZEN!'], foesAvoid: true },
  lava: { name: 'LAVA POOL', heroDmg: 22, words: ['EXTRA CRISPY!', 'WELL DONE!', 'FLAMBE!'], ouch: ['HOT HOT HOT!', 'MY LOINCLOTH IS ON FIRE!'], foesAvoid: true },
  spiketrap: { name: 'SPIKE TRAP', heroDmg: 18, words: ['IMPALED!', 'SPIKED!', 'FLOOR SPIKES OF DOOM!'], ouch: ['WHO PUTS SPIKES IN A FLOOR?!', 'OUCH!'], foesAvoid: false },
  chasm: { name: 'THE GORGE', heroDmg: 0, words: ['SEE YOU NEVER!', 'LONG WAY DOWN!', 'GRAVITY WINS!', 'MIND THE GAP!'], ouch: [], foesAvoid: true, blocks: true },
};

/**
 * Juvet langs bakkanten av veien: hullet går fra forkanten (z + d/2) og bakover forbi veikanten til CHASM_BACK.
 * Miljøet lager hullet i bakken og veien, og faren tegner veggene ned i dypet (gfx/env/hazards.ts).
 */
export const CHASM_BACK = -5.2;
/** Taugjerdet står så langt foran forkanten, og de som går, stopper så langt foran, altså foran gjerdet. */
export const CHASM_FENCE = 0.14;
export const CHASM_STOP = 0.45;
export interface Hole { x0: number; x1: number; z0: number; z1: number }
export const chasmHole = (d: HazardDef): Hole => ({ x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: CHASM_BACK, z1: d.z + d.d / 2 });

/** Kort hjelper for nivådata: h('lava', 30, -2, 3, 1.2). */
export const hz = (kind: HazardKind, x: number, z: number, w: number, d: number): HazardDef => ({ kind, x, z, w, d });
