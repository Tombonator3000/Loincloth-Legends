// Felles typer og hjelpere for figurtegning.
import { Pen, shade } from '../draw';
import type { Voice } from '../../core/audio';
import type { HeroAppearance } from '../../data/hero-appearance';

export type PartName = 'legB' | 'legF' | 'pelvis' | 'torso' | 'armB' | 'head' | 'armF' | 'weapon';
/** Figur-id. Registeret er åpent, så nye figurer (også heltebyggeren) kan legges til i kjøretid. */
export type CharId = string;

export interface PartDef {
  w: number;
  h: number;
  ox: number;
  oy: number;
  draw: (p: Pen) => void;
}

export type V2 = [number, number];
/**
 * Leddene i delenes rom. Figuren står i trekvart profil mot høyre: shF er den nære skulderen der våpenarmen sitter
 * (til venstre i bildet, armen tegnes foran), shB den fjerne (til høyre, armen tegnes bak overkroppen). En malt
 * overkropp gir riggen sine egne skulderledd (shoulders i manifestet, se gfx/rig.ts).
 */
export interface Joints { hipF: V2; hipB: V2; neck: V2; shF: V2; shB: V2; hand: V2 }
export interface CharDef {
  id: CharId;
  name: string;
  scale: number;
  hipY: number;
  joints: Joints;
  leg: PartDef;
  arm: PartDef;
  pelvis: PartDef;
  torso: PartDef;
  head: PartDef;
  weapon?: PartDef;
  blood: 'red' | 'bone' | 'green' | 'lava';
  voice: Voice;
  /** Farge til portrett-bakgrunn i HUD. */
  color: string;
  /** Hudfarger (hex). Huden får oljeglans i lyset (se gfx/charlight.ts); mørkere nyanser regnes med. */
  skin?: string[];
  /** Deler som deles med en annen figur (PNG-erstatninger hentes da fra den figuren). */
  inherit?: Partial<Record<'leg' | 'arm' | 'pelvis' | 'torso' | 'head' | 'weapon', CharId>>;
  /** Separate malte lag på modulære hoder og hudfarge på deler med uttrykkelige masker. */
  appearance?: HeroAppearance;
}

export const HERO_J: Joints = { hipF: [0.07, 0], hipB: [-0.08, 0], neck: [0.03, 0.78], shF: [-0.15, 0.68], shB: [0.15, 0.66], hand: [0, -0.6] };
/**
 * Heroiske proporsjoner (konseptbildene, se docs/STYLE_TARGET.md): lengre bein og armer og mindre hode enn
 * de gamle chibi-kroppene, men samme tegnestil. Totalhøyden på skjermen er omtrent den samme.
 */
export const LEG_L = 1.62;
export const ARM_L = 1.3;
/** Overkroppen strekkes litt i høyden (se stretchY i muscle.ts). */
export const TORSO_Y = 1.14;
/** Heltene: brede skuldre, lange bein, store armer (se muscle.ts). */
export const HERO_BIG_J: Joints = { hipF: [0.08, 0], hipB: [-0.08, 0], neck: [0.03, 0.8 * TORSO_Y], shF: [-0.41, 0.58 * TORSO_Y], shB: [0.42, 0.56 * TORSO_Y], hand: [0.035, -0.5 * ARM_L] };
export const HERO_HIP_Y = 0.645 * LEG_L - 0.005;
/** Hvor stort hodet tegnes i forhold til resten (var 1.3 med chibi-proporsjoner). */
export const HEAD_SCALE = 0.84;
export const skinD = (s: string) => shade(s, -0.22);

export function heroLeg(skin: string, pants: string | null, boot: string, bootTrim: string, foot: string): PartDef {
  return {
    w: 0.62, h: 1.02, ox: 0.24, oy: 0.92,
    draw: (p) => {
      p.limbs([[[0, 0, 0.03, -0.4], 0.14], [[0.03, -0.4, 0.01, -0.64], 0.115]], pants ?? skin);
      p.line([-0.05, -0.43, 0.08, -0.41], 0.02, skinD(pants ?? skin));
      p.blob([-0.15, -0.5, 0.0, -0.47, 0.16, -0.5, 0.17, -0.74, 0.0, -0.78, -0.16, -0.74], boot);
      p.fur(-0.17, 0.18, -0.5, 0.07, 7, bootTrim, 1);
      p.rrect(-0.15, -0.88, 0.46, 0.16, 0.07, foot);
      p.line([0.06, -0.86, 0.06, -0.74], 0.018, shade(foot, -0.4));
    },
  };
}

export function heroArm(skin: string, bracer: string, sleeve: string | null): PartDef {
  return {
    w: 0.48, h: 0.96, ox: 0.24, oy: 0.78,
    draw: (p) => {
      p.limbs([[[0, 0, 0.0, -0.32], 0.125], [[0, -0.32, 0, -0.52], 0.1]], skin);
      p.shaded((c) => c.ellipse(0.05, -0.16, 0.1, 0.13, 0, 0, Math.PI * 2), skin, skinD(skin), (c) => c.rect(-0.2, -0.4, 0.2, 0.5));
      p.rrect(-0.125, -0.55, 0.25, 0.2, 0.04, bracer);
      p.line([-0.11, -0.4, 0.11, -0.4], 0.02, shade(bracer, -0.4));
      p.line([-0.11, -0.49, 0.11, -0.49], 0.02, shade(bracer, -0.4));
      p.ell(0, -0.63, 0.12, 0.11, skin);
      p.line([0.03, -0.57, 0.11, -0.6], 0.018);
      p.line([0.03, -0.63, 0.12, -0.65], 0.018);
      if (sleeve) p.ell(0, -0.02, 0.15, 0.13, sleeve);
      else p.shaded((c) => c.ellipse(0, -0.02, 0.135, 0.125, 0, 0, Math.PI * 2), skin, skinD(skin), (c) => c.rect(-0.2, -0.2, 0.12, 0.3));
    },
  };
}
