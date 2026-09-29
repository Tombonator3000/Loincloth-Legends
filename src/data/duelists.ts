// Motstandere i 1v1-dueller. char '@player' betyr at spillerens egen helt brukes (ond tvilling).
import type { ArenaTheme } from '../gfx/env';

export interface DuelistDef {
  id: string;
  char: string;
  name: string;
  title: string;
  hp: number;
  speed: number;
  dmg: number;
  tint?: [number, number, number];
  scale?: number;
  aggression: number;
  /** Grunnferdighet i blokk/reaksjon (0 til 1). */
  skill: number;
  arena: ArenaTheme;
  taunts: string[];
  intro: [string, string][];
}

export const DUELISTS: Record<string, DuelistDef> = {
  gorthak: {
    id: 'gorthak', char: 'gorthak', name: 'GORTHAK', title: 'THE UNDEFEATED (SINCE TUESDAY)', hp: 110, speed: 2.6, dmg: 1.1, aggression: 0.6, skill: 0.32, arena: 'pit',
    taunts: ['IS THAT ALL?', 'TUESDAY WAS HARDER!', 'I\'VE HAD WORSE PAPERCUTS!', 'COME HERE, LITTLE SNACK!'],
    intro: [['ANNOUNCER', 'IN THIS CORNER: GORTHAK THE UNDEFEATED! (SINCE TUESDAY)'], ['VORTHAX', 'FIGHT! FIGHT! FIGHT! ...AHEM. I MEAN: BEGIN.'], ['PRINCESS AMBERLY', 'CAN WE WRAP THIS UP? I HAVE A THING.']],
  },
  oinksalot: {
    id: 'oinksalot', char: 'hogman', name: 'SIR OINKSALOT', title: 'KNIGHT OF THE ROUND TROUGH', hp: 130, speed: 2.1, dmg: 1.15, scale: 1.05, aggression: 0.5, skill: 0.28, arena: 'pit',
    taunts: ['FOR HONOUR AND HAM!', 'EN GARDE, SAUSAGE!', 'MY SNOUT IS MY SHIELD!'],
    intro: [['ANNOUNCER', 'SIR OINKSALOT! KNIGHTED FOR EATING A WHOLE CART!'], ['SIR OINKSALOT', 'I CHALLENGE THEE! ALSO, IS THERE A BUFFET?']],
  },
  kaldor: {
    id: 'kaldor', char: 'gorthak', name: 'FROSTJARL KALDOR', title: 'HAS NOT FELT HIS TOES SINCE 1979', hp: 120, speed: 2.8, dmg: 1.15, tint: [0.7, 0.88, 1.35], aggression: 0.65, skill: 0.42, arena: 'ice',
    taunts: ['YOUR BLOOD WILL FREEZE!', 'COLD HANDS, COLDER HEART!', 'I EAT SNOW FOR BREAKFAST!'],
    intro: [['FROSTJARL KALDOR', 'NONE PASS FROSTBITE PASS. EXCEPT THE MAILMAN.'], ['VORTHAX', 'I PAID HIM EXTRA FOR THIS ONE.']],
  },
  bonejangles: {
    id: 'bonejangles', char: 'skeleton', name: 'BONEJANGLES', title: 'THE BRITTLE. DANCES WHEN HE WINS.', hp: 80, speed: 3.4, dmg: 0.95, scale: 1.15, aggression: 0.75, skill: 0.4, arena: 'bone',
    taunts: ['RATTLE ME BONES!', 'I HAVE NO GUTS TO SPILL!', 'DANCE WITH ME!'],
    intro: [['ANNOUNCER', 'THE BONE COLISEUM PRESENTS: BONEJANGLES!'], ['BONEJANGLES', 'I\'VE BEEN DEAD FOR 300 YEARS AND I\'M STILL IN BETTER SHAPE THAN YOU.']],
  },
  darkyou: {
    id: 'darkyou', char: '@player', name: 'DARK YOU', title: 'YOUR EVIL TWIN. SAME HAIRCUT.', hp: 110, speed: 3.0, dmg: 1.05, tint: [0.42, 0.36, 0.55], aggression: 0.6, skill: 0.45, arena: 'bone',
    taunts: ['I AM YOU, BUT BETTER.', 'NICE MOVES. I HAVE THEM TOO.', 'WE BOTH NEED A BATH.'],
    intro: [['NARRATOR', 'THE MIRROR POOL SHOWS YOUR TRUE SELF.'], ['DARK YOU', 'HELLO, ME. GOODBYE, ME.']],
  },
};
