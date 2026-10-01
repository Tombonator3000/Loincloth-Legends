// Brettene. Hvert brett har biom, lengde, bølger, tønner og en finale (sjef eller duell).
import type { PickKind } from '../game/items';
import { hz, type HazardDef } from './hazards';

export interface SpawnDef { foe: string; side: 'L' | 'R'; delay: number }
export interface WaveDef { at: number; maxAlive: number; title?: string; say?: [string, string]; spawns: SpawnDef[] }
/**
 * Vorthax viser seg på himmelen som et kjempehode og holder tale når kameraet når at (mellom bølgene, så heltene
 * rekker å lese). En replikk om gangen i HUD-en, se Stage.updateVision og gfx/vision.ts.
 */
export interface VorthaxVision { at: number; lines: string[] }
/** dawn: brettet er ferdig når alle bølgene er over og ingen fiender er igjen (nattleiren). */
export type Finale = { type: 'boss'; boss: string } | { type: 'duel'; duelist: string } | { type: 'dawn' };

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
  /**
   * Nattleir som i Golden Axe: heltene sover når brettet starter, tyvnisser stjeler krukker, og krukkene
   * heltene har igjen på slutten blir forsyninger til neste brett.
   */
  nightCamp?: boolean;
  gateTitle?: string;
  gateSub?: string;
  bossSign?: string;
  /** Vorthax på himmelen med en tale (brettene før tårnet, så skurken merkes hele veien). */
  vorthax?: VorthaxVision;
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
  nightcamp: {
    id: 'nightcamp', name: 'NIGHT CAMP', subtitle: 'GUARD YOUR POTIONS', biome: 'night', length: 40, music: 'night',
    intro: 'THE HEROES SLEEP. THE GNOMES DO NOT.',
    nightCamp: true,
    waves: [
      w(2, 3, 'gnome:L:0.8 gnome:R:1.8 gnome:L:3.2', { title: 'THIEVES!', say: ['NARRATOR', 'GNOMES. IN THE NIGHT. AFTER YOUR POTIONS. WAKE UP!'] }),
      w(9, 4, 'gnome:R:0.3 gnome:L:0.9 gnome:R:1.6 gnome:L:2.4 gnome:R:3.2'),
      w(17, 4, 'gnome:L:0.2 skeleton:R:0.8 gnome:R:1.4 gnome:L:2.2 gnome:R:3.0', { say: ['NARRATOR', 'A SKELETON CAME TOO. NOBODY INVITED HIM.'] }),
      w(26, 5, 'gnome:R:0.2 gnome:L:0.5 gnome:R:0.8 gnome:L:1.1 gnome:R:1.4 gnome:L:1.7', { title: 'THE GNOME HORDE!' }),
    ],
    barrels: [[14, 'chicken'], [30, 'potion']],
    finale: { type: 'dawn' },
  },
  road: {
    id: 'road', name: 'STAGE 1', subtitle: 'THE ROAD OF MILD PERIL', biome: 'grass', length: 120, music: 'stage',
    intro: 'THE ROAD TO GLORY IS PAVED WITH SKELETONS. AND ALSO REGULAR PAVING.',
    waves: [
      w(8, 4, 'skeleton:R:0.2 skeleton:R:0.6 skeleton:L:1.4 skeleton:R:2.4', { title: 'SKELETONS!', say: ['NARRATOR', 'LIKE PEOPLE, BUT WORSE. AND CRUNCHIER.'] }),
      w(30, 4, 'gnome:L:0.2 skeleton:R:0.8 hogman:R:1.6 skeleton:L:2.4', { say: ['NARRATOR', 'A GNOME WITH A SACK OF POTIONS. HIT HIM. FOR SCIENCE.'] }),
      w(54, 5, 'cultist:R:0.3 skeleton:L:0.8 cultist:R:1.5 skeleton:R:2.2 hogman:L:3.2', { title: 'CULTISTS!', say: ['NARRATOR', 'THEY THROW DAGGERS. RUDE.'] }),
      w(80, 5, 'hogman:R:0.3 hogman:L:1.0 gnome:R:1.6 skeleton:R:2.0 cultist:L:2.8 skeleton:R:3.6', { say: ['NARRATOR', 'A PRISONER CART BOUND FOR VORTHAX\'S TOWER. THE PRISONERS ESCAPED. THE HOGMEN DID NOT.'] }),
    ],
    vorthax: { at: 20, lines: [
      'GREETINGS, OILY TRESPASSERS. I AM VORTHAX THE MODERATELY EVIL.',
      'PRINCESS AMBERLY IS MY GUEST. SHE IS SAFE. SHE IS EXTREMELY BORED.',
      'TURN BACK NOW, OR FACE... MODERATE CONSEQUENCES.',
    ] },
    barrels: [[18, 'chicken'], [42, 'gold'], [62, 'potion'], [86, 'chicken'], [100, 'ham']],
    hazards: [hz('spikes', 21, -1.85, 3.0, 1.3), hz('spikes', 45, 1.85, 3.0, 1.3), hz('spikes', 70, -1.85, 3.0, 1.3), hz('spikes', 90, 1.85, 2.6, 1.3)],
    riders: [[2, 'skeleton', 'warhog'], [3, 'hogman', 'warhog']],
    finale: { type: 'boss', boss: 'hogmother' }, bossSign: 'MAMA\'S KITCHEN',
  },
  // Jungelen rundt Soltempelet (Tom 2026-10-01): mellom brett 1 og sumpen. Vorthax har stjålet Solhjertet herfra.
  // Fire farer: kjøttetende planter (kast fiendene inn i dem) og steinvekter som faller på den som står under dem.
  // Søylene langs veien kan veltes over fiendene (gfx/env/jungle.ts). Finalen er en duell mot dronningen over tempelet.
  jungle: {
    id: 'jungle', name: 'STAGE 2', subtitle: 'THE STEAMING JUNGLE', biome: 'jungle', length: 130, music: 'jungle',
    intro: 'SO HUMID THAT EVEN THE SWEAT IS SWEATING.',
    waves: [
      w(8, 4, 'mossskel:R:0.2 mossskel:R:0.7 frogman:L:1.4 mossskel:R:2.2', { title: 'TEMPLE GUARDS!', say: ['NARRATOR', 'THE OLD GUARDS OF THE SUN TEMPLE. NOBODY TOLD THEM TO STOP.'] }),
      w(34, 5, 'templethief:R:0.3 hogman:L:0.9 templethief:R:1.6 gnome:L:2.0 mossskel:R:2.6', { title: 'TEMPLE THIEVES!', say: ['NARRATOR', 'VORTHAX\'S LOOTERS. CARRYING GOLD. AND A RECEIPT.'] }),
      w(64, 5, 'frogman:R:0.3 frogman:L:0.8 hogman:R:1.4 templethief:L:2.0 mossskel:R:2.6 frogman:R:3.2', { say: ['NARRATOR', 'THE PLANTS ARE HUNGRY. FEED THEM SOMETHING THAT IS NOT YOU.'] }),
      w(94, 6, 'hogman:R:0.3 templethief:R:0.8 mossskel:L:1.2 hogguard:L:1.8 templethief:R:2.4 frogman:L:3.0', { title: 'THE LOOTING TRAIN!' }),
    ],
    vorthax: { at: 21, lines: [
      'OH. YOU FOUND THE SUN TEMPLE. AND ITS EMPTY PEDESTAL.',
      'THE SUN HEART? I BORROWED IT. MY TOWER NEEDED BETTER LIGHTING.',
      'THE PRINCESS SAYS THE JUNGLE IS TOO HUMID. FOR ONCE, WE AGREE.',
    ] },
    barrels: [[18, 'chicken'], [44, 'potion'], [78, 'gold'], [108, 'ham']],
    hazards: [hz('maneater', 23, -1.7, 2.4, 1.5), hz('deadfall', 50, 0.2, 2.0, 1.5), hz('maneater', 74, -1.7, 2.4, 1.5), hz('deadfall', 101, -0.4, 2.0, 1.5)],
    riders: [[2, 'frogman', 'cluckatrice']],
    finale: { type: 'duel', duelist: 'zanthra' }, gateTitle: 'THE SUN TEMPLE >>>', gateSub: 'THE QUEEN AWAITS. KNEEL OR BLEED.',
  },
  swamp: {
    id: 'swamp', name: 'STAGE 3', subtitle: 'THE SWAMP OF MOIST REGRET', biome: 'swamp', length: 125, music: 'swamp',
    intro: 'IT SMELLS LIKE A WET DOG ATE ANOTHER WET DOG.',
    waves: [
      w(8, 4, 'zombie:R:0.2 zombie:R:0.9 zombie:L:1.5 frogman:R:2.6', { title: 'ZOMBIES!', say: ['NARRATOR', 'SLOW, STUPID, AND STICKY. LIKE A MONDAY.'] }),
      w(32, 5, 'frogman:R:0.2 frogman:L:0.8 gnome:L:1.2 zombie:R:1.8 zombie:R:2.6', { title: 'FROGMEN!', say: ['NARRATOR', 'THEY JUMP. THEY STAB. THEY LICK THINGS.'] }),
      w(58, 5, 'cultist:R:0.3 zombie:L:0.8 frogman:R:1.4 zombie:L:2.2 hogman:R:3.0 frogman:L:3.6', { say: ['NARRATOR', 'A NOTE PINNED TO A ZOMBIE: MORE BRAINS FOR THE ARMY. SIGNED, V.'] }),
      w(86, 6, 'frogman:R:0.3 frogman:R:0.8 zombie:L:1.0 zombie:L:1.6 cultist:R:2.2 gnome:R:2.8 hogman:L:3.4', { title: 'THE ROYAL GUARD!' }),
    ],
    vorthax: { at: 21, lines: [
      'STILL ALIVE? HOW... ADEQUATE.',
      'KING CROAKUS RULES THIS SWAMP FOR ME. HE IS A FROG. HE TAKES IT VERY SERIOUSLY.',
      'THE PRINCESS SENDS HER REGARDS. NO, SHE DOESN\'T.',
    ] },
    barrels: [[20, 'potion'], [44, 'chicken'], [70, 'gold'], [96, 'ham']],
    hazards: [hz('bog', 17, 1.75, 3.4, 1.5), hz('bog', 40, -1.75, 3.4, 1.5), hz('bog', 66, 1.75, 3.4, 1.5), hz('bog', 94, -1.75, 3.0, 1.5)],
    riders: [[1, 'frogman', 'cluckatrice'], [3, 'zombie', 'cluckatrice']],
    finale: { type: 'boss', boss: 'croakus' }, bossSign: 'ROYAL POND',
  },
  frost: {
    id: 'frost', name: 'STAGE 4', subtitle: 'FROSTBITE PASS', biome: 'frost', length: 125, music: 'frost',
    intro: 'SO COLD THAT EVEN THE LOINCLOTHS WEAR LOINCLOTHS.',
    waves: [
      w(8, 4, 'frostskel:R:0.2 frostskel:L:0.8 frostskel:R:1.4 frostskel:R:2.2', { title: 'FROST SKELETONS!', say: ['NARRATOR', 'THEY ARE BLUE. THAT IS THE ONLY DIFFERENCE.'] }),
      w(34, 4, 'troll:R:0.3 frostskel:L:0.9 frostskel:R:1.6 gnome:L:2.0 cultist:R:2.6', { title: 'ICE TROLL!', say: ['NARRATOR', 'HE THROWS SNOWBALLS THE SIZE OF COWS.'] }),
      w(62, 5, 'bigtroll:R:0.4 frostskel:L:0.9 frostskel:L:1.5 cultist:R:2.4 frostskel:R:3.0', { title: 'AVALANCHE TROLL!', say: ['NARRATOR', 'HIS MOTHER CALLS HIM LITTLE BJORN. NOBODY ELSE DOES. TWICE.'] }),
      w(90, 6, 'troll:R:0.3 troll:L:1.2 frostskel:R:1.8 frostskel:L:2.4 cultist:R:3.0 gnome:R:3.4', { title: 'AVALANCHE OF IDIOTS!', say: ['NARRATOR', 'VORTHAX SENT A MEMO: MORE TROLLS. THE TROLLS CANNOT READ. THEY CAME ANYWAY.'] }),
    ],
    vorthax: { at: 21, lines: [
      'COLD, ISN\'T IT? I HAD THE PASS AIR-CONDITIONED.',
      'KALDOR GUARDS THE FROZEN PIT. I PAID HIM IN ADVANCE. NON-REFUNDABLE.',
      'AND STOP THROWING MY TROLLS INTO THE CHASM. THEY ARE ON LOAN.',
    ] },
    barrels: [[20, 'chicken'], [48, 'potion'], [74, 'gold'], [100, 'ham']],
    // Juvet (konseptbilde 4): kast fiendene over taugjerdet og ned i dypet
    hazards: [hz('icehole', 23, -1.7, 2.8, 1.4), hz('chasm', 37, -2.0, 9, 1.4), hz('icehole', 49, 1.7, 2.8, 1.4), hz('icehole', 76, -1.7, 2.8, 1.4), hz('chasm', 90, -2.0, 10, 1.4), hz('icehole', 102, 1.7, 2.6, 1.4)],
    riders: [[1, 'frostskel', 'warhog'], [2, 'frostskel', 'cluckatrice']],
    finale: { type: 'duel', duelist: 'kaldor' }, gateTitle: 'THE FROZEN PIT >>>', gateSub: 'KALDOR AWAITS. BRING A SCARF.',
  },
  scorch: {
    id: 'scorch', name: 'STAGE 5', subtitle: 'THE SCORCHLANDS', biome: 'scorch', length: 130, music: 'scorch',
    intro: 'THE FLOOR IS LAVA. THIS IS NOT A GAME. WELL, IT IS A GAME.',
    waves: [
      w(8, 4, 'emberskel:R:0.2 emberskel:L:0.8 fireimp:R:1.4 emberskel:R:2.2', { title: 'FIRE IMPS!', say: ['NARRATOR', 'SMALL, RED AND THROWING FIRE. LIKE A TODDLER WITH A TORCH.'] }),
      w(34, 5, 'fireimp:R:0.3 fireimp:L:0.8 hogman:R:1.4 ashraider:L:2.0 gnome:R:2.4 emberskel:R:3.0', { title: 'ASH RAIDERS!', say: ['NARRATOR', 'TWO AXE BLADES. STILL NO MANNERS.'] }),
      w(62, 5, 'troll:R:0.3 fireimp:L:0.9 fireimp:R:1.5 emberskel:L:2.2 cultist:R:2.8', { say: ['NARRATOR', 'THE IMPS CARRY VORTHAX\'S LAUNDRY TO THE TOWER. EVEN EVIL NEEDS CLEAN ROBES.'] }),
      w(92, 6, 'hogman:R:0.3 fireimp:R:0.8 fireimp:L:1.2 ashraider:L:1.8 emberskel:R:2.4 darkcultist:R:3.0', { title: 'IT GETS HOTTER!' }),
    ],
    vorthax: { at: 21, lines: [
      'BEHOLD MY SCORCHLANDS. THE PROPERTY VALUES ARE TERRIBLE.',
      'MAGMOR WILL MELT YOU. HE IS VERY LONELY. DO NOT HUG HIM.',
      'MY TOWER IS NEXT. WIPE YOUR FEET. THE CARPET IS NEW.',
    ] },
    barrels: [[20, 'chicken'], [46, 'potion'], [72, 'ham'], [104, 'gold']],
    hazards: [hz('lava', 15, -1.8, 3.6, 1.4), hz('lava', 41, 1.8, 3.6, 1.4), hz('lava', 67, -1.8, 3.6, 1.4), hz('lava', 98, 1.8, 3.2, 1.4)],
    riders: [[1, 'fireimp', 'magmanewt'], [3, 'emberskel', 'magmanewt']],
    finale: { type: 'boss', boss: 'magmor' }, bossSign: 'DO NOT TOUCH',
  },
  tower: {
    id: 'tower', name: 'FINAL STAGE', subtitle: 'TOWER OF MODERATE EVIL', biome: 'tower', length: 130, music: 'duel',
    intro: 'VORTHAX\'S TOWER. THE CARPET IS NICE. THE PEOPLE ARE NOT.',
    waves: [
      w(8, 5, 'darkcultist:R:0.2 skeleton:L:0.6 skeleton:R:1.2 ironwarden:R:2.2', { title: 'THE LOBBY', say: ['NARRATOR', 'PLEASE SIGN IN AT THE FRONT DESK. THEN KILL IT.'] }),
      w(34, 5, 'hogguard:R:0.3 darkcultist:L:0.8 emberskel:R:1.4 frostskel:L:2.0 gnome:R:2.4'),
      w(62, 6, 'zombie:L:0.3 frogman:R:0.8 troll:R:1.4 fireimp:L:2.0 darkcultist:R:2.6 skeleton:L:3.2', { title: 'EVERYBODY!', say: ['VORTHAX', 'SEND EVERYONE! YES, EVEN KEVIN!'] }),
      w(92, 6, 'ironwarden:R:0.3 hogguard:L:0.9 darkcultist:R:1.5 darkcultist:L:2.1 fireimp:R:2.7 gnome:L:3.0', { title: 'LAST LINE OF DEFENCE' }),
    ],
    barrels: [[20, 'chicken'], [46, 'potion'], [74, 'ham'], [100, 'potion']],
    hazards: [hz('spiketrap', 22, 0, 2.2, 2.0), hz('spiketrap', 52, -1.2, 2.2, 2.0), hz('spiketrap', 88, 1.2, 2.2, 2.0)],
    riders: [[1, 'hogguard', 'warhog'], [2, 'darkcultist', 'magmanewt'], [3, 'skeleton', 'cluckatrice']],
    finale: { type: 'boss', boss: 'vorthax' }, bossSign: 'THRONE ROOM',
  },
};
