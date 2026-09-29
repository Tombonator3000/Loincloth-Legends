// Bosser: Big Mama Hogmother, King Croakus, Magmor the Molten og Vorthax selv.
import { INK, shade, blobPath, polyPath } from '../draw';
import { HERO_J, type CharDef } from './types';
import { CLASSIC, HG } from './classic';
import { frogLeg, frogArm, FR } from './wilds';

const hog = CLASSIC.find((c) => c.id === 'hogman')!;

// ---------------------------------------------------------------- BIG MAMA HOGMOTHER
const hogmother: CharDef = {
  ...hog,
  id: 'hogmother', name: 'BIG MAMA HOGMOTHER', scale: 1.8, voice: 'pig', color: '#c86a7a',
  inherit: { leg: 'hogman', arm: 'hogman', pelvis: 'hogman' },
  torso: {
    w: 1.16, h: 1.14, ox: 0.56, oy: 0.12,
    draw: (p) => {
      const body = (c: CanvasRenderingContext2D) => blobPath(c, [-0.32, 0.0, 0.32, 0.0, 0.52, 0.26, 0.54, 0.54, 0.38, 0.8, 0.08, 0.9, -0.26, 0.88, -0.44, 0.68, -0.46, 0.36, -0.38, 0.14]);
      p.shaded(body, HG.green, shade(HG.green, -0.25), (c) => c.rect(-0.6, -0.1, 0.35, 1.0));
      const apron = (c: CanvasRenderingContext2D) => polyPath(c, [-0.1, 0.66, 0.3, 0.66, 0.48, 0.0, -0.2, 0.0]);
      p.shape(apron, '#f1ece0');
      p.clipTo(apron, () => {
        for (const [x, y, r] of [[0.2, 0.3, 0.08], [0.02, 0.18, 0.05], [0.3, 0.5, 0.04], [0.1, 0.42, 0.03]]) p.ell(x, y, r, r * 0.8, 'rgba(150,10,20,0.85)', false);
      });
      p.line([-0.1, 0.66, -0.3, 0.84], 0.03, '#f1ece0');
      p.line([0.3, 0.66, 0.3, 0.84], 0.03, '#f1ece0');
      p.ell(0.16, 0.12, 0.12, 0.06, '#f1ece0');
    },
  },
  head: {
    w: 1.3, h: 1.3, ox: 0.6, oy: 0.12,
    draw: (p) => {
      p.poly([-0.16, 0.54, -0.46, 0.74, -0.1, 0.7], shade(HG.green, 0.1));
      const head = (c: CanvasRenderingContext2D) => blobPath(c, [-0.28, 0.1, -0.32, 0.44, -0.14, 0.66, 0.2, 0.66, 0.42, 0.46, 0.44, 0.2, 0.26, 0.0, -0.06, -0.02]);
      p.shaded(head, HG.green, shade(HG.green, -0.25), (c) => c.rect(-0.4, -0.1, 0.25, 0.9));
      p.shape((c) => c.ellipse(0.47, 0.28, 0.13, 0.11, 0, 0, Math.PI * 2), HG.snout);
      p.ell(0.44, 0.28, 0.025, 0.035, INK, false);
      p.ell(0.52, 0.28, 0.025, 0.035, INK, false);
      p.poly([0.26, 0.08, 0.31, 0.26, 0.37, 0.1], HG.tusk);
      p.ell(0.24, 0.42, 0.05, 0.045, '#fff');
      p.ell(0.25, 0.42, 0.02, 0.022, INK, false);
      for (let i = 0; i < 4; i++) p.line([0.2 + i * 0.03, 0.47, 0.19 + i * 0.035, 0.53], 0.012);
      p.shape((c) => { c.moveTo(0.12, 0.12); c.quadraticCurveTo(0.24, 0.06, 0.34, 0.12); }, null, true, 0.03);
      p.ell(0.28, 0.12, 0.06, 0.025, '#d8305a', false);
      for (const [x, y] of [[-0.18, 0.66], [0.0, 0.74], [0.18, 0.7], [-0.3, 0.5]]) {
        p.rrect(x - 0.07, y - 0.05, 0.14, 0.1, 0.05, '#ff8ab0');
        p.line([x - 0.05, y, x + 0.05, y], 0.012, '#c04070');
      }
      p.ell(-0.12, 0.26, 0.03, 0.03, '#e8b83a');
      p.line([-0.12, 0.24, -0.12, 0.14], 0.015, '#e8b83a');
      p.ell(-0.12, 0.12, 0.03, 0.03, '#e8b83a');
    },
  },
  weapon: {
    w: 0.9, h: 1.6, ox: 0.3, oy: 0.3,
    draw: (p) => {
      p.rrect(-0.05, -0.28, 0.1, 0.5, 0.03, '#5a3a20');
      for (const y of [-0.2, -0.08, 0.04]) p.ell(0, y, 0.02, 0.02, '#c8c8c8', false);
      p.shaded((c) => polyPath(c, [-0.08, 0.2, 0.5, 0.2, 0.56, 1.1, -0.08, 1.2]), '#d6dde6', '#9aa6b4', (c) => c.rect(0.25, 0, 0.4, 1.3));
      p.ell(0.36, 1.0, 0.05, 0.05, null);
      p.ell(0.36, 1.0, 0.05, 0.05, '#3a3a3a');
      p.ell(0.2, 0.6, 0.12, 0.08, 'rgba(150,10,20,0.8)', false);
      p.ell(0.44, 0.4, 0.06, 0.1, 'rgba(150,10,20,0.7)', false);
    },
  },
};

// ---------------------------------------------------------------- KING CROAKUS
const croakus: CharDef = {
  id: 'croakus', name: 'KING CROAKUS', scale: 2.0, hipY: 0.68,
  joints: { ...HERO_J, hipF: [0.12, 0], hipB: [-0.12, 0], neck: [0.1, 0.76], shF: [0.24, 0.62], shB: [-0.2, 0.64] },
  blood: 'red', voice: 'frog', color: '#3f7a2e',
  inherit: { arm: 'frogman' },
  leg: frogLeg(1.3),
  arm: frogArm(),
  pelvis: {
    w: 0.96, h: 0.6, ox: 0.48, oy: 0.4,
    draw: (p) => {
      p.poly([-0.36, 0.08, 0.38, 0.08, 0.3, -0.26, 0.1, -0.16, -0.08, -0.3, -0.34, -0.2], '#5b2a86');
      p.rrect(-0.38, 0.0, 0.76, 0.12, 0.04, '#e8b83a');
      p.ell(0.14, 0.06, 0.06, 0.06, '#c0202a');
    },
  },
  torso: {
    w: 1.4, h: 1.16, ox: 0.66, oy: 0.12,
    draw: (p) => {
      p.shape((c) => { c.moveTo(-0.3, 0.84); c.quadraticCurveTo(-0.7, 0.4, -0.62, -0.08); c.lineTo(-0.2, 0.0); c.closePath(); }, '#8e1b1b');
      p.fur(-0.62, -0.2, -0.06, 0.05, 7, '#f4f4f4', -1);
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.3, 0.0, 0.34, 0.0, 0.56, 0.26, 0.54, 0.56, 0.3, 0.8, -0.04, 0.84, -0.34, 0.72, -0.44, 0.4]);
      p.shaded(b, FR.skin, FR.skinD, (c) => c.rect(-0.6, -0.1, 0.34, 1.0));
      p.clipTo(b, () => {
        p.shape((c) => c.ellipse(0.24, 0.3, 0.3, 0.32, 0, 0, Math.PI * 2), FR.belly, false);
        p.ell(0.34, 0.26, 0.03, 0.02, shade(FR.belly, -0.4), false);
      });
      for (const [x, y] of [[-0.2, 0.56], [-0.3, 0.3], [0.0, 0.7]]) p.ell(x, y, 0.06, 0.045, FR.spot, false);
      p.shape(b, null);
      p.line([-0.3, 0.76, 0.2, 0.8], 0.05, '#e8b83a');
      p.ell(-0.04, 0.78, 0.05, 0.05, '#c0202a');
    },
  },
  head: {
    w: 1.2, h: 1.3, ox: 0.52, oy: 0.12,
    draw: (p) => {
      const h = (c: CanvasRenderingContext2D) => blobPath(c, [-0.3, 0.06, -0.34, 0.3, -0.14, 0.46, 0.2, 0.46, 0.5, 0.34, 0.52, 0.12, 0.32, -0.02, -0.06, -0.04]);
      p.shaded(h, FR.skin, FR.skinD, (c) => c.rect(-0.45, -0.1, 0.25, 0.7));
      p.ell(0.02, 0.5, 0.15, 0.14, FR.skin);
      p.ell(0.3, 0.5, 0.14, 0.13, FR.skin);
      p.ell(0.03, 0.52, 0.09, 0.09, FR.eye);
      p.ell(0.31, 0.52, 0.085, 0.085, FR.eye);
      p.rrect(0.0, 0.5, 0.08, 0.03, 0.01, INK, false);
      p.rrect(0.28, 0.5, 0.08, 0.03, 0.01, INK, false);
      p.shape((c) => { c.moveTo(-0.08, 0.55); c.lineTo(0.12, 0.6); c.lineTo(0.12, 0.64); c.lineTo(-0.08, 0.62); c.closePath(); }, FR.skin);
      p.shape((c) => { c.moveTo(0.2, 0.6); c.lineTo(0.42, 0.56); c.lineTo(0.42, 0.62); c.lineTo(0.2, 0.64); c.closePath(); }, FR.skin);
      p.shape((c) => { c.moveTo(-0.06, 0.12); c.quadraticCurveTo(0.26, 0.0, 0.52, 0.14); }, null, true, 0.035);
      p.shape((c) => polyPath(c, [-0.12, 0.6, 0.44, 0.6, 0.48, 0.92, 0.34, 0.76, 0.16, 0.96, -0.02, 0.76, -0.16, 0.92]), '#e8b83a');
      for (const x of [0.02, 0.16, 0.3]) p.ell(x, 0.68, 0.035, 0.035, '#c0202a', false);
    },
  },
  weapon: {
    w: 0.5, h: 1.8, ox: 0.25, oy: 0.34,
    draw: (p) => {
      p.rrect(-0.04, -0.32, 0.08, 1.42, 0.03, '#e8b83a');
      p.ell(0, 1.2, 0.14, 0.14, '#8a2ad8');
      p.ell(-0.04, 1.24, 0.04, 0.05, '#e0c0ff', false);
      p.rrect(-0.1, 1.04, 0.2, 0.06, 0.02, '#e8b83a');
    },
  },
};

// ---------------------------------------------------------------- MAGMOR THE MOLTEN
const MG = { rock: '#3a3238', rockL: '#5a5058', lava: '#ff7a1a', glow: '#ffd35a' };
function cracks(p: import('../draw').Pen, pts: number[][]) {
  for (const l of pts) {
    p.line(l, 0.07, 'rgba(255,120,20,0.35)');
    p.line(l, 0.03, MG.lava);
    p.line(l, 0.012, MG.glow);
  }
}
const magmor: CharDef = {
  id: 'magmor', name: 'MAGMOR THE MOLTEN', scale: 1.9, hipY: 0.8,
  joints: { hipF: [0.12, 0], hipB: [-0.12, 0], neck: [0.08, 0.84], shF: [0.28, 0.68], shB: [-0.26, 0.7], hand: [0, -0.6] },
  blood: 'lava', voice: 'troll', color: '#ff7a1a',
  leg: {
    w: 0.7, h: 0.96, ox: 0.3, oy: 0.86,
    draw: (p) => {
      p.blob([-0.18, 0.04, 0.2, 0.04, 0.22, -0.36, -0.2, -0.38], MG.rock);
      p.blob([-0.16, -0.36, 0.18, -0.36, 0.34, -0.84, -0.2, -0.84], MG.rockL);
      cracks(p, [[-0.08, -0.04, 0.02, -0.2, -0.04, -0.32], [0.06, -0.5, 0.14, -0.7]]);
    },
  },
  arm: {
    w: 0.8, h: 1.1, ox: 0.4, oy: 0.84,
    draw: (p) => {
      p.blob([-0.2, 0.1, 0.2, 0.1, 0.18, -0.34, -0.18, -0.34], MG.rockL);
      p.blob([-0.26, -0.34, 0.26, -0.34, 0.32, -0.9, -0.3, -0.92], MG.rock);
      cracks(p, [[-0.1, -0.44, 0.0, -0.62, -0.08, -0.84], [0.12, -0.5, 0.2, -0.7], [-0.06, 0.0, 0.06, -0.2]]);
    },
  },
  pelvis: {
    w: 0.9, h: 0.6, ox: 0.45, oy: 0.36,
    draw: (p) => {
      p.blob([-0.36, 0.1, 0.36, 0.1, 0.3, -0.2, -0.3, -0.22], MG.rock);
      cracks(p, [[-0.2, 0.0, 0.0, -0.1, 0.2, 0.02]]);
    },
  },
  torso: {
    w: 1.3, h: 1.2, ox: 0.64, oy: 0.12,
    draw: (p) => {
      const b = (c: CanvasRenderingContext2D) => polyPath(c, [-0.3, 0.0, 0.3, 0.0, 0.52, 0.3, 0.5, 0.7, 0.3, 0.92, -0.2, 0.94, -0.5, 0.74, -0.52, 0.34]);
      p.shaded(b, MG.rockL, MG.rock, (c) => c.rect(-0.6, -0.1, 0.4, 1.1));
      cracks(p, [[-0.3, 0.6, -0.1, 0.46, 0.06, 0.6, 0.3, 0.5], [0.0, 0.1, 0.1, 0.3, -0.04, 0.4], [0.3, 0.2, 0.4, 0.4], [-0.36, 0.2, -0.24, 0.3]]);
      p.ell(0.06, 0.46, 0.12, 0.12, 'rgba(255,140,30,0.35)', false);
      p.ell(0.06, 0.46, 0.06, 0.06, MG.glow, false);
    },
  },
  head: {
    w: 0.9, h: 0.9, ox: 0.4, oy: 0.12,
    draw: (p) => {
      const h = (c: CanvasRenderingContext2D) => polyPath(c, [-0.22, 0.0, 0.28, 0.0, 0.36, 0.3, 0.2, 0.5, -0.12, 0.52, -0.28, 0.3]);
      p.shaded(h, MG.rockL, MG.rock, (c) => c.rect(-0.4, -0.1, 0.25, 0.7));
      p.poly([0.02, 0.3, 0.14, 0.34, 0.14, 0.28], MG.glow, false);
      p.poly([0.2, 0.3, 0.32, 0.32, 0.3, 0.26], MG.glow, false);
      p.shape((c) => polyPath(c, [0.04, 0.12, 0.32, 0.14, 0.26, 0.06, 0.08, 0.06]), MG.lava, false);
      for (let i = 0; i < 5; i++) p.poly([-0.18 + i * 0.1, 0.48, -0.12 + i * 0.1, 0.66 + (i % 2) * 0.08, -0.06 + i * 0.1, 0.48], i % 2 ? MG.lava : MG.glow, false);
    },
  },
};

// ---------------------------------------------------------------- VORTHAX
const VX = { robe: '#5b2a86', robeD: '#3a1a5a', trim: '#e8b83a', skin: '#d8c2a8', beard: '#d9d9d9', eye: '#ff3b2f', orb: '#44e0ff', wood: '#4a2e18' };
const vorthax: CharDef = {
  id: 'vorthax', name: 'VORTHAX', skin: [VX.skin], scale: 1.15, hipY: 0.82, joints: { ...HERO_J, shF: [0.12, 0.64], shB: [-0.12, 0.66] },
  blood: 'red', voice: 'wizard', color: '#5b2a86',
  leg: {
    w: 0.5, h: 0.98, ox: 0.18, oy: 0.88,
    draw: (p) => {
      p.limbs([[[0, 0, 0.02, -0.4], 0.09], [[0.02, -0.4, 0, -0.72], 0.08]], VX.robeD);
      p.shape((c) => { c.moveTo(-0.1, -0.7); c.lineTo(0.12, -0.7); c.quadraticCurveTo(0.34, -0.72, 0.36, -0.6); c.quadraticCurveTo(0.36, -0.86, 0.12, -0.84); c.lineTo(-0.1, -0.84); c.closePath(); }, VX.robe);
    },
  },
  arm: {
    w: 0.54, h: 0.92, ox: 0.26, oy: 0.78,
    draw: (p) => {
      p.ell(0.02, -0.6, 0.075, 0.075, VX.skin);
      p.line([0.0, -0.64, 0.06, -0.7], 0.015);
      const sl = (c: CanvasRenderingContext2D) => polyPath(c, [-0.12, 0.06, 0.12, 0.06, 0.24, -0.5, -0.2, -0.52]);
      p.shaded(sl, VX.robe, VX.robeD, (c) => c.rect(-0.3, -0.6, 0.14, 0.7));
      p.poly([-0.2, -0.52, 0.24, -0.5, 0.23, -0.44, -0.19, -0.46], VX.trim);
    },
  },
  pelvis: {
    w: 1.04, h: 0.96, ox: 0.52, oy: 0.2,
    draw: (p) => {
      const sk = (c: CanvasRenderingContext2D) => polyPath(c, [-0.3, 0.1, 0.3, 0.1, 0.46, -0.66, -0.46, -0.66]);
      p.shaded(sk, VX.robe, VX.robeD, (c) => c.rect(-0.55, -0.7, 0.35, 0.9));
      p.line([-0.46, -0.62, 0.46, -0.62], 0.04, VX.trim);
      for (let i = 0; i < 5; i++) p.ell(-0.3 + i * 0.15, -0.4 + (i % 2) * 0.1, 0.03, 0.03, VX.trim, false);
      p.rrect(-0.32, 0.0, 0.64, 0.1, 0.03, VX.trim);
    },
  },
  torso: {
    w: 0.96, h: 1.1, ox: 0.46, oy: 0.1,
    draw: (p) => {
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.24, 0.0, 0.24, 0.0, 0.3, 0.34, 0.29, 0.66, 0.1, 0.8, -0.14, 0.8, -0.31, 0.66, -0.33, 0.3]);
      p.shaded(b, VX.robe, VX.robeD, (c) => c.rect(-0.5, -0.1, 0.3, 1.0));
      p.poly([-0.34, 0.72, -0.4, 1.02, -0.14, 0.82, 0.12, 0.84, 0.34, 1.0, 0.3, 0.7], VX.robeD);
      p.line([-0.06, 0.8, 0.08, 0.1], 0.03, VX.trim);
      p.ell(0.12, 0.44, 0.07, 0.07, VX.orb);
    },
  },
  head: {
    w: 1.2, h: 1.9, ox: 0.56, oy: 0.4,
    draw: (p) => {
      p.blob([-0.14, 0.24, 0.3, 0.24, 0.32, -0.12, 0.12, -0.36, -0.06, -0.12], VX.beard);
      const f = (c: CanvasRenderingContext2D) => blobPath(c, [-0.22, 0.3, -0.2, 0.58, 0.04, 0.7, 0.28, 0.58, 0.34, 0.34, 0.24, 0.16, -0.04, 0.14]);
      p.shaded(f, VX.skin, shade(VX.skin, -0.2), (c) => c.rect(-0.3, 0.1, 0.16, 0.7));
      p.blob([-0.04, 0.3, 0.34, 0.26, 0.3, 0.02, 0.12, -0.18, 0.0, 0.04], VX.beard);
      p.line([0.04, 0.44, 0.18, 0.38], 0.04);
      p.line([0.22, 0.38, 0.32, 0.42], 0.04);
      p.ell(0.12, 0.34, 0.035, 0.022, VX.eye, false);
      p.ell(0.27, 0.34, 0.03, 0.02, VX.eye, false);
      p.shape((c) => { c.moveTo(0.3, 0.32); c.quadraticCurveTo(0.46, 0.24, 0.32, 0.18); }, VX.skin);
      p.shape((c) => polyPath(c, [-0.34, 0.52, 0.4, 0.52, 0.16, 1.4, -0.02, 1.2, -0.3, 1.46, -0.06, 1.0]), VX.robe);
      p.rrect(-0.36, 0.5, 0.78, 0.1, 0.04, VX.trim);
      p.ell(0.06, 0.86, 0.1, 0.1, '#efe8d2');
      p.ell(0.02, 0.87, 0.025, 0.03, INK, false);
      p.ell(0.1, 0.87, 0.025, 0.03, INK, false);
    },
  },
  weapon: {
    w: 0.6, h: 2.2, ox: 0.3, oy: 0.4,
    draw: (p) => {
      p.shape((c) => { c.moveTo(-0.04, -0.38); c.lineTo(0.04, -0.38); c.lineTo(0.05, 1.3); c.quadraticCurveTo(0.24, 1.4, 0.16, 1.64); c.quadraticCurveTo(0.1, 1.46, -0.05, 1.4); c.closePath(); }, VX.wood);
      p.ell(0.02, 1.52, 0.16, 0.16, 'rgba(68,224,255,0.35)', false);
      p.ell(0.02, 1.52, 0.1, 0.1, VX.orb);
      p.ell(-0.01, 1.56, 0.03, 0.03, '#e8ffff', false);
    },
  },
};

export const BOSSES: CharDef[] = [hogmother, croakus, magmor, vorthax];
