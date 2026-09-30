// Tre knapper (angrep, hopp, spesial): helten griper en fiende ved å gå inn i ham, store beist gripes ikke, han
// sitter opp ved å gå inn i et ledig ridedyr og hopper av med ned + hopp, ned + hopp ruller i duellen, og
// berøringsskjermen har tre knapper. Grip-tasten (R) brukes ikke noe sted her.
// Bruk: node tools/tests/buttons.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
const shot = async (n) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/buttons-${n}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null;
  // Rydd fiender og flytt helten og kameraet
  window.__reset = (x) => {
    const s = window.__game.scene.stage, h = s.heroes[0].f;
    for (const f of s.foes) { f.f.alive && f.f.die('normal', 1, null); f.f.rig.root.visible = false; f.f.removeMe = true; }
    for (let i = 0; i < 2; i++) window.__game.tick(1 / 60, false);
    h.hp = h.maxHp = 9999; h.pos.set(x, 0, 0); h.state = 'idle'; h.face(1);
    s.camX = x; window.__game.camera.position.x = x;
  };
  // Hold tastene i n frames (grip-tasten R er aldri med)
  window.__hold = (keys, n, each) => {
    const g = window.__game;
    for (let i = 0; i < n; i++) { for (const k of keys) g.input.keys.add(k); each?.(i); g.tick(1 / 60, false); }
    for (const k of keys) g.input.keys.delete(k);
  };
});

// 1) Gå inn i en fiende: grepet kommer av seg selv, så kne og kast med angrep
const grab = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(20);
  const k = s.spawnFoe('skeleton', 'R');
  k.f.pos.set(21.8, 0, 0); k.cd = 99; k.projCd = 99;
  let t = -1;
  window.__hold(['KeyD'], 90, (i) => { if (t < 0 && h.state === 'hold') t = i; });
  const held = { hero: h.state, foe: k.f.state, t: +(t / 60).toFixed(2) };
  // Kne (angrep) og kast (retning + angrep)
  g.input.tapped.add('KeyF'); window.__hold([], 12);
  const kneed = k.f.hp < k.f.maxHp;
  window.__hold(['KeyD'], 1); g.input.tapped.add('KeyF'); window.__hold(['KeyD'], 3);
  const thrown = !!k.f.thrownBy || k.f.state === 'down';
  return { held, kneed, thrown };
});
check('helten griper fienden når han går inn i ham', grab.held.hero === 'hold' && grab.held.foe === 'held' && grab.held.t > 0 && grab.held.t < 1, grab);
check('angrep gir kne, retning + angrep kaster', grab.kneed && grab.thrown, grab);
await shot('grab');

// 2) Å gå forbi i dybden, eller løpe inn i ham, griper ikke (løp + angrep er skulderdytt)
const pass = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(40);
  const k = s.spawnFoe('skeleton', 'R');
  k.f.pos.set(41.8, 0, 1.2); k.cd = 99; k.projCd = 99;
  let grabbed = false;
  window.__hold(['KeyD'], 50, () => { k.f.pos.z = 1.2; grabbed = grabbed || h.state === 'hold'; });
  return { grabbed };
});
check('å gå forbi et stykke unna i dybden griper ikke', !pass.grabbed, pass);

// 3) Store beist gripes ikke (og det kommer ingen TOO HEAVY-mas)
const heavy = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(60);
  const t = s.spawnFoe('bigtroll', 'R');
  t.f.pos.set(61.6, 0, 0); t.cd = 99; t.projCd = 99; t.grabCd = 99;
  const texts = () => [...document.querySelectorAll('.ftext')].filter((e) => /TOO HEAVY|NICE TRY|BIG-BONED/.test(e.textContent)).length;
  const t0 = texts();
  let grabbed = false;
  window.__hold(['KeyD'], 60, () => { grabbed = grabbed || h.state === 'hold'; });
  return { grabbed, nag: texts() - t0 };
});
check('kjempetrollet er for tungt, og det mases ikke', !heavy.grabbed && heavy.nag === 0, heavy);

// 4) Ridedyr: gå inn i det for å sitte opp, ned + hopp for å hoppe av
const ride = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(80);
  s.spawnRider('skeleton', 'warhog');
  const m = s.mounts[s.mounts.length - 1];
  window.__reset(80);
  for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
  m.pos.set(81.7, 0, 0); m.vel.set(0, 0, 0); m.state = 'wild'; m.t = 2; m.remountT = 99;
  let t = -1;
  window.__hold(['KeyD'], 90, (i) => { if (t < 0 && h.mount === m) t = i; });
  const mounted = h.mount === m;
  window.__hold([], 20);
  window.__hold(['KeyS'], 1); g.input.tapped.add('KeyG'); window.__hold(['KeyS'], 3);
  const off = h.mount === null;
  // Hopp alene får dyret til å hoppe, ikke helten av
  window.__hold([], 30);
  return { mounted, t: +(t / 60).toFixed(2), off };
});
check('går inn i et ledig ridedyr og sitter opp', ride.mounted && ride.t > 0, ride);
check('ned + hopp hopper av', ride.off, ride);
await shot('ride');

// 5) Duellen: ned + hopp ruller
const roll = await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true];
  g.pvpDuel();
  for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
  const d = g.scene.duel;
  d.phase = 'fight';
  const f = d.fa;
  f.state = 'idle';
  for (let i = 0; i < 3; i++) g.tick(1 / 60, false);
  let rolled = false;
  g.input.keys.add('KeyS');
  g.tick(1 / 60, false);
  g.input.tapped.add('KeyG');
  for (let i = 0; i < 6; i++) { g.tick(1 / 60, false); rolled = rolled || f.state === 'roll'; }
  g.input.keys.delete('KeyS');
  return { rolled };
});
check('ned + hopp ruller i duellen', roll.rolled, roll);

// 6) Berøringsskjermen: tre knapper
const touch = await page.evaluate(() => ({ n: document.querySelectorAll('.touch .tbtn').length, grab: !!document.querySelector('.touch .tb-grab'), labels: [...document.querySelectorAll('.touch .tbtn span')].map((s) => s.textContent) }));
check('berøringsskjermen har tre knapper', touch.n === 3 && !touch.grab, touch);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: tre knapper holder');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
