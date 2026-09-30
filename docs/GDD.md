# LOINCLOTH LEGENDS
### Blood, Biceps & Bad Decisions

Et spill fra **Tom's Happy Happy Funtimes Emporium**. Game design dokument, versjon 0.3.

## 1. Pitch

En 2.5D fantasy-brawler der Castle Crashers møter Golden Axe, og der brettene ender med en sjef eller en brutal mann-mot-mann duell i stil med gamle Barbarian (C64/Amiga). Du lager din egen barbar med altfor store muskler og altfor lite tøy, rir på krigsvillsvin, kaster fiender i lava og reiser over et verdenskart med fem biomer. 80-tallets fantasyklisjeer med et blunk og altfor mye blod.

- Sjanger: Belt-scroller beat 'em up + 1v1 duell-fighter
- Plattform: Nettleser (Three.js + TypeScript) på PC og mobil, senere desktop (Electron/Tauri) eller Steam
- Spillere: 1 spiller, eller 2 spillere lokalt (samme tastatur eller gamepads)
- Tone: seriøs og filmatisk, som 80-tallets fantasyfilmer spilt helt rett, men full av humor og parodier. Blodet er rødt, vått og rikelig, over the top. Kan skrus ned til konfetti

## 2. Visuell stil (3D/2D hybrid)

- **Verden i 3D, så realistisk som mulig**: realistiske materialer med overflatedetaljer og ingen konturstreker, lys og refleksjoner fra himmelen, skygge i kroker, sol og skygger, prosedyrelagde 3D-trær og gress i vinden, tåkelag og HDR-bilde med bloom, dybdeskarphet og fargegradering per brett (målet er beskrevet i `docs/STYLE_TARGET.md`). Kamera fra siden med litt helning, som gir dybde (Golden Axe-beltet) og parallakse.
- **Figurer i 2D**: Papirdukke-rigger der hver kroppsdel er et eget plan. Delene kan falle av hver for seg. Målet er nesten ekte karikatur (Toms Valkyra-bilde, se `docs/STYLE_TARGET.md`): ekte materialer og overdrevne former, aldri tegneserie.
- **Proporsjoner**: Heroiske kropper som på 80-talls fantasy-omslag: lange bein, brede skuldre og et hode som er litt for lite. Mennene har altfor store muskler (biceps som grapefrukt, sekspakk, bryst som skjold), damene har overdreven 80-talls-rustning og former (pelsbikini, ringbrynjebikini med røde støvler og "boob plate"). Tydelig voksne, aldri nakenhet. Alle har bittesmå lendeklær.
- **Lys på figurene**: Delene får normal- og glanskart laget fra tegningen (avrundede flater mellom blekkstrekene, olje på huden, blankt stål og gull). Figurene tar lys fra sol, himmel, fakler, lyn og eksplosjoner, får kantlys i motlys og kaster skygge (`src/gfx/charlight.ts`).
- **Grafikk**: Tegnes prosedyremessig i kode i dag. PNG-er fra ChatGPT kan erstatte del for del, og flisbare teksturer fra ChatGPT kan erstatte bakke, vei, murer og gulv i 3D-verdenen (se `docs/ART_PROMPTS.md`). Malte PNG-deler får egen lysmodus, og langt hår kan henge bak ryggen som egen del.
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

Tittelmenyen har fire knapper: *Story* (1 eller 2 spillere, velges med venstre/høyre på raden), *Duel* (mot CPU eller spiller 2, på samme måte), *Hero Forge* og *Options* (gore, lyd, skjerm, kontroller og sletting av lagringen). Forklaringen til valgt knapp står under menyen.

## 4. Verdenskartet

Castle Crashers-inspirert 3D-kart over en øy. Heltene (og kjæledyrene) går langs stier mellom noder. Låste noder vises grå.

| Node | Type | Biom | Krever | Finale / motstander | Belønning |
|---|---|---|---|---|---|
| The Keep of Beginnings | Hjem | Gress | | Hero Forge, butikk, trening | |
| The Road of Mild Peril | Brett | Gress | | Sjef: Big Mama Hogmother | Warhammer |
| The Pit of Unfair Judgement | Arena (valgfri) | Gress | Road | Duell: Gorthak | Beast Skull-hjelm |
| The Swamp of Moist Regret | Brett | Sump | Road | Sjef: King Croakus | Krone |
| The Mirror Pool | Arena (valgfri) | Sump | Swamp | Duell: Dark You (ond tvilling) | Wizard Blue hårfarge |
| The Night Camp | Brett (valgfritt) | Natt | Swamp | Overlev til daggry (tyvnisser) | Gull, krukker til neste brett |
| Frostbite Pass | Brett | Frost | Swamp | **Duell i stedet for sjef**: Frostjarl Kaldor | Great Helm, Frost Blue hud |
| The Trough of Honour | Arena (valgfri) | Frost | Frost | Duell: Sir Oinksalot | Gull |
| The Scorchlands | Brett | Vulkan | Frost | Sjef: Magmor the Molten | Gull |
| The Bone Coliseum | Arena (valgfri) | Vulkan | Scorch | Duell: Bonejangles | Spiked Club |
| Tower of Moderate Evil | Brett | Tårn | Scorch | Sjef: Vorthax | Slutten |

**Nattleiren** er en hyllest til leiren mellom brettene i Golden Axe. Heltene sover ved bålet med to ekstra krukker hver. Tyvnisser løper forbi og napper krukker (YOINK!, høyst to hver), og et slag får dem til å miste alt de har tatt (GIVE THAT BACK!). Når siste nisse er borte, gryr det (DAWN BREAKS), og krukkene heltene har igjen blir forsyninger til neste brett (to krukker per forsyning). Egen låt: NIGHT WATCH, en seig metal-ballade.

## 5. Biomer, farer og ryttere

| Biom | Stemning | Fiender | Fare | Ryttere |
|---|---|---|---|---|
| Gress (solnedgang) | Palisader, telt, bål, hodeskaller på stokker | Skeletons, Hogmen, Cultists, Potion Gnomes | Piggroper med blodige staker | Skjelett og hogman på krigsvillsvin |
| Sump | Tåke, råtne trær, siv, lysende sopp, ildfluer | Bog Zombies, Frogmen | Myr som suger ned | Frogman og zombie på kakatrisse |
| Frost | Blåtimen i et fjellpass (konseptbilde 4): klippevegger med snø, fossefall, taubro, ruiner, fyrfat med ild, fillete krigsbannere med hornet hodeskalle, runesteiner, istapper, taugjerde og tett snøfall | Frost Skeletons, Ice Trolls, Avalanche Troll (kjempe midtveis) | Råk i isen | Frostskjeletter på villsvin og kakatrisse |
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
| Ned + hopp | Rulle | | Unngår høye og midt-angrep |

Best av tre runder, 60 sekunder per runde (tiden ute: Vorthax zapper taperen). Med 2 spillere er dueller **tag team**.

Etter halshugging kommer Cleanup Imp og **sparker hodet rett mot kameraet**. Det klasker i skjermen med et vått smell, blir sittende litt, og sklir så sakte nedover med en hvinende sklilyd og en blodstripe etter seg. Så drar impen liket ut.

## 8. Teit vold

- **Hodet i skjermen**: i duellene hver gang, og av og til på brettene når en fiende halshugges.
- **"It's just a flesh wound"**: tunge slag kan kutte av en arm uten å drepe. Armen spretter avgårde som en ball (med fjærlyd), blodet spruter fra skulderen, og figuren roper at det bare er et kjøttsår. Mister han våpenarmen også, blir det bare spark ("I'LL KICK YOU TO DEATH THEN!"). Heltene mister bare bakarmen på brettene, og den gror ut igjen når de spiser kylling.
- **Hodeløs kylling**: noen halshuggede fiender løper rundt og spruter blod en stund før kroppen skjønner det.
- **Miljødrap**: spiddet på staker, sugd ned i myra, frosset i råken, forkullet i lava, piggfelle i gulvet. Gir bonusgull og XP.

## 9. Hero Forge (heltebygger)

PAINTED PARTS er en felles pool for hode, overkropp, armer, belte/lendeklede, bein og våpen. Hver del velges uavhengig med bildeminiatyrer. Første pool har 19 valg fra eksisterende kunst; Thrugg og Valkyra er ferdige startoppsett. Våpenets egenskaper følger valgt våpenbilde, og langt bakhår følger hodet. Se `HERO_FORGE_GRAFIKK.md` for manglende kunst.

CLASSIC BUILDER beholder de prosedyretegnede valgene nedenfor. Malt hår, hjelmer og hud er foreløpig en del av selve bildene, så disse finvalgene vises bare i den klassiske byggeren:

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
- **Tre knapper** (angrep, hopp, spesial), som i Golden Axe. Grep og ridning har ingen egen knapp.
- **Grep og kast**: gå inn i en fiende, så tar helten tak i ham (som i Streets of Rage). Angrep = kne (tredje gang kastes han), retning + angrep eller hopp = kast. Opp eller ned kaster i dybden, for eksempel over taugjerdet og ned i juvet. Den kastede fienden velter andre fiender (bowling: STRIKE!) og dør hvis han lander i en fare. Store beist og sjefer er for tunge.
- **Juvet** (frostpasset): langs bakkanten av veien går juvet bak et taugjerde. Ingen går utfor av seg selv, men fiender som kastes eller slås inn, faller ned i dypet (SEE YOU NEVER!).
- **Istapper**: av og til løsner en istapp over kampfeltet. En skygge på bakken og snø som drysser varsler den, og den treffer alle, helter som fiender. Kjempens bakkeslag river løs flere.
- **Fyrfat som veltes**: slag, kastede fiender og bakkeslag velter fyrfatene. Glørne renner ut og brenner en stund, og fiender som tråkker i dem, tar fyr og løper i panikk.
- **Panikk**: fiender får panikk av og til (grufulle drap i nærheten, nesten død, i brann, når METAL MODE starter). De løper skrikende vekk med armene i været, alltid saktere enn helten, og kommer tilbake etterpå.
- **Fiender som rygger**: de holder avstand, men rygger på halv fart og blir i bildet når de først har kommet inn, så helten alltid når dem.
- **Ridedyr**: slå rytteren av og gå inn i dyret for å sitte opp. Angrep bruker dyrets angrep, ned + hopp hopper av. Treff kaster rytteren av. Etter tre avkastinger stikker dyret av.
  - War Hog: stormløp som spidder alt foran seg
  - Cluckatrice (halvt hane, halvt øgle): halesvip som treffer begge sider
  - Magma Newt: ildpust som griller alt foran
- Magi: blå potions fra gnomer, alle brukes på én gang (sterkere jo flere, og sterkere med MAG). Tre typer som i Golden Axe: meteorregn, forfedrenes skrik og tordenguden (lynet slår først ned i heltens våpen og så i hver fiende på skjermen, med flere nedslag rundt omkring fra tre krukker og fiolette lyn på fem og seks)
- **Sjonglering** som i Castle Crashers: treff på en fiende som er i lufta telles (JUGGLE! x2, AIR RAID! x3, SKY BUFFET! x4 osv.) og fyller METAL-måleren
- Berserk-spinn uten potions, koster litt HP
- Pickups: stekt kylling, halvspist skinke, potions, gull, egg fra kampkyllingen
- Kameraet låses per bølge. GO-pil når bølgen er ryddet
- **Kjemper** (Avalanche Troll i frostpasset): over dobbelt så høye som heltene. Slagene biter ikke før de har tatt en viss andel av livet i skade, da vakler de (STAGGERED!). Bakkeslaget rister skjermen, virvler opp snø, river løs istapper og velter fyrfat, og kameraet trekker seg bakover mens kjempen er i bildet. Av og til griper kjempen en helt, holder ham opp i neven og kaster ham langt (TINY MAN FLY!). Den andre helten kan få ham til å slippe ved å slå til han vakler. For tunge til å gripes
- **METAL MODE**: en felles måler øverst fylles av drap (mer for halshugging, eksplosjoner og miljødrap, og for lange drapsrekker). Når den er full, spiller bandet en gitarsolo med dobbel stortromme, en falsettsanger skriker, våpnene brenner, heltene slår 60 prosent hardere og lynet slår ned i fiendene. Varer i 12 sekunder.

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

Gore (FAMILY, NORMAL, EXCESSIVE, PLEASE SEEK HELP), musikk, musikkstil (HEAVY METAL eller 8-BIT), lydeffekter, skjermristing, gamepad-rumble, berøringskontroller (auto, på, av) og fullskjerm. FAMILY gjør blod om til konfetti og gibs til gummiender.

## 13. Humor

- Fiender roper replikker når de dukker opp og dør
- Drapsteller: CARNAGE, MASSACRE, EXCESSIVE, PLEASE SEEK HELP, THE BARD WILL SING OF THIS
- B-film-replikker: heltene slenger ut en replikk etter 5, 12 og 20 drap på rad ("MY BICEPS HAVE NO REGRETS.", "THIS CHAINMAIL IS FULLY FUNCTIONAL."). Replikkene ligger i `src/data/quips.ts`
- Prinsessen kjeder seg og holder et BORED-skilt
- Vorthax er bare "moderat" ond, baker som hobby, og har motiverende plakater i tårnet
- Sjefene har sine egne replikker ved start, raseri og død
- Butikkeieren: "NO REFUNDS. NO QUESTIONS. NO PANTS."

## 14. Lyd

Frostpasset har fottrinn i snøen, fossesus som blir sterkere nær fossene, ulv, vindkast og is som knaker, og kjempetrollet kommer med krigshorn, brøl og tunge trinn som rister skjermen. Alle helter og kjemper har fottrinn etter underlaget (gress, stein, vann, snø). Replikkene kan leses inn med stemmer laget i VoiceStudio (stemmedesign, ingen kloning av ekte stemmer); manuset står i docs/STEMMER.md, og spillet spiller en replikk så snart fila finnes.

Lydeffektene er syntetisert i WebAudio (sverdsus, treff, splat, klang, overdrevne skrik med ulik stemme per figurtype, mynter, gong, publikum, fjærlyd for armer, vått smell og skli-hvin for hodet i skjermen, ild, plask, fres, sirkusfanfare for studiologoen), med ekte opptak lagt oppå der de finnes: slag, knas, sprut, riving, stikk, fall, torden og zap fra Freesound, og gong, bekken og pauker fra VCSL, alle CC0. Lydbanken og stemningen er hentet fra Toms Morbidium. Syntlyden ligger under og tar over når en fil ikke er lastet (og i enkeltfil-bygget). RECORDED SOUNDS i innstillingene slår opptakene av. Lyn høres ut som torden, ikke som eksplosjoner. Musikken dukker under store smell og på pause. Hvert brett har sin egen stemning under musikken: vind og kråker i grasslandet, drypp og drone i sumpen, vind i frosten, bål og buldring i vulkanlandet, sirisser og bål i nattleiren, drone i tårnet og publikumsmumling i arenaen. Drapsrekkene får fanfarer som trappes opp med gitar, pauker, orgel, kor, gong, torden og publikum, og en lang rekke som ryker får en trist trombone. M slår lyd av/på.

Musikken er 80-talls heavy metal: ekte trommer, gitar og bass (opptak fra Karoryfer, CC0) spilt tone for tone av bandet i WebAudio, med synthen som reserve når opptakene ikke er lastet, er slått av eller i enkeltfil-bygget. To rytmegitarer panorert ut til hver side gjennom forvrengning og et høyttalerkabinett, palm mute og galopp, bassgitar, trommer med dobbel stortromme og gated reverb på skarptromma, og leadgitar med vibrato, bend, ekko og tvillingharmonier. Hvert brett har sin egen låt: episk tittellåt, galopp på veien, seig doom i sumpen, speed metal i frosten, frygisk thrash i Scorchlands, og dobbel stortromme i dueller, sjefer og tårnet. Brettene starter med en stor åpen akkord, og sjefene kommer inn med et vektarmdykk. De gamle 8-bit-låtene kan velges i innstillingene. Alle riff og melodier er skrevet for spillet.

Musikken styres av en dirigent etter mønster fra Morbidium, inspirert av iMUSE: en ny låt starter aldri midt i takten, men på neste taktstrek, etter en bro med trommevirvel, en kvintakkord på dominanten og et bekken som svulmer opp mot første slag. Bandet trapper opp i fire nivåer: rolig mellom bølgene, kamp, hete (mange fiender, en rytter eller en helt med lite liv, med dobbel stortromme og raskere tempo) og sjef (kor og pauker). METAL MODE går inn på slaget, soloen starter på taktstreken, sjefen lander på første slag med gong, og seier, tap og innslag (bølge ryddet, nytt nivå, FIGHT!, KO) kommer i takt og i låtas toneart.

## 15. Kontroller

| | Spiller 1 | Spiller 2 | Gamepad |
|---|---|---|---|
| Bevegelse | WASD | Piltaster | Stikke / D-pad |
| Angrep | F (eller J) | , (eller Numpad 1) | X / RT |
| Hopp | G (eller K) | . (eller Numpad 2) | A |
| Spesial/blokk | H (eller L) | / eller - (eller Numpad 3) | B / LB / LT |
| Pause | P / Esc | | Start |

Tre knapper. Gå inn i en fiende for å gripe ham, og inn i et ledig ridedyr for å sitte opp (ned + hopp hopper av). Den gamle grip-knappen (R, høyre Shift, Y/RB) virker fortsatt som snarvei, men står ikke i menyene. Hold opp eller ned mens du kaster en fiende for å kaste ham bakover eller forover (over taugjerdet og ned i juvet). Med én gamepad i 2-spiller er gamepaden spiller 2. **Mobil og nettbrett**: flytende stikke til venstre, knappene HIT, JUMP og MAGIC til høyre, pause oppe til høyre. Spillet ber deg snu telefonen på siden.

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
8. **Fra konseptbilde 4** (gjort): juvet, istapper, fyrfat som veltes, kjempen som kaster heltene og panikk. Videre: juv og fallende stein i andre biomer, og at en kastet helt kan velte fiender han treffer.
9. **Flere kjemper**: en kjempe per land (sumpkjempe, lavakjempe) med egne bakkeslag.
