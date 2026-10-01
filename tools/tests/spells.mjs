// Magien i et register (Tom 2026-10-01, data/spells.ts og game/spells.ts).
// 0) Registeret: sju trylleformler, gamle lagringer (0 til 2) gir de samme som før, og MAGIC-raden i Hero Forge viser
//    navnet og hva den gjør.
// 1) De tre gamle (meteor, skrik og torden) virker som før etter flyttingen ut av Stage.
// 2) MAGIC MISSILE OF ABSOLUTE CERTAINTY: én pil per fiende, én bommer (MISS!), snur og treffer likevel.
// 3) TURN UNDEAD (AND EVERYONE ELSE): skjeletter og zombier smuldrer, de levende blendes, heltene får litt liv.
// 4) GREASE OF THE OILY ONE: olje på veien, fiender sklir, ild tenner olja og brannen sprer seg.
// 5) POLYMORPH: CHICKEN: fiendene blir høner, ett slag sprenger dem i fjær, de blir seg selv igjen, og sjefen står imot.
// Bruk: node tools/tests/spells.mjs http://localhost:4173/ [./shots]
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
const shot = async (name, hideAnnounce = true) => {
  if (!out) return;
  await page.evaluate((hide) => { document.body.classList.toggle('t-noannounce', hide); window.__game.tick(1 / 60, true); }, hideAnnounce);
  await page.screenshot({ path: `${out}/${name}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: 'body.t-noannounce .announce{display:none!important}' });
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
});

// 0) Registeret og Hero Forge
const reg = await page.evaluate(() => {
  const L = window.__lib;
  const ids = L.SPELLS.map((s) => s.id);
  return { ids, labels: L.HERO_OPTIONS.magic, titles: L.SPELLS.map((s) => s.title) };
});
check('registeret har sju trylleformler i fast rekkefølge', reg.ids.join() === 'meteor,scream,thunder,missile,turn,grease,chicken', reg.ids);
check('MAGIC-raden i Hero Forge leser navnene fra registeret', reg.labels.length === 7 && reg.labels[3] === 'MAGIC MISSILE' && reg.labels[6] === 'POLYMORPH: CHICKEN', reg.labels);
await page.evaluate(() => {
  const g = window.__game;
  g.save = window.__lib.defaultSave();
  g.openCreator([0], () => g.goTitle());
  window.__run(0.3);
});
const row = (key) => page.locator(`.cr-row[data-key="${key}"]`);
// MAGIC MISSILE kan bare MAGIC-USER og ELF (klassene bestemmer magien)
for (let i = 0; i < 7 && !(await row('cls').locator('.v').innerText()).includes('MAGIC-USER'); i++) {
  await row('cls').locator('.arr.r').click();
  await page.evaluate(() => window.__run(0.05));
}
await row('magic').locator('.k').click();
const readForge = async () => ({ value: await row('magic').locator('.v').innerText(), info: await page.locator('.cr-info').innerText() });
let forge = await readForge();
for (let i = 0; i < 7 && !forge.value.includes('MAGIC MISSILE'); i++) {
  await row('magic').locator('.arr.r').click();
  await page.evaluate(() => window.__run(0.05));
  forge = await readForge();
}
check('MAGIC-raden kan stilles på MAGIC MISSILE, og infoboksen sier hva den gjør', forge.value.includes('MAGIC MISSILE') && forge.info.includes('MAGIC MISSILE OF ABSOLUTE CERTAINTY') && forge.info.includes('One misses'), forge);
await shot('s0-forge-magic', false);

// Brett 1 med en helt som kan få alle trylleformlene
const setup = async (spell) => page.evaluate((spell) => {
  const g = window.__game, L = window.__lib;
  // Klassen må kunne trylleformelen (data/classes.ts): den første som kan den
  g.save.heroes[0] = { ...L.PRESETS.thrugg, magic: L.spellIndex(spell), cls: L.CLASSES.findIndex((c) => c.spells.includes(spell)) };
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  window.__run(0.5);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null; s.queue = []; s.visionDone = true;
  s.camX = 20; s.hazards.length = 0;
  g.camera.position.x = 20;
  const h = s.heroes[0];
  h.f.hp = h.f.maxHp = 400;
  h.f.pos.set(15.5, 0, 0);
  window.__said = [];
  if (!g.fx.__wrapped) {
    g.fx.__wrapped = true;
    const orig = g.fx.text;
    g.fx.text = function (p, t, kind, ...rest) { window.__said.push(t); return orig.call(this, p, t, kind, ...rest); };
  }
  window.__run(1.2);
  s.camX = 20;
  return { magic: h.magic };
}, spell);
/** Fiender på faste plasser foran helten. Svarer indeksene i s.foes. */
const foes = (list) => page.evaluate((list) => {
  const s = window.__game.scene.stage;
  return list.map(([id, x, z]) => {
    const o = s.spawnFoe(id, 'R');
    o.f.pos.set(x, 0, z); o.entered = true; o.cd = 99; o.projCd = 99; o.hoverDz = 0;
    return s.foes.indexOf(o);
  });
}, list);
const cast = (potions) => page.evaluate((potions) => {
  const s = window.__game.scene.stage, h = s.heroes[0];
  h.potions = potions;
  window.__said.length = 0;
  s.castMagic(h);
  return { id: s.magic?.id, frozen: s.frozen, targets: s.magic?.targets.length };
}, potions);

// 1) De tre gamle virker som før
const old = {};
for (const id of ['meteor', 'scream', 'thunder']) {
  const info = await setup(id);
  await foes([['skeleton', 19, 0.5], ['cultist', 21, -0.8], ['hogman', 23, 0.6]]);
  const c = await cast(3);
  old[id] = await page.evaluate(() => {
    const s = window.__game.scene.stage;
    let t = 0;
    while (s.magic && t < 6) { window.__run(0.1); t += 0.1; }
    return { time: +t.toFixed(1), over: !s.magic, frozen: s.frozen, hurt: s.foes.filter((o) => !o.f.alive || o.f.hp < o.f.maxHp).length, hero: s.heroes[0].f.state };
  });
  old[id].magic = info.magic;
  old[id].cast = c;
}
check('meteor, skrik og torden kastes og skader alle tre', ['meteor', 'scream', 'thunder'].every((id) => old[id].magic === id && old[id].cast.id === id && old[id].cast.frozen && old[id].hurt === 3), old);
check('og kastet slutter: tida går igjen og helten står', ['meteor', 'scream', 'thunder'].every((id) => old[id].over && !old[id].frozen && old[id].hero === 'idle'), old);

// 2) MAGIC MISSILE OF ABSOLUTE CERTAINTY
await setup('missile');
await foes([['hogman', 19.5, 0.4], ['hogman', 21.5, -0.9], ['cultist', 23.5, 0.8], ['hogman', 25, -0.2]]);
await page.evaluate(() => { for (const o of window.__game.scene.stage.foes) o.f.hp = o.f.maxHp = 500; });
await cast(2);
const missile = await page.evaluate(() => {
  const s = window.__game.scene.stage, c = s.magic;
  window.__run(1.0);
  const darts = c.darts.length, missers = c.darts.filter((d) => d.miss).length;
  const hp0 = s.foes.map((o) => o.f.hp);
  let t = 0, missedAt = -1, seen = 0;
  while (s.magic && t < 8) {
    window.__run(0.05); t += 0.05;
    seen = Math.max(seen, c.darts.filter((d) => !d.done && d.mesh.visible).length);
    if (missedAt < 0 && c.darts.some((d) => d.miss && d.missed >= 0)) missedAt = +t.toFixed(2);
  }
  const misser = c.darts.find((d) => d.miss);
  return {
    darts, missers, seen, missedAt, over: !s.magic,
    hit: s.foes.filter((o) => o.f.hp < 500).length, said: [...window.__said],
    misserHit: misser ? misser.done && misser.missed >= 0 && misser.tgt.hp < 500 : false, hp0,
  };
});
check('én lysende pil per fiende, og nøyaktig én av dem skal bomme', missile.darts === 4 && missile.missers === 1, missile);
check('pila som bommer, sier MISS! og flyr forbi', missile.missedAt > 0 && missile.said.some((t) => t === 'MISS!' || t === 'MISSED!'), missile);
check('den snur og treffer likevel (ABSOLUTE CERTAINTY)', missile.misserHit && missile.said.some((t) => ['ABSOLUTELY CERTAIN!', 'IT CAME BACK!', 'NO ESCAPE!', 'GUARANTEED!'].includes(t)), missile);
check('alle fire fiendene er truffet, og kastet er over', missile.hit === 4 && missile.over, missile);
// Bilde midt i flyturen
await setup('missile');
await foes([['hogman', 19.5, 0.4], ['skeleton', 21.5, -0.9], ['cultist', 23.5, 0.8], ['hogman', 25, -0.2]]);
await page.evaluate(() => { for (const o of window.__game.scene.stage.foes) o.f.hp = o.f.maxHp = 500; });
await cast(2);
await page.evaluate(() => window.__run(1.05));
await shot('s1-missile');

// 3) TURN UNDEAD (AND EVERYONE ELSE)
await setup('turn');
await foes([['skeleton', 19.5, 0.4], ['frostskel', 21, -0.9], ['zombie', 22.5, 0.6], ['cultist', 24, -0.3], ['hogman', 25.5, 0.9]]);
await page.evaluate(() => { const h = window.__game.scene.stage.heroes[0].f; h.hp = 100; });
await cast(2);
const turn = await page.evaluate(() => {
  const s = window.__game.scene.stage, L = window.__lib;
  window.__run(1.6);
  const f = s.foes.map((o) => ({ id: o.def.id, alive: o.f.alive, style: o.f.deathStyle, sink: o.f.sinkRate, state: o.f.state, blind: +o.f.blindT.toFixed(2) }));
  return { foes: f, hp: s.heroes[0].f.hp, heal: L.SPELL.turn.heal + L.SPELL.turn.healPer * 2, said: [...window.__said], magic: !!s.magic };
});
const undead = turn.foes.filter((f) => ['skeleton', 'frostskel', 'zombie'].includes(f.id));
const living = turn.foes.filter((f) => ['cultist', 'hogman'].includes(f.id));
check('skjelettene smuldrer (faller fra hverandre), zombien synker i en støvsky', undead.every((f) => !f.alive) && undead.filter((f) => f.id !== 'zombie').every((f) => f.style === 'shatter') && undead.find((f) => f.id === 'zombie').sink > 0 && undead.find((f) => f.id === 'zombie').style === 'normal', turn.foes);
check('de levende blir blendet og holder seg for øynene, men lever', living.every((f) => f.alive && f.state === 'stunned' && f.blind > 1), turn.foes);
check('heltene får litt liv', turn.hp >= 100 + turn.heal - 0.01, { hp: turn.hp, heal: turn.heal });
check('MY EYES! og de andre ordene', turn.said.some((t) => ['MY EYES!', 'TOO BRIGHT!', 'I CANNOT SEE!', 'WHO TURNED ON THE SUN?'].includes(t)), turn.said);
await shot('s2-turn-undead');
await shot('s2b-turn-title', false);
const turnOver = await page.evaluate(() => { const s = window.__game.scene.stage; window.__run(1.5); return { magic: !!s.magic, frozen: s.frozen }; });
check('og kastet er over', !turnOver.magic && !turnOver.frozen, turnOver);

// 4) GREASE OF THE OILY ONE
await setup('grease');
await foes([['skeleton', 19.5, 0.4], ['hogman', 22, -1.1], ['cultist', 24.5, 1.0]]);
await cast(2);
const grease = await page.evaluate(() => {
  const s = window.__game.scene.stage, sp = s.spells;
  let t = 0;
  while (s.magic && t < 5) { window.__run(0.05); t += 0.05; }
  window.__run(0.4);
  // Alle står i olje
  const under = s.foes.map((o) => sp.oil.some((p) => Math.hypot(o.f.pos.x - p.x, (o.f.pos.z - p.z) / 0.75) < p.r));
  return { over: !s.magic, oil: sp.oil.length, under, life: sp.oil[0]?.life };
});
check('olja faller over hele veien i bildet og under hver fiende', grease.over && grease.oil >= 8 && grease.under.every(Boolean), grease);
await shot('s3-grease');
// En fiende som går i olja, sklir
// (fiendene går mot helten når kastet er over, så de har kanskje alt sklidd en gang)
const slip = await page.evaluate(() => {
  const s = window.__game.scene.stage, L = window.__lib;
  let downs = 0, prev = s.foes.map((o) => o.f.state);
  for (let i = 0; i < 150; i++) {
    window.__run(1 / 60);
    s.foes.forEach((o, k) => { if (o.f.state === 'down' && prev[k] !== 'down' && o.f.data.oilSlipT) downs++; prev[k] = o.f.state; });
  }
  return { downs, said: [...window.__said].filter((t) => L.SPELL_LINES.slip.includes(t)), slipped: s.foes.filter((o) => o.f.data.oilSlipT).length };
});
check('fiender som går i olja, sklir og går på trynet (SLIP!)', slip.slipped >= 2 && slip.said.includes('SLIP!'), slip);
// Ild i olja: en brennende fiende står i en pytt, olja tar fyr, og brannen sprer seg til naboene
const fire = await page.evaluate(() => {
  const s = window.__game.scene.stage, sp = s.spells;
  window.__said.length = 0;
  // Grisemannen står midt i en pytt og tar fyr
  const o = s.foes[1], f = o.f;
  const pool = sp.oil.slice().sort((a, b) => Math.abs(a.x - 21) - Math.abs(b.x - 21))[0];
  f.pos.set(pool.x, 0, pool.z); f.vel.set(0, 0, 0); f.onGround = true; f.setState('idle');
  s.ignite(f, 3);
  window.__run(0.15);
  const first = sp.oil.filter((p) => p.burnT > 0).length;
  // Skjelettet går inn i den brennende pytten
  const sk = s.foes[0].f;
  sk.pos.set(pool.x + 0.3, 0, pool.z); sk.vel.set(0, 0, 0); sk.onGround = true; sk.setState('idle');
  window.__run(0.2);
  const skBurn = sk.burnT > 0;
  window.__run(1.0);
  const later = sp.oil.filter((p) => p.burnT > 0).length;
  return { first, later, said: [...window.__said], skBurn };
});
check('noe som brenner, tenner olja (GREASE FIRE!)', fire.first >= 1 && fire.said.some((t) => ['GREASE FIRE!', 'FWOOMP!', 'THAT ESCALATED!'].includes(t)), fire);
check('brannen sprer seg til pyttene som henger sammen', fire.later > fire.first, fire);
check('og den som går inn i den brennende olja, tar fyr', fire.skBurn, fire);
await shot('s4-grease-fire');
const burnt = await page.evaluate(() => {
  const s = window.__game.scene.stage, sp = s.spells;
  window.__run(7);
  const scorched = sp.oil.filter((p) => p.burnt).length;
  window.__run(18);
  return { scorched, left: sp.oil.length };
});
check('olja brenner ut, blir svidd og er borte etter en stund', burnt.scorched >= 1 && burnt.left === 0, burnt);
// Ildimpen som smeller, tenner olja også
const imp = await page.evaluate(() => {
  const s = window.__game.scene.stage, sp = s.spells;
  const p = sp.addOil(21, 0, 1.4);
  window.__run(0.5);
  const o = s.spawnFoe('fireimp', 'R');
  o.f.pos.set(21.3, 0, 0.2); o.entered = true;
  window.__run(0.05);
  o.f.die('normal', 1, s.heroes[0].f);
  window.__run(0.1);
  return { burning: p.burnT > 0 };
});
check('ildimpen som smeller, tenner olja', imp.burning, imp);

// 5) POLYMORPH: CHICKEN
await setup('chicken');
await foes([['skeleton', 19.5, 0.4], ['hogman', 21.5, -0.9], ['cultist', 23.5, 0.8], ['bigtroll', 26, -0.4]]);
await cast(2);
const poly = await page.evaluate(() => {
  const s = window.__game.scene.stage;
  const before = s.foes.map((o) => ({ cid: o.f.cid, size: o.f.size }));
  let t = 0;
  while (s.magic && t < 5) { window.__run(0.1); t += 0.1; }
  const after = s.foes.map((o) => ({ cid: o.f.cid, chicken: !!o.chicken, size: +o.f.size.toFixed(2), alive: o.f.alive, orig: o.chicken?.orig.cid }));
  // Veien hver høne har løpt (summen av skrittene, de snur hele tiden)
  const moved = s.foes.map(() => 0);
  let last = s.foes.map((o) => o.f.pos.clone());
  window.__run(1.5, () => {
    s.foes.forEach((o, i) => { moved[i] += Math.hypot(o.f.pos.x - last[i].x, o.f.pos.z - last[i].z); last[i].copy(o.f.pos); });
  });
  return { before, after, moved, said: [...window.__said], over: !s.magic };
});
check('fiendene blir høner (og kjempetrollet en kjempehøne)', poly.after.every((f) => f.cid === 'chicken' && f.chicken && f.alive) && poly.after[3].size > poly.after[0].size * 1.5, poly);
check('BAWK!, og hønene løper i panikk', poly.said.some((t) => ['BAWK!', 'BAWK BAWK!', 'CLUCK?!', 'BUKAAAWK!'].includes(t)) && poly.moved.filter((d) => d > 2.5).length >= 3, poly);
await shot('s5-chickens');
const pop = await page.evaluate(() => {
  const s = window.__game.scene.stage, L = window.__lib, sp = s.spells;
  window.__said.length = 0;
  const o = s.foes[1], h = s.heroes[0].f;
  const n0 = sp.feathers.count;
  L.applyHit(h, o.f, L.HERO_ATK.slash1);
  window.__run(0.45);
  return { dead: !o.f.alive, style: o.f.deathStyle, feathers: sp.feathers.count - n0, said: [...window.__said], chicken: !!o.chicken };
});
check('ett lett slag, og høna sprenges i fjær', pop.dead && pop.style === 'explode' && pop.feathers >= 20 && pop.said.some((t) => ['POP!', 'NUGGETS!', 'POULTRY!', 'FEATHERS EVERYWHERE!'].includes(t)), pop);
await shot('s6-feathers');
const back = await page.evaluate(() => {
  const s = window.__game.scene.stage;
  window.__said.length = 0;
  const o = s.foes[2];
  const cid = o.chicken.orig.cid;
  o.chicken.t = 0.05;
  window.__run(1.0);
  return { cid: o.f.cid, want: cid, chicken: !!o.chicken, alive: o.f.alive, onScene: !!o.f.rig.root.parent, said: [...window.__said] };
});
check('når tida er ute, blir høna seg selv igjen (WHY DO I CRAVE CORN?)', back.cid === back.want && !back.chicken && back.alive && back.onScene && back.said.some((t) => ['...WHAT HAPPENED?', 'WHY DO I CRAVE CORN?', 'I HAD THE STRANGEST DREAM.'].includes(t)), back);
// Sjefen står imot
const boss = await page.evaluate(() => {
  const g = window.__game, L = window.__lib;
  g.save.heroes[0] = { ...L.PRESETS.thrugg, magic: L.spellIndex('chicken'), cls: L.classIndex('mage') };
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  window.__run(1);
  const s = g.scene.stage;
  for (const f of s.foes) if (f.f.alive) f.f.die('normal', 1, null);
  s.waveIdx = s.level.waves.length; s.wave = null; s.lockX = null; s.visionDone = true;
  const h = s.heroes[0];
  h.f.hp = h.f.maxHp = 9999;
  s.camX = s.bossLock; g.camera.position.x = s.camX;
  h.f.pos.set(s.bossLock - 2, 0, 0);
  window.__run(0.2);
  const b = s.boss;
  if (b.mode === 'intro') { b.mode = 'think'; b.f.pos.set(s.bossLock + 2.5, 0, 0); }
  b.thinkT = 99;
  const o = s.spawnFoe('skeleton', 'R');
  o.f.pos.set(s.bossLock + 1, 0, 1); o.entered = true;
  window.__run(0.1);
  window.__said.length = 0;
  h.potions = 2;
  s.castMagic(h);
  let t = 0;
  while (s.magic && t < 5) { window.__run(0.1); t += 0.1; }
  return { boss: b.f.cid, alive: b.f.alive, foe: o.f.cid, said: [...window.__said] };
});
check('sjefen står imot: THE BOSS SAVED VS. POLYMORPH', boss.boss !== 'chicken' && boss.alive && boss.foe === 'chicken' && boss.said.includes('THE BOSS SAVED VS. POLYMORPH'), boss);

check('ingen feil i konsollen', logs.length === 0, logs.slice(0, 5));
console.log(fails.length ? '\nFEIL: ' + fails.join(' | ') : '\nALT OK');
await browser.close();
process.exit(fails.length ? 1 : 0);
