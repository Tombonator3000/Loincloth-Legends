// Lydbanken (core/soundbank.ts): filene pakkes ut, lydmetodene spiller opptakene oppå synthen, lyn er torden og zap,
// FAMILY hopper over gørr, RECORDED SOUNDS av gir bare synth, musikken dukker og dempes i pause, stemning per brett
// med bål som knitrer nærmere, fanfarer for drapsrekker, og enkeltfil-bygget fra file:// (bare synth, ingen feil).
// Bruk: node tools/tests/soundbank.mjs http://localhost:4173/ [file:///.../dist-single/index.html]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [url, singleArg] = process.argv.slice(2);
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ args: ARGS });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + info : ''));
  if (!ok) fails.push(name);
};

async function open(u) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto(u + (u.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); window.__lib.audio.init(); });
  return { page, logs };
}
const runner = (page) => (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const level = (page, id, biome) => page.evaluate(([id, biome]) => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id, name: id, kind: 'level', level: id, biome, pos: [0, 0], requires: [], blurb: '' });
}, [id, biome]);
/** Alle lydmetodene som har opptak. Ulike metoder har ulike sperrer, så de kan kalles samtidig. */
const fire = (page) => page.evaluate(() => {
  const a = window.__lib.audio;
  a.swish(1, false); a.hit(true); a.splat(1.4); a.rip(); a.bones(); a.bite(); a.thud(1.6); a.coin(); a.splash();
});
/** Feil som teller (Google Fonts kan ikke lastes i sandkassen, det er ufarlig). */
const realErrors = (logs) => logs.filter((l) => (l.startsWith('pageerror') || l.startsWith('error')) && !l.includes('ERR_CERT_AUTHORITY_INVALID'));

// ---------------------------------------------------------------- vanlig bygg (http)
{
  const { page, logs } = await open(url);
  const run = runner(page);
  const t0 = Date.now();
  let st;
  for (let i = 0; i < 80; i++) {
    st = await page.evaluate(() => { const b = window.__lib.audio.bank; return { started: b.started, ready: b.ready, total: b.total, failed: b.failed, done: b.done }; });
    if (st.done) break;
    await page.waitForTimeout(250);
  }
  check('bank decoded all files', st.done && st.failed === 0 && st.ready === st.total && st.total >= 40, JSON.stringify(st) + ' in ' + (Date.now() - t0) + ' ms');
  const groups = ['swing', 'swingHeavy', 'hit', 'hitHeavy', 'knas', 'splat', 'gore', 'rive', 'stikk', 'die', 'slam', 'torden', 'zap', 'tooth', 'splash', 'ins_gong', 'ins_bekken', 'ins_pauke', 'ins_paukevirvel', 'amb_baal', 'amb_vind', 'amb_natt', 'amb_drypp', 'amb_drone', 'kraake', 'ugle'];
  const missing = await page.evaluate((gs) => gs.filter((g) => !window.__lib.audio.bank.has(g)), groups);
  check('every mapped group is loaded', missing.length === 0, missing.join(','));

  // Lydmetodene spiller opptakene
  await page.evaluate(() => { window.__lib.audio.bank.played = {}; });
  await fire(page);
  await page.waitForTimeout(150);
  await page.evaluate(() => { const a = window.__lib.audio; a.thud(1, true); a.swish(0.8, true); a.hit(false); a.squish(); a.impale(); });
  let played = await page.evaluate(() => window.__lib.audio.bank.played);
  const want = ['swing', 'swingHeavy', 'hit', 'hitHeavy', 'knas', 'splat', 'gore', 'rive', 'stikk', 'die', 'slam', 'tooth', 'splash'];
  check('mapped methods play recordings', want.every((g) => played[g] > 0), JSON.stringify(played));

  // Lyn: torden og zap, og musikken dukker
  await page.evaluate(() => { const a = window.__lib.audio; a.play('stage', true); a.bank.played = {}; a.thunder(1); });
  await page.waitForTimeout(120);
  let duck = await page.evaluate(() => window.__lib.audio.duckG.gain.value);
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('thunder plays torden and zap', played.torden === 1 && played.zap === 1, JSON.stringify(played));
  check('music ducks under thunder', duck < 0.75, 'duck gain ' + duck.toFixed(2));
  await page.waitForTimeout(2200);
  duck = await page.evaluate(() => window.__lib.audio.duckG.gain.value);
  check('music comes back after the duck', duck > 0.9, 'duck gain ' + duck.toFixed(2));
  await page.evaluate(() => { const a = window.__lib.audio; a.bank.played = {}; a.thunder(0.35, 0.7); });
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('far thunder (title) has no zap', played.torden === 1 && !played.zap, JSON.stringify(played));

  // Gong og fanfarene
  await page.evaluate(() => { const a = window.__lib.audio; a.bank.played = {}; a.gong(); });
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('gong plays the VCSL gong', played.ins_gong === 1, JSON.stringify(played));
  for (const n of [3, 6, 10, 15, 22, 30]) {
    await page.evaluate((n) => window.__lib.audio.streak(n), n);
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => { const a = window.__lib.audio; a.bossSlain(); a.knockout(); a.chainBroken(); });
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('fanfares use gong, cymbal and timpani', played.ins_gong > 0 && played.ins_bekken > 0 && played.ins_pauke > 0 && played.ins_paukevirvel > 0, JSON.stringify(played));

  // FAMILY: ingen gørr, knas, riving eller stikk
  await page.evaluate(() => { const L = window.__lib; L.setSettings({ gore: 0 }); L.audio.bank.played = {}; });
  await page.waitForTimeout(600);
  await fire(page);
  await page.waitForTimeout(150);
  await page.evaluate(() => { const a = window.__lib.audio; a.squish(); a.impale(); });
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('FAMILY skips gore, crunch, rip and stab', !played.gore && !played.knas && !played.rive && !played.stikk && played.hitHeavy > 0 && played.splat > 0, JSON.stringify(played));
  await page.evaluate(() => window.__lib.setSettings({ gore: 2 }));

  // RECORDED SOUNDS av: bare synth
  await page.evaluate(() => { const L = window.__lib; L.setSettings({ recorded: false }); L.audio.bank.played = {}; });
  await page.waitForTimeout(600);
  await fire(page);
  await page.evaluate(() => window.__lib.audio.thunder(1));
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('RECORDED SOUNDS OFF plays synth only', Object.keys(played).length === 0, JSON.stringify(played));
  await page.evaluate(() => window.__lib.setSettings({ recorded: true }));

  // Stemning: myra med opptak, pause demper musikken, lyn på brettet er torden
  await level(page, 'swamp', 'swamp');
  await run(1);
  let amb = await page.evaluate(() => ({ cur: window.__lib.audio.amb.current, active: window.__lib.audio.amb.active }));
  check('swamp ambience uses drips and drone', amb.cur === 'swamp' && amb.active.includes('f:amb_drypp') && amb.active.includes('f:amb_drone'), JSON.stringify(amb));
  await page.evaluate(() => window.__game.togglePause());
  await run(0.1);
  await page.waitForTimeout(700);
  const dim = await page.evaluate(() => window.__lib.audio.dimG.gain.value);
  await page.evaluate(() => window.__game.togglePause());
  await run(0.1);
  await page.waitForTimeout(700);
  const undim = await page.evaluate(() => window.__lib.audio.dimG.gain.value);
  check('music dims while paused', dim < 0.6 && undim > 0.9, `paused ${dim.toFixed(2)}, resumed ${undim.toFixed(2)}`);
  await page.evaluate(() => {
    const st = window.__game.scene.stage, h = st.heroes[0];
    h.f.hp = 9999;
    window.__lib.audio.bank.played = {};
    st.proj.spawn({ kind: 'lightning', owner: h.f, x: h.f.pos.x + 3, y: 0, z: 0, vx: 0, dmg: 30, delay: 0.2, life: 2 });
  });
  await run(0.6);
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('lightning projectile (METAL MODE, boss) is thunder and zap', played.torden > 0 && played.zap > 0, JSON.stringify(played));
  // Tordenmagi. Først litt ekte tid: torden har en sperre på lydklokka (ok('thunder', 0.08)), og spilltiden over
  // spoles fortere enn den, så ellers kan lynet fra sjekken over sperre det første nedslaget.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const st = window.__game.scene.stage, h = st.heroes[0];
    h.magic = 'thunder';
    for (let i = 0; i < 3; i++) { const foe = st.spawnFoe('skeleton', 'R'); if (foe) foe.f.pos.set(h.f.pos.x + 2.5 + i * 1.3, 0, 0); }
    h.potions = 4;
    window.__lib.audio.bank.played = {};
    st.castMagic(h);
  });
  await run(2.5);
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('thunder magic is thunder, not an explosion', played.torden > 0, JSON.stringify(played));

  // Nattleiren: sirisser, og bålet knitrer når kameraet er ved det
  await level(page, 'nightcamp', 'night');
  await run(1.5);
  amb = await page.evaluate(() => ({ cur: window.__lib.audio.amb.current, active: window.__lib.audio.amb.active, fires: window.__lib.W.env.fires?.length }));
  check('night ambience: crickets and campfire', amb.cur === 'night' && amb.active.includes('f:amb_natt') && amb.active.includes('near:f:amb_baal') && amb.fires === 3, JSON.stringify(amb));
  // Reserven: opptakene av gir syntetisk stemning
  await page.evaluate(() => window.__lib.setSettings({ recorded: false }));
  await run(0.5);
  amb = await page.evaluate(() => window.__lib.audio.amb.active);
  check('synth ambience fallback', amb.includes('s:crickets') && amb.includes('near:s:fire') && !amb.some((k) => k.includes('f:')), JSON.stringify(amb));
  await page.evaluate(() => window.__lib.setSettings({ recorded: true }));
  await run(0.5);
  // Drapsrekke med fanfare, og en lang rekke som ryker når helten blir truffet (heltene sover først i nattleiren)
  await page.evaluate(() => window.__game.scene.stage.heroes[0].f.setState('idle'));
  await run(0.1);
  const streak = await page.evaluate(() => {
    const st = window.__game.scene.stage, h = st.heroes[0];
    h.f.hp = 9999;
    window.__lib.audio.bank.played = {};
    for (let i = 0; i < 10; i++) { const foe = st.spawnFoe('skeleton', 'R'); if (foe) { foe.f.pos.set(h.f.pos.x + 1.4, 0, 0); foe.f.die('normal', 1, h.f); } }
    return st.streak;
  });
  await run(0.1);
  const before = await page.evaluate(() => window.__game.scene.stage.streak);
  await page.evaluate(() => { const h = window.__game.scene.stage.heroes[0]; h.f.hurt(0.3, 0); });
  await run(0.1);
  const afterHit = await page.evaluate(() => window.__game.scene.stage.streak);
  check('long streak breaks with a trombone when the hero is hit', streak >= 10 && before >= 10 && afterHit === 0, `streak ${streak}, before ${before}, after ${afterHit}`);
  // Til et annet brett: stemningen glir over (nattlagene går ut, frost inn)
  await level(page, 'frost', 'frost');
  await run(1);
  amb = await page.evaluate(() => ({ cur: window.__lib.audio.amb.current, active: window.__lib.audio.amb.active }));
  check('ambience crossfades to frost wind', amb.cur === 'frost' && amb.active.includes('f:amb_vind') && !amb.active.includes('f:amb_natt'), JSON.stringify(amb));
  // Tittel: ingen stemning, og lynet bak kjempene er torden
  await page.evaluate(() => { window.__game.goTitle(); window.__lib.audio.bank.played = {}; });
  await run(6);
  amb = await page.evaluate(() => window.__lib.audio.amb.current);
  played = await page.evaluate(() => window.__lib.audio.bank.played);
  check('title: no ambience, lightning is thunder', amb === null && played.torden > 0, JSON.stringify({ amb, played }));
  // Duell: publikumsmumling i arenaen, og knockout med fanfare
  await page.evaluate(() => { const g = window.__game; g.goDuel({ a: g.heroSide(0), b: g.heroSide(1), roundsToWin: 1, arena: 'pit', intro: [] }, () => {}); });
  await run(1);
  amb = await page.evaluate(() => ({ cur: window.__lib.audio.amb.current, active: window.__lib.audio.amb.active }));
  check('duel arena has a crowd murmur', amb.cur === 'arena' && amb.active.includes('s:murmur'), JSON.stringify(amb));
  console.log('LOGS:\n' + logs.join('\n'));
  if (realErrors(logs).length) fails.push('errors in http run');
  await page.close();
}

// ---------------------------------------------------------------- enkeltfil-bygget fra file:// (bare synth)
const singlePath = singleArg ?? (existsSync(resolve('dist-single/index.html')) ? pathToFileURL(resolve('dist-single/index.html')).href : null);
if (singlePath) {
  const { page, logs } = await open(singlePath);
  const run = runner(page);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => { const b = window.__lib.audio.bank; return { started: b.started, total: b.total, protocol: location.protocol }; });
  check('file:// single build never starts the bank', !st.started && st.total === 0, JSON.stringify(st));
  await fire(page);
  await page.evaluate(() => { const a = window.__lib.audio; a.thunder(1); a.gong(); a.streak(30); a.bossSlain(); });
  await level(page, 'nightcamp', 'night');
  await run(1.5);
  const amb = await page.evaluate(() => window.__lib.audio.amb.active);
  check('file:// ambience is synth', amb.includes('s:crickets'), JSON.stringify(amb));
  await page.evaluate(() => {
    const st = window.__game.scene.stage, h = st.heroes[0];
    st.proj.spawn({ kind: 'lightning', owner: h.f, x: h.f.pos.x + 3, y: 0, z: 0, vx: 0, dmg: 30, delay: 0.2, life: 2 });
  });
  await run(0.8);
  const errs = realErrors(logs);
  console.log('FILE LOGS:\n' + logs.join('\n'));
  check('file:// fallback throws nothing', errs.length === 0, errs.length + ' errors');
  await page.close();
} else console.log('SKIP file:// (build dist-single with npm run build:single, or pass its file URL)');

console.log(fails.length ? 'FAILED: ' + fails.join(', ') : 'ALL OK');
await browser.close();
process.exit(fails.length ? 1 : 0);
