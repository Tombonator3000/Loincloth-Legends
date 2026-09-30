// Separate malte hodelag og farger: ekte bildepiksler, rigg, lagring og begge spillernes UI.
// Bruk: node tools/tests/hero-appearance.mjs URL [OUTDIR]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright';

const [url, out] = process.argv.slice(2);
if (!url) throw new Error('Bruk: node tools/tests/hero-appearance.mjs URL [OUTDIR]');
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [], failures = [];
let count = 0;
function check(name, ok, detail) {
  count++;
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}${!ok && detail !== undefined ? ': ' + JSON.stringify(detail) : ''}`);
  if (!ok) failures.push(name);
}
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('loincloth-legends-settings-v1', JSON.stringify({ quality: 'low', music: 0, sfx: 0, recorded: false }));
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
  return page;
}
async function boot(page) {
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => window.__game && window.__lib);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
}
async function shot(page, name) {
  if (!out) return;
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.__game.resize(); window.__game.tick(1 / 60, true); });
  await page.screenshot({ path: `${out}/appearance-${name}.png` });
}

try {
  const page = await newPage();
  await boot(page);
  const model = await page.evaluate(() => {
    const L = window.__lib, checks = [];
    const normalized = (v) => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
    const base = (body) => L.withHeroParts(L.PRESETS[body ? 'valkyra' : 'thrugg'], {
      ...L.defaultHeroParts(body), head: `forge_custom_${body ? 'f' : 'm'}_head`,
    });
    const maleLook = { ...L.defaultHeroAppearance(), hair: 'mohawk', beard: 'braided', headgear: 'headband', skinTone: 'deep', eyeColor: 'green', hairColor: 'ginger', eyeStyle: 'slit' };
    const femaleLook = { ...L.defaultHeroAppearance(), hair: 'long', beard: 'mustache', headgear: 'horned', skinTone: 'orc', eyeColor: 'violet', hairColor: 'white' };
    const presetBefore = JSON.stringify(L.PRESETS);
    const a = L.withHeroAppearance(base(0), maleLook), b = L.withHeroAppearance(base(1), femaleLook);
    const cloned = L.cloneHero(a), changed = L.withHeroParts(a, { ...a.parts, arm: 'valkyra_arm' });
    cloned.appearance.hair = 'none';
    changed.appearance.beard = 'none';
    maleLook.eyeColor = 'red';
    checks.push(['kopier og innsendte valg deler ikke utseende med helter eller presets', a.appearance.hair === 'mohawk' && a.appearance.beard === 'braided' && a.appearance.eyeColor === 'green' && JSON.stringify(L.PRESETS) === presetBefore && b.appearance !== a.appearance]);
    checks.push(['mann og kvinne kan kombinere uavhengige lag uten å bytte kropp eller våpen', a.body === 0 && b.body === 1 && a.parts.head === 'forge_custom_m_head' && b.parts.head === 'forge_custom_f_head' && b.appearance.beard === 'mustache' && a.weapon === 0 && b.weapon === 1]);
    const keys = L.HERO_APPEARANCE_KEYS.map((key) => {
      const option = L.HERO_APPEARANCE[key].find((p) => p.id !== a.appearance[key]);
      return L.buildHeroDef(L.withHeroAppearance(a, { ...a.appearance, [key]: option.id }), 90).id;
    });
    checks.push(['hvert av de sju utseendevalgene har egen rigg-/teksturnøkkel', new Set([L.buildHeroDef(a, 90).id, ...keys]).size === 8]);
    const save = L.defaultSave();
    save.heroes = [L.cloneHero(a), L.cloneHero(b)];
    L.writeSave(save);
    checks.push(['begge helters deler og utseende overlever lagring', normalized(L.loadSave().heroes) === normalized(save.heroes)]);
    save.heroes[0].appearance.hair = 'removed-hair';
    save.heroes[0].appearance.eyeColor = null;
    save.heroes[0].appearance.extra = 'ignored';
    L.writeSave(save);
    const clean = L.loadSave().heroes[0].appearance;
    checks.push(['ukjente utseende-ID-er repareres enkeltvis', clean.hair === 'none' && clean.eyeColor === 'original' && clean.beard === 'braided' && clean.skinTone === 'deep' && !('extra' in clean)]);
    save.heroes[0] = L.withHeroAppearance(a, { ...a.appearance, headgear: 'crown', skinTone: 'frost', hairColor: 'blue' });
    L.writeSave(save);
    const locked = L.loadSave().heroes[0].appearance;
    checks.push(['låste utseendevalg kan ikke komme inn via lagringen', locked.headgear === 'none' && locked.skinTone === 'original' && locked.hairColor === 'original' && locked.beard === 'braided']);
    save.unlocked = ['helmet:4', 'skin:6', 'hairColor:6'];
    L.writeSave(save);
    checks.push(['opplåste utseendevalg beholdes i lagringen', JSON.stringify(L.loadSave().heroes[0].appearance) === JSON.stringify(save.heroes[0].appearance)]);
    const legacy = L.defaultSave();
    L.writeSave(legacy);
    checks.push(['eksisterende malte helter får ingen utseendeendring ved lasting', L.loadSave().heroes.every((h) => h.appearance === undefined) && JSON.stringify(L.loadSave().heroes) === JSON.stringify(legacy.heroes)]);
    const classic = { ...a };
    delete classic.parts;
    checks.push(['klassisk modus bruker ikke malte utseendelag', !L.cloneHero(classic).appearance && !L.buildHeroDef(classic, 92).appearance]);
    const baked = L.withHeroParts(a, { ...a.parts, head: 'thrugg_head' });
    checks.push(['valg lagres når et ferdigmalt hode velges uten å bytte det automatisk', baked.parts.head === 'thrugg_head' && JSON.stringify(baked.appearance) === JSON.stringify(a.appearance)]);
    localStorage.removeItem('loincloth-legends-save-v1');
    return checks;
  });
  for (const [name, ok, detail] of model) check(name, ok, detail);

  const pixels = await page.evaluate(() => {
    const L = window.__lib, checks = [];
    const bytes = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const baseConfig = (sex) => L.withHeroParts(L.PRESETS[sex === 'f' ? 'valkyra' : 'thrugg'], {
      ...L.defaultHeroParts(sex === 'f' ? 1 : 0), head: `forge_custom_${sex}_head`,
    });
    let next = 100;
    const def = (sex, look = {}) => L.buildHeroDef(L.withHeroAppearance(baseConfig(sex), { ...L.defaultHeroAppearance(), ...look }), next++);
    const toneDef = def('m', { skinTone: 'frost' });
    const skinResults = [];
    for (const [slot, options] of Object.entries(L.HERO_PARTS)) {
      if (slot === 'weapon') continue;
      for (const option of options) {
        const ov = L.getOverride(option.source, slot), region = L.HERO_SKIN_REGIONS[option.id];
        if (!ov || !region) { skinResults.push({ id: option.id, slot, missing: true }); continue; }
        const original = bytes(ov.canvas), result = L.applyHeroSkin(toneDef, slot, option.source, ov), changed = bytes(result.canvas);
        const mask = document.createElement('canvas'); mask.width = ov.canvas.width; mask.height = ov.canvas.height;
        const c = mask.getContext('2d', { willReadFrequently: true });
        const fill = (polys) => {
          for (const p of polys) {
            c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(x * mask.width, y * mask.height) : c.moveTo(x * mask.width, y * mask.height)); c.closePath(); c.fill();
          }
        };
        c.fillStyle = '#fff'; fill(region.include);
        c.globalCompositeOperation = 'destination-out'; fill(region.exclude ?? []);
        const allowed = bytes(mask);
        let alpha = true, outside = 0, count = 0;
        const outsideSamples = [];
        for (let i = 0; i < original.length; i += 4) {
          if (original[i + 3] !== changed[i + 3]) alpha = false;
          if (original[i] !== changed[i] || original[i + 1] !== changed[i + 1] || original[i + 2] !== changed[i + 2]) {
            count++;
            if (!allowed[i + 3]) {
              outside++;
              if (outsideSamples.length < 3) outsideSamples.push({ x: (i / 4) % ov.canvas.width, y: Math.floor(i / 4 / ov.canvas.width), before: [...original.slice(i, i + 4)], after: [...changed.slice(i, i + 4)] });
            }
          }
        }
        skinResults.push({ id: option.id, slot, alpha, outside, outsideSamples, count, expectedSkin: region.include.length > 0, sourceIntact: equal(original, bytes(ov.canvas)), geometry: ['w', 'h', 'ox', 'oy', 'ax', 'ay'].every((k) => result[k] === ov[k]) });
      }
    }
    checks.push(['alle hudvalg har registrerte masker og lar kildebilder, alfa og geometri være urørt', skinResults.every((r) => !r.missing && r.alpha && r.sourceIntact && r.geometry), skinResults.filter((r) => r.missing || !r.alpha || !r.sourceIntact || !r.geometry)]);
    checks.push(['hudfarge endrer bare registrerte områder; hudfrie rustningsdeler er byte-identiske', skinResults.every((r) => !r.missing && r.outside === 0 && (r.expectedSkin ? r.count > 0 : r.count === 0)), skinResults.filter((r) => r.missing || r.outside || (r.expectedSkin ? !r.count : r.count))]);
    const bodySkin = skinResults.filter((r) => ['torso', 'arm', 'leg'].includes(r.slot) && r.count > 100);
    checks.push(['alle 23 kroppsbilder med synlig hud får faktisk nye farger', bodySkin.length === 23, bodySkin.map((r) => r.id)]);

    // Faste materialpunkter valgt fra selve kunsten, uavhengig av polygonene i implementasjonen.
    const probes = {
      forge_custom_m_head: [[.4, .5], [[.63, .317], [.60, .235], [.80, .558]]],
      forge_custom_f_head: [[.4, .5], [[.65, .32], [.60, .237], [.79, .573]]],
      thrugg_head: [[.58, .5], [[.55, .28], [.25, .77], [.15, .30], [.63, .74]]],
      valkyra_head: [[.52, .54], [[.22, .35], [.30, .68], [.51, .45], [.60, .62]]],
      gorthak_head: [[.55, .86], [[.61, .36], [.25, .35]]],
      thrugg_torso: [[.54, .76], [[.48, .25], [.71, .47], [.2, .15]]],
      valkyra_torso: [[.6, .45], [[.51, .24], [.73, .23], [.39, .6]]],
      gorthak_torso: [[.66, .77], [[.2, .18], [.6, .38], [.6, .94]]],
      forge_leather_torso: [[.53, .75], [[.62, .36], [.67, .28]]],
      forge_plate_torso: [[.55, .23], [[.49, .56], [.34, .2]]],
      forge_orc_torso: [[.6, .23], [[.53, .5], [.4, .2]]],
      forge_frost_torso: [[.49, .7], [[.6, .45], [.48, .28], [.7, .37]]],
      thrugg_arm: [[.25, .25], [[.7, .72]]],
      valkyra_arm: [[.68, .12], [[.5, .28], [.49, .6]]],
      gorthak_arm: [[.5, .2], [[.43, .59]]],
      forge_leather_arm: [[.37, .28], [[.5, .72]]],
      forge_plate_arm: [[.4, .15], [[.35, .27], [.36, .63]]],
      forge_orc_arm: [[.4, .25], [[.65, .65], [.33, .63]]],
      forge_frost_arm: [[.4, .24], [[.45, .55], [.57, .62], [.59, .72]]],
      forge_ash_arm: [[.4, .25], [[.59, .64], [.32, .64]]],
    };
    for (const p of L.HERO_PARTS.leg) if (p.id !== 'forge_warden_leg') {
      probes[p.id] = [[.3, .2], [p.id === 'gorthak_leg' ? [.5, .47] : p.id === 'forge_sandals_leg' ? [.45, .628] : [.45, .73]]];
    }
    const sample = (cv, [x, y]) => [...cv.getContext('2d').getImageData(Math.round(x * (cv.width - 1)), Math.round(y * (cv.height - 1)), 1, 1).data];
    const skinProbes = [], protectedProbes = [];
    for (const [id, [skinPoint, materials]] of Object.entries(probes)) {
      const p = Object.values(L.HERO_PARTS).flat().find((p) => p.id === id), ov = L.getOverride(p.source, p.slot);
      const tinted = L.applyHeroSkin(toneDef, p.slot, p.source, ov).canvas;
      const before = sample(ov.canvas, skinPoint), after = sample(tinted, skinPoint);
      skinProbes.push({ id, before, after, ok: before[3] > 128 && after.some((v, i) => i < 3 && v !== before[i]) && after[0] <= after[1] && after[1] <= after[2] });
      for (const point of materials) {
        const a = sample(ov.canvas, point), b = sample(tinted, point);
        protectedProbes.push({ id, point, a, b, ok: a[3] > 128 && equal(a, b) });
      }
    }
    checks.push(['målte hudpunkter i varme, grønne og blå deler får samme blå fargeretning', skinProbes.every((p) => p.ok), skinProbes.filter((p) => !p.ok)]);
    checks.push(['målte metall-, lær-, pels-, bein- og støvelpunkter beholder eksakt RGBA', protectedProbes.every((p) => p.ok), protectedProbes.filter((p) => !p.ok)]);
    const chinBase = L.getOverride('forge_custom_m', 'head');
    const chinBefore = sample(chinBase.canvas, [.70, .80]);
    const chinAfter = sample(L.applyHeroSkin(toneDef, 'head', 'forge_custom_m', chinBase).canvas, [.70, .80]);
    checks.push(['mettet hakeskygge farges sammen med huden uten å etterlate en varm stripe', chinBefore[3] > 128 && chinAfter[0] <= chinAfter[1] && chinAfter[1] <= chinAfter[2] && !equal(chinBefore, chinAfter), { before: chinBefore, after: chinAfter }]);

    for (const sex of ['m', 'f']) {
      const source = `forge_custom_${sex}`, base = L.getOverride(source, 'head'), layout = L.HERO_APPEARANCE_LAYOUTS[source];
      const assemble = (look) => L.composeHeroHead(def(sex, look), base);
      const plain = assemble({}), plainBytes = bytes(plain.head.canvas);
      const noHairColor = assemble({ hairColor: 'blue' });
      checks.push([`${sex}: hårfarge uten hår/skjegg endrer ingen ansiktspiksler`, equal(plainBytes, bytes(noHairColor.head.canvas))]);
      const iris = assemble({ eyeColor: 'green' }), slit = assemble({ eyeColor: 'green', eyeStyle: 'slit' });
      const a = bytes(iris.head.canvas), b = bytes(slit.head.canvas), mask = layout.eyes;
      const dx = plain.head.ax * plain.head.canvas.width - base.ax * base.canvas.width;
      const dy = plain.head.ay * plain.head.canvas.height - base.ay * base.canvas.height;
      let changedEyes = 0, styleChanges = 0, outsideEyes = 0, alphaChanged = 0;
      const eyeHits = [0, 0];
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] !== plainBytes[i + 3] || b[i + 3] !== plainBytes[i + 3]) alphaChanged++;
        const changed = [0, 1, 2].some((k) => a[i + k] !== plainBytes[i + k]);
        const styled = [0, 1, 2].some((k) => b[i + k] !== a[i + k]);
        if (!changed && !styled) continue;
        if (changed) changedEyes++;
        if (styled) styleChanges++;
        const x = (i / 4) % iris.head.canvas.width - dx, y = Math.floor(i / 4 / iris.head.canvas.width) - dy;
        const inEyes = mask.map((e) => {
          const px = x - e.at[0] * base.canvas.width, py = y - e.at[1] * base.canvas.height, angle = e.rotation ?? 0;
          const rx = e.radius[0] * base.canvas.width + 1.5, ry = e.radius[1] * base.canvas.height + 1.5;
          return ((px * Math.cos(angle) + py * Math.sin(angle)) / rx) ** 2 + ((-px * Math.sin(angle) + py * Math.cos(angle)) / ry) ** 2 <= 1;
        });
        inEyes.forEach((inside, j) => { if (inside && changed) eyeHits[j]++; });
        if (!inEyes.some(Boolean)) outsideEyes++;
      }
      checks.push([`${sex}: øyenfarge og pupillstil endrer begge iriser, med intakt ansikt og alfa utenfor`, changedEyes > 5 && styleChanges > 2 && eyeHits.every((n) => n > 2) && outsideEyes === 0 && alphaChanged === 0, { changedEyes, styleChanges, eyeHits, outsideEyes, alphaChanged }]);
      for (const headgear of ['horned', 'skull']) {
        const covered = assemble({ hair: 'wild', headgear }), bald = assemble({ hair: 'none', headgear });
        checks.push([`${sex}: ${headgear} dekker fremre hår helt`, equal(bytes(covered.head.canvas), bytes(bald.head.canvas))]);
      }
      const dark = assemble({ hair: 'long', beard: 'full', hairColor: 'black' });
      const white = assemble({ hair: 'long', beard: 'full', hairColor: 'white' });
      checks.push([`${sex}: hår og skjegg farges hver for seg foran og bak hodet`, !equal(bytes(dark.head.canvas), bytes(white.head.canvas)) && !!dark.back && !!dark.front && !equal(bytes(dark.back.canvas), bytes(white.back.canvas)) && !equal(bytes(dark.front.canvas), bytes(white.front.canvas))]);
      const samples = [assemble({ hair: 'none' }), dark, assemble({ hair: 'mohawk', headgear: 'crown' }), assemble({ beard: 'braided', headgear: 'skull' })];
      const unitsX = base.w / base.canvas.width, unitsY = base.h / base.canvas.height;
      checks.push([`${sex}: store hår/hjelmlag beholder ansiktsskala og fysisk halsanker`, samples.every(({ head }) => {
        const offsetX = head.ax * head.canvas.width - base.ax * base.canvas.width;
        const offsetY = head.ay * head.canvas.height - base.ay * base.canvas.height;
        return Math.abs(head.w / head.canvas.width - unitsX) < 1e-9 && Math.abs(head.h / head.canvas.height - unitsY) < 1e-9
          && Math.abs(offsetX - Math.round(offsetX)) < 1e-6 && Math.abs(offsetY - Math.round(offsetY)) < 1e-6
          && Math.abs((offsetX + base.ax * base.canvas.width) * unitsX - head.ox) < 1e-9
          && Math.abs((head.canvas.height - offsetY - base.ay * base.canvas.height) * unitsY - head.oy) < 1e-9;
      })]);
    }
    return checks;
  });
  for (const [name, ok, detail] of pixels) check(name, ok, detail);

  const rig = await page.evaluate(() => {
    const L = window.__lib, T = L.THREE, checks = [];
    const cfg = L.withHeroAppearance(L.withHeroParts(L.PRESETS.valkyra, { ...L.PRESETS.valkyra.parts, head: 'forge_custom_f_head' }), {
      ...L.defaultHeroAppearance(), hair: 'long', beard: 'braided', headgear: 'headband', eyeColor: 'blue', hairColor: 'ginger',
    });
    const def = L.buildHeroDef(cfg, 200), id = L.registerChar(def);
    const f = new L.Fighter(id, 'hero', { hp: 100, speed: 3 });
    const scene = new T.Scene(); f.addTo(scene);
    const head = f.rig.g.head, back = head.children.find((m) => m.name === 'appearanceBack'), front = head.children.find((m) => m.name === 'appearanceFront');
    f.rig.root.updateMatrixWorld(true);
    const before = back?.getWorldPosition(new T.Vector3());
    f.rig.snap({ ...L.NEUTRAL, head: .5, torso: .15 }); f.rig.sync(); f.rig.root.updateMatrixWorld(true);
    checks.push(['langt hår og skjegg er hodelag som følger animasjonen', !!back && !!front && back.parent === head && front.parent === head && before.distanceTo(back.getWorldPosition(new T.Vector3())) > .01]);
    const portrait = L.headCanvas(id), screenHead = L.headImage(id);
    const data = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const portraitBytes = data(portrait), screenBytes = data(screenHead);
    const portraitDiff = { sizes: [portrait.width, portrait.height, screenHead.width, screenHead.height], pixels: 0, opaque: 0, maxDelta: 0 };
    for (let i = 0; i < portraitBytes.length; i += 4) if ([0, 1, 2, 3].some((k) => portraitBytes[i + k] !== screenBytes[i + k])) {
      portraitDiff.pixels++; if (portraitBytes[i + 3] === 255) portraitDiff.opaque++;
      for (let k = 0; k < 4; k++) portraitDiff.maxDelta = Math.max(portraitDiff.maxDelta, Math.abs(portraitBytes[i + k] - screenBytes[i + k]));
    }
    checks.push(['HUD og løse hoder får hele kompositten, inkludert hår og skjegg', portrait === L.heroHeadPreview(def) && portrait.width === screenHead.width && portrait.height === screenHead.height && portraitBytes.every((v, i) => v === screenBytes[i]), portraitDiff]);
    let hudSource = false;
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    try {
      CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
        if (this.canvas.classList.contains('portrait') && image === portrait) hudSource = true;
        return draw.call(this, image, ...args);
      };
      window.__game.hud.showBrawler([{ idx: 0, cid: id, name: 'LAYER TEST', f, lives: 3, potions: 2, gold: 0 }]);
    } finally { CanvasRenderingContext2D.prototype.drawImage = draw; }
    checks.push(['HUD-portrettet tegner faktisk fra samme komplette hodebilde', hudSource]);
    const loose = f.rig.detach('head', scene);
    checks.push(['avkappet hode beholder både hårbakstykket og skjegget', !!loose && !!back && !!front && head.parent === loose && back.parent === head && front.parent === head && !f.rig.root.getObjectById(back.id) && loose.getObjectById(back.id) === back]);
    f.remove(); if (loose) scene.remove(loose);

    // Første utseendevariant har den gamle figur-ID-en som prefiks. Opprydding må eie eksakt ID.
    const beforeAppearance = { ...cfg }; delete beforeAppearance.appearance;
    const oldId = L.registerChar(L.buildHeroDef(beforeAppearance, 210));
    const oldRig = new L.Fighter(oldId, 'hero', { hp: 100, speed: 3 });
    const newId = L.registerChar(L.buildHeroDef(cfg, 210));
    const newRig = new L.Fighter(newId, 'hero', { hp: 100, speed: 3 });
    const newTexture = newRig.rig.g.head.children[0].material.map;
    const otherId = L.registerChar(L.buildHeroDef(L.withHeroAppearance(cfg, { ...cfg.appearance, hair: 'crop' }), 211));
    const otherRig = new L.Fighter(otherId, 'hero', { hp: 100, speed: 3 });
    const sharedBody = ['torso', 'pelvis', 'armF', 'armB', 'legF', 'legB', 'weapon'].map((part) => {
      const a = newRig.rig.g[part].children[0], b = otherRig.rig.g[part].children[0];
      return { part, texture: a.material.map === b.material.map, geometry: a.geometry === b.geometry };
    });
    checks.push(['endring av bare hodelag gjenbruker alle kroppsdelenes teksturer og geometri', sharedBody.every((p) => p.texture && p.geometry), sharedBody]);
    let disposed = 0; newTexture.addEventListener('dispose', () => disposed++);
    oldRig.remove(); L.purgeChar(oldId);
    const reused = new L.Fighter(newId, 'hero', { hp: 100, speed: 3 });
    checks.push(['opprydding av grunnhodet frigjør ikke første nye utseendevariants teksturer', newId.startsWith(oldId + ':') && disposed === 0 && reused.rig.g.head.children[0].material.map === newTexture]);
    newRig.remove(); reused.remove(); otherRig.remove(); L.purgeChar(newId); L.purgeChar(otherId);

    const variants = [];
    for (let i = 0; i < 20; i++) {
      const look = { ...cfg.appearance, hair: L.HERO_APPEARANCE.hair[i % 7].id, hairColor: L.HERO_APPEARANCE.hairColor[Math.floor(i / 7) + 1].id, skinTone: 'orc' };
      const variant = L.buildHeroDef(L.withHeroAppearance(cfg, look), 220 + i);
      variants.push(variant.id);
      L.composeHeroHead(variant, L.getOverride('forge_custom_f', 'head'));
      for (const slot of ['torso', 'arm', 'leg']) L.applyHeroSkin(variant, slot, 'valkyra', L.getOverride('valkyra', slot));
    }
    const stats = L.heroAppearanceCacheStats();
    checks.push(['gjentatte utseendeendringer holder kompositt- og hudcachene begrenset', stats.heads <= stats.headLimit && stats.tints <= stats.tintLimit && stats.heads > 0 && stats.tints > 0, stats]);
    for (const owner of variants) L.purgeChar(owner);
    const after = L.heroAppearanceCacheStats();
    checks.push(['opprydding av tidligere figurer slipper deres kompositt- og hudcache', after.heads < stats.heads && after.tints < stats.tints, { before: stats, after }]);
    L.purgeChar(id);
    return checks;
  });
  for (const [name, ok, detail] of rig) check(name, ok, detail);

  // De samme kontrollene som spilleren bruker: egne hodesider, ingen skjult bytting av ferdigmalte hoder.
  await page.evaluate(() => {
    const g = window.__game;
    g.save = window.__lib.defaultSave();
    g.openCreator([0, 1], () => g.goTitle());
  });
  const row = (key) => page.locator(`.cr-row[data-key="${key}"]`);
  const headPage = () => page.locator('.cr-pages button[data-page="head"]').click();
  const customHead = (sex) => page.locator(`.cr-custom-head button[data-head="forge_custom_${sex}_head"]`).click();
  const select = async (key, id) => {
    await row(`appearance:${key}`).locator('.k').click();
    await page.locator(`.cr-part[data-appearance="${key}"][data-option="${id}"]`).click();
  };
  const config = () => page.evaluate(() => {
    const s = window.__game.scene;
    return s.cfgs[s.slot];
  });
  const savedBefore = await page.evaluate(() => JSON.stringify(window.__game.save.heroes));
  await headPage();
  check('hodesiden beholder ferdigmalt hode uten å tilby skjulte hårendringer', (await config()).parts.head === 'thrugg_head' && !(await config()).appearance && await row('appearance:hair').count() === 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'mobile-original');
  check('forklaringen for ferdigmalte hoder skyver ikke mobilpool eller bunnknapper utenfor skjermen', await page.evaluate(() => ['.cr-pool', '.cr-footer'].every((selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
  })));
  await page.setViewportSize({ width: 1280, height: 720 });
  const bodyBefore = await config();
  await customHead('m');
  check('nytt grunnhode endrer bare hodet, ikke kropp og våpen', (await config()).parts.head === 'forge_custom_m_head' && await page.evaluate((before) => {
    const c = window.__game.scene.cfgs[0];
    return ['torso', 'pelvis', 'arm', 'leg', 'weapon'].every((key) => c.parts[key] === before.parts[key]) && c.body === before.body && c.weapon === before.weapon;
  }, bodyBefore));
  const lockResults = [];
  for (const [key, id] of [['headgear', 'crown'], ['skinTone', 'frost'], ['hairColor', 'blue']]) {
    await row(`appearance:${key}`).locator('.k').click();
    const before = await page.evaluate((key) => (window.__game.scene.cfgs[window.__game.scene.slot].appearance ?? window.__lib.defaultHeroAppearance())[key], key);
    const card = page.locator(`.cr-part[data-appearance="${key}"][data-option="${id}"]`);
    const locked = await card.getAttribute('aria-disabled') === 'true';
    await card.evaluate((el) => el.click());
    const after = await page.evaluate((key) => (window.__game.scene.cfgs[window.__game.scene.slot].appearance ?? window.__lib.defaultHeroAppearance())[key], key);
    lockResults.push(locked && after === before);
  }
  check('låste hud-, hår- og hodeplaggkort forklarer låsen uten å utstyre valget', lockResults.every(Boolean), lockResults);
  await select('hair', 'crop');
  check('utseenderedigering muterer ikke lagrede helter', await page.evaluate(() => JSON.stringify(window.__game.save.heroes)) === savedBefore);
  await page.locator('.cr-cancel').click();
  check('Cancel forkaster både grunnhode og nye utseendelag', await page.evaluate(() => JSON.stringify(window.__game.save.heroes)) === savedBefore);

  await page.evaluate(() => {
    const g = window.__game;
    g.save.unlocked.push('helmet:4', 'skin:6', 'hairColor:6');
    g.openCreator([0, 1], () => g.goTitle());
  });
  await headPage();
  await customHead('m');
  const look1 = { hair: 'braids', beard: 'braided', headgear: 'headband', skinTone: 'bronze', eyeColor: 'green', hairColor: 'ginger', eyeStyle: 'slit' };
  for (const [key, id] of Object.entries(look1)) await select(key, id);
  await page.locator('#hero-name').fill('COPPER BRAID');
  await page.locator('.cr-tabs [data-slot="1"]').click();
  await headPage();
  await customHead('f');
  const look2 = { hair: 'long', beard: 'mustache', headgear: 'crown', skinTone: 'frost', eyeColor: 'violet', hairColor: 'blue', eyeStyle: 'natural' };
  for (const [key, id] of Object.entries(look2)) await select(key, id);
  await page.locator('#hero-name').fill('FROST CROWN');
  check('begge spillere beholder egne uavhengige lag og opplåste farger', await page.evaluate(({ look1, look2 }) => {
    const s = window.__game.scene, [a, b] = s.cfgs;
    return Object.entries(look1).every(([k, v]) => a.appearance[k] === v) && Object.entries(look2).every(([k, v]) => b.appearance[k] === v) && a.appearance !== b.appearance;
  }, { look1, look2 }));
  check('forhåndsvisning og portrettkilde bruker samme nye hodekompositt', await page.evaluate(() => {
    const s = window.__game.scene, L = window.__lib;
    const head = s.preview.rig.g.head, def = s.preview.rig.def;
    return L.headCanvas(def.id) === L.heroHeadPreview(def) && head.children[0].material.map.image !== L.getOverride('forge_custom_f', 'head').canvas && head.children.some((m) => m.name === 'appearanceBack') && head.children.some((m) => m.name === 'appearanceFront');
  }));
  await shot(page, 'desktop');
  await page.setViewportSize({ width: 412, height: 915 });
  await select('hair', 'long');
  await shot(page, 'mobile');
  check('mobil holder pool og ferdig-/avbrytknapper innenfor skjermen', await page.evaluate(() => {
    const within = (r) => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    return ['.creator', '.cr-pool', '.cr-footer'].every((selector) => within(document.querySelector(selector).getBoundingClientRect()));
  }));
  await row('done').locator('.k').click();
  const expectedSave = await page.evaluate(() => window.__game.save.heroes);
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__lib);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  check('begge spilleres komplette utseende og navn overlever full sidelasting', isDeepStrictEqual(await page.evaluate(() => window.__game.save.heroes), expectedSave));

  const missing = await newPage();
  await missing.route('**/assets/appearance_hair_wild.webp', (r) => r.fulfill({ status: 404, body: '' }));
  await boot(missing);
  const fallback = await missing.evaluate(() => {
    const L = window.__lib, g = window.__game;
    const base = L.withHeroParts(L.PRESETS.thrugg, { ...L.PRESETS.thrugg.parts, head: 'forge_custom_m_head' });
    const cfg = L.withHeroAppearance(base, { ...L.defaultHeroAppearance(), hair: 'wild', beard: 'mustache' });
    const d = L.buildHeroDef(cfg, 300), id = L.registerChar(d), f = new L.Fighter(id, 'hero', { hp: 100, speed: 3 });
    const plain = L.buildHeroDef(L.withHeroAppearance(cfg, { ...cfg.appearance, hair: 'none' }), 301);
    const body = ['torso', 'pelvis', 'arm', 'leg', 'weapon'].every((slot) => {
      const group = { arm: 'armF', leg: 'legF' }[slot] ?? slot;
      return f.rig.g[group].children[0].material.map.image === L.getOverride(d.inherit[slot], slot).canvas;
    });
    const same = L.heroHeadPreview(d).toDataURL() === L.heroHeadPreview(plain).toDataURL();
    const keptBeard = !!f.rig.g.head.children.find((m) => m.name === 'appearanceFront');
    f.remove();
    g.save = L.defaultSave(); g.save.heroes[0] = cfg;
    g.openCreator([0], () => g.goTitle());
    return { body, same, keptBeard, unavailable: !L.heroAppearanceAvailable('hair', 'wild') };
  });
  check('manglende hårlag bevarer malt kropp, grunnhode og andre lag', fallback.body && fallback.same && fallback.keptBeard && fallback.unavailable, fallback);
  await missing.locator('.cr-pages button[data-page="head"]').click();
  await missing.locator('.cr-row[data-key="appearance:hair"] .k').click();
  check('UI tilbyr ikke en manglende hårlagsfil', await missing.locator('.cr-part[data-appearance="hair"][data-option="wild"]').count() === 0);
  await missing.close();
  check('ingen JavaScript-feil', errors.length === 0, errors);
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(`OK: ${count} utseendesjekker.`);
} finally {
  await browser.close();
}
