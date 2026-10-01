// Heltebyggeren: felles pulje av malte deler, med den klassiske byggeren som reserve.
import * as THREE from 'three';
import type { Scene } from '../scene';
import type { Game } from '../game';
import { W } from '../../game/world';
import { Fighter } from '../../game/fighter';
import { HERO_ATK } from '../../game/attacks';
import { buildArena } from '../../gfx/env';
import { buildHeroDef, cloneHero, withHeroParts, withHeroAppearance, withClassRules, HERO_OPTIONS, PRESETS, randomHero, randomName, type HeroConfig } from '../../gfx/chars/hero';
import { HERO_PARTS, HERO_PART_SLOTS, defaultHeroParts, findHeroPart, isModularHeroHead, type HeroParts, type HeroPartSlot } from '../../data/hero-parts';
import { getOverride } from '../../gfx/assets';
import { HERO_APPEARANCE, defaultHeroAppearance, findHeroAppearance, type HeroAppearance, type HeroAppearanceKey } from '../../data/hero-appearance';
import { heroAppearanceAvailable, heroHeadPreview, heroSkinSupport } from '../../gfx/hero-appearance';
import { registerChar } from '../../gfx/chars';
import { purgeChar } from '../../gfx/rig';
import { scaleAttack } from '../../data/weapons';
import { PART_LOCKS } from '../../data/unlocks';
import { SPELLS, spellAt, spellIndex } from '../../data/spells';
import { CLASSES, GEAR, ABILITIES, GM_LINES, classAt, heroWeapon, roll3d6, abilityMod, abilityEffects } from '../../data/classes';
import { dressHero } from '../../game/hero';
import { isUnlocked, writeSave } from '../save';
import { audio } from '../../core/audio';
import { pick, chance } from '../../core/math';

type OptKey = keyof typeof HERO_OPTIONS;
type AppearanceRowKey = `appearance:${HeroAppearanceKey}`;
type EditorPage = 'parts' | 'head';
type RowKey = OptKey | HeroPartSlot | AppearanceRowKey | 'builder' | 'editor' | 'name' | 'preset' | 'random' | 'roll' | 'done';
type Row = { k: RowKey; label: string };
const FIRST_ROWS: Row[] = [{ k: 'name', label: 'NAME' }, { k: 'builder', label: 'BUILDER' }];
/** Klassen bestemmer våpen, magi og egenskaper (data/classes.ts). Utseendet er fritt. */
const CLASS_ROW: Row = { k: 'cls', label: 'CLASS' };
const LAST_ROWS: Row[] = [
  { k: 'magic', label: 'MAGIC' }, { k: 'roll', label: 'ROLL 3D6' }, { k: 'preset', label: 'PRESET' },
  { k: 'random', label: 'RANDOMIZE' }, { k: 'done', label: 'DONE' },
];
/** Rader som gjør noe når de velges, i stedet for å bla i valg. */
const ACTIONS: string[] = ['preset', 'random', 'roll', 'done'];
const PAINTED_FIRST_ROWS: Row[] = [...FIRST_ROWS, { k: 'editor', label: 'EDIT' }];
const HEAD_DETAIL_ROWS: Row[] = [
  { k: 'appearance:hair', label: 'HAIR' }, { k: 'appearance:hairColor', label: 'HAIR COLOUR' },
  { k: 'appearance:beard', label: 'BEARD' }, { k: 'appearance:headgear', label: 'HEADGEAR' },
  { k: 'appearance:eyeStyle', label: 'EYES' }, { k: 'appearance:eyeColor', label: 'EYE COLOUR' },
];
const appearanceKey = (key: RowKey): HeroAppearanceKey | undefined => key.startsWith('appearance:') ? key.slice(11) as HeroAppearanceKey : undefined;
const PAINTED_ROWS: Row[] = [
  ...PAINTED_FIRST_ROWS, CLASS_ROW,
  { k: 'head', label: 'HEAD' }, { k: 'torso', label: 'TORSO' },
  { k: 'arm', label: 'ARMS' }, { k: 'pelvis', label: 'LOINS' },
  { k: 'leg', label: 'LEGS' }, { k: 'weapon', label: 'WEAPON' },
  ...LAST_ROWS,
];
const CLASSIC_ROWS: Row[] = [
  ...FIRST_ROWS, CLASS_ROW,
  { k: 'body', label: 'BODY' }, { k: 'skin', label: 'SKIN' },
  { k: 'face', label: 'FACE' }, { k: 'hair', label: 'HAIR' },
  { k: 'hairColor', label: 'HAIR COLOUR' }, { k: 'beard', label: 'BEARD' },
  { k: 'helmet', label: 'HEADGEAR' }, { k: 'torso', label: 'ARMOUR' },
  { k: 'pelvis', label: 'LOINS' }, { k: 'boots', label: 'LEGS' },
  { k: 'weapon', label: 'WEAPON' }, { k: 'cloth', label: 'CLOTH COLOUR' },
  ...LAST_ROWS,
];
const isPart = (key: string): key is HeroPartSlot => HERO_PART_SLOTS.includes(key as HeroPartSlot);
const optionCursor = (cfg: HeroConfig) => Object.fromEntries(Object.keys(HERO_OPTIONS).map((k) => [k, cfg[k as OptKey] ?? 0]));

export class CreatorScene implements Scene {
  name = 'creator';
  el: HTMLDivElement;
  slot = 0;
  cfgs: HeroConfig[];
  cursor: Record<string, number>[];
  partCursor: Partial<HeroParts>[];
  private paintedDrafts: (HeroParts | undefined)[];
  private appearanceDrafts: (HeroAppearance | undefined)[];
  private appearanceCursor: HeroAppearance[];
  private pages: EditorPage[];
  private rows: Row[] = [];
  private rowsSignature = '';
  private poolKey = '';
  sel = 0;
  preview: Fighter | null = null;
  previewId = '';
  t = 0;
  presetIdx = 0;
  input!: HTMLInputElement;
  /** ROLL 3D6: hvor mange ganger hver spiller har kastet, og det spillederen sa sist. */
  private rolls = [0, 0];
  private gm = ['', ''];

  constructor(private game: Game, private slots: number[], private onDone: () => void, private onCancel: () => void = onDone) {
    this.slot = slots[0];
    this.cfgs = game.save.heroes.map(cloneHero);
    this.cursor = this.cfgs.map(optionCursor);
    this.partCursor = this.cfgs.map((c) => ({ ...c.parts }));
    this.paintedDrafts = this.cfgs.map((c) => c.parts ? { ...c.parts } : undefined);
    this.appearanceDrafts = this.cfgs.map((c) => c.appearance ? { ...c.appearance } : undefined);
    this.appearanceCursor = this.cfgs.map((c) => ({ ...this.appearance(c) }));
    this.pages = this.cfgs.map((c) => c.parts && isModularHeroHead(c.parts.head) ? 'head' : 'parts');
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
      <div class="cr-pages" aria-label="Hero editor pages"><button type="button" data-page="parts">HERO PARTS</button><button type="button" data-page="head">HEAD DETAILS</button></div>
      <div class="cr-custom-head" hidden><p>Hair and headgear are painted into this head. Choose a custom head to edit them.</p><div><button type="button" data-head="forge_custom_m_head">CUSTOM MALE</button><button type="button" data-head="forge_custom_f_head">CUSTOM FEMALE</button></div></div>
      <div class="cr-rows"></div>
      <div class="cr-pool" hidden></div>
      <div class="cr-info" aria-live="polite"></div>
      <div class="cr-footer"><div class="cr-help">W/S: PICK &nbsp; A/D: CHANGE<br>F/ENTER: OK &nbsp; ESC: CANCEL</div><div class="cr-actions"><div class="cr-done-slot"></div><button class="cr-cancel" type="button">CANCEL</button></div></div>`;
    game.app.appendChild(this.el);
    this.el.querySelector('.cr-cancel')!.addEventListener('click', () => this.cancel());
    this.el.querySelectorAll<HTMLButtonElement>('.cr-pages button').forEach((b) => b.addEventListener('click', () => this.setPage(b.dataset.page as EditorPage)));
    this.el.querySelectorAll<HTMLButtonElement>('.cr-custom-head button').forEach((b) => b.addEventListener('click', () => this.choosePart('head', b.dataset.head!)));
    const tabs = this.el.querySelector('.cr-tabs')!;
    for (const sl of slots) {
      const b = document.createElement('button');
      b.textContent = 'PLAYER ' + (sl + 1);
      b.dataset.slot = String(sl);
      b.addEventListener('click', () => this.setSlot(sl));
      tabs.appendChild(b);
    }
    this.sel = this.cfgs[this.slot].parts ? PAINTED_ROWS.findIndex((r) => r.k === 'head') : 0;
    this.setSlot(this.slot);
  }

  private appearance(cfg = this.cfgs[this.slot]): HeroAppearance {
    return cfg.appearance ?? defaultHeroAppearance();
  }

  private skinSupport() {
    return heroSkinSupport(buildHeroDef(this.cfgs[this.slot], 9 + this.slot));
  }

  private setPage(page: EditorPage) {
    if (!this.cfgs[this.slot].parts) return;
    this.pages[this.slot] = page;
    this.refresh(false);
    const headRow = this.rows.findIndex((r) => r.k === 'head');
    if (headRow >= 0) this.select(headRow, true);
    audio.menu();
  }

  private available(slot: HeroPartSlot, cls = classAt(this.cfgs[this.slot]?.cls)) {
    const list = HERO_PARTS[slot].filter((part) => getOverride(part.source, part.slot));
    // Klassen bestemmer våpenet: bare de den kan bruke. Med eget utstyr vises ikke det malte våpenet i det hele tatt
    if (slot === 'weapon' && !cls.gear) return list.filter((part) => part.weapon !== undefined && cls.weapons.includes(part.weapon));
    return list;
  }

  /** Klassens regler for våpen og magi, med det som er låst opp. */
  private classRules(cfg: HeroConfig) {
    return withClassRules(cfg, (key) => isUnlocked(this.game.save, key));
  }

  private unlocked(part: { unlock?: string }) {
    return !part.unlock || isUnlocked(this.game.save, part.unlock);
  }

  /** Manglende bildefiler tilbys aldri som malte deler. */
  private availableSet(cfg: HeroConfig, preferred = cfg.parts ?? defaultHeroParts(cfg.body)): HeroParts | undefined {
    const parts = { ...preferred };
    for (const slot of HERO_PART_SLOTS) {
      const choices = this.available(slot, classAt(cfg.cls)).filter((part) => this.unlocked(part));
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
    this.appearanceCursor[this.slot] = { ...this.appearance(cfg) };
  }

  private renderRows() {
    const cfg = this.cfgs[this.slot];
    let nextRows = cfg.parts ? PAINTED_ROWS : CLASSIC_ROWS;
    if (cfg.parts && this.pages[this.slot] === 'head') {
      nextRows = [...PAINTED_FIRST_ROWS, { k: 'head', label: 'HEAD' }];
      if (this.skinSupport().supported.length) nextRows.push({ k: 'appearance:skinTone', label: 'SKIN COLOUR' });
      if (isModularHeroHead(cfg.parts.head)) nextRows.push(...HEAD_DETAIL_ROWS);
      nextRows.push({ k: 'done', label: 'DONE' });
    }
    const signature = nextRows.map((r) => r.k).join('|');
    if (this.rowsSignature === signature) return;
    this.rowsSignature = signature;
    const selected = this.rows[this.sel]?.k;
    this.rows = nextRows;
    if (selected) this.sel = Math.max(0, this.rows.findIndex((r) => r.k === selected));
    const rows = this.el.querySelector('.cr-rows')!;
    rows.replaceChildren();
    this.el.querySelector('.cr-done-slot')!.replaceChildren();
    this.rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'cr-row' + (ACTIONS.includes(r.k) ? ' action' : '');
      row.dataset.i = String(i);
      row.dataset.key = r.k;
      if (r.k === 'name') {
        row.innerHTML = `<span class="k">${r.label}</span><input id="hero-name" aria-label="Hero name" type="text" maxlength="24" autocomplete="off" spellcheck="false"><button class="dice" type="button" title="Random name">?</button>`;
      } else if (r.k === 'random' || r.k === 'done' || r.k === 'roll') {
        row.innerHTML = `<span class="k wide">${r.label}</span>`;
      } else {
        row.innerHTML = `<span class="k">${r.label}</span><button class="arr l" type="button" aria-label="Previous ${r.label.toLowerCase()}"></button><span class="v"></span><button class="arr r" type="button" aria-label="Next ${r.label.toLowerCase()}"></button>`;
        row.querySelector('.l')!.addEventListener('click', () => this.change(i, -1));
        row.querySelector('.r')!.addEventListener('click', () => this.change(i, 1));
      }
      // En endret korthøyde kan flytte rader under en stillestående peker.
      // Bare virkelig pekerbevegelse velger rad, ellers oppstår en render-/hoverløkke.
      row.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' && (e.movementX || e.movementY) && this.sel !== i) this.select(i);
      });
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button, input')) return;
        this.select(i);
        if (ACTIONS.includes(r.k)) this.activate();
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
    if (r.k === 'editor') {
      this.setPage(this.pages[this.slot] === 'parts' ? 'head' : 'parts');
      return;
    }
    const detail = appearanceKey(r.k);
    if (detail && cfg.parts) {
      const choices = HERO_APPEARANCE[detail].filter((option) => heroAppearanceAvailable(detail, option.id));
      if (!choices.length) return;
      const idx = choices.findIndex((option) => option.id === this.appearanceCursor[this.slot][detail]);
      const next = idx < 0 ? (d > 0 ? 0 : choices.length - 1) : (idx + d + choices.length) % choices.length;
      this.chooseAppearance(detail, choices[next].id);
      return;
    }
    if (r.k === 'builder') {
      if (cfg.parts) {
        this.paintedDrafts[this.slot] = { ...cfg.parts };
        this.appearanceDrafts[this.slot] = { ...this.appearance(cfg) };
        this.cfgs[this.slot] = cloneHero({ ...cfg, parts: undefined });
      } else {
        const parts = this.availableSet(cfg, this.paintedDrafts[this.slot] ?? defaultHeroParts(cfg.body));
        if (!parts) { this.info(); return; }
        this.cfgs[this.slot] = withHeroAppearance(withHeroParts(cfg, parts), this.appearanceDrafts[this.slot] ?? defaultHeroAppearance());
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
    if (r.k === 'name' || r.k === 'random' || r.k === 'done' || r.k === 'roll') return;
    if (r.k === 'cls') {
      const cur = this.cursor[this.slot];
      cur.cls = ((cur.cls ?? 0) + d + CLASSES.length) % CLASSES.length;
      this.cfgs[this.slot] = this.classRules({ ...cloneHero(cfg), cls: cur.cls });
      this.syncCursors();
      audio.menu();
      this.refresh(true);
      return;
    }
    // Magien og våpenet: bare det klassen kan bruke. Klasser med eget utstyr har ikke noe våpen å velge
    if (r.k === 'magic') {
      const list = classAt(cfg.cls).spells.map(spellIndex);
      const next = list[(Math.max(0, list.indexOf(cfg.magic)) + d + list.length) % list.length];
      this.cursor[this.slot].magic = next;
      this.cfgs[this.slot] = { ...cloneHero(cfg), magic: next };
      audio.menu();
      this.refresh(false);
      return;
    }
    if (r.k === 'weapon' && classAt(cfg.cls).gear) {
      audio.denied();
      this.info();
      return;
    }
    if (r.k === 'weapon' && !cfg.parts) {
      const list = classAt(cfg.cls).weapons;
      const cur = this.cursor[this.slot];
      cur.weapon = list[(Math.max(0, list.indexOf(cur.weapon ?? cfg.weapon)) + d + list.length) % list.length];
      if (isUnlocked(this.game.save, 'weapon:' + cur.weapon)) this.cfgs[this.slot] = { ...cloneHero(cfg), weapon: cur.weapon };
      audio.menu();
      this.refresh(true);
      return;
    }
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

  private chooseAppearance(key: HeroAppearanceKey, id: string) {
    const cfg = this.cfgs[this.slot];
    const option = findHeroAppearance(key, id);
    if (!cfg.parts || !option || !heroAppearanceAvailable(key, id)) return;
    if (key !== 'skinTone' && !isModularHeroHead(cfg.parts.head)) return;
    if (key === 'skinTone' && !this.skinSupport().supported.length) return;
    this.appearanceCursor[this.slot][key] = id;
    if (this.unlocked(option)) this.cfgs[this.slot] = withHeroAppearance(cfg, { ...this.appearance(cfg), [key]: id });
    audio.menu();
    this.refresh(this.unlocked(option));
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
      else preset = cloneHero({ ...preset, parts: undefined });
      this.cfgs[this.slot] = preset;
      this.syncCursors();
      audio.confirm();
      this.refresh(true);
      return;
    }
    if (r.k === 'roll') {
      // Tre seksere per evne. Spillederen har en mening om kastet, og om hvor mange ganger det er kastet
      const ab = roll3d6();
      this.cfgs[this.slot] = { ...cloneHero(cfg), abilities: ab };
      const n = ++this.rolls[this.slot], sum = ab.map(abilityMod).reduce((a: number, b: number) => a + b, 0);
      const lines = n > 3 && chance(0.6) ? GM_LINES.reroll : ab.includes(18) || sum >= 4 ? GM_LINES.good : ab.includes(3) || sum <= -3 ? GM_LINES.bad : GM_LINES.meh;
      this.gm[this.slot] = pick(lines);
      audio.dice();
      this.refresh(false);
      return;
    }
    if (r.k === 'random') {
      if (cfg.parts) {
        const parts = this.availableSet(cfg);
        if (!parts) return;
        for (const slot of HERO_PART_SLOTS) parts[slot] = pick(this.available(slot).filter((part) => this.unlocked(part))).id;
        const cls = Math.floor(Math.random() * CLASSES.length);
        const spells = classAt(cls).spells;
        let randomized = withHeroParts({ ...cloneHero(cfg), name: randomName(), cls, magic: spellIndex(pick(spells)) }, parts);
        const appearance = { ...this.appearance(randomized) };
        for (const key of Object.keys(HERO_APPEARANCE) as HeroAppearanceKey[]) {
          if (key !== 'skinTone' && !isModularHeroHead(parts.head)) continue;
          if (key === 'skinTone' && !heroSkinSupport(buildHeroDef(randomized, 9 + this.slot)).supported.length) continue;
          const choices = HERO_APPEARANCE[key].filter((option) => this.unlocked(option) && heroAppearanceAvailable(key, option.id));
          if (choices.length) appearance[key] = pick(choices).id;
        }
        randomized = withHeroAppearance(randomized, appearance);
        this.cfgs[this.slot] = this.classRules(randomized);
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
    const detail = appearanceKey(r.k);
    let html = '';
    const cls = classAt(cfg.cls);
    const pct = (k: number) => (k >= 1 ? '+' : '') + Math.round((k - 1) * 100) + '%';
    if (r.k === 'weapon' || r.k === 'name' || r.k === 'body') {
      const w = heroWeapon(cfg);
      html = `<b>${w.name}</b> ${w.desc}<br><span class="st">DMG ${Math.round(w.dmg * 100)}% &nbsp; SPEED ${Math.round(w.speed * 100)}% &nbsp; REACH ${Math.round(w.reach * 100)}%</span>`;
      if (r.k === 'weapon' && cls.gear) html += `<br><span class="st">THE ${cls.label} FIGHTS WITH THIS. CHANGE CLASS TO CHANGE WEAPON.</span>`;
    }
    // Klassen: hva den er, og hva den gjør med livet, farten, skaden og magien (data/classes.ts)
    if (r.k === 'cls') {
      html = (cls.quip ? `<b class="quip">${cls.quip}</b><br>` : '') + `<b>${cls.label}</b> ${cls.desc}<br><span class="st">HP ${pct(cls.hp)} &nbsp; SPEED ${pct(cls.speed)} &nbsp; DMG ${pct(cls.dmg)} &nbsp; MAGIC ${pct(cls.magic)}${cls.potions ? ` &nbsp; +${cls.potions} POTION${cls.potions > 1 ? 'S' : ''}` : ''}</span>`;
    }
    // Magien: navnet den roper og hva den gjør (data/spells.ts), og hva klassen kan velge mellom
    if (r.k === 'magic') {
      const sp = spellAt(this.cursor[this.slot].magic ?? cfg.magic);
      html = `<b>${sp.title}</b> ${sp.desc}<br><span class="st">THE ${cls.label} KNOWS: ${cls.spells.map((id) => SPELLS[spellIndex(id)].label).join(', ')}</span>`;
    }
    // ROLL 3D6: de seks tallene, hva de gjør, og spillederen
    if (r.k === 'roll') {
      const ab = cfg.abilities;
      if (!ab) html = 'Roll three dice for each ability, like it is 1974. STR hits harder, DEX runs faster, CON lives longer, INT casts harder. WIS and CHA do nothing, as usual.';
      else {
        const e = abilityEffects(ab);
        const score = (i: number) => `${ABILITIES[i]} <b>${ab[i]}</b>`;
        html = `<span class="dice">${[0, 1, 2].map(score).join(' &nbsp; ')}<br>${[3, 4, 5].map(score).join(' &nbsp; ')}</span><br><span class="st">DMG ${pct(e.dmg)} &nbsp; SPEED ${pct(e.speed)} &nbsp; HP ${pct(e.hp)} &nbsp; MAGIC ${pct(e.magic)}</span>`
          + (this.gm[this.slot] ? `<br><b class="gm">${this.gm[this.slot]}</b>` : '');
      }
    }
    if (r.k === 'builder') html = this.availableSet(cfg)
      ? 'PAINTED PARTS: mix body parts and customise your head. CLASSIC BUILDER: the original drawn hero.'
      : 'Painted artwork is unavailable here. Use CLASSIC BUILDER to customise your hero.';
    else if (r.k === 'editor') html = 'HERO PARTS: body, weapon and magic. HEAD DETAILS: head, hair, beard and colours.';
    else if (detail && cfg.parts) {
      const option = findHeroAppearance(detail, this.appearanceCursor[this.slot][detail]);
      if (option && !this.unlocked(option)) html = `<b class="lock">LOCKED</b> ${PART_LOCKS[option.unlock!]}. Your equipped choice stays on.`;
      else if (detail === 'skinTone') html = this.skinSupport().unsupported.length
        ? 'Colours supported skin areas. Some painted parts keep their original skin colour.'
        : 'Colours exposed skin while keeping armour, clothing and shading.';
      else if (detail === 'hairColor') html = 'Colours your separate hair and beard layers. Choose hair or a beard to see the colour.';
      else if (detail === 'hair' && ['horned', 'skull'].includes(this.appearance(cfg).headgear)) html = 'Your helmet covers front hair. The style stays selected and returns when you remove the helmet.';
      else if (detail === 'eyeColor' || detail === 'eyeStyle') html = 'Choose the eyes independently of hair, beard and headgear.';
      else html = 'Mix separate hair, beard and headgear. NONE removes only this layer.';
    }
    else if (cfg.parts && isPart(r.k)) {
      const part = findHeroPart(r.k, this.partCursor[this.slot][r.k] ?? cfg.parts[r.k]);
      if (part && !this.unlocked(part)) html = `<b class="lock">LOCKED</b> ${PART_LOCKS[part.unlock!]}. Your equipped part stays on.`;
      else if (!part || !getOverride(part.source, part.slot)) html = 'This artwork did not load. Choose another part or switch to CLASSIC BUILDER.';
      else if (r.k !== 'weapon') html = r.k === 'head'
        ? isModularHeroHead(part.id) ? 'CUSTOM HEAD: choose separate hair, beard, headgear and eyes in HEAD DETAILS.' : 'This head includes painted hair and headgear. Pick a CUSTOM HEAD in HEAD DETAILS to edit each layer.'
        : 'Mix this part with any head, body, arms or legs in the pool.';
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
    const detail = appearanceKey(r.k);
    const slot = isPart(r.k) ? r.k : undefined;
    // Klasser med eget utstyr har ingen malte våpen å velge mellom
    if (!cfg.parts || (!slot && !detail) || (slot === 'weapon' && classAt(cfg.cls).gear)) { box.hidden = true; this.poolKey = ''; return; }
    box.hidden = false;
    const selectedId = detail ? this.appearanceCursor[this.slot][detail] : this.partCursor[this.slot][slot!] ?? cfg.parts[slot!];
    const key = JSON.stringify([this.slot, r.k, cfg.parts, this.appearance(cfg), selectedId]);
    if (this.poolKey === key) return;
    this.poolKey = key;
    box.replaceChildren();
    const title = document.createElement('div');
    title.className = 'cr-pool-title';
    box.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'cr-part-grid';
    const makeCard = (option: { id: string; label: string; unlock?: string }, equipped: boolean, choose: () => void) => {
      const locked = !this.unlocked(option);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cr-part' + (equipped ? ' equipped' : '') + (locked ? ' locked' : '');
      b.dataset.option = option.id;
      b.setAttribute('aria-pressed', String(equipped));
      b.setAttribute('aria-disabled', String(locked));
      b.title = locked ? `${option.label}: ${PART_LOCKS[option.unlock!]}` : option.label;
      const label = document.createElement('span');
      label.textContent = (locked ? 'LOCKED: ' : '') + option.label;
      b.appendChild(label);
      b.addEventListener('click', choose);
      grid.appendChild(b);
      return b;
    };
    const thumbnail = (b: HTMLButtonElement, source: HTMLCanvasElement | undefined) => {
      if (!source) return;
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 96;
      const scale = Math.min(112 / source.width, 88 / source.height);
      const w = source.width * scale, h = source.height * scale;
      canvas.getContext('2d')!.drawImage(source, (120 - w) / 2, (96 - h) / 2, w, h);
      canvas.setAttribute('aria-hidden', 'true');
      b.prepend(canvas);
    };
    if (detail) {
      const choices = HERO_APPEARANCE[detail].filter((option) => heroAppearanceAvailable(detail, option.id));
      const colors = detail === 'skinTone' || detail === 'eyeColor' || detail === 'hairColor';
      grid.classList.toggle('cr-colors', colors);
      title.textContent = `${r.label} · ${choices.length} CHOICES`;
      for (const option of choices) {
        const b = makeCard(option, this.appearance(cfg)[detail] === option.id, () => this.chooseAppearance(detail, option.id));
        b.dataset.appearance = detail;
        if (colors) {
          const swatch = document.createElement('i');
          swatch.className = 'cr-swatch' + (option.color ? '' : ' original');
          if (option.color) swatch.style.backgroundColor = option.color;
          swatch.setAttribute('aria-hidden', 'true');
          b.prepend(swatch);
        } else thumbnail(b, heroHeadPreview(buildHeroDef(withHeroAppearance(cfg, { ...this.appearance(cfg), [detail]: option.id }), 9 + this.slot)));
      }
    } else if (slot) {
      const choices = this.available(slot);
      title.textContent = `${r.label} POOL · ${choices.length} PARTS`;
      for (const part of choices) {
        const b = makeCard(part, cfg.parts[slot] === part.id, () => this.choosePart(slot, part.id));
        b.dataset.part = part.id;
        const source = slot === 'head'
          ? heroHeadPreview(buildHeroDef(withHeroParts(cfg, { ...cfg.parts, head: part.id }), 9 + this.slot))
          : getOverride(part.source, part.slot)?.canvas;
        thumbnail(b, source);
      }
    }
    if (!grid.childElementCount) {
      const empty = document.createElement('div');
      empty.className = 'cr-pool-empty';
      empty.textContent = 'No artwork loaded for this choice. Your other selections stay available.';
      box.appendChild(empty);
      return;
    }
    box.appendChild(grid);
    // Hold kortet synlig også ved tastaturvalg, uten å rulle hele smiapanelet.
    const selectedCard = Array.from(grid.children).find((card) => (card as HTMLElement).dataset.option === selectedId) as HTMLElement | undefined;
    if (selectedCard) {
      const card = selectedCard.getBoundingClientRect();
      const frame = grid.getBoundingClientRect();
      if (card.left < frame.left) grid.scrollLeft -= frame.left - card.left;
      else if (card.right > frame.right) grid.scrollLeft += card.right - frame.right;
      if (card.top < frame.top) grid.scrollTop -= frame.top - card.top;
      else if (card.bottom > frame.bottom) grid.scrollTop += card.bottom - frame.bottom;
    }
  }

  private refresh(rebuild: boolean) {
    this.renderRows();
    const cfg = this.cfgs[this.slot];
    const cur = this.cursor[this.slot];
    this.el.classList.toggle('cr-painted', !!cfg.parts);
    const pages = this.el.querySelector('.cr-pages') as HTMLElement;
    pages.hidden = !cfg.parts;
    pages.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const active = b.dataset.page === this.pages[this.slot];
      b.classList.toggle('on', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const custom = this.el.querySelector('.cr-custom-head') as HTMLElement;
    custom.hidden = !cfg.parts || this.pages[this.slot] !== 'head' || isModularHeroHead(cfg.parts.head);
    custom.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const available = this.available('head').some((part) => part.id === b.dataset.head);
      b.disabled = !available;
      b.title = available ? 'Keep your body, weapon and saved head details.' : 'This custom head artwork did not load.';
    });
    const status = this.el.querySelector('.cr-status') as HTMLElement;
    const missing = cfg.parts && HERO_PART_SLOTS.some((slot) => {
      const part = findHeroPart(slot, cfg.parts![slot]);
      return !part || !getOverride(part.source, part.slot);
    });
    status.textContent = cfg.parts
      ? missing ? 'Some artwork did not load. Pick another part or use CLASSIC BUILDER.'
        : this.pages[this.slot] === 'head' ? 'YOUR FACE. YOUR FINISHING TOUCHES.' : 'A SHARED POOL. YOUR OWN LEGEND.'
      : 'CLASSIC BUILDER · SKIN, HAIR & ARMOUR';
    status.classList.toggle('missing', !!missing);
    if (document.activeElement !== this.input) this.input.value = cfg.name;
    this.el.querySelectorAll('.cr-row').forEach((row, i) => {
      const r = this.rows[i];
      const v = row.querySelector('.v') as HTMLElement | null;
      if (!v) return;
      if (r.k === 'preset' || r.k === 'builder' || r.k === 'editor') {
        v.textContent = r.k === 'editor' ? this.pages[this.slot] === 'head' ? 'HEAD DETAILS' : 'HERO PARTS'
          : r.k === 'preset' ? Object.keys(PRESETS)[this.presetIdx].toUpperCase() : cfg.parts ? 'PAINTED PARTS' : 'CLASSIC BUILDER';
        return;
      }
      let locked = false;
      const detail = appearanceKey(r.k);
      const gear = r.k === 'weapon' ? classAt(cfg.cls).gear : undefined;
      if (gear) {
        v.textContent = GEAR[gear].name;
      } else if (detail && cfg.parts) {
        const option = findHeroAppearance(detail, this.appearanceCursor[this.slot][detail]);
        locked = !!option && !this.unlocked(option);
        v.textContent = !option || !heroAppearanceAvailable(detail, option.id) ? 'ART UNAVAILABLE' : (locked ? 'LOCKED: ' : '') + option.label;
      } else if (cfg.parts && isPart(r.k)) {
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
    const f = new Fighter(def.id, 'hero', { hp: 100, speed: 3, weapon: heroWeapon(this.cfgs[this.slot]) });
    dressHero(f, classAt(this.cfgs[this.slot].cls));
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
        const cfg = this.cfgs[this.slot];
        // Alven viser buen, de andre slår
        const moves = classAt(cfg.cls).ranged ? [HERO_ATK.shot1, HERO_ATK.shot3] : [HERO_ATK.slash1, HERO_ATK.chop, HERO_ATK.slash2];
        f.startAttack(scaleAttack(pick(moves), heroWeapon(cfg)));
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
