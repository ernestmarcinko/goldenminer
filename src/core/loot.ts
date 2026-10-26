import {
  GEM_BAG_STACK, GEM_GRADE_LEVEL, GEM_SALVAGE_TIN, GEM_SELL_GOLD, GEM_STASH_STACK, MAP_RARITY_SELL, MAP_SALVAGE, MAP_SELL_GOLD,
  MATERIAL_BAG_STACK, MATERIAL_STASH_STACK, MAX_HELD, SALVAGE_MATERIALS, SELL_GOLD,
} from './balance';
import { firstEmpty } from './cells';
import { logDrop, trail } from './dropLog';
import { itemName, MATERIAL_LABELS } from './itemData';
import { MATERIALS } from './items';
import { ruleMatches } from './lootFilter';
import { putMap } from './maps';
import type { Cell, GearItem, Gem, GemItem, Item, MapItem, Material, MaterialItem, Stack } from './items';
import { deriveStats } from './stats';
import type { DropOrigin, GameState, LootAction, LootNote, LootOutcome, LootRule, Stats, TrailStep } from './types';

const tierFactor = (level: number): number => 1 + Math.floor(level / 5);

export function gemSellValue(g: Gem): number {
  return GEM_SELL_GOLD * GEM_GRADE_LEVEL[g.grade];
}

const gemSalvageTin = (g: Gem): number => GEM_SALVAGE_TIN * tierFactor(GEM_GRADE_LEVEL[g.grade]);

/** What the loot filter, selling and salvaging deal in: gear, gem stacks and maps. */
export type Loot = GearItem | GemItem | MapItem;

export function sellValue(item: Loot): number {
  switch (item.type) {
    case 'gear': return item.gems.reduce((sum, g) => sum + gemSellValue(g), SELL_GOLD[item.rarity] * item.ilvl);
    case 'gem': return gemSellValue(item) * item.count;
    case 'map': return Math.round(MAP_SELL_GOLD * item.tier ** 2 * MAP_RARITY_SELL[item.rarity]);
  }
}

/**
 * The materials salvage gives: gear by rarity and item level, plus tin for each socketed gem; a gem stack in tin; a map
 * in copper, and tin from MAP_SALVAGE.tinFromTier, by its tier.
 */
export function salvageYield(item: Item): Partial<Record<Material, number>> {
  const out: Partial<Record<Material, number>> = {};
  const add = (m: Material, n: number): void => { out[m] = (out[m] ?? 0) + n; };
  switch (item.type) {
    case 'gear': {
      const base = SALVAGE_MATERIALS[item.rarity];
      for (const m of MATERIALS) {
        const n = base[m];
        if (n !== undefined) add(m, n * tierFactor(item.ilvl));
      }
      for (const g of item.gems) add('tin', gemSalvageTin(g));
      return out;
    }
    case 'gem':
      add('tin', gemSalvageTin(item) * item.count);
      return out;
    case 'map': {
      const g = tierFactor(item.tier);
      add('copper', MAP_SALVAGE.copper * g);
      if (item.tier >= MAP_SALVAGE.tinFromTier) add('tin', MAP_SALVAGE.tin * g);
      return out;
    }
    case 'material':
      return out;
  }
}

/** The Gold a sale pays: the item's value, raised by sell bonus. Every sale pays this. */
export function sellPay(item: Loot, stats: Stats): number {
  return Math.round(sellValue(item) * stats.sellMultiplier);
}

/** The materials a salvage pays: the item's yield raised by salvage yield, each material rounded. Every salvage pays this. */
export function salvagePay(item: Item, stats: Stats): Partial<Record<Material, number>> {
  const out: Partial<Record<Material, number>> = {};
  for (const [m, n] of Object.entries(salvageYield(item)) as [Material, number][]) {
    out[m] = Math.round(n * stats.salvageMultiplier);
  }
  return out;
}

/** Adds materials to the Materials tab, each count capped; returns what fit, material by material. */
export function stashMaterials(state: GameState, counts: Partial<Record<Material, number>>): Partial<Record<Material, number>> {
  const stored: Partial<Record<Material, number>> = {};
  for (const m of MATERIALS) {
    const n = Math.min(counts[m] ?? 0, MATERIAL_STASH_STACK - state.stash.materials[m]);
    if (n <= 0) continue;
    state.stash.materials[m] += n;
    stored[m] = n;
  }
  return stored;
}

const units = (counts: Partial<Record<Material, number>>): number => Object.values(counts).reduce((sum, n) => sum + n, 0);

/** The first matching rule's action; nothing matching keeps. A material only ever matches a keep or stash rule. */
export function lootAction(rules: readonly LootRule[], item: Item): LootAction {
  return rules.find((r) => ruleMatches(r, item))?.action ?? 'keep';
}

function note(item: Item, outcome: LootOutcome, value = 0): LootNote {
  switch (item.type) {
    case 'gear': return { name: itemName(item), rarity: item.rarity, base: item.slot, outcome, value };
    case 'gem': return { name: itemName(item), rarity: 'gem', base: item.gem, outcome, value };
    case 'map': return { name: itemName(item), rarity: item.rarity, base: 'map', outcome, value };
    case 'material': return { name: itemName(item), rarity: 'material', base: item.material, outcome, value };
  }
}

/** Sells a find, or part of a gem stack, for its sell pay: the Gold is paid and the note says how much. */
export function sellFind(state: GameState, item: Loot): LootNote {
  const value = sellPay(item, deriveStats(state));
  state.gold += value;
  return note(item, 'sold', value);
}

/** What became of a find, or of part of a gem stack: its note, its first logged step and the units it covers. */
interface Fate { note: LootNote; step: TrailStep; count: number }

const fate = (note: LootNote, step: TrailStep, count = 1): Fate => ({ note, step, count });
const unitsOf = (item: Item): number => (item.type === 'gem' || item.type === 'material' ? item.count : 1);

function tally(state: GameState, notes: LootNote[]): LootNote[] {
  for (const n of notes) {
    if (n.outcome === 'sold') state.lootTally.sold += 1;
    else if (n.outcome === 'salvaged') state.lootTally.salvaged += 1;
    else state.lootTally.kept += 1;
  }
  return notes;
}

// The kind of a stack: what decides whether two stacks are one.
type StackKind = Pick<GemItem, 'type' | 'gem' | 'grade'> | Pick<MaterialItem, 'type' | 'material'>;

const bagCap = (kind: StackKind): number => (kind.type === 'gem' ? GEM_BAG_STACK : MATERIAL_BAG_STACK);

function sameKind(kind: StackKind, c: Cell): c is Stack {
  return kind.type === 'gem'
    ? c?.type === 'gem' && c.gem === kind.gem && c.grade === kind.grade
    : c?.type === 'material' && c.material === kind.material;
}

/** New stacks of a find's kind: the first keeps the find's id, any after it take fresh ones. */
function stacksOf(state: GameState, item: Stack): (count: number) => Stack {
  let used = false;
  return (count) => {
    const id = used ? state.nextId++ : item.id;
    used = true;
    return { ...item, id, count };
  };
}

/**
 * Puts `count` units of a kind into the bag: every bag stack of it is topped up, then up to `cells` empty cells open,
 * each a stack from `open`. Returns the units that didn't fit.
 */
export function stackIntoBag(
  state: GameState, kind: StackKind, count: number, cells: number, open: (count: number) => Stack,
): number {
  const cap = bagCap(kind);
  let left = count;
  for (const c of state.bag) {
    if (left === 0) break;
    if (!sameKind(kind, c) || c.count >= cap) continue;
    const take = Math.min(cap - c.count, left);
    c.count += take;
    left -= take;
  }
  for (let opened = 0; left > 0 && opened < cells; opened++) {
    const empty = firstEmpty(state.bag);
    if (empty < 0) break;
    const take = Math.min(cap, left);
    state.bag[empty] = open(take);
    left -= take;
  }
  return left;
}

/** Holds what didn't fit, in stacks of at most a bag stack, while the held list has room; returns the units left over. */
function holdStack(state: GameState, kind: StackKind, count: number, open: (count: number) => Stack): number {
  let left = count;
  while (left > 0 && state.overflow.length < MAX_HELD) {
    const take = Math.min(bagCap(kind), left);
    state.overflow.push(open(take));
    left -= take;
  }
  return left;
}

/**
 * A find stashed in its tab: gear in the General tab's first empty cell, a map in its tier, a gem or material stack as
 * much as the tab's cap takes (the fate counts those units). Null when the tab has no room, so the find goes on as kept.
 */
function stashFind(state: GameState, item: Item): Fate | null {
  const stashed = (n: number): Fate =>
    fate(note(item, 'stash', item.type === 'material' ? n : 0), { event: 'filterStashed' }, n);
  switch (item.type) {
    case 'gear': {
      const empty = firstEmpty(state.stash.general);
      if (empty < 0) return null;
      state.stash.general[empty] = item;
      return stashed(1);
    }
    case 'map': return putMap(state, item) === 'ok' ? stashed(1) : null;
    case 'gem': {
      const counts = state.stash.gems[item.gem];
      const n = Math.min(item.count, GEM_STASH_STACK - counts[item.grade]);
      if (n <= 0) return null;
      counts[item.grade] += n;
      return stashed(n);
    }
    case 'material': {
      const n = units(stashMaterials(state, { [item.material]: item.count }));
      return n > 0 ? stashed(n) : null;
    }
  }
}

/**
 * The loot filter acting on a find: what it sold, salvaged or stashed, paid out; null when it keeps the find. A stash
 * may take only part of a stack; the rest is the caller's to keep.
 */
function applyFilter(state: GameState, item: Item): Fate | null {
  const action = lootAction(state.settings.lootFilter, item);
  // materials are crafting currency: only keep and stash rules match them
  if (item.type === 'material') return action === 'stash' ? stashFind(state, item) : null;
  switch (action) {
    case 'keep': return null;
    case 'stash': return stashFind(state, item);
    case 'sell': {
      const sold = sellFind(state, item);
      return fate(sold, { event: 'filterSold', gold: sold.value }, unitsOf(item));
    }
    case 'salvage': {
      const stored = stashMaterials(state, salvagePay(item, deriveStats(state)));
      return fate(note(item, 'salvaged', units(stored)), { event: 'filterSalvaged', materials: stored }, unitsOf(item));
    }
  }
}

// A found stack tops up the bag's stacks, then opens one cell; the rest is held, and past MAX_HELD it is sold. Each
// part that went somewhere else has its own fate, so a sold remainder is noted and logged with its Gold.
function stowGem(state: GameState, gem: GemItem): Fate[] {
  const open = stacksOf(state, gem);
  const unplaced = stackIntoBag(state, gem, gem.count, 1, open);
  const unheld = holdStack(state, gem, unplaced, open);
  const fates: Fate[] = [];
  if (unplaced < gem.count) fates.push(fate(note(gem, 'bag'), { event: 'bag' }, gem.count - unplaced));
  if (unheld < unplaced) fates.push(fate(note(gem, 'held'), { event: 'held' }, unplaced - unheld));
  if (unheld > 0) {
    const sold = sellFind(state, { ...gem, count: unheld });
    fates.push(fate(sold, { event: 'sold', gold: sold.value }, unheld));
  }
  return fates;
}

/** Puts gear or a map in the bag's first empty cell; false when there is none. */
function intoEmptyCell(state: GameState, item: GearItem | MapItem): boolean {
  const empty = firstEmpty(state.bag);
  if (empty < 0) return false;
  state.bag[empty] = item;
  return true;
}

/**
 * Where a kept find goes: gear and maps to the bag's first empty cell, a gem stack as `stowGem` says. With no room it
 * is held, and digging waits on it; past MAX_HELD it is sold. Nothing carried is sold to make room.
 */
function stow(state: GameState, item: Loot): Fate[] {
  if (item.type === 'gem') return stowGem(state, item);
  if (intoEmptyCell(state, item)) return [fate(note(item, 'bag'), { event: 'bag' })];
  if (state.overflow.length < MAX_HELD) {
    state.overflow.push(item);
    return [fate(note(item, 'held'), { event: 'held' })];
  }
  const sold = sellFind(state, item);
  return [fate(sold, { event: 'sold', gold: sold.value })];
}

/**
 * Every find goes through here: the loot filter first, then the bag, then the held list, then a sale. Each fate is
 * logged from `origin`; a gem stack's later parts take fresh ids, as the first keeps the find's. What a stash rule's
 * tab had no room for is kept.
 */
export function receiveItem(state: GameState, item: Loot, origin: DropOrigin): LootNote[] {
  const filtered = applyFilter(state, item);
  const rest = unitsOf(item) - (filtered?.count ?? 0);
  const fates = filtered === null ? stow(state, item)
    : rest > 0 && item.type === 'gem' ? [filtered, ...stowGem(state, { ...item, count: rest })]
    : [filtered];
  fates.forEach((f, i) => {
    const id = i === 0 ? item.id : state.nextId++;
    logDrop(state, item.type === 'gem' ? { ...item, id, count: f.count } : item, origin, f.step);
  });
  return tally(state, fates.map((f) => f.note));
}

/**
 * A found material goes to the Materials tab when a stash rule matches it, as one note and one entry for the units
 * stored; the rest, or the whole find otherwise, is kept as `keepMaterial` says.
 */
export function receiveMaterial(state: GameState, material: Material, count: number, origin: DropOrigin): LootNote[] {
  if (count <= 0) return [];
  const stashed = applyFilter(state, { id: 0, type: 'material', material, count });
  if (stashed === null) return keepMaterial(state, material, count, origin);
  logDrop(state, { id: state.nextId++, type: 'material', material, count: stashed.count }, origin, stashed.step);
  return [stashed.note, ...keepMaterial(state, material, count - stashed.count, origin)];
}

// A kept material tops up the bag's stacks of its kind, then opens as many cells as it needs; the rest is held as a
// stack (split at a bag stack, as a held stack is never bigger), and past MAX_HELD it joins the Materials tab. One note
// and one entry for where the first unit went, counting every unit kept; what the tab's cap turned away is logged lost.
function keepMaterial(state: GameState, material: Material, count: number, origin: DropOrigin): LootNote[] {
  if (count <= 0) return [];
  const kind = { type: 'material', material } as const;
  const open = (n: number): MaterialItem => ({ id: state.nextId++, type: 'material', material, count: n });
  const unplaced = stackIntoBag(state, kind, count, Infinity, open);
  const unheld = holdStack(state, kind, unplaced, open);
  const lost = unheld - units(stashMaterials(state, { [material]: unheld }));
  const kept = count - lost;
  const log = (n: number, step: TrailStep) => logDrop(state, open(n), origin, step);   // a fresh id: the entry is no stack's
  const notes: LootNote[] = [];
  if (kept > 0) {
    const first: LootOutcome = unplaced < count ? 'bag' : unheld < unplaced ? 'held' : 'stash';
    notes.push({ name: MATERIAL_LABELS[material], rarity: 'material', base: material, outcome: first, value: kept });
    log(kept, { event: first === 'stash' ? 'stashed' : first });
  }
  if (lost > 0) log(lost, { event: 'lost' });
  return notes;
}

// A held stack is never above a bag stack, so once the top-ups are done one empty cell takes the rest, under its id.
function unhold(state: GameState, item: Item): boolean {
  switch (item.type) {
    case 'gear':
    case 'map': return intoEmptyCell(state, item);
    case 'gem':
    case 'material':
      item.count = stackIntoBag(state, item, item.count, 1, (n) => ({ ...item, count: n }));
      return item.count === 0;
  }
}

/**
 * Held finds go in, oldest first, the loot filter first; the first one with no room stops the rest. A stack a stash
 * rule's tab took only part of stays held with the rest, and goes on as kept.
 */
export function drainOverflow(state: GameState): void {
  while (state.overflow.length > 0) {
    const first = state.overflow[0];
    if (first === undefined) return;
    const settled = applyFilter(state, first);
    if (settled !== null) {
      trail(state, first.id, settled.step);
      if (settled.count < unitsOf(first) && (first.type === 'gem' || first.type === 'material')) first.count -= settled.count;
      else {
        state.overflow.shift();
        continue;
      }
    }
    if (!unhold(state, first)) return;
    trail(state, first.id, { event: 'bag' });
    state.overflow.shift();
  }
}
