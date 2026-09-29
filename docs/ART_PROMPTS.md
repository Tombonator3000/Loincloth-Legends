# Grafikkliste for ChatGPT (GPT-image)

Denne lista beskriver all grafikk spillet kan bruke, med ferdige prompter du kan lime inn i ChatGPT. Spillet virker uten noen av disse filene (alt tegnes prosedyremessig), så du kan bytte ut én figur eller ett bilde om gangen.

## Slik gjør du det

1. Start en ny samtale i ChatGPT. Lim inn **STIL-BLOKKEN** under som første melding og skriv "Bekreft at du har forstått stilen".
2. Lag **én del per bilde**. Lim inn figurbeskrivelsen (fra tabellen) og deretter deltemplatet (LEG, ARM osv.).
3. Be alltid om **transparent bakgrunn** og PNG. Last ned bildet.
4. Når første del av en figur er ferdig: last opp den delen i neste melding og skriv "Use the attached image as the style and colour reference". Da blir resten av delene like.
5. Lagre filene i `public/assets/` med filnavnet fra lista (for eksempel `thrugg_leg.png`).
6. Legg til en linje i `public/assets/manifest.json` per fil (se `public/assets/manifest.example.json`).
7. Start `npm run dev`. Figuren bruker nå dine bilder. Ser en del feil ut, juster `anchor` eller `height` i manifestet.

Tips:
- Bildene kan være større enn nødvendig. Lasteren beskjærer gjennomsiktige kanter automatisk og skalerer delen til riktig høyde.
- Hvis ChatGPT legger på skygge eller bakgrunn, skriv: "Remove the background and the drop shadow, keep only the drawn part on full transparency."
- Hold figuren **vendt mot høyre** i alle deler. Spillet speiler selv når figuren snur.
- Lag ikke bilder av eksisterende spillfigurer eller logoer. Alt skal være originalt.

---

## STIL-BLOKK (lim inn først)

```
You are the art director for "Loincloth Legends", an original 2D/3D hybrid beat 'em up that parodies 1980s dark fantasy.
Art style for ALL images in this conversation:
- Hand-drawn 2D cartoon game art in the style of Flash-era indie brawlers: thick, clean black outlines (about 8 px at 1024 px), flat colours with ONE cel-shade tone on the side facing away from the light (light comes from the upper right).
- Heroic 1980s fantasy-cover proportions pushed for comedy: long legs, very broad shoulders, a head slightly too small for the body, chunky fists and feet.
- The men have ridiculously oversized muscles: grapefruit biceps, huge pecs, a six-pack, forearms like hams.
- The women are muscular warriors in exaggerated 1980s fantasy-cover style: chainmail bikini, fur bikini or an oversized round breastplate, big exaggerated curves, red boots. Cartoony and funny, clearly adults, never nude.
- Everyone wears a tiny loincloth or a comically short kilt.
- 1980s sword-and-sorcery parody mood: horned helmets, loincloths, fur, skulls, rusty iron, gold trim. Colours are warm and saturated, never neon.
- Clean vector-like shapes, no painterly texture, no gradients except the single cel-shade, no glow effects, no text, no watermark, no signature.
- Everything is original. Do not copy or reference any existing game, film or comic character.
- Output: a single isolated game asset on a fully transparent background (PNG with alpha). No ground, no drop shadow, no frame.
Confirm that you understand. Then wait for my asset requests.
```

---

## Deltemplater (figurdeler)

Hver figur er en "papirdukke" som settes sammen i spillet. Alle deler tegnes **sett fra siden, vendt mot høyre**, isolert, uten de andre kroppsdelene. Leddpunktet (der delen festes) må være der templatet sier, ellers sitter delen skjevt.

| Del | Filnavn | Leddpunkt (anker) | Template |
|---|---|---|---|
| Hode | `<id>_head.png` | Nakken, nederst på midten | HEAD |
| Overkropp | `<id>_torso.png` | Midjen, nederst på midten | TORSO |
| Hofte / lendeklede | `<id>_pelvis.png` | Beltet, øverst på midten | PELVIS |
| Arm | `<id>_arm.png` | Skulderen, øverst på midten | ARM |
| Bein | `<id>_leg.png` | Hofteleddet, øverst (litt til venstre) | LEG |
| Våpen | `<id>_weapon.png` | Grepet, der hånda holder | WEAPON |

Samme arm og samme bein brukes både foran og bak (spillet gjør den bakre litt mørkere).

### HEAD
```
Asset: HEAD of the character described above.
Draw only the head (with helmet/hair/hat), in 3/4 view facing RIGHT, including a short neck stump at the bottom centre.
The neck stump must touch the bottom edge of the drawing, centred horizontally. Nothing below the neck.
Canvas 1024x1024, transparent background.
```

### TORSO
```
Asset: TORSO of the character described above.
Draw only the upper body from the waist up to the base of the neck, 3/4 view facing RIGHT. NO head, NO arms, NO legs.
The waist must be at the bottom edge, centred. The shoulders are at the top. Leave the arm sockets as simple rounded shoulders.
Canvas 1024x1024, transparent background.
```

### PELVIS
```
Asset: PELVIS / LOINCLOTH of the character described above.
Draw only the belt and what hangs from it (loincloth, skirt, armour plates), side view facing RIGHT. NO legs, NO torso.
The belt must be at the top edge, centred. The cloth hangs down.
Canvas 1024x1024, transparent background.
```

### ARM
```
Asset: ARM of the character described above.
Draw only one arm hanging STRAIGHT DOWN, side view: the round shoulder at the very top centre, the elbow in the middle, a CLOSED FIST at the bottom, knuckles facing RIGHT.
The fist must have a gap to grip a handle (the weapon is a separate image). NO weapon, NO body.
Canvas 1024x1536 (tall), transparent background.
```

### LEG
```
Asset: LEG of the character described above.
Draw only one leg hanging STRAIGHT DOWN, side view: the hip joint at the very top, knee in the middle, the foot/boot at the bottom with the TOES POINTING RIGHT.
NO body, NO other leg. Canvas 1024x1536 (tall), transparent background.
```

### WEAPON
```
Asset: WEAPON of the character described above.
Draw only the weapon, perfectly VERTICAL: the blade/head pointing UP, the handle pointing DOWN, as if held upright in a fist.
No hand, no character. Canvas 1024x1536 (tall), transparent background.
```

---

## Figurbeskrivelser

Lim inn beskrivelsen, så templatet for delen du vil lage. Kolonnen "Deler" viser hvilke filer figuren trenger.

| id | Beskrivelse (lim inn) | Deler |
|---|---|---|
| `thrugg` | `Character: THRUGG THE UNWASHED, a tan-skinned barbarian hero with heroic 1980s fantasy-cover proportions: long legs, very broad shoulders, a head slightly too small, an absurdly muscular body. Steel horned helmet with bone-white horns and rivets, shaggy black hair, heavy stubble, angry thick eyebrow, gritted teeth. Massive bare chest with huge pecs and a six-pack, a diagonal leather strap with steel studs, brown fur mantle on the shoulders, grapefruit-sized biceps, a tiny brown fur loincloth with a leather belt and a gold round buckle, short thick legs in fur boots, leather bracers. Weapon: a long steel sword with a gold crossguard and a red gem in the pommel.` | head, torso, pelvis, arm, leg, weapon |
| `valkyra` | `Character: VALKYRA THE LOUD, a fierce red-haired warrior woman with heroic 1980s fantasy-cover proportions: long legs, broad shoulders, big exaggerated curves, clearly an adult. Fair skin, long flowing red hair, a red headband, green eyes, mouth wide open in a battle cry. A chainmail bikini top with round chainmail cups and a gold rim, chainmail briefs with a small chain flap, a muscular midriff with abs, muscular arms with leather bracers, tall red leather boots. Cartoony and funny, never nude. Weapon: a straight steel sword with a gold crossguard and a red leather grip.` | head, torso, pelvis, arm, leg, weapon |
| `skeleton` | `Character: SKELLY GRUNT, a goofy undead skeleton soldier. Bone-white bones with black outlines, big skull with red dot pupils in dark sockets, grinning teeth, dented rusty brown helmet, tattered grey-green loincloth rag. Weapon: a short rusty notched sword.` | head, torso, pelvis, arm, leg, weapon |
| `hogman` | `Character: HOGMAN, a fat pig-orc brute. Olive green skin, pink pig snout, small white tusks, tiny angry yellow eyes, floppy ear, iron skull cap with a spike, big round belly with a lighter green front, leather harness, iron shoulder pad with spikes, dirty brown loincloth with a bone skull buckle, iron spiked bracers. Weapon: a big wooden club studded with iron spikes.` | head, torso, pelvis, arm, leg, weapon |
| `cultist` | `Character: CULTIST, a skinny hooded cultist. Dark purple robe with gold trim, hood with a pitch-black face and two glowing yellow eyes, belt of tiny skulls, pale bony hands, pointy black shoes, a gold eye symbol on the chest. Weapon: a curved sacrificial dagger.` | head, torso, pelvis, arm, leg, weapon |
| `gnome` | `Character: POTION GNOME, a tiny panicked gnome. Huge red pointy hat, fluffy white beard, big pink nose, blue coat, brown pants, oversized curled shoes, a burlap sack full of blue potions on his back. No weapon.` | head, torso, pelvis, arm, leg |
| `zombie` | `Character: BOG ZOMBIE, a slow swamp zombie. Sickly grey-green skin with darker rot patches, one big and one small blank yellow eye, hanging jaw with yellow teeth, stitches, torn brown shirt showing ribs, ragged dark trousers with a rope belt, bare clawed feet. No weapon.` | head, torso, pelvis, arm, leg |
| `frogman` | `Character: FROGMAN, a swamp frog warrior standing upright. Green skin with dark spots, pale yellow belly, big bulging yellow eyes on top of the head, wide mouth, reed skirt, webbed hands and big webbed feet, strong frog thighs. Weapon: a wooden trident spear.` | head, torso, pelvis, arm, leg, weapon |
| `troll` | `Character: ICE TROLL, a huge frost troll. Shaggy white-blue fur on body and legs, pale blue skin on face, belly and hands, big nose, two tusks, angry yellow eyes, leather belt with an ice gem, icicles on the shoulders. Weapon: a club made of jagged blue ice.` | head, torso, pelvis, arm, leg, weapon |
| `fireimp` | `Character: FIRE IMP, a small red demon imp. Bright red skin, black horns, bat wings on the back, glowing yellow slit eyes, wide toothy grin, thin tail, black claws. No weapon (throws fireballs).` | head, torso, pelvis, arm, leg |
| `imp` | `Character: CLEANUP IMP, a tired green goblin janitor. Green skin, huge pointy ears, blue janitor cap, big grin, yellow eyes, grey-blue overalls with a pocket, big bare feet. Weapon: a mop with a grey mop head and a few red stains.` | head, torso, pelvis, arm, leg, weapon |
| `gorthak` | `Character: GORTHAK THE UNDEFEATED, an arena champion with an absurdly muscular tan body and a huge black great helm with a T-shaped visor, two glowing red eyes and giant bone horns. Bare scarred chest crossed by two black leather straps with a bone skull emblem, a black spiked pauldron on the back shoulder, gigantic arms with black spiked bracers, a tiny black armoured loincloth with red trim, short legs in dark iron greaves. Weapon: a giant double-bladed battle axe with dried blood on the blades.` | head, torso, pelvis, arm, leg, weapon |
| `hogmother` | `Character: BIG MAMA HOGMOTHER, a gigantic pig-orc mother boss. Olive green skin, pink snout, tusks, pink hair curlers, gold earring, lipstick, big belly with a white blood-stained butcher apron, dirty loincloth. Weapon: a huge butcher's cleaver with blood stains.` | head, torso, weapon (bruker hogman sine armer, bein og hofte) |
| `croakus` | `Character: KING CROAKUS, an enormous fat frog king. Green spotted skin, huge pale belly, sleepy heavy-lidded bulging eyes, small gold crown with red gems, red royal cape with white fur trim, purple royal loincloth with a gold belt. Weapon: a gold sceptre with a purple orb.` | head, torso, pelvis, leg, weapon (bruker frogman sin arm) |
| `magmor` | `Character: MAGMOR THE MOLTEN, a lava golem boss made of black and dark grey rock chunks with glowing orange lava cracks, small blocky head with glowing yellow eyes and a lava mouth, flames on top of the head, huge rock fists. No weapon.` | head, torso, pelvis, arm, leg |
| `vorthax` | `Character: VORTHAX THE MODERATELY EVIL, an old sorcerer villain. Purple robes with gold trim and dots, tall purple pointy hat with a small skull, long white beard, glowing red eyes, pale wrinkled skin, wide sleeves. Weapon: a crooked wooden staff with a glowing cyan orb.` | head, torso, pelvis, arm, leg, weapon |

Heltebyggerens deler (hode med hårfrisyrer, hjelmer, skjegg og så videre) tegnes fortsatt i kode. Se "Planlagt" nederst.

### Proporsjoner for heltene (thrugg, valkyra og Hero Forge)

Heltene har heroiske proporsjoner som på et fantasy-omslag fra 80-tallet: lange bein, brede skuldre og et hode som er litt for lite. Når du lager PNG-er for `thrugg` eller `valkyra`, bruker spillet disse høydene automatisk (i spillenheter, regnet ut fra `src/gfx/chars/types.ts`): hode 0.84, overkropp 1.08, hofte 0.35, arm 0.98, bein 1.06. Overkroppen skal ha en tykk nakke og brede skuldre øverst, og armen skal ha en stor rund skulder, en diger biceps og en knyttneve nederst.

---

## Bakgrunner

| Fil | Bruk | Prompt |
|---|---|---|
| `sky_grass.png` | Himmel, brett 1 | `Wide panoramic sky background, 3072x1024, seamless left-right. Warm late-afternoon sunset over rolling hills: orange-gold gradient, big fluffy cream clouds with dark outlines, a pale sun low on the horizon, distant purple mountains with snowy tips at the very bottom. Same cartoon style, no characters, no text.` |
| `sky_swamp.png` | Himmel, sumpen | `Wide panoramic sky background, 3072x1024, seamless left-right. Murky green-grey overcast swamp sky, low heavy clouds, faint mist bands, silhouettes of dead twisted trees and low hills at the bottom. No characters, no text.` |
| `sky_frost.png` | Himmel, frost | `Wide panoramic sky background, 3072x1024, seamless left-right. Cold clear winter sky, pale blue to white gradient, jagged snowy mountain range at the bottom, light snowfall, a pale sun. No characters, no text.` |
| `sky_scorch.png` | Himmel, vulkan | `Wide panoramic sky background, 3072x1024, seamless left-right. Hellish volcanic sky, black at the top fading to deep red and orange, ash clouds, a distant erupting volcano with lava, ember sparks. No characters, no text.` |
| `sky_arena-pit.png` | Himmel over arenaen | `Wide panoramic night sky, 3072x1024, seamless left-right. Dark crimson night with thin clouds and a few stars, like the sky above a gladiator pit. No characters, no text.` |
| `map.png` | Verdenskartet | `Top-down fantasy world map of an island, 1536x1024, painted in the same cartoon style with thick outlines. West: green grassland with a small castle keep. South-centre: murky swamp with dead trees and a pond. North: snowy mountains and pine forest. East: black volcanic wasteland with a lava river and a volcano. Far east: a dark purple tower on a cliff. A blue river runs from the mountains to the swamp. Sea around the island. NO text, NO labels, NO roads (the game draws them).` |

Kartbildet må ha samme utsnitt som det innebygde kartet: øya fyller bildet, hjemborgen til venstre (vest), tårnet helt til høyre (øst), frost i nord (oppe), sump i sør (nede).

---

## Manifest

Eksempel (`public/assets/manifest.json`):

```json
{
  "parts": [
    { "char": "thrugg", "part": "head", "file": "thrugg_head.png" },
    { "char": "thrugg", "part": "torso", "file": "thrugg_torso.png" },
    { "char": "thrugg", "part": "pelvis", "file": "thrugg_pelvis.png" },
    { "char": "thrugg", "part": "arm", "file": "thrugg_arm.png" },
    { "char": "thrugg", "part": "leg", "file": "thrugg_leg.png" },
    { "char": "thrugg", "part": "weapon", "file": "thrugg_weapon.png", "anchor": [0.5, 0.8] }
  ],
  "sky": { "grass": "sky_grass.png", "swamp": "sky_swamp.png" },
  "map": "map.png"
}
```

- `height` er delens høyde i spillenheter. Standard: hode 1.0, overkropp 0.9, hofte 0.6, arm 0.78, bein 0.92, våpen 1.7. For heltene (`thrugg`, `valkyra`): hode 1.3, overkropp 0.95, hofte 0.35, arm 0.8, bein 0.66. For ridedyr: kropp 1.3, hode 0.9, hale 0.6, bein 0.75. Store figurer skaleres av spillet selv, så bruk standardverdiene.
- `anchor` er leddpunktet i det beskårne bildet, `[x, y]` fra 0 til 1 der `y` måles fra toppen. Standard: hode `[0.5, 0.95]`, overkropp `[0.5, 0.96]`, hofte `[0.5, 0.12]`, arm `[0.5, 0.06]`, bein `[0.4, 0.04]`, våpen `[0.5, 0.82]`.

---

## Ridedyr

Ridedyrene er satt sammen av fire deler: `body` (kropp med sal), `head`, `tail` og `leg` (samme bein brukes fire ganger, eller to for kakatrissen). Alt tegnes **sett fra siden, vendt mot høyre**, uten rytter. Filnavn: `<id>_body.png`, `<id>_head.png`, `<id>_tail.png`, `<id>_leg.png`. I manifestet: `{ "char": "warhog", "part": "body", "file": "warhog_body.png" }`.

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
Asset: TAIL of the mount described above. Only the tail, pointing LEFT (backwards). The base of the tail is at the RIGHT edge. Canvas 1536x768, transparent background.
```
```
Asset: LEG of the mount described above. Only one leg hanging STRAIGHT DOWN, hip joint at the top centre, hoof/claws at the bottom pointing RIGHT. Canvas 768x1024, transparent background.
```

---

## Kjæledyr

Én sprite per kjæledyr, vendt mot høyre, 1024x1024, transparent. Filnavn `pet_<id>.png`, i manifestet: `{ "char": "pet_rat", "part": "body", "file": "pet_rat.png" }`.

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

Disse kan lages nå, så er de klare når koden støtter dem.

| Pakke | Filer | Merknad |
|---|---|---|
| Heltebygger | `hero_face_<m/f>.png`, `hero_hair_<stil>.png`, `hero_helmet_<type>.png`, `hero_beard_<type>.png`, `hero_torso_<type>_<m/f>.png`, `hero_pelvis_<type>.png`, `hero_legs_<type>.png`, `hero_weapon_<type>.png` | Lag på HEAD-, TORSO-, PELVIS-, LEG- og WEAPON-templatet. Hår, hjelm og skjegg lages som egne lag på samme lerret (1024x1024) så de kan legges oppå et ansikt. Farger: tegn hår og tøy i nøytral grå så spillet kan farge dem. |
| Rekvisitter | `prop_tree_dead.png`, `prop_pine_snow.png`, `prop_rock.png`, `prop_skull_pike.png`, `prop_tent.png`, `prop_banner.png`, `prop_barrel.png`, `prop_campfire.png`, `prop_crystal.png`, `prop_mushrooms.png` | Frittstående, sett fra siden, transparent bakgrunn. |
| Pickups og ikoner | `icon_potion.png`, `icon_chicken.png`, `icon_ham.png`, `icon_coin.png`, `proj_dagger.png`, `proj_fireball.png`, `proj_snowball.png`, `proj_poison.png` | 512x512, transparent. |
| Tittel og kort | `title.png` (logo-illustrasjon), `boss_<id>.png` (VS-kort 1536x1024 per sjef) | Til tittelskjerm og sjef-intro. |
| Gore | `gib_meat_1..3.png`, `gib_bone.png`, `gib_eye.png`, `splat_1..3.png` | Tegneserieaktig, ikke realistisk. 256x256. |
| Farer | `hazard_spikes.png`, `hazard_bog.png`, `hazard_icehole.png`, `hazard_lava.png`, `hazard_spiketrap.png` | Sett rett ovenfra, 1024x512, transparent kant. Tegnes i dag i 3D av koden. |
| FAMILY-modus | `gib_duck.png`, `gib_flower.png`, `gib_star.png` | Gummiand, blomst og stjerne som erstatter gibs når gore står på FAMILY. 256x256. |
