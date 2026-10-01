# Miljøpakke til STAGE FORGE

Miljøpakken inneholder 52 separate bilder: 43 miljøobjekter og deler med `env_` i navnet, og ni forgrunnsobjekter med `fg_`. Bildene er importert som WebP med gjennomsiktighet i `public/assets/` og registrert under `props` i `public/assets/manifest.json`.

Originalkunsten er laget med GPT-image for Loincloth Legends: slitte materialer, tydelige silhuetter og nesten fotorealistisk barbarfantasy. Genereringspromptene og kildeopplysningene er samlet i `art/prompts/environment-2026-09-30.json`.

## Finne og plassere bildene

Åpne STAGE FORGE med `?editor=road`, og velg **LIBRARY → IMAGES**. Alle 52 bildene finnes der. Forgrunnsobjektene har **FRONT** som standardlag. De kan plasseres delvis utenfor skjermen for å gi inntrykk av noe tett inntil kameraet. Dybden i 3D-scenen gir parallaksen når kameraet beveger seg.

Hvert bilde har en egen manifest-ID som er lik originalens PNG-navn uten filendelse. For eksempel blir `env_tent.png` til ID `env_tent`, med filen `public/assets/prop_env_tent.webp`. Det samme mønsteret gjelder hele tabellen: `public/assets/prop_<id>.webp`.

De nye ID-ene erstatter ingen av de eksisterende plassholderne eller 3D-rekvisittene. Plassholderne finnes fortsatt i biblioteket, men brett 1 bruker nå bildene fra pakken, og de andre brettene bruker murene og gravene (se «Brett 1» og «De andre brettene» under). Bredder og ankere er startverdier. Juster **WIDTH**, fotpunkt, lag og skala i editoren før en scene lagres. Se også [STAGE_FORGE.md](STAGE_FORGE.md).

Spillet henter bare bildene brettfilene bruker når det starter (`main.ts`), så en spiller slipper å laste ned hele pakken. Editoren henter resten før den åpnes (`loadPropImages` i `src/gfx/assets.ts`), og med `?editor` i adressen hentes alt med en gang.

## Alle 52 bilder

| ID | Innhold |
|---|---|
| `env_brick_wall_straight` | Rett seksjon av slitt rødbrun teglmur. |
| `env_brick_wall_end` | Avslutning til teglmuren med synlig endeflate. |
| `env_brick_wall_ruined` | Sammenrast teglmur med ujevn topp og murrester. |
| `env_stone_wall_straight` | Lav mur av grove natursteiner. |
| `env_stone_wall_broken` | Brutt natursteinsmur. |
| `env_castle_wall_straight` | Borgvegg med store steinblokker og brystvern. |
| `env_castle_wall_pillar` | Kraftig steinsøyle til borgveggen. |
| `env_castle_wall_breach` | Ødelagt borgvegg med et stort brudd. |
| `env_palisade_straight` | Rett palisadeseksjon med spissede tømmerstokker. |
| `env_palisade_end` | Avslutning til palisaden. |
| `env_palisade_broken` | Brutt palisade med skadde stokker. |
| `env_grave_mound` | Jordhaug over en grav. |
| `env_grave_open` | Åpen grav med malt jordkant og mørkt indre. |
| `env_gravestone_simple` | Enkel, skjev gravstein. |
| `env_gravestone_cracked` | Sprukket gravstein med utskårne detaljer. |
| `env_gravestone_skull` | Stor gravstein med hodeskallemotiv. |
| `env_campfire_base` | Steinring og forkullede vedkubber uten flamme. |
| `env_campfire_flame` | Separat flamme til bålet. |
| `env_tent` | Lavt krigertelt i slitt skinn og lerret. |
| `env_signpost` | Skjev skiltstolpe med tom pilformet planke. |
| `env_lamppost_post` | Stolpe med arm og krok til en hengende lykt. |
| `env_lamppost_lantern` | Separat lykt som kan henges på stolpen. |
| `env_lantern_flame` | Separat liten flamme til lykten. |
| `env_oak_trunk` | Stor eikestamme med røtter og greiner. |
| `env_oak_canopy` | Separat løvkrone til eika. |
| `env_dead_tree` | Dødt, knudrete tre. |
| `env_bush_dense` | Tett grønn busk. |
| `env_bush_low` | Lav krattbusk. |
| `env_bush_thorn` | Tørr tornebusk. |
| `env_wagon_intact` | Hel trevogn med jernbeslåtte hjul. |
| `env_wagon_wrecked` | Havarert trevogn. |
| `env_banner_pole` | Stang og feste til et krigsbanner. |
| `env_banner_cloth` | Separat fillete bannerduk. |
| `env_crow_perched` | Hel, statisk sittende kråke. |
| `env_torch_body` | Fakkelstav med surret brennhode uten flamme. |
| `env_torch_flame` | Separat flamme til fakkelen. |
| `env_torch_wall_holder` | Veggholder til fakkelen. |
| `env_barrel` | Grov tretønne. |
| `env_crate` | Slitt trekasse. |
| `env_boulder` | Stor, ujevn stein. |
| `env_fallen_log` | Fallen trestamme. |
| `env_palisade_gate` | Kraftig treport til palisaden. |
| `env_altar` | Grovt offeralter. |
| `fg_skull_stake` | Mørk hodeskalle på påle til forgrunnen. |
| `fg_branch_leaves` | Grein med løv som kan stikke inn fra kanten. |
| `fg_tree_trunk` | Tykk trestamme tett foran kameraet. |
| `fg_palisade_stakes` | Spisse palisadestokker til nedre bildekant. |
| `fg_chain` | Hengende kjetting. |
| `fg_tattered_cloth` | Hengende, fillete stoff. |
| `fg_rocks` | Mørke steiner til forgrunnen. |
| `fg_roots` | Grove røtter til forgrunnen. |
| `fg_tall_grass` | Høyt gress til nedre bildekant. |

## Sett og animasjon

Bildene er statiske, men delene er satt sammen til sett og har fått bevegelse (2026-09-30). Festepunktene er målt på de importerte WebP-bildene, ikke på PNG-originalene. Et sett legges ut med ett klikk i biblioteket (SET OF 2 eller 3), med delene hengt på:

| Sett | Deler og montering |
|---|---|
| `env_lamppost_post` | Lykta henger i kroken (ringen på kroken), og flammen står på veken inne i lykta. Flammen henger på lykta, ikke på stolpen, så den følger svingen (`on` i settet). |
| `env_torch_body` | Flammen står bak brennhodet, så hodet skjuler den flate bunnen av flammen. |
| `env_torch_wall_holder` | Fakkelen går gjennom ringen (bak holderen), og flammen henger på fakkelen. Holderen er sett fra siden og passer på siden av en stolpe eller en murende. |
| `env_campfire_base` | Flammen står bak vedkubbene og steinene og stiger opp mellom og over kubbene. Flammebildet har en rett bunn, så det må ikke stå foran. |
| `env_banner_pole` | Duken henger i den øvre ringen på stanga, bak stanga, så ringene ser ut som de holder den. Skala 0,8. |
| `env_oak_trunk` | Kronen ligger over den øvre forgreningen og skjuler de øverste greinene. |

Ankeret er flyttet til der tingen faktisk står på bakken: stolpen på lyktestolpen (u 0,14), stanga på banneret (u 0,33), festeplata på veggholderen (u 0,09), skiltstolpen (u 0,45) og kråkeføttene (u 0,6).

Bevegelsene står i `anim` i manifestet og følger bildet uansett hvor det legges:

| Bilde | Bevegelse |
|---|---|
| `env_banner_cloth` | WAVE fra venstre (duken bølger ut fra stanga) |
| `fg_tattered_cloth` | WAVE fra toppen |
| `fg_branch_leaves` | Svak WAVE fra venstre (greina vipper sakte) |
| `fg_chain` | SWING rundt toppen |
| `env_lamppost_lantern` | SWING rundt ringen, og rister når noen slåss i nærheten (REACT) |
| `env_lantern_flame`, `env_torch_flame`, `env_campfire_flame` | FLICKER med lys og PULSE. Flammene lyser selv (`emit`), ellers blir de hvite av sitt eget lys |
| `env_oak_canopy`, buskene, `env_dead_tree`, `fg_tall_grass` | SWAY i vinden |
| `env_crow_perched` | Flyr når noen kommer nær eller slåss i nærheten, og kommer tilbake etter 12 sekunder (REACT FLEE) |
| `env_barrel`, `env_crate`, `env_signpost` | Hopper eller rister når noe treffer i nærheten (REACT) |

Flammebildene har ikke partikkelflammer (`fire`) i tillegg. Det ble prøvd, og partiklene la seg som hvite klumper oppå bildet.

## Brett 1

Brett 1 (`src/data/layouts/road.json`) bruker pakken i stedet for plassholderne: palisaden som en rad med ender og veggfakler ved de to åpningene, telt bak åpningene, lyktestolpe, skilt med kråke, bål, bannere, fakler, vogn med tønne og kasse, busker, eiker og et dødt tre bak palisaden, og gress, stamme, steiner og røtter rett foran kameraet. Den genererte 3D-palisaden, teltene, bålene og bannerne er slått av der. Eikekronene har en varm farge (`tint`), så de passer den røde og gule skogen.

## De andre brettene

Murene og gravene er tatt i bruk på de andre brettene (Tom 2026-09-30). Fargen er justert per brett med `tint`, fordi bildene er malt i varmt dagslys:

| Brett | Hva |
|---|---|
| Sumpen (`swamp.json`) | Gravplassen ved starten, der zombiene i bølge 1 kommer fra: åpne graver, en haug og gravsteiner på bredden, med en halvt sunket steinmur i vannet bak. Enkeltgraver langs bredden, og gravsteiner og murrester som står skjevt ute i vannet (senket med `y` under vannflaten). |
| Frosten (`frost.json`) | En gammel steinmur langs veien ved starten, en liten gravplass for falne krigere midt i passet, en borgruin bak skogen, og borgmuren med tårn og brudd som leder fram til porten ved Kaldors grop. Kald farge (#aab8d0). Ingenting står over juvene. |
| Scorchlands (`scorch.json`) | En nedbrent landsby: grupper av teglmur (ende, rett og ruin) foran lavaelva, gravsteiner med hodeskalle, og en borgruin på den andre siden av elva. Brent farge (#7c6a62), ruinen bak elva mørkere. |
| Tårnet (`tower.json`) | Steinras langs veggen og en krypt med gravsteiner før tronsalen. Lilla farge (#a898b8). |
| Nattleiren (`nightcamp.json`) | En liten gravplass mellom de to bålene bak leiren, med en brutt steinmur bak. |

Den åpne graven har fått ankeret [0.5, 0.9]: midten av bildet slutter ved v 0,89, og bare kanten til høyre går helt ned. Graven er tegnet sett ovenfra, så den ser ut som en lav, gravd grop med jordkant fra spillkameraet.

## Import og originaler

Bildene følger repoets `prop-art`-flyt: `prop_<id>.png` i `art/inbox/`, behandling med `tools/process_art.py`, og WebP samt manifestoppføring i `public/assets/`. Originale PNG-er ligger i den leverte `Loincloth-Legends-Miljopakke-52-PNG.zip`, ikke i git. Eventuelle lokale importkopier og `art/inbox/behandlet/` er arbeidsfiler.

Importen beskjærer etter alfa og bevarer gjennomsiktigheten i WebP. Originalpakkens pikselmål og alfagrenser beskriver PNG-originalene, ikke de beskårne WebP-filene. Festepunkter må måles på de importerte bildene. Murseksjonene trenger tilpasset skala og litt overlapp; de er ikke pikselnøyaktige fliser. Den åpne graven er en tegnet dybdeillusjon, ikke et hull i bakken.

Porten `env_palisade_gate` krevde en særskilt klargjøring av importkopien. Bildet har ekte alfa, men for liten gjennomsiktig flate til at importskriptets bakgrunnstest hopper over bakgrunnsfjerning. Importkopien fikk derfor 48 piksler gjennomsiktig marg på venstre og høyre side. Skriptets vanlige beskjæring fjerner denne marga igjen. RGBA-innholdet etter beskjæring ble kontrollert byte for byte mot originalens tilsvarende beskjæring før import. PNG-originalen og importskriptet er uendret.

Settene, bevegelsene og brettene er kontrollert med skjermbilder i editoren og i spillet (`tools/tests/env-pack.mjs` sjekker lastingen, settene, brett 1 og murene og gravene på de andre brettene). Fra 2026-10-01 brukes portbladene i palisadeåpningen på brett 1 (x 33,17 og 35,98), og alter, steinblokk og fallen stokk ved tempelglennen i jungelen (x 80,6, 84,3 og 77,2). Frostpasset bruker også bannerstang med festet, bevegelig duk ved x 68,2. Størrelse, anker og bakre klaring er kontrollert i brettfilene med `tools/tests/scenery-reuse.mjs`; alle sju delene gjenbruker eksisterende bilder og manifestdata. Visuell sluttkontroll kjøres i `todo-quality.yml`.

Alfafeilen beskrevet over er rettet i `process_art.py` 2026-10-01: ekte alfa bevares uansett prosent. Den historiske importen av porten er uendret.
