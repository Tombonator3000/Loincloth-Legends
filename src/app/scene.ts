// Felles grensesnitt for scener (tittel, heltebygger, kart, brett, duell).
export interface Scene {
  name: string;
  /** Kan pauses med P/Esc. */
  pausable?: boolean;
  update(dt: number, realDt: number): void;
  exit?(): void;
}
