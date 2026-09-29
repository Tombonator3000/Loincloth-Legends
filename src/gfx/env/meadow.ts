// Instansert gress med rotfestet vind. Hver instans er en klump strå.
// Stråene bøyer seg langs en sirkelbue så lengden holdes, vindkast vandrer langs vindretningen og spissene
// flagrer (stylized-meadow-grass i threejs-procedural-vegetation, prosjektbiblioteket).
// Klumpene ligger i en flis som gjentas rundt kameraet, så gresset følger med langs hele brettet uten at
// nye strå spretter frem i bildet.
import * as THREE from 'three';
import { WIND_GLSL, windUniforms, sunUniforms } from '../wind';
import { qualityRank } from '../post';

export interface MeadowOpts {
  /** Belter i z der gresset gror: [zMin, zMax, klumper per kvadratmeter]. */
  bands: [number, number, number][];
  /** Høyde på stråene [min, maks]. */
  height: [number, number];
  /** Bredde på stråene ved roten. */
  width?: number;
  base: string;
  tip: string;
  /** Tørre flekker (gulnet). */
  dry?: string;
  /** Hvor mange strå per klump. */
  blades?: number;
  /** Bredden på flisen som gjentas rundt kameraet. */
  tile?: number;
  /** Ikke gress der (x, z) ligger i disse rektanglene [x0, x1, z0, z1] (verdenskoordinater, uten gjentakelse). */
  holes?: [number, number, number, number][];
  /** Hvor mye stråene bøyer seg. */
  bend?: number;
}

const QMUL = [0.3, 0.6, 1, 1.8];

function bladeClump(blades: number, width: number) {
  const pos: number[] = [], nrm: number[] = [], bt: number[] = [], idx: number[] = [];
  const SEG = 4;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI + (Math.random() - 0.5) * 0.6;
    const ox = (Math.random() - 0.5) * 0.12, oz = (Math.random() - 0.5) * 0.12;
    const h = 0.7 + Math.random() * 0.3;
    const lean = (Math.random() - 0.5) * 0.35;
    const ca = Math.cos(a), sa = Math.sin(a);
    const base = pos.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const w = width * (1 - t * 0.88) * 0.5;
      const y = t * h;
      const fwd = t * t * 0.18 + lean * t;
      for (const s of [-1, 1]) {
        const lx = s * w, lz = fwd;
        pos.push(ox + lx * ca - lz * sa, y, oz + lx * sa + lz * ca);
        nrm.push(-sa * 0.4, 1, ca * 0.4);
        bt.push(t);
      }
    }
    const tip = pos.length / 3;
    const fwdTip = 0.18 + lean;
    pos.push(ox - fwdTip * sa, h * 1.04, oz + fwdTip * ca);
    nrm.push(-sa * 0.4, 1, ca * 0.4);
    bt.push(1);
    for (let i = 0; i < SEG; i++) {
      const a0 = base + i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
    idx.push(base + SEG * 2, tip, base + SEG * 2 + 1);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aBladeT', new THREE.Float32BufferAttribute(bt, 1));
  g.setIndex(idx);
  return g;
}

export class Meadow {
  readonly mesh: THREE.Mesh;
  private camU = { value: 0 };

  constructor(o: MeadowOpts) {
    const tile = o.tile ?? 48;
    const q = QMUL[qualityRank()];
    const geo = bladeClump(o.blades ?? 4, o.width ?? 0.07);
    const origins: number[] = [], data: number[] = [];
    const inHole = (x: number, z: number) => (o.holes ?? []).some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
    for (const [z0, z1, dens] of o.bands) {
      const n = Math.round(tile * (z1 - z0) * dens * q);
      for (let i = 0; i < n; i++) {
        const x = Math.random() * tile;
        // Tettere midt i beltet, tynnere mot kantene
        const u = Math.random();
        const z = z0 + (z1 - z0) * (0.5 + (u - 0.5) * (0.6 + 0.4 * Math.random()));
        if (inHole(x, z)) continue;
        origins.push(x, z);
        const h = o.height[0] + Math.random() * (o.height[1] - o.height[0]);
        data.push(Math.random() * Math.PI * 2, h, Math.random());
      }
    }
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(origins), 2));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(data), 3));
    geo.instanceCount = origins.length / 2;

    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    const cBase = new THREE.Color(o.base), cTip = new THREE.Color(o.tip), cDry = new THREE.Color(o.dry ?? o.tip);
    const camU = this.camU;
    const bend = o.bend ?? 1;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, windUniforms, sunUniforms, {
        uCamX: camU, uTile: { value: tile }, uBase: { value: cBase }, uTip: { value: cTip }, uDry: { value: cDry }, uBend: { value: bend },
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
${WIND_GLSL}
attribute vec2 aOrigin;
attribute vec3 aData;
attribute float aBladeT;
uniform float uCamX;
uniform float uTile;
uniform vec3 uBase;
uniform vec3 uTip;
uniform vec3 uDry;
uniform float uBend;
varying vec3 vGrassCol;
varying float vBladeT;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
  float gc = cos(aData.x), gs = sin(aData.x);
  objectNormal = vec3(objectNormal.x * gc - objectNormal.z * gs, objectNormal.y, objectNormal.x * gs + objectNormal.z * gc);`)
        .replace('#include <begin_vertex>', `
  // Klumpen følger kameraet: x gjentas i en flis rundt uCamX
  float wx = uCamX + mod(aOrigin.x - uCamX + uTile * 0.5, uTile) - uTile * 0.5;
  vec2 wp = vec2(wx, aOrigin.y);
  vec3 p = vec3(position.x * gc - position.z * gs, position.y * aData.y, position.x * gs + position.z * gc);
  // Bue-bøying: vinkelen øker mot spissen, lengden holdes
  vec2 wd = normalize(uWindDir.xz);
  float along = dot(wp, wd);
  float gust = windGustAt(wp);
  float chop = sin(along * 0.38 - uWindTime * 2.6 + aData.z * 6.28) * 0.5 + 0.5;
  float intensity = (0.25 + gust * 0.85 + chop * 0.2 + uWindGust * 0.6) * (0.65 + aData.z * 0.7);
  float phi = clamp(uWindStrength * intensity * 1.6 * uBend, 0.0, 1.35);
  float bt = aBladeT;
  float a = phi * pow(bt, 1.5);
  float hgt = max(0.05, aData.y);
  float radius = hgt / max(phi, 0.001);
  float arc = radius * (1.0 - cos(a));
  float drop = phi > 0.001 ? radius * sin(a) - p.y : 0.0;
  float flutter = sin(uWindTime * 9.0 + aData.z * 19.0 + along * 0.8) * 0.035 * smoothstep(0.5, 1.0, bt) * (0.3 + uWindStrength);
  vec2 off = wd * arc + vec2(-wd.y, wd.x) * flutter;
  vec3 transformed = vec3(wp.x + p.x + off.x, max(0.0, p.y + drop), wp.y + p.z + off.y);
  // Farge: mørk rot, lys spiss, tørre flekker i klumper
  float dryPatch = windNoise(wp * 0.21 + 3.1);
  vec3 tip = mix(uTip, uDry, smoothstep(0.55, 0.85, dryPatch));
  vGrassCol = mix(uBase, tip, pow(bt, 1.2)) * (0.85 + 0.3 * aData.z);
  vBladeT = bt;`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vGrassCol;
varying float vBladeT;
uniform vec3 uSunDirW;
uniform vec3 uSunCol;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = vGrassCol;`)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    vec3 Lv = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
    vec3 toCam = normalize(vViewPosition);
    float back = pow(max(dot(-toCam, Lv), 0.0), 3.0);
    reflectedLight.directDiffuse += diffuseColor.rgb * uSunCol * back * 0.6 * vBladeT;
  }`);
    };
    mat.customProgramCacheKey = () => 'meadow';
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.userData.noCast = true;
  }

  update(camX: number) {
    this.camU.value = camX;
  }
}
