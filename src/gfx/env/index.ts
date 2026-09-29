// Register over miljøbyggere. Et nytt biom = en ny fil her + en linje i STAGE_BUILDERS.
import type * as THREE from 'three';
import type { Gore } from '../gore';
import type { Env } from './common';
import { buildGrass } from './grass';
import { buildSwamp } from './swamp';
import { buildFrost } from './frost';
import { buildScorch } from './scorch';
import { buildTower } from './tower';

export interface StageEnvOpts {
  length: number;
  finale: 'boss' | 'duel' | 'gate';
  gateTitle?: string;
  gateSub?: string;
  bossX?: number;
  bossSign?: string;
}
export type StageBuilder = (scene: THREE.Scene, gore: Gore, o: StageEnvOpts) => Env;

export const STAGE_BUILDERS: Record<string, StageBuilder> = {
  grass: buildGrass,
  swamp: buildSwamp,
  frost: buildFrost,
  scorch: buildScorch,
  tower: buildTower,
};

export { buildArena, type ArenaTheme } from './arena';
export { toon, outline, M, canvasTex, type Env } from './common';
