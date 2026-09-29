// Prosjektiler: dolker, ildkuler, giftbobler, snøballer, magiske kuler, sjokkbølger, meteorer, lyn og froskatunger.
import * as THREE from 'three';
import { unitCanvas, INK } from '../gfx/draw';
import { W } from './world';
import { applyHit } from './combat';
import { ENEMY_ATK, type AttackDef } from './attacks';
import type { Fighter } from './fighter';
import { audio } from '../core/audio';
import { rand } from '../core/math';
import { ICEFIRE, GHOSTFIRE } from '../gfx/gore';

export type ProjKind = 'dagger' | 'fireball' | 'poison' | 'snowball' | 'bolt' | 'shockwave' | 'meteor' | 'lightning' | 'tongue';

const mats = new Map<string, THREE.MeshBasicMaterial>();
function spriteMat(key: string, w: number, h: number, draw: Parameters<typeof unitCanvas>[5]) {
  let m = mats.get(key);
  if (!m) {
    const t = new THREE.CanvasTexture(unitCanvas(w, h, w / 2, h / 2, 128, draw));
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide });
    mats.set(key, m);
  }
  return m;
}
const SPR: Partial<Record<ProjKind, () => [THREE.MeshBasicMaterial, number, number]>> = {
  dagger: () => [spriteMat('dagger', 0.8, 0.3, (p) => {
    p.rrect(-0.34, -0.035, 0.16, 0.07, 0.02, '#3a2414');
    p.rrect(-0.2, -0.08, 0.04, 0.16, 0.01, '#d4a63a');
    p.shape((c) => { c.moveTo(-0.16, -0.05); c.lineTo(0.32, 0); c.lineTo(-0.16, 0.05); c.closePath(); }, '#d6dde6');
  }), 0.8, 0.3],
  poison: () => [spriteMat('poison', 0.5, 0.5, (p) => {
    p.ell(0, 0, 0.2, 0.2, '#7ad44a');
    p.ell(-0.07, 0.07, 0.06, 0.05, '#e0ffc0', false);
    p.ell(0.08, -0.06, 0.04, 0.04, '#3f8f1d', false);
  }), 0.5, 0.5],
  snowball: () => [spriteMat('snowball', 0.7, 0.7, (p) => {
    p.ell(0, 0, 0.3, 0.3, '#f6fafc');
    p.ell(0.08, -0.08, 0.14, 0.12, '#d0e0ee', false);
    p.ell(-0.1, 0.1, 0.06, 0.05, '#ffffff', false);
  }), 0.7, 0.7],
  fireball: () => [spriteMat('fireball', 0.5, 0.5, (p) => {
    p.ell(0, 0, 0.2, 0.2, '#ffb02e');
    p.ell(0.03, 0.03, 0.11, 0.11, '#fff0a0', false);
  }), 0.5, 0.5],
};

const PROJ_ATK: AttackDef = { ...ENEMY_ATK.stab, id: 'proj', push: 2.5, stun: 0.35, death: ['normal'] };
const BOOM_ATK: AttackDef = { ...ENEMY_ATK.hog, id: 'boom', kd: true, launch: 7, push: 5, death: ['explode'] };
const WAVE_ATK: AttackDef = { ...ENEMY_ATK.hog, id: 'wave', height: 'low', kd: true, launch: 6, push: 4, death: ['legsoff'] };

export interface ProjOpts {
  kind: ProjKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy?: number;
  vz?: number;
  owner: Fighter;
  dmg: number;
  grav?: number;
  life?: number;
  delay?: number;
  onHit?: (t: Fighter) => void;
  origin?: () => THREE.Vector3;
}

export class Projectile {
  alive = true;
  t = 0;
  mesh: THREE.Mesh | null = null;
  marker: THREE.Mesh | null = null;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  kind: ProjKind;
  owner: Fighter;
  dmg: number;
  grav: number;
  life: number;
  delay: number;
  hit = new Set<number>();
  onHit?: (t: Fighter) => void;
  origin?: () => THREE.Vector3;
  retract = false;

  constructor(o: ProjOpts) {
    this.kind = o.kind;
    this.pos = new THREE.Vector3(o.x, o.y, o.z);
    this.vel = new THREE.Vector3(o.vx, o.vy ?? 0, o.vz ?? 0);
    this.owner = o.owner;
    this.dmg = o.dmg;
    this.grav = o.grav ?? 0;
    this.life = o.life ?? 3;
    this.delay = o.delay ?? 0;
    this.onHit = o.onHit;
    this.origin = o.origin;
    const spr = SPR[o.kind]?.();
    if (spr) {
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(spr[1], spr[2]), spr[0]);
      this.mesh.scale.x = Math.sign(o.vx) || 1;
      W.scene.add(this.mesh);
    }
    if (o.kind === 'tongue') {
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.22), new THREE.MeshBasicMaterial({ color: '#e0607a', side: THREE.DoubleSide }));
      W.scene.add(this.mesh);
    }
    if (o.kind === 'meteor' || o.kind === 'lightning') {
      this.marker = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 24), new THREE.MeshBasicMaterial({ color: o.kind === 'meteor' ? '#ff3b1a' : '#9fd8ff', transparent: true, opacity: 0.6, depthWrite: false }));
      this.marker.rotation.x = -Math.PI / 2;
      this.marker.position.set(o.kind === 'meteor' ? o.x + o.vx * 0 : o.x, 0.05, o.z);
      W.scene.add(this.marker);
    }
  }

  kill() {
    this.alive = false;
    this.mesh?.removeFromParent();
    this.marker?.removeFromParent();
  }

  get target(): 'hero' | 'enemy' {
    return this.owner.team === 'hero' ? 'enemy' : 'hero';
  }
}

export class Projectiles {
  list: Projectile[] = [];

  spawn(o: ProjOpts) {
    const p = new Projectile(o);
    if (o.kind === 'meteor') {
      // Start høyt oppe og litt til venstre, treff markøren etter 'delay' + 0.6 s
      p.marker!.position.x = o.x;
      p.pos.set(o.x - 4, 13, o.z);
    }
    this.list.push(p);
    return p;
  }

  update(dt: number, targets: Fighter[]) {
    const g = W.gore;
    for (const p of this.list) {
      if (!p.alive) continue;
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.marker) (p.marker.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.3 * Math.sin(W.time * 20);
        continue;
      }
      p.t += dt;
      switch (p.kind) {
        case 'meteor': {
          const k = Math.min(1, p.t / 0.6);
          const tx = p.marker!.position.x;
          p.pos.set(tx - 4 * (1 - k), 13 * (1 - k) + 0.4, p.marker!.position.z);
          g.fire(p.pos, 3, 0.35, 0.5);
          g.flare(p.pos, 1.0, '#ffb02e', 0.05);
          if (k >= 1) {
            this.explode(p, targets, 1.8, 'fire');
            continue;
          }
          break;
        }
        case 'lightning': {
          if (p.t > 0.05) {
            const x = p.marker!.position.x;
            const z = p.marker!.position.z;
            for (let i = 0; i < 26; i++) g.flare(new THREE.Vector3(x + rand(-0.25, 0.25), i * 0.45, z), 0.55, '#bfe8ff', 0.25);
            W.fx.flash('#cfe8ff', 0.25, 0.15);
            audio.boom(0.6);
            p.pos.set(x, 0.5, z);
            this.explode(p, targets, 1.3, 'zap');
            continue;
          }
          break;
        }
        case 'shockwave': {
          p.pos.x += p.vel.x * dt;
          g.dust(p.pos, 1, '#8a7a60');
          if (Math.random() < 0.6) g.fire(new THREE.Vector3(p.pos.x, 0.2, p.pos.z), 1, 0.3, 2);
          break;
        }
        case 'tongue': {
          const o = p.origin?.() ?? p.pos;
          if (!p.retract) {
            p.pos.x += p.vel.x * dt;
            if (p.t > 0.45) p.retract = true;
          } else {
            p.pos.x += (o.x - p.pos.x) * Math.min(1, dt * 10);
            if (Math.abs(o.x - p.pos.x) < 0.3) {
              p.kill();
              continue;
            }
          }
          const len = Math.abs(p.pos.x - o.x);
          if (p.mesh) {
            p.mesh.scale.set(Math.max(0.01, len), 1, 1);
            p.mesh.position.set((p.pos.x + o.x) / 2, o.y, p.pos.z + 0.1);
          }
          p.pos.y = o.y;
          break;
        }
        default: {
          p.vel.y -= p.grav * dt;
          p.pos.addScaledVector(p.vel, dt);
          if (p.kind === 'fireball') g.fire(p.pos, 1, 0.12, 0.4);
          if (p.kind === 'bolt') {
            g.flare(p.pos, 0.7, '#c080ff', 0.06);
            if (Math.random() < 0.5) g.fire(p.pos, 1, 0.1, 0.2, GHOSTFIRE);
          }
          if (p.kind === 'snowball' && Math.random() < 0.3) g.fire(p.pos, 1, 0.1, 0.1, ICEFIRE);
          if (p.pos.y <= 0.1 && p.grav > 0) {
            if (p.kind === 'snowball') g.dust(p.pos, 8, '#ffffff');
            if (p.kind === 'poison') g.splat(p.pos.x, p.pos.z, 0.6, 'green');
            if (p.kind === 'fireball') g.fire(p.pos, 8, 0.4, 2);
            p.kill();
            continue;
          }
        }
      }
      if (p.mesh && p.kind !== 'tongue') {
        p.mesh.position.copy(p.pos);
        if (p.kind === 'dagger') p.mesh.rotation.z = Math.sin(p.t * 30) * 0.08;
        else p.mesh.rotation.z += dt * 8;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.kill();
        continue;
      }
      // Kollisjon
      for (const f of targets) {
        if (!f.alive || f.team !== p.target || f.invuln > 0 || p.hit.has(f.id)) continue;
        if (f.state === 'down' && f.onGround) continue;
        const dx = Math.abs(f.pos.x - p.pos.x);
        const dz = Math.abs(f.pos.z - p.pos.z);
        if (p.kind === 'shockwave') {
          if (dx < 0.6 && dz < 1.3 && f.pos.y < 0.35) {
            p.hit.add(f.id);
            applyHit(p.owner, f, WAVE_ATK, p.dmg);
          }
          continue;
        }
        const fy = f.pos.y + 1.0 * f.size;
        if (dx < 0.55 && dz < 0.55 && Math.abs(fy - p.pos.y) < 1.1) {
          p.hit.add(f.id);
          if (p.kind === 'tongue') {
            p.retract = true;
            p.onHit?.(f);
            continue;
          }
          applyHit(p.owner, f, PROJ_ATK, p.dmg);
          if (p.kind === 'snowball') g.dust(p.pos, 10, '#ffffff');
          if (p.kind === 'poison') g.burst(p.pos, 12, 3, 0.08, 'green');
          if (p.kind === 'fireball') g.fire(p.pos, 10, 0.4, 2);
          p.kill();
          break;
        }
      }
    }
    this.list = this.list.filter((p) => p.alive);
  }

  private explode(p: Projectile, targets: Fighter[], r: number, kind: 'fire' | 'zap') {
    const g = W.gore;
    const at = p.marker ? p.marker.position.clone().setY(0.5) : p.pos.clone();
    if (kind === 'fire') {
      g.flare(at, 3, '#ffd35a', 0.35);
      g.fire(at, 24, 1.0, 5);
      audio.boom(0.8);
      W.fx.shake(0.4);
      g.splat(at.x, at.z, 1.2, 'lava');
    } else {
      g.sparks(at, 16, '#bfe8ff', 7);
      W.fx.shake(0.3);
    }
    for (const f of targets) {
      if (!f.alive || f.team !== p.target || f.invuln > 0) continue;
      if (Math.hypot(f.pos.x - at.x, (f.pos.z - at.z) * 1.4) < r && f.pos.y < 1.5) applyHit(p.owner, f, BOOM_ATK, p.dmg);
    }
    p.kill();
  }

  clear() {
    for (const p of this.list) p.kill();
    this.list = [];
  }
}

export { INK };
