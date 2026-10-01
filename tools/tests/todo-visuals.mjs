// Etterbilder av faktisk spill: mobil-HUD, to helter og gjenbrukte kulisser.
// Bruk: node tools/tests/todo-visuals.mjs URL [OUTDIR]
// Ingen mål for bilder per sekund: SwiftShader brukes bare til visuell kontroll.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const [url = 'http://127.0.0.1:4173/', out = './shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 1 });
page.setDefaultTimeout(300000);
const errors = [], captures = [], failed = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|WebGL|shader|GL_INVALID/i.test(m.text())) errors.push(m.text());
});
const check = (name, ok, value) => {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}${value === undefined ? '' : ' ' + JSON.stringify(value)}`);
  if (!ok) failed.push(name);
};
await page.addInitScript(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.setItem('loincloth-legends-settings-v1', JSON.stringify({ quality: 'high', touch: 'on' }));
  let seed = 83107;
  Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
});

async function startStage(level, x, players) {
  await page.evaluate(({ level, x, players }) => {
    const g = window.__game, L = window.__lib;
    g.save = L.defaultSave();
    g.save.heroMade = [true, true];
    g.twoP = players === 2;
    g.input.solo = players === 1;
    g.paused = false;
    g.playLevel({ id: level, name: level, kind: 'level', level, biome: L.LEVELS[level].biome, pos: [0, 0], requires: [], blurb: '' });
    const s = g.scene.stage;
    s.startAt(x);
    s.waveIdx = 999;
    s.wave = null;
    s.lockX = null;
    s.visionDone = true;
    for (const h of s.heroes) {
      h.f.hp = h.f.maxHp;
      h.gold = 123456;
      h.potions = 5;
      h.f.pos.set(x + (players === 2 ? (h.idx ? 2 : -2) : 0), 0, h.idx ? -0.6 : 0.6);
    }
    document.querySelector('.rotate-note')?.classList.add('dismissed');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    document.querySelector('#hud .announce')?.classList.remove('show');
  }, { level, x, players });
  // Lasting av bildekulisser skjer utenfor spillklokka.
  await page.waitForTimeout(500);
}

async function capture(id, expectedPlayers, propIds = []) {
  const result = await page.evaluate(({ id, propIds }) => {
    const g = window.__game, L = window.__lib, s = g.scene.stage, r = g.renderer;
    r.info.autoReset = false;
    r.info.reset();
    g.tick(1 / 60, true);
    g.camera.updateMatrixWorld(true);
    L.W.scene.updateMatrixWorld(true);
    const project = (p) => {
      const q = p.clone().project(g.camera);
      return { x: (q.x + 1) * innerWidth / 2, y: (1 - q.y) * innerHeight / 2, depth: q.z };
    };
    const heroes = s.heroes.map((h) => ({
      name: h.name,
      feet: project(h.f.pos.clone().add(new L.THREE.Vector3(0, 0.04, 0))),
      head: project(h.f.headPoint()),
      alive: h.f.alive,
    }));
    const rect = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    const panels = [...document.querySelectorAll('#hud .pp')].map(rect);
    const meter = document.querySelector('#hud .metal-meter.show');
    const pause = document.querySelector('.touch .t-pause');
    const props = propIds.map((key) => {
      const item = s.scenery.items.get(key);
      if (!item?.mesh) return { key, missing: true };
      const box = new L.THREE.Box3().setFromObject(item.mesh);
      const corners = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(project(new L.THREE.Vector3(x, y, z)));
      const image = item.mat?.uniforms.map?.value?.image;
      return {
        key, missing: false, visible: item.root.visible && item.mesh.visible,
        width: Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x)),
        height: Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y)),
        center: project(box.getCenter(new L.THREE.Vector3())),
        imageReady: !!image && image.width > 0 && image.height > 0,
      };
    });
    const data = { id, viewport: [innerWidth, innerHeight], heroes, panels, meter: meter && rect(meter), pause: g.touch.visible && pause ? rect(pause) : null, props,
      calls: r.info.render.calls, triangles: r.info.render.triangles, textures: r.info.memory.textures,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    r.info.autoReset = true;
    return data;
  }, { id, propIds });
  await page.screenshot({ path: `${out}/${id}.png` });
  captures.push(result);
  const [w, h] = result.viewport;
  const inFrame = (p) => Number.isFinite(p.x + p.y + p.depth) && p.x > 0 && p.x < w && p.y > 0 && p.y < h && p.depth > -1 && p.depth < 1;
  const inside = (b) => b.width > 0 && b.height > 0 && b.x >= -1 && b.y >= -1 && b.right <= w + 1 && b.bottom <= h + 1;
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
  check(`${id}: begge ender av hver levende helt er i bildet`, result.heroes.length === expectedPlayers && result.heroes.every((p) => p.alive && inFrame(p.feet) && inFrame(p.head)), result.heroes);
  check(`${id}: spillerpanelene er innenfor skjermen`, result.panels.length === expectedPlayers && result.panels.every(inside) && !result.overflow, result.panels);
  const boxes = [...result.panels, result.meter, result.pause].filter(Boolean);
  check(`${id}: spillerpanel, metal og pause dekker ikke hverandre`, boxes.every((a, i) => boxes.slice(i + 1).every((b) => !overlap(a, b))), { meter: result.meter, pause: result.pause });
  for (const p of result.props) check(`${id}: ${p.key} har lastet bilde og synlig projisert størrelse`, !p.missing && p.visible && p.imageReady && p.width > 4 && p.height > 4 && inFrame(p.center), p);
}

try {
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => !!window.__game && !!window.__lib, null, { polling: 100 });
  await page.evaluate(() => document.fonts.ready);
  for (const [orientation, width, height] of [['landscape', 844, 390], ['portrait', 412, 915]]) {
    await page.setViewportSize({ width, height });
    for (const players of [1, 2]) {
      const showGate = orientation === 'landscape' && players === 1;
      await startStage('road', showGate ? 34.6 : 55, players);
      await page.evaluate(() => window.__game.hud.say('NARRATOR', 'TWO HEROES. ONE ROAD. VERY LITTLE COMMON SENSE.', 15, false));
      await capture(`hud-${orientation}-${players}p`, players, showGate ? ['p57', 'p58'] : []);
    }
  }
  // Kulissebildene nedenfor velges fra de nye plasseringene, med faktisk kameraprojeksjon.
  await page.setViewportSize({ width: 1280, height: 720 });
  const sceneryViews = [
    { level: 'jungle', x: 80.6, props: ['p1', 'p2', 'p3'] },
    { level: 'frost', x: 68.2, props: ['p21', 'p22'] },
  ];
  for (const view of sceneryViews) {
    await startStage(view.level, view.x, 1);
    await capture(`scenery-${view.level}`, 1, view.props);
  }
  check('ingen nettleser- eller shaderfeil', errors.length === 0, errors);
} finally {
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ captures, failed, errors }, null, 2));
  await browser.close();
}
if (failed.length || errors.length) process.exitCode = 1;
