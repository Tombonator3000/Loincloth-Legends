# AGENTS.md

Instrukser for AI-agenter (Claude Code, Claude, Lovable, Copilot osv.) som jobber i dette repoet.
Repo: https://github.com/Tombonator3000/Loincloth-Legends. Spillet er fra Tom's Happy Happy Funtimes Emporium.

## Før du starter
1. Les `memory.md` (prosjektets hukommelse og viktige beslutninger).
2. Les `todo.md` (hva som gjenstår).
3. Les de siste oppføringene i `log.md`.
4. Design: `docs/GDD.md`. Arkitektur og oppskrifter: `docs/ARCHITECTURE.md`. Grafikk: `docs/ART_PROMPTS.md`. Målbildet for grafikken: `docs/STYLE_TARGET.md`. Brettverkstedet: `docs/STAGE_FORGE.md`.
5. Skills for vanlige oppgaver ligger i `.claude/skills/` (brett og kulisser, grafikk fra ChatGPT, nytt brett, testene). Oversikt i `docs/SKILLS.md`. Claude Code finner dem selv. Andre agenter leser `SKILL.md` i mappa som passer.
6. Claude Code har tillegget autoharness slått på for prosjektet (`.claude/settings.json`). Det lærer skills av øktene og legger dem i `.claude/skills/` (de med `.ledger.jsonl`). Commit dem etter at du har sett over dem; `.claude/autoharness/` er tilstand og skal ikke i git. Mer i `docs/SKILLS.md`.

## Mens du jobber
- Logg alt du gjør i `log.md` med tidsstempel (format: `## YYYY-MM-DD HH:MM (Europe/Oslo)`).
- Oppdater `todo.md` når noe blir ferdig eller nye oppgaver dukker opp.
- Oppdater `memory.md` når du tar en arkitekturbeslutning eller lærer noe viktig om prosjektet.
- Ingen emoji og ingen tankestrek (em dash) i dokumentasjon.
- Skriv dokumentasjon på norsk. Tekst i selve spillet er på engelsk (80-talls fantasy-stemning).

## Regler for koden
- Nytt innhold legges inn som data (`src/data/`) og registre (`CHARS`, `BEASTS`, `STAGE_BUILDERS`, `FOES`, `BOSSES`, `DUELISTS`, `LEVELS`, `HAZARDS`, `MOUNTS`, `PETS`, `SHOP`, `MAP_NODES`, `SPELLS`, `CLASSES`). Unngå spesialtilfeller i motorkoden.
- `src/data/` skal ikke importere Three.js.
- Figurgrafikk tegnes prosedyremessig i `src/gfx/chars/`. PNG-er kan erstatte delene via `public/assets/manifest.json`.
- Ikke legg inn opphavsrettsbeskyttede figurer, navn eller logoer. Alt skal være originalt.
- Lyd går gjennom `src/core/audio.ts`. Den kan være syntetisert i WebAudio, eller opptak og samplede instrumenter som er fri til bruk (CC0), som lydene fra Freesound og instrumentene fra Versilian Community Sample Library (VCSL) i Morbidium. Hver fil føres opp i en kildeliste med tittel, hvem som har spilt den inn og lenke. Den syntetiserte lyden er reserven når en fil ikke kan lastes (for eksempel i enkeltfil-bygget).
- Stemmer: replikkene lages med stemmedesign i VoiceStudio (en beskrivelse av stemmen), eller med Toms egen stemme. Aldri kloning av ekte personer uten skriftlig tillatelse. VoiceStudio er AGPL-3.0 og brukes bare som verktøy; ingen kode derfra inn i repoet. Manus og filnavn: `docs/STEMMER.md`.
- Gjenbruk går foran å skrive nytt (Tom): se etter ferdig kode i Toms egne repoer (særlig Morbidium) og i prosjektbiblioteket før du lager noe fra bunnen. Sjekk lisens og opphav, og krediter i README.
- Bruk spilltid (dt i update), ikke `setTimeout`, for ting som påvirker spillet (så pause og slowmo virker).
- Brett og kulisser er data: brettfilene i `src/data/layouts/`, kulissekatalogen i `src/gfx/props/catalog.ts`. Byggekoden for miljøet bruker `random()`, `rand()` og `pick()` fra `src/core/math.ts` (faste frø, så brettet ser likt ut hver gang), aldri `Math.random()`. Nye pyntblokker pakkes i `gen(o, 'nøkkel')`.
- Heltenes proporsjoner (heroiske: lange bein, brede skuldre, mindre hode enn chibi, enorme muskler, bittesmå lendeklær) ligger i `src/gfx/chars/types.ts` og `src/gfx/chars/muscle.ts`.
- Stil (Tom): ikke tegneserie. Seriøst og filmatisk, som 80-talls fantasyfilmer spilt helt rett, men morsomt og fullt av parodier. Humoren ligger i replikker, situasjoner, navn og parodier, ikke i tegneserieaktig grafikk. Alt som er 3D skal være så godt og så realistisk som mulig. Se `docs/STYLE_TARGET.md`.
- Figurstil (Tom): nesten ekte karikatur, etter Toms referansebilde av Valkyra (beskrevet i `docs/STYLE_TARGET.md`). PNG-deler fra ChatGPT etter `docs/ART_PROMPTS.md` er veien dit. De tegnede figurene i koden er reserven og skal ligne så godt det går.
- Kvinnene tegnes som på 80-talls fantasy-omslag, etter Toms ønske: ringbrynjebikini, pelsbikini og rustning med overdrevne former er greit. Alltid tydelig voksne, og aldri nakenhet.
- Studiologoen (`art/studio/`, `src/assets/studio-logo.webp`) tilhører Tom. Ikke endre den uten å bli bedt om det.

## Teknisk
- Stack: Vite + TypeScript (strict) + Three.js. Ingen UI-rammeverk, HUD er ren DOM.
- `npm run dev` for utvikling, `npm run build` for vanlig bygg, `npm run build:single` for én selvstendig HTML-fil.
- Kjør `npm run typecheck` før du committer.
- Tester: `tools/tests/` (Playwright, styrer spillet via `window.__game` og `window.__lib`). Oppstartslogoen hoppes over automatisk i tester (`navigator.webdriver`), og med `?nosplash`.
- Innstillinger (gore, lyd, rumble, berøring) ligger i `src/core/settings.ts`, lagres separat fra spillfremgangen.
