// Blod og vann på glasset foran kameraet. Portet fra Morbidium (Toms eget spill, src/43_vaatt.js) og skrevet om
// til en TypeScript-modul uten globale kroker:
// - Dråpene klistrer seg fast til de blir tunge nok. Da sklir de nedover i rykk og napp, følger ripene i glasset
//   (et støyfelt som er likt for alle dråper), og slår seg sammen med dråpene de møter.
// - Sporet tar litt av dråpen for hver piksel den renner, så den blir mindre og stanser etter et stykke. Hvert punkt
//   i sporet har egen bredde og alder: sporet smalner mot dråpen, toppen tørker først, og det gamle sporet trekker
//   seg sammen til en rad små perler.
// - Blod er seigt: det sklir sakte, legger igjen tykke og mørke spor og blir lenge. Vann renner fort og tørker.
// - Hver dråpe tegnes som en liten kuppel i et høydekart (rødt er vann, grønt er blod). Etterbehandlingen i post.ts
//   bryter bildet gjennom kuplene, farger gjennom blodet og legger på høylys og mørk kant.
// Simuleringen går i update(dt) også når spillet ikke tegnes (Playwright-testene), og lerretet tegnes og lastes
// opp bare når bildet faktisk vises (draw()).
import * as THREE from 'three';

interface Trail {
  /** x, y, bredde og tid for hvert punkt (flatt, fire tall per punkt). */
  p: number[];
  blood: boolean;
  id: number;
}

interface Drop {
  x: number;
  y: number;
  r: number;
  blood: boolean;
  vx: number;
  vy: number;
  /** Egen slingring sidelengs. */
  vj: number;
  sliding: boolean;
  t: number;
  trail: Trail | null;
  /** Høyden der dråpen sist la igjen en liten dråpe. */
  py: number;
  /** Tid før en ny dråpe kan begynne å skli (så en klatt ikke renner i det øyeblikket den treffer). */
  fresh: number;
  /** Frø for dråpens egen rytme. */
  sd: number;
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Flest dråper samtidig. Kommer det flere, forsvinner de minste. */
const MAX = 110;
/** Den lengste siden av høydekartet i piksler. */
const LONG = 384;
/** Høyst så mange bloddråper renner samtidig, resten blir hengende. */
const MAX_BLOOD_SLIDING = 6;

export class ScreenWet {
  drops: Drop[] = [];
  trails: Trail[] = [];
  W = 0;
  H = 0;
  /** Skjermens bredde delt på høyden. Settes av ScreenFX.resize. */
  aspect = 16 / 9;
  /** Kan det komme noe på glasset (etterbehandlingen er på, ikke LOW). Settes av ScreenFX. */
  enabled = false;
  /** Kan det komme blod (gore-nivået er ikke FAMILY). Settes av ScreenFX. */
  bloodAllowed = true;
  /** Mengdefaktor for blod (gore-nivå). */
  bloodMul = 1;
  /** Regn på brettet, 0..1 (0 = tørt). Ingen brett har regn ennå, men miljøet kan sette det (Env.rain). */
  rain = 0;
  /** Tall for testene. */
  stats = { blood: 0, water: 0, slid: 0, merged: 0, uploads: 0 };
  private clock = 0;
  private seed = Math.random() * 1000;
  private rainT = 0;
  private cv: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private tex: THREE.CanvasTexture | null = null;
  private spr: { water: HTMLCanvasElement; blood: HTMLCanvasElement } | null = null;
  private odd = false;
  private dirty = false;
  private shown = false;

  /** Er det noe på glasset nå? */
  get wet() {
    return this.drops.length > 0 || this.trails.length > 0;
  }

  /** Skala for dråpestørrelse og fart: den korteste siden, så dråpene er like store på stående telefon som på PC. */
  private kk() {
    return Math.min(this.W, this.H) / 135;
  }

  // ---------------------------------------------------------------- støy
  private hs(n: number) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  /** Glatt støy i 0..1 langs én akse. */
  private st1(x: number) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return this.hs(i) * (1 - u) + this.hs(i + 1) * u;
  }
  /** Ripene i glasset: et felt i -1..1 som er likt for alle dråpene. */
  private flow(x: number, y: number) {
    const i = Math.floor(x), j = Math.floor(y), ux = x - i, uy = y - j;
    const sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
    const h = (a: number, b: number) => this.hs(a * 57.3 + b * 113.9 + this.seed);
    return ((h(i, j) * (1 - sx) + h(i + 1, j) * sx) * (1 - sy) + (h(i, j + 1) * (1 - sx) + h(i + 1, j + 1) * sx) * sy) * 2 - 1;
  }

  // ---------------------------------------------------------------- oppsett
  /** Høydekartet følger skjermens form. Lages først når noe treffer glasset. */
  private ensure() {
    const a = this.aspect || 16 / 9;
    const W = a >= 1 ? LONG : Math.max(160, Math.round(LONG * a));
    const H = a >= 1 ? Math.max(160, Math.round(LONG / a)) : LONG;
    if (this.cv && W === this.W && H === this.H) return;
    if (this.W && this.H) {
      const sx = W / this.W, sy = H / this.H;
      const sk = Math.min(W, H) / Math.min(this.W, this.H);
      for (const d of this.drops) {
        d.x *= sx;
        d.y *= sy;
        d.py *= sy;
        d.r *= sk;
        d.vx *= sx;
        d.vj *= sx;
        d.vy *= sy;
      }
      // Behold også sporet til en dråpe som renner. Å slette det lot sliding være true
      // med trail=null, og neste physics() krasjet når telefonen ble snudd.
      const trails = new Set(this.trails);
      for (const d of this.drops) if (d.trail) trails.add(d.trail);
      for (const trail of trails) {
        for (let i = 0; i < trail.p.length; i += 4) {
          trail.p[i] *= sx;
          trail.p[i + 1] *= sy;
          trail.p[i + 2] *= sk;
        }
      }
    }
    this.W = W;
    this.H = H;
    if (!this.cv) {
      this.cv = document.createElement('canvas');
      this.spr = { water: this.dome(0), blood: this.dome(1) };
    }
    this.cv.width = W;
    this.cv.height = H;
    this.g = this.cv.getContext('2d');
    this.tex?.dispose();
    const t = new THREE.CanvasTexture(this.cv);
    t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    // Data, ikke farge: ingen sRGB-omregning
    t.colorSpace = THREE.NoColorSpace;
    this.tex = t;
    this.dirty = true;
  }

  /** En kuppel i én fargekanal: høyden er (1 - r²)^0.55, litt flatere på toppen, som en dråpe på glass. */
  private dome(channel: number) {
    const n = 48;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d')!;
    const id = g.createImageData(n, n);
    const d = id.data;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = ((x + 0.5) / n) * 2 - 1, dy = ((y + 0.5) / n) * 2 - 1, r2 = dx * dx + dy * dy, i = (y * n + x) * 4;
        if (r2 >= 1) continue;
        d[i + channel] = Math.round(255 * Math.pow(1 - r2, 0.55));
        d[i + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- nye dråper
  private add(x: number, y: number, r: number, blood: boolean, vy = 0) {
    if (this.drops.length >= MAX) {
      let mi = 0;
      for (let i = 1; i < this.drops.length; i++) if (this.drops[i].r < this.drops[mi].r) mi = i;
      this.drops.splice(mi, 1);
    }
    const d: Drop = { x, y, r, blood, vx: 0, vy, vj: 0, sliding: false, t: 0, trail: null, py: y, fresh: 0.12, sd: 0 };
    this.drops.push(d);
    return d;
  }

  private ok(blood: boolean) {
    return this.enabled && (!blood || this.bloodAllowed);
  }

  /** Sprut: en klatt og dråper rundt, størst nær midten. x0 og y0 er 0..1 over skjermen (y0 = 0 er øverst). */
  splash(x0: number, y0: number, n: number, blood: boolean, s = 1) {
    if (!this.ok(blood) || n <= 0) return;
    this.ensure();
    const cx = x0 * this.W, cy = y0 * this.H, k = this.kk();
    if (blood) this.stats.blood++;
    else this.stats.water++;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, u = Math.pow(Math.random(), 1.6), d = u * (10 + 26 * s) * k;
      const r = (blood ? 1.1 : 1.2) * k * (1 + (1 - u) * (2.6 * s) * Math.random() + (Math.random() < 0.12 ? 1.5 * s : 0));
      this.add(cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d, r, blood);
    }
  }

  /**
   * En helt er truffet: blod fra siden slaget kom fra (side -1 venstre, 1 høyre), mer jo hardere.
   * power er omtrent skade delt på maks helse ganger tre (0.35 til 1.6).
   */
  hit(power: number, side: number) {
    if (!this.ok(true)) return;
    this.ensure();
    const m = this.bloodMul;
    power *= Math.sqrt(m);
    const x = side < 0 ? 0.06 + Math.random() * 0.3 : 0.64 + Math.random() * 0.3, y = 0.12 + Math.random() * 0.6;
    this.splash(x, y, Math.round((4 + power * 8) * m), true, 0.6 + power * 0.45);
    // Noen store som blir tunge nok til å renne med en gang
    const k = this.kk();
    if (power > 0.7) {
      for (let i = 0, n = Math.round(power * 1.5); i < n; i++) {
        this.add(clamp(x + (Math.random() - 0.5) * 0.3, 0.03, 0.97) * this.W, clamp(y + (Math.random() - 0.5) * 0.4, 0.1, 0.9) * this.H, (3.2 + Math.random() * 2 * power) * k, true);
      }
    }
    // Tunge treff: noe havner høyt oppe, men ikke helt i kanten
    if (power > 1.2) this.splash(side < 0 ? 0.5 - Math.random() * 0.4 : 0.5 + Math.random() * 0.4, 0.15 + Math.random() * 0.2, Math.round(5 * m), true, 0.8);
  }

  /** Noe døde (eller eksploderte) på et punkt i bildet: sprut rundt det. amount 0..2. */
  near(x0: number, y0: number, amount = 1) {
    if (!this.ok(true)) return;
    const m = this.bloodMul;
    this.splash(clamp(x0 + (Math.random() - 0.5) * 0.3, 0.05, 0.95), clamp(y0 + (Math.random() - 0.5) * 0.3, 0.08, 0.9), Math.round((3 + 7 * amount) * m), true, 0.5 + 0.4 * amount);
  }

  /** Store øyeblikk (helten dør, sjefen dør, hodet i skjermen): klatter spredt over hele glasset. */
  drench(n: number) {
    if (!this.ok(true)) return;
    const m = this.bloodMul;
    const blobs = Math.max(1, Math.round(n * 0.5 * m));
    for (let i = 0; i < blobs; i++) this.splash(0.08 + Math.random() * 0.84, 0.08 + Math.random() * 0.6, Math.round(5 + Math.random() * 5), true, 0.9 + Math.random() * 0.5);
  }

  /** Vann nedenfra (myr, råk, plask). */
  plash(amount = 0.3) {
    this.splash(0.2 + Math.random() * 0.6, 0.78 + Math.random() * 0.16, Math.round(3 + amount * 14), false, 0.5 + amount);
  }

  /** Blodet forsvinner med en gang (gore-nivået ble FAMILY). Vannet blir. */
  clearBlood() {
    this.drops = this.drops.filter((d) => !d.blood);
    this.trails = this.trails.filter((t) => !t.blood);
    this.dirty = true;
  }

  clear() {
    this.drops = [];
    this.trails = [];
    this.seed = Math.random() * 1000;
    this.dirty = true;
  }

  // ---------------------------------------------------------------- per bilde
  update(dt: number) {
    if (!this.enabled) {
      if (this.wet) this.clear();
      return;
    }
    if (!this.bloodAllowed && (this.drops.some((d) => d.blood) || this.trails.some((t) => t.blood))) this.clearBlood();
    this.rainTick(dt);
    if (!this.wet || dt <= 0) return;
    this.ensure();
    this.physics(Math.min(dt, 0.05));
    this.dirty = true;
  }

  /** Regn: små dråper som treffer og samler seg (bare når miljøet har regn). */
  private rainTick(dt: number) {
    if (this.rain <= 0 || dt <= 0) return;
    this.rainT -= dt;
    if (this.rainT > 0) return;
    this.rainT = (0.08 + Math.random() * 0.2) / Math.max(0.2, this.rain);
    this.ensure();
    const k = this.kk();
    this.add(Math.random() * this.W, Math.random() * this.H * 0.95, (1 + Math.random() * 1.6) * k, false);
    this.stats.water++;
  }

  private physics(dt: number) {
    const D = this.drops, k = this.kk(), T = (this.clock += dt);
    let bloodSliding = 0;
    for (const d of D) if (d.sliding && d.blood) bloodSliding++;
    for (const d of D) {
      d.t += dt;
      if (d.fresh > 0) d.fresh -= dt;
      const limit = (d.blood ? 3.0 : 2.3) * k, bw = d.blood ? 0.42 : 0.35, wm = (d.blood ? 2.4 : 1.6) * k;
      if (!d.sliding && d.r > limit && d.fresh <= 0 && !(d.blood && bloodSliding >= MAX_BLOOD_SLIDING)) {
        d.sliding = true;
        d.vx = 0;
        d.vj = 0;
        d.sd = Math.random() * 97;
        if (d.blood) bloodSliding++;
        d.trail = { p: [d.x, d.y, Math.min(d.r * bw, wm), T], blood: d.blood, id: Math.random() * 97 };
        this.trails.push(d.trail);
        this.stats.slid++;
      }
      if (d.sliding) {
        // Fart etter vekt: vannet renner, blodet siger, og begge i rykk og napp (glasset er ikke like glatt overalt)
        const goal = (d.blood ? Math.min(40, 6 + 9 * (d.r / k - 2.6)) : Math.min(115, 20 + 30 * (d.r / k - 2.0))) * (0.35 + 0.65 * this.st1((d.y / k) * 0.12 + d.sd));
        d.vy += (goal * k - d.vy) * Math.min(1, dt * (d.blood ? 2.5 : 6));
        // Til sidene: ripene i glasset, dråpens egen slingring og litt skjelving
        const lean = this.flow((d.x / k) * 0.035, (d.y / k) * 0.035) * 0.3 + (this.st1((d.y / k) * 0.09 + d.sd + 31) - 0.5) * 0.8;
        d.vj += ((Math.random() - 0.5) * (d.blood ? 16 : 48) * k - d.vj * 3) * dt;
        d.vx = d.vy * lean + d.vj;
        const y0 = d.y;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        // Sporet tar med seg litt av dråpen for hver piksel den renner
        d.r = Math.sqrt(Math.max(0, d.r * d.r - 0.2 * d.r * bw * Math.max(0, d.y - y0)));
        const P = d.trail!.p;
        if (d.y - P[P.length - 3] > 1.6 * k) P.push(d.x, d.y, Math.min(d.r * bw, wm), T);
        if (d.y - d.py > (d.blood ? 9 : 6) * k) {
          d.py = d.y;
          // Av og til blir en liten dråpe hengende igjen i sporet
          if (Math.random() < (d.blood ? 0.25 : 0.4)) {
            const r0 = d.r * (0.28 + Math.random() * 0.14);
            d.r = Math.sqrt(Math.max(0, d.r * d.r - r0 * r0));
            const b = this.add(d.x - d.vx * 0.02, d.y - d.r * 1.2, r0, d.blood);
            b.fresh = 0.6;
          }
        }
        if (d.r < limit * 0.8) {
          d.sliding = false;
          d.vy = 0;
          d.vx = 0;
          if (d.blood) bloodSliding--;
        }
      } else {
        // Tørker: vannet på noen sekunder, blodet blir hengende en stund og forsvinner så
        d.r -= dt * (d.blood ? (d.t > 8 ? 0.3 : 0.03) : d.t > 5 ? 0.3 : 0.1) * k;
      }
    }
    // Dråper som møtes, blir én (den største tar over)
    for (let i = 0; i < D.length; i++) {
      const a = D[i];
      if (a.r <= 0) continue;
      for (let j = i + 1; j < D.length; j++) {
        const b = D[j];
        if (b.r <= 0) continue;
        const dx = a.x - b.x, dy = a.y - b.y, rr = (a.r + b.r) * 0.78;
        if (dx * dx + dy * dy > rr * rr) continue;
        const [s, l] = a.r >= b.r ? [a, b] : [b, a];
        const A = s.r * s.r, B = l.r * l.r;
        s.x = (s.x * A + l.x * B) / (A + B);
        s.y = Math.max(s.y, (s.y * A + l.y * B) / (A + B));
        s.r = Math.min(Math.sqrt(A + B), (s.blood ? 6.5 : 5) * k);
        s.blood = s.blood || (l.blood && B > A * 0.5);
        l.r = 0;
        this.stats.merged++;
      }
    }
    this.drops = D.filter((d) => d.r > 0.45 * k && d.y - d.r < this.H);
    // Et spor er borte når også det nyeste punktet er gammelt (blod 8 s, vann 3,5 s)
    this.trails = this.trails.filter((s) => (this.bloodAllowed || !s.blood) && T - s.p[s.p.length - 1] < (s.blood ? 8 : 3.5));
  }

  /**
   * Teksturen til etterbehandlingen, eller null når glasset er tørt. Tegner lerretet og laster det opp når noe
   * har endret seg; når ingenting renner og sporene bare blekner, skjer det bare annethvert bilde.
   */
  texture(): THREE.CanvasTexture | null {
    if (!this.enabled || !this.wet) {
      this.shown = false;
      return null;
    }
    if (!this.tex) return null;
    this.odd = !this.odd;
    const moving = this.drops.some((d) => d.sliding);
    if (this.dirty && (this.odd || moving || !this.shown)) {
      this.draw();
      this.tex.needsUpdate = true;
      this.dirty = false;
      this.stats.uploads++;
    }
    this.shown = true;
    return this.tex;
  }

  /** Ett tekselsteg i høydekartet (for normalen i etterbehandlingen). */
  texel(out: THREE.Vector2) {
    return out.set(1 / Math.max(1, this.W), 1 / Math.max(1, this.H));
  }

  private draw() {
    const g = this.g;
    if (!g || !this.spr) return;
    const W = this.W, H = this.H, T = this.clock, pearls: number[] = [];
    // Svart og helt dekkende bunn, så svakere strøk og perler faktisk blir svakere når lerretet lastes opp
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    // Sporene: hver bit som et bredt, svakt strøk og en smal kjerne, så sporet får en rund rygg som lyset glinser i.
    // «lighten» tar det høyeste, så leddene og sporene som krysser hverandre ikke blir dobbelt så tykke
    g.globalCompositeOperation = 'lighten';
    g.lineCap = 'round';
    for (const s of this.trails) {
      const P = s.p, life = s.blood ? 8 : 3.5, b = s.blood ? 0.42 : 0.45, p0 = s.blood ? 2 : 1, p1 = s.blood ? 3 : 1.8;
      for (let i = 4; i < P.length; i += 4) {
        const age = T - P[i + 3], l = clamp(1 - age / life, 0, 1);
        if (l <= 0.02) continue;
        const w = Math.max(0.8, ((P[i - 2] + P[i + 2]) / 2) * (0.6 + 0.4 * l)), f = clamp((age - p0) / (p1 - p0), 0, 1), a = l * b * (1 - f);
        if (a > 0.01) {
          for (const [ww, aa] of [[w, 0.5 * a], [w * 0.45, a]]) {
            const c = Math.round(255 * aa);
            g.strokeStyle = s.blood ? `rgb(0,${c},0)` : `rgb(${c},0,0)`;
            g.lineWidth = Math.max(0.7, ww);
            g.beginPath();
            g.moveTo(P[i - 4], P[i - 3]);
            g.lineTo(P[i], P[i + 1]);
            g.stroke();
          }
        }
        // Det gamle sporet trekker seg sammen til små perler, på faste steder langs sporet så de ikke flimrer
        if (f > 0) {
          const dx = P[i] - P[i - 4], dy = P[i + 1] - P[i - 3];
          const h1 = this.hs(i * 7.31 + s.id), h2 = this.hs(i * 3.17 + s.id + 5), h3 = this.hs(i * 1.93 + s.id + 11);
          if (h1 < Math.hypot(dx, dy) / (2.5 * w)) pearls.push(s.blood ? 1 : 0, P[i - 4] + dx * h3, P[i - 3] + dy * h3, w * (0.45 + 0.35 * h2), f * l * 0.85);
        }
      }
    }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pearls.length; i += 5) {
      const r = pearls[i + 3];
      g.globalAlpha = pearls[i + 4];
      g.drawImage(pearls[i] ? this.spr.blood : this.spr.water, pearls[i + 1] - r, pearls[i + 2] - r, r * 2, r * 2);
    }
    // Dråpene: kupler, strukket litt i fartsretningen, med tyngden nederst
    const k = this.kk();
    for (const d of this.drops) {
      const spr = d.blood ? this.spr.blood : this.spr.water, s = d.sliding ? 1 + Math.min(0.35, d.vy / (90 * k)) : 1, h = d.r * 2 * s;
      g.globalAlpha = d.blood ? 1 : clamp(d.r * 1.4, 0, 1);
      g.drawImage(spr, d.x - d.r, d.y + d.r - h, d.r * 2, h);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}
