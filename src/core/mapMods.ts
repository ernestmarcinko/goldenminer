import { DOUBLE_MATERIALS, MAP_MOD_CAPS, MAP_MOD_TIERS, MAP_REWARD_FACTORS, TRIPLE_SOULS } from './balance';
import type { MapItem, MapModKind, MapSpecial } from './items';
import { rangeOf } from './tiers';

/** The values a map modifier rolls at a tier. */
export function mapModRange(kind: MapModKind, tier: number): { lo: number; hi: number } {
  return rangeOf(MAP_MOD_TIERS[kind], tier);
}

/**
 * What a map's modifiers do to its run. The multipliers scale the monsters (life, damage, attack speed, and champions'
 * and bosses' power), the miner's healing and the damage monsters take. The rewards are whole percentages: more item
 * drops, more magic find and more Souls. A special multiplies the Souls and the materials on its own; it never counts
 * toward the rewards.
 */
export interface MapEffects {
  lifeMult: number; damageMult: number; speedMult: number; bossMult: number; healMult: number; takenMult: number;
  quantity: number; rarity: number; souls: number; soulsMult: number; materialMult: number;
}

/** What a normal map does: nothing. */
export const NO_MAP_EFFECTS: Readonly<MapEffects> = {
  lifeMult: 1, damageMult: 1, speedMult: 1, bossMult: 1, healMult: 1, takenMult: 1, quantity: 0, rarity: 0, souls: 0,
  soulsMult: 1, materialMult: 1,
};

export function mapEffects(map: MapItem): MapEffects {
  const sum = (kind: MapModKind) => map.mods.reduce((n, m) => (m.kind === kind ? n + m.value : n), 0);
  const capped = (kind: MapModKind) => Math.min(MAP_MOD_CAPS[kind] ?? Infinity, sum(kind));
  const total = map.mods.reduce((n, m) => n + m.value, 0);
  return {
    lifeMult: 1 + sum('monsterLife') / 100,
    damageMult: 1 + sum('monsterDamage') / 100,
    speedMult: 1 + sum('monsterSpeed') / 100,
    bossMult: 1 + sum('bossPower') / 100,
    healMult: map.special === 'tripleSouls' ? 0 : 1 - capped('weakHealing') / 100,
    takenMult: 1 - capped('hardened') / 100,
    quantity: Math.round(total * MAP_REWARD_FACTORS.quantity),
    rarity: Math.round(total * MAP_REWARD_FACTORS.rarity),
    souls: Math.round(total * MAP_REWARD_FACTORS.souls),
    soulsMult: map.special === 'tripleSouls' ? TRIPLE_SOULS : 1,
    materialMult: map.special === 'doubleMaterials' ? DOUBLE_MATERIALS : 1,
  };
}

export const MAP_MOD_TEXT: Readonly<Record<MapModKind, (v: number) => string>> = {
  monsterLife: (v) => `Monsters have +${v}% life`,
  monsterDamage: (v) => `Monsters deal +${v}% damage`,
  monsterSpeed: (v) => `Monsters attack ${v}% faster`,
  bossPower: (v) => `Champions and bosses are ${v}% stronger`,
  weakHealing: (v) => `Rooms heal ${v}% less`,
  hardened: (v) => `Monsters take ${v}% less damage`,
};

export const MAP_SPECIAL_TEXT: Readonly<Record<MapSpecial, string>> = {
  bossLegendary: 'The boss drops a legendary',
  treasureRoom: 'A treasure room before the boss',
  championPacks: 'Every pack has a champion',
  doubleMaterials: 'Materials drop twice',
  tripleSouls: 'Souls ×3, but rooms don\'t heal',
  secondBoss: 'A second boss',
};
