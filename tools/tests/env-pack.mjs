// Miljøpakken fra ChatGPT (52 bilder, Tom 2026-09-30: "ta inn gpt png filer" og "bruk murene og gravene på de andre
// brettene også"): spillet henter bare kulissebildene brettene bruker, og editoren henter resten før den åpnes;
// settene legges ut med delene hengt riktig (flammen henger på lykta, som henger på stolpen, og følger svingen);
// flammene lyser selv; SAVE AS SET husker hvilken del en del henger på; brett 1 bruker bildene uten advarsler; de andre
// brettene har murer og graver uten advarsler og utenfor juvene; kråka på skiltet flyr når helten kommer.
// Bruk: node tools/tests/env-pack.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, out] = process.argv.slice(2);
const root = new URL('../../', import.meta.url);
const man = JSON.parse(fs.readFileSync(new URL('public/assets/manifest.json', root), 'utf8'));
const MAN_IDS = Object.keys(man.props ?? {});
// Kulissene brettfilene bruker (som layoutPropIds i src/data/layout.ts)
const used = new Set();
for (const f of fs.readdirSync(new URL('src/data/layouts/', root)).filter((f) => f.endsWith('.json'))) {
  const l = JSON.parse(fs.readFileSync(new URL('src/data/layouts/' + f, root), 'utf8'));
  for (const p of l.props ?? []) used.add(p.prop);
  for (const r of l.runs ?? []) for (const id of [r.prop, ...(r.variants ?? [])]) used.add(id);
}
const USED = MAN_IDS.filter((id) => used.has(id)).sort();

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !/CERT_AUTHORITY|Failed to load resource/.test(m.text())) logs.push('console: ' + m.text().slice(0, 400)); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info !== '' ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
const tick = (n = 1) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__game.tick(1 / 60, false); }, n);
const loadedProps = () => page.evaluate(() => Object.keys(window.__lib.images.props).sort());

// ---------------------------------------------------------------- lasting
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
const atStart = await loadedProps();
check(`ved oppstart hentes bare kulissebildene brettene bruker (${USED.length} av ${MAN_IDS.length})`, JSON.stringify(atStart) === JSON.stringify(USED) && USED.length < MAN_IDS.length, { loaded: atStart.length, used: USED.length });
await page.evaluate(() => window.__game.openEditor('road'));
await page.waitForFunction(() => window.__game.scene?.name === 'editor');
const inEditor = await loadedProps();
check('editoren henter resten før den åpnes, og biblioteket har alle bildene', inEditor.length === MAN_IDS.length && await page.evaluate((n) => window.__lib.allProps().filter((k) => k.source === 'image').length >= n, MAN_IDS.length), { loaded: inEditor.length });

// ---------------------------------------------------------------- brett 1
const road = await page.evaluate(() => {
  const sc = window.__game.scene, L = window.__lib;
  const props = L.forgeState().layout.props;
  return {
    warnings: sc.collectWarnings().map((w) => w.text),
    unknown: props.filter((p) => !L.propKind(p.prop)).map((p) => p.prop),
    images: props.filter((p) => L.propKind(p.prop)?.source === 'image').length,
    placeholders: props.filter((p) => L.propKind(p.prop)?.source === 'painted').map((p) => p.prop),
  };
});
check('brett 1 bruker bildene fra miljøpakken, uten plassholdere og uten advarsler', road.warnings.length === 0 && road.unknown.length === 0 && road.images >= 40 && road.placeholders.length === 0, road);

// De andre brettene: murene og gravene (Tom 2026-09-30), uten advarsler og ingen kulisser oppå juvene i frosten
const WALLS = /^env_(brick|stone|castle)_wall_/, GRAVES = /^env_grave/;
const others = {};
for (const id of ['swamp', 'frost', 'scorch', 'tower', 'nightcamp']) {
  await page.evaluate((id) => window.__game.openEditor(id), id);
  await page.waitForFunction((id) => window.__game.scene?.name === 'editor' && window.__lib.forgeState().level === id, id);
  others[id] = await page.evaluate(({ id, walls, graves }) => {
    const L = window.__lib, sc = window.__game.scene, props = L.forgeState().layout.props;
    // Juvet går fra forkanten av faren og bakover til CHASM_BACK (-5,2 i data/hazards.ts)
    const chasms = (L.LEVELS[id].hazards ?? []).filter((h) => h.kind === 'chasm');
    return {
      warnings: sc.collectWarnings().map((w) => w.text),
      unknown: props.filter((p) => !L.propKind(p.prop)).map((p) => p.prop),
      walls: props.filter((p) => new RegExp(walls).test(p.prop)).length,
      graves: props.filter((p) => new RegExp(graves).test(p.prop)).length,
      inChasm: props.filter((p) => chasms.some((h) => Math.abs(p.x - h.x) < h.w / 2 + 1 && p.z > -5.2 - 0.5 && p.z < h.z + h.d / 2)).map((p) => p.id),
    };
  }, { id, walls: WALLS.source, graves: GRAVES.source });
}
check('murene og gravene brukes på de andre brettene, uten advarsler og utenfor juvene', Object.values(others).every((o) => o.warnings.length === 0 && o.unknown.length === 0 && o.walls + o.graves > 0 && o.inChasm.length === 0) && others.swamp.graves >= 10, others);
await page.evaluate(() => window.__game.openEditor('road'));
await page.waitForFunction(() => window.__game.scene?.name === 'editor' && window.__lib.forgeState().level === 'road');

// ---------------------------------------------------------------- et sett i tre ledd
await page.evaluate(() => {
  const st = window.__lib.forgeState();
  st.layout.props = [];
  st.layout.runs = [];
  window.__game.scene.rebuild();
});
await tick(2);
const set = await page.evaluate(() => {
  const L = window.__lib, sc = window.__game.scene;
  const post = sc.addProp(L.propKind('env_lamppost_post'), { x: 6, z: -3.3 }, 'mid');
  const props = L.forgeState().layout.props;
  const lantern = props.find((q) => q.prop === 'env_lamppost_lantern'), flame = props.find((q) => q.prop === 'env_lantern_flame');
  const it = (id) => sc.scenery.items.get(id);
  return {
    post: post.id, lantern: lantern?.id, flame: flame?.id, lanternParent: lantern?.parent, flameParent: flame?.parent,
    onPivot: !!lantern && !!flame && it(flame.id).root.parent === it(lantern.id).pivot && it(lantern.id).root.parent === it(post.id).pivot,
    at: lantern && [lantern.x - post.x, lantern.y],
  };
});
check('lyktestolpen legges ut med lykta i kroken og flammen i lykta (flammen henger på lykta)', set.lanternParent === set.post && set.flameParent === set.lantern && set.onPivot && Math.abs(set.at[0] - 1.066) < 0.01 && Math.abs(set.at[1] - 2.4) < 0.01, set);
const world = (id) => page.evaluate((id) => {
  const it = window.__game.scene.scenery.items.get(id), v = new window.__lib.THREE.Vector3();
  (it.mesh ?? it.root).getWorldPosition(v);
  return { x: v.x, y: v.y, rot: it.pivot.rotation.z, emit: it.mat?.uniforms.uEmit.value ?? null };
}, id);
const xs = [], rots = [];
for (let i = 0; i < 8; i++) {
  await tick(15);
  const f = await world(set.flame), l = await world(set.lantern);
  xs.push(f.x);
  rots.push(l.rot);
}
check('lykta svinger, og flammen følger med', Math.max(...rots) - Math.min(...rots) > 0.02 && Math.max(...xs) - Math.min(...xs) > 0.005, { rot: +(Math.max(...rots) - Math.min(...rots)).toFixed(3), x: +(Math.max(...xs) - Math.min(...xs)).toFixed(4) });
const emit = { flame: (await world(set.flame)).emit, post: (await world(set.post)).emit };
check('flammen lyser selv (emit), stolpen gjør det ikke', emit.flame === 1 && emit.post === 0, emit);

// SAVE AS SET på stolpen: delen som henger på en annen del, får on
const saved = await page.evaluate((id) => {
  const L = window.__lib, sc = window.__game.scene;
  sc.saveAsSet(L.forgeState().layout.props.find((q) => q.id === id));
  return L.propKind('env_lamppost_post').preset;
}, set.post);
check('SAVE AS SET husker at flammen henger på lykta (on: 0)', saved?.length === 2 && saved[0].prop === 'env_lamppost_lantern' && saved[0].on === undefined && saved[1].prop === 'env_lantern_flame' && saved[1].on === 0, saved);

// De andre settene: alle delene finnes og henger på roten eller en annen del
const sets = await page.evaluate(() => {
  const L = window.__lib, sc = window.__game.scene, out = {};
  let x = 10;
  for (const id of ['env_torch_body', 'env_torch_wall_holder', 'env_campfire_base', 'env_banner_pole', 'env_oak_trunk']) {
    const root = sc.addProp(L.propKind(id), { x, z: -5 }, 'back');
    x += 4;
    const parts = L.forgeState().layout.props.filter((q) => q.parent && q.id !== root.id && (q.parent === root.id || L.forgeState().layout.props.find((r) => r.id === q.parent)?.parent === root.id));
    out[id] = { want: L.propKind(id).preset.length, got: parts.map((q) => q.prop) };
  }
  return out;
});
check('fakkelen, veggfakkelen, bålet, banneret og eika legges ut med alle delene', Object.values(sets).every((s) => s.want === s.got.length && s.want > 0), sets);
if (out) {
  await page.evaluate(() => { window.__lib.forgeState().camX = 12; window.__game.scene.updateCamera(1); });
  await tick(10);
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/env-pack-sets.png` });
}

// ---------------------------------------------------------------- i spillet: kråka på skiltet
await page.evaluate(() => { window.__lib.setUnsavedLayout('road', null); window.__game.testLevel('road', 12); });
await page.waitForFunction(() => window.__game.scene?.name === 'stage');
await tick(30);
const crowId = await page.evaluate(() => [...window.__game.scene.stage.scenery.items.values()].find((i) => i.place.prop === 'env_crow_perched')?.key ?? null);
let fled = false;
for (let i = 0; i < 16 && !fled && crowId; i++) {
  fled = await page.evaluate((id) => {
    const g = window.__game, inp = g.input;
    for (let j = 0; j < 30; j++) { inp.keys.add('KeyD'); g.tick(1 / 60, false); }
    inp.keys.delete('KeyD');
    const it = g.scene.stage.scenery.items.get(id);
    return it.reacts.some((r) => r && (r.rt >= 0 || r.gone > 0));
  }, crowId);
}
check('i spillet flyr kråka på skiltet når helten kommer', !!crowId && fled, { crowId, fled });

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: miljøpakken lastes, settes sammen og brukes på alle brettene');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
