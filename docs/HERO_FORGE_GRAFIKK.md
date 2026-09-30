# Hero Forge: felles pool av malte deler

Oppdatert 30. september 2026. Hero Forge har nå 44 malte delvalg: 19 fra grunnpakken og 25 Forge-bilder. Alle velges uavhengig i PAINTED PARTS. Kunstpakken består av de 143 opprinnelige bildene pluss Forge-tilleggene, totalt 168 filer.

## Hva som faktisk manglet

Alle **143 filer i den opprinnelige kunstbestillingen finnes**. `python3 tools/check_art_pack.py` gikk gjennom: 89 figurdeler, 12 ridedyrdeler, fem kjæledyr, 28 teksturer, åtte himler og kartet. Ingen av manifestets bildefiler mangler, og det ligger ingen andre bildefiler løst i `public/assets/`.

Problemet i Hero Forge var koblingen til bildene. `buildHeroDef()` arvet bildene fra Thrugg eller Valkyra bare når samtlige utseendevalg passet et uendret preset. Ett endret valg fjernet hele denne arven, så figuren fikk prosedyretegningene igjen. De ferdige delene var ikke en felles, fritt valgbar pool.

`docs/CHATGPT_PROMPT.md` sin 143-filers sjekkliste omfatter ikke den utvidede heltebyggeren. Den opprinnelige briefen beskrev bare uendrede presets; den er nå merket med lenke til denne mangellisten. Separate ansikter, hår, hjelmer og skjegg står under «Planlagt (ikke koblet inn i koden ennå)» i `docs/ART_PROMPTS.md`. Disse filene finnes ikke.

## Grunnlaget: 19 valg fra eksisterende bilder

Katalogen i `src/data/hero-parts.ts` kobler uavhengige valg til de eksisterende filene. Thrugg og Valkyra er startoppsett; hver del skal kunne byttes uten at resten av helten mister grafikken.

| Valg | Eksisterende bildefiler | Antall valg |
|---|---|---:|
| Hode | `thrugg_head.webp`, `valkyra_head.webp`, `gorthak_head.webp` | 3 |
| Overkropp | `thrugg_torso.webp`, `valkyra_torso.webp`, `gorthak_torso.webp` | 3 |
| Belte og lendeklede | `thrugg_pelvis.webp`, `valkyra_pelvis.webp`, `gorthak_pelvis.webp` | 3 |
| Armer | `thrugg_arm.webp`, `valkyra_arm.webp`, `gorthak_arm.webp` | 3 |
| Bein | `thrugg_leg.webp`, `valkyra_leg.webp`, `gorthak_leg.webp` | 3 |
| Våpen | `thrugg_weapon.webp`, `valkyra_weapon.webp`, `gorthak_weapon.webp`, `hogman_weapon.webp` | 4 |

Dette gir **19 delvalg fra 19 eksisterende filer**. `valkyra_hairback.webp` følger Valkyra-hodet automatisk, så poolen bruker 20 bildefiler med bakhåret inkludert. Ett arm- og ett beinbilde brukes på begge sider, som i den eksisterende riggen. Gorthak-hodet følger opplåsingen `helmet:5`; Hogmans klubbe følger `weapon:3`.

De fire opprinnelige våpenbildene dekker sverd, to økseutseender og piggklubbe. Den nye `forge_warhammer_weapon.webp` dekker WARHAMMER og følger opplåsingen `weapon:2` fra første brett.

## Første tillegg: 13 deler

Bildene er laget enkeltvis med imagegen med repoets eksisterende Thrugg- og Valkyra-deler som referanser for materialer og rendering. Ferdige WebP-filer ligger i `public/assets/`, er registrert i manifestet og har stabile valg i `src/data/hero-parts.ts`. Originale PNG-er behandles av `tools/process_art.py`; de originale arbeidsfilene sjekkes ikke inn i det offentlige repoet.

| Gruppe | Ferdig fil i `public/assets/` | Innhold |
|---|---|---|
| Våpen | `forge_warhammer_weapon.webp` | Tung krigshammer av slitt jern, kort bredt hammerhode, lærviklet skaft. Kobles til WARHAMMER. |
| Hode | `forge_bald_head.webp` | Voksen mann, barbert hode, brekt nese og kort skjeggstubb, varm hud som Thrugg. |
| Hode | `forge_eyepatch_head.webp` | Voksen mann med øyelapp, grovt ansikt og kort mørkt hår, varm hud som Thrugg. |
| Hode | `forge_crownbraid_head.webp` | Voksen kvinne med stram flettet hårkrans og bestemt uttrykk, lys hud som Valkyra. Alt hår over nakkeleddet. |
| Hode | `forge_silvercut_head.webp` | Voksen kvinne med kort sølvgrått hår, arr og skjevt smil, lys hud som Valkyra. |
| Kropp | `forge_leather_torso.webp` | Bred mannlig overkropp med slitt lærsele og brystvern, varm hud som Thrugg. |
| Kropp | `forge_plate_torso.webp` | Kraftig kvinnelig overkropp i bulkete brystpanser, lys hud som Valkyra. |
| Kropp | `forge_kilt_pelvis.webp` | Kort mørkerød krigskilt på bredt lærbelte. Ingen hud eller bein. |
| Kropp | `forge_tassets_pelvis.webp` | Belte med overlappende jernplater og slitte lærremmer. Ingen hud eller bein. |
| Kropp | `forge_leather_arm.webp` | Kraftig arm med enkle lærbeskyttere, varm hud som Thrugg. |
| Kropp | `forge_plate_arm.webp` | Kraftig arm med jernskinne og hanske, lys hud som Valkyra ved skulderen. |
| Kropp | `forge_sandals_leg.webp` | Sterkt bein med lærremmer og tunge sandaler, varm hud som Thrugg. |
| Kropp | `forge_greaves_leg.webp` | Sterkt bein med bulkete jernskinne og støvel, lys hud som Valkyra ved hoften. |

Hvert bilde inneholder én del med ekte alfa. Innleseren beskjærer den transparente margen og beholder opptil 1024 piksler på lengste side. Nye deler følger samme helterigg som Thrugg og Valkyra.

## Andre tillegg: orc, frostkriger og to våpen

Tolv nye bilder gir to ekstra valg i hver kategori. Orc-delene bruker en kvinnelig kropp, frostkrigeren en mannlig kropp. Begge følger samme helterigg og kan blandes med de andre delene. Hudfargen er malt inn i bildene.

| Ferdig fil i `public/assets/` | Innhold | Opplåsing |
|---|---|---|
| `forge_orc_head.webp` | Hode til en voksen, grønn orc-kvinne. | Tilgjengelig fra start |
| `forge_orc_torso.webp` | Kvinnelig orc-overkropp; setter `body: 1`. | Tilgjengelig fra start |
| `forge_orc_pelvis.webp` | Orcens belte og lendeklede. | Tilgjengelig fra start |
| `forge_orc_arm.webp` | Grønn orc-arm, brukt foran og bak. | Tilgjengelig fra start |
| `forge_orc_leg.webp` | Grønt orc-bein, brukt på begge sider. | Tilgjengelig fra start |
| `forge_frost_head.webp` | Hode til en voksen frostkriger med blå hud. | `skin:6`: slå Frostjarl Kaldor |
| `forge_frost_torso.webp` | Mannlig frost-overkropp; setter `body: 0`. | `skin:6`: slå Frostjarl Kaldor |
| `forge_frost_pelvis.webp` | Frostkrigerens belte og lendeklede, uten hud. | Tilgjengelig fra start |
| `forge_frost_arm.webp` | Blå frost-arm, brukt foran og bak. | `skin:6`: slå Frostjarl Kaldor |
| `forge_frost_leg.webp` | Blått frost-bein, brukt på begge sider. | `skin:6`: slå Frostjarl Kaldor |
| `forge_sabre_weapon.webp` | RAIDER SABRE; bruker SWORD-egenskaper (`weapon: 0`). | Tilgjengelig fra start |
| `forge_boneclub_weapon.webp` | BONE CRUSHER; bruker SPIKED CLUB-egenskaper (`weapon: 3`). | `weapon:3`: vinn Bone Coliseum |

Frostkrigerens fire deler med hud deler den eksisterende opplåsingen for FROST BLUE. Beltet er fritt, siden det ikke inneholder hud. Låsen gjelder hvert delvalg, også i tilfeldig helt og ved innlesing av lagring. Sabel og beinklubbe er nye utseender for eksisterende våpenklasser; de får ikke egne kampregler.

Den samlede poolen har ni hoder og sju valg i hver av de andre fem kategoriene: overkropp, belte, arm, bein og våpen. Alle 44 valg er koblet til bildefiler. Valkyras bakhår kommer i tillegg og følger hodet automatisk, så poolen bruker 45 bilder. Skinntone og materialer ligger i hvert bilde; spilleren kan også velge bevisste blandinger.

Claudes justering av armer og våpen er bevart: lasteren finner skulder, neve og grep, og riggen roterer og skalerer armen rundt skulderen slik at neven møter våpenet. `hand`, `anchor` og `height` i manifestet brukes når en del krever målte verdier. Både hovedarm og bakarm bruker samme bilde.

## Kalibrering og kontroll

De nye hodene har egne høyder, slik at selve ansiktet ikke blir like stort som hele Thrugg-hjelmen. Beltenes buede overkant og torsoenes avrundede nedkant krever et uttrykkelig festepunkt. Tabellen viser verdier kontrollert på sammensatte figurer i fire poser. Ankerverdiene er brøker av det beskårne bildet, med y fra toppen.

| Kilde | Felt i manifestet | Verdi |
|---|---|---|
| `forge_bald` hode | `height` | 0.74 |
| `forge_eyepatch` hode | `height` | 0.80 |
| `forge_crownbraid` hode | `height` | 0.84 |
| `forge_silvercut` hode | `height` | 0.82 |
| `forge_leather` og `forge_plate` overkropp | `anchor` | [0.55, 0.96] |
| `forge_kilt` belte | `anchor` | [0.53, 0.19] |
| `forge_tassets` belte | `anchor` | [0.52, 0.22] |
| `forge_orc` hode | `height` | 0.88 |
| `forge_frost` hode | `height` | 0.82 |
| `forge_orc` og `forge_frost` overkropp | `anchor` | [0.55, 0.96] |
| `forge_orc` belte | `anchor` | [0.52, 0.19] |
| `forge_frost` belte | `anchor` | [0.53, 0.19] |

Armer, bein og hammer i det første tillegget bruker automatisk måling. Dette tillegget ble kontrollert med våpengrep på de 13 opprinnelige bevæpnede figurene og fire blandinger i tre poser. Galleriet viste de fire blandingene i fire poser med leddmarkører. Det er nødvendig å se på bildene i tillegg til å måle grepet: første kontroll fant en skulderglippe med utstrakt arm selv om neven traff våpenleddet. Torsoankrene over er justert for dette. Alfakontakttesten krever at overkroppen faktisk møter den øvre delen av armen i utstrakt pose; en negativ kontroll med gammelt torsoanker avvises.

Andre tillegg er kontrollert både som hele orc-/frostsett og med lemmer og belter fra første tillegg. Alle åtte blandinger har kontakt mellom arm og overkropp. De fire nye blandingene viser 57 til 75 prosent av bakarmen, og neven er maksimalt 0.006 enheter fra våpenleddet. Nye armer, bein, sabel og beinklubbe bruker automatisk måling. Nettlesertesten dekker også frost- og klubbelås, begge spilleres lagring og ny lasting, faktiske bilder i forhåndsvisningen og det siste hodekortet på mobil.

## Hva fri finjustering fortsatt trenger

Poolen over bytter hele malte deler. Hår, skjegg, hjelm og hudfarge er i hovedsak malt inn i dem. De gamle valgene finnes fortsatt i den klassiske, prosedyretegnede modusen. For tilsvarende frihet med malt grafikk trengs:

- Ansiktsbaser og egne lag for hår, skjegg og hodeplagg, med felles lerret og målte festepunkter. Langt bakhår må tilhøre riktig hårvalg.
- Hud-, hår- og tøymasker, eller avgrensede materialelag, slik at fargevalg lar metall og lær beholde fargen. En farge lagt over hele bildet er ikke tilstrekkelig.
- En fast lagrekkefølge og regler for hvilke hårtyper som passer under hver hjelm. «Ingen» trenger ingen bildefil.
- Nye kroppstyper som dverg og halvtroll må få egen rigg og kunst som passer den; de er ikke bare en ekstra farge.

Thrugg, Valkyra og Gorthak har helteoverkropper i trekvart profil. Mange fiender er tegnet fra siden, har fremskutt hals og helt andre skulderfester. Ikke legg samtlige fiendedeler i heltepoolen uten å tilpasse og kontrollere dem. Våpen kan gjenbrukes når grep og størrelse passer.

## Innlesing av flere deler

`process_art.py` godtar allerede vilkårlige figurnavn med støttet del til slutt. `forge_warhammer_weapon.png` blir eksempelvis `char: forge_warhammer`, `part: weapon`, `file: forge_warhammer_weapon.webp`. Hvert nytt bilde må også ha et valg i delkatalogen med riktig våpenklasse og eventuelt opplåsingskrav. Hammeren er allerede registrert begge steder.

Innlesing og kontroll er klargjort for de nye standarddelene:

- **Kunstkontrollen er utvidet.** `check_art_pack.py` krever fortsatt alle de opprinnelige 143 filene. Den godtar ekstra `forge_*`-figurer med delene `head`, `hairback`, `torso`, `pelvis`, `arm`, `leg` og `weapon`, og kontrollerer filene, formatet og alfakanalen. Doble deler, doble filnavn, ukjente ekstra figur-ID-er og ugyldige deltyper avvises.
- **Helteoppløsningen beholdes.** `process_art.py` behandler nye `forge_*`-deler med samme maksimum på 1024 piksler som Thrugg og Valkyra.
- **Lag og masker gjenstår.** De tidligere foreslåtte navnene `hero_face_m.png`, `hero_hair_long.png`, `hero_torso_leather_f.png`, `hero_legs_fur.png` og `hero_weapon_hammer.png` avvises av dagens navnetolker. Lag som skal passe sammen kan heller ikke beskjæres uavhengig uten at plasseringen bevares. Ansiktslag, masker, ikoner og bannere trenger egne kategorier og en avtalt plassering i manifestet.

## Andre planlagte bilder utenfor de 143

Disse finnes heller ikke som bildefiler. De er dokumenterte utvidelser; dagens farer, blod, rekvisitter og menyer bruker kodegrafikk.

| Pakke | Manglende bildefiler eller oppgave |
|---|---|
| Pickups og prosjektiler | `icon_potion`, `icon_chicken`, `icon_ham`, `icon_coin`, `proj_dagger`, `proj_fireball`, `proj_snowball`, `proj_poison` |
| Tittel og sjefskort | `title.png` og `boss_<id>.png`; visning og manifestkobling må også lages |
| Farer | `hazard_spikes`, `hazard_bog`, `hazard_icehole`, `hazard_lava`, `hazard_spiketrap` |
| Ekstra gore-detaljer | `gib_meat_1..3`, `gib_bone`, `gib_eye`, `splat_1..3`; eksisterende 3D-effekter virker allerede |
| FAMILY-detaljer | `gib_duck`, `gib_flower`, `gib_star` |
| Frostpasset | Eget krigsbanner med hornet hodeskalle; mangler godkjent filnavn og egen kategori i innleseren |

Filkontrollen bekrefter fildekning, format, størrelser og alfakanal. Den godkjenner ikke utseende, sømmer eller leddplassering. `tools/tests/hero-forge.mjs` dekker delpool, lagring og opplåsinger; `tools/tests/artcheck.mjs` kontrollerer håndgrep, synlig bakarm og blandede figurer med de ekte bildene. Ridedyr og kjæledyr har fortsatt egen visuell kontroll i `todo.md`.
