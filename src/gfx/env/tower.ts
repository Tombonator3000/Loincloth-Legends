// Biome: Tower of Moderate Evil. Innendørs hall med rødt teppe, søyler, vinduer mot natthimmelen og plakater.
import * as THREE from 'three';
import { plainCanvas, INK } from '../draw';
import { rand, pick } from '../../core/math';
import { GHOSTFIRE, type Gore } from '../gore';
import { applyShadows, M, toon, tileTex, stoneTex, texFile, canvasTex, skull3D, bossMarker, endGate, foreground, gen, type Env } from './common';
import type { StageEnvOpts } from './index';
import { GRADES } from './grades';
import { SunShadow } from './sun';
import { fogLayers, godRays } from './atmos';

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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L + 60, 24), toon('#ffffff', ft));
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
  if (o.finale === 'boss' && o.bossX !== undefined) bossMarker(g, gore, o.bossX - 3, o.bossSign ?? 'THRONE ROOM');

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
    update(dt, t, camX) {
      for (const u of updates) u(dt, t, camX);
    },
  };
}
