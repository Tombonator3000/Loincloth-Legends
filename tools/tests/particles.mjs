// Partiklene synes på skjermen (Tom 2026-09-30: "når en kroppsdel kuttes av må det sprute blod").
// Fram til 30.09 var alle blodråper i lufta og gnistene usynlige: strekkgrenen i GLOW_VERT (gfx/vfx.ts) speilvendte
// firkanten, og skjermkortet tegner ikke baksider. Sjokkbølgene på bakken lå med forsida ned. Testene som telte
// partikler merket ingenting, så denne teller piksler: dråper, gnister og en ring i farger som ellers ikke finnes på
// brett 1 (magenta, cyan og ren grønn), og en arm som ryker (blodet fra skulderen i en egen farge).
// Bruk: node tools/tests/particles.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.evaluate(() => {
  const g = window.__game;
  g.twoP = false;
  g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
  const s = g.scene.stage;
  s.waveIdx = 99; s.wave = null; s.queue = [];
  for (const f of s.foes) f.f.remove?.();
  s.foes = [];
});

// Teller piksler i en farge i hele bildet (hver andre piksel i hver retning)
const count = async (name, test) => {
  const buf = await page.screenshot({ path: out ? `${out}/particles-${name}.png` : undefined });
  return page.evaluate(async ({ b64, test }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    const fn = new Function('r', 'g', 'b', 'return ' + test);
    let n = 0;
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) {
      const i = (y * cv.width + x) * 4;
      if (fn(d[i], d[i + 1], d[i + 2])) n++;
    }
    return n;
  }, { b64: buf.toString('base64'), test });
};
const MAGENTA = 'r > 150 && b > 150 && g < 100';
const CYAN = 'g > 170 && b > 170 && r < 140';
const GREEN = 'g > 170 && r < 110 && b < 110';

// Utgangspunktet: ingen av fargene finnes i bildet
await page.evaluate(() => window.__game.tick(1 / 60, true));
const base = { magenta: await count('base', MAGENTA), cyan: await count('base', CYAN), green: await count('base', GREEN) };
check('brett 1 har ingen magenta, cyan eller ren grønn fra før', base.magenta < 20 && base.cyan < 20 && base.green < 20, base);

// 1) Blodråper i fart (de strekkes alltid) i magenta
await page.evaluate(() => {
  const g = window.__game, W = window.__lib.W, s = g.scene.stage;
  W.gore.clear();
  g.tick(1 / 60, false); // clear() dreper alt som er født før neste bilde
  for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) {
    W.gore.drops.emit(s.camX - 5 + i * 0.8, 1.2 + j * 0.45, 0.4, 3.5, 2.5, 0, 0.14, 1, 0, 1, 2, 0.4, false);
  }
  g.tick(1 / 60, false);
  g.tick(1 / 60, true);
});
const drops = await count('drops', MAGENTA);
check('blodråper i fart synes (strukket i fartsretningen)', drops > 300, { drops });

// 2) Gnister (strukne glødpartikler) i cyan
await page.evaluate(() => {
  const g = window.__game, W = window.__lib.W, s = g.scene.stage;
  W.gore.clear();
  g.tick(1 / 60, false);
  const glow = W.gore.vfx.glow;
  for (let i = 0; i < 40; i++) {
    glow.emit(s.camX - 4 + (i % 10) * 0.8, 1.4 + Math.floor(i / 10) * 0.4, 0.4, 5, 2, 0, 0, -6, 0, 1.2, 0, 0.09, 0.07, 0.04, 0, 3, 3, 1, 0, 2, 2, 0);
  }
  g.tick(1 / 60, false);
  g.tick(1 / 60, true);
});
const sparks = await count('sparks', CYAN);
check('gnister synes', sparks > 80, { sparks });

// 3) Sjokkbølge langs bakken i ren grønn
await page.evaluate(() => {
  const g = window.__game, W = window.__lib.W, s = g.scene.stage;
  W.gore.clear();
  g.tick(1 / 60, false);
  W.gore.vfx.shockwave(new window.__lib.THREE.Vector3(s.camX, 0.05, 0.5), 2.2, '#00ff00', 0.8);
  for (let i = 0; i < 9; i++) g.tick(1 / 60, false);
  g.tick(1 / 60, true);
});
const ring = await count('ring', GREEN);
check('sjokkbølgen synes på bakken', ring > 50, { ring });

// 4) En arm ryker: blodet fra skulderen (magenta i stedet for rødt, så det kan telles)
await page.evaluate(() => {
  const g = window.__game, W = window.__lib.W, s = g.scene.stage;
  W.gore.clear();
  s.spawnFoe('hogman', 'R');
  const foe = s.foes[s.foes.length - 1];
  foe.f.pos.set(s.camX + 1, 0, 0.3); foe.f.facing = -1; foe.cd = 99;
  for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
  const bc = W.gore.bloodColor;
  W.gore.bloodColor = function () { return this.col.setRGB(1, 0, 1); };
  foe.f.loseArm(-1);
  for (let i = 0; i < 12; i++) g.tick(1 / 60, false);
  g.tick(1 / 60, true);
  W.gore.bloodColor = bc;
});
const arm = await count('arm', MAGENTA);
check('blodet spruter når en arm ryker', arm > 150, { arm });

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: blod, gnister og sjokkbølger synes');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
