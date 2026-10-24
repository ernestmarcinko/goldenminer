import { compressToBase64, decompressFromBase64 } from 'lz-string';
import { BAG_SIZE, FINDS_LOG_LIMIT, MAX_AFFIXES, MAX_LOOT_RULES, MAX_OVERFLOW, MAX_SOCKETS, STASH_SIZE } from './balance';
import { GEAR_SETS, GEM_TYPES, RARITIES, setOfSlot, slotsOf, statsOf } from './items';
import type { GearItem, GearSet, Slot } from './items';
import { isValidSeedText, seedFromText } from './seed';
import { DEFAULT_MOTION, SHAFT_MOTIONS, type GameState } from './types';

export const SCHEMA_VERSION = 3;

export type DecodeResult =
  | { ok: true; state: GameState; savedAt: number }
  | { ok: false; reason: 'corrupt' | 'future' | 'invalid' };

export type Migration = (state: unknown) => unknown;

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
};

const FEATURE_KINDS: readonly string[] = ['goldVein', 'diamondVein', 'chest', 'gem', 'map'];

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
const isFeatureKind = (x: unknown): boolean => typeof x === 'string' && FEATURE_KINDS.includes(x);

function isMetreRoll(x: unknown): boolean {
  return (
    isObject(x) &&
    (x.feature === null || isFeatureKind(x.feature)) &&
    isNonNegFinite(x.amount) &&
    typeof x.hardRock === 'boolean'
  );
}

const ITEM_RARITIES: readonly string[] = [...RARITIES, 'gem'];
const LOOT_OUTCOMES: readonly string[] = ['bag', 'stash', 'sold', 'salvaged', 'held'];
const LOOT_TARGETS: readonly string[] = [...GEAR_SETS, 'gem', 'any'];
const ALL_SLOTS: readonly string[] = GEAR_SETS.flatMap((set) => slotsOf(set));
const isIn = (list: readonly string[], x: unknown): boolean => typeof x === 'string' && list.includes(x);
const isIdBelow = (x: unknown, nextId: number): x is number => isNonNegInt(x) && x >= 1 && x < nextId;
const isItemLevel = (x: unknown): boolean => isNonNegInt(x) && x >= 1 && x <= 100_000;

function isFindRecord(x: unknown, nextId: number): boolean {
  if (!isObject(x)) return false;
  if (!isIdBelow(x.id, nextId)) return false;
  if (!isNonNegInt(x.depth) || !isFeatureKind(x.kind) || !isNonNegFinite(x.amount) || !isNonNegInt(x.tick)) return false;
  if (x.bonus !== undefined && x.bonus !== true) return false;
  if (x.loot === undefined) return true;
  return Array.isArray(x.loot) && x.loot.length <= 4 && x.loot.every(isLootNote);
}

function isLootNote(x: unknown): boolean {
  return (
    isObject(x) &&
    typeof x.name === 'string' && x.name.length >= 1 && x.name.length <= 80 &&
    isIn(ITEM_RARITIES, x.rarity) &&
    (isIn(ALL_SLOTS, x.base) || isIn(GEM_TYPES, x.base)) &&
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

function isGem(x: unknown, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x) || x.type !== 'gem' || !isIn(GEM_TYPES, x.gem)) return false;
  return isItemBase(x, nextId, seen);
}

function isItemBase(x: Record<string, unknown>, nextId: number, seen: Set<number>): boolean {
  if (!isIdBelow(x.id, nextId) || seen.has(x.id) || !isItemLevel(x.ilvl)) return false;
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
  if (!Array.isArray(x.gems) || x.gems.length > x.sockets || !x.gems.every((g) => isGem(g, nextId, seen))) return false;
  return x.uniqueId === undefined || (typeof x.uniqueId === 'string' && x.uniqueId.length <= 40);
}

function isItem(x: unknown, nextId: number, seen: Set<number>): boolean {
  return isObject(x) && (x.type === 'gem' ? isGem(x, nextId, seen) : isGearItem(x, nextId, seen));
}

function isEquipped(x: unknown, set: GearSet, nextId: number, seen: Set<number>): boolean {
  if (!isObject(x)) return false;
  const slots = slotsOf(set) as readonly string[];
  return Object.entries(x).every(
    ([key, item]) => slots.includes(key) && isGearItem(item, nextId, seen) && item.slot === key,
  );
}

function isBag(x: unknown, set: GearSet, nextId: number, seen: Set<number>): boolean {
  return (
    Array.isArray(x) &&
    x.length <= BAG_SIZE &&
    x.every((item) => isItem(item, nextId, seen) && (item.type !== 'gear' || setOfSlot(item.slot) === set))
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
  if (!isObject(x) || !isIn(['sellWorst', 'stop'], x.bagFull) || !isMotion(x.motion)) return false;
  return (
    Array.isArray(x.lootFilter) &&
    x.lootFilter.length <= MAX_LOOT_RULES &&
    x.lootFilter.every(
      (r) =>
        isObject(r) &&
        (r.rarity === 'any' || isIn(RARITIES, r.rarity)) &&
        (isIn(LOOT_TARGETS, r.target) || isIn(ALL_SLOTS, r.target)) &&
        isIn(['keep', 'sell', 'salvage'], r.action),
    )
  );
}

function isInventory(x: Record<string, unknown>, nextId: number): boolean {
  const seen = new Set<number>();
  const { equipped, bags, stash, overflow, lootTally } = x;
  if (!isObject(equipped) || !isEquipped(equipped.mining, 'mining', nextId, seen) || !isEquipped(equipped.battle, 'battle', nextId, seen)) return false;
  if (!isObject(bags) || !isBag(bags.mining, 'mining', nextId, seen) || !isBag(bags.battle, 'battle', nextId, seen)) return false;
  if (!Array.isArray(stash) || stash.length > STASH_SIZE || !stash.every((i) => isItem(i, nextId, seen))) return false;
  if (!Array.isArray(overflow) || overflow.length > MAX_OVERFLOW) return false;
  const heldOk = overflow.every(
    (o) =>
      isObject(o) &&
      isIn(GEAR_SETS, o.bag) &&
      isItem(o.item, nextId, seen) &&
      (!isObject(o.item) || o.item.type !== 'gear' || setOfSlot(o.item.slot as Slot) === o.bag),
  );
  if (!heldOk) return false;
  return (
    isObject(lootTally) && isNonNegInt(lootTally.kept) && isNonNegInt(lootTally.sold) && isNonNegInt(lootTally.salvaged)
  );
}

export function validateState(x: unknown): x is GameState {
  if (!isObject(x)) return false;
  if (!isUint32(x.seed) || !isUint32(x.rng)) return false;
  if (typeof x.worldSeed !== 'string' || !isValidSeedText(x.worldSeed) || seedFromText(x.worldSeed) !== x.seed) return false;
  if (x.worldGen !== 1 && x.worldGen !== 2) return false;
  if (!isNonNegInt(x.tickCount) || !isNonNegInt(x.depth) || !isNonNegInt(x.deepest)) return false;
  if (x.depth > x.deepest) return false;
  if (!isNonNegFinite(x.lastTickAt) || !isNonNegFinite(x.gold) || !isNonNegFinite(x.diamonds)) return false;
  if (!isUnitRange(x.progress) || !isUnitRange(x.galleryProgress)) return false;
  if (!isObject(x.ahead)) return false;
  for (const [key, roll] of Object.entries(x.ahead)) {
    const metre = Number(key);
    if (!Number.isInteger(metre) || metre <= x.deepest || !isMetreRoll(roll)) return false;
  }
  if (!isNonNegInt(x.nextId) || x.nextId < 1) return false;
  const { nextId } = x;
  if (!isUnitRange(x.goldCarry) || !isInventory(x, nextId) || !isSettings(x.settings)) return false;
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
