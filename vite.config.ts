import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "npm run build:single" lager en enkelt index.html med alt inlinet (for deling/Artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    // Lisensene til npm-pakkene i bygget (three.js), se også public/LICENSES/ og "Gjenbruk og takk" i README
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
    chunkSizeWarningLimit: 2000,
  },
}));
