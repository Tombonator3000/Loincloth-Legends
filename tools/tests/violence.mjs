// Teit vold: hode i skjermen (duell), arm som ryker, hodeløs kylling (brett). Bruk: node violence.mjs URL OUTDIR
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); };

// 1) Duell: arm av, så halshugging og imp-spark mot skjermen
await page.evaluate(() => {
  const g = window.__game;
  g.goDuel({ a: g.heroSide(0, false), b: { cid: 'gorthak', name: 'GORTHAK', human: false, hp: 110, speed: 2.6, dmg: 1, skill: 0, aggression: 0 }, roundsToWin: 2, arena: 'pit' }, () => {});
});
await run(4.5);
await page.evaluate(() => { const d = window.__game.scene.duel; d.fb.loseArm(1); d.fa.think = 99; });
await run(0.5);
await shot('v1-armoff');
await run(1.2);
await shot('v2-fleshwound');
await page.evaluate(() => { const d = window.__game.scene.duel; d.fb.loseArm(1); });
await run(1.5);
await shot('v3-noarms');
await page.evaluate(() => { const d = window.__game.scene.duel; d.fb.die('decap', 1, d.fa); d.ko(d.fb, true); });
await run(3.4);
let st = await page.evaluate(() => { const d = window.__game.scene.duel; return { phase: d.phase, imp: d.impStage }; });
console.log('after ko', st);
for (let i = 0; i < 60; i++) {
  await run(0.1);
  st = await page.evaluate(() => { const d = window.__game.scene.duel; const h = d.loser.headDebris; return { phase: d.phase, imp: d.impStage, glass: window.__game.fx.headOnGlass, head: h && [h.obj.position.x.toFixed(2), h.obj.position.y.toFixed(2), !!h.obj.parent, h.rest], impX: d.imp && d.imp.pos.x.toFixed(2), impState: d.imp && d.imp.state }; });
  if (st.imp >= 2) break;
}
console.log('kicked', st);
await run(0.3);
await shot('v4-headflying');
await run(0.45);
await shot('v5-splat');
await run(2.2);
await shot('v6-sliding');

// 2) Brett: hodeløs kylling
await page.evaluate(() => {
  const g = window.__game;
  g.twoP = false;
  g.save.completed = ['road'];
  g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
});
await run(2);
await page.evaluate(() => {
  const s = window.__game.scene.stage;
  s.spawnFoe('hogman', 'R');
  s.spawnFoe('skeleton', 'R');
  const f = s.foes[s.foes.length - 2].f;
  f.pos.set(s.heroes[0].f.pos.x + 2.5, 0, 0);
  const r = Math.random; Math.random = () => 0.1; f.die('decap', 1, s.heroes[0].f); Math.random = r;
});
await run(0.6);
await shot('v7-headless');
await run(1.0);
await shot('v8-headless2');
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
