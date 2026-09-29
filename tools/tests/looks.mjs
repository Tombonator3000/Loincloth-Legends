// Faste skjermbilder av alle brettene, et gore-øyeblikk per brett, duell og tittel.
// Brukes til å sammenligne grafikken før og etter endringer.
// Bruk: node tools/tests/looks.mjs http://localhost:4173/ ./shots [road,swamp,...|all] [prefiks]  (QUALITY=low for grafikknivå)
import { chromium } from 'playwright';
const [url, out, only, prefix = 'look'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
// Skjul store kunngjøringer (STAGE 1 osv.) så de ikke dekker bildet
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
// QUALITY=low|medium|high|ultra i miljøet velger grafikknivå
if (process.env.QUALITY) await page.evaluate((q) => window.__lib.setSettings({ quality: q }), process.env.QUALITY);
const run = (sec, keys = [], taps = []) => page.evaluate(({ sec, keys, taps }) => {
  const g = window.__game; const inp = g.input; const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) { for (const k of keys) inp.keys.add(k); if (i === 0) for (const k of taps) inp.tapped.add(k); g.tick(1 / 60, false); }
  for (const k of keys) inp.keys.delete(k);
}, { sec, keys, taps });
const shot = async (n) => {
  const t0 = Date.now();
  // Summer tegnekall og trekanter over hele framen (skygger, scene og etterbehandling)
  const info = await page.evaluate(() => {
    const r = window.__game.renderer;
    r.info.autoReset = false;
    r.info.reset();
    window.__game.tick(1 / 60, true);
    const o = { calls: r.info.render.calls, tris: r.info.render.triangles };
    r.info.autoReset = true;
    return o;
  });
  await page.screenshot({ path: `${out}/${prefix}-${n}.png` });
  console.log('shot', n, Date.now() - t0, 'ms', 'calls', info.calls, 'tris', info.tris);
};
const ev = (fn, arg) => page.evaluate(fn, arg);

const ids = only && only !== 'all' ? only.split(',') : ['road', 'swamp', 'frost', 'scorch', 'tower', 'duel', 'title'];
for (const id of ids) {
  if (id === 'duel') {
    await ev(() => { const g = window.__game; g.save.heroMade = [true, true]; g.pvpDuel(); });
    await run(0.1, [], ['Enter']);
    await run(4.0);
    await shot('duel');
    continue;
  }
  if (id === 'fx') {
    // Lyn, eksplosjon og gnister midt i brett 1 (effektene fryses et øyeblikk etter utløsning)
    await ev(() => { const g = window.__game; g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true; g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' }); });
    await run(4.5);
    await ev(() => {
      const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, V = L.THREE.Vector3;
      h.hp = 9999;
      g.gore.vfx.lightning(new V(h.pos.x + 3.5, 14, -1), new V(h.pos.x + 3.5, 0, 0.5));
      g.gore.vfx.explode(new V(h.pos.x + 7, 1.2, 0), 1);
      for (let i = 0; i < 4; i++) g.gore.sparks(new V(h.pos.x + 1.2, 1.4 + i * 0.1, 0.2), 10, '#ffd35a', 7);
    });
    await run(0.05);
    await shot('fx-a');
    await run(0.25);
    await shot('fx-b');
    continue;
  }
  if (id === 'title') {
    await ev(() => window.__game.goTitle());
    await run(3);
    await ev(() => window.__game.screens.hide());
    await shot('title');
    continue;
  }
  await ev((id) => { const g = window.__game; g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true; g.playLevel({ id, name: id, kind: 'level', level: id, biome: 'grass', pos: [0, 0], requires: [], blurb: '' }); }, id);
  await run(1.0);
  await run(2.2, ['KeyD']);
  await run(2.5);
  // Tre fiender foran helten (tittelen er borte nå)
  await ev((id) => {
    const FOES = { road: ['skeleton', 'hogman', 'skeleton'], swamp: ['zombie', 'frogman', 'zombie'], frost: ['frostskel', 'troll', 'frostskel'], scorch: ['emberskel', 'fireimp', 'emberskel'], tower: ['darkcultist', 'hogguard', 'skeleton'] };
    const s = window.__game.scene.stage; const h = s.heroes[0].f; h.hp = 9999;
    for (const f of s.foes) f.f.alive && f.f.die('normal', 1, null);
    (FOES[id] ?? FOES.road).forEach((fid, i) => { const foe = s.spawnFoe(fid, 'R'); if (foe) { foe.f.pos.x = h.pos.x + 2.4 + i * 1.6; foe.f.pos.z = [-0.8, 0.6, -0.2][i]; foe.f.facing = -1; } });
  }, id);
  await run(0.6);
  await shot(`${id}-a`);
  // Gore-øyeblikk: én halshugget, én sprengt
  await ev(() => {
    const s = window.__game.scene.stage; const h = s.heroes[0].f;
    const alive = s.foes.filter((x) => x.f.alive);
    if (alive[0]) alive[0].f.die('decap', 1, h);
    if (alive[1]) alive[1].f.die('explode', 1, h);
  });
  await run(0.3);
  await shot(`${id}-gore`);
  await run(1.6);
  await shot(`${id}-gore2`);
}
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
