// Duell-arenaen. Tre temaer: gropa (standard), is-arenaen og bein-colosseumet.
import * as THREE from 'three';
import { unitCanvas } from '../draw';
import { rand } from '../../core/math';
import { FIRE, ICEFIRE, GHOSTFIRE, type Gore } from '../gore';
import { applyShadows, lit, M, toon, sky, stoneTex, tileTex, sandTex, texFile, canvasTex, skull3D, type Env } from './common';
import { vorthaxSprite, princessSprite, crowdTex } from './sprites';
import { GRADES } from './grades';
import { SunShadow } from './sun';

export type ArenaTheme = 'pit' | 'ice' | 'bone';

const THEMES: Record<ArenaTheme, {
  bg: string; sky: [string, string, string]; hemi: [string, string, number]; floor: [string, string]; sand: [string, string[]];
  wall: [string, string]; step: string; pillar: [string, string]; fire: string[]; light: string; banner: [string, string]; drape: string;
}> = {
  pit: {
    bg: '#1c1016', sky: ['#12060c', '#3a1420', '#5a2420'], hemi: ['#ffb890', '#2a1a20', 1.3], floor: ['#77706a', '#3e3a36'],
    sand: ['#b89a6a', ['#a88a5a', '#c7aa7a', '#9e8050']], wall: ['#7a6a64', '#3a302e'], step: '#4a3a36', pillar: ['#8a7a70', '#453a36'],
    fire: FIRE, light: '#ff7a2a', banner: ['#6b1418', '#d4a63a'], drape: '#6b1418',
  },
  ice: {
    bg: '#0e1a2a', sky: ['#060c1a', '#1a3050', '#3a5a80'], hemi: ['#c8e8ff', '#1a2a40', 1.4], floor: ['#8aa8c8', '#3a4a60'],
    sand: ['#e8f2fa', ['#d0e0ee', '#f6fafc', '#c0d4e6']], wall: ['#8aa0b8', '#3a4a5e'], step: '#3a4a5e', pillar: ['#a0b8d0', '#4a5a70'],
    fire: ICEFIRE, light: '#6fc0ff', banner: ['#1a3a6a', '#c8e8ff'], drape: '#1a3a6a',
  },
  bone: {
    bg: '#140c18', sky: ['#0a060e', '#2a1430', '#4a2448'], hemi: ['#e0c8ff', '#1a1020', 1.3], floor: ['#c8bca0', '#5a4e40'],
    sand: ['#d8ccae', ['#c8bc9e', '#e6dcc0', '#b8ac8e']], wall: ['#b8ac90', '#4a4034'], step: '#3a2e36', pillar: ['#d8ccb0', '#5a4e40'],
    fire: GHOSTFIRE, light: '#a060ff', banner: ['#3a1a4a', '#efe8d2'], drape: '#3a1a4a',
  },
};

export function buildArena(scene: THREE.Scene, gore: Gore, theme: ArenaTheme = 'pit'): Env {
  const T = THEMES[theme];
  const g = new THREE.Group();
  scene.background = new THREE.Color(T.bg);
  scene.fog = new THREE.Fog(T.bg, 26, 70);
  g.add(sky(T.sky[0], T.sky[1], T.sky[2], 'arena-' + theme));
  const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]);
  const key = new THREE.DirectionalLight('#ffe8d0', 1.4);
  g.add(hemi);
  new SunShadow(g, key, new THREE.Vector3(4, 18, 12), 16, 12).update(0, -2);

  const ft = texFile('floor_arena-' + theme, () => tileTex(T.floor[0], T.floor[1]));
  ft.repeat.set(7, 7);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 48), toon('#ffffff', ft));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -3;
  g.add(floor);
  const st = texFile('sand_arena-' + theme, () => sandTex(T.sand[0], T.sand[1]));
  st.repeat.set(4, 4);
  const sand = new THREE.Mesh(new THREE.CircleGeometry(9.5, 40), toon('#ffffff', st));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.003, -1);
  sand.scale.set(1, 0.55, 1);
  g.add(sand);

  const wt = texFile('wall_arena-' + theme, () => stoneTex(T.wall[0], T.wall[1], 64, 40));
  wt.repeat.set(10, 1);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 3.4, 40, 1, true, Math.PI * 0.5 + 0.05, Math.PI - 0.1), lit({ map: wt, side: THREE.BackSide }));
  wall.position.set(0, 1.7, -3);
  wall.rotation.y = Math.PI;
  g.add(wall);
  if (theme === 'bone') {
    for (let i = 0; i < 60; i++) {
      const a = Math.PI * (0.08 + (i / 60) * 0.84);
      const sk = skull3D(0.34);
      sk.position.set(Math.cos(a) * 12.7, 0.5 + (i % 4) * 0.8, -3 - Math.sin(a) * 12.7);
      sk.lookAt(0, sk.position.y, -3);
      g.add(sk);
    }
  }

  const tiers: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = 13.6 + i * 1.6;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.8, r + 0.8, 0.6, 40, 1, true, Math.PI * 0.5, Math.PI), lit({ color: T.step, side: THREE.DoubleSide }));
    step.position.set(0, 3.4 + i * 1.2, -3);
    step.rotation.y = Math.PI;
    g.add(step);
    for (let k = 0; k < 7; k++) {
      const ang = Math.PI * (0.12 + k * 0.126);
      const cr = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: crowdTex(i * 7 + k + (theme === 'pit' ? 0 : 40)), alphaTest: 0.5, side: THREE.DoubleSide }));
      cr.position.set(Math.cos(ang) * r, 3.95 + i * 1.2, -3 - Math.sin(ang) * r);
      cr.lookAt(0, cr.position.y, -3);
      cr.userData.base = cr.position.y;
      cr.userData.ph = rand(0, 6);
      g.add(cr);
      tiers.push(cr);
    }
  }

  const fireSpots: THREE.Vector3[] = [];
  const pt = texFile('pillar_arena-' + theme, () => stoneTex(T.pillar[0], T.pillar[1], 64, 32));
  pt.repeat.set(1, 2);
  for (const ang of [0.2, 0.38, 0.62, 0.8]) {
    const a = Math.PI * ang;
    const x = Math.cos(a) * 12.2;
    const z = -3 - Math.sin(a) * 12.2;
    const col = M(new THREE.CylinderGeometry(0.6, 0.7, 6, 8), T.pillar[0], x, 3, z, 0.05, pt);
    col.add(M(new THREE.BoxGeometry(1.6, 0.4, 1.6), T.pillar[1], 0, 3.1, 0, 0.05));
    g.add(col);
    g.add(M(new THREE.CylinderGeometry(0.5, 0.2, 0.5, 8), '#3a302e', x, 6.5, z + 0.4, 0.05));
    fireSpots.push(new THREE.Vector3(x, 6.8, z + 0.4));
    gore.vfx.lights.source(new THREE.Vector3(x, 7.2, z + 1.2), T.light, 22, 16, 0.25);
  }

  const balc = new THREE.Group();
  balc.position.set(0, 0, -15.5);
  balc.add(M(new THREE.BoxGeometry(8, 3.2, 3), T.wall[0], 0, 1.6, 0, 0.05, wt));
  balc.add(M(new THREE.BoxGeometry(8.4, 0.3, 3.4), '#3a2a2a', 0, 3.3, 0, 0.05));
  const drape = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), toon(T.drape));
  drape.position.set(0, 1.9, 1.55);
  balc.add(drape);
  const vorthax = vorthaxSprite();
  vorthax.scale.setScalar(1.45);
  vorthax.position.set(-1.3, 3.45 + 1.45 * 1.5, 0.4);
  balc.add(vorthax);
  const princess = princessSprite();
  princess.scale.setScalar(1.45);
  princess.position.set(2.0, 3.45 + 1.45 * 1.45, 0.5);
  balc.add(princess);
  g.add(balc);

  const banT = canvasTex(unitCanvas(1.0, 3.0, 0.5, 0, 90, (p) => {
    p.poly([-0.45, 2.95, 0.45, 2.95, 0.45, 0.3, 0, 0.6, -0.45, 0.3], T.banner[0]);
    p.ell(0, 2.1, 0.25, 0.25, T.banner[1]);
    p.ell(0, 2.1, 0.12, 0.12, T.banner[0], false);
  }), false);
  for (const x of [-5.2, 5.2]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.2), new THREE.MeshBasicMaterial({ map: banT, alphaTest: 0.5, side: THREE.DoubleSide }));
    b.position.set(x, 2.6, -13.9);
    g.add(b);
  }
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const bn = M(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4), '#efe8d2', side * rand(9, 12), 0.1, rand(-8, -4), 0.1);
    bn.rotation.set(rand(0, 3), rand(0, 3), Math.PI / 2);
    g.add(bn);
  }
  for (let i = 0; i < 26; i++) gore.stain(rand(-9, 9), rand(-3, 1.2), rand(0.3, 1.0));

  applyShadows(g);
  scene.add(g);
  let acc = 0;
  let snowAcc = 0;
  let cheer = 0;
  return {
    group: g,
    fogColor: T.bg,
    grade: GRADES[theme],
    cheer(p: number) {
      cheer = Math.max(cheer, p);
    },
    update(dt, t, camX) {
      acc += dt;
      if (acc > 0.04) {
        acc = 0;
        for (const f of fireSpots) gore.fire(f, 2, 0.25, 2.5, T.fire);
      }
      if (theme === 'ice') {
        snowAcc += dt * 40;
        while (snowAcc > 1) {
          snowAcc--;
          gore.ambient(camX + rand(-12, 12), rand(6, 9), rand(-6, 3), rand(-0.3, 0.3), rand(-1.4, -0.8), '#ffffff', rand(0.05, 0.1), 7);
        }
      }
      cheer = Math.max(0, cheer - dt * 0.8);
      for (const c of tiers) {
        const ph = c.userData.ph as number;
        c.position.y = (c.userData.base as number) + Math.abs(Math.sin(t * (3 + cheer * 6) + ph)) * (0.05 + cheer * 0.35);
      }
      vorthax.position.y = 3.45 + 1.45 * 1.5 + Math.sin(t * 1.3) * 0.04;
      princess.rotation.z = Math.sin(t * 0.7) * 0.03;
    },
  };
}
