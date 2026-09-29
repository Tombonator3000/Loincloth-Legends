// 1v1 duell i Barbarian-stil: retning + angrep, blokk høy/lav, halshugging, oppryddings-imp.
import * as THREE from 'three';
import { Fighter, type Bounds } from './fighter';
import { DUEL_ATK, type AttackDef } from './attacks';
import { resolveAttack, applyHit } from './combat';
import { W } from './world';
import { screenFX } from '../gfx/screenfx';
import { buildArena, type ArenaTheme } from '../gfx/env';
import type { PlayerInput } from '../core/input';
import type { CharId } from '../gfx/chars';
import { scaleAttack, type WeaponStats } from '../data/weapons';
import { audio } from '../core/audio';
import { rand, pick, chance, weighted, clamp } from '../core/math';
import type { HUD } from '../ui/hud';

export interface DuelSide {
  cid: CharId;
  name: string;
  human: boolean;
  input?: PlayerInput;
  hp: number;
  speed: number;
  dmg: number;
  tint?: [number, number, number];
  scale?: number;
  weapon?: WeaponStats;
  skill?: number;
  aggression?: number;
  taunts?: string[];
  /** Spillerindeks (for rumble). */
  player?: number;
  /** Skade som tas (DEF-poeng). */
  dmgTaken?: number;
}
export interface DuelConfig {
  /** Én side, eller en liste (tag team: spillerne bytter på per runde). */
  a: DuelSide | DuelSide[];
  b: DuelSide;
  intro?: [string, string][];
  roundsToWin: number;
  arena: ArenaTheme;
}
type MoveKey = keyof typeof DUEL_ATK;

const LIGHTNING: AttackDef = { ...DUEL_ATK.over, id: 'lightning', death: ['explode'] };
const BOUNDS: Bounds = { minX: -8, maxX: 8, minZ: -0.3, maxZ: 0.3 };
const TAUNTS_CPU = ['IS THAT ALL?', 'TUESDAY WAS HARDER!', 'I\'VE HAD WORSE PAPERCUTS!', 'COME HERE, LITTLE SNACK!'];
const TAUNTS_HERO = ['BY CROM\'S COUSIN!', 'FOR THE HAM!', 'STEEL AND SWEAT!', 'NICE HAIR. SHAME ABOUT THE HEAD.'];
const IMP_LINES = ['UNION RULES. I GET 15 MINUTES AFTER THIS.', 'EVERY. SINGLE. TUESDAY.', 'WHO SIGNED OFF ON THE GIBS?', 'THIS IS NOT IN MY JOB DESCRIPTION.', 'I HAVE A DEGREE, YOU KNOW.'];

class DuelCtl {
  think = 0;
  plan: 'none' | 'block' | 'duck' = 'none';
  planT = 0;
  aggression: number;
  baseSkill: number;
  tauntCd = rand(3, 6);
  constructor(public f: Fighter, public input: PlayerInput | null, public side: DuelSide) {
    this.aggression = side.aggression ?? 0.5;
    this.baseSkill = side.skill ?? 0.32;
  }

  m(k: MoveKey) {
    return scaleAttack(DUEL_ATK[k], this.f.weapon);
  }

  update(dt: number, opp: Fighter, duel: Duel) {
    const f = this.f;
    f.wantVX = 0;
    f.wantVZ = 0;
    if (!f.alive || duel.phase !== 'fight') return;
    if (f.canAct()) f.face(opp.pos.x - f.pos.x);
    if (this.input) this.human(dt, opp);
    else this.cpu(dt, opp, duel);
  }

  private human(dt: number, opp: Fighter) {
    const f = this.f;
    const inp = this.input!;
    const ax = inp.axisX();
    const toward = ax !== 0 && Math.sign(ax) === f.facing;
    const away = ax !== 0 && !toward;
    if (!f.onGround) {
      if (f.state === 'jump' && !f.airAttackUsed && inp.consumeAttack()) {
        f.airAttackUsed = true;
        f.startAttack(this.m('neck'));
      }
      return;
    }
    if (!f.canAct()) return;
    if (inp.held.special) {
      if (f.state !== 'block') f.setState('block');
      f.blocking = inp.held.down ? 'low' : 'high';
      return;
    }
    if (f.state === 'block') f.setState('idle');
    // Grip-knappen er rulle i duellen (lettere på berøringsskjerm enn ned + hopp)
    if (inp.consumeGrab()) {
      f.setState('roll');
      audio.jump();
      return;
    }
    if (inp.consumeJump()) {
      if (inp.held.down) {
        f.setState('roll');
        audio.jump();
      } else f.jump(ax * 3.2, 0, 9.8);
      return;
    }
    if (inp.consumeAttack()) {
      if (inp.held.down) f.startAttack(this.m('sweep'));
      else if (inp.held.up) f.startAttack(this.m('over'));
      else if (toward) f.startAttack(this.m('kick'));
      else if (away) f.startAttack(this.m('whirl'));
      else f.startAttack(this.m('slash'));
      return;
    }
    if (inp.held.down) {
      if (f.state !== 'crouch') f.setState('crouch');
      return;
    }
    if (f.state === 'crouch') f.setState('idle');
    f.wantVX = ax * f.speed * (away ? 0.8 : 1);
    void dt;
    void opp;
  }

  private cpu(dt: number, opp: Fighter, duel: Duel) {
    const f = this.f;
    this.think -= dt;
    this.planT -= dt;
    this.tauntCd -= dt;
    const dx = opp.pos.x - f.pos.x;
    const d = Math.abs(dx);
    if (!f.onGround) {
      if (f.state === 'jump' && !f.airAttackUsed && d < 2.6 && f.vel.y < 3) {
        f.airAttackUsed = true;
        f.startAttack(this.m('neck'));
      }
      return;
    }
    if (!f.canAct()) return;

    // Hold en pågående plan (blokk / duck)
    if (this.plan !== 'none' && this.planT > 0) {
      if (this.plan === 'block') {
        if (f.state !== 'block') f.setState('block');
        f.blocking = opp.atk?.height === 'low' ? 'low' : f.blocking;
      } else if (f.state !== 'crouch') f.setState('crouch');
      return;
    }
    if (this.plan !== 'none') {
      this.plan = 'none';
      f.setState('idle');
    }
    if (this.think > 0) {
      f.wantVX = f.data.walk as number ?? 0;
      return;
    }
    const skill = this.baseSkill + duel.round * 0.1 + this.aggression * 0.1;
    this.think = duel.round === 1 ? rand(0.25, 0.5) : rand(0.14, 0.32) - duel.round * 0.02;
    f.data.walk = 0;

    // Reaksjon på motstanderens angrep
    const oa = opp.atk;
    if (oa && opp.phase() === 'wind' && d < oa.reach + 0.6 && chance(skill)) {
      if (oa.guardBreak) {
        f.data.walk = -f.facing * f.speed;
        this.think = 0.3;
      } else if (oa.height === 'low') {
        if (chance(0.3)) f.jump(0, 0, 9.8);
        else {
          this.plan = 'block';
          f.setState('block');
          f.blocking = 'low';
          this.planT = oa.startup + oa.active + 0.05;
        }
      } else if (oa.height === 'high' && chance(0.4)) {
        if (chance(0.5) && d < 2.2) f.startAttack(this.m('sweep'));
        else {
          this.plan = 'duck';
          f.setState('crouch');
          this.planT = oa.startup + oa.active + 0.05;
        }
      } else {
        this.plan = 'block';
        f.setState('block');
        f.blocking = 'high';
        this.planT = oa.startup + oa.active + 0.05;
      }
      return;
    }
    // Straff motstanderen i recovery
    if (oa && opp.phase() === 'recover' && d < 1.95 && chance(skill)) {
      f.startAttack(chance(0.5) ? this.m('slash') : this.m('over'));
      return;
    }
    if (opp.state === 'stunned' && d < 1.9) {
      f.startAttack(chance(0.6) ? this.m('over') : this.m('slash'));
      return;
    }
    // Hån
    if (this.tauntCd <= 0 && d > 4) {
      this.tauntCd = rand(6, 10);
      f.setState('taunt');
      f.stunT = 0.9;
      W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.9, 0)), pick(this.side.taunts ?? TAUNTS_CPU), 'speech', 1.8);
      setTimeout(() => f.state === 'taunt' && f.setState('idle'), 900);
      return;
    }
    const reachOf = (a: AttackDef) => a.reach * (0.85 + (0.15 * f.size) / 0.9) - 0.15;
    if (d > 1.95) {
      if (d > 2.5 && d < 3.4 && chance(0.04 + duel.round * 0.04)) {
        f.jump(f.facing * 3.2, 0, 9.8);
        return;
      }
      f.data.walk = f.facing * f.speed;
      this.think = rand(0.1, 0.25);
      return;
    }
    if (d < 1.0) {
      if (chance(0.5)) f.startAttack(this.m('kick'));
      else {
        f.data.walk = -f.facing * f.speed;
        this.think = 0.25;
      }
      return;
    }
    const oppBlock = opp.state === 'block' ? opp.blocking : 'none';
    const w: Partial<Record<'slash' | 'over' | 'sweep' | 'kick' | 'whirl' | 'wait' | 'block', number>> =
      oppBlock === 'high' ? { sweep: 4, kick: 4, slash: 1, wait: 1 }
      : oppBlock === 'low' ? { over: 5, kick: 2, wait: 1 }
      : { slash: 3, over: 1.6, sweep: 2, kick: 0.8, whirl: 0.8, wait: 2.2 - this.aggression - duel.round * 0.3, block: 0.8 };
    const c = weighted(w);
    if (c === 'wait') {
      f.data.walk = chance(0.5) ? -f.facing * f.speed * 0.6 : 0;
      this.think = rand(0.2, 0.45);
    } else if (c === 'block') {
      this.plan = 'block';
      f.setState('block');
      f.blocking = chance(0.6) ? 'high' : 'low';
      this.planT = rand(0.3, 0.6);
    } else if (d > reachOf(this.m(c))) {
      f.data.walk = f.facing * f.speed;
      this.think = 0.12;
    } else f.startAttack(this.m(c));
  }
}

export class Duel {
  fa!: Fighter;
  fb!: Fighter;
  ca!: DuelCtl;
  cb!: DuelCtl;
  wins = [0, 0];
  round = 0;
  phase: 'intro' | 'fight' | 'ko' | 'cleanup' | 'done' = 'intro';
  t = 0;
  timer = 60;
  winner: 0 | 1 | -1 = -1;
  loser: Fighter | null = null;
  imp: Fighter | null = null;
  impStage = 0;
  camX = 0;
  camFocus: THREE.Vector3 | null = null;
  focusT = 0;
  done = false;
  matchWinner: 0 | 1 = 0;
  corpses: Fighter[] = [];
  private said = false;
  private roster: DuelSide[];
  sideA!: DuelSide;

  constructor(public hud: HUD, public cfg: DuelConfig) {
    this.roster = Array.isArray(cfg.a) ? cfg.a : [cfg.a];
    W.env = buildArena(W.scene, W.gore, cfg.arena);
    W.gore.bounds = { minX: -12, maxX: 12, minZ: -5, maxZ: 3 };
    this.hud.showDuel(this.roster[0], cfg.b);
    // Duellåta kommer på neste taktstrek med en bro fra det som spilte (frost, kartet), eller med en gang
    audio.queue('duel');
    audio.ambience('arena');
    this.newRound();
  }

  private makeFighter(s: DuelSide, idx: number) {
    const f = new Fighter(s.cid, 'hero', { hp: s.hp, speed: s.speed, dmgMul: s.dmg, tint: s.tint, scale: s.scale, weapon: s.weapon });
    f.label = s.name;
    if (s.human) f.player = s.player ?? idx;
    if (s.dmgTaken) f.dmgTaken = s.dmgTaken;
    f.corpseLife = 999;
    f.pos.set(idx === 0 ? -9.5 : 9.5, 0, idx === 0 ? 0.12 : -0.12);
    f.facing = idx === 0 ? 1 : -1;
    f.addTo(W.scene);
    return f;
  }

  private newRound() {
    this.round++;
    this.t = 0;
    this.timer = 60;
    this.phase = 'intro';
    this.winner = -1;
    this.said = false;
    for (const c of this.corpses) c.remove();
    this.corpses = [];
    const nextA = this.roster[(this.round - 1) % this.roster.length];
    if (!this.fa || !this.fa.alive || nextA !== this.sideA) {
      this.fa?.remove();
      this.sideA = nextA;
      this.fa = this.makeFighter(nextA, 0);
      if (this.roster.length > 1) {
        this.hud.showDuel(nextA, this.cfg.b);
        if (this.round > 1) this.hud.say('ANNOUNCER', 'TAG! ' + nextA.name + ' STEPS INTO THE PIT!', 2);
      }
    }
    if (!this.fb || !this.fb.alive) {
      this.fb?.remove();
      this.fb = this.makeFighter(this.cfg.b, 1);
    }
    for (const [f, i] of [[this.fa, 0], [this.fb, 1]] as const) {
      f.hp = f.maxHp;
      f.setState('walk');
      f.atk = null;
      f.pos.z = i === 0 ? 0.12 : -0.12;
      f.facing = i === 0 ? 1 : -1;
    }
    this.ca = new DuelCtl(this.fa, this.sideA.human ? this.sideA.input ?? null : null, this.sideA);
    this.cb = new DuelCtl(this.fb, this.cfg.b.human ? this.cfg.b.input ?? null : null, this.cfg.b);
    this.hud.announce('ROUND ' + this.round, 'round', 1.6);
  }

  update(dt: number, realDt: number, skip: boolean) {
    this.t += dt;
    const fa = this.fa, fb = this.fb;
    // Musikken: kamp under introen, hete når de slåss, og sjefsnivå i avgjørende runde
    const need = this.cfg.roundsToWin - 1;
    audio.intensity(this.phase !== 'fight' ? 1 : this.wins[0] === need && this.wins[1] === need ? 3 : 2);
    if (this.phase === 'intro') {
      for (const [f, x] of [[fa, -2.8], [fb, 2.8]] as const) {
        const d = x - f.pos.x;
        f.wantVX = Math.abs(d) > 0.1 ? Math.sign(d) * 3.2 : 0;
        if (Math.abs(d) <= 0.1 && f.state === 'walk') f.setState('idle');
      }
      if (this.round === 1 && !this.said && this.t > 0.4) {
        this.said = true;
        this.storyIntro();
      }
      const introLen = this.round === 1 && this.cfg.intro?.length ? 1.2 + this.cfg.intro.length * 1.9 : 2.4;
      if (this.t > introLen) {
        this.phase = 'fight';
        this.t = 0;
        this.hud.announce('FIGHT!', 'fight', 0.9);
        audio.fight();
        audio.crowd(1);
        W.env?.cheer?.(1);
      }
    } else if (this.phase === 'fight') {
      this.timer -= dt;
      this.ca.update(dt, fb, this);
      this.cb.update(dt, fa, this);
      if (this.timer <= 0) this.timeUp();
    } else if (this.phase === 'ko') {
      fa.wantVX = fb.wantVX = 0;
      if (this.t > 3.2 || (skip && this.t > 0.8)) this.startCleanup();
    } else if (this.phase === 'cleanup') {
      this.updateImp(dt);
      if (skip && this.impStage < 4) this.finishCleanup();
    }

    const hitOpts = { pvp: true, onHit: (_a: Fighter, t: Fighter, r: { killed: boolean; decap: boolean; blocked: boolean }) => this.onHit(t, r) };
    fa.update(dt, BOUNDS);
    fb.update(dt, BOUNDS);
    // Årer og rød kant når en menneskestyrt duellant nesten er død (den svakeste i P1 mot P2)
    let weakest = -1;
    for (const f of [fa, fb]) if (f.player >= 0 && f.alive) weakest = Math.min(weakest < 0 ? 1 : weakest, Math.max(0, f.hp) / f.maxHp);
    screenFX.health(this.phase === 'fight' ? weakest : -1);
    if (this.phase === 'fight') {
      resolveAttack(fa, [fb], hitOpts);
      resolveAttack(fb, [fa], hitOpts);
      // Kroppene kan ikke gå gjennom hverandre
      const dx = fb.pos.x - fa.pos.x;
      const minD = 0.9;
      if (Math.abs(dx) < minD && fa.alive && fb.alive && fa.onGround && fb.onGround && fa.state !== 'roll' && fb.state !== 'roll') {
        const push = (minD - Math.abs(dx)) / 2;
        const s = Math.sign(dx) || 1;
        fa.pos.x -= s * push;
        fb.pos.x += s * push;
      }
    }
    for (const c of this.corpses) c.update(dt, BOUNDS);
    if (this.imp) this.imp.update(dt, { minX: -14, maxX: 14, minZ: -1, maxZ: 1 });

    // Kamera
    const cam = W.camera;
    const mid = (fa.pos.x + fb.pos.x) / 2;
    const spread = Math.abs(fa.pos.x - fb.pos.x);
    let tx = clamp(mid, -3, 3);
    let dist = clamp(8.5 + spread * 0.5, 9, 13);
    let ty = 3.0;
    let ly = 1.7;
    this.focusT -= realDt;
    if (this.camFocus && this.focusT > 0) {
      tx = this.camFocus.x;
      dist = 6;
      ty = Math.max(1.5, this.camFocus.y + 0.8);
      ly = Math.max(0.8, this.camFocus.y);
    }
    if (this.phase === 'cleanup' && this.imp) tx = clamp(this.imp.pos.x * 0.6, -4, 4);
    this.camX += (tx - this.camX) * Math.min(1, realDt * 4);
    const k = Math.min(1, realDt * 3);
    cam.position.x = this.camX;
    cam.position.y += (ty - cam.position.y) * k;
    cam.position.z += (dist - cam.position.z) * k;
    cam.userData.lookY = (cam.userData.lookY ?? ly) + (ly - (cam.userData.lookY ?? ly)) * k;
    cam.lookAt(this.camX, cam.userData.lookY, 0);

    this.hud.updateDuel(fa, fb, this.wins, this.timer, this.round);
  }

  private storyIntro() {
    (this.cfg.intro ?? []).forEach(([who, text], i) => setTimeout(() => this.hud.say(who, text, 1.8), i * 1900));
  }

  private onHit(t: Fighter, r: { killed: boolean; decap: boolean; blocked: boolean }) {
    if (r.blocked) return;
    W.env?.cheer?.(r.killed ? 1 : 0.35);
    if (r.killed) this.ko(t, r.decap);
    else if (chance(0.25)) audio.crowd(0.4);
  }

  private ko(loser: Fighter, decap: boolean) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.t = 0;
    this.loser = loser;
    this.winner = loser === this.fa ? 1 : 0;
    const w = this.winner === 0 ? this.fa : this.fb;
    this.wins[this.winner]++;
    audio.knockout();
    W.env?.cheer?.(1);
    W.fx.slowmo(0.25, 1.4);
    if (decap || loser.deathStyle === 'headsplode' || loser.deathStyle === 'explode') W.fx.screenBlood(decap ? 10 : 6);
    if (decap && loser.headDebris) {
      this.camFocus = loser.headDebris.obj.position;
      this.focusT = 1.6;
      this.hud.announce('DECAPITATION!', 'kill', 2.2);
    } else {
      this.camFocus = loser.torsoPoint().clone();
      this.focusT = 1.0;
      this.hud.announce(pick(['BUTCHERED!', 'FLAWLESS BUTCHERY!', 'SLAUGHTERED!', 'MAXIMUM GORE!']), 'kill', 2.2);
    }
    setTimeout(() => {
      if (w.alive && w.canAct()) {
        w.setState('victory');
        const side = w === this.fa ? this.sideA : this.cfg.b;
        if (chance(0.7)) W.fx.text(w.headPoint().add(new THREE.Vector3(0, 0.9, 0)), pick(side.human ? TAUNTS_HERO : side.taunts ?? TAUNTS_CPU), 'speech', 2);
      }
    }, 900);
  }

  private timeUp() {
    const ra = this.fa.hp / this.fa.maxHp;
    const rb = this.fb.hp / this.fb.maxHp;
    const loser = ra < rb ? this.fa : this.fb;
    this.hud.say('VORTHAX', 'TIME\'S UP! I\'M BORED. ZAP.', 2);
    const p = loser.headPoint();
    for (let i = 0; i < 20; i++) W.gore.flare(new THREE.Vector3(p.x + rand(-0.3, 0.3), p.y + i * 0.5, 0.2), 0.6, '#9fd8ff', 0.3);
    audio.thunder(1.2);
    W.fx.lightningFlash(0.8, 0.3);
    const other = loser === this.fa ? this.fb : this.fa;
    applyHit(other, loser, LIGHTNING, 9999);
    if (this.phase === 'fight') this.ko(loser, false);
  }

  private startCleanup() {
    this.phase = 'cleanup';
    this.t = 0;
    this.impStage = 0;
    const lo = this.loser!;
    this.imp = new Fighter('imp', 'enemy', { hp: 10, speed: 3 });
    this.imp.pos.set(lo.pos.x > 0 ? -11 : 11, 0, 0.5);
    this.imp.facing = lo.pos.x > 0 ? 1 : -1;
    this.imp.addTo(W.scene);
    const w = this.winner === 0 ? this.fa : this.fb;
    if (w.alive && w.state === 'victory') w.setState('idle');
  }

  private updateImp(dt: number) {
    const imp = this.imp!;
    const lo = this.loser!;
    const head = lo.headDebris;
    const walkTo = (x: number, speed = 3.4) => {
      const d = x - imp.pos.x;
      imp.face(d);
      imp.wantVX = Math.abs(d) > 0.15 ? Math.sign(d) * speed : 0;
      return Math.abs(d) <= 0.15;
    };
    switch (this.impStage) {
      case 0: // gå til hodet (hvis det finnes) eller liket
        this.t += dt;
        if (this.t > 4.5) {
          this.impStage = 2;
          break;
        }
        if (head && head.obj.parent) {
          if (walkTo(head.obj.position.x - Math.sign(head.obj.position.x - imp.pos.x || 1) * 0.5)) {
            imp.startAttack({ ...DUEL_ATK.kick, dmg: 0 });
            this.impStage = 1;
            this.t = 0;
          }
        } else this.impStage = 2;
        break;
      case 1:
        this.t += dt;
        if (this.t > 0.15 && head) {
          // Impen sparker hodet rett mot kameraet. Det klasker i skjermen og sklir sakte ned.
          head.held = true;
          head.rest = true;
          head.life = 99;
          W.fx.hurlAtScreen(head.obj, lo.headImg(), 0.6, () => {
            W.gore.removeDebris(head);
            audio.crowd(1.2);
            W.env?.cheer?.(1);
          });
          audio.hit(true);
          W.fx.text(head.obj.position.clone().add(new THREE.Vector3(0, 1, 0)), pick(['HEADS UP!', 'FORE!', 'INCOMING!', 'NOT THE SCREEN!']), 'word');
          audio.crowd(1);
          W.env?.cheer?.(0.8);
          this.impStage = 2;
          this.t = 0;
        }
        break;
      case 2: // gå til liket
        if (imp.canAct() && walkTo(lo.pos.x + (imp.pos.x < lo.pos.x ? -0.9 : 0.9))) {
          this.impStage = 3;
          this.t = 0;
          W.fx.text(imp.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(IMP_LINES), 'speech', 2.4);
        }
        break;
      case 3: {
        // dra liket ut
        this.t += dt;
        if (this.t < 0.6) break;
        const exit = imp.pos.x < 0 ? -13 : 13;
        const dir = Math.sign(exit - imp.pos.x);
        imp.face(-dir);
        imp.setState('drag');
        imp.pos.x += dir * 2.4 * dt;
        imp.vel.x = 0;
        lo.pos.x = imp.pos.x - dir * 0.9 * (lo.facing === dir ? 1 : 1) - dir * 0.3;
        lo.rig.root.position.x = lo.pos.x;
        if (Math.random() < dt * 6) W.gore.splat(lo.pos.x, lo.pos.z + rand(-0.2, 0.2), rand(0.3, 0.5));
        if (Math.abs(imp.pos.x) > 12.5) this.finishCleanup();
        break;
      }
    }
  }

  private finishCleanup() {
    this.impStage = 4;
    this.imp?.remove();
    this.imp = null;
    if (this.loser) {
      this.loser.remove();
      this.loser.headDebris?.obj.removeFromParent();
    }
    this.camFocus = null;
    for (const d of W.gore.debris) d.life = Math.min(d.life, 0.5);
    const need = this.cfg.roundsToWin;
    if (this.wins[0] >= need || this.wins[1] >= need) {
      this.matchWinner = this.wins[0] >= need ? 0 : 1;
      this.phase = 'done';
      this.done = true;
      return;
    }
    this.newRound();
  }

  dispose() {
    audio.ambience(null);
    this.fa?.remove();
    this.fb?.remove();
    this.imp?.remove();
  }
}

export { applyHit };
