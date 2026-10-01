// Småkryp som ikke er fiender av seg selv: høna fiendene blir til av POLYMORPH: CHICKEN (game/spells.ts).
// Vingene er armene i riggen, så høna flakser av seg selv når den får panikk (armene i været i Fighter.animate).
import { INK, shade, blobPath } from '../draw';
import type { CharDef } from './types';

const HEN = { feather: '#f1e7cf', featherD: '#d6c49c', featherDD: '#b39a6c', speck: '#a8743f', comb: '#c8202a', beak: '#efaa1e', leg: '#e4a028', legD: '#a86a14', eye: '#fffaf0' };
type C = CanvasRenderingContext2D;

const chicken: CharDef = {
  id: 'chicken', name: 'CHICKEN', scale: 0.8, hipY: 0.36,
  joints: { hipF: [0.05, 0], hipB: [-0.06, 0], neck: [0.2, 0.34], shF: [-0.04, 0.3], shB: [0.03, 0.31], hand: [-0.02, -0.26] },
  blood: 'red', voice: 'rooster', color: '#c8202a', skin: [HEN.feather],
  leg: {
    w: 0.5, h: 0.5, ox: 0.2, oy: 0.42,
    draw: (p) => {
      // Lår med fjær (trommestikka), så skjellete bein og tær
      p.limbs([[[0.02, -0.12, 0.0, -0.34], 0.026]], HEN.leg);
      for (let y = -0.16; y > -0.32; y -= 0.035) p.line([-0.02, y, 0.03, y - 0.008], 0.008, HEN.legD);
      for (const [dx, dy] of [[0.14, -0.02], [0.09, -0.05], [-0.09, 0.0]] as const) p.limbs([[[0.0, -0.34, dx, -0.36 + dy], 0.016]], HEN.leg);
      p.shaded((c: C) => c.ellipse(0.0, -0.03, 0.085, 0.11, 0.15, 0, Math.PI * 2), HEN.feather, HEN.featherD, (c: C) => c.rect(-0.12, -0.16, 0.06, 0.3));
    },
  },
  arm: {
    // Vingen henger ned fra skulderen og bakover, med lag av fjær og mørkere svingfjær ytterst
    w: 0.5, h: 0.5, ox: 0.25, oy: 0.4,
    draw: (p) => {
      const w = (c: C) => blobPath(c, [0.0, 0.06, 0.1, 0.0, 0.08, -0.16, -0.02, -0.3, -0.12, -0.2, -0.1, -0.02]);
      p.shaded(w, HEN.feather, HEN.featherD, (c: C) => c.rect(-0.2, -0.36, 0.12, 0.44));
      p.clipTo(w, () => {
        for (let i = 0; i < 4; i++) p.shape((c: C) => { c.moveTo(-0.12, -0.05 - i * 0.06); c.quadraticCurveTo(0.0, -0.02 - i * 0.07, 0.1, -0.06 - i * 0.065); }, null, true, 0.012);
        p.blob([-0.14, -0.2, -0.04, -0.16, 0.06, -0.2, -0.02, -0.34], HEN.featherDD, false);
      });
      p.shape(w, null);
    },
  },
  pelvis: {
    // Fjærdusken under halen
    w: 0.5, h: 0.4, ox: 0.25, oy: 0.2,
    draw: (p) => {
      p.blob([-0.16, 0.08, -0.04, 0.12, 0.1, 0.06, 0.06, -0.06, -0.12, -0.06], HEN.featherD);
    },
  },
  torso: {
    // Rund kropp med bryst fram til høyre og halefjær opp til venstre
    w: 1.0, h: 0.9, ox: 0.55, oy: 0.12,
    draw: (p) => {
      for (const [x1, y1, x2, y2, col] of [[-0.24, 0.3, -0.46, 0.6, HEN.featherDD], [-0.22, 0.26, -0.5, 0.48, HEN.featherD], [-0.2, 0.22, -0.48, 0.34, HEN.featherD]] as const) {
        p.shape((c: C) => { c.moveTo(-0.16, y1 - 0.06); c.quadraticCurveTo(x1, y1 + 0.18, x2, y2); c.quadraticCurveTo(x1 - 0.02, y1 + 0.02, -0.12, y1 - 0.14); c.closePath(); }, col);
      }
      const body = (c: C) => blobPath(c, [-0.3, 0.12, -0.24, 0.36, 0.02, 0.4, 0.24, 0.36, 0.32, 0.18, 0.2, -0.02, -0.04, -0.06, -0.26, -0.02]);
      p.shaded(body, HEN.feather, HEN.featherD, (c: C) => c.rect(-0.4, -0.1, 0.8, 0.12));
      p.clipTo(body, () => {
        // Fjærskjell over ryggen og noen brune prikker
        for (let i = 0; i < 9; i++) {
          const x = -0.2 + (i % 5) * 0.1 + (Math.floor(i / 5) % 2) * 0.05, y = 0.3 - Math.floor(i / 5) * 0.08;
          p.shape((c: C) => c.arc(x, y, 0.05, Math.PI * 1.1, Math.PI * 1.9), null, true, 0.01);
        }
        for (let i = 0; i < 7; i++) p.ell(-0.18 + i * 0.07, 0.12 + (i % 3) * 0.05, 0.012, 0.009, HEN.speck, false);
      });
      p.shape(body, null);
    },
  },
  head: {
    // Hals, hode, kam, nebb, kjøttlapp og et vilt, vidåpent øye
    w: 0.6, h: 0.7, ox: 0.22, oy: 0.12,
    draw: (p) => {
      p.limbs([[[0.0, 0.0, 0.04, 0.16], 0.075]], HEN.feather);
      for (const [x, y, r] of [[0.0, 0.33, 0.045], [0.06, 0.355, 0.05], [0.12, 0.34, 0.045], [0.16, 0.31, 0.035]] as const) p.ell(x, y, r, r, HEN.comb);
      p.ell(0.07, 0.22, 0.105, 0.1, HEN.feather);
      p.ell(0.04, 0.2, 0.06, 0.05, HEN.featherD, false);
      p.poly([0.15, 0.25, 0.27, 0.215, 0.15, 0.18], HEN.beak);
      p.line([0.16, 0.215, 0.24, 0.212], 0.01);
      p.blob([0.12, 0.17, 0.17, 0.16, 0.17, 0.08, 0.12, 0.09], HEN.comb);
      p.ell(0.1, 0.245, 0.04, 0.042, HEN.eye);
      p.ell(0.112, 0.25, 0.016, 0.016, INK, false);
      p.ell(0.106, 0.258, 0.006, 0.006, '#fff', false);
      p.line([0.05, 0.29, 0.14, 0.3], 0.012, shade(HEN.comb, -0.35));
    },
  },
};

export const CRITTERS: CharDef[] = [chicken];
