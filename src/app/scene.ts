// Felles grensesnitt for scener (tittel, heltebygger, kart, brett, duell).
import type { Grade } from '../gfx/post';

export interface Scene {
  name: string;
  /** Egen fargegradering (ellers brukes miljøets, se gfx/env/grades.ts). */
  grade?: Partial<Grade>;
  /** Kan pauses med P/Esc. */
  pausable?: boolean;
  update(dt: number, realDt: number): void;
  exit?(): void;
}
