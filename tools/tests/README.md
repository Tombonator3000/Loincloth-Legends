# Playwright-tester

Testene styrer spillet via `window.__game` (spillet) og `window.__lib` (moduler som Fighter, buildHeroDef og defaultSave, se `src/app/debug.ts`) med faste tidssteg (`game.tick(1/60, false)`). De er stort sett deterministiske og uavhengige av FPS. Oppstartslogoen hoppes over automatisk (`navigator.webdriver`).

```bash
npm run build && npx vite preview --port 4173 &
npm i -D playwright
node tools/tests/story.mjs http://localhost:4173/ ./shots                 # tittel, Hero Forge, intro, kart, brett, sjef, belønning, kart
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots creator     # heltebygger: presets, tilfeldig, låste deler
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots map         # verdenskart og fremgang
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots levels      # alle fem brett til finalen (eller: levels road,frost)
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots arena       # arena-dueller
node tools/tests/ai.mjs http://localhost:4173/                            # CPU mot CPU, tre dueller
node tools/tests/lineup.mjs http://localhost:4173/ ./shots                # helter i alle rustninger (proporsjoner)
node tools/tests/closeup.mjs http://localhost:4173/ ./shots '{"body":1}'  # nærbilde av en helt i fire poser
node tools/tests/violence.mjs http://localhost:4173/ ./shots              # arm ryker, halshugging, hodet i skjermen, hodeløs kylling
node tools/tests/grab.mjs http://localhost:4173/ ./shots road             # grep, kne, kast, bowling og fare (road, swamp, frost, scorch, tower)
node tools/tests/mounts.mjs http://localhost:4173/ ./shots                # ridedyr, fiende-ryttere, avkasting, sitte opp, stormløp
node tools/tests/mountride.mjs http://localhost:4173/ ./shots             # halesvip og ildpust
node tools/tests/progress.mjs http://localhost:4173/ ./shots              # borgen, butikk, trening, kjæledyr og XP
node tools/tests/pets.mjs http://localhost:4173/ ./shots                  # alle fem kjæledyrene
node tools/tests/mobile.mjs http://localhost:4173/ ./shots                # telefon i liggende modus med berøring (CDP touch)
node tools/tests/gamepad.mjs http://localhost:4173/                       # falsk gamepad: stikke, knapper, grep og rumble
node tools/tests/splash.mjs http://localhost:4173/ ./shots                # oppstartslogoen (tvinges frem med ?splash)
node tools/tests/settings.mjs http://localhost:4173/ ./shots              # innstillingsmenyen, gore-nivå, FAMILY mot PLEASE SEEK HELP
node tools/tests/looks.mjs http://localhost:4173/ ./shots all             # faste skjermbilder av alle brett med tegnekall og trekanter (QUALITY=low osv.)
node tools/tests/metal.mjs http://localhost:4173/ ./shots all 14 shred    # metal-låtene rendret offline: WAV, spektrogram, nivå, klipping (shred = også med solo)
node tools/tests/metalmode.mjs http://localhost:4173/ ./shots             # METAL MODE: måleren fylles av drap, solo, skadebonus, lyn og brennende våpen
node tools/tests/soundbank.mjs http://localhost:4173/                     # lydbanken: opptak oppå synthen, torden, FAMILY, dukking, pause, stemning, fanfarer og file:// (bygg dist-single først)
node tools/tests/imuse.mjs http://localhost:4173/ ./shots                 # dirigenten: bytte på taktstreken med bro og svulm, lag, METAL MODE, innslag, sjef, avslutning og tapslyd (skriver imuse-offline.wav)
node tools/tests/homage.mjs http://localhost:4173/ ./shots                # tordenmagi med seks krukker, sjonglering i lufta og B-film-replikker
node tools/tests/nightcamp.mjs http://localhost:4173/ ./shots             # nattleiren: sovende helter, tyvnisser, krukker tilbake, daggry og forsyninger
node tools/tests/ab.mjs http://localhost:4173/ ./shots road ao           # samme bilde med og uten en effekt (ao, bloom, dof, grade), pluss bare AO-bufferet
node tools/tests/textures.mjs http://localhost:4173/ ./shots              # teksturer fra manifestet brukes i stedet for de prosedyrelagde (later som tre bilder finnes)
node tools/tests/pngparts.mjs http://localhost:4173/                      # PNG-deler sitter riktig på helt og fiender: fot på bakken, våpen i neven, nakke og skaft
node tools/tests/screenfx.mjs http://localhost:4173/ ./shots              # skjermeffekter: dråper på glasset, sjokk, årer, brennende kant, varmeflimmer, FLASHES og DISTORTION, lyspool, drypp, SSAO, WebGL tapt, AUTO og ?perf
node tools/tests/giant.mjs http://localhost:4173/ [./shots]               # kjempetrollet: størrelse, rustning til han vakler, bakkeslag, kameraet trekker seg bakover og inn igjen
node tools/tests/frostsound.mjs http://localhost:4173/                    # lydene fra frostpasset: snøtrinn, horn og brøl, kjempetrinn, fossesus, ulv, vindkast, isknak, klang, publikum og innleste replikker
node tools/tests/frostplay.mjs http://localhost:4173/ [./shots]           # spillet i frostpasset: fiender som rygger tas igjen, panikk, kast i juvet, istapper, fyrfat og glør, kjempen som kaster helten
```

Skriptene skriver ut tilstand og eventuelle konsollfeil (`LOGS:`). Tom logg betyr ingen feil.

I headless Chromium trengs WebGL via SwiftShader (`--use-angle=swiftshader`), det er satt opp i skriptene. Skjermbilder tar flere sekunder i SwiftShader, så tester som trenger sanntid (oppstartslogoen) fryser animasjonene før bildet tas.

Merk: sjefens død har slowmo og en pause før belønningen vises. `story.mjs` venter derfor til skjermen er aktiv før den trykker Enter. Gjør det samme i nye tester i stedet for å vente et fast antall sekunder. Menyer ignorerer trykk de første 350 ms (så et trykk ikke går rett gjennom to skjermer), så vent litt i sanntid før du trykker på en ny skjerm.
