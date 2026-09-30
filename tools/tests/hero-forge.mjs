// Hero Forge: ekte malte deler, blanding, låser, lagring og gammel lagring.
// Bruk: node tools/tests/hero-forge.mjs http://localhost:4173/ [./shots]
// CHROMIUM_EXECUTABLE_PATH kan peke på en nettleser utenfor Playwright-installasjonen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const [url, out] = process.argv.slice(2);
if (!url) throw new Error('Bruk: node tools/tests/hero-forge.mjs URL [skjermbildemappe]');
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}${ok || !detail ? '' : ': ' + JSON.stringify(detail)}`);
  if (!ok) failures.push(name);
}
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('loincloth-legends-settings-v1', JSON.stringify({ quality: 'low', music: 0, sfx: 0, recorded: false }));
  });
  // Ingen nettavhengighet for testen. Fontfiler kan leveres lokalt ved visuell kontroll.
  const fonts = process.env.FONTS_DIR;
  await page.route('https://fonts.googleapis.com/**', (r) => fonts
    ? r.fulfill({ path: fonts + '/fonts.css', contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } })
    : r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', (r) => {
    const file = fonts && fonts + '/' + new URL(r.request().url()).pathname.slice(1).replaceAll('/', '_');
    return file && fs.existsSync(file) ? r.fulfill({ path: file, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } }) : r.abort();
  });
  return page;
}
async function boot(page) {
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
  await page.waitForFunction(() => window.__game && window.__lib);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
}
async function tick(page, n = 2) {
  await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__game.tick(1 / 60, false); }, n);
}
async function shot(page, name) {
  if (!out) return;
  // Resize-hendelsen kan ellers tømme WebGL-bufferet etter det manuelle bildet.
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.__game.resize(); window.__game.tick(1 / 60, true); });
  await page.screenshot({ path: `${out}/hero-forge-${name}.png` });
}

try {
  const page = await newPage();
  await boot(page);

  // Bildidentitet fra selve riggens teksturer, ikke bare katalogen eller inherit-feltet.
  const art = await page.evaluate(() => {
    const L = window.__lib;
    const checks = [];
    const groups = { head: ['head'], torso: ['torso'], pelvis: ['pelvis'], arm: ['armF', 'armB'], leg: ['legF', 'legB'], weapon: ['weapon'] };
    const image = (f, group) => f.rig.g[group]?.children[0]?.material.map?.image;
    const painted = (cfg, slot, title) => {
      const f = new L.Fighter(L.registerChar(L.buildHeroDef(cfg, slot)), 'hero', { hp: 100, speed: 3, weapon: L.WEAPONS[cfg.weapon] });
      for (const [part, names] of Object.entries(groups)) {
        const option = L.HERO_PARTS[part].find((p) => p.id === cfg.parts[part]);
        const canvas = L.getOverride(option.source, option.slot)?.canvas;
        checks.push([`${title}: ${part} bruker valgt bilde`, !!canvas && names.every((name) => image(f, name) === canvas)]);
      }
      const head = L.HERO_PARTS.head.find((p) => p.id === cfg.parts.head);
      const hair = L.getOverride(head.source, 'hairback')?.canvas;
      if (hair) checks.push([`${title}: hårmanken følger hodet`, f.rig.g.head.children.some((m) => m.material?.map?.image === hair)]);
      f.remove();
    };
    const catalog = Object.values(L.HERO_PARTS).flat();
    const added = ['forge_bald_head', 'forge_eyepatch_head', 'forge_crownbraid_head', 'forge_silvercut_head', 'forge_leather_torso', 'forge_plate_torso', 'forge_kilt_pelvis', 'forge_tassets_pelvis', 'forge_leather_arm', 'forge_plate_arm', 'forge_sandals_leg', 'forge_greaves_leg', 'forge_warhammer_weapon'];
    checks.push(['poolen har 32 valg, med alle 13 nye bilder', catalog.length === 32 && added.every((id) => catalog.some((p) => p.id === id && L.getOverride(p.source, p.slot)?.canvas.width > 0))]);
    const hammer = catalog.find((p) => p.id === 'forge_warhammer_weapon');
    checks.push(['krigshammeren er våpenklasse 2 og følger weapon:2-låsen', hammer?.weapon === 2 && hammer?.unlock === 'weapon:2']);
    checks.push(['alle katalogdeler har lastet bildefil', Object.entries(L.HERO_PARTS).every(([slot, options]) => options.every((p) => !!L.getOverride(p.source, slot)))]);
    painted(L.PRESETS.thrugg, 41, 'Thrugg');
    painted(L.PRESETS.valkyra, 42, 'Valkyra');
    const mixed = L.withHeroParts({ ...L.PRESETS.thrugg, name: 'MIXED HERO', magic: 2 }, {
      head: 'valkyra_head', torso: 'thrugg_torso', pelvis: 'gorthak_pelvis', arm: 'valkyra_arm', leg: 'gorthak_leg', weapon: 'gorthak_weapon',
    });
    painted(mixed, 43, 'Blandet helt');
    painted(L.withHeroParts(L.PRESETS.thrugg, {
      head: 'forge_bald_head', torso: 'forge_leather_torso', pelvis: 'forge_kilt_pelvis', arm: 'forge_leather_arm', leg: 'forge_sandals_leg', weapon: 'forge_warhammer_weapon',
    }), 46, 'Ny lærhelt');
    painted(L.withHeroParts(L.PRESETS.valkyra, {
      head: 'forge_crownbraid_head', torso: 'forge_plate_torso', pelvis: 'forge_tassets_pelvis', arm: 'forge_plate_arm', leg: 'forge_greaves_leg', weapon: 'forge_warhammer_weapon',
    }), 47, 'Ny platehelt');
    const changed = L.withHeroParts(mixed, { ...mixed.parts, head: 'thrugg_head' });
    checks.push(['endret del gir ny teksturnøkkel', L.buildHeroDef(mixed, 43).id !== L.buildHeroDef(changed, 43).id]);
    const original = JSON.stringify(L.PRESETS);
    const s = L.defaultSave(), copy = L.cloneHero(s.heroes[0]);
    copy.parts.head = 'gorthak_head';
    checks.push(['kloner deler ikke mutable deler med preset eller spiller', JSON.stringify(L.PRESETS) === original && s.heroes[0].parts.head === 'thrugg_head' && s.heroes[1].parts.head === 'valkyra_head']);
    const femaleAxe = L.withHeroParts(mixed, { ...mixed.parts, torso: 'valkyra_torso', weapon: 'valkyra_weapon' });
    checks.push(['overkropp og våpen oppdaterer kroppstype og kampegenskaper', femaleAxe.body === 1 && femaleAxe.weapon === 1]);
    return checks;
  });
  for (const [name, ok] of art) check(name, ok);

  const compatibility = await page.evaluate(() => {
    const L = window.__lib, checks = [];
    const s = L.defaultSave();
    // En ekte gammel, egendefinert helt har ingen parts og skal ikke få preset-kropp.
    const custom = { ...L.PRESETS.thrugg, name: 'OLD CUSTOM', hair: 3, weapon: 0 };
    delete custom.parts;
    const oldPreset = { ...L.PRESETS.valkyra, name: 'OLD VALKYRA' };
    delete oldPreset.parts;
    s.heroes = [custom, oldPreset];
    const legacyRaw = { ...s };
    delete legacyRaw.heroPartsVersion;
    localStorage.setItem('loincloth-legends-save-v1', JSON.stringify(legacyRaw));
    const legacy = L.loadSave();
    checks.push(['gammel egendefinert helt beholder klassiske valg', !legacy.heroes[0].parts && legacy.heroes[0].hair === 3 && !L.buildHeroDef(legacy.heroes[0], 44).inherit]);
    checks.push(['gammelt uendret preset beholder malt grafikk', legacy.heroes[1].parts?.head === 'valkyra_head']);
    L.writeSave(s);
    checks.push(['nytt klassisk valg blir ikke malt igjen etter lagring', !L.loadSave().heroes[1].parts]);
    const oldWeapons = L.defaultSave();
    delete oldWeapons.heroPartsVersion;
    oldWeapons.heroes = [{ ...L.PRESETS.thrugg, weapon: 1, cloth: 4, magic: 2 }, { ...L.PRESETS.valkyra, weapon: 0 }];
    oldWeapons.heroes.forEach((hero) => delete hero.parts);
    localStorage.setItem('loincloth-legends-save-v1', JSON.stringify(oldWeapons));
    const migrated = L.loadSave().heroes;
    checks.push(['eldre våpenvalg migreres med malt kropp, tøyfarge og magi i behold', migrated[0].parts?.torso === 'thrugg_torso' && migrated[0].parts.weapon === 'valkyra_weapon' && migrated[0].cloth === 4 && migrated[0].magic === 2 && migrated[1].parts?.head === 'valkyra_head' && migrated[1].parts.weapon === 'thrugg_weapon']);
    oldWeapons.heroes[0].weapon = 2;
    localStorage.setItem('loincloth-legends-save-v1', JSON.stringify(oldWeapons));
    const restrictedLegacy = L.loadSave().heroes[0];
    checks.push(['eldre hammer uten opplåsing beholdes klassisk uten stille nedgradering', !restrictedLegacy.parts && restrictedLegacy.weapon === 2]);
    oldWeapons.unlocked = ['weapon:2'];
    localStorage.setItem('loincloth-legends-save-v1', JSON.stringify(oldWeapons));
    const oldHammer = L.loadSave().heroes[0];
    checks.push(['eldre opplåst hammer får det nye hammerbildet', oldHammer.parts?.weapon === 'forge_warhammer_weapon' && oldHammer.weapon === 2]);
    s.heroes[0] = L.withHeroParts(L.PRESETS.thrugg, { ...L.defaultHeroParts(0), arm: 'valkyra_arm', head: 'gorthak_head', weapon: 'hogman_weapon' });
    s.heroes[0].parts.leg = 'removed_asset';
    s.heroes[0].parts.pelvis = null;
    L.writeSave(s);
    const clean = L.loadSave().heroes[0];
    checks.push(['ukjente del-id-er repareres uten å miste gyldige deler', clean.parts.arm === 'valkyra_arm' && clean.parts.leg === 'thrugg_leg' && clean.parts.pelvis === 'thrugg_pelvis']);
    checks.push(['låste del-id-er i lagring kan ikke snike seg inn', clean.parts.head === 'thrugg_head' && clean.parts.weapon === 'thrugg_weapon' && clean.weapon === 0]);
    s.unlocked = ['helmet:5', 'weapon:3'];
    L.writeSave(s);
    const unlocked = L.loadSave().heroes[0];
    checks.push(['opplåste lagrede deler beholdes med riktig våpenstatistikk', unlocked.parts.head === 'gorthak_head' && unlocked.parts.weapon === 'hogman_weapon' && unlocked.weapon === 3]);
    s.heroes[0] = L.withHeroParts(L.PRESETS.thrugg, { ...L.defaultHeroParts(0), weapon: 'forge_warhammer_weapon' });
    L.writeSave(s);
    const lockedHammer = L.loadSave().heroes[0];
    checks.push(['lagret hammer krever sin egen opplåsing', lockedHammer.parts.weapon === 'thrugg_weapon' && lockedHammer.weapon === 0]);
    s.unlocked.push('weapon:2');
    L.writeSave(s);
    const unlockedHammer = L.loadSave().heroes[0];
    checks.push(['opplåst hammer overlever lagring med riktig våpenklasse', unlockedHammer.parts.weapon === 'forge_warhammer_weapon' && unlockedHammer.weapon === 2]);
    localStorage.removeItem('loincloth-legends-save-v1');
    return checks;
  });
  for (const [name, ok] of compatibility) check(name, ok);

  // Historien har forskjellig fullføring og avbrytelse: Cancel skal aldri starte introen.
  for (const twoP of [false, true]) {
    await page.evaluate((twoP) => {
      const g = window.__game;
      g.save = window.__lib.defaultSave();
      g.startStory(twoP);
    }, twoP);
    await page.locator('.cr-part[data-part="valkyra_head"]').click();
    if (twoP) { await page.keyboard.press('Escape'); await tick(page); }
    else await page.locator('.cr-cancel').click();
    check(`${twoP ? 'Escape med to spillere' : 'CANCEL med én spiller'} går til tittelen uten intro eller lagring`, await page.evaluate(() => {
      const g = window.__game;
      return g.scene.name === 'title' && !g.save.intro && g.save.heroMade.every((v) => !v) && g.save.heroes[0].parts.head === 'thrugg_head';
    }));
  }

  // UI-testene følger nedenfor. Radnøkler er stabile selv om antallet rader endres.
  await page.evaluate(() => {
    const g = window.__game;
    g.save = window.__lib.defaultSave();
    g.openCreator([0, 1], () => g.goTitle());
  });
  await tick(page);
  const row = (key) => page.locator(`.cr-row[data-key="${key}"]`);
  const selectPart = async (slot, id) => {
    await row(slot).locator('.k').click();
    await page.locator(`.cr-part[data-part="${id}"]`).click();
  };
  const config = () => page.evaluate(() => window.__game.scene.cfgs[window.__game.scene.slot]);
  const initial = await page.evaluate(() => JSON.stringify(window.__game.save.heroes));
  const presetInitial = await page.evaluate(() => JSON.stringify(window.__lib.PRESETS));
  check('malte bygger har seks delrader og synlige bildekort', await page.locator('.cr-painted').count() === 1 && await page.locator('.cr-part canvas').count() >= 3);
  await selectPart('head', 'valkyra_head');
  const headChanged = await page.evaluate(() => {
    const s = window.__game.scene, L = window.__lib;
    return s.preview.rig.g.head.children[0].material.map.image === L.getOverride('valkyra', 'head').canvas && s.cfgs[1].parts.head === 'valkyra_head';
  });
  check('klikk på bildekort endrer forhåndsvisningen', headChanged);
  check('redigering muterer verken preset eller lagrede helter', await page.evaluate(() => JSON.stringify(window.__game.save.heroes)) === initial && await page.evaluate(() => JSON.stringify(window.__lib.PRESETS)) === presetInitial);
  await row('head').locator('.k').click();
  const lock = page.locator('.cr-part[data-part="gorthak_head"]');
  check('låst hode markeres som utilgjengelig', await lock.getAttribute('aria-disabled') === 'true');
  // Programmatisk klikk tester også at handleren avviser et låst valg.
  await lock.evaluate((el) => el.click());
  check('låst hode beholdes ikke som utstyr', (await config()).parts.head === 'valkyra_head' && (await page.locator('.cr-info').innerText()).includes('LOCKED'));
  await row('weapon').locator('.k').click();
  const hammerLock = page.locator('.cr-part[data-part="forge_warhammer_weapon"]');
  check('låst krigshammer vises i poolen', await hammerLock.getAttribute('aria-disabled') === 'true');
  await hammerLock.evaluate((el) => el.click());
  check('låst krigshammer kan ikke utstyres i UI', (await config()).parts.weapon === 'thrugg_weapon' && (await page.locator('.cr-info').innerText()).includes('LOCKED'));
  await selectPart('torso', 'valkyra_torso');
  await selectPart('weapon', 'valkyra_weapon');
  check('valgt øks gir samme kampstatistikk i UI og figur', await page.evaluate(() => {
    const s = window.__game.scene, L = window.__lib;
    return s.cfgs[0].body === 1 && s.cfgs[0].weapon === 1 && s.preview.weapon === L.WEAPONS[1] && s.preview.rig.g.weapon.children[0].material.map.image === L.getOverride('valkyra', 'weapon').canvas;
  }));
  await page.locator('.cr-cancel').click();
  check('CANCEL forkaster hele utkastet', await page.evaluate(() => JSON.stringify(window.__game.save.heroes)) === initial);

  await page.evaluate(() => { const g = window.__game; g.openCreator([0, 1], () => g.goTitle()); });
  await row('preset').locator('.arr.r').click();
  await row('preset').locator('.k').click();
  check('preset-knappen laster en malt Valkyra', (await config()).parts.head === 'valkyra_head');
  const draftBefore = JSON.stringify((await config()).parts);
  await row('builder').locator('.arr.r').click();
  check('CLASSIC BUILDER tilbyr reelle klassiske valg', !(await config()).parts && await row('skin').count() === 1 && await page.evaluate(() => !window.__game.scene.preview.rig.def.inherit));
  await row('builder').locator('.arr.r').click();
  check('bytte tilbake til malte deler bevarer utkastet', JSON.stringify((await config()).parts) === draftBefore);

  const random = await page.evaluate(() => {
    const s = window.__game.scene, L = window.__lib, oldRandom = Math.random;
    const results = [];
    try {
      for (const value of [0, 0.49, 0.999999]) {
        Math.random = () => value;
        document.querySelector('.cr-row[data-key="random"] .k').click();
        const cfg = s.cfgs[s.slot];
        results.push(!!cfg.parts && Object.entries(cfg.parts).every(([slot, id]) => {
          const p = L.HERO_PARTS[slot].find((p) => p.id === id);
          return p && !p.unlock && !!L.getOverride(p.source, p.slot);
        }));
      }
    } finally { Math.random = oldRandom; }
    return results;
  });
  check('tilfeldige helter bruker bare tilgjengelige opplåste bilder', random.every(Boolean), random);

  // Spillbelønningen er gitt; åpne smia igjen så den leser den nye opplåsingen.
  await page.locator('.cr-cancel').click();
  await page.evaluate(() => {
    const g = window.__game;
    g.save.unlocked.push('weapon:2');
    g.openCreator([0, 1], () => g.goTitle());
  });
  await selectPart('weapon', 'forge_warhammer_weapon');
  check('opplåst hammerkort utstyrer malt hammer med riktige kampverdier', await page.evaluate(() => {
    const s = window.__game.scene, L = window.__lib;
    return s.cfgs[0].weapon === 2 && s.preview.weapon === L.WEAPONS[2] && s.preview.rig.g.weapon.children[0].material.map.image === L.getOverride('forge_warhammer', 'weapon').canvas;
  }));

  // Lag to forskjellige helter gjennom de samme kontrollene spilleren bruker.
  const p1 = { head: 'forge_eyepatch_head', torso: 'forge_leather_torso', arm: 'forge_plate_arm', pelvis: 'forge_tassets_pelvis', leg: 'forge_greaves_leg', weapon: 'forge_warhammer_weapon' };
  for (const [slot, id] of Object.entries(p1)) await selectPart(slot, id);
  await page.locator('#hero-name').fill('MIXED ONE');
  await page.locator('.cr-tabs [data-slot="1"]').click();
  const p2 = { head: 'forge_silvercut_head', torso: 'forge_plate_torso', arm: 'forge_leather_arm', pelvis: 'forge_kilt_pelvis', leg: 'forge_sandals_leg', weapon: 'thrugg_weapon' };
  for (const [slot, id] of Object.entries(p2)) await selectPart(slot, id);
  await page.locator('#hero-name').fill('MIXED TWO');
  check('spillerne har uavhengige deler', await page.evaluate(({ p1, p2 }) => {
    const cfgs = window.__game.scene.cfgs;
    return Object.entries(p1).every(([k, v]) => cfgs[0].parts[k] === v) && Object.entries(p2).every(([k, v]) => cfgs[1].parts[k] === v) && cfgs[0].parts !== cfgs[1].parts;
  }, { p1, p2 }));
  await page.locator('.cr-tabs [data-slot="0"]').click();
  await row('head').locator('.k').click();
  await shot(page, 'desktop');
  await page.setViewportSize({ width: 915, height: 412 });
  await shot(page, 'mobile-landscape');
  await page.setViewportSize({ width: 412, height: 915 });
  await selectPart('head', 'forge_silvercut_head');
  check('siste hodekort forblir synlig etter valg i mobilpoolen', await page.evaluate(() => {
    const card = document.querySelector('.cr-part[data-part="forge_silvercut_head"]').getBoundingClientRect();
    const pool = document.querySelector('.cr-part-grid').getBoundingClientRect();
    return card.left >= pool.left - 1 && card.right <= pool.right + 1;
  }));
  await selectPart('head', p1.head);
  await shot(page, 'mobile-portrait');
  const fits = await page.evaluate(() => {
    const el = document.querySelector('.creator'), box = el.getBoundingClientRect();
    const inside = (r) => r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
    return inside(box) && ['.cr-pool', '.cr-footer'].every((selector) => inside(el.querySelector(selector).getBoundingClientRect()));
  });
  check('mobilpanelet holder seg innenfor skjermen', fits);
  await row('done').locator('.k').click();
  const saved = await page.evaluate(() => JSON.stringify(window.__game.save.heroes));
  await page.reload();
  await page.waitForFunction(() => window.__lib && window.__game);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  check('begge spillernes seks deler og navn overlever full sidelasting', await page.evaluate(() => JSON.stringify(window.__game.save.heroes)) === saved);
  check('lagring bevarer valgt kroppstype og våpen', await page.evaluate(() => {
    const [a, b] = window.__game.save.heroes;
    return a.body === 0 && a.weapon === 2 && a.name === 'MIXED ONE' && b.body === 1 && b.weapon === 0 && b.name === 'MIXED TWO';
  }));

  // Manglende fil: bare den delen bruker reservetegningen. De andre fem er fortsatt malt.
  const missing = await newPage();
  await missing.route('**/assets/valkyra_arm.webp', (r) => r.fulfill({ status: 404, body: '' }));
  await boot(missing);
  const fallback = await missing.evaluate(() => {
    const L = window.__lib, cfg = L.cloneHero(L.PRESETS.valkyra);
    const f = new L.Fighter(L.registerChar(L.buildHeroDef(cfg, 45)), 'hero', { hp: 100, speed: 3 });
    const arm = f.rig.g.armF.children[0].material.map.image;
    const rest = ['head', 'torso', 'pelvis', 'weapon'].every((part) => f.rig.g[part].children[0].material.map.image === L.getOverride('valkyra', part)?.canvas);
    const ok = !L.getOverride('valkyra', 'arm') && arm.width > 0 && arm.height > 0 && arm === f.rig.g.armB.children[0].material.map.image && rest;
    f.remove();
    return ok;
  });
  check('manglende bildefil gir brukbar reservedel uten å fjerne de andre bildene', fallback);
  await missing.evaluate(() => {
    const g = window.__game; g.save = window.__lib.defaultSave();
    g.openCreator([1], () => g.goTitle());
    document.querySelector('.cr-row[data-key="arm"] .k').click();
  });
  check('UI skjuler manglende bildedel og forklarer reservegrafikken', await missing.locator('.cr-part[data-part="valkyra_arm"]').count() === 0 && (await missing.locator('.cr-status').innerText()).includes('did not load'));
  await missing.close();
  check('ingen JavaScript-feil', errors.length === 0, errors);
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('OK: Hero Forge-katalog, ekte riggteksturer, lagring og reservegrafikk.');
} finally {
  await browser.close();
}
