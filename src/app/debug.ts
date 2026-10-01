// Testkrok: eksponerer noen moduler på window.__lib slik at Playwright-testene kan bygge scener direkte.
// Brukes ikke av selve spillet.
import * as THREE from 'three';
import { Fighter } from '../game/fighter';
import { W } from '../game/world';
import { registerChar, getChar } from '../gfx/chars';
import { buildHeroDef, cloneHero, withHeroParts, withHeroAppearance, PRESETS, randomHero, HERO_OPTIONS } from '../gfx/chars/hero';
import { HERO_PARTS, defaultHeroParts, isModularHeroHead } from '../data/hero-parts';
import { HERO_APPEARANCE_KEYS, HERO_APPEARANCE, defaultHeroAppearance, sanitizeHeroAppearance, findHeroAppearance } from '../data/hero-appearance';
import { headCanvas, headImage, NEUTRAL, purgeChar } from '../gfx/rig';
import { heroHeadPreview, heroSkinSupport, heroAppearanceAvailable, heroAppearanceCacheStats, composeHeroHead, applyHeroSkin, purgeHeroAppearance } from '../gfx/hero-appearance';
import { HERO_SKIN_REGIONS } from '../data/hero-skin-regions';
import { HERO_APPEARANCE_LAYOUTS } from '../data/hero-appearance-layout';
import { charUniforms } from '../gfx/charlight';
import { MetalBand, METAL_TRACKS } from '../core/metal';
import { cabinetIR, guitarAmp } from '../core/guitaramp';
import { audio } from '../core/audio';
import { Conductor, BandPerformer } from '../core/conductor';
import { WEAPONS } from '../data/weapons';
import { settings, setSettings } from '../core/settings';
import { defaultSave, loadSave, writeSave } from './save';
import { images, getOverride, getAppearanceAsset } from '../gfx/assets';
import { screenFX } from '../gfx/screenfx';
import { applyHit } from '../game/combat';
import { HERO_ATK, ENEMY_ATK, DUEL_ATK, P, PB, bentPose } from '../game/attacks';
import { findGrab, grabbable, offBalance } from '../game/grab';
import { showCamp, showShop, showTraining } from './camp';
import { FOES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { LAYOUTS, layoutFor, setUnsavedLayout } from '../data/layouts';
import { validateLayout, levelWithLayout, layoutToJson, emptyLayout, LAYERS } from '../data/layout';
import { allProps, propKind, propIds, imageKind } from '../gfx/props/catalog';
import { Scenery, expandRun, trackValue } from '../gfx/scenery';
import { withSeed, hashSeed, random } from '../core/math';
import { LEVELS } from '../data/levels';
import { forgeState } from './scenes/editor';
import { MAP_NODES, MAP_EDGES, MAIN_ROUTE, stageName } from '../data/worldmap';
import { nodeOpen } from './scenes/map';

export function installDebug() {
  (window as unknown as { __lib: unknown }).__lib = {
    THREE, Fighter, W, registerChar, getChar, buildHeroDef, PRESETS, randomHero, HERO_OPTIONS, headCanvas, WEAPONS, settings, setSettings, defaultSave, charUniforms, MetalBand, METAL_TRACKS, Conductor, BandPerformer, audio, images,
    screenFX, applyHit, HERO_ATK, ENEMY_ATK, DUEL_ATK, P, PB, bentPose, findGrab, grabbable, offBalance, NEUTRAL, FOES, BOSSES, showCamp, showShop, showTraining, cabinetIR, guitarAmp,
    cloneHero, withHeroParts, HERO_PARTS, defaultHeroParts, loadSave, writeSave, getOverride,
    withHeroAppearance, isModularHeroHead, HERO_APPEARANCE_KEYS, HERO_APPEARANCE, defaultHeroAppearance, sanitizeHeroAppearance, findHeroAppearance,
    heroHeadPreview, heroSkinSupport, heroAppearanceAvailable, heroAppearanceCacheStats, composeHeroHead, applyHeroSkin, purgeHeroAppearance,
    HERO_SKIN_REGIONS, HERO_APPEARANCE_LAYOUTS, getAppearanceAsset, purgeChar, headImage,
    LAYOUTS, layoutFor, setUnsavedLayout, validateLayout, levelWithLayout, layoutToJson, emptyLayout, LAYERS, LEVELS,
    allProps, propKind, propIds, imageKind, Scenery, expandRun, trackValue, withSeed, hashSeed, random, forgeState,
    MAP_NODES, MAP_EDGES, MAIN_ROUTE, stageName, nodeOpen,
  };
}
