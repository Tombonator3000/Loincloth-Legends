// Runde E (docs/PLAN_BRETT_GORR_AI.md 6.4 punkt 1): en liten regissør som styrer tempoet, etter Left 4 Dead.
// Spenningen regnes ut fra skaden heltene tar, drap nær dem og hvor lite liv den svakeste har igjen. Er den høy, får
// færre fiender angrepsplass og pausene mellom angrepene blir lengre. Er den lav, øker trykket. Etter en topp (høy
// spenning i noen sekunder) kommer et pusterom. Vanskelighetsgraden (data/difficulty.ts) legges oppå: den endrer
// reaksjonstid og aggresjon, aldri liv eller skade.
import type { DifficultyDef } from '../data/difficulty';

export type PaceMode = 'build' | 'peak' | 'relax';

/** Når spenningen regnes som en topp, hvor lenge toppen varer, og hvor lenge pusterommet etterpå varer (sekunder). */
export const TENSION = { peak: 0.85, peakTime: 4, relaxTime: 7, decay: 0.1, relaxDecay: 0.22 };

interface HeroLike {
  f: { hp: number; maxHp: number; alive: boolean };
}

export class Director {
  /** 0 er rolig, 1 og mer er travelt. */
  tension = 0;
  mode: PaceMode = 'build';
  private modeT = 0;
  private hpSeen = new Map<HeroLike, number>();

  constructor(public diff: DifficultyDef) {}

  /** Et drap nær en helt (heltens eget drap). */
  kill() {
    this.tension += 0.06;
  }

  update(dt: number, heroes: HeroLike[]) {
    let weakest = 1;
    for (const h of heroes) {
      const f = h.f;
      const before = this.hpSeen.get(h) ?? f.hp;
      // Skade tatt siden sist, som andel av livet
      if (f.alive && f.hp < before) this.tension += ((before - f.hp) / Math.max(1, f.maxHp)) * 2.5;
      this.hpSeen.set(h, f.hp);
      if (f.alive) weakest = Math.min(weakest, Math.max(0, f.hp) / f.maxHp);
    }
    // Lite liv igjen holder spenningen oppe
    if (weakest < 0.4) this.tension += (0.4 - weakest) * 0.25 * dt;
    this.tension = Math.max(0, this.tension - (this.mode === 'relax' ? TENSION.relaxDecay : TENSION.decay) * dt);
    this.tension = Math.min(this.tension, 1.5);
    this.modeT += dt;
    if (this.mode === 'build' && this.tension >= TENSION.peak) this.set('peak');
    else if (this.mode === 'peak' && this.modeT >= TENSION.peakTime) this.set('relax');
    else if (this.mode === 'relax' && this.modeT >= TENSION.relaxTime) this.set('build');
  }

  private set(m: PaceMode) {
    this.mode = m;
    this.modeT = 0;
  }

  /** Angrepsplasser nå: base er det brettet vil (2, eller 3 med to spillere). */
  tokens(base: number) {
    let n = base + this.diff.tokens;
    if (this.mode === 'relax') n -= 1;
    else if (this.mode === 'build' && this.tension < 0.2) n += 1;
    return Math.max(1, n);
  }

  /** Hvor fort nedkjølingene mellom angrepene går (1 er vanlig, under 1 er lengre pauser). */
  pace() {
    const m = this.mode === 'relax' ? 0.65 : this.mode === 'peak' ? 0.85 : this.tension < 0.2 ? 1.15 : 1;
    return m * this.diff.pace;
  }
}
