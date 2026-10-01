# Plan: brettverksted, gørr, AI og teksturer

30. september 2026. Tom ba om:
- en visuell editor der han kan lage og endre brettene, i lag (fram, midt, bak), med PNG-er som kan ha animasjon, for eksempel en stolpe ved veien eller et stort tre rett foran kameraet som skjuler litt og gir dybde
- å se om animasjonssystemet i Morbidium kan brukes her
- blod som spruter når en kroppsdel kuttes av, og når en fiende deles i to: blod som står opp og en underkropp som løper litt fram og tilbake før den faller sammen
- bedre AI, med en titt på hvordan moderne Golden Axe-kloner gjør det
- forslag til andre forbedringer
- teksturer på palisaden og lignende på brettene

Dette dokumentet er planen. Arbeidet er delt i runder som hver kan spilles og testes for seg. Én feil ble rettet med en gang, fordi den forklarte mye av det Tom så (del 1).

Status øverst: hva som er gjort.
1. Rettet i dag: blodet som ikke synes
2. Rekkefølge
3. Brettverkstedet (STAGE FORGE)
4. Animasjon, og hva vi tar fra Morbidium
5. Gørr
6. AI
7. Teksturer på palisaden og resten
8. Andre forbedringer
9. Bestilling til GPT (kan sendes nå)
10. Kilder

---

## Status

**1. oktober 2026: runde E er i gang** (Tom: «sluttkampen i faser sammen med runde E»). Ferdig: sjefer i faser (6.4 punkt 5) med måltidet, dykket, lavasporet og speilbildene, vinduer etter store trekk og røde trekk, og sluttkampen i tårnet (vaktene med dører som skjold reiser seg, skjoldet fra søylene, Solhjertet). Grensen for evige komboer og forsvaret (punkt 3 og 4), tempostyringen med bølgebudsjett (punkt 1) og vanskelighetsgraden (punkt 6). Gjenstår: de nye fiendetypene (punkt 2) og ridedyrene (punkt 7). Detaljene står i `docs/ARCHITECTURE.md` under «Sjefer i faser og sluttkampen», «Komboer og forsvar» og «Tempo og vanskelighetsgrad». Runde D er ikke gjort; det runde E bygger på av den, tas med der det trengs.

**30. september 2026, kveld: runde B og C er ferdige.** Brettene har malte kulisser i fire lag med animasjon og forgrunn som tones ut, brettfiler i JSON, faste frø for pynten, og brettverkstedet STAGE FORGE. Bruken står i `docs/STAGE_FORGE.md`, og skillene agentene bruker, i `docs/SKILLS.md`.

Der det ble annerledes enn planen under:
- Editoren er en scene i spillet (`?editor=road`, og STAGE FORGE på tittelskjermen under `npm run dev`), ikke en egen `editor.html`. Da deler den alt med spillet og går rett til PLAY FROM HERE og tilbake.
- Bilder dratt inn i editoren lagres rett som `public/assets/prop_<navn>.webp` med manifestet oppdatert. Bilder fra ChatGPT går gjennom `tools/process_art.py`, som nå kjenner `prop_<navn>.png` og `anim_<navn>_<K>x<R>.png`.
- Bildeserier: rutenettet står i manifestet som `grid` og `n` (hører til bildet), fart og løkke i animasjonen. Bredde og fotpunkt er `w` og `anchor` som for figurdelene, ikke `w`, `h`, `ax` og `ay` som i Morbidium.
- Sporformatet fra POSER brukes på kulissene (`track` med x, y, vridning, skala og gjennomsiktighet). På riggens stillinger kommer det sammen med gørret (runde A) eller AI (runde E).
- `tools/export_layouts.mjs` trengs ikke. Bølger, tønner, farer og ryttere kopieres fra `levels.ts` inn i brettfila første gang de endres i editoren.
- Toningen foran kameraet ser på punkter på figurene mot selve bildet, så gjennomsiktige deler ikke teller. Angre har 60 steg.
- Ikke gjort ennå: gjøre en generator om til enkeltkulisser («bake inn»), `solid` og `breakable` på kulisser, og kulisser i flere deler (lagdukke).

Neste er runde A (gørr og teksturer) eller D (AI), etter hva Tom vil først.

---

## 1. Rettet i dag: blodet som ikke synes

Skjermbilder fra brett 1 viste at det ikke sprutet blod når en arm røk, og at todelingen bare ga noen flekker på bakken. Blodet ble sluppet ut (46 dråper i lufta 0,2 sekunder etter armkuttet), men ingen av dråpene ble tegnet.

Feilen sto i skyggeleggeren til partiklene (`GLOW_VERT` i `src/gfx/vfx.ts`) og har vært der siden GPU-partiklene kom inn 29. september (59b300f). Dråper i fart strekkes i fartsretningen, og i den grenen ble firkanten speilvendt. Da vender baksiden mot kameraet, og skjermkortet tegner ikke baksider. Blodråper strekkes alltid, så alt blod i lufta var borte, og bare flekkene på bakken kom fram. Gnistene forsvant på samme måte. Sjokkbølgene på bakken (landinger, magi, eksplosjoner) lå med forsiden ned og syntes heller ikke.

Begge deler er rettet. Nå spruter blodet fra skulderen når armen ryker, todelingen gir en fontene rett opp fra beina, og ringene synes på bakken. Den nye testen `tools/tests/particles.mjs` teller piksler i egne farger for dråper, gnister, ringer og en arm som ryker. Mot den gamle koden gir den 0 piksler på alle fire, med rettingen er alle grønne. screenfx (31 av 31), homage, metalmode og violence er også grønne.

Det blir mye mer blod på skjermen enn Tom har sett den siste dagen. Standard er EXCESSIVE. Er det for mye, kan det skrus ned i gore-innstillingen, eller så justerer jeg mengden.

---

## 2. Rekkefølge

| Runde | Innhold | Hvorfor da |
|---|---|---|
| A | Gørr: beina løper etter todeling, sprut som pulserer, kuttflater. Teksturer på palisade, telt, stolper og hytter (med reserve i kode til GPT leverer). Spilltid i stedet for `setTimeout`. | Små endringer som synes med en gang. |
| B | Rekvisitter i lag i spillet: PNG-er med animasjon, forgrunn som tones ut, brettfiler i JSON og faste frø for den tilfeldige pynten. | Grunnmuren editoren står på. Gir også malte palisader og det store treet foran kameraet. |
| C | STAGE FORGE, selve editoren. | Trenger B. |
| D | AI del 1: én plass på hver side av helten, regler for rettferdighet, felles varsling før angrep, målinger i `ai.mjs`. | Mest spillfølelse per arbeid. |
| E | AI del 2: tempostyring, nye fiendetyper, sjefer i faser, grense for evige komboer. | Bygger på D. |

D kan tas før C hvis Tom heller vil spille enn bygge brett først. Bestillingen til GPT i del 9 kan sendes nå, så bildene ligger klare til runde A og B.

---

## 3. Brettverkstedet (STAGE FORGE)

### 3.1 Hva Tom skal kunne gjøre
- Åpne et brett, se det akkurat som i spillet og rulle langs det.
- Legge ut PNG-er og de ferdige 3D-rekvisittene (fyrfat, krigsbanner, runestein, ruiner, taugjerde, fossefall) i fire lag. Flytte dem med musa, skalere, speilvende, vri litt, endre dybden, duplisere, slette og låse.
- Gi hver rekvisitt en animasjon: vind (svaie), bildeserie (flagg, fakkel, kråker), flakking (lys), duving, eller ingen.
- Legge ut rader (palisade, gjerde, gresstuer) ved å dra langs brettet.
- Flytte bølgene, tønnene, farene, rytterne, sjefen og porten på en tidslinje langs brettet.
- Teste brettet fra der kameraet står, og komme tilbake til samme sted.
- Lagre rett i repoet mens `npm run dev` kjører, eller laste ned fila.

### 3.2 Lagene
Brettene er ekte 3D med et perspektivkamera, så parallaksen kommer av seg selv: det som står langt bak, glir sakte forbi, og det som står nær kameraet, farer forbi. Et lag i editoren er derfor et område i dybden (z), ikke en egen tegneflate. Kamplinja er z = 0, figurene går mellom -2,6 og 2,6, og kameraet står på z = 11,4 (15 på smale skjermer) med 38 graders synsvinkel.

| Lag | Dybde (z) | Hva som står der | Oppførsel |
|---|---|---|---|
| FAR | bak -40 | Himmel, fjell, borgen i det fjerne | Kommer fra biomet. Kan slås av og på og få ny farge, ikke flyttes (i første omgang). |
| BACK | -40 til -4 | Palisade, telt, trær, bannere, hytter, klipper | Får tåke og lys fra scenen, og kaster skygge. |
| MID | -4 til 4 | Tønner, farer, fyrfat, steiner ved veikanten, startpunkter | Det spilleren kan treffe eller bruke. Editoren varsler når noe sperrer kamplinja. |
| FRONT | 3 til 9,5 | Stolper ved veien, busker, en stor trestamme rett foran kameraet | Tones ut når en figur står bak. Blir uskarp av dybdeskarpheten på HIGH og ULTRA. Mørkere, som i konseptbildene. |

Tenker Tom i parallakse, som i the-deep-ones: en faktor p (hvor fort noe glir forbi i forhold til kamplinja) svarer til z = 11,4 · (1 - 1/p).

| p | 0,25 | 0,5 | 1 | 1,5 | 2 | 3 |
|---|---|---|---|---|---|---|
| z | -34 | -11,4 | 0 | 3,8 | 5,7 | 7,6 |

Editoren lagrer z og ikke p. Kameraet trekker seg bakover når en kjempe er i bildet og står lenger unna på smale skjermer, og da stemmer ikke en fast faktor lenger. Det gjør z.

Størrelser foran kameraet: på z = 8 (3,4 meter fra kameraet) er bildet bare 2,3 meter høyt, så en tre meter høy stamme fyller hele høyden. På z = 5 er bildet 4,4 meter høyt. Editoren viser rammen kameraet ser på den dybden som er valgt.

### 3.3 Rekvisitter: PNG med animasjon
Ny del i manifestet, `props`:

```json
"props": {
  "palisade_a": { "file": "prop_palisade_a.webp", "w": 3.2, "anchor": [0.5, 0.97], "layer": "back", "shadow": true },
  "signpost": { "file": "prop_signpost.webp", "w": 1.4, "anchor": [0.5, 0.98] },
  "signpost_sign": { "file": "prop_signpost_sign.webp", "w": 0.9, "anchor": [0.5, 0.0], "anim": { "type": "sway", "pivot": [0.5, 0.0], "amount": 0.12 } },
  "tree_front_oak": { "file": "prop_tree_front_oak.webp", "w": 4.5, "anchor": [0.45, 1.0], "layer": "front", "fade": true, "anim": { "type": "sway", "amount": 0.02 } },
  "banner_red": { "file": "anim_banner_red.webp", "w": 1.2, "anchor": [0.5, 1.0], "anim": { "type": "sheet", "n": 8, "grid": [4, 2], "fps": 10 } }
}
```

`w` er bredden i meter og `anchor` fotpunktet i bildet (0 til 1, y ned fra toppen), som for figurdelene.

- Hver rekvisitt tegnes som en flat kulisse som vender rett mot kamplinja (ikke mot kameraet), som i et teater. Det passer 2,5D-bildet og gir riktig perspektiv når kameraet ruller. Den kan vris litt rundt y.
- Lys: rekvisitter i BACK og MID får samme materiale som figurene (sol, himmel, fakler og tåke, glatte kanter med alphaToCoverage) og kaster skygge med formen i bildet. FRONT er uten tåke og mørknes mot skyggefargen.
- Vind: bøyning i skyggeleggeren med de samme vindverdiene som trærne (`gfx/wind.ts`), sterkest øverst. Et skilt kan svinge rundt et ledd (`pivot`).
- Bildeserier: én tekstur med ruter, der riktig rute velges med forskyvning (billigere enn ett bilde per rute).
- Mange like rekvisitter (palisaden) tegnes samlet (InstancedMesh), med egen fase i vinden for hver.
- Treff og kollisjon kommer senere: `solid` for en vogn som stenger veien, `breakable` for gjerder og kasser.

### 3.4 Forgrunn som gir dybde uten å skjule kampen
- Rekvisitter i FRONT tones ned til rundt 40 prosent når en helt, en fiende eller en sjef står bak dem i bildet. Punkter på figuren sammenlignes med selve bildet (gjennomsiktige deler teller ikke), og toningen tar 0,15 sekunder inn og ut. Å tone ut det som står mellom kameraet og spilleren er den vanlige løsningen i 3D-spill, og Dragon's Crown fikk et valg om å gjøre figurer som overlapper, gjennomsiktige.
- Toningen gjøres med dithering, så dybden og kantutjevningen virker som før.
- De svarte silhuettene i dag (`foreground()` i `env/common.ts`: pigger, hodeskalle på stake, kors og stein) blir valgfrie, og editoren kan bytte dem ut med malte PNG-er.
- Editoren varsler når noe i FRONT dekker mer enn en tredjedel av bildet der kameraet låses for en bølge.

### 3.5 Brettfilene
- Ett brett er én fil, `src/data/layouts/<brett>.json`. Den bygges inn i spillet, også i enkeltfil-bygget. Typen `LevelLayout` står i `src/data/layout.ts` (uten three, som resten av data), og `validateLayout` gir tydelige feilmeldinger.

```json
{
  "version": 1,
  "level": "road",
  "seed": 1987,
  "generators": { "forest": true, "meadow": true, "rocks": true, "skullPikes": true, "tents": false, "stakeWall": false, "silhouettes": false },
  "props": [
    { "id": "p1", "prop": "tree_front_oak", "layer": "front", "x": 44, "y": 0, "z": 7.8, "scale": 1.6, "flip": false, "rot": 0 },
    { "id": "p2", "prop": "signpost", "layer": "mid", "x": 12.5, "z": -3.4, "scale": 1 }
  ],
  "runs": [
    { "prop": "palisade_a", "layer": "back", "x0": 4, "x1": 112, "z": -7.2, "step": 3, "jitter": 0.2, "gaps": [[30, 38], [70, 76]] }
  ],
  "waves": [
    { "at": 8, "maxAlive": 4, "title": "SKELETONS!", "spawns": "skeleton:R:0.2 skeleton:R:0.6 skeleton:L:1.4" }
  ],
  "barrels": [[18, "chicken"], [42, "gold"]],
  "hazards": [["spikes", 21, -1.85, 3.0, 1.3]],
  "riders": [[2, "skeleton", "warhog"]]
}
```

- `levels.ts` beholder navn, musikk, biom, intro og finale. Står bølger, tønner, farer eller ryttere i brettfila, gjelder de. Ellers gjelder `levels.ts` som i dag, så ingenting brekker før et brett er flyttet over.
- Faste frø: pynten som lages med tilfeldige tall (trær, gress, steiner, hodeskaller på staker, telt, bannere og silhuetter) blir ulik hver gang brettet starter. Med et frø per brett (`seed`) blir den lik hver gang, og editoren viser akkurat det spillet viser. Kampen (AI og blod) bruker fortsatt vanlige tilfeldige tall.
- Bake inn: en generator kan gjøres om til enkeltrekvisitter i editoren, for eksempel de 14 hodeskallene på staker langs veien, så Tom kan flytte og slette dem en og en.
- Et lite skript, `tools/export_layouts.mjs`, lager første versjon av alle brettfilene fra `levels.ts`, så Tom starter fra det som finnes.

### 3.6 Selve editoren
- En egen side, `editor.html`, i samme Vite-prosjekt. Den bruker spillets egen tegning, lys, etterbehandling, miljøbyggere og rekvisitter, så det Tom ser, er det spillet viser. Den åpnes på `http://localhost:5173/editor.html` med `npm run dev`, og fra tittelskjermen med en skjult tast.
- Skjermen:
  - Øverst: velg brett, vis, skjul og lås hvert lag, angre og gjør om, rutenett, PLAY FROM HERE og SAVE.
  - Til venstre: biblioteket, med miniatyrer av alle rekvisittene i manifestet og de ferdige 3D-rekvisittene.
  - I midten: spillbildet. Kameraet går langs brettet med musehjulet, midtre knapp eller A og D. En tast gir oversikt ovenfra over hele brettet.
  - Til høyre: egenskapene til det som er valgt (x, y, z, størrelse, speilvending, vridning, fargetone, animasjon, toning og lag).
  - Nederst: tidslinjen over hele brettet med bølgene (og der kameraet låses), tønner, farer, ryttere, sjefen og porten. Dra for å flytte, klikk for å endre fiendene i en bølge.
- Musa: et klikk velger, og treffer bare det som synes i PNG-en, så gjennomsiktige hjørner slipper klikket gjennom. Dra flytter langs laget. Shift og dra endrer dybden, så Tom ser parallaksen endre seg mens han drar. Alt og hjulet skalerer. Ctrl+D dupliserer, Delete sletter, Ctrl+Z og Ctrl+Y angrer og gjør om (50 steg, samme mønster som `useUndoRedo.ts` i Toms connect-play).
- Radmodus: dra langs brettet, så legges palisadebiter eller gjerdestolper ut med jevne mellomrom og litt variasjon. Raden lagres som én linje (`runs`) og kan endres samlet.
- Nye bilder: dra en PNG inn i editoren, så vises den med en gang. Ved lagring under `npm run dev` legges den i innboksen og kjøres gjennom `tools/process_art.py` (trimming, WebP og manifest), som figurdelene.
- Lagring: en liten Vite-utvidelse som bare finnes under `npm run dev`, skriver brettfila i repoet med fast rekkefølge på feltene, så endringene er lette å lese i git. Uten dev-serveren lastes fila ned.
- Varsler mens Tom jobber: noe sperrer kamplinja, noe i FRONT dekker for mye, en bølge ligger utenfor brettet, et bilde mangler.
- Knappene er på engelsk som resten av spillet (regelen i AGENTS.md).
- Test: `tools/tests/editor.mjs` åpner editoren, legger ut, flytter og sletter rekvisitter, angrer, lagrer og laster på nytt, og sjekker at brettet i spillet får de samme rekvisittene.

---

## 4. Animasjon, og hva vi tar fra Morbidium

Morbidium har tre deler:
- en spiller for bildeserier (`src/16_anim.js`: tabellen `ANIM`, ruter fra `anim_<navn>.png` i manifestet med antall, rutenett og fps, sløyfe, holde siste rute, fart og `onEnd`)
- nøkkelstillinger i spor (`POSER`: spor på formen `[t, verdier...]` med myk overgang mellom nøklene)
- lagdukker med egen animasjon per del (`Lagdukke` i `29_monstre.js`)

Koden kan ikke kopieres rett over. Den er vanlig JavaScript med globale variabler, bygger på three r128 (der `updateRange` fortsatt fantes) og på et skrått kamera ovenfra. Dukka i Morbidium er heller ikke et leddhierarki, og riggen i Loincloth kan allerede mer. Morbidium har ikke valgt lisens ennå, men dette er Toms egen kode. Tredjepartskode i Morbidium (MIT) må krediteres hvis noe av den tas med.

Det vi tar, skrevet om i TypeScript:
1. Bildeseriene, med de samme feltene i manifestet som i Morbidium (`n`, rutenett, `fps`, `w`, `h`, `ax`, `ay`), så Tom kjenner dem igjen og GPT-promptene kan brukes om igjen. Til flagg, fakler, kråker på en stolpe, et skilt som svinger og et vannhjul.
2. `behandle_ark` og `ark_ruter` fra `tools/behandle_bilder.py` i Morbidium (linje 57 til 115) inn i `tools/process_art.py`. De skjærer alle rutene med samme boks, så fotpunktet står stille fra rute til rute.
3. Sporformatet `[t, verdier...]`, brukt på riggens stillinger (`Pose`). Angrep med flere faser og dødsanimasjoner (som beina som snubler og faller) blir data i stedet for kode, og resultatet går inn i riggens demping (`r.drive`) som i dag.
4. Ideen fra lagdukkene, en funksjon per del, til rekvisitter med flere deler: stammen står stille og kronen svaier, eller buret i et galgetre svinger. Her kan vi bruke figurriggen direkte, med egne deler.

Toms repo the-deep-ones (`v2/editor.js`, MIT) har en enkel brettredigerer med parallakse, valg og flytting, skala og høyde per ting, lagring, testspill og JSON inn og ut med kontroll. STAGE FORGE følger samme flyt, men i 3D og med z i stedet for parallaksefaktor. SceneForge er en planlegger for musikkvideoer i React, og har ingenting vi kan bruke her.

---

## 5. Gørr

### 5.1 Kroppsdeler som kuttes
Med rettingen i del 1 synes blodet som allerede var der: fontene fra skulderen, halsen eller hoftene i 1,8 til 2,6 sekunder, sprut i hoggretningen og blod fra delen som flyr. Videre:
- Pulser som et hjerte: 3 til 5 kraftige støt det første sekundet, så svakere, så drypp. I dag er pulsen en jevn bølge. Mønsteret legges inn som data per dødsmåte.
- En første skvett (0,3 sekunder) som er sterkere og går rett ut fra stumpen.
- Kuttflate: et lite malt bilde av kjøtt med beinring der delen satt, både på kroppen og på delen som flyr. Da ser et kutt ut som et kutt og ikke som en del som mangler. Bestilling i del 9.
- Blod på våpenet etter et kutt, som tones bort etter 5 til 10 sekunder.
- Et kort treffstopp (60 til 90 millisekunder) når noe kuttes, der offeret rister mer enn den som slår (Sakurais regler).
- FAMILY gjør alt dette om til konfetti, som i dag.

### 5.2 Todelt fiende: beina løper videre
I dag flyr overkroppen (med hode og armer), og beina står stille i 1,3 sekunder før de faller. Ny gang:
1. Kuttet: treffstopp og BISECTED! Overkroppen flyr og blør fra kuttet.
2. Et lite øyeblikk (0,15 til 0,3 sekunder) står beina stille mens blodet står rett opp fra midjen.
3. Beina løper 1,2 til 2,4 sekunder fram og tilbake med stadig kortere steg. De snur ved kanten av bildet og av og til midt i, fontenen pulserer, og de legger et blodspor på bakken.
4. Knærne svikter (0,4 sekunder), og beina faller i den retningen de løp. En blodpytt vokser fram.
5. Av og til (15 prosent) løper beina ut av bildet eller inn i en fare (juvet, piggene, lava) og gir miljødrap. Løper de inn i en annen fiende, snubler han.
- Tekst på engelsk, for eksempel LEG DAY! eller THE LEGS DIDN'T GET THE MEMO!
- Bygges på den hodeløse kyllingen, som allerede løper rundt (`headlessT` i `fighter.ts`), gjort generell: hvor lenge noe løper og hva som løper.
- Test i `violence.mjs`: beina flytter seg minst 1,5 meter, faller innen 3 sekunder, og det er blodråper i lufta mens de løper.

### 5.3 Mer i samme ånd (forslag)
- Overkroppen kryper litt mot beina før den gir opp.
- En avkuttet arm kan plukkes opp og brukes som våpen i tre slag (ARM WEAPON!).
- Likene blir liggende lenger på EXCESSIVE og PLEASE SEEK HELP, og løse deler kan sparkes rundt (det finnes allerede).

---

## 6. AI

### 6.1 Slik er det i dag
Fiendetypene er nærkamp, kjempe, skytter, tyv (gnomen), hopper (froskemannen) og subber (zombien). To fiender kan angripe samtidig (tre med to spillere), og de andre venter 3 til 4,6 meter unna. De rygger på halv fart og blir i bildet når de har kommet inn, og de får panikk av og til. Ridedyrene har egen AI (rettet i dag), og sjefene velger vektede trekk og blir rasende ved rundt halvt liv.

Svakheter jeg fant i koden:
- En fiende angriper fra den siden han tilfeldigvis står på. Ofte kommer begge fra samme side og står i kø, i stedet for én fra hver side som i Golden Axe.
- En fiende utenfor bildet kan få angrepsplassen og gå inn og slå. Bare kastene sjekker at fienden er i bildet.
- De som venter, står nesten stille. De sirkler ikke og holder ikke avstand i dybden.
- Ingen felles varsling: noen angrep blinker (sjefene), de fleste ikke, og grepet kommer uten forvarsel.
- Fiendene slår en helt som ligger nede eller nettopp har reist seg (bare rytterne holder igjen, fra i dag).
- Ingen tempostyring: det eneste som styrer trykket, er hvor mange som kan leve samtidig i en bølge.
- Ingen fiender som straffer vaner, som å hamre på samme knapp, hoppe hele tiden eller kaste alt.
- `setTimeout` (klokketid) bestemmer når rytterne rir inn og når game over kommer, så det skjer selv om spillet står på pause (`stage.ts` linje 710 og 482).

### 6.2 Slik gjør de moderne Golden Axe-klonene det
- **Golden Axe** (arkade): én fiende angriper fra venstre og én fra høyre. De andre holder seg litt over eller under helten i dybden og trekker seg unna når han kommer nær. Fiender langt unna tar et sprangangrep. De bytter mål når den andre spilleren kommer nær, og løper for å sette seg på ledige ridedyr.
- **Streets of Rage 4**: høyst rundt fem fiender i bildet. Hvitt blink betyr at angrepet ikke kan avbrytes, rødt blink at et grep kommer. En oppdatering i 2023 ga fiendene et rop før bestemte angrep. Komboene har grenser (tre sprett mot veggen og ett løft fra bakken). Helten er smalere i dybden når han går opp eller ned, så det går an å unnvike.
- **Absolum** (2025, Guard Crush og Dotemu, den nærmeste arvingen til Golden Axe i dag): en unnamanøver inn i et angrep avleder det og lammer angriperen, men røde angrep kan ikke avledes. Etter omtrent tre omstarter av en kombo slår neste treff fienden hardt i bakken, og han kan ikke treffes før han er oppe. Eliter tåler de første treffene uten å vakle. Ridedyr har utholdenhet, og når den er tom, faller spilleren av og dyret løper sin vei. Sjefene får sterkere utgaver av trekkene sine ved halvt liv.
- **Fight'N Rage**: fiendene prøver å omringe og vet nøyaktig hvor langt de når. De slår helten ned fra lufta og river seg løs fra grep. Høyere vanskelighetsgrad gir raskere reaksjoner, ikke mer skade.
- **TMNT: Shredder's Revenge**: fiendene trenger ikke stå helt på linje i dybden for å bli truffet, og flokkene vokser med antall spillere.
- **Generelle regler** (Game Developer om fiender i nærkamp): hver fiende angriper i snitt hvert 2. til 3. sekund, noen få er nær og resten lenger unna, ingen angriper fra utenfor bildet, og ingen slår en spiller som vakler.
- **Left 4 Dead**: en regissør måler spenningen (skade spilleren tar og drap nær ham). Etter en topp på 3 til 5 sekunder kommer en pause på 30 til 45 sekunder.
- **Fiendetyper som lærer bort noe**: skjoldbærere lærer tunge slag og kast, fiender som angriper fra lufta lærer unnamanøvre, og en bokser som blokkerer straffer hamring på samme knapp.

### 6.3 AI del 1: grunnmuren (runde D)
1. To plasser per helt, én på hver side. En fiende som får angrepsplass, går til sin plass og ikke til siden han står på. Må han over på den andre siden, går han i en bue i dybden, ikke gjennom helten.
2. En ytre ring for dem som venter: 3,5 til 5 meter unna, litt over eller under heltens linje. De trekker seg når helten kommer nær (Golden Axe), sirkler rolig og bytter side innimellom.
3. Rettferdighet: angrepsplass bare for fiender som er i bildet, ingen angrep på en helt som ligger, reiser seg eller er usårbar, og høyst ett nytt angrep hvert 0,4 sekund mot samme helt.
4. Felles varsling: alle angrep har opptrekk (finnes), et hvitt blink når angrepet ikke kan avbrytes, rødt blink og en lyd før grep og angrep som ikke kan blokkeres, og korte rop før de store angrepene (stemmemanuset har mange). Det blir to nye felt i angrepene: `tell` og `bark`.
5. Med to spillere bytter fienden til den andre helten hvis han kommer nærmere enn 2 meter, og angrepsplassene fordeles på begge.
6. Spilltid i stedet for `setTimeout` i alt som påvirker spillet.
7. Målinger i `tools/tests/ai.mjs`: hvor mange angrep som kommer fra samme side, null angrep fra utenfor bildet, null angrep på en helt som ligger, tid mellom angrepene per fiende (1,5 til 3,5 sekunder), og hvor mye liv en spillerbot mister per bølge.

### 6.4 AI del 2 (runde E)
1. **Tempostyring**, en liten regissør: spenningen regnes ut fra skaden heltene tar, drap nær dem og livet de har igjen. Når den er høy, får færre fiender angrepsplass og pausene blir lengre. Når den er lav, øker trykket. Bølgene får et budsjett med rang (vanlig 1, sterk 2, elite 4), og det en bølge går over budsjettet, trekkes fra den neste (som i SoR4 Survival). Budsjettet skaleres med antall spillere.
2. **Nye fiendetyper**, hver med en vane å straffe:
   - SHIELD SKELETON med en dør som skjold. Blokkerer forfra og må tas bakfra, kastes eller knuses med tredje slag i komboen.
   - GOBLIN ARCHER holder avstand og skyter langs linja, men er svak på nært hold.
   - En froskemann i bakhold hopper ut fra baklaget (bruker lagene fra editoren) og slår helten ned fra lufta.
   - GRABBER holder helten fast for vennene sine, med rødt blink før grepet.
   - BERSERKER blir raskere og tåler mer når han har lite liv igjen.
   - COWARD CAPTAIN står bak, blåser i horn etter forsterkninger og roper ordre (FLANK HIM!). Han må tas først.
   - Fiender som løper til ledige ridedyr, også det helten nettopp gikk av.
3. **Grense for evige komboer**: etter et visst antall omstarter i lufta havner fienden hardt i bakken og kan ikke treffes før han er oppe (Absolum). Under en bølge spretter kropper mot kanten av bildet (høyst tre ganger), og kropper som treffer andre fiender, gjør skade. SKY BUFFET skal fortsatt være gøy, men ikke vare evig.
4. **Forsvar**: eliter og sjefer blokkerer når helten hamrer samme angrep fire ganger på rad, fiender går til side i dybden for prosjektiler, og en fiende som holdes, river seg løs etter 1,5 sekunder hvis ingen slår.
5. **Sjefer i faser**, ved 66 og 33 prosent i stedet for én grense: nye trekk, sterkere utgaver av de gamle, røde angrep som ikke kan blokkeres, og et tydelig vindu etter de store angrepene der sjefen kan straffes. Noen ideer:
   - Hogmother spiser kylling for å få liv tilbake hvis ingen avbryter henne.
   - Croakus går under vann og kommer opp der skyggen hans er.
   - Magmor lar lava renne i sporene sine.
   - Vorthax lager kopier av seg selv, og bare den ekte kaster skygge.
6. **Vanskelighetsgrad** endrer reaksjonstid og aggresjon, ikke liv og skade.
7. **Ridedyr**: fiender løper til ledige dyr, og spesialangrepet til dyret bruker utholdenhet i stedet for liv (lærdommen fra Golden Axe: Beast Rider, der spillerne unngikk spesialangrepene fordi de kostet dyret liv).

---

## 7. Teksturer på palisaden og resten

### 7.1 Hvorfor de ser flate ut
Palisaden (`stakeWall` i `env/common.ts`), teltene, flaggstengene, stakene med hodeskaller, vedkubbene i bålene, tårnene i det fjerne og hyttene i sumpen er bygd av sylindere, kjegler og bokser med én farge hver og ingen tekstur. Det er 54 slike steder i miljøkoden, kartet medregnet. Bakken, veien, murene og brua henter teksturer fra manifestet, og derfor ser de ekte ut ved siden av. På bildet Tom sendte synes det godt: den brune palisaden, det røde teltet og de svarte silhuettene foran.

### 7.2 Rask løsning (runde A)
Nye teksturnavn i manifestet, brukt med `texFile(navn, reserve)` i miljøbyggerne. Reserven lages i kode, så alt virker før GPT har levert:

| Navn | Brukes til |
|---|---|
| `bark` | Palisadestokker, stenger, staker, stolper, vedkubber, hyttestolper |
| `stake_tip` | Spissene på palisaden (tilspisset lyst tre) |
| `canvas` | Teltene (farges per telt) |
| `thatch` | Takene på hyttene i sumpen og på vakttårnet i frosten |
| `plank` | Veggene på hyttene og plattformen på vakttårnet |
| `roof_slate` | Takene på tårnene i det fjerne |
| `obsidian` | De svarte piggene i vulkanlandet |
| `bone` | Bein og hodeskaller i 3D |

- Teksturen gjentas etter høyden, så alle stokkene får samme oppløsning.
- Fargeforskjellene mellom stokkene beholdes ved at teksturen farges.
- Relieff og glans regnes ut fra teksturen, som for bakken, så barken får skygger i solen.

### 7.3 Bedre løsning (runde B og C)
Malte PNG-rekvisitter (del 3.3): palisadebiter med taubindinger, telt, skilt, stolper og trær. De passer bedre til de malte figurene (nesten ekte karikatur) enn 3D-former med tekstur, og Tom setter dem ut i editoren. 3D-palisaden kan stå igjen bak for dybde og skygge, eller byttes helt ut.

---

## 8. Andre forbedringer

Spillfølelse:
- Treffstopp etter Sakurais regler: offeret rister mer enn den som slår, sidelengs på bakken og opp og ned i lufta, og lengre for tunge slag.
- Helten smalere i dybden når han går opp eller ned, så det går an å unnvike ved å gå ut av linja (SoR4).
- Litt mer rom i dybden for å treffe (TMNT), så slag ikke bommer fordi fienden står et par centimeter feil.
- CLANG! når to våpen treffer hverandre i samme øyeblikk: gnister (som synes nå), begge rygger, og metallklang. Passer til 80-tallsmetallen og er en enkel utgave av «clash» i Absolum.
- Bufring av tastetrykk (0,15 sekunder), så kombinasjoner ikke mistes (må sjekkes mot det som finnes).

Innhold:
- Brett fra editoren: sidestier på kartet med korte brett, og hemmeligheter bak trær og fossefall (som i Absolum).
- Endeløs arena (punkt 3 i GDD-en) blir enkel med tempostyringen og budsjettene fra AI del 2.
- Flere kjemper (GDD punkt 9) kan bygge på grepet og bakkeslaget som finnes.

Samarbeid:
- Gjenoppliving av en falt partner ved å holde knappen ved kroppen (GDD punkt 5).
- Dele liv med en BRO FIST når begge trykker samtidig (etter high-five i TMNT).
- Spesialangrep samtidig blir sterkere.

Presentasjon:
- Større og tydeligere HUD (står i todo).
- Rangering etter hvert brett (tid, drap, stil, skade tatt), som i SoR4.
- Navnekort når en sjef kommer inn (`boss_<id>.png` står allerede i planlagt grafikk).

Teknisk:
- Spilltid i stedet for `setTimeout` (del 6.3).
- Faste frø for miljøene (del 3.5).
- Playwright i CI med de raske testene, blant dem `particles.mjs`, så en feil som den i del 1 blir fanget samme dag.

---

## 9. Bestilling til GPT (kan sendes nå)

### 9.1 Teksturer (kan kjøres gjennom verktøyet med en gang)
Bruk TEKSTUR-BLOKKEN i `docs/ART_PROMPTS.md` som første melding i en egen samtale, og bestill én om gangen. Lagre som `tex_<navn>.png` i `art/inbox/` og kjør `python3 tools/process_art.py`. Verktøyet skriver dem inn i manifestet med en merknad om at spillet ikke bruker navnet ennå. De kobles inn i runde A.

| Navn | Fil | Prompt |
|---|---|---|
| `bark` | `tex_bark.png` | `Texture: bark of a stripped pine log seen straight on, the grain running from TOP to BOTTOM: rough brown bark in long vertical strips, some patches where the bark is gone and pale wood shows, a little moss and dirt.` |
| `stake_tip` | `tex_stake_tip.png` | `Texture: freshly carved pale pine wood seen straight on, knife and axe cuts running from TOP to BOTTOM, a few darker knots.` |
| `canvas` | `tex_canvas.png` | `Texture: worn heavy canvas cloth seen straight on, in NEUTRAL LIGHT GREY (the game colours it): coarse weave, patches sewn on with thick stitches, water stains, mud splashes, a few small holes.` |
| `thatch` | `tex_thatch.png` | `Texture: old straw thatch roof seen straight on, bundles of straw running from TOP to BOTTOM, grey-brown and damp, a little moss.` |
| `plank` | `tex_plank.png` | `Texture: rough wooden wall of 6 horizontal planks running LEFT to RIGHT, seen straight on: dark weathered wood, thin gaps between the planks, rusty nails.` |
| `roof_slate` | `tex_roof_slate.png` | `Texture: roof of dark grey slate tiles seen straight on, overlapping rows, a few cracked or missing tiles, lichen.` |
| `obsidian` | `tex_obsidian.png` | `Texture: black volcanic glass (obsidian) seen straight on, shell-shaped fractures with sharp glassy edges, a faint dark purple sheen, grey ash dust in the cracks.` |
| `bone` | `tex_bone.png` | `Texture: old yellowed bone surface seen close up, fine pores, hairline cracks and brown stains.` |

### 9.2 Rekvisitter til brett 1
Runde B og C er ferdige, og `tools/process_art.py` kjenner nå `prop_` og `anim_`. Den oppdaterte lista med KULISSE-BLOKKEN står i `docs/ART_PROMPTS.md` under «Kulisser til brettverkstedet». Der heter bildeseriene `anim_<navn>_<kolonner>x<rader>.png` (for eksempel `anim_banner_red_4x2.png`), og fakkelen og kråka er med. Lista under er den opprinnelige.

`gore_` kjennes ikke ennå, og ett ukjent navn stopper hele kjøringen. Legg gørrbildene i `art/inbox/venter/` (verken verktøyet eller git ser den mappa) til runde A er ferdig.

Lim inn denne blokken først, i en egen samtale:

```
You are making painted set pieces for "Loincloth Legends", a side-scrolling beat 'em up that parodies 1980s sword-and-sorcery films. The characters are near-photorealistic caricatures, and the scenery must match them.
Rules for ALL images in this conversation:
- Near-photorealistic, like a high-end matte painting or a 3D render of real materials: real wood with bark and cuts, real canvas, rope, rusty iron, moss, mud, bone.
- Seen straight from the side at eye level, like a flat theatre set piece. No perspective from above or below, no vanishing point.
- Soft, even light from the front and slightly above, neutral white balance. No hard cast shadows, no coloured light, no fog. The game adds its own lighting.
- A single isolated object on a fully transparent background (PNG with alpha). No ground, no drop shadow, no frame. The bottom of the object is where it stands on the ground.
- NOT cartoon, NOT cel-shaded, NO outlines. No text, no letters, no watermark.
- Everything is original.
Confirm that you understand. Then wait for my requests.
```

| Fil | Størrelse | Prompt |
|---|---|---|
| `prop_palisade_a.png` | 1536x1024 | `A section of a crude defensive palisade, about 3 metres wide: 6 sharpened vertical logs of different heights, lashed together with thick rope, bark partly stripped, the tips carved to points, moss and dried mud at the bottom, two arrows stuck in it.` |
| `prop_palisade_b.png` | 1536x1024 | `Another section of the same palisade: 5 logs, one of them broken and leaning, a torn animal hide hanging from a tip, a skull nailed to the middle log.` |
| `prop_tent_red.png` | 1024x1024 | `A worn war tent: a conical tent of faded red canvas with patches, stains and mud at the hem, a wooden centre pole sticking out at the top, guy ropes and wooden pegs.` |
| `prop_tent_purple.png` | 1024x1024 | `The same kind of war tent in faded purple canvas, the entrance flap tied open, a dark inside.` |
| `prop_signpost.png` | 1024x1536 | `A crooked wooden signpost at a roadside: a weathered post with a short crossbar at the top, a rusty iron hook at the end of the crossbar, nothing hanging from it.` |
| `prop_signpost_sign.png` | 1024x1024 | `A blank weathered wooden sign board hanging from two short rusty chains, the chains meeting at one ring at the top centre. No letters.` |
| `prop_roadpost.png` | 1024x1536 | `A thick weathered wooden post by a road with an old iron lantern hanging from a hook, a coil of rope around the post, a few nails and a torn notice.` |
| `prop_skullpike.png` | 1024x1536 | `A tall sharpened wooden stake with a human skull impaled on top, rags and a few black feathers tied below the skull.` |
| `prop_tree_front_oak.png` | 1024x2048 | `The trunk of a massive gnarled old oak seen straight on, filling the full height of the image and cut off by the top edge: thick roots at the bottom, deep bark with moss and ivy, the start of two big branches near the top with a few autumn leaves.` |
| `prop_bush_front.png` | 1536x1024 | `A dense clump of dry autumn brambles, tall yellow grass and a few thistles, about 1.5 metres high.` |
| `prop_cart.png` | 1536x1024 | `A broken wooden farm cart seen from the side: one wheel off and lying against it, spilled sacks and a cracked barrel.` |
| `anim_banner_red.png` | 2048x1024 | `A tattered red war banner with a horned skull emblem, hanging from a crossbar on a pole, in 8 frames of it waving in the wind, laid out in a 4 x 2 grid. Every frame the same size, and the pole in exactly the same place in every frame.` |
| `gore_stump.png` | 512x512 | `The round cut surface of a freshly severed limb seen straight on: raw red meat, a white bone ring in the middle, dark red edges, glistening wet.` |
| `gore_stump_waist.png` | 1024x512 | `The wide oval cut surface of a body cut in half at the waist, seen straight on: raw red meat, a cross-section of the spine in the middle, glistening wet.` |

---

## 10. Kilder

Moderne Golden Axe-kloner og fiende-AI (hentet 30. september 2026):
- Absolum, kamp og ridedyr: https://games.gg/absolum/guides/absolum-beginners-guide-combat/ og https://absolum.wiki.gg/wiki/Mounts
- Absolum, Overpressure og eliter: https://canonfire.net/post/799233310032347136/055-absolum-brings-the-arcade-spirit-of-its
- Absolum, sjef i to faser: https://games.gg/absolum/guides/how-to-beat-the-underking/
- Streets of Rage 4, hvordan studioene laget det: https://blog.playstation.com/2020/04/30/streets-of-rage-4-how-three-studios-revived-a-legendary-series/
- Streets of Rage 4, Survival og rang per fiende: https://blog.playstation.com/2021/07/01/streets-of-rage-4s-new-survival-mode-launches-july-15-find-out-how-it-was-created/
- Streets of Rage 4, oppdateringen i 2023: https://www.gematsu.com/2023/03/streets-of-rage-4-update-now-available-adds-custom-survival-mode-co-op-attacks-and-over-300-improvements
- Golden Axe, fiendenes mønstre: https://speeddemosarchive.com/GoldenAxe.html
- Golden Axe II, ridedyr og tyver: https://www.arcadequartermaster.com/ga2_items.html
- Golden Axe: Beast Rider: https://www.arcadianrhythms.com/2012/01/golden-axe-beast-rider-review/
- Fight'N Rage: https://www.cubed3.com/games/reviews/pc/fightn-rage-2
- TMNT: Shredder's Revenge: https://www.gamedeveloper.com/design/deep-dive-how-tmnt-s-shredder-s-revenge-was-built-from-nostalgia-and-new-ideas
- Fiender i nærkamp: https://www.gamedeveloper.com/design/enemy-design-and-enemy-ai-for-melee-combat-systems
- Sjefkamper: https://www.gamedeveloper.com/design/boss-battle-design-and-structure
- Fiendetyper som lærer bort noe: https://megacatstudios.com/blogs/press/enemy-design-101-apeels-court
- Left 4 Dead, regissøren: https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf
- Treffstopp (Sakurai): https://nintendowire.com/news/2022/12/12/this-week-in-sakurai-12-5-12-11-fine-tuning-hit-stop-and-cheating-the-system/
- Forgrunn som tones ut: https://www.siliconera.com/dragons-crown-patch-adds-new-features-and-tweaks/ og https://chronocrash.com/obor/wiki/graphics-overview/

Toms egne prosjekter (lest lokalt, bare som referanse):
- Morbidium: `src/16_anim.js`, `src/11_doll.js`, `src/29_monstre.js`, `tools/behandle_bilder.py`
- the-deep-ones: `v2/editor.js`, `v2/world.js`, `v2/render.js`
- connect-play: `src/game/components/QuestEditor/useUndoRedo.ts`
