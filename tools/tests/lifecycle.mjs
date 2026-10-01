// Scenebytte under venting skal ikke hente tilbake gamle menyer eller meldinger.
// Bruk: node tools/tests/lifecycle.mjs http://localhost:4173/
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
let finishImage;
const imageGate = new Promise((resolve) => { finishImage = resolve; });
let imageRequested;
const requested = new Promise((resolve) => { imageRequested = resolve; });
await page.route('**/assets/manifest.json', async (route) => {
  const response = await route.fetch();
  const manifest = await response.json();
  manifest.props.lifecycle_pending = { file: 'lifecycle_pending.webp', w: 1 };
  await route.fulfill({ response, json: manifest });
});
await page.route('**/assets/lifecycle_pending.webp', async (route) => {
  imageRequested();
  await imageGate;
  await route.fulfill({ path: new URL('../../public/assets/prop_env_fallen_log.webp', import.meta.url).pathname, contentType: 'image/webp' });
});
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });

try {
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => !!window.__game && !!window.__lib, null, { polling: 100 });

  // En ferdig bildenedlasting fra en forlatt forespørsel skal ikke bytte scenen.
  await page.evaluate(() => { window.__game.openEditor('road'); });
  await requested;
  await page.evaluate(() => { window.__game.goTitle(); });
  finishImage();
  await page.waitForFunction(() => !!window.__lib.images.props.lifecycle_pending, null, { polling: 100 });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  assert.equal(await page.evaluate(() => window.__game.scene.name), 'title', 'Forlatt editor åpnet seg etter bildelasting');
  await page.evaluate(() => { window.__game.openEditor('road'); });
  await page.waitForFunction(() => window.__game.scene.name === 'editor', null, { polling: 100 });
  console.log('OK editorlastingen kan avbrytes, og editoren åpner ved neste forespørsel');

  // Hån på tittelen varer spilltid, også i en test uten virkelig ventetid.
  const taunt = await page.evaluate(() => {
    const game = window.__game;
    game.goTitle();
    const actor = game.scene.actors[0];
    actor.setState('taunt');
    const random = Math.random;
    Math.random = () => 0.99;
    try {
      for (let i = 0; i < 60; i++) game.tick(0, false);
      const frozen = actor.state;
      for (let i = 0; i < 70; i++) game.tick(0.02, false);
      return { frozen, after: actor.state };
    } finally { Math.random = random; }
  });
  assert.deepEqual(taunt, { frozen: 'taunt', after: 'idle' });
  console.log('OK tittelfiguren avslutter hån med spilltid');

  const supplies = await page.evaluate(() => {
    const game = window.__game;
    window.__notices = [];
    window.__originalToast = game.toast;
    game.toast = (message) => window.__notices.push(message);
    game.save.supplies = { lives: 1, potions: 1 };
    game.playLevel(window.__lib.MAP_NODES.find((node) => node.level === 'road'));
    game.paused = true;
    for (let i = 0; i < 40; i++) game.tick(0.05, false);
    const paused = [...window.__notices];
    game.paused = false;
    for (let i = 0; i < 13; i++) game.tick(0.05, false);
    return { paused, after: [...window.__notices] };
  });
  assert.equal(supplies.paused.some((message) => message.startsWith('SUPPLIES:')), false);
  assert.equal(supplies.after.filter((message) => message.startsWith('SUPPLIES:')).length, 1);
  console.log('OK forsyningsmeldingen venter gjennom pause og vises én gang');

  await page.evaluate(() => {
    const game = window.__game;
    window.__notices = [];
    game.save.supplies = { lives: 1, potions: 1 };
    game.playLevel(window.__lib.MAP_NODES.find((node) => node.level === 'road'));
    game.goTitle();
  });
  await page.waitForTimeout(750);
  assert.equal(await page.evaluate(() => window.__notices.some((message) => message.startsWith('SUPPLIES:'))), false);
  console.log('OK forsyninger fra et forlatt brett dukker ikke opp på tittelen');

  // Fullskjerm fullføres først etter at brukeren har forlatt skjermmenyen.
  await page.evaluate(() => {
    const game = window.__game;
    game.toast = window.__originalToast;
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: () => new Promise((resolve) => { window.__finishFullscreen = resolve; }),
    });
    game.showSettingsGroup('screen', () => game.showTitleMenu());
    game.screens.items.find((item) => item.label === 'FULLSCREEN').action();
    game.showSettingsGroup('sound', () => game.showTitleMenu());
  });
  await page.evaluate(async () => { window.__finishFullscreen(); await Promise.resolve(); await Promise.resolve(); });
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#screen h2').textContent(), 'SOUND');
  console.log('OK ferdig fullskjermforespørsel åpner ikke en forlatt meny');

  // Replikkene følger duellens spilltid, stopper i pause og blir borte ved scenebytte.
  const intro = await page.evaluate(() => {
    const game = window.__game;
    window.__lines = [];
    window.__originalSay = game.hud.say;
    game.hud.say = (_who, line) => window.__lines.push(line);
    window.__startDuel = () => game.goDuel({
      a: game.heroSide(0), b: game.heroSide(1, false), arena: 'pit', roundsToWin: 2,
      intro: [['ANNOUNCER', 'LIFECYCLE FIRST'], ['ANNOUNCER', 'LIFECYCLE SECOND']],
    }, () => {});
    window.__startDuel();
    for (let i = 0; i < 11; i++) game.tick(0.05, false);
    game.paused = true;
    for (let i = 0; i < 60; i++) game.tick(0.05, false);
    const paused = [...window.__lines];
    game.paused = false;
    for (let i = 0; i < 40; i++) game.tick(0.05, false);
    return { paused, after: [...window.__lines] };
  });
  assert.deepEqual(intro, { paused: ['LIFECYCLE FIRST'], after: ['LIFECYCLE FIRST', 'LIFECYCLE SECOND'] });
  console.log('OK duellreplikker følger spilltid og venter gjennom pause');

  const leaving = await page.evaluate(() => {
    const game = window.__game;
    window.__lines = [];
    window.__startDuel();
    for (let i = 0; i < 11; i++) game.tick(0.05, false);
    game.goTitle();
    for (let i = 0; i < 50; i++) game.tick(0.05, false);
    game.hud.say = window.__originalSay;
    return window.__lines;
  });
  assert.deepEqual(leaving, ['LIFECYCLE FIRST']);
  console.log('OK replikker fra en forlatt duell dukker ikke opp i neste scene');
  assert.deepEqual(errors, []);
} finally {
  finishImage();
  await browser.close();
}
