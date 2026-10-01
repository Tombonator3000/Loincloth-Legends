// Effekter for sjefsfasene og sluttkampen (runde E, se game/boss.ts): skjoldet rundt Vorthax med en stråle fra hver
// krystall som fortsatt står, skyggen der Croakus svømmer under bakken, lava i sporene etter Magmor, solstrålen fra
// Solhjertet, kyllinglåret Hogmother spiser av, døra skjelettvaktene bærer som skjold, og buen og hornet til
// bueskytteren og kapteinen.
import * as THREE from 'three';
import { plainCanvas } from './draw';
import { canvasTex } from './env/common';
import type { Rig } from './rig';

const additive = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });

/** Et rør fra a til b (strålene i skjoldet og solstrålen). */
function stretch(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.set(1, Math.max(0.001, len), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

const SHIELD_VERT = `
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position;
  gl_Position = projectionMatrix * mv;
}`;
const SHIELD_FRAG = `
uniform vec3 uCol;
uniform float uA;
uniform float uT;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  float rim = pow(1.0 - abs(dot(vN, vV)), 2.2);
  // Sekskantmønster som glir oppover, og et bånd som går rundt
  float hex = abs(sin(vP.x * 9.0 + uT * 0.7) * sin(vP.y * 9.0 - uT * 1.3) * sin(vP.z * 9.0));
  float band = smoothstep(0.92, 1.0, sin(vP.y * 3.0 - uT * 4.0));
  float a = (rim * 0.85 + 0.06 + hex * 0.12 * rim + band * 0.25) * uA;
  gl_FragColor = vec4(uCol * (0.6 + rim * 1.6 + band), a);
}`;

/** Skjoldet til Vorthax: en kule som pulserer, og strålene fra krystallene i søylene som holder det oppe. */
export class ShieldFx {
  readonly group = new THREE.Group();
  private bubble: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private beams: THREE.Mesh[] = [];
  private beamMat = additive('#ffd36a', 0.55);
  private t = 0;
  private a = 0;

  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SHIELD_VERT, fragmentShader: SHIELD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: new THREE.Color('#ffc24a') }, uA: { value: 0 }, uT: { value: 0 } },
    });
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), this.mat);
    this.bubble.renderOrder = 5;
    this.group.add(this.bubble);
    parent.add(this.group);
  }

  /** center og radius: kula rundt sjefen. sources: krystallene som fortsatt står. on: skjoldet er oppe. */
  update(dt: number, center: THREE.Vector3, radius: number, sources: THREE.Vector3[], on: boolean) {
    this.t += dt;
    this.a += ((on ? 1 : 0) - this.a) * Math.min(1, dt * 6);
    this.mat.uniforms.uT.value = this.t;
    this.mat.uniforms.uA.value = this.a * (0.85 + Math.sin(this.t * 5) * 0.15);
    this.bubble.position.copy(center);
    this.bubble.scale.setScalar(radius * (1 + Math.sin(this.t * 3) * 0.03));
    this.bubble.visible = this.a > 0.02;
    while (this.beams.length < sources.length) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true), this.beamMat);
      m.renderOrder = 5;
      this.group.add(m);
      this.beams.push(m);
    }
    this.beams.forEach((m, i) => {
      const s = sources[i];
      m.visible = !!s && this.a > 0.05;
      if (!s) return;
      stretch(m, s, center);
      const w = 1 + Math.sin(this.t * 17 + i * 2) * 0.35;
      m.scale.x = m.scale.z = w;
    });
    this.beamMat.opacity = 0.45 + Math.sin(this.t * 23) * 0.15;
  }

  dispose() {
    this.group.removeFromParent();
    this.bubble.geometry.dispose();
    this.mat.dispose();
    for (const b of this.beams) b.geometry.dispose();
    this.beamMat.dispose();
  }
}

let rippleTex: THREE.Texture | null = null;
/** Skyggen der Croakus svømmer under bakken: en mørk flekk med ringer i vannet. */
export class DiveShadow {
  readonly mesh: THREE.Mesh;
  private ring: THREE.Mesh;
  private t = 0;
  constructor(parent: THREE.Object3D) {
    rippleTex ??= canvasTex(plainCanvas(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(10,20,8,0.95)');
      g.addColorStop(0.6, 'rgba(20,34,14,0.75)');
      g.addColorStop(1, 'rgba(20,34,14,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }), false);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshBasicMaterial({ map: rippleTex, transparent: true, depthWrite: false }));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 3;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), additive('#9ad0a0', 0.35));
    this.ring.rotation.x = -Math.PI / 2;
    this.mesh.add(this.ring);
    this.ring.rotation.x = 0;
    this.ring.position.z = 0.01;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }
  set(x: number, z: number, on: boolean, dt: number) {
    this.t += dt;
    this.mesh.visible = on;
    this.mesh.position.set(x, 0.03, z);
    const k = (this.t * 1.4) % 1;
    this.ring.scale.setScalar(0.5 + k * 0.9);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - k);
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.ring.geometry.dispose();
  }
}

let lavaTex: THREE.Texture | null = null;
/** Lava som renner i sporene etter Magmor (glødende flekker som kjølner og blir borte). */
export class LavaTrail {
  private group = new THREE.Group();
  private items: { m: THREE.Mesh; t: number; life: number }[] = [];
  private geo = new THREE.CircleGeometry(0.62, 18);
  constructor(parent: THREE.Object3D) {
    lavaTex ??= canvasTex(plainCanvas(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,240,150,1)');
      g.addColorStop(0.35, 'rgba(255,140,30,0.95)');
      g.addColorStop(0.75, 'rgba(160,30,0,0.7)');
      g.addColorStop(1, 'rgba(60,10,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }), false);
    parent.add(this.group);
  }
  add(x: number, z: number, life: number) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: lavaTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI;
    m.scale.set(1 + Math.random() * 0.3, 0.75 + Math.random() * 0.2, 1);
    m.position.set(x, 0.03, z);
    m.renderOrder = 3;
    this.group.add(m);
    this.items.push({ m, t: 0, life });
  }
  update(dt: number) {
    for (const it of this.items) {
      it.t += dt;
      const k = it.t / it.life;
      (it.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, it.t * 4) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
    }
    this.items = this.items.filter((it) => {
      if (it.t < it.life) return true;
      it.m.removeFromParent();
      (it.m.material as THREE.Material).dispose();
      return false;
    });
  }
  dispose() {
    for (const it of this.items) (it.m.material as THREE.Material).dispose();
    this.items = [];
    this.group.removeFromParent();
    this.geo.dispose();
  }
}

/** Solstrålen fra Solhjertet (Vorthax i den siste fasen): en rød stripe på gulvet som varsel, så strålen. */
export class SunBeamFx {
  private warn: THREE.Mesh;
  private beam: THREE.Mesh;
  private core: THREE.Mesh;
  constructor(parent: THREE.Object3D) {
    this.warn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), additive('#ff2a1a', 0.35));
    this.warn.rotation.x = -Math.PI / 2;
    this.warn.renderOrder = 4;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1, 12, 1, true), additive('#ffb030', 0.55));
    this.core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 8, 1, true), additive('#fff6d0', 0.9));
    this.beam.renderOrder = this.core.renderOrder = 6;
    this.warn.visible = this.beam.visible = this.core.visible = false;
    parent.add(this.warn, this.beam, this.core);
  }
  /** Varselet: stripa langs strålen (x0 til x1 i høyden z), k fra 0 til 1 blinker sterkere. */
  telegraph(x0: number, x1: number, z: number, k: number) {
    this.warn.visible = true;
    this.warn.position.set((x0 + x1) / 2, 0.04, z);
    this.warn.scale.set(Math.abs(x1 - x0), 1.1, 1);
    (this.warn.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.4 * k * (0.6 + 0.4 * Math.sin(k * 40));
  }
  /** Strålen fra a til b, k: 0 til 1 i styrke. */
  fire(a: THREE.Vector3, b: THREE.Vector3, k: number) {
    this.warn.visible = false;
    this.beam.visible = this.core.visible = k > 0.01;
    stretch(this.beam, a, b);
    stretch(this.core, a, b);
    this.beam.scale.x = this.beam.scale.z = 0.6 + k * 0.6;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.55 * k;
    (this.core.material as THREE.MeshBasicMaterial).opacity = 0.9 * k;
  }
  hide() {
    this.warn.visible = this.beam.visible = this.core.visible = false;
  }
  dispose() {
    for (const m of [this.warn, this.beam, this.core]) {
      m.removeFromParent();
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}

/** Kyllinglåret Hogmother spiser av: legges i neven (våpenarmen) mens hun spiser. */
export function drumstick() {
  const g = new THREE.Group();
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#efe6c8', roughness: 0.6 }));
  bone.position.y = 0.05;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bone.material);
  knob.position.y = -0.22;
  const meat = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#a8561c', roughness: 0.55 }));
  meat.scale.set(1, 1.35, 1);
  meat.position.y = 0.38;
  g.add(bone, knob, meat);
  return g;
}

/** Legg kyllinglåret i neven på figuren. Returnerer en funksjon som tar det bort igjen. */
export function holdInHand(rig: Rig, obj: THREE.Object3D) {
  const arm = rig.g.armF;
  if (!arm) return () => {};
  const [hx, hy] = rig.joints.hand;
  obj.position.set(hx, hy, 0.06);
  obj.rotation.z = Math.PI * 0.8;
  arm.add(obj);
  return () => obj.removeFromParent();
}

let doorTex: THREE.Texture | null = null;
/**
 * Døra skjelettvaktene bærer som skjold: planker, jernbeslag, en ring og en liten luke med sprosser. Sitter foran
 * kroppen og er vridd mot fienden, så den sees på skrå.
 */
export function attachDoor(rig: Rig) {
  doorTex ??= canvasTex(plainCanvas(128, 224, (c) => {
    c.fillStyle = '#5a3a20';
    c.fillRect(0, 0, 128, 224);
    for (let x = 0; x < 128; x += 26) {
      c.fillStyle = x % 52 ? '#6a4626' : '#56381e';
      c.fillRect(x + 1, 0, 24, 224);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(x, 0, 2, 224);
    }
    c.fillStyle = '#3a3a40';
    for (const y of [26, 196]) c.fillRect(0, y, 128, 14);
    c.fillStyle = '#9a9aa4';
    for (const y of [33, 203]) for (let x = 10; x < 128; x += 26) c.fillRect(x, y - 3, 5, 5);
    // Luka med sprosser
    c.fillStyle = '#140c08';
    c.fillRect(42, 62, 44, 34);
    c.fillStyle = '#5a5a64';
    for (let x = 50; x < 86; x += 10) c.fillRect(x, 62, 4, 34);
    // Ringen
    c.strokeStyle = '#b8a060';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(98, 128, 10, 0, Math.PI * 2);
    c.stroke();
  }), false);
  const h = 1.25, w = 0.62;
  const door = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [
    new THREE.MeshStandardMaterial({ color: '#4a3018', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#4a3018', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#4a3018', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#4a3018', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.85 }),
  ]);
  door.castShadow = true;
  // Foran kroppen på den siden han ser mot, vridd så forsiden vender mot fienden og kameraet ser den på skrå
  door.position.set(0.3, 0.12, 0.08);
  door.rotation.y = -0.95;
  door.rotation.z = -0.06;
  rig.body.add(door);
  return door;
}

/**
 * Buen til bueskytteren (runde E): en bue av tre med streng i den fremre hånda (armB). Våpenarmen sitter bak på kroppen
 * og når bare midt på brystet, så den trekker strengen, og våpenet figuren har, skjules. Grepet sitter i hånda, og
 * tuppene ligger litt bak grepet, som på en spent bue. Buen holdes loddrett (keepBowUpright).
 */
export function attachBow(rig: Rig) {
  const arm = rig.g.armB;
  if (!arm) return null;
  if (rig.g.weapon) rig.g.weapon.visible = false;
  const r = 0.75, half = 0.62;
  const bow = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 6, 20, half * 2), new THREE.MeshStandardMaterial({ color: '#7a4a22', roughness: 0.75 }));
  // Midten av buen mot -y i armen (framover når armen er strukket fram), med grepet i hånda
  wood.rotation.z = -Math.PI / 2 - half;
  wood.position.y = r;
  wood.castShadow = true;
  const len = 2 * r * Math.sin(half);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 4), new THREE.MeshBasicMaterial({ color: '#efe6d2' }));
  string.rotation.z = Math.PI / 2;
  string.position.y = r - r * Math.cos(half);
  // Lærbånd rundt grepet
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), new THREE.MeshStandardMaterial({ color: '#3a2414', roughness: 0.9 }));
  grip.rotation.z = Math.PI / 2;
  bow.add(wood, string, grip);
  const [hx, hy] = rig.joints.hand;
  bow.position.set(hx, hy, 0.07);
  arm.add(bow);
  return bow;
}

/** Buen står loddrett med buen framover uansett hvordan armen og kroppen er vridd (kalles hvert bilde). */
export function keepBowUpright(rig: Rig, bow: THREE.Object3D) {
  bow.rotation.z = Math.PI / 2 - rig.pose.armB - rig.pose.torso;
}

/**
 * Hornet kapteinen blåser i (runde E): et messinghorn i munnen, som peker framover og opp. Det sitter på hodet og er
 * skjult til han blåser (Foe viser det under angrepet horn).
 */
export function attachHorn(rig: Rig) {
  const head = rig.g.head;
  if (!head) return null;
  const brass = new THREE.MeshStandardMaterial({ color: '#d8b048', metalness: 0.6, roughness: 0.3 });
  const horn = new THREE.Group();
  const axis = new THREE.Vector3(0.87, 0.5, 0);
  const len = 0.5;
  // Kjeglen har spissen (munnstykket) opp i y: snus så spissen er i munnen og munningen peker langs axis
  const tube = new THREE.Mesh(new THREE.ConeGeometry(0.11, len, 14, 1, true), brass);
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis);
  tube.position.copy(axis).multiplyScalar(len / 2);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 16), brass);
  rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
  rim.position.copy(axis).multiplyScalar(len);
  horn.add(tube, rim);
  horn.position.set(0.2, 0.3, 0.08);
  horn.visible = false;
  head.add(horn);
  return horn;
}
