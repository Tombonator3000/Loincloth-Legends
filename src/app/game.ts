// Spillmotoren: renderer, løkke, scenebytte og spillflyt (tittel, kart, brett, dueller, heltebygger).
import * as THREE from 'three';
import { InputManager } from '../core/input';
import { audio } from '../core/audio';
import { Gore } from '../gfx/gore';
import { FX } from '../gfx/fx';
import { buildArena, type Env } from '../gfx/env';
import { HUD } from '../ui/hud';
import { Screens, type Item } from '../ui/screens';
import { TouchControls } from '../ui/touch';
import { Splash, wantSplash } from '../ui/splash';
import { settings, setSettings, onSettings, touchEnabled, GORE_NAMES, GORE_HINTS, QUALITY_SETTINGS, QUALITY_HINTS, type GoreLevel, type TouchMode, type QualitySetting } from '../core/settings';
import { PostFX, autoQuality, type Quality } from '../gfx/post';
import { skyLight } from '../gfx/envlight';
import { wind } from '../gfx/wind';
import { W } from '../game/world';
import { Stage } from '../game/stage';
import { Duel, type DuelConfig, type DuelSide } from '../game/duel';
import { Fighter } from '../game/fighter';
import { DUEL_ATK } from '../game/attacks';
import { buildHeroDef, HERO_OPTIONS, type HeroConfig } from '../gfx/chars/hero';
import { registerChar } from '../gfx/chars';
import { WEAPONS } from '../data/weapons';
import { LEVELS } from '../data/levels';
import { DUELISTS, type DuelistDef } from '../data/duelists';
import { MAP_NODES, type MapNode } from '../data/worldmap';
import { loadSave, writeSave, defaultSave, type SaveData } from './save';
import type { Scene } from './scene';
import { CreatorScene } from './scenes/creator';
import { showCamp, showTraining } from './camp';
import { addXp, defaultProgress, statEffects, XP_DUEL, XP_STAGE_FIRST, XP_STAGE_REPEAT, type HeroProgress } from '../data/progress';
import { weaponWithStats } from '../game/hero';
import { MapScene } from './scenes/map';
import { pick, rand } from '../core/math';

const INTRO = [
  'IN AN AGE BEFORE HYGIENE...',
  'WHEN MEN WERE MEN, WOMEN WERE WARRIORS, AND LOINCLOTHS WERE LOAD-BEARING...',
  'THE MODERATELY EVIL SORCERER VORTHAX KIDNAPPED PRINCESS AMBERLY.',
  'SHE IS FINE. SHE IS MOSTLY BORED.',
  'THE REWARD IS 400 GOLD AND A HALF-EATEN HAM.',
  'ONLY THE MIGHTIEST (AVAILABLE) HEROES CAN SAVE HER.',
];
const GAMEOVER_QUIPS = ['YOU DIED. BADLY.', 'THE BARD WILL NOT SING OF THIS.', 'YOUR LOINCLOTH HAS BEEN RECYCLED.', 'VORTHAX IS DOING A LITTLE DANCE.'];

/** AUTO velger ut fra enheten, ellers brukes nivået direkte. */
function resolveQuality(q: QualitySetting): Quality {
  return q === 'auto' ? autoQuality() : q;
}

// ---------------------------------------------------------------- enkle scener
class TitleScene implements Scene {
  name = 'title';
  actors: Fighter[] = [];
  t = 0;
  /** Tid til neste lynnedslag bak de to kjempene (tittelen skal se ut som et albumomslag fra 1986). */
  private boltT = 1.2;
  constructor(private game: Game) {
    W.env = buildArena(W.scene, W.gore, 'pit');
    const s = game.save;
    const a = new Fighter(registerChar(buildHeroDef(s.heroes[0], 0)), 'hero', { hp: 100, speed: 3, weapon: WEAPONS[s.heroes[0].weapon] });
    a.pos.set(-3.2, 0, 0.1);
    a.facing = 1;
    const b = new Fighter('gorthak', 'enemy', { hp: 100, speed: 3 });
    b.pos.set(3.2, 0, -0.1);
    b.facing = -1;
    for (const f of [a, b]) {
      f.addTo(W.scene);
      this.actors.push(f);
    }
    game.camera.position.set(0, 2.8, 10.5);
  }
  update(dt: number) {
    this.t += dt;
    const bounds = { minX: -6, maxX: 6, minZ: -0.5, maxZ: 0.5 };
    for (const f of this.actors) {
      f.wantVX = 0;
      if (f.canAct() && Math.random() < dt * 0.5) {
        const r = Math.random();
        if (r < 0.5) f.startAttack(pick([DUEL_ATK.slash, DUEL_ATK.over, DUEL_ATK.sweep, DUEL_ATK.whirl]));
        else if (r < 0.7) {
          f.setState('taunt');
          setTimeout(() => f.state === 'taunt' && f.setState('idle'), 1100);
        } else if (r < 0.85) f.jump(0, 0, 8);
      }
      f.update(dt, bounds);
    }
    if (this.actors.some((f) => f.phase() === 'active') && Math.random() < 0.3) W.gore.sparks(new THREE.Vector3(0, rand(1.2, 2.2), 0.2), 3);
    this.boltT -= dt;
    if (this.boltT <= 0) {
      this.boltT = rand(2.8, 5.5);
      const x = pick([-1, 1]) * rand(1.5, 6);
      W.gore.vfx.lightning(new THREE.Vector3(x + rand(-2, 2), 16, -7), new THREE.Vector3(x, 0.05, rand(-3.5, -1.5)), '#9fd8ff', 0.28);
      W.fx.flash('#cfe8ff', 0.25, 0.12);
      audio.boom(0.35);
    }
    const c = this.game.camera;
    c.position.set(Math.sin(this.t * 0.15) * 1.6, 2.4 + Math.sin(this.t * 0.21) * 0.2, 10.5);
    c.lookAt(0, 2.3, 0);
  }
  exit() {
    for (const f of this.actors) f.remove();
  }
}

class StageScene implements Scene {
  name = 'stage';
  pausable = true;
  stage: Stage;
  constructor(private game: Game, levelId: string, private onEnd: (r: 'complete' | 'duel' | 'gameover') => void) {
    const cfgs = game.twoP ? [game.save.heroes[0], game.save.heroes[1]] : [game.save.heroes[0]];
    const sup = { lives: game.save.supplies?.lives ?? 0, potions: game.save.supplies?.potions ?? 0 };
    game.save.supplies = { lives: 0, potions: 0 };
    game.persist();
    this.stage = new Stage(game.hud, LEVELS[levelId], cfgs, game.input.players, [game.progressOf(0), game.progressOf(1)], sup);
    if (sup.lives || sup.potions) setTimeout(() => game.toast(`SUPPLIES: +${sup.lives} LIFE, +${sup.potions * 2} POTIONS`), 600);
    game.hud.visible(true);
    game.screens.hide();
    game.camera.position.set(this.stage.camX, 4.6, 13.8);
  }
  update(dt: number, realDt: number) {
    const st = this.stage;
    st.update(dt);
    const cam = this.game.camera;
    cam.position.x += (st.camX - cam.position.x) * Math.min(1, realDt * 8);
    cam.position.y = 4.6;
    cam.position.z = cam.aspect < 1.2 ? 16 : 13.8;
    cam.lookAt(cam.position.x, 2.0, 0);
    if (st.done) {
      const r = st.done;
      st.done = '';
      this.onEnd(r);
    }
  }
  exit() {
    this.stage.dispose();
  }
}

class DuelScene implements Scene {
  name = 'duel';
  pausable = true;
  duel: Duel;
  private ended = false;
  constructor(private game: Game, cfg: DuelConfig, private onEnd: (w: 0 | 1) => void) {
    this.duel = new Duel(game.hud, cfg);
    game.hud.visible(true);
    game.screens.hide();
    game.camera.position.set(0, 3, 12);
  }
  update(dt: number, realDt: number) {
    const inp = this.game.input;
    const skip = inp.players[0].pressed.attack || inp.players[1].pressed.attack || inp.menu.confirm;
    this.duel.update(dt, realDt, skip);
    if (this.duel.done && !this.ended) {
      this.ended = true;
      this.onEnd(this.duel.matchWinner);
    }
  }
  exit() {
    this.duel.dispose();
  }
}

class IdleScene implements Scene {
  name = 'idle';
  update() {}
}

// ---------------------------------------------------------------- spillet
export class Game {
  app = document.getElementById('app')!;
  canvas = document.getElementById('gl') as HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  /** Bildepipelinen: HDR, bloom, dybdeskarphet, gradering (gfx/post.ts). */
  post: PostFX;
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 420);
  input = new InputManager();
  gore = new Gore();
  fx: FX;
  hud: HUD;
  screens: Screens;
  touch: TouchControls;
  /** Oppstartslogoen (null når den er ferdig eller hoppet over). */
  splash: Splash | null = null;
  private toastEl: HTMLDivElement;
  private toastT = 0;
  scene: Scene = new IdleScene();
  save: SaveData = loadSave();
  twoP = false;
  paused = false;
  last = performance.now();
  width = 1;
  height = 1;
  private qualitySet = false;

  constructor() {
    const q0 = resolveQuality(settings.quality);
    // Med etterbehandling har scenemålet egen MSAA, så skjermbufferet trenger ikke kantutjevning.
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q0 === 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.post = new PostFX(this.renderer);
    this.post.quality = q0;
    this.fx = new FX(this.app);
    this.hud = new HUD(this.app);
    this.screens = new Screens(this.app);
    this.touch = new TouchControls(this.app, this.input);
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast';
    this.app.appendChild(this.toastEl);
    W.gore = this.gore;
    W.fx = this.fx;
    W.camera = this.camera;
    W.post = this.post;
    this.gore.vfx.setCamera(this.camera);
    W.scene = new THREE.Scene();
    W.rumble = (p, st, wk, ms) => this.input.rumble(p, st, wk, ms);
    this.input.onFirstInteraction = () => audio.init();
    this.input.onPad = (msg) => this.toast(msg + (this.twoP ? ' (1 PAD = PLAYER 2, 2 PADS = P1 + P2)' : ''));
    onSettings((st) => {
      audio.setVolumes(st.music, st.sfx);
      audio.setStyle(st.musicStyle);
      this.gore.level = st.gore;
      const q = resolveQuality(st.quality);
      if (q !== this.post.quality || !this.qualitySet) {
        this.qualitySet = true;
        this.post.setQuality(q);
        this.resize();
      }
    });
    document.querySelector('.rotate-note')?.addEventListener('click', (e) => (e.currentTarget as HTMLElement).classList.add('dismissed'));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.goTitle();
    document.getElementById('boot')?.remove();
    if (wantSplash()) {
      this.splash = new Splash(this.app, () => {
        this.splash = null;
        audio.play('title', true);
      });
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.post.setSize(this.width, this.height);
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.fov = this.camera.aspect < 1.2 ? 52 : 38;
    this.camera.updateProjectionMatrix();
  }

  /** Bytt scene: rydd den gamle, lag en tom 3D-scene og bygg den nye. */
  setScene(make: () => Scene) {
    this.scene.exit?.();
    this.scene = new IdleScene();
    if (W.scene) W.scene.clear();
    const scene = new THREE.Scene();
    this.gore.clear();
    scene.add(this.gore.group);
    W.scene = scene;
    W.env = null;
    this.fx.reset(scene);
    this.paused = false;
    this.hud.clear();
    this.scene = make();
    this.post.focus = -1;
    this.post.hurt = 0;
    // make() kan ha satt W.env; TypeScript tror den fortsatt er null her
    const env = (W as { env: Env | null }).env;
    this.post.setGrade(this.scene.grade ?? env?.grade ?? {}, true);
    // Himmelen blir lyskilde for PBR-materialene (refleksjoner og omgivelseslys, gfx/envlight.ts)
    skyLight(this.renderer, W.scene);
  }

  private menuMode() {
    this.hud.clear();
    this.hud.visible(false);
  }

  toast(msg: string, dur = 3) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastT = dur;
  }

  persist() {
    writeSave(this.save);
  }

  /** Nivå og stats for en helt (lages hvis den mangler). */
  progressOf(i: number): HeroProgress {
    if (!this.save.progress) this.save.progress = [defaultProgress(), defaultProgress()];
    if (!this.save.progress[i]) this.save.progress[i] = defaultProgress();
    return this.save.progress[i];
  }

  /** Gi XP til alle heltene som er med. Returnerer linjer til belønningsskjermen. */
  private awardXp(xp: number): [string, string][] {
    const lines: [string, string][] = [];
    if (xp <= 0) return lines;
    const party = this.twoP ? [0, 1] : [0];
    for (const i of party) {
      const p = this.progressOf(i);
      const ups = addXp(p, xp);
      if (ups) lines.push(['LEVEL UP!', `${this.save.heroes[i].name} IS NOW LEVEL ${p.level}. SPEND POINTS IN TRAINING.`]);
    }
    lines.unshift(['EXPERIENCE', `+${xp} XP` + (party.length > 1 ? ' EACH' : '')]);
    if (lines.length > 1) audio.levelUp();
    return lines;
  }

  // ---------------------------------------------------------------- tittel
  goTitle() {
    this.input.solo = true;
    this.setScene(() => new TitleScene(this));
    this.hud.visible(false);
    audio.play('title');
    this.showTitleMenu();
  }

  showTitleMenu() {
    const s = this.save;
    const progress = s.completed.length > 0;
    this.screens.title([
      { label: progress ? 'CONTINUE: 1 PLAYER' : 'STORY: 1 PLAYER', hint: 'WORLD MAP, BOSSES AND DUELS', action: () => this.startStory(false) },
      { label: progress ? 'CONTINUE: 2 PLAYERS' : 'STORY: 2 PLAYERS', hint: 'CO-OP PÅ SAMME TASTATUR ELLER GAMEPADS', action: () => this.startStory(true) },
      { label: 'HERO FORGE', hint: 'LAG DIN EGEN HELT', action: () => this.openCreator([0, 1], () => this.goTitle()) },
      { label: 'DUEL VS CPU', hint: 'VELG MOTSTANDER', action: () => this.duelMenu() },
      { label: 'DUEL P1 VS P2', hint: s.heroes[0].name + ' VS ' + s.heroes[1].name, action: () => this.pvpDuel() },
      { label: 'SETTINGS', hint: 'GORE, LYD, RUMBLE, BERØRING', action: () => this.showSettings(() => this.showTitleMenu()) },
      { label: 'CONTROLS', action: () => this.screens.controls(() => this.showTitleMenu()) },
      { label: 'NEW GAME', hint: 'SLETT FREMGANG', action: () => this.confirmReset() },
    ], audio.muted);
  }

  // ---------------------------------------------------------------- innstillinger
  showSettings(onBack: () => void, sel = 0) {
    const pct = (v: number) => Math.round(v * 100) + '%';
    const step = (v: number, d: number) => Math.max(0, Math.min(1, Math.round((v + d * 0.1) * 10) / 10));
    const TOUCH: TouchMode[] = ['auto', 'on', 'off'];
    const fs = !!document.fullscreenElement;
    // Hver rad får vite sin egen plass, så menyen tegnes på nytt med riktig rad valgt
    const items: Item[] = [];
    const row = (make: (again: () => void) => Item) => {
      const i = items.length;
      items.push(make(() => this.showSettings(onBack, i)));
    };
    row((again) => {
      const cycle = (d: number) => {
        setSettings({ gore: ((((settings.gore + d) % 4) + 4) % 4) as GoreLevel });
        again();
      };
      return { label: 'GORE: ' + GORE_NAMES[settings.gore], hint: GORE_HINTS[settings.gore], action: () => cycle(1), adjust: cycle };
    });
    row((again) => ({ label: 'MUSIC: ' + pct(settings.music), action: () => { setSettings({ music: settings.music >= 1 ? 0 : step(settings.music, 1) }); again(); }, adjust: (d) => { setSettings({ music: step(settings.music, d) }); again(); } }));
    row((again) => {
      const flip = () => {
        setSettings({ musicStyle: settings.musicStyle === 'metal' ? 'chip' : 'metal' });
        again();
      };
      return { label: 'MUSIC STYLE: ' + (settings.musicStyle === 'metal' ? 'HEAVY METAL' : '8-BIT'), hint: settings.musicStyle === 'metal' ? 'DISTORTION, DOUBLE KICK, GUITAR SOLOS' : 'THE OLD CHIPTUNES', action: flip, adjust: flip };
    });
    row((again) => ({ label: 'SOUND FX: ' + pct(settings.sfx), action: () => { setSettings({ sfx: settings.sfx >= 1 ? 0 : step(settings.sfx, 1) }); audio.hit(); again(); }, adjust: (d) => { setSettings({ sfx: step(settings.sfx, d) }); audio.hit(); again(); } }));
    row((again) => ({ label: 'SCREEN SHAKE: ' + (settings.shake ? 'ON' : 'OFF'), action: () => { setSettings({ shake: !settings.shake }); again(); }, adjust: () => { setSettings({ shake: !settings.shake }); again(); } }));
    row((again) => ({ label: 'GAMEPAD RUMBLE: ' + (settings.rumble ? 'ON' : 'OFF'), action: () => { setSettings({ rumble: !settings.rumble }); this.input.rumble(-1, 0.6, 0.6, 200); again(); }, adjust: () => { setSettings({ rumble: !settings.rumble }); again(); } }));
    row((again) => ({ label: 'TOUCH CONTROLS: ' + settings.touch.toUpperCase(), hint: 'AUTO = PÅ TELEFON OG NETTBRETT', action: () => { setSettings({ touch: TOUCH[(TOUCH.indexOf(settings.touch) + 1) % 3] }); again(); }, adjust: (d) => { setSettings({ touch: TOUCH[(TOUCH.indexOf(settings.touch) + d + 3) % 3] }); again(); } }));
    row((again) => ({ label: 'FULLSCREEN: ' + (fs ? 'ON' : 'OFF'), action: () => { this.toggleFullscreen(); setTimeout(again, 250); } }));
    row((again) => {
      const cycle = (d: number) => {
        const i = QUALITY_SETTINGS.indexOf(settings.quality);
        setSettings({ quality: QUALITY_SETTINGS[(i + d + QUALITY_SETTINGS.length) % QUALITY_SETTINGS.length] as QualitySetting });
        again();
      };
      return { label: 'GRAPHICS: ' + settings.quality.toUpperCase() + (settings.quality === 'auto' ? ' (' + this.post.quality.toUpperCase() + ')' : ''), hint: QUALITY_HINTS[settings.quality], action: () => cycle(1), adjust: cycle };
    });
    items.push({ label: 'BACK', action: onBack });
    this.screens.custom(`<div class="panel settings"><h2>SETTINGS</h2><ul class="menu"></ul><p class="line small">GAMEPAD: A HOPP &middot; X ANGREP &middot; B SPESIAL &middot; Y GRIP &middot; START PAUSE</p></div>`, items, sel, onBack);
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' } as FullscreenOptions)?.catch?.(() => {});
    } catch {
      /* ikke støttet */
    }
  }

  private confirmReset() {
    this.screens.result('NEW GAME?', 'ALL PROGRESS AND HEROES WILL BE ERASED. THE HAM REMAINS HALF-EATEN.', [
      { label: 'NO, GO BACK', action: () => this.showTitleMenu() },
      { label: 'YES, ERASE', action: () => {
        this.save = defaultSave();
        this.persist();
        this.showTitleMenu();
      } },
    ]);
  }

  private duelMenu() {
    const done = new Set(this.save.completed);
    const list = Object.values(DUELISTS);
    this.screens.result('CHOOSE YOUR VICTIM', 'BEAT THEM IN THE STORY TO KNOW THEIR WEAKNESS. OR JUST HIT THEM.', [
      ...list.map((d) => ({ label: d.char === '@player' ? 'DARK ' + this.save.heroes[0].name : d.name, hint: d.title, action: () => this.quickDuel(d) })),
      { label: 'BACK', action: () => this.showTitleMenu() },
    ]);
    void done;
  }

  // ---------------------------------------------------------------- helter og dueller
  heroSide(slot: number, human = true): DuelSide {
    const cfg = this.save.heroes[slot];
    const prog = this.progressOf(slot);
    const fx = statEffects(prog);
    return {
      cid: registerChar(buildHeroDef(cfg, slot)), name: cfg.name || 'NAMELESS', human, input: this.input.players[slot], player: slot,
      hp: 100 + fx.hpBonus, speed: 2.95 * fx.speedMul, dmg: fx.dmgMul, dmgTaken: fx.dmgTaken, weapon: weaponWithStats(WEAPONS[cfg.weapon], prog),
      taunts: ['BY CROM\'S COUSIN!', 'FOR THE HAM!', 'STEEL AND SWEAT!', 'NICE HAIR. SHAME ABOUT THE HEAD.'],
    };
  }

  duelistSide(d: DuelistDef): DuelSide {
    let cid = d.char;
    let name = d.name;
    let weapon;
    if (d.char === '@player') {
      const cfg: HeroConfig = { ...this.save.heroes[0] };
      cid = registerChar(buildHeroDef(cfg, 7));
      name = 'DARK ' + cfg.name;
      weapon = WEAPONS[cfg.weapon];
    }
    return { cid, name, human: false, hp: d.hp, speed: d.speed, dmg: d.dmg, tint: d.tint, scale: d.scale, weapon, skill: d.skill, aggression: d.aggression, taunts: d.taunts };
  }

  private duelIntro(d: DuelistDef): [string, string][] {
    const hero = this.save.heroes[0].name;
    return d.intro.map(([w, t]) => [w.replace('DARK YOU', 'DARK ' + hero), t]);
  }

  goDuel(cfg: DuelConfig, onEnd: (w: 0 | 1) => void) {
    this.setScene(() => new DuelScene(this, cfg, onEnd));
  }

  private quickDuel(d: DuelistDef) {
    audio.init();
    W.resetStats();
    this.input.solo = true;
    this.goDuel({ a: this.heroSide(0), b: this.duelistSide(d), intro: this.duelIntro(d), roundsToWin: 2, arena: d.arena }, (w) => {
      this.menuMode();
      audio.play('victory');
      this.screens.result(w === 0 ? 'YOU WIN!' : 'YOU LOSE!', w === 0 ? d.name + ' WILL NEED A NEW HOBBY.' : d.name + ' REMAINS SMUG.', [
        { label: 'REMATCH', action: () => this.quickDuel(d) },
        { label: 'TITLE', action: () => this.goTitle() },
      ]);
    });
  }

  private pvpDuel() {
    audio.init();
    W.resetStats();
    this.input.solo = false;
    const a = this.heroSide(0);
    const b = this.heroSide(1);
    this.goDuel({ a, b, roundsToWin: 2, arena: pick(['pit', 'ice', 'bone'] as const), intro: [['ANNOUNCER', a.name + ' VERSUS ' + b.name + '! ONLY ONE LEAVES WITH A HEAD!']] }, (w) => {
      this.menuMode();
      audio.play('victory');
      this.screens.result((w === 0 ? a.name : b.name) + ' WINS!', 'THE LOSER HAS BEEN SWEPT UP BY A UNIONIZED IMP.', [
        { label: 'REMATCH', action: () => this.pvpDuel() },
        { label: 'TITLE', action: () => this.goTitle() },
      ]);
    });
  }

  // ---------------------------------------------------------------- heltebygger
  openCreator(slots: number[], onDone: () => void) {
    this.setScene(() => new CreatorScene(this, slots, onDone));
  }

  // ---------------------------------------------------------------- historie og kart
  startStory(twoP: boolean) {
    audio.init();
    this.twoP = twoP;
    this.input.solo = !twoP;
    W.resetStats();
    const need = twoP ? [0, 1] : [0];
    const missing = need.filter((i) => !this.save.heroMade[i]);
    const go = () => {
      if (!this.save.intro) {
        this.save.intro = true;
        this.persist();
        this.menuMode();
        audio.stop();
        this.screens.intro(INTRO, () => this.goMap());
      } else this.goMap();
    };
    if (missing.length) this.openCreator(need, go);
    else go();
  }

  goMap() {
    this.input.solo = !this.twoP;
    this.setScene(() => new MapScene(this, (n) => this.enterNode(n)));
  }

  private enterNode(n: MapNode) {
    this.persist();
    if (n.kind === 'home') {
      showCamp(this, () => this.backToMap());
      return;
    }
    this.menuMode();
    if (n.kind === 'level' && n.level) {
      const lv = LEVELS[n.level];
      this.screens.cutscene(lv.subtitle, [['NARRATOR', lv.intro]], () => this.playLevel(n));
      return;
    }
    if (n.kind === 'arena' && n.duel) this.playDuelNode(n, DUELISTS[n.duel]);
  }

  /** Lukk en meny over kartet og oppdater panelet (gull, poeng). */
  backToMap() {
    this.screens.hide();
    (this.scene as { refresh?: () => void }).refresh?.();
  }

  private heroRoster(): DuelSide[] {
    return this.twoP ? [this.heroSide(0), this.heroSide(1)] : [this.heroSide(0)];
  }

  private playLevel(n: MapNode) {
    const lv = LEVELS[n.level!];
    this.setScene(() => new StageScene(this, lv.id, (r) => {
      if (r === 'complete') this.nodeComplete(n, lv.nightCamp ? this.campSupplies() : []);
      else if (r === 'duel' && lv.finale.type === 'duel') this.playDuelNode(n, DUELISTS[lv.finale.duelist], true);
      else this.gameOver(() => this.playLevel(n), pick(GAMEOVER_QUIPS));
    }));
  }

  private playDuelNode(n: MapNode, d: DuelistDef, finale = false) {
    const intro = this.duelIntro(d);
    if (this.twoP) intro.push(['ANNOUNCER', 'TAG TEAM RULES: THE BARBARIANS TAKE TURNS!']);
    this.goDuel({ a: this.heroRoster(), b: this.duelistSide(d), intro, roundsToWin: 2, arena: d.arena }, (w) => {
      if (w === 0) W.stats.xp += XP_DUEL;
      if (w === 0) this.nodeComplete(n);
      else this.gameOver(() => this.playDuelNode(n, d, finale), d.name + ' REMAINS UNDEFEATED. FOR NOW.');
    });
  }

  private gameOver(retry: () => void, quip: string) {
    this.menuMode();
    audio.stop();
    // Litt lærdom blir med selv når det går galt
    const xp = Math.floor(W.stats.xp / 2);
    this.awardXp(xp);
    this.persist();
    this.screens.gameover([
      { label: 'TRY AGAIN', action: () => {
        W.resetStats();
        retry();
      } },
      { label: 'WORLD MAP', action: () => this.goMap() },
    ], quip + (xp ? ` (YOU STILL LEARNED SOMETHING: +${xp} XP)` : ''));
  }

  /** Krukkene heltene fikk med seg fra nattleiren blir forsyninger (to krukker per forsyning, høyst tre). */
  private campSupplies(): [string, string][] {
    const st = (this.scene as StageScene).stage;
    const pots = st ? st.heroes.reduce((a, h) => a + h.potions, 0) : 0;
    const s = this.save;
    const add = Math.min(3 - s.supplies.potions, Math.ceil(pots / 2));
    if (add <= 0) return pots ? [['SUPPLY WAGON', 'THE WAGON IS FULL. YOU DRINK THE REST. IT IS FINE.']] : [['SUPPLY WAGON', 'THE GNOMES GOT EVERYTHING. EVEN THE WAGON.']];
    s.supplies.potions += add;
    return [['SUPPLY WAGON', `+${add * 2} POTIONS SAVED FOR THE NEXT STAGE.`]];
  }

  private nodeComplete(n: MapNode, extra: [string, string][] = []) {
    const s = this.save;
    const first = !s.completed.includes(n.id);
    const lines: [string, string][] = [...extra];
    if (first) {
      s.completed.push(n.id);
      if (n.reward?.gold) {
        s.gold += n.reward.gold;
        lines.push(['TREASURER', `+${n.reward.gold} GOLD.`]);
      }
      for (const u of n.reward?.unlock ?? []) {
        if (!s.unlocked.includes(u)) s.unlocked.push(u);
        const [k, i] = u.split(':');
        lines.push(['HERO FORGE', 'UNLOCKED: ' + (HERO_OPTIONS[k as keyof typeof HERO_OPTIONS]?.[Number(i)] ?? u)]);
      }
      const newly = MAP_NODES.filter((m) => !s.completed.includes(m.id) && m.requires.includes(n.id));
      if (newly.length) lines.push(['CARTOGRAPHER', 'NEW PLACES TO RUIN: ' + newly.map((m) => m.name).join(', ')]);
    }
    s.gold += W.stats.gold;
    s.node = n.id;
    lines.push(...this.awardXp(W.stats.xp + (first ? XP_STAGE_FIRST : XP_STAGE_REPEAT)));
    W.stats.xp = 0;
    this.persist();
    this.menuMode();
    if (n.id === 'tower') {
      audio.play('victory');
      this.screens.victory(W.stats, [
        ['VORTHAX', 'CURSES! DEFEATED BY A LOINCLOTH! ...I HAVE A SISTER, YOU KNOW.'],
        ['PRINCESS AMBERLY', `JUST SO YOU KNOW, ${s.heroes[0].name}, I AM NOT KISSING ANYONE.`],
        ['NARRATOR', 'THE HAM WAS NEVER SEEN AGAIN. THE END. (FOR NOW.)'],
      ], () => this.goMap());
      return;
    }
    audio.play('victory');
    this.screens.cutscene(n.kind === 'arena' ? 'VICTORY IN THE ARENA!' : 'STAGE CLEARED!', lines.length ? lines : [['NARRATOR', 'YOU WIN AGAIN. THE BARD IS RUNNING OUT OF RHYMES.']], () => this.goMap());
  }

  togglePause() {
    if (!this.scene.pausable) return;
    this.paused = !this.paused;
    if (this.paused) {
      const items = [{ label: 'RESUME', action: () => this.togglePause() }];
      if (this.scene.name === 'map') {
        items.push({ label: 'HERO FORGE', action: () => this.openCreator(this.twoP ? [0, 1] : [0], () => this.goMap()) });
        items.push({ label: 'TRAINING', action: () => showTraining(this, 0, () => { this.paused = false; this.togglePause(); }) });
      }
      else items.push({ label: 'WORLD MAP', action: () => (this.save.completed.length || this.scene.name !== 'duel' ? this.goMap() : this.goTitle()) });
      items.push({ label: 'SETTINGS', action: () => this.showSettings(() => { this.paused = false; this.togglePause(); }) });
      items.push({ label: 'QUIT TO TITLE', action: () => this.goTitle() });
      this.screens.pause(items);
    } else this.screens.hide();
  }

  // ---------------------------------------------------------------- løkke
  frame(now: number) {
    const realDt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    try {
      this.tick(realDt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  tick(realDt: number, render = true) {
    const inp = this.input;
    inp.update(realDt);
    // Oppstartslogoen ligger over alt og spiser all input
    if (this.splash) {
      W.time += realDt;
      this.scene.update(realDt, realDt);
      this.gore.update(realDt);
      if (render) this.post.render(W.scene, this.camera, realDt);
      return;
    }
    if (inp.keyPressedOnce('KeyM')) {
      audio.init();
      audio.toggleMute();
      if (this.scene.name === 'title' && !this.screens.active) this.showTitleMenu();
    }
    inp.clearOnce();
    let toggled = false;
    if (inp.pause && this.scene.pausable) {
      this.togglePause();
      toggled = true;
    }
    // En meny som var åpen denne framen "spiser" input, og en ny scene får ikke samme tastetrykk.
    const sceneBefore = this.scene;
    const screenWasActive = this.screens.active;
    if (this.screens.active && !toggled) this.screens.update(inp.menu, realDt);
    const blocked = this.scene !== sceneBefore || (screenWasActive && this.scene.name !== 'title');

    // Berøringskontroller bare når det spilles (menyer bruker trykk direkte)
    const playing = !this.screens.active && !this.paused && (this.scene.name === 'stage' || this.scene.name === 'duel' || this.scene.name === 'map');
    const touchOn = touchEnabled();
    this.touch.setVisible(touchOn && playing);
    if (this.app.classList.contains('touchmode') !== touchOn) this.app.classList.toggle('touchmode', touchOn);
    if (this.touch.visible) {
      this.touch.setLabels(this.scene.name === 'duel' ? { special: 'BLOCK', grab: 'ROLL' } : this.scene.name === 'map' ? { attack: 'ENTER', jump: 'ENTER', special: 'MENU', grab: 'STATS' } : {});
    }
    if (this.toastT > 0) {
      this.toastT -= realDt;
      if (this.toastT <= 0) this.toastEl.classList.remove('show');
    }

    const simDt = this.paused ? 0 : this.fx.hitstop > 0 ? 0 : realDt * this.fx.timeScale;
    W.time += simDt;
    wind.update(simDt);
    if (!this.paused && !blocked) this.scene.update(simDt, realDt);

    const cam = this.camera;
    this.gore.camQ.copy(cam.quaternion);
    this.gore.camX = cam.position.x;
    this.gore.update(simDt);
    W.env?.update(simDt, W.time, cam.position.x);
    this.fx.update(realDt, cam, this.width, this.height);
    if (!render) return;
    cam.position.add(this.fx.offset);
    this.post.render(W.scene, cam, realDt);
    cam.position.sub(this.fx.offset);
  }
}
