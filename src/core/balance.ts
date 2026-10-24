import type { Rarity, StatKey } from './items';
import type { FeatureKind, Stats } from './types';

export const BASE_DIG_POWER = 10;
export const BASE_AUTO_TICKS_PER_SECOND = 1;
export const BASE_TICKS_PER_CLICK = 1;
export const BASE_LAMP_SIGHT = 2;
export const BASE_OFFLINE_CAP_MS = 8 * 3_600_000;
export const MAX_CLICKS_PER_SECOND = 10;
export const MAX_LAMP_SIGHT = 20;
export const FEATURE_CHANCE_TOTAL_CAP = 0.9;
export const DIAMOND_CHANCE_CAP = 0.5;
export const MAX_DIG_POWER = 5000;
export const MIN_AUTO_TICKS_PER_SECOND = 0.1;
export const MAX_AUTO_TICKS_PER_SECOND = 10;
export const MAX_TICKS_PER_CLICK = 10;
export const MIN_OFFLINE_CAP_MS = 3_600_000;
export const MAX_OFFLINE_CAP_MS = 48 * 3_600_000;

export const TICKS_PER_METRE_AT_PARITY = 25;
export const HARD_ROCK_MULTIPLIER = 1.5;

export const BASE_FEATURE_CHANCES: Readonly<Record<FeatureKind, number>> = {
  goldVein: 0.12, diamondVein: 0.03, chest: 0.06, gem: 0.03, map: 0.04,
};
export const BASE_HARD_ROCK_CHANCE = 0.08;
// What the seed alone decides about a metre (world generation 2); find gear never changes it.
export const BASE_ROLL_CHANCES: Pick<Stats, 'featureChances' | 'hardRockChance'> = {
  featureChances: BASE_FEATURE_CHANCES, hardRockChance: BASE_HARD_ROCK_CHANCE,
};

export const GUARANTEED_FIRST_MAP_METRE = 2;
export const FINDS_LOG_LIMIT = 5000;

export const BAG_SIZE = 24;
export const STASH_SIZE = 60;
export const MAX_LOOT_RULES = 20;
export const MAX_OVERFLOW = 10;
export const MAX_SOCKETS = 3;
export const MAX_AFFIXES = 4;

export const AUTOSAVE_INTERVAL_MS = 30_000;
export const OFFLINE_SUMMARY_MIN_TICKS = 300;
export const TAB_LOCK_STALE_MS = 5000;
export const TAB_HEARTBEAT_MS = 2000;

export function hardness(metre: number): number {
  return 10 + 0.13 * metre;
}
export function goldPerTick(tier: number): number {
  return 1 + Math.floor(tier / 2);
}
export function diamondChancePerTick(tier: number): number {
  return Math.min(0.2, 0.01 * tier);
}
export function goldVeinAmount(tier: number, u: number): number {
  return Math.round(6 * tier * (0.8 + 0.4 * u));
}
export function diamondVeinAmount(tier: number): number {
  return 1 + Math.floor(tier / 2);
}

export const STAT_RANGES: Readonly<Record<StatKey, { base: number; perLevel: number; cap?: number }>> = {
  digPower: { base: 2, perLevel: 2 },
  goldYield: { base: 4, perLevel: 2 },
  diamondYield: { base: 4, perLevel: 2 },
  chestFind: { base: 5, perLevel: 2 },
  gemFind: { base: 5, perLevel: 2 },
  mapFind: { base: 5, perLevel: 2 },
  lampSight: { base: 1, perLevel: 0.25, cap: 6 },
  ticksPerClick: { base: 1, perLevel: 0, cap: 1 },
  autoTickRate: { base: 3, perLevel: 1, cap: 50 },
  offlineCap: { base: 15, perLevel: 5, cap: 240 },
  damage: { base: 2, perLevel: 3 },
  damagePct: { base: 4, perLevel: 1 },
  attackSpeed: { base: 3, perLevel: 1, cap: 40 },
  life: { base: 8, perLevel: 6 },
  armor: { base: 6, perLevel: 5 },
  critChance: { base: 1, perLevel: 0.5, cap: 15 },
  resistAll: { base: 3, perLevel: 1, cap: 30 },
  soulFind: { base: 4, perLevel: 2 },
  magicFind: { base: 4, perLevel: 2 },
};

export function statRange(stat: StatKey, ilvl: number): { min: number; max: number } {
  const r = STAT_RANGES[stat];
  const max = Math.min(r.cap ?? Infinity, Math.max(1, Math.round(r.base + r.perLevel * ilvl)));
  return { min: Math.max(1, Math.round(max / 2)), max };
}

export function rollStat(stat: StatKey, ilvl: number, u: number): number {
  const { min, max } = statRange(stat, ilvl);
  return min + Math.floor(u * (max - min + 1));
}

export const DEFAULT_STAT_WEIGHT = 10;
export const STAT_WEIGHTS: Readonly<Partial<Record<StatKey, number>>> = { ticksPerClick: 2, lampSight: 4 };
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { normal: 60, magic: 30, rare: 9, legendary: 1 };
export const RARE_FOURTH_AFFIX_CHANCE = 0.5;
export const SOCKET_WEIGHTS: readonly number[] = [40, 35, 18, 7];
export const CHEST_SECOND_ITEM_CHANCE = 0.2;
export const CHEST_BATTLE_CHANCE = 0.2;

export const SELL_GOLD: Readonly<Record<Rarity, number>> = { normal: 5, magic: 12, rare: 30, legendary: 80 };
export const GEM_SELL_GOLD = 20;
export const SALVAGE_DIAMONDS: Readonly<Record<Rarity, number>> = { normal: 1, magic: 2, rare: 4, legendary: 10 };
export const GEM_SALVAGE_DIAMONDS = 2;
export const LOOT_NOTES_KEPT = 30;
