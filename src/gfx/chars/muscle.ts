// Overdrevne 80-talls barbarkropper: enorme armer, brede skuldre, korte bein og altfor lite tøy.
// Brukes av heltebyggeren og av muskelbunter som Gorthak. Alt tegnes i enhetsrom med pivot i leddet.
import { Pen, INK, shade, blobPath, rrectPath } from '../draw';
import type { PartDef } from './types';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export const MAT = {
  leather: '#5a3519', leatherL: '#7a4a26', fur: '#7a4b28', furL: '#a8723f', steel: '#a9b3bd', silver: '#c8d0da',
  gold: '#e8b83a', bone: '#efe8d2', chain: '#8e98a4', vest: '#a0683a',
};

/** Skaler en del rundt leddet (store hoder). Konturstreken holdes like tykk som på resten av figuren. */
export function scalePart(d: PartDef, s: number): PartDef {
  return {
    w: d.w * s, h: d.h * s, ox: d.ox * s, oy: d.oy * s,
    draw: (p) => {
      const lw = p.lw;
      p.c.save();
      p.c.scale(s, s);
      p.lw = lw / s;
      d.draw(p);
      p.lw = lw;
      p.c.restore();
    },
  };
}

const thin = (p: Pen, path: (c: C) => void, fill: string | null, lw = 0.018) => p.shape(path, fill, true, lw);

// ---------------------------------------------------------------- overkropp (mann)
export const maleTorsoPath = (c: C) => blobPath(c, [-0.22, -0.02, 0.22, -0.02, 0.31, 0.16, 0.53, 0.4, 0.58, 0.64, 0.3, 0.8, 0.16, 0.92, -0.14, 0.92, -0.3, 0.8, -0.6, 0.64, -0.56, 0.36, -0.33, 0.14]);

/** Bar, altfor muskuløs overkropp: store bryst, sekspakk, og en tynn lærreim for syns skyld. */
export function maleChest(p: Pen, skin: string, sd: string, harness = true) {
  const body = maleTorsoPath;
  p.shaded(body, skin, sd, (c) => c.rect(-0.62, -0.1, 0.38, 1.0));
  p.clipTo(body, () => {
    // Trapes-muskler og skygge under brystene
    p.shape((c) => { c.moveTo(-0.34, 0.36); c.quadraticCurveTo(-0.12, 0.27, 0.07, 0.34); c.quadraticCurveTo(0.28, 0.25, 0.52, 0.34); c.lineTo(0.52, 0.4); c.lineTo(-0.34, 0.4); c.closePath(); }, 'rgba(70,25,10,0.28)', false);
    thin(p, (c) => c.ellipse(-0.13, 0.49, 0.2, 0.145, 0.12, 0, TAU), skin, 0.03);
    thin(p, (c) => c.ellipse(0.25, 0.48, 0.245, 0.165, -0.12, 0, TAU), skin, 0.03);
    p.shape((c) => c.ellipse(0.32, 0.54, 0.08, 0.04, -0.3, 0, TAU), 'rgba(255,255,255,0.3)', false);
    // Sekspakk
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 2; k++) thin(p, (c) => rrectPath(c, 0.0 + k * 0.14, 0.04 + r * 0.095, 0.12, 0.078, 0.034), shade(skin, 0.05), 0.016);
    p.line([0.13, 0.33, 0.13, 0.03], 0.014, sd);
    // Skrå magemuskler
    p.shape((c) => { c.moveTo(0.31, 0.31); c.quadraticCurveTo(0.35, 0.16, 0.28, 0.03); }, null, true, 0.016);
  });
  p.shape(body, null);
  // Trapes og nakke
  p.shape((c) => { c.moveTo(-0.2, 0.8); c.quadraticCurveTo(0.02, 0.72, 0.26, 0.8); }, null, true, 0.016);
  if (harness) {
    p.poly([-0.5, 0.7, -0.4, 0.79, 0.38, 0.12, 0.27, 0.03], MAT.leather);
    p.ell(-0.07, 0.42, 0.05, 0.05, MAT.steel);
    p.ell(0.18, 0.2, 0.045, 0.045, MAT.steel);
  }
}

// ---------------------------------------------------------------- overkropp (dame)
export const femTorsoPath = (c: C) => blobPath(c, [-0.19, -0.02, 0.19, -0.02, 0.25, 0.16, 0.45, 0.4, 0.48, 0.62, 0.24, 0.78, 0.13, 0.9, -0.11, 0.9, -0.24, 0.78, -0.49, 0.62, -0.47, 0.38, -0.26, 0.14]);

export type TopKind = 'fur' | 'leather' | 'chain' | 'plate';

/** Veltrent mage og en overdimensjonert "rustning" over brystet, slik 80-tallsomslagene ville ha det. */
export function femChest(p: Pen, skin: string, sd: string, top: TopKind, cloth: string, corset = false) {
  const body = femTorsoPath;
  p.shaded(body, skin, sd, (c) => c.rect(-0.62, -0.1, 0.36, 1.0));
  p.clipTo(body, () => {
    p.line([0.1, 0.26, 0.1, 0.05], 0.016, sd);
    p.line([0.02, 0.17, 0.19, 0.17], 0.014, sd);
    p.line([0.03, 0.09, 0.18, 0.09], 0.014, sd);
    if (corset) {
      p.shape((c) => rrectPath(c, -0.5, -0.1, 1.0, 0.44, 0.02), MAT.vest, false);
      for (let y = 0.02; y < 0.32; y += 0.07) p.line([0.04, y, 0.2, y + 0.04], 0.018, MAT.gold);
      p.line([0.12, 0.02, 0.12, 0.33], 0.02, INK);
    }
  });
  p.shape(body, null);
  const mat = top === 'fur' ? MAT.fur : top === 'leather' ? MAT.leather : top === 'chain' ? MAT.chain : MAT.silver;
  const dark = shade(mat, -0.3);
  const bB = (c: C) => c.ellipse(-0.04, 0.46, 0.19, 0.18, 0, 0, TAU);
  const bF = (c: C) => c.ellipse(0.25, 0.45, 0.215, 0.2, 0, 0, TAU);
  // Stropper over skuldrene
  p.limbs([[[0.24, 0.6, 0.14, 0.76], 0.024], [[-0.06, 0.6, -0.17, 0.74], 0.024]], top === 'plate' ? MAT.leather : mat);
  p.shaded(bB, mat, dark, (c) => c.rect(-0.35, 0.26, 0.13, 0.42));
  p.shaded(bF, mat, dark, (c) => c.rect(0.0, 0.24, 0.1, 0.44));
  if (top === 'chain') {
    for (const [cx, cy, r] of [[-0.04, 0.46, 0.18], [0.25, 0.45, 0.2]] as const)
      p.clipTo((c) => c.ellipse(cx, cy, r, r, 0, 0, TAU), () => {
        let row = 0;
        for (let y = cy - r; y < cy + r; y += 0.05, row++)
          for (let x = cx - r; x < cx + r; x += 0.06) p.shape((c) => c.arc(x + (row % 2 ? 0.03 : 0), y, 0.026, Math.PI, 0), null, true, 0.01);
      });
  }
  if (top === 'fur') {
    p.fur(-0.2, 0.44, 0.28, 0.05, 9, MAT.furL, -1);
  }
  if (top === 'plate') {
    p.ell(0.25, 0.45, 0.055, 0.055, MAT.gold);
    p.ell(-0.04, 0.46, 0.045, 0.045, MAT.gold);
    // Magepanser under
    p.shape((c) => rrectPath(c, -0.2, 0.02, 0.44, 0.22, 0.05), MAT.steel);
    p.line([-0.18, 0.13, 0.22, 0.13], 0.016, shade(MAT.steel, -0.35));
  }
  // Glans
  p.shape((c) => c.ellipse(0.31, 0.52, 0.07, 0.045, -0.5, 0, TAU), 'rgba(255,255,255,0.45)', false);
  p.shape((c) => c.ellipse(0.01, 0.52, 0.045, 0.032, -0.5, 0, TAU), 'rgba(255,255,255,0.3)', false);
  // Bånd under
  p.limbs([[[-0.18, 0.28, 0.42, 0.27], 0.026]], top === 'plate' ? MAT.gold : mat);
  void cloth;
}

// ---------------------------------------------------------------- armer
export type Shoulder = 'skin' | 'fur' | 'leather' | 'chain' | 'plate' | 'spikes';

/** Enorme armer: biceps som grapefrukt, Popeye-underarmer og knyttnever på størrelse med hodet til en gnom. */
export function muscleArm(skin: string, sd: string, m: number, shoulder: Shoulder, bracer: string, cloth: string): PartDef {
  return {
    w: 0.92, h: 1.0, ox: 0.44, oy: 0.76,
    draw: (p) => {
      p.shaded((c) => c.ellipse(-0.07, -0.13, 0.1 * m, 0.105 * m, 0.25, 0, TAU), skin, sd, (c) => c.rect(-0.4, -0.4, 0.3, 0.6));
      p.limbs([[[0, 0, 0.02, -0.25], 0.115 * m], [[0.02, -0.25, 0.03, -0.46], 0.092 * m]], skin);
      p.shaded((c) => c.ellipse(0.075, -0.13, 0.135 * m, 0.118 * m, -0.25, 0, TAU), skin, sd, (c) => c.rect(-0.3, -0.4, 0.3, 0.6));
      p.shape((c) => c.ellipse(0.12, -0.1, 0.045 * m, 0.03 * m, -0.4, 0, TAU), 'rgba(255,255,255,0.3)', false);
      p.shaded((c) => c.ellipse(0.045, -0.345, 0.122 * m, 0.1 * m, 0.1, 0, TAU), skin, sd, (c) => c.rect(-0.3, -0.6, 0.3, 0.5));
      // Blodåre (for mye trening)
      p.shape((c) => { c.moveTo(0.1, -0.06); c.quadraticCurveTo(0.14, -0.14, 0.09, -0.2); }, null, true, 0.012);
      const bw = 0.27 * m;
      p.rrect(0.035 - bw / 2, -0.49, bw, 0.1, 0.03, bracer);
      p.line([0.035 - bw / 2 + 0.02, -0.44, 0.035 + bw / 2 - 0.02, -0.44], 0.016, shade(bracer, -0.4));
      if (shoulder === 'spikes') for (const y of [-0.45, -0.41]) p.poly([0.035 + bw / 2, y - 0.02, 0.035 + bw / 2 + 0.09, y, 0.035 + bw / 2, y + 0.02], '#d8d8d8');
      p.ell(0.035, -0.555, 0.118 * m, 0.105 * m, skin);
      p.line([0.07, -0.5, 0.14, -0.53], 0.016);
      p.line([0.07, -0.56, 0.145, -0.58], 0.016);
      // Skulder
      switch (shoulder) {
        case 'plate':
          p.shaded((c) => c.ellipse(0.0, -0.01, 0.19 * m, 0.16 * m, 0, 0, TAU), MAT.silver, shade(MAT.silver, -0.3), (c) => c.rect(-0.3, -0.3, 0.2, 0.5));
          p.line([-0.16 * m, -0.07, 0.16 * m, -0.07], 0.022, cloth);
          p.ell(0.08, 0.04, 0.02, 0.02, INK, false);
          break;
        case 'fur':
          p.blob([-0.18, 0.06, -0.08, 0.14, 0.1, 0.13, 0.19, 0.02, 0.12, -0.12, -0.12, -0.12], MAT.fur);
          for (const [x, y] of [[-0.1, -0.06], [0.0, 0.0], [0.1, -0.05]]) p.line([x, y, x + 0.03, y - 0.06], 0.016, MAT.furL);
          break;
        case 'leather':
          p.shaded((c) => c.ellipse(0.0, -0.01, 0.17 * m, 0.14 * m, 0, 0, TAU), MAT.vest, MAT.leatherL, (c) => c.rect(-0.3, -0.3, 0.2, 0.5));
          p.line([-0.12, -0.04, 0.12, -0.06], 0.016, MAT.leather);
          break;
        case 'chain':
          p.shaded((c) => c.ellipse(0.0, -0.03, 0.165 * m, 0.15 * m, 0, 0, TAU), MAT.chain, shade(MAT.chain, -0.3), (c) => c.rect(-0.3, -0.3, 0.2, 0.5));
          for (let y = 0.04; y > -0.14; y -= 0.05) p.line([-0.12, y, 0.12, y], 0.01, shade(MAT.chain, -0.45));
          break;
        case 'spikes':
          p.shaded((c) => c.ellipse(0.0, -0.01, 0.19 * m, 0.16 * m, 0, 0, TAU), '#2c2c36', '#1a1a22', (c) => c.rect(-0.3, -0.3, 0.2, 0.5));
          for (const x of [-0.1, 0.0, 0.1]) p.poly([x - 0.035, 0.1, x, 0.26, x + 0.035, 0.1], '#d8d8d8');
          break;
        default:
          p.shaded((c) => c.ellipse(0.005, -0.02, 0.16 * m, 0.14 * m, 0, 0, TAU), skin, sd, (c) => c.rect(-0.3, -0.3, 0.18, 0.5));
          p.shape((c) => c.ellipse(0.06, 0.03, 0.05, 0.03, -0.3, 0, TAU), 'rgba(255,255,255,0.28)', false);
      }
    },
  };
}

// ---------------------------------------------------------------- bein
export type Footwear = 'fur' | 'leather' | 'greaves' | 'sandals' | 'darkgreaves';

/** Korte, tjukke bein med lår som trestammer. Foten slutter på y = -0.645 (se HERO_HIP_Y). */
export function muscleLeg(skin: string, sd: string, m: number, foot: Footwear, cloth: string): PartDef {
  return {
    w: 0.7, h: 0.82, ox: 0.3, oy: 0.7,
    draw: (p) => {
      const calf = (col: string, colD: string) => {
        p.limbs([[[0.03, -0.26, 0.02, -0.48], 0.105 * m]], col);
        p.shaded((c) => c.ellipse(-0.03, -0.35, 0.1 * m, 0.1 * m, 0.2, 0, TAU), col, colD, (c) => c.rect(-0.3, -0.6, 0.25, 0.5));
      };
      const thigh = (col: string, colD: string) => {
        p.limbs([[[0, 0, 0.03, -0.26], 0.14 * m]], col);
        p.shaded((c) => c.ellipse(0.06, -0.12, 0.125 * m, 0.14 * m, -0.1, 0, TAU), col, colD, (c) => c.rect(-0.3, -0.4, 0.27, 0.5));
        p.shape((c) => { c.moveTo(0.02, -0.02); c.quadraticCurveTo(0.12, -0.12, 0.06, -0.24); }, null, true, 0.012);
      };
      switch (foot) {
        case 'fur':
          calf(skin, sd);
          thigh(skin, sd);
          p.blob([-0.14, -0.33, 0.02, -0.3, 0.16, -0.33, 0.17, -0.55, 0.0, -0.58, -0.15, -0.55], MAT.fur);
          p.fur(-0.16, 0.18, -0.33, 0.06, 7, MAT.furL, 1);
          p.rrect(-0.14, -0.645, 0.44, 0.13, 0.06, MAT.leather);
          break;
        case 'leather':
          calf(shade(cloth, -0.35), shade(cloth, -0.5));
          thigh(skin, sd);
          p.blob([-0.14, -0.2, 0.14, -0.2, 0.16, -0.56, -0.15, -0.56], MAT.leatherL);
          p.line([-0.13, -0.25, 0.14, -0.25], 0.03, MAT.leather);
          p.rrect(-0.14, -0.645, 0.44, 0.13, 0.06, MAT.leather);
          break;
        case 'greaves':
        case 'darkgreaves': {
          const st = foot === 'greaves' ? MAT.steel : '#2c2c36';
          const stL = foot === 'greaves' ? MAT.silver : '#4a4a5a';
          calf(st, shade(st, -0.3));
          thigh(skin, sd);
          p.ell(0.05, -0.27, 0.095, 0.08, stL);
          p.rrect(-0.14, -0.645, 0.46, 0.16, 0.05, st);
          p.line([0.08, -0.63, 0.08, -0.5], 0.018, shade(st, -0.3));
          break;
        }
        case 'sandals':
          calf(skin, sd);
          thigh(skin, sd);
          p.limbs([[[0.02, -0.48, 0.02, -0.56], 0.08 * m]], skin);
          p.blob([-0.1, -0.54, 0.1, -0.54, 0.29, -0.59, 0.28, -0.63, -0.11, -0.63], skin);
          p.rrect(-0.13, -0.655, 0.45, 0.045, 0.02, MAT.leather);
          for (const y of [-0.38, -0.45, -0.52, -0.59]) p.line([-0.08, y, 0.1, y - 0.04], 0.018, MAT.leather);
          break;
      }
    },
  };
}

// ---------------------------------------------------------------- lendeklær
export type Loins = 'loincloth' | 'kilt' | 'skirt' | 'tassets' | 'dark';

/** Bittesmå lendeklær. Mest belte, litt pels, og en flik som gjør sitt beste. */
export function tinyLoins(kind: Loins, cloth: string, fur = MAT.fur): PartDef {
  return {
    w: 0.72, h: 0.5, ox: 0.36, oy: 0.33,
    draw: (p) => {
      const briefs = (c: C) => blobPath(c, [-0.25, 0.05, 0.25, 0.05, 0.23, -0.07, 0.1, -0.165, -0.06, -0.165, -0.22, -0.08]);
      p.shaded(briefs, kind === 'dark' ? '#2c2c36' : fur, shade(kind === 'dark' ? '#2c2c36' : fur, -0.25), (c) => c.rect(-0.4, -0.3, 0.24, 0.4));
      switch (kind) {
        case 'loincloth':
          p.poly([0.05, 0.03, 0.21, 0.03, 0.2, -0.2, 0.155, -0.16, 0.11, -0.22, 0.065, -0.16], fur);
          p.line([0.1, 0.0, 0.11, -0.12], 0.014, MAT.furL);
          p.line([0.16, 0.0, 0.17, -0.12], 0.014, MAT.furL);
          break;
        case 'kilt': {
          const k = (c: C) => rrectPath(c, -0.26, -0.13, 0.52, 0.17, 0.02);
          p.shaded(k, cloth, shade(cloth, -0.3), (c) => c.rect(-0.4, -0.2, 0.2, 0.3));
          p.clipTo(k, () => {
            for (let x = -0.24; x < 0.26; x += 0.07) p.line([x, 0.04, x + 0.01, -0.14], 0.014, shade(cloth, -0.35));
            p.line([-0.3, -0.05, 0.3, -0.05], 0.024, shade(cloth, 0.25));
          });
          p.shape(k, null);
          break;
        }
        case 'skirt':
          for (let i = 0; i < 5; i++) p.rrect(-0.24 + i * 0.1, -0.19, 0.075, 0.22, 0.025, i % 2 ? MAT.leatherL : MAT.leather);
          break;
        case 'tassets':
          p.rrect(0.02, -0.2, 0.2, 0.24, 0.03, MAT.steel);
          p.line([0.04, -0.17, 0.2, -0.17], 0.022, cloth);
          p.rrect(-0.24, -0.16, 0.18, 0.2, 0.03, shade(MAT.steel, -0.15));
          break;
        case 'dark':
          p.rrect(0.02, -0.2, 0.2, 0.24, 0.03, '#2c2c36');
          p.line([0.04, -0.17, 0.2, -0.17], 0.024, '#b3141c');
          break;
      }
      p.rrect(-0.28, -0.005, 0.56, 0.105, 0.03, MAT.leather);
      p.ell(0.14, 0.047, 0.07, 0.06, MAT.gold);
      p.ell(0.14, 0.047, 0.028, 0.024, shade(MAT.gold, -0.35), false);
    },
  };
}
