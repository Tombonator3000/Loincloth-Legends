// Tøffe fiender må vakle før de kan gripes (FoeDef.guard, offBalance i game/grab.ts): et skjelett gripes når helten
// går inn i det, en hoggmann skyver helten unna, men etter et treff kan han gripes en kort stund, og med lite liv
// igjen kan han gripes uten videre. Etter at han har hentet seg inn, står han imot igjen.
// Bruk: node tools/tests/guard.mjs http://localhost:4173/ [./shots]
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

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null;
  window.__reset = (x) => {
    const s = window.__game.scene.stage, h = s.heroes[0].f;
    for (const f of s.foes) { f.f.alive && f.f.die('normal', 1, null); f.f.rig.root.visible = false; f.f.removeMe = true; }
    for (let i = 0; i < 2; i++) window.__game.tick(1 / 60, false);
    h.hp = h.maxHp = 9999; h.pos.set(x, 0, 0); h.state = 'idle'; h.face(1); h.holding = null; h.running = false;
    // Pausen etter at en tøff fiende skjøv helten unna (grabPause, 1,1 sekund) skal ikke henge igjen inn i neste steg.
    // Var det mer enn 0,42 sekunder igjen av den, gikk helten forbi fienden i steg 5 uten å gripe
    s.heroes[0].grabCd = 0;
    s.camX = x; window.__game.camera.position.x = x;
    // Litt tid uten taster, ellers blir neste trykk på D et dobbelttrykk og helten løper (løpende helter griper ikke)
    for (let i = 0; i < 30; i++) { window.__game.tick(1 / 60, false); h.pos.set(x, 0, 0); }
  };
  window.__hold = (keys, n, each) => {
    const g = window.__game;
    for (let i = 0; i < n; i++) { for (const k of keys) g.input.keys.add(k); each?.(i); g.tick(1 / 60, false); }
    for (const k of keys) g.input.keys.delete(k);
  };
  // En fiende som står stille foran helten (ingen angrep)
  window.__foe = (id, x) => {
    const s = window.__game.scene.stage;
    const k = s.spawnFoe(id, 'R');
    k.f.pos.set(x, 0, 0); k.cd = 99; k.projCd = 99; k.grabCd = 99;
    k.f.face(-1);
    return k;
  };
  window.__texts = () => [...document.querySelectorAll('.fx-text, .word, .speech')].map((e) => e.textContent);
});

// 1) Skjelettet (ikke tøft) gripes når helten går inn i det
const skel = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f;
  window.__reset(20);
  const k = window.__foe('skeleton', 21.8);
  let grabbed = false;
  window.__hold(['KeyD'], 60, () => { grabbed = grabbed || h.state === 'hold'; });
  return { grabbed, guard: k.f.guard };
});
check('skjelettet gripes som før', skel.grabbed && !skel.guard, skel);

// 2) Hoggmannen står imot: helten blir skjøvet unna og holder ham ikke
const resist = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f;
  window.__reset(30);
  const k = window.__foe('hogman', 31.6);
  let grabbed = false, pushed = false;
  window.__hold(['KeyD'], 50, () => {
    grabbed = grabbed || h.state === 'hold';
    pushed = pushed || h.state === 'hurt';
  });
  return { grabbed, pushed, guard: k.f.guard, hp: k.f.hp, maxHp: k.f.maxHp, heroHp: h.hp };
});
check('hoggmannen er tøff (guard)', resist.guard, resist);
check('hoggmannen kan ikke gripes før han vakler, og helten blir skjøvet unna uten skade', !resist.grabbed && resist.pushed && resist.heroHp === 9999, resist);

// 3) Etter et treff vakler han, og da kan helten gripe ham ved å gå inn i ham
const hit = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(40);
  const k = window.__foe('hogman', 41.5);
  // Ett slag
  g.input.tapped.add('KeyF');
  window.__hold([], 14);
  const after = { foeState: k.f.state, stagger: +k.f.staggerT.toFixed(2), hp: k.f.hp };
  let grabbed = false, t = -1;
  window.__hold(['KeyD'], 40, (i) => { if (!grabbed && h.state === 'hold') { grabbed = true; t = i; } });
  return { after, grabbed, t: +(t / 60).toFixed(2), foe: k.f.state };
});
check('et treff får hoggmannen til å vakle', hit.after.stagger > 0 && hit.after.hp < 70, hit.after);
check('mens han vakler, gripes han ved å gå inn i ham', hit.grabbed && hit.foe === 'held', hit);

// 4) Når han har hentet seg inn, står han imot igjen
const recovered = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(50);
  const k = window.__foe('hogman', 51.6);
  k.f.hurt(0.2, 0);
  window.__hold([], 90);
  const stagger = k.f.staggerT;
  let grabbed = false;
  window.__hold(['KeyD'], 40, () => { grabbed = grabbed || h.state === 'hold'; });
  return { stagger, grabbed };
});
check('etter at han har hentet seg inn, står han imot igjen', recovered.stagger === 0 && !recovered.grabbed, recovered);

// 5) Med under en tredjedel av livet igjen orker han ikke stå imot
const weak = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f;
  window.__reset(60);
  const k = window.__foe('hogman', 61.6);
  k.f.hp = k.f.maxHp * 0.3;
  let grabbed = false;
  window.__hold(['KeyD'], 40, () => { grabbed = grabbed || h.state === 'hold'; });
  return { grabbed };
});
check('med lite liv kan han gripes uten slag først', weak.grabbed, weak);

// 6) Grip-tasten (R) følger samme regel
const key = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(70);
  const k = window.__foe('hogguard', 71.0);
  g.input.tapped.add('KeyR');
  window.__hold([], 6);
  return { holding: !!h.holding, guard: k.f.guard };
});
check('vakten (hogguard) står også imot grip-tasten', key.guard && !key.holding, key);

if (out) {
  await page.evaluate(() => {
    const s = window.__game.scene.stage;
    window.__reset(80);
    window.__foe('hogman', 81.6);
    window.__hold(['KeyD'], 12);
    window.__game.tick(1 / 60, true);
  });
  await page.screenshot({ path: `${out}/guard-resist.png` });
}
if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: tøffe fiender må vakle før de kan gripes');
await browser.close();
process.exit(fails.length ? 1 : 0);
