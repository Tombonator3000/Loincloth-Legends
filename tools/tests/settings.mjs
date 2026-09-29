// Innstillinger: gore-nivå via menyen (klikk på pilene og tastatur), og at FAMILY gir konfetti og gummiender
// mens PLEASE SEEK HELP gir mer av alt. Bruk: node settings.mjs URL OUTDIR
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  const g = window.__game, L = window.__lib;
  L.setSettings({ gore: 2 });
  g.save = L.defaultSave();
  g.showTitleMenu();
});
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const state = () => page.evaluate(() => {
  const li = document.querySelector('#screen .menu li[data-i="0"]');
  return { label: li ? li.firstChild?.nextSibling?.textContent ?? li.textContent : null, setting: window.__lib.settings.gore, gore: window.__game.gore.level };
});

await page.waitForTimeout(400);
await page.click('#screen .menu li:has-text("SETTINGS")');
await run(0.1);
console.log('open', JSON.stringify(await state()));
await shot('set1-menu');

// Pilene: EXCESSIVE -> NORMAL -> FAMILY
for (let i = 0; i < 2; i++) {
  await page.waitForTimeout(250);
  await page.click('#screen .menu li[data-i="0"] .adj.l');
}
console.log('arrows', JSON.stringify(await state()));
await shot('set2-family');

// Tastatur: venstre fra FAMILY går rundt til PLEASE SEEK HELP, høyre tilbake til FAMILY
await page.keyboard.press('ArrowLeft');
await run(0.05);
console.log('key left', JSON.stringify(await state()));
await page.keyboard.press('ArrowRight');
await run(0.05);
console.log('key right', JSON.stringify(await state()));

// Lagres de?
const saved = await page.evaluate(() => localStorage.getItem('loincloth-legends-settings-v1'));
console.log('saved', saved);

// Blodbad på brettet med to nivåer
const carnage = async (tag) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.twoP = false;
    g.save.completed = ['road'];
    g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  });
  await run(2);
  const n = await page.evaluate(() => {
    const g = window.__game, s = g.scene.stage;
    const h = s.heroes[0].f;
    for (const [id, dx, how] of [['hogman', 2.2, 'decap'], ['skeleton', 3.2, 'bisect'], ['cultist', 4.2, 'explode']]) {
      s.spawnFoe(id, 'R');
      const f = s.foes[s.foes.length - 1].f;
      f.pos.set(h.pos.x + dx, 0, 0);
      f.die(how, 1, h);
    }
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    return { particles: g.gore.drops.live, debris: g.gore.debris.length, litres: Math.round(g.gore.litres * 10) / 10 };
  });
  console.log(tag, JSON.stringify(n));
  await run(0.25);
  await shot('set-' + tag);
};
await carnage('family');
await page.evaluate(() => window.__lib.setSettings({ gore: 3 }));
await carnage('seekhelp');
await page.evaluate(() => window.__lib.setSettings({ gore: 2 }));

console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
