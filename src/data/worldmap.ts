// Verdenskartet: noder, stier mellom dem, krav for å låse opp og belønninger.
export type NodeKind = 'home' | 'level' | 'arena';

export interface MapNode {
  id: string;
  name: string;
  kind: NodeKind;
  biome: 'grass' | 'swamp' | 'frost' | 'scorch' | 'tower';
  pos: [number, number];
  level?: string;
  duel?: string;
  requires: string[];
  reward?: { unlock?: string[]; gold?: number };
  blurb: string;
}

export const MAP_NODES: MapNode[] = [
  { id: 'home', name: 'THE KEEP OF BEGINNINGS', kind: 'home', biome: 'grass', pos: [-17, 5], requires: [], blurb: 'HERO FORGE, YE OLDE SHOPPE AND TRAINING. HOME SWEET HOVEL.' },
  { id: 'road', name: 'THE ROAD OF MILD PERIL', kind: 'level', biome: 'grass', pos: [-10, 2.5], level: 'road', requires: [], reward: { unlock: ['weapon:2'], gold: 200 }, blurb: 'SKELETONS, HOGMEN AND A VERY ANGRY MOTHER.' },
  { id: 'pit', name: 'THE PIT OF UNFAIR JUDGEMENT', kind: 'arena', biome: 'grass', pos: [-8, -5.5], duel: 'gorthak', requires: ['road'], reward: { unlock: ['helmet:3'], gold: 300 }, blurb: 'OPTIONAL DUEL. GORTHAK HAS NOT LOST SINCE TUESDAY.' },
  { id: 'swamp', name: 'THE SWAMP OF MOIST REGRET', kind: 'level', biome: 'swamp', pos: [-2, 7], level: 'swamp', requires: ['road'], reward: { unlock: ['helmet:4'], gold: 250 }, blurb: 'ZOMBIES, FROGMEN AND THE KING OF THEM ALL.' },
  { id: 'mirror', name: 'THE MIRROR POOL', kind: 'arena', biome: 'swamp', pos: [4, 10.5], duel: 'darkyou', requires: ['swamp'], reward: { unlock: ['hairColor:6'], gold: 300 }, blurb: 'OPTIONAL DUEL. FIGHT YOUR EVIL TWIN.' },
  { id: 'frost', name: 'FROSTBITE PASS', kind: 'level', biome: 'frost', pos: [2, -6], level: 'frost', requires: ['swamp'], reward: { unlock: ['helmet:5', 'skin:6'], gold: 300 }, blurb: 'ICE TROLLS. ENDS WITH A DUEL TO THE DEATH.' },
  { id: 'hogpit', name: 'THE TROUGH OF HONOUR', kind: 'arena', biome: 'frost', pos: [-5, -11], duel: 'oinksalot', requires: ['frost'], reward: { gold: 400 }, blurb: 'OPTIONAL DUEL. A KNIGHT. A PIG. A PIG KNIGHT.' },
  { id: 'scorch', name: 'THE SCORCHLANDS', kind: 'level', biome: 'scorch', pos: [10, 1.5], level: 'scorch', requires: ['frost'], reward: { gold: 350 }, blurb: 'FIRE IMPS AND A LONELY LAVA GIANT.' },
  { id: 'bone', name: 'THE BONE COLISEUM', kind: 'arena', biome: 'scorch', pos: [12, 9], duel: 'bonejangles', requires: ['scorch'], reward: { unlock: ['weapon:3'], gold: 400 }, blurb: 'OPTIONAL DUEL. THE CROWD IS DEAD. LITERALLY.' },
  { id: 'tower', name: 'TOWER OF MODERATE EVIL', kind: 'level', biome: 'tower', pos: [17.5, -4], level: 'tower', requires: ['scorch'], reward: { gold: 1000 }, blurb: 'VORTHAX. THE PRINCESS. THE HALF-EATEN HAM.' },
];

export const MAP_EDGES: [string, string][] = [
  ['home', 'road'], ['road', 'pit'], ['road', 'swamp'], ['swamp', 'mirror'], ['swamp', 'frost'], ['pit', 'frost'],
  ['frost', 'hogpit'], ['frost', 'scorch'], ['scorch', 'bone'], ['scorch', 'tower'],
];

export function nodeById(id: string) {
  return MAP_NODES.find((n) => n.id === id);
}
