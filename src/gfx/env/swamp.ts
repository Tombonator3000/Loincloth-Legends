// Biome: Swamp of Moist Regret. Tåke, råtne trær, siv, lysende sopp og ildfluer.
import * as THREE from 'three';
import { plainCanvas } from '../draw';
import { rand, pick } from '../../core/math';
import type { Gore } from '../gore';
import {
  M, toon, groundTex, roadTex, texFile, stageBase, finishEnv, mountains, skullPike, rock, endGate,
  bossMarker, canvasTex, foreground, gen, type Env,
} from './common';
import { Forest, SPECIES } from './trees';
import { Meadow } from './meadow';
import { fogLayers } from './atmos';
import { wind } from '../wind';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';

export function buildSwamp(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  const { g, updates } = stageBase(scene, L, {
    biome: 'swamp',
    sunDir: [-0.35, 0.65, -0.6],
    sky: ['#3d4a32', '#8f9e7a', '#aab694'], bg: '#8a9a78', fog: ['#8a9a78', 16, 85],
    hemi: ['#d8e6c0', '#3a3a28', 1.45], sun: ['#e8f0d0', 1.2],
    ground: texFile('ground_swamp', () => groundTex('#4a4a2a', ['#56562e', '#3e3e22', '#5a5230'], '#2e3a1a')),
    road: texFile('road_swamp', () => roadTex('#5e4c32', ['#4a3a24', '#6a5838', '#3a2c1c'], 'rgba(30,20,10,0.4)', ['#6a6a5a', '#5a5a4a']), { fringe: true }),
    clouds: '#b8c0a8',
    // Tungt, disig skydekke (fargen kommer fra tåka og graderingen)
    atmosphere: { sun: [-0.35, 0.4, -0.6], turbidity: 16, rayleigh: 0.5, mie: 0.02, mieG: 0.7, clouds: 0.85, cloudDensity: 0.75, gain: 0.45 },
  });
  mountains(g, L, ['#5a6a4a', '#4a5a3e', '#56664a'], null, -90, 6, 12);

  // Sumpvann bak veien
  if (gen(o, 'water')) {
  const waterT = canvasTex(plainCanvas(256, 256, (c) => {
    c.fillStyle = '#2e4a3a';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(160,200,160,0.25)';
    c.lineWidth = 3;
    for (let i = 0; i < 40; i++) {
      const x = rand(0, 256), y = rand(0, 256);
      c.beginPath();
      c.ellipse(x, y, rand(6, 20), rand(2, 5), 0, 0, Math.PI * 2);
      c.stroke();
    }
  }));
  waterT.repeat.set(L / 8, 4);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(L + 80, 40), new THREE.MeshBasicMaterial({ map: waterT }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(L / 2, 0.02, -25);
  g.add(water);
  updates.push((dt) => {
    waterT.offset.x += dt * 0.01;
  });
  for (let i = 0; i < L / 2; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(rand(0.3, 0.6), 10, 0.3, Math.PI * 1.8), toon('#5a8a3a'));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(rand(-10, L + 10), 0.04, rand(-18, -6.5));
    g.add(pad);
  }
  }

  // Knudrete sumptrær med hengende mose, noen står i vannet
  wind.set(0.45, 1, 0.2, 0.4);
  if (gen(o, 'forest')) {
    const trees = new Forest(SPECIES.swamp, 3);
    for (let x = -6; x < L + 6; x += rand(5, 9)) trees.add(x, rand(-11, -6.8), rand(0.9, 1.3));
    for (let x = -20; x < L + 20; x += rand(4, 8)) trees.add(x, rand(-30, -15), rand(1.1, 1.6), undefined, false);
    g.add(trees.build());
  }
  // Siv langs vannkanten og i forgrunnen
  if (gen(o, 'meadow')) {
    const reeds = new Meadow({ bands: [[4.35, 8.6, 5], [-7.2, -4.4, 9]], height: [0.6, 1.4], base: '#2e3a1a', tip: '#8a8a44', dry: '#a08a4a', blades: 3, width: 0.06, bend: 0.6 });
    g.add(reeds.mesh);
    updates.push((_dt, _t, camX) => reeds.update(camX));
  }
  if (gen(o, 'fog')) {
    const mist = fogLayers(g, L, '#b8c8a0', [
      { z: -5.2, h: 2.2, opacity: 0.4, drift: 1.2 },
      { z: -12, h: 5, opacity: 0.5, drift: 0.8 },
      { z: -26, h: 10, opacity: 0.6, drift: 0.5 },
    ]);
    updates.push((dt) => mist(dt));
  }
  if (gen(o, 'skullPikes')) for (let x = 10; x < L; x += rand(12, 20)) skullPike(g, gore, x, rand(-4.4, -3.6));

  // Lysende sopp
  const glowSpots: THREE.Vector3[] = [];
  if (gen(o, 'mushrooms')) for (let x = 2; x < L; x += rand(6, 12)) {
    const z = pick([rand(3.4, 5), rand(-4.8, -3.4)]);
    for (let k = 0; k < 3; k++) {
      const s = rand(0.5, 1);
      const stem = M(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.4 * s, 6), '#e8e0c8', x + k * 0.3, 0.2 * s, z + rand(-0.2, 0.2), 0.08);
      stem.add(M(new THREE.SphereGeometry(0.22 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#3affc0', 0, 0.18 * s, 0, 0.06, undefined, '#1a8a60'));
      g.add(stem);
    }
    glowSpots.push(new THREE.Vector3(x, 0.8, z));
  }

  // Heksehytte på påler
  if (gen(o, 'hut')) {
  const hutX = L * 0.45;
  const hut = new THREE.Group();
  hut.position.set(hutX, 0, -12);
  for (const [dx, dz] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) hut.add(M(new THREE.CylinderGeometry(0.12, 0.12, 3, 5), '#3a2a1a', dx, 1.5, dz, 0.06));
  hut.add(M(new THREE.BoxGeometry(3.6, 2.4, 2.8), '#5a4430', 0, 4.2, 0, 0.05));
  hut.add(M(new THREE.ConeGeometry(2.8, 2.2, 4), '#3a4a2a', 0, 6.5, 0, 0.05));
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), new THREE.MeshBasicMaterial({ color: '#ffe060' }));
  win.position.set(0.6, 4.3, 1.42);
  hut.add(win);
  g.add(hut);
  }

  // Ruiner
  if (gen(o, 'ruins')) for (let x = 20; x < L; x += rand(24, 34)) {
    const h = rand(1.5, 4);
    const col = M(new THREE.CylinderGeometry(0.5, 0.55, h, 8), '#7a7a6a', x, h / 2, rand(-8, -6), 0.05);
    col.rotation.z = rand(-0.2, 0.2);
    g.add(col);
  }

  if (gen(o, 'rocks')) for (let x = 0; x < L; x += rand(8, 14)) rock(g, x, pick([rand(4, 6), rand(-6, -3.8)]), rand(0.4, 0.9), ['#5a5a4a', '#4a4a3e']);
  if (gen(o, 'stains')) for (let i = 0; i < L / 5; i++) gore.stain(rand(0, L), rand(-2.4, 2.4), rand(0.3, 0.9), pick(['red', 'green'] as const));

  if (o.finale === 'duel') endGate(g, gore, L - 4, o.gateTitle ?? 'THE MUD PIT >>>', o.gateSub ?? 'WIPE YOUR FEET', '#6a6a58', '#3a4a2a');
  if (o.finale === 'boss' && o.bossX !== undefined) bossMarker(g, gore, o.bossX - 3, o.bossSign ?? 'ROYAL POND');

  let acc = 0;
  updates.push((dt, t, camX) => {
    acc += dt;
    while (acc > 0.08) {
      acc -= 0.08;
      gore.ambient(camX + rand(-11, 11), rand(0.4, 3.5), rand(-3.5, 3), rand(-0.3, 0.3), rand(-0.1, 0.3), pick(['#d8ff6a', '#aaff40']), rand(0.08, 0.14), rand(1.5, 3), true);
    }
    if (Math.random() < dt * 3) {
      const s = pick(glowSpots);
      if (s) gore.ambient(s.x + rand(-0.4, 0.4), s.y, s.z, 0, 0.4, '#3affc0', 0.2, 1, true);
    }
    void t;
  });
  // Mørke, uskarpe silhuetter nederst i forgrunnen (konseptbildene)
  if (gen(o, 'silhouettes')) foreground(g, L, ['skull', 'rock', 'bones', 'cross'], '#06080a');
  return finishEnv(g, updates, '#8a9a78', GRADES.swamp);
}
