import type { Cell, GearItem, GearSet, GemGrade, GemType, Rarity, Slot } from './items';

export const FEATURE_KINDS = ['goldVein', 'diamondVein', 'chest', 'gem', 'map'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];
export interface MetreRoll { feature: FeatureKind | null; amount: number; hardRock: boolean }
/** Where an item lives: a bag cell, a General-tab cell, a Gems-tab stack, or a worn slot. */
export type ItemLoc =
  | { where: 'bag'; set: GearSet; index: number }
  | { where: 'stash'; index: number }                   // a General-tab cell
  | { where: 'gems'; gem: GemType; grade: GemGrade }    // a Gems-tab stack
  | { where: 'worn'; slot: Slot };
export type DropTarget = ItemLoc | { where: 'stashTab'; tab: 'general' | 'gems' | 'auto' };
export const LOOT_ACTIONS = ['keep', 'sell', 'salvage'] as const;
export type LootAction = (typeof LOOT_ACTIONS)[number];
export type LootTarget = GearSet | Slot | 'gem' | 'any';
export interface LootRule { rarity: Rarity | 'any'; target: LootTarget; action: LootAction }
export const BAG_FULL_MODES = ['sellWorst', 'stop'] as const;
export type BagFullMode = (typeof BAG_FULL_MODES)[number];
export const SHAFT_MOTIONS = ['step', 'smooth', 'off'] as const;
export type ShaftMotion = (typeof SHAFT_MOTIONS)[number];
export interface MotionSettings { floats: boolean; pops: boolean; lampFlicker: boolean; shaft: ShaftMotion }
export const DEFAULT_MOTION: MotionSettings = { floats: true, pops: true, lampFlicker: true, shaft: 'step' };
export interface Settings { lootFilter: LootRule[]; bagFull: BagFullMode; motion: MotionSettings }
export const LOOT_OUTCOMES = ['bag', 'stash', 'sold', 'salvaged', 'held'] as const;
export type LootOutcome = (typeof LOOT_OUTCOMES)[number];
export interface LootNote {
  name: string; rarity: Rarity | 'gem'; base: Slot | GemType; outcome: LootOutcome; value: number;
}
export const ELEMENTS = ['physical', 'elemental'] as const;
export type Element = (typeof ELEMENTS)[number];
export const RANKS = ['normal', 'champion', 'boss'] as const;
export type Rank = (typeof RANKS)[number];
export const CHAMPION_MODS = ['armored', 'swift', 'vampiric', 'fireTouched', 'brutal', 'thickSkinned'] as const;
export type ChampionMod = (typeof CHAMPION_MODS)[number];
export const RUN_OUTCOMES = ['cleared', 'died', 'left'] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];
export interface MapItem { id: number; type: 'map'; tier: number; metre: number }
export interface MonsterState {
  name: string; species: number; rank: Rank; mods: ChampionMod[]; extra: number;   // extra: the look seed for champion/boss parts
  element: Element; life: number; maxLife: number; damage: number; intervalS: number; xp: number;
}
export type CombatLine =
  | { kind: 'hit'; monster: string; amount: number; crit: boolean; click: boolean }
  | { kind: 'hurt'; monster: string; amount: number }
  | { kind: 'heal'; monster: string; amount: number }
  | { kind: 'kill'; monster: string; xp: number; souls: number }
  | { kind: 'room'; room: number }
  | { kind: 'level'; level: number }
  | { kind: 'drop'; note: LootNote };
export interface RunGains { xp: number; souls: number; gold: number; levels: number }
export interface MapRun {
  map: MapItem; room: number; bossRoom: number;   // rooms 1..bossRoom; bossRoom = regular rooms + 1 (5..8)
  queue: MonsterState[];                           // monsters left in this room, the fighting one first; never empty
  life: number; hitCarry: number; monsterCarry: number;
  gained: RunGains; log: CombatLine[]; loot: LootNote[];
}
export interface RunResult { map: MapItem; outcome: RunOutcome; room: number; bossRoom: number; gained: RunGains; items: number; seen: boolean }
export type Activity = { kind: 'dig' } | { kind: 'map'; run: MapRun };
export interface FindRecord {
  id: number; depth: number; kind: FeatureKind; amount: number; tick: number; loot?: LootNote[]; bonus?: true;
}
export type InvResult =
  | 'ok' | 'bagFull' | 'stashFull' | 'noSocket' | 'invalid'
  | 'wrongSet' | 'wrongSlot' | 'gemsOnly' | 'gearOnly' | 'stackFull';
export interface GameState {
  seed: number;                            // the world seed: a pure function of worldSeed
  worldSeed: string;                       // the text the player sees and shares
  worldGen: 1 | 2;                         // 1 = pre-seed saves, 2 = procedural worlds
  rng: number; tickCount: number; lastTickAt: number;
  gold: number; diamonds: number;
  depth: number; deepest: number;          // whole metres; 0 = surface; depth <= deepest
  progress: number;                        // 0..1 toward metre deepest+1 (the dig face)
  galleryProgress: number;                 // 0..1 toward the next gallery find roll (depth < deepest)
  ahead: Record<number, MetreRoll>;        // pre-rolled metres deepest+1 .. deepest+lampSight
  finds: FindRecord[];                     // notable finds, oldest first, at most FINDS_LOG_LIMIT
  nextId: number;                          // next id for an item or a find; starts at 1
  goldCarry: number;                       // 0..1: Gold earned but not yet whole
  equipped: Record<GearSet, Partial<Record<Slot, GearItem>>>;
  bags: Record<GearSet, Cell[]>;           // exactly BAG_SIZE cells each; gear only in its own set's bag; gem stacks of 1..GEM_BAG_STACK
  stash: {
    general: (GearItem | null)[];          // exactly STASH_SIZE cells, gear only
    gems: Record<GemType, Record<GemGrade, number>>;   // the Gems tab: counts of 0..GEM_STASH_STACK
    maps: MapItem[];                       // the Maps tab: at most MAP_STASH_SIZE, oldest first
  };
  overflow: { bag: GearSet; item: GearItem }[]; // gear waiting for room (bagFull 'stop')
  lootTally: { kept: number; sold: number; salvaged: number };
  settings: Settings;                      // kept across ascension (Plan 6)
  level: number; xp: number;               // character level 1..LEVEL_CAP; xp toward the next level
  souls: number;
  activity: Activity;                      // digging, or running a map
  lastRun: RunResult | null;               // the most recent run, until the player has seen it
  mapTally: { cleared: number; lost: number };
}
export interface Stats {
  digPower: number; autoTicksPerSecond: number; ticksPerClick: number; lampSight: number;
  offlineCapMs: number; featureChances: Record<FeatureKind, number>; hardRockChance: number;
  goldMultiplier: number; diamondMultiplier: number;
  bonusChances: { chest: number; gem: number; map: number };   // find gear: extra finds on empty metres, drawn from state.rng
}
export type TickEvent =
  | { kind: 'gold'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'metre'; depth: number; gallery: boolean }
  | { kind: 'find'; find: FindRecord };
export interface OfflineSummary {
  elapsedMs: number; ticks: number; gold: number; diamonds: number; metres: number; capMs: number;
  finds: Record<FeatureKind, number>;
  items: { kept: number; sold: number; salvaged: number };
  stoppedBag: GearSet | null;
}
