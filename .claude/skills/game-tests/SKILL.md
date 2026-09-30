---
name: game-tests
description: Kjør og skriv Playwright-tester for Loincloth Legends i headless Chromium med SwiftShader, med preview-server, window.__game og window.__lib, faste tidssteg, skjermbilder og pikseltester. Bruk før du sier deg ferdig med en endring i spillet, når en test henger eller er treg, og når en test gir svar som ikke stemmer med det du ser.
---

# Tester i nettleseren

## Oppsett
```bash
npm run build && (npx vite preview --port 4173 &)
node tools/tests/<test>.mjs http://localhost:4173/ [./shots]
```
- Kjør skriptene fra repoet. Fra en annen mappe finner ikke Node `playwright`.
- Lista over testene og hva de dekker: `tools/tests/README.md`. Velg testene som dekker det du har endret.
- Dev-serveren (`npm run dev`, port 5173) trengs bare for `forge-save.mjs`, som tester lagringen fra brettverkstedet og setter filene tilbake etterpå.

## Slik styres spillet
- `window.__game` er spillet og `window.__lib` modulene (`src/app/debug.ts`). Legg inn det en ny test trenger der.
- Slå av spillets egen løkke med `window.requestAnimationFrame = () => 0`, og gå fram med `__game.tick(1/60, false)` i en løkke inne i én `page.evaluate`.
- `?nosplash` hopper over logoen. `?editor=<brett>` åpner brettverkstedet.
- Menyene er `li[data-i]` med `.lbl`. De overser trykk rett etter at de åpnet, så vent litt i sanntid før du klikker.

## Farten i SwiftShader
- Ett tegnet bilde av et brett tar rundt 10 sekunder, og det første skjermbildet 40 til 50 sekunder fordi skyggeleggerne kompileres.
- Tegn bare før skjermbilder: én `tick(1/60, true)` og så `page.screenshot`. Tegner testen i hver tick, hoper arbeidet seg opp i GPU-prosessen, og det ser ut som testen henger.
- Sett `page.setDefaultTimeout(300000)` i tester med skjermbilder.
- Send utdata til en fil. Med `timeout ... | tail` forsvinner alt hvis testen blir drept.

## Feller vi har gått i
- `Gore.clear()` dreper partikler som er sendt ut før neste bilde. Send ut etter `clear()` og kjør én tick (se `particles.mjs`).
- Pikseltester trenger en negativ kontroll (samme bilde uten effekten), ellers teller de kanskje noe annet.
- Et plan som bare tegnes fra forsiden (FrontSide), forsvinner når det speilvendes. Blodråpene var usynlige av den grunn. Sjekk retningen før du leter andre steder.
- Pynten i brettene bygges med faste frø (`withSeed` i `core/math`), så to skjermbilder av samme brett kan sammenlignes. Resten av spillet er tilfeldig, så lås det du måler (samme helt, samme fiende, samme posisjon).
- Et skjermbilde er bevis først når du har sett på det. Les bildet før du skriver at noe ser riktig ut.

## Før du sier deg ferdig
`npm run typecheck`, `npm run build`, testene for det du har endret, og skjermbilder du har sett på. Skriv i `log.md` hvilke tester som ble kjørt og hva de viste.
