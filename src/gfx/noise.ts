// Støy for prosedyrelagde teksturer og geometri. Periodisk gradientstøy og cellestøy (Worley) går i ett ved
// kantene, så teksturene kan flislegges uten synlige skjøter. 3D-verdistøy brukes til å forme steiner og bein.

/** Liten deterministisk tilfeldighetsgenerator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Periodisk gradientstøy (Perlin) i planet. Verdier omtrent -1 til 1. */
export function periodicNoise(seed = 1) {
  const r = rng(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  /** x og y i gitterenheter, periode per (heltall) i begge retninger. */
  return (x: number, y: number, per: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per;
    const x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    const h = (a: number, b: number) => perm[perm[a & 255] + (b & 255)];
    const d = (hh: number, dx: number, dy: number) => gx[hh] * dx + gy[hh] * dy;
    const u = fade(xf), v = fade(yf);
    const n00 = d(h(x0, y0), xf, yf), n10 = d(h(x1, y0), xf - 1, yf);
    const n01 = d(h(x0, y1), xf, yf - 1), n11 = d(h(x1, y1), xf - 1, yf - 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.4;
  };
}

export type Noise2 = ReturnType<typeof periodicNoise>;

/** Fraktal støy (fBm) på en flis: u og v fra 0 til 1, base = antall celler i grovest oktav. */
export function fbm(n: Noise2, u: number, v: number, base: number, octaves = 5, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, per = base;
  for (let o = 0; o < octaves; o++) {
    sum += n(u * per, v * per, per) * amp;
    norm += amp;
    amp *= gain;
    per *= 2;
  }
  return sum / norm;
}

/** Periodisk cellestøy: avstand til nærmeste og nest nærmeste punkt, og hvilken celle (id 0 til 1). */
export function worley(seed = 1) {
  const r = rng(seed);
  const pts = new Map<number, Float32Array>();
  const grid = (n: number) => {
    let g = pts.get(n);
    if (!g) {
      g = new Float32Array(n * n * 3);
      for (let i = 0; i < n * n; i++) {
        g[i * 3] = r();
        g[i * 3 + 1] = r();
        g[i * 3 + 2] = r();
      }
      pts.set(n, g);
    }
    return g;
  };
  const out = { f1: 0, f2: 0, id: 0 };
  /**
   * u og v fra 0 til 1, n celler bortover og m oppover (m = n gir kvadratiske celler på en kvadratisk flis).
   * Avstandene er i celleenheter. Returnerer samme objekt hver gang (ikke ta vare på det).
   */
  return (u: number, v: number, n: number, m = n) => {
    const g = grid(Math.max(n, m));
    const x = u * n, y = v * m;
    const cx = Math.floor(x), cy = Math.floor(y);
    let f1 = 1e9, f2 = 1e9, id = 0;
    const stride = Math.max(n, m);
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j;
        const wx = ((gx % n) + n) % n, wy = ((gy % m) + m) % m;
        const k = (wy * stride + wx) * 3;
        const dx = gx + g[k] - x, dy = gy + g[k + 1] - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = g[k + 2];
        } else if (d < f2) f2 = d;
      }
    out.f1 = f1;
    out.f2 = f2;
    out.id = id;
    return out;
  };
}

/** 3D-verdistøy for å forme geometri (steiner, bein). Verdier 0 til 1. */
export function valueNoise3(seed = 1) {
  const hash = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
    return s - Math.floor(s);
  };
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const c = (i: number, j: number, k: number) => hash(xi + i, yi + j, zi + k);
    const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf), x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
    const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf), x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
    return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
  };
}

export function fbm3(n: ReturnType<typeof valueNoise3>, x: number, y: number, z: number, octaves = 4) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += n(x * f, y * f, z * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}
