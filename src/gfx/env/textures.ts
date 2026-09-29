// Realistiske flisbare teksturer for miljøet, laget med støy (gfx/noise.ts): jord og gress, grusvei med
// hjulspor, murstein, steinfliser, sand, plankeverk og lavastein. Hver tekstur har et normalkart i
// userData.normalMap (og lavastein et glødekart i userData.emissiveMap) som lit() i common.ts tar i bruk.
// Normalkartet deler repeat og offset med fargekartet, så det holder å sette repeat på fargekartet.
import * as THREE from 'three';
import { periodicNoise, worley, fbm, rng } from '../noise';

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  if (h.startsWith('rgba')) {
    const m = h.match(/[\d.]+/g)!.map(Number);
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const sat = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Velg en farge fra lista ut fra t (0 til 1), trygt også når t havner litt utenfor. */
const at = (list: RGB[], t: number) => list[Math.min(list.length - 1, Math.max(0, Math.floor(t * list.length)))];
const smooth = (a: number, b: number, x: number) => {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

interface Px { c: RGB; a: number; h: number; e: number }

/**
 * Bak en tekstur piksel for piksel. f får u og v (0 til 1, v opp) og fyller farge, alfa, høyde og glød.
 * Normalkartet regnes fra høyden med sentrale differanser som går rundt kanten (flisbart).
 */
function bake(w: number, h: number, f: (u: number, v: number, o: Px) => void, normalStrength: number, glow = false) {
  const col = new Uint8Array(w * h * 4);
  const hgt = new Float32Array(w * h);
  const em = glow ? new Uint8Array(w * h * 4) : null;
  const o: Px = { c: [0, 0, 0], a: 1, h: 0, e: 0 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      o.a = 1;
      o.h = 0;
      o.e = 0;
      f((x + 0.5) / w, (y + 0.5) / h, o);
      const i = y * w + x;
      col[i * 4] = Math.round(sat(o.c[0]) * 255);
      col[i * 4 + 1] = Math.round(sat(o.c[1]) * 255);
      col[i * 4 + 2] = Math.round(sat(o.c[2]) * 255);
      col[i * 4 + 3] = Math.round(sat(o.a) * 255);
      hgt[i] = o.h;
      if (em) {
        const e = Math.round(sat(o.e) * 255);
        em[i * 4] = e;
        em[i * 4 + 1] = Math.round(e * 0.42);
        em[i * 4 + 2] = Math.round(e * 0.08);
        em[i * 4 + 3] = 255;
      }
    }
  return finish(col, hgt, w, h, normalStrength, em);
}

/** Fargekart, normalkart fra høyden (flisbart) og eventuelt glødekart, med felles repeat og offset. */
function finish(col: Uint8Array, hgt: Float32Array, w: number, h: number, normalStrength: number, em: Uint8Array | null = null) {
  const nrm = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const at = (xx: number, yy: number) => hgt[((yy + h) % h) * w + ((xx + w) % w)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * normalStrength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * normalStrength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      nrm[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
      nrm[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
      nrm[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      nrm[i + 3] = 255;
    }
  const tex = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const map = tex(col, true);
  const normalMap = tex(nrm, false);
  // Samme repeat og offset som fargekartet, så kallstedene bare trenger å sette repeat én gang
  normalMap.repeat = map.repeat;
  normalMap.offset = map.offset;
  map.userData.normalMap = normalMap;
  if (em) {
    const emissiveMap = tex(em, true);
    emissiveMap.repeat = map.repeat;
    emissiveMap.offset = map.offset;
    map.userData.emissiveMap = emissiveMap;
  }
  return map;
}

let seedN = 7;
const nextSeed = () => (seedN = (seedN * 48271) % 2147483647);

/**
 * Tekstur fra et bilde, for eksempel laget med GPT (se docs/ART_PROMPTS.md). Bildet må være flisbart og jevnt
 * belyst sett rett ovenfra. Høyden gjettes fra lysheten (mørke fuger og sprekker ligger dypt), og normalkartet
 * lages av den. fringe gir ujevn gjennomsiktig kant øverst og nederst, slik veiene trenger. glow lager et
 * glødekart av de lyse rødgule pikslene (lava), og de legges dypt i stedet for høyt.
 */
export function imageTexture(img: HTMLImageElement, fringe = false, glow = false, normalStrength = 3) {
  const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0, w, h);
  const src = c.getImageData(0, 0, w, h).data;
  const n = fringe ? periodicNoise(nextSeed()) : null;
  const col = new Uint8Array(w * h * 4);
  const em = glow ? new Uint8Array(w * h * 4) : null;
  const raw = new Float32Array(w * h);
  // Rad 0 nederst, som i de prosedyrelagde teksturene (DataTexture vendes ikke ved opplasting)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4, i = y * w + x;
      col[i * 4] = src[s];
      col[i * 4 + 1] = src[s + 1];
      col[i * 4 + 2] = src[s + 2];
      let a = src[s + 3];
      if (n) {
        const u = (x + 0.5) / w, v = (y + 0.5) / h;
        a *= smooth(0.035, 0.1, Math.min(v, 1 - v) + fbm(n, u, v, 8, 3) * 0.035);
      }
      col[i * 4 + 3] = Math.round(a);
      raw[i] = (0.299 * src[s] + 0.587 * src[s + 1] + 0.114 * src[s + 2]) / 255;
      if (em) {
        const r = src[s] / 255, b = src[s + 2] / 255;
        const e = smooth(0.5, 0.9, r) * smooth(0.15, 0.45, r - b);
        em[i * 4] = Math.round(src[s] * e);
        em[i * 4 + 1] = Math.round(src[s + 1] * e);
        em[i * 4 + 2] = Math.round(src[s + 2] * e);
        em[i * 4 + 3] = 255;
        raw[i] -= e * 1.2;
      }
    }
  // Litt uskarphet i høyden, så fargestøy ikke blir til knudrete normaler
  const hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) sum += raw[((y + j + h) % h) * w + ((x + i + w) % w)];
      hgt[y * w + x] = sum / 9;
    }
  // Styrken er avstemt mot 512 piksler; større bilder har mindre høydeforskjell per piksel
  return finish(col, hgt, w, h, normalStrength * (w / 512), em);
}

type Cells = ReturnType<typeof worley>;
type Noise = ReturnType<typeof periodicNoise>;
const stone = { h: 0, id: 0 };
/**
 * Steiner med ulik størrelse og form: cellestøy på forvrengte koordinater (så kantene blir ujevne), radius per
 * stein fra celle-id og tetthet mellom 0 og 1. Svaret (h = kuppelhøyde 0 til 1, 0 utenfor) ligger i stone.
 */
function stoneField(cells: Cells, warp: Noise, u: number, v: number, nx: number, ny: number, density: number, rMin: number, rMax: number) {
  const wu = u + (fbm(warp, u, v, 8, 3) * 0.7) / nx;
  const wv = v + (fbm(warp, u + 0.31, v + 0.17, 8, 3) * 0.7) / ny;
  const w = cells(wu, wv, nx, ny);
  const r = rMin + (rMax - rMin) * ((w.id * 7.31) % 1);
  stone.id = w.id;
  stone.h = w.id < density && w.f1 < r ? 1 - w.f1 / r : 0;
  return stone;
}

/** Fin grus: små lyse og mørke korn som støy (ikke prikker på rad). Gir -1, 0 eller 1. */
function gravel(n: Noise, u: number, v: number, per: number) {
  const g = n(u * per, v * per, per);
  return g > 0.5 ? 1 : g < -0.55 ? -1 : 0;
}

/** Jord med flekker, småstein og (valgfritt) gresstrå. Snø når fargene er lyse og blad er null. */
export function groundTexture(base: string, specks: string[], blade: string | null) {
  const n = periodicNoise(nextSeed()), n2 = periodicNoise(nextSeed()), wn = worley(nextSeed());
  const B = hex(base), S = specks.map(hex), G = blade ? hex(blade) : null;
  const pebble = hex('#8a8478');
  return bake(512, 512, (u, v, o) => {
    const big = fbm(n, u, v, 4, 5) * 0.5 + 0.5;
    const mid = fbm(n2, u, v, 16, 4);
    let c = mix(B, at(S, big * 1.2), smooth(0.35, 0.8, big) * 0.7);
    c = mul(c, 1 + mid * 0.16);
    let hh = big * 0.35 + mid * 0.15;
    // Småstein i klynger, ulik størrelse og form, med mørk kant der de møter jorda
    const cluster = smooth(0.35, 0.75, fbm(n2, u + 0.5, v, 3, 3) * 0.5 + 0.5);
    const s = stoneField(wn, n, u, v, 20, 20, 0.12 + cluster * 0.3, 0.1, 0.34);
    if (s.h > 0) {
      const dome = Math.sqrt(s.h);
      c = mix(mul(c, 0.72), mul(mix(pebble, B, 0.3 + s.id * 0.6), 0.8 + s.id * 0.35), smooth(0.05, 0.3, s.h));
      c = mul(c, 0.85 + dome * 0.25);
      hh += dome * 0.9;
    }
    const gr = gravel(n2, u, v, 160);
    c = mul(c, 1 + gr * 0.1);
    hh += gr * 0.05;
    if (G) {
      // Strå: tynne striper i nesten samme retning, lysere i tuppene
      const st = n(u * 96, v * 24, 96) * 0.5 + fbm(n2, u, v, 32, 2) * 0.5;
      const t = smooth(0.05, 0.45, st);
      c = mix(c, mul(G, 0.8 + st * 0.5), t * 0.75);
      hh += t * 0.3;
    }
    o.c = c;
    o.h = hh;
  }, 3.2);
}

/** Grusvei med hjulspor, innstøpte steiner og ujevn kant (alfa). */
export function roadTexture(base: string, specks: string[], rut: string, stones: string[]) {
  const n = periodicNoise(nextSeed()), n2 = periodicNoise(nextSeed()), wn = worley(nextSeed());
  const B = hex(base), S = specks.map(hex), R = hex(rut), ST = stones.map(hex);
  const rutA = rut.startsWith('rgba') ? Number(rut.match(/[\d.]+/g)![3]) : 0.4;
  return bake(512, 256, (u, v, o) => {
    const big = fbm(n, u, v, 4, 5) * 0.5 + 0.5;
    const fine = fbm(n2, u, v, 32, 3);
    let c = mix(B, at(S, big), 0.45);
    c = mul(c, 0.92 + fine * 0.12);
    let hh = big * 0.3 + fine * 0.12;
    // Kanten er ujevn og tynnes ut i gresset
    const edge = Math.min(v, 1 - v) + fbm(n2, u, v, 8, 3) * 0.035;
    o.a = smooth(0.035, 0.1, edge);
    // To hjulspor som slingrer litt
    for (const y0 of [0.36, 0.64]) {
      const d = Math.abs(v - y0 - fbm(n, u, 0.3, 6, 2) * 0.03);
      const k = 1 - smooth(0.02, 0.07, d);
      c = mix(c, mix(c, R, rutA * 1.6), k);
      hh -= k * 0.35;
    }
    // Steiner i veien: noen store, flere små, flest langs kantene og i klynger. Fin grus mellom dem
    const edgeBias = 1 - smooth(0.15, 0.4, Math.min(v, 1 - v));
    const cluster = smooth(0.3, 0.8, fbm(n, u + 0.61, v, 4, 3) * 0.5 + 0.5);
    for (const [nx, ny, dens, r0, r1] of [[14, 7, 0.06 + edgeBias * 0.12, 0.2, 0.36], [34, 17, 0.08 + edgeBias * 0.2 + cluster * 0.2, 0.12, 0.32]] as const) {
      const s = stoneField(wn, n2, u, v, nx, ny, dens, r0, r1);
      if (s.h <= 0) continue;
      const dome = Math.sqrt(s.h);
      const sc = at(ST, (s.id * 997) % 1);
      c = mix(mul(c, 0.7), mul(sc, 0.8 + fine * 0.2 + s.id * 0.2), smooth(0.08, 0.3, s.h));
      c = mul(c, 0.82 + dome * 0.3);
      hh += dome * 0.8;
      break;
    }
    const gr = gravel(n2, u, v, 192);
    c = mul(c, 1 + gr * 0.09);
    hh += gr * 0.05;
    o.c = c;
    o.h = hh;
  }, 3.5);
}

/** Murstein i forband med avskallede kanter, mørk fuge og litt skitt og sot. */
export function stoneTexture(base: string, mortar: string, bw = 64, bh = 32) {
  const n = periodicNoise(nextSeed()), n2 = periodicNoise(nextSeed());
  const B = hex(base), M = hex(mortar);
  const r = rng(nextSeed());
  const tint = Array.from({ length: 64 }, () => (r() - 0.5) * 0.26);
  const size = 256;
  return bake(size, size, (u, v, o) => {
    const x = u * size, y = v * size;
    const row = Math.floor(y / bh);
    const off = row % 2 ? bw / 2 : 0;
    const xx = (((x - off) % size) + size) % size;
    const col = Math.floor(xx / bw);
    const lx = xx - col * bw, ly = y - row * bh;
    const chip = fbm(n2, u, v, 16, 3) * 3.2;
    const d = Math.min(lx, bw - lx, ly, bh - ly) + chip;
    const brick = smooth(1.5, 3.5, d);
    const grain = fbm(n, u, v, 16, 5);
    const stain = fbm(n2, u, v, 3, 3) * 0.5 + 0.5;
    const bc = mul(B, (1 + tint[(row * 7 + col * 13) & 63]) * (0.9 + grain * 0.18) * (0.78 + stain * 0.3));
    const mc = mul(M, 0.85 + grain * 0.2);
    o.c = mix(mc, bc, brick);
    // Avrundet kant på steinen, ru overflate, fugen ligger dypt
    o.h = brick * (smooth(0, 7, d) * 0.9 + grain * 0.25);
  }, 5);
}

/** Steinfliser med avfasede kanter, sprekker og ulik farge per flis. */
export function tileTexture(base: string, grout: string) {
  const n = periodicNoise(nextSeed()), wn = worley(nextSeed());
  const B = hex(base), G = hex(grout);
  const r = rng(nextSeed());
  const tint = Array.from({ length: 16 }, () => (r() - 0.5) * 0.28);
  return bake(256, 256, (u, v, o) => {
    const x = u * 256, y = v * 256;
    const tx = Math.floor(x / 64), ty = Math.floor(y / 64);
    const lx = x - tx * 64, ly = y - ty * 64;
    const d = Math.min(lx, 64 - lx, ly, 64 - ly) + fbm(n, u, v, 16, 2) * 1.5;
    const tile = smooth(2, 4, d);
    const grain = fbm(n, u, v, 12, 5);
    let c = mul(B, (1 + tint[(ty * 4 + tx) & 15]) * (0.9 + grain * 0.16));
    // Sprekker langs celleskiller i noen fliser
    const w = wn(u, v, 10);
    const crack = (ty * 4 + tx) % 3 === 0 ? 1 - smooth(0.0, 0.035, w.f2 - w.f1) : 0;
    c = mul(c, 1 - crack * 0.45);
    o.c = mix(mul(G, 0.9 + grain * 0.2), c, tile);
    o.h = tile * (smooth(0, 6, d) * 0.8 + grain * 0.15 - crack * 0.4);
  }, 4.5);
}

/** Sand med små bølger fra vinden. */
export function sandTexture(base: string, specks: string[]) {
  const n = periodicNoise(nextSeed()), n2 = periodicNoise(nextSeed());
  const B = hex(base), S = specks.map(hex);
  return bake(256, 256, (u, v, o) => {
    const big = fbm(n, u, v, 4, 4) * 0.5 + 0.5;
    const grain = n2(u * 128, v * 128, 128);
    const ripple = Math.sin((v * 12 + fbm(n, u, v, 3, 3) * 1.6) * Math.PI * 2) * 0.5 + 0.5;
    let c = mix(B, at(S, big), 0.5);
    c = mul(c, 0.92 + grain * 0.08 + ripple * 0.06);
    o.c = c;
    o.h = ripple * 0.35 + grain * 0.08 + big * 0.2;
  }, 2.5);
}

/** Plankeverk: årer, kvister og mørke skjøter mellom plankene. */
export function woodTexture() {
  const n = periodicNoise(nextSeed()), wn = worley(nextSeed());
  const B = hex('#7a5230'), D = hex('#4a2e18');
  const r = rng(nextSeed());
  const tint = Array.from({ length: 8 }, () => (r() - 0.5) * 0.24);
  return bake(128, 256, (u, v, o) => {
    const plank = Math.floor(u * 4);
    const lx = u * 4 - plank;
    const seam = smooth(0.0, 0.05, Math.min(lx, 1 - lx));
    const grainN = n(u * 32, v * 4, 32) * 0.6 + n(u * 64, v * 8, 64) * 0.4;
    const rings = Math.sin((grainN * 3 + u * 40) * Math.PI) * 0.5 + 0.5;
    const w = wn(u, v, 4, 8);
    const knot = w.id < 0.2 ? 1 - smooth(0.0, 0.18, w.f1) : 0;
    let c = mix(B, D, rings * 0.35 + knot * 0.6);
    c = mul(c, (1 + tint[plank & 7]) * (0.85 + seam * 0.15));
    o.c = mul(c, 0.55 + seam * 0.45);
    o.h = seam * (0.6 + rings * 0.12) - knot * 0.15;
  }, 3);
}

/** Svart lavastein med glødende sprekker (glød i userData.emissiveMap). */
export function lavaRockTexture() {
  const n = periodicNoise(nextSeed()), wn = worley(nextSeed());
  const B = hex('#2a2226'), L = hex('#3e3238');
  return bake(512, 512, (u, v, o) => {
    const big = fbm(n, u, v, 4, 5) * 0.5 + 0.5;
    const w = wn(u, v, 7);
    const crack = 1 - smooth(0.0, 0.06, w.f2 - w.f1);
    const hot = crack * smooth(0.35, 0.75, fbm(n, u + 0.37, v, 3, 3) * 0.5 + 0.5);
    const c = mul(mix(B, L, big), 0.8 + fbm(n, u, v, 32, 3) * 0.2);
    o.c = mix(c, [0.95, 0.35, 0.05], hot * 0.85);
    o.e = hot;
    o.h = big * 0.4 + (1 - crack) * 0.5;
  }, 4);
}
