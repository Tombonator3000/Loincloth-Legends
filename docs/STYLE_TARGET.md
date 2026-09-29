# Målbilde for grafikken

Tom delte konseptbilder 2026-09-29 som viser hvor spillet skal. Bildene ligger ikke i repoet (to av dem ser ut til å være andres verk, og repoet er offentlig). Dette er en beskrivelse av det de viser, så neste økt kan styre etter det samme.

## Retning (Tom, 2026-09-29)

- **Ikke tegneserie.** Seriøst og filmatisk, som fantasyfilmene fra 80-tallet spilt helt rett, men morsomt og fullt av parodier. Humoren skal ligge i replikker, situasjoner, navn og parodier på filmer og spill, ikke i at grafikken ser ut som en tegnefilm.
- **3D så ekte som mulig**: realistiske materialer (stein, jord, tre, jern, gull) med overflatedetaljer, lys og refleksjoner fra himmelen, skygger og skygge i kroker (ambient occlusion), luftperspektiv og tåke. Ingen svarte konturstreker på 3D-ting.
- Figurene er fortsatt 2D-deler, men skal se malte ut, ikke tegnet med tykk strek. Lyset fra 3D-verdenen faller på dem.

## Figurstil: nesten ekte karikatur (Tom, 2026-09-29)

Tom sendte et referansebilde av Valkyra og sa at både spillerfigurene og fiendene skal ha denne looken: en karikatur som er nesten ekte. Bildet ligger ikke i repoet (repoet er offentlig). Det viser:

- Nesten fotorealistisk overflate, som en påkostet 3D-render eller en statuett: hudporer, fregner, svette og en svak oljeglans, hår i enkeltstrå, rustne ringbrynjeringer, slitt lær med sømmer, ekte pels, hakkete stål.
- Karikerte former: stort hode med enorm vill kobberrød krøllmanke, tunge øyelokk med mørk sminke, tykke bryn, fyldige lepper i en selvgod trutmunn, store bryst, markert sixpack, svært tykke og muskuløse lår, store støvler og en overdimensjonert øks.
- Valkyra: store hoops i jern, lærchoker med kjede og et lite hodeskallesmykke med horn, ringbrynjebikini i rustent jern på lærremmer med en ring midt foran, bredt nagle-lærbelte med beinhodeskalle som spenne og en lang ringbrynjeflik foran, lærbånd rundt overarmen, piggete jernarmbeskyttere med pelskant, knehøye brune lærstøvler med tykk pelskant og jernspenner. Enhåndsøks med piggete blad, lærviklet skaft og jernring nederst.
- Lyset i bildet er mykt og jevnt forfra, uten hardt sidelys. Det passer spillet, som legger på sitt eget lys.
- Holdningen er selvsikker og litt frekk, spilt rett. Tydelig voksen.

Veien dit er PNG-deler laget med ChatGPT etter `docs/ART_PROMPTS.md` (stil-blokk, helfigur først, så delene med helfiguren som referanse). De tegnede figurene i koden er reserven og skal ligne så godt det går: den tegnede Valkyra har fått manken, øksa, pelsstøvlene og det selvgode blikket.

## Felles for alle bildene

- Sidescroller i Golden Axe-stil sett litt ovenfra, med tre spillere (P1, P2, P3) i bildet samtidig.
- Detaljert, malt 16-bit-uttrykk med mye lys og mørke: sterke varme lyskilder (fakler, fyrfat, lava) mot kalde (måne, lyn, tåke).
- Mørke, uskarpe silhuetter i forgrunnen nederst i bildet: pigger, hodeskaller, kors og steiner. De gir dybde og rammer inn kampen.
- Tåke og dis mellom dybdeplanene, glør og gnister i lufta.
- Våte gulv og vannpytter som speiler ild og lyn.
- Rikt med rekvisitter: hodeskaller overalt, filler av bannere med kultsymboler, lenker, søyler med hodeskaller, trapper, statuer, bur med skjeletter, spyd og totempæler.
- Blodsprut som lyser rødt ved treff, med gnister og splinter.
- Magi som store blå lyn som slår ned fra himmelen, og ildkuler.

## Figurene

- Lange, kraftige bein og enorme muskler som i konseptbildene, med karikaturens store hode og hår, store hender, tykke lår og store støvler (se over). Ikke chibi med små kropper.
- Barbar med blått lendeklede, pannebånd, pelsstøvler og langt hår.
- Kriger med langt, rødt hår i chainmail-bikini. Kurvete og muskuløs, tydelig voksen. Valkyra følger referansebildet over (pelsstøvler, ikke røde støvler).
- Dverg med hvitt skjegg, grønn hjelm med horn og en stor gyllen øks, gjerne på et ridedyr.
- Fiender: skjeletter med runde skjold, kultister i røde kapper med stav som kaster lyn, vikinger med hornhjelm og spyd, en demonprest med ild i hånda.
- Ridedyr: en rosa, fuglelignende øgle med nebb, og en rød drage med pigger og rustning.
- Alt må være originalt: samme sjanger og stemning, men egne navn og egen design (se AGENTS.md).

## Scenene

1. **Slottshall**: høye steinsøyler med hodeskaller, hengende lysekroner med ild, fyrfat, røde bannere med kultstjerne, trapp opp til en tronstatue med horn, stearinlys, blå lyn gjennom vinduene, vått steingulv.
2. **Ruiner i skumringen**: blodrød fullmåne, forfalne buer og en bro, fossefall, lilla himmel, høsttrær, fakler, ravner, et bur med et skjelett, gjørmete sti med vannpytter.
3. **Lavaland**: demonslott med horn, lavafall og lavaelv, svart stein, blodrød himmel, skjeletthauger, glør overalt.
4. **Tåkeskog**: bleke, tåkete trær i bakgrunnen, et stort vridd tre, klipper og steiner, dempede farger.

## HUD

- Portrett i gullramme per spiller, rød livsbar med gullkant, magikrukker som små fargede flasker (blå, røde, grønne), merke P1/P2/P3, gullteller oppe til høyre.

## Hva som er gjort mot målet

Se log.md. Kort: bildepipeline med bloom, gradering og dybdeskarphet, myke skygger, 3D-trær og gress med vind, tåkelag og lyssøyler, GPU-partikler og lyn, blod og gibs, heroiske proporsjoner og lys på figurene (fakler og lyn farger dem), HUD i konseptstil (gullramme, P1/P2, flasker, mynt), mørke silhuetter i forgrunnen og en nattleir med fullmåne. Realismerunden: fysisk himmel, miljøkart fra himmelen, SSAO, eksponentiell tåke, støybaserte teksturer med normalkart, 3D-steiner og hodeskaller, ingen konturer på 3D. Karikaturrunden: teksturer og himmel fra ChatGPT via manifestet, egen lysmodus for malte PNG-deler, hårmanke bak ryggen som egen del, og ny tegneinstruks i ART_PROMPTS.md.

Gjenstår mot målet: PNG-deler for helter og fiender i karikaturstil (Tom lager dem i ChatGPT), slottshall med lysekroner og vått gulv, ruiner med blodmåne og fossefall, demonslott med lavafall, bur og ravner, dverg-helt, tre spillere.
