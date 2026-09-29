// Fargegradering og linse per miljø (se gfx/post.ts). Eksponering, bloom og terskel virker i HDR,
// resten etter tonemapping. Skyggetone og høylystone gir hvert biom sin egen stemning.
import type { Grade } from '../post';

type G = Partial<Grade>;

export const GRADES: Record<string, G> = {
  // Gyllen solnedgang: varme høylys, lilla skygger
  grass: {
    exposure: 1.0, contrast: 1.06, saturation: 1.04, vibrance: 0.1, lift: [0.015, 0.0, 0.03], gain: [1.02, 1.0, 0.97],
    shadowTint: [0.93, 0.92, 1.08], highlightTint: [1.04, 1.0, 0.93], tint: 0.35, vignette: 0.38, grain: 0.28,
    bloom: 0.7, threshold: 1.0, knee: 0.5, dofFar: 0.4, dofNear: 0.65,
  },
  // Grønn, tung og fuktig: gulgrønne høylys, blågrønne skygger
  swamp: {
    exposure: 1.02, contrast: 1.08, saturation: 0.98, vibrance: 0.08, lift: [0.0, 0.015, 0.02], gain: [0.99, 1.02, 0.96],
    shadowTint: [0.9, 1.0, 1.0], highlightTint: [1.03, 1.03, 0.9], tint: 0.4, vignette: 0.45, grain: 0.35,
    bloom: 1.1, threshold: 0.85, knee: 0.45, dofFar: 0.85, dofNear: 0.65,
  },
  // Kaldt lys: blå skygger, litt varm sol, høy terskel så snøen ikke gløder
  frost: {
    exposure: 0.95, contrast: 1.05, saturation: 1.0, vibrance: 0.1, lift: [0.0, 0.01, 0.03], gain: [1.0, 1.0, 1.02],
    shadowTint: [0.9, 0.95, 1.1], highlightTint: [1.03, 1.01, 0.97], tint: 0.4, vignette: 0.3, grain: 0.22,
    bloom: 0.7, threshold: 1.15, knee: 0.4, dofFar: 0.7, dofNear: 0.55,
  },
  // Helvetesild: varme skygger, lava som gløder
  scorch: {
    exposure: 1.0, contrast: 1.06, saturation: 0.98, vibrance: 0.05, lift: [0.02, 0.0, 0.005], gain: [1.02, 0.99, 0.95],
    shadowTint: [1.02, 0.93, 0.95], highlightTint: [1.04, 1.0, 0.93], tint: 0.3, vignette: 0.48, grain: 0.32,
    bloom: 1.1, threshold: 1.0, knee: 0.5, dofFar: 0.8, dofNear: 0.6,
  },
  // Natt i tårnet: dyp lilla, varme fakler
  tower: {
    exposure: 1.06, contrast: 1.06, saturation: 0.94, vibrance: 0.08, lift: [0.015, 0.0, 0.03], gain: [1.0, 0.98, 1.02],
    shadowTint: [0.94, 0.9, 1.08], highlightTint: [1.06, 1.0, 0.92], tint: 0.35, vignette: 0.5, grain: 0.32,
    bloom: 1.1, threshold: 0.9, knee: 0.5, dofFar: 0.7, dofNear: 0.5,
  },
  // Nattleiren: kald måneblå natt, varmt bål, kraftig bloom på månen og ilden
  night: {
    exposure: 1.1, contrast: 1.08, saturation: 0.95, vibrance: 0.1, lift: [0.0, 0.01, 0.035], gain: [1.0, 0.99, 1.04],
    shadowTint: [0.86, 0.92, 1.12], highlightTint: [1.08, 1.0, 0.9], tint: 0.45, vignette: 0.55, grain: 0.34,
    bloom: 1.2, threshold: 0.85, knee: 0.5, dofFar: 0.75, dofNear: 0.55,
  },
  // Arenaene
  pit: {
    exposure: 1.0, contrast: 1.06, saturation: 1.0, vibrance: 0.08, lift: [0.015, 0.0, 0.01], gain: [1.02, 0.99, 0.96],
    shadowTint: [0.97, 0.92, 1.02], highlightTint: [1.05, 1.0, 0.93], tint: 0.35, vignette: 0.45, grain: 0.3,
    bloom: 0.75, threshold: 1.05, knee: 0.5, dofFar: 0.7, dofNear: 0.35,
  },
  ice: {
    exposure: 0.98, contrast: 1.05, saturation: 1.0, vibrance: 0.08, lift: [0.0, 0.01, 0.025], gain: [1.0, 1.0, 1.02],
    shadowTint: [0.9, 0.95, 1.08], highlightTint: [1.03, 1.01, 0.97], tint: 0.35, vignette: 0.4, grain: 0.26,
    bloom: 0.8, threshold: 1.05, knee: 0.45, dofFar: 0.7, dofNear: 0.35,
  },
  bone: {
    exposure: 1.0, contrast: 1.08, saturation: 0.98, vibrance: 0.06, lift: [0.015, 0.0, 0.02], gain: [1.01, 1.0, 0.98],
    shadowTint: [0.95, 0.9, 1.06], highlightTint: [1.04, 1.01, 0.94], tint: 0.35, vignette: 0.48, grain: 0.32,
    bloom: 0.85, threshold: 1.0, knee: 0.5, dofFar: 0.72, dofNear: 0.35,
  },
  // Verdenskartet sees ovenfra: lite dybdeskarphet, varm pergamentstemning
  map: {
    exposure: 1.02, contrast: 1.05, saturation: 1.06, vibrance: 0.15, lift: [0.015, 0.005, 0.02], gain: [1.03, 1.0, 0.95],
    shadowTint: [0.94, 0.92, 1.06], highlightTint: [1.06, 1.0, 0.9], tint: 0.45, vignette: 0.45, grain: 0.25,
    bloom: 0.8, threshold: 0.95, knee: 0.45, dofFar: 0.35, dofNear: 0.0,
  },
};
