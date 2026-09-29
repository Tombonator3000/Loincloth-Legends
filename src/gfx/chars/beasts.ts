// Ridedyr (tegnet i enhetsrom, vendt mot høyre): krigsvillsvin, kakatrisse og magma-salamander.
// Alle er originale design. Delene settes sammen av BeastRig i gfx/beast.ts.
import { INK, shade, blobPath, polyPath } from '../draw';
import type { PartDef, V2 } from './types';

export interface BeastDef {
  id: string;
  name: string;
  scale: number;
  /** Høyden til kroppens midtpunkt over bakken (før skalering). */
  bodyY: number;
  legs: 2 | 4;
  joints: { head: V2; tail: V2; legF: V2; legB: V2; saddle: V2 };
  body: PartDef;
  head: PartDef;
  tail: PartDef;
  leg: PartDef;
  color: string;
}

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- KRIGSVILLSVIN
const HOG = { hide: '#6b4a3a', belly: '#8a6450', bristle: '#3a2a22', snout: '#d49482', tusk: '#fff6de', saddle: '#8e1b1b', gold: '#e8b83a', leather: '#5a3519', hoof: '#2a1a14', iron: '#6f757c' };
const warhog: BeastDef = {
  id: 'warhog', name: 'WAR HOG', scale: 1.05, bodyY: 0.98, legs: 4, color: HOG.saddle,
  joints: { head: [0.82, 0.12], tail: [-0.98, 0.25], legF: [0.52, -0.3], legB: [-0.58, -0.3], saddle: [-0.02, 0.62] },
  body: {
    w: 2.5, h: 1.7, ox: 1.25, oy: 0.8,
    draw: (p) => {
      const b = (c: C) => blobPath(c, [-1.05, -0.2, -0.95, 0.42, -0.3, 0.66, 0.5, 0.62, 1.0, 0.3, 1.0, -0.15, 0.5, -0.46, -0.5, -0.46]);
      // Bust langs ryggen
      for (let x = -0.8; x < 0.8; x += 0.14) p.poly([x - 0.08, 0.52, x + 0.02, 0.84 + Math.sin(x * 7) * 0.05, x + 0.1, 0.52], HOG.bristle);
      p.shaded(b, HOG.hide, shade(HOG.hide, -0.25), (c) => c.rect(-1.2, -0.6, 2.4, 0.35));
      p.clipTo(b, () => {
        p.shape((c) => c.ellipse(0.1, -0.35, 0.8, 0.2, 0, 0, TAU), HOG.belly, false);
        for (let i = 0; i < 12; i++) p.line([-0.8 + i * 0.15, 0.2 + (i % 3) * 0.08, -0.74 + i * 0.15, 0.1 + (i % 3) * 0.08], 0.02, shade(HOG.hide, -0.3));
      });
      p.shape(b, null);
      // Sadeldekken og sal
      p.shape((c) => polyPath(c, [-0.42, 0.62, 0.38, 0.62, 0.34, 0.02, -0.38, 0.02]), HOG.saddle);
      p.line([-0.4, 0.1, 0.36, 0.1], 0.04, HOG.gold);
      for (const x of [-0.28, 0.0, 0.26]) p.poly([x - 0.06, 0.02, x, -0.1, x + 0.06, 0.02], HOG.gold);
      p.blob([-0.36, 0.6, -0.3, 0.8, -0.1, 0.72, 0.14, 0.72, 0.3, 0.84, 0.34, 0.6], HOG.leather);
      p.line([0.0, 0.6, 0.02, -0.12], 0.025, HOG.leather);
      p.rrect(-0.06, -0.2, 0.14, 0.1, 0.02, HOG.iron);
      // Arr og piggkrage
      p.line([0.55, 0.3, 0.75, 0.05], 0.025, '#8a3a2a');
      p.rrect(0.72, -0.1, 0.12, 0.52, 0.04, HOG.iron);
      for (const y of [0.0, 0.18, 0.34]) p.poly([0.84, y - 0.04, 0.96, y, 0.84, y + 0.04], '#d8d8d8');
    },
  },
  head: {
    w: 1.3, h: 1.2, ox: 0.25, oy: 0.6,
    draw: (p) => {
      p.poly([0.02, 0.3, -0.06, 0.62, 0.22, 0.4], HOG.hide);
      const h = (c: C) => blobPath(c, [-0.12, -0.32, -0.12, 0.36, 0.3, 0.46, 0.72, 0.26, 0.9, -0.04, 0.62, -0.38, 0.2, -0.42]);
      p.shaded(h, HOG.hide, shade(HOG.hide, -0.25), (c) => c.rect(-0.3, -0.6, 1.4, 0.3));
      p.ell(0.86, -0.04, 0.15, 0.17, HOG.snout);
      p.ell(0.9, 0.02, 0.03, 0.045, INK, false);
      p.ell(0.84, -0.1, 0.03, 0.045, INK, false);
      // Støttenner
      p.shape((c) => { c.moveTo(0.62, -0.22); c.quadraticCurveTo(0.9, -0.2, 0.84, 0.16); c.quadraticCurveTo(0.78, -0.06, 0.58, -0.12); c.closePath(); }, HOG.tusk);
      // Sint øye
      p.ell(0.44, 0.12, 0.08, 0.07, '#fff');
      p.ell(0.47, 0.11, 0.035, 0.035, '#c0202a', false);
      p.line([0.32, 0.26, 0.56, 0.17], 0.05);
      // Hjelmplate
      p.shape((c) => polyPath(c, [-0.06, 0.34, 0.34, 0.46, 0.5, 0.32, 0.1, 0.2]), HOG.iron);
      p.poly([0.18, 0.4, 0.24, 0.62, 0.3, 0.42], '#d8d8d8');
    },
  },
  tail: {
    w: 0.7, h: 0.7, ox: 0.6, oy: 0.3,
    draw: (p) => {
      const c = p.c;
      const path = () => {
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(-0.3, 0.05, -0.45, 0.35, -0.25, 0.32);
        c.bezierCurveTo(-0.1, 0.3, -0.2, 0.12, -0.35, 0.16);
      };
      c.lineCap = 'round';
      path();
      c.strokeStyle = INK;
      c.lineWidth = 0.12;
      c.stroke();
      path();
      c.strokeStyle = HOG.snout;
      c.lineWidth = 0.06;
      c.stroke();
    },
  },
  leg: {
    w: 0.46, h: 0.86, ox: 0.23, oy: 0.76,
    draw: (p) => {
      p.limbs([[[0, 0.05, 0.0, -0.3], 0.14], [[0, -0.3, 0.02, -0.56], 0.11]], HOG.hide);
      p.rrect(-0.12, -0.72, 0.28, 0.16, 0.05, HOG.hoof);
      p.line([0.02, -0.72, 0.02, -0.6], 0.02, '#000');
    },
  },
};

// ---------------------------------------------------------------- KAKATRISSE (hane + øgle)
const CK = { feather: '#f3ead2', featherD: '#d8c8a0', speck: '#a8743f', comb: '#d0202a', beak: '#f2b21e', scale: '#5f8f3a', scaleD: '#3f6b24', leg: '#e8a020', blanket: '#2e6fd0', gold: '#e8b83a', leather: '#5a3519' };
const cluckatrice: BeastDef = {
  id: 'cluckatrice', name: 'CLUCKATRICE', scale: 1.0, bodyY: 1.25, legs: 2, color: CK.blanket,
  joints: { head: [0.62, 0.3], tail: [-0.72, 0.1], legF: [0.18, -0.3], legB: [-0.1, -0.3], saddle: [-0.08, 0.5] },
  body: {
    w: 1.9, h: 1.4, ox: 0.95, oy: 0.7,
    draw: (p) => {
      const b = (c: C) => blobPath(c, [-0.8, 0.0, -0.6, 0.45, 0.0, 0.58, 0.55, 0.45, 0.78, 0.1, 0.5, -0.4, -0.2, -0.45, -0.7, -0.3]);
      p.shaded(b, CK.feather, CK.featherD, (c) => c.rect(-1, -0.6, 2, 0.35));
      p.clipTo(b, () => {
        for (let i = 0; i < 18; i++) p.ell(-0.6 + (i % 6) * 0.22, -0.2 + Math.floor(i / 6) * 0.2, 0.03, 0.02, CK.speck, false);
      });
      p.shape(b, null);
      // Vinge
      const w = (c: C) => blobPath(c, [-0.5, 0.25, -0.1, 0.35, 0.35, 0.2, 0.3, -0.15, -0.2, -0.2, -0.55, 0.0]);
      p.shaded(w, CK.featherD, shade(CK.featherD, -0.2), (c) => c.rect(-0.7, -0.3, 1.2, 0.15));
      for (const y of [0.1, -0.02, -0.12]) p.shape((c) => { c.moveTo(-0.4, y + 0.08); c.quadraticCurveTo(0.0, y, 0.28, y + 0.04); }, null, true, 0.02);
      // Sadeldekken
      p.shape((c) => polyPath(c, [-0.36, 0.52, 0.26, 0.54, 0.22, 0.18, -0.34, 0.16]), CK.blanket);
      p.line([-0.34, 0.22, 0.22, 0.24], 0.035, CK.gold);
      p.blob([-0.3, 0.5, -0.24, 0.66, 0.0, 0.58, 0.16, 0.66, 0.22, 0.5], CK.leather);
    },
  },
  head: {
    w: 1.1, h: 1.6, ox: 0.3, oy: 0.25,
    draw: (p) => {
      // Lang hals opp til hodet
      p.limbs([[[0, 0, 0.18, 0.5, 0.26, 0.8], 0.16]], CK.feather);
      for (const y of [0.2, 0.4, 0.6]) p.line([0.02 + y * 0.35, y, 0.2 + y * 0.35, y + 0.05], 0.018, CK.featherD);
      // Kam
      for (const [x, y, r] of [[0.14, 1.12, 0.08], [0.26, 1.18, 0.09], [0.38, 1.12, 0.08]] as const) p.ell(x, y, r, r, CK.comb);
      p.ell(0.3, 0.92, 0.25, 0.23, CK.feather);
      // Nebb og hakelapp
      p.poly([0.5, 0.98, 0.78, 0.9, 0.5, 0.84], CK.beak);
      p.line([0.52, 0.91, 0.72, 0.9], 0.015);
      p.blob([0.46, 0.84, 0.54, 0.84, 0.54, 0.66, 0.46, 0.68], CK.comb);
      // Galt øye
      p.ell(0.36, 1.0, 0.09, 0.09, '#fff');
      p.ell(0.39, 1.02, 0.03, 0.03, INK, false);
      p.line([0.26, 1.08, 0.46, 1.1], 0.03);
    },
  },
  tail: {
    w: 1.6, h: 1.0, ox: 1.45, oy: 0.4,
    draw: (p) => {
      const t = (c: C) => { c.moveTo(0.05, 0.14); c.quadraticCurveTo(-0.6, 0.3, -1.25, 0.46); c.lineTo(-1.2, 0.36); c.quadraticCurveTo(-0.6, 0.08, 0.05, -0.14); c.closePath(); };
      p.shaded(t, CK.scale, CK.scaleD, (c) => c.rect(-1.5, -0.2, 1.6, 0.2));
      for (let x = -1.0; x < 0; x += 0.14) p.line([x, 0.12 + (x + 1) * -0.12 + 0.25, x + 0.05, 0.05 + (x + 1) * -0.12 + 0.25], 0.015, CK.scaleD);
      // Fjærdusk på tuppen
      for (let i = 0; i < 4; i++) p.blob([-1.2, 0.4, -1.36 - i * 0.02, 0.56 + i * 0.05, -1.42, 0.5 + i * 0.03, -1.3, 0.38], i % 2 ? CK.comb : CK.feather);
    },
  },
  leg: {
    w: 0.6, h: 1.0, ox: 0.3, oy: 0.9,
    draw: (p) => {
      p.limbs([[[0, 0, 0.06, -0.36], 0.11]], CK.featherD);
      p.limbs([[[0.06, -0.36, -0.02, -0.74], 0.055]], CK.leg);
      for (const [dx, dy] of [[0.24, -0.02], [0.12, -0.06], [-0.14, -0.02]] as const) p.limbs([[[-0.02, -0.74, -0.02 + dx, -0.78 + dy], 0.03]], CK.leg);
      for (let y = -0.44; y > -0.7; y -= 0.07) p.line([-0.06, y, 0.08, y - 0.02], 0.012, shade(CK.leg, -0.35));
    },
  },
};

// ---------------------------------------------------------------- MAGMA-SALAMANDER
const NW = { skin: '#6e1d12', skinD: '#4a120a', glow: '#ffb02e', glowH: '#fff0a0', belly: '#a8442a', horn: '#2a2228', saddle: '#2a2a30', gold: '#e8b83a', leather: '#5a3519' };
const magmanewt: BeastDef = {
  id: 'magmanewt', name: 'MAGMA NEWT', scale: 1.05, bodyY: 0.72, legs: 4, color: NW.glow,
  joints: { head: [0.95, 0.1], tail: [-1.0, 0.05], legF: [0.62, -0.18], legB: [-0.66, -0.18], saddle: [-0.05, 0.4] },
  body: {
    w: 2.5, h: 1.2, ox: 1.25, oy: 0.55,
    draw: (p) => {
      const b = (c: C) => blobPath(c, [-1.1, -0.05, -0.9, 0.3, -0.2, 0.44, 0.6, 0.38, 1.05, 0.12, 0.95, -0.2, 0.3, -0.34, -0.6, -0.3]);
      p.shaded(b, NW.skin, NW.skinD, (c) => c.rect(-1.2, -0.5, 2.4, 0.3));
      p.clipTo(b, () => {
        p.shape((c) => c.ellipse(0.0, -0.28, 0.9, 0.14, 0, 0, TAU), NW.belly, false);
        for (let i = 0; i < 9; i++) {
          const x = -0.8 + i * 0.2, y = 0.12 + (i % 2) * 0.1;
          p.shape((c) => c.ellipse(x, y, 0.07, 0.05, 0.3, 0, TAU), NW.glow, false);
          p.shape((c) => c.ellipse(x, y, 0.03, 0.02, 0.3, 0, TAU), NW.glowH, false);
        }
      });
      p.shape(b, null);
      p.shape((c) => polyPath(c, [-0.38, 0.44, 0.3, 0.44, 0.26, 0.1, -0.34, 0.1]), NW.saddle);
      p.line([-0.36, 0.16, 0.28, 0.16], 0.035, NW.gold);
      p.blob([-0.34, 0.42, -0.28, 0.6, -0.04, 0.52, 0.16, 0.6, 0.24, 0.42], NW.leather);
      // Rygg-pigger
      for (let x = 0.4; x < 0.95; x += 0.14) p.poly([x - 0.05, 0.3, x, 0.46, x + 0.05, 0.3], NW.horn);
    },
  },
  head: {
    w: 1.3, h: 0.9, ox: 0.2, oy: 0.42,
    draw: (p) => {
      const h = (c: C) => blobPath(c, [-0.1, -0.2, -0.05, 0.22, 0.4, 0.3, 0.95, 0.12, 1.02, -0.08, 0.6, -0.26, 0.1, -0.28]);
      p.shaded(h, NW.skin, NW.skinD, (c) => c.rect(-0.3, -0.4, 1.4, 0.18));
      p.shape((c) => { c.moveTo(0.3, -0.06); c.quadraticCurveTo(0.7, -0.14, 1.0, -0.04); }, null, true, 0.03);
      p.ell(0.5, 0.12, 0.09, 0.08, NW.glowH);
      p.ell(0.52, 0.12, 0.02, 0.06, INK, false);
      p.poly([0.2, 0.2, 0.08, 0.44, 0.3, 0.26], NW.horn);
      p.poly([0.36, 0.24, 0.3, 0.42, 0.46, 0.27], NW.horn);
      p.ell(0.96, 0.02, 0.02, 0.02, INK, false);
    },
  },
  tail: {
    w: 1.8, h: 0.8, ox: 1.7, oy: 0.4,
    draw: (p) => {
      const t = (c: C) => { c.moveTo(0.05, 0.16); c.quadraticCurveTo(-0.8, 0.2, -1.6, -0.1); c.quadraticCurveTo(-0.8, 0.0, 0.05, -0.18); c.closePath(); };
      p.shaded(t, NW.skin, NW.skinD, (c) => c.rect(-1.7, -0.3, 1.8, 0.18));
      for (let x = -1.2; x < -0.1; x += 0.25) p.shape((c) => c.ellipse(x, 0.04 + x * 0.05, 0.05, 0.03, 0, 0, TAU), NW.glow, false);
      p.shape((c) => c.ellipse(-1.52, -0.08, 0.08, 0.05, 0.3, 0, TAU), NW.glowH, false);
    },
  },
  leg: {
    w: 0.6, h: 0.66, ox: 0.25, oy: 0.56,
    draw: (p) => {
      p.limbs([[[0, 0.05, 0.1, -0.22], 0.1], [[0.1, -0.22, 0.04, -0.44], 0.08]], NW.skin);
      for (const dx of [0.2, 0.1, -0.06]) p.limbs([[[0.04, -0.46, 0.04 + dx, -0.52], 0.03]], NW.skinD);
    },
  },
};

export const BEASTS: Record<string, BeastDef> = { warhog, cluckatrice, magmanewt };
