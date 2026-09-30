// Register over miljøbyggere. Et nytt biom = en ny fil her + en linje i STAGE_BUILDERS.
import type * as THREE from 'three';
import type { Gore } from '../gore';
import type { Env } from './common';
import type { Hole } from '../../data/hazards';
import { buildGrass } from './grass';
import { buildSwamp } from './swamp';
import { buildFrost } from './frost';
import { buildScorch } from './scorch';
import { buildTower } from './tower';
import { buildNight } from './night';

export interface StageEnvOpts {
  length: number;
  finale: 'boss' | 'duel' | 'gate' | 'dawn';
  gateTitle?: string;
  gateSub?: string;
  bossX?: number;
  bossSign?: string;
  /** Hull i bakken og veien (juvet langs bakkanten, data/hazards.ts). Miljøet lar dem stå åpne og holder rekvisitter unna. */
  holes?: Hole[];
  /** Frøet for pynten (brettfila, ellers brettets id). Brukes av gen() i common.ts. */
  seed?: number;
  /** Generatorer brettfila har slått av (false). Se gen() i common.ts. */
  gen?: Record<string, boolean>;
}
export type StageBuilder = (scene: THREE.Scene, gore: Gore, o: StageEnvOpts) => Env;

export const STAGE_BUILDERS: Record<string, StageBuilder> = {
  grass: buildGrass,
  swamp: buildSwamp,
  frost: buildFrost,
  scorch: buildScorch,
  tower: buildTower,
  night: buildNight,
};

export { buildArena, type ArenaTheme } from './arena';
export { toon, M, canvasTex, type Env } from './common';
