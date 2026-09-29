// Spillerstyrt helt på brettene: combo, hopp, løp, magi og berserk-spinn.
import * as THREE from 'three';
import { Fighter } from './fighter';
import { HERO_ATK } from './attacks';
import { W } from './world';
import { buildHeroDef, type HeroConfig } from '../gfx/chars/hero';
import { registerChar } from '../gfx/chars';
import { WEAPONS, scaleAttack, type WeaponStats } from '../data/weapons';
import type { PlayerInput } from '../core/input';
import { clamp } from '../core/math';
import { updateHold } from './grab';
import { defaultProgress, statEffects, type HeroProgress } from '../data/progress';

export const HERO_HP = 115;
export const HERO_SPEED = 3.85;

export interface HeroWorld {
  frozen: boolean;
  castMagic(h: Hero): void;
  respawn(h: Hero): void;
  /** Prøv å gripe en fiende (eller et ridedyr). Returnerer true hvis noe skjedde. */
  tryGrab(h: Hero): boolean;
}

export class Hero {
  f: Fighter;
  lives = 3;
  potions = 0;
  gold = 0;
  kills = 0;
  comboStep = 0;
  comboT = 0;
  respawnT = 0;
  name: string;
  cid: string;
  weapon: WeaponStats;
  magic: 'meteor' | 'scream' | 'thunder';
  /** Effekter fra STR/DEF/MAG/AGI (se data/progress.ts). */
  fx: ReturnType<typeof statEffects>;

  constructor(public idx: number, public cfg: HeroConfig, public input: PlayerInput, public prog: HeroProgress = defaultProgress()) {
    this.cid = registerChar(buildHeroDef(cfg, idx));
    this.name = cfg.name || 'NAMELESS';
    this.fx = statEffects(prog);
    this.weapon = weaponWithStats(WEAPONS[cfg.weapon] ?? WEAPONS[0], prog);
    this.magic = cfg.magic === 1 ? 'scream' : cfg.magic === 2 ? 'thunder' : 'meteor';
    this.potions = this.fx.startPotions;
    this.f = this.makeFighter();
  }

  makeFighter() {
    const f = new Fighter(this.cid, 'hero', { hp: HERO_HP + this.fx.hpBonus, speed: HERO_SPEED * this.fx.speedMul, weapon: this.weapon, dmgMul: this.fx.dmgMul });
    f.label = this.name;
    f.player = this.idx;
    f.dmgTaken = this.fx.dmgTaken;
    return f;
  }

  atk(k: keyof typeof HERO_ATK) {
    return scaleAttack(HERO_ATK[k], this.weapon);
  }

  update(dt: number, st: HeroWorld) {
    const f = this.f;
    const inp = this.input;
    this.comboT -= dt;
    if (!f.alive) {
      f.wantVX = f.wantVZ = 0;
      if (this.lives > 0) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) st.respawn(this);
      }
      return;
    }
    if (st.frozen && f.state !== 'magic') {
      f.wantVX = f.wantVZ = 0;
      return;
    }
    const ax = inp.axisX();
    const az = inp.axisY();

    // Rir: dyret styres, angrep bruker dyrets angrep, grip = hopp av
    if (f.mount) {
      const m = f.mount;
      if (inp.consumeGrab()) {
        m.dismount(false);
        return;
      }
      if (inp.consumeAttack() || inp.pressed.special) m.attack();
      if (inp.consumeJump()) m.hop();
      if (ax === 0) f.running = false;
      if (inp.doubleTap.left || inp.doubleTap.right) f.running = true;
      m.drive(ax, az, f.running);
      return;
    }

    // Holder en fiende: kne, eller kast
    if (f.state === 'hold') {
      const atk = inp.consumeAttack();
      const toss = inp.consumeGrab() || inp.consumeJump();
      updateHold(f, dt, ax, atk, toss);
      return;
    }

    if (f.state === 'attack' && f.atk && (f.atk.id.startsWith('slash1') || f.atk.id.startsWith('slash2')) && f.phase() === 'recover' && inp.attackBuffer > 0) {
      inp.consumeAttack();
      if (ax) f.face(ax);
      this.comboStep++;
      f.startAttack(this.comboStep === 1 ? this.atk('slash2') : this.atk('chop'));
      this.comboT = 0.5;
      return;
    }
    if (!f.onGround && (f.state === 'jump' || (f.state === 'attack' && f.atk?.air))) {
      f.vel.x += ax * dt * 6;
      f.vel.x = clamp(f.vel.x, -f.speed * 1.2, f.speed * 1.2);
      if (f.state === 'jump' && !f.airAttackUsed && inp.consumeAttack()) {
        f.airAttackUsed = true;
        if (ax) f.face(ax);
        f.startAttack(this.atk('jump'));
      }
      return;
    }
    if (!f.canAct()) return;

    if (inp.consumeGrab() && st.tryGrab(this)) return;

    if (inp.pressed.special) {
      if (this.potions > 0) st.castMagic(this);
      else if (f.hp > 8) {
        f.startAttack(this.atk('spin'));
        W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.6, 0)), 'BERSERK!', 'word');
      }
      return;
    }
    if (ax === 0) f.running = false;
    if (inp.doubleTap.left || inp.doubleTap.right) f.running = true;
    const spd = f.speed * (f.running ? 1.8 : 1);
    if (inp.consumeJump()) {
      f.jump(ax * spd, az * spd * 0.6);
      return;
    }
    if (inp.consumeAttack()) {
      if (ax) f.face(ax);
      if (f.running) {
        f.startAttack(this.atk('dash'));
        f.running = false;
        return;
      }
      this.comboStep = this.comboT > 0 && this.comboStep < 2 ? this.comboStep + 1 : 0;
      f.startAttack(this.comboStep === 0 ? this.atk('slash1') : this.comboStep === 1 ? this.atk('slash2') : this.atk('chop'));
      this.comboT = 0.55;
      return;
    }
    const len = Math.hypot(ax, az) || 1;
    f.wantVX = (ax / len) * spd;
    f.wantVZ = (az / len) * spd * 0.72;
    f.face(ax);
  }
}

/** Våpenet justert for smidighet (raskere slag). Egen id så angrepene bufres riktig. */
export function weaponWithStats(w: WeaponStats, p: HeroProgress): WeaponStats {
  if (!p.agi) return w;
  const fx = statEffects(p);
  return { ...w, id: w.id + '+agi' + p.agi, speed: w.speed * fx.attackSpeed };
}
