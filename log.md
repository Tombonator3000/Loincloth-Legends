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

## 2026-09-29 12:32 (Europe/Oslo)
- Ny økt i Claude Code på nett (skyøkt koblet til repoet, gren `claude/loincloth-legends-setup-qx39n4`). Tom limte inn instruksen som var skrevet for en lokal økt i ~/Utvikling/Loincloth-Legends. En skyøkt ser ikke Toms maskin, bare det som ligger på GitHub.
- Da økten startet (12:23) hadde main bare README fra første commit. Klokka 12:25 lastet Tom opp `loincloth-legends-src.zip` og `ART_PROMPTS.md` via GitHub i nettleseren (commit 16ee895).
- Leste AGENTS.md, CLAUDE.md, memory.md, todo.md og log.md fra zip-en før noe ble endret.
- Sjekket zip-en før utpakking, siden repoet er offentlig: ingen nøkler, ingen .env-filer, ingen node_modules eller byggmapper.
- Pakket ut zip-en i roten av repoet uten endringer (106 filer, fillista sjekket mot zip-en). Fjernet zip-filen og `ART_PROMPTS.md` på rota, som var byte for byte lik `docs/ART_PROMPTS.md`. Begge finnes fortsatt i commit 16ee895.
- `npm install` (34 pakker, 0 sårbarheter, package-lock.json uendret), `npm run typecheck`, `npm run build` og `npm run build:single` ok.
- Røyktest med Playwright mot `vite preview`: story.mjs (tittel, Hero Forge, intro, kart, brett, sjef, belønning, tilbake til kart, pause) og splash.mjs gikk gjennom. Eneste logglinje var at Google Fonts ikke lastet i skyøkten (sertifikatfeil via proxyen), ikke en feil i spillet.
- Grenen `claude/loincloth-legends-v0.3` fra chat-økten ble aldri pushet og finnes ikke på GitHub. Main har det samme innholdet, pakket ut fra zip-en.
- Den lokale mappen ~/Utvikling/Loincloth-Legends har ikke git og har eldre utgaver av log.md, todo.md og memory.md. Den gamle framgangsmåten (git init, git reset origin/main, git add -A, push) ville nå skrevet over denne loggen. Lokalt arbeid bør skje i en fersk klone av repoet.
- Committet utpakkingen og denne loggen, og pushet til main (som Tom ba om) og til øktens gren.

## 2026-09-29 13:22 (Europe/Oslo)
- Ny runde fra Tom (skyøkt, jobber rett på main): skikkelige 3D-effekter på alt (vind, etterbehandling, 3D-trær, partikler, realistisk blod og gibs), bruke prosjektbiblioteket (https://github.com/Tombonator3000/prosjektbibliotek) til alt fra skills til effekter, og lage den ultimate hyllesten til Golden Axe, Barbarian, Castle Crashers og suspekte 80-talls fantasyfilmer: humor, store puppete damer (chainmail-bikini er kult) og en solid dose 1980s heavy metal. To skjermbilder av et stilisert 3D-spill med høsttrær, tåke og dybdeskarphet som referanse.
- Leste AGENTS.md i prosjektbiblioteket: kildene er referansemateriale, sjekk lisens og kompatibilitet før gjenbruk. Relevante oppføringer: scottstts/Threejs-Awesome-Graphics-Agent-Skills (MIT, 24 Three.js-skills), cortiz2894/stylized-components (MIT, gress og rotfestet vind) og achimala/dream-loop (MIT, visuell iterasjon mot målbilde). Hentet dem på de festede revisjonene fra katalogen. Scenario-skillsene krever en betalt tjeneste og ble ikke brukt.
- Leste skillene threejs-skill-router, threejs-image-pipeline, threejs-bloom, threejs-exposure-color-grading, threejs-shadow-systems, threejs-procedural-vegetation og threejs-procedural-vfx med referansefiler.
- Nytt verktøy tools/tests/looks.mjs: faste skjermbilder av alle brett (med fiender og et gore-øyeblikk), duell og tittel, for før/etter-sammenligning. QUALITY=low|medium|high|ultra velger grafikknivå.
- Ny bildepipeline i src/gfx/post.ts etter rekkefølgen i threejs-image-pipeline: scenen tegnes i lineær HDR (HalfFloat, MSAA 4x, dybdetekstur), bloom med mip-kjede (Karis-snitt og myk terskel først, 13-tap ned, tent opp), dybdeskarphet i halv oppløsning (CoC fra dybden, diskoppsamling med gyllen vinkel), eksponering, tonemapping én gang (Khronos PBR Neutral eller ACES), gradering i sRGB-rom (lift/gamma/gain, kontrast, metning, vibrance, split toning), vignett, filmkorn, kromatisk aberrasjon, rød kant ved lite liv og lysglimt.
- Kvalitetsnivå i innstillingene (GRAPHICS: AUTO, LOW, MEDIUM, HIGH, ULTRA). LOW tegner rett til skjermen uten etterbehandling. Pikseltettheten velges ut fra et pikselbudsjett per nivå (samme prinsipp som i threejs-image-pipeline). AUTO gir MEDIUM på små berøringsskjermer og HIGH ellers.
- Gradering per biom og arena i src/gfx/env/grades.ts. Første forsøk var alt for sterkt (oransje brett 1, knallrødt Scorchlands, rosa duell). Dempet toning og bloom, og byttet Scorchlands fra ACES til Neutral.
- Verdensmaterialene er byttet fra trestegs toon til mykt lys (MeshStandardMaterial via lit() og toon() i env/common.ts). Emisjon får HDR-styrke så bloom tar den.
- Sol med myke skygger (src/gfx/env/sun.ts): ett skyggekart som følger kameraet, låst til tekselrutenettet så kantene ikke flimrer. Skyggekart 1024/2048/4096 etter nivå. applyShadows() slår på skygger for alt i et miljø (konturskall kaster ikke).
- Figurteksturene var merket uten fargerom og ble skrevet rett ut. Nå er de sRGB, og figurskyggeleggeren har tonemapping og fargeromskonvertering, så figurene ser like ut i HDR-pipelinen og i LOW.
- Alle 14 Playwright-testene og looks.mjs på alle fire nivåer kjørte uten konsollfeil (bortsett fra Google Fonts, som skyøkten ikke når).

## 2026-09-29 13:56 (Europe/Oslo)
- Tom sendte fem konseptbilder som mål (slottshall, ruiner i skumringen, lavaland, en 3D-scene med lyn og en tåkeskog i 16-bit-stil) og spurte om spillet kan kjøres fra repoet. Svar: ja, git clone, npm install og npm run dev. Målbildet er skrevet ned i docs/STYLE_TARGET.md. Bildene er ikke lagt i repoet, fordi to av dem ser ut til å være andres verk og repoet er offentlig.
- Nytt felles vindfelt (src/gfx/wind.ts): uniformer som trær, gress og blader deler, vindkast som vandrer langs vindretningen, windifyTree() som patcher både fargematerialet og skyggematerialet så skyggene svaier med, og wind.velocity() for partikler. Oppdateres med spilltid, så slowmo bremser vinden.
- Prosedyriske 3D-trær (src/gfx/env/trees.ts) etter vekstkontrakten i structured-ash-growth: grenkø, ringer per seksjon, knudrethet og vridning, vekstkraft som bøyer tynne grener mest, stratifiserte sidegrener og fortsettelse fra hver tupp. Tilpasset spillet: normalisert radius så formen holder i liten skala, fire arter (høsttre, sumptre med hengende mose, furu med kjegleprofil og snø, dødt/brent tre), bladkort med klynger av blader, kronenormaler mot klumpsenteret per hovedgren, AO inne i kronen og gjennomskinnelige blader i motlys. Trærne instansieres i biter langs x, og prototypene bufres per art og grafikknivå.
- Instansert gress (src/gfx/env/meadow.ts): klumper av strå i en flis som følger kameraet, bue-bøying i vinden (lengden holdes), flagrende spisser, tørre flekker og motlys. Brukes som høstgress, siv i sumpen og frostgress.
- Fallende blader og løv på bakken (src/gfx/env/leaffall.ts), og tåkelag og lyssøyler (src/gfx/env/atmos.ts). Tåkekortene tones ut mot bakken så skjæringslinjen ikke synes.
- Brett 1 har høstskog i rader, dis mellom dybdeplanene og solstråler. Sumpen har knudrete trær med mose, siv og grønn dis. Frost har snødekt furuskog og frostgress. Scorchlands har brente trær og røykdis. Tårnet har månestråler gjennom vinduene. Sola ligger nå på samme kant som soldisken, og soldisken følger kameraet.
- Første forsøk på brett 1 ga en tett oransje vegg av kroner og for mye uskarphet i bakgrunnen. Glisnet ut skogen, løftet kronene og dempet bakgrunnsuskarpheten (konseptbildene har skarp bakgrunn med dis). En liten forgrunnsfuru i frost dekket kampen og ble krympet. GLSL-feil: patch er et reservert ord i GLSL ES 3.0.
- Måling i looks.mjs (tegnekall og trekanter per frame): brett 1 har rundt 600 000 trekanter og 430 tegnekall på HIGH, 368 000 og 441 på MEDIUM. Tegnekallene kommer mest fra små statiske mesher (palisaden er fire kall per påle). Sammenslåing av statiske mesher står på todo.
- Fjernet de gamle hjelperne deadTree, pineTree, tuftMat, tufts og toonGrad (ikke brukt lenger).
- Alle 17 Playwright-testene kjørte uten konsollfeil.

## 2026-09-29 14:10 (Europe/Oslo)
- Nytt partikkelsystem på GPU (src/gfx/vfx.ts) etter instanced-spark-kontrakten i threejs-procedural-vfx: faste pooler i en ringbuffer, hver partikkel har startposisjon, fart, akselerasjon, drag og fødselstid, og bevegelsen regnes ut analytisk i skyggeleggeren. En additiv HDR-pool (gnister strukket langs farten, glimt, flammer med flytende støy, sjokkbølger flatt på bakken, glør) og en røykpool (myke dotter med falsk kulenormal, snø og aske som harde flak). Det som faller gjennom gulvet blir liggende og tones ut.
- Lyn (VFX.lightning): takkete bane med midtpunktforskyvning og sidegreiner, slår ned tre ganger med ny form hver gang, med gnister, sjokkbølge, røyk og et kraftig lysglimt. Eksplosjon (VFX.explode) med glimt, flammer, gnister, røyk og lys.
- Lyspool: fire punktlys som fordeles til de nærmeste lyskildene (bål, lava, fakler) og til korte lysglimt ved treff, magi og lyn. Antallet endres aldri, så materialene kompileres ikke på nytt. Punktlysene i Scorchlands, tårnet, arenaen og bålene går nå via poolen.
- Gore sender gnister, glimt, ild, stemningspartikler og støv videre til GPU-poolene med samme signaturer, så de 48 kallstedene i spillkoden er uendret. Lavadråper går også til GPU. Blodet er foreløpig på CPU (neste steg).
- Feil underveis: smoothstep med kantene i synkende rekkefølge er udefinert i GLSL og ga usynlige flammer i SwiftShader. Og partikler som ble sluppet ut i frames som ikke tegnes (testene hopper over tegning) ble aldri lastet opp, fordi jeg tømte oppdateringsområdene selv. Three tømmer dem etter opplasting, så nå legges de bare til.
- looks.mjs har fått et fx-bilde (lyn, eksplosjon og gnister midt i brett 1).
- Testene story, violence, levels (scorch, tower), arena, mountride, settings og ai kjørte uten konsollfeil.

## 2026-09-29 14:23 (Europe/Oslo)
- Nytt blod (src/gfx/blood.ts): bloddråpene er på GPU som blanke, runde dråper med høylys, strukket langs farten når de flyr fort. Landingspunktet regnes ut når dråpen slippes ut (samme formel som skyggeleggeren), så flekken kommer akkurat der og da dråpen treffer bakken. Ingen CPU-oppdatering per dråpe.
- Flekkene har et generert atlas med 16 varianter: runde treffsprut med satellittdråper, retningssprut med utropstegn-striper, drypp og store pytter. Tykkelsen ligger i en egen kanal og gir normaler og våt glans fra sola som tørker inn til matt brunrødt etter 10 til 45 sekunder. Dråper som lander fort gir avlange sprut i treffretningen.
- Pytter vokser fram under liket når det har lagt seg (Gore.pool og Fighter), og under kjøttbiter som ligger stille. Flekkene miljøene legger ut ved bygging er nå gamle og inntørkede (Gore.stain).
- Glødende blodsprut ved treff (røde HDR-striper) og en rød tåke av blod ved store sprut, som i konseptbildene.
- 3D-gibs (src/gfx/gibs.ts): kjøttbiter med marmorert fett og hinne i toppunktfargene og lav ruhet (vått), beinbiter, ribbein, tenner, øyeepler med iris og blodårer, og glødende lavastein. De tumler rundt alle tre akser og kaster skygger. FAMILY beholder gummiender, blomster og stjerner.
- Settings-testen leser nå antall dråper i lufta fra Gore.drops.live.
- Testene settings, violence, story, grab, levels (swamp, scorch), pets og ai kjørte uten konsollfeil.
