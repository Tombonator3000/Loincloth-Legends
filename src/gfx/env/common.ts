// Felles byggeklosser for 3D-miljøene: materialer, konturer, teksturer, himmel, sol med skygger og rekvisitter.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plainCanvas, unitCanvas, INK, shade } from '../draw';
import { rand, pick } from '../../core/math';
import type { Gore } from '../gore';
import { images } from '../assets';
import type { Grade } from '../post';
import { SunShadow } from './sun';

// ---------------------------------------------------------------- materialer
/**
 * Stilisert, lyssatt materiale for miljøet (mykt lys, skygger, tåke). Tidligere et trestegs toon-materiale,
 * derav navnet. Emisjon gis HDR-styrke så bloom tar den (gfx/post.ts).
 */
export function lit(p: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, ...p });
}
export const EMISSIVE_BOOST = 2.4;
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function toon(color: string, map?: THREE.Texture, emissive?: string) {
  const k = color + (map ? map.uuid : '') + (emissive ?? '');
  let m = matCache.get(k);
  if (!m) {
    m = lit({ color, map: map ?? null });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = EMISSIVE_BOOST;
    }
    matCache.set(k, m);
  }
  return m;
}
export const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/** Legg til konturskall (invertert skrog) på et mesh med sentrert geometri. */
export function outline(mesh: THREE.Mesh, t = 0.05) {
  const o = new THREE.Mesh(mesh.geometry, inkMat);
  const s = mesh.scale;
  o.scale.set(1 + t / Math.max(0.2, s.x), 1 + t / Math.max(0.2, s.y), 1 + t / Math.max(0.2, s.z));
  mesh.add(o);
  return mesh;
}

/** Toon-mesh med kontur. */
export function M(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, ol = 0.05, map?: THREE.Texture, emissive?: string) {
  const m = new THREE.Mesh(geo, toon(color, map, emissive));
  m.position.set(x, y, z);
  if (ol > 0) {
    const o = new THREE.Mesh(geo, inkMat);
    o.scale.setScalar(1 + ol);
    m.add(o);
  }
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
export function speckle(c: CanvasRenderingContext2D, w: number, h: number, cols: string[], n: number, r0: number, r1: number) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = pick(cols);
    c.beginPath();
    c.ellipse(rand(0, w), rand(0, h), rand(r0, r1), rand(r0, r1) * 0.6, rand(0, 3), 0, Math.PI * 2);
    c.fill();
  }
}

/** Bakke med flekker og strå. */
export const groundTex = (base: string, specks: string[], blade: string | null, blades = 140) =>
  canvasTex(plainCanvas(256, 256, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 256);
    speckle(c, 256, 256, specks, 260, 4, 14);
    if (blade) {
      c.strokeStyle = blade;
      c.lineWidth = 2;
      for (let i = 0; i < blades; i++) {
        const x = rand(0, 256), y = rand(0, 256);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + rand(-3, 3), y - rand(5, 10));
        c.stroke();
      }
    }
  }));

/** Veistripe med ujevne kanter (alfa), steiner og hjulspor. */
export const roadTex = (base: string, specks: string[], rut: string, stones: string[]) =>
  canvasTex(plainCanvas(512, 256, (c) => {
    c.clearRect(0, 0, 512, 256);
    c.fillStyle = base;
    c.beginPath();
    c.moveTo(0, 22);
    for (let x = 0; x <= 512; x += 16) c.lineTo(x, 14 + Math.sin(x * 0.05) * 8 + rand(0, 8));
    for (let x = 512; x >= 0; x -= 16) c.lineTo(x, 242 - Math.sin(x * 0.04) * 8 - rand(0, 8));
    c.closePath();
    c.fill();
    c.save();
    c.clip();
    speckle(c, 512, 256, specks, 500, 3, 12);
    c.strokeStyle = rut;
    c.lineWidth = 10;
    for (const y of [90, 170]) {
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) c.lineTo(x, y + Math.sin(x * 0.02) * 4);
      c.stroke();
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = pick(stones);
      c.strokeStyle = '#3d2c1c';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(rand(0, 512), rand(30, 226), rand(3, 7), rand(2, 5), 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.restore();
  }));

export const stoneTex = (base = '#8a8f99', mortar = '#4b4e57', bw = 64, bh = 32) =>
  canvasTex(plainCanvas(256, 256, (c) => {
    c.fillStyle = mortar;
    c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < 256 + bw; x += bw) {
        c.fillStyle = shade(base, rand(-0.12, 0.08));
        c.fillRect(x + off + 3, y + 3, bw - 6, bh - 6);
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(x + off + 3, y + 3, bw - 6, 5);
      }
    }
  }));

export const tileTex = (base = '#77706a', grout = '#3e3a36') =>
  canvasTex(plainCanvas(256, 256, (c) => {
    c.fillStyle = grout;
    c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64)
      for (let x = 0; x < 256; x += 64) {
        c.fillStyle = shade(base, rand(-0.15, 0.08));
        c.fillRect(x + 3, y + 3, 58, 58);
        c.strokeStyle = 'rgba(0,0,0,0.25)';
        c.lineWidth = 2;
        if (Math.random() < 0.4) {
          c.beginPath();
          c.moveTo(x + rand(5, 60), y + 5);
          c.lineTo(x + rand(5, 60), y + rand(30, 60));
          c.stroke();
        }
      }
  }));

export const sandTex = (base = '#b89a6a', specks = ['#a88a5a', '#c7aa7a', '#9e8050']) =>
  canvasTex(plainCanvas(256, 256, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 256);
    speckle(c, 256, 256, specks, 400, 2, 8);
  }));

export const woodTex = () =>
  canvasTex(plainCanvas(128, 256, (c) => {
    c.fillStyle = '#7a5230';
    c.fillRect(0, 0, 128, 256);
    c.strokeStyle = '#5a3a20';
    c.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      c.beginPath();
      const x = rand(0, 128);
      c.moveTo(x, 0);
      c.bezierCurveTo(x + rand(-10, 10), 80, x + rand(-10, 10), 170, x + rand(-8, 8), 256);
      c.stroke();
    }
  }));

/** Svart stein med glødende lavasprekker. */
export const lavaRockTex = () =>
  canvasTex(plainCanvas(256, 256, (c) => {
    c.fillStyle = '#2a2226';
    c.fillRect(0, 0, 256, 256);
    speckle(c, 256, 256, ['#3a3036', '#1e181c', '#44383e'], 200, 4, 14);
    for (let i = 0; i < 9; i++) {
      let x = rand(0, 256), y = rand(0, 256);
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rand(-30, 30);
        y += rand(-30, 30);
        c.lineTo(x, y);
      }
      c.strokeStyle = 'rgba(255,120,20,0.35)';
      c.lineWidth = 8;
      c.stroke();
      c.strokeStyle = '#ff7a1a';
      c.lineWidth = 3;
      c.stroke();
    }
  }));

// ---------------------------------------------------------------- himmel og skyer
export function sky(top: string, mid: string, bottom: string, biome?: string) {
  const img = biome ? images.sky[biome] : undefined;
  if (img) {
    const t = canvasTex(img, false);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(170, 170, 170, 48, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.position.y = 40;
    m.renderOrder = -10;
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

// ---------------------------------------------------------------- Env
export interface Env {
  group: THREE.Group;
  update(dt: number, t: number, camX: number): void;
  fogColor: string;
  cheer?(power: number): void;
  /** Fargegradering og linse for dette miljøet (se gfx/post.ts og env/grades.ts). */
  grade?: Partial<Grade>;
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
}

/** Himmel, lys, bakke og vei. Returnerer gruppen og en liste med oppdateringsfunksjoner. */
export function stageBase(scene: THREE.Scene, length: number, look: Look) {
  const g = new THREE.Group();
  const updates: ((dt: number, t: number, camX: number) => void)[] = [];
  scene.background = new THREE.Color(look.bg);
  scene.fog = new THREE.Fog(look.fog[0], look.fog[1], look.fog[2]);
  g.add(sky(look.sky[0], look.sky[1], look.sky[2], look.biome));
  const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]);
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
  g.add(hemi);
  const shadow = new SunShadow(g, sun, new THREE.Vector3(...(look.sunDir ?? [-20, 30, 20])));
  shadow.update(0);
  updates.push((_dt, _t, camX) => shadow.update(camX + 3));

  look.ground.repeat.set(60, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(length + 140, 60), toon('#ffffff', look.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(length / 2, 0, -18);
  ground.userData.noCast = true;
  g.add(ground);
  look.road.repeat.set((length + 60) / 10, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(length + 60, 8.4), lit({ map: look.road, alphaTest: 0.5 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(length / 2, 0.004, 0);
  road.userData.noCast = true;
  g.add(road);

  if (look.sunDisk) {
    // Sola følger kameraet (den er uendelig langt unna) og lyser sterkt nok til å gi bloom
    const sd = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.sunDisk).multiplyScalar(2.2), fog: false }));
    const dx = look.sunDir ? look.sunDir[0] / Math.max(0.2, -look.sunDir[2]) * 160 : 40;
    sd.position.set(dx, 20, -160);
    g.add(sd);
    updates.push((_dt, _t, camX) => {
      sd.position.x = camX + dx;
    });
  }
  if (look.clouds) {
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
    if (mat === inkMat) {
      m.castShadow = m.receiveShadow = false;
      return;
    }
    const isLit = (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial || (mat as THREE.MeshLambertMaterial).isMeshLambertMaterial;
    m.receiveShadow = !!isLit;
    if (m.userData.noCast || mat.transparent) return;
    m.castShadow = !!isLit || (mat.alphaTest ?? 0) > 0;
  });
}

export function finishEnv(g: THREE.Group, updates: ((dt: number, t: number, camX: number) => void)[], fogColor: string, grade?: Partial<Grade>): Env {
  applyShadows(g);
  return {
    group: g,
    fogColor,
    grade,
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
    const z = rand(7.6, 9.2);
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
export function mountains(g: THREE.Group, length: number, cols: string[], cap: string | null, z = -110, hMin = 10, hMax = 22) {
  for (let i = 0; i < Math.ceil(length / 7) + 6; i++) {
    const h = rand(hMin, hMax);
    const r = rand(12, 22);
    const m = M(new THREE.ConeGeometry(r, h, 6), pick(cols), i * 14 - 40 + rand(-5, 5), h / 2 - 2, z + rand(-10, 8), 0.02);
    m.rotation.y = rand(0, 3);
    g.add(m);
    if (cap) m.add(M(new THREE.ConeGeometry(r * 0.3, h * 0.3, 6), cap, 0, h * 0.35, 0, 0));
  }
}

export function stakeWall(g: THREE.Group, x0: number, x1: number, z: number, gaps: [number, number][] = [], cols = ['#7a5230', '#6b4526', '#855a36']) {
  for (let x = x0; x < x1; x += 0.5) {
    if (gaps.some(([a, b]) => x > a && x < b)) continue;
    const h = rand(2.4, 3.4);
    const s = M(new THREE.CylinderGeometry(0.22, 0.26, h, 6), pick(cols), x + rand(-0.05, 0.05), h / 2, z + rand(-0.2, 0.2), 0.06);
    s.rotation.z = rand(-0.08, 0.08);
    s.add(M(new THREE.ConeGeometry(0.22, 0.6, 6), shade(cols[0], 0.15), 0, h / 2 + 0.3, 0, 0.06));
    g.add(s);
  }
}

export function rock(g: THREE.Group, x: number, z: number, size: number, cols = ['#8a8378', '#77706a', '#9a9288']) {
  const r = M(new THREE.DodecahedronGeometry(size, 0), pick(cols), x, size * 0.4, z, 0.06);
  r.rotation.set(rand(0, 3), rand(0, 3), 0);
  g.add(r);
  return r;
}

let skullMatCache: THREE.MeshBasicMaterial | null = null;
export function skullMat() {
  if (!skullMatCache) {
    const t = canvasTex(unitCanvas(0.6, 0.6, 0.3, 0.3, 100, (p) => {
      p.blob([-0.2, -0.1, -0.22, 0.12, 0, 0.24, 0.22, 0.12, 0.2, -0.1, 0.08, -0.2, -0.08, -0.2], '#efe8d2');
      p.ell(-0.08, 0.02, 0.06, 0.07, INK, false);
      p.ell(0.08, 0.02, 0.06, 0.07, INK, false);
      p.line([-0.06, -0.14, 0.06, -0.14], 0.02);
    }), false);
    skullMatCache = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 });
  }
  return skullMatCache;
}

export function skullPike(g: THREE.Group, gore: Gore, x: number, z: number) {
  g.add(M(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), '#5a3a20', x, 1.3, z, 0.08));
  const sk = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), skullMat());
  sk.position.set(x, 2.7, z + 0.08);
  g.add(sk);
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
  return new THREE.Vector3(x, 0.3, z);
}

export function arrows(g: THREE.Group, length: number, n = 40) {
  const geo = new THREE.CylinderGeometry(0.025, 0.025, 1, 4);
  for (let i = 0; i < n; i++) {
    const a = M(geo, '#7a5230', rand(0, length), 0.35, rand(-3, 4), 0.1);
    a.rotation.set(rand(-0.4, 0.4), 0, rand(-0.6, 0.6));
    a.add(M(new THREE.ConeGeometry(0.07, 0.2, 3), '#e8e0d0', 0, 0.5, 0, 0.1));
    g.add(a);
  }
}

/** Port i bakgrunnen på slutten av et brett (duell-finale). */
export function endGate(g: THREE.Group, gore: Gore, x: number, title: string, sub: string, stone = '#6e6670', roof = '#5b2a86') {
  const st = stoneTex(stone, shade(stone, -0.45), 64, 32);
  st.repeat.set(1, 3);
  for (const dx of [-3.4, 3.4]) {
    const tw = M(new THREE.CylinderGeometry(1.5, 1.7, 9, 8), stone, x + dx, 4.5, -5.2, 0.05, st);
    tw.add(M(new THREE.ConeGeometry(2.1, 3, 8), roof, 0, 6, 0, 0.05));
    g.add(tw);
  }
  const archT = stoneTex(stone, shade(stone, -0.45), 64, 32);
  archT.repeat.set(3, 1);
  g.add(M(new THREE.BoxGeometry(7, 1.8, 2), stone, x, 7.2, -5.2, 0.04, archT));
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 6.3), new THREE.MeshBasicMaterial({ color: '#120808' }));
  hole.position.set(x, 3.15, -4.3);
  g.add(hole);
  const bigSkull = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), skullMat());
  bigSkull.position.set(x, 7.3, -4.1);
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
