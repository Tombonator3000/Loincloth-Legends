// HUD i ren DOM: spillerpaneler, duell-bars, kunngjøringer, dialog.
import { headCanvas } from '../gfx/rig';
import type { CharId } from '../gfx/chars';
import type { Fighter } from '../game/fighter';

interface HeroLike { idx: number; cid: CharId; name: string; f: Fighter; lives: number; potions: number; gold: number }
interface SideLike { cid: CharId; name: string; human: boolean; tint?: [number, number, number] }

function portrait(cid: CharId, size = 72, flip = false, tint?: [number, number, number]) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * 2;
  cv.className = 'portrait';
  const c = cv.getContext('2d')!;
  const src = headCanvas(cid);
  const s = Math.min(cv.width / src.width, cv.height / src.height) * 1.25;
  const w = src.width * s, h = src.height * s;
  c.save();
  if (flip) {
    c.translate(cv.width, 0);
    c.scale(-1, 1);
  }
  c.drawImage(src, (cv.width - w) / 2, cv.height - h * 0.92, w, h);
  if (tint) {
    const to255 = (v: number) => Math.round(Math.min(1, v) * 255);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = `rgb(${to255(tint[0])},${to255(tint[1])},${to255(tint[2])})`;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(src, (cv.width - w) / 2, cv.height - h * 0.92, w, h);
  }
  c.restore();
  return cv;
}

export class HUD {
  root: HTMLDivElement;
  private top: HTMLDivElement;
  private ann: HTMLDivElement;
  private sayEl: HTMLDivElement;
  private goEl: HTMLDivElement;
  private streakEl: HTMLDivElement;
  private bossEl: HTMLDivElement;
  private bossFill: HTMLElement;
  private bossGhost: HTMLElement;
  private bossGhostV = 1;
  private panels: { hp: HTMLElement; ghost: HTMLElement; lives: HTMLElement; pots: HTMLElement; gold: HTMLElement; root: HTMLElement; lastPots: number; ghostV: number }[] = [];
  private duelEls: { hpA: HTMLElement; hpB: HTMLElement; gA: HTMLElement; gB: HTMLElement; pipsA: HTMLElement; pipsB: HTMLElement; timer: HTMLElement; gvA: number; gvB: number } | null = null;
  private annT = 0;
  private sayT = 0;
  private streakT = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    parent.appendChild(this.root);
    this.top = document.createElement('div');
    this.top.className = 'hud-top';
    this.ann = document.createElement('div');
    this.ann.className = 'announce';
    this.sayEl = document.createElement('div');
    this.sayEl.className = 'say';
    this.goEl = document.createElement('div');
    this.goEl.className = 'go';
    this.goEl.innerHTML = 'GO<span class="arrow"></span>';
    this.streakEl = document.createElement('div');
    this.streakEl.className = 'streak';
    this.bossEl = document.createElement('div');
    this.bossEl.className = 'bossbar';
    this.bossEl.innerHTML = '<div class="b-skull"></div><div class="b-info"><div class="b-name"></div><div class="bar big"><i class="ghost"></i><i class="fill"></i></div></div>';
    this.bossFill = this.bossEl.querySelector('.fill')!;
    this.bossGhost = this.bossEl.querySelector('.ghost')!;
    this.root.append(this.top, this.ann, this.sayEl, this.goEl, this.streakEl, this.bossEl);
    setInterval(() => this.tick(0.1), 100);
  }

  private tick(dt: number) {
    if (this.annT > 0) {
      this.annT -= dt;
      if (this.annT <= 0) this.ann.classList.remove('show');
    }
    if (this.sayT > 0) {
      this.sayT -= dt;
      if (this.sayT <= 0) this.sayEl.classList.remove('show');
    }
    if (this.streakT > 0) {
      this.streakT -= dt;
      if (this.streakT <= 0) this.streakEl.classList.remove('show');
    }
  }

  clear() {
    this.top.innerHTML = '';
    this.top.className = 'hud-top';
    this.panels = [];
    this.duelEls = null;
    this.ann.classList.remove('show');
    this.sayEl.classList.remove('show');
    this.goEl.classList.remove('show');
    this.streakEl.classList.remove('show');
    this.bossEl.classList.remove('show');
    this.annT = this.sayT = this.streakT = 0;
  }

  showBoss(name: string, title: string) {
    (this.bossEl.querySelector('.b-name') as HTMLElement).innerHTML = `${name}<small>${title}</small>`;
    this.bossGhostV = 1;
    this.bossFill.style.width = '100%';
    this.bossGhost.style.width = '100%';
    this.bossEl.classList.add('show');
  }

  updateBoss(v: number) {
    v = Math.max(0, v);
    this.bossFill.style.width = (v * 100).toFixed(1) + '%';
    this.bossGhostV = Math.max(v, this.bossGhostV - 0.006);
    this.bossGhost.style.width = (this.bossGhostV * 100).toFixed(1) + '%';
    this.bossFill.classList.toggle('low', v < 0.25);
  }

  hideBoss() {
    this.bossEl.classList.remove('show');
  }

  visible(v: boolean) {
    this.root.style.display = v ? '' : 'none';
  }

  showBrawler(heroes: HeroLike[]) {
    this.clear();
    this.top.classList.add('brawl');
    for (const h of heroes) {
      const el = document.createElement('div');
      el.className = 'pp p' + (h.idx + 1);
      el.appendChild(portrait(h.cid));
      const info = document.createElement('div');
      info.className = 'pinfo';
      info.innerHTML = `<div class="pname">${h.name} <span class="lives"></span></div>
        <div class="bar"><i class="ghost"></i><i class="fill"></i></div>
        <div class="row"><span class="pots"></span><span class="gold"></span></div>`;
      el.appendChild(info);
      this.top.appendChild(el);
      this.panels.push({
        root: el, hp: info.querySelector('.fill')!, ghost: info.querySelector('.ghost')!, lives: info.querySelector('.lives')!,
        pots: info.querySelector('.pots')!, gold: info.querySelector('.gold')!, lastPots: -1, ghostV: 1,
      });
    }
  }

  updateBrawler(heroes: HeroLike[]) {
    heroes.forEach((h, i) => {
      const p = this.panels[i];
      if (!p) return;
      const v = Math.max(0, h.f.hp / h.f.maxHp);
      p.hp.style.width = (v * 100).toFixed(1) + '%';
      p.ghostV = Math.max(v, p.ghostV - 0.01);
      p.ghost.style.width = (p.ghostV * 100).toFixed(1) + '%';
      p.hp.classList.toggle('low', v < 0.3);
      p.lives.textContent = 'x' + Math.max(0, h.lives + (h.f.alive ? 0 : 0));
      p.gold.textContent = 'G ' + h.gold;
      if (p.lastPots !== h.potions) {
        p.lastPots = h.potions;
        p.pots.innerHTML = Array.from({ length: 6 }, (_, k) => `<i class="pot${k < h.potions ? ' on' : ''}"></i>`).join('');
      }
      p.root.classList.toggle('dead', !h.f.alive);
    });
  }

  showDuel(a: SideLike, b: SideLike) {
    this.clear();
    this.top.classList.add('duel');
    const side = (s: SideLike, cls: string, flip: boolean) => {
      const el = document.createElement('div');
      el.className = 'dside ' + cls;
      el.appendChild(portrait(s.cid, 80, flip, s.tint));
      const info = document.createElement('div');
      info.className = 'dinfo';
      info.innerHTML = `<div class="dname">${s.name}${s.human ? '' : ' <small>CPU</small>'}</div><div class="bar big"><i class="ghost"></i><i class="fill"></i></div><div class="pips"></div>`;
      el.appendChild(info);
      return el;
    };
    const A = side(a, 'a', false);
    const B = side(b, 'b', true);
    const T = document.createElement('div');
    T.className = 'dtimer';
    this.top.append(A, T, B);
    this.duelEls = {
      hpA: A.querySelector('.fill')!, hpB: B.querySelector('.fill')!, gA: A.querySelector('.ghost')!, gB: B.querySelector('.ghost')!,
      pipsA: A.querySelector('.pips')!, pipsB: B.querySelector('.pips')!, timer: T, gvA: 1, gvB: 1,
    };
  }

  updateDuel(fa: Fighter, fb: Fighter, wins: number[], timer: number, round: number) {
    const d = this.duelEls;
    if (!d) return;
    const va = Math.max(0, fa.hp / fa.maxHp), vb = Math.max(0, fb.hp / fb.maxHp);
    d.hpA.style.width = (va * 100).toFixed(1) + '%';
    d.hpB.style.width = (vb * 100).toFixed(1) + '%';
    d.gvA = Math.max(va, d.gvA - 0.008);
    d.gvB = Math.max(vb, d.gvB - 0.008);
    d.gA.style.width = (d.gvA * 100).toFixed(1) + '%';
    d.gB.style.width = (d.gvB * 100).toFixed(1) + '%';
    d.hpA.classList.toggle('low', va < 0.3);
    d.hpB.classList.toggle('low', vb < 0.3);
    const pips = (n: number) => Array.from({ length: 2 }, (_, k) => `<i class="pip${k < n ? ' on' : ''}"></i>`).join('');
    const pa = pips(wins[0]), pb = pips(wins[1]);
    if (d.pipsA.innerHTML !== pa) d.pipsA.innerHTML = pa;
    if (d.pipsB.innerHTML !== pb) d.pipsB.innerHTML = pb;
    const t = String(Math.max(0, Math.ceil(timer)));
    if (d.timer.textContent !== t) d.timer.textContent = t;
    d.timer.classList.toggle('low', timer < 10);
    void round;
  }

  announce(text: string, cls = '', dur = 1.5, sub = '') {
    this.ann.className = 'announce ' + cls;
    this.ann.innerHTML = `<div class="a-main">${text}</div>${sub ? `<div class="a-sub">${sub}</div>` : ''}`;
    void this.ann.offsetWidth;
    this.ann.classList.add('show');
    this.annT = dur;
  }

  say(speaker: string, text: string, dur = 3) {
    this.sayEl.innerHTML = `<b>${speaker}</b><span>${text}</span>`;
    this.sayEl.classList.remove('show');
    void this.sayEl.offsetWidth;
    this.sayEl.classList.add('show');
    this.sayT = dur;
  }

  go(show: boolean) {
    this.goEl.classList.toggle('show', show);
  }

  streak(n: number, label: string) {
    this.streakEl.innerHTML = `<div class="s-n">${n} KILLS</div><div class="s-l">${label}</div>`;
    this.streakEl.classList.remove('show');
    void this.streakEl.offsetWidth;
    this.streakEl.classList.add('show');
    this.streakT = 2.2;
  }
}
