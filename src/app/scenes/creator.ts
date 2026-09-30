// Heltebyggeren (Hero Forge): sett sammen din egen barbar fra deler, med 3D-forhåndsvisning.
import * as THREE from 'three';
import type { Scene } from '../scene';
import type { Game } from '../game';
import { W } from '../../game/world';
import { Fighter } from '../../game/fighter';
import { HERO_ATK } from '../../game/attacks';
import { buildArena } from '../../gfx/env';
import { buildHeroDef, HERO_OPTIONS, PRESETS, randomHero, randomName, type HeroConfig } from '../../gfx/chars/hero';
import { registerChar } from '../../gfx/chars';
import { purgeChar } from '../../gfx/rig';
import { WEAPONS, scaleAttack } from '../../data/weapons';
import { PART_LOCKS } from '../../data/unlocks';
import { isUnlocked, writeSave } from '../save';
import { audio } from '../../core/audio';
import { pick } from '../../core/math';

type OptKey = keyof typeof HERO_OPTIONS;
const ROWS: { k: OptKey | 'name' | 'preset' | 'random' | 'done'; label: string }[] = [
  { k: 'name', label: 'NAME' },
  { k: 'body', label: 'BODY' },
  { k: 'skin', label: 'SKIN' },
  { k: 'face', label: 'FACE' },
  { k: 'hair', label: 'HAIR' },
  { k: 'hairColor', label: 'HAIR COLOUR' },
  { k: 'beard', label: 'BEARD' },
  { k: 'helmet', label: 'HEADGEAR' },
  { k: 'torso', label: 'ARMOUR' },
  { k: 'pelvis', label: 'LOINS' },
  { k: 'boots', label: 'LEGS' },
  { k: 'weapon', label: 'WEAPON' },
  { k: 'cloth', label: 'CLOTH COLOUR' },
  { k: 'magic', label: 'MAGIC' },
  { k: 'preset', label: 'LEGENDARY PRESET' },
  { k: 'random', label: 'RANDOMIZE' },
  { k: 'done', label: 'DONE' },
];

export class CreatorScene implements Scene {
  name = 'creator';
  el: HTMLDivElement;
  slot = 0;
  cfgs: HeroConfig[];
  cursor: Record<string, number>[];
  sel = 0;
  preview: Fighter | null = null;
  previewId = '';
  t = 0;
  presetIdx = 0;
  input: HTMLInputElement;

  constructor(private game: Game, private slots: number[], private onDone: () => void) {
    this.slot = slots[0];
    const s = game.save;
    this.cfgs = s.heroes.map((h) => ({ ...h }));
    this.cursor = this.cfgs.map((c) => ({ ...c }) as unknown as Record<string, number>);
    W.env = buildArena(W.scene, W.gore, 'pit');
    game.camera.position.set(0.6, 2.1, 7.2);
    game.camera.lookAt(0.6, 1.35, 0);
    game.hud.visible(false);
    game.screens.hide();
    audio.play('title');

    this.el = document.createElement('div');
    this.el.className = 'creator';
    this.el.innerHTML = `
      <div class="cr-head"><h2>HERO FORGE</h2><div class="cr-tabs"></div></div>
      <div class="cr-rows"></div>
      <div class="cr-info"></div>
      <div class="cr-help">W/S: PICK &nbsp; A/D: CHANGE &nbsp; F/ENTER: OK</div>`;
    game.app.appendChild(this.el);
    const tabs = this.el.querySelector('.cr-tabs')!;
    for (const sl of slots) {
      const b = document.createElement('button');
      b.textContent = 'PLAYER ' + (sl + 1);
      b.dataset.slot = String(sl);
      b.addEventListener('click', () => this.setSlot(sl));
      tabs.appendChild(b);
    }
    const rows = this.el.querySelector('.cr-rows')!;
    ROWS.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'cr-row' + (['preset', 'random', 'done'].includes(r.k) ? ' action' : '');
      row.dataset.i = String(i);
      if (r.k === 'name') {
        row.innerHTML = `<span class="k">${r.label}</span><input id="hero-name" type="text" maxlength="24" autocomplete="off" spellcheck="false"><button class="dice" type="button" title="Random name">?</button>`;
      } else if (r.k === 'random' || r.k === 'done') {
        row.innerHTML = `<span class="k wide">${r.label}</span>`;
      } else {
        row.innerHTML = `<span class="k">${r.label}</span><button class="arr l" type="button" aria-label="Previous"></button><span class="v"></span><button class="arr r" type="button" aria-label="Next"></button>`;
        row.querySelector('.l')!.addEventListener('click', () => this.change(i, -1));
        row.querySelector('.r')!.addEventListener('click', () => this.change(i, 1));
      }
      row.addEventListener('mouseenter', () => this.select(i));
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;
        this.select(i);
        if (r.k === 'random' || r.k === 'done' || r.k === 'preset') this.activate();
      });
      rows.appendChild(row);
    });
    this.input = this.el.querySelector('#hero-name') as HTMLInputElement;
    this.input.addEventListener('input', () => {
      this.cfgs[this.slot].name = this.input.value.toUpperCase().slice(0, 24);
      this.input.value = this.cfgs[this.slot].name;
      this.refresh(false);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') this.input.blur();
      e.stopPropagation();
    });
    this.el.querySelector('.dice')!.addEventListener('click', () => {
      this.cfgs[this.slot].name = randomName();
      this.refresh(false);
      audio.menu();
    });
    this.setSlot(this.slot);
  }

  private setSlot(sl: number) {
    this.slot = sl;
    this.el.querySelectorAll('.cr-tabs button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.slot === String(sl)));
    this.refresh(true);
  }

  private select(i: number) {
    this.sel = (i + ROWS.length) % ROWS.length;
    this.el.querySelectorAll('.cr-row').forEach((r, k) => r.classList.toggle('sel', k === this.sel));
    this.info();
  }

  private change(i: number, d: number) {
    const r = ROWS[i];
    this.select(i);
    if (r.k === 'preset') {
      const names = Object.keys(PRESETS);
      this.presetIdx = (this.presetIdx + d + names.length) % names.length;
      this.refresh(false);
      audio.menu();
      return;
    }
    if (r.k === 'name' || r.k === 'random' || r.k === 'done') return;
    const k = r.k;
    const n = HERO_OPTIONS[k].length;
    const cur = this.cursor[this.slot];
    cur[k] = ((cur[k] ?? 0) + d + n) % n;
    if (isUnlocked(this.game.save, k + ':' + cur[k])) this.cfgs[this.slot][k] = cur[k];
    audio.menu();
    this.refresh(true);
  }

  private activate() {
    const r = ROWS[this.sel];
    if (r.k === 'name') {
      this.input.focus();
      this.input.select();
      return;
    }
    if (r.k === 'preset') {
      const name = Object.keys(PRESETS)[this.presetIdx];
      this.cfgs[this.slot] = { ...PRESETS[name] };
      this.cursor[this.slot] = { ...this.cfgs[this.slot] } as unknown as Record<string, number>;
      audio.confirm();
      this.refresh(true);
      return;
    }
    if (r.k === 'random') {
      this.cfgs[this.slot] = randomHero((k, i) => isUnlocked(this.game.save, k + ':' + i));
      this.cursor[this.slot] = { ...this.cfgs[this.slot] } as unknown as Record<string, number>;
      audio.confirm();
      this.refresh(true);
      if (this.preview) this.preview.startAttack(HERO_ATK.chop);
      return;
    }
    if (r.k === 'done') {
      audio.confirm();
      const s = this.game.save;
      for (const sl of this.slots) {
        const c = this.cfgs[sl];
        if (!c.name.trim()) c.name = randomName();
        s.heroes[sl] = { ...c };
        s.heroMade[sl] = true;
      }
      writeSave(s);
      this.onDone();
      return;
    }
    this.change(this.sel, 1);
  }

  private info() {
    const r = ROWS[this.sel];
    const box = this.el.querySelector('.cr-info') as HTMLElement;
    const cfg = this.cfgs[this.slot];
    let html = '';
    if (r.k === 'weapon' || r.k === 'magic' || r.k === 'name' || r.k === 'body') {
      const w = WEAPONS[cfg.weapon];
      html = `<b>${w.name}</b> ${w.desc}<br><span class="st">DMG ${Math.round(w.dmg * 100)}% &nbsp; SPEED ${Math.round(w.speed * 100)}% &nbsp; REACH ${Math.round(w.reach * 100)}%</span>`;
    }
    if (r.k !== 'name' && r.k !== 'preset' && r.k !== 'random' && r.k !== 'done') {
      const cur = this.cursor[this.slot][r.k];
      const lock = PART_LOCKS[r.k + ':' + cur];
      if (lock && !isUnlocked(this.game.save, r.k + ':' + cur)) html = `<b class="lock">LOCKED</b> ${HERO_OPTIONS[r.k][cur]}: ${lock}`;
    }
    if (r.k === 'preset') html = 'PRESS F TO LOAD THE LEGENDARY HERO. THEN MAKE THEM YOUR OWN.';
    if (r.k === 'random') html = 'LET THE GODS OF CHAOS DRESS YOU.';
    if (r.k === 'done') html = 'SAVE AND GO FORTH. MOSTLY FORTH.';
    box.innerHTML = html;
  }

  private refresh(rebuild: boolean) {
    const cfg = this.cfgs[this.slot];
    const cur = this.cursor[this.slot];
    if (document.activeElement !== this.input) this.input.value = cfg.name;
    this.el.querySelectorAll('.cr-row').forEach((row, i) => {
      const r = ROWS[i];
      const v = row.querySelector('.v') as HTMLElement | null;
      if (!v) return;
      if (r.k === 'preset') {
        v.textContent = Object.keys(PRESETS)[this.presetIdx].toUpperCase();
        return;
      }
      const k = r.k as OptKey;
      const idx = cur[k] ?? cfg[k];
      const locked = !isUnlocked(this.game.save, k + ':' + idx);
      v.textContent = (locked ? 'LOCKED: ' : '') + HERO_OPTIONS[k][idx];
      v.classList.toggle('locked', locked);
      row.classList.toggle('has-lock', locked);
    });
    this.info();
    this.select(this.sel);
    if (rebuild) this.rebuild();
  }

  private rebuild() {
    const def = buildHeroDef(this.cfgs[this.slot], 9 + this.slot);
    if (def.id === this.previewId && this.preview) return;
    const oldId = this.previewId;
    this.preview?.remove();
    registerChar(def);
    this.previewId = def.id;
    const f = new Fighter(def.id, 'hero', { hp: 100, speed: 3, weapon: WEAPONS[this.cfgs[this.slot].weapon] });
    f.pos.set(-1.1, 0, 0.5);
    f.facing = 1;
    f.addTo(W.scene);
    f.rig.snap({});
    this.preview = f;
    if (oldId && oldId !== def.id) purgeChar(oldId);
    this.t = 0;
  }

  update(dt: number) {
    const inp = this.game.input;
    this.t += dt;
    if (document.activeElement !== this.input) {
      const m = inp.menu;
      if (m.up) {
        this.select(this.sel - 1);
        audio.menu();
      }
      if (m.down) {
        this.select(this.sel + 1);
        audio.menu();
      }
      if (m.left) this.change(this.sel, -1);
      if (m.right) this.change(this.sel, 1);
      if (m.confirm) this.activate();
      if (m.back) {
        audio.menu();
        this.onDone();
        return;
      }
    }
    const f = this.preview;
    if (f) {
      if (this.t > 3.2 && f.canAct()) {
        this.t = 0;
        const w = WEAPONS[this.cfgs[this.slot].weapon];
        f.startAttack(scaleAttack(pick([HERO_ATK.slash1, HERO_ATK.chop, HERO_ATK.slash2]), w));
      }
      f.update(dt, { minX: -3, maxX: 3, minZ: -1, maxZ: 1 });
    }
    const c = this.game.camera;
    c.position.set(0.6 + Math.sin(W.time * 0.3) * 0.2, 2.1, 7.2);
    c.lookAt(0.6, 1.35, 0);
  }

  exit() {
    this.el.remove();
    this.preview?.remove();
    void THREE;
  }
}
