import type {
  Cell, GearItem, GearSet, GemGrade, GemType, Item, MapItem, MapMod, MapModKind, MapRarity, Material, Rarity, Slot,
} from './items';

export type { MapItem, MapMod, MapRarity };
export const FEATURE_KINDS = ['goldVein', 'diamondVein', 'chest', 'gem', 'map'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];
export const FIND_KINDS = [...FEATURE_KINDS, 'materialVein'] as const;
export type FindKind = (typeof FIND_KINDS)[number];
export const HAZARDS = ['gas', 'unstable'] as const;
export type Hazard = (typeof HAZARDS)[number];
export interface MetreRoll { feature: FeatureKind | null; amount: number; hardRock: boolean }
/**
 * Where an item lives: a bag cell, a General cell (any page), a map in a tier list, a Gems or Materials stack, a worn
 * slot, or a slot of the Trader's stock (never saved; nothing moves into or out of it but a buy).
 */
export type ItemLoc =
  | { where: 'bag'; index: number }
  | { where: 'stash'; index: number }                   // a General cell, any page
  | { where: 'maps'; tier: number; index: number }      // a map in the Map stash's list for its tier
  | { where: 'gems'; gem: GemType; grade: GemGrade }    // a Gems-tab stack
  | { where: 'materials'; material: Material }          // a Materials-tab stack (virtual, id 0, while its count > 0)
  | { where: 'worn'; slot: Slot }
  | { where: 'stock'; index: number };
export type DropTarget = ItemLoc | { where: 'stashTab'; tab: 'general' | 'gems' | 'maps' | 'materials' | 'auto' };
export const LOOT_ACTIONS = ['keep', 'sell', 'salvage', 'stash'] as const;
export type LootAction = (typeof LOOT_ACTIONS)[number];
export const LOOT_KINDS = ['gear', 'gem', 'map', 'material'] as const;
export type LootKind = (typeof LOOT_KINDS)[number];
/** An inclusive range; a missing end is open. */
export interface LootRange { min?: number; max?: number }
/**
 * A loot filter rule: every field set must hold for the item, and a field that does not apply to the item's kind fails
 * the match. `level` is gear's item level or a map's tier; `modTier` holds when some modifier is at or above it.
 */
export interface LootRule {
  kind: LootKind | 'any'; action: LootAction;
  set?: GearSet; slot?: Slot; rarity?: Rarity; level?: LootRange; modTier?: number; mods?: LootRange;
  mapMod?: MapModKind; gem?: GemType; grade?: GemGrade; material?: Material;
}
export const SHAFT_MOTIONS = ['step', 'smooth', 'off'] as const;
export type ShaftMotion = (typeof SHAFT_MOTIONS)[number];
export interface MotionSettings { floats: boolean; pops: boolean; lampFlicker: boolean; shaft: ShaftMotion }
export const DEFAULT_MOTION: MotionSettings = { floats: true, pops: true, lampFlicker: true, shaft: 'step' };
export interface Settings { lootFilter: LootRule[]; motion: MotionSettings }
export const LOOT_OUTCOMES = ['bag', 'stash', 'sold', 'salvaged', 'held'] as const;
export type LootOutcome = (typeof LOOT_OUTCOMES)[number];
/**
 * `value` is the Gold for 'sold', the material units for 'salvaged', and the units found for a material note. A map's
 * note has base 'map' and its map rarity.
 */
export interface LootNote {
  name: string; rarity: Rarity | 'gem' | 'material'; base: Slot | GemType | Material | 'map'; outcome: LootOutcome; value: number;
}
/** Where a logged find came from: a dug metre, a room of a map, or the merchant. */
export type DropOrigin = { kind: 'metre'; metre: number } | { kind: 'map'; tier: number; room: number } | { kind: 'merchant' };
export const TRAIL_EVENTS = [
  'bag', 'held', 'filterSold', 'filterSalvaged', 'filterStashed', 'stashed', 'toBag', 'equipped', 'sold', 'salvaged', 'crafted',
  'upgraded', 'run', 'lost',
] as const;
export type TrailEvent = (typeof TRAIL_EVENTS)[number];
export interface TrailStep { event: TrailEvent; gold?: number; materials?: Partial<Record<Material, number>> }
/** One find in the drop log; its id is the item's (a material find takes its own), and its trail is what became of it. */
export interface DropEntry {
  id: number; kind: Item['type']; name: string; rarity: Rarity | 'gem' | 'material'; base: Slot | GemType | Material | 'map';
  count: number; origin: DropOrigin; trail: TrailStep[];
}
/** One death in a map: `at` is its wall time, `map` the map as it was lost. */
export interface DeathEntry { id: number; tick: number; at: number; map: MapItem; room: number; bossRoom: number; killer: string }
export const ELEMENTS = ['physical', 'elemental'] as const;
export type Element = (typeof ELEMENTS)[number];
export const RANKS = ['normal', 'champion', 'boss'] as const;
export type Rank = (typeof RANKS)[number];
export const CHAMPION_MODS = ['armored', 'swift', 'vampiric', 'fireTouched', 'brutal', 'thickSkinned'] as const;
export type ChampionMod = (typeof CHAMPION_MODS)[number];
export const RUN_OUTCOMES = ['cleared', 'died', 'left'] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];
export interface MonsterState {
  name: string; species: number; rank: Rank; mods: ChampionMod[]; extra: number;   // extra: the look seed for champion/boss parts
  element: Element; life: number; maxLife: number; damage: number; intervalS: number; xp: number;
}
export type CombatLine =
  | { kind: 'hit'; monster: string; amount: number; crit: boolean }
  | { kind: 'hurt'; monster: string; amount: number }
  | { kind: 'heal'; monster: string; amount: number }
  | { kind: 'kill'; monster: string; xp: number; souls: number }
  | { kind: 'room'; room: number }
  | { kind: 'level'; level: number }
  | { kind: 'drop'; note: LootNote }
  | { kind: 'saved'; monster: string };
export interface RunGains { xp: number; souls: number; gold: number; levels: number }
export interface MapRun {
  map: MapItem; room: number; bossRoom: number;   // rooms 1..bossRoom; bossRoom = regular rooms + 1 (5..8)
  queue: MonsterState[];                           // monsters left in this room, the fighting one first; never empty
  life: number; hitCarry: number; monsterCarry: number; regenCarry: number;   // regenCarry: the life regenerated short of a whole point
  gained: RunGains; log: CombatLine[]; loot: LootNote[];   // loot keeps the newest RUN_LOOT_LIMIT notes
  items: number;                                   // gear and gems dropped this run, every one counted (material stacks are not items)
  strikes: number;                                 // every strike of the run, for the Peacemaker
  saved?: true;                                    // Kraken Leather has fired this run
}
export interface RunResult { map: MapItem; outcome: RunOutcome; room: number; bossRoom: number; gained: RunGains; items: number; seen: boolean }
export type Activity = { kind: 'dig' } | { kind: 'map'; run: MapRun };
export interface FindRecord {
  id: number; depth: number; kind: FindKind; amount: number; tick: number; loot?: LootNote[]; bonus?: true;
  material?: Material;                     // set exactly when kind is 'materialVein'
}
export type InvResult =
  | 'ok' | 'bagFull' | 'stashFull' | 'noSocket' | 'invalid' | 'busy'
  | 'wrongSlot' | 'gemsOnly' | 'gearOnly' | 'mapsOnly' | 'materialsOnly' | 'stackFull' | 'craftRefused' | 'mapTierFull';
/** What a craft spends: a material, or Diamonds for the exalt. */
export type CraftKind = Material | 'diamond';
export type CraftCheck =
  | 'ok' | 'notGear' | 'legendary' | 'sealed' | 'wrongRarity' | 'noRoom' | 'nothingToChange' | 'short' | 'gemsFull'
  | 'notForMaps' | 'noSouls';
export type TemperOutcome = 'craftedLine' | 'raiseTiers' | 'nothing' | 'ruin';
export interface CraftResult { check: CraftCheck; temper?: TemperOutcome }
export interface GameState {
  seed: number;                            // the world seed: a pure function of worldSeed
  worldSeed: string;                       // the text the player sees and shares
  worldGen: 1 | 2;                         // 1 = pre-seed saves, 2 = procedural worlds
  rng: number; tickCount: number; lastTickAt: number;
  gold: number; diamonds: number;
  deepest: number;                         // whole metres dug; 0 = surface; the miner works the face below it
  progress: number;                        // 0..1 toward metre deepest+1 (the dig face)
  ahead: Record<number, MetreRoll>;        // pre-rolled metres deepest+1 .. deepest+lampSight
  finds: FindRecord[];                     // notable finds, oldest first, at most FINDS_LOG_LIMIT
  nextId: number;                          // next id for an item or a find; starts at 1
  equipped: Record<GearSet, Partial<Record<Slot, GearItem>>>;
  bag: Cell[];                             // exactly BAG_SIZE: gear of either set, gem stacks 1..GEM_BAG_STACK, material stacks 1..MATERIAL_BAG_STACK, maps
  stash: {
    general: (GearItem | null)[];          // STASH_PAGE_SIZE × pages, START_GENERAL_PAGES..MAX_STASH_PAGES pages
    gems: Record<GemType, Record<GemGrade, number>>;   // the Gems tab: counts of 0..GEM_STASH_STACK
    maps: Record<number, MapItem[]>;       // keyed by tier, at most MAP_TIER_CAP each, in the order put in; an emptied tier loses its key
    materials: Record<Material, number>;   // 0..MATERIAL_STASH_STACK each
    bought: { general: number };           // General pages bought with Gold; free pages never count
  };
  overflow: Item[];                        // finds held for want of room, oldest first, at most MAX_HELD; digging waits on them
  lootTally: { kept: number; sold: number; salvaged: number };
  settings: Settings;                      // kept across ascension (Plan 6)
  level: number; xp: number;               // character level 1..LEVEL_CAP; xp toward the next level
  souls: number;
  activity: Activity;                      // digging, or running a map
  lastRun: RunResult | null;               // the most recent run; the Last run card keeps showing it, and `seen` is whether the result dialog was dismissed
  mapTally: { cleared: number; lost: number };
  paused: boolean;                         // the player's Pause: digging waits, map runs go on
  drops: DropEntry[];                      // the drop log, oldest first, at most DROP_LOG_LIMIT
  deaths: DeathEntry[];                    // the death log, oldest first, at most DEATH_LOG_LIMIT
  merchant: { band: number; bought: number[] };   // the stock band the Trader's slots were bought in, and their indexes
  uniqueRng: number;                       // the uniques' own stream, so state.rng is the same for a player without them
  passives: { allocated: string[] };       // the passive web's allocated node ids, in allocation order
}
export interface Stats {
  digPower: number; autoTicksPerSecond: number; ticksPerClick: number; lampSight: number;
  offlineCapMs: number; featureChances: Record<FeatureKind, number>; hardRockChance: number;
  goldMultiplier: number; diamondMultiplier: number; hazardWard: number;
  bonusChances: { chest: number; gem: number; map: number };   // find gear: extra finds on empty metres, drawn from state.rng
  veinMultiplier: number;                  // every vein: Gold, Diamonds and material
  oreBonusChance: number;                  // ore find: a bonus material vein on metres the seed left empty, drawn from state.rng
  sellMultiplier: number; salvageMultiplier: number;
  hazardSight: number;                     // metres past the face whose hazards show on the minimap (Black Lantern)
  hazardSlow: number;                      // the share of a hazard's slowdown left after ward (Black Lantern)
}
export type TickEvent =
  | { kind: 'gold'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'metre'; depth: number }
  | { kind: 'find'; find: FindRecord }
  | { kind: 'strike'; amount: number; crit: boolean }
  | { kind: 'hurt'; amount: number }
  | { kind: 'runEnd'; result: RunResult };
export interface OfflineSummary {
  elapsedMs: number; ticks: number; gold: number; diamonds: number; metres: number; capMs: number;
  souls: number; levels: number;
  maps: { cleared: number; lost: number };
  finds: Record<FindKind, number>;
  items: { kept: number; sold: number; salvaged: number };
  bagStopped: boolean;
  paused: boolean;
}
