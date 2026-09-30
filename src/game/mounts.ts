// Ridedyr: rytteren styrer dyret, angrepsknappen bruker dyrets angrep (stormløp, halesvip, ildpust).
// Treff på rytteren kaster ham av. Etter tre avkastinger har dyret fått nok og stikker av.
import * as THREE from 'three';
import { Fighter, GRAVITY, type Bounds, type MountLike } from './fighter';
import { P, type AttackDef } from './attacks';
import { applyHit } from './combat';
import { W } from './world';
import { BeastRig } from '../gfx/beast';
import { BEASTS } from '../gfx/chars/beasts';
import { plainCanvas } from '../gfx/draw';
import type { MountDef } from '../data/mounts';
import { audio } from '../core/audio';
import { rand, pick, clamp, chance } from '../core/math';

const base = (a: Partial<AttackDef> & Pick<AttackDef, 'id'>): AttackDef => ({
  startup: 0, active: 0.1, recovery: 0, dmg: 12, reach: 2, zr: 0.9, height: 'mid', kd: true, launch: 6, push: 7, stun: 0.6, heavy: true,
  wind: P.hurt, strike: P.hurt, death: ['explode', 'normal'], swoosh: 'none', ...a,
});
/** Hvor langt inn fra kanten av bildet en fiende-rytter holder standplassen (midten av dyret, i enheter). */
const MOUNT_EDGE = 1.3;
/** Sekunder en fiende-rytter venter etter at helten har kommet seg på beina, før han angriper igjen. */
const RIDER_GRACE = 0.7;
const GORE = base({ id: 'gore', dmg: 14, launch: 7, push: 9, death: ['explode', 'bisect', 'normal'], word: ['GORED!', 'SNORT!', 'TUSKED!'] });
const WHIP = base({ id: 'whip', dmg: 11, launch: 5.5, push: 7, death: ['dismember', 'decap', 'normal'], word: ['WHIPPED!', 'BAWK!', 'TAIL SLAP!'] });
const FLAME = base({ id: 'flame', dmg: 7, kd: false, heavy: false, launch: 0, push: 1.8, stun: 0.35, death: ['normal'], word: ['TOASTY!'] });

let shadowMat: THREE.MeshBasicMaterial | null = null;
function mountShadow() {
  if (!shadowMat) {
    const t = new THREE.CanvasTexture(plainCanvas(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(20,10,5,0.55)');
      g.addColorStop(1, 'rgba(20,10,5,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }));
    shadowMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  }
  return shadowMat;
}

export interface MountWorld {
  /** Fightere på helte-siden og fiende-siden (for treff og AI). */
  heroFighters(): Fighter[];
  foeFighters(): Fighter[];
  /** Grensene dette dyret kan bevege seg innenfor. */
  mountBounds(m: Mount): Bounds;
  camX: number;
  halfW: number;
}

type MState = 'idle' | 'walk' | 'charge' | 'tail' | 'fire' | 'wild' | 'flee';

export class Mount implements MountLike {
  rig: BeastRig;
  shadow: THREE.Mesh;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  facing = -1;
  rider: Fighter | null = null;
  state: MState = 'wild';
  t = 0;
  cd = 0;
  falls = 0;
  walkPh = 0;
  wantX = 0;
  wantZ = 0;
  running = false;
  onGround = true;
  removeMe = false;
  /**
   * Dyret er inne i bildet med en fiende på ryggen, eller uten rytter under en bølge. Da holdes det der (se
   * Stage.mountBounds), så helten når rytteren, og en fiende som setter seg opp, gjør det inne i bildet.
   */
  entered = false;
  /** Fiende-rytteren rygger: dyret ser mot helten mens det går bakover, så det kan angripe når det er klart. */
  private backing = false;
  private hits = new Set<number>();
  private tick = 0;
  private remountT = 0;
  /** Angrep som ble trykket litt for tidlig (utføres når dyret er klart). */
  private queued = 0;

  constructor(public def: MountDef, x: number, z: number) {
    this.rig = new BeastRig(BEASTS[def.beast]);
    this.pos.set(x, 0, z);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mountShadow());
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
  }

  get size() {
    return this.rig.scale;
  }

  addTo(scene: THREE.Object3D) {
    scene.add(this.rig.root, this.shadow);
    this.sync();
  }

  remove() {
    this.rig.root.removeFromParent();
    this.shadow.removeFromParent();
  }

  // ---------------------------------------------------------------- MountLike
  saddle(out: THREE.Vector3) {
    const r = this.rider;
    const J = this.rig.def.joints;
    const s = this.size;
    const hip = r ? r.def.hipY * r.size : 0.6;
    out.set(this.pos.x + this.facing * J.saddle[0] * s, this.pos.y + (this.rig.def.bodyY + this.rig.pose.bodyY + J.saddle[1]) * s - hip + 0.12, this.pos.z + 0.05);
    return out;
  }

  drive(ax: number, az: number, run: boolean) {
    this.wantX = ax;
    this.wantZ = az;
    this.running = run;
  }

  attack() {
    if (!this.rider) return;
    if (this.cd > 0 || (this.state !== 'idle' && this.state !== 'walk')) {
      this.queued = 0.4;
      return;
    }
    this.queued = 0;
    this.state = this.def.attack;
    this.t = 0;
    this.hits.clear();
    this.cd = this.def.cd;
    audio.scream(this.def.voice);
  }

  hop() {
    if (!this.onGround || (this.state !== 'idle' && this.state !== 'walk')) return;
    this.onGround = false;
    this.vel.y = 9;
    audio.jump();
    W.gore.dust(this.pos, 6);
  }

  mountUp(f: Fighter) {
    if (this.rider || this.state === 'flee') return false;
    this.rider = f;
    f.mount = this;
    f.atk = null;
    f.setState('ride');
    f.vel.set(0, 0, 0);
    f.onGround = true;
    this.facing = f.facing;
    this.state = 'idle';
    this.cd = 0.2;
    audio.grunt(this.def.voice);
    if (f.team === 'hero') W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.2, 0)), pick(this.def.mountLines), 'speech', 1.8);
    return true;
  }

  dismount(knocked: boolean) {
    const r = this.rider;
    if (!r) return;
    this.rider = null;
    r.mount = null;
    this.state = 'wild';
    this.t = 0;
    this.remountT = 2;
    if (!r.alive) {
      r.onGround = false;
      r.vel.set(-this.facing * 1.5, 2, 0);
      return;
    }
    if (knocked) {
      this.falls++;
      if (r.state !== 'down') r.knockdown(-this.facing * 3, 6);
      audio.scream(this.def.voice);
      if (this.falls >= 3) {
        this.state = 'flee';
        W.fx.text(this.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), 'BAIL!', 'word');
        if (r.team === 'hero') setTimeout(() => W.fx.text(this.pos.clone().add(new THREE.Vector3(0, 3, 0)), this.def.fleeLine, 'speech', 2.4), 300);
      }
    } else {
      r.setState('idle');
      r.jump(-this.facing * 2, 0, 7);
    }
  }

  // ---------------------------------------------------------------- oppdatering
  update(dt: number, w: MountWorld) {
    this.t += dt;
    this.cd -= dt;
    this.remountT -= dt;
    const r = this.rider;
    if (r && (!r.alive || (r.state !== 'ride' && r.state !== 'magic'))) this.dismount(true);
    if (this.queued > 0) {
      this.queued -= dt;
      if (this.cd <= 0 && (this.state === 'idle' || this.state === 'walk')) this.attack();
    }

    const spd = this.def.speed;
    switch (this.state) {
      case 'idle':
      case 'walk': {
        if (this.rider?.team === 'enemy') this.ai(w);
        // AI-en startet et angrep: ikke overskriv det med gange (før angrep fiende-rytterne aldri, Tom 2026-09-30)
        if (this.state !== 'idle' && this.state !== 'walk') break;
        const len = Math.hypot(this.wantX, this.wantZ);
        const sp = this.rider ? spd * (this.running ? 1.35 : 1) : 0;
        if (this.onGround) {
          this.vel.x = len > 0.05 ? (this.wantX / Math.max(1, len)) * sp : this.vel.x * 0.8;
          this.vel.z = len > 0.05 ? (this.wantZ / Math.max(1, len)) * sp * 0.7 : this.vel.z * 0.8;
        }
        if (Math.abs(this.wantX) > 0.05 && !this.backing) this.facing = Math.sign(this.wantX);
        this.state = len > 0.05 ? 'walk' : 'idle';
        break;
      }
      case 'charge': {
        const wind = 0.28;
        if (this.t < wind) this.vel.x *= 0.8;
        else this.vel.x = this.facing * 11;
        this.vel.z *= 0.8;
        if (this.t > wind) {
          this.hitZone(w, -0.3, 2.0, 0.9, GORE);
          if (chance(dt * 30)) W.gore.dust(this.pos, 2);
        }
        if (this.t > wind + 0.5) this.state = 'idle';
        break;
      }
      case 'tail': {
        this.vel.x *= 0.85;
        this.vel.z *= 0.85;
        if (this.t > 0.12 && this.t < 0.45) this.hitZone(w, -2.4, 2.4, 1.0, WHIP);
        if (this.t > 0.12 && this.t - dt <= 0.12) {
          audio.swish(0.8, true);
          W.fx.swoosh(this.pos.x, 1.0, this.pos.z, 4.6, 0, 1, '#ffffff', 0.3);
          W.fx.swoosh(this.pos.x, 1.0, this.pos.z, 4.6, Math.PI, 1, '#ffffff', 0.3);
        }
        if (this.t > 0.6) this.state = 'idle';
        break;
      }
      case 'fire': {
        this.vel.x *= 0.85;
        this.vel.z *= 0.85;
        if (this.t > 0.25 && this.t < 1.2) {
          const mouth = this.rig.worldPoint(0.95, -0.02, 'head');
          for (let i = 0; i < 3; i++) {
            const k = rand(0, 1);
            W.gore.fire(new THREE.Vector3(mouth.x + this.facing * k * 3.2, mouth.y - k * 0.5 + rand(-0.2, 0.2), this.pos.z + rand(-0.3, 0.3)), 1, 0.15 + k * 0.3, 1.2);
          }
          if (this.t - dt <= 0.25) audio.fireBreath(0.95);
          // Treff hvert 0.2 sekund (hitZone nullstilles)
          this.tick -= dt;
          if (this.tick <= 0) {
            this.tick = 0.2;
            this.hits.clear();
          }
          this.hitZone(w, 0.2, 3.6, 0.7, FLAME, true);
        }
        if (this.t > 1.35) this.state = 'idle';
        break;
      }
      case 'wild': {
        // Løper litt rundt, så står den og venter på en ny rytter
        const k = Math.max(0, 1 - this.t / 1.5);
        this.vel.x = -this.facing * spd * 0.7 * k;
        this.vel.z *= 0.9;
        if (this.t > 1.5 && chance(dt * 0.4)) this.facing = -this.facing;
        // Fiender kan sette seg opp igjen
        if (this.remountT <= 0) {
          for (const f of w.foeFighters()) {
            if (!f.alive || f.mount || !f.canAct() || f.armored) continue;
            if (Math.abs(f.pos.x - this.pos.x) < 1.1 && Math.abs(f.pos.z - this.pos.z) < 0.7 && chance(dt * 1.5)) {
              this.mountUp(f);
              break;
            }
          }
        }
        break;
      }
      case 'flee':
        this.vel.x = this.facing * spd * 1.3;
        if (this.t < 0.1) this.facing = this.pos.x < w.camX ? -1 : 1;
        if (Math.abs(this.pos.x - w.camX) > w.halfW + 4) this.removeMe = true;
        break;
    }

    // Fysikk
    if (!this.onGround) {
      this.vel.y -= GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vel.y = 0;
        this.onGround = true;
        audio.thud();
        W.gore.dust(this.pos, 8);
      }
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const b = w.mountBounds(this);
    if (this.state !== 'flee') this.pos.x = clamp(this.pos.x, b.minX + 0.6, b.maxX - 0.6);
    this.pos.z = clamp(this.pos.z, b.minZ, b.maxZ);
    if (Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.3) this.walkPh += dt * (6 + Math.abs(this.vel.x) * 1.4);
    this.animate(dt);
    if (this.rider) this.rider.facing = this.facing;
  }

  /** Fiende-rytter: finn nærmeste helt og bruk dyrets angrep når han er innen rekkevidde. */
  private ai(w: MountWorld) {
    this.backing = false;
    let tgt: Fighter | null = null;
    let bd = 1e9;
    for (const h of w.heroFighters()) {
      if (!h.alive) continue;
      const d = Math.abs(h.pos.x - this.pos.x) + Math.abs(h.pos.z - this.pos.z);
      if (d < bd) {
        bd = d;
        tgt = h;
      }
    }
    if (!tgt) {
      this.drive(0, 0, false);
      return;
    }
    const dx = tgt.pos.x - this.pos.x;
    const dz = tgt.pos.z - this.pos.z;
    const want = this.def.attack === 'charge' ? 4.2 : this.def.attack === 'fire' ? 2.4 : 1.6;
    const side = dx > 0 ? -1 : 1;
    // Standplassen holdes inne i bildet. Kameraet står stille under en bølge, og før rygget villsvinet og salamanderen
    // ut av bildet for å holde avstand, dit helten aldri nådde dem (Tom 2026-09-30)
    const tx = clamp(tgt.pos.x + side * want, w.camX - w.halfW + MOUNT_EDGE, w.camX + w.halfW - MOUNT_EDGE);
    const inLine = Math.abs(dz) < 0.45;
    // Halesvippen når 2,4 bakover og forover, lenger enn heltens slag. Den brukes først når helten er innenfor 1,8, så
    // han kan rekke å slå rytteren av først (ellers svippet kakatrissen ham ned hver gang han kom nær)
    const inRange = this.def.attack === 'charge' ? Math.abs(dx) < 5.5 && Math.abs(dx) > 1.5 : Math.abs(dx) < (this.def.attack === 'tail' ? 1.8 : want + 0.6);
    // Ligger helten nede eller reiser seg, venter rytteren, og gir ham et øyeblikk på beina før neste angrep
    if (tgt.state === 'down' || tgt.state === 'getup' || tgt.invuln > 0) this.cd = Math.max(this.cd, RIDER_GRACE);
    // Ingen angrep fra utenfor bildet: rytteren må ha ridd inn først
    if (this.entered && this.cd <= 0 && inLine && inRange && Math.sign(dx) === this.facing) {
      this.attack();
      this.cd = this.def.cd * 2 + rand(0.5, 1.2);
      return;
    }
    // Rygger dyret unna helten, går det på halv fart og ser mot ham, så helten tar det igjen (som fiendene til fots,
    // RETREAT i foes.ts), og dyret kan angripe så snart det har avstand nok
    const dir = Math.abs(tx - this.pos.x) > 0.3 ? Math.sign(tx - this.pos.x) : 0;
    this.backing = dir !== 0 && dir === -Math.sign(dx);
    const mx = dir * (this.backing ? 0.3 : 0.6);
    this.drive(mx, Math.abs(dz) > 0.15 ? Math.sign(dz) * 0.7 : 0, false);
    if (Math.abs(mx) < 0.01 || this.backing) this.facing = Math.sign(dx) || this.facing;
  }

  /** Treff alle motstandere i en sone foran/bak dyret. */
  private hitZone(w: MountWorld, x0: number, x1: number, zr: number, a: AttackDef, burn = false) {
    const r = this.rider;
    if (!r) return;
    const targets = r.team === 'hero' ? w.foeFighters() : w.heroFighters();
    const s = this.size;
    for (const t of targets) {
      if (!t.alive || t === r || t.invuln > 0 || t.state === 'held' || this.hits.has(t.id)) continue;
      if (t.state === 'down' && t.onGround) continue;
      const dx = (t.pos.x - this.pos.x) * this.facing;
      if (dx < x0 * s || dx > x1 * s || Math.abs(t.pos.z - this.pos.z) > zr || t.pos.y > 2.4) continue;
      this.hits.add(t.id);
      const res = applyHit(r, t, { ...a, dmg: this.def.dmg * (a === FLAME ? 1 : 1) });
      if (burn && res.killed) {
        t.rig.setTint([0.3, 0.22, 0.18]);
        W.gore.fire(t.torsoPoint(), 16, 0.4, 3);
        W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['FLAME-GRILLED!', 'CHARBROILED!', 'MEDIUM RARE!']), 'kill big');
      }
    }
  }

  private animate(dt: number) {
    const rig = this.rig;
    const moving = Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.3;
    const ph = this.walkPh;
    const tt = W.time;
    let target: Partial<import('../gfx/beast').BeastPose> = { head: Math.sin(tt * 2) * 0.04, tail: Math.sin(tt * 3) * 0.1, bodyY: Math.sin(tt * 2.5) * 0.02 };
    let speed = 10;
    if (moving && (this.state === 'walk' || this.state === 'wild' || this.state === 'flee' || this.state === 'idle')) {
      const s = Math.sin(ph);
      target = { legA: s * 0.55, legB: -s * 0.55, bodyY: Math.abs(Math.cos(ph)) * 0.06, head: Math.cos(ph) * 0.08, tail: Math.sin(ph * 0.5) * 0.25 };
      speed = 18;
    }
    if (this.state === 'charge') {
      const s = Math.sin(ph * 1.5);
      target = this.t < 0.28 ? { head: 0.4, tilt: 0.15, bodyY: 0.05, legA: -0.4, legB: 0.4 } : { head: -0.35, tilt: -0.12, legA: s * 0.9, legB: -s * 0.9, tail: 0.5 };
      speed = 22;
    } else if (this.state === 'tail') {
      target = { tail: this.t < 0.12 ? -0.6 : 2.4, head: -0.2, tilt: 0.05 };
      speed = 30;
    } else if (this.state === 'fire') {
      target = this.t < 0.25 ? { head: 0.5, tilt: 0.08 } : { head: -0.12 + Math.sin(tt * 30) * 0.03, tilt: -0.04 };
      speed = 16;
    } else if (!this.onGround) {
      target = { legA: 0.7, legB: -0.7, head: 0.2, tail: 0.4 };
    }
    rig.drive(target, speed, dt);
    rig.sync();
    rig.setFacing(this.facing);
    // Snurr under halesvipen
    if (this.state === 'tail' && this.t > 0.12 && this.t < 0.45) rig.setFacing(Math.floor(this.t / 0.07) % 2 ? -this.facing : this.facing);
    this.sync();
  }

  private sync() {
    this.rig.root.position.copy(this.pos);
    this.rig.root.visible = this.state !== 'flee' || Math.floor(this.t * 10) % 2 === 0 || this.t < 0.5;
    const s = this.size * 2.2 * Math.max(0.4, 1 - this.pos.y * 0.2);
    this.shadow.scale.set(s, s * 0.32, 1);
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
  }
}
