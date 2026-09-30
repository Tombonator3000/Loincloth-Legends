// Rekvisittkatalogen for brettverkstedet og brettfilene: malte bilder (manifestet og plassholderne i painted.ts),
// bilder Tom drar inn i editoren, og 3D-rekvisittene som finnes i koden (fyrfat, bål, bannere, trær, steiner).
// Et bilde i manifestet med samme navn som en plassholder tar over for den (prop_<navn>.png fra ChatGPT).
import * as THREE from 'three';
import type { Gore } from '../gore';
import type { LayerId, PresetPart, PropAnim } from '../../data/layout';
import { images, type ManifestProp } from '../assets';
import {
  paintPalisade, paintTent, paintSignpost, paintSign, paintRoadpost, paintSkullpike, paintFrontOak, paintBush, paintCart,
  paintBannerSheet, paintCrowSheet, paintTorchSheet, paintFlagpole, paintFlagCloth,
} from './painted';
import { brazier, warBanner, runeStone, ruins, ropeFence } from '../env/props';
import { campfire, rock, skullPike, banner, stakeWall, M } from '../env/common';
import { Forest, SPECIES, withSnow, burnt } from '../env/trees';

type Updates = ((dt: number, t: number, camX: number) => void)[];

/** Det en 3D-rekvisitt får når den bygges: gruppa den legges i, og (x, z) der den står. */
export interface ModelCtx {
  g: THREE.Group;
  gore: Gore;
  updates: Updates;
  x: number;
  z: number;
}

export interface PropKind {
  id: string;
  label: string;
  /** painted = plassholder tegnet i kode, image = bilde (manifestet eller dratt inn), model = 3D fra koden. */
  source: 'painted' | 'image' | 'model';
  /** Laget den legges i som standard. */
  layer: LayerId;
  /** Bilder: bredden i meter og fotpunktet (0..1, y fra toppen). */
  w?: number;
  anchor?: [number, number];
  anim?: PropAnim[];
  shadow?: boolean;
  fade?: boolean;
  dark?: number;
  /** Bildet (lages første gang det trengs). */
  image?: () => HTMLCanvasElement | HTMLImageElement;
  /** 3D: bygg rekvisitten ved (x, z) i ctx.g. */
  build?: (ctx: ModelCtx) => void;
  /** Flammer (partikler) ved punkter i bildet (u, v fra toppen). */
  fire?: [number, number][];
  /** Et sett: delene legges ut sammen med denne og henges på den (forskjøvet dx, dy, dz, se PresetPart). */
  preset?: PresetPart[];
  /** Grupper i biblioteket. */
  tags?: string[];
}

const cache = new Map<string, HTMLCanvasElement | HTMLImageElement>();
const lazy = (key: string, make: () => HTMLCanvasElement) => () => {
  let c = cache.get(key);
  if (!c) cache.set(key, (c = make()));
  return c;
};

// ---------------------------------------------------------------- malte plassholdere
const PAINTED: PropKind[] = [
  { id: 'palisade_a', label: 'PALISADE', source: 'painted', layer: 'back', w: 3.2, anchor: [0.5, 0.995], shadow: true, image: lazy('palisade_a', () => paintPalisade('a')), tags: ['wall'] },
  { id: 'palisade_b', label: 'PALISADE, BROKEN', source: 'painted', layer: 'back', w: 3.2, anchor: [0.5, 0.995], shadow: true, image: lazy('palisade_b', () => paintPalisade('b')), tags: ['wall'] },
  { id: 'tent_red', label: 'WAR TENT, RED', source: 'painted', layer: 'back', w: 4.4, anchor: [0.5, 0.985], shadow: true, image: lazy('tent_red', () => paintTent('#8e2a2a', false)), tags: ['camp'] },
  { id: 'tent_purple', label: 'WAR TENT, PURPLE', source: 'painted', layer: 'back', w: 4.4, anchor: [0.5, 0.985], shadow: true, image: lazy('tent_purple', () => paintTent('#5b2a86', true)), tags: ['camp'] },
  {
    id: 'signpost', label: 'SIGNPOST + SIGN', source: 'painted', layer: 'mid', w: 1.4, anchor: [0.18, 0.995], shadow: true, image: lazy('signpost', paintSignpost), tags: ['road'],
    preset: [{ prop: 'signpost_sign', dx: 1.02, dy: 2.14, dz: 0.02 }],
  },
  {
    id: 'signpost_sign', label: 'HANGING SIGN', source: 'painted', layer: 'mid', w: 0.9, anchor: [0.5, 0.04], shadow: true, image: lazy('signpost_sign', paintSign),
    anim: [{ type: 'swing', amount: 7, speed: 0.55, pivot: [0.5, 0.04] }, { type: 'react', on: 'hit', radius: 2, effect: 'shake', amount: 14 }], tags: ['road'],
  },
  {
    id: 'roadpost', label: 'ROAD POST + LANTERN', source: 'painted', layer: 'mid', w: 1.3, anchor: [0.19, 0.995], shadow: true, image: lazy('roadpost', paintRoadpost),
    anim: [{ type: 'flicker', amount: 0.25, speed: 7, light: '#ffb45a', intensity: 7, range: 7, at: [0.72, 0.24] }], tags: ['road', 'light'],
  },
  { id: 'skullpike', label: 'SKULL PIKE', source: 'painted', layer: 'mid', w: 0.55, anchor: [0.5, 0.995], shadow: true, image: lazy('skullpike', paintSkullpike), tags: ['road'] },
  {
    id: 'tree_front_oak', label: 'GIANT OAK (FRONT)', source: 'painted', layer: 'front', w: 4.5, anchor: [0.46, 1], fade: true, shadow: false, image: lazy('tree_front_oak', paintFrontOak),
    anim: [{ type: 'sway', amount: 0.25, speed: 0.6 }], tags: ['tree', 'front'],
  },
  {
    id: 'bush_front', label: 'BRAMBLE BUSH', source: 'painted', layer: 'front', w: 2.4, anchor: [0.5, 1], fade: true, shadow: false, image: lazy('bush_front', paintBush),
    anim: [{ type: 'sway', amount: 0.8, speed: 1.2 }], tags: ['front', 'plant'],
  },
  { id: 'cart', label: 'BROKEN CART', source: 'painted', layer: 'mid', w: 3, anchor: [0.5, 0.97], shadow: true, image: lazy('cart', paintCart), tags: ['road'] },
  {
    id: 'banner_red', label: 'WAR BANNER, RED (ANIM)', source: 'painted', layer: 'back', w: 1, anchor: [0.14, 0.995], shadow: false, image: lazy('banner_red', () => paintBannerSheet('#8a1a14')),
    anim: [{ type: 'sheet', n: 8, grid: [4, 2], fps: 10, mode: 'loop' }], tags: ['camp', 'anim'],
  },
  {
    id: 'banner_purple', label: 'WAR BANNER, PURPLE (ANIM)', source: 'painted', layer: 'back', w: 1, anchor: [0.14, 0.995], shadow: false, image: lazy('banner_purple', () => paintBannerSheet('#5b2a86')),
    anim: [{ type: 'sheet', n: 8, grid: [4, 2], fps: 10, mode: 'loop' }], tags: ['camp', 'anim'],
  },
  {
    id: 'crow', label: 'CROW, FLYING (ANIM)', source: 'painted', layer: 'mid', w: 0.55, anchor: [0.5, 0.6], shadow: false, image: lazy('crow', paintCrowSheet),
    anim: [
      { type: 'sheet', n: 4, grid: [4, 1], fps: 11, mode: 'loop' },
      { type: 'track', dur: 7, loop: true, keys: { x: [[0, -4], [0.5, 4], [1, -4]], y: [[0, 0], [0.25, 0.5], [0.5, 0], [0.75, 0.6], [1, 0]], sx: [[0, 1], [0.49, 1], [0.51, -1], [0.99, -1], [1, 1]] } },
      // Flyr sin vei når noen kommer nær, og kommer tilbake etter en stund
      { type: 'react', on: 'any', radius: 3.5, effect: 'flee', back: 10 },
    ], tags: ['anim', 'animal'],
  },
  {
    id: 'flagpole', label: 'FLAGPOLE + FLAG (SET)', source: 'painted', layer: 'back', w: 0.35, anchor: [0.5, 0.995], shadow: true, image: lazy('flagpole', paintFlagpole),
    preset: [{ prop: 'flag_cloth', dx: 0.04, dy: 2.45, dz: 0.02 }], tags: ['camp', 'set'],
  },
  {
    id: 'flag_cloth', label: 'FLAG CLOTH (WAVES)', source: 'painted', layer: 'back', w: 1.5, anchor: [0.01, 0.04], shadow: false, image: lazy('flag_cloth', () => paintFlagCloth()),
    anim: [{ type: 'wave', amount: 0.13, speed: 0.85, length: 0.8, from: 'left' }], tags: ['camp', 'anim'],
  },
  {
    id: 'torch', label: 'TORCH (ANIM + LIGHT)', source: 'painted', layer: 'mid', w: 0.42, anchor: [0.5, 0.995], shadow: false, image: lazy('torch', paintTorchSheet),
    anim: [
      { type: 'sheet', n: 4, grid: [4, 1], fps: 12, mode: 'pingpong' },
      { type: 'flicker', amount: 0.3, speed: 9, light: '#ff9a3a', intensity: 8, range: 8, at: [0.5, 0.22] },
    ], fire: [[0.5, 0.3]], tags: ['light', 'anim'],
  },
];

// ---------------------------------------------------------------- 3D fra koden
const tree = (sp: () => typeof SPECIES.autumn, scale = 1) => (c: ModelCtx) => {
  const f = new Forest(sp(), 1);
  f.add(c.x, c.z, scale);
  c.g.add(f.build());
};
const MODELS: PropKind[] = [
  {
    id: 'brazier', label: 'BRAZIER (3D, FIRE)', source: 'model', layer: 'mid', tags: ['light', '3d'],
    build: (c) => {
      const flame = brazier(c.g, c.gore, c.updates, c.x, c.z);
      let acc = 0;
      c.updates.push((dt) => {
        acc += dt;
        if (acc > 0.045) {
          acc = 0;
          c.gore.fire(flame, 2, 0.16, 2.1);
        }
      });
    },
  },
  {
    id: 'campfire', label: 'CAMPFIRE (3D, FIRE)', source: 'model', layer: 'mid', tags: ['light', 'camp', '3d'],
    build: (c) => {
      const f = campfire(c.g, c.x, c.z, c.gore);
      let acc = 0;
      c.updates.push((dt) => {
        acc += dt;
        if (acc > 0.05) {
          acc = 0;
          c.gore.fire(f, 1, 0.2, 2);
        }
      });
    },
  },
  { id: 'war_banner_3d', label: 'WAR BANNER (3D, WIND)', source: 'model', layer: 'back', tags: ['camp', '3d'], build: (c) => warBanner(c.g, c.updates, c.x, c.z) },
  { id: 'banner_pole', label: 'BANNER ON POLE (3D)', source: 'model', layer: 'back', tags: ['camp', '3d'], build: (c) => banner(c.g, c.x, c.z, '#5b2a86', '#efe8d2') },
  { id: 'rune_stone', label: 'RUNE STONE (3D)', source: 'model', layer: 'back', tags: ['stone', '3d'], build: (c) => runeStone(c.g, c.x, c.z, 3, false) },
  { id: 'rune_stone_glow', label: 'RUNE STONE, GLOWING (3D)', source: 'model', layer: 'back', tags: ['stone', 'light', '3d'], build: (c) => runeStone(c.g, c.x, c.z, 3, true) },
  { id: 'ruins', label: 'RUINS (3D)', source: 'model', layer: 'back', tags: ['stone', '3d'], build: (c) => ruins(c.g, c.x, 0, c.z, 1) },
  { id: 'rope_fence', label: 'ROPE FENCE (3D)', source: 'model', layer: 'mid', tags: ['road', '3d'], build: (c) => ropeFence(c.g, c.x - 2, c.x + 2, c.z) },
  { id: 'rock', label: 'BOULDER (3D)', source: 'model', layer: 'mid', tags: ['stone', '3d'], build: (c) => rock(c.g, c.x, c.z, 0.8) },
  { id: 'skullpike_3d', label: 'SKULL PIKE (3D)', source: 'model', layer: 'mid', tags: ['road', '3d'], build: (c) => skullPike(c.g, c.gore, c.x, c.z) },
  { id: 'palisade_3d', label: 'PALISADE (3D STAKES)', source: 'model', layer: 'back', tags: ['wall', '3d'], build: (c) => stakeWall(c.g, c.x - 1.5, c.x + 1.5, c.z) },
  {
    id: 'tent_3d', label: 'TENT (3D CONE)', source: 'model', layer: 'back', tags: ['camp', '3d'],
    build: (c) => void c.g.add(M(new THREE.ConeGeometry(2.2, 3, 6), '#8e2a2a', c.x, 1.5, c.z, 0.06)),
  },
  { id: 'tree_autumn', label: 'AUTUMN TREE (3D)', source: 'model', layer: 'back', tags: ['tree', '3d'], build: tree(() => SPECIES.autumn) },
  { id: 'tree_oak', label: 'OAK (3D)', source: 'model', layer: 'back', tags: ['tree', '3d'], build: tree(() => SPECIES.oak) },
  { id: 'tree_pine', label: 'PINE (3D)', source: 'model', layer: 'back', tags: ['tree', '3d'], build: tree(() => SPECIES.pine) },
  { id: 'tree_pine_snow', label: 'SNOWY PINE (3D)', source: 'model', layer: 'back', tags: ['tree', '3d'], build: tree(() => withSnow(SPECIES.pine)) },
  { id: 'tree_dead', label: 'DEAD TREE (3D)', source: 'model', layer: 'back', tags: ['tree', '3d'], build: tree(() => SPECIES.dead) },
  { id: 'tree_swamp', label: 'SWAMP TREE (3D)', source: 'model', layer: 'back', tags: ['tree', '3d'], build: tree(() => SPECIES.swamp) },
  { id: 'tree_burnt', label: 'BURNT TREE (3D)', source: 'model', layer: 'back', tags: ['tree', '3d'], build: tree(() => burnt(SPECIES.dead)) },
];

// ---------------------------------------------------------------- registeret
const REGISTRY = new Map<string, PropKind>();
for (const k of [...PAINTED, ...MODELS]) REGISTRY.set(k.id, k);
/** Bilder dratt inn i editoren denne økta (de lagres til manifestet under npm run dev). */
const RUNTIME = new Map<string, PropKind>();

/**
 * Et bilde (fra manifestet eller dratt inn i editoren) som rekvisitt. Har det samme navn som en plassholder, tar det over
 * for den og beholder resten: mål, flammer, lys og bevegelse. grid og n sier at bildet er en bildeserie (rutenettet hører
 * til bildet, fart og løkke til animasjonen). Et stillbilde i stedet for en bildeserie mister bildeserien og beholder
 * resten. anim i manifestet er hele lista og går foran plassholderens.
 */
export function imageKind(id: string, img: HTMLCanvasElement | HTMLImageElement, m: ManifestProp): PropKind {
  const base = REGISTRY.get(id);
  let anim: PropAnim[] = m.anim !== undefined ? (Array.isArray(m.anim) ? m.anim : [m.anim]) : (base?.anim ?? []).filter((a) => a.type !== 'sheet' || !!m.grid);
  if (m.grid) {
    const grid = m.grid, n = m.n ?? grid[0] * grid[1];
    anim = anim.some((a) => a.type === 'sheet')
      ? anim.map((a) => (a.type === 'sheet' ? { ...a, n, grid } : a))
      : [{ type: 'sheet', n, grid, fps: 10, mode: 'loop' }, ...anim];
  }
  return {
    ...(base ?? {}),
    id,
    label: m.label ?? base?.label ?? id.toUpperCase().replace(/_/g, ' '),
    source: 'image',
    layer: m.layer ?? base?.layer ?? 'mid',
    w: m.w ?? base?.w ?? 1.5,
    anchor: m.anchor ?? base?.anchor ?? [0.5, 0.98],
    anim: anim.length ? anim : undefined,
    shadow: m.shadow ?? base?.shadow,
    fade: m.fade ?? base?.fade,
    dark: m.dark ?? base?.dark,
    preset: m.preset ?? base?.preset,
    image: () => img,
    build: undefined,
  };
}

/** Bilde fra manifestet (props i public/assets/manifest.json) som ny rekvisitt, eller i stedet for en plassholder. */
function fromManifest(id: string): PropKind | undefined {
  const p = images.props[id];
  return p ? imageKind(id, p.img, p.meta) : undefined;
}

/** Rekvisitten med dette navnet (manifestet og bilder fra editoren går foran plassholderne). */
export function propKind(id: string): PropKind | undefined {
  return RUNTIME.get(id) ?? fromManifest(id) ?? REGISTRY.get(id);
}

/** Alle rekvisittene, sortert etter kilde og navn. */
export function allProps(): PropKind[] {
  const ids = new Set<string>([...REGISTRY.keys(), ...Object.keys(images.props), ...RUNTIME.keys()]);
  const order = { image: 0, painted: 1, model: 2 };
  return [...ids].map((id) => propKind(id)!).filter(Boolean).sort((a, b) => order[a.source] - order[b.source] || a.label.localeCompare(b.label));
}

export function propIds(): Set<string> {
  return new Set(allProps().map((p) => p.id));
}

/** Et bilde Tom dro inn i editoren (vises med en gang, lagres til manifestet ved SAVE under npm run dev). */
export function registerRuntimeProp(k: PropKind) {
  RUNTIME.set(k.id, k);
}
export function runtimeProps() {
  return [...RUNTIME.values()];
}
