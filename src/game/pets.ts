// Kjæledyr på brettene: følger helten og bruker evnen sin på nedkjøling.
import * as THREE from 'three';
import type { Fighter } from './fighter';
import type { Hero } from './hero';
import { P, type AttackDef } from './attacks';
import { applyHit } from './combat';
import { W } from './world';
import { Pickup } from './items';
import type { Projectiles } from './projectiles';
import { petMesh } from '../gfx/pets';
import { PETS, INSULTS, SOBS, type PetDef } from '../data/pets';
import { audio } from '../core/audio';
import { pick, rand } from '../core/math';

const BITE: AttackDef = {
  id: 'bite', startup: 0, active: 0.1, recovery: 0, dmg: 6, reach: 1, zr: 1, height: 'low', push: 0.8, stun: 0.45,
  wind: P.hurt, strike: P.hurt, death: ['legsoff', 'normal'], swoosh: 'none', word: ['NOM!', 'CHOMP!', 'ANKLE BITTEN!'],
};

export interface PetWorld {
  foeFighters(): Fighter[];
  pickups: Pickup[];
  proj: Projectiles;
}

export class Pet {
  mesh: THREE.Mesh;
  pos = new THREE.Vector3();
  facing = 1;
  cd = 2;
  t = rand(0, 5);
  mode: 'follow' | 'dash' | 'back' = 'follow';
  target: Fighter | null = null;
  def: PetDef;
  /** Fienden som akkurat ble fornærmet (gråter etter en liten pause, i spilltid). */
  private insulted: { t: Fighter; delay: number } | null = null;

  constructor(id: string, public owner: Hero) {
    this.def = PETS[id];
    this.mesh = petMesh(id);
    const o = owner.f.pos;
    this.pos.set(o.x - 1, this.def.flies ? 2.2 : 0.3, o.z - 0.4);
  }

  addTo(scene: THREE.Object3D) {
    scene.add(this.mesh);
  }

  remove() {
    this.mesh.removeFromParent();
  }

  private nearestFoe(w: PetWorld, range: number, front = false) {
    const h = this.owner.f;
    let best: Fighter | null = null;
    let bd = range;
    for (const f of w.foeFighters()) {
      if (!f.alive || f.state === 'held' || f.armored || f.hidden) continue;
      const dx = f.pos.x - h.pos.x;
      if (front && Math.sign(dx) !== h.facing) continue;
      const d = Math.abs(dx) + Math.abs(f.pos.z - h.pos.z) * 0.5;
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  update(dt: number, w: PetWorld) {
    this.t += dt;
    this.cd -= dt;
    const h = this.owner.f;
    const flies = this.def.flies;
    // Følg helten
    const home = new THREE.Vector3(h.pos.x - h.facing * 1.1, flies ? 2.3 + Math.sin(this.t * 3) * 0.15 : 0.28, h.pos.z - 0.45);
    if (this.mode === 'dash' && this.target) {
      const tp = this.target.pos;
      const d = new THREE.Vector3(tp.x - this.pos.x, 0, tp.z - this.pos.z);
      const len = d.length();
      this.facing = Math.sign(d.x) || this.facing;
      if (!this.target.alive || len > 9 || this.t > 2.5) this.mode = 'back';
      else if (len < 0.6) {
        applyHit(h, this.target, BITE);
        audio.bite();
        this.mode = 'back';
      } else this.pos.addScaledVector(d.normalize(), Math.min(len, dt * 9));
    } else {
      const k = Math.min(1, dt * (this.mode === 'back' ? 6 : 3.5));
      this.pos.lerp(home, k);
      if (this.mode === 'back' && this.pos.distanceTo(home) < 0.4) this.mode = 'follow';
      const vx = home.x - this.pos.x;
      if (Math.abs(vx) > 0.2) this.facing = Math.sign(vx);
      else this.facing = h.facing;
    }
    if (h.alive && this.cd <= 0 && this.mode === 'follow') this.ability(w);
    if (this.insulted) {
      this.insulted.delay -= dt;
      const t = this.insulted.t;
      if (this.insulted.delay <= 0) {
        this.insulted = null;
        if (t.alive && t.state !== 'held' && !t.mount && t.rig.root.parent) {
          t.setState('stunned');
          t.stunT = 1.8;
          t.atk = null;
          W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(SOBS), 'speech', 1.6);
          for (let i = 0; i < 6; i++) W.gore.ambient(t.headPoint().x + rand(-0.2, 0.2), t.headPoint().y, t.pos.z + 0.2, rand(-1, 1), rand(0.5, 2), '#6fc0ff', 0.08, 0.8, false, 8);
        }
      }
    }
    if (this.def.ability === 'magnet' && h.alive) {
      // Øyeeplet suger til seg gull fra hele skjermen
      for (const p of w.pickups) {
        if (p.kind !== 'coin' || p.taken || p.vel.y !== 0) continue;
        const dx = h.pos.x - p.pos.x, dz = h.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 12 && d > 0.3) {
          p.pos.x += (dx / d) * dt * 11;
          p.pos.z += (dz / d) * dt * 11;
        }
      }
    }
    // Animasjon: vugging, og beina/vingene later som de beveger seg
    const m = this.mesh;
    m.position.copy(this.pos);
    if (!flies) m.position.y = 0.36 + Math.abs(Math.sin(this.t * 14)) * (this.mode === 'dash' ? 0.12 : 0.04);
    const S = 1.35;
    m.scale.set(this.facing * S, S * (1 + (flies ? Math.sin(this.t * 12) * 0.05 : 0)), S);
    m.rotation.z = Math.sin(this.t * (flies ? 3 : 10)) * 0.08;
  }

  private ability(w: PetWorld) {
    const h = this.owner.f;
    switch (this.def.ability) {
      case 'bite': {
        const t = this.nearestFoe(w, 5.5);
        if (!t) return;
        this.target = t;
        this.mode = 'dash';
        this.t = 0;
        this.cd = this.def.cd;
        audio.grunt('imp');
        break;
      }
      case 'fire': {
        const t = this.nearestFoe(w, 8, true);
        if (!t) return;
        const dir = Math.sign(t.pos.x - this.pos.x) || 1;
        this.facing = dir;
        const dy = t.pos.y + 1.0 - this.pos.y;
        w.proj.spawn({ kind: 'fireball', owner: h, x: this.pos.x + dir * 0.3, y: this.pos.y, z: t.pos.z, vx: dir * 9, vy: (dy / Math.max(0.3, Math.abs(t.pos.x - this.pos.x))) * 9, dmg: 10, life: 2 });
        audio.fireBreath(0.3);
        this.cd = this.def.cd;
        break;
      }
      case 'insult': {
        const t = this.nearestFoe(w, 7);
        if (!t || t.state === 'stunned') return;
        this.cd = this.def.cd;
        W.fx.text(this.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), pick(INSULTS), 'speech', 2);
        audio.grunt('skeleton');
        this.insulted = { t, delay: 0.7 };
        break;
      }
      case 'heal': {
        if (h.hp > h.maxHp * 0.55) return;
        this.cd = this.def.cd;
        w.pickups.push(new Pickup('egg', this.pos.x, 0.6, this.pos.z));
        audio.cluck();
        W.fx.text(this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 'BAWK! (EGG)', 'word', 1);
        break;
      }
      case 'magnet':
        break;
    }
  }
}
