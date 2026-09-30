// Brettverkstedet (STAGE FORGE), slik Tom bruker det (Tom 2026-09-30: "lag editor og animasjons muligheter").
// Åpner ?editor=road og går gjennom: biblioteket, legge ut, dra med musa, angre og gjøre om, slette, en rad, slå av
// generert pynt (verdenen bygges om og tilstanden beholdes), tidslinja (flytte en bølge), lagre (nedlasting uten
// dev-serveren), et PNG-bilde dratt inn, og PLAY FROM HERE med pausen tilbake til editoren.
// Bruk: node tools/tests/editor.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
import zlib from 'node:zlib';
import fs from 'node:fs';
// Antall rekvisitter i brettfila til brett 1 (testen regner resten ut fra det)
const ROAD = JSON.parse(fs.readFileSync(new URL('../../src/data/layouts/road.json', import.meta.url), 'utf8'));
const N = ROAD.props.length, RUNS = (ROAD.runs ?? []).length;
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 }, acceptDownloads: true });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !/CERT_AUTHORITY|Failed to load resource/.test(m.text())) logs.push('console: ' + m.text().slice(0, 400)); });
page.on('dialog', (d) => d.accept());
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info !== '' ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
// SwiftShader bruker rundt ti sekunder på et bilde, så testen tegner bare før skjermbildene
const shot = async (n) => { if (out) { await tick(1, true); await page.screenshot({ path: `${out}/editor-${n}.png` }); } };
const tick = (n = 1, render = false) => page.evaluate(({ n, render }) => { for (let i = 0; i < n; i++) window.__game.tick(1 / 60, render && i === n - 1); }, { n, render });
const st = () => page.evaluate(() => {
  const s = window.__lib.forgeState();
  return s && { level: s.level, props: s.layout.props.length, runs: (s.layout.runs ?? []).length, sel: s.sel, dirty: s.dirty, undo: s.history.canUndo, redo: s.history.canRedo, gens: s.layout.generators ?? null, waves: s.layout.waves?.map((w) => w.at) ?? null };
});
/** Skjermpunktet til en rekvisitt (litt over foten). */
const screenOf = (id, up = 0.9) => page.evaluate(({ id, up }) => {
  const g = window.__game, L = window.__lib, s = L.forgeState();
  const p = s.layout.props.find((q) => q.id === id);
  const v = new L.THREE.Vector3(p.x, (p.y ?? 0) + up, p.z).project(g.camera);
  const r = g.canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, px: p.x };
}, { id, up });

await page.goto(url + (url.includes('?') ? '&' : '?') + 'editor=road');
await page.waitForFunction(() => window.__game && window.__lib && window.__game.scene?.name === 'editor');
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await tick(20);
const ui = await page.evaluate(() => ({
  panels: ['.fg-top', '.fg-lib', '.fg-props', '.fg-time'].every((s) => !!document.querySelector('#forge ' + s)),
  lib: document.querySelectorAll('#forge .fg-item').length,
}));
check('editoren åpner med ?editor=road: toppen, biblioteket, egenskapene og tidslinja', ui.panels, ui);
check('biblioteket har de malte plassholderne, bildene og 3D-rekvisittene (minst 30)', ui.lib >= 30, ui.lib);
let s0 = await st();
const items0 = await page.evaluate(() => window.__game.scene.scenery.items.size);
check(`brettfila for brett 1 er lastet (${N} rekvisitter, ${RUNS} rad, palisaden fra generatoren er av)`, s0.props === N && s0.runs === RUNS && s0.gens?.stakeWall === false, { ...s0, items0 });
await shot('1-open');

// Legg ut fra biblioteket
await page.click('#forge .fg-item:has-text("ROAD POST")');
await tick(3);
let s1 = await st();
check('et klikk i biblioteket legger ut rekvisitten midt i bildet og velger den', s1.props === N + 1 && s1.sel?.type === 'prop' && s1.undo && s1.dirty, s1);
const id = s1.sel.id;

// Dra den med musa, 2 meter til høyre
const a = await screenOf(id);
const b = await screenOf(id, 0.9);
const pxPerM = await page.evaluate(({ id }) => {
  const g = window.__game, L = window.__lib, s = L.forgeState();
  const p = s.layout.props.find((q) => q.id === id);
  const r = g.canvas.getBoundingClientRect();
  const v0 = new L.THREE.Vector3(p.x, 0.9, p.z).project(g.camera), v1 = new L.THREE.Vector3(p.x + 1, 0.9, p.z).project(g.camera);
  return (v1.x - v0.x) / 2 * r.width;
}, { id });
void b;
// Treff selve stolpen (fotpunktet er stolpen)
await page.mouse.move(a.x, a.y);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + (pxPerM * 2 * i) / 8, a.y);
await page.mouse.up();
await tick(3);
let moved = await page.evaluate((id) => window.__lib.forgeState().layout.props.find((q) => q.id === id).x, id);
check('dra med musa flytter rekvisitten langs bakken (2 m, låst til 0,25 m)', Math.abs(moved - (a.px + 2)) <= 0.26, { from: a.px, to: moved });
await page.keyboard.press('Control+z');
await tick(2);
const undone = await page.evaluate((id) => window.__lib.forgeState().layout.props.find((q) => q.id === id)?.x, id);
await page.keyboard.press('Control+y');
await tick(2);
const redone = await page.evaluate((id) => window.__lib.forgeState().layout.props.find((q) => q.id === id)?.x, id);
check('Ctrl+Z angrer flyttingen og Ctrl+Y gjør den om igjen', undone === a.px && redone === moved, { undone, redone });

// Tastene: skala, speilvend og slett
await page.evaluate((id) => window.__game.scene.select({ type: 'prop', id }), id);
await page.keyboard.press('BracketRight');
await page.keyboard.press('KeyF');
await tick(2);
const keyed = await page.evaluate((id) => { const p = window.__lib.forgeState().layout.props.find((q) => q.id === id); return { scale: p.scale, flip: p.flip }; }, id);
check('] gjør større og F speilvender', keyed.scale > 1.05 && keyed.flip === true, keyed);
await page.keyboard.press('Delete');
await tick(2);
let s2 = await st();
check('Delete sletter rekvisitten', s2.props === N && !s2.sel, s2);
await page.keyboard.press('Control+z');
await tick(2);
s2 = await st();
check('og Ctrl+Z tar den tilbake', s2.props === N + 1, s2);

// En rad
await page.click('#forge .fg-item:has-text("BROKEN CART") button:has-text("ROW")');
await tick(3);
const s3 = await st();
const items3 = await page.evaluate(() => window.__game.scene.scenery.items.size);
check('ROW legger ut en rad (egen plassering per stykke, samme hver gang)', s3.runs === 2 && s3.sel?.type === 'run' && items3 > items0 + 2, { runs: s3.runs, items3, items0 });
await shot('2-added');

// Slå av generert pynt: verdenen bygges om, og det som er gjort, blir med
await page.evaluate(() => window.__game.scene.select(null));
await tick(2);
await page.click('#forge .fg-props .fg-row:has-text("BLACK FOREGROUND SILHOUETTES") input[type=checkbox]');
await page.waitForFunction(() => window.__game.scene?.name === 'editor' && window.__lib.forgeState().layout.generators?.silhouettes === false);
await tick(5);
const s4 = await st();
const gensUsed = await page.evaluate(() => window.__lib.W.env.generators);
check('en generator kan slås av: brettet bygges om og rekvisittene, raden og angre-historikken er med', s4.gens?.silhouettes === false && s4.props === N + 1 && s4.runs === 2 && s4.undo && gensUsed.includes('silhouettes'), { s4, gensUsed });

// Tidslinja: klikk flytter kameraet, og bølge 1 kan dras
const tl = await page.evaluate(() => {
  const cv = document.querySelector('#forge .fg-time canvas');
  const r = cv.getBoundingClientRect();
  const sc = window.__game.scene;
  const lv = window.__lib.levelWithLayout(window.__lib.LEVELS.road, window.__lib.forgeState().layout);
  const x0 = -10, x1 = lv.length + 10;
  const px = (x) => r.left + ((x - x0) / (x1 - x0)) * r.width;
  return { y: r.top + r.height * 0.5, at: lv.waves[0].at, wx: px(lv.waves[0].at), to: px(lv.waves[0].at + 6), go: px(60), yTop: r.top + 8 };
});
await page.mouse.click(tl.go, tl.y + 20);
await tick(30);
const camX = await page.evaluate(() => window.__game.camera.position.x);
check('et klikk på tidslinja flytter kameraet dit', Math.abs(camX - 60) < 3, camX);
await page.mouse.move(tl.wx, tl.yTop);
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(tl.wx + ((tl.to - tl.wx) * i) / 6, tl.yTop);
await page.mouse.up();
await tick(3);
const s5 = await st();
check('bølge 1 kan dras på tidslinja (bølgene tas inn i brettfila)', !!s5.waves && Math.abs(s5.waves[0] - (tl.at + 6)) <= 0.6, { waves: s5.waves, was: tl.at });

// Lagre uten dev-serveren: brettfila lastes ned og er gyldig
const dl = page.waitForEvent('download');
await page.click('#forge .fg-top button:has-text("SAVE")');
const file = await dl;
const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
const verdict = await page.evaluate((text) => { const l = JSON.parse(text); return { level: l.level, errors: window.__lib.validateLayout(l, window.__lib.propIds()), props: l.props.length }; }, text);
check('SAVE uten dev-serveren laster ned road.json, og fila er gyldig', file.suggestedFilename() === 'road.json' && verdict.level === 'road' && verdict.errors.length === 0 && verdict.props === N + 1, { name: file.suggestedFilename(), ...verdict });

// Et PNG-bilde dratt inn (her gjennom filvelgeren): rekvisitt med én gang
const png = (() => {
  const w = 48, h = 64, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      const inside = x > 6 && x < w - 6 && y > 4;
      raw[o] = 200; raw[o + 1] = 60; raw[o + 2] = 40; raw[o + 3] = inside ? 255 : 0;
    }
  }
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();
await page.setInputFiles('#forge .fg-lib input[type=file]', { name: 'prop_testbox.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => window.__lib.forgeState().layout.props.some((p) => p.prop === 'testbox'));
await tick(3);
const imp = await page.evaluate(() => ({ lib: [...document.querySelectorAll('#forge .fg-item .fg-name')].some((e) => e.textContent.includes('TESTBOX')), kind: window.__lib.propKind('testbox')?.source }));
check('et PNG-bilde blir en rekvisitt med én gang (prop_testbox.png blir «testbox»)', imp.lib && imp.kind === 'image', imp);
await shot('3-imported');

// PLAY FROM HERE, og pausen tilbake til editoren
await page.evaluate(() => { window.__game.scene.st.camX = 20; window.__game.save.supplies = { lives: 1, potions: 2 }; });
await tick(40);
await page.click('#forge .fg-top button:has-text("PLAY FROM HERE")');
await page.waitForFunction(() => window.__game.scene?.name === 'stage');
await tick(30);
const play = await page.evaluate(() => {
  const s = window.__game.scene.stage;
  return { heroX: s.heroes[0].f.pos.x, camX: s.camX, testbox: [...s.scenery.items.values()].some((i) => i.place.prop === 'testbox'), forge: !!document.querySelector('#forge') };
});
check('PLAY FROM HERE starter brettet der kameraet sto, med det som ikke er lagret', Math.abs(play.heroX - 17) < 2 && play.testbox && !play.forge, play);
const sup = await page.evaluate(() => window.__game.save.supplies);
check('prøvespillet bruker ikke opp forsyningene fra nattleiren', sup?.lives === 1 && sup?.potions === 2, sup);
await page.evaluate(() => window.__game.togglePause());
await tick(2);
const menu = await page.evaluate(() => [...document.querySelectorAll('li[data-i] .lbl')].map((b) => b.textContent.trim()).filter(Boolean));
check('pausemenyen har BACK TO STAGE FORGE', menu.some((t) => t.includes('BACK TO STAGE FORGE')), menu.slice(0, 8));
// Menyen overser klikk de første 150 ms etter at den åpnet
await page.waitForTimeout(250);
await page.evaluate(() => {
  const items = [...document.querySelectorAll('li[data-i]')].filter((b) => b.textContent.includes('BACK TO STAGE FORGE'));
  items[0]?.click();
});
await page.waitForFunction(() => window.__game.scene?.name === 'editor');
await tick(5);
const back = await st();
check('tilbake i editoren er alt som før (rekvisittene med bildet, 2 rader, ikke lagret, bølgen flyttet)', back.props === N + 2 && back.runs === 2 && back.dirty && !!back.waves, back);
await shot('4-back');

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: brettverkstedet virker');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
