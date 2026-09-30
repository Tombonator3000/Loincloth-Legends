// Istapper som faller ned i kampfeltet i frostpasset (konseptbilde 4). Først et varsel: en skygge på bakken som
// mørkner, snø som drysser fra oven og is som knaker. Så stuper istappen og knuser. Den treffer alle, helter som
// fiender, så lokk fiendene under. Utløses av kjempens bakkeslag, av veltede fyrfat og av og til av seg selv mens
// det slåss (Stage).
import * as THREE from 'three';
import { W } from './world';
import type { Fighter } from './fighter';
import { applyHit } from './combat';
import { ENEMY_ATK, type AttackDef } from './attacks';
import { ICEFIRE } from '../gfx/gore';
import { audio } from '../core/audio';
import { rand, pick } from '../core/math';

/** Sekunder med varsel før istappen faller, og fra toppen av bildet til bakken. */
export const ICICLE_WARN = 0.95;
const FALL = 0.32;
const TOP = 9;
const HIT: AttackDef = {
  ...ENEMY_ATK.hog, id: 'icicle', dmg: 16, reach: 0, zr: 0, kd: true, launch: 4, push: 2.5, heavy: true, armor: false,
  death: ['normal', 'headsplode'], word: ['ICICLED!', 'BRAIN FREEZE!', 'POINTY WEATHER!'],
};

interface Fall { x: number; z: number; t: number; delay: number; mesh: THREE.Mesh; marker: THREE.Mesh }

let geo: THREE.BufferGeometry | null = null;
let mat: THREE.MeshStandardMaterial | null = null;

export class Icicles {
  private list: Fall[] = [];
  private t = rand(5, 9);

  /** on = istapper av seg selv mens det slåss (frostpasset). nature er den som «slår» (en skjult figur). */
  constructor(private on: boolean, private nature: Fighter) {}

  /** En istapp over (x, z), med delay sekunder varsel. */
  drop(x: number, z: number, delay = ICICLE_WARN) {
    geo ??= new THREE.ConeGeometry(0.16, 1.5, 6).rotateX(Math.PI).translate(0, 0.75, 0);
    mat ??= new THREE.MeshStandardMaterial({ color: '#d4ecff', roughness: 0.08, metalness: 0, emissive: '#1a3a5a', emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.position.set(x, TOP, z);
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), new THREE.MeshBasicMaterial({ color: '#0a1424', transparent: true, opacity: 0, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.03, z);
    marker.renderOrder = 1;
    W.scene.add(mesh, marker);
    this.list.push({ x, z, t: 0, delay, mesh, marker });
    audio.iceCrack(0.5);
  }

  /** fighting = en bølge er i gang. fighters = alle som kan treffes. */
  update(dt: number, fighting: boolean, fighters: Fighter[], camX: number, halfW: number) {
    if (this.on && fighting) {
      this.t -= dt;
      if (this.t <= 0) {
        this.t = rand(6, 11);
        const near = fighters.filter((f) => f.alive && f.onGround && Math.abs(f.pos.x - camX) < halfW - 1);
        const f = near.length ? pick(near) : null;
        if (f) this.drop(f.pos.x + rand(-0.6, 0.6), f.pos.z + rand(-0.3, 0.3));
      }
    }
    for (const f of this.list) {
      f.t += dt;
      if (f.t < f.delay) {
        // Varselet: skyggen vokser og mørkner, snø drysser ned
        const k = f.t / f.delay;
        f.marker.scale.setScalar(0.35 + 0.65 * k);
        (f.marker.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.45 * k + Math.sin(f.t * 22) * 0.05;
        if (Math.random() < dt * 30) W.gore.ambient(f.x + rand(-0.4, 0.4), rand(5, 7), f.z + rand(-0.2, 0.2), 0, rand(-5, -3), '#ffffff', rand(0.04, 0.08), 1.6, false, 4);
        continue;
      }
      const k = (f.t - f.delay) / FALL;
      if (k < 1) {
        f.mesh.visible = true;
        f.mesh.position.y = TOP * (1 - k * k);
        continue;
      }
      this.shatter(f, fighters);
    }
    this.list = this.list.filter((f) => f.t < f.delay + FALL);
  }

  private shatter(f: Fall, fighters: Fighter[]) {
    f.mesh.removeFromParent();
    f.marker.removeFromParent();
    const at = new THREE.Vector3(f.x, 0.2, f.z);
    W.gore.sparks(at, 14, '#cfeaff', 6);
    W.gore.fire(at, 10, 0.6, 1.5, ICEFIRE);
    W.gore.dust(at, 12, '#eef4fa');
    audio.iceCrack(1);
    audio.thud(0.8, true);
    W.fx.shake(0.25);
    this.nature.pos.set(f.x, 0, f.z);
    for (const t of fighters) {
      if (!t.alive || t.invuln > 0 || t.pos.y > 1.2) continue;
      if (Math.abs(t.pos.x - f.x) > 0.85 || Math.abs(t.pos.z - f.z) > 0.6) continue;
      if (t.state === 'down' && t.onGround) continue;
      if (t.team !== 'hero') t.envKill = 'ICICLE';
      const res = applyHit(this.nature, t, HIT);
      if (!res.killed && t.team !== 'hero') t.envKill = '';
      W.fx.text(t.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(HIT.word!), 'word', 1);
    }
  }

  clear() {
    for (const f of this.list) {
      f.mesh.removeFromParent();
      f.marker.removeFromParent();
    }
    this.list = [];
  }
}
