# STAGE FORGE (brettverkstedet)

STAGE FORGE er en visuell editor for brettene. Du flytter kulisser i det ekte 3D-bildet, i fire lag fra fjellene langt bak til stammene rett foran kameraet, gir dem animasjon, slår av pynt som lages automatisk, flytter bølger, tønner og farer, og spiller brettet derfra du står. Brettene lagres som JSON-filer i `src/data/layouts/`, én per brett.

## Starte
1. `npm run dev`
2. Åpne `http://localhost:5173/?editor=road` (eller et annet brett: `nightcamp`, `swamp`, `frost`, `scorch`, `tower`). STAGE FORGE ligger også på tittelskjermen under `npm run dev`.

Den publiserte versjonen åpner også editoren med `?editor=road`, men der laster SAVE ned fila i stedet for å skrive den i repoet.

## Skjermen
- **Øverst:** brettet, UNDO og REDO, SAVE, OPEN (les en brettfil), EXPORT (last ned), PLAY FROM HERE, OVERVIEW (kameraet lenger bak), SNAP (låser til 0,25 meter), HELP og EXIT. Til høyre står det om noe ikke er lagret, antall kulisser og rader, og advarsler.
- **Venstre, LIBRARY:** alle kulissene. Søk, eller velg PAINTED (plassholdere tegnet i kode), IMAGES (bilder fra ChatGPT eller dratt inn) eller 3D (modeller fra koden: fyrfat, bål, bannere, steiner, trær). Klikk legger kulissen midt i bildet, du kan dra den inn i bildet, og ROW legger ut en hel rad.
- **Høyre:** egenskapene til det som er valgt. Når ingenting er valgt: brettet (lengde, frø for pynten), lagene (vis, lås, standardlag), GENERATED DECOR (pynten som lages automatisk, kan slås av) og advarsler.
- **Nederst, TIMELINE:** hele brettet sett ovenfra, med kulissene som streker i lagfargene, farer, tønner, bølger og sjefen. Klikk flytter kameraet dit. Bølger, tønner og farer kan dras. + WAVE, + BARREL og + HAZARD legger til nye.

## Mus og taster
| | |
|---|---|
| Klikk | Velg en kulisse (gjennomsiktige deler av et bilde slipper klikket gjennom) |
| Dra | Flytt langs bakken. Alt: også opp og ned. Shift: dybde |
| Høyre eller midtre knapp, hjulet, A og D | Flytt kameraet langs brettet. Shift går fortere. Ctrl og hjulet: oversikt |
| Piltastene | Dytt det valgte (Shift: en meter). Opp og ned er dybde, med Alt høyde |
| [ ] , . F | Skala, vri, speilvend |
| V | Neste variant av rekvisitten (palisade_a, palisade_b ...) |
| Del, Ctrl+D | Slett, dupliser |
| Ctrl+Z, Ctrl+Y | Angre, gjør om (60 steg) |
| Ctrl+S | Lagre |
| P | Spill herfra |
| O | Oversikt |
| 1 2 3 4 | Standardlag for nye kulisser: FAR, BACK, MID, FRONT |
| H eller F1, Esc | Hjelp, fjern valget |

## Lagene
Lagene er dybder i den ekte 3D-scenen, så perspektivet og parallaksen blir riktige av seg selv, også når kameraet trekker seg bakover for kjempen.

| Lag | Dybde (z) | Til |
|---|---|---|
| FAR | -120 til -40 | Fjell, borger og silhuetter langt unna |
| BACK | -40 til -4 | Palisade, telt, bannere og trær bak veien |
| MID | -4 til 4 | Stolper, skilt og vogner ved veikanten. Figurene går mellom -2,6 og 2,6, så hold MID utenfor kamplinja |
| FRONT | 3 til 9,5 | Stammer og busker rett foran kameraet. Tones ned til 40 prosent når en figur står bak, og er litt mørkere |

Editoren varsler når noe står i kamplinja, utenfor brettet eller i feil lag, og når FRONT dekker mer enn en tredjedel av bildet der kameraet låses for en bølge.

## Animasjon
Under ANIMATION på en kulisse:
- **SWAY:** vind, sterkest øverst (trær, busker, gress).
- **SWING:** svinger rundt et ledd (skilt i kjetting). PIVOT er leddet i bildet.
- **BOB:** opp og ned (noe som flyter).
- **SPIN:** snurrer rundt et punkt (vindmøllevinger, vannhjul).
- **FLICKER:** flakker, og kan tenne et lys med farge, styrke og rekkevidde (lykter, fakler).
- **SHEET:** bildeserie (ruter i ett bilde) med antall, rutenett, fart og LOOP, PINGPONG eller ONCE.
- **TRACK:** nøkler over tid for x, y, vridning, skala og gjennomsiktighet, som i POSER i Morbidium. Kråka flyr med en slik.
- **WAVE:** tøy som bølger ut fra en fast kant: LEFT eller RIGHT (stanga på siden, som et flagg) eller TOP (henger fra en stang, som et banner). Ett stillbilde er nok, bildet deles opp og bølger i skyggeleggeren, med litt skygge i foldene.
- **PULSE:** puster (størrelsen) og gløder i takt (sopp, runer, glør).
- **DRIFT:** glir sakte sidelengs over et visst antall meter og kommer inn igjen fra den andre siden, med toning i endene (skyer, tåkebanker, fugleflokker langt borte).
- **REACT:** svarer på det som skjer. WHEN er NEAR (en figur i nærheten), HIT (slag, kast og bakkeslag i nærheten) eller ANY. EFFECT er SHAKE (rister), HOP (hopper), SPIN (snurrer) eller FLEE (flyr eller løper vekk og kommer tilbake etter BACK AFTER sekunder). TEST spiller den med en gang. Kråka på brett 1 flyr når helten kommer, og skiltet rister når noen slåss under det.

Uten egne animasjoner bruker kulissen dem den har i biblioteket. USE THE PROP'S går tilbake til dem. Leddet for SWING og SPIN og punktet for lyset i FLICKER velges ved å klikke i det lille bildet under feltene.

## Deler og sett
En kulisse kan være satt sammen av flere bilder: en vindmølle med vinger som snurrer, et flagg på en stang, et skilt som svinger i kjettingen sin, en stamme med en krone som svaier. Delene er egne bilder med egne animasjoner.
- **PART OF** under PARTS henger den valgte kulissen på en annen. Delen følger animasjonen til den den henger på (svinger skiltet, svinger alt som henger på skiltet), og flyttes, skaleres og speilvendes sammen med den.
- **+ ADD PART** legger en ny del rett på kulissen. Dra den på plass, og gi den en animasjon.
- En del kan henge på en annen del: flammen i lykta henger på lykta, som henger på stolpen, så flammen følger svingen.
- Slettes kulissen, blir delene liggende løse. Ctrl+D dupliserer med alle delene.
- **SAVE AS SET** (på bilder) lagrer delene i manifestet, også hvilken del hver del henger på. Neste gang bildet legges ut, kommer delene med, allerede hengt på. FLAGPOLE + FLAG er et slikt sett, og miljøpakken har seks: lyktestolpe, fakkel, veggfakkel, bål, banner og eik (se `docs/ENVIRONMENT_PACK.md`).

## Varianter
Bilder med samme navn og _a, _b, _2 og så videre til slutt er varianter av samme ting (palisade_a og palisade_b). V bytter til neste variant, og VARIANT-lista viser dem. En rad kan blande inn variantene med MIX VARIANTS. Raden blir lik hver gang, fordi den har sitt eget frø.

## Bilder
Mange bilder fra ChatGPT på én gang (en zip eller en mappe): `python3 tools/process_art.py --fra <zip eller mappe>`. Navnene gjøres om selv (små bokstaver og _, æøå til ae, o og a), og ukjente navn blir kulisser. `python3 tools/prop_gallery.py` lager et galleri over alle kulissene, så du ser dem før du legger dem ut.

Dra PNG-filer rett inn i editoren (eller BROWSE):
- `prop_<navn>.png` blir en kulisse med en gang.
- `anim_<navn>_<kolonner>x<rader>.png` blir en bildeserie (`anim_crow_4x1.png`).
- Samme navn som en plassholder tar over for den og beholder lys, flammer og bevegelse.

Under IMAGE SETTINGS klikker du i bildet for å sette fotpunktet og skriver inn bredden i meter. SELF-LIT gjør at bildet lyser selv, med sine egne farger uten lys og skygge fra scenen (flammer, glør, lava). SAVE lagrer bildet som `public/assets/prop_<navn>.webp` og målene i manifestet.

Spillet henter bare bildene brettfilene bruker når det starter. Editoren henter resten før den åpnes, så biblioteket har alltid alle bildene. Bilder fra ChatGPT bør heller gå gjennom `tools/process_art.py`, som fjerner bakgrunnen og klipper rutene i bildeserier likt (se `docs/ART_PROMPTS.md`, «Kulisser til brettverkstedet»).

## Lagre og spille
- **SAVE** under `npm run dev` skriver `src/data/layouts/<brett>.json` og nye bilder rett i repoet. Siden lastes ikke på nytt. Uten dev-serveren lastes fila ned: legg den i `src/data/layouts/`.
- **PLAY FROM HERE** spiller brettet fra der kameraet står, med det som ikke er lagret. Pausemenyen har BACK TO STAGE FORGE, og alt er som du forlot det.
- Ta med brettfila (og eventuelle nye bilder og `public/assets/manifest.json`) når du committer.

## Generert pynt og frø
Miljøet lager trær, gress, steiner, telt, palisade og mye annet selv. Det skjer med faste frø, så brettet ser likt ut hver gang, og det er delt i blokker som kan slås av under GENERATED DECOR. Brett 1 har slått av den gamle 3D-palisaden, teltene, bålene og bannerne og bruker bildene fra miljøpakken i stedet. DECOR SEED gir en ny variant av pynten (NEW trekker et nytt frø).

## For utviklere
| Fil | Hva |
|---|---|
| `src/data/layout.ts` | Typene, lagene, validering og JSON-formatet (`layoutToJson`), og `levelWithLayout` som legger brettfila over `levels.ts` |
| `src/data/layouts/` | Brettfilene og `index.ts` (`import.meta.glob`, pluss det som ikke er lagret under PLAY FROM HERE) |
| `src/gfx/scenery.ts` | Tegner kulissene med samme lys, tåke og vind som figurene, animasjonene, toningen foran og treff med musa |
| `src/gfx/props/catalog.ts`, `painted.ts` | Katalogen: plassholdere tegnet i kode, bilder fra manifestet (`imageKind`) og 3D-rekvisittene |
| `src/app/scenes/editor.ts` | Editoren (scene og paneler) |
| `src/editor/` | Angrehistorikk, lagring og innlesing, merker i 3D-bildet og stilarket |
| `tools/vite-stage-forge.ts` | Lagringen under `npm run dev` (bare fra maskinen selv) |
| `src/core/math.ts`, `src/gfx/env/common.ts` | Faste frø (`withSeed`) og generatorene (`gen`) |

Tester: `tools/tests/editor.mjs` (hele editoren i nettleseren), `prop-anim.mjs` (deler, sett, varianter og animasjonene, på testbrettet `tools/tests/fixtures/road-placeholders.json`), `env-pack.mjs` (miljøpakken: lastingen, settene og brett 1), `forge-save.mjs` (lagring gjennom dev-serveren) og `prop-images.mjs` (bilder som tar over for plassholderne). For agenter finnes skillene `stage-forge`, `prop-art` og `new-level` i `.claude/skills/` (se `docs/SKILLS.md`).
