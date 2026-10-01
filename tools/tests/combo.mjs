// Runde E, grenser for evige komboer og forsvar (game/combo.ts, game/foes.ts, game/grab.ts):
// - etter sju treff i lufta slås fienden i bakken (SPIKED!) og blir liggende,
// - kropper spretter mot kanten av bildet under en bølge, høyst tre ganger,
// - en kropp som er slått avgårde, skader fienden den treffer,
// - eliter og sjefer blokkerer etter fire like slag på rad, en hel kombo leses ikke, og løpeslaget bryter guarden,
// - fiender går til side for prosjektiler fra heltene,
// - en fiende som holdes, river seg løs etter 1,5 sekunder uten kne.
// Bruk: node tools/tests/combo.mjs http://localhost:4173/
import { chromium } from 'playwright';
const [url] = process.argv.slice(2);
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
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  window.__run(1);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.visionDone = true;
  window.__reset = (x, lock = false) => {
    const s = window.__game.scene.stage, h = s.heroes[0].f;
    for (const f of s.foes) { f.f.alive && f.f.die('normal', 1, null); f.f.rig.root.visible = false; f.f.removeMe = true; }
    window.__run(2 / 60);
    h.hp = h.maxHp = 9999; h.pos.set(x, 0, 0); h.vel.set(0, 0, 0); h.state = 'idle'; h.facing = 1; h.atk = null;
    s.camX = x; window.__game.camera.position.x = x;
    s.lockX = lock ? x : null;
  };
  window.__spawn = (id, x, z = 0) => {
    const s = window.__game.scene.stage;
    const o = s.spawnFoe(id, 'R');
    o.f.pos.set(x, 0, z); o.entered = true; o.cd = 99; o.projCd = 99;
    return o;
  };
});

// 1) Sjonglering: sju treff i lufta, så slås han i bakken
const juggle = await page.evaluate(() => {
  const s = window.__game.scene.stage, L = window.__lib, hero = s.heroes[0], h = hero.f;
  window.__reset(20);
  const o = window.__spawn('hogman', 22), f = o.f;
  f.hp = f.maxHp = 999;
  h.atk = L.HERO_ATK.jump;
  let spiked = -1, vy = 0;
  for (let i = 1; i <= 8 && spiked < 0; i++) {
    f.pos.y = 2; f.onGround = false; f.state = 'down';
    L.applyHit(h, f, L.HERO_ATK.jump);
    f.pos.y = 2; f.onGround = false;
    s.onFoeHit(hero, f, false);
    if (f.data.spiked) { spiked = i; vy = f.vel.y; }
  }
  window.__run(1.0);
  return { spiked, vy: +vy.toFixed(1), down: f.state, onGround: f.onGround, after: !!f.data.spiked };
});
check('etter sju treff i lufta slås fienden i bakken', juggle.spiked === 7 && juggle.vy < -10, juggle);
check('han blir liggende, og smellet er ferdig', juggle.down === 'down' && juggle.onGround && !juggle.after, juggle);

// 2) Kanten av bildet under en bølge: kroppen spretter tilbake, høyst tre ganger
const wall = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f;
  window.__reset(40, true);
  const o = window.__spawn('skeleton', s.camX + s.halfW - 1.5), f = o.f;
  f.hp = f.maxHp = 999;
  f.lastHitBy = h;
  f.knockdown(14, 6);
  let flips = 0, last = Math.sign(f.vel.x), bounces = 0;
  window.__run(1.2, () => {
    const sg = Math.sign(f.vel.x);
    if (sg && sg !== last) { flips++; last = sg; }
    bounces = Math.max(bounces, f.data.bounces ?? 0);
  });
  const one = { flips, bounces };
  // Mange sprett på rad: aldri flere enn tre
  f.data.bounces = 0; f.knockdown(14, 2);
  let max = 0;
  for (let i = 0; i < 6; i++) {
    f.pos.x = s.camX + s.halfW - 0.5; f.pos.y = 1; f.onGround = false; f.state = 'down'; f.vel.x = 12; f.vel.y = 1;
    window.__run(3 / 60);
    max = Math.max(max, f.data.bounces ?? 0);
  }
  return { ...one, max };
});
check('en kropp spretter tilbake fra kanten av bildet', wall.flips >= 1 && wall.bounces >= 1, wall);
check('høyst tre sprett i én flytur', wall.max === 3, wall);

// 3) En kropp som er slått avgårde, treffer en annen fiende
const body = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f;
  window.__reset(60);
  const a = window.__spawn('skeleton', 61), b = window.__spawn('skeleton', 63.6);
  a.f.hp = a.f.maxHp = 999; b.f.hp = b.f.maxHp = 999;
  // B står stille (ingen AI), så det er flyturen som måles
  b.f.frozen = true;
  a.f.lastHitBy = h;
  a.f.knockdown(12, 4);
  const hp0 = b.f.hp;
  let hit = false;
  window.__run(0.8, () => { if (b.f.hp < hp0) hit = true; });
  return { hit, state: b.f.state, dmg: hp0 - b.f.hp };
});
check('en kropp som flyr, skader fienden den treffer', body.hit && body.dmg > 0, body);

// 4) Eliter leser helten: fire like slag på rad, og han blokkerer. En hel kombo leses ikke. Løpeslaget bryter guarden
const read = await page.evaluate(() => {
  const s = window.__game.scene.stage, L = window.__lib, hero = s.heroes[0], h = hero.f;
  const swing = (o, atk) => {
    h.atk = atk;
    o.f.hp = o.f.maxHp = 999; o.f.state = 'idle';
    s.onFoeHit(hero, o.f, false);
    window.__run(0.2);
  };
  window.__reset(80);
  const o = window.__spawn('hogguard', 81.5);
  // En hel kombo, to ganger: ingen blokk
  for (const k of ['slash1', 'slash2', 'chop', 'slash1', 'slash2', 'chop']) swing(o, L.HERO_ATK[k]);
  const combo = o.blockT;
  // Det samme slaget fire ganger
  for (let i = 0; i < 4; i++) swing(o, L.HERO_ATK.slash1);
  const state = o.f.state, blockT = +o.blockT.toFixed(2);
  h.pos.set(o.f.pos.x - 1.2, 0, o.f.pos.z); h.facing = 1;
  const front = L.applyHit(h, o.f, L.HERO_ATK.slash1);
  const dash = L.applyHit(h, o.f, L.HERO_ATK.dash);
  return { combo, state, blockT, blocked: front.blocked, broken: dash.guardBreak, after: o.f.state };
});
check('en hel kombo leses ikke', read.combo === 0, read);
check('fire like slag på rad: eliten blokkerer, og slag forfra preller av', read.state === 'block' && read.blockT > 0.5 && read.blocked, read);
check('løpeslaget bryter guarden', read.broken && read.after === 'stunned', read);

const bossRead = await page.evaluate(() => {
  const g = window.__game, L = window.__lib;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  window.__run(1);
  const s = g.scene.stage, hero = s.heroes[0], h = hero.f;
  for (const f of s.foes) if (f.f.alive) f.f.die('normal', 1, null);
  s.waveIdx = s.level.waves.length; s.wave = null; s.lockX = null; s.visionDone = true;
  h.hp = h.maxHp = 9999;
  s.camX = s.bossLock; g.camera.position.x = s.camX; h.pos.set(s.bossLock - 2, 0, 0);
  window.__run(0.2);
  const b = s.boss;
  b.mode = 'think'; b.thinkT = 99; b.f.pos.set(s.bossLock + 1, 0, 0);
  for (let i = 0; i < 4; i++) { h.atk = L.HERO_ATK.slash1; s.onFoeHit(hero, b.f, false); b.thinkT = 99; window.__run(0.15); }
  const mode = b.mode, state = b.f.state;
  h.pos.set(b.f.pos.x - 1.4, 0, b.f.pos.z); h.facing = 1;
  const r = L.applyHit(h, b.f, L.HERO_ATK.chop);
  window.__run(1.5);
  return { mode, state, blocked: r.blocked, later: b.mode };
});
check('sjefen leser helten også og blokkerer, og så slår han tilbake', bossRead.mode === 'block' && bossRead.state === 'block' && bossRead.blocked && bossRead.later !== 'block', bossRead);

// 5) Fiender går til side for prosjektiler fra heltene
const dodge = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  s.boss?.f.remove(); s.boss = null;
  let dodged = 0, hit = 0;
  for (let i = 0; i < 10; i++) {
    window.__reset(30 + i * 0.01);
    const o = window.__spawn('skeleton', 34, 0);
    o.f.hp = o.f.maxHp = 999;
    window.__run(1.6);
    o.f.pos.set(34, 0, 0); o.f.state = 'idle';
    const hp0 = o.f.hp;
    s.proj.spawn({ kind: 'fireball', owner: h, x: 31, y: 1.2, z: 0, vx: 9, dmg: 10, life: 2 });
    window.__run(0.6);
    if (Math.abs(o.f.pos.z) > 0.5) dodged++;
    if (o.f.hp < hp0) hit++;
  }
  return { dodged, hit };
});
check('fiender går til side for prosjektiler (omtrent seks av ti)', dodge.dodged >= 3 && dodge.hit <= 10 - dodge.dodged, dodge);

// 6) Grepet: uten kne river han seg løs etter 1,5 sekunder, med kne holder grepet
const hold = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, hero = s.heroes[0], h = hero.f, L = window.__lib;
  const run = (knee) => {
    window.__reset(50);
    const o = window.__spawn('skeleton', 51), f = o.f;
    f.hp = f.maxHp = 999;
    h.face(1);
    s.tryGrab(hero);
    const held0 = f.state === 'held';
    let freeAt = -1;
    window.__run(3, (i) => {
      if (knee && i === 60) g.input.tapped.add('KeyJ');
      if (freeAt < 0 && f.state !== 'held') freeAt = i / 60;
    });
    return { held0, freeAt: +freeAt.toFixed(2), heroState: h.state };
  };
  return { quiet: run(false), knee: run(true) };
});
check('uten kne river fienden seg løs etter halvannet sekund', hold.quiet.held0 && hold.quiet.freeAt > 1.4 && hold.quiet.freeAt < 1.7, hold);
check('et kne holder grepet lenger', hold.knee.held0 && (hold.knee.freeAt < 0 || hold.knee.freeAt > 1.8), hold);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: grenser for komboer og forsvar virker');
