// Venstre museknapp slår for spiller 1 (Tom 2026-09-30: "legg til at man kan slå med museknapp også"):
// - klikk på spillflaten på et brett gir et slag, og tre klikk gir kombinasjonen
// - klikk i duellen gir et hugg
// - klikk på kartet starter ikke et brett (der betyr angrep «gå inn», og man klikker gjerne for å gi vinduet fokus)
// - klikk på pausemenyen er ikke et slag, og høyre museknapp gjør ingenting
// Bruk: node tools/tests/mouse.mjs http://localhost:4173/
import { chromium } from 'playwright';
const [url] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
const tick = (n = 1) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__game.tick(1 / 60, false); }, n);
// Klikk midt på spillflaten (der ingen meny ligger), så la spillet lese det
const click = async (button = 'left') => { await page.mouse.click(640, 400, { button }); await tick(1); };

// Brett
await page.evaluate(() => {
  const g = window.__game;
  g.twoP = false;
  g.playLevel({ id: 'road', level: 'road', kind: 'level', name: 'X', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
});
await tick(120);
await page.evaluate(() => { const s = window.__game.scene.stage; s.waveIdx = 99; s.wave = null; s.queue = []; for (const f of s.foes) f.f.remove?.(); s.foes = []; });
await tick(10);
const target = await page.evaluate(() => { const t = document.elementFromPoint(640, 400); return t ? t.tagName + '#' + t.id : null; });
check('klikkpunktet er spillflaten (ingen lag over den tar klikket)', target === 'CANVAS#gl', target);
const hero = () => page.evaluate(() => { const f = window.__game.scene.stage.heroes[0].f; return { state: f.state, atk: f.atk?.id ?? null }; });
await click();
const first = await hero();
check('venstre klikk gir et slag på brettet', first.state === 'attack' && /slash1/.test(first.atk ?? ''), first);
await tick(60);
const seen = [];
for (let i = 0; i < 3; i++) {
  await click();
  seen.push((await hero()).atk);
  await tick(14);
}
check('tre klikk etter hverandre gir kombinasjonen', seen.some((a) => /slash2|chop/.test(a ?? '')), seen);
await tick(90);
await click('right');
const right = await hero();
check('høyre museknapp gir ikke slag', right.state !== 'attack', right);

// Pause: klikk på pausemenyen er ikke et slag
await tick(30);
await page.evaluate(() => window.__game.togglePause());
await tick(2);
const paused = await page.evaluate(() => { const t = document.elementFromPoint(640, 400); return { paused: window.__game.paused, target: t ? t.tagName + '.' + t.className : null }; });
await page.mouse.click(640, 400);
await page.evaluate(() => window.__game.togglePause());
await tick(2);
const afterPause = await hero();
check('klikk på pausemenyen gir ikke slag', paused.paused && !String(paused.target).startsWith('CANVAS') && afterPause.state !== 'attack', { paused, afterPause });

// Duell
await page.evaluate(() => {
  const g = window.__game;
  g.goDuel({ a: g.heroSide(0, true), b: { cid: 'skeleton', name: 'BONEJANGLES', human: false, hp: 90, speed: 3.1, dmg: 1, skill: 0.7, aggression: 0.5 }, roundsToWin: 2, arena: 'pit' }, () => {});
});
// Vent til runden er i gang (introen og FIGHT)
let fighting = false;
for (let i = 0; i < 60 && !fighting; i++) {
  await tick(10);
  fighting = await page.evaluate(() => window.__game.scene.duel?.phase === 'fight');
}
await click();
const duelHero = await page.evaluate(() => { const d = window.__game.scene.duel; const f = d.fa; return f ? { state: f.state, atk: f.atk?.id ?? null } : null; });
check('venstre klikk gir et hugg i duellen', fighting && duelHero?.state === 'attack', { fighting, duelHero });

// Kart: klikk starter ikke et brett
await page.evaluate(() => window.__game.goMap());
await tick(60);
await click();
await tick(30);
const scene = await page.evaluate(() => window.__game.scene.name);
check('klikk på kartet starter ikke et brett', scene === 'map', scene);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: musen slår på brett og i dueller');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
