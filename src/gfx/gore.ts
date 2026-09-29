// Blod, gibs, flekker på bakken og blodfontener. Dråpene og flekkene er på GPU (blood.ts), gibsene er 3D (gibs.ts).
// Gnister, flammer, glør, røyk og støv går til GPU-partiklene i vfx.ts.
import * as THREE from 'three';
import { VFX, K } from './vfx';
import { BloodDrops, BloodDecals } from './blood';
import { makeGib, type Gib3D } from './gibs';
import { unitCanvas, INK, shade } from './draw';
import { rand, pick, chance } from '../core/math';
import { audio } from '../core/audio';
import { goreMul, type GoreLevel } from '../core/settings';

const BLOODS = ['#b3001b', '#8e0015', '#c4121f', '#6d0010', '#a0061a'];
const GREENS = ['#58b82c', '#3f8f1d', '#7ad44a'];
const LAVAS = ['#ff7a1a', '#ffb02e', '#ff4a10', '#ffd35a'];
export const FIRE = ['#ffb02e', '#ff6a1a', '#ffd35a', '#ff3b1a'];
export const ICEFIRE = ['#9fe0ff', '#4aa8ff', '#e0f6ff', '#6fc0ff'];
export const GHOSTFIRE = ['#c080ff', '#8a40ff', '#e0c0ff', '#6fffc8'];
/** FAMILY-modus: blod blir konfetti. */
export const CONFETTI = ['#ff4fa3', '#ffd23f', '#3bceac', '#4f8cff', '#ff7a1a', '#b56bff', '#7ad44a'];
export type BloodKind = 'red' | 'green' | 'lava';

function tex(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type GibKind = 'meat' | 'meat2' | 'bone' | 'eye' | 'rib' | 'green' | 'skull' | 'rock' | 'duck' | 'flower' | 'star';
function gibCanvas(kind: GibKind) {
  return unitCanvas(0.5, 0.5, 0.25, 0.25, 128, (p) => {
    switch (kind) {
      case 'meat':
        p.blob([-0.16, -0.08, -0.06, 0.14, 0.14, 0.1, 0.17, -0.1, 0.0, -0.16], '#b3122a');
        p.blob([-0.06, -0.02, 0.02, 0.08, 0.1, 0.0, 0.02, -0.06], '#e2607a', false);
        break;
      case 'meat2':
        p.blob([-0.18, 0.0, -0.08, 0.1, 0.1, 0.08, 0.18, -0.02, 0.04, -0.12, -0.1, -0.1], '#8e0f22');
        p.ell(0.04, 0.02, 0.06, 0.03, '#f0d6c8', false);
        break;
      case 'bone':
        p.limbs([[[-0.14, -0.04, 0.14, 0.04], 0.035]], '#efe8d2');
        p.ell(-0.15, -0.04, 0.05, 0.045, '#efe8d2');
        p.ell(0.15, 0.05, 0.05, 0.045, '#efe8d2');
        break;
      case 'eye':
        p.ell(0, 0, 0.1, 0.1, '#fff');
        p.ell(0.04, 0.01, 0.045, 0.045, '#3b7dd8', false);
        p.ell(0.05, 0.01, 0.02, 0.02, INK, false);
        p.line([-0.1, -0.02, -0.2, -0.08], 0.03, '#b3122a');
        break;
      case 'rib':
        p.limbs([[[-0.16, -0.1, -0.02, 0.1, 0.16, 0.08], 0.028]], '#efe8d2');
        break;
      case 'green':
        p.blob([-0.14, -0.06, -0.04, 0.12, 0.12, 0.08, 0.14, -0.1, 0.0, -0.14], '#5aa02a');
        break;
      case 'rock':
        p.poly([-0.16, -0.08, -0.1, 0.12, 0.08, 0.16, 0.18, 0.0, 0.1, -0.14], '#3a3238');
        p.line([-0.08, 0.02, 0.04, -0.04, 0.1, 0.06], 0.03, '#ff7a1a');
        break;
      case 'skull':
        p.blob([-0.14, -0.06, -0.12, 0.1, 0.04, 0.16, 0.16, 0.06, 0.12, -0.12], '#efe8d2');
        p.ell(0.04, 0.02, 0.04, 0.05, INK, false);
        break;
      case 'duck':
        p.blob([-0.18, -0.08, -0.16, 0.04, 0.02, 0.06, 0.14, -0.02, 0.1, -0.12, -0.08, -0.14], '#ffd23f');
        p.ell(0.04, 0.1, 0.08, 0.075, '#ffd23f');
        p.poly([0.1, 0.1, 0.2, 0.08, 0.11, 0.05], '#ff7a1a');
        p.ell(0.06, 0.12, 0.018, 0.018, INK, false);
        break;
      case 'flower':
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          p.ell(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.065, 0.065, '#ff4fa3');
        }
        p.ell(0, 0, 0.06, 0.06, '#ffd23f');
        break;
      case 'star':
        p.poly([0, 0.18, 0.05, 0.06, 0.17, 0.05, 0.08, -0.03, 0.11, -0.16, 0, -0.08, -0.11, -0.16, -0.08, -0.03, -0.17, 0.05, -0.05, 0.06], '#ffd23f');
        break;
    }
  });
}

export interface Debris {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  spin: number;
  radius: number;
  rest: boolean;
  life: number;
  bleed: number;
  bleedCol: BloodKind | 'none';
  bounces: number;
  sinking: number;
  scale0: number;
  owned: boolean; // del av en rigg (materialer eies av riggen)
  onRest?: () => void;
  onDone?: () => void;
  kick?: boolean;
  /** Sprett (0.38 er vanlig). Høyere = spretter avgårde, som en avkuttet arm. */
  bouncy?: number;
  maxBounces?: number;
  onBounce?: (d: Debris) => void;
  /** Styres av noe annet (f.eks. hodet som flyr mot skjermen). Fysikken hoppes over. */
  held?: boolean;
  /** Spinn rundt alle tre akser (3D-gibs). Ellers spinner delen bare i bildeplanet. */
  spinV?: THREE.Vector3;
}

interface Fountain {
  node: THREE.Object3D;
  local: THREE.Vector3;
  dir: THREE.Vector3;
  time: number;
  rate: number;
  acc: number;
  power: number;
  col: BloodKind;
}

const SAND_DUST = '#c9b48a';

export class Gore {
  group = new THREE.Group();
  /** Bloddråper på GPU (landing beregnes når de slippes ut). */
  drops: BloodDrops;
  /** Blodflekker og pytter på bakken. */
  decals: BloodDecals;
  /** GPU-partikler, lyn og lyspool (gnister, ild, røyk, magi). */
  vfx = new VFX();
  /** Kameraets x (for lyspoolen). Settes av Game hver frame. */
  camX = 0;
  /** Fargen på støvet som virvles opp fra bakken (sand som standard, snø på frostbrettet). Settes av miljøet. */
  dustColor = SAND_DUST;
  /** Partikler rundt foten per fottrinn (dobbelt når figuren løper). 0 = ingen; snøen i frosten sparkes opp. */
  stepDust = 0;
  debris: Debris[] = [];
  fountains: Fountain[] = [];
  private gibTex = new Map<GibKind, THREE.MeshBasicMaterial>();
  private gibGeo = new THREE.PlaneGeometry(0.5, 0.5);
  private timers: { t: number; fn: () => void }[] = [];
  private clock = 0;
  camQ = new THREE.Quaternion();
  bounds = { minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 };
  /** Sum av blod sølt (for statistikk og humor). */
  litres = 0;
  /** 0 FAMILY, 1 NORMAL, 2 EXCESSIVE, 3 PLEASE SEEK HELP (se core/settings). */
  level: GoreLevel = 2;
  get mul() {
    return goreMul(this.level);
  }
  get family() {
    return this.level === 0;
  }
  private tmpV = new THREE.Vector3();
  private tmpD = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private col = new THREE.Color();

  constructor() {
    this.decals = new BloodDecals(1400);
    this.drops = new BloodDrops(3600, (l) => {
      if (!l.decal) return;
      this.col.setRGB(l.r, l.g, l.b).multiplyScalar(rand(0.8, 1));
      this.landSplat(l.x, l.z, l.size, l.vx, l.vz, this.col);
    });
    this.group.add(this.drops.pool.mesh, this.decals.mesh, this.vfx.group);
  }

  private gibMat(kind: GibKind) {
    let m = this.gibTex.get(kind);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ map: tex(gibCanvas(kind)), alphaTest: 0.5, side: THREE.DoubleSide });
      this.gibTex.set(kind, m);
    }
    return m;
  }

  private bloodColor(kind: BloodKind) {
    if (this.level === 0 && kind !== 'lava') return this.col.set(pick(CONFETTI));
    return this.col.set(pick(kind === 'green' ? GREENS : kind === 'lava' ? LAVAS : BLOODS));
  }

  /** Antall partikler justert for gore-nivå. */
  n(count: number) {
    const v = count * this.mul;
    return Math.floor(v) + (Math.random() < v % 1 ? 1 : 0);
  }

  /** Kjør noe etter en stund i spilltid (pytter som vokser fram når liket ligger stille). */
  later(delay: number, fn: () => void) {
    this.timers.push({ t: this.clock + delay, fn });
  }

  // ---------------------------------------------------------------- partikler
  drop(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, kind: BloodKind = 'red', life = 2) {
    const c = this.bloodColor(kind);
    if (kind === 'lava') {
      // Glødende lava faller som HDR-dråper (GPU), kjøles mot mørk rød
      this.vfx.glow.emit(x, y, z, vx, vy, vz, 0, -16, 0, life, 0.4, size * 1.8, size * 1.2, 0.02, c.r * 5, c.g * 3.5, c.b * 2, K.DOT, 0.6, 0.08, 0.02, 0);
      return;
    }
    const decal = chance(this.level === 0 ? 0.15 : this.level === 1 ? 0.3 : 0.5);
    this.drops.emit(x, y, z, vx, vy, vz, this.level === 0 ? size * 0.8 : size, c.r, c.g, c.b, life, 0.4, decal);
  }

  /** Glødende blodsprut ved treff (lysende rødt, som i konseptbildene). */
  private glowSpurt(pos: THREE.Vector3, dirX: number, dirY: number, n: number, speed: number) {
    if (this.family) return;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dirY, dirX) + rand(-0.5, 0.5);
      const sp = speed * rand(0.6, 1.3);
      this.vfx.glow.emit(pos.x, pos.y, pos.z + 0.08, Math.cos(a) * sp, Math.sin(a) * sp, rand(-1, 1), 0, -10, 0,
        rand(0.12, 0.28), 2.5, 0.07, 0.03, 0.045, 3.2, 0.12, 0.08, K.SPARK, 0.6, 0.0, 0.0, 0);
    }
  }

  /** Blodsprut i en retning (dir normalisert i xy). */
  spray(pos: THREE.Vector3, dirX: number, dirY: number, count: number, speed = 6, spread = 0.6, size = 0.09, kind: BloodKind = 'red') {
    count = this.n(count);
    this.litres += count * 0.004;
    for (let i = 0; i < count; i++) {
      const a = Math.atan2(dirY, dirX) + rand(-spread, spread);
      const sp = speed * rand(0.35, 1.15);
      this.drop(pos.x + rand(-0.05, 0.05), pos.y + rand(-0.05, 0.05), pos.z + rand(-0.05, 0.05), Math.cos(a) * sp, Math.sin(a) * sp, rand(-1.4, 1.4), size * rand(0.5, 1.4), kind, rand(1.2, 2.4));
    }
    if (kind === 'red') this.glowSpurt(pos, dirX, dirY, Math.ceil(count / 5), speed);
  }

  burst(pos: THREE.Vector3, count: number, speed = 7, size = 0.1, kind: BloodKind = 'red') {
    count = this.n(count);
    this.litres += count * 0.004;
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const up = rand(0.2, 1);
      const sp = speed * rand(0.3, 1);
      this.drop(pos.x, pos.y, pos.z, Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp * up + rand(1, 4), rand(-2.5, 2.5), size * rand(0.5, 1.6), kind, rand(1.2, 2.6));
    }
    // Tåke av blod som henger litt i lufta
    if (!this.family && kind !== 'lava') {
      const mist = kind === 'green' ? '#3a6a1a' : '#5a0010';
      for (let i = 0; i < count / 6; i++) this.vfx.puff(pos.x, pos.y + rand(-0.2, 0.2), pos.z, 0.5, rand(0, 0.6), mist, 0.25, 0.7, 0.6, 0.2);
    }
    if (kind === 'red') this.glowSpurt(pos, 0, 1, Math.ceil(count / 6), speed);
  }

  // Gnister, glimt, ild, stemning og støv er GPU-partikler (vfx.ts). Signaturene er beholdt så spillkoden er uendret.
  sparks(pos: THREE.Vector3, count: number, color = '#ffd35a', speed = 6) {
    this.vfx.sparks(pos, count, color, speed);
  }

  flare(pos: THREE.Vector3, size: number, color: string, life = 0.25) {
    this.vfx.flare(pos, size, color, life);
  }

  fire(pos: THREE.Vector3, count: number, spread = 0.3, up = 2, cols: string[] = FIRE) {
    this.vfx.fire(pos, count, spread, up, cols);
  }

  /** Stemningspartikler (snø, glør, ildfluer). glow = additiv. */
  ambient(x: number, y: number, z: number, vx: number, vy: number, color: string, size: number, life: number, glow = false, grav = 0) {
    this.vfx.ambient(x, y, z, vx, vy, color, size, life, glow, grav);
  }

  dust(pos: THREE.Vector3, count: number, color = this.dustColor) {
    this.vfx.dust(pos, count, color);
  }

  // ---------------------------------------------------------------- flekker
  private sizeFor(size: number) {
    return size * [0.45, 0.8, 1, 1.3][this.level];
  }

  private inBounds(x: number) {
    return x >= this.bounds.minX && x <= this.bounds.maxX;
  }

  /** Flekk der en dråpe landet: avlang i treffretningen når den kom fort, ellers rund. */
  private landSplat(x: number, z: number, dropSize: number, vx: number, vz: number, c: THREE.Color) {
    if (!this.inBounds(x)) return;
    z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, z));
    const size = this.sizeFor(dropSize * rand(3, 5.5));
    const hs = Math.hypot(vx, vz);
    if (hs > 1.2) {
      const len = size * (1 + Math.min(2.2, hs * 0.22));
      this.decals.add(x, z, len, size * rand(0.8, 1), Math.atan2(-vz, vx), c, 6 + Math.floor(Math.random() * 4));
    } else {
      this.decals.add(x, z, size, size * rand(0.8, 1.1), rand(0, Math.PI * 2), c, chance(0.8) ? Math.floor(Math.random() * 6) : 10 + Math.floor(Math.random() * 2));
    }
  }

  /** Fersk blodflekk. */
  splat(x: number, z: number, size: number, kind: BloodKind = 'red') {
    if (!this.inBounds(x)) return;
    size = this.sizeFor(size);
    z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, z));
    const c = kind === 'lava' ? this.col.set('#2a1410') : this.bloodColor(kind);
    c.multiplyScalar(rand(0.75, 1));
    const v = chance(0.75) ? Math.floor(Math.random() * 6) : 10 + Math.floor(Math.random() * 2);
    this.decals.add(x, z, size * rand(0.8, 1.3), size * rand(0.6, 1.1), rand(0, Math.PI * 2), c, v, 0.012, 0, kind === 'lava' ? 0 : 1);
  }

  /** Gammel, inntørket flekk (pynt i miljøene). */
  stain(x: number, z: number, size: number, kind: BloodKind = 'red') {
    size = this.sizeFor(size);
    const c = kind === 'lava' ? this.col.set('#2a1410') : this.bloodColor(kind);
    c.multiplyScalar(rand(0.45, 0.7));
    const v = chance(0.6) ? Math.floor(Math.random() * 6) : chance(0.5) ? 12 + Math.floor(Math.random() * 4) : 10 + Math.floor(Math.random() * 2);
    this.decals.add(x, z, size * rand(0.8, 1.3), size * rand(0.6, 1.1), rand(0, Math.PI * 2), c, v, 0.011, 0, 0);
  }

  /** Blodpytt som vokser fram (under et lik eller en kjøttbit). */
  pool(x: number, z: number, size: number, kind: BloodKind = 'red', grow = 2.8) {
    if (!this.inBounds(x) || kind === 'lava') return;
    size = this.sizeFor(size);
    z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, z));
    const c = this.bloodColor(kind).multiplyScalar(this.family ? 1 : 0.7);
    this.decals.add(x, z, size * rand(1, 1.25), size * rand(0.65, 0.85), rand(-0.3, 0.3), c, 12 + Math.floor(Math.random() * 4), 0.0105, grow, 1);
  }

  // ---------------------------------------------------------------- fontener
  fountain(node: THREE.Object3D, lx: number, ly: number, dx: number, dy: number, time = 1.6, power = 1, col: BloodKind = 'red') {
    time *= [0.6, 0.5, 1, 1.9][this.level];
    power *= [0.8, 0.8, 1, 1.25][this.level];
    this.fountains.push({ node, local: new THREE.Vector3(lx, ly, 0.05), dir: new THREE.Vector3(dx, dy, 0).normalize(), time, rate: 70 * power, acc: 0, power, col });
  }

  // ---------------------------------------------------------------- debris
  addDebris(obj: THREE.Object3D, radius: number, vx: number, vy: number, vz: number, spin: number, opts: Partial<Debris> = {}) {
    const d: Debris = {
      obj, vel: new THREE.Vector3(vx, vy, vz), spin, radius, rest: false, life: 14 + rand(0, 4), bleed: 1.2, bleedCol: 'red',
      bounces: 0, sinking: 0, scale0: obj.scale.x, owned: true, ...opts,
    };
    if (obj.parent !== this.group) this.group.attach(obj);
    this.debris.push(d);
    return d;
  }

  gibs(pos: THREE.Vector3, count: number, kind: 'red' | 'bone' | 'green' | 'lava' = 'red', power = 1) {
    const fam = this.level === 0 && kind !== 'lava';
    count = this.n(count);
    // FAMILY: gummiender, blomster og stjerner (flate). Ellers 3D-biter.
    const kinds3: Gib3D[] = kind === 'bone' ? ['bone', 'rib', 'bone', 'tooth'] : kind === 'green' ? ['green', 'green', 'bone'] : kind === 'lava' ? ['rock', 'rock', 'rock'] : ['meat', 'meat', 'meat', 'bone', 'rib', 'meat', 'tooth'];
    for (let i = 0; i < count; i++) {
      let obj: THREE.Object3D;
      let radius: number;
      if (fam) {
        const m = new THREE.Mesh(this.gibGeo, this.gibMat(pick(['duck', 'flower', 'star', 'duck'] as GibKind[])));
        const s = rand(0.6, 1.2);
        m.scale.setScalar(s);
        m.rotation.z = rand(0, 6.28);
        obj = m;
        radius = 0.1 * s;
      } else {
        const k: Gib3D = i === 0 && kind === 'red' && chance(0.5) ? 'eye' : pick(kinds3);
        const g = makeGib(k, rand(1.0, 1.6));
        obj = g.mesh;
        radius = g.radius;
      }
      obj.position.set(pos.x + rand(-0.2, 0.2), pos.y + rand(-0.2, 0.2), pos.z + rand(-0.15, 0.15));
      this.group.add(obj);
      const a = rand(0.15, Math.PI - 0.15);
      const sp = rand(3, 8) * power;
      const bleeds = !(kind === 'bone' || fam);
      this.addDebris(obj, radius, Math.cos(a) * sp, Math.sin(a) * sp + 2, rand(-2, 2), rand(-15, 15), {
        owned: false, bleed: bleeds ? 0.6 : 0, bleedCol: bleeds ? kind : 'none', life: 10 + rand(0, 6),
        bouncy: fam ? 0.6 : undefined,
        spinV: fam ? undefined : new THREE.Vector3(rand(-16, 16), rand(-16, 16), rand(-16, 16)),
        onRest: bleeds && kind !== 'lava' ? () => this.pool(obj.position.x, obj.position.z, rand(0.35, 0.6), kind as BloodKind, 1.6) : undefined,
      });
    }
  }

  // ---------------------------------------------------------------- oppdatering
  update(dt: number) {
    this.clock += dt;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.t <= this.clock);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.t > this.clock);
        for (const t of due) t.fn();
      }
    }
    this.drops.update(dt);
    this.decals.update(dt);
    this.vfx.update(dt, this.camX);

    // Fontener
    for (let i = this.fountains.length - 1; i >= 0; i--) {
      const f = this.fountains[i];
      f.time -= dt;
      if (f.time <= 0 || !f.node.parent) {
        this.fountains.splice(i, 1);
        continue;
      }
      f.node.updateMatrixWorld(true);
      const pos = this.tmpV.copy(f.local);
      f.node.localToWorld(pos);
      f.node.getWorldQuaternion(this.tmpQ);
      const dir = this.tmpD.copy(f.dir).applyQuaternion(this.tmpQ);
      f.acc += dt * f.rate * Math.min(1, f.time);
      const pulse = 0.7 + 0.5 * Math.sin(f.time * 18);
      while (f.acc >= 1) {
        f.acc -= 1;
        const sp = rand(3, 7) * f.power * pulse;
        this.drop(pos.x, pos.y, pos.z, dir.x * sp + rand(-0.8, 0.8), dir.y * sp + rand(-0.5, 0.8), rand(-0.6, 0.6), rand(0.06, 0.12), f.col, rand(1, 2));
      }
      this.litres += dt * 0.3;
    }

    // Debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      const o = d.obj;
      d.life -= dt;
      if (d.life <= 0) {
        d.sinking += dt;
        const k = Math.max(0, 1 - d.sinking / 0.6);
        o.scale.set(Math.sign(o.scale.x) * Math.abs(d.scale0) * k, Math.abs(d.scale0) * k, Math.abs(d.scale0) * k);
        if (k <= 0) {
          o.removeFromParent();
          d.onDone?.();
          this.debris.splice(i, 1);
        }
        continue;
      }
      if (d.rest || d.held) continue;
      d.vel.y -= 18 * dt;
      o.position.x += d.vel.x * dt;
      o.position.y += d.vel.y * dt;
      o.position.z += d.vel.z * dt;
      o.position.z = Math.max(this.bounds.minZ - 1, Math.min(this.bounds.maxZ + 0.5, o.position.z));
      if (d.spinV) {
        o.rotation.x += d.spinV.x * dt;
        o.rotation.y += d.spinV.y * dt;
        o.rotation.z += d.spinV.z * dt;
      } else o.rotation.z += d.spin * dt;
      if (d.bleed > 0 && d.bleedCol !== 'none' && chance(0.6)) {
        this.drop(o.position.x, o.position.y, o.position.z, rand(-0.5, 0.5), rand(-0.5, 0.5), 0, rand(0.04, 0.08), d.bleedCol, 1);
        d.bleed -= dt;
      }
      if (o.position.y - d.radius < 0) {
        o.position.y = d.radius;
        const rest = d.bouncy ?? 0.38;
        if (d.vel.y < -2.2 && d.bounces < (d.maxBounces ?? 4)) {
          d.bounces++;
          d.vel.y *= -rest;
          d.vel.x *= d.bouncy ? 0.85 : 0.55;
          d.vel.z *= 0.5;
          d.spin *= d.bouncy ? 0.8 : 0.45;
          d.spinV?.multiplyScalar(0.5);
          if (d.bleedCol !== 'none') this.splat(o.position.x, o.position.z, rand(0.3, 0.6), d.bleedCol);
          if (d.onBounce) d.onBounce(d);
          else if (d.radius > 0.15) audio.thud();
        } else {
          d.rest = true;
          d.vel.set(0, 0, 0);
          if (d.bleedCol !== 'none') this.splat(o.position.x, o.position.z, rand(0.4, 0.8), d.bleedCol);
          d.onRest?.();
        }
      }
    }
  }

  /** Spark/dytt en hvilende del (f.eks. imp som sparker hodet). */
  kick(d: Debris, vx: number, vy: number, spin: number) {
    d.rest = false;
    d.vel.set(vx, vy, 0);
    d.spin = spin;
    d.bounces = 0;
  }

  /** Fjern en del med én gang (uten å krympe den). */
  removeDebris(d: Debris) {
    const i = this.debris.indexOf(d);
    if (i >= 0) this.debris.splice(i, 1);
    d.obj.removeFromParent();
  }

  clear() {
    this.drops.clear();
    this.decals.clear();
    this.vfx.clear();
    for (const d of this.debris) d.obj.removeFromParent();
    this.debris.length = 0;
    this.fountains.length = 0;
    this.timers.length = 0;
    this.litres = 0;
    this.dustColor = SAND_DUST;
    this.stepDust = 0;
  }
}

export { BLOODS, shade };
