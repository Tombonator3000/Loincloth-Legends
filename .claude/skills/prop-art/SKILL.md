---
name: prop-art
description: Bestill og ta imot malte kulisser og bildeserier (sprite sheets) fra ChatGPT til brettene i Loincloth Legends. Filnavn prop_<navn>.png og anim_<navn>_<K>x<R>.png, KULISSE-BLOKKEN, reglene for ruter, tools/process_art.py og justering i STAGE FORGE. Bruk når Tom vil ha nye stolper, telt, trær, bannere, fakler eller andre kulisser, med eller uten animasjon, eller når bilder fra ChatGPT ligger i art/inbox.
---

# Kulisser og bildeserier fra ChatGPT

## Flyten
1. Tom limer inn KULISSE-BLOKKEN fra `docs/ART_PROMPTS.md` (delen «Kulisser til brettverkstedet») i en egen samtale med ChatGPT, og bestiller én kulisse om gangen med linjene derfra.
2. Bildet lagres i `art/inbox/` med riktig filnavn (under).
3. `python3 tools/process_art.py --sjekk` viser hva som vil skje. `python3 tools/process_art.py` gjør det: bakgrunnen fjernes hvis bildet ikke er gjennomsiktig, bildet beskjæres, rutene i bildeserier klippes med den samme boksen, og alt lagres som `public/assets/prop_<navn>.webp` med manifestet oppdatert (`props`).
4. `python3 tools/check_art_pack.py`.
5. STAGE FORGE (`npm run dev`, `?editor=road`): velg kulissen og juster bredde (WIDTH), fotpunkt (klikk i bildet under IMAGE SETTINGS) og lag. SAVE skriver det til manifestet.

Mange bilder på én gang (zip eller mappe, også med rare navn): `python3 tools/process_art.py --fra <zip> --sjekk` viser hva navnene blir, uten `--sjekk` legges de i innboksen og behandles. Se over dem med `python3 tools/prop_gallery.py --ut <fil.png>` før du legger dem ut.

Bilder Tom laster opp i chatten havner i `/root/.claude/uploads/<økt>/`. Den mappa har også Toms referansebilder og konseptbilder, som ikke skal inn i repoet. Kopier bare de nye filene (zip-en eller PNG-ene fra denne meldingen) til en egen mappe i scratchpad, og kjør `--fra` på den. En hash foran navnet (`1a2b3c4d-`) fjernes av verktøyet.

Bilder kan også dras rett inn i editoren med de samme filnavnene. Da vises de med en gang og lagres ved SAVE, men uten bakgrunnsfjerning, og bildeserier klippes ikke. Bilder fra ChatGPT går gjennom `process_art.py`.

## Filnavn
- `prop_<navn>.png`: ett bilde. `anim_<navn>_<K>x<R>.png`: bildeserie med K kolonner og R rader, lest fra venstre og ovenfra (`anim_crow_4x1.png`, `anim_banner_red_4x2.png`).
- `<navn>` har bare a-z, 0-9 og _ (ikke æ, ø eller å), høyst 40 tegn. Et feil navn stopper hele kjøringen, og ingenting flyttes.
- Samme navn som en plassholder i `src/gfx/props/catalog.ts` tar over for den og beholder mål, lys, flammer og bevegelse: palisade_a, palisade_b, tent_red, tent_purple, signpost, signpost_sign, roadpost, skullpike, tree_front_oak, bush_front, cart, banner_red, banner_purple, crow, torch. Et navn fra 3D-rekvisittene (brazier, rock, tree_oak ...) bytter 3D-modellen mot bildet.
- Et stillbilde i stedet for en bildeserie (`prop_torch.png`) mister bildeserien, men beholder lyset og flammene. En bildeserie får farten plassholderen hadde, ellers 10 bilder i sekundet i løkke.
- Nye navn får bredde ut fra formen (1, 1,6 eller 3 meter) og fotpunkt nederst på midten. Juster i editoren.
- I manifestet står rutenettet som `grid` og `n` (hører til bildet). `anim` i manifestet er hele animasjonslista og går foran plassholderens (se `imageKind` i catalog.ts).

## Varianter, forgrunn og deler
- Varianter: samme navn med `_a`, `_b` eller `_1`, `_2` til slutt. V bytter mellom dem i editoren, og rader kan blande dem.
- `front` eller `foreground` i navnet gir laget FRONT, `far`, `distant` eller `background` gir FAR, og `back` gir BACK.
- Deler til animasjon: ett bilde per del med samme begynnelse (`windmill_body`, `windmill_blades`). Sett dem sammen med PART OF i editoren, gi hver del sin animasjon, og lagre med SAVE AS SET (settet havner i manifestet som `preset`).
- Tøy trenger ingen bildeserie: et stillbilde av tøyet alene får WAVE.

## Regler for bildeserier
Fra Morbidium (`tools/behandle_bilder.py`) og dokumentasjonen til Scenario (bare reglene, ikke tjenesten):
- Høyst 6 x 6 ruter. 4x1 og 4x2 er vanligst. ChatGPT lager 1024x1024, 1536x1024 eller 1024x1536, så velg et rutenett som går opp i bildet.
- Samme størrelse, målestokk og fotpunkt (bakkelinje) i alle rutene. Tingen skal ikke krysse skillelinjene.
- Ingen rammer, linjer eller tall mellom rutene. Gjennomsiktig eller ensfarget bakgrunn.
- Løkker: det siste bildet skal ikke være likt det første, for løkka går tilbake til det første selv. `process_art.py` varsler.
- Tomme ruter til slutt telles ikke med (7 bilder i 4x2 er greit).
- Står tegningene skjevt i én rad, finner `process_art.py` dem ved de tomme stripene mellom dem (`ark_ruter` fra Morbidium). Med flere rader deles arket likt.

## Stil
Kulissene skal passe figurene: nesten ekte, som et påkostet mattemaleri, sett rett fra siden i øyehøyde, mykt jevnt lys forfra, ingen kastet skygge og ingen bakke. Spillet lager lys, skygge, tåke og vind selv. Ikke tegneserie, ingen tekst, alt originalt.

## Ikke
- Ikke legg Toms referansebilder eller konseptbilder i repoet uten å spørre. Repoet er offentlig.
- Originalene i `art/inbox/` skal ikke i git, bare filene i `public/assets/`.
- Ikke skriv manifestet for hånd når verktøyet kan gjøre det.
