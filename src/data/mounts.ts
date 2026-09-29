// Ridedyr (Golden Axe-stil). Fiender kan komme ridende. Slå rytteren av, og dyret er ditt.
// Tegningene ligger i gfx/chars/beasts.ts, logikken i game/mounts.ts.
import type { Voice } from '../core/audio';

export type MountAttack = 'charge' | 'tail' | 'fire';

export interface MountDef {
  id: string;
  /** Id i BEASTS (gfx/chars/beasts.ts). */
  beast: string;
  name: string;
  speed: number;
  attack: MountAttack;
  /** Nedkjøling mellom angrep (sekunder). */
  cd: number;
  dmg: number;
  voice: Voice;
  /** Hva helten roper når han sitter opp. */
  mountLines: string[];
  /** Når dyret har fått nok og stikker av. */
  fleeLine: string;
}

export const MOUNTS: Record<string, MountDef> = {
  warhog: {
    id: 'warhog', beast: 'warhog', name: 'WAR HOG', speed: 5.4, attack: 'charge', cd: 1.1, dmg: 14, voice: 'boar',
    mountLines: ['GIDDY UP, BACON!', 'TO WAR, MY PORKY STEED!', 'THIS PIG IS MINE NOW!'],
    fleeLine: 'THE WAR HOG HAS HAD ENOUGH OF YOUR NONSENSE.',
  },
  cluckatrice: {
    id: 'cluckatrice', beast: 'cluckatrice', name: 'CLUCKATRICE', speed: 5.8, attack: 'tail', cd: 0.85, dmg: 11, voice: 'rooster',
    mountLines: ['HALF CHICKEN, HALF LIZARD, ALL MINE!', 'BAWK BAWK, BABY!', 'NOBODY LAUGH.'],
    fleeLine: 'THE CLUCKATRICE FLED. IT WAS CHICKEN ALL ALONG.',
  },
  magmanewt: {
    id: 'magmanewt', beast: 'magmanewt', name: 'MAGMA NEWT', speed: 4.5, attack: 'fire', cd: 1.5, dmg: 7, voice: 'newt',
    mountLines: ['FIRE-BREATHING LIZARD? DON\'T MIND IF I DO!', 'LIGHT THEM UP!', 'IT\'S WARM. TOO WARM.'],
    fleeLine: 'THE MAGMA NEWT WENT HOME TO COOL OFF.',
  },
};
