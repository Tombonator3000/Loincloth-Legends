// Ekte Three-geometrier uten WebGL: prosjektilene må slippe egne ressurser, men beholde delte sprite-materialer.
// Bruk: node tools/tests/projectile-resources.mjs (Node 22.13+).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as THREE from 'three';

const source = stripTypeScriptTypes(readFileSync(new URL('../../src/game/projectiles.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;$/gm, '')
  .replace(/^export \{.*\};$/gm, '')
  .replace(/^export /gm, '');
const W = { scene: new THREE.Scene(), gore: {}, time: 0 };
const context = vm.createContext({
  THREE, W, unitCanvas: () => ({}), INK: '#000000', screenFX: {}, applyHit: () => {},
  ENEMY_ATK: { stab: {}, hog: {} }, audio: {}, rand: (lo) => lo, ICEFIRE: {}, GHOSTFIRE: {},
});
new vm.Script(source + '\nglobalThis.api = { Projectile, Projectiles };').runInContext(context);
const { Projectile, Projectiles } = context.api;
const options = (kind) => ({ kind, x: 0, y: 1, z: 0, vx: 1, owner: { team: 'hero' }, dmg: 1 });
const disposals = (resource) => {
  const result = { count: 0 };
  resource.addEventListener('dispose', () => { result.count++; });
  return result;
};

for (const kind of ['dagger', 'arrow', 'fireball', 'poison', 'snowball']) {
  const first = new Projectile(options(kind));
  const second = new Projectile(options(kind));
  assert.equal(first.mesh.material, second.mesh.material);
  const geo = disposals(first.mesh.geometry);
  const shared = disposals(first.mesh.material);
  first.kill();
  first.kill();
  assert.equal(geo.count, 1, kind + ': egen geometri ble ikke sluppet nøyaktig én gang');
  assert.equal(shared.count, 0, kind + ': delt materiale ble sluppet');
  assert.equal(first.mesh.parent, null);
  assert.equal(second.mesh.parent, W.scene);
  second.kill();
  assert.equal(shared.count, 0);
}
console.log('OK fem sprite-typer slipper egne geometrier og beholder delte materialer');

for (const kind of ['tongue', 'meteor', 'lightning']) {
  const projectile = new Projectile(options(kind));
  const mesh = projectile.mesh ?? projectile.marker;
  const geo = disposals(mesh.geometry), material = disposals(mesh.material);
  projectile.kill();
  projectile.kill();
  assert.equal(geo.count, 1, kind + ': geometri');
  assert.equal(material.count, 1, kind + ': eget materiale');
  assert.equal(mesh.parent, null);
}
console.log('OK tunge og varselringer slipper egne geometrier og materialer én gang');

const pool = new Projectiles();
const arrow = pool.spawn({ ...options('arrow'), life: 0 });
const expired = disposals(arrow.mesh.geometry);
pool.update(0.02, []);
assert.equal(expired.count, 1);
assert.equal(pool.list.length, 0);
const active = pool.spawn(options('tongue'));
const cleared = disposals(active.mesh.geometry);
pool.clear();
pool.clear();
assert.equal(cleared.count, 1);
assert.equal(pool.list.length, 0);
assert.equal(W.scene.children.length, 0);
console.log('OK utløpt levetid og scenerydding fjerner prosjektilene og slipper ressursene');
