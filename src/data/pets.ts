// Kjæledyr som følger helten på brettene (Castle Crashers-stil). Kjøpes i butikken i hjemborgen.
// Tegningene ligger i gfx/pets.ts, oppførselen i game/pets.ts.

export type PetAbility = 'magnet' | 'bite' | 'fire' | 'insult' | 'heal';

export interface PetDef {
  id: string;
  name: string;
  ability: PetAbility;
  /** Nedkjøling mellom evner (sekunder). */
  cd: number;
  /** Flyr (true) eller går på bakken. */
  flies: boolean;
  desc: string;
}

export const PETS: Record<string, PetDef> = {
  eyeball: { id: 'eyeball', name: 'EYEBALL OF GREED', ability: 'magnet', cd: 0, flies: true, desc: 'SUCKS UP GOLD FROM ACROSS THE SCREEN.' },
  rat: { id: 'rat', name: 'RABID RAT', ability: 'bite', cd: 2.4, flies: false, desc: 'BITES ANKLES.' },
  skull: { id: 'skull', name: 'SARCASTIC SKULL', ability: 'insult', cd: 6, flies: true, desc: 'INSULTS ENEMIES UNTIL THEY CRY.' },
  chicken: { id: 'chicken', name: 'BATTLE CHICKEN', ability: 'heal', cd: 12, flies: false, desc: 'LAYS HEALING EGGS.' },
  dragon: { id: 'dragon', name: 'TINY DRAGON', ability: 'fire', cd: 3.5, flies: true, desc: 'SPITS FIREBALLS.' },
};

/** Fornærmelser fra hodeskallen. Fienden blir stående og gråte en stund. */
export const INSULTS = [
  'NICE ARMOUR. DID YOUR MUM PICK IT?',
  'I\'VE SEEN SCARIER SOUP.',
  'EVEN THE GNOMES LAUGH AT YOU.',
  'YOU SMELL LIKE A WET GOBLIN.',
  'WHO DRESSED YOU? A BLIND OGRE?',
  'YOUR SWORD IS A BUTTER KNIFE WITH AMBITION.',
  'YOUR HELMET IS ON BACKWARDS. EMOTIONALLY.',
  'I\'M A SKULL AND I HAVE MORE BRAINS THAN YOU.',
];
export const SOBS = ['*SOB*', 'WAAAH!', 'THAT WAS UNCALLED FOR!', 'I\'M TELLING VORTHAX!', '*SNIFF*'];
