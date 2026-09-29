// Tegninger av kjæledyrene (vendt mot høyre). Én enkel sprite per dyr, animert med vugging og vipping.
import * as THREE from 'three';
import { unitCanvas, INK } from './draw';
import { getOverride } from './assets';

type Draw = Parameters<typeof unitCanvas>[5];
interface PetArt { w: number; h: number; draw: Draw }

const ART: Record<string, PetArt> = {
  eyeball: {
    w: 0.9, h: 0.7,
    draw: (p) => {
      for (const s of [-1, 1]) p.poly([0.12 * s, 0.05, 0.42 * s, 0.26, 0.38 * s, 0.06, 0.44 * s, -0.02, 0.2 * s, -0.04], '#5b2a86');
      p.ell(0, 0, 0.22, 0.22, '#fdf8f0');
      p.line([-0.18, 0.1, -0.1, 0.06], 0.012, '#c0202a');
      p.line([-0.16, -0.12, -0.08, -0.06], 0.012, '#c0202a');
      p.ell(0.06, 0.0, 0.1, 0.1, '#2e6fd0', false);
      p.ell(0.08, 0.0, 0.05, 0.05, INK, false);
      p.ell(0.04, 0.04, 0.02, 0.02, '#fff', false);
    },
  },
  rat: {
    w: 1.0, h: 0.5,
    draw: (p) => {
      p.shape((c) => { c.moveTo(-0.2, -0.08); c.quadraticCurveTo(-0.45, -0.18, -0.46, 0.06); }, null, true, 0.03);
      p.c.strokeStyle = '#e59aa0';
      p.blob([-0.24, -0.1, -0.2, 0.08, 0.05, 0.14, 0.26, 0.04, 0.34, -0.06, 0.14, -0.14, -0.1, -0.15], '#6b5a50');
      p.ell(0.06, 0.1, 0.06, 0.06, '#e59aa0');
      p.ell(0.24, 0.02, 0.025, 0.025, '#ff2a1a', false);
      p.ell(0.36, -0.04, 0.03, 0.03, '#e59aa0');
      p.ell(0.3, -0.1, 0.04, 0.03, '#f0f0f0', false);
      for (const x of [-0.14, 0.1]) p.line([x, -0.13, x + 0.03, -0.2], 0.03, '#e59aa0');
    },
  },
  skull: {
    w: 0.7, h: 0.8,
    draw: (p) => {
      for (let i = 0; i < 4; i++) p.ell(-0.1 + i * 0.07, -0.28 - (i % 2) * 0.04, 0.05, 0.07, i % 2 ? '#6fffc8' : '#3fcf98', false);
      p.blob([-0.2, -0.05, -0.2, 0.18, 0.0, 0.26, 0.2, 0.18, 0.22, -0.02, 0.1, -0.12, -0.08, -0.12], '#efe8d2');
      p.rrect(-0.08, -0.22, 0.2, 0.1, 0.03, '#efe8d2');
      for (const x of [-0.04, 0.02, 0.08]) p.line([x, -0.2, x, -0.14], 0.012);
      p.ell(-0.06, 0.06, 0.06, 0.06, INK, false);
      p.ell(0.11, 0.05, 0.05, 0.05, INK, false);
      p.ell(-0.06, 0.06, 0.025, 0.025, '#6fffc8', false);
      p.ell(0.11, 0.05, 0.02, 0.02, '#6fffc8', false);
      p.poly([0.02, -0.03, 0.05, -0.08, 0.08, -0.03], INK, false);
    },
  },
  chicken: {
    w: 0.8, h: 0.8,
    draw: (p) => {
      for (const x of [-0.05, 0.08]) p.limbs([[[x, -0.12, x, -0.3], 0.02]], '#f2b21e');
      p.blob([-0.26, 0.02, -0.2, 0.2, 0.06, 0.2, 0.2, 0.06, 0.1, -0.14, -0.14, -0.14], '#f3ead2');
      p.poly([-0.26, 0.08, -0.36, 0.24, -0.22, 0.16], '#f3ead2');
      p.ell(0.14, 0.2, 0.1, 0.1, '#f3ead2');
      p.poly([0.22, 0.22, 0.32, 0.18, 0.22, 0.14], '#f2b21e');
      p.ell(0.16, 0.23, 0.025, 0.025, INK, false);
      // Bitte liten hjelm
      p.shape((c) => { c.moveTo(0.04, 0.26); c.quadraticCurveTo(0.14, 0.4, 0.24, 0.26); c.closePath(); }, '#a9b3bd');
      p.poly([0.1, 0.34, 0.08, 0.44, 0.14, 0.35], '#efe2c2');
    },
  },
  dragon: {
    w: 1.1, h: 0.8,
    draw: (p) => {
      p.poly([-0.1, 0.1, -0.3, 0.4, -0.02, 0.22, 0.06, 0.34, 0.08, 0.1], '#a01818');
      p.shape((c) => { c.moveTo(-0.2, 0.0); c.quadraticCurveTo(-0.45, 0.0, -0.5, -0.14); }, null, true, 0.05);
      p.blob([-0.22, -0.06, -0.1, 0.1, 0.12, 0.08, 0.2, -0.04, 0.02, -0.14], '#d0302a');
      p.blob([0.12, 0.04, 0.2, 0.16, 0.38, 0.12, 0.4, 0.02, 0.2, -0.02], '#d0302a');
      p.ell(0.26, 0.1, 0.03, 0.03, '#ffe34a', false);
      p.poly([0.16, 0.14, 0.14, 0.26, 0.2, 0.15], '#efe2c2');
      p.ell(0.02, -0.08, 0.1, 0.04, '#f2b21e', false);
    },
  },
};

const mats = new Map<string, THREE.MeshBasicMaterial>();
/** Et plan med dyrets tegning. PNG kan erstatte den via manifestet (id: pet_<navn>, del: body). */
export function petMesh(id: string) {
  const art = ART[id] ?? ART.eyeball;
  let m = mats.get(id);
  if (!m) {
    const ov = getOverride('pet_' + id, 'body');
    const cv = ov ? ov.canvas : unitCanvas(art.w, art.h, art.w / 2, art.h / 2, 140, art.draw);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
    mats.set(id, m);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(art.w, art.h), m);
  mesh.renderOrder = 3;
  return mesh;
}
