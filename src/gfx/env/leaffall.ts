// Blader som faller fra kronene og driver med vinden, og løv som ligger på bakken.
// Bladene simuleres på CPU (få nok til at det er billig) og tegnes som én instansert mesh.
import * as THREE from 'three';
import { random, seeded } from '../../core/math';
import { wind } from '../wind';
import { singleLeafTexture } from './trees';
import { qualityRank } from '../post';

interface Leaf {
  p: THREE.Vector3;
  v: THREE.Vector3;
  axis: THREE.Vector3;
  ang: number;
  spin: number;
  phase: number;
  size: number;
  life: number;
  age: number;
  landed: number;
  col: number;
}

const QCOUNT = [30, 70, 130, 220];

export interface LeafFallOpts {
  palette: string[];
  /** Område der bladene slippes, relativt til kameraet i x: [yMin, yMax, zMin, zMax]. */
  area: [number, number, number, number];
  /** Løv som ligger på bakken: antall per meter brett. */
  litter?: number;
  length?: number;
  /** Snø i stedet for blader (hvit, ingen rotasjon mot bakken). */
  size?: number;
}

function leafMaterial() {
  return new THREE.MeshLambertMaterial({ map: singleLeafTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
}

export class LeafFall {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private leaves: Leaf[] = [];
  private free: Leaf[] = [];
  private max: number;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private w = new THREE.Vector3();
  private cols: THREE.Color[];
  private acc = 0;
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private initialized = false;
  private lastCamX = 0;
  private rng = seeded(Math.floor(random() * 0x100000000));

  constructor(private o: LeafFallOpts) {
    this.max = QCOUNT[qualityRank()];
    this.cols = o.palette.map((c) => new THREE.Color(c));
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMaterial(), this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
    this.mesh.userData.noCast = true;
    this.mesh.name = 'falling-leaves';
    this.mesh.setColorAt(0, this.cols[0]);
    this.group.add(this.mesh);
    // Vektorer og partikler gjenbrukes hele brettets levetid, også etter kamerahopp i editoren.
    for (let i = 0; i < this.max; i++) this.free.push({
      p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(),
      ang: 0, spin: 0, phase: 0, size: 0, life: 0, age: 0, landed: 0, col: 0,
    });
    if (o.litter && o.length) this.group.add(this.litter(o.litter, o.length));
  }

  /** Løv på bakken langs hele brettet (statisk, én instansert mesh). */
  private litter(perMeter: number, length: number) {
    const n = Math.round(perMeter * (length + 40) * [0.3, 0.6, 1, 1.4][qualityRank()]);
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMaterial(), n);
    const e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const x = -20 + random() * (length + 40);
      // Mest langs veikantene og under trærne, litt på veien
      const r = random();
      const z = r < 0.15 ? -4 + random() * 8 : r < 0.55 ? 4 + random() * 4 : -12 + random() * 8;
      e.set(-Math.PI / 2 + (random() - 0.5) * 0.5, random() * Math.PI * 2, 0, 'YXZ');
      this.q.setFromEuler(e);
      const s = 0.14 + random() * 0.12;
      this.m.compose(this.w.set(x, 0.015 + random() * 0.01, z), this.q, this.s.set(s, s, s));
      im.setMatrixAt(i, this.m);
      im.setColorAt(i, this.cols[Math.floor(random() * this.cols.length)].clone().multiplyScalar(0.7 + random() * 0.3));
    }
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    im.userData.noCast = true;
    im.computeBoundingSphere();
    return im;
  }

  private spawn(camX: number, warm = false) {
    const f = this.free.pop();
    if (!f) return;
    const [y0, y1, z0, z1] = this.o.area;
    const r = this.rng;
    f.p.set(camX + (r() - 0.5) * 34, warm ? 0.3 + r() * (y1 - 0.3) : y0 + r() * (y1 - y0), z0 + r() * (z1 - z0));
    f.v.set(0, -0.4, 0);
    f.axis.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    f.ang = r() * Math.PI * 2;
    f.spin = (1.5 + r() * 3) * (r() < 0.5 ? -1 : 1);
    f.phase = r() * Math.PI * 2;
    f.size = (this.o.size ?? 0.2) * (0.8 + r() * 0.5);
    f.life = warm ? 6 + r() * 8 : 14;
    f.age = warm ? 1 : 0;
    f.landed = 0;
    f.col = Math.floor(r() * this.cols.length);
    this.leaves.push(f);
  }

  update(dt: number, camX: number) {
    if (dt <= 0) return;
    if (!this.initialized || Math.abs(camX - this.lastCamX) > 24) {
      while (this.leaves.length) this.free.push(this.leaves.pop()!);
      this.acc = 0;
      // Lufta er allerede i bevegelse ved ankomst. Ingen venting på at alle bladene faller fra tretoppene.
      for (let i = 0; i < Math.round(this.max * 0.4); i++) this.spawn(camX, true);
      this.initialized = true;
    }
    this.lastCamX = camX;
    const target = this.max;
    this.acc += dt * target * 0.12;
    const births = Math.floor(this.acc);
    // En full pool sparer ikke utslipp til senere. Ellers blir kamerahopp og lang spilletid til partikkelbyger.
    this.acc -= births;
    const budget = Math.min(births, this.free.length);
    for (let i = 0; i < budget; i++) this.spawn(camX);
    let n = 0;
    const L = this.leaves;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const f = L[i];
      f.life -= dt;
      f.age += dt;
      if (f.life <= 0 || Math.abs(f.p.x - camX) > 30 || f.landed > 6) {
        this.free.push(f);
        continue;
      }
      if (f.landed > 0) {
        f.landed += dt;
      } else {
        wind.velocity(f.p.x, f.p.z, this.w);
        // Flagring: bladet glir fram og tilbake mens det faller
        const sway = Math.sin(f.life * 2.3 + f.phase);
        const drift = 1 - Math.exp(-dt * 2);
        f.v.x += (this.w.x * 0.6 + sway * 0.9 - f.v.x) * drift;
        f.v.z += (this.w.z * 0.6 + Math.cos(f.life * 1.7 + f.phase) * 0.4 - f.v.z) * drift;
        f.v.y += (-0.55 - Math.abs(sway) * 0.35 - f.v.y) * (1 - Math.exp(-dt * 3));
        f.p.addScaledVector(f.v, dt);
        f.ang += f.spin * dt * (0.7 + wind.strength * 0.3);
        if (f.p.y <= 0.02) {
          f.p.y = 0.02;
          f.landed = 0.001;
        }
      }
      L[w++] = f;
      const k = Math.min(1, f.age / 0.45, Math.max(0, f.life / 0.8)) *
        (f.landed > 0 ? Math.max(0, 1 - Math.max(0, f.landed - 4.5) / 1.5) : 1);
      if (f.landed > 0) this.q.setFromEuler(this.e.set(-Math.PI / 2, f.ang, 0, 'YXZ'));
      else this.q.setFromAxisAngle(f.axis, f.ang);
      const s = f.size * k;
      this.m.compose(f.p, this.q, this.s.set(s, s, s));
      this.mesh.setColorAt(n, this.cols[f.col]);
      this.mesh.setMatrixAt(n++, this.m);
    }
    L.length = w;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
