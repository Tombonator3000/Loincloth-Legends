// Dirigenten (core/conductor.ts): låtbytte på taktstreken med bro, bekkensvulm som topper på første slag, lag opp på
// slaget og ned på taktstreken, METAL MODE inn på slaget og solo på streken, innslag på slaget og i tonearten, sjefen på
// en taktstrek minst 1,4 sekunder fram, avslutning og seiersmusikk, og tapslyden ved game over.
// Del 1 rendrer med OfflineAudioContext og en simulert lydklokke (samme kode som i spillet), og måler lyden.
// Del 2 spiller spillet med den ekte lydklokka og sjekker hendelsene til dirigenten.
// Med en mappe som andre argument skrives den rendrede lyden til imuse-offline.wav, så overgangene kan lyttes på.
// Bruk: node tools/tests/imuse.mjs http://localhost:4173/ [./shots]
import { chromium } from 'playwright';
import fs from 'fs';
const [url, out] = process.argv.slice(2);
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ args: ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
const fails = [];
const check = (name, ok, info = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + info : ''));
  if (!ok) fails.push(name);
};
await page.goto(url + (url.includes('?') ? '&' : '?') + 'nosplash');
await page.waitForTimeout(1500);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; localStorage.clear(); window.__lib.audio.init(); });
// Lydbanken (VCSL-bekkenet til svulmen, paukene og gongen)
for (let i = 0; i < 80; i++) {
  if (await page.evaluate(() => window.__lib.audio.bank.done)) break;
  await page.waitForTimeout(250);
}
const hasCymbal = await page.evaluate(() => window.__lib.audio.bank.hasFile('ins_bekken_1'));
console.log('sound bank loaded, cymbal swell sample:', hasCymbal);

// ---------------------------------------------------------------- del 1: offline med simulert klokke
const off = await page.evaluate(async (wantWav) => {
  const L = window.__lib;
  const sr = 44100;
  const secs = 24;
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
  const bank = L.audio.bank;
  // Samme AudioBuffer kan spilles i en annen kontekst, så VCSL-bekkenet brukes her også når det er lastet
  if (bank.hasFile('ins_bekken_1')) band.swellSample = () => ({ buf: bank.buffer('ins_bekken_1'), lead: bank.leadIn('ins_bekken_1') });
  // Spioner på akkordene, bassen og leadtonene (grunntoner og tonehøyder i broen og innslagene)
  const chords = [];
  const basses = [];
  const leads = [];
  const pc = band.powerChord.bind(band);
  band.powerChord = (t, root, dur, open, vel, withBass = true) => { chords.push([t, root, open, withBass]); return pc(t, root, dur, open, vel, withBass); };
  const bs = band.bass.bind(band);
  band.bass = (t, m, dur, vel) => { basses.push([t, m]); return bs(t, m, dur, vel); };
  const ln = band.leadNote.bind(band);
  band.leadNote = (t, m, ...a) => { leads.push([t, m]); return ln(t, m, ...a); };
  // Ekkoet skal bare settes når tempoet endres (før ble det satt på hvert steg, og et tempobytte knitret)
  let echoSets = 0, steps = 0;
  const dly = band.echo.delayTime;
  for (const k of ['setValueAtTime', 'setTargetAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) {
    const f = dly[k].bind(dly);
    dly[k] = (...a) => { echoSets++; return f(...a); };
  }
  // Sjefslaget: koret og paukene (syntpauker her, uten lydbanken)
  const pads = [];
  const pd = band.pad.bind(band);
  band.pad = (t, ...a) => { pads.push(t); return pd(t, ...a); };
  const ps = band.playStep.bind(band);
  band.playStep = (...a) => { steps++; return ps(...a); };
  let now = 0;
  const C = new L.Conductor(new L.BandPerformer(band), () => now);
  const song = (n) => ({ name: n, track: L.METAL_TRACKS[n] });
  const marks = {};
  const pend = () => ({ at: C.pending.at, from: C.pending.from, T: C.pending.T, step: C.step, now });
  const script = [
    [0, () => C.start(song('stage'), 0.05, 1)],
    [2.03, () => { C.queue(song('frost'), 'bar'); marks.p1 = pend(); }],
    [5.0, () => C.setLevel(2)],
    [6.1, () => { marks.cue = now; C.cue('clear'); }],
    [7.3, () => C.setLevel(0)],
    [9.05, () => { C.setLevel(1); C.metal(true); }],
    [12.4, () => C.metal(false)],
    [14.2, () => { C.queue(song('duel'), 'bar', true); C.setLevel(3); marks.p2 = pend(); }],
    [19.0, () => C.end(song('victory'))],
  ];
  let k = 0;
  for (now = 0; now < secs - 0.3; now = Math.round((now + 0.01) * 1000) / 1000) {
    while (k < script.length && script[k][0] <= now) script[k++][1]();
    C.advance(now + 0.12);
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const ms = Math.round(performance.now() - t0);
  const Lc = buf.getChannelData(0), Rc = buf.getChannelData(1);
  const mono = new Float32Array(Lc.length);
  let nan = 0, peak = 0, clip = 0;
  for (let i = 0; i < Lc.length; i++) {
    const a = Lc[i], b = Rc[i];
    if (Number.isNaN(a) || Number.isNaN(b)) { nan++; continue; }
    mono[i] = (a + b) / 2;
    peak = Math.max(peak, Math.abs(a), Math.abs(b));
    if (Math.abs(a) > 0.99 || Math.abs(b) > 0.99) clip++;
  }
  const E = (a, b) => {
    const i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(mono.length, Math.floor(b * sr));
    let s = 0;
    for (let i = i0; i < i1; i++) s += mono[i] * mono[i];
    return s / Math.max(1, i1 - i0);
  };
  // Anslaget nær T: første sted der energien stiger minst halvparten så mye som den største stigningen (4 ms etter mot
  // 4 ms før). Gitarene er dobbeltinnspilt 7 ms fra hverandre og crashen er dobbel for sjefen, så toppen i seg selv
  // kan komme litt etter. jump er hvor mye sterkere det er rett etter T enn rett før.
  const onset = (T) => {
    const rise = [];
    for (let t = T - 0.02; t <= T + 0.03; t += 0.0005) rise.push([t, E(t, t + 0.004) - E(t - 0.004, t)]);
    const top = Math.max(...rise.map((r) => r[1]));
    const first = rise.find((r) => r[1] >= top * 0.5);
    return { dt: +((first[0] - T) * 1000).toFixed(1), jump: +(E(T, T + 0.03) / Math.max(1e-12, E(T - 0.035, T - 0.005))).toFixed(2) };
  };
  const ev = C.events.map((e) => ({ ...e, t: +e.t.toFixed(4) }));
  const sw = ev.filter((e) => e.kind === 'switch');
  const lvl = ev.filter((e) => e.kind === 'level');
  const seg = (a, b) => Math.sqrt(E(a, b));
  const lv2 = lvl.find((e) => e.info === 2), lv0 = lvl.find((e) => e.info === 0 && e.t > (lv2?.t ?? 0));
  const shredIn = ev.find((e) => e.kind === 'shred-in');
  const near = (arr, t, eps = 0.002) => arr.filter((x) => Math.abs(x[0] - t) < eps);
  const T1 = marks.p1.T, T2 = marks.p2.T;
  const sd1 = 60 / 150 / 4;
  const cueEv = ev.find((e) => e.kind === 'cue');
  let wav = null;
  if (wantWav) {
    // WAV (16 bit, stereo)
    const bytes = new Uint8Array(44 + Lc.length * 4);
    const dv = new DataView(bytes.buffer);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) bytes[o + i] = str.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + Lc.length * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, Lc.length * 4, true);
    for (let i = 0; i < Lc.length; i++) {
      dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, Lc[i] || 0)) * 32767, true);
      dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rc[i] || 0)) * 32767, true);
    }
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    wav = btoa(bin);
  }
  return {
    wav, echoSets, steps,
    ms, nan, peak: +peak.toFixed(3), clipPct: +((clip / Lc.length) * 100).toFixed(2), events: ev, marks, stats: C.stats,
    // Kompressoren ser litt fram og forsinker alt noen millisekunder: anslaget på låtstarten (0,05 s) er målestokken
    onset0: onset(0.05), onset1: onset(T1), onset2: onset(T2),
    // Broen til frost: kvintakkord på F# (dominanten i H-moll) uten bass, og bassen går F#, G#, A, A# opp mot H
    bridge1: { chord: near(chords, T1 - 4 * sd1).map((c) => [c[1], c[3]]), bass: basses.filter((b) => b[0] >= T1 - 4 * sd1 - 0.001 && b[0] < T1 - 0.001).map((b) => b[1]), down: near(chords, T1).map((c) => c[1]) },
    down2: near(chords, T2).map((c) => c[1]),
    pads: { before: pads.filter((t) => t < T2).length, boss: pads.filter((t) => t >= T2).length },
    lick: cueEv ? leads.filter((l) => l[0] >= cueEv.t - 0.001 && l[0] < cueEv.t + 1.2).map((l) => l[1]) : [],
    rms: { level2: +seg(lv2.t + 0.2, lv0.t).toFixed(4), level0: +seg(lv0.t + 0.8, shredIn.t).toFixed(4), shred: +seg(shredIn.t + 0.5, shredIn.t + 3).toFixed(4), boss: +seg(T2 + 0.5, T2 + 2.5).toFixed(4), ending: +seg(T2 + 3, T2 + 5.8).toFixed(4) },
  };
}, !!out);
if (out && off.wav) {
  fs.writeFileSync(`${out}/imuse-offline.wav`, Buffer.from(off.wav, 'base64'));
  console.log('wrote', `${out}/imuse-offline.wav`, '(stage, frost at 3.25 s, METAL MODE, boss at about 16.2 s, ending and victory)');
}
console.log('rms', JSON.stringify(off.rms));
console.log('offline render', off.ms, 'ms, peak', off.peak, 'clip%', off.clipPct, 'nan', off.nan, 'stats', JSON.stringify(off.stats));
console.log('events', off.events.map((e) => `${e.kind}:${e.song}:${e.step}${e.info !== undefined ? ':' + e.info : ''}@${e.t}`).join(' '));
const E1 = off.events;
const sw1 = E1.find((e) => e.kind === 'switch' && e.info === 'stage>frost');
check('offline: queued change waits for the bar line', !!sw1 && sw1.step % 16 === 0 && off.marks.p1.at % 16 === 0 && off.marks.p1.at - off.marks.p1.step >= 4 && Math.abs(sw1.t - off.marks.p1.T) < 1e-4, JSON.stringify({ queuedAt: off.marks.p1.step, at: off.marks.p1.at, switchStep: sw1?.step }));
const br1 = E1.find((e) => e.kind === 'bridge' && e.info === 'frost');
check('offline: the bridge is the last beat before the change', !!br1 && br1.step === off.marks.p1.at - 4, JSON.stringify(br1));
check('offline: bridge holds a fifth on the dominant (F# for B minor) and the bass walks up', JSON.stringify(off.bridge1.chord) === '[[42,false]]' && JSON.stringify(off.bridge1.bass) === '[42,44,45,46]' && off.bridge1.down.includes(47), JSON.stringify(off.bridge1));
check('offline: kick, crash and chord land on beat 1 of the new track', Math.abs(off.onset1.dt - off.onset0.dt) <= 4 && off.onset1.jump > 1.5, JSON.stringify({ ...off.onset1, latency: off.onset0.dt }));
const lvUp = E1.find((e) => e.kind === 'level' && e.info === 2);
const lvDown = E1.find((e) => e.kind === 'level' && e.info === 0);
check('offline: layers go up on a beat and down on a bar line', !!lvUp && lvUp.step % 4 === 0 && !!lvDown && lvDown.step % 16 === 0, JSON.stringify({ up: lvUp?.step, down: lvDown?.step }));
check('offline: heat is louder than calm', off.rms.level2 > off.rms.level0 * 1.08, JSON.stringify(off.rms));
const cue1 = E1.find((e) => e.kind === 'cue');
const BH = [11, 1, 2, 4, 6, 7, 10];
check('offline: stinger lands on the next beat, in the key (B harmonic minor)', !!cue1 && cue1.step % 4 === 0 && cue1.t - off.marks.cue < 0.12 + 60 / 184 && off.lick.length >= 8 && off.lick.every((m) => BH.includes(((m % 12) + 12) % 12)), JSON.stringify({ step: cue1?.step, notes: off.lick }));
const sIn = E1.find((e) => e.kind === 'shred-in'), sSolo = E1.find((e) => e.kind === 'solo'), sOut = E1.find((e) => e.kind === 'shred-out');
check('offline: METAL MODE in on a beat, solo on the bar line, out on a bar line', !!sIn && sIn.step % 4 === 0 && !!sSolo && sSolo.step % 16 === 0 && sSolo.t >= sIn.t && sSolo.t - sIn.t < 16 * (60 / 184 / 4) + 1e-3 && !!sOut && sOut.step % 16 === 0, JSON.stringify({ in: sIn?.step, solo: sSolo?.step, out: sOut?.step }));
const sw2 = E1.find((e) => e.kind === 'switch' && e.info === 'frost>duel');
check('offline: boss change on a bar line at least 1.4 s ahead', !!sw2 && sw2.step % 16 === 0 && off.marks.p2.T - off.marks.p2.now >= 1.4 && Math.abs(sw2.t - off.marks.p2.T) < 1e-4, JSON.stringify({ lead: +(off.marks.p2.T - off.marks.p2.now).toFixed(3), step: sw2?.step }));
const lv3 = E1.find((e) => e.kind === 'level' && e.info === 3);
check('offline: boss downbeat on E with intensity 3 at the same moment', !!lv3 && lv3.song === 'duel' && lv3.step === 0 && off.down2.includes(40) && Math.abs(off.onset2.dt - off.onset0.dt) <= 4 && off.onset2.jump > 1.3, JSON.stringify({ lv3, down: off.down2, onset: off.onset2 }));
check('offline: the boss layer (choir and timpani) only plays at intensity 3', off.pads.before === 0 && off.pads.boss >= 2, JSON.stringify(off.pads));
const endEv = E1.find((e) => e.kind === 'ending-done'), vict = E1.find((e) => e.kind === 'start' && e.info === 'victory');
check('offline: ending, then the victory track', !!endEv && !!vict, JSON.stringify({ endEv, vict }));
check('offline: echo delay is only set when the tempo changes', off.echoSets < 60 && off.steps > 200, JSON.stringify({ echoSets: off.echoSets, steps: off.steps }));
check('offline: no NaN, no clipping', off.nan === 0 && off.peak < 1 && off.clipPct < 0.5, JSON.stringify({ nan: off.nan, peak: off.peak, clip: off.clipPct }));

// Svulmen alene: toppen skal ligge på T, både med VCSL-opptaket og med den syntetiske baklengse crashen
const swell = await page.evaluate(async () => {
  const L = window.__lib;
  const one = async (sample) => {
    const sr = 44100, T = 1.6;
    const ctx = new OfflineAudioContext(1, sr * 3, sr);
    const band = new L.MetalBand(ctx, ctx.destination);
    const bank = L.audio.bank;
    if (sample) {
      if (!bank.hasFile('ins_bekken_1')) return null;
      band.swellSample = () => ({ buf: bank.buffer('ins_bekken_1'), lead: bank.leadIn('ins_bekken_1') });
    }
    const stop = band.swell(T, 0);
    if (!stop) return { skipped: true };
    // Lydstyrken i vinduer på 20 ms: når svulmen når fram (første vindu innenfor 1,5 dB av det sterkeste), og at den
    // faller etter første slag. Den syntetiske svulmen er tilfeldig støy, så energien er snittet av fire
    // renderinger (én måling alene spriker fra -24 til -49 ms).
    const w = Math.floor(sr * 0.02);
    let en = null;
    for (let k = 0; k < (sample ? 1 : 4); k++) {
      let d;
      if (k === 0) d = (await ctx.startRendering()).getChannelData(0);
      else {
        const c2 = new OfflineAudioContext(1, sr * 3, sr);
        const b2 = new L.MetalBand(c2, c2.destination);
        b2.swell(T, 0);
        d = (await c2.startRendering()).getChannelData(0);
      }
      const e = [];
      for (let i = 0; i + w < d.length; i += Math.floor(w / 4)) {
        let s = 0;
        for (let j = i; j < i + w; j++) s += d[j] * d[j];
        e.push([(i + w / 2) / sr, s]);
      }
      en = en ? en.map((x, i) => [x[0], x[1] + e[i][1]]) : e;
    }
    const top = Math.max(...en.map((x) => x[1]));
    const arrive = en.find((x) => x[1] >= top * 0.708)[0];
    const peakT = en.find((x) => x[1] === top)[0];
    const at = (t) => en.reduce((a, x) => (Math.abs(x[0] - t) < Math.abs(a[0] - t) ? x : a))[1];
    return { dt: +((arrive - T) * 1000).toFixed(1), peakDt: +((peakT - T) * 1000).toFixed(1), fallDb: +(10 * Math.log10(at(T + 0.25) / top)).toFixed(1) };
  };
  return { synth: await one(false), sample: await one(true) };
});
// Den syntetiske svulmen: selve toppen i snittet av fire renderinger skal ligge på første slag. (Første vindu innenfor
// 1,5 dB av toppen, som opptaket under måles med, ligger 35 til 45 ms før på en eksponentiell stigning.)
check('swell (synth reverse crash) peaks on beat 1', !!swell.synth && Math.abs(swell.synth.peakDt) <= 25 && swell.synth.fallDb < -6, JSON.stringify(swell.synth));
// Innenfor 1,5 dB av toppen i vinduer på 20 ms: opptaket vokser og ligger nesten flatt etter toppen
if (swell.sample) check('swell (VCSL cymbal) peaks on beat 1', Math.abs(swell.sample.dt) <= 45 && swell.sample.fallDb < -3, JSON.stringify(swell.sample));

// ---------------------------------------------------------------- del 2: i spillet, med den ekte lydklokka
const run = (sec) => page.evaluate((sec) => { const g = window.__game; for (let i = 0; i < Math.round(sec * 60); i++) g.tick(1 / 60, false); }, sec);
const clear = () => page.evaluate(() => { window.__lib.audio.conductor.events.length = 0; });
/** Vent (i sanntid) til dirigenten har en hendelse som passer, og gi den tilbake. */
const waitEvent = async (kind, info, ms = 4000) => {
  for (let i = 0; i < ms / 50; i++) {
    const e = await page.evaluate(([kind, info]) => window.__lib.audio.conductor.events.find((x) => x.kind === kind && (info === null || x.info === info)) ?? null, [kind, info]);
    if (e) return e;
    await page.waitForTimeout(50);
  }
  return null;
};
const cs = () => page.evaluate(() => {
  const a = window.__lib.audio, c = a.conductor;
  return { song: c.song?.name ?? null, level: c.level, target: c.levelTarget, shred: c.shred, solo: c.solo, key: c.key(), now: a.ctx.currentTime, ending: !!c.ending };
});
await page.evaluate(() => {
  const g = window.__game;
  g.save.heroMade = [true, true]; g.twoP = false; g.input.solo = true;
  g.playLevel({ id: 'road', name: 'road', kind: 'level', level: 'road', biome: 'grass', pos: [0, 0], requires: [], blurb: '' });
});
let e = await waitEvent('cue', 'chord', 2000);
check('game: level start chord lands on beat 1', !!e && e.step === 0 && e.song === 'stage', JSON.stringify(e));
await run(0.3);
e = await waitEvent('level', 0, 3000);
check('game: calm before the first wave (level 0 on a bar line)', !!e && e.step % 16 === 0, JSON.stringify(e));

// Første bølge: kamp
await clear();
await page.evaluate(() => { const st = window.__game.scene.stage; st.heroes[0].f.hp = 9999; st.heroes[0].f.pos.x = st.level.waves[0].at + 1.5; });
for (let i = 0; i < 30; i++) {
  await run(0.2);
  if (await page.evaluate(() => !!window.__game.scene.stage.wave)) break;
}
e = await waitEvent('level', 1, 3000);
check('game: combat layer comes in on a beat when the wave starts', !!e && e.step % 4 === 0, JSON.stringify(e));

// Hete: seks fiender på skjermen
await clear();
await page.evaluate(() => {
  const st = window.__game.scene.stage, h = st.heroes[0];
  for (let i = 0; i < 6; i++) { const f = st.spawnFoe('skeleton', 'R'); if (f) { f.f.pos.x = h.f.pos.x + 2 + i * 0.6; f.f.hp = f.f.maxHp = 999; } }
});
await run(0.2);
e = await waitEvent('level', 2, 3000);
check('game: heat layer (many enemies) comes in on a beat', !!e && e.step % 4 === 0, JSON.stringify(e));

// Bølgen ryddet: innslag på slaget, og så rolig på en taktstrek
await clear();
await page.evaluate(() => {
  const st = window.__game.scene.stage, h = st.heroes[0];
  st.queue = [];
  for (const f of st.foes) if (f.f.alive) { f.f.hp = 1; f.f.die('normal', 1, h.f); }
});
for (let i = 0; i < 20; i++) {
  await run(0.1);
  if (await page.evaluate(() => !window.__game.scene.stage.wave)) break;
}
e = await waitEvent('cue', 'clear', 2000);
check('game: wave cleared stinger lands on a beat', !!e && e.step % 4 === 0, JSON.stringify(e));
await run(3.0);
e = await waitEvent('level', 0, 3500);
check('game: back to calm on a bar line after a quiet spell', !!e && e.step % 16 === 0, JSON.stringify(e));

// METAL MODE: musikken i takt, spillet på spilltid
await clear();
await page.evaluate(() => { window.__game.scene.stage.metal.meter = 1; });
await run(1 / 60);
const sIn2 = await waitEvent('shred-in', null, 2000);
const sSolo2 = await waitEvent('solo', null, 3000);
check('game: METAL MODE enters on a beat and the solo starts on the bar line', !!sIn2 && sIn2.step % 4 === 0 && !!sSolo2 && sSolo2.step % 16 === 0 && sSolo2.t >= sIn2.t, JSON.stringify({ in: sIn2?.step, solo: sSolo2?.step }));
const left0 = await page.evaluate(() => window.__game.scene.stage.metal.left);
await page.waitForTimeout(800);
const left1 = await page.evaluate(() => window.__game.scene.stage.metal.left);
await run(1.0);
const left2 = await page.evaluate(() => window.__game.scene.stage.metal.left);
check('game: METAL MODE runs on game time (not the music clock)', left0 === left1 && Math.abs(left1 - left2 - 1) < 0.02, JSON.stringify({ left0, left1, left2 }));
await run(11.2);
e = await waitEvent('shred-out', null, 3500);
check('game: METAL MODE leaves on a bar line', !!e && e.step % 16 === 0, JSON.stringify(e));

// Sjefen: byttet på en taktstrek minst 1,4 sekunder fram, gong og stor akkord på første slag, intensitet 3
await clear();
const gong0 = await page.evaluate(() => window.__lib.audio.bank.played.ins_gong ?? 0);
await page.evaluate(() => {
  const st = window.__game.scene.stage, h = st.heroes[0];
  for (const f of st.foes) if (f.f.alive) f.f.die('normal', 1, h.f);
  st.queue = []; st.wave = null; st.waveIdx = st.level.waves.length; st.lockX = null;
  st.camX = st.bossLock; h.f.pos.x = st.bossLock;
});
await run(0.1);
const plan = await waitEvent('plan', null, 1000);
const pend = await page.evaluate(() => { const p = window.__lib.audio.conductor.pending; return p ? { at: p.at, T: p.T, boss: p.boss, to: p.to.name } : null; });
check('game: boss change waits for a bar line at least 1.4 s ahead', !!plan && !!pend && pend.boss && pend.at % 16 === 0 && pend.T - plan.t >= 1.4, JSON.stringify({ pend, planned: plan?.t }));
const sw3 = await waitEvent('switch', 'stage>duel', 4500);
const lv3b = await waitEvent('level', 3, 500);
await page.waitForTimeout(300);
const gong1 = await page.evaluate(() => window.__lib.audio.bank.played.ins_gong ?? 0);
check('game: boss theme starts on the bar line with gong and intensity 3', !!sw3 && sw3.step % 16 === 0 && !!lv3b && lv3b.step === 0 && Math.abs(sw3.t - pend.T) < 1e-3 && (!hasCymbal || gong1 > gong0), JSON.stringify({ sw3, lv3b, gongs: gong1 - gong0 }));

// Sjefen dør: avslutning fra neste slag, så seiersmusikken
await clear();
await page.evaluate(() => { const st = window.__game.scene.stage, b = st.boss; if (b) { b.f.hp = 1; b.f.die('explode', 1, st.heroes[0].f); } });
await run(0.1);
const endE = await waitEvent('end', null, 1000);
const vic = await waitEvent('start', 'victory', 5000);
check('game: boss death plays a short ending, then the victory track', !!endE && !!vic && (await cs()).song === 'victory', JSON.stringify({ endE, vic }));

// Game over: kort uttoning og tapslyd
await page.evaluate(() => { window.__lib.audio.bank.played = {}; window.__game.gameOver(() => {}, 'TEST'); });
await page.waitForTimeout(700);
const go = await page.evaluate(() => ({ song: window.__lib.audio.conductor.song?.name ?? null, fade: window.__lib.audio.fadeG.gain.value, played: window.__lib.audio.bank.played }));
check('game: game over fades the music and plays the losing sting', go.song === null && go.fade < 0.05 && (!hasCymbal || go.played.ins_bekken > 0), JSON.stringify(go));

// Duellen fra menymusikken: bytte på taktstreken, FIGHT! og KO på slaget
await clear();
await page.evaluate(() => {
  const g = window.__game;
  window.__lib.audio.play('title');
  g.goDuel({ a: g.heroSide(0, false), b: { cid: 'gorthak', name: 'GORTHAK', human: false, hp: 60, speed: 2.6, dmg: 1, skill: 0, aggression: 0 }, roundsToWin: 2, arena: 'pit' }, () => {});
});
await run(0.1);
const sw4 = await waitEvent('switch', 'title>duel', 4500);
// Nivået leses etter byttet: rett etter game over står det fortsatt og stiger på lydklokka (sanntid)
const fade = await page.evaluate(() => window.__lib.audio.fadeG.gain.value);
check('game: duel music bridges in from the menu on a bar line', !!sw4 && sw4.step % 16 === 0 && fade > 0.5, JSON.stringify({ sw4, fade }));
for (let i = 0; i < 40; i++) {
  await run(0.1);
  if (await page.evaluate(() => window.__game.scene.duel?.phase === 'fight')) break;
}
e = await waitEvent('cue', 'fight', 2000);
check('game: FIGHT! lands on a beat', !!e && e.step % 4 === 0, JSON.stringify(e));
await page.evaluate(() => { const d = window.__game.scene.duel; d.fb.hp = 1; d.ko(d.fb, false); });
e = await waitEvent('cue', 'ko', 2000);
check('game: KO lands on a beat', !!e && e.step % 4 === 0, JSON.stringify(e));

// Frost i H-moll: tonearten følger låta, og 8-bit-stilen bytter også på taktstreken
await page.evaluate(() => window.__lib.audio.play('frost'));
check('game: frost is in B (the stingers follow the key)', (await cs()).key === 47, JSON.stringify(await cs()));
await clear();
await page.evaluate(() => { window.__lib.setSettings({ musicStyle: 'chip' }); window.__lib.audio.queue('duel'); window.__lib.audio.levelUp(); });
const sw5 = await waitEvent('switch', null, 4500);
const lu = await waitEvent('cue', 'levelup', 2000);
check('game: 8-bit style also switches on a bar line, with the level up on a beat', !!sw5 && sw5.step % 16 === 0 && !!lu && lu.step % 4 === 0, JSON.stringify({ sw5, lu }));
await page.evaluate(() => window.__lib.setSettings({ musicStyle: 'metal' }));
await page.waitForTimeout(300);

const real = logs.filter((l) => (l.startsWith('pageerror') || l.startsWith('error')) && !l.includes('ERR_CERT_AUTHORITY_INVALID'));
check('nothing throws', real.length === 0, real.slice(0, 5).join(' | '));
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join('; ')}` : '\nALL OK');
console.log('LOGS:\n' + logs.join('\n'));
await browser.close();
process.exit(fails.length ? 1 : 0);
