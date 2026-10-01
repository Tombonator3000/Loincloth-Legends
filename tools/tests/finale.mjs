// Sluttkampen i tårnet (BossDef.finale, Stage.updateFinale, gfx/env/tower.ts): Vorthax står på tronen bak et skjold
// mens skjelettvaktene reiser seg av gulvet, to bølger. Vaktene har en dør som skjold (slag forfra preller av, tredje
// slag i komboen og slag bakfra går gjennom). Så går han ned og slåss. Skjoldet holdes oppe av tre søyler med
// krystaller; en søyle som faller over ham skader ham, og når den siste er nede, brister skjoldet og han er sliten.
// Ved 33 prosent tar han Solhjertet. Når han dør, faller hjertet ned og buret med prinsessen senkes.
// Bruk: node tools/tests/finale.mjs http://localhost:4173/ [./shots]
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
  await page.screenshot({ path: `${out}/finale-${n}.png` });
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
  g.playLevel({ id: 'tower', name: 'tower', kind: 'level', level: 'tower', biome: 'tower', pos: [0, 0], requires: [], blurb: '' });
  window.__run(1);
  const s = g.scene.stage;
  for (const f of s.foes) if (f.f.alive) f.f.die('normal', 1, null);
  s.waveIdx = s.level.waves.length; s.wave = null; s.lockX = null;
  const h = s.heroes[0].f; h.hp = h.maxHp = 9999;
  s.camX = s.bossLock; g.camera.position.x = s.camX;
  h.pos.set(s.bossLock - 3, 0, 0.5);
  window.__run(0.3);
  window.__s = () => window.__game.scene.stage;
  window.__hero = () => window.__game.scene.stage.heroes[0].f;
  window.__guards = () => window.__s().foes.filter((o) => o.f.alive);
});

// 1) Tronen: skjoldet, og slag preller av
const throne = await page.evaluate(() => {
  const s = window.__s(), b = s.boss, L = window.__lib, h = window.__hero();
  const hp0 = b.f.hp;
  const r = L.applyHit(h, b.f, L.HERO_ATK.chop);
  return { mode: b.mode, shielded: b.f.shielded, blocked: r.blocked, hpSame: b.f.hp === hp0, z: +b.f.pos.z.toFixed(2), hud: document.querySelector('.bossbar').classList.contains('shielded'), pillars: s.finale?.pillars };
});
check('Vorthax står på tronen bak skjoldet, og slagene preller av', throne.mode === 'throne' && throne.shielded && throne.blocked && throne.hpSame && throne.z < -3, throne);
check('livslinja viser skjoldet, og tre søyler mater det', throne.hud && throne.pillars === 3, throne);

// 2) Vaktene reiser seg av gulvet
const rise = await page.evaluate(() => {
  let rising = 0, below = 0, n = 0;
  // Vaktene kommer etter introreplikkene: vent til tre har reist seg helt (høyst 16 sekunder)
  for (let i = 0; i < 60 * 16; i++) {
    window.__game.tick(1 / 60, false);
    const g = window.__guards();
    n = Math.max(n, g.length);
    rising = Math.max(rising, g.filter((o) => o.f.rising).length);
    below = Math.min(below, ...g.map((o) => o.f.pos.y), 0);
    window.__hero().hp = 9999;
    if (g.length >= 3 && g.every((o) => !o.f.rising)) break;
  }
  const g = window.__guards();
  return { n, rising, below: +below.toFixed(2), ids: g.map((o) => o.def.id).join(','), up: g.every((o) => !o.f.rising && o.f.pos.y === 0), wave: window.__s().finale.wave };
});
check('første bølge: tre skjelettvakter reiser seg av gulvet', rise.n === 3 && rise.rising > 0 && rise.below < -0.5 && rise.ids === 'skelguard,skelguard,skelguard' && rise.up, rise);
await shot('guards');

// 3) Døra: slag forfra preller av, tredje slag i komboen og slag bakfra går gjennom
const door = await page.evaluate(() => {
  const L = window.__lib, h = window.__hero();
  const o = window.__guards()[0], f = o.f;
  // Helten står til høyre for vakta. Forfra: vakta ser mot høyre (mot helten). Bakfra: vakta ser bort
  const hit = (atk, front) => {
    f.hp = f.maxHp; f.state = 'idle'; f.onGround = true; f.facing = front ? 1 : -1; f.invuln = 0;
    h.pos.set(f.pos.x + 1.2, 0, f.pos.z); h.facing = -1;
    const hp0 = f.hp;
    const r = L.applyHit(h, f, atk);
    return { blocked: r.blocked, dmg: +(hp0 - f.hp).toFixed(1) };
  };
  return { front: hit(L.HERO_ATK.slash1, true), chop: hit(L.HERO_ATK.chop, true), back: hit(L.HERO_ATK.slash1, false) };
});
check('døra stopper vanlige slag forfra', door.front.blocked && door.front.dmg === 0, door);
check('tredje slag i komboen og slag bakfra går gjennom døra', !door.chop.blocked && door.chop.dmg > 0 && !door.back.blocked && door.back.dmg > 0, door);

// 4) Andre bølge, og så går han ned fra tronen
const waves = await page.evaluate(() => {
  const s = window.__s(), b = s.boss;
  const kill = () => { for (const o of window.__guards()) o.f.die('explode', 1, null); };
  kill();
  let second = '';
  window.__run(6, () => {
    window.__hero().hp = 9999;
    const g = window.__guards();
    if (!second && g.length >= 4) second = g.map((o) => o.def.id).sort().join(',');
  });
  kill();
  window.__run(4, () => { window.__hero().hp = 9999; });
  return { second, mode: b.mode, shielded: b.f.shielded, step: s.finale.step };
});
check('andre bølge: vakter, kultist og grisevakt', waves.second === 'darkcultist,hogguard,skelguard,skelguard', waves);
check('når vaktene er slått, går han ned og slåss, fortsatt bak skjoldet', waves.mode !== 'throne' && waves.shielded && waves.step === 'fight', waves);
await shot('shield');

// 5) Søylene: en søyle som faller over ham, skader ham. Når den siste er nede, brister skjoldet
const pillars = await page.evaluate(() => {
  const g = window.__game, s = window.__s(), b = s.boss, h = window.__hero();
  const list = s.tippables.filter((t) => t.conduit);
  const fell = [];
  let crushed = null;
  for (let i = 0; i < list.length; i++) {
    const tp = list[i];
    // Den midterste faller over ham: han står i linja den lander på
    b.mode = 'think'; b.thinkT = 99; b.cur = null; b.f.setState('idle');
    const hp0 = b.f.hp;
    h.pos.set(tp.x - 1.1, 0, -2.0); h.facing = 1; h.state = 'idle'; h.hp = 9999;
    if (i === 1) b.f.pos.set(tp.x + Math.tan(0.5) * (0.4 - tp.z - 0.45), 0, 0.4);
    g.input.tapped.add('KeyJ');
    window.__run(1.6, () => { h.hp = 9999; if (i === 1) { b.thinkT = 99; } });
    if (i === 1) crushed = { lost: +((hp0 - b.f.hp) / b.f.maxHp).toFixed(3), mode: b.mode };
    fell.push({ tipped: tp.tipped, shielded: b.f.shielded });
  }
  return { fell, crushed, shielded: b.f.shielded, mode: b.mode, hud: document.querySelector('.bossbar').classList.contains('shielded') };
});
check('et slag velter søylene, og skjoldet står til den siste faller', pillars.fell.every((p) => p.tipped) && pillars.fell[0].shielded && pillars.fell[1].shielded && !pillars.fell[2].shielded, pillars);
check('en søyle som faller over Vorthax, tar sju prosent av livet hans', pillars.crushed && pillars.crushed.lost > 0.05 && pillars.crushed.lost < 0.1, pillars);
check('skjoldet brister: han er sliten og livslinja viser det ikke lenger', !pillars.shielded && !pillars.hud, pillars);
await shot('pillars');

// 6) Fasene: speilbilder ved 66 prosent, Solhjertet ved 33
const heart = await page.evaluate(() => {
  const s = window.__s(), b = s.boss, fin = window.__game.scene.stage && window.__lib.W.env.finale;
  b.f.hp = b.f.maxHp * 0.6;
  window.__run(0.2, () => { window.__hero().hp = 9999; });
  const p1 = b.phase;
  b.f.hp = b.f.maxHp * 0.3;
  window.__run(2.5, () => { window.__hero().hp = 9999; });
  // Hjertet sitter på toppen av staven hans
  const d = fin.heart().distanceTo(b.f.rig.weaponTip());
  return { p1, p2: b.phase, beam: b.moves.some((m) => m.kind === 'beam'), heartNear: +d.toFixed(2), skull: document.querySelector('.bossbar').classList.contains('phase2') };
});
check('fasene i sluttkampen: speilbilder, så Solhjertet og solstrålen', heart.p1 === 1 && heart.p2 === 2 && heart.beam && heart.skull, heart);
check('Solhjertet flyr fra tronen til staven til Vorthax', heart.heartNear < 0.8, heart);
await shot('heart');

// 7) Han dør: hjertet faller ned, buret senkes, og brettet er ferdig
const end = await page.evaluate(() => {
  const s = window.__s(), b = s.boss, L = window.__lib, h = window.__hero(), fin = L.W.env.finale;
  b.f.hp = 1; b.f.armored = false; b.f.shielded = false;
  h.pos.set(b.f.pos.x - 1.5, 0, b.f.pos.z); h.facing = 1;
  L.applyHit(h, b.f, L.HERO_ATK.chop);
  window.__run(4.2);
  return { alive: b.f.alive, heartY: +fin.heart().y.toFixed(2), copies: b.copies.length };
});
await shot('freed');
// Brettet er ferdig: seiersskjermen kommer (StageScene leser done i samme bilde, så se etter skjermen)
end.victory = await page.evaluate(() => {
  window.__run(6);
  return !!document.querySelector('.panel.victory');
});
check('Vorthax dør, Solhjertet faller på gulvet, og seiersskjermen kommer', !end.alive && end.heartY < 1 && end.victory, end);
await shot('end');

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: sluttkampen går i faser');
