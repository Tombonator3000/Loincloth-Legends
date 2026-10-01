// Heltebyggeren: setter sammen en figur fra valgte deler (kropp, ansikt, hår, skjegg, hjelm, rustning, våpen).
import { Pen, INK, shade, blobPath, polyPath } from '../draw';
import { HERO_BIG_J, HERO_HIP_Y, HEAD_SCALE, TORSO_Y, skinD, type CharDef, type PartDef } from './types';
import { maleChest, femChest, maleTorsoPath, muscleArm, muscleLeg, tinyLoins, scalePart, stretchY, type TopKind, type Shoulder, type Footwear, type Loins } from './muscle';
import { HERO_PARTS, HERO_PART_SLOTS, defaultHeroParts, findHeroPart, sanitizeHeroParts, type HeroParts } from '../../data/hero-parts';
import { HERO_APPEARANCE_KEYS, sanitizeHeroAppearance, type HeroAppearance } from '../../data/hero-appearance';
import { SPELLS, spellAt, spellIndex } from '../../data/spells';
import { CLASSES, classAt, validAbilities } from '../../data/classes';
import { gearPart } from '../classfx';

export interface HeroConfig {
  name: string;
  body: number; // 0 mann, 1 dame
  skin: number;
  face: number;
  hair: number;
  hairColor: number;
  beard: number;
  helmet: number;
  torso: number;
  pelvis: number;
  boots: number;
  weapon: number;
  cloth: number;
  /** Plassen i SPELLS (data/spells.ts): 0 METEOR STORM, 1 ANCESTRAL SCREAM, 2 SKY THUNDER osv. Påvirker ikke grafikken. */
  magic: number;
  /** Plassen i CLASSES (data/classes.ts). Uten feltet er helten FIGHTER, som alle var før klassene. */
  cls?: number;
  /** ROLL 3D6: STR, INT, WIS, DEX, CON og CHA (3 til 18). Uten feltet er alt middels. */
  abilities?: number[];
  /** Malte deler fra den felles katalogen. Uten feltet brukes den gamle tegnebyggeren. */
  parts?: HeroParts;
  /** Uavhengige lag og maskefarger. Gamle helter uten feltet beholder bildene urørt. */
  appearance?: HeroAppearance;
}

export const SKINS = ['#f2c59c', '#e2a26b', '#c98a5a', '#9c6440', '#6e4428', '#8fb46a', '#9fb4c8'];
export const HAIRS = ['#2a1a12', '#6b3e1f', '#e8c65a', '#e0661f', '#e8e4dc', '#b3261e', '#3a5fb0'];
export const CLOTHS = ['#7a4b28', '#8e1b1b', '#3a6fc0', '#3f6b2a', '#5b2a86', '#2a2a30', '#c8962a'];

/** Navn på alle valg, i samme rekkefølge som indeksene. Brukes av skaper-UI. */
export const HERO_OPTIONS: Record<Exclude<keyof HeroConfig, 'name' | 'parts' | 'appearance' | 'abilities'>, string[]> = {
  body: ['MALE', 'FEMALE'],
  skin: ['PEACH', 'TAN', 'BRONZE', 'UMBER', 'DEEP', 'ORC GREEN', 'FROST BLUE'],
  face: ['GRIM', 'BATTLE CRY', 'UNHINGED', 'EYEPATCH', 'SMUG'],
  hair: ['BALD', 'WILD', 'LONG', 'MOHAWK', 'BRAIDS', 'PONYTAIL', 'TOPKNOT', 'MANE'],
  hairColor: ['BLACK', 'BROWN', 'BLOND', 'GINGER', 'WHITE', 'BLOOD RED', 'WIZARD BLUE'],
  beard: ['NONE', 'STUBBLE', 'FULL BEARD', 'BRAIDED BEARD', 'MUSTACHE'],
  helmet: ['NONE', 'HORNED', 'WINGED', 'BEAST SKULL', 'CROWN', 'GREAT HELM', 'HEADBAND'],
  torso: ['BARE', 'FUR MANTLE', 'LEATHER', 'CHAINMAIL', 'PLATE'],
  pelvis: ['FUR LOINCLOTH', 'KILT', 'BATTLE SKIRT', 'TASSETS', 'CHAINMAIL BRIEFS'],
  boots: ['FUR BOOTS', 'LEATHER BOOTS', 'GREAVES', 'SANDALS', 'RED BOOTS'],
  weapon: ['SWORD', 'AXE', 'WARHAMMER', 'SPIKED CLUB'],
  cloth: ['BROWN', 'CRIMSON', 'ROYAL BLUE', 'FOREST', 'PURPLE', 'BLACK', 'GOLD'],
  magic: SPELLS.map((s) => s.label),
  cls: CLASSES.map((c) => c.label),
};

export const PRESETS: Record<string, HeroConfig> = {
  thrugg: { name: 'THRUGG', body: 0, skin: 1, face: 0, hair: 1, hairColor: 0, beard: 1, helmet: 1, torso: 1, pelvis: 0, boots: 0, weapon: 0, cloth: 0, magic: 0, cls: 0, parts: defaultHeroParts(0) },
  // Etter Toms referansebilde: vilt kobberrødt krøllhår, selvgodt blikk, rusten ringbrynjebikini, pelsstøvler og stor øks
  valkyra: { name: 'VALKYRA', body: 1, skin: 0, face: 4, hair: 7, hairColor: 3, beard: 0, helmet: 0, torso: 3, pelvis: 4, boots: 0, weapon: 1, cloth: 0, magic: 1, cls: 0, parts: defaultHeroParts(1) },
};

/** Kopier konfigurasjonen uten å dele valgene med et preset eller en annen spiller. */
export function cloneHero(cfg: HeroConfig): HeroConfig {
  if (cfg.parts !== undefined) return withHeroParts(cfg, cfg.parts);
  const classic = { ...cfg };
  delete classic.appearance;
  return classic;
}

/** Bytt deler og hold kroppstype og våpenets kampegenskaper i takt med bildene. */
export function withHeroParts(cfg: HeroConfig, parts: HeroParts): HeroConfig {
  const clean = sanitizeHeroParts(parts, cfg.body);
  return {
    ...cfg,
    parts: clean,
    ...(cfg.appearance !== undefined ? { appearance: sanitizeHeroAppearance(cfg.appearance) } : {}),
    body: findHeroPart('torso', clean.torso)?.body ?? cfg.body,
    weapon: findHeroPart('weapon', clean.weapon)?.weapon ?? cfg.weapon,
  };
}

/** Endrer bare utseendelagene. Valgt malt hode, kropp og våpen bevares. */
export function withHeroAppearance(cfg: HeroConfig, appearance: HeroAppearance): HeroConfig {
  const out = cloneHero(cfg);
  if (out.parts) out.appearance = sanitizeHeroAppearance(appearance);
  return out;
}

/**
 * Hold våpen og magi innenfor det klassen kan bruke (data/classes.ts). Magi klassen ikke kan, blir klassens første.
 * Et våpen klassen ikke kan bruke, byttes mot det første den kan (et malt våpen som canUse godtar, ellers indeksen).
 * Klasser med eget utstyr beholder det malte våpenet urørt: det vises ikke, men er der hvis klassen byttes tilbake.
 */
export function withClassRules(cfg: HeroConfig, canUse: (key: string) => boolean = () => true): HeroConfig {
  let out = cloneHero(cfg);
  const c = classAt(out.cls);
  if (!c.spells.includes(spellAt(out.magic).id)) out.magic = spellIndex(c.spells[0]);
  if (!c.gear && !c.weapons.includes(out.weapon)) {
    if (out.parts) {
      const part = HERO_PARTS.weapon.find((p) => p.weapon !== undefined && c.weapons.includes(p.weapon) && (!p.unlock || canUse(p.unlock)));
      if (part) out = withHeroParts(out, { ...out.parts, weapon: part.id });
    } else out.weapon = c.weapons.find((w) => canUse('weapon:' + w)) ?? c.weapons[0];
  }
  const ab = validAbilities(out.abilities);
  if (ab) out.abilities = ab;
  else delete out.abilities;
  return out;
}

const M = {
  leather: '#5a3519', leatherL: '#7a4a26', fur: '#7a4b28', furL: '#a8723f', steel: '#a9b3bd', silver: '#c8d0da',
  gold: '#e8b83a', bone: '#efe8d2', horn: '#efe2c2', white: '#f7f3ea', wood: '#8a5a2b', chain: '#8e98a4',
};

type C = CanvasRenderingContext2D;
const maleFace = (c: C) => blobPath(c, [-0.3, 0.3, -0.3, 0.62, 0.02, 0.76, 0.34, 0.62, 0.45, 0.34, 0.41, 0.06, 0.16, -0.07, -0.16, 0.02]);
const femFace = (c: C) => blobPath(c, [-0.28, 0.3, -0.28, 0.6, 0.02, 0.74, 0.32, 0.6, 0.4, 0.32, 0.36, 0.08, 0.14, -0.04, -0.14, 0.04]);

// ---------------------------------------------------------------- hode
function backHair(p: Pen, hair: number, hc: string) {
  switch (hair) {
    case 1:
      p.poly([-0.3, 0.6, -0.52, 0.42, -0.42, 0.3, -0.58, 0.12, -0.4, 0.08, -0.48, -0.1, -0.26, -0.02, -0.2, 0.2], hc);
      break;
    case 2:
      p.blob([-0.16, 0.7, -0.5, 0.56, -0.6, 0.14, -0.56, -0.22, -0.34, -0.12, -0.2, 0.2], hc);
      break;
    case 4:
      p.blob([-0.18, 0.66, -0.52, 0.5, -0.6, 0.2, -0.5, -0.06, -0.3, 0.02, -0.16, 0.2], hc);
      for (let i = 0; i < 5; i++) p.ell(-0.4 - i * 0.02, -0.02 - i * 0.07, 0.07, 0.055, i % 2 ? shade(hc, -0.25) : hc);
      p.ell(-0.5, -0.36, 0.05, 0.04, M.leather);
      break;
    case 5:
      p.shape((c) => { c.moveTo(-0.28, 0.62); c.quadraticCurveTo(-0.62, 0.52, -0.56, -0.02); c.quadraticCurveTo(-0.44, 0.3, -0.24, 0.46); c.closePath(); }, hc);
      p.ell(-0.32, 0.56, 0.05, 0.06, M.leather);
      break;
    case 6:
      p.blob([-0.26, 0.6, -0.4, 0.44, -0.34, 0.24, -0.2, 0.3], hc);
      break;
    case 7:
      // Vill manke (Valkyra, docs/STYLE_TARGET.md): stor masse bak hodet og ned på ryggen, med buede lokker i kanten
      // Hodelerretet går fra x -0.76 til 0.68 og y -0.44 til 1.06; lokkene må holde seg innenfor
      locks(p, [[-0.48, 0.72, -0.22, 0.1], [-0.6, 0.42, -0.12, -0.1], [-0.6, 0.12, -0.12, -0.2], [-0.54, -0.14, -0.1, -0.24], [-0.38, -0.2, 0.02, -0.2]], 0.1, hc);
      p.blob([0.1, 0.88, -0.38, 0.84, -0.62, 0.52, -0.68, 0.04, -0.58, -0.32, -0.34, -0.28, -0.18, 0.1, 0.0, 0.5], hc);
      break;
  }
}

/**
 * Buede, spisse hårlokker: [x, y, dx, dy] er rota og retningen ut til tuppen. Annenhver lokk er litt lysere,
 * så de skiller seg fra hverandre og fra resten av håret.
 */
function locks(p: Pen, list: [number, number, number, number][], w: number, hc: string) {
  list.forEach(([x, y, dx, dy], i) => {
    const L = Math.hypot(dx, dy), nx = (-dy / L) * w, ny = (dx / L) * w;
    p.shape((c) => {
      c.moveTo(x + nx, y + ny);
      c.quadraticCurveTo(x + dx * 0.55 + nx * 1.5, y + dy * 0.55 + ny * 1.5, x + dx, y + dy);
      c.quadraticCurveTo(x + dx * 0.5 - nx * 0.3, y + dy * 0.5 - ny * 0.3, x - nx, y - ny);
      c.closePath();
    }, i % 2 ? shade(hc, 0.12) : hc);
  });
}

function topHair(p: Pen, hair: number, hc: string, fem: boolean) {
  switch (hair) {
    case 0:
      p.ell(0.04, 0.62, 0.1, 0.05, 'rgba(255,255,255,0.35)', false, -0.2);
      break;
    case 1:
      p.poly([-0.34, 0.42, -0.36, 0.66, -0.24, 0.62, -0.2, 0.84, -0.06, 0.72, 0.02, 0.9, 0.12, 0.74, 0.24, 0.86, 0.28, 0.68, 0.42, 0.7, 0.36, 0.56, 0.2, 0.62, 0.0, 0.58, -0.2, 0.5], hc);
      break;
    case 2:
    case 4:
    case 5:
      p.blob([-0.34, 0.42, -0.26, 0.74, 0.04, 0.84, 0.3, 0.74, 0.4, 0.5, 0.22, 0.6, 0.0, 0.56, -0.2, 0.48], hc);
      if (fem || hair === 2) p.blob([-0.02, 0.6, 0.2, 0.64, 0.34, 0.52, 0.16, 0.5], hc);
      break;
    case 3:
      p.poly([-0.26, 0.64, -0.3, 0.9, -0.16, 0.8, -0.12, 1.04, 0.0, 0.84, 0.04, 1.08, 0.12, 0.84, 0.22, 1.0, 0.22, 0.76, 0.3, 0.78, 0.2, 0.66], hc);
      break;
    case 7:
      locks(p, [[-0.2, 0.88, -0.18, 0.1], [0.06, 0.92, 0.02, 0.1], [0.3, 0.82, 0.16, 0.06]], 0.08, hc);
      p.blob([-0.4, 0.46, -0.36, 0.82, -0.06, 0.96, 0.3, 0.88, 0.46, 0.62, 0.36, 0.5, 0.2, 0.64, 0.0, 0.6, -0.2, 0.5], hc);
      // Lokker som faller ned foran øret og kinnet
      locks(p, [[0.3, 0.66, 0.12, -0.2], [0.12, 0.62, 0.02, -0.18]], 0.06, shade(hc, 0.06));
      break;
    case 6:
      p.blob([-0.32, 0.44, -0.24, 0.72, 0.04, 0.8, 0.3, 0.72, 0.38, 0.5, 0.0, 0.56], hc);
      p.ell(0.0, 0.88, 0.13, 0.11, hc);
      p.rrect(-0.08, 0.76, 0.16, 0.05, 0.02, M.gold);
      break;
  }
}

function eyes(p: Pen, face: number, fem: boolean) {
  const lash = () => {
    if (!fem) return;
    p.line([0.19, 0.35, 0.23, 0.38], 0.018);
    p.line([0.37, 0.33, 0.41, 0.35], 0.018);
  };
  switch (face) {
    case 0:
      p.line([0.05, 0.4, 0.4, 0.33], fem ? 0.055 : 0.075);
      p.ell(0.14, 0.31, 0.065, 0.05, '#fff');
      p.ell(0.33, 0.29, 0.05, 0.045, '#fff');
      p.ell(0.17, 0.3, 0.024, 0.024, INK, false);
      p.ell(0.35, 0.285, 0.021, 0.021, INK, false);
      lash();
      break;
    case 1:
      p.line([0.05, 0.43, 0.36, 0.37], 0.055);
      p.ell(0.14, 0.33, 0.06, 0.05, '#fff');
      p.ell(0.31, 0.31, 0.045, 0.042, '#fff');
      p.ell(0.17, 0.32, 0.024, 0.024, INK, false);
      p.ell(0.33, 0.305, 0.02, 0.02, INK, false);
      lash();
      break;
    case 2:
      p.line([0.04, 0.46, 0.2, 0.5], 0.04);
      p.line([0.26, 0.42, 0.4, 0.38], 0.04);
      p.ell(0.13, 0.33, 0.085, 0.085, '#fff');
      p.ell(0.33, 0.3, 0.055, 0.06, '#fff');
      p.ell(0.1, 0.35, 0.018, 0.018, INK, false);
      p.ell(0.36, 0.28, 0.016, 0.016, INK, false);
      lash();
      break;
    case 3:
      p.ell(0.14, 0.31, 0.06, 0.05, '#fff');
      p.ell(0.17, 0.3, 0.024, 0.024, INK, false);
      p.line([0.05, 0.41, 0.22, 0.4], 0.05);
      p.line([0.06, 0.46, 0.2, 0.2], 0.02, '#c85a6a');
      p.line([-0.28, 0.5, 0.3, 0.34, 0.44, 0.34], 0.025);
      p.ell(0.34, 0.3, 0.07, 0.06, INK);
      if (fem) p.line([0.19, 0.35, 0.23, 0.38], 0.018);
      break;
    case 4:
      p.line([0.05, 0.42, 0.2, 0.44], 0.045);
      p.line([0.26, 0.4, 0.4, 0.34], 0.045);
      p.ell(0.14, 0.31, 0.06, 0.045, '#fff');
      p.ell(0.33, 0.29, 0.048, 0.04, '#fff');
      p.ell(0.17, 0.3, 0.022, 0.022, INK, false);
      p.ell(0.35, 0.285, 0.02, 0.02, INK, false);
      p.line([0.08, 0.33, 0.2, 0.33], 0.025);
      p.line([0.28, 0.31, 0.38, 0.31], 0.025);
      lash();
      break;
  }
}

function mouth(p: Pen, face: number, fem: boolean) {
  const lip = fem ? '#b8505a' : INK;
  switch (face) {
    case 0:
      p.rrect(0.13, 0.05, 0.25, 0.085, 0.02, '#fff');
      p.line([0.13, 0.092, 0.38, 0.092], 0.012);
      for (const x of [0.19, 0.25, 0.31]) p.line([x, 0.05, x, 0.135], 0.012);
      break;
    case 1:
      p.ell(0.24, 0.08, 0.1, 0.075, '#7a1414');
      p.rrect(0.16, 0.1, 0.16, 0.04, 0.01, '#fff', false);
      p.ell(0.24, 0.03, 0.05, 0.025, '#e0707a', false);
      if (fem) p.ell(0.24, 0.08, 0.1, 0.075, null);
      break;
    case 2:
      p.shape((c) => { c.moveTo(0.06, 0.14); c.quadraticCurveTo(0.24, -0.02, 0.42, 0.16); c.quadraticCurveTo(0.24, 0.1, 0.06, 0.14); c.closePath(); }, '#fff');
      for (const x of [0.12, 0.18, 0.24, 0.3, 0.36]) p.line([x, 0.07, x, 0.13], 0.01);
      break;
    case 3:
    case 4:
      p.shape((c) => { c.moveTo(0.14, 0.1); c.quadraticCurveTo(0.26, 0.08, 0.38, 0.15); }, null, true, 0.03);
      if (fem) p.shape((c) => { c.moveTo(0.16, 0.1); c.quadraticCurveTo(0.26, 0.07, 0.36, 0.13); }, null, true, 0.02);
      void lip;
      break;
  }
  if (fem && face !== 1 && face !== 2) p.ell(0.25, 0.1, 0.06, 0.02, 'rgba(184,80,90,0.5)', false);
}

function beard(p: Pen, beard: number, hc: string, face: (c: C) => void) {
  switch (beard) {
    case 1:
      p.clipTo(face, () => p.shape((c) => blobPath(c, [-0.1, 0.1, 0.1, 0.2, 0.46, 0.2, 0.46, -0.12, 0.1, -0.12]), 'rgba(40,20,10,0.25)', false));
      break;
    case 2:
      p.blob([-0.16, 0.3, 0.1, 0.2, 0.46, 0.22, 0.48, -0.02, 0.32, -0.3, 0.1, -0.36, -0.1, -0.1], hc);
      for (const x of [0.08, 0.2, 0.32]) p.line([x, 0.0, x - 0.02, -0.22], 0.015, shade(hc, -0.3));
      break;
    case 3:
      p.blob([-0.12, 0.26, 0.12, 0.18, 0.44, 0.2, 0.44, 0.02, 0.24, -0.08, 0.0, -0.06], hc);
      for (const x of [0.14, 0.32]) {
        for (let i = 0; i < 3; i++) p.ell(x, -0.08 - i * 0.07, 0.045, 0.04, i % 2 ? shade(hc, -0.25) : hc);
        p.ell(x, -0.3, 0.035, 0.03, M.gold);
      }
      break;
    case 4:
      p.shape((c) => { c.moveTo(0.12, 0.16); c.quadraticCurveTo(0.26, 0.24, 0.42, 0.16); c.quadraticCurveTo(0.5, 0.1, 0.46, 0.02); c.quadraticCurveTo(0.4, 0.12, 0.26, 0.14); c.quadraticCurveTo(0.12, 0.12, 0.06, 0.02); c.quadraticCurveTo(0.04, 0.12, 0.12, 0.16); c.closePath(); }, hc);
      break;
  }
}

function helmet(p: Pen, h: number, cloth: string, hair: number, hc: string) {
  switch (h) {
    case 1: {
      const helm = (c: C) => blobPath(c, [-0.38, 0.44, -0.3, 0.8, 0.04, 0.96, 0.36, 0.82, 0.47, 0.48, 0.04, 0.52]);
      if (hair === 3) topHair(p, 3, hc, false);
      p.shaded(helm, M.steel, shade(M.steel, -0.3), (c) => c.rect(-0.5, 0.3, 0.35, 0.8));
      p.shape((c) => { c.moveTo(-0.28, 0.72); c.quadraticCurveTo(-0.64, 0.8, -0.6, 1.18); c.quadraticCurveTo(-0.48, 0.92, -0.16, 0.86); c.closePath(); }, M.horn);
      p.shape((c) => { c.moveTo(0.28, 0.76); c.quadraticCurveTo(0.64, 0.86, 0.62, 1.2); c.quadraticCurveTo(0.5, 0.96, 0.18, 0.88); c.closePath(); }, M.horn);
      p.rrect(-0.4, 0.42, 0.9, 0.13, 0.05, shade(M.steel, -0.08));
      for (const x of [-0.28, -0.08, 0.12, 0.32]) p.ell(x, 0.485, 0.022, 0.022, INK, false);
      break;
    }
    case 2: {
      const helm = (c: C) => blobPath(c, [-0.34, 0.5, -0.26, 0.82, 0.04, 0.94, 0.32, 0.82, 0.4, 0.52, 0.04, 0.58]);
      if (hair === 3) topHair(p, 3, hc, false);
      p.shaded(helm, M.silver, shade(M.silver, -0.3), (c) => c.rect(-0.5, 0.3, 0.3, 0.8));
      p.rrect(-0.35, 0.49, 0.78, 0.1, 0.04, M.gold);
      for (let i = 0; i < 4; i++) {
        const y = 0.66 + i * 0.1;
        p.blob([-0.24, y, -0.5 - i * 0.07, y + 0.14 + i * 0.03, -0.66 - i * 0.05, y + 0.22 + i * 0.05, -0.4 - i * 0.05, y + 0.02], M.white);
      }
      break;
    }
    case 3: {
      p.shape((c) => { c.moveTo(-0.3, 0.7); c.quadraticCurveTo(-0.58, 0.82, -0.46, 1.04); c.quadraticCurveTo(-0.4, 0.86, -0.2, 0.84); c.closePath(); }, M.horn);
      const sk = (c: C) => blobPath(c, [-0.38, 0.42, -0.32, 0.78, 0.0, 0.92, 0.34, 0.84, 0.52, 0.58, 0.5, 0.44, 0.1, 0.5]);
      p.shaded(sk, M.bone, shade(M.bone, -0.2), (c) => c.rect(-0.5, 0.3, 0.3, 0.8));
      p.ell(0.08, 0.7, 0.07, 0.06, INK, false);
      p.ell(0.26, 0.68, 0.06, 0.055, INK, false);
      p.ell(0.08, 0.7, 0.02, 0.02, '#ff3b2f', false);
      for (const x of [0.3, 0.38, 0.46]) p.poly([x - 0.03, 0.46, x, 0.36, x + 0.03, 0.46], M.bone);
      p.line([-0.1, 0.84, -0.04, 0.72, -0.12, 0.64], 0.015);
      break;
    }
    case 4: {
      if (hair !== 0) topHair(p, hair === 3 ? 1 : hair, hc, false);
      p.shape((c) => polyPath(c, [-0.3, 0.6, 0.36, 0.66, 0.4, 0.94, 0.28, 0.8, 0.18, 0.98, 0.06, 0.8, -0.06, 0.98, -0.16, 0.8, -0.28, 0.92]), M.gold);
      for (const x of [-0.1, 0.1, 0.28]) p.ell(x, 0.7, 0.035, 0.035, x === 0.1 ? '#2e6fd0' : '#c0202a', false);
      break;
    }
    case 5: {
      const h5 = (c: C) => blobPath(c, [-0.34, -0.04, -0.36, 0.4, -0.26, 0.76, 0.08, 0.86, 0.38, 0.72, 0.48, 0.38, 0.44, -0.04]);
      p.shape((c) => { c.moveTo(0.0, 0.82); c.quadraticCurveTo(-0.3, 1.1, -0.62, 0.96); c.quadraticCurveTo(-0.3, 0.96, -0.1, 0.74); c.closePath(); }, cloth);
      p.shaded(h5, M.steel, shade(M.steel, -0.32), (c) => c.rect(-0.5, -0.1, 0.4, 1.0));
      p.rrect(0.06, 0.36, 0.42, 0.1, 0.02, '#0a0608');
      p.rrect(0.26, 0.08, 0.07, 0.34, 0.02, '#0a0608');
      p.ell(0.16, 0.41, 0.035, 0.022, '#fff', false);
      p.ell(0.38, 0.41, 0.03, 0.02, '#fff', false);
      for (const [x, y] of [[0.38, 0.2], [0.38, 0.28], [0.14, 0.22], [0.14, 0.3]]) p.ell(x, y, 0.015, 0.015, INK, false);
      p.line([-0.3, 0.6, 0.02, 0.76, 0.38, 0.64], 0.03, M.gold);
      break;
    }
    case 6: {
      if (hair !== 0) topHair(p, hair, hc, false);
      p.shape((c) => { c.moveTo(-0.3, 0.5); c.quadraticCurveTo(-0.5, 0.4, -0.62, 0.24); c.lineTo(-0.54, 0.22); c.quadraticCurveTo(-0.46, 0.38, -0.28, 0.44); c.closePath(); }, cloth);
      p.shape((c) => { c.moveTo(-0.3, 0.52); c.quadraticCurveTo(-0.52, 0.52, -0.66, 0.4); c.lineTo(-0.6, 0.36); c.quadraticCurveTo(-0.48, 0.46, -0.3, 0.46); c.closePath(); }, cloth);
      p.shape((c) => polyPath(c, [-0.34, 0.44, 0.42, 0.48, 0.4, 0.58, -0.32, 0.56]), cloth);
      break;
    }
  }
}

function headPart(cfg: HeroConfig): PartDef {
  const skin = SKINS[cfg.skin] ?? SKINS[0];
  const hc = HAIRS[cfg.hairColor] ?? HAIRS[0];
  const cloth = CLOTHS[cfg.cloth] ?? CLOTHS[0];
  const fem = cfg.body === 1;
  return {
    w: 1.44, h: 1.5, ox: 0.76, oy: 0.44,
    draw: (p) => {
      backHair(p, cfg.hair, hc);
      const face = fem ? femFace : maleFace;
      p.shaded(face, skin, skinD(skin), (c) => c.rect(-0.5, -0.2, 0.34, 1.2));
      p.ell(-0.13, 0.34, 0.07, 0.1, skin);
      eyes(p, cfg.face, fem);
      p.shape((c) => { c.moveTo(fem ? 0.37 : 0.41, 0.3); c.quadraticCurveTo(fem ? 0.48 : 0.56, 0.23, fem ? 0.38 : 0.43, 0.16); }, skin);
      mouth(p, cfg.face, fem);
      beard(p, cfg.beard, hc, face);
      if (cfg.beard === 2 || cfg.beard === 3) mouth(p, cfg.face === 1 ? 1 : 0, fem);
      if (cfg.helmet === 0) topHair(p, cfg.hair, hc, fem);
      helmet(p, cfg.helmet, cloth, cfg.hair, hc);
    },
  };
}

// ---------------------------------------------------------------- kropp (se muscle.ts)
const TORSO_TOP: TopKind[] = ['fur', 'fur', 'leather', 'chain', 'plate'];

function torsoPart(cfg: HeroConfig): PartDef {
  const skin = SKINS[cfg.skin] ?? SKINS[0];
  const cloth = CLOTHS[cfg.cloth] ?? CLOTHS[0];
  const sd = skinD(skin);
  const fem = cfg.body === 1;
  const t = cfg.torso;
  return {
    w: 1.34, h: 1.06, ox: 0.67, oy: 0.1,
    draw: (p) => {
      if (fem) {
        femChest(p, skin, sd, t === 1 ? 'leather' : TORSO_TOP[t] ?? 'fur', cloth, t === 2);
      } else if (t === 4) {
        // Muskelkyrass: rustning formet som magemuskler, fordi det er viktig å vise dem frem
        const body = maleTorsoPath;
        p.shaded(body, M.silver, shade(M.silver, -0.28), (c) => c.rect(-0.62, -0.1, 0.36, 1.0));
        p.clipTo(body, () => {
          p.shape((c) => c.ellipse(0.25, 0.48, 0.24, 0.16, -0.12, 0, Math.PI * 2), null, true, 0.022);
          p.shape((c) => c.ellipse(-0.13, 0.49, 0.2, 0.14, 0.12, 0, Math.PI * 2), null, true, 0.022);
          for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) p.shape((c) => polyPath(c, [k * 0.14, 0.04 + r * 0.095, 0.12 + k * 0.14, 0.04 + r * 0.095, 0.12 + k * 0.14, 0.115 + r * 0.095, k * 0.14, 0.115 + r * 0.095]), null, true, 0.012);
          p.shape((c) => c.ellipse(0.33, 0.54, 0.09, 0.045, -0.3, 0, Math.PI * 2), 'rgba(255,255,255,0.5)', false);
        });
        p.shape(body, null);
        p.rrect(-0.33, 0.0, 0.66, 0.08, 0.03, cloth);
        p.ell(0.13, 0.64, 0.05, 0.05, M.gold);
      } else if (t === 3) {
        // Ringbrynje-topp som er to nummer for liten
        maleChest(p, skin, sd, false);
        const top = (c: CanvasRenderingContext2D) => blobPath(c, [-0.6, 0.64, -0.57, 0.34, -0.24, 0.3, 0.1, 0.33, 0.54, 0.34, 0.58, 0.62, 0.24, 0.8, -0.24, 0.8]);
        p.clipTo(maleTorsoPath, () => {
          p.shaded(top, M.chain, shade(M.chain, -0.3), (c) => c.rect(-0.62, 0.2, 0.36, 0.8));
          p.clipTo(top, () => {
            let row = 0;
            for (let y = 0.3; y < 0.8; y += 0.055, row++)
              for (let x = -0.5; x < 0.5; x += 0.065) p.shape((c) => c.arc(x + (row % 2 ? 0.032 : 0), y, 0.028, Math.PI, 0), null, true, 0.01);
          });
          p.shape(top, null);
        });
        p.shape(maleTorsoPath, null);
      } else {
        maleChest(p, skin, sd, t !== 2);
        if (t === 2) {
          // Åpen lærvest (ingen knapper, bare selvtillit)
          const vb = (c: CanvasRenderingContext2D) => blobPath(c, [-0.62, 0.62, -0.58, 0.34, -0.36, 0.1, -0.16, 0.0, -0.1, 0.4, -0.16, 0.78, -0.36, 0.8]);
          p.clipTo(maleTorsoPath, () => p.shaded(vb, M.leatherL, M.leather, (c) => c.rect(-0.7, -0.1, 0.24, 1.0)));
          p.line([-0.14, 0.76, -0.1, 0.4, -0.17, 0.02], 0.03, INK);
          const vf = (c: CanvasRenderingContext2D) => blobPath(c, [0.58, 0.62, 0.55, 0.38, 0.42, 0.22, 0.46, 0.52, 0.42, 0.78]);
          p.clipTo(maleTorsoPath, () => p.shaded(vf, M.leatherL, M.leather, (c) => c.rect(0.4, -0.1, 0.1, 1.0)));
          p.line([-0.36, 0.06, -0.36, 0.3], 0.016, M.gold);
        }
      }
      if (t === 1) {
        // Pelskappe over skuldrene
        p.blob([-0.66, 0.58, -0.56, 0.88, -0.1, 0.95, 0.3, 0.88, 0.22, 0.72, -0.1, 0.66, -0.4, 0.52], M.fur);
        for (const [x, y] of [[-0.46, 0.82], [-0.3, 0.88], [-0.52, 0.66], [-0.14, 0.82], [0.06, 0.86], [0.18, 0.78]]) p.line([x, y, x + 0.05, y - 0.07], 0.02, M.furL);
      }
    },
  };
}

const SHOULDERS: Shoulder[] = ['skin', 'fur', 'leather', 'chain', 'plate'];
const FEET: Footwear[] = ['fur', 'leather', 'greaves', 'sandals', 'redboots'];
const LOINS: Loins[] = ['loincloth', 'kilt', 'skirt', 'tassets', 'chainkini'];

function armPart(cfg: HeroConfig): PartDef {
  const skin = SKINS[cfg.skin] ?? SKINS[0];
  const cloth = CLOTHS[cfg.cloth] ?? CLOTHS[0];
  const fem = cfg.body === 1;
  const t = cfg.torso;
  const sh = fem && t === 0 ? 'skin' : SHOULDERS[t] ?? 'skin';
  return muscleArm(skin, skinD(skin), fem ? 1.1 : 1.42, sh, t === 4 ? M.silver : M.leather, cloth);
}

function pelvisPart(cfg: HeroConfig): PartDef {
  return tinyLoins(LOINS[cfg.pelvis] ?? 'loincloth', CLOTHS[cfg.cloth] ?? CLOTHS[0]);
}

function legPart(cfg: HeroConfig): PartDef {
  const skin = SKINS[cfg.skin] ?? SKINS[0];
  return muscleLeg(skin, skinD(skin), cfg.body === 1 ? 0.88 : 1, FEET[cfg.boots] ?? 'fur', CLOTHS[cfg.cloth] ?? CLOTHS[0]);
}

// ---------------------------------------------------------------- våpen
function weaponPart(w: number): PartDef {
  switch (w) {
    case 1:
      return {
        w: 0.9, h: 1.96, ox: 0.3, oy: 0.36,
        draw: (p) => {
          p.rrect(-0.045, -0.34, 0.09, 1.72, 0.03, M.wood);
          for (const y of [-0.2, -0.1, 0.0]) p.line([-0.045, y, 0.045, y + 0.04], 0.018, M.leather);
          const blade = (c: C) => { c.moveTo(0.04, 1.02); c.lineTo(0.27, 0.9); c.quadraticCurveTo(0.56, 1.16, 0.29, 1.46); c.lineTo(0.04, 1.33); c.closePath(); };
          p.shaded(blade, '#e3e9f0', '#a9b4c2', (c) => c.rect(0.0, 0.8, 0.2, 0.8));
          p.poly([-0.04, 1.1, -0.26, 1.18, -0.04, 1.26], '#c3ccd6');
          p.rrect(-0.06, 1.0, 0.12, 0.38, 0.03, M.gold);
        },
      };
    case 2:
      return {
        w: 0.8, h: 1.9, ox: 0.4, oy: 0.36,
        draw: (p) => {
          p.rrect(-0.045, -0.34, 0.09, 1.6, 0.03, M.wood);
          for (const y of [-0.24, -0.12, 0.0]) p.line([-0.045, y, 0.045, y + 0.04], 0.018, M.leather);
          p.shaded((c) => polyPath(c, [-0.32, 1.02, 0.32, 1.02, 0.34, 1.34, -0.34, 1.34]), M.steel, shade(M.steel, -0.35), (c) => c.rect(0, 0.9, 0.5, 0.6));
          p.poly([-0.06, 1.34, 0.0, 1.5, 0.06, 1.34], M.steel);
          p.line([-0.26, 1.18, 0.26, 1.18], 0.02, shade(M.steel, -0.4));
          p.rrect(-0.08, 0.96, 0.16, 0.44, 0.03, M.gold);
        },
      };
    case 3:
      return {
        w: 0.56, h: 1.6, ox: 0.28, oy: 0.3,
        draw: (p) => {
          p.poly([-0.05, -0.22, 0.05, -0.22, 0.14, 1.02, 0.0, 1.16, -0.14, 1.02], M.wood);
          p.line([-0.02, 0.1, 0.02, 0.9], 0.02, shade(M.wood, -0.3));
          p.rrect(-0.06, -0.14, 0.12, 0.2, 0.03, M.leather);
          for (const [x, y, d] of [[0.12, 0.8, 1], [0.1, 0.55, 1], [-0.11, 0.7, -1], [-0.1, 0.95, -1], [0.12, 1.05, 1], [-0.08, 0.45, -1]] as const) {
            p.poly([x, y - 0.04, x + d * 0.13, y, x, y + 0.04], '#d8d8d8');
          }
          p.ell(0.02, 0.9, 0.05, 0.03, 'rgba(140,10,10,0.7)', false);
        },
      };
    default:
      return {
        w: 0.46, h: 1.92, ox: 0.23, oy: 0.33,
        draw: (p) => {
          p.ell(0, -0.24, 0.075, 0.075, M.gold);
          p.ell(0, -0.24, 0.032, 0.032, '#c0202a', false);
          p.rrect(-0.047, -0.19, 0.094, 0.31, 0.02, M.leather);
          for (const y of [-0.12, -0.04, 0.04]) p.line([-0.045, y, 0.045, y + 0.03], 0.015);
          p.shaded((c) => polyPath(c, [-0.078, 0.16, 0.078, 0.16, 0.072, 1.3, 0, 1.52, -0.072, 1.3]), '#e6edf4', '#aab6c4', (c) => c.rect(0, 0, 0.2, 1.7));
          p.line([0, 0.24, 0, 1.22], 0.022, '#8e9aa8');
          p.rrect(-0.21, 0.1, 0.42, 0.085, 0.03, M.gold);
          p.ell(-0.21, 0.143, 0.045, 0.055, M.gold);
          p.ell(0.21, 0.143, 0.045, 0.055, M.gold);
        },
      };
  }
}

// ---------------------------------------------------------------- bygging
function legacyHeroKey(cfg: HeroConfig) {
  return [cfg.body, cfg.skin, cfg.face, cfg.hair, cfg.hairColor, cfg.beard, cfg.helmet, cfg.torso, cfg.pelvis, cfg.boots, cfg.weapon, cfg.cloth].join('.');
}

export function heroKey(cfg: HeroConfig) {
  const c = cloneHero(cfg);
  const parts = c.parts;
  // Klassen kan bytte våpenet med eget utstyr og endre kroppsformen (FIGHTER gir samme nøkkel som før klassene)
  const cls = classAt(c.cls);
  return legacyHeroKey(c) + (parts ? ':' + HERO_PART_SLOTS.map((slot) => parts[slot]).join('.') : '')
    + (c.appearance ? ':appearance:' + HERO_APPEARANCE_KEYS.map((key) => c.appearance![key]).join('.') : '')
    + (cls.gear || cls.stretch ? ':class:' + cls.id : '');
}

export function buildHeroDef(cfg: HeroConfig, slot: number): CharDef {
  cfg = cloneHero(cfg);
  const fem = cfg.body === 1;
  // Lagringsleseren migrerer gamle presets. Uten parts er CLASSIC et uttrykkelig valg.
  const parts = cfg.parts;
  const cls = classAt(cfg.cls);
  const inherit: CharDef['inherit'] = parts ? {} : undefined;
  if (parts && inherit) {
    for (const part of HERO_PART_SLOTS) inherit[part] = findHeroPart(part, parts[part])!.source;
    // Klassens eget utstyr er tegnet i koden (gfx/classfx.ts) til det kommer et malt bilde med figur-id gear_<id> i
    // manifestet (docs/ART_PROMPTS.md), og skal ikke byttes med det malte våpenet fra delpoolen
    if (cls.gear) inherit.weapon = 'gear_' + cls.gear;
  }
  return {
    inherit,
    ...(cfg.appearance ? { appearance: { ...cfg.appearance } } : {}),
    id: `hero${slot}:${heroKey(cfg)}`,
    name: cfg.name || 'NAMELESS',
    scale: fem ? 0.9 : 0.93,
    hipY: HERO_HIP_Y,
    joints: HERO_BIG_J,
    leg: legPart(cfg),
    arm: armPart(cfg),
    pelvis: pelvisPart(cfg),
    torso: stretchY(torsoPart(cfg), TORSO_Y),
    head: scalePart(headPart(cfg), HEAD_SCALE),
    weapon: cls.gear ? gearPart(cls.gear) : weaponPart(cfg.weapon),
    ...(cls.stretch ? { stretch: cls.stretch } : {}),
    blood: 'red',
    voice: fem ? 'heroine' : 'hero',
    color: CLOTHS[cfg.cloth] ?? CLOTHS[0],
    skin: [SKINS[cfg.skin] ?? SKINS[0]],
    bend: true,
  };
}

const FIRST = ['KRAG', 'THORNA', 'BRUNO', 'ZUGGA', 'HILDA', 'GROMM', 'SVEN', 'OLGA', 'RAGNOK', 'BORGHILD', 'DUNK', 'VEX', 'URSULA', 'TORBJORN', 'MOGRA', 'BRAK'];
const EPITHET = ['THE UNWASHED', 'THE MOIST', 'THE LOUD', 'OF THE BIG HAM', 'BONEBITER', 'THE SLIGHTLY TALL', 'SKULLKICKER', 'THE HANDSOME(ISH)', 'TAXDODGER', 'THE UNREASONABLE', 'GOBLINPUNTER', 'THE OILED'];
export function randomName() {
  return FIRST[Math.floor(Math.random() * FIRST.length)] + ' ' + EPITHET[Math.floor(Math.random() * EPITHET.length)];
}

export function randomHero(allowed: (key: string, i: number) => boolean = () => true): HeroConfig {
  const cfg = { name: randomName() } as HeroConfig;
  for (const k of Object.keys(HERO_OPTIONS) as (keyof typeof HERO_OPTIONS)[]) {
    const n = HERO_OPTIONS[k].length;
    let i = Math.floor(Math.random() * n);
    for (let tries = 0; tries < n && !allowed(k, i); tries++) i = (i + 1) % n;
    cfg[k] = i;
  }
  if (cfg.body === 1 && Math.random() < 0.85) cfg.beard = 0;
  return withClassRules(cfg, (key) => allowed(key.split(':')[0], +key.split(':')[1]));
}
