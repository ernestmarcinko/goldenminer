export const RARITIES = ['normal', 'magic', 'rare', 'legendary'] as const;
export const GEAR_SETS = ['mining', 'battle'] as const;
export const MINING_SLOTS = ['pickaxe', 'lamp', 'gloves', 'boots'] as const;
export const BATTLE_SLOTS = ['weapon', 'armor', 'helm', 'ring', 'amulet'] as const;
export const MINING_STATS = ['digPower', 'goldYield', 'diamondYield', 'chestFind', 'gemFind', 'mapFind',
  'lampSight', 'ticksPerClick', 'autoTickRate', 'offlineCap'] as const;
export const BATTLE_STATS = ['damage', 'damagePct', 'attackSpeed', 'life', 'armor', 'critChance',
  'resistAll', 'soulFind', 'magicFind'] as const;
export const GEM_TYPES = ['ruby', 'sapphire', 'emerald', 'amethyst', 'starstone'] as const;
export const GEM_GRADES = ['tiny', 'small', 'big', 'giant', 'perfect'] as const;
export const MATERIALS = ['copper', 'tin', 'iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal'] as const;

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

export interface StatLine { stat: StatKey; value: number }
export interface Gem { gem: GemType; grade: GemGrade }
export interface GemItem extends Gem { id: number; type: 'gem'; count: number }
export interface GearItem {
  id: number; type: 'gear'; slot: Slot; name: string; rarity: Rarity; ilvl: number;
  implicit: StatLine; affixes: StatLine[]; sockets: number; gems: Gem[]; uniqueId?: string;
}
export type Item = GearItem | GemItem;
export type Cell = Item | null;

export const SLOT_IMPLICIT: Readonly<Record<Slot, StatKey>> = {
  pickaxe: 'digPower', lamp: 'lampSight', gloves: 'goldYield', boots: 'offlineCap',
  weapon: 'damage', armor: 'armor', helm: 'life', ring: 'critChance', amulet: 'damagePct',
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
