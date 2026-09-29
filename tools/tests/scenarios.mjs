// Scenarier: creator | map | levels [id,id,...] | arena. Styrer spillet via window.__game og tar skjermbilder.
// Bruk: node tools/tests/scenarios.mjs http://localhost:4173/ ./shots levels road,swamp
import { chromium } from 'playwright';
const [url, out, scenario] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(2000);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
const run = (sec, keys = [], taps = []) => page.evaluate(({ sec, keys, taps }) => {
  const g = window.__game; const inp = g.input; const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) { for (const k of keys) inp.keys.add(k); if (i === 0) for (const k of taps) inp.tapped.add(k); g.tick(1 / 60, false); }
  for (const k of keys) inp.keys.delete(k);
}, { sec, keys, taps });
const shot = async (n) => { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const st = () => ev(() => { const g = window.__game; const s = g.scene.stage; const d = g.scene.duel; return { scene: g.scene.name, screen: g.screens.active, stage: s ? { camX: s.camX.toFixed(1), wave: s.waveIdx, foes: s.foes.filter(f => f.f.alive).length, boss: s.boss ? { hp: Math.round(s.boss.f.hp), mode: s.boss.mode, cur: s.boss.cur?.kind } : null, done: s.done } : null, duel: d ? { phase: d.phase, round: d.round, wins: d.wins } : null }; });

if (scenario === 'creator') {
  await shot('01-title');
  await ev(() => window.__game.openCreator([0, 1], () => window.__game.goTitle()));
  await run(0.5);
  await shot('02-creator');
  for (let i = 0; i < 3; i++) { await ev(() => { const c = window.__game.scene; c.sel = 15; c.activate(); }); await run(1.2); await shot('03-random' + i); }
  await ev(() => { const c = window.__game.scene; c.setSlot(1); });
  await run(0.5);
  await shot('04-p2');
  // Helmet row, step to locked
  await ev(() => { const c = window.__game.scene; c.change(7, 1); c.change(7, 1); c.change(7, 1); });
  await run(0.3);
  await shot('05-locked');
} else if (scenario === 'map') {
  await ev(() => { const g = window.__game; g.save.heroMade = [true, true]; g.save.intro = true; g.twoP = true; g.input.solo = false; g.goMap(); });
  await run(1);
  await shot('10-map');
  await run(0.1, [], ['KeyD']); await run(2);
  await shot('11-map-road');
  console.log(await st());
  await ev(() => { const g = window.__game; g.save.completed = ['road', 'pit', 'swamp', 'mirror', 'frost']; g.goMap(); });
  await run(1);
  await shot('12-map-progress');
} else if (scenario === 'levels') {
  const ids = process.argv[5] ? process.argv[5].split(',') : ['road', 'swamp', 'frost', 'scorch', 'tower'];
  for (const id of ids) {
    await ev((id) => { const g = window.__game; g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true; const n = window.__nodes?.find?.(x => x.level === id); g.playLevel({ id, name: id, kind: 'level', level: id, biome: 'grass', pos: [0,0], requires: [], blurb: '' }); }, id);
    await run(1.0);
    await run(3, ['KeyD']);
    await run(2);
    await shot(`20-${id}-wave1`);
    console.log(id, JSON.stringify(await st()));
    // Hopp til sjef/duell
    await ev(() => { const s = window.__game.scene.stage; for (const f of s.foes) if (f.f.alive) f.f.die('explode', 1, null); s.waveIdx = s.level.waves.length; s.wave = null; s.lockX = null; s.camX = s.bossLock - 8; s.heroes.forEach(h => { h.f.pos.x = s.bossLock - 4; h.f.hp = 9999; h.f.maxHp = 9999; }); });
    await run(2, ['KeyD']);
    await run(3.5);
    console.log(id, JSON.stringify(await st()));
    await shot(`21-${id}-finale`);
    const s1 = await st();
    if (s1.stage?.boss) {
      // Kjemp litt mot sjefen
      for (let r = 0; r < 8; r++) {
        await ev(() => { const s = window.__game.scene.stage; s.heroes.forEach(h => { h.f.hp = 9999; }); const b = s.boss.f; const h = s.heroes[0].f; if (Math.abs(h.pos.x - b.pos.x) > 2.2) h.pos.x = b.pos.x - 2 * Math.sign(b.pos.x - h.pos.x || 1); h.pos.z = b.pos.z; h.facing = Math.sign(b.pos.x - h.pos.x) || 1; });
        await run(0.8, [], ['KeyF']);
        if (r === 3) await shot(`22-${id}-bossfight`);
      }
      console.log(id, 'after fight', JSON.stringify(await st()));
      await ev(() => { const s = window.__game.scene.stage; s.boss.f.hp = 1; s.boss.f.armored = true; });
      for (let r = 0; r < 6; r++) {
        await ev(() => { const s = window.__game.scene.stage; const b = s.boss.f; const h = s.heroes[0].f; h.hp = 9999; if (b.alive) { h.pos.x = b.pos.x - 1.8; h.pos.z = b.pos.z; h.facing = 1; } });
        await run(0.5, [], ['KeyF']);
        const s = await st();
        if (s.stage?.boss?.hp <= 0) break;
      }
      await run(0.4);
      await shot(`23-${id}-bossdead`);
      await run(6);
      console.log(id, 'end', JSON.stringify(await st()));
      await shot(`24-${id}-complete`);
    } else {
      await run(3, ['KeyD']);
      console.log(id, 'duel?', JSON.stringify(await st()));
      await run(5);
      await shot(`25-${id}-duel`);
    }
  }
} else if (scenario === 'arena') {
  await ev(() => { const g = window.__game; g.save.heroMade = [true, true]; g.twoP = true; g.input.solo = false; g.enterNode({ id: 'mirror', name: 'MIRROR', kind: 'arena', duel: 'darkyou', biome: 'swamp', pos: [0,0], requires: [], blurb: '' }); });
  await run(6);
  await shot('30-darkyou');
  console.log(await st());
  await ev(() => { const g = window.__game; g.enterNode({ id: 'bone', name: 'BONE', kind: 'arena', duel: 'bonejangles', biome: 'scorch', pos: [0,0], requires: [], blurb: '' }); });
  await run(6);
  await shot('31-bonejangles');
  console.log(await st());
}
console.log('LOGS:\n' + logs.slice(0, 40).join('\n'));
await browser.close();
