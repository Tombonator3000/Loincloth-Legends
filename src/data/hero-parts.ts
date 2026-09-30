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
    { id: 'forge_bald_head', label: 'SCARRED BRAWLER', source: 'forge_bald', slot: 'head' },
    { id: 'forge_eyepatch_head', label: 'ONE-EYED VETERAN', source: 'forge_eyepatch', slot: 'head' },
    { id: 'forge_crownbraid_head', label: 'BRAIDED WARRIOR', source: 'forge_crownbraid', slot: 'head' },
    { id: 'forge_silvercut_head', label: 'SILVER-HAIRED RAIDER', source: 'forge_silvercut', slot: 'head' },
    { id: 'forge_orc_head', label: 'ORC RAIDER', source: 'forge_orc', slot: 'head' },
    { id: 'forge_frost_head', label: 'FROST WARRIOR', source: 'forge_frost', slot: 'head', unlock: 'skin:6' },
    { id: 'forge_ash_head', label: 'ASH RAIDER', source: 'forge_ash', slot: 'head' },
    { id: 'forge_warden_head', label: 'WARDEN GREATHELM', source: 'forge_warden', slot: 'head', unlock: 'helmet:5' },
  ],
  torso: [
    { id: 'thrugg_torso', label: 'THRUGG FUR', source: 'thrugg', slot: 'torso', body: 0 },
    { id: 'valkyra_torso', label: 'VALKYRA CHAINMAIL', source: 'valkyra', slot: 'torso', body: 1 },
    { id: 'gorthak_torso', label: 'GORTHAK ARMOUR', source: 'gorthak', slot: 'torso', body: 0 },
    { id: 'forge_leather_torso', label: 'LEATHER HARNESS', source: 'forge_leather', slot: 'torso', body: 0 },
    { id: 'forge_plate_torso', label: 'DENTED BREASTPLATE', source: 'forge_plate', slot: 'torso', body: 1 },
    { id: 'forge_orc_torso', label: 'ORC TORSO', source: 'forge_orc', slot: 'torso', body: 1 },
    { id: 'forge_frost_torso', label: 'FROST TORSO', source: 'forge_frost', slot: 'torso', body: 0, unlock: 'skin:6' },
    { id: 'forge_ash_torso', label: 'ASH RAIDER BRONZE', source: 'forge_ash', slot: 'torso', body: 1 },
    { id: 'forge_warden_torso', label: 'WARDEN PLATE', source: 'forge_warden', slot: 'torso', body: 0 },
  ],
  pelvis: [
    { id: 'thrugg_pelvis', label: 'THRUGG LOINCLOTH', source: 'thrugg', slot: 'pelvis' },
    { id: 'valkyra_pelvis', label: 'VALKYRA CHAINMAIL', source: 'valkyra', slot: 'pelvis' },
    { id: 'gorthak_pelvis', label: 'GORTHAK BELT', source: 'gorthak', slot: 'pelvis' },
    { id: 'forge_kilt_pelvis', label: 'CRIMSON WAR KILT', source: 'forge_kilt', slot: 'pelvis' },
    { id: 'forge_tassets_pelvis', label: 'IRON TASSETS', source: 'forge_tassets', slot: 'pelvis' },
    { id: 'forge_orc_pelvis', label: 'ORC WAR BELT', source: 'forge_orc', slot: 'pelvis' },
    { id: 'forge_frost_pelvis', label: 'FROST WAR BELT', source: 'forge_frost', slot: 'pelvis' },
    { id: 'forge_ash_pelvis', label: 'ASH RAIDER BELT', source: 'forge_ash', slot: 'pelvis' },
    { id: 'forge_warden_pelvis', label: 'WARDEN TASSETS', source: 'forge_warden', slot: 'pelvis' },
  ],
  arm: [
    { id: 'thrugg_arm', label: 'THRUGG', source: 'thrugg', slot: 'arm' },
    { id: 'valkyra_arm', label: 'VALKYRA', source: 'valkyra', slot: 'arm' },
    { id: 'gorthak_arm', label: 'GORTHAK', source: 'gorthak', slot: 'arm' },
    { id: 'forge_leather_arm', label: 'LEATHER BRACERS', source: 'forge_leather', slot: 'arm' },
    { id: 'forge_plate_arm', label: 'IRON GAUNTLETS', source: 'forge_plate', slot: 'arm' },
    { id: 'forge_orc_arm', label: 'ORC ARMS', source: 'forge_orc', slot: 'arm' },
    { id: 'forge_frost_arm', label: 'FROST ARMS', source: 'forge_frost', slot: 'arm', unlock: 'skin:6' },
    { id: 'forge_ash_arm', label: 'ASH RAIDER ARMS', source: 'forge_ash', slot: 'arm' },
    { id: 'forge_warden_arm', label: 'WARDEN GAUNTLETS', source: 'forge_warden', slot: 'arm' },
  ],
  leg: [
    { id: 'thrugg_leg', label: 'THRUGG BOOTS', source: 'thrugg', slot: 'leg' },
    { id: 'valkyra_leg', label: 'VALKYRA BOOTS', source: 'valkyra', slot: 'leg' },
    { id: 'gorthak_leg', label: 'GORTHAK GREAVES', source: 'gorthak', slot: 'leg' },
    { id: 'forge_sandals_leg', label: 'BATTLE SANDALS', source: 'forge_sandals', slot: 'leg' },
    { id: 'forge_greaves_leg', label: 'IRON GREAVES', source: 'forge_greaves', slot: 'leg' },
    { id: 'forge_orc_leg', label: 'ORC LEGS', source: 'forge_orc', slot: 'leg' },
    { id: 'forge_frost_leg', label: 'FROST LEGS', source: 'forge_frost', slot: 'leg', unlock: 'skin:6' },
    { id: 'forge_ash_leg', label: 'ASH RAIDER BOOTS', source: 'forge_ash', slot: 'leg' },
    { id: 'forge_warden_leg', label: 'WARDEN GREAVES', source: 'forge_warden', slot: 'leg' },
  ],
  weapon: [
    { id: 'thrugg_weapon', label: 'THRUGG SWORD', source: 'thrugg', slot: 'weapon', weapon: 0 },
    { id: 'valkyra_weapon', label: 'VALKYRA AXE', source: 'valkyra', slot: 'weapon', weapon: 1 },
    { id: 'gorthak_weapon', label: 'GORTHAK AXE', source: 'gorthak', slot: 'weapon', weapon: 1 },
    { id: 'hogman_weapon', label: 'HOGMAN CLUB', source: 'hogman', slot: 'weapon', weapon: 3, unlock: 'weapon:3' },
    { id: 'forge_warhammer_weapon', label: 'IRON WARHAMMER', source: 'forge_warhammer', slot: 'weapon', weapon: 2, unlock: 'weapon:2' },
    { id: 'forge_sabre_weapon', label: 'RAIDER SABRE', source: 'forge_sabre', slot: 'weapon', weapon: 0 },
    { id: 'forge_boneclub_weapon', label: 'BONE CRUSHER', source: 'forge_boneclub', slot: 'weapon', weapon: 3, unlock: 'weapon:3' },
    { id: 'forge_cleaver_weapon', label: 'RAIDER CLEAVER', source: 'forge_cleaver', slot: 'weapon', weapon: 0 },
    { id: 'forge_doubleaxe_weapon', label: 'DOUBLE AXE', source: 'forge_doubleaxe', slot: 'weapon', weapon: 1 },
    { id: 'forge_maul_weapon', label: 'IRON MAUL', source: 'forge_maul', slot: 'weapon', weapon: 2, unlock: 'weapon:2' },
    { id: 'forge_flangedmace_weapon', label: 'FLANGED MACE', source: 'forge_flangedmace', slot: 'weapon', weapon: 3, unlock: 'weapon:3' },
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
