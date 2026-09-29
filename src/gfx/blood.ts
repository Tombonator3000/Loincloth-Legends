// Blod: blanke dråper på GPU som lander der fysikken sier, og flekker som blir liggende.
// Hver dråpe beregner landingspunktet når den slippes ut (samme bevegelsesformel som skyggeleggeren), så flekken
// kommer akkurat der og da dråpen treffer bakken, avlang i treffretningen. Ingen CPU-oppdatering per dråpe.
// Flekkene har et atlas med 16 varianter (runde sprut, retningssprut, drypp og pytter) med tykkelse i en egen kanal,
// som gir våt glans som tørker inn over tid. Pytter under liken vokser.
import * as THREE from 'three';
import { Pool } from './vfx';
import { sunUniforms } from './wind';

/** Tyngden dråpene faller med (samme som den gamle CPU-simuleringen). */
export const BLOOD_G = 16;

const BLOOD_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uSunW;
varying vec2 vUv;
varying vec3 vCol;
varying float vKind;
varying float vU;
varying float vSeed;
varying float vSink;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float d = length(c);
  if (d > 1.0) discard;
  // Rund, blank dråpe: kulenormal i skjermrom, diffus fra sola, blankt høylys og mørkere kant
  vec3 n = normalize(vec3(c.x, c.y * 0.7, sqrt(max(0.0, 1.0 - d * d))));
  vec3 L = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
  float diff = 0.5 + 0.5 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 24.0);
  vec3 col = vCol * diff * (0.75 + 0.25 * n.z) + vec3(1.0, 0.88, 0.85) * spec * 0.8;
  float a = 1.0 - smoothstep(0.7, 1.0, d);
  gl_FragColor = vec4(col, a * vSink);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ---------------------------------------------------------------- atlas
const CELLS = 4;
const CELL = 128;

/** Glatt, ujevn klatt (for sprut og pytter). */
function blob(put: (x: number, y: number) => void, cx: number, cy: number, r: number, wobble: number, seed: number, stretch = 1) {
  const r2 = (r * 1.3) ** 2 * stretch * stretch;
  for (let y = Math.floor(cy - r * 1.3); y <= cy + r * 1.3; y++) {
    for (let x = Math.floor(cx - r * 1.3 * stretch); x <= cx + r * 1.3 * stretch; x++) {
      const dx = (x - cx) / stretch, dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const a = Math.atan2(dy, dx);
      const rr = r * (1 + wobble * (0.5 * Math.sin(a * 3 + seed) + 0.3 * Math.sin(a * 5 + seed * 2.3) + 0.2 * Math.sin(a * 9 + seed * 0.7)));
      if (dx * dx + dy * dy <= rr * rr) put(x, y);
    }
  }
}

let atlasTex: THREE.Texture | null = null;

/** Lag atlaset: R = dekning, G = tykkelse. 4x4 celler à 128 px. */
export function bloodAtlas() {
  if (atlasTex) return atlasTex;
  const W = CELLS * CELL;
  const mask = new Float32Array(W * W);
  for (let cell = 0; cell < 16; cell++) {
    const ox = (cell % CELLS) * CELL, oy = Math.floor(cell / CELLS) * CELL;
    const put = (x: number, y: number) => {
      if (x < 2 || y < 2 || x >= CELL - 2 || y >= CELL - 2) return;
      mask[(oy + y) * W + ox + x] = 1;
    };
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const seed = cell * 1.7 + 0.3;
    if (cell < 6) {
      // Treffsprut: klatt i midten, små dråper rundt, noen med hale utover
      blob(put, 64, 64, rnd(20, 28), 0.28, seed);
      const n = Math.round(rnd(9, 16));
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), d = rnd(30, 56), r = rnd(2, 6);
        const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d;
        blob(put, x, y, r, 0.2, seed + i);
        if (Math.random() < 0.4) for (let k = 1; k < 5; k++) blob(put, x - Math.cos(a) * k * 3, y - Math.sin(a) * k * 3, r * (1 - k * 0.18), 0.1, seed);
      }
    } else if (cell < 10) {
      // Retningssprut: dråpen kom fra venstre og sprutet mot høyre (+x i cellen)
      blob(put, 40, 64, rnd(16, 20), 0.2, seed, 1.25);
      const n = Math.round(rnd(12, 20));
      for (let i = 0; i < n; i++) {
        const a = rnd(-0.5, 0.5), d = rnd(22, 60), r = rnd(1.5, 5);
        const x = 40 + Math.cos(a) * d, y = 64 + Math.sin(a) * d;
        blob(put, x, y, r, 0.15, seed + i, 1.6);
        // Utropstegn: en tynn stripe før dråpen
        for (let k = 1; k < 6; k++) blob(put, x - k * 3, y - Math.sin(a) * k * 3, Math.max(0.8, r * 0.45), 0, seed);
      }
    } else if (cell < 12) {
      // Drypp: rekke med små dråper
      for (let i = 0; i < 9; i++) blob(put, 20 + i * 11 + rnd(-2, 2), 64 + rnd(-6, 6), rnd(3, 7), 0.2, seed + i);
    } else {
      // Pytt: stor, glatt klatt med noen få utløpere
      blob(put, 64, 64, rnd(40, 48), 0.18, seed);
      for (let i = 0; i < 4; i++) {
        const a = rnd(0, Math.PI * 2);
        blob(put, 64 + Math.cos(a) * 42, 64 + Math.sin(a) * 42, rnd(8, 14), 0.2, seed + i);
      }
    }
  }
  // Tykkelse: uskarp kopi av masken (boksuskarphet to ganger), innenfor masken
  const blur = (src: Float32Array, r: number) => {
    const tmp = new Float32Array(W * W), out = new Float32Array(W * W);
    for (let y = 0; y < W; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[y * W + Math.max(0, Math.min(W - 1, x))];
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = acc / (2 * r + 1);
        acc += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(W - 1, y)) * W + x];
      for (let y = 0; y < W; y++) {
        out[y * W + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(W - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
    }
    return out;
  };
  const h = blur(blur(mask, 5), 4);
  const img = new Uint8Array(W * W * 4);
  for (let i = 0; i < W * W; i++) {
    img[i * 4] = mask[i] * 255;
    img[i * 4 + 1] = Math.min(255, Math.pow(h[i], 0.7) * 255 * mask[i]);
    img[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(img, W, W, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  atlasTex = t;
  return t;
}

// ---------------------------------------------------------------- flekker
const DECAL_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec4 aDecal;
uniform float uTime;
varying vec2 vUv;
varying vec3 vCol;
varying float vWet;
varying vec2 vCell;
varying vec3 vWorld;
varying vec3 vAxU;
varying vec3 vAxV;
void main() {
  float age = uTime - aDecal.y;
  // Pytter vokser fram over aDecal.z sekunder
  float g = aDecal.z > 0.0 ? 0.2 + 0.8 * smoothstep(0.0, aDecal.z, age) : 1.0;
  vec3 p = position * vec3(g, 1.0, g);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv;
  vCell = vec2(mod(aDecal.x, 4.0), floor(aDecal.x / 4.0));
  vCol = instanceColor;
  // Fersk blod er vått og blankt, tørker til matt brunrødt
  vWet = aDecal.w * (1.0 - smoothstep(10.0, 45.0, age));
  mat3 im = mat3(modelMatrix * instanceMatrix);
  vAxU = normalize(im[0]);
  vAxV = normalize(im[2]);
  #include <fog_vertex>
}`;

const DECAL_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uAtlas;
uniform vec3 uSunW;
uniform vec3 uSunCol;
uniform vec3 uAmb;
varying vec2 vUv;
varying vec3 vCol;
varying float vWet;
varying vec2 vCell;
varying vec3 vWorld;
varying vec3 vAxU;
varying vec3 vAxV;
void main() {
  vec2 uv = (vCell + clamp(vUv, 0.02, 0.98)) / 4.0;
  vec4 t = texture2D(uAtlas, uv);
  if (t.r < 0.5) discard;
  float h = t.g;
  // Normal fra tykkelsen (endelige differanser i atlaset), lagt langs flekkens egne akser
  float tx = 1.5 / 512.0;
  float hx = texture2D(uAtlas, uv + vec2(tx, 0.0)).g - texture2D(uAtlas, uv - vec2(tx, 0.0)).g;
  float hy = texture2D(uAtlas, uv + vec2(0.0, tx)).g - texture2D(uAtlas, uv - vec2(0.0, tx)).g;
  vec3 N = normalize(vec3(0.0, 1.0, 0.0) - (hx * vAxU - hy * vAxV) * 5.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunW);
  float diff = 0.55 + 0.45 * max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 70.0) * vWet;
  // Tynne kanter er lysere og mer gjennomsiktige i fargen, tykk midte er mørk
  vec3 base = vCol * mix(1.25, 0.55, h);
  base = mix(base * vec3(0.55, 0.42, 0.4), base, 0.35 + 0.65 * vWet);
  vec3 col = base * diff * uAmb + uSunCol * spec * 1.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** Et lag med blodflekker på bakken. Ringbuffer: de eldste forsvinner når laget er fullt. */
export class BloodDecals {
  readonly mesh: THREE.InstancedMesh;
  private data: Float32Array;
  private attr: THREE.InstancedBufferAttribute;
  private idx = 0;
  private count = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  readonly mat: THREE.ShaderMaterial;

  constructor(readonly max = 1400) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.data = new Float32Array(max * 4);
    this.attr = new THREE.InstancedBufferAttribute(this.data, 4);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aDecal', this.attr);
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uAtlas: { value: bloodAtlas() }, uTime: { value: 0 }, uSunW: { value: sunUniforms.uSunDirW.value }, uSunCol: { value: new THREE.Color(1, 0.95, 0.9) },
        uAmb: { value: new THREE.Color(0.95, 0.92, 0.92) },
      }]),
      vertexShader: DECAL_VERT,
      fragmentShader: DECAL_FRAG,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    // Sola deles med vegetasjonen (samme objekt), så flekkene får lys fra riktig kant
    this.mat.uniforms.uSunW.value = sunUniforms.uSunDirW.value;
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 1;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  }

  get time() {
    return this.mat.uniforms.uTime.value as number;
  }

  update(dt: number) {
    this.mat.uniforms.uTime.value += dt;
    (this.mat.uniforms.uSunCol.value as THREE.Color).copy(sunUniforms.uSunCol.value).multiplyScalar(1.3);
  }

  /**
   * Legg en flekk. variant: 0-5 runde sprut, 6-9 retningssprut (+x peker i treffretningen), 10-11 drypp, 12-15 pytter.
   * grow = sekunder pytten bruker på å vokse (0 = med en gang). wet = 1 fersk, 0 gammel og tørr.
   */
  add(x: number, z: number, sx: number, sz: number, rot: number, col: THREE.Color, variant: number, y = 0.012, grow = 0, wet = 1) {
    const i = this.idx;
    this.e.set(0, rot, 0);
    this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(x, y + (i % 7) * 0.0006, z), this.q, this.s.set(sx, 1, sz));
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.setColorAt(i, col);
    this.data[i * 4] = variant;
    this.data[i * 4 + 1] = this.time;
    this.data[i * 4 + 2] = grow;
    this.data[i * 4 + 3] = wet;
    this.attr.addUpdateRange(i * 4, 4);
    this.attr.needsUpdate = true;
    this.mesh.instanceMatrix.addUpdateRange(i * 16, 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.addUpdateRange(i * 3, 3);
      this.mesh.instanceColor.needsUpdate = true;
    }
    this.idx = (this.idx + 1) % this.max;
    this.count = Math.min(this.max, this.count + 1);
    this.mesh.count = this.count;
  }

  clear() {
    this.idx = 0;
    this.count = 0;
    this.mesh.count = 0;
  }
}

// ---------------------------------------------------------------- dråper
interface Landing { t: number; x: number; z: number; size: number; vx: number; vz: number; r: number; g: number; b: number; decal: boolean }

/** Bloddråper på GPU. Landingen regnes ut på forhånd og legges i en kø. */
export class BloodDrops {
  readonly pool: Pool;
  private landings: Landing[] = [];
  private deaths: Float32Array;
  private di = 0;

  constructor(max = 3600, private onLand: (l: Landing) => void) {
    this.pool = new Pool(max, BLOOD_FRAG, {
      transparent: false, depthWrite: true, alphaToCoverage: true, fog: true, renderOrder: 4,
      uniforms: { uSunW: { value: sunUniforms.uSunDirW.value } },
    });
    this.pool.mat.uniforms.uSunW.value = sunUniforms.uSunDirW.value;
    this.deaths = new Float32Array(max);
  }

  get time() {
    return this.pool.time;
  }

  /** Antall dråper som fortsatt er i lufta (brukes av testene). */
  get live() {
    const t = this.time;
    let n = 0;
    for (let i = 0; i < this.deaths.length; i++) if (this.deaths[i] > t) n++;
    return n;
  }

  /**
   * Slipp ut en dråpe. Fargen er lineær. drag virker på startfarten (som i skyggeleggeren).
   * decal = om den skal lage en flekk der den lander.
   */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, r: number, g: number, b: number, life: number, drag: number, decal: boolean) {
    // Finn når y(t) = y0 + vy * F(t) - g t^2 / 2 treffer bakken (F = (1 - e^-kt) / k)
    const F = (t: number) => (drag > 1e-4 ? (1 - Math.exp(-drag * t)) / drag : t);
    const yAt = (t: number) => y + vy * F(t) - 0.5 * BLOOD_G * t * t;
    let land = -1;
    const step = 1 / 30;
    for (let t = step; t <= life; t += step) {
      if (yAt(t) <= 0.02) {
        let lo = t - step, hi = t;
        for (let k = 0; k < 7; k++) {
          const mid = (lo + hi) / 2;
          if (yAt(mid) <= 0.02) hi = mid;
          else lo = mid;
        }
        land = hi;
        break;
      }
    }
    const lifeUsed = land > 0 ? land + 0.02 : life;
    const speed = Math.hypot(vx, vy, vz);
    this.pool.emit(x, y, z, vx, vy, vz, 0, -BLOOD_G, 0, lifeUsed, drag, size, size * 0.85, speed > 2 ? 0.03 : 0.012, r, g, b, 0, r * 0.8, g * 0.8, b * 0.8, 0);
    this.deaths[this.di] = this.time + lifeUsed;
    this.di = (this.di + 1) % this.deaths.length;
    if (land > 0) {
      const e = Math.exp(-drag * land);
      this.landings.push({ t: this.time + land, x: x + vx * F(land), z: z + vz * F(land), size, vx: vx * e, vz: vz * e, r, g, b, decal });
    }
  }

  update(dt: number) {
    this.pool.update(dt);
    const t = this.time;
    if (!this.landings.length) return;
    let w = 0;
    for (let i = 0; i < this.landings.length; i++) {
      const l = this.landings[i];
      if (l.t <= t) this.onLand(l);
      else this.landings[w++] = l;
    }
    this.landings.length = w;
  }

  clear() {
    this.pool.clear();
    this.landings.length = 0;
    this.deaths.fill(0);
  }
}
