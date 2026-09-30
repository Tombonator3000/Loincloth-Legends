// Hjemborgen (The Keep of Beginnings): Hero Forge, butikk og trening (nivåer, stats, kjæledyr).
import type { Game } from './game';
import type { Item } from '../ui/screens';
import { SHOP, STAT_KEYS, STAT_NAMES, STAT_HINTS, STAT_MAX, xpToNext, statEffects, type ShopItem } from '../data/progress';
import { PETS } from '../data/pets';
import { HERO_OPTIONS } from '../gfx/chars/hero';
import { audio } from '../core/audio';

const SHOPKEEPER = [
  'NO REFUNDS. NO QUESTIONS. NO PANTS.',
  'EVERYTHING IS ONLY SLIGHTLY CURSED.',
  'I ALSO BUY GNOMES. DON\'T TELL THE GNOMES.',
  'YOU BREAK IT, YOU BUY IT. YOU BLEED ON IT, YOU BUY IT TWICE.',
];

/** Hvilke helter er med (1 eller 2). */
function party(g: Game) {
  return g.twoP ? [0, 1] : [0];
}

export function showCamp(g: Game, onBack: () => void, sel = 0) {
  const pts = party(g).reduce((n, i) => n + g.progressOf(i).points, 0);
  const items: Item[] = [
    { label: 'HERO FORGE', hint: 'CHANGE YOUR LOOK AND GEAR', action: () => g.openCreator(g.twoP ? [0, 1] : [0], () => g.goMap()) },
    { label: 'YE OLDE SHOPPE', hint: 'GOLD: ' + g.save.gold, action: () => showShop(g, () => showCamp(g, onBack, 1)) },
    { label: 'TRAINING' + (pts ? ` (${pts} POINT${pts > 1 ? 'S' : ''})` : ''), hint: 'LEVELS, STATS AND PETS', action: () => showTraining(g, 0, () => showCamp(g, onBack, 2)) },
    { label: 'BACK TO THE MAP', action: onBack },
  ];
  g.screens.custom(`<div class="panel camp"><h2>THE KEEP OF BEGINNINGS</h2><p class="line">HOME SWEET HOVEL. IT SMELLS OF HAM AND OLD SOCKS.</p><ul class="menu"></ul></div>`, items, sel, onBack);
}

// ---------------------------------------------------------------- butikk
function owned(g: Game, it: ShopItem) {
  const s = g.save;
  switch (it.kind) {
    case 'pet':
      return s.pets.includes(it.ref!);
    case 'part':
      return s.unlocked.includes(it.ref!);
    default:
      return false;
  }
}

function stock(g: Game, it: ShopItem): string | null {
  const s = g.save;
  if (owned(g, it)) return 'OWNED';
  if (it.kind === 'life' && s.supplies.lives >= (it.max ?? 3)) return 'FULL';
  if (it.kind === 'potions' && s.supplies.potions >= (it.max ?? 3)) return 'FULL';
  if (it.kind === 'manual' && s.manuals >= (it.max ?? 5)) return 'SOLD OUT';
  if (it.kind === 'respec' && !party(g).some((i) => STAT_KEYS.some((k) => g.progressOf(i)[k] > 0))) return 'NOTHING TO FORGET';
  return null;
}

function buy(g: Game, it: ShopItem) {
  const s = g.save;
  const why = stock(g, it);
  if (why) {
    audio.denied();
    g.toast(why);
    return false;
  }
  if (s.gold < it.price) {
    audio.denied();
    g.toast('NOT ENOUGH GOLD. GO HIT SOMETHING.');
    return false;
  }
  switch (it.kind) {
    case 'life':
      s.supplies.lives++;
      break;
    case 'potions':
      s.supplies.potions++;
      break;
    case 'manual':
      s.manuals++;
      for (const i of [0, 1]) g.progressOf(i).points++;
      break;
    case 'respec':
      for (const i of [0, 1]) {
        const p = g.progressOf(i);
        for (const k of STAT_KEYS) {
          p.points += p[k];
          p[k] = 0;
        }
      }
      break;
    case 'pet':
      s.pets.push(it.ref!);
      if (!g.progressOf(0).pet) g.progressOf(0).pet = it.ref!;
      else if (g.twoP && !g.progressOf(1).pet) g.progressOf(1).pet = it.ref!;
      break;
    case 'part':
      if (!s.unlocked.includes(it.ref!)) s.unlocked.push(it.ref!);
      break;
  }
  s.gold -= it.price;
  g.persist();
  audio.buy();
  g.toast('BOUGHT: ' + it.name);
  return true;
}

export function showShop(g: Game, onBack: () => void, sel = 0) {
  const s = g.save;
  const items: Item[] = SHOP.map((it, i) => {
    const why = stock(g, it);
    const extra = it.kind === 'life' ? ` [${s.supplies.lives}/3]` : it.kind === 'potions' ? ` [${s.supplies.potions}/3]` : it.kind === 'manual' ? ` [${s.manuals}/5]` : '';
    return {
      label: `${it.name}${extra} &middot; ${why ?? it.price + ' G'}`,
      hint: it.desc,
      disabled: !!why || s.gold < it.price,
      action: () => {
        buy(g, it);
        showShop(g, onBack, i);
      },
    };
  });
  items.push({ label: 'BACK', action: onBack });
  const quip = SHOPKEEPER[Math.floor(Math.random() * SHOPKEEPER.length)];
  g.screens.custom(
    `<div class="panel wide shop"><h2>YE OLDE SHOPPE</h2><p class="line">GOLD: <b class="gold-big">${s.gold} G</b> &nbsp;&middot;&nbsp; SHOPKEEPER: "${quip}"</p><ul class="menu"></ul></div>`,
    items, sel, onBack,
  );
}

// ---------------------------------------------------------------- trening
export function showTraining(g: Game, slotIdx: number, onBack: () => void, sel = 0) {
  const slots = party(g);
  const slot = slots[Math.min(slotIdx, slots.length - 1)];
  const p = g.progressOf(slot);
  const hero = g.save.heroes[slot];
  const fx = statEffects(p);
  const again = (i: number) => showTraining(g, slotIdx, onBack, i);
  const need = xpToNext(p.level);
  const items: Item[] = [];
  if (slots.length > 1) {
    const sw = () => showTraining(g, (slotIdx + 1) % slots.length, onBack, 0);
    items.push({ label: 'HERO: ' + hero.name, hint: 'SWITCH HERO', action: sw, adjust: sw });
  }
  for (const k of STAT_KEYS) {
    const i = items.length;
    const up = () => {
      if (p.points <= 0 || p[k] >= STAT_MAX) {
        audio.denied();
        return;
      }
      p.points--;
      p[k]++;
      g.persist();
      audio.levelUp();
      again(i);
    };
    items.push({ label: `${STAT_NAMES[k]}: ${'|'.repeat(p[k])}${'.'.repeat(STAT_MAX - p[k])} ${p[k]}`, hint: STAT_HINTS[k], action: up, adjust: (d) => (d > 0 ? up() : audio.denied()) });
  }
  const pets = [null, ...g.save.pets];
  const cyclePet = (d: number) => {
    const cur = pets.indexOf(p.pet);
    p.pet = pets[(cur + d + pets.length) % pets.length];
    g.persist();
    again(items.length - 2);
  };
  items.push({ label: 'PET: ' + (p.pet ? PETS[p.pet].name : 'NONE'), hint: g.save.pets.length ? (p.pet ? PETS[p.pet].desc : 'BUY PETS IN THE SHOPPE') : 'BUY PETS IN THE SHOPPE', action: () => cyclePet(1), adjust: cyclePet, disabled: !g.save.pets.length });
  items.push({ label: 'BACK', action: onBack });
  const pct = Math.round((p.xp / need) * 100);
  g.screens.custom(
    `<div class="panel wide training">
      <h2>TRAINING</h2>
      <div class="tr-head"><b>${hero.name}</b> &nbsp; LEVEL <b>${p.level}</b> &nbsp; POINTS <b class="${p.points ? 'hot' : ''}">${p.points}</b></div>
      <div class="xpbar"><i style="width:${pct}%"></i><span>XP ${p.xp} / ${need}</span></div>
      <div class="tr-fx">DAMAGE x${fx.dmgMul.toFixed(2)} &middot; DAMAGE TAKEN ${Math.round(fx.dmgTaken * 100)}% &middot; HP +${fx.hpBonus} &middot; MAGIC x${fx.magicMul.toFixed(2)} &middot; SPEED +${Math.round((fx.speedMul - 1) * 100)}% &middot; START POTIONS ${fx.startPotions}</div>
      <ul class="menu"></ul>
    </div>`,
    items, sel, onBack,
  );
}

/** Tekst om opplåsinger (brukes av belønninger og butikken). */
export function partName(key: string) {
  const [k, i] = key.split(':');
  return HERO_OPTIONS[k as keyof typeof HERO_OPTIONS]?.[Number(i)] ?? key;
}
