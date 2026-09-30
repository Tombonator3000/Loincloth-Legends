// Fullskjerms-menyer: tittel, kontroller, intro-tekst, seier, game over, pause.
import { audio } from '../core/audio';
import type { Stats } from '../game/world';

export type Item = {
  label: string;
  action: () => void;
  /** Forklaring som vises under menyen når raden er valgt (bare én om gangen, så menyen blir ryddig). */
  hint?: string;
  /** Venstre/høyre endrer verdien. Pilene står rundt verdien. */
  adjust?: (dir: number) => void;
  disabled?: boolean;
  /** Verdien vises til høyre i lister og under navnet i sentrerte menyer. */
  value?: string;
  /** Åpner en undermeny (vises med en pil). */
  more?: boolean;
};
type MenuIn = { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; back: boolean };
export type ControlsPage = 'keys' | 'stages' | 'duels';

export class Screens {
  root: HTMLDivElement;
  private items: Item[] = [];
  private sel = 0;
  private list: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  /** Hvilken bakgrunn skjermen har ('title', 'dim', 'black'), så tittelmenyen kan tegnes om uten å starte logoen på nytt. */
  kind = '';
  private onBack: (() => void) | null = null;
  private onConfirm: (() => void) | null = null;
  private typer: { lines: string[]; li: number; ci: number; t: number; el: HTMLElement; done: () => void; hold: number } | null = null;
  active = false;
  private setAt = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'screen';
    parent.appendChild(this.root);
    // Trykk hvor som helst for å gå videre i mellomsekvenser (mus og berøring)
    this.root.addEventListener('click', (e) => {
      if (performance.now() - this.setAt < 350) return;
      if ((e.target as HTMLElement).closest('li, button, input')) return;
      if (this.onConfirm) {
        const f = this.onConfirm;
        this.onConfirm = null;
        audio.confirm();
        f();
      }
    });
  }

  private set(html: string, cls: string) {
    this.setAt = performance.now();
    this.kind = cls;
    this.list = null;
    this.hintEl = null;
    this.root.className = cls;
    this.root.innerHTML = html;
    this.root.style.display = '';
    this.active = true;
    this.items = [];
    this.sel = 0;
    this.onBack = null;
    this.onConfirm = null;
    this.typer = null;
  }

  hide() {
    this.root.style.display = 'none';
    this.root.innerHTML = '';
    this.active = false;
    this.items = [];
    this.typer = null;
  }

  private menu(items: Item[], container: HTMLElement, sel = 0) {
    this.items = items;
    this.list = container;
    container.innerHTML = items.map((it, i) => {
      const cls = [it.disabled ? 'off' : '', it.adjust ? 'has-adj' : '', it.value !== undefined ? 'has-val' : '', it.more ? 'more' : ''].filter(Boolean).join(' ');
      const arrows = !!it.adjust;
      const val = it.value !== undefined
        ? `<span class="val">${arrows ? '<b class="adj l">&lsaquo;</b>' : ''}<span class="v">${it.value}</span>${arrows ? '<b class="adj r">&rsaquo;</b>' : ''}</span>`
        : it.more ? '<span class="val go">&rsaquo;</span>' : '';
      // Justerbar rad uten verdi: pilene i hver kant som før
      const edge = arrows && it.value === undefined;
      return `<li data-i="${i}" class="${cls}">${edge ? '<b class="adj l">&lsaquo;</b>' : ''}<span class="lbl">${it.label}</span>${val}${edge ? '<b class="adj r">&rsaquo;</b>' : ''}</li>`;
    }).join('');
    // Forklaringen står i ett felt under menyen og følger valget
    const old = container.nextElementSibling as HTMLElement | null;
    this.hintEl = old?.classList.contains('menu-hint') ? old : null;
    if (items.some((it) => it.hint)) {
      if (!this.hintEl) {
        this.hintEl = document.createElement('p');
        this.hintEl.className = 'menu-hint';
        container.after(this.hintEl);
      }
    } else if (this.hintEl) {
      this.hintEl.remove();
      this.hintEl = null;
    }
    container.querySelectorAll('li').forEach((li) => {
      const i = Number((li as HTMLElement).dataset.i);
      li.addEventListener('mouseenter', () => this.select(i, false));
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        if (performance.now() - this.setAt < 150) return;
        this.select(i, false);
        const adj = (e.target as HTMLElement).closest('.adj');
        if (adj && this.items[i]?.adjust) {
          audio.menu();
          this.items[i].adjust!(adj.classList.contains('l') ? -1 : 1);
          return;
        }
        this.activate();
      });
    });
    // Første rad: ikke rull (lange sider som kontrollene skal åpne på toppen)
    this.select(sel, sel > 0);
  }

  /** Tegn bare menyen på nytt (samme skjerm), for eksempel når en verdi på tittelskjermen endres. */
  relist(items: Item[], sel = 0) {
    if (!this.list || !this.active) return false;
    const keep = this.setAt;
    this.menu(items, this.list, sel);
    this.setAt = keep;
    return true;
  }

  get selected() {
    return this.sel;
  }

  private select(i: number, scroll = true) {
    if (!this.items.length) return;
    this.sel = (i + this.items.length) % this.items.length;
    this.root.querySelectorAll('.menu li').forEach((li, k) => {
      li.classList.toggle('sel', k === this.sel);
      if (k === this.sel && scroll) (li as HTMLElement).scrollIntoView?.({ block: 'nearest' });
    });
    if (this.hintEl) this.hintEl.innerHTML = this.items[this.sel]?.hint ?? '';
  }

  private activate() {
    const it = this.items[this.sel];
    if (!it) return;
    if (it.disabled) {
      audio.denied();
      return;
    }
    audio.confirm();
    it.action();
  }

  title(items: Item[], muted: boolean, sel = 0) {
    this.set(`
      <div class="title-wrap">
        <div class="logo"><div class="l1">LOINCLOTH</div><div class="l2">LEGENDS</div></div>
        <div class="tag">BLOOD, BICEPS &amp; BAD DECISIONS</div>
        <ul class="menu"></ul>
        <div class="press">W/S + F &nbsp;|&nbsp; ARROWS + ENTER &nbsp;|&nbsp; GAMEPAD &nbsp;|&nbsp; TAP</div>
        <div class="foot">&copy; 1986 TOM'S HAPPY HAPPY FUNTIMES EMPORIUM &nbsp;&middot;&nbsp; NO GNOMES WERE HARMED. MOST GNOMES WERE HARMED.
        <br><span class="mute">M: SOUND ${muted ? 'OFF' : 'ON'}</span> &nbsp;&middot;&nbsp; P/ESC: PAUSE</div>
      </div>`, 'title');
    this.menu(items, this.root.querySelector('.menu')!, sel);
  }

  /**
   * Kontrollskjermen, én side om gangen så alt får plass uten å rulle: tastene, trekkene på brettene og trekkene i
   * duellene. `rows` (sidevalg, rumble, berøring) står over BACK.
   */
  controls(page: ControlsPage, rows: Item[], onBack: () => void, sel = 0) {
    const k = (...keys: string[]) => keys.map((x) => `<kbd>${x}</kbd>`).join('');
    const pad = (b: string) => `<kbd class="pad ${b.toLowerCase()}">${b}</kbd>`;
    const moves = (title: string, list: [string, string][], tips: string[] = []) => `
      <h3>${title}</h3>
      <dl class="moves">${list.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}${tips.map((t) => `<p class="tip">${t}</p>`).join('')}</dl>`;
    const body = page === 'keys'
      ? `<table class="keys">
          <tr><th></th><th>PLAYER 1</th><th>PLAYER 2</th><th>GAMEPAD</th></tr>
          <tr><td>MOVE</td><td>${k('W', 'A', 'S', 'D')}</td><td>${k('ARROWS')}</td><td>${k('STICK')}</td></tr>
          <tr><td>ATTACK</td><td>${k('F')} <i>OR</i> ${k('LEFT CLICK')}</td><td>${k(',')}</td><td>${pad('X')}</td></tr>
          <tr><td>JUMP</td><td>${k('G')}</td><td>${k('.')}</td><td>${pad('A')}</td></tr>
          <tr><td>SPECIAL / BLOCK</td><td>${k('H')}</td><td>${k('/')} <i>OR</i> ${k('-')}</td><td>${pad('B')}</td></tr>
          <tr><td>PAUSE</td><td colspan="2">${k('P')} <i>OR</i> ${k('ESC')}</td><td>${k('START')}</td></tr>
        </table>
        <p class="also">THREE BUTTONS. TO GRAB A FOE OR RIDE A BEAST, JUST WALK INTO IT.<br>ALSO WORKS: J K L FOR PLAYER 1 &middot; NUMPAD 1 2 3 FOR PLAYER 2 &middot; ALONE: ARROWS + Z X C &middot; PHONE: STICK LEFT, BUTTONS RIGHT</p>`
      : page === 'stages'
        ? moves("STAGES (BEAT 'EM UP)", [
          ['ATTACK x3', 'combo, the third hit floors them'],
          ['JUMP + ATTACK', 'jump attack'],
          ['DOUBLE-TAP', 'run, then ATTACK for a shoulder charge'],
          ['SPECIAL', 'magic, burns your blue potions'],
          ['NO POTIONS?', 'SPECIAL becomes a berserk spin (costs HP)'],
          ['WALK INTO A FOE', 'grab him, then ATTACK to knee him'],
          ['DIRECTION + ATTACK', 'throw the foe you are holding'],
          ['WALK INTO A MOUNT', 'ride it, DOWN + JUMP to hop off'],
        ], ['Throw foes into spikes, bogs, lava and gorges. Or bowl them into their friends.', 'Smack the little gnome for potions. Barrels hold food.'])
        : moves('DUELS (BARBARIAN STYLE)', [
          ['ATTACK', 'slash (mid)'],
          ['UP + ATTACK', 'overhead chop (high, heavy)'],
          ['DOWN + ATTACK', 'leg sweep (low, knocks down)'],
          ['TOWARD + ATTACK', 'kick, breaks blocks'],
          ['AWAY + ATTACK', 'whirlwind, 3 hits'],
          ['JUMP, THEN ATTACK', 'flying neck chop: <em>beheads</em> if it lands unblocked'],
          ['HOLD SPECIAL', 'block high, add DOWN to block low'],
          ['DOWN', 'duck, add JUMP to roll'],
        ]);
    this.set(`
      <div class="panel controls">
        <h2>CONTROLS</h2>
        <div class="ctl-page">${body}</div>
        <ul class="menu rows"></ul>
      </div>`, 'dim');
    this.menu([...rows, { label: 'BACK', action: onBack }], this.root.querySelector('.menu')!, sel);
    this.onBack = onBack;
  }

  intro(lines: string[], onDone: () => void) {
    this.set(`<div class="intro"><div class="intro-text"></div><div class="skip">F / ENTER / TAP: SKIP</div></div>`, 'black');
    const el = this.root.querySelector('.intro-text') as HTMLElement;
    this.typer = { lines, li: 0, ci: 0, t: 0, el, done: onDone, hold: 0 };
    this.onConfirm = () => {
      this.typer = null;
      onDone();
    };
  }

  cutscene(title: string, lines: [string, string][], onDone: () => void) {
    // Replikkene leses inn etter hverandre der det finnes innspilte stemmer (docs/STEMMER.md)
    audio.voice(lines.map(([, t]) => t));
    this.set(`<div class="cut"><h2>${title}</h2>${lines.map(([w, t]) => `<p><b>${w}:</b> ${t}</p>`).join('')}<div class="skip">F / ENTER / TAP: CONTINUE</div></div>`, 'dim');
    this.onConfirm = onDone;
  }

  victory(stats: Stats, lines: [string, string][], onDone: () => void) {
    this.set(`
      <div class="panel victory">
        <div class="big-title">VICTORY!</div>
        ${lines.map(([w, t]) => `<p class="line"><b>${w}:</b> ${t}</p>`).join('')}
        <div class="stats">
          <div><span>KILLS</span><b>${stats.kills}</b></div>
          <div><span>HEADS REMOVED</span><b>${stats.heads}</b></div>
          <div><span>GIBS PRODUCED</span><b>${stats.gibs}</b></div>
          <div><span>GOLD</span><b>${stats.gold}</b></div>
          <div><span>BEST STREAK</span><b>${stats.bestStreak}</b></div>
          <div><span>GNOME CRIMES</span><b>${stats.gnomeCrimes}</b></div>
          <div><span>BLOOD SPILLED</span><b>${Math.round(stats.gibs * 2.5 + stats.kills * 4.2)} L</b></div>
        </div>
        <div class="tbc">TO BE CONTINUED... <small>(IF FUNDING ALLOWS)</small></div>
        <ul class="menu"></ul>
      </div>`, 'dim');
    this.menu([{ label: 'CONTINUE', action: onDone }], this.root.querySelector('.menu')!);
  }

  result(title: string, sub: string, items: Item[], sel = 0, onBack?: () => void) {
    this.set(`<div class="panel result"><div class="big-title">${title}</div><p class="line">${sub}</p><ul class="menu"></ul></div>`, 'dim');
    this.menu(items, this.root.querySelector('.menu')!, sel);
    this.onBack = onBack ?? null;
  }

  /** Lydteksten nederst på tittelen (M slår lyden av og på). */
  setMuted(muted: boolean) {
    const el = this.root.querySelector('.foot .mute');
    if (el) el.textContent = 'M: SOUND ' + (muted ? 'OFF' : 'ON');
  }

  /** Fritt panel: html må inneholde en <ul class="menu">. Brukes av innstillinger, butikk og nivåer. */
  custom(html: string, items: Item[], sel = 0, onBack?: () => void) {
    this.set(html, 'dim');
    this.menu(items, this.root.querySelector('.menu')!, sel);
    this.onBack = onBack ?? null;
  }

  gameover(items: Item[], quip: string) {
    this.set(`<div class="panel gameover"><div class="big-title red">GAME OVER</div><p class="line">${quip}</p><ul class="menu"></ul></div>`, 'dim');
    this.menu(items, this.root.querySelector('.menu')!);
  }

  pause(items: Item[]) {
    this.set(`<div class="panel pause"><div class="big-title">PAUSED</div><p class="line">THE BARBARIAN IS HAVING A LITTLE SIT-DOWN.</p><ul class="menu"></ul></div>`, 'dim');
    this.menu(items, this.root.querySelector('.menu')!);
    this.onBack = items[0].action;
  }

  update(m: MenuIn, dt: number) {
    if (!this.active) return;
    if (this.typer) {
      const ty = this.typer;
      ty.t += dt;
      const cps = 42;
      while (ty.t > 1 / cps && ty.li < ty.lines.length) {
        ty.t -= 1 / cps;
        const line = ty.lines[ty.li];
        if (ty.ci === 0) {
          const p = document.createElement('p');
          ty.el.appendChild(p);
        }
        ty.ci++;
        const ps = ty.el.querySelectorAll('p');
        ps[ps.length - 1].textContent = line.slice(0, ty.ci);
        if (ty.ci % 3 === 0 && line[ty.ci - 1] !== ' ') audio.menu();
        if (ty.ci >= line.length) {
          ty.li++;
          ty.ci = 0;
          ty.t -= 0.35;
        }
      }
      if (ty.li >= ty.lines.length) {
        ty.hold += dt;
        if (ty.hold > 2.2) {
          this.typer = null;
          ty.done();
          return;
        }
      }
    }
    if (m.up) {
      this.select(this.sel - 1);
      audio.menu();
    }
    if (m.down) {
      this.select(this.sel + 1);
      audio.menu();
    }
    const it = this.items[this.sel];
    if ((m.left || m.right) && it?.adjust) {
      audio.menu();
      it.adjust(m.left ? -1 : 1);
      return;
    }
    if (m.confirm) {
      if (this.onConfirm) {
        const f = this.onConfirm;
        this.onConfirm = null;
        audio.confirm();
        f();
      } else this.activate();
      return;
    }
    if (m.back && this.onBack) this.onBack();
  }
}
