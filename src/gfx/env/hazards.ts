// Tegning av farer i brettene: piggrop, myr, råk i isen, lavapøl, piggfelle, juv, og i jungelen en kjøttetende plante
// og en steinvekt som henger over veien.
import * as THREE from 'three';
import { plainCanvas } from '../draw';
import { lit, toon, canvasTex, mergeStatic, applyShadows, stoneTex, woodTex } from './common';
import { icicles, ropeFence } from './props';
import { valueNoise3, fbm3 } from '../noise';
import { rand } from '../../core/math';
import type { Gore } from '../gore';
import { chasmHole, CHASM_FENCE, type HazardDef } from '../../data/hazards';
import { screenFX } from '../screenfx';

export interface HazardVisual {
  group: THREE.Group;
  update(dt: number, t: number): void;
  /** Piggfelle: 0 = nede, 1 = oppe. */
  setSpikes?(k: number): void;
  /** Planten: hvile, varsel (rister og gaper) eller glefs, og hvor langt i den (0 til 1). */
  setPlant?(phase: 'idle' | 'warn' | 'snap', k: number): void;
  /** Planten har nettopp spist noe: et ekstra glefs. */
  chomp?(): void;
  /** Steinvekta: høyden (1 oppe, 0 på veien) og knirket før den faller (0 til 1). */
  setDrop?(k: number, creak: number): void;
}

const texCache = new Map<string, THREE.Texture>();
function poolTex(key: string, inner: string, mid: string, outer: string, specks: string[] = [], rim?: string) {
  let t = texCache.get(key);
  if (t) return t;
  const cv = plainCanvas(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 10, 128, 128, 124);
    g.addColorStop(0, inner);
    g.addColorStop(0.6, mid);
    g.addColorStop(0.92, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    // Ujevn kant
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 118 + Math.sin(a * 5) * 4 + Math.cos(a * 3) * 3;
      if (i === 0) c.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      else c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    c.fill();
    for (const s of specks) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 95;
        c.fillStyle = s;
        c.beginPath();
        c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + Math.random() * 9, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (rim) {
      c.strokeStyle = rim;
      c.lineWidth = 6;
      c.beginPath();
      c.arc(128, 128, 114, 0, Math.PI * 2);
      c.stroke();
    }
  });
  t = canvasTex(cv, false);
  texCache.set(key, t);
  return t;
}

function pool(g: THREE.Group, h: HazardDef, tex: THREE.Texture, glowing: boolean, y = 0.02) {
  const mat = glowing ? new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }) : lit({ map: tex, alphaTest: 0.5 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h.w * 1.08, h.d * 1.25), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(h.x, y, h.z);
  m.renderOrder = 1;
  g.add(m);
  return m;
}

/** Mange like små ting (staker, pigger, steiner) som ett instansiert mesh. */
function instanced(g: THREE.Group, geo: THREE.BufferGeometry, color: string, list: THREE.Matrix4[]) {
  const m = new THREE.InstancedMesh(geo, toon(color), list.length);
  list.forEach((mat, i) => m.setMatrixAt(i, mat));
  g.add(m);
  return m;
}

const cone = new THREE.ConeGeometry(0.075, 0.8, 6);
cone.translate(0, 0.4, 0);
const tip = new THREE.ConeGeometry(0.045, 0.2, 6);
tip.translate(0, 0.72, 0);
const chunk = new THREE.DodecahedronGeometry(0.16, 0);

let chasmMat: THREE.MeshStandardMaterial | null = null;
let mistTex: THREE.Texture | null = null;

/**
 * Juvet: steinvegger ned i dypet (snø på kanten, svart nederst), istapper langs bakveggen, dis som driver nede i
 * juvet og taugjerde langs forkanten. Hullet i bakken og veien lager stageBase (Look.holes). Gir oppdateringen.
 */
function chasm(grp: THREE.Group, h: HazardDef) {
  const { x0, x1, z0, z1 } = chasmHole(h);
  const D = 10, w = x1 - x0, d = z1 - z0;
  const n3 = valueNoise3(Math.floor(rand(1, 999)));
  const rock = new THREE.Color('#6c768a'), deep = new THREE.Color('#080c16'), snow = new THREE.Color('#e6eef8');
  chasmMat ??= lit({ vertexColors: true, roughness: 0.95 }, { scale: 0.5, normal: 1.2, albedo: 0.35, snow: 0.5 });
  const wall = (W: number, seed: number) => {
    const geo = new THREE.PlaneGeometry(W, D, Math.max(4, Math.round(W * 2.5)), 26);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const col: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i);
      const depth = D / 2 - py;
      const n = fbm3(n3, px * 0.55 + seed, py * 0.3, seed * 0.7, 4);
      // Ingen utbuling ved kanten, så veggen møter hullet i bakken
      pos.setZ(i, (n - 0.5) * 1.1 * Math.min(1, depth / 1.5));
      c.copy(rock).multiplyScalar(0.45 + n * 0.7).lerp(deep, Math.min(1, depth / 7.5));
      if (depth < 0.35) c.lerp(snow, 0.85);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, chasmMat!);
    m.userData.noCast = true;
    return m;
  };
  const back = wall(w, 1);
  back.position.set(x0 + w / 2, -D / 2, z0);
  const left = wall(d, 7);
  left.rotation.y = Math.PI / 2;
  left.position.set(x0, -D / 2, z0 + d / 2);
  const right = wall(d, 13);
  right.rotation.y = -Math.PI / 2;
  right.position.set(x1, -D / 2, z0 + d / 2);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: deep }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(x0 + w / 2, -D, z0 + d / 2);
  grp.add(back, left, right, bottom);
  // Dis nede i juvet som driver sakte
  mistTex ??= canvasTex(plainCanvas(256, 64, (c) => {
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256, y = 20 + Math.random() * 24, r = 14 + Math.random() * 26;
      for (const dx of [-256, 0, 256]) {
        const gr = c.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.3)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gr;
        c.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
  }), false);
  const mists: THREE.Texture[] = [];
  for (const [y, op] of [[-3, 0.45], [-6, 0.6]] as const) {
    const t = mistTex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = w / 6;
    mists.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), new THREE.MeshBasicMaterial({ map: t, color: '#a8bcd6', transparent: true, opacity: op, depthWrite: false }));
    m.position.set(x0 + w / 2, y, z0 + d * 0.45);
    grp.add(m);
  }
  // Istapper langs bakveggen og taugjerde langs forkanten, slått sammen for seg
  const props = new THREE.Group();
  icicles(props, x0 + 0.3, x1 - 0.3, -0.02, z0 + 0.2, 2, 0.9);
  ropeFence(props, x0 + 0.2, x1 - 0.2, z1 + CHASM_FENCE, 1.0, 0.06);
  mergeStatic(props);
  applyShadows(props);
  grp.add(props);
  return (dt: number) => {
    for (let i = 0; i < mists.length; i++) mists[i].offset.x += dt * (i ? 0.012 : -0.02);
  };
}

let plantTex: THREE.Texture | null = null;

/**
 * Kjøttetende plante ved veikanten: blader ved roten, en tykk stilk og et hode med to kjever og tenner. Den svaier
 * når den hviler, trekker hodet bakover og gaper når den varsler, og glefser ned over farefeltet på veien.
 * Roten står bak feltet (eller foran, om feltet ligger foran midten), og stilken er ledd som legges langs en kurve.
 */
function maneater(grp: THREE.Group, gore: Gore, h: HazardDef): HazardVisual {
  plantTex ??= canvasTex(plainCanvas(128, 128, (c) => {
    c.fillStyle = '#3e6a22';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 60; i++) {
      c.fillStyle = Math.random() < 0.5 ? 'rgba(140,30,60,0.55)' : 'rgba(210,190,60,0.35)';
      c.beginPath();
      c.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 7, 0, Math.PI * 2);
      c.fill();
    }
  }), true);
  const side = h.z > 0.4 ? 1 : -1;
  const base = new THREE.Vector3(h.x, 0, h.z + side * (h.d / 2 + 0.55));
  const rest = new THREE.Vector3(h.x, 2.1, base.z - side * 0.5);
  const skin = lit({ map: plantTex, roughness: 0.6 });
  const inner = toon('#7a1020');
  const toothM = toon('#efe6c8');
  // Blader ved roten
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand(-0.2, 0.2);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), skin);
    leaf.scale.set(1.2, 0.12, 0.45);
    leaf.position.set(base.x + Math.cos(a) * 0.75, 0.12, base.z + Math.sin(a) * 0.6);
    leaf.rotation.y = -a;
    leaf.rotation.z = 0.25;
    grp.add(leaf);
  }
  // Stilken: ledd langs en kurve fra roten til hodet
  const SEG = 9;
  const stemGeo = new THREE.CylinderGeometry(0.13, 0.17, 1, 7);
  stemGeo.translate(0, 0.5, 0);
  const segs = Array.from({ length: SEG }, () => {
    const m = new THREE.Mesh(stemGeo, skin);
    grp.add(m);
    return m;
  });
  // Hodet: to halvkuler som kjever med hengsel bak, røde innsider og tenner langs kanten
  const head = new THREE.Group();
  const mkJaw = (up: boolean) => {
    const jaw = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, up ? 0 : Math.PI / 2, Math.PI / 2), skin);
    shell.scale.set(0.9, 0.62, 1.1);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), inner);
    mouth.rotation.x = up ? Math.PI / 2 : -Math.PI / 2;
    mouth.scale.set(0.9, 1.1, 1);
    mouth.position.y = up ? -0.01 : 0.01;
    shell.position.z = 0.5;
    mouth.position.z = 0.5;
    jaw.add(shell, mouth);
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI - Math.PI / 2;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 5), toothM);
      t.position.set(Math.sin(a) * 0.44, up ? -0.06 : 0.06, 0.5 + Math.cos(a) * 0.52);
      t.rotation.x = up ? Math.PI : 0;
      jaw.add(t);
    }
    head.add(jaw);
    return jaw;
  };
  const upper = mkJaw(true), lower = mkJaw(false);
  grp.add(head);
  applyShadows(grp);
  // Rødlig skjær på bakken der den glefser, sterkere når den varsler
  const mark = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: '#5a0a10', transparent: true, opacity: 0, depthWrite: false }));
  mark.rotation.x = -Math.PI / 2;
  mark.scale.set(h.w, h.d, 1);
  mark.position.set(h.x, 0.02, h.z);
  grp.add(mark);

  const target = new THREE.Vector3(h.x, 0.75, h.z);
  const pos = new THREE.Vector3(), aim = new THREE.Vector3();
  let phase: 'idle' | 'warn' | 'snap' = 'idle', k = 0, chompT = 0, t = 0;
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const curve = (u: number, out: THREE.Vector3) => {
    // Kvadratisk Bézier: roten, et punkt rett over roten og hodet
    const v = 1 - u;
    return out.set(0, 0, 0).addScaledVector(p0, v * v).addScaledVector(p1, 2 * v * u).addScaledVector(p2, u * u);
  };
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  return {
    group: grp,
    setPlant(p, kk) {
      phase = p;
      k = kk;
    },
    chomp() {
      chompT = 0.45;
    },
    update(dt) {
      t += dt;
      chompT = Math.max(0, chompT - dt);
      let open = 0.15 + Math.sin(t * 2.2) * 0.06;
      pos.copy(rest);
      pos.x += Math.sin(t * 0.9) * 0.15;
      pos.y += Math.sin(t * 1.3) * 0.08;
      aim.copy(target);
      if (phase === 'warn') {
        // Trekker hodet bakover og opp, snur gapet ut mot veien (og kameraet), rister og gaper
        pos.z += side * 0.45 * k;
        pos.y += 0.6 * k;
        pos.x += Math.sin(t * 38) * 0.06 * k;
        aim.y += 1.4 * k;
        aim.z -= side * 1.2 * k;
        open = 0.2 + 1.0 * k;
      } else if (phase === 'snap') {
        // Glefser ned over feltet og lukker kjevene
        const s = Math.sin(Math.min(1, k) * Math.PI);
        pos.lerp(target, s);
        open = 1.05 * (1 - Math.min(1, k * 2.2));
      }
      if (chompT > 0) {
        const s = Math.sin((chompT / 0.45) * Math.PI);
        pos.lerp(target, s * 0.85);
        open = Math.abs(Math.sin(chompT * 30)) * 0.8;
      }
      head.position.copy(pos);
      head.lookAt(aim);
      upper.rotation.x = -open * 0.6;
      lower.rotation.x = open * 0.35;
      (mark.material as THREE.MeshBasicMaterial).opacity = phase === 'warn' ? 0.15 + 0.3 * k : phase === 'snap' ? 0.4 : 0.06;
      // Stilken følger kurven fra roten til bak hodet
      p0.copy(base);
      p1.set(base.x, pos.y * 0.9 + 0.4, base.z);
      p2.copy(pos).addScaledVector(head.getWorldDirection(aim).multiplyScalar(1), -0.35);
      for (let i = 0; i < SEG; i++) {
        curve(i / SEG, a);
        curve((i + 1) / SEG, b);
        const m = segs[i];
        m.position.copy(a);
        const d = b.clone().sub(a);
        const len = d.length();
        q.setFromUnitVectors(up, d.normalize());
        m.quaternion.copy(q);
        const r = 1 - i / SEG * 0.45;
        m.scale.set(r, len, r);
      }
    },
  };
}

/**
 * Steinvekt over veien: en tykk stokk står bak veien med en gren som går ut over feltet, og en stor stein henger i et
 * tau fra grenen. Den knirker og rister før den faller (og en skygge mørkner på veien), ligger litt, og heises opp.
 */
function deadfall(grp: THREE.Group, gore: Gore, h: HazardDef): HazardVisual {
  const postZ = Math.min(h.z - 3.2, -3.6);
  const beamY = 5.8;
  const wood = lit({ map: woodTex(), color: '#7a6a52' });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, beamY + 0.6, 8), wood);
  post.position.set(h.x - 0.9, (beamY + 0.6) / 2, postZ);
  const beamLen = h.z - postZ + 0.6;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, beamLen, 7), wood);
  beam.rotation.x = Math.PI / 2;
  beam.rotation.z = 0.35;
  beam.position.set(h.x - 0.45, beamY, postZ + beamLen / 2 - 0.2);
  // Lianer rundt stokken
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 5, 12), toon('#3e6a2a'));
    v.position.set(h.x - 0.9, 1.4 + i * 1.6, postZ);
    v.rotation.set(Math.PI / 2 + rand(-0.3, 0.3), 0, rand(-0.3, 0.3));
    grp.add(v);
  }
  const stone = lit({ map: stoneTex('#7c7a6a', '#4a4a3e', 48, 32), color: '#c8c8b0' });
  const block = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 1.25), stone);
  rock.position.y = 0.525;
  block.add(rock);
  // Mose på toppen og et tau rundt
  const moss = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.05), toon('#4a6a2a'));
  moss.position.y = 1.07;
  block.add(moss);
  for (const dx of [-0.45, 0.45]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 1.3), toon('#8a7048'));
    band.position.set(dx, 0.525, 0);
    block.add(band);
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), toon('#9a8058'));
  grp.add(post, beam, block, rope);
  applyShadows(grp);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.1, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(h.w * 1.1, h.d * 1.1, 1);
  shadow.position.set(h.x, 0.025, h.z);
  grp.add(shadow);
  let y = 1, creak = 0, t = 0;
  const place = () => {
    const by = 0.02 + y * 3.9;
    block.position.set(h.x + (creak > 0 ? Math.sin(t * 47) * 0.04 * creak : 0), by, h.z);
    block.rotation.z = creak > 0 ? Math.sin(t * 31) * 0.05 * creak : Math.sin(t * 0.8) * 0.02;
    const top = by + 1.05;
    rope.scale.y = Math.max(0.05, beamY - top);
    rope.position.set(h.x, top + (beamY - top) / 2, h.z);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.35 * creak + (y < 0.05 ? 0.25 : 0);
  };
  place();
  return {
    group: grp,
    setDrop(k, c) {
      y = k;
      creak = c;
    },
    update(dt) {
      t += dt;
      place();
      if (creak > 0 && Math.random() < dt * 12) gore.ambient(h.x + rand(-0.6, 0.6), 0.02 + y * 3.9, h.z + rand(-0.4, 0.4), 0, -1, '#b8a888', rand(0.03, 0.06), 1.2, false, 6);
    },
  };
}

export function buildHazard(g: THREE.Group, gore: Gore, h: HazardDef): HazardVisual {
  const grp = new THREE.Group();
  g.add(grp);
  if (h.kind === 'chasm') {
    const update = chasm(grp, h);
    return { group: grp, update };
  }
  if (h.kind === 'maneater') return maneater(grp, gore, h);
  if (h.kind === 'deadfall') return deadfall(grp, gore, h);
  const inside = (fx: number, fz: number) => (fx * fx) / 0.25 + (fz * fz) / 0.25 <= 0.85;
  switch (h.kind) {
    case 'spikes': {
      pool(grp, h, poolTex('pit', '#0a0503', '#1e120a', '#3a2616', ['rgba(120,10,10,0.5)']), false);
      const mats: THREE.Matrix4[] = [];
      for (let x = -0.5; x <= 0.5; x += 0.14)
        for (let z = -0.5; z <= 0.5; z += 0.28) {
          if (!inside(x, z)) continue;
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(h.x + x * h.w + rand(-0.06, 0.06), -0.05, h.z + z * h.d + rand(-0.05, 0.05)),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.2, 0.2), 0, rand(-0.25, 0.25))),
            new THREE.Vector3(1, rand(0.8, 1.2), 1),
          );
          mats.push(m);
        }
      instanced(grp, cone, '#8a5a2b', mats);
      instanced(grp, tip, '#9e1020', mats);
      break;
    }
    case 'bog': {
      const tex = poolTex('bog', '#2f3a14', '#4a5320', '#5f5a2a', ['rgba(120,140,40,0.45)', 'rgba(20,30,8,0.5)']);
      const m = pool(grp, h, tex, false);
      let acc = 0;
      return {
        group: grp,
        update(dt, t) {
          m.rotation.z = Math.sin(t * 0.3) * 0.05;
          acc += dt;
          if (acc > 0.25) {
            acc = 0;
            gore.ambient(h.x + rand(-h.w * 0.4, h.w * 0.4), 0.05, h.z + rand(-h.d * 0.35, h.d * 0.35), 0, 0.5, '#8fa040', rand(0.08, 0.18), 0.5, false, -0.5);
          }
        },
      };
    }
    case 'icehole': {
      pool(grp, h, poolTex('ice', '#061426', '#0e2f55', '#3f7cb0', ['rgba(160,210,255,0.25)'], '#e8f4ff'), false);
      const mats: THREE.Matrix4[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        mats.push(new THREE.Matrix4().compose(
          new THREE.Vector3(h.x + Math.cos(a) * h.w * 0.54, 0.04, h.z + Math.sin(a) * h.d * 0.64),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)),
          new THREE.Vector3(rand(0.8, 1.5), rand(0.4, 0.7), rand(0.8, 1.4)),
        ));
      }
      instanced(grp, chunk, '#eaf6ff', mats);
      break;
    }
    case 'lava': {
      const tex = poolTex('lava', '#fff2a0', '#ffb02e', '#ff4a10', ['rgba(255,255,200,0.5)', 'rgba(160,30,0,0.45)']);
      const m = pool(grp, h, tex, true);
      const mats: THREE.Matrix4[] = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        mats.push(new THREE.Matrix4().compose(
          new THREE.Vector3(h.x + Math.cos(a) * h.w * 0.55, 0.05, h.z + Math.sin(a) * h.d * 0.66),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)),
          new THREE.Vector3(rand(0.9, 1.6), rand(0.5, 0.9), rand(0.9, 1.5)),
        ));
      }
      instanced(grp, chunk, '#2a2228', mats);
      // Lufta over lavapølen dirrer (varmeflimmer, gfx/screenfx.ts)
      screenFX.addHeat(new THREE.Vector3(h.x, 0.1, h.z), Math.max(h.w, h.d) * 0.45, 0.8);
      let acc = 0;
      const mat = m.material as THREE.MeshBasicMaterial;
      return {
        group: grp,
        update(dt, t) {
          mat.color.setScalar(0.85 + Math.sin(t * 3) * 0.15);
          acc += dt;
          if (acc > 0.12) {
            acc = 0;
            gore.fire(new THREE.Vector3(h.x + rand(-h.w * 0.4, h.w * 0.4), 0.1, h.z + rand(-h.d * 0.3, h.d * 0.3)), 1, 0.1, 1.4);
          }
        },
      };
    }
    case 'spiketrap': {
      const tex = texCache.get('grate') ?? canvasTex(plainCanvas(128, 128, (c) => {
        c.fillStyle = '#3a3a44';
        c.fillRect(0, 0, 128, 128);
        c.strokeStyle = '#15151a';
        c.lineWidth = 6;
        for (let i = 0; i <= 128; i += 21) {
          c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke();
          c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke();
        }
        c.strokeStyle = '#8a1010';
        c.lineWidth = 4;
        c.strokeRect(2, 2, 124, 124);
      }), false);
      texCache.set('grate', tex);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(h.w, h.d), lit({ map: tex }));
      plate.rotation.x = -Math.PI / 2;
      plate.position.set(h.x, 0.015, h.z);
      grp.add(plate);
      const spikes = new THREE.Group();
      const mats: THREE.Matrix4[] = [];
      for (let x = -0.42; x <= 0.42; x += 0.14)
        for (let z = -0.42; z <= 0.42; z += 0.2) mats.push(new THREE.Matrix4().makeTranslation(x * h.w, 0, z * h.d));
      instanced(spikes, cone, '#c9d3de', mats);
      spikes.position.set(h.x, -0.9, h.z);
      grp.add(spikes);
      return {
        group: grp,
        update() {},
        setSpikes(k: number) {
          spikes.position.y = -0.9 + k * 0.9;
          spikes.visible = k > 0.02;
        },
      };
    }
  }
  return { group: grp, update() {} };
}
