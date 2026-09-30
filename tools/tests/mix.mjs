// Blandingen i metal-musikken, instrument for instrument: hvert trommeslag, kraftakkorder, palm mute, leadtoner og bass
// alene gjennom samme kjede som i spillet, med synth og med opptakene (Karoryfer). Skriver forskjellen i rå RMS,
// hørbar lydstyrke (K-vekting som LUFS) og "mobil" (K pluss høypass 150 Hz og lavpass 9 kHz, omtrent det en
// mobilhøyttaler får fram), toppnivået og energien i ni bånd fra 20 Hz til 16 kHz.
// Rå RMS lurer: synthbassen og synthstortromma legger mye energi under 60 Hz som små høyttalere ikke spiller. Bruk K og
// mobil når nivåene i REAL_AMP, REAL, BASS_R og KIT (src/core/metal.ts) eller kabinettet (src/core/guitaramp.ts) justeres.
// Bruk: node tools/tests/mix.mjs http://localhost:4173/ [kick,snare,hat,crash,tom,chord,mute,lead,bass]
import { chromium } from 'playwright';
const [url, only] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.setDefaultTimeout(600000);
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.evaluate(() => window.__lib.audio.init());
for (let i = 0; i < 120; i++) {
  if (await page.evaluate(() => window.__lib.audio.bank.done)) break;
  await page.waitForTimeout(500);
}
const TESTS = {
  kick: 'for (let i = 0; i < 12; i++) b.kick(0.1 + i * 0.25, 1)',
  snare: 'for (let i = 0; i < 6; i++) b.snare(0.1 + i * 0.5, 1)',
  hat: 'for (let i = 0; i < 24; i++) b.hat(0.1 + i * 0.125, 1)',
  crash: 'b.crash(0.1, 1)',
  tom: 'for (let i = 0; i < 8; i++) b.tom(0.1 + i * 0.35, [180, 150, 120, 90][i % 4], 1)',
  chord: 'b.powerChord(0.1, 40, 1.2, true, 0.9, false); b.powerChord(1.5, 45, 1.2, true, 0.9, false)',
  mute: 'for (let i = 0; i < 16; i++) b.powerChord(0.1 + i * 0.16, 40, 0.14, false, 0.8, false)',
  lead: 'b.leadNote(0.1, 64, 0.6, 0, 0.9); b.leadNote(0.8, 69, 0.6, 2, 0.9); b.leadNote(1.5, 76, 0.9, 0, 0.9)',
  bass: 'for (let i = 0; i < 8; i++) b.bass(0.1 + i * 0.3, [28, 31, 33, 36][i % 4], 0.26, 0.8)',
};
console.log('bånd (Hz): 20 60 120 250 500 1k 2k 4k 8k (dB)');
for (const [name, code] of Object.entries(TESTS)) {
  if (only && !only.split(',').includes(name)) continue;
  const r = await page.evaluate(async ({ code }) => {
    const L = window.__lib, sr = 44100, secs = 3.2, out = {};
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
    const loud = (chs, mobil) => {
      let e = 0;
      for (const x of chs) {
        let y = biq(biq(x, 'hs', 1681.97, 0.7072, 4), 'hp', 38.14, 0.5003);
        if (mobil) y = biq(biq(biq(y, 'hp', 150, 0.707), 'hp', 150, 0.707), 'lp', 9000, 0.707);
        for (let i = 0; i < y.length; i++) e += y[i] * y[i];
      }
      return +(-0.691 + 10 * Math.log10(e / chs[0].length + 1e-12)).toFixed(1);
    };
    const fft = (re, im) => {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        for (let i = 0; i < n; i += len)
          for (let k = 0; k < len / 2; k++) {
            const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
            const ur = re[i + k], ui = im[i + k];
            const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi, vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
            re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          }
      }
    };
    for (const real of [false, true]) {
      const ctx = new OfflineAudioContext(2, sr * secs, sr);
      // Samme kjede som i spillet: musikkbuss, master og kompressor (core/audio.ts)
      const bus = ctx.createGain(); bus.gain.value = 0.314 * 0.7;
      const master = ctx.createGain(); master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      bus.connect(master).connect(comp).connect(ctx.destination);
      const b = new L.MetalBand(ctx, bus);
      if (real) b.samples = { pick: (g, m, v) => L.audio.bank.pick(g, m, v), full: (g) => L.audio.bank.full(g) };
      new Function('b', code)(b);
      const buf = await ctx.startRendering();
      const a = buf.getChannelData(0), c = buf.getChannelData(1);
      let s = 0, pk = 0;
      for (let i = 0; i < a.length; i++) { s += a[i] * a[i] + c[i] * c[i]; pk = Math.max(pk, Math.abs(a[i]), Math.abs(c[i])); }
      const N = 4096, avg = new Float64Array(N / 2);
      let frames = 0;
      for (let o = 0; o + N < a.length; o += N / 2, frames++) {
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N; i++) re[i] = ((a[o + i] + c[o + i]) / 2) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
        fft(re, im);
        for (let k = 0; k < N / 2; k++) avg[k] += re[k] * re[k] + im[k] * im[k];
      }
      const E = [20, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000], bands = [];
      for (let i = 0; i < E.length - 1; i++) {
        let e = 0;
        for (let k = 1; k < N / 2; k++) { const hz = (k * sr) / N; if (hz >= E[i] && hz < E[i + 1]) e += avg[k]; }
        bands.push(Math.round(10 * Math.log10(e / frames + 1e-12)));
      }
      out[real ? 'real' : 'synth'] = { rms: +(10 * Math.log10(s / (a.length * 2) + 1e-12)).toFixed(1), k: loud([a, c], false), mobil: loud([a, c], true), peak: +pk.toFixed(3), bands: bands.join(' ') };
    }
    return out;
  }, { code });
  const d = (k) => String(+(r.real[k] - r.synth[k]).toFixed(1)).padStart(5);
  console.log(`${name.padEnd(6)} opptak minus synth: rms ${d('rms')}  K ${d('k')}  mobil ${d('mobil')} | synth K ${r.synth.k} topp ${r.synth.peak} [${r.synth.bands}] | opptak K ${r.real.k} topp ${r.real.peak} [${r.real.bands}]`);
}
await browser.close();
