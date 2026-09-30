# Miljøpakke til STAGE FORGE

Miljøpakken inneholder 52 separate bilder: 43 miljøobjekter og deler med `env_` i navnet, og ni forgrunnsobjekter med `fg_`. Bildene er importert som WebP med gjennomsiktighet i `public/assets/` og registrert under `props` i `public/assets/manifest.json`.

Originalkunsten er laget med GPT-image for Loincloth Legends: slitte materialer, tydelige silhuetter og nesten fotorealistisk barbarfantasy. Genereringspromptene og kildeopplysningene er samlet i `art/prompts/environment-2026-09-30.json`.

## Finne og plassere bildene

Åpne STAGE FORGE med `?editor=road`, og velg **LIBRARY → IMAGES**. Alle 52 bildene finnes der. Forgrunnsobjektene har **FRONT** som standardlag. De kan plasseres delvis utenfor skjermen for å gi inntrykk av noe tett inntil kameraet. Dybden i 3D-scenen gir parallaksen når kameraet beveger seg.

Hvert bilde har en egen manifest-ID som er lik originalens PNG-navn uten filendelse. For eksempel blir `env_tent.png` til ID `env_tent`, med filen `public/assets/prop_env_tent.webp`. Det samme mønsteret gjelder hele tabellen: `public/assets/prop_<id>.webp`.

De nye ID-ene erstatter ingen av de eksisterende plassholderne eller 3D-rekvisittene. Pakken er tilgjengelig i biblioteket; importen plasserer ikke objektene automatisk i brettene. Bredder og ankere er startverdier. Juster **WIDTH**, fotpunkt, lag og skala i editoren før en scene lagres. Se også [STAGE_FORGE.md](STAGE_FORGE.md).

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

## Separate deler og animasjon

Bildene er statiske utgangspunkt. Pakken inneholder ikke ferdige bildeserier, vingeslag, splatt-animasjoner eller en ferdig konfigurert rigg. Editoren har støtte for både bevegelser og sammensatte sett, men ingen slike sett eller animasjoner er satt opp for disse 52 bildene. Flere objekter er delt for å kunne monteres og animeres hver for seg:

| Objekt | Deler og montering |
|---|---|
| Bål | `env_campfire_base` og `env_campfire_flame`. Plasser flammens basis over vedkubbene. |
| Lyktestolpe | `env_lamppost_post`, `env_lamppost_lantern` og `env_lantern_flame`. Heng lykten i kroken og plasser flammen ved veken. |
| Fakkel | `env_torch_body` og `env_torch_flame`, eventuelt `env_torch_wall_holder`. |
| Banner | `env_banner_pole` og `env_banner_cloth`. Duken festes langs venstrekanten. |
| Levende eik | `env_oak_trunk` og `env_oak_canopy`. Overlapp kronen over stammens øvre forgrening. |

Monter delene med **PART OF** under **PARTS**, eller bruk **+ ADD PART** og dra delen på plass. En del følger bevegelsen til objektet den er festet til. Heng for eksempel lykten på stolpen og flammen på lykten, slik at flammen følger lykten når den svinger. Juster skala og innfesting på de beskårne bildene, og kontroller bevegelsen i editoren. **SAVE AS SET** lagrer et sammensatt bildeobjekt med delene i manifestet, slik at delene følger med når settet plasseres på nytt. Disse koblingene må opprettes for miljøpakken; importen har bare registrert de separate bildene.

**SWAY** låser bildets nedre kant og bøyer toppen. Det passer busker og gress. Bruk **WAVE** til tøy: velg **LEFT** for bannerduken som er festet langs venstrekanten, **RIGHT** når festet er på høyre side, eller **TOP** for `fg_tattered_cloth` som henger fra toppen. WAVE deler opp og deformerer ett stillbilde mens festekanten står stille, så en slik bølgebevegelse trenger ikke en bildeserie. **SWING** roterer hele bildet rundt et valgt ledd og passer for eksempel en lykt som henger i en toppring. Bevegelsene må tilpasses og kontrolleres etter montering.

En flamme kan få **FLICKER** og et lys i editoren. Dette endrer lys og intensitet; det tilfører ikke nye flammebilder. Kråka er ett helt bilde og har ingen separat vingebevegelse.

## Import og originaler

Bildene følger repoets `prop-art`-flyt: `prop_<id>.png` i `art/inbox/`, behandling med `tools/process_art.py`, og WebP samt manifestoppføring i `public/assets/`. Originale PNG-er ligger i den leverte `Loincloth-Legends-Miljopakke-52-PNG.zip`, ikke i git. Eventuelle lokale importkopier og `art/inbox/behandlet/` er arbeidsfiler.

Importen beskjærer etter alfa og bevarer gjennomsiktigheten i WebP. Originalpakkens pikselmål og alfagrenser beskriver PNG-originalene, ikke de beskårne WebP-filene. Festepunkter må måles på de importerte bildene. Murseksjonene trenger tilpasset skala og litt overlapp; de er ikke pikselnøyaktige fliser. Den åpne graven er en tegnet dybdeillusjon, ikke et hull i bakken.

Porten `env_palisade_gate` krevde en særskilt klargjøring av importkopien. Bildet har ekte alfa, men for liten gjennomsiktig flate til at importskriptets bakgrunnstest hopper over bakgrunnsfjerning. Importkopien fikk derfor 48 piksler gjennomsiktig marg på venstre og høyre side. Skriptets vanlige beskjæring fjerner denne marga igjen. RGBA-innholdet etter beskjæring ble kontrollert byte for byte mot originalens tilsvarende beskjæring før import. PNG-originalen og importskriptet er uendret.

Pakken er registrert for bruk i editoren. Startverdiene innebærer ikke at sammensatte objekter, ferdige brettplasseringer eller animasjoner er kalibrert eller visuelt kontrollert inne i spillet.
