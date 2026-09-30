// Oppstart: last valgfri PNG-grafikk (public/assets/manifest.json), start så spillet.
import './style.css';
import { Game } from './app/game';
import { loadAssets } from './gfx/assets';
import { installDebug } from './app/debug';

async function boot() {
  const boot = document.getElementById('boot');
  try {
    // Vent til hele kunstpakken er klar. Med mange figurdeler ville firesekunders-
    // grensen gi en blanding av PNG og reservegrafikk på tregere forbindelser.
    await loadAssets();
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
