// Angre og gjør om i brettverkstedet: øyeblikksbilder av brettfila (som useUndoRedo i Toms connect-play), høyst 60.
import type { LevelLayout } from '../data/layout';

export class History {
  private past: string[] = [];
  private future: string[] = [];
  constructor(private limit = 60) {}

  /** Lagre tilstanden før en endring. Samme tilstand to ganger på rad lagres bare én gang. */
  push(l: LevelLayout) {
    const s = JSON.stringify(l);
    if (this.past[this.past.length - 1] === s) return;
    this.past.push(s);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }

  undo(current: LevelLayout): LevelLayout | null {
    const s = this.past.pop();
    if (!s) return null;
    this.future.push(JSON.stringify(current));
    return JSON.parse(s) as LevelLayout;
  }

  redo(current: LevelLayout): LevelLayout | null {
    const s = this.future.pop();
    if (!s) return null;
    this.past.push(JSON.stringify(current));
    return JSON.parse(s) as LevelLayout;
  }

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  clear() {
    this.past.length = 0;
    this.future.length = 0;
  }
}
