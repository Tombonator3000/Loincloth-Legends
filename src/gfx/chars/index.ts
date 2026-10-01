// Figurregister. Alle figurer (også heltebyggerens) slås opp her via id.
import type { CharDef, CharId } from './types';
import { CLASSIC } from './classic';
import { WILDS } from './wilds';
import { BOSSES } from './bosses';
import { RAIDERS } from './raiders';
import { CRITTERS } from './critters';

export * from './types';

export const CHARS: Record<CharId, CharDef> = {};
for (const d of [...CLASSIC, ...WILDS, ...BOSSES, ...RAIDERS, ...CRITTERS]) CHARS[d.id] = d;

export function registerChar(def: CharDef) {
  CHARS[def.id] = def;
  return def.id;
}

export function getChar(id: CharId): CharDef {
  const d = CHARS[id];
  if (!d) throw new Error('Ukjent figur: ' + id);
  return d;
}
