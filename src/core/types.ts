import type { GearItem, GearSet, GemType, Item, Rarity, Slot } from './items';

export type FeatureKind = 'goldVein' | 'diamondVein' | 'chest' | 'gem' | 'map';
export interface MetreRoll { feature: FeatureKind | null; amount: number; hardRock: boolean }
export type Container = GearSet | 'stash';
export type LootAction = 'keep' | 'sell' | 'salvage';
export type LootTarget = GearSet | Slot | 'gem' | 'any';
export interface LootRule { rarity: Rarity | 'any'; target: LootTarget; action: LootAction }
export type BagFullMode = 'sellWorst' | 'stop';
export interface Settings { lootFilter: LootRule[]; bagFull: BagFullMode }
export type LootOutcome = 'bag' | 'stash' | 'sold' | 'salvaged' | 'held';
export interface LootNote {
  name: string; rarity: Rarity | 'gem'; base: Slot | GemType; outcome: LootOutcome; value: number;
}
export interface FindRecord {
  id: number; depth: number; kind: FeatureKind; amount: number; tick: number; loot?: LootNote[];
}
export type InvResult = 'ok' | 'bagFull' | 'stashFull' | 'noSocket' | 'invalid';
export interface GameState {
  seed: number; rng: number; tickCount: number; lastTickAt: number;
  gold: number; diamonds: number;
  depth: number; deepest: number;          // whole metres; 0 = surface; depth <= deepest
  progress: number;                        // 0..1 toward metre deepest+1 (the dig face)
  galleryProgress: number;                 // 0..1 toward the next gallery find roll (depth < deepest)
  ahead: Record<number, MetreRoll>;        // pre-rolled metres deepest+1 .. deepest+lampSight
  finds: FindRecord[];                     // notable finds, oldest first, at most FINDS_LOG_LIMIT
  nextId: number;                          // next id for an item or a find; starts at 1
  goldCarry: number;                       // 0..1: Gold earned but not yet whole
  equipped: Record<GearSet, Partial<Record<Slot, GearItem>>>;
  bags: Record<GearSet, Item[]>;           // at most BAG_SIZE each; gear only in its own set's bag
  stash: Item[];                           // at most STASH_SIZE
  overflow: { bag: GearSet; item: Item }[]; // loot waiting for room (bagFull 'stop')
  lootTally: { kept: number; sold: number; salvaged: number };
  settings: Settings;                      // kept across ascension (Plan 6)
}
export interface Stats {
  digPower: number; autoTicksPerSecond: number; ticksPerClick: number; lampSight: number;
  offlineCapMs: number; featureChances: Record<FeatureKind, number>; hardRockChance: number;
  goldMultiplier: number; diamondMultiplier: number;
}
export type TickEvent =
  | { kind: 'gold'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'metre'; depth: number; gallery: boolean }
  | { kind: 'find'; find: FindRecord };
export interface OfflineSummary {
  elapsedMs: number; ticks: number; gold: number; diamonds: number; metres: number; capMs: number;
  finds: Record<FeatureKind, number>;
}
