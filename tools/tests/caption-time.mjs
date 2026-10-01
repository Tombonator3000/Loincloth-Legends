// Tekst over spillverdenen følger pause, treffstopp og slowmo. Intro/menyer beholder sanntid.
// Bruk: node tools/tests/caption-time.mjs http://127.0.0.1:4173/
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });

try {
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => !!window.__game && !!window.__lib, null, { polling: 100 });
  await page.evaluate(() => {
    const game = window.__game;
    window.__captionScene = () => ({ name: 'caption-test', pausable: true, update() {} });
    window.__captionReset = () => {
      game.setScene(window.__captionScene);
      game.screens.hide();
      game.hud.visible(true);
      game.camera.position.set(0, 2, 10);
      game.camera.lookAt(0, 2, 0);
      game.camera.updateMatrixWorld();
    };
    window.__captions = (life = 1) => {
      game.hud.announce('CAPTION ANNOUNCEMENT', '', life);
      game.hud.say('NARRATOR', 'CAPTION DIALOGUE', life, false);
      game.hud.streak(10, 'CAPTION STREAK');
      game.fx.text(new window.__lib.THREE.Vector3(0, 2, 0), 'CAPTION SPEECH', 'speech', life);
      game.tick(0, false);
    };
    window.__captionSnapshot = () => ({
      announcement: document.querySelector('.announce').classList.contains('show'),
      dialogue: document.querySelector('.say').classList.contains('show'),
      streak: document.querySelector('.streak').classList.contains('show'),
      speech: !!document.querySelector('.ftext.speech'),
      speechTransform: document.querySelector('.ftext.speech')?.style.transform ?? '',
      speechOpacity: document.querySelector('.ftext.speech')?.style.opacity ?? '',
    });
    window.__captionTick = (count) => { for (let i = 0; i < count; i++) game.tick(0.05, false); };
    window.__captionReset();
    window.__captions(0.3);
  });

  // Uten spillframes går det ingen skjult HUD-klokke i bakgrunnen.
  const initial = await page.evaluate(() => window.__captionSnapshot());
  await page.waitForTimeout(450);
  assert.deepEqual(await page.evaluate(() => window.__captionSnapshot()), initial);
  console.log('OK ingen skjult sanntidsklokke fjerner kunngjøringer eller dialog');

  const paused = await page.evaluate(() => {
    window.__game.paused = true;
    window.__captionTick(50);
    return window.__captionSnapshot();
  });
  assert.deepEqual(paused, initial, 'Pause flyttet eller fjernet tekst');
  const resumed = await page.evaluate(() => {
    window.__game.paused = false;
    window.__captionTick(7);
    return window.__captionSnapshot();
  });
  assert.equal(resumed.announcement, false);
  assert.equal(resumed.dialogue, false);
  assert.equal(resumed.speech, false);
  assert.equal(resumed.streak, true);
  console.log('OK tekst står stille i pause og utløper etter riktig spilltid når spillet fortsetter');

  const slow = await page.evaluate(() => {
    window.__captionReset();
    window.__captions();
    window.__game.fx.slowmo(0.25, 10);
    window.__captionTick(40); // 2 sekunder sanntid, 0,5 sekunder spilltid.
    const half = window.__captionSnapshot();
    window.__captionTick(41);
    const full = window.__captionSnapshot();
    window.__captionTick(97);
    return { half, full, later: window.__captionSnapshot() };
  });
  assert.equal(slow.half.announcement && slow.half.dialogue && slow.half.speech && slow.half.streak, true);
  assert.equal(slow.full.announcement || slow.full.dialogue || slow.full.speech, false);
  assert.equal(slow.full.streak, true);
  assert.equal(slow.later.streak, false);
  console.log('OK dialog, kunngjøringer, snakkebobler og drapsrekker følger slowmo');

  const hitstop = await page.evaluate(() => {
    window.__captionReset();
    window.__captions(0.3);
    const before = window.__captionSnapshot();
    window.__game.fx.stop(0.5);
    window.__captionTick(8);
    return { before, during: window.__captionSnapshot() };
  });
  assert.deepEqual(hitstop.during, hitstop.before, 'Treffstopp flyttet eller fjernet tekst');
  console.log('OK treffstopp holder både levetid og bevegelse stille');

  const replaced = await page.evaluate(() => {
    window.__captionReset();
    window.__game.hud.announce('OLD', '', 0.2);
    window.__game.hud.say('NARRATOR', 'OLD', 0.2, false);
    window.__captionTick(2);
    window.__game.hud.announce('REPLACEMENT', '', 1);
    window.__game.hud.say('NARRATOR', 'REPLACEMENT', 1, false);
    window.__captionTick(5);
    return {
      announcement: document.querySelector('.announce.show .a-main')?.textContent,
      dialogue: document.querySelector('.say.show span')?.textContent,
    };
  });
  assert.deepEqual(replaced, { announcement: 'REPLACEMENT', dialogue: 'REPLACEMENT' });
  console.log('OK en eldre meldings levetid avkorter ikke en ny melding');

  const transition = await page.evaluate(() => {
    window.__captionReset();
    window.__captions();
    window.__game.setScene(() => {
      window.__game.hud.announce('NEW SCENE', '', 1);
      window.__game.hud.say('NARRATOR', 'NEW SCENE DIALOGUE', 1, false);
      return window.__captionScene();
    });
    const body = window.__game.hud.root.textContent;
    const fresh = window.__captionSnapshot();
    window.__captionTick(10);
    return { body, fresh, after: window.__captionSnapshot() };
  });
  assert.equal(transition.body.includes('CAPTION'), false);
  assert.equal(transition.fresh.speech || transition.fresh.streak, false);
  assert.equal(transition.fresh.announcement && transition.fresh.dialogue, true);
  assert.equal(transition.after.announcement && transition.after.dialogue, true);
  console.log('OK scenebytte fjerner gamle tekster og beholder nye annonser fra scenens konstruktør');

  const menu = await page.evaluate(() => {
    window.__captionReset();
    window.__captions(0.3);
    window.__game.fx.slowmo(0.01, 10);
    window.__game.screens.intro(['ABCDEFGHIJKLMNOPQRSTUVWXYZ'], () => {});
    window.__captionTick(10);
    return {
      letters: window.__game.screens.root.querySelector('.intro-text p')?.textContent?.length ?? 0,
      captions: window.__captionSnapshot(),
    };
  });
  assert.ok(menu.letters >= 15, 'Menyintroens skriving fulgte slowmo i stedet for sanntid');
  assert.equal(menu.captions.announcement && menu.captions.dialogue && menu.captions.speech, true);
  console.log('OK menyintro bruker sanntid mens tekst i den stansede spillverdenen venter');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
