// Kunstpakken satt sammen på riggen (de ekte bildene i public/assets, ikke testbilder):
// - neven i armbildet havner i våpenleddet på alle figurer med malt arm, både i hvilestilling og med armen løftet
//   (armer fra ChatGPT henger ikke alltid rett ned, så riggen snur og skalerer dem etter neven)
// - den bakre armen synes på heltene (Thrugg sin arm er tegnet skrått framover og forsvant bak overkroppen)
// - heltesmia bruker valgte delbilder, inkludert den nye hammeren, og klassisk modus forblir tegnet
// Med OUTDIR lagres et galleri per figur: fire poser med leddmarkører (blå skulder, rød neve, grønn nakke, gul hofte).
// Bruk: node tools/tests/artcheck.mjs http://localhost:4173/ [OUTDIR] [id,id,...]
// ART_GALLERY_FILTER=id,id,... begrenser bare galleriet; alle figurene testes fortsatt.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, out, only] = process.argv.slice(2);
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 560 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
await page.addInitScript(() => localStorage.setItem('loincloth-legends-settings-v1', JSON.stringify({ quality: 'low', music: 0, sfx: 0, recorded: false })));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib);
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  const g = window.__game;
  g.goTitle();
  g.screens.hide();
});

// De fire første settene bevarer første puljes kontroll. Ork og frost testes som hele sett og med eldre lemmer.
const forgeCases = await page.evaluate(() => {
  const L = window.__lib;
  return [
    ['forge-leather', 'bald', 'leather', 'leather', 'kilt', 'sandals'],
    ['forge-plate', 'crownbraid', 'plate', 'plate', 'tassets', 'greaves'],
    ['forge-cross-male', 'eyepatch', 'leather', 'plate', 'tassets', 'greaves'],
    ['forge-cross-female', 'silvercut', 'plate', 'leather', 'kilt', 'sandals'],
    ['forge-orc', 'orc', 'orc', 'orc', 'orc', 'orc', 'sabre'],
    ['forge-frost', 'frost', 'frost', 'frost', 'frost', 'frost', 'boneclub'],
    ['forge-orc-cross', 'orc', 'orc', 'plate', 'tassets', 'greaves', 'sabre'],
    ['forge-frost-cross', 'frost', 'frost', 'leather', 'kilt', 'sandals', 'boneclub'],
  ].map(([label, head, torso, arm, pelvis, leg, weapon = 'warhammer'], i) => {
    const cfg = L.withHeroParts(L.PRESETS.thrugg, {
      head: `forge_${head}_head`, torso: `forge_${torso}_torso`, arm: `forge_${arm}_arm`,
      pelvis: `forge_${pelvis}_pelvis`, leg: `forge_${leg}_leg`, weapon: `forge_${weapon}_weapon`,
    });
    return { label, id: L.registerChar(L.buildHeroDef(cfg, 61 + i)), negativeControl: i < 4 };
  });
});
const labels = Object.fromEntries(forgeCases.map(({ id, label }) => [id, label]));

// De opprinnelige figurene med malt arm, også sjefer som arver en arm.
const originalIds = await page.evaluate(async () => {
  const man = await (await fetch('./assets/manifest.json')).json();
  const withArm = new Set(man.parts.filter((p) => p.part === 'arm').map((p) => p.char));
  const all = ['thrugg', 'valkyra', 'skeleton', 'hogman', 'cultist', 'gnome', 'gorthak', 'imp', 'zombie', 'frogman', 'troll', 'fireimp', 'bigtroll', 'hogmother', 'croakus', 'magmor', 'vorthax'];
  return all.filter((id) => { const d = window.__lib.getChar(id); return withArm.has(id) || Object.values(d.inherit ?? {}).some((c) => withArm.has(c)); });
});

const ids = only ? only.split(',').map((id) => forgeCases.find((c) => c.label === id)?.id ?? id) : [...originalIds, ...forgeCases.map(({ id }) => id)];
const requiredGrip = await page.evaluate((ids) => ids.filter((id) => !!window.__lib.getChar(id).weapon), ids);
if (!only) check('alle 13 opprinnelige bevæpnede figurer er med', ['thrugg', 'valkyra', 'skeleton', 'hogman', 'cultist', 'gorthak', 'imp', 'frogman', 'troll', 'bigtroll', 'hogmother', 'croakus', 'vorthax'].every((id) => requiredGrip.includes(id)));

// 1) Neven i våpenleddet: punktet i armbildet (hand, brøk av bildet) regnet om til verden via geometrien til armen
const fist = await page.evaluate(({ ids, labels }) => {
  const L = window.__lib, T = L.THREE, res = {};
  for (const id of ids) {
    const def = L.getChar(id);
    const src = def.inherit?.arm;
    const ov = L.getOverride(id, 'arm') ?? (src ? L.getOverride(src, 'arm') : undefined);
    if (!ov?.hand || !def.weapon) continue;
    const worst = [];
    for (const pose of [{}, { armF: 3.0, weapon: 0.1 }, { armF: 1.57, weapon: -1.57 }]) {
      const f = new L.Fighter(id, 'foe', { hp: 100, speed: 3 });
      f.rig.snap({ ...f.rig.pose, ...pose });
      f.rig.sync();
      f.rig.root.updateMatrixWorld(true);
      const mesh = f.rig.g.armF.children.find((c) => c.isMesh);
      const pos = mesh.geometry.attributes.position;
      // PlaneGeometry: hjørnene er øverst til venstre, øverst til høyre, nederst til venstre, nederst til høyre
      const P = (i) => new T.Vector3(pos.getX(i), pos.getY(i), 0);
      const tl = P(0), tr = P(1), bl = P(2);
      const p = tl.clone().add(tr.clone().sub(tl).multiplyScalar(ov.hand[0])).add(bl.clone().sub(tl).multiplyScalar(ov.hand[1]));
      mesh.localToWorld(p);
      const w = new T.Vector3();
      f.rig.g.weapon.getWorldPosition(w);
      worst.push(p.distanceTo(w) / f.rig.scale);
      f.remove();
    }
    res[labels[id] ?? id] = +Math.max(...worst).toFixed(3);
  }
  return res;
}, { ids, labels });
check('neven i armbildet havner i våpenleddet (under 0,03 enheter, tre poser)', requiredGrip.every((id) => Number.isFinite(fist[labels[id] ?? id]) && fist[labels[id] ?? id] < 0.03), fist);

// 2) Den bakre armen synes på heltene: andelen av armen som ikke skjules av overkroppen. Armen rendres alene, og så
// med og uten armen i hele figuren; pikslene som endrer seg er den synlige delen.
const back = await page.evaluate(({ forgeCases, labels }) => {
  const g = window.__game, L = window.__lib, T = L.THREE, res = {};
  const S = new T.Scene();
  S.background = new T.Color(0x000000);
  S.add(new T.AmbientLight(0xffffff, 2));
  const rt = new T.WebGLRenderTarget(256, 256);
  const cam = new T.PerspectiveCamera(35, 1, 0.1, 50);
  cam.position.set(0, 1.25, 5.2);
  cam.lookAt(0, 1.2, 0);
  const shot = () => {
    g.renderer.setRenderTarget(rt);
    g.renderer.render(S, cam);
    const px = new Uint8Array(256 * 256 * 4);
    g.renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, px);
    g.renderer.setRenderTarget(null);
    return px;
  };
  const lit = (a, i) => a[i] + a[i + 1] + a[i + 2] > 30;
  for (const id of ['thrugg', 'valkyra', ...forgeCases.map(({ id }) => id)]) {
    const f = new L.Fighter(id, 'foe', { hp: 100, speed: 3 });
    f.addTo(S);
    f.rig.root.visible = true;
    f.rig.sync();
    const all = shot();
    f.rig.g.armB.visible = false;
    const without = shot();
    // Bare armen: alle andre deler skjult (armen ligger i overkroppsgruppa, så bare selve overkroppsflaten skjules)
    f.rig.g.armB.visible = true;
    const hidden = [];
    f.rig.root.traverse((o) => { if (o.isMesh && !f.rig.g.armB.children.includes(o) && o.visible) { o.visible = false; hidden.push(o); } });
    const alone = shot();
    for (const o of hidden) o.visible = true;
    let diff = 0, arm = 0;
    for (let i = 0; i < all.length; i += 4) {
      if (lit(alone, i)) arm++;
      if (Math.abs(all[i] - without[i]) + Math.abs(all[i + 1] - without[i + 1]) + Math.abs(all[i + 2] - without[i + 2]) > 30) diff++;
    }
    res[labels[id] ?? id] = +((100 * diff) / Math.max(1, arm)).toFixed(0);
    f.remove();
  }
  rt.dispose();
  return res;
}, { forgeCases, labels });
check('den bakre armen synes på heltene (minst 25 prosent av armen, før var Thrugg sin 15)', Object.values(back).every((p) => p >= 25), back);

// Skuldersømmen: faktisk alfa i torsoen må møte øvre del av frontarmen når armen strekkes ut.
// Et eget negativt kontrollsett bruker den gamle torsoankringen (0.66) bare mens riggen bygges.
const shoulders = await page.evaluate((forgeCases) => {
  const g = window.__game, L = window.__lib, T = L.THREE, size = 512;
  const S = new T.Scene();
  const rt = new T.WebGLRenderTarget(size, size);
  const cam = new T.PerspectiveCamera(35, 1, 0.1, 50);
  cam.position.set(0, 1.25, 5.2);
  cam.lookAt(0, 1.2, 0);
  cam.updateMatrixWorld(true);
  const oldClear = g.renderer.getClearColor(new T.Color()).clone(), oldAlpha = g.renderer.getClearAlpha();
  const oldTarget = g.renderer.getRenderTarget();
  const project = (v) => { v.project(cam); return { x: (v.x + 1) * size / 2, y: (v.y + 1) * size / 2 }; };
  function contact(def, suffix) {
    const id = L.registerChar({ ...def, id: def.id + suffix });
    const f = new L.Fighter(id, 'hero', { hp: 100, speed: 3 });
    f.addTo(S);
    f.shadow.visible = false;
    f.rig.snap({ ...f.rig.pose, armF: Math.PI / 2, weapon: -Math.PI / 2 });
    f.rig.sync();
    f.rig.root.updateMatrixWorld(true);
    const torso = f.rig.g.torso.children.find((o) => o.isMesh), arm = f.rig.g.armF.children.find((o) => o.isMesh);
    const originals = [torso.material, arm.material];
    const materials = originals.map((m) => new T.MeshBasicMaterial({ map: m.map, transparent: true, alphaTest: 0.1, depthWrite: false, side: T.DoubleSide }));
    torso.material = materials[0]; arm.material = materials[1];
    f.rig.root.traverse((o) => { if (o.isMesh) o.visible = false; });
    const mask = (mesh) => {
      mesh.visible = true;
      g.renderer.setRenderTarget(rt);
      g.renderer.setClearColor(0x000000, 0);
      g.renderer.render(S, cam);
      const pixels = new Uint8Array(size * size * 4);
      g.renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);
      mesh.visible = false;
      return pixels;
    };
    try {
      const a = mask(torso), b = mask(arm);
      const shoulder = project(f.rig.g.armF.getWorldPosition(new T.Vector3()));
      const hand = project(f.rig.g.weapon.getWorldPosition(new T.Vector3()));
      const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y, len2 = dx * dx + dy * dy;
      let upperPixels = 0, touchPixels = 0, overlapPixels = 0;
      for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
        const i = (y * size + x) * 4 + 3;
        if (b[i] <= 32) continue;
        const along = ((x - shoulder.x) * dx + (y - shoulder.y) * dy) / len2;
        if (along < -0.2 || along > 0.35) continue;
        upperPixels++;
        if (a[i] > 32) overlapPixels++;
        // Ett nabopiksel tillater ekte kantkontakt med kantutjevning, ikke synlige luftglipper.
        let touches = false;
        for (let oy = -1; oy <= 1 && !touches; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (a[((y + oy) * size + x + ox) * 4 + 3] > 32) { touches = true; break; }
        }
        if (touches) touchPixels++;
      }
      return { upperPixels, touchPixels, overlapPixels };
    } finally {
      f.remove();
      torso.material = originals[0]; arm.material = originals[1];
      materials.forEach((m) => m.dispose());
    }
  }
  const result = {};
  try {
    for (const { id, label, negativeControl } of forgeCases) {
      const def = L.getChar(id), ov = L.getOverride(def.inherit.torso, 'torso');
      const current = contact(def, ':shoulder-current');
      result[label] = { current };
      if (!negativeControl) continue;
      const old = { ax: ov.ax, ox: ov.ox };
      try {
        ov.ax = 0.66; ov.ox = ov.w * ov.ax;
        result[label] = { current, previous: contact(def, ':shoulder-old') };
      } finally { ov.ax = old.ax; ov.ox = old.ox; }
    }
  } finally {
    g.renderer.setRenderTarget(oldTarget);
    g.renderer.setClearColor(oldClear, oldAlpha);
    rt.dispose();
  }
  return result;
}, forgeCases);
const shoulderMeets = ({ upperPixels, touchPixels }) => upperPixels > 0 && touchPixels >= 8;
check('alle åtte torso/arm-mikser har faktisk alfakontakt ved utstrakt skulder', Object.values(shoulders).every(({ current }) => shoulderMeets(current)), shoulders);
const oldShoulders = Object.values(shoulders).filter(({ previous }) => previous);
check('skulderregresjonen beholder de fire gamle negative kontrollene og avviser gammel ankring', oldShoulders.length === 4 && oldShoulders.some(({ previous }) => !shoulderMeets(previous)));

// 3) Heltesmia: eksplisitte delvalg er fasiten for bilde og våpenstatistikk.
const forge = await page.evaluate(() => {
  const L = window.__lib, P = L.PRESETS;
  const cfg = (base, weapon) => L.withHeroParts(base, { ...base.parts, weapon });
  const axe = cfg(P.thrugg, 'valkyra_weapon');
  const club = cfg({ ...P.thrugg, cloth: 4, magic: 2 }, 'hogman_weapon');
  const sword = cfg(P.valkyra, 'thrugg_weapon');
  const hammer = cfg(P.thrugg, 'forge_warhammer_weapon');
  const inh = (c) => L.buildHeroDef(c, 7).inherit ?? null;
  const classic = { ...P.thrugg, hair: 3 };
  delete classic.parts;
  const f = new L.Fighter(L.registerChar(L.buildHeroDef(hammer, 68)), 'hero', { hp: 100, speed: 3, weapon: L.WEAPONS[hammer.weapon] });
  const hammerImage = f.rig.g.weapon.children[0].material.map.image;
  const actualHammer = hammerImage === L.getOverride('forge_warhammer', 'weapon')?.canvas;
  f.remove();
  return {
    axe: inh(axe), club: inh(club), sword: inh(sword), hammer: inh(hammer),
    weaponStats: hammer.weapon, actualHammer, classic: inh(classic),
    changedHair: inh({ ...P.thrugg, hair: 3 }),
  };
});
check('heltesmia beholder malte kroppsdeler ved valgt øks, klubbe, tøyfarge og magi',
  forge.axe?.head === 'thrugg' && forge.axe?.weapon === 'valkyra' && forge.club?.torso === 'thrugg' && forge.club?.weapon === 'hogman', forge);
check('Valkyra kan bruke sverd, og hammeren bruker eget malt bilde med hammerstatistikk',
  forge.sword?.head === 'valkyra' && forge.sword?.weapon === 'thrugg' && forge.hammer?.weapon === 'forge_warhammer' && forge.actualHammer && forge.weaponStats === 2);
check('eksplisitt klassisk modus er tegnet; skjulte klassiske hårvalg overstyrer ikke valgt hode', forge.classic === null && forge.changedHair?.head === 'thrugg');

// Galleri (valgfritt)
if (out) {
  const filter = process.env.ART_GALLERY_FILTER?.split(',');
  const galleryIds = filter ? ids.filter((id) => filter.includes(labels[id] ?? id)) : ids;
  for (const id of galleryIds) {
    await page.evaluate(({ id }) => {
      const g = window.__game, L = window.__lib, T = L.THREE;
      for (const f of window.__gal ?? []) f.remove();
      window.__gal = [];
      const S = L.W.scene;
      S.background = new T.Color(0x5a6470);
      S.fog = null;
      for (const c of S.children) if (!c.isLight && !c.userData.__keep) c.visible = false;
      const def = L.getChar(id), sc = def.scale, J = def.joints;
      const dot = (parent, x, y, color) => {
        const m = new T.Mesh(new T.SphereGeometry(0.035 / sc, 10, 8), new T.MeshBasicMaterial({ color, depthTest: false }));
        m.position.set(x, y, 0.2);
        m.renderOrder = 999;
        parent.add(m);
      };
      [null, { armF: 3.0, armB: 2.9, weapon: 0.1, head: 0.2 }, { armF: 1.57, armB: 1.57, weapon: -1.57 }, { armF: 0, armB: 0, weapon: -1.4, legF: 0, legB: 0, torso: 0 }].forEach((pose, i) => {
        const f = new L.Fighter(id, 'foe', { hp: 100, speed: 3 });
        f.pos.set((i - 1.5) * 2.3 * sc, 0, 0);
        f.addTo(S);
        f.rig.root.visible = true;
        f.rig.root.userData.__keep = true;
        for (let k = 0; k < 20; k++) f.update(1 / 60, { minX: -40, maxX: 40, minZ: -1, maxZ: 1 });
        if (pose) f.rig.snap({ ...f.rig.pose, ...pose });
        f.rig.sync();
        const G = f.rig.g;
        dot(G.torso, J.shF[0], J.shF[1], 0x2060ff);
        dot(G.torso, J.shB[0], J.shB[1], 0x80a0ff);
        dot(G.torso, J.neck[0], J.neck[1], 0x20c040);
        dot(G.armF, J.hand[0], J.hand[1], 0xff2020);
        dot(G.armB, J.hand[0], J.hand[1], 0xff9090);
        dot(f.rig.body, J.hipF[0], J.hipF[1], 0xffe020);
        dot(f.rig.body, J.hipB[0], J.hipB[1], 0xc0a020);
        window.__gal.push(f);
      });
      const h = 2.4 * sc;
      g.camera.position.set(0, h * 0.55, 5.8 * sc);
      g.camera.lookAt(0, h * 0.5, 0);
      g.camera.fov = 45;
      g.camera.aspect = 1400 / 560;
      g.camera.updateProjectionMatrix();
      g.scene.update = () => {};
      g.renderer.setSize(1400, 560);
      g.renderer.render(S, g.camera);
    }, { id });
    await page.screenshot({ path: `${out}/art-${labels[id] ?? id}.png` });
  }
  console.log(`galleri: ${galleryIds.length} figurer i ${out}`);
}

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: kunstpakken sitter sammen');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
