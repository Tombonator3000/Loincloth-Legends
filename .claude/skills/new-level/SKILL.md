---
name: new-level
description: Lag et nytt brett i Loincloth Legends fra bunnen av, eller bygg om et brett, med LevelDef i src/data/levels.ts, biom, bølger, farer, ryttere, finale, kartnode, brettfil i src/data/layouts, kulisser i STAGE FORGE og tester. Bruk når Tom vil ha et nytt brett, en ny del av kartet eller en ny arena å slåss i.
---

# Nytt brett

Innhold er data i dette repoet. Et nytt brett skal ikke trenge spesialtilfeller i motorkoden.

1. **Data.** Legg en `LevelDef` i `src/data/levels.ts` (oppskriften «Nytt brett» i `docs/ARCHITECTURE.md`): id, navn og undertittel på engelsk i 80-tallsstil, biom, lengde, musikk, bølger med `w(at, maxAlive, 'fiende:side:forsinkelse ...', { title, say })`, tønner, farer med `hz(kind, x, z, bredde, dybde)`, ryttere `[bølgeindeks, fiende, ridedyr]` og finale (sjef, duell eller `{ type: 'dawn' }`).
2. **Biom.** Bruk grass, swamp, frost, scorch, night eller tower, eller lag et nytt etter «Nytt biom». Nye pyntblokker pakkes i `gen(o, 'nøkkel')`, så de får faste frø og kan slås av i editoren.
3. **Kartet.** En node i `MAP_NODES` (oppskriften «Ny kartnode»).
4. **Brettfila.** Lag `src/data/layouts/<id>.json`:
   ```json
   {
     "version": 1,
     "level": "<id>",
     "props": [],
     "runs": []
   }
   ```
   Ingen registrering trengs. Åpne `?editor=<id>` under `npm run dev` og legg ut kulisser, eller følg skillen `stage-forge`.
5. **Rytmen.** Som de andre brettene: fire bølger der `maxAlive` stiger fra 4 til 6, fire eller fem tønner jevnt fordelt (chicken, potion, gold, ham), tre eller fire farer på annenhver side av veien, og en tittel og en replikk fra fortelleren (`say`) når en ny fiendetype kommer første gang. Planen for mer variert AI står i `docs/PLAN_BRETT_GORR_AI.md`.
6. **Grafikk.** Nye kulisser bestilles med skillen `prop-art`. Teksturer og himmel står i `docs/ART_PROMPTS.md`.
7. **Test.**
   - `node tools/tests/scenarios.mjs http://localhost:4173/ ./shots levels <id>` spiller brettet til finalen.
   - `node tools/tests/looks.mjs http://localhost:4173/ ./shots <id>` gir faste skjermbilder med tegnekall og trekanter.
   - `node tools/tests/editor.mjs http://localhost:4173/ ./shots` sjekker editoren.
   - Oppsettet står i skillen `game-tests`.
8. **Etterpå.** Logg i `log.md`, oppdater `todo.md` og `memory.md`, og beskriv brettet kort i `docs/GDD.md`.
