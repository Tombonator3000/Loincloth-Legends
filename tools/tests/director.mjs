// Runde E: regissøren (game/director.ts), bølgebudsjettet (rang) og vanskelighetsgraden (data/difficulty.ts).
// - Spenningen stiger når heltene tar skade, og etter en topp kommer et pusterom med færre angrepsplasser og lengre
//   pauser. Når det er rolig, øker trykket.
// - Bølgebudsjettet: en elite (rang 4) tar hele plassen i en bølge med maxAlive 4, så småfolket venter til han er
//   død. En bølge som går over budsjettet, gir mindre plass i neste.
// - Vanskelighetsgraden endrer opptrekket, tempoet, unnamanøvrene og angrepsplassene, aldri liv eller skade.
// Bruk: node tools/tests/director.mjs http://localhost:4173/
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
  window.__play = (difficulty = 'normal') => {
    const g = window.__game;
    window.__lib.setSettings({ difficulty });
    g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
    g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
    window.__run(0.5);
    const s = g.scene.stage;
    s.waveIdx = 999; s.wave = null; s.visionDone = true;
    // Egen kopi av bølgene, så testen ikke endrer brettdataene
    s.level = { ...s.level, waves: [...s.level.waves] };
    return s;
  };
});

// 1) Spenning, topp og pusterom
const pace = await page.evaluate(() => {
  const s = window.__play('normal'), d = s.director, h = s.heroes[0].f;
  h.hp = h.maxHp = 200;
  window.__run(0.5);
  const calm = { tension: +d.tension.toFixed(2), tokens: s.maxTokens, pace: +s.pace.toFixed(2), mode: d.mode };
  // Helten tar mye skade på kort tid
  for (let i = 0; i < 4; i++) { h.hp -= 30; window.__run(0.2); }
  const peak = { tension: +d.tension.toFixed(2), mode: d.mode, tokens: s.maxTokens, pace: +s.pace.toFixed(2) };
  window.__run(4.5, () => { h.hp = Math.max(h.hp, 80); });
  const relax = { mode: d.mode, tokens: s.maxTokens, pace: +s.pace.toFixed(2) };
  window.__run(8, () => { h.hp = 200; });
  const after = { mode: d.mode, tension: +d.tension.toFixed(2), tokens: s.maxTokens };
  return { calm, peak, relax, after };
});
check('rolig: mer trykk (tre angrepsplasser for én helt, raskere tempo)', pace.calm.tokens === 3 && pace.calm.pace > 1, pace);
check('mye skade gir en topp', pace.peak.mode === 'peak' && pace.peak.tension >= 0.85, pace);
check('etter toppen kommer et pusterom med færre angrepsplasser og lengre pauser', pace.relax.mode === 'relax' && pace.relax.tokens === 1 && pace.relax.pace < 0.8, pace);
check('og så bygger det seg opp igjen', pace.after.mode === 'build', pace);

// 2) Bølgebudsjettet
const budget = await page.evaluate(() => {
  const s = window.__play('normal'), h = s.heroes[0].f;
  h.hp = h.maxHp = 9999;
  const x = 30;
  s.level.waves.push({ at: x, maxAlive: 4, spawns: ['ironwarden:R:0', 'skeleton:R:0.1', 'skeleton:L:0.2', 'skeleton:R:0.3', 'skeleton:L:0.4'].map((t) => { const [foe, side, delay] = t.split(':'); return { foe, side, delay: +delay }; }) });
  s.waveIdx = s.level.waves.length - 1;
  h.pos.set(x, 0, 0); s.camX = x;
  window.__run(3, () => { h.hp = 9999; });
  const alive = () => s.foes.filter((o) => o.f.alive).map((o) => o.def.id);
  const withWarden = alive();
  for (const o of s.foes) if (o.def.id === 'ironwarden') o.f.die('explode', 1, null);
  window.__run(3, () => { h.hp = 9999; });
  const after = alive();
  return { cap: s.waveCap, withWarden, after, rank: s.aliveRank() };
});
check('budsjettet: mens eliten lever, venter småfolket', budget.withWarden.length === 1 && budget.withWarden[0] === 'ironwarden', budget);
check('når eliten er død, kommer småfolket inn (fire i rang)', budget.after.length === 4 && budget.rank === 4, budget);

const debt = await page.evaluate(() => {
  const s = window.__play('normal'), h = s.heroes[0].f;
  h.hp = h.maxHp = 9999;
  const mk = (t) => t.map((x) => { const [foe, side, delay] = x.split(':'); return { foe, side, delay: +delay }; });
  // En bølge med plass til 3, men en elite (4) må inn: 1 i gjeld til neste bølge
  s.level.waves.push({ at: 40, maxAlive: 3, spawns: mk(['ironwarden:R:0']) });
  s.level.waves.push({ at: 50, maxAlive: 5, spawns: mk(['skeleton:R:0', 'skeleton:R:0.1', 'skeleton:L:0.2', 'skeleton:R:0.3', 'skeleton:L:0.4', 'skeleton:R:0.5']) });
  s.waveIdx = s.level.waves.length - 2;
  h.pos.set(40, 0, 0); s.camX = 40;
  window.__run(1.5, () => { h.hp = 9999; });
  const first = s.waveCap;
  for (const o of s.foes) if (o.f.alive) o.f.die('explode', 1, null);
  window.__run(1.0, () => { h.hp = 9999; });
  h.pos.set(50, 0, 0); s.camX = 50;
  window.__run(3, () => { h.hp = 9999; });
  return { first, second: s.waveCap, alive: s.foes.filter((o) => o.f.alive).length };
});
check('en bølge over budsjettet gir mindre plass i den neste (5 blir 4)', debt.first === 3 && debt.second === 4 && debt.alive === 4, debt);

// 3) Vanskelighetsgraden: opptrekk, tempo, unnamanøvrer og angrepsplasser, ikke liv eller skade
const diff = await page.evaluate(() => {
  const out = {};
  for (const d of ['easy', 'normal', 'hard']) {
    const s = window.__play(d), h = s.heroes[0].f;
    h.hp = h.maxHp = 9999;
    h.pos.set(20, 0, 0); s.camX = 20;
    const o = s.spawnFoe('skeleton', 'R');
    o.f.pos.set(21.4, 0, 0); o.entered = true; o.cd = 0;
    let startup = 0;
    window.__run(3, () => { if (!startup && o.f.atk) startup = o.f.atk.startup; h.hp = 9999; });
    out[d] = { startup: +startup.toFixed(3), tokens: s.director.tokens(2), pace: +(s.director.pace() / (s.director.mode === 'build' && s.director.tension < 0.2 ? 1.15 : 1)).toFixed(2), dodge: s.dodge, hp: o.f.maxHp, dmg: o.def.attack.dmg };
  }
  window.__lib.setSettings({ difficulty: 'normal' });
  return out;
});
check('lett: lengre opptrekk, lavere tempo, færre angrepsplasser', diff.easy.startup > diff.normal.startup && diff.easy.pace < diff.normal.pace && diff.easy.tokens < diff.normal.tokens && diff.easy.dodge < diff.normal.dodge, diff);
check('vanskelig: kortere opptrekk, høyere tempo, flere angrepsplasser', diff.hard.startup < diff.normal.startup && diff.hard.pace > diff.normal.pace && diff.hard.tokens > diff.normal.tokens && diff.hard.dodge > diff.normal.dodge, diff);
check('liv og skade er like på alle nivåene', diff.easy.hp === diff.hard.hp && diff.easy.dmg === diff.hard.dmg, diff);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: regissøren, budsjettet og vanskelighetsgraden virker');
