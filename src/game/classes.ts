// Klassene på brettet (data/classes.ts): prestens helbredelse, tyvens tyveri, og terningene: et tungt slag rulles på
// en d20, og 20 gir NATURAL 20 (dobbel skade) mens 1 gir CRITICAL FUMBLE (helten går på trynet). Spillederen sukker.
// Alvens piler skytes av Stage.shoot, METAL-måleren til barden ganges i MetalMode.gain.
import * as THREE from 'three';
import { W } from './world';
import type { Hero } from './hero';
import type { Fighter } from './fighter';
import { audio } from '../core/audio';
import { pick, chance, rand } from '../core/math';
import { GM_LINES } from '../data/classes';

/**
 * Tallene: skaden ganges med critMul på en naturlig tjuer, en tabbe koster fumbleDmg liv, spillederen sier noe om
 * en tjuer så ofte (tabbene kommenterer han alltid), presten helbreder dem innen healR, og tyven tar stealGold.
 */
export const DICE = { critMul: 2, fumbleDmg: 4, gmOdds: 0.5, healR: 4.5, stealGold: 10 };

export interface ClassWorld {
  readonly heroes: Hero[];
  readonly hud: { say(speaker: string, text: string, dur?: number, voice?: boolean): void };
}

export class ClassPlay {
  /** Neste kast blir dette (testene). */
  force: number | null = null;
  /** Det siste kastet, og hvor mange kast som er gjort (testene). */
  last = 0;
  rolls = 0;
  private rolled = new Map<Hero, number>();
  /** Liv presten har gitt hver helt siden sist det ble vist (+HP over hodet hvert sekund). */
  private healed = new Map<Hero, { hp: number; t: number }>();

  constructor(private w: ClassWorld) {}

  update(dt: number) {
    for (const h of this.w.heroes) {
      const f = h.f;
      if (!f.alive) continue;
      // Terningen rulles én gang når et tungt slag begynner
      if (f.state === 'attack' && f.atk?.heavy && this.rolled.get(h) !== f.attacks) {
        this.rolled.set(h, f.attacks);
        this.roll(h);
      }
      if (f.state !== 'attack') f.critMul = 1;
      if (h.cls.heal) this.heal(h, dt);
    }
  }

  private roll(h: Hero) {
    const f = h.f;
    const d = this.force ?? 1 + Math.floor(Math.random() * 20);
    this.force = null;
    this.last = d;
    this.rolls++;
    if (d === 20) {
      f.critMul = DICE.critMul;
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.1, 0)), 'NATURAL 20!', 'kill big', 1.3);
      W.gore.flare(f.headPoint().add(new THREE.Vector3(0, 0.6, 0)), 1.2, '#ffd35a', 0.3);
      audio.sparkle();
      audio.coin();
      if (chance(DICE.gmOdds)) this.w.hud.say('GAME MASTER', pick(GM_LINES.nat20), 2.2);
    } else if (d === 1) {
      // Slaget går i bakken, og helten etter
      f.atk = null;
      f.hp = Math.max(1, f.hp - DICE.fumbleDmg);
      f.knockdown(-f.facing * 1.4, 4);
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.1, 0)), 'CRITICAL FUMBLE!', 'kill big', 1.4);
      audio.slip();
      this.w.hud.say('GAME MASTER', pick(GM_LINES.fumble), 2.4);
    }
  }

  /** Presten: de andre heltene som står nær, får litt liv hele tiden (co-op), med glimt av gull. */
  private heal(h: Hero, dt: number) {
    for (const o of this.w.heroes) {
      const f = o.f;
      if (o === h || !f.alive || f.hp >= f.maxHp) continue;
      if (Math.hypot(f.pos.x - h.f.pos.x, f.pos.z - h.f.pos.z) > DICE.healR) continue;
      const add = Math.min(f.maxHp - f.hp, (h.cls.heal ?? 0) * dt);
      f.hp += add;
      if (chance(dt * 10)) W.gore.ambient(f.pos.x + rand(-0.4, 0.4), f.pos.y + rand(0.3, 1.8) * f.size, f.pos.z, 0, rand(0.6, 1.2), '#fff0b0', 0.12, 0.9, true);
      const n = this.healed.get(o) ?? { hp: 0, t: 0 };
      n.hp += add;
      n.t += dt;
      if (n.t >= 1 && n.hp >= 1) {
        W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.7, 0)), '+' + Math.round(n.hp) + ' HP', 'good', 0.8);
        n.hp = n.t = 0;
      }
      this.healed.set(o, n);
    }
  }

  /** Et treff fra en helt (Stage): tyven stjeler en mynt. */
  onHit(h: Hero, t: Fighter, blocked: boolean) {
    if (!h.cls.steal || blocked || t.team === 'hero' || !chance(h.cls.steal)) return;
    h.gold += DICE.stealGold;
    W.stats.gold += DICE.stealGold;
    audio.coin();
    W.gore.sparks(t.torsoPoint(), 3, '#ffd35a', 3);
    W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.6, 0)), 'YOINK! +' + DICE.stealGold, 'good', 0.9);
  }
}
