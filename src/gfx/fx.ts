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
/** Hodet som sitter klistret på skjermen og sklir sakte ned. */
interface GlassHead { img: HTMLCanvasElement; x: number; y: number; y0: number; size: number; rot: number; t: number; vy: number; stopSqueak: (() => void) | null; done: boolean; family: boolean; stickT: number; fade: number }

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
    this.glass.push({ img: f.img, x, y, y0: y, size, rot: rand(-0.35, 0.35), t: 0, vy: 0, stopSqueak: null, done: false, family: f.family, stickT: rand(0.4, 0.6), fade: 1 });
    // Sprut rundt treffpunktet
    const c = this.smearCtx;
    for (let i = 0; i < (f.family ? 26 : 34); i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(size * 0.2, size * 0.75);
      c.fillStyle = f.family ? pick(CONFETTI) : pick(['#8e0015', '#b3001b', '#6d0010']);
      c.globalAlpha = rand(0.7, 1);
      c.beginPath();
      c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rand(3, f.family ? 10 : 18), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    if (!f.family) this.screenBlood(3);
    audio.glassSplat(f.family);
    this.shake(0.5);
    this.onGlassHit?.();
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
    c.clearRect(0, 0, W, H);
    for (let i = this.glass.length - 1; i >= 0; i--) {
      const g = this.glass[i];
      g.t += dt;
      const sliding = g.t > g.stickT && !g.done;
      if (sliding) {
        if (!g.stopSqueak) g.stopSqueak = audio.squeak(5.5);
        // Stick-slip: ujevn fart, som hud mot glass
        const slip = Math.sin(g.t * 17) + Math.sin(g.t * 5.3) > 0.1 ? 1 : 0.12;
        const bottom = g.y > H * 0.9;
        g.vy = Math.min(bottom ? H * 1.2 : H * 0.22, g.vy + dt * H * (bottom ? 2.5 : 0.25));
        const dy = g.vy * dt * (bottom ? 1 : slip);
        const sm = this.smearCtx;
        const w = g.size * 0.46;
        // Stripen blir liggende over hodet
        sm.fillStyle = g.family ? 'rgba(255,255,255,0.18)' : 'rgba(128,0,18,0.9)';
        const top = g.y - g.size * 0.3;
        sm.beginPath();
        sm.moveTo(g.x - w / 2 + rand(-2, 2), top);
        sm.lineTo(g.x + w / 2 + rand(-2, 2), top);
        sm.lineTo(g.x + w / 2 + rand(-2, 2), top + dy + 2);
        sm.lineTo(g.x - w / 2 + rand(-2, 2), top + dy + 2);
        sm.fill();
        if (!g.family && Math.random() < dt * 5) {
          // Drypp som renner litt ned fra kanten
          sm.fillRect(g.x + rand(-w / 2, w / 2), top, rand(3, 6), rand(10, 40));
        }
        g.y += dy;
        g.rot += dt * 0.1 * Math.sign(g.rot || 1);
        if (g.y - g.size * 0.5 > H || g.t > 12) {
          g.done = true;
          g.stopSqueak?.();
          g.stopSqueak = null;
        }
      }
      if (g.done) g.fade -= dt * 0.35;
      // Smøreflekken blir liggende litt, så falmer den
      const a = Math.max(0, Math.min(1, g.fade));
      c.globalAlpha = a;
      c.drawImage(this.smearCv, 0, 0);
      c.globalAlpha = 1;
      if (!g.done) {
        const sq = g.t < 0.16 ? 1 - g.t / 0.16 : 0;
        const sxs = 1 + 0.35 * sq, sys = 1 - 0.28 * sq;
        const iw = g.img.width, ih = g.img.height;
        const s = g.size / ih;
        c.save();
        c.translate(g.x, g.y);
        c.rotate(g.rot);
        c.scale(sxs * s, sys * s);
        c.drawImage(g.img, -iw / 2, -ih / 2);
        c.restore();
        c.globalAlpha = 1;
      }
      if (g.fade <= 0) {
        this.glass.splice(i, 1);
        if (!this.glass.length) {
          this.smearCtx.clearRect(0, 0, W, H);
          c.clearRect(0, 0, W, H);
        }
      }
    }
  }

  /** Skjermeffekter bruker realDt; teksten hører til verdenen og får samme simDt som figurene. */
  update(realDt: number, camera: THREE.Camera, width: number, height: number, simDt = realDt) {
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
      t.life -= simDt;
      t.pos.y += t.vy * simDt;
      t.vy *= Math.exp(-simDt * 2);
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
