// Kreditering leses inn i JavaScript-bygget, slik at også én HTML-fil har navnene og lisenstekstene offline.
// Kildene er README.md, de bevarte MIT-tekstene og lydverktøyets KILDER.md. Ikke dupliser lydlista manuelt.
import soundSources from '../../public/assets/sound/KILDER.md?raw';
import threeLicense from '../../node_modules/three/LICENSE?raw';
import meadowLicense from '../../public/LICENSES/Threejs-Awesome-Graphics-Agent-Skills.txt?raw';
import sceneLicense from '../../public/LICENSES/stylized-scene.txt?raw';
import hashLicense from '../../public/LICENSES/hash-without-sine.txt?raw';

export interface CreditEntry {
  name: string;
  detail: string;
  url?: string;
}
export interface CreditPage {
  title: string;
  entries?: CreditEntry[];
  text?: string;
}
export interface CreditSection {
  id: string;
  title: string;
  pages: CreditPage[];
}
export interface SoundCredit {
  file: string;
  title: string;
  creator: string;
  url: string;
}

/** De tre tabellene i den genererte kildelista har ulikt antall kolonner. */
function readSoundCredits(source: string): SoundCredit[] {
  let group = '';
  const rows: SoundCredit[] = [];
  for (const line of source.split('\n')) {
    if (line.startsWith('## ')) group = line;
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map(s => s.trim());
    const file = cells[0].replace(/`/g, '');
    if (group.includes('Freesound') && cells.length === 4) rows.push({ file, title: cells[1], creator: cells[2], url: cells[3] });
    else if (group.includes('VCSL') && cells.length === 2) rows.push({ file, title: cells[1], creator: 'Versilian Studios · VCSL', url: 'https://github.com/sgossner/VCSL' });
    else if (group.includes('Karoryfer') && cells.length === 3) rows.push({ file, title: cells[1], creator: 'Karoryfer Lecolds', url: cells[2] });
  }
  return rows;
}
export const SOUND_CREDITS = readSoundCredits(soundSources);

const soundPages: CreditPage[] = [];
for (let i = 0; i < SOUND_CREDITS.length; i += 4) {
  soundPages.push({
    title: `Recording sources ${i + 1}–${Math.min(i + 4, SOUND_CREDITS.length)} of ${SOUND_CREDITS.length}`,
    entries: SOUND_CREDITS.slice(i, i + 4).map(s => ({ name: s.title, detail: `${s.creator} · CC0 1.0 · ${s.file}`, url: s.url })),
  });
}

export const CREDITS: CreditSection[] = [
  {
    id: 'studio', title: 'STUDIO', pages: [{ title: 'Blood, biceps & the people behind them', entries: [
      { name: "Tom's Happy Happy Funtimes Emporium", detail: 'An original game by Tom. Studio identity, creative direction and the thoroughly questionable decisions.' },
      { name: 'Loincloth Legends', detail: 'Original characters, world and painted character parts. The studio logo belongs to Tom\'s Happy Happy Funtimes Emporium.', url: 'https://github.com/Tombonator3000/Loincloth-Legends' },
      { name: 'Art production', detail: 'Painted character parts, props and textures made with ChatGPT, following Tom\'s art direction. Procedural artwork provides the fallback.' },
    ] }],
  },
  {
    id: 'code', title: 'CODE & THANKS', pages: [
      { title: 'Engine, graphics & algorithms', entries: [
        { name: 'three.js authors', detail: '3D engine, Sky and tone mapping. MIT license.', url: 'https://threejs.org/' },
        { name: 'Scott Sun · Andre Elias', detail: 'Meadow grass and wind adapted from Threejs-Awesome-Graphics-Agent-Skills and stylized-scene. MIT licenses.' },
        { name: 'Dave Hoskins', detail: 'Hash without Sine. MIT license.', url: 'https://www.shadertoy.com/view/4djSRW' },
        { name: 'Ben Golus · Felzenszwalb & Huttenlocher · mulberry32', detail: 'Whiteout normal blending, distance-field technique and seeded random numbers.' },
      ] },
      { title: 'Tom\'s project library', entries: [
        { name: 'Morbidium', detail: 'Art tools, enemy variation, animation patterns, adaptive music, sound bank, ambience, fanfares, screen effects and automatic quality. Hero appearance layers also use its approach as a conceptual reference.', url: 'https://github.com/Tombonator3000/morbidium' },
        { name: 'The Deep Ones', detail: 'Stage editor workflow, brown-noise ambience and frame-time measurement.', url: 'https://github.com/Tombonator3000/the-deep-ones' },
        { name: 'Geometry 3044 · connect-play', detail: 'Synthetic sound-layer and electric-zap foundations; snapshot undo/redo workflow.' },
      ] },
      { title: 'Music ideas & typography', entries: [
        { name: 'Michael Land & Peter McConnell · LucasArts', detail: 'The adaptive music design is inspired by iMUSE. No music or code was taken from it.' },
        { name: 'Chris Wilson', detail: 'Audio scheduling follows A Tale of Two Clocks.' },
        { name: 'Google Fonts contributors', detail: 'Metal Mania, Press Start 2P and VT323. SIL Open Font License 1.1. Web fonts load when available; system fonts remain available offline.', url: 'https://openfontlicense.org/' },
      ] },
    ],
  },
  {
    id: 'sound', title: 'SOUND', pages: [{ title: 'Recordings & instruments', entries: [
      { name: 'Freesound contributors', detail: 'Every recording is credited by filename on the following pages. CC0 1.0.', url: 'https://freesound.org/' },
      { name: 'Versilian Studios', detail: 'Versilian Community Sample Library: gong, cymbal and timpani recordings. CC0 1.0.', url: 'https://github.com/sgossner/VCSL' },
      { name: 'Karoryfer Lecolds · D. Smolken', detail: 'Big Rusty Drums, Growlybass and Emilyguitar. Emilyguitar was played and mapped by D. Smolken. CC0 1.0.', url: 'https://github.com/sfzinstruments' },
      { name: 'Offline edition', detail: 'The single-file edition uses synthetic audio. All recording credits remain included here.' },
    ] }, ...soundPages],
  },
  {
    id: 'licenses', title: 'LICENSES', pages: [
      { title: 'three.js · MIT', text: threeLicense },
      { title: 'Threejs-Awesome-Graphics-Agent-Skills · MIT', text: meadowLicense },
      { title: 'stylized-scene · MIT', text: sceneLicense },
      { title: 'Hash without Sine · MIT', text: hashLicense },
      { title: 'Recording & font licenses', entries: [
        { name: 'CC0 1.0 Universal', detail: 'Freesound, Versilian and Karoryfer recordings are listed as CC0 1.0 in the project\'s source inventory. Recording names, creators and source links are included in SOUND.', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
        { name: 'SIL Open Font License 1.1', detail: 'Metal Mania, Press Start 2P and VT323 are served by Google Fonts when online. No web font files are embedded in the single-file edition.', url: 'https://openfontlicense.org/open-font-license-official-text/' },
      ] },
    ],
  },
];
