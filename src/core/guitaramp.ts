/**
 * Forsterkermodell for de ekte gitarene (opptak tatt opp direkte, uten forsterker), bygd som et gitaroppsett fra
 * 80-tallet: en Tube Screamer foran (strammer bunnen og løfter midten), to rørtrinn med forvrengning og en
 * koblingskondensator imellom, tonestakk, effekttrinn med dunk og nærvær, og et 4x12-kabinett med en mikrofon foran.
 *
 * Kabinettet er det som får en forvrengt gitar til å låte ekte: høyttaleren kutter bratt over 5 kHz og har topper og
 * søkk i mellomtonen. Uten det låter forvrengning som en synth. Kabinettet er en impulsrespons som regnes ut her
 * (minimumsfase fra en frekvenskurve med små uregelmessigheter som i en ekte høyttaler), så den trenger ingen fil.
 */

/** Innstillingene på forsterkeren. dB-verdiene er EQ-er (0 = rett). */
export interface AmpVoice {
  /** Høypass før forvrengningen (Hz): strammer bunnen så palm mute ikke blir grøt. */
  tight: number;
  /** Midtløft foran forvrengningen (dB ved 800 Hz), som en Tube Screamer. */
  boost: number;
  /** Forvrengning i første og andre rørtrinn. */
  gain1: number;
  gain2: number;
  /** Koblingen mellom trinnene (høypass, Hz). */
  couple: number;
  /** Tonestakken (dB): bass ved 120 Hz, midt ved 550 Hz, diskant fra 2,5 kHz. */
  bass: number;
  mid: number;
  treble: number;
  /** Effekttrinnet (dB): dunk ved 100 Hz og nærvær ved 3,2 kHz. */
  resonance: number;
  presence: number;
  /** Nivået ut. */
  level: number;
}

/** Et trinn med forvrengning: tanh med litt skjevhet (bias) gir også like overtoner, som et rør. */
function stageCurve(k: number, bias: number, n = 4096) {
  const c = new Float32Array(n);
  const b = Math.tanh(bias);
  const s = Math.max(Math.abs(Math.tanh(k + bias) - b), Math.abs(Math.tanh(-k + bias) - b));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = (Math.tanh(k * x + bias) - b) / s;
  }
  return c;
}

// ---------------------------------------------------------------- kabinettet
/**
 * Kurven til kabinettet (Hz, dB), rett linje mellom punktene i log-frekvens: 4x12 med Celestion Vintage 30 og en SM57
 * foran, etter databladet til høyttaleren pluss nærværet i mikrofonen. Dunk ved 118 Hz, litt søkk rundt 420 Hz, topper
 * ved 2,5 og 4 kHz, og fall fra 5,5 kHz (-12 dB ved 8 kHz, -21 ved 10 kHz), så nesten ingenting over 12 kHz.
 */
const CAB: readonly (readonly [number, number])[] = [
  [20, -40], [50, -18], [75, -6], [100, 0], [118, 1.5], [150, 0], [250, -1], [420, -3.5], [700, -1.5], [1100, 0],
  [1700, 1.5], [2500, 5], [3200, 2.5], [4000, 4], [4700, 3], [5400, 1], [6500, -4], [8000, -12], [10000, -21],
  [12000, -29], [16000, -42], [24000, -58],
];

function curveDb(f: number) {
  if (f <= CAB[0][0]) return CAB[0][1];
  for (let i = 1; i < CAB.length; i++) {
    const [f1, d1] = CAB[i];
    if (f <= f1) {
      const [f0, d0] = CAB[i - 1];
      return d0 + ((d1 - d0) * Math.log(f / f0)) / Math.log(f1 / f0);
    }
  }
  return CAB[CAB.length - 1][1];
}

/** Små topper og søkk (opptil 2,5 dB) i mellomtonen, som i en ekte høyttaler og mikrofon. Fast frø, så lyden er lik hver gang. */
function rippleDb(f: number) {
  if (f < 500 || f > 7000) return 0;
  const oct = Math.log2(f / 500) * 12;
  const i = Math.floor(oct);
  const fr = oct - i;
  const r = (j: number) => {
    let h = (j + 1) * 374761393;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;
  };
  const v = r(i) + (r(i + 1) - r(i)) * (0.5 - 0.5 * Math.cos(Math.PI * fr));
  const w = f < 800 ? (f - 500) / 300 : f > 5500 ? (7000 - f) / 1500 : 1;
  return 2.5 * v * w;
}

/** FFT på plass (radix 2). inv = invers (uten skalering). */
function fft(re: Float64Array, im: Float64Array, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inv ? 2 : -2) * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const vr = re[b] * wr - im[b] * wi, vi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
      }
  }
}

const cabs = new WeakMap<BaseAudioContext, AudioBuffer>();

/**
 * Impulsresponsen til kabinettet for lydkonteksten (regnes ut første gang): minimumsfase fra kurven via cepstrum,
 * 2048 punkter (omtrent 45 ms) med myk hale, 0 dB ved 1,1 kHz.
 */
export function cabinetIR(ctx: BaseAudioContext): AudioBuffer {
  const hit = cabs.get(ctx);
  if (hit) return hit;
  const sr = ctx.sampleRate, N = 8192, M = 2048;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let k = 0; k <= N / 2; k++) {
    const f = Math.max(1, (k * sr) / N);
    re[k] = ((curveDb(f) + rippleDb(f)) / 20) * Math.LN10;
    if (k > 0 && k < N / 2) re[N - k] = re[k];
  }
  // Reelt cepstrum, brettet til minimumsfase, og tilbake
  fft(re, im, true);
  for (let i = 0; i < N; i++) {
    re[i] /= N;
    im[i] = 0;
  }
  for (let i = 1; i < N / 2; i++) re[i] *= 2;
  for (let i = N / 2 + 1; i < N; i++) re[i] = 0;
  fft(re, im);
  for (let k = 0; k < N; k++) {
    const m = Math.exp(re[k]);
    re[k] = m * Math.cos(im[k]);
    im[k] = m * Math.sin(im[k]);
  }
  fft(re, im, true);
  const buf = ctx.createBuffer(1, M, sr);
  const d = buf.getChannelData(0);
  const fade = M / 4;
  for (let i = 0; i < M; i++) d[i] = (re[i] / N) * (i < M - fade ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (i - (M - fade))) / fade));
  cabs.set(ctx, buf);
  return buf;
}

// ---------------------------------------------------------------- forsterkeren
/** Bygg forsterkeren: inn, Tube Screamer, rørtrinn 1, kobling, rørtrinn 2, tonestakk, effekttrinn, kabinett, ut. */
export function guitarAmp(ctx: BaseAudioContext, v: AmpVoice) {
  const c = ctx;
  const input = c.createGain();
  const biq = (type: BiquadFilterType, hz: number, q: number, db = 0) => {
    const b = c.createBiquadFilter();
    b.type = type;
    b.frequency.value = hz;
    b.Q.value = q;
    b.gain.value = db;
    return b;
  };
  const shaper = (k: number, bias: number) => {
    const s = c.createWaveShaper();
    s.curve = stageCurve(k, bias);
    s.oversample = '4x';
    return s;
  };
  const cab = c.createConvolver();
  cab.normalize = false;
  cab.buffer = cabinetIR(c);
  const out = c.createGain();
  out.gain.value = v.level;
  input
    .connect(biq('highpass', v.tight, 0.5))
    .connect(biq('peaking', 800, 0.7, v.boost))
    .connect(biq('lowpass', 8000, 0.707))
    .connect(shaper(v.gain1, 0.3))
    .connect(biq('highpass', v.couple, 0.5))
    .connect(shaper(v.gain2, 0.1))
    .connect(biq('lowpass', 10000, 0.707))
    .connect(biq('lowshelf', 120, 0.7, v.bass))
    .connect(biq('peaking', 550, 0.8, v.mid))
    .connect(biq('highshelf', 2500, 0.7, v.treble))
    .connect(biq('peaking', 100, 1, v.resonance))
    .connect(biq('peaking', 3200, 0.9, v.presence))
    .connect(cab)
    .connect(out);
  return { input, out };
}
