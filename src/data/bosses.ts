// Sjefer på slutten av brettene. Oppførselen settes sammen av trekk (moves) med vekt og nedkjøling.
// Runde E (docs/PLAN_BRETT_GORR_AI.md 6.4): sjefene går gjennom faser ved 66 og 33 prosent liv i stedet for én
// raserigrense. Hver fase gir nye trekk, sterkere utgaver av de gamle og røde trekk som ikke kan avbrytes (bare
// unngås). Etter de store trekkene er sjefen sliten en stund (tired), og da biter slagene.
import { P, type AttackDef } from '../game/attacks';
import type { ProjKind } from '../game/projectiles';

export type BossMoveKind =
  | 'melee' | 'charge' | 'slam' | 'leap' | 'shoot' | 'summon' | 'teleport' | 'tongue' | 'rain'
  // Runde E: måltidet (Hogmother), dykket (Croakus), speilbildene og solstrålen (Vorthax)
  | 'feast' | 'dive' | 'mirror' | 'beam';

export interface BossMove {
  kind: BossMoveKind;
  weight: number;
  cd: number;
  /** Avstand til mål der trekket er aktuelt. */
  range?: [number, number];
  attack?: AttackDef;
  proj?: ProjKind;
  count?: number;
  spread?: number;
  summon?: string[];
  /** Innkalte fiender reiser seg av gulvet der heltene står, i stedet for å komme inn fra siden. */
  rise?: boolean;
  say?: string;
  /** Rødt blink før trekket: det kan ikke avbrytes med slag (vakling virker ikke), bare unngås. */
  red?: boolean;
  /** Sekunder sjefen er sliten etter trekket: uten rustning, så slagene biter og gjør mer skade. */
  tired?: number;
  /** Måltidet: andel av livet sjefen får tilbake hvis ingen avbryter henne. */
  heal?: number;
}

export interface BossPhase {
  /** Livsandelen der fasen begynner. */
  at: number;
  line: string;
  speedMul: number;
  cdMul: number;
  /** Nye trekk i fasen. */
  extra?: BossMove[];
  /** Sterkere utgaver av trekkene han har (slås sammen med trekket av samme slag). */
  stronger?: Partial<Record<BossMoveKind, Partial<BossMove>>>;
  /** Lava renner i sporene hans (Magmor). */
  trail?: boolean;
  /** Vorthax tar Solhjertet (den desperate fasen i tårnet): gyllent lys, rødt rom. */
  heart?: boolean;
}

/**
 * Sluttkampen i tårnet: først reiser vaktene seg av gulvet mens sjefen sitter på tronen, bølge for bølge. Så går han
 * ned og slåss selv bak et skjold som søylene i salen holder oppe. Søylene veltes (helst over ham), og når den siste
 * er nede, brister skjoldet.
 */
export interface BossFinale {
  guards: { foes: string[]; line: string }[];
  /** Det han sier når han reiser seg fra tronen, når en søyle faller, og når skjoldet brister. */
  rise: string;
  pillar: string;
  broken: string;
  /** Det han sier når en søyle faller over ham. */
  crushed: string;
}

export interface BossDef {
  id: string;
  char: string;
  name: string;
  title: string;
  hp: number;
  speed: number;
  tint?: [number, number, number];
  moves: BossMove[];
  phases: BossPhase[];
  intro: [string, string][];
  death: string;
  /** Andel av maks HP som gir stagger (ellers er sjefen urokkelig). */
  stagger: number;
  finale?: BossFinale;
}

const big = (a: Partial<AttackDef> & Pick<AttackDef, 'id' | 'wind' | 'strike'>): AttackDef => ({
  startup: 0.6, active: 0.14, recovery: 0.7, dmg: 16, reach: 2.6, zr: 1.1, height: 'high', kd: true, launch: 6, push: 6, stun: 0.6,
  heavy: true, armor: true, death: ['explode'], swoosh: 'over', ...a,
});

const cleaver = big({ id: 'cleaver', wind: P.chopW, strike: P.chopS, dmg: 18, word: ['CHOP!'] });
const scepter = big({ id: 'scepter', wind: P.chopW, strike: P.chopS, dmg: 15, reach: 2.4 });
const fist = big({ id: 'fist', wind: { armF: 3.0, armB: 2.6, torso: 0.3 }, strike: { armF: 1.2, armB: 1.0, torso: -0.5, bodyY: -0.2, bodyX: 0.25 }, dmg: 20, reach: 2.6, swoosh: 'none', word: ['CRUNCH!'] });
const staff = big({ id: 'staff', startup: 0.35, wind: P.chopW, strike: P.chopS, dmg: 14, reach: 2.2, kd: false, launch: 0, push: 3 });

export const BOSSES: Record<string, BossDef> = {
  hogmother: {
    id: 'hogmother', char: 'hogmother', name: 'BIG MAMA HOGMOTHER', title: 'SHE RAISED 400 PIGLETS. YOU KILLED MOST OF THEM.',
    hp: 420, speed: 2.0, stagger: 0.14,
    moves: [
      { kind: 'melee', weight: 4, cd: 1.2, range: [0, 2.6], attack: cleaver },
      { kind: 'charge', weight: 2, cd: 5, range: [3, 20], say: 'COME TO MAMA!', tired: 1.2 },
      { kind: 'slam', weight: 2, cd: 6, range: [0, 12], say: 'BELLY FLOP!', tired: 1.0 },
    ],
    phases: [
      {
        at: 0.66, line: 'NOW MAMA IS ANGRY!', speedMul: 1.15, cdMul: 0.85,
        // Hun spiser en kyllinglår og får liv tilbake, om ingen slår henne mens hun spiser
        extra: [
          { kind: 'feast', weight: 3, cd: 13, heal: 0.12, say: 'SNACK TIME!' },
          { kind: 'summon', weight: 2, cd: 10, summon: ['hogman', 'skeleton'], count: 2, say: 'CHILDREN! DINNER TIME!' },
        ],
      },
      {
        at: 0.33, line: 'MAMA HAS HAD IT WITH ALL OF YOU!', speedMul: 1.35, cdMul: 0.65,
        stronger: { charge: { red: true, tired: 1.6 }, slam: { red: true, tired: 1.4 }, feast: { heal: 0.08 } },
      },
    ],
    intro: [['BIG MAMA HOGMOTHER', 'WHO HAS BEEN KILLING MY BABIES?'], ['NARRATOR', 'IT WAS YOU. IT WAS DEFINITELY YOU.']],
    death: 'TELL THE PIGLETS... TO EAT THEIR VEGETABLES...',
  },
  croakus: {
    id: 'croakus', char: 'croakus', name: 'KING CROAKUS', title: 'RULER OF THE SWAMP. ALSO A FROG.',
    hp: 480, speed: 2.2, stagger: 0.14,
    moves: [
      { kind: 'melee', weight: 3, cd: 1.3, range: [0, 2.5], attack: scepter },
      { kind: 'tongue', weight: 3, cd: 4, range: [3, 11], say: 'THLURP!' },
      { kind: 'leap', weight: 2, cd: 5, range: [2, 14], tired: 0.9 },
      { kind: 'shoot', weight: 2, cd: 4, range: [4, 16], proj: 'poison', count: 3, spread: 0.35 },
    ],
    phases: [
      {
        at: 0.66, line: 'YOU WILL CROAK FOR THIS!', speedMul: 1.15, cdMul: 0.85,
        // Han går under og kommer opp der skyggen hans er
        extra: [
          { kind: 'dive', weight: 3, cd: 7, say: 'ROYAL SWIM!', red: true, tired: 1.3 },
          { kind: 'summon', weight: 2, cd: 9, summon: ['frogman', 'zombie'], count: 2, say: 'ROYAL GUARD!' },
        ],
      },
      {
        at: 0.33, line: 'THE KING DOES NOT LOSE! THE KING TAKES A NAP!', speedMul: 1.3, cdMul: 0.65,
        stronger: { shoot: { count: 5, spread: 0.55 }, tongue: { red: true }, dive: { cd: 5 } },
      },
    ],
    intro: [['KING CROAKUS', 'WHO DARES DISTURB MY ROYAL NAP?'], ['KING CROAKUS', 'I WILL EAT YOU LIKE A FLY. A BIG, SWEATY FLY.']],
    death: 'RIBBIT... (THAT MEANS OUCH)',
  },
  magmor: {
    id: 'magmor', char: 'magmor', name: 'MAGMOR THE MOLTEN', title: 'HE IS MADE OF LAVA. DO NOT HUG.',
    hp: 560, speed: 1.7, stagger: 0.16,
    moves: [
      { kind: 'melee', weight: 3, cd: 1.4, range: [0, 2.8], attack: fist },
      { kind: 'slam', weight: 2, cd: 5, range: [0, 14], say: 'ERUPT!', tired: 1.1 },
      { kind: 'rain', weight: 2, cd: 7, proj: 'meteor', count: 6, say: 'RAIN OF FIRE!', tired: 1.0 },
      { kind: 'shoot', weight: 2, cd: 3.5, range: [4, 16], proj: 'fireball', count: 2, spread: 0.2 },
    ],
    phases: [
      // Lavaen renner i sporene hans og brenner den som går i dem
      { at: 0.66, line: 'I AM GETTING HOTTER!', speedMul: 1.1, cdMul: 0.8, trail: true, stronger: { rain: { count: 9 } } },
      {
        at: 0.33, line: 'THE MOUNTAIN IS ANGRY! THE MOUNTAIN IS ALSO SAD!', speedMul: 1.25, cdMul: 0.6, trail: true,
        stronger: { rain: { count: 12 }, slam: { red: true, tired: 1.5 }, shoot: { count: 4, spread: 0.4 } },
      },
    ],
    intro: [['MAGMOR THE MOLTEN', 'I AM THE MOUNTAIN. I AM THE FIRE.'], ['MAGMOR THE MOLTEN', 'I AM ALSO VERY LONELY. NOBODY WILL HOLD MY HAND.']],
    death: 'FINALLY... I CAN COOL DOWN...',
  },
  vorthax: {
    id: 'vorthax', char: 'vorthax', name: 'VORTHAX THE MODERATELY EVIL', title: 'SORCERER. KIDNAPPER. HOBBY BAKER.',
    hp: 520, speed: 2.4, stagger: 0.15,
    moves: [
      { kind: 'melee', weight: 2, cd: 1.2, range: [0, 2.3], attack: staff },
      { kind: 'teleport', weight: 3, cd: 3.5, range: [0, 30] },
      { kind: 'shoot', weight: 3, cd: 3, range: [3, 18], proj: 'bolt', count: 5, spread: 0.5 },
      { kind: 'rain', weight: 2, cd: 7, proj: 'lightning', count: 6, say: 'SKY ZAP!', tired: 1.0 },
      { kind: 'summon', weight: 1, cd: 12, summon: ['skeleton', 'darkcultist'], count: 2, say: 'MINIONS! EARN YOUR SALARY!' },
    ],
    phases: [
      {
        at: 0.66, line: 'BEHOLD MY MODERATE FORM!', speedMul: 1.15, cdMul: 0.8,
        // Kopier av ham selv. Bare den ekte kaster skygge
        extra: [{ kind: 'mirror', weight: 3, cd: 11, count: 2, say: 'WHICH ONE IS THE REAL ME? ONLY I KNOW!' }],
      },
      {
        at: 0.33, line: 'THE SUN HEART! I WAS SAVING IT FOR A SPECIAL OCCASION!', speedMul: 1.35, cdMul: 0.6, heart: true,
        extra: [
          { kind: 'beam', weight: 3, cd: 6, say: 'SOLAR FLARE!', red: true, tired: 1.5 },
          { kind: 'summon', weight: 1, cd: 14, summon: ['skelguard'], count: 2, rise: true, say: 'RISE AGAIN, YOU LAZY BONES!' },
        ],
        stronger: { rain: { count: 10 }, mirror: { count: 3 } },
      },
    ],
    intro: [['VORTHAX', 'SO. YOU MADE IT PAST THE MOTIVATIONAL POSTERS.'], ['PRINCESS AMBERLY', 'FINALLY. CAN SOMEBODY PLEASE DO SOMETHING.'], ['VORTHAX', 'PREPARE TO BE MODERATELY DESTROYED!']],
    death: 'CURSES! I WAS ONLY... MODERATELY... PREPARED...',
    // Hæren først (skjelettvaktene fra Golden Axe reiser seg av gulvet), så skjoldet og søylene
    finale: {
      guards: [
        { foes: ['skelguard', 'skelguard', 'skelguard'], line: 'RISE, MY GUARDS! SKELETAL, BUT LOYAL!' },
        { foes: ['skelguard', 'skelguard', 'darkcultist', 'hogguard'], line: 'MORE GUARDS! THE EXPENSIVE ONES!' },
      ],
      rise: 'ENOUGH! IF YOU WANT EVIL DONE RIGHT, DO IT YOURSELF!',
      pillar: 'MY PILLARS! THOSE WERE LOAD-BEARING!',
      broken: 'MY SHIELD! THAT WAS UNDER WARRANTY!',
      crushed: 'OW! MY EVERYTHING!',
    },
  },
};
