// Full historieflyt via ekte input: tittel -> Hero Forge -> intro -> kart -> brett -> tilbake til kart.
// Bruk: node tools/tests/story.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(2000);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); window.__game.save = { v: 1, heroes: window.__game.save.heroes, heroMade: [false, false], completed: [], unlocked: [], gold: 0, node: 'home', intro: false }; window.__game.showTitleMenu(); });
const run = (sec, keys = [], taps = []) => page.evaluate(({ sec, keys, taps }) => {
  const g = window.__game; const inp = g.input; const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) { for (const k of keys) inp.keys.add(k); if (i === 0) for (const k of taps) inp.tapped.add(k); g.tick(1 / 60, false); }
  for (const k of keys) inp.keys.delete(k);
}, { sec, keys, taps });
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const st = () => page.evaluate(() => { const g = window.__game; return { scene: g.scene.name, screen: g.screens.active, node: g.save.node, completed: g.save.completed.join(','), made: g.save.heroMade.join(',') }; });
await shot('50-title');
await run(0.1, [], ['Enter']); await run(0.5);           // STORY 1P -> Hero Forge
console.log(await st());
await shot('51-forge');
// Ned til DONE (antallet rader varierer med byggeren i smia, så sjekk den valgte raden)
for (let i = 0; i < 30 && !(await page.evaluate(() => /DONE/.test(document.querySelector('.cr-row.sel')?.textContent ?? ''))); i++) await run(0.05, [], ['KeyS']);
await run(0.1, [], ['KeyF']); await run(0.5);
console.log('after forge', await st());
await run(0.1, [], ['Enter']); await run(0.5);          // hopp over intro
console.log('after intro', await st());
await shot('52-map');
await run(0.1, [], ['KeyD']); await run(2.5);             // gå til road
console.log('walked', await st());
await run(0.1, [], ['KeyF']); await run(0.5);             // enter -> cutscene
console.log('cutscene', await st());
await run(0.1, [], ['Enter']); await run(1.5);           // -> stage
console.log('stage', await st());
await shot('53-stage');
// Fullfør brettet raskt: drep sjefen direkte
await page.evaluate(() => { const s = window.__game.scene.stage; s.waveIdx = s.level.waves.length; s.wave = null; s.lockX = null; s.camX = s.bossLock; s.heroes[0].f.pos.x = s.bossLock; s.heroes[0].f.hp = 9999; });
await run(3);
await page.evaluate(() => { const s = window.__game.scene.stage; if (s.boss) s.boss.f.die('explode', 1, s.heroes[0].f); });
for (let i = 0; i < 40 && !(await page.evaluate(() => window.__game.screens.active)); i++) await run(0.5);
console.log('boss done', await st());
await shot('54-reward');
console.log('pre-enter', await page.evaluate(() => ({ active: window.__game.screens.active, paused: window.__game.paused, scene: window.__game.scene.name })));
await run(0.1, [], ['Enter']);
console.log('post-tap', await st());
await run(1);
console.log('back on map', await st());
await shot('55-map-after');
// Til hjemborgen og Hero Forge via pause-menyen
await run(0.1, [], ['Escape']); await run(0.3);
await shot('56-map-pause');
await run(0.1, [], ['Escape']); await run(0.3);
console.log('resumed', await st());
console.log('LOGS:\n' + logs.slice(0, 40).join('\n'));
await browser.close();
