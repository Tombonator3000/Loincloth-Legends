// Overflatedetalj for alle miljømaterialer (lit() i common.ts): små ujevnheter i normalen, skitt og
// fargevariasjon og ulik ruhet, projisert triplanart i verdensrommet. Da trenger ikke geometrien UV-er, og
// store flater og gjentatte teksturer slutter å se glatte og like ut. Slås av på LOW.
import * as THREE from 'three';
import { periodicNoise, worley, fbm } from '../noise';
import { gfxState } from '../post';

let maps: { n: THREE.DataTexture; g: THREE.DataTexture } | null = null;

/** Detaljkart (flisbare): normal fra ru stein og sprekker, og R = farge, G = ruhet, B = krok (AO). */
function detailMaps() {
  if (maps) return maps;
  const S = 256;
  const pn = periodicNoise(31), pn2 = periodicNoise(47), wn = worley(59);
  const hgt = new Float32Array(S * S);
  const g = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S, v = (y + 0.5) / S;
      const rough = fbm(pn, u, v, 8, 5);
      const w = wn(u, v, 9);
      const crack = 1 - Math.min(1, (w.f2 - w.f1) / 0.05);
      const pit = w.f1 < 0.12 && w.id < 0.3 ? 1 - w.f1 / 0.12 : 0;
      const h = rough * 0.55 - crack * 0.45 - pit * 0.35;
      const i = y * S + x;
      hgt[i] = h;
      const dirt = fbm(pn2, u, v, 3, 4);
      g[i * 4] = Math.round((0.5 + dirt * 0.45 + rough * 0.12) * 255);
      g[i * 4 + 1] = Math.round((0.5 + fbm(pn2, u + 0.5, v, 6, 3) * 0.45) * 255);
      g[i * 4 + 2] = Math.round(Math.max(0, 1 - crack * 0.7 - pit * 0.5) * 255);
      g[i * 4 + 3] = 255;
    }
  const n = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const at = (xx: number, yy: number) => hgt[((yy + S) % S) * S + ((xx + S) % S)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.5, dy = (at(x, y + 1) - at(x, y - 1)) * 2.5;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      n[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
      n[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
      n[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      n[i + 3] = 255;
    }
  const tex = (d: Uint8Array) => {
    const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  maps = { n: tex(n), g: tex(g) };
  return maps;
}

export interface SurfaceOpts {
  /** Hvor mange flisrepetisjoner per verdensenhet. */
  scale?: number;
  /** Styrke på ujevnhetene i normalen. */
  normal?: number;
  /** Hvor mye skitt og fargevariasjon. */
  albedo?: number;
  /** Hvor mye ruheten varierer. */
  rough?: number;
}

const VERT_HEAD = /* glsl */ `
varying vec3 vSurfPos;
varying vec3 vSurfN;`;
const VERT_BODY = /* glsl */ `
{
  vec4 sfP = vec4(transformed, 1.0);
  vec3 sfN = objectNormal;
  #ifdef USE_INSTANCING
  sfP = instanceMatrix * sfP;
  sfN = mat3(instanceMatrix) * sfN;
  #endif
  vSurfPos = (modelMatrix * sfP).xyz;
  vSurfN = normalize(mat3(modelMatrix) * sfN);
}`;
const FRAG_HEAD = /* glsl */ `
uniform sampler2D uSurfN;
uniform sampler2D uSurfG;
uniform vec4 uSurf;
varying vec3 vSurfPos;
varying vec3 vSurfN;`;
// Vekter og detaljkart samples én gang, så brukes de til farge, ruhet og normal
const FRAG_SAMPLE = /* glsl */ `
vec3 sfNrm = normalize(vSurfN);
vec3 sfW = pow(abs(sfNrm), vec3(4.0));
sfW /= (sfW.x + sfW.y + sfW.z);
vec2 sfUX = vSurfPos.zy * uSurf.x;
vec2 sfUY = vSurfPos.xz * uSurf.x;
vec2 sfUZ = vSurfPos.xy * uSurf.x;
vec4 sfG = texture2D(uSurfG, sfUX) * sfW.x + texture2D(uSurfG, sfUY) * sfW.y + texture2D(uSurfG, sfUZ) * sfW.z;`;
const FRAG_ALBEDO = /* glsl */ `
diffuseColor.rgb *= (1.0 + (sfG.r - 0.5) * uSurf.z) * (1.0 - (1.0 - sfG.b) * uSurf.z * 0.6);`;
const FRAG_ROUGH = /* glsl */ `
roughnessFactor = clamp(roughnessFactor * (1.0 + (sfG.g - 0.5) * uSurf.w), 0.04, 1.0);`;
// Triplanar normal med «whiteout»-blanding per projeksjon (Ben Golus), i verdensrom og tilbake til kamerarom
const FRAG_NORMAL = /* glsl */ `
{
  vec3 tX = texture2D(uSurfN, sfUX).xyz * 2.0 - 1.0;
  vec3 tY = texture2D(uSurfN, sfUY).xyz * 2.0 - 1.0;
  vec3 tZ = texture2D(uSurfN, sfUZ).xyz * 2.0 - 1.0;
  tX.xy *= uSurf.y;
  tY.xy *= uSurf.y;
  tZ.xy *= uSurf.y;
  vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 bX = vec3(tX.xy + nW.zy, abs(tX.z) * nW.x);
  vec3 bY = vec3(tY.xy + nW.xz, abs(tY.z) * nW.y);
  vec3 bZ = vec3(tZ.xy + nW.xy, abs(tZ.z) * nW.z);
  vec3 wN = normalize(bX.zyx * sfW.x + bY.xzy * sfW.y + bZ.xyz * sfW.z);
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
}`;

/** Legg overflatedetalj på et MeshStandardMaterial. Gjør ingenting på LOW. */
export function withSurface(mat: THREE.MeshStandardMaterial, o: SurfaceOpts = {}) {
  if (gfxState.quality === 'low') return mat;
  const m = detailMaps();
  const v = new THREE.Vector4(o.scale ?? 0.55, o.normal ?? 0.7, o.albedo ?? 0.45, o.rough ?? 0.35);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSurfN = { value: m.n };
    sh.uniforms.uSurfG = { value: m.g };
    sh.uniforms.uSurf = { value: v };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>' + VERT_HEAD)
      .replace('#include <project_vertex>', '#include <project_vertex>' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>' + FRAG_HEAD)
      .replace('#include <logdepthbuf_fragment>', '#include <logdepthbuf_fragment>' + FRAG_SAMPLE)
      .replace('#include <color_fragment>', '#include <color_fragment>' + FRAG_ALBEDO)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + FRAG_NORMAL);
  };
  mat.customProgramCacheKey = () => 'surface';
  mat.userData.surface = v;
  return mat;
}
