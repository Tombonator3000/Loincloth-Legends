// Heltebyggeren: felles pulje av malte deler, med den klassiske byggeren som reserve.
import * as THREE from 'three';
import type { Scene } from '../scene';
import type { Game } from '../game';
import { W } from '../../game/world';
import { Fighter } from '../../game/fighter';
import { HERO_ATK } from '../../game/attacks';
import { buildArena } from '../../gfx/env';
import { buildHeroDef, cloneHero, withHeroParts, HERO_OPTIONS, PRESETS, randomHero, randomName, type HeroConfig } from '../../gfx/chars/hero';
import { HERO_PARTS, HERO_PART_SLOTS, defaultHeroParts, findHeroPart, type HeroParts, type HeroPartSlot } from '../../data/hero-parts';
import { getOverride } from '../../gfx/assets';
import { registerChar } from '../../gfx/chars';
import { purgeChar } from '../../gfx/rig';
import { WEAPONS, scaleAttack } from '../../data/weapons';
import { PART_LOCKS } from '../../data/unlocks';
import { isUnlocked, writeSave } from '../save';
import { audio } from '../../core/audio';
import { pick } from '../../core/math';

type OptKey = keyof typeof HERO_OPTIONS;
type RowKey = OptKey | HeroPartSlot | 'builder' | 'name' | 'preset' | 'random' | 'done';
type Row = { k: RowKey; label: string };
const FIRST_ROWS: Row[] = [{ k: 'name', label: 'NAME' }, { k: 'builder', label: 'BUILDER' }];
const LAST_ROWS: Row[] = [
  { k: 'magic', label: 'MAGIC' }, { k: 'preset', label: 'PRESET' },
  { k: 'random', label: 'RANDOMIZE' }, { k: 'done', label: 'DONE' },
];
const PAINTED_ROWS: Row[] = [
  ...FIRST_ROWS,
  { k: 'head', label: 'HEAD' }, { k: 'torso', label: 'TORSO' },
  { k: 'arm', label: 'ARMS' }, { k: 'pelvis', label: 'LOINS' },
  { k: 'leg', label: 'LEGS' }, { k: 'weapon', label: 'WEAPON' },
  ...LAST_ROWS,
];
const CLASSIC_ROWS: Row[] = [
  ...FIRST_ROWS,
  { k: 'body', label: 'BODY' }, { k: 'skin', label: 'SKIN' },
  { k: 'face', label: 'FACE' }, { k: 'hair', label: 'HAIR' },
  { k: 'hairColor', label: 'HAIR COLOUR' }, { k: 'beard', label: 'BEARD' },
  { k: 'helmet', label: 'HEADGEAR' }, { k: 'torso', label: 'ARMOUR' },
  { k: 'pelvis', label: 'LOINS' }, { k: 'boots', label: 'LEGS' },
  { k: 'weapon', label: 'WEAPON' }, { k: 'cloth', label: 'CLOTH COLOUR' },
  ...LAST_ROWS,
];
const isPart = (key: string): key is HeroPartSlot => HERO_PART_SLOTS.includes(key as HeroPartSlot);
const optionCursor = (cfg: HeroConfig) => Object.fromEntries(Object.keys(HERO_OPTIONS).map((k) => [k, cfg[k as OptKey]]));

export class CreatorScene implements Scene {
  name = 'creator';
  el: HTMLDivElement;
  slot = 0;
  cfgs: HeroConfig[];
  cursor: Record<string, number>[];
  partCursor: Partial<HeroParts>[];
  private paintedDrafts: (HeroParts | undefined)[];
  private rows: Row[] = [];
  private poolKey = '';
  sel = 0;
  preview: Fighter | null = null;
  previewId = '';
  t = 0;
  presetIdx = 0;
  input!: HTMLInputElement;

  constructor(private game: Game, private slots: number[], private onDone: () => void, private onCancel: () => void = onDone) {
    this.slot = slots[0];
    this.cfgs = game.save.heroes.map(cloneHero);
    this.cursor = this.cfgs.map(optionCursor);
    this.partCursor = this.cfgs.map((c) => ({ ...c.parts }));
    this.paintedDrafts = this.cfgs.map((c) => c.parts ? { ...c.parts } : undefined);
    W.env = buildArena(W.scene, W.gore, 'pit');
    this.framePreview();
    game.hud.visible(false);
    game.screens.hide();
    audio.play('title');

    this.el = document.createElement('div');
    this.el.className = 'creator';
    this.el.innerHTML = `
      <div class="cr-head"><h2>HERO FORGE</h2><div class="cr-tabs"></div></div>
      <div class="cr-status"></div>
      <div class="cr-rows"></div>
      <div class="cr-pool" hidden></div>
      <div class="cr-info" aria-live="polite"></div>
      <div class="cr-footer"><div class="cr-help">W/S: PICK &nbsp; A/D: CHANGE<br>F/ENTER: OK &nbsp; ESC: CANCEL</div><div class="cr-actions"><div class="cr-done-slot"></div><button class="cr-cancel" type="button">CANCEL</button></div></div>`;
    game.app.appendChild(this.el);
    this.el.querySelector('.cr-cancel')!.addEventListener('click', () => this.cancel());
    const tabs = this.el.querySelector('.cr-tabs')!;
    for (const sl of slots) {
      const b = document.createElement('button');
      b.textContent = 'PLAYER ' + (sl + 1);
      b.dataset.slot = String(sl);
      b.addEventListener('click', () => this.setSlot(sl));
      tabs.appendChild(b);
    }
    this.sel = this.cfgs[this.slot].parts ? 2 : 0;
    this.setSlot(this.slot);
  }

  private available(slot: HeroPartSlot) {
    return HERO_PARTS[slot].filter((part) => getOverride(part.source, part.slot));
  }

  private unlocked(part: { unlock?: string }) {
    return !part.unlock || isUnlocked(this.game.save, part.unlock);
  }

  /** Manglende bildefiler tilbys aldri som malte deler. */
  private availableSet(cfg: HeroConfig, preferred = cfg.parts ?? defaultHeroParts(cfg.body)): HeroParts | undefined {
    const parts = { ...preferred };
    for (const slot of HERO_PART_SLOTS) {
      const choices = this.available(slot).filter((part) => this.unlocked(part));
      const part = choices.find((part) => part.id === preferred[slot]) ?? choices[0];
      if (!part) return undefined;
      parts[slot] = part.id;
    }
    return parts;
  }

  private syncCursors() {
    const cfg = this.cfgs[this.slot];
    this.cursor[this.slot] = optionCursor(cfg);
    this.partCursor[this.slot] = { ...cfg.parts };
  }

  private renderRows() {
    const nextRows = this.cfgs[this.slot].parts ? PAINTED_ROWS : CLASSIC_ROWS;
    if (this.rows === nextRows) return;
    const selected = this.rows[this.sel]?.k;
    this.rows = nextRows;
    if (selected) this.sel = Math.max(0, this.rows.findIndex((r) => r.k === selected));
    const rows = this.el.querySelector('.cr-rows')!;
    rows.replaceChildren();
    this.el.querySelector('.cr-done-slot')!.replaceChildren();
    this.rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'cr-row' + (['preset', 'random', 'done'].includes(r.k) ? ' action' : '');
      row.dataset.i = String(i);
      row.dataset.key = r.k;
      if (r.k === 'name') {
        row.innerHTML = `<span class="k">${r.label}</span><input id="hero-name" aria-label="Hero name" type="text" maxlength="24" autocomplete="off" spellcheck="false"><button class="dice" type="button" title="Random name">?</button>`;
      } else if (r.k === 'random' || r.k === 'done') {
        row.innerHTML = `<span class="k wide">${r.label}</span>`;
      } else {
        row.innerHTML = `<span class="k">${r.label}</span><button class="arr l" type="button" aria-label="Previous ${r.label.toLowerCase()}"></button><span class="v"></span><button class="arr r" type="button" aria-label="Next ${r.label.toLowerCase()}"></button>`;
        row.querySelector('.l')!.addEventListener('click', () => this.change(i, -1));
        row.querySelector('.r')!.addEventListener('click', () => this.change(i, 1));
      }
      row.addEventListener('mouseenter', () => this.select(i));
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button, input')) return;
        this.select(i);
        if (r.k === 'random' || r.k === 'done' || r.k === 'preset') this.activate();
      });
      if (r.k === 'done') this.el.querySelector('.cr-done-slot')!.appendChild(row);
      else rows.appendChild(row);
    });
    this.input = this.el.querySelector('#hero-name') as HTMLInputElement;
    this.input.addEventListener('input', () => {
      this.cfgs[this.slot] = { ...cloneHero(this.cfgs[this.slot]), name: this.input.value.toUpperCase().slice(0, 24) };
      this.input.value = this.cfgs[this.slot].name;
      this.refresh(false);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') this.input.blur();
      e.stopPropagation();
    });
    this.el.querySelector('.dice')!.addEventListener('click', () => {
      this.cfgs[this.slot] = { ...cloneHero(this.cfgs[this.slot]), name: randomName() };
      this.refresh(false);
      audio.menu();
    });
  }

  private setSlot(sl: number) {
    this.slot = sl;
    this.el.querySelectorAll('.cr-tabs button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.slot === String(sl)));
    this.refresh(true);
  }

  private select(i: number, scroll = false) {
    this.sel = (i + this.rows.length) % this.rows.length;
    this.el.querySelectorAll('.cr-row').forEach((r, k) => {
      r.classList.toggle('sel', k === this.sel);
      if (scroll && k === this.sel) r.scrollIntoView({ block: 'nearest' });
    });
    this.info();
    this.renderPool();
  }

  private change(i: number, d: number) {
    const r = this.rows[i];
    this.select(i);
    const cfg = this.cfgs[this.slot];
    if (r.k === 'builder') {
      if (cfg.parts) {
        this.paintedDrafts[this.slot] = { ...cfg.parts };
        const classic = cloneHero(cfg);
        delete classic.parts;
        this.cfgs[this.slot] = classic;
      } else {
        const parts = this.availableSet(cfg, this.paintedDrafts[this.slot] ?? defaultHeroParts(cfg.body));
        if (!parts) { this.info(); return; }
        this.cfgs[this.slot] = withHeroParts(cfg, parts);
      }
      this.syncCursors();
      audio.menu();
      this.refresh(true);
      return;
    }
    if (r.k === 'preset') {
      const names = Object.keys(PRESETS);
      this.presetIdx = (this.presetIdx + d + names.length) % names.length;
      this.refresh(false);
      audio.menu();
      return;
    }
    if (r.k === 'name' || r.k === 'random' || r.k === 'done') return;
    if (cfg.parts && isPart(r.k)) {
      const choices = this.available(r.k);
      if (!choices.length) return;
      const idx = choices.findIndex((part) => part.id === this.partCursor[this.slot][r.k as HeroPartSlot]);
      const next = idx < 0 ? (d > 0 ? 0 : choices.length - 1) : (idx + d + choices.length) % choices.length;
      this.choosePart(r.k, choices[next].id);
      return;
    }
    const k = r.k as OptKey;
    const cur = this.cursor[this.slot];
    cur[k] = ((cur[k] ?? 0) + d + HERO_OPTIONS[k].length) % HERO_OPTIONS[k].length;
    if (isUnlocked(this.game.save, k + ':' + cur[k])) this.cfgs[this.slot] = { ...cloneHero(cfg), [k]: cur[k] };
    audio.menu();
    this.refresh(true);
  }

  private choosePart(slot: HeroPartSlot, id: string) {
    const cfg = this.cfgs[this.slot];
    const part = this.available(slot).find((part) => part.id === id);
    if (!cfg.parts || !part) return;
    this.partCursor[this.slot][slot] = id;
    if (this.unlocked(part)) {
      this.cfgs[this.slot] = withHeroParts(cfg, { ...cfg.parts, [slot]: id });
      this.cursor[this.slot] = optionCursor(this.cfgs[this.slot]);
    }
    audio.menu();
    this.refresh(this.unlocked(part));
  }

  private activate() {
    const r = this.rows[this.sel];
    const cfg = this.cfgs[this.slot];
    if (r.k === 'name') {
      this.input.focus();
      this.input.select();
      return;
    }
    if (r.k === 'preset') {
      const name = Object.keys(PRESETS)[this.presetIdx];
      let preset = cloneHero(PRESETS[name]);
      const parts = this.availableSet(preset);
      if (parts) preset = withHeroParts(preset, parts);
      else delete preset.parts;
      this.cfgs[this.slot] = preset;
      this.syncCursors();
      audio.confirm();
      this.refresh(true);
      return;
    }
    if (r.k === 'random') {
      if (cfg.parts) {
        const parts = this.availableSet(cfg);
        if (!parts) return;
        for (const slot of HERO_PART_SLOTS) parts[slot] = pick(this.available(slot).filter((part) => this.unlocked(part))).id;
        this.cfgs[this.slot] = withHeroParts({ ...cloneHero(cfg), name: randomName(), magic: Math.floor(Math.random() * HERO_OPTIONS.magic.length) }, parts);
      } else this.cfgs[this.slot] = randomHero((k, i) => isUnlocked(this.game.save, k + ':' + i));
      this.syncCursors();
      audio.confirm();
      this.refresh(true);
      if (this.preview) this.preview.startAttack(HERO_ATK.chop);
      return;
    }
    if (r.k === 'done') {
      audio.confirm();
      const s = this.game.save;
      for (const sl of this.slots) {
        const c = cloneHero(this.cfgs[sl]);
        if (!c.name.trim()) c.name = randomName();
        s.heroes[sl] = c;
        s.heroMade[sl] = true;
      }
      writeSave(s);
      this.onDone();
      return;
    }
    this.change(this.sel, 1);
  }

  private cancel() {
    audio.menu();
    this.onCancel();
  }

  private info() {
    const r = this.rows[this.sel];
    const box = this.el.querySelector('.cr-info') as HTMLElement;
    const cfg = this.cfgs[this.slot];
    let html = '';
    if (r.k === 'weapon' || r.k === 'magic' || r.k === 'name' || r.k === 'body') {
      const w = WEAPONS[cfg.weapon];
      html = `<b>${w.name}</b> ${w.desc}<br><span class="st">DMG ${Math.round(w.dmg * 100)}% &nbsp; SPEED ${Math.round(w.speed * 100)}% &nbsp; REACH ${Math.round(w.reach * 100)}%</span>`;
    }
    if (r.k === 'builder') html = this.availableSet(cfg)
      ? 'PAINTED PARTS: mix the artwork. CLASSIC BUILDER: customise skin, hair and armour.'
      : 'Painted artwork is unavailable here. Use CLASSIC BUILDER to customise your hero.';
    else if (cfg.parts && isPart(r.k)) {
      const part = findHeroPart(r.k, this.partCursor[this.slot][r.k] ?? cfg.parts[r.k]);
      if (part && !this.unlocked(part)) html = `<b class="lock">LOCKED</b> ${PART_LOCKS[part.unlock!]}. Your equipped part stays on.`;
      else if (!part || !getOverride(part.source, part.slot)) html = 'This artwork did not load. Choose another part or switch to CLASSIC BUILDER.';
      else if (r.k !== 'weapon') html = r.k === 'head' ? 'Choose any head. Its hair follows automatically.' : 'Mix this part with any head, body, arms or legs in the pool.';
    } else if (r.k in HERO_OPTIONS) {
      const k = r.k as OptKey;
      const cur = this.cursor[this.slot][k];
      const lock = PART_LOCKS[k + ':' + cur];
      if (lock && !isUnlocked(this.game.save, k + ':' + cur)) html = `<b class="lock">LOCKED</b> ${HERO_OPTIONS[k][cur]}: ${lock}`;
    }
    if (r.k === 'preset') html = 'PRESS F OR TAP TO LOAD THE LEGENDARY HERO. THEN MAKE THEM YOUR OWN.';
    if (r.k === 'random') html = cfg.parts ? (this.availableSet(cfg) ? 'MIX A RANDOM SET OF YOUR UNLOCKED PAINTED PARTS.' : 'Painted artwork is unavailable. Switch to CLASSIC BUILDER to randomize.') : 'LET THE GODS OF CHAOS DRESS YOU.';
    if (r.k === 'done') html = 'SAVE AND GO FORTH. MOSTLY FORTH.';
    box.innerHTML = html;
  }

  private renderPool() {
    const box = this.el.querySelector('.cr-pool') as HTMLElement;
    const cfg = this.cfgs[this.slot];
    const r = this.rows[this.sel];
    if (!cfg.parts || !isPart(r.k)) { box.hidden = true; this.poolKey = ''; return; }
    box.hidden = false;
    const slot = r.k;
    const choices = this.available(slot);
    const key = [this.slot, slot, cfg.parts[slot], this.partCursor[this.slot][slot]].join(':');
    if (this.poolKey === key) return;
    this.poolKey = key;
    box.replaceChildren();
    const title = document.createElement('div');
    title.className = 'cr-pool-title';
    title.textContent = `${r.label} POOL · ${choices.length} PARTS`;
    box.appendChild(title);
    if (!choices.length) {
      const empty = document.createElement('div');
      empty.className = 'cr-pool-empty';
      empty.textContent = 'No painted parts loaded. CLASSIC BUILDER is still available.';
      box.appendChild(empty);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'cr-part-grid';
    for (const part of choices) {
      const ov = getOverride(part.source, part.slot)!;
      const locked = !this.unlocked(part);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cr-part' + (cfg.parts[slot] === part.id ? ' equipped' : '') + (locked ? ' locked' : '');
      b.dataset.part = part.id;
      b.setAttribute('aria-pressed', String(cfg.parts[slot] === part.id));
      b.setAttribute('aria-disabled', String(locked));
      b.title = locked ? `${part.label}: ${PART_LOCKS[part.unlock!]}` : part.label;
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 96;
      const scale = Math.min(112 / ov.canvas.width, 88 / ov.canvas.height);
      const w = ov.canvas.width * scale, h = ov.canvas.height * scale;
      canvas.getContext('2d')!.drawImage(ov.canvas, (120 - w) / 2, (96 - h) / 2, w, h);
      canvas.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = (locked ? 'LOCKED: ' : '') + part.label;
      b.append(canvas, label);
      b.addEventListener('click', () => this.choosePart(slot, part.id));
      grid.appendChild(b);
    }
    box.appendChild(grid);
  }

  private refresh(rebuild: boolean) {
    this.renderRows();
    const cfg = this.cfgs[this.slot];
    const cur = this.cursor[this.slot];
    this.el.classList.toggle('cr-painted', !!cfg.parts);
    const status = this.el.querySelector('.cr-status') as HTMLElement;
    const missing = cfg.parts && HERO_PART_SLOTS.some((slot) => {
      const part = findHeroPart(slot, cfg.parts![slot]);
      return !part || !getOverride(part.source, part.slot);
    });
    status.textContent = cfg.parts
      ? missing ? 'Some artwork did not load. Pick another part or use CLASSIC BUILDER.' : 'A SHARED POOL. YOUR OWN LEGEND.'
      : 'CLASSIC BUILDER · SKIN, HAIR & ARMOUR';
    status.classList.toggle('missing', !!missing);
    if (document.activeElement !== this.input) this.input.value = cfg.name;
    this.el.querySelectorAll('.cr-row').forEach((row, i) => {
      const r = this.rows[i];
      const v = row.querySelector('.v') as HTMLElement | null;
      if (!v) return;
      if (r.k === 'preset' || r.k === 'builder') {
        v.textContent = r.k === 'preset' ? Object.keys(PRESETS)[this.presetIdx].toUpperCase() : cfg.parts ? 'PAINTED PARTS' : 'CLASSIC BUILDER';
        return;
      }
      let locked = false;
      if (cfg.parts && isPart(r.k)) {
        const part = findHeroPart(r.k, this.partCursor[this.slot][r.k] ?? cfg.parts[r.k]);
        locked = !!part && !this.unlocked(part);
        v.textContent = !part || !getOverride(part.source, part.slot) ? 'ART UNAVAILABLE' : (locked ? 'LOCKED: ' : '') + part.label;
      } else {
        const k = r.k as OptKey;
        const idx = cur[k] ?? cfg[k];
        locked = !isUnlocked(this.game.save, k + ':' + idx);
        v.textContent = (locked ? 'LOCKED: ' : '') + HERO_OPTIONS[k][idx];
      }
      v.title = v.textContent ?? '';
      v.classList.toggle('locked', locked);
      row.classList.toggle('has-lock', locked);
    });
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
      if (m.up) { this.select(this.sel - 1, true); audio.menu(); }
      if (m.down) { this.select(this.sel + 1, true); audio.menu(); }
      if (m.left) this.change(this.sel, -1);
      if (m.right) this.change(this.sel, 1);
      if (m.confirm) this.activate();
      if (m.back) { this.cancel(); return; }
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
    this.framePreview();
  }

  private framePreview() {
    const c = this.game.camera;
    if (this.game.width <= 760 && this.game.height > this.game.width) {
      // Smale skjermer har smia nederst. Hele helten skal få plass over panelet.
      c.position.set(-1.1, 2.1, 9.7);
      c.lookAt(-1.1, -0.7, 0);
    } else {
      c.position.set(0.6 + Math.sin(W.time * 0.3) * 0.2, 2.1, 7.2);
      c.lookAt(0.6, 1.35, 0);
    }
  }

  exit() {
    this.el.remove();
    this.preview?.remove();
    void THREE;
  }
}
