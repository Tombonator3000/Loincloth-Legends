// Spillmotoren: renderer, løkke, scenebytte og spillflyt (tittel, kart, brett, dueller, heltebygger).
import * as THREE from 'three';
import { InputManager, MOUSE_LEFT } from '../core/input';
import { audio } from '../core/audio';
import { Gore } from '../gfx/gore';
import { FX } from '../gfx/fx';
import { buildArena, type Env } from '../gfx/env';
import { HUD } from '../ui/hud';
import { Screens, type Item, type ControlsPage } from '../ui/screens';
import { TouchControls } from '../ui/touch';
import { Splash, wantSplash } from '../ui/splash';
import { settings, setSettings, onSettings, touchEnabled, GORE_NAMES, GORE_HINTS, QUALITY_SETTINGS, QUALITY_HINTS, type GoreLevel, type TouchMode, type QualitySetting } from '../core/settings';
import { PostFX, autoQuality, qualityRank, type Quality } from '../gfx/post';
import { screenFX } from '../gfx/screenfx';
import { QualityGovernor, PerfMeter, lighter } from './perf';
import { skyLight } from '../gfx/envlight';
import { wind } from '../gfx/wind';
import { STAGE_CAM } from '../gfx/stagecam';
import { W } from '../game/world';
import { Stage } from '../game/stage';
import { Duel, type DuelConfig, type DuelSide } from '../game/duel';
import { Fighter } from '../game/fighter';
import { DUEL_ATK } from '../game/attacks';
import { buildHeroDef, cloneHero, HERO_OPTIONS } from '../gfx/chars/hero';
import { registerChar } from '../gfx/chars';
import { WEAPONS } from '../data/weapons';
import { LEVELS } from '../data/levels';
import { levelWithLayout } from '../data/layout';
import { EditorScene } from './scenes/editor';
import { layoutFor } from '../data/layouts';
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

/**
 * AUTO velger ut fra enheten, eller det lavere nivået AUTO har trappet ned til fordi bildet hakket
 * (settings.autoQuality, se app/perf.ts). Ellers brukes nivået direkte.
 */
function resolveQuality(q: QualitySetting): Quality {
  if (q !== 'auto') return q;
  const guess = autoQuality();
  const saved = settings.autoQuality;
  return saved && qualityRank(saved) < qualityRank(guess) ? saved : guess;
}

/** Automatisk grafikkvalitet og tap av WebGL gjelder ikke automatiske tester, med mindre adressen har ?autotune. */
function autoTuneAllowed() {
  try {
    return !navigator.webdriver || new URLSearchParams(location.search).has('autotune');
  } catch {
    return true;
  }
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
    const cfg = cloneHero(s.heroes[0]);
    const a = new Fighter(registerChar(buildHeroDef(cfg, 0)), 'hero', { hp: 100, speed: 3, weapon: WEAPONS[cfg.weapon] });
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
      W.fx.lightningFlash(0.25, 0.12);
      // Lynet slår ned langt bak kjempene: buldringen kommer litt etter
      audio.thunder(0.35, 0.7);
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
  constructor(private game: Game, levelId: string, private onEnd: (r: 'complete' | 'duel' | 'gameover') => void, startX?: number) {
    const cfgs = game.twoP ? [game.save.heroes[0], game.save.heroes[1]] : [game.save.heroes[0]];
    // Prøvespill fra brettverkstedet bruker ikke opp forsyningene fra nattleiren
    const test = startX !== undefined;
    const sup = test ? { lives: 0, potions: 0 } : { lives: game.save.supplies?.lives ?? 0, potions: game.save.supplies?.potions ?? 0 };
    if (!test) {
      game.save.supplies = { lives: 0, potions: 0 };
      game.persist();
    }
    // Spilldata fra brettfila (bølger, tønner, farer, ryttere) går foran levels.ts
    const level = levelWithLayout(LEVELS[levelId], layoutFor(levelId));
    this.stage = new Stage(game.hud, level, cfgs, game.input.players, [game.progressOf(0), game.progressOf(1)], sup);
    // Testspill fra brettverkstedet: start der kameraet sto
    if (startX !== undefined) this.stage.startAt(startX);
    if (sup.lives || sup.potions) setTimeout(() => game.toast(`SUPPLIES: +${sup.lives} LIFE, +${sup.potions * 2} POTIONS`), 600);
    game.hud.visible(true);
    game.screens.hide();
    game.camera.position.set(this.stage.camX, STAGE_CAM.y, STAGE_CAM.z);
  }
  update(dt: number, realDt: number) {
    const st = this.stage;
    st.update(dt);
    const cam = this.game.camera;
    cam.position.x += (st.camX - cam.position.x) * Math.min(1, realDt * 8);
    // Kjemper i bildet: kameraet trekker seg bakover og ser litt høyere
    const pull = st.camPull;
    cam.position.y = STAGE_CAM.y + pull * STAGE_CAM.pullY;
    cam.position.z = (cam.aspect < 1.2 ? STAGE_CAM.zNarrow : STAGE_CAM.z) + pull * STAGE_CAM.pullZ;
    cam.lookAt(cam.position.x, STAGE_CAM.lookY + pull * STAGE_CAM.pullY, 0);
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

/** ?editor eller ?editor=road i adressen åpner brettverkstedet (null uten). */
function editorParam(): string | null {
  try {
    return new URLSearchParams(location.search).get('editor');
  } catch {
    return null;
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
  /** Valgene på tittelskjermen: antall spillere i historien (0 = ikke valgt ennå) og duell mot CPU eller spiller 2. */
  private titlePlayers: 0 | 1 | 2 = 0;
  private titleVsP2 = false;
  paused = false;
  /** Et brett spilles fra brettverkstedet (PLAY FROM HERE): pausen og slutten går tilbake dit. */
  editorTest: { level: string } | null = null;
  last = performance.now();
  width = 1;
  height = 1;
  private qualitySet = false;
  /** Automatisk grafikkvalitet (app/perf.ts). */
  readonly governor = new QualityGovernor();
  /** Får AUTO trappe ned (ikke i automatiske tester, med mindre adressen har ?autotune). */
  autoTune = autoTuneAllowed();
  /** Første bilde etter at fanen ble synlig igjen (telles ikke av den automatiske kvaliteten). */
  private resumed = false;
  /** Ytelsesmåleren bak ?perf (null ellers). */
  private perf: PerfMeter | null = null;
  /** WebGL er mistet (mobil med lite minne, eller nettleseren la fanen i bakgrunnen). */
  glLost = false;
  private glLostT = 0;
  private glLostHidden = false;
  private glLostWarned = false;
  /** Selvtest etter nytt nivå: tre sjekker av om bildet er helt hvitt eller helt svart. */
  private checkN = 0;
  private checkF = 0;
  /** Tid til neste bilde i pause, og om neste bilde må tegnes uansett (ny størrelse, nytt nivå). */
  private pauseDrawT = 0;
  private drawNow = true;

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
      this.drawNow = true;
      audio.setVolumes(st.music, st.sfx);
      audio.setStyle(st.musicStyle);
      audio.setRecorded(st.recorded);
      this.gore.level = st.gore;
      const q = resolveQuality(st.quality);
      if (q !== this.post.quality || !this.qualitySet) {
        this.qualitySet = true;
        this.post.setQuality(q);
        this.resize();
        this.governor.reset(3);
        this.checkN = 0;
        this.checkF = 0;
      }
    });
    // WebGL kan mistes på mobil (for lite minne, eller når nettleseren legges i bakgrunnen). Three.js bygger opp
    // igjen det den eier når konteksten kommer tilbake; spillet pauser, venter og bygger resten (se contextLost).
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost();
    });
    this.canvas.addEventListener('webglcontextrestored', () => this.contextRestored());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (this.glLost) this.glLostT = 0;
      // Bildet etter et fanebytte er langt fordi fanen var skjult, ikke fordi skjermkortet er tregt
      this.resumed = true;
    });
    try {
      if (new URLSearchParams(location.search).has('perf')) this.perf = new PerfMeter(this.app);
    } catch {
      /* ingen adresse */
    }
    document.querySelector('.rotate-note')?.addEventListener('click', (e) => (e.currentTarget as HTMLElement).classList.add('dismissed'));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.goTitle();
    document.getElementById('boot')?.remove();
    const forge = editorParam();
    if (forge !== null) this.openEditor(forge && LEVELS[forge] ? forge : undefined);
    else if (wantSplash()) {
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
    screenFX.resize(this.width, this.height);
    this.drawNow = true;
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
    // Skjermeffektene og varmekildene nullstilles; miljøet legger inn sine egne når det bygges
    screenFX.reset();
    this.paused = false;
    this.hud.clear();
    this.scene = make();
    // Venstre museknapp slår bare på brettene og i duellene (på kartet ville et klikk startet et brett)
    this.input.mouseAttack = this.scene.name === 'stage' || this.scene.name === 'duel';
    if (!this.input.mouseAttack) this.input.keys.delete(MOUSE_LEFT);
    this.post.focus = -1;
    // make() kan ha satt W.env; TypeScript tror den fortsatt er null her
    const env = (W as { env: Env | null }).env;
    screenFX.wet.rain = env?.rain ?? 0;
    this.governor.reset(2);
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

  // ---------------------------------------------------------------- brettverkstedet
  /** STAGE FORGE, editoren for brettene (app/scenes/editor.ts). */
  openEditor(levelId?: string) {
    this.editorTest = null;
    this.paused = false;
    this.input.solo = true;
    this.setScene(() => new EditorScene(this, levelId));
    this.hud.visible(false);
  }

  /** Spill et brett fra editoren, fra x. Pausemenyen og slutten av brettet går tilbake til editoren. */
  testLevel(levelId: string, x: number) {
    this.editorTest = { level: levelId };
    this.twoP = false;
    W.resetStats();
    this.setScene(() => new StageScene(this, levelId, () => this.openEditor(levelId), x));
  }

  // ---------------------------------------------------------------- tittel
  goTitle() {
    this.editorTest = null;
    this.input.solo = true;
    this.setScene(() => new TitleScene(this));
    this.hud.visible(false);
    audio.play('title');
    this.showTitleMenu();
  }

  /** Tittelmenyen har fire knapper. Antall spillere og motstander velges med venstre/høyre på raden. */
  showTitleMenu(sel = 0) {
    if (!this.titlePlayers) this.titlePlayers = this.twoP ? 2 : 1;
    const items = this.titleItems();
    // Står tittelen allerede fremme, tegnes bare menyen på nytt (ellers starter logoen på nytt ved hver pil)
    if (this.screens.active && this.screens.kind === 'title' && this.screens.relist(items, sel)) return;
    this.screens.title(items, audio.muted, sel);
  }

  private titleItems(): Item[] {
    const s = this.save;
    const progress = s.completed.length > 0;
    const two = this.titlePlayers === 2;
    const p2 = this.titleVsP2;
    return [
      {
        label: progress ? 'CONTINUE' : 'STORY', value: two ? '2 PLAYERS' : '1 PLAYER',
        hint: two ? 'CO-OP ON ONE KEYBOARD OR GAMEPADS' : 'WORLD MAP, BOSSES AND DUELS',
        action: () => this.startStory(two),
        adjust: () => {
          this.titlePlayers = two ? 1 : 2;
          this.showTitleMenu(0);
        },
      },
      {
        label: 'DUEL', value: p2 ? 'VS PLAYER 2' : 'VS CPU',
        hint: p2 ? s.heroes[0].name + ' VS ' + s.heroes[1].name : 'CHOOSE YOUR VICTIM',
        action: () => (p2 ? this.pvpDuel() : this.duelMenu()),
        adjust: () => {
          this.titleVsP2 = !p2;
          this.showTitleMenu(1);
        },
      },
      { label: 'HERO FORGE', hint: 'FORGE YOUR OWN HERO', action: () => this.openCreator([0, 1], () => this.goTitle()) },
      { label: 'OPTIONS', hint: 'GORE, SOUND, SCREEN AND CONTROLS', action: () => this.showSettings(() => this.showTitleMenu(3)) },
      // Brettverkstedet på tittelen bare under npm run dev (ellers med ?editor i adressen)
      ...(import.meta.env.DEV ? [{ label: 'STAGE FORGE', hint: 'LEVEL EDITOR: LAYERS, PROPS AND ANIMATION', action: () => this.openEditor() }] : []),
    ];
  }

  // ---------------------------------------------------------------- innstillinger
  /** OPTIONS: gore og tre grupper (lyd, skjerm, kontroller). Sletting av lagringen bare fra tittelen. */
  showSettings(onBack: () => void, sel = 0) {
    const again = (i: number) => this.showSettings(onBack, i);
    const gore = (d: number) => {
      setSettings({ gore: ((((settings.gore + d) % 4) + 4) % 4) as GoreLevel });
      again(0);
    };
    const items: Item[] = [
      { label: 'GORE', value: GORE_NAMES[settings.gore], hint: GORE_HINTS[settings.gore], action: () => gore(1), adjust: gore },
      { label: 'SOUND', more: true, hint: 'MUSIC, THE BAND AND THE CRUNCHES', action: () => this.showSettingsGroup('sound', () => again(1)) },
      { label: 'SCREEN', more: true, hint: 'GRAPHICS, FULLSCREEN, SHAKE AND FLASHES', action: () => this.showSettingsGroup('screen', () => again(2)) },
      { label: 'CONTROLS', more: true, hint: 'KEYS, MOVES, RUMBLE AND TOUCH', action: () => this.showControls(() => again(3)) },
    ];
    if (this.scene.name === 'title') items.push({ label: 'ERASE SAVE', hint: 'ALL PROGRESS AND HEROES. NO TAKEBACKS.', action: () => this.confirmReset(() => again(4)) });
    items.push({ label: 'BACK', action: onBack });
    this.screens.custom(`<div class="panel settings"><h2>OPTIONS</h2><ul class="menu rows"></ul></div>`, items, sel, onBack);
  }

  /** Én gruppe innstillinger: lyd eller skjerm. */
  showSettingsGroup(group: 'sound' | 'screen', onBack: () => void, sel = 0) {
    const pct = (v: number) => Math.round(v * 100) + '%';
    const step = (v: number, d: number) => Math.max(0, Math.min(1, Math.round((v + d * 0.1) * 10) / 10));
    const onOff = (b: boolean) => (b ? 'ON' : 'OFF');
    const again = (i: number) => this.showSettingsGroup(group, onBack, i);
    const items: Item[] = [];
    // Hver rad får vite sin egen plass, så menyen tegnes på nytt med riktig rad valgt
    const row = (make: (i: number) => Item) => items.push(make(items.length));
    const toggle = (label: string, get: () => boolean, set: (b: boolean) => void, hints?: [string, string], after?: () => void) => row((i) => {
      const flip = () => {
        set(!get());
        after?.();
        again(i);
      };
      return { label, value: onOff(get()), hint: hints ? (get() ? hints[0] : hints[1]) : undefined, action: flip, adjust: flip };
    });
    if (group === 'sound') {
      row((i) => ({ label: 'MUSIC', value: pct(settings.music), hint: 'THE BAND. LEFT AND RIGHT CHANGE THE VOLUME.', action: () => { setSettings({ music: settings.music >= 1 ? 0 : step(settings.music, 1) }); again(i); }, adjust: (d) => { setSettings({ music: step(settings.music, d) }); again(i); } }));
      row((i) => {
        const flip = () => {
          setSettings({ musicStyle: settings.musicStyle === 'metal' ? 'chip' : 'metal' });
          again(i);
        };
        return { label: 'MUSIC STYLE', value: settings.musicStyle === 'metal' ? 'HEAVY METAL' : '8-BIT', hint: settings.musicStyle === 'metal' ? 'DISTORTION, DOUBLE KICK, GUITAR SOLOS' : 'THE OLD CHIPTUNES', action: flip, adjust: flip };
      });
      row((i) => ({ label: 'SOUND FX', value: pct(settings.sfx), hint: 'CRUNCHES, SPLATS AND SCREAMS.', action: () => { setSettings({ sfx: settings.sfx >= 1 ? 0 : step(settings.sfx, 1) }); audio.hit(); again(i); }, adjust: (d) => { setSettings({ sfx: step(settings.sfx, d) }); audio.hit(); again(i); } }));
      toggle('RECORDED SOUNDS', () => settings.recorded, (b) => setSettings({ recorded: b }), ['REAL CRUNCHES AND THUNDER OVER THE SYNTH', 'SYNTH ONLY. VERY 1984.'], () => audio.hit(true));
    } else {
      row((i) => {
        const cycle = (d: number) => {
          const q = QUALITY_SETTINGS.indexOf(settings.quality);
          // Et nytt valg gir AUTO en ny sjanse (glemmer hvor langt den har trappet ned)
          setSettings({ quality: QUALITY_SETTINGS[(q + d + QUALITY_SETTINGS.length) % QUALITY_SETTINGS.length] as QualitySetting, autoQuality: '' });
          again(i);
        };
        return { label: 'GRAPHICS', value: settings.quality.toUpperCase() + (settings.quality === 'auto' ? ' (' + this.post.quality.toUpperCase() + ')' : ''), hint: QUALITY_HINTS[settings.quality], action: () => cycle(1), adjust: cycle };
      });
      row((i) => {
        const flip = () => {
          this.toggleFullscreen();
          setTimeout(() => again(i), 250);
        };
        return { label: 'FULLSCREEN', value: onOff(!!document.fullscreenElement), hint: 'MORE SCREEN, MORE BLOOD.', action: flip, adjust: flip };
      });
      toggle('SCREEN SHAKE', () => settings.shake, (b) => setSettings({ shake: b }), ['THE CAMERA FLINCHES AT THE BIG HITS.', 'THE CAMERA KEEPS ITS COOL.']);
      toggle('FLASHES', () => settings.flashes, (b) => setSettings({ flashes: b }), ['WHITE FLASHES AND LIGHTNING', 'NO WHITE FLASHES. EASIER ON THE EYES.']);
      toggle('SCREEN DISTORTION', () => settings.distortion, (b) => setSettings({ distortion: b }), ['SHOCKWAVES, ZOOM AND HEAT SHIMMER', 'A STEADY PICTURE. THE BLOOD STILL RUNS.']);
    }
    items.push({ label: 'BACK', action: onBack });
    this.screens.custom(`<div class="panel settings"><h2>${group === 'sound' ? 'SOUND' : 'SCREEN'}</h2><ul class="menu rows"></ul></div>`, items, sel, onBack);
  }

  /** Kontrollskjermen: tre sider (tastene, brettene, duellene), med rumble og berøring nederst. */
  showControls(onBack: () => void, sel = 0, page: ControlsPage = 'keys') {
    const PAGES: ControlsPage[] = ['keys', 'stages', 'duels'];
    const NAMES: Record<ControlsPage, string> = { keys: 'KEYS', stages: "BEAT 'EM UP", duels: 'DUELS' };
    const TOUCH: TouchMode[] = ['auto', 'on', 'off'];
    const again = (i: number) => this.showControls(onBack, i, page);
    const flip = (d: number) => this.showControls(onBack, 0, PAGES[(PAGES.indexOf(page) + d + PAGES.length) % PAGES.length]);
    const rumble = () => {
      setSettings({ rumble: !settings.rumble });
      this.input.rumble(-1, 0.6, 0.6, 200);
      again(1);
    };
    const touch = (d: number) => {
      setSettings({ touch: TOUCH[(TOUCH.indexOf(settings.touch) + d + 3) % 3] });
      again(2);
    };
    this.screens.controls(page, [
      { label: 'SHOW', value: NAMES[page], hint: 'LEFT AND RIGHT: KEYS, BEAT \'EM UP MOVES, DUEL MOVES', action: () => flip(1), adjust: flip },
      { label: 'GAMEPAD RUMBLE', value: settings.rumble ? 'ON' : 'OFF', hint: settings.rumble ? 'THE PAD SHAKES WHEN SOMETHING GETS HIT.' : 'NO SHAKING. THE PAD IS AT PEACE.', action: rumble, adjust: rumble },
      { label: 'TOUCH CONTROLS', value: settings.touch.toUpperCase(), hint: 'AUTO = ON FOR PHONES AND TABLETS', action: () => touch(1), adjust: touch },
    ], onBack, sel);
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' } as FullscreenOptions)?.catch?.(() => {});
    } catch {
      /* ikke støttet */
    }
  }

  private confirmReset(onCancel: () => void) {
    this.screens.result('ERASE SAVE?', 'ALL PROGRESS AND HEROES WILL BE ERASED. THE HAM REMAINS HALF-EATEN.', [
      { label: 'NO, GO BACK', action: onCancel },
      { label: 'YES, ERASE', action: () => {
        this.save = defaultSave();
        this.persist();
        this.titlePlayers = 0;
        this.showTitleMenu();
      } },
    ], 0, onCancel);
  }

  private duelMenu() {
    const done = new Set(this.save.completed);
    const list = Object.values(DUELISTS);
    this.screens.custom(`<div class="panel duels"><h2>CHOOSE YOUR VICTIM</h2><p class="line">BEAT THEM IN THE STORY TO KNOW THEIR WEAKNESS. OR JUST HIT THEM.</p><ul class="menu"></ul></div>`, [
      ...list.map((d) => ({ label: d.char === '@player' ? 'DARK ' + this.save.heroes[0].name : d.name, hint: d.title, action: () => this.quickDuel(d) })),
      { label: 'BACK', action: () => this.showTitleMenu(1) },
    ], 0, () => this.showTitleMenu(1));
    void done;
  }

  // ---------------------------------------------------------------- helter og dueller
  heroSide(slot: number, human = true): DuelSide {
    const cfg = cloneHero(this.save.heroes[slot]);
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
      const cfg = cloneHero(this.save.heroes[0]);
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
      // Seiersmusikk bare når spilleren vant (før spilte den også når spilleren tapte)
      if (w === 0) audio.play('victory');
      else audio.defeat();
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
  openCreator(slots: number[], onDone: () => void, onCancel: () => void = onDone) {
    this.setScene(() => new CreatorScene(this, slots, onDone, onCancel));
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
    if (missing.length) this.openCreator(need, go, () => this.goTitle());
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
    // Musikken tones ut, og tapslyden kommer i tonearten til låta som spilte
    audio.defeat();
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
      const test = this.editorTest;
      if (test && this.scene.name === 'stage') items.push({ label: 'BACK TO STAGE FORGE', action: () => this.openEditor(test.level) });
      else if (this.scene.name === 'map') {
        items.push({ label: 'HERO FORGE', action: () => this.openCreator(this.twoP ? [0, 1] : [0], () => this.goMap()) });
        items.push({ label: 'TRAINING', action: () => showTraining(this, 0, () => { this.paused = false; this.togglePause(); }) });
      }
      else items.push({ label: 'WORLD MAP', action: () => (this.save.completed.length || this.scene.name !== 'duel' ? this.goMap() : this.goTitle()) });
      items.push({ label: 'OPTIONS', action: () => this.showSettings(() => { this.paused = false; this.togglePause(); }) });
      items.push({ label: 'QUIT TO TITLE', action: () => this.goTitle() });
      this.screens.pause(items);
    } else this.screens.hide();
  }

  // ---------------------------------------------------------------- ytelse og WebGL
  /** Spilles det nå (brett eller duell, ingen meny eller pause)? Da måler den automatiske kvaliteten. */
  private get measuring() {
    return (this.scene.name === 'stage' || this.scene.name === 'duel') && !this.paused && !this.screens.active && !this.splash && !this.glLost && !document.hidden;
  }

  /** Ett trinn ned med AUTO: lagres, så neste lasting starter der. */
  stepDown(to: Quality, why: string) {
    if (settings.quality !== 'auto' || qualityRank(to) >= qualityRank(this.post.quality)) return false;
    setSettings({ autoQuality: to as 'low' | 'medium' | 'high' });
    this.toast('GRAPHICS ADJUSTED: ' + to.toUpperCase() + (why ? ' (' + why + ')' : ''), 3.5);
    return true;
  }

  private contextLost() {
    this.glLost = true;
    this.glLostT = 0;
    this.glLostWarned = false;
    this.glLostHidden = document.hidden;
    if (this.scene.pausable && !this.paused) this.togglePause();
    if (!document.hidden) this.toast('THE GRAPHICS FAINTED. WAITING FOR THEM TO WAKE UP...', 8);
  }

  private contextRestored() {
    this.glLost = false;
    // Three.js har bygget opp sine egne ting igjen, og målene i bildepipelinen lages på nytt første gang de brukes.
    // Det som bare fantes på skjermkortet, må tegnes på nytt: skyggekartet og miljøkartet fra himmelen.
    // Ble konteksten mistet mens fanen var synlig, var det trolig minnet: ett trinn ned med AUTO.
    this.post.recover();
    const next = lighter(this.post.quality);
    const stepped = !this.glLostHidden && this.autoTune && this.stepDown(next, 'GRAPHICS RESTORED');
    if (!stepped) this.toast('THE GRAPHICS ARE BACK', 2.5);
    this.renderer.shadowMap.needsUpdate = true;
    skyLight(this.renderer, W.scene, undefined, true);
    this.checkN = 0;
    this.checkF = 0;
  }

  /**
   * Selvtest etter nytt nivå (Morbidium, 04_render.js): blir bildet helt hvitt eller helt svart (noen
   * skjermkort takler ikke flyttallsmål), går spillet ned til LOW, som tegner rett til skjermen.
   */
  private selfTest() {
    if (this.checkN >= 3 || !this.post.enabled || this.glLost) return;
    if (++this.checkF % 20 !== 0) return;
    this.checkN++;
    try {
      const gl = this.renderer.getContext();
      if (gl.isContextLost()) return;
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
      let white = 0, blank = 0;
      for (let i = 1; i <= 3; i++) {
        for (let j = 1; j <= 3; j++) {
          gl.readPixels(Math.floor((w * i) / 4), Math.floor((h * j) / 4), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          if (px[0] > 247 && px[1] > 247 && px[2] > 247) white++;
          if (px[0] + px[1] + px[2] === 0) blank++;
        }
      }
      if (white >= 8 || blank >= 9) {
        const why = white >= 8 ? 'WHITE SCREEN' : 'BLANK SCREEN';
        if (settings.quality === 'auto') this.stepDown('low', why);
        else setSettings({ quality: 'low' });
        this.toast('GRAPHICS SET TO LOW (' + why + ')', 4);
      }
    } catch {
      /* lesing er ikke mulig */
    }
  }

  // ---------------------------------------------------------------- løkke
  frame(now: number) {
    const raw = Math.max(0, (now - this.last) / 1000);
    const realDt = Math.min(0.05, raw);
    this.last = now;
    const t0 = performance.now();
    try {
      this.tick(realDt);
    } catch (e) {
      console.error(e);
    }
    // Automatisk kvalitet: ekte tid mellom bildene (ikke klemt), bare når det spilles
    if (settings.quality === 'auto' && this.autoTune) {
      const down = this.governor.sample(raw, this.measuring && !this.resumed, this.post.quality);
      if (down) this.stepDown(down, Math.round(this.governor.lastFps) + ' FPS');
    }
    this.resumed = false;
    if (this.perf) {
      this.perf.record(raw * 1000, performance.now() - t0);
      const r = this.renderer.info.render;
      this.perf.show(raw, { quality: this.post.quality, auto: settings.quality === 'auto' ? 'AUTO' : '', calls: r.calls, tris: r.triangles, fps: this.governor.lastFps });
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
    // M demper lyden (ikke i brettverkstedet, der tastene er snarveier)
    if (inp.keyPressedOnce('KeyM') && this.scene.name !== 'editor') {
      audio.init();
      audio.toggleMute();
      this.screens.setMuted(audio.muted);
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
      this.touch.setLabels(this.scene.name === 'duel' ? { special: 'BLOCK' } : this.scene.name === 'map' ? { attack: 'ENTER', jump: 'ENTER', special: 'MENU' } : {});
    }
    if (this.toastT > 0) {
      this.toastT -= realDt;
      if (this.toastT <= 0) this.toastEl.classList.remove('show');
    }

    // Musikken dempes mens spillet står på pause (core/audio.ts)
    audio.setPaused(this.paused);
    const simDt = this.paused ? 0 : this.fx.hitstop > 0 ? 0 : realDt * this.fx.timeScale;
    W.time += simDt;
    wind.update(simDt);
    if (!this.paused && !blocked) this.scene.update(simDt, realDt);

    const cam = this.camera;
    this.gore.camQ.copy(cam.quaternion);
    this.gore.camX = cam.position.x;
    this.gore.update(simDt);
    W.env?.update(simDt, W.time, cam.position.x);
    // Skjermeffektene går på ekte tid (slowmo og hitstop gjelder verden, ikke glasset), men står i pause.
    // Kameradykket settes før teksten plasseres, så flytende tekst følger bildet.
    screenFX.update(this.paused ? 0 : realDt, cam);
    this.post.update(this.paused ? 0 : realDt);
    if (cam.zoom !== screenFX.camZoom) {
      cam.zoom = screenFX.camZoom;
      cam.updateProjectionMatrix();
    }
    this.fx.update(realDt, cam, this.width, this.height);
    // Skyggekartet tegnes ikke på nytt i pause (ingenting flytter seg), men én gang når tilstanden skifter
    const sm = this.renderer.shadowMap;
    if (sm.autoUpdate === this.paused) {
      sm.autoUpdate = !this.paused;
      sm.needsUpdate = true;
    }
    if (!render || this.glLost) {
      // Mistet mens fanen var skjult (bytte av app): de åtte sekundene telles først når siden synes igjen
      if (this.glLost && !document.hidden) {
        this.glLostT += realDt;
        if (this.glLostT > 8 && !this.glLostWarned) {
          // Kom den ikke tilbake: be om ny lasting, og start ett trinn lettere neste gang (bare med AUTO)
          this.glLostWarned = true;
          if (settings.quality === 'auto') setSettings({ autoQuality: lighter(this.post.quality) as 'low' | 'medium' | 'high' });
          this.toast('THE GRAPHICS DID NOT COME BACK. RELOAD THE PAGE.', 30);
        }
      }
      return;
    }
    // I pause står bildet stille: tegn det bare fire ganger i sekundet (og med en gang etter ny størrelse eller
    // nytt nivå), så en telefon slipper hele etterbehandlingen hver frame. Lerretet viser det siste bildet imens.
    if (this.paused && !this.drawNow) {
      this.pauseDrawT -= realDt;
      if (this.pauseDrawT > 0) return;
      this.pauseDrawT = 0.25;
    } else this.pauseDrawT = 0;
    this.drawNow = false;
    if (this.perf) {
      this.renderer.info.autoReset = false;
      this.renderer.info.reset();
    }
    cam.position.add(this.fx.offset);
    this.post.render(W.scene, cam, realDt);
    cam.position.sub(this.fx.offset);
    this.selfTest();
  }
}
