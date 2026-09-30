// GPU-partikler, lyn og en pool av punktlys.
// Partiklene følger instanced-spark-kontrakten i threejs-procedural-vfx (prosjektbiblioteket): faste pooler, hver
// partikkel har startposisjon, fart, akselerasjon, drag og fødselstid som attributter, og bevegelsen regnes ut
// analytisk på GPU. CPU skriver bare når noe slippes ut (ringbuffer), og ingen effekt eier egne mesher.
// Farger er HDR med et bevisst hierarki: gnistglimt > lyn og magi > flammer > glør > vanlig lys, så bloom
// svarer på lysstyrken i stedet for å være formen på effekten.
import * as THREE from 'three';
import { wind } from './wind';
import { qualityRank } from './post';
import { screenFX } from './screenfx';

const STRIDE = 24;

/** Former i glødpoolen. */
export const K = { GLOW: 0, SPARK: 1, FLAME: 2, RING: 3, DOT: 4 } as const;

export const GLOW_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform float uKill;
uniform vec3 uWindV;
attribute vec3 aP;
attribute vec3 aV;
attribute vec3 aA;
attribute vec4 aT;
attribute vec3 aS;
attribute vec4 aC0;
attribute vec4 aC1;
varying vec2 vUv;
varying vec3 vCol;
varying float vKind;
varying float vU;
varying float vSeed;
varying float vSink;
void main() {
  float age = uTime - aT.x;
  if (age < 0.0 || age >= aT.y || aT.x < uKill) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  float u = age / aT.y;
  float k = aT.z;
  float dtk = k > 0.0001 ? (1.0 - exp(-k * age)) / k : age;
  vec3 p = aP + aV * dtk + 0.5 * aA * age * age + uWindV * aC1.w * age;
  vec3 vel = aV * exp(-k * age) + aA * age + uWindV * aC1.w;
  // Det som faller gjennom gulvet blir liggende på det og tones ut
  vSink = smoothstep(-0.35, 0.0, p.y);
  p.y = max(p.y, 0.02);
  float size = mix(aS.x, aS.y, u);
  float kind = aC0.w;
  vec2 c = position.xy;
  // Ringer (sjokkbølger) ligger flatt på bakken, alt annet vender mot kameraet
  if (kind > 2.5 && kind < 3.5) p += vec3(c.x, 0.0, c.y) * size;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
  vec2 q = vec2(0.0);
  if (kind > 2.5 && kind < 3.5) {
    q = vec2(0.0);
  } else if (aS.z > 0.0 && dot(vv.xy, vv.xy) > 1e-6) {
    vec2 d = normalize(vv.xy);
    vec2 n = vec2(-d.y, d.x);
    q = d * c.y * (size + length(vv.xy) * aS.z) + n * c.x * size;
  } else if (kind > 1.5 && kind < 2.5) {
    // Flammer peker opp og er litt høyere enn brede
    q = vec2(c.x, c.y * 1.5 + 0.2) * size;
  } else {
    float ang = aT.w * 6.2831 + age * (aT.w - 0.5) * 3.0;
    float cs = cos(ang), sn = sin(ang);
    q = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y) * size;
  }
  mv.xy += q;
  gl_Position = projectionMatrix * mv;
  vUv = c + 0.5;
  vCol = mix(aC0.rgb, aC1.rgb, u);
  vKind = kind;
  vU = u;
  vSeed = aT.w;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;

export const NOISE = /* glsl */ `
float vh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vh(i), vh(i + vec2(1.0, 0.0)), u.x), mix(vh(i + vec2(0.0, 1.0)), vh(i + vec2(1.0)), u.x), u.y); }
float fbm(vec2 p) { return vn(p) * 0.55 + vn(p * 2.1 + 3.7) * 0.3 + vn(p * 4.3 + 9.1) * 0.15; }`;

const GLOW_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
varying vec2 vUv;
varying vec3 vCol;
varying float vKind;
varying float vU;
varying float vSeed;
varying float vSink;
${NOISE}
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float a;
  if (vKind < 0.5) {
    a = exp(-dot(c, c) * 3.2);
  } else if (vKind < 1.5) {
    float across = 1.0 - smoothstep(0.0, 1.0, abs(c.x));
    float along = 1.0 - smoothstep(0.55, 1.0, abs(c.y));
    a = across * across * along;
  } else if (vKind < 2.5) {
    // Tungeformet flamme med flytende støy
    vec2 p = c;
    float w = 1.0 - smoothstep(-1.0, 1.0, p.y) * 0.65;
    float n = fbm(vec2(p.x * 2.6 + vSeed * 13.0, p.y * 1.8 - uTime * 3.2));
    float r = length(vec2(p.x / max(0.25, w), (p.y + 0.35) * 0.9));
    a = (1.0 - smoothstep(0.25, 1.0, r + (n - 0.5) * 0.7)) * (0.65 + 0.35 * n);
  } else if (vKind < 3.5) {
    float d = length(c);
    a = smoothstep(0.62, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d));
  } else {
    float d = length(c);
    a = pow(max(0.0, 1.0 - d), 3.0);
  }
  float fade = smoothstep(0.0, 0.06, vU) * (1.0 - smoothstep(0.62, 1.0, vU)) * vSink;
  gl_FragColor = vec4(vCol * a * fade, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const SMOKE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uSunV;
uniform vec3 uAmb;
varying vec2 vUv;
varying vec3 vCol;
varying float vKind;
varying float vU;
varying float vSeed;
varying float vSink;
${NOISE}
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float d = length(c);
  float a;
  vec3 col = vCol;
  if (vKind > 0.5) {
    // Snøfnugg og aske: små, harde prikker
    a = 1.0 - smoothstep(0.55, 1.0, d);
  } else {
    float n = fbm(c * 1.7 + vSeed * 9.0 + vec2(0.0, -uTime * 0.15));
    // Kantene i smoothstep må stå i stigende rekkefølge (ellers udefinert i GLSL)
    a = (1.0 - smoothstep(0.25, 1.0, d + (n - 0.5) * 0.8)) * 0.75;
    // Falsk kulenormal gir røyken volum
    vec3 nrm = vec3(c, sqrt(max(0.0, 1.0 - d * d)));
    float sh = 0.55 + 0.45 * max(dot(nrm, uSunV), 0.0);
    col = vCol * (uAmb * 0.6 + sh * 0.7) * (0.8 + 0.4 * n);
  }
  float fade = smoothstep(0.0, 0.12, vU) * (1.0 - smoothstep(0.55, 1.0, vU)) * vSink;
  gl_FragColor = vec4(col, a * fade * vSeedOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export interface PoolOpts {
  blending?: THREE.Blending;
  transparent?: boolean;
  depthWrite?: boolean;
  alphaToCoverage?: boolean;
  fog?: boolean;
  vertex?: string;
  uniforms?: Record<string, THREE.IUniform>;
  renderOrder?: number;
}

/** En fast pool med partikler i en ringbuffer. Samme attributter for alle pooler (se GLOW_VERT). */
export class Pool {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private buf: THREE.InstancedInterleavedBuffer;
  private data: Float32Array;
  private head = 0;
  private lo = Infinity;
  private hi = -1;
  private wrapped = false;

  constructor(readonly max: number, frag: string, o: PoolOpts = {}) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.data = new Float32Array(max * STRIDE);
    for (let i = 0; i < max; i++) this.data[i * STRIDE + 9] = -1e9;
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buf.setUsage(THREE.DynamicDrawUsage);
    const at = (name: string, size: number, off: number) => geo.setAttribute(name, new THREE.InterleavedBufferAttribute(this.buf, size, off));
    at('aP', 3, 0);
    at('aV', 3, 3);
    at('aA', 3, 6);
    at('aT', 4, 9);
    at('aS', 3, 13);
    at('aC0', 4, 16);
    at('aC1', 4, 20);
    geo.instanceCount = max;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uKill: { value: -1e8 }, uWindV: { value: new THREE.Vector3() },
        uSunV: { value: new THREE.Vector3(0.3, 0.7, 0.5).normalize() }, uAmb: { value: new THREE.Color(0.7, 0.7, 0.75) },
      }, o.uniforms ?? {}]),
      vertexShader: o.vertex ?? GLOW_VERT,
      fragmentShader: frag.replace('vSeedOpacity', '1.0'),
      blending: o.blending ?? THREE.NormalBlending,
      transparent: o.transparent ?? true,
      depthWrite: o.depthWrite ?? false,
      alphaToCoverage: o.alphaToCoverage ?? false,
      fog: o.fog ?? false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = o.renderOrder ?? (o.blending === THREE.AdditiveBlending ? 6 : 5);
  }

  get time() {
    return this.mat.uniforms.uTime.value as number;
  }

  /** Slipp ut én partikkel. Farger er lineære HDR-verdier. */
  emit(
    px: number, py: number, pz: number, vx: number, vy: number, vz: number, ax: number, ay: number, az: number,
    life: number, drag: number, s0: number, s1: number, stretch: number,
    r0: number, g0: number, b0: number, kind: number, r1: number, g1: number, b1: number, windAmt: number,
  ) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    if (this.head === 0) this.wrapped = true;
    const d = this.data;
    const o = i * STRIDE;
    d[o] = px; d[o + 1] = py; d[o + 2] = pz;
    d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    d[o + 6] = ax; d[o + 7] = ay; d[o + 8] = az;
    d[o + 9] = this.time; d[o + 10] = life; d[o + 11] = drag; d[o + 12] = Math.random();
    d[o + 13] = s0; d[o + 14] = s1; d[o + 15] = stretch;
    d[o + 16] = r0; d[o + 17] = g0; d[o + 18] = b0; d[o + 19] = kind;
    d[o + 20] = r1; d[o + 21] = g1; d[o + 22] = b1; d[o + 23] = windAmt;
    this.lo = Math.min(this.lo, i);
    this.hi = Math.max(this.hi, i);
  }

  update(dt: number) {
    const u = this.mat.uniforms;
    u.uTime.value += dt;
    wind.velocity(0, 0, u.uWindV.value);
    // Three tømmer områdene selv når bufferen er lastet opp. Vi legger bare til, så utslipp fra frames som ikke
    // tegnes (testene hopper over tegning) også kommer med ved neste opplasting.
    if (this.wrapped) {
      this.buf.clearUpdateRanges();
      this.buf.needsUpdate = true;
      this.wrapped = false;
    } else if (this.hi >= this.lo) {
      this.buf.addUpdateRange(this.lo * STRIDE, (this.hi - this.lo + 1) * STRIDE);
      this.buf.needsUpdate = true;
    }
    this.lo = Infinity;
    this.hi = -1;
  }

  /** Drep alt som lever (scenebytte). */
  clear() {
    this.mat.uniforms.uKill.value = this.time + 1e-4;
  }
}

// ---------------------------------------------------------------- lyn
interface Bolt { mesh: THREE.Mesh; geo: THREE.BufferGeometry; from: THREE.Vector3; to: THREE.Vector3; t: number; strikes: number[]; width: number; color: THREE.Color }

const BOLT_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float core = pow(across, 5.0) * 2.4 + pow(across, 1.6) * 0.5;
  gl_FragColor = vec4(uCol * core * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const BOLT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ---------------------------------------------------------------- lyspool
export interface LightSource { pos: THREE.Vector3; color: THREE.Color; intensity: number; range: number; flicker: number; ph: number }
interface Flash { pos: THREE.Vector3; color: THREE.Color; intensity: number; range: number; t: number; dur: number }
/** Et punktlys og hvem som har det: en fast kilde (med toning w) eller et glimt. */
interface Slot { light: THREE.PointLight; src: LightSource | null; fl: Flash | null; w: number; want: boolean; d: number }

/** Faste kilder lenger unna kameraet enn dette får ikke lys. */
const LIGHT_RANGE = 26;

/**
 * Et fast antall punktlys som fordeles til de nærmeste lyskildene (fakler, fyrfat, lava) og til korte
 * lysglimt (treff, magi, lyn). Antallet endres aldri, så materialene kompileres ikke på nytt.
 * Fordelingen er portet fra Morbidium (src/15_rom3d.js, fordel): en kilde beholder lyset sitt så lenge den er
 * blant de N + 2 nærmeste, og bytter bare når en ventende kilde er 1,5 enheter nærmere. Den som mister lyset,
 * toner ut på 0,2 sekunder, og den nye toner inn på 0,25. Et glimt tar et ledig lys, eller et som er på vei ut.
 * Bare store glimt (eksplosjoner og lyn) tar lyset fra den fjerneste fakkelen, så faklene slukner ikke ved
 * hvert slag.
 */
export class LightPool {
  readonly lights: THREE.PointLight[] = [];
  private slots: Slot[] = [];
  private sources: LightSource[] = [];
  private flashes: Flash[] = [];
  private t = 0;
  /** Første fordeling etter clear(): lysene står fullt på med en gang, uten inntoning. */
  private fresh = true;
  /** Sekunder inn og ut når en kilde får eller mister et lys. */
  static FADE_IN = 0.25;
  static FADE_OUT = 0.2;
  /** Hvor mye nærmere en ventende kilde må være før den tar lyset fra en som har det. */
  static SLACK = 1.5;
  /** Glimt fra og med denne styrken kan ta lyset fra den fjerneste kilden. Svakere glimt tar bare ledige lys. */
  static STEAL = 15;
  /** Høyst så mange glimt samtidig. */
  static MAX_FLASHES = 2;

  constructor(group: THREE.Group, count = 4) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 10, 1.8);
      l.position.set(0, -100, 0);
      this.lights.push(l);
      this.slots.push({ light: l, src: null, fl: null, w: 0, want: false, d: 0 });
      group.add(l);
    }
  }

  /** Fast lyskilde (fakkel, fyrfat, lavasprekk). flicker 0..1. Gir kilden, så den kan flyttes (et fyrfat som veltes). */
  source(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, range = 10, flicker = 0.3): LightSource {
    const src = { pos: pos.clone(), color: new THREE.Color(color), intensity, range, flicker, ph: Math.random() * 100 };
    this.sources.push(src);
    return src;
  }

  /** Kort lysglimt. */
  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, range = 8, dur = 0.15) {
    if (this.flashes.length > 6) this.flashes.shift();
    this.flashes.push({ pos: pos.clone(), color: new THREE.Color(color), intensity, range, t: 0, dur });
  }

  clear() {
    this.sources.length = 0;
    this.flashes.length = 0;
    for (const s of this.slots) {
      s.src = null;
      s.fl = null;
      s.w = 0;
      s.light.intensity = 0;
    }
    this.fresh = true;
  }

  /** Hvem som har lysene nå (for testene): indeks i kildelista, 'flash' eller null. */
  owners() {
    return this.slots.map((s) => (s.fl ? 'flash' : s.src ? this.sources.indexOf(s.src) : null));
  }

  update(dt: number, camX: number) {
    this.t += dt;
    const S = this.slots, N = S.length;
    // Glimt som er ferdige, gir fra seg lyset
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      if (f.t < f.dur) continue;
      this.flashes.splice(i, 1);
      for (const s of S) if (s.fl === f) s.fl = null;
    }
    // Faste kilder sortert etter avstand til kameraet
    const ranked = this.sources
      .map((s) => ({ s, d: Math.abs(s.pos.x - camX) + Math.abs(s.pos.z) * 0.3 }))
      .filter((e) => e.d < LIGHT_RANGE)
      .sort((a, b) => a.d - b.d);
    const rank = new Map<LightSource, number>();
    const dist = new Map<LightSource, number>();
    ranked.forEach((e, i) => {
      rank.set(e.s, i);
      dist.set(e.s, e.d);
    });
    // De som har lys, beholder det så lenge de er blant de N + 2 nærmeste. Utenfor rekkevidde er det slukket
    // (intensiteten er tonet ned mot kanten av rekkevidden allerede).
    for (const s of S) {
      if (!s.src) continue;
      const r = rank.get(s.src);
      if (r === undefined) {
        s.src = null;
        s.w = 0;
        continue;
      }
      s.d = dist.get(s.src)!;
      s.want = r < N + 2;
    }
    const owned = new Set<LightSource>();
    for (const s of S) if (s.src) owned.add(s.src);
    // Glimt: de sterkeste først. Ledig lys, så et som er på vei ut, og bare for store glimt den fjerneste kilden.
    let flashSlots = S.filter((s) => s.fl).length;
    const waitingFl = this.flashes
      .filter((f) => !S.some((s) => s.fl === f))
      .sort((a, b) => b.intensity * (1 - b.t / b.dur) - a.intensity * (1 - a.t / a.dur));
    for (const f of waitingFl) {
      if (flashSlots >= Math.min(N, LightPool.MAX_FLASHES)) break;
      let slot = S.find((s) => !s.src && !s.fl);
      if (!slot) slot = S.filter((s) => s.src && !s.want && !s.fl).sort((a, b) => a.w - b.w)[0];
      if (!slot && f.intensity >= LightPool.STEAL) {
        for (const s of S) if (s.src && !s.fl && (!slot || s.d > slot.d)) slot = s;
      }
      if (!slot) continue;
      if (slot.src) owned.delete(slot.src);
      slot.src = null;
      slot.fl = f;
      slot.w = 1;
      flashSlots++;
    }
    // Kildene som venter: de N nærmeste som ikke har lys. Den nærmeste av dem tar lyset fra den fjerneste som har
    // det, bare når det ikke er plass ellers og den er SLACK nærmere.
    const waiting = ranked.slice(0, N).map((e) => e.s).filter((s) => !owned.has(s));
    const free = S.filter((s) => !s.fl && (!s.src || !s.want)).length;
    if (waiting.length > free) {
      let far: Slot | null = null;
      for (const s of S) if (s.src && s.want && !s.fl && (!far || s.d > far.d)) far = s;
      if (far && dist.get(waiting[0])! + LightPool.SLACK < far.d) far.want = false;
    }
    // Toning, og ledige lys til de som venter
    for (const s of S) {
      if (s.fl) continue;
      if (s.src) {
        s.w = s.want ? Math.min(1, s.w + dt / LightPool.FADE_IN) : Math.max(0, s.w - dt / LightPool.FADE_OUT);
        if (!s.want && s.w <= 0) s.src = null;
      }
      if (!s.src) {
        const next = waiting.shift();
        if (next) {
          s.src = next;
          s.want = true;
          s.d = dist.get(next)!;
          s.w = this.fresh ? 1 : 0;
        } else s.w = 0;
      }
    }
    this.fresh = false;
    // Lysene følger kilden eller glimtet sitt
    for (const s of S) {
      const l = s.light;
      if (s.fl) {
        const f = s.fl;
        const k = 1 - f.t / f.dur;
        l.position.copy(f.pos);
        l.color.copy(f.color);
        l.intensity = f.intensity * k * k;
        l.distance = f.range;
        continue;
      }
      const src = s.src;
      if (!src) {
        l.intensity = 0;
        continue;
      }
      const fk = 1 - src.flicker * (0.5 + 0.25 * Math.sin(this.t * 13 + src.ph) + 0.25 * Math.sin(this.t * 7.3 + src.ph * 2));
      l.position.copy(src.pos);
      l.color.copy(src.color);
      // Ton ut mot kanten av rekkevidden så lys ikke spretter av og på
      l.intensity = src.intensity * fk * THREE.MathUtils.smoothstep(LIGHT_RANGE - s.d, 0, 6) * s.w;
      l.distance = src.range;
    }
  }
}

// ---------------------------------------------------------------- VFX
const tmpC = new THREE.Color();

/** Alle effekter i én gruppe som legges i hver scene (via Gore). */
export class VFX {
  readonly group = new THREE.Group();
  readonly glow: Pool;
  readonly smoke: Pool;
  readonly lights: LightPool;
  private bolts: Bolt[] = [];
  private cam: THREE.Camera | null = null;
  private camPos = new THREE.Vector3();

  constructor() {
    this.glow = new Pool(7000, GLOW_FRAG, { blending: THREE.AdditiveBlending, fog: false });
    this.smoke = new Pool(2400, SMOKE_FRAG, { blending: THREE.NormalBlending, fog: true });
    this.group.add(this.smoke.mesh, this.glow.mesh);
    this.lights = new LightPool(this.group, 4);
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3 * 2), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(160 * 2 * 2), 2));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uCol: { value: new THREE.Color() }, uAlpha: { value: 0 } },
        vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 7;
      this.group.add(mesh);
      this.bolts.push({ mesh, geo, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 99, strikes: [], width: 0.2, color: new THREE.Color() });
    }
  }

  /** Mengdefaktor per grafikknivå. */
  get q() {
    return [0.5, 0.75, 1, 1.35][qualityRank()];
  }

  setCamera(cam: THREE.Camera) {
    this.cam = cam;
  }

  setLook(sunDir: THREE.Vector3, ambient: THREE.Color) {
    this.smoke.mat.uniforms.uSunV.value.copy(sunDir).normalize();
    (this.smoke.mat.uniforms.uAmb.value as THREE.Color).copy(ambient);
  }

  // ---------------------------------------------------------------- effekter
  /** Gnister ved treff: strekte, HDR-hvite som kjøles til oransje, pluss et kort glimt og lys. */
  sparks(pos: THREE.Vector3, count: number, color: THREE.ColorRepresentation = '#ffd35a', speed = 6, dirX = 0, dirY = 0) {
    const c = tmpC.set(color);
    const n = Math.max(1, Math.round(count * this.q * 1.6));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.9);
      const vx = Math.cos(a) * sp + dirX * speed * 0.6, vy = Math.sin(a) * sp * 0.8 + 1.5 + dirY * speed * 0.6;
      this.glow.emit(pos.x, pos.y, pos.z + 0.1, vx, vy, (Math.random() - 0.5) * sp * 0.6, 0, -14, 0,
        0.25 + Math.random() * 0.35, 2.2, 0.05, 0.02, 0.035,
        c.r * 9, c.g * 7, c.b * 5, K.SPARK, 1.4, 0.25, 0.05, 0);
    }
    this.glow.emit(pos.x, pos.y, pos.z + 0.12, 0, 0, 0, 0, 0, 0, 0.12, 0, 0.5, 1.4, 0, c.r * 5, c.g * 5, c.b * 5, K.GLOW, c.r, c.g * 0.6, c.b * 0.3, 0);
    if (count >= 5) this.lights.flash(pos, color, 6, 6, 0.1);
  }

  /** Glødende glimt som vokser (magi, eksplosjoner). */
  flare(pos: THREE.Vector3, size: number, color: THREE.ColorRepresentation, life = 0.25) {
    const c = tmpC.set(color);
    this.glow.emit(pos.x, pos.y, pos.z + 0.1, 0, 0, 0, 0, 0, 0, life, 0, size * 0.6, size * 2.4, 0, c.r * 4, c.g * 4, c.b * 4, K.GLOW, c.r * 0.5, c.g * 0.3, c.b * 0.3, 0);
    if (size > 1) this.lights.flash(pos, color, 8 * Math.min(3, size), 7 + size * 2, life * 1.5);
  }

  /** Flammer (fakler, bål, ildpust), med glør og litt røyk. */
  fire(pos: THREE.Vector3, count: number, spread = 0.3, up = 2, cols: string[]) {
    const n = Math.max(1, Math.round(count * this.q));
    for (let i = 0; i < n; i++) {
      const c = tmpC.set(cols[Math.floor(Math.random() * cols.length)]);
      const s = 0.3 + Math.random() * 0.35;
      this.glow.emit(pos.x + (Math.random() - 0.5) * spread * 2, pos.y + (Math.random() - 0.5) * spread, pos.z + (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.5, up * (0.5 + Math.random() * 0.5), 0, 0, 1.2, 0,
        0.35 + Math.random() * 0.35, 1.2, s, s * 0.35, 0,
        c.r * 3.2 + 0.6, c.g * 2.6 + 0.3, c.b * 1.8, K.FLAME, c.r * 1.4, c.g * 0.3, c.b * 0.1, 0.35);
    }
    if (Math.random() < 0.35 * this.q) {
      const c = tmpC.set(cols[0]);
      this.glow.emit(pos.x + (Math.random() - 0.5) * spread, pos.y + 0.2, pos.z, (Math.random() - 0.5) * 0.8, up * 0.8 + Math.random(), 0, 0, 0.6, 0,
        1.4 + Math.random() * 1.6, 0.4, 0.05, 0.02, 0, c.r * 6, c.g * 4, c.b * 2, K.DOT, 1.2, 0.2, 0.05, 1);
    }
    if (Math.random() < 0.12 * this.q) this.puff(pos.x, pos.y + 0.8, pos.z - 0.1, 0.4, up * 0.5, '#2a2420', 0.5, 1.8, 2.2, 0.35);
  }

  /** Stemningspartikler (glør, ildfluer, gnister). glow = additiv, ellers mørke flak (aske, snø). */
  ambient(x: number, y: number, z: number, vx: number, vy: number, color: string, size: number, life: number, glow = false, grav = 0) {
    const c = tmpC.set(color);
    if (glow) {
      this.glow.emit(x, y, z, vx, vy, 0, 0, -grav, 0, life, 0, size * 0.9, size * 0.5, 0, c.r * 3.5, c.g * 3.5, c.b * 3.5, K.DOT, c.r * 1.5, c.g * 1.5, c.b * 1.5, 0.4);
    } else {
      this.smoke.emit(x, y, z, vx, vy, 0, 0, -grav, 0, life, 0, size * 1.2, size, 0, c.r, c.g, c.b, 1, c.r, c.g, c.b, 0.8);
    }
  }

  /** Røykdott. */
  puff(x: number, y: number, z: number, spread: number, rise: number, color: string, s0: number, s1: number, life: number, windAmt = 0.6) {
    const c = tmpC.set(color);
    this.smoke.emit(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread * 0.4,
      (Math.random() - 0.5) * 0.4, rise, 0, 0, 0.1, 0, life * (0.8 + Math.random() * 0.4), 0.8, s0, s1, 0,
      c.r, c.g, c.b, 0, c.r * 0.9, c.g * 0.9, c.b * 0.9, windAmt);
  }

  /** Støvsky fra føtter og landinger. */
  dust(pos: THREE.Vector3, count: number, color = '#c9b48a') {
    const n = Math.max(1, Math.round(count * this.q));
    const c = tmpC.set(color);
    for (let i = 0; i < n; i++) {
      const s = 0.25 + Math.random() * 0.25;
      this.smoke.emit(pos.x + (Math.random() - 0.5) * 0.6, 0.12 + Math.random() * 0.15, pos.z + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 2.4, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6, 0, 0.2, 0,
        0.5 + Math.random() * 0.4, 2.8, s, s * 3, 0, c.r, c.g, c.b, 0, c.r * 0.95, c.g * 0.95, c.b * 0.95, 0.3);
    }
  }

  /** Sjokkbølge langs bakken (landinger, magi, eksplosjoner). */
  shockwave(pos: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, life = 0.35) {
    const c = tmpC.set(color);
    this.glow.emit(pos.x, pos.y + 0.1, pos.z + 0.05, 0, 0, 0, 0, 0, 0, life, 0, radius * 0.3, radius * 2, 0, c.r * 3, c.g * 3, c.b * 3, K.RING, c.r * 0.4, c.g * 0.4, c.b * 0.4, 0);
  }

  /** Eksplosjon: glimt, flammer, gnister, røyk og lys. */
  explode(pos: THREE.Vector3, size = 1, cols: string[] = ['#ffd35a', '#ff8a2a', '#ff4a10']) {
    this.flare(pos, 0.9 * size, cols[0], 0.22);
    this.shockwave(pos.clone().setY(0.05), 2.2 * size, cols[1]);
    for (let i = 0; i < 18 * size * this.q; i++) {
      const c = tmpC.set(cols[i % cols.length]);
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
      const sp = (2 + Math.random() * 5) * size;
      const s = (0.4 + Math.random() * 0.4) * size;
      this.glow.emit(pos.x, pos.y, pos.z, Math.cos(a) * sp * Math.cos(e), Math.abs(Math.sin(e)) * sp + 1, Math.sin(a) * sp * 0.4, 0, 1, 0,
        0.45 + Math.random() * 0.3, 3, s, s * 0.3, 0, c.r * 4, c.g * 3, c.b * 2, K.FLAME, c.r, c.g * 0.25, 0.02, 0);
    }
    this.sparks(pos, 14 * size, cols[0], 9 * size);
    for (let i = 0; i < 6 * size; i++) this.puff(pos.x, pos.y, pos.z - 0.2, 1.2 * size, 1.2, '#2a221e', 0.6 * size, 2.2 * size, 1.6, 0.5);
    this.lights.flash(pos, cols[1], 22 * size, 12 * size, 0.35);
    // Sjokkbølge og zoomslag i bildet, og varm luft som dirrer en stund
    screenFX.boom(pos, size);
    screenFX.addHeat(pos.clone().setY(0.2), 1.6 * size, 0.9, false, 1.6);
  }

  /** Lyn fra himmelen (eller fra en stav) til et punkt. Slår ned 2-3 ganger med ny form hver gang. */
  lightning(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation = '#9fd8ff', width = 0.22) {
    const b = this.bolts.find((x) => x.t > 0.6) ?? this.bolts[0];
    b.from.copy(from);
    b.to.copy(to);
    b.t = 0;
    b.width = width;
    b.color.set(color);
    b.strikes = [0, 0.1 + Math.random() * 0.05, 0.22 + Math.random() * 0.08];
    this.buildBolt(b);
    b.mesh.visible = true;
    (b.mesh.material as THREE.ShaderMaterial).uniforms.uCol.value.copy(b.color).multiplyScalar(14);
    this.sparks(to, 16, '#e8f6ff', 9);
    this.shockwave(to.clone().setY(0.05), 2.4, color);
    this.lights.flash(to, color, 40, 16, 0.4);
    for (let i = 0; i < 5; i++) this.puff(to.x, 0.3, to.z, 1.4, 0.8, '#5a5a60', 0.5, 1.8, 1.2, 0.3);
    // Nedslaget sender en sjokkbølge gjennom bildet
    screenFX.shock(to, 0.55, 0.6, 1.5);
  }

  private buildBolt(b: Bolt) {
    // Midtpunktforskyvning gir en takkete bane, og et par sidegreiner
    const pts: THREE.Vector3[][] = [];
    const main: THREE.Vector3[] = [b.from.clone(), b.to.clone()];
    const len = b.from.distanceTo(b.to);
    let off = len * 0.18;
    for (let it = 0; it < 5; it++) {
      const next: THREE.Vector3[] = [];
      for (let i = 0; i < main.length - 1; i++) {
        const m = main[i].clone().lerp(main[i + 1], 0.5);
        m.x += (Math.random() - 0.5) * off;
        m.z += (Math.random() - 0.5) * off * 0.3;
        next.push(main[i], m);
      }
      next.push(main[main.length - 1]);
      main.splice(0, main.length, ...next);
      off *= 0.55;
    }
    pts.push(main);
    for (let k = 0; k < 2; k++) {
      const i0 = 4 + Math.floor(Math.random() * (main.length - 12));
      const br: THREE.Vector3[] = [main[i0].clone()];
      const dir = new THREE.Vector3((Math.random() - 0.5) * 2, -1.2, 0).normalize();
      for (let s = 1; s < 8; s++) br.push(br[s - 1].clone().addScaledVector(dir, len * 0.04).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, 0)));
      pts.push(br);
    }
    const pos = b.geo.getAttribute('position') as THREE.BufferAttribute;
    const uv = b.geo.getAttribute('uv') as THREE.BufferAttribute;
    const cam = this.cam;
    if (cam) cam.getWorldPosition(this.camPos);
    let v = 0;
    const idx: number[] = [];
    for (const line of pts) {
      const w0 = line === pts[0] ? b.width : b.width * 0.5;
      for (let i = 0; i < line.length && v < 158; i++) {
        const p = line[i];
        const nxt = line[Math.min(i + 1, line.length - 1)], prv = line[Math.max(i - 1, 0)];
        const tan = nxt.clone().sub(prv).normalize();
        const toCam = this.camPos.clone().sub(p).normalize();
        const side = tan.cross(toCam).normalize().multiplyScalar(w0 * (1 - (i / line.length) * 0.6));
        pos.setXYZ(v, p.x - side.x, p.y - side.y, p.z - side.z);
        uv.setXY(v, 0, i / line.length);
        pos.setXYZ(v + 1, p.x + side.x, p.y + side.y, p.z + side.z);
        uv.setXY(v + 1, 1, i / line.length);
        if (i > 0) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
        v += 2;
      }
    }
    b.geo.setIndex(idx);
    pos.needsUpdate = true;
    uv.needsUpdate = true;
  }

  update(dt: number, camX: number) {
    this.glow.update(dt);
    this.smoke.update(dt);
    this.lights.update(dt, camX);
    for (const b of this.bolts) {
      if (!b.mesh.visible) continue;
      b.t += dt;
      const mat = b.mesh.material as THREE.ShaderMaterial;
      // Lynet blinker: lys ved hvert nedslag, så mørkt, og ny form ved neste nedslag
      let a = 0;
      for (let i = 0; i < b.strikes.length; i++) {
        const s = b.strikes[i];
        const age = b.t - s;
        const dur = i === 0 ? 0.12 : 0.07;
        if (age >= 0 && age < dur) {
          a = Math.max(a, 1 - (age / dur) * 0.5);
          if (age < dt && i > 0) this.buildBolt(b);
        }
      }
      mat.uniforms.uAlpha.value = a;
      if (b.t > 0.4) b.mesh.visible = false;
    }
  }

  clear() {
    this.glow.clear();
    this.smoke.clear();
    this.lights.clear();
    for (const b of this.bolts) {
      b.mesh.visible = false;
      b.t = 99;
    }
  }
}

