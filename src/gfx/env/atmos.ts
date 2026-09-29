// Atmosfære: tåkelag mellom dybdeplanene og lyssøyler gjennom trærne.
// Tåkekortene er loddrette plan med myk støy som driver med vinden. Nederste del tones ut så linjen der
// kortet møter bakken ikke synes (vi har ikke myke partikler med dybdetest).
import * as THREE from 'three';
import { plainCanvas } from '../draw';
import { wind } from '../wind';
import { qualityRank } from '../post';

const texCache = new Map<string, THREE.Texture>();

function fogTexture() {
  let t = texCache.get('fog');
  if (!t) {
    const cv = plainCanvas(512, 128, (c) => {
      c.clearRect(0, 0, 512, 128);
      // Mange myke, overlappende skyer, tettest mot midten i høyden
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 512, y = 40 + Math.random() * 60, r = 20 + Math.random() * 46;
        for (const dx of [-512, 0, 512]) {
          const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, r);
          g.addColorStop(0, 'rgba(255,255,255,0.22)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g;
          c.fillRect(x + dx - r, y - r, r * 2, r * 2);
        }
      }
    });
    t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set('fog', t);
  }
  return t;
}

function rayTexture() {
  let t = texCache.get('ray');
  if (!t) {
    const cv = plainCanvas(64, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 256);
      const h = c.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, 'rgba(0,0,0,1)');
      h.addColorStop(0.5, 'rgba(0,0,0,0)');
      h.addColorStop(1, 'rgba(0,0,0,1)');
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = h;
      c.fillRect(0, 0, 64, 256);
    });
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set('ray', t);
  }
  return t;
}

export interface FogLayer {
  z: number;
  /** Høyden på kortet (bunnen ligger på bakken). */
  h: number;
  opacity: number;
  /** Hvor fort tåken driver (ganges med vinden). */
  drift?: number;
}

/**
 * Tåkelag langs hele brettet. Farge i HDR (kan være litt over 1 for tåke som lyses opp av sola).
 * Returnerer en oppdateringsfunksjon.
 */
export function fogLayers(g: THREE.Group, length: number, color: THREE.ColorRepresentation, layers: FogLayer[]) {
  if (qualityRank() === 0) layers = layers.filter((_, i) => i % 2 === 0);
  const mats: { mat: THREE.MeshBasicMaterial; drift: number; tex: THREE.Texture }[] = [];
  for (const L of layers) {
    const tex = fogTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set((length + 120) / 40, 1);
    tex.offset.x = Math.random();
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: L.opacity, depthWrite: false, fog: true });
    // Ton ut mot bakken så skjæringslinjen ikke synes
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFogY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFogY = uv.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFogY;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= smoothstep(0.0, 0.18, vFogY);');
    };
    mat.customProgramCacheKey = () => 'fogLayer';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(length + 120, L.h), mat);
    m.position.set(length / 2, L.h / 2 - 0.05, L.z);
    m.renderOrder = 2;
    m.userData.noCast = true;
    g.add(m);
    mats.push({ mat, drift: L.drift ?? 1, tex });
  }
  return (dt: number) => {
    const s = wind.strength;
    for (const f of mats) f.tex.offset.x += dt * 0.004 * f.drift * (0.4 + s);
  };
}

/**
 * Lyssøyler fra sola gjennom trær eller vinduer. Additive plan som pulserer svakt.
 * dir = retningen strålene går (fra lyset mot bakken).
 */
export function godRays(g: THREE.Group, xs: number[], z: number, color: THREE.ColorRepresentation, lean = 0.45, height = 16, width = 2.4, strength = 0.35) {
  if (qualityRank() === 0) return () => {};
  const tex = rayTexture();
  const rays: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; ph: number; base: number }[] = [];
  for (const x of xs) {
    const w = width * (0.6 + Math.random() * 0.8);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: strength });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat);
    m.position.set(x, height / 2 - 0.5, z);
    m.rotation.z = lean;
    m.renderOrder = 3;
    m.userData.noCast = true;
    g.add(m);
    rays.push({ m, mat, ph: Math.random() * 6.28, base: strength * (0.6 + Math.random() * 0.6) });
  }
  let t = 0;
  return (dt: number) => {
    t += dt;
    for (const r of rays) r.mat.opacity = r.base * (0.7 + 0.3 * Math.sin(t * 0.6 + r.ph));
  };
}
