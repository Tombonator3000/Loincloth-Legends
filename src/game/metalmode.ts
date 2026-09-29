// METAL MODE: en felles måler som fylles av drap, lemlestelse og lange drapsrekker. Når den er full, spiller
// bandet en gitarsolo (core/metal.ts), heltene slår hardere, våpnene brenner og lynet slår ned i fiendene.
// Alt går på spilltid, så pause og slowmo virker.
import { W } from './world';
import { screenFX } from '../gfx/screenfx';
import { audio } from '../core/audio';
import { rand, pick } from '../core/math';
import type { Fighter } from './fighter';
import type { Projectiles } from './projectiles';

/** Det METAL MODE trenger fra brettet. */
export interface MetalWorld {
  heroes: { f: Fighter; fx: { dmgMul: number } }[];
  foeFighters(): Fighter[];
  proj: Projectiles;
  onScreen(x: number, margin: number): boolean;
  hud: { announce(text: string, cls?: string, dur?: number, sub?: string): void; metal(v: number, on: boolean): void };
}

/** Tallene for måleren og effekten. */
export const METAL = {
  /** Sekunder spilltid. */
  duration: 12,
  /** Skadeganger for heltene mens det varer. */
  dmg: 1.6,
  /** Påfyll per drap, ekstra for lemlestelse og miljødrap, og per treff. */
  kill: 0.06,
  gore: 0.04,
  env: 0.05,
  hit: 0.005,
  /** Lyn: skade og tid mellom nedslag. */
  boltDmg: 30,
  boltGap: [0.8, 1.5] as [number, number],
};

const GORY = new Set(['decap', 'explode', 'bisect', 'headsplode', 'dismember']);
const QUIPS = [
  'THE AMPLIFIERS DEMAND BLOOD',
  'HAIR: MAXIMUM',
  'THE BARD HAS PLUGGED IN',
  'YOUR LOINCLOTH IS NOW LEATHER',
  'SOLO! SOLO! SOLO!',
  'THE GODS OF STEEL APPROVE',
  'THE VOLUME KNOB HAS BEEN SNAPPED OFF',
  'SOMEWHERE, A VAN GETS AN AIRBRUSHED WIZARD',
];

export class MetalMode {
  /** 0 til 1. Tømmes mens METAL MODE varer. */
  meter = 0;
  /** Sekunder igjen av METAL MODE. */
  left = 0;
  private boltT = 0;
  private fireT = 0;

  get on() {
    return this.left > 0;
  }

  add(v: number) {
    if (this.on) return;
    this.meter = Math.min(1, this.meter + v);
  }

  /** Et drap gjort av en helt (eller heltens magi). */
  onKill(style: string, env: boolean, streak: number) {
    let v = METAL.kill;
    if (GORY.has(style)) v += METAL.gore;
    if (env) v += METAL.env;
    if (streak >= 3) v += 0.01 * Math.min(streak, 10);
    this.add(v);
  }

  update(dt: number, w: MetalWorld) {
    if (!this.on && this.meter >= 1) this.start(w);
    if (this.on) {
      this.left -= dt;
      this.meter = Math.max(0, this.left / METAL.duration);
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = rand(METAL.boltGap[0], METAL.boltGap[1]);
        this.bolt(w);
      }
      // Brennende våpen
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 0.05;
        for (const h of w.heroes) if (h.f.alive) W.gore.fire(h.f.rig.weaponTip(), 1, 0.08, 1.4);
      }
      if (this.left <= 0) this.stop();
    }
    // Settes hver frame, så en ny kropp etter gjenoppstandelse også får det
    for (const h of w.heroes) h.f.dmgMul = h.fx.dmgMul * (this.on ? METAL.dmg : 1);
    // Skjermkanten brenner så lenge det varer (gfx/screenfx.ts)
    screenFX.burnGoal = this.on ? 1 : 0;
    w.hud.metal(this.meter, this.on);
  }

  private start(w: MetalWorld) {
    this.left = METAL.duration;
    this.boltT = 0.5;
    audio.metalMode(true);
    w.hud.announce('METAL MODE!', 'metal', 2.2, pick(QUIPS));
    W.fx.flash('#ff7a1a', 0.35, 0.3);
    W.fx.shake(0.7);
    if (W.post) W.post.aberration = Math.max(W.post.aberration, 0.6);
    // Sjokkbølge ut fra heltene, en mild negativ ramme og et kameradykk
    for (const h of w.heroes) if (h.f.alive) screenFX.shock(h.f.torsoPoint(), 1.6, 0.9, 1.2);
    screenFX.negative(0.06);
    screenFX.dive(0.1, 0.7);
  }

  /** Lynet slår ned i en tilfeldig fiende på skjermen (varslet med en ring på bakken). */
  private bolt(w: MetalWorld) {
    const heroes = w.heroes.filter((h) => h.f.alive);
    const foes = w.foeFighters().filter((f) => f.alive && w.onScreen(f.pos.x, -0.5));
    if (!heroes.length || !foes.length) return;
    const t = pick(foes);
    w.proj.spawn({ kind: 'lightning', owner: pick(heroes).f, x: t.pos.x, y: 0, z: t.pos.z, vx: 0, dmg: METAL.boltDmg, delay: 0.35, life: 2 });
  }

  stop() {
    if (this.left > 0 || this.meter >= 1) this.meter = 0;
    this.left = 0;
    screenFX.burnGoal = 0;
    audio.metalMode(false);
  }
}
