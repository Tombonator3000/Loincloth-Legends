// Poser og angrepsdefinisjoner. Vinkler i radianer, figuren ser mot høyre.
// Figuren står i trekvart profil: våpenarmen (armF) sitter på den nære skulderen bak på kroppen, så i slagene strekkes
// den fram og figuren tar et lite steg inn (bodyX), ellers når sverdet kortere enn rekkevidden. Den andre armen (armB)
// sitter på forsiden og synes når vinkelen er positiv. Bladet peker framover når armF + weapon er rundt -1.6.
import type { Pose } from '../gfx/rig';

export type DeathStyle = 'decap' | 'explode' | 'bisect' | 'dismember' | 'headsplode' | 'legsoff' | 'shatter' | 'normal';
export type Height = 'high' | 'mid' | 'low';

export const P = {
  slashW: { armF: 2.5, weapon: -0.3, torso: 0.18, armB: -0.6, head: 0.1, legF: 0.3, legB: -0.3 },
  slashS: { armF: 1.3, weapon: -2.95, torso: -0.35, armB: 0.3, head: -0.1, legF: 0.45, legB: -0.35, bodyY: -0.08, bodyX: 0.3 },
  backW: { armF: -0.3, weapon: 1.2, torso: -0.2, armB: 0.2, legF: 0.4, legB: -0.3 },
  backS: { armF: 1.5, weapon: -2.7, torso: 0.12, armB: -0.5, head: 0.15, legF: 0.3, legB: -0.4, bodyX: 0.2 },
  chopW: { armF: 3.1, weapon: -0.5, armB: 2.6, torso: 0.3, head: 0.25, bodyY: 0.06, legF: 0.2, legB: -0.2 },
  chopS: { armF: 1.35, weapon: -3.05, armB: 0.5, torso: -0.5, head: -0.2, bodyY: -0.16, legF: 0.6, legB: -0.5, bodyX: 0.38 },
  jumpW: { armF: 2.8, weapon: -0.3, torso: 0.2, legF: 0.9, legB: 0.2 },
  jumpS: { armF: 1.2, weapon: -3.0, torso: -0.4, legF: 0.6, legB: -0.4, bodyX: 0.25 },
  dashS: { armF: 1.35, weapon: -2.85, torso: -0.6, armB: 1.2, head: -0.2, legF: 0.7, legB: -0.8 },
  spin: { armF: 1.57, weapon: -3.0, armB: -1.4, torso: -0.1, legF: 0.4, legB: -0.4 },
  hurt: { torso: 0.42, head: 0.35, armF: 1.1, armB: 0.7, weapon: 0.2, legF: 0.35, legB: -0.1, bodyX: -0.08 },
  jump: { legF: 0.9, legB: 0.35, armF: 1.2, armB: 0.8, torso: -0.1, weapon: -3.1 },
  fall: { legF: 0.5, legB: -0.3, armF: 2.4, armB: 1.3, torso: 0.2, weapon: -0.4 },
  tumble: { tilt: 1.0, legF: 0.9, legB: 0.2, armF: 2.4, armB: 2.0, torso: 0.3, head: 0.3, weapon: -1.0 },
  down: { tilt: 1.52, lift: 0.3, torso: 0.1, head: 0.2, armF: 2.6, armB: 2.2, legF: 0.3, legB: -0.1, weapon: -1.0 },
  getup: { tilt: 0.0, bodyY: -0.34, legF: 1.3, legB: -0.9, torso: -0.4, armF: 0.5, armB: 1.0, weapon: -2.0 },
  magic: { armF: 2.9, armB: 2.7, weapon: -0.5, head: 0.45, torso: 0.2 },
  victory: { armF: 3.0, weapon: -3.2, armB: 0.6, head: 0.3, torso: 0.1, legF: 0.3, legB: -0.3 },
  taunt: { armF: 2.4, weapon: -0.2, armB: 1.9, head: 0.4, torso: 0.2, legF: 0.35, legB: -0.35 },
  blockHi: { armF: 2.9, weapon: -3.2, armB: 1.6, torso: 0.1, head: -0.1, legF: 0.35, legB: -0.35 },
  blockLo: { armF: 0.8, weapon: -3.7, armB: 0.9, torso: -0.3, bodyY: -0.3, legF: 1.1, legB: -0.8, head: 0.1 },
  crouch: { armF: 0.9, weapon: -2.4, armB: 0.2, torso: -0.3, bodyY: -0.3, legF: 1.1, legB: -0.8, head: 0.1 },
  sweepW: { armF: 2.2, weapon: 0.0, bodyY: -0.3, legF: 1.1, legB: -0.8, torso: 0.2, armB: -0.4 },
  sweepS: { armF: 1.45, weapon: -3.4, torso: -0.5, bodyY: -0.4, legF: 1.3, legB: -1.0, armB: 0.6, bodyX: 0.38 },
  kickW: { legF: -0.3, torso: 0.15, armF: 0.8, weapon: -2.4 },
  kickS: { legF: 1.65, legB: -0.1, torso: 0.45, armF: 0.3, armB: 0.6, head: 0.2, bodyY: 0.02, weapon: -2.6 },
  neckW: { armF: 2.9, weapon: -0.4, torso: 0.3, legF: 0.9, legB: 0.2 },
  neckS: { armF: 1.6, weapon: -3.15, torso: -0.3, legF: 0.3, legB: -0.5, armB: -0.6, bodyX: 0.3 },
  throwW: { armF: 2.6, weapon: -0.2, torso: 0.25, armB: 0.8 },
  throwS: { armF: 1.2, weapon: -2.1, torso: -0.3, armB: -0.4 },
  roll: { legF: 1.9, legB: 1.7, armF: 1.2, armB: 1.0, torso: -0.9, head: -0.4, weapon: -1.6 },
  stunned: { torso: 0.25, head: 0.4, armF: 0.2, armB: 0.2, weapon: -3.0, legF: 0.15, legB: -0.25 },
  drag: { torso: -0.5, armF: -0.9, armB: -0.9, weapon: -1.0, legF: 0.6, legB: -0.6 },
} satisfies Record<string, Partial<Pose>>;

/**
 * Tillegg for figurer som bøyer albuer og knær (CharDef.bend, heltene): legges oppå stillingen med samme navn i P.
 * Albuen spennes i oppslaget og strekkes i slaget, vekten ligger på bakre kne før slaget og på fremre kne når det
 * lander, og i huk står leggen loddrett og bakre kne nesten nede. Våpenet følger neven, men bladet peker dit
 * armF + weapon sier, så våpenvinklene i P virker likt med og uten bøy. Kroppens høyde regnes fra beina
 * (Rig.plant), så bodyY trengs ikke her. Figurer uten bend bruker P som før.
 */
export const PB: { [K in keyof typeof P]?: Partial<Pose> } = {
  slashW: { elbowF: 1.1, elbowB: 0.5, kneeF: 0.15, kneeB: 0.45 },
  slashS: { elbowF: 0.05, elbowB: 0.6, legF: 0.6, kneeF: 0.55, legB: -0.45, kneeB: 0.1 },
  backW: { armF: -0.5, elbowF: 1.4, elbowB: 0.6, kneeF: 0.2, kneeB: 0.4 },
  backS: { elbowF: 0.1, elbowB: 0.5, legF: 0.45, kneeF: 0.45, kneeB: 0.15 },
  chopW: { elbowF: 0.45, elbowB: 0.9, kneeF: 0.25, kneeB: 0.2 },
  chopS: { elbowF: 0.05, elbowB: 0.3, legF: 0.75, kneeF: 0.85, legB: -0.55, kneeB: 0.15 },
  jumpW: { elbowF: 0.9, kneeF: 1.3, kneeB: 1.1 },
  jumpS: { elbowF: 0.1, kneeF: 0.9, kneeB: 0.7 },
  dashS: { elbowF: 0.3, elbowB: 1.3, kneeF: 0.6, kneeB: 0.1 },
  spin: { elbowF: 0.05, elbowB: 0.1, kneeF: 0.35, kneeB: 0.35 },
  hurt: { elbowF: 0.5, elbowB: 0.9, kneeF: 0.5, kneeB: 0.6 },
  jump: { kneeF: 1.4, kneeB: 1.2, elbowF: 0.4, elbowB: 0.9 },
  fall: { kneeF: 0.5, kneeB: 0.4, elbowF: 0.4, elbowB: 0.6 },
  tumble: { kneeF: 0.8, kneeB: 0.5, elbowF: 0.4, elbowB: 0.6 },
  down: { kneeF: 0.35, kneeB: 0.15, elbowF: 0.3, elbowB: 0.5 },
  getup: { legF: 1.2, kneeF: 1.3, legB: -0.2, kneeB: 1.5, elbowF: 0.4, elbowB: 0.8 },
  magic: { elbowF: 0.3, elbowB: 0.4, kneeF: 0.15, kneeB: 0.2 },
  // Seiersposen: sverdet i været og den andre armen spent som en biceps
  victory: { elbowF: 0.15, armB: 1.5, elbowB: 2.1, kneeF: 0.2, kneeB: 0.25 },
  // Hånet: begge bicepsene spent
  taunt: { armF: 1.65, elbowF: 2.2, weapon: -1.4, armB: 1.6, elbowB: 2.2, kneeF: 0.2, kneeB: 0.25 },
  blockHi: { elbowF: 0.4, elbowB: 1.2, kneeF: 0.25, kneeB: 0.3 },
  blockLo: { elbowF: 0.3, elbowB: 0.8, legF: 0.9, kneeF: 1.2, legB: -0.3, kneeB: 1.2 },
  crouch: { elbowF: 0.4, elbowB: 0.7, legF: 0.9, kneeF: 1.3, legB: -0.3, kneeB: 1.4 },
  sweepW: { elbowF: 0.9, elbowB: 0.3, legF: 0.9, kneeF: 1.3, legB: -0.3, kneeB: 1.4 },
  sweepS: { elbowF: 0.05, elbowB: 0.5, legF: 1.1, kneeF: 1.0, legB: -0.5, kneeB: 1.4 },
  // Sparket: kneet trekkes opp før foten skytes ut
  kickW: { legF: 0.9, kneeF: 1.7, kneeB: 0.25, elbowF: 0.4 },
  kickS: { kneeF: 0, kneeB: 0.25, elbowF: 0.4, elbowB: 0.8 },
  neckW: { elbowF: 0.9, kneeF: 1.3, kneeB: 1.0 },
  neckS: { elbowF: 0.05, kneeF: 0.6, kneeB: 0.5, elbowB: 0.3 },
  throwW: { elbowF: 1.0, elbowB: 0.5, kneeB: 0.3 },
  throwS: { elbowF: 0.1, elbowB: 0.3, kneeF: 0.4 },
  roll: { kneeF: 2.0, kneeB: 2.0, elbowF: 1.2, elbowB: 1.4 },
  stunned: { elbowF: 0.15, elbowB: 0.2, kneeF: 0.35, kneeB: 0.45 },
  drag: { kneeF: 0.4, kneeB: 0.4 },
};

const BENT = new Map<Partial<Pose>, Partial<Pose>>(Object.entries(PB).map(([k, v]) => [P[k as keyof typeof P], v!]));

/** Stillingen med tillegget for bøyde albuer og knær (PB) når figuren har bend. Andre stillinger kommer tilbake som de er. */
export function bentPose(pose: Partial<Pose>, bend: boolean | undefined): Partial<Pose> {
  const o = bend ? BENT.get(pose) : undefined;
  return o ? { ...pose, ...o } : pose;
}

export interface AttackDef {
  id: string;
  startup: number;
  active: number;
  recovery: number;
  dmg: number;
  reach: number;
  back?: number;
  zr: number;
  height: Height;
  kd?: boolean;
  launch?: number;
  push: number;
  stun: number;
  hits?: number;
  guardBreak?: boolean;
  decap?: boolean;
  lunge?: number;
  air?: boolean;
  heavy?: boolean;
  armor?: boolean;
  /** Slaget ryster bakken i denne radiusen når det treffer bakken: støv og snø, risting og en sjokkbølge. */
  quake?: number;
  /** Et grep (kjempen): den som treffes, løftes i neven i stedet for å slås tilbake, og kastes etterpå (game/foes.ts). */
  grab?: boolean;
  spin?: boolean;
  hpCost?: number;
  projectile?: boolean;
  wind: Partial<Pose>;
  strike: Partial<Pose>;
  death: DeathStyle[];
  swoosh?: 'over' | 'side' | 'under' | 'spin' | 'none';
  word?: string[];
}

const A = (a: AttackDef) => a;

// ---------------------------------------------------------------- brawler (helter)
export const HERO_ATK = {
  slash1: A({ id: 'slash1', startup: 0.07, active: 0.09, recovery: 0.16, dmg: 8, reach: 2.0, zr: 0.8, height: 'mid', push: 1.2, stun: 0.34, wind: P.slashW, strike: P.slashS, death: ['decap', 'decap', 'bisect', 'dismember', 'normal'], swoosh: 'over' }),
  slash2: A({ id: 'slash2', startup: 0.06, active: 0.09, recovery: 0.16, dmg: 8, reach: 2.0, zr: 0.8, height: 'mid', push: 1.2, stun: 0.34, wind: P.backW, strike: P.backS, death: ['decap', 'bisect', 'dismember'], swoosh: 'under' }),
  chop: A({ id: 'chop', startup: 0.15, active: 0.1, recovery: 0.3, dmg: 16, reach: 2.15, zr: 0.9, height: 'high', kd: true, launch: 6.5, push: 5, stun: 0.6, heavy: true, lunge: 2.5, wind: P.chopW, strike: P.chopS, death: ['headsplode', 'bisect', 'explode', 'decap'], swoosh: 'over', word: ['CHOP!', 'THWACK!', 'KRUNCH!'] }),
  jump: A({ id: 'jump', startup: 0.05, active: 0.22, recovery: 0.08, dmg: 12, reach: 2.0, zr: 0.9, height: 'high', kd: true, launch: 4, push: 4, stun: 0.5, air: true, wind: P.jumpW, strike: P.jumpS, death: ['explode', 'headsplode', 'bisect'], swoosh: 'over', word: ['SPLAT!', 'SQUELCH!'] }),
  dash: A({ id: 'dash', startup: 0.03, active: 0.3, recovery: 0.25, dmg: 10, reach: 1.3, back: 0.2, zr: 0.9, height: 'mid', kd: true, launch: 5, push: 7, stun: 0.5, lunge: 9, guardBreak: true, wind: P.dashS, strike: P.dashS, death: ['explode', 'dismember'], swoosh: 'none', word: ['BONK!', 'OOF!'] }),
  spin: A({ id: 'spin', startup: 0.08, active: 0.48, recovery: 0.25, dmg: 7, hits: 3, reach: 2.2, back: 2.2, zr: 1.0, height: 'mid', kd: true, launch: 5, push: 5, stun: 0.5, spin: true, hpCost: 6, wind: P.spin, strike: P.spin, death: ['dismember', 'bisect', 'decap'], swoosh: 'spin' }),
};

// ---------------------------------------------------------------- brawler (fiender)
export const ENEMY_ATK = {
  skel: A({ id: 'skel', startup: 0.4, active: 0.1, recovery: 0.5, dmg: 6, reach: 1.65, zr: 0.6, height: 'mid', push: 2, stun: 0.35, wind: P.slashW, strike: P.slashS, death: ['normal'], swoosh: 'over' }),
  hog: A({ id: 'hog', startup: 0.7, active: 0.12, recovery: 0.7, dmg: 14, reach: 2.0, zr: 0.7, height: 'high', kd: true, launch: 6, push: 5, stun: 0.6, heavy: true, armor: true, wind: P.chopW, strike: P.chopS, death: ['normal'], swoosh: 'over' }),
  stab: A({ id: 'stab', startup: 0.3, active: 0.1, recovery: 0.5, dmg: 6, reach: 1.35, zr: 0.6, height: 'mid', push: 1.5, stun: 0.3, wind: P.backW, strike: P.backS, death: ['normal'], swoosh: 'under' }),
  throw: A({ id: 'throw', startup: 0.45, active: 0.05, recovery: 0.6, dmg: 0, reach: 0, zr: 0, height: 'mid', push: 0, stun: 0, projectile: true, wind: P.throwW, strike: P.throwS, death: ['normal'], swoosh: 'none' }),
};

// ---------------------------------------------------------------- duell
export const DUEL_ATK = {
  slash: A({ id: 'slash', startup: 0.14, active: 0.1, recovery: 0.24, dmg: 10, reach: 2.05, zr: 2, height: 'mid', push: 1.6, stun: 0.36, wind: P.slashW, strike: P.slashS, death: ['bisect'], swoosh: 'side' }),
  over: A({ id: 'over', startup: 0.32, active: 0.1, recovery: 0.38, dmg: 18, reach: 1.95, zr: 2, height: 'high', push: 2.5, stun: 0.5, heavy: true, wind: P.chopW, strike: P.chopS, death: ['headsplode'], swoosh: 'over', word: ['CRUNCH!'] }),
  sweep: A({ id: 'sweep', startup: 0.2, active: 0.12, recovery: 0.34, dmg: 9, reach: 2.15, zr: 2, height: 'low', kd: true, launch: 3, push: 1.5, stun: 0.5, wind: P.sweepW, strike: P.sweepS, death: ['legsoff'], swoosh: 'under' }),
  kick: A({ id: 'kick', startup: 0.1, active: 0.08, recovery: 0.26, dmg: 5, reach: 1.3, zr: 2, height: 'mid', guardBreak: true, push: 3.5, stun: 0.55, wind: P.kickW, strike: P.kickS, death: ['explode'], swoosh: 'none', word: ['BOOT!'] }),
  whirl: A({ id: 'whirl', startup: 0.16, active: 0.5, recovery: 0.45, dmg: 5, hits: 3, reach: 2.0, back: 1.0, zr: 2, height: 'mid', push: 1.2, stun: 0.3, spin: true, wind: P.spin, strike: P.spin, death: ['dismember'], swoosh: 'spin' }),
  neck: A({ id: 'neck', startup: 0.08, active: 0.16, recovery: 0.5, dmg: 22, reach: 2.15, zr: 2, height: 'high', decap: true, push: 3, stun: 0.5, air: true, wind: P.neckW, strike: P.neckS, death: ['decap'], swoosh: 'side' }),
};

export const DEATH_WORDS: Record<DeathStyle, string[]> = {
  decap: ['HEAD REMOVED!', 'DECAPITATED!', 'HE WON\'T NEED THAT'],
  explode: ['GIBBED!', 'EXCESSIVE!', 'WET!'],
  bisect: ['CUT IN HALF!', 'HALF THE MAN!', 'BISECTED!'],
  dismember: ['DISARMED!', 'LIMBS OPTIONAL!', 'SHISH KEBAB!'],
  headsplode: ['HEADSPLODE!', 'SKULL SMOOTHIE!', 'MIND BLOWN!'],
  legsoff: ['LEGLESS!', 'SHORTENED!', 'NO LEG TO STAND ON!'],
  shatter: ['BONE APART!', 'SHATTERED!', 'RATTLED!'],
  normal: ['SLAIN!', 'DEAD!', 'OUCH!'],
};
