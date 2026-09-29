# public/assets

Legg bildene fra ChatGPT i `art/inbox/` og kjør `python3 tools/process_art.py`: da havner de ferdige filene her og `manifest.json` skrives av skriptet. Du kan også legge filer her og skrive manifestet selv (se `manifest.example.json`).
Finnes ikke `manifest.json`, bruker spillet grafikken som lages i kode.

Manifestet kan ha figurdeler (`parts`), flisbare teksturer for 3D-verdenen (`textures`), himmelbilder (`sky`) og verdenskartet (`map`).

Full liste med prompter, filnavn, teksturnavn og ankerpunkter: `docs/ART_PROMPTS.md`.

Lydene ligger i `sound/`: CC0-opptak fra Morbidium med `sound.json` og en kildeliste per fil i `sound/KILDER.md` (se `src/core/soundbank.ts`).
