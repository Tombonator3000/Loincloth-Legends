// Lydene fra frostpasset og replikkene: de nye opptakene lastes, fottrinn på snø når helten går, krigshorn og brøl
// når kjempetrollet kommer, tunge kjempetrinn, fossesus nær fossene, ulv, vindkast og isknak i stemningen, sverdklang,
// publikum og isknak i råka, og innleste replikker (spillet later som to replikkfiler finnes, så ingen filer endres).
// Bruk: node tools/tests/frostsound.mjs http://localhost:4173/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [url] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + info : ''));
  if (!ok) fails.push(name);
};

// To replikker som ikke finnes ennå: fortelleren og en heltinne-versjon. Lyden er krigshornet.
const FAKE = { v_they_are_blue_that_is_the_only_difference: 'voice', v_next: 'voice', v_next_f: 'voice' };
const horn = readFileSync(new URL('../../public/assets/sound/krigshorn.mp3', import.meta.url));
await page.route('**/assets/sound/sound.json', async (r) => {
  const res = await r.fetch();
  const json = await res.json();
  for (const [k, type] of Object.entries(FAKE)) json[k] = { gruppe: k, type, sek: 3.6, sloyfe: false, kilde: 'test' };
  await r.fulfill({ response: res, json });
});
await page.route('**/assets/sound/v_*.mp3', (r) => r.fulfill({ body: horn, contentType: 'audio/mpeg' }));

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); window.__lib.audio.init(); });
let st;
for (let i = 0; i < 120; i++) {
  st = await page.evaluate(() => { const b = window.__lib.audio.bank; return { ready: b.ready, total: b.total, failed: b.failed, done: b.done }; });
  if (st.done) break;
  await page.waitForTimeout(250);
}
check('lydbanken er pakket ut', st.done && st.failed === 0, JSON.stringify(st));
const groups = ['fot_gress', 'fot_stein', 'fot_vann', 'fot_sno', 'amb_foss', 'isknak', 'brol', 'klang', 'krigshorn', 'ulv', 'publikum', 'vindkast'];
const missing = await page.evaluate((gs) => gs.filter((g) => !window.__lib.audio.bank.has(g)), groups);
check('de nye gruppene er lastet', missing.length === 0, missing.join(','));

const tick = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__game.tick(1 / 60, false); }, n);
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'frost', name: 'frost', kind: 'level', level: 'frost', biome: 'frost', pos: [0, 0], requires: [], blurb: '' });
});
await tick(60);
await page.evaluate(() => {
  const s = window.__game.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null;
  window.__lib.audio.bank.played = {};
});
// Lydene har en sperre mot gjentak på lydklokka, så testen går i biter med ekte tid imellom (som i spillet)
for (let k = 0; k < 10; k++) {
  await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 15; i++) { g.input.keys.add('KeyD'); g.tick(1 / 60, false); } g.input.keys.delete('KeyD'); });
  await page.waitForTimeout(250);
}
const walk = await page.evaluate(() => {
  const a = window.__lib.audio;
  return { surface: a.surface, steps: a.bank.played.fot_sno ?? 0, other: (a.bank.played.fot_gress ?? 0) + (a.bank.played.fot_stein ?? 0) };
});
check('fottrinn på snø når helten går', walk.surface === 'sno' && walk.steps >= 3 && walk.other === 0, JSON.stringify(walk));

const giant = await page.evaluate(() => {
  const g = window.__game, a = window.__lib.audio, s = g.scene.stage, h = s.heroes[0].f;
  h.hp = 9999;
  a.bank.played = {};
  const foe = s.spawnFoe('bigtroll', 'R');
  foe.f.pos.set(h.pos.x + 6, 0, 0);
  const at = { horn: a.bank.played.krigshorn ?? 0, roar: a.bank.played.brol ?? 0 };
  const before = a.bank.played.fot_sno ?? 0;
  for (let i = 0; i < 120; i++) { h.hp = 9999; g.tick(1 / 60, false); }
  return { ...at, steps: (a.bank.played.fot_sno ?? 0) - before };
});
check('krigshorn og brøl når kjempetrollet kommer', giant.horn === 1 && giant.roar === 1, JSON.stringify(giant));
check('kjempetrollet tramper', giant.steps >= 1, JSON.stringify(giant));

const water = await page.evaluate(() => {
  const g = window.__game, a = window.__lib.audio, s = g.scene.stage, W = window.__lib.W;
  for (const f of s.foes) f.f.alive && f.f.die('normal', 1, null);
  const ws = W.env.waters ?? [];
  if (!ws.length) return { n: 0 };
  const far = () => { for (let i = 0; i < 90; i++) g.tick(1 / 60, false); return a.amb.active.filter((k) => k === 'near:f:amb_foss' || k === 'near:s:water'); };
  // Langt unna alle fossene: ingen sus. Ved en foss: suset er på
  const xs = ws.map((p) => p.x);
  let gapX = 0, best = -1;
  for (let x = 0; x < 125; x += 2) { const d = Math.min(...xs.map((w) => Math.abs(w - x))); if (d > best) { best = d; gapX = x; } }
  s.heroes[0].f.pos.x = gapX; s.camX = gapX;
  const away = best > 22 ? far() : null;
  s.heroes[0].f.pos.x = ws[0].x; s.camX = ws[0].x;
  const near = far();
  return { n: ws.length, away, near, best };
});
check('fossesus nær fossene', water.n > 0 && water.near.length === 1 && water.near[0] === 'near:f:amb_foss' && (water.away === null || water.away.length === 0), JSON.stringify(water));

const amb = await page.evaluate(() => {
  const a = window.__lib.audio;
  a.bank.played = {};
  for (let i = 0; i < 60; i++) a.ambienceTick(1);
  return { ulv: a.bank.played.ulv ?? 0, vind: a.bank.played.vindkast ?? 0, is: a.bank.played.isknak ?? 0 };
});
check('ulv, vindkast og isknak i stemningen', amb.ulv >= 1 && amb.vind >= 2 && amb.is >= 1, JSON.stringify(amb));

await page.waitForTimeout(400);
const misc = await page.evaluate(() => {
  const a = window.__lib.audio;
  a.bank.played = {};
  a.clang(); a.crowd(1); a.iceCrack(); a.scream('troll');
  return { klang: a.bank.played.klang ?? 0, publikum: a.bank.played.publikum ?? 0, is: a.bank.played.isknak ?? 0, brol: a.bank.played.brol ?? 0 };
});
check('sverdklang, publikum, isknak og trollbrøl', misc.klang === 1 && misc.publikum === 1 && misc.is === 1 && misc.brol === 1, JSON.stringify(misc));

const voice = await page.evaluate(() => {
  const g = window.__game, a = window.__lib.audio;
  a.bank.played = {};
  g.hud.say('NARRATOR', 'THEY ARE BLUE. THAT IS THE ONLY DIFFERENCE.');
  const narr = a.bank.played.v_they_are_blue_that_is_the_only_difference ?? 0;
  const none = a.voice('NO SUCH LINE EXISTS');
  const fem = a.voice('NEXT!', 0, 'f');
  const man = a.voice('NEXT!');
  return { narr, none, fem, man, f: a.bank.played.v_next_f ?? 0, m: a.bank.played.v_next ?? 0 };
});
check('innlest replikk når teksten vises', voice.narr === 1 && voice.none === 0, JSON.stringify(voice));
check('heltinnene får sin egen versjon', voice.f === 1 && voice.m === 1, JSON.stringify(voice));

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: alle lydene fra frostpasset og replikkene virker');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
