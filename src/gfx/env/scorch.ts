// Biome: The Scorchlands. Svart stein, lavaelv, vulkan, obsidian og gnister.
import * as THREE from 'three';
import { plainCanvas } from '../draw';
import { rand, pick } from '../../core/math';
import type { Gore } from '../gore';
import {
  M, lavaRockTex, roadTex, stageBase, finishEnv, mountains, deadTree, skullPike, rock, endGate, bossMarker, canvasTex, type Env,
} from './common';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';

export function buildScorch(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  const { g, updates } = stageBase(scene, L, {
    biome: 'scorch',
    sky: ['#1a0808', '#8a2a10', '#e0602a'], bg: '#3a1410', fog: ['#4a1a10', 30, 110],
    hemi: ['#ffb080', '#2a1010', 1.3], sun: ['#ffb070', 1.5],
    ground: lavaRockTex(),
    road: roadTex('#4a3a36', ['#3a2e2c', '#5a4844', '#2a2020'], 'rgba(255,90,20,0.25)', ['#2a2226', '#44383e']),
  });
  mountains(g, L, ['#3a1a18', '#4a2420', '#2e1614'], null, -100, 10, 20);

  // Vulkan
  const vx = L * 0.6;
  const volcano = M(new THREE.CylinderGeometry(6, 26, 30, 10, 1, true), '#2e1614', vx, 13, -80, 0.02);
  g.add(volcano);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(6, 16), new THREE.MeshBasicMaterial({ color: '#ff7a1a', fog: false }));
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(vx, 27.9, -80);
  g.add(crater);

  // Lavaelv
  const lavaT = canvasTex(plainCanvas(256, 256, (c) => {
    c.fillStyle = '#ff5a10';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = pick(['#ffb02e', '#ffd35a', '#e03a08', '#8a1a04']);
      c.beginPath();
      c.ellipse(rand(0, 256), rand(0, 256), rand(8, 30), rand(3, 8), 0, 0, Math.PI * 2);
      c.fill();
    }
  }));
  lavaT.repeat.set(L / 10, 2);
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(L + 80, 10), new THREE.MeshBasicMaterial({ map: lavaT, fog: false }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(L / 2, 0.03, -12);
  g.add(lava);
  updates.push((dt) => {
    lavaT.offset.x += dt * 0.03;
  });
  const lights: THREE.PointLight[] = [];
  for (let x = 0; x < L; x += 24) {
    const pl = new THREE.PointLight('#ff6a1a', 16, 14, 1.6);
    pl.position.set(x, 1.5, -8);
    g.add(pl);
    lights.push(pl);
  }

  // Obsidianpigger
  for (let x = -4; x < L + 4; x += rand(3, 7)) {
    const h = rand(1.5, 4.5);
    const sp = M(new THREE.ConeGeometry(rand(0.3, 0.7), h, 5), '#1a1418', x, h / 2, rand(-7, -4.8), 0.05);
    sp.rotation.z = rand(-0.3, 0.3);
    g.add(sp);
  }
  for (let x = 6; x < L; x += rand(4, 9)) {
    const h = rand(0.6, 1.6);
    const sp = M(new THREE.ConeGeometry(rand(0.2, 0.4), h, 5), '#1a1418', x, h / 2, rand(3.6, 5.6), 0.05);
    sp.rotation.z = rand(-0.4, 0.4);
    g.add(sp);
  }
  const burning: THREE.Vector3[] = [];
  for (let x = 4; x < L; x += rand(12, 18)) {
    const z = rand(-10, -8.5);
    deadTree(g, x, z, rand(0.9, 1.3), '#1e1614');
    burning.push(new THREE.Vector3(x, 4, z));
  }
  for (let x = 10; x < L; x += rand(10, 16)) skullPike(g, gore, x, rand(-4.4, -3.6));
  for (let x = 0; x < L; x += rand(7, 12)) rock(g, x, pick([rand(4, 6), rand(-6, -3.8)]), rand(0.4, 1.0), ['#2a2226', '#3a3036']);
  for (let i = 0; i < L / 5; i++) gore.splat(rand(0, L), rand(-2.4, 2.4), rand(0.3, 0.9));

  if (o.finale === 'duel') endGate(g, gore, L - 4, o.gateTitle ?? 'THE HOT PIT >>>', o.gateSub ?? 'IT IS VERY HOT', '#4a3a36', '#8a1a04');
  if (o.finale === 'boss' && o.bossX !== undefined) bossMarker(g, gore, o.bossX - 3, o.bossSign ?? 'DO NOT TOUCH');

  let acc = 0;
  updates.push((dt, t, camX) => {
    acc += dt;
    while (acc > 0.05) {
      acc -= 0.05;
      gore.ambient(camX + rand(-12, 12), rand(0, 1), rand(-8, 3), rand(-0.3, 0.3), rand(0.8, 2), pick(['#ffb02e', '#ff6a1a', '#ffd35a']), rand(0.05, 0.12), rand(1.5, 3), true);
    }
    if (Math.random() < dt * 8) gore.fire(new THREE.Vector3(vx + rand(-4, 4), 28, -80), 3, 1, 6);
    if (Math.random() < dt * 6) {
      const b = pick(burning);
      if (b && Math.abs(b.x - camX) < 16) gore.fire(b, 2, 0.8, 2);
    }
    for (let i = 0; i < lights.length; i++) lights[i].intensity = 14 + Math.sin(t * 5 + i) * 3;
  });
  return finishEnv(g, updates, '#4a1a10', GRADES.scorch);
}
