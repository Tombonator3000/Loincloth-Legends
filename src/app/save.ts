// Lagring av fremgang i localStorage. Alt er pakket i try/catch, så spillet virker også uten lagring.
import { PRESETS, HERO_OPTIONS, cloneHero, heroKey, withHeroParts, type HeroConfig } from '../gfx/chars/hero';
import { HERO_PART_SLOTS, defaultHeroParts, findHeroPart, sanitizeHeroParts } from '../data/hero-parts';
import { PART_LOCKS } from '../data/unlocks';
import { defaultProgress, STAT_KEYS, STAT_MAX, LEVEL_MAX, type HeroProgress } from '../data/progress';
import { PETS } from '../data/pets';

export interface SaveData {
  v: 1;
  /** Skiller gamle presets fra nye, uttrykkelige CLASSIC-valg uten parts. */
  heroPartsVersion: 1;
  heroes: HeroConfig[];
  heroMade: boolean[];
  completed: string[];
  unlocked: string[];
  gold: number;
  node: string;
  intro: boolean;
  /** Nivå, XP, stats og kjæledyr per helt (samme indeks som heroes). */
  progress: HeroProgress[];
  /** Kjæledyr som er kjøpt. */
  pets: string[];
  /** Forbruksvarer til neste brett. */
  supplies: { lives: number; potions: number };
  /** Antall muskelmanualer kjøpt (maks i SHOP). */
  manuals: number;
}

const KEY = 'loincloth-legends-save-v1';

export function defaultSave(): SaveData {
  return {
    v: 1, heroPartsVersion: 1, heroes: [cloneHero(PRESETS.thrugg), cloneHero(PRESETS.valkyra)], heroMade: [false, false], completed: [], unlocked: [], gold: 0, node: 'home', intro: false,
    progress: [defaultProgress(), defaultProgress()], pets: [], supplies: { lives: 0, potions: 0 }, manuals: 0,
  };
}

function validProgress(p: unknown): HeroProgress {
  const out = defaultProgress();
  if (!p || typeof p !== 'object') return out;
  const o = p as Record<string, unknown>;
  const int = (v: unknown, max: number) => (typeof v === 'number' && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
  out.level = Math.max(1, int(o.level, LEVEL_MAX));
  out.xp = int(o.xp, 1e7);
  out.points = int(o.points, 200);
  for (const k of STAT_KEYS) out[k] = int(o[k], STAT_MAX);
  out.pet = typeof o.pet === 'string' && PETS[o.pet] ? o.pet : null;
  return out;
}

function validHero(h: unknown, fallback: HeroConfig, unlocked: string[], migrateLegacy: boolean): HeroConfig {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return cloneHero(fallback);
  const o = h as Record<string, unknown>;
  const out = cloneHero(fallback);
  // Ikke gi gamle, egendefinerte helter preset-deler bare fordi fallback har dem.
  delete out.parts;
  if (typeof o.name === 'string') out.name = o.name.slice(0, 24).toUpperCase();
  for (const k of Object.keys(HERO_OPTIONS) as (keyof typeof HERO_OPTIONS)[]) {
    const v = o[k];
    if (typeof v === 'number' && v >= 0 && v < HERO_OPTIONS[k].length) out[k] = Math.floor(v);
  }
  if (o.parts !== undefined) {
    const parts = sanitizeHeroParts(o.parts, out.body);
    const defaults = defaultHeroParts(findHeroPart('torso', parts.torso)?.body ?? out.body);
    for (const slot of HERO_PART_SLOTS) {
      const unlock = findHeroPart(slot, parts[slot])?.unlock;
      if (unlock && PART_LOCKS[unlock] && !unlocked.includes(unlock)) parts[slot] = defaults[slot];
    }
    return withHeroParts(out, parts);
  }
  // Bare gamle figurer som allerede brukte preset-grafikk migreres til malte deler.
  if (migrateLegacy) {
    const preset = Object.values(PRESETS).find((p) => heroKey({ ...p, parts: undefined }) === heroKey(out));
    if (preset?.parts) return withHeroParts(out, preset.parts);
  }
  return out;
}

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Partial<SaveData>;
    const unlocked = Array.isArray(o.unlocked) ? o.unlocked.filter((x) => typeof x === 'string') : [];
    const migrateLegacy = o.heroPartsVersion === undefined;
    return {
      v: 1,
      heroPartsVersion: 1,
      heroes: [validHero(o.heroes?.[0], d.heroes[0], unlocked, migrateLegacy), validHero(o.heroes?.[1], d.heroes[1], unlocked, migrateLegacy)],
      heroMade: [!!o.heroMade?.[0], !!o.heroMade?.[1]],
      completed: Array.isArray(o.completed) ? o.completed.filter((x) => typeof x === 'string') : [],
      unlocked,
      gold: typeof o.gold === 'number' ? o.gold : 0,
      node: typeof o.node === 'string' ? o.node : 'home',
      intro: !!o.intro,
      progress: [validProgress(o.progress?.[0]), validProgress(o.progress?.[1])],
      pets: Array.isArray(o.pets) ? o.pets.filter((x) => typeof x === 'string' && PETS[x]) : [],
      supplies: {
        lives: Math.max(0, Math.min(3, Math.floor(Number(o.supplies?.lives) || 0))),
        potions: Math.max(0, Math.min(3, Math.floor(Number(o.supplies?.potions) || 0))),
      },
      manuals: Math.max(0, Math.min(5, Math.floor(Number(o.manuals) || 0))),
    };
  } catch {
    return d;
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, heroPartsVersion: 1 }));
  } catch {
    /* lagring er valgfritt */
  }
}

export function isUnlocked(s: SaveData, key: string) {
  return !PART_LOCKS[key] || s.unlocked.includes(key);
}
