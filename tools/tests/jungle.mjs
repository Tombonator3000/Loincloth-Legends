// Jungelbrettet (brett 2): farene og søylene, og skjermbilder langs brettet.
// - Den kjøttetende planten spiser en fiende som kastes inn i den, biter en helt bare når den glefser, og
//   fiendene går rundt den.
// - Steinvekta faller på en fiende som står under den, skader en helt uten å drepe ham, og heises opp igjen.
// - En søyle som veltes med et slag, faller bort fra slaget og knuser fiendene den lander på.
// Bruk: node tools/tests/jungle.mjs http://localhost:4173/ [./shots]
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
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + info : ''));
  if (!ok) fails.push(name);
};
const shot = async (n) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/jungle-${n}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'jungle', name: 'jungle', kind: 'level', level: 'jungle', biome: 'jungle', pos: [0, 0], requires: [], blurb: '' });
  for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null;
  // Hjelpere: rydd fiender og flytt helten og kameraet
  window.__reset = (x, z = 0) => {
    const s = window.__game.scene.stage, h = s.heroes[0].f;
    for (const f of s.foes) { f.f.alive && f.f.die('normal', 1, null); f.f.rig.root.visible = false; f.f.removeMe = true; }
    for (let i = 0; i < 2; i++) window.__game.tick(1 / 60, false);
    h.hp = h.maxHp = 200; h.pos.set(x, 0, z); h.vel.set(0, 0, 0); h.state = 'idle'; h.invuln = 0; h.facing = 1;
    s.hazardCd.clear();
    s.camX = x; window.__game.camera.position.x = x;
  };
  window.__hz = (kind, n = 0) => window.__game.scene.stage.hazards.filter((h) => h.def.kind === kind)[n];
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
});

// Skjermbilder langs brettet uten fiender: starten, planten, søylen, steinvekta, tempelet og sokkelen
if (out) {
  for (const [n, x] of [['start', 6], ['plant', 23], ['pillar', 28], ['deadfall', 50], ['temple', 82], ['pedestal', 117]]) {
    await page.evaluate((x) => { window.__reset(x, 0); window.__run(0.5); }, x);
    await shot('tour-' + n);
  }
}

// 1) Planten spiser en fiende som kastes inn i den
const eat = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f, p = window.__hz('maneater');
  window.__reset(p.def.x - 3.5, p.def.z);
  const foe = s.spawnFoe('mossskel', 'R');
  foe.f.pos.set(p.def.x - 1.6, 1.0, p.def.z);
  foe.f.vel.set(4, 1.5, 0);
  foe.f.state = 'down';
  foe.f.onGround = false;
  foe.f.thrownBy = h;
  let died = -1;
  window.__run(1.5, (i) => { if (died < 0 && !foe.f.alive) died = i; });
  return { alive: foe.f.alive, died, x: +foe.f.pos.x.toFixed(2) };
});
check('planten spiser en fiende som kastes inn i den', !eat.alive && eat.died >= 0, JSON.stringify(eat));
await shot('eaten');

// 2) Planten biter en helt bare når den glefser
const bite = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f, p = window.__hz('maneater');
  window.__reset(p.def.x, p.def.z);
  p.t = 0;
  const hp0 = h.hp;
  let hurtState = '', firstHurt = -1;
  window.__run(4.5, (i) => {
    h.pos.set(p.def.x, 0, p.def.z); h.vel.set(0, 0, 0);
    if (firstHurt < 0 && h.hp < hp0) { firstHurt = i; hurtState = p.plant; }
  });
  return { hp0, hp: h.hp, alive: h.alive, firstHurt: +(firstHurt / 60).toFixed(2), hurtState };
});
check('planten biter helten bare når den glefser', bite.firstHurt >= 4.1 && bite.hurtState === 'snap', JSON.stringify(bite));
check('og helten overlever bittet', bite.alive && bite.hp < bite.hp0 && bite.hp > bite.hp0 - 40, JSON.stringify(bite));

// 3) Fiender går rundt planten
const avoid = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f, p = window.__hz('maneater');
  window.__reset(p.def.x - 4, p.def.z);
  const foe = s.spawnFoe('templethief', 'R');
  foe.f.pos.set(p.def.x + 3, 0, p.def.z);
  let inside = 0;
  window.__run(4, () => { h.hp = 200; if (foe.f.alive && p.contains(foe.f.pos.x, foe.f.pos.z, -0.2)) inside++; });
  return { alive: foe.f.alive, inside };
});
check('fiendene går rundt planten', avoid.alive && avoid.inside === 0, JSON.stringify(avoid));
// Skjermbilde: planten gaper og rister rett før den glefser
if (out) {
  await page.evaluate(() => { const p = window.__hz('maneater'); window.__reset(p.def.x - 2.4, 0.8); p.t = 3.95; window.__run(0.02); });
  await shot('plant-warn');
}

// 4) Steinvekta faller på en fiende som står under den
const drop = await page.evaluate(() => {
  const s = window.__game.scene.stage, d = window.__hz('deadfall');
  window.__reset(d.def.x - 5, 0);
  d.drop = 'up';
  const foe = s.spawnFoe('hogman', 'R');
  foe.f.pos.set(d.def.x, 0, d.def.z);
  foe.f.state = 'stunned'; foe.f.stunT = 3;
  const modes = [];
  let died = -1;
  window.__run(1.6, (i) => {
    if (modes[modes.length - 1] !== d.drop) modes.push(d.drop);
    if (died < 0 && !foe.f.alive) died = i;
  });
  return { alive: foe.f.alive, died: +(died / 60).toFixed(2), modes: modes.join('>') };
});
check('steinvekta knirker, faller og knuser fienden under den', !drop.alive && drop.died > 0.7 && drop.modes.startsWith('up>creak>fall>down'), JSON.stringify(drop));
await shot('deadfall');

// 5) Steinvekta skader helten uten å drepe ham, og heises opp igjen
const dropHero = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f, d = window.__hz('deadfall');
  window.__run(5);
  const ready = d.drop;
  window.__reset(d.def.x, d.def.z);
  const hp0 = h.hp;
  window.__run(1.4, () => { if (h.state === 'idle') h.pos.set(d.def.x, 0, d.def.z); });
  return { ready, hp0, hp: h.hp, alive: h.alive };
});
check('steinvekta er oppe igjen etter en stund', dropHero.ready === 'up', JSON.stringify(dropHero));
check('steinvekta skader helten uten å drepe ham', dropHero.alive && dropHero.hp < dropHero.hp0 && dropHero.hp >= dropHero.hp0 - 40, JSON.stringify(dropHero));

// 6) En søyle som veltes med et slag, knuser fiendene i stripen den lander på
const pillar = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, h = s.heroes[0].f;
  const tp = s.tippables.find((t) => !t.tipped);
  window.__reset(tp.x - 1.1, -2.0);
  // Søylen faller bort fra slaget og vris 0,5 radianer til siden, så fiendene står langs linja den lander på
  const foes = [-1.2, 0.2, 1.4].map((z) => {
    const f = s.spawnFoe('mossskel', 'R');
    f.f.pos.set(tp.x + Math.tan(0.5) * (z - tp.z - 0.45), 0, z);
    f.f.state = 'stunned'; f.f.stunT = 5;
    return f;
  });
  g.input.tapped.add('KeyJ');
  window.__run(2.2, () => { h.hp = 200; });
  return { tipped: tp.tipped, dead: foes.filter((f) => !f.f.alive).length, kills: foes.map((f) => f.f.envKill ?? '').join(',') };
});
check('et slag velter søylen', pillar.tipped, JSON.stringify(pillar));
check('søylen knuser fiendene den lander på', pillar.dead === 3, JSON.stringify(pillar));
await shot('pillar');

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: jungelfarene virker');
