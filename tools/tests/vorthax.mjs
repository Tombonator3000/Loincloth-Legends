// Vorthax merkes før tårnet (LevelDef.vorthax, gfx/vision.ts): på alle brettene før tårnet viser han seg som et kjempehode av
// lilla lys på himmelen mellom bølgene og holder en tale, én replikk om gangen i HUD-en, og hodet toner ut igjen og
// kommer ikke tilbake. Brettene har også replikker om ordrene hans i bølgene. Alt går i spilltid.
// Bruk: node tools/tests/vorthax.mjs http://localhost:4173/ [./shots] [brett]
import { chromium } from 'playwright';
const [url, out, only] = process.argv.slice(2);
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

// Dataene: alle brettene før tårnet har en tale, og Vorthax nevnes i bølgene
const data = await page.evaluate(() => {
  const L = window.__lib.LEVELS;
  return ['road', 'jungle', 'swamp', 'frost', 'scorch'].map((id) => ({
    id, lines: L[id].vorthax?.lines.length ?? 0, at: L[id].vorthax?.at ?? -1,
    waves: L[id].waves.map((w) => w.at), mention: L[id].waves.some((w) => /VORTHAX|SIGNED, V\./.test(w.say?.[1] ?? '')),
  }));
});
for (const d of data) {
  // Talen kommer mellom første og andre bølge
  check(`${d.id}: tale med replikker mellom bølgene, og ordrene hans nevnes`, d.lines >= 2 && d.waves[0] < d.at && d.at < d.waves[1] && d.mention, d);
}

const levels = only ? only.split(',') : ['road', 'jungle', 'swamp', 'frost', 'scorch'];
for (const id of levels) {
  const r = await page.evaluate((id) => {
    const g = window.__game, L = window.__lib;
    g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
    g.playLevel({ id, name: id, kind: 'level', level: id, biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const s = g.scene.stage, v = s.level.vorthax;
    // Første bølge er over: helten står foran stedet der Vorthax viser seg
    for (const f of s.foes) { f.f.alive && f.f.die('normal', 1, null); f.f.removeMe = true; }
    s.waveIdx = 1; s.wave = null; s.lockX = null; s.queue = [];
    const h = s.heroes[0].f; h.hp = h.maxHp = 9999;
    h.pos.set(v.at + 1, 0, 0);
    s.camX = v.at - 1.5;
    const say = () => document.querySelector('.say')?.textContent ?? '';
    let appeared = -1, maxLevel = 0;
    const heard = [];
    for (let i = 0; i < 60 * 14; i++) {
      s.camX = Math.max(s.camX, v.at); // kameraet står ved talen
      g.tick(1 / 60, false);
      if (s.vision && appeared < 0) appeared = i;
      if (s.vision) maxLevel = Math.max(maxLevel, s.vision.level);
      const t = say();
      // Bare replikkene fra dette brettet (HUD-en har fortsatt siste replikk fra forrige brett)
      if (t.startsWith('VORTHAX') && v.lines.some((l) => t.endsWith(l)) && !heard.includes(t)) heard.push(t);
    }
    const gone = !s.vision && s.visionDone;
    // Han kommer ikke tilbake
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    return { appeared: +(appeared / 60).toFixed(2), maxLevel: +maxLevel.toFixed(2), heard: heard.length, want: v.lines.length, first: heard[0], gone, again: !!s.vision };
  }, id);
  check(`${id}: hodet viser seg, sier alle replikkene og toner ut`, r.appeared >= 0 && r.appeared < 0.5 && r.maxLevel > 0.9 && r.heard === r.want && r.gone && !r.again, r);
}

if (out) {
  // Et bilde mens han taler (brett 1)
  await page.evaluate(() => {
    const g = window.__game;
    g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
    // Vent til tittelen på brettet er borte
    for (let i = 0; i < 60 * 5; i++) g.tick(1 / 60, false);
    const s = g.scene.stage, v = s.level.vorthax;
    for (const f of s.foes) { f.f.alive && f.f.die('normal', 1, null); f.f.removeMe = true; }
    s.waveIdx = 1; s.wave = null; s.lockX = null; s.queue = [];
    const h = s.heroes[0].f; h.hp = h.maxHp = 9999; h.pos.set(v.at + 1, 0, 0);
    s.camX = v.at;
    for (let i = 0; i < 60 * 4.6; i++) { s.camX = Math.max(s.camX, v.at); g.tick(1 / 60, false); }
    g.tick(1 / 60, true);
  });
  await page.screenshot({ path: `${out}/vorthax-vision.png` });
}
if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: Vorthax merkes på brettene før tårnet');
await browser.close();
process.exit(fails.length ? 1 : 0);
