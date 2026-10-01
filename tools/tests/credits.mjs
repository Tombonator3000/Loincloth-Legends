// Kreditering fra OPTIONS: tastatur, mobil, kilder og hele MIT-tekster også i én offline HTML-fil.
// Bruk: node tools/tests/credits.mjs http://localhost:4173/ [./shots] [file:///.../dist-single/index.html]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [url = 'http://localhost:4173/', out, offline] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const failures = [];
const check = (name, pass, detail) => { console.log(`${pass ? 'OK' : 'FAIL'} ${name}${detail ? ' ' + JSON.stringify(detail) : ''}`); if (!pass) failures.push(name); };
const expectedSounds = Object.keys(JSON.parse(fs.readFileSync('public/assets/sound/sound.json', 'utf8'))).map(s => s + '.mp3');
const licenses = ['node_modules/three/LICENSE', 'public/LICENSES/Threejs-Awesome-Graphics-Agent-Skills.txt', 'public/LICENSES/stylized-scene.txt', 'public/LICENSES/hash-without-sine.txt'].map(f => fs.readFileSync(f, 'utf8').trim());
if (out) fs.mkdirSync(out, { recursive: true });

async function run(target, single) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  if (single) await context.setOffline(true);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(target + (target.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => window.__game && window.__lib, null, { polling: 100 });
  const tick = () => page.evaluate(() => { __game.tick(1 / 60, false); __game.tick(1 / 60, false); });
  const key = async k => { await page.keyboard.press(k); await tick(); };
  await page.evaluate(() => { const g = __game; g.goTitle(); g.showSettings(() => g.showTitleMenu(3)); });
  const labels = await page.locator('#screen .menu .lbl').allTextContents();
  check(`${single ? 'offline' : 'http'} OPTIONS has CREDITS`, labels.includes('CREDITS'), labels);
  await page.waitForTimeout(180);
  await page.locator('#screen .menu li').filter({ hasText: /^CREDITS/ }).tap();
  await page.waitForSelector('.credits');
  check('Studio name is visible', (await page.locator('.credits-content').innerText()).includes("Tom's Happy Happy Funtimes Emporium"));
  check('Credits have a keyboard-focusable reading region', await page.locator('.credits-content').getAttribute('tabindex') === '0');
  await key('ArrowRight'); // CODE
  check('Keyboard changes credit section', await page.locator('.credits').getAttribute('data-credit-section') === 'code');
  const code = [await page.locator('.credits-content').innerText()];
  await key('ArrowDown'); await key('ArrowRight'); code.push(await page.locator('.credits-content').innerText());
  await key('ArrowRight'); code.push(await page.locator('.credits-content').innerText());
  const codeText = code.join('\n');
  check('Imported code and technique attributions are retained', ['three.js', 'Scott Sun', 'Andre Elias', 'Dave Hoskins', 'Ben Golus', 'Felzenszwalb', 'Morbidium', 'The Deep Ones', 'Geometry 3044', 'connect-play', 'Michael Land', 'Peter McConnell', 'Chris Wilson', 'Metal Mania', 'Press Start 2P', 'VT323'].every(n => codeText.includes(n)));
  await key('ArrowUp'); await key('ArrowRight'); // SOUND
  const recordingCount = Number((await page.locator('.credits-menu li').nth(1).locator('.v').textContent()).split('/')[1]);
  await key('ArrowDown');
  let sourceText = '';
  let unsafeLinks = 0;
  for (let p = 1; p < recordingCount; p++) {
    await key('ArrowRight');
    sourceText += await page.locator('.credits-content').innerText();
    unsafeLinks += await page.locator('.credits-source').evaluateAll(links => links.filter(a => !/^https?:/.test(a.href) || a.target !== '_blank' || !a.rel.includes('noopener') || !a.rel.includes('noreferrer')).length);
  }
  const missing = expectedSounds.filter(file => !sourceText.includes(file));
  check('Every shipped recording has its filename and source attribution', missing.length === 0, { expected: expectedSounds.length, missing });
  check('External source links are isolated and use web protocols', unsafeLinks === 0, { unsafeLinks });
  await key('ArrowUp'); await key('ArrowRight'); // LICENSES
  const preserved = [];
  for (let i = 0; i < licenses.length; i++) {
    if (i === 1) await key('ArrowDown');
    if (i) await key('ArrowRight');
    preserved.push((await page.locator('.credits-license').textContent()).trim() === licenses[i]);
  }
  check('All four complete MIT notices match their source files', preserved.every(Boolean), preserved);

  // Gå til første lisenstekst og sjekk lesbarhet / fast meny på stor skjerm, portrett og liggende telefon.
  await key('ArrowRight'); await key('ArrowRight');
  for (const [name, width, height] of [['desktop', 1280, 720], ['portrait', 412, 915], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await tick();
    // Portrett viser spillets vanlige, avvisbare roteringsråd. Bruk samme trykk som spilleren før bildet tas.
    const rotateNote = page.locator('.rotate-note');
    if (await rotateNote.isVisible()) await rotateNote.tap();
    await rotateNote.waitFor({ state: 'hidden' });
    check(`${name} orientation advice does not cover credits`, !(await rotateNote.isVisible()));
    const size = await page.evaluate(() => {
      const panel = document.querySelector('.credits'), menu = document.querySelector('.credits-menu'), body = document.querySelector('.credits-content');
      const p = panel.getBoundingClientRect(), m = menu.getBoundingClientRect();
      return { left: p.left, right: p.right, bottom: p.bottom, top: p.top, menuBottom: m.bottom, menuTop: m.top, contentWidth: body.clientWidth, scrollWidth: body.scrollWidth, contentHeight: body.clientHeight, scrollHeight: body.scrollHeight };
    });
    check(`${name} credits and navigation fit the screen`, size.left >= -1 && size.right <= width + 1 && size.top >= -1 && size.bottom <= height + 1 && size.menuBottom <= height + 1 && size.contentHeight > 35 && size.scrollWidth <= size.contentWidth + 1, size);
    await page.locator('.credits-content').focus();
    await page.keyboard.press('End');
    const atEnd = await page.locator('.credits-content').evaluate(el => el.scrollTop);
    await page.keyboard.press('Home');
    const atHome = await page.locator('.credits-content').evaluate(el => el.scrollTop);
    check(`${name} license text can be read with keyboard scrolling`, (size.scrollHeight <= size.contentHeight || atEnd > 0) && atHome === 0, { atEnd, atHome });
    if (out && !single) await page.screenshot({ path: path.join(out, `credits-${name}.png`) });
  }
  await page.locator('.credits').focus();
  await key('Escape');
  check('Escape returns to OPTIONS with CREDITS selected', await page.locator('#screen h2').textContent() === 'OPTIONS' && await page.locator('#screen .menu li.sel .lbl').textContent() === 'CREDITS');
  await page.waitForTimeout(180);
  await page.locator('#screen .menu li').filter({ hasText: /^CREDITS/ }).tap();
  await page.waitForTimeout(180);
  await page.locator('.credits-menu li').filter({ hasText: /^BACK/ }).tap();
  check('Touch BACK returns to OPTIONS', await page.locator('#screen h2').textContent() === 'OPTIONS');
  if (!single) {
    await page.evaluate(() => { const g = __game; g.save.heroMade = [true, true]; g.twoP = false; g.goMap(); g.paused = false; g.togglePause(); });
    await page.waitForTimeout(180);
    await page.locator('#screen .menu li').filter({ hasText: /^OPTIONS/ }).tap();
    await page.waitForTimeout(180);
    await page.locator('#screen .menu li').filter({ hasText: /^CREDITS/ }).tap();
    await page.waitForTimeout(180);
    await page.locator('.credits-menu li').filter({ hasText: /^BACK/ }).tap();
    check('Credits BACK preserves paused gameplay and returns to OPTIONS', await page.evaluate(() => __game.paused && document.querySelector('#screen h2')?.textContent === 'OPTIONS'));
  }
  check('No credits browser exceptions', errors.length === 0, errors);
  if (single) check('Single-file run kept the browser offline', await page.evaluate(() => navigator.onLine === false));
  await context.close();
}
await run(url, false);
if (offline) await run(offline, true);
else console.log('SKIP offline credits (pass dist-single/index.html file URL)');
await browser.close();
process.exit(failures.length ? 1 : 0);
