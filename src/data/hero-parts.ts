// Malte deler som passer helteriggen. Katalogen peker på eksisterende filer i manifestet.
// Nye figurer kan bidra med enkeltdeler uten å lage et nytt helte-preset.
export const HERO_PART_SLOTS = ['head', 'torso', 'pelvis', 'arm', 'leg', 'weapon'] as const;
export type HeroPartSlot = typeof HERO_PART_SLOTS[number];
export type HeroParts = Record<HeroPartSlot, string>;

export interface HeroPartOption {
  id: string;
  label: string;
  source: string;
  slot: HeroPartSlot;
  /** Overkroppen bestemmer helteriggens kroppstype og stemme. */
  body?: 0 | 1;
  /** Samme indeks som i WEAPONS; bildet og kampegenskapene må følge hverandre. */
  weapon?: number;
  /** Eksisterende opplåsingsnøkkel fra PART_LOCKS. */
  unlock?: string;
}

export const HERO_PARTS: Record<HeroPartSlot, HeroPartOption[]> = {
  head: [
    { id: 'thrugg_head', label: 'THRUGG', source: 'thrugg', slot: 'head' },
    { id: 'valkyra_head', label: 'VALKYRA', source: 'valkyra', slot: 'head' },
    { id: 'gorthak_head', label: 'GORTHAK', source: 'gorthak', slot: 'head', unlock: 'helmet:5' },
  ],
  torso: [
    { id: 'thrugg_torso', label: 'THRUGG FUR', source: 'thrugg', slot: 'torso', body: 0 },
    { id: 'valkyra_torso', label: 'VALKYRA CHAINMAIL', source: 'valkyra', slot: 'torso', body: 1 },
    { id: 'gorthak_torso', label: 'GORTHAK ARMOUR', source: 'gorthak', slot: 'torso', body: 0 },
  ],
  pelvis: [
    { id: 'thrugg_pelvis', label: 'THRUGG LOINCLOTH', source: 'thrugg', slot: 'pelvis' },
    { id: 'valkyra_pelvis', label: 'VALKYRA CHAINMAIL', source: 'valkyra', slot: 'pelvis' },
    { id: 'gorthak_pelvis', label: 'GORTHAK BELT', source: 'gorthak', slot: 'pelvis' },
  ],
  arm: [
    { id: 'thrugg_arm', label: 'THRUGG', source: 'thrugg', slot: 'arm' },
    { id: 'valkyra_arm', label: 'VALKYRA', source: 'valkyra', slot: 'arm' },
    { id: 'gorthak_arm', label: 'GORTHAK', source: 'gorthak', slot: 'arm' },
  ],
  leg: [
    { id: 'thrugg_leg', label: 'THRUGG BOOTS', source: 'thrugg', slot: 'leg' },
    { id: 'valkyra_leg', label: 'VALKYRA BOOTS', source: 'valkyra', slot: 'leg' },
    { id: 'gorthak_leg', label: 'GORTHAK GREAVES', source: 'gorthak', slot: 'leg' },
  ],
  weapon: [
    { id: 'thrugg_weapon', label: 'THRUGG SWORD', source: 'thrugg', slot: 'weapon', weapon: 0 },
    { id: 'valkyra_weapon', label: 'VALKYRA AXE', source: 'valkyra', slot: 'weapon', weapon: 1 },
    { id: 'gorthak_weapon', label: 'GORTHAK AXE', source: 'gorthak', slot: 'weapon', weapon: 1 },
    { id: 'hogman_weapon', label: 'HOGMAN CLUB', source: 'hogman', slot: 'weapon', weapon: 3, unlock: 'weapon:3' },
  ],
};

export function findHeroPart(slot: HeroPartSlot, id: string): HeroPartOption | undefined {
  return HERO_PARTS[slot].find((part) => part.id === id);
}

/** Alltid et nytt sett: presets, spiller 1 og spiller 2 skal ikke dele redigerbare valg. */
export function defaultHeroParts(body: number): HeroParts {
  const source = body === 1 ? 'valkyra' : 'thrugg';
  return {
    head: `${source}_head`, torso: `${source}_torso`, pelvis: `${source}_pelvis`,
    arm: `${source}_arm`, leg: `${source}_leg`, weapon: `${source}_weapon`,
  };
}

/** Ukjente eller utgåtte id-er erstatter bare den ugyldige delen, ikke resten av helten. */
export function sanitizeHeroParts(input: unknown, body: number): HeroParts {
  const parts = defaultHeroParts(body);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return parts;
  const values = input as Record<string, unknown>;
  for (const slot of HERO_PART_SLOTS) {
    const id = values[slot];
    if (typeof id === 'string' && findHeroPart(slot, id)) parts[slot] = id;
  }
  return parts;
}
