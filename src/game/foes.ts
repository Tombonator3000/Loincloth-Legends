// Fiende-AI for brettene. Oppførselen styres av FoeDef.behavior.
import * as THREE from 'three';
import { Fighter } from './fighter';
import { ENEMY_ATK, type AttackDef } from './attacks';
import { W } from './world';
import type { Hero } from './hero';
import type { Projectiles, ProjKind } from './projectiles';
import { PANIC_BARKS, type FoeDef } from '../data/enemies';
import { audio } from '../core/audio';
import { screenFX } from '../gfx/screenfx';
import { attachDoor } from '../gfx/bossfx';
import { READ_BARKS } from './combo';
import { rand, chance, pick } from '../core/math';

export interface FoeWorld {
  frozen: boolean;
  camX: number;
  halfW: number;
  proj: Projectiles;
  nearestHero(p: THREE.Vector3): Hero | null;
  requestToken(f: Foe): boolean;
  releaseToken(f: Foe): void;
  onScreen(x: number, margin: number): boolean;
  /** Et bakkeslag (AttackDef.quake): istapper løsner og fyrfat velter (Stage). */
  onQuake?(x: number, z: number, r: number): void;
  /**
   * Tempoet fra regissøren og vanskelighetsgraden (game/director.ts): pace ganger nedkjølingene (under 1 er lengre
   * pauser), wind ganger opptrekket før slagene, dodge er sjansen for å gå til side for et prosjektil.
   */
  pace?: number;
  wind?: number;
  dodge?: number;
}

const windCache = new Map<string, AttackDef>();
/** Angrepet med opptrekket ganget med k (vanskelighetsgraden), lagret så det samme objektet brukes igjen. */
export function windUp(a: AttackDef, k: number) {
  if (Math.abs(k - 1) < 0.01) return a;
  const key = a.id + '~' + k.toFixed(2);
  let w = windCache.get(key);
  if (!w) {
    w = { ...a, id: key, startup: a.startup * k };
    windCache.set(key, w);
  }
  return w;
}

const PROJ_SPEC: Record<ProjKind, { speed: number; vy: number; grav: number; dmg: number }> = {
  dagger: { speed: 11, vy: 0, grav: 0, dmg: 7 },
  fireball: { speed: 8, vy: 0, grav: 0, dmg: 9 },
  bolt: { speed: 7.5, vy: 0, grav: 0, dmg: 9 },
  poison: { speed: 7, vy: 4, grav: 9, dmg: 8 },
  snowball: { speed: 9, vy: 5, grav: 12, dmg: 11 },
  shockwave: { speed: 8, vy: 0, grav: 0, dmg: 12 },
  meteor: { speed: 0, vy: 0, grav: 0, dmg: 18 },
  lightning: { speed: 0, vy: 0, grav: 0, dmg: 16 },
  tongue: { speed: 16, vy: 0, grav: 0, dmg: 8 },
};

/** Fart når en fiende rygger unna helten (andel av egen fart). */
const RETREAT = 0.5;
/** Hvor dypt under gulvet en vakt starter når han reiser seg. */
const RISE_DEPTH = 2.2;
/** Sjansen for at en fiende går til side når et prosjektil kommer (runde E, vanskelighetsgraden kan endre den). */
const DODGE_CHANCE = 0.6;
/** Høyeste fart i panikk. Helten går 3.85, så han tar dem alltid igjen. */
const PANIC_SPEED = 3.3;

export function fireProjectile(proj: Projectiles, owner: Fighter, kind: ProjKind, dirX: number, vz = 0, dmgMul = 1) {
  const s = PROJ_SPEC[kind];
  proj.spawn({
    kind, owner, x: owner.pos.x + dirX * 0.7 * owner.size, y: owner.pos.y + 1.3 * owner.size, z: owner.pos.z + 0.05,
    vx: dirX * s.speed, vy: s.vy, vz, grav: s.grav, dmg: s.dmg * dmgMul, life: 3,
  });
  audio.swish(1.3);
}

export class Foe {
  f: Fighter;
  token = false;
  cd = rand(0.6, 1.6);
  projCd = rand(1, 3);
  hoverDz = rand(-1.2, 1.2);
  hoverDx = rand(3, 4.6);
  side = 1;
  thrown = false;
  hits = 0;
  dir = 1;
  escaped = false;
  leapCd = rand(1, 2.5);
  quaked = false;
  /** Har vært inne i bildet. Da holdes han der (se Stage), så han ikke kan rygge ut dit helten ikke når. */
  entered = false;
  /** Panikk: sekunder igjen, hvilken vei han løper, og nedkjøling før neste gang. */
  panicT = 0;
  panicDir = 0;
  panicCd = rand(2, 5);
  private screamT = 0;
  /** Kjempegrepet: sekunder til han kan gripe igjen. */
  grabCd = rand(2, 4);
  /** Reiser seg av gulvet (vaktene i tårnet): sekunder igjen og hvor lang tid det tar. */
  riseT = 0;
  private riseDur = 1;
  /** Har lest helten (fire like slag på rad, game/combo.ts): blokkerer så lenge, og hvem han ser på. */
  blockT = 0;
  private blockAt: Fighter | null = null;
  /** Går til side for et prosjektil: sekunder igjen, retning i dybden og nedkjøling. */
  private dodgeT = 0;
  private dodgeDir = 1;
  private dodgeCd = rand(0.5, 1.5);

  constructor(public def: FoeDef, x: number, z: number, hpMul = 1) {
    // Litt variasjon per fiende, etter oppskriftssystemet i Toms Morbidium: størrelse og en svak fargetone, så en bølge
    // av samme type ikke ser klonet ut. Tonen tas i trinn, så hodet som klasker i skjermen (headImage) har få varianter.
    const base = def.tint ?? [1, 1, 1];
    const k = 0.9 + Math.floor(rand(0, 5)) * 0.04, warm = (Math.floor(rand(0, 5)) - 2) * 0.02;
    const tint: [number, number, number] = [base[0] * k * (1 + warm), base[1] * k, base[2] * k * (1 - warm)];
    const scale = (def.scale ?? 1) * rand(0.92, 1.08);
    this.f = new Fighter(def.char, 'enemy', { hp: def.hp * hpMul, speed: def.speed * rand(0.9, 1.1), tint, scale, poseMod: def.poseMod });
    this.f.label = def.name;
    this.f.guard = !!def.guard;
    this.f.pos.set(x, 0, z);
    if (def.poise) this.givePoise(def.poise);
    // Døra som skjold (skjelettvaktene)
    if (def.shield) {
      this.f.frontGuard = true;
      attachDoor(this.f.rig);
    }
  }

  /** Han har lest helten: blokkerer forfra i sek sekunder, og slår tilbake etterpå. */
  blockFor(sek: number, hero: Fighter) {
    const f = this.f;
    if (!f.alive || f.state === 'held' || f.state === 'down' || !f.onGround) return;
    this.blockT = sek;
    this.blockAt = hero;
    f.atk = null;
    f.setState('block');
    f.blocking = 'high';
    f.face(hero.pos.x - f.pos.x);
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), pick(READ_BARKS), 'speech', 1.3);
  }

  /** Reis deg av gulvet på sek sekunder: står under gulvet og kan ikke treffes før han er oppe. */
  rise(sek: number) {
    this.riseT = this.riseDur = sek;
    this.f.rising = true;
    this.f.pos.y = -RISE_DEPTH;
    this.f.onGround = true;
    this.cd = Math.max(this.cd, 0.6);
  }

  /** Kjemper: slagene biter ikke før han har tatt poise av livet sitt i skade, da vakler han (som sjefene). */
  private givePoise(poise: number) {
    const f = this.f;
    let taken = 0;
    f.armored = true;
    f.onArmorHit = (dmg) => {
      taken += dmg;
      if (taken < poise * f.maxHp || !f.alive) return;
      taken = 0;
      f.armored = false;
      f.hurt(0.9, 0);
      f.flash(0.2);
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), 'STAGGERED!', 'word');
    };
  }

  /** Kjempen kaster helten han holder, langt og høyt. Kastet gjør vondt. */
  private toss() {
    const f = this.f, t = f.holding!;
    f.holding = null;
    t.heldBy = null;
    // Kastebevegelsen er et «prosjektil»-angrep, så det treffer ingen selv, og thrown hindrer snøballen
    this.thrown = true;
    f.startAttack(ENEMY_ATK.throw);
    if (!t.alive) return;
    const dir = f.facing;
    t.pos.set(f.pos.x + dir * 1.1 * f.size, 0.9 * f.size, t.pos.z);
    t.knockdown(dir * 11, 8.5);
    t.hp -= 14 * t.dmgTaken;
    t.flash(0.15);
    if (t.hp <= 0) t.die('normal', dir, f);
    audio.swish(0.6, true);
    audio.grunt(f.def.voice);
    W.fx.shake(0.3);
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['TINY MAN FLY!', 'RETURN TO SENDER!', 'YEET!']), 'speech', 1.4);
  }

  /** Bakken rister der et tungt slag (AttackDef.quake) treffer: snø og støv spruter, sjokkbølge og risting. */
  private quake(r: number) {
    const f = this.f;
    const at = new THREE.Vector3(f.pos.x + f.facing * 1.6 * f.size, 0.15, f.pos.z);
    W.gore.dust(at, 26);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      W.gore.dust(new THREE.Vector3(at.x + Math.cos(a) * r * 0.45, 0.1, at.z + Math.sin(a) * r * 0.25), 3);
    }
    W.fx.shake(0.55);
    screenFX.shock(at, 0.7, 0.7, 1.2);
    audio.thud(f.size, true);
  }

  get kind() {
    return this.def.id;
  }

  update(dt: number, st: FoeWorld) {
    const f = this.f;
    if (!f.alive) {
      if (this.token) st.releaseToken(this);
      return;
    }
    f.wantVX = f.wantVZ = 0;
    if (st.frozen) return;
    // Reiser seg av gulvet: først armene, så resten, med støv og beinbiter rundt
    if (this.riseT > 0) {
      this.riseT -= dt;
      const k = Math.max(0, this.riseT / this.riseDur);
      f.pos.y = -RISE_DEPTH * k * k;
      f.onGround = true;
      if (Math.random() < dt * 14) W.gore.dust(new THREE.Vector3(f.pos.x + rand(-0.5, 0.5), 0.05, f.pos.z + rand(-0.3, 0.3)), 2);
      if (this.riseT <= 0) {
        f.pos.y = 0;
        f.rising = false;
        audio.bones();
        W.gore.gibs(new THREE.Vector3(f.pos.x, 0.2, f.pos.z), 2, 'bone', 0.5);
      }
      return;
    }
    // Rytter: dyret har egen AI (game/mounts.ts)
    if (f.mount) {
      if (this.token) st.releaseToken(this);
      return;
    }
    // Regissøren og vanskelighetsgraden styrer hvor fort nedkjølingene går
    const pace = st.pace ?? 1;
    this.cd -= dt * pace;
    this.projCd -= dt * pace;
    this.leapCd -= dt * pace;
    this.panicCd -= dt;
    this.grabCd -= dt * pace;
    this.dodgeCd -= dt;
    // Blokkerer etter å ha lest helten: står med guarden oppe og ser på ham, og slår tilbake med en gang etterpå
    // Slått ned, holdt eller guarden brutt: da er blokken over
    if (this.blockT > 0 && (f.state === 'down' || f.state === 'held' || f.state === 'stunned' || f.state === 'hurt')) this.blockT = 0;
    if (this.blockT > 0) {
      this.blockT -= dt;
      if (this.token) st.releaseToken(this);
      const by = this.blockAt;
      if (by) f.face(by.pos.x - f.pos.x);
      if (f.state === 'idle' || f.state === 'walk') {
        f.setState('block');
        f.blocking = 'high';
      }
      if (this.blockT <= 0) {
        if (f.state === 'block') f.setState('idle');
        this.cd = 0;
      }
      return;
    }
    if (this.token && f.state !== 'attack' && this.thrown) st.releaseToken(this);
    if (this.token && (f.state === 'hurt' || f.state === 'down' || f.state === 'held')) st.releaseToken(this);

    if (f.state === 'attack' && f.atk?.projectile && f.phase() === 'active' && !this.thrown) {
      this.thrown = true;
      if (this.def.proj) fireProjectile(st.proj, f, this.def.proj, f.facing);
    }
    if (f.state === 'attack' && f.phase() === 'active') this.thrown = true;
    // Kjempene: rustningen kommer tilbake når vaklingen er over, og bakkeslaget rister når det treffer
    if (this.def.poise && !f.armored && f.state !== 'hurt') f.armored = true;
    if (f.state === 'attack' && f.atk?.quake && f.phase() === 'active' && !this.quaked) {
      this.quaked = true;
      this.quake(f.atk.quake);
      st.onQuake?.(f.pos.x + f.facing * 1.6 * f.size, f.pos.z, f.atk.quake);
    }
    if (f.state !== 'attack') this.quaked = false;

    // Froskemannen: angrep i lufta
    if (this.def.behavior === 'jumper' && f.state === 'jump' && !f.airAttackUsed && f.vel.y < 2) {
      f.airAttackUsed = true;
      f.startAttack(this.def.air ?? { ...this.def.attack, id: 'air-' + this.def.id, air: true, kd: true, launch: 4 });
    }
    // Kjempen holder en helt: etter et sekund kastes han langt
    if (f.state === 'hold' && f.holding) {
      f.data.holdT = ((f.data.holdT as number) ?? 0) + dt;
      if ((f.data.holdT as number) > 1.0) this.toss();
      return;
    }
    if (this.panicT > 0) {
      this.panicT -= dt;
      if (this.token) st.releaseToken(this);
      if (this.panicT <= 0) this.calm();
      else if (f.canAct()) return this.flee(dt, st);
      else return;
    }
    if (!f.canAct()) return;
    if (this.def.behavior === 'runner') return this.runner(st);
    // Går til side for prosjektiler fra heltene (runde E): ser et komme langs linja og tar et steg opp eller ned
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      f.wantVZ = this.dodgeDir * f.speed * 1.2;
      return;
    }
    if (this.dodgeCd <= 0 && this.incoming(st)) {
      this.dodgeCd = rand(1.2, 2.2);
      if (chance(st.dodge ?? DODGE_CHANCE)) {
        this.dodgeT = 0.38;
        this.dodgeDir = f.pos.z > 1.2 ? -1 : f.pos.z < -1.2 ? 1 : pick([-1, 1]);
        return;
      }
    }

    const tgt = st.nearestHero(f.pos);
    if (!tgt) return;
    const tf = tgt.f;
    const dx = tf.pos.x - f.pos.x;
    const dz = tf.pos.z - f.pos.z;
    const adx = Math.abs(dx);
    this.side = f.pos.x > tf.pos.x ? 1 : -1;

    // Kast prosjektil (kultister, imper, trollet)
    if (this.def.proj && this.projCd <= 0 && adx > 3.2 && adx < 9 && Math.abs(dz) < 0.4 && st.onScreen(f.pos.x, 0.5)) {
      f.face(dx);
      this.thrown = false;
      f.startAttack(windUp(ENEMY_ATK.throw, st.wind ?? 1));
      const [a, b] = this.def.projCd ?? [2.5, 3.5];
      this.projCd = rand(a, b);
      return;
    }

    switch (this.def.behavior) {
      case 'ranged': {
        if (adx < 1.5 && Math.abs(dz) < 0.5 && this.cd <= 0) {
          f.face(dx);
          this.thrown = false;
          f.startAttack(windUp(this.def.attack, st.wind ?? 1));
          this.cd = rand(1.2, 2);
          return;
        }
        // Ønsket avstand innenfor bildet (det nye, nærmere kameraet er smalere)
        this.moveTo(tf.pos.x + this.side * Math.min(this.def.range, st.halfW * 0.7), tf.pos.z, 0.8, tf.pos.x);
        f.face(dx);
        return;
      }
      case 'shambler': {
        if (adx < this.def.range + 0.2 && Math.abs(dz) < 0.4 && this.cd <= 0) {
          f.face(dx);
          this.thrown = false;
          f.startAttack(windUp(this.def.attack, st.wind ?? 1));
          this.cd = rand(1.4, 2.4);
          return;
        }
        this.moveTo(tf.pos.x + this.side * (this.def.range - 0.2), tf.pos.z, 1, tf.pos.x);
        f.face(dx);
        return;
      }
      case 'jumper': {
        if (this.leapCd <= 0 && adx > 2.2 && adx < 5.5 && Math.abs(dz) < 1.2) {
          f.face(dx);
          const air = 0.72;
          f.jump((dx - Math.sign(dx) * 1.4) / air, dz / air, 9.4);
          this.leapCd = rand(2.5, 4);
          return;
        }
        break;
      }
    }
    // Nærkamp (melee, brute, jumper på bakken)
    const range = this.def.range;
    if (this.token || (this.cd <= 0 && st.requestToken(this))) {
      const tx = tf.pos.x + this.side * range;
      const near = Math.abs(f.pos.x - tx) < 0.45 && Math.abs(dz) < 0.3;
      if (near && this.cd <= 0) {
        f.face(dx);
        this.thrown = false;
        // Kjempen griper av og til i stedet for å slå
        const grab = !!this.def.grab && this.grabCd <= 0 && tf.state !== 'held' && !tf.mount && chance(0.45);
        f.startAttack(windUp(grab ? this.def.grab! : this.def.attack, st.wind ?? 1));
        if (grab) this.grabCd = rand(7, 11);
        this.cd = this.def.behavior === 'brute' ? rand(1.8, 3) : rand(1.1, 2.2);
        return;
      }
      this.moveTo(tx, tf.pos.z, 1, tf.pos.x);
    } else {
      if (chance(dt * 0.3)) this.hoverDz = rand(-1.5, 1.5);
      this.moveTo(tf.pos.x + this.side * Math.min(this.hoverDx, st.halfW * 0.55), tf.pos.z + this.hoverDz, 0.6, tf.pos.x);
    }
    f.face(dx);
  }

  /** Kommer et prosjektil fra heltene langs linja hans, og snart? */
  private incoming(st: FoeWorld) {
    const f = this.f;
    return st.proj.list.some((q) => q.alive && q.delay <= 0 && q.owner.team !== f.team && Math.abs(q.vel.x) > 2
      && Math.abs(q.pos.z - f.pos.z) < 0.55 && (f.pos.x - q.pos.x) * Math.sign(q.vel.x) > 0 && Math.abs(f.pos.x - q.pos.x) < 4.5);
  }

  /** Gå mot et punkt. awayFrom er heltens x: rygger fienden unna ham, går han på halv fart, så helten tar ham igjen. */
  private moveTo(x: number, z: number, speedMul: number, awayFrom?: number) {
    const f = this.f;
    const ddx = x - f.pos.x;
    const ddz = z - f.pos.z;
    const d = Math.hypot(ddx, ddz);
    if (d < 0.12) return;
    let sp = Math.min(f.speed * speedMul, d * 3);
    if (awayFrom !== undefined && ddx * (f.pos.x - awayFrom) > 0) sp *= RETREAT;
    f.wantVX = (ddx / d) * sp;
    f.wantVZ = (ddz / d) * sp * 0.75;
  }

  /**
   * Panikk i dur sekunder: løper vekk fra heltene i sikksakk, skriker og veiver med armene, og kommer tilbake etterpå.
   * Kjemper, tyver på flukt og ryttere får ikke panikk. force hopper over nedkjølingen (brann).
   */
  panic(dur: number, force = false) {
    const f = this.f;
    if (this.def.poise || this.def.behavior === 'runner' || !f.alive || f.mount || f.state === 'held') return false;
    if (!force && (this.panicT > 0 || this.panicCd > 0)) return false;
    const first = this.panicT <= 0;
    this.panicT = Math.max(this.panicT, dur);
    this.panicDir = 0;
    f.panicking = true;
    if (first) {
      this.screamT = rand(1, 1.8);
      audio.scream(this.f.def.voice);
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), pick(PANIC_BARKS), 'speech', 1.6);
    }
    return true;
  }

  private calm() {
    const f = this.f;
    this.panicT = 0;
    f.panicking = false;
    f.running = false;
    if (f.state === 'flee') f.state = 'idle';
    this.cd = rand(0.4, 1);
    this.panicCd = rand(6, 12);
  }

  /** Panikkflukten: bort fra nærmeste helt, snur ved kanten av bildet, alltid saktere enn helten går. */
  private flee(dt: number, st: FoeWorld) {
    const f = this.f;
    if (!this.panicDir) {
      const h = st.nearestHero(f.pos);
      this.panicDir = h ? (f.pos.x >= h.f.pos.x ? 1 : -1) : pick([-1, 1]);
    }
    const edge = st.camX + this.panicDir * (st.halfW - 1);
    if (this.panicDir * (f.pos.x - edge) > 0) this.panicDir = -this.panicDir;
    f.running = true;
    f.state = 'flee';
    f.wantVX = this.panicDir * Math.min(f.speed * 1.3, PANIC_SPEED);
    f.wantVZ = Math.sin(W.time * 4.5 + f.id * 1.7) * 2.2;
    f.face(this.panicDir);
    this.screamT -= dt;
    if (this.screamT <= 0) {
      this.screamT = rand(1.2, 2.2);
      audio.scream(this.f.def.voice);
    }
  }

  private runner(st: FoeWorld) {
    const f = this.f;
    f.running = true;
    f.state = 'flee';
    f.wantVX = this.dir * f.speed * (this.hits > 0 ? 1.4 : 1);
    f.wantVZ = Math.sin(W.time * 2 + f.id) * 1.2;
    f.face(this.dir);
    const out = this.dir > 0 ? f.pos.x > st.camX + st.halfW + 2.5 : f.pos.x < st.camX - st.halfW - 2.5;
    if (out) {
      this.escaped = true;
      f.removeMe = true;
      f.alive = false;
    }
  }
}
