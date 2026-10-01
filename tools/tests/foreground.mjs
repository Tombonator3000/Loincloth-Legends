// Forgrunnen (mellom veien og kameraet) tones ut når den dekker en figur.
// Tom 2026-10-01: på mobil fylte en eik i nattleiren hele bildet, så helten ikke syntes.
// - PR #7 flyttet de store trærne på brett 1 og i nattleiren bak kampbeltet. Trær som står foran veien (Env.fronts,
//   i dag småfuruene i frostpasset) tones ned til FRONT_FADE når helten står bak dem, og er helt igjen langt unna.
// - De malte kulissene i FRONT-laget (på brett 1 blant annet en trestamme) tones like mye.
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
  // Kameraet og helten på x, helten bak forgrunnen (z 0,4), og la toningen virke
  window.__place = (x, hx = x) => {
    const s = window.__game.scene.stage, h = s.heroes[0].f;
    const put = () => { s.camX = x; h.pos.set(hx, 0, 0.4); h.vel.set(0, 0, 0); h.hp = 9999; };
    put();
    window.__run(1.2, put);
  };
});

// Skjermbilde med toning, og samme bilde med forgrunnen tvunget helt synlig. Forskjellen måles i en rute rundt hele
// figuren, fra hodet til føttene (en lav furu dekker bare beina).
async function compare(name, solid) {
  const proj = await page.evaluate(() => {
    const g = window.__game, W = window.__lib.W, h = g.scene.stage.heroes[0].f;
    g.tick(1 / 60, true);
    const px = (v) => { const p = v.clone().project(W.camera); return { x: Math.round((p.x + 1) / 2 * innerWidth), y: Math.round((1 - p.y) / 2 * innerHeight) }; };
    const head = px(h.headPoint()), feet = px(h.pos);
    return { x: feet.x, y0: head.y - 20, y1: feet.y + 30 };
  });
  const faded = await page.screenshot({ path: `${out}/fg-${name}-faded.png` });
  await page.evaluate(solid);
  const full = await page.screenshot({ path: `${out}/fg-${name}-solid.png` });
  const diff = await page.evaluate(async ({ a, b, p }) => {
    const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const x = c.getContext('2d');
    const w = 120, x0 = Math.max(0, p.x - w / 2), y0 = Math.max(0, p.y0), hh = Math.min(ia.height, p.y1) - y0;
    x.drawImage(ia, 0, 0); const da = x.getImageData(x0, y0, w, hh).data;
    x.drawImage(ib, 0, 0); const db = x.getImageData(x0, y0, w, hh).data;
    let sum = 0; for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return +(sum / (da.length / 4) / 3).toFixed(1);
  }, { a: faded.toString('base64'), b: full.toString('base64'), p: proj });
  console.log(`${name}: forskjell rundt helten med og uten toning: ${diff}`);
}

const levels = [
  { id: 'road', biome: 'grass', props: true },
  { id: 'nightcamp', biome: 'night' },
  { id: 'frost', biome: 'frost', trees: true },
];

for (const lv of levels) {
  const r = await page.evaluate((lv) => {
    const g = window.__game, W = window.__lib.W;
    g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
    g.playLevel({ id: lv.id, name: lv.id, kind: 'level', level: lv.id, biome: lv.biome, pos: [0, 0], requires: [], blurb: '' });
    window.__run(0.5);
    const s = g.scene.stage;
    // Ingen bølger, ingen tale fra Vorthax, ingen nattleir-regler: bare helten og forgrunnen
    s.waveIdx = 999; s.wave = null; s.lockX = null; s.queue = []; s.visionDone = true;
    // Nattleiren er ferdig når det gryr (ingen fiender igjen): hopp over det, ellers dekker sluttskjermen bildet
    s.dawned = true;
    for (const f of s.foes) f.f.die('normal', 1, null);
    const res = { fronts: 0 };
    // Trærne foran veien
    const fronts = W.env?.fronts ?? [];
    res.fronts = fronts.length;
    if (fronts.length) {
      // Et tre et stykke inn på brettet, med kameraet rett bak det og helten bak treet
      const fr = fronts.find((f) => (f.box.min.x + f.box.max.x) / 2 > 12) ?? fronts[0];
      const cx = (fr.box.min.x + fr.box.max.x) / 2;
      window.__place(cx, cx - 0.2);
      res.near = +fr.fade.value.toFixed(3);
      // Langt unna: treet er helt igjen
      window.__place(cx + 40);
      res.far = +fr.fade.value.toFixed(3);
      res.box = { minZ: +fr.box.min.z.toFixed(2), maxZ: +fr.box.max.z.toFixed(2), maxY: +fr.box.max.y.toFixed(2), w: +(fr.box.max.x - fr.box.min.x).toFixed(2) };
      window.__fr = fr; window.__cx = cx;
    }
    // De malte kulissene i FRONT-laget: finn en plass der helten står bak en av dem
    const items = [...s.scenery.items.values()].filter((it) => it.fades && it.mesh);
    res.props = items.length;
    res.prop = null;
    for (const it of items) {
      const px = it.place.x;
      for (const dx of [0, -0.5, 0.5, -1, 1]) {
        window.__place(px, px + dx);
        if (it.fade <= 0.25) { res.prop = { prop: it.place.prop, x: px, dx, near: +it.fade.toFixed(3) }; break; }
      }
      if (res.prop) {
        window.__place(px + 40);
        res.prop.far = +it.fade.toFixed(3);
        window.__place(px, px + res.prop.dx);
        window.__it = it;
        break;
      }
    }
    return res;
  }, lv);
  console.log(`${lv.id}: ${r.fronts} trær foran veien, ${r.props} FRONT-kulisser som kan tones ut`);
  if (lv.trees) {
    check(`${lv.id}: har trær foran veien som kan tones ut`, r.fronts > 0, r);
    if (!r.fronts) continue;
  }
  if (r.fronts) {
    check(`${lv.id}: treet tones ut når helten står bak det`, r.near <= 0.25, r);
    check(`${lv.id}: og er helt igjen når kameraet er langt unna`, r.far >= 0.98, r);
    if (out) {
      await page.evaluate(() => window.__place(window.__cx, window.__cx - 0.2));
      await compare(`${lv.id}-tree`, () => { window.__fr.fade.value = 1; window.__game.tick(0, true); });
    }
  }
  if (lv.props) {
    check(`${lv.id}: en malt kulisse i FRONT tones ut når helten står bak den`, !!r.prop && r.prop.near <= 0.25, r);
    if (!r.prop) continue;
    check(`${lv.id}: og er helt igjen når kameraet er langt unna`, r.prop.far >= 0.98, r);
    if (out) {
      await compare(`${lv.id}-prop`, () => {
        // Uten toning: kulissen står fast på helt synlig mens bildet tegnes
        const it = window.__it;
        it.fades = false; it.fade = 1; it.mat.uniforms.uFade.value = 1;
        window.__game.tick(0, true);
        it.fades = true;
      });
    }
  }
}

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: forgrunnen tones ut når den dekker en figur');
