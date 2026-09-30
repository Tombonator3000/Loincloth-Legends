# Grafikkliste for ChatGPT (GPT-image)

**Vil du at ChatGPT skal styre hele jobben selv?** Lim inn startprompten i `docs/CHATGPT_PROMPT.md`. Den inneholder alt under, og ChatGPT holder sjekklista, gir filnavn og sier hva som kommer neste.

Denne lista beskriver all grafikk spillet kan hente fra ChatGPT, med ferdige prompter du kan lime inn. Spillet virker uten noen av filene (alt lages i kode), så du kan bytte ut én figur eller én tekstur om gangen.

Målet er satt av Toms referansebilde av Valkyra (se `docs/STYLE_TARGET.md`): **nesten ekte karikatur**. Figurene skal se nesten virkelige ut, med hud, hår, rustent jern og slitt lær som på et foto eller en påkostet 3D-render, men med overdrevne former: stort hår, tunge øyelokk og fyldige lepper, store bryst og muskler, tykke lår, store støvler og digre våpen. Spilt helt alvorlig. Humoren kommer fra overdrivelsen, navnene og parodien, aldri fra tegneseriestrek.

## Hva spillet henter fra ChatGPT

| Hva | Hvor i manifestet | Status |
|---|---|---|
| Figurdeler for helter, fiender og sjefer | `parts` | I bruk |
| Langt hår som henger bak ryggen (valgfritt) | `parts`, del `hairback` | I bruk |
| Ridedyr og kjæledyr | `parts` | I bruk |
| Teksturer for 3D-verdenen (bakke, vei, murer, gulv, treverk, lava) | `textures` | I bruk |
| Himmel | `sky` | I bruk. Et himmelbilde erstatter den fysiske himmelen i det miljøet |
| Verdenskart | `map` | I bruk |

Trær, steiner, hodeskaller, fjell og bygninger er 3D-modeller laget i kode og trenger ingen bilder. Det 3D-verdenen trenger fra ChatGPT er teksturer (se "Teksturer for 3D-verdenen" lenger ned).

---

## Ta imot bildene (verktøy fra Morbidium)

Legg bildene fra ChatGPT i `art/inbox/` og kjør `python3 tools/process_art.py` (krever Pillow). Skriptet er gjenbrukt fra Toms Morbidium: det fjerner magenta hjelpelinjer og ensfarget bakgrunn når ChatGPT ikke fikk til gjennomsiktighet, klipper ark i ruter, beskjærer og skalerer ned delene, retter sømmene i teksturer og himmelbilder, lagrer alt som WebP i `public/assets/` og skriver manifestet selv. Originalene flyttes til `art/inbox/behandlet/` og kommer ikke i git. Filnavnet bestemmer hva bildet er: `valkyra_head.png`, `tex_ground_grass.png`, `sky_scorch.png`, `pet_rat.png`, `map.png`.

**Ark: en hel fiende i ett bilde.** Last opp `docs/maler/mal_figur.png` til ChatGPT og be om alle seks delene i rutene (HEAD, TORSO, PELVIS øverst, ARM, LEG, WEAPON nederst), med merkene for leddene som guide. Lagre bildet som `figur_<id>.png` (for eksempel `figur_skeleton.png`), så klipper skriptet det i `skeleton_head` og så videre. Samme stil og lys i alle delene, og seks bestillinger blir én. Rutene er rundt 500 piksler, nok for fiender og sjefer. Heltene lages fortsatt del for del i full størrelse. `docs/maler/mal_ni_ting.png` gir ni ting i ett bilde (`ark__navn__navn...png`). Malene lages på nytt med `python3 tools/make_templates.py`.

## Slik gjør du det (figurer)

1. Start en ny samtale i ChatGPT. Lim inn **STIL-BLOKKEN** under som første melding.
2. Lag først et **helfigursbilde** av figuren med REFERENCE-templatet, og bli fornøyd med det før du går videre. For Valkyra finnes bildet allerede: last det opp og skriv "This is the approved reference for VALKYRA. Match it exactly in every asset."
3. Lag delene én og én: HEAD, HAIRBACK (bare ved langt hår), TORSO, PELVIS, ARM, LEG og WEAPON. Last opp referansebildet sammen med hver bestilling.
4. Be alltid om **transparent bakgrunn** og PNG. Last ned bildet.
5. Lagre filene i `art/inbox/` med filnavnet fra lista (for eksempel `valkyra_head.png`).
6. Kjør `python3 tools/process_art.py`. Den lager de ferdige filene i `public/assets/` og skriver manifestet.
7. Start `npm run dev`. Figuren bruker nå dine bilder. Ser en del feil ut, juster `anchor` eller `height` i manifestet.

Tips:
- ChatGPT lager bilder i tre størrelser: 1024x1024, 1024x1536 (høyt) og 1536x1024 (bredt). Alle templatene under bruker disse.
- Bildene kan være større enn nødvendig. Lasteren beskjærer gjennomsiktige kanter automatisk og skalerer delen til riktig høyde.
- Hvis ChatGPT legger på skygge eller bakgrunn, skriv: "Remove the background and the drop shadow, keep only the part on full transparency."
- Hold figuren **vendt mot høyre** i alle deler. Spillet speiler selv når figuren snur.
- Lyset i bildet skal være mykt og jevnt forfra. Spillet legger på sitt eget lys (fakler, lyn, sol og kantlys), og hardt sidelys i bildet blir feil når figuren snur.
- Delene må overlappe litt i leddene (runde skuldre, hofter og midje), ellers blir det glipper når figuren beveger seg.
- Lag ikke bilder av eksisterende spillfigurer, filmfigurer eller logoer. Alt skal være originalt.

---

## STIL-BLOKK (lim inn først)

```
You are the art director for "Loincloth Legends", an original side-scrolling beat 'em up that parodies 1980s sword-and-sorcery films and fantasy book covers.
Art style for ALL character images in this conversation:
- Near-photorealistic caricature. The characters look almost real, like a high-end 3D character render or a hyperreal digital painting, but with caricatured, exaggerated proportions. Think of a detailed collectible statue, not a cartoon.
- Real materials in close detail: skin with pores, freckles, veins, sweat and a subtle oily sheen, a little subsurface glow in ears and fingers; hair as individual strands; rusty iron chainmail with visible single rings; worn, scratched and stitched leather; real fur; nicked and dented steel with rust in the pits; old bone with cracks and stains.
- Caricature proportions: big expressive head with huge hair, heavy-lidded eyes, strong brows, full lips or a jutting jaw; chunky hands; exaggerated muscles; big curves on the women; thick powerful thighs; big heavy boots; oversized weapons.
- The men are massively muscular, oiled and hairy, with scars, stubble and battle grime.
- The women are muscular 1980s fantasy warriors with big exaggerated curves, abs and thick thighs, in chainmail bikinis, fur and leather. Clearly adults, never nude.
- Everyone wears a loincloth, a short fur kilt or a chainmail flap on a big belt, often with a skull buckle.
- Tone: played completely straight, like a 1980s film poster. The humour comes from the exaggeration, the names and the parody, never from cartoon drawing.
- Lighting: soft, even studio light from the front and slightly above, like a product photo, neutral white balance. No hard cast shadows, no coloured rim light, no dramatic backlight, no fog. The game adds its own lighting.
- NOT cartoon, NOT anime, NOT cel-shaded, NO outlines, NO flat colours, NO comic style.
- Everything is original. Do not copy or reference any existing game, film, comic or toy character.
- No text, no watermark, no signature.
- Output: a single isolated game asset on a fully transparent background (PNG with alpha). No ground, no drop shadow, no frame.
Confirm that you understand. Then wait for my asset requests.
```

---

## Deltemplater (figurdeler)

Hver figur er en "papirdukke" som settes sammen i spillet. Alle deler lages **vendt mot høyre**, isolert, uten de andre kroppsdelene: heltene i trekvart profil, fiendene og sjefene mest fra siden (armene deres sitter tett på brystet i riggen). Leddpunktet (der delen festes) må være der templatet sier, ellers sitter delen skjevt.

Spillet regner selv ut størrelsen på hver del fra figurens skjelett: beinet blir så langt at foten når bakken, armen så lang at våpenet havner i neven, og overkroppen så høy at nakken sitter like under toppen. Festepunktet til siden finner spillet selv der leddet er (midten av halsstumpen nederst på hodet, beltet, skulderen og hofta øverst). Derfor er det nok at bildene følger reglene i templatene, uten tall i manifestet. Overkroppen er unntaket: skulderleddene og halsroten står i manifestet (`shoulders` og `neck`, se Manifest), målt i bildet, fordi skulderplatene og halsen sitter forskjellig fra bilde til bilde.

Figurene står i trekvart profil mot høyre. Den nære skulderen (figurens høyre) er til venstre i overkroppsbildet: der henger våpenarmen, og den tegnes foran brystet. Den andre armen henger fra den fjerne skulderen til høyre og tegnes bak overkroppen. Hodet ligger bak overkroppen, så halsen går inn under kragen (hoder med langt skjegg ligger foran, `front` i manifestet). Halsen hører til hodet, så en ny overkropp skal ikke ha halsstump. De gamle overkroppene har det, og der toner spillet ut stumpen over halsroten (tredje verdi i `neck`). I slagene strekker figuren våpenarmen fram og tar et lite steg inn (`bodyX` i stillingene i `src/game/attacks.ts`), ellers ville våpenet stoppet ved hofta.

Armen og våpenet passer sammen selv om ChatGPT ikke tegner helt etter templatet: spillet finner neven nederst i armbildet og snur og skalerer armen om skulderen, så neven havner nøyaktig der våpenet sitter (en arm som er bøyd eller strukket litt fram, blir rettet opp). Grepet på våpenet finner spillet også selv: det smale skaftet eller håndtaket i nedre halvdel, en halv neve over enden (over knappen eller ringen). Det som må stemme i bildet, er at neven er det laveste i armbildet. Er den ikke det (en arm som strekkes rett fram, som Vorthax sin), sett `hand` i manifestet. `node tools/tests/artcheck.mjs http://localhost:4173/ mappe` viser alle figurene i fire poser med merker på leddene, og sjekker at neven og våpenet møtes.

| Del | Filnavn | Leddpunkt (anker) | Template |
|---|---|---|---|
| Helfigur | `<id>_reference.png` | Brukes ikke i spillet | REFERENCE |
| Hode | `<id>_head.png` | Halsstumpen nederst | HEAD |
| Hårmanke bak | `<id>_hairback.png` | Nakken, litt ned fra toppen og til høyre | HAIRBACK |
| Overkropp | `<id>_torso.png` | Midjen nederst; skulderleddene og halsroten står i manifestet (`shoulders`, `neck`) | TORSO |
| Hofte / lendeklede | `<id>_pelvis.png` | Beltet øverst | PELVIS |
| Arm | `<id>_arm.png` | Skulderen øverst, neven nederst (spillet retter armen etter neven) | ARM |
| Bein | `<id>_leg.png` | Hofteleddet øverst, sålen nederst | LEG |
| Våpen | `<id>_weapon.png` | Grepet på skaftet (spillet finner det); skaftenden nederst | WEAPON |

Samme arm og samme bein brukes både foran og bak (spillet gjør den bakre litt mørkere). Hårmanken legges bak overkroppen og følger hodet.

### REFERENCE
```
Asset: FULL-BODY REFERENCE of the character described above. The whole character from the top of the hair to the soles of the boots, standing in a relaxed, confident 3/4 pose facing RIGHT, holding the weapon. Soft even studio light. Neutral light grey background (this image is only a reference and is not used in the game). Canvas 1024x1536.
```

### HEAD
```
Asset: HEAD of the character in the attached reference. Same face, same hair, same materials, same colours, same light.
Draw only the head (with helmet or hair), in 3/4 view facing RIGHT, with the whole neck down to a smooth rounded base at the bottom (the game puts it behind the torso's collar).
The neck must be the LOWEST part of the image: nothing (hair, beard, jewellery) may hang lower than the bottom of the neck. No shoulders, no chest.
Keep all hair ABOVE the shoulders. Big volume around the head is great. Long hair that would hang down the back goes in a separate HAIRBACK image.
Canvas 1024x1024, transparent background.
```

### HAIRBACK (bare ved langt hår)
```
Asset: HAIR BACK of the character in the attached reference. Same hair colour and style.
Draw ONLY the long hair that falls down behind the head and down the back, seen from the side facing RIGHT (so the hair hangs down on the LEFT side of the image). The top of the hair mass is at the top of the image, the ends at the bottom, about waist long. The top fifth is hidden behind the head in the game. NO face, NO head, NO body, NO hands. It will be placed behind the body.
Canvas 1024x1536 (tall), transparent background.
```

### TORSO
```
Asset: TORSO of the character in the attached reference. Same body, same materials, same colours, same light.
Draw only the upper body from the waist up to the neckline, facing RIGHT (3/4 view for heroes, side view for enemies and bosses). NO head, NO neck, NO arms, NO legs, NO hair.
The waist is the bottom edge. The neckline (collar) is just below the top; the head brings its own neck. The near shoulder is on the LEFT: a rounded shoulder or a flat plain socket no wider than the arm's shoulder cap, where the weapon arm hangs in front. The far shoulder on the RIGHT is a plain rounded shoulder.
Canvas 1024x1024, transparent background.
```

### PELVIS
```
Asset: PELVIS / LOINCLOTH of the character in the attached reference. Same materials and colours.
Draw only the belt and what hangs from it (loincloth, chainmail flap, briefs, armour plates), 3/4 view facing RIGHT. NO legs, NO torso.
The belt is the top edge and the widest thing at the top (no fur tufts or buckles sticking out wider than the belt). The cloth hangs down and may be long.
Canvas 1024x1024, transparent background.
```

### ARM
```
Asset: ARM of the character in the attached reference. Same skin, same bracers, same light.
Draw only one arm hanging STRAIGHT DOWN, side view: the round shoulder at the very top, the elbow in the middle, a CLOSED FIST filling the bottom of the image, knuckles facing RIGHT. The centre of the fist is where the weapon goes.
The fist must have a gap to grip a handle (the weapon is a separate image). NO weapon, NO body.
Canvas 1024x1536 (tall), transparent background.
```

### LEG
```
Asset: LEG of the character in the attached reference. Same skin, same boots, same light.
Draw only one leg hanging STRAIGHT DOWN, side view: the round hip joint at the very top, the knee in the middle, the foot/boot at the bottom with the sole flat and the TOES POINTING RIGHT. Thick, powerful thigh.
NO body, NO other leg. Canvas 1024x1536 (tall), transparent background.
```

### WEAPON
```
Asset: WEAPON of the character in the attached reference. Same materials, same wear and rust.
Draw only the weapon, perfectly VERTICAL: the blade/head pointing UP, the handle pointing DOWN, as if held upright in a fist. The end of the handle (pommel, ring or butt) must be the LOWEST part of the image, and the hand grips about 82% of the way down.
No hand, no character. Canvas 1024x1536 (tall), transparent background.
```

---

## Figurbeskrivelser

Lim inn beskrivelsen, så templatet for delen du vil lage. Kolonnen "Deler" viser hvilke filer figuren trenger. Stil-blokken gjør alle figurene nesten ekte, også de som høres tullete ut.

| id | Beskrivelse (lim inn) | Deler |
|---|---|---|
| `thrugg` | `Character: THRUGG THE UNWASHED, a huge barbarian hero in his forties, near-real caricature. Tan, sweaty, oiled skin with scars and grime, a big square head with a jutting stubbled jaw, a broken nose, one thick angry eyebrow, gritted teeth, shaggy black hair under a dented steel horned helmet with bone-white horns and rivets. Absurdly muscular: giant pecs, a six-pack, grapefruit-sized biceps, veins. A diagonal leather strap with steel studs across the chest, a mangy brown fur mantle on the shoulders, leather bracers, a tiny brown fur loincloth on a leather belt with a round brass buckle, thick powerful legs in fur boots. Weapon: a long, nicked steel broadsword with a brass crossguard and a red gem in the pommel.` | head, torso, pelvis, arm, leg, weapon |
| `valkyra` | `Character: VALKYRA THE LOUD, a fierce, cocky warrior woman in her thirties, near-real caricature. Fair skin covered in freckles, a huge wild mane of curly copper-red hair falling past her shoulders, heavy-lidded green eyes with dark smoky make-up, thick arched eyebrows, a small nose, full lips in a smug pout, large battered iron hoop earrings, a leather choker with an iron chain and a small horned skull pendant. Broad muscular shoulders, big exaggerated curves, a defined six-pack, thick muscular thighs; clearly an adult, never nude. A rusty iron chainmail bikini top on leather straps with an iron ring in the centre, a wide studded leather belt with a bone skull buckle and a long rusty chainmail flap hanging in front over small leather briefs. A leather band around the upper arm, spiked iron vambraces with fur trim on both forearms. Knee-high, worn brown leather boots with thick grey-brown fur tops, iron buckles and straps. Weapon: a big single-bitted battle axe with a nicked, rusty blade, spikes on the back and the top, a leather-wrapped wooden haft and an iron ring at the bottom.` | head, hairback, torso, pelvis, arm, leg, weapon |
| `skeleton` | `Character: SKELLY GRUNT, a grim undead skeleton soldier. Yellowed, cracked bones, a skull with a faint red glow deep in the dark sockets, grinning teeth, dented rusty brown helmet, tattered grey-green loincloth rag. Weapon: a short rusty notched sword.` | head, torso, pelvis, arm, leg, weapon |
| `hogman` | `Character: HOGMAN, a fat pig-orc brute. Olive green skin, pink pig snout, small white tusks, tiny angry yellow eyes, floppy ear, iron skull cap with a spike, big round belly with a lighter green front, leather harness, iron shoulder pad with spikes, dirty brown loincloth with a bone skull buckle, iron spiked bracers. Weapon: a big wooden club studded with iron spikes.` | head, torso, pelvis, arm, leg, weapon |
| `cultist` | `Character: CULTIST, a skinny hooded cultist. Dark purple robe with gold trim, hood with a pitch-black face and two glowing yellow eyes, belt of tiny skulls, pale bony hands, pointy black shoes, a gold eye symbol on the chest. Weapon: a curved sacrificial dagger.` | head, torso, pelvis, arm, leg, weapon |
| `gnome` | `Character: POTION GNOME, a tiny panicked gnome. Huge red pointy hat, fluffy white beard, big pink nose, blue coat, brown pants, oversized curled shoes, a burlap sack full of blue potions on his back. No weapon.` | head, torso, pelvis, arm, leg |
| `zombie` | `Character: BOG ZOMBIE, a slow swamp zombie. Sickly grey-green skin with darker rot patches, one big and one small blank yellow eye, hanging jaw with yellow teeth, stitches, torn brown shirt showing ribs, ragged dark trousers with a rope belt, bare clawed feet. No weapon.` | head, torso, pelvis, arm, leg |
| `frogman` | `Character: FROGMAN, a swamp frog warrior standing upright. Green skin with dark spots, pale yellow belly, big bulging yellow eyes on top of the head, wide mouth, reed skirt, webbed hands and big webbed feet, strong frog thighs. Weapon: a wooden trident spear.` | head, torso, pelvis, arm, leg, weapon |
| `troll` | `Character: ICE TROLL, a huge frost troll. Shaggy white-blue fur on body and legs, pale blue skin on face, belly and hands, big nose, two tusks, angry yellow eyes, leather belt with an ice gem, icicles on the shoulders. Weapon: a club made of jagged blue ice.` | head, torso, pelvis, arm, leg, weapon |
| `fireimp` | `Character: FIRE IMP, a small red demon imp. Bright red skin, black horns, bat wings on the back, glowing yellow slit eyes, wide toothy grin, thin tail, black claws. No weapon (throws fireballs).` | head, torso, pelvis, arm, leg |
| `imp` | `Character: CLEANUP IMP, a tired green goblin janitor. Green skin, huge pointy ears, blue janitor cap, big grin, yellow eyes, grey-blue overalls with a pocket, big bare feet. Weapon: a mop with a grey mop head and a few red stains.` | head, torso, pelvis, arm, leg, weapon |
| `gorthak` | `Character: GORTHAK THE UNDEFEATED, an arena champion with an absurdly muscular tan body and a huge black great helm with a T-shaped visor, two glowing red eyes and giant bone horns. Bare scarred chest crossed by two black leather straps with a bone skull emblem, a black spiked pauldron on the back shoulder, gigantic arms with black spiked bracers, a tiny black armoured loincloth with red trim, long powerful legs in dark iron greaves. Weapon: a giant double-bladed battle axe with dried blood on the blades.` | head, torso, pelvis, arm, leg, weapon |
| `hogmother` | `Character: BIG MAMA HOGMOTHER, a gigantic pig-orc mother boss. Olive green skin, pink snout, tusks, pink hair curlers, gold earring, lipstick, big belly with a white blood-stained butcher apron, dirty loincloth. Weapon: a huge butcher's cleaver with blood stains.` | head, torso, weapon (bruker hogman sine armer, bein og hofte) |
| `croakus` | `Character: KING CROAKUS, an enormous fat frog king. Green spotted skin, huge pale belly, sleepy heavy-lidded bulging eyes, small gold crown with red gems, red royal cape with white fur trim, purple royal loincloth with a gold belt. Weapon: a gold sceptre with a purple orb.` | head, torso, pelvis, leg, weapon (bruker frogman sin arm) |
| `magmor` | `Character: MAGMOR THE MOLTEN, a lava golem boss made of black and dark grey rock chunks with glowing orange lava cracks, small blocky head with glowing yellow eyes and a lava mouth, flames on top of the head, huge rock fists. No weapon.` | head, torso, pelvis, arm, leg |
| `vorthax` | `Character: VORTHAX THE MODERATELY EVIL, an old sorcerer villain. Purple robes with gold trim and dots, tall purple pointy hat with a small skull, long white beard, glowing red eyes, pale wrinkled skin, wide sleeves. Weapon: a crooked wooden staff with a glowing cyan orb.` | head, torso, pelvis, arm, leg, weapon |

Hero Forge har en felles pool med 58 malte delvalg fra grunnpakken og 39 Forge-bilder. Den samlede kunstpakken har 182 bildefiler. Se `docs/HERO_FORGE_GRAFIKK.md` for filkart og videre utvidelser. Frie hårfrisyrer, hjelmer, skjegg og farger finnes foreløpig i CLASSIC BUILDER; egne bildelag er fortsatt planlagt.

### Valkyra og referansebildet

Tom har et godkjent referansebilde av Valkyra (ligger ikke i repoet, repoet er offentlig). Last det opp i ChatGPT som REFERENCE, og bruk det i hver bestilling av delene hennes. Håret hennes er så langt at det trenger to bilder: HEAD med manken rundt hodet, og HAIRBACK med håret som faller ned bak ryggen. Den tegnede utgaven i spillet er satt opp etter samme bilde (vill kobberrød manke, selvgodt blikk, rusten ringbrynje, pelsstøvler og øks), så hun ligner selv før PNG-ene er på plass.

### Størrelser

Spillet regner ut høyden på hver del fra figurens skjelett (se over), så de samme reglene virker for helter, fiender og sjefer. Hoftedelen til heltene skaleres etter beltet: beltet øverst blir 0.5 bredt (like bredt som midjen), så en lang ringbrynjeflik som Valkyras får plass uten at beltet krymper. Hodet får omtrent samme høyde som det tegnede hodet, med håret. Karikaturen ligger i selve bildet: tegn hodet, håret, hendene og støvlene store. Ser noe for lite eller for stort ut, sett `height` i manifestet (for eksempel 1.25 for et hode).

---

## Heltesmia (HERO FORGE)

PAINTED PARTS lar spilleren kombinere elleve hoder, elleve våpen og ni overkropper, belter, armer og bein. Thrugg og Valkyra er startoppsett; ett bytte av del beholder resten av den malte helten. `docs/HERO_FORGE_GRAFIKK.md` beskriver tre tillegg på 13, 12 og 14 bilder. Det siste gir Ash Raider, Iron Warden og fire nye våpenutseender.

- Stridshammeren heter `forge_warhammer_weapon.webp` og følger WARHAMMER-egenskapene og opplåsingen `weapon:2`. Den eldre bestillingen `warhammer_weapon.png` er erstattet av dette navnet.
- Orc-delene er tilgjengelige fra start. Frosthode, -overkropp, -arm og -bein følger `skin:6` fra Frostjarl Kaldor; frostbeltet er fritt. Orc-overkroppen setter kvinnelig kroppstype, frost-overkroppen mannlig.
- `forge_sabre_weapon.webp` bruker SWORD-egenskaper og er fritt. `forge_boneclub_weapon.webp` bruker SPIKED CLUB-egenskaper og følger `weapon:3` fra Bone Coliseum.
- Ash-delene og fire Warden-kroppsdeler er frie. Warden-hjelmen følger `helmet:5`. Cleaver og doubleaxe er frie sverd-/øksevalg; maul følger `weapon:2`, flangedmace `weapon:3`. Fiendene `ashraider` og `ironwarden` bruker delene direkte i Scorchlands og Tower; de krever ingen egen bildekopi.
- Nye versjoner av `hogmother_torso`, `imp_arm` og `gorthak_arm` erstatter de gamle filene. De teller ikke som ekstra Forge-bilder, og nye målte punkter må følge de nye bildene.
- Hår, skjegg og hud er del av de malte bildene. CLASSIC BUILDER beholder de frie prosedyretegnede detaljvalgene. Magi kan byttes i begge byggere.
- Valgene lagres separat for begge spillere og brukes i forhåndsvisning, brett, dueller og portretter.
- Neve, skulder og våpengrep må passe. Claudes automatiske hånd- og grepberegning brukes også på de nye delene; et målt `hand` eller `anchor` i manifestet går foran.
- Overkroppene i smia har målte `shoulders` og `neck` som de andre overkroppene: våpenarmen henger fra den nære skulderen (venstre i bildet) og ligger foran, hodet ligger bak kragen. Reglene for nye deler står i `docs/CHATGPT_PROMPT.md` (del 3, 8.2, 8.4, 8.6 og 13), og beskjeden til GPT i `docs/GPT_BESKJED.md`.

Nye deler legges i `art/inbox/` med navnet `forge_<variant>_<del>.png` og behandles med `python3 tools/process_art.py`. Registrer deretter valget i `src/data/hero-parts.ts`. Bare å legge inn et våpenbilde med et nytt navn gjør det ikke til et valg i smia.

### Senere mulige helteoppsett

Forslagene nedenfor er idéer til senere ferdige oppsett, ikke manglende filer i den leverte Forge-pakken. En ny helt kan bruke eller bidra med deler i den felles poolen. Ingen av disse fire figurene er bestilt eller produsert her.

| id | Valg i smia | Beskrivelse til ChatGPT |
|---|---|---|
| `bruno` | MALE, BRONZE, BATTLE CRY, BALD, BRAIDED BEARD, NONE, PLATE, TASSETS, GREAVES, WARHAMMER | `Character: BRUNO THE BALD, a huge bald barbarian in his fifties with bronze skin, a shiny scarred scalp, a long braided grey-black beard with iron rings, a roaring mouth, battered steel plate armour on the chest and shoulders, steel tassets over a leather skirt, steel greaves over leather boots.` |
| `hilda` | FEMALE, PEACH, GRIM, BRAIDS, BLOND, WINGED, CHAINMAIL, CHAINMAIL BRIEFS, LEATHER BOOTS, SWORD | `Character: HILDA SKULLKICKER, a tall grim shieldmaiden with pale freckled skin, two thick blond braids, a steel helmet with white wings, a rusty chainmail top, chainmail briefs on a studded belt, and knee-high leather boots; clearly an adult, never nude.` |
| `zugga` | FEMALE, ORC GREEN, UNHINGED, MOHAWK, BLOOD RED, BEAST SKULL, LEATHER, BATTLE SKIRT, FUR BOOTS, SPIKED CLUB | `Character: ZUGGA THE UNREASONABLE, a wild orc warrior woman with green skin, small tusks, a blood-red mohawk under a beast skull helmet, studded leather armour, a battle skirt of leather strips and fur boots; clearly an adult, never nude.` |
| `gromm` | MALE, FROST BLUE, EYEPATCH, PONYTAIL, WHITE, FULL BEARD, CROWN, LEATHER, KILT, RED BOOTS, AXE | `Character: GROMM THE FROSTBITTEN, an old frost-blue barbarian king with an eyepatch, a white ponytail and a full white beard, a dented iron crown, a leather jerkin, a woollen kilt and bright red boots.` |

### Hele smia malt (større jobb, må avtales)

At hvert enkelt valg i smia skal være malt, krever lag som legges oppå hverandre: ett ansikt per ansiktsvalg og kropp, hår, skjegg og hodeplagg som egne lag i nøyaktig samme utsnitt, hår og tøy i nøytral grå så spillet kan farge dem, og en overkropp, hofte og bein per rustning, lendeklede og fottøy. Det er rundt 60 bilder der alle lagene må passe nøyaktig oppå hverandre, pluss kode for lagene og fargingen. ChatGPT treffer sjelden nøyaktig samme utsnitt fra bilde til bilde, så dette bør prøves med ett ansikt og to frisyrer først.

---

## Teksturer for 3D-verdenen

Miljøet er ekte 3D: bakken, veien, murene og gulvene er flater i 3D, og trær, steiner og hodeskaller er modeller. Spillet lager egne teksturer med støy, men et ekte bilde gir mer realisme. Hver tekstur gjentas mange ganger, så den må være **flisbar** (sømløs). Spillet lager selv relieff (normalkart) ut fra lysheten i bildet, lager veikanten, og får lava til å gløde der bildet er lyst oransje.

Slik gjør du det:
1. Lim inn **TEKSTUR-BLOKKEN** som første melding (egen samtale, så figurstilen ikke blander seg inn).
2. Bestill én tekstur om gangen med linjen fra tabellen.
3. Sjekk sømmene: be om "Show it tiled 2x2 so I can check the seams". Ser du skjøter, skriv "Make it perfectly seamless".
4. Lagre i `public/assets/` med filnavnet fra tabellen, og legg den inn under `textures` i manifestet: `"ground_grass": "tex_ground_grass.png"`.

Teksturen vises i sine egne farger, så lag den i fargen den skal ha. Unntaket er `wall_gate`, som farges av spillet for hvert land.

### TEKSTUR-BLOKK (lim inn først)
```
You are making seamless textures for a realistic 3D game (a 1980s dark fantasy beat 'em up).
Rules for ALL textures in this conversation:
- Photorealistic, like a scanned PBR albedo texture of a real surface.
- Perfectly SEAMLESS and TILEABLE in both directions: the left edge continues into the right edge, the top into the bottom.
- Flat, even, diffuse light. NO sun shadows, NO highlights, NO vignette, NO perspective. Ground is seen straight down from above, walls straight on.
- No single big object that would repeat visibly, no text, no watermark, no border.
- Square, 1024x1024, PNG.
Confirm that you understand. Then wait for my texture requests.
```

### Teksturliste

| Navn i manifestet | Fil | Brukes til | Prompt |
|---|---|---|---|
| `ground_grass` | `tex_ground_grass.png` | Bakken i grasslandet (brett 1) | `Texture: late-autumn meadow ground, about 3.5 x 3.5 metres seen from above: short trampled yellow-green grass in tufts, patches of bare brown soil, small grey pebbles, a few fallen orange leaves.` |
| `road_grass` | `tex_road_grass.png` | Veien i grasslandet | `Texture: packed dirt road, about 6 x 5 metres seen from above, running LEFT to RIGHT: dry brown earth, two faint wheel ruts along the road, embedded small stones and gravel. The road surface fills the whole image, no grass verges.` |
| `ground_swamp` | `tex_ground_swamp.png` | Bakken i sumpen | `Texture: swamp ground seen from above: wet dark mud, patches of green moss, rotting reeds and twigs, small murky puddles.` |
| `road_swamp` | `tex_road_swamp.png` | Veien i sumpen | `Texture: muddy swamp track seen from above, running LEFT to RIGHT: sticky brown mud with footprints and wheel ruts, puddles, a few stones. The track fills the whole image.` |
| `ground_frost` | `tex_ground_frost.png` | Bakken i frosten | `Texture: fresh snow seen from above: soft wind ripples, a few ice crystals, tiny tips of dry grass poking through.` |
| `road_frost` | `tex_road_frost.png` | Veien i frosten | `Texture: trampled snow road seen from above, running LEFT to RIGHT: packed icy snow, wheel ruts and boot prints, a little grey slush. The road fills the whole image.` |
| `ground_scorch` | `tex_ground_scorch.png` | Bakken i vulkanlandet (alt lyst oransje gløder) | `Texture: black and dark grey cracked volcanic rock seen from above, with bright glowing orange-yellow lava only in the cracks and a little grey ash. The rock itself stays dark, never red or rusty.` |
| `road_scorch` | `tex_road_scorch.png` | Veien i vulkanlandet (glørne gløder) | `Texture: road of dark grey ash and cinders seen from above, running LEFT to RIGHT, small black rocks and a few glowing orange embers. The road fills the whole image.` |
| `ground_night` | `tex_ground_night.png` | Bakken ved nattleiren | `Texture: dark forest floor seen from above: damp dark-green grass, moss, dead brown leaves and twigs, a few pebbles.` |
| `road_night` | `tex_road_night.png` | Veien ved nattleiren | `Texture: muddy forest road seen from above, running LEFT to RIGHT: dark brown mud, wheel ruts, stones and gravel. The road fills the whole image.` |
| `wall_keep` | `tex_wall_keep.png` | Borgmuren og tårnet ved start | `Texture: castle wall of large grey granite blocks seen straight on, about 4 blocks across and 8 courses high, weathered, chipped edges, dark mortar joints with a little moss.` |
| `wall_gate` | `tex_wall_gate.png` | Porttårnene før duellene (farges per land) | `Texture: rough stone blocks in NEUTRAL LIGHT GREY seen straight on, about 4 blocks across and 8 courses high, darker mortar joints.` |
| `wood` | `tex_wood.png` | Treplanker (brua ved start) | `Texture: weathered wooden planks seen from above, 4 planks side by side running from TOP to BOTTOM, grey-brown old wood with cracks, knots and rusty nail heads.` |
| `floor_tower` | `tex_floor_tower.png` | Gulvet i tårnet | `Texture: dark purple-grey stone floor seen from above, 4 x 4 square flagstones, worn smooth, cracks, dark grout, a few old stains.` |
| `wall_tower` | `tex_wall_tower.png` | Veggen i tårnet | `Texture: dark purple-grey dungeon wall of stone blocks seen straight on, about 4 blocks across and 6 courses high, damp, soot stains.` |
| `pillar_tower` | `tex_pillar_tower.png` | Søylene i tårnet | `Texture: carved dark purple-grey stone blocks seen straight on, about 4 across and 8 high, worn and cracked.` |
| `floor_arena-pit` | `tex_floor_arena-pit.png` | Gulvet i gropa (arena) | `Texture: stone floor seen from above, 4 x 4 large warm grey flagstones, sandy, worn and cracked, dark grout.` |
| `sand_arena-pit` | `tex_sand_arena-pit.png` | Sanden i gropa | `Texture: arena sand seen from above: coarse yellow-brown sand, footprints, small pebbles, a few old dark-red blood stains.` |
| `wall_arena-pit` | `tex_wall_arena-pit.png` | Muren og balkongen i gropa | `Texture: arena wall of warm grey sandstone blocks seen straight on, about 4 blocks across and 6 courses high, scratched and chipped.` |
| `pillar_arena-pit` | `tex_pillar_arena-pit.png` | Søylene i gropa | `Texture: warm grey sandstone blocks seen straight on, about 4 across and 8 high, weathered.` |

Isarenaen og beinarenaen bruker samme navn med `-ice` og `-bone` i stedet for `-pit` (for eksempel `floor_arena-ice`). Lag dem i blåhvit is og stein (ice) og i gammelt, gulnet bein og sandstein (bone).

---

## Bakgrunner

Grasslandet, sumpen og frosten har en fysisk himmel laget i kode (sol, spredt lys og skyer), og den lyser også opp scenen. Et himmelbilde i manifestet tar over for den i det miljøet, så lag bare bilder der du vil ha noe annet enn den. Vulkanlandet, nattleiren og arenaene bruker himmelbildet direkte. Tårnet er innendørs og har ingen himmel.

Slik vises himmelbildet: det gjentas fire ganger rundt brettet, så det må være helt sømløst mellom venstre og høyre kant. Horisonten ligger omtrent 73 prosent ned i bildet, og det meste som synes er båndet fra omtrent 35 til 75 prosent ned. Den nederste femtedelen skjules av bakken, tåka og 3D-fjellene. Når et himmelbilde brukes, tegner ikke spillet sin egen sol, måne eller skyer, så de kan være med i bildet.

| Fil | Bruk | Prompt |
|---|---|---|
| `sky_grass.png` | Himmel, brett 1 | `Wide panoramic sky background, 1536x1024, seamless left-right. Photorealistic matte painting of a warm late-afternoon sky over rolling hills: orange-gold light, big volumetric clouds lit from below, a pale sun low on the horizon, the horizon about 73% down the image with distant blue hills along it. No characters, no text.` |
| `sky_swamp.png` | Himmel, sumpen | `Wide panoramic sky background, 1536x1024, seamless left-right. Photorealistic murky green-grey overcast swamp sky, low heavy clouds, faint mist bands, silhouettes of dead twisted trees and low hills along the horizon, about 73% down the image. No characters, no text.` |
| `sky_frost.png` | Himmel, frosten (blåtimen, som konseptbilde 4) | `Wide panoramic sky background, 1536x1024, seamless left-right. Photorealistic blue hour just after sunset in a high mountain pass: deep blue sky, a faint warm glow low on the horizon a little right of centre, the first few stars high up, a jagged snowy mountain range in cold blue shadow along the horizon about 73% down the image, light snowfall. No sun disc, no characters, no text.` |
| `sky_scorch.png` | Himmel, vulkanlandet | `Wide panoramic sky background, 1536x1024, seamless left-right. Photorealistic hellish volcanic sky, black at the top fading to deep red and orange, ash clouds, a distant erupting volcano on the horizon about 73% down the image, ember sparks. No characters, no text.` |
| `sky_night.png` | Himmel, nattleiren | `Wide panoramic night sky, 1536x1024, seamless left-right. Photorealistic dark blue night with a big pale moon behind thin clouds, stars, a black forest treeline along the horizon about 73% down the image. No characters, no text.` |
| `sky_arena-pit.png` | Himmel over gropa | `Wide panoramic night sky, 1536x1024, seamless left-right. Dark crimson night with thin clouds and a few stars, like the sky above a gladiator pit, horizon about 73% down the image. No characters, no text.` |
| `map.png` | Verdenskartet | `Top-down fantasy world map of an island, 1536x1024, like an old hand-painted fantasy map with ink and watercolour on parchment, terrain only. West: green grassland and fields. South-centre: murky swamp with a pond. North: snowy uplands. East: black volcanic wasteland with a lava river. Far east: a dark rocky cliff by the sea. A blue river runs from the north to the swamp. The land stays inside an oval that leaves a margin of sea all around (about 10% at the sides, 12% at the top and bottom), and the sea is dark slate blue (#2a4a6a) out to all four edges. NO buildings, NO castle, NO tower, NO volcano cone, NO trees drawn as symbols, NO text, NO labels, NO roads (the game places 3D models and paths on top).` |

Kartbildet må ha samme utsnitt som det innebygde kartet: hjemborgen til venstre (vest), tårnet helt til høyre (øst), frost i nord (oppe), sump i sør (nede). Spillet setter selv 3D-modeller av borgen, tårnet, vulkanen, fjell og trær oppå bildet, så bildet skal bare vise landskapet. Havet utenfor bildet er flatt i fargen #2a4a6a, så kantene på bildet bør ha samme farge.

---

## Manifest

Eksempel (`public/assets/manifest.json`):

```json
{
  "parts": [
    { "char": "valkyra", "part": "head", "file": "valkyra_head.png" },
    { "char": "valkyra", "part": "hairback", "file": "valkyra_hairback.png" },
    { "char": "valkyra", "part": "torso", "file": "valkyra_torso.png" },
    { "char": "valkyra", "part": "pelvis", "file": "valkyra_pelvis.png" },
    { "char": "valkyra", "part": "arm", "file": "valkyra_arm.png" },
    { "char": "valkyra", "part": "leg", "file": "valkyra_leg.png" },
    { "char": "valkyra", "part": "weapon", "file": "valkyra_weapon.png" }
  ],
  "textures": {
    "ground_grass": "tex_ground_grass.png",
    "road_grass": "tex_road_grass.png",
    "wall_keep": "tex_wall_keep.png"
  },
  "sky": { "scorch": "sky_scorch.png" },
  "map": "map.png"
}
```

- `height` (valgfri) er delens høyde i spillenheter. Uten den regner spillet ut høyden fra figurens skjelett: beinet når bakken, overkroppen når nakken, neven havner der våpenet sitter, og hode, hofte og våpen blir omtrent like høye som de tegnede delene. Heltenes hofte skaleres så beltet blir 0.5 bredt. Hårmanken er 1.25 høy for heltene og 1.3 ellers. For ridedyr når beinet bakken, og hode, kropp og hale blir like høye som de tegnede delene.
- `anchor` (valgfri) er leddpunktet i det beskårne bildet, `[x, y]` fra 0 til 1 der `y` måles fra toppen. Høyden på leddet er fast (hode 0.95, hårmanke 0.22, overkropp 0.96, hofte 0.12, arm 0.06, bein 0.04), og sideplasseringen finner spillet selv fra kanten der leddet er (midten av halsstumpen, midjen, beltet, skulderen og hofta). For våpen er ankeret grepet, som spillet finner på skaftet (se over). Hårmanken bruker `[0.62, 0.22]`. Ridedyr: hode `[0.15, 0.55]`, kropp `[0.5, 0.5]`, hale `[0.92, 0.55]`, bein `[0.5, 0.06]`.
- `hand` (valgfri, bare armer) er neven i det beskårne bildet, `[x, y]` som `anchor`. Uten den finner spillet neven nederst i armen. Armen snus og skaleres så dette punktet havner der våpenet sitter. Eksempel: Vorthax strekker armen fram, så han har `"hand": [0.84, 0.51]`.
- `shoulders` (overkropper) er skulderleddene i det beskårne bildet, `[[x, y], [x, y]]`: først den nære skulderen (venstre i bildet, der våpenarmen henger), så den fjerne. Sett det nære punktet i øvre del av skulderplaten, for armen henger ned fra punktet og hetta øverst på armen skal dekke platen. Uten feltet bruker spillet `[[0.09, 0.32], [0.92, 0.32]]`.
- `neck` (overkropper) er halsroten der hodet festes, `[x, y]` (y er vanligvis 0.12, og overkroppen skaleres etter den). En tredje verdi, `[x, y, r]`, toner ut en halsstump over halsroten innenfor en halv bredde `r` (brøk av bredden), så hodets egen hals tar over uten søm. Uten feltet står hodet over midten av midjen, som ofte er feil i trekvart profil.
- `front` (hoder) er `true` når hodet skal ligge foran overkroppen: bare hoder med langt skjegg over brystet (gnomen og Vorthax).
- Skifter en overkropp eller arm bilde, stryker `process_art.py` de målte punktene (`shoulders`, `neck`, `hand`), for de hører til det gamle bildet. Mål dem på nytt med MEASURE.
- `textures` knytter navnene fra teksturlista til filer. Navn spillet ikke kjenner, blir ignorert.
- `tools/tests/textures.mjs` sjekker at teksturer fra manifestet blir brukt (den later som om tre bilder finnes).

---

## Ridedyr

Ridedyrene er satt sammen av fire deler: `body` (kropp med sal), `head`, `tail` og `leg` (samme bein brukes fire ganger, eller to for kakatrissen). Beinet skaleres så det når bakken. Hodet festes 15 prosent inn fra venstre kant og 55 prosent ned, halen 92 prosent bortover og 55 prosent ned, så la halsen og halerota gå helt ut til kanten. Kakatrissens hode er en lang, oppreist hals med hodet på toppen; der sitter halsrota nede til venstre, så sett `"anchor": [0.27, 0.84]` for den. Alt lages **sett fra siden, vendt mot høyre**, uten rytter. Filnavn: `<id>_body.png`, `<id>_head.png`, `<id>_tail.png`, `<id>_leg.png`. I manifestet: `{ "char": "warhog", "part": "body", "file": "warhog_body.png" }`. Bruk stil-blokken: ridedyrene skal også se nesten ekte ut.

| id | Beskrivelse (lim inn) |
|---|---|
| `warhog` | `Mount: WAR HOG, a huge angry armoured war boar, side view facing right. Dark brown bristly hide, a mohawk of black bristles along the spine, a red saddle blanket with gold trim and gold triangles, a brown leather saddle, an iron collar with spikes, scars. Head: small furious red eye, iron head plate with a spike, big white curved tusks, pink snout. Curly pink tail. Short thick legs with dark hooves.` |
| `cluckatrice` | `Mount: CLUCKATRICE, half giant rooster and half lizard, side view facing right. Fluffy cream-white feathered body with brown speckles and a folded wing, a blue saddle blanket with gold trim, a leather saddle. Long neck with a rooster head: red comb, yellow beak, red wattle, one crazy wide eye. A long green scaly lizard tail ending in a tuft of red and white feathers. Two big orange bird legs with talons.` |
| `magmanewt` | `Mount: MAGMA NEWT, a big fire salamander, side view facing right. Long low dark red body with glowing orange and yellow lava spots, a dark saddle with gold trim, black spikes on the shoulders. Wide flat head with a long mouth line, glowing yellow slit eyes and two small black horns. Long tapering tail with a glowing tip. Four short splayed legs with claws.` |

Deltemplater for ridedyr:

```
Asset: BODY of the mount described above. Only the body with the saddle, NO head, NO tail, NO legs (leave round sockets where they attach). Side view facing RIGHT. Canvas 1536x1024, transparent background.
```
```
Asset: HEAD of the mount described above. Only the head (and neck for the cluckatrice), facing RIGHT. The neck joint is at the LEFT edge, vertically centred. Canvas 1024x1024, transparent background.
```
```
Asset: TAIL of the mount described above. Only the tail, pointing LEFT (backwards). The base of the tail is at the RIGHT edge. Canvas 1536x1024, transparent background.
```
```
Asset: LEG of the mount described above. Only one leg hanging STRAIGHT DOWN, hip joint at the top centre, hoof/claws at the bottom pointing RIGHT. Canvas 1024x1536 (tall), transparent background.
```

---

## Kjæledyr

Én sprite per kjæledyr, vendt mot høyre, 1024x1024, transparent. Spillet beholder bildets proporsjoner og gjør det like høyt som det tegnede dyret. Kjæledyrene får ikke lys fra scenen, så de kan ha litt tydeligere lys i selve bildet. Filnavn `pet_<id>.png`, i manifestet: `{ "char": "pet_rat", "part": "body", "file": "pet_rat.png" }`.

| id | Beskrivelse (lim inn) |
|---|---|
| `eyeball` | `Pet: EYEBALL OF GREED, a floating bloodshot eyeball with a blue iris and small purple bat wings, greedy look. Facing right.` |
| `rat` | `Pet: RABID RAT, a scruffy grey-brown rat with red eyes, foam at the mouth, a long pink tail, running pose. Facing right.` |
| `skull` | `Pet: SARCASTIC SKULL, a floating bone-white skull with a smug expression, glowing green eyes and small green ghost flames underneath. Facing right.` |
| `chicken` | `Pet: BATTLE CHICKEN, a small plump white hen wearing a tiny steel helmet with a little horn, determined look. Facing right.` |
| `dragon` | `Pet: TINY DRAGON, a small chubby red dragon with dark red wings, a yellow belly and an angry face, flying. Facing right.` |

---

## Studio-logo

Logoen til **Tom's Happy Happy Funtimes Emporium** er levert av Tom og ligger i `art/studio/toms-happy-happy-funtimes-emporium.png` (original) og `src/assets/studio-logo.webp` (komprimert, bygges inn i spillet). Ny versjon av logoen: bytt ut begge filene (samme navn), og hold bakgrunnen transparent.

---

## Planlagt (ikke koblet inn i koden ennå)

Dette er senere utvidelser. Avtal først filnavn, lagplassering og innlesing: flere av navnene nedenfor avvises av dagens innleser. Prioriter de separate delene i `docs/HERO_FORGE_GRAFIKK.md` før egne hår-, hjelm- og fargelag.

| Pakke | Filer | Merknad |
|---|---|---|
| Heltebygger | `hero_face_<m/f>.png`, `hero_hair_<stil>.png`, `hero_helmet_<type>.png`, `hero_beard_<type>.png`, `hero_torso_<type>_<m/f>.png`, `hero_pelvis_<type>.png`, `hero_legs_<type>.png` | Se "Heltesmia (HERO FORGE)" over: hele delpoolen og stridshammeren virker nå. Egne lag er en senere utvidelse. Lag på HEAD-, TORSO-, PELVIS- og LEG-templatet. Hår, hjelm og skjegg lages som egne lag på samme lerret (1024x1024) så de kan legges oppå et ansikt. Farger: lag hår og tøy i nøytral grå så spillet kan farge dem. |
| Pickups og ikoner | `icon_potion.png`, `icon_chicken.png`, `icon_ham.png`, `icon_coin.png`, `proj_dagger.png`, `proj_fireball.png`, `proj_snowball.png`, `proj_poison.png` | 512x512, transparent. |
| Tittel og kort | `title.png` (logo-illustrasjon), `boss_<id>.png` (VS-kort 1536x1024 per sjef) | Til tittelskjerm og sjef-intro. |
| Gore | `gib_meat_1..3.png`, `gib_bone.png`, `gib_eye.png`, `splat_1..3.png` | Nesten ekte, vått og blankt, over the top. 256x256. Blod og gibs er i dag 3D-partikler, så dette er bare aktuelt som ekstra detalj. |
| Farer | `hazard_spikes.png`, `hazard_bog.png`, `hazard_icehole.png`, `hazard_lava.png`, `hazard_spiketrap.png` | Sett rett ovenfra, 1024x512, transparent kant. Tegnes i dag i 3D av koden. |
| FAMILY-modus | `gib_duck.png`, `gib_flower.png`, `gib_star.png` | Gummiand, blomst og stjerne som erstatter gibs når gore står på FAMILY. 256x256. |
