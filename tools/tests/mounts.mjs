// Ridedyr: oppstilling, fiende-rytter, avkasting, helten sitter opp og angriper.
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
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
const st = () => page.evaluate(() => { const s = window.__game.scene.stage; const h = s.heroes[0].f; return { hero: [h.state, !!h.mount, h.hp.toFixed(0)], mounts: s.mounts.map((m) => [m.def.id, m.state, m.rider ? m.rider.label : null, m.pos.x.toFixed(1), m.falls]), foes: s.foes.map((f) => [f.def.id, f.f.state, f.f.alive]) }; });
await page.evaluate(() => {
  const g = window.__game;
  g.twoP = false;
  g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
});
await run(1.5);
// Oppstilling av alle tre
await page.evaluate(() => {
  const s = window.__game.scene.stage;
  s.waveIdx = 99; s.wave = null; s.lockX = null; s.camX = 30;
  const h = s.heroes[0].f; h.pos.set(24.5, 0, 1.2);
  s.spawnRider('skeleton', 'warhog'); s.spawnRider('frogman', 'cluckatrice'); s.spawnRider('fireimp', 'magmanewt');
  const xs = [28, 31.5, 35];
  s.mounts.forEach((m, i) => { m.pos.set(xs[i], 0, -0.6 + i * 0.3); m.cd = 99; m.facing = -1; });
  for (const f of s.foes) { f.cd = 99; }
});
await page.evaluate(() => { const s = window.__game.scene.stage; for (const m of s.mounts) m.drive(0, 0, false); });
await run(0.05);
await shot('m1-lineup');
console.log('lineup', JSON.stringify(await st()));
// La dem angripe
await page.evaluate(() => { const s = window.__game.scene.stage; for (const m of s.mounts) m.cd = 0; s.heroes[0].f.hp = 999; });
await run(1.2);
await shot('m2-attacks');
console.log('attacks', JSON.stringify(await st()));
// Slå av rytteren på villsvinet
await page.evaluate(() => { const s = window.__game.scene.stage; const m = s.mounts[0]; if (m.rider) m.rider.hurt(0.4, 2); });
await run(1.8);
console.log('after knock', JSON.stringify(await st()));
// Helten sitter opp
await page.evaluate(() => { const s = window.__game.scene.stage; const m = s.mounts.find((x) => x.def.id === 'warhog'); const h = s.heroes[0].f; h.pos.set(m.pos.x - 0.8, 0, m.pos.z); h.setState('idle'); h.facing = 1; });
await run(0.1, [], ['KeyR']);
await run(0.4);
console.log('mounted', JSON.stringify(await st()));
await shot('m3-mounted');
await run(0.1, ['KeyD'], ['KeyF']);
await run(0.35, ['KeyD']);
await shot('m4-charge');
await run(0.8);
console.log('charge', JSON.stringify(await st()));
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
