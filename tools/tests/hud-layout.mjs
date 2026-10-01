// Ekte HUD-DOM i PC-, liggende mobil- og stående mobilformat. Ingen spillbilder trengs for geometritestene.
// Bruk: node tools/tests/hud-layout.mjs http://localhost:4173/ ./shots/hud
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const [url = 'http://localhost:4173/', out = './shots/hud'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
  if (!ok) errors.push(name);
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true, reducedMotion: 'reduce' });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    localStorage.setItem('loincloth-legends-settings-v1', JSON.stringify({ quality: 'low', touch: 'off' }));
  });
  await page.route('**/assets/manifest.json', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => !!window.__game && !!window.__lib, null, { polling: 100 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '#gl { background: linear-gradient(125deg, #758345, #493024 55%, #c7b579); } .rotate-note { display: none !important; }' });

  for (const [label, width, height] of [['desktop', 1280, 720], ['landscape', 844, 390], ['portrait', 412, 915], ['small', 320, 568]]) {
    await page.setViewportSize({ width, height });
    for (const players of [1, 2]) {
      await page.evaluate(({ players, touch }) => {
        const g = window.__game;
        g.screens.hide();
        g.hud.visible(true);
        g.touch.setVisible(touch);
        const heroes = [
          { idx: 0, cid: 'thrugg', name: 'THRUGG THE UNREASONABLE', f: { hp: 85, maxHp: 100, alive: true }, lives: 12, potions: 5, gold: 999999 },
          { idx: 1, cid: 'valkyra', name: 'VALKYRA OF THE IRON COAST', f: { hp: 63, maxHp: 100, alive: true }, lives: 8, potions: 3, gold: 87654 },
        ].slice(0, players);
        g.hud.showBrawler(heroes);
        g.hud.updateBrawler(heroes);
        g.hud.metal(0.72, true);
        g.hud.say('THE NARRATOR', 'Amberly is still in the tower. Follow the road, and watch the tree line.', 1000, false);
      }, { players, touch: width < 1100 });
      const data = await page.evaluate(() => {
        const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
        const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
        const inside = r => r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        const panels = [...document.querySelectorAll('.pp')].map(rect);
        const meter = rect(document.querySelector('.metal-meter'));
        const caption = rect(document.querySelector('.say'));
        const touch = getComputedStyle(document.querySelector('.touch')).display !== 'none';
        const buttons = [...document.querySelectorAll('.tbtn, .t-pause')].map(rect);
        const numbers = [...document.querySelectorAll('.pp .lives, .pp .gold')].map(el => {
          const r = rect(el), owner = rect(el.closest('.pp'));
          return { text: el.textContent, fits: r.x >= owner.x && r.right <= owner.right + 1 && r.bottom <= owner.bottom, size: parseFloat(getComputedStyle(el).fontSize) };
        });
        const textOverflow = [...document.querySelectorAll('.pp .pname, .say b, .say span')].some(e => e.scrollWidth > e.clientWidth + 1);
        return { panels, meter, caption, numbers, textOverflow, within: [...panels, meter, caption].every(inside), overlap: panels.some(p => intersects(p, meter)) || (panels.length > 1 && intersects(panels[0], panels[1])), captionClash: intersects(caption, meter) || panels.some(p => intersects(p, caption)), touchClash: touch && buttons.some(b => intersects(b, caption) || intersects(b, meter) || panels.some(p => intersects(p, b))) };
      });
      const name = `${label}-${players}p`;
      check(`${name}: paneler, navn, METAL og replikk overlapper ikke`, data.within && !data.overlap && !data.captionClash && !data.textOverflow, data);
      check(`${name}: liv og gull er synlige, og berøringsknappene har plass`, data.numbers.every(n => n.fits && n.size >= 12) && !data.touchClash, { numbers: data.numbers, touchClash: data.touchClash });
      await page.screenshot({ path: `${out}/${name}.png` });
    }

    await page.evaluate(() => {
      const g = window.__game;
      g.hud.showDuel({ cid: 'thrugg', name: 'THRUGG THE UNREASONABLE', human: true }, { cid: 'valkyra', name: 'VALKYRA OF THE IRON COAST', human: false });
      g.hud.updateDuel({ hp: 80, maxHp: 100 }, { hp: 70, maxHp: 100 }, [1, 0], 89, 1);
    });
    const duel = await page.evaluate(() => {
      const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom }; };
      const a = rect('.dside.a'), b = rect('.dside.b'), timer = rect('.dtimer');
      const textFits = [...document.querySelectorAll('.dname')].every(e => e.scrollWidth <= e.clientWidth + 1);
      return { a, b, timer, fits: a.x >= 0 && b.right <= innerWidth + 1 && a.right <= timer.x + 1 && timer.right <= b.x + 1 && textFits, metalHidden: getComputedStyle(document.querySelector('.metal-meter')).display === 'none' };
    });
    check(`${label}: duellnavn, livslinjer og klokke får hvert sitt felt`, duel.fits && duel.metalHidden, duel);
    await page.screenshot({ path: `${out}/${label}-duel.png` });
  }
} finally {
  writeFileSync(`${out}/geometry.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`${results.length} HUD-kontroller bestått.`);
