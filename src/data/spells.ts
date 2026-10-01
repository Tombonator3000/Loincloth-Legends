// Magien heltene kaster med de blå krukkene: registeret Hero Forge og brettene leser fra (ingen Three.js her).
// Selve trylleformlene ligger i game/spells.ts. Rekkefølgen er indeksen i HeroConfig.magic, så nye legges til bakerst.

export type SpellId = 'meteor' | 'scream' | 'thunder' | 'missile' | 'turn' | 'grease' | 'chicken';

export interface SpellDef {
  id: SpellId;
  /** Navnet på MAGIC-raden i Hero Forge. */
  label: string;
  /** Det som står over skjermen når den kastes. */
  title: string;
  /** Én linje i infoboksen i Hero Forge. */
  desc: string;
  /** Fargen på gløden rundt hendene mens helten lader. */
  color: string;
}

export const SPELLS: SpellDef[] = [
  { id: 'meteor', label: 'METEOR STORM', title: 'METEOR OF EXCESSIVE FORCE', desc: 'One meteor for every enemy on screen. Subtle it is not.', color: '#ffb02e' },
  { id: 'scream', label: 'ANCESTRAL SCREAM', title: 'SCREAM OF THE ANCESTORS', desc: 'Your ancestors scream with you. Heads explode. Ears too.', color: '#9fd8ff' },
  { id: 'thunder', label: 'SKY THUNDER', title: 'WRATH OF THE THUNDER GOD', desc: 'Lightning strikes your weapon, then everyone you dislike.', color: '#bfe8ff' },
  { id: 'missile', label: 'MAGIC MISSILE', title: 'MAGIC MISSILE OF ABSOLUTE CERTAINTY', desc: 'A glowing dart for every enemy. One misses. It comes back.', color: '#d070ff' },
  { id: 'turn', label: 'TURN UNDEAD', title: 'TURN UNDEAD (AND EVERYONE ELSE)', desc: 'The dead crumble, the living go blind, and heroes feel a bit better.', color: '#ffe9a0' },
  { id: 'grease', label: 'GREASE', title: 'GREASE OF THE OILY ONE', desc: 'Oil on the road. Enemies slip. Add fire and it gets worse. Better.', color: '#8a7a3a' },
  { id: 'chicken', label: 'POLYMORPH: CHICKEN', title: 'POLYMORPH: CHICKEN', desc: 'Enemies become chickens. One hit and they pop. Bosses save vs. polymorph.', color: '#fff2c0' },
];

/** Trylleformelen på plass i i HeroConfig.magic (gamle lagringer har 0 til 2, som før). */
export function spellAt(i: number): SpellDef {
  return SPELLS[i] ?? SPELLS[0];
}

export function spellIndex(id: SpellId) {
  return Math.max(0, SPELLS.findIndex((s) => s.id === id));
}

export function spellById(id: SpellId): SpellDef {
  return SPELLS[spellIndex(id)];
}
