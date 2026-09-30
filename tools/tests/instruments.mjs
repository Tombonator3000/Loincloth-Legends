// Ekte instrumenter i musikken (Karoryfer, CC0): alle gruppene lastes, gitaren og bassen spiller riktig tone gjennom
// forsterkerne, en låt rendres rent med opptakene (ingen klipping eller NaN, nivået nær synthen), og uten opptak
// (RECORDED SOUNDS av) spiller bandet synth som før.
// Bruk: node tools/tests/instruments.mjs http://localhost:4173/
import { chromium } from 'playwright';
const [url] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.setDefaultTimeout(180000);
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) logs.push('console: ' + m.text()); });
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : ''));
  if (!ok) fails.push(name);
};

await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.evaluate(() => window.__lib.audio.init());
for (let i = 0; i < 120; i++) {
  if (await page.evaluate(() => window.__lib.audio.bank.done)) break;
  await page.waitForTimeout(500);
}
const GROUPS = ['ins_stortromme', 'ins_skarp', 'ins_hihat', 'ins_crash', 'ins_tam', 'ins_gitar', 'ins_gitarkort', 'ins_bass'];
const loaded = await page.evaluate((gs) => Object.fromEntries(gs.map((g) => [g, window.__lib.audio.bank.full(g)])), GROUPS);
check('alle instrumentgruppene er lastet', Object.values(loaded).every(Boolean), loaded);

// Tonehøyden: render én tone gjennom bandet og finn toppen i spekteret nær tonen (parabel mellom bøttene)
const pitch = (code, f0, secs = 1.2, from = 0.15, len = 0.8) => page.evaluate(async ({ code, f0, secs, from, len }) => {
  const L = window.__lib, sr = 44100;
  const ctx = new OfflineAudioContext(1, Math.floor(sr * secs), sr);
  const b = new L.MetalBand(ctx, ctx.destination);
  b.samples = { pick: (g, m) => L.audio.bank.pick(g, m), full: (g) => L.audio.bank.full(g) };
  new Function('b', code)(b);
  const x = (await ctx.startRendering()).getChannelData(0).slice(Math.floor(sr * from), Math.floor(sr * (from + len)));
  // Spekteret med Goertzel på et fint rutenett rundt f0 (± 60 cent)
  const w = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (x.length - 1))));
  let best = 0, bf = f0;
  for (let c = -60; c <= 60; c += 1) {
    const f = f0 * Math.pow(2, c / 1200), k = (2 * Math.PI * f) / sr;
    let s1 = 0, s2 = 0;
    const cf = 2 * Math.cos(k);
    for (let i = 0; i < w.length; i++) { const s0 = w[i] + cf * s1 - s2; s2 = s1; s1 = s0; }
    const p = s1 * s1 + s2 * s2 - cf * s1 * s2;
    if (p > best) { best = p; bf = f; }
  }
  return { hz: +bf.toFixed(2), cents: Math.round(1200 * Math.log2(bf / f0)) };
}, { code, f0, secs, from, len });
const lead = await pitch('b.leadNote(0.02, 57, 0.2, 0, 0.9)', 220, 0.4, 0.04, 0.16);
check('leadgitaren spiller A3 (220 Hz)', Math.abs(lead.cents) <= 20, lead);
const bass = await pitch('b.bass(0.02, 33, 1.0, 0.9)', 55);
check('bassen spiller A1 (55 Hz)', Math.abs(bass.cents) <= 20, bass);
const chord = await pitch('b.powerChord(0.02, 45, 1.0, true, 0.9, false)', 110);
check('kraftakkorden står på A2 (110 Hz)', Math.abs(chord.cents) <= 20, chord);

// En hel låt med opptakene mot synthen
const song = (real) => page.evaluate(async ({ real }) => {
  const L = window.__lib, sr = 44100, secs = 10;
  const ctx = new OfflineAudioContext(2, sr * secs, sr);
  const bus = ctx.createGain(); bus.gain.value = 0.314 * 0.7;
  const master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  bus.connect(master).connect(comp).connect(ctx.destination);
  const b = new L.MetalBand(ctx, bus);
  if (real) b.samples = { pick: (g, m) => L.audio.bank.pick(g, m), full: (g) => L.audio.bank.full(g) };
  const tr = L.METAL_TRACKS.stage, sd = 60 / tr.bpm / 4;
  for (let s = 0, t = 0.05; t < secs - 0.4; s++, t += sd) b.playStep(tr, s % tr.steps, t, sd);
  const buf = await ctx.startRendering();
  const a = buf.getChannelData(0), c = buf.getChannelData(1);
  let sum = 0, pk = 0, nan = 0, clip = 0;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i]) || Number.isNaN(c[i])) { nan++; continue; }
    sum += a[i] * a[i] + c[i] * c[i];
    pk = Math.max(pk, Math.abs(a[i]), Math.abs(c[i]));
    if (Math.abs(a[i]) > 0.99 || Math.abs(c[i]) > 0.99) clip++;
  }
  return { rms: +(10 * Math.log10(sum / (a.length * 2) + 1e-12)).toFixed(1), peak: +pk.toFixed(3), nan, clip };
}, { real });
const synth = await song(false), real = await song(true);
check('låta med opptakene er ren (ingen klipping eller NaN)', real.nan === 0 && real.clip === 0 && real.peak < 0.9, real);
check('nivået er nær synthen (innen 3 dB)', Math.abs(real.rms - synth.rms) <= 3, { synth, real });

// Uten opptak (RECORDED SOUNDS av): synth
const off = await page.evaluate(() => {
  const bank = window.__lib.audio.bank;
  const was = bank.on;
  bank.on = false;
  const r = { full: bank.full('ins_gitar'), pick: bank.pick('ins_stortromme', 36) };
  bank.on = was;
  return { full: r.full, pick: r.pick === null };
});
check('uten opptak spiller bandet synth', off.full === false && off.pick === true, off);

if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
console.log(fails.length ? `FEIL: ${fails.length} (${fails.join(', ')})` : 'OK: ekte trommer, gitar og bass i musikken');
process.exitCode = fails.length || logs.length ? 1 : 0;
await browser.close();
