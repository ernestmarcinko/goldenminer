import {
  GEM_BAG_STACK, GEM_GRADE_LEVEL, GEM_SALVAGE_TIN, GEM_SELL_GOLD, MAP_RARITY_SELL, MAP_SALVAGE, MAP_SELL_GOLD,
  MATERIAL_BAG_STACK, MATERIAL_STASH_STACK, MAX_HELD, SALVAGE_MATERIALS, SELL_GOLD,
} from './balance';
import { firstEmpty } from './cells';
import { itemName, MATERIAL_LABELS } from './itemData';
import { isGear, MATERIALS, setOfSlot } from './items';
import type { Cell, GearItem, Gem, GemItem, Item, MapItem, Material, MaterialItem, Stack } from './items';
import { deriveStats } from './stats';
import type { GameState, LootAction, LootNote, LootOutcome, LootRule, Stats } from './types';

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

/** Adds materials to the Materials tab, each count capped; returns the units that fit. */
export function stashMaterials(state: GameState, counts: Partial<Record<Material, number>>): number {
  let gained = 0;
  for (const m of MATERIALS) {
    const n = Math.min(counts[m] ?? 0, MATERIAL_STASH_STACK - state.stash.materials[m]);
    if (n <= 0) continue;
    state.stash.materials[m] += n;
    gained += n;
  }
  return gained;
}

export function lootAction(rules: LootRule[], item: Loot): LootAction {
  // no rule names maps yet, so 'any' must not catch one
  if (item.type === 'map') return 'keep';
  for (const rule of rules) {
    const rarityOk = rule.rarity === 'any' || (isGear(item) && item.rarity === rule.rarity);
    const targetOk = rule.target === 'any'
      || (isGear(item)
        ? rule.target === item.slot || rule.target === setOfSlot(item.slot)
        : rule.target === 'gem');
    if (rarityOk && targetOk) return rule.action;
  }
  return 'keep';
}

function note(item: Loot, outcome: LootOutcome, value = 0): LootNote {
  switch (item.type) {
    case 'gear': return { name: itemName(item), rarity: item.rarity, base: item.slot, outcome, value };
    case 'gem': return { name: itemName(item), rarity: 'gem', base: item.gem, outcome, value };
    case 'map': return { name: itemName(item), rarity: item.rarity, base: 'map', outcome, value };
  }
}

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

/** The loot filter acting on a find: the note of what it sold or salvaged, paid out; null when it keeps the find. */
function applyFilter(state: GameState, item: Loot): LootNote | null {
  const action = lootAction(state.settings.lootFilter, item);
  switch (action) {
    case 'keep': return null;
    case 'sell': {
      const value = sellPay(item, deriveStats(state));
      state.gold += value;
      return note(item, 'sold', value);
    }
    case 'salvage': return note(item, 'salvaged', stashMaterials(state, salvagePay(item, deriveStats(state))));
  }
}

// A found stack tops up the bag's stacks, then opens one cell; the rest is held, and past MAX_HELD it is sold. One
// note, for where the first gem went (a sold remainder still pays out).
function stowGem(state: GameState, gem: GemItem): LootNote {
  const open = stacksOf(state, gem);
  const unplaced = stackIntoBag(state, gem, gem.count, 1, open);
  const unheld = holdStack(state, gem, unplaced, open);
  const value = unheld > 0 ? sellPay({ ...gem, count: unheld }, deriveStats(state)) : 0;
  state.gold += value;
  if (unplaced < gem.count) return note(gem, 'bag');
  return unheld < unplaced ? note(gem, 'held') : note(gem, 'sold', value);
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
function stow(state: GameState, item: Loot): LootNote {
  if (item.type === 'gem') return stowGem(state, item);
  if (intoEmptyCell(state, item)) return note(item, 'bag');
  if (state.overflow.length < MAX_HELD) {
    state.overflow.push(item);
    return note(item, 'held');
  }
  const value = sellPay(item, deriveStats(state));
  state.gold += value;
  return note(item, 'sold', value);
}

/** Every find goes through here: the loot filter first, then the bag, then the held list, then a sale. */
export function receiveItem(state: GameState, item: Loot): LootNote[] {
  return tally(state, [applyFilter(state, item) ?? stow(state, item)]);
}

// A found material tops up the bag's stacks of its kind, then opens as many cells as it needs; the rest is held as a
// stack (split at a bag stack, as a held stack is never bigger), and past MAX_HELD it joins the Materials tab (past that
// tab's cap it is lost). One note, for where the first unit went, counting every unit found.
export function receiveMaterial(state: GameState, material: Material, count: number): LootNote[] {
  if (count <= 0) return [];
  const kind = { type: 'material', material } as const;
  const open = (n: number): MaterialItem => ({ id: state.nextId++, type: 'material', material, count: n });
  const unplaced = stackIntoBag(state, kind, count, Infinity, open);
  const unheld = holdStack(state, kind, unplaced, open);
  stashMaterials(state, { [material]: unheld });
  const first: LootOutcome = unplaced < count ? 'bag' : unheld < unplaced ? 'held' : 'stash';
  return [{ name: MATERIAL_LABELS[material], rarity: 'material', base: material, outcome: first, value: count }];
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

/** Held finds go in, oldest first, the loot filter first; the first one with no room stops the rest. */
export function drainOverflow(state: GameState): void {
  while (state.overflow.length > 0) {
    const first = state.overflow[0];
    if (first === undefined) return;
    // materials are crafting currency: the filter never sells or salvages them
    const settled = first.type !== 'material' && applyFilter(state, first) !== null;
    if (!settled && !unhold(state, first)) return;
    state.overflow.shift();
  }
}
