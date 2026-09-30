---
name: stage-forge
description: Lag, endre og sjekk brett i Loincloth Legends med brettverkstedet STAGE FORGE eller brettfilene i src/data/layouts. Bruk når Tom vil legge til, flytte eller fjerne kulisser (stolper, telt, palisade, trær rett foran kameraet), lage rader, slå av generert pynt, flytte bølger, tønner og farer, eller animere kulisser (sway, swing, bob, spin, flicker, sheet, track). Level editor, layout JSON, props, layers, parallax.
---

# STAGE FORGE: brett og kulisser

Et brett bygges i tre lag:
1. Miljøbyggeren for biomet (`src/gfx/env/<biom>.ts`) lager bakke, vei, himmel og generert pynt med faste frø. Pynten er delt i generatorer som kan slås av per brett.
2. Brettfila `src/data/layouts/<brett>.json` legger malte kulisser og 3D-rekvisitter oppå, og kan overstyre lengden, bølgene, tønnene, farene og rytterne i `src/data/levels.ts`.
3. Spillet (`src/game/stage.ts`) bruker `levelWithLayout(LEVELS[id], layoutFor(id))`. Kulissene tegnes av `src/gfx/scenery.ts`.

Mer om oppbyggingen: `docs/STAGE_FORGE.md` og `docs/ARCHITECTURE.md`.

## To måter å jobbe på
- **Editoren** (Tom): `npm run dev` og `http://localhost:5173/?editor=road` (eller STAGE FORGE på tittelskjermen, bare under dev). SAVE skriver brettfila rett i repoet gjennom `tools/vite-stage-forge.ts`. Uten dev-serveren lastes fila ned i stedet. H eller F1 viser tastene.
- **Rett i JSON** (agenter): rediger brettfila og hold formatet til `layoutToJson` i `src/data/layout.ts` (fast rekkefølge på feltene, én kulisse per linje). Åpne brettet i editoren og se WARNINGS, eller kjør `validateLayout` i en test.

## Lagene
z er dybden. Kamplinja er z = 0, og figurene går mellom z = -2,6 og 2,6.

| Lag | z | Standard | Til |
|---|---|---|---|
| FAR | -120 til -40 | -60 | Fjell, borger, silhuetter langt unna |
| BACK | -40 til -4 | -7,5 | Palisade, telt, bannere, trær bak veien |
| MID | -4 til 4 | -3,4 | Stolper, skilt og vogner ved veikanten |
| FRONT | 3 til 9,5 | 7 | Stammer og busker rett foran kameraet |

- MID-kulisser skal ikke stå i kamplinja (editoren varsler).
- FRONT gir dybde, men skal ikke skjule kampen: høyst en tredjedel av bildet der kameraet låses for en bølge (editoren varsler). FRONT har `fade: true` (tones til 40 prosent når en figur står bak) og `dark: 0.35` som standard.
- Parallakse: en faktor p svarer til z = 11,4 · (1 - 1/p). Brettfila lagrer z.

## Brettfila
```json
{
  "version": 1,
  "level": "road",
  "generators": {"stakeWall":false,"tents":false},
  "props": [
    {"id":"p1","prop":"roadpost","layer":"mid","x":7,"z":-3.3},
    {"id":"p10","prop":"tree_front_oak","layer":"front","x":43,"z":7.2}
  ],
  "runs": [
    {"id":"row1","prop":"palisade_a","layer":"back","x0":4,"x1":110,"z":-7.2,"step":3.05,"jitter":0.06,"flipRandom":true,"gaps":[[30,38],[70,76]]}
  ]
}
```
- `prop` er en id fra katalogen (`src/gfx/props/catalog.ts`) eller fra `props` i `public/assets/manifest.json`. `id` må være unik i fila.
- Valgfritt per kulisse: `y`, `scale`, `flip`, `rot` (helning), `yaw` (vridning), `tint`, `anim`, `fade`, `dark`, `shadow`, `locked`.
- En rad (`runs`) legger ut samme kulisse fra `x0` til `x1` med `step`, og kan ha `jitter`, `zJitter`, `scaleJitter`, `flipRandom`, `gaps` og eget `seed`. Den blir lik hver gang.
- `seed` styrer den genererte pynten. Et nytt frø flytter trær, steiner og gress. Ikke endre det uten at Tom ber om det.
- `waves`, `barrels`, `hazards`, `riders` og `length` kommer inn i brettfila først når de endres i editoren. Bølger skrives som i levels.ts: `{"at":14,"maxAlive":3,"spawns":"skeleton:R:0.2 hogman:L:1.0"}`.
- En ny brettfil trenger ingen registrering (`import.meta.glob` i `src/data/layouts/index.ts`).

## Generatorer per biom
Slås av med `"generators": {"<nøkkel>": false}`.
- grass: castle, keep, stakeWall, forest, meadow, leaves, fog, rays, skullPikes, tents, campfires, banners, rocks, arrows, stains, silhouettes
- swamp: forest, meadow, water, mushrooms, hut, ruins, rocks, skullPikes, stains, fog, silhouettes
- frost: cliffs, forest, meadow, braziers, banners, runeStones, crystals, frozen, watchtower, ropeFences, rocks, skullPikes, stains, fog, silhouettes
- scorch: volcano, lavaRiver, spikes, forest, rocks, skullPikes, stains, fog, silhouettes
- night: forest, meadow, tents, stars, rocks, skullPikes, fog, silhouettes
- tower: cages, rays, stains, fog, silhouettes

Ny pyntblokk i en miljøbygger: pakk den i `if (gen(o, 'nøkkel')) { ... }` (`src/gfx/env/common.ts`). `gen` gir blokken sitt eget frø, så pynten i de andre blokkene står stille. Legg nøkkelen og en engelsk tekst inn i `GEN_LABELS` i `src/app/scenes/editor.ts`. Bruk `random()`, `rand()` og `pick()` fra `core/math`, aldri `Math.random()`, i byggekoden.

## Animasjoner
En liste i `anim`, på kulissen i brettfila eller i katalogen og manifestet:
- `sway` (vind, sterkest øverst): `amount`, `speed`
- `swing` (skilt i kjetting): `amount` i grader, `speed`, `pivot` [u, v]
- `bob` (opp og ned): `amount` i meter, `speed`
- `spin`: `speed` i omdreininger per sekund, `pivot`
- `flicker` (lys): `amount`, `speed`, og med `light` en punktlampe med `intensity`, `range` og `at` [u, v]
- `sheet` (bildeserie): `n`, `grid` [kolonner, rader], `fps`, `mode` (`loop`, `pingpong` eller `once`)
- `track` (nøkler over tid, etter POSER i Morbidium): `dur`, `loop`, og `keys` per kanal (x, y, rot, sx, sy, alpha) som `[[t, verdi], ...]` med t fra 0 til 1 og myk overgang imellom

Alt går på spilltid (dt), så pause og slowmo virker. u og v regnes fra øvre venstre hjørne av bildet.

## Sjekk før du sier deg ferdig
1. `npm run typecheck` og `npm run build`.
2. `node tools/tests/editor.mjs http://localhost:4173/ ./shots` (se skillen `game-tests` for oppsettet).
3. Et skjermbilde av brettet du faktisk ser på: `node tools/tests/looks.mjs http://localhost:4173/ ./shots road`.
4. Har du endret en miljøbygger: samme frø skal gi samme bilde to ganger på rad.
5. Logg i `log.md`.
