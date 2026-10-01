// Klassenes eget utstyr (data/classes.ts), tegnet i koden til det kommer malte bilder (ART_PROMPTS): prestens
// kølle, tyvens dolker, magikerens stav, alvens bue og bardens lutt. Delen sitter i neven som våpnene (leddet er
// origo, y peker langs våpenet), og tyven får en dolk til i den andre neven.
import * as THREE from 'three';
import { INK, shade, polyPath, unitCanvas, type Pen } from './draw';
import type { PartDef } from './chars/types';
import type { GearId } from '../data/classes';
import type { Rig } from './rig';

type C = CanvasRenderingContext2D;
const M = { wood: '#7a4f2a', woodD: '#4f3118', leather: '#5a3519', steel: '#c6ced8', steelD: '#8e98a4', gold: '#e8b83a', goldD: '#a67c1a', string: '#efe6d0', gem: '#7ad8ff' };

function dagger(p: Pen) {
  p.rrect(-0.04, -0.17, 0.08, 0.26, 0.02, M.leather);
  for (const y of [-0.1, -0.03, 0.04]) p.line([-0.04, y, 0.04, y + 0.025], 0.014);
  p.ell(0, -0.2, 0.045, 0.045, M.gold);
  p.rrect(-0.15, 0.08, 0.3, 0.06, 0.02, M.gold);
  p.shaded((c: C) => polyPath(c, [-0.055, 0.14, 0.055, 0.14, 0.04, 0.62, 0, 0.78, -0.04, 0.62]), '#e8eef4', '#a9b4c2', (c: C) => c.rect(0, 0.1, 0.1, 0.7));
  p.line([0, 0.18, 0, 0.6], 0.014, '#8e9aa8');
}

const GEAR_PARTS: Record<GearId, PartDef> = {
  mace: {
    // Kort skaft med lærgrep, og et flenset hode i messing med en sol (presten)
    w: 0.6, h: 1.6, ox: 0.3, oy: 0.34,
    draw: (p) => {
      p.rrect(-0.045, -0.3, 0.09, 1.22, 0.03, M.wood);
      for (const y of [-0.22, -0.12, -0.02, 0.08]) p.line([-0.045, y, 0.045, y + 0.035], 0.016, M.leather);
      for (const [x, d] of [[-0.18, -1], [0.18, 1]] as const) p.poly([0, 0.86, x, 0.92, x + d * 0.02, 1.1, 0, 1.18], M.gold);
      p.shaded((c: C) => c.ellipse(0, 1.0, 0.13, 0.17, 0, 0, Math.PI * 2), M.gold, M.goldD, (c: C) => c.rect(0, 0.8, 0.2, 0.4));
      p.ell(0, 1.0, 0.05, 0.05, '#fff2c0');
      p.poly([-0.03, 1.17, 0, 1.3, 0.03, 1.17], M.gold);
    },
  },
  daggers: { w: 0.4, h: 1.1, ox: 0.2, oy: 0.26, draw: dagger },
  staff: {
    // Høy, kroket stav i mørkt tre med en lysende stein i toppen
    w: 0.6, h: 2.4, ox: 0.3, oy: 0.6,
    draw: (p) => {
      p.shape((c: C) => { c.moveTo(-0.05, -0.55); c.quadraticCurveTo(0.04, 0.4, -0.02, 1.4); c.lineTo(0.06, 1.42); c.quadraticCurveTo(0.12, 0.4, 0.05, -0.55); c.closePath(); }, M.wood);
      p.line([0.0, -0.4, 0.03, 1.3], 0.012, M.woodD);
      for (const y of [-0.06, 0.08]) p.line([-0.05, y, 0.08, y + 0.03], 0.02, M.leather);
      // Klo av tre rundt steinen
      p.shape((c: C) => { c.moveTo(-0.02, 1.38); c.quadraticCurveTo(-0.2, 1.5, -0.1, 1.72); c.quadraticCurveTo(-0.08, 1.56, 0.0, 1.5); c.closePath(); }, M.wood);
      p.shape((c: C) => { c.moveTo(0.06, 1.38); c.quadraticCurveTo(0.24, 1.5, 0.14, 1.72); c.quadraticCurveTo(0.12, 1.56, 0.04, 1.5); c.closePath(); }, M.wood);
      p.ell(0.02, 1.58, 0.09, 0.1, M.gem);
      p.ell(-0.01, 1.62, 0.03, 0.035, '#ffffff', false);
    },
  },
  bow: {
    // Langbue som står loddrett foran neven, buen fram og strengen bak
    w: 0.6, h: 1.8, ox: 0.22, oy: 0.9,
    draw: (p) => {
      const limb = (c: C) => { c.moveTo(-0.02, -0.82); c.quadraticCurveTo(0.36, -0.42, 0.06, 0); c.quadraticCurveTo(0.36, 0.42, -0.02, 0.82); c.lineTo(0.04, 0.82); c.quadraticCurveTo(0.43, 0.42, 0.12, 0); c.quadraticCurveTo(0.43, -0.42, 0.04, -0.82); c.closePath(); };
      p.line([-0.01, -0.8, -0.01, 0.8], 0.012, M.string);
      p.shaded(limb, M.wood, M.woodD, (c: C) => c.rect(0.15, -0.9, 0.4, 1.8));
      p.rrect(0.02, -0.11, 0.13, 0.22, 0.03, M.leather);
    },
  },
  lute: {
    // Lutten holdes i halsen og svinges som en kølle: pæreformet kropp med lydhull ytterst
    w: 0.9, h: 2.0, ox: 0.45, oy: 0.36,
    draw: (p) => {
      p.shape((c: C) => { c.moveTo(-0.07, -0.34); c.lineTo(0.02, -0.34); c.lineTo(0.06, -0.16); c.lineTo(-0.04, -0.16); c.closePath(); }, M.woodD);
      for (const y of [-0.31, -0.26, -0.21]) p.ell(-0.06, y, 0.022, 0.018, M.gold);
      p.rrect(-0.05, -0.18, 0.1, 0.92, 0.02, M.woodD);
      for (let y = -0.1; y < 0.7; y += 0.12) p.line([-0.05, y, 0.05, y], 0.008, M.gold);
      const body = (c: C) => { c.moveTo(0, 0.66); c.bezierCurveTo(0.34, 0.74, 0.4, 1.32, 0, 1.48); c.bezierCurveTo(-0.4, 1.32, -0.34, 0.74, 0, 0.66); c.closePath(); };
      p.shaded(body, '#b07a3c', '#7a4f22', (c: C) => c.rect(0, 0.6, 0.5, 1.0));
      p.ell(0, 1.0, 0.09, 0.09, INK, false);
      p.shape((c: C) => c.arc(0, 1.0, 0.12, 0, Math.PI * 2), null, true, 0.012);
      p.rrect(-0.1, 1.24, 0.2, 0.05, 0.015, M.woodD);
      for (const x of [-0.03, -0.01, 0.01, 0.03]) p.line([x, -0.14, x * 1.6, 1.26], 0.006, shade(M.string, -0.1));
    },
  },
};

/** Delen som erstatter våpenet i neven. */
export function gearPart(g: GearId): PartDef {
  return GEAR_PARTS[g];
}

let offTex: THREE.CanvasTexture | null = null;
/**
 * Tyvens andre dolk i neven på den fjerne armen (armB). Den henger på armen, så den følger slagene og flyr med armen
 * hvis den ryker. Størrelsen følger figuren (delen tegnes i figurens eget mål).
 */
export function attachOffhand(rig: Rig) {
  const arm = rig.g.armB;
  if (!arm || arm.userData.offhand) return null;
  const pd = GEAR_PARTS.daggers;
  offTex ??= (() => {
    const t = new THREE.CanvasTexture(unitCanvas(pd.w, pd.h, pd.ox, pd.oy, 160, pd.draw));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const geo = new THREE.PlaneGeometry(pd.w, pd.h).translate(pd.w / 2 - pd.ox, pd.h / 2 - pd.oy, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: offTex, alphaTest: 0.4, side: THREE.DoubleSide }));
  const [hx, hy] = rig.joints.hand;
  m.position.set(hx, hy, -0.02);
  m.scale.setScalar(0.8);
  // Omvendt grep: bladet peker ned og litt fram når armen henger
  m.rotation.z = -Math.PI * 0.83;
  m.castShadow = true;
  arm.add(m);
  arm.userData.offhand = m;
  return m;
}
