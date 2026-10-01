// Samarbeidskamera: ekte kameramatriser og figurposisjoner, også ved fremre kant på stående mobil.
// Bruk: node tools/tests/co-op-camera.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const [url = 'http://localhost:4173/', out] = process.argv.slice(2);
if (out) await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(300000);
const logs = [], failed = [];
page.on('pageerror', (e) => logs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push(m.text()); });
const check = (name, ok, detail) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`);
  if (!ok) failed.push(name);
};
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib);
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  window.__cameraTest = {
    setup(twoP, center = 36) {
      const g = window.__game;
      g.input.keys.clear();
      g.twoP = twoP; g.input.solo = !twoP; g.save.heroMade = [true, true];
      g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
      const s = g.scene.stage;
      // En fremtidig tom bølge hindrer sjef/finale uten å endre vanlige bevegelsesregler.
      s.level = { ...s.level, waves: [{ at: s.L + 100, maxAlive: 1, spawns: [] }], riders: [], vorthax: undefined };
      s.waveIdx = 0; s.wave = null; s.queue = []; s.lockX = null; s.visionDone = true; s.introT = 3;
      for (const f of s.foes) f.f.remove();
      s.foes = []; s.hazards = []; s.tippables = [];
      s.camX = center; s.camPull = 0;
      g.camera.position.set(center, 3.6, g.camera.aspect < 1.2 ? 15 : 11.4);
      g.camera.lookAt(center, 1.8, 0);
      g.camera.updateMatrixWorld();
      s.heroes.forEach((h, i) => {
        h.f.pos.set(center - 0.6 + i * 1.2, 0, 2.6);
        h.f.vel.set(0, 0, 0); h.f.hp = h.f.maxHp = 9999;
        h.f.invuln = 999; h.f.onGround = true; h.f.setState('idle');
      });
      return s;
    },
    projected() {
      const g = window.__game, s = g.scene.stage, V = window.__lib.THREE.Vector3;
      g.camera.updateMatrixWorld();
      let worst = 0;
      for (const h of s.heroes) if (h.f.alive) {
        // Begge sider av kroppen, føtter og hode. Bare sentrene ville oversett avkuttede figurer.
        for (const dx of [-0.55, 0.55]) for (const y of [0, 2.8]) {
          const p = new V(h.f.pos.x + dx, h.f.pos.y + y, h.f.pos.z).project(g.camera);
          worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
        }
      }
      return worst;
    },
    run(seconds, keys = []) {
      const g = window.__game, s = g.scene.stage;
      g.input.keys.clear();
      for (const key of keys) g.input.keys.add(key);
      let worst = 0, step = 0, pull = s.camPull;
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        g.tick(1 / 60, false);
        worst = Math.max(worst, this.projected());
        step = Math.max(step, Math.abs(s.camPull - pull));
        pull = s.camPull;
      }
      g.input.keys.clear();
      return { pull, step, worst, camX: s.camX, z: g.camera.position.z, halfW: s.halfW, xs: s.heroes.filter((h) => h.f.alive).map((h) => h.f.pos.x) };
    },
  };
});
await page.addStyleTag({ content: '.announce { display:none!important; }' });

// 1P følger samme bredde og fremovermål som før.
const solo = await page.evaluate(() => {
  const T = window.__cameraTest, g = window.__game, s = T.setup(false);
  s.heroes[0].f.pos.x = 37;
  const expectedHalf = Math.tan(g.camera.fov * Math.PI / 360) * g.camera.position.z * g.camera.aspect * 0.93;
  g.tick(1 / 60, false);
  return { half: s.halfW, expectedHalf, x: s.camX, expectedX: 36 + (38.5 - 36) * 4 / 60, pull: s.camPull, z: g.camera.position.z };
});
check('1P beholder kamerabredde, fremovermål og normalavstand', Math.abs(solo.half - solo.expectedHalf) < 1e-8 && Math.abs(solo.x - solo.expectedX) < 1e-8 && solo.pull === 0 && solo.z === 11.4, solo);

for (const [name, width, height] of [['wide', 1280, 720], ['narrow', 420, 900]]) {
  await page.setViewportSize({ width, height });
  await page.waitForFunction(({ w, h }) => Math.abs(window.__game.camera.aspect - w / h) < 0.01, { w: width, h: height });
  const close = await page.evaluate(() => {
    const T = window.__cameraTest;
    T.setup(true);
    return T.run(2);
  });
  check(`${name}: to helter tett sammen krever ikke uttrekk`, close.pull < 0.05, close);
  const spread = await page.evaluate(() => window.__cameraTest.run(8, ['KeyA', 'ArrowRight']));
  check(`${name}: avstand åpner kameraet mykt og innenfor grensen`, spread.pull > 0.9 && spread.pull <= 1 && spread.step < 0.06, spread);
  check(`${name}: begge hele figurene holder seg i bildet under bevegelse`, spread.worst < 0.99, spread.worst);
  const atLimit = await page.evaluate(() => window.__cameraTest.run(4, ['KeyA', 'ArrowRight']));
  check(`${name}: videre press gir ikke endeløs zoom`, Math.abs(atLimit.z - spread.z) < 0.02 && atLimit.pull <= 1 && atLimit.worst < 0.99, atLimit);
  if (out) {
    await page.evaluate(() => window.__game.tick(1 / 60, true));
    await page.screenshot({ path: `${out}/co-op-camera-${name}.png` });
  }
  const pause = await page.evaluate(() => {
    const g = window.__game, s = g.scene.stage;
    const before = { pull: s.camPull, x: s.camX, z: g.camera.position.z };
    g.paused = true;
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    g.paused = false;
    return { before, after: { pull: s.camPull, x: s.camX, z: g.camera.position.z } };
  });
  check(`${name}: pause fryser kameraets uttrekk`, JSON.stringify(pause.before) === JSON.stringify(pause.after), pause);
  const returned = await page.evaluate(() => {
    const g = window.__game, s = g.scene.stage;
    s.heroes.forEach((h, i) => { h.f.pos.x = s.camX - 0.6 + i * 1.2; h.f.vel.set(0, 0, 0); });
    return window.__cameraTest.run(6);
  });
  check(`${name}: kameraet går tilbake når heltene samles`, returned.pull < 0.02 && returned.worst < 0.99, returned);
}

// Døde helter skal ikke trekke kameraet ut, mens kjempene fortsatt får plass.
const deadAndGiant = await page.evaluate(() => {
  const T = window.__cameraTest, g = window.__game, s = T.setup(true);
  const dead = s.heroes[1];
  dead.lives = 0; dead.f.alive = false; dead.f.hp = 0; dead.f.setState('dead'); dead.f.pos.x = -500;
  const deadPull = T.run(2).pull;
  const giant = s.spawnFoe('bigtroll', 'R');
  giant.f.pos.set(s.heroes[0].f.pos.x + 1.5, 0, -1);
  giant.update = () => {}; giant.f.wantVX = giant.f.wantVZ = 0;
  const giantPull = T.run(4).pull;
  giant.f.remove(); s.foes = [];
  const afterGiant = T.run(6).pull;
  return { deadPull, giantPull, afterGiant };
});
check('død spiller langt unna påvirker ikke utsnittet', deadAndGiant.deadPull < 0.01, deadAndGiant);
check('kjempeuttrekket beholdes også med død medspiller', deadAndGiant.giantPull > 0.95, deadAndGiant);
check('kameraet vender tilbake når kjempen er borte', deadAndGiant.afterGiant < 0.01, deadAndGiant);

const limits = await page.evaluate(() => {
  const T = window.__cameraTest, g = window.__game;
  let s = T.setup(true, 36);
  s.lockX = 36;
  const locked = T.run(5, ['KeyD', 'ArrowRight']);
  s = T.setup(true, 116);
  const end = T.run(5, ['KeyD', 'ArrowRight']);
  const endLimit = s.L;
  s = T.setup(true, 0);
  const start = T.run(5, ['KeyA', 'ArrowLeft']);
  return { locked, end, start, endLimit };
});
check('bølgelås gjelder også for to spillere', limits.locked.camX <= 36.001 && limits.locked.worst < 0.99, limits.locked);
check('heltene og kameramålet holder seg innenfor brettslutten', Math.max(...limits.end.xs) <= limits.endLimit - 0.9 && limits.end.camX <= limits.endLimit - limits.end.halfW + 1.05 && limits.end.worst < 0.99, limits.end);
check('kameraet rygger ikke forbi brettstart', limits.start.camX >= -1.001 && Math.min(...limits.start.xs) >= -8 && limits.start.worst < 0.99, limits.start);

if (logs.length) console.error(logs.join('\n'));
console.log(failed.length ? `FEIL: ${failed.length}` : 'OK: samarbeidskamera og kjempeuttrekk');
process.exitCode = failed.length || logs.length ? 1 : 0;
await browser.close();
