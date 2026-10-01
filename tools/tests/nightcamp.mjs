// Nattleiren (Golden Axe-hyllest): heltene sover, tyvnisser stjeler krukker, treff gir dem tilbake, daggry,
// og krukkene blir forsyninger til neste brett. Bruk: node tools/tests/nightcamp.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// Det første bildet tar over 30 sekunder i SwiftShader (skyggeleggerne kompileres), også før brettverkstedet
page.setDefaultTimeout(300000);
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
const run = (sec, keys = []) => page.evaluate(({ sec, keys }) => {
  const g = window.__game; const inp = g.input;
  for (let i = 0; i < Math.round(sec * 60); i++) { for (const k of keys) inp.keys.add(k); g.tick(1 / 60, false); }
  for (const k of keys) inp.keys.delete(k);
}, { sec, keys });
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const st = () => page.evaluate(() => {
  const g = window.__game, s = g.scene.stage;
  if (!s) return { scene: g.scene.name, screen: g.screens.active, supplies: g.save.supplies };
  return { scene: g.scene.name, camX: s.camX.toFixed(1), wave: s.waveIdx, pots: s.heroes.map((h) => h.potions), state: s.heroes[0].f.state,
    gnomes: s.foes.filter((f) => f.f.alive && f.def.behavior === 'runner').length, stolen: [...s.stolen.values()].reduce((a, v) => a + v.n, 0), done: s.done, finishT: s.finishT.toFixed(1) };
});
// Kartnoden finnes og krever jungelen
const node = await page.evaluate(() => { const n = window.__game.constructor && window.__lib; return null; });
await page.evaluate(() => { const g = window.__game; g.save.heroMade = [true, true]; g.save.completed = ['road', 'jungle']; g.twoP = false; g.input.solo = true; });
await page.evaluate(() => { const g = window.__game; g.playLevel({ id: 'nightcamp', name: 'THE NIGHT CAMP', kind: 'level', level: 'nightcamp', biome: 'grass', pos: [0, 0], requires: [], blurb: '' }); });
await run(0.2);
console.log('start', JSON.stringify(await st()));
await shot('camp-1-sleep');
// La tyvene komme mens helten sover
let stole = false;
for (let i = 0; i < 30 && !stole; i++) {
  await run(0.25);
  const s = await st();
  stole = s.stolen > 0;
}
console.log('after thieves', JSON.stringify(await st()));
await shot('camp-2-yoink');
// Slå en tyv som har stjålet: krukkene skal falle ut igjen
const hit = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0];
  const thief = [...s.stolen.entries()].find(([fo, v]) => v.n > 0 && fo.f.alive)?.[0];
  if (!thief) return 'no thief alive';
  const before = s.pickups.filter((p) => p.kind === 'potion').length;
  s.onFoeHit(h, thief.f, false);
  return { before, after: s.pickups.filter((p) => p.kind === 'potion').length };
});
console.log('hit thief', JSON.stringify(hit));
// Gå gjennom resten av leiren: gå til høyre, slå tyvene som kommer forbi
for (let i = 0; i < 60; i++) {
  const s = await st();
  if (s.scene !== 'stage' || s.done || Number(s.finishT) > 0) break;
  await page.evaluate(() => {
    const s = window.__game.scene.stage, h = s.heroes[0];
    h.f.hp = 9999;
    for (const fo of s.foes) if (fo.f.alive && Math.abs(fo.f.pos.x - h.f.pos.x) < 3 && Math.random() < 0.5) fo.f.die('normal', 1, h.f);
  });
  await run(0.5, ['KeyD']);
  await run(0.5);
}
console.log('dawn?', JSON.stringify(await st()));
await shot('camp-3-dawn');
for (let i = 0; i < 20; i++) {
  const s = await st();
  if (s.scene !== 'stage') break;
  await run(0.5);
}
await page.waitForTimeout(400);
console.log('end', JSON.stringify(await st()));
const lines = await page.evaluate(() => document.querySelector('#screen')?.innerText?.slice(0, 400));
console.log('screen', JSON.stringify(lines));
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
