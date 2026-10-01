# Skills for AI-agentene

En skill er en mappe med instrukser som en AI-agent laster når oppgaven passer: `SKILL.md` med navn og en beskrivelse av når den skal brukes øverst, og så fremgangsmåten. Claude Code finner skillene i `.claude/skills/` av seg selv. GPT og Codex kan lese `SKILL.md` direkte, eller få mappa kopiert til `.agents/skills/` eller `~/.codex/skills/`. `agents/openai.yaml` i hver mappe er navnet og startprompten Codex viser.

## Våre skills (i repoet)
| Skill | Når den brukes |
|---|---|
| `stage-forge` | Endre brett og kulisser, med editoren eller rett i brettfila: lag, rader, generatorer, animasjoner og sjekkene etterpå |
| `prop-art` | Bestille kulisser og bildeserier fra ChatGPT og ta dem inn med `tools/process_art.py` |
| `new-level` | Nytt brett fra data og kart til kulisser og test |
| `game-tests` | Kjøre og skrive Playwright-testene, og fellene i SwiftShader som gjør testene trege eller falske |

## Skills som lærer av øktene (autoharness)
autoharness (Tigerless Labs, MIT, github.com/tigerless-labs/autoharness) er et tillegg for Claude Code som lager skills av arbeidet vi gjør. Det er slått på for prosjektet i `.claude/settings.json` (markedsplassen `autoharness` og `enabledPlugins`), så Claude Code tilbyr det når repoet åpnes.
- **Slik virker det:** etter hvert 50. verktøykall i en økt starter tillegget en egen Claude-økt i bakgrunnen som leser et sladdet utdrag av økta og foreslår en ny skill, eller en endring i en det har laget før. Lignende skills slås sammen i stedet for å hope seg opp, og skills som aldri brukes, arkiveres etter hvert. `/learn` lager en skill av økta du er i med en gang.
- **Hvor det havner:** lærte skills for prosjektet i `.claude/skills/<navn>/`, med `.ledger.jsonl` (hvorfor den ble laget eller endret), `.sidecar.json` (hvor mye den brukes) og `references/evidence-*.md` (sladdede utdrag av økta). Tilstanden ligger i `.claude/autoharness/`, som står i `.gitignore`. Skills som gjelder alle prosjekter, havner i `~/.claude/skills/`, og i skymiljøet forsvinner de med containeren.
- **Bare sine egne:** tillegget endrer bare skills med `.ledger.jsonl`. Våre egne i tabellen over røres aldri.
- **Regler for oss:** commit lærte skills sammen med resten av arbeidet, ellers forsvinner de med containeren i skymiljøet. Se over dem først, også `references/`: repoet er offentlig. Ikke rediger en lært skill for hånd; slett den, eller si i økta hva som er feil, så retter neste runde den. Reflektoren skriver dem selv, så de kan komme på engelsk.
- **Krav og kostnad:** Python 3.11 eller nyere som `python3`, og `claude` på PATH. Hver runde i bakgrunnen er en egen Claude-økt og bruker av kvoten. Sjeldnere runder: sett `AUTOHARNESS_REFLECT_EVERY_N` høyere i `env` i `.claude/settings.json`. Slå av: `claude plugin disable autoharness@autoharness --scope project`.
- **Skymiljøet:** containeren er ny for hver økt. Legg disse to linjene i oppstartsskriptet til miljøet, så tillegget er installert fra start: `claude plugin marketplace add tigerless-labs/autoharness` og `claude plugin install autoharness@autoharness`.

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
