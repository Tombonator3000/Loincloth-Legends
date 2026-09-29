// Rigg for firbente (og tobente) ridedyr: kropp, hode, hale og bein som egne plan med pivot i leddet.
import * as THREE from 'three';
import { unitCanvas } from './draw';
import { getOverride } from './assets';
import { partMaterial } from './rig';
import { damp } from '../core/math';
import type { BeastDef } from './chars/beasts';
import type { PartDef } from './chars/types';

export interface BeastPose {
  head: number;
  tail: number;
  /** Beinpar A (nær foran + fjern bak) og B (fjern foran + nær bak). */
  legA: number;
  legB: number;
  bodyY: number;
  tilt: number;
}
export const BEAST_NEUTRAL: BeastPose = { head: 0, tail: 0, legA: 0, legB: 0, bodyY: 0, tilt: 0 };
const KEYS = Object.keys(BEAST_NEUTRAL) as (keyof BeastPose)[];

type Part = 'legFF' | 'legBF' | 'tail' | 'body' | 'head' | 'legFN' | 'legBN';

const cache = new Map<string, { tex: THREE.Texture; geo: THREE.PlaneGeometry }>();
function asset(def: BeastDef, key: string, pd: PartDef) {
  const k = def.id + ':' + key;
  let a = cache.get(k);
  if (!a) {
    const ov = getOverride(def.id, key);
    if (ov) pd = { w: ov.w, h: ov.h, ox: ov.ox, oy: ov.oy, draw: () => {} };
    const cv = ov ? ov.canvas : unitCanvas(pd.w, pd.h, pd.ox, pd.oy, 140, pd.draw);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(pd.w, pd.h);
    geo.translate(pd.w / 2 - pd.ox, pd.h / 2 - pd.oy, 0);
    a = { tex, geo };
    cache.set(k, a);
  }
  return a;
}

export class BeastRig {
  root = new THREE.Group();
  body = new THREE.Group();
  g = {} as Record<Part, THREE.Group>;
  mats: THREE.ShaderMaterial[] = [];
  pose: BeastPose = { ...BEAST_NEUTRAL };
  facing = 1;
  scale: number;
  private flashV = 0;

  constructor(public def: BeastDef, public tint: [number, number, number] = [1, 1, 1]) {
    this.scale = def.scale;
    this.root.add(this.body);
    this.body.position.y = def.bodyY;
    const J = def.joints;
    const mk = (name: Part, key: string, pd: PartDef, x: number, y: number, z: number, shade = 1) => {
      const a = asset(def, key, pd);
      const m = partMaterial(a.tex, shade);
      m.uniforms.tint.value.setRGB(shade * tint[0], shade * tint[1], shade * tint[2]);
      this.mats.push(m);
      const mesh = new THREE.Mesh(a.geo, m);
      mesh.frustumCulled = false;
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      grp.add(mesh);
      this.body.add(grp);
      this.g[name] = grp;
    };
    if (def.legs === 4) {
      mk('legFF', 'leg', def.leg, J.legF[0] - 0.12, J.legF[1], -0.03, 0.72);
      mk('legBF', 'leg', def.leg, J.legB[0] - 0.12, J.legB[1], -0.03, 0.72);
    } else {
      mk('legFF', 'leg', def.leg, J.legB[0], J.legB[1], -0.03, 0.72);
    }
    mk('tail', 'tail', def.tail, J.tail[0], J.tail[1], -0.012);
    mk('body', 'body', def.body, 0, 0, 0);
    mk('head', 'head', def.head, J.head[0], J.head[1], 0.012);
    mk('legFN', 'leg', def.leg, J.legF[0], J.legF[1], 0.024);
    if (def.legs === 4) mk('legBN', 'leg', def.leg, J.legB[0], J.legB[1], 0.024);
    this.setFacing(1);
    this.sync();
  }

  setFacing(f: number) {
    this.facing = f < 0 ? -1 : 1;
    this.root.scale.set(this.facing * this.scale, this.scale, this.scale);
  }

  set flash(v: number) {
    if (Math.abs(v - this.flashV) < 0.001) return;
    this.flashV = v;
    for (const m of this.mats) m.uniforms.flash.value = v;
  }

  drive(target: Partial<BeastPose>, speed: number, dt: number) {
    for (const k of KEYS) this.pose[k] = damp(this.pose[k], target[k] ?? BEAST_NEUTRAL[k], speed, dt);
  }

  sync() {
    const p = this.pose;
    const g = this.g;
    g.head.rotation.z = p.head;
    g.tail.rotation.z = p.tail;
    g.legFN.rotation.z = p.legA;
    g.legFF.rotation.z = this.def.legs === 4 ? p.legB : -p.legA;
    if (g.legBN) g.legBN.rotation.z = p.legB;
    if (g.legBF) g.legBF.rotation.z = p.legA;
    this.body.position.y = this.def.bodyY + p.bodyY;
    this.body.rotation.z = p.tilt;
  }

  /** Verdensposisjon for et punkt i kroppens lokale rom. */
  worldPoint(x: number, y: number, part: Part = 'body', out = new THREE.Vector3()) {
    out.set(x, y, 0);
    this.root.updateMatrixWorld(true);
    return this.g[part].localToWorld(out);
  }

  dispose() {
    for (const m of this.mats) m.dispose();
    this.root.removeFromParent();
  }
}
