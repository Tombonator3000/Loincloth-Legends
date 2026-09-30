# Hero Forge: felles pool av malte deler

Oppdatert 30. september 2026. Hero Forge har nå 60 malte delvalg: 19 fra grunnpakken og 41 Forge-bilder, inkludert to redigerbare grunnhoder. I tillegg kommer 16 separate bilder for hår, skjegg, hodeplagg og øyne. Kunstpakken består av 143 grunnfiler, 41 Forge-deler og 16 utseendelag, totalt 200 bildefiler.

## Hva som faktisk manglet

Alle **143 filer i den opprinnelige kunstbestillingen finnes**. `python3 tools/check_art_pack.py` gikk gjennom: 89 figurdeler, 12 ridedyrdeler, fem kjæledyr, 28 teksturer, åtte himler og kartet. Ingen av manifestets bildefiler mangler, og det ligger ingen andre bildefiler løst i `public/assets/`.

Problemet i Hero Forge var koblingen til bildene. `buildHeroDef()` arvet bildene fra Thrugg eller Valkyra bare når samtlige utseendevalg passet et uendret preset. Ett endret valg fjernet hele denne arven, så figuren fikk prosedyretegningene igjen. De ferdige delene var ikke en felles, fritt valgbar pool.

`docs/CHATGPT_PROMPT.md` sin 143-filers sjekkliste omfatter grunnpakken. Delpoolen og de separate utseendelagene nedenfor utvider den; de skal ikke bestilles på nytt som manglende grunnfiler.

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

Tolv nye bilder gir to ekstra valg i hver kategori. Orc-delene bruker en kvinnelig kropp, frostkrigeren en mannlig kropp. Begge følger samme helterigg og kan blandes med de andre delene. Den opprinnelige hudfargen er malt inn; hudmaskene i fjerde tillegg gjør den redigerbar.

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

## Tredje tillegg: Ash Raider, Iron Warden og fire våpen

Ti kroppsdeler og fire våpen kan velges hver for seg i smia. Ash Raider er en voksen kvinne over 30 med mørk umbrahud, kort svart hår og en heldekkende bronsevest over slitt rustrødt lær. Iron Warden har mannlig kroppstype, lukket jernrustning og mørkerødt tøy. Delene følger de nye reglene for nær skulder til venstre, hel hals på hodet og overkropp uten halsstump.

| Ferdig fil i `public/assets/` | Innhold | Opplåsing |
|---|---|---|
| `forge_ash_head.webp` | ASH RAIDER, kort svart hår og mørk umbrahud. | Tilgjengelig fra start |
| `forge_ash_torso.webp` | Heldekkende bronsevest over slitt rustrødt lær, kvinnelig kroppstype (`body: 1`). | Tilgjengelig fra start |
| `forge_ash_pelvis.webp` | Bredt bronse-/lærbelte og kort rustrødt krigsskjørt. | Tilgjengelig fra start |
| `forge_ash_arm.webp` | Mørk arm med lærbeskytter, brukt foran og bak. | Tilgjengelig fra start |
| `forge_ash_leg.webp` | Mørkt bein med lærstøvel, brukt på begge sider. | Tilgjengelig fra start |
| `forge_warden_head.webp` | WARDEN GREATHELM, lukket hjelm av jern. | `helmet:5`: slå Frostjarl Kaldor |
| `forge_warden_torso.webp` | Jernpanser, mannlig kroppstype (`body: 0`). | Tilgjengelig fra start |
| `forge_warden_pelvis.webp` | Jernplater på belte med mørkerødt tøy. | Tilgjengelig fra start |
| `forge_warden_arm.webp` | Rustningsarm med jernhanske, brukt foran og bak. | Tilgjengelig fra start |
| `forge_warden_leg.webp` | Bein i jernskinner og rustningsstøvel. | Tilgjengelig fra start |
| `forge_cleaver_weapon.webp` | RAIDER CLEAVER; SWORD-egenskaper (`weapon: 0`). | Tilgjengelig fra start |
| `forge_doubleaxe_weapon.webp` | DOUBLE AXE; AXE-egenskaper (`weapon: 1`). | Tilgjengelig fra start |
| `forge_maul_weapon.webp` | IRON MAUL; WARHAMMER-egenskaper (`weapon: 2`). | `weapon:2`: slå Big Mama Hogmother |
| `forge_flangedmace_weapon.webp` | FLANGED MACE; SPIKED CLUB-egenskaper (`weapon: 3`). | `weapon:3`: vinn Bone Coliseum |

To fiender bruker de samme delene. `src/gfx/chars/raiders.ts` bygger dem med `buildHeroDef()`, egne klassiske reservevalg og stabile figur-ID-er. `FOES` i `src/data/enemies.ts` gir dem eksisterende nærkamplogikk og angrepsposer. Spillerens opplåsinger begrenser valgene i smia, ikke utstyret til fiender i brettene.

| Fiende-ID | Kropp og våpen | Faktiske bølger i `src/data/levels.ts` |
|---|---|---|
| `ashraider` | `forge_ash` med `forge_doubleaxe`, rask nærkamp med øksehogg. | Scorchlands bølge 2 ved x=34 og bølge 4 ved x=92; erstatter én Ember Skeleton i hver. |
| `ironwarden` | `forge_warden` med `forge_maul`, langsom hammerfiende som må vakles ut av rustningen. | Tower bølge 1 ved x=8 og bølge 4 ved x=92; erstatter én Hog Guard i hver. |

Bølgene beholder antall fiender, samtidighetsgrenser og ryttere. Ingen ny kampmotor eller rigg er nødvendig. Denne runden omfatter også erstatningsbilder for `hogmother_torso.webp`, `imp_arm.webp` og `gorthak_arm.webp`; de erstatter eksisterende filer og øker ikke totalen. De nye delene og erstatningsbildene er kontrollert i spillets figurgalleri og visuelt godkjent. Produksjonsprompter er samlet i [kunstpakkens promptlogg](../art/prompts/forge-armory-2026-09-30.json).

Etter tredje tillegg hadde poolen elleve hoder, elleve våpen og ni valg i hver av kategoriene overkropp, belte, arm og bein. Fjerde tillegg gir to nye grunnhoder, altså 13 hoder og 60 delvalg. Valkyras bakhår kommer i tillegg og følger hennes gamle hode automatisk. Hudfargen kan endres gjennom de registrerte hudmaskene; metall, lær og tøy beholder bildets materialfarge.

Claudes justering av armer og våpen er bevart: lasteren finner skulder, neve og grep, og riggen roterer og skalerer armen rundt skulderen slik at neven møter våpenet. `hand`, `anchor` og `height` i manifestet brukes når en del krever målte verdier. Både hovedarm og bakarm bruker samme bilde.

## Kalibrering og kontroll

Riggen står i trekvart profil (30. september): våpenarmen henger fra den nære skulderen, til venstre i overkroppsbildet, og ligger foran, mens den andre armen ligger bak overkroppen. Hodet ligger bak kragen. Hver overkropp har derfor målte skulderledd og halsrot (`shoulders` og `neck`, se `docs/ART_PROMPTS.md` under Manifest). Halsstumpen på de fire overkroppene tones ut over halsroten (tredje verdi i `neck`). Reglene for nye deler står i `docs/GPT_BESKJED.md`.

Hodene fra de to første tilleggene har egne høyder, slik at selve ansiktet ikke blir like stort som hele Thrugg-hjelmen. Beltenes buede overkant og torsoenes avrundede nedkant krever et uttrykkelig festepunkt. Tabellen viser verdier kontrollert på sammensatte figurer i fire poser. Ankerverdiene er brøker av det beskårne bildet, med y fra toppen. Ash-/Warden-delene er målt og kontrollert både som hele figurer og i blandede oppsett. Den nye Hogmother-overkroppen er kontrollert på Hogmother. Disse tre overkroppene har ingen halsstump og bruker derfor ingen uttoning i `neck`.

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
| `forge_leather` overkropp | `shoulders`, `neck` | [[0.08, 0.31], [0.93, 0.33]], [0.51, 0.12, 0.1] |
| `forge_plate` overkropp | `shoulders`, `neck` | [[0.09, 0.26], [0.88, 0.26]], [0.37, 0.12, 0.07] |
| `forge_orc` overkropp | `shoulders`, `neck` | [[0.08, 0.26], [0.91, 0.27]], [0.5, 0.12, 0.1] |
| `forge_frost` overkropp | `shoulders`, `neck` | [[0.06, 0.31], [0.92, 0.33]], [0.505, 0.12, 0.1] |
| `forge_orc` belte | `anchor` | [0.52, 0.19] |
| `forge_frost` belte | `anchor` | [0.53, 0.19] |
| `forge_ash` hode | `height` | 0.84 |
| `forge_warden` hode | `height` | 0.86 |
| `forge_ash` og `forge_warden` overkropp | `anchor` | [0.55, 0.96] |
| `forge_ash` overkropp | `shoulders`, `neck` | [[0.10, 0.17], [0.94, 0.23]], [0.55, 0.18] |
| `forge_warden` overkropp | `shoulders`, `neck` | [[0.10, 0.19], [0.94, 0.19]], [0.52, 0.12] |
| `forge_ash` og `forge_warden` belte | `anchor` | [0.52, 0.20] |
| `hogmother` ny overkropp | `shoulders`, `neck` | [[0.05, 0.19], [0.97, 0.22]], [0.52, 0.12] |

Armer, bein og hammer i det første tillegget bruker automatisk måling. Dette tillegget ble kontrollert med våpengrep på de 13 opprinnelige bevæpnede figurene og fire blandinger i tre poser. Galleriet viste de fire blandingene i fire poser med leddmarkører. Det er nødvendig å se på bildene i tillegg til å måle grepet: første kontroll fant en skulderglippe med utstrakt arm selv om neven traff våpenleddet. Torsoankrene over er justert for dette. Alfakontakttesten krever at overkroppen faktisk møter den øvre delen av armen i utstrakt pose; den negative kontrollen flytter armen 0,35 enheter ut fra skulderen og avvises.

Andre tillegg er kontrollert både som hele orc-/frostsett og med lemmer og belter fra første tillegg. Alle åtte blandinger har kontakt mellom arm og overkropp. De fire nye blandingene viser 57 til 75 prosent av bakarmen, og neven er maksimalt 0.006 enheter fra våpenleddet. Nye armer, bein, sabel og beinklubbe bruker automatisk måling. Nettlesertesten dekker også frost- og klubbelås, begge spilleres lagring og ny lasting, faktiske bilder i forhåndsvisningen og det siste hodekortet på mobil.

Tredje tillegg er ferdig kontrollert med hele Ash-/Warden-sett og blandinger med de tidligere delene. Alle tolv blandinger består testen for skulderkontakt, og de fire nye blandingene består testen for kontakt mellom hals og overkropp. Begge nye armer bruker automatisk måling av håndpunktet, uten eget `hand`-felt. Galleriet er gjennomgått visuelt: nye figurer, kryssblandinger og de reparerte bildene for Hogmother, imp-arm og Gorthak-arm er godkjent. Ash-overkroppen er en bronsevest; de separate armene tilfører de bare skuldrene.

## Fjerde tillegg: redigerbare hoder og 16 separate utseendelag

`forge_custom_m_head.webp` og `forge_custom_f_head.webp` er skallede, skjeggløse grunnhoder med hel hals, til en voksen mann og en voksen kvinne. De følger samme helterigg og kan brukes med enhver overkropp. De gamle elleve hodene er beholdt. Hår, skjegg, hodeplagg og ansiktsdetaljer som allerede er malt inn i disse hodene, kan ikke fjernes som egne lag.

| Gruppe | Filer i `public/assets/` | Antall bilder |
|---|---|---:|
| Grunnhoder | `forge_custom_m_head.webp`, `forge_custom_f_head.webp` | 2 Forge-deler |
| Hår | `appearance_hair_crop.webp`, `appearance_hair_wild.webp`, `appearance_hair_mohawk.webp`, `appearance_hair_braids.webp`, `appearance_hair_topknot.webp`, `appearance_hair_long.webp`, `appearance_hair_long_back.webp` | 7 |
| Skjegg | `appearance_beard_full.webp`, `appearance_beard_braided.webp`, `appearance_beard_mustache.webp` | 3 |
| Hodeplagg | `appearance_headgear_horned.webp`, `appearance_headgear_crown.webp`, `appearance_headgear_headband.webp`, `appearance_headgear_skull.webp` | 4 |
| Iris | `appearance_eye_natural.webp`, `appearance_eye_slit.webp` | 2 |

De sju hårbildene gir seks frisyrer; LONG bruker både front- og bakbildet. NONE fjerner det valgte hår-, skjegg- eller hodeplagglaget og trenger ingen fil. HORNED HELMET og BEAST SKULL dekker fronthåret, mens langt bakhår fortsatt vises. Hårvalget beholdes og vises igjen når hjelmen tas av. Skjegg ligger foran kragen, bakhår bak kroppen, og alle lagene følger hodets animasjon.

`HeroConfig.appearance` lagrer sju uavhengige felt:

| Felt | Funksjon |
|---|---|
| `hair` | NONE eller en av seks malte frisyrer |
| `beard` | NONE, FULL BEARD, BRAIDED BEARD eller MUSTACHE |
| `headgear` | NONE eller fire malte hodeplagg |
| `skinTone` | ORIGINAL og sju hudfarger, brukt bare innenfor hudmaskene |
| `eyeColor` | ORIGINAL og sju irisfarger |
| `hairColor` | ORIGINAL og sju farger for hår og skjegg |
| `eyeStyle` | NATURAL eller SLIT PUPIL |

FROST BLUE følger `skin:6`, WIZARD BLUE følger `hairColor:6`, CROWN følger `helmet:4` og BEAST SKULL følger `helmet:3`. Låste valg kan undersøkes i smia, men blir ikke utstyrt; tilfeldig helt og lagringsleseren følger samme låser.

HERO PARTS og HEAD DETAILS er to sider i smia. Hodedetaljsiden tilbyr alltid hodevalg og, når den valgte blandingen har hud, hudfarge. De seks andre detaljfeltene vises bare for et redigerbart grunnhode. Med et gammelt hode forklarer siden begrensningen og tilbyr CUSTOM MALE og CUSTOM FEMALE. Det å besøke siden bytter ikke hode. Et uttrykkelig bytte beholder kropp, våpen og lagrede detaljvalg. Klassisk bygger og gamle lagringer beholdes, med egne utkast for begge spillere; CANCEL lagrer ingenting.

`src/data/hero-skin-regions.ts` registrerer alle de 49 hode- og kroppsdelene i poolen. Polygoner avgrenser eksponert hud og beskytter blant annet rustning, lær, hår og øyne. Tomme områder betyr at delen er kontrollert og ikke viser hud, slik som Warden-rustningen. En fargefamiliesjekk finjusterer pikslene innenfor maskene. Ukjente fremtidige deler omfarges ikke før de har egne områder. Dette er data i koden, ikke ekstra bildefiler. Hår/skjegg omfarges som selvstendige lag, og irisomfarging bevarer pupill og lyse glimt. ORIGINAL bruker kildens farger.

Lagplasseringene ligger i `src/data/hero-appearance-layout.ts`, målt per grunnhode i det beskårne bildet. Komposisjonen lager egne lerreter og bevarer halsledd og skala når hår eller skjegg utvider bildeflaten. Delte originalbilder endres aldri. Forhåndsvisning, kamp, duell, portrett og løse hoder bruker samme sammensatte utseende.

## Hva fri finjustering fortsatt trenger

- Flere ansiktsbaser og ansiktsuttrykk utover de to redigerbare grunnhodene.
- Tøymasker eller egne materialelag for fri farge på lendeklede og annet tøy. Det malte systemet har foreløpig hud-, hår-/skjegg- og øyefarger.
- Nye kroppstyper som dverg og halvtroll må få egen rigg og kunst som passer den; de er ikke bare en ekstra farge.

Thrugg, Valkyra og Gorthak har helteoverkropper i trekvart profil. Mange fiender er tegnet fra siden, har fremskutt hals og helt andre skulderfester. Ikke legg samtlige fiendedeler i heltepoolen uten å tilpasse og kontrollere dem. Våpen kan gjenbrukes når grep og størrelse passer.

## Innlesing av flere deler

`process_art.py` godtar allerede vilkårlige figurnavn med støttet del til slutt. `forge_warhammer_weapon.png` blir eksempelvis `char: forge_warhammer`, `part: weapon`, `file: forge_warhammer_weapon.webp`. Hvert nytt bilde må også ha et valg i delkatalogen med riktig våpenklasse og eventuelt opplåsingskrav. Hammeren er allerede registrert begge steder.

Innlesing og kontroll er klargjort for de nye standarddelene:

- **Kunstkontrollen er utvidet.** `check_art_pack.py` krever fortsatt alle de opprinnelige 143 filene. Den godtar ekstra `forge_*`-figurer med delene `head`, `hairback`, `torso`, `pelvis`, `arm`, `leg` og `weapon`, og kontrollerer filene, formatet og alfakanalen. Doble deler, doble filnavn, ukjente ekstra figur-ID-er og ugyldige deltyper avvises.
- **Helteoppløsningen beholdes.** `process_art.py` behandler nye `forge_*`-deler med samme maksimum på 1024 piksler som Thrugg og Valkyra.
- **Utseendelag har egen kategori.** `appearance_<hair|beard|headgear|eye>_<navn>.png` behandles til WebP og registreres som `{ "id": "appearance_hair_crop", "file": "appearance_hair_crop.webp" }` i manifestets `appearance`-liste. Lagene beskjæres hver for seg; `hero-appearance-layout.ts` må derfor måles mot de ferdige filene. Iris beholdes opptil 512 px, de andre lagene opptil 1024 px. Katalogvalg registreres i `hero-appearance.ts`. De eldre forslagene med `hero_face_*` og `hero_hair_*` brukes ikke.
- **Hudmasker er registrerte polygoner.** Et nytt hode eller en ny kroppsdel skal få bekreftede områder, eller et uttrykkelig tomt område ved heldekkende rustning, i `hero-skin-regions.ts`. Ved erstatning av bildet må både ledd og materialmasker kontrolleres på nytt.

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
