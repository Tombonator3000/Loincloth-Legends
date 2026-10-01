// Atmosfære: tåkelag mellom dybdeplanene og lyssøyler gjennom trærne.
// Tåkekortene er loddrette plan med myk støy som driver med vinden. Nederste del tones ut så linjen der
// kortet møter bakken ikke synes (vi har ikke myke partikler med dybdetest).
import * as THREE from 'three';
import { random, seeded } from '../../core/math';
import { plainCanvas } from '../draw';
import { wind } from '../wind';
import { qualityRank } from '../post';
import { NOISE } from '../vfx';

const texCache = new Map<string, THREE.Texture>();

function fogTexture() {
  let t = texCache.get('fog');
  if (!t) {
    // Eget frø: teksturbufferen må ikke spise av brettets frø bare første gang et biom bygges.
    const r = seeded(0x6d697374);
    const cv = plainCanvas(512, 128, (c) => {
      c.clearRect(0, 0, 512, 128);
      // Mange myke, overlappende skyer, tettest mot midten i høyden
      for (let i = 0; i < 90; i++) {
        const x = r() * 512, y = 40 + r() * 60, radius = 20 + r() * 46;
        for (const dx of [-512, 0, 512]) {
          const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, radius);
          g.addColorStop(0, 'rgba(255,255,255,0.22)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g;
          c.fillRect(x + dx - radius, y - radius, radius * 2, radius * 2);
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
  const detail = qualityRank() >= 2;
  const time = { value: 0 };
  const velocity = new THREE.Vector3();
  const mats: { mat: THREE.MeshBasicMaterial; drift: number; tex: THREE.Texture }[] = [];
  for (const L of layers) {
    const tex = fogTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set((length + 120) / 40, 1);
    tex.offset.x = random();
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: L.opacity, depthWrite: false, fog: true });
    const phase = { value: tex.offset.x };
    // Ton ut mot bakken så skjæringslinjen ikke synes
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMistTime = time;
      sh.uniforms.uMistPhase = phase;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFogY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFogY = uv.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFogY;\nuniform float uMistTime;\nuniform float uMistPhase;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.a *= smoothstep(0.0, 0.18, vFogY) * (1.0 - smoothstep(0.82, 1.0, vFogY));
          ${detail ? `
          // En grovere strøm driver gjennom hovedlaget. Samme tekstur, ingen ekstra tåkekort.
          vec2 flowUV = vec2(vMapUv.x * 0.41 + uMistPhase - uMistTime * 0.0015, vMapUv.y * 0.92 + 0.04);
          diffuseColor.a *= 0.85 + 0.35 * texture2D(map, flowUV).a;
          ` : ''}`);
    };
    mat.customProgramCacheKey = () => 'fogLayer:flow:' + detail;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(length + 120, L.h), mat);
    m.position.set(length / 2, L.h / 2 - 0.05, L.z);
    m.renderOrder = 2;
    m.userData.noCast = true;
    m.name = 'atmosphere-mist';
    g.add(m);
    mats.push({ mat, drift: L.drift ?? 1, tex });
  }
  return (dt: number) => {
    if (dt <= 0) return;
    time.value += dt;
    wind.velocity(length / 2, -8, velocity);
    // Teksturforskyvningen går motsatt av den synlige driften. Fortegnet følger biomets vind.
    for (const f of mats) f.tex.offset.x -= dt * 0.003 * f.drift * velocity.x;
  };
}

/**
 * Lyssøyler fra sola gjennom trær eller vinduer. Additive plan som pulserer svakt.
 * dir = retningen strålene går (fra lyset mot bakken).
 */
export function godRays(g: THREE.Group, xs: number[], z: number, color: THREE.ColorRepresentation, lean = 0.45, height = 16, width = 2.4, strength = 0.35) {
  if (qualityRank() === 0) return () => {};
  const tex = rayTexture();
  const time = { value: 0 };
  const rays: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; ph: number; base: number }[] = [];
  for (const x of xs) {
    const w = width * (0.6 + random() * 0.8);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: strength });
    const phase = { value: random() * Math.PI * 2 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRayTime = time;
      sh.uniforms.uRayPhase = phase;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRayUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRayUv = uv;\ntransformed.x *= mix(1.0, 0.5, uv.y);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec2 vRayUv;\nuniform float uRayTime;\nuniform float uRayPhase;\n${NOISE}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          // Svak, langsom oppbrytning fra trekroner og støv; ingen harde striper over kampbeltet.
          float fleck = vn(vRayUv * vec2(3.5, 7.0) + vec2(uRayPhase, uRayTime * 0.12));
          diffuseColor.a *= 0.7 + 0.6 * fleck;
        `);
    };
    mat.customProgramCacheKey = () => 'godRay:canopy';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat);
    m.position.set(x, height / 2 - 0.5, z);
    m.rotation.z = lean;
    m.renderOrder = 3;
    m.userData.noCast = true;
    m.name = 'atmosphere-ray';
    g.add(m);
    rays.push({ m, mat, ph: phase.value, base: strength * (0.6 + random() * 0.6) });
  }
  let t = 0;
  return (dt: number) => {
    if (dt <= 0) return;
    t += dt;
    time.value = t;
    for (const r of rays) r.mat.opacity = r.base * (0.7 + 0.3 * Math.sin(t * 0.6 + r.ph));
  };
}
