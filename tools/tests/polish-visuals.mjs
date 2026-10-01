// Samme frø, kamerasted og bildestørrelse før/etter miljøpakken. Bilder må også sees av et menneske/agent.
// Bruk: node tools/tests/polish-visuals.mjs http://localhost:4173/ ./shots after|baseline
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const [url = 'http://localhost:4173/', out = './shots', revision = 'after'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const errors = [], captures = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && /THREE|WebGL|shader|GL_INVALID/i.test(m.text())) errors.push(m.text()); });
await page.addInitScript(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.setItem('loincloth-legends-settings-v1', JSON.stringify({ quality: 'high' }));
  let seed = 1471;
  Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
});
try {
  await page.goto(url + '?nosplash');
  await page.waitForFunction(() => !!window.__game && !!window.__lib, null, { polling: 100 });
  await page.addStyleTag({ content: '.announce{display:none!important}' });
  for (const [id, x] of [['road', 55], ['nightcamp', 34.5], ['jungle', 72], ['scorch', 35]]) {
    await page.evaluate(({ id, x }) => {
      const g = window.__game;
      g.save.heroMade = [true, true];
      g.twoP = false;
      g.input.solo = true;
      g.testLevel(id, x);
    }, { id, x });
    // Påslått spilltid, men ingen GPU-arbeid før selve bildet. La asynkrone kulissebilder bli klare først.
    await page.waitForTimeout(1000);
    const data = await page.evaluate(({ id, x }) => {
      const g = window.__game, L = window.__lib, s = g.scene.stage;
      for (const h of s.heroes) { h.f.hp = 99999; h.f.pos.x = x; }
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
      s.camX = x;
      g.camera.position.x = x;
      g.camera.lookAt(x, 1.8, 0);
      const r = g.renderer;
      r.info.autoReset = false;
      r.info.reset();
      g.tick(1 / 60, true);
      const data = {
        id, x, calls: r.info.render.calls, triangles: r.info.render.triangles,
        textures: r.info.memory.textures, geometries: r.info.memory.geometries,
        jungleTextures: ['ground_jungle', 'road_jungle'].filter((k) => !!L.images.textures[k]),
        canvas: [r.domElement.width, r.domElement.height],
      };
      r.info.autoReset = true;
      return data;
    }, { id, x });
    await page.screenshot({ path: `${out}/${id}.png` });
    captures.push(data);
    console.log(JSON.stringify(data));
  }
  // Mobilformatet etter at skjermdråpene har blitt aktivert, og et bildebreddebytte med levende effekter.
  await page.evaluate(() => window.__lib.screenFX.wet.splash(0.42, 0.18, 0.7, true));
  await page.setViewportSize({ width: 412, height: 915 });
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/portrait.png` });
  if (revision === 'after' && captures.find((c) => c.id === 'jungle').jungleTextures.length !== 2) errors.push('Jungelens nye teksturer ble ikke lastet.');
} finally {
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ revision, captures, errors }, null, 2));
  await browser.close();
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
