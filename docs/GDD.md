# LOINCLOTH LEGENDS
### Blood, Biceps & Bad Decisions

Et spill fra **Tom's Happy Happy Funtimes Emporium**. Game design dokument, versjon 0.3.

## 1. Pitch

En 2.5D fantasy-brawler der Castle Crashers møter Golden Axe, og der brettene ender med en sjef eller en brutal mann-mot-mann duell i stil med gamle Barbarian (C64/Amiga). Du lager din egen barbar med altfor store muskler og altfor lite tøy, rir på krigsvillsvin, kaster fiender i lava og reiser over et verdenskart med fem biomer. 80-tallets fantasyklisjeer med et blunk og altfor mye blod.

- Sjanger: Belt-scroller beat 'em up + 1v1 duell-fighter
- Plattform: Nettleser (Three.js + TypeScript) på PC og mobil, senere desktop (Electron/Tauri) eller Steam
- Spillere: 1 spiller, eller 2 spillere lokalt (samme tastatur eller gamepads)
- Tone: Tegneserie-gore. Blodet er rødt, rikelig og morsomt, aldri realistisk. Kan skrus ned til konfetti

## 2. Visuell stil (3D/2D hybrid)

- **Verden i 3D**: Lyssatt miljø med sol og skygger, prosedyrelagde 3D-trær og gress i vinden, tåkelag og HDR-bilde med bloom, dybdeskarphet og fargegradering per brett (målet er beskrevet i `docs/STYLE_TARGET.md`). Kamera fra siden med litt helning, som gir dybde (Golden Axe-beltet) og parallakse.
- **Figurer i 2D**: Papirdukke-rigger der hver kroppsdel er et eget tegnet plan. Delene kan falle av hver for seg.
- **Proporsjoner**: Heroiske kropper som på 80-talls fantasy-omslag: lange bein, brede skuldre og et hode som er litt for lite. Mennene har altfor store muskler (biceps som grapefrukt, sekspakk, bryst som skjold), damene har overdreven 80-talls-rustning og former (pelsbikini, ringbrynjebikini med røde støvler og "boob plate"). Alt i tegneseriestil med humor, tydelig voksne, aldri nakenhet. Alle har bittesmå lendeklær.
- **Lys på figurene**: Delene får normal- og glanskart laget fra tegningen (avrundede flater mellom blekkstrekene, olje på huden, blankt stål og gull). Figurene tar lys fra sol, himmel, fakler, lyn og eksplosjoner, får kantlys i motlys og kaster skygge (`src/gfx/charlight.ts`).
- **Grafikk**: Tegnes prosedyremessig i kode i dag. PNG-er fra ChatGPT kan erstatte del for del (se `docs/ART_PROMPTS.md`).
- **Gore**: Blodpartikler, gibs med fysikk, flekker som blir liggende, blodfontener, blod på skjermen, slowmo ved dødsstøt.

## 3. Spillflyt

1. Oppstartslogo: Tom's Happy Happy Funtimes Emporium (trommevirvel, sirkusfanfare, konfetti)
2. Tittelskjerm
3. **Hero Forge**: lag din helt (første gang du starter historien)
4. Intro-tekst
5. **Verdenskart**: gå mellom noder. Brett, arenaer og hjemborgen
6. **Brett**: bølger av fiender, farer, ryttere på ridedyr, så en finale (sjef eller duell)
7. Belønning: XP og nivåer, gull, nye deler i Hero Forge, nye steder på kartet
8. **Hjemborgen**: Hero Forge, butikk og trening
9. Siste brett: Vorthax i tårnet. Så slutt-skjerm, og kartet er åpent for mer vold

Menyen har også *Duel vs CPU*, *Duel P1 vs P2* og *Settings*.

## 4. Verdenskartet

Castle Crashers-inspirert 3D-kart over en øy. Heltene (og kjæledyrene) går langs stier mellom noder. Låste noder vises grå.

| Node | Type | Biom | Krever | Finale / motstander | Belønning |
|---|---|---|---|---|---|
| The Keep of Beginnings | Hjem | Gress | | Hero Forge, butikk, trening | |
| The Road of Mild Peril | Brett | Gress | | Sjef: Big Mama Hogmother | Warhammer |
| The Pit of Unfair Judgement | Arena (valgfri) | Gress | Road | Duell: Gorthak | Beast Skull-hjelm |
| The Swamp of Moist Regret | Brett | Sump | Road | Sjef: King Croakus | Krone |
| The Mirror Pool | Arena (valgfri) | Sump | Swamp | Duell: Dark You (ond tvilling) | Wizard Blue hårfarge |
| Frostbite Pass | Brett | Frost | Swamp | **Duell i stedet for sjef**: Frostjarl Kaldor | Great Helm, Frost Blue hud |
| The Trough of Honour | Arena (valgfri) | Frost | Frost | Duell: Sir Oinksalot | Gull |
| The Scorchlands | Brett | Vulkan | Frost | Sjef: Magmor the Molten | Gull |
| The Bone Coliseum | Arena (valgfri) | Vulkan | Scorch | Duell: Bonejangles | Spiked Club |
| Tower of Moderate Evil | Brett | Tårn | Scorch | Sjef: Vorthax | Slutten |

## 5. Biomer, farer og ryttere

| Biom | Stemning | Fiender | Fare | Ryttere |
|---|---|---|---|---|
| Gress (solnedgang) | Palisader, telt, bål, hodeskaller på stokker | Skeletons, Hogmen, Cultists, Potion Gnomes | Piggroper med blodige staker | Skjelett og hogman på krigsvillsvin |
| Sump | Tåke, råtne trær, siv, lysende sopp, ildfluer | Bog Zombies, Frogmen | Myr som suger ned | Frogman og zombie på kakatrisse |
| Frost | Snøfall, furutrær, iskrystaller, runesteiner | Frost Skeletons, Ice Trolls | Råk i isen | Frostskjeletter på villsvin og kakatrisse |
| Vulkan | Lavaelv, obsidianpigger, brennende trær | Fire Imps, Ember Skeletons | Lavapøler | Ildimp og glødeskjelett på magma-salamander |
| Tårn (innendørs) | Rødt teppe, søyler, hengende bur, onde plakater | Dark Cultists, Hog Guards, alt annet | Piggfeller i gulvet (spretter opp i takt) | Alle tre ridedyrene |

## 6. Sjefer

Sjefer er satt sammen av trekk med vekt og nedkjøling, og blir rasende ved halv HP (raskere og med nye trekk). De er urokkelige mot vanlige slag, men blir "staggered" etter nok skade. De kan ikke gripes, og de mister ikke armer.

| Sjef | Trekk | Rasende |
|---|---|---|
| Big Mama Hogmother | Kjøttøks, magestormløp, magaplask med sjokkbølger | Kaller inn hogmen og skjeletter |
| King Croakus | Septer, tunge som drar deg inn (og biter), byks, giftbobler | Kaller inn frogmen og zombier |
| Magmor the Molten | Lavanever, utbrudd med ildbølger, meteorregn, ildkuler | Tettere meteorregn |
| Vorthax | Stav, teleport bak deg, magiske kuler, lynregn, kaller inn undersåtter | Lynregn og mer fart |

## 7. Dueller (Barbarian-stil)

Brukes som finale i stedet for sjef (Frostbite Pass) og som valgfrie arena-noder på kartet.

| Input | Trekk | Høyde | Kommentar |
|---|---|---|---|
| Angrep | Slash | Midt | Rask, trygg |
| Opp + angrep | Overhead Chop | Høy | Treg, mye skade |
| Ned + angrep | Leg Sweep | Lav | Slår ned |
| Mot + angrep | Kick | Midt | Bryter blokk |
| Bort + angrep | Whirlwind of Poor Choices | Midt | Tre treff |
| Hopp + angrep (i lufta) | Flying Neck Chop | Høy | Treffer det ublokkert: halshugging |
| Hold spesial | Blokk høy/midt | | |
| Ned + spesial | Blokk lav/midt | | |
| Ned + hopp, eller grip | Rulle | | Unngår høye og midt-angrep |

Best av tre runder, 60 sekunder per runde (tiden ute: Vorthax zapper taperen). Med 2 spillere er dueller **tag team**.

Etter halshugging kommer Cleanup Imp og **sparker hodet rett mot kameraet**. Det klasker i skjermen med et vått smell, blir sittende litt, og sklir så sakte nedover med en hvinende sklilyd og en blodstripe etter seg. Så drar impen liket ut.

## 8. Teit vold

- **Hodet i skjermen**: i duellene hver gang, og av og til på brettene når en fiende halshugges.
- **"It's just a flesh wound"**: tunge slag kan kutte av en arm uten å drepe. Armen spretter avgårde som en ball (med fjærlyd), blodet spruter fra skulderen, og figuren roper at det bare er et kjøttsår. Mister han våpenarmen også, blir det bare spark ("I'LL KICK YOU TO DEATH THEN!"). Heltene mister bare bakarmen på brettene, og den gror ut igjen når de spiser kylling.
- **Hodeløs kylling**: noen halshuggede fiender løper rundt og spruter blod en stund før kroppen skjønner det.
- **Miljødrap**: spiddet på staker, sugd ned i myra, frosset i råken, forkullet i lava, piggfelle i gulvet. Gir bonusgull og XP.

## 9. Hero Forge (heltebygger)

Mann eller dame, og alle deler kan kombineres fritt:

| Kategori | Valg |
|---|---|
| Kropp | Male, Female |
| Hud | 7 toner, inkludert Orc Green og Frost Blue (låses opp) |
| Ansikt | Grim, Battle Cry, Unhinged, Eyepatch, Smug |
| Hår | Bald, Wild, Long, Mohawk, Braids, Ponytail, Topknot (7 farger) |
| Skjegg | None, Stubble, Full, Braided, Mustache |
| Hodeplagg | None, Horned, Winged, Beast Skull*, Crown*, Great Helm*, Headband |
| Rustning | Bare, Fur Mantle, Leather, Chainmail, Plate |
| Hofte | Fur Loincloth, Kilt, Battle Skirt, Tassets (alle bittesmå) |
| Bein | Fur Boots, Leather Boots, Greaves, Sandals |
| Våpen | Sword, Axe, Warhammer*, Spiked Club* |
| Tøyfarge | 7 farger |
| Magi | Meteor Storm, Ancestral Scream |

\* Låses opp på kartet eller kjøpes i butikken. Presets: Thrugg og Valkyra.

## 10. Mekanikk på brettene

- Bevegelse i X og Z (dybde), hopp i Y
- Combo: angrep x3 (hugg, bakhånd, tungt hugg som slår ned)
- Hoppangrep, løp (dobbelttrykk) og skulderdytt, juggling i lufta
- **Grep og kast**: grip-knappen tar tak i en fiende. Angrep = kne (tredje gang kastes han), retning + angrep eller hopp = kast. Den kastede fienden velter andre fiender (bowling: STRIKE!) og dør hvis han lander i en fare. Store beist og sjefer er for tunge.
- **Ridedyr**: slå rytteren av, gå bort til dyret og trykk grip for å sitte opp. Angrep bruker dyrets angrep, grip hopper av. Treff kaster rytteren av. Etter tre avkastinger stikker dyret av.
  - War Hog: stormløp som spidder alt foran seg
  - Cluckatrice (halvt hane, halvt øgle): halesvip som treffer begge sider
  - Magma Newt: ildpust som griller alt foran
- Magi: blå potions fra gnomer, alle brukes på én gang (sterkere jo flere, og sterkere med MAG)
- Berserk-spinn uten potions, koster litt HP
- Pickups: stekt kylling, halvspist skinke, potions, gull, egg fra kampkyllingen
- Kameraet låses per bølge. GO-pil når bølgen er ryddet

## 11. Nivåer, butikk og kjæledyr

- **XP** fra drap (mer for miljødrap), sjefer, dueller og fullførte brett. XP deles likt i co-op. Litt XP blir med selv ved game over.
- **Nivåer** gir poeng i STR (skade), DEF (tåler mer, mer HP), MAG (sterkere magi, starter med potions) og AGI (fart og raskere slag). Maks 10 i hver.
- **Butikken** (YE OLDE SHOPPE) i hjemborgen: ekstra liv og potions til neste brett, muskelmanual (+1 poeng), glemselsdrikk (nullstill poeng), kjæledyr og deler til Hero Forge.
- **Kjæledyr** følger helten og kan byttes i trening:

| Kjæledyr | Evne |
|---|---|
| Eyeball of Greed | Suger til seg gull fra hele skjermen |
| Rabid Rat | Løper bort og biter fiender i ankelen |
| Sarcastic Skull | Fornærmer fiender så de blir stående og gråte |
| Battle Chicken | Legger helbredende egg når helten er skadet |
| Tiny Dragon | Spytter ildkuler |

## 12. Innstillinger

Gore (FAMILY, NORMAL, EXCESSIVE, PLEASE SEEK HELP), musikk, lydeffekter, skjermristing, gamepad-rumble, berøringskontroller (auto, på, av) og fullskjerm. FAMILY gjør blod om til konfetti og gibs til gummiender.

## 13. Humor

- Fiender roper replikker når de dukker opp og dør
- Drapsteller: CARNAGE, MASSACRE, EXCESSIVE, PLEASE SEEK HELP, THE BARD WILL SING OF THIS
- Prinsessen kjeder seg og holder et BORED-skilt
- Vorthax er bare "moderat" ond, baker som hobby, og har motiverende plakater i tårnet
- Sjefene har sine egne replikker ved start, raseri og død
- Butikkeieren: "NO REFUNDS. NO QUESTIONS. NO PANTS."

## 14. Lyd

Alt syntetisert i WebAudio: sverdsus, treff, splat, klang, tegneserie-skrik (ulik stemme per figurtype), mynter, gong, publikum, fjærlyd for armer, vått smell og skli-hvin for hodet i skjermen, ild, plask, fres, sirkusfanfare for studiologoen. Enkel 80-talls synth-musikk. M slår lyd av/på.

## 15. Kontroller

| | Spiller 1 | Spiller 2 | Gamepad |
|---|---|---|---|
| Bevegelse | WASD | Piltaster | Stikke / D-pad |
| Angrep | F (eller J) | , (eller Numpad 1) | X / RT |
| Hopp | G (eller K) | . (eller Numpad 2) | A |
| Spesial/blokk | H (eller L) | - (eller Numpad 3) | B / LB / LT |
| Grip/kast/ri | R (eller U) | Høyre Shift (eller Numpad 0) | Y / RB |
| Pause | P / Esc | | Start |

Med én gamepad i 2-spiller er gamepaden spiller 2. **Mobil og nettbrett**: flytende stikke til venstre, knappene HIT, JUMP, MAGIC og GRAB til høyre, pause oppe til høyre. Spillet ber deg snu telefonen på siden.

## 16. Flere forslag

Gjennomført fra forrige runde: ridedyr, grep og kast med miljødrap, gore-innstilling, butikk og nivåer, kjæledyr, farer i brettene, berøringskontroller.

Videre:
1. **Henrettelser**: når en fiende er svimmel og har lite HP, gir spesial + angrep et eget dødsstøt per våpen.
2. **Publikumsgunst i duellene**: hån og stilige drap fyller en måler. Fullt publikum kaster mat eller et nytt våpen inn i arenaen.
3. **Endeløs arena**: overlev bølge etter bølge i gropa, med lokal toppliste.
4. **Hemmeligheter**: en skjult gnomekonge, "The Ham Dimension", og en bard som synger om drapene dine.
5. **Co-op-gjenoppliving**: bær en falt partner til et alter, eller del kyllingen.
6. **Flere kroppstyper**: dverg, halvtroll, og en helt som bare er en veldig sint gnome.
7. **Online co-op** og Steam Deck.
