// Fiendetyper. En ny fiende = en figur i gfx/chars + en linje her.
import { P, ENEMY_ATK, type AttackDef } from '../game/attacks';
import type { Pose } from '../gfx/rig';
import type { ProjKind } from '../game/projectiles';

export type Behavior = 'melee' | 'brute' | 'ranged' | 'runner' | 'jumper' | 'shambler';

export interface FoeDef {
  id: string;
  char: string;
  name: string;
  hp: number;
  speed: number;
  gold: number;
  behavior: Behavior;
  attack: AttackDef;
  /** Angrep i lufta (hoppere). */
  air?: AttackDef;
  /** Ønsket avstand ved nærkamp. */
  range: number;
  proj?: ProjKind;
  projCd?: [number, number];
  tint?: [number, number, number];
  scale?: number;
  /**
   * Tåler så mye skade (andel av maks liv) før han vakler. Til da biter ikke slagene: han tar skaden, men blir
   * verken slått tilbake eller slått ned (kjemper som kjempetrollet).
   */
  poise?: number;
  /** Et grep han bruker av og til mot heltene i stedet for vanlig angrep (løfter og kaster, se AttackDef.grab). */
  grab?: AttackDef;
  /**
   * Tøff fiende som står imot grep til han vakler: rett etter et treff som rykket ham, når han er svimmel, eller når
   * han har under en tredjedel av livet igjen (se offBalance i game/grab.ts). Går helten inn i ham før det, blir
   * helten skjøvet unna. Fiender med poise står uansett imot til de vakler.
   */
  guard?: boolean;
  poseMod?: Partial<Pose>;
  barks: string[];
}

const claw: AttackDef = {
  id: 'claw', startup: 0.55, active: 0.12, recovery: 0.6, dmg: 9, reach: 1.5, zr: 0.7, height: 'mid', push: 2, stun: 0.4,
  wind: { armF: 2.4, armB: 2.2, torso: 0.2, head: 0.2 }, strike: { armF: 1.3, armB: 1.1, torso: -0.4, head: -0.1, bodyY: -0.08, bodyX: 0.2 },
  death: ['normal'], swoosh: 'none',
};
const spear: AttackDef = {
  id: 'spear', startup: 0.35, active: 0.12, recovery: 0.45, dmg: 8, reach: 1.9, zr: 0.6, height: 'mid', push: 2.5, stun: 0.35,
  wind: { armF: 0.6, weapon: -1.9, torso: 0.2, armB: -0.4 }, strike: { armF: 1.4, weapon: -2.9, torso: -0.3, legF: 0.6, legB: -0.5, bodyX: 0.25 },
  death: ['normal'], swoosh: 'side',
};
const frogLeap: AttackDef = {
  id: 'frogleap', startup: 0.05, active: 0.3, recovery: 0.2, dmg: 9, reach: 1.7, zr: 0.8, height: 'high', kd: true, launch: 4, push: 3, stun: 0.4, air: true,
  wind: P.jumpW, strike: { armF: 1.5, weapon: -3.0, torso: -0.4, legF: 0.2, legB: -0.6, bodyX: 0.2 }, death: ['normal'], swoosh: 'side',
};
const trollSmash: AttackDef = { ...ENEMY_ATK.hog, id: 'trollsmash', dmg: 16, reach: 2.2, startup: 0.75 };
// Kjempetrollet slår i bakken: langt opptrekk, lang rekkevidde, og bakken rister (quake i game/foes.ts)
const giantSlam: AttackDef = {
  ...ENEMY_ATK.hog, id: 'giantslam', dmg: 20, reach: 2.5, zr: 1.3, startup: 1.05, recovery: 1.0, launch: 8, push: 7, stun: 0.8, quake: 3.2,
  word: ['KRA-THOOM!', 'AVALANCHE!', 'BONK.'],
};
// Kjempetrollet griper en helt med den fjerne armen (den på forsiden av kroppen), holder ham opp og kaster ham langt
const giantGrab: AttackDef = {
  ...ENEMY_ATK.hog, id: 'giantgrab', dmg: 4, reach: 2.3, zr: 1.0, startup: 0.6, active: 0.16, recovery: 0.5, grab: true, kd: false, launch: 0, push: 0,
  heavy: false, wind: { armB: -0.6, armF: -0.3, torso: 0.35, head: 0.1 }, strike: { armB: 1.6, armF: 0.4, torso: -0.2, head: -0.05 }, word: [], swoosh: 'side',
};
const emberSlash: AttackDef = { ...ENEMY_ATK.skel, id: 'emberslash', dmg: 8, startup: 0.36 };
const ashSlash: AttackDef = { ...ENEMY_ATK.skel, id: 'ashslash', dmg: 9, reach: 1.85, startup: 0.32, recovery: 0.46 };
const wardenSmash: AttackDef = { ...ENEMY_ATK.hog, id: 'wardensmash', dmg: 16, reach: 2.1, startup: 0.85, recovery: 0.8 };

export const FOES: Record<string, FoeDef> = {
  skeleton: {
    id: 'skeleton', char: 'skeleton', name: 'SKELLY GRUNT', hp: 22, speed: 2.5, gold: 2, behavior: 'melee', attack: ENEMY_ATK.skel, range: 1.45,
    barks: ['RATTLE RATTLE!', 'FIRST DAY ON THE JOB!', 'I HAVE NO SKIN IN THIS GAME!', 'FOR VORTHAX! I THINK?', 'MY MOM SAYS I\'M SPOOKY!'],
  },
  hogman: {
    id: 'hogman', char: 'hogman', name: 'HOGMAN', hp: 70, speed: 1.7, gold: 6, behavior: 'brute', attack: ENEMY_ATK.hog, range: 1.7, guard: true,
    barks: ['OINK. I MEAN: DIE!', 'HOGMAN SMASH!', 'I SMELL BARBARIAN!', 'YOU LOOK LIKE LUNCH!'],
  },
  cultist: {
    id: 'cultist', char: 'cultist', name: 'CULTIST', hp: 30, speed: 2.3, gold: 3, behavior: 'ranged', attack: ENEMY_ATK.stab, range: 5.2, proj: 'dagger', projCd: [2.2, 3.2],
    barks: ['BY THE DARK ONE!', 'I\'M ONLY HERE FOR THE DENTAL PLAN!', 'THE ROBES WERE FREE!', 'HAIL VORTHAX! (MODERATELY)'],
  },
  gnome: {
    id: 'gnome', char: 'gnome', name: 'POTION GNOME', hp: 30, speed: 4.6, gold: 0, behavior: 'runner', attack: ENEMY_ATK.stab, range: 0,
    barks: ['NOT THE FACE!', 'THESE ARE MY POTIONS!', 'HELP! BARBARIANS!'],
  },
  zombie: {
    id: 'zombie', char: 'zombie', name: 'BOG ZOMBIE', hp: 34, speed: 1.35, gold: 2, behavior: 'shambler', attack: claw, range: 1.3,
    poseMod: { armF: 1.5, armB: 1.35, torso: -0.25, head: 0.25 },
    barks: ['BRAAAINS... OR SNACKS', 'MOIST...', 'I USED TO BE AN ACCOUNTANT', 'UUUUNGH. MONDAYS.'],
  },
  frogman: {
    id: 'frogman', char: 'frogman', name: 'FROGMAN', hp: 30, speed: 3.0, gold: 3, behavior: 'jumper', attack: spear, air: frogLeap, range: 1.7,
    barks: ['RIBBIT. PREPARE TO DIE.', 'FOR THE KING!', 'CROAK THIS!', 'I CAN LICK MY OWN EYEBALL'],
  },
  frostskel: {
    id: 'frostskel', char: 'skeleton', name: 'FROST SKELETON', hp: 26, speed: 2.6, gold: 3, behavior: 'melee', attack: ENEMY_ATK.skel, range: 1.45,
    tint: [0.75, 0.92, 1.4], barks: ['C-C-COLD...', 'MY MARROW IS FROZEN!', 'CHILL OUT, BARBARIAN!'],
  },
  troll: {
    id: 'troll', char: 'troll', name: 'ICE TROLL', hp: 95, speed: 1.6, gold: 8, behavior: 'brute', attack: trollSmash, range: 1.9, proj: 'snowball', projCd: [4, 6], guard: true,
    barks: ['TROLL HUNGRY!', 'YOU LOOK CRUNCHY!', 'ME HATE WINTER. ME HATE YOU MORE.'],
  },
  bigtroll: {
    id: 'bigtroll', char: 'bigtroll', name: 'AVALANCHE TROLL', hp: 320, speed: 1.25, gold: 25, behavior: 'brute', attack: giantSlam, range: 2.7,
    proj: 'snowball', projCd: [5, 8], poise: 0.14, grab: giantGrab,
    barks: ['ME NOT BIG. YOU SMALL.', 'MAMA CALL ME LITTLE BJORN!', 'ME SIT ON YOU. NOTHING PERSONAL.', 'WHO ORDERED BARBARIAN? ME ORDERED BARBARIAN.'],
  },
  fireimp: {
    id: 'fireimp', char: 'fireimp', name: 'FIRE IMP', hp: 24, speed: 3.3, gold: 3, behavior: 'ranged', attack: ENEMY_ATK.stab, range: 5.8, proj: 'fireball', projCd: [1.8, 2.8],
    barks: ['HOT HOT HOT!', 'I\'M ON FIRE! LITERALLY!', 'CATCH!'],
  },
  emberskel: {
    id: 'emberskel', char: 'skeleton', name: 'EMBER SKELETON', hp: 28, speed: 2.7, gold: 3, behavior: 'melee', attack: emberSlash, range: 1.45,
    tint: [1.4, 0.72, 0.5], barks: ['SMELLS LIKE BURNT BARBARIAN!', 'I\'M TOASTY!', 'EXTRA CRISPY!'],
  },
  ashraider: {
    id: 'ashraider', char: 'ashraider', name: 'ASH RAIDER', hp: 42, speed: 3.05, gold: 4, behavior: 'melee', attack: ashSlash, range: 1.35,
    barks: ['THE HEAT IS INCLUDED!', 'TWO BLADES. NO REFUNDS.', 'I WORKED THROUGH MY LUNCH RAID!'],
  },
  darkcultist: {
    id: 'darkcultist', char: 'cultist', name: 'DARK CULTIST', hp: 36, speed: 2.4, gold: 4, behavior: 'ranged', attack: ENEMY_ATK.stab, range: 6, proj: 'bolt', projCd: [2, 3],
    tint: [0.55, 0.45, 0.75], barks: ['THE MASTER SEES ALL!', 'I GOT PROMOTED!', 'SENIOR CULTIST, THANK YOU.'],
  },
  hogguard: {
    id: 'hogguard', char: 'hogman', name: 'HOG GUARD', hp: 85, speed: 1.8, gold: 8, behavior: 'brute', attack: { ...ENEMY_ATK.hog, id: 'hogguard', dmg: 15 }, range: 1.7, guard: true,
    tint: [0.78, 0.72, 1.05], barks: ['HALT! PAPERS, PLEASE!', 'NO BARBARIANS AFTER 9PM!', 'OINK OF DUTY!'],
  },
  ironwarden: {
    id: 'ironwarden', char: 'ironwarden', name: 'IRON WARDEN', hp: 92, speed: 1.5, gold: 9, behavior: 'brute', attack: wardenSmash, range: 1.6, poise: 0.18,
    barks: ['YOUR VISIT HAS BEEN DENIED.', 'DENTING THIS ARMOUR COSTS EXTRA.', 'THE HAMMER IS COMPANY PROPERTY.'],
  },
};

/** Når en fiende får panikk (grufulle drap i nærheten, lite liv, brann, METAL MODE). */
export const PANIC_BARKS = ['AAAAAAAH!', 'NOPE! NOPE! NOPE!', 'MOMMY!', 'I QUIT!', 'THIS WAS NOT IN THE BROCHURE!', 'EVERY MAN FOR HIMSELF!', 'I LEFT THE OVEN ON!', 'TELL VORTHAX I WAS SICK!', 'I HAVE CHILDREN! PROBABLY!'];

export const DEATH_BARKS = ['WORTH IT...', 'TELL MY WIFE... ACTUALLY DON\'T', 'I REGRET NOTHING... WAIT', 'MY SPLEEN!', 'NOT LIKE THIS!', 'I WAS TWO DAYS FROM RETIREMENT!'];
