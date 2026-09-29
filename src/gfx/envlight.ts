// Himmelen som lyskilde: himmelkula (og sola eller månen) tegnes inn i et PMREM-kart som blir scene.environment.
// Da får alle PBR-materialer omgivelseslys og refleksjoner fra himmelen: blankt metall, vått blod og våte
// steiner speiler himmelen, og skyggesidene får himmelens farge i stedet for en flat halvkulefarge.
import * as THREE from 'three';

let pmrem: THREE.PMREMGenerator | null = null;
let current: THREE.WebGLRenderTarget | null = null;

/**
 * Lag miljøkart fra alt i scenen som er merket userData.sky. Bakken under er en mørk halvkule i fargen til
 * halvkulelyset nedenfra. intensity balanserer mot halvkulelyset som allerede finnes i miljøene.
 */
export function skyLight(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.4) {
  current?.dispose();
  current = null;
  scene.environment = null;
  const sky: THREE.Object3D[] = [];
  let hemi: THREE.HemisphereLight | null = null;
  scene.traverse((o) => {
    if (o.userData.sky) sky.push(o);
    if ((o as THREE.HemisphereLight).isHemisphereLight && !hemi) hemi = o as THREE.HemisphereLight;
  });
  if (!sky.length) return;
  const s = new THREE.Scene();
  if (scene.background instanceof THREE.Color) s.background = scene.background.clone();
  for (const o of sky) {
    const c = o.clone();
    o.updateWorldMatrix(true, false);
    c.applyMatrix4(o.parent ? o.parent.matrixWorld : new THREE.Matrix4());
    s.add(c);
  }
  const h = hemi as THREE.HemisphereLight | null;
  const ground = h ? h.groundColor.clone().multiplyScalar(Math.min(1.5, h.intensity) * 0.6) : new THREE.Color(0.05, 0.04, 0.03);
  const floor = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ground, side: THREE.BackSide }),
  );
  s.add(floor);
  pmrem ??= new THREE.PMREMGenerator(renderer);
  current = pmrem.fromScene(s, 0.04, 0.1, 5000);
  floor.geometry.dispose();
  (floor.material as THREE.Material).dispose();
  scene.environment = current.texture;
  scene.environmentIntensity = intensity;
}
