// Lagring fra brettverkstedet under `npm run dev` (tools/vite-stage-forge.ts): SAVE skriver brettfila i
// src/data/layouts, et bilde dratt inn blir public/assets/prop_<id>.webp med manifestet oppdatert, siden lastes ikke
// på nytt av at filene endres, og etter en ny innlasting er alt der. Filene settes tilbake til slutt.
// Bruk: npm run dev (i et annet vindu), så node tools/tests/forge-save.mjs http://localhost:5173/
import { chromium } from 'playwright';
import fs from 'node:fs';
import zlib from 'node:zlib';
const [url] = process.argv.slice(2);
const ROAD = 'src/data/layouts/road.json', MAN = 'public/assets/manifest.json', IMG = 'public/assets/prop_forgetest.webp';
const backup = { road: fs.readFileSync(ROAD, 'utf8'), man: fs.readFileSync(MAN, 'utf8') };
const before = JSON.parse(backup.road).props.length;

const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info !== '' ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
const png = (() => {
  const w = 40, h = 80, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 4 + 1) + 1 + x * 4;
    raw[o] = 40; raw[o + 1] = 90; raw[o + 2] = 200; raw[o + 3] = x > 4 && x < w - 4 && y > 3 ? 255 : 0;
  }
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
  page.setDefaultTimeout(240000);
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  const open = async () => {
    await page.goto(url + (url.includes('?') ? '&' : '?') + 'editor=road');
    await page.waitForFunction(() => window.__game?.scene?.name === 'editor' && window.__lib?.forgeState());
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; window.__marker = 1; });
  };
  const toast = () => page.evaluate(() => document.querySelector('#forge .fg-toast')?.textContent ?? '');
  await open();

  // Svarene fra utvidelsen
  const api = await page.evaluate(async () => {
    const post = (p, body) => fetch('/__forge/' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.status);
    return {
      ping: await fetch('/__forge/ping').then((r) => r.text()),
      badLevel: await post('layout', { level: '../evil', json: '{}' }),
      badJson: await post('layout', { level: 'zz_test', json: '{nope' }),
      badProp: await post('prop', { id: 'Bad Name', meta: {} }),
      png: await post('prop', { id: 'zz_png', meta: {}, data: 'iVBORw0KGgoAAAANSUhEUg==' }),
    };
  });
  check('utvidelsen svarer, og avviser rare navn, ødelagt JSON og bilder som ikke er WebP', api.ping === 'stage-forge' && api.badLevel === 400 && api.badJson === 400 && api.badProp === 400 && api.png === 400, api);
  check('ingen filer ble skrevet av de avviste kallene', !fs.existsSync('src/data/layouts/zz_test.json') && !fs.existsSync('public/assets/prop_zz_png.webp') && fs.readFileSync(MAN, 'utf8') === backup.man);

  // Legg ut en rekvisitt og lagre brettfila i repoet
  await page.click('#forge .fg-item:has-text("ROAD POST")');
  await page.click('#forge .fg-top button:has-text("SAVE")');
  await page.waitForFunction(() => (document.querySelector('#forge .fg-toast')?.textContent ?? '').startsWith('SAVED'));
  const saved = JSON.parse(fs.readFileSync(ROAD, 'utf8'));
  const valid = await page.evaluate((l) => window.__lib.validateLayout(l, window.__lib.propIds()), saved);
  check('SAVE skriver src/data/layouts/road.json med den nye rekvisitten', saved.props.length === before + 1 && valid.length === 0 && !(await page.evaluate(() => window.__lib.forgeState().dirty)), { props: saved.props.length, valid, toast: await toast() });

  // Et bilde dratt inn, lagret som WebP med manifestet oppdatert
  await page.setInputFiles('#forge .fg-lib input[type=file]', { name: 'prop_forgetest.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => window.__lib.forgeState().layout.props.some((p) => p.prop === 'forgetest'));
  await page.click('#forge .fg-top button:has-text("SAVE")');
  await page.waitForFunction(() => /IMAGE/.test(document.querySelector('#forge .fg-toast')?.textContent ?? ''));
  const webp = fs.existsSync(IMG) ? fs.readFileSync(IMG) : Buffer.alloc(0);
  const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  const entry = man.props?.forgetest;
  check('bildet blir public/assets/prop_forgetest.webp og står i manifestet', webp.toString('latin1', 0, 4) === 'RIFF' && webp.toString('latin1', 8, 12) === 'WEBP' && entry?.file === 'prop_forgetest.webp' && entry.w > 0 && entry.anchor?.length === 2, { size: webp.length, entry, toast: await toast() });
  check('resten av manifestet er uendret', JSON.stringify({ ...man, props: undefined }) === JSON.stringify({ ...JSON.parse(backup.man), props: undefined }));
  // Nye felt fra miljøpakken: lyser selv (emit), flammepunkter (fire) og deler som henger på en annen del (on)
  const status = await page.evaluate(async () => (await fetch('/__forge/prop', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'forgetest', meta: { file: 'prop_forgetest.webp', w: 1, emit: 1, fire: [[0.5, 0.2], [2, 0]], preset: [
      { prop: 'torch', dx: 0, dy: 1 }, { prop: 'flag_cloth', dx: 0, dy: 1.5, on: 0 }, { prop: 'crow', dx: 0, dy: 2, on: 7 },
    ] } }),
  })).status);
  const entry2 = JSON.parse(fs.readFileSync(MAN, 'utf8')).props?.forgetest;
  check('manifestet tar vare på emit, fire og on, og dropper ugyldige verdier', status === 200 && entry2?.emit === 1 && JSON.stringify(entry2.fire) === '[[0.5,0.2]]' && entry2.preset?.[1]?.on === 0 && entry2.preset?.[2] && entry2.preset[2].on === undefined, { status, entry2 });
  await page.waitForTimeout(2500);
  check('siden lastes ikke på nytt når editoren lagrer', await page.evaluate(() => window.__marker === 1 && window.__game.scene.name === 'editor'));

  // Ny innlasting: brettfila og bildet fra repoet
  await open();
  const again = await page.evaluate(() => ({
    props: window.__lib.forgeState().layout.props.length,
    img: window.__lib.propKind('forgetest')?.source,
    lib: [...document.querySelectorAll('#forge .fg-item .fg-name')].some((e) => e.textContent.includes('FORGETEST')),
  }));
  check('etter en ny innlasting er rekvisittene og bildet der (fra fila og manifestet)', again.props === before + 2 && again.img === 'image' && again.lib, again);
  if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
  if (logs.length) fails.push('logs');
} finally {
  await browser.close();
  fs.writeFileSync(ROAD, backup.road);
  fs.writeFileSync(MAN, backup.man);
  fs.rmSync(IMG, { force: true });
  fs.rmSync('src/data/layouts/zz_test.json', { force: true });
  fs.rmSync('public/assets/prop_zz_png.webp', { force: true });
}
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: lagringen fra brettverkstedet virker');
process.exitCode = fails.length ? 1 : 0;
