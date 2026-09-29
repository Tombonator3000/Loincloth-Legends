// Fiende-AI for brettene. Oppførselen styres av FoeDef.behavior.
import * as THREE from 'three';
import { Fighter } from './fighter';
import { ENEMY_ATK } from './attacks';
import { W } from './world';
import type { Hero } from './hero';
import type { Projectiles, ProjKind } from './projectiles';
import type { FoeDef } from '../data/enemies';
import { audio } from '../core/audio';
import { rand, chance } from '../core/math';

export interface FoeWorld {
  frozen: boolean;
  camX: number;
  halfW: number;
  proj: Projectiles;
  nearestHero(p: THREE.Vector3): Hero | null;
  requestToken(f: Foe): boolean;
  releaseToken(f: Foe): void;
  onScreen(x: number, margin: number): boolean;
}

const PROJ_SPEC: Record<ProjKind, { speed: number; vy: number; grav: number; dmg: number }> = {
  dagger: { speed: 11, vy: 0, grav: 0, dmg: 7 },
  fireball: { speed: 8, vy: 0, grav: 0, dmg: 9 },
  bolt: { speed: 7.5, vy: 0, grav: 0, dmg: 9 },
  poison: { speed: 7, vy: 4, grav: 9, dmg: 8 },
  snowball: { speed: 9, vy: 5, grav: 12, dmg: 11 },
  shockwave: { speed: 8, vy: 0, grav: 0, dmg: 12 },
  meteor: { speed: 0, vy: 0, grav: 0, dmg: 18 },
  lightning: { speed: 0, vy: 0, grav: 0, dmg: 16 },
  tongue: { speed: 16, vy: 0, grav: 0, dmg: 8 },
};

export function fireProjectile(proj: Projectiles, owner: Fighter, kind: ProjKind, dirX: number, vz = 0, dmgMul = 1) {
  const s = PROJ_SPEC[kind];
  proj.spawn({
    kind, owner, x: owner.pos.x + dirX * 0.7 * owner.size, y: owner.pos.y + 1.3 * owner.size, z: owner.pos.z + 0.05,
    vx: dirX * s.speed, vy: s.vy, vz, grav: s.grav, dmg: s.dmg * dmgMul, life: 3,
  });
  audio.swish(1.3);
}

export class Foe {
  f: Fighter;
  token = false;
  cd = rand(0.6, 1.6);
  projCd = rand(1, 3);
  hoverDz = rand(-1.2, 1.2);
  hoverDx = rand(3, 4.6);
  side = 1;
  thrown = false;
  hits = 0;
  dir = 1;
  escaped = false;
  leapCd = rand(1, 2.5);

  constructor(public def: FoeDef, x: number, z: number, hpMul = 1) {
    // Litt variasjon per fiende, etter oppskriftssystemet i Toms Morbidium: størrelse og en svak fargetone, så en bølge
    // av samme type ikke ser klonet ut. Tonen tas i trinn, så hodet som klasker i skjermen (headImage) har få varianter.
    const base = def.tint ?? [1, 1, 1];
    const k = 0.9 + Math.floor(rand(0, 5)) * 0.04, warm = (Math.floor(rand(0, 5)) - 2) * 0.02;
    const tint: [number, number, number] = [base[0] * k * (1 + warm), base[1] * k, base[2] * k * (1 - warm)];
    const scale = (def.scale ?? 1) * rand(0.92, 1.08);
    this.f = new Fighter(def.char, 'enemy', { hp: def.hp * hpMul, speed: def.speed * rand(0.9, 1.1), tint, scale, poseMod: def.poseMod });
    this.f.label = def.name;
    this.f.pos.set(x, 0, z);
  }

  get kind() {
    return this.def.id;
  }

  update(dt: number, st: FoeWorld) {
    const f = this.f;
    if (!f.alive) {
      if (this.token) st.releaseToken(this);
      return;
    }
    f.wantVX = f.wantVZ = 0;
    if (st.frozen) return;
    // Rytter: dyret har egen AI (game/mounts.ts)
    if (f.mount) {
      if (this.token) st.releaseToken(this);
      return;
    }
    this.cd -= dt;
    this.projCd -= dt;
    this.leapCd -= dt;
    if (this.token && f.state !== 'attack' && this.thrown) st.releaseToken(this);
    if (this.token && (f.state === 'hurt' || f.state === 'down' || f.state === 'held')) st.releaseToken(this);

    if (f.state === 'attack' && f.atk?.projectile && f.phase() === 'active' && !this.thrown) {
      this.thrown = true;
      if (this.def.proj) fireProjectile(st.proj, f, this.def.proj, f.facing);
    }
    if (f.state === 'attack' && f.phase() === 'active') this.thrown = true;

    // Froskemannen: angrep i lufta
    if (this.def.behavior === 'jumper' && f.state === 'jump' && !f.airAttackUsed && f.vel.y < 2) {
      f.airAttackUsed = true;
      f.startAttack(this.def.air ?? { ...this.def.attack, id: 'air-' + this.def.id, air: true, kd: true, launch: 4 });
    }
    if (!f.canAct()) return;
    if (this.def.behavior === 'runner') return this.runner(st);

    const tgt = st.nearestHero(f.pos);
    if (!tgt) return;
    const tf = tgt.f;
    const dx = tf.pos.x - f.pos.x;
    const dz = tf.pos.z - f.pos.z;
    const adx = Math.abs(dx);
    this.side = f.pos.x > tf.pos.x ? 1 : -1;

    // Kast prosjektil (kultister, imper, trollet)
    if (this.def.proj && this.projCd <= 0 && adx > 3.2 && adx < 9 && Math.abs(dz) < 0.4 && st.onScreen(f.pos.x, 0.5)) {
      f.face(dx);
      this.thrown = false;
      f.startAttack(ENEMY_ATK.throw);
      const [a, b] = this.def.projCd ?? [2.5, 3.5];
      this.projCd = rand(a, b);
      return;
    }

    switch (this.def.behavior) {
      case 'ranged': {
        if (adx < 1.5 && Math.abs(dz) < 0.5 && this.cd <= 0) {
          f.face(dx);
          this.thrown = false;
          f.startAttack(this.def.attack);
          this.cd = rand(1.2, 2);
          return;
        }
        this.moveTo(tf.pos.x + this.side * this.def.range, tf.pos.z, 0.8);
        f.face(dx);
        return;
      }
      case 'shambler': {
        if (adx < this.def.range + 0.2 && Math.abs(dz) < 0.4 && this.cd <= 0) {
          f.face(dx);
          this.thrown = false;
          f.startAttack(this.def.attack);
          this.cd = rand(1.4, 2.4);
          return;
        }
        this.moveTo(tf.pos.x + this.side * (this.def.range - 0.2), tf.pos.z, 1);
        f.face(dx);
        return;
      }
      case 'jumper': {
        if (this.leapCd <= 0 && adx > 2.2 && adx < 5.5 && Math.abs(dz) < 1.2) {
          f.face(dx);
          const air = 0.72;
          f.jump((dx - Math.sign(dx) * 1.4) / air, dz / air, 9.4);
          this.leapCd = rand(2.5, 4);
          return;
        }
        break;
      }
    }
    // Nærkamp (melee, brute, jumper på bakken)
    const range = this.def.range;
    if (this.token || (this.cd <= 0 && st.requestToken(this))) {
      const tx = tf.pos.x + this.side * range;
      const near = Math.abs(f.pos.x - tx) < 0.45 && Math.abs(dz) < 0.3;
      if (near && this.cd <= 0) {
        f.face(dx);
        this.thrown = false;
        f.startAttack(this.def.attack);
        this.cd = this.def.behavior === 'brute' ? rand(1.8, 3) : rand(1.1, 2.2);
        return;
      }
      this.moveTo(tx, tf.pos.z, 1);
    } else {
      if (chance(dt * 0.3)) this.hoverDz = rand(-1.5, 1.5);
      this.moveTo(tf.pos.x + this.side * this.hoverDx, tf.pos.z + this.hoverDz, 0.6);
    }
    f.face(dx);
  }

  private moveTo(x: number, z: number, speedMul: number) {
    const f = this.f;
    const ddx = x - f.pos.x;
    const ddz = z - f.pos.z;
    const d = Math.hypot(ddx, ddz);
    if (d < 0.12) return;
    const sp = Math.min(f.speed * speedMul, d * 3);
    f.wantVX = (ddx / d) * sp;
    f.wantVZ = (ddz / d) * sp * 0.75;
  }

  private runner(st: FoeWorld) {
    const f = this.f;
    f.running = true;
    f.state = 'flee';
    f.wantVX = this.dir * f.speed * (this.hits > 0 ? 1.4 : 1);
    f.wantVZ = Math.sin(W.time * 2 + f.id) * 1.2;
    f.face(this.dir);
    const out = this.dir > 0 ? f.pos.x > st.camX + st.halfW + 2.5 : f.pos.x < st.camX - st.halfW - 2.5;
    if (out) {
      this.escaped = true;
      f.removeMe = true;
      f.alive = false;
    }
  }
}
