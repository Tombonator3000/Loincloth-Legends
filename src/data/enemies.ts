// Fiendetyper. En ny fiende = en figur i gfx/chars + en linje her.
import { P, ENEMY_ATK, type AttackDef, type DeathStyle } from '../game/attacks';
import type { Pose } from '../gfx/rig';
import type { ProjKind } from '../game/projectiles';

export type Behavior = 'melee' | 'brute' | 'ranged' | 'runner' | 'jumper' | 'shambler' | 'archer' | 'captain';

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
  /**
   * Bærer en dør som skjold (runde E): slag forfra preller av. Tredje slag i komboen, hoppslag, stormløp, kast, magi og
   * slag bakfra går gjennom (se applyHit i game/combat.ts).
   */
  shield?: boolean;
  /** Rang i bølgebudsjettet (runde E): vanlig 1, sterk 2, elite 4. Uten rang regnes den ut (foeRank). */
  rank?: number;
  /** Gjemmer seg i buskene bak veien og hopper ut (froskemannen i bakhold, side 'B' i bølgene). */
  ambush?: boolean;
  /** Griperen: holder helten så mange sekunder for vennene sine i stedet for å kaste ham. */
  hold?: number;
  /** Berserkeren: under denne andelen av livet blir berserkeren raskere og tøffere. */
  berserk?: number;
  /** Kapteinen: hvem han blåser inn i hornet etter. */
  horn?: string[];
  /**
   * Smeller i en liten ildkule når han dør (ildimpene): alle innen r (fiender og helter) tar fyr i burn sekunder.
   * Brannen er den samme som fra glørne (Fighter.burnT, Stage.ignite).
   */
  burst?: { r: number; burn: number };
  /** Dør alltid slik (kjempetrollet sprenges, uansett hva som tar ham). */
  death?: DeathStyle;
  /** Det regner blod over hele bildet når han sprenges, og en gnom kommer med paraply (game/mayhem.ts). */
  bloodRain?: boolean;
  /** Udød (skjeletter og zombier): smuldrer av TURN UNDEAD i stedet for å bli blendet (game/spells.ts). */
  undead?: boolean;
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
/** Griperen tar tak og holder (rødt blink før grepet, game/foes.ts). */
const bearHug: AttackDef = {
  ...ENEMY_ATK.hog, id: 'bearhug', startup: 0.8, active: 0.12, recovery: 0.5, dmg: 4, reach: 1.45, zr: 0.6, kd: false, launch: 0, push: 0, stun: 0.3,
  grab: true, tell: 'red', heavy: false, armor: false, wind: { armF: 1.6, armB: 1.5, torso: 0.25, head: 0.1 }, strike: { armF: 1.1, armB: 1.0, torso: -0.3, bodyX: 0.2 },
  word: ['GOTCHA!'],
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
    id: 'skeleton', char: 'skeleton', name: 'SKELLY GRUNT', undead: true, hp: 22, speed: 2.5, gold: 2, behavior: 'melee', attack: ENEMY_ATK.skel, range: 1.45,
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
    id: 'zombie', char: 'zombie', name: 'BOG ZOMBIE', undead: true, hp: 34, speed: 1.35, gold: 2, behavior: 'shambler', attack: claw, range: 1.3,
    poseMod: { armF: 1.5, armB: 1.35, torso: -0.25, head: 0.25 },
    barks: ['BRAAAINS... OR SNACKS', 'MOIST...', 'I USED TO BE AN ACCOUNTANT', 'UUUUNGH. MONDAYS.'],
  },
  frogman: {
    id: 'frogman', char: 'frogman', name: 'FROGMAN', hp: 30, speed: 3.0, gold: 3, behavior: 'jumper', attack: spear, air: frogLeap, range: 1.7,
    barks: ['RIBBIT. PREPARE TO DIE.', 'FOR THE KING!', 'CROAK THIS!', 'I CAN LICK MY OWN EYEBALL'],
  },
  frostskel: {
    id: 'frostskel', char: 'skeleton', name: 'FROST SKELETON', undead: true, hp: 26, speed: 2.6, gold: 3, behavior: 'melee', attack: ENEMY_ATK.skel, range: 1.45,
    tint: [0.75, 0.92, 1.4], barks: ['C-C-COLD...', 'MY MARROW IS FROZEN!', 'CHILL OUT, BARBARIAN!'],
  },
  troll: {
    id: 'troll', char: 'troll', name: 'ICE TROLL', hp: 95, speed: 1.6, gold: 8, behavior: 'brute', attack: trollSmash, range: 1.9, proj: 'snowball', projCd: [4, 6], guard: true,
    barks: ['TROLL HUNGRY!', 'YOU LOOK CRUNCHY!', 'ME HATE WINTER. ME HATE YOU MORE.'],
  },
  bigtroll: {
    id: 'bigtroll', char: 'bigtroll', name: 'AVALANCHE TROLL', hp: 320, speed: 1.25, gold: 25, behavior: 'brute', attack: giantSlam, range: 2.7,
    proj: 'snowball', projCd: [5, 8], poise: 0.14, grab: giantGrab, death: 'explode', bloodRain: true,
    barks: ['ME NOT BIG. YOU SMALL.', 'MAMA CALL ME LITTLE BJORN!', 'ME SIT ON YOU. NOTHING PERSONAL.', 'WHO ORDERED BARBARIAN? ME ORDERED BARBARIAN.'],
  },
  fireimp: {
    id: 'fireimp', char: 'fireimp', name: 'FIRE IMP', hp: 24, speed: 3.3, gold: 3, behavior: 'ranged', attack: ENEMY_ATK.stab, range: 5.8, proj: 'fireball', projCd: [1.8, 2.8],
    burst: { r: 2.3, burn: 3.5 },
    barks: ['HOT HOT HOT!', 'I\'M ON FIRE! LITERALLY!', 'CATCH!'],
  },
  emberskel: {
    id: 'emberskel', char: 'skeleton', name: 'EMBER SKELETON', undead: true, hp: 28, speed: 2.7, gold: 3, behavior: 'melee', attack: emberSlash, range: 1.45,
    tint: [1.4, 0.72, 0.5], barks: ['SMELLS LIKE BURNT BARBARIAN!', 'I\'M TOASTY!', 'EXTRA CRISPY!'],
  },
  // Jungelen: gamle tempelvakter grodd til med mose, og tyver som plyndrer Soltempelet for Vorthax
  mossskel: {
    id: 'mossskel', char: 'skeleton', name: 'MOSSY SKELETON', undead: true, hp: 26, speed: 2.6, gold: 3, behavior: 'melee', attack: ENEMY_ATK.skel, range: 1.45,
    tint: [0.72, 0.95, 0.6], barks: ['EIGHT HUNDRED YEARS ON GUARD DUTY!', 'NOBODY TOLD ME THE TEMPLE WAS ROBBED!', 'MOSS IS A LIFESTYLE!'],
  },
  templethief: {
    id: 'templethief', char: 'cultist', name: 'TEMPLE THIEF', hp: 32, speed: 2.5, gold: 5, behavior: 'ranged', attack: ENEMY_ATK.stab, range: 5.4, proj: 'dagger', projCd: [2.2, 3.2],
    tint: [1.15, 0.98, 0.6], barks: ['THIS GOLD IS FOR VORTHAX! MOSTLY!', 'I HAVE A RECEIPT!', 'FINDERS KEEPERS!'],
  },
  ashraider: {
    id: 'ashraider', char: 'ashraider', name: 'ASH RAIDER', hp: 42, speed: 3.05, gold: 4, behavior: 'melee', attack: ashSlash, range: 1.35,
    barks: ['THE HEAT IS INCLUDED!', 'TWO BLADES. NO REFUNDS.', 'I WORKED THROUGH MY LUNCH RAID!'],
  },
  // Runde E (docs/PLAN_BRETT_GORR_AI.md 6.4 punkt 2): nye fiendetyper, hver med en vane å straffe.
  // Bueskytteren holder avstand og skyter langs linja (ikke stå på linje med ham), men er svak på nært hold
  goblinarcher: {
    id: 'goblinarcher', char: 'imp', name: 'GOBLIN ARCHER', hp: 20, speed: 2.7, gold: 3, behavior: 'archer', attack: { ...ENEMY_ATK.stab, id: 'goblinpoke', dmg: 3, reach: 1.1 }, range: 7, proj: 'arrow', projCd: [1.5, 2.3],
    tint: [0.85, 1.05, 0.8], barks: ['PEW PEW!', 'HOLD STILL!', 'I NEVER MISS! MOSTLY!'],
  },
  // Froskemannen i bakhold gjemmer seg i buskene bak veien og hopper ut og slår helten ned fra lufta
  ambushfrog: {
    id: 'ambushfrog', char: 'frogman', name: 'AMBUSH FROGMAN', hp: 30, speed: 3.0, gold: 3, behavior: 'jumper', attack: spear, air: frogLeap, range: 1.6, ambush: true,
    tint: [0.78, 1.0, 0.68], barks: ['SURPRISE!', 'I WAS IN THE BUSH THE WHOLE TIME!', 'RIBBIT OF DOOM!'],
  },
  // Griperen holder helten fast for vennene sine (rødt blink før grepet). Slå på angrep for å vri deg løs
  grabber: {
    id: 'grabber', char: 'hogman', name: 'GRABBER', hp: 60, speed: 2.3, gold: 5, behavior: 'melee', attack: ENEMY_ATK.hog, range: 1.15, grab: bearHug, hold: 1.8,
    tint: [1.05, 0.82, 0.8], barks: ['HUG TIME!', 'I GOT ONE! HIT IT!', 'HOLD STILL, MUSCLES!'],
  },
  // Berserkeren (en askeraider) blir raskere og tøffere når livet er lavt
  berserker: {
    id: 'berserker', char: 'ashraider', name: 'BERSERKER', hp: 48, speed: 2.8, gold: 5, behavior: 'melee', attack: ashSlash, range: 1.35, berserk: 0.4,
    tint: [1.15, 0.86, 0.8], barks: ['BLOOD! MORE BLOOD!', 'I FEEL NO PAIN! OW!', 'RAAAARGH!'],
  },
  // Den feige kapteinen står bakerst, blåser i horn etter forsterkninger og roper ordre. Ta ham først
  captain: {
    id: 'captain', char: 'cultist', name: 'COWARD CAPTAIN', hp: 40, speed: 2.5, gold: 12, behavior: 'captain', attack: ENEMY_ATK.stab, range: 1.4, horn: ['skeleton', 'hogman'],
    tint: [1.15, 0.98, 0.62], scale: 1.05, barks: ['FLANK THE OILY ONE!', 'CHARGE! NOT ME, YOU!', 'I AM VERY IMPORTANT!'],
  },
  // Skjelettvaktene i tårnet (runde E): reiser seg av gulvet i tronsalen, med en dør som skjold
  skelguard: {
    id: 'skelguard', char: 'skeleton', name: 'SKELETON GUARD', undead: true, hp: 34, speed: 2.3, gold: 4, behavior: 'melee', attack: ENEMY_ATK.skel, range: 1.45, shield: true,
    tint: [0.86, 0.84, 0.98], barks: ['HALT! WHO GOES THERE?', 'THIS DOOR IS MY SHIELD NOW!', 'I GUARD. THAT IS ALL I DO.'],
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

/**
 * Kapteinen (runde E, game/foes.ts): ordrene han roper, det han sier når ingen kommer på hornet, svarene fra troppene,
 * og det troppene roper når han er død og de flykter.
 */
export const CAPTAIN = {
  orders: ['FLANK THE OILY ONE!', 'SURROUND THEM!', 'CHARGE! NOT ME, YOU!', 'ATTACK! I WILL SUPERVISE!'],
  nobody: ['NOBODY? REALLY?', 'HELLO? ANYONE?', 'I AM DOCKING YOUR PAY!'],
  yes: ['YES, SIR!', 'ON IT!', 'WHY ME?'],
  down: ['THE CAPTAIN IS DOWN! RUN!', 'WHO IS IN CHARGE NOW?', 'NO MORE ORDERS! FREEDOM!'],
};

/** En fiende som setter seg opp på et ledig ridedyr (runde E). */
export const MOUNT_BARKS = ['MINE NOW!', 'NICE RIDE!', 'FINDERS KEEPERS!', 'GIDDY UP!'];

/**
 * Rangen en fiende har i bølgebudsjettet (runde E, docs/PLAN_BRETT_GORR_AI.md 6.4 punkt 1): tyver på flukt teller
 * ikke, kjemper (poise) er elite (4), tøffe, skjoldbærere og de som griper er sterke (2), resten vanlige (1).
 */
export function foeRank(d: FoeDef) {
  if (d.rank !== undefined) return d.rank;
  if (d.behavior === 'runner') return 0;
  if (d.poise) return 4;
  if (d.guard || d.shield || d.grab || d.hp >= 60) return 2;
  return 1;
}
