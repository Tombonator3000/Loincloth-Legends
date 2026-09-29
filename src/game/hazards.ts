// Farer i brettene: logikk for miljødrap og skade på helter. Tegningen ligger i gfx/env/hazards.ts.
import * as THREE from 'three';
import type { Fighter } from './fighter';
import { W } from './world';
import { HAZARDS, type HazardDef } from '../data/hazards';
import type { HazardVisual } from '../gfx/env/hazards';
import { audio } from '../core/audio';
import { rand, pick } from '../core/math';

export class Hazard {
  t = rand(0, 3);
  /** Piggfelle: hvor langt oppe piggene er (0 til 1). */
  up = 0;
  private rattled = false;
  constructor(public def: HazardDef, public vis: HazardVisual) {}

  get info() {
    return HAZARDS[this.def.kind];
  }

  /** Er punktet inne i faren? Pøler er ovale, piggfeller firkantede. */
  contains(x: number, z: number, pad = 0) {
    const d = this.def;
    const hx = d.w / 2 + pad, hz = d.d / 2 + pad;
    if (d.kind === 'spiketrap') return Math.abs(x - d.x) < hx && Math.abs(z - d.z) < hz;
    const u = (x - d.x) / hx, v = (z - d.z) / hz;
    return u * u + v * v <= 1;
  }

  /** Farlig akkurat nå? Piggfellen bare når piggene er oppe. */
  get armed() {
    return this.def.kind !== 'spiketrap' || this.up > 0.6;
  }

  update(dt: number, time: number, near: boolean) {
    this.vis.update(dt, time);
    if (this.def.kind !== 'spiketrap') return;
    this.t += dt;
    const c = this.t % 3.4;
    let k = 0;
    if (c < 2.3) this.rattled = false;
    else if (c < 2.7) {
      k = 0.06 + Math.sin(c * 60) * 0.03;
      if (!this.rattled && near) {
        this.rattled = true;
        audio.bones();
      }
    } else if (c < 2.8) k = (c - 2.7) / 0.1;
    else if (c < 3.2) k = 1;
    else k = 1 - (c - 3.2) / 0.2;
    if (k >= 1 && this.up < 1 && near) audio.impale();
    this.up = Math.max(0, Math.min(1, k));
    this.vis.setSpikes?.(this.up);
  }

  /** Skyv en gående figur ut til kanten (fiender går rundt farene). */
  pushOut(f: Fighter, zLimit = 2.5) {
    const d = this.def;
    let ux = f.pos.x - d.x, uz = f.pos.z - d.z;
    if (Math.abs(ux) + Math.abs(uz) < 1e-3) uz = 0.01;
    const hx = d.w / 2 + 0.25, hz = d.d / 2 + 0.25;
    const len = Math.hypot(ux / hx, uz / hz) || 1;
    let nx = d.x + (ux / len) * 1.02;
    let nz = d.z + (uz / len) * 1.02;
    // Kanten utenfor veien: skyv inn mot midten i stedet
    if (Math.abs(nz) > zLimit) {
      nx = f.pos.x;
      nz = d.z - Math.sign(d.z || 1) * hz * 1.02;
    }
    f.pos.x = nx;
    f.pos.z = nz;
  }

  /** Hvilken vei (i dybden) en helt skal sprette ut. */
  private outDir(f: Fighter) {
    const d = this.def;
    return Math.abs(d.z) > 0.5 ? -Math.sign(d.z) : Math.sign(f.pos.z - d.z) || 1;
  }

  /** En fiende havner i faren: teit og passende død. */
  kill(f: Fighter, killer: Fighter | null) {
    const kind = this.def.kind;
    const dir = killer ? Math.sign(f.pos.x - killer.pos.x) || 1 : 1;
    f.envKill = this.info.name;
    const tp = f.torsoPoint();
    switch (kind) {
      case 'spikes':
      case 'spiketrap': {
        f.die('normal', dir, killer);
        f.corpseLife = 40;
        f.pos.y = kind === 'spikes' ? 0.42 : 0.62;
        f.onGround = true;
        f.vel.set(0, 0, 0);
        audio.impale();
        if (f.def.blood !== 'bone') {
          W.gore.fountain(f.rig.g.torso, 0, 0.4, 0, 1, 2.2, 1.1, f.def.blood === 'green' ? 'green' : 'red');
          for (let i = 0; i < 5; i++) W.gore.splat(this.def.x + rand(-this.def.w / 2, this.def.w / 2) * 0.8, this.def.z + rand(-0.4, 0.4), rand(0.3, 0.6));
        }
        break;
      }
      case 'bog':
        f.die('normal', dir, killer);
        f.collapseT = 1.8;
        f.sinkRate = 0.55;
        audio.splash();
        for (let i = 0; i < 18; i++) W.gore.ambient(f.pos.x + rand(-0.5, 0.5), 0.1, f.pos.z + rand(-0.3, 0.3), rand(-1, 1), rand(1, 3), '#6b7a2a', rand(0.1, 0.22), 0.8, false, 6);
        break;
      case 'icehole':
        f.die('normal', dir, killer);
        f.collapseT = 0.9;
        f.sinkRate = 1.1;
        f.rig.setTint([0.7, 0.88, 1.35]);
        audio.splash();
        for (let i = 0; i < 26; i++) W.gore.ambient(f.pos.x + rand(-0.4, 0.4), 0.2, f.pos.z + rand(-0.3, 0.3), rand(-2.5, 2.5), rand(3, 7), pick(['#ffffff', '#bfe3ff', '#6fa8dc']), rand(0.1, 0.24), 1, false, 16);
        break;
      case 'lava':
        f.die('normal', dir, killer);
        f.collapseT = 1.4;
        f.sinkRate = 0.45;
        f.rig.setTint([0.28, 0.2, 0.17]);
        f.rig.setFlashColor(1, 0.5, 0.1);
        f.flash(0.6);
        audio.sizzle(1.4);
        audio.scream(f.def.voice);
        W.gore.fire(tp, 30, 0.5, 4);
        W.gore.flare(tp, 2.5, '#ffb02e', 0.4);
        break;
    }
    W.stats.gibs += 2;
    W.fx.text(tp.clone().add(new THREE.Vector3(0, 1.2, 0)), pick(this.info.words), 'kill big', 1.3);
    W.fx.shake(0.4);
  }

  /** En helt går i faren: skade, et hyl, og ut igjen. */
  hurtHero(f: Fighter) {
    const d = this.def;
    const dir = this.outDir(f);
    const dmg = this.info.heroDmg * f.dmgTaken;
    f.hp -= dmg;
    f.flash(0.2);
    W.rumble(f.player, 0.8, 0.6, 250);
    const at = f.headPoint().add(new THREE.Vector3(0, 0.8, 0));
    W.fx.text(at, pick(this.info.ouch), 'speech', 1.4);
    if (d.kind === 'lava') {
      audio.sizzle(0.6);
      W.gore.fire(f.torsoPoint(), 12, 0.3, 3);
    } else if (d.kind === 'bog' || d.kind === 'icehole') audio.splash();
    else audio.impale();
    if (f.hp <= 0) {
      f.die(d.kind === 'lava' ? 'explode' : 'normal', 1, null);
      return;
    }
    // Sprett ut mot nærmeste kant (i dybden)
    f.knockdown(0, 7);
    f.vel.z = dir * 4.5;
    f.vel.x = Math.sign(f.pos.x - d.x) * 1.5;
  }
}
