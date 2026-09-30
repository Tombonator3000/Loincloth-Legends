// Malte utseendelag. Alle redigerte lerreter eies av varianten; kildene i assets.ts endres aldri.
import type { CharDef } from './chars/types';
import { getAppearanceAsset, getAssetRevision, getOverride, type PartOverride } from './assets';
import { findHeroAppearance, type HeroAppearanceKey } from '../data/hero-appearance';
import { HERO_APPEARANCE_LAYOUTS, type AppearancePlacement } from '../data/hero-appearance-layout';
import { HERO_SKIN_REGIONS } from '../data/hero-skin-regions';

type Point = readonly [number, number];
type SkinRegion = { include: readonly (readonly Point[])[]; exclude?: readonly (readonly Point[])[]; hairDetail?: readonly (readonly Point[])[]; family: string; reference?: string };
type HeadAssembly = { head: PartOverride; back?: PartOverride; front?: PartOverride; portrait: HTMLCanvasElement };
type Owned<T> = { owners: Set<string>; value: T };
const heads = new Map<string, Owned<HeadAssembly>>();
const tints = new Map<string, Owned<PartOverride>>();
const HEAD_LIMIT = 12, TINT_LIMIT = 36;
const BODY_SLOTS = ['head', 'torso', 'pelvis', 'arm', 'leg'] as const;
const FAMILY_REFERENCE: Record<string, string> = { warm: '#bf7b53', olive: '#78804f', frost: '#95adbd' };

function remember<T>(map: Map<string, Owned<T>>, key: string, owner: string, value: T, limit: number): T {
  map.delete(key);
  map.set(key, { owners: new Set([owner]), value });
  while (map.size > limit) map.delete(map.keys().next().value!);
  return value;
}

function read<T>(map: Map<string, Owned<T>>, key: string, owner: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return;
  map.delete(key);
  map.set(key, entry);
  entry.owners.add(owner);
  return entry.value;
}

function canvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  cv.getContext('2d', { willReadFrequently: true });
  return cv;
}

function copy(src: HTMLCanvasElement) {
  const cv = canvas(src.width, src.height);
  // Pikselkopi unngår en ny GPU-premultiplikasjon av halvtransparente kanter.
  cv.getContext('2d')!.putImageData(src.getContext('2d')!.getImageData(0, 0, src.width, src.height), 0, 0);
  return cv;
}

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function hueSat(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hue = d ? (mx === r ? (g - b) / d : mx === g ? 2 + (b - r) / d : 4 + (r - g) / d) * 60 : 0;
  if (hue < 0) hue += 360;
  return [hue, mx ? d / mx : 0, mx];
}

/** Fargefamilien er en ekstra sperre inne i de målte polygonene, aldri en erstatning for dem. */
function isSkin(r: number, g: number, b: number, family: string) {
  const [h, s, v] = hueSat(r, g, b);
  if (v < 28) return false;
  // Arr, skygger og høylys kan skifte fargefamilie inne i samme hudflate.
  if (family === 'olive') return (h >= 12 && h <= 115 && s >= 0.04 && s <= 0.95) || s < 0.09;
  if (family === 'frost') return (h >= 165 && h <= 255 && s <= 0.65) || (h >= 5 && h <= 60 && s <= 0.9) || s < 0.12;
  return h >= 5 && h <= 54 && s >= 0.12 && s <= 0.99;
}

function skinMask(src: HTMLCanvasElement, region: SkinRegion) {
  const cv = canvas(src.width, src.height), c = cv.getContext('2d')!;
  const fill = (polygons: readonly (readonly Point[])[]) => {
    for (const polygon of polygons) {
      if (polygon.length < 3) continue;
      c.beginPath();
      polygon.forEach(([x, y], i) => i ? c.lineTo(x * cv.width, y * cv.height) : c.moveTo(x * cv.width, y * cv.height));
      c.closePath();
      c.fill();
    }
  };
  c.fillStyle = '#fff';
  fill(region.include);
  c.globalCompositeOperation = 'destination-out';
  fill(region.exclude ?? []);
  return c.getImageData(0, 0, cv.width, cv.height).data;
}

function recolorSkin(src: HTMLCanvasElement, region: SkinRegion, color: string) {
  const cv = copy(src), c = cv.getContext('2d')!, image = c.getImageData(0, 0, cv.width, cv.height), d = image.data;
  const mask = skinMask(src, region), target = rgb(color), ref = rgb(region.reference ?? FAMILY_REFERENCE[region.family] ?? FAMILY_REFERENCE.warm);
  const hair = region.hairDetail?.length ? skinMask(src, { ...region, include: region.hairDetail, exclude: [] }) : undefined;
  const refL = Math.max(1, lum(...ref as [number, number, number]));
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3] || !mask[i + 3] || !isSkin(d[i], d[i + 1], d[i + 2], region.family)) continue;
    const l = lum(d[i], d[i + 1], d[i + 2]), shade = l / refL;
    // Mørke skjeggstrå ligger mellom hudpiksler, og må ikke gjøre hele området til en brun firkant.
    if (hair?.[i + 3]) {
      if (region.family === 'frost' ? !(d[i + 2] > d[i] + 5 && d[i + 2] >= d[i + 1]) : l < 100) continue;
    }
    const highlight = Math.max(0, (l - refL) / Math.max(1, 255 - refL)) * 0.3;
    const mix = mask[i + 3] / 255;
    for (let k = 0; k < 3; k++) {
      const value = Math.min(255, target[k] * shade) * (1 - highlight) + 255 * highlight;
      d[i + k] = Math.round(d[i + k] * (1 - mix) + value * mix);
    }
  }
  c.putImageData(image, 0, 0);
  return cv;
}

/** Hår/skjegg/iris er egne bilder. Det mørke blekket og høylysene beholdes ved fargebytte. */
function recolorLayer(src: HTMLCanvasElement, color?: string, iris = false) {
  if (!color) return src;
  const cv = copy(src), c = cv.getContext('2d')!, image = c.getImageData(0, 0, cv.width, cv.height), d = image.data;
  const target = rgb(color);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = lum(d[i], d[i + 1], d[i + 2]);
    // Pupillen og hvite lysglimt hører til øyet, ikke irisfargen.
    if (iris && (l < 35 || l > 228)) continue;
    const shade = l / 140;
    const hi = Math.max(0, (l - 190) / 65);
    for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, target[k] * shade) * (1 - hi) + 255 * hi;
  }
  c.putImageData(image, 0, 0);
  return cv;
}

export function heroAppearanceAvailable(key: HeroAppearanceKey, id: string): boolean {
  const option = findHeroAppearance(key, id);
  if (!option) return false;
  // Grunnhodet har allerede naturlige grå iriser. Farger krever den utskiftbare irisressursen.
  if (key === 'eyeStyle' && id === 'natural') return true;
  if (key === 'eyeColor' && option.color) return !!getAppearanceAsset('appearance_eye_natural');
  if (!option.asset) return true;
  return !!getAppearanceAsset(option.asset) && (!option.backAsset || !!getAppearanceAsset(option.backAsset));
}

/** Ukjente masker er utilgjengelige; et eksplisitt tomt include betyr at delen ikke viser hud. */
export function heroSkinSupport(ch: CharDef): { supported: string[]; unsupported: string[] } {
  const supported: string[] = [], unsupported: string[] = [];
  for (const part of BODY_SLOTS) {
    const source = ch.inherit?.[part] ?? ch.id;
    if (!getOverride(ch.id, part) && !getOverride(source, part)) continue;
    const region = HERO_SKIN_REGIONS[`${source}_${part}`] as SkinRegion | undefined;
    if (!region) unsupported.push(part);
    else if (region.include.length) supported.push(part);
  }
  return { supported, unsupported };
}

/** Farg bare den enkelte delens bekreftede hudområder. Geometri og ledd forblir uendret. */
export function applyHeroSkin(ch: CharDef, part: string, source: string, ov: PartOverride): PartOverride {
  const color = ch.appearance && findHeroAppearance('skinTone', ch.appearance.skinTone)?.color;
  const region = HERO_SKIN_REGIONS[`${source}_${part}`] as SkinRegion | undefined;
  if (!color || !region?.include.length) return ov;
  const key = [getAssetRevision(), source, part, color, ov.w, ov.h, ov.ax, ov.ay].join('|');
  const old = read(tints, key, ch.id);
  if (old) return old;
  const result = { ...ov, canvas: recolorSkin(ov.canvas, region, color), full: ov.full ? recolorSkin(ov.full, region, color) : undefined };
  return remember(tints, key, ch.id, result, TINT_LIMIT);
}

/** Relieffets materialdeteksjon må kjenne den nye hudfargen, særlig grønne og blå toner. */
export function appearanceSkinColors(ch: CharDef): string[] | undefined {
  const color = ch.appearance && findHeroAppearance('skinTone', ch.appearance.skinTone)?.color;
  return color ? [...(ch.skin ?? []), color] : ch.skin;
}

type Layer = { image: HTMLCanvasElement; p: AppearancePlacement; x: number; y: number; w: number; h: number; angle: number; layer: 'head' | 'back' | 'front' };

/** Sammensetting bruker opprinnelig pikselmål; større hår lager større lerret, aldri mindre ansikt. */
export function composeHeroHead(ch: CharDef, base: PartOverride): HeadAssembly {
  const source = ch.inherit?.head ?? ch.id, appearance = ch.appearance;
  const layout = HERO_APPEARANCE_LAYOUTS[source];
  const skin = applyHeroSkin(ch, 'head', source, base);
  if (!appearance || !layout) return { head: skin, portrait: skin.canvas };
  const key = [getAssetRevision(), source, JSON.stringify(appearance), base.w, base.h].join('|');
  const old = read(heads, key, ch.id);
  if (old) return old;
  const W = base.canvas.width, H = base.canvas.height, layers: Layer[] = [];
  const hairColor = findHeroAppearance('hairColor', appearance.hairColor)?.color;
  const headgear = findHeroAppearance('headgear', appearance.headgear);
  const covered = ['horned', 'skull'].includes(appearance.headgear) && !!headgear?.asset && !!getAppearanceAsset(headgear.asset) && !!layout.overlays[headgear.asset];
  const add = (id: string | undefined, color: string | undefined, fallback: Layer['layer']) => {
    if (!id) return;
    const image = getAppearanceAsset(id), p = layout.overlays[id];
    if (!image || !p) return;
    const w = p.width * W, h = p.height === undefined ? image.height / image.width * w : p.height * H;
    if (!(w > 0 && h > 0)) return;
    layers.push({ image: recolorLayer(image, color), p, x: p.at[0] * W, y: p.at[1] * H, w, h, angle: p.rotation ?? 0, layer: p.layer ?? fallback });
  };
  const hair = findHeroAppearance('hair', appearance.hair);
  add(hair?.backAsset, hairColor, 'back');
  if (!covered) add(hair?.asset, hairColor, 'head');
  add(findHeroAppearance('beard', appearance.beard)?.asset, hairColor, 'front');
  add(headgear?.asset, undefined, 'head');
  let minX = 0, minY = 0, maxX = W, maxY = H;
  for (const l of layers) {
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = (u - l.p.anchor[0]) * l.w, y = (v - l.p.anchor[1]) * l.h;
      const tx = l.x + x * Math.cos(l.angle) - y * Math.sin(l.angle), ty = l.y + x * Math.sin(l.angle) + y * Math.cos(l.angle);
      minX = Math.min(minX, tx); minY = Math.min(minY, ty); maxX = Math.max(maxX, tx); maxY = Math.max(maxY, ty);
    }
  }
  // En piksel luft sikrer at filteret ikke klipper siste hårstrå. Dataene er prosjektets kalibrering, ikke brukerinput.
  minX = Math.floor(minX) - 1; minY = Math.floor(minY) - 1; maxX = Math.ceil(maxX) + 1; maxY = Math.ceil(maxY) + 1;
  const width = maxX - minX, height = maxY - minY;
  const head = canvas(width, height), hc = head.getContext('2d')!;
  hc.drawImage(skin.canvas, -minX, -minY);
  const eye = findHeroAppearance('eyeStyle', appearance.eyeStyle), eyeImage = eye?.asset && getAppearanceAsset(eye.asset);
  const eyeColor = findHeroAppearance('eyeColor', appearance.eyeColor)?.color;
  if (eyeImage && layout.eyes && (appearance.eyeStyle !== 'natural' || eyeColor)) {
    const colored = recolorLayer(eyeImage, eyeColor, true);
    for (const e of layout.eyes) {
      const rx = e.radius[0] * W, ry = e.radius[1] * H;
      const cx = e.at[0] * W - minX, cy = e.at[1] * H - minY;
      const radius = rx + ry + 2;
      const x0 = Math.max(0, Math.floor(cx - radius)), y0 = Math.max(0, Math.floor(cy - radius));
      const bw = Math.min(width - x0, Math.ceil(cx + radius) - x0), bh = Math.min(height - y0, Math.ceil(cy + radius) - y0);
      const original = hc.getImageData(x0, y0, bw, bh);
      hc.save(); hc.globalCompositeOperation = 'source-atop'; hc.translate(cx, cy); hc.rotate(e.rotation ?? 0);
      hc.beginPath(); hc.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); hc.clip();
      hc.drawImage(colored, -rx, -ry, rx * 2, ry * 2); hc.restore();
      // Behold bildets opprinnelige lysreflekser, men ikke den runde pupillen når spilleren velger kattøye.
      const painted = hc.getImageData(x0, y0, bw, bh), before = original.data, after = painted.data;
      for (let i = 0; i < after.length; i += 4) {
        after[i + 3] = before[i + 3];
        if (lum(before[i], before[i + 1], before[i + 2]) > 200 && Math.max(before[i], before[i + 1], before[i + 2]) - Math.min(before[i], before[i + 1], before[i + 2]) < 35) {
          after[i] = before[i]; after[i + 1] = before[i + 1]; after[i + 2] = before[i + 2];
        }
      }
      hc.putImageData(painted, x0, y0);
    }
  }
  const back = layers.some((l) => l.layer === 'back') ? canvas(width, height) : undefined;
  const front = layers.some((l) => l.layer === 'front') ? canvas(width, height) : undefined;
  for (const l of layers) {
    const c = (l.layer === 'back' ? back! : l.layer === 'front' ? front! : head).getContext('2d')!;
    c.save(); c.translate(l.x - minX, l.y - minY); c.rotate(l.angle);
    c.drawImage(l.image, -l.p.anchor[0] * l.w, -l.p.anchor[1] * l.h, l.w, l.h); c.restore();
  }
  const portrait = canvas(width, height), pc = portrait.getContext('2d')!;
  if (back) pc.drawImage(back, 0, 0);
  pc.drawImage(head, 0, 0);
  if (front) pc.drawImage(front, 0, 0);
  const wrap = (cv: HTMLCanvasElement): PartOverride => {
    const w = base.w * width / W, h = base.h * height / H;
    const ax = (base.ax * W - minX) / width, ay = (base.ay * H - minY) / height;
    return { ...base, canvas: cv, full: undefined, w, h, ax, ay, ox: ax * w, oy: (1 - ay) * h, fixedH: true };
  };
  return remember(heads, key, ch.id, { head: wrap(head), back: back && wrap(back), front: front && wrap(front), portrait }, HEAD_LIMIT);
}

/** De samme lagene som riggen, samlet for kort, HUD-portrett og hodet som flyr mot skjermen. */
export function heroHeadPreview(ch: CharDef): HTMLCanvasElement | undefined {
  const source = ch.inherit?.head ?? ch.id, base = getOverride(ch.id, 'head') ?? getOverride(source, 'head');
  return base ? composeHeroHead(ch, base).portrait : undefined;
}

export function purgeHeroAppearance(owner: string) {
  for (const [key, entry] of heads) if (entry.owners.delete(owner) && !entry.owners.size) heads.delete(key);
  for (const [key, entry] of tints) if (entry.owners.delete(owner) && !entry.owners.size) tints.delete(key);
}

/** Små tall for regresjonstester, ingen referanser til de delte kildene. */
export function heroAppearanceCacheStats() { return { heads: heads.size, tints: tints.size, headLimit: HEAD_LIMIT, tintLimit: TINT_LIMIT }; }
