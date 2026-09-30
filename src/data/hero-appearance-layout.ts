/** Plassering i det beskårne grunnhodet. Koordinater og bredde er brøker av hodebildet. */
export interface AppearancePlacement {
  at: readonly [number, number];
  anchor: readonly [number, number];
  width: number;
  /** Valgfri høyde som brøk av grunnhodets høyde. Uten den beholdes bildets proporsjoner. */
  height?: number;
  rotation?: number;
  layer?: 'head' | 'back' | 'front';
}

/** Bare iris, aldri det hvite i øyet eller øyelokket. */
export interface IrisEllipse {
  at: readonly [number, number];
  radius: readonly [number, number];
  rotation?: number;
}

export interface HeadAppearanceLayout {
  overlays: Record<string, AppearancePlacement>;
  eyes?: readonly [IrisEllipse, IrisEllipse];
}

/** Måles mot de beskårne filene, ikke lerretet før innlesing. */
export const HERO_APPEARANCE_LAYOUTS: Record<string, HeadAppearanceLayout> = {
  forge_custom_m: {
    eyes: [
      { at: [.639, .311], radius: [.0233, .0173] },
      { at: [.907, .347], radius: [.0174, .0159] },
    ],
    overlays: {
      appearance_hair_crop: {"at": [0.515, 0.215], "anchor": [0.5, 0.5], "width": 1.1, "height": 0.55, "layer": "head"},
      appearance_hair_wild: {"at": [0.5, 0.15], "anchor": [0.5, 0.5], "width": 1.2, "height": 0.46, "layer": "head"},
      appearance_hair_mohawk: {"at": [0.535, 0.09], "anchor": [0.5, 0.5], "width": 0.92, "height": 0.64, "layer": "head", "rotation": 0.22},
      appearance_hair_braids: {"at": [0.51, 0.225], "anchor": [0.5, 0.5], "width": 1.08, "height": 0.52, "layer": "head"},
      appearance_hair_topknot: {"at": [0.485, 0.135], "anchor": [0.5, 0.5], "width": 1.13, "height": 0.79, "layer": "head"},
      appearance_hair_long: {"at": [0.515, 0.26], "anchor": [0.5, 0.5], "width": 1.23, "height": 0.67, "layer": "head"},
      appearance_hair_long_back: {"at": [0.44, 0.535], "anchor": [0.5, 0.5], "width": 1.38, "height": 1.16, "layer": "back"},
      appearance_headgear_crown: { at: [.5, .19], anchor: [.5, .8], width: .94 },
      appearance_headgear_headband: { at: [.5, .17], anchor: [.5, .34], width: 1.03 },
      appearance_headgear_horned: { at: [.72, .25], anchor: [.70, .55], width: 1.12 },
      appearance_headgear_skull: { at: [.68, .25], anchor: [.70, .46], width: 1.20 },
      appearance_beard_full: { at: [.765, .560], anchor: [.73141, .52996], width: .85, layer: 'front' },
      appearance_beard_braided: { at: [.765, .560], anchor: [.72345, .30055], width: .85, layer: 'front' },
      appearance_beard_mustache: { at: [.797, .529], anchor: [.665, .220], width: .49, layer: 'front' },
    },
  },
  forge_custom_f: {
    eyes: [
      { at: [.652, .314], radius: [.0235, .0172] },
      { at: [.928, .352], radius: [.0176, .0158] },
    ],
    overlays: {
      appearance_hair_crop: {"at": [0.515, 0.215], "anchor": [0.5, 0.5], "width": 1.1, "height": 0.55, "layer": "head"},
      appearance_hair_wild: {"at": [0.5, 0.15], "anchor": [0.5, 0.5], "width": 1.2, "height": 0.46, "layer": "head"},
      appearance_hair_mohawk: {"at": [0.535, 0.09], "anchor": [0.5, 0.5], "width": 0.92, "height": 0.64, "layer": "head", "rotation": 0.22},
      appearance_hair_braids: {"at": [0.51, 0.225], "anchor": [0.5, 0.5], "width": 1.08, "height": 0.52, "layer": "head"},
      appearance_hair_topknot: {"at": [0.485, 0.135], "anchor": [0.5, 0.5], "width": 1.13, "height": 0.79, "layer": "head"},
      appearance_hair_long: {"at": [0.515, 0.26], "anchor": [0.5, 0.5], "width": 1.23, "height": 0.67, "layer": "head"},
      appearance_hair_long_back: {"at": [0.44, 0.535], "anchor": [0.5, 0.5], "width": 1.38, "height": 1.16, "layer": "back"},
      appearance_headgear_crown: { at: [.5, .19], anchor: [.5, .8], width: .94 },
      appearance_headgear_headband: { at: [.5, .17], anchor: [.5, .34], width: 1.03 },
      appearance_headgear_horned: { at: [.72, .25], anchor: [.70, .55], width: 1.12 },
      appearance_headgear_skull: { at: [.68, .25], anchor: [.70, .46], width: 1.20 },
      appearance_beard_full: { at: [.766, .571], anchor: [.73141, .52996], width: .85, layer: 'front' },
      appearance_beard_braided: { at: [.766, .571], anchor: [.72345, .30055], width: .85, layer: 'front' },
      appearance_beard_mustache: { at: [.794, .533], anchor: [.665, .220], width: .49, layer: 'front' },
    },
  },
};
