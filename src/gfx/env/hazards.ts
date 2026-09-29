// Tegning av farer i brettene: piggrop, myr, råk i isen, lavapøl og piggfelle.
import * as THREE from 'three';
import { plainCanvas } from '../draw';
import { lit, toon, canvasTex } from './common';
import { rand } from '../../core/math';
import type { Gore } from '../gore';
import type { HazardDef } from '../../data/hazards';
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

export function buildHazard(g: THREE.Group, gore: Gore, h: HazardDef): HazardVisual {
  const grp = new THREE.Group();
  g.add(grp);
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
