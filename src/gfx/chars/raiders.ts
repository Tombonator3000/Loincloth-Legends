// Fiender bygget av de samme malte delene som spilleren kan velge i heltesmia.
import { buildHeroDef, type HeroConfig } from './hero';
import type { CharDef } from './types';

// De klassiske valgene gir hver fiende egen reservegrafikk hvis et bilde mangler.
const ash: HeroConfig = {
  name: 'ASH RAIDER', body: 1, skin: 4, face: 0, hair: 1, hairColor: 0, beard: 0, helmet: 0,
  torso: 2, pelvis: 0, boots: 1, weapon: 1, cloth: 0, magic: 0,
  parts: {
    head: 'forge_ash_head', torso: 'forge_ash_torso', pelvis: 'forge_ash_pelvis',
    arm: 'forge_ash_arm', leg: 'forge_ash_leg', weapon: 'forge_doubleaxe_weapon',
  },
};
const warden: HeroConfig = {
  name: 'IRON WARDEN', body: 0, skin: 1, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 5,
  torso: 4, pelvis: 3, boots: 2, weapon: 2, cloth: 1, magic: 0,
  parts: {
    head: 'forge_warden_head', torso: 'forge_warden_torso', pelvis: 'forge_warden_pelvis',
    arm: 'forge_warden_arm', leg: 'forge_warden_leg', weapon: 'forge_maul_weapon',
  },
};

export const RAIDERS: CharDef[] = [
  { ...buildHeroDef(ash, 0), id: 'ashraider', color: '#9a5e38' },
  { ...buildHeroDef(warden, 0), id: 'ironwarden', color: '#8e1b1b' },
];
