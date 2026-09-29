// 3D-gibs: kjøttbiter, beinbiter, ribbein, øyeepler og glødende lavastein.
// Geometri og materialer lages én gang og deles. Kjøttet er vått og blankt (lav ruhet) med marmorert fett i
// toppunktfargene, så det fanger lys fra sola og fakler.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { plainCanvas } from './draw';

export type Gib3D = 'meat' | 'bone' | 'rib' | 'eye' | 'green' | 'rock' | 'tooth';

function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Klump med støy i radius, og farge som blander muskel, fett og hinne. */
function chunk(seed: number, r: number, cols: [string, string, string]) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col: number[] = [];
  const [muscle, fat, film] = cols.map((c) => new THREE.Color(c));
  const v = new THREE.Vector3();
  const sx = 0.8 + hash(seed, 1, 2) * 0.6, sy = 0.6 + hash(seed, 3, 4) * 0.5, sz = 0.7 + hash(seed, 5, 6) * 0.5;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const k = 0.72 + hash(Math.round(n.x * 5) + seed, Math.round(n.y * 5), Math.round(n.z * 5)) * 0.5;
    v.multiplyScalar(k).multiply(new THREE.Vector3(sx, sy, sz));
    pos.setXYZ(i, v.x, v.y, v.z);
    const f = hash(Math.round(n.x * 3) + seed * 7, Math.round(n.y * 3), Math.round(n.z * 3));
    const c = f > 0.78 ? fat : f > 0.62 ? film : muscle;
    const d = 0.8 + hash(i, seed, 3) * 0.3;
    col.push(c.r * d, c.g * d, c.b * d);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // Flett like hjørner (samme posisjon og farge) så klumpen får glatte, våte normaler
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}

function boneGeo() {
  const shaft = new THREE.CylinderGeometry(0.028, 0.032, 0.26, 7);
  const k1 = new THREE.SphereGeometry(0.045, 7, 5);
  k1.translate(0.018, 0.13, 0);
  const k2 = new THREE.SphereGeometry(0.045, 7, 5);
  k2.translate(-0.018, 0.13, 0);
  const k3 = new THREE.SphereGeometry(0.045, 7, 5);
  k3.translate(0.018, -0.13, 0);
  const k4 = new THREE.SphereGeometry(0.045, 7, 5);
  k4.translate(-0.018, -0.13, 0);
  const g = mergeGeometries([shaft, k1, k2, k3, k4].map((x) => x.toNonIndexed()))!;
  g.rotateZ(Math.PI / 2);
  return g;
}

let eyeTex: THREE.Texture | null = null;
function eyeTexture() {
  if (!eyeTex) {
    eyeTex = new THREE.CanvasTexture(plainCanvas(128, 64, (c) => {
      c.fillStyle = '#f4efe6';
      c.fillRect(0, 0, 128, 64);
      c.strokeStyle = 'rgba(180,20,30,0.7)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        c.beginPath();
        let x = 64 + (Math.random() - 0.5) * 120, y = Math.random() * 64;
        c.moveTo(x, y);
        for (let k = 0; k < 4; k++) c.lineTo((x += (Math.random() - 0.5) * 18), (y += (Math.random() - 0.5) * 12));
        c.stroke();
      }
      // Iris og pupill ligger på forsiden (u = 0.25 i en kule)
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 13);
      g.addColorStop(0, '#1a3a6a');
      g.addColorStop(0.7, '#3b7dd8');
      g.addColorStop(1, '#16304e');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(32, 32, 13, 16, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#050505';
      c.beginPath();
      c.ellipse(32, 32, 5, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.arc(28, 27, 2.5, 0, Math.PI * 2);
      c.fill();
    }));
    eyeTex.colorSpace = THREE.SRGBColorSpace;
  }
  return eyeTex;
}

interface Kit { geos: THREE.BufferGeometry[]; mat: THREE.Material; radius: number }
let kits: Record<Gib3D, Kit> | null = null;

function build(): Record<Gib3D, Kit> {
  const wet = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0, ...p });
  const meatCols: [string, string, string] = ['#7a0c1c', '#e8b8a8', '#c43a4a'];
  const greenCols: [string, string, string] = ['#3f7a1d', '#b8d890', '#6aa83a'];
  const rib = new THREE.TorusGeometry(0.15, 0.022, 5, 12, Math.PI * 0.95);
  const tooth = new THREE.ConeGeometry(0.03, 0.08, 5);
  const rock = new THREE.DodecahedronGeometry(0.12, 0);
  return {
    meat: { geos: [0, 1, 2, 3].map((s) => chunk(s + 1, 0.13, meatCols)), mat: wet({ vertexColors: true, roughness: 0.28 }), radius: 0.11 },
    green: { geos: [0, 1, 2].map((s) => chunk(s + 11, 0.13, greenCols)), mat: wet({ vertexColors: true, roughness: 0.3 }), radius: 0.11 },
    bone: { geos: [boneGeo()], mat: wet({ color: '#e8e0c8', roughness: 0.55 }), radius: 0.06 },
    rib: { geos: [rib], mat: wet({ color: '#ece4cc', roughness: 0.55 }), radius: 0.05 },
    tooth: { geos: [tooth], mat: wet({ color: '#f4f0e0', roughness: 0.4 }), radius: 0.03 },
    eye: { geos: [new THREE.SphereGeometry(0.07, 14, 10)], mat: wet({ map: eyeTexture(), roughness: 0.12 }), radius: 0.07 },
    rock: { geos: [rock], mat: wet({ color: '#2a2024', roughness: 0.8, emissive: new THREE.Color('#ff5a10'), emissiveIntensity: 1.6 }), radius: 0.1 },
  };
}

/** Lag en gib-mesh (delt geometri og materiale). Returnerer mesh og kollisjonsradius. */
export function makeGib(kind: Gib3D, scale = 1): { mesh: THREE.Mesh; radius: number } {
  if (!kits) kits = build();
  const k = kits[kind];
  const mesh = new THREE.Mesh(k.geos[Math.floor(Math.random() * k.geos.length)], k.mat);
  mesh.scale.setScalar(scale);
  mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, radius: k.radius * scale };
}
