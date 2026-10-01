// Grafikk til magien (game/spells.ts): oljepytter som kan brenne, lysende piler, fjær som daler, og lysstråler.
import * as THREE from 'three';
import { plainCanvas } from './draw';
import { seeded } from '../core/math';

// ---------------------------------------------------------------- olje
const oilCache: THREE.CanvasTexture[] = [];
/**
 * Oljepytt sett ovenfra (tre varianter): en ujevn, nesten svart klatt med myk kant, regnbuehinne i striper og
 * noen blanke prikker. Glansen kommer fra materialet (lav ruhet speiler himmelen).
 */
function oilTexture(i: number) {
  return (oilCache[i] ??= (() => {
    const cv = plainCanvas(256, 256, (c) => {
      const r = seeded(91 + i * 17);
      const cx = 128, cy = 128, pts: [number, number][] = [];
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2, rr = 92 + r() * 26 + (k % 5 === 0 ? 14 : 0);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      const path = () => {
        c.beginPath();
        pts.forEach(([x, y], k) => {
          const [nx, ny] = pts[(k + 1) % pts.length];
          if (!k) c.moveTo((x + nx) / 2, (y + ny) / 2);
          else c.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
        });
        const [x0, y0] = pts[0], [x1, y1] = pts[1];
        c.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        c.closePath();
      };
      // Myk kant: samme form litt utvisket under
      c.filter = 'blur(6px)';
      path();
      c.fillStyle = 'rgba(14,10,6,0.85)';
      c.fill();
      c.filter = 'none';
      path();
      const g = c.createRadialGradient(cx, cy, 10, cx, cy, 120);
      g.addColorStop(0, '#0c0905');
      g.addColorStop(0.7, '#17110a');
      g.addColorStop(1, '#2a1d0e');
      c.fillStyle = g;
      c.fill();
      c.save();
      path();
      c.clip();
      // Regnbuehinna: tynne, bølgete bånd i skiftende farge
      c.globalCompositeOperation = 'screen';
      for (let k = 0; k < 7; k++) {
        const y0 = 40 + r() * 170, amp = 8 + r() * 14, hue = (k * 53 + r() * 40) % 360;
        c.strokeStyle = `hsla(${hue},80%,55%,${0.12 + r() * 0.1})`;
        c.lineWidth = 4 + r() * 8;
        c.beginPath();
        for (let x = 0; x <= 256; x += 8) {
          const y = y0 + Math.sin(x * 0.035 + k) * amp;
          if (!x) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 10; k++) {
        c.fillStyle = `rgba(255,250,235,${0.2 + r() * 0.35})`;
        c.beginPath();
        c.ellipse(50 + r() * 156, 50 + r() * 156, 1.5 + r() * 3, 1 + r() * 2, r() * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  })());
}

let oilGeo: THREE.PlaneGeometry | null = null;
const SCORCH = new THREE.Color('#2a2420');
const EMBER = new THREE.Color('#ff6a1a');

export interface OilPuddle {
  mesh: THREE.Mesh;
  /** 0 er olje, 1 brenner for fullt (gløder under flammene). */
  burn(k: number): void;
  /** Etter brannen: svidd og matt. */
  scorch(): void;
  /** 1 er synlig, 0 borte. */
  fade(a: number): void;
  dispose(): void;
}

/** En oljepytt med radius r (m) langs x og r * 0.75 i dybden, rett over bakken. */
export function oilPuddle(r: number, variant: number): OilPuddle {
  oilGeo ??= new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  // Blank lakk (clearcoat) som speiler himmelen, og en tynn hinne (iridescence) som gir regnbuefargene i olja
  const mat = new THREE.MeshPhysicalMaterial({
    map: oilTexture(variant % 3), transparent: true, depthWrite: false, roughness: 0.18, metalness: 0.0,
    clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520],
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, emissive: new THREE.Color(0), envMapIntensity: 2.6,
  });
  const mesh = new THREE.Mesh(oilGeo, mat);
  mesh.scale.set(r, 1, r * 0.75);
  mesh.position.y = 0.022;
  mesh.rotation.y = variant * 1.3;
  mesh.renderOrder = 1;
  mesh.receiveShadow = true;
  return {
    mesh,
    burn(k) {
      mat.emissive.copy(EMBER).multiplyScalar(k * 0.9);
      mat.roughness = 0.18 + k * 0.5;
      mat.iridescence = 1 - k;
    },
    scorch() {
      mat.color.copy(SCORCH);
      mat.emissive.setScalar(0);
      mat.roughness = 0.95;
      mat.clearcoat = 0;
      mat.iridescence = 0;
    },
    fade(a) {
      mat.opacity = a;
    },
    dispose() {
      mesh.removeFromParent();
      mat.dispose();
    },
  };
}

// ---------------------------------------------------------------- lysende piler
let dartMat: THREE.MeshBasicMaterial | null = null;
let dartGeo: THREE.PlaneGeometry | null = null;
/** En lysende pil: hvit kjerne og fiolett glød, strukket langs farten (snus med rotation.z). */
export function dartMesh() {
  dartMat ??= (() => {
    const cv = plainCanvas(128, 32, (c) => {
      const g = c.createRadialGradient(96, 16, 1, 80, 16, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.18, 'rgba(240,190,255,0.95)');
      g.addColorStop(0.5, 'rgba(190,80,255,0.45)');
      g.addColorStop(1, 'rgba(120,20,200,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(70, 16, 58, 13, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.beginPath();
      c.ellipse(98, 16, 16, 4, 0, 0, Math.PI * 2);
      c.fill();
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(3.2, 2.3, 3.6), toneMapped: false });
  })();
  dartGeo ??= new THREE.PlaneGeometry(0.95, 0.26);
  const m = new THREE.Mesh(dartGeo, dartMat);
  m.renderOrder = 8;
  return m;
}

// ---------------------------------------------------------------- fjær
const featherMats: THREE.MeshBasicMaterial[] = [];
let featherGeo: THREE.PlaneGeometry | null = null;
/** To fjær: en hvit og en lys med brune flekker. Ror (stilken) langs midten og en fillete fane. */
function featherMat(i: number) {
  return (featherMats[i] ??= (() => {
    const cv = plainCanvas(96, 32, (c) => {
      const body = i ? '#e8d7b0' : '#f6f0e2';
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(6, 16);
      c.quadraticCurveTo(40, 2, 88, 12);
      c.quadraticCurveTo(92, 16, 88, 20);
      c.quadraticCurveTo(40, 30, 6, 16);
      c.fill();
      // Hakk i fanen
      c.globalCompositeOperation = 'destination-out';
      for (const x of [30, 52, 70]) {
        c.beginPath();
        c.moveTo(x, i ? 4 : 28);
        c.lineTo(x + 6, 16);
        c.lineTo(x + 2, i ? 4 : 28);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      if (i) {
        c.fillStyle = 'rgba(150,100,50,0.6)';
        for (const [x, y] of [[40, 12], [58, 19], [72, 13]]) {
          c.beginPath();
          c.ellipse(x, y, 4, 2, 0.2, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.strokeStyle = 'rgba(120,100,70,0.9)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(2, 16);
      c.quadraticCurveTo(46, 13, 90, 16);
      c.stroke();
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false });
  })());
}

interface Feather { mesh: THREE.Mesh; vel: THREE.Vector3; t: number; life: number; phase: number; size: number; rest: boolean }

/** Fjær som daler sakte og pendler fra side til side, blir liggende og krymper bort til slutt. */
export class Feathers {
  readonly group = new THREE.Group();
  private list: Feather[] = [];
  static MAX = 220;

  /** n fjær fra pos, ut og opp (speed m/s), size gir størrelsen (1 er en høne). */
  burst(pos: THREE.Vector3, n: number, speed = 4, size = 1) {
    featherGeo ??= new THREE.PlaneGeometry(0.36, 0.12);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= Feathers.MAX) this.drop(this.list[0]);
      const m = new THREE.Mesh(featherGeo, featherMat(i % 3 === 0 ? 1 : 0));
      const a = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random() * 0.75);
      const s = size * (0.8 + Math.random() * 0.5);
      m.scale.setScalar(s);
      m.position.set(pos.x + (Math.random() - 0.5) * 0.3 * size, pos.y + (Math.random() - 0.5) * 0.3 * size, pos.z + (Math.random() - 0.5) * 0.3);
      this.group.add(m);
      this.list.push({ mesh: m, vel: new THREE.Vector3(Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp + 1.5, (Math.random() - 0.5) * sp * 0.4), t: 0, life: 3.2 + Math.random() * 2.2, phase: Math.random() * 6.28, size: s, rest: false });
    }
  }

  get count() {
    return this.list.length;
  }

  update(dt: number) {
    for (const f of this.list) {
      f.t += dt;
      const m = f.mesh;
      if (!f.rest) {
        // Luftmotstand: farten dør fort ut, og så daler fjæra med en pendel fra side til side
        const drag = Math.exp(-3.2 * dt);
        f.vel.x *= drag;
        f.vel.z *= drag;
        f.vel.y = Math.max(f.vel.y * drag - 7 * dt, -0.55);
        const sway = Math.sin(f.t * 3.4 + f.phase);
        m.position.x += (f.vel.x + sway * 0.55) * dt;
        m.position.y += f.vel.y * dt;
        m.position.z += f.vel.z * dt;
        m.rotation.z = sway * 0.7 + f.phase;
        m.rotation.x = Math.cos(f.t * 2.1 + f.phase) * 0.6;
        if (m.position.y <= 0.02) {
          m.position.y = 0.02;
          m.rotation.x = -Math.PI / 2;
          f.rest = true;
        }
      }
      const left = f.life - f.t;
      if (left < 0.6) m.scale.setScalar(f.size * Math.max(0, left / 0.6));
    }
    for (const f of this.list.filter((x) => x.t >= x.life)) this.drop(f);
  }

  private drop(f: Feather) {
    f.mesh.removeFromParent();
    const i = this.list.indexOf(f);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    for (const f of [...this.list]) this.drop(f);
  }
}

// ---------------------------------------------------------------- lysstråler
let beamMat: THREE.ShaderMaterial | null = null;
let beamGeo: THREE.PlaneGeometry | null = null;
interface Beam { mesh: THREE.Mesh; t: number; life: number; mat: THREE.ShaderMaterial }

/** Lysstråler fra himmelen (TURN UNDEAD): en høy, myk søyle som blusser opp og tones ut. */
export class Beams {
  readonly group = new THREE.Group();
  private list: Beam[] = [];

  add(pos: THREE.Vector3, width: number, height: number, color: THREE.ColorRepresentation, life = 1.2) {
    beamGeo ??= new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    beamMat ??= new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec2 vUv;
        void main(){
          float side = 1.0 - abs(vUv.x * 2.0 - 1.0);
          float core = pow(side, 2.5) + 0.6 * pow(side, 12.0);
          float fadeY = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
          gl_FragColor = vec4(uCol * core * fadeY * uA, 1.0);
        }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const mat = beamMat.clone();
    (mat.uniforms.uCol.value as THREE.Color).set(color).multiplyScalar(2.2);
    const m = new THREE.Mesh(beamGeo, mat);
    m.position.copy(pos);
    m.scale.set(width, height, 1);
    m.renderOrder = 8;
    this.group.add(m);
    this.list.push({ mesh: m, t: 0, life, mat });
  }

  update(dt: number) {
    for (const b of this.list) {
      b.t += dt;
      const k = b.t / b.life;
      // Blusser opp fort, står litt, og tones ut
      b.mat.uniforms.uA.value = Math.min(1, b.t * 8) * (1 - Math.max(0, (k - 0.4) / 0.6));
      b.mesh.scale.x *= 1 + dt * 0.3;
    }
    for (const b of this.list.filter((x) => x.t >= x.life)) {
      b.mesh.removeFromParent();
      b.mat.dispose();
      this.list.splice(this.list.indexOf(b), 1);
    }
  }

  clear() {
    for (const b of this.list) {
      b.mesh.removeFromParent();
      b.mat.dispose();
    }
    this.list.length = 0;
  }
}
