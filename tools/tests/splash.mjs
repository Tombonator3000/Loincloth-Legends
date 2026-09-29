// Oppstartslogoen i tre stillbilder (animasjonene fryses). Bruk: node tools/tests/splash.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url + '?splash');
await page.waitForTimeout(1200);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.mouse.click(640, 360);
for (const [name, ms, land, pres] of [['s5-falling', 380, false, false], ['s6-landed', 450, true, false], ['s7-presents', 1400, true, true]]) {
  await page.evaluate(({ ms, land, pres }) => {
    const s = window.__game.splash;
    for (const t of s.timers) clearTimeout(t);
    s.timers = [];
    if (land && !s.root.classList.contains('landed')) s.land();
    if (pres) s.root.classList.add('pres');
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; }
  }, { ms, land, pres });
  await page.screenshot({ path: `${out}/${name}.png` });
}
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
