# todo.md

## Hero Forge: felles pool av malte deler (2026-09-30)
- [x] Finn årsaken til at malte deler forsvant ved endring av preset; kontroller alle 143 grunnfiler
- [x] 44 uavhengige delvalg i katalogen, med miniatyrer, bakhår fra valgt hode og samme figur i forhåndsvisning og kamp
- [x] Lagre blandinger for begge spillere, bevare gamle helter og klassisk modus, beholde opplåsinger og riktige våpenegenskaper
- [x] Innlesing og kontroll av ekstra `forge_*`-deler uten å svekke kontrollen av de 143 grunnfilene
- [x] Lag de 13 nye delene i `docs/HERO_FORGE_GRAFIKK.md`, inkludert krigshammeren; registrer hvert bilde i manifest og delkatalog
- [ ] Egne ansikts-, hår-, skjegg- og hjelmlag samt masker for hud/hår/tøy
- [x] Visuell finjustering av de 13 nye delene i fire blandede helter og fire poser: hodehøyde, torsoanker, beltefeste, bakarm og våpengrep
- [x] Andre tillegg i delkatalogen: ti orc-/frostdeler, sabel og beinklubbe, med kroppstype, våpenklasse og eksisterende opplåsinger
- [x] Fullfør bildeinnlesing og visuell kalibrering av de tolv orc-/frost-/våpendelene; kontroller skulder, nakke, hofte og våpengrep i blandede poser
- [x] Kontroller hele pakken med 168 bilder, 44 delvalg, frostlåsen og beinklubbelåsen i nettleseren

## Menyene (fra 2026-09-30 07:38)
- [x] Tittelen fra åtte til fire knapper (STORY og DUEL med venstre/høyre, HERO FORGE, OPTIONS)
- [x] Innstillingene i grupper (gore, SOUND, SCREEN, CONTROLS), ERASE SAVE bare fra tittelen
- [x] Forklaringen til valgt rad i ett felt under menyen, navn til venstre og verdi til høyre i lister, treningspoeng som ruter
- [x] Kontrollskjermen i tre sider (tastene, brettene, duellene) med tastetegn og gamepad-knapper i farger, "/ OR -" for spiller 2
- [x] Tre spillknapper (angrep, hopp, spesial): grep og ridning ved å gå inn i fienden eller dyret, ned + hopp av dyret (tools/tests/buttons.mjs)
- [ ] Tom: spill og si om grepet kommer for lett eller for tungt (i dag 0,12 s inntil fienden, AUTO_GRAB i game/grab.ts)
- [ ] HUD-en: større og tydeligere tall og navn (livene, gullet og METAL-måleren er små)

## Ekte instrumenter i musikken (fra 2026-09-30 08:10)
- [x] Trommer, gitar og bass fra Karoryfer (CC0) spilt av bandet, synth som reserve (tools/tests/instruments.mjs)
- [x] Tom hørte ikke forskjell: egne forsterkere med mindre gain for gitarene, egen basskjede, trommer med EQ, panorering og rimshot, og trommene 4 til 6 dB over synthtrommene
- [x] Tom: rytmegitaren låt fortsatt syntetisk. Ny el-gitar (Emilyguitar, humbuckere), ny forsterkermodell med 4x12-kabinett (core/guitaramp.ts), anslag fra dyp til lys streng, dobbeltinnspilling med ulike opptak, palm mute med dempede strenger
- [ ] Tom: lytt på gitar-1 til gitar-4 (først synth eller forrige versjon, så den nye) og si hva som skal justeres: mer eller mindre forvrengning, mer bunn eller mer diskant
- [ ] Nattlåta er 2 dB svakere med opptakene: lange akkorder (nesten 3 s) klinger ut på en ekte gitar og bass, synthen holder nivået. Vurder mer sustain (kompressor foran forsterkeren) hvis Tom vil
- [ ] Leadgitaren: toner over 2,4 s spilles av synthen; vurder opptak med mer sustain

## Frostpasset som konseptbilde 4 (fra 2026-09-29 22:23)
- [x] Kameraet nærmere og lavere (gfx/stagecam.ts), og det trekker seg bakover når en kjempe er i bildet
- [x] Avalanche Troll: kjempe med rustning til han vakler, bakkeslag som rister, midtveis i frostpasset (tools/tests/giant.mjs)
- [x] Blåtimen: dypblå himmel med varmt bånd i horisonten, blå tåke, ny gradering
- [x] Klippevegger med snø, fossefall med dis, taubro, ruiner, fyrfat med ild, lys og varmeflimmer, fillete krigsbannere med hornet hodeskalle, runesteiner i 3D (noen gløder), istapper, taugjerde, snø på steinene, snøføyke og tettere snøfall
- [x] Trollets seks ChatGPT-deler (troll_*.webp). Kjempetrollet arver delene og får samme stil
- [ ] Krigsbanneret som eget bilde fra ChatGPT (trenger en ny kategori i process_art.py, ikke flisbar tekstur)
- [x] Gameplay fra bildet: kast fiender i juvet (opp + kast), istapper som faller, fyrfat som kan veltes med glør og brann, kjempen griper og kaster helter, panikk (tools/tests/frostplay.mjs)
- [x] Fiender som rygget ut av bildet og var for raske: rygger på halv fart og blir i bildet (Tom meldte fra)
- [x] Heltene og ridedyrene stopper foran taugjerdet ved juvet, ikke mellom gjerdet og stupet
- [ ] Tom: spill frostpasset og si fra om balansen (hvor ofte istapper faller, hvor lenge glørne brenner, hvor ofte kjempen griper, hvor ofte panikk)
- [ ] Juv og fallende stein i andre biomer, og at en kastet helt velter fiender han treffer
- [x] Flere lyder: snøtrinn og fottrinn per underlag, isknak, vindkast, fossesus, trollbrøl, krigshorn, ulv, sverdklang og publikum (21 nye CC0-opptak, tools/make_sounds.py)
- [x] Stemmemanus for VoiceStudio (docs/STEMMER.md, 175 replikker) og innlesing i spillet (audio.voice, voice/inbox/, make_sounds.py --stemmer)
- [ ] Tom: lag replikkene i VoiceStudio, prioritet A først (fortelleren, utropene, sjefene og kjempetrollet)

## Gjenbruk fra Morbidium (docs/GJENBRUK.md)
- [x] Lydbank med CC0-opptak, torden og zap, dukking, stemning per biom, fanfarer for drapsrekker, RECORDED SOUNDS
- [x] Dirigent: låtbytte på taktstreken med bro, intensitetslag, METAL MODE, sjef, seier, tap og innslag i takt
- [x] Skjermeffekter: dråper på glasset, sjokkbølger, dykk, årer, varmeflimmer, brennende kant, FLASHES og SCREEN DISTORTION
- [x] Automatisk grafikkvalitet, gjenoppretting av WebGL, ?perf, lyspool uten blinking, sårede drypper blod, SSAO lar lava lyse
- [x] Bildeverktøy og maler for ChatGPT, fiendevariasjon, kreditering (README, public/LICENSES, THIRD_PARTY_LICENSES.md)
- [ ] Tom: lytt på musikken og lydene på ekte høyttalere og si hva som skal justeres
- [ ] Senere fra rapporten: ro (musikken trekker seg tilbake), seierslåt som slutter, lyder fra riktig side, lava som flyter, varsel på bakken før angrep, fugleflokker, mose på steiner, Playwright i CI (fottrinn per underlag, sverdklang, publikum, ulv, krigshorn, snø på steiner og stemmemanus er gjort)
- [ ] CREDITS-skjerm i spillet (src/data/credits.ts), så også enkeltfil-bygget bærer krediteringen

## Pågår: nesten ekte karikatur (Toms Valkyra-bilde, fra 2026-09-29 17:05)
- [x] Ny tegneinstruks i docs/ART_PROMPTS.md: stil-blokk for nesten ekte karikatur, helfigur først, delene med helfiguren som referanse, HAIRBACK for langt hår, nye Thrugg- og Valkyra-prompter
- [x] Teksturliste for 3D-verdenen (tekstur-blokk, 20 navn pluss is- og beinarena) og teksturer fra manifestet i spillet (texFile, imageTexture)
- [x] Himmelbilde fra manifestet går foran den fysiske himmelen
- [x] Egen lysmodus for malte PNG-deler (ingen blekkfurer, relieff fra lysheten, hud fra fargetonen)
- [x] Hårmanke bak ryggen som egen PNG-del (hairback)
- [x] Den tegnede Valkyra etter referansen: vill kobberrød manke (ny frisyre MANE), selvgodt blikk, øks, pelsstøvler, uten pannebånd
- [x] Valkyras sju deler i samme stil, med ankere for hår, hode og lendeklede
- [x] Alle 28 teksturer, åtte himler og verdenskartet i manifestet
- [x] Thrugg og alle fiendene i samme stil (PNG-deler)
- [x] Visuell kontroll av alle sammensatte figurer med kunstpakken lastet: våpnene satt ved siden av neven og Thrugg manglet den bakre armen. Armene rettes nå etter neven, grepet finnes på skaftet (tools/tests/artcheck.mjs)
- [ ] Ridedyr og kjæledyr med kunstpakken: se på dem i nettleseren (artcheck dekker bare figurer med armer)
- [x] Slag med venstre museknapp på brett og i dueller (2026-09-30)
- [x] Fiende-ryttere holder seg innen rekkevidde og kan tas, og de angriper nå (2026-09-30, tools/tests/riders.mjs)
- [ ] Balansetest av fiende-ryttere i ekte spill: de angriper nå for første gang, så sjekk at bølgene med ryttere ikke er blitt for harde
- [x] Armene i trekvart profil: våpenarmen på den nære skulderen foran, hodet bak overkroppen, skulderledd og halsrot fra bildene, stillingene rettet så slagene når fram (2026-09-30)
- [x] Heltesmia bruker en felles delpool: 44 valg, inkludert 25 Forge-bilder. Kalibrering og kontroll av siste tillegg står over; egne hår-, hjelm- og fargelag er fortsatt senere utvidelser
- [x] Malt stridshammer: `forge_warhammer_weapon.webp`, med WARHAMMER-egenskaper og eksisterende opplåsingskrav
- [ ] Nye bilder fra GPT: hogmother_torso (kuttet i høyre kant), imp_arm (tynnere enn skulderkula), gorthak_arm (smalere hette enn platen), og på sikt overkropper uten halsstump (docs/GPT_BESKJED.md)
- [x] docs/maler/mal_figur.png har merker for halsroten (uten hals) og den nære og den fjerne skulderen på overkroppen
- [ ] Enhåndsøks som eget våpen (Valkyras øks har ett blad, spillets AXE har to)
- [ ] Hårmanken svaier i vinden (hairback og den tegnede manken)

## Realismerunden (fra 2026-09-29 15:46)
- [x] Ingen konturskall på 3D, støyteksturer med normalkart, triplanar overflatedetalj, 3D-steiner, 3D-hodeskaller og fjell av støy
- [x] Fysisk himmel med skyer (grass, swamp, frost), miljøkart fra himmelen, eksponentiell tåke og SSAO
- [x] Malte konturer og tynnere strek på figurene (paintInk, INK_W)
- [ ] SSAO og miljøkart i tårnet, arenaene og nattleiren (bruker fortsatt gradientehimmel)
- [ ] Vått gulv og pytter som speiler fakler og lyn (skjermrom-refleksjon eller planar speil)

## Pågår: 3D-effekter og 80-talls hyllest (runde fra 2026-09-29 12:59)
- [x] Bildepipeline med HDR, bloom, dybdeskarphet, gradering, vignett, korn og aberrasjon (src/gfx/post.ts)
- [x] Kvalitetsnivå i innstillingene (AUTO, LOW, MEDIUM, HIGH, ULTRA)
- [x] Mykt lys og skygger som følger kameraet
- [x] Vind, 3D-trær, gress og fallende blader, tåkelag og lyssøyler
- [x] Slå sammen statiske mesher per materiale (palisade, steiner, piler, staker): brett 1 fra 475 til 222 tegnekall på HIGH
- [ ] Biomene mot konseptbildene (docs/STYLE_TARGET.md): lyn, blodmåne, lavafall, demonslott, våte gulv (fyrfat, ruiner, fossefall og forgrunn er gjort i frostpasset, rekvisittene i env/props.ts kan brukes i de andre)
- [x] Heroiske proporsjoner på figurene (lange bein og armer, høyere overkropp, mindre hode)
- [ ] Dverg-helt (kroppstype i heltebyggeren, gyllen øks som i konseptbildet)
- [ ] Damekroppen: smalere liv og bredere hofter (i dag er silhuetten nesten lik mannens)
- [x] HUD i konseptstil: portretter i gullramme med P1/P2, livsbar med gullkant, krukker som flasker, mynt ved gullet
- [x] Mørke silhuetter i forgrunnen i alle brett, lyn bak kjempene på tittelskjermen
- [x] Partikkelsystem på GPU med pooler og HDR-emisjon, lyn, eksplosjoner og lyspool
- [x] Realistisk blodsprut, flekker med våt glans, pytter som vokser og 3D-gibs
- [x] 80-talls figurer: ringbrynjebikini (topp og truse), røde støvler, Valkyra-preset, større brystrustning
- [x] Lys på figurene: relieffkart fra tegningene, oljeglans på huden, blankt stål og gull, kantlys i motlys, farget lys fra fakler, lyn og eksplosjoner, skygger fra sola
- [ ] Kapper, hår og lendeklær som svaier i vinden (egne deler med vind fra gfx/wind.ts)
- [ ] Figurene tar imot skygge fra miljøet (trær og vegger), uten at de skygger på seg selv
- [ ] Miljøbalanse for figurlyset: svakere himmel- og nøkkellys der fakler og lyn skal farge figurene (arena, tårn, lava)
- [x] 1980s heavy metal: syntetisert metal-band, egen låt per brett, stingere, MUSIC STYLE (metal eller 8-bit) i innstillingene
- [x] METAL MODE: måler, gitarsolo, falsettskrik, brennende våpen, skadebonus og lyn
- [ ] METAL MODE i duellene (egen måler per side?) og et eget sjefsriff
- [ ] Tittelskjerm som et albumomslag fra 1985 (krom-logo, lyn, blodmåne)
- [ ] Lytt gjennom metal-miksen på ekte høyttalere og juster (Tom)
- [x] Gameplay-hyllest: tordenmagi (Golden Axe), sjonglering i lufta (Castle Crashers), B-film-replikker, nattleir med tyvnisser (Golden Axe)
- [ ] Mer hyllest: Barbarian-hopp med flygende halshugging i duellene, hesteløp eller dragetur, sluttkamp med skjelettvakter som i Golden Axe
- [ ] Nattleiren: tyvene burde snike seg inn mens heltene sover (i dag løper de bare forbi), og en egen sovepose-animasjon

## Pågår
- [ ] Lokalt: bytt ut den utpakkede mappen ~/Utvikling/Loincloth-Legends med en klone av repoet. Mappen har ikke git og har eldre utgaver av log.md, todo.md og memory.md, så den skal ikke pushes fra.
- [ ] Spilltesting med ekte mennesker: balanse på Gorthak (runde 2 og 3 kan være harde), fiendeskade, antall bølger, priser i butikken og XP-kurven

## Neste
- [ ] Balansetest av sjefene med ekte spillere (HP, skade, nedkjøling)
- [ ] Balansetest av ridedyr (stormløpet kan være for sterkt) og kjæledyr (Tiny Dragon og Rabid Rat)
- [ ] Test på ekte telefoner og nettbrett (iOS Safari og Android Chrome): berøringskontroller, lyd etter første trykk, ytelse
- [ ] Test med ekte gamepads (Xbox, PlayStation, Switch Pro, 8BitDo): knappeoppsett og rumble
- [ ] Henrettelser: spesial + angrep på en svimmel fiende med lite HP gir et eget dødsstøt per våpen
- [ ] Publikumsgunst i duellene (hån og stilige drap fyller en måler)
- [ ] Endeløs arena med lokal toppliste
- [ ] Hemmeligheter: gnomekonge, The Ham Dimension, bard som synger om drapene
- [ ] Co-op-gjenoppliving
- [ ] Koble inn heltebygger-lag som PNG (hår, hjelm, skjegg osv., se ART_PROMPTS.md "Planlagt")
- [x] PNG-deler for alle tre ridedyr og alle fem kjæledyr
- [ ] PNG for farer (prompter ligger i ART_PROMPTS.md)
- [ ] Rekvisitter og ikoner som PNG
- [ ] Vis tittelbilde og sjef-VS-kort fra assets
- [ ] Rydd opp geometri/materialer når scener byttes (liten minnelekkasje ved mange omstarter)
- [ ] Flere rekvisitter inn i staticGroup (telt, bannere, bål, tårnets møbler) for enda færre tegnekall
- [ ] Taleboblene og kunngjøringer bruker sanntid, ikke spilltid (merkes bare i slowmo)
- [ ] Flere kroppstyper i heltebyggeren (dverg, halvtroll, sint gnome)
- [ ] Opptil 4 spillere lokalt
- [ ] Tastebinding og CRT-filter i innstillingene
- [ ] Del opp JS-bunten (Three.js i egen chunk) hvis lastetiden blir et problem
- [x] GitHub Actions: typecheck og bygg på hver push, og publisering til GitHub Pages når Pages er slått på
- [x] Tom: slå på GitHub Pages (Settings > Pages > Source > GitHub Actions), så kan spillet spilles på https://tombonator3000.github.io/Loincloth-Legends/ (er på, hver push til main publiserer)
- [x] Oversett den norske teksten i menyene og kontrollskjermen til engelsk (2026-09-30: tittel, kontroller, hopp over og fortsett, menyhint, innstillinger, heltesmia, kartet og leiren)
- [ ] CI: sjekk Pages med API (bare 404 betyr av), flytt actions til Node 24-versjonene (checkout@v5, setup-node@v5, upload-pages-artifact@v5, configure-pages@v6, deploy-pages@v5)
- [ ] Hofteankeret: finn beltet automatisk også i høyden (i dag må lange flik måles med MEASURE i ChatGPT)

## Ferdig
- [x] Vertikal slice: brett 1 + duell + menyer (2026-09-29)
- [x] 8 prosedyretegnede figurer med cutout-rigg
- [x] Gore-system med lemlestelse, gibs, fontener og blodflekker
- [x] Barbarian-duell med halshugging og CPU-AI
- [x] 2 spillere lokalt (co-op + PvP i gropa)
- [x] Syntetisert lyd og musikk
- [x] Single-file bygg og Artifact-eksport
- [x] Modulær, datadrevet arkitektur (2026-09-29)
- [x] Verdenskart med 10 noder og lagring
- [x] Fem biomer og fem brett
- [x] Fire sjefer med egen AI
- [x] Duell som finale og valgfrie arena-dueller, tag team
- [x] Hero Forge med opplåsbare deler
- [x] PNG-laster og grafikkliste til ChatGPT
- [x] Duell-modus bruker heltene fra Hero Forge i stedet for fast Thrugg
- [x] Playwright-tester oppdatert til v0.2 (story, scenarios, ai)
- [x] Overdrevne proporsjoner: stort hode, altfor store muskler, bittesmå lendeklær (v0.3, 2026-09-29)
- [x] Teit vold: impen sparker hodet i skjermen, armer ryker av (JUST A FLESH WOUND), hodeløse fiender løper rundt
- [x] Grep og kast, bowling og miljødrap
- [x] Farer i brettene: piggrop, myr, råk, lava, piggfelle
- [x] Ridedyr (War Hog, Cluckatrice, Magma Newt) og fiender som kommer ridende
- [x] Gore-innstilling og innstillingsmeny (gore, lyd, risting, rumble, berøring, fullskjerm)
- [x] Butikk (YE OLDE SHOPPE), XP, nivåer og STR/DEF/MAG/AGI
- [x] Fem kjæledyr
- [x] Berøringskontroller på mobil og nettbrett
- [x] Gamepad med standard mapping og rumble
- [x] Oppstartslogo for Tom's Happy Happy Funtimes Emporium
- [x] Playwright-tester for alt det nye (lineup, closeup, violence, grab, mounts, mountride, progress, pets, mobile, gamepad, splash, settings)
- [x] Klargjort for GitHub (.gitignore, AGENTS.md, CLAUDE.md, versjon 0.3.0, commit klar)
- [x] Koden ligger på GitHub (main), pakket ut fra zip-en. Typecheck, bygg og røyktest ok (2026-09-29)
