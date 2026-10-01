// Sjefer i faser (runde E, data/bosses.ts og game/boss.ts): fasene begynner ved 66 og 33 prosent, store trekk gir et
// vindu der sjefen er sliten og slagene biter, røde trekk kan ikke avbrytes, Hogmother spiser seg opp om ingen
// avbryter henne, Croakus kommer opp der skyggen er, Magmor legger lava i sporene, og Vorthax lager speilbilder der
// bare den ekte kaster skygge. Solstrålen treffer bare i høyden den går i.
// Bruk: node tools/tests/bossphases.mjs http://localhost:4173/ [./shots]
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
const shot = async (n) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/bossphases-${n}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
  // Til sjefen på et brett: bølgene er over, kameraet står der sjefen kommer, og introen er hoppet over
  window.__toBoss = (id) => {
    const g = window.__game;
    g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
    g.playLevel({ id, name: id, kind: 'level', level: id, biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
    window.__run(1);
    const s = g.scene.stage;
    for (const f of s.foes) if (f.f.alive) f.f.die('normal', 1, null);
    s.waveIdx = s.level.waves.length; s.wave = null; s.lockX = null; s.visionDone = true;
    const h = s.heroes[0].f; h.hp = h.maxHp = 9999;
    s.camX = s.bossLock; g.camera.position.x = s.camX;
    h.pos.set(s.bossLock - 2, 0, 0);
    window.__run(0.2);
    const b = s.boss;
    if (b.mode === 'intro') { b.mode = 'think'; b.f.pos.set(s.bossLock + 2.5, 0, 0); }
    b.thinkT = 99;
    return b;
  };
  window.__hero = () => window.__game.scene.stage.heroes[0].f;
});

// 1) Fasene for alle sjefene
const phases = await page.evaluate(() => {
  const out = {};
  for (const id of ['road', 'swamp', 'scorch']) {
    const b = window.__toBoss(id), f = b.f;
    const n0 = b.moves.length;
    f.hp = f.maxHp * 0.64;
    window.__run(0.1);
    const p1 = { phase: b.phase, moves: b.moves.length - n0, speed: +b.speedMul.toFixed(2) };
    f.hp = f.maxHp * 0.3;
    window.__run(0.1);
    out[b.def.id] = { p1, p2: { phase: b.phase, speed: +b.speedMul.toFixed(2), trail: b.trail }, marks: document.querySelectorAll('.bossbar .marks b').length };
  }
  return out;
});
check('fasene begynner ved 66 og 33 prosent for Hogmother, Croakus og Magmor', Object.values(phases).every((p) => p.p1.phase === 1 && p.p2.phase === 2 && p.p2.speed > p.p1.speed && p.marks === 2), phases);
check('nye trekk i første fase (måltid, dykk), lava i sporene til Magmor', phases.hogmother.p1.moves >= 2 && phases.croakus.p1.moves >= 2 && phases.magmor.p2.trail, phases);

// 2) Hogmother spiser seg opp om ingen avbryter, og blir sliten om hun blir slått mens hun spiser
const feast = await page.evaluate(() => {
  const b = window.__toBoss('road'), f = b.f, L = window.__lib, h = window.__hero();
  f.hp = f.maxHp * 0.6;
  window.__run(0.1);
  const m = b.moves.find((x) => x.kind === 'feast');
  const before = f.hp;
  b.start(m);
  window.__run(3.0, () => { h.hp = 9999; });
  const healed = (f.hp - before) / f.maxHp;
  // Andre gang: slag mens hun spiser
  b.mode = 'think'; b.thinkT = 99; f.hp = f.maxHp * 0.6; f.setState('idle');
  b.start(m);
  window.__run(0.3);
  let modes = '';
  window.__run(1.2, (i) => {
    h.hp = 9999;
    if (i % 12 === 0) L.applyHit(h, f, L.HERO_ATK.chop);
    if (!modes.endsWith(b.mode)) modes += (modes ? '>' : '') + b.mode;
  });
  return { healed: +healed.toFixed(3), modes, after: +(f.hp / f.maxHp).toFixed(3) };
});
check('Hogmother får liv tilbake når hun spiser i fred', feast.healed > 0.08, feast);
check('slag mens hun spiser avbryter måltidet, og hun blir sliten', feast.modes.includes('tired') && feast.after < 0.6, feast);
await shot('feast');

// 3) Røde trekk kan ikke avbrytes, vanlige store trekk gir et vindu der slagene biter
const red = await page.evaluate(() => {
  const b = window.__toBoss('road'), f = b.f, L = window.__lib, h = window.__hero();
  f.hp = f.maxHp * 0.3;
  window.__run(0.1);
  const charge = b.moves.find((x) => x.kind === 'charge');
  h.pos.set(f.pos.x - 6, 0, f.pos.z);
  b.start(charge);
  let interrupted = false;
  window.__run(0.6, (i) => {
    h.hp = 9999;
    if (i % 6 === 0) L.applyHit(h, f, L.HERO_ATK.chop);
    if (b.cur !== charge && b.mode !== 'tired') interrupted = true;
  });
  // Etter stormløpet er hun sliten: uten rustning, og slagene rykker henne
  window.__run(3, () => { h.hp = 9999; if (b.mode === 'tired') b.t = 99; });
  b.tire(1.5);
  const hp0 = f.hp;
  L.applyHit(h, f, L.HERO_ATK.slash1);
  return { red: !!charge.red, interrupted, state: f.state, armored: f.armored, dmg: +(hp0 - f.hp).toFixed(1) };
});
check('det røde stormløpet kan ikke avbrytes med slag', red.red && !red.interrupted, red);
check('sliten sjef: uten rustning, og slagene gjør mer skade (1,3)', !red.armored && red.state === 'hurt' && red.dmg > 8, red);

// 4) Croakus dykker og kommer opp der skyggen er, under helten
const dive = await page.evaluate(() => {
  const b = window.__toBoss('swamp'), f = b.f, h = window.__hero();
  f.hp = f.maxHp * 0.6;
  window.__run(0.1);
  h.pos.set(f.pos.x - 5, 0, 1.2);
  h.hp = h.maxHp = 9999;
  const m = b.moves.find((x) => x.kind === 'dive');
  b.start(m);
  let hidden = false, hittable = true, maxDepth = 0;
  window.__run(1.2, () => {
    h.pos.set(h.pos.x, 0, 1.2); h.vel.set(0, 0, 0); h.state = 'idle';
    if (f.hideShadow) hidden = true;
    if (f.rising && b.t > 0.6) hittable = false;
    maxDepth = Math.min(maxDepth, f.pos.y);
  });
  const hp0 = h.hp;
  let up = null;
  window.__run(1.6, () => {
    if (!up && b.t > 2.05) up = { dx: +Math.abs(f.pos.x - h.pos.x).toFixed(2), dz: +Math.abs(f.pos.z - h.pos.z).toFixed(2) };
  });
  return { hidden, hittable, maxDepth: +maxDepth.toFixed(2), up, hurt: hp0 - h.hp > 0 || h.state === 'down', mode: b.mode };
});
check('Croakus går under bakken uten skygge og kan ikke treffes der', dive.hidden && !dive.hittable && dive.maxDepth < -2, dive);
check('han kommer opp der helten står og slår ham opp', dive.up && dive.up.dx < 1.2 && dive.hurt, dive);
await shot('dive');

// 5) Magmor legger lava i sporene, som brenner helten men ikke ham
const lava = await page.evaluate(() => {
  const b = window.__toBoss('scorch'), f = b.f, s = window.__game.scene.stage, h = window.__hero();
  f.hp = f.maxHp * 0.6;
  window.__run(0.1);
  b.thinkT = 0.01;
  const e0 = s.embers.length;
  window.__run(2.5, () => { b.thinkT = Math.max(b.thinkT, 5); f.wantVX = 2; h.hp = 9999; b.mode = 'think'; });
  // Magmor går: slipp ham gjennom til han har gått litt
  for (let i = 0; i < 120; i++) { f.pos.x += 0.02; window.__run(1 / 60); }
  const patches = s.embers.length - e0;
  const p = s.embers[s.embers.length - 1];
  h.burnT = 0;
  if (p) h.pos.set(p.x, 0, p.z);
  window.__run(0.3, () => { if (p) h.pos.set(p.x, 0, p.z); });
  return { patches, heroBurn: +h.burnT.toFixed(2), bossBurn: f.burnT };
});
check('Magmor legger lava i sporene', lava.patches >= 2, lava);
check('lavaen brenner helten, men ikke Magmor', lava.heroBurn > 0 && lava.bossBurn === 0, lava);
await shot('lava');

// 6) Vorthax: speilbildene, og solstrålen (på tårnet, uten vaktene og skjoldet)
const mirror = await page.evaluate(() => {
  const b = window.__toBoss('tower'), f = b.f, s = window.__game.scene.stage, L = window.__lib, h = window.__hero();
  s.finale = null; s.shieldFx?.dispose(); s.shieldFx = null;
  b.mode = 'think'; b.thinkT = 99; f.shielded = false; f.pos.set(s.bossLock + 2, 0, 0);
  f.hp = f.maxHp * 0.6;
  window.__run(0.1);
  const m = b.moves.find((x) => x.kind === 'mirror');
  b.start(m);
  window.__run(1.0, () => { b.thinkT = 99; });
  const copies = b.copies.length;
  const shadows = b.copies.filter((c) => c.shadow.visible).length;
  const realShadow = f.shadow.visible;
  const hp0 = f.hp;
  // Et slag på en kopi: den forsvinner, og Vorthax tar ingen skade
  const c0 = b.copies[0];
  if (c0) L.applyHit(h, c0, L.HERO_ATK.slash1);
  window.__run(0.1, () => { b.thinkT = 99; });
  const afterCopy = b.copies.length;
  // Et slag på den ekte: resten forsvinner
  b.mode = 'think';
  const r = L.applyHit(h, f, L.HERO_ATK.slash1);
  b.dispel();
  window.__run(0.1, () => { b.thinkT = 99; });
  return { copies, shadows, realShadow, afterCopy, hpSame: Math.abs(f.hp - (hp0 - r.dmg)) < 0.01, left: b.copies.length };
});
check('Vorthax lager kopier av seg selv uten skygge, den ekte har skygge', mirror.copies === 2 && mirror.shadows === 0 && mirror.realShadow, mirror);
check('en kopi forsvinner når den blir truffet, og den ekte tar ingen skade av det', mirror.afterCopy === mirror.copies - 1 && mirror.hpSame, mirror);
check('treffer helten den ekte, forsvinner resten', mirror.left === 0, mirror);

await page.evaluate(() => {
  const b = window.__toBoss('tower'), f = b.f, s = window.__game.scene.stage;
  s.finale = null; s.shieldFx?.dispose(); s.shieldFx = null;
  b.mode = 'think'; b.thinkT = 99; f.shielded = false; f.pos.set(s.bossLock + 3, 0, 0);
  f.hp = f.maxHp * 0.3;
  window.__run(2.0, () => { b.thinkT = 99; });
  window.__beam = { b, m: b.moves.find((x) => x.kind === 'beam'), res: {} };
});
// Strålen: helten blir stående i høyden den går i, og så går han ut av den
for (const [name, dz] of [['in', 0], ['out', 1.6]]) {
  await page.evaluate(({ dz }) => {
    const { b, m } = window.__beam, f = b.f, h = window.__hero();
    h.hp = h.maxHp = 9999; h.burnT = 0; h.state = 'idle'; h.invuln = 0;
    h.pos.set(f.pos.x - 4, 0, 0.2);
    f.setState('idle'); b.mode = 'think';
    b.start(m);
    window.__run(0.5, () => { h.pos.set(f.pos.x - 4, 0, 0.2); });
    window.__beam.hp0 = h.hp;
    window.__run(0.8, () => { h.pos.set(f.pos.x - 4, 0, 0.2 + dz); h.vel.set(0, 0, 0); if (h.state !== 'down') h.state = 'idle'; });
  }, { dz });
  if (name === 'out') await shot('beam');
  await page.evaluate(({ name, dz }) => {
    const { b } = window.__beam, f = b.f, h = window.__hero();
    window.__run(1.0, () => { h.pos.set(f.pos.x - 4, 0, 0.2 + dz); h.vel.set(0, 0, 0); if (h.state !== 'down') h.state = 'idle'; });
    window.__beam.res[name] = +(window.__beam.hp0 - h.hp).toFixed(1);
    window.__run(2, () => { b.thinkT = 99; });
  }, { name, dz });
}
const beam = await page.evaluate(() => ({ red: !!window.__beam.m?.red, ...window.__beam.res }));
check('solstrålen er rød og treffer helten i samme høyde, én gang', beam.red && beam.in > 0 && beam.in < 40, beam);
check('helten som går ut av høyden strålen går i, slipper unna', beam.out === 0, beam);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: sjefene går gjennom fasene');
