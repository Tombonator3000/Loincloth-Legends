// Klassene i Hero Forge (Tom 2026-10-01): en parodi på de gamle rollespillene fra 80-tallet, uten navn eller monstre
// som tilhører noen. Klassen bestemmer våpen, hvilken magi helten kan velge og egenskapene. Utseendet er fritt.
// Rekkefølgen er HeroConfig.cls, så nye klasser legges til bakerst. Ingen Three.js her.
import { WEAPONS, type WeaponStats } from './weapons';
import type { SpellId } from './spells';

export type ClassId = 'fighter' | 'cleric' | 'thief' | 'mage' | 'elf' | 'dwarf' | 'bard';
/** Klassens eget utstyr, tegnet i koden (gfx/classfx.ts). Det erstatter det malte våpenet. */
export type GearId = 'mace' | 'daggers' | 'staff' | 'bow' | 'lute';

export interface ClassDef {
  id: ClassId;
  /** Navnet på CLASS-raden. */
  label: string;
  /** Én linje i infoboksen. */
  desc: string;
  /** En replikk til, når klassen velges (ELF IS A CLASS. DO NOT ASK.). */
  quip?: string;
  /** Vanlige våpen klassen kan bruke (indekser i WEAPONS). Tom liste: bare klassens eget utstyr (gear). */
  weapons: number[];
  gear?: GearId;
  /** Magien klassen kan velge. Den første er den klassen får. */
  spells: SpellId[];
  /** Ganges med liv, fart, skade og magi. potions er ekstra krukker ved start, metal ganges med METAL-måleren. */
  hp: number;
  speed: number;
  dmg: number;
  magic: number;
  potions: number;
  metal: number;
  /** Tyven: skade bakfra ganges med dette, og sjansen for å stjele en mynt ved hvert treff. */
  backstab?: number;
  steal?: number;
  /** Presten: liv per sekund til de andre heltene som står nær (co-op). */
  heal?: number;
  /** Alven: skyter piler langs linja i stedet for å slå. */
  ranged?: boolean;
  /** Kroppsformen: bredde og høyde (dvergen er lav og bred, alven slank). */
  stretch?: [number, number];
}

export const CLASSES: ClassDef[] = [
  {
    id: 'fighter', label: 'FIGHTER', desc: 'Hits things. Has done so since birth. Any weapon, the old magic.',
    weapons: [0, 1, 2, 3], spells: ['meteor', 'scream', 'thunder'], hp: 1, speed: 1, dmg: 1, magic: 1, potions: 0, metal: 1,
  },
  {
    id: 'cleric', label: 'CLERIC', desc: 'Blunt weapons only, for religious reasons. Heals a partner standing close. Turns undead.',
    weapons: [], gear: 'mace', spells: ['turn', 'thunder'], hp: 1.05, speed: 0.97, dmg: 0.95, magic: 1.15, potions: 1, metal: 1, heal: 3,
  },
  {
    id: 'thief', label: 'THIEF', desc: 'Two daggers. Fast. Triple damage from behind. Steals gold from everyone, mostly enemies.',
    weapons: [], gear: 'daggers', spells: ['grease', 'chicken'], hp: 0.85, speed: 1.12, dmg: 1, magic: 1, potions: 0, metal: 1, backstab: 3, steal: 0.3,
  },
  {
    id: 'mage', label: 'MAGIC-USER', desc: 'A staff and weak arms. Starts with potions. Magic hits much harder.',
    weapons: [], gear: 'staff', spells: ['missile', 'chicken', 'meteor', 'grease'], hp: 0.8, speed: 1, dmg: 0.85, magic: 1.6, potions: 3, metal: 1,
  },
  {
    id: 'elf', label: 'ELF', desc: 'Shoots arrows along the line. Fragile. Knows a little magic.', quip: 'ELF IS A CLASS. DO NOT ASK.',
    weapons: [], gear: 'bow', spells: ['missile', 'chicken', 'thunder'], hp: 0.75, speed: 1.08, dmg: 1, magic: 1.25, potions: 1, metal: 1, ranged: true, stretch: [0.94, 1.05],
  },
  {
    id: 'dwarf', label: 'DWARF', desc: 'Short, wide and very hard to kill. Slow. Axes and hammers.',
    weapons: [1, 2], spells: ['scream', 'thunder'], hp: 1.5, speed: 0.82, dmg: 1.1, magic: 0.9, potions: 0, metal: 1, stretch: [1.18, 0.8],
  },
  {
    id: 'bard', label: 'BARD', desc: 'Hits people with a lute. The METAL meter fills twice as fast.',
    weapons: [], gear: 'lute', spells: ['scream', 'chicken'], hp: 0.95, speed: 1.02, dmg: 0.9, magic: 1, potions: 0, metal: 2,
  },
];

/** Klassens eget utstyr som våpen (skade, fart, rekkevidde og tilbakeslag), som WEAPONS. */
export const GEAR: Record<GearId, WeaponStats> = {
  mace: { id: 'mace', name: 'HOLY MACE', dmg: 1.12, speed: 0.95, reach: 0.92, push: 1.25, desc: 'BLUNT. NO BLOOD WAS SHED. TECHNICALLY.' },
  daggers: { id: 'daggers', name: 'TWIN DAGGERS', dmg: 0.72, speed: 1.45, reach: 0.74, push: 0.6, desc: 'STAB FAST. STAB OFTEN. STAB FROM BEHIND.' },
  staff: { id: 'staff', name: 'QUARTERSTAFF', dmg: 0.62, speed: 1.0, reach: 1.15, push: 1.1, desc: 'A STICK WITH OPINIONS.' },
  bow: { id: 'bow', name: 'LONGBOW', dmg: 0.9, speed: 1.1, reach: 0.8, push: 0.8, desc: 'POINTY STICKS, DELIVERED.' },
  lute: { id: 'lute', name: 'BATTLE LUTE', dmg: 0.9, speed: 1.05, reach: 0.95, push: 1.4, desc: 'MOSTLY OUT OF TUNE. ENTIRELY OUT OF PATIENCE.' },
};

export function classAt(i: number | undefined): ClassDef {
  return CLASSES[i ?? 0] ?? CLASSES[0];
}

export function classIndex(id: ClassId) {
  return Math.max(0, CLASSES.findIndex((c) => c.id === id));
}

/** Våpenet helten slåss med: klassens eget utstyr, ellers det valgte våpenet. */
export function heroWeapon(cfg: { cls?: number; weapon: number }): WeaponStats {
  const c = classAt(cfg.cls);
  return c.gear ? GEAR[c.gear] : WEAPONS[cfg.weapon] ?? WEAPONS[0];
}

// ---------------------------------------------------------------- ROLL 3D6
export const ABILITIES = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'] as const;

/** Tre seksere per evne, som i 1974. */
export function roll3d6(rand: () => number = Math.random): number[] {
  return ABILITIES.map(() => 3 + Math.floor(rand() * 6) + Math.floor(rand() * 6) + Math.floor(rand() * 6));
}

/** Tillegget fra en evne: 3 gir -3, 4-5 -2, 6-8 -1, 9-12 0, 13-15 +1, 16-17 +2, 18 +3. */
export function abilityMod(v: number): number {
  return v <= 3 ? -3 : v <= 5 ? -2 : v <= 8 ? -1 : v <= 12 ? 0 : v <= 15 ? 1 : v <= 17 ? 2 : 3;
}

/** Hvor mye ett poeng tillegg gir (STR skade, DEX fart, CON liv, INT magi). WIS og CHA gjør ingenting, som før. */
export const ABILITY_STEP = 0.04;

/** Det terningene gir: ganges med skade, fart, liv og magi. Uten kast er alt 1. */
export function abilityEffects(ab: number[] | undefined) {
  const m = (i: number) => (ab ? 1 + ABILITY_STEP * abilityMod(ab[i]) : 1);
  return { dmg: m(0), magic: m(1), speed: m(3), hp: m(4) };
}

/** Er dette et gyldig kast (seks tall fra 3 til 18)? */
export function validAbilities(v: unknown): number[] | undefined {
  if (!Array.isArray(v) || v.length !== ABILITIES.length) return undefined;
  return v.every((x) => Number.isInteger(x) && x >= 3 && x <= 18) ? [...v] : undefined;
}

/** Spillederen, som har sett alt før. */
export const GM_LINES = {
  /** Kastet i Hero Forge: dårlig, vanlig, bra, og et nytt kast for mye. */
  bad: ['THE GAME MASTER SIGHS.', 'THE GAME MASTER SUGGESTS A CAREER IN FARMING.', 'THE GAME MASTER HAS SEEN WORSE. NOT RECENTLY.'],
  meh: ['THE GAME MASTER NODS.', 'THE GAME MASTER WRITES SOMETHING DOWN.', 'PERFECTLY ADEQUATE. THE GAME MASTER YAWNS.'],
  good: ['THE GAME MASTER SAW THAT.', 'AN 18? THE GAME MASTER WANTS TO SEE THE DICE.', 'THE GAME MASTER DOES NOT BELIEVE YOU.'],
  reroll: ['REROLLING AGAIN? THE GAME MASTER SIGHS.', 'THE GAME MASTER IS KEEPING COUNT.', 'THE GAME MASTER ORDERS ANOTHER PIZZA.'],
  /** På brettet: en naturlig tjuer og en kritisk tabbe. */
  nat20: ['FINE. IT DIES.', 'I WILL ALLOW IT.', 'DESCRIBE HOW YOU DO IT. ACTUALLY, DO NOT.'],
  fumble: ['*SIGH*', 'YOU HIT YOURSELF. ROLL FOR DAMAGE.', 'YOUR WEAPON SLIPS. EVERYONE SAW.', 'THE DICE HAVE SPOKEN. THEY LAUGHED.'],
};
