// Felles kjemper-klasse for helter, fiender og duellanter.
import * as THREE from 'three';
import { Rig, makeRig, NEUTRAL, type Pose } from '../gfx/rig';
import { getChar, type CharDef, type CharId, type PartName } from '../gfx/chars';
import { plainCanvas } from '../gfx/draw';
import { P, DEATH_WORDS, type AttackDef, type DeathStyle } from './attacks';
import { headImage } from '../gfx/rig';
import { W } from './world';
import { audio } from '../core/audio';
import { rand, pick, chance, clamp } from '../core/math';
import type { Debris, BloodKind } from '../gfx/gore';
import type { WeaponStats } from '../data/weapons';
import { screenFX } from '../gfx/screenfx';

export type FState =
  | 'idle' | 'walk' | 'jump' | 'attack' | 'hurt' | 'down' | 'getup' | 'dead' | 'block' | 'magic'
  | 'roll' | 'crouch' | 'victory' | 'taunt' | 'stunned' | 'blockstun' | 'land' | 'drag' | 'flee' | 'hold' | 'held' | 'ride';

export type Team = 'hero' | 'enemy';

let shadowMat: THREE.MeshBasicMaterial | null = null;
function getShadowMat() {
  if (!shadowMat) {
    const t = new THREE.CanvasTexture(plainCanvas(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(20,10,5,0.55)');
      g.addColorStop(0.7, 'rgba(20,10,5,0.35)');
      g.addColorStop(1, 'rgba(20,10,5,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }));
    shadowMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  }
  return shadowMat;
}

export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }
/** Et ridedyr sett fra rytteren (implementeres av game/mounts.ts). */
export interface MountLike {
  facing: number;
  saddle(out: THREE.Vector3): THREE.Vector3;
  drive(ax: number, az: number, run: boolean): void;
  attack(): void;
  hop(): void;
  dismount(knocked: boolean): void;
}
export interface FighterOpts {
  hp: number;
  speed: number;
  dmgMul?: number;
  scale?: number;
  tint?: [number, number, number];
  poseMod?: Partial<Pose>;
  weapon?: WeaponStats;
}
export const bloodOf = (d: CharDef): BloodKind => (d.blood === 'green' ? 'green' : d.blood === 'lava' ? 'lava' : 'red');
export const GRAVITY = 26;
const dripTmp = new THREE.Vector3();

/** Replikker når armen ryker. Den første i spillet er alltid den klassiske. */
export const FLESH_WOUND = ['IT\'S JUST A FLESH WOUND!', 'JUST A FLESH WOUND!', 'I WASN\'T USING THAT ONE!', 'I HAVE ANOTHER ONE!', 'COME BACK HERE, ARM!', 'THAT\'LL BUFF OUT!', 'IT\'S JUST A FLESH WOUND!'];
export const NO_ARMS = ['I\'LL KICK YOU TO DEATH THEN!', 'MY LEGS STILL WORK!', 'STILL UNDEFEATED!', 'I\'VE HAD WORSE! PROBABLY!', 'IT\'S JUST A FLESH WOUND! AGAIN!'];
let saidFleshWound = false;

const KICKS = new Map<string, AttackDef>();
/** Uten våpenarm blir alle angrep til spark (og hodestøt). */
export function kickVersion(a: AttackDef): AttackDef {
  let k = KICKS.get(a.id);
  if (!k) {
    k = {
      ...a, id: a.id + '-kick', projectile: false, spin: false, reach: Math.min(a.reach, 1.45), dmg: a.dmg * 0.75,
      wind: a.air ? P.jumpW : P.kickW, strike: a.air ? { ...P.kickS, legF: 1.9, torso: 0.6 } : P.kickS,
      swoosh: 'none', word: ['BOOT!', 'KICK!', 'SHIN-SPLINTER!'], death: a.death.includes('decap') ? ['explode', 'normal'] : a.death,
    };
    KICKS.set(a.id, k);
  }
  return k;
}

export class Fighter {
  static nextId = 1;
  id = Fighter.nextId++;
  def: CharDef;
  rig: Rig;
  shadow: THREE.Mesh;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  facing = 1;
  hp: number;
  maxHp: number;
  speed: number;
  dmgMul: number;
  /** Skade som tas (under 1 = tøffere, fra DEF-poeng). */
  dmgTaken = 1;
  alive = true;
  state: FState = 'idle';
  st = 0;
  atk: AttackDef | null = null;
  hitsDone = new Map<number, number>();
  onGround = true;
  invuln = 0;
  flashT = 0;
  stunT = 0;
  downT = 0;
  wantVX = 0;
  wantVZ = 0;
  running = false;
  walkPh = 0;
  blocking: 'none' | 'high' | 'low' = 'none';
  deathStyle: DeathStyle = 'normal';
  collapseT = 0;
  fallDir = 1;
  legless = false;
  corpseLife = 14;
  /** Har liket fått en blodpytt under seg? */
  private pooled = false;
  /** Tid til neste bloddråpe fra en såret figur (se drip). */
  private dripT = Math.random() * 0.5;
  removeMe = false;
  headDebris: Debris | null = null;
  lastHitBy: Fighter | null = null;
  swooshed = false;
  airAttackUsed = false;
  frozen = false;
  label: string;
  onDeath: ((f: Fighter, killer: Fighter | null, style: DeathStyle) => void) | null = null;
  onLand: ((f: Fighter) => void) | null = null;
  onArmorHit: ((dmg: number, from: Fighter) => void) | null = null;
  /** Egne data for kontroller (AI/spiller). */
  data: Record<string, unknown> = {};
  /** Spillerindeks for menneskestyrte figurer (0 eller 1), ellers -1. Brukes til gamepad-rumble. */
  player = -1;
  // ---- grep og kast (se game/grab.ts)
  holding: Fighter | null = null;
  heldBy: Fighter | null = null;
  thrownBy: Fighter | null = null;
  /** Kalles når en kastet figur treffer bakken (settes av brettet). */
  static onThrownLand: ((f: Fighter, by: Fighter) => void) | null = null;
  // ---- miljødrap (se game/hazards.ts)
  /** Liket synker (myr, råk, lava). Enheter per sekund. */
  sinkRate = 0;
  /** Navnet på faren som drepte figuren (for bonus og tekst). */
  envKill = '';
  // ---- ridedyr (se game/mounts.ts)
  mount: MountLike | null = null;

  weapon: WeaponStats | undefined;
  poseMod: Partial<Pose> | null = null;
  /** Sjefer og store fiender: ignorer vanlige treff i vindup. */
  armored = false;
  /** Kan ikke miste armer (sjefer, ridedyr). */
  noSever = false;
  armsLost = 0;
  /** Kroppen kan løpe rundt uten hode en stund etter halshugging (fiender på brettene). */
  allowHeadless = false;
  headlessT = 0;
  private headlessDir = 1;

  constructor(public cid: CharId, public team: Team, opts: FighterOpts) {
    this.def = getChar(cid);
    this.rig = makeRig(cid, opts.scale ?? 1, opts.tint);
    this.weapon = opts.weapon;
    this.poseMod = opts.poseMod ?? null;
    this.hp = this.maxHp = opts.hp;
    this.speed = opts.speed;
    this.dmgMul = opts.dmgMul ?? 1;
    this.label = this.def.name;
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), getShadowMat());
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
  }

  addTo(scene: THREE.Object3D) {
    scene.add(this.rig.root);
    scene.add(this.shadow);
    this.rig.root.position.copy(this.pos);
    this.rig.setFacing(this.facing);
    this.rig.sync();
  }

  remove() {
    this.rig.root.removeFromParent();
    this.shadow.removeFromParent();
  }

  get size() {
    return this.rig.scale;
  }

  setState(s: FState) {
    // Slipp den du holder hvis du blir avbrutt
    if (this.holding && s !== 'hold') {
      const t = this.holding;
      this.holding = null;
      if (t.heldBy === this) {
        t.heldBy = null;
        if (t.alive && t.state === 'held') {
          t.onGround = false;
          t.vel.set(this.facing * 1.5, 3, 0);
          t.setState('jump');
        }
      }
    }
    this.state = s;
    this.st = 0;
    if (s !== 'block') this.blocking = s === 'blockstun' ? this.blocking : 'none';
  }

  face(d: number) {
    if (d > 0.01) this.facing = 1;
    else if (d < -0.01) this.facing = -1;
  }

  canAct() {
    return this.alive && !this.frozen && (this.state === 'idle' || this.state === 'walk' || this.state === 'crouch' || this.state === 'block' || this.state === 'flee' || this.state === 'ride');
  }

  phase(): 'wind' | 'active' | 'recover' | null {
    if (this.state !== 'attack' || !this.atk) return null;
    const a = this.atk;
    if (this.st < a.startup) return 'wind';
    if (this.st < a.startup + a.active) return 'active';
    return 'recover';
  }

  get hasWeaponArm() {
    return !this.rig.detached.has('armF');
  }

  startAttack(a: AttackDef) {
    if (!this.hasWeaponArm) a = kickVersion(a);
    this.atk = a;
    this.setState('attack');
    this.hitsDone.clear();
    this.swooshed = false;
    if (a.hpCost) this.hp = Math.max(1, this.hp - a.hpCost);
    if (!a.air) {
      this.vel.x *= 0.3;
      this.vel.z = 0;
    }
    if (chance(0.35)) audio.grunt(this.def.voice);
  }

  jump(vx: number, vz: number, vy = 9.6) {
    this.vel.set(vx, vy, vz);
    this.onGround = false;
    this.airAttackUsed = false;
    this.setState('jump');
    audio.jump();
    W.gore.dust(this.pos, 4);
  }

  // ---------------------------------------------------------------- skade
  hurt(stun: number, pushX: number) {
    this.setState('hurt');
    this.stunT = stun;
    this.vel.x = pushX;
    this.atk = null;
  }

  knockdown(pushX: number, vy: number) {
    this.setState('down');
    this.atk = null;
    this.vel.x = pushX;
    this.vel.y = vy;
    this.vel.z = 0;
    this.onGround = false;
    this.downT = 0.75;
  }

  flash(t = 0.1) {
    this.flashT = t;
  }

  private fling(part: PartName, vx: number, vy: number, spin: number, radius: number): Debris | null {
    const obj = this.rig.detach(part, W.gore.group);
    if (!obj) return null;
    const col: BloodKind | 'none' = this.def.blood === 'bone' ? 'none' : bloodOf(this.def);
    return W.gore.addDebris(obj, radius * this.size, vx, vy, rand(-1.2, 1.2), spin, { bleedCol: col, bleed: col === 'none' ? 0 : 1.6 });
  }

  torsoPoint(y = 0.45, out = new THREE.Vector3()) {
    if (this.rig.detached.has('torso')) return out.set(this.pos.x, this.pos.y + 0.8 * this.size, this.pos.z);
    return this.rig.worldPoint('torso', 0, y, out);
  }

  headPoint(out = new THREE.Vector3()) {
    if (this.rig.detached.has('head')) return this.torsoPoint(0.8, out);
    return this.rig.worldPoint('head', 0.05, 0.4, out);
  }

  /**
   * Kutt av en arm uten at figuren dør. Armen spretter avgårde, og figuren later som ingenting.
   * Første arm er bakarmen, andre er våpenarmen (da blir det bare spark).
   */
  loseArm(dir: number): boolean {
    if (!this.alive || this.noSever) return false;
    const which: PartName | null = !this.rig.detached.has('armB') ? 'armB' : !this.rig.detached.has('armF') ? 'armF' : null;
    if (!which) return false;
    const J = this.def.joints;
    const col = bloodOf(this.def);
    const bone = this.def.blood === 'bone';
    const at = this.torsoPoint(0.75);
    const obj = this.rig.detach(which, W.gore.group);
    if (!obj) return false;
    W.gore.addDebris(obj, 0.2 * this.size, dir * rand(3, 5.5), rand(7, 9.5), rand(-1, 1), rand(-16, 16), {
      bleedCol: bone || W.gore.family ? 'none' : col, bleed: 1.4, bouncy: 0.72, maxBounces: 9, onBounce: () => audio.boing(),
    });
    const sh = which === 'armB' ? J.shB : J.shF;
    if (!bone) {
      W.gore.fountain(this.rig.g.torso, sh[0], sh[1], which === 'armB' ? -0.6 : 0.6, 1, 2.4, 1, col);
      W.gore.spray(at, dir, 0.3, 26, 6, 0.6, 0.1, col);
      audio.rip();
    } else audio.bones();
    audio.boing();
    this.armsLost++;
    W.stats.limbs++;
    let line: string;
    if (which === 'armB') {
      line = saidFleshWound ? pick(FLESH_WOUND) : FLESH_WOUND[0];
      saidFleshWound = true;
    } else line = pick(NO_ARMS);
    W.fx.text(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 'DISARMED!', 'word');
    setTimeout(() => {
      if (this.rig.root.parent) W.fx.text(this.headPoint().add(new THREE.Vector3(0, 0.9, 0)), line, 'speech', 2.4);
    }, 350);
    return true;
  }

  /** Gro ut igjen armene (kylling, respawn). */
  regrowArms() {
    const had = this.armsLost > 0;
    this.rig.restore('armB');
    this.rig.restore('armF');
    this.armsLost = 0;
    return had;
  }

  /** Bilde av hodet (med fargetone) til skjerm-effekter. */
  headImg() {
    const t = this.rig.tint;
    const tinted = t[0] !== 1 || t[1] !== 1 || t[2] !== 1;
    return headImage(this.cid, tinted ? t : undefined, this.facing < 0);
  }

  die(style: DeathStyle, dir: number, killer: Fighter | null) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.atk = null;
    this.setState('dead');
    this.rig.flash = 0;
    const bone = this.def.blood === 'bone';
    if (bone) style = 'shatter';
    this.deathStyle = style;
    const col = bloodOf(this.def);
    this.fallDir = this.facing === -dir ? 1 : -1;
    this.collapseT = 0.12;
    this.vel.x = dir * 2.5;
    if (this.onGround) this.vel.y = 2.5;
    this.onGround = false;
    const tp = this.torsoPoint();
    const J = this.def.joints;
    const g = W.gore;
    if (!bone) {
      audio.scream(this.def.voice);
      audio.splat(1.4);
      g.burst(tp, 30, 6, 0.1, col);
    }
    switch (style) {
      case 'decap': {
        const hp = this.headPoint();
        this.headDebris = this.fling('head', dir * rand(1.5, 4), rand(7.5, 10.5), rand(-14, 14), 0.3);
        g.fountain(this.rig.g.torso, J.neck[0], J.neck[1], 0.1, 1, 2.6, 1.25, col);
        g.spray(hp, dir, 0.8, 30, 7, 0.5, 0.1, col);
        this.collapseT = 1.1;
        this.vel.set(dir * 0.4, 0, 0);
        this.onGround = true;
        this.pos.y = Math.max(0, this.pos.y);
        W.stats.heads++;
        // Hodeløs kylling: kroppen løper rundt og spruter en stund før den skjønner det
        if (this.allowHeadless && this.pos.y < 0.3 && chance(0.35)) {
          this.headlessT = rand(1.6, 2.6);
          this.headlessDir = chance(0.5) ? 1 : -1;
          this.collapseT = this.headlessT + 0.25;
          g.fountain(this.rig.g.torso, J.neck[0], J.neck[1], 0.15, 1, this.headlessT, 1.1, col);
          setTimeout(() => {
            if (this.rig.root.parent) W.fx.text(this.torsoPoint().add(new THREE.Vector3(0, 1.2, 0)), 'HEADLESS CHICKEN MODE!', 'word', 1.4);
          }, 450);
        }
        break;
      }
      case 'bisect': {
        this.fling('torso', dir * rand(2, 4), rand(6, 8.5), rand(-9, 9) + dir * 3, 0.4);
        g.fountain(this.rig.body, 0, 0.15, 0, 1, 2.2, 1.1, col);
        g.gibs(tp, 3, col, 0.7);
        this.collapseT = 1.3;
        this.vel.set(dir * 0.6, 0, 0);
        this.onGround = true;
        W.stats.gibs += 3;
        break;
      }
      case 'explode':
      case 'shatter': {
        const parts: PartName[] = ['head', 'armF', 'armB', 'torso', 'legF', 'legB', 'pelvis'];
        const p = bone ? 0.8 : 1.2;
        for (const pn of parts) {
          this.fling(pn, dir * rand(0.5, 5) * p + rand(-2, 2), rand(5, 11) * p, rand(-18, 18), pn === 'torso' ? 0.35 : 0.2);
        }
        if (bone) {
          g.gibs(tp, 6, 'bone', 0.9);
          g.dust(this.pos, 10, '#e8e0c8');
          audio.bones();
        } else {
          g.gibs(tp, 12, col, 1.2);
          g.burst(tp, 90, 9, 0.12, col);
          W.fx.shake(0.45);
          audio.squish();
          W.stats.gibs += 12;
          // Kroppen smeller: sjokkbølge og zoomslag i bildet, og litt av den havner på glasset
          screenFX.shock(tp, 0.8, 0.65, 1.3);
          screenFX.punch(tp, 0.35);
          if (style === 'explode' && col === 'red') W.fx.lensSplat(tp, 0.8);
        }
        this.corpseLife = 0.5;
        break;
      }
      case 'dismember': {
        this.fling('armF', dir * rand(2, 5), rand(5, 8), rand(-15, 15), 0.25);
        this.fling('armB', dir * rand(1, 4), rand(6, 9), rand(-15, 15), 0.25);
        g.fountain(this.rig.g.torso, J.shF[0], J.shF[1], 0.4, 1, 1.8, 0.8, col);
        g.fountain(this.rig.g.torso, J.shB[0], J.shB[1], -0.4, 1, 1.8, 0.8, col);
        if (chance(0.5)) {
          this.fling('head', dir * rand(1, 3), rand(7, 9), rand(-10, 10), 0.3);
          g.fountain(this.rig.g.torso, J.neck[0], J.neck[1], 0, 1, 2, 1, col);
          W.stats.heads++;
        }
        this.collapseT = 0.9;
        this.vel.set(dir * 0.5, 0, 0);
        this.onGround = true;
        break;
      }
      case 'headsplode': {
        const hp = this.headPoint();
        this.rig.hide('head');
        g.burst(hp, 70, 7, 0.11, col);
        g.gibs(hp, 5, col, 0.9);
        g.gibs(hp, 2, 'bone', 0.9);
        g.fountain(this.rig.g.torso, J.neck[0], J.neck[1], 0, 1, 2.4, 1.2, col);
        W.fx.shake(0.35);
        if (col === 'red') W.fx.lensSplat(hp, 0.5);
        audio.squish();
        this.collapseT = 1.0;
        this.vel.set(dir * 0.3, 0, 0);
        this.onGround = true;
        W.stats.heads++;
        W.stats.gibs += 7;
        break;
      }
      case 'legsoff': {
        this.fling('legF', dir * rand(1, 3), rand(3, 5), rand(-10, 10), 0.3);
        this.fling('legB', -dir * rand(0.5, 2), rand(3, 5), rand(-10, 10), 0.3);
        g.fountain(this.rig.body, 0, -0.05, 1, 0.3, 2.2, 1, col);
        g.fountain(this.rig.body, 0, -0.05, -1, 0.3, 2.2, 1, col);
        this.legless = true;
        this.collapseT = 0.0;
        this.vel.set(dir * 0.5, 0, 0);
        break;
      }
      default:
        g.spray(tp, dir, 0.4, 20, 5, 0.6, 0.1, col);
    }
    const word = pick(DEATH_WORDS[style]);
    W.fx.text(this.headPoint().add(new THREE.Vector3(0, 0.6, 0)), word, style === 'decap' || style === 'explode' || style === 'headsplode' ? 'kill big' : 'kill');
    this.onDeath?.(this, killer, style);
  }

  /**
   * Sårede figurer drypper blod: fiender under halv helse, helter under 30 prosent. Oftere når de beveger seg.
   * Etter Morbidium (src/34_blod.js). Ikke for skjeletter, lava eller på FAMILY.
   */
  private drip(dt: number) {
    const lim = this.player >= 0 || this.team === 'hero' ? 0.3 : 0.5;
    if (!this.alive || this.hp >= this.maxHp * lim || this.def.blood === 'bone' || this.def.blood === 'lava' || W.gore.family) return;
    this.dripT -= dt;
    if (this.dripT > 0) return;
    const moving = Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.6;
    this.dripT = moving ? rand(0.18, 0.4) : rand(0.7, 1.4);
    const col = bloodOf(this.def);
    const p = this.torsoPoint(rand(0.05, 0.4), dripTmp);
    W.gore.drop(p.x + rand(-0.12, 0.12), p.y, p.z + 0.04, this.vel.x * 0.3 + rand(-0.3, 0.3), rand(-0.6, 0.1), 0, rand(0.05, 0.08), col, 1.5);
    // Et lite spor på bakken der figuren går
    if (moving && this.onGround && chance(0.4)) W.gore.splat(this.pos.x + rand(-0.15, 0.15), this.pos.z + rand(-0.05, 0.15), rand(0.12, 0.2), col);
  }

  // ---------------------------------------------------------------- oppdatering
  update(dt: number, b: Bounds) {
    this.st += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.drip(dt);
    const a = this.atk;
    // På ryggen av et ridedyr: dyret bestemmer posisjonen
    if (this.mount && this.alive) {
      this.mount.saddle(this.pos);
      this.facing = this.mount.facing;
      this.vel.set(0, 0, 0);
      this.onGround = true;
      if (this.state === 'idle' || this.state === 'walk') this.state = 'ride';
      this.animate(dt);
      return;
    }
    // Holdt i nakkeskinnet: posisjonen styres av den som holder
    if (this.state === 'held') {
      const h = this.heldBy;
      if (!h || h.state !== 'hold' || h.holding !== this) {
        this.heldBy = null;
        this.onGround = false;
        this.setState('jump');
      } else {
        this.pos.set(h.pos.x + h.facing * 0.8 * h.size, h.pos.y + 0.3, h.pos.z + 0.03);
        this.facing = -h.facing;
        this.vel.set(0, 0, 0);
        this.onGround = true;
        this.animate(dt);
        return;
      }
    }

    switch (this.state) {
      case 'attack': {
        if (!a) {
          this.setState('idle');
          break;
        }
        const ph = this.phase();
        if (a.lunge && ph !== 'recover' && this.onGround) this.vel.x = this.facing * a.lunge * (ph === 'active' ? 1 : 0.5);
        if (ph === 'active' && !this.swooshed) {
          this.swooshed = true;
          audio.swish(a.heavy ? 0.8 : 1 + rand(-0.1, 0.1), !!a.heavy);
          this.doSwoosh(a);
        }
        if (this.st >= a.startup + a.active + a.recovery) {
          this.atk = null;
          this.setState(this.onGround ? 'idle' : 'jump');
        }
        break;
      }
      case 'hurt':
      case 'blockstun':
      case 'stunned':
        if (this.st >= this.stunT) this.setState('idle');
        break;
      case 'land':
        if (this.st >= this.stunT) this.setState('idle');
        break;
      case 'down':
        if (this.onGround) {
          this.downT -= dt;
          if (this.downT <= 0) this.setState('getup');
        }
        break;
      case 'getup':
        if (this.st >= 0.38) {
          this.setState('idle');
          this.invuln = 0.6;
        }
        break;
      case 'roll':
        this.vel.x = this.facing * 6.5;
        if (this.st >= 0.5) {
          this.setState('crouch');
          this.vel.x = 0;
        }
        break;
      case 'dead':
        if (this.sinkRate > 0) {
          this.onGround = true;
          this.vel.set(0, 0, 0);
          this.pos.y -= dt * this.sinkRate;
          if (this.pos.y < -2.6) this.removeMe = true;
        }
        if (this.headlessT > 0) {
          this.headlessT -= dt;
          this.vel.x = this.headlessDir * 3.1;
          this.vel.z = Math.sin(W.time * 6 + this.id) * 1.6;
          this.walkPh += dt * 14;
          if (chance(dt * 1.2)) this.headlessDir *= -1;
          if (this.headlessT <= 0) this.vel.set(this.headlessDir * 1.5, 0, 0);
        }
        // Når liket ligger stille vokser en blodpytt fram under overkroppen
        if (!this.pooled && this.st > this.collapseT + 0.3 && !(this.headlessT > 0) && this.onGround && !(this.sinkRate > 0) && this.corpseLife > 2) {
          this.pooled = true;
          if (this.def.blood !== 'bone' && this.deathStyle !== 'shatter') {
            W.gore.pool(this.pos.x + this.fallDir * 0.55 * this.rig.scale, this.pos.z, 1.1 * this.rig.scale, bloodOf(this.def));
          }
        }
        if (this.corpseLife < 900 && this.st > this.corpseLife) {
          this.rig.root.position.y -= dt * 0.5;
          if (this.st > this.corpseLife + 2) this.removeMe = true;
        }
        break;
    }

    // Fysikk
    if (this.state === 'hold') {
      this.vel.set(0, 0, 0);
      this.wantVX = this.wantVZ = 0;
    }
    if (!this.onGround && !(this.sinkRate > 0)) {
      this.vel.y -= GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) this.land();
    }
    if (this.onGround && this.canAct()) {
      const want = Math.hypot(this.wantVX, this.wantVZ) > 0.05;
      this.vel.x = this.wantVX;
      this.vel.z = this.wantVZ;
      if (this.state !== 'block' && this.state !== 'crouch' && this.state !== 'flee') this.state = want ? 'walk' : 'idle';
      if (want) this.walkPh += dt * (this.running ? 13 : 9.5) * Math.min(1.4, Math.hypot(this.wantVX, this.wantVZ) / Math.max(1, this.speed));
    } else if (this.onGround && this.state !== 'roll' && !(this.state === 'attack' && a?.lunge) && !(this.headlessT > 0)) {
      const f = Math.exp(-(this.state === 'dead' ? 6 : 8) * dt);
      this.vel.x *= f;
      this.vel.z *= f;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (this.alive) {
      this.pos.x = clamp(this.pos.x, b.minX, b.maxX);
      this.pos.z = clamp(this.pos.z, b.minZ, b.maxZ);
    } else {
      this.pos.z = clamp(this.pos.z, b.minZ - 0.5, b.maxZ + 0.5);
      if (this.headlessT > 0) {
        if (this.pos.x < b.minX + 0.3) this.headlessDir = 1;
        if (this.pos.x > b.maxX - 0.3) this.headlessDir = -1;
        this.pos.x = clamp(this.pos.x, b.minX, b.maxX);
        this.facing = this.headlessDir;
      }
    }
    this.animate(dt);
  }

  land() {
    const impact = -this.vel.y;
    this.pos.y = 0;
    this.vel.y = 0;
    this.onGround = true;
    if (this.thrownBy) {
      const by = this.thrownBy;
      this.thrownBy = null;
      Fighter.onThrownLand?.(this, by);
    }
    if (this.state === 'jump') {
      this.setState('land');
      this.stunT = 0.06;
      this.rig.pose.bodyY -= 0.12;
      W.gore.dust(this.pos, 3);
    } else if (this.state === 'attack' && this.atk?.air) {
      const rec = this.atk.recovery;
      this.atk = null;
      this.setState('land');
      this.stunT = rec;
      W.gore.dust(this.pos, 4);
    } else if (this.state === 'down') {
      if (impact > 7 && this.downT > 0.3) {
        this.vel.y = impact * 0.3;
        this.onGround = false;
        this.downT = 0.7;
      }
      audio.thud(this.size);
      W.gore.dust(this.pos, 8);
      if (this.def.blood !== 'bone') W.gore.splat(this.pos.x, this.pos.z, rand(0.4, 0.8));
    } else if (this.state === 'dead') {
      // Kroppen faller: opptaket av en kropp mot bakken (tunge fiender smeller)
      audio.thud(this.size, true);
      W.gore.dust(this.pos, 6);
    }
    this.onLand?.(this);
  }

  private doSwoosh(a: AttackDef) {
    if (a.swoosh === 'none' || !a.swoosh) return;
    const s = this.size;
    const x = this.pos.x + this.facing * 0.55 * s;
    const y = this.pos.y + 1.35 * s;
    const z = this.pos.z;
    const col = this.team === 'hero' ? '#ffffff' : '#ffd0c0';
    switch (a.swoosh) {
      case 'over':
        W.fx.swoosh(x, y, z, 2.6 * s, 0.35, this.facing, col);
        break;
      case 'side':
        W.fx.swoosh(x, y + 0.1, z, 2.4 * s, 0.05, this.facing, col);
        break;
      case 'under':
        W.fx.swoosh(x, y - 0.5 * s, z, 2.3 * s, -0.5, this.facing, col);
        break;
      case 'spin':
        W.fx.swoosh(this.pos.x, y - 0.2, z, 3.6 * s, 0, 1, col, 0.3);
        W.fx.swoosh(this.pos.x, y - 0.2, z, 3.6 * s, Math.PI, 1, col, 0.3);
        break;
    }
  }

  // ---------------------------------------------------------------- animasjon
  animate(dt: number) {
    const r = this.rig;
    const t = W.time + this.id * 1.7;
    let target: Partial<Pose> = NEUTRAL;
    let speed = 14;
    switch (this.state) {
      case 'idle':
      case 'land': {
        const b = Math.sin(t * 3);
        target = { ...NEUTRAL, torso: NEUTRAL.torso + b * 0.03, armF: NEUTRAL.armF + b * 0.05, armB: NEUTRAL.armB - b * 0.05, bodyY: -0.03 + b * 0.015, ...this.poseMod };
        speed = this.state === 'land' ? 30 : 10;
        break;
      }
      case 'walk':
      case 'flee': {
        const ph = this.walkPh;
        const run = this.running || this.state === 'flee';
        const amp = run ? 0.85 : 0.55;
        const s = Math.sin(ph);
        target = {
          torso: run ? -0.32 : -0.12, head: run ? 0.2 : 0.08,
          armF: (run ? 0.9 : 0.6) + s * 0.25, armB: -0.2 - s * (run ? 0.8 : 0.5),
          legF: s * amp, legB: -s * amp, weapon: run ? -1.9 : -1.45,
          bodyY: -0.04 + Math.abs(Math.cos(ph)) * (run ? 0.1 : 0.06),
          ...this.poseMod,
        };
        speed = 22;
        break;
      }
      case 'jump':
        target = this.vel.y > 0 ? P.jump : P.fall;
        speed = 12;
        break;
      case 'attack': {
        const a = this.atk!;
        const ph = this.phase();
        target = ph === 'wind' ? a.wind : a.strike;
        speed = ph === 'wind' ? 24 : ph === 'active' ? 55 : 10;
        break;
      }
      case 'hurt':
        target = P.hurt;
        speed = 32;
        break;
      case 'blockstun':
        target = this.blocking === 'low' ? P.blockLo : P.blockHi;
        speed = 30;
        break;
      case 'stunned':
        target = { ...P.stunned, head: 0.3 + Math.sin(t * 9) * 0.3, torso: 0.2 + Math.sin(t * 4.5) * 0.15 };
        speed = 10;
        break;
      case 'down':
        target = this.onGround ? P.down : P.tumble;
        speed = this.onGround ? 14 : 8;
        break;
      case 'getup':
        target = P.getup;
        speed = 10;
        break;
      case 'block':
        target = this.blocking === 'low' ? P.blockLo : P.blockHi;
        speed = 28;
        break;
      case 'crouch':
        target = P.crouch;
        speed = 20;
        break;
      case 'magic':
        target = { ...P.magic, armF: P.magic.armF + Math.sin(t * 20) * 0.08, armB: P.magic.armB + Math.cos(t * 20) * 0.08 };
        speed = 10;
        break;
      case 'victory':
        target = { ...P.victory, armF: 2.9 + Math.sin(t * 7) * 0.25, bodyY: Math.abs(Math.sin(t * 7)) * 0.08 };
        speed = 12;
        break;
      case 'taunt':
        target = { ...P.taunt, bodyY: Math.abs(Math.sin(t * 8)) * 0.1, head: 0.3 + Math.sin(t * 8) * 0.15 };
        speed = 12;
        break;
      case 'roll':
        target = P.roll;
        speed = 40;
        break;
      case 'drag':
        target = { ...P.drag, legF: Math.sin(t * 8) * 0.4, legB: -Math.sin(t * 8) * 0.4 };
        speed = 14;
        break;
      case 'hold': {
        const knee = ((this.data.pummelT as number) ?? 0) > 0;
        target = knee
          ? { armF: 1.5, armB: 1.3, weapon: -2.0, torso: 0.3, head: -0.2, legF: 1.5, legB: -0.3, bodyY: 0.02 }
          : { armF: 1.35, armB: 1.2, weapon: -1.9, torso: -0.12, head: 0.05, legF: 0.35, legB: -0.35, bodyY: -0.05 };
        speed = knee ? 40 : 16;
        break;
      }
      case 'held':
        target = {
          armF: 2.4 + Math.sin(t * 18) * 0.6, armB: 2.2 + Math.cos(t * 16) * 0.6, weapon: -1.0, torso: 0.35, head: 0.45,
          legF: Math.sin(t * 14) * 0.7, legB: -Math.sin(t * 14) * 0.7, bodyY: 0, tilt: 0.25 + Math.sin(t * 9) * 0.08,
        };
        speed = 20;
        break;
      case 'ride':
        target = { torso: -0.05, head: 0.05, armF: 0.9, armB: 0.6, weapon: -1.5, legF: 1.25, legB: 1.05, bodyY: -0.1, ...this.poseMod };
        speed = 14;
        break;
      case 'dead': {
        if (this.headlessT > 0) {
          const ph = this.walkPh;
          target = {
            torso: -0.3, head: 0, armF: 2.3 + Math.sin(t * 19) * 0.9, armB: 1.9 + Math.cos(t * 17) * 0.9, weapon: -1.0,
            legF: Math.sin(ph) * 0.95, legB: -Math.sin(ph) * 0.95, bodyY: -0.04 + Math.abs(Math.cos(ph)) * 0.12, tilt: Math.sin(t * 5) * 0.1,
          };
          speed = 24;
        } else if (this.st < this.collapseT && !this.legless) {
          target = { ...P.hurt, armF: 2.2 + Math.sin(t * 20) * 0.6, armB: 2.0 + Math.cos(t * 18) * 0.6, legF: 0.2 + Math.sin(t * 14) * 0.2, bodyX: Math.sin(t * 11) * 0.03 };
          speed = 16;
        } else if (this.legless) {
          target = { ...P.down, tilt: 0.25 * this.fallDir, lift: 0, bodyY: -this.def.hipY + 0.22, armF: 1.8 + Math.sin(t * 6) * 0.3, armB: 1.6, head: 0.4, torso: -0.2 };
          speed = 10;
          if (this.st > 1.8) target = { ...target, tilt: 1.45 * this.fallDir, lift: 0.3, bodyY: -this.def.hipY + 0.1 };
        } else {
          target = { ...P.down, tilt: 1.5 * this.fallDir };
          speed = 7;
        }
        break;
      }
    }
    r.drive(target, speed, dt);
    if (this.state === 'roll') {
      r.pose.tilt = -(this.st / 0.5) * Math.PI * 2;
      r.pose.lift = 0.5;
      r.pose.bodyY = -this.def.hipY;
    }
    r.sync();
    let vf = this.facing;
    if (this.state === 'attack' && this.atk?.spin && this.phase() !== 'recover') vf = (Math.floor(this.st / 0.06) % 2 ? -1 : 1) * this.facing;
    r.setFacing(vf);
    r.root.position.set(this.pos.x, this.pos.y + (this.state === 'dead' && this.corpseLife < 900 && this.st > this.corpseLife && !(this.sinkRate > 0) ? r.root.position.y - this.pos.y : 0), this.pos.z);
    r.flash = this.flashT > 0 ? 0.85 : 0;
    r.root.visible = !(this.invuln > 0 && this.alive && Math.floor(this.invuln * 16) % 2 === 1);
    const h = Math.max(0, this.pos.y);
    const ss = this.size * (this.def.id === 'hogman' ? 1.5 : 1.15) * Math.max(0.4, 1 - h * 0.18);
    this.shadow.visible = !(this.state === 'dead' && (this.deathStyle === 'explode' || this.deathStyle === 'shatter' || this.sinkRate > 0 || this.envKill));
    this.shadow.scale.set(ss * 1.4, ss * 0.55, 1);
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
  }
}

export function snapPose(f: Fighter, p: Partial<Pose>) {
  f.rig.snap(p);
  f.rig.sync();
}
