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

/** Kan denne figuren gripes? Sjefer, ridende og store beist er for tunge. */
export function grabbable(f: Fighter) {
  return f.alive && f.onGround && !f.armored && !f.mount && !f.noSever && f.size <= 1.3 && f.state !== 'down' && f.state !== 'getup' && f.state !== 'held' && f.state !== 'dead';
}

/** Finn nærmeste fiende foran som kan gripes. */
export function findGrab(h: Fighter, foes: Fighter[], reach = GRAB_REACH, zr = 0.6) {
  let best: Fighter | null = null;
  let bd = 1e9;
  let heavy: Fighter | null = null;
  for (const f of foes) {
    if (!f.alive || f === h) continue;
    const dx = (f.pos.x - h.pos.x) * h.facing;
    const dz = Math.abs(f.pos.z - h.pos.z);
    if (dx < -0.2 || dx > reach || dz > zr) continue;
    if (!grabbable(f)) {
      if (f.state !== 'down' && f.state !== 'dead') heavy = f;
      continue;
    }
    const d = Math.abs(dx) + dz;
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return { target: best, tooHeavy: heavy };
}

export function startHold(h: Fighter, t: Fighter) {
  h.setState('hold');
  h.holding = t;
  h.atk = null;
  h.data.holdT = 0;
  h.data.pummels = 0;
  h.data.pummelT = 0;
  t.setState('held');
  t.heldBy = h;
  t.atk = null;
  t.vel.set(0, 0, 0);
  h.face(t.pos.x - h.pos.x || h.facing);
  audio.grunt(h.def.voice);
  audio.hit();
  W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['GOTCHA!', 'COME HERE!', 'HUG TIME!']), 'word', 0.8);
}

export function pummel(h: Fighter) {
  const t = h.holding;
  if (!t) return;
  h.data.pummelT = 0.16;
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
  h.data.pummelT = Math.max(0, ((h.data.pummelT as number) ?? 0) - dt);
  if ((h.data.holdT as number) > 2.8) {
    // Han vrir seg løs
    h.setState('idle');
    t.hurt(0.2, h.facing * 3);
    W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(['SLIPPERY!', 'NOT TODAY!', 'I\'M OILED!']), 'speech', 1.2);
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
