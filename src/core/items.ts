export const RARITIES = ['normal', 'magic', 'rare', 'legendary'] as const;
export const GEAR_SETS = ['mining', 'battle'] as const;
export const MINING_SLOTS = ['pickaxe', 'lamp', 'gloves', 'boots'] as const;
export const BATTLE_SLOTS = ['weapon', 'armor', 'helm', 'ring', 'amulet'] as const;
export const MINING_STATS = ['digPower', 'goldYield', 'diamondYield', 'chestFind', 'gemFind', 'mapFind',
  'lampSight', 'ticksPerClick', 'autoTickRate', 'offlineCap', 'hazardWard',
  'digPowerPct', 'veinYield', 'oreFind', 'salvageYield', 'sellBonus'] as const;
export const BATTLE_STATS = ['damage', 'damagePct', 'attackSpeed', 'life', 'armor', 'critChance',
  'resistAll', 'soulFind', 'magicFind',
  'elementalDamage', 'critMultiplier', 'lifePct', 'armorPct', 'lifeRegen', 'lifeOnKill', 'xpFind'] as const;
export const GEM_TYPES = ['ruby', 'sapphire', 'emerald', 'amethyst', 'starstone'] as const;
export const GEM_GRADES = ['tiny', 'small', 'big', 'giant', 'perfect'] as const;
export const MATERIALS = ['copper', 'tin', 'iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal'] as const;
/** The highest tier an essence can have; each of the 32 stats has one essence per tier 1..ESSENCE_TIER_MAX. */
export const ESSENCE_TIER_MAX = 6;
export const MAP_MOD_KINDS = ['monsterLife', 'monsterDamage', 'monsterSpeed', 'bossPower', 'weakHealing', 'hardened'] as const;
export const MAP_SPECIALS = ['bossLegendary', 'treasureRoom', 'championPacks', 'doubleMaterials', 'tripleSouls', 'secondBoss'] as const;

export type Rarity = (typeof RARITIES)[number];
export type GearSet = (typeof GEAR_SETS)[number];
export type MiningSlot = (typeof MINING_SLOTS)[number];
export type BattleSlot = (typeof BATTLE_SLOTS)[number];
export type Slot = MiningSlot | BattleSlot;
export type MiningStat = (typeof MINING_STATS)[number];
export type BattleStat = (typeof BATTLE_STATS)[number];
export type StatKey = MiningStat | BattleStat;
export type GemType = (typeof GEM_TYPES)[number];
export type GemGrade = (typeof GEM_GRADES)[number];
export type Material = (typeof MATERIALS)[number];
export type MapModKind = (typeof MAP_MOD_KINDS)[number];
export type MapSpecial = (typeof MAP_SPECIALS)[number];
export type MapRarity = 'normal' | 'magic' | 'rare';

export interface StatLine { stat: StatKey; value: number }
/** A rolled modifier; `tier` is 0 only for a legendary's hand-written line. */
export interface ModLine { stat: StatKey; value: number; tier: number; crafted?: true }
export interface Gem { gem: GemType; grade: GemGrade }
export interface GemItem extends Gem { id: number; type: 'gem'; count: number }
export interface GearItem {
  id: number; type: 'gear'; slot: Slot; name: string; rarity: Rarity; ilvl: number;
  implicit: StatLine; affixes: ModLine[]; sockets: number; gems: Gem[]; uniqueId?: string;
  /** Set by tempering: the item takes no more crafts. */
  sealed?: true;
}
export interface MaterialItem { id: number; type: 'material'; material: Material; count: number }
/** A map modifier: each kind at most once on a map, rolled in its tier's range. */
export interface MapMod { kind: MapModKind; tier: number; value: number }
export interface MapItem {
  id: number; type: 'map'; tier: number; metre: number; rarity: MapRarity; mods: MapMod[];
  /** Set by tempering: the map takes no more enchanting. */
  sealed?: true;
  /** At most one, outside `mods`: never counted toward the six, and no enchant removes it. */
  special?: MapSpecial;
}
/** A crafting essence: adds or rerolls its exact stat at a tier in `[tier, tier + 2]`, capped by the item. */
export interface EssenceItem { id: number; type: 'essence'; stat: StatKey; tier: number; count: number }
/** The side a generic orb aims at. */
export type OrbSide = 'prefix' | 'suffix';
/** A generic orb: adds a random line on its side in the item's own band. */
export interface OrbItem { id: number; type: 'orb'; side: OrbSide; count: number }
export type Item = GearItem | GemItem | MaterialItem | MapItem | EssenceItem | OrbItem;
/** What stacks in a bag cell and counts up in its stash tab. */
export type Stack = GemItem | MaterialItem | EssenceItem | OrbItem;
export type Cell = Item | null;

/** Every stat, in mining then battle order: the set an essence may carry. */
export const ALL_STATS: readonly StatKey[] = [...MINING_STATS, ...BATTLE_STATS];

/** The Essences-tab key for an essence: `"stat:tier"`. */
export function essenceKey(stat: StatKey, tier: number): string {
  return `${stat}:${tier}`;
}

/** Reads an Essences-tab key back: `"stat:tier"` for an essence, `"prefix"`/`"suffix"` for an orb. */
export function parseEssenceKey(key: string): { stat: StatKey; tier: number } | OrbSide | undefined {
  if (key === 'prefix' || key === 'suffix') return key;
  const i = key.lastIndexOf(':');
  if (i <= 0 || i === key.length - 1) return undefined;
  const stat = key.slice(0, i);
  const tier = Number(key.slice(i + 1));
  if (!(ALL_STATS as readonly string[]).includes(stat)) return undefined;
  if (!Number.isInteger(tier) || tier < 1 || tier > ESSENCE_TIER_MAX) return undefined;
  return { stat: stat as StatKey, tier };
}

export const SLOT_IMPLICIT: Readonly<Record<Slot, StatKey>> = {
  pickaxe: 'digPower', lamp: 'lampSight', gloves: 'goldYield', boots: 'offlineCap',
  weapon: 'damage', armor: 'armor', helm: 'life', ring: 'critChance', amulet: 'damagePct',
};

/**
 * Which stats on a slot are *local*: they multiply that slot's own base/affix values before the global pool adds the
 * rest on top. A weapon's `damage`/`damagePct` raise the weapon's own flat damage first; an armor's `armor`/`armorPct`
 * raise the armor's own flat first; a pickaxe's `digPower`/`digPowerPct` raise the base dig power plus the pickaxe's
 * own flat first. Everything else is global.
 */
export const LOCAL_STATS: Readonly<Partial<Record<Slot, readonly StatKey[]>>> = {
  weapon: ['damage', 'damagePct'],
  armor: ['armor', 'armorPct'],
  pickaxe: ['digPower', 'digPowerPct'],
};

/** Which side of an item's name a modifier sits on; each gear set has 8 prefixes and 8 suffixes. */
export const MOD_SIDE: Readonly<Record<StatKey, 'prefix' | 'suffix'>> = {
  digPower: 'prefix', digPowerPct: 'prefix', goldYield: 'prefix', diamondYield: 'prefix', veinYield: 'prefix',
  autoTickRate: 'prefix', ticksPerClick: 'prefix', sellBonus: 'prefix',
  chestFind: 'suffix', gemFind: 'suffix', mapFind: 'suffix', oreFind: 'suffix', lampSight: 'suffix',
  offlineCap: 'suffix', hazardWard: 'suffix', salvageYield: 'suffix',
  damage: 'prefix', damagePct: 'prefix', elementalDamage: 'prefix', attackSpeed: 'prefix', critChance: 'prefix',
  critMultiplier: 'prefix', life: 'prefix', lifePct: 'prefix',
  armor: 'suffix', armorPct: 'suffix', resistAll: 'suffix', lifeRegen: 'suffix', lifeOnKill: 'suffix',
  soulFind: 'suffix', magicFind: 'suffix', xpFind: 'suffix',
};

export function setOfSlot(slot: Slot): GearSet {
  return (MINING_SLOTS as readonly string[]).includes(slot) ? 'mining' : 'battle';
}
export function slotsOf(set: GearSet): readonly Slot[] {
  return set === 'mining' ? MINING_SLOTS : BATTLE_SLOTS;
}
export function statsOf(set: GearSet): readonly StatKey[] {
  return set === 'mining' ? MINING_STATS : BATTLE_STATS;
}
export function isGear(item: Item): item is GearItem {
  return item.type === 'gear';
}
export function isStack(item: Item): item is Stack {
  return item.type === 'gem' || item.type === 'material' || item.type === 'essence' || item.type === 'orb';
}
export function isMap(item: Item): item is MapItem {
  return item.type === 'map';
}
