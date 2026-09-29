// METAL MODE i brett 1: måleren fylles av drap, så solo, skadebonus, lyn, brennende våpen og HUD-måler.
// Bruk: node tools/tests/metalmode.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); window.__lib.audio.init(); });
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const state = () => page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, L = window.__lib;
  const band = L.audio.band;
  return {
    meter: s.metal.meter.toFixed(2), on: s.metal.on, left: s.metal.left.toFixed(1),
    dmgMul: s.heroes[0].f.dmgMul.toFixed(2), base: s.heroes[0].fx.dmgMul.toFixed(2),
    shred: band ? band.shred : 'no band', style: L.audio.musicStyle,
    hud: document.querySelector('#hud .metal-meter')?.className, fill: document.querySelector('#hud .metal-meter .fill')?.style.width,
    bolts: s.proj.list.filter((p) => p.kind === 'lightning').length, kills: window.__lib.W.stats.kills,
  };
});
await page.evaluate(() => { const g = window.__game; g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true; g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' }); });
await run(1.0);
console.log('start', JSON.stringify(await state()));
// Drep fiender foran helten til måleren er full (ekte drap via die(), med helten som drapsmann)
for (let round = 0; round < 40; round++) {
  const s = await state();
  if (s.on) break;
  await page.evaluate(() => {
    const g = window.__game, st = g.scene.stage, h = st.heroes[0];
    h.f.hp = 9999;
    const foe = st.spawnFoe('skeleton', 'R');
    if (!foe) return;
    foe.f.pos.set(h.f.pos.x + 1.4, 0, h.f.pos.z);
    foe.f.die(['decap', 'explode', 'normal'][Math.floor(Math.random() * 3)], 1, h.f);
  });
  await run(0.3);
}
const s1 = await state();
console.log('after kills', JSON.stringify(s1));
// Tre seige fiender foran helten så lynet har noe å slå ned i
await page.evaluate(() => {
  const st = window.__game.scene.stage, h = st.heroes[0];
  for (let i = 0; i < 3; i++) {
    const foe = st.spawnFoe('hogman', 'R');
    if (!foe) continue;
    foe.f.pos.set(h.f.pos.x + 3 + i * 1.6, 0, -1 + i);
    foe.f.hp = foe.f.maxHp = 400;
  }
});
// Vent til et lyn er i lufta (vfx-lynene lever i omtrent 0.4 s)
let caught = false;
for (let i = 0; i < 240 && !caught; i++) {
  await run(1 / 60);
  caught = await page.evaluate(() => window.__game.gore.vfx.bolts.some((b) => b.t > 0.02 && b.t < 0.2));
}
console.log('bolt caught', caught);
await shot('metal-1');
console.log('in metal mode', JSON.stringify(await state()));
await run(2.0);
await shot('metal-2');
await run(10);
console.log('after', JSON.stringify(await state()));
// Bytt til 8-bit og tilbake
await page.evaluate(() => { window.__lib.setSettings({ musicStyle: 'chip' }); });
console.log('chip', JSON.stringify(await state()));
await page.evaluate(() => { window.__lib.setSettings({ musicStyle: 'metal' }); });
console.log('metal', JSON.stringify(await state()));
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
