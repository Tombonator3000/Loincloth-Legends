// Bruk: node tools/tests/mountride.mjs http://localhost:4173/ ./shots (rir kakatrisse og salamander)
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
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
for (const [mid, lvl] of [['cluckatrice', 'swamp'], ['magmanewt', 'scorch']]) {
  await page.evaluate((lvl) => {
    const g = window.__game;
    g.playLevel({ id: lvl, level: lvl, kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  }, lvl);
  await run(1.2);
  await page.evaluate((mid) => {
    const s = window.__game.scene.stage;
    s.waveIdx = 99; s.wave = null; s.lockX = null; s.camX = 30;
    const h = s.heroes[0].f; h.pos.set(27, 0, 0); h.hp = 999;
    s.spawnRider('skeleton', mid);
    const m = s.mounts[0];
    m.rider.hurt(0.3, 2);
    m.pos.set(28, 0, 0);
    for (const x of [31, 32.5]) { const f = s.spawnFoe('skeleton', 'R'); f.f.pos.set(x, 0, 0); f.cd = 99; }
  }, mid);
  await run(0.3);
  await page.evaluate(() => { const s = window.__game.scene.stage; const m = s.mounts[0]; const h = s.heroes[0].f; h.pos.set(m.pos.x - 0.6, 0, m.pos.z); h.setState('idle'); h.facing = 1; m.state = 'wild'; });
  await run(0.1, [], ['KeyR']);
  await run(0.3, ['KeyD']);
  await run(0.1, [], ['KeyF']);
  await run(mid === 'magmanewt' ? 0.5 : 0.18);
  await shot('m5-' + mid);
  await run(0.6);
  const st = await page.evaluate(() => { const s = window.__game.scene.stage; return { mount: s.mounts.map((m) => [m.def.id, m.state, m.rider && m.rider.label]), foes: s.foes.map((f) => [f.def.id, f.f.state, f.f.alive]) }; });
  console.log(mid, JSON.stringify(st));
}
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
