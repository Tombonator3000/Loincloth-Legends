# LOINCLOTH LEGENDS

*Blood, Biceps & Bad Decisions*

Et spill fra **Tom's Happy Happy Funtimes Emporium**.

2.5D fantasy-brawler i nettleseren. Castle Crashers og Golden Axe møter Barbarian: sidescroller-brett med horder av fiender, ridedyr og farer, og mellom brettene en brutal 1v1 duell der ett riktig hugg tar hodet av motstanderen. 80-talls klisjeer, humor og altfor mye blod.

Laget med Three.js og TypeScript. All grafikk lages i kode, og lyden er syntetisert med CC0-opptak lagt oppå der de finnes, så spillet virker uten andre filer enn studiologoen. PNG-grafikk fra ChatGPT kan byttes inn del for del (figurer i nesten ekte karikaturstil og teksturer til 3D-verdenen, se `docs/ART_PROMPTS.md`).

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

`dist-single/index.html` kan åpnes direkte i nettleseren (dobbeltklikk), uten server. `?nosplash` i adressen hopper over studiologoen.

## Hva er med

- **Oppstartslogo** for Tom's Happy Happy Funtimes Emporium: trommevirvel, sirkusfanfare, solstråler og konfetti.
- **Hero Forge**: lag din egen helt (mann eller dame) fra deler. Heroiske 80-talls kropper med altfor store muskler, ringbrynjebikini, røde støvler og bittesmå lendeklær.
- **Grafikk**: HDR-bilde med bloom, SSAO, dybdeskarphet og fargegradering per brett, fysisk himmel med miljølys, eksponentiell tåke, støyteksturer med normalkart, 3D-steiner og hodeskaller, myke skygger, 3D-trær og gress i vinden, GPU-partikler, lyn og eksplosjoner, blod som lander og tørker inn, 3D-gibs, figurer som tar lys fra fakler og lyn, og mørke silhuetter i forgrunnen. Fem grafikknivåer (AUTO til ULTRA).
- **Heavy metal**: 80-talls metal syntetisert i nettleseren (vrengte gitarer, dobbel stortromme, tvillinggitarer og solo), én låt per brett. De gamle 8-bit-låtene kan velges i innstillingene.
- **METAL MODE**: drap og lemlestelse fyller en måler. Full måler gir gitarsolo, brennende våpen, hardere slag og lyn som slår ned i fiendene.
- **Verdenskart** i 3D med fem biomer, stier, låste noder og fremgang som lagres.
- **Fem brett** med egne fiender, farer (pigger, myr, råk, lava, piggfeller) og fiender som kommer ridende. Finale per brett: fire sjefer og én duell til døden.
- **Nattleir** som i Golden Axe: heltene sover ved bålet mens tyvnisser napper krukkene deres.
- **Magi** i tre varianter (meteorregn, forfedrenes skrik og tordenguden), sterkere jo flere krukker. Sjonglering i lufta og B-film-replikker.
- **Grep og kast**: ta tak i fiender, kne dem, kast dem i andre fiender (bowling) eller rett i lava.
- **Ridedyr**: War Hog (stormløp), Cluckatrice (halesvip) og Magma Newt (ildpust). Slå av rytteren og sitt opp selv.
- **Teit vold**: impen sparker avkappede hoder rett i skjermen, der de klasker og sklir sakte ned med en hvinende lyd. Armer ryker av og spretter vekk ("IT'S JUST A FLESH WOUND!"), og hodeløse fiender løper rundt en stund.
- **Nivåer og butikk**: XP, STR/DEF/MAG/AGI, ekstra liv, potions og deler i YE OLDE SHOPPE.
- **Kjæledyr**: Eyeball of Greed, Rabid Rat, Sarcastic Skull, Battle Chicken og Tiny Dragon.
- **Arena-dueller** i Barbarian-stil: retning + angrep, blokk høy/lav, halshugging, tag team med to spillere.
- **Gore-innstilling**: FAMILY (konfetti og gummiender), NORMAL, EXCESSIVE, PLEASE SEEK HELP.
- **2 spillere lokalt**, tastatur, gamepad (med rumble) og **berøringskontroller** på mobil og nettbrett.

## Kontroller

| | Spiller 1 | Spiller 2 | Gamepad |
|---|---|---|---|
| Beveg | WASD | Piltaster | Stikke / D-pad |
| Angrep | F (eller J) | , (eller Numpad 1) | X / RT |
| Hopp | G (eller K) | . (eller Numpad 2) | A |
| Spesial / blokk | H (eller L) | - (eller Numpad 3) | B / LB / LT |
| Grip / kast / ri | R (eller U) | Høyre Shift (eller Numpad 0) | Y / RB |
| Pause | P / Esc | | Start |

M = lyd av/på. I 1-spiller kan du også bruke piltaster + Z/X/C/V. Med én gamepad i 2-spiller er gamepaden spiller 2. På mobil: stikke til venstre, knapper til høyre.

## Dokumentasjon

- `docs/GDD.md` design, kart, biomer, sjefer, dueller, heltebygger, ridedyr, kjæledyr, butikk og forslag
- `docs/ARCHITECTURE.md` hvordan koden henger sammen, og oppskrifter for nytt innhold
- `docs/ART_PROMPTS.md` grafikkliste med ferdige prompter til ChatGPT
- `docs/CHATGPT_PROMPT.md` startprompt som lar ChatGPT styre hele grafikkjobben (sjekkliste, filnavn, kommandoer)
- `tools/tests/README.md` Playwright-tester
- `AGENTS.md` og `CLAUDE.md` regler for AI-agenter
- `memory.md`, `todo.md`, `log.md` hukommelse, plan og historikk

## Gjenbruk og takk

Loincloth Legends bygger på kode og ideer fra Toms egne spill og fra åpne kilder.

**Toms egne prosjekter**
- Morbidium (Tombonator3000/morbidium): bildeverktøyene for ChatGPT-grafikk (maler, klipping, bakgrunn, sømmer og innboks i `tools/process_art.py` og `tools/make_templates.py`) og variasjonen i fiendene (`src/game/foes.ts`).

**Kode og teknikker fra andre**
- Gresset og vinden (`src/gfx/env/meadow.ts`, `src/gfx/wind.ts`) er tilpasset fra stylized-meadow-grass i Threejs-Awesome-Graphics-Agent-Skills av Scott Sun (MIT), som bygger på stylized-scene av Andre Elias (MIT). Pakken var også oppskrift for etterbehandling, sol og skygger, partikler og trær.
- three.js (MIT): motoren, Sky-tillegget og tonekurvene i `src/gfx/post.ts`.
- Hash etter Dave Hoskins, «Hash without Sine» (MIT).
- Ben Golus (whiteout-blanding i `src/gfx/env/surface.ts`), Felzenszwalb og Huttenlocher (avstandsfeltet i `src/gfx/charlight.ts`) og mulberry32 (fri).
- Skrifttyper fra Google Fonts: Metal Mania, Press Start 2P og VT323 (SIL Open Font License 1.1).

Lisenstekstene ligger i `public/LICENSES/` og i `THIRD_PARTY_LICENSES.md` i bygget. Hele gjennomgangen av opphav og lisenser står i `docs/GJENBRUK.md`.

## Lisens og rettigheter

Studiologoen (`art/studio/`, `src/assets/studio-logo.webp`) tilhører Tom's Happy Happy Funtimes Emporium.
