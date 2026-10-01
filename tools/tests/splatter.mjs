// Over the top-gørr (Tom 2026-10-01):
// 1) Kuttet i to: underkroppen løper rundt, spruter blod fra midjen og etterlater et blodspor på bakken.
// 2) Hodet i skjermen: et vått splatt fra lydbanken når det klasker i glasset, hodet synes mens det henger, tones ut
//    mens det sklir sakte ned (borte etter under tre sekunder), og sporet etter det falmer bort. Sporet er stripete og
//    ujevnt, ikke en jevn stolpe.
// Bruk: node tools/tests/splatter.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
const shot = async (name) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/${name}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  window.__run(0.5);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null; s.queue = []; s.visionDone = true;
  s.camX = 20;
  const h = s.heroes[0].f;
  h.hp = h.maxHp = 9999;
  h.pos.set(18, 0, 0.3);
});

// 1) Kuttet i to: underkroppen løper
const legs = await page.evaluate(() => {
  const g = window.__game, W = window.__lib.W, s = g.scene.stage, h = s.heroes[0].f;
  const o = s.spawnFoe('hogman', 'R');
  o.f.pos.set(h.pos.x + 2.5, 0, 0.3); o.entered = true;
  window.__run(0.1);
  const x0 = o.f.pos.x, decals0 = W.gore.decals.idx;
  o.f.die('bisect', 1, h);
  const running = o.f.headlessT > 0, torsoGone = o.f.rig.detached.has('torso');
  let maxD = 0;
  window.__run(1.6, () => { h.hp = 9999; maxD = Math.max(maxD, Math.abs(o.f.pos.x - x0) + Math.abs(o.f.pos.z - 0.3)); });
  window.__legs = o;
  return { running, torsoGone, moved: +maxD.toFixed(2), splats: W.gore.decals.idx - decals0, stillRunning: o.f.headlessT > 0 };
});
check('kuttet i to: overkroppen flyr, underkroppen løper videre', legs.running && legs.torsoGone, legs);
check('underkroppen løper rundt (minst halvannen meter)', legs.moved > 1.5, legs);
check('og etterlater blod på bakken', legs.splats >= 6, legs);
await shot('s1-legs-running');
const after = await page.evaluate(() => { window.__run(2.5); const o = window.__legs; return { down: o.f.headlessT <= 0, state: o.f.state }; });
check('til slutt faller beina om', after.down, after);

// 2) Hodet i skjermen
const glass = await page.evaluate(() => {
  const g = window.__game, W = window.__lib.W, T = window.__lib.THREE, s = g.scene.stage, h = s.heroes[0].f;
  const fx = g.fx, audio = window.__lib.audio;
  let splats = 0;
  const orig = audio.glassSplat.bind(audio);
  audio.glassSplat = (fam) => { splats++; return orig(fam); };
  const obj = new T.Object3D();
  obj.position.set(s.camX + 1, 1.6, 0);
  W.scene.add(obj);
  fx.hurlAtScreen(obj, h.headImg(), 0.3);
  window.__run(0.35);
  const hit = { onGlass: fx.glass.length, splats };
  return { hit, W: fx.smearCv.width, H: fx.smearCv.height };
});
check('hodet klasker i glasset med et vått splatt', glass.hit.onGlass === 1 && glass.hit.splats === 1, glass);
await shot('s2-head-splat');
// Bare sporet skal måles: tøm spruten fra treffet (rennene fra klatten fortsetter)
await page.evaluate(() => { const cv = window.__game.fx.smearCv; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); });

const slide = await page.evaluate(() => {
  const fx = window.__game.fx;
  window.__run(0.6);
  const g0 = fx.glass[0];
  const early = g0 ? +g0.head.toFixed(2) : -1;
  window.__run(1.0);
  const g = fx.glass[0];
  // Midt i sporet: hvor mye av bredden som er dekket, og hvor ujevnt (stripete) det er
  const cv = fx.smearCv, ctx = cv.getContext('2d');
  // Sporet går fra midten av hodet og er 0,42 av hodet bredt (TRAIL_Y og TRAIL_W i gfx/fx.ts)
  const TRAIL_Y = -0.04, TRAIL_W = 0.42;
  const top0 = g.y0 + g.size * TRAIL_Y, top = g.y + g.size * TRAIL_Y;
  const yy = Math.round(top0 + (top - top0) * 0.5);
  const w = Math.round(g.size * TRAIL_W), x0 = Math.round(g.x - w / 2);
  const row = ctx.getImageData(x0, yy, w, 1).data;
  const alphas = [];
  for (let i = 3; i < row.length; i += 4) alphas.push(row[i]);
  const covered = alphas.filter((a) => a > 30);
  const mean = covered.reduce((a, b) => a + b, 0) / Math.max(1, covered.length);
  const sd = Math.sqrt(covered.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, covered.length));
  // Sprang mellom nabopikslene inne i sporet: små for myke striper, store for skarpe søyler med glipper
  let adj = 0, na = 0;
  for (let i = 1; i < alphas.length; i++) if (alphas[i] > 30 || alphas[i - 1] > 30) { adj += Math.abs(alphas[i] - alphas[i - 1]); na++; }
  return { early, mid: +g.head.toFixed(2), slid: Math.round(g.y - g.y0), coverage: +(covered.length / alphas.length).toFixed(2), sd: +sd.toFixed(1), adj: +(adj / Math.max(1, na)).toFixed(1), drips: g.drips.length, blood: +g.blood.toFixed(2) };
});
check('hodet synes mens det henger og begynner å skli', slide.early === 1 && slide.slid > 30, slide);
check('blodsporet dekker sporet etter hodet', slide.coverage > 0.5, slide);
check('og er stripete og ujevnt, men mykt: ikke en jevn stolpe, og ikke skarpe søyler', slide.sd > 10 && slide.adj < 14, slide);
check('blod renner nedover glasset fra klatten og sporet', slide.drips >= 4, slide);
await shot('s3-head-sliding');

const fade = await page.evaluate(() => {
  const fx = window.__game.fx;
  window.__run(1.3);
  const g = fx.glass[0];
  const headLate = g ? +g.head.toFixed(2) : 0;
  return { headLate, done: g ? g.done : true };
});
check('hodet er tonet ut under tre sekunder etter treffet', fade.headLate === 0 && fade.done, fade);
await shot('s4-trail-fading');
const gone = await page.evaluate(() => { window.__run(2.6); return { onGlass: window.__game.fx.headOnGlass }; });
check('og sporet har falmet bort etter fem til seks sekunder', gone.onGlass === false, gone);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: underkroppen løper, og hodet i skjermen klasker, sklir, tones ut og etterlater et ekte spor');
