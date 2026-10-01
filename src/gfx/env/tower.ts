// Biome: Tower of Moderate Evil. Innendørs hall med rødt teppe, søyler, vinduer mot natthimmelen og plakater.
import * as THREE from 'three';
import { plainCanvas, INK } from '../draw';
import { rand, pick } from '../../core/math';
import { GHOSTFIRE, type Gore } from '../gore';
import { applyShadows, M, toon, tileTex, stoneTex, texFile, canvasTex, skull3D, bossMarker, endGate, foreground, gen, type Env, type FinaleFx, type Tippable } from './common';
import { templePillar } from './props';
import { princessSprite } from './sprites';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';
import { SunShadow } from './sun';
import { fogLayers, godRays } from './atmos';

/** Søylene i tronsalen som mater skjoldet til Vorthax (x i forhold til der kameraet låses for sjefen). */
export const THRONE_PILLARS = [-5.0, -0.4, 5.6];
/** Tronen står så langt til høyre for låsepunktet. */
const THRONE_DX = 3.0;

const POSTERS = [
  ['EVIL', 'IT\'S A LIFESTYLE'],
  ['EMPLOYEE OF', 'THE MONTH: KEVIN'],
  ['MINIONS WANTED', 'DENTAL NOT INCLUDED'],
  ['THINK MODERATELY', 'EVIL THOUGHTS'],
  ['DAYS WITHOUT', 'A BARBARIAN: 0'],
  ['PLEASE DO NOT', 'FEED THE GNOMES'],
];

export function buildTower(scene: THREE.Scene, gore: Gore, o: StageEnvOpts): Env {
  const L = o.length;
  const g = new THREE.Group();
  const updates: ((dt: number, t: number, camX: number) => void)[] = [];
  scene.background = new THREE.Color('#0e0814');
  scene.fog = new THREE.Fog('#140a1c', 22, 80);
  g.add(new THREE.HemisphereLight('#c8a8ff', '#1a1020', 1.1));
  const key = new THREE.DirectionalLight('#e8d8ff', 0.8);
  const keyShadow = new SunShadow(g, key, new THREE.Vector3(-10, 20, 20));
  keyShadow.update(0);
  updates.push((_dt, _t, camX) => keyShadow.update(camX + 3));

  const ft = texFile('floor_tower', () => tileTex('#3a3048', '#1a1420'));
  // Ett bilde per 4 x 4 enheter (kvadratiske heller)
  ft.repeat.set((L + 60) / 4, 6);
  // Delt i ruter, som bakken på de andre brettene (store trekanter nær kameraet kan gi feil dybde)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L + 60, 24, Math.ceil((L + 60) / 20), 3), toon('#ffffff', ft));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(L / 2, 0, -2);
  g.add(floor);
  const carpetT = canvasTex(plainCanvas(256, 128, (c) => {
    c.fillStyle = '#7a1418';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#d4a63a';
    c.fillRect(0, 8, 256, 8);
    c.fillRect(0, 112, 256, 8);
    for (let x = 16; x < 256; x += 64) {
      c.beginPath();
      c.moveTo(x, 64);
      c.lineTo(x + 16, 44);
      c.lineTo(x + 32, 64);
      c.lineTo(x + 16, 84);
      c.closePath();
      c.fill();
    }
  }));
  carpetT.repeat.set(L / 8, 1);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(L + 40, 5.6), toon('#ffffff', carpetT));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(L / 2, 0.005, 0);
  g.add(carpet);

  const wt = texFile('wall_tower', () => stoneTex('#4a4058', '#221a2c', 64, 40));
  wt.repeat.set((L + 60) / 5, 3);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(L + 60, 14, 1), toon('#ffffff', wt));
  wall.position.set(L / 2, 7, -6);
  g.add(wall);

  const nightT = canvasTex(plainCanvas(128, 256, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#1a0a3a');
    gr.addColorStop(1, '#5a2a7a');
    c.fillStyle = gr;
    c.fillRect(0, 0, 128, 256);
    c.fillStyle = '#fff';
    for (let i = 0; i < 30; i++) c.fillRect(rand(0, 128), rand(0, 200), 2, 2);
    c.fillStyle = '#f2ecd0';
    c.beginPath();
    c.arc(80, 60, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 12;
    c.strokeRect(0, 0, 128, 256);
    c.beginPath();
    c.moveTo(64, 0);
    c.lineTo(64, 256);
    c.moveTo(0, 128);
    c.lineTo(128, 128);
    c.stroke();
  }), false);
  const posterT = POSTERS.map(([a, b]) => canvasTex(plainCanvas(256, 320, (c) => {
    c.fillStyle = '#2a1a0a';
    c.fillRect(0, 0, 256, 320);
    c.fillStyle = '#e8dcc0';
    c.fillRect(16, 16, 224, 288);
    c.fillStyle = '#5b2a86';
    c.beginPath();
    c.arc(128, 130, 60, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#efe8d2';
    c.beginPath();
    c.arc(128, 120, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = INK;
    c.fillRect(112, 112, 10, 12);
    c.fillRect(134, 112, 10, 12);
    c.font = 'bold 30px Impact, sans-serif';
    c.textAlign = 'center';
    c.fillText(a, 128, 236);
    c.font = '22px Impact, sans-serif';
    c.fillText(b, 128, 272);
  }), false));

  const flames: THREE.Vector3[] = [];
  const pt = texFile('pillar_tower', () => stoneTex('#6a5a78', '#2a2034', 64, 32));
  pt.repeat.set(1, 3);
  let pi = 0;
  for (let x = -4; x < L + 8; x += 8) {
    const col = M(new THREE.CylinderGeometry(0.7, 0.8, 12, 10), '#6a5a78', x, 6, -4.6, 0.04, pt);
    col.add(M(new THREE.TorusGeometry(0.78, 0.08, 6, 16), '#d4a63a', 0, -3.5, 0, 0));
    g.add(col);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), new THREE.MeshBasicMaterial({ map: nightT, fog: false }));
    win.position.set(x + 4, 6.5, -5.45);
    g.add(win);
    if ((x / 8) % 2 === 0) {
      const post = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), new THREE.MeshBasicMaterial({ map: posterT[pi++ % posterT.length] }));
      post.position.set(x + 4, 2.3, -5.45);
      g.add(post);
    }
    g.add(M(new THREE.CylinderGeometry(0.2, 0.08, 0.4, 6), '#3a302e', x + 1.1, 3.6, -4.2, 0.05));
    flames.push(new THREE.Vector3(x + 1.1, 3.9, -4.2));
    gore.vfx.lights.source(new THREE.Vector3(x + 1.1, 4.4, -3.2), '#b070ff', 12, 12, 0.25);
  }
  // Hengende bur
  if (gen(o, 'cages')) for (let x = 12; x < L; x += rand(18, 26)) {
    g.add(M(new THREE.CylinderGeometry(0.03, 0.03, 4, 4), '#555', x, 10, -3.8, 0));
    const cage = new THREE.Group();
    cage.position.set(x, 7, -3.8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cage.add(M(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), '#555', Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, 0));
    }
    const sk = skull3D(0.32);
    sk.position.y = -0.55;
    cage.add(sk);
    g.add(cage);
    const ph = rand(0, 6);
    updates.push((_dt, t) => {
      cage.rotation.z = Math.sin(t * 0.8 + ph) * 0.06;
    });
  }
  if (gen(o, 'stains')) for (let i = 0; i < L / 6; i++) gore.stain(rand(0, L), rand(-2.4, 2.4), rand(0.3, 0.9));

  // Månelys som faller skrått inn gjennom vinduene, og støv som henger i lufta
  if (gen(o, 'rays')) {
    const moon = godRays(g, Array.from({ length: Math.ceil((L + 12) / 8) }, (_, i) => -4 + i * 8 + 4.8), -4.9, '#8a7aff', 0.38, 12, 2.2, 0.16);
    updates.push((dt) => moon(dt));
  }
  if (gen(o, 'fog')) {
    const dust = fogLayers(g, L, '#4a3a70', [{ z: -4.3, h: 11, opacity: 0.14, drift: 0.3 }]);
    updates.push((dt) => dust(dt));
  }

  if (o.finale === 'duel') endGate(g, gore, L - 4, o.gateTitle ?? 'THRONE ROOM >>>', o.gateSub ?? 'KNOCK FIRST', '#4a4058', '#5b2a86');
  // Skiltet står ved inngangen til tronsalen, og selve salen er bygget rundt låsepunktet (bossX - 2)
  let finale: FinaleFx | undefined;
  if (o.finale === 'boss' && o.bossX !== undefined) {
    bossMarker(g, gore, o.bossX - 11, o.bossSign ?? 'THRONE ROOM');
    if (gen(o, 'throne')) finale = throneRoom(g, gore, updates, o.bossX - 2);
  }

  scene.add(g);
  let acc = 0;
  updates.push((dt, t, camX) => {
    acc += dt;
    if (acc > 0.06) {
      acc = 0;
      for (const f of flames) if (Math.abs(f.x - camX) < 16) gore.fire(f, 1, 0.08, 1.4, GHOSTFIRE);
    }
    if (Math.random() < dt * 4) gore.ambient(camX + rand(-10, 10), rand(1, 6), rand(-4, 2), rand(-0.1, 0.1), rand(-0.1, 0.1), pick(['#c080ff', '#ffffff']), 0.05, 4, true);
  });
  // Mørke, uskarpe silhuetter nederst i forgrunnen (konseptbildene)
  if (gen(o, 'silhouettes')) foreground(g, L, ['bones', 'skull', 'cross'], '#07040a', [10, 18]);
  applyShadows(g);
  return {
    group: g,
    fogColor: '#140a1c',
    grade: GRADES.tower,
    tippables: g.userData.tippables as Tippable[] | undefined,
    finale,
    update(dt, t, camX) {
      for (const u of updates) u(dt, t, camX);
    },
  };
}

/**
 * Tronsalen (sluttkampen): tronen på en trapp med hodeskaller, tre søyler med krystaller som mater skjoldet til
 * Vorthax, Solhjertet som henger over tronen som en lysekrone (stråler går fra det til krystallene), og prinsessen i
 * et bur. lock er der kameraet låses når sjefen kommer.
 */
function throneRoom(g: THREE.Group, gore: Gore, updates: ((dt: number, t: number, camX: number) => void)[], lock: number): FinaleFx {
  const tx = lock + THRONE_DX;
  const dark = '#2a2034', gold = '#c8a040';
  // Trappa og tronen
  const steps = [[3.4, 2.4, -4.45], [2.9, 2.0, -4.65], [2.4, 1.6, -4.85]] as const;
  steps.forEach(([w, d, z], i) => {
    g.add(M(new THREE.BoxGeometry(w, 0.18, d), '#3a3048', tx, 0.09 + i * 0.18, z, 0.05));
    g.add(M(new THREE.BoxGeometry(w + 0.02, 0.04, 0.06), gold, tx, 0.17 + i * 0.18, z + d / 2, 0.04));
  });
  const top = 0.54;
  g.add(M(new THREE.BoxGeometry(1.5, 0.5, 1.0), dark, tx, top + 0.25, -4.95, 0.05));
  g.add(M(new THREE.BoxGeometry(1.7, 2.8, 0.3), dark, tx, top + 1.4, -5.4, 0.05));
  g.add(M(new THREE.BoxGeometry(1.75, 0.12, 0.34), gold, tx, top + 2.8, -5.4, 0.04));
  for (const dx of [-0.8, 0.8]) g.add(M(new THREE.BoxGeometry(0.22, 0.8, 1.0), '#3a2a48', tx + dx, top + 0.6, -4.95, 0.05));
  for (const [dx, y, s] of [[-0.6, 2.95, 0.3], [0, 3.15, 0.38], [0.6, 2.95, 0.3]] as const) {
    const sk = skull3D(s);
    sk.position.set(tx + dx, top + y, -5.3);
    g.add(sk);
  }
  // Søylene med krystaller
  const pillars = THRONE_PILLARS.map((dx) => templePillar(g, gore, updates, lock + dx, -3.45, 5.2, 'tower'));
  // Solhjertet henger i kjeder over tronen
  const heartAt = new THREE.Vector3(tx, 5.7, -4.6);
  const heart = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb020', emissiveIntensity: 2.6, roughness: 0.25 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb030', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  heart.add(core, halo);
  heart.position.copy(heartAt);
  g.add(heart);
  const chains = new THREE.Group();
  for (const dx of [-0.25, 0.25]) chains.add(M(new THREE.CylinderGeometry(0.025, 0.025, 6, 4), '#6a6a72', heartAt.x + dx, heartAt.y + 3.4, heartAt.z, 0));
  g.add(chains);
  const light = gore.vfx.lights.source(heartAt, '#ffc040', 16, 12, 0.12);
  // Stråler fra Solhjertet til krystallene
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beams = pillars.map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true), beamMat);
    g.add(m);
    return m;
  });
  // Prinsessen i et bur
  const cage = new THREE.Group();
  const cageAt = new THREE.Vector3(lock - 2.6, 4.2, -4.5);
  cage.position.copy(cageAt);
  const bars = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    bars.add(M(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 4), '#5a5a62', Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, 0));
  }
  for (const y of [-1.1, 1.1]) {
    const ring = M(new THREE.TorusGeometry(0.8, 0.04, 6, 24), '#5a5a62', 0, y, 0, 0);
    ring.rotation.x = Math.PI / 2;
    bars.add(ring);
  }
  cage.add(bars);
  let princess = princessSprite();
  princess.scale.setScalar(0.66);
  princess.position.set(0, -0.08, 0);
  cage.add(princess);
  g.add(cage);
  const rope = M(new THREE.CylinderGeometry(0.03, 0.03, 6, 4), '#555', cageAt.x, cageAt.y + 4.1, cageAt.z, 0);
  g.add(rope);

  // Tilstanden: Solhjertet henger, flyr til Vorthax eller ligger på gulvet, og buret senkes når han er død
  let target: (() => THREE.Vector3) | null = null;
  let heartMode: 'hang' | 'fly' | 'held' | 'drop' | 'floor' = 'hang';
  let heartVel = 0;
  let freed = -1;
  const tmp = new THREE.Vector3();
  updates.push((dt, t) => {
    core.rotation.y = t * 0.9;
    halo.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    if (heartMode === 'hang') heart.position.set(heartAt.x, heartAt.y + Math.sin(t * 1.2) * 0.06, heartAt.z);
    else if ((heartMode === 'fly' || heartMode === 'held') && target) {
      const goal = target();
      heart.position.lerp(goal, Math.min(1, dt * (heartMode === 'fly' ? 3 : 14)));
      if (heartMode === 'fly' && heart.position.distanceTo(goal) < 0.3) heartMode = 'held';
      heart.scale.setScalar(heartMode === 'held' ? 0.36 : 0.7);
      (halo.material as THREE.MeshBasicMaterial).opacity = heartMode === 'held' ? 0.12 : 0.22;
    } else if (heartMode === 'drop') {
      heartVel -= 14 * dt;
      heart.position.y += heartVel * dt;
      if (heart.position.y < 0.45) {
        heart.position.y = 0.45;
        heartVel = -heartVel * 0.35;
        if (Math.abs(heartVel) < 0.6) heartMode = 'floor';
      }
    }
    light.pos.copy(heart.position);
    chains.visible = heartMode === 'hang';
    // Strålene til krystallene som står, så lenge hjertet henger
    pillars.forEach((p, i) => {
      const m = beams[i];
      m.visible = heartMode === 'hang' && !p.tipped && !!p.top;
      if (!m.visible || !p.top) return;
      const a = heart.position, b = p.top();
      const d = tmp.subVectors(b, a);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.scale.set(1, d.length(), 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    });
    beamMat.opacity = 0.32 + Math.sin(t * 9) * 0.1;
    // Buret senkes til gulvet og stengene faller av
    if (freed >= 0) {
      freed += dt;
      const k = Math.min(1, freed / 1.6);
      cage.position.y = cageAt.y + (1.18 - cageAt.y) * (k * k * (3 - 2 * k));
      rope.scale.y = 1 + k * 0.5;
      rope.position.y = cageAt.y + 4.1 - k * 1.5;
      if (freed > 1.7) {
        bars.children.forEach((b, i) => {
          b.position.y -= dt * 2.5;
          b.rotation.z += dt * (i % 2 ? 2 : -2);
        });
        if (freed > 2.6) bars.visible = false;
      }
    }
  });
  return {
    throne: new THREE.Vector3(tx, top, -3.95),
    heart: () => heart.getWorldPosition(new THREE.Vector3()),
    heartTo(to) {
      target = to;
      heartVel = 0;
      heartMode = to ? 'fly' : 'drop';
      if (!to) heart.scale.setScalar(0.8);
    },
    freePrincess() {
      if (freed >= 0) return;
      freed = 0;
      // Nytt skilt
      cage.remove(princess);
      princess = princessSprite('FINALLY');
      princess.scale.setScalar(0.66);
      princess.position.set(0, -0.08, 0);
      cage.add(princess);
    },
  };
}
