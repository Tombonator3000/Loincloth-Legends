// Teit vold, runde to (Tom 2026-10-01, game/mayhem.ts): de ti forslagene fra todo.md.
// 1) Overkroppen kryper mot helten, biter ham i ankelen og drar innvollene etter seg. Ett slag tar den, ellers blør den ut.
// 2) Hodet på bakken slås som en ball og gir HOME RUN når det treffer en fiende.
// 3) Løpeslaget med sverd spidder opptil tre fiender, helten går saktere, og neste slag rister dem av (SHISH KEBAB!).
// 4) Kjempetrollet sprenges: blodregn over hele bildet og på glasset, og gnomen slår opp paraplyen (I CAME PREPARED).
// 5) Store blodpytter er glatte en stund, og en fiende som løper over, går på trynet (SLIP!).
// 6) Skjelettxylofonen: hvert bein som spretter, spiller neste tone.
// 7) Hodet i skjermen sier sine siste ord i en snakkeboble før det sklir, og er borte innen tre sekunder.
// 8) Tunge slag i ansiktet slår ut tenner som sier pling når de spretter.
// 9) Kjøttbiter fra en eksplosjon nær kameraet klistrer seg på glasset (ikke fra en eksplosjon langt bak).
// 10) Ildimpen smeller i en ildkule og setter fyr på dem som står nær, fiender og helter.
// Bruk: node tools/tests/mayhem.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
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
const shot = async (name) => {
  if (!out) return;
  await page.evaluate(() => window.__game.tick(1 / 60, true));
  await page.screenshot({ path: `${out}/${name}.png` });
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(2000);
await page.addStyleTag({ content: '.announce{display:none!important}' });
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  localStorage.clear();
  window.__run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { each?.(i); window.__game.tick(1 / 60, false); } };
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
  window.__run(0.5);
  const s = g.scene.stage;
  s.waveIdx = 999; s.wave = null; s.lockX = null; s.queue = []; s.visionDone = true;
  s.camX = 20;
  // Piggropa ved x 21 tar helten og slår ham opp i lufta, og da får løpeslaget ingen fart. Farene testes andre steder
  s.hazards.length = 0;
  const h = s.heroes[0].f;
  h.hp = h.maxHp = 9999;
  h.pos.set(18, 0, 0.3);
  // Alt som sies og står på skjermen
  window.__said = [];
  const orig = g.fx.text;
  g.fx.text = function (p, t, kind, ...rest) { window.__said.push(t); return orig.call(this, p, t, kind, ...rest); };
  // Rydd brettet mellom delene: fiender, lik og kroppsdeler
  window.__clear = () => {
    for (const o of s.foes) { o.f.alive = false; o.f.skewer = null; o.f.remove(); }
    s.foes.length = 0;
    s.mayhem.heads.length = 0;
    for (const b of s.barrels) { b.alive = false; b.mesh.removeFromParent(); }
    s.barrels.length = 0;
    for (const p of s.pickups) p.dispose();
    s.pickups.length = 0;
    s.glassCd = 99;
    // Kameraet går bare framover: sett det tilbake, ellers klemmes figurene inn mot venstre kant av bildet
    s.camX = 20;
    // Helten står på beina uten fart og uten noe som henger igjen fra forrige del
    const hf = s.heroes[0].f;
    hf.setState('idle');
    hf.atk = null;
    hf.vel.set(0, 0, 0);
    hf.pos.y = 0;
    hf.onGround = true;
    hf.invuln = 0;
    hf.burnT = 0;
    window.__said.length = 0;
  };
});

// 1) Overkroppen som kryper
const crawl = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f;
  L.MAYHEM.crawl = [1, 1, 1, 1];
  window.__clear();
  h.hp = h.maxHp = 400;
  h.pos.set(18, 0, 0.3);
  h.face(1);
  const o = s.spawnFoe('hogman', 'R');
  o.f.pos.set(22, 0, 0.3); o.entered = true; o.f.frozen = true;
  window.__run(0.1);
  o.f.die('bisect', 1, h);
  let startT = -1;
  window.__run(2.5, (i) => { if (startT < 0 && s.mayhem.crawlers.length) startT = +(i / 60).toFixed(2); });
  const c = s.mayhem.crawlers[0];
  if (!c) return { startT, crawlers: 0 };
  const x0 = c.x;
  window.__run(1.0);
  // Kjeden av innvoller: hver bit høyst et mellomrom fra den foran
  const gap = L.MAYHEM.guts.gap;
  let maxLink = 0;
  for (let i = 1; i < c.guts.length; i++) {
    const a = c.guts[i - 1].obj.position, b = c.guts[i].obj.position;
    maxLink = Math.max(maxLink, Math.hypot(a.x - b.x, a.z - b.z));
  }
  window.__crawler = c;
  return { startT, crawlers: s.mayhem.crawlers.length, moved: +(x0 - c.x).toFixed(2), dir: c.dir, guts: c.guts.length, gutsN: L.MAYHEM.guts.n, maxLink: +maxLink.toFixed(3), gap, lift: +c.lift.toFixed(2), said: [...window.__said] };
});
check('kuttet i to: overkroppen lander og begynner å krype', crawl.crawlers === 1 && crawl.startT > 0, crawl);
check('den sier I CAN STILL BITE! første gang', crawl.said?.includes('I CAN STILL BITE!'), crawl.said);
check('den kryper mot helten (til venstre)', crawl.dir === -1 && crawl.moved > 0.5, crawl);
check('med innvollene på slep som en kjede av kjøttbiter', crawl.guts === crawl.gutsN && crawl.maxLink <= crawl.gap + 0.01, crawl);
await shot('m1-crawler');
const bite = await page.evaluate(() => {
  const s = window.__game.scene.stage, h = s.heroes[0].f, c = window.__crawler;
  // Helten går nær hodet (kroppen kryper bare rundt en meter i sekundet)
  h.pos.set(c.x + c.dir * c.len * 0.75 - 0.3, 0, c.z);
  const hp0 = h.hp;
  window.__said.length = 0;
  window.__run(2.0);
  return { lost: +(hp0 - h.hp).toFixed(1), said: [...window.__said], alive: window.__crawler.alive };
});
check('den biter helten i ankelen (litt skade, CHOMP)', bite.lost > 0 && bite.lost < 30 && bite.said.some((t) => ['CHOMP!', 'NOM!', 'ANKLE BITER!'].includes(t)), bite);
const squash = await page.evaluate(() => {
  const L = window.__lib, s = window.__game.scene.stage, h = s.heroes[0].f, c = window.__crawler;
  window.__said.length = 0;
  // Ikke bitt akkurat nå (bittet avbryter slaget, det er meningen, men ikke her)
  c.biteCd = 9;
  h.pos.set(c.x - 1.0, 0, c.z);
  h.face(1);
  h.setState('idle');
  h.startAttack(L.HERO_ATK.slash1);
  window.__run(0.4);
  return { alive: c.alive, crawlers: s.mayhem.crawlers.length, said: [...window.__said], flying: !c.d.rest, life: +c.d.life.toFixed(1) };
});
check('ett slag tar den (STAY DOWN!), og overkroppen flyr', !squash.alive && squash.crawlers === 0 && squash.said.some((t) => ['STAY DOWN!', 'SQUISH!', 'AND STAY DEAD!'].includes(t)), squash);
const bleed = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f;
  window.__clear();
  L.MAYHEM.crawlLife = [1.2, 1.2];
  h.pos.set(14, 0, 0.3);
  const o = s.spawnFoe('cultist', 'R');
  o.f.pos.set(23, 0, -0.5); o.entered = true; o.f.frozen = true;
  window.__run(0.1);
  o.f.die('bisect', -1, h);
  let crawled = false;
  window.__run(4, () => { if (s.mayhem.crawlers.length) crawled = true; });
  L.MAYHEM.crawlLife = [6, 8];
  return { crawled, left: s.mayhem.crawlers.length, said: [...window.__said] };
});
check('uten slag blør den ut av seg selv', bleed.crawled && bleed.left === 0 && bleed.said.some((t) => t.startsWith('...TELL MY LEGS') || t.startsWith('I REGRET') || t.startsWith('SO...')), bleed);

// 2) Hodet som baseball
const ball = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f;
  window.__clear();
  h.pos.set(16, 0, 0);
  const v = s.spawnFoe('cultist', 'R');
  v.f.pos.set(17.5, 0, 0); v.entered = true; v.f.frozen = true;
  window.__run(0.05);
  v.f.die('decap', 1, h);
  window.__run(2.5);
  const head = s.mayhem.heads[0];
  if (!head) return { heads: 0 };
  const p = head.d.obj.position;
  const t = s.spawnFoe('hogman', 'R');
  t.f.pos.set(p.x + 6, 0, p.z); t.entered = true; t.f.frozen = true;
  const hp0 = t.f.hp;
  h.pos.set(p.x - 0.9, 0, p.z);
  h.face(1);
  h.setState('idle');
  window.__run(0.05);
  window.__said.length = 0;
  h.startAttack(L.HERO_ATK.slash1);
  let flew = false;
  window.__run(0.3, () => { if (head.flying) flew = true; });
  window.__ballShot = head;
  window.__run(1.0);
  return { heads: s.mayhem.heads.length, flew, rest: head.d.rest, hit: hp0 - t.f.hp, said: [...window.__said] };
});
check('hodet blir liggende og kan slås (BATTER UP)', ball.heads >= 1 && ball.flew && ball.said?.some((t) => ['BATTER UP!', 'FORE!', 'HEADS UP!'].includes(t)), ball);
check('treffer det en fiende, er det HOME RUN!', ball.hit > 0 && ball.said?.includes('HOME RUN!'), ball);

// 3) Kebabspyd
const kebab = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, hero = s.heroes[0], h = hero.f;
  window.__clear();
  hero.weapon = L.WEAPONS[0];
  h.pos.set(16, 0, 0);
  h.face(1);
  h.setState('idle');
  const foes = [17.3, 18.6, 19.9].map((x) => {
    const o = s.spawnFoe('cultist', 'R');
    o.f.pos.set(x, 0, 0); o.entered = true; o.f.frozen = true;
    return o;
  });
  window.__run(0.05);
  h.startAttack(hero.atk('dash'));
  window.__run(0.7);
  const on = hero.kebab.length;
  // Bladet og fiendene på det
  const blade = h.rig.bladePoint(0.6);
  const near = foes.filter((o) => o.f.skewer && Math.abs(o.f.pos.x - blade.x) < 1.6).length;
  return { on, near, states: foes.map((o) => o.f.state), said: [...window.__said], poseMod: !!h.poseMod };
});
check('løpeslaget med sverd spidder tre fiender', kebab.on === 3 && kebab.near === 3, kebab);
check('og de vrir seg på bladet (SKEWERED, KEBAB x3)', kebab.states.every((x) => x === 'held') && kebab.said.some((t) => t === 'KEBAB x3'), kebab);
await shot('m3-kebab');
const slow = await page.evaluate(() => {
  const g = window.__game, s = g.scene.stage, hero = s.heroes[0], h = hero.f;
  // Gå mot høyre i ett sekund med en falsk kontroll, med og uten fiender på sverdet
  const real = hero.input;
  const fake = { axisX: () => 1, axisY: () => 0, consumeAttack: () => false, consumeJump: () => false, consumeGrab: () => false, pressed: {}, doubleTap: {}, held: {}, attackBuffer: 0 };
  hero.input = fake;
  // Vent til løpeslaget er helt over
  for (let i = 0; i < 90 && h.state !== 'idle'; i++) window.__run(1 / 60);
  const x0 = h.pos.x;
  window.__run(1.0);
  const loaded = h.pos.x - x0;
  hero.input = real;
  return { loaded: +loaded.toFixed(2), speed: +h.speed.toFixed(2), on: hero.kebab.length };
});
check('helten går saktere med tre på sverdet', slow.on === 3 && slow.loaded > 0.8 && slow.loaded < slow.speed * 0.7, slow);
const shake = await page.evaluate(() => {
  const s = window.__game.scene.stage, hero = s.heroes[0], h = hero.f;
  window.__said.length = 0;
  h.startAttack(hero.atk('slash1'));
  window.__run(0.25);
  const foes = s.foes.map((o) => ({ st: o.f.state, sk: !!o.f.skewer, vx: +o.f.vel.x.toFixed(1) }));
  return { on: hero.kebab.length, said: [...window.__said], foes, poseMod: !!h.poseMod };
});
check('neste slag rister dem av: SHISH KEBAB!', shake.on === 0 && shake.said.includes('SHISH KEBAB!') && shake.foes.every((f) => !f.sk) && !shake.poseMod, shake);

// 4) Blodregn og gnomen med paraplyen
const rain = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, W = L.W;
  window.__clear();
  h.pos.set(16, 0, 0.5);
  const t = s.spawnFoe('bigtroll', 'R');
  t.f.pos.set(23, 0, -0.5); t.entered = true; t.f.frozen = true;
  window.__run(0.1);
  const glass0 = L.screenFX.wet.stats.blood;
  t.f.die('normal', 1, h);
  const now = { style: t.f.deathStyle, rainT: +s.mayhem.rainT.toFixed(1), wet: L.screenFX.wet.bloodRain, gnome: !!s.mayhem.gnome };
  // Dråpene som faller fra over bildet (høyere enn noe annet blod kommer fra)
  let sky = 0;
  const drop = W.gore.drop;
  W.gore.drop = function (x, y, ...rest) { if (y > 6) sky++; return drop.call(this, x, y, ...rest); };
  window.__run(2.2);
  W.gore.drop = drop;
  const gn = s.mayhem.gnome;
  const open = gn ? gn.u.group.children[0].scale.x : 0;
  return { ...now, phase: gn?.phase, open: +open.toFixed(2), sky, glass: L.screenFX.wet.stats.blood - glass0, said: [...window.__said] };
});
check('kjempetrollet sprenges uansett, og det regner blod', rain.style === 'explode' && rain.rainT > 4 && rain.wet === 1 && rain.sky > 150, rain);
check('det regner blod på glasset også', rain.glass > 5, rain);
check('gnomen tusler inn og slår opp paraplyen: I CAME PREPARED', rain.gnome && (rain.phase === 'wait' || rain.phase === 'open') && rain.open > 0.5 && rain.said.includes('I CAME PREPARED'), rain);
await shot('m4-blood-rain');
const after = await page.evaluate(() => {
  const L = window.__lib, s = window.__game.scene.stage;
  window.__run(8);
  return { rainT: s.mayhem.rainT, wet: L.screenFX.wet.bloodRain, gnome: !!s.mayhem.gnome };
});
check('regnet stopper, og gnomen går igjen', after.rainT <= 0 && after.wet === 0 && !after.gnome, after);

// 5) Glatte pytter
const slip = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, W = L.W;
  window.__clear();
  L.MAYHEM.slick.odds = 1;
  s.mayhem.slicks.length = 0;
  h.pos.set(15, 0, 0);
  W.gore.pool(17.2, 0, 1.6);
  const slicks = s.mayhem.slicks.length;
  W.gore.pool(21, 1.5, 0.4);
  const small = s.mayhem.slicks.length - slicks;
  window.__run(1.5);
  // Skjelettet går rett mot helten med en gang (ingen sirkling først), gjennom pytten
  const o = s.spawnFoe('skeleton', 'R');
  o.f.pos.set(21, 0, 0); o.entered = true; o.cd = 0; o.hoverDz = 0;
  let slipped = false, down = false;
  window.__run(4, () => { if (o.f.data.slipT) slipped = true; if (slipped && o.f.state === 'down') down = true; });
  return { slicks, small, slipped, down, said: [...window.__said] };
});
check('en stor blodpytt blir glatt (en liten gjør ikke)', slip.slicks === 1 && slip.small === 0, slip);
check('en fiende som løper over, går på trynet: SLIP!', slip.slipped && slip.down && slip.said.includes('SLIP!'), slip);
const dry = await page.evaluate(() => {
  const s = window.__game.scene.stage;
  window.__run(12);
  return { slicks: s.mayhem.slicks.length };
});
check('pytten tørker etter en stund', dry.slicks === 0, dry);

// 6) Skjelettxylofonen
const xylo = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f;
  window.__clear();
  h.pos.set(16, 0, 0.3);
  const notes = [];
  const orig = L.audio.xylo;
  L.audio.xylo = (m) => { notes.push(m); return true; };
  const o = s.spawnFoe('skeleton', 'R');
  o.f.pos.set(19.5, 0, 0.3); o.entered = true;
  window.__run(0.05);
  o.f.die('normal', 1, h);
  window.__run(3);
  L.audio.xylo = orig;
  return { style: o.f.deathStyle, notes: notes.length, distinct: new Set(notes).size, first: notes.slice(0, 8) };
});
check('skjelettet knuses og beina spiller en melodi (en tone per sprett)', xylo.style === 'shatter' && xylo.notes >= 8 && xylo.distinct >= 4, xylo);

// 7) Siste ord på glasset
const words = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, T = L.THREE, s = g.scene.stage, h = s.heroes[0].f, fx = g.fx;
  window.__clear();
  const obj = new T.Object3D();
  obj.position.set(s.camX + 1, 1.6, 0);
  L.W.scene.add(obj);
  fx.hurlAtScreen(obj, h.headImg(), 0.3);
  window.__run(0.4);
  const el = document.querySelector('.glass-words');
  return { text: el?.textContent, shown: !!el, lines: L.MAYHEM_LINES.lastWords, head: fx.glass[0]?.head, sliding: fx.glass[0] ? fx.glass[0].t > fx.glass[0].stickT : null };
});
check('hodet i skjermen sier sine siste ord i en snakkeboble', words.shown && words.lines.includes(words.text) && words.sliding === false, words);
await shot('m7-last-words');
const words2 = await page.evaluate(() => {
  const fx = window.__game.fx;
  window.__run(1.6);
  const gone = !document.querySelector('.glass-words');
  window.__run(1.0);
  const g = fx.glass[0];
  return { gone, head: g ? +g.head.toFixed(2) : 0, done: g ? g.done : true };
});
check('bobla er borte når hodet sklir, og hodet er borte innen tre sekunder', words2.gone && words2.head === 0 && words2.done, words2);
await page.evaluate(() => { window.__game.fx.clearGlass(); window.__run(0.1); });

// 8) Tenner
const teeth = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, W = L.W;
  window.__clear();
  L.TEETH_ODDS[0] = L.TEETH_ODDS[1] = L.TEETH_ODDS[2] = L.TEETH_ODDS[3] = 1;
  h.pos.set(18, 0, 0.3);
  h.face(1);
  const o = s.spawnFoe('hogman', 'R');
  o.f.pos.set(19.6, 0, 0.3); o.entered = true; o.f.frozen = true;
  o.f.hp = o.f.maxHp = 500;
  window.__run(0.05);
  let pings = 0;
  const orig = L.audio.ping;
  L.audio.ping = () => { pings++; };
  const isTooth = (d) => d.obj.geometry?.type === 'ConeGeometry';
  const before = W.gore.debris.filter(isTooth).length;
  L.applyHit(h, o.f, L.HERO_ATK.slash1);
  const light = W.gore.debris.filter(isTooth).length - before;
  window.__run(0.6);
  L.applyHit(h, o.f, L.HERO_ATK.chop);
  const heavy = W.gore.debris.filter(isTooth).length - before - light;
  window.__run(1.5);
  L.audio.ping = orig;
  L.TEETH_ODDS.splice(0, 4, 0, 0.35, 0.55, 0.8);
  return { light, heavy, pings };
});
check('et lett slag slår ikke ut tenner', teeth.light === 0, teeth);
check('et tungt slag i ansiktet slår ut tenner som sier pling', teeth.heavy >= 1 && teeth.pings >= 1, teeth);

// 9) Kjøttbiter på glasset
const chunks = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f, fx = g.fx;
  window.__clear();
  L.GLASS_GIBS.odds = [1, 1, 1, 1];
  h.pos.set(15, 0, 0);
  // Langt bak: ingen biter på glasset
  const far = s.spawnFoe('cultist', 'R');
  far.f.pos.set(s.camX, 0, -2.5); far.entered = true; far.f.frozen = true;
  window.__run(0.05);
  far.f.die('explode', 1, h);
  window.__run(0.8);
  const farChunks = fx.glass.filter((x) => x.chunk).length;
  const near = s.spawnFoe('cultist', 'R');
  near.f.pos.set(s.camX + 1, 0, 2.4); near.entered = true; near.f.frozen = true;
  window.__run(0.05);
  near.f.die('explode', 1, h);
  window.__run(0.8);
  const nearChunks = fx.glass.filter((x) => x.chunk).length;
  return { farChunks, nearChunks, headOnGlass: fx.headOnGlass };
});
check('en eksplosjon langt bak gir ingen biter på glasset', chunks.farChunks === 0, chunks);
check('nær kameraet klistrer kjøttbiter seg på glasset (og teller ikke som et hode)', chunks.nearChunks >= 1 && !chunks.headOnGlass, chunks);
await shot('m9-chunks');
const chunks2 = await page.evaluate(() => {
  const fx = window.__game.fx;
  window.__run(1.0);
  const sliding = fx.glass.filter((x) => x.chunk && x.y > x.y0 + 5).length;
  window.__run(5);
  return { sliding, left: fx.glass.length };
});
check('bitene sklir ned med blodspor og er borte etterpå', chunks2.sliding >= 1 && chunks2.left === 0, chunks2);

// 10) Ildimpen smeller
const imp = await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f;
  window.__clear();
  h.pos.set(19, 0, 0);
  h.burnT = 0;
  const i = s.spawnFoe('fireimp', 'R');
  i.f.pos.set(20.2, 0, 0); i.entered = true; i.f.frozen = true;
  const sk = s.spawnFoe('cultist', 'R');
  sk.f.pos.set(21.3, 0, 0.5); sk.entered = true; sk.f.frozen = true;
  const away = s.spawnFoe('cultist', 'R');
  away.f.pos.set(26, 0, 0); away.entered = true; away.f.frozen = true;
  window.__run(0.05);
  i.f.die('normal', 1, h);
  window.__run(0.05);
  return { hero: +h.burnT.toFixed(1), foe: +sk.f.burnT.toFixed(1), away: away.f.burnT, said: [...window.__said] };
});
check('ildimpen smeller og setter fyr på helten og fienden ved siden av', imp.hero > 0 && imp.foe > 0 && imp.said.some((t) => ['FWOOSH!', 'HOT POTATO!', 'IMP-LOSION!'].includes(t)), imp);
check('men ikke på den som står langt unna', imp.away === 0, imp);
await shot('m10-imp-burst');

// Overkroppen i nærbilde til slutt (for skjermbildet)
await page.evaluate(() => {
  const g = window.__game, L = window.__lib, s = g.scene.stage, h = s.heroes[0].f;
  window.__clear();
  L.MAYHEM.crawl = [1, 1, 1, 1];
  h.pos.set(17, 0, 1.2);
  const o = s.spawnFoe('hogman', 'R');
  o.f.pos.set(21, 0, 1.4); o.entered = true; o.f.frozen = true;
  window.__run(0.1);
  o.f.die('bisect', 1, h);
  window.__run(3.2, () => { h.hp = 9999; });
});
await shot('m11-crawler-close');

check('ingen feil i konsollen', logs.length === 0, logs.slice(0, 5));
await browser.close();
console.log(fails.length ? `\n${fails.length} FEIL: ${fails.join(', ')}` : '\nALT OK');
process.exit(fails.length ? 1 : 0);
