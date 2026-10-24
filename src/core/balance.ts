import type { GemGrade, Material, Rarity, StatKey } from './items';
import type { FeatureKind, Hazard, Stats } from './types';

export const BASE_DIG_POWER = 10;
export const BASE_AUTO_TICKS_PER_SECOND = 1;
export const BASE_TICKS_PER_CLICK = 1;
export const BASE_LAMP_SIGHT = 3;
export const BASE_OFFLINE_CAP_MS = 8 * 3_600_000;
export const MAX_CLICKS_PER_SECOND = 10;
export const MAX_LAMP_SIGHT = 20;
export const WALL_DETAIL_PERCENT = 6;
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
// The item level a gem's value is worked out at, and the first tier each grade is found at.
export const GEM_GRADE_LEVEL: Readonly<Record<GemGrade, number>> = { tiny: 2, small: 5, big: 8, giant: 12, perfect: 18 };
export const GEM_GRADE_FROM_TIER: Readonly<Record<GemGrade, number>> = { tiny: 1, small: 4, big: 7, giant: 10, perfect: 15 };
export const GEM_BAG_STACK = 25;
export const GEM_STASH_STACK = 1_000_000;
export const MAX_LOOT_RULES = 20;
export const MAX_OVERFLOW = 10;
export const MAX_SOCKETS = 3;
export const MAX_AFFIXES = 4;

export const LEVEL_CAP = 60;
export const MAP_STASH_SIZE = 200;
export const COMBAT_LOG_LIMIT = 20;
export const RUN_LOOT_LIMIT = 30;
export const MAX_LIFE = 1_000_000;
export const MAX_DAMAGE = 1_000_000;

// The miner's battle numbers.
export const BASE_LIFE = 50;
export const LIFE_PER_LEVEL = 10;
export function baseDamage(level: number): { min: number; max: number } {
  return { min: 2 + level, max: 4 + 2 * level };
}
export const BASE_ATTACKS_PER_SECOND = 1;
export const MIN_ATTACKS_PER_SECOND = 0.2;
export const MAX_ATTACKS_PER_SECOND = 5;
export const BASE_CRIT_CHANCE = 5;
export const MAX_CRIT_CHANCE = 75;
export const CRIT_MULTIPLIER = 1.5;
export const MAX_RESIST = 75;
export const ARMOR_FACTOR = 10;
export const MAX_ARMOR_REDUCTION = 0.9;

// Monster base values by tier (unrounded); species, rank and modifiers scale them.
export function monsterLifeBase(tier: number): number {
  return 15 * tier ** 1.3;
}
export function monsterDamageBase(tier: number): number {
  return 2 + 1.5 * tier ** 1.2;
}
export function monsterXp(tier: number): number {
  return Math.round(10 * tier ** 1.5);
}
export const CHAMPION_LIFE = 2.5;
export const CHAMPION_DAMAGE = 1.5;
export const CHAMPION_REWARD = 3;
export const BOSS_LIFE = 5;
export const BOSS_DAMAGE = 1.5;
export const BOSS_REWARD = 5;
export const ARMORED_TAKEN = 0.6;
export const SWIFT_SPEED = 1.4;
export const VAMPIRIC_HEAL = 0.2;
export const BRUTAL_DAMAGE = 1.5;
export const THICK_LIFE = 1.8;

// Rewards and drops.
export function soulsPerKill(tier: number): number {
  return 0.25 * tier;
}
export function goldPerKill(tier: number): number {
  return 2 * tier;
}
export const DROP_CHANCE = 0.15;
export const BOSS_DROPS = 2;
export const CHAMPION_DROPS = 1;
export const CHAMPION_MAGIC_FIND = 3;
export const MAP_DROP_BATTLE_CHANCE = 0.8;
export const MAP_GEM_CHANCE = 0.04;
// What the room clears of a map heal in all, as a share of max life: each clear heals its part, so every map heals the same.
export const ROOM_REGEN_TOTAL = 1.5;
// A map tick is fought in equal steps of at most this many seconds, so the tick rate never changes a fight.
export const COMBAT_STEP_S = 0.25;
// A map's layout: every map holds the same monster budget; a champion costs CHAMPION_UNITS of it.
export const MONSTER_BUDGET = 15;
export const CHAMPION_UNITS = 3;
export const MIN_ROOMS = 4;
export const MAX_ROOMS = 7;

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

// Material veins and hazards come from their own seeded layer, so they never disturb the feature roll.
export const MATERIAL_TABLE: Readonly<Record<Material, { from: number; weight: number; amount: number }>> = {
  copper: { from: 0, weight: 40, amount: 4 },
  tin: { from: 0, weight: 30, amount: 3 },
  iron: { from: 50, weight: 20, amount: 3 },
  silver: { from: 150, weight: 12, amount: 2 },
  mithril: { from: 300, weight: 8, amount: 2 },
  starsteel: { from: 450, weight: 5, amount: 1 },
  obsidian: { from: 700, weight: 3, amount: 1 },
  voidCrystal: { from: 1000, weight: 1, amount: 1 },
};
export const MATERIAL_VEIN_CHANCE = 0.3;
export const MATERIAL_RAMP_METRES = 500;
export const MATERIAL_RAMP_CAP = 3;
export const LAYER_SALT = 0x1a7e2;
export const HAZARD_START_METRE = 300;
export function hazardChance(metre: number): number {
  return metre <= HAZARD_START_METRE ? 0 : Math.min(0.25, 0.05 + (metre - HAZARD_START_METRE) / 20_000);
}
export const HAZARD_SLOW: Readonly<Record<Hazard, number>> = { gas: 2, unstable: 1.6 };
export const MAX_HAZARD_WARD = 75;
