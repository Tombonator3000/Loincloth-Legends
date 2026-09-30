// Spillet i frostpasset etter konseptbilde 4: fiender som rygger unna tas igjen og holdes i bildet, panikk,
// kast bakover over taugjerdet og ned i juvet (heltene stopper ved kanten), istapper som faller, fyrfat som
// veltes med glør som setter fyr på fiender, og kjempetrollet som griper og kaster en helt.
// Bruk: node tools/tests/frostplay.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + info : ''));
  if (!ok) fails.push(name);
};
const shot = async (n) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/frostplay-${n}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'frost', name: 'frost', kind: 'level', level: 'frost', biome: 'frost', pos: [0, 0], requires: [], blurb: '' });
  for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null;
  // Hjelpere: rydd fiender og flytt helten og kameraet
  window.__reset = (x) => {
    const s = window.__game.scene.stage, h = s.heroes[0].f;
    for (const f of s.foes) { f.f.alive && f.f.die('normal', 1, null); f.f.rig.root.visible = false; f.f.removeMe = true; }
    for (let i = 0; i < 2; i++) window.__game.tick(1 / 60, false);
    h.hp = h.maxHp = 9999; h.pos.set(x, 0, 0); h.state = 'idle'; h.burnT = 0;
    s.camX = x; window.__game.camera.position.x = x;
    s.icicles.t = 999;
  };
});

// 1) En kultist som rygger unna, tas igjen og holdes i bildet
const chase = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(12);
  const c = s.spawnFoe('cultist', 'R');
  c.f.pos.set(15, 0, 0);
  c.projCd = 99;
  let closest = 99, outside = 0;
  for (let i = 0; i < 60 * 6; i++) {
    g.input.keys.add('KeyD');
    h.pos.z += (c.f.pos.z - h.pos.z) * 0.1;
    g.tick(1 / 60, false);
    closest = Math.min(closest, Math.abs(c.f.pos.x - h.pos.x));
    if (c.entered && (c.f.pos.x > s.camX + s.halfW || c.f.pos.x < s.camX - s.halfW)) outside++;
  }
  g.input.keys.delete('KeyD');
  return { closest: +closest.toFixed(2), outside, halfW: +s.halfW.toFixed(2) };
});
check('helten tar igjen en fiende som rygger', chase.closest < 1.6, JSON.stringify(chase));
check('fienden blir i bildet', chase.outside === 0, JSON.stringify(chase));

// 2) Panikk: løper vekk med armene i været, saktere enn helten, og roer seg
const panic = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(20);
  const k = s.spawnFoe('skeleton', 'R');
  k.f.pos.set(22, 0, 0.5);
  for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
  k.panicCd = 0;
  const started = k.panic(2.5);
  let maxSpeed = 0, state = '', arms = false;
  for (let i = 0; i < 60; i++) {
    g.tick(1 / 60, false);
    maxSpeed = Math.max(maxSpeed, Math.abs(k.f.vel.x));
    state = k.f.state;
    arms = arms || k.f.panicking;
  }
  const away = Math.abs(k.f.pos.x - h.pos.x);
  for (let i = 0; i < 60 * 2.5; i++) g.tick(1 / 60, false);
  return { started, state, arms, maxSpeed: +maxSpeed.toFixed(2), away: +away.toFixed(2), after: k.f.panicking, heroSpeed: h.speed };
});
check('panikk: løper i panikk', panic.started && panic.state === 'flee' && panic.arms, JSON.stringify(panic));
check('panikk: saktere enn helten går', panic.maxSpeed < panic.heroSpeed, JSON.stringify(panic));
check('panikk: roer seg etterpå', panic.after === false, JSON.stringify(panic));
await shot('panic');

// 3) Juvet: kast opp over gjerdet, og helten stopper ved kanten
const gorge = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  const hz = s.hazards.find((x) => x.def.kind === 'chasm');
  window.__reset(hz.def.x - 2);
  const k = s.spawnFoe('frostskel', 'R');
  k.f.pos.set(hz.def.x - 1.1, 0, -0.9);
  k.f.state = 'idle';
  h.pos.set(hz.def.x - 2, 0, -0.9); h.face(1);
  for (let i = 0; i < 2; i++) g.tick(1 / 60, false);
  k.f.pos.set(h.pos.x + 0.9, 0, -0.9);
  const grabbed = s.tryGrab(s.heroes[0]);
  g.input.keys.add('KeyW');
  g.tick(1 / 60, false);
  g.input.tapped.add('KeyJ');
  for (let i = 0; i < 100; i++) g.tick(1 / 60, false);
  g.input.keys.delete('KeyW');
  const fell = { alive: k.f.alive, env: k.f.envKill, y: +k.f.pos.y.toFixed(2) };
  // Helten går rett mot juvet
  const edge = hz.def.z + hz.def.d / 2;
  for (let i = 0; i < 90; i++) { g.input.keys.add('KeyW'); g.tick(1 / 60, false); }
  g.input.keys.delete('KeyW');
  return { grabbed, fell, heroZ: +h.pos.z.toFixed(2), edge: +edge.toFixed(2), heroAlive: h.alive };
});
check('kast opp: fienden faller i juvet', gorge.grabbed && !gorge.fell.alive && gorge.fell.env === 'THE GORGE' && gorge.fell.y < -0.5, JSON.stringify(gorge));
check('helten stopper ved juvet', gorge.heroZ >= gorge.edge - 0.01 && gorge.heroAlive, JSON.stringify(gorge));
await shot('gorge');

// 4) Istappen faller og treffer den som står under
const ice = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage;
  window.__reset(58);
  const k = s.spawnFoe('troll', 'R');
  k.f.pos.set(61, 0, 0.3);
  k.f.state = 'idle';
  k.cd = 99; k.projCd = 99;
  for (let i = 0; i < 2; i++) g.tick(1 / 60, false);
  const hp0 = k.f.hp;
  s.icicles.drop(k.f.pos.x, k.f.pos.z, 0.6);
  let warned = false;
  for (let i = 0; i < 30; i++) { k.f.wantVX = 0; g.tick(1 / 60, false); warned = warned || s.icicles.list.length > 0; }
  for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
  return { hp0, hp: +k.f.hp.toFixed(1), warned, left: s.icicles.list.length, state: k.f.state };
});
check('istappen varsler, faller og treffer', ice.warned && ice.hp < ice.hp0 && ice.left === 0, JSON.stringify(ice));

// 5) Fyrfatet veltes av et slag, glørne setter fyr på en fiende som får panikk
const fire = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  const tp = s.tippables.find((t) => !t.tipped && t.x > 45 && t.x < 110);
  if (!tp) return { none: true };
  window.__reset(tp.x - 1.1);
  h.pos.set(tp.x - 1.1, 0, -2.4); h.face(1);
  g.input.tapped.add('KeyJ');
  for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
  const tipped = tp.tipped;
  for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
  const embers = s.embers.length;
  const e = s.embers[0];
  const k = s.spawnFoe('skeleton', 'R');
  k.f.pos.set(e ? e.x : tp.x, 0, e ? e.z : -1.5);
  k.panicCd = 0;
  for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
  return { tipped, embers, burn: +k.f.burnT.toFixed(2), panicking: k.f.panicking, spill: e ? [+e.x.toFixed(1), +e.z.toFixed(1)] : null };
});
check('slag velter fyrfatet', fire.tipped === true, JSON.stringify(fire));
check('glør på bakken etter veltingen', fire.embers >= 1, JSON.stringify(fire));
check('glørne setter fyr på en fiende som får panikk', fire.burn > 0 && fire.panicking, JSON.stringify(fire));
await shot('embers');

// 6) Kjempetrollet griper helten, holder ham oppe og kaster ham
const toss = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  window.__reset(70);
  h.hp = h.maxHp = 200;
  const t = s.spawnFoe('bigtroll', 'R');
  t.f.pos.set(72.4, 0, 0);
  t.f.face(-1);
  for (let i = 0; i < 2; i++) g.tick(1 / 60, false);
  h.pos.set(70, 0, 0);
  t.cd = 99;
  t.f.startAttack(t.def.grab);
  let held = false, heldY = 0;
  for (let i = 0; i < 50; i++) {
    g.tick(1 / 60, false);
    if (h.state === 'held') { held = true; heldY = Math.max(heldY, h.pos.y); }
  }
  let thrown = false, maxVx = 0, hp = h.hp;
  for (let i = 0; i < 90; i++) {
    g.tick(1 / 60, false);
    if (h.state === 'down') thrown = true;
    maxVx = Math.max(maxVx, Math.abs(h.vel.x));
  }
  return { held, heldY: +heldY.toFixed(2), thrown, maxVx: +maxVx.toFixed(1), hp0: 200, hp: +h.hp.toFixed(1), trollState: t.f.state };
});
check('kjempen griper og løfter helten', toss.held && toss.heldY > 1.5, JSON.stringify(toss));
check('kjempen kaster helten langt', toss.thrown && toss.maxVx > 8 && toss.hp < toss.hp0, JSON.stringify(toss));
await shot('toss');

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: alt det nye i frostpasset virker');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
