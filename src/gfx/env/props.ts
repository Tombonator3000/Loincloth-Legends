// Rekvisitter fra frostpasset i konseptbilde 4 som også passer i andre biomer: fyrfat med ild, fillete krigsbanner
// med hornet hodeskalle, runesteiner, klippevegger med snø, fossefall med dis, taubro over et skar, istapper,
// ruiner og taugjerde. Det som står stille, legges i staticGroup og slås sammen i finishEnv (common.ts).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { valueNoise3, fbm3 } from '../noise';
import { plainCanvas } from '../draw';
import { rand } from '../../core/math';
import type { Gore } from '../gore';
import { screenFX } from '../screenfx';
import { wind } from '../wind';
import { lit, toon, staticGroup, mergeStatic, canvasTex, stoneTex, type Tippable } from './common';
import { audio } from '../../core/audio';

type Updates = ((dt: number, t: number, camX: number) => void)[];

// Materialene deles mellom alle rekvisittene (som toon() i common.ts), så de slås sammen til få tegnekall
const mats = new Map<string, THREE.Material>();
function mat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = mats.get(key) as T | undefined;
  if (!m) mats.set(key, (m = make()));
  return m;
}
const ironMat = () => mat('iron', () => lit({ color: '#2b2826', roughness: 0.5, metalness: 0.75 }, { scale: 3, normal: 0.6, albedo: 0.5 }));
const ropeMat = () => mat('rope', () => lit({ color: '#7a6448', roughness: 0.95 }, false));
const woodMat = () => mat('wood', () => lit({ color: '#4a3422', roughness: 0.9 }, { scale: 2.2, normal: 1.0, albedo: 0.5, snow: 0.7 }));
const iceMat = () => mat('ice', () => lit({ color: '#cfe8ff', roughness: 0.06, emissive: '#16304a', emissiveIntensity: 0.6 }, false));
const snowMat = () => mat('snow', () => lit({ color: '#e6eef8', roughness: 0.8 }, { scale: 1.5, normal: 0.4, albedo: 0.2 }));

/** Stang mellom to punkter (sylinder som peker fra a til b). */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, seg = 5) {
  const d = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), m);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return mesh;
}

// ---------------------------------------------------------------- fyrfat
/** Så lenge glørne brenner på bakken etter at et fyrfat er veltet (sekunder). */
export const EMBER_LIFE = 8;

let emberTex: THREE.Texture | null = null;
/** Glør på bakken: mørk aske med oransje og gule punkter som gløder (brukes som emisjon). */
function emberTexture() {
  if (emberTex) return emberTex;
  emberTex = canvasTex(plainCanvas(128, 128, (c) => {
    const gr = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,150,40,0.9)');
    gr.addColorStop(0.5, 'rgba(160,50,10,0.7)');
    gr.addColorStop(1, 'rgba(20,8,4,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.7) * 54;
      c.fillStyle = Math.random() < 0.5 ? 'rgba(255,220,120,0.95)' : 'rgba(255,110,20,0.9)';
      c.beginPath();
      c.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, rand(1.5, 4.5), 0, Math.PI * 2);
      c.fill();
    }
  }), false);
  return emberTex;
}

/**
 * Fyrfat: jernkurv med pigger på en stolpe, med glødende kull. Lyset går via lyspoolen, lufta over dirrer, og
 * stemningen knitrer nær det (Env.fires). Returnerer punktet flammene skal komme fra (gore.fire i miljøets update).
 * Fyrfatet kan veltes (Env.tippables, Stage velter det når noe treffer det): det faller mot kampfeltet, og
 * flammene, lyset og varmen flytter seg til glørne som renner ut på bakken og brenner en stund.
 */
export function brazier(g: THREE.Group, gore: Gore, updates: Updates, x: number, z: number, h = 2.3): THREE.Vector3 {
  // Egen gruppe med foten i origo, så hele fyrfatet kan vippe rundt foten. Delene slås sammen til to mesher.
  const bz = new THREE.Group();
  bz.position.set(x, 0, z);
  const sg = staticGroup(bz);
  const iron = ironMat();
  const at = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, h, 6), iron);
  pole.position.set(0, h / 2, 0);
  sg.add(pole);
  // Tre korte føtter
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    sg.add(rod(at(Math.cos(a) * 0.32, 0.02, Math.sin(a) * 0.32), at(0, 0.34, 0), 0.03, iron));
  }
  // Kurven: staver fra en liten ring nederst til en vid ring øverst, pigger på kanten
  const bot = h, top = h + 0.52, rb = 0.15, rt = 0.36;
  for (const [y, r] of [[bot, rb], [top, rt], [bot + 0.26, (rb + rt) / 2]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 4, 14), iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, y, 0);
    sg.add(ring);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    sg.add(rod(at(Math.cos(a) * rb, bot, Math.sin(a) * rb), at(Math.cos(a) * rt, top, Math.sin(a) * rt), 0.016, iron, 4));
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.18, 4), iron);
    spike.position.set(Math.cos(a) * rt, top + 0.09, Math.sin(a) * rt);
    sg.add(spike);
  }
  // Glødende kull i kurven (sterk emisjon, så bloom tar det)
  const coal = new THREE.Mesh(new THREE.SphereGeometry(0.28, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), toon('#3a1a0a', undefined, '#ff5a14'));
  coal.scale.y = 0.7;
  coal.position.set(0, bot + 0.22, 0);
  sg.add(coal);
  mergeStatic(bz);
  g.add(bz);
  const flame = new THREE.Vector3(x, top - 0.08, z);
  const light = gore.vfx.lights.source(new THREE.Vector3(x, top + 0.45, z + 0.6), '#ff8a3a', 15, 11, 0.4);
  const heat = screenFX.addHeat(new THREE.Vector3(x, top + 0.25, z), 0.7, 0.8);
  ((g.userData.fires ??= []) as THREE.Vector3[]).push(flame);

  // Velting: fyrfatet faller om foten mot kampfeltet (+z), glørne havner der kurven treffer bakken
  const spill = new THREE.Vector3(x, 0.12, z + top * 0.9);
  const rest = Math.PI / 2 - 0.12;
  let ang = 0, vel = 0, falling = false, burn = 0;
  let embers: THREE.Mesh | null = null;
  const handle: Tippable = {
    x, z, tipped: false,
    tip() {
      if (handle.tipped) return null;
      handle.tipped = true;
      falling = true;
      vel = 0.6;
      // Ingen flammer mens kurven faller; de kommer igjen i glørne
      flame.set(1e5, -50, 0);
      audio.clang();
      return { x: spill.x, z: spill.z, t: EMBER_LIFE };
    },
  };
  ((g.userData.tippables ??= []) as Tippable[]).push(handle);
  updates.push((dt) => {
    if (falling) {
      vel += 7.5 * dt;
      ang = Math.min(rest, ang + vel * dt);
      bz.rotation.x = ang;
      if (ang >= rest) {
        falling = false;
        // Glørne renner ut: flammene, lyset og varmen flytter seg ned til dem
        audio.thud(1.1, true);
        gore.dust(spill, 10, '#3a3430');
        gore.fire(spill, 18, 0.7, 2.5);
        flame.copy(spill);
        light.pos.set(spill.x, 0.7, spill.z + 0.6);
        heat.pos.copy(spill);
        heat.r = 1.1;
        embers = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ map: emberTexture(), color: new THREE.Color(2.2, 1.4, 1.1), transparent: true, depthWrite: false }));
        embers.rotation.x = -Math.PI / 2;
        embers.scale.set(1.15, 0.7, 1);
        embers.position.set(spill.x, 0.02, spill.z);
        embers.renderOrder = 1;
        g.add(embers);
        burn = EMBER_LIFE;
      }
    } else if (burn > 0) {
      burn -= dt;
      const k = Math.min(1, burn / 2);
      (embers!.material as THREE.MeshBasicMaterial).opacity = k;
      light.intensity = 15 * k;
      heat.s = 0.8 * k;
      if (burn <= 0) {
        // Brent ut: ingen flammer, lys eller varme igjen (punktet flyttes langt unna, så ingen løkke finner det)
        flame.set(1e5, -50, 0);
        light.intensity = 0;
        heat.s = 0;
        embers!.removeFromParent();
      }
    }
  });
  return flame;
}

// ---------------------------------------------------------------- krigsbanner
/** Hornet hodeskalle malt på duken (sentrum cx, cy, omtrent 200 piksler bred ved s = 1). */
function hornedSkull(c: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = 0.93;
  // Hornene bøyer ut og opp fra tinningene, med riller
  for (const side of [-1, 1]) {
    c.fillStyle = '#cbbd9c';
    c.beginPath();
    c.moveTo(side * 34, -26);
    c.bezierCurveTo(side * 96, -34, side * 112, -84, side * 84, -124);
    c.bezierCurveTo(side * 86, -86, side * 62, -52, side * 26, -44);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(70,46,24,0.55)';
    c.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const t = 0.15 + k * 0.13;
      const hx = side * (34 + (84 - 34) * t + Math.sin(t * Math.PI) * 30), hy = -26 - 98 * t;
      c.beginPath();
      c.moveTo(hx - side * 9, hy + 6);
      c.lineTo(hx + side * 7, hy - 5);
      c.stroke();
    }
  }
  // Hjerneskallen og kjeven
  c.fillStyle = '#e4d9bf';
  c.beginPath();
  c.ellipse(0, -8, 46, 50, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-30, 18);
  c.lineTo(30, 18);
  c.lineTo(22, 60);
  c.lineTo(-22, 60);
  c.closePath();
  c.fill();
  // Øyehuler, nesehule og tenner
  c.fillStyle = '#1a0a08';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.ellipse(side * 18, 4, 13, 15, side * -0.25, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.moveTo(0, 20);
  c.lineTo(-7, 35);
  c.lineTo(7, 35);
  c.closePath();
  c.fill();
  for (let i = -3; i <= 3; i++) c.fillRect(i * 7 - 1.5, 44, 3, 15);
  // Sprekk i skallen
  c.strokeStyle = '#1a0a08';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(-8, -56);
  c.lineTo(-2, -36);
  c.lineTo(-12, -24);
  c.stroke();
  c.restore();
}

const bannerTex = new Map<string, THREE.Texture>();
/** Duken: rød med folder, skitt, gullkant øverst, hornet hodeskalle, frynsete bunn med lange filler og hull. */
function bannerTexture(cloth: string) {
  let t = bannerTex.get(cloth);
  if (t) return t;
  const W = 256, H = 512;
  t = canvasTex(plainCanvas(W, H, (c) => {
    c.fillStyle = cloth;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) {
      const x = (i / 7) * W + rand(-6, 6), w = W / 7 + rand(-4, 8);
      const gr = c.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.28)');
      gr.addColorStop(0.5, 'rgba(255,220,200,0.07)');
      gr.addColorStop(1, 'rgba(0,0,0,0.28)');
      c.fillStyle = gr;
      c.fillRect(x, 0, w, H);
    }
    for (let i = 0; i < 160; i++) {
      const y = H * Math.pow(Math.random(), 0.55);
      c.fillStyle = `rgba(22,8,6,${0.04 + 0.14 * (y / H)})`;
      c.beginPath();
      c.arc(rand(0, W), y, rand(3, 16), 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#9a7428';
    c.fillRect(0, 8, W, 12);
    c.fillRect(0, 28, W, 4);
    hornedSkull(c, W / 2, 200, 0.95);
    // Fillene: trekanter skåret opp fra bunnen, noen hakk i sidene og et par hull
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.moveTo(-2, H + 2);
    let x = -2;
    while (x < W) {
      const nx = x + rand(12, 30);
      c.lineTo((x + nx) / 2 + rand(-5, 5), H - rand(30, 170));
      c.lineTo(nx, H - rand(0, 18));
      x = nx;
    }
    c.lineTo(W + 2, H + 2);
    c.closePath();
    c.fill();
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? W : 0;
      c.beginPath();
      c.moveTo(side, rand(260, 420));
      c.lineTo(side + (side ? -1 : 1) * rand(10, 26), rand(280, 440));
      c.lineTo(side, rand(300, 460));
      c.fill();
    }
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.ellipse(rand(30, W - 30), rand(300, 440), rand(4, 11), rand(5, 14), rand(0, 3), 0, Math.PI * 2);
      c.fill();
    }
  }), false);
  bannerTex.set(cloth, t);
  return t;
}

/**
 * Fillete krigsbanner med hornet hodeskalle på høy stang med tverrslå. Duken er et plan med mange ruter som bølger
 * i vinden (regnes på CPU, og bare når banneret er nær kameraet).
 */
export function warBanner(g: THREE.Group, updates: Updates, x: number, z: number, h = 5.4, cloth = '#8a1a14', w = 1.5, len = 2.9) {
  const sg = staticGroup(g);
  const wood = woodMat();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, h, 7), wood);
  pole.position.set(x, h / 2, z);
  sg.add(pole);
  sg.add(rod(new THREE.Vector3(x - w / 2 - 0.2, h - 0.3, z + 0.1), new THREE.Vector3(x + w / 2 + 0.2, h - 0.3, z + 0.1), 0.05, wood));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 5), ironMat());
  tip.position.set(x, h + 0.25, z);
  sg.add(tip);
  const geo = new THREE.PlaneGeometry(w, len, 8, 14);
  geo.translate(0, -len / 2, 0);
  const m = lit({ map: bannerTexture(cloth), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.92 }, false);
  const flag = new THREE.Mesh(geo, m);
  flag.position.set(x, h - 0.3, z + 0.14);
  g.add(flag);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  const ph = rand(0, 10);
  updates.push((_dt, t, camX) => {
    if (Math.abs(x - camX) > 24) return;
    const s = 0.1 + Math.min(1.6, wind.strength) * 0.22;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1];
      // Øverste rad ligger på y 0; Math.max hindrer NaN når planet gir en bitte liten positiv y
      const v = Math.pow(Math.max(0, -by / len), 1.3);
      const wave = Math.sin(t * 2.4 + ph - by * 2.2 + bx * 1.1) + Math.sin(t * 3.9 + ph * 2 - by * 3.4) * 0.35;
      pos.setXYZ(i, bx + v * s * 0.5, by + Math.abs(wave) * v * s * 0.08, wave * v * s);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
}

// ---------------------------------------------------------------- runesteiner
const runeTex = new Map<string, THREE.Texture>();
/**
 * Innhogde runer på en stein: et slangebånd som går opp langs kantene og over toppen med runer inni, og et
 * stort flettemotiv i midten. Furene er mørke med en lys kant under (hogd inn). glow gir et glødekart med furene
 * i isblått.
 */
function runeTexture(glow: boolean) {
  const key = glow ? 'g' : 'd';
  let t = runeTex.get(key);
  if (t) return t;
  const W = 256, H = 512;
  const paint = (c: CanvasRenderingContext2D, groove: string, light: string | null) => {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const stroke = (draw: () => void, w: number) => {
      if (light) {
        c.save();
        c.translate(1.5, 2);
        c.strokeStyle = light;
        c.lineWidth = w;
        draw();
        c.restore();
      }
      c.strokeStyle = groove;
      c.lineWidth = w;
      draw();
    };
    // Slangebåndet: to parallelle furer, fra nede til venstre, over toppen og ned til høyre
    const band = (o: number) => () => {
      c.beginPath();
      c.moveTo(40 + o, 500);
      c.lineTo(34 + o, 150);
      c.bezierCurveTo(34 + o, 40 + o, 222 - o, 40 + o, 222 - o, 150);
      c.lineTo(214 - o, 470);
      c.stroke();
    };
    stroke(band(0), 7);
    stroke(band(30), 7);
    // Hodet til slangen nederst til høyre
    stroke(() => {
      c.beginPath();
      c.ellipse(200, 482, 20, 12, 0.4, 0, Math.PI * 2);
      c.stroke();
    }, 6);
    // Runer inni båndet (korte staver med kvister)
    const rune = (x: number, y: number, a: number, k: number) => () => {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, -9);
      c.lineTo(0, 9);
      if (k % 3 === 0) { c.moveTo(0, -9); c.lineTo(6, -3); }
      if (k % 3 === 1) { c.moveTo(-5, -4); c.lineTo(5, 2); }
      if (k % 2 === 0) { c.moveTo(0, 1); c.lineTo(-6, 7); }
      c.stroke();
      c.restore();
    };
    for (let i = 0; i < 9; i++) stroke(rune(52, 470 - i * 36, 0, i), 4);
    for (let i = 0; i < 8; i++) stroke(rune(203, 450 - i * 36, 0, i + 4), 4);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.15 + i * 0.175);
      stroke(rune(128 - Math.cos(a) * 80, 150 - Math.sin(a) * 88, -Math.PI / 2 + a, i + 2), 4);
    }
    // Flettemotiv i midten: to løkker som går i hverandre, og et kors
    stroke(() => {
      c.beginPath();
      c.ellipse(128, 250, 44, 60, 0, 0, Math.PI * 2);
      c.moveTo(128 + 40, 330);
      c.ellipse(128, 330, 40, 40, 0, 0, Math.PI * 2);
      c.moveTo(128, 180);
      c.lineTo(128, 390);
      c.moveTo(84, 280);
      c.lineTo(172, 280);
      c.stroke();
    }, 6);
  };
  const cv = plainCanvas(W, H, (c) => paint(c, 'rgba(18,22,30,0.92)', 'rgba(170,182,200,0.45)'));
  t = canvasTex(cv, false);
  if (glow) {
    const em = canvasTex(plainCanvas(W, H, (c) => {
      c.fillStyle = '#000';
      c.fillRect(0, 0, W, H);
      paint(c, '#6fd8ff', null);
    }), false);
    t.userData.emissiveMap = em;
  }
  runeTex.set(key, t);
  return t;
}

/**
 * Runestein i 3D: en høy, ujevn steinblokk som smalner mot en avrundet topp, med innhogde runer foran (eget plan
 * like foran steinen). glow gir runene et svakt blått skjær, og snøen legger seg på toppen (surface.ts).
 */
export function runeStone(g: THREE.Group, x: number, z: number, h = 3, glow = false) {
  const w = h * 0.4, d = h * 0.16;
  const box = new THREE.BoxGeometry(w, h, d, 5, 12, 2);
  box.deleteAttribute('normal');
  box.deleteAttribute('uv');
  const geo = mergeVertices(box);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n3 = valueNoise3(Math.floor(rand(1, 9999)));
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const t = py / h + 0.5;
    px *= 1 - 0.22 * t;
    // Avrundet topp: hjørnene øverst senkes
    if (t > 0.7) py -= Math.pow(Math.abs(px) / (w / 2), 2) * (t - 0.7) * h * 0.5;
    const k = fbm3(n3, px * 2.5, py * 1.2, pz * 2.5, 3) - 0.5;
    px += Math.sign(px) * k * 0.12;
    pz += Math.sign(pz) * k * 0.05;
    pos.setXYZ(i, px, py + h / 2, pz);
  }
  geo.computeVertexNormals();
  const stone = new THREE.Mesh(geo, mat('runestone', () => lit({ color: '#6a7282', roughness: 0.93 }, { scale: 0.9, normal: 1.3, albedo: 0.5, snow: 0.9 })));
  stone.position.set(x, -0.12, z);
  stone.rotation.y = rand(-0.25, 0.25);
  const rt = runeTexture(glow);
  const rm = mat('runes' + (glow ? 'g' : ''), () => {
    const m = lit({ map: rt, alphaTest: 0.35, roughness: 0.95 }, false);
    if (rt.userData.emissiveMap) {
      m.emissiveMap = rt.userData.emissiveMap as THREE.Texture;
      m.emissive.set('#ffffff');
      m.emissiveIntensity = 1.4;
    }
    return m;
  });
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.72, h * 0.78), rm);
  runes.position.set(0, h * 0.44, d / 2 + 0.08);
  runes.userData.noCast = true;
  stone.add(runes);
  staticGroup(g).add(stone);
  return stone;
}

// ---------------------------------------------------------------- klipper
const SNOW = new THREE.Color('#e8eef6');
/**
 * Klippevegg: en høy steinmasse (sylinder formet med støy) med loddrette furer, lag som stikker ut og en ujevn,
 * flat topp med plass til ruiner. Snø der flatene vender opp (toppunktfarger og surface.ts). Returnerer høyden på
 * toppen, så ruiner, bro og fossefall kan plasseres.
 */
export function cliff(g: THREE.Group, x: number, z: number, w: number, h: number, d: number, cols = ['#7a8496', '#6a7486', '#8a94a4']): number {
  const RS = 48, HS = 28;
  const cyl = new THREE.CylinderGeometry(0.8, 1, 1, RS, HS);
  cyl.deleteAttribute('normal');
  cyl.deleteAttribute('uv');
  const geo = mergeVertices(cyl);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n3 = valueNoise3(Math.floor(rand(1, 9999)));
  const seed = rand(0, 50);
  const furrows = new Float32Array(pos.count);
  // Toppen midt på klippen (snitt av toppflaten nær midten), der ruiner og brofester skal stå
  let topSum = 0, topN = 0;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i) + 0.5, pz = pos.getZ(i);
    const r = Math.hypot(px, pz);
    const a = Math.atan2(pz, px);
    const ca = Math.cos(a), sa = Math.sin(a);
    const furrow = 1 - Math.abs(fbm3(n3, ca * 2.6 + seed, py * h * 0.1, sa * 2.6, 4) * 2 - 1);
    const lump = fbm3(n3, ca * 1.3, py * 1.8 + seed, sa * 1.3, 3);
    const strata = Math.sin(py * h * 1.1 + lump * 6) * 0.06;
    // Smalere oppover, store klumper og dype furer
    const k = (0.62 + furrow * 0.26 + lump * 0.5 + strata) * (1 - py * 0.22);
    // Takkete topp: høyden varierer rundt klippen, som tinder
    const crag = fbm3(n3, ca * 1.7 + seed * 2, 7.7, sa * 1.7, 3);
    let y = py * h * (1 + (crag - 0.5) * 0.7 * Math.max(0, (py - 0.45) / 0.55));
    if (py > 0.999) y += (lump - 0.5) * 0.8 + (1 - r / 0.8) * 0.4;
    pos.setXYZ(i, px * k * w / 2, y, pz * k * d / 2);
    furrows[i] = furrow;
    if (py > 0.999 && r < 0.45) {
      topSum += y;
      topN++;
    }
  }
  const top = topN ? topSum / topN : h;
  geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const base = cols.map((c) => new THREE.Color(c));
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(base[Math.floor(n3(pos.getX(i) * 0.2, pos.getY(i) * 0.15, 3.3) * base.length * 0.999)]);
    c.multiplyScalar(0.55 + furrows[i] * 0.5);
    const ny = nrm.getY(i);
    const snow = Math.min(1, Math.max(0, (ny - 0.45) / 0.3));
    c.lerp(SNOW, snow * 0.95);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, mat('cliff', () => lit({ vertexColors: true, roughness: 0.93 }, { scale: 0.45, normal: 1.3, albedo: 0.45, snow: 0.8 })));
  m.position.set(x, -0.3, z);
  staticGroup(g).add(m);
  return top - 0.3;
}

// ---------------------------------------------------------------- fossefall
let fallTex: THREE.Texture | null = null;
/** Striper av vann (flisbart i høyden), gjennomsiktig ut mot sidene. */
function fallTexture() {
  if (fallTex) return fallTex;
  const W = 128, H = 256;
  const cv = plainCanvas(W, H, (c) => {
    c.fillStyle = 'rgba(190,215,240,0.28)';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const x = rand(0, W), w = rand(1.5, 7), y = rand(0, H), len = rand(40, 170), a = rand(0.2, 0.7);
      for (const dy of [0, -H]) {
        const gr = c.createLinearGradient(0, y + dy, 0, y + dy + len);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.5, `rgba(236,246,255,${a})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gr;
        c.fillRect(x, y + dy, w, len);
      }
    }
    c.globalCompositeOperation = 'destination-out';
    const e = c.createLinearGradient(0, 0, W, 0);
    e.addColorStop(0, 'rgba(0,0,0,1)');
    e.addColorStop(0.22, 'rgba(0,0,0,0)');
    e.addColorStop(0.78, 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = e;
    c.fillRect(0, 0, W, H);
  });
  fallTex = canvasTex(cv, false);
  fallTex.wrapT = THREE.RepeatWrapping;
  return fallTex;
}

let mistTex: THREE.Texture | null = null;
function mistTexture() {
  if (mistTex) return mistTex;
  mistTex = canvasTex(plainCanvas(128, 128, (c) => {
    const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.7)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, 128, 128);
  }), false);
  return mistTex;
}

/**
 * Fossefall ned en klippevegg: to lag med vannstriper som ruller nedover i ulik fart, bredere og lenger ut fra
 * veggen nederst, skum og dis der vannet treffer bakken, og en kulp. top er høyden vannet kommer fra, z er foran
 * klippen.
 */
export function waterfall(g: THREE.Group, gore: Gore, updates: Updates, x: number, z: number, top: number, width = 2.2) {
  const layers: THREE.Texture[] = [];
  const layer = (w: number, dz: number, opacity: number, rep: number) => {
    const t = fallTexture().clone();
    t.repeat.set(1, top / rep);
    layers.push(t);
    const geo = new THREE.PlaneGeometry(w, top, 1, 12);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = 0.5 - p.getY(i) / top;
      p.setXYZ(i, p.getX(i) * (1 + k * 0.45), p.getY(i), k * k * 1.2);
    }
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color('#dcecff').multiplyScalar(1.15), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, top / 2, z + dz);
    m.userData.noCast = true;
    g.add(m);
  };
  layer(width, 0, 0.85, 7);
  layer(width * 0.75, 0.12, 0.6, 4.5);
  // Lydkilde for stemningen (finishEnv legger listen på Env.waters)
  ((g.userData.waters ??= []) as THREE.Vector3[]).push(new THREE.Vector3(x, 1, z + 1));
  // Kulpen nederst, med en ring av is
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24), lit({ color: '#1c3450', roughness: 0.06, metalness: 0.3 }, false));
  pool.rotation.x = -Math.PI / 2;
  pool.scale.set(width * 0.9, width * 0.5, 1);
  pool.position.set(x, 0.02, z + 1.3);
  pool.userData.noCast = true;
  g.add(pool);
  // Dis som pulserer over kulpen
  const mist: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(width * 2.2, width * 1.6), new THREE.MeshBasicMaterial({ map: mistTexture(), transparent: true, opacity: 0.35, depthWrite: false, color: '#dfeaf6' }));
    mm.position.set(x + (i - 1) * width * 0.5, width * 0.5, z + 1.2 + i * 0.1);
    mm.userData.noCast = true;
    g.add(mm);
    mist.push(mm);
  }
  let acc = 0;
  updates.push((dt, t, camX) => {
    for (let i = 0; i < layers.length; i++) layers[i].offset.y += dt * (i ? 1.7 : 1.15);
    if (Math.abs(x - camX) > 30) return;
    for (let i = 0; i < mist.length; i++) {
      const mm = mist[i];
      (mm.material as THREE.MeshBasicMaterial).opacity = 0.26 + Math.sin(t * 0.9 + i * 2.1) * 0.08;
      mm.scale.setScalar(1 + Math.sin(t * 0.6 + i) * 0.08);
    }
    acc += dt * 14;
    while (acc > 1) {
      acc--;
      gore.ambient(x + rand(-width * 0.6, width * 0.6), rand(0.1, 0.5), z + rand(0.6, 1.8), rand(-0.4, 0.4), rand(0.4, 1.0), '#e6f0fa', rand(0.14, 0.3), rand(1.4, 2.4), false, 0);
    }
  });
}

// ---------------------------------------------------------------- taubro
/**
 * Taubro over et skar: planker langs en hengende bue (noen mangler), to tau som rekkverk med loddrette tau ned til
 * plankene, snø på noen planker og istapper under. Alt står stille og slås sammen.
 */
export function ropeBridge(g: THREE.Group, x0: number, x1: number, y: number, z: number, sag = 1.2) {
  const sg = staticGroup(g);
  const wood = woodMat(), rope = ropeMat();
  const at = (t: number, dy = 0, dz = 0) => new THREE.Vector3(x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t) + dy, z + dz);
  const n = Math.round((x1 - x0) / 0.34);
  for (let i = 0; i <= n; i++) {
    if (i > 1 && i < n - 1 && Math.random() < 0.07) continue;
    const t = i / n, p = at(t);
    const slope = Math.atan2(-sag * 4 * (1 - 2 * t), x1 - x0);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 1.15 + rand(-0.12, 0.08)), wood);
    plank.position.copy(p);
    plank.rotation.set(rand(-0.05, 0.05), rand(-0.08, 0.08), slope + rand(-0.05, 0.05));
    sg.add(plank);
    if (Math.random() < 0.3) icicles(g, p.x - 0.12, p.x + 0.12, p.y - 0.03, p.z + rand(-0.4, 0.4), 8, 0.35);
  }
  for (const dz of [-0.58, 0.58]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 24; k++) pts.push(at(k / 24, 0.95 - 0.2 * Math.sin((k / 24) * Math.PI), dz));
    sg.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.028, 5, false), rope));
    for (let i = 2; i < n - 1; i += 3) {
      const t = i / n;
      sg.add(rod(at(t, 0, dz), at(t, 0.95 - 0.2 * Math.sin(t * Math.PI), dz), 0.012, rope, 3));
    }
    for (const t of [0, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.7, 6), wood);
      post.position.copy(at(t, 0.45, dz * 1.05));
      sg.add(post);
    }
  }
}

// ---------------------------------------------------------------- istapper
const iceGeos: THREE.BufferGeometry[] = [];
/** Istapper i en rad langs en kant fra x0 til x1 i høyden y. dens er antall per enhet, len den lengste. */
export function icicles(g: THREE.Group, x0: number, x1: number, y: number, z: number, dens = 6, len = 0.5) {
  if (!iceGeos.length) for (const r of [0.03, 0.045, 0.06]) iceGeos.push(new THREE.ConeGeometry(r, 1, 5).rotateX(Math.PI).translate(0, -0.5, 0));
  const sg = staticGroup(g);
  const n = Math.max(1, Math.round((x1 - x0) * dens));
  for (let i = 0; i < n; i++) {
    const l = len * rand(0.25, 1.1);
    const k = Math.min(2, Math.floor((l / len) * 3));
    const ic = new THREE.Mesh(iceGeos[k], iceMat());
    ic.scale.set(len * 2, l, len * 2);
    ic.position.set(rand(x0, x1), y, z + rand(-0.05, 0.05));
    sg.add(ic);
  }
}

// ---------------------------------------------------------------- ruiner og gjerde
/** Ruin på toppen av en klippe: murrester med ujevn topp, en bue og et halvt tårn. Snø legger seg på toppene. */
export function ruins(g: THREE.Group, x: number, y: number, z: number, s = 1) {
  const sg = staticGroup(g);
  const st = stoneTex('#6a6e78', '#34363e', 64, 32);
  st.repeat.set(2, 2);
  const m = mat('ruin', () => lit({ map: st, roughness: 0.92 }, { scale: 0.7, normal: 1.0, albedo: 0.4, snow: 0.9 }));
  const block = (w: number, h: number, d: number, px: number, py: number, pz: number, ry = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(px, py, pz);
    b.rotation.y = ry;
    sg.add(b);
  };
  // Muren: blokker i ulik høyde
  for (let i = -3; i <= 3; i++) {
    const h = rand(0.8, 2.8) * s;
    block(0.9 * s, h, 0.8 * s, x + i * 0.92 * s, y + h / 2, z, rand(-0.04, 0.04));
  }
  // Buen: to søyler og en halv ring
  const ax = x + rand(-1, 1) * s;
  for (const dx of [-1.1, 1.1]) block(0.6 * s, 2.6 * s, 0.7 * s, ax + dx * s, y + 1.3 * s, z + 0.9 * s);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1 * s, 0.32 * s, 5, 10, Math.PI), m);
  arch.position.set(ax, y + 2.6 * s, z + 0.9 * s);
  sg.add(arch);
  icicles(g, ax - 0.9 * s, ax + 0.9 * s, y + 2.35 * s, z + 0.9 * s, 5, 0.6 * s);
  // Et halvt tårn med takkete topp
  const tw = new THREE.CylinderGeometry(1.1 * s, 1.25 * s, 4.5 * s, 12, 3, true);
  const tp = tw.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 2 * s) tp.setY(i, tp.getY(i) - rand(0, 1.8) * s);
  tw.computeVertexNormals();
  const tower = new THREE.Mesh(tw, mat('ruinTower', () => lit({ map: st, roughness: 0.92, side: THREE.DoubleSide }, { scale: 0.7, normal: 1.0, albedo: 0.4, snow: 0.9 })));
  tower.position.set(x + 3.6 * s, y + 2.25 * s, z - 0.4 * s);
  sg.add(tower);
}

/** Taugjerde langs en kant: skjeve stolper med to tau som henger mellom dem (ved juvet i konseptbilde 4). */
export function ropeFence(g: THREE.Group, x0: number, x1: number, z: number, h = 1.1) {
  const sg = staticGroup(g);
  const wood = woodMat(), rope = ropeMat();
  const tops: THREE.Vector3[] = [];
  for (let x = x0; x <= x1; x += rand(2.2, 3.0)) {
    const lean = rand(-0.12, 0.12), pz = z + rand(-0.15, 0.15);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, h + 0.3, 6), wood);
    post.position.set(x, (h + 0.3) / 2 - 0.15, pz);
    post.rotation.z = lean;
    sg.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), snowMat());
    cap.position.set(x - Math.sin(lean) * (h + 0.15), h + 0.12, pz);
    sg.add(cap);
    tops.push(new THREE.Vector3(x - Math.sin(lean) * h * 0.9, h * 0.9, pz));
  }
  for (let i = 0; i + 1 < tops.length; i++) {
    const a = tops[i], b = tops[i + 1];
    for (const dy of [0, -0.42]) {
      const p0 = a.clone().setY(a.y + dy), p2 = b.clone().setY(b.y + dy);
      const p1 = p0.clone().add(p2).multiplyScalar(0.5);
      p1.y -= rand(0.12, 0.3);
      sg.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 10, 0.022, 4, false), rope));
    }
  }
}
