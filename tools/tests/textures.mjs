// Sjekker at teksturer fra manifestet ("textures" i public/assets/manifest.json) lastes og brukes i stedet for
// de prosedyrelagde. Testen later som om manifestet og tre bilder finnes (Playwright svarer på forespørslene),
// så den endrer ingen filer. Bildene har uvanlige størrelser, så vi ser i scenen at det er de som er i bruk.
// Bruk: node tools/tests/textures.mjs http://localhost:4173/ ./shots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);

let seed = 11;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
/** Flisbare ellipser: hver tegnes også forskjøvet en hel bredde og høyde, så kantene går i hverandre. */
function blobs(w, h, n, colors, rMin, rMax) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, rx = rMin + rnd() * (rMax - rMin), ry = rx * (0.6 + rnd() * 0.4), c = colors[Math.floor(rnd() * colors.length)];
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) out += `<ellipse cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${c}"/>`;
  }
  return out;
}
function bricks(w, h, cols, rows, colors) {
  let out = '';
  const bw = w / cols, bh = h / rows;
  for (let r = 0; r < rows; r++)
    for (let c = -1; c < cols; c++) {
      const x = c * bw + (r % 2) * bw * 0.5;
      out += `<rect x="${(x + 3).toFixed(1)}" y="${(r * bh + 3).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${(bh - 6).toFixed(1)}" rx="6" fill="${colors[Math.floor(rnd() * colors.length)]}"/>`;
    }
  return out;
}
const svg = (w, h, bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`;
const FILES = {
  'tex_ground.svg': svg(640, 640, '#3d4a22', blobs(640, 640, 420, ['#556b2f', '#2f3a1a', '#6b7a3a', '#4a3a26'], 4, 16)),
  'tex_road.svg': svg(800, 672, '#7a5a3a', blobs(800, 672, 500, ['#8a8478', '#5a4630', '#a89a82', '#6a5a48'], 3, 12)),
  'tex_wall.svg': svg(576, 576, '#2a2a2e', bricks(576, 576, 6, 12, ['#7a7f88', '#6a6e76', '#8a8e94', '#5e626a'])),
};
const MANIFEST = { textures: { ground_grass: 'tex_ground.svg', road_grass: 'tex_road.svg', wall_keep: 'tex_wall.svg' } };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(120000);
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.route('**/assets/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(MANIFEST) }));
await page.route('**/assets/tex_*.svg', (r) => {
  const name = new URL(r.request().url()).pathname.split('/').pop();
  return r.fulfill({ contentType: 'image/svg+xml', body: FILES[name] });
});
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });
const loaded = await page.evaluate(() => Object.keys(window.__lib.images.textures));
console.log('lastet:', loaded.join(', '));

const run = (sec, keys = []) => page.evaluate(({ sec, keys }) => {
  const g = window.__game, inp = g.input, n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) { for (const k of keys) inp.keys.add(k); g.tick(1 / 60, false); }
  for (const k of keys) inp.keys.delete(k);
}, { sec, keys });
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true];
  g.twoP = false;
  g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
});
await run(3.5);
// Størrelsene på fargekartene i scenen: 640 (bakke), 800x672 (vei) og 576 (borgmur) kommer fra testbildene
const sizes = await page.evaluate(() => {
  const set = new Set();
  window.__lib.W.scene.traverse((o) => {
    const m = o.material;
    for (const mm of Array.isArray(m) ? m : m ? [m] : []) if (mm.map?.image?.width) set.add(mm.map.image.width + 'x' + mm.map.image.height);
  });
  return [...set];
}).catch((e) => ['feil: ' + e.message]);
console.log('kart i scenen:', sizes.join(' '));
await page.evaluate(() => window.__game.tick(1 / 60, true));
await page.screenshot({ path: `${out}/textures-road.png` });
const want = ['640x640', '800x672', '576x576'];
const missing = want.filter((s) => !sizes.includes(s));
if (loaded.length !== 3 || missing.length) {
  console.log('FEIL: mangler', missing.join(', ') || '-', 'lastet', loaded.length);
  process.exitCode = 1;
} else console.log('OK: alle tre teksturene fra manifestet er i bruk');
if (logs.length) console.log(logs.join('\n'));
await browser.close();
