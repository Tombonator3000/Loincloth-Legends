# memory.md

Prosjektets hukommelse. Viktige fakta og beslutninger som må huskes mellom økter.

## Konsept
- Arbeidstittel: LOINCLOTH LEGENDS (Blood, Biceps & Bad Decisions)
- Blanding av Castle Crashers, Golden Axe og Barbarian (C64/Amiga)
- Sidescroller-brett (belt-scroller med dybde) med 1v1 dueller mellom brettene
- 80-talls fantasy-klisjeer, humor, over-the-top tegneserie-gore

## Beslutninger
- 2026-09-29: Motor er Three.js + TypeScript (valgt av Tom). Kjører i nettleser.
- 2026-09-29: Første leveranse er en spillbar prototype (vertikal slice).
- 2026-09-29: 1 spiller + 2 spillere lokalt. Opptil 4 kan komme senere.
- 2026-09-29: 3D-verden (lav-poly toon) + 2D cutout-figurer. Hver kroppsdel er et eget plan, slik at dismemberment er gratis.
- 2026-09-29: Figurene tegnes prosedyremessig på canvas inntil ekte grafikk finnes.
- 2026-09-29: Egne originale figurer. Ingen figurer eller navn lånt fra Castle Crashers, Golden Axe eller Barbarian.
- 2026-09-29: Duellen bruker Barbarian-logikk: retning + angrep, blokk må matche høyde, flying neck chop halshugger.
- 2026-09-29: Tekst i spillet på engelsk, dokumentasjon på norsk.

- 2026-09-29: Koden er modulær og datadrevet (data/ + register) så den kan tas inn i Claude Code. Se docs/ARCHITECTURE.md.
- 2026-09-29: Verdenskart med noder. Brett ender med sjef, eller duell i stedet for sjef (Frostbite Pass). Arena-dueller er valgfrie noder.
- 2026-09-29: Heltene lages i Hero Forge (mann eller dame, deler). Thrugg og Valkyra er presets.
- 2026-09-29: Grafikk fra ChatGPT (GPT-image) legges i public/assets/ og kobles via manifest.json. Delene tegnes vendt mot høyre, én del per bilde.
- 2026-09-29: To spillere i duell = tag team (bytter per runde).
- 2026-09-29: Studioet heter Tom's Happy Happy Funtimes Emporium. Oppstartslogoen bruker Toms eget bilde (art/studio/). Ikke endre logoen uten å bli bedt om det.
- 2026-09-29: Repo: https://github.com/Tombonator3000/Loincloth-Legends. Prosjektet skal videre i Claude Code derfra.
- 2026-09-29: Proporsjoner (v0.3): stort hode på liten kropp, altfor store muskler, bittesmå lendeklær. Damene får overdreven 80-talls-rustning og former, men er alltid fullt dekket og komiske, ikke seksualiserte.
- 2026-09-29: Gore-nivå har fire trinn, EXCESSIVE er standard. FAMILY bytter blod mot konfetti og gummiender.
- 2026-09-29: Teit vold er en del av sjangeren: imp sparker hodet i skjermen, armer ryker (JUST A FLESH WOUND), hodeløse fiender løper rundt.
- 2026-09-29: Gamepad følger standard mapping. I 2-spiller med én gamepad er gamepaden spiller 2. Berøring styrer alltid spiller 1.
- 2026-09-29: Progresjon: XP og nivåer per helt, STR/DEF/MAG/AGI, butikk og trening i hjemborgen (startnoden på kartet), fem kjæledyr.

## Tekniske notater
- Figurmaterialer bruker egen ShaderMaterial med `flash` og `tint` uniforms for treff-blink.
- Alpha-to-coverage + MSAA gir myke kanter på cutout-figurene uten sortering av transparens.
- Koordinater: X bortover, Y opp, Z mot kamera. Spillbeltet i brettene er Z fra -2.6 til 2.6.
- Duellen går på en linje (Z = +-0.12 for å unngå at delene fletter seg).
- Global hitstop og slowmo ligger i FX (src/gfx/fx.ts). Spilltid = sanntid x timeScale, 0 under hitstop.
- window.__game er eksponert for testing. game.tick(dt, false) simulerer uten rendering (brukes av Playwright-testene).
- Input: tastetrykk som slippes før neste frame fanges via InputManager.tapped.
- CPU i duellen: ferdighet øker per runde. Runde 1 er bevisst litt treg.
- Figur-id for helter: `hero<slot>:<nøkkel>` der nøkkelen er valgene. Forhåndsvisning i Hero Forge bruker slot 9/10, ond tvilling slot 7.
- CharDef.inherit lar en figur hente PNG-deler fra en annen (hogmother bruker hogman sine armer/bein/hofte).
- Sjefer: Fighter.armored + onArmorHit gir stagger. Scener byttes med Game.setScene(), som tømmer 3D-scenen og gore.
- Lagring: localStorage-nøkkel `loincloth-legends-save-v1`, alt i try/catch.
- Sjefens død: slowmo og 4,5 s spilltid før belønningen. Tester må vente på `screens.active`, ikke på et fast antall sekunder.
- Pikselfonten (Press Start 2P) mangler Æ Ø Å. Bruk ord uten dem i UI-tekst som vises med den fonten.
- Artifact: versjon 3 publisert 2026-09-29 fra dist-single via tools/artifact.py (samme URL som versjon 1 og 2).
- Innstillinger lagres i `loincloth-legends-settings-v1`, separat fra fremgangen (`src/core/settings.ts`). `onSettings` varsler Game.
- Alt som påvirker spillet skal bruke spilltid (dt), ikke setTimeout. Hodeskallens fornærmelse var en felle her.
- `window.__lib` (src/app/debug.ts) gir testene tilgang til Fighter, W, buildHeroDef, defaultSave, settings osv.
- Oppstartslogoen hoppes over når `navigator.webdriver` er satt (Playwright). `?splash` tvinger den frem, `?nosplash` hopper over.
- Menyene ignorerer "trykk hvor som helst" de første 350 ms etter at en skjerm vises, og klikk på menyvalg de første 150 ms.
- Hodet på skjermen tegnes på et eget canvas (`fx-glass`) i full oppløsning over 3D-bildet.
- PNG-høyder for heltedelene er egne for thrugg/valkyra (HERO_H i gfx/assets.ts) fordi proporsjonene er endret.
- Playwright er ikke en avhengighet i package.json. Installer det separat (`npm i -D playwright`) før testene kjøres.
