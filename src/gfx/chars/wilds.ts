// Fiender fra de nye biomene: sump (zombie, froskemann), frost (istroll) og vulkan (ild-imp).
import { INK, shade, blobPath, polyPath } from '../draw';
import { HERO_J, type CharDef } from './types';

// ---------------------------------------------------------------- BOG ZOMBIE
const ZB = { skin: '#8fae7a', rot: '#5d7a4a', cloth: '#6b5b4a', pants: '#4a4238', eye: '#fff36a', bone: '#efe8d2' };
const zombie: CharDef = {
  id: 'zombie', name: 'BOG ZOMBIE', skin: [ZB.skin, ZB.rot], scale: 0.9, hipY: 0.82, joints: { ...HERO_J, neck: [0.1, 0.72], shF: [0.18, 0.6], shB: [-0.06, 0.62] },
  blood: 'green', voice: 'zombie', color: '#5d7a4a',
  leg: {
    w: 0.56, h: 1.0, ox: 0.22, oy: 0.9,
    draw: (p) => {
      p.limbs([[[0, 0, 0.03, -0.4], 0.12], [[0.03, -0.4, 0.0, -0.7], 0.1]], ZB.pants);
      p.poly([-0.12, -0.3, 0.14, -0.28, 0.1, -0.42, 0.02, -0.36, -0.08, -0.46], shade(ZB.pants, -0.3));
      p.limbs([[[0.0, -0.62, 0.0, -0.74], 0.08]], ZB.skin);
      p.line([-0.02, -0.5, 0.03, -0.66], 0.03, ZB.bone);
      p.blob([-0.12, -0.72, 0.1, -0.72, 0.3, -0.8, 0.26, -0.86, -0.12, -0.86], ZB.skin);
      for (const x of [0.16, 0.22, 0.28]) p.line([x, -0.84, x + 0.03, -0.87], 0.015, '#e8e0a0');
    },
  },
  arm: {
    w: 0.44, h: 0.94, ox: 0.22, oy: 0.78,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.3], 0.085], [[0, -0.3, 0.01, -0.54], 0.075]], ZB.skin);
      p.ell(0.02, -0.2, 0.05, 0.04, ZB.rot, false);
      p.poly([-0.12, 0.06, 0.13, 0.06, 0.16, -0.18, 0.06, -0.12, -0.02, -0.22, -0.12, -0.14], ZB.cloth);
      p.ell(0.01, -0.6, 0.08, 0.07, ZB.skin);
      for (const a of [-0.5, 0, 0.5]) p.line([0.01 + Math.sin(a) * 0.05, -0.64, 0.01 + Math.sin(a) * 0.09, -0.72], 0.022, '#d8d0a0');
    },
  },
  pelvis: {
    w: 0.72, h: 0.6, ox: 0.36, oy: 0.42,
    draw: (p) => {
      p.poly([-0.28, 0.1, 0.28, 0.1, 0.3, -0.2, 0.14, -0.14, 0.02, -0.26, -0.14, -0.14, -0.3, -0.22], ZB.pants);
      p.line([-0.28, 0.04, 0.28, 0.06], 0.035, '#a08a5a');
      p.line([0.1, 0.05, 0.16, -0.08], 0.02, '#a08a5a');
    },
  },
  torso: {
    w: 0.9, h: 0.96, ox: 0.44, oy: 0.1,
    draw: (p) => {
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.22, 0.0, 0.24, 0.0, 0.34, 0.3, 0.32, 0.6, 0.16, 0.76, -0.08, 0.74, -0.3, 0.6, -0.32, 0.26]);
      p.shaded(b, ZB.skin, ZB.rot, (c) => c.rect(-0.5, -0.1, 0.3, 1.0));
      p.clipTo(b, () => {
        p.poly([-0.4, 0.8, 0.4, 0.8, 0.4, 0.2, 0.22, 0.3, 0.16, 0.12, 0.02, 0.26, -0.1, 0.0, -0.4, 0.0], ZB.cloth);
        p.ell(0.18, 0.46, 0.1, 0.12, shade(ZB.skin, -0.35));
        for (let i = 0; i < 3; i++) p.line([0.1, 0.52 - i * 0.07, 0.26, 0.5 - i * 0.07], 0.022, ZB.bone);
        p.ell(-0.06, 0.2, 0.05, 0.05, shade(ZB.cloth, -0.4), false);
      });
      p.shape(b, null);
    },
  },
  head: {
    w: 1.0, h: 1.0, ox: 0.46, oy: 0.14,
    draw: (p) => {
      const h = (c: CanvasRenderingContext2D) => blobPath(c, [-0.26, 0.24, -0.24, 0.56, 0.04, 0.7, 0.3, 0.6, 0.38, 0.34, 0.32, 0.1, 0.1, 0.0, -0.14, 0.06]);
      p.shaded(h, ZB.skin, ZB.rot, (c) => c.rect(-0.4, -0.1, 0.25, 0.9));
      p.line([-0.1, 0.62, 0.0, 0.66, 0.1, 0.64], 0.015);
      for (const x of [-0.06, 0.02, 0.1]) p.line([x - 0.02, 0.62, x + 0.02, 0.68], 0.015);
      p.line([-0.12, 0.66, -0.16, 0.8], 0.012);
      p.line([0.02, 0.7, 0.04, 0.86], 0.012);
      p.ell(0.12, 0.38, 0.08, 0.09, ZB.eye);
      p.ell(0.3, 0.36, 0.045, 0.05, ZB.eye);
      p.ell(0.13, 0.37, 0.018, 0.018, INK, false);
      p.line([0.04, 0.5, 0.2, 0.47], 0.03);
      p.shape((c) => { c.moveTo(0.08, 0.12); c.lineTo(0.36, 0.14); c.lineTo(0.3, -0.04); c.lineTo(0.12, -0.02); c.closePath(); }, '#3a1a1a');
      for (const x of [0.14, 0.22, 0.3]) p.poly([x, 0.13, x + 0.03, 0.08, x + 0.06, 0.13], '#e8e0a0', false);
      p.ell(-0.06, 0.28, 0.05, 0.06, shade(ZB.rot, -0.2), false);
    },
  },
};

// ---------------------------------------------------------------- FROGMAN
const FR = { skin: '#5fa84a', skinD: '#3f7a2e', belly: '#d8e08a', spot: '#2e5a22', eye: '#f2e14a', reed: '#8a7a3a', wood: '#7a5230', steel: '#c8d0da' };
function frogLeg(scaleW = 1): CharDef['leg'] {
  return {
    w: 0.7 * scaleW, h: 0.9, ox: 0.28 * scaleW, oy: 0.8,
    draw: (p) => {
      p.limbs([[[0, 0, 0.14, -0.26], 0.15 * scaleW], [[0.14, -0.26, -0.02, -0.58], 0.1 * scaleW]], FR.skin);
      p.ell(0.06, -0.12, 0.06, 0.04, FR.spot, false);
      p.shape((c) => { c.moveTo(-0.12, -0.6); c.lineTo(0.08, -0.6); c.lineTo(0.38, -0.72); c.lineTo(0.3, -0.76); c.lineTo(0.2, -0.72); c.lineTo(0.12, -0.78); c.lineTo(0.02, -0.72); c.lineTo(-0.12, -0.74); c.closePath(); }, FR.skin);
    },
  };
}
function frogArm(): CharDef['arm'] {
  return {
    w: 0.44, h: 0.9, ox: 0.22, oy: 0.76,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.3], 0.09], [[0, -0.3, 0, -0.52], 0.08]], FR.skin);
      p.ell(0.02, -0.14, 0.04, 0.03, FR.spot, false);
      p.ell(0, -0.6, 0.09, 0.08, FR.skin);
      for (const a of [-0.6, 0, 0.6]) p.ell(Math.sin(a) * 0.08, -0.66 - Math.cos(a) * 0.02, 0.03, 0.03, FR.belly);
    },
  };
}
const frogman: CharDef = {
  id: 'frogman', name: 'FROGMAN', skin: [FR.skin, FR.belly], scale: 0.9, hipY: 0.72, joints: { ...HERO_J, neck: [0.08, 0.66], shF: [0.16, 0.58], shB: [-0.1, 0.6] },
  blood: 'red', voice: 'frog', color: '#3f7a2e',
  leg: frogLeg(),
  arm: frogArm(),
  pelvis: {
    w: 0.76, h: 0.66, ox: 0.38, oy: 0.44,
    draw: (p) => {
      for (let i = 0; i < 9; i++) {
        const x = -0.28 + i * 0.07;
        p.poly([x - 0.03, 0.06, x + 0.03, 0.06, x + 0.01 + (i % 2) * 0.02, -0.34 + (i % 3) * 0.04], FR.reed);
      }
      p.rrect(-0.3, 0.0, 0.6, 0.1, 0.03, shade(FR.reed, -0.35));
    },
  },
  torso: {
    w: 0.9, h: 0.92, ox: 0.44, oy: 0.1,
    draw: (p) => {
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.24, 0.0, 0.26, 0.0, 0.36, 0.28, 0.3, 0.56, 0.1, 0.7, -0.14, 0.68, -0.3, 0.52, -0.32, 0.22]);
      p.shaded(b, FR.skin, FR.skinD, (c) => c.rect(-0.5, -0.1, 0.28, 0.9));
      p.clipTo(b, () => p.shape((c) => c.ellipse(0.16, 0.26, 0.2, 0.28, 0, 0, Math.PI * 2), FR.belly, false));
      for (const [x, y] of [[-0.16, 0.5], [-0.2, 0.3], [0.0, 0.58]]) p.ell(x, y, 0.045, 0.035, FR.spot, false);
      p.line([-0.28, 0.56, 0.24, 0.12], 0.05, FR.reed);
      p.shape(b, null);
    },
  },
  head: {
    w: 1.0, h: 0.9, ox: 0.44, oy: 0.12,
    draw: (p) => {
      const h = (c: CanvasRenderingContext2D) => blobPath(c, [-0.28, 0.08, -0.3, 0.3, -0.12, 0.44, 0.2, 0.44, 0.44, 0.32, 0.46, 0.14, 0.3, 0.0, -0.06, -0.02]);
      p.shaded(h, FR.skin, FR.skinD, (c) => c.rect(-0.4, -0.1, 0.25, 0.7));
      p.ell(0.02, 0.5, 0.13, 0.13, FR.skin);
      p.ell(0.26, 0.5, 0.12, 0.12, FR.skin);
      p.ell(0.03, 0.52, 0.08, 0.08, FR.eye);
      p.ell(0.27, 0.52, 0.075, 0.075, FR.eye);
      p.rrect(0.0, 0.5, 0.07, 0.03, 0.01, INK, false);
      p.rrect(0.24, 0.5, 0.07, 0.03, 0.01, INK, false);
      p.line([-0.06, 0.62, 0.1, 0.58], 0.03);
      p.shape((c) => { c.moveTo(-0.04, 0.12); c.quadraticCurveTo(0.24, 0.02, 0.46, 0.14); }, null, true, 0.03);
      p.ell(0.4, 0.3, 0.015, 0.012, INK, false);
      p.ell(-0.14, 0.26, 0.05, 0.04, FR.spot, false);
    },
  },
  weapon: {
    w: 0.46, h: 2.0, ox: 0.23, oy: 0.44,
    draw: (p) => {
      p.rrect(-0.03, -0.42, 0.06, 1.6, 0.02, FR.wood);
      for (const y of [-0.2, 0.0]) p.line([-0.035, y, 0.035, y + 0.04], 0.015, FR.reed);
      p.poly([-0.06, 1.14, 0.0, 1.5, 0.06, 1.14], FR.steel);
      p.poly([-0.16, 1.1, -0.12, 1.34, -0.06, 1.14], FR.steel);
      p.poly([0.16, 1.1, 0.12, 1.34, 0.06, 1.14], FR.steel);
      p.rrect(-0.17, 1.06, 0.34, 0.06, 0.02, FR.steel);
    },
  },
};

// ---------------------------------------------------------------- ISTROLL
const TR = { fur: '#e6edf2', furD: '#aebfd0', skin: '#7ea0c8', skinD: '#5a7aa0', tusk: '#fffbe8', ice: '#bfe8ff', iceD: '#6fb4e0', leather: '#4a3a30' };
const troll: CharDef = {
  id: 'troll', name: 'ICE TROLL', skin: [TR.skin], scale: 1.2, hipY: 0.76,
  joints: { hipF: [0.1, 0], hipB: [-0.1, 0], neck: [0.14, 0.8], shF: [0.22, 0.66], shB: [-0.18, 0.7], hand: [0, -0.62] },
  blood: 'red', voice: 'troll', color: '#5a7aa0',
  leg: {
    w: 0.66, h: 0.92, ox: 0.28, oy: 0.82,
    draw: (p) => {
      p.limbs([[[0, 0, 0.02, -0.32], 0.18], [[0.02, -0.32, 0, -0.56], 0.15]], TR.fur);
      for (let i = 0; i < 4; i++) p.line([-0.14 + i * 0.09, -0.1 - i * 0.05, -0.1 + i * 0.09, -0.2 - i * 0.05], 0.02, TR.furD);
      p.blob([-0.18, -0.54, 0.14, -0.54, 0.34, -0.72, 0.26, -0.8, -0.18, -0.8], TR.skin);
      for (const x of [0.18, 0.26]) p.poly([x, -0.78, x + 0.06, -0.84, x + 0.04, -0.76], TR.tusk);
    },
  },
  arm: {
    w: 0.6, h: 1.02, ox: 0.3, oy: 0.82,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.32], 0.16], [[0, -0.32, 0, -0.54], 0.14]], TR.fur);
      p.line([-0.1, -0.1, -0.06, -0.24], 0.02, TR.furD);
      p.ell(0, -0.65, 0.15, 0.13, TR.skin);
      p.line([0.05, -0.6, 0.14, -0.64], 0.02);
      p.ell(0, -0.02, 0.17, 0.15, TR.fur);
    },
  },
  pelvis: {
    w: 0.96, h: 0.7, ox: 0.48, oy: 0.5,
    draw: (p) => {
      p.fur(-0.38, 0.38, -0.24, 0.12, 9, TR.furD, -1);
      p.blob([-0.38, 0.08, 0.38, 0.08, 0.36, -0.24, -0.36, -0.24], TR.fur);
      p.rrect(-0.4, 0.0, 0.8, 0.12, 0.04, TR.leather);
      p.ell(0.16, 0.06, 0.07, 0.06, TR.ice);
    },
  },
  torso: {
    w: 1.16, h: 1.14, ox: 0.56, oy: 0.12,
    draw: (p) => {
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.3, 0.0, 0.3, 0.0, 0.48, 0.26, 0.5, 0.56, 0.34, 0.82, 0.04, 0.9, -0.3, 0.86, -0.46, 0.64, -0.46, 0.3]);
      p.shaded(b, TR.fur, TR.furD, (c) => c.rect(-0.6, -0.1, 0.35, 1.1));
      p.clipTo(b, () => p.shape((c) => c.ellipse(0.24, 0.34, 0.22, 0.26, 0, 0, Math.PI * 2), TR.skin, false));
      for (let i = 0; i < 7; i++) {
        const x = -0.36 + (i % 4) * 0.14;
        const y = 0.2 + Math.floor(i / 4) * 0.36 + (i % 2) * 0.1;
        p.line([x, y, x + 0.04, y - 0.1], 0.022, TR.furD);
      }
      p.poly([-0.4, 0.86, -0.3, 1.02, -0.22, 0.88, -0.12, 1.04, -0.02, 0.9], TR.ice);
    },
  },
  head: {
    w: 1.1, h: 1.1, ox: 0.5, oy: 0.14,
    draw: (p) => {
      p.blob([-0.3, 0.2, -0.36, 0.6, -0.1, 0.8, 0.2, 0.74, 0.1, 0.5, -0.1, 0.3], TR.fur);
      const h = (c: CanvasRenderingContext2D) => blobPath(c, [-0.2, 0.14, -0.2, 0.46, 0.04, 0.62, 0.3, 0.54, 0.42, 0.32, 0.36, 0.06, 0.1, -0.04, -0.1, 0.0]);
      p.shaded(h, TR.skin, TR.skinD, (c) => c.rect(-0.3, -0.1, 0.2, 0.8));
      p.ell(0.44, 0.3, 0.1, 0.12, TR.skin);
      p.poly([0.18, 0.02, 0.22, 0.26, 0.28, 0.04], TR.tusk);
      p.poly([0.32, 0.02, 0.34, 0.2, 0.38, 0.04], TR.tusk);
      p.line([0.06, 0.46, 0.34, 0.4], 0.06);
      p.ell(0.18, 0.37, 0.04, 0.035, '#ffe14a');
      p.ell(0.32, 0.35, 0.035, 0.03, '#ffe14a');
      p.line([0.08, 0.1, 0.34, 0.1], 0.025);
      p.fur(-0.24, 0.3, 0.6, 0.12, 8, TR.fur, 1);
    },
  },
  weapon: {
    w: 0.6, h: 1.8, ox: 0.3, oy: 0.34,
    draw: (p) => {
      p.rrect(-0.05, -0.3, 0.1, 0.6, 0.03, TR.leather);
      p.shaded((c) => polyPath(c, [-0.08, 0.26, 0.08, 0.26, 0.2, 1.1, 0.1, 1.38, 0.0, 1.2, -0.12, 1.36, -0.2, 1.1]), TR.ice, TR.iceD, (c) => c.rect(0, 0, 0.3, 1.5));
      p.line([-0.02, 0.4, 0.04, 1.0], 0.02, '#ffffff');
    },
  },
};

// ---------------------------------------------------------------- ILD-IMP
const FI = { skin: '#d8402a', skinD: '#9a2418', horn: '#2a1a14', wing: '#5a1a14', eye: '#ffe34a', fire: '#ffb02e' };
const fireimp: CharDef = {
  id: 'fireimp', name: 'FIRE IMP', skin: [FI.skin], scale: 0.72, hipY: 0.52,
  joints: { hipF: [0.06, 0], hipB: [-0.06, 0], neck: [0.04, 0.54], shF: [0.12, 0.44], shB: [-0.1, 0.46], hand: [0, -0.4] },
  blood: 'lava', voice: 'imp', color: '#9a2418',
  leg: {
    w: 0.5, h: 0.64, ox: 0.2, oy: 0.58,
    draw: (p) => {
      p.limbs([[[0, 0, 0.06, -0.2], 0.08], [[0.06, -0.2, -0.02, -0.4], 0.06]], FI.skin);
      p.poly([-0.08, -0.4, 0.06, -0.4, 0.24, -0.5, -0.08, -0.52], FI.horn);
    },
  },
  arm: {
    w: 0.36, h: 0.6, ox: 0.18, oy: 0.48,
    draw: (p) => {
      p.limbs([[[0, 0, 0, -0.34], 0.06]], FI.skin);
      p.ell(0, -0.42, 0.07, 0.065, FI.skin);
      for (const a of [-0.5, 0, 0.5]) p.poly([Math.sin(a) * 0.05 - 0.015, -0.46, Math.sin(a) * 0.07, -0.54, Math.sin(a) * 0.05 + 0.015, -0.46], FI.horn, false);
    },
  },
  pelvis: {
    w: 0.9, h: 0.6, ox: 0.6, oy: 0.3,
    draw: (p) => {
      p.shape((c) => { c.moveTo(-0.1, -0.02); c.quadraticCurveTo(-0.5, -0.1, -0.44, 0.2); }, null, true, 0.08);
      p.shape((c) => { c.moveTo(-0.1, -0.02); c.quadraticCurveTo(-0.5, -0.1, -0.44, 0.2); }, null, false);
      p.line([-0.1, -0.02, -0.3, -0.04, -0.44, 0.18], 0.045, FI.skin);
      p.poly([-0.5, 0.16, -0.44, 0.3, -0.38, 0.16], FI.skin);
      p.blob([-0.18, 0.08, 0.18, 0.08, 0.16, -0.12, -0.16, -0.12], shade(FI.skin, -0.3));
    },
  },
  torso: {
    w: 1.2, h: 0.9, ox: 0.66, oy: 0.1,
    draw: (p) => {
      p.shape((c) => { c.moveTo(-0.08, 0.5); c.lineTo(-0.6, 0.72); c.lineTo(-0.5, 0.5); c.lineTo(-0.56, 0.38); c.lineTo(-0.42, 0.34); c.lineTo(-0.44, 0.2); c.closePath(); }, FI.wing);
      p.line([-0.08, 0.5, -0.6, 0.72], 0.02, shade(FI.wing, 0.3));
      const b = (c: CanvasRenderingContext2D) => blobPath(c, [-0.16, 0.0, 0.18, 0.0, 0.24, 0.26, 0.16, 0.54, -0.14, 0.54, -0.22, 0.26]);
      p.shaded(b, FI.skin, FI.skinD, (c) => c.rect(-0.3, -0.1, 0.14, 0.7));
      p.line([0.04, 0.34, 0.16, 0.3], 0.02, FI.skinD);
    },
  },
  head: {
    w: 0.9, h: 0.96, ox: 0.44, oy: 0.12,
    draw: (p) => {
      p.poly([-0.14, 0.5, -0.3, 0.86, -0.04, 0.58], FI.horn);
      p.poly([0.14, 0.54, 0.22, 0.9, 0.24, 0.56], FI.horn);
      const h = (c: CanvasRenderingContext2D) => blobPath(c, [-0.24, 0.18, -0.24, 0.5, 0.02, 0.64, 0.3, 0.54, 0.36, 0.26, 0.26, 0.04, 0.0, -0.02]);
      p.shaded(h, FI.skin, FI.skinD, (c) => c.rect(-0.35, -0.1, 0.18, 0.8));
      p.ell(0.08, 0.36, 0.06, 0.05, FI.eye);
      p.ell(0.24, 0.35, 0.05, 0.045, FI.eye);
      p.rrect(0.07, 0.34, 0.02, 0.05, 0.01, INK, false);
      p.rrect(0.23, 0.33, 0.02, 0.04, 0.01, INK, false);
      p.shape((c) => { c.moveTo(0.0, 0.16); c.quadraticCurveTo(0.18, 0.02, 0.34, 0.16); c.closePath(); }, '#fff');
      p.line([0.0, 0.16, 0.34, 0.16], 0.015);
    },
  },
};

// ---------------------------------------------------------------- KJEMPETROLLET
// Konseptbilde 4: et istroll som rager over heltene. Samme tegning som istrollet, over dobbelt så stort. PNG-delene
// arves fra istrollet til det finnes egne (bigtroll_*.png), og de tegnede delene får flere piksler per enhet (rig.ts).
const bigtroll: CharDef = {
  ...troll, id: 'bigtroll', name: 'AVALANCHE TROLL', scale: 2.6, color: '#3a5a80',
  inherit: { leg: 'troll', arm: 'troll', pelvis: 'troll', torso: 'troll', head: 'troll', weapon: 'troll' },
};

export const WILDS: CharDef[] = [zombie, frogman, troll, bigtroll, fireimp];
export { frogLeg, frogArm, FR };
