// Oppstart: last valgfri PNG-grafikk (public/assets/manifest.json), start så spillet.
import './style.css';
import { Game } from './app/game';
import { loadAssets } from './gfx/assets';
import { installDebug } from './app/debug';

async function boot() {
  const boot = document.getElementById('boot');
  try {
    await Promise.race([loadAssets(), new Promise((r) => setTimeout(r, 4000))]);
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
