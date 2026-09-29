// Biome: Frostbite Pass i blåtimen (konseptbilde 4). Klippevegger med snø bak veien, fossefall med dis, en taubro
// over et skar, ruiner på klippene, runesteiner, fyrfat med ild langs veien, fillete krigsbannere med hornet
// hodeskalle, istapper, taugjerde foran, frosne krigere i is og tett snøfall med vindkast.
import * as THREE from 'three';
import { rand, pick } from '../../core/math';
import type { Gore } from '../gore';
import { lit, M, groundTex, roadTex, texFile, stageBase, finishEnv, mountains, skullPike, rock, endGate, bossMarker, skull3D, foreground, type Env } from './common';
import { Forest, SPECIES, withSnow } from './trees';
import { Meadow } from './meadow';
import { fogLayers } from './atmos';
import { wind } from '../wind';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';
import { brazier, warBanner, runeStone, cliff, waterfall, ropeBridge, icicles, ropeFence, ruins } from './props';

export function buildFrost(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  const { g, updates } = stageBase(scene, L, {
    biome: 'frost',
    // Himmellyset kommer høyt og litt bakfra: korte, myke skygger. Faklene står for det varme lyset.
    sunDir: [0.25, 0.9, -0.4],
    sky: ['#0e1a36', '#34507e', '#8aa2c4'], bg: '#34496a', fog: ['#56708f', 24, 92],
    hemi: ['#9ab6e0', '#1c2536', 1.3], sun: ['#b8ccf0', 1.0],
    ground: texFile('ground_frost', () => groundTex('#e8f0f6', ['#d8e4ee', '#f6fafc', '#cad8e6'], null)),
    road: texFile('road_frost', () => roadTex('#b8c8d8', ['#a8bccc', '#c8d6e4', '#98acc0'], 'rgba(90,110,140,0.35)', ['#8a96a4', '#aab6c4']), { fringe: true }),
    clouds: '#aabbd6',
    // Sola har akkurat gått ned bak fjellene: dypblå himmel med et varmt bånd lavt over horisonten
    atmosphere: { sun: [0.3, -0.03, -0.95], turbidity: 3.4, rayleigh: 3.0, mie: 0.005, mieG: 0.84, clouds: 0.5, cloudDensity: 0.5, gain: 0.36 },
  });
  // Støvet som virvles opp, er snøføyke, og heltene sparker opp snø når de går
  gore.dustColor = '#e4ecf6';
  gore.stepDust = 1;
  mountains(g, L, ['#46566e', '#3c4a62', '#52627c'], '#d8e2f0', -105, 16, 34);

  // Klippevegger bak veien, med glipper der skogen og fjellene synes
  const cliffs: { x: number; z: number; w: number; d: number; top: number }[] = [];
  for (let x = -22; x < L + 24;) {
    const w = rand(9, 15), h = rand(8, 14), d = rand(5, 8), z = rand(-17.5, -14);
    cliffs.push({ x: x + w / 2, z, w, d, top: cliff(g, x + w / 2, z, w, h, d) });
    x += w * rand(0.8, 1.05) + (Math.random() < 0.3 ? rand(6, 9) : 0);
  }
  // Fossefall ned hver tredje klippe
  cliffs.forEach((c, i) => {
    if (i % 3 !== 1) return;
    waterfall(g, gore, updates, c.x + rand(-0.2, 0.2) * c.w, c.z + c.d * 0.5 + 0.5, c.top * 0.9, rand(1.6, 2.6));
  });
  // Ruiner på et par av klippene, taubro over den bredeste glippa nær midten av brettet
  cliffs.forEach((c, i) => {
    if (i % 4 === 2) ruins(g, c.x + rand(-2, 2), c.top - 0.3, c.z + 0.5, rand(0.9, 1.25));
    icicles(g, c.x - c.w * 0.3, c.x + c.w * 0.3, c.top - 0.5, c.z + c.d * 0.5 + 0.2, 1.5, 1.4);
  });
  let gap: [typeof cliffs[number], typeof cliffs[number]] | null = null;
  for (let i = 0; i + 1 < cliffs.length; i++) {
    const a = cliffs[i], b = cliffs[i + 1];
    const span = b.x - b.w * 0.35 - (a.x + a.w * 0.35);
    if (span > 4 && span < 16 && (!gap || Math.abs(a.x - L * 0.45) < Math.abs(gap[0].x - L * 0.45))) gap = [a, b];
  }
  if (gap) {
    const [a, b] = gap;
    ropeBridge(g, a.x + a.w * 0.3, b.x - b.w * 0.3, Math.min(a.top, b.top) - 0.4, (a.z + b.z) / 2, 1.3);
  }

  // Snødekt furuskog i glippene og bak klippene, og småfuruer foran
  wind.set(0.95, 1, 0.15, 0.85);
  const pines = new Forest(withSnow(SPECIES.pine), 3);
  for (let x = -6; x < L + 6; x += rand(8, 16)) pines.add(x, rand(-11.5, -8), rand(0.75, 1.15));
  for (let x = -20; x < L + 20; x += rand(3, 5.5)) pines.add(x, rand(-34, -20), rand(1.0, 1.5), undefined, false);
  // Småfuruer helt fremme: så nær kameraet at bare toppene stikker opp nederst i bildet
  for (let x = 4; x < L; x += rand(16, 24)) pines.add(x, rand(6.6, 7.2), rand(0.14, 0.2));
  g.add(pines.build());
  const frostGrass = new Meadow({ bands: [[4.4, 7.5, 3], [-7, -4.4, 3]], height: [0.18, 0.4], base: '#4a5a62', tip: '#d4e0ea', dry: '#b8c4ce', blades: 3 });
  g.add(frostGrass.mesh);
  const mist = fogLayers(g, L, '#8aa2c2', [
    { z: -7, h: 3, opacity: 0.28, drift: 1.4 },
    { z: -12, h: 3.5, opacity: 0.3, drift: 1 },
    { z: -21, h: 12, opacity: 0.5, drift: 0.7 },
    { z: -36, h: 18, opacity: 0.6, drift: 0.5 },
  ]);
  updates.push((dt, _t, camX) => {
    frostGrass.update(camX);
    mist(dt);
  });

  // Langs veien bak: fyrfat med ild, krigsbannere, hodeskaller på stake og runesteiner
  const flames: THREE.Vector3[] = [];
  for (let x = 5; x < L - 3; x += rand(11, 15)) flames.push(brazier(g, gore, x, rand(-3.9, -3.5), rand(2.1, 2.5)));
  for (let x = 12; x < L - 6; x += rand(22, 30)) warBanner(g, updates, x, rand(-5.4, -4.8), rand(5, 5.8));
  for (let x = 20; x < L; x += rand(20, 28)) skullPike(g, gore, x, rand(-4.4, -3.8));
  let runeN = 0;
  for (let x = 9; x < L; x += rand(16, 24)) runeStone(g, x, rand(-7.5, -5.8), rand(2.4, 3.4), runeN++ % 3 === 1);
  for (let x = 30; x < L; x += rand(36, 50)) runeStone(g, x, rand(-11, -9.5), rand(4, 5), true);

  // Iskrystaller langs kantene
  for (let x = 0; x < L; x += rand(7, 13)) {
    const z = pick([rand(3.6, 5.4), rand(-5.5, -4.2)]);
    for (let k = 0; k < 3; k++) {
      const s = z > 0 ? rand(0.12, 0.3) : rand(0.3, 0.7);
      const cr = M(new THREE.OctahedronGeometry(s, 0), '#bfe8ff', x + rand(-0.6, 0.6), s * 0.9, z + rand(-0.3, 0.3), 0.06, undefined, '#3a6a8a');
      cr.scale.y = rand(1.4, 2.4);
      cr.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
      g.add(cr);
    }
  }

  // Frosne krigere i isblokker, med istapper langs kanten
  for (let x = 18; x < L; x += rand(34, 46)) {
    const z = rand(-6.4, -5.6);
    const sk = skull3D(0.55);
    sk.position.set(x, 1.3, z);
    g.add(sk);
    const ice = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 1.4), lit({ color: '#cfefff', transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.15 }));
    ice.position.set(x, 1.3, z);
    g.add(ice);
    icicles(g, x - 0.85, x + 0.85, 2.6, z + 0.72, 6, 0.4);
  }

  // Vakttårn
  const tw = new THREE.Group();
  tw.position.set(L * 0.35, 0, -10);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tw.add(M(new THREE.CylinderGeometry(0.14, 0.14, 6, 5), '#5a3a20', dx, 3, dz, 0.06));
  tw.add(M(new THREE.BoxGeometry(2.8, 0.3, 2.8), '#6b4526', 0, 6, 0, 0.05));
  tw.add(M(new THREE.ConeGeometry(2.2, 2, 4), '#f2f6fa', 0, 7.6, 0, 0.05));
  g.add(tw);
  icicles(g, L * 0.35 - 1.3, L * 0.35 + 1.3, 5.85, -8.6, 5, 0.5);

  for (let x = 0; x < L; x += rand(6, 12)) rock(g, x, pick([rand(4, 6), rand(-6.5, -4.2)]), rand(0.4, 1.0), ['#8a96a6', '#a4b0c0'], 0.9);
  // Taugjerde foran veien her og der (kanten av juvet)
  for (let x = 14; x < L - 6; x += rand(26, 36)) ropeFence(g, x, x + rand(5, 9), rand(4.3, 4.7));
  for (let i = 0; i < L / 5; i++) gore.stain(rand(0, L), rand(-2.4, 2.4), rand(0.3, 0.9));

  if (o.finale === 'duel') endGate(g, gore, L - 4, o.gateTitle ?? 'THE FROZEN PIT >>>', o.gateSub ?? 'BRING A SCARF', '#8aa0b8', '#1a3a6a');
  if (o.finale === 'boss' && o.bossX !== undefined) bossMarker(g, gore, o.bossX - 3, o.bossSign ?? 'NO RETURN');

  // Ild i fyrfatene, tett snøfall, store fnugg like foran kameraet og snøføyke langs bakken i vindkastene
  let fireAcc = 0, snowAcc = 0, nearAcc = 0;
  updates.push((dt, _t, camX) => {
    fireAcc += dt;
    if (fireAcc > 0.045) {
      fireAcc = 0;
      for (const f of flames) if (Math.abs(f.x - camX) < 16) gore.fire(f, 2, 0.16, 2.1);
    }
    snowAcc += dt * 95;
    while (snowAcc > 1) {
      snowAcc--;
      gore.ambient(camX + rand(-14, 14), rand(7, 10), rand(-9, 5), rand(-0.8, -0.1), rand(-1.6, -0.8), '#ffffff', rand(0.05, 0.11), 7, false, 0.05);
    }
    nearAcc += dt * 5;
    while (nearAcc > 1) {
      nearAcc--;
      gore.ambient(camX + rand(-5, 5), rand(3.5, 5.5), rand(5, 8), rand(-0.6, 0), rand(-0.9, -0.5), '#ffffff', rand(0.1, 0.17), 6, false, 0.02);
    }
    if (wind.strength > 1.3 && Math.random() < dt * 40) {
      gore.ambient(camX - 14, rand(0.05, 1.1), rand(-3, 3.5), rand(6, 9), rand(-0.1, 0.25), '#eef4fa', rand(0.04, 0.08), 3.4, false, 0);
    }
  });
  // Mørke, uskarpe silhuetter nederst i forgrunnen (konseptbildene)
  foreground(g, L, ['rock', 'spikes', 'skull'], '#05070c');
  return finishEnv(g, updates, '#56708f', GRADES.frost);
}
