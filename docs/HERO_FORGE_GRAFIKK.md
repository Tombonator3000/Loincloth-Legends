# Hero Forge: grafikkstatus og neste deler

Kontrollert 30. september 2026 mot repoets manifest, bildefiler, kunstlister og kode. Dette er en oversikt over eksisterende og manglende grafikk. Ingen nye bilder er produsert i denne endringen.

## Hva som faktisk manglet

Alle **143 filer i den opprinnelige kunstbestillingen finnes**. `python3 tools/check_art_pack.py` gikk gjennom: 89 figurdeler, 12 ridedyrdeler, fem kjæledyr, 28 teksturer, åtte himler og kartet. Ingen av manifestets bildefiler mangler, og det ligger ingen andre bildefiler løst i `public/assets/`.

Problemet i Hero Forge var koblingen til bildene. `buildHeroDef()` arvet bildene fra Thrugg eller Valkyra bare når samtlige utseendevalg passet et uendret preset. Ett endret valg fjernet hele denne arven, så figuren fikk prosedyretegningene igjen. De ferdige delene var ikke en felles, fritt valgbar pool.

`docs/CHATGPT_PROMPT.md` sin 143-filers sjekkliste omfatter ikke den utvidede heltebyggeren. Den opprinnelige briefen beskrev bare uendrede presets; den er nå merket med lenke til denne mangellisten. Separate ansikter, hår, hjelmer og skjegg står under «Planlagt (ikke koblet inn i koden ennå)» i `docs/ART_PROMPTS.md`. Disse filene finnes ikke.

## Første pool, med eksisterende bilder

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

De fire våpenbildene dekker sverd, to økseutseender og piggklubbe. **WARHAMMER mangler et malt bilde**. At våpenklassen allerede finnes i spilldataene gjør ikke hammergrafikken ferdig.

## Neste kunstbestilling: 13 nye deler

Dette er et foreslått første tillegg med tydelig forskjellige silhuetter. Navnene nedenfor er en kontrakt for produksjonen, ikke filer som allerede finnes. Behold materialer, lys og detaljnivå fra den godkjente kunsten.

| Prioritet | Foreslått original i `art/inbox/` | Innhold |
|---|---|---|
| 1 | `forge_warhammer_weapon.png` | Tung krigshammer av slitt jern, kort bredt hammerhode, lærviklet skaft. Kobles til WARHAMMER. |
| 2 | `forge_bald_head.png` | Voksen mann, barbert hode, brekt nese og kort skjeggstubb, varm hud som Thrugg. |
| 2 | `forge_eyepatch_head.png` | Voksen mann med øyelapp, grovt ansikt og kort mørkt hår, varm hud som Thrugg. |
| 2 | `forge_crownbraid_head.png` | Voksen kvinne med stram flettet hårkrans og bestemt uttrykk, lys hud som Valkyra. Alt hår over nakkeleddet. |
| 2 | `forge_silvercut_head.png` | Voksen kvinne med kort sølvgrått hår, arr og skjevt smil, lys hud som Valkyra. |
| 3 | `forge_leather_torso.png` | Bred mannlig overkropp med slitt lærsele og brystvern, varm hud som Thrugg. |
| 3 | `forge_plate_torso.png` | Kraftig kvinnelig overkropp i bulkete brystpanser, lys hud som Valkyra. |
| 3 | `forge_kilt_pelvis.png` | Kort mørkerød krigskilt på bredt lærbelte. Ingen hud eller bein. |
| 3 | `forge_tassets_pelvis.png` | Belte med overlappende jernplater og slitte lærremmer. Ingen hud eller bein. |
| 3 | `forge_leather_arm.png` | Kraftig arm med enkle lærbeskyttere, varm hud som Thrugg. |
| 3 | `forge_plate_arm.png` | Kraftig arm med jernskinne og hanske, lys hud som Valkyra ved skulderen. |
| 3 | `forge_sandals_leg.png` | Sterkt bein med lærremmer og tunge sandaler, varm hud som Thrugg. |
| 3 | `forge_greaves_leg.png` | Sterkt bein med bulkete jernskinne og støvel, lys hud som Valkyra ved hoften. |

Hoder, overkropper og belter: 1024 x 1024. Armer, bein og våpen: 1024 x 1536. Ekte transparent PNG, én del per bilde, vendt mot høyre. Bruk heltemalene i `docs/CHATGPT_PROMPT.md`, mål leddpunktene etter behandling, og kontroller delene i blandede figurer. Det er ikke nødvendig å lage hvert fargevalg som en egen komplett figur.

## Hva fri finjustering fortsatt trenger

Poolen over bytter hele malte deler. Hår, skjegg, hjelm og hudfarge er i hovedsak malt inn i dem. De gamle valgene finnes fortsatt i den klassiske, prosedyretegnede modusen. For tilsvarende frihet med malt grafikk trengs:

- Ansiktsbaser og egne lag for hår, skjegg og hodeplagg, med felles lerret og målte festepunkter. Langt bakhår må tilhøre riktig hårvalg.
- Hud-, hår- og tøymasker, eller avgrensede materialelag, slik at fargevalg lar metall og lær beholde fargen. En farge lagt over hele bildet er ikke tilstrekkelig.
- En fast lagrekkefølge og regler for hvilke hårtyper som passer under hver hjelm. «Ingen» trenger ingen bildefil.
- Nye kroppstyper som dverg og halvtroll må få egen rigg og kunst som passer den; de er ikke bare en ekstra farge.

Thrugg, Valkyra og Gorthak har helteoverkropper i trekvart profil. Mange fiender er tegnet fra siden, har fremskutt hals og helt andre skulderfester. Ikke legg samtlige fiendedeler i heltepoolen uten å tilpasse og kontrollere dem. Våpen kan gjenbrukes når grep og størrelse passer.

## Innlesing før neste kunstpakke

`process_art.py` godtar allerede vilkårlige figurnavn med støttet del til slutt. `forge_warhammer_weapon.png` blir eksempelvis `char: forge_warhammer`, `part: weapon`, `file: forge_warhammer_weapon.webp`. Men filen må også legges inn som valg i delkatalogen med riktig våpenklasse og eventuelt opplåsingskrav.

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

Filkontrollen bekrefter fildekning, format, størrelser og alfakanal. Den godkjenner ikke utseende, sømmer eller leddplassering. Samlet visuell kontroll av kunstpakken står fortsatt som egen oppgave i `todo.md`.
