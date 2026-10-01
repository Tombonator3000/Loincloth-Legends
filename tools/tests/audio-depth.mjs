// Lyddybde og levetid: ekte WebAudio-rendring, biombytte, avstand, pause og ro/kamp.
// Bruk: node tools/tests/audio-depth.mjs http://localhost:4173/
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForFunction(() => window.__game && window.__lib?.audio, null, { polling: 100, timeout: 60000 });
await page.evaluate(() => window.__lib.audio.init());
await page.waitForFunction(() => window.__lib.audio.bank.done, null, { polling: 100, timeout: 60000 });
let failed = 0;
const check = (name, ok, data) => { console.log(`${ok ? 'OK' : 'FAIL'} ${name}${data ? ' ' + JSON.stringify(data) : ''}`); if (!ok) failed++; };
const loaded = await page.evaluate(() => ({ ready: __lib.audio.bank.ready, failed: __lib.audio.bank.failed }));
check('Existing recordings decode', loaded.ready >= 137 && loaded.failed === 0, loaded);

// Samme opptak beholdes under biombytte, men får ny EQ og nytt nivå.
await page.evaluate(() => { const a = __lib.audio; a.stop(); a.ambience('grass'); });
await page.waitForTimeout(100);
const wind = await page.evaluate(() => { const a = __lib.audio; window.oldWind = a.amb.voices.get('f:amb_vind'); a.ambience('frost'); return !!oldWind; });
await page.waitForTimeout(2200);
const frost = await page.evaluate(() => { const v = __lib.audio.amb.voices.get('f:amb_vind'); return { same: v === oldWind, hz: v.lp.frequency.value }; });
check('Forest -> frost opens existing wind EQ', wind && frost.same && frost.hz > 16000, frost);
await page.evaluate(() => __lib.audio.ambience('night'));
await page.waitForTimeout(2200);
const night = await page.evaluate(() => __lib.audio.amb.voices.get('f:amb_vind').lp.frequency.value);
check('Frost -> night darkens wind', night < 2400, { hz: night });

// Bål flyttes fra langt venstre til nært høyre: både stereo, styrke og filter må svare.
await page.evaluate(() => __lib.audio.ambienceTick(0.3, 0.12, -0.7));
await page.waitForTimeout(1700);
const far = await page.evaluate(() => { const v = __lib.audio.amb.voices.get('near:f:amb_baal'); return { pan: v.pan.pan.value, hz: v.lp.frequency.value, gain: v.g.gain.value }; });
await page.evaluate(() => __lib.audio.ambienceTick(0.3, 1, 0.7));
await page.waitForTimeout(1700);
const near = await page.evaluate(() => { const v = __lib.audio.amb.voices.get('near:f:amb_baal'); return { pan: v.pan.pan.value, hz: v.lp.frequency.value, gain: v.g.gain.value }; });
check('Local fire moves, brightens and gets louder', far.pan < -0.5 && near.pan > 0.5 && near.hz > far.hz * 1.5 && near.gain > far.gain * 4, { far, near });

await page.evaluate(() => { const a = __lib.audio; a.setPaused(true); window.timersBefore = [...a.amb.eventT]; a.ambienceTick(999, 0, 0); });
await page.waitForTimeout(650);
const paused = await page.evaluate(() => ({ gain: __lib.audio.amb.bus.gain.value, timersFrozen: JSON.stringify(timersBefore) === JSON.stringify(__lib.audio.amb.eventT) }));
check('Pause quiets ambience and freezes wildlife timers', paused.gain < 0.14 && paused.timersFrozen, paused);
await page.evaluate(() => { const a = __lib.audio; a.setPaused(false); a.play('jungle'); a.intensity(0); });
await page.waitForFunction(() => __lib.audio.conductor.level === 0, null, { polling: 100 });
await page.waitForTimeout(3800);
const calm = await page.evaluate(() => ({ music: __lib.audio.moodG.gain.value, amb: __lib.audio.amb.bus.gain.value }));
await page.evaluate(() => __lib.audio.intensity(2));
await page.waitForFunction(() => __lib.audio.conductor.level === 2, null, { polling: 100 });
await page.waitForTimeout(1500);
const fight = await page.evaluate(() => ({ music: __lib.audio.moodG.gain.value, amb: __lib.audio.amb.bus.gain.value }));
check('Calm makes room for the world; combat restores music', calm.music < 0.71 && fight.music > 0.98 && calm.amb > fight.amb * 1.4, { calm, fight });
await page.evaluate(() => { const a = __lib.audio; a.stop(); a.ambience(null); });

// OfflineAudioContext gir faktiske stereoprøver, både med opptak og når banken er av.
const rendered = await page.evaluate(async () => {
  const live = __lib.audio;
  const results = [];
  for (const recorded of [false, true]) for (const biome of ['jungle', 'frost', 'swamp', 'scorch', 'tower', 'arena']) {
    const ctx = new OfflineAudioContext(2, 44100 * 4, 44100);
    const bank = new live.bank.constructor();
    bank.attach(ctx, ctx.destination, 0.8);
    bank.on = recorded;
    bank.meta = live.bank.meta; bank.groups = live.bank.groups; bank.buf = live.bank.buf; bank.lead = live.bank.lead;
    const player = new live.layers.constructor(ctx, live.noise);
    const amb = new live.amb.constructor(ctx, ctx.destination, bank, player);
    amb.set(biome); amb.mix(0); amb.tick(0.3, 0.3, -0.6, biome === 'jungle' ? 0.4 : 0, 0.6);
    // Én faktisk wildlife-hendelse i hvert lag i stedet for å vente tilfeldig mange sekunder.
    amb.eventT.fill(0); amb.tick(0.02, 0.3, -0.6, biome === 'jungle' ? 0.4 : 0, 0.6);
    const b = await ctx.startRendering();
    let peak = 0, sum = 0, side = 0, bad = 0;
    const l = b.getChannelData(0), r = b.getChannelData(1);
    for (let i = 0; i < l.length; i++) { peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i])); sum += l[i] ** 2 + r[i] ** 2; side += (l[i] - r[i]) ** 2; if (!Number.isFinite(l[i]) || !Number.isFinite(r[i])) bad++; }
    results.push({ biome, recorded, peak, rms: Math.sqrt(sum / (l.length * 2)), stereo: Math.sqrt(side / l.length), bad });
  }
  return results;
});
for (const r of rendered) check(`${r.biome} ${r.recorded ? 'recorded' : 'synth'} renders with headroom`, r.peak > 0.001 && r.peak < 0.9 && r.rms > 0.0005 && r.bad === 0 && r.stereo > 0.0001, r);

// Spor hver opprettet node og hver disconnect, så en ferdig lyd ikke etterlater effektnoder i grafen.
const cleanup = await page.evaluate(async () => {
  const a = __lib.audio;
  const ctx = new OfflineAudioContext(2, 44100 * 2, 44100);
  const made = new Set(), gone = new Set();
  for (const key of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createWaveShaper']) {
    const original = ctx[key].bind(ctx);
    ctx[key] = (...args) => { const n = original(...args); made.add(n); const off = n.disconnect.bind(n); n.disconnect = (...args) => { gone.add(n); return off(...args); }; return n; };
  }
  const p = new a.layers.constructor(ctx, a.noise);
  let completed = 0;
  p.play([{ w: 'sine', f: 440, d: 0.2, v: 0.1, vib: [5, 12], lp: [2000, 600], dist: 2 }, { n: 1, d: 0.8, v: 0.1, f0: 2000, f1: 400 }, { arp: [220, 330, 440], nl: 0.12, nd: 0.15, w: 'sine', v: 0.1 }], ctx.destination, 1, 2, 0, () => completed++);
  const b = await ctx.startRendering();
  await new Promise(resolve => setTimeout(resolve, 20));
  const d = b.getChannelData(0); let tail = 0;
  // Høy pitch skal ikke kutte støyen midt i den planlagte konvolutten.
  for (let i = Math.floor(0.55 * b.sampleRate); i < Math.floor(0.7 * b.sampleRate); i++) tail += d[i] ** 2;
  return { made: made.size, disconnected: gone.size, completed, tail };
});
check('Every finished synthetic layer releases its nodes once', cleanup.made === cleanup.disconnected && cleanup.completed === 1 && cleanup.tail > 0.000001, cleanup);
const loopCleanup = await page.evaluate(async () => {
  const a = __lib.audio, results = [];
  for (const recorded of [false, true]) {
    const ctx = new OfflineAudioContext(2, 44100 * 4.5, 44100);
    const made = new Set(), gone = new Set();
    for (const key of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createStereoPanner']) {
      const original = ctx[key].bind(ctx);
      ctx[key] = (...args) => { const n = original(...args); made.add(n); const off = n.disconnect.bind(n); n.disconnect = (...args) => { gone.add(n); return off(...args); }; return n; };
    }
    const bank = new a.bank.constructor(); bank.attach(ctx, ctx.destination); bank.on = recorded;
    bank.meta = a.bank.meta; bank.groups = a.bank.groups; bank.buf = a.bank.buf; bank.lead = a.bank.lead;
    const player = new a.layers.constructor(ctx, a.noise);
    const amb = new a.amb.constructor(ctx, ctx.destination, bank, player);
    amb.set('jungle'); amb.tick(0.3, 0.8, -0.7, 0.7, 0.7);
    const stop = ctx.suspend(0.5).then(async () => { amb.set(null); await ctx.resume(); });
    const b = await ctx.startRendering(); await stop;
    await new Promise(resolve => setTimeout(resolve, 20));
    made.delete(bank.out); made.delete(amb.bus); // Faste busser beholdes for neste brett.
    const remaining = [...made].filter(n => !gone.has(n)).length;
    const d = b.getChannelData(0); let tail = 0;
    for (let i = Math.floor(4 * b.sampleRate); i < d.length; i++) tail = Math.max(tail, Math.abs(d[i]));
    results.push({ recorded, nodes: made.size, remaining, tail, active: amb.active.length });
  }
  return results;
});
for (const r of loopCleanup) check(`Scene exit releases ${r.recorded ? 'recorded' : 'synthetic'} loops`, r.nodes > 5 && r.remaining === 0 && r.tail < 0.00001 && r.active === 0, r);
check('No browser exceptions', errors.length === 0, errors);
await browser.close();
process.exit(failed ? 1 : 0);
