// Sjef-AI: velger vektede trekk (nærkamp, stormløp, magaplask, byks, skyting, innkalling, teleport, tunge, regn).
// Runde E (docs/PLAN_BRETT_GORR_AI.md 6.4): faser ved 66 og 33 prosent (BossDef.phases) med nye og sterkere trekk,
// røde trekk som ikke kan avbrytes, og et vindu etter de store trekkene der sjefen er sliten og slagene biter.
// Nye trekk: måltidet (Hogmother spiser og får liv tilbake om ingen avbryter), dykket (Croakus kommer opp der
// skyggen er), speilbildene (bare den ekte Vorthax kaster skygge) og solstrålen. Lavasporet (Magmor) er en fase.
// Sluttkampen i tårnet (BossDef.finale): Vorthax står på tronen bak skjoldet mens vaktene slåss (mode 'throne').
import * as THREE from 'three';
import { Fighter, GRAVITY } from './fighter';
import { P, ENEMY_ATK, type AttackDef } from './attacks';
import { applyHit } from './combat';
import { W } from './world';
import { screenFX } from '../gfx/screenfx';
import { fireProjectile } from './foes';
import type { Hero } from './hero';
import type { Projectiles } from './projectiles';
import type { BossDef, BossMove, BossPhase } from '../data/bosses';
import { DiveShadow, SunBeamFx, drumstick, holdInHand } from '../gfx/bossfx';
import { audio } from '../core/audio';
import { rand, pick, clamp } from '../core/math';
import { settings } from '../core/settings';
import { DIFFICULTY } from '../data/difficulty';

export interface BossWorld {
  heroes: Hero[];
  proj: Projectiles;
  frozen: boolean;
  camX: number;
  halfW: number;
  spawnFoe(id: string, side: 'L' | 'R'): void;
  /** En fiende som reiser seg av gulvet (vaktene i tårnet). */
  spawnRising?(id: string, x: number, z: number): void;
  addsAlive(): number;
  say(who: string, text: string, dur?: number): void;
  /** Lava i sporene (Magmor): en flekk som brenner den som går i den i sek sekunder. */
  lava?(x: number, z: number, sek: number): void;
  /** En ny fase har begynt (Stage lager lys, farge og Solhjertet). */
  onPhase?(b: BossCtl, ph: BossPhase, i: number): void;
}

const CHARGE: AttackDef = {
  id: 'charge', startup: 0.7, active: 1.0, recovery: 0.9, dmg: 14, reach: 2.2, back: 0.6, zr: 1.2, height: 'mid', kd: true, launch: 7, push: 9, stun: 0.6,
  lunge: 10, heavy: true, armor: true, wind: { ...P.crouch, torso: -0.6 }, strike: P.dashS, death: ['explode'], swoosh: 'none', word: ['SPLAT!'],
};
const CAST: AttackDef = { ...ENEMY_ATK.throw, id: 'cast', startup: 0.5, recovery: 0.5, armor: true };
const SLAM_AOE: AttackDef = { ...ENEMY_ATK.hog, id: 'slam', kd: true, launch: 8, push: 6, dmg: 16, death: ['explode'] };
const CHOMP: AttackDef = { ...ENEMY_ATK.hog, id: 'chomp', dmg: 12, kd: true, launch: 5, push: 6, death: ['decap'] };
/** Måltidet: armen med kyllinglåret til munnen (bare stillinger, treffer ingen). */
const FEAST: AttackDef = {
  ...ENEMY_ATK.throw, id: 'feast', startup: 2.4, active: 0.05, recovery: 0.3,
  wind: { armF: 2.5, weapon: -1.2, armB: 0.6, torso: 0.25, head: -0.35, bodyY: -0.04 }, strike: { armF: 0.5, armB: 0.4, torso: -0.1, head: 0.1 },
};
/** Croakus kommer opp av bakken under helten. */
const ERUPT: AttackDef = { ...SLAM_AOE, id: 'erupt', dmg: 18, launch: 9, push: 5, death: ['explode', 'decap'] };
/** Solstrålen. */
const SUNBEAM: AttackDef = { ...ENEMY_ATK.hog, id: 'sunbeam', dmg: 22, kd: true, launch: 7, push: 8, heavy: true, death: ['explode'] };
/** Speilbildene later som de kaster (bare stillingene, treffer ingen). */
const FAKE_CAST: AttackDef = { ...CAST, id: 'fakecast', projectile: true };

/** Vorthax' kopier lever så lenge, så forsvinner de. */
const MIRROR_LIFE = 8;
/** Skadetrinnet som avbryter måltidet (andel av maks liv tatt mens hun spiser). */
const FEAST_BREAK = 0.05;

export class BossCtl {
  f: Fighter;
  moves: BossMove[];
  cds: number[];
  cur: BossMove | null = null;
  mode: 'intro' | 'throne' | 'think' | 'exec' | 'tired' | 'block' | 'dead' = 'intro';
  t = 0;
  thinkT = 0.8;
  /** Faser som er begynt (indeks i def.phases). */
  phase = 0;
  stagger = 0;
  speedMul = 1;
  cdMul = 1;
  target: Hero | null = null;
  landed = false;
  pullTarget: Fighter | null = null;
  /** Sliten etter et stort trekk: sekunder igjen. Da biter slagene (og gjør litt mer skade). */
  tiredT = 0;
  /** Lava i sporene (Magmor fra første fase). */
  trail = false;
  private trailAt = new THREE.Vector3();
  /** Speilbildene (Vorthax): figurer som tar ingen skade og forsvinner når de blir truffet. */
  copies: Fighter[] = [];
  private copyT = 0;
  /** Måltidet: skade tatt mens hun spiser, og kyllinglåret i neven. */
  private feastDmg = 0;
  private dropFood: (() => void) | null = null;
  /** Dykket: hvor skyggen er, og om han er under bakken. */
  private shadow: DiveShadow | null = null;
  private under = false;
  private diveAt = new THREE.Vector3();
  /** Solstrålen: høyden (z) den går i, retningen og effekten. */
  private beamZ = 0;
  private beamDir = 1;
  private beamFx: SunBeamFx | null = null;
  /** Heltene strålen har truffet (én gang per stråle). */
  private beamHit = new Set<Fighter>();
  /** Tronen (sluttkampen): der han står mens vaktene slåss. */
  throne: THREE.Vector3 | null = null;
  private throneCast = rand(4, 6);
  /** Rødt blink før røde trekk. */
  private redT = 0;
  /** Har lest helten (game/combo.ts): blokkerer så lenge, og hvem han ser på. */
  private blockT = 0;
  private blockAt: Fighter | null = null;

  constructor(public def: BossDef, x: number, z: number, hpMul: number, private w: BossWorld, throne?: THREE.Vector3) {
    this.f = new Fighter(def.char, 'enemy', { hp: def.hp * hpMul, speed: def.speed, tint: def.tint });
    this.f.label = def.name;
    this.f.pos.set(x, 0, z);
    this.f.facing = -1;
    this.f.armored = true;
    this.f.kdImmune = true;
    this.f.noSever = true;
    this.f.corpseLife = 999;
    this.moves = def.moves.map((m) => ({ ...m }));
    this.cds = this.moves.map((m) => m.cd * 0.5);
    if (throne) {
      this.throne = throne.clone();
      this.mode = 'throne';
      this.f.pos.copy(throne);
      this.f.shielded = true;
    }
    this.f.onArmorHit = (dmg) => {
      if (this.cur?.kind === 'feast') this.feastDmg += dmg;
      // Røde trekk kan ikke avbrytes
      if (this.mode === 'exec' && this.cur?.red) return;
      this.stagger += dmg;
      if (this.stagger > this.def.stagger * this.f.maxHp && this.mode !== 'dead') {
        this.stagger = 0;
        this.interrupt();
        this.f.armored = false;
        this.f.hurt(0.8, 0);
        this.f.flash(0.2);
        W.fx.text(this.f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), 'STAGGERED!', 'word');
      }
    };
    this.f.onLand = () => {
      if (this.mode === 'exec' && (this.cur?.kind === 'slam' || this.cur?.kind === 'leap')) this.landed = true;
    };
  }

  private interrupt() {
    if (this.cur?.kind === 'feast') this.endFeast(false);
    if (this.cur?.kind === 'dive' && this.under) this.surface();
    if (this.f.pos.y < 0) this.f.pos.y = 0;
    this.beamFx?.hide();
    this.cur = null;
    this.mode = 'think';
    this.thinkT = 0.6;
    this.f.rig.root.visible = true;
  }

  private pickTarget() {
    const alive = this.w.heroes.filter((h) => h.f.alive);
    if (!alive.length) return null;
    return alive.reduce((a, b) => (Math.abs(a.f.pos.x - this.f.pos.x) < Math.abs(b.f.pos.x - this.f.pos.x) ? a : b));
  }

  /** Livsandelen fasene er regnet mot. */
  get hpFrac() {
    return Math.max(0, this.f.hp) / this.f.maxHp;
  }

  update(dt: number) {
    const f = this.f;
    f.wantVX = f.wantVZ = 0;
    if (!f.alive) {
      if (this.mode !== 'dead') this.cleanup();
      this.mode = 'dead';
      return;
    }
    if (this.w.frozen) return;
    if (f.state !== 'hurt' && this.tiredT <= 0 && !f.armored) f.armored = true;
    for (let i = 0; i < this.cds.length; i++) this.cds[i] -= dt;
    this.t += dt;
    this.updateCopies(dt);
    if (this.redT > 0) {
      this.redT -= dt;
      f.flash(Math.sin(this.redT * 40) > 0 ? 0.1 : 0);
      if (this.redT <= 0) f.rig.setFlashColor(1, 1, 1);
    }

    // Fasene: ved 66 og 33 prosent (ikke mens han står på tronen)
    const next = this.def.phases[this.phase];
    if (next && this.mode !== 'throne' && f.hp <= f.maxHp * next.at) this.enterPhase(next, this.phase++);

    this.target = this.pickTarget();
    const tgt = this.target?.f;
    if (!tgt) return;
    const dx = tgt.pos.x - f.pos.x;
    const dz = tgt.pos.z - f.pos.z;
    const d = Math.abs(dx);

    // Lava i sporene (Magmor): en flekk for hver meter han går
    if (this.trail && f.onGround && f.rig.root.visible && this.mode !== 'intro') {
      if (this.trailAt.distanceTo(f.pos) > 0.9) {
        this.trailAt.copy(f.pos);
        this.w.lava?.(f.pos.x - f.facing * 0.5, f.pos.z, 5);
      }
    }

    if (this.mode === 'throne') return this.onThrone(dt, tgt);

    if (this.mode === 'intro') {
      if (this.t > 2.4) {
        this.mode = 'think';
        this.thinkT = 0.3;
      } else {
        f.wantVX = -f.speed * 0.8;
        f.face(-1);
      }
      return;
    }

    if (this.mode === 'block') {
      this.blockT -= dt;
      if (this.blockAt) f.face(this.blockAt.pos.x - f.pos.x);
      if (f.state === 'idle' || f.state === 'walk') {
        f.setState('block');
        f.blocking = 'high';
      }
      if (this.blockT <= 0 || f.state === 'hurt') {
        if (f.state === 'block') f.setState('idle');
        // Slår tilbake med en gang
        this.mode = 'think';
        this.thinkT = 0.05;
      }
      return;
    }

    if (this.mode === 'tired') {
      this.tiredT -= dt;
      f.armored = false;
      // Svetten spruter av ham
      if (Math.random() < dt * 8) {
        const hp = f.headPoint();
        W.gore.ambient(hp.x + rand(-0.3, 0.3), hp.y, f.pos.z + 0.1, rand(-0.8, 0.8), rand(1, 2), '#cfe8ff', 0.05, 0.8, false, 9);
      }
      if (this.tiredT <= 0) {
        this.tiredT = 0;
        f.dmgTaken = 1;
        f.armored = true;
        if (f.state === 'stunned') f.setState('idle');
        this.mode = 'think';
        this.thinkT = 0.4 / this.speedMul;
      }
      return;
    }

    if (this.mode === 'think') {
      if (!f.canAct()) return;
      this.thinkT -= dt;
      f.face(dx);
      // Gå mot en behagelig avstand
      const want = 2.2;
      if (d > want + 0.5) f.wantVX = Math.sign(dx) * f.speed;
      else if (d < want - 0.6) f.wantVX = -Math.sign(dx) * f.speed * 0.6;
      f.wantVZ = clamp(dz * 2, -f.speed * 0.6, f.speed * 0.6);
      if (this.thinkT <= 0) this.choose(d);
      return;
    }

    if (this.mode === 'exec' && this.cur) this.exec(this.cur, dt, tgt, dx, dz, d);
  }

  /** En ny fase: replikk, fart, nye trekk og sterkere utgaver av de gamle. */
  private enterPhase(ph: BossPhase, i: number) {
    const f = this.f;
    this.speedMul = ph.speedMul;
    this.cdMul = ph.cdMul;
    f.speed = this.def.speed * ph.speedMul;
    for (const m of ph.extra ?? []) {
      this.moves.push({ ...m });
      this.cds.push(1.5);
    }
    for (const [kind, boost] of Object.entries(ph.stronger ?? {})) {
      this.moves = this.moves.map((m) => (m.kind === kind ? { ...m, ...boost } : m));
    }
    if (ph.trail) this.trail = true;
    this.w.say(this.def.name, ph.line, 2.6);
    W.fx.flash('#8e0015', 0.35, 0.5);
    W.fx.shake(0.5);
    audio.scream(f.def.voice);
    f.rig.setFlashColor(1, 0.25, 0.2);
    f.flash(0.4);
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.1, 0)), i === 0 ? 'PHASE 2!' : 'FINAL PHASE!', 'kill big', 1.6);
    this.w.onPhase?.(this, ph, i);
  }

  private choose(d: number) {
    const ok = (m: BossMove, i: number) => this.cds[i] <= 0 && (!m.range || (d >= m.range[0] && d <= m.range[1]));
    const weight = (m: BossMove) => {
      if (m.kind === 'summon' && this.w.addsAlive() >= 3) return 0;
      // Måltidet bare når hun har mistet noe å spise seg opp på, speilbildene bare når de forrige er borte
      if (m.kind === 'feast' && this.hpFrac > 0.9) return 0;
      if (m.kind === 'mirror' && this.copies.length) return 0;
      return m.weight;
    };
    const opts = this.moves.map((m, i) => ({ m, i })).filter(({ m, i }) => ok(m, i) && weight(m) > 0);
    const pool = opts.length ? opts : this.moves.map((m, i) => ({ m, i })).filter((o) => o.m.kind === 'melee');
    if (!pool.length) {
      this.thinkT = 0.3;
      return;
    }
    let total = 0;
    for (const o of pool) total += weight(o.m);
    let r = Math.random() * total;
    let pickd = pool[0];
    for (const o of pool) {
      r -= weight(o.m);
      if (r <= 0) {
        pickd = o;
        break;
      }
    }
    this.start(pickd.m, pickd.i);
  }

  /** Start et trekk (testene kaller den også direkte). */
  start(m: BossMove, i = this.moves.indexOf(m)) {
    this.cur = m;
    if (i >= 0) this.cds[i] = m.cd * this.cdMul;
    this.mode = 'exec';
    this.t = 0;
    this.landed = false;
    if (m.say) this.w.say(this.def.name, m.say, 1.4);
    if (m.red) {
      // Rødt blink: dette trekket kan ikke avbrytes, bare unngås
      this.redT = 0.9;
      this.f.rig.setFlashColor(1, 0.05, 0.05);
      W.fx.text(this.f.headPoint().add(new THREE.Vector3(0, 1.2, 0)), '!', 'kill big', 0.9);
      audio.warHorn();
    }
  }

  /**
   * Han har lest helten (fire like slag på rad): blokkerer forfra en stund og slår tilbake etterpå. Bare når han
   * tenker, ikke midt i et trekk, sliten eller på tronen.
   */
  blockFor(sek: number, hero: Fighter) {
    const f = this.f;
    if (this.mode !== 'think' || !f.alive || !f.onGround) return false;
    this.mode = 'block';
    this.blockT = sek;
    this.blockAt = hero;
    f.atk = null;
    f.setState('block');
    f.blocking = 'high';
    f.face(hero.pos.x - f.pos.x);
    this.w.say(this.def.name, pick(['TOO PREDICTABLE!', 'I HAVE SEEN THIS ONE!', 'READ YOU LIKE A BOOK!']), 1.2);
    return true;
  }

  /** Ferdig med trekket. Etter store trekk (tired) er han sliten en stund, ellers tenker han litt. */
  private done(rest = 0.6) {
    const tired = this.cur?.tired ?? 0;
    this.cur = null;
    if (tired > 0 && this.f.alive) return this.tire(tired);
    this.mode = 'think';
    // Vanskelighetsgraden: hvor lenge han tenker mellom trekkene
    this.thinkT = (rest / this.speedMul) * DIFFICULTY[settings.difficulty].think;
  }

  /** Sliten: står og hiver etter pusten uten rustning, og tar litt mer skade. */
  tire(sek: number) {
    const f = this.f;
    this.mode = 'tired';
    this.tiredT = sek;
    f.armored = false;
    f.dmgTaken = 1.3;
    f.rig.root.visible = true;
    if (f.onGround) {
      f.setState('stunned');
      f.stunT = sek;
    }
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), pick(['OPENING!', 'WINDED!', 'NOW!', 'PUNISH!']), 'word', 1.2);
  }

  private exec(m: BossMove, dt: number, tgt: Fighter, dx: number, dz: number, d: number) {
    const f = this.f;
    switch (m.kind) {
      case 'melee': {
        if (f.state === 'attack') {
          if (f.phase() === 'recover' && f.st > (f.atk?.startup ?? 0) + (f.atk?.active ?? 0) + 0.2) this.done(0.5);
          return;
        }
        if (this.t > 3) return this.done(0.3);
        const reach = (m.attack?.reach ?? 2.4) * 0.8;
        if (d > reach || Math.abs(dz) > 0.4) {
          f.wantVX = Math.sign(dx) * f.speed * 1.1;
          f.wantVZ = clamp(dz * 3, -f.speed, f.speed);
          f.face(dx);
          return;
        }
        f.face(dx);
        f.startAttack(m.attack ?? ENEMY_ATK.hog);
        return;
      }
      case 'charge': {
        if (this.t < 0.05 && f.state !== 'attack') {
          f.face(dx);
          f.pos.z += clamp(dz, -1, 1);
          f.startAttack(CHARGE);
          if (!m.red) f.rig.setFlashColor(1, 0.3, 0.2);
          audio.scream(f.def.voice);
          return;
        }
        if (f.state === 'attack' && f.phase() === 'wind') f.flash(Math.sin(this.t * 30) > 0 ? 0.1 : 0);
        if (f.state === 'attack' && f.phase() === 'active' && Math.random() < 0.5) W.gore.dust(f.pos, 2);
        if (f.state !== 'attack') this.done(0.8);
        return;
      }
      case 'slam':
      case 'leap': {
        if (this.t < 0.05 && f.onGround && f.canAct()) {
          const air = (2 * 11.5) / GRAVITY;
          if (m.kind === 'leap') f.jump(clamp(dx / air, -9, 9), clamp(dz / air, -3, 3), 11.5);
          else f.jump(0, 0, 11.5);
          f.face(dx);
          return;
        }
        if (this.landed) {
          this.landed = false;
          this.quake(SLAM_AOE, 2.4);
          this.done(0.9);
        }
        if (this.t > 3) this.done(0.3);
        return;
      }
      case 'shoot': {
        if (this.t < 0.05 && f.canAct()) {
          f.face(dx);
          f.startAttack(CAST);
          for (const c of this.copies) if (c.alive && c.canAct()) {
            c.face(tgt.pos.x - c.pos.x);
            c.startAttack(FAKE_CAST);
          }
          return;
        }
        if (f.state === 'attack' && f.phase() === 'active' && this.t < 10) {
          const n = m.count ?? 1;
          for (let i = 0; i < n; i++) {
            const k = n === 1 ? 0 : i / (n - 1) - 0.5;
            fireProjectile(this.w.proj, f, m.proj ?? 'fireball', f.facing, k * (m.spread ?? 0.3) * 8, 1.2);
          }
          this.t = 10;
        }
        if (f.state !== 'attack' && this.t > 0.2) this.done(0.7);
        return;
      }
      case 'summon': {
        if (this.t < 0.05) {
          f.setState('magic');
          audio.magic();
          W.fx.flash('#2a0040', 0.3, 0.6);
          return;
        }
        if (this.t > 0.9 && f.state === 'magic') {
          const list = m.summon ?? ['skeleton'];
          const n = m.count ?? 2;
          for (let i = 0; i < n; i++) {
            const id = pick(list);
            if (m.rise && this.w.spawnRising) {
              // Reiser seg av gulvet på hver side av helten
              const side = i % 2 ? -1 : 1;
              const x = clamp(tgt.pos.x + side * rand(2.4, 3.6), this.w.camX - this.w.halfW + 1, this.w.camX + this.w.halfW - 1);
              this.w.spawnRising(id, x, clamp(tgt.pos.z + rand(-1, 1), -2.3, 2.3));
            } else this.w.spawnFoe(id, i % 2 ? 'L' : 'R');
          }
          f.setState('idle');
          this.done(0.8);
        }
        return;
      }
      case 'teleport': {
        if (this.t < 0.05) {
          W.gore.fire(f.torsoPoint(), 20, 0.8, 2, ['#c080ff', '#8a40ff', '#ffffff']);
          audio.magic();
          f.rig.root.visible = false;
          f.invuln = 0.6;
          return;
        }
        if (this.t > 0.5 && !f.rig.root.visible) {
          const side = tgt.facing;
          const nx = clamp(tgt.pos.x - side * 2.0, this.w.camX - this.w.halfW + 1, this.w.camX + this.w.halfW - 1);
          f.pos.set(nx, 0, tgt.pos.z);
          f.face(tgt.pos.x - nx);
          f.rig.root.visible = true;
          W.gore.fire(f.torsoPoint(), 20, 0.8, 2, ['#c080ff', '#8a40ff', '#ffffff']);
          W.fx.flash('#c080ff', 0.2, 0.2);
          const mel = this.moves.find((x) => x.kind === 'melee');
          if (mel) {
            this.cur = mel;
            this.t = 0;
          } else this.done(0.4);
        }
        return;
      }
      case 'tongue': {
        if (this.t < 0.05) {
          f.face(dx);
          f.setState('taunt');
          f.stunT = 1.2;
          f.pos.z += clamp(dz, -1.5, 1.5);
          const origin = () => f.headPoint().clone();
          this.w.proj.spawn({
            kind: 'tongue', owner: f, x: f.pos.x + f.facing * 0.8 * f.size, y: 1.8, z: f.pos.z, vx: f.facing * 18, dmg: 0, life: 1.4, origin,
            onHit: (t) => {
              this.pullTarget = t;
              t.hurt(0.9, 0);
              W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.7, 0)), 'THLURP!', 'word');
            },
          });
          audio.swish(0.6, true);
          return;
        }
        if (this.pullTarget) {
          const t = this.pullTarget;
          const goal = f.pos.x + f.facing * 1.6 * (f.size / 2);
          t.pos.x += (goal - t.pos.x) * Math.min(1, dt * 8);
          t.pos.z += (f.pos.z - t.pos.z) * Math.min(1, dt * 8);
          if (Math.abs(goal - t.pos.x) < 0.3 || this.t > 1.2) {
            if (t.alive) applyHit(f, t, CHOMP);
            W.gore.burst(t.torsoPoint(), 20, 4);
            this.pullTarget = null;
            f.setState('idle');
            this.done(0.8);
          }
          return;
        }
        if (this.t > 1.2) {
          f.setState('idle');
          this.done(0.6);
        }
        return;
      }
      case 'rain': {
        if (this.t < 0.05) {
          f.setState('magic');
          audio.magic();
          this.rain(m.proj ?? 'meteor', m.count ?? 6);
          return;
        }
        if (this.t > 1.2) {
          f.setState('idle');
          this.done(0.8);
        }
        return;
      }
      case 'feast':
        return this.feast(m, dt);
      case 'dive':
        return this.dive(dt, tgt);
      case 'mirror':
        return this.mirror(m, tgt);
      case 'beam':
        return this.beam(dt, tgt);
    }
  }

  /** Bakken smeller rundt ham: sjokkbølger til begge sider og skade på heltene nær. */
  private quake(atk: AttackDef, r: number) {
    const f = this.f;
    W.fx.shake(0.8);
    audio.boom(0.9);
    W.gore.dust(f.pos, 20);
    screenFX.shock(f.pos, 1.2, 0.8, 1.2);
    screenFX.punch(f.pos, 0.45);
    screenFX.dive(0.05);
    for (const dir of [-1, 1]) this.w.proj.spawn({ kind: 'shockwave', owner: f, x: f.pos.x + dir * 1.2, y: 0.2, z: f.pos.z, vx: dir * 9, dmg: 12, life: 1.6 });
    for (const h of this.w.heroes) {
      const hf = h.f;
      if (hf.alive && hf.invuln <= 0 && Math.hypot(hf.pos.x - f.pos.x, (hf.pos.z - f.pos.z) * 1.4) < r * (f.size / 2)) applyHit(f, hf, atk);
    }
  }

  /** Regn av meteorer eller lyn rundt heltene. */
  private rain(kind: NonNullable<BossMove['proj']>, n: number) {
    const f = this.f;
    const alive = this.w.heroes.filter((h) => h.f.alive);
    for (let i = 0; i < n; i++) {
      const h = alive.length ? pick(alive).f : f;
      const x = clamp(h.pos.x + rand(-3.5, 3.5), this.w.camX - this.w.halfW + 0.5, this.w.camX + this.w.halfW - 0.5);
      this.w.proj.spawn({ kind, owner: f, x, y: 0, z: rand(-2.4, 2.4), vx: 0, dmg: kind === 'lightning' ? 14 : 16, delay: 0.5 + i * 0.22, life: 4 });
    }
  }

  // ---------------------------------------------------------------- måltidet (Hogmother)
  private feast(m: BossMove, dt: number) {
    const f = this.f;
    if (this.t < 0.05 && f.state !== 'attack') {
      this.feastDmg = 0;
      f.startAttack(FEAST);
      this.dropFood = holdInHand(f.rig, drumstick());
      audio.grunt(f.def.voice);
      return;
    }
    // Avbrutt: slagene mens hun spiste, ble for mye
    if (this.feastDmg >= FEAST_BREAK * f.maxHp) {
      this.endFeast(true);
      this.cur = null;
      this.tire(1.6);
      return;
    }
    if (f.state === 'attack' && f.phase() === 'wind') {
      const heal = ((m.heal ?? 0.1) * f.maxHp * dt) / (FEAST.startup - 0.05);
      f.hp = Math.min(f.maxHp, f.hp + heal);
      if (Math.random() < dt * 5) {
        W.fx.text(f.headPoint().add(new THREE.Vector3(rand(-0.4, 0.4), 0.9, 0)), pick(['NOM', 'NOM NOM', 'CRUNCH', 'MMMM']), 'word', 0.7);
        audio.squish();
      }
      return;
    }
    if (f.state !== 'attack') {
      this.endFeast(false);
      this.done(0.5);
    }
  }

  private endFeast(choked: boolean) {
    this.dropFood?.();
    this.dropFood = null;
    const f = this.f;
    if (choked) {
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.0, 0)), 'CHOKED!', 'kill big', 1.4);
      W.gore.gibs(f.headPoint(), 3, 'bone', 0.6);
      audio.grunt(f.def.voice);
      this.w.say(this.def.name, pick(['MY SNACK!', 'IT WENT DOWN THE WRONG PIPE!', 'YOU RUINED DINNER!']), 1.6);
    }
  }

  // ---------------------------------------------------------------- dykket (Croakus)
  private dive(dt: number, tgt: Fighter) {
    const f = this.f;
    const DOWN = 0.45, SWIM = 2.0, UP = 2.35;
    if (this.t < 0.05) {
      f.face(tgt.pos.x - f.pos.x);
      f.setState('magic');
      W.gore.dust(f.pos, 16);
      audio.splash();
      this.diveAt.copy(f.pos);
      return;
    }
    if (this.t < DOWN) {
      // Synker ned i bakken
      f.pos.y = -2.4 * (this.t / DOWN);
      f.onGround = true;
      return;
    }
    if (this.t < SWIM) {
      if (!this.under) {
        this.under = true;
        f.hideShadow = true;
        f.rising = true;
      }
      this.shadow ??= new DiveShadow(W.scene);
      // Skyggen svømmer mot helten, saktere enn helten løper
      const k = Math.min(1, dt * 1.6);
      this.diveAt.x += clamp(tgt.pos.x - this.diveAt.x, -4.2, 4.2) * k;
      this.diveAt.z += clamp(tgt.pos.z - this.diveAt.z, -2.5, 2.5) * k;
      this.diveAt.x = clamp(this.diveAt.x, this.w.camX - this.w.halfW + 1, this.w.camX + this.w.halfW - 1);
      this.shadow.set(this.diveAt.x, this.diveAt.z, true, dt);
      f.pos.set(this.diveAt.x, -2.4, this.diveAt.z);
      if (Math.random() < dt * 8) W.gore.dust(new THREE.Vector3(this.diveAt.x + rand(-0.5, 0.5), 0.05, this.diveAt.z), 1, '#5a6a3a');
      return;
    }
    if (this.t < UP) {
      // Opp der skyggen er: alle nær ham blir slått opp i lufta
      if (this.under) {
        this.surface();
        this.quake(ERUPT, 2.6);
        W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1, 0)), 'SURPRISE!', 'kill big', 1.2);
      }
      f.pos.y = Math.min(0, f.pos.y + dt * 14);
      return;
    }
    f.pos.y = 0;
    if (f.state === 'magic') f.setState('idle');
    this.done(0.6);
  }

  /** Opp av bakken (også når dykket blir avbrutt). */
  private surface() {
    const f = this.f;
    this.under = false;
    f.hideShadow = false;
    f.rising = false;
    f.pos.y = Math.min(f.pos.y, 0);
    this.shadow?.set(0, 0, false, 0);
    audio.splash();
    W.gore.dust(f.pos, 22, '#5a6a3a');
  }

  // ---------------------------------------------------------------- speilbildene (Vorthax)
  private mirror(m: BossMove, tgt: Fighter) {
    const f = this.f;
    if (this.t < 0.05) {
      f.setState('magic');
      audio.magic();
      W.fx.flash('#c080ff', 0.3, 0.4);
      return;
    }
    if (this.t < 0.7) return;
    // Han og kopiene dukker opp rundt helten, og ingen av dem står der han sto
    const n = m.count ?? 2;
    const spots: number[] = [];
    for (let i = 0; i <= n; i++) spots.push(clamp(tgt.pos.x + (i - n / 2) * 3.0 + rand(-0.4, 0.4), this.w.camX - this.w.halfW + 1, this.w.camX + this.w.halfW - 1));
    const realAt = Math.floor(Math.random() * spots.length);
    for (let i = 0; i < spots.length; i++) {
      const z = clamp(tgt.pos.z + rand(-1.2, 1.2), -2.3, 2.3);
      const at = new THREE.Vector3(spots[i], 0, z);
      W.gore.fire(new THREE.Vector3(at.x, 1.2, at.z), 18, 0.8, 2, ['#c080ff', '#8a40ff', '#ffffff']);
      if (i === realAt) {
        f.pos.copy(at);
        f.face(tgt.pos.x - at.x);
        continue;
      }
      this.copies.push(this.makeCopy(at, tgt));
    }
    this.copyT = MIRROR_LIFE;
    f.setState('idle');
    this.done(0.4);
  }

  private makeCopy(at: THREE.Vector3, tgt: Fighter) {
    const f = this.f;
    const c = new Fighter(this.def.char, 'enemy', { hp: 1, speed: f.speed, tint: this.def.tint });
    c.label = this.def.name;
    c.illusion = true;
    c.kdImmune = true;
    c.noSever = true;
    c.pos.copy(at);
    c.face(tgt.pos.x - at.x);
    c.onIllusionHit = () => this.popCopy(c, true);
    c.addTo(W.scene);
    c.shadow.visible = false;
    return c;
  }

  /** Et speilbilde forsvinner i lilla røyk. */
  private popCopy(c: Fighter, hit: boolean) {
    if (!c.alive) return;
    c.alive = false;
    c.removeMe = true;
    W.gore.fire(c.torsoPoint(), 24, 0.9, 2, ['#c080ff', '#8a40ff', '#ffffff']);
    if (hit) {
      W.fx.text(c.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['FAKE!', 'WRONG ONE!', 'POOF!']), 'word', 1.1);
      audio.magic();
    }
  }

  private updateCopies(dt: number) {
    if (!this.copies.length) return;
    const f = this.f;
    this.copyT -= dt;
    const tgt = this.target?.f;
    for (const c of this.copies) {
      if (!c.alive) continue;
      // Kopiene følger helten på avstand og står som ham, men kaster ingen skygge
      if (tgt && c.canAct()) {
        const want = c.pos.x < tgt.pos.x ? tgt.pos.x - 2.6 : tgt.pos.x + 2.6;
        c.wantVX = clamp((want - c.pos.x) * 2, -c.speed, c.speed) * 0.6;
        c.wantVZ = clamp((tgt.pos.z - c.pos.z) * 1.5, -1, 1);
        c.face(tgt.pos.x - c.pos.x);
      }
      c.shadow.visible = false;
      if (this.copyT <= 0 || !f.alive) this.popCopy(c, false);
    }
    this.copies = this.copies.filter((c) => {
      if (!c.removeMe) return true;
      c.remove();
      return false;
    });
  }

  /** Den ekte ble truffet: alle kopiene forsvinner. */
  dispel() {
    for (const c of this.copies) this.popCopy(c, false);
  }

  // ---------------------------------------------------------------- solstrålen (Vorthax med Solhjertet)
  private beam(dt: number, tgt: Fighter) {
    const f = this.f;
    const AIM = 1.0, FIRE = 2.1;
    this.beamFx ??= new SunBeamFx(W.scene);
    if (this.t < 0.05) {
      // Stiller seg i kanten av bildet og sikter langs veien i høyden helten står i
      this.beamDir = tgt.pos.x > f.pos.x ? 1 : -1;
      this.beamZ = clamp(tgt.pos.z, -2.3, 2.3);
      this.beamHit.clear();
      f.setState('magic');
      audio.magic();
      return;
    }
    const x0 = f.pos.x + this.beamDir * 0.8, x1 = this.w.camX + this.beamDir * (this.w.halfW + 2);
    if (this.t < AIM) {
      f.face(this.beamDir);
      // Glir over i høyden strålen skal gå, og varselet blinker sterkere
      f.pos.z += (this.beamZ - f.pos.z) * Math.min(1, dt * 5);
      this.beamFx.telegraph(x0, x1, this.beamZ, this.t / AIM);
      return;
    }
    if (this.t < FIRE) {
      const k = Math.min(1, (this.t - AIM) * 6) * Math.min(1, (FIRE - this.t) * 6);
      const a = new THREE.Vector3(x0, 1.1, this.beamZ), b = new THREE.Vector3(x1, 1.1, this.beamZ);
      this.beamFx.fire(a, b, k);
      if (Math.random() < dt * 30) W.gore.sparks(new THREE.Vector3(rand(Math.min(x0, x1), Math.max(x0, x1)), 0.2, this.beamZ), 2, '#ffd35a', 4);
      W.fx.shake(0.06);
      for (const h of this.w.heroes) {
        const hf = h.f;
        const inside = (hf.pos.x - x0) * this.beamDir > -0.3 && Math.abs(hf.pos.z - this.beamZ) < 0.55 && hf.pos.y < 1.4;
        if (hf.alive && hf.invuln <= 0 && inside && !this.beamHit.has(hf)) {
          this.beamHit.add(hf);
          applyHit(f, hf, SUNBEAM);
          hf.burnT = Math.max(hf.burnT, 1.2);
        }
      }
      return;
    }
    this.beamFx.hide();
    f.setState('idle');
    this.done(0.6);
  }

  // ---------------------------------------------------------------- tronen (sluttkampen)
  private onThrone(dt: number, tgt: Fighter) {
    const f = this.f;
    if (this.throne) {
      f.pos.copy(this.throne);
      f.onGround = true;
    }
    f.face(tgt.pos.x - f.pos.x);
    f.shielded = true;
    // Av og til et lite lynregn fra tronen
    this.throneCast -= dt;
    if (this.throneCast <= 0 && f.canAct()) {
      this.throneCast = rand(6, 9);
      f.setState('magic');
      audio.magic();
      this.rain('lightning', 3);
      W.gore.later(1.0, () => {
        if (f.state === 'magic' && this.mode === 'throne') f.setState('idle');
      });
    }
  }

  /** Vaktene er slått: han går ned fra tronen og slåss selv (skjoldet holdes oppe av søylene, se Stage). */
  leaveThrone() {
    const f = this.f;
    if (this.mode !== 'throne') return;
    this.mode = 'think';
    this.thinkT = 1.2;
    this.throne = null;
    if (f.state === 'magic') f.setState('idle');
    const air = (2 * 8) / GRAVITY;
    f.jump(0, (0 - f.pos.z) / air, 8);
  }

  /** En søyle falt over ham: skjoldet hjelper ikke, han vakler. */
  crushed(dmg: number) {
    const f = this.f;
    if (!f.alive) return;
    f.hp -= dmg;
    f.flash(0.3);
    W.gore.burst(f.torsoPoint(), 30, 5);
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1, 0)), 'CRUSHED!', 'kill big', 1.4);
    if (f.hp <= 0) {
      f.die('normal', 1, null);
      return;
    }
    if (this.mode === 'throne') return;
    this.interrupt();
    this.tire(1.8);
  }

  /** Rydd effektene (død eller brettet avsluttes). */
  cleanup() {
    this.dispel();
    for (const c of this.copies) c.remove();
    this.copies = [];
    this.endFeast(false);
    this.shadow?.dispose();
    this.shadow = null;
    this.beamFx?.dispose();
    this.beamFx = null;
  }
}
