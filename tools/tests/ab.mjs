// A/B av et bilde med og uten en effekt i bildepipelinen (samme frame). Bruk:
// node tools/tests/ab.mjs http://localhost:4173/ ./shots road ao   (ao, bloom, dof eller grade)
import { chromium } from 'playwright';
const [url, out, level = 'road', fx = 'ao'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(120000);
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.addStyleTag({ content: '.announce{display:none!important} #hud{display:none!important}' });
await page.evaluate((level) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: level, name: level, kind: 'level', level, biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
}, level);
// Flytt kameraet til helten så figurene er med i bildet
await page.evaluate(() => { const g = window.__game, s = g.scene.stage; s.camX = s.heroes[0].f.pos.x + 3; for (let i = 0; i < 30; i++) g.tick(1 / 60, false); });
for (const on of [true, false]) {
  await page.evaluate(({ fx, on }) => {
    const g = window.__game;
    g.post.debug[fx] = on;
    g.tick(1 / 60, true);
  }, { fx, on });
  await page.screenshot({ path: `${out}/ab-${level}-${fx}-${on ? 'on' : 'off'}.png` });
}
if (fx === 'ao') {
  await page.evaluate(() => { const g = window.__game; g.post.debug.ao = true; g.post.debug.aoView = true; g.tick(1 / 60, true); });
  await page.screenshot({ path: `${out}/ab-${level}-ao-view.png` });
}
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
