// Biome: nattleir i skogen, hyllest til leiren mellom brettene i Golden Axe. Fullmåne og stjerner, et stort bål
// midt i leiren, telt, soveposer og ildfluer. Tyvnissene kommer mens heltene sover (se game/stage.ts).
import * as THREE from 'three';
import { rand, pick } from '../../core/math';
import type { Gore } from '../gore';
import { M, groundTex, roadTex, stageBase, finishEnv, campfire, rock, skullPike, foreground, type Env } from './common';
import { Forest, SPECIES } from './trees';
import { Meadow } from './meadow';
import { wind } from '../wind';
import { fogLayers } from './atmos';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';

export function buildNight(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  const { g, updates } = stageBase(scene, L, {
    biome: 'night',
    // Månen står bak skogen, litt til venstre, så figurene får kaldt kantlys
    sunDir: [-0.35, 0.5, -0.8],
    sky: ['#03040c', '#0c1430', '#1c2a52'], bg: '#0a1024', fog: ['#0f1a36', 26, 105],
    hemi: ['#4a5a98', '#120e16', 0.85], sun: ['#a8bcff', 0.75],
    ground: groundTex('#27301c', ['#2e3a20', '#212a16', '#34401f', '#263019'], '#1c2412'),
    road: roadTex('#4a3d2c', ['#40342a', '#554634', '#3a3024', '#5a4a38'], 'rgba(20,14,8,0.4)', ['#6a6458', '#56514a', '#7a7466']),
    sunDisk: '#dfe8ff',
  });

  // Stjerner på himmelen (små HDR-punkter så de glitrer litt i bloom)
  const starGeo = new THREE.BufferGeometry();
  const sp: number[] = [];
  for (let i = 0; i < 700; i++) {
    const a = rand(-1.3, 1.3), e = rand(0.12, 1.1);
    sp.push(Math.sin(a) * Math.cos(e) * 170, Math.sin(e) * 170, -Math.cos(a) * Math.cos(e) * 170);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: new THREE.Color('#dfe6ff').multiplyScalar(1.6), size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false }));
  stars.renderOrder = -9;
  g.add(stars);
  updates.push((_dt, _t, camX) => {
    stars.position.x = camX;
  });

  // Mørk skog rundt lysningen
  wind.set(0.35, 1, 0.25, 0.4);
  const oaks = new Forest(SPECIES.oak, 3);
  for (let x = -16; x < L + 16; x += rand(5, 9)) oaks.add(x, rand(-13, -9.5), rand(0.95, 1.25));
  for (let x = -26; x < L + 26; x += rand(4, 8)) oaks.add(x, rand(-30, -18), rand(1.1, 1.5), undefined, false);
  for (let x = -6; x < L + 6; x += rand(14, 22)) oaks.add(x, rand(8.4, 9.8), rand(0.95, 1.1));
  g.add(oaks.build());
  const meadow = new Meadow({ bands: [[4.35, 9.8, 9], [-15, -4.4, 6]], height: [0.3, 0.7], base: '#1a2410', tip: '#4a5a2a', dry: '#6a6030' });
  g.add(meadow.mesh);
  const fog = fogLayers(g, L, new THREE.Color('#2a3a6a'), [
    { z: -8.8, h: 4, opacity: 0.4, drift: 0.6 },
    { z: -16, h: 8, opacity: 0.5, drift: 0.4 },
    { z: -32, h: 14, opacity: 0.6, drift: 0.3 },
  ]);

  // Leiren: stort bål i midten, telt, soveposer, våpenstativ og en gryte
  // Heltene sover rett ved det store bålet (se Stage for nattleiren)
  const mid = 4.6;
  const big = campfire(g, mid, -2.9, gore);
  gore.vfx.lights.source(new THREE.Vector3(mid, 1.4, -1.8), '#ff7a2a', 18, 13, 0.4);
  const fires = [big, campfire(g, L * 0.55, -5.6, gore), campfire(g, L - 6, -5.6, gore)];
  for (const [dx, col] of [[-5, '#7a2a2a'], [4.5, '#3a4a7a'], [-10.5, '#5b2a86'], [10, '#6a5a2a']] as const) {
    const t = M(new THREE.ConeGeometry(2.1, 2.8, 6), col, mid + dx, 1.4, rand(-7.6, -6.4), 0.06);
    t.rotation.y = rand(0, 3);
    g.add(t);
  }
  for (const dx of [-2.2, 2.4]) {
    const bag = M(new THREE.CapsuleGeometry(0.28, 1.3, 4, 8), pick(['#6a3a2a', '#3a5a3a', '#4a3a6a']), mid + dx, 0.18, -4.3 + rand(-0.4, 0.4), 0.05);
    bag.rotation.z = Math.PI / 2;
    bag.rotation.y = rand(-0.4, 0.4);
    g.add(bag);
  }
  const pot = M(new THREE.SphereGeometry(0.45, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), '#2a2a30', mid + 0.1, 0.55, -2.9, 0.05);
  pot.rotation.x = Math.PI;
  g.add(pot);
  for (let x = 4; x < L - 4; x += rand(9, 14)) skullPike(g, gore, x, rand(-4.6, -3.8));
  for (let x = 0; x < L; x += rand(4, 9)) rock(g, x, pick([rand(4, 6), rand(-6, -3.8)]), rand(0.35, 0.9));

  // Ildfluer som svever rundt i mørket
  let acc = 0, bugs = 0;
  updates.push((dt, _t, camX) => {
    meadow.update(camX);
    fog(dt);
    acc += dt;
    bugs += dt;
    if (acc > 0.05) {
      acc = 0;
      for (const f of fires) gore.fire(f, f === big ? 2 : 1, f === big ? 0.35 : 0.2, f === big ? 2.6 : 2);
    }
    if (bugs > 0.12) {
      bugs = 0;
      gore.vfx.ambient(camX + rand(-12, 12), rand(0.4, 3), rand(-6, 3), rand(-0.3, 0.3), rand(-0.1, 0.2), pick(['#d8ff6a', '#ffe36a']), 0.07, rand(2, 4), true);
    }
  });
  // Mørke, uskarpe silhuetter nederst i forgrunnen (konseptbildene)
  foreground(g, L, ['cross', 'skull', 'rock', 'spikes'], '#030408');
  return finishEnv(g, updates, '#0f1a36', GRADES.night);
}
