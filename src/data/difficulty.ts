// Vanskelighetsgrad (runde E, docs/PLAN_BRETT_GORR_AI.md 6.4 punkt 6): endrer reaksjonstid og aggresjon, aldri liv
// eller skade. Ingen Three.js her.
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultyDef {
  name: string;
  hint: string;
  /** Opptrekket før fiendene slår (ganges med startup): høyere er lettere å se og unngå. */
  wind: number;
  /** Tempoet på nedkjølingene mellom angrepene (høyere er oftere). */
  pace: number;
  /** Sjansen for at en fiende går til side for et prosjektil. */
  dodge: number;
  /** Endring i hvor mange fiender som får angrepsplass samtidig. */
  tokens: number;
  /** Hvor lenge sjefene tenker mellom trekkene (ganges med tenketiden). */
  think: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: { name: 'EASY', hint: 'THE MINIONS ARE HUNGOVER. SAME DAMAGE, SLOWER BRAINS.', wind: 1.25, pace: 0.75, dodge: 0.3, tokens: -1, think: 1.35 },
  normal: { name: 'NORMAL', hint: 'EVIL AT A MODERATE PACE.', wind: 1, pace: 1, dodge: 0.6, tokens: 0, think: 1 },
  hard: { name: 'HARD', hint: 'THEY SWING FIRST AND THINK LATER. SAME DAMAGE, FASTER BRAINS.', wind: 0.85, pace: 1.25, dodge: 0.85, tokens: 1, think: 0.75 },
};
