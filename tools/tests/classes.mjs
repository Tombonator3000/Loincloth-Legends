// Klassene i Hero Forge (Tom 2026-10-01, data/classes.ts og game/classes.ts).
// 0) Registeret: sju klasser i fast rekkefølge, gamle lagringer blir FIGHTER, og lagringen holder klasse og terninger.
// 1) Hero Forge: CLASS-raden setter våpen og magi, klasser med eget utstyr har ikke noe våpen å velge, MAGIC-raden
//    blar bare i klassens magi, ELF IS A CLASS. DO NOT ASK., dvergen er lav og bred, og ROLL 3D6 med spillederen.
// 2) På brettet: egenskapene (liv, fart, krukker, magi), presten helbreder partneren, tyven stikker bakfra og stjeler,
//    alven skyter langs linja, barden fyller METAL-måleren dobbelt så fort.
// 3) Terningene: NATURAL 20 gir dobbel skade, CRITICAL FUMBLE legger helten i bakken, og spillederen sukker.
// Bruk: node tools/tests/classes.mjs http://localhost:4173/ [./shots]
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
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
});

// 0) Registeret og lagringen
const reg = await page.evaluate(() => {
  const L = window.__lib;
  const ids = L.CLASSES.map((c) => c.id);
  // En gammel lagring uten klasse, og en med tyv, terninger og en magi tyven ikke kan
  const old = { name: 'OLDIE', body: 0, skin: 1, face: 0, hair: 1, hairColor: 0, beard: 1, helmet: 1, torso: 1, pelvis: 0, boots: 0, weapon: 1, cloth: 0, magic: 2 };
  const thief = { ...old, name: 'SNEAKY', cls: L.classIndex('thief'), magic: L.spellIndex('missile'), abilities: [12, 9, 14, 17, 8, 3] };
  const bad = { ...old, name: 'CHEATER', cls: 99, abilities: [19, 2, 'x'] };
  localStorage.setItem('loincloth-legends-save-v1', JSON.stringify({ ...L.defaultSave(), heroes: [old, thief] }));
  const a = L.loadSave();
  localStorage.setItem('loincloth-legends-save-v1', JSON.stringify({ ...L.defaultSave(), heroes: [bad, old] }));
  const b = L.loadSave();
  localStorage.clear();
  return {
    ids, labels: L.HERO_OPTIONS.cls,
    old: { cls: a.heroes[0].cls ?? 0, magic: a.heroes[0].magic, weapon: a.heroes[0].weapon },
    thief: { cls: a.heroes[1].cls, magic: L.SPELLS[a.heroes[1].magic].id, abilities: a.heroes[1].abilities },
    bad: { cls: b.heroes[0].cls ?? 0, abilities: b.heroes[0].abilities ?? null },
  };
});
check('sju klasser i fast rekkefølge', reg.ids.join() === 'fighter,cleric,thief,mage,elf,dwarf,bard' && reg.labels.includes('MAGIC-USER'), reg);
check('en gammel lagring uten klasse blir FIGHTER med samme våpen og magi', reg.old.cls === 0 && reg.old.magic === 2 && reg.old.weapon === 1, reg.old);
check('lagringen holder klassen og terningene, og magi klassen ikke kan, blir klassens', reg.thief.cls === 2 && reg.thief.magic === 'grease' && reg.thief.abilities?.join() === '12,9,14,17,8,3', reg.thief);
check('ugyldig klasse og terningkast forkastes', reg.bad.cls === 0 && reg.bad.abilities === null, reg.bad);

// 1) Hero Forge
await page.evaluate(() => {
  const g = window.__game;
  g.save = window.__lib.defaultSave();
  g.openCreator([0], () => g.goTitle());
  window.__run(0.3);
});
const row = (key) => page.locator(`.cr-row[data-key="${key}"]`);
const value = (key) => row(key).locator('.v').innerText();
const info = () => page.locator('.cr-info').innerText();
const setClass = async (label) => {
  await row('cls').locator('.k').click();
  for (let i = 0; i < 8 && (await value('cls')) !== label; i++) {
    await row('cls').locator('.arr.r').click();
    await page.evaluate(() => window.__run(0.05));
  }
  return value('cls');
};
const forge = {};
for (const label of ['FIGHTER', 'CLERIC', 'THIEF', 'MAGIC-USER', 'ELF', 'DWARF', 'BARD']) {
  const got = await setClass(label);
  const st = await page.evaluate(() => {
    const s = window.__game.scene, cfg = s.cfgs[s.slot], L = window.__lib;
    const sc = s.preview.rig.root.scale;
    return { weapon: L.heroWeapon(cfg).id, magic: L.SPELLS[cfg.magic].id, sx: Math.abs(sc.x), sy: sc.y, pool: !document.querySelector('.cr-pool')?.hidden };
  });
  forge[label] = { got, weaponRow: await value('weapon'), info: await info(), ...st };
  // MAGIC-raden blar bare i klassens magi
  const seen = new Set();
  await row('magic').locator('.k').click();
  for (let i = 0; i < 6; i++) {
    seen.add(await value('magic'));
    await row('magic').locator('.arr.r').click();
    await page.evaluate(() => window.__run(0.05));
  }
  forge[label].spells = [...seen];
  if (label === 'ELF' || label === 'DWARF' || label === 'THIEF') {
    await row('cls').locator('.k').click();
    await page.evaluate(() => window.__run(0.6));
    await shot('c0-forge-' + label.toLowerCase());
  }
}
const classSpells = await page.evaluate(() => Object.fromEntries(window.__lib.CLASSES.map((c) => [c.label, c.spells.map((id) => window.__lib.SPELLS.find((s) => s.id === id).label)])));
check('CLASS-raden finnes og kan stilles på alle sju', Object.entries(forge).every(([k, v]) => v.got === k), Object.fromEntries(Object.entries(forge).map(([k, v]) => [k, v.got])));
check('klassene med eget utstyr viser det på våpenraden (og ingen malte våpen å velge)', forge.CLERIC.weaponRow === 'HOLY MACE' && forge.THIEF.weaponRow === 'TWIN DAGGERS' && forge['MAGIC-USER'].weaponRow === 'QUARTERSTAFF' && forge.ELF.weaponRow === 'LONGBOW' && forge.BARD.weaponRow === 'BATTLE LUTE', Object.fromEntries(Object.entries(forge).map(([k, v]) => [k, v.weaponRow])));
check('dvergen får øks eller hammer', ['axe', 'hammer'].includes(forge.DWARF.weapon), forge.DWARF);
check('MAGIC-raden blar bare i magien klassen kan', Object.entries(forge).every(([k, v]) => v.spells.length === classSpells[k].length && v.spells.every((s) => classSpells[k].includes(s))), Object.fromEntries(Object.entries(forge).map(([k, v]) => [k, v.spells])));
check('ELF IS A CLASS. DO NOT ASK.', forge.ELF.info.includes('ELF IS A CLASS. DO NOT ASK.'), forge.ELF.info);
check('dvergen er lav og bred, alven slank', forge.DWARF.sy / forge.DWARF.sx < 0.75 && forge.ELF.sy / forge.ELF.sx > 1.05 && Math.abs(forge.FIGHTER.sy / forge.FIGHTER.sx - 1) < 0.01, { dwarf: forge.DWARF.sy / forge.DWARF.sx, elf: forge.ELF.sy / forge.ELF.sx });
// ROLL 3D6
await setClass('FIGHTER');
await row('roll').locator('.k').click();
await page.evaluate(() => window.__run(0.1));
const roll1 = await page.evaluate(() => { const s = window.__game.scene; return s.cfgs[s.slot].abilities; });
const rollInfo = await info();
const gmSeen = new Set();
for (let i = 0; i < 8; i++) {
  await row('roll').locator('.k').click();
  await page.evaluate(() => window.__run(0.05));
  const t = await info();
  gmSeen.add(t.split('\n').pop());
}
check('ROLL 3D6 gir seks tall fra 3 til 18', Array.isArray(roll1) && roll1.length === 6 && roll1.every((v) => v >= 3 && v <= 18), roll1);
check('infoboksen viser STR til CHA og hva spillederen mener', ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'].every((k) => rollInfo.includes(k)) && /GAME MASTER/.test(rollInfo), rollInfo);
check('og etter mange nye kast sukker han over det', [...gmSeen].some((t) => /REROLLING AGAIN|KEEPING COUNT|ANOTHER PIZZA/.test(t)), [...gmSeen]);
await shot('c1-forge-roll');
// DONE lagrer klassen og kastet
await setClass('DWARF');
await page.locator('.cr-row[data-key="done"]').click();
await page.evaluate(() => window.__run(0.3));
const saved = await page.evaluate(() => { const L = window.__lib, h = L.loadSave().heroes[0]; return { cls: h.cls, abilities: h.abilities }; });
check('DONE lagrer klassen og terningene', saved.cls === 5 && saved.abilities?.length === 6, saved);

// 2) På brettet
const level = (classes, twoP = false) => page.evaluate(([classes, twoP]) => {
  const g = window.__game, L = window.__lib;
  g.save.heroes = [0, 1].map((i) => ({ ...(i ? L.PRESETS.valkyra : L.PRESETS.thrugg), cls: L.classIndex(classes[i] ?? 'fighter') }));
  g.save.heroMade = [true, true]; g.twoP = twoP; g.input.solo = !twoP;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  window.__run(0.5);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null; s.queue = []; s.visionDone = true;
  s.camX = 20; s.hazards.length = 0; g.camera.position.x = 20;
  s.heroes.forEach((h, i) => { h.f.pos.set(16 + i * 2, 0, 0); });
  window.__said = [];
  if (!g.fx.__wrapped) {
    g.fx.__wrapped = true;
    const orig = g.fx.text;
    g.fx.text = function (p, t, kind, ...rest) { window.__said.push(t); return orig.call(this, p, t, kind, ...rest); };
  }
  window.__run(1.2);
  s.camX = 20;
  return s.heroes.map((h) => ({ cls: h.cls.id, hp: h.f.maxHp, speed: +h.f.speed.toFixed(2), potions: h.potions, magicMul: +h.fx.magicMul.toFixed(2), weapon: h.weapon.id, magic: h.magic }));
}, [classes, twoP]);
const foe = (id, x, z, face) => page.evaluate(([id, x, z, face]) => {
  const s = window.__game.scene.stage;
  const o = s.spawnFoe(id, 'R');
  o.f.pos.set(x, 0, z); o.entered = true; o.cd = 99; o.projCd = 99; o.f.frozen = true; o.f.face(face);
  o.f.hp = o.f.maxHp = 400;
  return s.foes.indexOf(o);
}, [id, x, z, face]);

const stats = {};
for (const c of ['fighter', 'cleric', 'thief', 'mage', 'elf', 'dwarf', 'bard']) stats[c] = (await level([c]))[0];
check('egenskapene følger klassen (dvergen tåler mest, alven minst, magikeren har krukker og sterkere magi)',
  stats.dwarf.hp > stats.fighter.hp && stats.elf.hp < stats.fighter.hp && stats.dwarf.speed < stats.fighter.speed && stats.mage.potions >= 3 && stats.mage.magicMul > stats.fighter.magicMul * 1.5, stats);
check('og våpnene: kølle, dolker, stav, bue, lutt', stats.cleric.weapon === 'mace' && stats.thief.weapon === 'daggers' && stats.mage.weapon === 'staff' && stats.elf.weapon === 'bow' && stats.bard.weapon === 'lute', stats);

// Presten helbreder partneren som står nær, ikke den som står langt unna
await level(['cleric', 'fighter'], true);
const heal = await page.evaluate(() => {
  const s = window.__game.scene.stage, [c, p] = s.heroes;
  p.f.hp = 50; p.f.pos.set(c.f.pos.x + 2, 0, 0);
  window.__run(2);
  const near = p.f.hp;
  p.f.hp = 50; p.f.pos.set(c.f.pos.x + 8, 0, 0);
  window.__run(2);
  return { near: +near.toFixed(1), far: +p.f.hp.toFixed(1), self: c.f.hp === c.f.maxHp };
});
check('presten helbreder partneren som står nær (co-op), ikke den langt unna', heal.near >= 55 && heal.far < 51, heal);
await page.evaluate(() => { const s = window.__game.scene.stage, [c, p] = s.heroes; p.f.hp = 60; p.f.pos.set(c.f.pos.x + 2.4, 0, 0.7); window.__run(1.05); });
await shot('c2-cleric-heal');

// Tyven: bakfra gjør tre ganger så vondt, og han stjeler
await level(['thief']);
const thief = await page.evaluate(() => {
  const s = window.__game.scene.stage, L = window.__lib, h = s.heroes[0], f = h.f;
  const a = s.spawnFoe('hogman', 'R'), b = s.spawnFoe('hogman', 'R');
  for (const o of [a, b]) { o.entered = true; o.cd = 99; o.f.hp = o.f.maxHp = 400; o.f.frozen = true; }
  a.f.pos.set(f.pos.x + 1, 0, 0); a.f.face(-1);
  b.f.pos.set(f.pos.x + 1, 0, 1.5); b.f.face(1);
  window.__said.length = 0;
  f.face(1);
  const atk = h.atk('slash1');
  L.applyHit(f, a.f, atk);
  const front = 400 - a.f.hp;
  f.pos.z = 1.5;
  L.applyHit(f, b.f, atk);
  const back = 400 - b.f.hp;
  const said = [...window.__said];
  // Tyveriet: hvert treff har en sjanse, her alle
  const odds = h.cls.steal; h.cls.steal = 1;
  const g0 = h.gold;
  s.classes.onHit(h, a.f, false);
  h.cls.steal = odds;
  return { front: +front.toFixed(1), back: +back.toFixed(1), said, gold: h.gold - g0, yoink: window.__said.some((t) => t.startsWith('YOINK!')), offhand: !!f.rig.g.armB.userData.offhand };
});
check('tyven stikker bakfra: tre ganger så mye skade (BACKSTAB!)', Math.abs(thief.back / thief.front - 3) < 0.05 && thief.said.includes('BACKSTAB!'), thief);
check('og stjeler gull (YOINK!)', thief.gold === 10 && thief.yoink, thief);
check('tyven har en dolk i hver neve', thief.offhand, thief);
// Bilde: tyven stikker en kultist i ryggen
await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0], f = h.f;
  for (const o of s.foes) { o.f.alive = false; o.f.remove(); }
  s.foes.length = 0;
  const o = s.spawnFoe('cultist', 'R');
  o.entered = true; o.cd = 99; o.projCd = 99; o.f.hp = o.f.maxHp = 400; o.f.frozen = true;
  f.pos.set(18, 0, 0.4); o.f.pos.set(19.1, 0, 0.4); o.f.face(1); f.face(1);
  window.__run(0.1);
  f.startAttack(h.atk('slash1'));
  window.__run(0.2);
  // Hitstop etter et hardt treff stopper spilltiden, så treffblinket er ikke talt ned ennå
  o.f.flashT = 0;
  o.f.rig.flash = 0;
});
await shot('c3-thief');

// Alven skyter langs linja: pila treffer den på samme linje, ikke den ved siden av
await level(['elf']);
const elf = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0], f = h.f;
  const a = s.spawnFoe('hogman', 'R'), b = s.spawnFoe('hogman', 'R');
  for (const o of [a, b]) { o.entered = true; o.cd = 99; o.f.hp = o.f.maxHp = 400; o.f.frozen = true; }
  a.f.pos.set(f.pos.x + 6, 0, f.pos.z); b.f.pos.set(f.pos.x + 4, 0, f.pos.z + 1.6);
  f.face(1);
  h.input.attackBuffer = 0;
  f.startAttack(h.atk('slash1'));
  let arrows = 0;
  window.__run(0.3, () => { arrows = Math.max(arrows, s.proj.list.filter((p) => p.kind === 'arrow' && p.owner === f).length); });
  window.__run(0.6);
  return { atk: f.atk?.id ?? null, arrows, line: 400 - a.f.hp, beside: 400 - b.f.hp };
});
check('alven skyter en pil i stedet for å slå', elf.arrows === 1, elf);
check('pila treffer den som står på linja, ikke den ved siden av', elf.line > 0 && elf.beside === 0, elf);
await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0], f = h.f;
  f.startAttack(h.atk('chop'));
  window.__run(0.24);
});
await shot('c4-elf');

// Barden fyller METAL-måleren dobbelt så fort
const metal = {};
for (const c of ['fighter', 'bard']) {
  await level([c]);
  metal[c] = await page.evaluate(() => {
    const s = window.__game.scene.stage, h = s.heroes[0];
    s.metal.meter = 0;
    s.metal.add(0.1);
    return +s.metal.meter.toFixed(3);
  });
}
check('barden fyller METAL-måleren dobbelt så fort', metal.bard === metal.fighter * 2 && metal.fighter > 0, metal);

// 3) Terningene: NATURAL 20 og CRITICAL FUMBLE på tunge slag
await level(['fighter']);
const dice = await page.evaluate(() => {
  const s = window.__game.scene.stage, L = window.__lib, h = s.heroes[0], f = h.f;
  const a = s.spawnFoe('hogman', 'R');
  a.entered = true; a.cd = 99; a.f.hp = a.f.maxHp = 900; a.f.frozen = true;
  a.f.pos.set(f.pos.x + 1.4, 0, f.pos.z);
  f.face(1);
  const swing = (force) => {
    s.classes.force = force;
    a.f.hp = 900; a.f.setState('idle'); a.f.pos.set(f.pos.x + 1.4, 0, f.pos.z); a.f.vel.set(0, 0, 0); a.f.onGround = true; a.f.invuln = 0;
    f.setState('idle');
    f.startAttack(h.atk('chop'));
    window.__run(0.6);
    const dmg = 900 - a.f.hp;
    window.__run(1.5);
    return { dmg: +dmg.toFixed(1), roll: s.classes.last };
  };
  window.__said.length = 0;
  const normal = swing(10);
  const nat = swing(20);
  const said = [...window.__said];
  window.__said.length = 0;
  f.hp = 100;
  s.classes.force = 1;
  f.setState('idle');
  f.startAttack(h.atk('chop'));
  window.__run(0.1);
  const fumble = { state: f.state, hp: f.hp, said: [...window.__said], say: document.querySelector('.say')?.innerText ?? '' };
  return { normal, nat, said, fumble };
});
check('NATURAL 20 gir dobbel skade', dice.nat.roll === 20 && dice.normal.roll === 10 && Math.abs(dice.nat.dmg / dice.normal.dmg - 2) < 0.05 && dice.said.includes('NATURAL 20!'), dice);
check('CRITICAL FUMBLE legger helten i bakken og koster litt liv', dice.fumble.state === 'down' && dice.fumble.hp === 96 && dice.fumble.said.includes('CRITICAL FUMBLE!'), dice.fumble);
check('og spillederen sukker (GAME MASTER)', /GAME MASTER/.test(dice.fumble.say), dice.fumble.say);
await page.evaluate(() => window.__run(0.3));
await shot('c5-fumble');

check('ingen feil i konsollen', logs.length === 0, logs.slice(0, 5));
console.log(fails.length ? '\nFEIL: ' + fails.join(' | ') : '\nALT OK');
await browser.close();
process.exit(fails.length ? 1 : 0);
