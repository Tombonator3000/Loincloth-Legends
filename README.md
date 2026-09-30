# LOINCLOTH LEGENDS

*Blood, Biceps & Bad Decisions*

Et spill fra **Tom's Happy Happy Funtimes Emporium**.

2.5D fantasy-brawler i nettleseren. Castle Crashers og Golden Axe møter Barbarian: sidescroller-brett med horder av fiender, ridedyr og farer, og mellom brettene en brutal 1v1 duell der ett riktig hugg tar hodet av motstanderen. 80-talls klisjeer, humor og altfor mye blod.

Laget med Three.js og TypeScript. Kunstpakken har 200 bilder: malte figurdeler i nesten ekte karikaturstil, separate utseendelag og teksturer til 3D-verdenen. Kodegrafikk er reserve når bilder mangler. Lyden er syntetisert med CC0-opptak lagt oppå der de finnes. Se `docs/ART_PROMPTS.md` for produksjon og filnavn.

Repo: https://github.com/Tombonator3000/Loincloth-Legends

## Spill det

- **I nettleseren, uten å installere noe**: https://tombonator3000.github.io/Loincloth-Legends/ (når GitHub Pages er slått på i repoet: Settings > Pages > Source > GitHub Actions. Hver push til main publiserer da en ny versjon.)
- **Fra repoet på egen maskin** (trenger Node.js 20.19 eller nyere, eller 22.12 eller nyere):

```bash
git clone https://github.com/Tombonator3000/Loincloth-Legends
cd Loincloth-Legends
npm install
npm run dev          # åpne http://localhost:5173
```

- **Som én fil**: `npm run build:single` lager `dist-single/index.html`, som kan åpnes med dobbeltklikk og deles som en vanlig fil.

Styring: se "Kontroller" lenger ned. `?nosplash` i adressen hopper over studiologoen.

## Kom i gang (utvikling)

```bash
npm install
npm run dev          # utviklingsserver på http://localhost:5173
npm run build        # vanlig bygg til dist/
npm run build:single # én selvstendig HTML-fil i dist-single/
npm run typecheck
```

Brettverkstedet STAGE FORGE: `npm run dev` og http://localhost:5173/?editor=road (eller STAGE FORGE på tittelskjermen). Se `docs/STAGE_FORGE.md`.

`dist-single/index.html` kan åpnes direkte i nettleseren (dobbeltklikk), uten server. `?nosplash` i adressen hopper over studiologoen.

## Hva er med

- **Oppstartslogo** for Tom's Happy Happy Funtimes Emporium: trommevirvel, sirkusfanfare, solstråler og konfetti.
- **Hero Forge**: 60 malte delvalg for hode, kropp, armer, bein, lendeklede og våpen. To redigerbare grunnhoder har separate hår-, skjegg-, hodeplagg- og øyelag, med egne hud-, hår-/skjegg- og øyefarger. De gamle hodene beholder sine innmalte detaljer; velg CUSTOM HEAD for å redigere lagene. Klassisk bygger og begge spilleres lagringer beholdes. Heroiske 80-talls kropper med altfor store muskler, ringbrynjebikini, røde støvler og bittesmå lendeklær.
- **Grafikk**: HDR-bilde med bloom, SSAO, dybdeskarphet og fargegradering per brett, fysisk himmel med miljølys, eksponentiell tåke, støyteksturer med normalkart, 3D-steiner og hodeskaller, myke skygger, 3D-trær og gress i vinden, GPU-partikler, lyn og eksplosjoner, blod som lander og tørker inn, 3D-gibs, figurer som tar lys fra fakler og lyn, og mørke silhuetter i forgrunnen. Fem grafikknivåer (AUTO til ULTRA).
- **Heavy metal**: 80-talls metal syntetisert i nettleseren (vrengte gitarer, dobbel stortromme, tvillinggitarer og solo), én låt per brett. En dirigent bytter låt på taktstreken og trapper bandet opp når fiendene kommer. De gamle 8-bit-låtene kan velges i innstillingene.
- **Musikk**: 80-talls heavy metal spilt av ekte trommer, gitar og bass (opptak, CC0) gjennom forsterkere i WebAudio, med synth som reserve.
- **Lyd**: ekte opptak av slag, knas, sprut, torden, sverdklang, publikum, krigshorn, trollbrøl, ulv og fossesus (CC0) oppå synthen, fottrinn etter underlaget, stemning per brett og fanfarer for drapsrekker. Replikkene kan leses inn med stemmer laget i VoiceStudio (manus i docs/STEMMER.md).
- **Skjerm**: blod og vann som treffer glasset og renner, sjokkbølger, kameradykk, årer ved lav helse, varmeflimmer og automatisk grafikkvalitet.
- **METAL MODE**: drap og lemlestelse fyller en måler. Full måler gir gitarsolo, brennende våpen, hardere slag og lyn som slår ned i fiendene.
- **Verdenskart** i 3D med fem biomer, stier, låste noder og fremgang som lagres.
- **Fem brett** med egne fiender, farer (pigger, myr, råk, lava, piggfeller) og fiender som kommer ridende. Finale per brett: fire sjefer og én duell til døden.
- **Frostpasset i blåtimen**: klippevegger med snø, fossefall, taubro, ruiner, juv langs veien, fyrfat med ild, fillete krigsbannere med hornet hodeskalle, runesteiner som gløder, istapper og tett snøfall. Midtveis kommer Avalanche Troll, en kjempe over dobbelt så høy som heltene, som rister bakken, griper heltene og kaster dem, og får kameraet til å trekke seg bakover.
- **Nattleir** som i Golden Axe: heltene sover ved bålet mens tyvnisser napper krukkene deres.
- **Magi** i tre varianter (meteorregn, forfedrenes skrik og tordenguden), sterkere jo flere krukker. Sjonglering i lufta og B-film-replikker.
- **Grep og kast**: ta tak i fiender, kne dem, kast dem i andre fiender (bowling), rett i lava, eller opp over taugjerdet og ned i juvet i frostpasset (hold opp og kast).
- **Omgivelser som slåss med**: istapper som løsner og faller (lokk fiendene under), fyrfat som kan veltes så glørne setter fyr på fiendene, og fiender som får panikk og løper skrikende vekk når det blir for grufullt.
- **Ridedyr**: War Hog (stormløp), Cluckatrice (halesvip) og Magma Newt (ildpust). Slå av rytteren og sitt opp selv.
- **Teit vold**: impen sparker avkappede hoder rett i skjermen, der de klasker og sklir sakte ned med en hvinende lyd. Armer ryker av og spretter vekk ("IT'S JUST A FLESH WOUND!"), og hodeløse fiender løper rundt en stund.
- **Nivåer og butikk**: XP, STR/DEF/MAG/AGI, ekstra liv, potions og deler i YE OLDE SHOPPE.
- **Kjæledyr**: Eyeball of Greed, Rabid Rat, Sarcastic Skull, Battle Chicken og Tiny Dragon.
- **Arena-dueller** i Barbarian-stil: retning + angrep, blokk høy/lav, halshugging, tag team med to spillere.
- **Gore-innstilling**: FAMILY (konfetti og gummiender), NORMAL, EXCESSIVE, PLEASE SEEK HELP.
- **STAGE FORGE**: visuell brettredigerer i spillet. Malte kulisser i fire lag, fra fjellene langt bak til trestammer rett foran kameraet som tones ut når noen står bak. Vind, svingende skilt, flakkende lys, bildeserier og bevegelse i spor. Rader, generert pynt som kan slås av, bølger, tønner og farer på en tidslinje, angre, og PLAY FROM HERE. Lagrer brettfilene rett i repoet under `npm run dev`.
- **2 spillere lokalt**, tastatur, gamepad (med rumble) og **berøringskontroller** på mobil og nettbrett.

## Kontroller

| | Spiller 1 | Spiller 2 | Gamepad |
|---|---|---|---|
| Beveg | WASD | Piltaster | Stikke / D-pad |
| Angrep | F (eller J, eller venstre museknapp) | , (eller Numpad 1) | X / RT |
| Hopp | G (eller K) | . (eller Numpad 2) | A |
| Spesial / blokk | H (eller L) | / eller - (eller Numpad 3) | B / LB / LT |
| Pause | P / Esc | | Start |

Tre knapper. Gå inn i en fiende for å gripe ham, og inn i et ledig ridedyr for å sitte opp (ned + hopp hopper av). M = lyd av/på. Hold opp eller ned mens du kaster en fiende for å kaste ham bakover eller forover (over taugjerdet og ned i juvet i frostpasset). I 1-spiller kan du også bruke piltaster + Z/X/C. Med én gamepad i 2-spiller er gamepaden spiller 2. På mobil: stikke til venstre, knapper til høyre.

## Dokumentasjon

- `docs/GDD.md` design, kart, biomer, sjefer, dueller, heltebygger, ridedyr, kjæledyr, butikk og forslag
- `docs/ARCHITECTURE.md` hvordan koden henger sammen, og oppskrifter for nytt innhold
- `docs/ART_PROMPTS.md` grafikkliste med ferdige prompter til ChatGPT
- `docs/HERO_FORGE_GRAFIKK.md` filkart, egne utseendelag, hudmasker og kalibrering for heltesmia
- `docs/CHATGPT_PROMPT.md` startprompt som lar ChatGPT styre hele grafikkjobben (sjekkliste, filnavn, kommandoer)
- `docs/STAGE_FORGE.md` brettverkstedet: slik lager og endrer du brett, kulisser og animasjoner
- `docs/SKILLS.md` skills for AI-agentene (i `.claude/skills/`) og andre skills som passer
- `docs/PLAN_BRETT_GORR_AI.md` plan for brettverkstedet (STAGE FORGE), gørr, bedre AI og teksturer på brettene, med bestilling til GPT
- `tools/tests/README.md` Playwright-tester
- `AGENTS.md` og `CLAUDE.md` regler for AI-agenter
- `memory.md`, `todo.md`, `log.md` hukommelse, plan og historikk

## Gjenbruk og takk

Loincloth Legends bygger på kode og ideer fra Toms egne spill og fra åpne kilder.

**Toms egne prosjekter**
- Morbidium (Tombonator3000/morbidium): bildeverktøyene for ChatGPT-grafikk (maler, klipping, bakgrunn, sømmer og innboks i `tools/process_art.py` og `tools/make_templates.py`, og rutene i bildeserier fra `ark_ruter` og `behandle_ark` i `tools/behandle_bilder.py`) og variasjonen i fiendene (`src/game/foes.ts`). Bildeseriene og sporene med nøkler over tid på kulissene (`src/gfx/scenery.ts`) er skrevet om etter `src/16_anim.js` og POSER.
- The Deep Ones (Tombonator3000/the-deep-ones, `v2/editor.js`): flyten i brettverkstedet (velge og flytte, skala og høyde, lagre, testspill, JSON inn og ut med kontroll). STAGE FORGE er skrevet på nytt i 3D. Angre og gjør om med øyeblikksbilder følger mønsteret i `useUndoRedo.ts` i connect-play.
- De nye utseendelagene i Hero Forge bruker Morbidium som konseptuelt forbilde: egne lerreter per fargevariant og normaliserte valg i [14_pasient.js](https://github.com/Tombonator3000/Morbidium/blob/main/src/14_pasient.js), lagplassering i [28_oppskrift.js](https://github.com/Tombonator3000/Morbidium/blob/main/src/28_oppskrift.js) og lag som følger hodet i [11_doll.js](https://github.com/Tombonator3000/Morbidium/blob/main/src/11_doll.js). Ingen kode eller kunst fra disse filene er kopiert til denne utvidelsen. Implementasjonen bruker Loincloth Legends sin eksisterende cutout-rigg og egne håndmålte hudmasker, slik at brunt lær og metall beskyttes under hudomfarging.
- Musikksystemet (bytte på taktstreken med bro, intensitetslag, dukking og innslag i takt, `src/core/conductor.ts`), lydbanken (`src/core/soundbank.ts`), stemningen (`src/core/ambience.ts`) og fanfarene (`src/core/layers.ts`) er tilpasset fra Morbidium. Lagspilleren for syntlyd og zap-lyden bygger på Geometry 3044, og den brune støyen på The Deep Ones.
- Skjermdråpene (`src/gfx/screenwet.ts`), sjokkbølgene, varmeflimmeret, årene ved lav helse og den brennende kanten (`src/gfx/screenfx.ts`), lyspoolen og den automatiske grafikkvaliteten (`src/app/perf.ts`) er tilpasset fra Morbidium. Målingen av bildetid bygger på The Deep Ones.

**Kode og teknikker fra andre**
- Gresset og vinden (`src/gfx/env/meadow.ts`, `src/gfx/wind.ts`) er tilpasset fra stylized-meadow-grass i Threejs-Awesome-Graphics-Agent-Skills av Scott Sun (MIT), som bygger på stylized-scene av Andre Elias (MIT). Pakken var også oppskrift for etterbehandling, sol og skygger, partikler og trær.
- three.js (MIT): motoren, Sky-tillegget og tonekurvene i `src/gfx/post.ts`.
- Hash etter Dave Hoskins, «Hash without Sine» (MIT).
- Ben Golus (whiteout-blanding i `src/gfx/env/surface.ts`), Felzenszwalb og Huttenlocher (avstandsfeltet i `src/gfx/charlight.ts`) og mulberry32 (fri).
- Musikksystemet er inspirert av iMUSE (LucasArts, Michael Land og Peter McConnell). Ingen kode eller musikk er hentet derfra. Tidsstyringen følger Chris Wilsons «A Tale of Two Clocks».
- Lydopptak fra Freesound, alle CC0 1.0. Tittel, innspiller og lenke for hver fil står i `public/assets/sound/KILDER.md`.
- Slagverk fra Versilian Community Sample Library (VCSL) av Versilian Studios, CC0 1.0.
- Instrumentene i metal-musikken fra Karoryfer Lecolds (github.com/sfzinstruments), CC0 1.0: Big Rusty Drums (trommene), Emilyguitar (el-gitaren, en Epiphone med humbuckere, spilt og mappet av D. Smolken) og Growlybass (bassen, en Squier Jazz Bass). Hver fil står i `public/assets/sound/KILDER.md`.
- Skrifttyper fra Google Fonts: Metal Mania, Press Start 2P og VT323 (SIL Open Font License 1.1).

Lisenstekstene ligger i `public/LICENSES/` og i `THIRD_PARTY_LICENSES.md` i bygget. Hele gjennomgangen av opphav og lisenser står i `docs/GJENBRUK.md`.

## Lisens og rettigheter

Studiologoen (`art/studio/`, `src/assets/studio-logo.webp`) tilhører Tom's Happy Happy Funtimes Emporium.
