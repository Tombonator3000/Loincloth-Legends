// Grep og kast inn i farer. Bruk: node grab.mjs URL OUTDIR [level]
import { chromium } from 'playwright';
const [url, out, level = 'road'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
const run = (sec, keys = [], taps = []) => page.evaluate(({ sec, keys, taps }) => {
  const g = window.__game; const inp = g.input; const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) { for (const k of keys) inp.keys.add(k); if (i === 0) for (const k of taps) inp.tapped.add(k); g.tick(1 / 60, false); }
  for (const k of keys) inp.keys.delete(k);
}, { sec, keys, taps });
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); };
const st = () => page.evaluate(() => { const s = window.__game.scene.stage; const h = s.heroes[0].f; return { hero: h.state, hold: !!h.holding, foes: s.foes.map((f) => [f.def.id, f.f.state, f.f.alive, f.f.envKill, f.f.pos.x.toFixed(1), f.f.pos.z.toFixed(1)]) }; });
await page.evaluate((level) => {
  const g = window.__game;
  g.twoP = false;
  g.playLevel({ id: level, level, kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
}, level);
await run(1.5);
const hz = await page.evaluate(() => window.__game.scene.stage.hazards.map((h) => h.def));
console.log('hazards', JSON.stringify(hz));
const H = hz[0];
await page.evaluate((H) => {
  const s = window.__game.scene.stage;
  s.waveIdx = 99; s.wave = null; s.lockX = null;
  s.camX = H.x - 2;
  const h = s.heroes[0].f;
  h.pos.set(H.x - 6.6, 0, H.z); h.facing = 1;
  s.spawnFoe('hogman', 'R'); s.spawnFoe('skeleton', 'R'); s.spawnFoe('skeleton', 'R');
  const [a, b, c] = s.foes.slice(-3);
  a.f.pos.set(h.pos.x + 1.0, 0, H.z); b.f.pos.set(H.x - 2.6, 0, H.z + 0.1); c.f.pos.set(H.x - 1.8, 0, H.z - 0.1);
  for (const f of [a, b, c]) { f.cd = 99; f.f.face(-1); f.projCd = 99; }
}, H);
await run(0.3);
await shot('g1-before');
await run(0.1, [], ['KeyR']);
await run(0.2);
console.log('grab', JSON.stringify(await st()));
await shot('g2-hold');
await run(0.1, [], ['KeyF']); await run(0.25);
await run(0.1, [], ['KeyF']); await run(0.25);
await shot('g3-pummel');
await run(0.1, ['KeyD'], ['KeyF']);
await run(0.25);
await shot('g4-throw');
await run(0.8);
console.log('after throw', JSON.stringify(await st()));
await shot('g5-landed');
await run(1.2);
await shot('g6-later');
// Helten går selv i faren
await page.evaluate((H) => { const s = window.__game.scene.stage; const h = s.heroes[0].f; h.pos.set(H.x - 2.5, 0, H.z); h.hp = 100; }, H);
await run(1.0, ['KeyD']);
console.log('hero in hazard', JSON.stringify(await page.evaluate(() => { const h = window.__game.scene.stage.heroes[0].f; return { hp: h.hp, state: h.state, z: h.pos.z.toFixed(2) }; })));
await shot('g7-hero-ouch');
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
