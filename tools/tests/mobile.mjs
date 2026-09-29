// Mobil: liggende telefon med berøring. Tittel, Hero Forge, kart og brett med virtuell stikke og knapper.
// Bruk: node mobile.mjs URL OUTDIR
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
const cdp = await ctx.newCDPSession(page);
await page.goto(url);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  const g = window.__game, L = window.__lib;
  g.save = L.defaultSave();
  g.showTitleMenu();
});
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const tapAt = async (x, y) => { await page.waitForTimeout(450); await touch('touchStart', [[x, y]]); await run(0.05); await touch('touchEnd', []); await run(0.05); };
const tapSel = async (sel) => {
  const b = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  if (!b) { console.log('missing', sel); return; }
  await tapAt(b[0], b[1]);
};
const st = () => page.evaluate(() => ({ scene: window.__game.scene.name, screen: window.__game.screens.active, touch: window.__game.touch.visible }));
await run(0.3);
await shot('mob1-title');
await tapSel('#screen .menu li[data-i="0"]'); // STORY 1P
await run(0.4);
console.log('after story', JSON.stringify(await st()));
await shot('mob2-forge');
// DONE-raden i Hero Forge
await tapSel('.creator .cr-row:last-child');
await run(0.5);
console.log('after done', JSON.stringify(await st()));
await tapAt(420, 200); // hopp over intro
await run(0.6);
console.log('map?', JSON.stringify(await st()));
await shot('mob3-map');
// Stikka: dra mot høyre for å gå til første brett
await touch('touchStart', [[150, 250]]);
await touch('touchMove', [[220, 250]]);
await run(0.1);
await touch('touchEnd', []);
await run(2.5);
console.log('walked', JSON.stringify(await page.evaluate(() => ({ node: window.__game.scene.cur?.id }))));
await tapSel('.tb-attack'); // ENTER
await run(0.3);
await tapAt(420, 200); // cutscene
await run(1.5);
console.log('stage?', JSON.stringify(await st()));
// Gå og slå
await touch('touchStart', [[150, 260], [790, 340]]);
await touch('touchMove', [[210, 260], [790, 340]]);
await run(0.6);
await touch('touchEnd', []);
await run(0.4);
await shot('mob4-stage');
const hx = await page.evaluate(() => window.__game.scene.stage.heroes[0].f.pos.x.toFixed(2));
console.log('hero x', hx);
// Portrett
await page.setViewportSize({ width: 390, height: 844 });
await run(0.2);
await shot('mob5-portrait');
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
