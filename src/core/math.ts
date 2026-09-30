export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Tilfeldige tall. Til vanlig Math.random, men mens et brett bygges går de gjennom et fast frø (withSeed), så
// pynten havner på samme sted hver gang og brettverkstedet viser det spillet viser (docs/PLAN_BRETT_GORR_AI.md).
let rng: () => number = Math.random;
/** Et tall i [0, 1) fra gjeldende kilde (fast frø under bygging av brett). */
export const random = () => rng();
export const rand = (a = 0, b = 1) => a + rng() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const chance = (p: number) => rng() < p;
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/** Liten, rask generator med frø (mulberry32). Samme frø gir samme tallrekke. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Frø fra en tekst (FNV-1a), for eksempel brettets id. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Kjør fn med fast frø: rand, pick, chance og random gir samme rekke hver gang. */
export function withSeed<T>(seed: number, fn: () => T): T {
  const prev = rng;
  rng = seeded(seed);
  try {
    return fn();
  } finally {
    rng = prev;
  }
}

/**
 * Kjør fn uten frøet. Til teksturer og annet som lages første gang og så gjenbrukes: ellers ville det spist tall fra
 * frøet bare første gang brettet bygges, og pynten havnet et annet sted neste gang.
 */
export function unseeded<T>(fn: () => T): T {
  const prev = rng;
  rng = Math.random;
  try {
    return fn();
  } finally {
    rng = prev;
  }
}

/** Nytt frø midt i byggingen (per generator), så en generator som slås av ikke flytter pynten i de neste. */
export function reseed(seed: number) {
  if (rng !== Math.random) rng = seeded(seed);
}
export const sign = (v: number) => (v < 0 ? -1 : 1);

/** Frame-rate uavhengig demping mot et mål. */
export const damp = (cur: number, target: number, speed: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-speed * dt));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Velg vektet tilfeldig nøkkel. */
export function weighted<T extends string>(w: Partial<Record<T, number>>): T {
  let total = 0;
  for (const k in w) total += w[k] ?? 0;
  let r = rng() * total;
  for (const k in w) {
    r -= w[k] ?? 0;
    if (r <= 0) return k;
  }
  return Object.keys(w)[0] as T;
}
