// Veien gjennom historien (data/worldmap.ts): brett 1, jungelen, så sumpen og frostpasset i valgfri rekkefølge, så
// Scorchlands (krever begge) og tårnet. Brettnummeret følger rekkefølgen spilleren tar brettene i, både på kartet og
// når brettet starter, og kartografen melder bare steder som faktisk ble åpnet.
// Bruk: node tools/tests/route.mjs http://localhost:4173/ [./shots]
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

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); });

// 1) Hvilke noder som er åpne etter hvert steg
const open = await page.evaluate(() => {
  const L = window.__lib;
  const openAfter = (done) => L.MAP_NODES.filter((n) => n.kind !== 'home' && L.nodeOpen(new Set(done), n) && !done.includes(n.id)).map((n) => n.id).sort().join(',');
  const edge = (a, b) => L.MAP_EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return {
    start: openAfter([]),
    road: openAfter(['road']),
    jungle: openAfter(['road', 'jungle']),
    frostFirst: openAfter(['road', 'jungle', 'frost']),
    swampFirst: openAfter(['road', 'jungle', 'swamp']),
    both: openAfter(['road', 'jungle', 'frost', 'swamp']),
    edges: [edge('road', 'jungle'), edge('jungle', 'swamp'), edge('jungle', 'frost'), edge('swamp', 'scorch'), edge('frost', 'scorch'), edge('scorch', 'tower')],
  };
});
check('bare brett 1 er åpent fra start', open.start === 'road', open);
check('etter brett 1: jungelen og arenaen', open.road === 'jungle,pit', open);
check('etter jungelen: både sumpen og frosten (og nattleiren)', open.jungle === 'frost,nightcamp,pit,swamp', open);
check('frosten først: sumpen er åpen, Scorchlands ikke ennå', open.frostFirst.includes('swamp') && !open.frostFirst.includes('scorch'), open);
check('sumpen først: frosten er åpen, Scorchlands ikke ennå', open.swampFirst.includes('frost') && !open.swampFirst.includes('scorch'), open);
check('begge klart: Scorchlands åpner', open.both.includes('scorch') && !open.both.includes('tower'), open);
check('stiene går fra jungelen til begge og fra begge til Scorchlands', open.edges.every(Boolean), open);

// 2) Brettnummeret følger rekkefølgen
const names = await page.evaluate(() => {
  const { stageName } = window.__lib;
  return {
    road: stageName('road', [], ''), jungle: stageName('jungle', ['road'], ''),
    swampNew: stageName('swamp', ['road', 'jungle'], ''), frostNew: stageName('frost', ['road', 'jungle'], ''),
    frostFirstDone: stageName('frost', ['road', 'jungle', 'frost'], ''), swampAfterFrost: stageName('swamp', ['road', 'jungle', 'frost'], ''),
    swampFirstDone: stageName('swamp', ['road', 'jungle', 'swamp', 'frost'], ''), frostAfterSwamp: stageName('frost', ['road', 'jungle', 'swamp', 'frost'], ''),
    scorch: stageName('scorch', ['road', 'jungle', 'frost', 'swamp'], ''), tower: stageName('tower', [], 'FINAL STAGE'),
  };
});
check('brett 1 og jungelen har faste nummer', names.road === 'STAGE 1' && names.jungle === 'STAGE 2', names);
check('det første av sumpen og frosten blir STAGE 3', names.swampNew === 'STAGE 3' && names.frostNew === 'STAGE 3' && names.frostFirstDone === 'STAGE 3' && names.swampFirstDone === 'STAGE 3', names);
check('det andre blir STAGE 4', names.swampAfterFrost === 'STAGE 4' && names.frostAfterSwamp === 'STAGE 4', names);
check('Scorchlands er STAGE 5 og tårnet FINAL STAGE', names.scorch === 'STAGE 5' && names.tower === 'FINAL STAGE', names);

// 3) Når frosten tas først, heter den STAGE 3 når den starter, og sumpen STAGE 4 etterpå
const startName = (completed, id) => page.evaluate(({ completed, id }) => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true; g.save.completed = completed;
  const node = window.__lib.MAP_NODES.find((n) => n.id === id);
  g.playLevel(node);
  for (let i = 0; i < 5; i++) g.tick(1 / 60, false);
  return document.querySelector('.announce .a-main')?.textContent ?? '';
}, { completed, id });
const frostStart = await startName(['road', 'jungle'], 'frost');
const swampStart = await startName(['road', 'jungle', 'frost'], 'swamp');
check('frosten først heter STAGE 3 når den starter', frostStart === 'STAGE 3', { frostStart });
check('sumpen etterpå heter STAGE 4', swampStart === 'STAGE 4', { swampStart });

// 4) Kartografen melder bare steder som ble åpnet: frosten først åpner ikke Scorchlands, sumpen etterpå gjør det
const carto = await page.evaluate(() => {
  const g = window.__game, L = window.__lib;
  const node = (id) => L.MAP_NODES.find((n) => n.id === id);
  const text = () => document.querySelector('.cut')?.textContent ?? '';
  g.save.completed = ['road', 'jungle'];
  g.nodeComplete(node('frost'));
  const afterFrost = text();
  g.nodeComplete(node('swamp'));
  const afterSwamp = text();
  return { afterFrost: afterFrost.includes('SCORCHLANDS'), afterSwamp: afterSwamp.includes('SCORCHLANDS'), order: g.save.completed.join(',') };
});
check('frosten først: Scorchlands meldes ikke som åpnet', !carto.afterFrost, carto);
check('sumpen etterpå: Scorchlands meldes som åpnet', carto.afterSwamp && carto.order === 'road,jungle,frost,swamp', carto);

// 5) Kartet: panelet for sumpen viser STAGE 4 etter at frosten er klart
const panel = await page.evaluate(() => {
  const g = window.__game;
  g.save.completed = ['road', 'jungle', 'frost']; g.save.node = 'swamp';
  g.goMap();
  for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
  return document.querySelector('.mappanel .mp-kind')?.textContent ?? '';
});
check('kartet viser STAGE 4 for sumpen når frosten er tatt først', panel.startsWith('STAGE 4'), { panel });
if (out) {
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/route-map.png` });
}

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
if (fails.length || logs.some((l) => l.startsWith('pageerror'))) {
  console.log('FAIL: ' + fails.join(', '));
  process.exit(1);
}
console.log('OK: sumpen og frosten kan tas i valgfri rekkefølge');
