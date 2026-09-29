// Felles vindfelt. Trær, blader, gress, bannere og kapper deler de samme uniformene, så et vindkast
// går gjennom hele scenen samtidig. Oppdateres med spilltid, så slowmo også bremser vinden.
// Ideene (rotfestet vind, bue-bøying, vindkast som vandrer langs vindretningen, flagrende spisser)
// er fra threejs-procedural-vegetation i prosjektbiblioteket. Koden er skrevet for dette prosjektet.
import * as THREE from 'three';

export const windUniforms = {
  uWindTime: { value: 0 },
  uWindDir: { value: new THREE.Vector3(1, 0, 0.3).normalize() },
  uWindStrength: { value: 0.6 },
  uWindGust: { value: 0 },
};

/** Sola sett fra vegetasjonen (for gjennomskinnelige blader). Settes av SunShadow. */
export const sunUniforms = {
  uSunDirW: { value: new THREE.Vector3(0.5, 0.6, -0.6).normalize() },
  uSunCol: { value: new THREE.Color(1, 0.9, 0.75) },
};

let base = 0.6;
let gustiness = 0.6;
let t = 0;
let gust = 0;
let gustTarget = 0;
let gustTimer = 0;

export const wind = {
  /** Sett biomets vind: styrke 0..1.5, retning i xz og hvor mye den kaster. */
  set(strength: number, dirX = 1, dirZ = 0.3, gusty = 0.6) {
    base = strength;
    gustiness = gusty;
    windUniforms.uWindDir.value.set(dirX, 0, dirZ).normalize();
    windUniforms.uWindStrength.value = strength;
  },
  update(dt: number) {
    t += dt;
    gustTimer -= dt;
    if (gustTimer <= 0) {
      gustTimer = 1.5 + Math.random() * 4;
      gustTarget = Math.random() < 0.35 ? 0.6 + Math.random() * 0.8 : Math.random() * 0.25;
    }
    gust += (gustTarget - gust) * (1 - Math.exp(-dt * 1.4));
    windUniforms.uWindTime.value = t;
    windUniforms.uWindGust.value = gust * gustiness;
    windUniforms.uWindStrength.value = base * (0.85 + 0.3 * Math.sin(t * 0.37));
  },
  /** Vindens fart i et punkt (for partikler som blader, røyk og snø). */
  velocity(x: number, z: number, out = new THREE.Vector3()) {
    const d = windUniforms.uWindDir.value;
    const s = windUniforms.uWindStrength.value * (1 + windUniforms.uWindGust.value * 1.5);
    const w = 0.6 + 0.4 * Math.sin(t * 1.3 + x * 0.21 + z * 0.13);
    return out.set(d.x * s * w * 2.2, 0, d.z * s * w * 2.2);
  },
  get strength() {
    return windUniforms.uWindStrength.value * (1 + windUniforms.uWindGust.value);
  },
  get time() {
    return t;
  },
};

/** GLSL: uniformer, støy og vindfunksjoner. */
export const WIND_GLSL = /* glsl */ `
uniform float uWindTime;
uniform vec3 uWindDir;
uniform float uWindStrength;
uniform float uWindGust;
float windHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float windNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(windHash(i), windHash(i + vec2(1.0, 0.0)), u.x), mix(windHash(i + vec2(0.0, 1.0)), windHash(i + vec2(1.0)), u.x), u.y);
}
// Vindkast som vandrer langs vindretningen (0..1)
float windGustAt(vec2 p) {
  float along = dot(p, uWindDir.xz);
  float j = (windNoise(p * 0.05 + 11.7) * 2.0 - 1.0) * 1.45;
  return pow(sin(along * 0.14 - uWindTime * 1.35 + j) * 0.5 + 0.5, 1.6);
}
// Svaiing med tre frekvenser (-1..1)
float windSway(vec2 p, float speed) {
  float ph = windNoise(p * 0.07) * 6.2831;
  return 0.5 * sin(uWindTime * speed + ph) + 0.3 * sin(uWindTime * speed * 2.1 + ph * 1.3) + 0.2 * sin(uWindTime * speed * 4.3 + ph * 1.7);
}
float windPower(vec2 p) {
  return uWindStrength * (0.45 + 0.85 * windGustAt(p) + uWindGust * 0.7);
}
// Tre: h01 er høyden (0 ved roten), aw = (grennivå 0..1, bladspiss 0..1, fase)
vec3 treeWind(vec3 root, float h01, vec3 aw) {
  float s = windPower(root.xz);
  float sway = windSway(root.xz, 0.85);
  vec3 side = vec3(-uWindDir.z, 0.0, uWindDir.x);
  vec3 d = uWindDir * (h01 * h01) * (0.22 * s + 0.3 * s * sway);
  d += side * (h01 * h01) * 0.08 * s * windSway(root.zx + 7.0, 1.3);
  d += (uWindDir * 0.8 + side * 0.4) * aw.x * h01 * 0.14 * s * sin(uWindTime * 3.1 + aw.z + h01 * 5.0);
  vec3 flutter = vec3(sin(uWindTime * 7.0 + aw.z * 3.0), cos(uWindTime * 5.3 + aw.z * 2.0) * 0.6, sin(uWindTime * 6.1 + aw.z));
  d += flutter * aw.y * 0.06 * (0.35 + s);
  return d;
}
`;

type Patchable = THREE.Material & { onBeforeCompile: THREE.Material['onBeforeCompile'] };

/**
 * Legg vind på et materiale med instansierte trær: roten står fast, toppen svaier, tynne grener svaier raskere
 * og bladspissene flagrer. Krever attributtet aWind (grennivå, spiss, fase). treeHeight er høyden i lokale enheter.
 * Samme patch brukes på skyggematerialet, så skyggene svaier med.
 */
export function windifyTree(mat: Patchable, treeHeight: number, tag: string, extraFrag?: (shader: THREE.WebGLProgramParametersWithUniforms) => void) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms, { uTreeH: { value: treeHeight } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nuniform float uTreeH;\nattribute vec3 aWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        mat4 im = mat4(1.0);
        #ifdef USE_INSTANCING
          im = instanceMatrix;
        #endif
        vec3 root = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sc = max(0.0001, length(im[0].xyz));
        float h01 = clamp(position.y / uTreeH, 0.0, 1.0);
        vec3 dW = treeWind(root, h01, aWind) * sc * (uTreeH / 8.0);
        transformed += (transpose(mat3(im)) * dW) / (sc * sc);
      }`);
    extraFrag?.(shader);
  };
  // Nøkkelen må skille variantene, ellers kan Three gjenbruke et program med feil kode
  mat.customProgramCacheKey = () => 'windTree:' + tag;
}
