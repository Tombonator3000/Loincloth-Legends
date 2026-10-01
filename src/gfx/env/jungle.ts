// Biome: jungelen rundt Soltempelet. Høye jungeltrær med kronen langt oppe, lianer, bregner og mose på den gamle
// kongeveien av stein, et soltempel (trappepyramide med en gullsol) i disen, klipper med fossefall, steinstatuer av
// glemte guder, et halvt begravd steinhode, sprukne søyler som kan veltes over veien (props.ts), sokkelen der
// Solhjertet sto, lysstråler gjennom løvtaket, fuktig dis, pollen og ildfluer.
import * as THREE from 'three';
import { rand, pick, random } from '../../core/math';
import { plainCanvas } from '../draw';
import type { Gore } from '../gore';
import {
  lit, M, groundTex, roadTex, texFile, stageBase, finishEnv, mountains, rock, endGate, bossMarker, foreground, gen, staticGroup,
  stoneTex, canvasTex, type Env,
} from './common';
import { Forest, SPECIES } from './trees';
import { Meadow } from './meadow';
import { LeafFall } from './leaffall';
import { fogLayers, godRays } from './atmos';
import { wind } from '../wind';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';
import { cliff, waterfall, templePillar } from './props';

/** Hvor søylene som kan veltes står (andel av brettets lengde), langs bakkanten av veien. */
export const JUNGLE_PILLARS = [0.21, 0.45, 0.68];
/** Hvor Soltempelet står (andel av brettets lengde). Skogen åpner seg foran det. */
const TEMPLE_X = 0.62;

let faceTex: THREE.Texture | null = null;
/** Ansiktet til en steingud: tunge øyelokk, flat nese, bred munn og et pannebånd med solstråler, hugget i stein. */
function idolFace() {
  faceTex ??= canvasTex(plainCanvas(128, 128, (c) => {
    c.fillStyle = '#8a866e';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 120; i++) {
      c.fillStyle = `rgba(${random() < 0.5 ? '60,70,40' : '170,165,140'},${0.15 + random() * 0.25})`;
      c.fillRect(random() * 128, random() * 128, 2 + random() * 6, 2 + random() * 6);
    }
    c.strokeStyle = '#3e3c30';
    c.fillStyle = '#4a4838';
    c.lineWidth = 5;
    // Pannebånd med stråler
    c.fillRect(8, 10, 112, 14);
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.moveTo(14 + i * 17, 10);
      c.lineTo(22 + i * 17, 0);
      c.lineTo(30 + i * 17, 10);
      c.fill();
    }
    // Øyne, nese og munn
    for (const x of [40, 88]) {
      c.beginPath();
      c.ellipse(x, 52, 15, 7, 0, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(x - 18, 42);
      c.lineTo(x + 18, 42);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(64, 56);
    c.lineTo(56, 82);
    c.lineTo(72, 82);
    c.stroke();
    c.fillRect(38, 96, 52, 9);
    // Mose nederst
    c.fillStyle = 'rgba(70,110,40,0.65)';
    for (let i = 0; i < 40; i++) c.fillRect(random() * 128, 108 + random() * 20, 4 + random() * 8, 3 + random() * 5);
  }), false);
  return faceTex;
}

export function buildJungle(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  // En glenne i skogen foran Soltempelet, så pyramiden synes fra veien
  const open = (x: number, w: number) => Math.abs(x - L * TEMPLE_X) > w;
  const { g, updates } = stageBase(scene, L, {
    biome: 'jungle',
    // Sola står høyt og litt bak: kort, flekkete skygge under løvtaket
    sunDir: [-0.3, 0.85, -0.45],
    sky: ['#3a6a4a', '#9ac0a0', '#e0ecc0'], bg: '#7a9a72', fog: ['#7e9c74', 14, 64],
    hemi: ['#eef6cc', '#2a3a1c', 1.55], sun: ['#fff0c8', 1.45],
    ground: texFile('ground_jungle', () => groundTex('#3a4620', ['#46562a', '#2c3818', '#55582a', '#3e5a24'], '#2a4a1a')),
    road: texFile('road_jungle', () => roadTex('#76705a', ['#68624c', '#868068', '#5c5644', '#5a6a3a'], 'rgba(40,60,20,0.45)', ['#8a8a76', '#9a9884', '#6e7a5a']), { fringe: true }),
    clouds: '#eef4dc',
    // Fuktig, disig luft med høy sol
    atmosphere: { sun: [-0.3, 0.55, -0.6], turbidity: 11, rayleigh: 1.4, mie: 0.022, mieG: 0.8, clouds: 0.55, cloudDensity: 0.55, gain: 0.55 },
  });
  gore.dustColor = '#7a6a48';
  mountains(g, L, ['#3e5e3a', '#4a6a42', '#36543a'], null, -100, 10, 20);
  const stone = (base: string, mortar: string) => {
    const t = stoneTex(base, mortar, 48, 32);
    t.repeat.set(2, 2);
    return t;
  };
  const templeStone = lit({ map: stone('#9e987a', '#5a5846'), roughness: 0.92 }, { scale: 0.7, normal: 1.0, albedo: 0.4 });
  const mossM = lit({ color: '#46682a', roughness: 1 }, false);

  // Klipper med fossefall bak skogen
  if (gen(o, 'cliffs')) {
    let i = 0;
    for (let x = -10; x < L + 20; x += rand(22, 34)) {
      const w = rand(9, 14), h = rand(7, 11), d = rand(5, 7), z = rand(-21, -18);
      if (!open(x, 16)) continue;
      const top = cliff(g, x, z, w, h, d, ['#5a6a4a', '#4e5e40', '#66764e']);
      if (i++ % 2 === 0) waterfall(g, gore, updates, x + rand(-0.2, 0.2) * w, z + d * 0.5 + 0.5, top * 0.9, rand(1.8, 2.8));
    }
  }

  // Soltempelet langt bak: en trappepyramide med en helligdom og en gullsol på toppen, og en mindre ruin i disen
  if (gen(o, 'temple')) {
    const sg = staticGroup(g);
    const pyramid = (x: number, z: number, s: number) => {
      const tiers = 5;
      for (let t = 0; t < tiers; t++) {
        const w = (16 - t * 2.6) * s, h = 2.1 * s, d = (10 - t * 1.4) * s;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), templeStone);
        b.position.set(x, h / 2 + t * h, z);
        sg.add(b);
        // Mose og slyngplanter langs kanten av hvert trinn
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.25 * s, d * 1.01), mossM);
        m.position.set(x, (t + 1) * h - 0.1 * s, z);
        sg.add(m);
      }
      // Trappa midt på forsiden
      const stairs = new THREE.Mesh(new THREE.BoxGeometry(2.6 * s, 2.1 * s * tiers, 2.2 * s), templeStone);
      stairs.position.set(x, 1.05 * s * tiers, z + 5 * s);
      stairs.rotation.x = -0.32;
      sg.add(stairs);
      // Helligdommen på toppen med en mørk døråpning
      const top = 2.1 * s * tiers;
      const shrine = new THREE.Mesh(new THREE.BoxGeometry(4.2 * s, 3 * s, 3.4 * s), templeStone);
      shrine.position.set(x, top + 1.5 * s, z);
      sg.add(shrine);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3 * s, 1.9 * s), new THREE.MeshBasicMaterial({ color: '#0c0f08' }));
      door.position.set(x, top + 0.95 * s, z + 1.71 * s);
      g.add(door);
      return top + 3 * s;
    };
    const tx = L * TEMPLE_X, tz = -17.5;
    const top = pyramid(tx, tz, 0.95);
    // Gullsola over døra (lyser litt, så bloom tar den)
    const sun = M(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 24), '#c8a040', tx, top - 0.4, tz + 1.8, 0, undefined, '#6a4a10');
    sun.rotation.x = Math.PI / 2;
    g.add(sun);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ray = M(new THREE.ConeGeometry(0.22, 0.9, 4), '#c8a040', tx + Math.cos(a) * 1.9, top - 0.4 + Math.sin(a) * 1.9, tz + 1.8, 0, undefined, '#6a4a10');
      ray.rotation.z = a - Math.PI / 2;
      g.add(ray);
    }
    pyramid(L * 0.18, -52, 0.9);
  }

  // Jungeltrær: høye stammer med kronen langt oppe, noen mindre løvtrær imellom, og skogen bakover i disen
  wind.set(0.4, 1, 0.25, 0.35);
  if (gen(o, 'forest')) {
    const giants = new Forest(SPECIES.jungle, 3);
    for (let x = -8; x < L + 8; x += rand(5, 9)) if (open(x, 8)) giants.add(x, rand(-12, -7), rand(0.85, 1.2));
    for (let x = -20; x < L + 20; x += rand(4, 7)) if (open(x, 11)) giants.add(x, rand(-32, -16), rand(1.1, 1.6), undefined, false);
    g.add(giants.build());
    // Under kronene: palmer og bananplanter tett ved veien, og unge jungeltrær litt lenger bak
    const palms = new Forest(SPECIES.palm, 3);
    for (let x = rand(-4, 2); x < L + 4; x += rand(6, 11)) if (open(x, 6)) palms.add(x, rand(-8.8, -6.4), rand(0.75, 1.05));
    g.add(palms.build());
    const bananas = new Forest(SPECIES.banana, 3);
    for (let x = rand(-2, 3); x < L + 4; x += rand(5, 9)) if (open(x, 5)) bananas.add(x, rand(-6.2, -4.6), rand(0.75, 1.05));
    g.add(bananas.build());
    const young = new Forest(SPECIES.jungle, 2);
    for (let x = rand(0, 6); x < L; x += rand(10, 16)) if (open(x, 7)) young.add(x, rand(-10.5, -8.6), rand(0.5, 0.62));
    g.add(young.build());
  }

  // Lianer som henger ned fra løvtaket, noen i bue mellom trærne
  if (gen(o, 'vines')) {
    const sg = staticGroup(g);
    const vineM = lit({ color: '#2e4a1e', roughness: 0.9 }, false);
    for (let x = -6; x < L + 6; x += rand(2.5, 5)) {
      const z = rand(-11, -5.2), top = 13;
      if (!open(x, 6)) continue;
      const pts: THREE.Vector3[] = [];
      if (random() < 0.35) {
        // Bue mellom to stammer
        const w = rand(3, 6), low = rand(3.2, 5.5);
        for (let i = 0; i <= 8; i++) {
          const u = i / 8;
          pts.push(new THREE.Vector3(x + u * w, low + (top - low) * Math.pow(2 * u - 1, 2), z + Math.sin(u * 3) * 0.3));
        }
      } else {
        const end = rand(2.2, 6);
        for (let i = 0; i <= 6; i++) {
          const u = i / 6;
          pts.push(new THREE.Vector3(x + Math.sin(u * 2.4) * 0.35, top - (top - end) * u, z + Math.cos(u * 3) * 0.2));
        }
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rand(0.035, 0.07), 5), vineM);
      sg.add(tube);
    }
  }

  // Bregner og høye jungelplanter bak veien, og lavere foran
  if (gen(o, 'meadow')) {
    const ferns = new Meadow({ bands: [[-8.5, -4.4, 6], [4.4, 8.6, 4]], height: [0.55, 1.35], width: 0.22, base: '#1e3a14', tip: '#6aa040', dry: '#8a9a3a', blades: 4, bend: 0.9 });
    g.add(ferns.mesh);
    updates.push((_dt, _t, camX) => ferns.update(camX));
  }
  if (gen(o, 'leaves')) {
    const leaves = new LeafFall({ palette: SPECIES.jungle.leaves!.palette, area: [3.5, 9, -12, 7], litter: 5, length: L });
    g.add(leaves.group);
    updates.push((dt, _t, camX) => leaves.update(dt, camX));
  }

  // Steinguder langs bakkanten: en sittende figur med hendene på knærne, og et stort hode halvt begravd i jorda
  if (gen(o, 'statues')) {
    const sg = staticGroup(g);
    const faceM = lit({ map: idolFace(), roughness: 0.95 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = templeStone) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      sg.add(b);
      return b;
    };
    for (let x = 14; x < L - 10; x += rand(30, 40)) {
      const z = rand(-7.2, -6.2), s = rand(1, 1.3);
      box(1.9 * s, 0.6 * s, 1.4 * s, x, 0.3 * s, z);
      box(1.3 * s, 1.5 * s, 0.9 * s, x, 1.35 * s, z);
      box(1.6 * s, 0.4 * s, 1.2 * s, x, 0.8 * s, z + 0.3 * s);
      for (const dx of [-0.55, 0.55]) box(0.28 * s, 0.9 * s, 0.3 * s, x + dx * s, 1.3 * s, z + 0.55 * s);
      const head = box(0.95 * s, 0.95 * s, 0.85 * s, x, 2.6 * s, z, templeStone);
      void head;
      // Ansiktet på forsiden av hodet
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.92 * s, 0.92 * s), faceM);
      face.position.set(x, 2.6 * s, z + 0.43 * s);
      sg.add(face);
      box(1.2 * s, 0.25 * s, 1.0 * s, x, 3.2 * s, z, mossM);
    }
    // Det store steinhodet
    const hx = L * 0.33, hz = -13;
    const big = new THREE.Mesh(new THREE.BoxGeometry(5, 4.2, 4.2), templeStone);
    big.position.set(hx, 1.6, hz);
    big.rotation.set(0.05, 0.25, -0.12);
    sg.add(big);
    const bigFace = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), faceM);
    bigFace.position.set(hx + 0.52, 1.7, hz + 2.05);
    bigFace.rotation.set(0.05, 0.25, -0.12);
    sg.add(bigFace);
  }

  // Sprukne søyler ved bakkanten av veien: kan veltes over veien og knuse fiendene (Env.tippables)
  if (gen(o, 'pillars')) for (const f of JUNGLE_PILLARS) templePillar(g, gore, updates, L * f, -3.45, rand(5.2, 5.8));

  // Sokkelen der Solhjertet sto, rett før porten: tom gullfatning og en lapp
  if (gen(o, 'pedestal')) {
    const px = L - 13, pz = -4.4;
    const sg = staticGroup(g);
    for (const [w, h, y] of [[1.8, 0.4, 0.2], [1.3, 0.5, 0.65], [0.9, 0.9, 1.35]] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), templeStone);
      b.position.set(px, y, pz);
      sg.add(b);
    }
    const ring = M(new THREE.TorusGeometry(0.34, 0.07, 8, 20), '#d8b04a', px, 1.95, pz, 0, undefined, '#5a3a08');
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(plainCanvas(64, 48, (c) => {
      c.fillStyle = '#e8dcb8';
      c.fillRect(0, 0, 64, 48);
      c.fillStyle = '#3a2a1a';
      c.font = 'bold 16px serif';
      c.fillText('IOU', 16, 22);
      c.font = '12px serif';
      c.fillText('- V', 26, 40);
    }), false) }));
    note.position.set(px + 0.2, 1.4, pz + 0.46);
    note.rotation.z = -0.1;
    g.add(note);
  }

  if (gen(o, 'fog')) {
    const mist = fogLayers(g, L, new THREE.Color('#c8dca0').multiplyScalar(1.02), [
      { z: -5.6, h: 2.4, opacity: 0.28, drift: 1.1 },
      { z: -11, h: 5, opacity: 0.38, drift: 0.8 },
      { z: -24, h: 12, opacity: 0.5, drift: 0.55 },
      { z: -44, h: 22, opacity: 0.6, drift: 0.4 },
    ]);
    updates.push((dt) => mist(dt));
  }
  if (gen(o, 'rays')) {
    const rays = godRays(g, Array.from({ length: Math.ceil(L / 12) }, (_, i) => i * 12 + rand(-3, 3)), -8.5, '#fff0b8', -0.32, 17, 2.6, 0.26);
    updates.push((dt) => rays(dt));
  }
  if (gen(o, 'rocks')) for (let x = 0; x < L; x += rand(7, 13)) rock(g, x, pick([rand(4.2, 6), rand(-6.6, -4.4)]), rand(0.4, 0.9), ['#6a6a56', '#5a5e48', '#767660']);
  if (gen(o, 'stains')) for (let i = 0; i < L / 6; i++) gore.stain(rand(0, L), rand(-2.4, 2.4), rand(0.3, 0.8));

  if (o.finale === 'duel') endGate(g, gore, L - 4, o.gateTitle ?? 'THE SUN TEMPLE >>>', o.gateSub ?? 'KNEEL OR BLEED', '#7a7a5e', '#2a5a3a');
  if (o.finale === 'boss' && o.bossX !== undefined) bossMarker(g, gore, o.bossX - 3, o.bossSign ?? 'SUN TEMPLE');

  // Pollen som driver i lysstrålene, og ildfluer i skyggen bak
  let acc = 0;
  updates.push((dt, _t, camX) => {
    acc += dt;
    while (acc > 0.1) {
      acc -= 0.1;
      gore.ambient(camX + rand(-11, 11), rand(0.6, 4.5), rand(-4, 3), rand(-0.15, 0.15), rand(-0.05, 0.12), pick(['#fff4b0', '#f0e090']), rand(0.04, 0.08), rand(2.5, 4), true, 0);
      if (random() < 0.35) gore.ambient(camX + rand(-12, 12), rand(0.4, 2.4), rand(-7, -4.5), rand(-0.3, 0.3), rand(-0.1, 0.2), '#b8ff6a', rand(0.07, 0.11), rand(1.2, 2.2), true);
    }
  });
  if (gen(o, 'silhouettes')) foreground(g, L, ['fern', 'fern', 'rock', 'skull'], '#040805');
  return finishEnv(g, updates, '#7e9c74', GRADES.jungle);
}
