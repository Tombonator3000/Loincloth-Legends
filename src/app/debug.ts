// Testkrok: eksponerer noen moduler på window.__lib slik at Playwright-testene kan bygge scener direkte.
// Brukes ikke av selve spillet.
import * as THREE from 'three';
import { Fighter } from '../game/fighter';
import { W } from '../game/world';
import { registerChar, getChar } from '../gfx/chars';
import { buildHeroDef, cloneHero, withHeroParts, PRESETS, randomHero, HERO_OPTIONS } from '../gfx/chars/hero';
import { HERO_PARTS, defaultHeroParts } from '../data/hero-parts';
import { headCanvas, NEUTRAL } from '../gfx/rig';
import { charUniforms } from '../gfx/charlight';
import { MetalBand, METAL_TRACKS } from '../core/metal';
import { cabinetIR, guitarAmp } from '../core/guitaramp';
import { audio } from '../core/audio';
import { Conductor, BandPerformer } from '../core/conductor';
import { WEAPONS } from '../data/weapons';
import { settings, setSettings } from '../core/settings';
import { defaultSave, loadSave, writeSave } from './save';
import { images, getOverride } from '../gfx/assets';
import { screenFX } from '../gfx/screenfx';
import { applyHit } from '../game/combat';
import { HERO_ATK, ENEMY_ATK, DUEL_ATK, P } from '../game/attacks';
import { showCamp, showShop, showTraining } from './camp';
import { FOES } from '../data/enemies';
import { BOSSES } from '../data/bosses';

export function installDebug() {
  (window as unknown as { __lib: unknown }).__lib = {
    THREE, Fighter, W, registerChar, getChar, buildHeroDef, PRESETS, randomHero, HERO_OPTIONS, headCanvas, WEAPONS, settings, setSettings, defaultSave, charUniforms, MetalBand, METAL_TRACKS, Conductor, BandPerformer, audio, images,
    screenFX, applyHit, HERO_ATK, ENEMY_ATK, DUEL_ATK, P, NEUTRAL, FOES, BOSSES, showCamp, showShop, showTraining, cabinetIR, guitarAmp,
    cloneHero, withHeroParts, HERO_PARTS, defaultHeroParts, loadSave, writeSave, getOverride,
  };
}
