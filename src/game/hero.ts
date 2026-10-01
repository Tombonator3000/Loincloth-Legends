// Spillerstyrt helt på brettene: combo, hopp, løp, magi og berserk-spinn.
import * as THREE from 'three';
import { Fighter } from './fighter';
import { HERO_ATK, type AttackDef } from './attacks';
import type { Pose } from '../gfx/rig';
import { W } from './world';
import { buildHeroDef, cloneHero, withClassRules, type HeroConfig } from '../gfx/chars/hero';
import { registerChar } from '../gfx/chars';
import { scaleAttack, type WeaponStats } from '../data/weapons';
import type { PlayerInput } from '../core/input';
import { clamp } from '../core/math';
import { updateHold, AUTO_GRAB } from './grab';
import { kebabSlow } from './mayhem';
import { defaultProgress, statEffects, type HeroProgress } from '../data/progress';
import { spellAt, type SpellId } from '../data/spells';
import { classAt, heroWeapon, abilityEffects, type ClassDef } from '../data/classes';
import { attachOffhand } from '../gfx/classfx';

export const HERO_HP = 115;
/** Staven og buen holdes loddrett når helten står og går (Fighter.poseMod), ikke rett fram som et sverd. */
const GEAR_POSE: Partial<Record<string, Partial<Pose>>> = { staff: { weapon: -0.55 }, bow: { weapon: -0.6 } };
export const HERO_SPEED = 3.85;
/** Hvor mye hvert trykk korter ned et grep fra en griper (sekunder). */
export const STRUGGLE = 0.15;

export interface HeroWorld {
  frozen: boolean;
  castMagic(h: Hero): void;
  /** Alven skyter en pil langs linja midt i skuddet (data/classes.ts). */
  shoot(h: Hero, a: AttackDef): void;
  respawn(h: Hero): void;
  /** Prøv å gripe en fiende (eller et ridedyr). `auto` = helten har gått inn i den (kortere rekkevidde). */
  tryGrab(h: Hero, auto?: boolean): boolean;
  /** Står helten inntil noe som kan gripes eller et ledig ridedyr (grep uten knapp)? */
  grabContact(h: Hero): boolean;
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
  /** Hvor lenge helten har gått inn i noe som kan gripes, og pause etter et grep (se grabContact). */
  private pushT = 0;
  private grabCd = 0;
  name: string;
  cid: string;
  weapon: WeaponStats;
  /** Trylleformelen krukkene gir (data/spells.ts, game/spells.ts). */
  magic: SpellId;
  /** Klassen (data/classes.ts): våpen, magi, egenskaper og evner. */
  cls: ClassDef;
  /** Alven: skuddet pila allerede er sluppet i (Fighter.attacks). */
  private shotAt = -1;
  /** Effekter fra STR/DEF/MAG/AGI (se data/progress.ts). */
  fx: ReturnType<typeof statEffects>;
  /** Fiendene på sverdet etter løpeslaget (kebab, game/mayhem.ts). Helten går saktere med dem. */
  kebab: Fighter[] = [];

  constructor(public idx: number, public cfg: HeroConfig, public input: PlayerInput, public prog: HeroProgress = defaultProgress()) {
    // Klassens regler for våpen og magi (lagringen og smia har brukt dem allerede, men ikke alle veier inn hit)
    cfg = this.cfg = withClassRules(cloneHero(cfg));
    this.cid = registerChar(buildHeroDef(cfg, idx));
    this.name = cfg.name || 'NAMELESS';
    // Klassen og terningene (ROLL 3D6) ganges inn i effektene fra treningen, så METAL MODE og magien ser dem
    this.cls = classAt(cfg.cls);
    const fx = statEffects(prog), ab = abilityEffects(cfg.abilities), c = this.cls;
    this.fx = {
      ...fx,
      dmgMul: fx.dmgMul * c.dmg * ab.dmg, magicMul: fx.magicMul * c.magic * ab.magic, speedMul: fx.speedMul * c.speed * ab.speed,
      startPotions: fx.startPotions + c.potions, hpBonus: fx.hpBonus + Math.round(HERO_HP * (c.hp * ab.hp - 1)),
    };
    this.weapon = weaponWithStats(heroWeapon(cfg), prog);
    const spell = spellAt(cfg.magic).id;
    this.magic = c.spells.includes(spell) ? spell : c.spells[0];
    this.potions = this.fx.startPotions;
    this.f = this.makeFighter();
  }

  makeFighter() {
    const f = new Fighter(this.cid, 'hero', { hp: HERO_HP + this.fx.hpBonus, speed: HERO_SPEED * this.fx.speedMul, weapon: this.weapon, dmgMul: this.fx.dmgMul });
    f.label = this.name;
    f.player = this.idx;
    f.dmgTaken = this.fx.dmgTaken;
    dressHero(f, this.cls);
    return f;
  }

  atk(k: keyof typeof HERO_ATK) {
    // Alven skyter i stedet for å slå (løpeslaget og hoppet er som før)
    if (this.cls.ranged) k = k === 'slash1' ? 'shot1' : k === 'slash2' ? 'shot2' : k === 'chop' ? 'shot3' : k;
    return scaleAttack(HERO_ATK[k], this.weapon);
  }

  /** Ikke prøv å gripe igjen på en stund (en tøff fiende har nettopp skjøvet helten unna). */
  grabPause(t: number) {
    this.grabCd = Math.max(this.grabCd, t);
  }

  update(dt: number, st: HeroWorld) {
    const f = this.f;
    const inp = this.input;
    this.comboT -= dt;
    this.grabCd -= dt;
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

    // Holdt av en griper (runde E): hamre på angrep eller hopp for å vri seg løs fortere. Kjempen kaster uansett
    if (f.state === 'held') {
      const by = f.heldBy;
      if (by?.data.holds && (inp.consumeAttack() || inp.consumeJump())) {
        by.data.holdT = ((by.data.holdT as number) ?? 0) + STRUGGLE;
        f.flash(0.05);
        if (Math.random() < 0.3) W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), 'STRUGGLE!', 'word', 0.6);
      }
      return;
    }

    // Rir: dyret styres, angrep bruker dyrets angrep, ned + hopp = hopp av (grip-knappen virker også)
    if (f.mount) {
      const m = f.mount;
      if (inp.consumeGrab()) {
        m.dismount(false);
        this.grabCd = 0.8;
        return;
      }
      if (inp.consumeJump()) {
        if (inp.held.down) {
          m.dismount(false);
          this.grabCd = 0.8;
          return;
        }
        m.hop();
      }
      if (inp.consumeAttack() || inp.pressed.special) m.attack();
      if (ax === 0) f.running = false;
      if (inp.doubleTap.left || inp.doubleTap.right) f.running = true;
      m.drive(ax, az, f.running);
      return;
    }

    // Holder en fiende: kne, eller kast
    if (f.state === 'hold') {
      const atk = inp.consumeAttack();
      const toss = inp.consumeGrab() || inp.consumeJump();
      updateHold(f, dt, ax, az, atk, toss);
      // Litt pause før neste grep, så han ikke griper den samme igjen med en gang
      if (f.state !== 'hold') this.grabCd = 0.6;
      return;
    }

    // Alven slipper pila midt i skuddet
    if (f.state === 'attack' && f.atk?.projectile && f.atk.id.startsWith('shot') && f.phase() === 'active' && this.shotAt !== f.attacks) {
      this.shotAt = f.attacks;
      st.shoot(this, f.atk);
    }
    if (f.state === 'attack' && f.atk && /^(slash|shot)[12]/.test(f.atk.id) && f.phase() === 'recover' && inp.attackBuffer > 0) {
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
    // Grep uten knapp (Streets of Rage): gå inn i en fiende eller et ledig ridedyr et lite øyeblikk
    if (ax !== 0 && !f.running && this.grabCd <= 0 && st.grabContact(this)) {
      this.pushT += dt;
      if (this.pushT >= AUTO_GRAB.time) {
        this.pushT = 0;
        if (st.tryGrab(this, true)) return;
      }
    } else this.pushT = 0;

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
    const spd = f.speed * (f.running ? 1.8 : 1) * (this.kebab.length ? kebabSlow(this.kebab.length) : 1);
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

/**
 * Klassens kjennetegn på figuren: tyven har en dolk i hver neve, og staven og buen holdes loddrett. Med abilities
 * (brettene) stikker tyven også bakfra; duellen og tittelen får bare utseendet.
 */
export function dressHero(f: Fighter, c: ClassDef, abilities = true) {
  if (abilities) f.backstab = c.backstab ?? 1;
  f.poseMod = c.gear ? GEAR_POSE[c.gear] ?? null : null;
  if (c.gear === 'daggers') attachOffhand(f.rig);
}

/** Våpenet justert for smidighet (raskere slag). Egen id så angrepene bufres riktig. */
export function weaponWithStats(w: WeaponStats, p: HeroProgress): WeaponStats {
  if (!p.agi) return w;
  const fx = statEffects(p);
  return { ...w, id: w.id + '+agi' + p.agi, speed: w.speed * fx.attackSpeed };
}
