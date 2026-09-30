// Kunstpakken satt sammen på riggen (de ekte bildene i public/assets, ikke testbilder):
// - neven i armbildet havner i våpenleddet på alle figurer med malt arm, både i hvilestilling og med armen løftet
//   (armer fra ChatGPT henger ikke alltid rett ned, så riggen snur og skalerer dem etter neven)
// - våpenarmen sitter på den nære skulderen og dekker skulderplaten, hodet ligger bak overkroppen, og hoggene når fram
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

// 2) Armene og hodet i trekvart profil (Tom: våpenarmen skal sitte ytterst, hodet og halsen bak overkroppen):
// - våpenarmen dekker skulderplaten på den nære skulderen (venstre i bildet): midten og fire punkter rundt den er dekket
//   av armen i hvilestilling. Før hang den bakre armen der, og platen (som et hull i skulderen) synes.
// - hodet ligger bak overkroppen, unntatt hoder med langt skjegg (front i manifestet)
// - den fjerne armen (på forsiden av kroppen) synes på Thrugg i hvilestilling
const layer = await page.evaluate(({ ids }) => {
  const g = window.__game, L = window.__lib, T = L.THREE, res = { cover: {}, headZ: {}, far: 0 };
  const S = new T.Scene();
  S.background = new T.Color(0x000000);
  S.add(new T.AmbientLight(0xffffff, 2));
  const N = 256;
  const rt = new T.WebGLRenderTarget(N, N);
  const cam = new T.PerspectiveCamera(35, 1, 0.1, 50);
  const shot = () => {
    g.renderer.setRenderTarget(rt);
    g.renderer.render(S, cam);
    const px = new Uint8Array(N * N * 4);
    g.renderer.readRenderTargetPixels(rt, 0, 0, N, N, px);
    g.renderer.setRenderTarget(null);
    return px;
  };
  const lit = (a, i) => a[i] + a[i + 1] + a[i + 2] > 30;
  // Vis bare delene i keep (resten skjules), ta bilde og vis alt igjen
  const only = (f, keep) => {
    const hidden = [];
    f.rig.root.traverse((o) => { if (o.isMesh && !keep.includes(o) && o.visible) { o.visible = false; hidden.push(o); } });
    const px = shot();
    for (const o of hidden) o.visible = true;
    return px;
  };
  for (const id of ids) {
    const f = new L.Fighter(id, 'foe', { hp: 100, speed: 3 });
    f.addTo(S);
    f.rig.root.visible = true;
    f.rig.snap({ ...L.NEUTRAL });
    f.rig.sync();
    const sc = f.rig.scale;
    cam.position.set(0, 1.2 * sc, 5.2 * sc);
    cam.lookAt(0, 1.15 * sc, 0);
    cam.updateMatrixWorld();
    f.rig.root.updateMatrixWorld(true);
    res.headZ[id] = +f.rig.g.head.position.z.toFixed(3);
    const arm = f.rig.g.armF.children.filter((c) => c.isMesh);
    const px = only(f, arm);
    const [sx, sy] = f.rig.joints.shF;
    // Ringen er 3 prosent av bredden på overkroppen (platene er 10 til 14 prosent brede)
    const tp = f.rig.g.torso.children.find((c) => c.isMesh).geometry.attributes.position;
    const r = 0.03 * Math.abs(tp.getX(1) - tp.getX(0));
    let hit = 0;
    const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
    for (const [dx, dy] of pts) {
      const p = f.rig.g.torso.localToWorld(new T.Vector3(sx + dx, sy + dy, 0)).project(cam);
      const x = Math.round((p.x * 0.5 + 0.5) * (N - 1)), y = Math.round((p.y * 0.5 + 0.5) * (N - 1));
      if (x >= 0 && y >= 0 && x < N && y < N && lit(px, (y * N + x) * 4)) hit++;
    }
    res.cover[id] = hit / pts.length;
    if (id === 'thrugg') {
      // Den fjerne armen: andelen av armen som synes i hele figuren (armen alene mot figuren med og uten armen)
      const all = shot();
      f.rig.g.armB.visible = false;
      const without = shot();
      f.rig.g.armB.visible = true;
      const alone = only(f, f.rig.g.armB.children.filter((c) => c.isMesh));
      let diff = 0, n = 0;
      for (let i = 0; i < all.length; i += 4) {
        if (lit(alone, i)) n++;
        if (Math.abs(all[i] - without[i]) + Math.abs(all[i + 1] - without[i + 1]) + Math.abs(all[i + 2] - without[i + 2]) > 30) diff++;
      }
      res.far = Math.round((100 * diff) / Math.max(1, n));
    }
    f.rig.root.removeFromParent();
  }
  rt.dispose();
  return res;
}, { ids });
// Impen har en tynn arm og en stor skulderkule i bildet, så noe av kula synes uansett (står på lista til ChatGPT)
check('våpenarmen dekker skulderplaten på den nære skulderen (hvilestilling, alle fem punktene på heltene, minst tre på alle)',
  Object.keys(layer.cover).length >= 10 && Object.values(layer.cover).every((c) => c >= 0.6) && ['thrugg', 'valkyra', 'gorthak'].every((id) => layer.cover[id] === 1), layer.cover);
const bearded = ['gnome', 'vorthax'];
check('hodet ligger bak overkroppen, hoder med langt skjegg foran', Object.entries(layer.headZ).every(([id, z]) => (bearded.includes(id) ? z > 0 : z < 0)), layer.headZ);
check('den fjerne armen synes på Thrugg i hvilestilling (minst 25 prosent av armen)', layer.far >= 25, { thrugg: layer.far });

// 3) Hoggene når fram: våpentuppen i slaget (steg inn og armen strukket fram) mot det den gamle riggen nådde.
// Våpenarmen sitter bak på kroppen etter byttet, så uten steget og armen fram ville sverdet stoppet ved hofta.
const reach = await page.evaluate(() => {
  const L = window.__lib, T = L.THREE, res = {};
  for (const id of ['thrugg', 'valkyra']) {
    for (const a of [L.HERO_ATK.slash1, L.HERO_ATK.chop, L.HERO_ATK.jump]) {
      const f = new L.Fighter(id, 'foe', { hp: 100, speed: 3 });
      f.rig.snap({ ...L.NEUTRAL, ...a.strike });
      f.rig.sync();
      res[id + ' ' + a.id] = +(f.rig.weaponTip(new T.Vector3()).x - f.pos.x).toFixed(2);
      f.rig.root.removeFromParent();
    }
  }
  return res;
});
check('hoggene når fram (våpentuppen minst 1,3 foran heltene, den gamle riggen nådde 1,4 til 1,7)', Object.values(reach).every((x) => x >= 1.3), reach);

// Hver malt overkropp har målte skulderledd og halsrot i manifestet (ellers gjetter spillet, og armene og hodet havner
// ved siden av det som er malt)
const unmeasured = await page.evaluate(async () => {
  const man = await (await fetch('./assets/manifest.json')).json();
  const beasts = ['warhog', 'cluckatrice', 'magmanewt'];
  return man.parts.filter((p) => p.part === 'torso' && !beasts.includes(p.char) && !(p.shoulders && p.neck)).map((p) => p.char);
});
check('alle malte overkropper har shoulders og neck i manifestet', unmeasured.length === 0, unmeasured);

// 4) Heltesmia: våpen, tøyfarge og magi kan byttes uten å miste de malte delene
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
      const def = L.getChar(id), sc = def.scale;
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
        const G = f.rig.g, J = f.rig.joints;
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
