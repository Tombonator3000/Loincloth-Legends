// Borgen: butikk, trening, kjæledyr og XP. Bruk: node progress.mjs URL OUTDIR
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
const tap = async (k, n = 1) => { for (let i = 0; i < n; i++) { await run(0.05, [], [k]); await run(0.05); } };
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const st = () => page.evaluate(() => { const s = window.__game.save; return { gold: s.gold, pets: s.pets.join(','), prog: s.progress.map((p) => [p.level, p.xp, p.points, p.str, p.def, p.mag, p.agi, p.pet]), sup: s.supplies, man: s.manuals, scene: window.__game.scene.name, screen: window.__game.screens.active }; });
await page.evaluate(() => {
  const g = window.__game, L = window.__lib;
  localStorage.clear();
  g.save = L.defaultSave();
  g.save.heroMade = [true, true]; g.save.intro = true; g.save.gold = 3000; g.save.completed = ['road'];
  g.twoP = false; g.input.solo = true;
  g.goMap();
});
await run(0.5);
await tap('Enter'); // hjemborgen
await run(0.2);
await shot('p1-camp');
await tap('KeyS'); await tap('Enter'); // butikk
await run(0.2);
await tap('Enter'); // extra life
await tap('KeyS', 2); await tap('Enter'); // manual
await tap('KeyS', 3); await tap('Enter'); // rat (indeks 5)
await tap('KeyS', 3); await tap('Enter'); // dragon (indeks 8)
await shot('p2-shop');
console.log('after shop', JSON.stringify(await st()));
await tap('Escape');
await run(0.2);
await tap('KeyS', 2); await tap('Enter'); // trening
await run(0.2);
await tap('Enter'); // STR +1
await tap('KeyS'); await tap('KeyD'); // DEF via adjust
await tap('KeyS', 3); await tap('KeyD'); await tap('KeyD'); // PET: none -> rat -> dragon
await shot('p3-training');
console.log('after training', JSON.stringify(await st()));
// Spill brettet med kjæledyret
await page.evaluate(() => { const g = window.__game; g.screens.hide(); g.save.progress[0].pet = g.save.progress[0].pet || 'dragon'; g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' }); });
await run(1.5);
await page.evaluate(() => {
  const s = window.__game.scene.stage;
  s.waveIdx = 99; s.wave = null; s.lockX = null; s.camX = 30;
  const h = s.heroes[0].f; h.pos.set(27, 0, 0); h.hp = 999;
  for (const x of [30, 31.5, 33]) { const f = s.spawnFoe('skeleton', 'R'); f.f.pos.set(x, 0, 0.2); f.cd = 99; }
});
await run(2.5);
await shot('p4-pet');
console.log('stage', JSON.stringify(await page.evaluate(() => { const s = window.__game.scene.stage; return { lives: s.heroes[0].lives, potions: s.heroes[0].potions, maxHp: s.heroes[0].f.maxHp, dmgMul: s.heroes[0].f.dmgMul, pets: s.pets.map((p) => p.def.id), foes: s.foes.map((f) => [f.f.state, f.f.alive]) }; })));
// Drep sjefen for XP
await page.evaluate(() => { const s = window.__game.scene.stage; s.camX = s.bossLock; s.heroes[0].f.pos.x = s.bossLock; for (const f of s.foes) f.f.alive && f.f.die('explode', 1, s.heroes[0].f); });
await run(2);
await page.evaluate(() => { const s = window.__game.scene.stage; if (s.boss) s.boss.f.die('explode', 1, s.heroes[0].f); });
for (let i = 0; i < 40 && !(await page.evaluate(() => window.__game.screens.active)); i++) await run(0.5);
await shot('p5-reward');
console.log('reward', JSON.stringify(await st()));
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
