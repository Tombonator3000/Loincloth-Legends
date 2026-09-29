// Biome: Frostbite Pass. Snø, furutrær, iskrystaller, runesteiner og snøfall.
import * as THREE from 'three';
import { unitCanvas, INK } from '../draw';
import { rand, pick } from '../../core/math';
import type { Gore } from '../gore';
import { lit, M, groundTex, roadTex, stageBase, finishEnv, mountains, skullPike, rock, endGate, bossMarker, canvasTex, skullMat, type Env } from './common';
import { Forest, SPECIES, withSnow } from './trees';
import { Meadow } from './meadow';
import { fogLayers } from './atmos';
import { wind } from '../wind';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';

export function buildFrost(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  const { g, updates } = stageBase(scene, L, {
    biome: 'frost',
    sunDir: [-0.35, 0.5, -0.8],
    sky: ['#5f90cc', '#cfe4f5', '#eef6fb'], bg: '#dfeef8', fog: ['#e6f0f8', 30, 115],
    hemi: ['#f0f8ff', '#7a8aa0', 1.7], sun: ['#ffffff', 1.6],
    ground: groundTex('#e8f0f6', ['#d8e4ee', '#f6fafc', '#cad8e6'], null),
    road: roadTex('#b8c8d8', ['#a8bccc', '#c8d6e4', '#98acc0'], 'rgba(90,110,140,0.35)', ['#8a96a4', '#aab6c4']),
    clouds: '#ffffff', sunDisk: '#fffef0',
  });
  mountains(g, L, ['#8a9ab0', '#7a8aa4', '#96a6bc'], '#ffffff', -105, 14, 30);

  // Snødekt furuskog i rader, små furuer i forgrunnen
  wind.set(0.9, 1, 0.15, 0.8);
  const pines = new Forest(withSnow(SPECIES.pine), 3);
  for (let x = -6; x < L + 6; x += rand(3.5, 6.5)) pines.add(x, rand(-13, -7.5), rand(0.8, 1.25));
  for (let x = -20; x < L + 20; x += rand(3, 5.5)) pines.add(x, rand(-34, -17), rand(1.0, 1.5), undefined, false);
  // Små, snødekte busker av furu i forgrunnen (lave nok til ikke å dekke kampen)
  for (let x = 4; x < L; x += rand(14, 22)) pines.add(x, rand(5.2, 6.2), rand(0.14, 0.2));
  g.add(pines.build());
  const frostGrass = new Meadow({ bands: [[4.4, 7.5, 3], [-7, -4.4, 3]], height: [0.18, 0.4], base: '#5a6a6a', tip: '#dfe8ee', dry: '#c8d0d6', blades: 3 });
  g.add(frostGrass.mesh);
  const mist = fogLayers(g, L, '#e8f2fa', [
    { z: -8, h: 4, opacity: 0.3, drift: 1.4 },
    { z: -16, h: 8, opacity: 0.45, drift: 1 },
    { z: -33, h: 16, opacity: 0.55, drift: 0.6 },
  ]);
  updates.push((dt, _t, camX) => {
    frostGrass.update(camX);
    mist(dt);
  });
  for (let x = 12; x < L; x += rand(14, 20)) skullPike(g, gore, x, rand(-4.4, -3.6));

  // Iskrystaller
  for (let x = 0; x < L; x += rand(5, 10)) {
    const z = pick([rand(3.6, 5.4), rand(-5.5, -3.6)]);
    for (let k = 0; k < 3; k++) {
      const s = z > 0 ? rand(0.12, 0.3) : rand(0.3, 0.7);
      const cr = M(new THREE.OctahedronGeometry(s, 0), '#bfe8ff', x + rand(-0.6, 0.6), s * 0.9, z + rand(-0.3, 0.3), 0.06, undefined, '#3a6a8a');
      cr.scale.y = rand(1.4, 2.4);
      cr.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
      g.add(cr);
    }
  }

  // Frosne krigere i isblokker
  for (let x = 18; x < L; x += rand(26, 36)) {
    const z = rand(-6, -5);
    const sk = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), skullMat());
    sk.position.set(x, 1.3, z);
    g.add(sk);
    const ice = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 1.4), lit({ color: '#cfefff', transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.15 }));
    ice.position.set(x, 1.3, z);
    g.add(ice);
  }

  // Runesteiner
  const runeT = canvasTex(unitCanvas(0.8, 2.0, 0.4, 0, 90, (p) => {
    p.poly([-0.36, 0, 0.36, 0, 0.3, 1.8, 0, 1.96, -0.3, 1.8], '#7a8494');
    for (let i = 0; i < 4; i++) {
      const y = 0.4 + i * 0.35;
      p.line([-0.12, y, 0, y + 0.2, 0.12, y], 0.05, '#6fe0ff');
    }
  }), false);
  for (let x = 26; x < L; x += rand(30, 40)) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), new THREE.MeshBasicMaterial({ map: runeT, alphaTest: 0.5 }));
    s.position.set(x, 2, rand(-8, -7));
    g.add(s);
  }

  // Vakttårn
  const tw = new THREE.Group();
  tw.position.set(L * 0.35, 0, -10);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tw.add(M(new THREE.CylinderGeometry(0.14, 0.14, 6, 5), '#5a3a20', dx, 3, dz, 0.06));
  tw.add(M(new THREE.BoxGeometry(2.8, 0.3, 2.8), '#6b4526', 0, 6, 0, 0.05));
  tw.add(M(new THREE.ConeGeometry(2.2, 2, 4), '#f2f6fa', 0, 7.6, 0, 0.05));
  g.add(tw);

  for (let x = 0; x < L; x += rand(6, 12)) rock(g, x, pick([rand(4, 6), rand(-6, -3.8)]), rand(0.4, 1.0), ['#9aa6b4', '#b8c4d0']);
  for (let i = 0; i < L / 5; i++) gore.stain(rand(0, L), rand(-2.4, 2.4), rand(0.3, 0.9));

  if (o.finale === 'duel') endGate(g, gore, L - 4, o.gateTitle ?? 'THE FROZEN PIT >>>', o.gateSub ?? 'BRING A SCARF', '#8aa0b8', '#1a3a6a');
  if (o.finale === 'boss' && o.bossX !== undefined) bossMarker(g, gore, o.bossX - 3, o.bossSign ?? 'NO RETURN');

  let acc = 0;
  updates.push((dt, _t, camX) => {
    acc += dt * 60;
    while (acc > 1) {
      acc--;
      gore.ambient(camX + rand(-13, 13), rand(7, 10), rand(-8, 5), rand(-0.6, -0.1), rand(-1.5, -0.8), '#ffffff', rand(0.05, 0.11), 7, false, 0.05);
    }
  });
  void INK;
  return finishEnv(g, updates, '#e6f0f8', GRADES.frost);
}
