// Menyene: fire knapper på tittelen (antall spillere og motstander med venstre/høyre), OPTIONS med gore og tre
// grupper, alle de gamle innstillingene finnes, ERASE SAVE bare fra tittelen, forklaringen følger valget, og
// kontrollskjermen blas i tre sider med begge tastene for spiller 2 ("/" og "-").
// Bruk: node tools/tests/menus.mjs http://localhost:4173/ [./shots]
// Med FONTS_DIR (CSS og woff2 fra Google Fonts, se memory.md) brukes de ekte fontene, og da sjekkes det også at
// sidene får plass i 1280x720 uten å rulle.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, out] = process.argv.slice(2);
const FD = process.env.FONTS_DIR;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(120000);
if (FD) {
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ path: FD + '/fonts.css', contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://fonts.gstatic.com/**', (r) => {
    const f = FD + '/' + new URL(r.request().url()).pathname.slice(1).replace(/\//g, '_');
    return fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } }) : r.abort();
  });
}
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''));
  if (!ok) fails.push(name);
};
const shot = async (n) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/menus-${n}.png` });
};
const tick = (n = 1) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__game.tick(1 / 60, false); }, n);
// To frames per tastetrykk: menyen reagerer på kanten (trykket), så samme tast to ganger i én frame teller én gang
const key = async (k) => { await page.keyboard.press(k); await tick(2); };
// Radene som "NAVN = VERDI", valgt rad med >
const menu = () => page.evaluate(() => ({
  rows: [...document.querySelectorAll('#screen .menu li')].map((li) => (li.classList.contains('sel') ? '>' : '') + li.querySelector('.lbl').textContent + (li.querySelector('.val .v') ? ' = ' + li.querySelector('.val .v').textContent : '')),
  hint: document.querySelector('#screen .menu-hint')?.textContent ?? null,
  scroll: (() => { const s = document.getElementById('screen'); return s.scrollHeight - s.clientHeight; })(),
  title: document.querySelector('#screen h2')?.textContent ?? null,
}));
const labels = (m) => m.rows.map((r) => r.replace(/^>/, '').split(' = ')[0]);

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); const g = window.__game; g.save = window.__lib.defaultSave(); g.showTitleMenu(); });
await tick(2);

// 1) Tittelen: fire knapper, forklaringen følger valget
let m = await menu();
check('tittelen har fire knapper', JSON.stringify(labels(m)) === JSON.stringify(['STORY', 'DUEL', 'HERO FORGE', 'OPTIONS']), m.rows);
check('forklaringen står under menyen', m.hint === 'WORLD MAP, BOSSES AND DUELS', m.hint);
if (FD) check('tittelen får plass i 1280x720', m.scroll <= 0, { scroll: m.scroll });
await shot('title');
await page.evaluate(() => { window.__logo = document.querySelector('#screen .logo'); });
await key('ArrowRight');
m = await menu();
const sameLogo = await page.evaluate(() => document.querySelector('#screen .logo') === window.__logo);
check('høyre på STORY gir 2 spillere uten å starte logoen på nytt', m.rows[0] === '>STORY = 2 PLAYERS' && m.hint === 'CO-OP ON ONE KEYBOARD OR GAMEPADS' && sameLogo, { rows: m.rows, sameLogo });
await key('ArrowDown');
await key('ArrowRight');
m = await menu();
check('høyre på DUEL gir spiller 2', m.rows[1] === '>DUEL = VS PLAYER 2' && m.hint.includes(' VS '), m);
await key('ArrowLeft');
await key('ArrowUp');
await key('ArrowLeft');
m = await menu();
check('og tilbake til 1 spiller og CPU', m.rows[0] === '>STORY = 1 PLAYER' && m.rows[1] === 'DUEL = VS CPU', m.rows);

// 2) OPTIONS fra tittelen: gore, tre grupper, ERASE SAVE og BACK
await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown');
await key('Enter');
m = await menu();
check('OPTIONS: gore, lyd, skjerm, kontroller, slett og tilbake', m.title === 'OPTIONS' && JSON.stringify(labels(m)) === JSON.stringify(['GORE', 'SOUND', 'SCREEN', 'CONTROLS', 'ERASE SAVE', 'BACK']), m);
await shot('options');
await key('ArrowDown');
await key('Enter');
m = await menu();
check('SOUND har de fire lydvalgene', m.title === 'SOUND' && ['MUSIC', 'MUSIC STYLE', 'SOUND FX', 'RECORDED SOUNDS', 'BACK'].every((l) => labels(m).includes(l)), m.rows);
await key('Escape');
m = await menu();
check('tilbake til OPTIONS med SOUND valgt', m.title === 'OPTIONS' && m.rows[1] === '>SOUND', m.rows);
await key('ArrowDown');
await key('Enter');
m = await menu();
check('SCREEN har de fem skjermvalgene', m.title === 'SCREEN' && ['GRAPHICS', 'FULLSCREEN', 'SCREEN SHAKE', 'FLASHES', 'SCREEN DISTORTION', 'BACK'].every((l) => labels(m).includes(l)), m.rows);
const shake0 = await page.evaluate(() => window.__lib.settings.shake);
await key('ArrowDown'); await key('ArrowDown');
await key('ArrowRight');
m = await menu();
const shake1 = await page.evaluate(() => window.__lib.settings.shake);
check('pil på SCREEN SHAKE slår den av og raden blir valgt', shake1 === !shake0 && m.rows[2] === '>SCREEN SHAKE = ' + (shake1 ? 'ON' : 'OFF'), { shake0, shake1, rows: m.rows });
await key('ArrowRight');
await shot('screen');
await key('Escape');

// 3) Kontrollskjermen: tre sider, begge tastene for spiller 2
await key('ArrowDown');
await key('Enter');
m = await menu();
const keys = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#screen table.keys tr')].find((tr) => tr.cells[0]?.textContent === 'SPECIAL / BLOCK');
  return row ? [...row.cells[2].querySelectorAll('kbd')].map((k) => k.textContent) : null;
});
check('kontrollene: SHOW, rumble, berøring og tilbake', m.title === 'CONTROLS' && JSON.stringify(labels(m)) === JSON.stringify(['SHOW', 'GAMEPAD RUMBLE', 'TOUCH CONTROLS', 'BACK']) && m.rows[0] === '>SHOW = KEYS', m.rows);
check('spiller 2 har både / og - for SPECIAL', JSON.stringify(keys) === JSON.stringify(['/', '-']), keys);
if (FD) check('tastesiden får plass i 1280x720', m.scroll <= 0, { scroll: m.scroll });
await shot('controls-keys');
const pages = [];
for (let i = 0; i < 3; i++) {
  await key('ArrowRight');
  const p = await page.evaluate(() => ({ show: document.querySelector('#screen .menu li .val .v').textContent, moves: document.querySelectorAll('#screen dl.moves dt').length, table: !!document.querySelector('#screen table.keys'), scroll: (() => { const s = document.getElementById('screen'); return s.scrollHeight - s.clientHeight; })() }));
  pages.push(p);
  if (i < 2) await shot('controls-' + i);
}
check('høyre blar BEAT \'EM UP, DUELS og tilbake til KEYS', pages[0].show === "BEAT 'EM UP" && pages[0].moves >= 6 && pages[1].show === 'DUELS' && pages[1].moves >= 6 && pages[2].show === 'KEYS' && pages[2].table, pages);
if (FD) check('trekksidene får plass i 1280x720', pages.every((p) => p.scroll <= 0), pages.map((p) => p.scroll));
await key('Escape');
m = await menu();
check('tilbake til OPTIONS med CONTROLS valgt', m.title === 'OPTIONS' && m.rows[3] === '>CONTROLS', m.rows);

// 4) Fra pausen: OPTIONS uten ERASE SAVE
await page.evaluate(() => { const g = window.__game; g.save.heroMade = [true, true]; g.twoP = false; g.goMap(); });
await tick(20);
await page.evaluate(() => { const g = window.__game; g.paused = false; g.togglePause(); });
await tick();
m = await menu();
check('pausemenyen har OPTIONS', labels(m).includes('OPTIONS') && !labels(m).includes('SETTINGS'), m.rows);
// Klikk (menyene ser bort fra klikk de første 150 ms etter at de vises)
await page.waitForTimeout(400);
await page.evaluate(() => { [...document.querySelectorAll('#screen .menu li')].find((li) => li.textContent.includes('OPTIONS'))?.click(); });
await tick();
m = await menu();
check('OPTIONS fra pausen har ikke ERASE SAVE', m.title === 'OPTIONS' && !labels(m).includes('ERASE SAVE'), m.rows);

// 5) Ingen norske bokstaver noe sted
const nordic = await page.evaluate(() => (document.body.innerText.match(/[æøåÆØÅ]/g) || []).length);
check('ingen æ, ø eller å', nordic === 0, { nordic });

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: menyene er enkle og alt er med');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
