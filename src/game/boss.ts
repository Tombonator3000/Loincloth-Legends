// Sjef-AI: velger vektede trekk (nærkamp, stormløp, magaplask, byks, skyting, innkalling, teleport, tunge, regn).
import * as THREE from 'three';
import { Fighter, GRAVITY } from './fighter';
import { P, ENEMY_ATK, type AttackDef } from './attacks';
import { applyHit } from './combat';
import { W } from './world';
import { fireProjectile } from './foes';
import type { Hero } from './hero';
import type { Projectiles } from './projectiles';
import type { BossDef, BossMove } from '../data/bosses';
import { audio } from '../core/audio';
import { rand, pick, clamp } from '../core/math';

export interface BossWorld {
  heroes: Hero[];
  proj: Projectiles;
  frozen: boolean;
  camX: number;
  halfW: number;
  spawnFoe(id: string, side: 'L' | 'R'): void;
  addsAlive(): number;
  say(who: string, text: string, dur?: number): void;
}

const CHARGE: AttackDef = {
  id: 'charge', startup: 0.7, active: 1.0, recovery: 0.9, dmg: 14, reach: 2.2, back: 0.6, zr: 1.2, height: 'mid', kd: true, launch: 7, push: 9, stun: 0.6,
  lunge: 10, heavy: true, armor: true, wind: { ...P.crouch, torso: -0.6 }, strike: P.dashS, death: ['explode'], swoosh: 'none', word: ['SPLAT!'],
};
const CAST: AttackDef = { ...ENEMY_ATK.throw, id: 'cast', startup: 0.5, recovery: 0.5, armor: true };
const SLAM_AOE: AttackDef = { ...ENEMY_ATK.hog, id: 'slam', kd: true, launch: 8, push: 6, dmg: 16, death: ['explode'] };
const CHOMP: AttackDef = { ...ENEMY_ATK.hog, id: 'chomp', dmg: 12, kd: true, launch: 5, push: 6, death: ['decap'] };

export class BossCtl {
  f: Fighter;
  moves: BossMove[];
  cds: number[];
  cur: BossMove | null = null;
  mode: 'intro' | 'think' | 'exec' | 'dead' = 'intro';
  t = 0;
  thinkT = 0.8;
  enraged = false;
  stagger = 0;
  speedMul = 1;
  cdMul = 1;
  target: Hero | null = null;
  landed = false;
  pullTarget: Fighter | null = null;

  constructor(public def: BossDef, x: number, z: number, hpMul: number, private w: BossWorld) {
    this.f = new Fighter(def.char, 'enemy', { hp: def.hp * hpMul, speed: def.speed, tint: def.tint });
    this.f.label = def.name;
    this.f.pos.set(x, 0, z);
    this.f.facing = -1;
    this.f.armored = true;
    this.f.noSever = true;
    this.f.corpseLife = 999;
    this.moves = [...def.moves];
    this.cds = this.moves.map((m) => m.cd * 0.5);
    this.f.onArmorHit = (dmg) => {
      this.stagger += dmg;
      if (this.stagger > this.def.stagger * this.f.maxHp && this.mode !== 'dead') {
        this.stagger = 0;
        this.interrupt();
        this.f.armored = false;
        this.f.hurt(0.8, 0);
        this.f.flash(0.2);
        W.fx.text(this.f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), 'STAGGERED!', 'word');
      }
    };
    this.f.onLand = () => {
      if (this.mode === 'exec' && (this.cur?.kind === 'slam' || this.cur?.kind === 'leap')) this.landed = true;
    };
  }

  private interrupt() {
    this.cur = null;
    this.mode = 'think';
    this.thinkT = 0.6;
    this.f.rig.root.visible = true;
  }

  private pickTarget() {
    const alive = this.w.heroes.filter((h) => h.f.alive);
    if (!alive.length) return null;
    return alive.reduce((a, b) => (Math.abs(a.f.pos.x - this.f.pos.x) < Math.abs(b.f.pos.x - this.f.pos.x) ? a : b));
  }

  update(dt: number) {
    const f = this.f;
    f.wantVX = f.wantVZ = 0;
    if (!f.alive) {
      this.mode = 'dead';
      return;
    }
    if (this.w.frozen) return;
    if (f.state !== 'hurt' && !f.armored) f.armored = true;
    for (let i = 0; i < this.cds.length; i++) this.cds[i] -= dt;
    this.t += dt;

    if (!this.enraged && f.hp <= f.maxHp * this.def.enrage.at) {
      this.enraged = true;
      const e = this.def.enrage;
      this.speedMul = e.speedMul;
      this.cdMul = e.cdMul;
      for (const m of e.extra) {
        this.moves.push(m);
        this.cds.push(1);
      }
      f.speed = this.def.speed * e.speedMul;
      this.w.say(this.def.name, e.line, 2.4);
      W.fx.flash('#8e0015', 0.35, 0.5);
      W.fx.shake(0.5);
      audio.scream(f.def.voice);
      f.rig.setFlashColor(1, 0.25, 0.2);
      f.flash(0.4);
    }

    this.target = this.pickTarget();
    const tgt = this.target?.f;
    if (!tgt) return;
    const dx = tgt.pos.x - f.pos.x;
    const dz = tgt.pos.z - f.pos.z;
    const d = Math.abs(dx);

    if (this.mode === 'intro') {
      if (this.t > 2.4) {
        this.mode = 'think';
        this.thinkT = 0.3;
      } else {
        f.wantVX = -f.speed * 0.8;
        f.face(-1);
      }
      return;
    }

    if (this.mode === 'think') {
      if (!f.canAct()) return;
      this.thinkT -= dt;
      f.face(dx);
      // Gå mot en behagelig avstand
      const want = 2.2;
      if (d > want + 0.5) f.wantVX = Math.sign(dx) * f.speed;
      else if (d < want - 0.6) f.wantVX = -Math.sign(dx) * f.speed * 0.6;
      f.wantVZ = clamp(dz * 2, -f.speed * 0.6, f.speed * 0.6);
      if (this.thinkT <= 0) this.choose(d);
      return;
    }

    if (this.mode === 'exec' && this.cur) this.exec(this.cur, dt, tgt, dx, dz, d);
  }

  private choose(d: number) {
    const opts = this.moves.map((m, i) => ({ m, i })).filter(({ m, i }) => this.cds[i] <= 0 && (!m.range || (d >= m.range[0] && d <= m.range[1])));
    const nonMelee = opts.filter((o) => o.m.kind !== 'melee');
    const pool = opts.length ? opts : this.moves.map((m, i) => ({ m, i })).filter((o) => o.m.kind === 'melee');
    if (!pool.length) {
      this.thinkT = 0.3;
      return;
    }
    let total = 0;
    for (const o of pool) total += o.m.weight * (o.m.kind === 'summon' && this.w.addsAlive() >= 3 ? 0 : 1);
    let r = Math.random() * total;
    let pickd = pool[0];
    for (const o of pool) {
      r -= o.m.weight * (o.m.kind === 'summon' && this.w.addsAlive() >= 3 ? 0 : 1);
      if (r <= 0) {
        pickd = o;
        break;
      }
    }
    void nonMelee;
    this.cur = pickd.m;
    this.cds[pickd.i] = pickd.m.cd * this.cdMul;
    this.mode = 'exec';
    this.t = 0;
    this.landed = false;
    if (pickd.m.say) this.w.say(this.def.name, pickd.m.say, 1.4);
  }

  private done(rest = 0.6) {
    this.cur = null;
    this.mode = 'think';
    this.thinkT = rest / this.speedMul;
  }

  private exec(m: BossMove, dt: number, tgt: Fighter, dx: number, dz: number, d: number) {
    const f = this.f;
    switch (m.kind) {
      case 'melee': {
        if (f.state === 'attack') {
          if (f.phase() === 'recover' && f.st > (f.atk?.startup ?? 0) + (f.atk?.active ?? 0) + 0.2) this.done(0.5);
          return;
        }
        if (this.t > 3) return this.done(0.3);
        const reach = (m.attack?.reach ?? 2.4) * 0.8;
        if (d > reach || Math.abs(dz) > 0.4) {
          f.wantVX = Math.sign(dx) * f.speed * 1.1;
          f.wantVZ = clamp(dz * 3, -f.speed, f.speed);
          f.face(dx);
          return;
        }
        f.face(dx);
        f.startAttack(m.attack ?? ENEMY_ATK.hog);
        return;
      }
      case 'charge': {
        if (this.t < 0.05 && f.state !== 'attack') {
          f.face(dx);
          f.pos.z += clamp(dz, -1, 1);
          f.startAttack(CHARGE);
          f.rig.setFlashColor(1, 0.3, 0.2);
          audio.scream(f.def.voice);
          return;
        }
        if (f.state === 'attack' && f.phase() === 'wind') f.flash(Math.sin(this.t * 30) > 0 ? 0.1 : 0);
        if (f.state === 'attack' && f.phase() === 'active' && Math.random() < 0.5) W.gore.dust(f.pos, 2);
        if (f.state !== 'attack') this.done(0.8);
        return;
      }
      case 'slam':
      case 'leap': {
        if (this.t < 0.05 && f.onGround && f.canAct()) {
          const air = (2 * 11.5) / GRAVITY;
          if (m.kind === 'leap') f.jump(clamp(dx / air, -9, 9), clamp(dz / air, -3, 3), 11.5);
          else f.jump(0, 0, 11.5);
          f.face(dx);
          return;
        }
        if (this.landed) {
          this.landed = false;
          W.fx.shake(0.8);
          audio.boom(0.9);
          W.gore.dust(f.pos, 20);
          for (const dir of [-1, 1]) this.w.proj.spawn({ kind: 'shockwave', owner: f, x: f.pos.x + dir * 1.2, y: 0.2, z: f.pos.z, vx: dir * 9, dmg: 12, life: 1.6 });
          for (const h of this.w.heroes) {
            const hf = h.f;
            if (hf.alive && hf.invuln <= 0 && Math.hypot(hf.pos.x - f.pos.x, (hf.pos.z - f.pos.z) * 1.4) < 2.4 * (f.size / 2)) applyHit(f, hf, SLAM_AOE);
          }
          this.done(0.9);
        }
        if (this.t > 3) this.done(0.3);
        return;
      }
      case 'shoot': {
        if (this.t < 0.05 && f.canAct()) {
          f.face(dx);
          f.startAttack(CAST);
          return;
        }
        if (f.state === 'attack' && f.phase() === 'active' && this.t < 10) {
          const n = m.count ?? 1;
          for (let i = 0; i < n; i++) {
            const k = n === 1 ? 0 : i / (n - 1) - 0.5;
            fireProjectile(this.w.proj, f, m.proj ?? 'fireball', f.facing, k * (m.spread ?? 0.3) * 8, 1.2);
          }
          this.t = 10;
        }
        if (f.state !== 'attack' && this.t > 0.2) this.done(0.7);
        return;
      }
      case 'summon': {
        if (this.t < 0.05) {
          f.setState('magic');
          audio.magic();
          W.fx.flash('#2a0040', 0.3, 0.6);
          return;
        }
        if (this.t > 0.9 && f.state === 'magic') {
          const list = m.summon ?? ['skeleton'];
          const n = m.count ?? 2;
          for (let i = 0; i < n; i++) this.w.spawnFoe(pick(list), i % 2 ? 'L' : 'R');
          f.setState('idle');
          this.done(0.8);
        }
        return;
      }
      case 'teleport': {
        if (this.t < 0.05) {
          W.gore.fire(f.torsoPoint(), 20, 0.8, 2, ['#c080ff', '#8a40ff', '#ffffff']);
          audio.magic();
          f.rig.root.visible = false;
          f.invuln = 0.6;
          return;
        }
        if (this.t > 0.5 && !f.rig.root.visible) {
          const side = tgt.facing;
          const nx = clamp(tgt.pos.x - side * 2.0, this.w.camX - this.w.halfW + 1, this.w.camX + this.w.halfW - 1);
          f.pos.set(nx, 0, tgt.pos.z);
          f.face(tgt.pos.x - nx);
          f.rig.root.visible = true;
          W.gore.fire(f.torsoPoint(), 20, 0.8, 2, ['#c080ff', '#8a40ff', '#ffffff']);
          W.fx.flash('#c080ff', 0.2, 0.2);
          const mel = this.moves.find((x) => x.kind === 'melee');
          if (mel) {
            this.cur = mel;
            this.t = 0;
          } else this.done(0.4);
        }
        return;
      }
      case 'tongue': {
        if (this.t < 0.05) {
          f.face(dx);
          f.setState('taunt');
          f.stunT = 1.2;
          f.pos.z += clamp(dz, -1.5, 1.5);
          const origin = () => f.headPoint().clone();
          this.w.proj.spawn({
            kind: 'tongue', owner: f, x: f.pos.x + f.facing * 0.8 * f.size, y: 1.8, z: f.pos.z, vx: f.facing * 18, dmg: 0, life: 1.4, origin,
            onHit: (t) => {
              this.pullTarget = t;
              t.hurt(0.9, 0);
              W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.7, 0)), 'THLURP!', 'word');
            },
          });
          audio.swish(0.6, true);
          return;
        }
        if (this.pullTarget) {
          const t = this.pullTarget;
          const goal = f.pos.x + f.facing * 1.6 * (f.size / 2);
          t.pos.x += (goal - t.pos.x) * Math.min(1, dt * 8);
          t.pos.z += (f.pos.z - t.pos.z) * Math.min(1, dt * 8);
          if (Math.abs(goal - t.pos.x) < 0.3 || this.t > 1.2) {
            if (t.alive) applyHit(f, t, CHOMP);
            W.gore.burst(t.torsoPoint(), 20, 4);
            this.pullTarget = null;
            f.setState('idle');
            this.done(0.8);
          }
          return;
        }
        if (this.t > 1.2) {
          f.setState('idle');
          this.done(0.6);
        }
        return;
      }
      case 'rain': {
        if (this.t < 0.05) {
          f.setState('magic');
          audio.magic();
          const n = m.count ?? 6;
          const alive = this.w.heroes.filter((h) => h.f.alive);
          for (let i = 0; i < n; i++) {
            const h = alive.length ? pick(alive).f : f;
            const x = clamp(h.pos.x + rand(-3.5, 3.5), this.w.camX - this.w.halfW + 0.5, this.w.camX + this.w.halfW - 0.5);
            this.w.proj.spawn({ kind: m.proj ?? 'meteor', owner: f, x, y: 0, z: rand(-2.4, 2.4), vx: 0, dmg: m.proj === 'lightning' ? 14 : 16, delay: 0.5 + i * 0.22, life: 4 });
          }
          return;
        }
        if (this.t > 1.2) {
          f.setState('idle');
          this.done(0.8);
        }
        return;
      }
    }
    void dt;
  }
}
