import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { stageForge } from './tools/vite-stage-forge.ts';

// "npm run build:single" lager en enkelt index.html med alt inlinet (for deling/Artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  // Brettverkstedet lagrer brettfiler og bilder gjennom dev-serveren (bare npm run dev, se tools/vite-stage-forge.ts)
  plugins: mode === 'single' ? [viteSingleFile()] : [stageForge()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    // Lisensene til npm-pakkene i bygget (three.js), se også public/LICENSES/ og "Gjenbruk og takk" i README
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
    chunkSizeWarningLimit: 2000,
  },
}));
