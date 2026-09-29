// Våpen i heltebyggeren. Påvirker skade, fart, rekkevidde og tilbakeslag.
import type { AttackDef } from '../game/attacks';

export interface WeaponStats { id: string; name: string; dmg: number; speed: number; reach: number; push: number; desc: string }

export const WEAPONS: WeaponStats[] = [
  { id: 'sword', name: 'SWORD', dmg: 1, speed: 1, reach: 1, push: 1, desc: 'BALANCED. POINTY END GOES IN THE OTHER GUY.' },
  { id: 'axe', name: 'AXE', dmg: 1.18, speed: 0.92, reach: 0.97, push: 1.1, desc: 'HEAVIER HITS, A BIT SLOWER.' },
  { id: 'hammer', name: 'WARHAMMER', dmg: 1.4, speed: 0.8, reach: 0.95, push: 1.5, desc: 'SLOW, RUDE, SENDS THEM FLYING.' },
  { id: 'club', name: 'SPIKED CLUB', dmg: 1.08, speed: 1.08, reach: 0.9, push: 1.0, desc: 'FAST AND EXTRA MESSY.' },
];

const cache = new Map<string, AttackDef>();
/** Lag en kopi av et angrep tilpasset våpenet (bufret). */
export function scaleAttack(a: AttackDef, w: WeaponStats | undefined): AttackDef {
  if (!w || w.id === 'sword') return a;
  const k = a.id + '@' + w.id;
  let s = cache.get(k);
  if (!s) {
    s = { ...a, id: k, startup: a.startup / w.speed, recovery: a.recovery / w.speed, dmg: a.dmg * w.dmg, reach: a.reach * w.reach, push: a.push * w.push };
    cache.set(k, s);
  }
  return s;
}
