// Tegnehjelpere i "enhetsrom": origo i leddet (pivot), y opp, 1 = én verdensenhet.
export const INK = '#1a0f0a';

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) {
    r = Math.round(r * (1 + amt)); g = Math.round(g * (1 + amt)); b = Math.round(b * (1 + amt));
  } else {
    r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
  }
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export type Fill = string | CanvasGradient | CanvasPattern | null;
type PathFn = (c: CanvasRenderingContext2D) => void;

export class Pen {
  constructor(public c: CanvasRenderingContext2D, public lw = 0.045) {}

  shape(path: PathFn, fill: Fill, stroke = true, lw = this.lw) {
    const c = this.c;
    c.beginPath();
    path(c);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.lineWidth = lw;
      c.strokeStyle = INK;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
    }
  }

  /** Fyll en form, legg skygge innenfor (klippet), og tegn kontur til slutt. */
  shaded(path: PathFn, fill: string, shadeCol: string, shadePath: PathFn, stroke = true) {
    const c = this.c;
    c.save();
    c.beginPath();
    path(c);
    c.fillStyle = fill;
    c.fill();
    c.clip();
    c.beginPath();
    shadePath(c);
    c.fillStyle = shadeCol;
    c.fill();
    c.restore();
    if (stroke) this.shape(path, null);
  }

  /** Klipp til en sti og kjør tegning inni. */
  clipTo(path: PathFn, fn: () => void) {
    const c = this.c;
    c.save();
    c.beginPath();
    path(c);
    c.clip();
    fn();
    c.restore();
  }

  ell(x: number, y: number, rx: number, ry: number, fill: Fill, stroke = true, rot = 0) {
    this.shape((c) => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2), fill, stroke);
  }

  poly(pts: number[], fill: Fill, stroke = true, close = true) {
    this.shape((c) => polyPath(c, pts, close), fill, stroke);
  }

  blob(pts: number[], fill: Fill, stroke = true) {
    this.shape((c) => blobPath(c, pts), fill, stroke);
  }

  /** Tykke avrundede lemmer med kontur. segs: [[x1,y1,x2,y2,...], radius] */
  limbs(segs: [number[], number][], fill: string) {
    const c = this.c;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [pts, r] of segs) {
      c.beginPath();
      polyPath(c, pts, false);
      c.strokeStyle = INK;
      c.lineWidth = r * 2 + this.lw * 2;
      c.stroke();
    }
    for (const [pts, r] of segs) {
      c.beginPath();
      polyPath(c, pts, false);
      c.strokeStyle = fill;
      c.lineWidth = r * 2;
      c.stroke();
    }
  }

  line(pts: number[], w: number, col = INK) {
    const c = this.c;
    c.beginPath();
    polyPath(c, pts, false);
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }

  rrect(x: number, y: number, w: number, h: number, r: number, fill: Fill, stroke = true) {
    this.shape((c) => rrectPath(c, x, y, w, h, r), fill, stroke);
  }

  /** Pelskant: taggete linje. */
  fur(x1: number, x2: number, y: number, depth: number, n: number, fill: string, dir = -1) {
    const pts: number[] = [];
    const w = (x2 - x1) / n;
    pts.push(x1, y - dir * depth * 0.2);
    for (let i = 0; i <= n; i++) {
      pts.push(x1 + i * w, y + dir * (i % 2 === 0 ? depth : depth * 0.2));
    }
    pts.push(x2, y - dir * depth * 0.2);
    this.poly(pts, fill);
  }
}

export function polyPath(c: CanvasRenderingContext2D, pts: number[], close = true) {
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
}

/** Glatt lukket kurve gjennom midtpunkter. */
export function blobPath(c: CanvasRenderingContext2D, pts: number[]) {
  const n = pts.length / 2;
  const mx = (i: number) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  c.moveTo(mx(0), my(0));
  for (let i = 1; i <= n; i++) {
    const px = pts[(i % n) * 2];
    const py = pts[(i % n) * 2 + 1];
    c.quadraticCurveTo(px, py, mx(i), my(i));
  }
  c.closePath();
}

export function rrectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

/** Lag et canvas med enhetsrom der (0,0) er pivot, y opp. */
export function unitCanvas(w: number, h: number, ox: number, oy: number, ppu: number, draw: (p: Pen) => void, lw = 0.045) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(4, Math.ceil(w * ppu));
  cv.height = Math.max(4, Math.ceil(h * ppu));
  const c = cv.getContext('2d')!;
  c.translate(ox * ppu, cv.height - oy * ppu);
  c.scale(ppu, -ppu);
  draw(new Pen(c, lw));
  return cv;
}

/** Vanlig canvas (y ned) for UI-bilder. */
export function plainCanvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  return cv;
}
