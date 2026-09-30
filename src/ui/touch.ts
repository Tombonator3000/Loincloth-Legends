// Berøringskontroller for mobil og nettbrett: flytende stikke til venstre, knapper til høyre, pause oppe.
// Styrer alltid spiller 1 via InputManager.touch. Vises bare når spillet er i gang (ikke i menyer).
import type { Btn, InputManager } from '../core/input';

const BUTTONS: { btn: Btn; label: string; cls: string }[] = [
  { btn: 'attack', label: 'HIT', cls: 'tb-attack' },
  { btn: 'jump', label: 'JUMP', cls: 'tb-jump' },
  { btn: 'special', label: 'MAGIC', cls: 'tb-special' },
];

export class TouchControls {
  root: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private stickId: number | null = null;
  private ox = 0;
  private oy = 0;
  private held = new Map<number, Btn>();
  private btnEls = new Map<Btn, HTMLElement>();
  visible = false;
  /** Etiketter kan byttes per scene (f.eks. BLOCK i duellen). */
  private labels: Partial<Record<Btn, string>> = {};

  constructor(parent: HTMLElement, private input: InputManager) {
    this.root = document.createElement('div');
    this.root.className = 'touch';
    this.root.innerHTML = `<div class="t-zone"></div><div class="t-base"><div class="t-knob"></div></div><div class="t-btns"></div><button class="t-pause" type="button" aria-label="Pause">II</button>`;
    parent.appendChild(this.root);
    const rot = document.createElement('div');
    rot.className = 'rotate-note';
    rot.innerHTML = '<div>TURN YOUR DEVICE SIDEWAYS.<small>BARBARIANS NEED ROOM TO SWING.<br>(TAP TO PLAY ANYWAY)</small></div>';
    parent.appendChild(rot);

    this.base = this.root.querySelector('.t-base')!;
    this.knob = this.root.querySelector('.t-knob')!;
    const zone = this.root.querySelector('.t-zone') as HTMLElement;
    const btns = this.root.querySelector('.t-btns')!;
    for (const b of BUTTONS) {
      const el = document.createElement('div');
      el.className = 'tbtn ' + b.cls;
      el.dataset.btn = b.btn;
      el.innerHTML = `<span>${b.label}</span>`;
      btns.appendChild(el);
      this.btnEls.set(b.btn, el);
      el.addEventListener('pointerdown', (e) => this.press(e, b.btn, el));
      el.addEventListener('pointerup', (e) => this.release(e));
      el.addEventListener('pointercancel', (e) => this.release(e));
      el.addEventListener('lostpointercapture', (e) => this.release(e));
    }
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      try {
        zone.setPointerCapture?.(e.pointerId);
      } catch {
        /* syntetiske hendelser (tester) */
      }
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.base.style.left = e.clientX + 'px';
      this.base.style.top = e.clientY + 'px';
      this.base.classList.add('on');
      this.move(e.clientX, e.clientY);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.move(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.base.classList.remove('on');
      this.knob.style.transform = '';
      this.setDir(0, 0);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
    const pause = this.root.querySelector('.t-pause') as HTMLElement;
    pause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.touchMenu.pause = true;
    });
    // Blokker kontekstmeny og markering ved langt trykk
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.style.display = 'none';
  }

  private press(e: PointerEvent, btn: Btn, el: HTMLElement) {
    e.preventDefault();
    e.stopPropagation();
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* syntetiske hendelser (tester) */
    }
    this.held.set(e.pointerId, btn);
    this.input.touch[btn] = true;
    el.classList.add('down');
    try {
      navigator.vibrate?.(8);
    } catch {
      /* ikke støttet */
    }
  }

  private release(e: PointerEvent) {
    const btn = this.held.get(e.pointerId);
    if (!btn) return;
    this.held.delete(e.pointerId);
    if (![...this.held.values()].includes(btn)) {
      this.input.touch[btn] = false;
      this.btnEls.get(btn)?.classList.remove('down');
    }
  }

  private move(x: number, y: number) {
    const R = 56;
    let dx = x - this.ox;
    let dy = y - this.oy;
    const d = Math.hypot(dx, dy);
    // Stikken følger fingeren hvis den drar langt (føles mindre stivt)
    if (d > R * 1.6) {
      const k = (d - R * 1.6) / d;
      this.ox += dx * k;
      this.oy += dy * k;
      this.base.style.left = this.ox + 'px';
      this.base.style.top = this.oy + 'px';
      dx = x - this.ox;
      dy = y - this.oy;
    }
    const dd = Math.min(R, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    this.knob.style.transform = `translate(${(Math.cos(a) * dd).toFixed(1)}px, ${(Math.sin(a) * dd).toFixed(1)}px)`;
    this.setDir(dd > R * 0.3 ? Math.cos(a) : 0, dd > R * 0.3 ? Math.sin(a) : 0);
  }

  private setDir(x: number, y: number) {
    const t = this.input.touch;
    t.left = x < -0.38;
    t.right = x > 0.38;
    t.up = y < -0.38;
    t.down = y > 0.38;
  }

  setLabels(l: Partial<Record<Btn, string>>) {
    for (const b of BUTTONS) {
      const text = l[b.btn] ?? b.label;
      if (this.labels[b.btn] === text) continue;
      this.labels[b.btn] = text;
      const span = this.btnEls.get(b.btn)?.querySelector('span');
      if (span) span.textContent = text;
    }
  }

  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
    if (!v) {
      this.held.clear();
      this.stickId = null;
      this.base.classList.remove('on');
      for (const k of Object.keys(this.input.touch) as Btn[]) this.input.touch[k] = false;
      for (const el of this.btnEls.values()) el.classList.remove('down');
    }
  }
}
