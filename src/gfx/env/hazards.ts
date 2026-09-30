// Tegning av farer i brettene: piggrop, myr, råk i isen, lavapøl og piggfelle.
import * as THREE from 'three';
import { plainCanvas } from '../draw';
import { lit, toon, canvasTex, mergeStatic, applyShadows } from './common';
import { icicles, ropeFence } from './props';
import { valueNoise3, fbm3 } from '../noise';
import { rand } from '../../core/math';
import type { Gore } from '../gore';
import { chasmHole, CHASM_FENCE, type HazardDef } from '../../data/hazards';
import { screenFX } from '../screenfx';

export interface HazardVisual {
  group: THREE.Group;
  update(dt: number, t: number): void;
  /** Piggfelle: 0 = nede, 1 = oppe. */
  setSpikes?(k: number): void;
}

const texCache = new Map<string, THREE.Texture>();
function poolTex(key: string, inner: string, mid: string, outer: string, specks: string[] = [], rim?: string) {
  let t = texCache.get(key);
  if (t) return t;
  const cv = plainCanvas(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 10, 128, 128, 124);
    g.addColorStop(0, inner);
    g.addColorStop(0.6, mid);
    g.addColorStop(0.92, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    // Ujevn kant
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 118 + Math.sin(a * 5) * 4 + Math.cos(a * 3) * 3;
      if (i === 0) c.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      else c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    c.fill();
    for (const s of specks) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 95;
        c.fillStyle = s;
        c.beginPath();
        c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + Math.random() * 9, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (rim) {
      c.strokeStyle = rim;
      c.lineWidth = 6;
      c.beginPath();
      c.arc(128, 128, 114, 0, Math.PI * 2);
      c.stroke();
    }
  });
  t = canvasTex(cv, false);
  texCache.set(key, t);
  return t;
}

function pool(g: THREE.Group, h: HazardDef, tex: THREE.Texture, glowing: boolean, y = 0.02) {
  const mat = glowing ? new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }) : lit({ map: tex, alphaTest: 0.5 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h.w * 1.08, h.d * 1.25), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(h.x, y, h.z);
  m.renderOrder = 1;
  g.add(m);
  return m;
}

/** Mange like små ting (staker, pigger, steiner) som ett instansiert mesh. */
function instanced(g: THREE.Group, geo: THREE.BufferGeometry, color: string, list: THREE.Matrix4[]) {
  const m = new THREE.InstancedMesh(geo, toon(color), list.length);
  list.forEach((mat, i) => m.setMatrixAt(i, mat));
  g.add(m);
  return m;
}

const cone = new THREE.ConeGeometry(0.075, 0.8, 6);
cone.translate(0, 0.4, 0);
const tip = new THREE.ConeGeometry(0.045, 0.2, 6);
tip.translate(0, 0.72, 0);
const chunk = new THREE.DodecahedronGeometry(0.16, 0);

let chasmMat: THREE.MeshStandardMaterial | null = null;
let mistTex: THREE.Texture | null = null;

/**
 * Juvet: steinvegger ned i dypet (snø på kanten, svart nederst), istapper langs bakveggen, dis som driver nede i
 * juvet og taugjerde langs forkanten. Hullet i bakken og veien lager stageBase (Look.holes). Gir oppdateringen.
 */
function chasm(grp: THREE.Group, h: HazardDef) {
  const { x0, x1, z0, z1 } = chasmHole(h);
  const D = 10, w = x1 - x0, d = z1 - z0;
  const n3 = valueNoise3(Math.floor(rand(1, 999)));
  const rock = new THREE.Color('#6c768a'), deep = new THREE.Color('#080c16'), snow = new THREE.Color('#e6eef8');
  chasmMat ??= lit({ vertexColors: true, roughness: 0.95 }, { scale: 0.5, normal: 1.2, albedo: 0.35, snow: 0.5 });
  const wall = (W: number, seed: number) => {
    const geo = new THREE.PlaneGeometry(W, D, Math.max(4, Math.round(W * 2.5)), 26);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const col: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i);
      const depth = D / 2 - py;
      const n = fbm3(n3, px * 0.55 + seed, py * 0.3, seed * 0.7, 4);
      // Ingen utbuling ved kanten, så veggen møter hullet i bakken
      pos.setZ(i, (n - 0.5) * 1.1 * Math.min(1, depth / 1.5));
      c.copy(rock).multiplyScalar(0.45 + n * 0.7).lerp(deep, Math.min(1, depth / 7.5));
      if (depth < 0.35) c.lerp(snow, 0.85);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, chasmMat!);
    m.userData.noCast = true;
    return m;
  };
  const back = wall(w, 1);
  back.position.set(x0 + w / 2, -D / 2, z0);
  const left = wall(d, 7);
  left.rotation.y = Math.PI / 2;
  left.position.set(x0, -D / 2, z0 + d / 2);
  const right = wall(d, 13);
  right.rotation.y = -Math.PI / 2;
  right.position.set(x1, -D / 2, z0 + d / 2);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: deep }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(x0 + w / 2, -D, z0 + d / 2);
  grp.add(back, left, right, bottom);
  // Dis nede i juvet som driver sakte
  mistTex ??= canvasTex(plainCanvas(256, 64, (c) => {
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256, y = 20 + Math.random() * 24, r = 14 + Math.random() * 26;
      for (const dx of [-256, 0, 256]) {
        const gr = c.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.3)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gr;
        c.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
  }), false);
  const mists: THREE.Texture[] = [];
  for (const [y, op] of [[-3, 0.45], [-6, 0.6]] as const) {
    const t = mistTex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = w / 6;
    mists.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), new THREE.MeshBasicMaterial({ map: t, color: '#a8bcd6', transparent: true, opacity: op, depthWrite: false }));
    m.position.set(x0 + w / 2, y, z0 + d * 0.45);
    grp.add(m);
  }
  // Istapper langs bakveggen og taugjerde langs forkanten, slått sammen for seg
  const props = new THREE.Group();
  icicles(props, x0 + 0.3, x1 - 0.3, -0.02, z0 + 0.2, 2, 0.9);
  ropeFence(props, x0 + 0.2, x1 - 0.2, z1 + CHASM_FENCE, 1.0, 0.06);
  mergeStatic(props);
  applyShadows(props);
  grp.add(props);
  return (dt: number) => {
    for (let i = 0; i < mists.length; i++) mists[i].offset.x += dt * (i ? 0.012 : -0.02);
  };
}

export function buildHazard(g: THREE.Group, gore: Gore, h: HazardDef): HazardVisual {
  const grp = new THREE.Group();
  g.add(grp);
  if (h.kind === 'chasm') {
    const update = chasm(grp, h);
    return { group: grp, update };
  }
  const inside = (fx: number, fz: number) => (fx * fx) / 0.25 + (fz * fz) / 0.25 <= 0.85;
  switch (h.kind) {
    case 'spikes': {
      pool(grp, h, poolTex('pit', '#0a0503', '#1e120a', '#3a2616', ['rgba(120,10,10,0.5)']), false);
      const mats: THREE.Matrix4[] = [];
      for (let x = -0.5; x <= 0.5; x += 0.14)
        for (let z = -0.5; z <= 0.5; z += 0.28) {
          if (!inside(x, z)) continue;
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(h.x + x * h.w + rand(-0.06, 0.06), -0.05, h.z + z * h.d + rand(-0.05, 0.05)),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.2, 0.2), 0, rand(-0.25, 0.25))),
            new THREE.Vector3(1, rand(0.8, 1.2), 1),
          );
          mats.push(m);
        }
      instanced(grp, cone, '#8a5a2b', mats);
      instanced(grp, tip, '#9e1020', mats);
      break;
    }
    case 'bog': {
      const tex = poolTex('bog', '#2f3a14', '#4a5320', '#5f5a2a', ['rgba(120,140,40,0.45)', 'rgba(20,30,8,0.5)']);
      const m = pool(grp, h, tex, false);
      let acc = 0;
      return {
        group: grp,
        update(dt, t) {
          m.rotation.z = Math.sin(t * 0.3) * 0.05;
          acc += dt;
          if (acc > 0.25) {
            acc = 0;
            gore.ambient(h.x + rand(-h.w * 0.4, h.w * 0.4), 0.05, h.z + rand(-h.d * 0.35, h.d * 0.35), 0, 0.5, '#8fa040', rand(0.08, 0.18), 0.5, false, -0.5);
          }
        },
      };
    }
    case 'icehole': {
      pool(grp, h, poolTex('ice', '#061426', '#0e2f55', '#3f7cb0', ['rgba(160,210,255,0.25)'], '#e8f4ff'), false);
      const mats: THREE.Matrix4[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        mats.push(new THREE.Matrix4().compose(
          new THREE.Vector3(h.x + Math.cos(a) * h.w * 0.54, 0.04, h.z + Math.sin(a) * h.d * 0.64),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)),
          new THREE.Vector3(rand(0.8, 1.5), rand(0.4, 0.7), rand(0.8, 1.4)),
        ));
      }
      instanced(grp, chunk, '#eaf6ff', mats);
      break;
    }
    case 'lava': {
      const tex = poolTex('lava', '#fff2a0', '#ffb02e', '#ff4a10', ['rgba(255,255,200,0.5)', 'rgba(160,30,0,0.45)']);
      const m = pool(grp, h, tex, true);
      const mats: THREE.Matrix4[] = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        mats.push(new THREE.Matrix4().compose(
          new THREE.Vector3(h.x + Math.cos(a) * h.w * 0.55, 0.05, h.z + Math.sin(a) * h.d * 0.66),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)),
          new THREE.Vector3(rand(0.9, 1.6), rand(0.5, 0.9), rand(0.9, 1.5)),
        ));
      }
      instanced(grp, chunk, '#2a2228', mats);
      // Lufta over lavapølen dirrer (varmeflimmer, gfx/screenfx.ts)
      screenFX.addHeat(new THREE.Vector3(h.x, 0.1, h.z), Math.max(h.w, h.d) * 0.45, 0.8);
      let acc = 0;
      const mat = m.material as THREE.MeshBasicMaterial;
      return {
        group: grp,
        update(dt, t) {
          mat.color.setScalar(0.85 + Math.sin(t * 3) * 0.15);
          acc += dt;
          if (acc > 0.12) {
            acc = 0;
            gore.fire(new THREE.Vector3(h.x + rand(-h.w * 0.4, h.w * 0.4), 0.1, h.z + rand(-h.d * 0.3, h.d * 0.3)), 1, 0.1, 1.4);
          }
        },
      };
    }
    case 'spiketrap': {
      const tex = texCache.get('grate') ?? canvasTex(plainCanvas(128, 128, (c) => {
        c.fillStyle = '#3a3a44';
        c.fillRect(0, 0, 128, 128);
        c.strokeStyle = '#15151a';
        c.lineWidth = 6;
        for (let i = 0; i <= 128; i += 21) {
          c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke();
          c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke();
        }
        c.strokeStyle = '#8a1010';
        c.lineWidth = 4;
        c.strokeRect(2, 2, 124, 124);
      }), false);
      texCache.set('grate', tex);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(h.w, h.d), lit({ map: tex }));
      plate.rotation.x = -Math.PI / 2;
      plate.position.set(h.x, 0.015, h.z);
      grp.add(plate);
      const spikes = new THREE.Group();
      const mats: THREE.Matrix4[] = [];
      for (let x = -0.42; x <= 0.42; x += 0.14)
        for (let z = -0.42; z <= 0.42; z += 0.2) mats.push(new THREE.Matrix4().makeTranslation(x * h.w, 0, z * h.d));
      instanced(spikes, cone, '#c9d3de', mats);
      spikes.position.set(h.x, -0.9, h.z);
      grp.add(spikes);
      return {
        group: grp,
        update() {},
        setSpikes(k: number) {
          spikes.position.y = -0.9 + k * 0.9;
          spikes.visible = k > 0.02;
        },
      };
    }
  }
  return { group: grp, update() {} };
}
