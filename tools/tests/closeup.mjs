// Nærbilde av én figur i ulike poser. Bruk: node closeup.mjs URL OUTDIR '{"body":0}' [charId]
import { chromium } from 'playwright';
const [url, out, cfgJson, charId] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
await page.evaluate(({ cfgJson, charId }) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__game, L = window.__lib;
  g.goTitle();
  g.screens.hide();
  for (const a of g.scene.actors) a.remove();
  g.scene.actors = [];
  const poses = [null, { armF: 3.0, armB: 2.9, weapon: 0.1, head: 0.2 }, { armF: 1.57, armB: 1.57, weapon: -1.57 }, { armF: 0.0, armB: 0.0, weapon: -1.4 }];
  poses.forEach((pose, i) => {
    let id = charId;
    if (!id) {
      const cfg = { ...L.PRESETS.thrugg, ...JSON.parse(cfgJson || '{}') };
      id = L.registerChar(L.buildHeroDef(cfg, 30 + i));
    }
    const f = new L.Fighter(id, 'hero', { hp: 100, speed: 3 });
    f.pos.set((i - 1.5) * 2.2, 0, 0);
    f.facing = i % 2 ? -1 : 1;
    f.addTo(L.W.scene);
    for (let k = 0; k < 30; k++) f.update(1 / 60, { minX: -20, maxX: 20, minZ: -1, maxZ: 1 });
    if (pose) { f.rig.snap({ ...f.rig.pose, ...pose }); f.rig.sync(); }
  });
  g.camera.position.set(-1.1, 1.3, 4.2);
  g.camera.lookAt(-1.1, 1.25, 0);
  g.scene.update = () => {};
  g.renderer.render(L.W.scene, g.camera);
}, { cfgJson, charId });
await page.screenshot({ path: `${out}/closeup.png` });
console.log(logs.join('\n'));
await browser.close();
