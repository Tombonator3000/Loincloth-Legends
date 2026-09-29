// Ytelse: automatisk grafikkvalitet (QualityGovernor) og en liten ytelsesmåler bak ?perf (PerfMeter).
// Etter Morbidium (Toms eget spill, src/15_rom3d.js: maal og nedgrader) og The Deep Ones (v2/main.js: levert
// bildefrekvens, tegnetid og bildetid med p95 og p99).
import type { Quality } from '../gfx/post';

/** Bilder per sekund som er for lite på hvert nivå. To målinger på rad under grensen gir et trinn ned. */
const MIN_FPS: Record<Quality, number> = { ultra: 50, high: 40, medium: 30, low: 0 };
const NEXT: Record<Quality, Quality | null> = { ultra: 'high', high: 'medium', medium: 'low', low: null };

/**
 * Måler bildefrekvensen i spill, to sekunder om gangen, og sier fra når nivået bør ned. Forbedringer fra Morbidium:
 * målingen står stille i menyer og pause, hopper over bildet etter et fanebytte (Game sier fra) og bilder over fem
 * sekunder (dvale eller debugger), og venter noen sekunder etter et scenebytte eller en nedtrapping, så kompilering
 * av skyggeleggere og nye mål ikke teller. Et jevnt tregt bilde (et sekund per bilde) teller, det er et tregt
 * skjermkort og ikke et avbrudd.
 */
export class QualityGovernor {
  /** Sekunder per måling. */
  window = 2;
  /** Siste målte bildefrekvens (for måleren og testene). */
  lastFps = 0;
  /** Antall målinger på rad under grensen. */
  low = 0;
  private t = 0;
  private n = 0;
  private settle = 2;

  /** Etter scenebytte eller nytt nivå: vent litt før neste måling. */
  reset(settle = 2) {
    this.t = this.n = 0;
    this.settle = settle;
  }

  /**
   * raw er ekte tid siden forrige bilde i sekunder (ikke klemt). active sier om spillet er i gang (brett eller
   * duell, ikke pause eller meny). Returnerer nivået det bør gå ned til, eller null.
   */
  sample(raw: number, active: boolean, q: Quality): Quality | null {
    if (!active || raw > 5 || raw <= 0) {
      this.t = this.n = 0;
      return null;
    }
    if (this.settle > 0) {
      this.settle -= raw;
      return null;
    }
    this.t += raw;
    this.n++;
    if (this.t < this.window) return null;
    const fps = this.n / this.t;
    this.t = this.n = 0;
    this.lastFps = fps;
    this.low = fps < MIN_FPS[q] ? this.low + 1 : 0;
    if (this.low < 2) return null;
    this.low = 0;
    this.settle = 3;
    return NEXT[q];
  }
}

/** Ett trinn lettere enn q (LOW blir LOW). */
export function lighter(q: Quality): Quality {
  return NEXT[q] ?? 'low';
}

/** En liten måler i hjørnet: levert bildefrekvens, bildetid (snitt, p95, p99), CPU-tid, nivå og tegnekall. */
export class PerfMeter {
  readonly el: HTMLPreElement;
  private frames: number[] = [];
  private costs: number[] = [];
  private t = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement('pre');
    this.el.className = 'perf-meter';
    root.appendChild(this.el);
  }

  /** deltaMs er tiden siden forrige bilde, costMs CPU-tiden for oppdatering og tegning. */
  record(deltaMs: number, costMs: number) {
    this.frames.push(deltaMs);
    this.costs.push(costMs);
    if (this.frames.length > 240) {
      this.frames.shift();
      this.costs.shift();
    }
  }

  /** Skriv ut tallene høyst to ganger i sekundet. */
  show(dt: number, info: { quality: string; auto: string; calls: number; tris: number; fps: number }) {
    this.t -= dt;
    if (this.t > 0 || !this.frames.length) return;
    this.t = 0.5;
    const a = [...this.frames].sort((x, y) => x - y);
    const p = (q: number) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
    const avg = a.reduce((x, y) => x + y, 0) / a.length;
    const cost = this.costs.reduce((x, y) => x + y, 0) / this.costs.length;
    this.el.textContent =
      `FPS ${(1000 / Math.max(1e-3, avg)).toFixed(1)}\n` +
      `FRAME ${avg.toFixed(1)} MS  P95 ${p(0.95).toFixed(1)}  P99 ${p(0.99).toFixed(1)}\n` +
      `CPU ${cost.toFixed(2)} MS\n` +
      `GFX ${info.quality.toUpperCase()}${info.auto ? ' (' + info.auto + ')' : ''}\n` +
      `CALLS ${info.calls}  TRIS ${info.tris}` +
      (info.fps ? `\nAUTO FPS ${info.fps.toFixed(1)}` : '');
  }
}
