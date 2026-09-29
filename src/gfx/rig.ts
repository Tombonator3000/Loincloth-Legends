// Cutout-rigg: hver kroppsdel er et eget plan med pivot i leddet.
// Gjør animasjon enkel (vinkler per ledd) og lemlestelse gratis (løsne en gruppe).
import * as THREE from 'three';
import { getChar, type CharDef, type CharId, type PartDef, type PartName } from './chars';
import { unitCanvas } from './draw';
import { getOverride } from './assets';
import { damp } from '../core/math';

const PPU = 150;

type Asset = { tex: THREE.Texture; geo: THREE.PlaneGeometry; canvas: HTMLCanvasElement };
const cache = new Map<string, Asset>();

export function partAsset(ch: CharDef, key: string, def: PartDef): Asset {
  const k = ch.id + ':' + key;
  let a = cache.get(k);
  if (!a) {
    const src = ch.inherit?.[key as keyof NonNullable<CharDef['inherit']>];
    const ov = getOverride(ch.id, key) ?? (src ? getOverride(src, key) : undefined);
    if (ov) def = { w: ov.w, h: ov.h, ox: ov.ox, oy: ov.oy, draw: () => {} };
    const cv = ov ? ov.canvas : unitCanvas(def.w, def.h, def.ox, def.oy, PPU, def.draw);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const geo = new THREE.PlaneGeometry(def.w, def.h);
    geo.translate(def.w / 2 - def.ox, def.h / 2 - def.oy, 0);
    a = { tex, geo, canvas: cv };
    cache.set(k, a);
  }
  return a;
}

export function headCanvas(id: CharId) {
  const ch = getChar(id);
  return partAsset(ch, 'head', ch.head).canvas;
}

const tintedHeads = new Map<string, HTMLCanvasElement>();
/** Hodets tegning med fargetone (brukes når hodet klasker i skjermen). */
export function headImage(id: CharId, tint?: [number, number, number], flip = false) {
  const k = id + (tint ? tint.join(',') : '') + (flip ? 'f' : '');
  let cv = tintedHeads.get(k);
  if (cv) return cv;
  const src = headCanvas(id);
  cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const c = cv.getContext('2d')!;
  if (flip) {
    c.translate(cv.width, 0);
    c.scale(-1, 1);
  }
  c.drawImage(src, 0, 0);
  if (tint) {
    const to255 = (v: number) => Math.round(Math.min(1, v) * 255);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = `rgb(${to255(tint[0])},${to255(tint[1])},${to255(tint[2])})`;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(src, 0, 0);
  }
  tintedHeads.set(k, cv);
  return cv;
}

/** Fjern teksturer for en figur (brukes når heltebyggeren lager en ny variant). */
export function purgeChar(id: CharId) {
  for (const [k, a] of cache) {
    if (!k.startsWith(id + ':')) continue;
    a.tex.dispose();
    a.geo.dispose();
    cache.delete(k);
  }
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 tint;
uniform float flash;
uniform vec3 flashColor;
uniform float opacity;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.06) discard;
  vec3 col = c.rgb * tint;
  col = mix(col, flashColor, flash);
  gl_FragColor = vec4(col, c.a * opacity);
}`;

export function partMaterial(tex: THREE.Texture, tint = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: tex },
      tint: { value: new THREE.Color(tint, tint, tint) },
      flash: { value: 0 },
      flashColor: { value: new THREE.Color(1, 1, 1) },
      opacity: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    transparent: false,
  });
}

export interface Pose {
  torso: number;
  head: number;
  armF: number;
  armB: number;
  legF: number;
  legB: number;
  weapon: number;
  bodyY: number;
  bodyX: number;
  tilt: number;
  lift: number;
}

export const NEUTRAL: Pose = { torso: -0.05, head: 0.05, armF: 0.5, armB: -0.3, legF: 0.22, legB: -0.22, weapon: -1.3, bodyY: -0.03, bodyX: 0, tilt: 0, lift: 0 };
const KEYS = Object.keys(NEUTRAL) as (keyof Pose)[];

const Z: Record<PartName, number> = { armB: -0.018, legB: -0.012, torso: 0, legF: 0.006, pelvis: 0.012, head: 0.018, weapon: -0.006, armF: 0.03 };
const ORDER: PartName[] = ['legB', 'torso', 'armB', 'legF', 'pelvis', 'head', 'armF', 'weapon'];

export class Rig {
  root = new THREE.Group();
  tilt = new THREE.Group();
  body = new THREE.Group();
  g = {} as Record<PartName, THREE.Group>;
  mats: THREE.ShaderMaterial[] = [];
  pose: Pose = { ...NEUTRAL };
  facing = 1;
  scale: number;
  detached = new Set<PartName>();
  private flashV = 0;

  constructor(public def: CharDef, scaleMul = 1, public tint: [number, number, number] = [1, 1, 1]) {
    this.scale = def.scale * scaleMul;
    this.root.add(this.tilt);
    this.tilt.add(this.body);
    this.body.position.y = def.hipY;
    for (const n of ORDER) if (n !== 'weapon' || def.weapon) this.mkPart(n);
    this.setFacing(1);
    this.sync();
  }

  /** Lag (eller gjenskap) en kroppsdel med riktig ledd og forelder. */
  private mkPart(name: PartName) {
    const def = this.def;
    const J = def.joints;
    const spec: Record<PartName, [string, PartDef | undefined, THREE.Object3D | undefined, [number, number], number]> = {
      legB: ['leg', def.leg, this.body, J.hipB, 0.78],
      torso: ['torso', def.torso, this.body, [0, 0], 1],
      armB: ['arm', def.arm, this.g.torso, J.shB, 0.74],
      legF: ['leg', def.leg, this.body, J.hipF, 1],
      pelvis: ['pelvis', def.pelvis, this.body, [0, 0], 1],
      head: ['head', def.head, this.g.torso, J.neck, 1],
      armF: ['arm', def.arm, this.g.torso, J.shF, 1],
      weapon: ['weapon', def.weapon, this.g.armF, J.hand, 1],
    };
    const [key, pd, parent, [x, y], tint] = spec[name];
    if (!pd || !parent) return null;
    const a = partAsset(def, key, pd);
    const m = partMaterial(a.tex, tint);
    m.userData.shade = tint;
    m.uniforms.tint.value.setRGB(tint * this.tint[0], tint * this.tint[1], tint * this.tint[2]);
    m.uniforms.flash.value = this.flashV;
    this.mats.push(m);
    const mesh = new THREE.Mesh(a.geo, m);
    mesh.frustumCulled = false;
    const grp = new THREE.Group();
    grp.position.set(x, y, Z[name]);
    grp.add(mesh);
    parent.add(grp);
    this.g[name] = grp;
    return grp;
  }

  /** Gro ut igjen en del som er kappet av eller skjult (kyllingen har helbredende krefter). */
  restore(name: PartName) {
    if (!this.detached.has(name)) return false;
    const g = this.g[name];
    if (g && g.parent && !g.visible && this.isOwnPart(g)) g.visible = true;
    else this.mkPart(name);
    this.detached.delete(name);
    if (name === 'armF' && this.def.weapon) {
      this.detached.delete('weapon');
      if (!this.g.weapon || !this.isOwnPart(this.g.weapon)) this.mkPart('weapon');
    }
    this.sync();
    return true;
  }

  private isOwnPart(g: THREE.Object3D) {
    let o: THREE.Object3D | null = g;
    while (o) {
      if (o === this.root) return true;
      o = o.parent;
    }
    return false;
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
  get flash() {
    return this.flashV;
  }

  /** Bytt fargetone på hele figuren (forkullet, frossen osv.). */
  setTint(t: [number, number, number]) {
    this.tint = t;
    for (const m of this.mats) {
      const sh = (m.userData.shade as number) ?? 1;
      m.uniforms.tint.value.setRGB(sh * t[0], sh * t[1], sh * t[2]);
    }
  }

  setFlashColor(r: number, g: number, b: number) {
    for (const m of this.mats) m.uniforms.flashColor.value.setRGB(r, g, b);
  }

  set opacity(v: number) {
    for (const m of this.mats) m.uniforms.opacity.value = v;
  }

  /** Demp alle leddvinkler mot målposen. */
  drive(target: Partial<Pose>, speed: number, dt: number) {
    for (const k of KEYS) {
      const t = target[k] ?? NEUTRAL[k];
      this.pose[k] = damp(this.pose[k], t, speed, dt);
    }
  }

  snap(target: Partial<Pose>) {
    for (const k of KEYS) this.pose[k] = target[k] ?? NEUTRAL[k];
  }

  sync() {
    const p = this.pose;
    const g = this.g;
    g.torso.rotation.z = p.torso;
    g.head.rotation.z = p.head;
    g.armF.rotation.z = p.armF;
    g.armB.rotation.z = p.armB;
    g.legF.rotation.z = p.legF;
    g.legB.rotation.z = p.legB;
    if (g.weapon) g.weapon.rotation.z = p.weapon;
    this.body.position.set(p.bodyX, this.def.hipY + p.bodyY, 0);
    this.tilt.rotation.z = p.tilt;
    this.tilt.position.y = p.lift;
  }

  /** Verdensposisjon for et punkt i en dels lokale rom. */
  worldPoint(part: PartName, x: number, y: number, out = new THREE.Vector3()) {
    out.set(x, y, 0);
    this.root.updateMatrixWorld(true);
    return this.g[part].localToWorld(out);
  }

  /** Tupp av våpenet (for treffeffekter og sverd-spor). */
  weaponTip(out = new THREE.Vector3()) {
    if (!this.g.weapon || this.detached.has('weapon')) return this.worldPoint('armF', 0, -0.6, out);
    return this.worldPoint('weapon', 0, (this.def.weapon!.h - this.def.weapon!.oy) * 0.85, out);
  }

  /** Løsne en del (med barn) og legg den i verden, sentrert rundt delens midtpunkt. */
  detach(name: PartName, world: THREE.Object3D): THREE.Group | null {
    const grp = this.g[name];
    if (!grp || this.detached.has(name)) return null;
    this.root.updateMatrixWorld(true);
    const mesh = grp.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    const center = new THREE.Vector3();
    if (mesh) {
      mesh.geometry.computeBoundingBox();
      mesh.geometry.boundingBox!.getCenter(center);
      mesh.localToWorld(center);
    } else grp.getWorldPosition(center);
    const wrap = new THREE.Group();
    wrap.position.copy(center);
    world.add(wrap);
    wrap.updateMatrixWorld(true);
    wrap.attach(grp);
    this.markDetached(name);
    return wrap;
  }

  private markDetached(name: PartName) {
    this.detached.add(name);
    if (name === 'torso') {
      this.detached.add('head');
      this.detached.add('armF');
      this.detached.add('armB');
      this.detached.add('weapon');
    }
    if (name === 'armF') this.detached.add('weapon');
  }

  hide(name: PartName) {
    const g = this.g[name];
    if (g) g.visible = false;
    this.markDetached(name);
  }

  dispose() {
    for (const m of this.mats) m.dispose();
    this.root.removeFromParent();
  }
}

export function makeRig(id: CharId, scaleMul = 1, tint?: [number, number, number]) {
  return new Rig(getChar(id), scaleMul, tint);
}
