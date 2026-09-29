# LOINCLOTH LEGENDS

*Blood, Biceps & Bad Decisions*

Et spill fra **Tom's Happy Happy Funtimes Emporium**.

2.5D fantasy-brawler i nettleseren. Castle Crashers og Golden Axe møter Barbarian: sidescroller-brett med horder av fiender, ridedyr og farer, og mellom brettene en brutal 1v1 duell der ett riktig hugg tar hodet av motstanderen. 80-talls klisjeer, humor og altfor mye blod.

Laget med Three.js og TypeScript. All grafikk tegnes prosedyremessig på canvas og all lyd syntetiseres, så prosjektet trenger ingen asset-filer (bortsett fra studiologoen). PNG-grafikk fra ChatGPT kan byttes inn del for del.

Repo: https://github.com/Tombonator3000/Loincloth-Legends

## Kom i gang

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
- **Grafikk**: HDR-bilde med bloom, dybdeskarphet og fargegradering per brett, myke skygger, 3D-trær og gress i vinden, GPU-partikler, lyn og eksplosjoner, blod som lander og tørker inn, 3D-gibs, figurer som tar lys fra fakler og lyn, og mørke silhuetter i forgrunnen. Fem grafikknivåer (AUTO til ULTRA).
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
- `tools/tests/README.md` Playwright-tester
- `AGENTS.md` og `CLAUDE.md` regler for AI-agenter
- `memory.md`, `todo.md`, `log.md` hukommelse, plan og historikk

## Lisens og rettigheter

Studiologoen (`art/studio/`, `src/assets/studio-logo.webp`) tilhører Tom's Happy Happy Funtimes Emporium.
