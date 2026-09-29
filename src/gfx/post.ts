// Bildepipeline: HDR-scene, skygge i kroker (SSAO), bloom, dybdeskarphet, eksponering, tonemapping (én gang),
// gradering og linseeffekter. Rekkefølgen følger threejs-image-pipeline i prosjektbiblioteket:
//   scene (lineær HDR, MSAA) -> SSAO (fra dybden) -> bloom (mip-kjede) -> dybdeskarphet -> eksponering
//   -> tonemapping -> gradering -> vignett, korn, kromatisk aberrasjon -> sRGB.
// LOW tegner rett til skjermen med tonemapping i materialene og uten etterbehandling.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITIES: Quality[] = ['low', 'medium', 'high', 'ultra'];

/** Gjeldende grafikknivå for moduler som bygger innhold (tetthet på gress, skyggekart osv.). */
export const gfxState = { quality: 'high' as Quality };

/** 0 for LOW, 1 for MEDIUM, 2 for HIGH, 3 for ULTRA. */
export function qualityRank(q: Quality = gfxState.quality) {
  return QUALITIES.indexOf(q);
}

type RGB = [number, number, number];

/**
 * Gradering og linse for et biom. Eksponering, bloom og terskel virker i HDR før tonemapping.
 * Resten virker etter tonemapping i sRGB-rom (som en LUT).
 */
export interface Grade {
  exposure: number;
  contrast: number;
  saturation: number;
  /** Ekstra metning på farger som er lite mettet fra før. */
  vibrance: number;
  lift: RGB;
  gamma: RGB;
  gain: RGB;
  shadowTint: RGB;
  highlightTint: RGB;
  /** Styrken på split toning (skyggetone mot høylystone). */
  tint: number;
  vignette: number;
  grain: number;
  bloom: number;
  threshold: number;
  knee: number;
  /** 0..1: hvor mye bakgrunnen blir uskarp. */
  dofFar: number;
  /** 0..1: hvor mye forgrunnen blir uskarp. */
  dofNear: number;
  /** 0 = Khronos PBR Neutral (bevarer farger), 1 = ACES (mer kontrast). */
  tone: number;
  /** Styrken på skygge i kroker og der ting møtes (SSAO), 0 til 1. */
  ao: number;
}

export const DEFAULT_GRADE: Grade = {
  exposure: 1.0, contrast: 1.06, saturation: 1.08, vibrance: 0.15,
  lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
  shadowTint: [0.94, 0.96, 1.06], highlightTint: [1.05, 1.0, 0.93], tint: 0.5,
  vignette: 0.32, grain: 0.35, bloom: 0.9, threshold: 0.95, knee: 0.45,
  dofFar: 0.75, dofNear: 0.6, tone: 0, ao: 0.85,
};

const GRADE_KEYS = Object.keys(DEFAULT_GRADE) as (keyof Grade)[];

export function makeGrade(g: Partial<Grade> = {}): Grade {
  const o = {} as Record<string, unknown>;
  for (const k of GRADE_KEYS) {
    const v = (g[k] ?? DEFAULT_GRADE[k]) as number | RGB;
    o[k] = Array.isArray(v) ? [...v] : v;
  }
  return o as unknown as Grade;
}

interface Tier {
  maxDpr: number;
  budget: number;
  samples: number;
  mips: number;
  dof: boolean;
  shadows: number;
  /** Antall SSAO-prøver per piksel (0 = av). */
  ao: number;
}
const TIERS: Record<Quality, Tier> = {
  low: { maxDpr: 1, budget: 1.2e6, samples: 0, mips: 0, dof: false, shadows: 0, ao: 0 },
  medium: { maxDpr: 1.25, budget: 1.0e6, samples: 4, mips: 4, dof: false, shadows: 1024, ao: 8 },
  high: { maxDpr: 1.5, budget: 1.65e6, samples: 4, mips: 5, dof: true, shadows: 2048, ao: 12 },
  ultra: { maxDpr: 2, budget: 3.2e6, samples: 4, mips: 6, dof: true, shadows: 4096, ao: 16 },
};

export function tierOf(q: Quality) {
  return TIERS[q];
}

// ---------------------------------------------------------------- shadere
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const TAP13 = /* glsl */ `
vec3 tap(vec2 uv) { return texture2D(tSrc, uv).rgb; }
vec3 down13(vec2 uv, vec2 t) {
  vec3 A = tap(uv + t * vec2(-2.0, 2.0)), B = tap(uv + t * vec2(0.0, 2.0)), C = tap(uv + t * vec2(2.0, 2.0));
  vec3 D = tap(uv + t * vec2(-2.0, 0.0)), E = tap(uv), F = tap(uv + t * vec2(2.0, 0.0));
  vec3 G = tap(uv + t * vec2(-2.0, -2.0)), H = tap(uv + t * vec2(0.0, -2.0)), I = tap(uv + t * vec2(2.0, -2.0));
  vec3 J = tap(uv + t * vec2(-1.0, 1.0)), K = tap(uv + t * vec2(1.0, 1.0));
  vec3 L = tap(uv + t * vec2(-1.0, -1.0)), M = tap(uv + t * vec2(1.0, -1.0));
  return E * 0.125 + (A + C + G + I) * 0.03125 + (B + D + F + H) * 0.0625 + (J + K + L + M) * 0.125;
}`;

/** Første nedskalering: Karis-snitt (demper enkeltpiksler som blinker) og myk terskel. */
const PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
vec3 tap(vec2 uv) { return min(texture2D(tSrc, uv).rgb, vec3(64.0)); }
float kw(vec3 c) { return 1.0 / (1.0 + max(c.r, max(c.g, c.b))); }
void main() {
  vec2 t = texel;
  vec3 A = tap(vUv + t * vec2(-2.0, 2.0)), B = tap(vUv + t * vec2(0.0, 2.0)), C = tap(vUv + t * vec2(2.0, 2.0));
  vec3 D = tap(vUv + t * vec2(-2.0, 0.0)), E = tap(vUv), F = tap(vUv + t * vec2(2.0, 0.0));
  vec3 G = tap(vUv + t * vec2(-2.0, -2.0)), H = tap(vUv + t * vec2(0.0, -2.0)), I = tap(vUv + t * vec2(2.0, -2.0));
  vec3 J = tap(vUv + t * vec2(-1.0, 1.0)), K = tap(vUv + t * vec2(1.0, 1.0));
  vec3 L = tap(vUv + t * vec2(-1.0, -1.0)), M = tap(vUv + t * vec2(1.0, -1.0));
  vec3 g0 = (J + K + L + M) * 0.25, g1 = (A + B + D + E) * 0.25, g2 = (B + C + E + F) * 0.25;
  vec3 g3 = (D + E + G + H) * 0.25, g4 = (E + F + H + I) * 0.25;
  float w0 = 0.5 * kw(g0), w1 = 0.125 * kw(g1), w2 = 0.125 * kw(g2), w3 = 0.125 * kw(g3), w4 = 0.125 * kw(g4);
  vec3 c = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-4);
  c *= max(rq, br - threshold) / max(br, 1e-4);
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
${TAP13}
void main() { gl_FragColor = vec4(down13(vUv, texel), 1.0); }`;

const UP = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float radius;
varying vec2 vUv;
vec3 tap(vec2 uv) { return texture2D(tSrc, uv).rgb; }
void main() {
  vec2 d = texel * radius;
  vec3 s = tap(vUv + vec2(-d.x, d.y)) + tap(vUv + vec2(0.0, d.y)) * 2.0 + tap(vUv + vec2(d.x, d.y));
  s += tap(vUv + vec2(-d.x, 0.0)) * 2.0 + tap(vUv) * 4.0 + tap(vUv + vec2(d.x, 0.0)) * 2.0;
  s += tap(vUv + vec2(-d.x, -d.y)) + tap(vUv + vec2(0.0, -d.y)) * 2.0 + tap(vUv + vec2(d.x, -d.y));
  gl_FragColor = vec4(s / 16.0, 1.0);
}`;

const COC = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform float focus;
uniform float range;
uniform float farAmt;
uniform float nearAmt;
float viewDist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}
float cocAt(vec2 uv) {
  float z = viewDist(uv);
  float f = clamp((z - (focus + range)) / (focus * 1.8), 0.0, 1.0);
  float n = clamp(((focus - range) - z) / (focus * 0.35), 0.0, 1.0);
  return max(sqrt(f) * farAmt, n * nearAmt);
}`;

/** Halv oppløsning: nedskalert farge og uskarphetsradius (CoC) i alfa. */
const DOF_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
${COC}
void main() {
  vec3 c = texture2D(tSrc, vUv + texel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + texel * vec2(0.5, -0.5)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + texel * vec2(0.5, 0.5)).rgb;
  gl_FragColor = vec4(min(c * 0.25, vec3(32.0)), cocAt(vUv));
}`;

/** Diskoppsamling med gyllen vinkel. Punktene vektes med sin egen CoC så skarpe figurer ikke blør inn i bakgrunnen. */
const DOF_BLUR = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float maxRadius;
varying vec2 vUv;
void main() {
  vec4 c0 = texture2D(tSrc, vUv);
  float r = c0.a * maxRadius;
  vec3 acc = c0.rgb * 0.25;
  float wsum = 0.25;
  const int N = 22;
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float a = fi * 2.39996323;
    float rr = sqrt(fi / float(N)) * r;
    vec4 s = texture2D(tSrc, vUv + vec2(cos(a), sin(a)) * rr * texel);
    float w = smoothstep(0.0, 0.25, s.a) * step(rr * 0.6, s.a * maxRadius + 0.5);
    acc += s.rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, c0.a);
}`;

/**
 * Skygge i kroker (SSAO) i halv oppløsning, bare fra dybden: posisjon og normal rekonstrueres i kamerarommet,
 * og prøver i en spiral rundt punktet teller hvor mye som stikker opp foran flaten (Alchemy AO). Prøver som
 * er lenger unna enn radius telles ikke, så figurer og kanter ikke får mørke glorier.
 */
const SSAO = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform mat4 projInv;
uniform mat4 proj;
uniform vec2 texel;
uniform float radius;
uniform float intensity;
varying vec2 vUv;
vec3 viewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 v = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  // Normalen fra den nærmeste nabopikselen på hver akse (unngår feil normal langs kanter)
  vec3 Pr = viewPos(vUv + vec2(texel.x, 0.0)), Pl = viewPos(vUv - vec2(texel.x, 0.0));
  vec3 Pu = viewPos(vUv + vec2(0.0, texel.y)), Pd = viewPos(vUv - vec2(0.0, texel.y));
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  // Radius i skjermrom: verdensradius projisert ned på avstanden til punktet
  float rUv = radius * proj[1][1] * 0.5 / -P.z;
  float rnd = hash12(gl_FragCoord.xy) * 6.2832;
  float occ = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i);
    float a = fi * 2.39996 + rnd;
    float rr = (fi + 0.5) / float(SAMPLES);
    vec2 o = vec2(cos(a), sin(a)) * rr * rUv * vec2(texel.y / texel.x, 1.0);
    vec3 v = viewPos(vUv + o) - P;
    float vv = dot(v, v);
    float fall = 1.0 - smoothstep(radius * 0.55, radius, sqrt(vv));
    occ += max(0.0, dot(v, N) + P.z * 0.012) / (vv + 0.02) * fall;
  }
  // Flater som ses nesten på kant gir striper, så de får mindre AO
  float facing = smoothstep(0.08, 0.35, abs(N.z));
  float ao = max(0.0, 1.0 - intensity * 2.0 * radius * occ / float(SAMPLES) * facing);
  ao = pow(ao, 1.4);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`;

/** Dybdebevisst blur av SSAO (to ganger, bortover og oppover), så støyen forsvinner uten å smøre over kanter. */
const AO_BLUR = /* glsl */ `
#include <packing>
uniform sampler2D tSrc;
uniform sampler2D tDepth;
uniform vec2 dir;
uniform float cameraNear;
uniform float cameraFar;
varying vec2 vUv;
float vz(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
void main() {
  float z0 = vz(vUv);
  float acc = texture2D(tSrc, vUv).r * 0.2270;
  float wsum = 0.2270;
  const float W[4] = float[4](0.1946, 0.1216, 0.0541, 0.0162);
  for (int i = 1; i <= 4; i++) {
    for (int s = -1; s <= 1; s += 2) {
      vec2 uv = vUv + dir * float(i * s);
      float w = W[i - 1] * exp(-abs(vz(uv) - z0) * 4.0 / max(z0 * 0.05, 0.05));
      acc += texture2D(tSrc, uv).r * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(vec3(acc / wsum), 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDof;
uniform vec2 resolution;
uniform float time;
uniform float bloomStrength;
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float vibrance;
uniform vec3 lift;
uniform vec3 gammaV;
uniform vec3 gain;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float tintAmt;
uniform float vignette;
uniform float grain;
uniform float aberration;
uniform float hurt;
uniform float flash;
uniform float toneMode;
uniform float useBloom;
uniform float useDof;
uniform sampler2D tAO;
uniform float aoAmt;
uniform float showAO;
varying vec2 vUv;
${COC}

vec3 neutralTone(vec3 color) {
  const float startCompression = 0.76;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
vec3 rrtOdt(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesTone(vec3 color) {
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color = inM * (color / 0.6);
  color = rrtOdt(color);
  return clamp(outM * color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 uv = vUv;
  if (showAO > 0.5) {
    gl_FragColor = vec4(vec3(texture2D(tAO, uv).r), 1.0);
    return;
  }
  vec2 fromC = uv - 0.5;
  vec3 col;
  if (aberration > 0.001) {
    vec2 o = fromC * aberration * 0.018;
    col = vec3(texture2D(tScene, uv - o).r, texture2D(tScene, uv).g, texture2D(tScene, uv + o).b);
  } else {
    col = texture2D(tScene, uv).rgb;
  }
  if (aoAmt > 0.001) col *= mix(1.0, texture2D(tAO, uv).r, aoAmt);
  if (useDof > 0.5) {
    float c = cocAt(uv);
    vec4 b = texture2D(tDof, uv);
    col = mix(col, b.rgb, smoothstep(0.0, 0.65, c));
  }
  if (useBloom > 0.5) col += texture2D(tBloom, uv).rgb * bloomStrength;
  col = max(col * exposure, vec3(0.0));
  col = toneMode > 0.5 ? acesTone(col) : neutralTone(col);
  col = toSRGB(col);

  // Gradering i sRGB-rom
  col = pow(max(col * gain + lift * (1.0 - col), vec3(0.0)), 1.0 / max(gammaV, vec3(0.05)));
  float l = luma(col);
  col = mix(vec3(l), col, saturation);
  float mx = max(col.r, max(col.g, col.b));
  float mn = min(col.r, min(col.g, col.b));
  col = mix(vec3(l), col, 1.0 + vibrance * (1.0 - (mx - mn)));
  col = (col - 0.5) * contrast + 0.5;
  vec3 tone = mix(shadowTint, highlightTint, smoothstep(0.1, 0.9, l));
  col = mix(col, col * tone, tintAmt);

  // Linse og presentasjon
  float r = length(fromC * vec2(1.0, 0.82)) * 1.42;
  col *= 1.0 - vignette * smoothstep(0.42, 1.15, r);
  col = mix(col, vec3(0.42, 0.0, 0.03), clamp(hurt, 0.0, 1.0) * smoothstep(0.45, 1.1, r) * (0.75 + 0.25 * sin(time * 7.0)));
  col += flash * vec3(0.95, 0.97, 1.0);
  float n = hash12(uv * resolution + fract(time * 7.13) * 311.0) - 0.5;
  col += n * grain * 0.075 * (1.0 - 0.6 * abs(l - 0.45));
  col += (hash12(uv * resolution + 17.7) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function target(w: number, h: number, type: THREE.TextureDataType, opts: THREE.RenderTargetOptions = {}) {
  const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false, ...opts,
  });
  t.texture.wrapS = t.texture.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function mat(frag: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, string> = {}) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, defines, depthTest: false, depthWrite: false });
}

// ---------------------------------------------------------------- pipelinen
export class PostFX {
  quality: Quality = 'high';
  /** Aktiv gradering (glir mot målet). */
  grade: Grade = makeGrade();
  private goal: Grade = makeGrade();
  /** Avstand langs synslinjen til fokusplanet. Negativ = regn ut fra planet z = 0. */
  focus = -1;
  focusRange = 5;
  /** Kromatisk aberrasjon (settes ved store treff og synker av seg selv). */
  aberration = 0;
  /** Rød kant når helten nesten er død (0..1). */
  hurt = 0;
  /** Hvitt lysglimt (lyn, magi), synker av seg selv. */
  flash = 0;
  /** Skru av enkelttrinn for feilsøking. */
  /** Slå av og på trinn for sammenligning. aoView viser bare SSAO-bufferet. */
  debug = { bloom: true, dof: true, grade: true, ao: true, aoView: false };
  private hdr: THREE.TextureDataType = THREE.HalfFloatType;
  private scene: THREE.WebGLRenderTarget | null = null;
  private mips: THREE.WebGLRenderTarget[] = [];
  private dofA: THREE.WebGLRenderTarget | null = null;
  private dofB: THREE.WebGLRenderTarget | null = null;
  private aoA: THREE.WebGLRenderTarget | null = null;
  private aoB: THREE.WebGLRenderTarget | null = null;
  private ssao: THREE.ShaderMaterial | null = null;
  private aoBlur = mat(AO_BLUR, { tSrc: { value: null }, tDepth: { value: null }, dir: { value: new THREE.Vector2() }, cameraNear: { value: 0.1 }, cameraFar: { value: 100 } });
  private quad = new FullScreenQuad();
  private prefilter = mat(PREFILTER, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 } });
  private down = mat(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
  private up = mat(UP, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });
  private cocU = () => ({
    tDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 400 }, focus: { value: 14 }, range: { value: 3.6 }, farAmt: { value: 0.7 }, nearAmt: { value: 0.6 },
  });
  private dofDown = mat(DOF_DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, ...this.cocU() });
  private dofBlur = mat(DOF_BLUR, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, maxRadius: { value: 9 } });
  private comp = mat(COMPOSITE, {
    tScene: { value: null }, tBloom: { value: null }, tDof: { value: null }, resolution: { value: new THREE.Vector2() }, time: { value: 0 },
    bloomStrength: { value: 0 }, exposure: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 }, vibrance: { value: 0 },
    lift: { value: new THREE.Vector3() }, gammaV: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
    shadowTint: { value: new THREE.Vector3(1, 1, 1) }, highlightTint: { value: new THREE.Vector3(1, 1, 1) }, tintAmt: { value: 0 },
    vignette: { value: 0 }, grain: { value: 0 }, aberration: { value: 0 }, hurt: { value: 0 }, flash: { value: 0 }, toneMode: { value: 0 },
    useBloom: { value: 0 }, useDof: { value: 0 }, tAO: { value: null }, aoAmt: { value: 0 }, showAO: { value: 0 }, ...this.cocU(),
  });
  private cssW = 1;
  private cssH = 1;
  private time = 0;
  private tmpV = new THREE.Vector3();

  constructor(private renderer: THREE.WebGLRenderer) {
    const ext = renderer.extensions;
    const floatOk = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    if (floatOk) {
      ext.get('EXT_color_buffer_float');
      ext.get('EXT_color_buffer_half_float');
    }
    this.hdr = floatOk ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.up.blending = THREE.CustomBlending;
    this.up.blendEquation = THREE.AddEquation;
    this.up.blendSrc = THREE.OneFactor;
    this.up.blendDst = THREE.OneFactor;
    this.up.transparent = true;
  }

  get enabled() {
    return this.quality !== 'low';
  }

  get tier() {
    return TIERS[this.quality];
  }

  /** Bytt kvalitetsnivå. Bygger målene på nytt og oppdaterer skygger og pikseltetthet. */
  setQuality(q: Quality) {
    this.quality = q;
    gfxState.quality = q;
    const r = this.renderer;
    r.shadowMap.enabled = TIERS[q].shadows > 0;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = this.enabled ? THREE.NoToneMapping : THREE.NeutralToneMapping;
    this.setSize(this.cssW, this.cssH);
  }

  /** Pikseltetthet ut fra et budsjett (antall piksler) per nivå, som i threejs-image-pipeline. */
  private pickDpr() {
    const t = TIERS[this.quality];
    const dev = window.devicePixelRatio || 1;
    const px = Math.max(1, this.cssW * this.cssH);
    const budget = Math.sqrt(t.budget / px);
    return Math.max(Math.min(1, dev), Math.min(t.maxDpr, dev, budget));
  }

  setSize(cssW: number, cssH: number) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    const r = this.renderer;
    r.setPixelRatio(this.pickDpr());
    r.setSize(this.cssW, this.cssH, false);
    this.rebuild();
  }

  private rebuild() {
    this.scene?.dispose();
    for (const m of this.mips) m.dispose();
    this.dofA?.dispose();
    this.dofB?.dispose();
    this.aoA?.dispose();
    this.aoB?.dispose();
    this.ssao?.dispose();
    this.scene = this.dofA = this.dofB = this.aoA = this.aoB = null;
    this.ssao = null;
    this.mips = [];
    if (!this.enabled) return;
    const t = TIERS[this.quality];
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.floor(size.x), h = Math.floor(size.y);
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    this.scene = target(w, h, this.hdr, { depthBuffer: true, depthTexture: depth, samples: t.samples });
    let mw = w, mh = h;
    for (let i = 0; i < t.mips; i++) {
      mw = Math.max(1, Math.floor(mw / 2));
      mh = Math.max(1, Math.floor(mh / 2));
      this.mips.push(target(mw, mh, this.hdr));
    }
    if (t.dof) {
      this.dofA = target(Math.floor(w / 2), Math.floor(h / 2), this.hdr);
      this.dofB = target(Math.floor(w / 2), Math.floor(h / 2), this.hdr);
    }
    if (t.ao) {
      this.aoA = target(Math.floor(w / 2), Math.floor(h / 2), THREE.UnsignedByteType);
      this.aoB = target(Math.floor(w / 2), Math.floor(h / 2), THREE.UnsignedByteType);
      this.ssao = mat(SSAO, {
        tDepth: { value: depth }, projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() },
        texel: { value: new THREE.Vector2(1 / w, 1 / h) }, radius: { value: 1.15 }, intensity: { value: 1.5 },
      }, { SAMPLES: String(t.ao) });
    }
    (this.comp.uniforms.resolution.value as THREE.Vector2).set(w, h);
  }

  /** Sett gradering for scenen. instant = hopp rett dit (scenebytte), ellers glir den over. */
  setGrade(g: Partial<Grade>, instant = true) {
    this.goal = makeGrade(g);
    if (instant) this.grade = makeGrade(this.goal);
  }

  private blend(dt: number) {
    const k = 1 - Math.exp(-dt * 2.5);
    const a = this.grade as unknown as Record<string, number | RGB>;
    const b = this.goal as unknown as Record<string, number | RGB>;
    for (const key of GRADE_KEYS) {
      const va = a[key], vb = b[key];
      if (Array.isArray(va) && Array.isArray(vb)) for (let i = 0; i < 3; i++) va[i] += (vb[i] - va[i]) * k;
      else a[key] = (va as number) + ((vb as number) - (va as number)) * k;
    }
  }

  /** Fokusavstand: langs synslinjen til der den treffer planet z = 0 (der kampen foregår). */
  private focusFor(cam: THREE.PerspectiveCamera) {
    if (this.focus > 0) return this.focus;
    const fwd = cam.getWorldDirection(this.tmpV);
    const t = fwd.z < -0.05 ? cam.position.z / -fwd.z : 14;
    return Math.max(4, Math.min(60, t));
  }

  /** Ett fullskjermtrinn. autoClear må være av, ellers tømmes målet før oppskaleringen legges oppå. */
  private pass(m: THREE.ShaderMaterial, out: THREE.WebGLRenderTarget | null) {
    const r = this.renderer;
    const ac = r.autoClear;
    r.autoClear = false;
    this.quad.material = m;
    r.setRenderTarget(out);
    this.quad.render(r);
    r.autoClear = ac;
  }

  render(scene: THREE.Scene, cam: THREE.PerspectiveCamera, dt: number) {
    const r = this.renderer;
    this.time += dt;
    this.blend(dt);
    this.aberration = Math.max(0, this.aberration - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 3.5);
    const g = this.grade;
    if (!this.enabled || !this.scene) {
      r.toneMappingExposure = g.exposure;
      r.setRenderTarget(null);
      r.render(scene, cam);
      return;
    }
    r.setRenderTarget(this.scene);
    r.render(scene, cam);
    const src = this.scene.texture;

    // Skygge i kroker (SSAO) i halv oppløsning, så to runder med dybdebevisst blur
    const useAO = this.debug.ao && !!this.ssao && g.ao > 0.01;
    if (useAO) {
      const su = this.ssao!.uniforms;
      (su.proj.value as THREE.Matrix4).copy(cam.projectionMatrix);
      (su.projInv.value as THREE.Matrix4).copy(cam.projectionMatrixInverse);
      this.pass(this.ssao!, this.aoA);
      const bu = this.aoBlur.uniforms;
      bu.tDepth.value = this.scene.depthTexture;
      bu.cameraNear.value = cam.near;
      bu.cameraFar.value = cam.far;
      bu.tSrc.value = this.aoA!.texture;
      (bu.dir.value as THREE.Vector2).set(1 / this.aoA!.width, 0);
      this.pass(this.aoBlur, this.aoB);
      bu.tSrc.value = this.aoB!.texture;
      (bu.dir.value as THREE.Vector2).set(0, 1 / this.aoA!.height);
      this.pass(this.aoBlur, this.aoA);
    }

    // Bloom: terskel og nedskalering, så oppskalering som legges oppå hvert nivå
    const useBloom = this.debug.bloom && g.bloom > 0.001 && this.mips.length > 1;
    if (useBloom) {
      const m0 = this.mips[0];
      this.prefilter.uniforms.tSrc.value = src;
      (this.prefilter.uniforms.texel.value as THREE.Vector2).set(1 / this.scene.width, 1 / this.scene.height);
      this.prefilter.uniforms.threshold.value = g.threshold;
      this.prefilter.uniforms.knee.value = Math.max(0.01, g.knee);
      this.pass(this.prefilter, m0);
      for (let i = 1; i < this.mips.length; i++) {
        const s = this.mips[i - 1];
        this.down.uniforms.tSrc.value = s.texture;
        (this.down.uniforms.texel.value as THREE.Vector2).set(1 / s.width, 1 / s.height);
        this.pass(this.down, this.mips[i]);
      }
      for (let i = this.mips.length - 1; i > 0; i--) {
        const s = this.mips[i];
        this.up.uniforms.tSrc.value = s.texture;
        (this.up.uniforms.texel.value as THREE.Vector2).set(1 / s.width, 1 / s.height);
        this.up.uniforms.radius.value = 1.0;
        this.pass(this.up, this.mips[i - 1]);
      }
    }

    // Dybdeskarphet (halv oppløsning)
    const focus = this.focusFor(cam);
    const useDof = this.debug.dof && !!this.dofA && !!this.dofB && (g.dofFar > 0.01 || g.dofNear > 0.01);
    for (const m of [this.dofDown, this.comp]) {
      const u = m.uniforms;
      u.tDepth.value = this.scene.depthTexture;
      u.cameraNear.value = cam.near;
      u.cameraFar.value = cam.far;
      u.focus.value = focus;
      u.range.value = this.focusRange;
      u.farAmt.value = g.dofFar;
      u.nearAmt.value = g.dofNear;
    }
    if (useDof) {
      this.dofDown.uniforms.tSrc.value = src;
      (this.dofDown.uniforms.texel.value as THREE.Vector2).set(1 / this.scene.width, 1 / this.scene.height);
      this.pass(this.dofDown, this.dofA);
      this.dofBlur.uniforms.tSrc.value = this.dofA!.texture;
      (this.dofBlur.uniforms.texel.value as THREE.Vector2).set(1 / this.dofA!.width, 1 / this.dofA!.height);
      this.dofBlur.uniforms.maxRadius.value = this.quality === 'ultra' ? 12 : 9;
      this.pass(this.dofBlur, this.dofB);
    }

    // Samlet bilde til skjermen
    const u = this.comp.uniforms;
    const gr = this.debug.grade;
    u.tScene.value = src;
    u.tBloom.value = useBloom ? this.mips[0].texture : null;
    u.tDof.value = useDof ? this.dofB!.texture : null;
    u.useBloom.value = useBloom ? 1 : 0;
    u.useDof.value = useDof ? 1 : 0;
    u.tAO.value = useAO ? this.aoA!.texture : null;
    u.aoAmt.value = useAO ? g.ao : 0;
    u.showAO.value = useAO && this.debug.aoView ? 1 : 0;
    u.time.value = this.time;
    u.bloomStrength.value = g.bloom / Math.max(1, this.mips.length - 1);
    u.exposure.value = g.exposure;
    u.toneMode.value = g.tone;
    u.contrast.value = gr ? g.contrast : 1;
    u.saturation.value = gr ? g.saturation : 1;
    u.vibrance.value = gr ? g.vibrance : 0;
    (u.lift.value as THREE.Vector3).fromArray(gr ? g.lift : [0, 0, 0]);
    (u.gammaV.value as THREE.Vector3).fromArray(gr ? g.gamma : [1, 1, 1]);
    (u.gain.value as THREE.Vector3).fromArray(gr ? g.gain : [1, 1, 1]);
    (u.shadowTint.value as THREE.Vector3).fromArray(g.shadowTint);
    (u.highlightTint.value as THREE.Vector3).fromArray(g.highlightTint);
    u.tintAmt.value = gr ? g.tint : 0;
    u.vignette.value = g.vignette;
    u.grain.value = g.grain;
    u.aberration.value = this.aberration;
    u.hurt.value = this.hurt;
    u.flash.value = this.flash;
    this.pass(this.comp, null);
  }

  dispose() {
    this.scene?.dispose();
    for (const m of this.mips) m.dispose();
    this.dofA?.dispose();
    this.dofB?.dispose();
    this.aoA?.dispose();
    this.aoB?.dispose();
    this.quad.dispose();
  }
}

/** Velg et fornuftig nivå for enheten (brukes når innstillingen står på AUTO). */
export function autoQuality(): Quality {
  try {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 820;
    if (coarse && small) return 'medium';
    if (coarse) return 'high';
    return 'high';
  } catch {
    return 'medium';
  }
}
