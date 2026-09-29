// Lys på figurene. Figurene er flate tegninger (cutout-plan), så volumet lages ut fra selve tegningen:
// avstanden til konturen gir avrundede kanter, blekkstrekene inni blir furer mellom musklene, og fargene
// avgjør hvor blankt det er (olje på huden, stål og gull glinser, klær er matte). Skyggeleggeren bruker
// scenens egne lys (himmel, sol, fakler, lyn og eksplosjoner fra LightPool i vfx.ts), så figurene får rødt
// fakkellys og blått lynlys slik som i konseptbildene (docs/STYLE_TARGET.md).
import * as THREE from 'three';

const INF = 1e20;

/** Én dimensjon av eksakt avstandstransform (Felzenszwalb og Huttenlocher), kvadrerte avstander. */
function edt1d(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Uint16Array, z: Float64Array) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}

/** Avstand (i piksler) fra hver piksel til nærmeste frø. grid: 0 i frøene, INF ellers. Skrives over. */
function distanceField(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), z = new Float64Array(n + 1), v = new Uint16Array(n);
  for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
  for (let i = 0; i < grid.length; i++) grid[i] = Math.sqrt(grid[i]);
}

/** Kvartsirkel: bratt ved kanten, flat innover. d og R i piksler. */
const dome = (d: number, R: number) => {
  if (d >= R) return 1;
  const t = 1 - d / R;
  return Math.sqrt(1 - t * t);
};

/** Binomial uskarphet (1 2 1) i begge retninger. */
function blur(src: Float32Array, w: number, h: number, passes: number) {
  const tmp = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        tmp[i] = (src[x > 0 ? i - 1 : i] + 2 * src[i] + src[x < w - 1 ? i + 1 : i]) * 0.25;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        src[i] = (tmp[y > 0 ? i - w : i] + 2 * tmp[i] + tmp[y < h - 1 ? i + w : i]) * 0.25;
      }
  }
}

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Glansklasser: B = styrke, A = type (0 matt stoff/lær, 0.5 hud med olje, 1 metall)
const MATTE: [number, number] = [0.2, 0];
const INKY: [number, number] = [0, 0];
const SKIN: [number, number] = [0.72, 0.5];
const STEEL: [number, number] = [1, 1];
const GOLD: [number, number] = [0.9, 1];
/** Svakere metallglans for malte PNG-deler. */
const SOFT_METAL: [number, number] = [0.45, 1];

/**
 * Hud gjenkjennes som en mørkere eller litt lysere utgave av en av hudfargene (shade() i draw.ts ganger
 * fargen med en faktor), så skyggepartiene på huden får olje de også.
 */
function classify(r: number, g: number, b: number, skins: [number, number, number][]): [number, number] {
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Blekket (#1a0f0a) og halvveis blandede kantpiksler; mørkt hår og mørk rustning er lysere enn dette
  if (luma < 0.095) return INKY;
  for (const s of skins) {
    const k = (r * s[0] + g * s[1] + b * s[2]) / (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
    if (k < 0.5 || k > 1.12) continue;
    const dr = r - k * s[0], dg = g - k * s[1], db = b - k * s[2];
    if (dr * dr + dg * dg + db * db < 16 * 16) return SKIN;
  }
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const v = mx / 255, sat = mx > 0 ? (mx - mn) / mx : 0;
  if (sat < 0.2 && v > 0.5) return STEEL;
  if (sat > 0.42 && v > 0.55 && mx === r) {
    // Gull og messing: gul til oransjegul
    const hue = 60 * ((g - b) / Math.max(1, mx - mn));
    if (hue > 32 && hue < 62) return GOLD;
  }
  return MATTE;
}

/**
 * Malt hud (PNG fra ChatGPT): varm, middels mettet og ikke for mørk. Mørk hud i skygge blir matt, og kobberrødt
 * hår er for mettet til å regnes som hud. Brunt lær er for mørkt.
 */
function paintedSkin(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx !== r || mx < 115) return false;
  const sat = (mx - mn) / mx;
  const hue = 60 * ((g - b) / Math.max(1, mx - mn));
  return sat > 0.18 && sat < 0.62 && hue > 8 && hue < 45;
}

/**
 * Lag relieffkart for en tegning: R og G er normalen (tangentrom, y opp), B er glansstyrke, A er glanstype.
 * ppu er piksler per verdensenhet, så avrundingen blir like stor på alle figurer uansett oppløsning.
 * painted gjelder malte PNG-deler: der er mørke partier skygger og ikke blekkstreker, så volumet kommer fra
 * omrisset og en svak høyde fra lysheten (ringbrynje, muskler og lær får litt relieff i scenelyset).
 */
export function reliefTexture(cv: HTMLCanvasElement, ppu: number, skin: string[] = [], painted = false): THREE.DataTexture {
  const w = cv.width, h = cv.height, n = w * h;
  const src = cv.getContext('2d')!.getImageData(0, 0, w, h).data;
  const skins = skin.map(hexRgb);
  const edge = new Float64Array(n);
  const grooves = new Float64Array(n);
  const cls = new Float32Array(n * 2);
  const luma = painted ? new Float32Array(n) : null;
  for (let i = 0; i < n; i++) {
    const a = src[i * 4 + 3];
    const inside = a > 127;
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    let c = inside ? classify(r, g, b, skins) : MATTE;
    if (luma) {
      luma[i] = inside ? (0.299 * r + 0.587 * g + 0.114 * b) / 255 : 0;
      if (c === INKY) c = MATTE;
      else if (inside && c === MATTE && paintedSkin(r, g, b)) c = SKIN;
      // Malt bilde har egne høylys, og hvit pels, bein og blondt hår ville fått full metallglans av fargen alene
      else if (c === STEEL || c === GOLD) c = SOFT_METAL;
    }
    cls[i * 2] = c[0];
    cls[i * 2 + 1] = c[1];
    edge[i] = inside ? INF : 0;
    grooves[i] = inside && c !== INKY ? INF : 0;
  }
  distanceField(edge, w, h);
  distanceField(grooves, w, h);

  // Høyde: hver flate mellom blekkstrekene blir en pute (konturstreken ligger utenpå, så kanten må regnes
  // fra innsiden av streken, ellers havner rundingen og glansen under det svarte), pluss en slak bue over
  // hele delen så store flater som brystkassa ikke blir helt flate.
  const R1 = 0.085 * ppu, R3 = 0.3 * ppu;
  const hgt = new Float32Array(n);
  if (luma) blur(luma, w, h, 1);
  for (let i = 0; i < n; i++) {
    const dT = edge[i];
    if (dT <= 0) continue;
    hgt[i] = R1 * 0.9 * dome(grooves[i], R1) + R3 * 0.25 * dome(dT, R3);
    if (luma) hgt[i] += luma[i] * 0.008 * ppu * Math.min(1, dT / 3);
  }
  blur(hgt, w, h, 2);

  const out = new Uint8Array(n * 4);
  const nrm = new Float32Array(n * 3);
  const inside = new Uint8Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (edge[i] <= 0) continue;
      inside[i] = 1;
      // Lerretet har y nedover, normalkartet y opp
      const gx = (hgt[x < w - 1 ? i + 1 : i] - hgt[x > 0 ? i - 1 : i]) * 0.5;
      const gy = (hgt[y > 0 ? i - w : i] - hgt[y < h - 1 ? i + w : i]) * 0.5;
      const l = Math.hypot(gx, gy, 1);
      nrm[i * 3] = -gx / l;
      nrm[i * 3 + 1] = -gy / l;
      nrm[i * 3 + 2] = 1 / l;
    }
  // Skyv kantnormalene to piksler ut i det gjennomsiktige, så filtreringen i kanten ikke trekker mot flat
  for (let pass = 0; pass < 2; pass++) {
    const grow: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (inside[i]) continue;
        let sx = 0, sy = 0, sz = 0, sb = 0, sa = 0, k = 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j < 0 || !inside[j]) continue;
          sx += nrm[j * 3]; sy += nrm[j * 3 + 1]; sz += nrm[j * 3 + 2]; sb += cls[j * 2]; sa += cls[j * 2 + 1]; k++;
        }
        if (!k) continue;
        const l = Math.hypot(sx, sy, sz) || 1;
        nrm[i * 3] = sx / l; nrm[i * 3 + 1] = sy / l; nrm[i * 3 + 2] = sz / l;
        cls[i * 2] = sb / k; cls[i * 2 + 1] = sa / k;
        grow.push(i);
      }
    for (const i of grow) inside[i] = 1;
  }
  // DataTexture vendes ikke ved opplasting, så rad 0 i dataene er nederste rad i tegningen
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = ((h - 1 - y) * w + x) * 4;
      if (!inside[i]) {
        out[o] = 128; out[o + 1] = 128; out[o + 2] = 0; out[o + 3] = 0;
        continue;
      }
      out[o] = Math.round((nrm[i * 3] * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((nrm[i * 3 + 1] * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round(cls[i * 2] * 255);
      out[o + 3] = Math.round(cls[i * 2 + 1] * 255);
    }
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Maleriske konturer: blekkstrekene farges med en mørk utgave av fargen ved siden av, så figuren ser malt ut
 * i stedet for tegnet med svart tusj (Tom: ikke tegneserie). Tre runder spredning fyller tynne streker helt,
 * mens tykke blekkflater (pupiller) beholder en mørk kjerne. Kjøres etter reliefTexture, som trenger strekene.
 */
export function paintInk(cv: HTMLCanvasElement, darken = 0.36) {
  const w = cv.width, h = cv.height, n = w * h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const ink = new Uint8Array(n);
  const has = new Uint8Array(n);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (d[i * 4 + 3] < 40) continue;
    const luma = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    if (luma < 0.1) ink[i] = 1;
    else if (d[i * 4 + 3] > 127) {
      has[i] = 1;
      col[i * 3] = d[i * 4];
      col[i * 3 + 1] = d[i * 4 + 1];
      col[i * 3 + 2] = d[i * 4 + 2];
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const grow: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!ink[i] || has[i]) continue;
        let r = 0, g = 0, b = 0, k = 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j < 0 || !has[j]) continue;
          r += col[j * 3];
          g += col[j * 3 + 1];
          b += col[j * 3 + 2];
          k++;
        }
        if (!k) continue;
        col[i * 3] = r / k;
        col[i * 3 + 1] = g / k;
        col[i * 3 + 2] = b / k;
        grow.push(i);
      }
    for (const i of grow) has[i] = 1;
  }
  for (let i = 0; i < n; i++) {
    if (!ink[i] || !has[i]) continue;
    d[i * 4] = Math.round(col[i * 3] * darken);
    d[i * 4 + 1] = Math.round(col[i * 3 + 1] * darken);
    d[i * 4 + 2] = Math.round(col[i * 3 + 2] * darken);
  }
  ctx.putImageData(img, 0, 0);
}

let flat: THREE.DataTexture | null = null;
/** Flat relieff (normal rett mot kamera, matt) for deler uten eget kart. */
export function flatRelief() {
  if (!flat) {
    flat = new THREE.DataTexture(new Uint8Array([128, 128, 255 * 0.2, 0]), 1, 1);
    flat.needsUpdate = true;
  }
  return flat;
}

/**
 * Felles innstillinger for alle figurer. gain kalibrerer lyset mot den gamle, uskyggelagte looken
 * (tre.js deler på pi i sine materialer, figurene skal være lesbare foran miljøet). fill er et mykt lys fra
 * kamerasiden så figurene aldri blir svarte silhuetter.
 */
export const charUniforms = {
  uCharGain: { value: 0.85 },
  uAmb: { value: 0.62 },
  uFill: { value: new THREE.Color(0.36, 0.35, 0.33) },
  uOil: { value: 1 },
  uRim: { value: 1.3 },
  uBump: { value: 1 },
};

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vViewPos;
varying vec3 vT;
varying vec3 vB;
varying vec3 vN;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  // Tegningens x og y i kamerarommet (speilvendt figur gir speilvendt x, som tegningen)
  vT = mat3(modelViewMatrix) * vec3(1.0, 0.0, 0.0);
  vB = mat3(modelViewMatrix) * vec3(0.0, 1.0, 0.0);
  vN = normalMatrix * vec3(0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
#include <common>
#include <lights_pars_begin>
uniform sampler2D map;
uniform sampler2D relief;
uniform vec3 tint;
uniform float flash;
uniform vec3 flashColor;
uniform float opacity;
uniform float uCharGain;
uniform float uAmb;
uniform vec3 uFill;
uniform float uOil;
uniform float uRim;
uniform float uBump;
varying vec2 vUv;
varying vec3 vViewPos;
varying vec3 vT;
varying vec3 vB;
varying vec3 vN;

// Myk (wrap) diffus, Blinn-glans og motlys: lys bakfra fanges av kantene som vender mot det
void charLight(vec3 col, vec3 L, vec3 N, vec3 N0, vec3 V, float shin, float specK, inout vec3 diff, inout vec3 spec) {
  float ndl = dot(N, L);
  diff += col * max(0.0, (ndl + 0.25) / 1.25);
  vec3 H = normalize(L + V);
  float s = pow(max(dot(N, H), 0.0), shin) * (shin + 2.0) * 0.06;
  spec += col * s * specK * smoothstep(-0.1, 0.3, ndl);
  // Kantlyset følger hvor mye flaten heller mot lyset sett langs planet, så hver muskel får en lysende kant
  // på siden som vender mot lyset (bredt nok til å synes, ikke bare den ytterste pikselen)
  float back = clamp(0.2 - dot(N0, L), 0.0, 1.0);
  vec3 lat = L - N0 * dot(L, N0);
  float side = dot(N - N0 * dot(N, N0), lat / max(length(lat), 1e-3));
  diff += col * back * smoothstep(0.08, 0.6, side) * uRim;
}

void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.06) discard;
  vec3 albedo = c.rgb * tint;
  vec4 rel = texture2D(relief, vUv);
  vec2 nxy = (rel.xy * 2.0 - 1.0) * uBump;
  float nz = sqrt(max(0.02, 1.0 - dot(nxy, nxy)));
  vec3 N0 = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 N = normalize(normalize(vT) * nxy.x + normalize(vB) * nxy.y + N0 * nz);
  vec3 V = normalize(-vViewPos);
  float kind = rel.a;
  float metal = step(0.8, kind);
  float oily = step(0.3, kind) * (1.0 - metal);
  float shin = mix(10.0, 70.0, kind);
  float specK = rel.b * mix(1.0, uOil, oily);

  // Omgivelseslys (himmel og bakke) dempes så retningslysene får mer å si, og kanten fanger litt himmel
  vec3 amb = ambientLightColor;
  vec3 sky = vec3(0.0);
  #if NUM_HEMI_LIGHTS > 0
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
    amb += getHemisphereLightIrradiance(hemisphereLights[i], N);
    sky += hemisphereLights[i].skyColor;
  }
  #endif
  float fres = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  vec3 diff = amb * uAmb + sky * fres * fres * fres * 0.35;
  vec3 spec = vec3(0.0);
  charLight(uFill, V, N, N0, V, shin, 0.0, diff, spec);
  #if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) charLight(directionalLights[i].color, directionalLights[i].direction, N, N0, V, shin, specK, diff, spec);
  #endif
  #if NUM_POINT_LIGHTS > 0
  IncidentLight pl;
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    getPointLightInfo(pointLights[i], vViewPos, pl);
    if (pl.visible) charLight(pl.color, pl.direction, N, N0, V, shin, specK, diff, spec);
  }
  #endif
  // Metall farger glansen, olje og stoff gir hvit glans
  vec3 specCol = mix(vec3(1.0), albedo * 1.6 + 0.06, metal);
  vec3 col = (albedo * diff + spec * specCol) * uCharGain;
  col = mix(col, flashColor, flash);
  gl_FragColor = vec4(col, c.a * opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Materiale for en figurdel. Uniformnavnene map, tint, flash, flashColor og opacity brukes av riggene. */
export function charMaterial(tex: THREE.Texture, relief: THREE.Texture | null, tint = 1) {
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    ...charUniforms,
    map: { value: tex },
    relief: { value: relief ?? flatRelief() },
    tint: { value: new THREE.Color(tint, tint, tint) },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color(1, 1, 1) },
    opacity: { value: 1 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: true,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    transparent: false,
  });
  // Skyggepasset i three.js alfatester med material.map (og 0.5 når alphaToCoverage er på), så figurene
  // kaster skygge med riktig omriss når meshet har castShadow
  Object.assign(m, { map: tex });
  return m;
}
