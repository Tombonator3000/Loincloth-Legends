export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const chance = (p: number) => Math.random() < p;
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
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
  let r = Math.random() * total;
  for (const k in w) {
    r -= w[k] ?? 0;
    if (r <= 0) return k;
  }
  return Object.keys(w)[0] as T;
}
