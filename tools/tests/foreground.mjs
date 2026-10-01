// Trær i forgrunnen (mellom veien og kameraet) tones ut når de dekker en figur, som forgrunnen fra brettverkstedet.
// Tom 2026-10-01: på mobil fylte et tre i forgrunnen hele bildet, så helten ikke syntes.
// - Brett 1 (høsttrær), nattleiren (eiker) og frostpasset (småfuruer) har trær i Env.fronts.
// - Står kameraet rett bak et slikt tre med helten bak det, tones treet ned til FRONT_FADE. Langt unna er det helt.
// - Skjermbilder med og uten uttoning (negativ kontroll), og et mål på hvor mye bildet rundt helten endrer seg.
// Bruk: node tools/tests/foreground.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// Liggende mobil (samme sideforhold som bildet fra Tom)
const page = await browser.newPage({ viewport: { width: 1300, height: 600 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
});

const levels = [
  { id: 'road', biome: 'grass' },
  { id: 'nightcamp', biome: 'night' },
  { id: 'frost', biome: 'frost' },
];

for (const lv of levels) {
  const r = await page.evaluate((lv) => {
    const g = window.__game, W = window.__lib.W;
    g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
    g.playLevel({ id: lv.id, name: lv.id, kind: 'level', level: lv.id, biome: lv.biome, pos: [0, 0], requires: [], blurb: '' });
    window.__run(0.5);
    const s = g.scene.stage;
    // Ingen bølger, ingen tale fra Vorthax, ingen nattleir-regler: bare helten og trærne
    s.waveIdx = 999; s.wave = null; s.lockX = null; s.queue = []; s.visionDone = true;
    // Nattleiren er ferdig når det gryr (ingen fiender igjen): hopp over det, ellers dekker sluttskjermen bildet
    s.dawned = true;
    for (const f of s.foes) f.f.die('normal', 1, null);
    const fronts = W.env?.fronts ?? [];
    if (!fronts.length) return { fronts: 0 };
    // Et tre et stykke inn på brettet, med kameraet rett bak det og helten bak treet
    const fr = fronts.find((f) => (f.box.min.x + f.box.max.x) / 2 > 12) ?? fronts[0];
    const cx = (fr.box.min.x + fr.box.max.x) / 2;
    const h = s.heroes[0].f;
    h.hp = h.maxHp = 9999;
    const place = (x) => { s.camX = x; h.pos.set(x - 0.2, 0, 0.4); h.vel.set(0, 0, 0); };
    place(cx);
    window.__run(1.2, () => { place(cx); h.hp = 9999; });
    const near = +fr.fade.value.toFixed(3);
    // Langt unna: treet er helt igjen
    place(cx + 40);
    window.__run(1.2, () => { place(cx + 40); h.hp = 9999; });
    const far = +fr.fade.value.toFixed(3);
    // Tilbake bak treet for bildene
    place(cx);
    window.__run(1.2, () => { place(cx); h.hp = 9999; });
    window.__fr = fr; window.__cx = cx;
    const box = { minZ: +fr.box.min.z.toFixed(2), maxZ: +fr.box.max.z.toFixed(2), minY: +fr.box.min.y.toFixed(2), maxY: +fr.box.max.y.toFixed(2), w: +(fr.box.max.x - fr.box.min.x).toFixed(2) };
    return { fronts: fronts.length, near, far, box, cam: W.camera.position.z.toFixed(2) };
  }, lv);
  check(`${lv.id}: har trær i forgrunnen som kan tones ut`, r.fronts > 0, r);
  if (!r.fronts) continue;
  check(`${lv.id}: treet tones ut når helten står bak det`, r.near <= 0.25, r);
  check(`${lv.id}: og er helt igjen når kameraet er langt unna`, r.far >= 0.98, r);

  if (out) {
    // Med uttoning, og samme bilde med treet tvunget helt synlig (negativ kontroll)
    const proj = await page.evaluate(() => {
      const g = window.__game, W = window.__lib.W, s = g.scene.stage, h = s.heroes[0].f;
      g.tick(1 / 60, true);
      const p = h.torsoPoint().clone().project(W.camera);
      return { x: Math.round((p.x + 1) / 2 * innerWidth), y: Math.round((1 - p.y) / 2 * innerHeight) };
    });
    const faded = await page.screenshot({ path: `${out}/fg-${lv.id}-faded.png` });
    await page.evaluate(() => {
      const g = window.__game, s = g.scene.stage;
      // Uten toning: sett uniformen til 1 og tegn uten å oppdatere brettet
      window.__fr.fade.value = 1;
      g.tick(0, true);
    });
    const solid = await page.screenshot({ path: `${out}/fg-${lv.id}-solid.png` });
    // Hvor mye endrer bildet seg rundt helten (gjennomsnittlig forskjell per kanal i en rute rundt brystet)?
    const diff = await page.evaluate(async ({ a, b, p }) => {
      const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
      const x = c.getContext('2d');
      const w = 120, hh = 160, x0 = Math.max(0, p.x - w / 2), y0 = Math.max(0, p.y - hh / 2);
      x.drawImage(ia, 0, 0); const da = x.getImageData(x0, y0, w, hh).data;
      x.drawImage(ib, 0, 0); const db = x.getImageData(x0, y0, w, hh).data;
      let sum = 0; for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      return +(sum / (da.length / 4) / 3).toFixed(1);
    }, { a: faded.toString('base64'), b: solid.toString('base64'), p: proj });
    console.log(`${lv.id}: forskjell rundt helten med og uten toning: ${diff}`);
  }
}

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: trærne i forgrunnen tones ut når de dekker en figur');
