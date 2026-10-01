// Teit vold på brettene (Tom 2026-10-01, docs/GDD.md «Teit vold»). Eies av Stage og oppdateres hvert bilde:
// - Overkroppen som kryper: etter todeling legger overkroppen (med hodet og armene) seg på magen, kryper mot nærmeste
//   helt og biter ham i ankelen, med innvollene slepende etter som en kjede av kjøttbiter. Ett slag tar den, ellers
//   blør den ut etter noen sekunder.
// - Hodet som baseball: et hode som ligger på bakken etter halshugging, slås i en bue av et slag, og treffer det en
//   fiende, er det HOME RUN.
// - Kebabspyd: løpeslaget med sverd spidder opptil tre fiender. Helten går saktere med dem på sverdet, og neste slag
//   rister dem av (SHISH KEBAB!).
// - Blodregn: når en kjempe eller en sjef sprenges, regner det blod over hele bildet en stund, og en gnom tusler inn,
//   slår opp en paraply (I CAME PREPARED) og går igjen.
// - Glatte pytter: de store blodpyttene er glatte til de tørker, og fiender som løper over, går på trynet (SLIP!).
// - Ildimpene smeller i en liten ildkule når de dør og setter fyr på dem som står nær.
// Skjelettxylofonen, tennene, de siste ordene og kjøttbitene på glasset ligger i Fighter.die, applyHit og gfx/fx.ts.
import * as THREE from 'three';
import { Fighter, bloodOf } from './fighter';
import { P, type AttackDef } from './attacks';
import { applyHit } from './combat';
import { W } from './world';
import type { Hero } from './hero';
import type { Foe } from './foes';
import { makeGib } from '../gfx/gibs';
import type { Debris, BloodKind } from '../gfx/gore';
import { umbrella, holdUmbrella, keepUmbrellaUp, type Umbrella } from '../gfx/mayhemfx';
import { screenFX } from '../gfx/screenfx';
import { audio } from '../core/audio';
import { settings } from '../core/settings';
import { rand, pick, chance, clamp } from '../core/math';
import { MAYHEM_LINES as L } from '../data/quips';

/** Tallene for den teite volden. Testene kan endre dem (window.__lib.MAYHEM). */
export const MAYHEM = {
  /** Sjansen for at overkroppen kryper videre etter todeling, per gore-nivå (FAMILY, NORMAL, EXCESSIVE, PLEASE SEEK HELP). */
  crawl: [0.3, 0.4, 0.6, 0.85],
  /** Hvor lenge den kryper før den blør ut (s), farten (m/s), og hvor ofte den kan bite (s). */
  crawlLife: [6, 8] as const,
  crawlSpeed: 0.95,
  biteCd: 1.0,
  /** Kjøttbitene innvollene er laget av, og avstanden mellom dem (bitene overlapper litt, så det blir en kjede). */
  guts: { n: 9, gap: 0.13 },
  /** Hodet som slås: farten bortover og oppover (m/s). */
  bat: { vx: 11.5, vy: 7.5 },
  /** Fiender på sverdet: høyst så mange, hvor mye saktere helten går per fiende, og hvor lenge de henger der (s). */
  kebab: { max: 3, slow: 0.14, struggle: 4, slide: 6 },
  /** Blodregnet: hvor lenge (s) og hvor mange dråper i sekundet. */
  rain: { time: 6, rate: 120 },
  /** Glatte pytter: minste størrelse, hvor lenge de er glatte (s), farten som skal til (m/s), og sjansen for å skli. */
  slick: { min: 0.8, life: [10, 13] as const, speed: 2.0, odds: 0.65 },
};

/** Bittet i ankelen: lite skade og et lite rykk, ingen velt. */
const BITE: AttackDef = {
  id: 'bite', startup: 0, active: 0.1, recovery: 0, dmg: 4, reach: 1, zr: 1, height: 'low', push: 0.6, stun: 0.22,
  wind: P.hurt, strike: P.hurt, death: ['normal'], swoosh: 'none',
};
/** Hodet som treffer en fiende i full fart. */
const HOME_RUN: AttackDef = {
  id: 'homerun', startup: 0, active: 0.1, recovery: 0, dmg: 18, reach: 1, zr: 1, height: 'high', kd: true, launch: 6, push: 7, stun: 0.5,
  heavy: true, wind: P.hurt, strike: P.hurt, death: ['decap', 'headsplode', 'explode'], swoosh: 'none',
};
/** Fiendene som ristes av sverdet. */
const KEBAB_OFF: AttackDef = {
  id: 'kebab', startup: 0, active: 0.1, recovery: 0, dmg: 14, reach: 1, zr: 1, height: 'mid', kd: true, launch: 6, push: 8, stun: 0.5,
  heavy: true, wind: P.hurt, strike: P.hurt, death: ['explode', 'dismember', 'decap'], swoosh: 'none',
};
/** Helten holder sverdet rett fram med fiendene på (bladet peker fram når armF + weapon er rundt -1,6). */
const KEBAB_POSE = { armF: 1.45, weapon: -3.0, elbowF: 0.2 };
/** Gnomen holder paraplyen over hodet og ser opp. */
const UMBRELLA_POSE = { armB: 2.75, head: 0.3 };
const Z_MIN = -2.6;
const Z_MAX = 2.6;
const tmp = new THREE.Vector3();

/** Det mayhem trenger fra brettet (Stage). */
export interface MayhemWorld {
  readonly heroes: Hero[];
  readonly foes: Foe[];
  readonly nature: Fighter;
  camX: number;
  halfW: number;
  done: string;
  foeFighters(): Fighter[];
  ignite(f: Fighter, sek: number): void;
  /** Ild ved (x, z) med radius r: olje fra GREASE der tar fyr (game/spells.ts). */
  fireAt?(x: number, z: number, r: number): void;
}

/** Overkroppen som kryper. */
interface Crawler {
  owner: Fighter;
  d: Debris;
  torso: THREE.Object3D;
  col: BloodKind | 'none';
  dir: number;
  x: number;
  z: number;
  t: number;
  life: number;
  ph: number;
  biteCd: number;
  /** Hvor høyt midten av overkroppen ligger, og avstanden fra midjen til nakken (m). */
  lift: number;
  len: number;
  guts: Debris[];
  alive: boolean;
}

/** Et hode som ligger på bakken (og kan slås). */
interface LooseHead { d: Debris; by: Fighter | null; cd: number; hit: Set<number>; flying: boolean }

/** En glatt blodpytt. */
interface Slick { x: number; z: number; r: number; t: number; life: number }

/** Gnomen med paraplyen. */
interface Gnome { f: Fighter; u: Umbrella; dir: number; phase: 'in' | 'open' | 'wait' | 'close' | 'out'; t: number; goal: number }

export class Mayhem {
  crawlers: Crawler[] = [];
  heads: LooseHead[] = [];
  slicks: Slick[] = [];
  /** Sekunder blodregn igjen. */
  rainT = 0;
  gnome: Gnome | null = null;
  /** Den første overkroppen som kryper, den første gnomen og den første som sklir, sier det Tom ba om. */
  private crawled = 0;
  private gnomes = 0;
  private slips = 0;
  private wide = { minX: -1e9, maxX: 1e9, minZ: Z_MIN, maxZ: Z_MAX };

  constructor(private w: MayhemWorld) {}

  // ---------------------------------------------------------------- overkroppen som kryper
  /**
   * Etter todeling (Stage.foeDied): når overkroppen har landet, kan den begynne å krype. Bare når hodet satt på (det
   * trengs for å bite), og bare på brettene (allowHeadless).
   */
  maybeCrawl(f: Fighter) {
    const d = f.torsoDebris;
    if (!d || !f.crawlReady || !f.allowHeadless || !chance(MAYHEM.crawl[settings.gore])) return false;
    const prev = d.onRest;
    d.onRest = () => {
      prev?.();
      this.startCrawl(f, d);
    };
    return true;
  }

  private startCrawl(f: Fighter, d: Debris) {
    const o = d.obj;
    const torso = o.children[0];
    if (this.w.done || !o.parent || !torso || W.gore.overHole(o.position.x, o.position.z)) return;
    d.held = true;
    d.rest = true;
    d.life = 999;
    const col: BloodKind | 'none' = f.def.blood === 'bone' ? 'none' : bloodOf(f.def);
    const h = this.nearestHero(o.position.x, o.position.z);
    const c: Crawler = {
      owner: f, d, torso, col, dir: h ? Math.sign(h.pos.x - o.position.x) || 1 : 1, x: o.position.x, z: clamp(o.position.z, Z_MIN, Z_MAX),
      t: 0, life: rand(MAYHEM.crawlLife[0], MAYHEM.crawlLife[1]), ph: 0, biteCd: 0.6, lift: 0.25, len: Math.max(0.2, f.rig.joints.neck[1]) * f.rig.scale,
      guts: [], alive: true,
    };
    this.orient(c);
    // Innvollene: en kjede av kjøttbiter som slepes etter midjen (ikke på FAMILY, og ikke fra skjeletter)
    if (!W.gore.family && col !== 'none') {
      const waist = torso.localToWorld(tmp.set(0, 0.05, 0));
      for (let i = 0; i < MAYHEM.guts.n; i++) {
        const g = makeGib(col === 'green' ? 'green' : 'meat', rand(0.85, 1.1) * (1 - i * 0.04));
        g.mesh.position.set(waist.x - c.dir * MAYHEM.guts.gap * (i + 1), g.radius * 0.6, waist.z + rand(-0.04, 0.04));
        W.gore.group.add(g.mesh);
        c.guts.push(W.gore.addDebris(g.mesh, g.radius, 0, 0, 0, 0, { owned: false, held: true, rest: true, life: 999, bleed: 0, bleedCol: 'none' }));
      }
    }
    const line = this.crawled++ ? pick(L.crawl) : L.crawl[0];
    W.fx.text(new THREE.Vector3(c.x, 1.1, c.z), line, 'speech', 1.8);
    audio.grunt(f.def.voice);
    this.crawlers.push(c);
  }

  /**
   * Legg overkroppen på magen med hodet mot helten: dreid en kvart runde (speilet når den kryper mot venstre), midten
   * over origo i kroppsdelen og brystet så vidt i bakken.
   */
  private orient(c: Crawler) {
    const S = c.owner.rig.scale, t = c.torso, o = c.d.obj;
    o.rotation.set(0, 0, 0);
    o.position.set(c.x, 0, c.z);
    t.rotation.set(0, 0, -c.dir * Math.PI / 2);
    t.scale.set(c.dir * S, S, S);
    t.position.set(-c.dir * c.len * 0.5, 0, 0);
    o.updateMatrixWorld(true);
    const mesh = t.children.find((m) => (m as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    if (mesh) {
      const box = new THREE.Box3().setFromObject(mesh);
      c.lift = clamp(-box.min.y - 0.03, 0.08, 0.7);
    }
    o.position.y = c.lift;
  }

  private nearestHero(x: number, z: number) {
    let best: Fighter | null = null, bd = 1e9;
    for (const h of this.w.heroes) {
      const f = h.f;
      if (!f.alive) continue;
      const d = Math.abs(f.pos.x - x) + Math.abs(f.pos.z - z) * 1.5;
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  private crawl(c: Crawler, dt: number) {
    c.t += dt;
    c.biteCd -= dt;
    const h = this.nearestHero(c.x, c.z);
    // Snur seg når helten går forbi
    if (h && Math.abs(h.pos.x - c.x) > 0.6 && Math.sign(h.pos.x - c.x) !== c.dir) {
      c.dir = -c.dir;
      this.orient(c);
    }
    // Armtakene: den ene armen rekker fram og drar mens den andre svinger fram, så kroppen rykker framover
    c.ph += dt * 7.5;
    const pull = Math.abs(Math.cos(c.ph));
    const headX = c.x + c.dir * c.len * 0.75;
    if (h) {
      if (Math.abs(h.pos.x - headX) > 0.35) c.x += c.dir * MAYHEM.crawlSpeed * (0.35 + 1.1 * pull) * dt;
      c.z += clamp(h.pos.z - c.z, -1, 1) * 0.6 * dt;
    }
    c.x = clamp(c.x, this.w.camX - this.w.halfW + 0.4, this.w.camX + this.w.halfW - 0.4);
    c.z = clamp(c.z, Z_MIN, Z_MAX);
    const g = c.owner.rig.g;
    const biting = c.biteCd > MAYHEM.biteCd - 0.25;
    if (g.armF) g.armF.rotation.z = 2.55 + Math.sin(c.ph) * 0.42;
    if (g.armB) g.armB.rotation.z = 2.55 + Math.sin(c.ph + Math.PI) * 0.42;
    // Våpenet dras langs bakken i neven (bladet fram og litt ned), ikke løftet i været
    if (g.weapon && g.armF) g.weapon.rotation.z = -g.armF.rotation.z - 0.15;
    if (g.head) g.head.rotation.z = Math.PI / 2 + Math.sin(c.ph * 0.5) * 0.12 + (biting ? -0.4 : 0.1);
    const o = c.d.obj;
    o.position.set(c.x, c.lift + 0.035 * pull, c.z);
    o.rotation.z = Math.sin(c.ph) * 0.05 * c.dir;
    o.updateMatrixWorld(true);
    this.drag(c, dt);
    // Blodspor etter den
    if (c.col !== 'none' && chance(dt * 5)) W.gore.splat(c.x - c.dir * c.len * 0.4 + rand(-0.1, 0.1), c.z + rand(-0.08, 0.08), rand(0.12, 0.22), c.col);
    // Biter i ankelen når helten står ved hodet
    if (h && c.biteCd <= 0 && h.invuln <= 0 && h.pos.y < 0.4 && !h.mount && Math.abs(h.pos.x - headX) < 0.6 && Math.abs(h.pos.z - c.z) < 0.5) this.bite(c, h);
    if (c.t >= c.life) this.bleedOut(c);
  }

  /** Innvollene: hver bit følger den foran i fast avstand, som en kjede som dras over bakken. */
  private drag(c: Crawler, dt: number) {
    if (!c.guts.length) return;
    const a = c.torso.localToWorld(tmp.set(0, 0.05, 0));
    let px = a.x, pz = a.z;
    for (const g of c.guts) {
      const o = g.obj.position;
      const dx = o.x - px, dz = o.z - pz;
      const len = Math.hypot(dx, dz) || 1e-4;
      if (len > MAYHEM.guts.gap) {
        o.x = px + (dx / len) * MAYHEM.guts.gap;
        o.z = pz + (dz / len) * MAYHEM.guts.gap;
        g.obj.rotation.z += dt * 3;
      }
      o.y = g.radius * 0.6;
      px = o.x;
      pz = o.z;
    }
    const last = c.guts[c.guts.length - 1].obj.position;
    if (c.col !== 'none' && chance(dt * 3)) W.gore.splat(last.x, last.z, rand(0.08, 0.15), c.col);
  }

  private bite(c: Crawler, h: Fighter) {
    c.biteCd = MAYHEM.biteCd;
    const n = this.w.nature;
    const was = n.pos.clone();
    n.pos.set(c.x, 0, c.z);
    applyHit(n, h, BITE);
    n.pos.copy(was);
    audio.bite();
    W.fx.text(new THREE.Vector3(c.x + c.dir * c.len, 0.9, c.z), pick(L.bite), 'word', 0.8);
    if (chance(0.5)) W.gore.later(0.25, () => h.alive && W.fx.text(h.headPoint().add(new THREE.Vector3(0, 0.8, 0)), pick(L.bitten), 'speech', 1.3));
  }

  /** Et slag gjør slutt på den: kjøttbiter, blod, og overkroppen flyr avgårde. */
  private squash(c: Crawler, by: Fighter) {
    const p = c.d.obj.position.clone();
    if (c.col !== 'none') {
      W.gore.gibs(p, 5, c.col, 0.8);
      W.gore.burst(p, 40, 6, 0.1, c.col);
      W.stats.gibs += 5;
    } else W.gore.gibs(p, 4, 'bone', 0.8);
    audio.squish();
    W.fx.text(p.clone().add(new THREE.Vector3(0, 1.0, 0)), pick(L.squash), 'kill big', 1.1);
    W.fx.shake(0.3);
    this.release(c, by.facing * rand(4, 6), rand(4, 6));
  }

  /** Blør ut: hodet faller fram, armene blir liggende, og den siste replikken. */
  private bleedOut(c: Crawler) {
    const g = c.owner.rig.g;
    if (g.head) g.head.rotation.z = Math.PI / 2 - 0.55;
    if (g.armF) g.armF.rotation.z = 2.95;
    if (g.armB) g.armB.rotation.z = 2.8;
    if (g.weapon) g.weapon.rotation.z = -2.95 - 0.2;
    W.fx.text(new THREE.Vector3(c.x, 1.0, c.z), pick(L.bledOut), 'speech', 1.6);
    this.release(c);
  }

  /** Overkroppen og innvollene blir vanlige kroppsdeler igjen (Gore rydder dem). Med fart flyr de avgårde. */
  private release(c: Crawler, vx = 0, vy = 0) {
    c.alive = false;
    const d = c.d;
    d.held = false;
    d.life = rand(6, 9);
    if (vx || vy) W.gore.kick(d, vx, vy, rand(-12, 12));
    else d.rest = true;
    for (const g of c.guts) {
      g.held = false;
      g.life = rand(5, 8);
      if (vx || vy) W.gore.kick(g, vx * rand(0.3, 0.8), vy * rand(0.5, 1), rand(-10, 10));
      else g.rest = true;
    }
  }

  // ---------------------------------------------------------------- hodet som baseball
  /** Et hode som ble liggende igjen etter halshugging (ikke det som fløy i skjermen). */
  addHead(d: Debris | null) {
    if (!d || d.held || this.heads.some((h) => h.d === d)) return;
    this.heads.push({ d, by: null, cd: 0, hit: new Set(), flying: false });
  }

  /** Slå hodet avgårde i en bue, siktet mot den nærmeste fienden foran helten. */
  private bat(hd: LooseHead, f: Fighter) {
    const d = hd.d, o = d.obj.position;
    const vx = f.facing * MAYHEM.bat.vx, vy = MAYHEM.bat.vy;
    let aim: Fighter | null = null, bd = 12;
    for (const t of this.w.foeFighters()) {
      const dx = (t.pos.x - o.x) * f.facing;
      if (!t.alive || t.hidden || dx < 0.4 || dx > bd) continue;
      bd = dx;
      aim = t;
    }
    W.gore.kick(d, vx, vy, rand(-22, 22));
    if (aim) d.vel.z = clamp((aim.pos.z - o.z) / Math.max(0.25, Math.abs(aim.pos.x - o.x) / Math.abs(vx)), -4, 4);
    d.bouncy = 0.45;
    d.maxBounces = 3;
    d.life = Math.max(d.life, 6);
    if (d.bleedCol !== 'none') d.bleed = Math.max(d.bleed, 0.4);
    hd.by = f;
    hd.cd = 0.35;
    hd.flying = true;
    hd.hit.clear();
    audio.bat();
    W.fx.text(o.clone().add(new THREE.Vector3(0, 0.7, 0)), pick(L.batted), 'word', 0.8);
  }

  private homeRun(hd: LooseHead, t: Fighter) {
    hd.hit.add(t.id);
    const d = hd.d;
    applyHit(hd.by ?? this.w.nature, t, HOME_RUN);
    W.fx.text(t.headPoint().add(new THREE.Vector3(0, 1.1, 0)), L.homeRun[0], 'kill big', 1.4);
    audio.crowd(1.3);
    W.fx.shake(0.35);
    d.vel.x *= -0.35;
    d.vel.y = Math.max(3.5, d.vel.y);
  }

  private updateHeads(dt: number, swings: Fighter[]) {
    for (const hd of this.heads) {
      hd.cd -= dt;
      const d = hd.d, o = d.obj.position;
      if (!d.obj.parent || d.held) continue;
      if (hd.cd <= 0 && d.life > 1.5 && o.y < 1.5) {
        for (const f of swings) {
          const a = f.atk!;
          const dx = (o.x - f.pos.x) * f.facing;
          if (dx > -0.4 && dx < a.reach + 0.35 && Math.abs(o.z - f.pos.z) < 0.95) {
            this.bat(hd, f);
            break;
          }
        }
      }
      if (!hd.flying) continue;
      if (d.rest) {
        hd.flying = false;
        continue;
      }
      for (const t of this.w.foeFighters()) {
        if (!t.alive || hd.hit.has(t.id) || t.illusion || t.hidden || t.rising) continue;
        if (Math.abs(t.pos.x - o.x) < 0.45 * t.size + 0.25 && Math.abs(t.pos.z - o.z) < 0.6 && o.y > 0.15 && o.y < 2.3 * t.size) this.homeRun(hd, t);
      }
    }
    this.heads = this.heads.filter((hd) => hd.d.obj.parent && !hd.d.held && hd.d.life > 0);
  }

  // ---------------------------------------------------------------- kebab
  /** Løpeslaget med sverd traff t (Stage.onFoeHit): spidd ham på bladet, høyst MAYHEM.kebab.max. */
  dashHit(h: Hero, t: Fighter) {
    const f = h.f;
    if (!f.atk?.id.startsWith('dash') || !h.weapon.id.startsWith('sword') || h.kebab.length >= MAYHEM.kebab.max || t.skewer) return false;
    const foe = this.w.foes.find((o) => o.f === t);
    if (!foe || foe.def.poise || t.size > 1.3 || t.mount || t.hidden || t.rising || t.illusion || foe.ambushing || (t.state === 'held' && t.heldBy)) return false;
    if (!t.alive && ['explode', 'shatter', 'bisect', 'legsoff'].includes(t.deathStyle)) return false;
    t.skewer = { by: f, slot: h.kebab.length, t: 0, belly: Math.max(0.15, t.torsoPoint(0.3).y - t.pos.y) };
    h.kebab.push(t);
    t.atk = null;
    t.vel.set(0, 0, 0);
    if (t.alive) t.setState('held');
    f.poseMod = KEBAB_POSE;
    audio.impale();
    const p = t.torsoPoint(0.3);
    if (t.def.blood !== 'bone') W.gore.spray(p, f.facing, 0.2, 24, 5, 0.5, 0.09, bloodOf(t.def));
    // Ordet står over helten og stiger ett hakk for hver ny på sverdet, så de ikke legger seg oppå hverandre
    const n = h.kebab.length;
    const word = n === 1 ? pick(L.skewered) : 'KEBAB x' + n;
    W.fx.text(f.headPoint().add(new THREE.Vector3(f.facing * 0.6, 0.9 + (n - 1) * 0.55, 0)), word, 'word', 1.0);
    return true;
  }

  private kebabTick(h: Hero) {
    const f = h.f;
    if (!h.kebab.length) return;
    // Sprengt eller borte mens han hang der, eller en annen helt (ny kropp etter gjenoppstandelse)
    for (const t of h.kebab) {
      if (t.skewer?.by !== f || t.removeMe || (!t.alive && (t.deathStyle === 'explode' || t.deathStyle === 'shatter'))) this.unskewer(h, t, 'drop');
    }
    if (!f.alive || f.mount || ['hurt', 'down', 'dead', 'held', 'magic', 'roll', 'stunned'].includes(f.state)) {
      for (const t of [...h.kebab]) this.unskewer(h, t, 'drop');
    } else if (f.state === 'attack' && f.atk && !f.atk.id.startsWith('dash') && f.phase() === 'active') {
      this.shakeKebab(h);
    } else {
      // De levende vrir seg løs etter en stund, likene sklir av
      for (const t of [...h.kebab]) if (t.skewer!.t > (t.alive ? MAYHEM.kebab.struggle : MAYHEM.kebab.slide)) this.unskewer(h, t, 'drop');
    }
    h.kebab.forEach((t, i) => (t.skewer!.slot = i));
    if (!h.kebab.length) f.poseMod = null;
  }

  /** Neste slag rister dem av: alle flyr fram, de levende tar skade og slås over ende. SHISH KEBAB! */
  private shakeKebab(h: Hero) {
    const n = h.kebab.length;
    for (const t of [...h.kebab]) this.unskewer(h, t, 'shake');
    W.fx.text(h.f.headPoint().add(new THREE.Vector3(0, 1.0, 0)), L.kebab[0], 'kill big', 1.4);
    if (n > 1) W.fx.text(h.f.headPoint().add(new THREE.Vector3(0.9 * h.f.facing, 0.4, 0)), 'x' + n, 'word', 1.2);
    audio.rip();
    W.fx.shake(0.35);
  }

  private unskewer(h: Hero, t: Fighter, how: 'shake' | 'drop') {
    const i = h.kebab.indexOf(t);
    if (i >= 0) h.kebab.splice(i, 1);
    t.skewer = null;
    const dir = h.f.facing;
    if (how === 'shake') {
      if (t.alive) {
        t.setState('idle');
        applyHit(h.f, t, KEBAB_OFF);
      } else {
        t.vel.set(dir * rand(6, 9), rand(5, 7), rand(-1, 1));
        t.onGround = false;
      }
      if (t.def.blood !== 'bone') W.gore.spray(t.torsoPoint(0.3), dir, 0.3, 20, 6, 0.6, 0.1, bloodOf(t.def));
    } else if (t.alive) {
      t.setState('idle');
      t.knockdown(dir * 1.5, 3);
    } else {
      t.vel.set(dir, 1, 0);
      t.onGround = false;
    }
    if (!h.kebab.length) h.f.poseMod = null;
  }

  // ---------------------------------------------------------------- glatte pytter
  /** Gore.onPool: de store pyttene blir glatte en stund (de små under kjøttbiter er ikke store nok). */
  addSlick(x: number, z: number, size: number, kind: BloodKind) {
    if (kind === 'lava' || size < MAYHEM.slick.min) return;
    this.slicks.push({ x, z, r: size * 0.55, t: 0, life: rand(MAYHEM.slick.life[0], MAYHEM.slick.life[1]) });
  }

  private updateSlicks(dt: number) {
    for (const s of this.slicks) s.t += dt;
    this.slicks = this.slicks.filter((s) => s.t < s.life);
    if (!this.slicks.length) return;
    for (const fo of this.w.foes) {
      const f = fo.f;
      if (!f.alive || !f.onGround || f.skewer || f.mount || fo.def.poise || (f.state !== 'walk' && f.state !== 'flee')) continue;
      if (Math.hypot(f.vel.x, f.vel.z) < MAYHEM.slick.speed || ((f.data.slipT as number) ?? -1) > W.time) continue;
      for (const s of this.slicks) {
        // Pytten er glatt når den har vokst litt, og blir glattere jo større den er
        if (s.t < 1) continue;
        const r = s.r * Math.min(1, 0.3 + s.t / 2.8);
        const ex = (f.pos.x - s.x) / r, ez = (f.pos.z - s.z) / (r * 0.75);
        if (ex * ex + ez * ez > 1) continue;
        f.data.slipT = W.time + 3;
        if (chance(MAYHEM.slick.odds)) this.slip(fo);
        break;
      }
    }
  }

  /** Beina går under ham i pytten, og han går på trynet. */
  private slip(fo: Foe) {
    const f = fo.f;
    const dir = Math.sign(f.vel.x) || f.facing;
    f.knockdown(dir * 2.4, 5.5);
    audio.slip();
    if (f.def.blood !== 'bone') W.gore.splat(f.pos.x + dir * 0.3, f.pos.z, rand(0.3, 0.5), bloodOf(f.def));
    W.fx.text(f.headPoint().add(new THREE.Vector3(0, 0.8, 0)), this.slips++ && chance(0.3) ? pick(L.slip) : L.slip[0], 'word', 0.9);
  }

  // ---------------------------------------------------------------- blodregn og gnomen med paraplyen
  /** En kjempe eller en sjef er sprengt: det regner blod over hele bildet en stund, og gnomen kommer med paraplyen. */
  bloodRain() {
    const first = this.rainT <= 0;
    this.rainT = MAYHEM.rain.time;
    screenFX.wet.bloodRain = 1;
    if (first) audio.drizzle(MAYHEM.rain.time);
    if (!this.gnome) this.spawnGnome();
  }

  private updateRain(dt: number) {
    if (this.rainT <= 0) return;
    this.rainT -= dt;
    if (this.rainT <= 0) {
      screenFX.wet.bloodRain = 0;
      return;
    }
    // Dråpene faller fra over bildet og legger flekker over hele brettet
    const n = W.gore.n(MAYHEM.rain.rate * dt * Math.min(1, this.rainT));
    for (let i = 0; i < n; i++) {
      const x = this.w.camX + rand(-this.w.halfW - 2, this.w.halfW + 2);
      W.gore.drop(x, rand(6.5, 8.5), rand(-4.2, 2.8), rand(-0.4, 0.4), -rand(7, 10), 0, rand(0.05, 0.1), 'red', 2.6, 0.4);
    }
  }

  private spawnGnome() {
    const dir = chance(0.5) ? 1 : -1;
    const f = new Fighter('gnome', 'enemy', { hp: 30, speed: 2.8 });
    f.pos.set(this.w.camX - dir * (this.w.halfW + 0.8), 0, rand(1.3, 2.1));
    f.face(dir);
    f.addTo(W.scene);
    const u = umbrella();
    holdUmbrella(f.rig, u);
    this.gnome = { f, u, dir, phase: 'in', t: 0, goal: this.w.camX - dir * (this.w.halfW - rand(2.2, 3.2)) };
  }

  /** Gnomen tusler inn, slår opp paraplyen, står til det slutter å regne, slår den ned og går tilbake. */
  private updateGnome(dt: number) {
    const g = this.gnome!, f = g.f;
    g.t += dt;
    f.wantVX = f.wantVZ = 0;
    switch (g.phase) {
      case 'in':
        f.face(g.dir);
        f.wantVX = g.dir * 2.8;
        if ((f.pos.x - g.goal) * g.dir >= 0) {
          g.phase = 'open';
          g.t = 0;
          f.poseMod = UMBRELLA_POSE;
          audio.whump();
          W.fx.text(f.headPoint().add(new THREE.Vector3(0, 1.6, 0)), this.gnomes++ && chance(0.25) ? pick(L.umbrella) : L.umbrella[0], 'speech', 2.4);
        }
        break;
      case 'open':
        g.u.open(g.t / 0.35);
        if (g.t > 0.35) {
          g.phase = 'wait';
          g.t = 0;
        }
        break;
      case 'wait':
        if (this.rainT <= 0 && g.t > 1.6) {
          g.phase = 'close';
          g.t = 0;
        }
        break;
      case 'close':
        g.u.open(1 - g.t / 0.3);
        if (g.t > 0.45) {
          g.phase = 'out';
          g.t = 0;
          f.poseMod = null;
        }
        break;
      case 'out':
        f.face(-g.dir);
        f.wantVX = -g.dir * 2.8;
        break;
    }
    keepUmbrellaUp(f.rig, g.u);
    f.update(dt, this.wide);
    if (g.phase === 'out' && Math.abs(f.pos.x - this.w.camX) > this.w.halfW + 1.5) this.removeGnome();
  }

  private removeGnome() {
    const g = this.gnome;
    if (!g) return;
    g.u.dispose();
    g.f.remove();
    this.gnome = null;
  }

  // ---------------------------------------------------------------- ildimpene
  /** En ildimp (FoeDef.burst) smeller i en liten ildkule: alle innen r tar fyr, fiender og helter. */
  impBurst(f: Fighter, b: { r: number; burn: number }) {
    const p = f.torsoPoint();
    W.gore.vfx.explode(p, 0.75);
    W.gore.fire(p, 26, 0.5, 3.5);
    audio.boom(0.6);
    W.fx.shake(0.35);
    W.fx.text(p.clone().add(new THREE.Vector3(0, 1.0, 0)), pick(L.impBurst), 'kill big', 1.0);
    const all = [...this.w.heroes.map((h) => h.f), ...this.w.foes.map((o) => o.f)];
    let n = 0;
    for (const o of all) {
      if (o === f || !o.alive || Math.abs(o.pos.x - p.x) > b.r || Math.abs(o.pos.z - f.pos.z) > b.r * 0.6) continue;
      this.w.ignite(o, o.team === 'hero' ? Math.min(2, b.burn) : b.burn);
      n++;
    }
    // Olje i nærheten tar fyr
    this.w.fireAt?.(f.pos.x, f.pos.z, b.r * 0.6);
    return n;
  }

  // ---------------------------------------------------------------- per bilde
  update(dt: number) {
    // Heltene som slår akkurat nå (treffer krypende overkropper og hoder på bakken)
    const swings = this.w.heroes.map((h) => h.f).filter((f) => f.alive && f.state === 'attack' && f.phase() === 'active' && !!f.atk && !f.atk.projectile);
    for (const c of this.crawlers) {
      if (!c.alive) continue;
      if (!c.d.obj.parent) {
        c.alive = false;
        continue;
      }
      const by = swings.find((f) => {
        const dx = (c.x - f.pos.x) * f.facing;
        return dx > -0.5 && dx < f.atk!.reach + 0.5 && Math.abs(c.z - f.pos.z) < f.atk!.zr + 0.25;
      });
      if (by) this.squash(c, by);
      else this.crawl(c, dt);
    }
    this.crawlers = this.crawlers.filter((c) => c.alive);
    this.updateHeads(dt, swings);
    for (const h of this.w.heroes) this.kebabTick(h);
    this.updateSlicks(dt);
    this.updateRain(dt);
    if (this.gnome) this.updateGnome(dt);
  }

  dispose() {
    this.removeGnome();
    screenFX.wet.bloodRain = 0;
    for (const h of this.w.heroes) for (const t of [...h.kebab]) this.unskewer(h, t, 'drop');
  }
}

/** Hvor mye saktere en helt går med n fiender på sverdet (Hero.update). */
export function kebabSlow(n: number) {
  return Math.max(0.4, 1 - MAYHEM.kebab.slow * n);
}

