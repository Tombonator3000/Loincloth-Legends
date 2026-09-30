// Fiender på ridedyr skal kunne tas: med kameraet låst som under en bølge jager en enkel spillerbot rytteren (går mot
// ham og slår når han er nær). For hvert ridedyr måles hvor langt utenfor heltens rekkevidde dyret kommer etter at det
// har ridd inn i bildet, hvor fort det rygger unna helten, og hvor lang tid det tar å slå rytteren av og drepe ham.
// Tom (2026-09-30): "fiender som rir på ridedyr stikker bort fra spiller som aldri greier å nå igjen".
// Bruk: node tools/tests/riders.mjs http://localhost:4173/
import { chromium } from 'playwright';
const [url] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(600000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });

const res = {};
for (const [foe, mount] of [['skeleton', 'warhog'], ['frogman', 'cluckatrice'], ['fireimp', 'magmanewt']]) {
  for (const heroStart of ['left', 'right']) {
    res[mount + ' ' + heroStart] = await page.evaluate(({ foe, mount, heroStart }) => {
      const g = window.__game;
      g.twoP = false;
      g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      const s = g.scene.stage, inp = g.input;
      // Som under en bølge: kameraet står stille, og bare rytteren er med
      s.waveIdx = 99; s.wave = null; s.queue = [];
      for (const f of s.foes) f.f.remove?.();
      s.foes = [];
      s.camX = 30; s.lockX = 30;
      const h = s.heroes[0].f;
      h.hp = h.maxHp = 9999;
      h.pos.set(heroStart === 'left' ? 30 - s.halfW + 2 : 30 + s.halfW - 2, 0, 0);
      s.spawnRider(foe, mount);
      const m = s.mounts[s.mounts.length - 1], rider = m.rider;
      // Rir inn fra høyre. Står helten til høyre, må dyret forbi ham
      let entered = -1, knocked = -1, killed = -1, beyond = 0, retreatMax = 0, lastX = m.pos.x, attacks = 0, lastState = m.state;
      const N = 60 * 25;
      for (let i = 0; i < N; i++) {
        inp.keys.clear();
        const target = m.rider ?? (rider.alive ? rider : null);
        if (target && h.canAct?.() !== false) {
          const dx = target.pos.x - h.pos.x, dz = target.pos.z - h.pos.z;
          if (Math.abs(dx) > 1.3) inp.keys.add(dx > 0 ? 'KeyD' : 'KeyA');
          if (Math.abs(dz) > 0.25) inp.keys.add(dz > 0 ? 'KeyS' : 'KeyW');
          if (Math.abs(dx) < 1.3 && Math.sign(dx) !== h.facing) inp.keys.add(dx > 0 ? 'KeyD' : 'KeyA');
          if (Math.abs(dx) < 2.0 && Math.abs(dz) < 0.55 && i % 10 === 0) inp.tapped.add('KeyF');
        }
        g.tick(1 / 60, false);
        const edgeR = s.camX + s.halfW - 0.7, edgeL = s.camX - s.halfW + 0.7;
        if (entered < 0 && m.pos.x < edgeR && m.pos.x > edgeL) entered = i / 60;
        if (m.rider) {
          if (entered >= 0) beyond = Math.max(beyond, m.pos.x - edgeR, edgeL - m.pos.x);
          // Fart bort fra helten, mens dyret går (ikke stormløp), og ikke når de passerer hverandre
          const v = (m.pos.x - lastX) * 60;
          if ((m.state === 'walk' || m.state === 'idle') && Math.abs(m.pos.x - h.pos.x) > 1.2 && Math.sign(v) === Math.sign(m.pos.x - h.pos.x)) retreatMax = Math.max(retreatMax, Math.abs(v));
        }
        lastX = m.pos.x;
        if (m.state !== lastState && ['charge', 'tail', 'fire'].includes(m.state)) attacks++;
        lastState = m.state;
        if (knocked < 0 && !m.rider) knocked = i / 60;
        if (!rider.alive) { killed = i / 60; break; }
      }
      return { entered: +entered.toFixed(1), knocked: +knocked.toFixed(1), killed: +killed.toFixed(1), beyond: +beyond.toFixed(2), retreat: +retreatMax.toFixed(2), attacks, heroHp: 9999 - Math.round(h.hp) };
    }, { foe, mount, heroStart });
    console.log(mount.padEnd(12), heroStart.padEnd(6), JSON.stringify(res[mount + ' ' + heroStart]));
  }
}
const all = Object.values(res);
check('ridedyrene rir inn i bildet (eller blir slått av på vei inn)', all.every((r) => r.entered >= 0 || r.knocked >= 0), res);
check('etter at de har kommet inn, er ridedyrene aldri utenfor heltens rekkevidde', all.every((r) => r.beyond <= 0.05), Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.beyond])));
check('ridedyrene rygger saktere enn helten går (under 60 prosent av farten hans)', all.every((r) => r.retreat < 0.6 * 3.85), Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.retreat])));
check('helten slår rytteren av dyret innen 10 sekunder', all.every((r) => r.knocked >= 0 && r.knocked <= 10), Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.knocked])));
check('og dreper ham innen 25 sekunder, så bølgen kan bli ferdig', all.every((r) => r.killed >= 0), Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.killed])));
if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: ryttere kan tas');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
