// Lastetidsgrenser uten nettleser. Bruk: node tools/tests/assets-timeout.mjs (Node 22.13+).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../../src/gfx/assets.ts', import.meta.url), 'utf8'))
  .replace(/^import .*from '\.\/chars\/types';$/m, '')
  .replace(/^export /gm, '');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

function harness(fetch) {
  const timers = new Map(), requests = [], warnings = [];
  let nextTimer = 0;
  class FakeImage {
    onload = null;
    onerror = null;
    src = '';
    constructor() { requests.push(this); }
    removeAttribute(name) { assert.equal(name, 'src'); this.src = ''; }
  }
  const context = vm.createContext({
    TORSO_Y: 1.14, ARM_L: 1.3, LEG_L: 1.62,
    location: { protocol: 'https:' }, fetch, Image: FakeImage, AbortController,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    console: { warn(error) { warnings.push(error); } },
  });
  new vm.Script(source + '\nglobalThis.api = { loadAssets, images };').runInContext(context);
  return {
    ...context.api, timers, requests, warnings,
    expire(delay) {
      const due = [...timers].filter(([, timer]) => timer.delay === delay);
      assert.ok(due.length, `Ingen timer på ${delay} ms`);
      for (const [id, timer] of due) { timers.delete(id); timer.callback(); }
    },
  };
}

// Et fetch-kall som ignorerer abort skal heller ikke kunne blokkere oppstarten.
{
  const response = deferred();
  let signal;
  const h = harness((_url, options) => { signal = options.signal; return response.promise; });
  const boot = h.loadAssets();
  h.expire(15_000);
  assert.equal(await boot, 0);
  assert.equal(signal.aborted, true);
  response.resolve({ ok: true, json: async () => ({ map: 'late.webp' }) });
  await flush();
  assert.equal(h.requests.length, 0, 'Sent manifest startet bildelasting');
  assert.equal(h.timers.size, 0);
}

// Tidsgrensen gjelder også når svarhodet kom, men JSON-kroppen stopper opp.
{
  const body = deferred();
  let signal;
  const h = harness(async (_url, options) => {
    signal = options.signal;
    return { ok: true, json: () => body.promise };
  });
  const boot = h.loadAssets();
  await flush();
  h.expire(15_000);
  assert.equal(await boot, 0);
  assert.equal(signal.aborted, true);
  body.resolve({ sky: { grass: 'late.webp' } });
  await flush();
  assert.equal(h.requests.length, 0);
  assert.equal(h.timers.size, 0);
}

// Ett vellykket bilde beholdes; timeout av et annet kan aldri endre grafikken senere.
{
  const h = harness(async () => ({ ok: true, json: async () => ({
    sky: { grass: 'good.webp', frost: 'stalled.webp' },
  }) }));
  const boot = h.loadAssets();
  await flush();
  assert.equal(h.requests.length, 2);
  const [good, stalled] = h.requests;
  good.onload();
  const lateCallback = stalled.onload;
  await flush();
  assert.equal(good.onload, null);
  assert.equal(good.onerror, null);
  assert.equal(good.src, './assets/good.webp');
  assert.equal(h.images.sky.grass, good);
  h.expire(60_000);
  assert.equal(await boot, 0);
  assert.equal(stalled.src, '');
  assert.equal(stalled.onload, null);
  assert.equal(stalled.onerror, null);
  lateCallback();
  await flush();
  assert.equal(h.images.sky.frost, undefined, 'Sen callback endret ferdiglastet grafikk');
  assert.equal(h.images.sky.grass, good);
  assert.equal(h.timers.size, 0);
  assert.equal(h.warnings.length, 1);
}

// Vanlig bildefeil rydder timer og kilde uten å vente på tidsgrensen.
{
  const h = harness(async () => ({ ok: true, json: async () => ({ map: 'missing.webp' }) }));
  const boot = h.loadAssets();
  await flush();
  h.requests[0].onerror();
  assert.equal(await boot, 0);
  assert.equal(h.images.map, null);
  assert.equal(h.requests[0].src, '');
  assert.equal(h.timers.size, 0);
}

console.log('OK: manifest, JSON og bilder har tidsgrense; sene callbacks ignoreres og timere ryddes.');
