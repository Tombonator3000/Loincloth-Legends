// 3D-verdenskart: malt terreng med biomer, små 3D-rekvisitter, stier og nodemarkører.
import * as THREE from 'three';
import { plainCanvas, unitCanvas, INK } from '../draw';
import { rand, pick } from '../../core/math';
import { images } from '../assets';
import type { Gore } from '../gore';
import { M, toon, canvasTex, skullMat } from './common';
import { MAP_NODES, MAP_EDGES, nodeById, type MapNode } from '../../data/worldmap';

export const MAP_W = 48;
export const MAP_D = 32;

export interface NodeMarker { node: MapNode; group: THREE.Group; flag: THREE.Mesh; ring: THREE.Mesh; state: 'locked' | 'open' | 'done' }

const BIOME_COL: Record<string, [string, string[]]> = {
  grass: ['#6f8a3a', ['#7d9a42', '#5f7a30', '#86a04a']],
  swamp: ['#5a5e3a', ['#4a5030', '#6a6a40', '#3e4a2e']],
  frost: ['#dfe9f2', ['#ffffff', '#cad8e6', '#e8f0f6']],
  scorch: ['#3a2622', ['#4a2a22', '#2a1a18', '#5a3020']],
  tower: ['#2e2238', ['#3a2a48', '#241a2e', '#4a3458']],
};

function paintMap() {
  const Wd = 1536, Hd = 1024;
  return plainCanvas(Wd, Hd, (c) => {
    const px = (x: number) => ((x + MAP_W / 2) / MAP_W) * Wd;
    const pz = (z: number) => ((z + MAP_D / 2) / MAP_D) * Hd;
    // Hav
    c.fillStyle = '#2a4a6a';
    c.fillRect(0, 0, Wd, Hd);
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 3;
    for (let i = 0; i < 120; i++) {
      const x = rand(0, Wd), y = rand(0, Hd);
      c.beginPath();
      c.arc(x, y, rand(6, 14), Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
    }
    // Øya
    const islandPath = (inset: number) => {
      c.beginPath();
      const n = 60;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rx = Wd * 0.47 - inset, ry = Hd * 0.44 - inset;
        const wob = 1 + 0.05 * Math.sin(a * 5) + 0.03 * Math.sin(a * 11 + 1);
        const x = Wd / 2 + Math.cos(a) * rx * wob, y = Hd / 2 + Math.sin(a) * ry * wob;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
    };
    c.fillStyle = '#d8c08a';
    islandPath(0);
    c.fill();
    c.fillStyle = BIOME_COL.grass[0];
    islandPath(18);
    c.fill();
    c.save();
    islandPath(18);
    c.clip();
    // Biomflekker rundt nodene
    const blob = (x: number, z: number, r: number, col: string) => {
      c.fillStyle = col;
      c.beginPath();
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (0.8 + 0.25 * Math.sin(a * 3 + x) + 0.1 * Math.sin(a * 7 + z));
        const X = px(x) + Math.cos(a) * rr, Y = pz(z) + Math.sin(a) * rr * 0.9;
        if (i === 0) c.moveTo(X, Y);
        else c.lineTo(X, Y);
      }
      c.fill();
    };
    blob(0, 9, 300, BIOME_COL.swamp[0]);
    blob(4, 11, 200, BIOME_COL.swamp[0]);
    blob(-2, -8, 330, BIOME_COL.frost[0]);
    blob(-6, -11, 220, BIOME_COL.frost[0]);
    blob(11, 3, 260, BIOME_COL.scorch[0]);
    blob(12, 9, 180, BIOME_COL.scorch[0]);
    blob(18, -4, 240, BIOME_COL.tower[0]);
    for (const [b, [, specks]] of Object.entries(BIOME_COL)) {
      const nodes = MAP_NODES.filter((n) => n.biome === b);
      for (const nd of nodes)
        for (let i = 0; i < 90; i++) {
          c.fillStyle = pick(specks);
          c.beginPath();
          c.ellipse(px(nd.pos[0]) + rand(-220, 220), pz(nd.pos[1]) + rand(-160, 160), rand(3, 10), rand(2, 6), 0, 0, Math.PI * 2);
          c.fill();
        }
    }
    // Elv fra fjellet til sumpen
    c.strokeStyle = '#3a6a9a';
    c.lineWidth = 16;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(px(-6), pz(-14));
    c.bezierCurveTo(px(-4), pz(-4), px(-12), pz(2), px(-6), pz(8));
    c.bezierCurveTo(px(-3), pz(12), px(1), pz(13), px(3), pz(16));
    c.stroke();
    // Lavaelv
    c.strokeStyle = '#ff6a1a';
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(px(9), pz(-2));
    c.bezierCurveTo(px(12), pz(4), px(8), pz(8), px(14), pz(14));
    c.stroke();
    c.restore();
  });
}

function flagMat(col: string, skull: boolean) {
  const t = canvasTex(unitCanvas(0.8, 0.5, 0, 0.25, 128, (p) => {
    p.poly([0, 0.22, 0.76, 0.12, 0.62, 0.0, 0.76, -0.14, 0, -0.22], col);
    if (skull) {
      p.ell(0.3, 0.02, 0.09, 0.09, '#efe8d2');
      p.ell(0.27, 0.03, 0.02, 0.025, INK, false);
      p.ell(0.33, 0.03, 0.02, 0.025, INK, false);
    }
  }), false);
  return new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
}

export function buildWorldMap(scene: THREE.Scene, gore: Gore) {
  const g = new THREE.Group();
  scene.background = new THREE.Color('#1a2a3a');
  scene.fog = new THREE.Fog('#1a2a3a', 40, 90);
  g.add(new THREE.HemisphereLight('#fff0d8', '#3a3040', 1.7));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4);
  sun.position.set(-10, 30, 20);
  g.add(sun);

  const tex = canvasTex(images.map ?? paintMap(), false);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_D), toon('#ffffff', tex));
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#2a4a6a' }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.05;
  g.add(sea);

  // Rekvisitter per biom
  const decor = (x0: number, x1: number, z0: number, z1: number, n: number, fn: (x: number, z: number) => void) => {
    for (let i = 0; i < n; i++) {
      const x = rand(x0, x1), z = rand(z0, z1);
      if ((x / 21) ** 2 + (z / 13.6) ** 2 > 0.82) continue;
      if (MAP_NODES.some((nd) => Math.hypot(nd.pos[0] - x, nd.pos[1] - z) < 2.2)) continue;
      fn(x, z);
    }
  };
  const tree = (x: number, z: number) => {
    const s = rand(0.5, 0.9);
    g.add(M(new THREE.CylinderGeometry(0.08 * s, 0.1 * s, 0.6 * s, 5), '#5a3a20', x, 0.3 * s, z, 0.06));
    g.add(M(new THREE.SphereGeometry(0.45 * s, 8, 6), pick(['#4f7a2a', '#5f8a32', '#3f6a22']), x, 0.8 * s, z, 0.06));
  };
  const pine = (x: number, z: number) => {
    const s = rand(0.5, 0.9);
    const c = M(new THREE.ConeGeometry(0.4 * s, 1.2 * s, 6), '#2f5a3a', x, 0.6 * s, z, 0.06);
    c.add(M(new THREE.ConeGeometry(0.25 * s, 0.5 * s, 6), '#ffffff', 0, 0.35 * s, 0, 0));
    g.add(c);
  };
  const mountain = (x: number, z: number) => {
    const h = rand(1.8, 3.6);
    const m = M(new THREE.ConeGeometry(rand(1.2, 2), h, 6), pick(['#8a9ab0', '#7a8aa4']), x, h / 2, z, 0.04);
    m.add(M(new THREE.ConeGeometry(0.6, h * 0.35, 6), '#ffffff', 0, h * 0.33, 0, 0));
    g.add(m);
  };
  const deadT = (x: number, z: number) => {
    const s = rand(0.5, 0.9);
    const t = M(new THREE.CylinderGeometry(0.05 * s, 0.1 * s, 1.2 * s, 5), '#3a3226', x, 0.6 * s, z, 0.06);
    t.rotation.z = rand(-0.2, 0.2);
    g.add(t);
  };
  const spike = (x: number, z: number) => {
    const h = rand(0.5, 1.4);
    g.add(M(new THREE.ConeGeometry(0.25, h, 5), '#1a1418', x, h / 2, z, 0.05));
  };
  decor(-22, -5, -4, 14, 40, tree);
  decor(-12, 8, -15, -3, 16, mountain);
  decor(-12, 8, -15, -2, 26, pine);
  decor(-6, 9, 4, 15, 26, deadT);
  decor(6, 15, -2, 14, 22, spike);

  // Vulkan
  const volc = M(new THREE.CylinderGeometry(0.8, 3, 4, 10), '#3a2226', 13.5, 2, -1.5, 0.04);
  g.add(volc);
  const lavaTop = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12), new THREE.MeshBasicMaterial({ color: '#ff7a1a' }));
  lavaTop.rotation.x = -Math.PI / 2;
  lavaTop.position.set(13.5, 4.02, -1.5);
  g.add(lavaTop);

  // Stier
  const dotGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8);
  const pathDots: { mesh: THREE.Mesh; a: string; b: string }[] = [];
  for (const [a, b] of MAP_EDGES) {
    const A = nodeById(a)!, B = nodeById(b)!;
    const len = Math.hypot(B.pos[0] - A.pos[0], B.pos[1] - A.pos[1]);
    const n = Math.floor(len / 0.7);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const d = new THREE.Mesh(dotGeo, toon('#f1d27a'));
      d.position.set(A.pos[0] + (B.pos[0] - A.pos[0]) * t, 0.05, A.pos[1] + (B.pos[1] - A.pos[1]) * t);
      g.add(d);
      pathDots.push({ mesh: d, a, b });
    }
  }

  // Noder
  const markers = new Map<string, NodeMarker>();
  const matOpen = flagMat('#e8b83a', false);
  const matDone = flagMat('#b3001b', true);
  const matLocked = flagMat('#6a6a6a', false);
  for (const nd of MAP_NODES) {
    const grp = new THREE.Group();
    grp.position.set(nd.pos[0], 0, nd.pos[1]);
    if (nd.kind === 'arena') {
      const ring = M(new THREE.TorusGeometry(0.9, 0.28, 8, 20), '#8a7a70', 0, 0.28, 0, 0.05);
      ring.rotation.x = Math.PI / 2;
      grp.add(ring);
      const sand = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), toon('#c8a86a'));
      sand.rotation.x = -Math.PI / 2;
      sand.position.y = 0.1;
      grp.add(sand);
    } else if (nd.kind === 'home') {
      grp.add(M(new THREE.BoxGeometry(1.4, 1.0, 1.0), '#8f98a6', 0, 0.5, 0, 0.05));
      for (const dx of [-0.7, 0.7]) {
        const t = M(new THREE.CylinderGeometry(0.28, 0.3, 1.6, 8), '#8f98a6', dx, 0.8, 0, 0.05);
        t.add(M(new THREE.ConeGeometry(0.38, 0.6, 8), '#8e2a2a', 0, 1.1, 0, 0.05));
        grp.add(t);
      }
    } else if (nd.id === 'tower') {
      const t = M(new THREE.CylinderGeometry(0.5, 0.8, 5, 8), '#3a2a48', 0, 2.5, 0, 0.05);
      t.add(M(new THREE.ConeGeometry(0.8, 1.6, 8), '#5b2a86', 0, 3.3, 0, 0.05));
      grp.add(t);
    } else {
      grp.add(M(new THREE.CylinderGeometry(0.6, 0.75, 0.3, 10), '#8a7a70', 0, 0.15, 0, 0.05));
    }
    const pole = M(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), '#3a2616', nd.kind === 'home' ? 0 : 0.5, 0.8, 0, 0.06);
    if (nd.kind === 'home' || nd.id === 'tower') pole.visible = false;
    grp.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), matOpen);
    flag.position.set(0.9, 1.35, 0);
    if (nd.kind === 'home' || nd.id === 'tower') flag.visible = false;
    grp.add(flag);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 28), new THREE.MeshBasicMaterial({ color: '#f1d27a', transparent: true, opacity: 0.6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    grp.add(ring);
    if (nd.kind === 'arena') {
      const sk = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), skullMat());
      sk.position.set(0, 1.0, 0.2);
      grp.add(sk);
    }
    g.add(grp);
    markers.set(nd.id, { node: nd, group: grp, flag, ring, state: 'open' });
  }
  scene.add(g);

  const setStates = (completed: Set<string>) => {
    for (const mk of markers.values()) {
      const nd = mk.node;
      const open = nd.requires.every((r) => completed.has(r));
      mk.state = completed.has(nd.id) ? 'done' : open ? 'open' : 'locked';
      mk.flag.material = mk.state === 'done' ? matDone : mk.state === 'open' ? matOpen : matLocked;
      mk.ring.visible = mk.state === 'open';
      mk.group.scale.setScalar(mk.state === 'locked' ? 0.8 : 1);
    }
    for (const d of pathDots) {
      const ok = [d.a, d.b].every((id) => markers.get(id)!.state !== 'locked');
      d.mesh.material = toon(ok ? '#f1d27a' : '#6a6458');
    }
  };

  let acc = 0;
  return {
    group: g,
    markers,
    setStates,
    update(dt: number, t: number) {
      for (const mk of markers.values()) {
        mk.flag.rotation.y = Math.sin(t * 3 + mk.node.pos[0]) * 0.25;
        if (mk.ring.visible) {
          const s = 1 + Math.sin(t * 4) * 0.08;
          mk.ring.scale.set(s, s, s);
        }
      }
      acc += dt;
      if (acc > 0.08) {
        acc = 0;
        gore.fire(new THREE.Vector3(13.5 + rand(-0.4, 0.4), 4.1, -1.5), 1, 0.2, 1.5);
        if (Math.random() < 0.05) gore.flare(new THREE.Vector3(17.5, 6, -4), 2, '#c080ff', 0.2);
      }
    },
  };
}
