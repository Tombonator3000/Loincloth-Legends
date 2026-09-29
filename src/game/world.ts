// Delte referanser for aktivt spill (scene, gore, effekter, kamera, statistikk).
import type * as THREE from 'three';
import type { Gore } from '../gfx/gore';
import type { FX } from '../gfx/fx';
import type { Env } from '../gfx/env';
import type { PostFX } from '../gfx/post';

export interface Stats {
  kills: number;
  heads: number;
  gibs: number;
  gold: number;
  bestStreak: number;
  gnomeCrimes: number;
  limbs: number;
  xp: number;
}

export const W = {
  scene: null as unknown as THREE.Scene,
  gore: null as unknown as Gore,
  fx: null as unknown as FX,
  camera: null as unknown as THREE.PerspectiveCamera,
  env: null as Env | null,
  /** Bildepipelinen (bloom, gradering, aberrasjon ved store treff). Null før spillet er startet. */
  post: null as PostFX | null,
  time: 0,
  /** Gamepad-risting for en spiller (settes av Game). */
  rumble: (_player: number, _strong: number, _weak: number, _ms: number) => {},
  stats: { kills: 0, heads: 0, gibs: 0, gold: 0, bestStreak: 0, gnomeCrimes: 0, limbs: 0, xp: 0 } as Stats,
  resetStats() {
    this.stats = { kills: 0, heads: 0, gibs: 0, gold: 0, bestStreak: 0, gnomeCrimes: 0, limbs: 0, xp: 0 };
  },
};
