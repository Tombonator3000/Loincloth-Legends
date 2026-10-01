# Miljø, lyd og opprydding: overlevering til Claude

Arbeidsrunde 2026-10-01, med `5eded08` som utgangspunkt. Tom ba ChatGPT Work hjelpe Claude med partikler, atmosfære, lyd, etterbehandling, manglende grafikk og opprydding. Endringene bruker spillets eksisterende Three.js-, WebAudio- og manifestoppsett.

**Status:** implementert og statisk gjennomgått. Typekontroll, vanlig bygg, enkeltfilbygg, kunstkontroll, seks Python-tester og prosjektiltestene er bestått lokalt. Nettlesertester og før/etter-bilder venter på GitHub Actions. Operativsystemet i Work-økten avviste oppstart av lokal Chromium; denne runden er derfor ikke lokalt spilltestet eller visuelt godkjent i nettleseren.

## Det som er endret

| Område | Endring | Filer |
|---|---|---|
| Partikler | Pollen og ildfluer vandrer og pulserer; snø og aske får ujevn form og flagrende bevegelse; treff får en kort lyskjerne. Færre stemningspartikler på lave kvalitetsnivåer uten å velge bort samme kilde hver gang. | `src/gfx/vfx.ts` |
| Løv | Fast pool med gjenbrukte objekter og vektorer. Løv finnes allerede ved ankomst. Kamerahopp fyller nytt område, og full pool sparer ikke opp en senere partikkelbyge. Pause stopper simuleringen. | `src/gfx/env/leaffall.ts` |
| Dis og lysstråler | Tåka følger vindretningen, tones ut både øverst og nederst og får langsom intern bevegelse på HIGH/ULTRA. Lysstrålene smalner oppover og brytes svakt opp. Ingen nye lag med geometri. | `src/gfx/env/atmos.ts` |
| Fri sikt | De store genererte eikene som sto mellom kampen og kameraet, er flyttet bak kampbeltet på brett 1 og i nattleiren. Lave silhuetter og malte FRONT-kulisser står fortsatt foran. | `src/gfx/env/grass.ts`, `night.ts` |
| Jungelgrafikk | To nye 1024 x 1024 WebP-teksturer: fuktig skogbunn og slitt steinvei til Soltempelet. De bruker de eksisterende `ground_jungle`- og `road_jungle`-oppslagene. Manifest, promptliste og kunstkontroll er oppdatert. | `public/assets/tex_ground_jungle.webp`, `tex_road_jungle.webp`, `manifest.json`, `docs/ART_PROMPTS.md`, `tools/check_art_pack.py` |
| Lydmiljø | Stereo mellom miljølagene, avstandsstyrt volum og lavpass for bål/foss og dyrelyder, riktig filter når samme vindopptak følger med til neste biom. Musikk trekker seg tilbake mellom bølgene, og stemningen kommer fram. Pause demper miljøet og stopper dyrelydenes tidsstyring. | `src/core/ambience.ts`, `audio.ts` |
| Lydressurser | Ferdige syntlag og løkker kobler fra egne noder. Stemmer og brøl bruker riktig absolutt lydtid for musikkdemping. Pågående uttoning beholder sitt hørbare nivå når den avbrytes. Eksisterende opptak og syntreserver brukes videre. | `src/core/layers.ts`, `soundbank.ts`, `ambience.ts`, `audio.ts` |
| Etterbehandling | Pikselbudsjettet gjelder også på store skjermer med DPR under 1. Bloom normaliseres etter alle nivåene i kjeden. Mellommål, shaderressurser og teksturreferanser slippes ved ombygging eller avslutning. | `src/gfx/post.ts` |
| Skjermrotasjon | Rennende skjermdråper beholder gyldige spor når formatet endres. Posisjon, størrelse og fart skaleres med formatet. Kvalitetsmåleren nullstiller gamle lave målinger ved pause/scenebytte og avviser ugyldig bildetid. | `src/gfx/screenwet.ts`, `src/app/perf.ts` |
| Menyer og dueller | Et gammelt bildelastesvar åpner ikke en forlatt editor. Ferdig fullskjermforespørsel henter ikke tilbake en gammel meny. Forsyningsmelding, tittelhån og duellreplikker/posering følger spilltid. Duellkøen sjekker runde og disponering. | `src/app/game.ts`, `src/game/duel.ts` |
| Prosjektiler | `kill()` kan kalles flere ganger og slipper egen geometri nøyaktig én gang. Tunge og varselring slipper egne materialer; delte sprite-materialer beholdes. | `src/game/projectiles.ts` |
| Bildeimport | Ekte alfa bevares uansett hvor liten del av bildet som er gjennomsiktig. Alfa fra fjernede magentahjelpelinjer behandles separat, så ugjennomsiktige ark fortsatt får fjernet bakgrunnen. Små bilder leses innenfor sine grenser. | `tools/process_art.py` |

Kunstpakken har nå 254 bildefiler, opp fra 252. Jungelens nye kulissebilder, Zanthras egne deler og de nye fiendetypenes egne figurer er fortsatt åpne oppgaver. Ingen nye stemmeopptak er levert i denne runden.

De to teksturene er generert separat med imagegen og behandlet gjennom `process_art.py`. En 2 x 2-flisprøve er visuelt kontrollert. Opphav og oppsummerte bestillinger står i `art/prompts/jungle-surfaces-2026-10-01.json`; kontroll av teksturene inne i spillet gjenstår.

## Kontroller og faktisk status

| Kontroll | Dekning | Status ved overlevering |
|---|---|---|
| `npm run typecheck` | TypeScript | Bestått lokalt |
| `npm run build` | Produksjonsbygg | Bestått lokalt |
| `npm run build:single` | Enkeltfilbygg | Bestått lokalt |
| `python tools/check_art_pack.py` | Manifest og alle 254 bildefiler, inkludert begge jungelteksturene | Bestått lokalt |
| `python -m unittest discover -s tools/tests -p 'test_process_art.py'` | Seks regresjoner for alfa, hjelpelinjer, bakgrunn og små bilder | 6 av 6 bestått lokalt |
| `node tools/tests/projectile-resources.mjs` | Ekte Three-ressurser uten WebGL: delt materiale, egne geometrier, levetid og gjentatt rydding | Tre kontrollgrupper bestått lokalt |
| `post-quality.mjs` | 4K-budsjett, bloom på tvers av kvalitet, shaderopprydding, dråper ved rotasjon og kvalitetsmåler | Venter på nettleserkjøring i Actions |
| `audio-depth.mjs` | WebAudio, opptak/syntreserve, biombytte, avstand, pause, ro/kamp og frakobling av noder | Venter på nettleserkjøring i Actions |
| `atmosphere.mjs` | Løvpool, pause, kamerahopp, begge stemningskilder på LOW, synlige GPU-former, dis og stråler | Venter på nettleserkjøring i Actions |
| `lifecycle.mjs` | Forsinket editor/fullskjerm, forsyninger, hån og duellreplikker ved pause/scenebytte | Venter på nettleserkjøring i Actions |
| `polish-visuals.mjs` | Faste kamerasteder, frø, før/etter-bilder, stående mobilformat, tegnekall og minnetall | Venter på bilder og visuell vurdering |

Den nye arbeidsflyten `.github/workflows/world-quality.yml` kjører på relevante PR-endringer eller manuelt. Den setter opp Node 22, Python 3.12, Pillow og Playwright 1.56.1 med Chromium. Typecheck, vanlig bygg, kunst-/alfakontroll og prosjektilressurstesten kjøres først, deretter de nye nettlesertestene og eksisterende `soundbank`, `particles`, `jungle` og `finale`. Enkeltfilbygget er kontrollert lokalt. Nettlesertestene kjøres én om gangen mot Vite dev-serveren. `atmosphere.mjs` importerer kildefilene direkte og skal ikke kjøres mot et rent produksjonsbygg.

Arbeidsflyten starter også en separat dev-server for PR-ens base. `polish-visuals.mjs` bruker samme bildeformat og kamerasteder på begge: brett 1 ved x 55, nattleiren ved x 34,5, jungelen ved x 72 og Scorchlands ved x 35. Stående mobilformat tas med aktive skjermeffekter. Logger, `metrics.json` og bilder lagres i Actions-artifakten `world-quality-<sha>` i 14 dager. Dette er sammenligningsbilder, ikke en automatisk påstand om at den nye grafikken er bedre.

Et grønt bygg bekrefter ikke shaderkompilering, lydmiksen eller at figurene er tydelige i kampen. Før godkjenning må Actions-resultatene leses og bildene åpnes. Oppdater denne statustabellen når resultatene foreligger.

## Viktige grenser for videre arbeid

- Prosjektiler, post-prosessering og de endrede lydbanene har konkret ressursopprydding. Delt eierskap i miljøet og figurriggen er fortsatt en egen oppgave; denne runden påstår ikke at alle minnelekkasjer er borte. Ikke legg en generell `dispose()` over alle materialer ved scenebytte, siden flere av dem gjenbrukes.
- Bruk de eksisterende GPU-poolene, `wind`, `qualityRank()`, `texFile()` og manifestet ved nye effekter. Nye partikkeltyper må vises som piksler i en kontroll, ikke bare telles i en buffer.
- Bloom og fargebehandling skjer fortsatt i den etablerte HDR-kjeden. Behold ett tonemapping-trinn og kontroller både LOW og HIGH når en egen shader endres.
- `docs/GJENBRUK.md` er en historisk gjennomgang fra 29. september. Flere av forslagene der var allerede implementert før denne runden. Prosjektbibliotekets Three.js-referanse og metode for faste kamerabilder er brukt som støtte; ingen ny ekstern pakke eller tjeneste er innført.

## Neste nyttige runde etter kontrollen

1. Se før/etter-bildene og prøv road/nightcamp på stedene der trærne dekket kameraet. Kontroller at tåke og lysstråler ikke skjuler fiender, og at jungelens steinvei passer figurstilen og tåler gjentakelse over hele brettet.
2. Lytt på ro/kamp og pause med ekte høyttalere eller hodetelefoner. Juster nivåene etter hørbarheten av slag og replikker; ikke legg på flere samtidige lydlag før miksen er vurdert.
3. Lag jungelkulissene og egne figurer for Zanthra/bueskytter/kaptein/griper/berserker etter oppdaterte `ART_PROMPTS.md` og prop-art-flyten. Kontroller rigg og ankere for hver figur.
4. Mål minne over gjentatte scenebytter før en større opprydding i miljø- og riggressurser. Skill delte ressurser fra instanseide ressurser først.

Dette er forslag til neste arbeid. De åpne oppgavene og Toms eksisterende designvalg står fortsatt i `todo.md` og `memory.md`.
