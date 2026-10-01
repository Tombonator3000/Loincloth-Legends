// Grep og kast (Golden Axe-stil): ta tak i en fiende, slå med kneet, og kast ham i andre fiender eller i en fare.
import * as THREE from 'three';
import type { Fighter } from './fighter';
import { P, type AttackDef } from './attacks';
import { applyHit } from './combat';
import { W } from './world';
import { audio } from '../core/audio';
import { pick } from '../core/math';

/** Kneet i magen mens du holder. Tredje gang kastes han automatisk. */
export const PUMMEL: AttackDef = {
  id: 'pummel', startup: 0.02, active: 0.05, recovery: 0.12, dmg: 6, reach: 1.4, zr: 0.9, height: 'mid', push: 0, stun: 0.4,
  wind: P.kickW, strike: P.kickS, death: ['headsplode', 'explode', 'normal'], swoosh: 'none', word: ['KNEE!', 'HEADBUTT!', 'OOF!'],
};
/** Den kastede fienden treffer en annen fiende (bowling). */
export const BOWL: AttackDef = {
  id: 'bowl', startup: 0, active: 0.1, recovery: 0, dmg: 12, reach: 1, zr: 1, height: 'mid', kd: true, launch: 6, push: 6, stun: 0.6,
  heavy: true, wind: P.hurt, strike: P.hurt, death: ['explode', 'dismember', 'normal'], swoosh: 'none', word: ['STRIKE!', 'BOWLED!', 'SPARE!'],
};
/** Den kastede fienden lander. */
export const SLAM: AttackDef = {
  id: 'slam', startup: 0, active: 0.1, recovery: 0, dmg: 14, reach: 1, zr: 1, height: 'mid', kd: true, launch: 2.5, push: 1.5, stun: 0.6,
  heavy: true, wind: P.hurt, strike: P.hurt, death: ['explode', 'headsplode', 'normal'], swoosh: 'none', word: ['SLAM!', 'CRUNCH!', 'THUD!'],
};
/** Selve kastebevegelsen (treffer ingen). */
export const THROW_MOVE: AttackDef = {
  id: 'toss', startup: 0.04, active: 0.06, recovery: 0.26, dmg: 0, reach: 0, zr: 0, height: 'mid', push: 0, stun: 0,
  wind: P.throwW, strike: P.throwS, death: ['normal'], swoosh: 'none',
};

const GRAB_REACH = 1.45;
/** Grep uten knapp: helten må gå helt inntil fienden (se Hero.update). */
export const AUTO_GRAB = { reach: 1.0, zr: 0.42, time: 0.12 };

/** Kan denne figuren gripes i det hele tatt? Sjefer, ridende og store beist er for tunge. */
function liftable(f: Fighter) {
  return f.alive && f.onGround && !f.armored && !f.mount && !f.noSever && f.size <= 1.3 && f.state !== 'down' && f.state !== 'getup' && f.state !== 'held' && f.state !== 'dead';
}

/**
 * Ute av balanse: en tøff fiende (guard) kan bare gripes rett etter et treff som fikk ham til å vakle (Fighter.staggerT),
 * når han er svimmel, eller når han har under en tredjedel av livet igjen. Småfolk kan alltid gripes.
 */
export function offBalance(f: Fighter) {
  return !f.guard || f.staggerT > 0 || f.state === 'hurt' || f.state === 'stunned' || f.hp < f.maxHp / 3;
}

/** Kan denne figuren gripes nå? */
export function grabbable(f: Fighter) {
  return liftable(f) && offBalance(f);
}

/**
 * Finn nærmeste fiende foran som kan gripes. tooHeavy er en som aldri kan gripes, guarded en tøff fiende som står
 * imot fordi han ikke vakler (slå ham først).
 */
export function findGrab(h: Fighter, foes: Fighter[], reach = GRAB_REACH, zr = 0.6) {
  let best: Fighter | null = null;
  let bd = 1e9;
  let heavy: Fighter | null = null;
  let guarded: Fighter | null = null;
  for (const f of foes) {
    if (!f.alive || f === h) continue;
    const dx = (f.pos.x - h.pos.x) * h.facing;
    const dz = Math.abs(f.pos.z - h.pos.z);
    if (dx < -0.2 || dx > reach || dz > zr) continue;
    if (!grabbable(f)) {
      if (liftable(f)) guarded = f;
      else if (f.state !== 'down' && f.state !== 'dead') heavy = f;
      continue;
    }
    const d = Math.abs(dx) + dz;
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return { target: best, tooHeavy: heavy, guarded };
}

/** Det en tøff fiende sier når helten prøver å gripe ham før han vakler. */
export const RESIST_BARKS = ['NOT SO FAST!', 'NO HUGS!', 'HANDS OFF, PEASANT!', 'BUY ME DINNER FIRST!', 'TOO MUCH HOG!'];

/**
 * En tøff fiende står imot grepet: helten blir skjøvet et lite stykke bakover (ingen skade) og må slå ham ut av
 * balanse først.
 */
export function resistGrab(h: Fighter, t: Fighter) {
  const dir = Math.sign(h.pos.x - t.pos.x) || -h.facing;
  h.hurt(0.22, dir * 3.2);
  h.staggerT = 0;
  t.face(h.pos.x - t.pos.x || t.facing);
  audio.grunt(t.def.voice);
  W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(RESIST_BARKS), 'speech', 1.1);
}

export function startHold(h: Fighter, t: Fighter) {
  h.setState('hold');
  h.holding = t;
  h.atk = null;
  h.data.holdT = 0;
  h.data.pummels = 0;
  h.data.pummelT = 0;
  h.data.quietT = 0;
  t.setState('held');
  t.heldBy = h;
  t.atk = null;
  t.vel.set(0, 0, 0);
  h.face(t.pos.x - h.pos.x || h.facing);
  audio.grunt(h.def.voice);
  audio.hit();
  W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['GOTCHA!', 'COME HERE!', 'HUG TIME!']), 'word', 0.8);
}

/** Sekunder en fiende lar seg holde uten å bli slått før han river seg løs. */
export const BREAK_FREE = 1.5;

/** Den som holdes, river seg løs og skyver helten bakover. */
export function breakFree(h: Fighter, t: Fighter) {
  h.holding = null;
  t.heldBy = null;
  const dir = Math.sign(h.pos.x - t.pos.x) || -t.facing;
  h.hurt(0.3, dir * 3.5);
  t.setState('idle');
  t.face(h.pos.x - t.pos.x);
  t.invuln = 0.2;
  audio.grunt(t.def.voice);
  W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['LET GO OF ME!', 'SLIPPERY!', 'NOT TODAY!', 'I\'M OILED!']), 'speech', 1.2);
}

export function pummel(h: Fighter) {
  const t = h.holding;
  if (!t) return;
  h.data.pummelT = 0.16;
  h.data.quietT = 0;
  h.data.pummels = ((h.data.pummels as number) ?? 0) + 1;
  applyHit(h, t, PUMMEL);
  audio.swish(1.2);
}

/**
 * Kast den du holder. dir = 1 (høyre) eller -1 (venstre). dz = -1 (opp, bakover) eller 1 (ned, forover) kaster
 * i dybden, for eksempel over taugjerdet og ned i juvet.
 */
export function throwHeld(h: Fighter, dir: number, dz = 0) {
  const t = h.holding;
  if (!t) return;
  h.holding = null;
  t.heldBy = null;
  h.face(dir);
  h.startAttack(THROW_MOVE);
  if (!t.alive) return;
  t.thrownBy = h;
  t.data.bowled = [] as number[];
  t.pos.set(h.pos.x + dir * 0.6, 1.1, h.pos.z);
  t.knockdown(dir * (dz ? 5 : 10.5), dz ? 7 : 6.2);
  if (dz) t.vel.z = Math.sign(dz) * 6;
  t.facing = -dir;
  t.invuln = 0;
  audio.swish(0.7, true);
  audio.scream(t.def.voice);
  W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.6, 0)), pick(['YEET!', 'AWAY WITH YOU!', 'FLY, PEASANT!', 'TAXI!']), 'word', 0.9);
}

/**
 * Oppdater holdet for en helt: angrep = kne (tre ganger og han kastes), retning + angrep, hopp eller grip = kast.
 * Opp eller ned kaster i dybden (az). Returnerer true når holdet håndterte input denne framen.
 */
export function updateHold(h: Fighter, dt: number, ax: number, az: number, attack: boolean, toss: boolean) {
  const t = h.holding;
  if (!t || !t.alive || t.state !== 'held') {
    if (h.state === 'hold') h.setState('idle');
    return false;
  }
  h.data.holdT = ((h.data.holdT as number) ?? 0) + dt;
  h.data.quietT = ((h.data.quietT as number) ?? 0) + dt;
  h.data.pummelT = Math.max(0, ((h.data.pummelT as number) ?? 0) - dt);
  // Han river seg løs etter BREAK_FREE sekunder uten slag (runde E), og uansett etter 2,8 sekunder
  if ((h.data.quietT as number) > BREAK_FREE || (h.data.holdT as number) > 2.8) {
    breakFree(h, t);
    return true;
  }
  if (toss) {
    throwHeld(h, ax !== 0 ? Math.sign(ax) : h.facing, az);
    return true;
  }
  if (attack) {
    if (ax !== 0 || az !== 0) throwHeld(h, ax !== 0 ? Math.sign(ax) : h.facing, az);
    else if (((h.data.pummels as number) ?? 0) >= 2) {
      pummel(h);
      if (h.holding?.alive) throwHeld(h, h.facing);
    } else pummel(h);
    return true;
  }
  return true;
}

/** Den kastede fienden velter andre fiender den treffer. */
export function bowl(thrown: Fighter, others: Fighter[]) {
  const by = thrown.thrownBy;
  if (!by || thrown.onGround) return;
  const hit = (thrown.data.bowled as number[]) ?? [];
  for (const o of others) {
    if (o === thrown || !o.alive || o === by || o.state === 'held' || hit.includes(o.id)) continue;
    if (o.team === by.team) continue;
    if (Math.abs(o.pos.x - thrown.pos.x) < 0.95 && Math.abs(o.pos.z - thrown.pos.z) < 0.75 && thrown.pos.y < 2.2) {
      hit.push(o.id);
      applyHit(by, o, BOWL);
      W.gore.dust(o.pos, 6);
      if (hit.length === 2) W.fx.text(o.headPoint().add(new THREE.Vector3(0, 1, 0)), 'STRIKE!', 'kill big', 1.2);
      if (hit.length === 4) W.fx.text(o.headPoint().add(new THREE.Vector3(0, 1.4, 0)), 'TURKEY!', 'kill big', 1.4);
    }
  }
  thrown.data.bowled = hit;
}
