// Innstillinger som lagres lokalt: gore-nivå, lydnivå, risting, rumble og berøringskontroller.
// Ingen Three.js her, så modulen kan brukes fra både core, gfx og app.

export type GoreLevel = 0 | 1 | 2 | 3;
export const GORE_NAMES = ['FAMILY', 'NORMAL', 'EXCESSIVE', 'PLEASE SEEK HELP'] as const;
export const GORE_HINTS = [
  'CONFETTI AND RUBBER DUCKS. NOBODY IS HURT. EVERYBODY IS HURT.',
  'SOME BLOOD. LIKE A MEDIUM STEAK.',
  'THE WAY THE BARBARIAN GODS INTENDED.',
  'THE JANITOR HAS QUIT. TWICE.',
] as const;

export type TouchMode = 'auto' | 'on' | 'off';

export interface Settings {
  gore: GoreLevel;
  music: number;
  sfx: number;
  shake: boolean;
  rumble: boolean;
  touch: TouchMode;
}

const KEY = 'loincloth-legends-settings-v1';

export function defaultSettings(): Settings {
  return { gore: 2, music: 0.7, sfx: 0.9, shake: true, rumble: true, touch: 'auto' };
}

function load(): Settings {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Partial<Settings>;
    const num = (v: unknown, def: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : def);
    return {
      gore: typeof o.gore === 'number' && o.gore >= 0 && o.gore <= 3 ? (Math.floor(o.gore) as GoreLevel) : d.gore,
      music: num(o.music, d.music),
      sfx: num(o.sfx, d.sfx),
      shake: typeof o.shake === 'boolean' ? o.shake : d.shake,
      rumble: typeof o.rumble === 'boolean' ? o.rumble : d.rumble,
      touch: o.touch === 'on' || o.touch === 'off' || o.touch === 'auto' ? o.touch : d.touch,
    };
  } catch {
    return d;
  }
}

type Listener = (s: Settings) => void;
const listeners: Listener[] = [];

/** Gjeldende innstillinger. Endre med `setSettings` så lyttere og lagring oppdateres. */
export const settings: Settings = load();

export function setSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* lagring er valgfritt */
  }
  for (const l of listeners) l(settings);
}

export function onSettings(l: Listener) {
  listeners.push(l);
  l(settings);
}

/** Mengdefaktor for partikler og gibs per gore-nivå. */
export function goreMul(level = settings.gore) {
  return [0.7, 0.5, 1, 1.8][level];
}

/** Gjett om enheten primært er berøringsskjerm. */
export function isTouchDevice() {
  try {
    return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints ?? 0) > 1 && !matchMedia('(pointer: fine)').matches;
  } catch {
    return false;
  }
}

export function touchEnabled() {
  return settings.touch === 'on' || (settings.touch === 'auto' && isTouchDevice());
}
