// Oppstartslogo: Tom's Happy Happy Funtimes Emporium. Først en "trykk for å starte"-skjerm (nettleseren
// slipper ikke lyd ut før man har trykket), så faller logoen ned med trommevirvel, solstråler, konfetti og fanfare.
// Hoppes over med en tast, et trykk eller en gamepad-knapp. Hoppes helt over i automatiske tester.
import logoUrl from '../assets/studio-logo.webp';
import { audio } from '../core/audio';
import { isTouchDevice } from '../core/settings';

const CONFETTI = ['#c8102e', '#f4e3c1', '#1f3a70', '#e8b83a', '#ffffff', '#ff4fa3', '#3bceac'];

export class Splash {
  root: HTMLDivElement;
  done = false;
  private phase: 'gate' | 'logo' | 'out' = 'gate';
  private timers: number[] = [];
  private raf = 0;
  private padWas = true;

  constructor(parent: HTMLElement, private onDone: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'splash';
    const touch = isTouchDevice();
    this.root.innerHTML = `
      <div class="sp-gate">
        <div class="sp-press">${touch ? 'TAP TO BEGIN' : 'PRESS ANY KEY'}</div>
        <div class="sp-small">${touch ? 'BEST PLAYED SIDEWAYS, IN FULLSCREEN' : 'KEYBOARD OR GAMEPAD. SOUND ON FOR MAXIMUM GLORY.'}</div>
      </div>
      <div class="sp-stage">
        <div class="sp-burst"></div>
        <div class="sp-glow"></div>
        <img class="sp-logo" alt="Tom's Happy Happy Funtimes Emporium" src="${logoUrl}">
        <div class="sp-presents">PRESENTS</div>
        <div class="sp-sparkles"></div>
        <div class="sp-confetti"></div>
        <div class="sp-flash"></div>
      </div>`;
    parent.appendChild(this.root);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.input();
    };
    const onPointer = () => this.input();
    window.addEventListener('keydown', onKey, true);
    this.root.addEventListener('pointerdown', onPointer);
    this.cleanup = () => {
      window.removeEventListener('keydown', onKey, true);
      this.root.removeEventListener('pointerdown', onPointer);
      cancelAnimationFrame(this.raf);
      for (const t of this.timers) clearTimeout(t);
    };
    // Gamepad: vent på et nytt knappetrykk
    const poll = () => {
      let down = false;
      try {
        for (const p of navigator.getGamepads?.() ?? []) if (p?.buttons.some((b) => b.pressed)) down = true;
      } catch {
        /* ingen gamepad-støtte */
      }
      if (down && !this.padWas) this.input();
      this.padWas = down;
      if (!this.done) this.raf = requestAnimationFrame(poll);
    };
    this.raf = requestAnimationFrame(poll);
  }

  private cleanup: () => void = () => {};

  /** Første trykk starter logoen (og lyden), neste trykk hopper over. */
  private input() {
    if (this.phase === 'gate') this.start();
    else if (this.phase === 'logo') this.finish(0.3);
  }

  private at(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private start() {
    this.phase = 'logo';
    audio.init();
    audio.stop();
    this.root.classList.add('go');
    if (isTouchDevice()) {
      // På mobil: fullskjerm og liggende modus hvis nettleseren lar oss
      try {
        const el = document.documentElement as HTMLElement & { requestFullscreen?: (o?: FullscreenOptions) => Promise<void> };
        el.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch(() => {}))?.catch(() => {});
      } catch {
        /* ikke støttet */
      }
    }
    audio.fanfare();
    this.at(720, () => this.land());
    this.at(1500, () => this.root.classList.add('pres'));
    this.at(4300, () => this.finish(0.7));
  }

  private land() {
    this.root.classList.add('landed');
    // Konfetti
    const box = this.root.querySelector('.sp-confetti') as HTMLElement;
    for (let i = 0; i < 90; i++) {
      const d = document.createElement('i');
      d.style.left = 50 + (Math.random() - 0.5) * 30 + '%';
      d.style.top = 40 + (Math.random() - 0.5) * 20 + '%';
      d.style.background = CONFETTI[i % CONFETTI.length];
      d.style.setProperty('--dx', (Math.random() - 0.5) * 110 + 'vw');
      d.style.setProperty('--dy', 30 + Math.random() * 80 + 'vh');
      d.style.setProperty('--rot', (Math.random() - 0.5) * 1440 + 'deg');
      d.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      d.style.animationDelay = Math.random() * 0.15 + 's';
      box.appendChild(d);
    }
    // Glitter rundt logoen
    const sp = this.root.querySelector('.sp-sparkles') as HTMLElement;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('i');
      const a = (i / 14) * Math.PI * 2;
      s.style.left = 50 + Math.cos(a) * (30 + Math.random() * 8) + '%';
      s.style.top = 46 + Math.sin(a) * (34 + Math.random() * 8) + '%';
      s.style.animationDelay = Math.random() * 1.6 + 's';
      sp.appendChild(s);
    }
    for (let i = 0; i < 5; i++) this.at(200 + i * 330, () => audio.sparkle());
  }

  /** Fade ut og gi kontrollen til spillet. */
  finish(fade = 0.6) {
    if (this.phase === 'out' || this.done) return;
    this.phase = 'out';
    this.root.style.transition = `opacity ${fade}s ease-in`;
    this.root.style.opacity = '0';
    this.at(fade * 1000 + 30, () => this.end());
  }

  /** Fjern alt med en gang (tester, scenebytte). */
  end() {
    if (this.done) return;
    this.done = true;
    this.cleanup();
    this.root.remove();
    this.onDone();
  }

  get blocking() {
    return !this.done;
  }
}

/** Skal logoen vises? Ikke i automatiske tester eller med ?nosplash i adressen (?splash tvinger den frem). */
export function wantSplash() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('splash')) return true;
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return false;
    if (q.has('nosplash')) return false;
  } catch {
    /* ignorer */
  }
  return true;
}
