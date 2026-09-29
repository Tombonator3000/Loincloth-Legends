// Oppstilling av helter (proporsjoner) mot gropa. Bruk: node heroes.mjs URL OUTDIR
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
const setup = async (cfgs, camX, camY, camZ, lookY, file, extra, flash) => {
  await page.evaluate(({ cfgs, camX, camY, camZ, lookY, extra, flash }) => {
    window.requestAnimationFrame = () => 0;
    const g = window.__game, L = window.__lib;
    g.goTitle();
    g.screens.hide();
    for (const a of g.scene.actors) a.remove();
    g.scene.actors = [];
    const fs = [];
    cfgs.forEach((c, i) => {
      const cfg = c.__preset ? { ...L.PRESETS[c.__preset] } : { ...L.PRESETS.thrugg, ...c };
      const id = L.registerChar(L.buildHeroDef(cfg, 20 + i));
      const f = new L.Fighter(id, 'hero', { hp: 100, speed: 3, weapon: L.WEAPONS[cfg.weapon] });
      f.pos.set((i - (cfgs.length - 1) / 2) * 1.9, 0, 0);
      f.facing = 1;
      f.addTo(L.W.scene);
      fs.push(f);
    });
    for (const [id, x] of extra ?? []) {
      const f = new L.Fighter(id, 'enemy', { hp: 100, speed: 3 });
      f.pos.set(x, 0, -0.3);
      f.facing = -1;
      f.addTo(L.W.scene);
      fs.push(f);
    }
    for (let k = 0; k < 40; k++) for (const f of fs) f.update(1 / 60, { minX: -20, maxX: 20, minZ: -1, maxZ: 1 });
    g.camera.position.set(camX, camY, camZ);
    g.camera.lookAt(camX, lookY, 0);
    g.scene.update = () => {};
    // Fakler i arenaen (LightPool) og eventuelt et farget lysglimt, så gjennom hele bildepipelinen
    const lp = g.gore.vfx.lights;
    if (flash) lp.flash(new L.THREE.Vector3(...flash.pos), flash.color, flash.power, 10, 5);
    lp.update(1 / 60, camX);
    L.W.post.render(L.W.scene, g.camera, 1 / 60);
  }, { cfgs, camX, camY, camZ, lookY, extra, flash });
  await page.screenshot({ path: `${out}/${file}.png` });
};
const men = [0, 1, 2, 3, 4].map((t) => ({ body: 0, torso: t, pelvis: t % 4, boots: t % 4, helmet: t, weapon: t % 4, skin: t }));
const women = [0, 1, 2, 3, 4].map((t) => ({ body: 1, torso: t, pelvis: (t + 1) % 4, boots: (t + 2) % 4, helmet: (t + 2) % 7, weapon: t % 4, hair: 2 + (t % 4), beard: 0, face: t, skin: (t + 2) % 6, hairColor: t + 1 }));
await setup(men, 0, 2.0, 8.5, 1.3, 'h1-men');
await setup(women, 0, 2.0, 8.5, 1.3, 'h2-women');
await setup([{}, { __preset: 'valkyra' }], -0.6, 1.7, 5.2, 1.2, 'h3-presets', [['gorthak', 2.3]]);
// Nærbilde med blått lynlys fra venstre og fakkellys fra høyre (lyssettingen i gfx/charlight.ts)
await setup([{}, { __preset: 'valkyra' }], -0.95, 1.55, 3.4, 1.3, 'h4-light', [], { pos: [-3.5, 2.5, 1.5], color: '#6aa8ff', power: 30 });
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
