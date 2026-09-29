# log.md

Logg over alt som er gjort i prosjektet. Nyeste nederst.

## 2026-09-29 07:46 (Europe/Oslo)
- Tom ønsket et 3D/2D hybrid-spill: Castle Crashers + Golden Axe + Barbarian, sidescroller med 1v1 dueller, 80-talls fantasy-humor og mye gore.
- Valg fra Tom: spillbar prototype, Three.js + TypeScript, 1 spiller + 2 spillere lokalt.
- Opprettet prosjektet med Vite, TypeScript og Three.js.
- Skrev docs/GDD.md, AGENTS.md, memory.md, todo.md og denne loggen.

## 2026-09-29 08:27 (Europe/Oslo)
- Bygde kjernesystemer: input (tastatur + gamepad, fanger raske trykk ved lav FPS), WebAudio-synth for SFX og musikk (tittel, brett, duell, seier).
- Tegnet 8 originale figurer prosedyremessig (Thrugg, Valkyra, Skelly Grunt, Hogman, Cultist, Potion Gnome, Gorthak, Cleanup Imp) som cutout-rigger med egne kroppsdeler.
- Gore-system: blodpartikler (instanced), blodflekker på bakken, gibs og løse kroppsdeler med fysikk, blodfontener, blod på skjermen, slowmo.
- Brett 1 (The Road of Mild Peril): 3D toon-miljø med palisade, trær, telt, bål, bannere, fjell og borg. Fem bølger, tønner, pickups, magi, berserk-spinn, 2P co-op.
- Duell (The Pit of Unfair Judgement): arena med publikum, fakler, Vorthax og prinsessen på balkongen. Retningsbaserte angrep, blokk høy/lav, halshugging, CPU-AI, best av tre, Cleanup Imp.
- HUD, tittelskjerm, kontrollskjerm, intro-tekst, mellomsekvenser, seier, game over og pause.
- Testet med headless Chromium (Playwright): deterministiske simuleringer av brett, duell, 2P, magi, død/respawn/game over og CPU mot CPU. Ingen konsollfeil.
- Fikset underveis: raske tastetrykk ble tapt ved lav FPS, fjell dekket himmelen, porttårn blokkerte kamera, balkong skjulte skurken, CPU slo fra for lang avstand, Esc åpnet og lukket pausen i samme frame.
- La til README.md og tools/artifact.py (lager Artifact-vennlig HTML fra single-file-bygget).

## 2026-09-29 08:28 (Europe/Oslo)
- Publiserte spillbar versjon som Artifact ("Loincloth Legends").
- Pakket kildekoden som loincloth-legends-src.zip og la ved en frittstående HTML-fil som kan spilles offline.

## 2026-09-29 08:54 (Europe/Oslo)
- Ny runde fra Tom: gjøre koden modulær for Claude Code, verdenskart med biomer og fiender, bosser på slutten av brett, dueller innimellom i stedet for bosser, GPT-grafikkliste (ChatGPT/GPT-image), heltebygger (mann eller dame, sett sammen deler) og flere forslag.
- Leste AGENTS.md. Startet refaktorering til scene-system og datadrevne registre.

## 2026-09-29 09:31 (Europe/Oslo)
- Refaktorerte til modulær, datadrevet arkitektur: src/app (spillflyt, scener, lagring), src/data (fiender, sjefer, duellanter, brett, kart, våpen, opplåsinger), register for figurer (gfx/chars) og miljø (gfx/env).
- Delte opp characters.ts i gfx/chars/{types,classic,wilds,bosses,hero,index}.ts og env.ts i gfx/env/{common,grass,swamp,frost,scorch,tower,arena,worldmap,sprites,index}.ts.
- Nye figurer: Bog Zombie, Frogman, Ice Troll, Fire Imp. Sjefer: Big Mama Hogmother, King Croakus, Magmor the Molten, Vorthax. Fargevarianter via tint (Frost/Ember Skeleton, Dark Cultist, Hog Guard, Frostjarl Kaldor, Dark You).
- Nye biomer: sump, frost, vulkan og tårn (innendørs). Arenaen har tre temaer (pit, ice, bone).
- Fiende-AI med oppførsler (melee, brute, ranged, runner, jumper, shambler) og prosjektilsystem.
- Sjef-AI satt sammen av trekk (melee, charge, slam, leap, shoot, summon, teleport, tongue, rain), raseri ved halv HP, stagger, HP-bar i HUD.
- Duellen generalisert: motstander fra data, våpen påvirker trekk, tag team med 2 spillere, ond tvilling.
- Verdenskart i 3D med noder, stier, låsing og belønninger. Fremgang lagres i localStorage.
- Hero Forge: mann eller dame, 12 kategorier, våpen med stats, magivalg, presets, tilfeldig helt og navn, låste deler.
- PNG-laster (gfx/assets.ts): public/assets/manifest.json erstatter figurdeler, himmel og kart. Presets bruker thrugg_/valkyra_-filer.
- Skrev docs/ART_PROMPTS.md (grafikkliste til ChatGPT), docs/ARCHITECTURE.md, CLAUDE.md, oppdaterte AGENTS.md, GDD (v0.2 med forslag) og README.
- Testet med Playwright: heltebygger, kart, alle fem brett med sjef/duell-finale, arena-dueller og PNG-erstatning. Ingen konsollfeil.

## 2026-09-29 09:38 (Europe/Oslo)
- Kjørte full historieflyt med ekte tastetrykk (tittel, Hero Forge, intro, kart, brett, sjef, belønning, kart, pause). Det som så ut som en feil (Enter tok deg ikke tilbake til kartet) var testen: belønningen dukker opp først etter slowmo og nedtelling. Testen venter nå på skjermen i stedet for et fast antall sekunder.
- Byttet "GÅ" og "GÅ INN" i kartpanelet til "BEVEG" og "START", fordi pikselfonten ikke tegner Å pent.
- Erstattet utdaterte tester (sim.mjs, flow.mjs) med story.mjs og scenarios.mjs, og oppdaterte ai.mjs til nytt API (goDuel med arena, heroSide). Tre CPU-dueller går til ende. Oppdaterte tools/tests/README.md.
- Typecheck, build og build:single ok. Publiserte versjon 2 av Artifact "Loincloth Legends".
- Pakket kildekoden på nytt (loincloth-legends-src.zip), la ved frittstående HTML og ART_PROMPTS.md.

## 2026-09-29 10:49 (Europe/Oslo)
- Ny runde fra Tom: gjennomføre forslagene (ridedyr, grep og kast, gore-innstilling, butikk og nivåer, kjæledyr) før prosjektet flyttes til GitHub og Claude Code.
- I tillegg: teit overdreven vold (imp sparker avkappet hode i skjermen, hodet sklir ned med sklilyd; arm faller av og spretter vekk, figuren roper JUST A FLESH WOUND), overdrevne proporsjoner (enorme muskler, overdreven rustning på damene, bittesmå lendeklær, stort hode på liten kropp), mobilkontroller og klargjøring for gamepad.
- Leste AGENTS.md, memory.md, todo.md og log.md. Startet kartlegging av koden.

## 2026-09-29 10:53 (Europe/Oslo)
Merk: tidspunktene fra 10:53 til 11:57 er rekonstruert fra når filene sist ble endret, fordi loggen ikke ble skrevet underveis i denne runden.
- Innstillinger (src/core/settings.ts): gore-nivå FAMILY, NORMAL, EXCESSIVE (standard) og PLEASE SEEK HELP, musikk, lydeffekter, skjermristing, rumble og berøring. Lagres under `loincloth-legends-settings-v1`, separat fra fremgangen.
- Gore-nivået skalerer partikler, gibs, fontener og blod på skjermen. FAMILY gjør blod om til konfetti og gibs til gummiender, blomster og stjerner.

## 2026-09-29 11:05 (Europe/Oslo)
- Proporsjoner: ny src/gfx/chars/muscle.ts. Stort hode (HEAD_SCALE 1.3) på liten kropp, korte bein, brede skuldre og altfor store armer på mennene, overdreven 80-talls-rustning på damene (fullt dekket og komisk), bittesmå lendeklær.
- Thrugg og Valkyra bygges nå med heltebyggeren, så presetene har samme proporsjoner. Gorthak er tegnet på nytt.
- Første forsøk leste ikke som store armer, og skulderen havnet over munnen. Løst med bredere overkropp, skuldre lenger ut, høyere nakke med trapezius og armer skalert 1,42.

## 2026-09-29 11:16 (Europe/Oslo)
- Teit vold i duellen: når hodet kappes av, løper Cleanup Imp bort og sparker hodet mot kamera. Det klasker i skjermen, blir sittende et øyeblikk og sklir sakte ned i rykk med hvinelyd og en rød stripe etter seg (src/gfx/fx.ts, hurlAtScreen).
- Armer kan ryke av i brett og dueller. Armen spretter vekk, figuren roper "IT'S JUST A FLESH WOUND!" og slåss videre. Uten våpenarm blir alle angrep til spark. Mat gir armene tilbake.
- Hodeløse fiender løper rundt en stund før de faller.
- Fikset: impen nådde av og til aldri frem til hodet (tidsgrense 4,5 s), og hodet på glasset var uskarpt (tegnes nå i full oppløsning).

## 2026-09-29 11:21 (Europe/Oslo)
- Grep og kast (src/game/grab.ts): grip, kne, kast i retning og bowling inn i andre fiender.
- Farer (data/hazards.ts, game/hazards.ts, gfx/env/hazards.ts): piggrop, myr, råk, lava og piggfelle, hver med sin egen dødsmåte. Lagt inn i alle fem brett.

## 2026-09-29 11:31 (Europe/Oslo)
- Ridedyr i Golden Axe-stil: War Hog (stormløp), Cluckatrice (halesvip) og Magma Newt (ildpust), med egen rigg (gfx/beast.ts). Fiender kommer ridende i bølgene, kan slås av dyret, og helten kan sitte opp selv.
- Fikset: angrep rett etter at man satt opp ble ignorert (køes nå i 0,4 s), og halen til War Hog tegnet bare omrisset.

## 2026-09-29 11:37 (Europe/Oslo)
- Nivåer og butikk: XP, nivåkurve og STR/DEF/MAG/AGI (data/progress.ts). Hjemborgen på kartet har YE OLDE SHOPPE og trening (app/camp.ts). Ekstra liv, potions, deler og kjæledyr kan kjøpes. Lagringen er utvidet med fremgang, kjæledyr og forbruksvarer.
- Kjæledyr: Eyeball of Greed (drar til seg gull), Rabid Rat (biter ankler), Sarcastic Skull (fornærmer fiender til de gråter), Battle Chicken (legger helbredende egg) og Tiny Dragon (spytter ild).
- Fikset: gullet på kartet ble ikke oppdatert etter handel, og hodeskallens fornærmelse brukte setTimeout (nå spilltid).

## 2026-09-29 11:52 (Europe/Oslo)
- Gamepad: standard mapping (A hopp, X/RT angrep, B/LB/LT spesial, Y/RB grip, Start pause, Select tilbake) og rumble. Med én gamepad i 2-spiller er gamepaden spiller 2.
- Berøring (ui/touch.ts): flytende stikke og fire knapper for spiller 1, pauseknapp og beskjed om å snu telefonen. Menyene kan trykkes på. Kompakt oppsett på lave skjermer.
- Oppstartslogo for Tom's Happy Happy Funtimes Emporium (ui/splash.ts): trommevirvel, logoen faller ned, solstråler, konfetti, sirkusfanfare og PRESENTS. Toms originalbilde ligger i art/studio/, en komprimert webp i src/assets/. Hoppes over i tester og med ?nosplash.
- Fikset: berøringskontrollene ble aldri skjult i menyer, tittelen ble klippet og Hero Forge kunne ikke rulles på mobil.

## 2026-09-29 11:57 (Europe/Oslo)
- Oppdaterte README, AGENTS.md, GDD (v0.3), ARCHITECTURE og ART_PROMPTS (ridedyr, kjæledyr, farer, nye høyder på heltedelene).
- Nye Playwright-tester i tools/tests: lineup, closeup, violence, grab, mounts, mountride, progress, pets, mobile, gamepad og splash. Alle gikk uten konsollfeil, sammen med de gamle (story, scenarios, ai).

## 2026-09-29 12:06 (Europe/Oslo)
- Ny test tools/tests/settings.mjs: innstillingsmenyen med piler og tastatur, lagring, og FAMILY mot PLEASE SEEK HELP (303 mot 812 blodpartikler for de samme tre drapene). Konfetti, gummiender og blomster vises i FAMILY.
- PNG-lasteren hopper over manifest.json når spillet er åpnet som fil (file://), så dobbeltklikket single-file-bygg ikke logger feil.
- La til .gitignore, satte versjonen til 0.3.0 og synket package-lock.json.
- Typecheck, build og build:single ok. Røyktest av single-file-bygget (tittel og oppstartslogo) uten konsollfeil.
- Publiserte versjon 3 av Artifact "Loincloth Legends".
- Leste repoet https://github.com/Tombonator3000/Loincloth-Legends: bare en README fra første commit, ingen AGENTS.md der fra før (vår følger med).
- Committet prosjektet til grenen `claude/loincloth-legends-v0.3`. Push ble stoppet med 403: repoet er ikke koblet til denne økten, så git-proxyen gir ingen skrivetilgang. Commiten ligger klar i økten, og kildekoden er levert som zip.
