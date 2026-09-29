// Hyllest-mekanikk: tordenmagi med seks krukker (Golden Axe), sjonglering i lufta (Castle Crashers) og
// B-film-replikker etter drapsrekker. Bruk: node tools/tests/homage.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
// Helt med tordenmagi (magic = 2)
await page.evaluate(() => {
  const g = window.__game, L = window.__lib;
  g.save.heroes[0] = { ...L.PRESETS.thrugg, magic: 2 };
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
});
await run(1.0);
const info = await page.evaluate(() => { const h = window.__game.scene.stage.heroes[0]; return { magic: h.magic, name: h.name }; });
console.log('hero', JSON.stringify(info));
// Fem fiender foran helten, seks krukker, kast magien
await page.evaluate(() => {
  const st = window.__game.scene.stage, h = st.heroes[0];
  h.f.hp = 9999;
  for (let i = 0; i < 5; i++) {
    const foe = st.spawnFoe(i % 2 ? 'hogman' : 'skeleton', 'R');
    if (foe) foe.f.pos.set(h.f.pos.x + 2.5 + i * 1.3, 0, -1.6 + i * 0.8);
  }
  h.potions = 6;
  st.castMagic(h);
});
let caught = false;
for (let i = 0; i < 200 && !caught; i++) {
  await run(1 / 60);
  caught = await page.evaluate(() => window.__game.gore.vfx.bolts.filter((b) => b.t > 0.02 && b.t < 0.2).length >= 2);
}
console.log('bolts caught', caught);
await shot('homage-thunder');
await run(2.5);
const after = await page.evaluate(() => { const st = window.__game.scene.stage; return { magic: !!st.magic, alive: st.foes.filter((f) => f.f.alive).length, kills: window.__lib.W.stats.kills, metal: st.metal.meter.toFixed(2) }; });
console.log('after thunder', JSON.stringify(after));
// Sjonglering: slå en fiende opp i lufta og treff ham flere ganger før han lander
const jug = await page.evaluate(() => {
  const st = window.__game.scene.stage, h = st.heroes[0];
  const foe = st.spawnFoe('hogman', 'R');
  foe.f.pos.set(h.f.pos.x + 1.2, 0, h.f.pos.z);
  foe.f.hp = foe.f.maxHp = 999;
  const texts = [];
  const orig = window.__lib.W.fx.text.bind(window.__lib.W.fx);
  window.__lib.W.fx.text = (p, msg, cls, life) => { texts.push(msg); return orig(p, msg, cls, life); };
  // Tre treff mens han er i lufta (onFoeHit er privat, men kan kalles fra testen)
  foe.f.onGround = false;
  foe.f.pos.y = 1.5;
  for (let i = 0; i < 4; i++) st.onFoeHit(h, foe.f, false);
  return texts;
});
console.log('juggle texts', JSON.stringify(jug));
// Replikk etter fem drap på rad
const say = await page.evaluate(() => {
  const st = window.__game.scene.stage, h = st.heroes[0];
  st.streak = 0;
  for (let i = 0; i < 5; i++) {
    const foe = st.spawnFoe('skeleton', 'R');
    foe.f.pos.set(h.f.pos.x + 1.4, 0, h.f.pos.z);
    foe.f.die('normal', 1, h.f);
  }
  return document.querySelector('#hud .say')?.textContent;
});
console.log('say', say);
await run(0.3);
await shot('homage-say');
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
