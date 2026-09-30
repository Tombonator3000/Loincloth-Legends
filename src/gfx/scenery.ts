// Kulisser: rekvisittene fra brettfila (src/data/layouts) i den ekte 3D-scenen. Malte bilder står som flate kulisser
// som vender mot kamplinja, lyssatt som figurene (charlight.ts) med tåke, vind, bildeserier og toning. 3D-rekvisitter
// fra koden bygges der de står, med lys, varmeflimmer og flammer som ryddes når de fjernes. Brukes av Stage og av
// brettverkstedet (app/scenes/editor.ts). Animasjonene er beskrevet i data/layout.ts (PropAnim).
import * as THREE from 'three';
import { CHAR_VERT, CHAR_FRAG, charUniforms, reliefTexture } from './charlight';
import { windUniforms, WIND_GLSL } from './wind';
import { screenFX } from './screenfx';
import type { Gore } from './gore';
import type { LightSource } from './vfx';
import { applyShadows, type Env, type Tippable } from './env/common';
import { propKind, type PropKind } from './props/catalog';
import { seeded, hashSeed } from '../core/math';
import {
  LAYERS, WAVE_FROM, layerDefaults, type LevelLayout, type PropAnim, type PropPlacement, type PropRun, type TrackChannel,
} from '../data/layout';

type Updates = ((dt: number, t: number, camX: number) => void)[];
type Heat = ReturnType<typeof screenFX.addHeat>;

// ---------------------------------------------------------------- materiale
/** Bytt ut en bit av figurskyggeleggeren. Kaster hvis biten ikke finnes (charlight.ts er endret), i stedet for å feile stille. */
function patch(src: string, a: string, b: string) {
  if (!src.includes(a)) throw new Error('scenery: fant ikke «' + a.trim().slice(0, 40) + '» i figurskyggeleggeren');
  return src.replace(a, b);
}
const VERT = [
  ['varying vec2 vUv;', `varying vec2 vUv;
uniform vec2 uUvOff;
uniform vec2 uUvRep;
uniform float uSway;
uniform float uSwaySpeed;
uniform float uPropH;
uniform float uBase;
uniform float uPhase;
uniform float uWave;
uniform float uWaveSpeed;
uniform float uWaveLen;
uniform float uWaveFrom;
uniform float uLeft;
uniform float uPropW;
uniform float uT;
varying float vShade;
${WIND_GLSL}
#include <fog_pars_vertex>`],
  ['  vUv = uv;\n  vec4 mv = modelViewMatrix * vec4(position, 1.0);', `  vUv = uv * uUvRep + uUvOff;
  vec3 p = position;
  if (uSway > 0.0) {
    // Vinden bøyer toppen: roten står, jo høyere jo mer (samme vind som trærne)
    vec3 root = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float h01 = clamp((p.y - uBase) / max(uPropH, 0.01), 0.0, 1.0);
    float s = windPower(root.xz) * uSway;
    float sw = windSway(root.xz + uPhase, 0.9 * uSwaySpeed);
    p.x += h01 * h01 * uPropH * (0.05 * s + 0.07 * s * sw);
    p.y -= h01 * h01 * uPropH * 0.01 * s;
  }
  vShade = 1.0;
  if (uWave > 0.0) {
    // Duken bølger ut fra den faste kanten (stanga): ingenting ved kanten, mest ytterst. Foldene får litt skygge.
    float u01 = clamp((position.x - uLeft) / max(uPropW, 0.01), 0.0, 1.0);
    float v01 = clamp((position.y - uBase) / max(uPropH, 0.01), 0.0, 1.0);
    float d = uWaveFrom < 0.5 ? u01 : (uWaveFrom < 1.5 ? 1.0 - u01 : 1.0 - v01);
    float along = uWaveFrom < 1.5 ? d : d + u01 * 0.35;
    float ph = along / max(uWaveLen, 0.05) * 6.2831853 - uT * uWaveSpeed * 6.2831853 + uPhase;
    float a = uWave * d;
    if (uWaveFrom < 1.5) p.y += a * sin(ph);
    else p.x += a * sin(ph);
    p.z += a * 0.7 * cos(ph);
    vShade = 1.0 - 0.28 * min(1.0, d * 1.6) * (0.5 - 0.5 * cos(ph));
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);`],
  ['  gl_Position = projectionMatrix * mv;\n}', `  gl_Position = projectionMatrix * mv;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`],
].reduce((src, [a, b]) => patch(src, a, b), CHAR_VERT);

const FRAG = [
  ['uniform float uBump;', `uniform float uBump;
uniform float uFade;
uniform float uDark;
uniform float uGlow;
varying float vShade;
#include <fog_pars_fragment>`],
  ['  if (c.a < 0.06) discard;', `  if (c.a < 0.06) discard;
  // Toning av forgrunnen: dithering, så dybden og kantutjevningen virker som før
  if (uFade < 0.999) {
    float dth = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (dth > uFade) discard;
  }`],
  ['  col = mix(col, flashColor, flash);', `  col *= uGlow * (1.0 - uDark) * vShade;
  col = mix(col, flashColor, flash);`],
  ['  #include <colorspace_fragment>\n}', `  #include <colorspace_fragment>
  #include <fog_fragment>
}`],
].reduce((src, [a, b]) => patch(src, a, b), CHAR_FRAG);

function propMaterial(tex: THREE.Texture, relief: THREE.Texture | null) {
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    ...charUniforms,
    ...windUniforms,
    map: { value: tex },
    relief: { value: relief },
    tint: { value: new THREE.Color(1, 1, 1) },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color(1, 1, 1) },
    opacity: { value: 1 },
    uUvOff: { value: new THREE.Vector2(0, 0) },
    uUvRep: { value: new THREE.Vector2(1, 1) },
    uSway: { value: 0 },
    uSwaySpeed: { value: 1 },
    uPropH: { value: 1 },
    uBase: { value: 0 },
    uPhase: { value: 0 },
    uFade: { value: 1 },
    uDark: { value: 0 },
    uGlow: { value: 1 },
    uWave: { value: 0 },
    uWaveSpeed: { value: 1 },
    uWaveLen: { value: 0.7 },
    uWaveFrom: { value: 0 },
    uLeft: { value: 0 },
    uPropW: { value: 1 },
    uT: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: true,
    fog: true,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    transparent: false,
  });
  // Skyggepasset alfatester med material.map, så kulissene kaster skygge med formen i bildet
  Object.assign(m, { map: tex });
  return m;
}

// ---------------------------------------------------------------- bilder
interface Art {
  tex: THREE.Texture;
  relief: THREE.Texture | null;
  /** Alfa i lav oppløsning (til valg med musa). */
  alpha: { w: number; h: number; a: Uint8ClampedArray };
  /** Bredde og høyde på én rute i piksler (hele bildet når det ikke er en bildeserie). */
  fw: number;
  fh: number;
}
const arts = new Map<string, Art>();

function sheetOf(anims: PropAnim[] | undefined) {
  return anims?.find((a): a is Extract<PropAnim, { type: 'sheet' }> => a.type === 'sheet');
}

function artFor(kind: PropKind): Art | null {
  const img = kind.image?.();
  if (!img) return null;
  const key = kind.id + ':' + ((img as HTMLImageElement).src ?? '') + ':' + img.width + 'x' + img.height;
  let a = arts.get(key);
  if (a) return a;
  const W = (img as HTMLImageElement).naturalWidth || img.width, H = (img as HTMLImageElement).naturalHeight || img.height;
  const tex = new THREE.Texture(img as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  // Relieff (runde kanter og kantlys som på figurene) regnes i lavere oppløsning, så store bilder går fort
  const sheet = sheetOf(kind.anim);
  const k = Math.min(1, 512 / Math.max(W, H));
  const small = document.createElement('canvas');
  small.width = Math.max(4, Math.round(W * k));
  small.height = Math.max(4, Math.round(H * k));
  const sc = small.getContext('2d', { willReadFrequently: true })!;
  sc.drawImage(img, 0, 0, small.width, small.height);
  const cols = sheet ? sheet.grid[0] : 1, rows = sheet ? sheet.grid[1] : 1;
  const wm = kind.w ?? 1.5;
  let relief: THREE.Texture | null = null;
  try {
    relief = reliefTexture(small, (small.width / cols) / wm, [], true);
  } catch {
    relief = null;
  }
  const data = sc.getImageData(0, 0, small.width, small.height).data;
  const alpha = new Uint8ClampedArray(small.width * small.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  a = { tex, relief, alpha: { w: small.width, h: small.height, a: alpha }, fw: W / cols, fh: H / rows };
  arts.set(key, a);
  return a;
}

/** Glem et bilde (et nytt bilde med samme navn fra editoren). */
export function forgetArt(id: string) {
  for (const k of [...arts.keys()]) if (k.startsWith(id + ':')) arts.delete(k);
}

// ---------------------------------------------------------------- animasjon
const smooth = (k: number) => k * k * (3 - 2 * k);
/** Verdien i et nøkkelspor [[t, v], ...] ved p (0..1), med myk overgang (som POSER i Morbidium). */
export function trackValue(keys: [number, number][], p: number): number {
  if (!keys.length) return 0;
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (p <= b[0]) {
      const a = keys[i - 1];
      const k = (p - a[0]) / Math.max(1e-4, b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * smooth(k);
    }
  }
  return keys[keys.length - 1][1];
}
const TRACK_BASE: Record<TrackChannel, number> = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 };

// ---------------------------------------------------------------- elementene
export interface SceneryItem {
  /** Plasseringens id, eller "radens id#nummer" for rader. */
  key: string;
  place: PropPlacement;
  runId?: string;
  kind: PropKind;
  root: THREE.Group;
  pivot: THREE.Group;
  mesh: THREE.Mesh | null;
  mat: THREE.ShaderMaterial | null;
  anims: PropAnim[];
  /** Bredde og høyde i meter, fotpunkt og ledd (bilder). */
  size: [number, number];
  anchor: [number, number];
  phase: number;
  t: number;
  fade: number;
  fades: boolean;
  lights: { src: LightSource; base: number; at: THREE.Vector3 }[];
  heats: Heat[];
  updates: Updates;
  fires: THREE.Vector3[];
  fireAt: THREE.Vector3[];
  tippables: Tippable[];
  fireAcc: number;
  /** Leddet i ro (meter fra fotpunktet), før animasjonene. */
  rest: [number, number];
  /** Forelderen når dette er en del av en annen rekvisitt (nøkkelen), ellers undefined. */
  parentKey?: string;
  /** Tilstanden til react-animasjonene (samme plass i lista som i anims). */
  reacts: ReactState[];
}

interface ReactState {
  /** Sekunder siden den startet (-1 = i ro). */
  rt: number;
  /** Nedkjøling før den kan starte igjen. */
  cd: number;
  /** Retningen bort fra det som skremte den. */
  dir: number;
  /** flee: sekunder igjen før den kommer tilbake. */
  gone: number;
}

export interface FighterBox {
  x: number;
  y: number;
  z: number;
  /** Høyde og bredde i meter. */
  h: number;
  w: number;
}

const tmpV = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpM = new THREE.Matrix4();
const rad = THREE.MathUtils.degToRad;

/** Plasseringen i verden som matrise (posisjon, vridning rundt loddlinja, skala og speilvending), fra dataene. */
function worldOf(p: PropPlacement, out: THREE.Matrix4) {
  const s = p.scale ?? 1;
  return out.compose(tmpP.set(p.x, p.y ?? 0, p.z), tmpQ.setFromEuler(tmpE.set(0, rad(p.yaw ?? 0), 0)), tmpS.set(p.flip ? -s : s, s, s));
}

/** Standardlengden på en react-animasjon i sekunder. */
function reactDur(a: Extract<PropAnim, { type: 'react' }>) {
  return a.dur ?? (a.effect === 'flee' ? 1.6 : a.effect === 'spin' ? 0.8 : a.effect === 'hop' ? 0.4 : 0.9);
}

export class Scenery {
  readonly group = new THREE.Group();
  readonly items = new Map<string, SceneryItem>();
  /** Figurene som kan stå bak forgrunnen (settes av Stage). Uten dem tones ingenting. */
  fighters: (() => FighterBox[]) | null = null;
  /** Brettverkstedet: vis alt uten toning, og bygg om ved endringer. */
  editor = false;
  private camera: THREE.Camera | null = null;
  /** Treff, kast og bakkeslag siden forrige bilde (react med on: 'hit'). */
  private pokes: { x: number; z: number; r: number }[] = [];

  constructor(private gore: Gore, private env: Env | null, camera?: THREE.Camera) {
    this.group.name = 'scenery';
    this.camera = camera ?? null;
  }

  setCamera(c: THREE.Camera) {
    this.camera = c;
  }

  /** Bygg alle rekvisittene og radene i brettfila (det som fantes fra før, fjernes). Delene henges på til slutt. */
  load(layout: LevelLayout) {
    this.clear();
    for (const p of layout.props) {
      const it = this.build(p.id, p);
      if (it) this.items.set(p.id, it);
    }
    for (const it of [...this.items.values()]) if (it.place.parent) this.attach(it);
    for (const r of layout.runs ?? []) this.setRun(r);
  }

  clear() {
    for (const k of [...this.items.keys()]) this.removeKey(k);
  }

  /** Legg til eller bygg om én rekvisitt. Den henges på forelderen, og delene dens henges på den igjen. */
  set(p: PropPlacement) {
    this.removeKey(p.id);
    const it = this.build(p.id, p);
    if (!it) return it;
    this.items.set(p.id, it);
    if (p.parent) this.attach(it);
    for (const c of [...this.items.values()]) if (c !== it && c.place.parent === p.id) this.attach(c);
    return it;
  }

  /** Heng en del på leddet til forelderen (eller løs den hvis forelderen mangler). Plassen i verden beholdes. */
  private attach(child: SceneryItem) {
    const par = child.place.parent ? this.items.get(child.place.parent) : undefined;
    let ring = false;
    for (let q = par; q; q = q.parentKey ? this.items.get(q.parentKey) : undefined) if (q === child) ring = true;
    if (!par || ring) {
      child.parentKey = undefined;
      if (child.root.parent !== this.group) this.group.add(child.root);
    } else {
      child.parentKey = par.key;
      par.pivot.add(child.root);
    }
    this.place(child);
  }

  /** Delene som henger på en rekvisitt (nøklene). */
  partsOf(key: string) {
    return [...this.items.values()].filter((c) => c.parentKey === key).map((c) => c.key);
  }

  /** Et treff, et kast eller et bakkeslag ved (x, z): kulisser med react on 'hit' i nærheten svarer. */
  poke(x: number, z: number, r = 2) {
    if (this.pokes.length < 32) this.pokes.push({ x, z, r });
  }

  /** Start react-animasjonen på en rekvisitt med en gang (TEST-knappen i editoren). */
  trigger(key: string) {
    const it = this.items.get(key);
    if (!it) return false;
    let any = false;
    it.anims.forEach((a, i) => {
      if (a.type !== 'react') return;
      const st = (it.reacts[i] ??= { rt: -1, cd: 0, dir: 1, gone: 0 });
      st.rt = 0;
      st.gone = 0;
      st.dir = 1;
      any = true;
    });
    return any;
  }

  remove(id: string) {
    this.removeKey(id);
    for (const k of [...this.items.keys()]) if (k.startsWith(id + '#')) this.removeKey(k);
  }

  /** Legg til eller bygg om en rad. Plasseringene lages med radens eget frø, så de står likt hver gang. */
  setRun(r: PropRun) {
    for (const k of [...this.items.keys()]) if (k.startsWith(r.id + '#')) this.removeKey(k);
    for (const [i, p] of expandRun(r).entries()) {
      const key = r.id + '#' + i;
      const it = this.build(key, p, r.id);
      if (it) this.items.set(key, it);
    }
  }

  private removeKey(key: string) {
    const it = this.items.get(key);
    if (!it) return;
    // Delene løsnes først (de beholder plassen sin), så de ikke forsvinner og ryddes med forelderen
    for (const c of this.items.values()) {
      if (c.parentKey !== key) continue;
      this.group.attach(c.root);
      c.parentKey = undefined;
    }
    this.items.delete(key);
    it.root.removeFromParent();
    it.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.ownGeo) m.geometry.dispose();
    });
    it.mat?.dispose();
    for (const l of it.lights) this.gore.vfx.lights.removeSource(l.src);
    for (const h of it.heats) screenFX.removeHeat(h);
    const env = this.env;
    if (env?.fires) for (const f of it.fires) {
      const i = env.fires.indexOf(f);
      if (i >= 0) env.fires.splice(i, 1);
    }
    if (env?.tippables) for (const tp of it.tippables) {
      const i = env.tippables.indexOf(tp);
      if (i >= 0) env.tippables.splice(i, 1);
    }
  }

  private build(key: string, p: PropPlacement, runId?: string): SceneryItem | null {
    const kind = propKind(p.prop);
    if (!kind) return null;
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    root.add(pivot);
    root.userData.sceneryKey = key;
    const anims = p.anim ?? kind.anim ?? [];
    const it: SceneryItem = {
      key, place: p, runId, kind, root, pivot, mesh: null, mat: null, anims, size: [1, 1], anchor: [0.5, 1],
      phase: seeded(hashSeed(key))() * 100, t: 0, fade: 1, fades: false,
      lights: [], heats: [], updates: [], fires: [], fireAt: [], tippables: [], fireAcc: 0, rest: [0, 0], reacts: [],
    };
    if (kind.build) this.buildModel(it, p);
    else if (!this.buildImage(it, p)) return null;
    this.place(it);
    this.group.add(root);
    return it;
  }

  /** Malt kulisse: et plan med fotpunktet i origo og leddet (sving og spinn) i pivot-gruppa. */
  private buildImage(it: SceneryItem, p: PropPlacement) {
    const kind = it.kind;
    const art = artFor(kind);
    if (!art) return false;
    const w = kind.w ?? 1.5;
    const h = w * (art.fh / art.fw);
    const [ax, ay] = kind.anchor ?? [0.5, 1];
    it.size = [w, h];
    it.anchor = [ax, ay];
    const turn = it.anims.find((a) => a.type === 'swing' || a.type === 'spin') as { pivot?: [number, number] } | undefined;
    const [px, py] = turn?.pivot ?? [ax, ay];
    // Ledd i kulissens rom (meter fra fotpunktet)
    const lx = (px - ax) * w, ly = (ay - py) * h;
    it.pivot.position.set(lx, ly, 0);
    it.rest = [lx, ly];
    // Bølgende duk og vind trenger et oppdelt plan, ellers holder to trekanter
    const wave = it.anims.find((a): a is Extract<PropAnim, { type: 'wave' }> => a.type === 'wave');
    const sway = it.anims.find((a): a is Extract<PropAnim, { type: 'sway' }> => a.type === 'sway');
    const geo = wave ? new THREE.PlaneGeometry(w, h, 18, 14) : sway ? new THREE.PlaneGeometry(w, h, 1, 6) : new THREE.PlaneGeometry(w, h);
    geo.translate((0.5 - ax) * w - lx, (ay - 0.5) * h - ly, 0);
    const mat = propMaterial(art.tex, art.relief);
    const u = mat.uniforms;
    const sheet = sheetOf(it.anims);
    if (sheet) (u.uUvRep.value as THREE.Vector2).set(1 / sheet.grid[0], 1 / sheet.grid[1]);
    if (sway) {
      u.uSway.value = sway.amount ?? 0.5;
      u.uSwaySpeed.value = sway.speed ?? 1;
    }
    if (wave) {
      u.uWave.value = wave.amount ?? 0.12;
      u.uWaveSpeed.value = wave.speed ?? 0.9;
      u.uWaveLen.value = wave.length ?? 0.7;
      u.uWaveFrom.value = Math.max(0, WAVE_FROM.indexOf(wave.from ?? 'left'));
    }
    u.uPropH.value = h;
    u.uPropW.value = w;
    u.uLeft.value = -ax * w - lx;
    u.uBase.value = (ay - 1) * h - ly;
    u.uPhase.value = it.phase;
    const defaults = layerDefaults(p.layer);
    u.uDark.value = p.dark ?? kind.dark ?? defaults.dark;
    if (p.tint) (u.tint.value as THREE.Color).set(p.tint);
    it.fades = p.fade ?? kind.fade ?? defaults.fade;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.ownGeo = true;
    mesh.userData.sceneryKey = it.key;
    mesh.castShadow = (p.shadow ?? kind.shadow ?? p.layer !== 'front') && !sheet && p.layer !== 'far';
    mesh.receiveShadow = false;
    // Bak- og midtlaget tegnes før figurene, forgrunnen etter
    mesh.renderOrder = p.layer === 'front' ? 3 : 0;
    it.pivot.add(mesh);
    it.mesh = mesh;
    it.mat = mat;
    // Lys og flammer ved punkter i bildet
    for (const a of it.anims) {
      if (a.type !== 'flicker' || !a.light) continue;
      const at = a.at ?? [0.5, 0.3];
      const local = new THREE.Vector3((at[0] - ax) * w, (ay - at[1]) * h, 0.35);
      it.lights.push({ src: this.gore.vfx.lights.source(new THREE.Vector3(), a.light, a.intensity ?? 8, a.range ?? 8, 0.3), base: a.intensity ?? 8, at: local });
    }
    for (const f of kind.fire ?? []) it.fireAt.push(new THREE.Vector3((f[0] - ax) * w, (ay - f[1]) * h, 0.05));
    return true;
  }

  /** 3D fra koden: bygges der den står, og lys, varme, bål og ting som kan veltes fanges opp så de kan ryddes. */
  private buildModel(it: SceneryItem, p: PropPlacement) {
    const inner = new THREE.Group();
    // Byggerne legger alt på (x, z) i verden; den indre gruppa flytter det tilbake til roten, så skala og vridning
    // virker rundt foten
    inner.position.set(-p.x, 0, -p.z);
    it.pivot.add(inner);
    const pool = this.gore.vfx.lights;
    const lights: LightSource[] = [];
    const heats: Heat[] = [];
    const origSource = pool.source;
    const origHeat = screenFX.addHeat;
    pool.source = (...a: Parameters<typeof origSource>) => {
      const s = origSource.apply(pool, a);
      lights.push(s);
      return s;
    };
    screenFX.addHeat = (...a: Parameters<typeof origHeat>) => {
      const h = origHeat.apply(screenFX, a);
      heats.push(h);
      return h;
    };
    try {
      it.kind.build!({ g: inner, gore: this.gore, updates: it.updates, x: p.x, z: p.z });
    } finally {
      pool.source = origSource;
      screenFX.addHeat = origHeat;
    }
    applyShadows(inner);
    inner.traverse((o) => {
      o.userData.sceneryKey = it.key;
    });
    it.lights = lights.map((src) => ({ src, base: src.intensity, at: src.pos.clone() }));
    it.heats = heats;
    it.fires = (inner.userData.fires as THREE.Vector3[] | undefined) ?? [];
    it.tippables = (inner.userData.tippables as Tippable[] | undefined) ?? [];
    if (this.env && !this.editor) {
      if (it.fires.length) (this.env.fires ??= []).push(...it.fires);
      if (it.tippables.length) (this.env.tippables ??= []).push(...it.tippables);
    }
  }

  /** Leddet til en rekvisitt i ro, i verden: plassen fra dataene og leddet uten animasjon. */
  private restPivot(it: SceneryItem, out: THREE.Matrix4) {
    worldOf(it.place, out);
    return out.multiply(tmpM.compose(tmpP.set(it.rest[0], it.rest[1], 0), tmpQ.setFromEuler(tmpE.set(0, 0, rad(it.place.rot ?? 0))), tmpS.set(1, 1, 1)));
  }

  /**
   * Sett plassering, skala, speilvending og vridning på roten. En del regnes om til rommet til forelderens ledd i ro,
   * så den står der dataene sier og følger forelderen når den animeres.
   */
  private place(it: SceneryItem) {
    const p = it.place;
    const par = it.parentKey ? this.items.get(it.parentKey) : undefined;
    if (par) {
      const w = worldOf(p, new THREE.Matrix4());
      this.restPivot(par, new THREE.Matrix4()).invert().multiply(w).decompose(it.root.position, it.root.quaternion, it.root.scale);
    } else {
      const s = p.scale ?? 1;
      it.root.position.set(p.x, p.y ?? 0, p.z);
      it.root.scale.set(p.flip ? -s : s, s, s);
      it.root.rotation.set(0, rad(p.yaw ?? 0), 0);
    }
    it.pivot.rotation.z = rad(p.rot ?? 0);
    it.root.updateWorldMatrix(true, true);
    // Lys som hører til et punkt i bildet, flyttes med
    if (it.mesh) for (const l of it.lights) l.src.pos.copy(tmpV.copy(l.at)).applyMatrix4(it.pivot.matrixWorld);
  }

  /** Flytt eller endre en rekvisitt uten å bygge den på nytt (bare bilder; 3D bygges om). */
  move(p: PropPlacement) {
    const it = this.items.get(p.id);
    if (!it || it.kind.build || p.prop !== it.place.prop || JSON.stringify(p.anim) !== JSON.stringify(it.place.anim) || p.layer !== it.place.layer || p.parent !== it.place.parent) return this.set(p);
    it.place = p;
    const u = it.mat!.uniforms;
    const d = layerDefaults(p.layer);
    u.uDark.value = p.dark ?? it.kind.dark ?? d.dark;
    (u.tint.value as THREE.Color).set(p.tint ?? '#ffffff');
    it.fades = p.fade ?? it.kind.fade ?? d.fade;
    it.mesh!.castShadow = (p.shadow ?? it.kind.shadow ?? p.layer !== 'front') && !sheetOf(it.anims) && p.layer !== 'far';
    this.place(it);
    return it;
  }

  /** Animasjonene, lysene, flammene og toningen. Kalles hver frame (via Env.update). */
  tick(dt: number) {
    const fighters = !this.editor && this.fighters && this.camera ? this.fighterPoints() : null;
    let near: FighterBox[] | null = null;
    for (const it of this.items.values()) {
      it.t += dt;
      for (const u of it.updates) u(dt, it.t, 0);
      if (!it.mesh) continue;
      const u = it.mat!.uniforms;
      const p = it.place;
      let ox = 0, oy = 0, rot = p.rot ?? 0, sx = 1, sy = 1, alpha = 1, glow = 1;
      u.uT.value = it.t;
      for (let ai = 0; ai < it.anims.length; ai++) {
        const a = it.anims[ai];
        switch (a.type) {
          case 'swing':
            rot += (a.amount ?? 6) * Math.sin(it.t * (a.speed ?? 0.6) * Math.PI * 2 + it.phase);
            break;
          case 'bob':
            oy += (a.amount ?? 0.05) * Math.sin(it.t * (a.speed ?? 0.8) * Math.PI * 2 + it.phase);
            break;
          case 'spin':
            rot -= it.t * (a.speed ?? 0.25) * 360;
            break;
          case 'flicker': {
            const sp = a.speed ?? 8, am = a.amount ?? 0.25;
            const n = Math.sin(it.t * sp + it.phase) * 0.5 + Math.sin(it.t * sp * 2.3 + it.phase * 1.7) * 0.3 + Math.sin(it.t * sp * 5.1) * 0.2;
            glow *= 1 + am * n;
            break;
          }
          case 'sheet': {
            const fps = a.fps ?? 10, n = a.n;
            let f = Math.floor(it.t * fps + it.phase * 7);
            if (a.mode === 'once') f = Math.min(n - 1, Math.floor(it.t * fps));
            else if (a.mode === 'pingpong' && n > 1) {
              const m = f % (2 * n - 2);
              f = m < n ? m : 2 * n - 2 - m;
            } else f = ((f % n) + n) % n;
            const [cols, rows] = a.grid;
            (u.uUvOff.value as THREE.Vector2).set((f % cols) / cols, 1 - (Math.floor(f / cols) + 1) / rows);
            break;
          }
          case 'track': {
            const dur = Math.max(0.05, a.dur);
            const ph = a.loop === false ? Math.min(1, it.t / dur) : ((it.t + it.phase * 0.01) % dur) / dur;
            for (const ch of Object.keys(a.keys) as TrackChannel[]) {
              const v = trackValue(a.keys[ch] ?? [], ph);
              if (ch === 'x') ox += v;
              else if (ch === 'y') oy += v;
              else if (ch === 'rot') rot += v;
              else if (ch === 'sx') sx *= v || TRACK_BASE.sx;
              else if (ch === 'sy') sy *= v || TRACK_BASE.sy;
              else alpha *= v;
            }
            break;
          }
          case 'pulse': {
            const k = Math.sin(it.t * (a.speed ?? 0.6) * Math.PI * 2 + it.phase);
            const am = a.amount ?? 0.04;
            sx *= 1 + am * k;
            sy *= 1 + am * k;
            glow *= 1 + (a.glow ?? 0) * (0.5 + 0.5 * k);
            break;
          }
          case 'drift': {
            const range = Math.max(1, a.range ?? 30), sp = a.speed ?? 0.4;
            const f = (((it.t * sp + it.phase * 3) % range) + range) % range;
            ox += f - range / 2;
            const e = f / range;
            alpha *= smooth(Math.min(1, e / 0.12)) * smooth(Math.min(1, (1 - e) / 0.12));
            break;
          }
          case 'react': {
            const st = (it.reacts[ai] ??= { rt: -1, cd: 0, dir: 1, gone: 0 });
            st.cd -= dt;
            if (st.rt < 0 && st.gone <= 0 && st.cd <= 0) {
              // Hva som setter den i gang: en figur innenfor radius, eller et treff, kast eller bakkeslag i nærheten
              const on = a.on ?? 'near', r = a.radius ?? 2.5;
              it.root.getWorldPosition(tmpV);
              let src: number | null = null;
              if (on !== 'hit' && !this.editor && this.fighters) {
                near ??= this.fighters();
                for (const f of near) if (Math.abs(f.x - tmpV.x) < r && Math.abs(f.z - tmpV.z) < r + 1.5) src = f.x;
              }
              if (src === null && on !== 'near') for (const pk of this.pokes) if (Math.hypot(pk.x - tmpV.x, pk.z - tmpV.z) < r + pk.r) src = pk.x;
              if (src !== null) {
                st.rt = 0;
                st.dir = tmpV.x >= src ? 1 : -1;
              }
            }
            const effect = a.effect ?? 'shake';
            if (st.rt >= 0) {
              st.rt += dt;
              const k = Math.min(1, st.rt / Math.max(0.05, reactDur(a)));
              if (effect === 'shake') rot += (a.amount ?? 8) * Math.sin(st.rt * 34) * (1 - k) * (1 - k);
              else if (effect === 'hop') oy += (a.amount ?? 0.25) * Math.sin(Math.PI * k);
              else if (effect === 'spin') rot -= 360 * (a.amount ?? 1) * smooth(k);
              else {
                // Flyr vekk fra det som skremte den, opp og ut av bildet
                ox += st.dir * 7 * k * k;
                oy += 3.5 * k;
                alpha *= 1 - smooth(k);
              }
              if (k >= 1) {
                st.rt = -1;
                st.cd = 0.4;
                if (effect === 'flee') st.gone = Math.max(0.8, a.back ?? 8);
              }
            } else if (st.gone > 0) {
              // Borte en stund, så tones den inn igjen der den hørte hjemme
              st.gone -= dt;
              alpha *= st.gone > 0.8 ? 0 : smooth(1 - Math.max(0, st.gone) / 0.8);
            }
            break;
          }
        }
      }
      it.pivot.position.set(it.rest[0] + ox, it.rest[1] + oy, 0);
      it.pivot.rotation.z = THREE.MathUtils.degToRad(rot);
      it.pivot.scale.set(sx, sy, 1);
      u.uGlow.value = glow;
      u.opacity.value = alpha;
      // Lysene følger punktet sitt og blafrer med (også når rekvisitten er en del av en annen)
      if (it.lights.length) {
        it.pivot.updateWorldMatrix(true, false);
        for (const l of it.lights) {
          l.src.pos.copy(tmpV.copy(l.at)).applyMatrix4(it.pivot.matrixWorld);
          l.src.intensity = l.base * glow;
        }
      }
      if (it.fireAt.length) {
        it.fireAcc += dt;
        if (it.fireAcc > 0.07 && alpha > 0.5) {
          it.fireAcc = 0;
          it.pivot.updateWorldMatrix(true, false);
          for (const f of it.fireAt) this.gore.fire(tmpV.copy(f).applyMatrix4(it.pivot.matrixWorld), 1, 0.06, 1.2);
        }
      }
      // Forgrunnen tones ut når en figur står bak den
      if (it.fades) {
        const goal = fighters && this.covers(it, fighters) ? 0.4 : 1;
        it.fade += (goal - it.fade) * (1 - Math.exp(-dt * 10));
        u.uFade.value = this.editor ? 1 : it.fade;
      }
    }
    this.pokes.length = 0;
  }

  /** Punkter på figurene (hode, bryst, føtter og sidene) som kan skjules av forgrunnen. */
  private fighterPoints() {
    const out: THREE.Vector3[] = [];
    for (const f of this.fighters!()) {
      for (const dy of [0.12, 0.45, 0.8]) for (const dx of [-0.3, 0, 0.3]) out.push(new THREE.Vector3(f.x + dx * f.w, f.y + dy * f.h, f.z));
    }
    return out;
  }

  /**
   * Dekker kulissen noen av punktene? Linja fra kameraet til punktet skjærer kulissens plan, og der sjekkes
   * gjennomsiktigheten i bildet, så bare selve stammen (ikke de tomme hjørnene) tones ut.
   */
  private covers(it: SceneryItem, pts: THREE.Vector3[]) {
    const cam = this.camera!;
    const art = artFor(it.kind);
    if (!art || !pts.length) return false;
    const mesh = it.mesh!;
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    mesh.updateMatrixWorld();
    const planeZ = tmpV.setFromMatrixPosition(mesh.matrixWorld).z;
    const u = it.mat!.uniforms;
    const off = u.uUvOff.value as THREE.Vector2, rep = u.uUvRep.value as THREE.Vector2;
    const C = cam.position;
    const q = new THREE.Vector3();
    for (const p of pts) {
      if (p.z >= planeZ || C.z <= planeZ) continue;
      const t = (planeZ - C.z) / (p.z - C.z);
      q.copy(p).sub(C).multiplyScalar(t).add(C);
      mesh.worldToLocal(q);
      const uu = (q.x - bb.min.x) / (bb.max.x - bb.min.x), vv = (q.y - bb.min.y) / (bb.max.y - bb.min.y);
      if (uu < 0 || uu > 1 || vv < 0 || vv > 1) continue;
      const su = off.x + uu * rep.x, sv = off.y + vv * rep.y;
      const px = Math.min(art.alpha.w - 1, Math.max(0, Math.floor(su * art.alpha.w)));
      const py = Math.min(art.alpha.h - 1, Math.max(0, Math.floor((1 - sv) * art.alpha.h)));
      if (art.alpha.a[py * art.alpha.w + px] > 80) return true;
    }
    return false;
  }

  /**
   * Rekvisitten under et stråle (musa i editoren). Gjennomsiktige deler av bildene slipper stråla gjennom.
   * Gir nøkkelen (plasseringens id, eller "rad#nummer").
   */
  pick(ray: THREE.Raycaster, skip?: (key: string) => boolean): { key: string; point: THREE.Vector3 } | null {
    const hits = ray.intersectObject(this.group, true);
    for (const h of hits) {
      const key = findKey(h.object);
      if (!key || skip?.(key)) continue;
      const it = this.items.get(key);
      if (!it) continue;
      if (it.mesh && h.object === it.mesh && h.uv) {
        const art = artFor(it.kind);
        if (art) {
          const u = it.mat!.uniforms;
          const off = u.uUvOff.value as THREE.Vector2, rep = u.uUvRep.value as THREE.Vector2;
          const uu = off.x + h.uv.x * rep.x, vv = off.y + h.uv.y * rep.y;
          const px = Math.min(art.alpha.w - 1, Math.max(0, Math.floor(uu * art.alpha.w)));
          const py = Math.min(art.alpha.h - 1, Math.max(0, Math.floor((1 - vv) * art.alpha.h)));
          if (art.alpha.a[py * art.alpha.w + px] < 60) continue;
        }
      }
      return { key, point: h.point.clone() };
    }
    return null;
  }

  /** Boksen rundt en rekvisitt i verden (til markering i editoren). */
  bounds(key: string, out = new THREE.Box3()) {
    const it = this.items.get(key);
    if (!it) return null;
    return out.setFromObject(it.root);
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}

function findKey(o: THREE.Object3D | null): string | null {
  while (o) {
    if (typeof o.userData.sceneryKey === 'string') return o.userData.sceneryKey;
    o = o.parent;
  }
  return null;
}

/** Plasseringene i en rad (samme hver gang: raden har sitt eget frø). */
export function expandRun(r: PropRun): PropPlacement[] {
  const rnd = seeded(r.seed ?? hashSeed(r.id));
  const out: PropPlacement[] = [];
  // Varianter trekkes etter de andre tallene, så rader uten varianter står som før
  const pool = r.variants?.length ? [r.prop, ...r.variants] : null;
  const step = Math.max(0.05, r.step);
  const lo = Math.min(r.x0, r.x1), hi = Math.max(r.x0, r.x1);
  for (let x = lo, i = 0; x <= hi + 1e-6 && i < 2000; x += step, i++) {
    const jx = (rnd() - 0.5) * 2 * (r.jitter ?? 0);
    const jz = (rnd() - 0.5) * 2 * (r.zJitter ?? 0);
    const js = 1 + (rnd() - 0.5) * 2 * (r.scaleJitter ?? 0);
    const flip = r.flipRandom ? rnd() < 0.5 : false;
    const prop = pool ? pool[Math.floor(rnd() * pool.length)] : r.prop;
    const px = x + jx;
    if ((r.gaps ?? []).some(([a, b]) => px > Math.min(a, b) && px < Math.max(a, b))) continue;
    out.push({
      id: r.id + '#' + i, prop, layer: r.layer, x: px, y: r.y, z: r.z + jz, scale: (r.scale ?? 1) * js, flip,
      tint: r.tint, anim: r.anim, dark: r.dark, fade: r.fade, shadow: r.shadow,
    });
  }
  return out;
}

/** Dybdeområdet for et lag (til editoren). */
export function layerRange(layer: PropPlacement['layer']) {
  return LAYERS[layer].z;
}
