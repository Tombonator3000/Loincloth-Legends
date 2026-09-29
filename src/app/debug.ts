// Testkrok: eksponerer noen moduler på window.__lib slik at Playwright-testene kan bygge scener direkte.
// Brukes ikke av selve spillet.
import * as THREE from 'three';
import { Fighter } from '../game/fighter';
import { W } from '../game/world';
import { registerChar, getChar } from '../gfx/chars';
import { buildHeroDef, PRESETS, randomHero, HERO_OPTIONS } from '../gfx/chars/hero';
import { headCanvas } from '../gfx/rig';
import { charUniforms } from '../gfx/charlight';
import { MetalBand, METAL_TRACKS } from '../core/metal';
import { audio } from '../core/audio';
import { WEAPONS } from '../data/weapons';
import { settings, setSettings } from '../core/settings';
import { defaultSave } from './save';

export function installDebug() {
  (window as unknown as { __lib: unknown }).__lib = {
    THREE, Fighter, W, registerChar, getChar, buildHeroDef, PRESETS, randomHero, HERO_OPTIONS, headCanvas, WEAPONS, settings, setSettings, defaultSave, charUniforms, MetalBand, METAL_TRACKS, audio,
  };
}
