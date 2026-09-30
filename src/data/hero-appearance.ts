// Uavhengige lag og farger til malte helter. Ressursene lastes av grafikkmodulen.
export const HERO_APPEARANCE_KEYS = ['hair', 'beard', 'headgear', 'skinTone', 'eyeColor', 'hairColor', 'eyeStyle'] as const;
export type HeroAppearanceKey = typeof HERO_APPEARANCE_KEYS[number];
export type HeroAppearance = Record<HeroAppearanceKey, string>;

export interface HeroAppearanceOption {
  id: string;
  label: string;
  /** Ressurs-ID i manifestets utseendelag. NONE trenger ingen bildefil. */
  asset?: string;
  /** Langt hår har et eget lag bak hodet og overkroppen. */
  backAsset?: string;
  /** ORIGINAL beholder fargen i bildet og har ingen color. */
  color?: string;
  /** Eksisterende opplåsingsnøkkel fra PART_LOCKS. */
  unlock?: string;
}

export const HERO_APPEARANCE: Record<HeroAppearanceKey, HeroAppearanceOption[]> = {
  hair: [
    { id: 'none', label: 'NONE' },
    { id: 'crop', label: 'SHORT CROP', asset: 'appearance_hair_crop' },
    { id: 'wild', label: 'WILD', asset: 'appearance_hair_wild' },
    { id: 'mohawk', label: 'MOHAWK', asset: 'appearance_hair_mohawk' },
    { id: 'braids', label: 'BRAIDS', asset: 'appearance_hair_braids' },
    { id: 'topknot', label: 'TOPKNOT', asset: 'appearance_hair_topknot' },
    { id: 'long', label: 'LONG', asset: 'appearance_hair_long', backAsset: 'appearance_hair_long_back' },
  ],
  beard: [
    { id: 'none', label: 'NONE' },
    { id: 'full', label: 'FULL BEARD', asset: 'appearance_beard_full' },
    { id: 'braided', label: 'BRAIDED BEARD', asset: 'appearance_beard_braided' },
    { id: 'mustache', label: 'MUSTACHE', asset: 'appearance_beard_mustache' },
  ],
  headgear: [
    { id: 'none', label: 'NONE' },
    { id: 'horned', label: 'HORNED HELMET', asset: 'appearance_headgear_horned' },
    { id: 'crown', label: 'CROWN', asset: 'appearance_headgear_crown', unlock: 'helmet:4' },
    { id: 'headband', label: 'HEADBAND', asset: 'appearance_headgear_headband' },
    { id: 'skull', label: 'BEAST SKULL', asset: 'appearance_headgear_skull', unlock: 'helmet:3' },
  ],
  skinTone: [
    { id: 'original', label: 'ORIGINAL' },
    { id: 'peach', label: 'PEACH', color: '#f2c59c' },
    { id: 'tan', label: 'TAN', color: '#e2a26b' },
    { id: 'bronze', label: 'BRONZE', color: '#c98a5a' },
    { id: 'umber', label: 'UMBER', color: '#9c6440' },
    { id: 'deep', label: 'DEEP', color: '#6e4428' },
    { id: 'orc', label: 'ORC GREEN', color: '#8fb46a' },
    { id: 'frost', label: 'FROST BLUE', color: '#9fb4c8', unlock: 'skin:6' },
  ],
  eyeColor: [
    { id: 'original', label: 'ORIGINAL' },
    { id: 'brown', label: 'BROWN', color: '#68432b' },
    { id: 'amber', label: 'AMBER', color: '#c59132' },
    { id: 'green', label: 'GREEN', color: '#4d854b' },
    { id: 'blue', label: 'BLUE', color: '#467dbe' },
    { id: 'grey', label: 'GREY', color: '#919ca8' },
    { id: 'violet', label: 'VIOLET', color: '#905baa' },
    { id: 'red', label: 'RED', color: '#b93636' },
  ],
  hairColor: [
    { id: 'original', label: 'ORIGINAL' },
    { id: 'black', label: 'BLACK', color: '#2a1a12' },
    { id: 'brown', label: 'BROWN', color: '#6b3e1f' },
    { id: 'blond', label: 'BLOND', color: '#e8c65a' },
    { id: 'ginger', label: 'GINGER', color: '#e0661f' },
    { id: 'white', label: 'WHITE', color: '#e8e4dc' },
    { id: 'red', label: 'BLOOD RED', color: '#b3261e' },
    { id: 'blue', label: 'WIZARD BLUE', color: '#3a5fb0', unlock: 'hairColor:6' },
  ],
  eyeStyle: [
    { id: 'natural', label: 'NATURAL', asset: 'appearance_eye_natural' },
    { id: 'slit', label: 'SLIT PUPIL', asset: 'appearance_eye_slit' },
  ],
};

export function findHeroAppearance(key: HeroAppearanceKey, id: string): HeroAppearanceOption | undefined {
  return HERO_APPEARANCE[key].find((option) => option.id === id);
}

/** Ny record ved hvert kall, så de to spillerne og utkastene aldri deler redigerbare valg. */
export function defaultHeroAppearance(): HeroAppearance {
  return { hair: 'none', beard: 'none', headgear: 'none', skinTone: 'original', eyeColor: 'original', hairColor: 'original', eyeStyle: 'natural' };
}

/** Ugyldige eller låste valg erstattes enkeltvis, uten å miste de andre lagene. */
export function sanitizeHeroAppearance(input: unknown, allowed: (unlock: string) => boolean = () => true): HeroAppearance {
  const out = defaultHeroAppearance();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const values = input as Record<string, unknown>;
  for (const key of HERO_APPEARANCE_KEYS) {
    const id = values[key];
    const option = typeof id === 'string' ? findHeroAppearance(key, id) : undefined;
    if (option && (!option.unlock || allowed(option.unlock))) out[key] = option.id;
  }
  return out;
}
