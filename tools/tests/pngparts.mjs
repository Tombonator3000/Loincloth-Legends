// Sjekker at PNG-deler fra manifestet sitter riktig på riggen uten tall i manifestet: føttene når bakken,
// våpenet sitter i neven, nakkeleddet ligger like under toppen av overkroppen, og leddpunktet følger nakken og
// skaftet selv når håret eller øksebladet stikker ut til én side. Heltenes hofte skaleres etter beltet.
// Testen later som om manifestet og bildene finnes (Playwright svarer på forespørslene), så den endrer ingen filer.
// Bruk: node tools/tests/pngparts.mjs http://localhost:4173/
import { chromium } from 'playwright';
const [url] = process.argv.slice(2);

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
// Hodet: stort hår til venstre, halsstump nederst til høyre for midten (x 320 av 600)
const HEAD = svg(600, 700, '<ellipse cx="240" cy="260" rx="230" ry="240" fill="#c0501e"/><ellipse cx="330" cy="330" rx="150" ry="190" fill="#e0a080"/><rect x="290" y="480" width="60" height="220" fill="#e0a080"/>');
const TORSO = svg(700, 800, '<path d="M60 0 L640 0 L520 800 L180 800 Z" fill="#e0a080"/>');
const PELVIS = svg(600, 700, '<rect x="100" y="0" width="400" height="70" fill="#5a3a20"/><rect x="250" y="70" width="100" height="600" fill="#8a8a90"/>');
const ARM = svg(260, 900, '<rect x="60" y="0" width="140" height="760" rx="60" fill="#e0a080"/><circle cx="130" cy="780" r="110" fill="#e0a080"/>');
// Beinet: hofta øverst (sentrert på x 150), foten stikker ut mot høyre nederst
const LEG = svg(420, 1000, '<rect x="80" y="0" width="140" height="900" rx="50" fill="#e0a080"/><rect x="80" y="880" width="320" height="120" rx="40" fill="#5a3a20"/>');
// Øksa: bladet stikker ut til venstre øverst, skaftet går ned midt på x 300
const AXE = svg(500, 1400, '<rect x="285" y="0" width="30" height="1400" fill="#6a4a2a"/><path d="M285 80 L20 20 L40 420 L285 330 Z" fill="#9a9aa0"/>');
const FILES = { 'p_head.svg': HEAD, 'p_torso.svg': TORSO, 'p_pelvis.svg': PELVIS, 'p_arm.svg': ARM, 'p_leg.svg': LEG, 'p_axe.svg': AXE };
const CHARS = ['valkyra', 'gnome', 'hogman', 'skeleton'];
const parts = [];
for (const c of CHARS) {
  for (const [part, file] of [['head', 'p_head.svg'], ['torso', 'p_torso.svg'], ['pelvis', 'p_pelvis.svg'], ['arm', 'p_arm.svg'], ['leg', 'p_leg.svg'], ['weapon', 'p_axe.svg']]) parts.push({ char: c, part, file });
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(120000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.route('**/assets/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ parts }) }));
await page.route('**/assets/p_*.svg', (r) => r.fulfill({ contentType: 'image/svg+xml', body: FILES[new URL(r.request().url()).pathname.split('/').pop()] }));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2500);

const res = await page.evaluate((CHARS) => {
  const L = window.__lib, T = L.THREE;
  const out = {};
  for (const c of CHARS) {
    const id = c === 'valkyra' ? L.registerChar(L.buildHeroDef({ ...L.PRESETS.valkyra }, 41)) : c;
    const f = new L.Fighter(id, c === 'valkyra' ? 'hero' : 'enemy', { hp: 100, speed: 3 });
    f.pos.set(0, 0, 0);
    f.addTo(L.W.scene);
    const r = f.rig;
    // Rette ledd: også albuer og knær (heltene bøyer dem ellers litt i hvilestillingen)
    r.snap({ torso: 0, head: 0, armF: 0, armB: 0, legF: 0, legB: 0, weapon: 0, bodyY: 0, bodyX: 0, tilt: 0, lift: 0, elbowF: 0, elbowB: 0, kneeF: 0, kneeB: 0 });
    r.sync();
    r.root.updateMatrixWorld(true);
    const box = (name) => new T.Box3().setFromObject(r.g[name].children[0]);
    const pos = (name) => r.g[name].getWorldPosition(new T.Vector3());
    const leg = box('legF'), arm = box('armF'), torso = box('torso'), head = box('head'), belt = box('pelvis');
    const grip = r.g.weapon ? pos('weapon') : null;
    const neck = pos('head');
    const s = r.root.scale.y;
    out[c] = {
      footY: leg.min.y / s,
      gripDown: grip ? (arm.max.y - grip.y) / (arm.max.y - arm.min.y) : null,
      neckDown: (torso.max.y - neck.y) / (torso.max.y - torso.min.y),
      // Nakken skal sitte midt på halsstumpen: x 320, og det beskårne hodet går fra x 10 til 480
      neckX: (neck.x - head.min.x) / (head.max.x - head.min.x),
      beltW: (belt.max.x - belt.min.x) / s,
      axeX: grip ? (grip.x - new T.Box3().setFromObject(r.g.weapon.children[0]).min.x) / (new T.Box3().setFromObject(r.g.weapon.children[0]).max.x - new T.Box3().setFromObject(r.g.weapon.children[0]).min.x) : null,
    };
    f.remove?.();
  }
  return out;
}, CHARS);

let bad = 0;
const check = (c, name, v, want, tol) => {
  const ok = v !== null && Math.abs(v - want) <= tol;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${c.padEnd(9)} ${name.padEnd(9)} ${v === null ? '-' : v.toFixed(3)} (mål ${want} +- ${tol})`);
};
for (const c of CHARS) {
  const r = res[c];
  check(c, 'fot', r.footY, 0, 0.03);
  if (r.gripDown !== null) check(c, 'grep', r.gripDown, 0.86, 0.03);
  check(c, 'nakke', r.neckDown, 0.12, 0.03);
  check(c, 'nakke x', r.neckX, (320 - 10) / (480 - 10), 0.03);
  // Skaftet står på x 300, og den beskårne øksa går fra x 20 (bladet) til 315 (skaftets høyre kant)
  if (r.axeX !== null) check(c, 'skaft x', r.axeX, (300 - 20) / (315 - 20), 0.03);
}
// Heltens hofte skaleres etter beltet (0.5 bredt); beltet er det bredeste i bildet
console.log(`valkyra belte ${res.valkyra.beltW.toFixed(3)} (mål 0.5)`);
if (Math.abs(res.valkyra.beltW - 0.5) > 0.02) bad++;
if (logs.length) console.log(logs.join('\n'));
console.log(bad ? `FEIL: ${bad} avvik` : 'OK: alle delene sitter riktig');
process.exitCode = bad ? 1 : 0;
await browser.close();
