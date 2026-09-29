// Kjempetrollet i frostpasset (konseptbilde 4): størrelse, rustning til han har tatt nok skade (poise), vakling,
// bakkeslag som rister skjermen, kameraet som trekker seg bakover mens han er i bildet, og at han kan drepes.
// Bruk: node tools/tests/giant.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });

const tick = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__game.tick(1 / 60, false); }, n);
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'frost', name: 'frost', kind: 'level', level: 'frost', biome: 'frost', pos: [0, 0], requires: [], blurb: '' });
});
await tick(90);
const setup = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  // Bølgene holdes unna, så bare kjempen er med
  s.waveIdx = 999; s.wave = null; s.lockX = null;
  h.hp = 9999;
  const foe = s.spawnFoe('bigtroll', 'R');
  foe.f.pos.set(h.pos.x + 3.2, 0, h.pos.z);
  window.__giant = foe;
  return { size: foe.f.size, armored: foe.f.armored, hp: foe.f.hp, zBefore: g.camera.position.z };
});
await tick(180);
const pull = await page.evaluate(() => ({ pull: window.__game.scene.stage.camPull, camZ: window.__game.camera.position.z }));
if (out) {
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/giant-a.png` });
}
// Vent på bakkeslaget
const quake = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f, foe = window.__giant;
  // Et nytt slag: quaked går fra false til true (det forrige kan fortsatt stå på mens han trekker seg tilbake)
  let was = foe.quaked;
  for (let i = 0; i < 60 * 14; i++) {
    h.hp = 9999;
    g.tick(1 / 60, false);
    if (foe.quaked && !was) return { quaked: true, shake: g.fx.shakeAmt, secs: +(i / 60).toFixed(1) };
    was = foe.quaked;
  }
  return { quaked: false, shake: 0, secs: 14 };
});
if (out) {
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/giant-quake.png` });
}
const fight = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, foe = window.__giant;
  const r = {};
  // Vent til slaget er over, så han ikke står i opptrekket
  for (let i = 0; i < 120 && foe.f.state === 'attack'; i++) g.tick(1 / 60, false);
  const hp0 = foe.f.hp;
  L.applyHit(h, foe.f, L.HERO_ATK.slash1);
  r.light = { state: foe.f.state, lost: +(hp0 - foe.f.hp).toFixed(1), armored: foe.f.armored };
  let hits = 1;
  while (foe.f.armored && hits < 30) { L.applyHit(h, foe.f, L.HERO_ATK.slash1); hits++; }
  r.staggerHits = hits;
  r.staggerState = foe.f.state;
  for (let i = 0; i < 90; i++) { h.hp = 9999; g.tick(1 / 60, false); }
  r.armorBack = foe.f.armored;
  let n = 0;
  while (foe.f.alive && n < 200) { L.applyHit(h, foe.f, L.HERO_ATK.chop); n++; }
  r.dead = !foe.f.alive;
  for (let i = 0; i < 300; i++) { h.hp = 9999; g.tick(1 / 60, false); }
  r.pullAfter = +s.camPull.toFixed(3);
  r.camZAfter = +g.camera.position.z.toFixed(2);
  return r;
});

console.log(JSON.stringify({ setup, pull, quake, fight }, null, 1));
let bad = 0;
const check = (name, ok, v) => { if (!ok) bad++; console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}: ${v}`); };
check('stor', setup.size > 2.2, setup.size.toFixed(2));
check('rustning fra start', setup.armored, setup.armored);
check('kameraet trekker seg bakover', pull.pull > 0.8 && pull.camZ > setup.zBefore + 2, `${pull.pull.toFixed(2)}, z ${pull.camZ.toFixed(2)}`);
check('bakkeslag rister', quake.quaked && quake.shake > 0.3, `${quake.quaked} etter ${quake.secs} s, risting ${quake.shake.toFixed(2)}`);
check('lett slag biter ikke', fight.light.state !== 'hurt' && fight.light.lost > 0 && fight.light.armored, JSON.stringify(fight.light));
check('vakler etter nok skade', fight.staggerHits >= 3 && fight.staggerHits <= 10 && fight.staggerState === 'hurt', `${fight.staggerHits} slag, ${fight.staggerState}`);
check('rustningen kommer tilbake', fight.armorBack, fight.armorBack);
check('kan drepes', fight.dead, fight.dead);
check('kameraet tilbake', fight.pullAfter < 0.1, `${fight.pullAfter}, z ${fight.camZAfter}`);
if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(bad ? `FEIL: ${bad}` : 'OK: kjempetrollet oppfører seg');
process.exitCode = bad || logs.length ? 1 : 0;
await browser.close();
