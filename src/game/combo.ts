// Runde E (docs/PLAN_BRETT_GORR_AI.md 6.4, punkt 3 og 4): grenser for evige komboer og forsvar mot vaner.
// - Sjonglering: etter JUGGLE_LIMIT treff i lufta slås fienden hardt i bakken (SPIKED!) og blir liggende litt lenger.
//   SKY BUFFET skal fortsatt være gøy, men ikke vare evig.
// - Under en bølge spretter kropper som er slått bakover, mot kanten av bildet (høyst WALL_BOUNCES ganger), og en
//   kropp som flyr, skader fiendene den treffer.
// - Eliter (tøffe fiender og kjemper) og sjefer leser helten: fire like slag på rad, og de blokkerer en stund
//   (READ ME LIKE A BOOK). Tredje slag i komboen teller som et annet slag enn de to første, så en hel kombo leses ikke.
import * as THREE from 'three';
import type { Fighter } from './fighter';
import { P, type AttackDef } from './attacks';
import { applyHit } from './combat';
import { W } from './world';
import { audio } from '../core/audio';
import { pick } from '../core/math';

/** Treff i lufta før fienden slås i bakken. */
export const JUGGLE_LIMIT = 7;
/** Hvor mange ganger en kropp kan sprette mot kanten av bildet i én flytur. */
export const WALL_BOUNCES = 3;
/** Like slag på rad før en elite eller en sjef blokkerer, og hvor lenge mellom slagene det fortsatt teller. */
export const READ_AFTER = 4;
export const READ_WINDOW = 1.4;
/** Hvor lenge den som har lest helten, blokkerer. */
export const READ_BLOCK = 1.1;

/** En kropp som flyr inn i en annen fiende. */
export const BODY_HIT: AttackDef = {
  id: 'body', startup: 0, active: 0.1, recovery: 0, dmg: 7, reach: 1, zr: 1, height: 'mid', kd: true, launch: 4.5, push: 5, stun: 0.5,
  heavy: true, wind: P.hurt, strike: P.hurt, death: ['explode', 'normal'], swoosh: 'none', word: ['BONK!', 'HUMAN PINBALL!', 'STRIKE!'],
};
/** Kanten av bildet (litt skade når kroppen smeller i den). */
const WALL_HIT: AttackDef = { ...BODY_HIT, id: 'wall', dmg: 4, kd: true, launch: 3, push: 0, word: ['WALL BOUNCE!'] };

/** Slaget uten våpen og trinnummer: slash1@axe blir slash. */
export function attackKind(id: string) {
  return id.split('@')[0].replace(/\d+$/, '');
}

/** Sjonglering: slå fienden hardt i bakken når helten har holdt ham i lufta for lenge. */
export function spike(t: Fighter, dir: number) {
  t.vel.set(dir * 1.5, -16, 0);
  t.data.spiked = true;
  t.downT = Math.max(t.downT, 1.3);
  W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.9, 0)), pick(['SPIKED!', 'GROUNDED!', 'LANDING GEAR!']), 'kill big', 1.1);
  audio.swish(0.6, true);
}

/** Etter at en kropp har landet: et smell når den ble slått i bakken. */
export function landed(f: Fighter) {
  if (!f.data.spiked) return;
  f.data.spiked = false;
  W.gore.dust(f.pos, 20);
  W.fx.shake(0.4);
  audio.thud(1.4);
}

/**
 * Kanten av bildet under en bølge: en kropp som flyr mot kanten, spretter tilbake (litt skade, litt opp) høyst
 * WALL_BOUNCES ganger i én flytur. minX og maxX er grensene fienden holdes innenfor.
 */
export function wallBounce(f: Fighter, minX: number, maxX: number, by: Fighter | null) {
  if (f.onGround || !f.alive || f.state !== 'down') return;
  const n = (f.data.bounces as number) ?? 0;
  if (n >= WALL_BOUNCES) return;
  const left = f.pos.x <= minX + 0.02 && f.vel.x < -3;
  const right = f.pos.x >= maxX - 0.02 && f.vel.x > 3;
  if (!left && !right) return;
  f.data.bounces = n + 1;
  const vx = f.vel.x, vy = f.vel.y;
  // Litt skade fra kanten først (slaget slår ham ned og nullstiller farten), så spretter han tilbake
  if (by) applyHit(by, f, WALL_HIT, WALL_HIT.dmg);
  if (!f.alive) return;
  f.vel.x = -vx * 0.55;
  f.vel.y = Math.max(vy, 3.5);
  f.onGround = false;
  W.gore.dust(new THREE.Vector3(f.pos.x + (left ? -0.3 : 0.3), f.pos.y + 0.6, f.pos.z), 10);
  W.fx.shake(0.25);
  audio.thud(1);
  if (n === 0) W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), 'WALL BOUNCE!', 'word', 0.9);
}

/**
 * En kropp som er slått avgårde (ikke kastet, det tar bowl i grab.ts), og som flyr fort, skader fiendene den treffer.
 * Hver fiende høyst én gang per flytur.
 */
export function bodyHits(f: Fighter, others: Fighter[]) {
  const by = f.lastHitBy;
  if (!by || by.team !== 'hero' || f.thrownBy || f.onGround || f.state !== 'down' || Math.abs(f.vel.x) < 5) return;
  const hit = (f.data.bodyHit as number[]) ?? [];
  for (const o of others) {
    if (o === f || !o.alive || o.team === by.team || o.state === 'held' || hit.includes(o.id) || o.illusion) continue;
    if (Math.abs(o.pos.x - f.pos.x) < 0.9 && Math.abs(o.pos.z - f.pos.z) < 0.7 && f.pos.y < 2) {
      hit.push(o.id);
      applyHit(by, o, BODY_HIT);
      W.gore.dust(o.pos, 6);
    }
  }
  f.data.bodyHit = hit;
}

/** Nullstill tellerne for en flytur når kroppen er nede igjen. */
export function grounded(f: Fighter) {
  if (f.data.bounces) f.data.bounces = 0;
  if ((f.data.bodyHit as number[] | undefined)?.length) f.data.bodyHit = [];
}

/**
 * Eliter og sjefer som leser helten: like slag på rad fra samme helt. Når de har sett READ_AFTER like slag med under
 * READ_WINDOW sekunder mellom, svarer hit() true, og målet skal blokkere.
 */
export class HabitReader {
  private seen = new Map<Fighter, { hero: Fighter; kind: string; n: number; t: number }>();

  hit(hero: Fighter, t: Fighter, atkId: string, now: number) {
    const kind = attackKind(atkId);
    const s = this.seen.get(t);
    if (s && s.hero === hero && s.kind === kind && now - s.t < READ_WINDOW) {
      s.n++;
      s.t = now;
    } else this.seen.set(t, { hero, kind, n: 1, t: now });
    const cur = this.seen.get(t)!;
    if (cur.n >= READ_AFTER) {
      this.seen.delete(t);
      return true;
    }
    return false;
  }

  forget(t: Fighter) {
    this.seen.delete(t);
  }
}

/** Det de sier når de har lest helten. */
export const READ_BARKS = ['READ YOU LIKE A BOOK!', 'TOO PREDICTABLE!', 'SAME MOVE? REALLY?', 'I HAVE SEEN THIS ONE!'];
