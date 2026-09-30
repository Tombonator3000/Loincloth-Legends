// Lagring og innlesing i brettverkstedet. Under `npm run dev` skriver en liten Vite-utvidelse (tools/stage-forge.ts)
// brettfila rett i src/data/layouts og nye bilder i public/assets med manifestet oppdatert. Ellers lastes filene ned.
import { layoutToJson, validateLayout, type LevelLayout, type LayerId } from '../data/layout';
import { setSavedLayout } from '../data/layouts';
import { images, type ManifestProp } from '../gfx/assets';
import { registerRuntimeProp, propKind, imageKind, type PropKind } from '../gfx/props/catalog';
import { forgetArt } from '../gfx/scenery';

let pinged: boolean | null = null;

/** Kjører dev-serveren med lagring? (Svaret huskes.) */
export async function canSave(): Promise<boolean> {
  if (pinged !== null) return pinged;
  try {
    const r = await fetch('/__forge/ping', { cache: 'no-store' });
    pinged = r.ok && (await r.text()) === 'stage-forge';
  } catch {
    pinged = false;
  }
  return pinged;
}

export function download(name: string, data: string | Blob, type = 'application/json') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

/** Lagre brettfila (i repoet under npm run dev, ellers som nedlasting). */
export async function saveLayout(l: LevelLayout): Promise<'saved' | 'downloaded'> {
  const json = layoutToJson(l);
  if (await canSave()) {
    const r = await fetch('/__forge/layout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ level: l.level, json }),
    });
    if (!r.ok) throw new Error(await r.text());
    setSavedLayout(l.level, JSON.parse(json) as LevelLayout);
    return 'saved';
  }
  download(l.level + '.json', json);
  return 'downloaded';
}

/** Les en brettfil (JSON) som Tom har lastet ned tidligere. */
export async function readLayoutFile(file: File, known: Set<string>): Promise<{ layout: LevelLayout; errors: string[] }> {
  const layout = JSON.parse(await file.text()) as LevelLayout;
  return { layout, errors: validateLayout(layout, known) };
}

// ---------------------------------------------------------------- bilder dratt inn
interface Imported {
  id: string;
  canvas: HTMLCanvasElement;
  meta: ManifestProp;
  saved: boolean;
}
const imported = new Map<string, Imported>();
/** Rekvisitter fra manifestet der Tom har endret mål eller animasjon i editoren (lagres til manifestet). */
const metaChanged = new Set<string>();

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('could not read ' + file.name));
    img.src = URL.createObjectURL(file);
  });
}

/** Klipp bort gjennomsiktig kant (som process_art.py), med litt luft rundt. */
function trimmed(img: HTMLImageElement): HTMLCanvasElement {
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return cv;
  const pad = 2;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Navnet på rekvisitten ut fra filnavnet: prop_skilt.png blir «skilt», anim_kråke_4x1.png en bildeserie. */
export function parseImageName(name: string): { id: string; grid: [number, number] | null } {
  let base = name.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  let grid: [number, number] | null = null;
  const g = /_(\d+)x(\d+)$/.exec(base);
  if (g) {
    grid = [Number(g[1]), Number(g[2])];
    base = base.slice(0, g.index);
  }
  base = base.replace(/^(prop|anim)_/, '');
  const id = base.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'prop';
  return { id, grid };
}

/** Et bilde Tom drar inn: vises med en gang i biblioteket og kan brukes. Lagres til manifestet ved SAVE. */
export async function importImage(file: File, layer: LayerId): Promise<PropKind> {
  const img = await loadImage(file);
  const { id: base, grid } = parseImageName(file.name);
  // Bildeserier klippes ikke (rutene må ha samme størrelse); enkeltbilder får kanten fjernet
  const canvas = grid ? (() => {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    cv.getContext('2d')!.drawImage(img, 0, 0);
    return cv;
  })() : trimmed(img);
  let id = base;
  for (let n = 2; imported.has(id) && imported.get(id)!.saved; n++) id = base + '_' + n;
  const fw = grid ? canvas.width / grid[0] : canvas.width, fh = grid ? canvas.height / grid[1] : canvas.height;
  const aspect = fw / fh;
  const w = aspect > 1.6 ? 3 : aspect < 0.5 ? 1 : 1.6;
  const meta: ManifestProp = { file: 'prop_' + id + '.webp', w, anchor: [0.5, 0.98], layer, label: id.toUpperCase().replace(/_/g, ' ') };
  if (grid) {
    meta.grid = grid;
    meta.n = grid[0] * grid[1];
  }
  imported.set(id, { id, canvas, meta, saved: false });
  forgetArt(id);
  const kind = kindFor(id, canvas, meta);
  registerRuntimeProp(kind);
  return kind;
}

function kindFor(id: string, canvas: HTMLCanvasElement | HTMLImageElement, meta: ManifestProp): PropKind {
  return imageKind(id, canvas, meta);
}

/** Kan målene (bredde, fotpunkt, animasjon) endres på denne rekvisitten? Bilder ja, plassholdere og 3D nei. */
export function editableMeta(id: string): ManifestProp | null {
  const imp = imported.get(id);
  if (imp) return imp.meta;
  const p = images.props[id];
  return p ? p.meta : null;
}

/** Endre målene på et bilde (fra editoren). Bygges om av kallstedet. */
export function setMeta(id: string, meta: ManifestProp) {
  const imp = imported.get(id);
  if (imp) {
    imp.meta = meta;
    registerRuntimeProp(kindFor(id, imp.canvas, meta));
  } else if (images.props[id]) {
    images.props[id].meta = meta;
    metaChanged.add(id);
    registerRuntimeProp(kindFor(id, images.props[id].img, meta));
  }
  forgetArt(id);
}

/** Noe som ikke er lagret til manifestet ennå? */
export function unsavedImages() {
  return [...imported.values()].filter((i) => !i.saved).length + metaChanged.size;
}

function blobToBase64(b: Blob) {
  return new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^,]+,/, ''));
    r.readAsDataURL(b);
  });
}

/** Lagre nye bilder og endrede mål til public/assets og manifestet (bare under npm run dev). Gir antallet. */
export async function saveImages(): Promise<number> {
  if (!(await canSave())) {
    // Uten dev-serveren: last ned bildene og en manifestbit Tom kan lime inn
    const list = [...imported.values()].filter((i) => !i.saved);
    for (const i of list) {
      const blob = await new Promise<Blob | null>((res) => i.canvas.toBlob(res, 'image/png'));
      if (blob) download('prop_' + i.id + '.png', blob, 'image/png');
    }
    return list.length;
  }
  let n = 0;
  for (const i of imported.values()) {
    if (i.saved) continue;
    const blob = await new Promise<Blob | null>((res) => i.canvas.toBlob(res, 'image/webp', 0.92));
    if (!blob) continue;
    const r = await fetch('/__forge/prop', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: i.id, meta: i.meta, data: await blobToBase64(blob) }),
    });
    if (!r.ok) throw new Error(await r.text());
    i.saved = true;
    n++;
  }
  for (const id of [...metaChanged]) {
    const p = images.props[id];
    if (!p) continue;
    const r = await fetch('/__forge/prop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, meta: p.meta }) });
    if (!r.ok) throw new Error(await r.text());
    metaChanged.delete(id);
    n++;
  }
  return n;
}

/** Finnes rekvisitten (også bilder som er dratt inn)? */
export function known(id: string) {
  return !!propKind(id);
}
