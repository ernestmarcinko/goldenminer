import {
  GEM_BAG_STACK, GEM_GRADE_LEVEL, GEM_SALVAGE_TIN, GEM_SELL_GOLD, GEM_STASH_STACK, MAP_RARITY_SELL, MAP_SELL_GOLD,
  MATERIAL_BAG_STACK, MATERIAL_STASH_STACK, MAX_HELD, SALVAGE_MATERIALS, SELL_GOLD,
} from './balance';
import { firstEmpty } from './cells';
import { itemName, MATERIAL_LABELS } from './itemData';
import { isGear, MATERIALS, setOfSlot } from './items';
import type { Cell, GearItem, Gem, GemItem, Item, MapItem, Material, Stack } from './items';
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

/** The materials salvage gives: gear by rarity and item level, plus tin for each socketed gem; a gem stack in tin. */
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
    case 'map':
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

function stowGear(state: GameState, item: GearItem): LootNote[] | null {
  const bag = state.bag;
  const inBag = firstEmpty(bag);
  if (inBag >= 0) {
    bag[inBag] = item;
    return [note(item, 'bag')];
  }
  const general = state.stash.general;
  const inGeneral = firstEmpty(general);
  if (inGeneral >= 0) {
    general[inGeneral] = item;
    return [note(item, 'stash')];
  }
  return null;
}

function stowMap(state: GameState, map: MapItem): LootNote[] | null {
  const empty = firstEmpty(state.bag);
  if (empty < 0) return null;
  state.bag[empty] = map;
  return [note(map, 'bag')];
}

// A find with no room is held, and digging waits on it; past MAX_HELD it is sold. Nothing carried is sold to make room.
function hold(state: GameState, item: Loot): LootNote {
  if (state.overflow.length < MAX_HELD) {
    state.overflow.push(item);
    return note(item, 'held');
  }
  const value = sellPay(item, deriveStats(state));
  state.gold += value;
  return note(item, 'sold', value);
}

// A held stack tops up the bag's stacks of its kind, then takes an empty cell; what doesn't fit stays held. A held
// stack is never above a bag stack, so one cell always takes the rest.
function unholdStack(state: GameState, item: Stack): boolean {
  const cap = item.type === 'gem' ? GEM_BAG_STACK : MATERIAL_BAG_STACK;
  const same = (c: Cell): c is Stack => item.type === 'gem'
    ? c?.type === 'gem' && c.gem === item.gem && c.grade === item.grade
    : c?.type === 'material' && c.material === item.material;
  for (const c of state.bag) {
    if (item.count === 0) break;
    if (!same(c) || c.count >= cap) continue;
    const take = Math.min(cap - c.count, item.count);
    c.count += take;
    item.count -= take;
  }
  if (item.count === 0) return true;
  const empty = firstEmpty(state.bag);
  if (empty < 0) return false;
  state.bag[empty] = item;
  return true;
}

/** Puts a held find where a new find would go: gear in the bag or General, a map or a stack in the bag. */
function unhold(state: GameState, item: Item): boolean {
  switch (item.type) {
    case 'gear': return stowGear(state, item) !== null;
    case 'map': return stowMap(state, item) !== null;
    case 'gem':
    case 'material': return unholdStack(state, item);
  }
}

// A found stack tops up bag stacks, then fills the first empty cell (one stack, under the incoming id), then joins the
// Gems tab; whatever is left is sold. One note, for where the first gem went (a sold remainder still pays out).
function stowGem(state: GameState, gem: GemItem, bag: Cell[]): LootNote[] {
  let left = gem.count;
  let first: LootOutcome | null = null;
  for (const c of bag) {
    if (left === 0) break;
    if (c?.type !== 'gem' || c.gem !== gem.gem || c.grade !== gem.grade || c.count >= GEM_BAG_STACK) continue;
    const take = Math.min(GEM_BAG_STACK - c.count, left);
    c.count += take;
    left -= take;
    first ??= 'bag';
  }
  const empty = firstEmpty(bag);
  if (left > 0 && empty >= 0) {
    const take = Math.min(GEM_BAG_STACK, left);
    bag[empty] = { ...gem, count: take };
    left -= take;
    first ??= 'bag';
  }
  const counts = state.stash.gems[gem.gem];
  const room = Math.min(left, GEM_STASH_STACK - counts[gem.grade]);
  if (room > 0) {
    counts[gem.grade] += room;
    left -= room;
    first ??= 'stash';
  }
  if (left === 0) return [note(gem, first ?? 'bag')];
  const value = sellPay({ ...gem, count: left }, deriveStats(state));
  state.gold += value;
  return [note(gem, first ?? 'sold', first === null ? value : 0)];
}

// A found material tops up the bag's stacks of its kind, and opens a new stack only when the bag has none, so idle
// digging fills at most one cell per material. The rest joins the Materials tab; past its cap it is lost. One note,
// for where the first unit went, counting every unit found.
export function receiveMaterial(state: GameState, material: Material, count: number): LootNote[] {
  if (count <= 0) return [];
  const bag = state.bag;
  let left = count;
  let first: LootOutcome = 'stash';
  let carried = false;
  for (const c of bag) {
    if (left === 0) break;
    if (c?.type !== 'material' || c.material !== material) continue;
    carried = true;
    const take = Math.min(MATERIAL_BAG_STACK - c.count, left);
    if (take <= 0) continue;
    c.count += take;
    left -= take;
    first = 'bag';
  }
  const empty = firstEmpty(bag);
  if (!carried && empty >= 0) {
    const take = Math.min(MATERIAL_BAG_STACK, left);
    bag[empty] = { id: state.nextId++, type: 'material', material, count: take };
    left -= take;
    first = 'bag';
  }
  stashMaterials(state, { [material]: left });
  return [{ name: MATERIAL_LABELS[material], rarity: 'material', base: material, outcome: first, value: count }];
}

export function receiveItem(state: GameState, item: Loot): LootNote[] {
  const action = lootAction(state.settings.lootFilter, item);
  if (action === 'sell') {
    const value = sellPay(item, deriveStats(state));
    state.gold += value;
    return tally(state, [note(item, 'sold', value)]);
  }
  if (action === 'salvage') {
    const value = stashMaterials(state, salvagePay(item, deriveStats(state)));
    return tally(state, [note(item, 'salvaged', value)]);
  }
  if (item.type === 'gem') return tally(state, stowGem(state, item, state.bag));
  const stowed = item.type === 'gear' ? stowGear(state, item) : stowMap(state, item);
  return tally(state, stowed ?? [hold(state, item)]);
}

/** The loot filter acting on a held find again: true when it sold or salvaged it. */
function filterHeld(state: GameState, item: Loot): boolean {
  const action = lootAction(state.settings.lootFilter, item);
  if (action === 'sell') state.gold += sellPay(item, deriveStats(state));
  else if (action === 'salvage') stashMaterials(state, salvagePay(item, deriveStats(state)));
  return action !== 'keep';
}

/** Held finds go in, oldest first, the loot filter first; the first one with no room stops the rest. */
export function drainOverflow(state: GameState): void {
  while (state.overflow.length > 0) {
    const first = state.overflow[0];
    if (first === undefined) return;
    // materials are crafting currency: the filter never sells or salvages them
    const settled = first.type !== 'material' && filterHeld(state, first);
    if (!settled && !unhold(state, first)) return;
    state.overflow.shift();
  }
}
