// Skjermeffekter: risting, hitstop, slowmo, sverd-spor, tegneserietekst, blod på skjermen.
// Blodet på skjermen går til dråpene på glasset (screenwet.ts, via screenfx.ts) når etterbehandlingen er på.
// Det flate 2D-blodet her er reserven på LOW, og FAMILY får konfetti i stedet.
import * as THREE from 'three';
import { plainCanvas } from './draw';
import { rand, pick } from '../core/math';
import { settings } from '../core/settings';
import { audio } from '../core/audio';
import { CONFETTI } from './gore';
import { screenFX } from './screenfx';

function arcTexture() {
  const cv = plainCanvas(256, 256, (c) => {
    const cx = 128, cy = 128, R = 118;
    const a0 = -Math.PI * 0.55, a1 = Math.PI * 0.55;
    const N = 60;
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = a0 + (a1 - a0) * t;
      c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const a = a0 + (a1 - a0) * t;
      const w = 46 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.8) + 1;
      c.lineTo(cx + Math.cos(a) * (R - w), cy + Math.sin(a) * (R - w));
    }
    c.closePath();
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0.95)');
    c.fillStyle = g;
    c.fill();
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Swoosh { mesh: THREE.Mesh; life: number; max: number }
interface FloatText { el: HTMLDivElement; pos: THREE.Vector3; life: number; max: number; vy: number }
interface ScreenDrop { x: number; y: number; r: number; vy: number; a: number; trail: number; col?: string }
/** Et hode (eller annet) som flyr mot kameraet og klasker i skjermen. */
interface Flyer { obj: THREE.Object3D; t: number; dur: number; spin: number; sx: number; sy: number; from: THREE.Vector3; img: HTMLCanvasElement; family: boolean; onArrive?: () => void }
/** En søyle (2 piksler bred) i blodsporet etter hodet: tetthet, farge, og hvor langt under starten den begynner. */
interface TrailCol { a: number; col: string; off: number }
/** En renne: blod som samler seg i kanten av sporet og renner ned for seg selv, med en dråpe i enden. */
interface Drip { x: number; y: number; len: number; max: number; v: number; w: number; col: string }
/**
 * Hodet som sitter klistret på skjermen og sklir sakte ned. head er hvor synlig selve hodet er (det tones ut mens det
 * sklir), fade er hvor synlig blodsporet er, og blood er hvor mye blod som er igjen å smøre ut.
 */
interface GlassHead {
  img: HTMLCanvasElement; x: number; y: number; y0: number; size: number; rot: number; t: number; vy: number;
  stopSqueak: (() => void) | null; done: boolean; family: boolean; stickT: number; fade: number;
  head: number; blood: number; cols: TrailCol[]; trailY: number; phase: number; drips: Drip[];
}

/** Hodet i glasset: hvor lenge det synes etter at det begynner å skli, og hvor lenge det tones ut (sekunder). */
const HEAD_SHOW = 0.9;
const HEAD_FADE = 1.1;
/** Hvor langt (andel av skjermhøyden) blodet rekker før sporet tørker ut, og hvor fort sporet falmer etterpå. */
const TRAIL_REACH = 0.38;
const TRAIL_FADE = 0.45;
/** Blodfarger på glasset, fra levret til friskt. */
const GLASS_BLOOD = ['#4e0009', '#66000e', '#7e0013', '#960018', '#a8061e'];
/** Bredden på blodsporet, og hvor det går i forhold til midten av hodet (andeler av hodet). */
const TRAIL_W = 0.42;
const TRAIL_Y = -0.04;

/**
 * Profilen på tvers av blodsporet: søyler på to piksler med myke striper (summen av noen sinuser med tilfeldig fase,
 * så nabosøylene ligner hverandre), fargen etter hvor tett stripa er, og en fillete start øverst.
 */
function trailProfile(width: number): TrailCol[] {
  const n = Math.max(16, Math.round(width / 2));
  const p1 = rand(0, 6.28), p2 = rand(0, 6.28), p3 = rand(0, 6.28);
  const cols: TrailCol[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const streak = 0.5 + 0.22 * Math.sin(u * 23 + p1) + 0.14 * Math.sin(u * 61 + p2) + 0.1 * Math.sin(u * 7 + p3);
    const a = Math.min(0.95, Math.max(0.4, 0.45 + 0.5 * streak + rand(-0.04, 0.04)));
    const k = Math.min(GLASS_BLOOD.length - 1, Math.max(0, Math.floor((1 - streak) * GLASS_BLOOD.length)));
    cols.push({ a, col: GLASS_BLOOD[k], off: Math.round(4 + 4 * Math.sin(u * 9 + p1) + rand(0, 2)) });
  }
  return cols;
}

export class FX {
  shakeAmt = 0;
  hitstop = 0;
  timeScale = 1;
  slowTimer = 0;
  offset = new THREE.Vector3();
  /** Kameraets x fra forrige bilde (innleste replikker panoreres etter hvor figuren står). */
  private camX = 0;
  private arcTex = arcTexture();
  private swooshes: Swoosh[] = [];
  private texts: FloatText[] = [];
  private drops: ScreenDrop[] = [];
  private bloodCv: HTMLCanvasElement;
  private bloodCtx: CanvasRenderingContext2D;
  private flashEl: HTMLDivElement;
  private layer: HTMLDivElement;
  private glassCv: HTMLCanvasElement;
  private glassCtx: CanvasRenderingContext2D;
  private smearCv: HTMLCanvasElement;
  private smearCtx: CanvasRenderingContext2D;
  private flyers: Flyer[] = [];
  private glass: GlassHead[] = [];
  /** Kalles når et hode treffer skjermen (brukes til tekst, publikum og tester). */
  onGlassHit: (() => void) | null = null;
  scene: THREE.Scene | null = null;

  constructor(root: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'fx-layer';
    root.appendChild(this.layer);
    this.bloodCv = document.createElement('canvas');
    this.bloodCv.className = 'fx-blood';
    root.appendChild(this.bloodCv);
    this.bloodCtx = this.bloodCv.getContext('2d')!;
    this.glassCv = document.createElement('canvas');
    this.glassCv.className = 'fx-glass';
    root.appendChild(this.glassCv);
    this.glassCtx = this.glassCv.getContext('2d')!;
    this.smearCv = document.createElement('canvas');
    this.smearCtx = this.smearCv.getContext('2d')!;
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'fx-flash';
    root.appendChild(this.flashEl);
    const rs = () => {
      this.bloodCv.width = Math.floor(window.innerWidth / 2);
      this.bloodCv.height = Math.floor(window.innerHeight / 2);
      this.glassCv.width = this.smearCv.width = window.innerWidth;
      this.glassCv.height = this.smearCv.height = window.innerHeight;
    };
    rs();
    window.addEventListener('resize', rs);
  }

  reset(scene: THREE.Scene) {
    this.scene = scene;
    for (const s of this.swooshes) s.mesh.removeFromParent();
    this.swooshes.length = 0;
    for (const t of this.texts) t.el.remove();
    this.texts.length = 0;
    this.drops.length = 0;
    this.bloodCtx.clearRect(0, 0, this.bloodCv.width, this.bloodCv.height);
    this.clearGlass();
    this.shakeAmt = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.slowTimer = 0;
  }

  shake(a: number) {
    if (!settings.shake) a *= 0.15;
    this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, a));
  }
  stop(t: number) {
    this.hitstop = Math.max(this.hitstop, t);
  }
  slowmo(scale: number, realTime: number) {
    this.timeScale = scale;
    this.slowTimer = realTime;
  }
  /**
   * Farget glimt over hele skjermen. Med FLASHES av blir det bare mørke toninger (magi, raseri, død),
   * og svakere; lyse og hvite glimt hoppes over.
   */
  flash(color = '#fff', strength = 0.6, dur = 0.12) {
    if (!settings.flashes) {
      const c = new THREE.Color(color);
      if (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.2) return;
      strength *= 0.5;
    }
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = String(strength);
    void el.offsetWidth;
    el.style.transition = `opacity ${dur}s ease-out`;
    el.style.opacity = '0';
  }

  /** Lynglimt: kaldt og sterkest øverst i etterbehandlingen, ellers et blått glimt. Følger FLASHES. */
  lightningFlash(strength = 0.3, dur = 0.15) {
    if (!settings.flashes) return;
    if (screenFX.active) screenFX.lightning(Math.min(1, strength * 1.8));
    else this.flash('#cfe8ff', strength, dur);
  }

  /**
   * En helt er truffet: rød kant, og blod på glasset fra siden slaget kom fra (side -1 venstre, 1 høyre).
   * power er omtrent skaden delt på maks helse ganger tre (0.35 til 1.6).
   */
  heroHit(power: number, side: number) {
    screenFX.hurt = Math.max(screenFX.hurt, Math.min(1, 0.3 + power * 0.35));
    screenFX.wet.hit(power, side);
  }

  /** Blod mot glasset fra et punkt i verden (sprengte fiender). Bare med etterbehandling, ikke på FAMILY. */
  lensSplat(pos: THREE.Vector3, amount = 1) {
    screenFX.splatAt(pos, amount);
  }

  /** Hvit sverd-bue. angle = rotasjon i xy, facing = speilvending. */
  swoosh(x: number, y: number, z: number, size: number, angle: number, facing: number, color = '#ffffff', life = 0.16) {
    if (!this.scene) return;
    const mat = new THREE.MeshBasicMaterial({ map: this.arcTex, transparent: true, depthWrite: false, color, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.position.set(x, y, z + 0.08);
    m.scale.x = facing;
    m.rotation.z = angle * facing;
    m.renderOrder = 4;
    this.scene.add(m);
    this.swooshes.push({ mesh: m, life, max: life });
  }

  text(pos: THREE.Vector3, msg: string, cls = '', life = 1.0) {
    // Snakkebobler leses inn når det finnes en innspilt replikk (docs/STEMMER.md), fra siden figuren står på
    if (cls.includes('speech')) audio.voice(msg, (pos.x - this.camX) / 9);
    const el = document.createElement('div');
    el.className = 'ftext ' + cls;
    el.textContent = msg;
    el.style.opacity = '0';
    this.layer.appendChild(el);
    this.texts.push({ el, pos: pos.clone(), life, max: life, vy: 1.2 });
  }

  /**
   * Blod over hele skjermen (helten dør, sjefen dør, hodet i skjermen, halshugging i duellen). Med etterbehandling
   * blir det dråper på glasset som renner. Ellers (LOW) flate dråper på et 2D-lerret, og konfetti på FAMILY.
   */
  screenBlood(n = 8) {
    if (settings.gore > 0 && screenFX.wet.enabled) {
      screenFX.wet.drench(n);
      return;
    }
    const W = this.bloodCv.width, H = this.bloodCv.height;
    const fam = settings.gore === 0;
    n = Math.round(n * [0.6, 0.5, 1, 2.2][settings.gore]);
    for (let i = 0; i < n; i++) {
      const x = rand(0, W), y = rand(0, H * 0.7);
      const r = fam ? rand(3, 9) : rand(8, 40);
      const col = fam ? pick(CONFETTI) : undefined;
      this.drops.push({ x, y, r, vy: rand(4, 18), a: 1, trail: 0, col });
      for (let k = 0; k < 6; k++) this.drops.push({ x: x + rand(-r * 2, r * 2), y: y + rand(-r * 2, r * 2), r: fam ? rand(2, 5) : rand(2, 7), vy: rand(0, 6), a: 1, trail: 0, col: fam ? pick(CONFETTI) : undefined });
    }
  }

  // ---------------------------------------------------------------- hode i skjermen
  /**
   * Send et objekt (typisk et avkappet hode) mot kameraet. Når det kommer frem, klasker det i
   * "glasset" og sklir sakte nedover med sklilyd og en blodstripe. img er hodets tegning.
   */
  hurlAtScreen(obj: THREE.Object3D, img: HTMLCanvasElement, dur = 0.55, onArrive?: () => void) {
    const sx = rand(0.3, 0.7);
    const sy = rand(0.28, 0.42);
    this.flyers.push({ obj, t: 0, dur, spin: rand(8, 14) * (Math.random() < 0.5 ? -1 : 1), sx, sy, from: obj.position.clone(), img, family: settings.gore === 0, onArrive });
    audio.swish(0.7, true);
  }

  get headOnGlass() {
    return this.glass.length > 0 || this.flyers.length > 0;
  }

  clearGlass() {
    for (const g of this.glass) g.stopSqueak?.();
    this.glass.length = 0;
    for (const f of this.flyers) f.obj.visible = true;
    this.flyers.length = 0;
    this.glassCtx.clearRect(0, 0, this.glassCv.width, this.glassCv.height);
    this.smearCtx.clearRect(0, 0, this.smearCv.width, this.smearCv.height);
  }

  private splatGlass(f: Flyer) {
    const W = this.glassCv.width, H = this.glassCv.height;
    const size = H * 0.62;
    const x = f.sx * W, y = f.sy * H;
    const g: GlassHead = {
      img: f.img, x, y, y0: y, size, rot: rand(-0.35, 0.35), t: 0, vy: 0, stopSqueak: null, done: false, family: f.family,
      stickT: rand(0.4, 0.6), fade: 1, head: 1, blood: 1, cols: trailProfile(size * TRAIL_W), trailY: Math.floor(y + size * TRAIL_Y),
      phase: rand(0, Math.PI * 2), drips: [],
    };
    this.glass.push(g);
    // Blodet fra klatten der hodet traff, renner nedover glasset (synes når hodet er borte)
    if (!f.family) {
      for (let i = 0, n = Math.floor(rand(4, 8)); i < n; i++) {
        // Fra nedre del av klatten (radius 0,17 av hodet i spatter), aldri fra tomt glass
        const a = rand(0.15, Math.PI - 0.15), r = size * 0.17 * rand(0.55, 0.9);
        g.drips.push({ x: Math.round(x + Math.cos(a) * r), y: Math.round(y + Math.sin(a) * r * 0.9), len: 0, max: rand(60, 200), v: rand(28, 60), w: Math.round(rand(2, 5)), col: pick(GLASS_BLOOD) });
      }
    }
    const c = this.smearCtx;
    if (f.family) {
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2);
        const d = rand(size * 0.2, size * 0.75);
        c.fillStyle = pick(CONFETTI);
        c.globalAlpha = rand(0.7, 1);
        c.beginPath();
        c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rand(3, 10), 0, Math.PI * 2);
        c.fill();
      }
    } else this.spatter(x, y, size);
    c.globalAlpha = 1;
    if (!f.family) this.screenBlood(3);
    audio.glassSplat(f.family);
    this.shake(0.5);
    this.onGlassHit?.();
  }

  /**
   * Spruten der hodet treffer: én uregelmessig klatt med mørkere midte og små sideklatter, dråper som blir mindre og
   * avlange jo lenger ut de fløy, og noen korte, spisse stråler med en dråpe i enden.
   */
  private spatter(x: number, y: number, size: number) {
    const c = this.smearCtx;
    const blob = (bx: number, by: number, r: number, col: string, a: number) => {
      const ph = rand(0, 6.28), n = 26;
      c.fillStyle = col;
      c.globalAlpha = a;
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * Math.PI * 2;
        const rr = r * (1 + 0.2 * Math.sin(t * 3 + ph) + 0.1 * Math.sin(t * 7 + ph * 2) + rand(-0.05, 0.05));
        const px = bx + Math.cos(t) * rr, py = by + Math.sin(t) * rr * 0.9;
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.closePath();
      c.fill();
    };
    const R = size * 0.17;
    blob(x, y, R, GLASS_BLOOD[2], 0.9);
    blob(x + rand(-4, 4), y + rand(-4, 4), R * 0.7, GLASS_BLOOD[1], 0.75);
    blob(x + rand(-3, 3), y + rand(-3, 3), R * 0.38, GLASS_BLOOD[0], 0.7);
    // Små klatter rundt kanten
    for (let i = 0, n = Math.floor(rand(6, 11)); i < n; i++) {
      const a = rand(0, Math.PI * 2), d = R * rand(0.95, 1.5);
      blob(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, R * rand(0.12, 0.3), pick(GLASS_BLOOD), rand(0.75, 0.95));
    }
    // Dråper lenger ut: mindre og mer avlange jo lenger de fløy
    for (let i = 0; i < 44; i++) {
      const a = rand(0, Math.PI * 2);
      const d = R * 1.3 + Math.pow(Math.random(), 0.8) * size * 0.75;
      const r = Math.max(1.3, (1 - d / (size * 1.0)) * rand(3, 10));
      c.fillStyle = pick(GLASS_BLOOD);
      c.globalAlpha = rand(0.75, 1);
      c.beginPath();
      c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.88, r * rand(1.2, 2.2), r, a, 0, Math.PI * 2);
      c.fill();
    }
    // Korte, spisse stråler fra klatten
    for (let i = 0, n = Math.floor(rand(4, 7)); i < n; i++) {
      const a = rand(0, Math.PI * 2), r0 = R * 0.85, len = rand(0.07, 0.18) * size, w0 = rand(4, 8);
      const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
      const x0 = x + ca * r0, y0 = y + sa * r0 * 0.9, x1 = x + ca * (r0 + len), y1 = y + sa * (r0 + len) * 0.9;
      c.fillStyle = pick(GLASS_BLOOD);
      c.globalAlpha = rand(0.8, 0.95);
      c.beginPath();
      c.moveTo(x0 + nx * w0, y0 + ny * w0);
      c.quadraticCurveTo(x0 + ca * len * 0.5 + nx * w0 * 0.3, y0 + sa * len * 0.5 + ny * w0 * 0.3, x1, y1);
      c.quadraticCurveTo(x0 + ca * len * 0.5 - nx * w0 * 0.3, y0 + sa * len * 0.5 - ny * w0 * 0.3, x0 - nx * w0, y0 - ny * w0);
      c.closePath();
      c.fill();
      c.beginPath();
      c.ellipse(x1 + ca * 2, y1 + sa * 2, rand(2, 3.5), rand(2.5, 4.5), a, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /**
   * Blodsporet over hodet mens det sklir, som når en blodig ting dras ned en rute: et sammenhengende smøresjikt med
   * myke striper på langs, mørkere kanter der blodet samler seg, en blank stripe, og kanter som blir smalere og mer
   * ujevne når blodet tar slutt. Radene tegnes på hele piksler, så det ikke blir tverrstriper der bildene møtes.
   */
  private trail(g: GlassHead, dy: number, dt: number) {
    const sm = this.smearCtx;
    const H = this.smearCv.height;
    const top = g.y + g.size * TRAIL_Y;
    g.blood = Math.max(0, g.blood - dy / (H * TRAIL_REACH));
    const y1 = Math.floor(top + dy);
    if (y1 > g.trailY) {
      const n = g.cols.length, w = n * 2;
      // Bredden og tettheten varierer langs sporet og avtar når blodet tar slutt
      const along = 0.78 + 0.22 * Math.sin(top * 0.045 + g.phase) * Math.sin(top * 0.013 + g.phase * 2);
      const half = (w / 2) * (0.5 + 0.5 * g.blood) * (0.9 + 0.1 * Math.sin(top * 0.08 + g.phase)) + rand(-2.5, 2.5);
      const wob = Math.round(Math.sin(g.t * 2.1 + g.phase) * 1.5);
      const x0 = Math.round(g.x - w / 2) + wob;
      const y0t = Math.floor(g.y0 + g.size * TRAIL_Y);
      const dep = 0.2 + 0.8 * g.blood;
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * 2 - w / 2;
        if (Math.abs(cx) > half) continue;
        const c = g.cols[i];
        const ys = Math.max(g.trailY, y0t + c.off);
        if (ys >= y1) continue;
        // Kanten av smøringen er myk ytterst og mørkere rett innenfor: blodet samles der
        const inside = half - Math.abs(cx);
        const soft = Math.min(1, inside / 5);
        const rim = inside > 1.5 && inside < 6 ? 0.25 : 0;
        sm.globalAlpha = Math.min(0.95, (c.a * along + rim) * dep * soft);
        sm.fillStyle = rim ? GLASS_BLOOD[0] : c.col;
        sm.fillRect(x0 + i * 2, ys, 2, y1 - ys);
      }
      // Den blanke stripa (vått lys) litt til venstre for midten
      sm.globalAlpha = 0.16 * g.blood;
      sm.fillStyle = '#e8707a';
      sm.fillRect(Math.round(g.x - w * 0.16) + wob, g.trailY, Math.max(2, Math.round(w * 0.035)), y1 - g.trailY);
      sm.globalAlpha = 1;
      g.trailY = y1;
    }
    // Renner fra sporet (de synes når hodet er borte)
    const len = top - (g.y0 + g.size * TRAIL_Y);
    if (Math.random() < dt * 5 * g.blood && len > 20) {
      const w = g.cols.length * 2;
      g.drips.push({ x: Math.round(g.x + rand(-0.45, 0.45) * w), y: Math.round(top - rand(10, Math.min(160, len))), len: 0, max: rand(25, 120) * (0.5 + g.blood), v: rand(25, 60), w: Math.round(rand(2, 4)), col: pick(GLASS_BLOOD) });
    }
  }

  /**
   * Slutten på sporet når hodet er borte: søylene stikker litt ujevnt nedover og tynnes ut, og blodet som samlet seg
   * i nederkanten, renner videre i noen renner.
   */
  private trailEnd(g: GlassHead) {
    const sm = this.smearCtx;
    const n = g.cols.length, w = n * 2;
    const x0 = Math.round(g.x - w / 2);
    const half = (w / 2) * (0.5 + 0.5 * g.blood);
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * 2 - w / 2;
      if (Math.abs(cx) > half) continue;
      const c = g.cols[i];
      const ext = Math.round(rand(0, 9) + 6 * Math.abs(Math.sin(i * 0.37 + g.phase)));
      for (let k = 0; k < ext; k += 2) {
        sm.globalAlpha = c.a * (0.3 + 0.7 * g.blood) * (1 - k / Math.max(1, ext));
        sm.fillStyle = c.col;
        sm.fillRect(x0 + i * 2, g.trailY + k, 2, 2);
      }
    }
    sm.globalAlpha = 1;
    for (let i = 0, m = Math.floor(rand(2, 5)); i < m; i++) {
      g.drips.push({ x: Math.round(g.x + rand(-0.8, 0.8) * half), y: g.trailY + 4, len: 0, max: rand(30, 120) * (0.4 + g.blood), v: rand(20, 45), w: Math.round(rand(2, 5)), col: pick(GLASS_BLOOD) });
    }
  }

  /** Rennene vokser nedover og bremser opp. Når en stopper, får den en tykkere dråpe i enden. */
  private drips(g: GlassHead, dt: number) {
    const sm = this.smearCtx;
    for (const d of g.drips) {
      if (d.len >= d.max) continue;
      const nl = Math.min(d.max, d.len + d.v * dt);
      // Renna slingrer litt, som blod som finner veien over glasset
      if (Math.random() < dt * 2.5) d.x += Math.random() < 0.5 ? -1 : 1;
      const ya = Math.floor(d.y + d.len), yb = Math.floor(d.y + nl);
      if (yb > ya) {
        sm.globalAlpha = 0.85;
        sm.fillStyle = d.col;
        sm.fillRect(d.x - Math.floor(d.w / 2), ya, d.w, yb - ya);
      }
      d.len = nl;
      d.v *= 1 - dt * 0.7;
      if (d.len >= d.max || d.v < 5) {
        d.max = d.len;
        sm.globalAlpha = 0.9;
        sm.fillStyle = d.col;
        sm.beginPath();
        sm.ellipse(d.x, d.y + d.len + d.w * 0.5, d.w * 0.9, d.w * 1.3, 0, 0, Math.PI * 2);
        sm.fill();
      }
    }
    sm.globalAlpha = 1;
  }

  private updateGlass(dt: number, camera: THREE.Camera) {
    if (this.flyers.length) camera.updateMatrixWorld();
    // Flygende hoder
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const target = new THREE.Vector3((f.sx * 2 - 1), -(f.sy * 2 - 1), 0.5).unproject(camera);
      const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
      const dir = target.sub(camPos).normalize();
      const end = camPos.clone().addScaledVector(dir, 0.9);
      const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
      f.obj.position.lerpVectors(f.from, end, e);
      f.obj.position.y += Math.sin(k * Math.PI) * 1.4;
      f.obj.rotation.z += f.spin * dt;
      if (k >= 1) {
        f.obj.visible = false;
        this.flyers.splice(i, 1);
        this.splatGlass(f);
        f.onArrive?.();
      }
    }
    if (!this.glass.length) return;
    const c = this.glassCtx;
    const W = this.glassCv.width, H = this.glassCv.height;
    let smearA = 0;
    for (const g of this.glass) {
      g.t += dt;
      const sliding = g.t > g.stickT && !g.done;
      if (sliding) {
        if (!g.stopSqueak) g.stopSqueak = audio.squeak(5.5);
        // Stick-slip: ujevn fart, som hud mot glass
        const slip = Math.sin(g.t * 17) + Math.sin(g.t * 5.3) > 0.1 ? 1 : 0.12;
        const bottom = g.y > H * 0.9;
        g.vy = Math.min(bottom ? H * 1.2 : H * 0.26, g.vy + dt * H * (bottom ? 2.5 : 0.35));
        const dy = g.vy * dt * (bottom ? 1 : slip);
        if (g.family) {
          // FAMILY: en svak, hvit stripe
          const w = g.size * 0.46, top = g.y - g.size * 0.3;
          this.smearCtx.fillStyle = 'rgba(255,255,255,0.18)';
          this.smearCtx.fillRect(g.x - w / 2, top, w, dy + 2);
        } else this.trail(g, dy, dt);
        g.y += dy;
        g.rot += dt * 0.1 * Math.sign(g.rot || 1);
        // Hodet sklir sakte, men tones ut etter en stund, så det ikke dekker bildet for lenge
        if (g.t - g.stickT > HEAD_SHOW) g.head = Math.max(0, g.head - dt / HEAD_FADE);
        if (g.head <= 0 || g.y - g.size * 0.5 > H) {
          g.done = true;
          g.stopSqueak?.();
          g.stopSqueak = null;
          if (!g.family) this.trailEnd(g);
        }
      }
      if (!g.family) this.drips(g, dt);
      if (g.done) g.fade -= dt * TRAIL_FADE;
      smearA = Math.max(smearA, Math.min(1, g.fade));
    }
    // Blodsporet tegnes én gang (felles for alle hodene), så hodene oppå
    c.clearRect(0, 0, W, H);
    c.globalAlpha = Math.max(0, smearA);
    c.drawImage(this.smearCv, 0, 0);
    c.globalAlpha = 1;
    for (const g of this.glass) {
      if (g.done || g.head <= 0) continue;
      const sq = g.t < 0.16 ? 1 - g.t / 0.16 : 0;
      const sxs = 1 + 0.35 * sq, sys = 1 - 0.28 * sq;
      const iw = g.img.width, ih = g.img.height;
      const s = g.size / ih;
      c.save();
      c.globalAlpha = g.head;
      c.translate(g.x, g.y);
      c.rotate(g.rot);
      c.scale(sxs * s, sys * s);
      c.drawImage(g.img, -iw / 2, -ih / 2);
      c.restore();
    }
    c.globalAlpha = 1;
    this.glass = this.glass.filter((g) => g.fade > 0);
    if (!this.glass.length) {
      this.smearCtx.clearRect(0, 0, W, H);
      c.clearRect(0, 0, W, H);
    }
  }

  update(realDt: number, camera: THREE.Camera, width: number, height: number) {
    this.camX = camera.position.x;
    this.updateGlass(realDt, camera);
    // Tidsskala
    if (this.slowTimer > 0) {
      this.slowTimer -= realDt;
      if (this.slowTimer <= 0) this.timeScale = 1;
    }
    this.hitstop = Math.max(0, this.hitstop - realDt);
    // Risting
    this.shakeAmt = Math.max(0, this.shakeAmt - realDt * 2.8);
    const s = this.shakeAmt * this.shakeAmt * 0.6;
    this.offset.set(rand(-s, s), rand(-s, s), 0);

    for (let i = this.swooshes.length - 1; i >= 0; i--) {
      const sw = this.swooshes[i];
      sw.life -= realDt * (this.hitstop > 0 ? 0.3 : 1);
      const k = Math.max(0, sw.life / sw.max);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = k;
      sw.mesh.scale.y = 0.9 + 0.1 * k;
      if (sw.life <= 0) {
        sw.mesh.removeFromParent();
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        this.swooshes.splice(i, 1);
      }
    }

    const v = new THREE.Vector3();
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= realDt;
      t.pos.y += t.vy * realDt;
      t.vy *= Math.exp(-realDt * 2);
      v.copy(t.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      const age = 1 - t.life / t.max;
      const sc = age < 0.12 ? 0.4 + (age / 0.12) * 0.9 : 1.3 - Math.min(0.3, (age - 0.12) * 0.6);
      t.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
      t.el.style.opacity = String(Math.min(1, t.life * 3));
      if (t.life <= 0) {
        t.el.remove();
        this.texts.splice(i, 1);
      }
    }

    if (this.drops.length) {
      const c = this.bloodCtx;
      c.clearRect(0, 0, this.bloodCv.width, this.bloodCv.height);
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.y += d.vy * realDt;
        d.trail += d.vy * realDt;
        d.a -= realDt * 0.28;
        if (d.a <= 0) {
          this.drops.splice(i, 1);
          continue;
        }
        c.globalAlpha = Math.min(1, d.a * 1.4);
        c.fillStyle = d.col ?? '#8e0015';
        c.beginPath();
        c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        c.fill();
        if (d.trail > 1 && !d.col) c.fillRect(d.x - d.r * 0.35, d.y - d.trail, d.r * 0.7, d.trail);
        c.fillStyle = 'rgba(255,120,120,0.35)';
        c.beginPath();
        c.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.3, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      if (!this.drops.length) c.clearRect(0, 0, this.bloodCv.width, this.bloodCv.height);
    }
  }
}
