import { compressToBase64, decompressFromBase64 } from 'lz-string';
import {
  BAG_SIZE, COMBAT_LOG_LIMIT, DEATH_LOG_LIMIT, DROP_LOG_LIMIT, ESSENCE_BAG_STACK, ESSENCE_STASH_STACK, FINDS_LOG_LIMIT,
  GEM_BAG_STACK, GEM_STASH_STACK, LEVEL_CAP, MAP_TIER_CAP, MATERIAL_BAG_STACK, MATERIAL_STASH_STACK, MAX_CRAFTED_LINES,
  MAX_DAMAGE, MAX_HELD, MAX_ITEM_LEVEL, MAX_LIFE, MAX_LOOT_RULES, MAX_MAP_MODS, MAX_PASSIVE_GEM_STACK,
  MAX_PASSIVE_MATERIAL_STACK, MAX_ROOMS, MAX_SIDE_LINES, MAX_SOCKETS, MAX_STASH_PAGES, MAX_TIER_OVER_CAP, MAX_TRAIL_STEPS,
  MONSTER_BUDGET, PREMIUM_CAP, RUN_LOOT_LIMIT, RUNE_BAG_STACK, RUNE_RNG_SALT, RUNE_STASH_STACK, START_GENERAL_PAGES,
  STASH_PAGE_SIZE, STOCK_SIZE, stashPagePrice,
} from './balance';
import { ACHIEVEMENT_IDS } from './achievements';
import { ASCENDANCY_NODE_BY_ID, ASCENDANCY_NODE_COUNT, ASCENDANCY_START_ID, MAX_ASCENDANCY_PASSIVE_POINTS, ascendancyTotals } from './ascendancy';
import { metreTier } from './bands';
import { emptyGemCounts, emptyMaterialCounts, emptyRuneCounts, pageCount } from './cells';
import { dungeonIndexAt, dungeonType } from './dungeons';
import { gemGradeFor, itemName } from './itemData';
import { sideCount } from './itemGen';
import { sellValue } from './loot';
import { isOldLootFilter, migrateLootFilter, ruleValid } from './lootFilter';
import { defaultCharacterName, isValidCharacterName } from './names';
import { emptyPremium } from './oreMarket';
import { isConnectedWeb, PASSIVE_NODE_BY_ID, START_NODE_ID } from './passives';
import { emptyLifetimeStats } from './telemetry';
import {
  BATTLE_STATS, ESSENCE_TIER_MAX, GEAR_SETS, GEM_GRADES, GEM_TYPES, MAP_MOD_KINDS, MAP_SPECIALS, MATERIALS, MINING_STATS,
  MOD_SIDE, RARITIES, RUNE_TYPES, parseEssenceKey, setOfSlot, slotsOf, statsOf,
} from './items';
import type { Cell, GearItem, GearSet, GemItem, GemType, MapItem, MapMod, MapRarity, ModLine, RuneItem, RuneType, Slot, StatKey } from './items';
import { xpToNext } from './levels';
import { hash2 } from './rng';
import { isValidSeedText, seedFromText } from './seed';
import { speciesOf } from './species';
import { tierFor } from './tiers';
import {
  CHAMPION_MODS, DEFAULT_MOTION, ELEMENTS, FEATURE_KINDS, FIND_KINDS, LOOT_ACTIONS, LOOT_KINDS, LOOT_OUTCOMES, RANKS, RUN_OUTCOMES,
  SHAFT_MOTIONS, TRAIL_EVENTS, type DropEntry, type GameState, type LifetimeStats, type LootRule,
} from './types';

export const SCHEMA_VERSION = 17;

export type DecodeResult =
  | { ok: true; state: GameState; savedAt: number }
  | { ok: false; reason: 'corrupt' | 'future' | 'invalid' };

export type Migration = (state: unknown) => unknown;

const MAX_MIGRATED_METRE = 30_000_000;
// The schema-5 shapes the older migrations build; MIGRATIONS[5] turns them into today's.
const OLD_BAG_SIZE = 24;
const OLD_GENERAL_SIZE = 60;
const OLD_MAPS_KEPT = 200;
const OLD_MAP_PAGES = 1;

export const MIGRATIONS: Record<number, Migration> = {
  1: (state) => {
    if (!isObject(state) || !Array.isArray(state.finds)) return state;
    const finds = state.finds.map((f: unknown, i: number) => (isObject(f) ? { ...f, id: i + 1 } : f));
    return {
      ...state,
      finds,
      nextId: finds.length + 1,
      goldCarry: 0,
      equipped: { mining: {}, battle: {} },
      bags: { mining: [], battle: [] },
      stash: [],
      overflow: [],
      lootTally: { kept: 0, sold: 0, salvaged: 0 },
      settings: { lootFilter: [], bagFull: 'sellWorst' },
    };
  },
  2: (state) => {
    if (!isObject(state) || typeof state.seed !== 'number' || !isObject(state.settings)) return state;
    return {
      ...state,
      worldSeed: String(state.seed),
      worldGen: 1,
      settings: { ...state.settings, motion: { ...DEFAULT_MOTION } },
    };
  },
  3: (state) => {
    if (
      !isObject(state) || !isObject(state.equipped) || !isObject(state.bags) || !Array.isArray(state.bags.mining) ||
      !Array.isArray(state.bags.battle) || !Array.isArray(state.stash) || !Array.isArray(state.overflow)
    ) return state;
    const tab = emptyGemCounts();
    const toTab = (g: OldGem): void => { tab[g.gem][gemGradeFor(g.ilvl)] += 1; };
    // Identical bag gems merge into stacks at the first one's place; the gaps close, then the grid is padded.
    const bagOf = (old: unknown[]): unknown[] => {
      const cells: unknown[] = [];
      for (const item of old) {
        if (!isOldGem(item)) { cells.push(withSocketed(item)); continue; }
        const grade = gemGradeFor(item.ilvl);
        const stack = cells.find(
          (c): c is GemItem =>
            isObject(c) && c.type === 'gem' && c.gem === item.gem && c.grade === grade && isNonNegInt(c.count) &&
            c.count < GEM_BAG_STACK,
        );
        if (stack) stack.count += 1;
        else cells.push({ id: item.id, type: 'gem', gem: item.gem, grade, count: 1 });
      }
      return padCells(cells, OLD_BAG_SIZE);
    };
    const general: unknown[] = [];
    for (const item of state.stash) {
      if (isOldGem(item)) toTab(item);
      else general.push(withSocketed(item));
    }
    const overflow: unknown[] = [];
    for (const held of state.overflow) {
      if (isObject(held) && isOldGem(held.item)) toTab(held.item);
      else overflow.push(isObject(held) ? { ...held, item: withSocketed(held.item) } : held);
    }
    const wornOf = (worn: unknown): unknown =>
      isObject(worn) ? Object.fromEntries(Object.entries(worn).map(([slot, item]) => [slot, withSocketed(item)])) : worn;
    return {
      ...state,
      equipped: { mining: wornOf(state.equipped.mining), battle: wornOf(state.equipped.battle) },
      bags: { mining: bagOf(state.bags.mining), battle: bagOf(state.bags.battle) },
      stash: { general: padCells(general, OLD_GENERAL_SIZE), gems: tab },
      overflow,
    };
  },
  4: (state) => {
    if (!isObject(state) || !Array.isArray(state.finds) || !isObject(state.stash) || !isNonNegInt(state.nextId)) return state;
    // Every past map find becomes a map of the tier its metre was dug at; the Maps tab keeps the newest.
    let nextId = state.nextId;
    const maps: Omit<MapItem, 'rarity' | 'mods'>[] = [];
    for (const f of state.finds) {
      if (!isObject(f) || f.kind !== 'map') continue;
      const metre = f.depth;
      // An absurd depth is left for the validator to reject; the band maths below must never see it.
      if (!isNonNegInt(metre) || metre < 1 || metre > MAX_MIGRATED_METRE) return state;
      maps.push({ id: nextId++, type: 'map', tier: metreTier(metre), metre });
    }
    return {
      ...state,
      nextId,
      stash: { ...state.stash, maps: maps.slice(-OLD_MAPS_KEPT) },
      level: 1, xp: 0, souls: 0, activity: { kind: 'dig' }, lastRun: null, mapTally: { cleared: 0, lost: 0 },
    };
  },
  5: (state) => {
    if (
      !isObject(state) || !isObject(state.bags) || !Array.isArray(state.bags.mining) || !Array.isArray(state.bags.battle) ||
      !isObject(state.stash) || !Array.isArray(state.stash.general) || !Array.isArray(state.stash.maps) ||
      !Array.isArray(state.overflow)
    ) return state;
    // The two bags become one, the mining bag's items first; a valid schema-5 save carries at most 48.
    const carried = [...state.bags.mining, ...state.bags.battle].filter((c) => c !== null);
    if (carried.length > BAG_SIZE) return state;
    const mapPages = Math.max(OLD_MAP_PAGES, Math.ceil(state.stash.maps.length / STASH_PAGE_SIZE));
    const next: Record<string, unknown> = {
      ...state,
      bag: padCells(carried, BAG_SIZE),
      stash: {
        ...state.stash,
        general: padCells(state.stash.general, START_GENERAL_PAGES * STASH_PAGE_SIZE),
        maps: padCells(state.stash.maps, mapPages * STASH_PAGE_SIZE),
        materials: emptyMaterialCounts(),
        bought: { general: 0, maps: 0 },
      },
      overflow: state.overflow.map((held) => (isObject(held) ? held.item : held)),
    };
    // Galleries and the Gold carry are gone: the miner always works the face.
    for (const key of ['depth', 'galleryProgress', 'goldCarry', 'bags']) delete next[key];
    return next;
  },
  6: (state) => {
    if (
      !isObject(state) || !Array.isArray(state.bag) || !isObject(state.stash) || !Array.isArray(state.stash.general) ||
      !isObject(state.equipped) || !isObject(state.equipped.mining) || !isObject(state.equipped.battle) ||
      !Array.isArray(state.overflow)
    ) return state;
    let malformed = false;
    const tiered = (cell: unknown): unknown => {
      if (!isObject(cell) || cell.type !== 'gear') return cell;
      const affixes = tieredLines(cell);
      if (affixes === null) malformed = true;
      return { ...cell, affixes };
    };
    const wornOf = (worn: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(worn).map(([slot, item]) => [slot, tiered(item)]));
    const next: Record<string, unknown> = {
      ...state,
      bag: state.bag.map(tiered),
      stash: { ...state.stash, general: state.stash.general.map(tiered) },
      equipped: { ...state.equipped, mining: wornOf(state.equipped.mining), battle: wornOf(state.equipped.battle) },
      overflow: state.overflow.map(tiered),
    };
    // A run in progress starts its life-regeneration carry empty.
    const { activity } = state;
    if (isObject(activity) && activity.kind === 'map' && isObject(activity.run)) {
      next.activity = { ...activity, run: { ...activity.run, regenCarry: 0 } };
    }
    return malformed ? state : next;
  },
  7: (state) => {
    if (!isObject(state) || !Array.isArray(state.bag) || !isObject(state.stash) || !Array.isArray(state.stash.maps)) return state;
    // Every map so far is a normal one: wherever it lies, it gains a rarity and an empty modifier list.
    const normal = (cell: unknown): unknown => (isObject(cell) && cell.type === 'map' ? { ...cell, rarity: 'normal', mods: [] } : cell);
    const next: Record<string, unknown> = {
      ...state,
      bag: state.bag.map(normal),
      stash: { ...state.stash, maps: state.stash.maps.map(normal) },
    };
    const { activity, lastRun } = state;
    if (isObject(activity) && activity.kind === 'map' && isObject(activity.run)) {
      next.activity = { ...activity, run: { ...activity.run, map: normal(activity.run.map) } };
    }
    if (isObject(lastRun)) next.lastRun = { ...lastRun, map: normal(lastRun.map) };
    return next;
  },
  8: (state) => {
    if (
      !isObject(state) || !Array.isArray(state.bag) || !isObject(state.stash) || !Array.isArray(state.stash.maps) ||
      !isObject(state.stash.bought) || !Array.isArray(state.overflow) || !isObject(state.settings) || !isNonNegFinite(state.gold)
    ) return state;
    const { maps: cells, bought } = state.stash;
    // an absurd page count is left for the validator, so the refund below never loops on it
    if (!isNonNegInt(bought.maps) || bought.maps > MAX_STASH_PAGES) return state;
    // The Maps tab's pages become a list per tier, each in the tab's order. What a tier can't hold goes to the bag's
    // empty cells, then the held list, and past that is sold, so no map is lost silently.
    const maps: Record<number, unknown[]> = {};
    const spill: MapItem[] = [];
    for (const cell of cells) {
      if (cell === null) continue;
      if (!isObject(cell) || cell.type !== 'map' || !isItemLevel(cell.tier) || !isIn(MAP_RARITIES, cell.rarity)) return state;
      const list = (maps[cell.tier as number] ??= []);
      if (list.length < MAP_TIER_CAP) list.push(cell);
      else spill.push(cell as unknown as MapItem);
    }
    const bag = [...state.bag];
    const overflow = [...state.overflow];
    let gold = state.gold;
    for (let n = 1; n <= bought.maps; n++) gold += stashPagePrice(n);   // the Gold spent on Maps pages comes back
    // a sold map is logged under its own id, as found where it was dug, so the drop log says where it went
    const drops: DropEntry[] = [];
    for (const map of spill) {
      const empty = bag.indexOf(null);
      if (empty >= 0) bag[empty] = map;
      else if (overflow.length < MAX_HELD) overflow.push(map);
      else {
        const value = sellValue(map);
        gold += value;
        drops.push({
          id: map.id, kind: 'map', name: itemName(map), rarity: map.rarity, base: 'map', count: 1,
          origin: { kind: 'metre', metre: map.metre }, trail: [{ event: 'sold', gold: value }],
        });
      }
    }
    // 'sellWorst' is gone: a full bag always holds
    const { bagFull: _bagFull, ...settings } = state.settings;
    return {
      ...state,
      gold, bag, overflow, settings,
      stash: { ...state.stash, maps, bought: { general: bought.general } },
      paused: false, drops: drops.slice(-DROP_LOG_LIMIT), deaths: [],
    };
  },
  9: (state) => {
    if (
      !isObject(state) || !isObject(state.settings) || !isOldLootFilter(state.settings.lootFilter) || !isUint32(state.rng) ||
      !isObject(state.activity)
    ) return state;
    // Each old rule becomes the rules that act as it did; the Trader has sold nothing yet, and the uniques get their own stream.
    const next: Record<string, unknown> = {
      ...state,
      settings: { ...state.settings, lootFilter: migrateLootFilter(state.settings.lootFilter) },
      merchant: { band: 0, bought: [] },
      uniqueRng: hash2(state.rng, 0xa11e),
    };
    const { activity } = state;
    if (activity.kind === 'map' && isObject(activity.run)) next.activity = { ...activity, run: { ...activity.run, strikes: 0 } };
    return next;
  },
  10: (state) => {
    if (!isObject(state)) return state;
    // The passive web starts empty: old saves keep their level and every point unspent.
    return { ...state, passives: { allocated: [] } };
  },
  11: (state) => {
    if (!isObject(state)) return state;
    // Ascension, auto-mapping and the lifetime record start empty; nothing else changes.
    return {
      ...state,
      ascendancy: { points: 0, allocated: [] },
      autoMap: { queue: [] },
      lifetime: { ascensions: 0, deepest: 0 },
    };
  },
  12: (state) => {
    if (!isObject(state) || !isObject(state.stash)) return state;
    // The ore market starts with every premium at 0, and the Essences tab empty; nothing else changes.
    return {
      ...state,
      stash: { ...state.stash, essences: {} },
      oreMarket: { premium: emptyPremium() },
    };
  },
  13: (state) => {
    if (!isObject(state)) return state;
    // Achievements start empty (past progress is not back-filled), and the Plan-20 lifetime counters at zero.
    return {
      ...state,
      totals: {
        gold: 0, diamonds: 0, metres: 0, gems: 0, ore: emptyMaterialCounts(),
        kills: 0, bosses: 0, deaths: 0, maps: 0, crafts: 0, buys: 0, sockets: 0, legendaries: 0,
      },
      achievements: { earned: [] },
    };
  },
  14: (state) => {
    if (!isObject(state)) return state;
    // The Plan-20 `totals` ledger becomes the lifetime `stats` ledger, carrying every counter it already tracked over
    // (never resetting) and starting the new counters at zero. Gold earned cannot be split into found vs from-sales, so
    // it all lands in `goldFound`; the `gold` achievement reads the two together, so its total is unchanged.
    const stats = emptyLifetimeStats();
    const totals = isObject(state.totals) ? state.totals : {};
    const keep = (x: unknown): number => (isNonNegFinite(x) ? x : 0);
    stats.metresDug = keep(totals.metres);
    stats.goldFound = keep(totals.gold);
    stats.diamondsFound = keep(totals.diamonds);
    stats.gems = keep(totals.gems);
    stats.monstersKilled = keep(totals.kills);
    stats.bossKills = keep(totals.bosses);
    stats.deaths = keep(totals.deaths);
    stats.mapsCleared = keep(totals.maps);
    stats.itemsCrafted = keep(totals.crafts);
    stats.itemsBought = keep(totals.buys);
    stats.gemsSocketed = keep(totals.sockets);
    stats.legendaries = keep(totals.legendaries);
    const ore = isObject(totals.ore) ? totals.ore : {};
    for (const m of MATERIALS) stats.oresFound[m] = keep(ore[m]);
    const next: Record<string, unknown> = { ...state, stats, lastWallAt: keep(state.lastTickAt) };
    delete next.totals;
    return next;
  },
  15: (state) => {
    if (!isObject(state) || !isUint32(state.rng) || !isObject(state.stash)) return state;
    // Runes start empty and get their own stream, seeded from the loot stream the same way the uniques are.
    return {
      ...state,
      runeRng: hash2(state.rng, RUNE_RNG_SALT),
      stash: { ...state.stash, runes: emptyRuneCounts() },
    };
  },
  16: (state) => {
    if (!isObject(state) || typeof state.seed !== 'number') return state;
    // Every pre-name save gains a deterministic, pronounceable name from its seed; the world is untouched.
    return { ...state, characterName: defaultCharacterName(state.seed) };
  },
};

const ALL_STATS: readonly StatKey[] = [...MINING_STATS, ...BATTLE_STATS];
/**
 * A schema-6 item's lines, each with the tier its value falls in, held to what the item could roll with a craft.
 * Every line keeps its value and place; one past its side's room becomes a crafted line, so none is lost.
 * Null when the item is malformed: an absurd value is left for the validator, and the tier maths never sees it.
 */
function tieredLines(item: Record<string, unknown>): ModLine[] | null {
  const { affixes, ilvl, rarity } = item;
  if (!Array.isArray(affixes) || !isItemLevel(ilvl) || !isIn(RARITIES, rarity)) return null;
  const room = rarity === 'magic' ? 1 : MAX_SIDE_LINES;
  const used = { prefix: 0, suffix: 0 };
  const lines: ModLine[] = [];
  for (const a of affixes) {
    if (!isObject(a) || !isIn(ALL_STATS, a.stat) || typeof a.value !== 'number' || !Number.isInteger(a.value)) return null;
    const stat = a.stat as StatKey;
    const tier = rarity === 'legendary' ? 0 : Math.min(tierFor(stat, a.value), (ilvl as number) + MAX_TIER_OVER_CAP);
    const side = MOD_SIDE[stat];
    // Only the line's own keys: anything else an old save carried is dropped.
    const crafted = used[side] >= room;
    if (!crafted) used[side]++;
    lines.push(crafted ? { stat, value: a.value, tier, crafted: true } : { stat, value: a.value, tier });
  }
  return lines;
}

interface OldGem { id: number; type: 'gem'; gem: GemType; ilvl: number }
const isOldGem = (x: unknown): x is OldGem =>
  isObject(x) && x.type === 'gem' && isIn(GEM_TYPES, x.gem) && isItemLevel(x.ilvl);
// Schema-3 socketed gems were whole items; schema 4 keeps only the type and grade.
function withSocketed(item: unknown): unknown {
  if (!isObject(item) || !Array.isArray(item.gems)) return item;
  return { ...item, gems: item.gems.map((g: unknown) => (isOldGem(g) ? { gem: g.gem, grade: gemGradeFor(g.ilvl) } : g)) };
}
const padCells = (cells: unknown[], size: number): unknown[] =>
  cells.length >= size ? cells : [...cells, ...Array.from({ length: size - cells.length }, () => null)];

export function encodeSave(state: GameState, nowMs: number): string {
  return compressToBase64(JSON.stringify({ schema: SCHEMA_VERSION, savedAt: nowMs, state }));
}

export function migrate(
  state: unknown,
  from: number,
  to: number,
  migrations: Record<number, Migration>,
): unknown {
  let current = state;
  for (let v = from; v < to; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`Missing save migration from schema ${v}`);
    current = step(current);
  }
  return current;
}

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isNonNegFinite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const isNonNegInt = (x: unknown): x is number => isNonNegFinite(x) && Number.isInteger(x);
const isUint32 = (x: unknown): x is number => isNonNegInt(x) && x <= 4294967295;
const isUnitRange = (x: unknown): x is number => isNonNegFinite(x) && x < 1;
const isFeatureKind = (x: unknown): boolean => isIn(FEATURE_KINDS, x);
const isMaterial = (x: unknown): boolean => isIn(MATERIALS, x);
const isRuneType = (x: unknown): x is RuneType => isIn(RUNE_TYPES, x);

function isMetreRoll(x: unknown): boolean {
  return (
    isObject(x) &&
    (x.feature === null || isFeatureKind(x.feature)) &&
    isNonNegFinite(x.amount) &&
    typeof x.hardRock === 'boolean'
  );
}

const ITEM_RARITIES: readonly string[] = [...RARITIES, 'gem', 'rune'];
const ALL_SLOTS: readonly string[] = GEAR_SETS.flatMap((set) => slotsOf(set));
const isIn = (list: readonly string[], x: unknown): boolean => typeof x === 'string' && list.includes(x);
const isIdBelow = (x: unknown, nextId: number): x is number => isNonNegInt(x) && x >= 1 && x < nextId;
const isItemLevel = (x: unknown): boolean => isNonNegInt(x) && x >= 1 && x <= MAX_ITEM_LEVEL;

function isFindRecord(x: unknown, nextId: number): boolean {
  if (!isObject(x)) return false;
  if (!isIdBelow(x.id, nextId)) return false;
  if (!isNonNegInt(x.depth) || !isIn(FIND_KINDS, x.kind) || !isNonNegFinite(x.amount) || !isNonNegInt(x.tick)) return false;
  if (x.bonus !== undefined && x.bonus !== true) return false;
  // a material vein names its material, and no other find has one
  if (x.kind === 'materialVein' ? !isMaterial(x.material) : x.material !== undefined) return false;
  if (x.loot === undefined) return true;
  return Array.isArray(x.loot) && x.loot.length <= 4 && x.loot.every(isLootNote);
}

const isName = (x: unknown): x is string => typeof x === 'string' && x.length >= 1 && x.length <= 80;

// A material note names its material and no other note does; a map's note is base 'map' with a map rarity.
function isLootPair(rarity: unknown, base: unknown): boolean {
  if (rarity === 'material') return isMaterial(base);
  if (base === 'map') return isIn(MAP_RARITIES, rarity);
  return isIn(ITEM_RARITIES, rarity) && (isIn(ALL_SLOTS, base) || isIn(GEM_TYPES, base) || isIn(RUNE_TYPES, base));
}

function isLootNote(x: unknown): boolean {
  return (
    isObject(x) && isName(x.name) && isLootPair(x.rarity, x.base) && isIn(LOOT_OUTCOMES, x.outcome) && isNonNegFinite(x.value)
  );
}

function isStatLine(x: unknown, allowed: readonly string[]): boolean {
  return (
    isObject(x) &&
    isIn(allowed, x.stat) &&
    typeof x.value === 'number' && Number.isInteger(x.value) && Math.abs(x.value) <= 1_000_000
  );
}

const MOD_LINE_KEYS: readonly string[] = ['stat', 'value', 'tier', 'crafted'];
// Tier 0 marks a legendary's hand-written line, and only those. A line may sit up to MAX_TIER_OVER_CAP above the item's cap:
// crafted lines roll there, and an old value can fall there. A line has no keys but its own.
function isModLine(x: unknown, allowed: readonly string[], legendary: boolean, ilvl: number): x is ModLine {
  if (!isStatLine(x, allowed) || !isObject(x) || !isNonNegInt(x.tier) || (x.crafted !== undefined && x.crafted !== true)) return false;
  if (!Object.keys(x).every((k) => MOD_LINE_KEYS.includes(k))) return false;
  return legendary ? x.tier === 0 : x.tier >= 1 && x.tier <= ilvl + MAX_TIER_OVER_CAP;
}

// At most 3 lines a side (1 on a magic item), and crafted lines on top of them.
function isLineSet(lines: ModLine[], rarity: string): boolean {
  const room = rarity === 'magic' ? 1 : MAX_SIDE_LINES;
  return (
    sideCount(lines, 'prefix') <= room && sideCount(lines, 'suffix') <= room &&
    lines.filter((l) => l.crafted === true).length <= MAX_CRAFTED_LINES
  );
}

// A socketed slot keeps a graded gem `{ gem, grade }` or a rune `{ rune }`; a shape that mixes the two is refused.
function isSocketed(x: unknown): boolean {
  if (!isObject(x)) return false;
  if (isRuneType(x.rune)) return x.gem === undefined && x.grade === undefined;
  return isIn(GEM_TYPES, x.gem) && isIn(GEM_GRADES, x.grade) && x.rune === undefined;
}

function isGemStack(x: unknown, nextId: number, seen: Set<number>): x is GemItem {
  if (!isObject(x) || x.type !== 'gem' || !isSocketed(x)) return false;
  if (!isNonNegInt(x.count) || x.count < 1 || x.count > GEM_BAG_STACK + MAX_PASSIVE_GEM_STACK) return false;
  return isItemBase(x, nextId, seen, false);
}

function isRuneStack(x: unknown, nextId: number, seen: Set<number>): x is RuneItem {
  if (!isObject(x) || x.type !== 'rune' || !isRuneType(x.rune)) return false;
  if (!isNonNegInt(x.count) || x.count < 1 || x.count > RUNE_BAG_STACK) return false;
  return isItemBase(x, nextId, seen, false);
}

function isMaterialStack(x: unknown, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x) || x.type !== 'material' || !isMaterial(x.material)) return false;
  if (!isNonNegInt(x.count) || x.count < 1 || x.count > MATERIAL_BAG_STACK + MAX_PASSIVE_MATERIAL_STACK) return false;
  return isItemBase(x, nextId, seen, false);
}

function isEssenceStack(x: unknown, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x) || x.type !== 'essence' || !isIn(ALL_STATS, x.stat)) return false;
  if (!isNonNegInt(x.tier) || x.tier < 1 || x.tier > ESSENCE_TIER_MAX) return false;
  if (!isNonNegInt(x.count) || x.count < 1 || x.count > ESSENCE_BAG_STACK) return false;
  return isItemBase(x, nextId, seen, false);
}

function isOrbStack(x: unknown, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x) || x.type !== 'orb' || (x.side !== 'prefix' && x.side !== 'suffix')) return false;
  if (!isNonNegInt(x.count) || x.count < 1 || x.count > ESSENCE_BAG_STACK) return false;
  return isItemBase(x, nextId, seen, false);
}

function isItemBase(x: Record<string, unknown>, nextId: number, seen: Set<number>, leveled = true): boolean {
  if (!isIdBelow(x.id, nextId) || seen.has(x.id) || (leveled && !isItemLevel(x.ilvl))) return false;
  seen.add(x.id);
  return true;
}

function isGearItem(x: unknown, nextId: number, seen: Set<number>): x is GearItem {
  if (!isObject(x) || x.type !== 'gear' || !isIn(ALL_SLOTS, x.slot)) return false;
  if (!isItemBase(x, nextId, seen)) return false;
  if (typeof x.name !== 'string' || x.name.length < 1 || x.name.length > 80) return false;
  if (!isIn(RARITIES, x.rarity)) return false;
  const allowed = statsOf(setOfSlot(x.slot as Slot));
  if (!isStatLine(x.implicit, allowed)) return false;
  const legendary = x.rarity === 'legendary';
  const ilvl = x.ilvl as number;
  if (!Array.isArray(x.affixes) || !x.affixes.every((a) => isModLine(a, allowed, legendary, ilvl))) return false;
  if (!isLineSet(x.affixes, x.rarity as string) || (x.sealed !== undefined && x.sealed !== true)) return false;
  if (!isNonNegInt(x.sockets) || x.sockets > MAX_SOCKETS) return false;
  if (!Array.isArray(x.gems) || x.gems.length > x.sockets || !x.gems.every(isSocketed)) return false;
  return x.uniqueId === undefined || (typeof x.uniqueId === 'string' && x.uniqueId.length <= 40);
}

// A bag cell holds anything: gear of either set, a gem or material stack, or a map.
function isBagItem(x: unknown, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x)) return false;
  switch (x.type) {
    case 'gear': return isGearItem(x, nextId, seen);
    case 'gem': return isGemStack(x, nextId, seen);
    case 'rune': return isRuneStack(x, nextId, seen);
    case 'material': return isMaterialStack(x, nextId, seen);
    case 'essence': return isEssenceStack(x, nextId, seen);
    case 'orb': return isOrbStack(x, nextId, seen);
    case 'map': return isMapItem(x, nextId, seen);
    default: return false;
  }
}

function isEquipped(x: unknown, set: GearSet, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x)) return false;
  const slots = slotsOf(set) as readonly string[];
  return Object.entries(x).every(
    ([key, item]) => slots.includes(key) && isGearItem(item, nextId, seen) && item.slot === key,
  );
}

function isBag(x: unknown, nextId: number, seen: Set<number>): x is Cell[] {
  return Array.isArray(x) && x.length === BAG_SIZE && x.every((c) => c === null || isBagItem(c, nextId, seen));
}

// The General tab: whole pages, at least the free ones and at most MAX_STASH_PAGES, each cell empty or `holds`.
function isPagedTab(x: unknown, startPages: number, holds: (c: unknown) => boolean): x is unknown[] {
  if (!Array.isArray(x) || x.length % STASH_PAGE_SIZE !== 0) return false;
  const pages = pageCount(x);
  return pages >= startPages && pages <= MAX_STASH_PAGES && x.every((c) => c === null || holds(c));
}

// The Materials tab: exactly one count for each material.
function isMaterialTab(x: unknown): boolean {
  return (
    isObject(x) &&
    Object.keys(x).length === MATERIALS.length &&
    MATERIALS.every((m) => isNonNegInt(x[m]) && x[m] <= MATERIAL_STASH_STACK)
  );
}

// The Essences tab: a sparse map keyed "stat:tier" or "prefix"/"suffix", each count within the cap.
function isEssencesTab(x: unknown): boolean {
  return (
    isObject(x) &&
    Object.entries(x).every(([key, n]) => parseEssenceKey(key) !== undefined && isNonNegInt(n) && n <= ESSENCE_STASH_STACK)
  );
}

const isBoughtOf = (n: unknown, tab: unknown[]): boolean => isNonNegInt(n) && n <= pageCount(tab);

// The Gems tab: exactly one count for each type and grade.
function isGemTab(x: unknown): boolean {
  return (
    isObject(x) &&
    Object.keys(x).length === GEM_TYPES.length &&
    GEM_TYPES.every((type) => {
      const counts = x[type];
      return (
        isObject(counts) &&
        Object.keys(counts).length === GEM_GRADES.length &&
        GEM_GRADES.every((g) => isNonNegInt(counts[g]) && counts[g] <= GEM_STASH_STACK)
      );
    })
  );
}

// The Runes tab: exactly one count for each kind, with no grade dimension.
function isRuneTab(x: unknown): boolean {
  return (
    isObject(x) &&
    Object.keys(x).length === RUNE_TYPES.length &&
    RUNE_TYPES.every((r) => isNonNegInt(x[r]) && x[r] <= RUNE_STASH_STACK)
  );
}

function isMotion(x: unknown): boolean {
  return (
    isObject(x) &&
    typeof x.floats === 'boolean' && typeof x.pops === 'boolean' && typeof x.lampFlicker === 'boolean' &&
    isIn(SHAFT_MOTIONS, x.shaft)
  );
}

// The highest tier a rule may name: an item's level, a map's tier or a line's tier, which may sit over the cap.
const MAX_RULE_LEVEL = MAX_ITEM_LEVEL + MAX_TIER_OVER_CAP;
// The most modifiers a rule may count: far past what any item holds.
const MAX_RULE_MODS = 20;
const LOOT_RULE_KEYS: readonly string[] = [
  'kind', 'action', 'set', 'slot', 'rarity', 'level', 'modTier', 'mods', 'mapMod', 'gem', 'grade', 'rune', 'material',
];
const isUpTo = (x: unknown, max: number): boolean => isNonNegInt(x) && x <= max;
const isOptional = (x: unknown, check: (x: unknown) => boolean): boolean => x === undefined || check(x);

// An inclusive range with no keys but its own, each end a whole number up to `max`.
function isLootRange(x: unknown, max: number): boolean {
  return (
    isObject(x) && Object.keys(x).every((k) => k === 'min' || k === 'max') &&
    isOptional(x.min, (n) => isUpTo(n, max)) && isOptional(x.max, (n) => isUpTo(n, max))
  );
}

// A rule has no keys but its own, each of its type, and ruleValid must hold: no field that could never match its kind.
function isLootRule(x: unknown): x is LootRule {
  if (!isObject(x) || !Object.keys(x).every((k) => LOOT_RULE_KEYS.includes(k))) return false;
  if (!(x.kind === 'any' || isIn(LOOT_KINDS, x.kind)) || !isIn(LOOT_ACTIONS, x.action)) return false;
  const fields = isOptional(x.set, (v) => isIn(GEAR_SETS, v)) && isOptional(x.slot, (v) => isIn(ALL_SLOTS, v)) &&
    isOptional(x.rarity, (v) => isIn(RARITIES, v)) && isOptional(x.level, (v) => isLootRange(v, MAX_RULE_LEVEL)) &&
    isOptional(x.modTier, (v) => isUpTo(v, MAX_RULE_LEVEL)) && isOptional(x.mods, (v) => isLootRange(v, MAX_RULE_MODS)) &&
    isOptional(x.mapMod, (v) => isIn(MAP_MOD_KINDS, v)) && isOptional(x.gem, (v) => isIn(GEM_TYPES, v)) &&
    isOptional(x.grade, (v) => isIn(GEM_GRADES, v)) && isOptional(x.rune, isRuneType) && isOptional(x.material, isMaterial);
  return fields && ruleValid(x as unknown as LootRule);
}

function isSettings(x: unknown): boolean {
  if (!isObject(x) || !isMotion(x.motion)) return false;
  return Array.isArray(x.lootFilter) && x.lootFilter.length <= MAX_LOOT_RULES && x.lootFilter.every(isLootRule);
}

// The Trader's bought record: the band it was bought in, and each stock slot bought at most once.
function isMerchant(x: unknown): boolean {
  if (!isObject(x) || !isNonNegInt(x.band) || !Array.isArray(x.bought) || x.bought.length > STOCK_SIZE) return false;
  return x.bought.every((i) => isUpTo(i, STOCK_SIZE - 1)) && new Set(x.bought).size === x.bought.length;
}

// The ore market: a premium per ore, each a finite number within the cap.
function isOreMarket(x: unknown): boolean {
  if (!isObject(x) || !isObject(x.premium)) return false;
  const premium = x.premium;
  if (Object.keys(premium).length !== MATERIALS.length) return false;
  return MATERIALS.every((m) => {
    const n = premium[m];
    return isNonNegFinite(n) && n <= PREMIUM_CAP;
  });
}

/** Whether every allocated id reaches `start` over links that stay inside { start } ∪ allocated. */
function isConnectedTree(
  allocated: readonly string[],
  nodes: ReadonlyMap<string, { links: string[] }>,
  start: string,
): boolean {
  const alloc = new Set(allocated);
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    const node = nodes.get(id);
    if (node === undefined) return false;
    for (const l of node.links) {
      if (seen.has(l) || (l !== start && !alloc.has(l))) continue;
      seen.add(l);
      queue.push(l);
    }
  }
  return [...alloc].every((id) => seen.has(id));
}

// The ascendancy tree: unspent points and unique known node ids, never the start, connected to the start.
function isAscendancy(x: unknown): x is { points: number; allocated: string[] } {
  if (!isObject(x) || !isNonNegInt(x.points) || !Array.isArray(x.allocated)) return false;
  if (x.allocated.length > ASCENDANCY_NODE_COUNT - 1) return false;
  const ids = new Set<string>();
  for (const id of x.allocated) {
    if (typeof id !== 'string' || id === ASCENDANCY_START_ID || !ASCENDANCY_NODE_BY_ID.has(id) || ids.has(id)) return false;
    ids.add(id);
  }
  return isConnectedTree(x.allocated as string[], ASCENDANCY_NODE_BY_ID, ASCENDANCY_START_ID);
}

// The auto-map queue: unique map ids in the order queued; whether a map exists is the run loop's business.
function isAutoMap(x: unknown): x is { queue: number[] } {
  if (!isObject(x) || !Array.isArray(x.queue)) return false;
  const ids = new Set<number>();
  for (const id of x.queue) {
    if (!isNonNegInt(id) || ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}

const isLifetime = (x: unknown): x is { ascensions: number; deepest: number } =>
  isObject(x) && isNonNegInt(x.ascensions) && isNonNegInt(x.deepest);

// The lifetime stats ledger: every scalar a non-negative finite number, one count per ore and per gem type and grade.
function isLifetimeStats(x: unknown): x is LifetimeStats {
  if (!isObject(x)) return false;
  const scalars = [
    'metresDug', 'timePlayedMs', 'timeAwayMs', 'timeDiggingMs', 'timeCombatMs', 'timeIdleMs',
    'goldFound', 'goldFromSales', 'goldSpent', 'diamondsFound', 'diamondsSpent', 'soulsEarned', 'soulsSpent',
    'chestsOpened', 'mapsFound', 'monstersKilled', 'championKills', 'bossKills', 'deaths', 'mapsCleared', 'mapsLost',
    'levelsGained', 'itemsCrafted', 'itemsKept', 'itemsSold', 'itemsSalvaged', 'gems', 'itemsBought', 'gemsSocketed', 'legendaries',
  ];
  if (!scalars.every((k) => isNonNegFinite(x[k]))) return false;
  const { oresFound, oresTraded } = x;
  if (!isObject(oresFound) || !isObject(oresTraded)) return false;
  if (Object.keys(oresFound).length !== MATERIALS.length || !MATERIALS.every((m) => isNonNegFinite(oresFound[m]))) return false;
  if (Object.keys(oresTraded).length !== MATERIALS.length || !MATERIALS.every((m) => isNonNegFinite(oresTraded[m]))) return false;
  const gemsFound = x.gemsFound;
  if (!isObject(gemsFound) || Object.keys(gemsFound).length !== GEM_TYPES.length) return false;
  for (const type of GEM_TYPES) {
    const counts = gemsFound[type];
    if (!isObject(counts) || Object.keys(counts).length !== GEM_GRADES.length) return false;
    if (!GEM_GRADES.every((g) => isNonNegFinite(counts[g]))) return false;
  }
  return true;
}

// The earned set: unique ids, each a known achievement.
function isAchievements(x: unknown): x is { earned: string[] } {
  if (!isObject(x) || !Array.isArray(x.earned)) return false;
  const ids = new Set<string>();
  for (const id of x.earned) {
    if (typeof id !== 'string' || !ACHIEVEMENT_IDS.has(id) || ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}

// The passive web: at most one point per level past the first plus the ascendancy tree's, unique known ids, never the start, connected to the start.
function isPassives(x: unknown): x is { allocated: string[] } {
  if (!isObject(x) || !Array.isArray(x.allocated) || x.allocated.length > LEVEL_CAP - 1 + MAX_ASCENDANCY_PASSIVE_POINTS) return false;
  const ids = new Set<string>();
  for (const id of x.allocated) {
    if (typeof id !== 'string' || id === START_NODE_ID || !PASSIVE_NODE_BY_ID.has(id) || ids.has(id)) return false;
    ids.add(id);
  }
  return isConnectedWeb(x.allocated as string[]);
}

const MAP_MOD_KEYS: readonly string[] = ['kind', 'tier', 'value'];
// A map modifier has no keys but its own. Its tier may sit up to MAX_TIER_OVER_CAP above the map's, as tempering rolls there.
function isMapMod(x: unknown, mapTier: number): x is MapMod {
  if (!isObject(x) || !Object.keys(x).every((k) => MAP_MOD_KEYS.includes(k)) || !isIn(MAP_MOD_KINDS, x.kind)) return false;
  if (!isNonNegInt(x.tier) || x.tier < 1 || x.tier > mapTier + MAX_TIER_OVER_CAP) return false;
  return isNonNegInt(x.value) && x.value >= 1 && x.value <= 1_000_000;
}

// The most modifiers each map rarity holds; a normal map has none.
const MAP_MOD_ROOM: Readonly<Record<MapRarity, number>> = { normal: 0, magic: 2, rare: MAX_MAP_MODS };
const MAP_RARITIES: readonly string[] = Object.keys(MAP_MOD_ROOM);

function isMapItem(x: unknown, nextId: number, seen: Set<number>): x is MapItem {
  if (!isObject(x) || x.type !== 'map' || !isItemLevel(x.tier) || !isNonNegInt(x.metre) || x.metre < 1) return false;
  if (!isIn(MAP_RARITIES, x.rarity) || !Array.isArray(x.mods) || x.mods.length > MAP_MOD_ROOM[x.rarity as MapRarity]) return false;
  const tier = x.tier as number;
  if (!x.mods.every((m) => isMapMod(m, tier)) || new Set(x.mods.map((m: MapMod) => m.kind)).size !== x.mods.length) return false;
  if (x.sealed !== undefined && x.sealed !== true) return false;
  if (!isOptional(x.special, (v) => isIn(MAP_SPECIALS, v))) return false;
  return isItemBase(x, nextId, seen, false);
}

// The Map stash: a list per tier, keyed by the tier's own decimal text, each at most MAP_TIER_CAP maps of that tier.
function isMapStash(x: unknown, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x)) return false;
  return Object.entries(x).every(([key, list]) => {
    const tier = Number(key);
    return (
      String(tier) === key && isItemLevel(tier) && Array.isArray(list) && list.length <= MAP_TIER_CAP &&
      list.every((m) => isMapItem(m, nextId, seen) && m.tier === tier)
    );
  });
}

function isMonster(x: unknown, tier: number): boolean {
  if (!isObject(x)) return false;
  if (typeof x.name !== 'string' || x.name.length < 1 || x.name.length > 80 || !isNonNegInt(x.species)) return false;
  if (x.species >= speciesOf(tier).length) return false;
  if (!isIn(RANKS, x.rank) || !isUint32(x.extra) || !isIn(ELEMENTS, x.element)) return false;
  if (
    !Array.isArray(x.mods) || x.mods.length > 2 || (x.mods.length > 0 && x.rank !== 'champion') ||
    !x.mods.every((m) => isIn(CHAMPION_MODS, m)) || new Set(x.mods).size !== x.mods.length
  ) return false;
  return (
    isNonNegInt(x.life) && x.life >= 1 && isNonNegInt(x.maxLife) && x.life <= x.maxLife && x.maxLife <= MAX_LIFE &&
    isNonNegInt(x.damage) && x.damage <= MAX_DAMAGE && isNonNegInt(x.xp) &&
    isNonNegFinite(x.intervalS) && x.intervalS > 0 && x.intervalS <= 60
  );
}

function isGains(x: unknown): boolean {
  return isObject(x) && isNonNegInt(x.xp) && isNonNegInt(x.souls) && isNonNegInt(x.gold) && isNonNegInt(x.levels);
}

function isCombatLine(x: unknown): boolean {
  if (!isObject(x)) return false;
  const named = typeof x.monster === 'string' && x.monster.length >= 1 && x.monster.length <= 80;
  switch (x.kind) {
    case 'hit': {
      // a hit logged before maps lost their clicks still says whether it was one
      const click = x.click === undefined || typeof x.click === 'boolean';
      return named && isNonNegInt(x.amount) && typeof x.crit === 'boolean' && click;
    }
    case 'hurt':
    case 'heal': return named && isNonNegInt(x.amount);
    case 'kill': return named && isNonNegInt(x.xp) && isNonNegInt(x.souls);
    case 'room': return isNonNegInt(x.room) && x.room >= 1;
    case 'level': return isNonNegInt(x.level) && x.level >= 1 && x.level <= LEVEL_CAP;
    case 'drop': return isLootNote(x.note);
    case 'saved': return named;
    default: return false;
  }
}

// The boss room is the last: bossRoom is the map's dungeon's regular rooms plus one, regenerated from the world seed.
const isBossRoom = (x: unknown, seed: number, map: MapItem): x is number =>
  x === dungeonType(seed, map.tier, dungeonIndexAt(seed, map.metre)).rooms + 1;
const isRoomIn = (x: unknown, bossRoom: number): x is number => isNonNegInt(x) && x >= 1 && x <= bossRoom;

function isMapRun(x: unknown, seed: number, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x) || !isMapItem(x.map, nextId, seen) || !isBossRoom(x.bossRoom, seed, x.map) || !isRoomIn(x.room, x.bossRoom)) return false;
  const { queue, room, bossRoom } = x;
  const tier = isObject(x.map) && typeof x.map.tier === 'number' ? x.map.tier : 1;
  if (!Array.isArray(queue) || queue.length < 1 || queue.length > MONSTER_BUDGET || !queue.every((m) => isMonster(m, tier))) return false;
  if ((queue[0].rank === 'boss') !== (room === bossRoom)) return false;
  if (!isNonNegInt(x.life) || x.life < 1 || x.life > MAX_LIFE) return false;
  if (!isUnitRange(x.hitCarry) || !isUnitRange(x.monsterCarry) || !isUnitRange(x.regenCarry)) return false;
  if (!isGains(x.gained) || !isNonNegInt(x.items)) return false;
  if (!isNonNegInt(x.strikes) || (x.saved !== undefined && x.saved !== true)) return false;
  if (!Array.isArray(x.log) || x.log.length > COMBAT_LOG_LIMIT || !x.log.every(isCombatLine)) return false;
  return Array.isArray(x.loot) && x.loot.length <= RUN_LOOT_LIMIT && x.loot.every(isLootNote);
}

function isActivity(x: unknown, seed: number, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x)) return false;
  if (x.kind === 'dig') return Object.keys(x).length === 1;
  return x.kind === 'map' && isMapRun(x.run, seed, nextId, seen);
}

function isRunResult(x: unknown, seed: number, nextId: number, seen: Set<number>): boolean {
  return (
    isObject(x) && isMapItem(x.map, nextId, seen) && isIn(RUN_OUTCOMES, x.outcome) && isBossRoom(x.bossRoom, seed, x.map) &&
    isRoomIn(x.room, x.bossRoom) && isGains(x.gained) && isNonNegInt(x.items) && typeof x.seen === 'boolean'
  );
}

function isInventory(x: Record<string, unknown>, nextId: number, seen: Set<number>): boolean {
  const { equipped, bag, stash, overflow, lootTally } = x;
  if (!isObject(equipped) || !isEquipped(equipped.mining, 'mining', nextId, seen) || !isEquipped(equipped.battle, 'battle', nextId, seen)) return false;
  if (!isBag(bag, nextId, seen) || !isObject(stash)) return false;
  const { general, bought } = stash;
  if (!isPagedTab(general, START_GENERAL_PAGES, (c) => isGearItem(c, nextId, seen))) return false;
  if (!isMapStash(stash.maps, nextId, seen)) return false;
  if (!isGemTab(stash.gems) || !isRuneTab(stash.runes) || !isMaterialTab(stash.materials) || !isEssencesTab(stash.essences)) return false;
  if (!isObject(bought) || Object.keys(bought).length !== 1 || !isBoughtOf(bought.general, general)) return false;
  // held finds are any kind of item, each as a bag cell would hold it
  if (!Array.isArray(overflow) || overflow.length > MAX_HELD || !overflow.every((o) => isBagItem(o, nextId, seen))) return false;
  return (
    isObject(lootTally) && isNonNegInt(lootTally.kept) && isNonNegInt(lootTally.sold) && isNonNegInt(lootTally.salvaged)
  );
}

// A find's origin: a dug metre, a room of a map of some tier, or the merchant.
function isDropOrigin(x: unknown): boolean {
  if (!isObject(x)) return false;
  switch (x.kind) {
    case 'metre': return isNonNegInt(x.metre);
    case 'map': return isItemLevel(x.tier) && isRoomIn(x.room, MAX_ROOMS + 1);
    case 'merchant': return true;
    default: return false;
  }
}

function isTrailStep(x: unknown): boolean {
  if (!isObject(x) || !isIn(TRAIL_EVENTS, x.event)) return false;
  if (x.gold !== undefined && !isNonNegFinite(x.gold)) return false;
  const { materials } = x;
  return materials === undefined || (isObject(materials) && Object.entries(materials).every(([m, n]) => isMaterial(m) && isNonNegFinite(n)));
}

const ITEM_TYPES: readonly string[] = ['gear', 'gem', 'rune', 'material', 'map'];

function isDropEntry(x: unknown, nextId: number): x is DropEntry {
  if (!isObject(x) || !isIdBelow(x.id, nextId) || !isIn(ITEM_TYPES, x.kind) || !isName(x.name)) return false;
  if (!isLootPair(x.rarity, x.base) || !isNonNegInt(x.count) || x.count < 1 || !isDropOrigin(x.origin)) return false;
  const { trail } = x;
  return Array.isArray(trail) && trail.length >= 1 && trail.length <= MAX_TRAIL_STEPS && trail.every(isTrailStep);
}

// The drop log: each entry under its own id, apart from the item ids (an entry takes its item's).
function isDropLog(x: unknown, nextId: number): boolean {
  if (!Array.isArray(x) || x.length > DROP_LOG_LIMIT) return false;
  const ids = new Set<number>();
  return x.every((e) => {
    if (!isDropEntry(e, nextId) || ids.has(e.id)) return false;
    ids.add(e.id);
    return true;
  });
}

function isDeathEntry(x: unknown, seed: number, nextId: number): boolean {
  if (!isObject(x) || !isIdBelow(x.id, nextId) || !isNonNegInt(x.tick) || !isNonNegFinite(x.at) || !isName(x.killer)) return false;
  // the lost map is a snapshot, which may share its id with the last run's map, so it is checked on its own
  return isMapItem(x.map, nextId, new Set()) && isBossRoom(x.bossRoom, seed, x.map) && isRoomIn(x.room, x.bossRoom);
}

export function validateState(x: unknown): x is GameState {
  if (!isObject(x)) return false;
  if (!isUint32(x.seed) || !isUint32(x.rng)) return false;
  if (typeof x.worldSeed !== 'string' || !isValidSeedText(x.worldSeed) || seedFromText(x.worldSeed) !== x.seed) return false;
  if (x.worldGen !== 1 && x.worldGen !== 2) return false;
  if (typeof x.characterName !== 'string' || !isValidCharacterName(x.characterName)) return false;
  if (!isNonNegInt(x.tickCount) || !isNonNegInt(x.deepest)) return false;
  if (!isNonNegFinite(x.lastTickAt) || !isNonNegFinite(x.lastWallAt) || !isNonNegFinite(x.gold) || !isNonNegFinite(x.diamonds)) return false;
  if (!isUnitRange(x.progress)) return false;
  if (!isObject(x.ahead)) return false;
  for (const [key, roll] of Object.entries(x.ahead)) {
    const metre = Number(key);
    if (!Number.isInteger(metre) || metre <= x.deepest || !isMetreRoll(roll)) return false;
  }
  if (!isNonNegInt(x.nextId) || x.nextId < 1) return false;
  const { nextId } = x;
  const seen = new Set<number>();
  if (!isInventory(x, nextId, seen) || !isSettings(x.settings)) return false;
  if (!isNonNegInt(x.level) || x.level < 1 || x.level > LEVEL_CAP) return false;
  // Below the cap xp is under the next level's cost; at the cap (where xpToNext is 0) it stays 0.
  if (!isNonNegInt(x.xp) || (x.level === LEVEL_CAP ? x.xp !== 0 : x.xp >= xpToNext(x.level))) return false;
  if (!isNonNegInt(x.souls) || !isActivity(x.activity, x.seed, nextId, seen)) return false;
  if (x.lastRun !== null && !isRunResult(x.lastRun, x.seed, nextId, seen)) return false;
  if (!isObject(x.mapTally) || !isNonNegInt(x.mapTally.cleared) || !isNonNegInt(x.mapTally.lost)) return false;
  if (!Array.isArray(x.finds) || x.finds.length > FINDS_LOG_LIMIT || !x.finds.every((f) => isFindRecord(f, nextId))) return false;
  if (typeof x.paused !== 'boolean' || !isDropLog(x.drops, nextId)) return false;
  if (!isMerchant(x.merchant) || !isUint32(x.uniqueRng) || !isUint32(x.runeRng)) return false;
  if (!isOreMarket(x.oreMarket)) return false;
  if (!isAscendancy(x.ascendancy) || !isAutoMap(x.autoMap) || !isLifetime(x.lifetime)) return false;
  if (!isLifetimeStats(x.stats) || !isAchievements(x.achievements)) return false;
  const extraPassivePoints = ascendancyTotals({ ascendancy: x.ascendancy }).passivePoints;
  if (!isPassives(x.passives) || x.passives.allocated.length > x.level - 1 + extraPassivePoints) return false;
  const { seed } = x;
  return Array.isArray(x.deaths) && x.deaths.length <= DEATH_LOG_LIMIT && x.deaths.every((d) => isDeathEntry(d, seed, nextId));
}

export function decodeSave(text: string): DecodeResult {
  let envelope: unknown;
  try {
    const json = decompressFromBase64(text);
    if (json === null || json === '') return { ok: false, reason: 'corrupt' };
    envelope = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isObject(envelope)) return { ok: false, reason: 'invalid' };
  const { schema, savedAt, state } = envelope;
  if (typeof schema !== 'number' || !Number.isInteger(schema) || schema < 1) return { ok: false, reason: 'invalid' };
  if (schema > SCHEMA_VERSION) return { ok: false, reason: 'future' };
  let migrated: unknown;
  try {
    migrated = migrate(state, schema, SCHEMA_VERSION, MIGRATIONS);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!validateState(migrated) || !isNonNegFinite(savedAt)) return { ok: false, reason: 'invalid' };
  return { ok: true, state: migrated, savedAt };
}
