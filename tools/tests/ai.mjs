// CPU mot CPU: kjør flere dueller og se at kampene avsluttes, og hvilke dødsmåter som dukker opp.
// Bruk: node tools/tests/ai.mjs http://localhost:4173/
import { chromium } from 'playwright';
const [url] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url);
await page.waitForTimeout(1500);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
const res = await page.evaluate(() => {
  const g = window.__game;
  const out = [];
  const foes = [
    { cid: 'gorthak', name: 'GORTHAK', human: false, hp: 110, speed: 2.7, dmg: 1.05, skill: 0.55, aggression: 0.6 },
    { cid: 'hogman', name: 'SIR OINKSALOT', human: false, hp: 120, speed: 2.5, dmg: 1.1, scale: 1.1, skill: 0.5, aggression: 0.7 },
    { cid: 'skeleton', name: 'BONEJANGLES', human: false, hp: 90, speed: 3.1, dmg: 1, skill: 0.7, aggression: 0.5 },
  ];
  const arenas = ['pit', 'ice', 'bone'];
  for (let m = 0; m < foes.length; m++) {
    let result = null;
    g.goDuel({ a: g.heroSide(0, false), b: foes[m], roundsToWin: 2, arena: arenas[m] }, (w) => { result = w; });
    let t = 0;
    const styles = [];
    while (result === null && t < 400) {
      g.tick(1 / 60, false);
      t += 1 / 60;
      const d = g.scene.duel;
      if (d && d.phase === 'ko' && d.loser && !styles.includes(d.round + ':' + d.loser.deathStyle)) styles.push(d.round + ':' + d.loser.deathStyle);
      if (d && d.phase === 'cleanup') g.input.tapped.add('Enter');
    }
    out.push({ vs: foes[m].name, result, secs: t.toFixed(0), styles });
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
console.log(logs.join('\n'));
await browser.close();
