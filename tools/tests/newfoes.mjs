// Runde E: de nye fiendetypene og ridedyrene (docs/PLAN_BRETT_GORR_AI.md 6.4 punkt 2 og 7).
// - Bueskytteren holder avstand og skyter piler langs linja, men løper unna når helten kommer nær.
// - Froskemannen i bakhold er usynlig i buskene bak veien, hopper ut og slår helten ned, og er på veien etterpå.
// - Griperen blinker rødt før grepet, holder helten for vennene sine og slipper etter en stund (raskere når helten
//   hamrer på angrep). Et slag i opptrekket stopper grepet.
// - Berserkeren blir raskere og tåler mer når livet er lavt.
// - Kapteinen blir bak, blåser i hornet etter forsterkninger og roper ordre. Når han dør, flykter troppene.
// - Fiender løper til ledige ridedyr, også det helten nettopp gikk av. Spesialangrepet til dyret koster utholdenhet.
// Bruk: node tools/tests/newfoes.mjs http://localhost:4173/ ./shots
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
const shot = async (name) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/${name}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => {
    for (let i = 0; i < Math.round(sec * 60); i++) {
      if (each?.(i) === true) return i / 60;
      window.__game.tick(1 / 60, false);
    }
    return sec;
  };
  // Et brett uten bølger, med en tom bølge som holder kameraet (budsjettet og ridedyrene trenger en bølge)
  window.__play = (x = 20) => {
    const g = window.__game;
    g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
    g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
    window.__run(0.5);
    const s = g.scene.stage;
    s.waveIdx = 999; s.visionDone = true;
    s.wave = { at: x, maxAlive: 6, spawns: [] }; s.queue = []; s.waveCap = 6; s.lockX = x;
    s.camX = x;
    const h = s.heroes[0].f;
    h.hp = h.maxHp = 9999;
    h.pos.set(x - 2, 0, 0);
    return s;
  };
  window.__spawn = (s, id, x, z, side = 'R') => {
    const o = s.spawnFoe(id, side);
    if (side !== 'B') { o.f.pos.set(x, 0, z); o.entered = true; }
    return o;
  };
});

// 1) Bueskytteren
const archer = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  const o = window.__spawn(s, 'goblinarcher', h.pos.x + 6, 1.4);
  o.projCd = 0.8;
  let arrows = 0, minD = 99, alignedAt = null;
  const seen = new Set();
  window.__run(5, () => {
    h.hp = Math.max(h.hp, 9000);
    for (const p of s.proj.list) if (p.kind === 'arrow' && !seen.has(p)) { seen.add(p); arrows++; if (alignedAt === null) alignedAt = +(o.f.pos.z - h.pos.z).toFixed(2); }
    minD = Math.min(minD, Math.abs(o.f.pos.x - h.pos.x));
  });
  const hpAfter = h.hp;
  // Helten går helt inntil: han løper unna (vent til han er ferdig med et skudd, han kan ikke løpe midt i det)
  o.projCd = 99;
  window.__run(1.5, () => { h.hp = Math.max(h.hp, 9000); return o.f.state !== 'attack' && o.f.canAct(); });
  h.pos.set(o.f.pos.x - 1.8 * Math.sign(o.f.pos.x - h.pos.x || 1), 0, o.f.pos.z);
  const d0 = Math.abs(o.f.pos.x - h.pos.x);
  window.__run(0.5);
  const d1 = Math.abs(o.f.pos.x - h.pos.x);
  return { arrows, minD: +minD.toFixed(2), alignedAt, hit: hpAfter < 9999, bow: !!o.f.rig.g.armF.children.find((c) => c.type === 'Group'), fled: +(d1 - d0).toFixed(2) };
});
check('bueskytteren skyter piler og holder avstand', archer.arrows >= 1 && archer.minD > 3.5, archer);
check('pila går langs linja og treffer helten som står i den', archer.alignedAt !== null && Math.abs(archer.alignedAt) < 0.45 && archer.hit, archer);
check('på nært hold løper han unna i full fart', archer.fled > 0.9, archer);
check('bueskytteren har en bue i hånda', archer.bow, archer);
await shot('n1-archer');

// 2) Froskemannen i bakhold
const ambush = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  const o = s.spawnFoe('ambushfrog', 'B');
  window.__run(0.05);
  const hidden = { hidden: o.f.hidden, visible: o.f.rig.root.visible, shadow: o.f.shadow.visible, z: +o.f.pos.z.toFixed(2), dx: +Math.abs(o.f.pos.x - h.pos.x).toFixed(2) };
  let out = null, landed = null, down = false;
  const t = window.__run(4, (i) => {
    h.hp = Math.max(h.hp, 9000);
    if (out === null && !o.f.hidden) out = +(i / 60).toFixed(2);
    if (h.state === 'down') down = true;
    if (out !== null && landed === null && !o.ambushing) landed = { t: +(i / 60).toFixed(2), z: +o.f.pos.z.toFixed(2) };
  });
  return { hidden, out, landed, down, t };
});
check('i bakhold: usynlig, uten skygge, bak veien og et stykke unna helten', ambush.hidden.hidden && !ambush.hidden.visible && !ambush.hidden.shadow && ambush.hidden.z < -4 && ambush.hidden.dx >= 2.4, ambush);
check('han hopper ut av buskene etter litt over ett sekund', ambush.out !== null && ambush.out >= 0.9 && ambush.out <= 1.6, ambush);
check('han slår helten ned fra lufta og lander på veien', ambush.down && ambush.landed && ambush.landed.z >= -2.61, ambush);

// 3) Griperen
const grab = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  const o = window.__spawn(s, 'grabber', h.pos.x + 4, 0);
  o.cd = 0; o.grabCd = 0;
  const red = () => { const c = o.f.rig.mats[0].uniforms.flashColor.value; return c.r > 0.9 && c.g < 0.2; };
  let redSeen = false, heldAt = null;
  // Griperen slår av og til vanlig i stedet for å gripe (to av ti), så det kan ta noen forsøk
  window.__run(15, (i) => {
    h.hp = Math.max(h.hp, 9000);
    if (o.f.state === 'attack' && o.f.atk?.grab && red()) redSeen = true;
    if (h.state === 'held') { heldAt = i / 60; return true; }
    if (o.f.state !== 'attack') { o.cd = 0; o.grabCd = 0; }
  });
  const held = h.state === 'held' && h.heldBy === o.f;
  const hp0 = h.hp;
  // Holder uten at helten gjør noe: slipper etter 1,8 sekunder, uten å kaste ham
  const free = window.__run(3, () => h.state !== 'held');
  const tossed = h.hp < hp0 - 6;
  const whiteAfter = !red();
  return { redSeen, held, heldAt, free: +free.toFixed(2), tossed, whiteAfter, holds: !!o.f.data.holds };
});
check('griperen blinker rødt før grepet', grab.redSeen, grab);
check('griperen holder helten', grab.held && grab.holds, grab);
check('han slipper etter 1,8 sekunder uten å kaste helten', Math.abs(grab.free - 1.8) < 0.2 && !grab.tossed && grab.whiteAfter, grab);

const struggle = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f, inp = window.__game.input;
  const o = window.__spawn(s, 'grabber', h.pos.x + 1.3, 0);
  o.cd = 0; o.grabCd = 0;
  window.__run(8, () => { h.hp = Math.max(h.hp, 9000); if (h.state === 'held') return true; if (o.f.state !== 'attack') { o.cd = 0; o.grabCd = 0; } });
  if (h.state !== 'held') return { held: false };
  // Helten hamrer på angrep: kommer seg løs fortere
  const free = window.__run(3, (i) => { if (i % 6 === 0) inp.tapped.add('KeyF'); return h.state !== 'held'; });
  return { held: true, free: +free.toFixed(2) };
});
check('å hamre på angrep vrir helten løs fortere', struggle.held && struggle.free < 1.3, struggle);

const interrupt = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  const o = window.__spawn(s, 'grabber', h.pos.x + 1.3, 0);
  o.cd = 0; o.grabCd = 0;
  let hit = false;
  window.__run(8, () => {
    h.hp = Math.max(h.hp, 9000);
    if (o.f.state === 'attack' && o.f.atk?.grab && o.f.st > 0.2) {
      window.__lib.applyHit(h, o.f, window.__lib.HERO_ATK.slash1);
      hit = true;
      return true;
    }
    if (o.f.state !== 'attack') { o.cd = 0; o.grabCd = 0; }
  });
  window.__run(1.2);
  const c = o.f.rig.mats[0].uniforms.flashColor.value;
  return { hit, held: h.state === 'held', white: c.g > 0.9 };
});
check('et slag i opptrekket stopper grepet', interrupt.hit && !interrupt.held && interrupt.white, interrupt);

// 4) Berserkeren
const rage = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  const o = window.__spawn(s, 'berserker', h.pos.x + 4, 0);
  window.__run(0.2);
  const before = { speed: o.f.speed, dmgTaken: o.f.dmgTaken, enraged: o.enraged };
  o.f.hp = o.f.maxHp * 0.35;
  window.__run(0.2);
  const after = { speed: o.f.speed, dmgTaken: o.f.dmgTaken, enraged: o.enraged, panic: o.panic(2, true) };
  return { before, after, ratio: +(after.speed / before.speed).toFixed(2) };
});
check('berserkeren går berserk under 40 prosent: raskere og tåler mer, og får ikke panikk', !rage.before.enraged && rage.after.enraged && rage.ratio === 1.5 && rage.after.dmgTaken < rage.before.dmgTaken && rage.after.panic === false, rage);

// 5) Kapteinen
const captain = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  const c = window.__spawn(s, 'captain', h.pos.x + 5, 0.5);
  window.__spawn(s, 'skeleton', h.pos.x + 2, -0.5);
  window.__spawn(s, 'skeleton', h.pos.x + 2.5, 1);
  const start = s.foes.length;
  let rally = false, minD = 99, horn = false;
  window.__run(9, () => {
    h.hp = Math.max(h.hp, 9000);
    if (s.foes.some((o) => o !== c && o.rallyT > 0)) rally = true;
    if (c.f.atk?.id === 'horn') horn = true;
    minD = Math.min(minD, Math.abs(c.f.pos.x - h.pos.x));
  });
  const added = s.foes.length - start;
  const rankOk = s.aliveRank() <= s.waveCap;
  // Kapteinen dør: troppene flykter
  c.f.die('normal', 1, h);
  window.__run(0.1);
  const rest = s.foes.filter((o) => o !== c && o.f.alive);
  return { horn, added, hornsLeft: c.hornsLeft, rally, minD: +minD.toFixed(2), rankOk, panicked: rest.filter((o) => o.panicT > 0).length, rest: rest.length };
});
check('kapteinen blåser i hornet, og forsterkningene holder seg innenfor budsjettet', captain.horn && captain.added >= 1 && captain.added <= 4 && captain.hornsLeft < 3 && captain.rankOk, captain);
check('han roper ordre: troppene angriper oftere', captain.rally, captain);
check('han holder seg bak (aldri helt inntil helten)', captain.minD > 2.5, captain);
check('når kapteinen dør, flykter troppene', captain.rest > 0 && captain.panicked === captain.rest, captain);
await shot('n2-captain');

// 6) Ridedyr: fiender løper til ledige dyr, også det helten nettopp gikk av
const claim = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  s.spawnRider('skeleton', 'warhog');
  const m = s.mounts[0];
  const rider = m.rider;
  m.dismount(false);
  rider.die('normal', 1, h);
  m.pos.set(h.pos.x + 1, 0, 0); m.facing = 1; m.state = 'idle';
  // Helten sitter opp og går av igjen
  m.mountUp(h);
  window.__run(0.5);
  m.dismount(false);
  // Bølgen tok slutt da rytteren døde (ingen fiender igjen): en ny bølge, så fienden har noe å gjøre
  s.wave = { at: s.camX, maxAlive: 6, spawns: [] }; s.queue = []; s.lockX = s.camX;
  const foe = window.__spawn(s, 'skeleton', h.pos.x + 6, 1.5);
  let mountedAt = null;
  window.__run(6, (i) => { h.hp = Math.max(h.hp, 9000); if (foe.f.mount === m) { mountedAt = i / 60; return true; } });
  return { mountedAt, claimed: s.claims.size };
});
check('en fiende løper til dyret helten gikk av, og sitter opp', claim.mountedAt !== null && claim.mountedAt >= 1.5, claim);

// 7) Utholdenhet: spesialangrepet koster utholdenhet, og dyret blir andpustent
const stamina = await page.evaluate(() => {
  const s = window.__play(), h = s.heroes[0].f;
  s.spawnRider('skeleton', 'warhog');
  const m = s.mounts[0];
  const rider = m.rider;
  m.dismount(false);
  rider.die('normal', 1, h);
  m.pos.set(h.pos.x + 1, 0, 0); m.state = 'idle';
  m.mountUp(h);
  const seen = [];
  for (let i = 0; i < 3; i++) {
    m.state = 'idle'; m.cd = 0;
    m.attack();
    seen.push({ state: m.state, stamina: +m.stamina.toFixed(2) });
  }
  m.state = 'idle';
  window.__run(0.1);
  const bar = !!m.bar?.visible;
  window.__run(2.5);
  return { seen, bar, after: +m.stamina.toFixed(2) };
});
check('to angrep koster utholdenhet, det tredje blir avvist (WINDED)', stamina.seen[0].state === 'charge' && stamina.seen[1].state === 'charge' && stamina.seen[2].state === 'idle' && stamina.seen[1].stamina < 0.34, stamina);
check('linja over dyret viser utholdenheten, og den fylles opp igjen', stamina.bar && stamina.after > stamina.seen[2].stamina + 0.3, stamina);

// 8) Brettene bruker de nye fiendene
const levels = await page.evaluate(() => {
  const L = window.__lib.LEVELS;
  const ids = (id) => L[id].waves.flatMap((w) => w.spawns.map((s) => s.foe + ':' + s.side));
  return { road: ids('road'), jungle: ids('jungle'), swamp: ids('swamp'), scorch: ids('scorch'), tower: ids('tower') };
});
// 9) Nærbilder (bare med mappe for skjermbilder): buen spent, hornet, grepet bakfra, hoppet ut av buskene, raseriet og
// utholdenhetslinja over dyret
if (out) {
  await page.addStyleTag({ content: '.announce{display:none!important}' });
  const pose = (fn) => page.evaluate(fn);
  await pose(() => {
    const s = window.__play(), h = s.heroes[0].f;
    h.pos.set(18, 0, 0.6);
    const o = window.__spawn(s, 'goblinarcher', 22.5, 0.6);
    o.projCd = 0.2;
    window.__run(3, () => { h.hp = 9999; h.pos.set(18, 0, 0.6); return o.f.atk?.id.startsWith('bow') && o.f.st > 0.45; });
  });
  await shot('n3-bow');
  await pose(() => {
    const s = window.__play(), h = s.heroes[0].f;
    const o = window.__spawn(s, 'grabber', h.pos.x + 3, 0);
    o.cd = 0; o.grabCd = 0;
    window.__run(8, () => { h.hp = 9999; if (o.f.state !== 'attack') { o.cd = 0; o.grabCd = 0; } return h.state === 'held'; });
    window.__run(0.3, () => { h.hp = 9999; });
  });
  await shot('n4-hug');
  await pose(() => {
    const s = window.__play(), h = s.heroes[0].f;
    const o = s.spawnFoe('ambushfrog', 'B');
    window.__run(3, () => { h.hp = 9999; return !o.f.hidden && o.f.pos.z > -2.6 && o.f.pos.y > 1; });
  });
  await shot('n5-ambush');
  await pose(() => {
    const s = window.__play(), h = s.heroes[0].f;
    const c = window.__spawn(s, 'captain', h.pos.x + 4.5, 0.4);
    window.__spawn(s, 'skeleton', h.pos.x + 2, -0.8).cd = 99;
    const b = window.__spawn(s, 'berserker', h.pos.x + 2.4, 1.2);
    b.f.hp = b.f.maxHp * 0.3; b.cd = 99;
    window.__run(6, () => { h.hp = 9999; b.cd = 99; return c.f.atk?.id === 'horn' && c.f.st > 0.45; });
  });
  await shot('n6-horn-rage');
  await pose(() => {
    const s = window.__play(), h = s.heroes[0].f;
    s.spawnRider('skeleton', 'warhog');
    const m = s.mounts[0];
    const r = m.rider;
    m.dismount(false);
    r.die('normal', 1, h);
    m.pos.set(h.pos.x + 1, 0, 0); m.state = 'idle';
    m.mountUp(h);
    for (let i = 0; i < 2; i++) { m.state = 'idle'; m.cd = 0; m.attack(); }
    m.state = 'idle';
    window.__run(0.4, () => { h.hp = 9999; });
  });
  await shot('n7-stamina');
}

check('brettene har de nye fiendene', levels.road.includes('captain:L') && levels.jungle.includes('ambushfrog:B') && levels.jungle.some((x) => x.startsWith('goblinarcher')) && levels.swamp.includes('ambushfrog:B') && levels.scorch.some((x) => x.startsWith('grabber')) && levels.scorch.some((x) => x.startsWith('berserker')) && levels.tower.some((x) => x.startsWith('captain')), levels);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: de nye fiendene og ridedyrene virker');
