# Skills for AI-agentene

En skill er en mappe med instrukser som en AI-agent laster når oppgaven passer: `SKILL.md` med navn og en beskrivelse av når den skal brukes øverst, og så fremgangsmåten. Claude Code finner skillene i `.claude/skills/` av seg selv. GPT og Codex kan lese `SKILL.md` direkte, eller få mappa kopiert til `.agents/skills/` eller `~/.codex/skills/`. `agents/openai.yaml` i hver mappe er navnet og startprompten Codex viser.

## Våre skills (i repoet)
| Skill | Når den brukes |
|---|---|
| `stage-forge` | Endre brett og kulisser, med editoren eller rett i brettfila: lag, rader, generatorer, animasjoner og sjekkene etterpå |
| `prop-art` | Bestille kulisser og bildeserier fra ChatGPT og ta dem inn med `tools/process_art.py` |
| `new-level` | Nytt brett fra data og kart til kulisser og test |
| `game-tests` | Kjøre og skrive Playwright-testene, og fellene i SwiftShader som gjør testene trege eller falske |

## Andre skills som passer (ikke i repoet)
- **Toms egne** i SIGNAL-47 (`Automation/Skills/`): `game-production` (fra idé til testede leveranser, kunstflyt og gjennomgang av grafikk), `gauntlet-loop` (Universal Gauntlet: det som virker sammenlignes med det som var tenkt, og alt verifiseres), `brainstorming` (tilpasset fra obra/superpowers, MIT) og `blender-mcp` (bare hvis vi begynner å lage modeller i Blender). Kopier mappa til `~/.claude/skills/` eller `~/.codex/skills/`.
- **Three.js Awesome Graphics Agent Skills** (Scott Sun, MIT, github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills): 24 skills for god grafikk i Three.js. Aktuelle for oss er `threejs-visual-validation` (faste frø, bilde uten etterbehandling, nær og fjern, samme tanke som `looks.mjs` og `ab.mjs`), `threejs-procedural-vfx` (gnister, rusk og HDR, til blod og ild), `threejs-procedural-vegetation` (gress og vind), `threejs-shadow-systems`, `threejs-bloom`, `threejs-exposure-color-grading`, `threejs-atmosphere-aerial-perspective` og `threejs-camera-direction`. Mye er skrevet for WebGPU og TSL, mens vi bruker WebGLRenderer og GLSL, så ta ideene og ikke koden. Installeres per bruker: `npx threejs-awesome-graphics-agent-skills@latest install --agent claude-code` (eller `--agent codex`).
- **dream-loop** (achimala, MIT): visuell iterasjon der et generert målbilde sammenlignes med skjermbilder fra spillet av en egen kritiker. Passer når vi skal nærme oss et konseptbilde (`docs/STYLE_TARGET.md`).
- **Scenario** (scenario-labs): skills for å lage grafikk gjennom Scenario, som er en betalt tjeneste. Vi bruker bare reglene for bildeserier derfra (se `prop-art`).
- **obra/superpowers** (MIT): skills for planlegging, systematisk feilsøking og testdrevet utvikling.
- **skill-creator** (Anthropic): lager og forbedrer skills. Nyttig når en ny arbeidsflyt går igjen.
- **Playwright** (utvidelse eller MCP-server for Claude Code): styrer en nettleser direkte. Testene våre bruker Playwright som bibliotek og trenger den ikke.

## Lage en ny skill
1. En mappe `.claude/skills/<navn>/` med `SKILL.md`. Øverst `name` og en `description` som sier hva den gjør og når den skal brukes. Det er beskrivelsen agenten leser når den velger.
2. Kort og konkret: filene, kommandoene og fellene. Lengre bakgrunn hører hjemme i `docs/`, og skillen viser dit.
3. Norsk, uten emoji og tankestrek, som resten av dokumentasjonen.
4. `agents/openai.yaml` med `display_name`, `short_description` og `default_prompt`.
5. Legg den i tabellen over og logg det i `log.md`.
