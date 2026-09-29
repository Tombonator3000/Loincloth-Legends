// Treffsjekk og skade. Brukes av både brettet og duellen.
import * as THREE from 'three';
import { bloodOf, type Fighter } from './fighter';
import type { AttackDef } from './attacks';
import { W } from './world';
import { audio } from '../core/audio';
import { pick, rand, chance } from '../core/math';
import { settings } from '../core/settings';
import { screenFX } from '../gfx/screenfx';

export interface HitResult {
  blocked: boolean;
  killed: boolean;
  dmg: number;
  guardBreak: boolean;
  decap: boolean;
}

export interface HitOpts {
  pvp?: boolean;
  onHit?: (att: Fighter, tgt: Fighter, res: HitResult) => void;
}

const tmp = new THREE.Vector3();

export function canHit(att: Fighter, tgt: Fighter, a: AttackDef, pvp = false) {
  if (tgt === att || !tgt.alive || tgt.invuln > 0) return false;
  if (!pvp && tgt.team === att.team) return false;
  const dx = (tgt.pos.x - att.pos.x) * att.facing;
  const reach = a.reach * (0.85 + 0.15 * att.size / 0.9);
  if (dx < -(a.back ?? 0.35) || dx > reach) return false;
  if (Math.abs(tgt.pos.z - att.pos.z) > a.zr) return false;
  const dy = tgt.pos.y - att.pos.y;
  if (dy > 1.5 || dy < -1.6) return false;
  if (tgt.state === 'down' && tgt.onGround) return false;
  if (tgt.state === 'getup') return false;
  if (tgt.state === 'roll' && a.height !== 'low') return false;
  // Lave slag bommer på hoppende mål, høye slag bommer på duckende mål
  if (a.height === 'low' && tgt.pos.y > 0.5) return false;
  if (a.height === 'high' && (tgt.state === 'crouch' || (tgt.state === 'block' && tgt.blocking === 'low')) && pvp) return false;
  return true;
}

export function resolveAttack(att: Fighter, targets: Fighter[], opts: HitOpts = {}) {
  const a = att.atk;
  if (!a || att.phase() !== 'active' || a.projectile) return;
  const hits = a.hits ?? 1;
  const tIn = att.st - a.startup;
  const idx = Math.min(hits - 1, Math.floor(tIn / (a.active / hits)));
  for (const t of targets) {
    if (!canHit(att, t, a, opts.pvp)) continue;
    const done = att.hitsDone.get(t.id) ?? -1;
    if (done >= idx) continue;
    att.hitsDone.set(t.id, idx);
    const res = applyHit(att, t, a, undefined, opts.pvp);
    opts.onHit?.(att, t, res);
  }
}

function blockCovers(b: 'none' | 'high' | 'low', h: AttackDef['height']) {
  if (b === 'high') return h === 'high' || h === 'mid';
  if (b === 'low') return h === 'low' || h === 'mid';
  return false;
}

/** Sjanse for at et treff kutter av en arm (uten å drepe). */
function severChance(tgt: Fighter, a: AttackDef, dmg: number, pvp: boolean) {
  if (tgt.noSever || tgt.def.blood === 'lava' || !tgt.alive) return 0;
  if (tgt.rig.detached.has('armF')) return 0;
  const heavy = !!a.heavy || dmg >= 14;
  let p: number;
  if (pvp) {
    const low = tgt.hp < tgt.maxHp * 0.6;
    p = heavy ? (low ? 0.32 : 0.14) : low ? 0.08 : 0.03;
  } else if (tgt.team === 'hero') {
    // Heltene mister bare bakarmen på brettene (våpenarmen trengs)
    if (tgt.rig.detached.has('armB')) return 0;
    p = heavy ? 0.07 : 0;
  } else {
    p = heavy ? 0.2 : 0.045;
  }
  return p * [0.8, 0.7, 1, 1.4][settings.gore];
}

export function applyHit(att: Fighter, tgt: Fighter, a: AttackDef, dmgOverride?: number, pvp = false): HitResult {
  const dir = Math.sign(tgt.pos.x - att.pos.x) || att.facing;
  const res: HitResult = { blocked: false, killed: false, dmg: 0, guardBreak: false, decap: false };
  const contact = tgt.torsoPoint(a.height === 'low' ? -0.3 : a.height === 'high' ? 0.75 : 0.45, tmp);
  contact.x -= dir * 0.15 * tgt.size;
  const facingAtt = Math.sign(att.pos.x - tgt.pos.x) === tgt.facing;
  const blocking = (tgt.state === 'block' || tgt.state === 'blockstun') && facingAtt;
  const col = bloodOf(tgt.def);

  // Blokk
  if (blocking && !a.guardBreak && blockCovers(tgt.blocking, a.height)) {
    res.blocked = true;
    W.gore.sparks(contact, 12);
    audio.clang();
    tgt.setState('blockstun');
    tgt.stunT = 0.18;
    tgt.vel.x = dir * a.push * 0.8;
    att.vel.x = -dir * 1.2;
    W.fx.stop(0.05);
    W.fx.shake(0.12);
    return res;
  }
  if (blocking && a.guardBreak) {
    res.guardBreak = true;
    tgt.setState('stunned');
    tgt.stunT = 0.85;
    tgt.vel.x = dir * a.push;
    W.fx.text(tgt.headPoint().add(new THREE.Vector3(0, 0.7, 0)), 'GUARD BROKEN!', 'word');
    audio.hit(true);
    W.fx.stop(0.07);
    W.fx.shake(0.25);
    tgt.flash(0.12);
    return res;
  }

  let dmg = (dmgOverride ?? a.dmg * att.dmgMul) * tgt.dmgTaken;
  if (a.decap && tgt.pos.y < 1.2) {
    dmg = tgt.hp + 999;
    res.decap = true;
  }
  res.dmg = dmg;
  tgt.hp -= dmg;
  const bigHit = !!a.heavy || dmg >= 14;
  if (tgt.player >= 0) {
    W.rumble(tgt.player, bigHit ? 0.9 : 0.45, 0.6, bigHit ? 240 : 120);
    // Blod på glasset fra siden slaget kom fra, mer jo hardere (gfx/screenwet.ts)
    if (tgt.def.blood !== 'bone') W.fx.heroHit(Math.min(1.6, Math.max(0.35, (dmg / Math.max(10, tgt.maxHp)) * 3)), -dir);
  }
  if (att.player >= 0) W.rumble(att.player, bigHit ? 0.35 : 0.1, bigHit ? 0.5 : 0.25, 70);
  tgt.lastHitBy = att;
  tgt.flash(0.1);

  const heavy = !!a.heavy || dmg >= 14;
  if (tgt.def.blood === 'bone') {
    W.gore.dust(contact, 3, '#e8e0c8');
    W.gore.gibs(contact, chance(0.4) ? 1 : 0, 'bone', 0.6);
    audio.bones();
  } else {
    W.gore.spray(contact, dir, 0.35, Math.round(10 + dmg * 1.6), 5 + dmg * 0.15, 0.55, 0.09, col);
    W.gore.splat(tgt.pos.x + dir * rand(0.3, 1.2), tgt.pos.z + rand(-0.4, 0.4), rand(0.3, 0.7), col);
    audio.splat(0.5 + dmg * 0.03);
  }
  audio.hit(heavy);

  if (tgt.hp <= 0) {
    res.killed = true;
    let style = res.decap ? 'decap' : pick(a.death);
    if (!res.decap && tgt.hp < -18 && chance(0.4)) style = 'explode';
    tgt.die(style, dir, att);
    W.fx.stop(0.1);
    W.fx.shake(0.45);
    // Tunge drap sender en liten sjokkbølge og et zoomslag gjennom bildet
    if (heavy) {
      screenFX.shock(contact, 0.45, 0.55, 1.4);
      screenFX.punch(contact, 0.3);
    }
    return res;
  }

  W.fx.stop(heavy ? 0.09 : 0.045);
  W.fx.shake(heavy ? 0.32 : 0.14);
  if (heavy) screenFX.shock(contact, 0.25, 0.45, 1.5);
  if (chance(severChance(tgt, a, dmg, pvp)) && tgt.loseArm(dir)) {
    W.fx.stop(0.12);
  } else if (heavy && a.word) W.fx.text(contact.clone().add(new THREE.Vector3(0, 0.9, 0)), pick(a.word), 'word');

  // Holdt fast: skaden tas, men han blir hengende i grepet
  if (tgt.state === 'held') return res;
  const armored = (tgt.atk?.armor && tgt.phase() === 'wind') || tgt.armored;
  if (armored) {
    tgt.onArmorHit?.(dmg, att);
    return res;
  }
  if (!tgt.onGround || a.kd) {
    tgt.knockdown(dir * a.push, a.launch ?? (tgt.onGround ? 5 : 4.5));
  } else {
    tgt.hurt(a.stun, dir * a.push);
  }
  return res;
}
