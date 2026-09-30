// Brettfilene fra brettverkstedet (STAGE FORGE): én fil per brett, <brett>.json. Formatet står i data/layout.ts.
// Editoren kan legge en fil som ikke er lagret ennå, oppå (PLAY FROM HERE), så testen viser det Tom ser.
import type { LevelLayout } from '../layout';

const files = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<string, LevelLayout>;

/** Brettfilene i repoet, etter brettets id. */
export const LAYOUTS: Record<string, LevelLayout> = {};
for (const [path, l] of Object.entries(files)) LAYOUTS[path.replace(/^\.\/(.*)\.json$/, '$1')] = l;

const unsaved: Record<string, LevelLayout> = {};

/** Brettfila for et brett: den editoren holder på med, ellers den i repoet, ellers null. */
export function layoutFor(id: string): LevelLayout | null {
  return unsaved[id] ?? LAYOUTS[id] ?? null;
}

/** Editoren: bruk denne fila for brettet til den lagres eller editoren lukkes (null fjerner den). */
export function setUnsavedLayout(id: string, l: LevelLayout | null) {
  if (l) unsaved[id] = l;
  else delete unsaved[id];
}

/** Editoren har lagret: fila i repoet er nå denne (uten ny innlasting av siden). */
export function setSavedLayout(id: string, l: LevelLayout) {
  LAYOUTS[id] = l;
  delete unsaved[id];
}
