// Tastatur, gamepad og berøringsskjerm for opptil 2 lokale spillere.
// Tastene leses med e.code (fysisk posisjon), slik at det fungerer likt på norsk og engelsk tastatur.
// Gamepad følger "standard mapping" (Xbox/PlayStation/Switch Pro i nettleseren):
//   A/Kryss = hopp, X/Firkant = angrep, B/Sirkel = spesial/blokk, RT = angrep, LT og LB = spesial,
//   Start = pause, Select = tilbake i menyer.
// Spillet bruker tre knapper (angrep, hopp, spesial). Grep og ridning skjer ved å gå inn i fienden eller dyret.
// Grip-knappen (R, U, høyre Shift, Numpad 0, V, Y og RB) finnes fortsatt som skjult snarvei.
import { settings } from './settings';

export type Btn = 'left' | 'right' | 'up' | 'down' | 'attack' | 'jump' | 'special' | 'grab' | 'start';
const BTNS: Btn[] = ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab', 'start'];

type KeyMap = Record<Btn, string[]>;
type MenuState = { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; back: boolean };

const P1_KEYS: KeyMap = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  attack: ['KeyF', 'KeyJ'], jump: ['KeyG', 'KeyK'], special: ['KeyH', 'KeyL'], grab: ['KeyR', 'KeyU'],
  start: [],
};
const P2_KEYS: KeyMap = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  attack: ['Comma', 'Numpad1'], jump: ['Period', 'Numpad2'], special: ['Slash', 'Numpad3'], grab: ['ShiftRight', 'Numpad0'],
  start: [],
};
// I 1-spiller-modus kan P1 også bruke piltaster + Z/X/C/V (eller P2 sine knapper).
const SOLO_EXTRA: KeyMap = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  attack: ['KeyZ', 'Comma', 'Numpad1'], jump: ['KeyX', 'Period', 'Numpad2', 'Space'], special: ['KeyC', 'Slash', 'Numpad3'], grab: ['KeyV', 'ShiftRight', 'Numpad0'],
  start: [],
};

/** Hvilken spiller hver gamepad styrer denne framen (-1 = alle, i 1-spiller). */
export interface PadInfo { index: number; id: string; player: number }

export class PlayerInput {
  held: Record<Btn, boolean> = mk();
  pressed: Record<Btn, boolean> = mk();
  released: Record<Btn, boolean> = mk();
  /** Tid siden sist trykk på venstre/høyre, for dobbelttrykk = løp. */
  private lastTap: { left: number; right: number } = { left: -9, right: -9 };
  doubleTap: { left: boolean; right: boolean } = { left: false, right: false };
  /** Buffer for angrep så combos føles responsive. */
  attackBuffer = 0;
  jumpBuffer = 0;
  grabBuffer = 0;
  /** Siste kilde som ble brukt ('keys', 'pad', 'touch'), brukes til hint i UI. */
  source: 'keys' | 'pad' | 'touch' = 'keys';

  set(next: Record<Btn, boolean>, time: number) {
    this.doubleTap.left = this.doubleTap.right = false;
    for (const b of BTNS) {
      this.pressed[b] = next[b] && !this.held[b];
      this.released[b] = !next[b] && this.held[b];
      this.held[b] = next[b];
    }
    for (const d of ['left', 'right'] as const) {
      if (this.pressed[d]) {
        if (time - this.lastTap[d] < 0.28) this.doubleTap[d] = true;
        this.lastTap[d] = time;
      }
    }
    if (this.pressed.attack) this.attackBuffer = 0.18;
    if (this.pressed.jump) this.jumpBuffer = 0.12;
    if (this.pressed.grab) this.grabBuffer = 0.15;
  }
  tick(dt: number) {
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.grabBuffer = Math.max(0, this.grabBuffer - dt);
  }
  consumeGrab() {
    const b = this.grabBuffer > 0;
    this.grabBuffer = 0;
    return b;
  }
  consumeAttack() {
    const b = this.attackBuffer > 0;
    this.attackBuffer = 0;
    return b;
  }
  consumeJump() {
    const b = this.jumpBuffer > 0;
    this.jumpBuffer = 0;
    return b;
  }
  /** -1..1 horisontalt, -1..1 dybde (opp = -1 = bort fra kamera). */
  axisX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); }
  axisY() { return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0); }
  any() { return BTNS.some((b) => this.pressed[b]); }
}

function mk(): Record<Btn, boolean> {
  return { left: false, right: false, up: false, down: false, attack: false, jump: false, special: false, grab: false, start: false };
}

export class InputManager {
  keys = new Set<string>();
  /** Taster trykket siden forrige frame (fanger raske trykk ved lav FPS). */
  tapped = new Set<string>();
  private has(c: string) {
    return this.keys.has(c) || this.tapped.has(c);
  }
  players = [new PlayerInput(), new PlayerInput()];
  solo = true;
  time = 0;
  /** Menynavigasjon: samlet fra alle kilder. */
  menu: MenuState = { up: false, down: false, left: false, right: false, confirm: false, back: false };
  onFirstInteraction: (() => void) | null = null;
  pause = false;
  /** Virtuelle knapper fra berøringskontrollene (spiller 1). */
  touch: Record<Btn, boolean> = mk();
  /** Menyknapper fra berøring (pauseknappen). */
  touchMenu: { pause: boolean } = { pause: false };
  pads: PadInfo[] = [];
  /** Kalles når en gamepad kobles til eller fra. */
  onPad: ((msg: string) => void) | null = null;

  constructor() {
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Tab']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) this.tapped.add(e.code);
      this.first();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointerdown', () => {
      window.focus();
      this.first();
    });
    window.addEventListener('gamepadconnected', (e) => {
      const n = (e as GamepadEvent).gamepad;
      this.first();
      this.onPad?.('GAMEPAD CONNECTED: ' + shortPadName(n.id));
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      this.onPad?.('GAMEPAD DISCONNECTED: ' + shortPadName((e as GamepadEvent).gamepad.id));
    });
  }

  private first() {
    if (this.onFirstInteraction) {
      const f = this.onFirstInteraction;
      this.onFirstInteraction = null;
      f();
    }
  }

  private fromKeys(map: KeyMap, into: Record<Btn, boolean>) {
    for (const b of BTNS) if (map[b].some((k) => this.has(k))) into[b] = true;
  }

  private fromPad(pad: Gamepad | null, into: Record<Btn, boolean>) {
    if (!pad) return false;
    const bt = (i: number) => !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.5;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    // Radiell dødsone, og 8 retninger (sektorer på 45 grader)
    const mag = Math.hypot(ax, ay);
    let any = false;
    if (mag > 0.35) {
      const a = Math.atan2(ay, ax);
      const oct = Math.round(a / (Math.PI / 4));
      const dx = Math.round(Math.cos(oct * (Math.PI / 4)));
      const dy = Math.round(Math.sin(oct * (Math.PI / 4)));
      if (dx < 0) into.left = true;
      if (dx > 0) into.right = true;
      if (dy < 0) into.up = true;
      if (dy > 0) into.down = true;
      any = true;
    }
    if (bt(14)) into.left = true;
    if (bt(15)) into.right = true;
    if (bt(12)) into.up = true;
    if (bt(13)) into.down = true;
    if (bt(2) || bt(7)) into.attack = true;
    if (bt(0)) into.jump = true;
    if (bt(1) || bt(4) || bt(6)) into.special = true;
    if (bt(3) || bt(5)) into.grab = true;
    if (bt(9)) into.start = true;
    for (let i = 0; i < pad.buttons.length; i++) if (bt(i)) any = true;
    return any;
  }

  /** Rist gamepaden til en spiller (eller alle i 1-spiller). */
  rumble(player: number, strong: number, weak: number, ms: number) {
    if (!settings.rumble) return;
    let list: Gamepad[] = [];
    try {
      list = navigator.getGamepads ? (Array.from(navigator.getGamepads()).filter((p) => p && p.connected) as Gamepad[]) : [];
    } catch {
      return;
    }
    for (const info of this.pads) {
      if (info.player !== -1 && info.player !== player) continue;
      const pad = list.find((p) => p.index === info.index);
      const act = (pad as unknown as { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } })?.vibrationActuator;
      try {
        act?.playEffect?.('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: Math.min(1, weak), strongMagnitude: Math.min(1, strong) })?.catch?.(() => {});
      } catch {
        /* ikke støttet */
      }
    }
  }

  update(dt: number) {
    this.time += dt;
    let pads: (Gamepad | null)[] = [];
    try {
      pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((p) => p && p.connected) : [];
    } catch {
      pads = [];
    }
    const s1 = mk();
    const s2 = mk();
    this.fromKeys(P1_KEYS, s1);
    const keys1 = BTNS.some((b) => s1[b]);
    this.pads = [];
    let pad1 = false;
    let pad2 = false;
    if (this.solo) {
      this.fromKeys(SOLO_EXTRA, s1);
      for (const p of pads) {
        if (!p) continue;
        if (this.fromPad(p, s1)) pad1 = true;
        this.pads.push({ index: p.index, id: p.id, player: -1 });
      }
    } else {
      this.fromKeys(P2_KEYS, s2);
      // Én gamepad i 2-spiller: gamepaden er spiller 2, tastaturet (WASD) er spiller 1.
      // To gamepads: gamepad 1 er spiller 1, gamepad 2 er spiller 2.
      const live = pads.filter((p): p is Gamepad => !!p);
      if (live.length === 1) {
        pad2 = this.fromPad(live[0], s2);
        this.pads.push({ index: live[0].index, id: live[0].id, player: 1 });
      } else {
        live.forEach((p, i) => {
          const hit = this.fromPad(p, i === 0 ? s1 : s2);
          if (i === 0 && hit) pad1 = true;
          if (i === 1 && hit) pad2 = true;
          if (i < 2) this.pads.push({ index: p.index, id: p.id, player: i });
        });
      }
    }
    // Berøringskontroller styrer alltid spiller 1
    let touched = false;
    for (const b of BTNS) if (this.touch[b]) {
      s1[b] = true;
      touched = true;
    }
    if (touched) this.players[0].source = 'touch';
    else if (pad1) this.players[0].source = 'pad';
    else if (keys1) this.players[0].source = 'keys';
    if (pad2) this.players[1].source = 'pad';
    // Motsatte retninger kansellerer ikke hverandre stygt: siste vinner er unødvendig her, vi lar begge stå.
    this.players[0].set(s1, this.time);
    this.players[1].set(s2, this.time);
    this.players[0].tick(dt);
    this.players[1].tick(dt);

    // Meny
    const k = (codes: string[]) => codes.some((c) => this.has(c));
    const cur: MenuState = {
      up: k(['ArrowUp', 'KeyW']),
      down: k(['ArrowDown', 'KeyS']),
      left: k(['ArrowLeft', 'KeyA']),
      right: k(['ArrowRight', 'KeyD']),
      confirm: k(['Enter', 'Space', 'KeyF', 'KeyJ', 'NumpadEnter', 'Comma', 'KeyZ']),
      back: k(['Escape', 'Backspace']),
    };
    for (const p of pads) {
      if (!p) continue;
      const ay = p.axes[1] ?? 0;
      const ax = p.axes[0] ?? 0;
      if (ay < -0.5 || p.buttons[12]?.pressed) cur.up = true;
      if (ay > 0.5 || p.buttons[13]?.pressed) cur.down = true;
      if (ax < -0.5 || p.buttons[14]?.pressed) cur.left = true;
      if (ax > 0.5 || p.buttons[15]?.pressed) cur.right = true;
      if (p.buttons[0]?.pressed || p.buttons[9]?.pressed || p.buttons[2]?.pressed) cur.confirm = true;
      if (p.buttons[1]?.pressed || p.buttons[8]?.pressed) cur.back = true;
    }
    for (const key of Object.keys(cur) as (keyof MenuState)[]) {
      this.menu[key] = cur[key] && !this.prevMenu[key];
    }
    this.prevMenu = cur;
    const pauseNow = k(['Escape', 'KeyP']) || pads.some((p) => !!p?.buttons[9]?.pressed) || this.touchMenu.pause;
    this.pause = pauseNow && !this.pausePrev;
    this.pausePrev = pauseNow && (this.keys.has('Escape') || this.keys.has('KeyP') || pads.some((p) => !!p?.buttons[9]?.pressed));
    this.touchMenu.pause = false;
    this.tappedLast = new Set(this.tapped);
    this.tapped.clear();
  }
  private prevMenu: MenuState = { up: false, down: false, left: false, right: false, confirm: false, back: false };
  private pausePrev = false;

  private tappedLast = new Set<string>();
  keyPressedOnce(code: string) {
    return (this.keys.has(code) || this.tappedLast.has(code)) && !this.onceSeen.has(code) && (this.onceSeen.add(code), true);
  }
  private onceSeen = new Set<string>();
  clearOnce() {
    for (const c of this.onceSeen) if (!this.keys.has(c)) this.onceSeen.delete(c);
  }
}

function shortPadName(id: string) {
  const s = id.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  return s.length > 28 ? s.slice(0, 26) + '..' : s || 'GAMEPAD';
}
