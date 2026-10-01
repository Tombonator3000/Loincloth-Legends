// Prosedyriske 3D-trær med rotfestet vind.
// Vekstmodellen følger kontrakten i threejs-procedural-vegetation (structured-ash-growth) i prosjektbiblioteket:
// grener vokser fra en kø, hver gren er ringer langs en seksjonskjede med knudrethet, vridning og vekstkraft,
// sidegrener sitter i stratifiserte spor med stokkede vinkelspor, og hver gren får en fortsettelse fra tuppen.
// Tilpasninger for dette spillet (bevisste avvik fra kontrakten):
// - skalert til spillets størrelse; knudrethet og vekstkraft regnes mot en normalisert radius så formen holder,
// - arter: høsttre, sumptre med hengende mose, furu (kjegleprofil, hengende greiner, snø) og dødt tre,
// - bladkort med klynger av blader, normaler bøyd mot klumpsenteret per hovedgren (myk kroneskygge),
//   mørkere inne i kronen (AO) og gjennomskinnelige i motlys,
// - barkens v-koordinat følger lengden (ikke vekslende 0/1 per seksjon),
// - vind på stamme og grener i tillegg til bladene (se gfx/wind.ts), også i skyggene.
import * as THREE from 'three';
import { random } from '../../core/math';
import { plainCanvas } from '../draw';
import { windifyTree, sunUniforms } from '../wind';
import { qualityRank } from '../post';

// ---------------------------------------------------------------- tilfeldighet med frø
class Rng {
  private w: number;
  private z: number;
  constructor(seed: number) {
    this.w = (123456789 + seed) | 0;
    this.z = (987654321 - seed) | 0;
  }
  value(max = 1, min = 0) {
    this.z = (36969 * (this.z & 65535) + (this.z >> 16)) | 0;
    this.w = (18000 * (this.w & 65535) + (this.w >> 16)) | 0;
    const n = (((this.z << 16) + (this.w & 65535)) >>> 0) / 4294967296;
    return min + (max - min) * n;
  }
  shuffled(count: number) {
    const v = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(this.value() * (i + 1));
      [v[i], v[j]] = [v[j], v[i]];
    }
    return v;
  }
  pick<T>(a: T[]) {
    return a[Math.floor(this.value() * a.length) % a.length];
  }
}

// ---------------------------------------------------------------- arter
export type LeafKind = 'autumn' | 'green' | 'needle' | 'moss' | 'broad';

export interface LeafSpec {
  kind: LeafKind;
  /** Blader per endegren. */
  count: number;
  size: number;
  variance: number;
  /** Vinkel ut fra grenen i grader. */
  angle: number;
  start: number;
  palette: string[];
  /** Snø på oversiden (furu i frost). */
  snow?: boolean;
}

export interface Species {
  name: string;
  /** Grennivåer etter stammen. */
  levels: number;
  length: number[];
  /** [stammeradius, faktor, faktor, ...] (faktor ganges med morens radius der grenen sitter). */
  radius: number[];
  sections: number[];
  segments: number[];
  children: number[];
  angle: number[];
  start: number[];
  gnarl: number[];
  twist: number[];
  taper: number[];
  /** Vekstkraft oppover (stamme og grener). */
  up: number;
  /** Tyngde på sidegrenene (henger). */
  droop?: number;
  /** 'cone': sidegrenene blir kortere oppover (furu). */
  profile?: 'cone';
  bark: string;
  leaves: LeafSpec | null;
}

export const SPECIES: Record<string, Species> = {
  autumn: {
    name: 'autumn', levels: 3,
    length: [5.0, 2.9, 1.25, 0.55], radius: [0.34, 0.62, 0.72, 0.7], sections: [9, 7, 5, 3], segments: [9, 6, 4, 3],
    children: [6, 4, 3, 0], angle: [0, 44, 62, 55], start: [0, 0.46, 0.3, 0], gnarl: [0.05, 0.24, 0.2, 0.1],
    twist: [0.09, -0.07, 0, 0], taper: [0.7, 0.7, 0.7, 0.7], up: 0.012, bark: '#5a4232',
    leaves: { kind: 'autumn', count: 9, size: 1.05, variance: 0.3, angle: 55, start: 0.05, palette: ['#d9532b', '#e8862e', '#f2b33d', '#c23b22', '#e0a030', '#b8401f', '#f0c24a'] },
  },
  oak: {
    name: 'oak', levels: 3,
    length: [3.6, 3.1, 1.3, 0.55], radius: [0.42, 0.66, 0.72, 0.7], sections: [8, 7, 5, 3], segments: [10, 6, 4, 3],
    children: [5, 4, 3, 0], angle: [0, 58, 55, 55], start: [0, 0.4, 0.28, 0], gnarl: [0.06, 0.28, 0.22, 0.12],
    twist: [0.12, -0.05, 0.05, 0], taper: [0.65, 0.7, 0.7, 0.7], up: 0.008, bark: '#4e3a2c',
    leaves: { kind: 'green', count: 10, size: 1.1, variance: 0.3, angle: 55, start: 0.05, palette: ['#6f8a2e', '#8a9a34', '#5e7a2a', '#a8a03a', '#c89a38'] },
  },
  swamp: {
    name: 'swamp', levels: 3,
    length: [3.4, 2.7, 1.4, 0.6], radius: [0.38, 0.6, 0.66, 0.7], sections: [8, 6, 5, 3], segments: [8, 5, 4, 3],
    children: [5, 3, 3, 0], angle: [0, 62, 55, 50], start: [0, 0.35, 0.3, 0], gnarl: [0.14, 0.34, 0.3, 0.16],
    twist: [0.2, -0.1, 0.1, 0], taper: [0.72, 0.7, 0.7, 0.7], up: 0.004, droop: 0.02, bark: '#3a3226',
    leaves: { kind: 'moss', count: 3, size: 1.5, variance: 0.4, angle: 0, start: 0.2, palette: ['#5a6a2a', '#6a7a3a', '#4a5a28', '#7a8a44'] },
  },
  pine: {
    name: 'pine', levels: 2,
    length: [8.2, 2.5, 0.75], radius: [0.26, 0.3, 0.5], sections: [11, 5, 3], segments: [7, 4, 3],
    children: [28, 3, 0], angle: [0, 104, 42], start: [0, 0.16, 0.2], gnarl: [0.02, 0.06, 0.1],
    twist: [0.0, 0.0, 0], taper: [0.92, 0.8, 0.7], up: 0.02, droop: 0.03, profile: 'cone', bark: '#4a3526',
    leaves: { kind: 'needle', count: 8, size: 0.95, variance: 0.25, angle: 72, start: 0.0, palette: ['#2f5a3a', '#2a5033', '#3a6a44', '#24462e'] },
  },
  // Jungelkjempe: høy, rett stamme med kronen helt øverst, store, brede blader og grener som henger litt
  jungle: {
    name: 'jungle', levels: 2,
    length: [10.5, 3.4, 1.3], radius: [0.44, 0.42, 0.55], sections: [12, 6, 3], segments: [9, 5, 3],
    children: [7, 3, 0], angle: [0, 68, 52], start: [0, 0.7, 0.2], gnarl: [0.03, 0.2, 0.12],
    twist: [0.05, -0.05, 0], taper: [0.8, 0.7, 0.7], up: 0.01, droop: 0.025, bark: '#5c5444',
    leaves: { kind: 'broad', count: 7, size: 1.85, variance: 0.35, angle: 48, start: 0.1, palette: ['#2f6a2a', '#3e7a30', '#2a5a26', '#4a8a36', '#5a9a3a', '#6aa040'] },
  },
  // Palme: slank, litt bøyd stamme og en dusk av lange blad som henger ned fra toppen
  palm: {
    name: 'palm', levels: 1,
    length: [6.2, 2.9], radius: [0.2, 0.42], sections: [10, 7], segments: [7, 4],
    children: [11, 0], angle: [0, 58], start: [0, 0.9], gnarl: [0.05, 0.03],
    twist: [0.02, 0], taper: [0.4, 0.85], up: 0.004, droop: 0.075, bark: '#7a6a4c',
    leaves: { kind: 'broad', count: 6, size: 1.15, variance: 0.25, angle: 82, start: 0.12, palette: ['#3e7224', '#4e822a', '#30621e', '#5a8a2e', '#467a26'] },
  },
  // Bananplante: kort stamme og noen få enorme blad som bøyer seg ut og ned
  banana: {
    name: 'banana', levels: 1,
    length: [1.5, 2.3], radius: [0.17, 0.5], sections: [4, 6], segments: [7, 4],
    children: [7, 0], angle: [0, 34], start: [0, 0.45], gnarl: [0.02, 0.04],
    twist: [0.0, 0], taper: [0.3, 0.85], up: 0.002, droop: 0.05, bark: '#5e6a3a',
    leaves: { kind: 'broad', count: 4, size: 1.45, variance: 0.25, angle: 70, start: 0.25, palette: ['#4e8426', '#5e922c', '#3e7222', '#6e9e30'] },
  },
  dead: {
    name: 'dead', levels: 3,
    length: [4.6, 2.4, 1.1, 0.5], radius: [0.32, 0.6, 0.66, 0.7], sections: [9, 6, 4, 3], segments: [8, 5, 4, 3],
    children: [5, 3, 2, 0], angle: [0, 50, 58, 50], start: [0, 0.4, 0.3, 0], gnarl: [0.06, 0.3, 0.3, 0.2],
    twist: [0.1, -0.1, 0.1, 0], taper: [0.72, 0.72, 0.72, 0.72], up: 0.006, bark: '#3e2e22', leaves: null,
  },
};

/** Arter med snø på nålene (frost). */
export function withSnow(s: Species): Species {
  return { ...s, name: s.name + '-snow', leaves: s.leaves ? { ...s.leaves, snow: true } : null };
}

/** Brent variant (Scorchlands): kullsvart bark. */
export function burnt(s: Species): Species {
  return { ...s, name: s.name + '-burnt', bark: '#1e1614', leaves: null };
}

// ---------------------------------------------------------------- teksturer
const texCache = new Map<string, THREE.Texture>();

function tex(key: string, make: () => HTMLCanvasElement) {
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(make());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return t;
}

/** Ett blad med midtribbe i gråtoner (fargen kommer fra toppunktfargen). */
function drawLeaf(c: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number, ang: number, shade: number) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  const g = Math.round(200 + shade * 55);
  c.fillStyle = `rgb(${g},${g},${g})`;
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.75, 0, -len);
  c.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.25, 0, 0);
  c.fill();
  c.strokeStyle = `rgba(90,70,60,0.55)`;
  c.lineWidth = 1.4;
  c.stroke();
  c.strokeStyle = `rgba(120,95,80,0.45)`;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, -2);
  c.lineTo(0, -len * 0.9);
  c.stroke();
  c.restore();
}

export function leafTexture(kind: LeafKind) {
  return tex('leaf:' + kind, () => {
    if (kind === 'moss') {
      return plainCanvas(64, 256, (c) => {
        c.clearRect(0, 0, 64, 256);
        for (let i = 0; i < 9; i++) {
          const x = 8 + i * 6 + Math.random() * 4;
          const len = 120 + Math.random() * 130;
          const g = Math.round(190 + Math.random() * 60);
          c.strokeStyle = `rgb(${g},${g},${g})`;
          c.lineWidth = 2 + Math.random() * 3;
          c.beginPath();
          c.moveTo(x, 0);
          for (let y = 0; y < len; y += 16) c.lineTo(x + Math.sin(y * 0.05 + i) * 4, y);
          c.stroke();
        }
      });
    }
    if (kind === 'needle') {
      return plainCanvas(128, 128, (c) => {
        c.clearRect(0, 0, 128, 128);
        // En kvist med nåler som peker utover, sett fra siden
        c.strokeStyle = 'rgb(150,130,110)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(64, 128);
        c.lineTo(64, 6);
        c.stroke();
        for (let y = 124; y > 8; y -= 3) {
          const k = 1 - y / 128;
          const len = 26 + k * 12 + Math.random() * 8;
          for (const s of [-1, 1]) {
            const g = Math.round(185 + Math.random() * 70);
            c.strokeStyle = `rgb(${g},${g},${g})`;
            c.lineWidth = 2.2;
            c.beginPath();
            c.moveTo(64, y);
            c.lineTo(64 + s * len * (0.7 + Math.random() * 0.3), y - len * 0.55);
            c.stroke();
          }
        }
      });
    }
    if (kind === 'broad') {
      // Jungel: noen få store, lange blader (som bananblader) i vifte fra roten
      return plainCanvas(128, 128, (c) => {
        c.clearRect(0, 0, 128, 128);
        for (let i = 0; i < 5; i++) {
          const a = -1.0 + (i / 4) * 2.0 + (Math.random() - 0.5) * 0.25;
          drawLeaf(c, 64 + Math.sin(a) * 8, 124 - Math.cos(a) * 6, 92 + Math.random() * 22, 26 + Math.random() * 8, a, Math.random());
        }
      });
    }
    return plainCanvas(128, 128, (c) => {
      c.clearRect(0, 0, 128, 128);
      // Klynge av blader som sprer seg fra kortets rot nederst
      const n = kind === 'autumn' ? 8 : 9;
      for (let i = 0; i < n; i++) {
        const a = -1.1 + (i / (n - 1)) * 2.2 + (Math.random() - 0.5) * 0.3;
        const r = 18 + Math.random() * 26;
        drawLeaf(c, 64 + Math.sin(a) * r, 118 - Math.cos(a) * r * 0.9, 44 + Math.random() * 18, 16 + Math.random() * 6, a * 0.9, Math.random());
      }
      drawLeaf(c, 64, 70, 52, 18, 0, 1);
    });
  });
}

/** Et enkelt blad (for fallende blader og løv på bakken). */
export function singleLeafTexture() {
  return tex('leaf:single', () =>
    plainCanvas(64, 64, (c) => {
      c.clearRect(0, 0, 64, 64);
      drawLeaf(c, 32, 60, 54, 20, 0, 0.8);
    }));
}

export function barkTexture() {
  const t = tex('bark', () =>
    plainCanvas(64, 256, (c) => {
      c.fillStyle = 'rgb(200,200,200)';
      c.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * 64;
        const g = Math.round(110 + Math.random() * 60);
        c.strokeStyle = `rgb(${g},${g},${g})`;
        c.lineWidth = 1.5 + Math.random() * 3;
        c.beginPath();
        c.moveTo(x, 0);
        for (let y = 0; y <= 256; y += 32) c.lineTo(x + Math.sin(y * 0.03 + i) * 3, y);
        c.stroke();
      }
      for (let i = 0; i < 5; i++) {
        c.fillStyle = 'rgba(70,60,55,0.7)';
        c.beginPath();
        c.ellipse(Math.random() * 64, Math.random() * 256, 3 + Math.random() * 3, 5 + Math.random() * 5, 0, 0, Math.PI * 2);
        c.fill();
      }
    }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------- generator
interface Section { origin: THREE.Vector3; q: THREE.Quaternion; radius: number; dist: number }
interface Job {
  origin: THREE.Vector3;
  q: THREE.Quaternion;
  length: number;
  radius: number;
  level: number;
  sections: number;
  segments: number;
  limb: number;
  dist: number;
}

export interface TreeProto {
  bark: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry | null;
  height: number;
  species: Species;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

function interpolate(secs: Section[], t: number): Section {
  const s = t * (secs.length - 1);
  const a = Math.min(Math.floor(s), secs.length - 1);
  const b = Math.min(a + 1, secs.length - 1);
  const k = s - a;
  const A = secs[a], B = secs[b];
  return {
    origin: new THREE.Vector3().lerpVectors(A.origin, B.origin, k),
    radius: THREE.MathUtils.lerp(A.radius, B.radius, k),
    // Kontrakten: start i B og slerp mot A med k
    q: B.q.clone().slerp(A.q, k),
    dist: THREE.MathUtils.lerp(A.dist, B.dist, k),
  };
}

/** Bøy en retning mot en kraft, med vinkel begrenset av avstanden dit. */
function applyForce(q: THREE.Quaternion, dir: THREE.Vector3, strength: number) {
  if (strength <= 0) return;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const axis = new THREE.Vector3().crossVectors(up, dir);
  const sine = axis.length();
  if (sine < 1e-6) return;
  axis.divideScalar(sine);
  const full = Math.atan2(sine, up.dot(dir));
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, Math.min(strength, full)));
}

export function growTree(sp: Species, seed: number, detail = qualityRank()): TreeProto {
  const rng = new Rng(seed);
  const rNorm = 2 / sp.radius[0];
  const leafMul = detail <= 1 ? 0.6 : detail >= 3 ? 1.25 : 1;
  const doubleCards = detail >= 2;
  const segMul = detail <= 1 ? 0.75 : 1;

  const bp: number[] = [], bn: number[] = [], buv: number[] = [], bw: number[] = [], bi: number[] = [];
  const lp: number[] = [], ln: number[] = [], luv: number[] = [], lw: number[] = [], lc: number[] = [], li: number[] = [];
  const leafMeta: { start: number; count: number; origin: THREE.Vector3; limb: number; color: THREE.Color }[] = [];

  const jobs: Job[] = [{
    origin: new THREE.Vector3(), q: new THREE.Quaternion(), length: sp.length[0], radius: sp.radius[0], level: 0,
    sections: sp.sections[0], segments: Math.max(3, Math.round(sp.segments[0] * segMul)), limb: -1, dist: 0,
  }];
  let limbCount = 0;
  const L = sp.leaves;
  const leafCol = new THREE.Color();

  const emitLeaf = (origin: THREE.Vector3, q: THREE.Quaternion, limb: number) => {
    if (!L) return;
    const size = L.size * (1 + rng.value(L.variance, -L.variance));
    leafCol.set(rng.pick(L.palette)).offsetHSL(rng.value(0.015, -0.015), 0, rng.value(0.05, -0.05));
    const phase = rng.value(Math.PI * 2);
    const start = lp.length / 3;
    const cards = L.kind === 'moss' ? 1 : doubleCards ? 2 : 1;
    let qq = q;
    if (L.kind === 'moss') {
      // Mose henger rett ned uansett grenretning, med litt tilfeldig dreining
      qq = new THREE.Quaternion().setFromAxisAngle(Y, rng.value(Math.PI * 2)).multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.PI));
    }
    const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(qq);
    for (let c = 0; c < cards; c++) {
      const rot = new THREE.Quaternion().setFromAxisAngle(Y, c * Math.PI * 0.5);
      const base = lp.length / 3;
      const corners: [number, number, number, number][] = [[-0.5, 1, 0, 1], [-0.5, 0, 0, 0], [0.5, 0, 1, 0], [0.5, 1, 1, 1]];
      const w = L.kind === 'moss' ? size * 0.35 : size;
      for (const [cx, cy, u, v] of corners) {
        const p = new THREE.Vector3(cx * w, cy * size, 0).applyQuaternion(rot).applyQuaternion(qq).add(origin);
        lp.push(p.x, p.y, p.z);
        ln.push(nrm.x, nrm.y, nrm.z);
        luv.push(u, v);
        lw.push(1, cy, phase);
      }
      li.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    leafMeta.push({ start, count: cards * 4, origin: origin.clone(), limb, color: leafCol.clone() });
  };

  const emitLeavesAlong = (secs: Section[], limb: number) => {
    if (!L) return;
    const count = Math.max(1, Math.round(L.count * leafMul));
    const off = rng.value();
    const slots = rng.shuffled(count);
    const step = (1 - L.start) / count;
    for (let s = 0; s < count; s++) {
      const along = L.start + (s + rng.value()) * step;
      const par = interpolate(secs, along);
      const az = Math.PI * 2 * (off + (slots[s] + rng.value(0.5, -0.5)) / count);
      const q = par.q.clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(Y, az))
        .multiply(new THREE.Quaternion().setFromAxisAngle(X, THREE.MathUtils.degToRad(L.angle)));
      emitLeaf(par.origin, q, limb);
    }
  };

  const enqueueChildren = (parentLevel: number, secs: Section[], limb: number) => {
    const level = parentLevel + 1;
    const count = sp.children[parentLevel];
    if (!count) return;
    const start = sp.start[level];
    const off = rng.value();
    const slots = rng.shuffled(count);
    const step = (1 - start) / count;
    for (let s = 0; s < count; s++) {
      const along = start + (s + rng.value()) * step;
      const par = interpolate(secs, along);
      const az = Math.PI * 2 * (off + (slots[s] + rng.value(0.5, -0.5)) / count);
      const q = par.q.clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(Y, az))
        .multiply(new THREE.Quaternion().setFromAxisAngle(X, THREE.MathUtils.degToRad(sp.angle[level])));
      let len = sp.length[level];
      if (sp.profile === 'cone' && parentLevel === 0) len *= Math.pow(1 - along, 0.85) * 1.15 + 0.12;
      jobs.push({
        origin: par.origin, q, length: len, radius: sp.radius[level] * par.radius, level,
        sections: sp.sections[level], segments: Math.max(3, Math.round(sp.segments[level] * segMul)),
        limb: parentLevel === 0 ? limbCount++ : limb, dist: par.dist,
      });
    }
  };

  let maxY = 0;
  while (jobs.length) {
    const j = jobs.shift()!;
    const q = j.q.clone();
    const origin = j.origin.clone();
    const secLen = j.length / j.sections;
    const secs: Section[] = [];
    const wrapsX = Math.max(1, Math.round(j.radius * 6));
    const lvl01 = j.level / sp.levels;
    const phase = rng.value(Math.PI * 2);
    const offset = bp.length / 3;
    let dist = j.dist;
    for (let si = 0; si <= j.sections; si++) {
      let r = j.radius * (1 - sp.taper[j.level] * (si / j.sections));
      if (si === j.sections && j.level === sp.levels) r = 0.002;
      for (let k = 0; k <= j.segments; k++) {
        const a = (Math.PI * 2 * (k % j.segments)) / j.segments;
        const rad = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const p = rad.clone().multiplyScalar(r).applyQuaternion(q).add(origin);
        const n = rad.applyQuaternion(q).normalize();
        bp.push(p.x, p.y, p.z);
        bn.push(n.x, n.y, n.z);
        buv.push((k / j.segments) * wrapsX, dist * 0.6);
        bw.push(lvl01, 0, phase);
        maxY = Math.max(maxY, p.y);
      }
      secs.push({ origin: origin.clone(), q: q.clone(), radius: r, dist });
      origin.add(new THREE.Vector3(0, secLen, 0).applyQuaternion(q));
      dist += secLen;
      const rn = Math.max(r * rNorm, 0.001);
      const gn = Math.max(1, 1 / Math.sqrt(rn)) * sp.gnarl[j.level];
      const e = new THREE.Euler().setFromQuaternion(q);
      e.x += rng.value(gn, -gn);
      e.z += rng.value(gn, -gn);
      q.setFromEuler(e).multiply(new THREE.Quaternion().setFromAxisAngle(Y, sp.twist[j.level]));
      // Som i kontrakten: vinkelsteget er kraft / radius, så tynne grener bøyer seg mest
      applyForce(q, Y, sp.up / rn);
      if (sp.droop && j.level > 0) applyForce(q, DOWN, sp.droop / Math.max(0.1, rn));
    }
    const ring = j.segments + 1;
    for (let si = 0; si < j.sections; si++) {
      for (let k = 0; k < j.segments; k++) {
        const a = offset + si * ring + k, b = a + 1, c = a + ring, d = b + ring;
        bi.push(a, c, b, b, c, d);
      }
    }
    const last = secs[secs.length - 1];
    if (j.level < sp.levels) {
      const next = j.level + 1;
      let len = sp.length[next];
      if (sp.profile === 'cone' && j.level === 0) len *= 0.8;
      jobs.push({ origin: last.origin, q: last.q, length: len, radius: last.radius, level: next, sections: j.sections, segments: j.segments, limb: j.limb, dist });
      enqueueChildren(j.level, secs, j.limb);
      // Furu: nåler også langs sidegrenene på nest siste nivå
      if (sp.profile === 'cone' && j.level === sp.levels - 1 && L) emitLeavesAlong(secs, j.limb);
    } else {
      emitLeaf(last.origin, last.q, j.limb);
      emitLeavesAlong(secs, j.limb);
    }
  }

  const bark = new THREE.BufferGeometry();
  bark.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  bark.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3));
  bark.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
  bark.setAttribute('aWind', new THREE.Float32BufferAttribute(bw, 3));
  bark.setIndex(bi);
  bark.computeBoundingSphere();

  let leaves: THREE.BufferGeometry | null = null;
  if (L && leafMeta.length) {
    // Klumpsentre per hovedgren og ett for hele kronen
    const sums = new Map<number, THREE.Vector3>();
    const counts = new Map<number, number>();
    const crown = new THREE.Vector3();
    for (const m of leafMeta) {
      crown.add(m.origin);
      sums.set(m.limb, (sums.get(m.limb) ?? new THREE.Vector3()).add(m.origin));
      counts.set(m.limb, (counts.get(m.limb) ?? 0) + 1);
    }
    crown.divideScalar(leafMeta.length);
    let crownR = 0.001;
    for (const m of leafMeta) crownR = Math.max(crownR, m.origin.distanceTo(crown));
    const tmp = new THREE.Vector3();
    const snow = new THREE.Color(0.94, 0.96, 1.0);
    for (const m of leafMeta) {
      const center = sums.get(m.limb)!.clone().divideScalar(counts.get(m.limb)!);
      // Utenfor midten av kronen = lysere (enkel AO), lavere blader litt mørkere
      const depth = THREE.MathUtils.clamp(m.origin.distanceTo(crown) / crownR, 0, 1);
      const ao = (0.5 + 0.5 * Math.pow(depth, 0.8)) * (0.82 + 0.18 * THREE.MathUtils.clamp(m.origin.y / Math.max(1, maxY), 0, 1));
      for (let v = m.start; v < m.start + m.count; v++) {
        const p = tmp.set(lp[v * 3], lp[v * 3 + 1], lp[v * 3 + 2]);
        const out = p.clone().sub(center).normalize();
        const card = new THREE.Vector3(ln[v * 3], ln[v * 3 + 1], ln[v * 3 + 2]);
        const n = card.lerp(out, L.kind === 'moss' ? 0.4 : 0.8).normalize();
        ln[v * 3] = n.x;
        ln[v * 3 + 1] = n.y;
        ln[v * 3 + 2] = n.z;
        const col = m.color.clone().multiplyScalar(ao);
        if (L.snow) col.lerp(snow, THREE.MathUtils.smoothstep(n.y, 0.25, 0.75) * 0.85);
        lc.push(col.r, col.g, col.b);
      }
    }
    leaves = new THREE.BufferGeometry();
    leaves.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    leaves.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3));
    leaves.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2));
    leaves.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    leaves.setAttribute('aWind', new THREE.Float32BufferAttribute(lw, 3));
    leaves.setIndex(li);
    leaves.computeBoundingSphere();
    for (let v = 1; v < lp.length; v += 3) maxY = Math.max(maxY, lp[v]);
  }
  return { bark, leaves, height: Math.max(1, maxY), species: sp };
}

// ---------------------------------------------------------------- materialer
const matCache = new Map<string, { bark: THREE.Material; barkDepth: THREE.Material; leaf: THREE.Material | null; leafDepth: THREE.Material | null }>();

/** Blader lar sollyset skinne gjennom i motlys, og tosidig skyggelegging beholder kronenormalene. */
function leafFrag(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, sunUniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirW;\nuniform vec3 uSunCol;')
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);\n  nonPerturbedNormal = normal;')
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    vec3 Lv = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
    vec3 toCam = normalize(vViewPosition);
    float back = pow(max(dot(-toCam, Lv), 0.0), 3.0);
    float wrap = max(dot(normal, Lv) * 0.5 + 0.5, 0.0);
    reflectedLight.directDiffuse += diffuseColor.rgb * uSunCol * (0.12 * wrap + back * 0.55);
  }`);
}

function materials(proto: TreeProto) {
  const sp = proto.species;
  const key = sp.name + ':' + proto.height.toFixed(2);
  let m = matCache.get(key);
  if (m) return m;
  const barkTex = barkTexture();
  const bark = new THREE.MeshStandardMaterial({ color: sp.bark, map: barkTex, roughness: 0.95 });
  windifyTree(bark, proto.height, 'bark');
  const barkDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  windifyTree(barkDepth, proto.height, 'barkDepth');
  let leaf: THREE.Material | null = null;
  let leafDepth: THREE.Material | null = null;
  if (sp.leaves) {
    const lt = leafTexture(sp.leaves.kind);
    const lm = new THREE.MeshStandardMaterial({ map: lt, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78, alphaToCoverage: true });
    windifyTree(lm, proto.height, 'leaf', leafFrag);
    leaf = lm;
    const ld = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lt, alphaTest: 0.5 });
    windifyTree(ld, proto.height, 'leafDepth');
    leafDepth = ld;
  }
  m = { bark, barkDepth, leaf, leafDepth };
  matCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------- skog
const protoCache = new Map<string, TreeProto>();

/** Hent (eller lag) en treprototype. Bufres per art, variant og grafikknivå så scenebytter går raskt. */
export function treeProto(sp: Species, variant: number) {
  const k = sp.name + ':' + variant + ':' + qualityRank();
  let p = protoCache.get(k);
  if (!p) {
    p = growTree(sp, 1000 + variant * 7919);
    protoCache.set(k, p);
  }
  return p;
}

interface Placed { proto: number; x: number; z: number; s: number; r: number; shadow: boolean }

/**
 * En skog av instansierte trær. Trærne deles i biter langs x så bitene utenfor kameraet ikke tegnes.
 * Samme få prototyper gjenbrukes med ulik dreining og størrelse.
 */
export class Forest {
  readonly group = new THREE.Group();
  private protos: TreeProto[];
  private placed: Placed[] = [];

  constructor(readonly species: Species, variants = 3) {
    this.protos = Array.from({ length: variants }, (_, i) => treeProto(species, i));
  }

  add(x: number, z: number, scale = 1, rotY = random() * Math.PI * 2, castShadow = true) {
    this.placed.push({ proto: Math.floor(random() * this.protos.length), x, z, s: scale, r: rotY, shadow: castShadow });
  }

  /** Bygg instansene. chunk = bredden på hver bit langs x. */
  build(chunk = 28) {
    const groups = new Map<string, Placed[]>();
    for (const p of this.placed) {
      const k = p.proto + ':' + Math.floor(p.x / chunk) + ':' + (p.shadow ? 1 : 0);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (const [k, list] of groups) {
      const proto = this.protos[Number(k.split(':')[0])];
      const shadow = k.endsWith(':1');
      const mats = materials(proto);
      const parts: [THREE.BufferGeometry, THREE.Material, THREE.Material][] = [[proto.bark, mats.bark, mats.barkDepth]];
      if (proto.leaves && mats.leaf && mats.leafDepth) parts.push([proto.leaves, mats.leaf, mats.leafDepth]);
      for (const [geo, mat, depth] of parts) {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((p, i) => {
          q.setFromAxisAngle(Y, p.r);
          m.compose(pos.set(p.x, 0, p.z), q, scl.setScalar(p.s));
          im.setMatrixAt(i, m);
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        // Vinden flytter toppene litt utenfor den beregnede kula
        if (im.boundingSphere) im.boundingSphere.radius += proto.height * 0.25;
        im.customDepthMaterial = depth;
        im.castShadow = shadow;
        im.receiveShadow = true;
        im.userData.noCast = !shadow;
        this.group.add(im);
      }
    }
    return this.group;
  }
}
