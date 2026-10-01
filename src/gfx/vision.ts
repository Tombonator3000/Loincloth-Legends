// Vorthax viser seg på himmelen: et kjempehode av lilla lys over brettet mens han holder tale (LevelDef.vorthax).
// Hodet er figurens eget hode (PNG-delen eller den tegnede), speilvendt så han ser mot heltene, farget lilla og
// gjennomsiktig med en lysende aura bak (additiv), som en trolldomsprojeksjon i en B-film fra 1985. Det henger foran
// skogen bak kamplinja (palisaden og kulissene i BACK dekker haken), og følger kameraet til talen er over.
import * as THREE from 'three';
import { headImage } from './rig';

/** Hvor hodet henger i forhold til kameraet: litt foran midten, over kamplinja og foran skogen. */
const AHEAD = 2.2;
const Y = 4.7;
const Z = -7.5;
const HEIGHT = 4.8;

export class Vision {
  readonly group = new THREE.Group();
  private mat: THREE.MeshBasicMaterial;
  private halo: THREE.MeshBasicMaterial;
  private tex: THREE.CanvasTexture;
  private t = 0;
  private fadeT = -1;
  /** Synligheten nå (0 til 1). Testene leser den. */
  level = 0;
  done = false;

  constructor(parent: THREE.Object3D, charId = 'vorthax', private x = 0) {
    const cv = headImage(charId, undefined, true);
    this.tex = new THREE.CanvasTexture(cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const h = HEIGHT, w = (h * cv.width) / cv.height;
    const geo = new THREE.PlaneGeometry(w, h);
    // Lilla og litt over 1, så bloom i bildepipelinen gir glød, men ansiktet synes også mot en lys himmel
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(1.15, 0.7, 1.5), fog: false });
    // En større kopi bak med additiv blanding gir en lysende aura rundt projeksjonen
    this.halo = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.1, 0.35, 1.9), fog: false });
    const face = new THREE.Mesh(geo, this.mat);
    const aura = new THREE.Mesh(geo, this.halo);
    aura.scale.setScalar(1.22);
    aura.position.z = -0.05;
    face.renderOrder = aura.renderOrder = 2;
    this.group.add(aura, face);
    this.group.position.set(x + AHEAD, Y, Z);
    parent.add(this.group);
  }

  /** Begynn å tone ut. */
  fade() {
    if (this.fadeT < 0) this.fadeT = 0;
  }

  update(dt: number, camX: number) {
    this.t += dt;
    let a = Math.min(1, this.t / 1.2);
    if (this.fadeT >= 0) {
      this.fadeT += dt;
      a *= Math.max(0, 1 - this.fadeT / 1.4);
      if (this.fadeT >= 1.4) this.done = true;
    }
    // Flimmer som et dårlig signal, og et langsomt pust
    const flick = 0.82 + 0.18 * Math.sin(this.t * 23) * Math.sin(this.t * 7.3) + (Math.sin(this.t * 61) > 0.97 ? -0.35 : 0);
    this.level = a;
    this.mat.opacity = a * flick * 0.78;
    this.halo.opacity = a * (0.3 + 0.1 * flick);
    const s = 1 + Math.sin(this.t * 1.7) * 0.025;
    this.group.scale.setScalar(s);
    this.x += (camX - this.x) * Math.min(1, dt * 1.5);
    this.group.position.set(this.x + AHEAD, Y + Math.sin(this.t * 1.1) * 0.12, Z);
  }

  dispose() {
    this.group.removeFromParent();
    (this.group.children[0] as THREE.Mesh).geometry.dispose();
    this.mat.dispose();
    this.halo.dispose();
    this.tex.dispose();
  }
}
