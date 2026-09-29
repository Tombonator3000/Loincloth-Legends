// Farer i brettene. Fiender som slås eller kastes inn i en fare dør på en passende (teit) måte.
// Heltene tar skade og spretter ut igjen. Nye farer: legg til en type her, tegning i gfx/env/hazards.ts
// og effekt i game/hazards.ts.

export type HazardKind = 'spikes' | 'bog' | 'icehole' | 'lava' | 'spiketrap';

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
}

export const HAZARDS: Record<HazardKind, HazardInfo> = {
  spikes: { name: 'SPIKE PIT', heroDmg: 16, words: ['IMPALED!', 'SHISH KEBAB!', 'POINTY!'], ouch: ['OUCH! POINTY!', 'MY BUNS!'], foesAvoid: true },
  bog: { name: 'SUCKING BOG', heroDmg: 10, words: ['GLUG GLUG!', 'SWAMPED!', 'BOG-STANDARD DEATH!'], ouch: ['EW! EW! EW!', 'IT\'S IN MY LOINCLOTH!'], foesAvoid: true },
  icehole: { name: 'ICE HOLE', heroDmg: 12, words: ['SPLASH!', 'FROZEN SOLID!', 'CHILLED!'], ouch: ['COLD! COLD! COLD!', 'MY EVERYTHING IS FROZEN!'], foesAvoid: true },
  lava: { name: 'LAVA POOL', heroDmg: 22, words: ['EXTRA CRISPY!', 'WELL DONE!', 'FLAMBE!'], ouch: ['HOT HOT HOT!', 'MY LOINCLOTH IS ON FIRE!'], foesAvoid: true },
  spiketrap: { name: 'SPIKE TRAP', heroDmg: 18, words: ['IMPALED!', 'SPIKED!', 'FLOOR SPIKES OF DOOM!'], ouch: ['WHO PUTS SPIKES IN A FLOOR?!', 'OUCH!'], foesAvoid: false },
};

/** Kort hjelper for nivådata: h('lava', 30, -2, 3, 1.2). */
export const hz = (kind: HazardKind, x: number, z: number, w: number, d: number): HazardDef => ({ kind, x, z, w, d });
