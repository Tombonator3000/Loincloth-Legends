// Magien heltene kaster med de blå krukkene. Navn, tittel og beskrivelse står i registeret (data/spells.ts); her er
// det trylleformlene gjør på brettet. Stage eier Spells (stage.spells), kaller begin() når en helt kaster og update()
// hvert bilde. Olja som blir liggende og hønene som løper rundt, lever videre etter at selve kastet er over.
import * as THREE from 'three';
import { W } from './world';
import { Fighter } from './fighter';
import { HERO_ATK, type AttackDef } from './attacks';
import { applyHit } from './combat';
import type { Hero } from './hero';
import type { Foe } from './foes';
import type { Projectiles } from './projectiles';
import { audio } from '../core/audio';
import { screenFX } from '../gfx/screenfx';
import { rand, pick, chance, clamp } from '../core/math';
import { spellById, type SpellId } from '../data/spells';
import { SPELL_LINES as L } from '../data/quips';
import { oilPuddle, dartMesh, Feathers, Beams, type OilPuddle } from '../gfx/spellfx';

/**
 * Tallene. Skaden er (base + perLevel x krukker) x MAG fra treningen, og sjefen tar boss av den. Tider i sekunder,
 * avstander i meter.
 */
export const SPELL = {
  /** Helten lader så lenge før trylleformelen slår løs. */
  charge: 0.7,
  dmg: { base: 18, perLevel: 14, boss: 0.6 },
  /** Pilene: fart, hvor skarpt de svinger (fra og til), hvor langt forbi den som bommer flyr, levetid og treffradius. */
  missile: { speed: 13, turn: [3, 10] as const, overshoot: 2.6, life: 5, hitR: 0.55, max: 14 },
  /** Liv til heltene (pluss per krukke), og hvor lenge de levende er blendet (pluss per krukke). */
  turn: { heal: 12, healPer: 5, blind: 2.4, blindPer: 0.3, end: 1.8 },
  /**
   * Olja: levetid (pluss per krukke), radius, avstand mellom pyttene, høyst så mange, hvor lenge den brenner, hvor lenge
   * fiender og helter brenner etter å ha stått i den, og hvor ofte en fiende kan skli.
   */
  grease: { life: 12, lifePer: 1.5, r: [1.15, 1.5] as const, gap: 2.5, max: 16, burn: 5, burnFoe: 3.5, burnHero: 1.5, slipCd: 1.6, slipOdds: 0.85 },
  /** Hønene: sekunder som høne (pluss per krukke), fart, og sjansen for en stekt kylling når en sprenges. */
  chicken: { time: 10, timePer: 2, speed: 4.2, drop: 0.35 },
};

const BASE = HERO_ATK.chop;
export const METEOR_ATK: AttackDef = { ...BASE, id: 'magic', kd: true, launch: 8, push: 6, death: ['explode'], heavy: true, word: ['KABOOM!'] };
export const SCREAM_ATK: AttackDef = { ...BASE, id: 'scream', kd: true, launch: 6, push: 8, death: ['headsplode'], heavy: true, word: ['AAAAAH!'] };
export const THUNDER_ATK: AttackDef = { ...BASE, id: 'thunder', kd: true, launch: 5, push: 3, death: ['explode', 'headsplode'], heavy: true, word: ['KRAKOOM!', 'ZZZAP!'] };
export const MISSILE_ATK: AttackDef = { ...BASE, id: 'missile', kd: false, launch: 2, push: 3, death: ['explode', 'headsplode', 'dismember'], heavy: false, word: ['ZING!'] };
export const TURN_ATK: AttackDef = { ...BASE, id: 'turn', kd: false, launch: 0, push: 1, death: ['normal'], heavy: true, word: ['BEGONE!'] };

/** Det trylleformlene trenger fra brettet (Stage). */
export interface SpellWorld {
  readonly heroes: Hero[];
  readonly foes: Foe[];
  readonly boss: { f: Fighter } | null;
  readonly embers: { x: number; z: number; t: number }[];
  readonly proj: Projectiles;
  readonly metal: { readonly on: boolean };
  readonly hud: { announce(text: string, cls?: string, dur?: number, sub?: string): void };
  frozen: boolean;
  camX: number;
  halfW: number;
  onScreen(x: number, margin: number): boolean;
  ignite(f: Fighter, sek: number): void;
}

/** Et nedslag (meteor, lyn), eller en tur i køen (de udøde og hønene, utover fra helten). */
interface Strike { x: number; z: number; t: number; hit: boolean; f: Fighter }
interface Dart {
  mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; tgt: Fighter | null; t: number; delay: number;
  /** Den ene som bommer (side = hvilken vei den bommer), og når den bommet. */
  miss: boolean; missed: number; side: number; dmg: number; done: boolean;
}
interface Spot { x: number; z: number; r: number; t: number; made: boolean }

/** Et kast som pågår. t teller fra kastet (med ladingen). */
export interface Cast {
  hero: Hero;
  id: SpellId;
  level: number;
  t: number;
  dmg: number;
  targets: Fighter[];
  strikes: Strike[];
  /** Skriket: de som er truffet. */
  hit: Set<number>;
  darts: Dart[];
  spots: Spot[];
  started: boolean;
}

/** En oljepytt: brenner (burnT), er svidd (burnt), eller tar fyr om litt (igniteIn) fordi naboen brenner. */
interface Oil { x: number; z: number; r: number; t: number; life: number; puddle: OilPuddle; burnT: number; burnt: boolean; igniteIn: number; fireT: number }

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const UP = (y: number) => new THREE.Vector3(0, y, 0);

export class Spells {
  cast: Cast | null = null;
  readonly oil: Oil[] = [];
  readonly feathers = new Feathers();
  readonly beams = new Beams();
  /** Tellere, så de samme ordene ikke står over hver eneste fiende. */
  private said = { crumble: 0, blind: 0, bawk: 0, slips: 0, fireCd: 0 };

  constructor(private w: SpellWorld) {
    W.scene.add(this.feathers.group, this.beams.group);
  }

  /** Helten kaster med alle krukkene sine: tida stopper for alle andre mens han lader. */
  begin(h: Hero) {
    const f = h.f, w = this.w;
    const level = h.potions;
    h.potions = 0;
    f.setState('magic');
    f.vel.set(0, 0, 0);
    w.frozen = true;
    const targets = w.foes.filter((x) => x.f.alive && !x.f.hidden && w.onScreen(x.f.pos.x, 0.5)).map((x) => x.f);
    if (w.boss?.f.alive && w.onScreen(w.boss.f.pos.x, 1)) targets.push(w.boss.f);
    this.cast = {
      hero: h, id: h.magic, level, t: 0, dmg: (SPELL.dmg.base + SPELL.dmg.perLevel * level) * h.fx.magicMul,
      targets, strikes: [], hit: new Set(), darts: [], spots: [], started: false,
    };
    this.said.crumble = this.said.blind = this.said.bawk = 0;
    w.hud.announce(spellById(h.magic).title, 'magic', 1.8, 'LEVEL ' + level);
    audio.magic();
    W.fx.flash('#1a0030', 0.55, 1.2);
  }

  update(dt: number) {
    const c = this.cast;
    if (c) {
      c.t += dt;
      if (c.t < SPELL.charge) this.charge(c);
      else if (this.run(c, dt)) this.end();
    }
    this.said.fireCd -= dt;
    this.updateOil(dt);
    this.feathers.update(dt);
    this.beams.update(dt);
  }

  private end() {
    const c = this.cast!;
    for (const d of c.darts) if (!d.done) this.dropDart(d);
    if (c.hero.f.alive) c.hero.f.setState('idle');
    this.cast = null;
    this.w.frozen = false;
  }

  private dmgFor(c: Cast, t: Fighter) {
    return this.w.boss && t === this.w.boss.f ? c.dmg * SPELL.dmg.boss : c.dmg;
  }

  /** Ladingen: hver trylleformel har sin glød rundt hendene eller hodet. */
  private charge(c: Cast) {
    const hf = c.hero.f;
    switch (c.id) {
      case 'thunder':
        W.gore.sparks(hf.rig.weaponTip(), 2, '#bfe8ff', 4);
        break;
      case 'missile': {
        const p = hf.rig.weaponTip();
        W.gore.sparks(p, 1, '#d070ff', 3);
        W.gore.flare(p, 0.5, '#d070ff', 0.1);
        break;
      }
      case 'turn': {
        const p = hf.headPoint();
        W.gore.ambient(p.x + rand(-0.7, 0.7), p.y - rand(0, 1.4), p.z, 0, rand(0.8, 1.6), '#ffe9a0', 0.14, 0.8, true);
        W.gore.flare(p.add(UP(0.5)), 0.6, '#ffe9a0', 0.1);
        break;
      }
      case 'grease': {
        const p = hf.rig.weaponTip();
        W.gore.ambient(p.x + rand(-0.2, 0.2), p.y, p.z, rand(-0.3, 0.3), 0, '#1a140c', 0.12, 0.8, false, 6);
        break;
      }
      case 'chicken': {
        const p = hf.rig.weaponTip();
        if (chance(0.3)) this.feathers.burst(p, 1, 1.2, 0.7);
        W.gore.flare(p, 0.4, '#fff2c0', 0.1);
        break;
      }
      default:
        W.gore.fire(hf.headPoint().add(UP(0.6)), 2, 0.3, 3);
    }
  }

  /** Etter ladingen, hvert bilde. Svarer true når trylleformelen er ferdig. */
  private run(c: Cast, dt: number): boolean {
    const run: Record<SpellId, (c: Cast, dt: number) => boolean> = {
      meteor: (c, dt) => this.meteor(c, dt),
      scream: (c, dt) => this.scream(c, dt),
      thunder: (c, dt) => this.thunder(c, dt),
      missile: (c, dt) => this.missile(c, dt),
      turn: (c, dt) => this.turn(c, dt),
      grease: (c, dt) => this.grease(c, dt),
      chicken: (c, dt) => this.polymorph(c, dt),
    };
    return run[c.id](c, dt);
  }

  // ---------------------------------------------------------------- METEOR OF EXCESSIVE FORCE
  /** Én meteor per fiende i bildet, litt etter hverandre. Uten fiender faller én foran helten. */
  private meteor(c: Cast, dt: number) {
    const hf = c.hero.f;
    if (!c.strikes.length) {
      c.targets.forEach((f, i) => c.strikes.push({ x: f.pos.x, z: f.pos.z, t: -i * 0.12, hit: false, f }));
      if (!c.targets.length) c.strikes.push({ x: hf.pos.x + hf.facing * 4, z: hf.pos.z, t: 0, hit: false, f: hf });
    }
    let allDone = true;
    for (const mt of c.strikes) {
      mt.t += dt;
      if (mt.t < 0) {
        allDone = false;
        continue;
      }
      const k = Math.min(1, mt.t / 0.4);
      const pos = new THREE.Vector3(mt.x - 4 * (1 - k), 12 * (1 - k) + 0.8, mt.z);
      if (mt.hit) continue;
      allDone = false;
      W.gore.fire(pos, 3, 0.35, 0.5);
      W.gore.flare(pos, 1.2, '#ffb02e', 0.05);
      if (k < 1) continue;
      mt.hit = true;
      W.gore.flare(pos, 3, '#ffd35a', 0.4);
      W.gore.fire(pos, 30, 1.2, 5);
      audio.boom(1);
      W.fx.shake(0.7);
      screenFX.boom(pos, 1.2);
      screenFX.addHeat(pos.clone().setY(0.2), 1.8, 1, false, 2);
      if (mt.f !== hf && mt.f.alive) applyHit(hf, mt.f, METEOR_ATK, this.dmgFor(c, mt.f));
      // Meteoren tenner olje den treffer
      this.fireAt(mt.x, mt.z, 1.4);
    }
    return allDone && c.t > 1.2;
  }

  // ---------------------------------------------------------------- SCREAM OF THE ANCESTORS
  /** En ring av lys og en sjokkbølge ut fra helten som treffer alle den når fram til. */
  private scream(c: Cast, dt: number) {
    const hf = c.hero.f;
    const r = (c.t - SPELL.charge) * 16;
    if (c.t < 1.4) {
      for (let i = 0; i < 12; i++) {
        const a = rand(0, Math.PI * 2);
        W.gore.flare(new THREE.Vector3(hf.pos.x + Math.cos(a) * r, 1 + Math.sin(a) * r * 0.25, hf.pos.z), 0.6, '#9fd8ff', 0.2);
      }
      if (c.t - dt < SPELL.charge) {
        audio.scream('heroine');
        audio.boom(0.7);
        W.fx.shake(0.6);
        // Skriket sender en stor, langsom sjokkbølge ut fra helten
        screenFX.shock(hf.headPoint(), 1.8, 1.1, 1.0);
        screenFX.dive(0.08);
      }
    }
    for (const f of c.targets) {
      if (c.hit.has(f.id) || !f.alive) continue;
      if (Math.abs(f.pos.x - hf.pos.x) < r) {
        c.hit.add(f.id);
        applyHit(hf, f, SCREAM_ATK, this.dmgFor(c, f));
      }
    }
    return c.t > 1.8;
  }

  // ---------------------------------------------------------------- WRATH OF THE THUNDER GOD
  /**
   * Lynet slår først ned i heltens våpen, så i hver fiende etter tur. Flere krukker gir flere og kraftigere lyn, og fra
   * nivå 3 slår det ned rundt omkring også (maginivåene i Golden Axe).
   */
  private thunder(c: Cast, dt: number) {
    const hf = c.hero.f;
    const sky = (x: number, z: number) => new THREE.Vector3(x + rand(-2, 2), 15, z - 3);
    if (!c.strikes.length) {
      c.targets.forEach((f, i) => c.strikes.push({ x: f.pos.x, z: f.pos.z, t: -0.25 - i * 0.14, hit: false, f }));
      for (let i = 0; i < Math.max(0, c.level - 2) * 2; i++) c.strikes.push({ x: hf.pos.x + rand(-8, 8), z: rand(-2.4, 2.4), t: -rand(0.2, 1.1), hit: false, f: hf });
      W.gore.vfx.lightning(sky(hf.pos.x, hf.pos.z), hf.rig.weaponTip(), '#cfe8ff', 0.3);
      audio.thunder(0.8);
      W.fx.lightningFlash(0.4, 0.2);
    }
    let allDone = true;
    for (const mt of c.strikes) {
      if (mt.hit) continue;
      allDone = false;
      mt.t += dt;
      if (mt.t < 0) continue;
      mt.hit = true;
      const onFoe = mt.f !== hf && mt.f.alive;
      const x = onFoe ? mt.f.pos.x : mt.x, z = onFoe ? mt.f.pos.z : mt.z;
      W.gore.vfx.lightning(sky(x, z), new THREE.Vector3(x, 0.05, z), c.level >= 5 ? '#e6d0ff' : '#9fd8ff', 0.2 + c.level * 0.03);
      audio.thunder(0.5 + c.level * 0.08);
      W.fx.shake(0.35 + c.level * 0.06);
      W.fx.lightningFlash(0.15 + c.level * 0.02, 0.12);
      if (onFoe) applyHit(hf, mt.f, THUNDER_ATK, this.dmgFor(c, mt.f));
      // Lynet tenner olje der det slår ned
      this.fireAt(x, z, 0.8);
    }
    return allDone && c.t > 1.4;
  }

  // ---------------------------------------------------------------- MAGIC MISSILE OF ABSOLUTE CERTAINTY
  /**
   * En lysende pil per fiende (to per fiende fra fire krukker), skutt opp i en vifte fra hendene. De styrer mot målet,
   * skarpere og skarpere. Én av dem bommer: den flyr over skulderen og et godt stykke forbi (MISS!), snur og treffer
   * likevel. Uten fiender flyr tre piler framover og slukner.
   */
  private missile(c: Cast, dt: number) {
    const hf = c.hero.f, S = SPELL.missile;
    if (!c.started) {
      c.started = true;
      const tip = hf.rig.weaponTip();
      const live = c.targets.filter((t) => t.alive);
      const per = c.level >= 4 && live.length * 2 <= S.max ? 2 : 1;
      const list: (Fighter | null)[] = live.length ? live.flatMap((t) => Array<Fighter>(per).fill(t)) : [null, null, null];
      const missIdx = live.length ? Math.floor(Math.random() * Math.min(list.length, S.max)) : -1;
      list.slice(0, S.max).forEach((t, i) => {
        const m = dartMesh();
        m.visible = false;
        W.scene.add(m);
        c.darts.push({
          mesh: m, pos: tip.clone().add(new THREE.Vector3(rand(-0.15, 0.15), rand(-0.1, 0.2), rand(-0.1, 0.1))),
          vel: new THREE.Vector3(hf.facing * rand(0.5, 3) + rand(-1, 1), rand(4.5, 8), rand(-2, 2)),
          tgt: t, t: 0, delay: i * 0.07, miss: i === missIdx, missed: -1, side: 0, dmg: t ? this.dmgFor(c, t) / per : 0, done: false,
        });
      });
    }
    let flying = false;
    for (const d of c.darts) {
      if (d.done) continue;
      flying = true;
      d.t += dt;
      if (d.t < d.delay) continue;
      if (!d.mesh.visible) {
        d.mesh.visible = true;
        audio.swish(1.7);
        audio.sparkle();
      }
      const lt = d.t - d.delay;
      // Målet er allerede dødt: ta en annen, ellers slukner pila etter hvert
      if (d.tgt && !d.tgt.alive) {
        d.tgt = c.targets.find((t) => t.alive) ?? null;
        d.miss = false;
      }
      let aim: THREE.Vector3;
      if (d.tgt) {
        aim = d.tgt.torsoPoint(0.5, tmpA);
        if (d.miss && d.missed < 0) {
          // Sikter over skulderen og et godt stykke forbi, og har den passert, har den bommet
          d.side ||= Math.sign(d.tgt.pos.x - hf.pos.x) || hf.facing;
          aim.x += d.side * S.overshoot;
          aim.y += 0.9;
          if (d.pos.distanceTo(aim) < 0.7 || d.side * (d.pos.x - d.tgt.pos.x) > S.overshoot * 0.85) {
            d.missed = lt;
            W.fx.text(d.tgt.headPoint().add(UP(0.9)), pick(L.miss), 'word', 1.0);
          }
        }
      } else aim = tmpA.set(hf.pos.x + hf.facing * 9, 1.2, hf.pos.z);
      // Den som bommet, tar en vid sving tilbake før den låser seg på målet
      const k = d.missed >= 0 && lt - d.missed < 0.35 ? 2.2 : S.turn[0] + (S.turn[1] - S.turn[0]) * Math.min(1, lt / 1.2);
      tmpB.copy(aim).sub(d.pos).normalize().multiplyScalar(S.speed);
      d.vel.lerp(tmpB, 1 - Math.exp(-k * dt));
      d.pos.addScaledVector(d.vel, dt);
      d.mesh.position.copy(d.pos);
      d.mesh.rotation.z = Math.atan2(d.vel.y, d.vel.x);
      W.gore.ambient(d.pos.x, d.pos.y, d.pos.z, 0, 0, '#c060ff', 0.2, 0.4, true, 0);
      if (d.tgt && (!d.miss || d.missed >= 0) && d.pos.distanceTo(d.tgt.torsoPoint(0.5, tmpC)) < S.hitR) this.dartHit(c, d);
      else if (lt > S.life || (!d.tgt && lt > 1.1)) this.fizzle(d);
    }
    return !flying && c.t > SPELL.charge + 0.5;
  }

  private dartHit(c: Cast, d: Dart) {
    const t = d.tgt!;
    applyHit(c.hero.f, t, MISSILE_ATK, d.dmg);
    W.gore.flare(d.pos, 0.9, '#e0a0ff', 0.18);
    W.gore.sparks(d.pos, 6, '#e8b0ff', 5);
    if (d.miss) W.fx.text(t.headPoint().add(UP(1.2)), pick(L.certain), 'kill big', 1.4);
    this.dropDart(d);
  }

  private fizzle(d: Dart) {
    W.gore.flare(d.pos, 0.5, '#c060ff', 0.15);
    this.dropDart(d);
  }

  private dropDart(d: Dart) {
    d.done = true;
    d.mesh.removeFromParent();
  }

  // ---------------------------------------------------------------- TURN UNDEAD (AND EVERYONE ELSE)
  /**
   * En lysstråle fra himmelen ned på helten, og lyset går utover. De udøde (FoeDef.undead) smuldrer: skjelettene faller
   * fra hverandre, zombiene synker i en støvsky. De levende blir blendet og holder seg for øynene en stund, sjefen tar
   * litt skade, og heltene får litt liv.
   */
  private turn(c: Cast, dt: number) {
    const hf = c.hero.f, S = SPELL.turn;
    if (!c.started) {
      c.started = true;
      const p = hf.pos;
      this.beams.add(new THREE.Vector3(p.x, 0, p.z - 0.2), 3.2, 18, '#ffe9a0', 1.6);
      W.gore.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 9, '#ffe9a0', 0.6);
      W.fx.flash('#fff6d8', 0.75, 0.7);
      screenFX.shock(hf.torsoPoint(), 1.4, 1.0, 1.1);
      audio.gong();
      audio.sparkle();
      // Utover fra helten, de nærmeste først
      [...c.targets].sort((a, b) => Math.abs(a.pos.x - hf.pos.x) - Math.abs(b.pos.x - hf.pos.x))
        .forEach((t) => c.strikes.push({ x: t.pos.x, z: t.pos.z, t: -0.12 - Math.abs(t.pos.x - hf.pos.x) * 0.045, hit: false, f: t }));
      for (const h of this.w.heroes) {
        const f = h.f;
        if (!f.alive) continue;
        const add = Math.max(0, Math.min(f.maxHp - f.hp, S.heal + S.healPer * c.level));
        f.hp += add;
        W.fx.text(f.headPoint().add(UP(0.9)), add >= 1 ? '+' + Math.round(add) + ' ' + pick(L.healed) : pick(L.healed), 'good', 1.4);
        for (let k = 0; k < 14; k++) W.gore.ambient(f.pos.x + rand(-0.6, 0.6), rand(0.2, 2), f.pos.z, 0, rand(0.8, 1.8), '#fff0b0', 0.12, 1.1, true);
      }
    }
    for (const s of c.strikes) {
      if (s.hit) continue;
      s.t += dt;
      if (s.t < 0) continue;
      s.hit = true;
      this.turnOne(c, s.f);
    }
    return c.strikes.every((s) => s.hit) && c.t > SPELL.charge + S.end;
  }

  private turnOne(c: Cast, t: Fighter) {
    if (!t.alive || t.rising || t.hidden) return;
    const S = SPELL.turn, w = this.w;
    const foe = w.foes.find((o) => o.f === t);
    if (foe?.def.undead && !foe.chicken) {
      this.beams.add(new THREE.Vector3(t.pos.x, 0, t.pos.z - 0.1), 1.3, 12, '#fff3c0', 1.0);
      if (this.said.crumble++ < 1) W.fx.text(t.headPoint().add(UP(0.8)), pick(L.crumble), 'speech', 1.4);
      // Akkurat nok til å ta ham (mye mer gir av og til en eksplosjon i applyHit, og de skal smuldre)
      applyHit(c.hero.f, t, TURN_ATK, (t.hp + 1) / Math.max(0.1, t.dmgTaken));
      // Skjelettene faller fra hverandre av seg selv (og spiller xylofon). Zombiene synker ned i en støvsky
      if (t.def.blood !== 'bone') {
        t.sinkRate = 0.35;
        t.sinkDepth = 1.4;
        for (let i = 0; i < 3; i++) W.gore.dust(t.pos, 6, '#8a8670');
      }
      W.gore.dust(t.pos, 8, '#e8e0c8');
      return;
    }
    if (w.boss && t === w.boss.f) {
      applyHit(c.hero.f, t, TURN_ATK, c.dmg * SPELL.dmg.boss * 0.5);
      W.fx.text(t.headPoint().add(UP(1.0)), pick(L.blind), 'speech', 1.4);
      return;
    }
    // Blendet: hendene for øynene en stund
    if (t.state === 'held' || t.state === 'hold' || t.mount || t.skewer || !t.onGround) return;
    t.setState('stunned');
    t.stunT = S.blind + S.blindPer * c.level;
    t.blindT = t.stunT;
    t.atk = null;
    t.vel.set(0, 0, 0);
    W.gore.flare(t.headPoint(), 0.8, '#fff6d0', 0.25);
    if (this.said.blind++ < 2) W.fx.text(t.headPoint().add(UP(0.8)), pick(L.blind), 'speech', 1.4);
  }

  // ---------------------------------------------------------------- GREASE OF THE OILY ONE
  /**
   * Olje faller fra himmelen i tunge klatter og blir til pytter over hele veien i bildet, og under hver fiende. Fiender
   * som går eller løper i olja, sklir og går på trynet. Får olja fyr (noe som brenner, glør, ildkuler, meteorer, lyn,
   * en ildimp som smeller, eller et brennende våpen i METAL MODE), brenner den, og brannen sprer seg til pyttene den
   * henger sammen med.
   */
  private grease(c: Cast, dt: number) {
    const S = SPELL.grease, w = this.w, hf = c.hero.f;
    if (!c.started) {
      c.started = true;
      const spots: Spot[] = [];
      const add = (x: number, z: number) => {
        if (spots.length >= S.max || spots.some((s) => Math.hypot(s.x - x, (s.z - z) * 1.33) < 1.1)) return;
        spots.push({ x, z, r: rand(S.r[0], S.r[1]) + 0.06 * c.level, t: 0, made: false });
      };
      for (const t of c.targets) if (!(w.boss && t === w.boss.f)) add(t.pos.x, clamp(t.pos.z, -2.3, 2.3));
      const x0 = w.camX - w.halfW + 1.2, x1 = w.camX + w.halfW - 1.2;
      for (let x = x0, row = 0; x <= x1; x += S.gap, row++) for (const z of [-1.3, 1.1]) add(x + rand(-0.5, 0.5) + (row % 2) * 0.6, z + rand(-0.35, 0.35));
      spots.sort((a, b) => Math.abs(a.x - hf.pos.x) - Math.abs(b.x - hf.pos.x));
      spots.forEach((s, i) => (s.t = -0.05 - i * 0.045));
      c.spots = spots;
    }
    for (const s of c.spots) {
      if (s.made) continue;
      s.t += dt;
      // Klatten faller
      if (s.t > -0.4 && s.t < 0 && chance(0.6)) W.gore.ambient(s.x + rand(-0.3, 0.3), 1 - s.t * 16, s.z, 0, -16, '#120c06', 0.2, 0.2, false, 4);
      if (s.t < 0) continue;
      s.made = true;
      this.addOil(s.x, s.z, s.r, S.life + S.lifePer * c.level);
    }
    return c.spots.every((s) => s.made) && c.t > SPELL.charge + 0.7;
  }

  /** En oljepytt på bakken. Svarer pytten. */
  addOil(x: number, z: number, r: number, life: number = SPELL.grease.life) {
    const p = oilPuddle(r, Math.floor(Math.random() * 3));
    p.mesh.position.x = x;
    p.mesh.position.z = z;
    p.mesh.scale.setScalar(0.01);
    W.scene.add(p.mesh);
    const o: Oil = { x, z, r, t: 0, life, puddle: p, burnT: 0, burnt: false, igniteIn: -1, fireT: 0 };
    this.oil.push(o);
    audio.splat(0.6);
    for (let i = 0; i < 4; i++) W.gore.ambient(x + rand(-0.5, 0.5), 0.1, z, rand(-1.5, 1.5), rand(1.5, 3), '#1a140c', 0.08, 0.5, false, 9);
    return o;
  }

  private inOil(o: Oil, x: number, z: number, pad = 0) {
    const r = o.r + pad;
    const ex = (x - o.x) / r, ez = (z - o.z) / (r * 0.75);
    return ex * ex + ez * ez <= 1;
  }

  /** Ild ved (x, z) med radius r: olja der tar fyr (meteorer, lyn, ildimper som smeller). */
  fireAt(x: number, z: number, r: number) {
    for (const o of this.oil) if (o.burnT <= 0 && !o.burnt && o.t > 0.2 && this.inOil(o, x, z, r)) this.igniteOil(o);
  }

  private igniteOil(o: Oil) {
    o.burnT = SPELL.grease.burn + rand(0, 1);
    o.igniteIn = -1;
    o.puddle.burn(1);
    const p = new THREE.Vector3(o.x, 0.3, o.z);
    W.gore.fire(p, 24, o.r * 0.6, 3.2);
    W.gore.flare(p, 1.6, '#ff8a2a', 0.4);
    screenFX.addHeat(p.clone().setY(0.2), o.r * 1.2, 1, false, o.burnT);
    audio.fireBreath(0.6);
    if (this.said.fireCd <= 0) {
      this.said.fireCd = 4;
      W.fx.text(p.clone().add(UP(1.4)), pick(L.fire), 'kill big', 1.3);
    }
    // Brannen sprer seg til pyttene den henger sammen med
    for (const q of this.oil) {
      if (q === o || q.burnT > 0 || q.burnt || q.igniteIn >= 0) continue;
      if (Math.hypot(q.x - o.x, (q.z - o.z) / 0.75) < (q.r + o.r) * 0.95) q.igniteIn = rand(0.15, 0.3);
    }
  }

  private fighters() {
    const list = [...this.w.heroes.map((h) => h.f), ...this.w.foes.map((o) => o.f)];
    if (this.w.boss) list.push(this.w.boss.f);
    return list;
  }

  private updateOil(dt: number) {
    if (!this.oil.length) return;
    const fighters = this.fighters();
    for (const o of this.oil) {
      o.t += dt;
      const g = Math.min(1, o.t / 0.35), ease = 1 - (1 - g) ** 3;
      o.puddle.mesh.scale.set(o.r * ease, 1, o.r * 0.75 * ease);
      if (o.burnT > 0) this.burnOil(o, dt, fighters);
      else if (!o.burnt) {
        if (o.igniteIn >= 0) {
          o.igniteIn -= dt;
          if (o.igniteIn <= 0) this.igniteOil(o);
        } else if (g >= 1) {
          this.catchFire(o, fighters);
          if (o.burnT <= 0) this.slipIn(o);
        }
      }
      const left = o.life - o.t, fade = o.burnt ? 3 : 1.5;
      if (left < fade) o.puddle.fade(Math.max(0, left / fade));
    }
    for (const o of this.oil.filter((x) => x.t >= x.life)) {
      o.puddle.dispose();
      this.oil.splice(this.oil.indexOf(o), 1);
    }
  }

  /** Noe som brenner, kommer borti olja. */
  private catchFire(o: Oil, fighters: Fighter[]) {
    const w = this.w;
    for (const f of fighters) {
      if (f.alive && f.onGround && (f.burnT > 0 || f.def.blood === 'lava') && this.inOil(o, f.pos.x, f.pos.z)) return this.igniteOil(o);
    }
    for (const e of w.embers) if (this.inOil(o, e.x, e.z)) return this.igniteOil(o);
    for (const p of w.proj.list) {
      if (!p.alive || p.delay > 0 || (p.kind !== 'fireball' && p.kind !== 'meteor' && p.kind !== 'lightning')) continue;
      if (p.pos.y < 1.3 && this.inOil(o, p.pos.x, p.pos.z, 0.3)) return this.igniteOil(o);
    }
    // Det brennende våpenet i METAL MODE
    if (w.metal.on) {
      for (const h of w.heroes) if (h.f.alive && h.f.state === 'attack' && this.inOil(o, h.f.pos.x, h.f.pos.z, 0.8)) return this.igniteOil(o);
    }
  }

  private burnOil(o: Oil, dt: number, fighters: Fighter[]) {
    const S = SPELL.grease;
    o.burnT -= dt;
    // Flammene dør ut det siste sekundet
    const k = Math.min(1, o.burnT / 1.2);
    o.puddle.burn(Math.max(0, k));
    const rate = o.r * o.r * 26 * k * dt;
    const n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * o.r * 0.9;
      W.gore.fire(tmpA.set(o.x + Math.cos(a) * rr, 0.15, o.z + Math.sin(a) * rr * 0.75), 1, 0.15, 2.4 * (0.6 + 0.4 * k));
    }
    o.fireT -= dt;
    if (o.fireT <= 0) {
      o.fireT = 0.3;
      W.gore.flare(tmpA.set(o.x, 0.6, o.z), 1.3 * Math.max(0.3, k), '#ff7a2a', 0.35);
    }
    for (const f of fighters) {
      if (f.alive && f.onGround && !f.hidden && this.inOil(o, f.pos.x, f.pos.z, 0.15)) this.w.ignite(f, f.team === 'hero' ? S.burnHero : S.burnFoe);
    }
    if (o.burnT <= 0) {
      o.burnt = true;
      o.puddle.scorch();
      o.life = o.t + 4;
    }
  }

  /** Fiender som går eller løper i olja, sklir og går på trynet. Heltene står støtt (de er den oljete sin). */
  private slipIn(o: Oil) {
    const S = SPELL.grease;
    for (const fo of this.w.foes) {
      const f = fo.f;
      if (!f.alive || !f.onGround || f.skewer || f.mount || f.hidden || f.rising || (f.state !== 'walk' && f.state !== 'flee')) continue;
      if (Math.hypot(f.vel.x, f.vel.z) < 0.5 || ((f.data.oilSlipT as number) ?? -1) > W.time) continue;
      if (!this.inOil(o, f.pos.x, f.pos.z)) continue;
      f.data.oilSlipT = W.time + S.slipCd;
      if (!chance(S.slipOdds)) continue;
      const dir = Math.sign(f.vel.x) || f.facing;
      f.knockdown(dir * 2.6, 5);
      audio.slip();
      if (f.size > 1.5) W.fx.shake(0.35);
      W.fx.text(f.headPoint().add(UP(0.8)), this.said.slips++ ? pick(L.slip) : L.slip[0], 'word', 0.9);
    }
  }

  // ---------------------------------------------------------------- POLYMORPH: CHICKEN
  /**
   * Fiendene i bildet blir høner, én etter én utover fra helten, i en røyksky med fjær. Hønene løper i panikk (Foe),
   * ett slag og de sprenges i fjær (chickenPopped), og når tida er ute, blir de seg selv igjen. Sjefen står imot.
   */
  private polymorph(c: Cast, dt: number) {
    const S = SPELL.chicken, w = this.w, hf = c.hero.f;
    if (!c.started) {
      c.started = true;
      [...c.targets].sort((a, b) => Math.abs(a.pos.x - hf.pos.x) - Math.abs(b.pos.x - hf.pos.x))
        .forEach((t, i) => c.strikes.push({ x: t.pos.x, z: t.pos.z, t: -0.1 - i * 0.08, hit: false, f: t }));
    }
    for (const s of c.strikes) {
      if (s.hit) continue;
      s.t += dt;
      if (s.t < 0) continue;
      s.hit = true;
      const t = s.f;
      if (!t.alive) continue;
      if (w.boss && t === w.boss.f) {
        this.saved(t);
        continue;
      }
      const foe = w.foes.find((o) => o.f === t);
      if (!foe || foe.chicken || t.state === 'held' || t.state === 'hold' || t.holding || t.mount || t.skewer || t.hidden || t.rising) continue;
      // Like stor som den han var: kjempetrollet blir en kjempehøne
      const hen = new Fighter('chicken', 'enemy', { hp: 1, speed: S.speed * rand(0.9, 1.1), scale: clamp(t.size, 0.7, 3) * rand(0.94, 1.06) });
      foe.polymorph(hen, S.time + S.timePer * c.level);
      const p = hen.torsoPoint();
      for (let i = 0; i < 7; i++) W.gore.vfx.puff(p.x, p.y, p.z, 0.9, 0.9, '#f4f0e6', 0.4, 1.5, 0.8);
      W.gore.flare(p, 1.1, '#fff2c0', 0.2);
      this.feathers.burst(p, 8, 2.5, hen.size);
      audio.whump();
      audio.cluck();
      if (this.said.bawk++ < 3) W.fx.text(hen.headPoint().add(UP(0.6)), pick(L.bawk), 'speech', 1.3);
    }
    return c.strikes.every((s) => s.hit) && c.t > SPELL.charge + 0.9;
  }

  /** Sjefen står imot: et pust av fjær, og ordene over hodet. */
  private saved(b: Fighter) {
    const p = b.torsoPoint();
    for (let i = 0; i < 5; i++) W.gore.vfx.puff(p.x, p.y, p.z, 1.0, 0.9, '#f4f0e6', 0.5, 1.8, 0.8);
    this.feathers.burst(p, 10, 3, 1.4);
    audio.cluck();
    W.fx.text(b.headPoint().add(UP(1.3)), L.saved, 'kill big', 2.4);
  }

  /** Høna er truffet (Stage.foeDied): den sprenges i en sky av fjær. */
  chickenPopped(foe: Foe) {
    const f = foe.f, p = f.torsoPoint();
    foe.chicken = null;
    this.feathers.burst(p, 28, 4.5, f.size / 0.8);
    for (let i = 0; i < 3; i++) W.gore.vfx.puff(p.x, p.y, p.z, 0.6, 0.6, '#f4f0e6', 0.3, 1.1, 0.7);
    audio.cluck();
    W.fx.text(p.clone().add(UP(1.0)), pick(L.pop), 'word', 1.0);
  }

  dispose() {
    if (this.cast) for (const d of this.cast.darts) if (!d.done) this.dropDart(d);
    this.cast = null;
    for (const o of this.oil) o.puddle.dispose();
    this.oil.length = 0;
    this.feathers.clear();
    this.beams.clear();
    this.feathers.group.removeFromParent();
    this.beams.group.removeFromParent();
  }
}
