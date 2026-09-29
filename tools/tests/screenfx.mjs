// Skjermeffektene (gfx/screenfx.ts, gfx/screenwet.ts, post.ts) og ytelsen (app/perf.ts): dråper på glasset fra
// siden treffet kom fra, dråper som renner, sjokkbølge, zoomslag og kameradykk, årer ved lav helse, brennende kant
// i METAL MODE, lynglimt, varmeflimmer over lava og bål, regn, innstillingene FLASHES og SCREEN DISTORTION, FAMILY
// og LOW, lyspoolen (faklene slukner ikke ved hvert slag), bloddrypp fra sårede, SSAO som lar lava være lys,
// skygger i pause, tap av WebGL og automatisk grafikkvalitet med ytelsesmåler (?autotune&perf).
// Bruk: node tools/tests/screenfx.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const logs = [];
const results = [];
const check = (name, ok, info = {}) => {
  results.push({ name, ok });
  console.log((ok ? 'OK   ' : 'FAIL ') + name + ' ' + JSON.stringify(info));
};

async function open(query = 'nosplash', viewport = { width: 1280, height: 720 }) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(180000);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto(url + (url.includes('?') ? '&' : '?') + query);
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.announce{display:none!important}' });
  return page;
}

const page = await open();
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__lib.setSettings({ quality: 'high', gore: 2, flashes: true, distortion: true, autoQuality: '' });
});
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const shot = async (n) => {
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/screenfx-${n}.png` });
  console.log('shot', n);
};
const level = async (id) => {
  await page.evaluate((id) => {
    const g = window.__game;
    g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
    g.playLevel({ id, name: id, kind: 'level', level: id, biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  }, id);
  await run(4.5);
  // Fiendene står stille (frozen), så ingenting annet treffer helten mens testen måler
  await page.evaluate(() => { const s = window.__game.scene.stage; const h = s.heroes[0].f; h.hp = h.maxHp; s.frozen = true; for (const f of s.foes) f.f.alive && f.f.die('normal', 1, null); });
  await run(0.5);
};

// ---------------------------------------------------------------- innstillingsmenyen
await page.evaluate(() => { const g = window.__game; g.save = window.__lib.defaultSave(); g.showSettings(() => g.showTitleMenu()); });
await run(0.1);
const labels = await page.evaluate(() => [...document.querySelectorAll('#screen .menu li')].map((li) => li.textContent));
check('settings rows', labels.some((l) => l.includes('FLASHES: ON')) && labels.some((l) => l.includes('SCREEN DISTORTION: ON')), { rows: labels.length });
await shot('settings');
await page.evaluate(() => window.__game.screens.hide());

// ---------------------------------------------------------------- dråper på glasset
await level('road');
const hitLeft = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, fx = L.screenFX;
  fx.wet.clear();
  const foe = s.spawnFoe('hogman', 'R');
  foe.f.pos.set(h.pos.x - 1.2, 0, h.pos.z);
  foe.f.facing = 1;
  L.applyHit(foe.f, h, L.ENEMY_ATK.hog);
  h.hp = h.maxHp;
  foe.f.die('normal', 1, null);
  const d = fx.wet.drops;
  const W = fx.wet.W;
  return { n: d.length, blood: d.filter((x) => x.blood).length, left: d.filter((x) => x.x < W / 2).length, hurt: fx.hurt };
});
check('hero hit from the left puts blood on the left of the glass', hitLeft.n > 4 && hitLeft.blood === hitLeft.n && hitLeft.left >= hitLeft.n * 0.7 && hitLeft.hurt > 0.3, hitLeft);
await run(0.2);
await shot('wet-hit');
// Et par harde treff til, fra høyre, så noe blir tungt nok til å renne
await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f;
  for (let i = 0; i < 3; i++) {
    const foe = s.spawnFoe('hogman', 'R');
    foe.f.pos.set(h.pos.x + 1.2, 0, h.pos.z);
    foe.f.facing = -1;
    L.applyHit(foe.f, h, L.ENEMY_ATK.hog, 60);
    h.hp = h.maxHp;
    foe.f.die('normal', 1, null);
  }
});
await run(2.5);
const running = await page.evaluate(() => { const w = window.__lib.screenFX.wet; return { drops: w.drops.length, trails: w.trails.length, slid: w.stats.slid, merged: w.stats.merged, sliding: w.drops.filter((d) => d.sliding).length }; });
check('drops slide down, leave trails and merge', running.slid > 0 && running.trails > 0 && running.merged > 0, running);
await shot('wet-running');
await run(14);
const dried = await page.evaluate(() => { const w = window.__lib.screenFX.wet; return { drops: w.drops.length, trails: w.trails.length }; });
check('blood dries', dried.drops < running.drops * 0.5, dried);
await run(30);
const clear = await page.evaluate(() => { const w = window.__lib.screenFX.wet; return { drops: w.drops.length, trails: w.trails.length, wet: w.wet }; });
check('the glass clears', !clear.wet, clear);
const uploads = await page.evaluate(() => window.__lib.screenFX.wet.stats.uploads);
check('heightmap is only uploaded when the frame is drawn', uploads <= 6, { uploads });

// ---------------------------------------------------------------- sjokkbølge, zoomslag og kameradykk
const shock = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, fx = L.screenFX;
  fx.wet.clear();
  fx.boom(new L.THREE.Vector3(h.pos.x + 3, 1, 0), 1.4);
  fx.dive(0.15, 0.6);
  for (let i = 0; i < 9; i++) g.tick(1 / 60, false);
  g.tick(1 / 60, true);
  const u = g.post.comp.uniforms;
  return { shocks: fx.shockCount, w: u.uShock.value[0].w, r: u.uShock.value[0].z, zoom: u.uZoom.value.z, cam: g.camera.zoom };
});
check('shockwave, zoom punch and camera dive reach the composite pass', shock.shocks > 0 && shock.w > 0.2 && shock.zoom > 0.05 && shock.cam > 1.05, shock);
await page.screenshot({ path: `${out}/screenfx-shock.png` });
await run(2.5);
const settled = await page.evaluate(() => ({ cam: window.__game.camera.zoom, shocks: window.__lib.screenFX.shockCount }));
check('dive and shock settle back', Math.abs(settled.cam - 1) < 0.01 && settled.shocks === 0, settled);

// ---------------------------------------------------------------- årer ved lav helse
await page.evaluate(() => { const h = window.__game.scene.stage.heroes[0].f; h.hp = h.maxHp * 0.08; });
await run(1.5);
const veins = await page.evaluate(() => { const fx = window.__lib.screenFX; return { veins: fx.veins, low: fx.low, pulse: fx.pulse }; });
check('veins and red edge at low health', veins.veins > 0.6 && veins.low > 0.6 && veins.pulse > 5, veins);
await shot('veins');
await page.evaluate(() => { const h = window.__game.scene.stage.heroes[0].f; h.hp = h.maxHp; });
await run(2);
check('veins fade when healed', await page.evaluate(() => window.__lib.screenFX.veins < 0.05));

// ---------------------------------------------------------------- METAL MODE
await page.evaluate(() => { window.__game.scene.stage.metal.meter = 1; });
await run(1.5);
const burn = await page.evaluate(() => ({ burn: window.__lib.screenFX.burn, on: window.__game.scene.stage.metal.on }));
check('burning screen edge in METAL MODE', burn.on && burn.burn > 0.8, burn);
await shot('metal-burn');
await page.evaluate(() => window.__game.scene.stage.metal.stop());
await run(3);
check('burning edge fades after METAL MODE', await page.evaluate(() => window.__lib.screenFX.burn < 0.05));

// ---------------------------------------------------------------- lyn
await page.evaluate(() => { const g = window.__game, L = window.__lib, h = g.scene.stage.heroes[0].f, V = L.THREE.Vector3; g.gore.vfx.lightning(new V(h.pos.x + 3, 14, -1), new V(h.pos.x + 3, 0, 0.5)); L.W.fx.lightningFlash(0.4); });
const lyn = await page.evaluate(() => window.__lib.screenFX.lyn);
check('lightning flash in post', lyn > 0.5, { lyn });
await shot('lightning');

// ---------------------------------------------------------------- regn (ingen brett har regn ennå, men miljøet kan slå det på)
await page.evaluate(() => { const w = window.__lib.screenFX.wet; w.clear(); w.rain = 1; });
await run(3);
const rain = await page.evaluate(() => { const w = window.__lib.screenFX.wet; return { water: w.drops.filter((d) => !d.blood).length, blood: w.drops.filter((d) => d.blood).length }; });
check('rain puts water drops on the glass', rain.water > 3 && rain.blood === 0, rain);
await shot('rain');
await page.evaluate(() => { const w = window.__lib.screenFX.wet; w.rain = 0; w.clear(); });

// ---------------------------------------------------------------- innstillingene
const flashesOff = await page.evaluate(() => {
  const L = window.__lib, fx = L.screenFX;
  L.setSettings({ flashes: false });
  fx.lyn = 0; fx.neg = 0;
  L.W.fx.lightningFlash(0.5);
  fx.negative(0.1);
  // Et glimt som vises, setter en overgang på elementet; et som hoppes over, lar det være
  const el = document.querySelector('.fx-flash');
  el.style.transition = 'none';
  L.W.fx.flash('#ffffff', 0.8, 0.2);
  const white = el.style.transition;
  el.style.transition = 'none';
  L.W.fx.flash('#1a0030', 0.6, 0.2);
  const dark = el.style.transition;
  L.setSettings({ flashes: true });
  return { lyn: fx.lyn, neg: fx.neg, white, dark };
});
check('FLASHES off: no lightning, negative or white flash, dark tints stay', flashesOff.lyn === 0 && flashesOff.neg === 0 && flashesOff.white === 'none' && flashesOff.dark.includes('opacity'), flashesOff);
const distortOff = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, fx = L.screenFX, h = g.scene.stage.heroes[0].f;
  L.setSettings({ distortion: false });
  fx.boom(new L.THREE.Vector3(h.pos.x + 2, 1, 0), 1.5);
  fx.dive(0.2, 1);
  for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
  const r = { shocks: fx.shockCount, zoom: fx.zoom, cam: g.camera.zoom };
  L.setSettings({ distortion: true });
  return r;
});
check('SCREEN DISTORTION off: no shockwave, zoom or dive', distortOff.shocks === 0 && distortOff.zoom === 0 && distortOff.cam === 1, distortOff);

// ---------------------------------------------------------------- FAMILY
const family = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, fx = L.screenFX, s = g.scene.stage, h = s.heroes[0].f;
  fx.wet.hit(1.2, -1);
  const before = fx.wet.drops.filter((d) => d.blood).length;
  L.setSettings({ gore: 0 });
  for (let i = 0; i < 2; i++) g.tick(1 / 60, false);
  const cleared = fx.wet.drops.filter((d) => d.blood).length;
  const foe = s.spawnFoe('hogman', 'R');
  foe.f.pos.set(h.pos.x - 1.2, 0, h.pos.z); foe.f.facing = 1;
  L.applyHit(foe.f, h, L.ENEMY_ATK.hog);
  L.W.fx.screenBlood(8);
  h.hp = h.maxHp * 0.1;
  for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
  const r = { before, cleared, after: fx.wet.drops.filter((d) => d.blood).length, veins: fx.veins, confetti: g.fx.drops.length };
  h.hp = h.maxHp; foe.f.die('normal', 1, null);
  L.setSettings({ gore: 2 });
  g.fx.drops.length = 0;
  return r;
});
check('FAMILY: no blood on the glass (confetti instead) and no veins', family.before > 0 && family.cleared === 0 && family.after === 0 && family.veins < 0.01 && family.confetti > 0, family);

// ---------------------------------------------------------------- bloddrypp fra sårede
const drip = await page.evaluate(() => {
  const g = window.__game, L = window.__lib;
  const f = new L.Fighter('hogman', 'enemy', { hp: 100, speed: 3 });
  f.pos.set(g.scene.stage.camX, 0, 1.5);
  f.addTo(L.W.scene);
  const orig = g.gore.drop;
  let n = 0;
  g.gore.drop = function (...a) { n++; return orig.apply(this, a); };
  const walk = (sec) => { for (let i = 0; i < sec * 60; i++) { f.wantVX = 1; f.update(1 / 60, { minX: -1e9, maxX: 1e9, minZ: -3, maxZ: 3 }); } };
  walk(3);
  const healthy = n;
  f.hp = 30;
  walk(3);
  const wounded = n - healthy;
  g.gore.drop = orig;
  f.remove();
  return { healthy, wounded };
});
check('wounded enemies drip blood, healthy ones do not', drip.healthy === 0 && drip.wounded >= 5, drip);

// ---------------------------------------------------------------- skygger i pause
const pause = await page.evaluate(() => {
  const g = window.__game, sm = g.renderer.shadowMap;
  const orig = g.post.render;
  let draws = 0;
  g.post.render = function (...a) { draws++; return orig.apply(this, a); };
  g.togglePause(); g.tick(1 / 60, false);
  const paused = sm.autoUpdate;
  for (let i = 0; i < 60; i++) g.tick(1 / 60, true);
  const pausedDraws = draws;
  g.togglePause(); g.tick(1 / 60, false);
  draws = 0;
  for (let i = 0; i < 10; i++) g.tick(1 / 60, true);
  g.post.render = orig;
  g.screens.hide();
  return { paused, playing: sm.autoUpdate, pausedDraws, playingDraws: draws };
});
check('shadow map is not redrawn and the picture is drawn 4 times a second while paused', pause.paused === false && pause.playing === true && pause.pausedDraws <= 6 && pause.playingDraws === 10, pause);

// ---------------------------------------------------------------- varmeflimmer og SSAO på det brennende brettet
await level('scorch');
const heat = await page.evaluate(() => {
  const g = window.__game, fx = window.__lib.screenFX;
  g.tick(1 / 60, true);
  const u = g.post.comp.uniforms;
  return { sources: fx.heatCount, slots: u.uHeat.value.filter((v) => v.w !== 0).length, band: u.uHeat.value.some((v) => v.w < 0), depth: u.uHeatD.value[0] };
});
check('heat shimmer over the lava river and fires', heat.sources > 3 && heat.slots > 0 && heat.band && heat.depth > 5, heat);
await page.screenshot({ path: `${out}/screenfx-heat-scorch.png` });
const ao = await page.evaluate(() => {
  const g = window.__game, gl = g.renderer.getContext();
  const read = () => { const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  g.post.debug.ao = false; g.tick(0, true); const off = read();
  g.post.debug.ao = true; g.tick(0, true); const on = read();
  let warmOff = 0, warmOn = 0, warmN = 0, restOff = 0, restOn = 0, restN = 0;
  for (let i = 0; i < off.length; i += 16) {
    const r = off[i], gg = off[i + 1], b = off[i + 2];
    const lum = r + gg + b, lum2 = on[i] + on[i + 1] + on[i + 2];
    if (r > 200 && r > b * 2.2 && gg < r) { warmOff += lum; warmOn += lum2; warmN++; } else if (lum > 60) { restOff += lum; restOn += lum2; restN++; }
  }
  return { warmN, warm: warmN ? warmOn / warmOff : 1, restN, rest: restN ? restOn / restOff : 1 };
});
check('SSAO leaves lava and fire bright', ao.warmN > 200 && ao.warm > 0.985 && ao.warm >= ao.rest, ao);

// ---------------------------------------------------------------- bål i nattleiren og lyspoolen der
await level('nightcamp');
const night = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, V = L.THREE.Vector3;
  // En egen lyspool med to kilder og fire lys: et lite glimt tar et ledig lys, og kildene beholder sine
  const LP = g.gore.vfx.lights.constructor;
  const lp = new LP(new L.THREE.Group(), 4);
  lp.source(new V(2, 1, 0), '#ff8a3a', 10, 9, 0);
  lp.source(new V(-3, 1, 0), '#ff8a3a', 10, 9, 0);
  lp.update(1 / 60, 0);
  const before = lp.owners();
  lp.flash(new V(0, 1, 0), '#ffd35a', 6, 6, 0.1);
  lp.update(1 / 60, 0);
  const during = lp.owners();
  for (let i = 0; i < 20; i++) lp.update(1 / 60, 0);
  // Så går kameraet bort, og en kilde langt borte tar over med inntoning (ikke med et hopp)
  lp.source(new V(30, 1, 0), '#ff8a3a', 10, 9, 0);
  for (let i = 0; i < 3; i++) lp.update(1 / 60, 20);
  const fading = lp.lights.map((l) => Math.round(l.intensity * 10) / 10);
  return { heat: L.screenFX.heatCount, before, during, after: lp.owners(), fading };
});
check('night camp: campfires shimmer', night.heat >= 3, { heat: night.heat });
check('a small flash takes a free light and the sources keep theirs', night.during.includes('flash') && night.before.filter((o) => typeof o === 'number').length === 2 && night.during.filter((o) => typeof o === 'number').length === 2, night);

// ---------------------------------------------------------------- lyspoolen i arenaen (fire fakler, fire lys)
await page.evaluate(() => { const g = window.__game; g.save.heroMade = [true, true]; g.pvpDuel(); });
await run(1);
const pool = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, lp = g.gore.vfx.lights, V = L.THREE.Vector3;
  for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
  const before = lp.owners();
  let minLit = 99, flashSeen = false, minSum = 1e9;
  for (let i = 0; i < 60; i++) {
    if (i % 4 === 0) g.gore.vfx.sparks(new V((Math.random() - 0.5) * 4, 1.4, 0.2), 12);
    g.tick(1 / 60, false);
    const o = lp.owners();
    if (o.includes('flash')) flashSeen = true;
    minLit = Math.min(minLit, lp.lights.filter((l) => l.intensity > 0.5).length);
    minSum = Math.min(minSum, lp.lights.reduce((a, l) => a + l.intensity, 0));
  }
  const sumBefore = lp.lights.reduce((a, l) => a + l.intensity, 0);
  g.gore.vfx.explode(new V(0, 1, 0), 1);
  g.tick(1 / 60, false);
  const boom = lp.owners();
  for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
  return { before, flashSeen, minLit, minSum: Math.round(minSum), sumBefore: Math.round(sumBefore), boom, after: lp.owners() };
});
check('torches keep their light through hit sparks', pool.before.every((o) => typeof o === 'number') && !pool.flashSeen && pool.minLit === 4, pool);
check('a big explosion borrows one light and gives it back', pool.boom.filter((o) => o === 'flash').length === 1 && pool.after.every((o) => typeof o === 'number'), { boom: pool.boom, after: pool.after });

// ---------------------------------------------------------------- tap av WebGL
await level('road');
await page.evaluate(() => window.__game.renderer.forceContextLoss());
await page.waitForTimeout(600);
const lost = await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 10; i++) g.tick(1 / 60, true); return { lost: g.glLost, paused: g.paused }; });
check('context loss pauses and waits', lost.lost && lost.paused, lost);
await page.evaluate(() => window.__game.renderer.forceContextRestore());
await page.waitForTimeout(1200);
const restored = await page.evaluate(() => {
  const g = window.__game;
  if (g.paused) g.togglePause();
  g.screens.hide();
  for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
  g.tick(1 / 60, true);
  const gl = g.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
  let sum = 0, black = 0;
  for (let i = 1; i <= 4; i++) for (let j = 1; j <= 4; j++) {
    gl.readPixels(Math.floor((w * i) / 5), Math.floor((h * j) / 5), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    sum += px[0] + px[1] + px[2];
    if (px[0] + px[1] + px[2] < 6) black++;
  }
  return { lost: g.glLost, contextLost: gl.isContextLost(), mean: Math.round(sum / 48), black, quality: g.post.quality };
});
check('context restored without a blank screen', !restored.lost && !restored.contextLost && restored.mean > 20 && restored.black < 4, restored);
await page.screenshot({ path: `${out}/screenfx-context-restored.png` });

// ---------------------------------------------------------------- LOW: ingen skjermeffekter, 2D-blodet er reserven
const low = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, fx = L.screenFX;
  L.setSettings({ quality: 'low' });
  g.tick(1 / 60, false);
  fx.wet.hit(1.2, 1);
  fx.boom(new L.THREE.Vector3(0, 1, 0), 1);
  L.W.fx.screenBlood(6);
  g.tick(1 / 60, false);
  const r = { active: fx.active, wet: fx.wet.drops.length, shocks: fx.shockCount, blood2d: g.fx.drops.length };
  L.setSettings({ quality: 'high' });
  return r;
});
check('LOW: no post effects, the 2D blood is the fallback', !low.active && low.wet === 0 && low.shocks === 0 && low.blood2d > 0, low);
// Også nytt nivå og nye mål etter at WebGL kom tilbake skal gå uten feilmeldinger fra skjermkortet
const glWarnings = logs.filter((l) => l.includes('WebGL:')).length;
check('no WebGL errors after the restore', glWarnings === 0, { glWarnings });
await page.close();

// ---------------------------------------------------------------- automatisk kvalitet og ytelsesmåleren (ekte bildefrekvens)
// Liten flate, så SwiftShader rekker flere bilder i sekundet (men fortsatt for få for HIGH og MEDIUM)
const p2 = await open('nosplash&autotune&perf', { width: 640, height: 360 });
await p2.evaluate(() => {
  localStorage.clear();
  const g = window.__game, L = window.__lib;
  L.setSettings({ quality: 'auto', autoQuality: '' });
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
});
const q0 = await p2.evaluate(() => window.__game.post.quality);
let q1 = q0;
for (let i = 0; i < 40 && q1 !== 'low'; i++) {
  await p2.waitForTimeout(1000);
  q1 = await p2.evaluate(() => window.__game.post.quality);
}
const auto = await p2.evaluate(() => ({ quality: window.__game.post.quality, saved: window.__lib.settings.autoQuality, fps: window.__game.governor.lastFps, meter: document.querySelector('.perf-meter')?.textContent ?? '', toast: document.querySelector('.toast')?.textContent ?? '' }));
check('AUTO steps down when the frame time stays high (SwiftShader is slow)', q0 !== 'low' && auto.quality !== q0 && auto.saved === auto.quality, { from: q0, ...auto });
check('performance meter behind ?perf', /FPS/.test(auto.meter) && /P95/.test(auto.meter), { meter: auto.meter });
await p2.screenshot({ path: `${out}/screenfx-autoquality.png` });
await p2.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} OK` + (failed.length ? '\nFAILED: ' + failed.map((r) => r.name).join(', ') : ''));
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
process.exit(failed.length ? 1 : 0);
