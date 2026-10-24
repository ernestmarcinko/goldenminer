import { compressToBase64, decompressFromBase64 } from 'lz-string';
import {
  BAG_SIZE, COMBAT_LOG_LIMIT, FINDS_LOG_LIMIT, GEM_BAG_STACK, GEM_STASH_STACK, LEVEL_CAP, MATERIAL_BAG_STACK,
  MATERIAL_STASH_STACK, MAX_AFFIXES, MAX_DAMAGE, MAX_LIFE, MAX_LOOT_RULES, MAX_OVERFLOW, MAX_SOCKETS, MAX_STASH_PAGES,
  MONSTER_BUDGET, RUN_LOOT_LIMIT, START_GENERAL_PAGES, START_MAP_PAGES, STASH_PAGE_SIZE,
} from './balance';
import { metreTier } from './bands';
import { emptyGemCounts, emptyMaterialCounts, pageCount } from './cells';
import { dungeonIndexAt, dungeonType } from './dungeons';
import { gemGradeFor } from './itemData';
import { GEAR_SETS, GEM_GRADES, GEM_TYPES, MATERIALS, RARITIES, setOfSlot, slotsOf, statsOf } from './items';
import type { Cell, GearItem, GearSet, GemItem, GemType, MapItem, Slot } from './items';
import { xpToNext } from './levels';
import { isValidSeedText, seedFromText } from './seed';
import { speciesOf } from './species';
import {
  BAG_FULL_MODES, CHAMPION_MODS, DEFAULT_MOTION, ELEMENTS, FEATURE_KINDS, FIND_KINDS, LOOT_ACTIONS, LOOT_OUTCOMES, RANKS,
  RUN_OUTCOMES, SHAFT_MOTIONS, type GameState,
} from './types';

export const SCHEMA_VERSION = 6;

export type DecodeResult =
  | { ok: true; state: GameState; savedAt: number }
  | { ok: false; reason: 'corrupt' | 'future' | 'invalid' };

export type Migration = (state: unknown) => unknown;

const MAX_MIGRATED_METRE = 30_000_000;
// The schema-5 shapes the older migrations build; MIGRATIONS[5] turns them into today's.
const OLD_BAG_SIZE = 24;
const OLD_GENERAL_SIZE = 60;
const OLD_MAPS_KEPT = 200;

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
    const maps: MapItem[] = [];
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
    const mapPages = Math.max(START_MAP_PAGES, Math.ceil(state.stash.maps.length / STASH_PAGE_SIZE));
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
};

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

function isMetreRoll(x: unknown): boolean {
  return (
    isObject(x) &&
    (x.feature === null || isFeatureKind(x.feature)) &&
    isNonNegFinite(x.amount) &&
    typeof x.hardRock === 'boolean'
  );
}

const ITEM_RARITIES: readonly string[] = [...RARITIES, 'gem'];
const LOOT_TARGETS: readonly string[] = [...GEAR_SETS, 'gem', 'any'];
const ALL_SLOTS: readonly string[] = GEAR_SETS.flatMap((set) => slotsOf(set));
const isIn = (list: readonly string[], x: unknown): boolean => typeof x === 'string' && list.includes(x);
const isIdBelow = (x: unknown, nextId: number): x is number => isNonNegInt(x) && x >= 1 && x < nextId;
const isItemLevel = (x: unknown): boolean => isNonNegInt(x) && x >= 1 && x <= 100_000;

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

function isLootNote(x: unknown): boolean {
  return (
    isObject(x) &&
    typeof x.name === 'string' && x.name.length >= 1 && x.name.length <= 80 &&
    // a material note names its material, and no other note does
    (x.rarity === 'material'
      ? isMaterial(x.base)
      : isIn(ITEM_RARITIES, x.rarity) && (isIn(ALL_SLOTS, x.base) || isIn(GEM_TYPES, x.base))) &&
    isIn(LOOT_OUTCOMES, x.outcome) &&
    isNonNegFinite(x.value)
  );
}

function isStatLine(x: unknown, allowed: readonly string[]): boolean {
  return (
    isObject(x) &&
    isIn(allowed, x.stat) &&
    typeof x.value === 'number' && Number.isInteger(x.value) && Math.abs(x.value) <= 1_000_000
  );
}

// A socketed gem keeps only its type and grade.
function isSocketed(x: unknown): boolean {
  return isObject(x) && isIn(GEM_TYPES, x.gem) && isIn(GEM_GRADES, x.grade);
}

function isGemStack(x: unknown, nextId: number, seen: Set<number>): x is GemItem {
  if (!isObject(x) || x.type !== 'gem' || !isSocketed(x)) return false;
  if (!isNonNegInt(x.count) || x.count < 1 || x.count > GEM_BAG_STACK) return false;
  return isItemBase(x, nextId, seen, false);
}

function isMaterialStack(x: unknown, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x) || x.type !== 'material' || !isMaterial(x.material)) return false;
  if (!isNonNegInt(x.count) || x.count < 1 || x.count > MATERIAL_BAG_STACK) return false;
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
  if (!Array.isArray(x.affixes) || x.affixes.length > MAX_AFFIXES || !x.affixes.every((a) => isStatLine(a, allowed))) return false;
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
    case 'material': return isMaterialStack(x, nextId, seen);
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

// A General or Maps tab: whole pages, at least the free ones and at most MAX_STASH_PAGES, each cell empty or `holds`.
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

function isMotion(x: unknown): boolean {
  return (
    isObject(x) &&
    typeof x.floats === 'boolean' && typeof x.pops === 'boolean' && typeof x.lampFlicker === 'boolean' &&
    isIn(SHAFT_MOTIONS, x.shaft)
  );
}

function isSettings(x: unknown): boolean {
  if (!isObject(x) || !isIn(BAG_FULL_MODES, x.bagFull) || !isMotion(x.motion)) return false;
  return (
    Array.isArray(x.lootFilter) &&
    x.lootFilter.length <= MAX_LOOT_RULES &&
    x.lootFilter.every(
      (r) =>
        isObject(r) &&
        (r.rarity === 'any' || isIn(RARITIES, r.rarity)) &&
        (isIn(LOOT_TARGETS, r.target) || isIn(ALL_SLOTS, r.target)) &&
        isIn(LOOT_ACTIONS, r.action),
    )
  );
}

function isMapItem(x: unknown, nextId: number, seen: Set<number>): x is MapItem {
  if (!isObject(x) || x.type !== 'map' || !isItemLevel(x.tier) || !isNonNegInt(x.metre) || x.metre < 1) return false;
  return isItemBase(x, nextId, seen, false);
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
    case 'hit': return named && isNonNegInt(x.amount) && typeof x.crit === 'boolean' && typeof x.click === 'boolean';
    case 'hurt':
    case 'heal': return named && isNonNegInt(x.amount);
    case 'kill': return named && isNonNegInt(x.xp) && isNonNegInt(x.souls);
    case 'room': return isNonNegInt(x.room) && x.room >= 1;
    case 'level': return isNonNegInt(x.level) && x.level >= 1 && x.level <= LEVEL_CAP;
    case 'drop': return isLootNote(x.note);
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
  if (!isNonNegInt(x.life) || x.life < 1 || x.life > MAX_LIFE || !isUnitRange(x.hitCarry) || !isUnitRange(x.monsterCarry)) return false;
  if (!isGains(x.gained) || !isNonNegInt(x.items)) return false;
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
  const { general, maps, bought } = stash;
  if (!isPagedTab(general, START_GENERAL_PAGES, (c) => isGearItem(c, nextId, seen))) return false;
  if (!isPagedTab(maps, START_MAP_PAGES, (c) => isMapItem(c, nextId, seen))) return false;
  if (!isGemTab(stash.gems) || !isMaterialTab(stash.materials)) return false;
  if (!isObject(bought) || !isBoughtOf(bought.general, general) || !isBoughtOf(bought.maps, maps)) return false;
  if (!Array.isArray(overflow) || overflow.length > MAX_OVERFLOW || !overflow.every((o) => isGearItem(o, nextId, seen))) return false;
  return (
    isObject(lootTally) && isNonNegInt(lootTally.kept) && isNonNegInt(lootTally.sold) && isNonNegInt(lootTally.salvaged)
  );
}

export function validateState(x: unknown): x is GameState {
  if (!isObject(x)) return false;
  if (!isUint32(x.seed) || !isUint32(x.rng)) return false;
  if (typeof x.worldSeed !== 'string' || !isValidSeedText(x.worldSeed) || seedFromText(x.worldSeed) !== x.seed) return false;
  if (x.worldGen !== 1 && x.worldGen !== 2) return false;
  if (!isNonNegInt(x.tickCount) || !isNonNegInt(x.deepest)) return false;
  if (!isNonNegFinite(x.lastTickAt) || !isNonNegFinite(x.gold) || !isNonNegFinite(x.diamonds)) return false;
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
  if (!Array.isArray(x.finds) || x.finds.length > FINDS_LOG_LIMIT) return false;
  return x.finds.every((f) => isFindRecord(f, nextId));
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
