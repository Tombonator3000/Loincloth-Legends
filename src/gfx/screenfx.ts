// Skjermeffekter i etterbehandlingen (post.ts): sjokkbølger, zoomslag mot et punkt, kameradykk, negativ ramme,
// lynglimt, varmeflimmer over ild og lava, årer og rød kant ved lav helse, brennende kant i METAL MODE og dråper
// på glasset (screenwet.ts). Portet og forbedret fra Morbidium (Toms eget spill): src/04_render.js (sjokk, zoom,
// negativ, lyn, årer, brennende kant, kameradykk), src/40_dybde.js (varmekilder) og src/34_blod.js (årer ved lav
// helse). Forbedringer: posisjoner i 3D med perspektivkamera, varmeflimmeret forvrenger bare det som ligger bak
// flammen (dybdetesten i post.ts), og et bånd for lavaelva.
//
// Tilstanden oppdateres i update(dt) på spilltid (0 i pause), også når spillet ikke tegnes. post.ts leser den med
// writeUniforms() når bildet tegnes. Forvrengning følger innstillingen SCREEN DISTORTION, blink følger FLASHES og
// blodet følger gore-nivået (ikke noe blod på FAMILY). På LOW finnes ingen etterbehandling, så da er alt av
// unntatt kameradykket (det koster ingenting).
import * as THREE from 'three';
import { settings } from '../core/settings';
import { ScreenWet } from './screenwet';

interface Shock { pos: THREE.Vector3; t: number; life: number; speed: number; s: number }
interface Heat { pos: THREE.Vector3; r: number; s: number; band: boolean; life: number; max: number }

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class ScreenFX {
  /** Blod og vann på glasset. */
  readonly wet = new ScreenWet();
  /** Etterbehandlingen er på (ikke LOW). Settes av Game når grafikknivået endres. */
  active = false;
  /** Rød kant etter et treff på en helt (0..1, synker av seg selv). */
  hurt = 0;
  /** Rød kant som banker ved lav helse (0..1). */
  low = 0;
  /** Årer som kryper inn fra kanten ved lav helse (0..1). */
  veins = 0;
  /** Hjerteslag: fart på pulsen i kanten og årene. */
  pulse = 3;
  /** Brennende skjermkant (METAL MODE), 0..1. Glir mot burnGoal. */
  burn = 0;
  burnGoal = 0;
  /** Negativ ramme på de største øyeblikkene (1 + holdetid * 10, synker fort). */
  neg = 0;
  /** Kaldt lynglimt, sterkest øverst i bildet. */
  lyn = 0;
  /** Zoomslag: bildet trekkes mot et punkt et øyeblikk. */
  zoom = 0;
  readonly zoomPos = new THREE.Vector3();
  private shocks: Shock[] = [];
  private heat: Heat[] = [];
  private lowGoal = 0;
  private veinGoal = 0;
  private dv = { kick: 0, hold: 0, holdT: 0, z: 1 };
  private cam: THREE.PerspectiveCamera | null = null;
  private splatCd = 0;

  /** Kameraets zoom (kameradykket). Game setter camera.zoom til dette hver frame. */
  get camZoom() {
    return this.dv.z;
  }

  get shockCount() {
    return this.shocks.length;
  }

  get heatCount() {
    return this.heat.length;
  }

  resize(w: number, h: number) {
    this.wet.aspect = w / Math.max(1, h);
  }

  /** Nytt brett eller ny scene: alt forsvinner. Varmekildene legges inn på nytt av miljøet. */
  reset() {
    this.shocks.length = 0;
    this.heat.length = 0;
    this.hurt = this.low = this.veins = this.lowGoal = this.veinGoal = 0;
    this.burn = this.burnGoal = 0;
    this.neg = this.lyn = this.zoom = this.splatCd = 0;
    this.dv.kick = this.dv.hold = this.dv.holdT = 0;
    this.dv.z = 1;
    this.wet.clear();
    this.wet.rain = 0;
  }

  // ---------------------------------------------------------------- store øyeblikk
  /** Sjokkbølge: en ring som skyver bildet utover fra et punkt i verden. s 0..2. */
  shock(pos: THREE.Vector3, s = 1, life = 0.75, speed = 1.25) {
    if (!this.active || !settings.distortion) return;
    if (this.shocks.length >= 4) this.shocks.shift();
    this.shocks.push({ pos: pos.clone(), t: 0, life, speed, s: Math.min(2, s) });
  }

  /** Zoomslag: bildet trekkes mot et punkt et kort øyeblikk. s 0..1. */
  punch(pos: THREE.Vector3, s = 0.6) {
    if (!this.active || !settings.distortion) return;
    this.zoomPos.copy(pos);
    this.zoom = Math.max(this.zoom, Math.min(1, s));
  }

  /**
   * Kameradykk: k er hvor mye nærmere (0.1 er ti prosent), hold er hvor lenge det holder før det glir tilbake.
   * Uten hold er det et kort slag. Virker også på LOW.
   */
  dive(k: number, hold = 0) {
    if (!settings.distortion) return;
    const D = this.dv;
    if (hold > 0) {
      D.hold = Math.max(D.holdT > 0 ? D.hold : 0, k);
      D.holdT = Math.max(D.holdT, hold);
    } else D.kick = Math.min(0.3, Math.max(D.kick, k));
  }

  /** Eksplosjon: sjokkbølge, zoomslag og et lite kameradykk. */
  boom(pos: THREE.Vector3, size = 1) {
    this.shock(pos, 0.7 * size, 0.7, 1.3);
    this.punch(pos, 0.45 * Math.min(1.5, size));
    this.dive(0.03 * size);
  }

  /** Negativ ramme i t sekunder (mild, følger FLASHES). */
  negative(t = 0.08) {
    if (!settings.flashes) return;
    this.neg = Math.max(this.neg, 1 + t * 10);
  }

  /** Kaldt lynglimt over hele bildet (følger FLASHES). */
  lightning(k = 0.6) {
    if (!settings.flashes) return;
    this.lyn = Math.max(this.lyn, Math.min(1, k));
  }

  /**
   * Varmeflimmer over ild og lava. pos er foten av flammen, r radius i verdensenheter, s styrke 0..1.
   * band = et bredt bånd som følger kameraet langs x (lavaelva). life > 0 gir en kilde som dør ut (meteorer).
   */
  addHeat(pos: THREE.Vector3, r: number, s = 1, band = false, life = -1) {
    if (this.heat.length > 64) this.heat.shift();
    const h = { pos: pos.clone(), r, s, band, life, max: life };
    this.heat.push(h);
    // Kilden kan flyttes (et fyrfat som veltes) ved å endre pos
    return h;
  }

  /** Fjern en varmekilde (en rekvisitt som slettes i brettverkstedet). */
  removeHeat(h: { pos: THREE.Vector3 }) {
    const i = this.heat.indexOf(h as (typeof this.heat)[number]);
    if (i >= 0) this.heat.splice(i, 1);
  }

  /**
   * Svakeste levende helt (hp delt på maks), eller -1 når ingen helt er i live. Kalles hver frame fra brettet og
   * duellen. Årer under 35 prosent helse, og hjertet slår fortere jo lavere helsa er.
   */
  health(ratio: number) {
    if (ratio < 0) {
      this.lowGoal = this.veinGoal = 0;
      return;
    }
    const k = ratio < 0.35 ? 1 - ratio / 0.35 : 0;
    this.lowGoal = k;
    this.veinGoal = settings.gore > 0 ? k : 0;
    this.pulse = 2.6 + (1 - Math.max(0, ratio)) * 3.2;
  }

  /** Blod rundt et punkt i verden (sprengte fiender, sjefens død). Høyst ett sprut per 0,7 sekunder. */
  splatAt(pos: THREE.Vector3, amount = 1) {
    if (!this.cam || !this.wet.enabled || !this.wet.bloodAllowed || this.splatCd > 0) return;
    tmp.copy(pos).project(this.cam);
    if (tmp.z > 1 || Math.abs(tmp.x) > 1.2 || Math.abs(tmp.y) > 1.2) return;
    this.splatCd = 0.7;
    this.wet.near((tmp.x + 1) / 2, (1 - tmp.y) / 2, amount);
  }

  // ---------------------------------------------------------------- per frame
  update(dt: number, cam: THREE.PerspectiveCamera) {
    this.cam = cam;
    const w = this.wet;
    w.enabled = this.active;
    w.bloodAllowed = settings.gore > 0;
    w.bloodMul = [0, 0.7, 1, 1.4][settings.gore];
    w.update(dt);
    if (dt <= 0) return;
    this.splatCd -= dt;
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.t += dt;
      if (s.t >= s.life || !settings.distortion) this.shocks.splice(i, 1);
    }
    for (let i = this.heat.length - 1; i >= 0; i--) {
      const h = this.heat[i];
      if (h.life < 0) continue;
      h.life -= dt;
      if (h.life <= 0) this.heat.splice(i, 1);
    }
    this.zoom = Math.max(0, this.zoom - dt * 3.2);
    this.neg = Math.max(0, this.neg - dt * 12);
    this.lyn = Math.max(0, this.lyn - dt * 3.5);
    this.hurt = Math.max(0, this.hurt - dt * 2.5);
    const e = Math.min(1, dt * 3);
    this.low += (this.lowGoal - this.low) * e;
    this.veins += (this.veinGoal - this.veins) * e;
    this.burn += (this.burnGoal - this.burn) * Math.min(1, dt * (this.burnGoal > this.burn ? 4 : 1.5));
    if (this.burn < 0.002 && this.burnGoal === 0) this.burn = 0;
    // Kameradykket: slaget dør fort, holdet holder og glir så tilbake
    const D = this.dv;
    D.kick *= Math.pow(0.02, dt);
    if (D.holdT > 0) D.holdT -= dt;
    else D.hold *= Math.pow(0.15, dt);
    const goal = 1 + (settings.distortion ? D.kick + D.hold : 0);
    D.z += (goal - D.z) * Math.min(1, dt * 9);
    if (Math.abs(D.z - 1) < 1e-4 && goal === 1) D.z = 1;
  }

  /** Skjermposisjon (0..1, y opp) og dybde i kamerarommet for et punkt i verden. */
  private uv(p: THREE.Vector3, cam: THREE.PerspectiveCamera, out: THREE.Vector3) {
    tmp2.copy(p).applyMatrix4(cam.matrixWorldInverse);
    const depth = -tmp2.z;
    out.copy(p).project(cam);
    return out.set((out.x + 1) / 2, (out.y + 1) / 2, depth);
  }

  /** Fyll uniformene i COMPOSITE (post.ts). Kalles etter at scenen er tegnet, så kameraets matriser er oppdatert. */
  writeUniforms(u: Record<string, THREE.IUniform>, cam: THREE.PerspectiveCamera) {
    const distort = settings.distortion;
    const flashes = settings.flashes;
    // Sjokkbølger
    const sj = u.uShock.value as THREE.Vector4[];
    for (let i = 0; i < 4; i++) {
      const s = this.shocks[i];
      if (!s || !distort) {
        sj[i].set(0, 0, 0, 0);
        continue;
      }
      const p = this.uv(s.pos, cam, tmp);
      if (p.z <= 0.1) {
        sj[i].set(0, 0, 0, 0);
        continue;
      }
      sj[i].set(p.x, p.y, s.t * s.speed, s.s * Math.pow(1 - s.t / s.life, 1.5));
    }
    // Zoomslag
    const zp = this.uv(this.zoomPos, cam, tmp);
    (u.uZoom.value as THREE.Vector3).set(zp.x, zp.y, distort && zp.z > 0.1 ? this.zoom : 0);
    // Varmeflimmer: de fire nærmeste kildene som er på skjermen, tomme plasser sist
    const hv = u.uHeat.value as THREE.Vector4[];
    const hd = u.uHeatD.value as number[];
    let n = 0;
    if (distort && this.heat.length) {
      const camX = cam.position.x;
      const P11 = cam.projectionMatrix.elements[5];
      const list = this.heat
        .map((h) => ({ h, d: h.band ? 0 : Math.abs(h.pos.x - camX) }))
        .filter((e) => e.d < 30)
        .sort((a, b) => a.d - b.d);
      for (const { h } of list) {
        if (n >= 4) break;
        tmp.copy(h.pos);
        if (h.band) tmp.x = camX;
        const p = this.uv(tmp, cam, tmp);
        if (p.z <= 0.5 || p.x < -0.25 || p.x > 1.25 || p.y < -0.25 || p.y > 1.3) continue;
        const r = (h.r * P11) / (2 * p.z);
        const fade = h.life < 0 ? 1 : Math.min(1, h.life / Math.max(0.01, h.max * 0.5));
        const s = Math.min(1.5, h.s) * fade;
        hv[n].set(p.x, p.y, r, h.band ? -s : s);
        hd[n] = p.z;
        n++;
      }
    }
    for (let i = n; i < 4; i++) {
      hv[i].set(0, 0, 0, 0);
      hd[i] = 0;
    }
    u.uNeg.value = flashes ? Math.min(1, this.neg) * 0.45 : 0;
    u.uLyn.value = flashes ? Math.min(1, this.lyn) : 0;
    u.uHurt.value = this.hurt;
    u.uLow.value = this.low;
    u.uVeins.value = this.veins;
    u.uPulse.value = this.pulse;
    u.uBurn.value = this.burn;
    u.uFlick.value = flashes ? 1 : 0.25;
    u.uDistort.value = distort ? 1 : 0;
    const t = this.wet.texture();
    u.tWet.value = t;
    u.uWet.value = t ? 1 : 0;
    if (t) this.wet.texel(u.uWetPx.value as THREE.Vector2);
  }
}

/** Skjermeffektene for hele spillet (som vinden i wind.ts og lyden i core/audio.ts). */
export const screenFX = new ScreenFX();
