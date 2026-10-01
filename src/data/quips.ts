// Replikker i B-film-stil fra 1980-tallet. Heltene sier dem etter lange drapsrekker og store drap.
// Alt er skrevet for spillet (ingen sitater fra ekte filmer).

/** Heltene (alle). */
export const HERO_QUIPS = [
  'MY BICEPS HAVE NO REGRETS.',
  'THAT WAS FOR MY VILLAGE. AND MY OTHER VILLAGE.',
  'I WILL ALLOW THE BARD TO EXAGGERATE THIS.',
  'STEEL IS THE ONLY DIET.',
  'NEXT!',
  'BY MY LOINCLOTH!',
  'THE GODS OF METAL DEMAND AN ENCORE.',
  'I HAVE OILED FOR THIS MOMENT.',
  'SOMEBODY CALL A PRIEST. NOT FOR ME.',
  'I SHALL CARVE THIS INTO A ROCK LATER.',
  'IS THAT ALL? I ASK SINCERELY.',
  'FLEX. FLEX AGAIN. VICTORY.',
];

/** Ekstra for kvinnelige helter. */
export const HEROINE_QUIPS = [
  'THIS CHAINMAIL IS FULLY FUNCTIONAL.',
  'I DO NOT NEED A PRINCE. I NEED A BIGGER AXE.',
  'MY MOTHER WAS A VALKYRIE. MY FATHER WAS A HAMMER.',
  'THE RED BOOTS STAY ON.',
];

/** Når helten jonglerer en fiende i lufta. Indeks = antall treff i lufta (fra 2). */
export const JUGGLE_WORDS = ['', '', 'JUGGLE!', 'AIR RAID!', 'SKY BUFFET!', 'NO LANDING!', 'FREQUENT FLYER!'];

/** Drapsrekker som får helten til å si noe. */
export const QUIP_STREAKS = [5, 12, 20];

/**
 * Teit vold på brettene (Tom 2026-10-01, game/mayhem.ts og gfx/fx.ts): det som sies og står på skjermen når overkroppen
 * kryper, hodet slås som en ball, fiender spiddes, det regner blod, fiender sklir i pytter og hodet i skjermen sier sine
 * siste ord. Den første i hver liste er den Tom ba om, og den brukes først.
 */
export const MAYHEM_LINES = {
  /** Overkroppen begynner å krype mot helten. */
  crawl: ['I CAN STILL BITE!', 'COME BACK HERE!', 'NOT FINISHED WITH YOU!', 'I HAVE ARMS! AND TEETH!'],
  /** Den biter helten i ankelen. */
  bite: ['CHOMP!', 'NOM!', 'ANKLE BITER!'],
  /** Helten som blir bitt. */
  bitten: ['MY ANKLE!', 'GET OFF ME!', 'IS THAT A TORSO?', 'SHOO!'],
  /** Et slag gjør slutt på den. */
  squash: ['STAY DOWN!', 'SQUISH!', 'AND STAY DEAD!'],
  /** Den blør ut av seg selv. */
  bledOut: ['...TELL MY LEGS...', 'I REGRET... NOTHING...', 'SO... TIRED...'],
  /** Hodet som slås avgårde. */
  batted: ['BATTER UP!', 'FORE!', 'HEADS UP!'],
  /** Hodet treffer en fiende. */
  homeRun: ['HOME RUN!', 'OUT OF THE PARK!', 'GRAND SLAM!'],
  /** Første fiende på sverdet etter løpeslaget. */
  skewered: ['SKEWERED!', 'ON A STICK!', 'IMPALED!'],
  /** Neste slag rister dem av. */
  kebab: ['SHISH KEBAB!', 'ORDER UP!', 'EXTRA MEAT!'],
  /** Fienden som sklir i en blodpytt. */
  slip: ['SLIP!', 'WHOOPS!', 'SPLAT!'],
  /** Gnomen med paraplyen i blodregnet. */
  umbrella: ['I CAME PREPARED', 'TYPICAL WEATHER.', 'FORECAST SAID RED.'],
  /** Det siste hodet i skjermen sier før det sklir. */
  lastWords: ['TELL MY MOTHER...', 'WORTH IT', 'IS IT OVER?', 'I CAN SEE MY HOUSE FROM HERE', 'CLEAN THAT UP, WILL YOU?', 'NOT THE GLASS!', 'I REGRET NOTHING', 'OUCH.'],
  /** Ildimpen smeller. */
  impBurst: ['FWOOSH!', 'HOT POTATO!', 'IMP-LOSION!'],
};

/** Magien (game/spells.ts). */
export const SPELL_LINES = {
  /** Pila som bommer (MAGIC MISSILE OF ABSOLUTE CERTAINTY)... */
  miss: ['MISS!', 'MISSED!'],
  /** ...og snur og treffer likevel. */
  certain: ['ABSOLUTELY CERTAIN!', 'IT CAME BACK!', 'NO ESCAPE!', 'GUARANTEED!'],
  /** De døde som smuldrer av TURN UNDEAD. */
  crumble: ['NOT AGAIN!', 'BACK TO DUST!', 'I WAS ALREADY DEAD!', 'RUDE!'],
  /** De levende som blir blendet. */
  blind: ['MY EYES!', 'TOO BRIGHT!', 'I CANNOT SEE!', 'WHO TURNED ON THE SUN?'],
  /** Heltene som får litt liv. */
  healed: ['BLESSED!', 'I FEEL BETTER!', 'HOLY!'],
  /** Fienden som sklir i olja (GREASE OF THE OILY ONE). */
  slip: ['SLIP!', 'WHOA!', 'OILY!', 'NOT AGAIN!'],
  /** Olja tar fyr. */
  fire: ['GREASE FIRE!', 'FWOOMP!', 'THAT ESCALATED!'],
  /** Fiendene blir høner (POLYMORPH: CHICKEN). */
  bawk: ['BAWK!', 'BAWK BAWK!', 'CLUCK?!', 'BUKAAAWK!'],
  /** Høna sprenges i fjær. */
  pop: ['POP!', 'NUGGETS!', 'POULTRY!', 'FEATHERS EVERYWHERE!'],
  /** Høna blir seg selv igjen. */
  unchicken: ['...WHAT HAPPENED?', 'WHY DO I CRAVE CORN?', 'I HAD THE STRANGEST DREAM.'],
  /** Sjefen står imot. */
  saved: 'THE BOSS SAVED VS. POLYMORPH',
};
