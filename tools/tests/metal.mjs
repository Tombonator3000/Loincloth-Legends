// Offline-rendring av metal-låtene (src/core/metal.ts) i nettleseren: WAV-fil, spektrogram og målinger
// (toppnivå, RMS, klipping, NaN og frekvensbalanse), så lyden kan sjekkes uten høyttalere.
// Bruk: node tools/tests/metal.mjs http://localhost:4173/ ./shots [title,stage,...|all] [sekunder] [shred] [real|both] [instrument]
// real: med instrumentopptakene fra lydbanken (Karoryfer), both: både synth og opptak.
// instrument: drums, guitar (rytmegitarene), bass eller lead alene (standard: alt), til lytteprøver og målinger.
import { chromium } from 'playwright';
import fs from 'fs';
const [url, out, only = 'all', secsArg = '14', shredArg = '', realArg = '', stem = 'all'] = process.argv.slice(2);
const secs = Number(secsArg);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
const names = only === 'all' ? await page.evaluate(() => Object.keys(window.__lib.METAL_TRACKS)) : only.split(',');
if (realArg) {
  // Lydbanken må være pakket ut før opptakene kan brukes
  await page.evaluate(() => window.__lib.audio.init());
  for (let i = 0; i < 120; i++) {
    const d = await page.evaluate(() => window.__lib.audio.bank.done);
    if (d) break;
    await page.waitForTimeout(500);
  }
  console.log('bank', JSON.stringify(await page.evaluate(() => { const b = window.__lib.audio.bank; return { ready: b.ready, total: b.total, failed: b.failed }; })));
}
for (const name of names) {
  for (const [shred, real] of (shredArg ? [false, true] : [false]).flatMap((sh) => (realArg === 'both' ? [false, true] : [realArg === 'real']).map((re) => [sh, re]))) {
    const r = await page.evaluate(async ({ name, secs, shred, real, stem }) => {
      const L = window.__lib;
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, Math.floor(sr * secs), sr);
      // Samme kjede som i spillet: musikkbuss, master og kompressor (core/audio.ts)
      const bus = ctx.createGain();
      bus.gain.value = 0.314 * 0.7;
      const master = ctx.createGain();
      master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      bus.connect(master).connect(comp).connect(ctx.destination);
      const band = new L.MetalBand(ctx, bus);
      band.shred = shred;
      if (real) band.samples = { pick: (g, m) => L.audio.bank.pick(g, m), full: (g) => L.audio.bank.full(g) };
      // Ett instrument alene: de andre blir stille (bassen følger akkordene, så den spilles fra powerChord)
      const nop = () => {};
      const kit = ['kick', 'snare', 'hat', 'crash', 'tom'];
      if (stem === 'drums') { band.powerChord = nop; band.leadNote = nop; }
      if (stem === 'guitar') { for (const d of kit) band[d] = nop; band.leadNote = nop; band.bass = nop; }
      if (stem === 'lead') { for (const d of kit) band[d] = nop; band.powerChord = nop; }
      if (stem === 'bass') {
        for (const d of kit) band[d] = nop;
        band.leadNote = nop;
        band.powerChord = function (t, root, dur, open, vel = 1, withBass = true) { if (withBass) this.bass(t, root - 12, open ? dur : Math.min(dur, 0.24), vel); };
      }
      const tr = L.METAL_TRACKS[name];
      const sd = 60 / tr.bpm / 4;
      for (let s = 0, t = 0.05; t < secs - 0.4; s++, t += sd) band.playStep(tr, s % tr.steps, t, sd);
      const t0 = performance.now();
      const buf = await ctx.startRendering();
      const ms = performance.now() - t0;
      const Lc = buf.getChannelData(0), Rc = buf.getChannelData(1);
      let peak = 0, sum = 0, nan = 0, clip = 0, dc = 0, side = 0;
      for (let i = 0; i < Lc.length; i++) {
        const a = Lc[i], b = Rc[i];
        if (Number.isNaN(a) || Number.isNaN(b)) { nan++; continue; }
        peak = Math.max(peak, Math.abs(a), Math.abs(b));
        if (Math.abs(a) > 0.99 || Math.abs(b) > 0.99) clip++;
        sum += a * a + b * b;
        dc += a + b;
        side += ((a - b) / 2) ** 2;
      }
      const n = Lc.length * 2;
      const rms = Math.sqrt(sum / n);
      // Gjennomsnittlig spektrum med enkel FFT over vinduer, og et spektrogram
      const N = 2048, hop = 1024;
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
              const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
              const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
              re[i + k] = ur + vr; im[i + k] = ui + vi;
              re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
            }
        }
      };
      const frames = Math.floor((Lc.length - N) / hop);
      const avg = new Float64Array(N / 2);
      const W = Math.min(frames, 900), H = 256;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c2 = cv.getContext('2d');
      const img = c2.createImageData(W, H);
      // Hver pikselrad slår opp nærmeste frekvens (logaritmisk akse fra 30 Hz til 16 kHz), fargekart svart-rød-gul-hvit
      const heat = (v) => [Math.min(255, v * 3), Math.max(0, Math.min(255, v * 3 - 255)), Math.max(0, Math.min(255, v * 3 - 510))];
      for (let f = 0; f < frames; f++) {
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N; i++) re[i] = ((Lc[f * hop + i] + Rc[f * hop + i]) / 2) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
        fft(re, im);
        const pw = new Float64Array(N / 2);
        for (let k = 0; k < N / 2; k++) {
          pw[k] = re[k] * re[k] + im[k] * im[k];
          avg[k] += pw[k];
        }
        const x = Math.floor((f / frames) * W);
        for (let y = 0; y < H; y++) {
          const hz = 30 * Math.pow(16000 / 30, (H - 1 - y) / (H - 1));
          const kf = (hz * N) / sr;
          const k0 = Math.floor(kf), fr = kf - k0;
          const p = pw[k0] * (1 - fr) + (pw[k0 + 1] ?? pw[k0]) * fr;
          const v = Math.max(0, Math.min(255, (10 * Math.log10(p + 1e-12) + 40) * 3.2));
          const [r, g, b] = heat(v);
          const o = (y * W + x) * 4;
          img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
        }
      }
      c2.putImageData(img, 0, 0);
      const energy = (lo, hi) => {
        let e = 0;
        for (let k = 0; k < N / 2; k++) { const hz = (k * sr) / N; if (hz >= lo && hz < hi) e += avg[k]; }
        return e;
      };
      const bands = { sub: energy(20, 80), low: energy(80, 250), lowmid: energy(250, 800), mid: energy(800, 2500), high: energy(2500, 6000), air: energy(6000, 20000) };
      const tot = Object.values(bands).reduce((a, b) => a + b, 0);
      const pct = Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, Math.round((v / tot) * 1000) / 10]));
      // WAV (16 bit, stereo)
      const bytes = new Uint8Array(44 + Lc.length * 4);
      const dv = new DataView(bytes.buffer);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + Lc.length * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
      dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, Lc.length * 4, true);
      for (let i = 0; i < Lc.length; i++) {
        dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, Lc[i] || 0)) * 32767, true);
        dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rc[i] || 0)) * 32767, true);
      }
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return {
        wav: btoa(bin), png: cv.toDataURL().split(',')[1], ms: Math.round(ms),
        peak: peak.toFixed(3), rmsDb: (20 * Math.log10(rms + 1e-12)).toFixed(1), clipPct: ((clip / Lc.length) * 100).toFixed(2),
        nan, dc: (dc / n).toFixed(4), width: (Math.sqrt(side / Lc.length) / (rms + 1e-12)).toFixed(2), pct,
      };
    }, { name, secs, shred, real, stem });
    const tag = name + (stem !== 'all' ? '-' + stem : '') + (shred ? '-shred' : '') + (real ? '-real' : '');
    fs.writeFileSync(`${out}/metal-${tag}.wav`, Buffer.from(r.wav, 'base64'));
    fs.writeFileSync(`${out}/metal-${tag}.png`, Buffer.from(r.png, 'base64'));
    console.log(tag, 'render', r.ms, 'ms', 'peak', r.peak, 'rms', r.rmsDb, 'dBFS', 'clip%', r.clipPct, 'nan', r.nan, 'dc', r.dc, 'stereo', r.width, JSON.stringify(r.pct));
  }
}
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
