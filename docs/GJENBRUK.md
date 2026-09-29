# Gjenbruk: kode, effekter og lyd fra dine andre prosjekter

Skrevet 2026-09-29 for Tom. Dette bygger på seks gjennomganger som er kontrollert mot filene: musikk, lydeffekter, visuelle effekter, ChatGPT-grafikk, andre repoer og prosjektbiblioteket. Filstier og linjenummer er sjekket. Ingenting er endret i koden ennå.

Verdi går fra 1 til 5, der 5 er mest verdt. Innsats er liten, middels eller stor.

## 1. Kort svar

- Det iMUSE-aktige systemet vi har laget ligger i Morbidium, i `src/06_musikk.js` (musikken) og `src/42_lyd.js` (lydbanken). Det bytter sang på taktstreken med en kort bro og legger på kamp- og sjefslag på slaget. Det senker også musikken under store smell og spiller små innslag i riktig toneart. Ingen av de andre repoene har noe lignende.
- LL har ikke noe av dette i dag. Hvert musikkbytte starter den nye sangen med en gang, midt i takten (`src/core/audio.ts` linje 849-860).
- Dette er mest verdt å ta med nå:
  - lydbanken med CC0-opptak fra Morbidium, lagt over dagens syntetiserte lyder
  - musikkdirigenten med overganger og intensitetslag
  - skjermeffektene fra Morbidium: dråper på glasset, sjokkbølger og årer ved lav helse
  - automatisk grafikkvalitet
- Grafikkverktøyene for ChatGPT ble hentet fra Morbidium i dag. Prompten du ba om å se er ferdig: `docs/CHATGPT_PROMPT.md`. Her foreslår vi bare noen små rettelser.
- Krediteringen haster. LL bruker allerede kode med MIT-lisens (gresset og vinden, og tonekurvene fra three.js), men det står verken i README eller i det publiserte spillet.
- Avgjort av Tom: lyder fra Freesound og samplede instrumenter (CC0) er med, og gjenbruk går foran å skrive nytt. Regelen om at all lyd skal syntetiseres ble byttet ut (commit 96158c5, `AGENTS.md`): CC0-opptak er lov så lenge de står i en kildeliste, og synthen er reserve. Forbedring av gjenbrukt kode er også lov.

## 2. Anbefalt rekkefølge

### Ta med nå

| Nr | Hva | Hentes fra | Verdi | Innsats | Hva spilleren får |
|---|---|---|---|---|---|
| 1 | Kreditt og lisenser: «Gjenbruk og takk» i README, MIT-merknader med i bygget, og retting av gamle påstander om at all lyd er syntetisert | Mønster fra Morbidium README, Vite `build.license` | 5 | Liten | Ingenting synlig, men det er en plikt etter MIT og `AGENTS.md` |
| 2 | Lydbank med CC0-opptak over syntlydene, med kildeliste | Morbidium `src/42_lyd.js`, `assets/lyd/` | 5 | Middels | Ekte slag, knas, sprut og sus oppå 80-tallssynthen |
| 3 | Kamplyder, torden og zap koblet til lydmetodene som finnes i dag | Morbidium `assets/lyd/`, `src/39_kombo.js`, 3044 `SoundSystem.js` | 4 | Liten | Lyn høres ut som lyn og ikke som en eksplosjon |
| 4 | Dukking: musikken senkes under store smell og mens spillet står på pause | Morbidium `06_musikk.js`, `42_lyd.js` | 4 | Liten | Store øyeblikk trenger gjennom gitarene |
| 5 | Dirigent: sangbytte på taktstreken med trommevirvel, bekkensvulm og slag på første taktslag, pluss en test | Morbidium `06_musikk.js` | 5 | Middels | Musikken bytter som i en film, uten hakk |
| 6 | Intensitetslag: rolig, kamp, hete og sjef | Morbidium `06_musikk.js` | 5 | Middels | Bandet trapper opp når fiendene kommer |
| 7 | METAL MODE, sjef, duell og seier i takt | Morbidium `06_musikk.js` | 4 | Liten | Soloen og gongen lander på slaget |
| 8 | Skjermeffekter i én runde: dråper på glasset, sjokkbølger og kameradykk, årer ved lav helse, varmeflimmer og brennende kant i METAL MODE. I samme runde kommer to nye valg for blink og forvrengning | Morbidium `43_vaatt.js`, `04_render.js`, `40_dybde.js`, `34_blod.js` | 4 | Middels | Treff og store øyeblikk kjennes i hele bildet |
| 9 | Automatisk grafikkvalitet, gjenoppretting når WebGL faller ut, skygger av i pause, ytelsesmåler bak `?perf` | Morbidium `15_rom3d.js`, `04_render.js`, The Deep Ones `v2/main.js` | 4 | Middels | Jevnere bilde på telefon og nettbrett |
| 10 | Stemning per biom: sirisser, bål, vind, drypp og drone, med syntetisert reserve | Morbidium `42_lyd.js` og løkkene, The Deep Ones `v2/audio.js` | 4 | Middels | Hvert brett får sin egen lyd under musikken |
| 11 | Fanfarer, kunngjører og drapsrekker: lagspiller for syntlyd, applaus, trist trombone, formantstemme og flerdrap | Morbidium `01_core.js`, `39_kombo.js`, VCSL-slagverk | 4 | Middels | Blodbadene blir feiret med lyd, ikke bare med tekst |
| 12 | Grafikkverktøyene: rette malene, mindre WebP-filer, stopp for falske sjakkbrett, myk kant, kontroll av ark og navn, sjekk i CI | LLs egne `tools/process_art.py` og `tools/make_templates.py` (fra Morbidium) | 4 | Middels | Raskere oppstart og færre stygge kanter når ChatGPT-bildene kommer |
| 13 | Lava som flyter | Prosjektbiblioteket, `lava-flow-surface` | 4 | Middels | Levende lava på det brennende brettet |
| 14 | Lyspool uten blinking, bloddrypp fra sårede, SSAO som lar lava og bål være lyse | Morbidium `15_rom3d.js`, `34_blod.js`, SSAO-oppskriften i biblioteket | 3 | Liten | Faklene slukker ikke ved hvert treff, og de sårede blør |
| 15 | Innslag på slaget og i tonearten: bølge ryddet, nytt nivå, FIGHT! og KO | Morbidium `06_musikk.js` | 3 | Middels | Små musikalske stikk i samme toneart som låta |

Lyd kommer først fordi den gir mest hørbar gevinst raskt. Lydbanken (2-4) virker også uten dirigenten. Skjermeffektene (8-9) ligger i en annen del av koden og kan gjøres ved siden av.

### Senere

| Hva | Hentes fra | Verdi | Innsats |
|---|---|---|---|
| Musikken trekker seg tilbake når det er rolig lenge | Morbidium `06_musikk.js` | 3 | Liten |
| Tapslyd og seierslåt som slutter (rettes sammen med feilen i quickDuel) | Morbidium `06_musikk.js` | 3 | Liten |
| Tilfeldige lyder per biom: ugle, kråke, kvist, kjetting | Morbidium `01_core.js`, `42_lyd.js` | 3 | Middels |
| `lag_lyd.py` for lyder banken mangler: sverdklang, publikum, ulv, frosk, hest, krigshorn | Morbidium `tools/lag_lyd.py` | 3 | Middels |
| Lyder fra riktig side, stillere og mørkere på avstand | Morbidium `42_lyd.js` | 3 | Middels |
| Musikken lukker seg og et hjerte slår ved lav helse | Morbidium, 3044 `ReactiveMusicSystem.js` | 2 | Liten |
| Kor, messing og klokker i synth | Morbidium `06_musikk.js` | 2 | Liten |
| Fiender som grynter fra siden de kommer | Morbidium `42_lyd.js` | 2 | Liten |
| Fottrinn per underlag | Morbidium `42_lyd.js`, `fot_*.mp3` | 2 | Liten |
| Mumling til snakkeboblene | Morbidium `01_core.js` | 2 | Liten |
| Varsel på bakken før angrep, som glødende runer. Samtidig rettes lekkasjen i prosjektilene | Morbidium `46_blekk.js` | 4 | Middels |
| Lysdrama: faklene dør når sjefen kommer, lynet lyser opp hele scenen | Morbidium `15_rom3d.js` | 3 | Liten |
| Tåke som gløder rundt faklene | Morbidium `15_rom3d.js` | 3 | Liten |
| Fugleflokker: kråker, gribber, flaggermus | guild-life `birdGeometry.ts` | 3 | Middels |
| Myrvann med ringer der noe faller i | stylized-components via Morbidium | 3 | Middels |
| Snø og mose på steiner og palisader | Prosjektbiblioteket, `snow-accumulation` | 3 | Middels |
| Playwright i CI med skjermbilder | guild-life `agent-validate.yml` | 3 | Middels |
| Den viktigste grafikken lastes først | Morbidium `src/10_art.js` | 3 | Middels |
| Statusliste over grafikk som mangler | Morbidium `tools/lag_tegnelister.py` | 3 | Liten |
| Hudfarge og hårfarge på ChatGPT-heltene | Morbidium `src/14_pasient.js` | 3 | Middels |
| Sprekker og brennmerker etter nedslag | Morbidium `46_blekk.js` | 2 | Middels |
| Snø i tre lag, med store fnugg nær linsen | Morbidium `47_sno.js` | 2 | Middels |
| Falske skygger fra bål | Morbidium `40_dybde.js` | 2 | Middels |
| Oppløsning med glødende kant når Vorthax teleporterer | Morbidium `11_doll.js` | 2 | Liten |
| Grus fra taket i tårnet | Morbidium `40_dybde.js` | 2 | Liten |
| Mykere risting av kameraet | Morbidium `04_render.js` | 2 | Liten |
| Regn | guild-life `threeWeatherRenderer.ts` | 2 | Middels |
| Eføy på murer og tårn | Prosjektbiblioteket, `procedural-surface-ivy` | 2 | Middels |
| Lydsjekk i CI | guild-life `scripts/audit-audio.mjs` | 2 | Liten |
| Lagark for Hero Forge: hår, hjelmer, skjegg | Morbidium `tools/lag_maler.py` | 2 | Stor |
| ChatGPT-grafikk i enkeltfil-bygget og i Artifact | Morbidium `build.py` | 2 | Middels |
| PROMPTS-kommando i ChatGPT-prompten | Morbidium `utegrafikk-prompter.json` | 2 | Liten |
| Opplasting fra telefonen via en egen gren | Morbidium `gpt-grafikk/LESMEG.md` | 2 | Middels |
| Kunngjører med nettleserens stemmer (trenger ditt ja) | guild-life `speechNarrator.ts` | 2 | Liten |

## 3. Område for område

### 3.1 Musikk som iMUSE

**Hva som finnes.** Morbidium `src/06_musikk.js` (389 linjer) er det eneste iMUSE-aktige vi har. Det gjør dette:

- En ny sang starter aldri midt i takten. Den venter til neste taktstrek, eller til neste slag når det haster. Det siste slaget før byttet er en bro: den gamle sangen tier, en harpe spiller opp mot den nye tonearten, og et bekken svulmer slik at toppen treffer nøyaktig på første slag. Der slår paukene grunntonen.
- Samme sang får et kamplag eller et sjefslag når faren kommer. Laget går opp på neste slag og ned på neste taktstrek, og tempoet øker litt.
- Musikken senkes et øyeblikk under store smell og mens paneler er åpne.
- Små fraser spilles i riktig toneart på neste slag, og pling-lyder stemmes til nærmeste tone i akkorden.
- Etter en stille periode trekker musikken seg tilbake, og stemningslyden kommer fram.
- Tidsstyringen følger Chris Wilsons «A Tale of Two Clocks». Den tar seg inn igjen etter at fanen har vært skjult.

| Del | Hvor i Morbidium |
|---|---|
| Bytte på taktstreken | `src/06_musikk.js` 101-127, 136-144, 160-163, 195-208, drevet fra `src/30_game.js` 769 |
| Bro og bekkensvulm | `06_musikk.js` 125-135, 139-141, 248-249, 289-295. Opptak: `assets/lyd/ins_bekken_1.mp3`, `ins_bekken_2.mp3`, `ins_pauke_1-3.mp3`, `ins_paukevirvel_1.mp3`, `ins_gong_1.mp3` |
| Kamplag og sjefslag | `06_musikk.js` 97, 164-174, 186, 205, 274-287 |
| Dukking | `06_musikk.js` 88-92, 175-177, `src/42_lyd.js` 76 |
| Innslag i tonearten | `06_musikk.js` 305-340, `42_lyd.js` 74-75 |
| Ro | `06_musikk.js` 187-193 |
| Test | `tools/testdeler/lyd_og_musikk.py` 66-108 |

**Hva LL har i dag.** Scheduleren i `src/core/audio.ts` (895-908) er god. Den ser 0,12 sekunder fram på lydklokka i sekstendeler og hopper fram etter et opphold. Men:

- play() (849-860) starter den nye sangen på steg 0 med en gang. Toner som allerede ligger i kø, og akkorder som fortsatt klinger, legger seg over den nye sangen.
- Det finnes ingen overgang som venter på taktstreken.
- METAL MODE slår inn på neste sekstendel. Krasj og hyl kommer utenfor takten, og det gjør også stinger() (874-880).
- Ingenting dukker musikken, heller ikke pause (`src/app/game.ts` 615).
- Når sjefen kommer, spiller `src/game/stage.ts` 470-472 play('duel'), gong og stuping på en gang. På tårnet er musikken allerede 'duel' (`src/data/levels.ts` 117), så der skjer ingenting musikalsk.
- Game over (`game.ts` 551-553) kutter musikken uten fade.

**Slik tar vi det over.**

1. Ny fil `src/core/conductor.ts` i ren TypeScript, med en overgang som venter. I spillet brukes `audio.queue(navn, 'bar' | 'beat')`. Menyene beholder dagens umiddelbare play(). LL har 16 steg per takt og Morbidium 8, så tallene dobles.
2. Broen skrives om til metall. Tammene tar en trommevirvel, gitarene holder en kvintakkord på dominanten til den nye tonearten, og bassen går opp mot den. På første slag kommer stortromme, krasj og en stor akkord på den nye grunntonen. Bekkensvulmen bruker VCSL-opptaket `ins_bekken_1` når det er lastet, og ellers en syntetisert baklengs krasj med samme timing.
3. Intensitetsnivå 0 til 3 settes fra `Stage.update`:
   - 0: rolig mellom bølgene.
   - 1: kamp.
   - 2: hete. Mange fiender, en ridende fiende, eller en helt under 30 prosent helse.
   - 3: sjef.

   Dette krever egne volumbusser i `MetalBand` (`src/core/metal.ts`).
4. METAL MODE går inn på neste slag, soloen starter på taktstreken, og modusen går ut på neste taktstrek. Spillet (12 sekunder, skade og lyn) går på spilltid som før. Det er bare lyden som venter.
5. Sjefen: byttet skjer på neste slag med gong og stor akkord, og nivået går til 3. Når sjefen dør, kommer en kort avslutning og så seiersmusikken. Game over får en kort fade og en tapslyd.
6. Testen `tools/tests/imuse.mjs` sjekker at byttet lander på taktstreken, og at lag og innslag kommer på slaget.

**Å passe på.**

- Ekkoforsinkelsen settes hvert steg (`metal.ts` 591), så tempoendring gir knitrete ekko. Det må rettes før tempoet får gli.
- Stupingen (diveBomb) kan ikke startes 1,35 sekunder før et slag som bare er 0,4 sekunder unna. Legg sjefsbyttet på en taktstrek minst 1,4 sekunder fram, eller gi stupingen en lengde.
- Alle låtene unntatt frost står i E, så den harmoniske broen betyr mest rundt frost. Jinglene i C-dur passer over E-moll, men skurrer i frost og duell.
- 8-bit-låtene står i D-moll, A-moll og E, så de må få sin egen toneart i koden.

**Lisens og kreditt.** Koden er din egen. Morbidium har ikke valgt lisens (README linje 59). Tidsstyringen etter Chris Wilson er en teknikk og ikke kopiert kode. iMUSE (LucasArts, Michael Land og Peter McConnell) er bare inspirasjon, og ingen kode eller musikk er hentet derfra. Ikke bruk navnet iMUSE i teksten i spillet. I dokumentasjon og kreditt er det greit. VCSL-slagverket er CC0.

### 3.2 Lydeffekter og stemmer

**Hva som finnes.** Morbidium har en lydbank i `src/42_lyd.js` (107-196) med 165 MP3-filer i `assets/lyd/`: 102 opptak fra Freesound og 63 samples fra VCSL. Alle er CC0 1.0 ifølge `lyd.json`, og alle står med tittel, innspiller og lenke i `assets/lyd/KILDER.md`.

Banken dekoder filene i bakgrunnen. Den velger en tilfeldig variant, aldri den samme to ganger på rad, og spiller høyst fem lyder per gruppe per 80 ms. Tabellen LYD_KART (19-67) legger opptaket oppå den gamle syntlyden, som blir liggende under med et fast nivå. Til filen er klar, eller hvis den feiler, spiller synthen alene.

Morbidium har også disse delene:

- **Lagspiller for syntlyd** (`src/01_core.js` 252-364, tilpasset fra 3044). En lyd beskrives som data: lag av oscillatorer, støy og arpeggio.
- **Torden** (`src/39_kombo.js` 50 og 74). Først et skarpt knall, så buldring som kommer senere jo lenger unna lynet slår ned.
- **Fanfarer** (`39_kombo.js` 44-78): orgel, kor, klokker, gong, pauker, applaus, trist trombone og en egen lyd når sjefen dør.
- **Kunngjører** (`39_kombo.js` 23-41). En formantstemme som halvveis «sier» ordet på skjermen.
- **Kombo** (`39_kombo.js` 80-214): treffkjede, flerdrap, trombone når kjeden brytes, og overkill.
- **Stemning** (`42_lyd.js` 246-289). Løkker per sted som glir inn og ut, og bålknitring som kommer fra siden der nærmeste bål står.
- **Verktøyet `tools/lag_lyd.py`.** Det henter lyder og stopper hvis Freesound-siden mangler CC0-merket (linje 211). Så klipper og normaliserer det lydene, lager løkker og skriver kildelisten.

**Hva LL har i dag.** Bare syntetisert lyd: rundt 40 metoder i `src/core/audio.ts` (swish, hit, splat, bones, boom, gong og flere), kalt fra rundt 40 steder. Det finnes ingen lasting av lydfiler, ingen stemning og ingen panorering.

Alle lyn spiller boom(), som er en eksplosjon:

- tittelskjermen (`game.ts` 95)
- lynprosjektilet (`src/game/projectiles.ts` 170), som også brukes av METAL MODE og sjefen
- tordenmagien (`stage.ts` 381 og 394)

Kunngjøringene er bare tekst. Drapsrekkene har navn, men lyden er bare publikum.

**Slik tar vi det over.**

1. Ny `src/core/soundbank.ts` som gjør det samme som Lydbank i Morbidium, skrevet som en TypeScript-modul. Filene kopieres som de er, siden de allerede er klippet og normalisert, til `public/assets/sound/`. Der ligger også `sound.json` og `KILDER.md`.
2. Vi endrer metodene i `audio.ts`, ikke stedene som kaller dem. Koblingene blir slik:

   | Lydmetode i LL | Opptak fra Morbidium |
   |---|---|
   | swish | swing |
   | hit | hit og hitHeavy, med knas under |
   | splat | splat og gore |
   | bones | knas |
   | tapt arm | rive |
   | spidding og bitt | stikk |
   | død | die |
   | landing av tunge fiender | slam |
   | lyn | torden og zap |
   | gong | gongen fra VCSL |
   | mynt | tooth |

   Syntlyden blir liggende under på 20 til 40 prosent.
3. På FAMILY-nivået (uten gørr) hopper vi over gore, knas, rive og stikk, og beholder dagens familielyder.
4. Synthen beholdes der banken mangler noe som passer: sverdklang, publikum, skrik og grynt, magi, hopp og flere.
5. Enkeltfil-bygget kan ikke hente filer fra disken, så der spiller synthen, slik regelen sier. Vil du ha opptakene der også, kan et lite kjernesett bakes inn. Det koster rundt 0,8 MB.
6. Innstillingene får et valg, «RECORDED SOUNDS», som slår opptakene av og på.
7. Etterpå kommer:
   - torden som følger avstanden
   - lagspilleren
   - fanfarer tonet mot metall
   - kunngjøreren (engelske ord blir bare antydet, så teksten på skjermen bærer meningen)
   - flerdrap med LLs egne navn

Utvalget er på rundt 450 KB MP3 til sammen:

| Gruppe | Størrelse |
|---|---|
| Kamp | 89 KB |
| Torden | 37 KB |
| Zap | 11 KB |
| Stemning | 144 KB |
| Dyr | 30 KB |
| Slagverk | 118 KB |
| Fottrinn | 20 KB |

Hele Morbidium-banken tar rundt 30 MB minne når den er dekodet. Utvalget vårt er en liten del av det.

**Stemning per biom.**

| Brett | Opptak | Syntetisert reserve |
|---|---|---|
| night | Sirisser (amb_natt) og bål (amb_baal), sterkere nær bålet | Brun støy |
| frost | Vind (amb_vind) | Vind med langsom svinging |
| swamp | Drypp (amb_drypp) og litt sirisser | Drypp og frosk fra grunt() |
| scorch | Bål og lav buldring | Lavabuldring |
| tower | Drone (amb_drone) | Drone stemt etter låta |
| grass | Svak vind | Vind |
| Arenaene | Ingen løkke i banken | Syntetisk publikumsmumling |

Stemningen starter der musikken starter (`stage.ts` 129) og i duellen. Den stopper når scenen ryddes, så lagene ikke hoper seg opp. campfire() returnerer allerede posisjonen, men listene over bål er lokale. Miljøet trenger derfor en liste over lydkilder.

**Å passe på.**

- Halshugging setter skaden til hp + 999 (`src/game/combat.ts`). En rett port av overkill ville dermed gi OVERKILL på hver halshugging. Hold halshugging utenfor, eller bruk en relativ grense.
- DOUBLE, MULTI og MONSTER KILL er navn fra Unreal Tournament. Bruk egne navn.
- Støybufferen i LL går ikke i løkke (1,5 sekunder), så lange støylag som torden og applaus kuttes. Lagspilleren må sette løkke.
- Opptakene er normalisert høyt. Miksen må sjekkes mot metallbandet.

**Lisens og kreditt.** Opptakene er CC0 1.0. Det gir ingen juridisk plikt til å kreditere, men `AGENTS.md` krever en kildeliste per fil. Vi kopierer radene fra Morbidiums `KILDER.md` for filene vi tar. Noen eksempler:

- hit.mp3: «body_hit.wav» av insanity54
- hitHeavy: «Major punch» av janbezouska
- gore: «Gore Impact - LOT OF HEART» av magnuswaker
- knas: «Hard Candy / Bone Crunch» av clif_creates
- stikk: «Knife Stab Melon.wav» av jawbutch
- torden: «Thunder (Krakow, Poland, 20.05.2013)» av vonz

Tre filer i banken er fra slettede brukere: drypp, kvist og glass_2. De er fortsatt CC0, men kildesiden kan være borte. Koden er din egen (Morbidium, 3044 og The Deep Ones).

Kenney Impact Sounds og RPG Audio er nevnt som mulige ekstra CC0-kilder for slaglyder. Lisensen deres er ikke sjekket i denne runden.

### 3.3 Visuelle effekter

**Hva som finnes og hva LL har.**

| Effekt | Hvor i Morbidium | LL i dag | Verdi |
|---|---|---|---|
| Blod og vann på glasset, med lysbrytning | `src/43_vaatt.js` 18-194, shader i `04_render.js` 191-202 og 252-269, testene del_34 og del_47 i `tools/testdeler/blod_og_treff.py` | `src/gfx/fx.ts` screenBlood: runde, ugjennomsiktige flekker, bare når en helt eller sjefen dør, ved glasshodet og ved halshugging i duell. Et treff på helten gir ingenting på skjermen | 4 |
| Sjokkbølger, sug mot nedslaget, negativ ramme, kameradykk | `04_render.js` 171-180, 206-211, 281-282, 366-382, 594-600, kroker i `40_dybde.js` 172-178 | Bare vanlig kromatisk aberrasjon. `PostFX.flash` og `PostFX.hurt` settes aldri under spill, og `FX.zoomPunch` er død kode | 4 |
| Varmeflimmer over bål og lava | `04_render.js` 181-190, `40_dybde.js` 146-152 | Ingen forvrengning | 3 |
| Årer som kryper inn og pulserer ved lav helse | `04_render.js` 143-145, 243-251, `34_blod.js` 185-186 | Den røde kanten finnes i shaderen, men settes aldri | 4 |
| Brennende skjermkant | `04_render.js` 277-278, `39_kombo.js` 207 | I METAL MODE brenner bare våpnene | 3 |
| Automatisk kvalitet, gjenoppretting når WebGL faller ut, skygger av i pause | `15_rom3d.js` 34-49 og 431-432, `04_render.js` 57-102 og 321-330 | autoQuality() gjetter ut fra skjermen (`src/gfx/post.ts` 728-738). Ingenting fanger opp at WebGL faller ut, og skygger og etterbehandling tegnes også i pause | 4 |
| Lyspool uten blinking | `15_rom3d.js` 363-401, testen del_38 i `grafikk.py` | Gnister tar lyset fra fjerneste fakkel med en gang (`src/gfx/vfx.ts` 328-364) | 3 |
| Bloddrypp fra sårede | `34_blod.js` 189-192 | Levende, sårede figurer drypper aldri. `Gore.drop` finnes allerede | 3 |

**Slik tar vi det over.** De fem skjermeffektene legges i samme etterbehandlingspass (COMPOSITE i `src/gfx/post.ts`) i én runde.

- Dråpene blir en ny fil, `src/gfx/screenwet.ts`. De spruter fra siden treffet kom fra, og mengden følger skaden.
- Dråpene må oppdateres utenfor tegningen, fordi Playwright-testene kjører spillet uten å tegne.
- Effektene finnes ikke på LOW. Dagens 2D-blod blir reserven der og på FAMILY. FAMILY kan få vanndråper eller konfetti.
- `src/core/settings.ts` får to nye valg: blink og forvrengning. Den negative rammen kan være plagsom for folk som tåler blinking dårlig, så den skal være mild som standard.
- Den automatiske kvaliteten må hoppe over tester, ellers senker Playwright-testene kvaliteten. Beskjeden i spillet skrives på engelsk, for eksempel «GRAPHICS ADJUSTED».

**Regler ved porting.**

- Ekte TypeScript-moduler, ikke globale objekter og tilkoblinger på tvers som i Morbidium.
- Spilltid, ikke setTimeout.
- Endringene fra three.js r128 til 0.186 må med: LuminanceFormat blir RedFormat, og updateRange blir addUpdateRange.
- Egne shadere skal ende med tonemapping og fargerom slik `memory.md` beskriver.

**Senere.**

- Angrepsvarselet i `46_blekk.js` har et blekk- og papirpreg som bryter med «ikke tegneserie». Det må tegnes om til glødende runer.
- LL-snøen er allerede på skjermkortet og følger vindkastene. Det som mangler, er laget med store fnugg nær linsen og lys fra faklene.

**Lisens og kreditt.** Effektkoden i Morbidium er din egen. Bare tre steder i effektfilene har kode fra andre:

- vannet fra cortiz2894/stylized-components (MIT) i `04_render.js` 472-475. Ringene i vannet hører også til denne koden.
- partikkelpoolen fra scottstts (MIT) i `04_render.js` 616-617
- sdPie fra Inigo Quilez i `46_blekk.js` 82, som kan utelates

Tar vi med disse delene, må MIT-merknadene følge.

### 3.4 ChatGPT-grafikk

**Status.** Det meste er allerede overført fra Morbidium i dag, i tre commits:

- 89ad8a2 ga `tools/process_art.py`, `tools/make_templates.py`, malene i `docs/maler/` og innboksen i `art/inbox/`.
- 94956bb ga fiendene variasjon i størrelse og fargetone.
- f857be6 ga startprompten.

Prompten du ba om å se er ferdig: `docs/CHATGPT_PROMPT.md` (660 linjer, DEL 1 og DEL 2). Gjennomgangen fant ingen grunn til å skrive den om.

**Rettelser vi fant ved å teste verktøyene i en kopi.**

1. Malene er uenige med spillet. Nakkepunktet på torsoen står 7 prosent ned, men spillet regner med 12 prosent. Knyttneven står på 90 prosent, men spillet regner med 86 (`tools/make_templates.py` 64 og 69 mot `src/gfx/rig.ts` 29-34). Prompten ber ChatGPT følge merkene, så bildet og teksten sier forskjellige ting. Merkene må flyttes og malene lages på nytt.
2. Tapsfri WebP er rundt fire ganger større enn kvalitet 90 med eksakt alfa (340 KB mot 84 KB ved 768 piksler). Med rundt 89 figurdeler kan det bli flere titalls MB, og oppstarten har en grense på 4 sekunder (`src/main.ts` 10).
3. Et malt, falskt sjakkbrett slipper gjennom som «OK». Det bør stoppe med FEIL.
4. Den harde bakgrunnsnøklingen gir en lys kant rundt hår og pels når ChatGPT leverer på hvit bakgrunn, noe prompten tillater som reserve. Løsningen er myk kant og fargerens.
5. En del som krysser cellegrensen kuttes i to uten advarsel. Et ark som mangler en del, for eksempel våpenet, går også gjennom. Det trengs en advarsel, en sjekk for forventede deler og en test.
6. Vegger, planker og heller blir blandet i sømmene, selv om prompten sier at de skal lages på nytt. Verktøyet bør heller skrive en 2x2-forhåndsvisning som du kan se på selv.
7. Feilstavede navn som `skeletn_head.png` havner i manifestet og blir aldri brukt. Navnene bør sjekkes mot id-ene i koden.
8. En skrivefeil i `public/assets/manifest.json` gjør at all grafikk forsvinner uten beskjed i det publiserte spillet (`src/gfx/assets.ts` 177-183). En sjekk i CI før bygget fanger det.
9. Legg `*_reference.*` og `art/preview/` i `.gitignore`, så referansebildet av Valkyra ikke havner i repoet.
10. Tre korte linjer i `docs/CHATGPT_PROMPT.md`:
    - i seksjon 7, ved små rettelser: «Edit only <area>; keep every other pixel, the layout, the framing and the resolution unchanged.»
    - i 8.9: ikke tegn magentamerkene, og hold litt tom marg i hver celle
    - i 6.3: «A production game asset, not concept art.»

**Senere.** Disse kan også tas etter hvert:

- viktig grafikk lastes først
- statusliste over grafikk som mangler
- omfarging av hud og hår på ChatGPT-helter
- lagark for Hero Forge
- grafikk i enkeltfil-bygget og i Artifact
- en PROMPTS-kommando som skriver ut promptene
- opplasting fra telefonen via en egen gren

Opplasting i GitHubs nettleser rett til main går forbi `.gitignore`. Da havner originalene i historikken til det offentlige repoet. Det er grunnen til at opplasting fra telefon bør gå via en egen gren.

**Oppskrifter.** To ting kan brukes som oppskrift uten at noe kode flyttes:

- en kort seksjon i prompten for en ChatGPT-agent med tilgang til repoet
- en linje om å tegne alle fem kjæledyrene på ni-ting-malen i ett bilde

**Lisens og kreditt.** Alt er din egen kode. Toppen av `process_art.py` og `make_templates.py` krediterer Morbidium, men README gjør det ikke. Stilblokkene i Morbidium navngir eksisterende spill (Conan Chop Chop, Castle Crashers, Binding of Isaac). Det skal ikke inn i LLs prompter.

### 3.5 Andre prosjekter

| Repo | Hva som er verdt noe | Anbefaling | Lisens |
|---|---|---|---|
| Geometry 3044 | Zap-lyden (`js/systems/SoundSystem.js` 773-824) til torden og lyn, og grunnlaget for Morbidiums lagspiller. Ytelsesmåleren `PerformanceMonitor.js`. Prestasjonene i `AchievementSystem.js` som oppskrift, med egne navn | Zap nå. Prestasjoner som oppskrift | README sier MIT og viser til en LICENSE-fil som ikke finnes. `package.json` sier ISC. Din egen kode |
| The Deep Ones | Brun støy til stemningen (`v2/audio.js` 8-13). Måling av bildetid med p95 og p99 (`v2/main.js` 90-116). Lærdom om å fjerne sjakkbrett og svart bakgrunn (`v2/art.js` 6-13) | Måleren nå, bak `?perf`. Resten som reserve og oppskrift | README sier MIT, men det finnes ingen LICENSE-fil. Din egen kode |
| guild-life-adventures | Fugleflokk med vinger som slår (`birdGeometry.ts`). Regn. Playwright i CI med skjermbilder. Lydsjekk i CI. Varmeflimmer og skyskygger som oppskrift | Senere | Ingen LICENSE-fil. Din egen kode. MP3-ene har ukjent opphav og skal ikke tas med |
| state-shift-strategy | Lyden settes på pause når fanen skjules (`src/audio/NewsroomRadio.ts` 82-93) | Oppskrift, rundt 15 linjer | Din egen. Lisensfil ikke sjekket |
| connect-play | Ingenting. 151 av 152 lydfiler er plassholdere, og regnløkka mangler innspiller og lenke | Ikke ta med | |
| Mythos-Quest-3D | Syntetiserte fottrinn og lignende laget med NumPy | Ikke ta med. Det er ikke bedre enn det LL har | |
| Voidcraft | 192 effekter laget med ElevenLabs | Ikke ta med | AGPL-3.0, og lydene er ikke CC0 |

Ingen av disse repoene har noe iMUSE-aktig. Den eneste er Morbidium.

### 3.6 Prosjektbiblioteket og kildene

**Det LL allerede bruker.** Threejs-Awesome-Graphics-Agent-Skills (Scott Sun, MIT, versjon d1cb23d) har vært oppskrift for etterbehandling, sol og skygger, partikler og trær. Noe er også ren tilpasset kode:

- `src/gfx/env/meadow.ts` 128-150 og `src/gfx/wind.ts` 80-84 bygger på `stylized-meadow-grass/grass-system.js` 180-215, med de samme konstantene. Den koden bygger igjen på dedekpo/stylized-scene (MIT).
- Tonekurvene i `src/gfx/post.ts` 329-354 er kurvene fra three.js.
- Hashen etter Dave Hoskins brukes i `post.ts`, `vfx.ts` og `wind.ts`.

`memory.md` linje 40 («Ingen kode er kopiert inn») er derfor feil og må rettes. MIT-merknadene må følge med.

**Ta med nå.**

- **Lava som flyter**, fra `skills/threejs-procedural-materials/examples/lava-flow-surface/lava-surface.js`. Den er tilpasset fra sabosugis CodePen «Very Hot Planet». Vi tar bare støyen og materialet, som blir ny fil `src/gfx/env/lava.ts`. Den erstatter lavaelva på det brennende brettet (`src/gfx/env/scorch.ts` 36-54) og lavapølene. LOW beholder dagens tekstur.
- **SSAO-rettelsen.** I dag gjør SSAO hele bildet mørkere, også lava, bål og partikler (`post.ts` 380). Et første steg er å la lyse punkter slippe. Det er en liten jobb.
- **Kreditt og lisensfiler.** Se del 4.

**Oppskrift.**

- Faste frø i skjermbildetestene, og en test for flimring (`threejs-visual-validation`).
- Dream Loop-rubrikken for å sammenligne mot målbilder (Anshu Chimala, MIT). Den bør brukes sparsomt, siden du syntes den forrige runden med mange agenter tok for lang tid.
- Meteorer med en glødende hale.
- Linseskinn fra sterke lys.

**Senere.**

- Myrvann med ringer: Christian Ortiz, stylized-components, MIT, via Morbidium.
- Snø og mose på rekvisitter: achrefelouafi, MIT.
- Eføy på murer: achrefelouafi, MIT.

**Den eneste musikkoppføringen** i biblioteket er YuE, en KI-modell for sang. Se del 5.

### 3.7 Småfeil vi fant i LL underveis

- quickDuel spiller seiersmusikken selv når spilleren taper (`src/app/game.ts` 450-452).
- setTimeout brukes i spillkode, og det bryter regelen om spilltid (pause og slowmo virker ikke der). Stedene er:
  - `stage.ts` 183, 329, 473, 538 og 746
  - `fighter.ts` 320 og 383
  - `duel.ts` 207, 411 og 442
  - `mounts.ts` 169
  - `game.ts` 116

  `Gore.later` finnes allerede som erstatning.
- Prosjektilene lager ny geometri hver gang og rydder den aldri (`projectiles.ts` 99, 104, 108 og 115-119).
- `PostFX.hurt` og `PostFX.flash` settes aldri under spill, og `FX.zoomPunch` er død kode.
- README linje 9 og `src/core/audio.ts` linje 1 sier at all lyd er syntetisert. Det gjør også `docs/GDD.md` seksjon 14. Alle tre må oppdateres.

## 4. Opphav og lisens

### Kilder utenfra

| Kilde | Lisens | Hva det gjelder | Kredittlinje |
|---|---|---|---|
| Freesound (102 opptak via Morbidium) | CC0 1.0, sjekket per fil | Kamp, torden, zap, stemning, dyr, fottrinn | «Lydopptak fra Freesound (CC0). Tittel, innspiller og lenke for hver fil står i `public/assets/sound/KILDER.md`.» |
| Versilian Community Sample Library (VCSL), Versilian Studios | CC0 1.0 | Gong, pauker, paukevirvel, bekken | «Slagverk fra Versilian Community Sample Library (VCSL), CC0.» |
| Threejs-Awesome-Graphics-Agent-Skills, Scott Sun | MIT. To eksempler er GPL-3.0 (wet-puddle-rain og deformable-sand), og dem bruker vi ikke | Gress og vind (tilpasset kode), oppskrift for etterbehandling, sol, partikler og trær, lava (planlagt) | «Gresset og vinden er tilpasset fra stylized-meadow-grass i Threejs-Awesome-Graphics-Agent-Skills av Scott Sun (MIT).» |
| dedekpo/stylized-scene | MIT | Grunnlaget for gresset over | «... som bygger på dedekpo/stylized-scene (MIT).» |
| sabosugi, CodePen «Very Hot Planet» | MIT (via CodePens vilkår) | Lava | «Lavaen bygger på sabosugis «Very Hot Planet» (MIT).» |
| three.js | MIT | Motoren, Sky-tillegget, tonekurvene i `post.ts` | «three.js (MIT).» Merknaden mangler i det bygde spillet i dag |
| Dave Hoskins, «Hash without Sine» | MIT | Støy i `post.ts`, `vfx.ts`, `wind.ts` | «Hash etter Dave Hoskins (MIT).» |
| Christian Ortiz, stylized-components | MIT | Myrvann med ringer (senere, via Morbidium) | Tas med når koden kommer inn |
| achrefelouafi (SnowSystem, GrassSystem, VegetationGenerator) | MIT | Snø, mose og eføy (senere) | Tas med når koden kommer inn |
| Inigo Quilez, sdPie | MIT (bekreft teksten før kopiering) | Bare hvis angrepsvarselet får kjegler. Kan utelates | Tas med hvis den brukes |
| Dream Loop, Anshu Chimala | MIT | Rubrikken, hvis teksten kopieres | Tas med hvis den brukes |
| Ben Golus, whiteout-blanding | Idé | `src/gfx/env/surface.ts` | Høflighet |
| Felzenszwalb og Huttenlocher | Fagartikkel | `src/gfx/charlight.ts` | Høflighet |
| mulberry32 | Fri (public domain) | `src/gfx/noise.ts` | Høflighet |
| Chris Wilson, «A Tale of Two Clocks» | Teknikk | Tidsstyringen i dirigenten | Høflighet |
| iMUSE (LucasArts, Michael Land og Peter McConnell) | Bare inspirasjon | Musikksystemet | «Inspirert av iMUSE. Ingen kode eller musikk er hentet derfra.» |
| Google Fonts: Metal Mania, Press Start 2P, VT323 | SIL Open Font License 1.1 | Lastes fra Google når spillet kjører, er ikke pakket inn | Høflighet |

### Dine egne repoer

| Repo | Lisensstatus | Hva LL tar eller kan ta |
|---|---|---|
| Morbidium | Lisens ikke valgt (README linje 59) | Musikksystemet, lydbanken, stemningen, skjermeffektene, bildeverktøyene. Inneholder kode fra andre (Cortiz og scottstts, begge MIT) som må krediteres hvis den tas med |
| Geometry 3044 | README sier MIT, LICENSE-filen mangler, `package.json` sier ISC | Zap-lyden, grunnlaget for lagspilleren, ytelsesmåleren |
| The Deep Ones | README sier MIT, LICENSE-filen mangler | Brun støy, måling av bildetid |
| guild-life-adventures | Ingen LICENSE-fil | Fugleflokk, CI-oppsett (senere) |
| state-shift-strategy | Ikke sjekket | Pause når fanen skjules (oppskrift) |

Du eier disse repoene, så du trenger ingen lisensfil for å bruke dem selv. Det er likevel ryddig å velge en lisens for Morbidium etter hvert. Om LL skal få sin egen LICENSE-fil, bestemmer du.

### Krediterer LL kildene i dag?

Nei. README har bare «Lisens og rettigheter», og den handler om studiologoen. Det betyr at:

- Morbidium bare nevnes i toppen av `tools/process_art.py`, `tools/make_templates.py`, `src/game/foes.ts` (linje 59) og `docs/ART_PROMPTS.md`
- filene som bygger på skill-pakken nevner «prosjektbiblioteket», men aldri Scott Sun eller MIT
- det bygde spillet (`dist/` og `dist-single/`) mangler lisensmerknaden for three.js

Det må gjøres fire ting:

1. Legg inn seksjonen under i README.
2. Sett `build.license` i `vite.config.ts`, slik at Vite skriver `THIRD_PARTY_LICENSES.md` for npm-pakkene.
3. Legg MIT-tekstene for skill-pakken og stylized-scene i `public/LICENSES/`, siden de ikke er npm-pakker.
4. Lag en CREDITS-skjerm i spillet, på engelsk, fra `src/data/credits.ts`, så også enkeltfil-bygget bærer kreditten.

### Forslag til README: «Gjenbruk og takk»

```markdown
## Gjenbruk og takk

Loincloth Legends bygger på kode og ideer fra Toms egne spill og fra åpne kilder.

**Toms egne prosjekter**
- Morbidium (Tombonator3000/morbidium): bildeverktøyene for ChatGPT-grafikk
  (maler, klipping, bakgrunn, sømmer og innboks i `tools/process_art.py` og
  `tools/make_templates.py`) og oppskriften på variasjon i fiendene
  (`src/game/foes.ts`).

**Kode og teknikker fra andre**
- Gresset og vinden (`src/gfx/env/meadow.ts`, `src/gfx/wind.ts`) er tilpasset fra
  stylized-meadow-grass i Threejs-Awesome-Graphics-Agent-Skills av Scott Sun (MIT),
  som bygger på dedekpo/stylized-scene (MIT). Pakken var også oppskrift for
  etterbehandling, sol og skygger, partikler og trær.
- three.js (MIT): motoren, Sky-tillegget og tonekurvene i `src/gfx/post.ts`.
- Hash etter Dave Hoskins, «Hash without Sine» (MIT).
- Ben Golus (whiteout-blanding), Felzenszwalb og Huttenlocher (`src/gfx/charlight.ts`)
  og mulberry32 (fri).
- Skrifttyper fra Google Fonts: Metal Mania, Press Start 2P og VT323
  (SIL Open Font License 1.1).

Lisenstekstene ligger i `public/LICENSES/` og i `THIRD_PARTY_LICENSES.md` i bygget.
```

Disse linjene legges til når delene er overført:

```markdown
- Musikksystemet (bytte på taktstreken, lag, dukking og innslag), lydbanken og
  stemningen er tilpasset fra Morbidium. Lagspilleren for syntlyd bygger på
  Geometry 3044, og den brune støyen på The Deep Ones.
- Musikksystemet er inspirert av iMUSE (LucasArts, Michael Land og Peter McConnell).
  Ingen kode eller musikk er hentet derfra. Tidsstyringen følger Chris Wilsons
  «A Tale of Two Clocks».
- Skjermdråper, sjokkbølger, varmeflimmer, årer ved lav helse og lyspoolen er
  tilpasset fra Morbidium.
- Lydopptak fra Freesound, alle CC0 1.0. Tittel, innspiller og lenke for hver fil står
  i `public/assets/sound/KILDER.md`.
- Slagverk fra Versilian Community Sample Library (VCSL) av Versilian Studios, CC0 1.0.
- Lavaen bygger på lava-flow-surface i samme skill-pakke (MIT), som er tilpasset fra
  sabosugis CodePen «Very Hot Planet» (MIT).
```

## 5. Hva vi ikke bør ta med

| Hva | Hvorfor |
|---|---|
| De melodiske VCSL-instrumentene i Morbidium (orgel, harpe, celesta, vibrafon, saksofon, piano med flere) | Feil klangpalett for et 80-talls metallband. Unntaket er orgel i Vorthax sin tronsal, og det er et stilvalg for deg |
| Besetning per rom, grammofonfilter og bytte av arrangement på taktstreken | Dette hører til sanatoriet i Morbidium. LL har ingen rom, og nattleiren har allerede sin egen ballade |
| Skrekkstemmene i Morbidium (skrik, hvisking, stønn) | Feil tone for LL. Et stønn til zombien kan vurderes senere |
| ReactiveMusicSystem fra 3044 | Takten telles i bilder og ikke på lydklokka. Et tempohopp på 60 BPM fra komboer ville ødelagt metallåtene. Schedulereren i LL er allerede bedre |
| Musikk-MP3-ene i 3044 (18,5 MB) og lydfilene i guild-life | Opphavet er ukjent, så de kan ikke føres i en kildeliste |
| Regnløkka i connect-play | Innspiller og lenke mangler |
| ElevenLabs-lydene i Voidcraft | AGPL-repo, og lydene er ikke CC0 |
| YuE (KI-musikk) | Vektene er CC BY-NC 4.0, og resultatet er ikke CC0. Modellen trenger et skjermkort med 24 GB og kan ikke kjøres her |
| Fottrinn og lignende fra Mythos-Quest-3D | Ikke bedre enn det LL har |
| Kunngjører med nettleserens stemmer | Den går forbi volumkontrollen, stemmene høres moderne ut, og den faller utenfor lydregelen. Trenger ditt ja først |
| Kuwahara-oljemaling, konturer, akvarell og tegneseriepreget vann | Kolliderer med «3D så ekte som mulig». Lisensen hos Maxime Heckel, som Kuwahara-koden bygger på, er ikke bekreftet |
| wet-puddle-rain og deformable-sand | GPL-3.0 |
| Kilder merket «MIT by project rule» uten observert lisens: r3f-gist, frozen, hologram, poseidon, FFTOCEAN, rocksdanister/rain | Ingen lisens er sett. rocksdanister/rain skal ikke brukes til blod på skjermen |
| VHS-filteret i 3044 | Skrevet for 2D-canvas og bryter med den seriøse, filmatiske stilen |
| Plassholderbilder laget fra dagens kodetegninger | Kodetegningene har blekkstreker og tegneseriepreg, og ville dratt ChatGPT bort fra den godkjente referansen |
| 256-fargers reduksjon fra Morbidium | Gir striper i fotorealistisk hud |
| Behandling av innboksen i CI slik Morbidium gjorde | LL holder originalene utenfor git med vilje. Morbidium måtte skrive om historikken for å bli kvitt 447 MB |
| Stilblokkene i Morbidium som navngir kjente spill | Bryter originalitetsregelen i prompter |
| Bildesekvenser og 9-delte UI-rammer | LL bruker partikler og CSS, og har ingen bruk for dem |
| Blod som renner på bakveggen, og blodige fotspor | Blodet når aldri veggen, og fotsporene er nesten usynlige med kameravinkelen i LL |
| Gress som trykkes flatt rundt figurene | Figurene går aldri i gresset |
| Promptoppskriftene fra Scenario og kamerafølging som er uavhengig av bildefrekvens | LL har allerede det første, og forskjellen fra det andre er for liten til å synes |
| Regn i stemningen, amb_brum og amb_hav | LL har ikke regn, sykehussurr eller hav |
| setTimeout-mønstrene i Morbidium og 3044 | LL bruker spilltid og lydklokka, så pause og slowmo virker |
| Kill-navn fra Unreal Tournament | Navnene må være LLs egne |
