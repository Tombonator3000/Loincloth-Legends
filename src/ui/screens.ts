// Fullskjerms-menyer: tittel, kontroller, intro-tekst, seier, game over, pause.
import { audio } from '../core/audio';
import type { Stats } from '../game/world';

export type Item = { label: string; action: () => void; hint?: string; adjust?: (dir: number) => void; disabled?: boolean };
type MenuIn = { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; back: boolean };

export class Screens {
  root: HTMLDivElement;
  private items: Item[] = [];
  private sel = 0;
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
    container.innerHTML = items
      .map((it, i) => `<li data-i="${i}" class="${it.disabled ? 'off' : ''}${it.adjust ? ' has-adj' : ''}">${it.adjust ? '<b class="adj l">&lsaquo;</b>' : ''}${it.label}${it.adjust ? '<b class="adj r">&rsaquo;</b>' : ''}${it.hint ? `<small>${it.hint}</small>` : ''}</li>`)
      .join('');
    container.querySelectorAll('li').forEach((li) => {
      const i = Number((li as HTMLElement).dataset.i);
      li.addEventListener('mouseenter', () => this.select(i));
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        if (performance.now() - this.setAt < 150) return;
        this.select(i);
        const adj = (e.target as HTMLElement).closest('.adj');
        if (adj && this.items[i]?.adjust) {
          audio.menu();
          this.items[i].adjust!(adj.classList.contains('l') ? -1 : 1);
          return;
        }
        this.activate();
      });
    });
    this.select(sel);
  }

  get selected() {
    return this.sel;
  }

  private select(i: number) {
    if (!this.items.length) return;
    this.sel = (i + this.items.length) % this.items.length;
    this.root.querySelectorAll('.menu li').forEach((li, k) => {
      li.classList.toggle('sel', k === this.sel);
      if (k === this.sel) (li as HTMLElement).scrollIntoView?.({ block: 'nearest' });
    });
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

  title(items: Item[], muted: boolean) {
    this.set(`
      <div class="title-wrap">
        <div class="logo"><div class="l1">LOINCLOTH</div><div class="l2">LEGENDS</div></div>
        <div class="tag">BLOOD, BICEPS &amp; BAD DECISIONS</div>
        <ul class="menu"></ul>
        <div class="press">W/S + F &nbsp;|&nbsp; ARROWS + ENTER &nbsp;|&nbsp; GAMEPAD &nbsp;|&nbsp; TAP</div>
        <div class="foot">&copy; 1986 TOM'S HAPPY HAPPY FUNTIMES EMPORIUM &nbsp;&middot;&nbsp; NO GNOMES WERE HARMED. MOST GNOMES WERE HARMED.
        <br>M: SOUND ${muted ? 'OFF' : 'ON'} &nbsp;&middot;&nbsp; P/ESC: PAUSE</div>
      </div>`, 'title');
    this.menu(items, this.root.querySelector('.menu')!);
  }

  controls(onBack: () => void) {
    this.set(`
      <div class="panel controls">
        <h2>CONTROLS</h2>
        <table>
          <tr><th></th><th>PLAYER 1</th><th>PLAYER 2</th><th>GAMEPAD</th></tr>
          <tr><td>MOVE</td><td>W A S D</td><td>ARROW KEYS</td><td>STICK / D-PAD</td></tr>
          <tr><td>ATTACK</td><td>F (or J)</td><td>, &nbsp;(or NUMPAD 1)</td><td>X / RT</td></tr>
          <tr><td>JUMP</td><td>G (or K)</td><td>. &nbsp;(or NUMPAD 2)</td><td>A</td></tr>
          <tr><td>SPECIAL / BLOCK</td><td>H (or L)</td><td>- &nbsp;(or NUMPAD 3)</td><td>B / LB / LT</td></tr>
          <tr><td>GRAB / THROW / RIDE</td><td>R (or U)</td><td>R.SHIFT (or NUMPAD 0)</td><td>Y / RB</td></tr>
          <tr><td>PAUSE</td><td colspan="2">P / ESC</td><td>START</td></tr>
        </table>
        <div class="cols">
          <div>
            <h3>STAGES (BEAT 'EM UP)</h3>
            <p><b>ATTACK x3</b> combo, the third hit floors them</p>
            <p><b>JUMP + ATTACK</b> jump attack</p>
            <p><b>DOUBLE-TAP</b> run, <b>RUN + ATTACK</b> shoulder charge</p>
            <p><b>SPECIAL</b> magic (burns all your blue potions)</p>
            <p><b>SPECIAL with no potions</b> berserk spin (costs a little HP)</p>
            <p><b>GRAB</b> seize a foe: <b>ATTACK</b> knee, <b>DIRECTION + ATTACK</b> or <b>JUMP</b> throw</p>
            <p>Throw foes into spikes, bogs, ice holes, lava and gorges. Or bowl them into their friends.</p>
            <p><b>GRAB</b> by a free mount: saddle up. <b>ATTACK</b> the beast's attack, <b>GRAB</b> hop off</p>
            <p>Smack the little gnome for potions. Barrels hold food.</p>
          </div>
          <div>
            <h3>DUELS (BARBARIAN STYLE)</h3>
            <p><b>ATTACK</b> slash (mid)</p>
            <p><b>UP + ATTACK</b> overhead chop (high, heavy)</p>
            <p><b>DOWN + ATTACK</b> leg sweep (low, knocks down)</p>
            <p><b>TOWARD + ATTACK</b> kick (breaks blocks)</p>
            <p><b>AWAY + ATTACK</b> whirlwind (3 hits)</p>
            <p><b>JUMP, then ATTACK</b> flying neck chop: <em>beheads</em> if it lands unblocked</p>
            <p><b>HOLD SPECIAL</b> block high, <b>+ DOWN</b> block low. <b>DOWN</b> alone = duck</p>
            <p><b>DOWN + JUMP</b> or <b>GRAB</b> roll</p>
            <p><b>TOUCH</b> stick on the left, buttons on the right</p>
          </div>
        </div>
        <ul class="menu"></ul>
      </div>`, 'dim');
    this.menu([{ label: 'BACK', action: onBack }], this.root.querySelector('.menu')!);
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

  result(title: string, sub: string, items: Item[], sel = 0) {
    this.set(`<div class="panel result"><div class="big-title">${title}</div><p class="line">${sub}</p><ul class="menu"></ul></div>`, 'dim');
    this.menu(items, this.root.querySelector('.menu')!, sel);
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
