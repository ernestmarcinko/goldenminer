import type { GemGrade, MapModKind, MapRarity, Material, Rarity, StatKey } from './items';
import type { CraftKind, FeatureKind, Hazard, Stats, TemperOutcome } from './types';

export const BASE_DIG_POWER = 10;
export const BASE_AUTO_TICKS_PER_SECOND = 1;
export const BASE_TICKS_PER_CLICK = 1;
export const BASE_LAMP_SIGHT = 3;
export const BASE_OFFLINE_CAP_MS = 8 * 3_600_000;
export const MAX_CLICKS_PER_SECOND = 10;
export const MAX_LAMP_SIGHT = 20;
export const WALL_DETAIL_PERCENT = 6;
export const FEATURE_CHANCE_TOTAL_CAP = 0.9;
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

export const BAG_SIZE = 60;
export const STASH_PAGE_SIZE = 60;
export const START_GENERAL_PAGES = 2;
export const MAX_STASH_PAGES = 1000;
export const STASH_PAGE_GOLD = 5000;
// The Map stash has no pages: each tier holds this many maps, for nothing.
export const MAP_TIER_CAP = 200;
/** The Gold price of the `n`th General page bought (and of the Maps pages old saves bought, which are refunded). */
export function stashPagePrice(n: number): number {
  return STASH_PAGE_GOLD * n * n;
}
// The merchant's gamble costs GAMBLE_GOLD × tier² at the deepest tier reached, so it keeps pace with Gold income.
export const GAMBLE_GOLD = 300;
// The Trader's stock: this many slots, each bought at most once a band of STOCK_BAND_METRES, at TRADER_PRICE_MULT × its
// sell value; about TRADER_MAP_SHARE of the slots are maps.
export const STOCK_SIZE = 12;
export const STOCK_BAND_METRES = 10;
export const TRADER_PRICE_MULT = 4;
export const TRADER_MAP_SHARE = 0.25;
// The item level a gem's value is worked out at, and the first tier each grade is found at.
export const GEM_GRADE_LEVEL: Readonly<Record<GemGrade, number>> = { tiny: 2, small: 5, big: 8, giant: 12, perfect: 18 };
export const GEM_GRADE_FROM_TIER: Readonly<Record<GemGrade, number>> = { tiny: 1, small: 4, big: 7, giant: 10, perfect: 15 };
export const GEM_BAG_STACK = 25;
export const GEM_STASH_STACK = 1_000_000;
export const MATERIAL_BAG_STACK = 50;
export const MATERIAL_STASH_STACK = 1_000_000;
// Twice the old 20: a migrated catch-all splits into a gear rule and a gem rule, so no old filter overflows.
export const MAX_LOOT_RULES = 40;
// Finds held for want of room; past this many, a find is sold (or, for a material, stashed).
export const MAX_HELD = 60;
export const MAX_SOCKETS = 3;
// An item holds at most 3 prefixes and 3 suffixes; crafted lines count outside them.
export const MAX_SIDE_LINES = 3;
export const MAX_CRAFTED_LINES = 2;
// A line may sit above an item's tier cap by up to this many tiers: a crafted line rolls there, and a migrated line's
// old value can fall there.
export const MAX_TIER_OVER_CAP = 2;
// The highest item level an item, gem or map tier can have; a save holding more is refused.
export const MAX_ITEM_LEVEL = 100_000;

export const LEVEL_CAP = 100;
// XP to leave level L is XP_PER_LEVEL × L^XP_EXPONENT, times a late-game ramp that leaves the tuned early levels alone:
// 1× up to XP_RAMP_START, rising to XP_RAMP_MULT by XP_RAMP_FULL, then to XP_RAMP_CAP by the cap.
export const XP_PER_LEVEL = 100;
export const XP_EXPONENT = 1.5;
export const XP_RAMP_START = 10;
export const XP_RAMP_FULL = 30;
export const XP_RAMP_MULT = 1.5;
export const XP_RAMP_CAP = 4.5;
// Ascendancy: the depth each point costs, the level that unlocks ascension, and how many levels above it earn a
// bonus point (from the second ascension on).
export const ASCEND_DEPTH_PER_POINT = 250;
export const ASCEND_LEVEL = 60;
export const ASCEND_LEVEL_STEP = 10;
export const AUTO_MAP_BASE_TIER = 3;
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
// What a map's tier multiplies its monsters' life and damage by (tier 1 first; deeper tiers use the last entry): a new
// miner with no gear wins the guaranteed first map about two times in three, a level-3 miner in normal gear of tier 2's
// item level wins a tier-2 map about seven times in ten, and from tier 3 a map of your gear's level is cleared about 40%
// of the time.
export const MAP_MONSTER_SCALE: readonly number[] = [1.38, 1.34, 2.05, 1.8, 1.7, 1.55, 1.4, 1.35, 1.3, 1.25];
export function mapMonsterScale(tier: number): number {
  return MAP_MONSTER_SCALE[Math.min(tier, MAP_MONSTER_SCALE.length) - 1] ?? 1;
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
// A kill rolls this chance rankReward times; each pass drops a material of the map's depth.
export const MAP_MATERIAL_CHANCE = 0.25;
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
/** A gap between two live ticks longer than this (the computer slept) is dug as time away, whatever the view. */
export const LONG_GAP_MS = 5 * 60_000;
export const TAB_LOCK_STALE_MS = 5000;
export const TAB_HEARTBEAT_MS = 2000;

export function hardness(metre: number): number {
  return 10 + 0.13 * metre;
}
// Digging pays only from what it digs into: these veins are the whole of digging's Gold and Diamonds.
export function goldVeinAmount(tier: number, u: number): number {
  return Math.round((200 + 110 * tier) * (0.8 + 0.4 * u));
}
export function diamondVeinAmount(tier: number): number {
  return 1 + Math.floor(tier / 2);
}

// A modifier's tier t rolls from round(base + step * (t - 1)) up to just below tier t + 1's start.
export const STAT_TIERS: Readonly<Record<StatKey, { base: number; step: number }>> = {
  digPower: { base: 2, step: 2 },
  digPowerPct: { base: 4, step: 2 },
  goldYield: { base: 4, step: 2 },
  diamondYield: { base: 4, step: 2 },
  veinYield: { base: 3, step: 1.5 },
  autoTickRate: { base: 3, step: 2 },
  ticksPerClick: { base: 1, step: 0.2 },
  sellBonus: { base: 5, step: 2 },
  chestFind: { base: 5, step: 2 },
  gemFind: { base: 5, step: 2 },
  mapFind: { base: 5, step: 2 },
  oreFind: { base: 5, step: 2 },
  lampSight: { base: 1, step: 0.25 },
  offlineCap: { base: 15, step: 5 },
  hazardWard: { base: 5, step: 2 },
  salvageYield: { base: 5, step: 2 },
  damage: { base: 2, step: 3 },
  damagePct: { base: 4, step: 2 },
  elementalDamage: { base: 2, step: 3 },
  attackSpeed: { base: 3, step: 2 },
  critChance: { base: 1, step: 0.5 },
  critMultiplier: { base: 5, step: 3 },
  life: { base: 8, step: 6 },
  lifePct: { base: 3, step: 2 },
  armor: { base: 6, step: 5 },
  armorPct: { base: 4, step: 2 },
  resistAll: { base: 3, step: 2 },
  lifeRegen: { base: 1, step: 0.5 },
  lifeOnKill: { base: 2, step: 2 },
  soulFind: { base: 4, step: 2 },
  magicFind: { base: 4, step: 2 },
  xpFind: { base: 3, step: 2 },
};

// A map modifier's tiers work as a gear line's do. Weak healing and hardened are capped once summed.
export const MAP_MOD_TIERS: Readonly<Record<MapModKind, { base: number; step: number }>> = {
  monsterLife: { base: 15, step: 8 },
  monsterDamage: { base: 12, step: 6 },
  monsterSpeed: { base: 8, step: 4 },
  bossPower: { base: 20, step: 10 },
  weakHealing: { base: 15, step: 7 },
  hardened: { base: 8, step: 4 },
};
export const MAP_MOD_CAPS: Readonly<Partial<Record<MapModKind, number>>> = { weakHealing: 90, hardened: 75 };
// What a map pays for its modifiers: each reward is this share of the sum of their values, in whole percent.
export const MAP_REWARD_FACTORS: Readonly<Record<'quantity' | 'rarity' | 'souls', number>> = {
  quantity: 0.5, rarity: 0.3, souls: 0.5,
};
export const MAX_MAP_MODS = 6;
// A map's special modifier: the chance an enchant adds one to a map with none, and what the specials pay.
export const MAP_SPECIAL_CHANCE = 0.1;
export const TREASURE_CHESTS = 3;
export const TRIPLE_SOULS = 3;
export const DOUBLE_MATERIALS = 2;

export const DEFAULT_STAT_WEIGHT = 10;
export const STAT_WEIGHTS: Readonly<Partial<Record<StatKey, number>>> = { ticksPerClick: 2, lampSight: 4 };
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { normal: 60, magic: 30, rare: 9, legendary: 1 };
export const MAGIC_LINE_WEIGHTS: readonly [number, number][] = [[1, 50], [2, 50]];
export const RARE_LINE_WEIGHTS: readonly [number, number][] = [[4, 50], [5, 35], [6, 15]];
export const SOCKET_WEIGHTS: readonly number[] = [40, 35, 18, 7];
export const CHEST_SECOND_ITEM_CHANCE = 0.2;
export const CHEST_BATTLE_CHANCE = 0.2;

// A craft costs base + floor(level / per) of its material, or base alone when per is 0. Gear's level is its ilvl, a
// map's its tier.
export const CRAFT_COST: Readonly<Record<CraftKind, { base: number; per: number }>> = {
  copper: { base: 1, per: 2 }, tin: { base: 1, per: 2 }, iron: { base: 1, per: 2 },
  silver: { base: 1, per: 4 }, mithril: { base: 1, per: 4 }, starsteel: { base: 1, per: 4 },
  diamond: { base: 1, per: 3 },
  obsidian: { base: 1, per: 0 }, voidCrystal: { base: 1, per: 0 },
};
export const TEMPER_WEIGHTS: readonly [TemperOutcome, number][] = [['craftedLine', 30], ['raiseTiers', 25], ['nothing', 25], ['ruin', 20]];
// Enchanting a map also spends Souls, this many for each of its tiers.
export const MAP_CRAFT_SOULS_PER_TIER = 5;
// Raising battle gear one item level costs SOUL_UPGRADE_BASE × ilvl² Souls, so each level costs more than the last.
export const SOUL_UPGRADE_BASE = 5;

export const SELL_GOLD: Readonly<Record<Rarity, number>> = { normal: 5, magic: 12, rare: 30, legendary: 80 };
export const GEM_SELL_GOLD = 20;
// Salvage gives low-tier materials only, so the deep ones stay worth digging for; Diamonds come from veins alone.
export const SALVAGE_MATERIALS: Readonly<Record<Rarity, Partial<Record<Material, number>>>> = {
  normal: { copper: 1 }, magic: { copper: 2, tin: 1 }, rare: { copper: 3, tin: 2, iron: 1 }, legendary: { tin: 3, iron: 3, silver: 1 },
};
export const GEM_SALVAGE_TIN = 1;
export const LOOT_NOTES_KEPT = 30;
// A map sells for MAP_SELL_GOLD × tier², times its rarity's factor.
export const MAP_SELL_GOLD = 25;
export const MAP_RARITY_SELL: Readonly<Record<MapRarity, number>> = { normal: 1, magic: 1.5, rare: 2.5 };
// A map salvages into Copper ore, plus Tin ore from `tinFromTier`, each times its tier's factor as gear's item level is.
export const MAP_SALVAGE: Readonly<{ copper: number; tin: number; tinFromTier: number }> = { copper: 2, tin: 1, tinFromTier: 3 };
// The logs keep their newest entries; a trail keeps its first step and its newest ones.
export const DROP_LOG_LIMIT = 300;
export const DEATH_LOG_LIMIT = 50;
export const MAX_TRAIL_STEPS = 24;

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
// Ore find: each 100 % of it gives ORE_BONUS_BASE chance of a bonus material vein on a metre the seed left empty.
export const ORE_BONUS_BASE = 0.3;
export const MAX_ORE_BONUS_CHANCE = 0.6;
export const MATERIAL_RAMP_METRES = 500;
export const MATERIAL_RAMP_CAP = 3;
export const LAYER_SALT = 0x1a7e2;
export const HAZARD_START_METRE = 300;
export function hazardChance(metre: number): number {
  return metre <= HAZARD_START_METRE ? 0 : Math.min(0.25, 0.05 + (metre - HAZARD_START_METRE) / 20_000);
}
export const HAZARD_SLOW: Readonly<Record<Hazard, number>> = { gas: 2, unstable: 1.6 };
export const MAX_HAZARD_WARD = 75;
// Legendary uniques: each acts only while its legendary is worn.
export const DEEPDELVER_EVERY = 25;           // every 25th metre is dug at once, its find doubled
export const BLACK_LANTERN_SIGHT = 30;        // metres past the face whose hazards show on the minimap
export const BLACK_LANTERN_SLOW = 0.5;        // the share of a hazard's slowdown left
export const LONG_VOYAGE_CAP = 2;             // the offline cap's multiplier, after its clamp
export const BAND_OF_THE_DEEP_HEAL = 0.02;    // of max life, on every critical hit
export const WOLF_EYE_DROPS = 1;              // more items from a champion or a boss
export const PEACEMAKER_EVERY = 5;            // every 5th strike strikes twice

// The passive web: a refund costs Gold scaling with level, a full reset Diamonds.
export const RESPEC_GOLD_BASE = 100;
export const RESET_WEB_DIAMONDS = 20;
// How far above the base bag stack the passive web can push a gem or material stack (Gem Pouch / Ore Cart).
export const MAX_PASSIVE_GEM_STACK = 10;
export const MAX_PASSIVE_MATERIAL_STACK = 25;
