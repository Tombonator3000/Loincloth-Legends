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
  /** Når en kjempe er i bildet eller to helter sprer seg (Stage.camPull): største uttrekk. */
  pullZ: 3.4,
  pullY: 0.9,
};

/** Marginene er for kroppen i kampbeltets fremre kant, der perspektivet gir minst plass. */
export const COOP_CAM = {
  nearZ: 2.6,
  headY: 3.0,
  edge: 0.94,
  bodyPad: 0.8,
  /** Litt rom utover kroppene utløser uttrekket før en helt møter bildekanten. */
  anticipation: 1.2,
};

/** Halv synlig bredde ved et punkt på kampbeltet. Samme kameravinkel som StageScene bruker. */
export function stageCameraHalfWidth(fov: number, aspect: number, pull: number, z = COOP_CAM.nearZ, y = COOP_CAM.headY) {
  const cameraZ = (aspect < 1.2 ? STAGE_CAM.zNarrow : STAGE_CAM.z) + pull * STAGE_CAM.pullZ;
  const cameraY = STAGE_CAM.y + pull * STAGE_CAM.pullY;
  const tilt = STAGE_CAM.y - STAGE_CAM.lookY;
  const distance = Math.hypot(cameraZ, tilt);
  const depth = ((cameraZ - z) * cameraZ + (cameraY - y) * tilt) / distance;
  return Math.max(0, depth * Math.tan(fov * Math.PI / 360) * aspect) * COOP_CAM.edge;
}

/** Uttrekk 0..1 ut fra avstand mellom levende helter. Bruk grunnbildet, aldri allerede utvidet bilde. */
export function coopCameraFrame(fov: number, aspect: number, span: number) {
  const base = stageCameraHalfWidth(fov, aspect, 0);
  const full = stageCameraHalfWidth(fov, aspect, 1);
  // Et stående mobilbilde har ikke plass til samme 1,5 meter fremoversikt som en bred skjerm.
  const lead = Math.min(1.5, base * 0.25);
  const needed = Math.max(0, span) * 0.5 + lead + COOP_CAM.anticipation;
  const pull = Math.max(0, Math.min(1, (needed - base) / Math.max(0.001, full - base)));
  return { pull, lead };
}
