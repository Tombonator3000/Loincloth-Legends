// Nivåer, stats og butikk. Ren data og regler (ingen Three.js), så det er lett å balansere.

export type StatKey = 'str' | 'def' | 'mag' | 'agi';
export const STAT_KEYS: StatKey[] = ['str', 'def', 'mag', 'agi'];
export const STAT_NAMES: Record<StatKey, string> = { str: 'STRENGTH', def: 'DEFENCE', mag: 'MAGIC', agi: 'AGILITY' };
export const STAT_HINTS: Record<StatKey, string> = {
  str: 'HIT HARDER. +7% DAMAGE PER POINT.',
  def: 'TAKE LESS DAMAGE AND GET MORE HP.',
  mag: 'BIGGER MAGIC. START STAGES WITH POTIONS.',
  agi: 'MOVE AND SWING FASTER.',
};
export const STAT_MAX = 10;
export const LEVEL_MAX = 30;

export interface HeroProgress {
  xp: number;
  level: number;
  points: number;
  str: number;
  def: number;
  mag: number;
  agi: number;
  /** Utstyrt kjæledyr (id i PETS) eller null. */
  pet: string | null;
}

export function defaultProgress(): HeroProgress {
  return { xp: 0, level: 1, points: 0, str: 0, def: 0, mag: 0, agi: 0, pet: null };
}

/** XP som trengs fra nivå L til L+1. */
export function xpToNext(level: number) {
  return Math.round(60 * Math.pow(level, 1.5));
}

/** Legg til XP. Returnerer antall nivåer man gikk opp. */
export function addXp(p: HeroProgress, xp: number) {
  let ups = 0;
  p.xp += Math.max(0, Math.round(xp));
  while (p.level < LEVEL_MAX && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.points += p.level % 5 === 0 ? 2 : 1;
    ups++;
  }
  if (p.level >= LEVEL_MAX) p.xp = 0;
  return ups;
}

/** Hva poengene gjør i spillet. */
export function statEffects(p: HeroProgress) {
  return {
    dmgMul: 1 + 0.07 * p.str,
    dmgTaken: Math.max(0.55, 1 - 0.045 * p.def),
    hpBonus: 5 * p.def,
    magicMul: 1 + 0.12 * p.mag,
    startPotions: Math.floor(p.mag / 3),
    speedMul: 1 + 0.035 * p.agi,
    attackSpeed: 1 + 0.03 * p.agi,
  };
}

/** XP for å drepe en fiende (basert på HP). */
export function xpForFoe(hp: number, env: boolean) {
  return Math.round((hp / 3) * (env ? 1.5 : 1));
}
export const XP_BOSS = 150;
export const XP_DUEL = 90;
export const XP_STAGE_FIRST = 100;
export const XP_STAGE_REPEAT = 30;

// ---------------------------------------------------------------- butikken
export type ShopKind = 'life' | 'potions' | 'manual' | 'respec' | 'pet' | 'part';
export interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  price: number;
  desc: string;
  /** Maks antall i lager (forbruksvarer) eller kjøp totalt (manualer). */
  max?: number;
  /** Del i Hero Forge ('weapon:2') eller kjæledyr-id. */
  ref?: string;
}

export const SHOP: ShopItem[] = [
  { id: 'life', kind: 'life', name: 'EXTRA LIFE', price: 150, max: 3, desc: 'A SPARE SOUL IN A JAR. +1 LIFE NEXT STAGE.' },
  { id: 'potions', kind: 'potions', name: 'POTION POUCH', price: 120, max: 3, desc: 'START THE NEXT STAGE WITH 2 EXTRA POTIONS.' },
  { id: 'manual', kind: 'manual', name: 'MUSCLE MANUAL', price: 400, max: 5, desc: 'READ IT (LOOK AT THE PICTURES). +1 STAT POINT.' },
  { id: 'respec', kind: 'respec', name: 'FORGETTING POTION', price: 200, desc: 'RESET ALL STAT POINTS. SIDE EFFECTS: FORGETTING.' },
  { id: 'pet:eyeball', kind: 'pet', ref: 'eyeball', name: 'EYEBALL OF GREED', price: 300, desc: 'FLOATS. STARES. SUCKS UP GOLD FROM ACROSS THE SCREEN.' },
  { id: 'pet:rat', kind: 'pet', ref: 'rat', name: 'RABID RAT', price: 350, desc: 'BITES ANKLES. HAS SEVERAL DISEASES.' },
  { id: 'pet:skull', kind: 'pet', ref: 'skull', name: 'SARCASTIC SKULL', price: 450, desc: 'INSULTS ENEMIES UNTIL THEY CRY.' },
  { id: 'pet:chicken', kind: 'pet', ref: 'chicken', name: 'BATTLE CHICKEN', price: 500, desc: 'LAYS HEALING EGGS WHEN YOU ARE HURT. DO NOT ASK HOW.' },
  { id: 'pet:dragon', kind: 'pet', ref: 'dragon', name: 'TINY DRAGON', price: 600, desc: 'SMALL. ANGRY. SPITS FIREBALLS.' },
  { id: 'part:weapon:2', kind: 'part', ref: 'weapon:2', name: 'WARHAMMER', price: 500, desc: 'SKIP THE VIOLENCE, BUY THE HAMMER.' },
  { id: 'part:weapon:3', kind: 'part', ref: 'weapon:3', name: 'SPIKED CLUB', price: 500, desc: 'FAST AND EXTRA MESSY.' },
  { id: 'part:helmet:3', kind: 'part', ref: 'helmet:3', name: 'BEAST SKULL HELM', price: 350, desc: 'STILL SMELLS A BIT.' },
  { id: 'part:helmet:4', kind: 'part', ref: 'helmet:4', name: 'CROWN', price: 450, desc: 'SLIGHTLY STOLEN.' },
  { id: 'part:helmet:5', kind: 'part', ref: 'helmet:5', name: 'GREAT HELM', price: 450, desc: 'CAN\'T SEE A THING. LOOKS GREAT.' },
  { id: 'part:skin:6', kind: 'part', ref: 'skin:6', name: 'FROST BLUE SKIN', price: 250, desc: 'A TUB OF BLUE PAINT AND COMMITMENT.' },
  { id: 'part:hairColor:6', kind: 'part', ref: 'hairColor:6', name: 'WIZARD BLUE HAIR', price: 250, desc: 'VERY MAGICAL. NO ACTUAL MAGIC.' },
];
