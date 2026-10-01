// Albuer og knær som bøyer seg (gfx/rig.ts, bend i CharDef): Thrugg i en rekke stillinger, våpenet i neven,
// føttene på bakken, fiendene uten bøy, og bøyen følger med når armen ryker.
// Bruk: node tools/tests/bend.mjs URL [OUTDIR] [stillinger] [stiff]
//   stillinger: kommaliste (se POSES nedenfor), eller all. stiff: hver stilling vises også uten bøy (før og etter).
import { chromium } from 'playwright';
const [url, out, onlyArg, stiffArg] = process.argv.slice(2);
const only = onlyArg && onlyArg !== 'all' ? onlyArg : '';
const stiff = stiffArg === 'stiff';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 720 } });
page.setDefaultTimeout(300000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) logs.push('console: ' + m.text()); });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib, null, { timeout: 120000 });
await page.waitForTimeout(1500);

let fails = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}${info ? '  ' + info : ''}`);
  if (!ok) fails++;
};

// Stillingene som vises og sjekkes. state gir figurens egen animasjon (gange og løp i en fase), pose en stilling fra P.
const POSES = [
  { name: 'idle', state: 'idle' },
  { name: 'walk0', state: 'walk', ph: 0 },
  { name: 'walk1', state: 'walk', ph: 0.8 },
  { name: 'walk2', state: 'walk', ph: 1.6 },
  { name: 'walk3', state: 'walk', ph: 2.4 },
  { name: 'run', state: 'walk', ph: 0.9, run: true },
  { name: 'run2', state: 'walk', ph: 2.4, run: true },
  { name: 'slashW', pose: 'slashW' },
  { name: 'slashS', pose: 'slashS' },
  { name: 'chopW', pose: 'chopW' },
  { name: 'chopS', pose: 'chopS' },
  { name: 'crouch', pose: 'crouch' },
  { name: 'kickW', pose: 'kickW' },
  { name: 'kickS', pose: 'kickS' },
  { name: 'jump', pose: 'jump', air: true },
  { name: 'fall', pose: 'fall', air: true },
  { name: 'hurt', pose: 'hurt' },
  { name: 'taunt', pose: 'taunt' },
  { name: 'victory', pose: 'victory' },
  { name: 'getup', pose: 'getup' },
  { name: 'blockLo', pose: 'blockLo' },
  { name: 'sweepS', pose: 'sweepS' },
  { name: 'hold', state: 'hold' },
  { name: 'backW', pose: 'backW' },
  { name: 'backS', pose: 'backS' },
  { name: 'dashS', pose: 'dashS' },
  { name: 'spin', pose: 'spin' },
  { name: 'blockHi', pose: 'blockHi' },
  { name: 'magic', pose: 'magic' },
  { name: 'stunned', pose: 'stunned' },
  { name: 'sweepW', pose: 'sweepW' },
  { name: 'jumpW', pose: 'jumpW', air: true },
  { name: 'jumpS', pose: 'jumpS', air: true },
  { name: 'neckS', pose: 'neckS', air: true },
  { name: 'roll', pose: 'roll', air: true },
];
const list = only ? POSES.filter((p) => only.split(',').includes(p.name)) : POSES;

const res = await page.evaluate(({ list, stiff }) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__game, L = window.__lib;
  g.goTitle();
  g.screens.hide();
  for (const a of g.scene.actors) a.remove();
  g.scene.actors = [];
  g.scene.update = () => {};
  const bounds = { minX: -40, maxX: 40, minZ: -1, maxZ: 1 };
  const hero = (slot, noBend) => {
    const def = L.buildHeroDef(L.PRESETS.thrugg, slot);
    return L.registerChar(noBend ? { ...def, id: def.id + '-stiff', bend: false } : def);
  };
  const settle = (f, item) => {
    for (let k = 0; k < 40; k++) f.update(1 / 60, bounds);
    if (item.state) {
      f.setState(item.state);
      f.running = !!item.run;
      if (item.state === 'hold') f.data.pummelT = 0.1;
    }
    if (item.ph !== undefined) f.walkPh = item.ph;
    for (let k = 0; k < 90; k++) {
      if (item.ph !== undefined) f.walkPh = item.ph;
      if (item.state === 'hold') f.data.pummelT = 0.1;
      if (item.pose) {
        f.rig.drive(L.bentPose(L.P[item.pose], true), 30, 1 / 60);
        f.rig.plant(!item.air, 1 / 60);
        f.rig.sync();
      } else f.animate(1 / 60);
    }
  };
  const out = { feet: {}, rows: [] };

  // 1) Thrugg bøyer, skjelettet ikke
  const t = new L.Fighter(hero(40), 'hero', { hp: 100, speed: 3 });
  t.addTo(L.W.scene);
  t.rig.snap({ ...L.NEUTRAL, elbowF: 1.2, elbowB: 0.8, kneeF: 0.9, kneeB: 0.5 });
  t.rig.sync();
  out.thruggFlex = ['armF', 'armB', 'legF', 'legB'].map((l) => +t.rig.flexOf(l).toFixed(3));
  // Våpenet i neven: våpenleddet i verden mot den bøyde neven regnet fra armens ledd
  t.rig.root.updateMatrixWorld(true);
  const wpn = t.rig.g.weapon.getWorldPosition(new L.THREE.Vector3());
  const b = t.rig.bends.armF;
  const [hx, hy] = t.rig.joints.hand;
  const A = b.angle, dx = hx - b.e[0], dy = hy - b.e[1];
  const hand = t.rig.worldPoint('armF', b.e[0] + dx * Math.cos(A) - dy * Math.sin(A), b.e[1] + dx * Math.sin(A) + dy * Math.cos(A));
  out.weaponGap = wpn.distanceTo(hand);
  out.weaponRot = +(t.rig.g.weapon.rotation.z - t.rig.pose.weapon).toFixed(3);
  const wl = t.rig.g.weapon.position, hl = [b.e[0] + dx * Math.cos(A) - dy * Math.sin(A), b.e[1] + dx * Math.sin(A) + dy * Math.cos(A)];
  out.weaponGap = Math.hypot(wl.x - hl[0], wl.y - hl[1]);
  // Geometrien: hjørnene over leddet står, de nederste er dreid
  const pos = b.geo.attributes.position.array;
  let moved = 0, still = 0;
  for (let i = 0; i < b.w.length; i++) {
    const d = Math.hypot(pos[i * 3] - b.rest[i * 3], pos[i * 3 + 1] - b.rest[i * 3 + 1]);
    if (b.w[i] === 0 && d < 1e-6) still++;
    if (b.w[i] === 1 && d > 0.05) moved++;
  }
  out.verts = { n: b.w.length, still, moved };
  const sk = new L.Fighter('skeleton', 'foe', { hp: 30, speed: 2 });
  sk.addTo(L.W.scene);
  sk.rig.snap({ ...L.NEUTRAL, elbowF: 1.2, kneeF: 0.9 });
  sk.rig.sync();
  out.skelFlex = ['armF', 'legF'].map((l) => sk.rig.flexOf(l));
  sk.remove();

  // 2) Armen ryker: den løse armen beholder bøyen, og riggen fortsetter uten den
  t.rig.snap({ ...L.NEUTRAL, elbowF: 1.0 });
  t.rig.sync();
  const loose = t.rig.detach('armF', L.W.scene);
  t.rig.snap({ ...L.NEUTRAL, elbowF: 0.1 });
  t.rig.sync();
  out.looseFlex = +b.angle.toFixed(3);
  out.looseOk = !!loose && t.rig.detached.has('weapon');
  loose?.removeFromParent();
  t.remove();

  // 3) Stillingene: føttene og et bilde (med stiff også den samme stillingen uten bøy)
  const W0 = 1.75;
  const figs = [];
  list.forEach((item, i) => {
    for (const noBend of stiff ? [true, false] : [false]) figs.push({ item, noBend, i });
  });
  window.__bendFigs = [];
  figs.forEach(({ item, noBend }, i) => {
    const f = new L.Fighter(hero(41 + i, noBend), 'hero', { hp: 100, speed: 3 });
    f.label = (noBend ? 'STIFF ' : '') + item.name;
    f.pos.set(i * W0, 0, 0);
    f.facing = 1;
    f.addTo(L.W.scene);
    settle(f, item);
    f.rig.root.updateMatrixWorld(true);
    if (!noBend) {
      const ff = f.rig.footPoint('legF'), fb = f.rig.footPoint('legB');
      out.feet[item.name] = { f: +ff.y.toFixed(3), b: +fb.y.toFixed(3), flex: ['armF', 'armB', 'legF', 'legB'].map((l) => +f.rig.flexOf(l).toFixed(2)) };
    }
    out.rows.push(f.label);
    window.__bendFigs.push(f);
  });
  return out;
}, { list, stiff });

check('Thrugg bøyer albuer og knær', res.thruggFlex.every((v, i) => Math.abs(v - [1.2, 0.8, 0.9, 0.5][i]) < 0.01), JSON.stringify(res.thruggFlex));
check('våpenet følger den bøyde neven', res.weaponGap < 0.002, 'avstand ' + res.weaponGap.toFixed(4));
check('bladet beholder retningen fra stillingen', Math.abs(res.weaponRot) < 0.001, 'dreiing ' + res.weaponRot);
check('geometrien: overarmen står, underarmen er dreid', res.verts.still > 10 && res.verts.moved > 10, JSON.stringify(res.verts));
check('skjelettet (uten bend) bøyer ikke', res.skelFlex.every((v) => v === 0), JSON.stringify(res.skelFlex));
check('den løse armen beholder bøyen', Math.abs(res.looseFlex - 1.0) < 0.01 && res.looseOk, 'vinkel ' + res.looseFlex);
for (const [name, v] of Object.entries(res.feet)) console.log(`     ${name.padEnd(8)} fot foran ${String(v.f).padStart(6)}  fot bak ${String(v.b).padStart(6)}  bøy ${JSON.stringify(v.flex)}`);

if (out) {
  // Bilder: fire figurer per bilde, med navnet på stillingen under hver
  const per = 4, n = res.rows.length;
  for (let s = 0; s * per < n; s++) {
    await page.evaluate(({ s, per, W0 }) => {
      const g = window.__game, L = window.__lib;
      // Bare figurene i denne omgangen, flyttet til midten av arenaen, så bakgrunnen er den samme i alle bildene
      document.querySelectorAll('.bend-label').forEach((e) => e.remove());
      g.camera.fov = 30;
      g.camera.aspect = 1600 / 720;
      g.camera.updateProjectionMatrix();
      g.camera.position.set(0, 1.25, 8.6);
      g.camera.lookAt(0, 1.15, 0);
      g.camera.updateMatrixWorld(true);
      window.__bendFigs.forEach((f, i) => {
        const k = i - s * per;
        f.rig.root.visible = k >= 0 && k < per;
        f.rig.root.position.x = (k - (per - 1) / 2) * W0;
        f.shadow.position.x = f.rig.root.position.x;
        f.shadow.visible = f.rig.root.visible;
        if (!f.rig.root.visible) return;
        const v = new L.THREE.Vector3(f.rig.root.position.x, -0.15, 0).project(g.camera);
        const el = document.createElement('div');
        el.className = 'bend-label';
        el.textContent = f.label;
        el.style.cssText = `position:fixed;left:${(v.x * 0.5 + 0.5) * innerWidth - 90}px;top:${(-v.y * 0.5 + 0.5) * innerHeight}px;width:180px;text-align:center;font:bold 20px monospace;color:#fff;background:#000a;z-index:99999`;
        document.body.append(el);
      });
      g.renderer.render(L.W.scene, g.camera);
    }, { s, per, W0: 2.3 });
    await page.screenshot({ path: `${out}/bend-${s + 1}.png` });
    console.log(`bilde ${out}/bend-${s + 1}.png: ${res.rows.slice(s * per, s * per + per).join(', ')}`);
  }
}
console.log(fails ? `${fails} FEIL` : 'ALT OK');
if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
process.exit(fails ? 1 : 0);
