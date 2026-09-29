# Arkitektur

Kort guide til hvordan koden henger sammen, og oppskrifter for å utvide spillet. Målet er at nytt innhold (fiender, sjefer, biomer, brett, dueller, ridedyr, kjæledyr, farer, butikkvarer) stort sett bare krever data, ikke ny motorkode.

## Lag

```
main.ts            Oppstart: laster valgfri PNG-grafikk, starter Game, installerer testkroken (app/debug.ts)
app/               Spillflyt
  game.ts          Renderer, løkke, scenebytte, historieflyt (tittel, kart, brett, dueller, belønninger, XP), innstillinger
  camp.ts          Hjemborgen: Hero Forge, butikk (YE OLDE SHOPPE) og trening (nivåer, stats, kjæledyr)
  scene.ts         Scene-grensesnitt
  save.ts          Lagring i localStorage (helter, fremgang, opplåsinger, nivåer, kjæledyr, forbruksvarer)
  debug.ts         window.__lib for Playwright-testene
  scenes/          creator.ts (Hero Forge), map.ts (verdenskart)
data/              Alt innhold som data (ingen Three.js her)
  enemies.ts       FOES: fiendetyper og oppførsel
  bosses.ts        BOSSES: sjefer satt sammen av trekk
  duelists.ts      DUELISTS: motstandere i 1v1
  levels.ts        LEVELS: brett, bølger, tønner, farer, ryttere, finale (sjef eller duell)
  hazards.ts       HAZARDS: piggrop, myr, råk, lava, piggfelle
  mounts.ts        MOUNTS: ridedyr (fart, angrep, replikker)
  pets.ts          PETS: kjæledyr og fornærmelsene til hodeskallen
  progress.ts      Nivåkurve, STR/DEF/MAG/AGI-effekter, XP-regler og SHOP (butikkvarer)
  worldmap.ts      MAP_NODES og MAP_EDGES
  weapons.ts       WEAPONS og scaleAttack
  unlocks.ts       PART_LOCKS: deler i heltebyggeren som låses opp
game/              Spillogikk
  fighter.ts       Felles kjemper: fysikk, tilstander (også hold/held/ride), animasjon, død, armer som ryker, hodeløs løping
  attacks.ts       Poser og angrepsdefinisjoner (AttackDef)
  combat.ts        Treffsjekk, blokk, skade, sjanse for at armen ryker, rumble
  hero.ts          Spillerstyrt helt på brettene (også grep og riding)
  grab.ts          Grep, kne, kast og bowling
  hazards.ts       Farer: miljødrap, skade på helter, piggfellens syklus
  mounts.ts        Ridedyr: rytter, stormløp, halesvip, ildpust, fiende-ryttere
  pets.ts          Kjæledyr: følger helten og bruker evner
  foes.ts          Fiende-AI (melee, brute, ranged, runner, jumper, shambler)
  boss.ts          Sjef-AI (trekk: melee, charge, slam, leap, shoot, summon, teleport, tongue, rain)
  projectiles.ts   Prosjektiler og områdeskade
  stage.ts         Generisk brett bygget fra en LevelDef
  duel.ts          1v1 duell i Barbarian-stil, tag team, oppryddings-imp som sparker hodet i skjermen
  items.ts         Pickups (også egg) og tønner
  world.ts         Delte referanser (scene, gore, fx, kamera, statistikk, rumble)
gfx/               Grafikk
  chars/           Figurer: types, muscle (overdrevne kropper), classic, wilds, bosses, hero (heltebygger), beasts (ridedyr), index (register)
  env/             Miljø: common, grass, swamp, frost, scorch, tower, arena, worldmap, sprites, hazards, index (register)
                   sun (sol med skygger), grades (gradering per biom), trees (3D-trær), meadow (gress), leaffall (blader),
                   atmos (tåkelag og lyssøyler)
  post.ts          Bildepipeline: HDR, bloom, dybdeskarphet, eksponering, tonemapping, gradering, linseeffekter, grafikknivå
  wind.ts          Felles vindfelt (uniformer, GLSL, windifyTree) som trær, gress og blader deler
  rig.ts           Cutout-rigg for mennesker (hver kroppsdel er et plan med pivot i leddet), restore og setTint
  beast.ts         Rigg for ridedyr (kropp, hode, hale, 2 eller 4 bein)
  pets.ts          Sprites for kjæledyr
  gore.ts          Blod, gibs, flekker, fontener. Gore-nivå (FAMILY gir konfetti og gummiender). Sender gnister, ild og røyk til vfx
  vfx.ts           GPU-partikler (gnister, flammer, glør, røyk, snø), lyn, eksplosjoner og lyspool (punktlys til nærmeste kilder)
  fx.ts            Risting, hitstop, slowmo, sverdspor, tekst, blod på skjermen, hodet som klasker i skjermen
  assets.ts        PNG-erstatninger fra public/assets/manifest.json
  draw.ts          Tegnehjelpere i enhetsrom
ui/                HUD og menyer (ren DOM)
  hud.ts           Spillerpaneler, duell-bars, sjef-bar, kunngjøringer
  screens.ts       Menyer og skjermer (også custom-paneler med justerbare valg)
  touch.ts         Berøringskontroller: flytende stikke, fire knapper, pause
  splash.ts        Oppstartslogo for Tom's Happy Happy Funtimes Emporium
core/              Input (tastatur, gamepad, berøring), lyd (WebAudio-synth), innstillinger, matte
assets/            Bilder som bygges inn i spillet (studio-logo.webp)
```

Avhengigheter går én vei: `app` bruker `game`, `gfx`, `data`, `ui`. `game` bruker `gfx` og `data`. `data` bruker bare typer. `core/settings.ts` kan brukes fra alle lag.

## Register

| Register | Fil | Nøkkel brukes av |
|---|---|---|
| `CHARS` | gfx/chars/index.ts | Fighter, rigg, HUD-portretter |
| `BEASTS` | gfx/chars/beasts.ts | MountDef.beast |
| `STAGE_BUILDERS` | gfx/env/index.ts | LevelDef.biome |
| `FOES` | data/enemies.ts | Bølger og ryttere i LevelDef, sjefenes summon |
| `BOSSES` | data/bosses.ts | LevelDef.finale |
| `DUELISTS` | data/duelists.ts | LevelDef.finale, arena-noder, duell-menyen |
| `LEVELS` | data/levels.ts | Kartnoder |
| `HAZARDS` | data/hazards.ts | LevelDef.hazards |
| `MOUNTS` | data/mounts.ts | LevelDef.riders |
| `PETS` | data/pets.ts | Butikken, trening, HeroProgress.pet |
| `SHOP` | data/progress.ts | Butikken i hjemborgen |
| `MAP_NODES` / `MAP_EDGES` | data/worldmap.ts | Kartet |
| `WEAPONS` | data/weapons.ts | Heltebyggeren, helter, duellanter |
| `PART_LOCKS` | data/unlocks.ts | Heltebyggeren, belønninger på kartet, butikken |

## Proporsjoner

Heltene bygges av `gfx/chars/muscle.ts`: stort hode (`HEAD_SCALE`), korte bein (`HERO_HIP_Y`), brede skuldre og enorme armer (`HERO_BIG_J`). `scalePart()` skalerer en del rundt leddet uten at konturstreken blir tykkere. Thrugg og Valkyra i `classic.ts` er bygget med heltebyggeren, så presetene har samme proporsjoner.

## Bilde og grafikknivå

`gfx/post.ts` eier det endelige bildet. Scenen tegnes i lineær HDR med MSAA, så bloom, dybdeskarphet, eksponering, tonemapping (én gang), gradering og linseeffekter. LOW tegner rett til skjermen uten etterbehandling. Graderingen settes per miljø (`grade` på Env, fra `env/grades.ts`) eller per scene (kartet). `W.post` gir tilgang fra spillkoden (aberrasjon ved store treff, rød kant ved lite liv, lysglimt).

Kode som bygger innhold leser `gfxState.quality` eller `qualityRank()` (0 LOW til 3 ULTRA) for tetthet på gress, antall blader og størrelse på skyggekart. Miljøene bruker `lit()`/`toon()` (MeshStandardMaterial) og `applyShadows()`. Sola (`SunShadow`) følger kameraet.

Målbildet for grafikken står i `docs/STYLE_TARGET.md`.

### Nytt tre eller ny art
Legg en `Species` i `SPECIES` (`env/trees.ts`): lengde, radius, seksjoner, barn, vinkler, knudrethet og blader per nivå. Bruk den med `new Forest(art).add(x, z, skala)` og `forest.build()` i biomet.

## Innstillinger og gore-nivå

`core/settings.ts` lagrer gore-nivå, lydnivå, risting, rumble og berøringsmodus (`loincloth-legends-settings-v1`). `Game` lytter med `onSettings` og setter `Gore.level` og lydnivåene. Gore-nivået skalerer partikler, gibs, fontener og blod på skjermen. FAMILY bytter blod mot konfetti og gibs mot gummiender, blomster og stjerner.

## Input

`InputManager` slår sammen tastatur, gamepad og berøring til to `PlayerInput`. Knappene er `left right up down attack jump special grab start`. Gamepad følger standard mapping (A hopp, X angrep, B spesial, Y grip, Start pause). I 2-spiller med én gamepad styrer gamepaden spiller 2. Berøring (`ui/touch.ts`) styrer alltid spiller 1 og vises bare når det spilles (ikke i menyer). `W.rumble(player, sterk, svak, ms)` rister riktig gamepad.

## Oppskrifter

### Ny fiende
1. Tegn figuren i `gfx/chars/wilds.ts` (eller ny fil) som en `CharDef` med delene leg, arm, pelvis, torso, head og eventuelt weapon. Legg den i eksportlista.
2. Legg til en `FoeDef` i `data/enemies.ts` med `behavior`, `attack`, `range` og eventuelt `proj`.
3. Bruk id-en i bølgene i `data/levels.ts`.
Bare fargevariant? Bruk en eksisterende `char` og sett `tint` (se `frostskel`).

### Ny sjef
1. Lag figuren (eller gjenbruk en med `scale` og `tint`).
2. Legg til en `BossDef` i `data/bosses.ts`: velg trekk med vekt og nedkjøling, sett `enrage` og intro-replikker.
3. Sett `finale: { type: 'boss', boss: '<id>' }` på et brett.
Nytt trekk som ikke finnes: legg det til i `BossMoveKind` og i `exec()` i `game/boss.ts`.

### Nytt biom
1. Lag `gfx/env/<biom>.ts` med en `build<Biom>(scene, gore, opts)` som returnerer `Env`. Bruk `stageBase` og hjelperne i `common.ts`.
2. Registrer den i `STAGE_BUILDERS` i `gfx/env/index.ts`.
3. Bruk biom-id-en i en `LevelDef`.

### Nytt brett
Legg til en `LevelDef` i `data/levels.ts`. Bølger skrives kompakt: `w(at, maxAlive, 'skeleton:R:0.2 hogman:L:1.0', { title, say })`. Farer legges inn med `hz(kind, x, z, bredde, dybde)`, og ryttere med `[bølgeindeks, fiende, ridedyr]`.

### Ny fare
1. Legg typen til i `HazardKind` og `HAZARDS` (`data/hazards.ts`).
2. Tegn den i `buildHazard()` (`gfx/env/hazards.ts`).
3. Lag dødsmåten i `Hazard.kill()` og eventuelt syklusen i `Hazard.update()` (`game/hazards.ts`).

### Nytt ridedyr
1. Tegn dyret som en `BeastDef` i `gfx/chars/beasts.ts` (kropp, hode, hale, bein, ledd, sal).
2. Legg til en `MountDef` i `data/mounts.ts` med `attack: 'charge' | 'tail' | 'fire'`.
3. Bruk det i `riders` på et brett. Nytt angrep: legg til en tilstand i `Mount.update()` (`game/mounts.ts`).

### Nytt kjæledyr
1. Tegn det i `ART` i `gfx/pets.ts`.
2. Legg til en `PetDef` i `data/pets.ts` (evne, nedkjøling, flyr eller går).
3. Legg det i `SHOP` (`data/progress.ts`) med `kind: 'pet'`. Ny evne: legg den til i `Pet.ability()`.

### Ny butikkvare
Legg en `ShopItem` i `SHOP` (`data/progress.ts`). Nye typer (`ShopKind`) trenger en linje i `buy()` og `stock()` i `app/camp.ts`.

### Ny kartnode
Legg til en `MapNode` i `data/worldmap.ts` (posisjon, krav, belønning) og en kant i `MAP_EDGES`. Arena-noder peker på en duellant.

### Ny duellant
Legg til en `DuelistDef` i `data/duelists.ts`. `char: '@player'` gir en ond tvilling av spillerens helt.

### Ny del i heltebyggeren
1. Legg navnet til i riktig liste i `HERO_OPTIONS` (`gfx/chars/hero.ts`).
2. Tegn varianten i tilsvarende funksjon (`helmet`, `beard`, `torsoPart` osv., eller i `muscle.ts`).
3. Skal den låses opp? Legg den i `PART_LOCKS` og som `reward.unlock` på en kartnode, og gjerne i `SHOP`.

### Ny grafikk fra ChatGPT
Se `docs/ART_PROMPTS.md`. Filene legges i `public/assets/`, og `manifest.json` sier hvilken figur og del de tilhører.

## Oppstartslogo

`ui/splash.ts` viser først "PRESS ANY KEY" (nettleseren gir ikke lyd før brukeren har trykket), så faller logoen ned med trommevirvel, solstråler, konfetti og fanfare (`audio.fanfare()`). Den hoppes over i automatiske tester (`navigator.webdriver`) og med `?nosplash`. `?splash` tvinger den frem. Originalbildet ligger i `art/studio/`, og en komprimert versjon i `src/assets/studio-logo.webp` bygges inn i spillet.

## Testing

`tools/tests/` har Playwright-skript som styrer spillet via `window.__game` og `window.__lib` med faste tidssteg (`game.tick(1/60, false)`), tar skjermbilder og samler konsollfeil. Se `tools/tests/README.md`.
