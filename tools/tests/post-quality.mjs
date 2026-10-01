// Regresjoner for bildebudsjett, bloom, opprydding, skjermrotasjon og automatisk kvalitet.
// Tegner en liten, jevn HDR-flate for å måle bloom uavhengig av scenens tilfeldige effekter.
// Bruk: node tools/tests/post-quality.mjs http://localhost:4173/
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${JSON.stringify(detail ?? {})}`);
  if (!ok) failures.push(name);
};
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => failures.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /THREE|WebGL|shader|GL_INVALID/i.test(m.text())) failures.push(m.text());
  });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    localStorage.setItem('loincloth-legends-settings-v1', JSON.stringify({ quality: 'low' }));
  });
  // Denne testen måler pipeline og simulering, og trenger ingen eksterne kunstfiler.
  await page.route('**/assets/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => !!window.__lib && !!window.__game, null, { polling: 100 });

  const wet = await page.evaluate(() => {
    const Wet = window.__lib.screenFX.wet.constructor;
    const w = new Wet();
    w.enabled = true;
    w.splash(0.5, 0.15, 1, true);
    const d = w.drops[0];
    d.r = 6 * Math.min(w.W, w.H) / 135;
    d.fresh = 0;
    w.update(1 / 60);
    const started = d.sliding && !!d.trail;
    const sizes = [[w.W, w.H]];
    for (const aspect of [9 / 16, 4 / 3, 16 / 9]) {
      w.aspect = aspect;
      w.update(1 / 60);
      sizes.push([w.W, w.H]);
    }
    const texture = w.texture();
    const valid = w.drops.every((x) => (!x.sliding || !!x.trail) && [x.x, x.y, x.r, x.py, x.vx, x.vy].every(Number.isFinite))
      && w.trails.every((t) => t.p.every(Number.isFinite));
    return { started, valid, drops: w.drops.length, trails: w.trails.length, sizes, uploaded: !!texture };
  });
  check('rennende blod tåler tre formatbytter og beholder sporene', wet.started && wet.valid && wet.drops > 0 && wet.trails > 0 && wet.uploaded, wet);

  const gov = await page.evaluate(() => {
    const Gov = window.__game.governor.constructor;
    const g = new Gov();
    const sampleWindow = () => {
      let down = null;
      for (let i = 0; i < 20; i++) down = g.sample(0.1, true, 'high') ?? down;
      return down;
    };
    g.reset(0);
    sampleWindow();
    g.reset(0);
    const afterReset = sampleWindow();
    const secondWindow = sampleWindow();
    g.reset(0);
    sampleWindow();
    g.sample(1 / 60, false, 'high');
    const afterPause = sampleWindow();
    g.sample(NaN, true, 'high');
    sampleWindow();
    const finiteAfterNan = Number.isFinite(g.lastFps) && g.lastFps > 0;
    return { afterReset, secondWindow, afterPause, finiteAfterNan };
  });
  check('nedtrapping krever to nye lave målinger etter scenebytte eller pause', gov.afterReset === null && gov.afterPause === null && gov.secondWindow === 'medium', gov);
  check('ugyldig bildetid forgifter ikke senere FPS-målinger', gov.finiteAfterNan, gov);

  const pipeline = await page.evaluate(() => {
    const { THREE, screenFX } = window.__lib;
    const Post = window.__game.post.constructor;
    const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace;
    const p = new Post(r);
    const budgets = [];
    for (const quality of ['low', 'medium', 'high', 'ultra']) {
      p.setQuality(quality);
      p.setSize(3840, 2160);
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      budgets.push({ quality, pixels: size.x * size.y, budget: p.tier.budget, dpr: r.getPixelRatio() });
      p.setSize(96, 64);
    }
    screenFX.reset();
    p.debug.ao = p.debug.dof = p.debug.grade = false;
    p.setGrade({ exposure: 0.18, bloom: 1, threshold: 0.8, knee: 0.2, ao: 0, dofFar: 0, dofNear: 0, vignette: 0, grain: 0 });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color().setRGB(4, 1, 0.2);
    const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
    const gl = r.getContext();
    const read = () => {
      const pixel = new Uint8Array(4);
      gl.readPixels(48, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel).slice(0, 3);
    };
    const colors = [];
    for (const quality of ['medium', 'high', 'ultra']) {
      p.setQuality(quality);
      p.render(scene, camera, 0);
      colors.push({ quality, rgb: read() });
    }
    p.debug.bloom = false;
    p.render(scene, camera, 0);
    const noBloom = read();
    const spread = Math.max(...[0, 1, 2].map((c) => Math.max(...colors.map((v) => v.rgb[c])) - Math.min(...colors.map((v) => v.rgb[c]))));
    const bloomVisible = colors[1].rgb.some((c, i) => c > noBloom[i] + 8);
    const materials = ['prefilter', 'down', 'up', 'dofDown', 'dofBlur', 'aoBlur', 'comp', 'ssao'];
    const disposed = [];
    for (const key of materials) p[key].addEventListener('dispose', () => disposed.push(key));
    const programsBefore = r.info.programs.length;
    p.dispose();
    const programsAfter = r.info.programs.length;
    const targetsGone = !p.scene && !p.dofA && !p.dofB && !p.aoA && !p.aoB && !p.ssao && p.mips.length === 0;
    r.dispose();
    return { budgets, colors, noBloom, spread, bloomVisible, disposed, programsBefore, programsAfter, targetsGone };
  });
  check('alle kvalitetsnivåer respekterer pikselbudsjettet på 4K', pipeline.budgets.every((b) => b.pixels <= b.budget && b.dpr < 1), pipeline.budgets);
  check('samme HDR-glød har samme lysstyrke på MEDIUM, HIGH og ULTRA', pipeline.spread <= 2 && pipeline.bloomVisible, { colors: pipeline.colors, noBloom: pipeline.noBloom, spread: pipeline.spread });
  check('dispose slipper alle åtte shadermaterialer og rendermål', pipeline.disposed.length === 8 && pipeline.targetsGone && pipeline.programsAfter < pipeline.programsBefore, { disposed: pipeline.disposed, targetsGone: pipeline.targetsGone, programsBefore: pipeline.programsBefore, programsAfter: pipeline.programsAfter });
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('6 kontroller bestått.');
