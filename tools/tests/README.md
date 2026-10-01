# Playwright-tester

Testene styrer spillet via `window.__game` (spillet) og `window.__lib` (moduler som Fighter, buildHeroDef og defaultSave, se `src/app/debug.ts`) med faste tidssteg (`game.tick(1/60, false)`). De er stort sett deterministiske og uavhengige av FPS. Oppstartslogoen hoppes over automatisk (`navigator.webdriver`).

```bash
npm run build && npx vite preview --port 4173 &
npm i -D playwright
node tools/tests/story.mjs http://localhost:4173/ ./shots                 # tittel, Hero Forge, intro, kart, brett, sjef, belønning, kart
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots creator     # heltebygger: presets, tilfeldig, låste deler
node tools/tests/hero-forge.mjs http://localhost:4173/ ./shots/forge      # 58 delvalg, 39 Forge-bilder, miksing, lagring, hjelm-/hammer-/frost-/klubbelås, mobil og manglende bilde
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots map         # verdenskart og fremgang
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots levels      # alle fem brett til finalen (eller: levels road,frost)
node tools/tests/scenarios.mjs http://localhost:4173/ ./shots arena       # arena-dueller
node tools/tests/ai.mjs http://localhost:4173/                            # CPU mot CPU, tre dueller
node tools/tests/lineup.mjs http://localhost:4173/ ./shots                # helter i alle rustninger (proporsjoner)
node tools/tests/closeup.mjs http://localhost:4173/ ./shots '{"body":1}'  # nærbilde av en helt i fire poser
node tools/tests/violence.mjs http://localhost:4173/ ./shots              # arm ryker, halshugging, hodet i skjermen, hodeløs kylling
node tools/tests/particles.mjs http://localhost:4173/ [./shots]           # blodråper i fart, gnister, sjokkbølger og blod fra en arm som ryker synes på skjermen (teller piksler)
node tools/tests/grab.mjs http://localhost:4173/ ./shots road             # grep, kne, kast, bowling og fare (road, swamp, frost, scorch, tower)
node tools/tests/guard.mjs http://localhost:4173/ [./shots]               # tøffe fiender (guard) står imot grep til de vakler: skjelett gripes, grisemannen skyver helten unna, etter et slag eller med lite liv gripes han
node tools/tests/bend.mjs http://localhost:4173/ [./shots] [stillinger] [stiff]  # albuer og knær på Thrugg: våpenet i neven, bladet beholder retningen, skjelettet bøyer ikke, løs arm beholder bøyen, føttene, og bilder av stillingene (stiff = også uten bøy)
node tools/tests/vorthax.mjs http://localhost:4173/ [./shots] [brett]     # Vorthax på himmelen på brettene før tårnet: tale mellom bølgene, alle replikkene, toner ut og kommer ikke igjen
node tools/tests/mounts.mjs http://localhost:4173/ ./shots                # ridedyr, fiende-ryttere, avkasting, sitte opp, stormløp
node tools/tests/riders.mjs http://localhost:4173/                         # fiende-ryttere kan tas: en bot jager dem med låst kamera, de holder seg innen rekkevidde, rygger saktere enn helten og slås av og drepes
node tools/tests/mouse.mjs http://localhost:4173/                          # venstre museknapp slår på brett og i duell, ikke på kartet eller i pausen
node tools/tests/mountride.mjs http://localhost:4173/ ./shots             # halesvip og ildpust
node tools/tests/progress.mjs http://localhost:4173/ ./shots              # borgen, butikk, trening, kjæledyr og XP
node tools/tests/pets.mjs http://localhost:4173/ ./shots                  # alle fem kjæledyrene
node tools/tests/mobile.mjs http://localhost:4173/ ./shots                # telefon i liggende modus med berøring (CDP touch)
node tools/tests/gamepad.mjs http://localhost:4173/                       # falsk gamepad: stikke, knapper, grep og rumble
node tools/tests/splash.mjs http://localhost:4173/ ./shots                # oppstartslogoen (tvinges frem med ?splash)
node tools/tests/settings.mjs http://localhost:4173/ ./shots              # OPTIONS, gore-nivå, FAMILY mot PLEASE SEEK HELP
node tools/tests/menus.mjs http://localhost:4173/ ./shots                 # menyene: fire knapper på tittelen, OPTIONS og gruppene, kontrollsidene, begge tastene for spiller 2 (FONTS_DIR=... gir ekte fonter og sjekker at sidene får plass i 720p)
node tools/tests/looks.mjs http://localhost:4173/ ./shots all             # faste skjermbilder av alle brett med tegnekall og trekanter (QUALITY=low osv.)
node tools/tests/metal.mjs http://localhost:4173/ ./shots all 14 shred    # metal-låtene rendret offline: WAV, spektrogram, nivå, klipping (shred = også med solo)
node tools/tests/metal.mjs http://localhost:4173/ ./shots all 14 '' both  # samme med og uten de ekte instrumentene (-real i filnavnet)
node tools/tests/metal.mjs http://localhost:4173/ ./shots stage 12 '' both drums  # ett instrument alene (drums, guitar, bass eller lead), til lytteprøver
node tools/tests/instruments.mjs http://localhost:4173/                   # ekte trommer, gitar og bass: lastet, riktig tone, ren låt, nivå nær synthen, trommene høres på små høyttalere, gitarene svarer på anslaget, ulike opptak på venstre og høyre gitar, kabinettkurven, mindre sus enn synthen, synth uten opptak
node tools/tests/mix.mjs http://localhost:4173/ [kick,snare,...]         # blandingen per instrument, synth mot opptak: rå RMS, K-vektet (som LUFS) og mobil, topp og bånd
node tools/tests/buttons.mjs http://localhost:4173/ ./shots               # tre knapper: grep og ridning ved å gå inn i fienden eller dyret, ned + hopp
node tools/tests/metalmode.mjs http://localhost:4173/ ./shots             # METAL MODE: måleren fylles av drap, solo, skadebonus, lyn og brennende våpen
node tools/tests/soundbank.mjs http://localhost:4173/                     # lydbanken: opptak oppå synthen, torden, FAMILY, dukking, pause, stemning, fanfarer og file:// (bygg dist-single først)
node tools/tests/imuse.mjs http://localhost:4173/ ./shots                 # dirigenten: bytte på taktstreken med bro og svulm, lag, METAL MODE, innslag, sjef, avslutning og tapslyd (skriver imuse-offline.wav)
node tools/tests/homage.mjs http://localhost:4173/ ./shots                # tordenmagi med seks krukker, sjonglering i lufta og B-film-replikker
node tools/tests/nightcamp.mjs http://localhost:4173/ ./shots             # nattleiren: sovende helter, tyvnisser, krukker tilbake, daggry og forsyninger
node tools/tests/ab.mjs http://localhost:4173/ ./shots road ao           # samme bilde med og uten en effekt (ao, bloom, dof, grade), pluss bare AO-bufferet
node tools/tests/textures.mjs http://localhost:4173/ ./shots              # teksturer fra manifestet brukes i stedet for de prosedyrelagde (later som tre bilder finnes)
node tools/tests/pngparts.mjs http://localhost:4173/                      # PNG-deler sitter riktig på helt og fiender: fot på bakken, våpen i neven, nakke og skaft
node tools/tests/artcheck.mjs http://localhost:4173/ [./shots]           # kunstpakken på riggen: neven i våpenleddet, våpenarmen dekker skulderplaten, hodet bak overkroppen (foran ved langt skjegg), hoggene når fram, målte skulder- og halspunkter, skulderkontakt i blandingene fra heltesmia, heltesmia med malte våpen (./shots gir galleri med leddmarkører)
node tools/tests/screenfx.mjs http://localhost:4173/ ./shots              # skjermeffekter: dråper på glasset, sjokk, årer, brennende kant, varmeflimmer, FLASHES og DISTORTION, lyspool, drypp, SSAO, WebGL tapt, AUTO og ?perf
node tools/tests/giant.mjs http://localhost:4173/ [./shots]               # kjempetrollet: størrelse, rustning til han vakler, bakkeslag, kameraet trekker seg bakover og inn igjen
node tools/tests/frostsound.mjs http://localhost:4173/                    # lydene fra frostpasset: snøtrinn, horn og brøl, kjempetrinn, fossesus, ulv, vindkast, isknak, klang, publikum og innleste replikker
node tools/tests/frostplay.mjs http://localhost:4173/ [./shots]           # spillet i frostpasset: fiender som rygger tas igjen, panikk, kast i juvet, istapper, fyrfat og glør, kjempen som kaster helten, ridedyr stopper ved juvet
node tools/tests/jungle.mjs http://localhost:4173/ [./shots]              # jungelen: planten spiser kastede fiender og biter helten bare når den glefser, steinvekta faller på den som står under, søylen faller bort fra slaget og knuser fiendene, skjermbilder langs brettet
node tools/tests/route.mjs http://localhost:4173/ [./shots]               # veien: sumpen og frosten i valgfri rekkefølge etter jungelen, Scorchlands krever begge, brettnummeret følger rekkefølgen (kartet og starten), kartografen melder bare åpne steder
node tools/tests/bossphases.mjs http://localhost:4173/ [./shots]          # sjefer i faser (runde E): faser ved 66 og 33 prosent, måltidet, røde trekk, sliten sjef, dykket, lavasporet, speilbildene, solstrålen
node tools/tests/finale.mjs http://localhost:4173/ [./shots]              # sluttkampen i tårnet: tronen og skjoldet, vaktene som reiser seg, døra, søylene, Solhjertet og slutten
node tools/tests/combo.mjs http://localhost:4173/                         # runde E: sjonglering som slås i bakken, sprett mot kanten (høyst tre), kropper som treffer andre, eliter og sjefer som leser like slag og blokkerer, løpeslaget som bryter guarden, unnamanøver for prosjektiler, grep som rives løs
node tools/tests/director.mjs http://localhost:4173/                      # runde E: regissøren (topp og pusterom, angrepsplasser og tempo), bølgebudsjettet (rang og gjeld) og vanskelighetsgraden (opptrekk, tempo, unnamanøvrer, ikke liv eller skade)
node tools/tests/newfoes.mjs http://localhost:4173/ [./shots]             # runde E: bueskytteren (avstand, piler langs linja, løper unna), froskemannen i bakhold (usynlig, hopper ut, slår ned), griperen (rødt blink, holder, slipper, hamring, slag i opptrekket), berserkeren, kapteinen (horn innenfor budsjettet, ordre, troppene flykter når han dør), fiender til ledige ridedyr, utholdenhet, og nærbilder
node tools/tests/editor.mjs http://localhost:4173/ [./shots]              # STAGE FORGE: biblioteket, legge ut, dra med musa, angre, slette, rad, slå av generert pynt, tidslinja, lagre (nedlasting), PNG inn, PLAY FROM HERE og tilbake
node tools/tests/prop-images.mjs http://localhost:4173/                   # bilder som tar over for plassholderne: rutenett fra bildet, lys, flammer og bevegelse fra plassholderen
node tools/tests/prop-anim.mjs http://localhost:4173/ [./shots]           # deler (følger animasjon, flytting, skala og speilvending, sletting og duplisering), wave, pulse, drift, react (TEST, kråka flykter fra helten, treff ved skiltet), ledd med klikk i bildet, varianter og SAVE AS SET. Bruker testbrettet fixtures/road-placeholders.json (det gamle brett 1)
node tools/tests/env-pack.mjs http://localhost:4173/ [./shots]            # miljøpakken: spillet henter bare kulissebildene brettene bruker og editoren resten, settene i tre ledd (flammen på lykta), emit, SAVE AS SET med on, brett 1 uten advarsler, kråka på skiltet
node tools/tests/assets-timeout.mjs                                       # uten nettleser (Node 22.13+): tidsgrenser i lasteren, og kulissebildene hentes bare når de trengs, hvert bare én gang
node tools/tests/forge-save.mjs http://localhost:5173/                    # lagring gjennom dev-serveren (npm run dev): brettfila, bilde og manifest i repoet (også emit, fire og on), ingen ny innlasting, alt der etter omstart. Setter filene tilbake (blir testen avbrutt, sett road.json og manifest.json tilbake selv og slett prop_forgetest.webp)
```

Skriptene skriver ut tilstand og eventuelle konsollfeil (`LOGS:`). Tom logg betyr ingen feil.

`hero-forge.mjs` følger også Ash Raider og Iron Warden gjennom de faktiske bølgekøene i Scorchlands og Tower, angrep mot helten, dødsbelønning og neste bølge. `artcheck.mjs` kontrollerer de nye Forge-overkroppene i hele og blandede figurer med den samme skulder- og halsriggen som resten av spillet.

I headless Chromium trengs WebGL via SwiftShader (`--use-angle=swiftshader`), det er satt opp i skriptene. Skjermbilder tar flere sekunder i SwiftShader, så tester som trenger sanntid (oppstartslogoen) fryser animasjonene før bildet tas.

Ett tegnet bilde av et brett tar rundt 10 sekunder i SwiftShader, og det første skjermbildet 40 til 50 sekunder. Tegn bare før skjermbilder (`tick(1/60, true)` én gang). Tegner en test i hver tick, hoper arbeidet seg opp, og testen ser ut til å henge. Flere feller står i skillen `game-tests` (`.claude/skills/game-tests/SKILL.md`).

Merk: sjefens død har slowmo og en pause før belønningen vises. `story.mjs` venter derfor til skjermen er aktiv før den trykker Enter. Gjør det samme i nye tester i stedet for å vente et fast antall sekunder. Menyer ignorerer trykk de første 350 ms (så et trykk ikke går rett gjennom to skjermer), så vent litt i sanntid før du trykker på en ny skjerm.
