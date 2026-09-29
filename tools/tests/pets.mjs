// Alle kjæledyr i aksjon. Bruk: node pets.mjs URL OUTDIR
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
for (const pet of ['rat', 'dragon', 'skull', 'chicken', 'eyeball']) {
  await page.evaluate((pet) => {
    const g = window.__game, L = window.__lib;
    g.save = L.defaultSave(); g.save.heroMade = [true, true]; g.save.progress[0].pet = pet; g.twoP = false;
    g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  }, pet);
  await run(1.2);
  await page.evaluate(() => {
    const s = window.__game.scene.stage;
    s.waveIdx = 99; s.wave = null; s.lockX = null; s.camX = 30;
    const h = s.heroes[0].f; h.pos.set(27, 0, 0); h.hp = 40; h.facing = 1;
    for (const x of [30.5, 32]) { const f = s.spawnFoe('skeleton', 'R'); f.f.pos.set(x, 0, 0.2); f.cd = 99; }
    s.pets[0].cd = 0; s.pets[0].pos.set(26, 2, -0.4);
    for (let i = 0; i < 6; i++) s.pickups.push(new (s.pickups.constructor === Array ? Object : Object)());
    s.pickups.length = 0;
  });
  await run(0.9);
  const st = await page.evaluate(() => { const s = window.__game.scene.stage; return { pet: s.pets[0].def.id, mode: s.pets[0].mode, proj: s.proj.list.length, foes: s.foes.map((f) => [f.f.state, Math.round(f.f.hp)]), pickups: s.pickups.map((p) => p.kind) }; });
  console.log(JSON.stringify(st));
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/pet-${pet}.png` });
}
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
