// Generisk sidescroller-brett bygget fra en LevelDef: bølger, pickups, magi, kamera og finale (sjef eller duell).
import * as THREE from 'three';
import { Fighter, type Bounds } from './fighter';
import { HERO_ATK, type AttackDef } from './attacks';
import { resolveAttack, applyHit } from './combat';
import { Pickup, Barrel } from './items';
import { Projectiles } from './projectiles';
import { Foe, AMBUSH, type FoeWorld } from './foes';
import { BossCtl, type BossWorld } from './boss';
import type { BossPhase } from '../data/bosses';
import { ShieldFx, LavaTrail } from '../gfx/bossfx';
import { HabitReader, JUGGLE_LIMIT, READ_BLOCK, spike, landed, wallBounce, bodyHits, grounded } from './combo';
import { Director } from './director';
import { DIFFICULTY } from '../data/difficulty';
import { Hero, type HeroWorld } from './hero';
import { Hazard } from './hazards';
import { findGrab, startHold, bowl, resistGrab, SLAM, AUTO_GRAB } from './grab';
import { buildHazard } from '../gfx/env/hazards';
import { chasmHole } from '../data/hazards';
import { Icicles, ICICLE_WARN } from './icicles';
import type { Tippable, Crush } from '../gfx/env/common';
import { Mount, type MountWorld } from './mounts';
import { Pet, type PetWorld } from './pets';
import { MOUNTS } from '../data/mounts';
import { W } from './world';
import { STAGE_BUILDERS } from '../gfx/env';
import { resetGenerators, usedGenerators } from '../gfx/env/common';
import { Scenery, type FighterBox } from '../gfx/scenery';
import { Vision } from '../gfx/vision';
import { layoutFor } from '../data/layouts';
import type { PlayerInput } from '../core/input';
import type { HeroConfig } from '../gfx/chars/hero';
import { FOES, DEATH_BARKS, CAPTAIN, foeRank } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import type { LevelDef, SpawnDef, WaveDef } from '../data/levels';
import { audio, type Surface } from '../core/audio';
import type { Level } from '../core/conductor';
import { rand, pick, chance, clamp, withSeed, hashSeed } from '../core/math';
import { settings } from '../core/settings';
import { xpForFoe, XP_BOSS, type HeroProgress } from '../data/progress';
import type { HUD } from '../ui/hud';
import { MetalMode, METAL } from './metalmode';
import { HERO_QUIPS, HEROINE_QUIPS, JUGGLE_WORDS, QUIP_STREAKS } from '../data/quips';
import { GRADES } from '../gfx/env/grades';
import { screenFX } from '../gfx/screenfx';
import { COOP_CAM, coopCameraFrame, stageCameraHalfWidth } from '../gfx/stagecam';

/** Dødsmåter som skremmer fiendene rundt (panikk, game/foes.ts). */
const GORY = ['decap', 'explode', 'bisect', 'headsplode', 'dismember', 'legsoff'];
const Z_MIN = -2.6;
const Z_MAX = 2.6;
const MAGIC_ATK: AttackDef = { ...HERO_ATK.chop, id: 'magic', kd: true, launch: 8, push: 6, death: ['explode'], heavy: true, word: ['KABOOM!'] };
const SCREAM_ATK: AttackDef = { ...HERO_ATK.chop, id: 'scream', kd: true, launch: 6, push: 8, death: ['headsplode'], heavy: true, word: ['AAAAAH!'] };
const THUNDER_ATK: AttackDef = { ...HERO_ATK.chop, id: 'thunder', kd: true, launch: 5, push: 3, death: ['explode', 'headsplode'], heavy: true, word: ['KRAKOOM!', 'ZZZAP!'] };
const MAGIC_NAMES = { meteor: 'METEOR OF EXCESSIVE FORCE', scream: 'SCREAM OF THE ANCESTORS', thunder: 'WRATH OF THE THUNDER GOD' };
/** En søyle i jungelen som faller på en helt (Stage.crush): mye skade, og han veltes. */
const PILLAR_HIT: AttackDef = { ...HERO_ATK.chop, id: 'pillar', dmg: 24, kd: true, launch: 4, push: 3, heavy: true, death: ['explode'], word: ['CRUNCH!'] };
/** Sekunder per replikk når Vorthax taler fra himmelen (LevelDef.vorthax). */
const VISION_LINE = 3.0;
/** En søyle i tronsalen som faller over Vorthax: så stor andel av livet hans (skjoldet hjelper ikke). */
const PILLAR_BOSS = 0.07;

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
  /** 0..1: felles, begrenset uttrekk for kjemper og to levende helter som sprer seg (app/game.ts). */
  camPull = 0;
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
  /** Istapper som faller (frostpasset), fyrfat som kan veltes, og glør på bakken etter veltede fyrfat. */
  icicles: Icicles;
  tippables: Tippable[] = [];
  embers: { x: number; z: number; t: number }[] = [];
  /** Skjult figur som «slår» med istapper og glør (applyHit trenger en angriper). */
  private nature = new Fighter('skeleton', 'enemy', { hp: 1, speed: 0 });
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
  /** Eliter og sjefer som leser helten (like slag på rad, game/combo.ts). */
  private habits = new HabitReader();
  /** Regissøren (game/director.ts): spenning, angrepsplasser og tempo, med vanskelighetsgraden oppå. */
  director = new Director(DIFFICULTY[settings.difficulty]);
  pace = 1;
  wind = DIFFICULTY[settings.difficulty].wind;
  dodge = DIFFICULTY[settings.difficulty].dodge;
  /** Bølgebudsjettet (rang): hvor mye som kan leve samtidig i denne bølgen, og det forrige bølge brukte for mye. */
  private waveCap = 0;
  private waveDebt = 0;
  /** Ledige ridedyr fiendene løper til (runde E): hvilken fiende som har tatt hvert dyr. */
  private claims = new Map<Mount, Foe>();
  /** Krukker hver tyvnisse har stjålet i nattleiren, og nedkjøling mellom tyveriene. */
  private stolen = new Map<Foe, { n: number; cd: number }>();
  /** Daggry i nattleiren (skjer bare én gang). */
  private dawned = false;
  /** Rekvisittene fra brettfila (src/data/layouts, brettverkstedet), med animasjon og forgrunn som tones ut. */
  scenery: Scenery;
  /** Tilstanden til heltene forrige bilde (en lang drapsrekke ryker når en helt blir truffet). */
  private heroState = new Map<Hero, string>();
  /** Intensiteten i musikken (core/conductor.ts), og hvor lenge det har vært roligere enn den (spilltid). */
  private mood: Level = 0;
  private calmT = 0;
  /**
   * Sluttkampen i tårnet (BossDef.finale): vaktene reiser seg mens sjefen står på tronen, så slåss han selv bak et
   * skjold som søylene i salen (Tippable.conduit) holder oppe.
   */
  finale: { step: 'guards' | 'fight'; wave: number; t: number; pillars: number } | null = null;
  private shieldFx: ShieldFx | null = null;
  /** Lava i sporene etter Magmor (BossWorld.lava). */
  private lavaFx: LavaTrail | null = null;
  /** Vorthax på himmelen (LevelDef.vorthax): projeksjonen, hvor lenge den har vart og hvor langt han er kommet i talen. */
  vision: Vision | null = null;
  visionDone = false;
  private visionT = 0;
  private visionLine = 0;

  constructor(public hud: HUD, public level: LevelDef, configs: HeroConfig[], inputs: PlayerInput[], progress: HeroProgress[] = [], supplies = { lives: 0, potions: 0 }) {
    this.L = level.length;
    this.bossLock = this.L - 16;
    const build = STAGE_BUILDERS[level.biome] ?? STAGE_BUILDERS.grass;
    // Juvene er hull i bakken: miljøet lar dem stå åpne, og blod og kroppsdeler legger seg ikke der
    const holes = (level.hazards ?? []).filter((h) => h.kind === 'chasm').map(chasmHole);
    // Brettfila (brettverkstedet): fast frø for pynten, generatorer som er slått av, og rekvisittene
    const layout = layoutFor(level.id);
    const seed = layout?.seed ?? hashSeed(level.id);
    resetGenerators();
    const env = withSeed(seed, () => build(W.scene, W.gore, {
      length: this.L, finale: level.finale.type, gateTitle: level.gateTitle, gateSub: level.gateSub,
      bossX: this.bossLock + 2, bossSign: level.bossSign, holes, seed, gen: layout?.generators,
    }));
    W.env = env;
    env.generators = usedGenerators();
    W.gore.bounds = { minX: -8, maxX: this.L + 5, minZ: -6, maxZ: 5 };
    W.gore.holes = holes;
    withSeed(seed ^ 0x27d4eb2f, () => {
      for (const h of level.hazards ?? []) this.hazards.push(new Hazard(h, buildHazard(env.group, W.gore, h)));
    });
    this.scenery = new Scenery(W.gore, env, W.camera);
    env.group.add(this.scenery.group);
    if (layout) this.scenery.load(layout);
    this.scenery.fighters = () => this.fighterBoxes();
    const envUpdate = env.update.bind(env);
    env.update = (dt, t, camX) => {
      envUpdate(dt, t, camX);
      this.scenery.tick(dt);
    };
    this.icicles = new Icicles(level.biome === 'frost', this.nature);
    this.tippables = W.env.tippables ?? [];
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
    if (level.nightCamp) {
      // Heltene sover ved bålet med et par krukker hver (som tyvnissene er ute etter)
      this.heroes.forEach((h, i) => {
        h.f.pos.set(2.2 + i * 1.3, 0, i === 0 ? -0.9 : 0.5);
        h.f.setState('down');
        h.f.downT = 2.8;
        h.potions = Math.min(6, h.potions + 2);
        // Riggen er ikke flyttet ennå, så teksten plasseres ut fra posisjonen
        W.fx.text(new THREE.Vector3(h.f.pos.x + 0.4, 1.1, h.f.pos.z), 'ZZZ...', 'word', 2.4);
      });
    }
    for (const [x, drop] of level.barrels) this.barrels.push(new Barrel(x, rand(-1.8, 1.8), drop));
    for (const p of this.pets) p.addTo(W.scene);
    hud.showBrawler(this.heroes);
    hud.announce(level.name, 'stage', 2.4, level.subtitle);
    // Låta starter med en gang (fra menyen), rolig til første bølge, og den store akkorden lander på første slag
    audio.play(level.music);
    audio.intensity(0);
    audio.stinger('chord');
    audio.ambience(level.biome);
    // Fottrinnene: snø i frosten, vann i myra, stein i vulkanlandet og tårnet, ellers gress og jord
    audio.surface = ({ frost: 'sno', swamp: 'vann', scorch: 'stein', tower: 'stein' } as Record<string, Surface>)[level.biome] ?? 'gress';
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
  /** Summen av rangen til fiendene som lever (bølgebudsjettet). */
  aliveRank() {
    let n = 0;
    for (const f of this.foes) if (f.f.alive) n += foeRank(f.def);
    return n;
  }
  say(who: string, text: string, dur = 2.4) {
    this.hud.say(who, text, dur);
  }
  /** side: L og R er kantene av bildet, B er buskene bak veien (bakhold, se Foe.ambush). */
  spawnFoe(id: string, side: SpawnDef['side']): Foe | null {
    const def = FOES[id];
    if (!def) return null;
    let x = side === 'R' ? this.camX + this.halfW + 1.5 : this.camX - this.halfW - 1.5;
    let z = rand(Z_MIN + 0.3, Z_MAX - 0.3);
    const h = this.nearestHero(new THREE.Vector3(this.camX, 0, 0));
    if (side === 'B') {
      // I baklaget inne i bildet, et stykke unna nærmeste helt, så hoppet ut av buskene rekker fram
      const hx = h?.f.pos.x ?? this.camX;
      x = this.camX + rand(-0.6, 0.6) * this.halfW;
      if (Math.abs(x - hx) < 2.5) x = hx + (x < hx ? -1 : 1) * rand(2.5, 4);
      x = clamp(x, this.camX - this.halfW + 1.2, this.camX + this.halfW - 1.2);
      z = AMBUSH.z;
    }
    const foe = new Foe(def, x, z, this.twoP ? 1.2 : 1);
    if (def.behavior === 'runner') foe.dir = side === 'L' ? 1 : -1;
    foe.f.face(side === 'R' ? -1 : side === 'L' ? 1 : Math.sign((h?.f.pos.x ?? this.camX) - x) || 1);
    foe.f.allowHeadless = true;
    foe.f.addTo(W.scene);
    foe.f.onDeath = (_f, killer, style) => this.foeDied(foe, killer, style);
    this.foes.push(foe);
    if (side === 'B') {
      foe.ambush(rand(AMBUSH.wait[0], AMBUSH.wait[1]));
      return foe;
    }
    // En kjempe varsles med krigshorn og brøler når han kommer inn
    if (def.poise) {
      audio.warHorn();
      audio.roar(foe.f.size, 1.4);
      W.fx.shake(0.25);
    }
    if (this.barkCd <= 0 && chance(0.45)) {
      this.barkCd = 2.5;
      W.gore.later(0.7, () => {
        if (foe.f.alive && foe.f.rig.root.parent) this.bark(foe.f, pick(def.barks));
      });
    }
    return foe;
  }

  /** En fiende som reiser seg av gulvet der han står (vaktene i tårnet, BossWorld.spawnRising). */
  spawnRising(id: string, x: number, z: number): Foe | null {
    const def = FOES[id];
    if (!def) return null;
    const foe = new Foe(def, x, z, this.twoP ? 1.2 : 1);
    foe.f.allowHeadless = true;
    foe.f.addTo(W.scene);
    foe.f.onDeath = (_f, killer, style) => this.foeDied(foe, killer, style);
    const h = this.nearestHero(foe.f.pos);
    foe.f.face(h ? h.f.pos.x - x : -1);
    foe.entered = true;
    foe.rise(1.3);
    this.foes.push(foe);
    // Gulvet sprekker: støv, steinbiter og et dunk
    W.gore.dust(new THREE.Vector3(x, 0.1, z), 18);
    W.gore.gibs(new THREE.Vector3(x, 0.2, z), 3, 'bone', 0.7);
    W.gore.stain(x, z, 0.8);
    audio.thud(0.9);
    audio.bones();
    return foe;
  }

  /** Lava i sporet (Magmor): brenner den som står i den (glør i Stage.updateProps), og gløder på bakken. */
  lava(x: number, z: number, sek: number) {
    this.embers.push({ x, z, t: sek });
    this.lavaFx ??= new LavaTrail(W.scene);
    this.lavaFx.add(x, z, sek);
    if (Math.random() < 0.3) audio.sizzle(0.25);
  }

  /** En ny fase hos sjefen. Den desperate fasen i tårnet: Vorthax tar Solhjertet. */
  onPhase(b: BossCtl, ph: BossPhase, i: number) {
    this.hud.bossPhase(i + 1);
    if (!ph.heart) return;
    const fin = W.env?.finale;
    // Hjertet setter seg på toppen av staven hans
    const tip = new THREE.Vector3();
    if (fin) fin.heartTo(() => b.f.rig.weaponTip(tip).add(new THREE.Vector3(0, 0.15, 0.1)));
    W.gore.later(1.1, () => {
      if (!b.f.alive) return;
      // Gyllent lys rundt ham og et rødt rom
      b.f.rig.setTint([1.25, 1.05, 0.6]);
      b.f.rig.setFlashColor(1, 0.85, 0.3);
      b.f.flash(0.6);
      W.fx.flash('#ffd35a', 0.5, 0.5);
      screenFX.shock(b.f.torsoPoint(), 1.6, 0.9, 1.1);
      W.post?.setGrade({ ...GRADES.tower, ...GRADES.heart }, false);
      audio.boom(1.2);
    });
  }

  /**
   * Kapteinen blåser i hornet (game/foes.ts): forsterkninger fra kantene, høyst to, så langt bølgebudsjettet rekker.
   * Svarer hvor mange som kommer.
   */
  hornCall(c: Foe, ids: string[]) {
    if (!this.wave) return 0;
    let room = this.waveCap - this.aliveRank();
    let n = 0;
    for (let i = 0; i < 2; i++) {
      const id = pick(ids);
      const def = FOES[id];
      if (!def) continue;
      const r = foeRank(def);
      if (r > room) break;
      room -= r;
      const side = i % 2 ? 'L' : 'R';
      W.gore.later(0.8 + i * 0.5, () => {
        if (this.done === '' && this.wave && c.f.alive) this.spawnFoe(id, side);
      });
      n++;
    }
    return n;
  }

  /**
   * Et ledig ridedyr en fiende kan løpe til (runde E): det nærmeste innen 7 som ingen annen har tatt, også dyret en helt
   * nettopp gikk av. Fienden beholder dyret til han sitter på det, dør, eller noen andre kommer først.
   */
  claimMount(fo: Foe) {
    for (const [m, o] of this.claims) {
      if (o !== fo) continue;
      if (m.rider || m.removeMe || m.state === 'flee' || !this.mounts.includes(m) || !fo.f.alive) {
        this.claims.delete(m);
        break;
      }
      return m;
    }
    if (!this.wave) return null;
    let best: Mount | null = null;
    let bd = 7;
    for (const m of this.mounts) {
      if (m.rider || m.removeMe || m.state === 'flee' || this.claims.has(m) || !this.onScreen(m.pos.x, -1)) continue;
      const d = Math.abs(m.pos.x - fo.f.pos.x) + Math.abs(m.pos.z - fo.f.pos.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) this.claims.set(best, fo);
    return best;
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
    // En fiende-rytter som har kommet inn i bildet, holdes der (også i stormløpet), så helten når ham, og under en bølge
    // gjelder det også dyr uten rytter (en fiende som setter seg opp igjen, gjør det inne i bildet). Dyret selv holder
    // seg 0,6 innenfor grensene, så midten av dyret er aldri lenger ut enn helten kan gå.
    if (m.entered && (m.rider || this.lockX !== null)) return { minX: this.camX - this.halfW + 0.2, maxX: this.camX + this.halfW - 0.2, minZ: Z_MIN, maxZ: Z_MAX };
    return { minX: this.camX - this.halfW - 4, maxX: this.camX + this.halfW + 4, minZ: Z_MIN, maxZ: Z_MAX };
  }

  bark(f: Fighter, msg: string) {
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), msg, 'speech', 2.2);
  }

  foeDied(foe: Foe, killer: Fighter | null, style: string) {
    const f = foe.f;
    W.stats.kills++;
    if (killer?.team === 'hero') this.director.kill();
    // Et grufullt drap (eller et miljødrap) skremmer de som står nær
    if (GORY.includes(style) || f.envKill) {
      for (const o of this.foes) {
        if (o === foe || !o.f.alive || Math.abs(o.f.pos.x - f.pos.x) > 4.5) continue;
        if (chance(0.35)) o.panic(rand(2, 3.5));
      }
    }
    // Kapteinen er død: troppene mister motet og flykter en stund (derfor skal han tas først)
    if (foe.def.behavior === 'captain') {
      const rest = this.foes.filter((o) => o !== foe && o.f.alive && o.def.behavior !== 'runner');
      let first = true;
      for (const o of rest) {
        if (!o.panic(rand(2.2, 3.2), true) || !first) continue;
        first = false;
        W.gore.later(0.4, () => o.f.alive && this.bark(o.f, pick(CAPTAIN.down)));
      }
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.1, 0)), 'MORALE BROKEN!', 'kill big', 1.4);
    }
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
      // Fanfaren trappes opp med rekken: gitar, pauker, orgel, kor, gong, torden og publikum (core/layers.ts)
      audio.streak(this.streak);
      // Kameraet dykker litt inn på lange rekker
      screenFX.dive(0.03 + Math.min(this.streak, 15) * 0.006);
    }
    // B-film-replikker etter lange rekker
    if (hero && QUIP_STREAKS.includes(this.streak)) {
      const fem = hero.cfg.body === 1;
      const quip = pick(fem ? [...HERO_QUIPS, ...HEROINE_QUIPS] : HERO_QUIPS);
      this.hud.say(hero.name, quip, 2.4, false);
      // Damene har egne opptak (v_<replikk>_f) når de finnes
      audio.voice(quip, 0, fem ? 'f' : undefined);
    }
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
  /** Et ledig ridedyr ved helten. `auto` = han går inn i det (må stå foran og helt inntil). */
  private freeMount(f: Fighter, auto: boolean) {
    return this.mounts.find((x) => {
      if (x.rider || x.state !== 'wild') return false;
      const dx = x.pos.x - f.pos.x, dz = Math.abs(x.pos.z - f.pos.z);
      return auto ? Math.abs(dx) < 1.15 && dx * f.facing > -0.2 && dz < 0.55 : Math.abs(dx) < 1.6 && dz < 0.9;
    });
  }

  /** Står helten inntil noe han kan gripe eller sitte opp på (grep uten knapp)? En tøff fiende som står imot, teller også. */
  grabContact(h: Hero) {
    const f = h.f;
    if (this.freeMount(f, true)) return true;
    const g = findGrab(f, this.foes.map((x) => x.f), AUTO_GRAB.reach, AUTO_GRAB.zr);
    return !!g.target || !!g.guarded;
  }

  tryGrab(h: Hero, auto = false) {
    const f = h.f;
    // Ledig ridedyr i nærheten? Sitt opp.
    const m = this.freeMount(f, auto);
    if (m) return m.mountUp(f);
    const { target, tooHeavy, guarded } = auto ? findGrab(f, this.foes.map((x) => x.f), AUTO_GRAB.reach, AUTO_GRAB.zr) : findGrab(f, this.foes.map((x) => x.f));
    if (target) {
      startHold(f, target);
      return true;
    }
    // Tøff fiende som ikke vakler: han skyver helten unna (slå ham først)
    if (guarded) {
      resistGrab(f, guarded);
      h.grabPause(1.1);
      return true;
    }
    if (tooHeavy && !auto) {
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
    this.scenery.poke(f.pos.x, f.pos.z, 2.5);
  }

  private updateHazards(dt: number) {
    for (const hz of this.hazards) {
      const near = this.onScreen(hz.def.x, 3);
      // Steinvekta faller når noen står under den (fiender som lokkes inn, eller en helt som ikke passer på)
      if (near && hz.def.kind === 'deadfall' && hz.drop === 'up') {
        const under = [...this.foes.map((o) => o.f), ...this.heroes.map((h) => h.f)].some((f) => f.alive && f.pos.y < 0.5 && f.state !== 'held' && hz.contains(f.pos.x, f.pos.z));
        if (under) hz.trigger();
      }
      hz.update(dt, W.time, near);
      if (!near) continue;
      for (const fo of this.foes) {
        const f = fo.f;
        // Froskemannen i bakhold venter bak veien og berøres ikke av farene før han er ute
        if (!f.alive || f.state === 'held' || f.pos.y > 0.35 || fo.ambushing) continue;
        // Ved juvet stoppes de som går, foran gjerdet, men bare de som havner i selve hullet, faller
        const inside = hz.contains(f.pos.x, f.pos.z);
        if (!inside && !hz.stops(f.pos.x, f.pos.z)) continue;
        const helpless = f.state === 'down' || f.state === 'hurt' || f.state === 'stunned' || !!f.thrownBy;
        if (inside && hz.armed && (helpless || hz.killsAll)) hz.kill(f, f.lastHitBy);
        else if (hz.info.foesAvoid && f.onGround && (inside || !helpless)) hz.pushOut(f);
      }
      for (const h of this.heroes) {
        const f = h.f;
        // Juvet: heltene går ikke utfor, de stopper foran gjerdet
        if (hz.info.blocks) {
          if (f.alive && f.state !== 'held' && !f.mount && hz.stops(f.pos.x, f.pos.z)) hz.pushOut(f);
          continue;
        }
        if (!f.alive || f.pos.y > 0.25 || f.invuln > 0 || f.state === 'held' || f.mount) continue;
        if ((this.hazardCd.get(f.id) ?? 0) > 0) continue;
        if (hz.bites && hz.contains(f.pos.x, f.pos.z, -0.15)) {
          this.hazardCd.set(f.id, 1.2);
          hz.hurtHero(f);
        }
      }
      // Ridedyrene går heller ikke utfor juvet
      if (hz.info.blocks) for (const m of this.mounts) if (hz.stops(m.pos.x, m.pos.z)) m.pos.z = hz.stopZ;
    }
    for (const [k, v] of this.hazardCd) this.hazardCd.set(k, v - dt);
  }

  /**
   * Rekvisitter som spiller med: istapper som faller, fyrfat som veltes av slag og kastede fiender, glør som
   * brenner, og figurer som brenner (fiendene får panikk).
   */
  private updateProps(dt: number, heroF: Fighter[], foeF: Fighter[]) {
    const all = [...heroF, ...foeF];
    this.icicles.update(dt, !!this.wave || this.addsAlive() > 0, all, this.camX, this.halfW);
    for (const tp of this.tippables) {
      if (tp.tipped || Math.abs(tp.x - this.camX) > this.halfW + 2) continue;
      // Et slag fra en helt som når fram, eller en fiende som flyr inn i det. Det faller bort fra slaget
      const hero = heroF.find((f) => f.state === 'attack' && f.phase() === 'active' && Math.abs(tp.x - (f.pos.x + f.facing * 1.1)) < 1.3 && Math.abs(tp.z - f.pos.z) < 1.9);
      const flying = hero ? undefined : foeF.find((f) => (!!f.thrownBy || f.state === 'down') && !f.onGround && Math.abs(tp.x - f.pos.x) < 0.9 && Math.abs(tp.z - f.pos.z) < 1.4);
      if (hero) this.tip(tp, hero.facing);
      else if (flying) this.tip(tp, flying.vel.x < 0 ? -1 : 1);
    }
    for (const e of this.embers) {
      e.t -= dt;
      for (const f of all) {
        if (!f.alive || f.pos.y > 0.4 || Math.abs(f.pos.x - e.x) > 1.1 || Math.abs(f.pos.z - e.z) > 0.7) continue;
        this.ignite(f, f.team === 'hero' ? 1.2 : 3.5);
      }
    }
    this.embers = this.embers.filter((e) => e.t > 0);
    // Brann: skade over tid, flammer på kroppen, og fiendene løper i panikk
    for (const f of all) {
      if (f.burnT <= 0) continue;
      f.burnT -= dt;
      if (!f.alive) {
        f.burnT = 0;
        continue;
      }
      if (Math.random() < dt * 20) W.gore.fire(f.torsoPoint(), 2, 0.3 * f.size, 1.6);
      f.hp -= dt * (f.team === 'hero' ? 3 : 7) * f.dmgTaken;
      if (f.hp <= 0) {
        if (f.team !== 'hero') f.envKill = 'FIRE';
        f.die('normal', f.facing, this.nature);
        W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['WELL DONE!', 'EXTRA CRISPY!', 'FLAMBE!']), 'kill big', 1.2);
      }
    }
  }

  /**
   * Velt noe: et fyrfat (glørne renner ut og brenner på bakken) eller en søyle i jungelen, som knuser alt i stripen den
   * lander på: fiendene dør, heltene tar skade og veltes.
   */
  private tip(tp: Tippable, dir: number) {
    const spill = tp.tip(dir);
    if (!spill) return;
    // Glørne brenner først når kurven har truffet bakken (omtrent 0,7 sekunder)
    if (spill.t > 0) W.gore.later(0.7, () => this.embers.push({ x: spill.x, z: spill.z, t: spill.t - 0.7 }));
    const c = spill.crush;
    if (c) W.gore.later(c.delay, () => this.crush(c));
    W.fx.text(new THREE.Vector3(tp.x, 3.2, tp.z), pick(c ? ['TIMBER!', 'LOOK OUT BELOW!', 'ANCIENT ARCHITECTURE!'] : ['TIMBER!', 'HOT COALS!', 'OOPS!']), 'word', 1.1);
  }

  /** En søyle lander: alt den lander på, knuses. */
  private crush(c: Crush) {
    if (this.done) return;
    W.fx.shake(0.55);
    // Avstanden fra figuren til linjestykket søylen ligger langs
    const dx = c.bx - c.ax, dz = c.bz - c.az, len2 = dx * dx + dz * dz || 1;
    const inStrip = (f: Fighter) => {
      if (!f.alive || f.pos.y > 1.2) return false;
      const u = Math.max(0, Math.min(1, ((f.pos.x - c.ax) * dx + (f.pos.z - c.az) * dz) / len2));
      return Math.hypot(f.pos.x - (c.ax + dx * u), f.pos.z - (c.az + dz * u)) < c.r;
    };
    for (const o of this.foes) {
      const f = o.f;
      if (!inStrip(f) || f.state === 'held') continue;
      f.envKill = 'PILLAR';
      f.die('explode', 1, this.nature);
      W.stats.gibs += 2;
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1, 0)), pick(['FLATTENED!', 'CRUSHED!', 'SQUASHED!']), 'kill big', 1.3);
    }
    for (const h of this.heroes) {
      const f = h.f;
      if (!inStrip(f) || f.invuln > 0 || f.mount) continue;
      applyHit(this.nature, f, PILLAR_HIT);
    }
    // Sjefen: skjoldet hjelper ikke mot en søyle
    const b = this.boss;
    if (b && b.f.alive && inStrip(b.f)) {
      b.crushed(b.f.maxHp * PILLAR_BOSS);
      if (b.def.finale) this.hud.say(b.def.name, b.def.finale.crushed, 1.8);
    }
  }

  /** Sett fyr på en figur i sek sekunder. Fiender som tar fyr, får panikk. */
  private ignite(f: Fighter, sek: number) {
    // Figurer av lava (Magmor, ildimpene) brenner ikke
    if (f.def.blood === 'lava') return;
    const fresh = f.burnT <= 0;
    f.burnT = Math.max(f.burnT, sek);
    if (!fresh) return;
    audio.sizzle(0.5);
    const foe = this.foes.find((o) => o.f === f);
    if (foe) foe.panic(sek, true);
    else if (f.team === 'hero') W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['HOT! HOT! HOT!', 'MY LOINCLOTH!']), 'speech', 1.2);
  }

  // ---------------------------------------------------------------- FoeWorld
  /** Et bakkeslag (kjempen): istapper løsner, og fyrfat i nærheten velter. */
  onQuake(x: number, z: number, r: number) {
    // Kulisser som svarer på slag (react on 'hit'), rister og flykter også av bakkeslaget
    this.scenery.poke(x, z, r + 3);
    if (this.level.biome === 'frost') {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) this.icicles.drop(x + rand(-3.5, 3.5), rand(-2.3, 2.3), ICICLE_WARN * rand(0.7, 1.1) + i * 0.2);
    }
    for (const tp of this.tippables) if (!tp.tipped && Math.abs(tp.x - x) < r + 1.5) this.tip(tp, tp.x < x ? -1 : 1);
  }

  // ---------------------------------------------------------------- HeroWorld
  heroDied(h: Hero) {
    h.lives--;
    h.respawnT = 2.5;
    W.fx.flash('#8e0015', 0.5, 0.6);
    W.fx.screenBlood(6);
    // Kameraet dykker inn mot helten som falt, og en sjokkbølge går ut fra ham
    screenFX.dive(0.15, 1.2);
    screenFX.shock(h.f.torsoPoint(), 1.0, 0.8, 1.1);
    if (this.heroes.every((x) => !x.f.alive && x.lives <= 0)) W.gore.later(2.5, () => (this.done = 'gameover'));
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
    const targets = this.foes.filter((x) => x.f.alive && !x.f.hidden && this.onScreen(x.f.pos.x, 0.5)).map((x) => x.f);
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
        audio.thunder(0.8);
        W.fx.lightningFlash(0.4, 0.2);
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
        audio.thunder(0.5 + m.level * 0.08);
        W.fx.shake(0.35 + m.level * 0.06);
        W.fx.lightningFlash(0.15 + m.level * 0.02, 0.12);
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
            screenFX.boom(pos, 1.2);
            screenFX.addHeat(pos.clone().setY(0.2), 1.8, 1, false, 2);
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
          // Skriket sender en stor, langsom sjokkbølge ut fra helten
          screenFX.shock(hf.headPoint(), 1.8, 1.1, 1.0);
          screenFX.dive(0.08);
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
    // Sluttkampen: han venter på tronen bak skjoldet mens vaktene reiser seg
    const throne = def.finale ? W.env?.finale?.throne : undefined;
    this.boss = new BossCtl(def, this.bossLock + this.halfW + 3, 0, this.hpMul, this, throne);
    const bf = this.boss.f;
    bf.addTo(W.scene);
    bf.onDeath = () => this.bossDied();
    if (throne && def.finale) {
      this.finale = { step: 'guards', wave: -1, t: 2.0 + def.intro.length * 2.3, pillars: this.conduits().length };
      this.shieldFx = new ShieldFx(W.scene);
    }
    this.hud.showBoss(def.name, def.title);
    this.hud.bossPhases(def.phases.map((p) => p.at));
    this.hud.announce(def.name, 'boss', 2.6, def.title);
    // Sjefslåta kommer på en taktstrek minst 1,4 sekunder fram, med stuping, gong og stor akkord på første slag
    audio.bossArrives('duel');
    // Kameradykk mens sjefen gjør entré
    screenFX.dive(0.12, 2.4);
    def.intro.forEach(([who, text], i) => W.gore.later(0.9 + i * 2.3, () => this.hud.say(who, text, 2.2)));
  }

  /** Søylene i tronsalen som mater skjoldet, og som fortsatt står. */
  private conduits() {
    return this.tippables.filter((t) => t.conduit && !t.tipped);
  }

  /**
   * Sluttkampen: vaktene reiser seg bølge for bølge mens sjefen står på tronen. Når de er slått, går han ned og
   * slåss. Skjoldet er oppe så lenge en søyle med krystall står (og alltid på tronen).
   */
  private updateFinale(dt: number) {
    const fin = this.finale, b = this.boss;
    if (!fin || !b || !b.def.finale) return;
    const def = b.def.finale;
    const standing = this.conduits();
    if (fin.step === 'guards') {
      fin.t -= dt;
      const guards = this.foes.some((o) => o.f.alive && o.def.behavior !== 'runner');
      if (!guards && fin.t <= 0) {
        fin.wave++;
        if (fin.wave < def.guards.length) {
          const w = def.guards[fin.wave];
          this.hud.say(b.def.name, w.line, 2.4);
          // Vaktene reiser seg spredt rundt heltene, litt etter hverandre
          const alive = this.heroes.filter((h) => h.f.alive);
          w.foes.forEach((id, i) => W.gore.later(0.5 + i * 0.45, () => {
            const h = alive.length ? alive[i % alive.length].f : null;
            const side = i % 2 ? -1 : 1;
            const x = Math.min(this.camX + this.halfW - 1.2, Math.max(this.camX - this.halfW + 1.2, (h?.pos.x ?? this.camX) + side * rand(2.2, 4.2)));
            this.spawnRising(id, x, rand(Z_MIN + 0.4, Z_MAX - 0.4));
          }));
          fin.t = 0.5 + w.foes.length * 0.45 + 1.5;
        } else {
          fin.step = 'fight';
          b.leaveThrone();
          this.hud.say(b.def.name, def.rise, 2.6);
        }
      }
    }
    // Skjoldet: krystallene som står, mater det. En søyle som faller, får en replikk, og den siste knuser skjoldet
    const shielded = b.mode === 'throne' || standing.length > 0;
    if (standing.length < fin.pillars && b.f.alive) {
      fin.pillars = standing.length;
      if (standing.length > 0) this.hud.say(b.def.name, def.pillar, 2.0);
      else if (b.mode !== 'throne') this.breakShield(b);
    }
    if (b.f.shielded && !shielded) this.breakShield(b);
    b.f.shielded = shielded && b.f.alive;
    const total = this.tippables.filter((t) => t.conduit).length || 1;
    this.hud.bossShield(b.f.shielded ? Math.max(standing.length / total, b.mode === 'throne' ? 1 : 0) : null);
    this.shieldFx?.update(dt, b.f.torsoPoint(), 1.35 * b.f.size, standing.map((t) => t.top!()), b.f.shielded);
  }

  /** Skjoldet brister: glimt, gnister og en replikk. */
  private breakShield(b: BossCtl) {
    if (!b.f.shielded) return;
    b.f.shielded = false;
    const tp = b.f.torsoPoint();
    W.gore.sparks(tp, 60, '#ffd35a', 10);
    W.fx.flash('#fff2c0', 0.4, 0.4);
    screenFX.shock(tp, 1.4, 0.9, 1.2);
    W.fx.shake(0.6);
    audio.iceCrack(1.5);
    audio.boom(0.8);
    W.fx.text(b.f.headPoint().add(new THREE.Vector3(0, 1.2, 0)), 'SHIELD SHATTERED!', 'kill big', 1.8);
    if (b.def.finale) this.hud.say(b.def.name, b.def.finale.broken, 2.4);
    b.tire(2.2);
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
    // Det største øyeblikket: sjokkbølge, zoomslag, en mild negativ ramme og kameradykk
    screenFX.shock(tp, 2, 1.0, 1.1);
    screenFX.punch(tp, 0.8);
    screenFX.negative(0.1);
    screenFX.dive(0.16, 1.2);
    W.gore.burst(tp, 160, 12, 0.14, b.f.def.blood === 'lava' ? 'lava' : 'red');
    W.gore.gibs(tp, 18, b.f.def.blood === 'lava' ? 'lava' : 'red', 1.6);
    audio.boom(1.4);
    audio.bossSlain();
    // En kort avslutning fra neste slag, og så seiersmusikken
    audio.bossDefeated();
    this.hud.hideBoss();
    this.hud.announce('BOSS SLAIN!', 'kill', 3, b.def.name);
    this.hud.say(b.def.name, b.def.death, 3);
    for (const fo of this.foes) if (fo.f.alive) fo.f.die('explode', 1, null);
    b.cleanup();
    this.shieldFx?.dispose();
    this.shieldFx = null;
    this.hud.bossShield(null);
    const fin = this.finale ? W.env?.finale : undefined;
    if (fin) {
      // Solhjertet faller på gulvet, buret senkes, og prinsessen har et nytt skilt
      fin.heartTo(null);
      W.gore.later(1.4, () => fin.freePrincess());
      W.gore.later(3.2, () => this.hud.say('PRINCESS AMBERLY', 'FINALLY. I HAVE BEEN BORED IN HERE FOR THREE WEEKS.', 2.6));
      this.finale = null;
    }
    this.finishT = fin ? 6.5 : 4.5;
  }

  // ---------------------------------------------------------------- oppdatering
  update(dt: number) {
    this.introT += dt;
    this.barkCd -= dt;
    this.glassCd -= dt;
    this.streakT -= dt;
    if (this.streakT <= 0) this.streak = 0;
    this.watchStreak();
    this.ambienceTick(dt);
    this.musicMood(dt);
    if (this.finishT > 0) {
      this.finishT -= dt;
      if (this.finishT <= 0) this.done = 'complete';
    }

    // Kamera
    const cam = W.camera;
    const dist = cam.position.z;
    this.halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist * cam.aspect * 0.93;
    const alive = this.heroes.filter((h) => h.f.alive);
    const coop = alive.length > 1;
    const left = coop ? Math.min(...alive.map((h) => h.f.pos.x)) : 0;
    const right = coop ? Math.max(...alive.map((h) => h.f.pos.x)) : 0;
    const framing = coop ? coopCameraFrame(cam.fov, cam.aspect, right - left) : { pull: 0, lead: 1.5 };
    const giant = this.foes.some((f) => f.f.alive && f.f.size > 1.8 && this.onScreen(f.f.pos.x, 3)) || (!!this.boss?.f.alive && this.boss.f.size > 1.7);
    const pullTarget = Math.max(giant ? 1 : 0, framing.pull);
    // Åpne før spillerne møter kanten, trekk saktere inn igjen. Kjemper alene beholder den gamle farten.
    const pullSpeed = coop && pullTarget > this.camPull ? 3 : 1.2;
    this.camPull += (pullTarget - this.camPull) * Math.min(1, dt * pullSpeed);
    if (coop) this.halfW = stageCameraHalfWidth(cam.fov, cam.aspect, this.camPull);
    if (alive.length) {
      const avg = alive.reduce((s, h) => s + h.f.pos.x, 0) / alive.length;
      let target = Math.max(this.camX, avg + framing.lead);
      // Den bakerste helten får beholde plassen sin selv om den fremste løper videre. Bølgene er fortsatt låst.
      if (coop) target = Math.min(target, left + this.halfW - COOP_CAM.bodyPad);
      if (this.lockX !== null) target = Math.min(target, this.lockX);
      target = Math.min(target, this.L - this.halfW + 1);
      if (coop) target = Math.max(-1, target);
      this.camX += (target - this.camX) * Math.min(1, dt * 4);
    }
    if (this.introT < 1.2) this.camX = Math.max(this.camX, -1);
    // Den tegnede kamerax-en følger litt etter. To spillere holdes innenfor både den og neste kameramål.
    this.bounds.minX = coop ? Math.max(-8, Math.max(this.camX, cam.position.x) - this.halfW + COOP_CAM.bodyPad) : this.camX - this.halfW + 0.7;
    this.bounds.maxX = Math.min((coop ? Math.min(this.camX, cam.position.x) : this.camX) + this.halfW - (coop ? COOP_CAM.bodyPad : 0.7), this.L - 1);

    // Bølger
    const waves = this.level.waves;
    if (!this.wave && this.waveIdx < waves.length && this.camX >= waves[this.waveIdx].at - 0.2) {
      this.wave = waves[this.waveIdx++];
      this.lockX = this.wave.at;
      this.queue = this.wave.spawns.map((s) => ({ ...s }));
      if (this.twoP) {
        const extra = this.wave.spawns.filter((s) => FOES[s.foe]?.behavior !== 'runner').slice(0, Math.ceil(this.wave.spawns.length / 2))
          .map((s, i) => ({ ...s, side: (s.side === 'B' ? 'B' : s.side === 'L' ? 'R' : 'L') as SpawnDef['side'], delay: s.delay + 0.5 + i * 0.4 }));
        this.queue.push(...extra);
      }
      this.waveT = 0;
      // Budsjettet (rang): maxAlive i rang, mer med to spillere, minus det forrige bølge brukte for mye
      this.waveCap = Math.max(2, Math.round(this.wave.maxAlive * (this.twoP ? 1.4 : 1)) - this.waveDebt);
      this.waveDebt = 0;
      if (this.wave.title) this.hud.announce(this.wave.title, 'wave', 1.6);
      const wi = this.waveIdx - 1;
      for (const [idx, foeId, mountId] of this.level.riders ?? []) if (idx === wi) W.gore.later(1.2, () => this.done === '' && this.spawnRider(foeId, mountId));
      if (this.wave.say) this.hud.say(this.wave.say[0], this.wave.say[1], 3.5);
      this.hud.go(false);
      this.goShown = false;
    }
    if (this.wave) {
      this.waveT += dt;
      // Rangen til dem som lever: en ny fiende kommer når den får plass i budsjettet (eller ingen lever). Går en
      // bølge over budsjettet fordi en elite må inn, trekkes det fra neste bølge
      const aliveRank = this.aliveRank();
      for (let i = 0; i < this.queue.length; i++) {
        const s = this.queue[i];
        const r = FOES[s.foe] ? foeRank(FOES[s.foe]) : 1;
        if (this.waveT >= s.delay && (aliveRank + r <= this.waveCap || aliveRank === 0)) {
          if (aliveRank + r > this.waveCap) this.waveDebt += aliveRank + r - this.waveCap;
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
          audio.waveCleared();
        }
      }
    } else if (this.goShown && this.camX > (waves[this.waveIdx - 1]?.at ?? 0) + 6) {
      this.hud.go(false);
    }
    const allWaves = this.waveIdx >= waves.length && !this.wave;
    if (allWaves && this.level.finale.type === 'boss' && !this.boss && this.camX >= this.bossLock - 0.5) this.startBoss();
    if (allWaves && this.level.finale.type === 'duel' && alive.some((h) => h.f.pos.x > this.L - 5.5)) this.done = 'duel';
    if (allWaves && this.level.finale.type === 'dawn' && !this.dawned && !this.foes.some((f) => f.f.alive)) {
      // Nattleiren er over: morgenlyset kommer sakte, og brettet er ferdig
      this.dawned = true;
      this.finishT = 3.4;
      this.hud.announce('DAWN BREAKS', 'stage', 2.8, 'THE THIEVES ARE GONE. MOSTLY.');
      W.post?.setGrade({ ...GRADES.grass, exposure: 1.25 }, false);
      audio.crowd(0.5);
    }

    // Regissøren: spenning, angrepsplasser og tempo (game/director.ts)
    this.director.update(dt, this.heroes);
    this.maxTokens = this.director.tokens(this.twoP ? 3 : 2);
    this.pace = this.director.pace();
    // Aktører
    for (const h of this.heroes) h.update(dt, this);
    // Ridedyr som er tatt av en fiende som er død eller sitter på et annet dyr, er ledige igjen
    for (const [m, o] of this.claims) if (!o.f.alive || o.f.mount || m.removeMe || !this.mounts.includes(m)) this.claims.delete(m);
    for (const fo of this.foes) fo.update(dt, this);
    this.boss?.update(dt);
    this.updateFinale(dt);
    this.lavaFx?.update(dt);
    if (this.magic) this.updateMagic(dt);
    for (const m of this.mounts) {
      const inside = Math.abs(m.pos.x - this.camX) < this.halfW - 0.8;
      if (inside && (m.rider?.team === 'enemy' || (!m.rider && this.lockX !== null))) m.entered = true;
      // Et dyr uten rytter som blir liggende igjen etter bølgen, kan vandre ut og hentes inn igjen av en ny rytter
      if (!inside && !m.rider && this.lockX === null) m.entered = false;
      m.update(dt, this);
    }
    for (const p of this.pets) p.update(dt, this);
    this.mounts = this.mounts.filter((m) => {
      const gone = m.removeMe || (!m.rider && m.pos.x < this.camX - this.halfW - 8);
      if (gone) m.remove();
      return !gone;
    });

    const heroF = this.heroes.map((h) => h.f);
    const foeF = this.foes.map((f) => f.f);
    if (this.boss) foeF.push(this.boss.f, ...this.boss.copies);
    for (const h of this.heroes) {
      h.f.update(dt, this.bounds);
      resolveAttack(h.f, foeF, {
        onHit: (_a, t, r) => {
          // Den ekte Vorthax ble truffet: speilbildene forsvinner
          if (this.boss && t === this.boss.f && !r.blocked) this.boss.dispel();
          if (!t.illusion) this.onFoeHit(h, t, r.killed);
        },
      });
      this.hitBarrels(h.f);
    }
    const foeBounds: Bounds = { minX: this.camX - this.halfW - 3, maxX: this.camX + this.halfW + 3, minZ: Z_MIN, maxZ: Z_MAX };
    // Fiender som har kommet inn i bildet, holdes der. Ellers kan de rygge ut av bildet, der helten ikke når dem
    // (kameraet står stille under bølgen). Tyver på flukt og ryttere går fritt.
    const inView: Bounds = { minX: this.camX - this.halfW + 0.4, maxX: this.camX + this.halfW - 0.4, minZ: Z_MIN, maxZ: Z_MAX };
    // Froskemannen i bakhold venter i baklaget bak veien og hopper derfra
    const backView: Bounds = { ...inView, minZ: AMBUSH.z - 0.4 };
    for (const fo of this.foes) {
      if (!fo.entered && fo.f.pos.x > inView.minX && fo.f.pos.x < inView.maxX) fo.entered = true;
      const kept = fo.entered && fo.def.behavior !== 'runner' && !fo.f.mount;
      fo.f.update(dt, fo.ambushing ? backView : kept ? inView : foeBounds);
      resolveAttack(fo.f, heroF);
      // Runde E: kropper spretter mot kanten av bildet under en bølge, og kropper som flyr, treffer andre fiender
      const f = fo.f;
      if (kept && this.lockX !== null) wallBounce(f, inView.minX, inView.maxX, f.lastHitBy);
      bodyHits(f, foeF);
      if (f.onGround) {
        landed(f);
        grounded(f);
      }
    }
    if (this.boss) {
      const bf = this.boss.f;
      // På tronen står han bak veikanten
      const bb: Bounds = this.boss.mode === 'intro' ? foeBounds : { minX: this.camX - this.halfW + 1, maxX: this.camX + this.halfW - 1, minZ: this.boss.mode === 'throne' ? -4.5 : Z_MIN, maxZ: Z_MAX };
      bf.update(dt, bb);
      if (bf.alive) resolveAttack(bf, heroF);
      if (bf.alive) this.hud.updateBoss(bf.hp / bf.maxHp);
      for (const c of this.boss.copies) c.update(dt, bb);
    }
    for (const fo of this.foes) if (fo.f.thrownBy) bowl(fo.f, foeF);
    this.updateHazards(dt);
    this.updateProps(dt, heroF, foeF);
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
    const wasMetal = this.metal.on;
    this.metal.update(dt, this);
    // METAL MODE starter: halvparten av fiendene i bildet får panikk
    if (this.metal.on && !wasMetal) for (const o of this.foes) if (o.f.alive && this.onScreen(o.f.pos.x, 0) && chance(0.5)) o.panic(rand(1.5, 3), true);
    for (const [f] of this.juggle) if (f.onGround || !f.alive) this.juggle.delete(f);
    if (this.level.nightCamp) this.thieves(dt);
    this.updateVision(dt);
    // Årer og en rød kant som banker når den svakeste levende helten nesten er død
    let weakest = -1;
    for (const h of this.heroes) if (h.f.alive) weakest = Math.min(weakest < 0 ? 1 : weakest, Math.max(0, h.f.hp) / h.f.maxHp);
    screenFX.health(weakest);
    this.hud.updateBrawler(this.heroes);
  }

  /**
   * En lang drapsrekke (10 eller mer) ryker når en helt blir truffet eller dør: trist trombone (Morbidiums kombo).
   * Kortere rekker går som før, til tiden renner ut.
   */
  private watchStreak() {
    for (const h of this.heroes) {
      const s = h.f.state;
      const was = this.heroState.get(h);
      this.heroState.set(h, s);
      const hurt = (s === 'hurt' || s === 'down' || s === 'dead') && was !== undefined && was !== s && was !== 'hurt' && was !== 'down';
      if (!hurt || this.streak < 10) continue;
      W.fx.text(h.f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), 'STREAK BROKEN (' + this.streak + ')', 'word', 1.6);
      audio.chainBroken();
      this.streak = 0;
      this.streakT = 0;
    }
  }

  /**
   * Intensiteten i musikken: 0 rolig mellom bølgene, 1 kamp, 2 hete (mange fiender, en rytter eller en helt under
   * 30 prosent helse), 3 sjef. Opp med en gang, ned først etter 2,5 sekunder spilltid med ro, så bandet ikke vipper
   * fram og tilbake. Dirigenten legger lagene opp på slaget og ned på taktstreken.
   */
  private musicMood(dt: number) {
    let want: Level = 0;
    if (this.bossDone || this.dawned) want = 1;
    else if (this.boss?.f.alive) want = 3;
    else {
      const near = this.foes.filter((f) => f.f.alive && f.def.behavior !== 'runner' && this.onScreen(f.f.pos.x, 2)).length;
      if (this.wave || near) {
        want = 1;
        const rider = this.mounts.some((m) => m.rider?.team === 'enemy' && m.rider.alive);
        const low = this.heroes.some((h) => h.f.alive && h.f.hp < h.f.maxHp * 0.3);
        if (near >= (this.twoP ? 6 : 5) || rider || low) want = 2;
      }
    }
    if (want >= this.mood) {
      this.mood = want;
      this.calmT = 0;
    } else if ((this.calmT += dt) > 2.5) {
      this.mood = want;
      this.calmT = 0;
    }
    audio.intensity(this.mood);
  }

  /** Stemningen: hvor nær nærmeste bål og nærmeste foss er kameraet (0 til 1), og på hvilken side. */
  private ambienceTick(dt: number) {
    const nearest = (list: THREE.Vector3[] | undefined, reach: number) => {
      let near = 0, pan = 0;
      for (const p of list ?? []) {
        const k = 1 - Math.hypot(p.x - this.camX, (p.z + 1) * 0.6) / reach;
        if (k > near) {
          near = k;
          pan = Math.max(-0.7, Math.min(0.7, (p.x - this.camX) / 9));
        }
      }
      return [near * near, pan] as const;
    };
    const [fire, pan] = nearest(W.env?.fires, 13);
    // Fossene står langt bak, så de høres lenger unna
    const [water, wpan] = nearest(W.env?.waters, 22);
    audio.ambienceTick(dt, fire, pan, water, wpan);
  }

  /** Tyvnissene i nattleiren napper krukker fra heltene de løper forbi (høyst to hver). */
  private thieves(dt: number) {
    for (const fo of this.foes) {
      if (!fo.f.alive || fo.def.behavior !== 'runner' || fo.hits > 0) continue;
      const st = this.stolen.get(fo) ?? { n: 0, cd: 0 };
      st.cd -= dt;
      this.stolen.set(fo, st);
      if (st.n >= 2 || st.cd > 0) continue;
      for (const h of this.heroes) {
        if (!h.f.alive || h.potions <= 0) continue;
        if (Math.abs(h.f.pos.x - fo.f.pos.x) > 0.9 || Math.abs(h.f.pos.z - fo.f.pos.z) > 0.9) continue;
        h.potions--;
        st.n++;
        st.cd = 0.6;
        W.fx.text(fo.f.headPoint().add(new THREE.Vector3(0, 0.6, 0)), pick(['YOINK!', 'MINE NOW!', 'FINDERS KEEPERS!']), 'kill', 0.9);
        audio.pickup();
        break;
      }
    }
  }

  private onFoeHit(h: Hero, t: Fighter, killed: boolean) {
    this.metal.add(METAL.hit);
    this.scenery.poke(t.pos.x, t.pos.z, killed ? 2.5 : 1.5);
    if (!t.onGround) {
      const n = (this.juggle.get(t) ?? 0) + 1;
      this.juggle.set(t, n);
      if (n >= 2) {
        W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.7, 0)), JUGGLE_WORDS[Math.min(n, JUGGLE_WORDS.length - 1)] + ' x' + n, 'word', 0.8);
        this.metal.add(0.01 * n);
      }
      // Grensen for evige komboer (runde E): etter så mange treff i lufta slås han i bakken og blir liggende
      if (n >= JUGGLE_LIMIT && t.alive && !killed) {
        spike(t, h.f.facing);
        this.juggle.delete(t);
      }
    }
    const foe = this.foes.find((f) => f.f === t);
    // Eliter (tøffe fiender og kjemper) og sjefer leser helten: fire like slag på rad, og de blokkerer en stund
    const elite = !!foe && (!!foe.def.guard || !!foe.def.poise || !!foe.def.shield);
    const boss = !!this.boss && t === this.boss.f;
    if (!killed && t.alive && (elite || boss) && h.f.atk && this.habits.hit(h.f, t, h.f.atk.id, W.time)) {
      if (boss) this.boss!.blockFor(READ_BLOCK, h.f);
      else foe!.blockFor(READ_BLOCK, h.f);
    }
    // Nesten død: av og til løper han i panikk
    if (foe && !killed && t.alive && t.hp < t.maxHp * 0.3 && chance(0.25)) foe.panic(rand(2.5, 4));
    // En tyv som blir truffet, mister alt han har stjålet
    const loot = foe ? this.stolen.get(foe) : undefined;
    if (foe && loot && loot.n > 0) {
      for (let i = 0; i < loot.n; i++) this.pickups.push(new Pickup('potion', t.pos.x, 1.3, t.pos.z));
      W.fx.text(t.headPoint().add(new THREE.Vector3(0, 1.0, 0)), 'GIVE THAT BACK!', 'word', 1.0);
      loot.n = 0;
      loot.cd = 99;
    }
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
        if (f.regrowArms()) W.gore.later(0.5, () => W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), 'MY ARM GREW BACK. DON\'T ASK.', 'speech', 2));
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

  /** Testspill fra brettverkstedet: start ved x. Bølgene før x regnes som ferdige. */
  startAt(x: number) {
    x = Math.max(-1, Math.min(x, this.L - 12));
    this.camX = x;
    this.introT = 2;
    this.heroes.forEach((h, i) => h.f.pos.set(x - 3 + i * 0.6, 0, i === 0 ? 0.6 : -0.8));
    const waves = this.level.waves;
    while (this.waveIdx < waves.length && waves[this.waveIdx].at < x - 1) this.waveIdx++;
  }

  /** Figurene som bokser (forgrunnen tones ut når de står bak den, se gfx/scenery.ts). */
  private fighterBoxes(): FighterBox[] {
    const out: FighterBox[] = [];
    const add = (f: Fighter) => {
      // En skjult froskemann i buskene skal ikke tone ut forgrunnen
      if (f.rig.root.parent && !f.hidden) out.push({ x: f.pos.x, y: f.pos.y, z: f.pos.z, h: 2.1 * f.size, w: 1.1 * f.size });
    };
    for (const h of this.heroes) add(h.f);
    for (const f of this.foes) add(f.f);
    if (this.boss) add(this.boss.f);
    return out;
  }

  /**
   * Vorthax holder tale fra himmelen når kameraet når stedet hans, mellom bølgene så heltene rekker å lese. Hodet
   * kommer med et tordenbrak og lilla lys, sier én replikk om gangen og toner ut (gfx/vision.ts). Spilltid hele veien.
   */
  private updateVision(dt: number) {
    const v = this.level.vorthax;
    if (!v) return;
    if (!this.vision && !this.visionDone && !this.wave && !this.boss && this.camX >= v.at - 0.2) {
      this.vision = new Vision(W.scene, 'vorthax', this.camX);
      this.visionT = 0;
      this.visionLine = 0;
      audio.thunder(0.7);
      W.fx.lightningFlash(0.3, 0.15);
    }
    const vi = this.vision;
    if (!vi) return;
    this.visionT += dt;
    if (this.visionLine < v.lines.length && this.visionT >= 1 + this.visionLine * VISION_LINE) {
      this.say('VORTHAX', v.lines[this.visionLine], VISION_LINE - 0.2);
      this.visionLine++;
    }
    if (this.visionT >= 1 + v.lines.length * VISION_LINE) vi.fade();
    vi.update(dt, this.camX);
    if (vi.done) {
      vi.dispose();
      this.vision = null;
      this.visionDone = true;
    }
  }

  dispose() {
    this.vision?.dispose();
    this.vision = null;
    this.scenery.dispose();
    this.metal.stop();
    audio.ambience(null);
    Fighter.onThrownLand = null;
    for (const m of this.mounts) m.remove();
    for (const p of this.pets) p.remove();
    for (const h of this.heroes) h.f.remove();
    for (const f of this.foes) f.f.remove();
    this.boss?.cleanup();
    this.boss?.f.remove();
    this.shieldFx?.dispose();
    this.lavaFx?.dispose();
    for (const p of this.pickups) p.dispose();
    this.proj.clear();
    this.icicles.clear();
  }
}
