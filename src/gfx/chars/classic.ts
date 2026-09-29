// De opprinnelige figurene: to helter, fire fiender, duell-mesteren og imp-vaktmesteren.
import { INK, shade, blobPath, polyPath, rrectPath } from '../draw';
import { HERO_J, HERO_BIG_J, HERO_HIP_Y, TORSO_Y, skinD, type CharDef } from './types';
import { maleChest, muscleArm, muscleLeg, tinyLoins, scalePart, stretchY } from './muscle';
import { buildHeroDef, PRESETS } from './hero';

// ---------------------------------------------------------------- THRUGG og VALKYRA
// Presetene bygges med heltebyggeren, så de har samme proporsjoner som alle andre helter.
// Id-ene 'thrugg' og 'valkyra' brukes også som navn på PNG-grafikk (se docs/ART_PROMPTS.md).
const thrugg: CharDef = { ...buildHeroDef(PRESETS.thrugg, 0), id: 'thrugg', name: 'THRUGG', inherit: undefined, color: '#c0392b' };
const valkyra: CharDef = { ...buildHeroDef(PRESETS.valkyra, 1), id: 'valkyra', name: 'VALKYRA', inherit: undefined, color: '#2e6fd0' };

// ---------------------------------------------------------------- SKELETON
const SK = { bone: '#efe8d2', boneD: '#c9bf9f', rust: '#8a5a32', rag: '#5f6b4a', blade: '#b07a45' };
const skeleton: CharDef = {
  id: 'skeleton', name: 'SKELLY GRUNT', scale: 0.86, hipY: 0.84, joints: { ...HERO_J, shF: [0.1, 0.64], shB: [-0.08, 0.66], neck: [0.0, 0.76], hand: [0, -0.6] },
  blood: 'bone', voice: 'skeleton', color: '#b8b09a',
  leg: {
    w: 0.46, h: 1.0, ox: 0.16, oy: 0.9,
    draw: (p) => {
      p.limbs([[[0, 0, 0.02, -0.4], 0.05], [[0.02, -0.4, 0, -0.74], 0.045]], SK.bone);
      p.ell(0.02, -0.4, 0.065, 0.06, SK.bone);
      p.limbs([[[-0.05, -0.8, 0.22, -0.82], 0.045]], SK.bone);
      p.ell(-0.02, -0.78, 0.07, 0.06, SK.bone);
    },
  },
  arm: {
    w: 0.34, h: 0.9, ox: 0.17, oy: 0.76,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.3], 0.045], [[0, -0.3, 0, -0.55], 0.04]], SK.bone);
      p.ell(0, -0.3, 0.055, 0.05, SK.bone);
      p.ell(0, -0.61, 0.075, 0.07, SK.bone);
      p.line([0.02, -0.6, 0.08, -0.63], 0.016);
      p.ell(0, 0, 0.07, 0.07, SK.bone);
    },
  },
  pelvis: {
    w: 0.6, h: 0.6, ox: 0.3, oy: 0.42,
    draw: (p) => {
      p.poly([-0.2, 0.04, 0.22, 0.04, 0.2, -0.3, 0.12, -0.2, 0.06, -0.34, -0.02, -0.22, -0.1, -0.32, -0.2, -0.2], SK.rag);
      p.blob([-0.18, 0.12, 0.18, 0.12, 0.15, -0.06, 0, -0.14, -0.15, -0.06], SK.bone);
      p.ell(-0.07, 0.0, 0.04, 0.04, INK, false);
      p.ell(0.08, 0.0, 0.04, 0.04, INK, false);
    },
  },
  torso: {
    w: 0.74, h: 1.0, ox: 0.34, oy: 0.1,
    draw: (p) => {
      p.limbs([[[0, 0, -0.05, 0.4, 0, 0.8], 0.045]], SK.bone);
      for (let i = 0; i < 4; i++) {
        const y = 0.66 - i * 0.1;
        const r = 0.26 - i * 0.02;
        p.limbs([[[-0.03, y, r - 0.04, y + 0.01, r, y - 0.06, r - 0.1, y - 0.1], 0.024]], SK.bone);
        p.limbs([[[-0.05, y, -0.18 + i * 0.01, y - 0.04], 0.02]], SK.boneD);
      }
      p.limbs([[[-0.16, 0.72, 0.2, 0.74], 0.03]], SK.bone);
      p.limbs([[[0.12, 0.66, 0.1, 0.32], 0.03]], SK.bone);
    },
  },
  head: {
    w: 0.96, h: 1.1, ox: 0.44, oy: 0.14,
    draw: (p) => {
      const skull = (c: CanvasRenderingContext2D) => blobPath(c, [-0.26, 0.2, -0.28, 0.5, -0.04, 0.72, 0.27, 0.62, 0.37, 0.38, 0.31, 0.14, 0.1, 0.08, -0.12, 0.08]);
      p.shaded(skull, SK.bone, SK.boneD, (c) => c.rect(-0.4, 0.0, 0.25, 0.8));
      p.ell(0.13, 0.36, 0.085, 0.095, INK, false);
      p.ell(0.3, 0.36, 0.06, 0.085, INK, false);
      p.ell(0.14, 0.35, 0.025, 0.025, '#ff3b2f', false);
      p.ell(0.3, 0.35, 0.02, 0.02, '#ff3b2f', false);
      p.poly([0.3, 0.24, 0.35, 0.18, 0.26, 0.18], INK, false);
      p.rrect(0.02, -0.06, 0.33, 0.13, 0.04, SK.bone);
      for (const x of [0.08, 0.14, 0.2, 0.26, 0.32]) p.line([x, 0.07, x, 0.12], 0.014);
      for (const x of [0.1, 0.17, 0.24, 0.3]) p.line([x, -0.05, x, 0.03], 0.012);
      p.line([-0.1, 0.62, -0.02, 0.5, -0.08, 0.44], 0.015);
      const helm = (c: CanvasRenderingContext2D) => blobPath(c, [-0.32, 0.46, -0.22, 0.74, 0.06, 0.82, 0.32, 0.7, 0.36, 0.52, 0.0, 0.52]);
      p.shaded(helm, SK.rust, shade(SK.rust, -0.3), (c) => c.rect(-0.4, 0.4, 0.3, 0.5));
      p.ell(0.1, 0.72, 0.03, 0.03, shade(SK.rust, -0.4), false);
      p.poly([-0.1, 0.8, -0.04, 0.72, 0.02, 0.8], shade(SK.rust, -0.35), false);
    },
  },
  weapon: {
    w: 0.36, h: 1.4, ox: 0.18, oy: 0.28,
    draw: (p) => {
      p.rrect(-0.04, -0.2, 0.08, 0.3, 0.02, '#4a3020');
      p.shaded((c) => polyPath(c, [-0.065, 0.12, 0.065, 0.12, 0.055, 0.9, 0, 1.04, -0.055, 0.9]), SK.blade, shade(SK.blade, -0.3), (c) => c.rect(0, 0, 0.2, 1.2));
      for (const y of [0.4, 0.64]) p.poly([0.065, y, 0.02, y + 0.04, 0.062, y + 0.08], INK, false);
      p.ell(0.0, 0.5, 0.025, 0.035, '#6b3a1c', false);
      p.rrect(-0.15, 0.08, 0.3, 0.07, 0.02, '#5a5a5a');
    },
  },
};

// ---------------------------------------------------------------- HOGMAN
const HG = { green: '#7d9b45', belly: '#b7c67c', snout: '#e59aa0', tusk: '#fff6de', iron: '#6f757c', leather: '#5b3a1e', cloth: '#6b5a3a', wood: '#8b5a2b' };
const hogman: CharDef = {
  id: 'hogman', name: 'HOGMAN', skin: [HG.green, HG.belly, HG.snout], scale: 1.12, hipY: 0.74,
  joints: { hipF: [0.1, 0], hipB: [-0.1, 0], neck: [0.1, 0.8], shF: [0.2, 0.66], shB: [-0.2, 0.68], hand: [0, -0.6] },
  blood: 'red', voice: 'pig', color: '#7d9b45',
  leg: {
    w: 0.62, h: 0.9, ox: 0.26, oy: 0.8,
    draw: (p) => {
      p.limbs([[[0, 0, 0.02, -0.32], 0.17], [[0.02, -0.32, 0, -0.52], 0.15]], HG.green);
      p.blob([-0.18, -0.5, 0.18, -0.48, 0.3, -0.74, -0.18, -0.76], HG.leather);
      p.poly([0.22, -0.76, 0.3, -0.66, 0.34, -0.76], '#2a1c10');
    },
  },
  arm: {
    w: 0.56, h: 0.96, ox: 0.28, oy: 0.78,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.3], 0.145], [[0, -0.3, 0, -0.5], 0.13]], HG.green);
      p.rrect(-0.15, -0.54, 0.3, 0.2, 0.05, HG.iron);
      for (const y of [-0.5, -0.4]) p.poly([0.15, y, 0.24, y + 0.03, 0.15, y + 0.06], '#ddd');
      p.ell(0, -0.63, 0.15, 0.13, HG.green);
      p.line([0.04, -0.58, 0.14, -0.62], 0.02);
      p.ell(0, -0.02, 0.16, 0.14, HG.green);
    },
  },
  pelvis: {
    w: 0.96, h: 0.74, ox: 0.48, oy: 0.52,
    draw: (p) => {
      p.poly([-0.36, 0.06, 0.38, 0.06, 0.34, -0.36, 0.14, -0.28, 0.02, -0.4, -0.16, -0.28, -0.36, -0.34], HG.cloth);
      p.line([-0.1, -0.02, -0.14, -0.26], 0.02, shade(HG.cloth, -0.3));
      p.line([0.2, -0.02, 0.22, -0.24], 0.02, shade(HG.cloth, -0.3));
      p.rrect(-0.4, 0.0, 0.8, 0.15, 0.05, HG.leather);
      p.ell(0.2, 0.07, 0.1, 0.09, SK.bone);
      p.ell(0.17, 0.08, 0.025, 0.025, INK, false);
      p.ell(0.24, 0.08, 0.025, 0.025, INK, false);
    },
  },
  torso: {
    w: 1.12, h: 1.12, ox: 0.54, oy: 0.12,
    draw: (p) => {
      const body = (c: CanvasRenderingContext2D) => blobPath(c, [-0.3, 0.0, 0.3, 0.0, 0.5, 0.24, 0.52, 0.52, 0.36, 0.78, 0.08, 0.88, -0.24, 0.86, -0.42, 0.68, -0.44, 0.36, -0.36, 0.14]);
      p.shaded(body, HG.green, shade(HG.green, -0.25), (c) => c.rect(-0.55, -0.1, 0.34, 1.0));
      p.shape((c) => c.ellipse(0.2, 0.3, 0.28, 0.26, 0, 0, Math.PI * 2), HG.belly, false);
      p.ell(0.3, 0.24, 0.03, 0.02, shade(HG.belly, -0.4), false);
      p.poly([-0.38, 0.66, -0.26, 0.76, 0.36, 0.1, 0.24, 0.02], HG.leather);
      const pad = (c: CanvasRenderingContext2D) => blobPath(c, [-0.46, 0.62, -0.4, 0.9, -0.1, 0.96, 0.04, 0.8, -0.16, 0.62]);
      p.shaded(pad, HG.iron, shade(HG.iron, -0.3), (c) => c.rect(-0.6, 0.5, 0.25, 0.6));
      for (const x of [-0.34, -0.2, -0.06]) p.poly([x - 0.04, 0.88, x, 1.02, x + 0.04, 0.88], '#ddd');
    },
  },
  head: {
    w: 1.2, h: 1.2, ox: 0.54, oy: 0.12,
    draw: (p) => {
      p.poly([-0.16, 0.54, -0.46, 0.74, -0.1, 0.7], shade(HG.green, 0.1));
      const head = (c: CanvasRenderingContext2D) => blobPath(c, [-0.28, 0.1, -0.32, 0.44, -0.14, 0.66, 0.2, 0.66, 0.42, 0.46, 0.44, 0.2, 0.26, 0.0, -0.06, -0.02]);
      p.shaded(head, HG.green, shade(HG.green, -0.25), (c) => c.rect(-0.4, -0.1, 0.25, 0.9));
      p.poly([0.26, 0.08, 0.31, 0.3, 0.37, 0.1], HG.tusk);
      p.shape((c) => c.ellipse(0.47, 0.28, 0.13, 0.11, 0, 0, Math.PI * 2), HG.snout);
      p.ell(0.44, 0.28, 0.025, 0.035, INK, false);
      p.ell(0.52, 0.28, 0.025, 0.035, INK, false);
      p.line([0.1, 0.5, 0.36, 0.42], 0.06);
      p.ell(0.26, 0.4, 0.045, 0.04, '#ffe14a');
      p.ell(0.27, 0.395, 0.018, 0.02, INK, false);
      p.line([0.14, 0.12, 0.32, 0.1], 0.025);
      const cap = (c: CanvasRenderingContext2D) => blobPath(c, [-0.26, 0.5, -0.16, 0.74, 0.1, 0.8, 0.3, 0.66, 0.2, 0.54]);
      p.shaded(cap, HG.iron, shade(HG.iron, -0.3), (c) => c.rect(-0.4, 0.4, 0.3, 0.5));
      p.poly([0.0, 0.78, 0.04, 1.0, 0.1, 0.78], '#ddd');
    },
  },
  weapon: {
    w: 0.46, h: 1.54, ox: 0.23, oy: 0.3,
    draw: (p) => {
      p.poly([-0.05, -0.22, 0.05, -0.22, 0.13, 1.0, 0.0, 1.14, -0.13, 1.0], HG.wood);
      p.line([-0.02, 0.1, 0.02, 0.9], 0.02, shade(HG.wood, -0.3));
      p.rrect(-0.08, 0.3, 0.16, 0.08, 0.02, HG.iron);
      for (const [x, y, d] of [[0.12, 0.8, 1], [0.1, 0.55, 1], [-0.11, 0.7, -1], [-0.09, 0.95, -1], [0.1, 1.05, 1]] as const) {
        p.poly([x, y - 0.04, x + d * 0.12, y, x, y + 0.04], '#d8d8d8');
      }
    },
  },
};

// ---------------------------------------------------------------- CULTIST
const CU = { robe: '#4b2470', robeL: '#6d3aa0', trim: '#d4a63a', skin: '#c9c2b0', eye: '#ffe34a', dark: '#2c2536' };
const cultist: CharDef = {
  id: 'cultist', name: 'CULTIST', skin: [CU.skin], scale: 0.9, hipY: 0.82, joints: { ...HERO_J, shF: [0.12, 0.64], shB: [-0.12, 0.66] },
  blood: 'red', voice: 'cultist', color: '#6d3aa0',
  leg: {
    w: 0.5, h: 0.98, ox: 0.18, oy: 0.88,
    draw: (p) => {
      p.limbs([[[0, 0, 0.02, -0.4], 0.09], [[0.02, -0.4, 0, -0.72], 0.08]], CU.dark);
      p.poly([-0.1, -0.7, 0.1, -0.7, 0.3, -0.84, -0.1, -0.84], '#15101c');
    },
  },
  arm: {
    w: 0.52, h: 0.9, ox: 0.24, oy: 0.76,
    draw: (p) => {
      p.ell(0.02, -0.6, 0.08, 0.08, CU.skin);
      const sl = (c: CanvasRenderingContext2D) => polyPath(c, [-0.12, 0.06, 0.12, 0.06, 0.22, -0.48, -0.18, -0.52]);
      p.shaded(sl, CU.robe, shade(CU.robe, -0.3), (c) => c.rect(-0.3, -0.6, 0.14, 0.7));
      p.poly([-0.18, -0.52, 0.22, -0.48, 0.21, -0.42, -0.17, -0.46], CU.trim);
    },
  },
  pelvis: {
    w: 1.0, h: 0.94, ox: 0.5, oy: 0.2,
    draw: (p) => {
      const sk = (c: CanvasRenderingContext2D) => polyPath(c, [-0.3, 0.1, 0.3, 0.1, 0.44, -0.62, 0.2, -0.58, 0.0, -0.66, -0.22, -0.6, -0.44, -0.64]);
      p.shaded(sk, CU.robe, shade(CU.robe, -0.3), (c) => c.rect(-0.5, -0.7, 0.32, 0.9));
      p.line([-0.42, -0.6, -0.2, -0.56, 0.0, -0.62, 0.2, -0.54, 0.42, -0.58], 0.03, CU.trim);
      p.line([0.08, 0.0, 0.14, -0.5], 0.02, shade(CU.robe, -0.4));
      p.line([-0.12, 0.0, -0.16, -0.5], 0.02, shade(CU.robe, -0.4));
      p.rrect(-0.32, 0.02, 0.64, 0.09, 0.03, '#2a1a10');
      for (const x of [-0.2, 0.0, 0.2]) p.ell(x, 0.06, 0.05, 0.05, SK.bone);
    },
  },
  torso: {
    w: 0.9, h: 1.0, ox: 0.44, oy: 0.1,
    draw: (p) => {
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.24, 0.0, 0.24, 0.0, 0.3, 0.34, 0.29, 0.66, 0.1, 0.8, -0.14, 0.8, -0.31, 0.66, -0.33, 0.3]);
      p.shaded(b, CU.robe, shade(CU.robe, -0.3), (c) => c.rect(-0.5, -0.1, 0.3, 1.0));
      p.poly([-0.06, 0.8, 0.08, 0.52, 0.2, 0.8], CU.robeL);
      p.ell(0.1, 0.34, 0.08, 0.08, CU.trim, true);
      p.ell(0.1, 0.34, 0.035, 0.05, CU.robe, false);
    },
  },
  head: {
    w: 1.0, h: 1.16, ox: 0.48, oy: 0.12,
    draw: (p) => {
      const hood = (c: CanvasRenderingContext2D) => blobPath(c, [-0.36, 0.0, -0.38, 0.4, -0.3, 0.8, -0.1, 0.96, 0.18, 0.8, 0.4, 0.58, 0.42, 0.26, 0.34, 0.0]);
      p.shaded(hood, CU.robe, shade(CU.robe, -0.35), (c) => c.rect(-0.5, -0.1, 0.3, 1.1));
      p.ell(0.18, 0.32, 0.19, 0.25, '#120a18');
      p.ell(0.12, 0.37, 0.05, 0.028, CU.eye, false);
      p.ell(0.27, 0.37, 0.04, 0.026, CU.eye, false);
      p.shape((c) => c.ellipse(0.2, 0.37, 0.16, 0.06, 0, 0, Math.PI * 2), 'rgba(255,220,60,0.12)', false);
    },
  },
  weapon: {
    w: 0.4, h: 0.9, ox: 0.16, oy: 0.2,
    draw: (p) => {
      p.rrect(-0.035, -0.16, 0.07, 0.24, 0.02, '#3a2414');
      p.shape((c) => { c.moveTo(-0.05, 0.08); c.lineTo(0.05, 0.08); c.quadraticCurveTo(0.2, 0.4, 0.06, 0.66); c.quadraticCurveTo(0.06, 0.36, -0.05, 0.08); c.closePath(); }, '#d6dde6');
      p.rrect(-0.1, 0.06, 0.2, 0.05, 0.02, CU.trim);
    },
  },
};

// ---------------------------------------------------------------- GNOME
const GN = { coat: '#2f5fb3', hat: '#c62b2b', skin: '#f0b48e', beard: '#f4f4f4', pants: '#6b4a2b', shoe: '#3b2414', sack: '#a88a55' };
const gnome: CharDef = {
  id: 'gnome', name: 'POTION GNOME', skin: [GN.skin], scale: 0.62, hipY: 0.46,
  joints: { hipF: [0.06, 0], hipB: [-0.06, 0], neck: [0.02, 0.5], shF: [0.12, 0.42], shB: [-0.12, 0.42], hand: [0, -0.38] },
  blood: 'red', voice: 'gnome', color: '#c62b2b',
  leg: {
    w: 0.6, h: 0.6, ox: 0.2, oy: 0.52,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.28], 0.1]], GN.pants);
      p.shape((c) => { c.moveTo(-0.14, -0.3); c.lineTo(0.14, -0.3); c.quadraticCurveTo(0.36, -0.32, 0.36, -0.22); c.quadraticCurveTo(0.34, -0.44, 0.1, -0.46); c.lineTo(-0.14, -0.46); c.closePath(); }, GN.shoe);
    },
  },
  arm: {
    w: 0.36, h: 0.56, ox: 0.18, oy: 0.46,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.3], 0.085]], GN.coat);
      p.ell(0, -0.38, 0.075, 0.075, GN.skin);
    },
  },
  pelvis: {
    w: 0.6, h: 0.4, ox: 0.3, oy: 0.26,
    draw: (p) => {
      p.blob([-0.2, 0.08, 0.2, 0.08, 0.2, -0.14, -0.2, -0.14], GN.pants);
    },
  },
  torso: {
    w: 1.1, h: 0.86, ox: 0.66, oy: 0.1,
    draw: (p) => {
      const sack = (c: CanvasRenderingContext2D) => blobPath(c, [-0.2, 0.1, -0.56, 0.2, -0.6, 0.56, -0.36, 0.76, -0.12, 0.6]);
      p.shaded(sack, GN.sack, shade(GN.sack, -0.3), (c) => c.rect(-0.7, 0.0, 0.25, 0.9));
      p.ell(-0.32, 0.72, 0.1, 0.05, shade(GN.sack, -0.2));
      p.ell(-0.44, 0.6, 0.05, 0.07, '#3fa0ff');
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.2, 0.0, 0.2, 0.0, 0.26, 0.24, 0.2, 0.5, -0.18, 0.5, -0.24, 0.24]);
      p.shaded(b, GN.coat, shade(GN.coat, -0.3), (c) => c.rect(-0.4, -0.1, 0.18, 0.7));
      p.rrect(-0.22, 0.06, 0.46, 0.08, 0.03, '#3b2414');
      p.rrect(0.04, 0.06, 0.08, 0.08, 0.01, '#e8b83a');
    },
  },
  head: {
    w: 1.1, h: 1.8, ox: 0.5, oy: 0.36,
    draw: (p) => {
      const hat = (c: CanvasRenderingContext2D) => { c.moveTo(-0.34, 0.5); c.quadraticCurveTo(-0.1, 1.0, -0.44, 1.4); c.quadraticCurveTo(0.1, 1.2, 0.36, 0.5); c.closePath(); };
      p.shaded(hat, GN.hat, shade(GN.hat, -0.3), (c) => c.rect(-0.6, 0.4, 0.4, 1.2));
      p.ell(0.04, 0.38, 0.3, 0.26, GN.skin);
      p.blob([-0.24, 0.34, -0.2, -0.06, 0.06, -0.3, 0.3, -0.1, 0.38, 0.26, 0.12, 0.2], GN.beard);
      p.ell(0.1, 0.44, 0.03, 0.035, INK, false);
      p.ell(0.24, 0.44, 0.025, 0.03, INK, false);
      p.ell(0.3, 0.32, 0.12, 0.1, '#f59a8a');
      p.ell(0.0, 0.34, 0.05, 0.03, 'rgba(255,90,90,0.4)', false);
      p.rrect(-0.38, 0.46, 0.76, 0.1, 0.05, shade(GN.hat, -0.2));
    },
  },
};

// ---------------------------------------------------------------- GORTHAK
const GK = { armor: '#2c2c36', armorL: '#4a4a5a', trim: '#b3141c', horn: '#e8dcc0', eye: '#ff2a1a', gold: '#d9a933', wood: '#3a2616', steel: '#8e98a4' };
const GK_SKIN = '#c08a62';
const gorthak: CharDef = {
  id: 'gorthak', name: 'GORTHAK', scale: 1.08, hipY: HERO_HIP_Y, joints: { ...HERO_BIG_J, neck: [0.02, 0.8 * TORSO_Y] },
  blood: 'red', voice: 'brute', color: '#8a0e14', skin: [GK_SKIN],
  leg: muscleLeg(GK_SKIN, skinD(GK_SKIN), 1.1, 'darkgreaves', GK.armor),
  arm: muscleArm(GK_SKIN, skinD(GK_SKIN), 1.6, 'spikes', GK.armor, GK.trim),
  pelvis: tinyLoins('dark', GK.trim, '#2c2c36'),
  torso: stretchY({
    w: 1.34, h: 1.06, ox: 0.67, oy: 0.1,
    draw: (p) => {
      maleChest(p, GK_SKIN, skinD(GK_SKIN), false);
      // Arr fra tidligere tirsdager
      p.line([0.06, 0.62, 0.3, 0.4], 0.02, '#8a3a2a');
      p.line([-0.3, 0.3, -0.1, 0.18], 0.02, '#8a3a2a');
      // Svart kryssele med hodeskalle
      p.poly([-0.52, 0.7, -0.42, 0.8, 0.4, 0.12, 0.28, 0.02], GK.armor);
      p.poly([0.5, 0.7, 0.4, 0.8, -0.36, 0.12, -0.24, 0.02], GK.armor);
      p.line([-0.47, 0.72, 0.33, 0.07], 0.018, GK.trim);
      p.ell(0.02, 0.4, 0.12, 0.11, SK.bone);
      p.ell(-0.02, 0.42, 0.032, 0.032, INK, false);
      p.ell(0.07, 0.42, 0.032, 0.032, INK, false);
      p.line([0.0, 0.35, 0.05, 0.35], 0.015);
      // Skulderplate med pigger på bakre skulder
      const pad = (c: CanvasRenderingContext2D) => blobPath(c, [-0.66, 0.6, -0.6, 0.94, -0.2, 1.0, -0.08, 0.82, -0.3, 0.6]);
      p.shaded(pad, GK.armorL, GK.armor, (c) => c.rect(-0.7, 0.5, 0.25, 0.6));
      for (const x of [-0.5, -0.34, -0.2]) p.poly([x - 0.045, 0.93, x, 1.1, x + 0.045, 0.93], '#cfcfcf');
    },
  }, TORSO_Y),
  head: scalePart({
    w: 1.5, h: 1.3, ox: 0.74, oy: 0.14,
    draw: (p) => {
      p.shape((c) => { c.moveTo(-0.22, 0.58); c.quadraticCurveTo(-0.72, 0.62, -0.68, 1.1); c.quadraticCurveTo(-0.52, 0.8, -0.12, 0.74); c.closePath(); }, GK.horn);
      const h = (c: CanvasRenderingContext2D) => blobPath(c, [-0.3, 0.0, -0.34, 0.4, -0.22, 0.72, 0.1, 0.8, 0.36, 0.66, 0.42, 0.36, 0.38, 0.0]);
      p.shaded(h, GK.armorL, GK.armor, (c) => c.rect(-0.5, -0.1, 0.4, 1.0));
      p.rrect(0.04, 0.38, 0.4, 0.1, 0.02, '#0a0608');
      p.rrect(0.22, 0.1, 0.07, 0.34, 0.02, '#0a0608');
      p.ell(0.14, 0.43, 0.04, 0.025, GK.eye, false);
      p.ell(0.34, 0.43, 0.035, 0.022, GK.eye, false);
      p.shape((c) => c.ellipse(0.24, 0.43, 0.2, 0.06, 0, 0, Math.PI * 2), 'rgba(255,40,20,0.25)', false);
      for (const [x, y] of [[0.36, 0.2], [0.36, 0.28], [0.12, 0.22], [0.12, 0.3]]) p.ell(x, y, 0.015, 0.015, INK, false);
      p.line([-0.28, 0.6, 0.0, 0.76, 0.36, 0.64], 0.035, GK.trim);
      p.shape((c) => { c.moveTo(0.26, 0.64); c.quadraticCurveTo(0.8, 0.7, 0.72, 1.14); c.quadraticCurveTo(0.6, 0.86, 0.14, 0.78); c.closePath(); }, GK.horn);
    },
  }, 0.92),
  weapon: {
    w: 1.3, h: 2.3, ox: 0.65, oy: 0.44,
    draw: (p) => {
      p.rrect(-0.05, -0.42, 0.1, 2.1, 0.03, GK.wood);
      for (const y of [-0.3, -0.18, -0.06]) p.line([-0.05, y, 0.05, y + 0.05], 0.02, GK.trim);
      const blade = (s: number) => (c: CanvasRenderingContext2D) => {
        c.moveTo(0.05 * s, 1.18); c.lineTo(0.36 * s, 1.02); c.quadraticCurveTo(0.66 * s, 1.36, 0.38 * s, 1.72); c.lineTo(0.05 * s, 1.54); c.closePath();
      };
      p.shaded(blade(1), GK.steel, shade(GK.steel, -0.35), (c) => c.rect(0, 1.0, 0.25, 0.8));
      p.shaded(blade(-1), GK.steel, shade(GK.steel, -0.35), (c) => c.rect(-0.25, 1.0, 0.25, 0.8));
      p.shape((c) => { c.ellipse(0.46, 1.3, 0.06, 0.1, 0.3, 0, Math.PI * 2); }, 'rgba(140,10,10,0.8)', false);
      p.shape((c) => { c.ellipse(-0.4, 1.46, 0.05, 0.08, -0.4, 0, Math.PI * 2); }, 'rgba(140,10,10,0.8)', false);
      p.rrect(-0.09, 1.14, 0.18, 0.44, 0.04, GK.armorL);
      p.poly([-0.05, 1.64, 0, 1.86, 0.05, 1.64], '#cfcfcf');
    },
  },
};

// ---------------------------------------------------------------- CLEANUP IMP
const IM = { skin: '#6fae3e', overall: '#556b8f', cap: '#3a4f7a', eye: '#ffe14a', mop: '#cfc8b6', stick: '#9a6a38' };
const imp: CharDef = {
  id: 'imp', name: 'CLEANUP IMP', skin: [IM.skin], scale: 0.72, hipY: 0.5,
  joints: { hipF: [0.06, 0], hipB: [-0.06, 0], neck: [0.02, 0.54], shF: [0.12, 0.44], shB: [-0.12, 0.44], hand: [0, -0.4] },
  blood: 'green', voice: 'imp', color: '#6fae3e',
  leg: {
    w: 0.56, h: 0.64, ox: 0.2, oy: 0.56,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.34], 0.07]], IM.skin);
      p.blob([-0.1, -0.36, 0.1, -0.34, 0.32, -0.46, -0.1, -0.5], IM.skin);
      for (const x of [0.2, 0.28]) p.line([x, -0.44, x + 0.04, -0.48], 0.02, '#fff');
    },
  },
  arm: {
    w: 0.36, h: 0.6, ox: 0.18, oy: 0.48,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.32], 0.06]], IM.skin);
      p.ell(0, -0.4, 0.075, 0.07, IM.skin);
    },
  },
  pelvis: {
    w: 0.6, h: 0.44, ox: 0.3, oy: 0.3,
    draw: (p) => p.blob([-0.2, 0.1, 0.2, 0.1, 0.22, -0.16, -0.22, -0.16], IM.overall),
  },
  torso: {
    w: 0.7, h: 0.8, ox: 0.35, oy: 0.1,
    draw: (p) => {
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.2, 0.0, 0.2, 0.0, 0.24, 0.3, 0.16, 0.56, -0.16, 0.56, -0.24, 0.3]);
      p.shaded(b, IM.skin, shade(IM.skin, -0.25), (c) => c.rect(-0.3, -0.1, 0.15, 0.7));
      p.shape((c) => rrectPath(c, -0.2, 0.0, 0.4, 0.38, 0.05), IM.overall);
      p.line([-0.14, 0.36, -0.12, 0.54], 0.04, IM.overall);
      p.line([0.14, 0.36, 0.12, 0.54], 0.04, IM.overall);
      p.rrect(-0.06, 0.12, 0.14, 0.12, 0.02, shade(IM.overall, -0.2));
    },
  },
  head: {
    w: 1.4, h: 1.06, ox: 0.7, oy: 0.12,
    draw: (p) => {
      p.poly([-0.2, 0.44, -0.66, 0.66, -0.24, 0.3], IM.skin);
      p.poly([0.2, 0.46, 0.64, 0.7, 0.26, 0.3], IM.skin);
      const h = (c: CanvasRenderingContext2D) => blobPath(c, [-0.28, 0.16, -0.28, 0.5, 0.0, 0.66, 0.3, 0.5, 0.34, 0.16, 0.0, -0.04]);
      p.shaded(h, IM.skin, shade(IM.skin, -0.25), (c) => c.rect(-0.4, -0.1, 0.2, 0.8));
      p.ell(0.06, 0.36, 0.07, 0.07, IM.eye);
      p.ell(0.22, 0.36, 0.06, 0.06, IM.eye);
      p.ell(0.08, 0.35, 0.025, 0.035, INK, false);
      p.ell(0.23, 0.35, 0.02, 0.03, INK, false);
      p.shape((c) => { c.moveTo(-0.04, 0.16); c.quadraticCurveTo(0.16, 0.0, 0.34, 0.18); c.closePath(); }, '#fff');
      p.line([0.06, 0.13, 0.06, 0.08], 0.012);
      p.line([0.16, 0.1, 0.16, 0.05], 0.012);
      p.line([0.26, 0.13, 0.26, 0.08], 0.012);
      const cap = (c: CanvasRenderingContext2D) => blobPath(c, [-0.28, 0.46, -0.2, 0.72, 0.1, 0.78, 0.3, 0.6, 0.2, 0.48]);
      p.shaded(cap, IM.cap, shade(IM.cap, -0.3), (c) => c.rect(-0.4, 0.4, 0.2, 0.5));
      p.poly([0.16, 0.52, 0.5, 0.5, 0.46, 0.58, 0.14, 0.6], shade(IM.cap, -0.15));
    },
  },
  weapon: {
    w: 0.7, h: 1.9, ox: 0.35, oy: 0.3,
    draw: (p) => {
      p.rrect(-0.035, -0.2, 0.07, 1.36, 0.02, IM.stick);
      p.rrect(-0.12, 1.1, 0.24, 0.1, 0.03, '#777');
      p.blob([-0.2, 1.2, 0.2, 1.2, 0.3, 1.5, 0.1, 1.56, -0.1, 1.56, -0.3, 1.5], IM.mop);
      for (const x of [-0.18, -0.06, 0.06, 0.18]) p.line([x, 1.24, x * 1.3, 1.52], 0.02, shade(IM.mop, -0.25));
      p.ell(0.1, 1.44, 0.07, 0.05, 'rgba(170,20,20,0.7)', false);
      p.ell(-0.12, 1.34, 0.05, 0.04, 'rgba(170,20,20,0.6)', false);
    },
  },
};

export const CLASSIC: CharDef[] = [thrugg, valkyra, skeleton, hogman, cultist, gnome, gorthak, imp];
export { SK, HG };
