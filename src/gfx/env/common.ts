// Felles byggeklosser for 3D-miljøene: materialer, konturer, teksturer, himmel, sol med skygger og rekvisitter.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { valueNoise3, fbm3 } from '../noise';
import { plainCanvas, unitCanvas, INK, shade } from '../draw';
import { rand, pick, reseed, hashSeed } from '../../core/math';
import type { Gore } from '../gore';
import { images } from '../assets';
import type { Grade } from '../post';
import { SunShadow } from './sun';
import { screenFX } from '../screenfx';
import { STAGE_CAM } from '../stagecam';
import { withSurface, type SurfaceOpts } from './surface';
import type { Hole } from '../../data/hazards';
import { groundTexture, roadTexture, stoneTexture, tileTexture, sandTexture, woodTexture, lavaRockTexture, imageTexture } from './textures';

// ---------------------------------------------------------------- materialer
/**
 * Realistisk, lyssatt materiale for miljøet (PBR med skygger og tåke). Teksturer fra textures.ts har med seg
 * normalkart (og lavastein et glødekart) som tas i bruk automatisk, og alt får triplanar overflatedetalj
 * (surface.ts) med mindre surf er false. Emisjon gis HDR-styrke så bloom tar den (gfx/post.ts).
 */
export function lit(p: THREE.MeshStandardMaterialParameters = {}, surf: SurfaceOpts | false = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, ...p });
  const map = p.map as THREE.Texture | null | undefined;
  if (map?.userData.normalMap && !p.normalMap) m.normalMap = map.userData.normalMap as THREE.Texture;
  if (map?.userData.emissiveMap && !p.emissiveMap) {
    m.emissiveMap = map.userData.emissiveMap as THREE.Texture;
    m.emissive.set('#ffffff');
    m.emissiveIntensity = EMISSIVE_BOOST;
  }
  if (surf) withSurface(m, surf);
  return m;
}
export const EMISSIVE_BOOST = 2.4;
const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** Materialer med tekstur hører til teksturkopien (hvert brett får egne kopier, se share()) og ryddes med den. */
const mapMats = new WeakMap<THREE.Texture, Map<string, THREE.MeshStandardMaterial>>();
export function toon(color: string, map?: THREE.Texture, emissive?: string) {
  let cache = matCache;
  if (map) {
    let c = mapMats.get(map);
    if (!c) mapMats.set(map, (c = new Map()));
    cache = c;
    // Et bilde fra manifestet har egne farger; fargen fra kallstedet ville bare gjort det mørkere
    if (map.userData.ownColor) color = '#ffffff';
  }
  const k = color + (emissive ?? '');
  let m = cache.get(k);
  if (!m) {
    m = lit({ color, map: map ?? null });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = EMISSIVE_BOOST;
    }
    cache.set(k, m);
  }
  return m;
}
/**
 * Mesh med realistisk materiale. Den sjette parameteren var tykkelsen på en svart kontur (invertert skrog).
 * Konturene er fjernet fordi 3D-en skal se ekte ut, ikke tegnet (docs/STYLE_TARGET.md), men plassen er
 * beholdt så kallstedene slipper å endres.
 */
export function M(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, _outline = 0, map?: THREE.Texture, emissive?: string) {
  const m = new THREE.Mesh(geo, toon(color, map, emissive));
  m.position.set(x, y, z);
  return m;
}

export function canvasTex(cv: HTMLCanvasElement | HTMLImageElement, repeat = true) {
  const t = new THREE.Texture(cv);
  t.needsUpdate = true;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- teksturer
/** Jord, gress eller snø (se textures.ts). Samme tekstur gjenbrukes for samme farger. */
const texCache = new Map<string, THREE.Texture>();
/** Kopi som deler bildedata (og GPU-teksturen) med originalen, men har egen repeat og offset. */
function share(t: THREE.Texture) {
  // clone() kopierer userData via JSON, og det tåler ikke teksturene som ligger der
  const ud = t.userData;
  t.userData = {};
  const c = t.clone();
  t.userData = ud;
  for (const k of ['normalMap', 'emissiveMap']) {
    const src = ud[k] as THREE.Texture | undefined;
    if (!src) continue;
    const m = src.clone();
    m.repeat = c.repeat;
    m.offset = c.offset;
    c.userData[k] = m;
  }
  return c;
}
const cached = (key: string, make: () => THREE.Texture) => {
  let t = texCache.get(key);
  if (!t) texCache.set(key, (t = make()));
  return share(t);
};

/**
 * Tekstur fra manifestet ("textures" i public/assets/manifest.json) når den finnes, ellers den prosedyrelagde.
 * Navnene og hva bildene skal vise står i docs/ART_PROMPTS.md. fringe gir veikant, glow gir glødende lava, og
 * tint lar fargen fra kallstedet tone bildet (ellers vises bildet i sine egne farger).
 */
export function texFile(name: string, fallback: () => THREE.Texture, opt: { fringe?: boolean; glow?: boolean; tint?: boolean } = {}) {
  const img = images.textures[name];
  if (!img) return fallback();
  const t = cached('f:' + name, () => imageTexture(img, opt.fringe, opt.glow));
  t.userData.ownColor = !opt.tint;
  return t;
}
export const groundTex = (base: string, specks: string[], blade: string | null) =>
  cached('g' + base + specks.join() + blade, () => groundTexture(base, specks, blade));

/** Grusvei med hjulspor, steiner og ujevn kant. */
export const roadTex = (base: string, specks: string[], rut: string, stones: string[]) =>
  cached('r' + base + specks.join() + rut + stones.join(), () => roadTexture(base, specks, rut, stones));

export const stoneTex = (base = '#8a8f99', mortar = '#4b4e57', bw = 64, bh = 32) =>
  cached('s' + base + mortar + bw + 'x' + bh, () => stoneTexture(base, mortar, bw, bh));

export const tileTex = (base = '#77706a', grout = '#3e3a36') => cached('t' + base + grout, () => tileTexture(base, grout));

export const sandTex = (base = '#b89a6a', specks = ['#a88a5a', '#c7aa7a', '#9e8050']) =>
  cached('d' + base + specks.join(), () => sandTexture(base, specks));

export const woodTex = () => cached('w', () => woodTexture());

/** Svart stein med glødende lavasprekker. */
export const lavaRockTex = () => cached('l', () => lavaRockTexture());

// ---------------------------------------------------------------- himmel og skyer
export interface Atmosphere {
  /** Retning mot sola på himmelen (kan være lavere enn lyset for et solnedgangspreg). */
  sun: [number, number, number];
  turbidity: number;
  rayleigh: number;
  mie?: number;
  mieG?: number;
  /** Skydekke 0 til 1 og tetthet. */
  clouds?: number;
  cloudDensity?: number;
  /** Lysstyrke (himmelen er laget for eksponering rundt 0.5). */
  gain?: number;
}

/**
 * Fysisk basert himmel (spredning i atmosfæren etter Preetham, med prosedyreskyer) fra three sine tillegg.
 * Den ligger alltid bakerst og følger kameraet.
 */
export function physicalSky(a: Atmosphere) {
  const s = new Sky();
  s.scale.setScalar(4000);
  const mat = s.material as THREE.ShaderMaterial;
  const u = mat.uniforms;
  u.turbidity.value = a.turbidity;
  u.rayleigh.value = a.rayleigh;
  u.mieCoefficient.value = a.mie ?? 0.005;
  u.mieDirectionalG.value = a.mieG ?? 0.8;
  (u.sunPosition.value as THREE.Vector3).set(...a.sun).normalize();
  u.cloudCoverage.value = a.clouds ?? 0.4;
  u.cloudDensity.value = a.cloudDensity ?? 0.45;
  u.skyGain = { value: a.gain ?? 0.55 };
  mat.fragmentShader = mat.fragmentShader
    .replace('uniform float time;', 'uniform float time;\nuniform float skyGain;')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * skyGain, 1.0 );');
  s.renderOrder = -10;
  s.frustumCulled = false;
  s.userData.sky = true;
  return s;
}

export function sky(top: string, mid: string, bottom: string, biome?: string) {
  const img = biome ? images.sky[biome] : undefined;
  if (img) {
    // Panoramaet går fire ganger rundt sylinderen (bildet må være sømløst i sidene). Negativ repeat snur det
    // riktig vei sett innenfra, og offset legger midten av et bilde rett bak brettet (mot -z). Sylinderen går
    // fra y -25 til 85, så horisonten ligger omtrent 73 prosent ned i bildet og det meste over den synes.
    const t = canvasTex(img, false);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -4;
    t.offset.x = 0.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(170, 170, 110, 64, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.position.y = 30;
    m.renderOrder = -10;
    m.userData.skyImage = true;
    return m;
  }
  const geo = new THREE.SphereGeometry(180, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.55, h)) : mix(bottom, mid, smoothstep(-0.1, 0.08, h));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  return m;
}

export function cloudCanvas(fill = '#fff3d6') {
  return plainCanvas(512, 200, (c) => {
    c.fillStyle = fill;
    c.beginPath();
    for (const [x, y, r] of [[120, 130, 60], [200, 95, 80], [300, 105, 70], [380, 135, 55], [250, 145, 70]]) {
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, Math.PI * 2);
    }
    c.fill();
  });
}

export function spriteMesh(cv: HTMLCanvasElement, w: number, h: number) {
  const t = canvasTex(cv, false);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
}

// ---------------------------------------------------------------- generatorer
/**
 * Pynten i et miljø er delt i generatorer (trær, gress, palisade, silhuetter osv.) som brettfila kan slå av
 * (`generators` i src/data/layouts, se docs/PLAN_BRETT_GORR_AI.md). Hver generator starter på sitt eget frø, så
 * en generator som slås av, ikke flytter pynten i de andre. Brettverkstedet lister navnene som ble brukt.
 */
const usedGens: string[] = [];
export interface GenOpts {
  seed?: number;
  gen?: Record<string, boolean>;
}
/** Er generatoren på? Starter samtidig tallrekka for den på et fast frø (når brettet bygges med frø). */
export function gen(o: GenOpts, key: string): boolean {
  if (!usedGens.includes(key)) usedGens.push(key);
  reseed(((o.seed ?? 0) ^ hashSeed(key)) >>> 0);
  return o.gen?.[key] !== false;
}
/** Eget frø for en del som ikke kan slås av (for eksempel leiren i nattleiren), så de andre ikke flytter den. */
export function genSeed(o: GenOpts, key: string) {
  reseed(((o.seed ?? 0) ^ hashSeed(key)) >>> 0);
}
/** Tøm lista over generatorer (før et miljø bygges). */
export function resetGenerators() {
  usedGens.length = 0;
}
/** Generatorene det siste miljøet brukte, i rekkefølge. */
export function usedGenerators() {
  return usedGens.slice();
}

// ---------------------------------------------------------------- Env
export interface Env {
  group: THREE.Group;
  update(dt: number, t: number, camX: number): void;
  fogColor: string;
  cheer?(power: number): void;
  /** Fargegradering og linse for dette miljøet (se gfx/post.ts og env/grades.ts). */
  grade?: Partial<Grade>;
  /** Bålene på brettet (satt av campfire()). Stemningen knitrer sterkere nær dem (core/ambience.ts). */
  fires?: THREE.Vector3[];
  /** Fossene (satt av waterfall() i props.ts). Fossesuset blir sterkere nær dem. */
  waters?: THREE.Vector3[];
  /** Ting som kan veltes (fyrfatene i props.ts). Stage velter dem når slag, kastede fiender eller bakkeslag treffer. */
  tippables?: Tippable[];
  /** Regn, 0..1: vanndråper treffer glasset og renner (gfx/screenwet.ts). Ingen brett har regn ennå. */
  rain?: number;
  /** Generatorene miljøet brukte (satt av Stage og editoren etter bygging, se gen()). */
  generators?: string[];
}

/** Noe som kan veltes (et fyrfat). tip() gir hvor glørne havner og hvor lenge de brenner, eller null om det alt er veltet. */
export interface Tippable {
  x: number;
  z: number;
  tipped: boolean;
  tip(): { x: number; z: number; t: number } | null;
}

export interface Look {
  /** Retning mot sola (skyggene faller motsatt vei). */
  sunDir?: [number, number, number];
  sky: [string, string, string];
  bg: string;
  fog: [string, number, number];
  hemi: [string, string, number];
  sun: [string, number];
  ground: THREE.Texture;
  road: THREE.Texture;
  clouds?: string;
  sunDisk?: string;
  biome?: string;
  /** Fysisk himmel i stedet for fargeovergangen (dagbrettene). */
  atmosphere?: Atmosphere;
  /** Hull i bakken og veien (juvet, se data/hazards.ts). */
  holes?: Hole[];
}

/**
 * Flatt plan i xz sett ovenfra (W langs x, H langs z, midt i cx, cz) med firkantede hull, laget av rektangler med
 * samme UV som ett helt plan, så teksturen går i ett. Brukes når et brett har juv.
 */
function holedPlane(W: number, H: number, cx: number, cz: number, holes: Hole[]) {
  const xmin = cx - W / 2, xmax = cx + W / 2, zmin = cz - H / 2, zmax = cz + H / 2;
  const rects: [number, number, number, number][] = [];
  const hs = holes.filter((h) => h.x1 > xmin && h.x0 < xmax && h.z1 > zmin && h.z0 < zmax).sort((a, b) => a.x0 - b.x0);
  let x = xmin;
  for (const h of hs) {
    const a = Math.max(x, h.x0), b = Math.min(xmax, h.x1);
    if (a > x) rects.push([x, a, zmin, zmax]);
    if (h.z0 > zmin) rects.push([a, b, zmin, Math.min(zmax, h.z0)]);
    if (h.z1 < zmax) rects.push([a, b, Math.max(zmin, h.z1), zmax]);
    x = Math.max(x, b);
  }
  if (x < xmax) rects.push([x, xmax, zmin, zmax]);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const [x0, x1, z0, z1] of rects) {
    const i = pos.length / 3;
    for (const [px, pz] of [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]) {
      pos.push(px - cx, 0, pz - cz);
      uv.push((px - xmin) / W, (zmax - pz) / H);
    }
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Himmel, lys, bakke og vei. Returnerer gruppen og en liste med oppdateringsfunksjoner. */
export function stageBase(scene: THREE.Scene, length: number, look: Look) {
  const g = new THREE.Group();
  const updates: ((dt: number, t: number, camX: number) => void)[] = [];
  scene.background = new THREE.Color(look.bg);
  // Eksponentiell tåke gir luftperspektiv som i virkeligheten: tettere jo lenger unna
  scene.fog = new THREE.FogExp2(look.fog[0], 1.25 / look.fog[2]);
  // Et himmelbilde fra manifestet går foran den fysiske himmelen
  const atmo = look.biome && images.sky[look.biome] ? undefined : look.atmosphere;
  if (atmo) {
    const s = physicalSky(atmo);
    g.add(s);
    const su = (s.material as THREE.ShaderMaterial).uniforms;
    updates.push((dt, _t, camX) => {
      su.time.value += dt;
      s.position.x = camX;
    });
  } else {
    const sk = sky(look.sky[0], look.sky[1], look.sky[2], look.biome);
    sk.userData.sky = true;
    g.add(sk);
    // Himmelen er uendelig langt unna: den følger kameraet
    updates.push((_dt, _t, camX) => {
      sk.position.x = camX;
    });
  }
  // Et himmelbilde har sin egen sol, måne og skyer, så de tegnede legges ikke oppå
  const skyImg = !!(look.biome && images.sky[look.biome]);
  const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]);
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
  g.add(hemi);
  const shadow = new SunShadow(g, sun, new THREE.Vector3(...(look.sunDir ?? [-20, 30, 20])));
  shadow.update(0);
  updates.push((_dt, _t, camX) => shadow.update(camX + 3));

  // Ett bilde dekker 5 x 5 enheter (omtrent 3.5 x 3.5 meter), så teksturer fra ChatGPT blir ikke strukket
  look.ground.repeat.set((length + 140) / 5, 12);
  const holes = look.holes ?? [];
  // Med juv lages bakken og veien av rektangler rundt hullene (samme tekstur og UV som et helt plan)
  const flat = (W: number, H: number, cx: number, cz: number) => {
    if (holes.length) return holedPlane(W, H, cx, cz, holes);
    const p = new THREE.PlaneGeometry(W, H);
    p.rotateX(-Math.PI / 2);
    return p;
  };
  const ground = new THREE.Mesh(flat(length + 140, 60, length / 2, -18), toon('#ffffff', look.ground));
  ground.position.set(length / 2, 0, -18);
  ground.userData.noCast = true;
  g.add(ground);
  look.road.repeat.set((length + 60) / 10, 1);
  const road = new THREE.Mesh(flat(length + 60, 8.4, length / 2, 0), lit({ map: look.road, alphaTest: 0.5 }));
  road.position.set(length / 2, 0.004, 0);
  road.userData.noCast = true;
  g.add(road);

  if (look.sunDisk && !atmo && !skyImg) {
    // Sola følger kameraet (den er uendelig langt unna) og lyser sterkt nok til å gi bloom
    const sd = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.sunDisk).multiplyScalar(2.2), fog: false }));
    sd.userData.sky = true;
    const dx = look.sunDir ? look.sunDir[0] / Math.max(0.2, -look.sunDir[2]) * 160 : 40;
    sd.position.set(dx, 20, -160);
    g.add(sd);
    updates.push((_dt, _t, camX) => {
      sd.position.x = camX + dx;
    });
  }
  if (look.clouds && !atmo && !skyImg) {
    const cloudT = canvasTex(cloudCanvas(look.clouds), false);
    const clouds: THREE.Mesh[] = [];
    for (let i = 0; i < Math.ceil(length / 16) + 4; i++) {
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(26, 10), new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      cl.position.set(i * 22 - 30 + rand(-6, 6), rand(20, 34), -140 + rand(-5, 5));
      const s = rand(0.7, 1.4);
      cl.scale.set(s, s, 1);
      g.add(cl);
      clouds.push(cl);
    }
    updates.push((dt) => {
      for (const cl of clouds) cl.position.x += dt * 0.4;
    });
  }
  scene.add(g);
  return { g, updates };
}

/**
 * Skru på skygger for alt i en gruppe: lyssatte materialer tar imot og kaster, sprites med alfatest kaster.
 * Konturskall kaster ikke (de ville gjort skyggene tykkere). userData.noCast på flate ting som bakken.
 */
export function applyShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material & { alphaTest?: number; transparent?: boolean };
    const isLit = (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial || (mat as THREE.MeshLambertMaterial).isMeshLambertMaterial;
    m.receiveShadow = !!isLit;
    if (m.userData.noCast || mat.transparent) return;
    m.castShadow = !!isLit || (mat.alphaTest ?? 0) > 0;
  });
}

/**
 * Gruppe for statiske rekvisitter (paliser, piler, steiner, staker). Alt her slås sammen per materiale og bit
 * langs x i finishEnv, så hundrevis av små mesher blir noen få tegnekall. Ikke legg ting som animeres her.
 */
export function staticGroup(g: THREE.Group) {
  let s = g.userData.static as THREE.Group | undefined;
  if (!s) {
    s = new THREE.Group();
    g.add(s);
    g.userData.static = s;
  }
  return s;
}

/** Slå sammen statiske mesher (se staticGroup). Bitene langs x beholder litt utsnittsfjerning. */
export function mergeStatic(g: THREE.Group, chunk = 30) {
  const s = g.userData.static as THREE.Group | undefined;
  if (!s) return;
  s.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(s.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; noCast: boolean }>();
  const meshes: THREE.Mesh[] = [];
  s.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material)) meshes.push(m);
  });
  const box = new THREE.Box3();
  const m4 = new THREE.Matrix4();
  for (const m of meshes) {
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    // Farger beholdes (steiner og hodeskaller bruker toppunktfarger, og de ligger i egne materialbøtter)
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') geo.deleteAttribute(k);
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
    geo.applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
    geo.computeBoundingBox();
    box.copy(geo.boundingBox!);
    const ci = Math.floor((box.min.x + box.max.x) / 2 / chunk);
    const mat = m.material as THREE.Material;
    const noCast = !!m.userData.noCast;
    const key = mat.uuid + ':' + ci + (noCast ? ':n' : '');
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat, geos: [], noCast }));
    b.geos.push(geo);
  }
  s.clear();
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat);
    if (b.noCast) mesh.userData.noCast = true;
    s.add(mesh);
  }
}

export function finishEnv(g: THREE.Group, updates: ((dt: number, t: number, camX: number) => void)[], fogColor: string, grade?: Partial<Grade>): Env {
  mergeStatic(g);
  applyShadows(g);
  return {
    group: g,
    fogColor,
    grade,
    fires: g.userData.fires as THREE.Vector3[] | undefined,
    waters: g.userData.waters as THREE.Vector3[] | undefined,
    tippables: g.userData.tippables as Tippable[] | undefined,
    update(dt, t, camX) {
      for (const u of updates) u(dt, t, camX);
    },
  };
}

// ---------------------------------------------------------------- forgrunn
export type FgProp = 'spikes' | 'skull' | 'cross' | 'rock' | 'bones';

/**
 * Mørke silhuetter helt fremme i bildet, nederst (pigger, hodeskaller på stake, kors, steiner), som i
 * konseptbildene. De står nær kameraet, så dybdeskarpheten gjør dem uskarpe, og de er så lave og glisne at de
 * ikke dekker kampen. Alt slås sammen til ett mesh (ett tegnekall).
 */
export function foreground(g: THREE.Group, length: number, kinds: FgProp[] = ['spikes', 'skull', 'cross', 'rock'], color = '#0a0605', every: [number, number] = [9, 16]) {
  const parts: THREE.BufferGeometry[] = [];
  const put = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const gg = geo.index ? geo.toNonIndexed() : geo.clone();
    gg.deleteAttribute('uv');
    gg.applyMatrix4(m);
    parts.push(gg);
  };
  const cone = new THREE.ConeGeometry(1, 1, 5);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const rockG = new THREE.DodecahedronGeometry(1, 0);
  for (let x = -12; x < length + 12; x += rand(every[0], every[1])) {
    // Like foran kameraet, så nær at bare toppene stikker opp nederst i bildet
    const z = STAGE_CAM.z - rand(3.8, 5.0);
    switch (pick(kinds)) {
      case 'spikes':
        for (let i = 0; i < 5; i++) put(cone, x + rand(-0.7, 0.7), 0.5, z + rand(-0.3, 0.3), rand(-0.35, 0.35), 0, rand(-0.45, 0.45), rand(0.07, 0.13), rand(0.9, 1.9), rand(0.07, 0.13));
        break;
      case 'skull':
        put(box, x, 0.9, z, 0, 0, rand(-0.12, 0.12), 0.07, 1.8, 0.07);
        put(ball, x, 1.9, z, 0, 0, 0, 0.2, 0.22, 0.2);
        put(box, x, 1.72, z + 0.08, 0, 0, 0, 0.16, 0.1, 0.12);
        break;
      case 'cross': {
        const t = rand(-0.2, 0.2);
        put(box, x, 0.7, z, 0, 0, t, 0.12, 1.4, 0.1);
        put(box, x - Math.sin(t) * 0.45, 1.05, z, 0, 0, t, 0.7, 0.11, 0.1);
        break;
      }
      case 'bones':
        for (let i = 0; i < 4; i++) put(box, x + rand(-0.6, 0.6), 0.08, z + rand(-0.3, 0.3), 0, rand(0, 3), rand(-0.2, 0.2), rand(0.5, 0.8), 0.07, 0.07);
        put(ball, x, 0.16, z, 0, 0, 0, 0.18, 0.18, 0.18);
        break;
      default:
        put(rockG, x, 0.15, z, rand(0, 3), rand(0, 3), 0, rand(0.5, 0.9), rand(0.35, 0.6), rand(0.4, 0.7));
    }
  }
  if (!parts.length) return;
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color, fog: false }));
  mesh.userData.noCast = true;
  g.add(mesh);
}

// ---------------------------------------------------------------- rekvisitter
/**
 * Fjellkjede i det fjerne: en lang stripe formet med rygget fraktalstøy (skarpe kammer og daler), høyest i
 * midten av stripa. Farget etter høyde og helning (stein, mørke kløfter, snø på toppene når cap er satt).
 * Tåka gjør den blå og disig på avstand.
 */
export function mountains(g: THREE.Group, length: number, cols: string[], cap: string | null, z = -110, hMin = 10, hMax = 22) {
  const W = length + 420, D = 60, nx = 240, nz = 24;
  const geo = new THREE.PlaneGeometry(W, D, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n3 = valueNoise3(Math.floor(rand(1, 999)));
  const ridged = (x: number, y: number) => {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < 5; o++) {
      const v = 1 - Math.abs(n3(x * f, y * f, 0.5) * 2 - 1);
      sum += v * v * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.1;
    }
    return sum / norm;
  };
  const base = cols.map((c) => new THREE.Color(c));
  const snow = cap ? new THREE.Color(cap) : null;
  const col: number[] = [];
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), zz = pos.getZ(i);
    const across = 1 - Math.pow(Math.abs(zz) / (D / 2), 1.6);
    const r = ridged(x / 38, zz / 38);
    const h = (hMin + (hMax - hMin) * r) * Math.max(0, across) * (0.75 + 0.5 * n3(x / 90, 3.1, 0.2));
    heights[i] = h;
    pos.setY(i, h);
  }
  geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = heights[i], ny = nrm.getY(i);
    c.copy(base[Math.floor(n3(pos.getX(i) / 25, 7.7, 1.3) * base.length * 0.999)]);
    // Bratte flater og kløfter er mørkere, snø legger seg der det er høyt og slakt nok
    c.multiplyScalar(0.55 + ny * 0.5);
    if (snow && h > hMin + (hMax - hMin) * 0.45 && ny > 0.55) c.lerp(snow, Math.min(1, (h - (hMin + (hMax - hMin) * 0.45)) / 4) * 0.9);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, lit({ vertexColors: true, roughness: 0.95 }, { scale: 0.08, normal: 0.8, albedo: 0.35 }));
  m.position.set(length / 2, -2.5, z);
  m.userData.noCast = true;
  g.add(m);
}

export function stakeWall(g: THREE.Group, x0: number, x1: number, z: number, gaps: [number, number][] = [], cols = ['#7a5230', '#6b4526', '#855a36']) {
  const sg = staticGroup(g);
  for (let x = x0; x < x1; x += 0.5) {
    if (gaps.some(([a, b]) => x > a && x < b)) continue;
    const h = rand(2.4, 3.4);
    const s = M(new THREE.CylinderGeometry(0.22, 0.26, h, 6), pick(cols), x + rand(-0.05, 0.05), h / 2, z + rand(-0.2, 0.2), 0.06);
    s.rotation.z = rand(-0.08, 0.08);
    s.add(M(new THREE.ConeGeometry(0.22, 0.6, 6), shade(cols[0], 0.15), 0, h / 2 + 0.3, 0, 0.06));
    sg.add(s);
  }
}

// ---------------------------------------------------------------- stein og bein i 3D
let rockGeos: THREE.BufferGeometry[] | null = null;
/** Fire kampesteiner: ikosaeder formet med 3D-støy, flat under, mørkere i gropene (toppunktfarger). */
function rockGeometries() {
  if (rockGeos) return rockGeos;
  const n3 = valueNoise3(11);
  rockGeos = [0, 1, 2, 3].map((k) => {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col: number[] = [];
    const v = new THREE.Vector3();
    const sx = 1 + k * 0.12, sy = 0.6 + (k % 2) * 0.14, sz = 0.85 + (k % 3) * 0.1;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const big = fbm3(n3, v.x * 1.3 + k * 7, v.y * 1.3, v.z * 1.3, 3);
      const fine = fbm3(n3, v.x * 5 + k * 3, v.y * 5, v.z * 5, 3);
      v.multiplyScalar(0.72 + big * 0.5 + fine * 0.12);
      v.set(v.x * sx, v.y * sy, v.z * sz);
      // Flat bunn der steinen ligger i bakken
      if (v.y < -0.22) v.y = -0.22 + (v.y + 0.22) * 0.2;
      pos.setXYZ(i, v.x, v.y, v.z);
      const cav = 0.55 + fine * 0.55;
      col.push(cav, cav, cav * 0.97);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const m = mergeVertices(g, 1e-4);
    m.computeVertexNormals();
    return m;
  });
  return rockGeos;
}

const colorMats = new Map<string, THREE.MeshStandardMaterial>();
/** Materiale med toppunktfarger (stein, bein), delt per farge og ruhet. */
function vcMat(color: string, roughness: number, surf: SurfaceOpts) {
  const k = color + roughness + (surf.snow ? 's' + surf.snow : '');
  let m = colorMats.get(k);
  if (!m) colorMats.set(k, (m = lit({ color, vertexColors: true, roughness }, surf)));
  return m;
}

/** Kampestein. snow legger snø på toppen (0..1, se surface.ts). */
export function rock(g: THREE.Group, x: number, z: number, size: number, cols = ['#8a8378', '#77706a', '#9a9288'], snow = 0) {
  const r = new THREE.Mesh(pick(rockGeometries()), vcMat(pick(cols), 0.92, { scale: 1.3, normal: 1.1, albedo: 0.55, snow }));
  r.position.set(x, size * 0.16, z);
  r.scale.setScalar(size);
  r.rotation.y = rand(0, Math.PI * 2);
  staticGroup(g).add(r);
  return r;
}

let skullGeo: THREE.BufferGeometry | null = null;
/**
 * Hodeskalle i 3D: en ikosaeder formet til hjerneskalle og ansikt, med øyehuler, nesehule, kinnbein og
 * tannrad. Hulene er trykket inn og mørke i toppunktfargene. Størrelse omtrent 2 enheter før skalering.
 */
function skullGeometry() {
  if (skullGeo) return skullGeo;
  const g = new THREE.IcosahedronGeometry(1, 4);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col: number[] = [];
  const v = new THREE.Vector3();
  const eyes = [new THREE.Vector3(0.36, 0.0, 0.93).normalize(), new THREE.Vector3(-0.36, 0.0, 0.93).normalize()];
  const nose = new THREE.Vector3(0, -0.3, 0.95).normalize();
  const n3 = valueNoise3(5);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1;
    let shade = 1;
    // Hjerneskallen er lengre bakover, ansiktet smalner mot kjeven
    r += Math.max(0, -v.z) * 0.14 + Math.max(0, v.y) * 0.05;
    for (const e of eyes) {
      const d = v.angleTo(e);
      if (d < 0.38) {
        const k = 1 - d / 0.38;
        r -= k * k * 0.34;
        shade = Math.min(shade, 0.12 + (1 - k * k) * 0.88);
      }
    }
    const dn = v.angleTo(nose);
    if (dn < 0.2) {
      const k = 1 - dn / 0.2;
      r -= k * 0.24;
      shade = Math.min(shade, 0.18 + (1 - k) * 0.82);
    }
    // Tennene: en rad med mørke mellomrom nederst foran
    if (v.z > 0.5 && v.y < -0.4 && v.y > -0.66) {
      const t = Math.sin(Math.atan2(v.x, v.z) * 30);
      if (t > 0.55) shade = Math.min(shade, 0.35);
      r -= 0.04;
    }
    let x = v.x * r, y = v.y * r, z = v.z * r;
    const below = Math.max(0, -y - 0.2);
    x *= 0.82 - below * 0.35;
    z += below * 0.25 * Math.max(0, v.z);
    if (y < -0.72) y = -0.72 + (y + 0.72) * 0.3;
    // Litt ujevn, gammel bein
    const bump = (fbm3(n3, v.x * 6, v.y * 6, v.z * 6, 3) - 0.5) * 0.04;
    pos.setXYZ(i, x * (1 + bump), y * (1 + bump), z * 0.95 * (1 + bump));
    const age = 0.82 + fbm3(n3, v.x * 3 + 9, v.y * 3, v.z * 3, 3) * 0.3;
    col.push(shade * age, shade * age * 0.97, shade * age * 0.9);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  skullGeo = mergeVertices(g, 1e-4);
  skullGeo.computeVertexNormals();
  return skullGeo;
}

/** En hodeskalle i 3D. size er bredden i verdensenheter. Vendes mot kameraet med litt tilfeldig vinkel. */
export function skull3D(size = 0.3) {
  const m = new THREE.Mesh(skullGeometry(), vcMat('#e2d6bc', 0.55, { scale: 4, normal: 0.8, albedo: 0.5 }));
  m.scale.setScalar(size * 0.6);
  m.rotation.set(rand(-0.15, 0.25), rand(-0.45, 0.45), rand(-0.12, 0.12));
  return m;
}

export function skullPike(g: THREE.Group, gore: Gore, x: number, z: number) {
  const sg = staticGroup(g);
  sg.add(M(new THREE.CylinderGeometry(0.035, 0.06, 2.6, 6), '#5a3a20', x, 1.3, z));
  const sk = skull3D(0.32);
  sk.position.set(x, 2.66, z + 0.02);
  sg.add(sk);
  gore.stain(x, z + 0.3, 0.5);
}

export function banner(g: THREE.Group, x: number, z: number, cloth: string, emblem: string) {
  const t = canvasTex(unitCanvas(1.0, 2.0, 0.5, 0, 100, (p) => {
    p.poly([-0.45, 1.95, 0.45, 1.95, 0.45, 0.2, 0, 0.45, -0.45, 0.2], cloth);
    p.ell(0, 1.3, 0.22, 0.22, emblem);
    p.ell(-0.08, 1.32, 0.05, 0.06, INK, false);
    p.ell(0.08, 1.32, 0.05, 0.06, INK, false);
    p.line([-0.3, 0.8, 0.3, 0.8], 0.05, '#d4a63a');
  }), false);
  g.add(M(new THREE.CylinderGeometry(0.07, 0.07, 5, 5), '#3a2616', x, 2.5, z, 0.08));
  const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
  b.position.set(x + 0.62, 3.6, z);
  g.add(b);
}

/** Bål: returnerer posisjonen for flammer. Lyset går via lyspoolen (vfx.ts) når gore er gitt. */
export function campfire(g: THREE.Group, x: number, z: number, gore?: Gore) {
  for (let i = 0; i < 5; i++) {
    const log = M(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 5), '#4a3020', x + Math.cos(i * 1.25) * 0.15, 0.12, z + Math.sin(i * 1.25) * 0.15, 0.06);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i * 1.25;
    g.add(log);
  }
  gore?.vfx.lights.source(new THREE.Vector3(x, 1.2, z + 0.5), '#ff8a3a', 10, 9, 0.35);
  const at = new THREE.Vector3(x, 0.3, z);
  // Lydkilde for stemningen (finishEnv legger listen på Env.fires)
  ((g.userData.fires ??= []) as THREE.Vector3[]).push(at);
  // Lufta over bålet dirrer (varmeflimmer i etterbehandlingen, gfx/screenfx.ts)
  screenFX.addHeat(new THREE.Vector3(x, 0.4, z), 1.1, 0.9);
  return at;
}

export function arrows(g: THREE.Group, length: number, n = 40) {
  const geo = new THREE.CylinderGeometry(0.025, 0.025, 1, 4);
  const sg = staticGroup(g);
  for (let i = 0; i < n; i++) {
    const a = M(geo, '#7a5230', rand(0, length), 0.35, rand(-3, 4), 0.1);
    a.rotation.set(rand(-0.4, 0.4), 0, rand(-0.6, 0.6));
    a.add(M(new THREE.ConeGeometry(0.07, 0.2, 3), '#e8e0d0', 0, 0.5, 0, 0.1));
    sg.add(a);
  }
}

/** Port i bakgrunnen på slutten av et brett (duell-finale). */
export function endGate(g: THREE.Group, gore: Gore, x: number, title: string, sub: string, stone = '#6e6670', roof = '#5b2a86') {
  const st = texFile('wall_gate', () => stoneTex(stone, shade(stone, -0.45), 64, 32), { tint: true });
  // Tre bilder rundt tårnet og tre i høyden, så steinene får vanlige proporsjoner
  st.repeat.set(3, 3);
  for (const dx of [-3.4, 3.4]) {
    const tw = M(new THREE.CylinderGeometry(1.5, 1.7, 9, 8), stone, x + dx, 4.5, -5.2, 0.05, st);
    tw.add(M(new THREE.ConeGeometry(2.1, 3, 8), roof, 0, 6, 0, 0.05));
    g.add(tw);
  }
  const archT = texFile('wall_gate', () => stoneTex(stone, shade(stone, -0.45), 64, 32), { tint: true });
  archT.repeat.set(3, 1);
  g.add(M(new THREE.BoxGeometry(7, 1.8, 2), stone, x, 7.2, -5.2, 0.04, archT));
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 6.3), new THREE.MeshBasicMaterial({ color: '#120808' }));
  hole.position.set(x, 3.15, -4.3);
  g.add(hole);
  const bigSkull = skull3D(1.4);
  bigSkull.rotation.set(0.1, 0, 0);
  bigSkull.position.set(x, 7.3, -3.7);
  g.add(bigSkull);
  const signT = canvasTex(plainCanvas(512, 128, (c) => {
    c.fillStyle = '#3a2616';
    c.fillRect(0, 0, 512, 128);
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.strokeRect(5, 5, 502, 118);
    c.fillStyle = '#f1d27a';
    c.font = 'bold 44px Impact, sans-serif';
    c.textAlign = 'center';
    c.fillText(title, 256, 66);
    c.font = '24px Impact, sans-serif';
    c.fillText(sub, 256, 104);
  }), false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signT }));
  sign.position.set(x - 9, 1.6, -3.9);
  g.add(sign);
  g.add(M(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 5), '#3a2616', x - 9, 0.5, -4.0, 0.06));
  for (let i = 0; i < 6; i++) gore.stain(x + rand(-3, 3), rand(-3, -0.5), rand(0.4, 1.0));
}

/** Omgivelser for sjefskamp: et par hodeskaller og en skiltet grense. */
export function bossMarker(g: THREE.Group, gore: Gore, x: number, text: string) {
  const signT = canvasTex(plainCanvas(512, 128, (c) => {
    c.fillStyle = '#2a1414';
    c.fillRect(0, 0, 512, 128);
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.strokeRect(5, 5, 502, 118);
    c.fillStyle = '#ff6a4a';
    c.font = 'bold 46px Impact, sans-serif';
    c.textAlign = 'center';
    c.fillText(text, 256, 80);
  }), false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signT }));
  sign.position.set(x, 1.8, -3.9);
  g.add(sign);
  g.add(M(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 5), '#3a2616', x, 0.6, -4.0, 0.06));
  for (let i = 0; i < 14; i++) gore.stain(x + rand(2, 16), rand(-2.4, 2.4), rand(0.4, 1.1));
}
