// Brettene. Hvert brett har biom, lengde, bølger, tønner og en finale (sjef eller duell).
import type { PickKind } from '../game/items';
import { hz, type HazardDef } from './hazards';

export interface SpawnDef { foe: string; side: 'L' | 'R'; delay: number }
export interface WaveDef { at: number; maxAlive: number; title?: string; say?: [string, string]; spawns: SpawnDef[] }
export type Finale = { type: 'boss'; boss: string } | { type: 'duel'; duelist: string };

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  biome: string;
  length: number;
  music: string;
  intro: string;
  waves: WaveDef[];
  barrels: [number, PickKind | 'gold'][];
  /** Farer (pigger, myr, råk, lava, piggfeller). Se data/hazards.ts. */
  hazards?: HazardDef[];
  /** Fiender som rir inn på ridedyr: [bølgeindeks, fiende-id, ridedyr-id]. Se data/mounts.ts. */
  riders?: [number, string, string][];
  finale: Finale;
  gateTitle?: string;
  gateSub?: string;
  bossSign?: string;
}

const w = (at: number, maxAlive: number, list: string, extra: Partial<WaveDef> = {}): WaveDef => ({
  at,
  maxAlive,
  // Format: "skeleton:R:0.2 hogman:L:1.0"
  spawns: list.split(/\s+/).filter(Boolean).map((s) => {
    const [foe, side, delay] = s.split(':');
    return { foe, side: side as 'L' | 'R', delay: Number(delay) };
  }),
  ...extra,
});

export const LEVELS: Record<string, LevelDef> = {
  road: {
    id: 'road', name: 'STAGE 1', subtitle: 'THE ROAD OF MILD PERIL', biome: 'grass', length: 120, music: 'stage',
    intro: 'THE ROAD TO GLORY IS PAVED WITH SKELETONS. AND ALSO REGULAR PAVING.',
    waves: [
      w(8, 4, 'skeleton:R:0.2 skeleton:R:0.6 skeleton:L:1.4 skeleton:R:2.4', { title: 'SKELETONS!', say: ['NARRATOR', 'LIKE PEOPLE, BUT WORSE. AND CRUNCHIER.'] }),
      w(30, 4, 'gnome:L:0.2 skeleton:R:0.8 hogman:R:1.6 skeleton:L:2.4', { say: ['NARRATOR', 'A GNOME WITH A SACK OF POTIONS. HIT HIM. FOR SCIENCE.'] }),
      w(54, 5, 'cultist:R:0.3 skeleton:L:0.8 cultist:R:1.5 skeleton:R:2.2 hogman:L:3.2', { title: 'CULTISTS!', say: ['NARRATOR', 'THEY THROW DAGGERS. RUDE.'] }),
      w(80, 5, 'hogman:R:0.3 hogman:L:1.0 gnome:R:1.6 skeleton:R:2.0 cultist:L:2.8 skeleton:R:3.6'),
    ],
    barrels: [[18, 'chicken'], [42, 'gold'], [62, 'potion'], [86, 'chicken'], [100, 'ham']],
    hazards: [hz('spikes', 21, -1.85, 3.0, 1.3), hz('spikes', 45, 1.85, 3.0, 1.3), hz('spikes', 70, -1.85, 3.0, 1.3), hz('spikes', 90, 1.85, 2.6, 1.3)],
    riders: [[2, 'skeleton', 'warhog'], [3, 'hogman', 'warhog']],
    finale: { type: 'boss', boss: 'hogmother' }, bossSign: 'MAMA\'S KITCHEN',
  },
  swamp: {
    id: 'swamp', name: 'STAGE 2', subtitle: 'THE SWAMP OF MOIST REGRET', biome: 'swamp', length: 125, music: 'stage',
    intro: 'IT SMELLS LIKE A WET DOG ATE ANOTHER WET DOG.',
    waves: [
      w(8, 4, 'zombie:R:0.2 zombie:R:0.9 zombie:L:1.5 frogman:R:2.6', { title: 'ZOMBIES!', say: ['NARRATOR', 'SLOW, STUPID, AND STICKY. LIKE A MONDAY.'] }),
      w(32, 5, 'frogman:R:0.2 frogman:L:0.8 gnome:L:1.2 zombie:R:1.8 zombie:R:2.6', { title: 'FROGMEN!', say: ['NARRATOR', 'THEY JUMP. THEY STAB. THEY LICK THINGS.'] }),
      w(58, 5, 'cultist:R:0.3 zombie:L:0.8 frogman:R:1.4 zombie:L:2.2 hogman:R:3.0 frogman:L:3.6'),
      w(86, 6, 'frogman:R:0.3 frogman:R:0.8 zombie:L:1.0 zombie:L:1.6 cultist:R:2.2 gnome:R:2.8 hogman:L:3.4', { title: 'THE ROYAL GUARD!' }),
    ],
    barrels: [[20, 'potion'], [44, 'chicken'], [70, 'gold'], [96, 'ham']],
    hazards: [hz('bog', 17, 1.75, 3.4, 1.5), hz('bog', 40, -1.75, 3.4, 1.5), hz('bog', 66, 1.75, 3.4, 1.5), hz('bog', 94, -1.75, 3.0, 1.5)],
    riders: [[1, 'frogman', 'cluckatrice'], [3, 'zombie', 'cluckatrice']],
    finale: { type: 'boss', boss: 'croakus' }, bossSign: 'ROYAL POND',
  },
  frost: {
    id: 'frost', name: 'STAGE 3', subtitle: 'FROSTBITE PASS', biome: 'frost', length: 125, music: 'stage',
    intro: 'SO COLD THAT EVEN THE LOINCLOTHS WEAR LOINCLOTHS.',
    waves: [
      w(8, 4, 'frostskel:R:0.2 frostskel:L:0.8 frostskel:R:1.4 frostskel:R:2.2', { title: 'FROST SKELETONS!', say: ['NARRATOR', 'THEY ARE BLUE. THAT IS THE ONLY DIFFERENCE.'] }),
      w(34, 4, 'troll:R:0.3 frostskel:L:0.9 frostskel:R:1.6 gnome:L:2.0 cultist:R:2.6', { title: 'ICE TROLL!', say: ['NARRATOR', 'HE THROWS SNOWBALLS THE SIZE OF COWS.'] }),
      w(62, 5, 'troll:L:0.3 frostskel:R:0.8 frostskel:R:1.3 cultist:R:2.0 frostskel:L:2.8'),
      w(90, 6, 'troll:R:0.3 troll:L:1.2 frostskel:R:1.8 frostskel:L:2.4 cultist:R:3.0 gnome:R:3.4', { title: 'AVALANCHE OF IDIOTS!' }),
    ],
    barrels: [[20, 'chicken'], [48, 'potion'], [74, 'gold'], [100, 'ham']],
    hazards: [hz('icehole', 23, -1.7, 2.8, 1.4), hz('icehole', 49, 1.7, 2.8, 1.4), hz('icehole', 76, -1.7, 2.8, 1.4), hz('icehole', 102, 1.7, 2.6, 1.4)],
    riders: [[1, 'frostskel', 'warhog'], [2, 'frostskel', 'cluckatrice']],
    finale: { type: 'duel', duelist: 'kaldor' }, gateTitle: 'THE FROZEN PIT >>>', gateSub: 'KALDOR AWAITS. BRING A SCARF.',
  },
  scorch: {
    id: 'scorch', name: 'STAGE 4', subtitle: 'THE SCORCHLANDS', biome: 'scorch', length: 130, music: 'stage',
    intro: 'THE FLOOR IS LAVA. THIS IS NOT A GAME. WELL, IT IS A GAME.',
    waves: [
      w(8, 4, 'emberskel:R:0.2 emberskel:L:0.8 fireimp:R:1.4 emberskel:R:2.2', { title: 'FIRE IMPS!', say: ['NARRATOR', 'SMALL, RED AND THROWING FIRE. LIKE A TODDLER WITH A TORCH.'] }),
      w(34, 5, 'fireimp:R:0.3 fireimp:L:0.8 hogman:R:1.4 emberskel:L:2.0 gnome:R:2.4 emberskel:R:3.0'),
      w(62, 5, 'troll:R:0.3 fireimp:L:0.9 fireimp:R:1.5 emberskel:L:2.2 cultist:R:2.8'),
      w(92, 6, 'hogman:R:0.3 fireimp:R:0.8 fireimp:L:1.2 emberskel:L:1.8 emberskel:R:2.4 darkcultist:R:3.0', { title: 'IT GETS HOTTER!' }),
    ],
    barrels: [[20, 'chicken'], [46, 'potion'], [72, 'ham'], [104, 'gold']],
    hazards: [hz('lava', 15, -1.8, 3.6, 1.4), hz('lava', 41, 1.8, 3.6, 1.4), hz('lava', 67, -1.8, 3.6, 1.4), hz('lava', 98, 1.8, 3.2, 1.4)],
    riders: [[1, 'fireimp', 'magmanewt'], [3, 'emberskel', 'magmanewt']],
    finale: { type: 'boss', boss: 'magmor' }, bossSign: 'DO NOT TOUCH',
  },
  tower: {
    id: 'tower', name: 'FINAL STAGE', subtitle: 'TOWER OF MODERATE EVIL', biome: 'tower', length: 130, music: 'duel',
    intro: 'VORTHAX\'S TOWER. THE CARPET IS NICE. THE PEOPLE ARE NOT.',
    waves: [
      w(8, 5, 'darkcultist:R:0.2 skeleton:L:0.6 skeleton:R:1.2 hogguard:R:2.2', { title: 'THE LOBBY', say: ['NARRATOR', 'PLEASE SIGN IN AT THE FRONT DESK. THEN KILL IT.'] }),
      w(34, 5, 'hogguard:R:0.3 darkcultist:L:0.8 emberskel:R:1.4 frostskel:L:2.0 gnome:R:2.4'),
      w(62, 6, 'zombie:L:0.3 frogman:R:0.8 troll:R:1.4 fireimp:L:2.0 darkcultist:R:2.6 skeleton:L:3.2', { title: 'EVERYBODY!', say: ['VORTHAX', 'SEND EVERYONE! YES, EVEN KEVIN!'] }),
      w(92, 6, 'hogguard:R:0.3 hogguard:L:0.9 darkcultist:R:1.5 darkcultist:L:2.1 fireimp:R:2.7 gnome:L:3.0', { title: 'LAST LINE OF DEFENCE' }),
    ],
    barrels: [[20, 'chicken'], [46, 'potion'], [74, 'ham'], [100, 'potion']],
    hazards: [hz('spiketrap', 22, 0, 2.2, 2.0), hz('spiketrap', 52, -1.2, 2.2, 2.0), hz('spiketrap', 88, 1.2, 2.2, 2.0)],
    riders: [[1, 'hogguard', 'warhog'], [2, 'darkcultist', 'magmanewt'], [3, 'skeleton', 'cluckatrice']],
    finale: { type: 'boss', boss: 'vorthax' }, bossSign: 'THRONE ROOM',
  },
};
