# todo.md

## Pågår: 3D-effekter og 80-talls hyllest (runde fra 2026-09-29 12:59)
- [x] Bildepipeline med HDR, bloom, dybdeskarphet, gradering, vignett, korn og aberrasjon (src/gfx/post.ts)
- [x] Kvalitetsnivå i innstillingene (AUTO, LOW, MEDIUM, HIGH, ULTRA)
- [x] Mykt lys og skygger som følger kameraet
- [x] Vind, 3D-trær, gress og fallende blader, tåkelag og lyssøyler
- [x] Slå sammen statiske mesher per materiale (palisade, steiner, piler, staker): brett 1 fra 475 til 222 tegnekall på HIGH
- [ ] Biomene mot konseptbildene (docs/STYLE_TARGET.md): fakler og fyrfat, lyn, blodmåne, lavafall, demonslott, ruiner, fossefall, våte gulv, mørke silhuetter i forgrunnen
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
- [ ] PNG for ridedyr, kjæledyr og farer (prompter ligger i ART_PROMPTS.md)
- [ ] Rekvisitter og ikoner som PNG
- [ ] Vis tittelbilde og sjef-VS-kort fra assets
- [ ] Rydd opp geometri/materialer når scener byttes (liten minnelekkasje ved mange omstarter)
- [ ] Flere rekvisitter inn i staticGroup (telt, bannere, bål, tårnets møbler) for enda færre tegnekall
- [ ] Taleboblene og kunngjøringer bruker sanntid, ikke spilltid (merkes bare i slowmo)
- [ ] Flere kroppstyper i heltebyggeren (dverg, halvtroll, sint gnome)
- [ ] Opptil 4 spillere lokalt
- [ ] Tastebinding og CRT-filter i innstillingene
- [ ] Del opp JS-bunten (Three.js i egen chunk) hvis lastetiden blir et problem
- [ ] GitHub Actions: typecheck og bygg på hver push

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
