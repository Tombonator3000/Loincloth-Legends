// Grafikk til teit vold på brettene (game/mayhem.ts): paraplyen gnomen slår opp i blodregnet.
import * as THREE from 'three';
import type { Rig } from './rig';

/** Paraplyen: åtte stoffpaneler i rødt og beige, tupper på spilene, stang og et krokhåndtak av tre. */
export interface Umbrella {
  group: THREE.Group;
  /** 0 er lukket (smal og lang langs stanga), 1 er slått helt opp. */
  open(k: number): void;
  dispose(): void;
}

/** Stanga (m), og radien på duken når den er oppe (m). Gnomen er rundt 1,1 m høy, så paraplyen er stor for ham. */
const SHAFT = 1.1;
const SPAN = 0.68;

export function umbrella(): Umbrella {
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.Material>(m: T) => (mats.push(m), m);
  const geo = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);

  // Duken: en flat kuppel der hver trekant får fargen til panelet den ligger i, så skillene er skarpe
  const cap = geo(new THREE.SphereGeometry(1, 32, 6, 0, Math.PI * 2, 0, Math.PI * 0.34).toNonIndexed());
  const pos = cap.getAttribute('position') as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const red = new THREE.Color('#9a1420'), cream = new THREE.Color('#e8dcc0');
  for (let i = 0; i < pos.count; i += 3) {
    let x = 0, z = 0;
    for (let k = 0; k < 3; k++) {
      x += pos.getX(i + k);
      z += pos.getZ(i + k);
    }
    const a = Math.atan2(z, x) + Math.PI;
    const c = Math.floor(a / (Math.PI / 4)) % 2 ? cream : red;
    for (let k = 0; k < 3; k++) c.toArray(cols, (i + k) * 3);
  }
  cap.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  cap.computeVertexNormals();
  // Toppen av kuppelen i origo, så den kan skaleres rundt toppen av stanga
  cap.translate(0, -1, 0);
  const canopy = new THREE.Group();
  canopy.position.y = SHAFT;
  const cloth = new THREE.Mesh(cap, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide })));
  cloth.castShadow = true;
  canopy.add(cloth);
  // Tuppene på spilene langs kanten
  const tipMat = keep(new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.5, roughness: 0.4 }));
  const tipGeo = geo(new THREE.SphereGeometry(0.035, 6, 4));
  const rimY = Math.cos(Math.PI * 0.34) - 1, rimR = Math.sin(Math.PI * 0.34);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(Math.cos(a) * rimR, rimY, Math.sin(a) * rimR);
    canopy.add(tip);
  }
  group.add(canopy);

  const shaft = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.018, 0.018, SHAFT, 6)), tipMat);
  shaft.position.y = SHAFT / 2;
  const spike = new THREE.Mesh(geo(new THREE.ConeGeometry(0.022, 0.1, 6)), tipMat);
  spike.position.y = SHAFT + 0.05;
  // Krokhåndtaket i hånda
  const hook = new THREE.Mesh(geo(new THREE.TorusGeometry(0.07, 0.02, 6, 12, Math.PI)), keep(new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.6 })));
  hook.rotation.z = Math.PI;
  hook.position.set(0.07, 0, 0);
  group.add(shaft, spike, hook);

  const open = (k: number) => {
    k = Math.max(0, Math.min(1, k));
    // Lukket ligger duken tett inntil stanga og er lengre, åpen er den flat og bred
    const w = SPAN * (0.1 + 0.9 * k);
    canopy.scale.set(w, SPAN * (0.55 + (1 - k) * 1.1), w);
  };
  open(0);
  return {
    group,
    open,
    dispose() {
      group.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}

/**
 * Legg paraplyen i hånda på armen foran kroppen (armB). Størrelsen er i meter uansett hvor stor figuren er, og
 * keepUmbrellaUp holder den loddrett hvert bilde.
 */
export function holdUmbrella(rig: Rig, u: Umbrella) {
  const arm = rig.g.armB;
  if (!arm) return;
  const [hx, hy] = rig.joints.hand;
  u.group.position.set(hx, hy, 0.08);
  u.group.scale.setScalar(1 / rig.scale);
  arm.add(u.group);
}

/** Stanga står loddrett uansett hvordan armen og kroppen er vridd (kalles hvert bilde). */
export function keepUmbrellaUp(rig: Rig, u: Umbrella) {
  u.group.rotation.z = -(rig.pose.armB + rig.pose.torso + rig.pose.tilt);
}
