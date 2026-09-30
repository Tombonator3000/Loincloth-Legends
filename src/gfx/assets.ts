// Valgfri PNG-grafikk som erstatter prosedyretegningen.
// Legg filer i public/assets/ og beskriv dem i public/assets/manifest.json (se docs/ART_PROMPTS.md).
// Finnes ikke manifestet, brukes den prosedyretegnede grafikken som før.
import { TORSO_Y, ARM_L, LEG_L } from './chars/types';

export interface PartOverride {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** Leddpunktet som brøk av bildet, [x, y] med y fra toppen. */
  ax: number;
  ay: number;
  /** Høyden er satt i manifestet (eller av beltet) og skal ikke regnes om fra riggen. */
  fixedH: boolean;
  /** Armer: neven i bildet (brøk, y fra toppen). Riggen snur og skalerer armen så neven havner i våpenleddet. */
  hand?: [number, number];
  /**
   * Overkropper: skulderleddene i bildet (brøk, y fra toppen), den nære skulderen først. Figurene står i trekvart
   * profil mot høyre, så den nære skulderen (med skulderplaten) er til venstre i bildet. Våpenarmen festes der og
   * tegnes foran, den andre armen festes på den fjerne skulderen og tegnes bak overkroppen.
   */
  shoulders?: [[number, number], [number, number]];
  /**
   * Overkropper: halsroten i bildet (brøk, y fra toppen), der hodet festes. Med en tredje verdi (halv bredde, brøk av
   * bredden) tones halsstumpen over halsroten ut, så hodets egen hals tar over uten søm.
   */
  neck?: [number, number] | [number, number, number];
  /** Hoder: tegnes foran overkroppen (langt skjegg som henger over brystet). Ellers ligger hodet bak halsen på overkroppen. */
  front?: boolean;
}

/** Samme bilde i en annen høyde. Leddpunktet følger med. Riggene bruker den til høyder regnet ut fra leddene. */
export function resized(ov: PartOverride, h: number): PartOverride {
  const w = (ov.canvas.width / ov.canvas.height) * h;
  return { ...ov, w, h, ox: ov.ax * w, oy: (1 - ov.ay) * h };
}

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
  /** Leddpunkt i det beskårne bildet, [x, y] fra 0 til 1, y fra toppen. For våpen er det grepet. */
  anchor?: [number, number];
  /** Armer: neven i det beskårne bildet, [x, y] som anchor. Uten den finner lasteren neven nederst i armen. */
  hand?: [number, number];
  /** Overkropper: midten av den nære og den fjerne skulderen, [[x, y], [x, y]] som anchor. Standard: SHOULDERS. */
  shoulders?: [[number, number], [number, number]];
  /** Overkropper: halsroten [x, y] der hodet festes, og eventuelt halv bredde på halsstumpen som skal tones ut. */
  neck?: [number, number] | [number, number, number];
  /** Hoder: tegn hodet foran overkroppen (langt skjegg). */
  front?: boolean;
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
/**
 * Skulderleddene i en overkropp uten shoulders i manifestet: skulderplaten ytterst til venstre, en tredjedel ned, og
 * den fjerne skulderen like innenfor høyre kant. Slik har ChatGPT tegnet overkroppene (se docs/ART_PROMPTS.md).
 */
const SHOULDERS: [[number, number], [number, number]] = [[0.09, 0.32], [0.92, 0.32]];
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
/** Heltenes belte er like bredt som midjen. Hoftedelen skaleres etter beltet, så en lang flik kan henge under. */
const HERO_BELT_W = 0.5;
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
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (error) {
        // Avbryt nedlastingen og ignorer en eventuell callback som allerede er køet.
        img.removeAttribute('src');
        rej(error);
      } else res(img);
    };
    const timer = setTimeout(() => finish(new Error('Tidsavbrudd ved lasting av ' + src)), 60_000);
    img.onload = () => finish();
    img.onerror = () => finish(new Error('Kunne ikke laste ' + src));
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

/**
 * Midten av det som er tegnet i de øverste (top) eller nederste radene, som brøk av bredden. Leddet sitter der:
 * nakken nederst på hodet, midjen nederst på overkroppen, skaftet nederst på våpenet, beltet, skulderen og
 * hoften øverst. Da flytter ikke stort hår til én side eller et øksehode til én side festepunktet.
 */
function edgeX(cv: HTMLCanvasElement, top: boolean) {
  const rows = Math.max(1, Math.round(cv.height * 0.04));
  const y0 = top ? 0 : cv.height - rows;
  const d = cv.getContext('2d')!.getImageData(0, y0, cv.width, rows).data;
  let sum = 0, k = 0;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cv.width; x++)
      if (d[(y * cv.width + x) * 4 + 3] > 128) {
        sum += x;
        k++;
      }
  return k ? (sum / k + 0.5) / cv.width : 0.5;
}
const EDGE_TOP: Partial<Record<PartKey, boolean>> = { head: false, torso: false, pelvis: true, arm: true, leg: true };

/**
 * Neven i et armbilde: midten av det som er tegnet mellom 80 og 97 prosent ned. Armen fra ChatGPT henger ikke alltid
 * rett ned (den kan være bøyd eller strukket fram), men neven er nederst.
 */
function fistPoint(cv: HTMLCanvasElement): [number, number] {
  const y0 = Math.floor(cv.height * 0.8), y1 = Math.max(y0 + 1, Math.floor(cv.height * 0.97));
  const d = cv.getContext('2d')!.getImageData(0, y0, cv.width, y1 - y0).data;
  let sx = 0, sy = 0, k = 0;
  for (let y = 0; y < y1 - y0; y++)
    for (let x = 0; x < cv.width; x++)
      if (d[(y * cv.width + x) * 4 + 3] > 128) {
        sx += x;
        sy += y;
        k++;
      }
  return k ? [(sx / k + 0.5) / cv.width, (sy / k + y0 + 0.5) / cv.height] : [0.5, 0.86];
}

/**
 * Grepet på et våpen: det lengste smale strekket i nedre halvdel er skaftet eller håndtaket (knappen, ringen,
 * parerstanga og bladet er bredere). Hånden holder nederst på det, en halv neve over enden, midt på skaftet.
 */
function gripPoint(cv: HTMLCanvasElement): [number, number] {
  const W = cv.width, H = cv.height;
  const d = cv.getContext('2d')!.getImageData(0, 0, W, H).data;
  const wid: number[] = [], mid: number[] = [];
  for (let y = 0; y < H; y++) {
    let x0 = -1, x1 = -1, s = 0, k = 0;
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 128) {
        if (x0 < 0) x0 = x;
        x1 = x;
        s += x;
        k++;
      }
    wid.push(x0 < 0 ? 0 : x1 - x0 + 1);
    mid.push(k ? s / k : W / 2);
  }
  const lo = Math.floor(H * 0.45);
  const low = wid.slice(lo).filter((w) => w > 0).sort((a, b) => a - b);
  if (!low.length) return [0.5, 0.82];
  const narrow = low[Math.floor(low.length * 0.1)] * 1.35;
  let len = 0, top = 0, bot = 0, run = -1;
  for (let y = lo; y <= H; y++) {
    const n = y < H && wid[y] > 0 && wid[y] <= narrow;
    if (n && run < 0) run = y;
    if (!n && run >= 0) {
      if (y - run > len) [len, top, bot] = [y - run, run, y - 1];
      run = -1;
    }
  }
  if (len < H * 0.04) return [0.5, 0.82];
  const gy = bot - Math.min(0.5 * (bot - top), 0.08 * H);
  return [(mid[Math.round(gy)] + 0.5) / W, gy / H];
}

/** Bredden på beltet øverst i en hoftedel, i piksler: bredeste rad blant de øverste 8 prosentene. */
function beltWidth(cv: HTMLCanvasElement) {
  const rows = Math.max(1, Math.round(cv.height * 0.08));
  const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, rows).data;
  let best = 0;
  for (let y = 0; y < rows; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < cv.width; x++)
      if (d[(y * cv.width + x) * 4 + 3] > 128) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    if (x0 >= 0) best = Math.max(best, x1 - x0 + 1);
  }
  return best;
}

export async function loadAssets(base = './assets/') {
  let man: Manifest;
  // Åpnet som fil (dobbeltklikk på single-file-bygget): fetch virker ikke der, så dropp PNG-ene
  if (location.protocol === 'file:') return 0;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Grensen dekker både svaret og JSON-innholdet. Ingen sene data får starte
    // bildelasting etter at spillet har gått videre med reservegrafikken.
    man = await Promise.race([
      (async () => {
        const r = await fetch(base + 'manifest.json', { cache: 'no-cache', signal: controller.signal });
        if (!r.ok) throw new Error('Kunne ikke laste grafikkmanifestet');
        return (await r.json()) as Manifest;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Tidsavbrudd ved lasting av grafikkmanifestet'));
        }, 15_000);
      }),
    ]);
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
  let n = 0;
  const jobs: Promise<void>[] = [];
  for (const p of man.parts ?? []) {
    jobs.push(
      loadImage(base + p.file)
        .then((img) => {
          const cv = trim(img);
          const beast = BEAST_IDS.has(p.char);
          let h = p.height ?? (beast ? BEAST_H[p.part] : HERO_IDS.has(p.char) ? HERO_H[p.part] : undefined) ?? DEFAULT_H[p.part] ?? 1;
          let fixedH = p.height !== undefined;
          if (!fixedH && p.part === 'pelvis' && HERO_IDS.has(p.char)) {
            const bw = beltWidth(cv);
            if (bw > 0) {
              h = Math.min(1.2, Math.max(0.25, (HERO_BELT_W * cv.height) / bw));
              fixedH = true;
            }
          }
          const grip = !p.anchor && !beast && p.part === 'weapon' ? gripPoint(cv) : undefined;
          let [ax, ay] = p.anchor ?? (beast ? BEAST_ANCHOR[p.part] : undefined) ?? grip ?? DEFAULT_ANCHOR[p.part] ?? [0.5, 0.5];
          const edge = EDGE_TOP[p.part];
          if (!p.anchor && !beast && edge !== undefined) ax = edgeX(cv, edge);
          const hand = p.part === 'arm' && !beast ? (p.hand ?? fistPoint(cv)) : undefined;
          const shoulders = p.part === 'torso' && !beast ? (p.shoulders ?? SHOULDERS) : undefined;
          const w = (cv.width / cv.height) * h;
          const neck = p.part === 'torso' && !beast ? p.neck : undefined;
          parts.set(p.char + ':' + p.part, { canvas: cv, w, h, ox: ax * w, oy: (1 - ay) * h, ax, ay, fixedH, hand, shoulders, neck, front: p.front });
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
