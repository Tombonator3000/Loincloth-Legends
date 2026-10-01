// Atmosfære: avgrenset løvpool, pause, kamerahopp og synlige nye GPU-former.
// Bruk Vite DEV (modulimportene under skal være tilgjengelige):
// npm run dev -- --host 127.0.0.1 --port 4173
// node tools/tests/atmosphere.mjs http://127.0.0.1:4173/
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /shader|WebGL|THREE/i.test(m.text())) errors.push(m.text());
});

// Ikke start spillet: et tomt dokument på samme Vite-opphav holder for modulene og WebGL.
await page.route('**/atmosphere-test.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Atmosphere regression</title>' }));
await page.goto(new URL('atmosphere-test.html', url).href);
const checks = await page.evaluate(async () => {
  const { VFX, K } = await import('/src/gfx/vfx.ts');
  const { LeafFall } = await import('/src/gfx/env/leaffall.ts');
  const { fogLayers, godRays } = await import('/src/gfx/env/atmos.ts');
  const { withSeed } = await import('/src/core/math.ts');
  const { gfxState } = await import('/src/gfx/post.ts');
  const { wind } = await import('/src/gfx/wind.ts');
  // Vite bruker denne samme modul-ID-en i prosjektmodulene, så scene og materialer deler Three-instansen.
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const result = [];
  const check = (name, ok, detail) => result.push({ name, ok, detail });

  gfxState.quality = 'high';
  wind.set(0.7, 1, 0.2);
  const leaves = withSeed(3456, () => new LeafFall({ palette: ['#ab8833', '#75481c'], area: [20, 25, -8, 5] }));
  const allocated = new Set(leaves.free);
  leaves.update(1 / 60, 0);
  check('løv finnes allerede ved ankomst', leaves.mesh.count > 10 && leaves.mesh.count < leaves.max, leaves.mesh.count);
  for (let i = 0; i < 3600; i++) leaves.update(1 / 60, 0);
  const all = [...leaves.leaves, ...leaves.free];
  check('ett minutt gir samme faste pool, uten nye partikkelobjekter', all.length === leaves.max && new Set(all).size === leaves.max && all.every((l) => allocated.has(l)), { active: leaves.leaves.length, free: leaves.free.length, max: leaves.max });
  check('full pool samler ikke opp utslipp', leaves.acc >= 0 && leaves.acc < 1, leaves.acc);
  const before = Array.from(leaves.mesh.instanceMatrix.array);
  const accumulator = leaves.acc;
  leaves.update(0, 80);
  check('pause flytter eller slipper ikke ut løv', leaves.acc === accumulator && before.every((v, i) => v === leaves.mesh.instanceMatrix.array[i]));
  leaves.update(1 / 60, 80);
  check('kamerahopp fyller nytt område uten full partikkelbyge', leaves.mesh.count > 10 && leaves.mesh.count < leaves.max * 0.6 && leaves.leaves.every((l) => Math.abs(l.p.x - 80) < 18), leaves.mesh.count);

  // Kvalitetsreduksjonen må ikke permanent velge bort den ene av to vekslende kilder.
  gfxState.quality = 'low';
  const quota = new VFX();
  for (let i = 0; i < 100; i++) {
    quota.ambient(0, 2, 0, 0, 0.1, '#ccff88', 0.1, 4, true);
    quota.ambient(0, 2, 0, 0, -1, '#ffffff', 0.1, 4, false);
  }
  const glows = quota.glow.mesh.geometry.getAttribute('aT');
  const smoke = quota.smoke.mesh.geometry.getAttribute('aT');
  const count = (attr) => Array.from({ length: attr.count }, (_, i) => attr.getX(i)).filter((x) => x > -1e8).length;
  const liveGlow = count(glows), liveSnow = count(smoke);
  check('LOW beholder begge vekslende stemningskilder', liveGlow >= 40 && liveGlow <= 60 && liveSnow >= 40 && liveSnow <= 60, { liveGlow, liveSnow });

  gfxState.quality = 'high';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(320, 192);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 1);
  const target = new THREE.WebGLRenderTarget(320, 192);
  renderer.setRenderTarget(target);
  const camera = new THREE.PerspectiveCamera(42, 320 / 192, 0.1, 100);
  camera.position.set(0, 3, 10);
  camera.lookAt(0, 1.5, 0);
  const scene = new THREE.Scene();
  const vfx = new VFX();
  scene.add(vfx.group);
  const pixels = new Uint8Array(320 * 192 * 4);
  const render = () => {
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, 320, 192, pixels);
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 45) lit++;
    return lit;
  };
  check('negativ pikselkontroll er mørk', render() === 0);
  for (const [name, kind, pool] of [['ildfluer', K.MOTE, vfx.glow], ['snøflak', K.FLAKE, vfx.smoke], ['treffkjerne', K.IMPACT, vfx.glow]]) {
    vfx.clear();
    vfx.update(0.02, 0);
    pool.emit(0, 1.5, 0, 0.15, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 2, 2, 2, kind, 1, 1, 1, 0);
    vfx.update(0.15, 0);
    const lit = render();
    check(`${name} har synlige piksler og gyldig shader`, lit > 40, lit);
    const frozen = new Uint8Array(pixels);
    vfx.update(0, 0);
    render();
    check(`${name} står stille ved pause`, frozen.every((v, i) => v === pixels[i]));
  }
  scene.remove(vfx.group);
  scene.fog = new THREE.FogExp2('#222222', 0.01);
  const air = new THREE.Group();
  scene.add(air);
  const fogStep = fogLayers(air, 10, '#aabcbb', [{ z: -3, h: 6, opacity: 0.45 }]);
  const raysStep = godRays(air, [0], -2, '#ffe4b0', -0.3, 7, 2.5, 0.35);
  fogStep(0.2);
  raysStep(0.2);
  check('dis og lysstråler kompilerer og tegnes', render() > 200);
  const fog = air.getObjectByName('atmosphere-mist');
  const rays = air.getObjectByName('atmosphere-ray');
  const offset = fog.material.map.offset.x;
  const opacity = rays.material.opacity;
  fogStep(0);
  raysStep(0);
  check('dis og lysstråler følger pausen', offset === fog.material.map.offset.x && opacity === rays.material.opacity);
  wind.set(0.8, -1, 0);
  fogStep(0.5);
  check('dis følger også vind mot venstre', fog.material.map.offset.x > offset);
  // Både LOW og HIGH må kompilere: LOW utelater den ekstra teksturprøven.
  gfxState.quality = 'low';
  scene.remove(air);
  const lowAir = new THREE.Group();
  scene.add(lowAir);
  fogLayers(lowAir, 10, '#aabcbb', [{ z: -3, h: 6, opacity: 0.45 }, { z: -4, h: 7, opacity: 0.3 }]);
  check('LOW har færre dislag og gyldig shader', lowAir.children.length === 1 && render() > 200, lowAir.children.length);
  target.dispose();
  renderer.dispose();
  return result;
});
for (const c of checks) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}${c.detail === undefined ? '' : ' ' + JSON.stringify(c.detail)}`);
if (errors.length) console.error(errors.join('\n'));
process.exitCode = checks.some((c) => !c.ok) || errors.length ? 1 : 0;
await browser.close();
