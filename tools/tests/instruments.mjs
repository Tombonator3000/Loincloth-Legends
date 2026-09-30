// Ekte instrumenter i musikken (Karoryfer, CC0): alle gruppene lastes, gitaren og bassen spiller riktig tone gjennom
// forsterkerne, en låt rendres rent med opptakene (ingen klipping eller NaN, nivået nær synthen), trommene høres
// tydelig bedre enn synthtrommene på små høyttalere, gitarene svarer på hvor hardt det slås an, venstre og høyre
// rytmegitar får hvert sitt opptak, kabinettet i forsterkermodellen har kurven til en ekte høyttaler og tar bort
// synthsuset over 10 kHz, og uten opptak (RECORDED SOUNDS av) spiller bandet synth som før.
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
const GROUPS = ['ins_stortromme', 'ins_skarp', 'ins_hihat', 'ins_crash', 'ins_tam', 'ins_elgitar', 'ins_gitardemp', 'ins_bass'];
const loaded = await page.evaluate((gs) => Object.fromEntries(gs.map((g) => [g, window.__lib.audio.bank.full(g)])), GROUPS);
check('alle instrumentgruppene er lastet', Object.values(loaded).every(Boolean), loaded);

// Tonehøyden: render én tone gjennom bandet og finn toppen i spekteret nær tonen (parabel mellom bøttene)
const pitch = (code, f0, secs = 1.2, from = 0.15, len = 0.8) => page.evaluate(async ({ code, f0, secs, from, len }) => {
  const L = window.__lib, sr = 44100;
  const ctx = new OfflineAudioContext(1, Math.floor(sr * secs), sr);
  const b = new L.MetalBand(ctx, ctx.destination);
  b.samples = { pick: (g, m, v) => L.audio.bank.pick(g, m, v), full: (g) => L.audio.bank.full(g) };
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
  if (real) b.samples = { pick: (g, m, v) => L.audio.bank.pick(g, m, v), full: (g) => L.audio.bank.full(g) };
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

// Trommene alene i låta, med synth og med opptak. Lydstyrken måles som på en mobilhøyttaler (K-vekting som LUFS, pluss
// høypass 150 Hz og lavpass 9 kHz). Med de første opptakene lå de ekte trommene 1 dB under synthtrommene her.
const drumsOnly = (real) => page.evaluate(async ({ real }) => {
  const L = window.__lib, sr = 44100, secs = 8;
  const ctx = new OfflineAudioContext(2, sr * secs, sr);
  const bus = ctx.createGain(); bus.gain.value = 0.314 * 0.7;
  const master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  bus.connect(master).connect(comp).connect(ctx.destination);
  const b = new L.MetalBand(ctx, bus);
  if (real) b.samples = { pick: (g, m, v) => L.audio.bank.pick(g, m, v), full: (g) => L.audio.bank.full(g) };
  b.powerChord = () => {};
  b.leadNote = () => {};
  const tr = L.METAL_TRACKS.stage, sd = 60 / tr.bpm / 4;
  for (let s = 0, t = 0.05; t < secs - 0.4; s++, t += sd) b.playStep(tr, s % tr.steps, t, sd);
  const buf = await ctx.startRendering();
  const biq = (x, type, f0, q, db = 0) => {
    const w = (2 * Math.PI * f0) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q), A = Math.pow(10, db / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else { const sA = 2 * Math.sqrt(A) * al; b0 = A * (A + 1 + (A - 1) * cw + sA); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - sA); a0 = A + 1 - (A - 1) * cw + sA; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - sA; }
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  };
  let e = 0;
  for (let ch = 0; ch < 2; ch++) {
    const y = biq(biq(biq(biq(biq(buf.getChannelData(ch), 'hs', 1681.97, 0.7072, 4), 'hp', 38.14, 0.5003), 'hp', 150, 0.707), 'hp', 150, 0.707), 'lp', 9000, 0.707);
    for (let i = 0; i < y.length; i++) e += y[i] * y[i];
  }
  return +(-0.691 + 10 * Math.log10(e / buf.length + 1e-12)).toFixed(1);
}, { real });
const drums = { synth: await drumsOnly(false), real: await drumsOnly(true) };
check('de ekte trommene høres over synthtrommene på små høyttalere (minst 3 dB)', drums.real - drums.synth >= 3, drums);

// Anslaget: hvor mye svakere en åpen akkord og en leadtone blir når de slås an med 0,3 i stedet for 0,9. En forsterker
// med mye gain flater ut forskjellen (synthen: under 1 dB). Opptakene går i egne forsterkere med mindre gain, så
// gitaren svarer på anslaget som en ekte gitar (de første opptakene gikk i synthforsterkerne: 1 til 2 dB).
const touch = (real) => page.evaluate(async ({ real }) => {
  const L = window.__lib, sr = 44100;
  const level = async (code) => {
    const ctx = new OfflineAudioContext(2, sr, sr);
    const b = new L.MetalBand(ctx, ctx.destination);
    if (real) b.samples = { pick: (g, m, v) => L.audio.bank.pick(g, m, v), full: (g) => L.audio.bank.full(g) };
    new Function('b', code)(b);
    const buf = await ctx.startRendering();
    const x = buf.getChannelData(0), y = buf.getChannelData(1);
    let s = 0;
    for (let i = Math.floor(0.03 * sr); i < Math.floor(0.8 * sr); i++) s += x[i] * x[i] + y[i] * y[i];
    return 10 * Math.log10(s + 1e-12);
  };
  const diff = async (f) => +((await level(f(0.9))) - (await level(f(0.3)))).toFixed(1);
  return { chord: await diff((v) => `b.powerChord(0.02, 40, 1.0, true, ${v}, false)`), lead: await diff((v) => `b.leadNote(0.02, 64, 0.7, 0, ${v})`) };
}, { real });
const tch = { synth: await touch(false), real: await touch(true) };
check('de ekte gitarene svarer på anslaget (egne forsterkere med mindre gain)', tch.real.chord + tch.real.lead >= 5, tch);

// Dobbeltinnspillingen: variant 0 og 1 av grunntonen, kvinten og oktaven i en E-akkord er ulike opptak
const takes = await page.evaluate(() => {
  const b = window.__lib.audio.bank;
  return [40, 47, 52].map((m) => { const a = b.pick('ins_elgitar', m, 0), c = b.pick('ins_elgitar', m, 1); return !!a && !!c && a.buf !== c.buf; });
});
check('venstre og høyre rytmegitar får hvert sitt opptak av tonene', takes.every(Boolean), takes);

// Kabinettet (core/guitaramp.ts): kurven til en Celestion Vintage 30 med SM57, topper ved 2,5 og 4 kHz og fall over
// 5,5 kHz. Frekvensresponsen til impulsresponsen måles direkte.
const cab = await page.evaluate(() => {
  const sr = 44100, ir = window.__lib.cabinetIR(new OfflineAudioContext(1, 1024, sr)).getChannelData(0);
  const at = (f) => { let re = 0, im = 0; for (let i = 0; i < ir.length; i++) { re += ir[i] * Math.cos((2 * Math.PI * f * i) / sr); im -= ir[i] * Math.sin((2 * Math.PI * f * i) / sr); } return +(10 * Math.log10(re * re + im * im + 1e-20)).toFixed(1); };
  return Object.fromEntries([118, 420, 1100, 2500, 4000, 8000, 12000].map((f) => [f, at(f)]));
});
check('kabinettet har kurven til en ekte høyttaler (topper ved 2,5 og 4 kHz, -10 dB ved 8 kHz og -25 ved 12 kHz)',
  cab[2500] > cab[1100] + 2 && cab[4000] > cab[1100] + 2 && cab[118] > cab[420] && cab[8000] < cab[4000] - 10 && cab[12000] < cab[4000] - 25, cab);

// Rytmegitarene alene i låta: andelen av energien over 10 kHz. Forvrengning uten høyttaler (synthen) har sus der oppe,
// en ekte høyttaler nesten ingenting.
const fizz = (real) => page.evaluate(async ({ real }) => {
  const L = window.__lib, sr = 44100, secs = 8;
  const ctx = new OfflineAudioContext(1, sr * secs, sr);
  const b = new L.MetalBand(ctx, ctx.destination);
  if (real) b.samples = { pick: (g, m, v) => L.audio.bank.pick(g, m, v), full: (g) => L.audio.bank.full(g) };
  for (const d of ['kick', 'snare', 'hat', 'crash', 'tom']) b[d] = () => {};
  b.leadNote = () => {};
  b.bass = () => {};
  const tr = L.METAL_TRACKS.stage, sd = 60 / tr.bpm / 4;
  for (let s = 0, t = 0.05; t < secs - 0.4; s++, t += sd) b.playStep(tr, s % tr.steps, t, sd);
  const x = (await ctx.startRendering()).getChannelData(0);
  // Spekteret i vinduer på 4096 punkter (Hann), summert
  const N = 4096, re = new Float64Array(N), im = new Float64Array(N);
  let hi = 0, all = 0;
  for (let o = 0; o + N < x.length; o += N) {
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); im[i] = 0; }
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= N; len <<= 1) { const ang = (-2 * Math.PI) / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, c2 = a + len / 2; const vr = re[c2] * wr - im[c2] * wi, vi = re[c2] * wi + im[c2] * wr; re[c2] = re[a] - vr; im[c2] = im[a] - vi; re[a] += vr; im[a] += vi; } }
    for (let k = 1; k < N / 2; k++) { const e = re[k] * re[k] + im[k] * im[k], hz = (k * sr) / N; if (hz > 60) all += e; if (hz > 10000) hi += e; }
  }
  return +(10 * Math.log10(hi / all)).toFixed(1);
}, { real });
const fz = { synth: await fizz(false), real: await fizz(true) };
check('el-gitaren har mindre sus over 10 kHz enn synthen (minst 3 dB)', fz.real <= fz.synth - 3, fz);

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
