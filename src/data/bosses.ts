// Sjefer på slutten av brettene. Oppførselen settes sammen av trekk (moves) med vekt og nedkjøling.
import { P, type AttackDef } from '../game/attacks';
import type { ProjKind } from '../game/projectiles';

export type BossMoveKind = 'melee' | 'charge' | 'slam' | 'leap' | 'shoot' | 'summon' | 'teleport' | 'tongue' | 'rain';

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
  say?: string;
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
  enrage: { at: number; speedMul: number; cdMul: number; extra: BossMove[]; line: string };
  intro: [string, string][];
  death: string;
  /** Andel av maks HP som gir stagger (ellers er sjefen urokkelig). */
  stagger: number;
}

const big = (a: Partial<AttackDef> & Pick<AttackDef, 'id' | 'wind' | 'strike'>): AttackDef => ({
  startup: 0.6, active: 0.14, recovery: 0.7, dmg: 16, reach: 2.6, zr: 1.1, height: 'high', kd: true, launch: 6, push: 6, stun: 0.6,
  heavy: true, armor: true, death: ['explode'], swoosh: 'over', ...a,
});

const cleaver = big({ id: 'cleaver', wind: P.chopW, strike: P.chopS, dmg: 18, word: ['CHOP!'] });
const belly = big({ id: 'belly', wind: { torso: 0.4, armF: 2.6, armB: 2.4, bodyY: 0.1 }, strike: { torso: -0.6, armF: 0.4, armB: 0.2, bodyY: -0.2 }, dmg: 14, reach: 2.2, swoosh: 'none' });
const scepter = big({ id: 'scepter', wind: P.chopW, strike: P.chopS, dmg: 15, reach: 2.4 });
const fist = big({ id: 'fist', wind: { armF: 3.0, armB: 2.6, torso: 0.3 }, strike: { armF: 0.4, armB: 0.3, torso: -0.5, bodyY: -0.2 }, dmg: 20, reach: 2.6, swoosh: 'none', word: ['CRUNCH!'] });
const staff = big({ id: 'staff', startup: 0.35, wind: P.chopW, strike: P.chopS, dmg: 14, reach: 2.2, kd: false, launch: 0, push: 3 });

export const BOSSES: Record<string, BossDef> = {
  hogmother: {
    id: 'hogmother', char: 'hogmother', name: 'BIG MAMA HOGMOTHER', title: 'SHE RAISED 400 PIGLETS. YOU KILLED MOST OF THEM.',
    hp: 420, speed: 2.0, stagger: 0.14,
    moves: [
      { kind: 'melee', weight: 4, cd: 1.2, range: [0, 2.6], attack: cleaver },
      { kind: 'charge', weight: 2, cd: 5, range: [3, 20], say: 'COME TO MAMA!' },
      { kind: 'slam', weight: 2, cd: 6, range: [0, 12], say: 'BELLY FLOP!' },
    ],
    enrage: { at: 0.5, speedMul: 1.3, cdMul: 0.7, line: 'NOW MAMA IS ANGRY!', extra: [{ kind: 'summon', weight: 2, cd: 10, summon: ['hogman', 'skeleton'], count: 2, say: 'CHILDREN! DINNER TIME!' }] },
    intro: [['BIG MAMA HOGMOTHER', 'WHO HAS BEEN KILLING MY BABIES?'], ['NARRATOR', 'IT WAS YOU. IT WAS DEFINITELY YOU.']],
    death: 'TELL THE PIGLETS... TO EAT THEIR VEGETABLES...',
  },
  croakus: {
    id: 'croakus', char: 'croakus', name: 'KING CROAKUS', title: 'RULER OF THE SWAMP. ALSO A FROG.',
    hp: 480, speed: 2.2, stagger: 0.14,
    moves: [
      { kind: 'melee', weight: 3, cd: 1.3, range: [0, 2.5], attack: scepter },
      { kind: 'tongue', weight: 3, cd: 4, range: [3, 11], say: 'THLURP!' },
      { kind: 'leap', weight: 2, cd: 5, range: [2, 14] },
      { kind: 'shoot', weight: 2, cd: 4, range: [4, 16], proj: 'poison', count: 3, spread: 0.35 },
    ],
    enrage: { at: 0.5, speedMul: 1.25, cdMul: 0.7, line: 'YOU WILL CROAK FOR THIS!', extra: [{ kind: 'summon', weight: 2, cd: 9, summon: ['frogman', 'zombie'], count: 2, say: 'ROYAL GUARD!' }] },
    intro: [['KING CROAKUS', 'WHO DARES DISTURB MY ROYAL NAP?'], ['KING CROAKUS', 'I WILL EAT YOU LIKE A FLY. A BIG, SWEATY FLY.']],
    death: 'RIBBIT... (THAT MEANS OUCH)',
  },
  magmor: {
    id: 'magmor', char: 'magmor', name: 'MAGMOR THE MOLTEN', title: 'HE IS MADE OF LAVA. DO NOT HUG.',
    hp: 560, speed: 1.7, stagger: 0.16,
    moves: [
      { kind: 'melee', weight: 3, cd: 1.4, range: [0, 2.8], attack: fist },
      { kind: 'slam', weight: 2, cd: 5, range: [0, 14], say: 'ERUPT!' },
      { kind: 'rain', weight: 2, cd: 7, proj: 'meteor', count: 6, say: 'RAIN OF FIRE!' },
      { kind: 'shoot', weight: 2, cd: 3.5, range: [4, 16], proj: 'fireball', count: 2, spread: 0.2 },
    ],
    enrage: { at: 0.45, speedMul: 1.2, cdMul: 0.65, line: 'I AM GETTING HOTTER!', extra: [{ kind: 'rain', weight: 3, cd: 5, proj: 'meteor', count: 10 }] },
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
      { kind: 'rain', weight: 2, cd: 7, proj: 'lightning', count: 6, say: 'SKY ZAP!' },
      { kind: 'summon', weight: 1, cd: 12, summon: ['skeleton', 'darkcultist'], count: 2, say: 'MINIONS! EARN YOUR SALARY!' },
    ],
    enrage: { at: 0.5, speedMul: 1.35, cdMul: 0.6, line: 'BEHOLD MY MODERATE FORM!', extra: [{ kind: 'rain', weight: 3, cd: 5, proj: 'lightning', count: 10 }] },
    intro: [['VORTHAX', 'SO. YOU MADE IT PAST THE MOTIVATIONAL POSTERS.'], ['PRINCESS AMBERLY', 'FINALLY. CAN SOMEBODY PLEASE DO SOMETHING.'], ['VORTHAX', 'PREPARE TO BE MODERATELY DESTROYED!']],
    death: 'CURSES! I WAS ONLY... MODERATELY... PREPARED...',
  },
};
