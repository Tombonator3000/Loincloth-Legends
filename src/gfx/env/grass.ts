// Biome: gresslette i solnedgang (The Road of Mild Peril).
import * as THREE from 'three';
import { rand, pick } from '../../core/math';
import type { Gore } from '../gore';
import {
  M, outline, toon, stoneTex, woodTex, groundTex, roadTex, stageBase, finishEnv, mountains, stakeWall, deadTree,
  skullPike, tuftMat, tufts, banner, campfire, arrows, rock, endGate, bossMarker, type Env,
} from './common';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';

export function buildGrass(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  const { g, updates } = stageBase(scene, L, {
    biome: 'grass',
    sky: ['#b8743f', '#f3c67a', '#f7d9a0'], bg: '#f0c27a', fog: ['#e9b878', 40, 130],
    hemi: ['#ffe6b8', '#6a5038', 1.6], sun: ['#fff0d0', 1.9],
    ground: groundTex('#6f7d3a', ['#7d8a42', '#5f6b30', '#8a9448', '#687536'], '#4f5a26'),
    road: roadTex('#9a7650', ['#8a6844', '#a8845a', '#7c5c3a', '#b08c62'], 'rgba(70,45,25,0.35)', ['#c7b69a', '#9d8f7c', '#b3a38a']),
    clouds: '#fff3d6', sunDisk: '#fff4c2',
  });
  mountains(g, L, ['#8a6a5a', '#7a5f55', '#94705a'], '#e9dccc');

  // Borg i det fjerne
  const castle = new THREE.Group();
  castle.position.set(L * 0.8, -2, -78);
  castle.add(M(new THREE.ConeGeometry(18, 10, 7), '#6f5a4a', 0, 5, 0, 0.02));
  for (const [x, h] of [[-5, 14], [0, 18], [5, 13], [-2, 11], [3, 12]] as const) {
    const t = M(new THREE.CylinderGeometry(1.4, 1.6, h, 8), '#3c3440', x, 8 + h / 2, rand(-2, 2), 0.03);
    t.add(M(new THREE.ConeGeometry(2, 3.5, 8), '#5b2a86', 0, h / 2 + 1.7, 0, 0.03));
    castle.add(t);
  }
  g.add(castle);

  // Startborgen vi forlater
  const st = stoneTex('#8f98a6', '#555a66', 64, 32);
  st.repeat.set(2, 3);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 14), toon('#ffffff', st));
  wall.position.set(-10, 7, -3);
  outline(wall, 0.12);
  g.add(wall);
  const tower = M(new THREE.CylinderGeometry(3.2, 3.4, 18, 10), '#8f98a6', -9, 9, -8, 0.04, st);
  tower.add(M(new THREE.ConeGeometry(4, 5, 10), '#6b3a2a', 0, 11.5, 0, 0.04));
  g.add(tower);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 5), toon('#ffffff', woodTex()));
  bridge.position.set(-5.5, 0.15, 0);
  outline(bridge, 0.06);
  g.add(bridge);

  stakeWall(g, 4, L - 8, -7.2, [[30, 38], [70, 76]]);
  for (let x = -2; x < L; x += rand(9, 16)) deadTree(g, x, rand(-12, -9), rand(0.9, 1.4));
  for (let x = 8; x < L; x += rand(7, 13)) skullPike(g, gore, x, rand(-4.4, -3.6));

  const tent = (x: number, z: number, col: string) => {
    const t = M(new THREE.ConeGeometry(2.2, 3, 6), col, x, 1.5, z, 0.06);
    t.rotation.y = rand(0, 3);
    g.add(t);
  };
  for (let x = 34; x < L - 10; x += rand(28, 40)) tent(x, rand(-10, -9), pick(['#8e2a2a', '#5b2a86']));
  const fires = [22, 52, 88].filter((x) => x < L - 6).map((x) => campfire(g, x, -5.4));
  for (let x = 16; x < L - 10; x += rand(26, 34)) banner(g, x, -6.2, '#5b2a86', '#efe8d2');

  tufts(g, L, tuftMat(['#5d6b2c', '#6f7d3a', '#4f5a26']));
  for (let x = 0; x < L; x += rand(5, 11)) rock(g, x, pick([rand(4, 6), rand(-6, -3.8)]), rand(0.4, 1.0));
  arrows(g, L);
  for (let i = 0; i < L / 5; i++) gore.splat(rand(0, L), rand(-2.4, 2.4), rand(0.3, 0.9));

  if (o.finale === 'duel') endGate(g, gore, L - 4, o.gateTitle ?? 'THE PIT  >>>', o.gateSub ?? 'NO REFUNDS. NO SURVIVORS.');
  if (o.finale === 'boss' && o.bossX !== undefined) bossMarker(g, gore, o.bossX - 3, o.bossSign ?? 'TURN BACK');

  let acc = 0;
  updates.push((dt) => {
    acc += dt;
    if (acc > 0.05) {
      acc = 0;
      for (const f of fires) gore.fire(f, 1, 0.2, 2);
    }
  });
  return finishEnv(g, updates, '#e9b878', GRADES.grass);
}
