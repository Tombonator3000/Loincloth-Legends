// Kulisser i flere deler og de nye 2D-animasjonene (Tom 2026-09-30: "implementer animasjonsmuligheter for 2D
// objekter"): delene henger på forelderens ledd og følger animasjon, flytting, skala og speilvending; sletting og
// duplisering; wave, pulse, drift og react (TEST-knappen, en figur i nærheten og et treff); ledd valgt ved klikk i
// bildet; varianter (V og rader som blander); SAVE AS SET. Bruk: node tools/tests/prop-anim.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
import zlib from 'node:zlib';
import fs from 'node:fs';
const [url, out] = process.argv.slice(2);
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
const shot = async (n) => { if (out) { await page.evaluate(() => window.__game.tick(1 / 60, true)); await page.screenshot({ path: `${out}/prop-anim-${n}.png` }); } };
const prop = (id) => page.evaluate((id) => { const p = window.__lib.forgeState().layout.props.find((q) => q.id === id); return p ? JSON.parse(JSON.stringify(p)) : null; }, id);
const world = (id) => page.evaluate((id) => {
  const it = window.__game.scene.scenery.items.get(id);
  if (!it) return null;
  const v = new window.__lib.THREE.Vector3();
  (it.mesh ?? it.root).getWorldPosition(v);
  return { x: v.x, y: v.y, z: v.z, parent: it.parentKey ?? null, sx: it.pivot.scale.x, px: it.pivot.position.x, alpha: it.mat?.uniforms.opacity.value ?? 1 };
}, id);
const sel = (id) => page.evaluate((id) => window.__game.scene.select({ type: 'prop', id }), id);
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(k); await tick(2); };
const clickText = (sel, text) => page.evaluate(({ sel, text }) => {
  const b = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text);
  b?.click();
  return !!b;
}, { sel, text });
const addAnim = (type) => page.evaluate((type) => {
  const s = [...document.querySelectorAll('#forge .fg-props select')].find((x) => x.options[0]?.textContent === '+ ADD ANIMATION');
  s.value = type;
  s.dispatchEvent(new Event('change'));
}, type);

await page.goto(url + (url.includes('?') ? '&' : '?') + 'editor=road');
await page.waitForFunction(() => window.__game?.scene?.name === 'editor' && window.__lib?.forgeState());
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
// Testbrettet er det gamle brett 1 med plassholderne (skilt og kråke, flaggstang, lykt og palisaderad), så testen
// står seg når brett 1 får nye kulisser. PLAY FROM HERE nedenfor spiller det samme brettet.
const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/road-placeholders.json', import.meta.url), 'utf8'));
await page.evaluate((l) => {
  window.__lib.forgeState().layout = l;
  window.__lib.setUnsavedLayout('road', l);
  window.__game.scene.rebuild();
}, FIXTURE);
await tick(10);

// ---------------------------------------------------------------- deler
const loaded = await page.evaluate(() => {
  const sc = window.__game.scene.scenery;
  return { sign: sc.items.get('p3').parentKey, flag: sc.items.get('p16').parentKey, onPivot: sc.items.get('p3').root.parent === sc.items.get('p2').pivot };
});
check('delene i brettfila henger på forelderen (skiltet på stolpen, flagget på stanga)', loaded.sign === 'p2' && loaded.flag === 'p15' && loaded.onPivot, loaded);
const sign0 = await prop('p3'), post0 = await prop('p2'), w0 = await world('p3');
await sel('p2');
await key('Shift+ArrowRight');
const sign1 = await prop('p3'), w1 = await world('p3');
check('flyttes stolpen en meter, flyttes skiltet like mye (både i fila og i bildet)', Math.abs(sign1.x - (sign0.x + 1)) < 1e-6 && Math.abs(w1.x - (w0.x + 1)) < 0.02, { before: sign0.x, after: sign1.x, world: [w0.x, w1.x] });
await key('BracketRight');
const post2 = await prop('p2'), sign2 = await prop('p3');
const k = (post2.scale ?? 1) / 1;
check('skaleres stolpen, skaleres skiltet og avstanden til det like mye', Math.abs((sign2.scale ?? 1) - k) < 0.002 && Math.abs((sign2.x - post2.x) - (sign0.x - post0.x) * k) < 0.01 && Math.abs((sign2.y - (post2.y ?? 0)) - (sign0.y - (post0.y ?? 0)) * k) < 0.01, { k, sign2 });
await key('KeyF');
const post3 = await prop('p2'), sign3 = await prop('p3');
check('speilvendes stolpen, havner skiltet på andre siden og speilvendes', !!post3.flip && !!sign3.flip && Math.abs((sign3.x - post3.x) + (sign2.x - post2.x)) < 0.01, { post: post3.x, sign: sign3.x });
await key('Control+z', 3);
const sign4 = await prop('p3');
check('tre angre setter stolpen og skiltet tilbake', JSON.stringify(sign4) === JSON.stringify(sign0), sign4);

// En del på det svingende skiltet følger svingen
const partId = await page.evaluate(() => {
  const sc = window.__game.scene;
  const sign = window.__lib.forgeState().layout.props.find((q) => q.id === 'p3');
  sc.addPart(sign, window.__lib.propKind('skullpike'));
  return window.__lib.forgeState().sel.id;
});
const part = await prop(partId);
const tr = [];
for (let i = 0; i < 6; i++) { await tick(12); tr.push((await world(partId)).x); }
const swingSpan = Math.max(...tr) - Math.min(...tr);
check('en del hengt på skiltet svinger med skiltet', part.parent === 'p3' && swingSpan > 0.004, { parent: part.parent, swingSpan });

// Slett forelderen: delen blir liggende, løs. Angre tar alt tilbake.
await sel('p3');
await key('Delete');
const loose = await prop(partId), wl = await world(partId);
check('slettes skiltet, blir delen liggende uten forelder', !!loose && loose.parent === undefined && wl.parent === null, { loose, wl });
await key('Control+z');
check('og angre henger den på igjen', (await prop(partId))?.parent === 'p3' && (await world(partId)).parent === 'p3');

// Dupliser flaggstanga: flagget blir med
const before = await page.evaluate(() => window.__lib.forgeState().layout.props.length);
await sel('p15');
await key('Control+d');
const dup = await page.evaluate(() => {
  const s = window.__lib.forgeState();
  const pole = s.layout.props.find((q) => q.id === s.sel.id);
  const flag = s.layout.props.find((q) => q.parent === pole.id);
  return { n: s.layout.props.length, pole: pole.prop, flag: flag?.prop, hung: window.__game.scene.scenery.items.get(flag?.id)?.parentKey === pole.id };
});
check('dupliseres flaggstanga, blir flagget med og henger på kopien', dup.n === before + 2 && dup.flag === 'flag_cloth' && dup.hung, dup);
await key('Control+z');

// ---------------------------------------------------------------- wave, pulse, drift, react
const flag = await page.evaluate(() => { const it = window.__game.scene.scenery.items.get('p16'); return { verts: it.mesh.geometry.attributes.position.count, wave: it.mat.uniforms.uWave.value, t: it.mat.uniforms.uT.value }; });
check('flagget bølger: oppdelt plan og bølge i skyggeleggeren', flag.verts > 100 && flag.wave > 0.05 && flag.t > 0, flag);

await sel('p1');
await addAnim('pulse');
await tick(3);
const sx = [];
for (let i = 0; i < 8; i++) { await tick(10); sx.push((await world('p1')).sx); }
check('PULSE puster (skalaen går opp og ned)', Math.max(...sx) > 1.01 && Math.min(...sx) < 0.99, sx.map((v) => +v.toFixed(3)));
await addAnim('drift');
await tick(3);
const d0 = (await world('p1')).px;
await tick(120);
const d1 = (await world('p1')).px;
check('DRIFT glir sidelengs (0,4 m/s i to sekunder)', Math.abs(d1 - d0 - 0.8) < 0.1 || Math.abs(d1 - d0) > 25, { d0, d1 });

// React med TEST-knappen: kråka flyr vekk og kommer tilbake
await sel('p8');
await tick(2);
const tested = await clickText('#forge .fg-props button', 'TEST');
await tick(120);
const gone = await world('p8');
await tick(60 * 11);
const backC = await world('p8');
check('TEST: kråka flyr vekk (usynlig) og kommer tilbake etter 10 sekunder', tested && gone.alpha < 0.05 && backC.alpha > 0.95, { tested, gone: gone.alpha, back: backC.alpha });

// Ledd valgt ved klikk i bildet (sving på skiltet)
await sel('p3');
await tick(2);
// Bildet er skalert inn i ruta (object-fit: contain), så punktet regnes fra selve bildet
const pickBox = await page.evaluate(() => {
  const c = document.querySelector('#forge .fg-props canvas.fg-pick');
  if (!c) return null;
  c.scrollIntoView();
  const r = c.getBoundingClientRect();
  const s = Math.min(r.width / c.width, r.height / c.height);
  const ox = (r.width - c.width * s) / 2, oy = (r.height - c.height * s) / 2;
  return { x: r.left + ox + 0.25 * c.width * s, y: r.top + oy + 0.5 * c.height * s };
});
if (pickBox) await page.mouse.click(pickBox.x, pickBox.y);
await tick(2);
const pv = (await prop('p3'))?.anim?.find((a) => a.type === 'swing')?.pivot;
check('et klikk i bildet setter leddet for svingen', !!pickBox && !!pv && Math.abs(pv[0] - 0.25) < 0.05 && Math.abs(pv[1] - 0.5) < 0.05, { pickBox, pv });
await key('Control+z');

// ---------------------------------------------------------------- varianter
const vId = await page.evaluate(() => { window.__game.scene.addProp(window.__lib.propKind('palisade_a')); return window.__lib.forgeState().sel.id; });
await key('KeyV');
const v1 = (await prop(vId)).prop;
await key('KeyV');
const v2 = (await prop(vId)).prop;
check('V bytter til neste variant og tilbake (palisade_a, palisade_b)', v1 === 'palisade_b' && v2 === 'palisade_a', { v1, v2 });
await page.evaluate(() => window.__game.scene.select({ type: 'run', id: 'row1' }));
await tick(2);
await page.evaluate(() => {
  const row = [...document.querySelectorAll('#forge .fg-props .fg-row')].find((r) => r.textContent.includes('MIX VARIANTS'));
  row.querySelector('input').click();
});
await tick(2);
const mix = await page.evaluate(() => {
  const L = window.__lib, r = L.forgeState().layout.runs.find((q) => q.id === 'row1');
  const a = L.expandRun(r).map((p) => p.prop), b = L.expandRun(r).map((p) => p.prop);
  const items = [...window.__game.scene.scenery.items.values()].filter((i) => i.runId === 'row1').map((i) => i.place.prop);
  return { variants: r.variants, same: JSON.stringify(a) === JSON.stringify(b), kinds: [...new Set(items)].sort(), n: items.length };
});
check('MIX VARIANTS blander variantene inn i raden, likt hver gang', JSON.stringify(mix.variants) === '["palisade_b"]' && mix.same && mix.kinds.join() === 'palisade_a,palisade_b', mix);
await shot('1-parts');

// ---------------------------------------------------------------- SAVE AS SET
const png = (() => {
  const w = 24, h = 96, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 4 + 1) + 1 + x * 4;
    raw[o] = 90; raw[o + 1] = 60; raw[o + 2] = 30; raw[o + 3] = x > 6 && x < w - 6 ? 255 : 0;
  }
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k2 = 0; k2 < 8; k2++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();
await page.setInputFiles('#forge .fg-lib input[type=file]', { name: 'prop_testpole.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => window.__lib.forgeState().layout.props.some((p) => p.prop === 'testpole'));
const poleId = await page.evaluate(() => window.__lib.forgeState().sel.id);
await page.evaluate((id) => { const sc = window.__game.scene; sc.addPart(window.__lib.forgeState().layout.props.find((q) => q.id === id), window.__lib.propKind('flag_cloth')); }, poleId);
await sel(poleId);
await tick(2);
const savedSet = await clickText('#forge .fg-props button', 'SAVE AS SET');
const preset = await page.evaluate(() => window.__lib.propKind('testpole')?.preset ?? null);
await page.click('#forge .fg-item:has-text("TESTPOLE")');
await tick(2);
const placed = await page.evaluate(() => {
  const s = window.__lib.forgeState();
  return s.layout.props.filter((q) => q.parent === s.sel.id).map((q) => q.prop);
});
check('SAVE AS SET: neste gang legges stanga ut med flagget hengt på', savedSet && preset?.length === 1 && preset[0].prop === 'flag_cloth' && placed.join() === 'flag_cloth', { savedSet, preset, placed });

// ---------------------------------------------------------------- i spillet: en figur nær kråka, og et treff ved skiltet
await page.evaluate(() => window.__game.testLevel('road', 34));
await page.waitForFunction(() => window.__game.scene?.name === 'stage');
await tick(30);
const crowStart = await page.evaluate(() => { const it = window.__game.scene.stage.scenery.items.get('p8'); return it.mat.uniforms.opacity.value; });
let fled = false;
for (let i = 0; i < 12 && !fled; i++) {
  fled = await page.evaluate(() => {
    const g = window.__game, inp = g.input;
    for (let j = 0; j < 30; j++) { inp.keys.add('KeyD'); g.tick(1 / 60, false); }
    inp.keys.delete('KeyD');
    const it = g.scene.stage.scenery.items.get('p8');
    return it.reacts.some((r) => r && (r.rt >= 0 || r.gone > 0));
  });
}
check('i spillet flyr kråka når helten kommer nær', crowStart > 0.9 && fled, { crowStart, fled });
const hit = await page.evaluate(() => {
  const s = window.__game.scene.stage, it = s.scenery.items.get('p3');
  s.scenery.poke(it.place.x, it.place.z, 1);
  window.__game.tick(1 / 60, false);
  const st = it.reacts.find(Boolean);
  return { rt: st?.rt ?? null };
});
check('et treff ved skiltet får det til å riste', hit.rt !== null && hit.rt >= 0, hit);
await shot('2-game');

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: deler og 2D-animasjoner virker');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
