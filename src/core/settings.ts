// Innstillinger som lagres lokalt: gore-nivå, lydnivå, innspilte lyder, risting, blink, forvrengning, rumble,
// berøringskontroller og grafikknivå.
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
/** Grafikknivå. AUTO velger ut fra enheten (se gfx/post.ts). */
export type QualitySetting = 'auto' | 'low' | 'medium' | 'high' | 'ultra';
export const QUALITY_SETTINGS: QualitySetting[] = ['auto', 'low', 'medium', 'high', 'ultra'];
export const QUALITY_HINTS: Record<QualitySetting, string> = {
  auto: 'PICKS A LEVEL FOR THIS DEVICE AND STEPS DOWN IF IT STUTTERS',
  low: 'NO POST EFFECTS. FOR POTATOES.',
  medium: 'BLOOM, GRADING, SHADOWS',
  high: 'ADDS DEPTH OF FIELD AND SHARPER SHADOWS',
  ultra: 'EVERYTHING. BRING A FAN.',
};

/** Nivået AUTO har gått ned til fordi bildet hakket ('' = gjett ut fra enheten). */
export type AutoQuality = '' | 'low' | 'medium' | 'high';
const AUTO_LEVELS: AutoQuality[] = ['', 'low', 'medium', 'high'];

export type MusicStyleSetting = 'metal' | 'chip';

export interface Settings {
  gore: GoreLevel;
  music: number;
  /** Heavy metal (standard) eller de gamle 8-bit-låtene. */
  musicStyle: MusicStyleSetting;
  sfx: number;
  /** Innspilte lyder (CC0) oppå synthen (core/soundbank.ts). Av = bare synth. */
  recorded: boolean;
  shake: boolean;
  /** Hvite blink og lynglimt på skjermen (av for dem som tåler blinking dårlig). */
  flashes: boolean;
  /** Forvrengning av bildet: sjokkbølger, zoom, kameradykk og varmeflimmer. */
  distortion: boolean;
  rumble: boolean;
  touch: TouchMode;
  quality: QualitySetting;
  /** Hvor langt AUTO har trappet ned (se app/perf.ts). Nullstilles når spilleren velger nivå selv. */
  autoQuality: AutoQuality;
}

const KEY = 'loincloth-legends-settings-v1';

export function defaultSettings(): Settings {
  return { gore: 2, music: 0.7, musicStyle: 'metal', sfx: 0.9, recorded: true, shake: true, flashes: true, distortion: true, rumble: true, touch: 'auto', quality: 'auto', autoQuality: '' };
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
      musicStyle: o.musicStyle === 'chip' || o.musicStyle === 'metal' ? o.musicStyle : d.musicStyle,
      sfx: num(o.sfx, d.sfx),
      recorded: typeof o.recorded === 'boolean' ? o.recorded : d.recorded,
      shake: typeof o.shake === 'boolean' ? o.shake : d.shake,
      flashes: typeof o.flashes === 'boolean' ? o.flashes : d.flashes,
      distortion: typeof o.distortion === 'boolean' ? o.distortion : d.distortion,
      rumble: typeof o.rumble === 'boolean' ? o.rumble : d.rumble,
      touch: o.touch === 'on' || o.touch === 'off' || o.touch === 'auto' ? o.touch : d.touch,
      quality: QUALITY_SETTINGS.includes(o.quality as QualitySetting) ? (o.quality as QualitySetting) : d.quality,
      autoQuality: AUTO_LEVELS.includes(o.autoQuality as AutoQuality) ? (o.autoQuality as AutoQuality) : d.autoQuality,
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
