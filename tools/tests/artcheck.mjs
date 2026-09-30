// Kunstpakken satt sammen på riggen (de ekte bildene i public/assets, ikke testbilder):
// - neven i armbildet havner i våpenleddet på alle figurer med malt arm, både i hvilestilling og med armen løftet
//   (armer fra ChatGPT henger ikke alltid rett ned, så riggen snur og skalerer dem etter neven)
// - den bakre armen synes på heltene (Thrugg sin arm er tegnet skrått framover og forsvant bak overkroppen)
// - heltesmia beholder de malte heltene når bare våpen, tøyfarge eller magi byttes, og våpenet hentes fra bildene
// Med OUTDIR lagres et galleri per figur: fire poser med leddmarkører (blå skulder, rød neve, grønn nakke, gul hofte).
// Bruk: node tools/tests/artcheck.mjs http://localhost:4173/ [OUTDIR] [id,id,...]
import { chromium } from 'playwright';
const [url, out, only] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 560 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  const g = window.__game;
  g.goTitle();
  g.screens.hide();
});

// Figurene med malt arm (fra manifestet) og de to heltene
const ids = only ? only.split(',') : await page.evaluate(async () => {
  const man = await (await fetch('./assets/manifest.json')).json();
  const withArm = new Set(man.parts.filter((p) => p.part === 'arm').map((p) => p.char));
  const all = ['thrugg', 'valkyra', 'skeleton', 'hogman', 'cultist', 'gnome', 'gorthak', 'imp', 'zombie', 'frogman', 'troll', 'fireimp', 'bigtroll', 'hogmother', 'croakus', 'magmor', 'vorthax'];
  return all.filter((id) => { const d = window.__lib.getChar(id); return withArm.has(id) || Object.values(d.inherit ?? {}).some((c) => withArm.has(c)); });
});

// 1) Neven i våpenleddet: punktet i armbildet (hand, brøk av bildet) regnet om til verden via geometrien til armen
const fist = await page.evaluate(({ ids }) => {
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
      f.rig.root.removeFromParent();
    }
    res[id] = +Math.max(...worst).toFixed(3);
  }
  return res;
}, { ids });
check('neven i armbildet havner i våpenleddet (under 0,03 enheter, tre poser)', Object.keys(fist).length >= 10 && Object.values(fist).every((d) => d < 0.03), fist);

// 2) Den bakre armen synes på heltene: andelen av armen som ikke skjules av overkroppen. Armen rendres alene, og så
// med og uten armen i hele figuren; pikslene som endrer seg er den synlige delen.
const back = await page.evaluate(() => {
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
  for (const id of ['thrugg', 'valkyra']) {
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
    res[id] = +((100 * diff) / Math.max(1, arm)).toFixed(0);
    f.rig.root.removeFromParent();
  }
  rt.dispose();
  return res;
});
check('den bakre armen synes på heltene (minst 25 prosent av armen, før var Thrugg sin 15)', Object.values(back).every((p) => p >= 25), back);

// 3) Heltesmia: våpen, tøyfarge og magi kan byttes uten å miste de malte delene
const forge = await page.evaluate(() => {
  const L = window.__lib, P = L.PRESETS;
  const inh = (cfg) => L.buildHeroDef(cfg, 7).inherit ?? null;
  return {
    thruggAxe: inh({ ...P.thrugg, weapon: 1 }),
    thruggClubPurple: inh({ ...P.thrugg, weapon: 3, cloth: 4, magic: 2 }),
    valkyraSword: inh({ ...P.valkyra, weapon: 0 }),
    thruggHammer: inh({ ...P.thrugg, weapon: 2 }),
    otherHair: inh({ ...P.thrugg, hair: 3 }),
  };
});
check('heltesmia: Thrugg med øks og med piggkølle i lilla er fortsatt malt, med malte våpen',
  forge.thruggAxe?.head === 'thrugg' && forge.thruggAxe?.weapon === 'valkyra' && forge.thruggClubPurple?.torso === 'thrugg' && forge.thruggClubPurple?.weapon === 'hogman', forge);
check('heltesmia: Valkyra med sverd er malt, stridshammeren tegnes til den har et bilde', forge.valkyraSword?.head === 'valkyra' && forge.valkyraSword?.weapon === 'thrugg' && forge.thruggHammer?.head === 'thrugg' && !forge.thruggHammer?.weapon, forge);
check('heltesmia: annet hår gir den tegnede helten (det finnes ikke malte hårvalg ennå)', forge.otherHair === null, forge);

// Galleri (valgfritt)
if (out) {
  for (const id of ids) {
    await page.evaluate(({ id }) => {
      const g = window.__game, L = window.__lib, T = L.THREE;
      for (const f of window.__gal ?? []) f.rig.root.removeFromParent();
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
      g.camera.position.set(0, h * 0.55, 5.2 * sc);
      g.camera.lookAt(0, h * 0.5, 0);
      g.camera.fov = 45;
      g.camera.aspect = 1400 / 560;
      g.camera.updateProjectionMatrix();
      g.scene.update = () => {};
      g.renderer.setSize(1400, 560);
      g.renderer.render(S, g.camera);
    }, { id });
    await page.screenshot({ path: `${out}/art-${id}.png` });
  }
  console.log(`galleri: ${ids.length} figurer i ${out}`);
}

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: kunstpakken sitter sammen');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
