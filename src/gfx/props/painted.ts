// Malte plassholdere for rekvisittene i brettverkstedet, tegnet i kode til ChatGPT leverer ekte bilder med samme
// navn (prop_<navn>.png i manifestet tar over, se docs/PLAN_BRETT_GORR_AI.md del 9.2). Ingen konturstreker: form,
// lys og skygge tegnes med overganger, som et grovt malt forarbeid. Hver maler har sitt eget frø, så den ser lik ut
// hver gang og ikke spiser tall fra brettets frø.
import { seeded, hashSeed } from '../../core/math';
import { shade } from '../draw';

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

function canvas(w: number, h: number, draw: (c: Ctx, r: Rng) => void, seed: string) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c, seeded(hashSeed(seed)));
  return cv;
}
const between = (r: Rng, a: number, b: number) => a + r() * (b - a);

/** Små flekker og striper for overflate (bark, jord, stoff). */
function speckle(c: Ctx, r: Rng, x: number, y: number, w: number, h: number, cols: string[], n: number, size: number, alpha = 0.5) {
  c.save();
  for (let i = 0; i < n; i++) {
    c.globalAlpha = alpha * between(r, 0.3, 1);
    c.fillStyle = cols[Math.floor(r() * cols.length)];
    const s = size * between(r, 0.4, 1.4);
    c.fillRect(x + r() * w, y + r() * h, s, s * between(r, 0.6, 2.2));
  }
  c.restore();
}

/** En loddrett stokk med bark: rund skygge på tvers, barkfurer på langs, lysere kappe i toppen. */
function log(c: Ctx, r: Rng, x: number, top: number, bottom: number, w: number, base: string, pointed = true) {
  const tip = pointed ? w * between(r, 0.7, 1.05) : 0;
  c.save();
  c.beginPath();
  c.moveTo(x, bottom);
  c.lineTo(x + between(r, -2, 2), top + tip);
  if (pointed) c.lineTo(x + w * between(r, 0.4, 0.6), top);
  else c.lineTo(x + w * 0.5, top - w * 0.08);
  c.lineTo(x + w + between(r, -2, 2), top + tip);
  c.lineTo(x + w, bottom);
  c.closePath();
  c.clip();
  // Rund stokk: mørk i kantene, lys litt til venstre for midten (lyset kommer forfra og ovenfra)
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(base, -0.45));
  g.addColorStop(0.3, shade(base, 0.12));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, -0.55));
  c.fillStyle = g;
  c.fillRect(x - 4, top - 4, w + 8, bottom - top + 8);
  // Barkfurer
  c.lineCap = 'round';
  for (let i = 0; i < w * 0.5; i++) {
    const fx = x + r() * w;
    const fy = top + tip + r() * (bottom - top - tip);
    const len = between(r, 20, 120);
    c.strokeStyle = r() < 0.7 ? shade(base, -0.6) : shade(base, 0.25);
    c.globalAlpha = between(r, 0.25, 0.7);
    c.lineWidth = between(r, 1, 3.2);
    c.beginPath();
    c.moveTo(fx, fy);
    c.bezierCurveTo(fx + between(r, -3, 3), fy + len * 0.3, fx + between(r, -3, 3), fy + len * 0.6, fx + between(r, -2, 2), fy + len);
    c.stroke();
  }
  c.globalAlpha = 1;
  // Tilspisset topp: lyst, hugget treverk med fasetter
  if (pointed) {
    const tg = c.createLinearGradient(x, top, x + w, top + tip);
    tg.addColorStop(0, '#d8b98a');
    tg.addColorStop(0.5, '#b48c5c');
    tg.addColorStop(1, '#7a5634');
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(x - 4, top + tip + 6);
    c.lineTo(x + w * 0.5, top - 2);
    c.lineTo(x + w + 4, top + tip + 6);
    c.lineTo(x + w + 4, top + tip + 16);
    c.lineTo(x - 4, top + tip + 16);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(80,50,25,0.45)';
    c.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.moveTo(x + w * (0.2 + k * 0.3), top + tip + 12);
      c.lineTo(x + w * 0.5, top + 4);
      c.stroke();
    }
  }
  // Mørkere ved bakken (jord og fukt)
  const dg = c.createLinearGradient(0, bottom - 60, 0, bottom);
  dg.addColorStop(0, 'rgba(40,28,15,0)');
  dg.addColorStop(1, 'rgba(40,28,15,0.75)');
  c.fillStyle = dg;
  c.fillRect(x - 4, bottom - 60, w + 8, 64);
  c.restore();
}

/** Tau surret rundt stokkene: mørkt bånd med skrå vridninger. */
function rope(c: Ctx, r: Rng, x0: number, x1: number, y: number, h: number) {
  c.save();
  const g = c.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, '#6a5a3e');
  g.addColorStop(0.5, '#9a8458');
  g.addColorStop(1, '#4a3c26');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x0, y - h / 2 + between(r, -2, 2));
  c.lineTo(x1, y - h / 2 + between(r, -3, 3));
  c.lineTo(x1, y + h / 2 + between(r, -3, 3));
  c.lineTo(x0, y + h / 2);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(40,30,15,0.55)';
  c.lineWidth = 1.6;
  for (let x = x0 + 4; x < x1; x += h * 0.55) {
    c.beginPath();
    c.moveTo(x, y - h / 2);
    c.lineTo(x + h * 0.45, y + h / 2);
    c.stroke();
  }
  c.restore();
}

// ---------------------------------------------------------------- palisade
export function paintPalisade(variant: 'a' | 'b') {
  const W = 640, H = 700;
  return canvas(W, H, (c, r) => {
    const n = variant === 'a' ? 6 : 5;
    const lw = W / n;
    const bottom = H - 6;
    const tops: number[] = [];
    for (let i = 0; i < n; i++) {
      const w = lw * between(r, 0.82, 0.98);
      const x = i * lw + (lw - w) / 2;
      const top = between(r, 10, 170);
      tops.push(top);
      const broken = variant === 'b' && i === 2;
      if (broken) {
        c.save();
        c.translate(x + w / 2, bottom);
        c.rotate(-0.22);
        log(c, r, -w / 2, 330, 0, w, '#6b4a2c', false);
        c.restore();
      } else log(c, r, x, top, bottom, w, pickCol(r, ['#6b4a2c', '#5e4026', '#735030']));
    }
    rope(c, r, 0, W, H * 0.34, 20);
    rope(c, r, 0, W, H * 0.74, 22);
    // Mose og jord nederst
    speckle(c, r, 0, H - 70, W, 64, ['#3e4a1e', '#56602a', '#2e2412', '#4a3a22'], 900, 5, 0.55);
    if (variant === 'a') {
      // To piler som sitter fast
      for (const [ax, ay, a] of [[0.3, 0.52, -0.4], [0.66, 0.44, -0.25]] as const) arrow(c, W * ax, H * ay, a);
    } else {
      // Hodeskalle spikret på midtstokken og en fillete skinnfell på en spiss
      skull(c, W * 0.7, H * 0.5, 44);
      c.save();
      c.fillStyle = '#7a6448';
      c.beginPath();
      c.moveTo(W * 0.08, tops[0] + 40);
      c.bezierCurveTo(W * 0.02, H * 0.3, W * 0.05, H * 0.45, W * 0.12, H * 0.5);
      c.lineTo(W * 0.2, H * 0.42);
      c.bezierCurveTo(W * 0.23, H * 0.3, W * 0.19, tops[0] + 60, W * 0.14, tops[0] + 36);
      c.closePath();
      c.fill();
      speckle(c, r, W * 0.03, tops[0] + 40, W * 0.18, H * 0.4, ['#5a4632', '#9a8262', '#4a3a26'], 300, 4, 0.5);
      c.restore();
    }
  }, 'palisade' + variant);
}
function pickCol(r: Rng, cols: string[]) {
  return cols[Math.floor(r() * cols.length)];
}

function arrow(c: Ctx, x: number, y: number, a: number) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = '#3a2a1a';
  c.fillRect(-70, -2.5, 72, 5);
  c.fillStyle = '#d8d0c0';
  c.beginPath();
  c.moveTo(-70, -2);
  c.lineTo(-92, -12);
  c.lineTo(-86, 0);
  c.lineTo(-92, 12);
  c.lineTo(-70, 2);
  c.fill();
  c.restore();
}

function skull(c: Ctx, x: number, y: number, s: number) {
  c.save();
  const g = c.createRadialGradient(x - s * 0.25, y - s * 0.35, s * 0.1, x, y, s * 1.1);
  g.addColorStop(0, '#f4ecd6');
  g.addColorStop(0.6, '#cfc2a0');
  g.addColorStop(1, '#8a7c5e');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y - s * 0.15, s * 0.8, s * 0.85, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(x, y + s * 0.55, s * 0.5, s * 0.35, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#2a2016';
  for (const dx of [-0.32, 0.32]) {
    c.beginPath();
    c.ellipse(x + dx * s, y + s * 0.05, s * 0.22, s * 0.26, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.moveTo(x, y + s * 0.25);
  c.lineTo(x - s * 0.1, y + s * 0.45);
  c.lineTo(x + s * 0.1, y + s * 0.45);
  c.fill();
  c.fillStyle = 'rgba(40,30,20,0.7)';
  for (let i = -2; i <= 2; i++) c.fillRect(x + i * s * 0.14 - s * 0.03, y + s * 0.62, s * 0.06, s * 0.16);
  c.restore();
}

// ---------------------------------------------------------------- telt
export function paintTent(col: string, open: boolean) {
  const W = 700, H = 600;
  return canvas(W, H, (c, r) => {
    const apex = [W * 0.5, 70] as const;
    const left = [W * 0.08, H - 12] as const, right = [W * 0.92, H - 12] as const;
    // Bardunene bak teltet
    c.strokeStyle = 'rgba(70,60,40,0.9)';
    c.lineWidth = 3;
    for (const [px, py] of [[W * 0.01, H - 8], [W * 0.99, H - 8]] as const) {
      c.beginPath();
      c.moveTo(apex[0], apex[1] + 30);
      c.lineTo(px, py);
      c.stroke();
    }
    // Duken: litt buet mellom stengene
    c.save();
    c.beginPath();
    c.moveTo(apex[0], apex[1]);
    c.quadraticCurveTo(W * 0.24, H * 0.5, left[0], left[1]);
    c.lineTo(right[0], right[1]);
    c.quadraticCurveTo(W * 0.76, H * 0.5, apex[0], apex[1]);
    c.closePath();
    c.clip();
    const g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, shade(col, -0.45));
    g.addColorStop(0.35, shade(col, 0.12));
    g.addColorStop(0.6, col);
    g.addColorStop(1, shade(col, -0.5));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // Sømmer som går mot toppen, og lapper
    c.strokeStyle = shade(col, -0.35);
    c.lineWidth = 3;
    for (let k = 1; k < 6; k++) {
      c.beginPath();
      c.moveTo(apex[0], apex[1]);
      c.lineTo(left[0] + (right[0] - left[0]) * (k / 6), H);
      c.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const px = between(r, W * 0.25, W * 0.7), py = between(r, H * 0.35, H * 0.8), s = between(r, 30, 60);
      c.fillStyle = shade(col, between(r, -0.25, 0.15));
      c.fillRect(px, py, s, s * 0.8);
      c.strokeStyle = 'rgba(30,20,10,0.45)';
      c.setLineDash([4, 5]);
      c.strokeRect(px, py, s, s * 0.8);
      c.setLineDash([]);
    }
    speckle(c, r, 0, 0, W, H, [shade(col, -0.4), shade(col, 0.2), '#5a4a32'], 2600, 3, 0.25);
    // Inngangen: mørk trekant, eller en lukket flik
    c.fillStyle = open ? '#140c08' : shade(col, -0.25);
    c.beginPath();
    c.moveTo(W * 0.5, H * 0.38);
    c.lineTo(W * 0.38, H);
    c.lineTo(W * 0.62, H);
    c.closePath();
    c.fill();
    if (open) {
      c.fillStyle = shade(col, -0.1);
      c.beginPath();
      c.moveTo(W * 0.5, H * 0.38);
      c.lineTo(W * 0.62, H);
      c.lineTo(W * 0.74, H * 0.86);
      c.closePath();
      c.fill();
    }
    // Gjørme langs kanten nederst
    const mg = c.createLinearGradient(0, H - 90, 0, H);
    mg.addColorStop(0, 'rgba(60,45,25,0)');
    mg.addColorStop(1, 'rgba(60,45,25,0.8)');
    c.fillStyle = mg;
    c.fillRect(0, H - 90, W, 90);
    c.restore();
    // Stanga som stikker opp
    c.fillStyle = '#5a3e24';
    c.fillRect(apex[0] - 7, 0, 14, 90);
    c.fillStyle = '#7a5a3a';
    c.fillRect(apex[0] - 7, 0, 5, 90);
  }, 'tent' + col + open);
}

// ---------------------------------------------------------------- skilt og stolper
export function paintSignpost() {
  const W = 380, H = 700;
  return canvas(W, H, (c, r) => {
    log(c, r, 40, 30, H - 4, 58, '#6a4a2e', false);
    // Tverrslå og krok
    c.save();
    const g = c.createLinearGradient(0, 60, 0, 96);
    g.addColorStop(0, '#8a6a46');
    g.addColorStop(1, '#4a3220');
    c.fillStyle = g;
    c.fillRect(70, 62, W - 90, 34);
    speckle(c, r, 70, 62, W - 90, 34, ['#3a2614', '#9a7a52'], 220, 3, 0.4);
    c.strokeStyle = '#3a3a3e';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(W - 44, 96);
    c.lineTo(W - 44, 118);
    c.arc(W - 36, 118, 8, Math.PI, Math.PI * 2.2, true);
    c.stroke();
    c.restore();
  }, 'signpost');
}

export function paintSign() {
  const W = 300, H = 300;
  return canvas(W, H, (c, r) => {
    // To kjettinger som møtes i en ring øverst
    c.strokeStyle = '#4a4a50';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(W / 2, 12, 9, 0, Math.PI * 2);
    c.stroke();
    for (const ex of [W * 0.12, W * 0.88]) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const x0 = W / 2 + (ex - W / 2) * t0, y0 = 20 + (110 - 20) * t0;
        const x1 = W / 2 + (ex - W / 2) * t1, y1 = 20 + (110 - 20) * t1;
        c.beginPath();
        c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, 7, 4, Math.atan2(y1 - y0, x1 - x0), 0, Math.PI * 2);
        c.stroke();
      }
    }
    // Brettet: tre planker, slitt og tomt (teksten kan legges på i spillet)
    for (let k = 0; k < 3; k++) {
      const y = 110 + k * 58;
      const g = c.createLinearGradient(0, y, 0, y + 56);
      g.addColorStop(0, '#9a7650');
      g.addColorStop(1, '#5e4228');
      c.fillStyle = g;
      c.fillRect(8 + between(r, -3, 3), y, W - 16, 55);
      speckle(c, r, 8, y, W - 16, 55, ['#4a3220', '#b09068', '#3a2614'], 260, 3, 0.35);
    }
    c.fillStyle = '#2e2e32';
    for (const [x, y] of [[W * 0.12, 124], [W * 0.88, 124], [W * 0.12, 270], [W * 0.88, 270]]) {
      c.beginPath();
      c.arc(x, y, 5, 0, Math.PI * 2);
      c.fill();
    }
  }, 'sign');
}

/** Lykt: jernramme og glødende glass. Brukes på stolpen ved veien. */
function lantern(c: Ctx, x: number, y: number, s: number) {
  c.save();
  const glow = c.createRadialGradient(x, y + s * 0.55, 2, x, y + s * 0.55, s * 1.4);
  glow.addColorStop(0, 'rgba(255,220,140,0.55)');
  glow.addColorStop(1, 'rgba(255,160,60,0)');
  c.fillStyle = glow;
  c.fillRect(x - s * 1.5, y - s * 0.9, s * 3, s * 3);
  const gg = c.createLinearGradient(x - s * 0.4, 0, x + s * 0.4, 0);
  gg.addColorStop(0, '#ffcf6a');
  gg.addColorStop(0.5, '#fff2c0');
  gg.addColorStop(1, '#ffb040');
  c.fillStyle = gg;
  c.fillRect(x - s * 0.36, y + s * 0.15, s * 0.72, s * 0.8);
  c.fillStyle = '#2a2a2e';
  c.fillRect(x - s * 0.46, y + s * 0.05, s * 0.92, s * 0.12);
  c.fillRect(x - s * 0.46, y + s * 0.95, s * 0.92, s * 0.14);
  for (const dx of [-0.44, -0.02, 0.4]) c.fillRect(x + dx * s, y + s * 0.1, s * 0.06, s * 0.9);
  c.beginPath();
  c.moveTo(x - s * 0.5, y + s * 0.07);
  c.lineTo(x, y - s * 0.35);
  c.lineTo(x + s * 0.5, y + s * 0.07);
  c.fill();
  c.restore();
}

export function paintRoadpost() {
  const W = 380, H = 720;
  return canvas(W, H, (c, r) => {
    log(c, r, 30, 40, H - 4, 84, '#5e4228', false);
    // Tau kveilet rundt stolpen
    for (let k = 0; k < 4; k++) rope(c, r, 26, 118, H * 0.58 + k * 16, 12);
    // Revet oppslag
    c.save();
    c.fillStyle = '#d8ccae';
    c.translate(72, H * 0.38);
    c.rotate(0.06);
    c.fillRect(-26, -34, 52, 66);
    c.fillStyle = 'rgba(80,60,40,0.5)';
    for (let i = 0; i < 5; i++) c.fillRect(-18, -24 + i * 11, between(r, 20, 36), 3);
    c.restore();
    // Arm med krok og lykt
    c.fillStyle = '#3a3a3e';
    c.fillRect(100, 92, 190, 10);
    c.fillRect(270, 100, 6, 36);
    lantern(c, 273, 136, 64);
  }, 'roadpost');
}

export function paintSkullpike() {
  const W = 220, H = 760;
  return canvas(W, H, (c, r) => {
    log(c, r, W / 2 - 18, 120, H - 4, 36, '#5a3a20', true);
    // Filler og fjær under hodeskallen
    c.fillStyle = '#5a4a3a';
    c.beginPath();
    c.moveTo(W / 2 - 20, 200);
    c.lineTo(W / 2 - 50, 330);
    c.lineTo(W / 2 - 20, 300);
    c.lineTo(W / 2, 360);
    c.lineTo(W / 2 + 10, 290);
    c.lineTo(W / 2 + 40, 320);
    c.lineTo(W / 2 + 20, 200);
    c.fill();
    c.fillStyle = '#141418';
    for (const a of [-0.5, 0.3]) {
      c.save();
      c.translate(W / 2 + a * 40, 230);
      c.rotate(a);
      c.beginPath();
      c.ellipse(0, 40, 7, 42, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    skull(c, W / 2, 110, 64);
    speckle(c, r, W / 2 - 60, 60, 120, 120, ['#7a6a4a', '#5a4a30'], 120, 3, 0.35);
  }, 'skullpike');
}

// ---------------------------------------------------------------- forgrunn
export function paintFrontOak() {
  const W = 1024, H = 2048;
  return canvas(W, H, (c, r) => {
    const cx = W * 0.46;
    // Stamme med røtter som sprer seg nederst og to store grener øverst
    c.save();
    c.beginPath();
    c.moveTo(cx - 190, H);
    c.bezierCurveTo(cx - 160, H - 180, cx - 140, H - 300, cx - 150, H - 520);
    c.bezierCurveTo(cx - 160, H - 900, cx - 120, H - 1300, cx - 150, H - 1560);
    c.bezierCurveTo(cx - 260, H - 1720, cx - 420, H - 1850, cx - 560, H - 1990);
    c.lineTo(cx - 470, H - 2048);
    c.bezierCurveTo(cx - 330, H - 1900, cx - 170, H - 1780, cx - 40, H - 1700);
    c.bezierCurveTo(cx + 60, H - 1840, cx + 240, H - 1960, cx + 360, H - 2048);
    c.lineTo(cx + 470, H - 1990);
    c.bezierCurveTo(cx + 320, H - 1860, cx + 170, H - 1700, cx + 150, H - 1540);
    c.bezierCurveTo(cx + 130, H - 1250, cx + 160, H - 800, cx + 150, H - 520);
    c.bezierCurveTo(cx + 150, H - 300, cx + 170, H - 170, cx + 230, H);
    c.closePath();
    c.clip();
    const g = c.createLinearGradient(cx - 250, 0, cx + 250, 0);
    g.addColorStop(0, '#2a1e14');
    g.addColorStop(0.35, '#6a5440');
    g.addColorStop(0.55, '#54402e');
    g.addColorStop(1, '#1e150e');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // Dype barkfurer og mose
    c.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const x = cx + between(r, -230, 230), y = between(r, 0, H);
      c.strokeStyle = r() < 0.75 ? 'rgba(20,14,8,0.55)' : 'rgba(150,130,100,0.35)';
      c.lineWidth = between(r, 2, 7);
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x + between(r, -8, 8), y + 40, x + between(r, -8, 8), y + 90, x + between(r, -6, 6), y + between(r, 80, 220));
      c.stroke();
    }
    speckle(c, r, cx - 240, H - 900, 480, 860, ['#3e5a22', '#56702e', '#2e4418'], 2400, 7, 0.45);
    c.restore();
    // Løv i toppen (høstfarger), klaser som går ut av bildet
    for (let i = 0; i < 70; i++) {
      const x = between(r, 0, W), y = between(r, 0, 420);
      const s = between(r, 30, 90);
      const lg = c.createRadialGradient(x - s * 0.3, y - s * 0.3, 2, x, y, s);
      const col = pickCol(r, ['#b0501a', '#c87a24', '#8a3a14', '#d8a040', '#6a2a10']);
      lg.addColorStop(0, shade(col, 0.25));
      lg.addColorStop(1, shade(col, -0.35));
      c.fillStyle = lg;
      c.beginPath();
      c.ellipse(x, y, s, s * 0.7, between(r, 0, 3), 0, Math.PI * 2);
      c.fill();
    }
  }, 'frontoak');
}

export function paintBush() {
  const W = 1024, H = 640;
  return canvas(W, H, (c, r) => {
    c.lineCap = 'round';
    // Mørke stengler bak, lyse strå foran
    for (let pass = 0; pass < 2; pass++) {
      const n = pass ? 520 : 220;
      for (let i = 0; i < n; i++) {
        const x = between(r, 40, W - 40);
        const h = between(r, 0.35, 1) * (H - 30) * (1 - Math.abs(x - W / 2) / W);
        const lean = between(r, -0.35, 0.35);
        c.strokeStyle = pass ? pickCol(r, ['#c8a24a', '#a8883a', '#d8b860', '#8a7a3a']) : pickCol(r, ['#3a2a1a', '#4a3620', '#2e3a1a']);
        c.globalAlpha = pass ? between(r, 0.6, 1) : 0.9;
        c.lineWidth = pass ? between(r, 2, 4) : between(r, 4, 8);
        c.beginPath();
        c.moveTo(x, H);
        c.quadraticCurveTo(x + lean * h * 0.4, H - h * 0.6, x + lean * h, H - h);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    // Noen tistler
    for (let i = 0; i < 5; i++) {
      const x = between(r, 120, W - 120), y = between(r, 60, 260);
      c.fillStyle = '#7a4a8a';
      c.beginPath();
      c.ellipse(x, y, 16, 20, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#4a5a2a';
      c.beginPath();
      c.ellipse(x, y + 20, 14, 12, 0, 0, Math.PI * 2);
      c.fill();
    }
  }, 'bush');
}

export function paintCart() {
  const W = 1024, H = 640;
  return canvas(W, H, (c, r) => {
    // Hjul som står lent mot vogna
    wheel(c, r, W * 0.82, H * 0.62, 150, 0.2);
    // Vognkassa (planker) på skrå fordi ett hjul er borte
    c.save();
    c.translate(W * 0.45, H * 0.5);
    c.rotate(0.12);
    for (let k = 0; k < 4; k++) {
      const g = c.createLinearGradient(0, -120 + k * 50, 0, -120 + k * 50 + 48);
      g.addColorStop(0, '#8a6644');
      g.addColorStop(1, '#4e3620');
      c.fillStyle = g;
      c.fillRect(-360, -120 + k * 50, 720, 47);
      speckle(c, r, -360, -120 + k * 50, 720, 47, ['#3a2614', '#a0805a'], 500, 3, 0.35);
    }
    c.fillStyle = '#2e2e32';
    for (const x of [-340, -120, 120, 340]) c.fillRect(x - 6, -120, 12, 200);
    c.restore();
    // Hjulet som står på
    wheel(c, r, W * 0.24, H * 0.8, 120, 0);
    // Sekker og en sprukket tønne
    for (const [x, y, s] of [[W * 0.42, H * 0.3, 90], [W * 0.56, H * 0.26, 80], [W * 0.5, H * 0.16, 70]] as const) {
      const g = c.createRadialGradient(x - s * 0.3, y - s * 0.3, 4, x, y, s);
      g.addColorStop(0, '#d8c498');
      g.addColorStop(1, '#8a7650');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, s, s * 0.7, 0.2, 0, Math.PI * 2);
      c.fill();
    }
  }, 'cart');
}

function wheel(c: Ctx, r: Rng, x: number, y: number, rad: number, tilt: number) {
  c.save();
  c.translate(x, y);
  c.scale(1 - tilt, 1);
  c.strokeStyle = '#3a3a3e';
  c.lineWidth = 14;
  c.beginPath();
  c.arc(0, 0, rad, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = '#6a4a2c';
  c.lineWidth = 22;
  c.beginPath();
  c.arc(0, 0, rad - 16, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 12;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + between(r, -0.05, 0.05);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * (rad - 20), Math.sin(a) * (rad - 20));
    c.stroke();
  }
  c.fillStyle = '#4a3220';
  c.beginPath();
  c.arc(0, 0, 22, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ---------------------------------------------------------------- bildeserier
/** Krigsbanner som vaier: n ruter i et rutenett (kolonner x rader), stanga på samme sted i hver rute. */
export function paintBannerSheet(cloth: string, n = 8, cols = 4) {
  const fw = 220, fh = 560, rows = Math.ceil(n / cols);
  return canvas(fw * cols, fh * rows, (c, r) => {
    const emblemSeed = r();
    for (let i = 0; i < n; i++) {
      const ox = (i % cols) * fw, oy = Math.floor(i / cols) * fh;
      const ph = (i / n) * Math.PI * 2;
      c.save();
      c.translate(ox, oy);
      // Stang og tverrslå
      c.fillStyle = '#4a3220';
      c.fillRect(24, 10, 14, fh - 12);
      c.fillStyle = '#6a4a2e';
      c.fillRect(24, 10, 5, fh - 12);
      c.fillStyle = '#3a2a18';
      c.fillRect(24, 40, fw - 34, 10);
      // Duken henger fra tverrslåa og bølger mer jo lenger ned
      const x0 = 44, x1 = fw - 14, top = 50, bot = 400;
      const wave = (t: number, x: number) => Math.sin(ph + t * 4 + x * 0.02) * 14 * t;
      c.beginPath();
      c.moveTo(x0, top);
      c.lineTo(x1, top);
      for (let t = 0; t <= 1.001; t += 0.1) c.lineTo(x1 + wave(t, x1), top + (bot - top) * t);
      // Fillete kant nederst
      for (let k = 0; k <= 6; k++) {
        const x = x1 - (x1 - x0) * (k / 6);
        c.lineTo(x + wave(1, x), bot + (k % 2 ? 26 : -10) + Math.sin(ph + k) * 6);
      }
      for (let t = 1; t >= -0.001; t -= 0.1) c.lineTo(x0 + wave(t, x0), top + (bot - top) * t);
      c.closePath();
      const g = c.createLinearGradient(x0, 0, x1, 0);
      const light = 0.5 + 0.5 * Math.sin(ph);
      g.addColorStop(0, shade(cloth, -0.4));
      g.addColorStop(light * 0.8 + 0.1, shade(cloth, 0.18));
      g.addColorStop(1, shade(cloth, -0.5));
      c.fillStyle = g;
      c.fill();
      // Hornet hodeskalle midt på
      const ex = (x0 + x1) / 2 + wave(0.45, (x0 + x1) / 2), ey = top + (bot - top) * 0.42;
      c.fillStyle = '#e8dcc0';
      c.beginPath();
      c.ellipse(ex, ey, 34, 38, 0, 0, Math.PI * 2);
      c.fill();
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(ex + s * 26, ey - 22);
        c.quadraticCurveTo(ex + s * 70, ey - 40 - emblemSeed * 10, ex + s * 58, ey - 78);
        c.quadraticCurveTo(ex + s * 52, ey - 44, ex + s * 16, ey - 34);
        c.fill();
      }
      c.fillStyle = shade(cloth, -0.55);
      for (const s of [-1, 1]) {
        c.beginPath();
        c.ellipse(ex + s * 13, ey + 2, 9, 11, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }, 'banner' + cloth);
}

/** Kråke som flakser: fire ruter på rad. */
export function paintCrowSheet() {
  const fw = 160, fh = 120, n = 4;
  return canvas(fw * n, fh, (c) => {
    for (let i = 0; i < n; i++) {
      const ox = i * fw;
      const up = [0.9, 0.3, -0.5, 0.3][i];
      c.save();
      c.translate(ox + fw / 2, fh * 0.6);
      const body = c.createLinearGradient(0, -20, 0, 20);
      body.addColorStop(0, '#2a2a34');
      body.addColorStop(1, '#0c0c10');
      c.fillStyle = body;
      c.beginPath();
      c.ellipse(0, 0, 34, 16, -0.1, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(34, -10, 13, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a3226';
      c.beginPath();
      c.moveTo(44, -12);
      c.lineTo(62, -6);
      c.lineTo(44, -4);
      c.fill();
      c.fillStyle = '#0c0c10';
      c.beginPath();
      c.moveTo(-30, -2);
      c.lineTo(-58, -12);
      c.lineTo(-54, 6);
      c.fill();
      // Vingen
      c.fillStyle = '#16161e';
      c.beginPath();
      c.moveTo(-8, -6);
      c.quadraticCurveTo(-10, -46 * up, -40, -52 * up);
      c.quadraticCurveTo(-4, -30 * up, 16, -4);
      c.fill();
      c.fillStyle = '#d8b040';
      c.fillRect(37, -13, 3, 3);
      c.restore();
    }
  }, 'crow');
}

/** Fakkel på stang med flamme i fire ruter. */
export function paintTorchSheet() {
  const fw = 120, fh = 420, n = 4;
  return canvas(fw * n, fh, (c, r) => {
    for (let i = 0; i < n; i++) {
      const ox = i * fw;
      c.save();
      c.translate(ox, 0);
      log(c, r, fw / 2 - 11, 150, fh - 2, 22, '#4a3220', false);
      c.fillStyle = '#2e2e32';
      c.fillRect(fw / 2 - 18, 140, 36, 22);
      const fl = [1, 0.85, 1.1, 0.92][i];
      const sway = [0, 6, -5, 3][i];
      const g = c.createRadialGradient(fw / 2 + sway * 0.5, 110, 4, fw / 2, 100, 70 * fl);
      g.addColorStop(0, 'rgba(255,250,220,1)');
      g.addColorStop(0.3, 'rgba(255,200,80,0.95)');
      g.addColorStop(0.7, 'rgba(255,90,20,0.8)');
      g.addColorStop(1, 'rgba(160,30,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(fw / 2 - 26, 145);
      c.quadraticCurveTo(fw / 2 - 30, 90, fw / 2 + sway, 140 - 120 * fl);
      c.quadraticCurveTo(fw / 2 + 30, 90, fw / 2 + 26, 145);
      c.closePath();
      c.fill();
      c.restore();
    }
  }, 'torch');
}
