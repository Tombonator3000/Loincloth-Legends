// Oppstart: last valgfri PNG-grafikk (public/assets/manifest.json), start så spillet.
import './style.css';
import { Game } from './app/game';
import { loadAssets } from './gfx/assets';
import { installDebug } from './app/debug';
import { LAYOUTS } from './data/layouts';
import { layoutPropIds } from './data/layout';

/**
 * Kulissebildene brettfilene bruker. Resten av kulissene i manifestet hentes først når editoren åpnes, så en spiller
 * slipper å laste ned hele biblioteket. Med ?editor i adressen hentes alt med en gang.
 */
function propsToLoad(): ((id: string) => boolean) | undefined {
  try {
    if (new URLSearchParams(location.search).has('editor')) return undefined;
  } catch {
    /* ingen adresse, last det brettene bruker */
  }
  const used = new Set(Object.values(LAYOUTS).flatMap(layoutPropIds));
  return (id) => used.has(id);
}

async function boot() {
  const boot = document.getElementById('boot');
  try {
    // Vent til hele kunstpakken er klar. Med mange figurdeler ville firesekunders-
    // grensen gi en blanding av PNG og reservegrafikk på tregere forbindelser.
    await loadAssets(undefined, propsToLoad());
  } catch {
    /* ingen assets, bruk prosedyregrafikk */
  }
  try {
    (window as unknown as { __game: Game }).__game = new Game();
    installDebug();
  } catch (e) {
    if (boot) boot.textContent = 'WEBGL FAILED TO FLEX. TRY ANOTHER BROWSER.';
    console.error(e);
  }
}
boot();
