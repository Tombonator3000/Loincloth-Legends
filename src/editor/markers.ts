// Hjelpelinjer og merker i 3D-bildet i brettverkstedet: kamplinja, lagene, bølgene (der kameraet låses), tønnene,
// sjefen og porten. Tegnes bare i editoren.
import * as THREE from 'three';
import type { LevelDef } from '../data/levels';
import { LANE_Z } from '../data/layout';

function label(text: string, color: string) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = 'rgba(12,8,4,0.78)';
  c.fillRect(0, 8, 256, 48);
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.strokeRect(1.5, 9.5, 253, 45);
  c.fillStyle = color;
  c.font = 'bold 26px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false }));
  s.scale.set(2.2, 0.55, 1);
  s.renderOrder = 20;
  return s;
}

function line(pts: THREE.Vector3[], color: string, opacity = 0.8, dashed = false) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.5, gapSize: 0.35, fog: false, depthTest: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity, fog: false, depthTest: false });
  const l = new THREE.Line(geo, mat);
  if (dashed) l.computeLineDistances();
  l.renderOrder = 19;
  return l;
}

export class Markers {
  readonly group = new THREE.Group();

  private clear() {
    for (const o of [...this.group.children]) {
      o.removeFromParent();
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material & { map?: THREE.Texture };
        mat?.map?.dispose();
        mat?.dispose?.();
      });
    }
  }

  build(level: LevelDef, selected: string | null) {
    this.clear();
    const L = level.length;
    const g = this.group;
    // Kamplinja (der figurene går) og grensene mellom lagene, på bakken
    for (const z of LANE_Z) g.add(line([new THREE.Vector3(-10, 0.03, z), new THREE.Vector3(L + 10, 0.03, z)], '#e8a640', 0.55, true));
    for (const z of [-4, 3]) g.add(line([new THREE.Vector3(-10, 0.03, z), new THREE.Vector3(L + 10, 0.03, z)], '#7aa0d0', 0.3, true));
    // Bølgene: loddrett strek der kameraet låses, med navn
    level.waves.forEach((w, i) => {
      const sel = selected === 'wave:' + i;
      const col = sel ? '#ffe28a' : '#ff8a5a';
      g.add(line([new THREE.Vector3(w.at, 0, 0), new THREE.Vector3(w.at, 5.2, 0)], col, sel ? 1 : 0.7));
      const s = label('WAVE ' + (i + 1) + ' · ' + w.spawns.length, col);
      s.position.set(w.at, 5.5, 0);
      g.add(s);
    });
    // Tønnene
    level.barrels.forEach(([x, kind], i) => {
      const sel = selected === 'barrel:' + i;
      const col = sel ? '#ffe28a' : '#c8a060';
      const s = label('BARREL: ' + String(kind).toUpperCase(), col);
      s.scale.set(1.8, 0.45, 1);
      s.position.set(x, 1.7, 0.4);
      g.add(s);
      g.add(line([new THREE.Vector3(x, 0, 0.4), new THREE.Vector3(x, 1.45, 0.4)], col, 0.8));
    });
    // Sjefen og slutten
    const end = level.finale.type === 'boss' ? 'BOSS' : level.finale.type === 'duel' ? 'DUEL GATE' : 'DAWN';
    const bx = level.finale.type === 'boss' ? L - 16 : L - 4;
    const s = label(end, '#d080ff');
    s.position.set(bx, 6, 0);
    g.add(s);
    g.add(line([new THREE.Vector3(bx, 0, 0), new THREE.Vector3(bx, 5.7, 0)], '#d080ff', 0.8));
    g.add(line([new THREE.Vector3(L, 0, -3), new THREE.Vector3(L, 0, 3)], '#d080ff', 0.8));
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}
