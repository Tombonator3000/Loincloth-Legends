// Cutout-rigg: hver kroppsdel er et eget plan med pivot i leddet.
// Gjør animasjon enkel (vinkler per ledd) og lemlestelse gratis (løsne en gruppe).
import * as THREE from 'three';
import { getChar, type CharDef, type CharId, type Joints, type PartDef, type PartName, type V2 } from './chars';
import { unitCanvas } from './draw';
import { getAssetRevision, getOverride, resized, type PartOverride } from './assets';
import { damp } from '../core/math';
import { charMaterial, reliefTexture, paintInk } from './charlight';
import { applyHeroSkin, appearanceSkinColors, composeHeroHead, heroHeadPreview, purgeHeroAppearance } from './hero-appearance';

const PPU = 150;
/** Strektykkelse for figurdelene (standard i draw.ts er 0.045). */
export const INK_W = 0.028;

type Asset = {
  owners: Set<string>;
  tex: THREE.Texture;
  relief: THREE.Texture;
  geo: THREE.PlaneGeometry;
  canvas: HTMLCanvasElement;
  /** Overkropp fra PNG: skulderleddene i bildet (nær og fjern skulder) i delens enheter. */
  shoulders?: [V2, V2];
  /** Overkropp fra PNG: halsroten i bildet i delens enheter (der hodet festes). */
  neck?: V2;
  /** Hode fra PNG som skal ligge foran overkroppen (langt skjegg). */
  front?: boolean;
  /** Svake pekere: cacheopprydding må aldri frigjøre en del som fortsatt tegnes i en scene. */
  users: Set<WeakRef<THREE.Object3D>>;
};
const cache = new Map<string, Asset>();
/** Varianter fra smia skal ikke beholde alle tidligere fargevalg i GPU-minnet. */
const appearanceAssets = new Set<string>();
const APPEARANCE_ASSET_LIMIT = 84;

function disposeAsset(a: Asset) {
  a.tex.dispose(); a.relief.dispose(); a.geo.dispose();
}

function assetInScene(a: Asset) {
  for (const ref of a.users) {
    const mesh = ref.deref();
    if (!mesh) { a.users.delete(ref); continue; }
    for (let node: THREE.Object3D | null = mesh; node; node = node.parent) {
      if ((node as THREE.Scene).isScene) return true;
    }
  }
  return false;
}

function pruneAppearanceAssets(buildingOwner: string) {
  for (const key of appearanceAssets) {
    if (appearanceAssets.size <= APPEARANCE_ASSET_LIMIT) break;
    const a = cache.get(key);
    // Aktive figurer og løse hoder eier fortsatt ressursene. Bare ubrukte cacheposter begrenses.
    // Den nye riggen er ennå ikke satt inn i scenen. Behold også delene som bygges i samme kallkjede.
    if (a && (a.owners.has(buildingOwner) || assetInScene(a))) continue;
    appearanceAssets.delete(key);
    if (a) { disposeAsset(a); cache.delete(key); }
  }
}

function headAssembly(ch: CharDef) {
  const source = ch.inherit?.head ?? ch.id;
  let ov = getOverride(ch.id, 'head') ?? getOverride(source, 'head');
  if (!ov || !ch.appearance) return;
  const h = rigHeight(ch, 'head', ch.head, ov);
  if (h) ov = resized(ov, h);
  return composeHeroHead(ch, ov);
}

/**
 * Høyde for en PNG-del regnet ut fra riggen, så bilder fra ChatGPT passer på alle figurer uten tall i manifestet:
 * beinet når bakken fra hofta, overkroppen når nakkeleddet, våpenleddet havner i neven, og hode, hofte og våpen
 * får omtrent samme høyde som den tegnede delen (hatter og lange våpen tar plassen de trenger). null beholder
 * høyden fra lasteren (hårmanken, heltenes hofte som skaleres etter beltet, og høyder satt i manifestet).
 */
function rigHeight(ch: CharDef, key: string, def: PartDef, ov: PartOverride): number | null {
  if (ov.fixedH) return null;
  const J = ch.joints;
  switch (key) {
    case 'leg':
      return ch.hipY / Math.max(0.5, 1 - ov.ay);
    case 'torso':
      // Nakkeleddet ved halsroten i bildet (neck i manifestet), ellers omtrent 12 prosent under toppen
      return J.neck[1] / Math.max(0.4, ov.ay - (ov.neck?.[1] ?? 0.12));
    case 'arm': {
      // Avstanden fra skulderen til neven i bildet blir avstanden fra skulderen til våpenleddet i riggen
      if (!ov.hand) return Math.abs(J.hand[1]) / Math.max(0.3, 0.86 - ov.ay);
      const asp = ov.canvas.width / ov.canvas.height;
      return Math.hypot(J.hand[0], J.hand[1]) / Math.max(0.2, Math.hypot((ov.hand[0] - ov.ax) * asp, ov.hand[1] - ov.ay));
    }
    case 'head':
    case 'pelvis':
    case 'weapon':
      return def.h * 0.92;
    default:
      return null;
  }
}

/**
 * Vinkelen et armbilde må snus om skulderen for at neven skal ligge der riggen har våpenleddet. Armer fra ChatGPT
 * henger ikke alltid rett ned (de kan være bøyd eller strukket fram), og da havnet våpenet ved siden av neven, og
 * den bakre armen forsvant bak overkroppen.
 */
function armTurn(ch: CharDef, ov: PartOverride) {
  const asp = ov.canvas.width / ov.canvas.height;
  const dx = (ov.hand![0] - ov.ax) * asp, dy = ov.hand![1] - ov.ay;
  const [hx, hy] = ch.joints.hand;
  return Math.atan2(hy, hx) - Math.atan2(-dy, dx);
}

export function partAsset(ch: CharDef, key: string, def: PartDef): Asset {
  let k = ch.id + ':' + key;
  // Hår og øyne endrer ikke kroppen. Del malte kroppsressurser på tvers av hodevalg, men aldri reservegrafikk.
  if (ch.appearance && ['torso', 'pelvis', 'arm', 'leg', 'weapon'].includes(key)) {
    const source = ch.inherit?.[key as keyof NonNullable<CharDef['inherit']>] ?? ch.id;
    const direct = getOverride(ch.id, key), ov = direct ?? getOverride(source, key);
    if (ov) {
      const h = rigHeight(ch, key, def, ov) ?? ov.h;
      const turn = key === 'arm' && ov.hand ? armTurn(ch, ov) : 0;
      k = ['painted', getAssetRevision(), direct ? ch.id : source, key, h, turn, ch.appearance.skinTone, appearanceSkinColors(ch)?.join(',')].join('|');
    }
  }
  let a = cache.get(k);
  if (!a) {
    // Hårmanken bak ryggen følger hodet (også når en helt arver PNG-ene fra thrugg eller valkyra)
    const detailLayer = key === 'appearanceBack' || key === 'appearanceFront';
    const src = ch.inherit?.[(key === 'hairback' || detailLayer ? 'head' : key) as keyof NonNullable<CharDef['inherit']>];
    let ov = detailLayer ? headAssembly(ch)?.[key === 'appearanceBack' ? 'back' : 'front'] : getOverride(ch.id, key) ?? (src ? getOverride(src, key) : undefined);
    let turn = 0;
    let shoulders: [V2, V2] | undefined;
    let neck: V2 | undefined;
    if (ov) {
      const h = rigHeight(ch, key, def, ov);
      if (h) ov = resized(ov, h);
      if (ch.appearance && !detailLayer) ov = key === 'head' ? composeHeroHead(ch, ov).head : applyHeroSkin(ch, key, src ?? ch.id, ov);
      if (key === 'arm' && ov.hand) turn = armTurn(ch, ov);
      const o = ov;
      const at = ([u, v]: readonly number[]): V2 => [(u - o.ax) * o.w, (o.ay - v) * o.h];
      if (key === 'torso' && ov.shoulders) shoulders = [at(ov.shoulders[0]), at(ov.shoulders[1])];
      if (key === 'torso' && ov.neck) neck = at(ov.neck);
      def = { w: ov.w, h: ov.h, ox: ov.ox, oy: ov.oy, draw: () => {} };
    }
    // Store figurer (sjefer, kjempetrollet) tegnes med flere piksler per enhet, så de ikke blir uskarpe, og med
    // tynnere strek i enheter, så streken er like tykk på skjermen som hos de vanlige figurene
    const big = Math.max(1, ch.scale / 1.2);
    const ppu = Math.round(PPU * big);
    // Tynnere strek enn standard: figurene skal se malte ut, ikke tegnet (docs/STYLE_TARGET.md)
    const cv = ov ? ov.canvas : unitCanvas(def.w, def.h, def.ox, def.oy, ppu, def.draw, INK_W / big);
    // Normal- og glanskart ut fra tegningen (volum, muskelfurer, olje på huden), se gfx/charlight.ts.
    // Lages før strekene farges, fordi relieffet bruker blekkstrekene som furer. En malt overkropp med uttonet
    // halsstump får relieffet fra det opprinnelige bildet (full): ellers blir kanten på uttoningen en ny ytterkant med kantlys.
    let reliefSource = ov?.full ?? cv;
    let reliefPpu = ov ? cv.width / def.w : ppu;
    // Ansiktslagene beholder full fargeoppløsning. Relieffet trenger bare skjermdetaljene og er dyrt å beregne
    // for hvert hår- eller øyevalg. Skaler også ppu, så volumet beholder samme størrelse i verden.
    if (ch.appearance && (key === 'head' || detailLayer) && Math.max(reliefSource.width, reliefSource.height) > 512) {
      const small = document.createElement('canvas');
      const ratio = 512 / Math.max(reliefSource.width, reliefSource.height);
      small.width = Math.max(1, Math.round(reliefSource.width * ratio));
      small.height = Math.max(1, Math.round(reliefSource.height * ratio));
      const c = small.getContext('2d', { willReadFrequently: true })!;
      c.imageSmoothingQuality = 'high';
      c.drawImage(reliefSource, 0, 0, small.width, small.height);
      reliefPpu *= small.width / reliefSource.width;
      reliefSource = small;
    }
    const relief = reliefTexture(reliefSource, reliefPpu, appearanceSkinColors(ch), !!ov);
    if (!ov) paintInk(cv);
    const tex = new THREE.CanvasTexture(cv);
    // sRGB: sampleren dekoder til lineært lys, så figurene passer inn i HDR-pipelinen (gfx/post.ts)
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const geo = new THREE.PlaneGeometry(def.w, def.h);
    geo.translate(def.w / 2 - def.ox, def.h / 2 - def.oy, 0);
    if (turn) geo.rotateZ(turn);
    a = { owners: new Set([ch.id]), tex, relief, geo, canvas: cv, shoulders, neck, front: ov?.front, users: new Set() };
    cache.set(k, a);
    if (ch.appearance) {
      appearanceAssets.delete(k);
      appearanceAssets.add(k);
      pruneAppearanceAssets(ch.id);
    }
  } else if (appearanceAssets.has(k)) {
    appearanceAssets.delete(k); appearanceAssets.add(k);
  }
  a.owners.add(ch.id);
  return a;
}

export function headCanvas(id: CharId) {
  const ch = getChar(id);
  if (ch.appearance) {
    const portrait = heroHeadPreview(ch);
    if (portrait) return portrait;
  }
  return partAsset(ch, 'head', ch.head).canvas;
}

const tintedHeads = new Map<string, HTMLCanvasElement>();
/** Hodets tegning med fargetone (brukes når hodet klasker i skjermen). */
export function headImage(id: CharId, tint?: [number, number, number], flip = false) {
  const k = id + '|' + (tint ? tint.join(',') : '') + (flip ? 'f' : '');
  let cv = tintedHeads.get(k);
  if (cv) return cv;
  const src = headCanvas(id);
  cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  if (flip) {
    c.translate(cv.width, 0);
    c.scale(-1, 1);
  }
  if (!tint && !flip) c.putImageData(src.getContext('2d')!.getImageData(0, 0, src.width, src.height), 0, 0);
  else c.drawImage(src, 0, 0);
  if (tint) {
    const to255 = (v: number) => Math.round(Math.min(1, v) * 255);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = `rgb(${to255(tint[0])},${to255(tint[1])},${to255(tint[2])})`;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(src, 0, 0);
  }
  tintedHeads.set(k, cv);
  while (tintedHeads.size > 96) tintedHeads.delete(tintedHeads.keys().next().value!);
  return cv;
}

/** Fjern teksturer for en figur (brukes når heltebyggeren lager en ny variant). */
export function purgeChar(id: CharId) {
  for (const [k, a] of cache) {
    if (!a.owners.delete(id) || a.owners.size) continue;
    if (appearanceAssets.has(k) && assetInScene(a)) continue;
    disposeAsset(a);
    cache.delete(k);
    appearanceAssets.delete(k);
  }
  for (const key of tintedHeads.keys()) if (key === id || key.startsWith(id + '|')) tintedHeads.delete(key);
  purgeHeroAppearance(id);
}

/** Lyssatt materiale for en figurdel (se gfx/charlight.ts). Uten relieffkart blir delen flat. */
export function partMaterial(tex: THREE.Texture, tint = 1, relief: THREE.Texture | null = null) {
  return charMaterial(tex, relief, tint);
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

/** Hvilestilling: våpenet holdes fram foran magen, og den fjerne armen henger litt fram så den synes. */
export const NEUTRAL: Pose = { torso: -0.05, head: 0.05, armF: 0.55, armB: 0.3, legF: 0.22, legB: -0.22, weapon: -2.0, bodyY: -0.03, bodyX: 0, tilt: 0, lift: 0 };
const KEYS = Object.keys(NEUTRAL) as (keyof Pose)[];

/**
 * Dybden på delene, størst er fremst. Figurene står i trekvart profil mot høyre: bakerst den fjerne armen, så
 * bakhåret, hodet (bak halsen på en malt overkropp, så halsen går inn under kragen), overkroppen, beina, hofta og
 * fremst våpenarmen på den nære skulderen. Tegnede overkropper har ingen hals, så der ligger hodet foran
 * (HEAD_FRONT), og det gjør også hoder med langt skjegg over brystet (front i manifestet).
 */
const Z: Record<PartName, number> = { armB: -0.018, legB: -0.012, head: -0.008, torso: 0, legF: 0.006, pelvis: 0.012, weapon: -0.006, armF: 0.03 };
const HEAD_FRONT = 0.018;
/** Langt hår bak ryggen (hairback): bak hodet og foran den fjerne armen, uansett hvor hodet ligger. */
const HAIR_BACK = -0.014;
const ORDER: PartName[] = ['legB', 'torso', 'armB', 'legF', 'pelvis', 'head', 'armF', 'weapon'];

export class Rig {
  root = new THREE.Group();
  tilt = new THREE.Group();
  body = new THREE.Group();
  g = {} as Record<PartName, THREE.Group>;
  /**
   * Leddene figuren faktisk bruker: fra figuren, men skuldrene hentes fra en malt overkropp (skulderplatene i
   * bildet). shF er den nære skulderen der våpenarmen sitter, til venstre i bildet.
   */
  joints: Joints;
  /** Overkroppen er et malt bilde (med hals), og hodet legges bak den. */
  private painted = false;
  mats: THREE.ShaderMaterial[] = [];
  pose: Pose = { ...NEUTRAL };
  facing = 1;
  scale: number;
  detached = new Set<PartName>();
  private flashV = 0;

  constructor(public def: CharDef, scaleMul = 1, public tint: [number, number, number] = [1, 1, 1]) {
    this.scale = def.scale * scaleMul;
    this.joints = { ...def.joints };
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
    const J = this.joints;
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
    if (name === 'torso') {
      this.painted = !!a.shoulders;
      if (a.shoulders) [J.shF, J.shB] = a.shoulders;
      if (a.neck) J.neck = a.neck;
    }
    const m = partMaterial(a.tex, tint, a.relief);
    m.userData.shade = tint;
    m.uniforms.tint.value.setRGB(tint * this.tint[0], tint * this.tint[1], tint * this.tint[2]);
    m.uniforms.flash.value = this.flashV;
    this.mats.push(m);
    const mesh = new THREE.Mesh(a.geo, m);
    a.users.add(new WeakRef(mesh));
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    const grp = new THREE.Group();
    grp.position.set(x, y, name === 'head' && (!this.painted || a.front) ? HEAD_FRONT : Z[name]);
    grp.add(mesh);
    if (name === 'head') { this.hairBack(grp, tint); this.appearanceLayers(grp, tint); }
    parent.add(grp);
    this.g[name] = grp;
    return grp;
  }

  /**
   * Langt hår fra PNG (del hairback i manifestet) henger bak overkroppen men følger hodet: det ligger i
   * hodegruppa, trukket bak hodet og overkroppen og foran den bakre armen (HAIR_BACK).
   */
  private hairBack(head: THREE.Group, tint: number) {
    const def = this.def;
    const src = def.inherit?.head;
    if (!getOverride(def.id, 'hairback') && !(src && getOverride(src, 'hairback'))) return;
    const a = partAsset(def, 'hairback', { w: 1, h: 1, ox: 0, oy: 0, draw: () => {} });
    const m = partMaterial(a.tex, tint, a.relief);
    m.userData.shade = tint;
    m.uniforms.tint.value.setRGB(tint * this.tint[0], tint * this.tint[1], tint * this.tint[2]);
    m.uniforms.flash.value = this.flashV;
    this.mats.push(m);
    const mesh = new THREE.Mesh(a.geo, m);
    a.users.add(new WeakRef(mesh));
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.position.z = HAIR_BACK - head.position.z;
    head.add(mesh);
  }

  /** Løse bakhår og skjegg følger hodet, også når hodet løsner. Halsen beholder sin gamle dybde. */
  private appearanceLayers(head: THREE.Group, tint: number) {
    const assembly = headAssembly(this.def);
    if (!assembly) return;
    for (const [layer, key, z] of [['back', 'appearanceBack', HAIR_BACK], ['front', 'appearanceFront', HEAD_FRONT + 0.002]] as const) {
      if (!assembly[layer]) continue;
      const a = partAsset(this.def, key, { w: 1, h: 1, ox: 0, oy: 0, draw: () => {} });
      const m = partMaterial(a.tex, tint, a.relief);
      m.userData.shade = tint;
      m.uniforms.tint.value.setRGB(tint * this.tint[0], tint * this.tint[1], tint * this.tint[2]);
      m.uniforms.flash.value = this.flashV;
      this.mats.push(m);
      const mesh = new THREE.Mesh(a.geo, m);
      a.users.add(new WeakRef(mesh));
      mesh.name = key;
      mesh.frustumCulled = false; mesh.castShadow = true;
      mesh.position.z = z - head.position.z;
      head.add(mesh);
    }
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
