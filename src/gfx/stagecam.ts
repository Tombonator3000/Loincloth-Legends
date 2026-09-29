// Kameraet på brettene (StageScene i app/game.ts). Nærmere og lavere enn før, så figurene fyller mer av bildet
// og bakgrunnen reiser seg bak dem som i konseptbildene (docs/STYLE_TARGET.md). Forgrunnen i miljøene plasseres
// etter avstanden her (foreground() i env/common.ts), og Stage regner bredden på bildet ut fra kameraet.
export const STAGE_CAM = {
  /** Høyden kameraet står i. */
  y: 3.6,
  /** Avstand til kamplinja (z = 0) på vanlige skjermer. */
  z: 11.4,
  /** Avstand på smale skjermer (stående mobil), der bildet ellers blir for trangt. */
  zNarrow: 15,
  /** Høyden kameraet ser mot midt i bildet. */
  lookY: 1.8,
  /** Når en kjempe er i bildet (Stage.camPull): så mye lenger unna og så mye høyere. */
  pullZ: 3.4,
  pullY: 0.9,
};
