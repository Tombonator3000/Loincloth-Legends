// Pickups (gull, kylling, potions), tønner og prosjektiler.
import * as THREE from 'three';
import { unitCanvas, INK } from '../gfx/draw';
import { toon, outline } from '../gfx/env';

const woodMat = new THREE.MeshBasicMaterial({ color: '#7a4b22' });
import { W } from './world';
import { rand, chance } from '../core/math';
import { audio } from '../core/audio';

export type PickKind = 'coin' | 'chicken' | 'potion' | 'ham' | 'egg';

const texCache = new Map<string, THREE.MeshBasicMaterial>();
function spriteMat(key: string, w: number, h: number, draw: Parameters<typeof unitCanvas>[5]) {
  let m = texCache.get(key);
  if (!m) {
    const cv = unitCanvas(w, h, w / 2, h / 2, 128, draw);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
    texCache.set(key, m);
  }
  return m;
}

const MATS = {
  coin: () => spriteMat('coin', 0.4, 0.4, (p) => {
    p.ell(0, 0, 0.15, 0.15, '#f4c542');
    p.ell(0, 0, 0.09, 0.09, '#e0a82a', false);
    p.line([-0.03, -0.05, 0.03, 0.05], 0.03, '#fff3b0');
  }),
  chicken: () => spriteMat('chicken', 0.9, 0.7, (p) => {
    p.limbs([[[0.12, 0.02, 0.36, 0.14], 0.05]], '#efe2c2');
    p.ell(0.38, 0.16, 0.06, 0.06, '#efe2c2');
    p.blob([-0.36, 0.0, -0.22, 0.2, 0.08, 0.2, 0.2, 0.02, 0.06, -0.16, -0.26, -0.16], '#b8632a');
    p.blob([-0.26, 0.08, -0.12, 0.16, 0.04, 0.12, -0.06, 0.02], '#d98a44', false);
    p.rrect(-0.42, -0.24, 0.72, 0.08, 0.03, '#d9d9d9');
  }),
  ham: () => spriteMat('ham', 0.9, 0.7, (p) => {
    p.limbs([[[0.16, 0.0, 0.38, 0.0], 0.05]], '#efe2c2');
    p.blob([-0.34, 0.0, -0.2, 0.22, 0.14, 0.18, 0.2, -0.02, 0.06, -0.2, -0.24, -0.18], '#d65a6a');
    p.ell(-0.1, 0.0, 0.1, 0.08, '#f3b0b8', false);
  }),
  egg: () => spriteMat('egg', 0.4, 0.5, (p) => {
    p.ell(0, -0.02, 0.13, 0.17, '#fff8e8');
    p.ell(-0.04, 0.05, 0.03, 0.05, '#ffffff', false);
    p.ell(0.05, -0.06, 0.02, 0.02, '#e8d8b0', false);
  }),
  potion: () => spriteMat('potion', 0.5, 0.7, (p) => {
    p.rrect(-0.06, 0.12, 0.12, 0.12, 0.02, '#8a5a2b');
    p.ell(0, -0.08, 0.18, 0.2, '#3fa0ff');
    p.ell(-0.06, -0.02, 0.05, 0.07, '#bfe3ff', false);
    p.rrect(-0.08, 0.08, 0.16, 0.06, 0.02, '#cfe0f0');
  }),
};

const geoCache = new Map<string, THREE.PlaneGeometry>();
function geo(w: number, h: number) {
  const k = w + 'x' + h;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    geoCache.set(k, g);
  }
  return g;
}

export class Pickup {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life = 20;
  taken = false;
  t = rand(0, 6);
  constructor(public kind: PickKind, x: number, y: number, z: number, public value = 10) {
    const [w, h, m] = kind === 'coin' ? [0.4, 0.4, MATS.coin()] : kind === 'potion' ? [0.5, 0.7, MATS.potion()] : kind === 'ham' ? [0.9, 0.7, MATS.ham()] : kind === 'egg' ? [0.4, 0.5, MATS.egg()] : [0.9, 0.7, MATS.chicken()];
    this.mesh = new THREE.Mesh(geo(w, h), m);
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3(rand(-2.5, 2.5), rand(5, 8), rand(-1, 1));
    if (kind !== 'coin') this.vel.set(rand(-1, 1), 6, 0);
    W.scene.add(this.mesh);
  }
  update(dt: number, minZ: number, maxZ: number) {
    this.t += dt;
    this.life -= dt;
    this.vel.y -= 20 * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.pos.z = Math.max(minZ, Math.min(maxZ, this.pos.z));
    const r = this.kind === 'coin' ? 0.2 : 0.3;
    if (this.pos.y < r) {
      this.pos.y = r;
      if (this.vel.y < -2) {
        this.vel.y *= -0.45;
        if (this.kind === 'coin') audio.coin();
      } else this.vel.y = 0;
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
    }
    this.mesh.position.copy(this.pos);
    if (this.vel.y === 0) this.mesh.position.y += Math.sin(this.t * 4) * 0.05 + 0.05;
    if (this.kind === 'coin') this.mesh.scale.x = Math.cos(this.t * 6);
    this.mesh.visible = this.life > 3 || Math.floor(this.life * 8) % 2 === 0;
  }
  dispose() {
    this.mesh.removeFromParent();
  }
}

export class Barrel {
  mesh: THREE.Mesh;
  alive = true;
  hp = 1;
  constructor(public x: number, public z: number, public drop: PickKind | 'gold') {
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.05, 10), toon('#8b5a2b'));
    outline(this.mesh, 0.06);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 10), toon('#555'));
    band.position.y = 0.28;
    const band2 = band.clone();
    band2.position.y = -0.28;
    this.mesh.add(band, band2);
    this.mesh.position.set(x, 0.53, z);
    W.scene.add(this.mesh);
  }
  smash(dir: number): Pickup[] {
    this.alive = false;
    this.mesh.removeFromParent();
    audio.hit(true);
    audio.thud();
    const p = new THREE.Vector3(this.x, 0.6, this.z);
    W.gore.dust(p, 10, '#8b5a2b');
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(geo(0.12, 0.5), woodMat);
      m.position.copy(p);
      W.gore.addDebris(m, 0.08, dir * rand(1, 4) + rand(-2, 2), rand(4, 8), rand(-1, 1), rand(-15, 15), { owned: false, bleedCol: 'none', life: 3 });
    }
    const out: Pickup[] = [];
    if (this.drop === 'gold') for (let i = 0; i < 8; i++) out.push(new Pickup('coin', this.x, 0.8, this.z, 10));
    else out.push(new Pickup(this.drop, this.x, 0.8, this.z, 40));
    if (chance(0.3)) W.fx.text(p.clone().add(new THREE.Vector3(0, 1.2, 0)), 'BARREL\'D!', 'word');
    return out;
  }
}

export { INK };
