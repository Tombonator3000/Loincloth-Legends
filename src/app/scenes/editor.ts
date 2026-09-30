// Brettverkstedet (STAGE FORGE): en visuell editor for brettene. Rekvisitter i fire lag (FAR, BACK, MID, FRONT) med
// animasjon, rader, generatorbrytere og spilldata (bølger, tønner, farer, ryttere) på en tidslinje. Bygger brettet
// med de samme miljøbyggerne og kulissene som spillet (gfx/env, gfx/scenery.ts), så det Tom ser, er det spillet viser.
// Lagrer brettfila i src/data/layouts under npm run dev (tools/vite-stage-forge.ts), ellers som nedlasting.
// Knappene er på engelsk som resten av spillet. Se docs/STAGE_FORGE.md.
import * as THREE from 'three';
import '../../editor/editor.css';
import type { Scene } from '../scene';
import type { Game } from '../game';
import { W } from '../../game/world';
import { STAGE_BUILDERS } from '../../gfx/env';
import { resetGenerators, usedGenerators } from '../../gfx/env/common';
import { buildHazard } from '../../gfx/env/hazards';
import { STAGE_CAM } from '../../gfx/stagecam';
import { Scenery, expandRun } from '../../gfx/scenery';
import { allProps, propKind, propIds, type PropKind } from '../../gfx/props/catalog';
import { LEVELS, type LevelDef } from '../../data/levels';
import { FOES } from '../../data/enemies';
import { MOUNTS } from '../../data/mounts';
import { chasmHole, type HazardKind } from '../../data/hazards';
import { layoutFor, setUnsavedLayout } from '../../data/layouts';
import {
  LAYERS, LAYER_IDS, LANE_Z, ANIM_TYPES, TRACK_CHANNELS, WAVE_FROM, REACT_ON, REACT_EFFECTS, emptyLayout, levelWithLayout, validateLayout,
  waveToLayout, layerDefaults,
  type LevelLayout, type LayerId, type PresetPart, type PropAnim, type PropPlacement, type PropRun, type PropAnimType, type TrackChannel,
} from '../../data/layout';
import { withSeed, hashSeed, clamp } from '../../core/math';
import { isTyping } from '../../core/input';
import { History } from '../../editor/history';
import { Markers } from '../../editor/markers';
import { saveLayout, saveImages, importImage, readLayoutFile, editableMeta, setMeta, unsavedImages, canSave, download } from '../../editor/io';
import { layoutToJson } from '../../data/layout';

type Sel =
  | { type: 'prop'; id: string }
  | { type: 'run'; id: string }
  | { type: 'wave'; i: number }
  | { type: 'barrel'; i: number }
  | { type: 'hazard'; i: number };

/** Det editoren husker mellom ombygginger og testspill (samme brett). */
interface ForgeState {
  level: string;
  layout: LevelLayout;
  history: History;
  camX: number;
  overview: boolean;
  sel: Sel | null;
  active: LayerId;
  hidden: Set<LayerId>;
  locked: Set<LayerId>;
  dirty: boolean;
  tab: 'all' | 'painted' | 'image' | 'model';
  filter: string;
  snap: boolean;
}
let state: ForgeState | null = null;

/** Editorens tilstand for testene (window.__lib). */
export function forgeState() {
  return state;
}

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const HAZARD_KINDS: HazardKind[] = ['spikes', 'bog', 'icehole', 'lava', 'spiketrap', 'chasm'];
const BARREL_KINDS = ['chicken', 'ham', 'potion', 'gold', 'egg', 'coin'];

/** Grunnavnet til en variant: palisade_a, palisade_b og palisade_2 er varianter av palisade. */
export function variantBase(id: string) {
  return id.replace(/_(?:v?\d{1,2}|[a-z])$/, '');
}
/** De andre variantene av en rekvisitt (samme grunnavn), i bibliotekets rekkefølge. */
export function variantsOf(id: string) {
  const b = variantBase(id);
  return allProps().filter((k) => k.id !== id && variantBase(k.id) === b).map((k) => k.id);
}

function newState(level: string): ForgeState {
  const saved = layoutFor(level);
  const layout = saved ? clone(saved) : emptyLayout(level);
  layout.runs ??= [];
  return {
    level, layout, history: new History(), camX: 4, overview: false, sel: null, active: 'mid',
    hidden: new Set(), locked: new Set(), dirty: false, tab: 'all', filter: '', snap: true,
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null | undefined | false)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids) if (k) e.append(k);
  return e;
}
function btn(text: string, onClick: () => void, title = '', on = false) {
  const b = el('button', { text, title });
  if (on) b.classList.add('on');
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export class EditorScene implements Scene {
  name = 'editor';
  pausable = false;
  private st: ForgeState;
  private scenery: Scenery;
  private markers = new Markers();
  private selBox = new THREE.Box3Helper(new THREE.Box3(), 0xffd070);
  private root: HTMLDivElement;
  private ui: {
    top: HTMLDivElement; lib: HTMLDivElement; props: HTMLDivElement; time: HTMLDivElement; timeCanvas: HTMLCanvasElement;
    help: HTMLDivElement; toast: HTMLDivElement; status: HTMLSpanElement; list: HTMLDivElement;
  };
  private ray = new THREE.Raycaster();
  private drag: null | {
    kind: 'move' | 'pan' | 'time';
    start: { x: number; y: number };
    last: { x: number; y: number };
    orig?: PropPlacement | PropRun;
    grab?: THREE.Vector3;
    pushed: boolean;
    roots?: { o: THREE.Object3D; p: THREE.Vector3 }[];
  } = null;
  private toastT = 0;
  private listeners: [EventTarget, string, EventListener][] = [];
  private topWatch: ResizeObserver;
  private level: LevelDef;
  private camTarget = new THREE.Vector3();
  private disposed = false;
  private warnings: { text: string; sel?: Sel }[] = [];

  constructor(private game: Game, levelId?: string) {
    const id = levelId ?? state?.level ?? 'road';
    if (!state || state.level !== id) state = newState(id);
    this.st = state;
    this.level = levelWithLayout(LEVELS[id], this.st.layout);
    game.hud.visible(false);
    game.screens.hide();
    this.scenery = this.buildWorld();
    W.scene.add(this.markers.group);
    W.scene.add(this.selBox);
    this.selBox.visible = false;
    this.root = el('div', { id: 'forge' });
    this.ui = this.buildUI();
    document.body.appendChild(this.root);
    // Panelene starter under toppraden, som brytes i to linjer på smale skjermer
    this.topWatch = new ResizeObserver(() => this.root.style.setProperty('--fg-under-top', this.ui.top.offsetHeight + 16 + 'px'));
    this.topWatch.observe(this.ui.top);
    this.bindInput();
    this.refreshAll();
    const cam = game.camera;
    cam.position.set(this.st.camX, STAGE_CAM.y, STAGE_CAM.z);
    this.updateCamera(1);
  }

  // ---------------------------------------------------------------- verden
  /** Miljøet og kulissene som i Stage (samme frø og generatorer), uten figurer. */
  private buildWorld() {
    const lv = this.level;
    const layout = this.st.layout;
    const build = STAGE_BUILDERS[lv.biome] ?? STAGE_BUILDERS.grass;
    const holes = (lv.hazards ?? []).filter((h) => h.kind === 'chasm').map(chasmHole);
    const seed = layout.seed ?? hashSeed(lv.id);
    resetGenerators();
    const env = withSeed(seed, () => build(W.scene, W.gore, {
      length: lv.length, finale: lv.finale.type, gateTitle: lv.gateTitle, gateSub: lv.gateSub,
      bossX: lv.length - 16 + 2, bossSign: lv.bossSign, holes, seed, gen: layout.generators,
    }));
    W.env = env;
    env.generators = usedGenerators();
    W.gore.bounds = { minX: -8, maxX: lv.length + 5, minZ: -6, maxZ: 5 };
    W.gore.holes = holes;
    withSeed(seed ^ 0x27d4eb2f, () => {
      for (const h of lv.hazards ?? []) buildHazard(env.group, W.gore, h);
    });
    const sc = new Scenery(W.gore, env, this.game.camera);
    sc.editor = true;
    env.group.add(sc.group);
    sc.load(layout);
    const envUpdate = env.update.bind(env);
    env.update = (dt, t, camX) => {
      envUpdate(dt, t, camX);
      sc.tick(dt);
    };
    this.applyLayerVisibility(sc);
    this.markers.build(lv, this.selKey());
    return sc;
  }

  /** Bygg hele verdenen på nytt (generatorer, frø, lengde og farer krever det). Tilstanden beholdes. */
  private rebuild() {
    this.st.camX = this.game.camera.position.x;
    this.game.openEditor(this.st.level);
  }

  private applyLayerVisibility(sc = this.scenery) {
    for (const it of sc.items.values()) it.root.visible = !this.st.hidden.has(it.place.layer);
  }

  // ---------------------------------------------------------------- endringer
  /** Før hver endring: husk tilstanden (angre) og merk at noe ikke er lagret. */
  private change() {
    this.st.history.push(this.st.layout);
    this.st.dirty = true;
    setUnsavedLayout(this.st.level, this.st.layout);
  }

  private commitProp(p: PropPlacement) {
    const props = this.st.layout.props;
    const i = props.findIndex((q) => q.id === p.id);
    const old = i >= 0 ? props[i] : null;
    if (i >= 0) props[i] = p;
    else props.push(p);
    this.scenery.move(p);
    if (old) this.carryParts(old, p);
    this.applyLayerVisibility();
    setUnsavedLayout(this.st.level, this.st.layout);
  }

  // ---------------------------------------------------------------- deler
  /** Alle delene under en rekvisitt (også delenes deler). */
  private descendants(id: string): PropPlacement[] {
    const out: PropPlacement[] = [];
    const walk = (pid: string) => {
      for (const q of this.st.layout.props) {
        if (q.parent !== pid || out.includes(q)) continue;
        out.push(q);
        walk(q.id);
      }
    };
    walk(id);
    return out;
  }

  /**
   * Delene følger rekvisitten de henger på: flyttes den, flyttes de like mye. Skaleres, speilvendes eller vris den,
   * gjør delene det samme rundt leddet dens, som om de satt fast.
   */
  private carryParts(old: PropPlacement, p: PropPlacement) {
    const parts = this.descendants(p.id);
    if (!parts.length) return;
    const same = old.x === p.x && (old.y ?? 0) === (p.y ?? 0) && old.z === p.z && (old.scale ?? 1) === (p.scale ?? 1) && !!old.flip === !!p.flip && (old.rot ?? 0) === (p.rot ?? 0);
    if (same) return;
    const k = (p.scale ?? 1) / (old.scale ?? 1);
    const flipped = !!old.flip !== !!p.flip;
    const f1 = p.flip ? -1 : 1;
    const da = THREE.MathUtils.degToRad(((p.rot ?? 0) - (old.rot ?? 0)) * f1);
    const cos = Math.cos(da), sin = Math.sin(da);
    const props = this.st.layout.props;
    for (const c of parts) {
      // Avstanden fra forelderens fotpunkt, skalert, speilvendt og vridd som forelderen, og lagt til den nye plassen
      let ox = (c.x - old.x) * k, oy = ((c.y ?? 0) - (old.y ?? 0)) * k;
      if (flipped) ox = -ox;
      [ox, oy] = [ox * cos - oy * sin, ox * sin + oy * cos];
      const n: PropPlacement = { ...c, x: r3(p.x + ox), z: r3(p.z + (c.z - old.z)) };
      const ny = r3((p.y ?? 0) + oy);
      if (ny) n.y = ny;
      else delete n.y;
      if (k !== 1) n.scale = r3((c.scale ?? 1) * k);
      if (flipped) {
        n.flip = !c.flip || undefined;
        if (c.rot) n.rot = r3(-c.rot);
      }
      if (da) n.rot = r3((n.rot ?? c.rot ?? 0) + ((p.rot ?? 0) - (old.rot ?? 0))) || undefined;
      props[props.findIndex((q) => q.id === c.id)] = n;
      this.scenery.move(n);
    }
  }

  /** Legg ut en del som henger på rekvisitten (litt foran, så den tegnes over). */
  private addPart(parent: PropPlacement, kind: PropKind) {
    this.change();
    const it = this.scenery.items.get(parent.id);
    const h = it ? it.size[1] * (parent.scale ?? 1) : 1;
    const p: PropPlacement = { id: this.newId(), prop: kind.id, parent: parent.id, layer: parent.layer, x: parent.x, y: r3((parent.y ?? 0) + h * 0.5), z: r3(parent.z + 0.02) };
    this.commitProp(p);
    this.select({ type: 'prop', id: p.id });
    this.toast('ADDED PART ' + kind.label);
  }

  /** Lagre delene som et sett på bildet (manifestet), så neste gang legges hele settet ut med ett klikk. */
  private saveAsSet(p: PropPlacement) {
    const meta = editableMeta(p.prop);
    if (!meta) return;
    const s = p.scale ?? 1, f = p.flip ? -1 : 1;
    // Alle delene, også de som henger på en annen del (flammen i lykta): on er nummeret på den delen
    const parts = this.descendants(p.id);
    const preset: PresetPart[] = parts.map((c) => {
      const part: PresetPart = { prop: c.prop, dx: r3(((c.x - p.x) / s) * f), dy: r3(((c.y ?? 0) - (p.y ?? 0)) / s), dz: r3(c.z - p.z) };
      if (c.parent !== p.id) part.on = parts.findIndex((q) => q.id === c.parent);
      if ((c.scale ?? 1) !== s) part.scale = r3((c.scale ?? 1) / s);
      if (!!c.flip !== !!p.flip) part.flip = true;
      if (c.rot) part.rot = r3(c.rot * f);
      if (c.anim) part.anim = clone(c.anim);
      return part;
    });
    setMeta(p.prop, { ...meta, preset });
    this.st.dirty = true;
    this.renderLibrary();
    this.renderTop();
    this.toast(`SET SAVED ON ${p.prop.toUpperCase()}: ${preset.length} PART(S). SAVE WRITES IT TO THE MANIFEST`, 4);
  }

  private commitRun(r: PropRun) {
    const runs = (this.st.layout.runs ??= []);
    const i = runs.findIndex((q) => q.id === r.id);
    if (i >= 0) runs[i] = r;
    else runs.push(r);
    this.scenery.setRun(r);
    this.applyLayerVisibility();
    setUnsavedLayout(this.st.level, this.st.layout);
  }

  private newId(prefix = 'p') {
    const used = new Set([...this.st.layout.props.map((p) => p.id), ...(this.st.layout.runs ?? []).map((r) => r.id)]);
    let n = used.size + 1;
    while (used.has(prefix + n)) n++;
    return prefix + n;
  }

  /** Legg ut en rekvisitt midt i bildet (eller der musa slapp den). Forhåndsinnstillinger legger ut flere. */
  addProp(kind: PropKind, at?: { x: number; y?: number; z?: number }, layer?: LayerId) {
    this.change();
    const L = layer ?? kind.layer ?? this.st.active;
    const z = r3(at?.z ?? LAYERS[L].def);
    // Forgrunnen legges ut mot venstre kant, så den rammer inn bildet i stedet for å dekke midten
    const cam = this.game.camera;
    const halfAt = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.max(1, cam.position.z - z) * cam.aspect;
    const x = r3(at?.x ?? (L === 'front' ? cam.position.x - halfAt * 0.62 : cam.position.x));
    const p: PropPlacement = { id: this.newId(), prop: kind.id, layer: L, x, z };
    if (at?.y) p.y = r3(at.y);
    this.commitProp(p);
    // Et sett: delene henges på rekvisitten (eller på en annen del, on) og følger den
    const made: string[] = [];
    for (const part of kind.preset ?? []) {
      const k2 = propKind(part.prop);
      const id = this.newId();
      made.push(k2 ? id : '');
      if (!k2) continue;
      const parent = (part.on !== undefined && made[part.on]) || p.id;
      const q: PropPlacement = { id, prop: k2.id, parent, layer: L, x: r3(x + part.dx), y: r3((p.y ?? 0) + part.dy), z: r3(z + (part.dz ?? 0)) };
      if (part.scale) q.scale = part.scale;
      if (part.flip) q.flip = true;
      if (part.rot) q.rot = part.rot;
      if (part.anim) q.anim = clone(part.anim);
      if (!q.y) delete q.y;
      this.commitProp(q);
    }
    this.select({ type: 'prop', id: p.id });
    this.toast('ADDED ' + kind.label);
    return p;
  }

  /** En rad av rekvisitten rundt kameraet (palisade, gjerde). */
  addRun(kind: PropKind) {
    this.change();
    const L = kind.layer ?? this.st.active;
    const cx = this.game.camera.position.x;
    const step = kind.build ? 3 : r3((kind.w ?? 2) * 0.96);
    const r: PropRun = { id: this.newId('row'), prop: kind.id, layer: L, x0: r3(cx - 8), x1: r3(cx + 8), z: LAYERS[L].def, step, jitter: 0.08, zJitter: 0.1, flipRandom: !kind.build };
    this.commitRun(r);
    this.select({ type: 'run', id: r.id });
    this.toast('ADDED ROW OF ' + kind.label);
  }

  private selected(): PropPlacement | PropRun | null {
    const s = this.st.sel;
    if (!s) return null;
    if (s.type === 'prop') return this.st.layout.props.find((p) => p.id === s.id) ?? null;
    if (s.type === 'run') return (this.st.layout.runs ?? []).find((r) => r.id === s.id) ?? null;
    return null;
  }

  private selKey() {
    const s = this.st.sel;
    if (!s) return null;
    return s.type === 'prop' || s.type === 'run' ? s.type + ':' + s.id : s.type + ':' + s.i;
  }

  select(s: Sel | null) {
    this.st.sel = s;
    this.markers.build(this.level, this.selKey());
    this.renderTop();
    this.renderProps();
    this.renderTimeline();
  }

  deleteSelected() {
    const s = this.st.sel;
    if (!s) return;
    this.change();
    const lay = this.st.layout;
    if (s.type === 'prop') {
      lay.props = lay.props.filter((p) => p.id !== s.id);
      this.scenery.remove(s.id);
      // Delene blir liggende der de er, løse
      for (const c of lay.props.filter((q) => q.parent === s.id)) {
        const n = { ...c };
        delete n.parent;
        this.commitProp(n);
      }
    } else if (s.type === 'run') {
      lay.runs = (lay.runs ?? []).filter((r) => r.id !== s.id);
      this.scenery.remove(s.id);
    } else if (s.type === 'wave') {
      this.takeGameplay('waves');
      lay.waves!.splice(s.i, 1);
      lay.riders = (lay.riders ?? this.level.riders ?? []).filter((r) => r[0] !== s.i).map((r) => (r[0] > s.i ? [r[0] - 1, r[1], r[2]] : r) as [number, string, string]);
      this.gameplayChanged(false);
    } else if (s.type === 'barrel') {
      this.takeGameplay('barrels');
      lay.barrels!.splice(s.i, 1);
      this.gameplayChanged(false);
    } else if (s.type === 'hazard') {
      this.takeGameplay('hazards');
      lay.hazards!.splice(s.i, 1);
      this.gameplayChanged(true);
      return;
    }
    this.select(null);
  }

  duplicateSelected() {
    const cur = this.selected();
    const s = this.st.sel;
    if (!cur || !s) return;
    this.change();
    if (s.type === 'prop') {
      const src = cur as PropPlacement;
      const p = { ...clone(src), id: this.newId(), x: r3(src.x + 1.5) };
      this.commitProp(p);
      // Delene blir med, hengt på kopien
      const ids = new Map<string, string>([[src.id, p.id]]);
      for (const c of this.descendants(src.id)) {
        const n = { ...clone(c), id: this.newId(), x: r3(c.x + 1.5), parent: ids.get(c.parent!) ?? p.id };
        ids.set(c.id, n.id);
        this.commitProp(n);
      }
      this.select({ type: 'prop', id: p.id });
    } else if (s.type === 'run') {
      const r = clone(cur as PropRun);
      const w = r.x1 - r.x0;
      Object.assign(r, { id: this.newId('row'), x0: r3(r.x1 + r.step), x1: r3(r.x1 + r.step + w) });
      this.commitRun(r);
      this.select({ type: 'run', id: r.id });
    }
  }

  undo() {
    const l = this.st.history.undo(this.st.layout);
    if (l) this.restore(l, 'UNDO');
  }
  redo() {
    const l = this.st.history.redo(this.st.layout);
    if (l) this.restore(l, 'REDO');
  }
  private restore(l: LevelLayout, word: string) {
    const needWorld = JSON.stringify([l.generators, l.seed, l.length, l.hazards]) !== JSON.stringify([this.st.layout.generators, this.st.layout.seed, this.st.layout.length, this.st.layout.hazards]);
    this.st.layout = l;
    l.runs ??= [];
    this.st.dirty = true;
    setUnsavedLayout(this.st.level, l);
    this.toast(word);
    if (needWorld) return this.rebuild();
    this.level = levelWithLayout(LEVELS[this.st.level], l);
    this.scenery.load(l);
    this.applyLayerVisibility();
    if (this.selected() === null && (this.st.sel?.type === 'prop' || this.st.sel?.type === 'run')) this.st.sel = null;
    this.markers.build(this.level, this.selKey());
    this.refreshAll();
  }

  async save() {
    try {
      const imgs = unsavedImages() ? await saveImages() : 0;
      const how = await saveLayout(this.st.layout);
      this.st.dirty = false;
      this.toast(how === 'saved' ? `SAVED src/data/layouts/${this.st.level}.json` + (imgs ? ` + ${imgs} IMAGE(S)` : '') : `DOWNLOADED ${this.st.level}.json (RUN npm run dev TO SAVE INTO THE REPO)`, 4);
    } catch (e) {
      this.toast('SAVE FAILED: ' + String((e as Error).message ?? e).toUpperCase(), 6);
    }
    this.renderTop();
  }

  /** Spill brettet fra der kameraet står, med brettfila slik den er nå. Pausemenyen går tilbake hit. */
  playHere() {
    this.st.camX = this.game.camera.position.x;
    setUnsavedLayout(this.st.level, this.st.layout);
    this.game.testLevel(this.st.level, this.st.camX);
  }

  // ---------------------------------------------------------------- spilldata
  /** Første gang bølger, tønner, farer eller ryttere endres, kopieres de fra levels.ts inn i brettfila. */
  private takeGameplay(what: 'waves' | 'barrels' | 'hazards' | 'riders') {
    const lay = this.st.layout, lv = this.level;
    if (what === 'waves' && !lay.waves) lay.waves = lv.waves.map(waveToLayout);
    if (what === 'barrels' && !lay.barrels) lay.barrels = lv.barrels.map(([x, k]) => [x, String(k)] as [number, string]);
    if (what === 'hazards' && !lay.hazards) lay.hazards = (lv.hazards ?? []).map((h) => ({ ...h }));
    if (what === 'riders' && !lay.riders) lay.riders = (lv.riders ?? []).map((r) => [...r] as [number, string, string]);
  }

  private gameplayChanged(world: boolean) {
    this.level = levelWithLayout(LEVELS[this.st.level], this.st.layout);
    setUnsavedLayout(this.st.level, this.st.layout);
    if (world) return this.rebuild();
    this.markers.build(this.level, this.selKey());
    this.renderProps();
    this.renderTimeline();
    this.renderTop();
  }

  addWave() {
    this.change();
    this.takeGameplay('waves');
    const at = r3(this.game.camera.position.x);
    const waves = this.st.layout.waves!;
    waves.push({ at, maxAlive: 4, spawns: 'skeleton:R:0.2 skeleton:L:1.0' });
    waves.sort((a, b) => a.at - b.at);
    this.gameplayChanged(false);
    this.select({ type: 'wave', i: waves.findIndex((w) => w.at === at) });
  }
  addBarrel() {
    this.change();
    this.takeGameplay('barrels');
    const x = r3(this.game.camera.position.x);
    this.st.layout.barrels!.push([x, 'chicken']);
    this.gameplayChanged(false);
    this.select({ type: 'barrel', i: this.st.layout.barrels!.length - 1 });
  }
  addHazard() {
    this.change();
    this.takeGameplay('hazards');
    const biome = this.level.biome;
    const kind: HazardKind = biome === 'swamp' ? 'bog' : biome === 'frost' ? 'icehole' : biome === 'scorch' ? 'lava' : biome === 'tower' ? 'spiketrap' : 'spikes';
    this.st.layout.hazards!.push({ kind, x: r3(this.game.camera.position.x), z: -1.85, w: 3, d: 1.3 });
    this.st.sel = { type: 'hazard', i: this.st.layout.hazards!.length - 1 };
    this.gameplayChanged(true);
  }

  // ---------------------------------------------------------------- kamera
  private updateCamera(k: number) {
    const cam = this.game.camera;
    const L = this.level.length;
    this.st.camX = clamp(this.st.camX, -12, L + 12);
    const far = this.st.overview;
    const z = (cam.aspect < 1.2 ? STAGE_CAM.zNarrow : STAGE_CAM.z) + (far ? 16 : 0);
    const y = STAGE_CAM.y + (far ? 6 : 0);
    cam.position.x += (this.st.camX - cam.position.x) * k;
    cam.position.y += (y - cam.position.y) * k;
    cam.position.z += (z - cam.position.z) * k;
    this.camTarget.set(cam.position.x, STAGE_CAM.lookY + (far ? 1 : 0), 0);
    cam.lookAt(this.camTarget);
  }

  update(dt: number, realDt: number) {
    if (this.disposed) return;
    const inp = this.game.input;
    // A/D og piltastene flytter kameraet når ingenting er valgt
    if (!this.st.sel || this.st.sel.type === 'wave' || this.st.sel.type === 'barrel' || this.st.sel.type === 'hazard') {
      const fast = inp.keys.has('ShiftLeft') || inp.keys.has('ShiftRight') ? 3 : 1;
      if (inp.keys.has('KeyA') || inp.keys.has('ArrowLeft')) this.st.camX -= realDt * 14 * fast;
      if (inp.keys.has('KeyD') || inp.keys.has('ArrowRight')) this.st.camX += realDt * 14 * fast;
    }
    this.updateCamera(Math.min(1, realDt * 10));
    // Markering rundt det som er valgt
    const key = this.st.sel?.type === 'prop' ? this.st.sel.id : this.st.sel?.type === 'run' ? this.st.sel.id + '#' : null;
    if (key) {
      const box = this.selBox.box.makeEmpty();
      const tmp = new THREE.Box3();
      for (const [k, it] of this.scenery.items) {
        if (k === key || (key.endsWith('#') && k.startsWith(key))) box.union(tmp.setFromObject(it.root));
      }
      this.selBox.visible = !box.isEmpty();
    } else this.selBox.visible = false;
    if (this.toastT > 0) {
      this.toastT -= realDt;
      if (this.toastT <= 0) this.ui.toast.classList.remove('show');
    }
    this.drawViewOnTimeline();
    void dt;
  }

  exit() {
    this.disposed = true;
    this.topWatch.disconnect();
    for (const [t, ev, fn] of this.listeners) t.removeEventListener(ev, fn);
    this.listeners.length = 0;
    this.root.remove();
    this.markers.dispose();
    this.selBox.removeFromParent();
    this.scenery.dispose();
  }

  // ---------------------------------------------------------------- mus og tastatur
  private on(t: EventTarget, ev: string, fn: (e: never) => void, opts?: AddEventListenerOptions) {
    t.addEventListener(ev, fn as EventListener, opts);
    this.listeners.push([t, ev, fn as EventListener]);
  }

  private ndc(e: { clientX: number; clientY: number }) {
    const r = this.game.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  /** Punktet i planet z = pz under musa. */
  private onPlane(e: { clientX: number; clientY: number }, pz: number) {
    this.ray.setFromCamera(this.ndc(e), this.game.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -pz);
    return this.ray.ray.intersectPlane(plane, new THREE.Vector3());
  }

  private bindInput() {
    const cv = this.game.canvas;
    this.on(cv, 'contextmenu', (e: MouseEvent) => e.preventDefault());
    this.on(cv, 'pointerdown', (e: PointerEvent) => this.pointerDown(e));
    this.on(window, 'pointermove', (e: PointerEvent) => this.pointerMove(e));
    this.on(window, 'pointerup', (e: PointerEvent) => this.pointerUp(e));
    this.on(cv, 'wheel', (e: WheelEvent) => this.wheel(e), { passive: false });
    this.on(window, 'keydown', (e: KeyboardEvent) => this.key(e));
    // Bilder dratt inn fra datamaskinen, og rekvisitter dratt fra biblioteket
    this.on(window, 'dragover', (e: DragEvent) => {
      e.preventDefault();
      this.root.classList.add('dragging');
    });
    this.on(window, 'dragleave', () => this.root.classList.remove('dragging'));
    this.on(window, 'drop', (e: DragEvent) => void this.drop(e));
  }

  private pointerDown(e: PointerEvent) {
    const cv = this.game.canvas;
    if (e.button === 1 || e.button === 2) {
      this.drag = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, last: { x: e.clientX, y: e.clientY }, pushed: false };
      cv.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    this.ray.setFromCamera(this.ndc(e), this.game.camera);
    const hit = this.scenery.pick(this.ray, (key) => {
      const it = this.scenery.items.get(key);
      if (!it) return true;
      const layer = it.place.layer;
      const placed = it.runId ? (this.st.layout.runs ?? []).find((r) => r.id === it.runId) : this.st.layout.props.find((p) => p.id === key);
      return this.st.hidden.has(layer) || this.st.locked.has(layer) || !!(placed as PropPlacement | undefined)?.locked;
    });
    if (!hit) {
      this.select(null);
      return;
    }
    const it = this.scenery.items.get(hit.key)!;
    if (it.runId) this.select({ type: 'run', id: it.runId });
    else this.select({ type: 'prop', id: hit.key });
    const cur = this.selected();
    if (!cur) return;
    const z = 'z' in cur ? cur.z : 0;
    this.drag = {
      kind: 'move', start: { x: e.clientX, y: e.clientY }, last: { x: e.clientX, y: e.clientY }, orig: clone(cur),
      grab: this.onPlane(e, z) ?? undefined, pushed: false,
      roots: [...this.scenery.items.entries()].filter(([k]) => k === hit.key || (it.runId && k.startsWith(it.runId + '#'))).map(([, i]) => ({ o: i.root, p: i.root.position.clone() })),
    };
    cv.setPointerCapture(e.pointerId);
  }

  private pointerMove(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.last.x, dy = e.clientY - d.last.y;
    d.last = { x: e.clientX, y: e.clientY };
    if (d.kind === 'pan') {
      const cam = this.game.camera;
      const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z) / this.game.canvas.clientHeight;
      this.st.camX -= dx * worldPerPx;
      return;
    }
    if (d.kind !== 'move' || !d.orig) return;
    if (!d.pushed && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) < 3) return;
    if (!d.pushed) {
      this.change();
      d.pushed = true;
    }
    const o = d.orig;
    const z0 = 'x0' in o ? o.z : o.z;
    let mx = 0, my = 0, mz = 0;
    if (e.shiftKey) {
      // Shift: dybden (opp = lenger bak)
      mz = -(e.clientY - d.start.y) * 0.03;
    } else {
      const pnt = this.onPlane(e, z0);
      if (pnt && d.grab) {
        mx = pnt.x - d.grab.x;
        if (e.altKey) my = pnt.y - d.grab.y;
      }
    }
    if (this.st.snap && !e.ctrlKey) {
      mx = Math.round(mx * 4) / 4;
      my = Math.round(my * 4) / 4;
      mz = Math.round(mz * 10) / 10;
    }
    // Under draget flyttes bare det som synes; brettfila oppdateres når musa slippes
    for (const r of d.roots ?? []) r.o.position.set(r.p.x + mx, r.p.y + my, r.p.z + mz);
    (d as { delta?: [number, number, number] }).delta = [mx, my, mz];
    void dy;
  }

  private pointerUp(e: PointerEvent) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'move' && d.pushed && d.orig) {
      const [mx, my, mz] = (d as { delta?: [number, number, number] }).delta ?? [0, 0, 0];
      const o = clone(d.orig);
      if ('x0' in o) {
        o.x0 = r3(o.x0 + mx);
        o.x1 = r3(o.x1 + mx);
        o.z = r3(o.z + mz);
        if (my) o.y = r3((o.y ?? 0) + my);
        this.commitRun(o);
      } else {
        o.x = r3(o.x + mx);
        o.z = r3(o.z + mz);
        if (my || o.y) o.y = r3(Math.max(-2, (o.y ?? 0) + my));
        if (!o.y) delete o.y;
        this.commitProp(o);
      }
      this.renderProps();
      this.renderTimeline();
      this.renderTop();
    }
    void e;
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    const cur = this.selected();
    if (e.altKey && cur && this.st.sel?.type === 'prop') {
      this.change();
      const p = clone(cur as PropPlacement);
      p.scale = r3(clamp((p.scale ?? 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 0.05, 20));
      this.commitProp(p);
      this.renderProps();
      return;
    }
    if (e.ctrlKey) {
      this.st.overview = e.deltaY > 0;
      return;
    }
    this.st.camX += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.02;
  }

  private key(e: KeyboardEvent) {
    if (isTyping(e.target) || this.game.screens.active) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.code;
    if (ctrl && k === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (ctrl && k === 'KeyY') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (ctrl && k === 'KeyS') {
      e.preventDefault();
      void this.save();
      return;
    }
    if (ctrl && k === 'KeyD') {
      e.preventDefault();
      this.duplicateSelected();
      return;
    }
    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      this.deleteSelected();
      return;
    }
    if (k === 'Escape') {
      if (this.ui.help.classList.contains('show')) this.ui.help.classList.remove('show');
      else this.select(null);
      return;
    }
    if (k === 'KeyH' || k === 'F1') {
      e.preventDefault();
      this.ui.help.classList.toggle('show');
      return;
    }
    if (k === 'KeyP') return this.playHere();
    if (k === 'KeyO') {
      this.st.overview = !this.st.overview;
      return;
    }
    if (k.startsWith('Digit') && Number(k.slice(5)) >= 1 && Number(k.slice(5)) <= 4) {
      this.st.active = LAYER_IDS[Number(k.slice(5)) - 1];
      this.renderProps();
      return;
    }
    const cur = this.selected();
    const s = this.st.sel;
    if (!cur || !s || (s.type !== 'prop' && s.type !== 'run')) return;
    const big = e.shiftKey ? 1 : 0.1;
    const edit = (fn: (o: PropPlacement & PropRun) => void) => {
      e.preventDefault();
      this.change();
      const o = clone(cur) as PropPlacement & PropRun;
      fn(o);
      if (s.type === 'prop') this.commitProp(o);
      else this.commitRun(o);
      this.renderProps();
      this.renderTimeline();
    };
    const mvx = (o: PropPlacement & PropRun, d: number) => {
      if (s.type === 'run') {
        o.x0 = r3(o.x0 + d);
        o.x1 = r3(o.x1 + d);
      } else o.x = r3(o.x + d);
    };
    if (k === 'ArrowLeft') edit((o) => mvx(o, -big));
    else if (k === 'ArrowRight') edit((o) => mvx(o, big));
    else if (k === 'ArrowUp') edit((o) => (e.altKey ? (o.y = r3((o.y ?? 0) + big)) : (o.z = r3(o.z - big))));
    else if (k === 'ArrowDown') edit((o) => (e.altKey ? (o.y = r3((o.y ?? 0) - big)) : (o.z = r3(o.z + big))));
    else if (k === 'KeyF' && s.type === 'prop') edit((o) => (o.flip = !o.flip));
    else if (k === 'KeyV') {
      // Neste variant (palisade_a, palisade_b ...)
      const all = [cur.prop, ...variantsOf(cur.prop)].sort();
      if (all.length > 1) edit((o) => (o.prop = all[(all.indexOf(cur.prop) + 1) % all.length]));
    }
    else if (k === 'BracketLeft') edit((o) => (o.scale = r3(clamp((o.scale ?? 1) / 1.08, 0.05, 20))));
    else if (k === 'BracketRight') edit((o) => (o.scale = r3(clamp((o.scale ?? 1) * 1.08, 0.05, 20))));
    else if (k === 'Comma' && s.type === 'prop') edit((o) => (o.rot = r3((o.rot ?? 0) + 2)));
    else if (k === 'Period' && s.type === 'prop') edit((o) => (o.rot = r3((o.rot ?? 0) - 2)));
  }

  private async drop(e: DragEvent) {
    e.preventDefault();
    this.root.classList.remove('dragging');
    const dt = e.dataTransfer;
    if (!dt) return;
    const propId = dt.getData('text/x-forge-prop');
    if (propId) {
      const kind = propKind(propId);
      if (!kind) return;
      const L = kind.layer ?? this.st.active;
      const pnt = this.onPlane(e, LAYERS[L].def);
      this.addProp(kind, pnt ? { x: pnt.x } : undefined);
      return;
    }
    const files = [...dt.files];
    const json = files.find((f) => f.name.endsWith('.json'));
    if (json) return this.openLayoutFile(json);
    let n = 0;
    for (const f of files) {
      if (!/\.(png|webp|jpe?g)$/i.test(f.name)) continue;
      try {
        const kind = await importImage(f, this.st.active);
        n++;
        const pnt = this.onPlane(e, LAYERS[kind.layer].def);
        this.addProp(kind, pnt ? { x: pnt.x } : undefined);
      } catch (err) {
        this.toast('COULD NOT READ ' + f.name.toUpperCase(), 4);
        void err;
      }
    }
    if (n) {
      this.renderLibrary();
      this.toast(`${n} IMAGE(S) ADDED. SAVE WRITES THEM TO public/assets AND THE MANIFEST.`, 5);
    }
  }

  private async openLayoutFile(f: File) {
    try {
      const { layout, errors } = await readLayoutFile(f, propIds());
      if (layout.level !== this.st.level) {
        this.toast(`THAT FILE IS FOR LEVEL "${String(layout.level).toUpperCase()}"`, 4);
        return;
      }
      this.change();
      this.st.layout = layout;
      layout.runs ??= [];
      setUnsavedLayout(this.st.level, layout);
      this.toast(errors.length ? `OPENED WITH ${errors.length} WARNING(S)` : 'OPENED ' + f.name.toUpperCase(), 4);
      this.rebuild();
    } catch {
      this.toast('NOT A LAYOUT FILE', 4);
    }
  }

  // ---------------------------------------------------------------- panelene
  private buildUI() {
    const top = el('div', { class: 'fg-panel fg-top' });
    const lib = el('div', { class: 'fg-panel fg-lib' });
    const props = el('div', { class: 'fg-panel fg-props' });
    const time = el('div', { class: 'fg-panel fg-time' });
    const timeCanvas = el('canvas');
    const help = el('div', { class: 'fg-panel fg-help' });
    const toast = el('div', { class: 'fg-toast' });
    const status = el('span', { class: 'fg-status' });
    const list = el('div', { class: 'fg-list' });
    this.root.append(top, lib, props, time, help, toast);
    help.append(
      el('h3', { text: 'STAGE FORGE: KEYS AND MOUSE' }),
      (() => {
        const t = el('table');
        const rows: [string, string][] = [
          ['Click', 'Select a prop (transparent parts of an image let the click through)'],
          ['Drag', 'Move along the ground. Alt + drag: also up and down. Shift + drag: depth (parallax)'],
          ['Right / middle drag, wheel, A D', 'Move the camera along the level. Shift = faster. Ctrl + wheel: overview'],
          ['Library', 'Click to add in the middle of the view, drag onto the level, or ROW for a row'],
          ['Drop PNG files', 'Adds them as props at once (prop_name.png, or anim_name_4x2.png for a sheet)'],
          ['Arrows', 'Nudge the selection (Shift = 1 m). Up and down: depth, with Alt: height'],
          ['[ ] , . F', 'Scale, rotate, flip'],
          ['V', 'Next variant of the prop (palisade_a, palisade_b ...)'],
          ['Parts', 'PART OF hangs a prop on another one. Parts follow its animation, and move, scale and flip with it'],
          ['Del, Ctrl+D', 'Delete, duplicate'],
          ['Ctrl+Z, Ctrl+Y', 'Undo, redo'],
          ['Ctrl+S', 'Save (into the repo with npm run dev, otherwise a download)'],
          ['P', 'Play from here. Pause in the game goes back to STAGE FORGE'],
          ['O', 'Overview (camera further back)'],
          ['1 2 3 4', 'Default layer for new props: FAR, BACK, MID, FRONT'],
          ['H or F1, Esc', 'This help, deselect'],
        ];
        for (const [a, b] of rows) t.append(el('tr', {}, el('td', { text: a }), el('td', { text: b })));
        return t;
      })(),
    );
    return { top, lib, props, time, timeCanvas, help, toast, status, list };
  }

  toast(msg: string, dur = 2) {
    this.ui.toast.textContent = msg;
    this.ui.toast.classList.add('show');
    this.toastT = dur;
  }

  private refreshAll() {
    this.renderTop();
    this.renderLibrary();
    this.renderProps();
    this.renderTimeline();
  }

  private renderTop() {
    const u = this.ui;
    u.top.replaceChildren();
    const lvSel = el('select', { title: 'Level' });
    for (const [id, lv] of Object.entries(LEVELS)) {
      const o = el('option', { value: id, text: `${lv.name}: ${lv.subtitle}` });
      if (id === this.st.level) o.selected = true;
      lvSel.append(o);
    }
    lvSel.addEventListener('change', () => {
      if (this.st.dirty && !confirm('UNSAVED CHANGES WILL BE KEPT ONLY UNTIL THE PAGE CLOSES. SWITCH LEVEL?')) {
        lvSel.value = this.st.level;
        return;
      }
      this.game.openEditor(lvSel.value);
    });
    const saveB = btn('SAVE', () => void this.save(), 'Ctrl+S');
    void canSave().then((ok) => (saveB.title = ok ? 'Ctrl+S: writes src/data/layouts/' + this.st.level + '.json' : 'Ctrl+S: downloads the file (run npm run dev to save into the repo)'));
    const undoB = btn('UNDO', () => this.undo(), 'Ctrl+Z');
    undoB.disabled = !this.st.history.canUndo;
    const redoB = btn('REDO', () => this.redo(), 'Ctrl+Y');
    redoB.disabled = !this.st.history.canRedo;
    const openIn = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' }) as HTMLInputElement;
    openIn.addEventListener('change', () => openIn.files?.[0] && void this.openLayoutFile(openIn.files[0]));
    this.warnings = this.collectWarnings();
    u.status.replaceChildren();
    if (this.st.dirty) u.status.append(el('span', { class: 'dirty', text: 'UNSAVED' }), ' · ');
    const nProps = this.st.layout.props.length, nRows = (this.st.layout.runs ?? []).length;
    u.status.append(`${nProps} PROP${nProps === 1 ? '' : 'S'} · ${nRows} ROW${nRows === 1 ? '' : 'S'} · `);
    if (this.warnings.length) {
      const w = el('span', { class: 'warn', text: `${this.warnings.length} WARNING(S)` });
      w.addEventListener('click', () => this.select(null));
      u.status.append(w);
    } else u.status.append(el('span', { text: 'NO WARNINGS', style: 'color:var(--fg-ok)' }));
    u.top.append(
      el('span', { class: 'fg-title', text: 'STAGE FORGE' }), lvSel, undoB, redoB, saveB,
      btn('OPEN', () => openIn.click(), 'Open a layout file you downloaded'),
      btn('EXPORT', () => download(this.st.level + '.json', layoutToJson(this.st.layout)), 'Download the layout file'),
      btn('PLAY FROM HERE', () => this.playHere(), 'P'),
      btn(this.st.overview ? 'NEAR' : 'OVERVIEW', () => {
        this.st.overview = !this.st.overview;
        this.renderTop();
      }, 'O'),
      btn('SNAP ' + (this.st.snap ? 'ON' : 'OFF'), () => {
        this.st.snap = !this.st.snap;
        this.renderTop();
      }, 'Snap to 0.25 m while dragging (hold Ctrl to move freely)', this.st.snap),
      btn('HELP', () => this.ui.help.classList.toggle('show'), 'H'),
      btn('EXIT', () => {
        if (this.st.dirty && !confirm('LEAVE STAGE FORGE WITHOUT SAVING?')) return;
        setUnsavedLayout(this.st.level, null);
        state = null;
        this.game.goTitle();
      }),
      openIn, u.status,
    );
  }

  private renderLibrary() {
    const u = this.ui;
    u.lib.replaceChildren();
    const search = el('input', { type: 'text', placeholder: 'SEARCH PROPS', value: this.st.filter }) as HTMLInputElement;
    search.addEventListener('input', () => {
      this.st.filter = search.value;
      fill();
    });
    const tabs = el('div', { class: 'fg-tabs' });
    for (const [t, name] of [['all', 'ALL'], ['painted', 'PAINTED'], ['image', 'IMAGES'], ['model', '3D']] as const) {
      tabs.append(btn(name, () => {
        this.st.tab = t;
        this.renderLibrary();
      }, '', this.st.tab === t));
    }
    const fill = () => {
      u.list.replaceChildren();
      const f = this.st.filter.trim().toLowerCase();
      for (const k of allProps()) {
        if (this.st.tab !== 'all' && k.source !== this.st.tab) continue;
        if (f && !(k.label.toLowerCase().includes(f) || k.id.includes(f) || (k.tags ?? []).some((t) => t.includes(f)))) continue;
        const item = el('div', { class: 'fg-item', draggable: 'true', title: `${k.id} · ${LAYERS[k.layer].label}` });
        const img = k.image?.();
        if (img) {
          const th = el('canvas') as HTMLCanvasElement;
          th.width = 80;
          th.height = 80;
          const c = th.getContext('2d')!;
          const sheet = k.anim?.find((a) => a.type === 'sheet') as Extract<PropAnim, { type: 'sheet' }> | undefined;
          const sw = sheet ? img.width / sheet.grid[0] : img.width, sh = sheet ? img.height / sheet.grid[1] : img.height;
          const s = Math.min(80 / sw, 80 / sh);
          c.drawImage(img, 0, 0, sw, sh, (80 - sw * s) / 2, (80 - sh * s) / 2, sw * s, sh * s);
          item.append(th);
        } else item.append(el('div', { class: 'fg-3d', text: '3D' }));
        const nv = variantsOf(k.id).length, np = k.preset?.length ?? 0;
        const extra = (nv ? ` · ${nv + 1} VARIANTS` : '') + (np ? ` · SET OF ${np + 1}` : '');
        item.append(el('div', { class: 'fg-name' }, k.label, el('br'), el('span', { class: 'fg-src', text: (k.source === 'painted' ? 'PLACEHOLDER' : k.source === 'image' ? 'IMAGE' : '3D') + ' · ' + LAYERS[k.layer].label + extra })));
        // Den nyeste utgaven (et sett kan ha kommet til etter at biblioteket ble tegnet)
        item.append(btn('ROW', () => this.addRun(propKind(k.id) ?? k), 'A row of this along the level'));
        item.addEventListener('click', () => this.addProp(propKind(k.id) ?? k));
        item.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/x-forge-prop', k.id));
        u.list.append(item);
      }
    };
    fill();
    const fileIn = el('input', { type: 'file', accept: 'image/png,image/webp', multiple: 'true', style: 'display:none' }) as HTMLInputElement;
    fileIn.addEventListener('change', async () => {
      for (const f of [...(fileIn.files ?? [])]) {
        const kind = await importImage(f, this.st.active);
        this.addProp(kind);
      }
      this.renderLibrary();
    });
    const drop = el('div', { class: 'fg-drop', text: 'DROP PNG FILES HERE OR ' }, btn('BROWSE', () => fileIn.click()));
    u.lib.append(el('h3', { text: 'LIBRARY' }), search, tabs, u.list, drop, fileIn);
  }

  // ---------------------------------------------------------------- egenskaper
  private renderProps() {
    const u = this.ui;
    const s = this.st.sel;
    u.props.replaceChildren();
    if (!s) return this.renderLevelPanel();
    if (s.type === 'wave') return this.renderWave(s.i);
    if (s.type === 'barrel') return this.renderBarrel(s.i);
    if (s.type === 'hazard') return this.renderHazard(s.i);
    const cur = this.selected();
    if (!cur) return this.renderLevelPanel();
    const isRun = s.type === 'run';
    const kind = propKind(cur.prop);
    const P = u.props;
    const edit = (fn: (o: PropPlacement & PropRun) => void, rebuildUi = false) => {
      this.change();
      const o = clone(cur) as PropPlacement & PropRun;
      fn(o);
      if (isRun) this.commitRun(o);
      else this.commitProp(o);
      this.renderTop();
      this.renderTimeline();
      if (rebuildUi) this.renderProps();
    };
    const num = (label: string, get: number | undefined, set: (o: PropPlacement & PropRun, v: number) => void, step = 0.05, def = 0) => {
      const i = el('input', { type: 'number', step: String(step), value: String(get ?? def) }) as HTMLInputElement;
      i.addEventListener('change', () => {
        const v = Number(i.value);
        if (Number.isFinite(v)) edit((o) => set(o, r3(v)));
      });
      return el('div', { class: 'fg-row' }, el('label', { text: label }), i);
    };
    const check = (label: string, get: boolean, set: (o: PropPlacement & PropRun, v: boolean) => void, title = '') => {
      const i = el('input', { type: 'checkbox', title }) as HTMLInputElement;
      i.checked = get;
      i.addEventListener('change', () => edit((o) => set(o, i.checked)));
      return el('div', { class: 'fg-row' }, el('label', { text: label }), i);
    };
    P.append(el('h3', { text: isRun ? 'ROW' : 'PROP' }));
    // Bytt rekvisitt
    const kindSel = el('select') as HTMLSelectElement;
    for (const k of allProps()) {
      const o = el('option', { value: k.id, text: k.label });
      if (k.id === cur.prop) o.selected = true;
      kindSel.append(o);
    }
    kindSel.addEventListener('change', () => edit((o) => (o.prop = kindSel.value), true));
    P.append(el('div', { class: 'fg-row' }, kindSel), el('div', { class: 'fg-small fg-dim', text: kind ? `${kind.source === 'painted' ? 'PLACEHOLDER (a PNG called prop_' + kind.id + '.png replaces it)' : kind.source === 'image' ? 'IMAGE' : '3D FROM CODE'}` : 'UNKNOWN PROP' }));
    // Varianter av samme ting (V bytter)
    const vars = variantsOf(cur.prop);
    if (vars.length) {
      const vSel = el('select') as HTMLSelectElement;
      for (const id of [cur.prop, ...vars].sort()) {
        const o = el('option', { value: id, text: id.toUpperCase() });
        if (id === cur.prop) o.selected = true;
        vSel.append(o);
      }
      vSel.addEventListener('change', () => edit((o) => (o.prop = vSel.value), true));
      P.append(el('div', { class: 'fg-row' }, el('label', { text: 'VARIANT' }), vSel));
      if (isRun) {
        const r = cur as PropRun;
        P.append(check('MIX VARIANTS', !!r.variants?.length, (o, v) => (o.variants = v ? vars : undefined), 'Mix all the variants into the row'));
      }
    }
    const layerSel = el('select') as HTMLSelectElement;
    for (const l of LAYER_IDS) {
      const o = el('option', { value: l, text: LAYERS[l].label + '  (z ' + LAYERS[l].z[0] + ' to ' + LAYERS[l].z[1] + ')' });
      if (l === cur.layer) o.selected = true;
      layerSel.append(o);
    }
    layerSel.addEventListener('change', () => edit((o) => {
      const l = layerSel.value as LayerId;
      o.layer = l;
      const [z0, z1] = LAYERS[l].z;
      if (o.z < z0 || o.z > z1) o.z = LAYERS[l].def;
    }, true));
    P.append(el('div', { class: 'fg-row' }, el('label', { text: 'LAYER' }), layerSel));
    if (isRun) {
      const r = cur as PropRun;
      P.append(
        num('FROM X', r.x0, (o, v) => (o.x0 = v)), num('TO X', r.x1, (o, v) => (o.x1 = v)), num('Z (DEPTH)', r.z, (o, v) => (o.z = v)),
        num('Y (HEIGHT)', r.y, (o, v) => (o.y = v || undefined)), num('STEP', r.step, (o, v) => (o.step = Math.max(0.1, v)), 0.05, 1),
        num('JITTER X', r.jitter, (o, v) => (o.jitter = v)), num('JITTER Z', r.zJitter, (o, v) => (o.zJitter = v)),
        num('SCALE', r.scale, (o, v) => (o.scale = v > 0 ? v : undefined), 0.05, 1), num('SCALE JIT', r.scaleJitter, (o, v) => (o.scaleJitter = v)),
        check('RANDOM FLIP', !!r.flipRandom, (o, v) => (o.flipRandom = v)),
        num('SEED', r.seed, (o, v) => (o.seed = Math.round(v)), 1, 0),
      );
      const gaps = el('input', { type: 'text', value: (r.gaps ?? []).map((g) => g.join('-')).join(' '), placeholder: 'e.g. 30-38 70-76' }) as HTMLInputElement;
      gaps.addEventListener('change', () => edit((o) => {
        const g = gaps.value.split(/\s+/).filter(Boolean).map((t) => t.split('-').map(Number)).filter((a) => a.length === 2 && a.every(Number.isFinite)) as [number, number][];
        o.gaps = g.length ? g : undefined;
      }));
      P.append(el('div', { class: 'fg-row' }, el('label', { text: 'GAPS' }), gaps), el('div', { class: 'fg-small fg-dim', text: `${expandRun(r).length} PIECES` }));
    } else {
      const p = cur as PropPlacement;
      P.append(
        num('X', p.x, (o, v) => (o.x = v)), num('Y (HEIGHT)', p.y, (o, v) => (o.y = v || undefined)), num('Z (DEPTH)', p.z, (o, v) => (o.z = v)),
        num('SCALE', p.scale, (o, v) => (o.scale = v > 0 ? v : undefined), 0.05, 1),
        num('TILT °', p.rot, (o, v) => (o.rot = v || undefined), 1), num('TURN °', p.yaw, (o, v) => (o.yaw = v || undefined), 1),
        check('FLIP', !!p.flip, (o, v) => (o.flip = v || undefined)),
        check('LOCKED', !!p.locked, (o, v) => (o.locked = v || undefined), 'Locked props cannot be clicked in the view'),
      );
      this.renderParts(P, p, edit);
    }
    // Utseende
    const d = layerDefaults(cur.layer);
    const tint = el('input', { type: 'color', value: cur.tint ?? '#ffffff' }) as HTMLInputElement;
    tint.addEventListener('change', () => edit((o) => (o.tint = tint.value === '#ffffff' ? undefined : tint.value)));
    const dark = el('input', { type: 'range', min: '0', max: '0.9', step: '0.05', value: String(cur.dark ?? kind?.dark ?? d.dark) }) as HTMLInputElement;
    dark.addEventListener('change', () => edit((o) => (o.dark = Number(dark.value))));
    P.append(
      el('h3', { text: 'LOOK' }),
      el('div', { class: 'fg-row' }, el('label', { text: 'TINT' }), tint, btn('CLEAR', () => edit((o) => (o.tint = undefined), true))),
      el('div', { class: 'fg-row' }, el('label', { text: 'DARKEN' }), dark),
      check('FADE', cur.fade ?? kind?.fade ?? d.fade, (o, v) => (o.fade = v), 'Fades out when a fighter is behind it (FRONT layer)'),
      check('SHADOW', cur.shadow ?? kind?.shadow ?? cur.layer !== 'front', (o, v) => (o.shadow = v)),
    );
    // Animasjoner
    this.renderAnims(P, cur, kind, edit);
    // Mål for bilder (manifestet)
    const meta = kind && !kind.build ? editableMeta(kind.id) : null;
    if (meta && kind) this.renderMeta(P, kind.id, meta);
    P.append(el('div', { class: 'fg-row', style: 'margin-top:10px' }, btn('DUPLICATE', () => this.duplicateSelected(), 'Ctrl+D'), btn('DELETE', () => this.deleteSelected(), 'Del')));
  }

  /** Deler: hva den henger på, delene den har, legg til en del og lagre som sett. */
  private renderParts(P: HTMLElement, p: PropPlacement, edit: (fn: (o: PropPlacement & PropRun) => void, rebuild?: boolean) => void) {
    P.append(el('h3', { text: 'PARTS' }));
    const below = new Set(this.descendants(p.id).map((q) => q.id));
    const cands = this.st.layout.props
      .filter((q) => q.id !== p.id && !below.has(q.id))
      .map((q) => ({ q, d: Math.abs(q.x - p.x) + Math.abs(q.z - p.z) * 0.3 }))
      .filter((c) => c.d < 12 || c.q.id === p.parent)
      .sort((a, b) => a.d - b.d)
      .slice(0, 14);
    const parentSel = el('select') as HTMLSelectElement;
    parentSel.append(el('option', { value: '', text: 'NONE (STANDS ON ITS OWN)' }));
    for (const { q, d } of cands) {
      const o = el('option', { value: q.id, text: `${q.id} ${(propKind(q.prop)?.label ?? q.prop)} (${d.toFixed(1)} m)` });
      if (q.id === p.parent) o.selected = true;
      parentSel.append(o);
    }
    parentSel.addEventListener('change', () => edit((o) => (o.parent = parentSel.value || undefined), true));
    P.append(el('div', { class: 'fg-row' }, el('label', { text: 'PART OF' }), parentSel));
    const kids = this.st.layout.props.filter((q) => q.parent === p.id);
    for (const c of kids) {
      P.append(el('div', { class: 'fg-row fg-small' }, `${c.id} ${propKind(c.prop)?.label ?? c.prop}`, btn('SELECT', () => this.select({ type: 'prop', id: c.id }))));
    }
    const addSel = el('select') as HTMLSelectElement;
    addSel.append(el('option', { value: '', text: '+ ADD PART' }));
    for (const k of allProps()) if (!k.build) addSel.append(el('option', { value: k.id, text: k.label }));
    addSel.addEventListener('change', () => {
      const k = propKind(addSel.value);
      if (k) this.addPart(p, k);
    });
    const row = el('div', { class: 'fg-row' }, addSel);
    if (kids.length && editableMeta(p.prop)) row.append(btn('SAVE AS SET', () => this.saveAsSet(p), 'Next time this image is placed, the parts come with it'));
    P.append(row, el('div', { class: 'fg-small fg-dim', text: 'Parts hang on this prop and follow its animation, and move, scale and flip with it.' }));
  }

  /** Et lite bilde av rekvisitten der et klikk velger et punkt (ledd eller lys), u og v fra øvre venstre hjørne. */
  private pointPicker(kind: PropKind | undefined, value: [number, number], pick: (uv: [number, number]) => void) {
    const img = kind?.image?.();
    if (!img) return null;
    const sheet = kind?.anim?.find((a) => a.type === 'sheet') as Extract<PropAnim, { type: 'sheet' }> | undefined;
    const fw = sheet ? img.width / sheet.grid[0] : img.width, fh = sheet ? img.height / sheet.grid[1] : img.height;
    const cv = el('canvas', { class: 'fg-preview fg-pick', title: 'Click to set the point' }) as HTMLCanvasElement;
    const sc = Math.min(1, 240 / Math.max(fw, fh));
    cv.width = Math.max(1, Math.round(fw * sc));
    cv.height = Math.max(1, Math.round(fh * sc));
    const c = cv.getContext('2d')!;
    c.drawImage(img, 0, 0, fw, fh, 0, 0, cv.width, cv.height);
    c.fillStyle = '#ff3a3a';
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(value[0] * cv.width, value[1] * cv.height, 5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const s = Math.min(r.width / cv.width, r.height / cv.height);
      const ox = (r.width - cv.width * s) / 2, oy = (r.height - cv.height * s) / 2;
      pick([r3(clamp((e.clientX - r.left - ox) / (cv.width * s), 0, 1)), r3(clamp((e.clientY - r.top - oy) / (cv.height * s), 0, 1))]);
    });
    return cv;
  }

  private renderAnims(P: HTMLElement, cur: PropPlacement | PropRun, kind: PropKind | undefined, edit: (fn: (o: PropPlacement & PropRun) => void, rebuild?: boolean) => void) {
    const own = cur.anim !== undefined;
    const anims: PropAnim[] = clone(cur.anim ?? kind?.anim ?? []);
    P.append(el('h3', { text: 'ANIMATION' + (own ? '' : ' (FROM THE PROP)') }));
    const setAll = (list: PropAnim[]) => edit((o) => (o.anim = list), true);
    anims.forEach((a, idx) => {
      const box = el('div', { class: 'fg-anim' });
      box.append(el('div', { class: 'fg-anim-head' }, a.type.toUpperCase(), btn('REMOVE', () => setAll(anims.filter((_, j) => j !== idx)))));
      const field = (label: string, key: string, step = 0.05) => {
        const rec = a as unknown as Record<string, unknown>;
        const i = el('input', { type: 'number', step: String(step), value: String(rec[key] ?? '') }) as HTMLInputElement;
        i.addEventListener('change', () => {
          const v = Number(i.value);
          if (i.value === '') delete rec[key];
          else if (Number.isFinite(v)) rec[key] = v;
          setAll(anims);
        });
        return el('div', { class: 'fg-row' }, el('label', { text: label }), i);
      };
      const pair = (label: string, key: string, def: [number, number]) => {
        const rec = a as unknown as Record<string, [number, number] | undefined>;
        const v = rec[key] ?? def;
        const i1 = el('input', { type: 'number', step: '0.01', value: String(v[0]) }) as HTMLInputElement;
        const i2 = el('input', { type: 'number', step: '0.01', value: String(v[1]) }) as HTMLInputElement;
        const upd = () => {
          rec[key] = [Number(i1.value), Number(i2.value)];
          setAll(anims);
        };
        i1.addEventListener('change', upd);
        i2.addEventListener('change', upd);
        return el('div', { class: 'fg-row' }, el('label', { text: label }), i1, i2);
      };
      const choice = (label: string, key: string, opts: readonly string[], def: string) => {
        const rec = a as unknown as Record<string, unknown>;
        const sel = el('select') as HTMLSelectElement;
        for (const v of opts) {
          const o = el('option', { value: v, text: v.toUpperCase() });
          if ((rec[key] ?? def) === v) o.selected = true;
          sel.append(o);
        }
        sel.addEventListener('change', () => {
          rec[key] = sel.value;
          setAll(anims);
        });
        return el('div', { class: 'fg-row' }, el('label', { text: label }), sel);
      };
      // Ledd og lyspunkt kan velges med et klikk i bildet
      const picker = (key: 'pivot' | 'at', def: [number, number]) => {
        const rec = a as unknown as Record<string, [number, number] | undefined>;
        return this.pointPicker(kind, rec[key] ?? def, (uv) => {
          rec[key] = uv;
          setAll(anims);
        }) ?? '';
      };
      switch (a.type) {
        case 'sway': box.append(field('AMOUNT', 'amount'), field('SPEED', 'speed')); break;
        case 'swing': box.append(field('DEGREES', 'amount', 1), field('SPEED', 'speed'), pair('PIVOT U V', 'pivot', [0.5, 0]), picker('pivot', [0.5, 0])); break;
        case 'bob': box.append(field('METRES', 'amount', 0.01), field('SPEED', 'speed')); break;
        case 'spin': box.append(field('TURNS/S', 'speed'), pair('PIVOT U V', 'pivot', [0.5, 0.5]), picker('pivot', [0.5, 0.5])); break;
        case 'wave':
          box.append(field('METRES', 'amount', 0.01), field('SPEED', 'speed'), field('WAVE LENGTH', 'length'), choice('FIXED EDGE', 'from', WAVE_FROM, 'left'),
            el('div', { class: 'fg-small fg-dim', text: 'Cloth waves out from the fixed edge (the pole). TOP: hangs from a bar.' }));
          break;
        case 'pulse': box.append(field('SIZE', 'amount', 0.01), field('SPEED', 'speed'), field('GLOW', 'glow')); break;
        case 'drift':
          box.append(field('M PER SEC', 'speed'), field('RANGE M', 'range', 1),
            el('div', { class: 'fg-small fg-dim', text: 'Glides sideways over RANGE metres and comes back in from the other side.' }));
          break;
        case 'react': {
          const keys = this.st.sel?.type === 'run' ? [...this.scenery.items.keys()].filter((k) => k.startsWith(cur.id + '#')) : [cur.id];
          box.append(choice('WHEN', 'on', REACT_ON, 'near'), field('RADIUS M', 'radius', 0.1), choice('EFFECT', 'effect', REACT_EFFECTS, 'shake'),
            field('AMOUNT', 'amount', 0.1), field('SECONDS', 'dur', 0.1), field('BACK AFTER S', 'back', 1),
            el('div', { class: 'fg-row' }, btn('TEST', () => keys.forEach((k) => this.scenery.trigger(k)), 'Play the reaction now')),
            el('div', { class: 'fg-small fg-dim', text: 'NEAR: a fighter close by. HIT: blows, throws and quakes close by. FLEE flies off and comes back after BACK AFTER.' }));
          break;
        }
        case 'flicker': {
          const col = el('input', { type: 'color', value: a.light ?? '#ffb45a' }) as HTMLInputElement;
          const lightOn = el('input', { type: 'checkbox' }) as HTMLInputElement;
          lightOn.checked = !!a.light;
          const upd = () => {
            a.light = lightOn.checked ? col.value : undefined;
            setAll(anims);
          };
          col.addEventListener('change', upd);
          lightOn.addEventListener('change', upd);
          box.append(field('AMOUNT', 'amount'), field('SPEED', 'speed'), el('div', { class: 'fg-row' }, el('label', { text: 'LIGHT' }), lightOn, col), field('BRIGHTNESS', 'intensity', 1), field('RANGE', 'range', 1), pair('LIGHT AT U V', 'at', [0.5, 0.3]), picker('at', [0.5, 0.3]));
          break;
        }
        case 'sheet': {
          const mode = el('select') as HTMLSelectElement;
          for (const m of ['loop', 'pingpong', 'once']) {
            const o = el('option', { value: m, text: m.toUpperCase() });
            if ((a.mode ?? 'loop') === m) o.selected = true;
            mode.append(o);
          }
          mode.addEventListener('change', () => {
            a.mode = mode.value as 'loop';
            setAll(anims);
          });
          box.append(field('FRAMES', 'n', 1), pair('GRID COLS ROWS', 'grid', [a.grid?.[0] ?? 1, a.grid?.[1] ?? 1]), field('FPS', 'fps', 1), el('div', { class: 'fg-row' }, el('label', { text: 'MODE' }), mode));
          break;
        }
        case 'track': {
          box.append(field('SECONDS', 'dur', 0.1));
          const loop = el('input', { type: 'checkbox' }) as HTMLInputElement;
          loop.checked = a.loop !== false;
          loop.addEventListener('change', () => {
            a.loop = loop.checked;
            setAll(anims);
          });
          box.append(el('div', { class: 'fg-row' }, el('label', { text: 'LOOP' }), loop));
          for (const ch of TRACK_CHANNELS) {
            const keys = a.keys[ch];
            const i = el('input', { type: 'text', value: keys ? keys.map(([t, v]) => `${t}:${v}`).join(' ') : '', placeholder: 't:value ...' }) as HTMLInputElement;
            i.addEventListener('change', () => {
              const list = i.value.split(/\s+/).filter(Boolean).map((s) => s.split(':').map(Number)).filter((k) => k.length === 2 && k.every(Number.isFinite)) as [number, number][];
              if (list.length) a.keys[ch as TrackChannel] = list.sort((p, q) => p[0] - q[0]);
              else delete a.keys[ch as TrackChannel];
              setAll(anims);
            });
            box.append(el('div', { class: 'fg-row' }, el('label', { text: ch.toUpperCase() + (ch === 'rot' ? ' °' : '') }), i));
          }
          box.append(el('div', { class: 'fg-small fg-dim', text: 't from 0 to 1 over SECONDS, e.g. x "0:0 0.5:2 1:0". Smooth in between.' }));
          break;
        }
      }
      P.append(box);
    });
    const add = el('select') as HTMLSelectElement;
    add.append(el('option', { value: '', text: '+ ADD ANIMATION' }));
    for (const t of ANIM_TYPES) add.append(el('option', { value: t, text: t.toUpperCase() }));
    add.addEventListener('change', () => {
      const t = add.value as PropAnimType;
      if (!t) return;
      const fresh: Record<PropAnimType, PropAnim> = {
        sway: { type: 'sway', amount: 0.5, speed: 1 },
        swing: { type: 'swing', amount: 6, speed: 0.6, pivot: [0.5, 0] },
        bob: { type: 'bob', amount: 0.05, speed: 0.8 },
        spin: { type: 'spin', speed: 0.25, pivot: [0.5, 0.5] },
        flicker: { type: 'flicker', amount: 0.25, speed: 8, light: '#ffb45a', intensity: 7, range: 7, at: [0.5, 0.3] },
        sheet: { type: 'sheet', n: 4, grid: [4, 1], fps: 10, mode: 'loop' },
        track: { type: 'track', dur: 4, loop: true, keys: { x: [[0, 0], [0.5, 1], [1, 0]] } },
        wave: { type: 'wave', amount: 0.12, speed: 0.9, length: 0.7, from: 'left' },
        pulse: { type: 'pulse', amount: 0.04, speed: 0.6, glow: 0.3 },
        drift: { type: 'drift', speed: 0.4, range: 30 },
        react: { type: 'react', on: 'near', radius: 2.5, effect: 'shake', amount: 8 },
      };
      setAll([...anims, fresh[t]]);
    });
    P.append(el('div', { class: 'fg-row' }, add, own ? btn('USE THE PROP\'S', () => edit((o) => (o.anim = undefined), true), 'Go back to the animation the prop has in the library') : null));
  }

  /** Bredde, fotpunkt og standardlag for et bilde (lagres i manifestet). */
  private renderMeta(P: HTMLElement, id: string, meta: NonNullable<ReturnType<typeof editableMeta>>) {
    P.append(el('h3', { text: 'IMAGE SETTINGS (MANIFEST)' }));
    const kind = propKind(id);
    const img = kind?.image?.();
    const apply = (m: typeof meta) => {
      setMeta(id, m);
      // Alle som bruker bildet, bygges om
      this.scenery.load(this.st.layout);
      this.applyLayerVisibility();
      this.renderProps();
      this.renderLibrary();
      this.renderTop();
      this.st.dirty = true;
    };
    if (img) {
      const pv = el('canvas', { class: 'fg-preview', title: 'Click to set the foot point (anchor)' }) as HTMLCanvasElement;
      pv.width = img.width;
      pv.height = img.height;
      const c = pv.getContext('2d')!;
      c.drawImage(img, 0, 0);
      const [ax, ay] = meta.anchor ?? [0.5, 0.98];
      c.fillStyle = '#ff3a3a';
      c.beginPath();
      c.arc(ax * img.width, ay * img.height, Math.max(4, img.width / 40), 0, Math.PI * 2);
      c.fill();
      pv.addEventListener('click', (e) => {
        const r = pv.getBoundingClientRect();
        // Bildet er skalert med object-fit: contain
        const s = Math.min(r.width / img.width, r.height / img.height);
        const ox = (r.width - img.width * s) / 2, oy = (r.height - img.height * s) / 2;
        const u = clamp((e.clientX - r.left - ox) / (img.width * s), 0, 1), v = clamp((e.clientY - r.top - oy) / (img.height * s), 0, 1);
        apply({ ...meta, anchor: [r3(u), r3(v)] });
      });
      P.append(pv);
    }
    const w = el('input', { type: 'number', step: '0.05', value: String(meta.w ?? 1.5) }) as HTMLInputElement;
    w.addEventListener('change', () => Number(w.value) > 0 && apply({ ...meta, w: r3(Number(w.value)) }));
    const layer = el('select') as HTMLSelectElement;
    for (const l of LAYER_IDS) {
      const o = el('option', { value: l, text: LAYERS[l].label });
      if (l === (meta.layer ?? 'mid')) o.selected = true;
      layer.append(o);
    }
    layer.addEventListener('change', () => apply({ ...meta, layer: layer.value as LayerId }));
    const emit = el('input', { type: 'checkbox', title: 'Flames, embers and lava: the picture keeps its own colours, no light or shade from the scene' }) as HTMLInputElement;
    emit.checked = (meta.emit ?? 0) > 0;
    emit.addEventListener('change', () => apply({ ...meta, emit: emit.checked ? 1 : undefined }));
    P.append(
      el('div', { class: 'fg-row' }, el('label', { text: 'WIDTH (M)' }), w),
      el('div', { class: 'fg-row' }, el('label', { text: 'LAYER' }), layer),
      el('div', { class: 'fg-row' }, el('label', { text: 'SELF-LIT' }), emit),
      el('div', { class: 'fg-small fg-dim', text: 'Click the picture to set the foot point. SAVE writes the image and these settings to the manifest.' }),
    );
  }

  /** Når ingenting er valgt: brettet, lagene, generatorene og advarslene. */
  private renderLevelPanel() {
    const P = this.ui.props;
    const lay = this.st.layout;
    const lv = this.level;
    P.append(el('h3', { text: 'LEVEL' }), el('div', { class: 'fg-small' }, `${lv.name}: ${lv.subtitle}`, el('br'), el('span', { class: 'fg-dim', text: `BIOME ${lv.biome.toUpperCase()} · ${lv.waves.length} WAVES` })));
    const len = el('input', { type: 'number', step: '1', value: String(lv.length) }) as HTMLInputElement;
    len.addEventListener('change', () => {
      const v = Math.round(Number(len.value));
      if (!(v >= 30)) return;
      this.change();
      lay.length = v;
      this.gameplayChanged(true);
    });
    const seed = el('input', { type: 'number', step: '1', value: String(lay.seed ?? hashSeed(lv.id)) }) as HTMLInputElement;
    seed.addEventListener('change', () => {
      this.change();
      lay.seed = Math.round(Number(seed.value)) >>> 0;
      this.rebuild();
    });
    P.append(
      el('div', { class: 'fg-row' }, el('label', { text: 'LENGTH' }), len),
      el('div', { class: 'fg-row' }, el('label', { text: 'DECOR SEED' }), seed, btn('NEW', () => {
        this.change();
        lay.seed = (Math.random() * 1e9) >>> 0;
        this.rebuild();
      }, 'Shuffle the generated decor (trees, grass, rocks)')),
    );
    // Lagene
    P.append(el('h3', { text: 'LAYERS' }), el('div', { class: 'fg-small fg-dim', text: 'Keys 1 to 4 pick the default layer for new props.' }));
    for (const l of LAYER_IDS) {
      const vis = el('input', { type: 'checkbox', title: 'Show' }) as HTMLInputElement;
      vis.checked = !this.st.hidden.has(l);
      vis.addEventListener('change', () => {
        if (vis.checked) this.st.hidden.delete(l);
        else this.st.hidden.add(l);
        this.applyLayerVisibility();
      });
      const lock = btn(this.st.locked.has(l) ? 'LOCKED' : 'LOCK', () => {
        if (this.st.locked.has(l)) this.st.locked.delete(l);
        else this.st.locked.add(l);
        this.renderProps();
      }, 'Locked layers cannot be clicked', this.st.locked.has(l));
      const act = btn(this.st.active === l ? 'DEFAULT' : 'USE', () => {
        this.st.active = l;
        this.renderProps();
      }, 'Default layer for new props', this.st.active === l);
      const n = lay.props.filter((p) => p.layer === l).length + (lay.runs ?? []).filter((r) => r.layer === l).length;
      P.append(el('div', { class: 'fg-layer', title: LAYERS[l].hint }, vis, el('span', { text: `${LAYERS[l].label} (${n})` }), lock, act));
    }
    // Generatorene
    const gens = W.env?.generators ?? [];
    if (gens.length) {
      P.append(el('h3', { text: 'GENERATED DECOR' }), el('div', { class: 'fg-small fg-dim', text: 'Switch off what you want to replace with your own props. The level is rebuilt.' }));
      for (const gname of gens) {
        const c = el('input', { type: 'checkbox' }) as HTMLInputElement;
        c.checked = lay.generators?.[gname] !== false;
        c.addEventListener('change', () => {
          this.change();
          const g = (lay.generators ??= {});
          if (c.checked) delete g[gname];
          else g[gname] = false;
          if (!Object.keys(g).length) delete lay.generators;
          this.rebuild();
        });
        P.append(el('div', { class: 'fg-row' }, c, el('span', { text: GEN_LABELS[gname] ?? gname.toUpperCase() })));
      }
    }
    // Advarsler
    P.append(el('h3', { text: this.warnings.length ? `WARNINGS (${this.warnings.length})` : 'WARNINGS' }));
    if (!this.warnings.length) P.append(el('div', { class: 'fg-small', style: 'color:var(--fg-ok)', text: 'NONE. LOOKING GOOD.' }));
    else {
      const ul = el('ul', { class: 'fg-warns' });
      for (const w of this.warnings) {
        const li = el('li', { text: w.text });
        if (w.sel) li.addEventListener('click', () => {
          this.select(w.sel!);
          const cur = this.selected();
          if (cur) this.st.camX = 'x0' in cur ? (cur.x0 + cur.x1) / 2 : cur.x;
        });
        ul.append(li);
      }
      P.append(ul);
    }
  }

  private renderWave(i: number) {
    const P = this.ui.props;
    const w = this.level.waves[i];
    if (!w) return this.renderLevelPanel();
    const edit = (fn: () => void) => {
      this.change();
      this.takeGameplay('waves');
      fn();
      this.st.layout.waves!.sort((a, b) => a.at - b.at);
      this.gameplayChanged(false);
    };
    const lw = () => this.st.layout.waves![i];
    const at = el('input', { type: 'number', step: '0.5', value: String(w.at) }) as HTMLInputElement;
    at.addEventListener('change', () => edit(() => (lw().at = r3(Number(at.value)))));
    const max = el('input', { type: 'number', step: '1', value: String(w.maxAlive) }) as HTMLInputElement;
    max.addEventListener('change', () => edit(() => (lw().maxAlive = Math.max(1, Math.round(Number(max.value))))));
    const title = el('input', { type: 'text', value: w.title ?? '', placeholder: 'e.g. SKELETONS!' }) as HTMLInputElement;
    title.addEventListener('change', () => edit(() => (lw().title = title.value.toUpperCase() || undefined)));
    const who = el('input', { type: 'text', value: w.say?.[0] ?? '', placeholder: 'NARRATOR' }) as HTMLInputElement;
    const line = el('textarea', { rows: '2', placeholder: 'What is said when the wave starts' }) as HTMLTextAreaElement;
    line.value = w.say?.[1] ?? '';
    const say = () => edit(() => (lw().say = line.value.trim() ? [(who.value || 'NARRATOR').toUpperCase(), line.value.toUpperCase()] : undefined));
    who.addEventListener('change', say);
    line.addEventListener('change', say);
    const spawns = el('textarea', { rows: '3' }) as HTMLTextAreaElement;
    spawns.value = w.spawns.map((s) => `${s.foe}:${s.side}:${s.delay}`).join(' ');
    spawns.addEventListener('change', () => edit(() => (lw().spawns = spawns.value.trim())));
    P.append(
      el('h3', { text: `WAVE ${i + 1}` }),
      el('div', { class: 'fg-row' }, el('label', { text: 'CAMERA AT X' }), at),
      el('div', { class: 'fg-row' }, el('label', { text: 'MAX ALIVE' }), max),
      el('div', { class: 'fg-row' }, el('label', { text: 'TITLE' }), title),
      el('div', { class: 'fg-row' }, el('label', { text: 'WHO SPEAKS' }), who), line,
      el('h3', { text: 'FOES (id:side:delay)' }), spawns,
      el('div', { class: 'fg-small fg-dim', text: 'IDs: ' + Object.keys(FOES).join(', ') }),
    );
    // Ryttere i denne bølgen
    const riders = this.level.riders ?? [];
    P.append(el('h3', { text: 'RIDERS IN THIS WAVE' }));
    riders.forEach((r, ri) => {
      if (r[0] !== i) return;
      P.append(el('div', { class: 'fg-row' }, `${r[1].toUpperCase()} ON ${r[2].toUpperCase()}`, btn('REMOVE', () => {
        this.change();
        this.takeGameplay('riders');
        this.st.layout.riders!.splice(ri, 1);
        this.gameplayChanged(false);
      })));
    });
    const foeSel = el('select') as HTMLSelectElement;
    for (const f of Object.keys(FOES)) foeSel.append(el('option', { value: f, text: f }));
    const mountSel = el('select') as HTMLSelectElement;
    for (const m of Object.keys(MOUNTS)) mountSel.append(el('option', { value: m, text: m }));
    P.append(el('div', { class: 'fg-row' }, foeSel, mountSel, btn('+ RIDER', () => {
      this.change();
      this.takeGameplay('riders');
      this.st.layout.riders!.push([i, foeSel.value, mountSel.value]);
      this.gameplayChanged(false);
    })));
    P.append(el('div', { class: 'fg-row', style: 'margin-top:10px' }, btn('DELETE WAVE', () => this.deleteSelected())));
  }

  private renderBarrel(i: number) {
    const P = this.ui.props;
    const b = this.level.barrels[i];
    if (!b) return this.renderLevelPanel();
    const edit = (fn: () => void) => {
      this.change();
      this.takeGameplay('barrels');
      fn();
      this.gameplayChanged(false);
    };
    const x = el('input', { type: 'number', step: '0.5', value: String(b[0]) }) as HTMLInputElement;
    x.addEventListener('change', () => edit(() => (this.st.layout.barrels![i][0] = r3(Number(x.value)))));
    const kind = el('select') as HTMLSelectElement;
    for (const k of BARREL_KINDS) {
      const o = el('option', { value: k, text: k.toUpperCase() });
      if (k === b[1]) o.selected = true;
      kind.append(o);
    }
    kind.addEventListener('change', () => edit(() => (this.st.layout.barrels![i][1] = kind.value)));
    P.append(el('h3', { text: 'BARREL' }), el('div', { class: 'fg-row' }, el('label', { text: 'X' }), x), el('div', { class: 'fg-row' }, el('label', { text: 'CONTENT' }), kind), el('div', { class: 'fg-row' }, btn('DELETE', () => this.deleteSelected())));
  }

  private renderHazard(i: number) {
    const P = this.ui.props;
    const h = (this.level.hazards ?? [])[i];
    if (!h) return this.renderLevelPanel();
    const edit = (fn: () => void) => {
      this.change();
      this.takeGameplay('hazards');
      fn();
      this.gameplayChanged(true);
    };
    const kind = el('select') as HTMLSelectElement;
    for (const k of HAZARD_KINDS) {
      const o = el('option', { value: k, text: k.toUpperCase() });
      if (k === h.kind) o.selected = true;
      kind.append(o);
    }
    kind.addEventListener('change', () => edit(() => (this.st.layout.hazards![i].kind = kind.value as HazardKind)));
    const f = (label: string, key: 'x' | 'z' | 'w' | 'd') => {
      const inp = el('input', { type: 'number', step: '0.1', value: String(h[key]) }) as HTMLInputElement;
      inp.addEventListener('change', () => edit(() => (this.st.layout.hazards![i][key] = r3(Number(inp.value)))));
      return el('div', { class: 'fg-row' }, el('label', { text: label }), inp);
    };
    P.append(el('h3', { text: 'HAZARD' }), el('div', { class: 'fg-row' }, el('label', { text: 'KIND' }), kind), f('X', 'x'), f('Z', 'z'), f('WIDTH', 'w'), f('DEPTH', 'd'), el('div', { class: 'fg-row' }, btn('DELETE', () => this.deleteSelected())));
  }

  // ---------------------------------------------------------------- advarsler
  private collectWarnings() {
    const out: { text: string; sel?: Sel }[] = [];
    const lay = this.st.layout;
    for (const e of validateLayout(lay, propIds(), new Set(Object.keys(FOES)))) out.push({ text: e.toUpperCase() });
    const L = this.level.length;
    for (const p of lay.props) {
      const sel: Sel = { type: 'prop', id: p.id };
      if (p.layer === 'mid' && p.z > LANE_Z[0] + 0.2 && p.z < LANE_Z[1] - 0.2 && (p.y ?? 0) < 1.5) out.push({ text: `${p.id}: ${p.prop.toUpperCase()} STANDS IN THE FIGHT LANE (Z ${p.z})`, sel });
      if (p.x < -20 || p.x > L + 20) out.push({ text: `${p.id}: OUTSIDE THE LEVEL (X ${p.x})`, sel });
      const [z0, z1] = LAYERS[p.layer].z;
      if (p.z < z0 - 0.01 || p.z > z1 + 0.01) out.push({ text: `${p.id}: Z ${p.z} IS OUTSIDE THE ${LAYERS[p.layer].label} LAYER`, sel });
    }
    // Forgrunn som dekker mye der kameraet låses for en bølge
    const cam = this.game.camera;
    const probe = cam.clone() as THREE.PerspectiveCamera;
    for (const w of this.level.waves) {
      probe.position.set(w.at, STAGE_CAM.y, cam.aspect < 1.2 ? STAGE_CAM.zNarrow : STAGE_CAM.z);
      probe.lookAt(w.at, STAGE_CAM.lookY, 0);
      probe.updateMatrixWorld(true);
      for (const [key, it] of this.scenery.items) {
        if (it.place.layer !== 'front' || !it.mesh) continue;
        const box = new THREE.Box3().setFromObject(it.root);
        let x0 = Infinity, x1 = -Infinity;
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
          const v = new THREE.Vector3(x, y, (box.min.z + box.max.z) / 2).project(probe);
          x0 = Math.min(x0, v.x);
          x1 = Math.max(x1, v.x);
        }
        const cover = (Math.min(1, x1) - Math.max(-1, x0)) / 2;
        if (cover > 0.34) out.push({ text: `${key}: COVERS ${Math.round(cover * 100)}% OF THE VIEW AT WAVE X ${w.at}`, sel: it.runId ? { type: 'run', id: it.runId } : { type: 'prop', id: key } });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- tidslinja
  private tl = { x0: -10, x1: 130, w: 1, h: 1 };
  private renderTimeline() {
    const u = this.ui;
    if (!u.time.contains(u.timeCanvas)) {
      const bar = el('div', { class: 'fg-time-bar' },
        el('span', { class: 'fg-dim fg-small', text: 'TIMELINE: CLICK TO GO THERE, DRAG MARKERS TO MOVE THEM' }),
        btn('+ WAVE', () => this.addWave(), 'A wave where the camera is'),
        btn('+ BARREL', () => this.addBarrel()),
        btn('+ HAZARD', () => this.addHazard()),
      );
      u.time.append(bar, u.timeCanvas);
      const cv = u.timeCanvas;
      cv.addEventListener('pointerdown', (e) => this.timeDown(e));
      cv.addEventListener('pointermove', (e) => this.timeMove(e));
      cv.addEventListener('pointerup', (e) => this.timeUp(e));
    }
    this.drawTimeline();
  }

  private timeX(x: number) {
    return ((x - this.tl.x0) / (this.tl.x1 - this.tl.x0)) * this.tl.w;
  }
  private timeInv(px: number) {
    return this.tl.x0 + (px / this.tl.w) * (this.tl.x1 - this.tl.x0);
  }

  private drawTimeline() {
    const cv = this.ui.timeCanvas;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (r.width < 10) return;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    const c = cv.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W_ = r.width, H = r.height;
    const lv = this.level;
    this.tl = { x0: -10, x1: lv.length + 10, w: W_, h: H };
    c.clearRect(0, 0, W_, H);
    // Brettet
    c.fillStyle = 'rgba(232,166,64,0.08)';
    c.fillRect(this.timeX(0), 0, this.timeX(lv.length) - this.timeX(0), H);
    // Rekvisittene som små streker, farget etter lag
    const LC: Record<LayerId, string> = { far: '#6a7a9a', back: '#7aa0d0', mid: '#c8b070', front: '#e08a5a' };
    const row: Record<LayerId, number> = { far: 0.12, back: 0.3, mid: 0.48, front: 0.66 };
    for (const it of this.scenery.items.values()) {
      c.fillStyle = LC[it.place.layer];
      c.fillRect(this.timeX(it.place.x) - 1, H * row[it.place.layer], 2, H * 0.13);
    }
    // Farer
    (lv.hazards ?? []).forEach((h, i) => {
      const sel = this.st.sel?.type === 'hazard' && this.st.sel.i === i;
      c.fillStyle = sel ? 'rgba(255,226,138,0.8)' : 'rgba(255,90,60,0.55)';
      c.fillRect(this.timeX(h.x - h.w / 2), H * 0.84, Math.max(3, this.timeX(h.x + h.w / 2) - this.timeX(h.x - h.w / 2)), H * 0.12);
    });
    // Tønner
    lv.barrels.forEach(([x], i) => {
      const sel = this.st.sel?.type === 'barrel' && this.st.sel.i === i;
      c.fillStyle = sel ? '#ffe28a' : '#c8a060';
      c.fillRect(this.timeX(x) - 4, H * 0.84, 8, H * 0.12);
    });
    // Bølgene
    c.font = '10px system-ui, sans-serif';
    lv.waves.forEach((w, i) => {
      const sel = this.st.sel?.type === 'wave' && this.st.sel.i === i;
      const x = this.timeX(w.at);
      c.fillStyle = sel ? '#ffe28a' : '#ff8a5a';
      c.fillRect(x - 1.5, 0, 3, H);
      c.fillText('W' + (i + 1), x + 4, 11);
    });
    // Sjefen / slutten
    const bx = lv.finale.type === 'boss' ? lv.length - 16 : lv.length - 4;
    c.fillStyle = '#d080ff';
    c.fillRect(this.timeX(bx) - 1, 0, 2, H);
    c.fillText(lv.finale.type.toUpperCase(), this.timeX(bx) + 4, 11);
    this.lastView = this.game.camera.position.x;
    this.drawView(c);
  }

  private lastView = -1e9;
  /** Synsfeltet på tidslinja følger kameraet: tegn tidslinja på nytt når kameraet har flyttet seg. */
  private drawViewOnTimeline() {
    const x = this.game.camera.position.x;
    if (Math.abs(x - this.lastView) < 0.02) return;
    this.lastView = x;
    this.drawTimeline();
  }

  /** Rammen for det kameraet ser, på tidslinja. */
  private drawView(c: CanvasRenderingContext2D) {
    const cam = this.game.camera;
    const x = cam.position.x;
    const halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z * cam.aspect;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1.5;
    c.strokeRect(this.timeX(x - halfW), 1, this.timeX(x + halfW) - this.timeX(x - halfW), this.tl.h - 2);
  }

  private timeDrag: { kind: 'wave' | 'barrel' | 'hazard' | 'cam'; i: number; moved: boolean } | null = null;
  private timeDown(e: PointerEvent) {
    const r = this.ui.timeCanvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const lv = this.level;
    const near = (x: number) => Math.abs(this.timeX(x) - px) < 6;
    let hit: { kind: 'wave' | 'barrel' | 'hazard'; i: number } | null = null;
    if (py > this.tl.h * 0.8) {
      lv.barrels.forEach(([x], i) => { if (!hit && near(x)) hit = { kind: 'barrel', i }; });
      (lv.hazards ?? []).forEach((h, i) => { if (!hit && px >= this.timeX(h.x - h.w / 2) - 3 && px <= this.timeX(h.x + h.w / 2) + 3) hit = { kind: 'hazard', i }; });
    }
    lv.waves.forEach((w, i) => { if (!hit && near(w.at)) hit = { kind: 'wave', i }; });
    this.ui.timeCanvas.setPointerCapture(e.pointerId);
    if (hit) {
      const h = hit as { kind: 'wave' | 'barrel' | 'hazard'; i: number };
      this.timeDrag = { ...h, moved: false };
      this.select(h.kind === 'wave' ? { type: 'wave', i: h.i } : h.kind === 'barrel' ? { type: 'barrel', i: h.i } : { type: 'hazard', i: h.i });
    } else {
      this.timeDrag = { kind: 'cam', i: 0, moved: false };
      this.st.camX = this.timeInv(px);
    }
  }
  private timeMove(e: PointerEvent) {
    const d = this.timeDrag;
    if (!d) return;
    const r = this.ui.timeCanvas.getBoundingClientRect();
    const x = r3(Math.round(this.timeInv(e.clientX - r.left) * 2) / 2);
    if (d.kind === 'cam') {
      this.st.camX = x;
      return;
    }
    if (!d.moved) {
      this.change();
      d.moved = true;
    }
    const lay = this.st.layout;
    if (d.kind === 'wave') {
      this.takeGameplay('waves');
      lay.waves![d.i].at = x;
    } else if (d.kind === 'barrel') {
      this.takeGameplay('barrels');
      lay.barrels![d.i][0] = x;
    } else {
      this.takeGameplay('hazards');
      lay.hazards![d.i].x = x;
    }
    this.level = levelWithLayout(LEVELS[this.st.level], lay);
    this.drawTimeline();
  }
  private timeUp(e: PointerEvent) {
    const d = this.timeDrag;
    this.timeDrag = null;
    if (!d || !d.moved) return;
    void e;
    if (d.kind === 'wave') {
      // Bølgene må stå i rekkefølge; valget følger bølgen
      const w = this.st.layout.waves![d.i];
      this.st.layout.waves!.sort((a, b) => a.at - b.at);
      this.st.sel = { type: 'wave', i: this.st.layout.waves!.indexOf(w) };
    }
    this.gameplayChanged(d.kind === 'hazard');
  }
}

const GEN_LABELS: Record<string, string> = {
  castle: 'CASTLE FAR AWAY', keep: 'START KEEP AND BRIDGE', stakeWall: 'PALISADE (3D STAKES)', forest: 'TREES', meadow: 'GRASS AND REEDS',
  leaves: 'FALLING LEAVES', fog: 'MIST LAYERS', rays: 'LIGHT RAYS', skullPikes: 'SKULL PIKES', tents: 'TENTS', campfires: 'CAMPFIRES',
  banners: 'BANNERS', rocks: 'ROCKS', arrows: 'ARROWS IN THE GROUND', stains: 'OLD BLOOD STAINS', silhouettes: 'BLACK FOREGROUND SILHOUETTES',
  water: 'SWAMP WATER', mushrooms: 'GLOWING MUSHROOMS', hut: 'WITCH HUT', ruins: 'RUINS', cliffs: 'CLIFFS, FALLS AND BRIDGE',
  braziers: 'BRAZIERS', runeStones: 'RUNE STONES', crystals: 'ICE CRYSTALS', frozen: 'FROZEN WARRIORS', watchtower: 'WATCHTOWER',
  ropeFences: 'ROPE FENCES', volcano: 'VOLCANO', lavaRiver: 'LAVA RIVER', spikes: 'OBSIDIAN SPIKES', stars: 'STARS', cages: 'HANGING CAGES',
};
