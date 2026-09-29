// Generisk sidescroller-brett bygget fra en LevelDef: bølger, pickups, magi, kamera og finale (sjef eller duell).
import * as THREE from 'three';
import { Fighter, type Bounds } from './fighter';
import { HERO_ATK, type AttackDef } from './attacks';
import { resolveAttack, applyHit } from './combat';
import { Pickup, Barrel } from './items';
import { Projectiles } from './projectiles';
import { Foe, type FoeWorld } from './foes';
import { BossCtl, type BossWorld } from './boss';
import { Hero, type HeroWorld } from './hero';
import { Hazard } from './hazards';
import { findGrab, startHold, bowl, SLAM } from './grab';
import { buildHazard } from '../gfx/env/hazards';
import { Mount, type MountWorld } from './mounts';
import { Pet, type PetWorld } from './pets';
import { MOUNTS } from '../data/mounts';
import { W } from './world';
import { STAGE_BUILDERS } from '../gfx/env';
import type { PlayerInput } from '../core/input';
import type { HeroConfig } from '../gfx/chars/hero';
import { FOES, DEATH_BARKS } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import type { LevelDef, SpawnDef, WaveDef } from '../data/levels';
import { audio } from '../core/audio';
import { rand, pick, chance } from '../core/math';
import { settings } from '../core/settings';
import { xpForFoe, XP_BOSS, type HeroProgress } from '../data/progress';
import type { HUD } from '../ui/hud';
import { MetalMode, METAL } from './metalmode';
import { HERO_QUIPS, HEROINE_QUIPS, JUGGLE_WORDS, QUIP_STREAKS } from '../data/quips';

const Z_MIN = -2.6;
const Z_MAX = 2.6;
const MAGIC_ATK: AttackDef = { ...HERO_ATK.chop, id: 'magic', kd: true, launch: 8, push: 6, death: ['explode'], heavy: true, word: ['KABOOM!'] };
const SCREAM_ATK: AttackDef = { ...HERO_ATK.chop, id: 'scream', kd: true, launch: 6, push: 8, death: ['headsplode'], heavy: true, word: ['AAAAAH!'] };
const THUNDER_ATK: AttackDef = { ...HERO_ATK.chop, id: 'thunder', kd: true, launch: 5, push: 3, death: ['explode', 'headsplode'], heavy: true, word: ['KRAKOOM!', 'ZZZAP!'] };
const MAGIC_NAMES = { meteor: 'METEOR OF EXCESSIVE FORCE', scream: 'SCREAM OF THE ANCESTORS', thunder: 'WRATH OF THE THUNDER GOD' };

export type StageResult = '' | 'complete' | 'duel' | 'gameover';

export class Stage implements FoeWorld, BossWorld, HeroWorld, MountWorld, PetWorld {
  heroes: Hero[] = [];
  foes: Foe[] = [];
  pickups: Pickup[] = [];
  barrels: Barrel[] = [];
  proj = new Projectiles();
  boss: BossCtl | null = null;
  bossDone = false;
  camX = 0;
  halfW = 9;
  lockX: number | null = null;
  waveIdx = 0;
  wave: WaveDef | null = null;
  queue: SpawnDef[] = [];
  waveT = 0;
  frozen = false;
  tokens = new Set<Foe>();
  maxTokens = 2;
  done: StageResult = '';
  streak = 0;
  streakT = 0;
  barkCd = 0;
  /** Nedkjøling for hoder som flyr i skjermen. */
  glassCd = 3;
  goShown = false;
  others: Fighter[] = [];
  hazards: Hazard[] = [];
  mounts: Mount[] = [];
  pets: Pet[] = [];
  private hazardCd = new Map<number, number>();
  magic: { hero: Hero; level: number; t: number; targets: Fighter[]; hit: Set<number>; meteors: { x: number; z: number; t: number; hit: boolean; f: Fighter }[] } | null = null;
  introT = 0;
  bounds: Bounds = { minX: -3, maxX: 20, minZ: Z_MIN, maxZ: Z_MAX };
  readonly L: number;
  readonly bossLock: number;
  private hpMul: number;
  private finishT = -1;
  /** METAL MODE-måleren (game/metalmode.ts). */
  metal = new MetalMode();
  /** Treff i lufta per fiende (sjonglering som i Castle Crashers). Nullstilles når fienden lander. */
  private juggle = new Map<Fighter, number>();

  constructor(public hud: HUD, public level: LevelDef, configs: HeroConfig[], inputs: PlayerInput[], progress: HeroProgress[] = [], supplies = { lives: 0, potions: 0 }) {
    this.L = level.length;
    this.bossLock = this.L - 16;
    const build = STAGE_BUILDERS[level.biome] ?? STAGE_BUILDERS.grass;
    W.env = build(W.scene, W.gore, {
      length: this.L, finale: level.finale.type, gateTitle: level.gateTitle, gateSub: level.gateSub,
      bossX: this.bossLock + 2, bossSign: level.bossSign,
    });
    W.gore.bounds = { minX: -8, maxX: this.L + 5, minZ: -6, maxZ: 5 };
    for (const h of level.hazards ?? []) this.hazards.push(new Hazard(h, buildHazard(W.env.group, W.gore, h)));
    Fighter.onThrownLand = (f, by) => this.thrownLanded(f, by);
    configs.forEach((c, i) => {
      const h = new Hero(i, c, inputs[i], progress[i]);
      h.lives += supplies.lives;
      h.potions = Math.min(6, h.potions + supplies.potions * 2);
      this.heroes.push(h);
      const petId = progress[i]?.pet;
      if (petId) this.pets.push(new Pet(petId, h));
    });
    this.hpMul = this.twoP ? 1.35 : 1;
    this.maxTokens = this.twoP ? 3 : 2;
    this.heroes.forEach((h, i) => {
      h.f.pos.set(-6 + i * 0.6, 0, i === 0 ? 0.6 : -0.8);
      h.f.addTo(W.scene);
      h.f.onDeath = () => this.heroDied(h);
    });
    for (const [x, drop] of level.barrels) this.barrels.push(new Barrel(x, rand(-1.8, 1.8), drop));
    for (const p of this.pets) p.addTo(W.scene);
    hud.showBrawler(this.heroes);
    hud.announce(level.name, 'stage', 2.4, level.subtitle);
    audio.play(level.music);
    audio.stinger('chord');
  }

  get twoP() {
    return this.heroes.length > 1;
  }

  // ---------------------------------------------------------------- FoeWorld / BossWorld
  nearestHero(p: THREE.Vector3): Hero | null {
    let best: Hero | null = null;
    let bd = 1e9;
    for (const h of this.heroes) {
      if (!h.f.alive) continue;
      const d = Math.abs(h.f.pos.x - p.x) + Math.abs(h.f.pos.z - p.z) * 1.5;
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }
  requestToken(f: Foe) {
    if (this.tokens.size >= this.maxTokens) return false;
    this.tokens.add(f);
    f.token = true;
    return true;
  }
  releaseToken(f: Foe) {
    this.tokens.delete(f);
    f.token = false;
  }
  onScreen(x: number, margin: number) {
    return x > this.camX - this.halfW - margin && x < this.camX + this.halfW + margin;
  }
  addsAlive() {
    return this.foes.filter((f) => f.f.alive && f.def.behavior !== 'runner').length;
  }
  say(who: string, text: string, dur = 2.4) {
    this.hud.say(who, text, dur);
  }
  spawnFoe(id: string, side: 'L' | 'R'): Foe | null {
    const def = FOES[id];
    if (!def) return null;
    const x = side === 'R' ? this.camX + this.halfW + 1.5 : this.camX - this.halfW - 1.5;
    const foe = new Foe(def, x, rand(Z_MIN + 0.3, Z_MAX - 0.3), this.twoP ? 1.2 : 1);
    if (def.behavior === 'runner') foe.dir = side === 'L' ? 1 : -1;
    foe.f.face(side === 'R' ? -1 : 1);
    foe.f.allowHeadless = true;
    foe.f.addTo(W.scene);
    foe.f.onDeath = (_f, killer, style) => this.foeDied(foe, killer, style);
    this.foes.push(foe);
    if (this.barkCd <= 0 && chance(0.45)) {
      this.barkCd = 2.5;
      setTimeout(() => {
        if (foe.f.alive && foe.f.rig.root.parent) this.bark(foe.f, pick(def.barks));
      }, 700);
    }
    return foe;
  }

  /** En fiende som kommer ridende inn fra høyre. */
  spawnRider(foeId: string, mountId: string) {
    const def = MOUNTS[mountId];
    const foe = this.spawnFoe(foeId, 'R');
    if (!def || !foe) return;
    const m = new Mount(def, this.camX + this.halfW + 2.5, rand(-1.5, 1.5));
    m.facing = -1;
    m.addTo(W.scene);
    this.mounts.push(m);
    m.mountUp(foe.f);
    foe.f.pos.copy(m.saddle(foe.f.pos));
    this.hud.announce(def.name + '!', 'wave', 1.4);
  }

  // ---------------------------------------------------------------- MountWorld
  heroFighters() {
    return this.heroes.map((h) => h.f);
  }
  foeFighters() {
    const list = this.foes.map((f) => f.f);
    if (this.boss) list.push(this.boss.f);
    return list;
  }
  mountBounds(m: Mount): Bounds {
    if (m.rider?.team === 'hero') return this.bounds;
    return { minX: this.camX - this.halfW - 4, maxX: this.camX + this.halfW + 4, minZ: Z_MIN, maxZ: Z_MAX };
  }

  bark(f: Fighter, msg: string) {
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), msg, 'speech', 2.2);
  }

  foeDied(foe: Foe, killer: Fighter | null, style: string) {
    const f = foe.f;
    W.stats.kills++;
    if (foe.def.behavior !== 'runner') W.stats.xp += xpForFoe(foe.def.hp, !!f.envKill);
    const hero = this.heroes.find((h) => h.f === killer) ?? (this.magic ? this.magic.hero : undefined);
    if (hero) hero.kills++;
    this.streak++;
    this.streakT = 3;
    W.stats.bestStreak = Math.max(W.stats.bestStreak, this.streak);
    if (hero) this.metal.onKill(style, !!f.envKill, this.streak);
    const labels: Record<number, string> = { 3: 'CARNAGE', 6: 'MASSACRE', 10: 'EXCESSIVE', 15: 'PLEASE SEEK HELP', 22: 'THE BARD WILL SING OF THIS', 30: 'WAR CRIMES (FANTASY)' };
    if (labels[this.streak]) {
      this.hud.streak(this.streak, labels[this.streak]);
      audio.crowd(0.6);
    }
    // B-film-replikker etter lange rekker
    if (hero && QUIP_STREAKS.includes(this.streak)) this.hud.say(hero.name, pick(hero.cfg.body === 1 ? [...HERO_QUIPS, ...HEROINE_QUIPS] : HERO_QUIPS), 2.4);
    // Av og til flyr hodet rett i skjermen
    if (style === 'decap' && f.headDebris && hero && this.glassCd <= 0 && !W.fx.headOnGlass && chance([0.12, 0.1, 0.22, 0.38][settings.gore])) {
      this.glassCd = 9;
      const d = f.headDebris;
      d.held = true;
      W.fx.hurlAtScreen(d.obj, f.headImg(), 0.5, () => W.gore.removeDebris(d));
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['HEADS UP!', 'INCOMING!', 'LOOK OUT!']), 'kill big', 0.9);
    }
    const p = f.pos;
    for (let i = 0; i < foe.def.gold; i++) this.pickups.push(new Pickup('coin', p.x, 1, p.z, 10));
    if (f.envKill) {
      // Miljødrap gir bonus
      for (let i = 0; i < 3; i++) this.pickups.push(new Pickup('coin', p.x, 1.2, p.z, 10));
      this.hud.streak(this.streak, 'ENVIRONMENTAL KILL');
    }
    if (chance(0.1)) this.pickups.push(new Pickup('chicken', p.x, 1, p.z, 30));
    if (chance(0.06)) this.pickups.push(new Pickup('potion', p.x, 1, p.z));
    if (foe.def.behavior === 'runner') {
      W.stats.gnomeCrimes++;
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.4, 0)), 'YOU MONSTER!', 'kill big');
      for (let i = 0; i < 2; i++) this.pickups.push(new Pickup('potion', p.x, 1, p.z));
    } else if (this.barkCd <= 0 && chance(0.2) && style !== 'explode' && style !== 'shatter') {
      this.barkCd = 2;
      this.bark(f, pick(DEATH_BARKS));
    }
    if (this.tokens.has(foe)) this.releaseToken(foe);
  }

  // ---------------------------------------------------------------- grep, kast og farer
  tryGrab(h: Hero) {
    const f = h.f;
    // Ledig ridedyr i nærheten? Sitt opp.
    const m = this.mounts.find((x) => !x.rider && x.state === 'wild' && Math.abs(x.pos.x - f.pos.x) < 1.6 && Math.abs(x.pos.z - f.pos.z) < 0.9);
    if (m) return m.mountUp(f);
    const { target, tooHeavy } = findGrab(f, this.foes.map((x) => x.f));
    if (target) {
      startHold(f, target);
      return true;
    }
    if (tooHeavy) {
      W.fx.text(tooHeavy.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['TOO HEAVY!', 'NICE TRY!', 'HE\'S BIG-BONED!']), 'word', 0.9);
      return true;
    }
    return false;
  }

  private thrownLanded(f: Fighter, by: Fighter) {
    if (!f.alive) return;
    const hz = this.hazards.find((h) => h.armed && h.contains(f.pos.x, f.pos.z));
    if (hz) {
      hz.kill(f, by);
      return;
    }
    applyHit(by, f, SLAM);
    W.gore.dust(f.pos, 12);
    W.fx.shake(0.35);
  }

  private updateHazards(dt: number) {
    for (const hz of this.hazards) {
      const near = this.onScreen(hz.def.x, 3);
      hz.update(dt, W.time, near);
      if (!near) continue;
      for (const fo of this.foes) {
        const f = fo.f;
        if (!f.alive || f.state === 'held' || f.pos.y > 0.35) continue;
        if (!hz.contains(f.pos.x, f.pos.z)) continue;
        const helpless = f.state === 'down' || f.state === 'hurt' || f.state === 'stunned' || !!f.thrownBy;
        if (hz.armed && (helpless || hz.def.kind === 'spiketrap')) hz.kill(f, f.lastHitBy);
        else if (hz.info.foesAvoid && f.onGround) hz.pushOut(f);
      }
      for (const h of this.heroes) {
        const f = h.f;
        if (!f.alive || f.pos.y > 0.25 || f.invuln > 0 || f.state === 'held' || f.mount) continue;
        if ((this.hazardCd.get(f.id) ?? 0) > 0) continue;
        if (hz.armed && hz.contains(f.pos.x, f.pos.z, -0.15)) {
          this.hazardCd.set(f.id, 1.2);
          hz.hurtHero(f);
        }
      }
    }
    for (const [k, v] of this.hazardCd) this.hazardCd.set(k, v - dt);
  }

  // ---------------------------------------------------------------- HeroWorld
  heroDied(h: Hero) {
    h.lives--;
    h.respawnT = 2.5;
    W.fx.flash('#8e0015', 0.5, 0.6);
    W.fx.screenBlood(6);
    if (this.heroes.every((x) => !x.f.alive && x.lives <= 0)) setTimeout(() => (this.done = 'gameover'), 2500);
  }

  respawn(h: Hero) {
    const old = h.f;
    const nf = h.makeFighter();
    nf.pos.set(this.camX - this.halfW + 2, 6, 0);
    nf.onGround = false;
    nf.setState('jump');
    nf.invuln = 2.5;
    nf.addTo(W.scene);
    nf.onDeath = () => this.heroDied(h);
    h.f = nf;
    old.corpseLife = Math.min(old.corpseLife, old.st + 4);
    this.others.push(old);
    W.fx.text(nf.pos.clone().add(new THREE.Vector3(0, -3, 0)), 'BACK FROM VALHALLA!', 'word');
  }

  castMagic(h: Hero) {
    const f = h.f;
    const level = h.potions;
    h.potions = 0;
    f.setState('magic');
    f.vel.set(0, 0, 0);
    this.frozen = true;
    const targets = this.foes.filter((x) => x.f.alive && this.onScreen(x.f.pos.x, 0.5)).map((x) => x.f);
    if (this.boss?.f.alive && this.onScreen(this.boss.f.pos.x, 1)) targets.push(this.boss.f);
    this.magic = { hero: h, level, t: 0, targets, hit: new Set(), meteors: [] };
    this.hud.announce(MAGIC_NAMES[h.magic], 'magic', 1.8, 'LEVEL ' + level);
    audio.magic();
    W.fx.flash('#1a0030', 0.55, 1.2);
  }

  private updateMagic(dt: number) {
    const m = this.magic!;
    m.t += dt;
    const hf = m.hero.f;
    const dmg = (18 + 14 * m.level) * m.hero.fx.magicMul;
    const bossDmg = (t: Fighter) => (this.boss && t === this.boss.f ? dmg * 0.6 : dmg);
    if (m.t < 0.7) {
      if (m.hero.magic === 'thunder') W.gore.sparks(hf.rig.weaponTip(), 2, '#bfe8ff', 4);
      else W.gore.fire(hf.headPoint().add(new THREE.Vector3(0, 0.6, 0)), 2, 0.3, 3);
      return;
    }
    if (m.hero.magic === 'thunder') {
      // Tordenguden: lynet slår først ned i heltens våpen, så i hver fiende etter tur. Flere krukker gir
      // flere og kraftigere lyn, og fra nivå 3 slår det ned rundt omkring også (maginivåene i Golden Axe)
      const sky = (x: number, z: number) => new THREE.Vector3(x + rand(-2, 2), 15, z - 3);
      if (!m.meteors.length) {
        m.targets.forEach((f, i) => m.meteors.push({ x: f.pos.x, z: f.pos.z, t: -0.25 - i * 0.14, hit: false, f }));
        for (let i = 0; i < Math.max(0, m.level - 2) * 2; i++) m.meteors.push({ x: hf.pos.x + rand(-8, 8), z: rand(-2.4, 2.4), t: -rand(0.2, 1.1), hit: false, f: hf });
        W.gore.vfx.lightning(sky(hf.pos.x, hf.pos.z), hf.rig.weaponTip(), '#cfe8ff', 0.3);
        audio.boom(0.8);
        W.fx.flash('#cfe8ff', 0.4, 0.2);
      }
      let allDone = true;
      for (const mt of m.meteors) {
        if (mt.hit) continue;
        allDone = false;
        mt.t += dt;
        if (mt.t < 0) continue;
        mt.hit = true;
        const onFoe = mt.f !== hf && mt.f.alive;
        const x = onFoe ? mt.f.pos.x : mt.x, z = onFoe ? mt.f.pos.z : mt.z;
        W.gore.vfx.lightning(sky(x, z), new THREE.Vector3(x, 0.05, z), m.level >= 5 ? '#e6d0ff' : '#9fd8ff', 0.2 + m.level * 0.03);
        audio.boom(0.5 + m.level * 0.08);
        W.fx.shake(0.35 + m.level * 0.06);
        if (onFoe) applyHit(hf, mt.f, THUNDER_ATK, bossDmg(mt.f));
      }
      if (allDone && m.t > 1.4) this.endMagic();
    } else if (m.hero.magic === 'meteor') {
      if (!m.meteors.length) {
        m.targets.forEach((f, i) => m.meteors.push({ x: f.pos.x, z: f.pos.z, t: -i * 0.12, hit: false, f }));
        if (!m.targets.length) m.meteors.push({ x: hf.pos.x + hf.facing * 4, z: hf.pos.z, t: 0, hit: false, f: hf });
      }
      let allDone = true;
      for (const mt of m.meteors) {
        mt.t += dt;
        if (mt.t < 0) {
          allDone = false;
          continue;
        }
        const k = Math.min(1, mt.t / 0.4);
        const pos = new THREE.Vector3(mt.x - 4 * (1 - k), 12 * (1 - k) + 0.8, mt.z);
        if (!mt.hit) {
          allDone = false;
          W.gore.fire(pos, 3, 0.35, 0.5);
          W.gore.flare(pos, 1.2, '#ffb02e', 0.05);
          if (k >= 1) {
            mt.hit = true;
            W.gore.flare(pos, 3, '#ffd35a', 0.4);
            W.gore.fire(pos, 30, 1.2, 5);
            audio.boom(1);
            W.fx.shake(0.7);
            if (mt.f !== hf && mt.f.alive) applyHit(hf, mt.f, MAGIC_ATK, bossDmg(mt.f));
          }
        }
      }
      if (allDone && m.t > 1.2) this.endMagic();
    } else {
      const r = (m.t - 0.7) * 16;
      if (m.t < 1.4) {
        for (let i = 0; i < 12; i++) {
          const a = rand(0, Math.PI * 2);
          W.gore.flare(new THREE.Vector3(hf.pos.x + Math.cos(a) * r, 1 + Math.sin(a) * r * 0.25, hf.pos.z), 0.6, '#9fd8ff', 0.2);
        }
        if (m.t - dt < 0.7) {
          audio.scream('heroine');
          audio.boom(0.7);
          W.fx.shake(0.6);
        }
      }
      for (const f of m.targets) {
        if (m.hit.has(f.id) || !f.alive) continue;
        if (Math.abs(f.pos.x - hf.pos.x) < r) {
          m.hit.add(f.id);
          applyHit(hf, f, SCREAM_ATK, bossDmg(f));
        }
      }
      if (m.t > 1.8) this.endMagic();
    }
  }

  private endMagic() {
    const m = this.magic!;
    if (m.hero.f.alive) m.hero.f.setState('idle');
    this.magic = null;
    this.frozen = false;
  }

  // ---------------------------------------------------------------- sjef
  private startBoss() {
    const def = BOSSES[(this.level.finale as { boss: string }).boss];
    if (!def) return;
    this.lockX = this.bossLock;
    this.boss = new BossCtl(def, this.bossLock + this.halfW + 3, 0, this.hpMul, this);
    const bf = this.boss.f;
    bf.addTo(W.scene);
    bf.onDeath = () => this.bossDied();
    this.hud.showBoss(def.name, def.title);
    this.hud.announce(def.name, 'boss', 2.6, def.title);
    audio.play('duel');
    audio.gong();
    audio.stinger('dive');
    def.intro.forEach(([who, text], i) => setTimeout(() => this.hud.say(who, text, 2.2), 900 + i * 2300));
  }

  private bossDied() {
    const b = this.boss!;
    this.bossDone = true;
    W.stats.kills++;
    W.stats.xp += XP_BOSS;
    W.fx.slowmo(0.2, 2.2);
    W.fx.screenBlood(12);
    W.fx.shake(1);
    const tp = b.f.torsoPoint();
    W.gore.burst(tp, 160, 12, 0.14, b.f.def.blood === 'lava' ? 'lava' : 'red');
    W.gore.gibs(tp, 18, b.f.def.blood === 'lava' ? 'lava' : 'red', 1.6);
    audio.boom(1.4);
    audio.crowd(1.2);
    this.hud.hideBoss();
    this.hud.announce('BOSS SLAIN!', 'kill', 3, b.def.name);
    this.hud.say(b.def.name, b.def.death, 3);
    for (const fo of this.foes) if (fo.f.alive) fo.f.die('explode', 1, null);
    this.finishT = 4.5;
  }

  // ---------------------------------------------------------------- oppdatering
  update(dt: number) {
    this.introT += dt;
    this.barkCd -= dt;
    this.glassCd -= dt;
    this.streakT -= dt;
    if (this.streakT <= 0) this.streak = 0;
    if (this.finishT > 0) {
      this.finishT -= dt;
      if (this.finishT <= 0) this.done = 'complete';
    }

    // Kamera
    const cam = W.camera;
    const dist = cam.position.z;
    this.halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist * cam.aspect * 0.93;
    const alive = this.heroes.filter((h) => h.f.alive);
    if (alive.length) {
      const avg = alive.reduce((s, h) => s + h.f.pos.x, 0) / alive.length;
      let target = Math.max(this.camX, avg + 1.5);
      if (this.lockX !== null) target = Math.min(target, this.lockX);
      target = Math.min(target, this.L - this.halfW + 1);
      this.camX += (target - this.camX) * Math.min(1, dt * 4);
    }
    if (this.introT < 1.2) this.camX = Math.max(this.camX, -1);
    this.bounds.minX = this.camX - this.halfW + 0.7;
    this.bounds.maxX = Math.min(this.camX + this.halfW - 0.7, this.L - 1);

    // Bølger
    const waves = this.level.waves;
    if (!this.wave && this.waveIdx < waves.length && this.camX >= waves[this.waveIdx].at - 0.2) {
      this.wave = waves[this.waveIdx++];
      this.lockX = this.wave.at;
      this.queue = this.wave.spawns.map((s) => ({ ...s }));
      if (this.twoP) {
        const extra = this.wave.spawns.filter((s) => FOES[s.foe]?.behavior !== 'runner').slice(0, Math.ceil(this.wave.spawns.length / 2))
          .map((s, i) => ({ ...s, side: (s.side === 'L' ? 'R' : 'L') as 'L' | 'R', delay: s.delay + 0.5 + i * 0.4 }));
        this.queue.push(...extra);
      }
      this.waveT = 0;
      if (this.wave.title) this.hud.announce(this.wave.title, 'wave', 1.6);
      const wi = this.waveIdx - 1;
      for (const [idx, foeId, mountId] of this.level.riders ?? []) if (idx === wi) setTimeout(() => this.done === '' && this.spawnRider(foeId, mountId), 1200);
      if (this.wave.say) this.hud.say(this.wave.say[0], this.wave.say[1], 3.5);
      this.hud.go(false);
      this.goShown = false;
    }
    if (this.wave) {
      this.waveT += dt;
      const aliveFoes = this.addsAlive();
      for (let i = 0; i < this.queue.length; i++) {
        const s = this.queue[i];
        if (this.waveT >= s.delay && aliveFoes < this.wave.maxAlive + (this.twoP ? 1 : 0)) {
          this.spawnFoe(s.foe, s.side);
          this.queue.splice(i, 1);
          break;
        }
      }
      if (!this.queue.length && !this.foes.some((f) => f.f.alive && f.def.behavior !== 'runner')) {
        this.wave = null;
        this.lockX = null;
        if (!this.goShown) {
          this.goShown = true;
          this.hud.go(true);
          audio.confirm();
        }
      }
    } else if (this.goShown && this.camX > (waves[this.waveIdx - 1]?.at ?? 0) + 6) {
      this.hud.go(false);
    }
    const allWaves = this.waveIdx >= waves.length && !this.wave;
    if (allWaves && this.level.finale.type === 'boss' && !this.boss && this.camX >= this.bossLock - 0.5) this.startBoss();
    if (allWaves && this.level.finale.type === 'duel' && alive.some((h) => h.f.pos.x > this.L - 5.5)) this.done = 'duel';

    // Aktører
    for (const h of this.heroes) h.update(dt, this);
    for (const fo of this.foes) fo.update(dt, this);
    this.boss?.update(dt);
    if (this.magic) this.updateMagic(dt);
    for (const m of this.mounts) m.update(dt, this);
    for (const p of this.pets) p.update(dt, this);
    this.mounts = this.mounts.filter((m) => {
      const gone = m.removeMe || (!m.rider && m.pos.x < this.camX - this.halfW - 8);
      if (gone) m.remove();
      return !gone;
    });

    const heroF = this.heroes.map((h) => h.f);
    const foeF = this.foes.map((f) => f.f);
    if (this.boss) foeF.push(this.boss.f);
    for (const h of this.heroes) {
      h.f.update(dt, this.bounds);
      resolveAttack(h.f, foeF, { onHit: (_a, t, r) => this.onFoeHit(h, t, r.killed) });
      this.hitBarrels(h.f);
    }
    const foeBounds: Bounds = { minX: this.camX - this.halfW - 3, maxX: this.camX + this.halfW + 3, minZ: Z_MIN, maxZ: Z_MAX };
    for (const fo of this.foes) {
      fo.f.update(dt, foeBounds);
      resolveAttack(fo.f, heroF);
    }
    if (this.boss) {
      const bf = this.boss.f;
      const bb: Bounds = this.boss.mode === 'intro' ? foeBounds : { minX: this.camX - this.halfW + 1, maxX: this.camX + this.halfW - 1, minZ: Z_MIN, maxZ: Z_MAX };
      bf.update(dt, bb);
      if (bf.alive) resolveAttack(bf, heroF);
      if (bf.alive) this.hud.updateBoss(bf.hp / bf.maxHp);
    }
    for (const fo of this.foes) if (fo.f.thrownBy) bowl(fo.f, foeF);
    this.updateHazards(dt);
    this.proj.update(dt, [...heroF, ...foeF]);
    for (const o of this.others) o.update(dt, this.bounds);
    this.others = this.others.filter((o) => {
      if (o.removeMe) o.remove();
      return !o.removeMe;
    });
    this.foes = this.foes.filter((fo) => {
      if (fo.f.removeMe) {
        fo.f.remove();
        return false;
      }
      return true;
    });
    for (let i = 0; i < this.foes.length; i++)
      for (let j = i + 1; j < this.foes.length; j++) {
        const a = this.foes[i].f, b = this.foes[j].f;
        if (!a.alive || !b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz * 1.6);
        if (d < 0.7 && d > 0.001) {
          const push = (0.7 - d) * 8 * dt;
          a.pos.x -= (dx / d) * push;
          b.pos.x += (dx / d) * push;
          a.pos.z -= (dz / d) * push * 0.5;
          b.pos.z += (dz / d) * push * 0.5;
        }
      }

    // Pickups
    for (const p of this.pickups) {
      p.update(dt, Z_MIN, Z_MAX);
      for (const h of this.heroes) {
        const f = h.f;
        if (!f.alive || p.taken) continue;
        const dx = f.pos.x - p.pos.x, dz = f.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (p.kind === 'coin' && d < 2.2 && p.vel.y === 0) {
          p.pos.x += dx * dt * 6;
          p.pos.z += dz * dt * 6;
        }
        if (d < 0.75 && p.pos.y < 1.2) {
          p.taken = true;
          this.collect(h, p);
        }
      }
    }
    this.pickups = this.pickups.filter((p) => {
      if (p.taken || p.life <= 0) {
        p.dispose();
        return false;
      }
      return true;
    });
    this.metal.update(dt, this);
    for (const [f] of this.juggle) if (f.onGround || !f.alive) this.juggle.delete(f);
    this.hud.updateBrawler(this.heroes);
  }

  private onFoeHit(h: Hero, t: Fighter, killed: boolean) {
    this.metal.add(METAL.hit);
    if (!t.onGround) {
      const n = (this.juggle.get(t) ?? 0) + 1;
      this.juggle.set(t, n);
      if (n >= 2) {
        W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.7, 0)), JUGGLE_WORDS[Math.min(n, JUGGLE_WORDS.length - 1)] + ' x' + n, 'word', 0.8);
        this.metal.add(0.01 * n);
      }
    }
    const foe = this.foes.find((f) => f.f === t);
    if (foe?.def.behavior === 'runner' && !killed) {
      foe.hits++;
      foe.dir = h.f.pos.x < t.pos.x ? 1 : -1;
      if (foe.hits <= 3) {
        this.pickups.push(new Pickup('potion', t.pos.x, 1.2, t.pos.z));
        if (foe.hits === 1) this.bark(t, pick(foe.def.barks));
      }
    }
  }

  private hitBarrels(f: Fighter) {
    const a = f.atk;
    if (!a || f.phase() !== 'active' || a.projectile) return;
    for (const b of this.barrels) {
      if (!b.alive) continue;
      const dx = (b.x - f.pos.x) * f.facing;
      if (dx > -0.4 && dx < a.reach + 0.3 && Math.abs(b.z - f.pos.z) < 0.9) this.pickups.push(...b.smash(f.facing));
    }
  }

  private collect(h: Hero, p: Pickup) {
    const f = h.f;
    const at = f.headPoint().add(new THREE.Vector3(0, 0.6, 0));
    switch (p.kind) {
      case 'coin':
        h.gold += p.value;
        W.stats.gold += p.value;
        audio.coin();
        break;
      case 'chicken':
      case 'ham':
        f.hp = Math.min(f.maxHp, f.hp + (p.kind === 'ham' ? 60 : 40));
        audio.pickup();
        W.fx.text(at, p.kind === 'ham' ? 'HALF-EATEN HAM! +60' : 'ROAST CHICKEN! +40', 'good');
        if (f.regrowArms()) setTimeout(() => W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), 'MY ARM GREW BACK. DON\'T ASK.', 'speech', 2), 500);
        break;
      case 'egg':
        f.hp = Math.min(f.maxHp, f.hp + 30);
        audio.pickup();
        W.fx.text(at, 'FRESH EGG! +30', 'good');
        break;
      case 'potion':
        h.potions = Math.min(6, h.potions + 1);
        audio.potion();
        W.fx.text(at, 'POTION!', 'magic');
        break;
    }
  }

  dispose() {
    this.metal.stop();
    Fighter.onThrownLand = null;
    for (const m of this.mounts) m.remove();
    for (const p of this.pets) p.remove();
    for (const h of this.heroes) h.f.remove();
    for (const f of this.foes) f.f.remove();
    this.boss?.f.remove();
    for (const p of this.pickups) p.dispose();
    this.proj.clear();
  }
}
