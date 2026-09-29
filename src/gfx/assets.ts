// Valgfri PNG-grafikk som erstatter prosedyretegningen.
// Legg filer i public/assets/ og beskriv dem i public/assets/manifest.json (se docs/ART_PROMPTS.md).
// Finnes ikke manifestet, brukes den prosedyretegnede grafikken som før.
import { TORSO_Y, ARM_L, LEG_L } from './chars/types';

export interface PartOverride { canvas: HTMLCanvasElement; w: number; h: number; ox: number; oy: number }

type PartKey = 'head' | 'hairback' | 'torso' | 'pelvis' | 'arm' | 'leg' | 'weapon' | 'body' | 'tail';
interface ManifestPart {
  char: string;
  /**
   * Figurdeler: head torso pelvis arm leg weapon, og hairback (langt hår som henger bak ryggen, valgfritt).
   * Ridedyr: body head tail leg. Kjæledyr (char pet_<id>): body.
   */
  part: PartKey;
  file: string;
  /** Høyde i verdensenheter. Standard: se DEFAULT_H. */
  height?: number;
  /** Leddpunkt i det beskårne bildet, [x, y] fra 0 til 1, y fra toppen. */
  anchor?: [number, number];
}
interface Manifest {
  parts?: ManifestPart[];
  sky?: Record<string, string>;
  /** Flisbare teksturer for 3D-verdenen, navn til fil. Navnene står i docs/ART_PROMPTS.md (ground_grass, road_grass ...). */
  textures?: Record<string, string>;
  map?: string;
  title?: string;
}

const DEFAULT_ANCHOR: Record<PartKey, [number, number]> = {
  head: [0.5, 0.95],
  // Nakkepunktet i hårmanken: litt ned fra toppen og til høyre for midten (håret faller ned bak ryggen)
  hairback: [0.62, 0.22],
  torso: [0.5, 0.96],
  pelvis: [0.5, 0.12],
  arm: [0.5, 0.06],
  leg: [0.4, 0.04],
  weapon: [0.5, 0.82],
  body: [0.5, 0.5],
  tail: [0.92, 0.55],
};
const DEFAULT_H: Record<PartKey, number> = {
  head: 1.0,
  hairback: 1.3,
  torso: 0.9,
  pelvis: 0.6,
  arm: 0.78,
  leg: 0.92,
  weapon: 1.7,
  body: 0.6,
  tail: 0.6,
};
/** Heltene (lange bein, store armer, stort hår) har egne standardhøyder. */
const HERO_IDS = new Set(['thrugg', 'valkyra']);
/** Kropp, arm og bein følger proporsjonene i chars/types.ts, så PNG-deler og tegnede deler passer sammen. */
const HERO_H: Partial<Record<PartKey, number>> = {
  // PNG-hoder i karikaturstil har stort hår, så hele bildet blir høyere enn det tegnede hodet
  head: 1.1,
  hairback: 1.25,
  torso: 0.95 * TORSO_Y,
  pelvis: 0.35,
  arm: 0.8 + 0.6 * (ARM_L - 1),
  leg: 0.66 + 0.645 * (LEG_L - 1),
};
/** Ridedyr: hodet festes i nakken (venstre side av bildet). */
const BEAST_IDS = new Set(['warhog', 'cluckatrice', 'magmanewt']);
const BEAST_ANCHOR: Partial<Record<PartKey, [number, number]>> = { head: [0.15, 0.55], body: [0.5, 0.5], tail: [0.92, 0.55], leg: [0.5, 0.06] };
const BEAST_H: Partial<Record<PartKey, number>> = { head: 0.9, body: 1.3, tail: 0.6, leg: 0.75 };

const parts = new Map<string, PartOverride>();
export const images: {
  sky: Record<string, HTMLImageElement>;
  textures: Record<string, HTMLImageElement>;
  map: HTMLImageElement | null;
  title: HTMLImageElement | null;
} = { sky: {}, textures: {}, map: null, title: null };

export function getOverride(charId: string, key: string): PartOverride | undefined {
  return parts.get(charId + ':' + key);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Kunne ikke laste ' + src));
    img.src = src;
  });
}

/** Beskjær gjennomsiktige kanter så ankerpunktene blir forutsigbare. */
function trim(img: HTMLImageElement) {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
  for (let y = 0; y < cv.height; y++)
    for (let x = 0; x < cv.width; x++)
      if (d[(y * cv.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 <= x0 || y1 <= y0) return cv;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export async function loadAssets(base = './assets/') {
  let man: Manifest;
  // Åpnet som fil (dobbeltklikk på single-file-bygget): fetch virker ikke der, så dropp PNG-ene
  if (location.protocol === 'file:') return 0;
  try {
    const r = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (!r.ok) return 0;
    man = (await r.json()) as Manifest;
  } catch {
    return 0;
  }
  let n = 0;
  const jobs: Promise<void>[] = [];
  for (const p of man.parts ?? []) {
    jobs.push(
      loadImage(base + p.file)
        .then((img) => {
          const cv = trim(img);
          const beast = BEAST_IDS.has(p.char);
          const h = p.height ?? (beast ? BEAST_H[p.part] : HERO_IDS.has(p.char) ? HERO_H[p.part] : undefined) ?? DEFAULT_H[p.part] ?? 1;
          const w = (cv.width / cv.height) * h;
          const [ax, ay] = p.anchor ?? (beast ? BEAST_ANCHOR[p.part] : undefined) ?? DEFAULT_ANCHOR[p.part] ?? [0.5, 0.5];
          parts.set(p.char + ':' + p.part, { canvas: cv, w, h, ox: ax * w, oy: (1 - ay) * h });
          n++;
        })
        .catch((e) => console.warn(e)),
    );
  }
  for (const [biome, file] of Object.entries(man.sky ?? {})) {
    jobs.push(loadImage(base + file).then((img) => void (images.sky[biome] = img)).catch((e) => console.warn(e)));
  }
  for (const [name, file] of Object.entries(man.textures ?? {})) {
    jobs.push(loadImage(base + file).then((img) => void (images.textures[name] = img)).catch((e) => console.warn(e)));
  }
  if (man.map) jobs.push(loadImage(base + man.map).then((img) => void (images.map = img)).catch((e) => console.warn(e)));
  if (man.title) jobs.push(loadImage(base + man.title).then((img) => void (images.title = img)).catch((e) => console.warn(e)));
  await Promise.all(jobs);
  return n;
}
