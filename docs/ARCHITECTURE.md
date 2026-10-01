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
  perf.ts          Automatisk grafikkvalitet (QualityGovernor) og ytelsesmåleren bak ?perf (PerfMeter)
  debug.ts         window.__lib for Playwright-testene
  scenes/          creator.ts (Hero Forge), map.ts (verdenskart), editor.ts (brettverkstedet STAGE FORGE)
data/              Alt innhold som data (ingen Three.js her)
  enemies.ts       FOES: fiendetyper og oppførsel
  bosses.ts        BOSSES: sjefer satt sammen av trekk
  duelists.ts      DUELISTS: motstandere i 1v1
  levels.ts        LEVELS: brett, bølger, tønner, farer, ryttere, finale (sjef eller duell)
  layout.ts        Brettfilene: lag, kulisser, rader, animasjoner, validering, JSON-format og levelWithLayout
  layouts/         Én brettfil per brett (<brett>.json) og index.ts (import.meta.glob, og det som ikke er lagret)
  hazards.ts       HAZARDS: piggrop, myr, råk, lava, piggfelle
  mounts.ts        MOUNTS: ridedyr (fart, angrep, replikker)
  pets.ts          PETS: kjæledyr og fornærmelsene til hodeskallen
  progress.ts      Nivåkurve, STR/DEF/MAG/AGI-effekter, XP-regler og SHOP (butikkvarer)
  worldmap.ts      MAP_NODES og MAP_EDGES
  weapons.ts       WEAPONS og scaleAttack
  unlocks.ts       PART_LOCKS: deler i heltebyggeren som låses opp
  hero-parts.ts    HERO_PARTS: malte kroppsdeler og våpen, inkludert redigerbare grunnhoder
  hero-appearance.ts        HERO_APPEARANCE: separate lag og fargevalg, normalisering og låser
  hero-appearance-layout.ts Målte lagplasseringer og irisområder per grunnhode
  hero-skin-regions.ts       Hudpolygoner per malt hode/kroppsdel, med beskyttede materialer
  quips.ts         Replikker i B-film-stil for heltene og ordene for sjonglering
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
  metalmode.ts     METAL MODE: måler som fylles av drap, så solo, skadebonus, lyn og brennende våpen
  duel.ts          1v1 duell i Barbarian-stil, tag team, oppryddings-imp som sparker hodet i skjermen
  items.ts         Pickups (også egg) og tønner
  world.ts         Delte referanser (scene, gore, fx, kamera, statistikk, rumble)
gfx/               Grafikk
  chars/           Figurer: types, muscle (overdrevne kropper), classic, wilds, bosses, hero (heltebygger), beasts (ridedyr), index (register)
  env/             Miljø: common, grass, swamp, frost, scorch, tower, night (nattleiren), arena, worldmap, sprites, hazards, index (register)
                   sun (sol med skygger), grades (gradering per biom), trees (3D-trær), meadow (gress), leaffall (blader),
                   atmos (tåkelag og lyssøyler), textures (støyteksturer med normalkart, og bilder fra manifestet),
                   surface (triplanar overflatedetalj på alle miljømaterialer, valgfritt snø på flater som vender opp),
                   props (fyrfat, krigsbanner, runesteiner, klipper, fossefall, taubro, istapper, ruiner, taugjerde)
  props/           Kulissekatalogen: catalog.ts (plassholdere, bilder fra manifestet og 3D-rekvisitter), painted.ts (plassholderne tegnet i kode)
  scenery.ts       Kulissene på brettene: malte plan med figurlyset, tåke, vind, animasjoner, forgrunn som tones ut og treff med musa
  stagecam.ts      Kameraet på brettene (høyde, avstand, punktet det ser mot, og hvor langt det trekker seg for kjemper)
  noise.ts         Flisbar Perlin- og Worley-støy og fbm, brukt av teksturene, fjellene og 3D-steinene
  envlight.ts      Miljøkart fra himmelen (PMREM), så metall og våte flater speiler himmelen
  post.ts          Bildepipeline: HDR, bloom, SSAO, dybdeskarphet, eksponering, tonemapping, gradering, linseeffekter, grafikknivå
  screenfx.ts      Skjermeffekter i sluttpasset: sjokkbølger, zoomslag, kameradykk, varmeflimmer, årer, brennende kant, lyn, negativ
  screenwet.ts     Blod og vann på glasset (dråper som renner, høydekart som etterbehandlingen bryter bildet gjennom)
  wind.ts          Felles vindfelt (uniformer, GLSL, windifyTree) som trær, gress og blader deler
  rig.ts           Cutout-rigg for mennesker (hver kroppsdel er et plan med pivot i leddet), restore og setTint
  charlight.ts     Lys på figurene: relieffkart (normal og glans) fra tegningene og figurskyggeleggeren
  beast.ts         Rigg for ridedyr (kropp, hode, hale, 2 eller 4 bein)
  pets.ts          Sprites for kjæledyr
  gore.ts          Blod, gibs, flekker, fontener. Gore-nivå (FAMILY gir konfetti og gummiender). Sender gnister, ild og røyk til vfx
  blood.ts         Bloddråper på GPU (landing beregnet på forhånd) og flekker med våt glans, pytter som vokser
  gibs.ts          3D-gibs: kjøttbiter, bein, ribbein, tenner, øyeepler, lavastein
  vfx.ts           GPU-partikler (gnister, flammer, glør, røyk, snø), lyn, eksplosjoner og lyspool (punktlys til nærmeste kilder)
  fx.ts            Risting, hitstop, slowmo, sverdspor, tekst, blod på skjermen, hodet som klasker i skjermen
  assets.ts        PNG-erstatninger fra public/assets/manifest.json (figurdeler, teksturer, himmel, kart, og kulissene når de trengs)
  hero-appearance.ts Komponerer hodelag og hudfarger på egne lerreter; delte originalbilder beholdes
  draw.ts          Tegnehjelpere i enhetsrom
ui/                HUD og menyer (ren DOM)
  hud.ts           Spillerpaneler, duell-bars, sjef-bar, kunngjøringer
  screens.ts       Menyer og skjermer (også custom-paneler med justerbare valg)
  touch.ts         Berøringskontroller: flytende stikke, fire knapper, pause
  splash.ts        Oppstartslogo for Tom's Happy Happy Funtimes Emporium
core/              Input (tastatur, gamepad, berøring), lyd (WebAudio-synth og CC0-opptak), innstillinger, matte
  audio.ts         Lydeffekter, 8-bit-låtene og musikk-API-et (play, queue, intensity, innslag), dukking
  conductor.ts     Dirigenten: låtbytte på taktstreken med bro, intensitetslag, METAL MODE i takt, innslag på slaget
  metal.ts         Heavy metal: gitarforsterkere, trommer, bass, leadgitar, låtene, soloen, lagbussene og broen
  soundbank.ts     Lydbanken: CC0-opptak fra public/assets/sound/ oppå synthen (fra Morbidium)
  layers.ts        Lagspiller for syntlyd, torden, zap og fanfarene for drapsrekker, sjef og knockout
  ambience.ts      Stemning per biom (sløyfer med syntetisk reserve, bål i nærheten, fugler)
editor/            Brettverkstedet: history.ts (angre), io.ts (lagring og bilder), markers.ts (merker i 3D-bildet), editor.css
assets/            Bilder som bygges inn i spillet (studio-logo.webp)
```

Utenfor `src/`: `tools/vite-stage-forge.ts` er Vite-utvidelsen som lar editoren lagre brettfiler og bilder i repoet under `npm run dev`.

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
| `LAYOUTS` | data/layouts/index.ts | Brettfilene, via `layoutFor(id)` i Stage og editoren |
| Kulissekatalogen | gfx/props/catalog.ts | `prop` i brettfilene, biblioteket i editoren |

## Proporsjoner

Heltene bygges av `gfx/chars/muscle.ts` med målene i `gfx/chars/types.ts`: lange bein (`LEG_L`, `HERO_HIP_Y`), lange armer (`ARM_L`), høyere overkropp (`TORSO_Y` via `stretchY()`), hodet litt for lite (`HEAD_SCALE`), brede skuldre og enorme armer (`HERO_BIG_J`). `scalePart()` skalerer en del rundt leddet uten at konturstreken blir tykkere, og `stretchY()` strekker bare i høyden. Thrugg og Valkyra i `classic.ts` er bygget med heltebyggeren, så presetene har samme proporsjoner.

## Albuer og knær

Figurer med `bend` i `CharDef` (alt som bygges med `buildHeroDef`: heltene, Thrugg, Valkyra, Ash Raider og Iron Warden) bøyer albuene og knærne. Armer og bein er delt i ruter (`PlaneGeometry` 4 x 24 i `partAsset`), og hver figur får en egen kopi av geometrien (`Rig.limbBend`) der alt nedenfor leddet dreies rundt albuen eller kneet, med en myk overgang (`BEND_SOFT`) så huden strekkes i stedet for å knekke. Skyggeleggeren får dreiningen per hjørne (`aRot`, `#define BEND` i `CHAR_VERT`), så relieffet og kantlyset følger underarmen. Skyggen følger med fordi det er geometrien som bøyes.
- Leddet: `elbow` og `knee` i manifestet (brøk av bildet, målt for Thrugg og Valkyra), ellers midt på armen og 40 prosent ned på beinet.
- Stillingene: `elbowF`, `elbowB`, `kneeF`, `kneeB` i `Pose` (positivt er bøyd). Våpenet følger neven, men bladet peker dit `armF + weapon` sier, så våpenvinklene virker likt med og uten bøy. Tilleggene for heltene står i `PB` i `game/attacks.ts` og legges oppå `P` med `bentPose()` (figurer uten `bend` bruker `P` som før). Gangen og løpet regnes i `Fighter.animate`: kneet bøyes i beinet som svinger fram.
- Føttene på bakken: `Rig.plant()` flytter kroppen så laveste fot eller kne står på bakken når figuren står (`PLANTED` i fighter.ts). Da gir bøyde knær lavere kropp, kroppen synker når beina sprikes, og kneet står i bakken når figuren kneler. `bodyY` i stillingene betyr derfor bare noe for figurer uten `bend`.
- En arm som ryker, beholder bøyen den hadde. `tools/tests/bend.mjs` sjekker og viser stillingene (også `stiff` ved siden av, før og etter).

## Grep og tøffe fiender

Helten griper ved å gå inn i en fiende (`AUTO_GRAB`). Tøffe fiender (`guard: true` i `FoeDef`: grisemannen, vakten og istrollet) står imot til de vakler (`offBalance` i `game/grab.ts`): rett etter et treff (`Fighter.staggerT`, `STAGGER_OPEN` etter treffstøtet), når de er svimle, eller med under en tredjedel av livet. Går helten inn i en som står imot, skyves helten unna (`resistGrab`, en replikk fra `RESIST_BARKS`) og prøver ikke igjen på litt over et sekund (`Hero.grabPause`). Fiender med `poise` står uansett imot til de vakler. Test: `tools/tests/guard.mjs`.

## Vorthax på veien

`vorthax: { at, lines }` i en `LevelDef` får Vorthax til å vise seg som et kjempehode av lilla lys over brettet (`gfx/vision.ts`, hodet til figuren `vorthax`) og holde en tale, én replikk om gangen i HUD-en (`Stage.updateVision`, spilltid). Han viser seg bare mellom bølgene og bare én gang. Alle brettene før tårnet har en tale, og noen bølger har replikker om ordrene hans. Test: `tools/tests/vorthax.mjs`.

## Jungelen

Brett 2 (`jungle` i `levels.ts`, biomet `gfx/env/jungle.ts`). Trærne er tre arter med store blad (`broad` i `LeafKind`): jungelkjempen (`SPECIES.jungle`), palmen og bananplanten. Skogen åpner seg foran Soltempelet (`TEMPLE_X`), så pyramiden synes fra veien.
- **Planten** (`maneater`): syklusen står i `MANEATER` (`data/hazards.ts`). Den hviler, varsler (rister og snur gapet mot veien) og glefser. En fiende som kastes eller slås inn i den, blir spist med en gang (`armed` er alltid sant), mens en helt bare blir bitt når den glefser (`Hazard.bites`). Fiendene går rundt den.
- **Steinvekta** (`deadfall`): faller når noen står under den (`Hazard.trigger()` fra `Stage.updateHazards`), knirker først (`DEADFALL.creak`), treffer i ett bilde (`impact`) og heises opp igjen. Den dreper alle fiender under seg (`killsAll`), og en helt tar skade.
- **Søylene** (`templePillar` i `env/props.ts`, plassene i `JUNGLE_PILLARS`) er `Tippable` som fyrfatene. `tip(dir)` får retningen slaget kom fra, så søylen faller på skrå bort fra helten, og `Crush` er linjestykket den lander langs. `Stage.crush` dreper fiendene som står der og slår helter over ende (`PILLAR_HIT`).
- **Finalen** er en duell mot dronning Zanthra (`zanthra` i `duelists.ts`, figuren i `gfx/chars/raiders.ts`) i arenaen `temple`. `after` på duellanten gir replikker etter seieren når duellen er finalen på et brett.
- Låten er TEMPLE OF THE SUN (`jungle` i `METAL_TRACKS`), stemningen insekter, drypp, fugler, aper og frosker (`AMBIENCE` og `AMB_EVENTS` i `core/ambience.ts`).
- Test: `tools/tests/jungle.mjs` (farene og søylene, og skjermbilder langs brettet).

## Sjefer i faser og sluttkampen

Runde E i `docs/PLAN_BRETT_GORR_AI.md` (del 6.4). Sjefene går gjennom faser ved 66 og 33 prosent (`phases` i `BossDef`) i stedet for én raserigrense. En fase har replikk, fart, nye trekk (`extra`) og sterkere utgaver av trekkene han har (`stronger`, slås sammen med trekket av samme slag). Livslinja får merker der fasene begynner (`hud.bossPhases`), og hodeskallen gløder i fasene.
- **Sliten** (`tired` på et trekk): etter store trekk står sjefen og hiver etter pusten uten rustning (`BossCtl.tire`), så slagene rykker ham, og han tar 1,3 ganger skade. Teksten OPENING! viser vinduet.
- **Røde trekk** (`red`): rødt blink og krigshorn før trekket, og slag kan ikke avbryte det. Det må unngås (gå ut av linja, hopp). Sjefene slås aldri over ende (`Fighter.kdImmune`), de rykkes.
- **Nye trekk**: `feast` (Hogmother spiser et kyllinglår og får `heal` av livet tilbake, men slag for fem prosent av livet mens hun spiser, avbryter og gjør henne sliten), `dive` (Croakus går under bakken uten skygge, skyggen svømmer mot helten, og han kommer opp der den er, `DiveShadow`), `mirror` (Vorthax lager kopier av seg selv, `Fighter.illusion`, uten skygge; et slag på en kopi får den til å forsvinne, et slag på den ekte får alle til å forsvinne) og `beam` (solstrålen langs veien i høyden helten står i, med rød stripe som varsel, treffer hver helt én gang). `trail` på en fase gir lava i sporene (Magmor, `BossWorld.lava` og `LavaTrail`), som brenner det som går i den (glørne i `Stage.embers`). Figurer av lava brenner ikke.
- **Sluttkampen** (`finale` i `BossDef`, `Stage.updateFinale`): Vorthax står på tronen bak skjoldet (`mode: 'throne'`, `Fighter.shielded`, alt preller av) mens vaktene reiser seg av gulvet bølge for bølge (`guards`, `Stage.spawnRising`, `Foe.rise`). Skjelettvaktene (`skelguard`) har en dør som skjold (`FoeDef.shield`, `Fighter.frontGuard`): vanlige slag forfra preller av, men tredje slag i komboen, hoppslag, stormløp, spinn, kast, magi og slag bakfra går gjennom. Når vaktene er slått, går han ned og slåss. Skjoldet holdes oppe av tre søyler med krystaller i tronsalen (`templePillar(..., 'tower')`, `Tippable.conduit`); de veltes som søylene i jungelen, og en søyle som faller over ham tar sju prosent av livet (`BossCtl.crushed`, skjoldet hjelper ikke). Når den siste faller, brister skjoldet, og han er sliten. Ved 33 prosent tar han Solhjertet (`heart` på fasen): hjertet flyr fra lysekronen til ham, han gløder, og rommet blir rødt (`GRADES.heart`). Når han dør, faller hjertet på gulvet og buret med prinsessen senkes (`FinaleFx` fra `gfx/env/tower.ts`).
- Effektene står i `gfx/bossfx.ts`: skjoldet med stråler fra krystallene (`ShieldFx`), skyggen, lavaen, solstrålen, kyllinglåret og døra. Livslinja viser skjoldet (`hud.bossShield`).
- Tester: `tools/tests/bossphases.mjs` (fasene, måltidet, røde trekk, sliten sjef, dykket, lavaen, speilbildene, solstrålen) og `tools/tests/finale.mjs` (tronen, vaktene, døra, søylene, skjoldet, Solhjertet og slutten).

## Komboer og forsvar

Runde E, del 6.4 punkt 3 og 4 i planen (`game/combo.ts`):
- **Sjonglering**: `JUGGLE_LIMIT` treff i lufta (telles i `Stage.juggle`), så slås fienden i bakken (`spike`) og blir liggende. En liggende fiende kan ikke treffes før han er oppe (`canHit`).
- **Kanten av bildet**: under en bølge (`Stage.lockX`) spretter en kropp som flyr mot kanten, tilbake (`wallBounce`, litt skade), høyst `WALL_BOUNCES` ganger per flytur. En kropp som er slått avgårde (ikke kastet, det er `bowl` i grab.ts), skader fiendene den treffer (`bodyHits`, `BODY_HIT`). Tellerne nullstilles når kroppen er nede (`grounded`).
- **Lese helten** (`HabitReader`): eliter (`guard`, `poise` eller `shield` på `FoeDef`) og sjefer som tar `READ_AFTER` like slag på rad (samme slag uten trinnummer og våpen, `attackKind`), blokkerer i `READ_BLOCK` sekunder (`Foe.blockFor`, `BossCtl.blockFor`, staten `block`) og slår tilbake etterpå. Slag forfra preller av; løpeslaget har `guardBreak`, og slag bakfra går gjennom.
- **Grepet**: den som holdes, river seg løs etter `BREAK_FREE` sekunder uten kne (`breakFree` i grab.ts) og skyver helten bakover.
- **Prosjektiler**: fiender som ser et prosjektil fra heltene komme langs linja, går til side (`Foe.incoming`, sjansen fra vanskelighetsgraden).
- Test: `tools/tests/combo.mjs`.

## Tempo og vanskelighetsgrad

Runde E, del 6.4 punkt 1 og 6 i planen:
- **Regissøren** (`game/director.ts`, `Stage.director`): spenningen stiger med skaden heltene tar (andel av livet), drap og lite liv igjen, og synker over tid. Over `TENSION.peak` er det en topp; etter `peakTime` sekunder kommer et pusterom (`relaxTime`). `tokens()` gir angrepsplassene (`Stage.maxTokens`): én færre i pusterommet, én flere når det er rolig. `pace()` ganger nedkjølingene til fiendene (`FoeWorld.pace`, under 1 er lengre pauser).
- **Bølgebudsjettet** (`foeRank` i `data/enemies.ts`, `Stage.waveCap` og `waveDebt`): en bølge har plass til `maxAlive` i rang (1,4 ganger med to spillere). En fiende kommer når rangen hans får plass (eller ingen lever); går en bølge over, trekkes det fra neste bølge. `rank` på `FoeDef` overstyrer.
- **Vanskelighetsgraden** (`data/difficulty.ts`, `settings.difficulty`, OPTIONS): `wind` ganger opptrekket før fiendenes slag (`windUp` i foes.ts), `pace` tempoet, `dodge` unnamanøvrene, `tokens` angrepsplassene og `think` tenketiden til sjefene. Aldri liv eller skade.
- Alt som påvirker spillet, går i spilltid (`W.gore.later`), også ryttere, rop og game over, så pause virker.
- Test: `tools/tests/director.mjs`.

## Nye fiendetyper og ridedyr

Runde E, del 6.4 punkt 2 og 7 i planen. Hver ny fiende har en vane spilleren må straffe, og alt står i `FoeDef` (`data/enemies.ts`) og `Foe` (`game/foes.ts`):
- **Bueskytteren** (`goblinarcher`, `behavior: 'archer'`, `proj: 'arrow'`): holder avstand på linja (samme dybde som helten) og skyter piler med buen (`ENEMY_ATK.bow`, opptrekket er tida helten har til å gå ut av linja). Kommer helten nærmere enn `ARCHER_NEAR`, løper han unna i full fart, og han stikker bare svakt. Buen sitter i den fremre hånda (`attachBow`, `keepBowUpright` i `gfx/bossfx.ts`): våpenarmen sitter bak på kroppen og når bare midt på brystet, så den trekker strengen.
- **Froskemannen i bakhold** (`ambushfrog`, `ambush: true`): `side: 'B'` i bølgene setter ham i buskene bak veien (`AMBUSH.z`, `Foe.ambush`). Der er han usynlig, uten skygge og kan ikke treffes (`Fighter.hidden`), mens bladene rister. Så hopper han ut mot nærmeste helt og slår i lufta på vei ned (`leapOut`). Mens han er på vei ut, slipper `Stage` ham utenfor veien (`Foe.ambushing`, `backView`).
- **Griperen** (`grabber`, `grab` med `tell: 'red'` og `hold`): blinker rødt før grepet (`AttackDef.tell`, `Foe.strike`), og et slag i opptrekket stopper det. Han går helt inn før han griper (grepet rekker kortere enn slaget), holder helten bakfra (`data.holds`, `Fighter` plasserer den som holdes, med ryggen mot ham) og ber vennene slå (`callFriends`). Han slipper etter `hold` sekunder uten å kaste; helten vrir seg løs fortere ved å hamre på angrep eller hopp (`STRUGGLE` i `game/hero.ts`).
- **Berserkeren** (`berserker`, `berserk: 0.4`): under 40 prosent av livet blir berserkeren raskere (`RAGE.speed`), tar mindre skade (`RAGE.dmgTaken`), får kortere pauser og ingen panikk (`Foe.enrage`).
- **Den feige kapteinen** (`captain`, `behavior: 'captain'`, `horn`): blir bak troppene, blåser i hornet (`ENEMY_ATK.horn`, hornet i munnen fra `attachHorn`) etter forsterkninger fra kantene så langt bølgebudsjettet rekker (`Stage.hornCall`, høyst to per gang og tre ganger i alt), og roper ordre (`CAPTAIN.orders`): alle angriper oftere en stund (`Foe.rallyT`), og annenhver går rundt helten til den andre siden (`flankT`). Når kapteinen dør, får troppene panikk (`Stage.foeDied`).
- **Ledige ridedyr**: fiender til fots (ikke kjemper, kapteiner, bueskyttere eller gripere) løper til et ledig dyr innen 7 og setter seg opp (`Stage.claimMount`, `Foe.toMount`, `Mount.ready`), også dyret en helt nettopp gikk av. Ett dyr per fiende, og ingen andre tar det samme.
- **Utholdenhet**: spesialangrepet til dyret koster `STAMINA.cost` utholdenhet i stedet for liv og fylles opp igjen når dyret ikke angriper (`STAMINA.regen`, `game/mounts.ts`). Med for lite blir dyret andpustent (WINDED!) og puster damp. En linje over ryggen viser utholdenheten når en helt rir.
- Test: `tools/tests/newfoes.mjs` (med skjermbilder av buen, grepet, hoppet ut av buskene, hornet, raseriet og linja over dyret).

## Lys på figurene

Figurdelene er flate tegninger, så `gfx/charlight.ts` lager et relieffkart per del når tegningen lages (`reliefTexture` i `rig.ts` og `beast.ts`): hver flate mellom blekkstrekene blir en pute (avstandsfelt til blekk og kontur), pluss en slak bue over hele delen. R og G er normalen, B er glansstyrke og A glanstype (matt stoff og lær, hud med olje, metall). Hud gjenkjennes fra `skin` på CharDef (hudfargene og mørkere nyanser av dem), stål og gull fra fargen.

Materialet (`charMaterial`, brukt via `partMaterial`) er en ShaderMaterial med `lights: true`, så det tar scenens egne lys: himmel (HemisphereLight), sol og nøkkellys (DirectionalLight) og de fire punktlysene fra `LightPool` (fakler, lava, lyn, eksplosjoner). Ingen egen kobling trengs når et miljø legger til lys. Det gir myk diffus, glans (olje på huden, farget glans på metall), kantlys når lyset kommer bakfra og en svak kant av himmelfarge. `charUniforms` styrer balansen for alle figurer (forsterkning, omgivelseslys, fyllys fra kamerasiden, olje, kantlys, relieff). Materialet har `map` satt så skyggepasset alfatester riktig, og delene har `castShadow`.

Ny figur: sett `skin: [hudfarge, ...]` på CharDef hvis huden skal glinse.

De tegnede delene får `paintInk()` etter relieffkartet: blekkstrekene farges med en mørk utgave av fargen ved siden av, så figurene ser malte ut i stedet for tusjtegnet. PNG-erstatninger (malte bilder fra ChatGPT) lages med `reliefTexture(..., painted = true)`: mørke partier er skygger og ikke blekk, så volumet kommer fra omrisset og en svak høyde fra lysheten, og hud gjenkjennes fra fargetonen (`paintedSkin`) i stedet for fra `skin`.

PNG-deler trenger nesten ingen tall i manifestet (overkroppene er unntaket, se under). `rigHeight()` i `rig.ts` regner høyden ut fra figurens skjelett: beinet når bakken fra `hipY`, overkroppen når nakkeleddet (halsroten i `neck`, ellers 12 prosent under toppen), armen blir så lang som fra skulderen til våpenleddet, og hode, hofte og våpen får samme høyde som den tegnede delen. Ridedyr gjør det samme i `beast.ts` (beinet når bakken fra `bodyY`). `edgeX()` i `assets.ts` legger leddpunktet til siden der leddet faktisk er (midten av halsstumpen, midjen, beltet, skulderen og hofta), så hår til én side ikke flytter festet. Hoftedelen til heltene skaleres etter beltet (`HERO_BELT_W`, `beltWidth()`): beltet blir like bredt som midjen, og en lang flik får henge så langt den vil. Høyde eller anker i manifestet går foran. `tools/tests/pngparts.mjs` sjekker alt dette med syntetiske bilder.

Armer og våpen fra ChatGPT følger sjelden templatet nøyaktig (armen kan være bøyd eller strukket fram, neven kan sitte skrått under skulderen). Lasteren finner derfor neven i armbildet (`fistPoint()`: midten av det som er tegnet mellom 80 og 97 prosent ned, eller `hand` i manifestet) og grepet på våpenet (`gripPoint()`: det lengste smale strekket i nedre halvdel er skaftet, grepet sitter en halv neve over enden). `armTurn()` i `rig.ts` snur armen om skulderen og `rigHeight()` skalerer den, så neven havner nøyaktig i `joints.hand`, der våpenet sitter. Snuingen bakes inn i geometrien, så den gjelder begge armene (også den bakre, som ellers kunne forsvinne bak overkroppen) og avkappede armer. `tools/tests/artcheck.mjs` sjekker dette på de ekte bildene og kan lagre et galleri med leddmarkører.

Figurene står i trekvart profil mot høyre. `joints.shF` er den nære skulderen (figurens høyre, til venstre i bildet): våpenarmen `armF` henger der og ligger fremst, mens `armB` henger fra den fjerne skulderen `shB` og ligger bak overkroppen. En malt overkropp bestemmer selv skulderleddene og nakkeleddet: `shoulders` og `neck` i manifestet (brøk av det beskårne bildet) regnes om i `partAsset()` og settes i `Rig.joints`, som er kopien av figurens ledd som riggen og effektene (`fighter.ts`) bruker. Uten `shoulders` gjelder `SHOULDERS` i `assets.ts`; uten `neck` står hodet over `joints.neck` fra koden. Delene i heltesmia (`forge_*`) har også målte punkter, så hodet og armene sitter riktig når overkroppen byttes. `neck` kan ha en tredje verdi, en halv bredde: `fadeNeck()` i lasteren (`assets.ts`) toner da ut halsstumpen på overkroppen over halsroten, for bildene fra ChatGPT har hals både på hodet og overkroppen. Riggen, smia og testene bruker da samme uttonede bilde, mens relieffet regnes fra originalen (`PartOverride.full`), ellers blir kanten på uttoningen en ny ytterkant med kantlys.

Heltesmia bruker `HERO_PARTS` i `data/hero-parts.ts`, en felles katalog med 60 valg fordelt på seks kategorier. De 13 hodene omfatter to redigerbare grunnhoder. `HeroConfig.parts` lagrer en stabil ID for hode, overkropp, belte, arm, bein og våpen. `buildHeroDef()` setter `CharDef.inherit` per del, så hele figuren beholder malt grafikk når én del byttes. Thrugg og Valkyra er startoppsett, ikke krav som blandingen må matche. Uten `parts` brukes CLASSIC BUILDER. Et manglende bilde gir prosedyretegning bare for den delen.

`withHeroParts()` synkroniserer kroppstype med valgt overkropp og våpenklasse med valgt våpenbilde. Flere bilder kan ha samme våpenklasse, som sverd og sabel eller flere klubbebilder. `HeroConfig.appearance` har sju stabile strengvalg: `hair`, `beard`, `headgear`, `skinTone`, `eyeColor`, `hairColor` og `eyeStyle`. `withHeroAppearance()` og `cloneHero()` lager egne normaliserte records, så spillere, utkast og presets ikke deler redigerbare valg. `heroKey()` inkluderer del-ID-er, klassiske reservevalg og utseendevalg i fast rekkefølge. Navn og magi endrer ikke bildene. Uten `parts` fjernes `appearance`, så klassiske innstillinger fortsatt har synlig virkning.

`gfx/hero-appearance.ts` lager hudvarianter og hodekomposisjoner på egne lerreter uten å endre bildene i `assets.ts`. `HERO_SKIN_REGIONS` registrerer alle 49 hode-/kroppsdeler i poolen; include/exclude-polygoner og en fargefamiliesjekk avgrenser hud. Tom `include` betyr kontrollert del uten eksponert hud. Ukjente deler tones ikke. Hår og skjegg farges som separate lag, mens irisfarger bevarer pupill og lyse glimt. Tøyomfarging er ikke implementert.

De 16 utseendebildene lastes fra manifestets `appearance`-liste: sju hårbilder (LONG har front og bak), tre skjegg, fire hodeplagg og to irisvarianter. `HERO_APPEARANCE_LAYOUTS` har mål for hvert grunnhode. Komposisjonen utvider lerretet ved behov og flytter ankeret slik at grunnhodets skala og halsledd beholdes. Bakhår og skjegg får egne rigglag bak kroppen og foran kragen, begge under det animerte hodet. Hornhjelm og hodeskallehjelm skjuler fronthåret uten å endre lagret hårvalg. `headCanvas()` og `heroHeadPreview()` bruker den samme komposisjonen til portretter og løse hoder. CPU-variantene og riggteksturene har begrensede cacher; `purgeChar()` rydder variantene for gamle forhåndsvisninger.

`CreatorScene` skiller mellom HERO PARTS og HEAD DETAILS. `heroAppearanceAvailable()` hindrer valg av utseendebilder som ikke er lastet, og `heroSkinSupport()` avgjør om hudfeltet vises. De seks øvrige detaljfeltene gjelder bare `isModularHeroHead()`. Gamle hoder beholder innmalte detaljer, og brukerens valg av CUSTOM MALE/FEMALE er eksplisitt. Et bytte av hode bevarer kropp, våpen og utseendeutkast. Rader ruller separat fra kortstripe og lagreknapper; hver spiller har egne deler, utseende, markør og side. CANCEL kaster utkastet.

Utseendevarianter deler malte kroppsressurser etter kildedel, riggmål og hudtone. Eierlister og svake mesh-pekere hindrer at en gammel variant frigjør aktive eller delte ressurser. Hode-, skjegg- og bakhårlag beholder full fargetekstur; bare relieffberegningen begrenses til 512 piksler med tilsvarende justering av piksler per verdensenhet.

Katalogenes `unlock` peker på eksisterende nøkler i `PART_LOCKS`; både valgene i smia, tilfeldig helt og lagringsleseren følger låsene. Frosthode, -overkropp, -arm og -bein og den nye frosthudfargen deler `skin:6`, mens frostbeltet er fritt. Blå hårfarge følger `hairColor:6`, krone `helmet:4` og hodeskallehjelm `helmet:3`. `heroPartsVersion: 1` skiller uttrykkelige CLASSIC-valg fra gamle lagringer. Bare uten dette merket migreres gamle preset-kropper til delpoolen, med valgt våpen, tøyfarge og magi bevart. Gamle lagringer uten `appearance` beholder utseendet; nye ugyldige eller låste utseende-ID-er repareres felt for felt. Filkart og målt kalibrering står i `docs/HERO_FORGE_GRAFIKK.md`.

`gfx/chars/raiders.ts` gjenbruker `buildHeroDef()` for fiendene `ashraider` og `ironwarden`, med stabile ID-er i `CHARS`, egne klassiske reservevalg og `inherit` til Forge-delene. `FOES` gir Ash Raider rask nærkamp med `ENEMY_ATK.skel` sine øksehoggposer og Iron Warden langsomme `ENEMY_ATK.hog`-hammerhogg med `poise`. Fiendens skade og timing kommer fra `AttackDef`, ikke fra heltens `WeaponStats`. `LEVELS` bruker dem i Scorchlands bølge 2/4 og Tower bølge 1/4, én erstatning per bølge. De bruker eksisterende AI, rigg, skade og belønning; spillerens delopplåsinger påvirker ikke fiendenes utstyr.

Dybden (`Z` i `rig.ts`): fjern arm, bakhår (`HAIR_BACK`), hode, overkropp, bein, hofte og våpenarm fremst. Hodet ligger bak en malt overkropp så halsen går inn under kragen, men foran en tegnet overkropp (som ikke har hals) og når hodet har `front` i manifestet (langt skjegg). Fordi våpenarmen sitter bak på kroppen, strekkes den fram i slagene i `P` (`attacks.ts`), og figuren tar et lite steg inn med `bodyX`; sverdtuppen når da omtrent like langt som før byttet. Grep og hold bruker den fjerne armen, som sitter på forsiden av kroppen (`hold` i `fighter.ts`, `giantGrab` i `enemies.ts`). `tools/tests/artcheck.mjs` sjekker at våpenarmen dekker skulderplaten, at hodet ligger riktig, at hoggene når fram og at alle overkropper har målte punkter.

Del `hairback` i manifestet (langt hår) er bare PNG. `Rig.hairBack()` legger den i hodegruppa men bak hodet og overkroppen og foran den fjerne armen (`HAIR_BACK`), så håret henger ned bak ryggen og følger hodet (også når hodet kappes av).

## Bilde og grafikknivå

`gfx/post.ts` eier det endelige bildet. Scenen tegnes i lineær HDR med MSAA, så bloom, dybdeskarphet, eksponering, tonemapping (én gang), gradering og linseeffekter. LOW tegner rett til skjermen uten etterbehandling. Graderingen settes per miljø (`grade` på Env, fra `env/grades.ts`) eller per scene (kartet). `W.post` gir tilgang fra spillkoden (aberrasjon ved store treff). Rød kant, årer, lyn, sjokkbølger og dråper på glasset går via `screenFX` (se Skjermeffekter og automatisk kvalitet).

Kode som bygger innhold leser `gfxState.quality` eller `qualityRank()` (0 LOW til 3 ULTRA) for tetthet på gress, antall blader og størrelse på skyggekart. Miljøene bruker `lit()`/`toon()` (MeshStandardMaterial) og `applyShadows()`. Sola (`SunShadow`) følger kameraet.

Realisme i 3D (Tom: 3D så ekte som mulig, ingen konturer på 3D-ting):
- Teksturer: `env/textures.ts` baker jord, grus, murstein, fliser, sand, planker og lavastein av støy (`gfx/noise.ts`), med normalkart i `map.userData.normalMap` (og glød i `emissiveMap`). `lit()` henter dem selv. Hvert kall kan byttes mot et bilde fra manifestet med `texFile()` (se oppskriften under).
- Overflatedetalj: `withSurface()` i `env/surface.ts` legger triplanar detalj (normal og skitt) på alle `lit()`-materialer, så store flater ikke blir glatte. Av på LOW.
- Himmel og lys: grass, swamp og frost har `atmosphere` på Look og får fysisk himmel (`physicalSky()`, Sky-addon med skyer), med mindre manifestet har et himmelbilde for biomet. Et himmelbilde legges fire ganger rundt en sylinder som følger kameraet (horisonten omtrent 73 prosent ned i bildet), og da tegnes ikke egen sol, måne eller skyer. `skyLight()` i `gfx/envlight.ts` lager miljøkart (PMREM) fra alt som er merket `userData.sky` når scenen settes opp. Tåka er eksponentiell (`FogExp2`, tetthet 1.25 delt på `fog[2]`).
- SSAO i `post.ts`: bare dybde, halv oppløsning, uskarphet som respekterer kanter. Styrken er `ao` i graderingen, antall prøver følger grafikknivået (0 på LOW). `W.post.debug.aoView = true` viser bare AO-bufferet (brukes av `tools/tests/ab.mjs`).
- Modeller: steiner (`rock()`), hodeskaller (`skull3D()`) og fjell (`mountains()`) er støyforskjøvne 3D-modeller med fargede hjørner, ikke sprites.

Målbildet for grafikken står i `docs/STYLE_TARGET.md`. Små statiske rekvisitter legges i `staticGroup(g)` (paliser, piler, steiner, hodeskaller på stake gjør det allerede) og slås sammen per materiale og bit langs x i `finishEnv`, så de koster noen få tegnekall. Ting som flyttes eller animeres skal ligge direkte i gruppa. `foreground(g, L, typer, farge)` i `env/common.ts` legger mørke silhuetter nederst i forgrunnen (pigger, hodeskaller, kors, steiner, bein) slått sammen til ett mesh.

### Skjermeffekter og automatisk kvalitet

Portet og forbedret fra Morbidium (Toms eget spill): dråpene fra `src/43_vaatt.js`, sjokkbølger, zoomslag, kameradykk, lyn, negativ, årer og brennende kant fra `src/04_render.js`, varmekildene fra `src/40_dybde.js`, årene ved lav helse fra `src/34_blod.js`, lyspoolen og kvalitetsmålingen fra `src/15_rom3d.js`, og måling av bildetid fra The Deep Ones (`v2/main.js`).

- `screenFX` (`gfx/screenfx.ts`) er én felles tilstand, som `wind` og `audio`. Spillkoden kaller `shock(pos, styrke)`, `punch(pos)`, `dive(k, hold)`, `boom(pos, størrelse)`, `negative()`, `lightning()`, `health(andel)` (brettet og duellen hver frame) og setter `burnGoal` (METAL MODE). Posisjonene er i verden og projiseres når bildet tegnes.
- Varmeflimmer: miljøet legger inn kilder med `screenFX.addHeat(pos, radius, styrke, bånd, levetid)` når det bygges (bål i `campfire()`, lavaelva som bånd, brennende trær, lavapøler, fyrfat med ekte ild). Listen tømmes ved scenebytte. Flimmeret forvrenger bare det som ligger bak kilden (dybdetest), så figurer foran bålet står stille.
- Dråper på glasset: `W.fx.heroHit(kraft, side)` fra `applyHit` når en helt blir truffet (blod fra siden slaget kom fra), `W.fx.screenBlood(n)` på store øyeblikk og `W.fx.lensSplat(pos)` når noe sprenges. Uten etterbehandling (LOW) er 2D-blodet i `fx.ts` reserven, og FAMILY får konfetti. `Env.rain` gir regndråper (ingen brett har regn ennå).
- Hodet i skjermen (`W.fx.hurlAtScreen` i `fx.ts`): klasker i glasset med de innspilte splattene fra lydbanken oppå dunket (`audio.glassSplat`), henger litt (`stickT`), sklir sakte ned og tones ut etter `HEAD_SHOW` sekunder på `HEAD_FADE` sekunder. Spruten ved treffet er én uregelmessig klatt med sideklatter, dråper og korte stråler (`spatter`). Blodsporet (`trail`) tegnes i søyler på to piksler med en myk profil på tvers (`trailProfile`), mørkere kant, en blank stripe og hele piksler i høyden (ellers blir det tverrstriper), og det smalner og blir lysere når blodet tar slutt (`TRAIL_REACH`). Renner (`Drip`) starter i klatten og i sporet, slingrer litt og får en dråpe i enden. Alt falmer på `TRAIL_FADE`. Test: `tools/tests/splatter.mjs`.
- Underkroppen etter todeling (`die('bisect')`) bruker samme løping som den hodeløse kyllingen (`Fighter.headlessT`, bare fiender med `allowHeadless`), med en fontene fra midjen. Begge legger blodflekker på bakken mens de løper. `Stage.foeDied` gir ingen dødsreplikk ved todeling (som ved eksplosjon og knusing), så boblen ikke havner over beina oppå ordet deres.
- Alt oppdateres i `Game.tick` på ekte tid (0 i pause), også når testene kjører uten å tegne. Kameradykket settes som `camera.zoom` før flytende tekst plasseres.
- Innstillinger: `flashes` (hvite glimt, lyn, negativ; mørke toninger blir svakere) og `distortion` (sjokk, zoom, dykk, flimmer, aberrasjon; dråpene bryter litt lys uansett). Blodet følger gore-nivået. Nytt grafikkvalg nullstiller `autoQuality`.
- Automatisk kvalitet: `QualityGovernor` (`app/perf.ts`) måler bildefrekvensen i to sekunder om gangen når et brett eller en duell spilles. To målinger under grensen (ULTRA 50, HIGH 40, MEDIUM 30) gir ett trinn ned, lagret i `settings.autoQuality` så neste lasting starter der. Den står av i Playwright med mindre adressen har `?autotune`. `?perf` viser måleren.
- WebGL mistet: spillet pauser og venter. Når konteksten kommer tilbake, lager `post.recover()` nye mål uten å slette de gamle (de finnes ikke lenger), skyggekartet og miljøkartet tegnes på nytt, og AUTO går ett trinn ned. En selvtest etter hvert nytt nivå går til LOW hvis bildet er helt hvitt eller helt svart. I pause tegnes ikke skyggekartet på nytt, og bildet tegnes bare fire ganger i sekundet (med en gang etter ny størrelse eller nye innstillinger).
- Partiklene (`Pool` og `GLOW_VERT` i `vfx.ts`) er firkanter uten tosidig materiale, så formen må ha forsiden mot kameraet. Strekkes en partikkel langs farten d, må tverraksen være d dreid -90 grader (`vec2(d.y, -d.x)`), og ringene på bakken legges med `-c.y` i z. Med motsatt fortegn blir firkanten speilvendt og tegnes ikke: slik var alle blodråper i lufta og gnistene usynlige fra 29. til 30. september. `tools/tests/particles.mjs` teller pikslene og fanger det.
- Lyspoolen (`LightPool` i `vfx.ts`) holder lysene på de samme kildene med inn- og uttoning. Små glimt tar bare ledige lys; store (styrke 15 og mer) låner lyset fra den fjerneste kilden.
- Nye effekter i sluttpasset legges i COMPOSITE i `post.ts` med en uniform som `screenFX.writeUniforms()` fyller. Sjekk med `tools/tests/screenfx.mjs`.

### Nytt tre eller ny art
Legg en `Species` i `SPECIES` (`env/trees.ts`): lengde, radius, seksjoner, barn, vinkler, knudrethet og blader per nivå. Bruk den med `new Forest(art).add(x, z, skala)` og `forest.build()` i biomet. Bladtypene (`LeafKind`) er bladkort tegnet i `leafTexture()`; `broad` er noen få store blad i vifte (jungelen). En palme er bare stamme og ett nivå blad som henger (`start` nær 1, høy `droop`).

## Menyer

Alle menyene går gjennom `Screens.menu()` i `ui/screens.ts`. Et `Item` har `label` og `action`, og kan ha:
- `value`: verdien vises til høyre i lister (`<ul class="menu rows">`) og under navnet i sentrerte menyer (`<ul class="menu">`, tittelen, pausen, borgen).
- `adjust`: venstre/høyre (og pilene rundt verdien) endrer verdien.
- `hint`: forklaringen står i ett felt under menyen (`.menu-hint`) og følger valgt rad, så det bare står én forklaring om gangen.
- `more`: raden åpner en undermeny og får en pil.
- `disabled`: grå rad som sier nei.

Enkel regel for nye menyer: få rader, en verdi i stedet for flere knapper når valget er "ett av flere" (som 1 eller 2 spillere), og lange forklaringer i `hint`. `relist()` tegner bare menyen på nytt, så tittelen ikke starter logoen igjen når en verdi endres. Menyen ruller ikke til første rad når den åpnes, så lange sider åpner på toppen.

Tittelen har fire knapper (STORY, DUEL, HERO FORGE, OPTIONS). OPTIONS (`Game.showSettings`) har gore, gruppene SOUND og SCREEN (`showSettingsGroup`), CONTROLS (`showControls`: tastene, trekkene på brettene og trekkene i duellene som tre sider man blar i med SHOW, pluss rumble og berøring) og ERASE SAVE (bare fra tittelen). `tools/tests/menus.mjs` sjekker at alt er med.

## Innstillinger og gore-nivå

`core/settings.ts` lagrer gore-nivå, lydnivå, musikkstil (heavy metal eller 8-bit), innspilte lyder (RECORDED SOUNDS), risting, blink (FLASHES), forvrengning (SCREEN DISTORTION), rumble, berøringsmodus, grafikknivå og hvor langt AUTO har trappet ned (`loincloth-legends-settings-v1`). `Game` lytter med `onSettings` og setter `Gore.level`, lydnivåene og musikkstilen. Nye felt må også inn i `load()` med sjekk, ellers forsvinner de. Nye valg legges i riktig gruppe i `showSettingsGroup` med `row()` eller `toggle()`, som gir hver rad sin egen plass, så de kan settes inn hvor som helst. Hold toppnivået i OPTIONS kort. Gore-nivået skalerer partikler, gibs, fontener og blod på skjermen. FAMILY bytter blod mot konfetti og gibs mot gummiender, blomster og stjerner.

## Input

`InputManager` slår sammen tastatur, mus, gamepad og berøring til to `PlayerInput`. Venstre museknapp på spillflaten (`MOUSE_LEFT`) står i angrepstastene til spiller 1 som en tast, men bare når `InputManager.mouseAttack` er på: `Game.setScene` slår den på for brett og dueller, ikke for kartet (der betyr angrep «gå inn»). Menyene og pausen er egne lag over spillflaten og tar klikkene selv. Knappene er `left right up down attack jump special grab start`, men spillet bruker bare tre handlingsknapper: `grab` er en skjult snarvei. Grep skjer når helten går inn i en fiende eller et ledig ridedyr i `AUTO_GRAB.time` sekunder (`Hero.update`, `Stage.grabContact` og `tryGrab(h, true)` med kortere rekkevidde), og ned + hopp hopper av dyret. Gamepad følger standard mapping (A hopp, X angrep, B spesial, Start pause). I 2-spiller med én gamepad styrer gamepaden spiller 2. Berøring (`ui/touch.ts`) styrer alltid spiller 1 og vises bare når det spilles (ikke i menyer). `W.rumble(player, sterk, svak, ms)` rister riktig gamepad.

## Brett, kulisser og faste frø

Et brett er tre lag oppå hverandre: miljøbyggeren for biomet (`gfx/env/<biom>.ts`), brettfila (`data/layouts/<brett>.json`) og spilldataene i `levels.ts`. `Stage` bygger med `levelWithLayout(LEVELS[id], layoutFor(id))`, så bølger, tønner, farer, ryttere og lengde i brettfila går foran `levels.ts`.

- **Faste frø.** `core/math.ts` har én tilfeldighetskilde (`random`, `rand`, `chance`, `pick`). `withSeed(frø, fn)` låser den mens miljøet bygges, så pynten blir lik hver gang. Kampen bruker vanlige tilfeldige tall. Teksturer som mellomlagres, lages med `unseeded`. I miljøbyggerne gir `gen(o, 'nøkkel')` hver pyntblokk sitt eget frø og en bryter (`generators` i brettfila), så en blokk kan slås av uten at resten flytter seg. Byggekode for miljøet skal aldri bruke `Math.random()`.
- **Kulissene** (`gfx/scenery.ts`) er plan med fotpunktet i origo. De bruker figurenes lysmodell (`CHAR_VERT` og `CHAR_FRAG` fra `charlight.ts`) med relieff laget fra bildet, tåke, vinden fra `wind.ts`, ruter i bildeserier, dithering når de tones ut og mørkning for FRONT. Et klikk treffer bare der bildet ikke er gjennomsiktig. 3D-rekvisittene bygges med `build` i katalogen, og lys og varmeflimmer de lager, fjernes igjen når de slettes (`LightPool.removeSource`, `ScreenFx.removeHeat`).
- **Toningen foran:** hver frame projiseres noen punkter på heltene, fiendene og sjefen (`Stage.fighterBoxes`) inn i planet til FRONT-kulissene. Treffer et punkt en del av bildet som ikke er gjennomsiktig, tones kulissen ned til `FRONT_FADE` (20 prosent) på 0,15 sekunder.
- **Trær i forgrunnen** (mellom veien og kameraet, i dag småfuruene i frostpasset) tones ut på samme måte (Tom 2026-10-01: på mobil fylte en eik i nattleiren hele bildet; de store trærne på brett 1 og i nattleiren ble samtidig flyttet bak kampbeltet i PR #7). De legges inn med `Forest.addFront` i stedet for `add` og bygges hver for seg med egne materialer med dithering (`frontMaterials` i `env/trees.ts`). Miljøet legger dem i `Env.fronts` (`g.userData.fronts`), og `Stage.updateFronts` sjekker hver frame om linja fra kameraet til punktene på figurene går gjennom boksen rundt treet (`fadeFronts` i `env/common.ts`). Alt nytt som står mellom veien og kameraet og er høyere enn et kne, skal kunne tones ut slik. Test: `tools/tests/foreground.mjs`.
- **Animasjonene** (sway, swing, bob, spin, flicker, sheet, track, wave, pulse, drift, react) er data i `data/layout.ts` og regnes ut i `Scenery.tick` på spilltid. `trackValue` gir verdien i et spor med myk overgang (etter POSER i Morbidium). `wave` og `sway` bøyer et oppdelt plan i skyggeleggeren (`uWave`, `uT`, `vShade` for skygge i foldene). `react` får fighterne fra `Stage.fighterBoxes` og treff, kast og bakkeslag fra `Scenery.poke` (kalt i `Stage.onFoeHit`, `thrownLanded` og `onQuake`), og `trigger(key)` spiller den med en gang.
- **Deler:** `parent` på en plassering henger den på leddet (`pivot`) til en annen, så den følger animasjonen. Dataene er alltid plassen i verden: `place()` regner om til rommet til forelderens ledd i ro (`restPivot`, fra dataene alene), og `removeKey` løsner delene før forelderen ryddes. Editoren flytter, skalerer, speilvender og vrir delene sammen med forelderen (`carryParts`). Et sett (`preset`, `PresetPart`) i katalogen eller manifestet legges ut som deler, og `on` henger en del på en annen del i settet (flammen i lykta).
- **Varianter:** navn som bare skiller seg på `_a`, `_b`, `_2` til slutt (`variantBase` i editoren). En rad med `variants` trekker blant dem med radens frø, etter de andre tallene, så rader uten varianter står som før.
- **Bilder som tar over:** `imageKind` i `gfx/props/catalog.ts` lager kulissen av et bilde fra manifestet eller editoren. Samme navn som en plassholder beholder mål, lys, flammer og bevegelse. `grid` og `n` gjør bildet til en bildeserie. `anim` i manifestet er hele lista. `emit` (0..1) gjør at bildet lyser selv (`uEmit` i skyggeleggeren: bildets farger uten lys og skygge), og `fire` gir partikkelflammer ved punkter i bildet.
- **Lasting av kulissebildene:** `loadAssets` i `gfx/assets.ts` leser hele manifestet, men henter bare bildene `main.ts` ber om: de brettfilene bruker (`layoutPropIds` i `data/layout.ts`), eller alt med `?editor` i adressen. `loadPropImages(ids)` henter resten, hvert bilde bare én gang, og `Game.openEditor` venter på den når ikke alt er hentet (`propImagesLoaded`).
- **Editoren** er en egen scene (`app/scenes/editor.ts`, navn `editor`) som bygger den samme verdenen som spillet med `scenery.editor = true`, pluss merker (`editor/markers.ts`) og DOM-paneler. Tilstanden (`forgeState`) ligger utenfor scenen, så den overlever ombygging, PLAY FROM HERE og veien tilbake. Angre er hele brettfila som JSON (60 steg). Brukerveiledning: `docs/STAGE_FORGE.md`.

## Oppskrifter

### Ny fiende
1. Tegn figuren i `gfx/chars/wilds.ts` (eller ny fil) som en `CharDef` med delene leg, arm, pelvis, torso, head og eventuelt weapon. Legg den i eksportlista.
2. Legg til en `FoeDef` i `data/enemies.ts` med `behavior`, `attack`, `range` og eventuelt `proj`.
3. Bruk id-en i bølgene i `data/levels.ts`.
Bare fargevariant? Bruk en eksisterende `char` og sett `tint` (se `frostskel`). Skjold? Sett `shield: true` (en dør foran kroppen, se `skelguard`). Bakhold, grep som holder, raseri og horn er felt på `FoeDef` (`ambush`, `hold`, `berserk`, `horn`), og bueskytteren og kapteinen er egne `behavior` (se «Nye fiendetyper og ridedyr»). Et slag med `tell: 'red'` blinker rødt i opptrekket.
Fiende-AI (`game/foes.ts`): fiender holder avstand, men rygger på halv fart (`RETREAT`), og når de først har vært i bildet (`Foe.entered`), holder `Stage` dem innenfor det (tyver på flukt går fritt). Ridedyr med fiende på ryggen har det samme: `Mount.entered` og `Stage.mountBounds` holder dem i bildet når de har ridd inn (under en bølge også dyr uten rytter), og `Mount.ai()` holder standplassen `MOUNT_EDGE` innenfor kanten, rygger på halv fart og ser mot helten mens det rygger. Rytteren angriper ikke fra utenfor bildet, og ikke en helt som ligger nede eller reiser seg (`RIDER_GRACE`). `tools/tests/riders.mjs` jager ryttere med en spillerbot. Ønsket avstand for dem som kaster, begrenses av bredden på bildet. `Foe.panic(sek)` gir panikk (løper vekk i sikksakk, armene i været via `Fighter.panicking`, høyst `PANIC_SPEED`); `Stage` utløser den ved grufulle drap i nærheten, lite liv, brann og når METAL MODE starter.
Kjempe? Lag en `CharDef` med stor `scale` som arver delene fra en vanlig figur (`inherit`, se `bigtroll` i `gfx/chars/wilds.ts`). Store figurer tegnes med flere piksler per enhet og like tynn strek på skjermen (`rig.ts`). Sett `poise` på `FoeDef` (han tar skade, men blir verken slått tilbake eller ned før han har tatt så stor andel av livet, da vakler han), og gi angrepet `quake` (bakken rister der slaget treffer). Kameraet trekker seg bakover mens en figur større enn 1.8 er i bildet (`Stage.camPull`, avstandene i `gfx/stagecam.ts`).

### Ny sjef
1. Lag figuren (eller gjenbruk en med `scale` og `tint`).
2. Legg til en `BossDef` i `data/bosses.ts`: velg trekk med vekt og nedkjøling, sett `phases` (to faser, ved 0.66 og 0.33, med replikk, fart, nye trekk og `stronger`) og intro-replikker. Gi de store trekkene `tired` (vinduet etter trekket) og noen `red` (kan ikke avbrytes).
3. Sett `finale: { type: 'boss', boss: '<id>' }` på et brett.
Nytt trekk som ikke finnes: legg det til i `BossMoveKind` og i `exec()` i `game/boss.ts`. En sluttkamp med vakter og skjold er `finale` på `BossDef` (se «Sjefer i faser og sluttkampen»); biomet må da gi `Env.finale` (tronen) og søyler med `conduit`.

### Nytt biom
1. Lag `gfx/env/<biom>.ts` med en `build<Biom>(scene, gore, opts)` som returnerer `Env`. Bruk `stageBase` og hjelperne i `common.ts`.
2. Registrer den i `STAGE_BUILDERS` i `gfx/env/index.ts`.
3. Bruk biom-id-en i en `LevelDef`.
Juv: en fare med `kind: 'chasm'` langs bakkanten (data/hazards.ts). `Stage` gir hullene til miljøet (`StageEnvOpts.holes`), `stageBase` lager bakken og veien rundt dem (`Look.holes`), `gore.holes` hindrer blod og kroppsdeler i å bli liggende i lufta, og farevisningen tegner veggene ned i dypet med taugjerde. `blocks` på faren: ingen går utfor, bare kastede og slåtte fiender faller.
Istapper (`game/icicles.ts`) og fyrfat og søyler som veltes (`Env.tippables`, `Tippable` i common.ts, `tip(dir)` med retningen slaget kom fra) styres av `Stage.updateProps`, som også håndterer glør på bakken og `Fighter.burnT` (brann). Bakkeslag melder fra via `FoeWorld.onQuake`. Skade fra omgivelsene går gjennom `applyHit` med en skjult figur som angriper (`Stage.nature`).
Rekvisittene i `env/props.ts` kan brukes i alle biomer: `brazier()` gir ild, lys, varmeflimmer og knitring (returnerer punktet flammene skal komme fra), `warBanner()` bølger i vinden, `cliff()` returnerer høyden på toppen så ruiner, bro og fossefall kan settes der. Sett `gore.dustColor` hvis støvet fra bakken ikke er sand (snø i frosten).

### Nytt brett
Legg til en `LevelDef` i `data/levels.ts`. Kulissene legges i `data/layouts/<id>.json` (tom fil: `{"version": 1, "level": "<id>", "props": [], "runs": []}`), gjerne med STAGE FORGE (`?editor=<id>`). Bølger skrives kompakt: `w(at, maxAlive, 'skeleton:R:0.2 hogman:L:1.0', { title, say })`. Siden er `L` eller `R` (kanten av bildet) eller `B` (buskene bak veien, for fiender i bakhold som `ambushfrog`). `maxAlive` er rangen som kan leve samtidig (bølgebudsjettet). Farer legges inn med `hz(kind, x, z, bredde, dybde)`, og ryttere med `[bølgeindeks, fiende, ridedyr]`. Finalen er en sjef, en duell eller `{ type: 'dawn' }` (ferdig når bølgene er over og ingen fiender er igjen). `nightCamp: true` gir nattleir-reglene: heltene sover ved start, tyvnisser stjeler krukker, og krukkene blir forsyninger (`Game.campSupplies`).

### Ny kulisse
- Et bilde: `prop_<navn>.png` eller `anim_<navn>_<K>x<R>.png` i `art/inbox/` og `python3 tools/process_art.py`, eller dra det inn i editoren. Se «Kulisser til brettverkstedet» i `docs/ART_PROMPTS.md`.
- En plassholder tegnet i kode: en funksjon i `gfx/props/painted.ts` (lerret, eget frø) og en linje i `PAINTED` i `gfx/props/catalog.ts` med `w`, `anchor`, lag og eventuelt `anim`, `fire` og `preset`.
- En 3D-rekvisitt: en linje i `MODELS` med `build(ctx)` som bygger ved `(ctx.x, ctx.z)` i `ctx.g`. Oppdateringer legges i `ctx.updates`.

### Ny animasjonstype for kulisser
1. Legg typen til i `PropAnim` og `ANIM_TYPES` i `data/layout.ts`, og sjekk feltene i `validateLayout`.
2. Regn den ut i `Scenery.tick` (`gfx/scenery.ts`), på spilltid. Trenger den formen på bildet (som `wave`), gjøres det i skyggeleggeren med en uniform, og planet deles opp i `buildImage`.
3. Felter i editoren: `renderAnims` i `app/scenes/editor.ts` (`field`, `choice`, `pair` og `picker` for punkter i bildet), og en standardverdi i lista `fresh`.
4. En sjekk i `tools/tests/prop-anim.mjs`.

### Ny fare
1. Legg typen til i `HazardKind` og `HAZARDS` (`data/hazards.ts`).
2. Tegn den i `buildHazard()` (`gfx/env/hazards.ts`).
3. Lag dødsmåten i `Hazard.kill()` og eventuelt syklusen i `Hazard.update()` (`game/hazards.ts`). `armed` sier om den dreper fiender akkurat nå, `bites` om den skader en helt, og `killsAll` om den dreper fiender som står oppreist (ellers bare dem som er slått ned eller kastet).

### Nytt ridedyr
1. Tegn dyret som en `BeastDef` i `gfx/chars/beasts.ts` (kropp, hode, hale, bein, ledd, sal).
2. Legg til en `MountDef` i `data/mounts.ts` med `attack: 'charge' | 'tail' | 'fire'`.
3. Bruk det i `riders` på et brett. Nytt angrep: legg til en tilstand i `Mount.update()` (`game/mounts.ts`). Angrepet koster utholdenhet (`STAMINA`), ikke liv.

### Nytt kjæledyr
1. Tegn det i `ART` i `gfx/pets.ts`.
2. Legg til en `PetDef` i `data/pets.ts` (evne, nedkjøling, flyr eller går).
3. Legg det i `SHOP` (`data/progress.ts`) med `kind: 'pet'`. Ny evne: legg den til i `Pet.ability()`.

### Ny butikkvare
Legg en `ShopItem` i `SHOP` (`data/progress.ts`). Nye typer (`ShopKind`) trenger en linje i `buy()` og `stock()` i `app/camp.ts`.

### Ny kartnode
Legg til en `MapNode` i `data/worldmap.ts` (posisjon, krav, belønning) og en kant i `MAP_EDGES`. Arena-noder peker på en duellant. Alle nodene i `requires` må være klart før noden åpner. Hovedveien står i `MAIN_ROUTE`, der en liste inni lista er brett som kan tas i valgfri rekkefølge (sumpen og frosten), og `stageName()` gir brettnummeret ut fra rekkefølgen brettene ble klart i (`save.completed`). Kartet og `StageScene` bruker det, og `name` i `LevelDef` er bare reserven. Kartografen melder bare steder som faktisk ble åpnet. Test: `tools/tests/route.mjs`.

### Ny duellant
Legg til en `DuelistDef` i `data/duelists.ts`. `char: '@player'` gir en ond tvilling av spillerens helt. `after` gir replikker etter seieren når duellen er finalen på et brett (`finale: { type: 'duel' }`).

### Ny del i heltebyggeren
Malte deler: legg inn bildet under støttet delnavn i `public/assets/manifest.json`, og legg et valg med stabil `id`, `source`, `slot` og `label` i `src/data/hero-parts.ts`. Våpen må angi indeks i `WEAPONS`, overkropper kroppstype, og låste deler en eksisterende opplåsingsnøkkel. Se `HERO_FORGE_GRAFIKK.md` for kunstkrav og kontrollverktøy før grunnpakken utvides.

`HeroConfig.parts` lagrer seks uavhengige del-ID-er. `withHeroParts()` holder kroppstype og våpenegenskaper i takt med kunsten; `buildHeroDef()` bruker samme arving per del i forhåndsvisning, kamp, duell og portrett. Bakhår følger hodets kilde. Uten `parts` brukes CLASSIC BUILDER. Katalogen importerer ikke Three.js, og menyen tilbyr bare bilder som faktisk er lastet. Endringer kopieres dypt, så avbryt og spillerbytte ikke endrer lagrede helter.

For et nytt valg i den klassiske byggeren:
1. Legg navnet til i riktig liste i `HERO_OPTIONS` (`gfx/chars/hero.ts`).
2. Tegn varianten i tilsvarende funksjon (`helmet`, `beard`, `torsoPart` osv., eller i `muscle.ts`).
3. Skal den låses opp? Legg den i `PART_LOCKS` og som `reward.unlock` på en kartnode, og gjerne i `SHOP`.

### Ny metal-låt
Legg en `track({...})` i `METAL_TRACKS` (`core/metal.ts`). Første riffnote er tonika: dirigenten legger broen, første slag og innslagene i tonearten ut fra den og `scale`. Riffet skrives som tekst med ett tegn per sekstendedel (`riff(start, 'e-eee-eee-eee-ee', R)`: liten bokstav er palm mute, stor er åpen akkord, `-` holder, `.` er pause). Melodien skrives som `melody(start, 'E5:4 G5:2^2 B5:8/D6')` (lengde i sekstendeler, `^n` bend, `/X` egen andrestemme, `/-` ingen). `twin` gir tvillinggitar i terser ut fra `scale`, og soloen i METAL MODE bruker skalaen og grunntonene i riffet. Sett `music` i LevelDef til låtnavnet. Finnes ikke navnet i 8-bit-låtene, brukes `CHIP_FALLBACK` i `audio.ts`. Sjekk med `tools/tests/metal.mjs` (WAV, spektrogram, nivå og klipping).

### Ny grafikk fra ChatGPT
Se `docs/ART_PROMPTS.md`. Filene legges i `public/assets/`, og `manifest.json` sier hvilken figur og del de tilhører.

### Ny tekstur som kan byttes med et bilde
Pakk teksturkallet i `texFile(navn, () => prosedyretekstur)` fra `env/common.ts`, og før opp navnet og en prompt i teksturlista i `docs/ART_PROMPTS.md`. Finnes navnet under `textures` i manifestet, lager `imageTexture()` (i `env/textures.ts`) tekstur og normalkart fra bildet. Valg: `fringe` gir ujevn gjennomsiktig kant øverst og nederst (veier), `glow` lager glødekart av de lyse oransje partiene (lava), og `tint` lar fargen fra kallstedet tone bildet (ellers vises bildet i egne farger). Teksturene hentes fra en felles cache, og hvert kall får en kopi med egen `repeat` som deler bildedata og GPU-tekstur med originalen.

## Lyd: lydbank, dukking og stemning

Alle lyder går gjennom `core/audio.ts`. Metodene (`swish`, `hit`, `splat`, `bones`, `thud`, `gong`, `coin`, `thunder` og de andre) er syntetisert, og `rec()` legger innspilte CC0-lyder fra lydbanken oppå når filen er lastet. Synthen blir da liggende under på 20 til 40 prosent. Til en fil er klar, når den feiler, når RECORDED SOUNDS er av, og alltid i enkeltfil-bygget og fra `file://` (der virker ikke fetch), spiller synthen alene. Lyn skal bruke `thunder(styrke, avstand)`, ikke `boom()`, som er eksplosjoner. På FAMILY hoppes gørr, knas, riving og stikk over (merket med `true` i `rec()`-listene).

- `core/soundbank.ts` er Morbidiums Lydbank som TypeScript-modul. Den pakker ut filene i bakgrunnen (effektene først, så slagverket og til slutt stemningen), velger en tilfeldig variant uten å gjenta den forrige, spiller høyst fem per gruppe på 80 ms og måler stillheten foran i hver MP3.
- Filene ligger i `public/assets/sound/` med `sound.json` (utdrag av Morbidiums `lyd.json`, samme feltnavn: `gruppe`, `type`, `sloyfe`, `rot`) og `KILDER.md` (tittel, innspiller og lenke per fil). Gruppen er filnavnet uten `_2`, `_3` osv.
- Dukking: `audio.duck(mengde, sekunder, tid)` senker musikken under store smell (tunge slag, eksplosjoner, torden, gong, tunge fiender som lander og fanfarene). `audio.setPaused()` demper den mens spillet står på pause (kalles fra `Game.tick`). I METAL MODE dukker den bare litt.
- Stemning: `audio.ambience(biom)` fra `Stage` og `Duel` (`'arena'`), og `null` i `dispose()`. Lagene per biom står i `AMBIENCE` i `core/ambience.ts`, og enkeltlydene (kråke, ugle, frosk, og ulv, vindkast og isknak i frosten) i `AMB_EVENTS`. `campfire()` og `brazier()` legger ilden i `Env.fires`, `waterfall()` legger fossen i `Env.waters`, og `Stage` sender avstanden til nærmeste bål og foss med `audio.ambienceTick(dt, bål, panorering, foss, panorering)`. Lydene med sted står i `NEAR` i ambience.ts.
- Fottrinn: `Fighter` spiller `audio.step()` to ganger per gangsyklus for heltene og kjempene. Underlaget (`audio.surface`: gress, stein, vann eller sno) settes av `Stage` per biom og av `Duel` per arena, og lyden er `fot_<underlag>` i lydbanken. Kjempene får et dunk under og rister skjermen. `gore.stepDust` gir snø rundt foten (frosten).
- Kjempene: `audio.warHorn()` og `audio.roar(størrelse, forsinkelse)` når en fiende med `poise` kommer inn. `iceCrack()` i råka, `clang()` (sverdklang) på blokkerte slag, `crowd()` med publikum i arenaen, og trollene brøler når de skriker.
- Replikker: `audio.voice(tekst, panorering, alt)` spiller en innlest replikk hvis lydbanken har `voiceId(tekst)` (v_ og teksten med små bokstaver og understreker). Den kalles fra `HUD.announce`, `HUD.say`, snakkeboblene i `FX.text` og mellomscenene, så en ny replikk trenger ingen kode, bare fila. `alt` er en egen versjon (`_f` for heltinnene). Manus, stemmebeskrivelser og filnavn: `docs/STEMMER.md`.
- Fanfarer: `audio.streak(antall)` for drapsrekkene, `bossSlain()`, `knockout()` og `chainBroken()` (trist trombone når en rekke på 10 eller mer ryker fordi en helt blir truffet). De er data i `core/layers.ts`: syntlag (orgel, kor, klokker, torden, applaus), slagverk (VCSL-opptaket eller syntlag som reserve) og kraftakkorder på en egen `MetalBand` på effektbussen.

### Ny lyd fra lydbanken
1. Finn en CC0-lyd på Freesound og legg raden i `FREESOUND` i `tools/make_sounds.py` (navn, id, bruker, tittel), med klipp og nivå i `OPT` om den trenger det.
2. Kjør `python3 tools/make_sounds.py --bare <navn>`. Verktøyet sjekker CC0-lisensen på lydens egen side, klipper, normaliserer, koder MP3 i `public/assets/sound/` og skriver `sound.json` og `KILDER.md`. De andre lydene blir liggende som de er. Krever numpy og imageio-ffmpeg.
3. Bruk gruppen i en lydmetode med `this.rec([[gruppe, nivå, tonehøyde, gørr]], synthnivå)`, eller i `AMBIENCE` for en stemningssløyfe. Sjekk med `tools/tests/soundbank.mjs` og `tools/tests/frostsound.mjs`.

### Ny innlest replikk
Lag stemmen i VoiceStudio etter `docs/STEMMER.md`, legg WAV-fila i `voice/inbox/` med navnet fra manuset og kjør `python3 tools/make_sounds.py --stemmer`. Replikken spilles når teksten vises.

## Musikk: dirigenten

`core/conductor.ts` spiller musikken i takt, inspirert av iMUSE (LucasArts) og tilpasset fra Morbidium (`src/06_musikk.js`). Dirigenten planlegger 0,12 sekunder fram på lydklokka (setInterval i `AudioEngine.schedule`, etter Chris Wilsons «A Tale of Two Clocks») og spiller gjennom en `Performer`: `BandPerformer` for metalbandet, og 8-bit-synthen i `AudioEngine`. LL har 16 steg (sekstendeler) i takta. Spillet går på spilltid som før; det er bare lyden som venter på slaget.

- `audio.play(låt)`: med en gang, for menyene og brettstart. Det som klinger fra forrige låt, kveles (`MetalBand.choke`).
- `audio.queue(låt, 'bar' | 'beat')`: på neste taktstrek (minst ett helt slag fram) eller neste slag. Det siste slaget er en bro: tammevirvel, kvintakkord på dominanten i den nye tonearten, og bassen går opp mot den nye grunntonen. Et bekken svulmer (VCSL `ins_bekken_1` når det er lastet, ellers en baklengs crash i synth) til toppen treffer første slag, der stortromme, crash, en stor akkord og en pauke lander. Duellen bruker queue, så frost og menyene glir over i duellåta.
- `audio.intensity(0 til 3)` settes hvert bilde fra `Stage.update` (0 rolig mellom bølgene, 1 kamp, 2 hete med mange fiender, en rytter eller en helt under 30 prosent, 3 sjef) og fra `Duel.update`. Lagene går opp på neste slag og ned på neste taktstrek, og brettet venter 2,5 sekunder spilltid før det går ned. `MetalBand` har egne busser for rytmegitarene, leadgitaren, bassen og trommene, og et ekstralag med dobbel stortromme og crash på hver takt (hete) og kor og pauker (sjef). Nivåene står i `MIX` i `metal.ts`. Tempoet øker 2 og 4 prosent ved hete og sjef.
- `audio.metalMode(på)`: inn på neste slag (crash, skrik og tremolo fram til taktstreken), soloen starter på taktstreken, og ut på neste taktstrek.
- Sjefen: `audio.bossArrives(låt)` legger byttet på en taktstrek minst 1,4 sekunder fram, så stupingen lander på første slag med gong og stor akkord, og intensiteten går til 3. `audio.bossDefeated()` gir en kort avslutning fra neste slag og så seiersmusikken. `audio.defeat()` (game over og tapt duell) toner musikken ut og spiller tapslyden i tonearten.
- Innslag på neste slag og i tonearten: `waveCleared()`, `levelUp()`, `fight()`, `knockout()` og `stinger()`. Uten musikk som går, spilles de med en gang som før.
- Etter en pause i fanen hopper dirigenten fram i hele steg, så takten og et bytte som venter, står.
- `audio.conductor.events` og `stats` er til testene. `tools/tests/imuse.mjs` rendrer dirigenten med en simulert klokke i en OfflineAudioContext og sjekker også spillet med den ekte lydklokka.

Ny 8-bit-låt: legg `scale` (tonehøydeklassene) i `TRACKS` i `audio.ts`. Grunntonene regnes ut fra bassen.

### Ekte instrumenter i bandet

`MetalBand.samples` (en `SampleSource`, satt av `AudioEngine`) gir opptak fra lydbanken: `pick(gruppe, midi, v?)` velger opptaket nærmest tonen og regner ut avspillingsfarten (varianter med samme tone velges tilfeldig, eller variant nummer v), og `full(gruppe)` sier om hele gruppen er lastet. Bandet lager kildene selv i sin egen kontekst, så det virker også i OfflineAudioContext (testene). Gruppene er `ins_stortromme`, `ins_skarp` (rimshot), `ins_hihat`, `ins_crash`, `ins_tam` (trommene bytter først når hele settet er lastet), `ins_elgitar` (Emilyguitar: en Epiphone med humbuckere tatt opp direkte, hver tredje halvtone, tre varianter i rytmeregisteret og to i leadregisteret, hele tonen på 4,2 s) og `ins_gitardemp` (dempede strenger til palm mute), og `ins_bass`. Leadgitaren får vibrato og bend på `detune`. Uten opptak (RECORDED SOUNDS av, enkeltfil-bygget, før lasting) spiller bandet synth som før.

Opptakene har sin egen lyd, ellers drukner de i det synthen gjør:
- Gitarene går i en egen forsterkermodell (`src/core/guitaramp.ts`, innstillingene i `REAL_AMP`): Tube Screamer foran (høypass som strammer bunnen og midtløft ved 800 Hz), to rørtrinn med skjev tanh (like overtoner som et rør) og en koblingskondensator imellom, tonestakk, effekttrinn med dunk og nærvær, og et 4x12-kabinett som impulsrespons. Kabinettet er det som gjør at forvrengning låter som en ekte gitar og ikke som en synth: `cabinetIR()` regner ut en minimumsfase-respons fra kurven til en Celestion Vintage 30 med SM57 (`CAB`, topper ved 2,5 og 4 kHz, -12 dB ved 8 kHz, nesten ingenting over 12 kHz) med små faste topper og søkk i mellomtonen, så den trenger ingen fil og ingen lisens. Synthen beholder sin enkle forsterker (`AMPS`).
- Rytmegitarene spilles som en gitarist (`realChord`): strengene slås an fra den dype og opp (6 ms mellom strengene på åpne akkorder, 2 ms på palm mute), venstre og høyre gitar er hvert sitt opptak (variant v og v + 1) med opptil 8 ms ulik timing og litt ulik styrke og stemming, som to innspillinger. Palm mute har et lavpass som lukker seg fra 1,5 kHz til 450 Hz på 50 ms (håndflaten demper diskanten) og dempede strenger under. `REAL` er hvor hardt opptakene går inn.
- Bassen har sin egen kjede (`BASS_R`): ren bunn under 200 Hz og knurr med plekteret over 160 Hz, blandet. Grunntonen på de dypeste basstonene er svak i opptaket, som på en ekte bass, så øret hører tonen gjennom overtonene.
- Trommene går gjennom EQ og panorering per slag (`KIT` og `drum()`): klikk fra køllen og mindre boks på stortromma, smell på skarptromma, anslag på tammene, rumlingen vekk fra bekkenene og den skarpe ringen på 546 Hz vekk fra crashen. Hi-hat og de små tammene til høyre sett fra publikum, virvlene går mot venstre, og crashen veksler mellom to sider. Trommene ligger med vilje 4 til 6 dB over synthtrommene (i de første opptakene lå de 12 dB under gitarene og druknet).

Nivåene er målt som hørbar lydstyrke, ikke rå RMS: K-vekting (som LUFS) og "mobil" (K pluss høypass 150 Hz og lavpass 9 kHz). Synthbassen og synthstortromma legger mye energi under 60 Hz som små høyttalere ikke spiller, så rå RMS får synthen til å se sterkere ut enn den høres. `tools/tests/mix.mjs` måler hvert instrument alene med synth og med opptak, og `tools/tests/metal.mjs ... both drums` (eller guitar, bass, lead) rendrer ett instrument alene i en låt til lytteprøver. `tools/tests/instruments.mjs` sjekker lasting, tonehøyde, ren låt, samme nivå som synthen, at trommene høres minst 3 dB bedre enn synthtrommene på små høyttalere, at gitarene svarer på anslaget (0,9 mot 0,3 gir minst 5 dB til sammen for akkord og leadtone, synthen under 2), at venstre og høyre rytmegitar får ulike opptak, kurven til kabinettet, og at el-gitaren har mindre sus over 10 kHz enn synthen. Opptakene lages av `tools/make_sounds.py` (KARORYFER), som måler tonehøyden i hvert opptak.

## Oppstartslogo

`ui/splash.ts` viser først "PRESS ANY KEY" (nettleseren gir ikke lyd før brukeren har trykket), så faller logoen ned med trommevirvel, solstråler, konfetti og fanfare (`audio.fanfare()`). Den hoppes over i automatiske tester (`navigator.webdriver`) og med `?nosplash`. `?splash` tvinger den frem. Originalbildet ligger i `art/studio/`, og en komprimert versjon i `src/assets/studio-logo.webp` bygges inn i spillet.

## Testing

GitHub Actions (`.github/workflows/pages.yml`) kjører typecheck og bygg på hver push og pull request, og publiserer `dist/` til GitHub Pages fra main når Pages er slått på i repoet (ellers hoppes publiseringen over med en melding).

`tools/tests/` har Playwright-skript som styrer spillet via `window.__game` og `window.__lib` med faste tidssteg (`game.tick(1/60, false)`), tar skjermbilder og samler konsollfeil. Se `tools/tests/README.md`, og skillen `game-tests` i `.claude/skills/` for fellene i SwiftShader.
