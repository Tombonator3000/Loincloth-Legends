// Bilder som tar over for plassholderne (imageKind i src/gfx/props/catalog.ts): et nytt bilde fra ChatGPT beholder
// mål, lys, flammer og bevegelse fra plassholderen. grid og n i manifestet gjør bildet til en bildeserie (fart og
// løkke fra plassholderen), et stillbilde mister bildeserien, og anim i manifestet er hele lista.
// Bruk: node tools/tests/prop-images.mjs http://localhost:4173/
import { chromium } from 'playwright';
const [url] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__lib?.imageKind);
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info !== '' ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
const kind = (id, meta) => page.evaluate(({ id, meta }) => {
  const k = window.__lib.imageKind(id, document.createElement('canvas'), { file: 'prop_' + id + '.webp', ...meta });
  return { source: k.source, w: k.w, anchor: k.anchor, layer: k.layer, fire: k.fire ?? null, anim: k.anim ?? null };
}, { id, meta });
const types = (k) => (k.anim ?? []).map((a) => a.type);
const sheet = (k) => (k.anim ?? []).find((a) => a.type === 'sheet');

const crow = await kind('crow', { grid: [4, 1], n: 4 });
check('kråka som bildeserie fra ChatGPT: rutenettet fra bildet, farten, flukten (track) og reaksjonen (react) fra plassholderen', crow.source === 'image' && types(crow).join() === 'sheet,track,react' && sheet(crow).grid.join() === '4,1' && sheet(crow).n === 4 && crow.w === 0.55, crow);
const torch = await kind('torch', {});
check('et stillbilde av fakkelen mister bildeserien, men beholder lyset og flammene', !sheet(torch) && types(torch).includes('flicker') && torch.fire?.length > 0, torch);
const banner = await kind('banner_red', { grid: [3, 2], n: 5 });
check('banneret med et annet rutenett: 5 bilder i 3x2, fart fra plassholderen', sheet(banner).n === 5 && sheet(banner).grid.join() === '3,2' && sheet(banner).fps === 10 && banner.anchor.join() === '0.14,0.995', banner);
const flag = await kind('flag', { grid: [3, 1], n: 3, w: 1.6 });
check('et helt nytt navn med rutenett blir en bildeserie med 10 bilder i sekundet', types(flag).join() === 'sheet' && sheet(flag).fps === 10 && sheet(flag).mode === 'loop' && flag.w === 1.6 && flag.layer === 'mid', flag);
const own = await kind('crow', { anim: [{ type: 'bob', amount: 0.1, speed: 1 }] });
check('anim i manifestet er hele lista', types(own).join() === 'bob', own);
const ownSheet = await kind('crow', { anim: [{ type: 'bob', amount: 0.1, speed: 1 }], grid: [2, 2], n: 3 });
check('og med rutenett får den bildeserien i tillegg', types(ownSheet).join() === 'sheet,bob' && sheet(ownSheet).n === 3, ownSheet);
const still = await kind('milestone', { w: 1 });
check('et stillbilde med nytt navn har ingen animasjon', still.anim === null && still.w === 1, still);

await browser.close();
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: bildene tar over for plassholderne');
process.exitCode = fails.length ? 1 : 0;
